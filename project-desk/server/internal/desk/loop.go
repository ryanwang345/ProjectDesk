package desk

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const cycleSchema = `
CREATE TABLE IF NOT EXISTS cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
    stage TEXT NOT NULL CHECK (stage IN ('discover', 'deliver', 'validate', 'rediscover')),
    signal_kind TEXT NOT NULL CHECK (signal_kind IN ('events', 'metrics', 'feedback', 'alerts', 'trends')),
    signal TEXT NOT NULL DEFAULT '' CHECK (char_length(signal) <= 280),
    finding TEXT NOT NULL DEFAULT '' CHECK (char_length(finding) <= 280),
    score INT NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    commit_done BOOLEAN NOT NULL DEFAULT false,
    ci_done BOOLEAN NOT NULL DEFAULT false,
    tests_done BOOLEAN NOT NULL DEFAULT false,
    deploy_done BOOLEAN NOT NULL DEFAULT false,
    release_done BOOLEAN NOT NULL DEFAULT false,
    trunk BOOLEAN NOT NULL DEFAULT false,
    pipeline BOOLEAN NOT NULL DEFAULT false,
    automated_deploy BOOLEAN NOT NULL DEFAULT false,
    feature_flag BOOLEAN NOT NULL DEFAULT false,
    activation DOUBLE PRECISION CHECK (activation IS NULL OR (activation >= 0 AND activation <= 100)),
    conversion DOUBLE PRECISION CHECK (conversion IS NULL OR (conversion >= 0 AND conversion <= 100)),
    revenue_cents INT CHECK (revenue_cents IS NULL OR revenue_cents >= 0),
    latency_ms INT CHECK (latency_ms IS NULL OR (latency_ms >= 0 AND latency_ms <= 600000)),
    error_rate DOUBLE PRECISION CHECK (error_rate IS NULL OR (error_rate >= 0 AND error_rate <= 100)),
    lesson TEXT NOT NULL DEFAULT '' CHECK (char_length(lesson) <= 280),
    priority TEXT NOT NULL DEFAULT '' CHECK (char_length(priority) <= 120),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`

const cycleReturning = `
id::text, title, stage, signal_kind, signal, finding, score, started_at,
commit_done, ci_done, tests_done, deploy_done, release_done,
trunk, pipeline, automated_deploy, feature_flag,
activation, conversion, revenue_cents, latency_ms, error_rate,
lesson, priority, updated_at, workflow_state, origin_cycle_id::text, repo`

type Delivery struct {
	Commit  bool `json:"commit"`
	CI      bool `json:"ci"`
	Tests   bool `json:"tests"`
	Deploy  bool `json:"deploy"`
	Release bool `json:"release"`
}

type Practices struct {
	Trunk           bool `json:"trunk"`
	Pipeline        bool `json:"pipeline"`
	AutomatedDeploy bool `json:"automatedDeploy"`
	FeatureFlag     bool `json:"featureFlag"`
}

type Metrics struct {
	Activation   *float64 `json:"activation"`
	Conversion   *float64 `json:"conversion"`
	RevenueCents *int     `json:"revenueCents"`
	LatencyMs    *int     `json:"latencyMs"`
	ErrorRate    *float64 `json:"errorRate"`
}

type Cycle struct {
	ID         string    `json:"id"`
	Title      string    `json:"title"`
	Stage      string    `json:"stage"`
	SignalKind string    `json:"signalKind"`
	Signal     string    `json:"signal"`
	Finding    string    `json:"finding"`
	Score      int       `json:"score"`
	StartedAt  time.Time `json:"startedAt"`
	Delivery   Delivery  `json:"delivery"`
	Practices  Practices `json:"practices"`
	Metrics    Metrics   `json:"metrics"`
	Lesson     string    `json:"lesson"`
	Priority   string    `json:"priority"`
	UpdatedAt  time.Time `json:"updatedAt"`
	// WorkflowState is the orchestration state. It maps onto the four
	// user-facing stages; see StageFor.
	WorkflowState string  `json:"workflowState"`
	OriginCycleID *string `json:"originCycleId"`
	// Repo names an authorized repository under the configured repos root.
	Repo string `json:"repo"`
}

type CycleInput struct {
	Title      string
	Stage      string
	SignalKind string
	Signal     string
	Finding    string
	Score      int
	Delivery   Delivery
	Practices  Practices
	Metrics    Metrics
	Lesson     string
	Priority   string
	Repo       string
}

