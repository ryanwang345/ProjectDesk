package desk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

// Job is one unit of background work. Rows live in Postgres so they survive
// browser reloads and API restarts; a worker claims them with
// FOR UPDATE SKIP LOCKED, so several API replicas can share the queue.
type Job struct {
	ID               string          `json:"id"`
	CycleID          *string         `json:"cycleId"`
	Kind             string          `json:"kind"`
	Status           string          `json:"status"`
	Payload          json.RawMessage `json:"payload"`
	Result           json.RawMessage `json:"result"`
	Error            string          `json:"error"`
	Attempts         int             `json:"attempts"`
	MaxAttempts      int             `json:"maxAttempts"`
	TimeoutSeconds   int             `json:"timeoutSeconds"`
	RunAfter         time.Time       `json:"runAfter"`
	CancelRequested  bool            `json:"cancelRequested"`
	ProviderName     string          `json:"providerName"`
	Model            string          `json:"model"`
	Simulated        bool            `json:"simulated"`
	PromptTokens     int             `json:"promptTokens"`
	CompletionTokens int             `json:"completionTokens"`
	CreatedAt        time.Time       `json:"createdAt"`
	UpdatedAt        time.Time       `json:"updatedAt"`
	FinishedAt       *time.Time      `json:"finishedAt"`
}

// ErrBusy is returned when the same kind of job is already queued or
// running for a cycle. Enqueue is idempotent per (cycle, kind) in flight.
var ErrBusy = errors.New("that step is already running for this cycle")

// ErrLimit is returned when a cycle has used its AI execution budget.
var ErrLimit = errors.New("this cycle reached its AI execution limit")

const jobColumns = `j.id::text, j.cycle_id::text, j.kind, j.status, j.payload, j.result, j.error, j.attempts, j.max_attempts,
	j.timeout_seconds, j.run_after, j.cancel_requested, coalesce(p.name, ''), j.model, j.simulated,
	j.prompt_tokens, j.completion_tokens, j.created_at, j.updated_at, j.finished_at`

const jobFrom = ` FROM jobs j LEFT JOIN providers p ON p.id = j.provider_id `

func scanJob(row scanner) (Job, error) {
	var j Job
	var payload, result []byte
	err := row.Scan(&j.ID, &j.CycleID, &j.Kind, &j.Status, &payload, &result, &j.Error, &j.Attempts, &j.MaxAttempts,
		&j.TimeoutSeconds, &j.RunAfter, &j.CancelRequested, &j.ProviderName, &j.Model, &j.Simulated,
		&j.PromptTokens, &j.CompletionTokens, &j.CreatedAt, &j.UpdatedAt, &j.FinishedAt)
	if err != nil {
		return j, err
	}
	j.Payload = json.RawMessage(payload)
	if len(j.Payload) == 0 {
		j.Payload = json.RawMessage(`{}`)
	}
	if len(result) > 0 {
		j.Result = json.RawMessage(result)
	}
	return j, nil
}

// Enqueue adds a job. It refuses when the same kind is already in flight
// for the cycle, and when the cycle has reached the per-cycle limit.
func (s *Store) Enqueue(ctx context.Context, cycleID *string, kind string, payload any, maxPerCycle int) (Job, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return Job{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Job{}, err
	}
	defer tx.Rollback(ctx)
	if cycleID != nil {
		var inFlight, total int
		if err := tx.QueryRow(ctx, `
			SELECT count(*) FILTER (WHERE status IN ('queued', 'running') AND kind = $2), count(*)
			FROM jobs WHERE cycle_id = $1`, *cycleID, kind).Scan(&inFlight, &total); err != nil {
			if isInvalidUUID(err) {
				return Job{}, ErrNotFound
			}
			return Job{}, err
		}
		if inFlight > 0 {
			return Job{}, ErrBusy
		}
		if maxPerCycle > 0 && total >= maxPerCycle {
			return Job{}, ErrLimit
		}
	}
	var id string
	if err := tx.QueryRow(ctx, `INSERT INTO jobs (cycle_id, kind, payload) VALUES ($1, $2, $3) RETURNING id::text`,
		cycleID, kind, raw).Scan(&id); err != nil {
		return Job{}, err
	}
	job, err := scanJob(tx.QueryRow(ctx, `SELECT `+jobColumns+jobFrom+`WHERE j.id = $1`, id))
	if err != nil {
		return Job{}, err
	}
	return job, tx.Commit(ctx)
}

