package desk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// Workflow states. The four Loop stages stay the product concept; these
// are the finer execution states underneath, and StageFor maps each one
// onto a stage so the ring highlights the right quarter.
const (
	StatePending            = "PENDING"
	StateAnalyzing          = "ANALYZING"
	StateAwaitingApproval   = "AWAITING_APPROVAL"
	StatePlanning           = "PLANNING"
	StateImplementing       = "IMPLEMENTING"
	StateTesting            = "TESTING"
	StateReviewing          = "REVIEWING"
	StateReadyForDeployment = "READY_FOR_DEPLOYMENT"
	StateDeployed           = "DEPLOYED"
	StateMonitoring         = "MONITORING"
	StateCompleted          = "COMPLETED"
	StateBlocked            = "BLOCKED"
	StateFailed             = "FAILED"
	StateCancelled          = "CANCELLED"
)

// StageFor returns the Loop stage a state belongs to, or "" when the state
// keeps whatever stage the cycle already had (approval, blocked, failed).
func StageFor(state string) string {
	switch state {
	case StatePending, StateAnalyzing:
		return "discover"
	case StatePlanning, StateImplementing, StateReviewing:
		return "deliver"
	case StateTesting, StateReadyForDeployment:
		return "validate"
	case StateDeployed, StateMonitoring, StateCompleted:
		return "rediscover"
	default:
		return ""
	}
}

// allowed lists the transitions the orchestrator may make. Anything else is
// a bug or a stale client, and is refused.
var allowed = map[string][]string{
	StatePending:          {StateAnalyzing, StateCancelled},
	StateAnalyzing:        {StateAwaitingApproval, StateFailed, StatePending, StateCancelled},
	StateAwaitingApproval: {StatePending, StatePlanning, StateImplementing, StateTesting, StateReviewing, StateCompleted, StateMonitoring, StateCancelled},
	StatePlanning:         {StateAwaitingApproval, StateImplementing, StateFailed, StateCancelled},
	StateImplementing:     {StateAwaitingApproval, StateReviewing, StateFailed, StateBlocked, StateCancelled},
	StateReviewing:        {StateTesting, StateImplementing, StateFailed, StateCancelled},
	StateTesting:          {StateReadyForDeployment, StateBlocked, StateFailed, StateCancelled},
	// BLOCKED -> READY_FOR_DEPLOYMENT is only reachable through the recorded
	// human override, and only when no gate actually failed.
	StateBlocked:            {StateImplementing, StateTesting, StateAwaitingApproval, StateReadyForDeployment, StateCancelled},
	StateReadyForDeployment: {StateDeployed, StateTesting, StateCancelled},
	StateDeployed:           {StateMonitoring, StateCancelled},
	StateMonitoring:         {StateAwaitingApproval, StateCompleted, StateCancelled},
	// A failed or cancelled cycle can be analyzed again. The button stays
	// available, so the transition has to be available too.
	StateFailed:    {StatePending, StateAnalyzing, StatePlanning, StateImplementing, StateTesting, StateMonitoring, StateCancelled},
	StateCompleted: {},
	StateCancelled: {StatePending, StateAnalyzing},
}

// ErrTransition is returned for a state change the machine does not allow.
var ErrTransition = errors.New("that step is not allowed from the cycle's current state")

// CanTransition reports whether from -> to is allowed.
func CanTransition(from, to string) bool {
	if from == "" {
		from = StatePending
	}
	for _, next := range allowed[from] {
		if next == to {
			return true
		}
	}
	return false
}