func (s *Store) ListCycles(ctx context.Context) ([]Cycle, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+cycleReturning+` FROM cycles ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cycles := []Cycle{}
	for rows.Next() {
		cycle, err := scanCycle(rows)
		if err != nil {
			return nil, err
		}
		cycles = append(cycles, cycle)
	}
	return cycles, rows.Err()
}

func (s *Store) CreateCycle(ctx context.Context, input CycleInput) (Cycle, error) {
	input = NormalizeCycle(input)
	if err := ValidateCycle(input); err != nil {
		return Cycle{}, err
	}
	row := s.pool.QueryRow(ctx, `
		INSERT INTO cycles (
			title, stage, signal_kind, signal, finding, score,
			commit_done, ci_done, tests_done, deploy_done, release_done,
			trunk, pipeline, automated_deploy, feature_flag,
			activation, conversion, revenue_cents, latency_ms, error_rate,
			lesson, priority, repo
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, $13, $14, $15,
			$16, $17, $18, $19, $20,
			$21, $22, $23
		) RETURNING `+cycleReturning,
		input.Title, input.Stage, input.SignalKind, input.Signal, input.Finding, input.Score,
		input.Delivery.Commit, input.Delivery.CI, input.Delivery.Tests, input.Delivery.Deploy, input.Delivery.Release,
		input.Practices.Trunk, input.Practices.Pipeline, input.Practices.AutomatedDeploy, input.Practices.FeatureFlag,
		input.Metrics.Activation, input.Metrics.Conversion, input.Metrics.RevenueCents, input.Metrics.LatencyMs, input.Metrics.ErrorRate,
		input.Lesson, input.Priority, input.Repo)
	return scanCycle(row)
}

func (s *Store) GetCycle(ctx context.Context, id string) (Cycle, error) {
	cycle, err := scanCycle(s.pool.QueryRow(ctx, `SELECT `+cycleReturning+` FROM cycles WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return Cycle{}, ErrNotFound
	}
	return cycle, err
}

func (s *Store) UpdateCycle(ctx context.Context, id string, input CycleInput) (Cycle, error) {
	input = NormalizeCycle(input)
	if err := ValidateCycle(input); err != nil {
		return Cycle{}, err
	}
	row := s.pool.QueryRow(ctx, `
		UPDATE cycles SET
			title = $2, stage = $3, signal_kind = $4, signal = $5, finding = $6, score = $7,
			commit_done = $8, ci_done = $9, tests_done = $10, deploy_done = $11, release_done = $12,
			trunk = $13, pipeline = $14, automated_deploy = $15, feature_flag = $16,
			activation = $17, conversion = $18, revenue_cents = $19, latency_ms = $20, error_rate = $21,
			lesson = $22, priority = $23, repo = $24, updated_at = now()
		WHERE id = $1
		RETURNING `+cycleReturning,
		id, input.Title, input.Stage, input.SignalKind, input.Signal, input.Finding, input.Score,
		input.Delivery.Commit, input.Delivery.CI, input.Delivery.Tests, input.Delivery.Deploy, input.Delivery.Release,
		input.Practices.Trunk, input.Practices.Pipeline, input.Practices.AutomatedDeploy, input.Practices.FeatureFlag,
		input.Metrics.Activation, input.Metrics.Conversion, input.Metrics.RevenueCents, input.Metrics.LatencyMs, input.Metrics.ErrorRate,
		input.Lesson, input.Priority, input.Repo)
	cycle, err := scanCycle(row)
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return Cycle{}, ErrNotFound
	}
	return cycle, err
}

