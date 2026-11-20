package desk

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"

	"projectdesk/internal/auth"
)

type userFeaturesPayload struct {
	Features map[string]bool `json:"features"`
}

func (h *Handler) getUserFeatures(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "sign in to continue"})
		return
	}
	var raw []byte
	err := h.store.pool.QueryRow(r.Context(), `
		SELECT features FROM user_feature_preferences WHERE user_id = $1
	`, userID).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusOK, userFeaturesPayload{Features: map[string]bool{}})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load feature preferences"})
		return
	}
	features := map[string]bool{}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &features)
	}
	writeJSON(w, http.StatusOK, userFeaturesPayload{Features: features})
}

func (h *Handler) putUserFeatures(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "sign in to continue"})
		return
	}
	var req userFeaturesPayload
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16*1024)).Decode(&req); err != nil || req.Features == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid features payload"})
		return
	}
	encoded, err := json.Marshal(req.Features)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid features map"})
		return
	}
	if _, err := h.store.pool.Exec(r.Context(), `
		INSERT INTO user_feature_preferences (user_id, features, updated_at)
		VALUES ($1, $2::jsonb, now())
		ON CONFLICT (user_id)
		DO UPDATE SET features = EXCLUDED.features, updated_at = now()
	`, userID, string(encoded)); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save feature preferences"})
		return
	}
	writeJSON(w, http.StatusOK, userFeaturesPayload{Features: req.Features})
}
