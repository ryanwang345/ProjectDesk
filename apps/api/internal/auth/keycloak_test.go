package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
)

func TestProtect(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	var keyRequests atomic.Int32
	keys := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		keyRequests.Add(1)
		_ = json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, KeyID: "test", Algorithm: "RS256", Use: "sig"}}})
	}))
	defer keys.Close()
	cfg := Config{Enabled: true, URL: "https://identity.example", Realm: "projectdesk", ClientID: "projectdesk-web", Audience: "projectdesk-api", JWKSURL: keys.URL}
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	handler, err := Protect(context.Background(), cfg, next)
	if err != nil {
		t.Fatal(err)
	}
	sign := func(mutate func(map[string]any)) string {
		t.Helper()
		claims := map[string]any{"iss": cfg.URL + "/realms/" + cfg.Realm, "aud": cfg.Audience, "sub": "learner-1", "exp": time.Now().Add(time.Hour).Unix(), "iat": time.Now().Unix(), "typ": "Bearer"}
		mutate(claims)
		signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: key}, &jose.SignerOptions{ExtraHeaders: map[jose.HeaderKey]any{"kid": "test"}})
		if err != nil {
			t.Fatal(err)
		}
		payload, _ := json.Marshal(claims)
		object, err := signer.Sign(payload)
		if err != nil {
			t.Fatal(err)
		}
		token, err := object.CompactSerialize()
		if err != nil {
			t.Fatal(err)
		}
		return token
	}
	valid := sign(func(map[string]any) {})
	tampered := strings.Split(valid, ".")
	if tampered[2][0] == 'A' {
		tampered[2] = "B" + tampered[2][1:]
	} else {
		tampered[2] = "A" + tampered[2][1:]
	}
	cases := []struct {
		name, method, path, token string
		want                      int
	}{
		{"missing", "GET", "/api/projects", "", 401},
		{"malformed", "GET", "/api/projects", "not-a-jwt", 401},
		{"valid", "GET", "/api/projects", valid, 204},
		{"cached keys", "GET", "/api/projects", valid, 204},
		{"wrong issuer", "GET", "/api/projects", sign(func(c map[string]any) { c["iss"] = "https://attacker.example/realms/projectdesk" }), 401},
		{"wrong audience", "GET", "/api/projects", sign(func(c map[string]any) { c["aud"] = "another-api" }), 401},
		{"expired", "GET", "/api/projects", sign(func(c map[string]any) { c["exp"] = time.Now().Add(-time.Hour).Unix() }), 401},
		{"future nbf", "GET", "/api/projects", sign(func(c map[string]any) { c["nbf"] = time.Now().Add(time.Hour).Unix() }), 401},
		{"ID token", "GET", "/api/projects", sign(func(c map[string]any) { delete(c, "typ") }), 401},
		{"refresh token", "GET", "/api/projects", sign(func(c map[string]any) { c["typ"] = "Refresh" }), 401},
		{"missing subject", "GET", "/api/projects", sign(func(c map[string]any) { delete(c, "sub") }), 401},
		{"tampered signature", "GET", "/api/projects", strings.Join(tampered, "."), 401},
		{"health probe", "GET", "/api/healthz", "", 204},
		{"ready probe", "GET", "/api/readyz", "", 204},
		{"probe mutation", "POST", "/api/healthz", "", 401},
		{"version protected", "GET", "/api/version", "", 401},
		{"config mutation", "POST", "/api/auth/config", "", 401},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(tc.method, tc.path, nil)
			if tc.token != "" {
				r.Header.Set("Authorization", "Bearer "+tc.token)
			}
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, r)
			if w.Code != tc.want {
				t.Fatalf("status %d, want %d: %s", w.Code, tc.want, w.Body.String())
			}
			if tc.want == 401 && w.Header().Get("WWW-Authenticate") == "" {
				t.Fatal("missing bearer challenge")
			}
			if tc.name == "cached keys" && keyRequests.Load() != 1 {
				t.Fatalf("JWKS fetched %d times for valid tokens; expected cached signing keys", keyRequests.Load())
			}
		})
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest("GET", "/api/auth/config", nil))
	if w.Code != 200 || strings.Contains(w.Body.String(), keys.URL) || strings.Contains(w.Body.String(), "audience") {
		t.Fatalf("invalid public config: %s", w.Body.String())
	}
	var config Config
	if err := json.Unmarshal(w.Body.Bytes(), &config); err != nil || config.ClientID != cfg.ClientID || !config.Enabled {
		t.Fatalf("invalid public config: %s", w.Body.String())
	}
}

func TestFailClosedAndExplicitDisable(t *testing.T) {
	t.Setenv("PROJECT_DESK_AUTH_DISABLED", "")
	if !FromEnv().Enabled {
		t.Fatal("authentication must be enabled by default")
	}
	for _, cfg := range []Config{
		{Enabled: true},
		{Enabled: true, URL: "javascript:alert(1)", Realm: "desk", ClientID: "web", Audience: "api"},
		{Enabled: true, URL: "https://identity.example", Realm: "desk", ClientID: "web", Audience: "api", JWKSURL: "file:///tmp/keys"},
	} {
		if _, err := Protect(context.Background(), cfg, http.NotFoundHandler()); err == nil {
			t.Fatal("invalid config must fail startup")
		}
	}
	t.Setenv("PROJECT_DESK_AUTH_DISABLED", "1")
	handler, err := Protect(context.Background(), FromEnv(), http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
	if err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest("GET", "/api/projects", nil))
	if w.Code != 204 {
		t.Fatalf("explicitly disabled: %d", w.Code)
	}
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest("GET", "/api/auth/config", nil))
	if strings.TrimSpace(w.Body.String()) != `{"enabled":false}` {
		t.Fatalf("disabled config: %s", w.Body.String())
	}
}
