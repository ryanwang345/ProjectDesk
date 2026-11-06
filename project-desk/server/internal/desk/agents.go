package desk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"projectdesk/internal/ai"
)

// Platform wires the store, the secret sealer, the repository root, and the
// sandbox runner into the job executors. One instance is shared by the HTTP
// handler and the worker.
type Platform struct {
	Store  *Store
	Sealer *Sealer
	// ReposRoot holds the repositories agents may work on, one directory
	// each. Cycles name a repo by directory name only.
	ReposRoot string
	Runner    Runner
	// MaxJobsPerCycle caps the AI calls a single cycle may make.
	MaxJobsPerCycle int
	// MaxRepairs caps automatic repair proposals per cycle.
	MaxRepairs int
	// TestTimeout bounds one sandbox test run.
	TestTimeout time.Duration
	// AdminToken, when set, is required for provider and agent changes.
	AdminToken string
}

// Executors returns the job executors keyed by job kind.
func (p *Platform) Executors() map[string]Executor {
	return map[string]Executor{
		"analyze":       p.wrap(p.runAnalyze),
		"specification": p.wrap(p.runSpecification),
		"plan":          p.wrap(p.runPlan),
		"patch":         p.wrap(p.runPatch),
		"validate":      p.wrap(p.runValidate),
		"outcome":       p.wrap(p.runOutcome),
	}
}

type step func(ctx context.Context, job Job, cycle Cycle) (any, JobMeta, error)

// wrap loads the cycle, checks for cancellation, and on a final failure
// moves the cycle to FAILED with the reason in the audit trail.
func (p *Platform) wrap(fn step) Executor {
	return func(ctx context.Context, job Job) (any, JobMeta, error) {
		if job.CycleID == nil {
			return nil, JobMeta{}, noRetry(errors.New("job has no cycle"))
		}
		cycle, err := p.Store.GetCycle(ctx, *job.CycleID)
		if err != nil {
			return nil, JobMeta{}, noRetry(err)
		}
		_ = p.Store.Record(ctx, job.CycleID, &job.ID, "job.started", job.Kind+" started (attempt "+fmt.Sprint(job.Attempts)+")", nil)
		result, meta, err := fn(ctx, job, cycle)
		if err != nil {
			final := errors.Is(err, errNoRetry) || job.Attempts >= job.MaxAttempts
			if final && !errors.Is(err, context.Canceled) {
				if _, terr := p.Store.Transition(ctx, cycle.ID, StateFailed, job.Kind+" failed: "+Redact(err.Error())); terr != nil && !errors.Is(terr, ErrTransition) {
					return result, meta, fmt.Errorf("%v (and could not mark the cycle failed: %v)", err, terr)
				}
			}
			return result, meta, err
		}
		_ = p.Store.Record(ctx, job.CycleID, &job.ID, "job.done", job.Kind+" finished", map[string]any{"provider": meta.Model, "simulated": meta.Simulated})
		return result, meta, nil
	}
}

// ask resolves the provider for the job's role and requests a JSON reply.
func (p *Platform) ask(ctx context.Context, kind string, messages []ai.Message, out any) (JobMeta, ProviderRecord, error) {
	role := jobRole[kind]
	provider, rec, err := p.Store.ProviderForRole(ctx, role, p.Sealer)
	if err != nil {
		return JobMeta{}, rec, noRetry(err)
	}
	resp, err := ai.GenerateJSON(ctx, provider, ai.Request{Messages: messages, JSON: true, MaxTokens: 4000, Temperature: 0.2}, out)
	meta := JobMeta{ProviderID: rec.ID, Model: resp.Model, Simulated: resp.Simulated, PromptTokens: resp.Usage.PromptTokens, CompletionTokens: resp.Usage.CompletionTokens}
	if meta.Model == "" {
		meta.Model = rec.Model
	}
	if err != nil {
		var perr *ai.ErrProvider
		if errors.As(err, &perr) && perr.Status >= 400 && perr.Status < 500 && perr.Status != 429 {
			return meta, rec, noRetry(fmt.Errorf("%s rejected the request: %w", rec.Name, err))
		}
		return meta, rec, fmt.Errorf("%s: %w", rec.Name, err)
	}
	return meta, rec, nil
}

