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
		if providerBusy(err) {
			writeError(w, http.StatusTooManyRequests, "the model quota is used up; try again later")
			return
		}
		if errors.Is(err, ErrInvalid) || errors.Is(err, ErrNotFound) {
			writeEnglishError(w, err)
			return
		}
		writeError(w, http.StatusBadGateway, "the model could not write this lesson")
		return
	}
	pack.Cards = h.store.ApplyBuiltinBand(r.Context(), pack.Cards)
	h.store.WarmLessonCardsAsync(provider, pack.Cards)
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

func (h *Handler) writeEnglishSenses(w http.ResponseWriter, r *http.Request) {
	if h.platform == nil {
		writeError(w, http.StatusServiceUnavailable, "AI is not configured")
		return
	}
	card, err := h.store.English(r.Context(), r.PathValue("id"))
	if err != nil {
		writeEnglishError(w, err)
		return
	}
	if len(card.Senses) > 0 {
		writeJSON(w, http.StatusOK, card)
		return
	}
	provider, _, err := h.store.ProviderForRole(r.Context(), "english", h.platform.Sealer)
	if err != nil {
		writeEnglishError(w, err)
		return
	}
	saved, err := h.store.AttachSenses(r.Context(), provider, card)
	if providerBusy(err) {
		writeError(w, http.StatusTooManyRequests, "the model quota is used up; try again later")
		return
	}
	if err != nil || len(saved.Senses) == 0 {
		writeError(w, http.StatusBadGateway, "the model could not write the dictionary senses")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (h *Handler) listEnglish(w http.ResponseWriter, r *http.Request) {
	raw, etag, err := h.store.ListEnglishJSON(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read the English cards")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if etag != "" {
		w.Header().Set("ETag", etag)
		if match := strings.TrimSpace(r.Header.Get("If-None-Match")); match != "" && match == etag {
			w.WriteHeader(http.StatusNotModified)
			return
		}
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
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
