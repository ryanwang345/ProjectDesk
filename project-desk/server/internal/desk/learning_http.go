package desk

import (
	"encoding/json"
	"net/http"
)

func (h *Handler) registerLearning(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/learning/progress", h.learningProgress)
	mux.HandleFunc("POST /api/learning/import", h.importLearningProgress)
	mux.HandleFunc("POST /api/learning/vocabulary-completions", h.completeVocabularyLesson)
	mux.HandleFunc("GET /api/reading/learning", h.readingLearning)
	mux.HandleFunc("POST /api/reading/daily", h.startDailyReading)
	mux.HandleFunc("GET /api/reading/mistakes", h.readingMistakes)
	mux.HandleFunc("POST /api/reading/mistakes/review", h.startReadingReview)
	mux.HandleFunc("GET /api/reading/vocabulary", h.readingVocabulary)
	mux.HandleFunc("POST /api/reading/vocabulary", h.saveReadingVocabulary)
}

func (h *Handler) learningProgress(w http.ResponseWriter, r *http.Request) {
	progress, err := h.store.GetLearningProgress(r.Context(), r.URL.Query().Get("timezone"))
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, 200, progress)
}
func (h *Handler) importLearningProgress(w http.ResponseWriter, r *http.Request) {
	var input legacyLearningProgress
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 128<<10)).Decode(&input); err != nil {
		writeError(w, 400, "provide saved vocabulary progress")
		return
	}
	progress, err := h.store.ImportLearningProgress(r.Context(), input, r.URL.Query().Get("timezone"))
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, 200, progress)
}
func (h *Handler) completeVocabularyLesson(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Lesson  int `json:"lesson"`
		Correct int `json:"correct"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&input); err != nil {
		writeError(w, 400, "provide a lesson completion")
		return
	}
	progress, err := h.store.CompleteVocabularyLesson(r.Context(), input.Lesson, input.Correct, r.URL.Query().Get("timezone"))
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, 200, progress)
}
func (h *Handler) readingLearning(w http.ResponseWriter, r *http.Request) {
	dashboard, err := h.store.GetReadingLearning(r.Context(), r.URL.Query().Get("module"), r.URL.Query().Get("timezone"))
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, 200, dashboard)
}
func (h *Handler) startDailyReading(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Module string `json:"module"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&input); err != nil {
		writeError(w, 400, "choose a reading module")
		return
	}
	bundle, err := h.store.StartDailyReading(r.Context(), input.Module, r.URL.Query().Get("timezone"))
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, 200, bundle)
}
func (h *Handler) readingMistakes(w http.ResponseWriter, r *http.Request) {
	items, err := h.store.ListReadingMistakes(r.Context(), r.URL.Query().Get("module"), r.URL.Query().Get("type"), r.URL.Query().Get("resolved") == "true")
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, 200, items)
}
func (h *Handler) startReadingReview(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Module string `json:"module"`
		Type   string `json:"type"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&input); err != nil {
		writeError(w, 400, "choose a mistake group")
		return
	}
	bundle, err := h.store.StartReadingMistakeReview(r.Context(), input.Module, input.Type)
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, 200, bundle)
}
func (h *Handler) readingVocabulary(w http.ResponseWriter, r *http.Request) {
	words, err := h.store.ListReadingVocabulary(r.Context())
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, 200, words)
}
func (h *Handler) saveReadingVocabulary(w http.ResponseWriter, r *http.Request) {
	var input SaveReadingWordRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&input); err != nil {
		writeError(w, 400, "provide a selected word and definition")
		return
	}
	card, err := h.store.SaveReadingWord(r.Context(), input)
	if err != nil {
		writeReadingError(w, err)
		return
	}
	writeJSON(w, 200, card)
}