// ---- Discover -------------------------------------------------------------

func (p *Platform) runAnalyze(ctx context.Context, job Job, cycle Cycle) (any, JobMeta, error) {
	if cycle.WorkflowState != StateAnalyzing {
		if _, err := p.Store.Transition(ctx, cycle.ID, StateAnalyzing, "analysis requested"); err != nil {
			return nil, JobMeta{}, noRetry(err)
		}
	}
	knowledge := p.knowledgeContext(ctx, cycle)
	var content AnalysisContent
	meta, rec, err := p.ask(ctx, job.Kind, analyzePrompt(cycle, knowledge), &content)
	if err != nil {
		return nil, meta, err
	}
	if err := content.Validate(); err != nil {
		return nil, meta, fmt.Errorf("the model reply was incomplete: %w", err)
	}
	analysis, err := p.Store.SaveAnalysis(ctx, cycle.ID, &job.ID, content, rec.Name, meta.Model, meta.Simulated)
	if err != nil {
		return nil, meta, err
	}
	if _, err := p.Store.Transition(ctx, cycle.ID, StateAwaitingApproval, "analysis proposed"); err != nil {
		return nil, meta, noRetry(err)
	}
	return map[string]any{"analysisId": analysis.ID}, meta, nil
}

// ---- Deliver --------------------------------------------------------------

type SpecContent struct {
	Problem                   string   `json:"problem"`
	Solution                  string   `json:"solution"`
	FunctionalRequirements    []string `json:"functionalRequirements"`
	NonFunctionalRequirements []string `json:"nonFunctionalRequirements"`
	AcceptanceCriteria        []string `json:"acceptanceCriteria"`
	Risks                     []string `json:"risks"`
	AffectedComponents        []string `json:"affectedComponents"`
}

func (c SpecContent) Validate() error {
	if strings.TrimSpace(c.Problem) == "" || strings.TrimSpace(c.Solution) == "" {
		return errors.New("specification needs a problem and a solution")
	}
	if len(c.AcceptanceCriteria) == 0 {
		return errors.New("specification has no acceptance criteria")
	}
	return nil
}

func (c SpecContent) Markdown() string {
	var b strings.Builder
	b.WriteString("# Specification\n\n## Problem\n" + c.Problem + "\n\n## Proposed solution\n" + c.Solution + "\n")
	section(&b, "Functional requirements", c.FunctionalRequirements)
	section(&b, "Non-functional requirements", c.NonFunctionalRequirements)
	section(&b, "Acceptance criteria", c.AcceptanceCriteria)
	section(&b, "Risks", c.Risks)
	section(&b, "Affected components", c.AffectedComponents)
	return b.String()
}

type PlanContent struct {
	Approach        string   `json:"approach"`
	AffectedFiles   []string `json:"affectedFiles"`
	Changes         []string `json:"changes"`
	Dependencies    []string `json:"dependencies"`
	TestingStrategy string   `json:"testingStrategy"`
	Deployment      string   `json:"deployment"`
	Tasks           []struct {
		Title  string `json:"title"`
		Detail string `json:"detail"`
	} `json:"tasks"`
}

func (c PlanContent) Validate() error {
	if strings.TrimSpace(c.Approach) == "" {
		return errors.New("plan has no approach")
	}
	if len(c.Tasks) == 0 {
		return errors.New("plan has no tasks")
	}
	return nil
}

func (c PlanContent) Markdown() string {
	var b strings.Builder
	b.WriteString("# Implementation plan\n\n## Approach\n" + c.Approach + "\n")
	section(&b, "Affected files", c.AffectedFiles)
	section(&b, "Changes", c.Changes)
	section(&b, "Dependencies", c.Dependencies)
	if c.TestingStrategy != "" {
		b.WriteString("\n## Testing strategy\n" + c.TestingStrategy + "\n")
	}
	if c.Deployment != "" {
		b.WriteString("\n## Deployment\n" + c.Deployment + "\n")
	}
	b.WriteString("\n## Tasks\n")
	for i, t := range c.Tasks {
		fmt.Fprintf(&b, "%d. **%s** — %s\n", i+1, t.Title, t.Detail)
	}
	return b.String()
}

