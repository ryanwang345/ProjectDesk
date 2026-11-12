package desk

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// RepoManifest is the optional .projectdesk.json at the root of an
// authorized repository. It names the sandbox image and test command. The
// file comes from the repository, so it is untrusted: the command only ever
// runs inside the container, never on the API host.
type RepoManifest struct {
	Description string `json:"description"`
	Test        struct {
		Image   string   `json:"image"`
		Command []string `json:"command"`
	} `json:"test"`
}

const manifestName = ".projectdesk.json"

// Workspace is a throwaway copy of an authorized repository with its own
// git history, so a proposed diff can be checked and applied without
// touching the source tree.
type Workspace struct {
	Dir  string
	Repo string
}

// ListRepos returns the authorized repository names under root.
func ListRepos(root string) ([]map[string]string, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return []map[string]string{}, nil
		}
		return nil, err
	}
	out := []map[string]string{}
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		var m RepoManifest
		if raw, err := os.ReadFile(filepath.Join(root, e.Name(), manifestName)); err == nil {
			_ = json.Unmarshal(raw, &m)
		}
		out = append(out, map[string]string{"name": e.Name(), "description": m.Description})
	}
	return out, nil
}

// NewWorkspace copies root/repo into a temp dir and commits it as the base.
func NewWorkspace(ctx context.Context, root, repo string) (*Workspace, error) {
	if !validRepoName(repo) {
		return nil, fmt.Errorf("%w: invalid repository name", ErrInvalid)
	}
	src := filepath.Join(root, repo)
	if info, err := os.Stat(src); err != nil || !info.IsDir() {
		return nil, fmt.Errorf("%w: repository %q is not authorized", ErrInvalid, repo)
	}
	if _, err := exec.LookPath("git"); err != nil {
		return nil, noRetry(errors.New("git is not installed on the API host, so patches cannot be checked"))
	}
	dir, err := os.MkdirTemp("", "projectdesk-ws-*")
	if err != nil {
		return nil, err
	}
	ws := &Workspace{Dir: dir, Repo: repo}
	if err := copyTree(src, dir); err != nil {
		ws.Close()
		return nil, err
	}
	for _, args := range [][]string{
		{"init", "-q"},
		{"add", "-A"},
		{"-c", "user.email=desk@projectdesk.local", "-c", "user.name=Project Desk", "commit", "-q", "-m", "base", "--allow-empty"},
	} {
		if _, err := ws.git(ctx, args...); err != nil {
			ws.Close()
			return nil, err
		}
	}
	return ws, nil
}

func (w *Workspace) Close() { _ = os.RemoveAll(w.Dir) }

func (w *Workspace) git(ctx context.Context, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = w.Dir
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0", "GIT_CONFIG_NOSYSTEM=1", "HOME="+w.Dir)
	var out, stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return out.String(), fmt.Errorf("git %s: %s", args[0], strings.TrimSpace(stderr.String()))
	}
	return out.String(), nil
}

// Manifest reads .projectdesk.json from the workspace, if present.
func (w *Workspace) Manifest() (RepoManifest, bool) {
	var m RepoManifest
	raw, err := os.ReadFile(filepath.Join(w.Dir, manifestName))
	if err != nil {
		return m, false
	}
	return m, json.Unmarshal(raw, &m) == nil
}

// Snapshot renders the repository for a prompt: a file list plus the
// contents of small text files, capped so a large repo cannot blow the
// context window. Secrets-looking files are skipped.
func (w *Workspace) Snapshot(limit int) string {
	var b strings.Builder
	var files []string
	_ = filepath.WalkDir(w.Dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(w.Dir, path)
		if d.IsDir() {
			if rel == ".git" || rel == "node_modules" || rel == "vendor" {
				return filepath.SkipDir
			}
			return nil
		}
		files = append(files, rel)
		return nil
	})
	sort.Strings(files)
	b.WriteString("Files:\n")
	for _, f := range files {
		b.WriteString("- " + f + "\n")
	}
	b.WriteString("\n")
	for _, f := range files {
		lower := strings.ToLower(f)
		if strings.Contains(lower, ".env") || strings.Contains(lower, "secret") || strings.HasSuffix(lower, ".pem") || strings.HasSuffix(lower, ".key") {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(w.Dir, f))
		if err != nil || bytes.IndexByte(raw, 0) >= 0 || len(raw) > 16_000 {
			continue
		}
		if b.Len()+len(raw) > limit {
			break
		}
		fmt.Fprintf(&b, "=== %s ===\n%s\n\n", f, raw)
	}
	return b.String()
}

// PatchCheck is the result of validating a diff against the workspace.
type PatchCheck struct {
	Applies       bool     `json:"applies"`
	Files         []string `json:"files"`
	Error         string   `json:"error,omitempty"`
	Normalized    string   `json:"-"`
	TouchesPolicy []string `json:"touchesPolicy,omitempty"`
}

