package desk

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

func (h *Handler) listCycles(w http.ResponseWriter, r *http.Request) {
	cycles, err := h.store.ListCycles(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read the loop")
		return
	}
	writeJSON(w, http.StatusOK, cycles)
}

func (h *Handler) createCycle(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeCycle(w, r)
	if !ok {
		return
	}
	cycle, err := h.store.CreateCycle(r.Context(), input)
	if err != nil {
		writeCycleError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, cycle)
}

func (h *Handler) updateCycle(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeCycle(w, r)
	if !ok {
		return
	}
	cycle, err := h.store.UpdateCycle(r.Context(), r.PathValue("id"), input)
	if err != nil {
		writeCycleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, cycle)
}

func (h *Handler) deleteCycle(w http.ResponseWriter, r *http.Request) {
	if err := h.store.DeleteCycle(r.Context(), r.PathValue("id")); err != nil {
		writeCycleError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) sampleCycle(w http.ResponseWriter, r *http.Request) {
	cycle, err := h.store.CreateSampleCycle(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load the example")
		return
	}
	writeJSON(w, http.StatusCreated, cycle)
}

type cycleBody struct {
	Title      string    `json:"title"`
	Stage      string    `json:"stage"`
	SignalKind string    `json:"signalKind"`
	Signal     string    `json:"signal"`
	Finding    string    `json:"finding"`
	Score      int       `json:"score"`
	Delivery   Delivery  `json:"delivery"`
	Practices  Practices `json:"practices"`
	Metrics    Metrics   `json:"metrics"`
	Lesson     string    `json:"lesson"`
	Priority   string    `json:"priority"`
	Repo       string    `json:"repo"`
}

func decodeCycle(w http.ResponseWriter, r *http.Request) (CycleInput, bool) {
	var body cycleBody
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "send a cycle as JSON")
		return CycleInput{}, false
	}
	return CycleInput{
		Title:      body.Title,
		Stage:      body.Stage,
		SignalKind: body.SignalKind,
		Signal:     body.Signal,
		Finding:    body.Finding,
		Score:      body.Score,
		Delivery:   body.Delivery,
		Practices:  body.Practices,
		Metrics:    body.Metrics,
		Lesson:     body.Lesson,
		Priority:   body.Priority,
		Repo:       body.Repo,
	}, true
}

func writeCycleError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "that cycle is not on the loop")
	case errors.Is(err, ErrInvalid):
		writeError(w, http.StatusBadRequest, strings.TrimPrefix(err.Error(), ErrInvalid.Error()+": "))
	default:
		writeError(w, http.StatusInternalServerError, "could not save the cycle")
	}
}