func section(b *strings.Builder, title string, items []string) {
	if len(items) == 0 {
		return
	}
	b.WriteString("\n## " + title + "\n")
	for _, item := range items {
		b.WriteString("- " + item + "\n")
	}
}

func (p *Platform) runSpecification(ctx context.Context, job Job, cycle Cycle) (any, JobMeta, error) {
	analysis, ok := p.latestAnalysis(ctx, cycle.ID, "approved")
	if !ok {
		return nil, JobMeta{}, noRetry(fmt.Errorf("%w: approve an analysis before generating a specification", ErrInvalid))
	}
	var content SpecContent
	meta, rec, err := p.ask(ctx, job.Kind, specificationPrompt(cycle, analysis), &content)
	if err != nil {
		return nil, meta, err
	}
	if err := content.Validate(); err != nil {
		return nil, meta, fmt.Errorf("the model reply was incomplete: %w", err)
	}
	art, err := p.Store.SaveArtifact(ctx, cycle.ID, &job.ID, "specification", "proposed", content.Markdown(), content, "", rec.Name, meta.Model, meta.Simulated)
	if err != nil {
		return nil, meta, err
	}
	if _, err := p.Store.Transition(ctx, cycle.ID, StateAwaitingApproval, "specification proposed"); err != nil {
		return nil, meta, noRetry(err)
	}
	return map[string]any{"artifactId": art.ID, "version": art.Version}, meta, nil
}

func (p *Platform) runPlan(ctx context.Context, job Job, cycle Cycle) (any, JobMeta, error) {
	spec, ok, err := p.Store.LatestApproved(ctx, cycle.ID, "specification")
	if err != nil {
		return nil, JobMeta{}, err
	}
	if !ok {
		return nil, JobMeta{}, noRetry(fmt.Errorf("%w: approve a specification before generating a plan", ErrInvalid))
	}
	snapshot := ""
	if cycle.Repo != "" && p.ReposRoot != "" {
		if ws, err := NewWorkspace(ctx, p.ReposRoot, cycle.Repo); err == nil {
			snapshot = ws.Snapshot(24_000)
			ws.Close()
		}
	}
	var content PlanContent
	meta, rec, err := p.ask(ctx, job.Kind, planPrompt(cycle, spec, snapshot), &content)
	if err != nil {
		return nil, meta, err
	}
	if err := content.Validate(); err != nil {
		return nil, meta, fmt.Errorf("the model reply was incomplete: %w", err)
	}
	art, err := p.Store.SaveArtifact(ctx, cycle.ID, &job.ID, "plan", "proposed", content.Markdown(), content, "", rec.Name, meta.Model, meta.Simulated)
	if err != nil {
		return nil, meta, err
	}
	if _, err := p.Store.Transition(ctx, cycle.ID, StateAwaitingApproval, "plan proposed"); err != nil {
		return nil, meta, noRetry(err)
	}
	return map[string]any{"artifactId": art.ID, "version": art.Version}, meta, nil
}

type PatchContent struct {
	Summary string `json:"summary"`
	Diff    string `json:"diff"`
}

type patchData struct {
	Summary string   `json:"summary"`
	Files   []string `json:"files"`
	Repo    string   `json:"repo"`
	Repair  bool     `json:"repair,omitempty"`
	Reason  string   `json:"reason,omitempty"`
}

