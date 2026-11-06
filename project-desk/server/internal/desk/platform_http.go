package desk

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"projectdesk/internal/ai"
)

// registerPlatform adds the AI platform routes. Settings mutations can be
// protected with PROJECT_DESK_ADMIN_TOKEN; everything else follows the
// existing open-API model of the desk.
func (h *Handler) registerPlatform(mux *http.ServeMux) {
	p := h.platform
	admin := p.requireAdmin

	mux.HandleFunc("GET /api/readyz", h.ready)
	mux.HandleFunc("GET /api/platform", h.platformStatus)
	mux.HandleFunc("GET /api/repos", h.repos)

	mux.HandleFunc("GET /api/providers", h.listProviders)
	mux.HandleFunc("GET /api/providers/kinds", h.providerKinds)
	mux.HandleFunc("POST /api/providers", admin(h.createProvider))
	mux.HandleFunc("POST /api/providers/test", admin(h.testProvider))
	mux.HandleFunc("GET /api/providers/{id}/models", h.providerModels)
	mux.HandleFunc("PATCH /api/providers/{id}", admin(h.updateProvider))
	mux.HandleFunc("DELETE /api/providers/{id}", admin(h.deleteProvider))

	mux.HandleFunc("GET /api/agents", h.listAgents)
	mux.HandleFunc("PUT /api/agents/{role}", admin(h.setAgent))

	mux.HandleFunc("GET /api/cycles/{id}/workflow", h.workflow)
	for _, kind := range []string{"analyze", "specification", "plan", "patch", "validate", "outcome"} {
		mux.HandleFunc("POST /api/cycles/{id}/"+kind, h.startJob(kind))
	}
	mux.HandleFunc("POST /api/cycles/{id}/analyses/{analysis}/decision", h.decideAnalysis)
	mux.HandleFunc("PATCH /api/cycles/{id}/artifacts/{artifact}", h.editArtifact)
	mux.HandleFunc("POST /api/cycles/{id}/artifacts/{artifact}/decision", h.decideArtifact)
	mux.HandleFunc("POST /api/cycles/{id}/validation/override", h.overrideValidation)
	mux.HandleFunc("POST /api/cycles/{id}/deployed", h.deployed)
	mux.HandleFunc("POST /api/cycles/{id}/cancel", h.cancelCycle)
	mux.HandleFunc("POST /api/cycles/{id}/reset", h.resetCycle)

	mux.HandleFunc("GET /api/jobs", h.listJobs)
	mux.HandleFunc("POST /api/jobs/{id}/cancel", h.cancelJob)
	mux.HandleFunc("GET /api/events", h.listEvents)
	mux.HandleFunc("GET /api/usage", h.usage)
	mux.HandleFunc("GET /api/knowledge", h.listKnowledge)
	mux.HandleFunc("POST /api/knowledge", h.addKnowledge)
}

// requireAdmin checks the bearer token when one is configured.
func (p *Platform) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if p.AdminToken != "" {
			got := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
			if subtle.ConstantTimeCompare([]byte(got), []byte(p.AdminToken)) != 1 {
				writeError(w, http.StatusUnauthorized, "an admin token is required for AI settings changes")
				return
			}
		}
		next(w, r)
	}
}

func (h *Handler) ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := h.store.pool.Ping(ctx); err != nil {
		writeError(w, http.StatusServiceUnavailable, "postgres is not ready")
		return
	}
	var version int
	_ = h.store.pool.QueryRow(ctx, `SELECT coalesce(max(version), 0) FROM schema_migrations`).Scan(&version)
	if version < len(migrations) {
		writeError(w, http.StatusServiceUnavailable, "migrations have not finished")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "schema": version})
}

