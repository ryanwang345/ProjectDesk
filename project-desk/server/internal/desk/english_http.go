package desk

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
)

func (h *Handler) prepareEnglishLesson(w http.ResponseWriter, r *http.Request) {
	if h.platform == nil {
		writeError(w, http.StatusServiceUnavailable, "AI is not configured")
		return
	}
	index, err := strconv.Atoi(r.PathValue("n"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "unknown lesson")
		return
	}
	provider, _, err := h.store.ProviderForRole(r.Context(), "english", h.platform.Sealer)
	if err != nil {
		writeEnglishError(w, err)
		return
	}
	pack, err := h.store.PrepareLesson(r.Context(), index, provider)
	if err != nil {
		if errors.Is(err, ErrInvalid) || errors.Is(err, ErrNotFound) {
			writeEnglishError(w, err)
			return
		}
		writeError(w, http.StatusBadGateway, "the model could not write this lesson")
		return
	}
	writeJSON(w, http.StatusOK, pack)
}

func (h *Handler) listEnglish(w http.ResponseWriter, r *http.Request) {
	cards, err := h.store.ListEnglish(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read the English cards")
		return
	}
	writeJSON(w, http.StatusOK, cards)
}

func (h *Handler) createEnglish(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeEnglish(w, r)
	if !ok {
		return
	}
	card, err := h.store.CreateEnglish(r.Context(), input)
	if err != nil {
		writeEnglishError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, h.withPronunciation(r.Context(), card))
}

func (h *Handler) updateEnglish(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeEnglish(w, r)
	if !ok {
		return
	}
	card, err := h.store.UpdateEnglish(r.Context(), r.PathValue("id"), input)
	if err != nil {
		writeEnglishError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, h.withPronunciation(r.Context(), card))
}

func (h *Handler) withPronunciation(ctx context.Context, card EnglishCard) EnglishCard {
	if card.Pronunciation != "" || h.platform == nil {
		return card
	}
	provider, _, err := h.store.ProviderForRole(ctx, "english", h.platform.Sealer)
	if err != nil {
		return card
	}
	next, err := h.store.AttachPronunciation(ctx, provider, card)
	if err != nil {
		return card
	}
	return next
}

func (h *Handler) addEnglishReview(w http.ResponseWriter, r *http.Request) {
	h.writeEnglishReview(w, r, true)
}

func (h *Handler) removeEnglishReview(w http.ResponseWriter, r *http.Request) {
	h.writeEnglishReview(w, r, false)
}

func (h *Handler) writeEnglishReview(w http.ResponseWriter, r *http.Request, inReview bool) {
	card, err := h.store.SetEnglishReview(r.Context(), r.PathValue("id"), inReview)
	if err != nil {
		writeEnglishError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, card)
}

func (h *Handler) deleteEnglish(w http.ResponseWriter, r *http.Request) {
	if err := h.store.DeleteEnglish(r.Context(), r.PathValue("id")); err != nil {
		writeEnglishError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type englishBody struct {
	Word     string   `json:"word"`
	Meaning  string   `json:"meaning"`
	Examples []string `json:"examples"`
}

func decodeEnglish(w http.ResponseWriter, r *http.Request) (EnglishInput, bool) {
	var body englishBody
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "send an English card as JSON")
		return EnglishInput{}, false
	}
	return NormalizeEnglish(EnglishInput{Word: body.Word, Meaning: body.Meaning, Examples: body.Examples}), true
}

func writeEnglishError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "that card is not in the set")
	case errors.Is(err, ErrInvalid):
		writeError(w, http.StatusBadRequest, strings.TrimPrefix(err.Error(), ErrInvalid.Error()+": "))
	default:
		writeError(w, http.StatusInternalServerError, "could not save the English card")
	}
}