func (p *Platform) runPatch(ctx context.Context, job Job, cycle Cycle) (any, JobMeta, error) {
	plan, ok, err := p.Store.LatestApproved(ctx, cycle.ID, "plan")
	if err != nil {
		return nil, JobMeta{}, err
	}
	if !ok {
		return nil, JobMeta{}, noRetry(fmt.Errorf("%w: approve a plan before generating a patch", ErrInvalid))
	}
	if cycle.Repo == "" {
		return nil, JobMeta{}, noRetry(fmt.Errorf("%w: choose a repository on the cycle before generating a patch", ErrInvalid))
	}
	ws, err := NewWorkspace(ctx, p.ReposRoot, cycle.Repo)
	if err != nil {
		return nil, JobMeta{}, err
	}
	defer ws.Close()

	var content PatchContent
	meta, rec, err := p.ask(ctx, job.Kind, patchPrompt(cycle, plan, ws.Snapshot(40_000)), &content)
	if err != nil {
		return nil, meta, err
	}
	check, err := ws.CheckPatch(ctx, content.Diff)
	if err != nil {
		return nil, meta, err
	}
	if !check.Applies {
		return map[string]any{"check": check}, meta, noRetry(fmt.Errorf("the proposed diff does not apply to %s: %s", cycle.Repo, check.Error))
	}
	if hits := TestsWeakened(check.Normalized); len(hits) > 0 {
		return map[string]any{"weakened": hits}, meta, noRetry(fmt.Errorf("the proposed diff removes test assertions, which is not allowed: %s", strings.Join(hits, "; ")))
	}
	art, err := p.Store.SaveArtifact(ctx, cycle.ID, &job.ID, "patch", "proposed", check.Normalized,
		patchData{Summary: content.Summary, Files: check.Files, Repo: cycle.Repo}, "", rec.Name, meta.Model, meta.Simulated)
	if err != nil {
		return nil, meta, err
	}
	if _, err := p.Store.Transition(ctx, cycle.ID, StateAwaitingApproval, "patch proposed"); err != nil {
		return nil, meta, noRetry(err)
	}
	return map[string]any{"artifactId": art.ID, "version": art.Version, "files": check.Files}, meta, nil
}

// ---- Validate -------------------------------------------------------------

// Gate is one validation check. Status is pass, fail, or not_run; a
// validation only passes when every gate passes.
type Gate struct {
	Name    string  `json:"name"`
	Status  string  `json:"status"`
	Detail  string  `json:"detail"`
	Seconds float64 `json:"seconds,omitempty"`
}

type ValidationData struct {
	PatchID   string         `json:"patchId"`
	PatchVer  int            `json:"patchVersion"`
	Gates     []Gate         `json:"gates"`
	Passed    bool           `json:"passed"`
	Runner    string         `json:"runner"`
	Output    string         `json:"output,omitempty"`
	Analysis  *RepairContent `json:"analysis,omitempty"`
	RepairID  string         `json:"repairArtifactId,omitempty"`
	Repairs   int            `json:"repairsUsed"`
	MaxRepair int            `json:"maxRepairs"`
}

type RepairContent struct {
	Category    string `json:"category"`
	Explanation string `json:"explanation"`
	RepairDiff  string `json:"repairDiff"`
}

