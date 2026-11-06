package desk

import (
	"context"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"projectdesk/internal/ai"
)

func TestStateMachine(t *testing.T) {
	cases := []struct {
		from, to string
		ok       bool
	}{
		{StatePending, StateAnalyzing, true},
		{"", StateAnalyzing, true},
		{StateAnalyzing, StateAwaitingApproval, true},
		{StateAwaitingApproval, StatePlanning, true},
		{StatePlanning, StateDeployed, false},
		{StateTesting, StateReadyForDeployment, true},
		{StateTesting, StateBlocked, true},
		{StateBlocked, StateReadyForDeployment, true},
		{StateBlocked, StateDeployed, false},
		{StateReadyForDeployment, StateDeployed, true},
		{StateDeployed, StateMonitoring, true},
		{StateMonitoring, StateCompleted, true},
		{StateCompleted, StatePending, false},
		{StateCancelled, StatePending, true},
	}
	for _, c := range cases {
		if got := CanTransition(c.from, c.to); got != c.ok {
			t.Errorf("CanTransition(%q, %q) = %v, want %v", c.from, c.to, got, c.ok)
		}
	}
	// Every state except the terminal one has a way out, and every target is
	// a known state.
	known := map[string]bool{}
	for s := range allowed {
		known[s] = true
	}
	for s, next := range allowed {
		if s != StateCompleted && len(next) == 0 {
			t.Errorf("state %s has no exits", s)
		}
		for _, n := range next {
			if !known[n] {
				t.Errorf("state %s transitions to unknown %s", s, n)
			}
		}
	}
}

func TestStageFor(t *testing.T) {
	want := map[string]string{
		StateAnalyzing: "discover", StatePlanning: "deliver", StateImplementing: "deliver",
		StateTesting: "validate", StateReadyForDeployment: "validate", StateMonitoring: "rediscover",
		StateCompleted: "rediscover", StateAwaitingApproval: "", StateBlocked: "",
	}
	for state, stage := range want {
		if got := StageFor(state); got != stage {
			t.Errorf("StageFor(%s) = %q, want %q", state, got, stage)
		}
	}
}

func TestSealerRoundTrip(t *testing.T) {
	s := NewSealer("test-secret")
	sealed, err := s.Seal("sk-abc123")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(sealed), "sk-abc123") {
		t.Fatal("sealed value contains the plaintext")
	}
	plain, err := s.Open(sealed)
	if err != nil || plain != "sk-abc123" {
		t.Fatalf("Open = %q, %v", plain, err)
	}
	if _, err := NewSealer("other").Open(sealed); err == nil {
		t.Fatal("expected a failure with a different secret")
	}
	if _, err := NewSealer("").Seal("x"); err != ErrNoSecretKey {
		t.Fatalf("expected ErrNoSecretKey, got %v", err)
	}
	if plain, err := NewSealer("").Open(nil); err != nil || plain != "" {
		t.Fatalf("empty sealed value should open to empty, got %q %v", plain, err)
	}
}

func TestRedact(t *testing.T) {
	cases := []string{
		"Authorization: Bearer abcdefghijklmnop",
		"key sk-proj-ABCDEFGHIJKLMNOP leaked",
		"token github_pat_11ABCDEFG_hijklmnop",
		"dckr_pat_ABCDEFGHIJK",
		`{"api_key": "supersecretvalue"}`,
	}
	for _, c := range cases {
		out := Redact(c)
		if !strings.Contains(out, "[redacted]") {
			t.Errorf("Redact(%q) = %q, expected a redaction", c, out)
		}
	}
	if got := Redact("response status 500 from provider", "my-known-secret"); got != "response status 500 from provider" {
		t.Errorf("Redact changed harmless text: %q", got)
	}
	if got := Redact("error for my-known-secret here", "my-known-secret"); strings.Contains(got, "my-known-secret") {
		t.Errorf("known secret not removed: %q", got)
	}
}

func TestTestsWeakened(t *testing.T) {
	bad := "--- a/test.mjs\n+++ b/test.mjs\n@@ -1,3 +1,2 @@\n import x\n-expect(x).toBe(1)\n ok\n"
	if hits := TestsWeakened(bad); len(hits) != 1 {
		t.Fatalf("expected one hit, got %v", hits)
	}
	good := "--- a/index.html\n+++ b/index.html\n@@ -1,2 +1,2 @@\n-<button>\n+<button class=\"btn\">\n"
	if hits := TestsWeakened(good); len(hits) != 0 {
		t.Fatalf("expected no hits, got %v", hits)
	}
	added := "--- a/app_test.go\n+++ b/app_test.go\n@@ -1,2 +1,3 @@\n func TestX(t *testing.T) {\n+\tif got != want { t.Fatal(got) }\n }\n"
	if hits := TestsWeakened(added); len(hits) != 0 {
		t.Fatalf("adding assertions is fine, got %v", hits)
	}
}

func TestValidRepoName(t *testing.T) {
	for _, ok := range []string{"sample-shop", "repo_1", "a.b"} {
		if !validRepoName(ok) {
			t.Errorf("%q should be valid", ok)
		}
	}
	for _, bad := range []string{"", ".", "..", "../etc", "a/b", "a b", strings.Repeat("x", 81)} {
		if validRepoName(bad) {
			t.Errorf("%q should be invalid", bad)
		}
	}
}

// TestWorkspacePatch runs the demo adapter's patch against the real sample
// repository through git, the same path the development agent uses.
func TestWorkspacePatch(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	root, _ := filepath.Abs(filepath.Join("..", "..", "samples"))
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	ws, err := NewWorkspace(ctx, root, "sample-shop")
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	if _, ok := ws.Manifest(); !ok {
		t.Fatal("sample manifest not readable")
	}

	demo, _ := ai.New(ai.Config{Kind: ai.KindDemo})
	var patch PatchContent
	if _, err := ai.GenerateJSON(ctx, demo, ai.Request{Messages: []ai.Message{{Role: "system", Content: "task: patch"}}}, &patch); err != nil {
		t.Fatal(err)
	}
	check, err := ws.CheckPatch(ctx, patch.Diff)
	if err != nil {
		t.Fatal(err)
	}
	if !check.Applies {
		t.Fatalf("demo patch should apply: %s", check.Error)
	}
	if len(check.Files) != 1 || check.Files[0] != "index.html" {
		t.Fatalf("unexpected files %v", check.Files)
	}
	if !strings.Contains(check.Normalized, `class="btn"`) || strings.Contains(check.Normalized, ".patch") {
		t.Fatalf("normalized diff wrong: %s", check.Normalized)
	}

	// The manifest controls the sandbox and may not be edited by an agent.
	ws2, err := NewWorkspace(ctx, root, "sample-shop")
	if err != nil {
		t.Fatal(err)
	}
	defer ws2.Close()
	evil := "--- a/.projectdesk.json\n+++ b/.projectdesk.json\n@@ -1,3 +1,3 @@\n {\n-  \"description\": \"Tiny static shop page used to demonstrate the AI loop end to end. The Search button is missing the shared .btn class.\",\n+  \"description\": \"changed\",\n   \"test\": {\n"
	check, err = ws2.CheckPatch(ctx, evil)
	if err != nil {
		t.Fatal(err)
	}
	if check.Applies || !strings.Contains(check.Error, ".projectdesk.json") {
		t.Fatalf("manifest edit should be refused, got %+v", check)
	}

	if _, err := NewWorkspace(ctx, root, "../server"); err == nil {
		t.Fatal("path escape should be refused")
	}
}