func (s *Store) DeleteCycle(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM cycles WHERE id = $1`, id)
	if err != nil {
		if isInvalidUUID(err) {
			return ErrNotFound
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) CreateSampleCycle(ctx context.Context) (Cycle, error) {
	activation := 23.6
	return s.CreateCycle(ctx, CycleInput{
		Title:      "Checkout drop-off",
		Stage:      "discover",
		SignalKind: "metrics",
		Signal:     "Activation fell after the paywall moved in front of the first task.",
		Finding:    "People are asked to pay before they have finished anything.",
		Score:      84,
		Practices: Practices{
			Trunk:           true,
			Pipeline:        true,
			AutomatedDeploy: true,
		},
		Metrics: Metrics{Activation: &activation},
	})
}

func NormalizeCycle(input CycleInput) CycleInput {
	input.Title = strings.TrimSpace(input.Title)
	input.Signal = strings.TrimSpace(input.Signal)
	input.Finding = strings.TrimSpace(input.Finding)
	input.Lesson = strings.TrimSpace(input.Lesson)
	input.Priority = strings.TrimSpace(input.Priority)
	input.Repo = strings.TrimSpace(input.Repo)
	if input.Stage == "" {
		input.Stage = "discover"
	}
	if input.SignalKind == "" {
		input.SignalKind = "events"
	}
	return input
}

func ValidateCycle(input CycleInput) error {
	switch {
	case input.Title == "":
		return fmt.Errorf("%w: enter a title", ErrInvalid)
	case len([]rune(input.Title)) > 80:
		return fmt.Errorf("%w: keep the title under 80 characters", ErrInvalid)
	case !validStage(input.Stage):
		return fmt.Errorf("%w: choose discover, deliver, validate, or rediscover", ErrInvalid)
	case !validSignalKind(input.SignalKind):
		return fmt.Errorf("%w: choose events, metrics, feedback, alerts, or trends", ErrInvalid)
	case len([]rune(input.Signal)) > 280:
		return fmt.Errorf("%w: keep the signal under 280 characters", ErrInvalid)
	case len([]rune(input.Finding)) > 280:
		return fmt.Errorf("%w: keep the finding under 280 characters", ErrInvalid)
	case input.Score < 0 || input.Score > 100:
		return fmt.Errorf("%w: score the opportunity from 0 to 100", ErrInvalid)
	case !validPercent(input.Metrics.Activation):
		return fmt.Errorf("%w: activation is a percent from 0 to 100", ErrInvalid)
	case !validPercent(input.Metrics.Conversion):
		return fmt.Errorf("%w: conversion is a percent from 0 to 100", ErrInvalid)
	case !validPercent(input.Metrics.ErrorRate):
		return fmt.Errorf("%w: error rate is a percent from 0 to 100", ErrInvalid)
	case input.Metrics.RevenueCents != nil && *input.Metrics.RevenueCents < 0:
		return fmt.Errorf("%w: revenue cannot be negative", ErrInvalid)
	case input.Metrics.LatencyMs != nil && (*input.Metrics.LatencyMs < 0 || *input.Metrics.LatencyMs > 600000):
		return fmt.Errorf("%w: latency is milliseconds from 0 to 600000", ErrInvalid)
	case len([]rune(input.Lesson)) > 280:
		return fmt.Errorf("%w: keep the lesson under 280 characters", ErrInvalid)
	case len([]rune(input.Priority)) > 120:
		return fmt.Errorf("%w: keep the priority under 120 characters", ErrInvalid)
	case input.Repo != "" && !validRepoName(input.Repo):
		return fmt.Errorf("%w: the repository name may only contain letters, digits, dots, dashes, and underscores", ErrInvalid)
	default:
		return nil
	}
}

func validStage(stage string) bool {
	switch stage {
	case "discover", "deliver", "validate", "rediscover":
		return true
	default:
		return false
	}
}

func validSignalKind(kind string) bool {
	switch kind {
	case "events", "metrics", "feedback", "alerts", "trends":
		return true
	default:
		return false
	}
}

// validRepoName keeps the repo name a single path segment, so it can never
// escape the authorized repos root.
func validRepoName(name string) bool {
	if name == "" || name == "." || name == ".." || len(name) > 80 {
		return false
	}
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '.', r == '-', r == '_':
		default:
			return false
		}
	}
	return true
}

func validPercent(value *float64) bool {
	return value == nil || (*value >= 0 && *value <= 100)
}

func scanCycle(row scanner) (Cycle, error) {
	var cycle Cycle
	err := row.Scan(
		&cycle.ID, &cycle.Title, &cycle.Stage, &cycle.SignalKind, &cycle.Signal, &cycle.Finding, &cycle.Score,
		&cycle.StartedAt,
		&cycle.Delivery.Commit, &cycle.Delivery.CI, &cycle.Delivery.Tests, &cycle.Delivery.Deploy, &cycle.Delivery.Release,
		&cycle.Practices.Trunk, &cycle.Practices.Pipeline, &cycle.Practices.AutomatedDeploy, &cycle.Practices.FeatureFlag,
		&cycle.Metrics.Activation, &cycle.Metrics.Conversion, &cycle.Metrics.RevenueCents, &cycle.Metrics.LatencyMs, &cycle.Metrics.ErrorRate,
		&cycle.Lesson, &cycle.Priority, &cycle.UpdatedAt,
		&cycle.WorkflowState, &cycle.OriginCycleID, &cycle.Repo,
	)
	return cycle, err
}