func (p *Platform) runValidate(ctx context.Context, job Job, cycle Cycle) (any, JobMeta, error) {
	patch, ok, err := p.Store.LatestApproved(ctx, cycle.ID, "patch")
	if err != nil {
		return nil, JobMeta{}, err
	}
	if !ok {
		return nil, JobMeta{}, noRetry(fmt.Errorf("%w: approve a patch before validating", ErrInvalid))
	}
	if cycle.WorkflowState != StateTesting {
		if _, err := p.Store.Transition(ctx, cycle.ID, StateTesting, "validation started"); err != nil {
			return nil, JobMeta{}, noRetry(err)
		}
	}
	ws, err := NewWorkspace(ctx, p.ReposRoot, cycle.Repo)
	if err != nil {
		return nil, JobMeta{}, err
	}
	defer ws.Close()

	data := ValidationData{PatchID: patch.ID, PatchVer: patch.Version, MaxRepair: p.MaxRepairs, Runner: "none"}
	if p.Runner != nil {
		data.Runner = p.Runner.Name()
	}
	data.Repairs = p.repairCount(ctx, cycle.ID)

	// Gate 1: the approved patch applies cleanly to the current repository.
	check, err := ws.CheckPatch(ctx, patch.Content)
	if err != nil {
		return nil, JobMeta{}, err
	}
	if check.Applies {
		data.Gates = append(data.Gates, Gate{Name: "patch applies", Status: "pass", Detail: strings.Join(check.Files, ", ")})
	} else {
		data.Gates = append(data.Gates, Gate{Name: "patch applies", Status: "fail", Detail: check.Error})
	}

	// Gate 2: no test assertions were removed.
	if hits := TestsWeakened(patch.Content); len(hits) > 0 {
		data.Gates = append(data.Gates, Gate{Name: "tests not weakened", Status: "fail", Detail: strings.Join(hits, "; ")})
	} else {
		data.Gates = append(data.Gates, Gate{Name: "tests not weakened", Status: "pass", Detail: "no assertions removed from test files"})
	}

	// Gate 3: the repository's test command, inside the sandbox runner.
	manifest, hasManifest := ws.Manifest()
	testOutput := ""
	switch {
	case !check.Applies:
		data.Gates = append(data.Gates, Gate{Name: "tests", Status: "not_run", Detail: "skipped because the patch does not apply"})
	case !hasManifest || len(manifest.Test.Command) == 0:
		data.Gates = append(data.Gates, Gate{Name: "tests", Status: "not_run", Detail: "the repository has no .projectdesk.json test command"})
	case p.Runner == nil || !p.Runner.Available():
		data.Gates = append(data.Gates, Gate{Name: "tests", Status: "not_run", Detail: "no sandbox runner is available on this API host (Docker is required)"})
	default:
		res, runErr := p.Runner.Run(ctx, ws, manifest.Test.Image, manifest.Test.Command, p.TestTimeout)
		testOutput = Redact(res.Output)
		switch {
		case runErr != nil && res.ExitCode == 0:
			data.Gates = append(data.Gates, Gate{Name: "tests", Status: "fail", Detail: "runner error: " + Redact(runErr.Error()), Seconds: res.Seconds})
		case res.ExitCode != 0:
			data.Gates = append(data.Gates, Gate{Name: "tests", Status: "fail", Detail: fmt.Sprintf("%s exited with %d", strings.Join(manifest.Test.Command, " "), res.ExitCode), Seconds: res.Seconds})
		default:
			data.Gates = append(data.Gates, Gate{Name: "tests", Status: "pass", Detail: strings.Join(manifest.Test.Command, " "), Seconds: res.Seconds})
		}
	}
	data.Output = truncate(testOutput, 16_000)

	data.Passed = true
	failed := false
	for _, g := range data.Gates {
		if g.Status != "pass" {
			data.Passed = false
		}
		if g.Status == "fail" {
			failed = true
		}
	}

	meta := JobMeta{}
	status := "passed"
	next := StateReadyForDeployment
	reason := "all gates passed"
	if !data.Passed {
		status = "blocked"
		next = StateBlocked
		reason = "validation did not pass"
		if failed {
			status = "failed"
		}
	}

	// On a real failure, ask the QA role to explain it and, within budget,
	// propose a repair. The repair is a new patch version that still needs
	// a human approval; nothing is applied automatically.
	if failed {
		var analysis RepairContent
		m, rec, askErr := p.ask(ctx, job.Kind, repairPrompt(cycle, patch, data, ws.Snapshot(24_000)), &analysis)
		meta = m
		if askErr != nil {
			analysis = RepairContent{Category: "unknown", Explanation: "The QA agent could not analyze the failure: " + Redact(askErr.Error())}
		}
		analysis.RepairDiff = strings.TrimSpace(analysis.RepairDiff)
		data.Analysis = &analysis
		if analysis.RepairDiff != "" && data.Repairs < p.MaxRepairs && check.Applies {
			rcheck, rerr := ws.CheckPatch(ctx, analysis.RepairDiff)
			switch {
			case rerr != nil:
				analysis.Explanation += " Repair could not be checked: " + rerr.Error()
			case !rcheck.Applies:
				analysis.Explanation += " The proposed repair does not apply: " + rcheck.Error
			case len(TestsWeakened(rcheck.Normalized)) > 0:
				analysis.Explanation += " The proposed repair removed test assertions and was discarded."
			default:
				// The combined diff (original patch + repair) becomes the next patch version.
				combined, derr := ws.git(ctx, "diff", "--cached")
				if derr == nil {
					art, serr := p.Store.SaveArtifact(ctx, cycle.ID, &job.ID, "patch", "proposed", combined,
						patchData{Summary: "Repair " + fmt.Sprint(data.Repairs+1) + ": " + analysis.Explanation, Files: rcheck.Files, Repo: cycle.Repo, Repair: true, Reason: analysis.Category},
						"automatic repair proposal", rec.Name, m.Model, m.Simulated)
					if serr == nil {
						data.RepairID = art.ID
						data.Repairs++
					}
				}
			}
		} else if analysis.RepairDiff != "" && data.Repairs >= p.MaxRepairs {
			analysis.Explanation += fmt.Sprintf(" Repair limit of %d reached; a person must take over.", p.MaxRepairs)
			analysis.RepairDiff = ""
		}
	}

	art, err := p.Store.SaveArtifact(ctx, cycle.ID, &job.ID, "validation", status, renderValidation(data), data, "", "", "", meta.Simulated)
	if err != nil {
		return nil, meta, err
	}
	if _, err := p.Store.Transition(ctx, cycle.ID, next, reason); err != nil && !errors.Is(err, ErrTransition) {
		return nil, meta, err
	}
	if data.RepairID != "" {
		_ = p.Store.Record(ctx, &cycle.ID, &job.ID, "repair.proposed", "a repair patch was proposed and awaits approval", map[string]string{"artifactId": data.RepairID})
	}
	return map[string]any{"artifactId": art.ID, "passed": data.Passed, "gates": data.Gates}, meta, nil
}

