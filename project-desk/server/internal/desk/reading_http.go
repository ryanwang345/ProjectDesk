package desk

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

func (h *Handler) registerReading(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/reading/tests", h.listReadingTests)
	mux.HandleFunc("GET /api/reading/analytics", h.getReadingAnalytics)
	mux.HandleFunc("POST /api/reading/sessions", h.startReadingSession)
	mux.HandleFunc("GET /api/reading/sessions/{id}", h.getReadingSession)
	mux.HandleFunc("PATCH /api/reading/sessions/{id}", h.updateReadingSession)
	mux.HandleFunc("POST /api/reading/sessions/{id}/check", h.checkReadingQuestion)
	mux.HandleFunc("POST /api/reading/sessions/{id}/submit", h.submitReadingSession)
	mux.HandleFunc("POST /api/reading/ai/explain", h.explainReadingQuestion)
	mux.HandleFunc("POST /api/reading/ai/vocab", h.lookupReadingVocab)
	mux.HandleFunc("POST /api/reading/ai/generate", h.generateReadingPractice)
}

func (h *Handler) listReadingTests(w http.ResponseWriter, r *http.Request) {
	module := r.URL.Query().Get("module")
	tests, err := h.store.ListReadingTests(r.Context(), module)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load reading tests")
		return
	}
	writeJSON(w, http.StatusOK, tests)
}

func (h *Handler) getReadingAnalytics(w http.ResponseWriter, r *http.Request) {
	module := r.URL.Query().Get("module")
	analytics, err := h.store.GetReadingAnalytics(r.Context(), module)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load reading analytics")
		return
	}
	writeJSON(w, http.StatusOK, analytics)
}

func (h *Handler) startReadingSession(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TestID          string `json:"testId"`
		Mode            string `json:"mode"`
		DurationSeconds int    `json:"durationSeconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.TestID) == "" {
		writeError(w, http.StatusBadRequest, "provide a valid testId")
		return
	}
	bundle, err := h.store.StartReadingSession(r.Context(), body.TestID, body.Mode, body.DurationSeconds)
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, bundle)
}

func (h *Handler) getReadingSession(w http.ResponseWriter, r *http.Request) {
	bundle, err := h.store.GetReadingSession(r.Context(), r.PathValue("id"))
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, bundle)
}

func (h *Handler) updateReadingSession(w http.ResponseWriter, r *http.Request) {
	var patch ReadingSessionPatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		writeError(w, http.StatusBadRequest, "invalid session update payload")
		return
	}
	session, err := h.store.UpdateReadingSession(r.Context(), r.PathValue("id"), patch)
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, session)
}

func (h *Handler) checkReadingQuestion(w http.ResponseWriter, r *http.Request) {
	var body struct {
		QuestionID string `json:"questionId"`
		UserAnswer string `json:"userAnswer"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.QuestionID) == "" {
		writeError(w, http.StatusBadRequest, "provide a valid questionId")
		return
	}
	res, err := h.store.CheckPracticeQuestion(r.Context(), r.PathValue("id"), body.QuestionID, body.UserAnswer)
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *Handler) submitReadingSession(w http.ResponseWriter, r *http.Request) {
	var patch ReadingSessionPatch
	_ = json.NewDecoder(r.Body).Decode(&patch)
	bundle, err := h.store.SubmitReadingSession(r.Context(), r.PathValue("id"), patch)
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, bundle)
}

func (h *Handler) explainReadingQuestion(w http.ResponseWriter, r *http.Request) {
	var req ReadingAIExplainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.QuestionID) == "" {
		writeError(w, http.StatusBadRequest, "provide a questionId to explain")
		return
	}
	var sealer *Sealer
	if h.platform != nil {
		sealer = h.platform.Sealer
	}
	exp, err := h.store.ExplainReadingQuestion(r.Context(), req, sealer)
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, exp)
}

func (h *Handler) lookupReadingVocab(w http.ResponseWriter, r *http.Request) {
	var req ReadingVocabRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "provide a selection to look up")
		return
	}
	var sealer *Sealer
	if h.platform != nil {
		sealer = h.platform.Sealer
	}
	res, err := h.store.LookupReadingVocab(r.Context(), req, sealer)
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *Handler) generateReadingPractice(w http.ResponseWriter, r *http.Request) {
	var req ReadingGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid generation parameters")
		return
	}
	var sealer *Sealer
	if h.platform != nil {
		sealer = h.platform.Sealer
	}
	test, err := h.store.GenerateReadingPractice(r.Context(), req, sealer)
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, RedactTestForActiveSession(test))
}

func writeReadingError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "reading resource not found")
	case errors.Is(err, ErrInvalid):
		writeError(w, http.StatusBadRequest, strings.TrimPrefix(err.Error(), ErrInvalid.Error()+": "))
	default:
		writeError(w, http.StatusInternalServerError, "could not process reading request")
	}
}
