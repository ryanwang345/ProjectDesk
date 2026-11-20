// Package auth protects the API with Keycloak access tokens.
package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
)

type contextKey string

const userIDContextKey contextKey = "projectdesk_user_id"

// UserIDFromContext returns the authenticated Keycloak subject (sub) from ctx,
// or an empty string if the request has no authenticated user.
func UserIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(userIDContextKey).(string)
	return v
}

// WithUserID attaches a user identifier to ctx for downstream handlers and tests.
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, userIDContextKey, userID)
}

type Config struct {
	Enabled  bool   `json:"enabled"`
	URL      string `json:"url,omitempty"`
	Realm    string `json:"realm,omitempty"`
	ClientID string `json:"clientId,omitempty"`
	Audience string `json:"-"`
	JWKSURL  string `json:"-"`
}

// Authentication is on by default. Disabling it is an explicit local test option.
func FromEnv() Config {
	return Config{
		Enabled:  os.Getenv("PROJECT_DESK_AUTH_DISABLED") != "1",
		URL:      strings.TrimRight(env("PROJECT_DESK_KEYCLOAK_URL", "https://keycloak.ryanwang.dev"), "/"),
		Realm:    env("PROJECT_DESK_KEYCLOAK_REALM", "homelab"),
		ClientID: env("PROJECT_DESK_KEYCLOAK_CLIENT_ID", "projectdesk-web"),
		Audience: env("PROJECT_DESK_KEYCLOAK_AUDIENCE", "projectdesk-api"),
		JWKSURL:  os.Getenv("PROJECT_DESK_KEYCLOAK_JWKS_URL"),
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func validURL(value string) bool {
	u, err := url.Parse(value)
	return err == nil && u.Host != "" && (u.Scheme == "https" || u.Scheme == "http") && u.User == nil && u.RawQuery == "" && u.Fragment == ""
}

// Protect uses a cached JWKS verifier. The public issuer stays identical to the
// browser's issuer even when containers fetch signing keys via an internal URL.
func Protect(ctx context.Context, cfg Config, next http.Handler) (http.Handler, error) {
	var verifier *oidc.IDTokenVerifier
	if cfg.Enabled {
		if !validURL(cfg.URL) || cfg.Realm == "" || strings.ContainsAny(cfg.Realm, "/?#") || cfg.ClientID == "" || cfg.Audience == "" {
			return nil, fmt.Errorf("invalid Keycloak URL, realm, client ID, or API audience")
		}
		issuer := cfg.URL + "/realms/" + cfg.Realm
		jwks := cfg.JWKSURL
		if jwks == "" {
			jwks = issuer + "/protocol/openid-connect/certs"
		}
		if !validURL(jwks) {
			return nil, fmt.Errorf("invalid Keycloak JWKS URL")
		}
		keyCtx := oidc.ClientContext(ctx, &http.Client{Timeout: 10 * time.Second})
		verifier = oidc.NewVerifier(issuer, oidc.NewRemoteKeySet(keyCtx, jwks), &oidc.Config{
			ClientID:             cfg.Audience,
			SupportedSigningAlgs: []string{oidc.RS256},
		})
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Path == "/api/auth/config" {
			public := cfg
			if !cfg.Enabled {
				public = Config{Enabled: false}
			}
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Cache-Control", "no-store")
			_ = json.NewEncoder(w).Encode(public)
			return
		}
		// Only infrastructure probes are public; application data needs a token.
		probe := r.Method == http.MethodGet && (r.URL.Path == "/api/healthz" || r.URL.Path == "/api/readyz")
		if !cfg.Enabled || probe {
			ctxWithUser := r.Context()
			if !cfg.Enabled {
				ctxWithUser = WithUserID(ctxWithUser, "local-anonymous")
			}
			next.ServeHTTP(w, r.WithContext(ctxWithUser))
			return
		}
		parts := strings.Fields(r.Header.Get("Authorization"))
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			unauthorized(w)
			return
		}
		token, err := verifier.Verify(r.Context(), parts[1])
		if err != nil {
			unauthorized(w)
			return
		}
		var claims struct {
			Type      string `json:"typ"`
			NotBefore int64  `json:"nbf"`
		}
		// Reject ID/refresh tokens and tokens that are not yet valid.
		if token.Subject == "" || token.Claims(&claims) != nil || claims.Type != "Bearer" || claims.NotBefore > time.Now().Unix() {
			unauthorized(w)
			return
		}
		w.Header().Set("Cache-Control", "private, no-store")
		next.ServeHTTP(w, r.WithContext(WithUserID(r.Context(), token.Subject)))
	}), nil
}

func unauthorized(w http.ResponseWriter) {
	w.Header().Set("WWW-Authenticate", `Bearer realm="projectdesk"`)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = w.Write([]byte("{\"error\":\"sign in with Keycloak to continue\"}\n"))
}