func renderValidation(d ValidationData) string {
	var b strings.Builder
	b.WriteString("# Validation\n\n")
	fmt.Fprintf(&b, "Patch v%d · runner: %s\n\n", d.PatchVer, d.Runner)
	for _, g := range d.Gates {
		fmt.Fprintf(&b, "- %s — **%s** %s\n", g.Name, g.Status, g.Detail)
	}
	if d.Analysis != nil {
		fmt.Fprintf(&b, "\n## Failure analysis\n%s (%s)\n", d.Analysis.Explanation, d.Analysis.Category)
	}
	if d.Output != "" {
		b.WriteString("\n## Test output\n```\n" + d.Output + "\n```\n")
	}
	return b.String()
}

func (p *Platform) repairCount(ctx context.Context, cycleID string) int {
	var n int
	_ = p.Store.pool.QueryRow(ctx, `SELECT count(*) FROM artifacts WHERE cycle_id = $1 AND kind = 'patch' AND note = 'automatic repair proposal'`, cycleID).Scan(&n)
	return n
}

// ---- Rediscover -----------------------------------------------------------

type OutcomeContent struct {
	Solved      string   `json:"solved"`
	Regressions string   `json:"regressions"`
	Evidence    []string `json:"evidence"`
	Lessons     []string `json:"lessons"`
	FollowUp    struct {
		Needed   bool   `json:"needed"`
		Title    string `json:"title"`
		Signal   string `json:"signal"`
		Priority int    `json:"priority"`
	} `json:"followUp"`
}

func (c OutcomeContent) Markdown() string {
	var b strings.Builder
	fmt.Fprintf(&b, "# Outcome\n\nSolved: **%s** · Regressions: **%s**\n", c.Solved, c.Regressions)
	section(&b, "Evidence", c.Evidence)
	section(&b, "Lessons", c.Lessons)
	if c.FollowUp.Needed {
		fmt.Fprintf(&b, "\n## Proposed follow-up\n**%s** (priority %d)\n%s\n", c.FollowUp.Title, c.FollowUp.Priority, c.FollowUp.Signal)
	}
	return b.String()
}