// Transition moves a cycle to a new state, updates its stage when the state
// implies one, and writes an audit event.
func (s *Store) Transition(ctx context.Context, cycleID, to, reason string) (Cycle, error) {
	cycle, err := s.GetCycle(ctx, cycleID)
	if err != nil {
		return Cycle{}, err
	}
	if !CanTransition(cycle.WorkflowState, to) {
		return Cycle{}, fmt.Errorf("%w (%s -> %s)", ErrTransition, cycle.WorkflowState, to)
	}
	stage := StageFor(to)
	if stage == "" {
		stage = cycle.Stage
	}
	cycle, err = scanCycle(s.pool.QueryRow(ctx, `
		UPDATE cycles SET workflow_state = $2, stage = $3, updated_at = now() WHERE id = $1 RETURNING `+cycleReturning,
		cycleID, to, stage))
	if err != nil {
		return Cycle{}, err
	}
	_ = s.Record(ctx, &cycleID, nil, "state."+strings.ToLower(to), reason, map[string]string{"state": to, "stage": stage})
	return cycle, nil
}

// Analysis is the Discover output: hypotheses, gaps, a proposed score, and
// acceptance criteria. Content keeps the model's structured reply.
type Analysis struct {
	ID           string          `json:"id"`
	CycleID      string          `json:"cycleId"`
	JobID        *string         `json:"jobId"`
	Status       string          `json:"status"`
	Content      json.RawMessage `json:"content"`
	ProviderName string          `json:"providerName"`
	Model        string          `json:"model"`
	Simulated    bool            `json:"simulated"`
	CreatedAt    time.Time       `json:"createdAt"`
	DecidedAt    *time.Time      `json:"decidedAt"`
}

// AnalysisContent is the validated shape of a model analysis.
type AnalysisContent struct {
	Summary    string `json:"summary"`
	Hypotheses []struct {
		Cause      string  `json:"cause"`
		Evidence   string  `json:"evidence"`
		Confidence float64 `json:"confidence"`
	} `json:"hypotheses"`
	MissingInformation []string `json:"missingInformation"`
	ProposedScore      int      `json:"proposedScore"`
	ScoreRationale     string   `json:"scoreRationale"`
	Opportunity        struct {
		Title   string `json:"title"`
		Outcome string `json:"outcome"`
	} `json:"opportunity"`
	AcceptanceCriteria []string `json:"acceptanceCriteria"`
}

func (c AnalysisContent) Validate() error {
	switch {
	case strings.TrimSpace(c.Summary) == "":
		return errors.New("analysis has no summary")
	case len(c.Hypotheses) == 0:
		return errors.New("analysis has no hypotheses")
	case c.ProposedScore < 0 || c.ProposedScore > 100:
		return errors.New("analysis score is outside 0 to 100")
	case len(c.AcceptanceCriteria) == 0:
		return errors.New("analysis has no acceptance criteria")
	}
	return nil
}

const analysisColumns = `id::text, cycle_id::text, job_id::text, status, content, provider_name, model, simulated, created_at, decided_at`

func scanAnalysis(row scanner) (Analysis, error) {
	var a Analysis
	var content []byte
	err := row.Scan(&a.ID, &a.CycleID, &a.JobID, &a.Status, &content, &a.ProviderName, &a.Model, &a.Simulated, &a.CreatedAt, &a.DecidedAt)
	a.Content = json.RawMessage(content)
	return a, err
}

func (s *Store) SaveAnalysis(ctx context.Context, cycleID string, jobID *string, content AnalysisContent, provider, model string, simulated bool) (Analysis, error) {
	raw, err := json.Marshal(content)
	if err != nil {
		return Analysis{}, err
	}
	return scanAnalysis(s.pool.QueryRow(ctx, `
		INSERT INTO analyses (cycle_id, job_id, content, provider_name, model, simulated)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING `+analysisColumns,
		cycleID, jobID, raw, provider, model, simulated))
}

