package desk

import (
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
	if next, bandErr := h.store.EnsureBand(r.Context(), provider, pack.Cards); bandErr == nil {
		pack.Cards = next
	}
	writeJSON(w, http.StatusOK, pack)
}

func (h *Handler) writeEnglishBand(w http.ResponseWriter, r *http.Request) {
	if h.platform == nil {
		writeError(w, http.StatusServiceUnavailable, "AI is not configured")
		return
	}
	card, err := h.store.English(r.Context(), r.PathValue("id"))
	if err != nil {
		writeEnglishError(w, err)
		return
	}
	if card.Band.ready() {
		writeJSON(w, http.StatusOK, card)
		return
	}
	if note, ok := builtinBand[strings.ToLower(card.Word)]; ok {
		saved, saveErr := h.store.saveBand(r.Context(), card.ID, note)
		if saveErr != nil {
			writeEnglishError(w, saveErr)
			return
		}
		writeJSON(w, http.StatusOK, saved)
		return
	}
	provider, _, err := h.store.ProviderForRole(r.Context(), "english", h.platform.Sealer)
	if err != nil {
		writeEnglishError(w, err)
		return
	}
	cards, err := h.store.EnsureBand(r.Context(), provider, []EnglishCard{card})
	if err != nil || len(cards) == 0 || !cards[0].Band.ready() {
		writeError(w, http.StatusBadGateway, "the model could not write the band 9 notes")
		return
	}
	writeJSON(w, http.StatusOK, cards[0])
}

func (h *Handler) listEnglish(w http.ResponseWriter, r *http.Request) {
	cards, err := h.store.ListEnglish(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read the English cards")
		return
	}
	writeJSON(w, http.StatusOK, cards)
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