func (p *Platform) runOutcome(ctx context.Context, job Job, cycle Cycle) (any, JobMeta, error) {
	analysis, _ := p.latestAnalysis(ctx, cycle.ID, "approved")
	validation, _, _ := p.Store.LatestApproved(ctx, cycle.ID, "validation")
	if validation.ID == "" {
		arts, _ := p.Store.ListArtifacts(ctx, cycle.ID)
		for _, a := range arts {
			if a.Kind == "validation" {
				validation = a
				break
			}
		}
	}
	var content OutcomeContent
	meta, rec, err := p.ask(ctx, job.Kind, outcomePrompt(cycle, analysis, validation), &content)
	if err != nil {
		return nil, meta, err
	}
	if len(content.Lessons) == 0 {
		return nil, meta, errors.New("the model reply was incomplete: no lessons")
	}
	art, err := p.Store.SaveArtifact(ctx, cycle.ID, &job.ID, "outcome", "proposed", content.Markdown(), content, "", rec.Name, meta.Model, meta.Simulated)
	if err != nil {
		return nil, meta, err
	}
	if _, err := p.Store.Transition(ctx, cycle.ID, StateAwaitingApproval, "outcome proposed"); err != nil {
		return nil, meta, noRetry(err)
	}
	return map[string]any{"artifactId": art.ID, "version": art.Version}, meta, nil
}

// CompleteOutcome runs after a person approves an outcome: lessons go to the
// knowledge base and, when proposed, a deduplicated follow-up cycle opens.
func (p *Platform) CompleteOutcome(ctx context.Context, cycle Cycle, art Artifact) (map[string]any, error) {
	var content OutcomeContent
	if err := json.Unmarshal(art.Data, &content); err != nil {
		return nil, err
	}
	result := map[string]any{"knowledge": 0, "followUp": nil}
	for _, lesson := range content.Lessons {
		lesson = strings.TrimSpace(lesson)
		if lesson == "" {
			continue
		}
		title := lesson
		if len([]rune(title)) > 80 {
			title = string([]rune(title)[:77]) + "…"
		}
		tags := []string{cycle.SignalKind, cycle.Stage}
		if art.Simulated {
			tags = append(tags, "simulated")
		}
		if _, err := p.Store.AddKnowledge(ctx, &cycle.ID, title, lesson+"\n\nFrom cycle: "+cycle.Title, tags); err != nil {
			return nil, err
		}
		result["knowledge"] = result["knowledge"].(int) + 1
	}
	if content.FollowUp.Needed && content.FollowUp.Priority >= 50 {
		next, created, err := p.Store.ProposeFollowUp(ctx, cycle.ID, content.FollowUp.Title, content.FollowUp.Signal, content.FollowUp.Priority)
		if err != nil {
			return nil, err
		}
		if created {
			result["followUp"] = next
		}
	}
	return result, nil
}

// ---- helpers --------------------------------------------------------------

func (p *Platform) latestAnalysis(ctx context.Context, cycleID, status string) (Analysis, bool) {
	list, err := p.Store.ListAnalyses(ctx, cycleID)
	if err != nil {
		return Analysis{}, false
	}
	for _, a := range list {
		if status == "" || a.Status == status {
			return a, true
		}
	}
	return Analysis{}, false
}

func (p *Platform) knowledgeContext(ctx context.Context, cycle Cycle) string {
	words := strings.Fields(cycle.Title)
	query := ""
	if len(words) > 0 {
		query = words[0]
		for _, w := range words {
			if len(w) > len(query) {
				query = w
			}
		}
	}
	entries, err := p.Store.SearchKnowledge(ctx, query, 5)
	if err != nil || len(entries) == 0 {
		return ""
	}
	var b strings.Builder
	for _, e := range entries {
		b.WriteString("- " + e.Title + "\n")
	}
	return b.String()
}