func (s *Store) ListAnalyses(ctx context.Context, cycleID string) ([]Analysis, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+analysisColumns+` FROM analyses WHERE cycle_id = $1 ORDER BY created_at DESC`, cycleID)
	if err != nil {
		if isInvalidUUID(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	defer rows.Close()
	out := []Analysis{}
	for rows.Next() {
		a, err := scanAnalysis(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// DecideAnalysis approves or rejects a proposed analysis. Approval applies
// the proposed score and finding to the cycle only when the caller asks,
// so user-entered values are never overwritten silently.
func (s *Store) DecideAnalysis(ctx context.Context, cycleID, analysisID, decision string, applyScore, applyFinding bool) (Analysis, error) {
	if decision != "approve" && decision != "reject" {
		return Analysis{}, fmt.Errorf("%w: decision must be approve or reject", ErrInvalid)
	}
	status := "approved"
	if decision == "reject" {
		status = "rejected"
	}
	a, err := scanAnalysis(s.pool.QueryRow(ctx, `
		UPDATE analyses SET status = $3, decided_at = now()
		WHERE id = $2 AND cycle_id = $1 AND status = 'proposed' RETURNING `+analysisColumns,
		cycleID, analysisID, status))
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return Analysis{}, ErrNotFound
	}
	if err != nil {
		return Analysis{}, err
	}
	if status == "approved" {
		var content AnalysisContent
		_ = json.Unmarshal(a.Content, &content)
		if applyScore {
			_, _ = s.pool.Exec(ctx, `UPDATE cycles SET score = $2, updated_at = now() WHERE id = $1`, cycleID, content.ProposedScore)
		}
		if applyFinding && len(content.Hypotheses) > 0 {
			finding := "Hypothesis: " + content.Hypotheses[0].Cause
			if len([]rune(finding)) > 280 {
				finding = string([]rune(finding)[:277]) + "…"
			}
			_, _ = s.pool.Exec(ctx, `UPDATE cycles SET finding = $2, updated_at = now() WHERE id = $1`, cycleID, finding)
		}
		if _, err := s.Transition(ctx, cycleID, StatePlanning, "analysis approved"); err != nil {
			return a, err
		}
	} else {
		if _, err := s.Transition(ctx, cycleID, StatePending, "analysis rejected"); err != nil {
			return a, err
		}
	}
	_ = s.Record(ctx, &cycleID, nil, "analysis."+status, "analysis "+status, map[string]any{"analysisId": a.ID, "applyScore": applyScore, "applyFinding": applyFinding})
	return a, nil
}

// Artifact is a versioned, reviewable document: SPEC, PLAN, a proposed
// patch, a validation run, or a Rediscover outcome.
type Artifact struct {
	ID           string          `json:"id"`
	CycleID      string          `json:"cycleId"`
	JobID        *string         `json:"jobId"`
	Kind         string          `json:"kind"`
	Version      int             `json:"version"`
	Status       string          `json:"status"`
	Content      string          `json:"content"`
	Data         json.RawMessage `json:"data"`
	Note         string          `json:"note"`
	ProviderName string          `json:"providerName"`
	Model        string          `json:"model"`
	Simulated    bool            `json:"simulated"`
	CreatedAt    time.Time       `json:"createdAt"`
	DecidedAt    *time.Time      `json:"decidedAt"`
}

const artifactColumns = `id::text, cycle_id::text, job_id::text, kind, version, status, content, data, note, provider_name, model, simulated, created_at, decided_at`

func scanArtifact(row scanner) (Artifact, error) {
	var a Artifact
	var data []byte
	err := row.Scan(&a.ID, &a.CycleID, &a.JobID, &a.Kind, &a.Version, &a.Status, &a.Content, &data, &a.Note, &a.ProviderName, &a.Model, &a.Simulated, &a.CreatedAt, &a.DecidedAt)
	a.Data = json.RawMessage(data)
	return a, err
}

// SaveArtifact stores the next version of a kind. Earlier proposed versions
// of the same kind are marked superseded.
func (s *Store) SaveArtifact(ctx context.Context, cycleID string, jobID *string, kind, status, content string, data any, note, provider, model string, simulated bool) (Artifact, error) {
	raw, err := json.Marshal(data)
	if err != nil {
		return Artifact{}, err
	}
	if data == nil {
		raw = []byte(`{}`)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Artifact{}, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE artifacts SET status = 'superseded' WHERE cycle_id = $1 AND kind = $2 AND status = 'proposed'`, cycleID, kind); err != nil {
		return Artifact{}, err
	}
	a, err := scanArtifact(tx.QueryRow(ctx, `
		INSERT INTO artifacts (cycle_id, job_id, kind, version, status, content, data, note, provider_name, model, simulated)
		VALUES ($1, $2, $3, (SELECT coalesce(max(version), 0) + 1 FROM artifacts WHERE cycle_id = $1 AND kind = $3), $4, $5, $6, $7, $8, $9, $10)
		RETURNING `+artifactColumns,
		cycleID, jobID, kind, status, content, raw, note, provider, model, simulated))
	if err != nil {
		return Artifact{}, err
	}
	return a, tx.Commit(ctx)
}

func (s *Store) ListArtifacts(ctx context.Context, cycleID string) ([]Artifact, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+artifactColumns+` FROM artifacts WHERE cycle_id = $1 ORDER BY created_at DESC`, cycleID)
	if err != nil {
		if isInvalidUUID(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	defer rows.Close()
	out := []Artifact{}
	for rows.Next() {
		a, err := scanArtifact(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *Store) GetArtifact(ctx context.Context, cycleID, id string) (Artifact, error) {
	a, err := scanArtifact(s.pool.QueryRow(ctx, `SELECT `+artifactColumns+` FROM artifacts WHERE cycle_id = $1 AND id = $2`, cycleID, id))
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return Artifact{}, ErrNotFound
	}
	return a, err
}

// LatestApproved returns the newest approved artifact of a kind.
func (s *Store) LatestApproved(ctx context.Context, cycleID, kind string) (Artifact, bool, error) {
	a, err := scanArtifact(s.pool.QueryRow(ctx, `
		SELECT `+artifactColumns+` FROM artifacts WHERE cycle_id = $1 AND kind = $2 AND status = 'approved'
		ORDER BY version DESC LIMIT 1`, cycleID, kind))
	if errors.Is(err, pgx.ErrNoRows) {
		return Artifact{}, false, nil
	}
	return a, err == nil, err
}

// EditArtifact lets a person change a proposed artifact's text before
// deciding on it. The edit is recorded.
func (s *Store) EditArtifact(ctx context.Context, cycleID, id, content string) (Artifact, error) {
	if len(content) > 200_000 {
		return Artifact{}, fmt.Errorf("%w: the artifact is too large", ErrInvalid)
	}
	a, err := scanArtifact(s.pool.QueryRow(ctx, `
		UPDATE artifacts SET content = $3, note = CASE WHEN note = '' THEN 'edited by reviewer' ELSE note END
		WHERE cycle_id = $1 AND id = $2 AND status = 'proposed' RETURNING `+artifactColumns, cycleID, id, content))
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return Artifact{}, ErrNotFound
	}
	if err == nil {
		_ = s.Record(ctx, &cycleID, nil, "artifact.edited", a.Kind+" v"+fmt.Sprint(a.Version)+" edited", map[string]string{"artifactId": a.ID})
	}
	return a, err
}

// DecideArtifact approves or rejects a proposed artifact and advances the
// workflow accordingly.
func (s *Store) DecideArtifact(ctx context.Context, cycleID, id, decision string) (Artifact, string, error) {
	if decision != "approve" && decision != "reject" {
		return Artifact{}, "", fmt.Errorf("%w: decision must be approve or reject", ErrInvalid)
	}
	status := "approved"
	if decision == "reject" {
		status = "rejected"
	}
	a, err := scanArtifact(s.pool.QueryRow(ctx, `
		UPDATE artifacts SET status = $3, decided_at = now()
		WHERE cycle_id = $1 AND id = $2 AND status = 'proposed' RETURNING `+artifactColumns, cycleID, id, status))
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return Artifact{}, "", ErrNotFound
	}
	if err != nil {
		return Artifact{}, "", err
	}
	_ = s.Record(ctx, &cycleID, nil, "artifact."+status, a.Kind+" v"+fmt.Sprint(a.Version)+" "+status, map[string]string{"artifactId": a.ID})

	next := ""
	switch {
	case status == "rejected":
		switch a.Kind {
		case "specification", "plan":
			next = StatePlanning
		case "patch":
			next = StateImplementing
		case "outcome":
			next = StateMonitoring
		}
	case a.Kind == "specification":
		next = StatePlanning
	case a.Kind == "plan":
		next = StateImplementing
	case a.Kind == "patch":
		next = StateTesting
	case a.Kind == "outcome":
		next = StateCompleted
	}
	if next != "" {
		if _, err := s.Transition(ctx, cycleID, next, a.Kind+" "+status); err != nil && !errors.Is(err, ErrTransition) {
			return a, "", err
		}
	}
	return a, next, nil
}

// Knowledge entries are verified lessons that future agent prompts can read.
type KnowledgeEntry struct {
	ID        string    `json:"id"`
	CycleID   *string   `json:"cycleId"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Tags      []string  `json:"tags"`
	CreatedAt time.Time `json:"createdAt"`
}

func (s *Store) AddKnowledge(ctx context.Context, cycleID *string, title, body string, tags []string) (KnowledgeEntry, error) {
	if tags == nil {
		tags = []string{}
	}
	var e KnowledgeEntry
	err := s.pool.QueryRow(ctx, `
		INSERT INTO knowledge_entries (cycle_id, title, body, tags) VALUES ($1, $2, $3, $4)
		RETURNING id::text, cycle_id::text, title, body, tags, created_at`, cycleID, title, body, tags).
		Scan(&e.ID, &e.CycleID, &e.Title, &e.Body, &e.Tags, &e.CreatedAt)
	return e, err
}

func (s *Store) SearchKnowledge(ctx context.Context, query string, limit int) ([]KnowledgeEntry, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, cycle_id::text, title, body, tags, created_at FROM knowledge_entries
		WHERE $1 = '' OR title ILIKE '%' || $1 || '%' OR body ILIKE '%' || $1 || '%'
		ORDER BY created_at DESC LIMIT $2`, strings.TrimSpace(query), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []KnowledgeEntry{}
	for rows.Next() {
		var e KnowledgeEntry
		if err := rows.Scan(&e.ID, &e.CycleID, &e.Title, &e.Body, &e.Tags, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// ProposeFollowUp creates a new Discover cycle from a Rediscover outcome,
// with deduplication and a per-origin limit so one outcome cannot fan out.
func (s *Store) ProposeFollowUp(ctx context.Context, originID, title, signal string, score int) (Cycle, bool, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return Cycle{}, false, nil
	}
	var existing, fromOrigin int
	if err := s.pool.QueryRow(ctx, `
		SELECT count(*) FILTER (WHERE lower(title) = lower($2) AND workflow_state NOT IN ('COMPLETED', 'CANCELLED')),
			count(*) FILTER (WHERE origin_cycle_id = $1)
		FROM cycles`, originID, title).Scan(&existing, &fromOrigin); err != nil {
		return Cycle{}, false, err
	}
	if existing > 0 || fromOrigin >= 1 {
		return Cycle{}, false, nil
	}
	if len([]rune(title)) > 80 {
		title = string([]rune(title)[:80])
	}
	if len([]rune(signal)) > 280 {
		signal = string([]rune(signal)[:280])
	}
	cycle, err := scanCycle(s.pool.QueryRow(ctx, `
		INSERT INTO cycles (title, stage, signal_kind, signal, score, origin_cycle_id)
		VALUES ($1, 'discover', 'feedback', $2, $3, $4) RETURNING `+cycleReturning, title, signal, score, originID))
	if err != nil {
		return Cycle{}, false, err
	}
	_ = s.Record(ctx, &cycle.ID, nil, "cycle.proposed", "proposed from cycle "+originID, map[string]string{"origin": originID})
	return cycle, true, nil
}