// CheckPatch verifies that a unified diff applies cleanly, applies it, and
// returns the normalized diff from git. It refuses diffs that touch the
// manifest, because the manifest controls what the sandbox runs.
func (w *Workspace) CheckPatch(ctx context.Context, diff string) (PatchCheck, error) {
	var check PatchCheck
	if strings.TrimSpace(diff) == "" {
		check.Error = "the diff is empty"
		return check, nil
	}
	if !strings.HasSuffix(diff, "\n") {
		diff += "\n"
	}
	// The patch file lives outside the workspace so it is never staged.
	patchFile, err := os.CreateTemp("", "projectdesk-*.patch")
	if err != nil {
		return check, err
	}
	patchPath := patchFile.Name()
	defer os.Remove(patchPath)
	if _, err := patchFile.WriteString(diff); err != nil {
		patchFile.Close()
		return check, err
	}
	patchFile.Close()
	if _, err := w.git(ctx, "apply", "--check", "--whitespace=nowarn", patchPath); err != nil {
		check.Error = err.Error()
		return check, nil
	}
	if _, err := w.git(ctx, "apply", "--whitespace=nowarn", patchPath); err != nil {
		check.Error = err.Error()
		return check, nil
	}
	status, err := w.git(ctx, "status", "--porcelain")
	if err != nil {
		return check, err
	}
	for _, line := range strings.Split(strings.TrimSpace(status), "\n") {
		if len(line) < 4 {
			continue
		}
		// Porcelain v1: two status columns, a space, then the path.
		name := strings.TrimSpace(line[2:])
		if i := strings.Index(name, " -> "); i >= 0 {
			name = name[i+4:]
		}
		check.Files = append(check.Files, name)
		if name == manifestName {
			check.TouchesPolicy = append(check.TouchesPolicy, name)
		}
	}
	if len(check.TouchesPolicy) > 0 {
		check.Error = "the diff changes " + strings.Join(check.TouchesPolicy, ", ") + ", which controls the sandbox and may not be edited by an agent"
		_, _ = w.git(ctx, "checkout", "--", ".")
		_, _ = w.git(ctx, "clean", "-fdq")
		return check, nil
	}
	if _, err := w.git(ctx, "add", "-A"); err != nil {
		return check, err
	}
	normalized, err := w.git(ctx, "diff", "--cached")
	if err != nil {
		return check, err
	}
	check.Applies = true
	check.Normalized = normalized
	return check, nil
}

// TestsWeakened flags diffs that delete assertions from test files. The
// repair loop must never pass by removing checks.
func TestsWeakened(diff string) []string {
	var hits []string
	file := ""
	for _, line := range strings.Split(diff, "\n") {
		if strings.HasPrefix(line, "+++ ") {
			file = strings.TrimPrefix(strings.TrimPrefix(line, "+++ "), "b/")
			continue
		}
		if !strings.HasPrefix(line, "-") || strings.HasPrefix(line, "---") {
			continue
		}
		lower := strings.ToLower(file)
		isTest := strings.Contains(lower, "test") || strings.Contains(lower, "spec") || strings.Contains(lower, "cypress") || strings.Contains(lower, "e2e")
		if !isTest {
			continue
		}
		body := strings.ToLower(line[1:])
		if strings.Contains(body, "expect(") || strings.Contains(body, "assert") || strings.Contains(body, "should(") || strings.Contains(body, "t.fatal") || strings.Contains(body, "t.error") {
			hits = append(hits, file+": "+strings.TrimSpace(line[1:]))
		}
	}
	return hits
}

// Runner executes a repository's test command somewhere other than the API
// host. The only implementation today is Docker; when it is missing the
// validation reports the tests as not run rather than pretending.
type Runner interface {
	Name() string
	Available() bool
	Run(ctx context.Context, ws *Workspace, image string, command []string, timeout time.Duration) (RunResult, error)
}

type RunResult struct {
	ExitCode int           `json:"exitCode"`
	Output   string        `json:"output"`
	Duration time.Duration `json:"-"`
	Seconds  float64       `json:"seconds"`
}

type DockerRunner struct{ Binary string }

func (d DockerRunner) Name() string { return "docker" }

func (d DockerRunner) Available() bool {
	bin := d.Binary
	if bin == "" {
		bin = "docker"
	}
	if _, err := exec.LookPath(bin); err != nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	return exec.CommandContext(ctx, bin, "version", "--format", "{{.Server.Version}}").Run() == nil
}

// Run mounts the workspace into a container with no network, limited CPU,
// memory, and pids, as a non-root user. Nothing from the repository is
// executed outside that container.
func (d DockerRunner) Run(ctx context.Context, ws *Workspace, image string, command []string, timeout time.Duration) (RunResult, error) {
	bin := d.Binary
	if bin == "" {
		bin = "docker"
	}
	if image == "" || len(command) == 0 {
		return RunResult{}, errors.New("the repository manifest has no test image or command")
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	args := []string{"run", "--rm", "--network", "none", "--memory", "512m", "--cpus", "1", "--pids-limit", "256",
		"--user", "1000:1000", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
		"-v", ws.Dir + ":/work", "-w", "/work", "-e", "HOME=/tmp", "-e", "CI=1", image}
	args = append(args, command...)
	cmd := exec.CommandContext(ctx, bin, args...)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	start := time.Now()
	err := cmd.Run()
	res := RunResult{Output: truncate(out.String(), 64_000), Duration: time.Since(start)}
	res.Seconds = res.Duration.Seconds()
	var exitErr *exec.ExitError
	switch {
	case errors.As(err, &exitErr):
		res.ExitCode = exitErr.ExitCode()
	case err != nil:
		if ctx.Err() != nil {
			res.Output += "\n[runner] timed out after " + timeout.String()
		}
		return res, err
	}
	return res, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "\n…[truncated]"
}

func copyTree(src, dst string) error {
	return filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(src, path)
		if rel == "." {
			return nil
		}
		if d.IsDir() {
			if d.Name() == ".git" || d.Name() == "node_modules" {
				return filepath.SkipDir
			}
			return os.MkdirAll(filepath.Join(dst, rel), 0o755)
		}
		if d.Type()&fs.ModeSymlink != 0 {
			return nil
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		info, _ := d.Info()
		mode := fs.FileMode(0o644)
		if info != nil && info.Mode()&0o111 != 0 {
			mode = 0o755
		}
		return os.WriteFile(filepath.Join(dst, rel), raw, mode)
	})
}
