package desk

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAdminCredentialAlongsideKeycloak(t *testing.T) {
	p := &Platform{AdminToken: "test-admin-secret"}
	handler := p.requireAdmin(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	for _, tc := range []struct {
		name, bearer, admin string
		want                int
	}{
		{"separate admin credential", "keycloak-access-token", "test-admin-secret", 204},
		{"wrong admin credential", "keycloak-access-token", "wrong", 401},
		{"login alone cannot administer", "keycloak-access-token", "", 401},
		{"legacy local admin bearer", "test-admin-secret", "", 204},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodPost, "/api/providers", nil)
			r.Header.Set("Authorization", "Bearer "+tc.bearer)
			r.Header.Set("X-ProjectDesk-Admin-Token", tc.admin)
			w := httptest.NewRecorder()
			handler(w, r)
			if w.Code != tc.want {
				t.Fatalf("status %d, want %d", w.Code, tc.want)
			}
		})
	}
}
