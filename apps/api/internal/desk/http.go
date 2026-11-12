package desk

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

type Handler struct {
	store    *Store
	platform *Platform
	speech   *speechService
}

// NewHandler serves the desk, the loop, and (when platform is non-nil) the
// AI platform routes.
func NewHandler(store *Store, platform *Platform) http.Handler {
	h := &Handler{store: store, platform: platform, speech: newSpeechService()}
	mux := http.NewServeMux()
	if platform != nil {
		h.registerPlatform(mux)
	}
	h.registerReading(mux)
	h.registerLearning(mux)
	mux.HandleFunc("GET /api/healthz", h.health)
	mux.HandleFunc("GET /api/cycles", h.listCycles)
	mux.HandleFunc("POST /api/cycles/sample", h.sampleCycle)
	mux.HandleFunc("POST /api/cycles", h.createCycle)
	mux.HandleFunc("PATCH /api/cycles/{id}", h.updateCycle)
	mux.HandleFunc("DELETE /api/cycles/{id}", h.deleteCycle)
	mux.HandleFunc("GET /api/english", h.listEnglish)
	mux.HandleFunc("GET /api/english/speech", h.speechStatus)
	mux.HandleFunc("POST /api/english/speech", h.pronounceAudio)
	mux.HandleFunc("POST /api/english-lessons/{n}", h.prepareEnglishLesson)
	mux.HandleFunc("POST /api/english/{id}/review", h.addEnglishReview)
	mux.HandleFunc("POST /api/english/{id}/band", h.writeEnglishBand)
	mux.HandleFunc("POST /api/english/{id}/senses", h.writeEnglishSenses)
	mux.HandleFunc("DELETE /api/english/{id}/review", h.removeEnglishReview)
	mux.HandleFunc("DELETE /api/english/{id}", h.deleteEnglish)
	mux.HandleFunc("GET /api/projects", h.list)
	mux.HandleFunc("POST /api/projects", h.create)
	mux.HandleFunc("POST /api/projects/samples", h.samples)
	mux.HandleFunc("DELETE /api/projects", h.clear)
	mux.HandleFunc("PATCH /api/projects/{id}", h.update)
	mux.HandleFunc("DELETE /api/projects/{id}", h.delete)
	return mux
}

func (h *Handler) health(w http.ResponseWriter, r *http.Request) {
	if err := h.store.pool.Ping(r.Context()); err != nil {
		writeError(w, http.StatusServiceUnavailable, "postgres is not ready")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	projects, err := h.store.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read the desk")
		return
	}
	writeJSON(w, http.StatusOK, projects)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeInput(w, r)
	if !ok {
		return
	}
	project, err := h.store.Create(r.Context(), input)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, project)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeInput(w, r)
	if !ok {
		return
	}
	project, err := h.store.Update(r.Context(), r.PathValue("id"), input)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, project)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	if err := h.store.Delete(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) clear(w http.ResponseWriter, r *http.Request) {
	if err := h.store.Clear(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "could not clear the desk")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) samples(w http.ResponseWriter, r *http.Request) {
	projects, err := h.store.ReplaceWithSamples(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load the examples")
		return
	}
	writeJSON(w, http.StatusOK, projects)
}

type requestBody struct {
	Name   string `json:"name"`
	Note   string `json:"note"`
	Status string `json:"status"`
}

func decodeInput(w http.ResponseWriter, r *http.Request) (Input, bool) {
	var body requestBody
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "send a project as JSON")
		return Input{}, false
	}
	if strings.TrimSpace(body.Status) == "" {
		body.Status = "sketch"
	}
	input := Normalize(Input{Name: body.Name, Note: body.Note, Status: body.Status})
	return input, true
}

func writeStoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "that project is not on the desk")
	case errors.Is(err, ErrInvalid):
		writeError(w, http.StatusBadRequest, strings.TrimPrefix(err.Error(), ErrInvalid.Error()+": "))
	default:
		writeError(w, http.StatusInternalServerError, "could not save the project")
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