func (h *Handler) platformStatus(w http.ResponseWriter, r *http.Request) {
	p := h.platform
	runner := "none"
	runnerReady := false
	if p.Runner != nil {
		runner = p.Runner.Name()
		runnerReady = p.Runner.Available()
	}
	repos, _ := ListRepos(p.ReposRoot)
	writeJSON(w, http.StatusOK, map[string]any{
		"secretStorage":      p.Sealer.Enabled(),
		"adminTokenRequired": p.AdminToken != "",
		"runner":             runner,
		"runnerReady":        runnerReady,
		"reposConfigured":    len(repos),
		"maxJobsPerCycle":    p.MaxJobsPerCycle,
		"maxRepairs":         p.MaxRepairs,
		"states":             []string{StatePending, StateAnalyzing, StateAwaitingApproval, StatePlanning, StateImplementing, StateTesting, StateReviewing, StateReadyForDeployment, StateDeployed, StateMonitoring, StateCompleted, StateBlocked, StateFailed, StateCancelled},
	})
}

func (h *Handler) repos(w http.ResponseWriter, r *http.Request) {
	repos, err := ListRepos(h.platform.ReposRoot)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list repositories")
		return
	}
	writeJSON(w, http.StatusOK, repos)
}

// ---- providers ------------------------------------------------------------

type providerBody struct {
	Name      string  `json:"name"`
	Kind      string  `json:"kind"`
	BaseURL   string  `json:"baseUrl"`
	Model     string  `json:"model"`
	APIKey    *string `json:"apiKey"`
	IsDefault bool    `json:"isDefault"`
}

func (b providerBody) input() ProviderInput {
	return ProviderInput{Name: b.Name, Kind: ai.Kind(strings.ToLower(strings.TrimSpace(b.Kind))), BaseURL: b.BaseURL, Model: b.Model, APIKey: b.APIKey, IsDefault: b.IsDefault}
}

func (h *Handler) providerKinds(w http.ResponseWriter, _ *http.Request) {
	kinds := []map[string]any{}
	for _, k := range ai.Kinds {
		p, _ := ai.New(ai.Config{Kind: k, Model: "x"})
		caps := ai.Capabilities{}
		if p != nil {
			caps = p.Capabilities()
		}
		kinds = append(kinds, map[string]any{"kind": k, "capabilities": caps, "needsKey": k == ai.KindOpenAI || k == ai.KindAnthropic})
	}
	writeJSON(w, http.StatusOK, map[string]any{"kinds": kinds, "compatible": ai.Compatible})
}

