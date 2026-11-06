package desk

import (
	"errors"
	"testing"
)

func TestValidateCycle(t *testing.T) {
	input := CycleInput{
		Title:      "Checkout drop-off",
		Stage:      "discover",
		SignalKind: "metrics",
		Signal:     "Activation fell.",
		Score:      84,
	}
	if err := ValidateCycle(NormalizeCycle(input)); err != nil {
		t.Fatal(err)
	}

	blank := input
	blank.Title = "  "
	if err := ValidateCycle(NormalizeCycle(blank)); !errors.Is(err, ErrInvalid) {
		t.Fatalf("blank title should be invalid, got %v", err)
	}

	stage := input
	stage.Stage = "ship"
	if err := ValidateCycle(NormalizeCycle(stage)); !errors.Is(err, ErrInvalid) {
		t.Fatalf("bad stage should be invalid, got %v", err)
	}

	score := input
	score.Score = 140
	if err := ValidateCycle(NormalizeCycle(score)); !errors.Is(err, ErrInvalid) {
		t.Fatalf("score above 100 should be invalid, got %v", err)
	}

	rate := 120.0
	metrics := input
	metrics.Metrics.ErrorRate = &rate
	if err := ValidateCycle(NormalizeCycle(metrics)); !errors.Is(err, ErrInvalid) {
		t.Fatalf("error rate above 100 should be invalid, got %v", err)
	}
}

func TestNormalizeCycleDefaultsTheOpenStage(t *testing.T) {
	input := NormalizeCycle(CycleInput{Title: " Night bus "})
	if input.Title != "Night bus" || input.Stage != "discover" || input.SignalKind != "events" {
		t.Fatalf("unexpected defaults: %+v", input)
	}
}