func (s *Store) GetJob(ctx context.Context, id string) (Job, error) {
	job, err := scanJob(s.pool.QueryRow(ctx, `SELECT `+jobColumns+jobFrom+`WHERE j.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return Job{}, ErrNotFound
	}
	return job, err
}

func (s *Store) ListJobs(ctx context.Context, cycleID string, limit int) ([]Job, error) {
	var rows pgx.Rows
	var err error
	if cycleID == "" {
		rows, err = s.pool.Query(ctx, `SELECT `+jobColumns+jobFrom+`ORDER BY j.created_at DESC LIMIT $1`, limit)
	} else {
		rows, err = s.pool.Query(ctx, `SELECT `+jobColumns+jobFrom+`WHERE j.cycle_id = $1 ORDER BY j.created_at DESC LIMIT $2`, cycleID, limit)
	}
	if err != nil {
		if isInvalidUUID(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	defer rows.Close()
	jobs := []Job{}
	for rows.Next() {
		job, err := scanJob(rows)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

// CancelJob stops a queued job immediately and asks a running one to stop
// at its next checkpoint.
func (s *Store) CancelJob(ctx context.Context, id string) (Job, error) {
	_, err := s.pool.Exec(ctx, `
		UPDATE jobs SET
			status = CASE WHEN status = 'queued' THEN 'cancelled' ELSE status END,
			cancel_requested = CASE WHEN status IN ('queued', 'running') THEN true ELSE cancel_requested END,
			finished_at = CASE WHEN status = 'queued' THEN now() ELSE finished_at END,
			updated_at = now()
		WHERE id = $1`, id)
	if err != nil {
		if isInvalidUUID(err) {
			return Job{}, ErrNotFound
		}
		return Job{}, err
	}
	return s.GetJob(ctx, id)
}

// UsageTotals sums tokens across all jobs for the control center.
func (s *Store) UsageTotals(ctx context.Context) (map[string]any, error) {
	var prompt, completion, done, failed, running, queued int
	err := s.pool.QueryRow(ctx, `
		SELECT coalesce(sum(prompt_tokens), 0), coalesce(sum(completion_tokens), 0),
			count(*) FILTER (WHERE status = 'done'), count(*) FILTER (WHERE status = 'failed'),
			count(*) FILTER (WHERE status = 'running'), count(*) FILTER (WHERE status = 'queued')
		FROM jobs`).Scan(&prompt, &completion, &done, &failed, &running, &queued)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"promptTokens":     prompt,
		"completionTokens": completion,
		"done":             done,
		"failed":           failed,
		"running":          running,
		"queued":           queued,
	}, nil
}

// Executor runs one job kind. It returns the result that is stored on the
// job, plus usage so the worker can record tokens and the provider used.
type Executor func(ctx context.Context, job Job) (result any, meta JobMeta, err error)

type JobMeta struct {
	ProviderID       string
	Model            string
	Simulated        bool
	PromptTokens     int
	CompletionTokens int
}

// Worker polls the queue. One goroutine per concurrency slot; each claim is
// its own transaction, so a crash leaves the row locked_at and the stale
// sweep requeues it.
type Worker struct {
	store       *Store
	executors   map[string]Executor
	concurrency int
	name        string
	poll        time.Duration
}

func NewWorker(store *Store, concurrency int, executors map[string]Executor) *Worker {
	host, _ := os.Hostname()
	if concurrency < 1 {
		concurrency = 1
	}
	return &Worker{
		store:       store,
		executors:   executors,
		concurrency: concurrency,
		name:        fmt.Sprintf("%s-%d", host, os.Getpid()),
		poll:        time.Second,
	}
}

func (w *Worker) Run(ctx context.Context) {
	if err := w.store.recoverStale(ctx); err != nil {
		log.Printf("worker: recover stale jobs: %v", err)
	}
	var wg sync.WaitGroup
	for i := 0; i < w.concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			w.loop(ctx)
		}()
	}
	sweep := time.NewTicker(30 * time.Second)
	defer sweep.Stop()
	for {
		select {
		case <-ctx.Done():
			wg.Wait()
			return
		case <-sweep.C:
			if err := w.store.recoverStale(ctx); err != nil {
				log.Printf("worker: recover stale jobs: %v", err)
			}
		}
	}
}

func (w *Worker) loop(ctx context.Context) {
	for {
		if ctx.Err() != nil {
			return
		}
		job, ok, err := w.store.claim(ctx, w.name)
		if err != nil {
			log.Printf("worker: claim: %v", err)
		}
		if !ok {
			select {
			case <-ctx.Done():
				return
			case <-time.After(w.poll):
			}
			continue
		}
		w.execute(ctx, job)
	}
}

func (w *Worker) execute(parent context.Context, job Job) {
	exec, ok := w.executors[job.Kind]
	if !ok {
		_ = w.store.finish(parent, job, nil, JobMeta{}, fmt.Errorf("no executor for job kind %q", job.Kind), false)
		return
	}
	timeout := time.Duration(job.TimeoutSeconds) * time.Second
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()
	result, meta, err := exec(ctx, job)
	err = redactJobError(err)
	retry := err != nil && job.Attempts < job.MaxAttempts && !errors.Is(err, errNoRetry)
	if ferr := w.store.finish(parent, job, result, meta, err, retry); ferr != nil {
		log.Printf("worker: finish job %s: %v", job.ID, ferr)
	}
}

// errNoRetry marks failures that will not change on a second attempt, such
// as a missing provider or an invalid model reply the user must look at.
var errNoRetry = errors.New("not retryable")

func noRetry(err error) error { return fmt.Errorf("%w: %w", errNoRetry, err) }

// redactJobError hides credentials in a job error without dropping the
// no-retry mark. Rebuilding the error with errors.New would make a permanent
// failure look temporary, and the worker would run it again.
func redactJobError(err error) error {
	if err == nil {
		return nil
	}
	msg := Redact(err.Error())
	if errors.Is(err, errNoRetry) {
		msg = strings.TrimPrefix(msg, errNoRetry.Error()+": ")
		return fmt.Errorf("%w: %s", errNoRetry, msg)
	}
	return errors.New(msg)
}

func (s *Store) claim(ctx context.Context, by string) (Job, bool, error) {
	job, err := scanJob(s.pool.QueryRow(ctx, `
		WITH next AS (
			SELECT id FROM jobs
			WHERE status = 'queued' AND run_after <= now()
			ORDER BY created_at
			FOR UPDATE SKIP LOCKED
			LIMIT 1
		), claimed AS (
			UPDATE jobs j SET status = 'running', locked_at = now(), locked_by = $1, attempts = j.attempts + 1, updated_at = now()
			FROM next WHERE j.id = next.id
			RETURNING j.*
		)
		SELECT `+jobColumns+` FROM claimed j LEFT JOIN providers p ON p.id = j.provider_id`, by))
	if errors.Is(err, pgx.ErrNoRows) {
		return Job{}, false, nil
	}
	if err != nil {
		return Job{}, false, err
	}
	return job, true, nil
}

func (s *Store) finish(ctx context.Context, job Job, result any, meta JobMeta, runErr error, retry bool) error {
	var raw []byte
	if result != nil {
		var err error
		if raw, err = json.Marshal(result); err != nil {
			return err
		}
	}
	var providerID *string
	if meta.ProviderID != "" {
		providerID = &meta.ProviderID
	}
	// A cancel request that arrived while running wins over the outcome.
	var cancelled bool
	if err := s.pool.QueryRow(ctx, `SELECT cancel_requested FROM jobs WHERE id = $1`, job.ID).Scan(&cancelled); err != nil {
		return err
	}
	status := "done"
	errText := ""
	runAfter := "now()"
	switch {
	case cancelled:
		status = "cancelled"
		errText = "cancelled by user"
	case runErr != nil && retry:
		status = "queued"
		errText = runErr.Error()
		runAfter = fmt.Sprintf("now() + interval '%d seconds'", 5*job.Attempts*job.Attempts)
	case runErr != nil:
		status = "failed"
		errText = runErr.Error()
	}
	finished := "now()"
	if status == "queued" {
		finished = "NULL"
	}
	_, err := s.pool.Exec(ctx, `
		UPDATE jobs SET status = $2, result = $3, error = $4, run_after = `+runAfter+`, locked_at = NULL, locked_by = '',
			provider_id = coalesce($5, provider_id), model = CASE WHEN $6 <> '' THEN $6 ELSE model END,
			simulated = simulated OR $7, prompt_tokens = prompt_tokens + $8, completion_tokens = completion_tokens + $9,
			updated_at = now(), finished_at = `+finished+`
		WHERE id = $1`,
		job.ID, status, raw, errText, providerID, meta.Model, meta.Simulated, meta.PromptTokens, meta.CompletionTokens)
	if err != nil {
		return err
	}
	if status == "failed" || status == "cancelled" {
		_ = s.Record(ctx, job.CycleID, &job.ID, "job."+status, job.Kind+" "+status+": "+errText, nil)
	}
	return nil
}

// recoverStale requeues jobs whose worker disappeared. A job past its
// timeout with no completion is treated as lost, and retried while it has
// attempts left.
func (s *Store) recoverStale(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE jobs SET
			status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
			error = 'worker lost the job before it finished',
			locked_at = NULL, locked_by = '', updated_at = now(),
			finished_at = CASE WHEN attempts >= max_attempts THEN now() ELSE NULL END
		WHERE status = 'running' AND locked_at < now() - (timeout_seconds + 30) * interval '1 second'`)
	return err
}

// Record appends an audit event. Data may be nil.
func (s *Store) Record(ctx context.Context, cycleID, jobID *string, kind, message string, data any) error {
	raw := []byte(`{}`)
	if data != nil {
		var err error
		if raw, err = json.Marshal(data); err != nil {
			return err
		}
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO events (cycle_id, job_id, kind, message, data) VALUES ($1, $2, $3, $4, $5)`,
		cycleID, jobID, kind, Redact(message), raw)
	return err
}

type Event struct {
	ID        int64           `json:"id"`
	CycleID   *string         `json:"cycleId"`
	JobID     *string         `json:"jobId"`
	Kind      string          `json:"kind"`
	Message   string          `json:"message"`
	Data      json.RawMessage `json:"data"`
	CreatedAt time.Time       `json:"createdAt"`
}

func (s *Store) ListEvents(ctx context.Context, cycleID string, limit int) ([]Event, error) {
	var rows pgx.Rows
	var err error
	if cycleID == "" {
		rows, err = s.pool.Query(ctx, `SELECT id, cycle_id::text, job_id::text, kind, message, data, created_at FROM events ORDER BY id DESC LIMIT $1`, limit)
	} else {
		rows, err = s.pool.Query(ctx, `SELECT id, cycle_id::text, job_id::text, kind, message, data, created_at FROM events WHERE cycle_id = $1 ORDER BY id DESC LIMIT $2`, cycleID, limit)
	}
	if err != nil {
		if isInvalidUUID(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	defer rows.Close()
	events := []Event{}
	for rows.Next() {
		var e Event
		var data []byte
		if err := rows.Scan(&e.ID, &e.CycleID, &e.JobID, &e.Kind, &e.Message, &data, &e.CreatedAt); err != nil {
			return nil, err
		}
		e.Data = json.RawMessage(data)
		events = append(events, e)
	}
	return events, rows.Err()
}