func (h *Handler) listProviders(w http.ResponseWriter, r *http.Request) {
	list, err := h.store.ListProviders(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read providers")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) createProvider(w http.ResponseWriter, r *http.Request) {
	var body providerBody
	if !decodeJSON(w, r, &body) {
		return
	}
	rec, err := h.store.CreateProvider(r.Context(), body.input(), h.platform.Sealer)
	if err != nil {
		writePlatformError(w, err)
		return
	}
	_ = h.store.Record(r.Context(), nil, nil, "provider.created", "provider "+rec.Name+" added", map[string]string{"kind": string(rec.Kind)})
	writeJSON(w, http.StatusCreated, rec)
}

func (h *Handler) updateProvider(w http.ResponseWriter, r *http.Request) {
	var body providerBody
	if !decodeJSON(w, r, &body) {
		return
	}
	rec, err := h.store.UpdateProvider(r.Context(), r.PathValue("id"), body.input(), h.platform.Sealer)
	if err != nil {
		writePlatformError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, rec)
}

func (h *Handler) deleteProvider(w http.ResponseWriter, r *http.Request) {
	if err := h.store.DeleteProvider(r.Context(), r.PathValue("id")); err != nil {
		writePlatformError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// testProvider sends a tiny request. With an id it uses the stored key
// (optionally overridden); without one it tests the unsaved form.
func (h *Handler) testProvider(w http.ResponseWriter, r *http.Request) {
	var body struct {
		providerBody
		ID string `json:"id"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	var provider ai.Provider
	var name string
	if body.ID != "" && (body.APIKey == nil || *body.APIKey == "") {
		p, rec, err := h.store.OpenProvider(ctx, body.ID, h.platform.Sealer)
		if err != nil {
			writePlatformError(w, err)
			return
		}
		provider, name = p, rec.Name
		if body.Model != "" {
			p2, err := ai.New(ai.Config{Kind: rec.Kind, BaseURL: rec.BaseURL, Model: body.Model, APIKey: providerKey(ctx, h.store, h.platform.Sealer, rec.ID)})
			if err == nil {
				provider = p2
			}
		}
	} else {
		in := body.input()
		if err := validateProvider(in); err != nil {
			writePlatformError(w, err)
			return
		}
		key := ""
		if in.APIKey != nil {
			key = *in.APIKey
		}
		p, err := ai.New(ai.Config{Kind: in.Kind, BaseURL: in.BaseURL, Model: in.Model, APIKey: key})
		if err != nil {
			writePlatformError(w, err)
			return
		}
		provider, name = p, in.Name
	}
	start := time.Now()
	resp, err := provider.Generate(ctx, ai.Request{Messages: []ai.Message{{Role: "user", Content: "task: ping\nReply with the single word ok."}}, MaxTokens: 8})
	result := map[string]any{"ok": err == nil, "name": name, "ms": time.Since(start).Milliseconds(), "simulated": provider.Capabilities().Simulated}
	if err != nil {
		result["error"] = Redact(err.Error())
	} else {
		result["model"] = resp.Model
		result["usage"] = resp.Usage
		result["sample"] = truncate(resp.Text, 200)
	}
	writeJSON(w, http.StatusOK, result)
}

func providerKey(ctx context.Context, s *Store, sealer *Sealer, id string) string {
	var sealed []byte
	if err := s.pool.QueryRow(ctx, `SELECT api_key FROM providers WHERE id = $1`, id).Scan(&sealed); err != nil {
		return ""
	}
	key, _ := sealer.Open(sealed)
	return key
}

func (h *Handler) providerModels(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	p, _, err := h.store.OpenProvider(ctx, r.PathValue("id"), h.platform.Sealer)
	if err != nil {
		writePlatformError(w, err)
		return
	}
	models, err := p.Models(ctx)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"models": []ai.Model{}, "error": Redact(err.Error())})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"models": models})
}

// ---- agents ---------------------------------------------------------------

func (h *Handler) listAgents(w http.ResponseWriter, r *http.Request) {
	list, err := h.store.ListAssignments(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read agent assignments")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"roles": AgentRoles, "assignments": list})
}

func (h *Handler) setAgent(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ProviderID *string `json:"providerId"`
		Model      string  `json:"model"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	a := Assignment{Role: r.PathValue("role"), ProviderID: body.ProviderID, Model: body.Model}
	if err := h.store.SetAssignment(r.Context(), a); err != nil {
		writePlatformError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, a)
}

// ---- cycle workflow -------------------------------------------------------

func (h *Handler) workflow(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := r.PathValue("id")
	cycle, err := h.store.GetCycle(ctx, id)
	if err != nil {
		writePlatformError(w, err)
		return
	}
	analyses, err := h.store.ListAnalyses(ctx, id)
	if err != nil {
		writePlatformError(w, err)
		return
	}
	artifacts, err := h.store.ListArtifacts(ctx, id)
	if err != nil {
		writePlatformError(w, err)
		return
	}
	jobs, err := h.store.ListJobs(ctx, id, 50)
	if err != nil {
		writePlatformError(w, err)
		return
	}
	events, err := h.store.ListEvents(ctx, id, 100)
	if err != nil {
		writePlatformError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"cycle": cycle, "analyses": analyses, "artifacts": artifacts, "jobs": jobs, "events": events,
		"actions": availableActions(cycle, artifacts, analyses),
	})
}

// availableActions tells the UI which buttons make sense right now.
func availableActions(c Cycle, artifacts []Artifact, analyses []Analysis) []string {
	approved := func(kind string) bool {
		for _, a := range artifacts {
			if a.Kind == kind && a.Status == "approved" {
				return true
			}
		}
		return false
	}
	pending := func(kind string) bool {
		for _, a := range artifacts {
			if a.Kind == kind && a.Status == "proposed" {
				return true
			}
		}
		return false
	}
	analysisApproved := false
	for _, a := range analyses {
		if a.Status == "approved" {
			analysisApproved = true
		}
	}
	var out []string
	switch c.WorkflowState {
	case StatePending, StateFailed, StateCancelled:
		out = append(out, "analyze")
		if c.WorkflowState == StateFailed {
			out = append(out, "reset")
		}
	case StatePlanning:
		if !approved("specification") || !pending("specification") {
			out = append(out, "specification")
		}
		if approved("specification") {
			out = append(out, "plan")
		}
	case StateImplementing:
		if approved("plan") {
			out = append(out, "patch")
		}
	case StateTesting:
		if approved("patch") {
			out = append(out, "validate")
		}
	case StateBlocked:
		if approved("patch") {
			out = append(out, "validate", "override")
		}
	case StateReadyForDeployment:
		out = append(out, "deployed")
	case StateMonitoring:
		out = append(out, "outcome")
	case StateAwaitingApproval:
		out = append(out, "decide")
	}
	if analysisApproved && c.WorkflowState == StatePending {
		out = append(out, "specification")
	}
	if c.WorkflowState != StateCompleted && c.WorkflowState != StateCancelled {
		out = append(out, "cancel")
	}
	return out
}

// startJob is the one entry point for the six agent steps. It checks the
// state machine before queueing so a stale UI gets a clear refusal.
func (h *Handler) startJob(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		id := r.PathValue("id")
		cycle, err := h.store.GetCycle(ctx, id)
		if err != nil {
			writePlatformError(w, err)
			return
		}
		if msg := h.platform.precheck(ctx, cycle, kind); msg != "" {
			writeError(w, http.StatusConflict, msg)
			return
		}
		job, err := h.store.Enqueue(ctx, &id, kind, map[string]string{"requestedBy": "ui"}, h.platform.MaxJobsPerCycle)
		if err != nil {
			writePlatformError(w, err)
			return
		}
		// Move into the running state right away so the ring reflects it.
		if next := startState(kind); next != "" && cycle.WorkflowState != next {
			if _, err := h.store.Transition(ctx, id, next, kind+" queued"); err != nil && !errors.Is(err, ErrTransition) {
				writePlatformError(w, err)
				return
			}
		}
		_ = h.store.Record(ctx, &id, &job.ID, "job.queued", kind+" queued", nil)
		writeJSON(w, http.StatusAccepted, job)
	}
}

func startState(kind string) string {
	switch kind {
	case "analyze":
		return StateAnalyzing
	case "patch":
		return StateImplementing
	case "validate":
		return StateTesting
	}
	return ""
}

// precheck returns a user-facing reason when a step cannot start.
func (p *Platform) precheck(ctx context.Context, c Cycle, kind string) string {
	state := c.WorkflowState
	if state == "" {
		state = StatePending
	}
	in := func(states ...string) bool {
		for _, s := range states {
			if s == state {
				return true
			}
		}
		return false
	}
	approved := func(k string) bool {
		_, ok, _ := p.Store.LatestApproved(ctx, c.ID, k)
		return ok
	}
	switch kind {
	case "analyze":
		if !in(StatePending, StateFailed, StateCancelled, StateAnalyzing) {
			return "analysis can only start on a new, failed, or cancelled cycle"
		}
	case "specification":
		if !in(StatePlanning, StateFailed) {
			return "approve the analysis first"
		}
	case "plan":
		if !approved("specification") {
			return "approve a specification first"
		}
	case "patch":
		if !in(StateImplementing, StateFailed, StateBlocked) || !approved("plan") {
			return "approve a plan first"
		}
		if c.Repo == "" {
			return "choose a repository on the cycle first"
		}
	case "validate":
		if !in(StateTesting, StateBlocked, StateFailed) || !approved("patch") {
			return "approve a patch first"
		}
	case "outcome":
		if !in(StateMonitoring, StateFailed) {
			return "mark the cycle deployed first"
		}
	}
	return ""
}

func (h *Handler) decideAnalysis(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Decision     string `json:"decision"`
		ApplyScore   bool   `json:"applyScore"`
		ApplyFinding bool   `json:"applyFinding"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	a, err := h.store.DecideAnalysis(r.Context(), r.PathValue("id"), r.PathValue("analysis"), body.Decision, body.ApplyScore, body.ApplyFinding)
	if err != nil {
		writePlatformError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, a)
}

func (h *Handler) editArtifact(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Content string `json:"content"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	a, err := h.store.EditArtifact(r.Context(), r.PathValue("id"), r.PathValue("artifact"), body.Content)
	if err != nil {
		writePlatformError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, a)
}

func (h *Handler) decideArtifact(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Decision string `json:"decision"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	ctx := r.Context()
	id := r.PathValue("id")
	a, _, err := h.store.DecideArtifact(ctx, id, r.PathValue("artifact"), body.Decision)
	if err != nil {
		writePlatformError(w, err)
		return
	}
	result := map[string]any{"artifact": a}
	if a.Kind == "outcome" && a.Status == "approved" {
		cycle, err := h.store.GetCycle(ctx, id)
		if err == nil {
			if extra, err := h.platform.CompleteOutcome(ctx, cycle, a); err == nil {
				for k, v := range extra {
					result[k] = v
				}
			}
		}
	}
	writeJSON(w, http.StatusOK, result)
}

// overrideValidation lets a person advance a blocked cycle when tests could
// not run. It is recorded as a human decision, never as a pass.
func (h *Handler) overrideValidation(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Reason string `json:"reason"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if len(strings.TrimSpace(body.Reason)) < 10 {
		writeError(w, http.StatusBadRequest, "give a reason of at least 10 characters for overriding validation")
		return
	}
	ctx := r.Context()
	id := r.PathValue("id")
	cycle, err := h.store.GetCycle(ctx, id)
	if err != nil {
		writePlatformError(w, err)
		return
	}
	if cycle.WorkflowState != StateBlocked {
		writeError(w, http.StatusConflict, "only a blocked cycle can be overridden")
		return
	}
	for _, a := range mustArtifacts(ctx, h.store, id) {
		if a.Kind == "validation" && a.Status == "failed" {
			writeError(w, http.StatusConflict, "validation failed; fix the patch rather than overriding")
			return
		}
		if a.Kind == "validation" {
			break
		}
	}
	if _, err := h.store.Transition(ctx, id, StateReadyForDeployment, "validation overridden by a person: "+body.Reason); err != nil {
		writePlatformError(w, err)
		return
	}
	_ = h.store.Record(ctx, &id, nil, "validation.overridden", body.Reason, nil)
	writeJSON(w, http.StatusOK, map[string]string{"state": StateReadyForDeployment})
}

func mustArtifacts(ctx context.Context, s *Store, id string) []Artifact {
	list, _ := s.ListArtifacts(ctx, id)
	return list
}

func (h *Handler) deployed(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := r.PathValue("id")
	if _, err := h.store.Transition(ctx, id, StateDeployed, "marked deployed by a person"); err != nil {
		writePlatformError(w, err)
		return
	}
	_, _ = h.store.pool.Exec(ctx, `UPDATE cycles SET deploy_done = true, updated_at = now() WHERE id = $1`, id)
	cycle, err := h.store.Transition(ctx, id, StateMonitoring, "monitoring")
	if err != nil {
		writePlatformError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, cycle)
}

func (h *Handler) cancelCycle(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := r.PathValue("id")
	jobs, err := h.store.ListJobs(ctx, id, 50)
	if err != nil {
		writePlatformError(w, err)
		return
	}
	for _, j := range jobs {
		if j.Status == "queued" || j.Status == "running" {
			_, _ = h.store.CancelJob(ctx, j.ID)
		}
	}
	cycle, err := h.store.Transition(ctx, id, StateCancelled, "cancelled by a person")
	if err != nil {
		writePlatformError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, cycle)
}

func (h *Handler) resetCycle(w http.ResponseWriter, r *http.Request) {
	cycle, err := h.store.Transition(r.Context(), r.PathValue("id"), StatePending, "reset by a person")
	if err != nil {
		writePlatformError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, cycle)
}

// ---- jobs, events, usage, knowledge --------------------------------------

func limitParam(r *http.Request, def, max int) int {
	n, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || n <= 0 {
		return def
	}
	if n > max {
		return max
	}
	return n
}

func (h *Handler) listJobs(w http.ResponseWriter, r *http.Request) {
	jobs, err := h.store.ListJobs(r.Context(), r.URL.Query().Get("cycle"), limitParam(r, 50, 200))
	if err != nil {
		writePlatformError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, jobs)
}

func (h *Handler) cancelJob(w http.ResponseWriter, r *http.Request) {
	job, err := h.store.CancelJob(r.Context(), r.PathValue("id"))
	if err != nil {
		writePlatformError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (h *Handler) listEvents(w http.ResponseWriter, r *http.Request) {
	events, err := h.store.ListEvents(r.Context(), r.URL.Query().Get("cycle"), limitParam(r, 100, 500))
	if err != nil {
		writePlatformError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, events)
}

func (h *Handler) usage(w http.ResponseWriter, r *http.Request) {
	totals, err := h.store.UsageTotals(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read usage")
		return
	}
	writeJSON(w, http.StatusOK, totals)
}

func (h *Handler) listKnowledge(w http.ResponseWriter, r *http.Request) {
	entries, err := h.store.SearchKnowledge(r.Context(), r.URL.Query().Get("q"), limitParam(r, 50, 200))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not search the knowledge base")
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

func (h *Handler) addKnowledge(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Title string   `json:"title"`
		Body  string   `json:"body"`
		Tags  []string `json:"tags"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	body.Title = strings.TrimSpace(body.Title)
	if body.Title == "" || len([]rune(body.Title)) > 120 || len([]rune(body.Body)) > 4000 {
		writeError(w, http.StatusBadRequest, "give the lesson a title under 120 characters and a body under 4000")
		return
	}
	e, err := h.store.AddKnowledge(r.Context(), nil, body.Title, strings.TrimSpace(body.Body), body.Tags)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not save the lesson")
		return
	}
	writeJSON(w, http.StatusCreated, e)
}

// ---- shared ---------------------------------------------------------------

func decodeJSON(w http.ResponseWriter, r *http.Request, out any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	if err := decoder.Decode(out); err != nil {
		writeError(w, http.StatusBadRequest, "send the request as JSON")
		return false
	}
	return true
}

func writePlatformError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "not found")
	case errors.Is(err, ErrInvalid):
		writeError(w, http.StatusBadRequest, strings.TrimPrefix(err.Error(), ErrInvalid.Error()+": "))
	case errors.Is(err, ErrBusy), errors.Is(err, ErrLimit), errors.Is(err, ErrTransition):
		writeError(w, http.StatusConflict, Redact(err.Error()))
	case errors.Is(err, ErrNoSecretKey):
		writeError(w, http.StatusBadRequest, ErrNoSecretKey.Error())
	default:
		writeError(w, http.StatusInternalServerError, "something went wrong on the server")
	}
}
