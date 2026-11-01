# Project Desk — AI-native engineering loop

This document describes the AI platform layered onto Project Desk: how it is built, how to run it locally and in production, what it protects against, and what is still to be done. The product surface stayed the same (desk, loop ring, cream background, green buttons); the AI platform adds a panel under each cycle plus three pages.

## 1. What it does

A cycle on `/loop` can be carried through the four stages by agents, with a person approving every step:

| Stage | Agent step | What a person sees | Approval |
| --- | --- | --- | --- |
| Discover | **Analyze with AI** | Hypotheses (labeled, with confidence and the evidence that would confirm them), missing information, a proposed score with rationale, an opportunity, acceptance criteria | Approve (optionally apply score / use top hypothesis as root cause) or reject. User-entered data is never replaced without ticking the box. |
| Deliver | **Generate specification** → **Generate implementation plan** → **Generate patch** | SPEC and PLAN as versioned, editable artifacts; the patch as a git diff checked in an isolated workspace | Each artifact is approved or rejected; a rejected one can be regenerated as the next version. |
| Validate | **Run validation** | Gates: *patch applies*, *tests not weakened*, *tests* (run in a sandbox container, or reported `not_run`). QA agent explains failures and may propose a bounded repair as a new patch version. | Blocked cycles stay blocked. A person can record an override with a reason only when no gate failed. |
| Rediscover | **Mark deployed** → **Evaluate outcome** | Solved / regressions / evidence, lessons, an optional follow-up proposal | Approving writes lessons to the knowledge base and opens one deduplicated follow-up cycle. |

Everything above is a job in Postgres executed by a worker inside the Go API. Closing the tab does not stop it; restarting the API requeues anything that was cut off.

## 2. Architecture

```
React (Vite / nginx)  ──/api──▶  Go API (net/http)
                                   ├── desk + loop handlers           (unchanged)
                                   ├── platform handlers              internal/desk/platform_http.go
                                   ├── Worker  (N goroutines)         internal/desk/jobs.go
                                   │     └── executors                internal/desk/agents.go
                                   │           ├── prompts            internal/desk/prompts.go
                                   │           ├── AI gateway         internal/ai/
                                   │           └── workspace/sandbox  internal/desk/sandbox.go
                                   └── Postgres (pgx)                  migrations in internal/desk/migrate.go
```

### AI gateway (`server/internal/ai`)

One `Provider` interface (`Kind`, `Capabilities`, `Models`, `Generate`) with five adapters:

| Kind | Covers | Key |
| --- | --- | --- |
| `openai` | OpenAI, and any `/v1/chat/completions` endpoint: DeepSeek, xAI, vLLM, Azure OpenAI (use the deployment URL as the endpoint) | yes |
| `gemini` | Google Gemini through `https://generativelanguage.googleapis.com/v1beta/openai`. Use a key from [Google AI Studio](https://aistudio.google.com/apikey). The free tier has a daily limit. | yes |
| `anthropic` | Claude via the Messages API | yes |
| `ollama` | A local Ollama server | no |
| `demo` | Deterministic offline replies. Every response is `Simulated: true`; the UI labels it. It never inspects code and is never presented as real analysis. | no |

`GenerateJSON` asks for a JSON object, falls back to extracting the first balanced object from free text for providers without JSON mode, and the caller validates the shape (`AnalysisContent.Validate`, etc.). Invalid replies fail the job with a message instead of being stored.

Adding a provider: implement `Provider` in a new file, register it in `ai.New`, add the kind to `ai.Kinds`, and extend the `providers.kind` CHECK constraint in a new migration.

### Persistence (migration 1)

`providers` (API key as AES-256-GCM bytes), `agent_assignments` (role → provider/model), `jobs`, `analyses`, `artifacts` (kind, version, status, content, data), `events` (audit), `knowledge_entries`, plus three columns on `cycles`: `workflow_state`, `origin_cycle_id`, `repo`. Migrations are additive, run at startup inside one transaction each, and are recorded in `schema_migrations`. Existing projects and cycles are untouched; existing cycles start in `PENDING`.

### State machine

```
PENDING ─▶ ANALYZING ─▶ AWAITING_APPROVAL ─▶ PLANNING ─▶ AWAITING_APPROVAL ─▶ IMPLEMENTING ─▶ AWAITING_APPROVAL
   ▲                                             (spec, plan)                                   (patch)
   │                                                                                               │
CANCELLED / FAILED ◀── any ──                                                                 TESTING ─▶ BLOCKED ──(override, no failed gate)──▶ READY_FOR_DEPLOYMENT
                                                                                                  │                                                  │
                                                                                                  └─────────────── all gates pass ──────────────────▶ │
                                                                                                                                                     ▼
                                                                                        COMPLETED ◀── AWAITING_APPROVAL ◀── MONITORING ◀── DEPLOYED
                                                                                                      (outcome)
```

`REVIEWING` exists in the schema and transitions for the planned review agent but nothing enters it yet. `StageFor` maps states onto the four stages so the ring highlights the right quarter; `AWAITING_APPROVAL`, `BLOCKED`, `FAILED`, and `CANCELLED` keep the cycle's current stage. Transitions are checked in `desk.Transition`; the table is `allowed` in `workflow.go` and `TestStateMachine` covers it.

### Worker

- Claim: `UPDATE … FROM (SELECT … FOR UPDATE SKIP LOCKED LIMIT 1)` so several API replicas can share one queue.
- Per-job timeout (`timeout_seconds`, default 180) via context; the stale sweep requeues jobs whose worker vanished (`locked_at` older than timeout + 30 s) until `max_attempts` (3).
- Retry backoff `5·attempts²` seconds. Failures that will not change on retry (missing provider, invalid model reply, patch does not apply) are marked `errNoRetry` and fail immediately; the cycle moves to `FAILED` with the reason in the audit log.
- Idempotency: one in-flight job per (cycle, kind) — a second click returns 409. Budget: `PROJECT_DESK_MAX_JOBS_PER_CYCLE` total jobs per cycle.
- Cancellation: queued jobs cancel immediately; running jobs get `cancel_requested` and the result is discarded when they finish.
- Every state change, approval, job start/finish, and override is a row in `events`.

### Workspace and sandbox

The coding agent never touches a real checkout. `NewWorkspace` copies `PROJECT_DESK_REPOS/<repo>` into a temp dir, `git init`s it, and the proposed diff goes through `git apply --check` then `git apply`; the normalized `git diff --cached` is what gets stored and shown. Diffs that touch `.projectdesk.json` are refused because that file decides what the sandbox runs. `TestsWeakened` rejects diffs that delete assertions from test files, both for the original patch and for repairs.

Tests run through a `Runner`. The only implementation is `DockerRunner`: `docker run --rm --network none --memory 512m --cpus 1 --pids-limit 256 --user 1000:1000 --cap-drop ALL --security-opt no-new-privileges -v <workspace>:/work <image> <command>` using the image and command from the repository's `.projectdesk.json`. When Docker is not reachable the *tests* gate is `not_run`, the validation is `blocked`, and the cycle waits for a person. Nothing from a repository is ever executed on the API host.

## 3. HTTP API

Existing routes are unchanged. New:

| Method and path | Purpose |
| --- | --- |
| `GET /api/readyz` | Postgres reachable and migrations complete |
| `GET /api/platform` | Capabilities: key storage, runner, repos, limits, state list |
| `GET /api/repos` | Authorized repositories |
| `GET/POST /api/providers`, `PATCH/DELETE /api/providers/{id}` | Providers (keys write-only; responses carry `hasKey`) |
| `POST /api/providers/test` | Test a stored (`id`) or unsaved provider |
| `GET /api/providers/{id}/models`, `GET /api/providers/kinds` | Model list; adapter capabilities and compatible endpoints |
| `GET /api/agents`, `PUT /api/agents/{role}` | Role → provider/model |
| `GET /api/cycles/{id}/workflow` | Cycle + analyses + artifacts + jobs + events + allowed actions |
| `POST /api/cycles/{id}/{analyze,specification,plan,patch,validate,outcome}` | Queue a step (202 with the job; 409 when not allowed) |
| `POST /api/cycles/{id}/analyses/{aid}/decision` | `{decision, applyScore, applyFinding}` |
| `PATCH /api/cycles/{id}/artifacts/{aid}`, `POST …/decision` | Edit a proposed SPEC/PLAN; approve/reject any artifact |
| `POST /api/cycles/{id}/validation/override` | Recorded human override (reason ≥ 10 chars, refused if a gate failed) |
| `POST /api/cycles/{id}/deployed`, `/cancel`, `/reset` | Human-driven transitions |
| `GET /api/jobs`, `POST /api/jobs/{id}/cancel`, `GET /api/events`, `GET /api/usage` | Execution history, cancellation, audit, token totals |
| `GET/POST /api/knowledge` | Search (`?q=`) and add lessons |

Provider and agent mutations require `Authorization: Bearer <PROJECT_DESK_ADMIN_TOKEN>` when that variable is set. The settings page keeps the token in session storage only.

## 4. Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | local projectdesk DSN | Postgres |
| `PORT` | `47292` | API port |
| `PROJECT_DESK_SECRET_KEY` | unset | Required to store OpenAI/Anthropic keys. Key derived with SHA-256; rotating it means re-entering provider keys. |
| `PROJECT_DESK_ADMIN_TOKEN` | unset | When set, protects provider/agent changes |
| `PROJECT_DESK_REPOS` | `./samples` (image: `/repos`) | Root of authorized repositories, one directory each |
| `PROJECT_DESK_RUNNER` | docker | `none` disables the sandbox runner |
| `PROJECT_DESK_DOCKER` | `docker` | Docker binary |
| `PROJECT_DESK_WORKER` | on | `0` runs an API-only replica |
| `PROJECT_DESK_WORKER_ONLY` | off | `1` runs a worker without the HTTP server |
| `PROJECT_DESK_WORKER_CONCURRENCY` | `2` | Goroutines claiming jobs |
| `PROJECT_DESK_MAX_JOBS_PER_CYCLE` | `40` | AI execution budget per cycle |
| `PROJECT_DESK_MAX_REPAIRS` | `2` | Automatic repair proposals per cycle |
| `PROJECT_DESK_TEST_TIMEOUT_SECONDS` | `300` | One sandbox test run |

## 5. Running it

### Local development

```bash
cd server
PROJECT_DESK_SECRET_KEY=dev-only go run ./cmd/server     # API + worker, migrations run on start
cd .. && npm run dev                                       # Vite on 47311, proxies /api
```

Open `/ai/settings`, add a provider. With Docker running locally the *tests* gate executes for real against `server/samples/sample-shop` (`node test.mjs` in `node:22-alpine`).

Gemini: kind `gemini`, endpoint `https://generativelanguage.googleapis.com/v1beta/openai` (filled in by the form), model e.g. `gemini-3.5-flash-lite`, and a Google AI Studio key.

Ollama: kind `ollama`, endpoint `http://127.0.0.1:11434`, model e.g. `llama3.1`; no key. Pull the model first (`ollama pull llama3.1`). Small models may return malformed JSON; the job then fails with "the model reply was incomplete" and can be rerun.

### Docker Compose

`docker compose up --build`. `PROJECT_DESK_SECRET_KEY` and `PROJECT_DESK_ADMIN_TOKEN` are read from your shell. The API container has no Docker daemon, so the runner is `none`.

### Kubernetes (Helm chart)

```bash
kubectl -n rwang create secret generic project-desk-ai \
  --from-literal=PROJECT_DESK_SECRET_KEY="$(openssl rand -hex 32)" \
  --from-literal=PROJECT_DESK_ADMIN_TOKEN="$(openssl rand -hex 24)"
helmfile apply   # with api.ai.existingSecret: project-desk-ai in values
```

Readiness is `/api/readyz` (waits for migrations), liveness `/api/healthz`. `terminationGracePeriodSeconds` is 45 so a rolling restart lets in-flight jobs finish; anything cut off is requeued by the stale sweep. The image ships the sample repository at `/repos`; mount a volume there for real repositories. The sandbox runner is `none` in the cluster: the pod does not have a Docker daemon, and mounting the node's socket would defeat the isolation. Running tests in Kubernetes needs the Job-based runner listed under next tasks.

### Migrations and rollback

Migrations are forward-only and additive. To roll back the application, deploy the previous image: the old code ignores the new tables and columns (`cycles` gained three columns with defaults). Dropping the AI tables is a manual, deliberate step:

```sql
DROP TABLE knowledge_entries, events, artifacts, analyses, jobs, agent_assignments, providers;
ALTER TABLE cycles DROP COLUMN workflow_state, DROP COLUMN origin_cycle_id, DROP COLUMN repo;
DELETE FROM schema_migrations WHERE version = 1;
```

Only do this after exporting `artifacts` and `knowledge_entries` if their content matters. Provider keys are unrecoverable without the secret key, by design.

## 6. Security

- Provider API keys are encrypted with AES-256-GCM before they reach Postgres; the API never returns them (`hasKey` only) and the frontend never holds them.
- `Redact` strips bearer tokens, `sk-`, `github_pat_`, `dckr_pat_`, and `key=value` secrets from error text before it is logged, stored on a job, or written to an event.
- Prompts mark everything that came from the signal, artifacts, test output, or the repository as untrusted (`<signal>…</signal>` and friends) and tell the model not to follow instructions found there.
- Agents work on a temp copy; the repository name is a single path segment validated against `[A-Za-z0-9._-]`, so it cannot escape `PROJECT_DESK_REPOS`.
- Repository tests only run inside a no-network, capability-dropped, non-root container with memory, CPU, and pid limits. Without Docker, they do not run and the cycle blocks.
- Diffs cannot edit `.projectdesk.json` and cannot delete test assertions; repair proposals are capped (`PROJECT_DESK_MAX_REPAIRS`) and still need human approval.
- No agent deploys anything. `Mark deployed` is a button a person presses after their own pipeline ran.
- Demo mode is a provider kind; every reply is `Simulated`, and the UI shows the badge on analyses, artifacts, runs, knowledge tags, and the provider card.
- Settings mutations can be gated by `PROJECT_DESK_ADMIN_TOKEN`. The rest of the API follows the existing open model of the desk; put it behind your usual ingress auth.

## 7. Tests

- Go: `cd server && go test -mod=vendor ./...` — gateway JSON extraction, demo adapter, state machine, sealer, redaction, test-weakening detection, repo name validation, and a real `git apply` round-trip of the demo patch against `samples/sample-shop` (skips without git).
- Cypress: `e2e/cypress/e2e/ai-loop.cy.ts` creates a demo provider, runs Analyze → approve → Generate specification → approve through the UI, checks the audit log, and verifies the settings page and that no API key is ever returned. Pass `E2E_ADMIN_TOKEN` when the target requires it.
- Manual end-to-end (done during development against a scratch database): a cycle went PENDING → … → COMPLETED with one lesson written and all 39 audit events recorded; the gates correctly blocked on `tests: not_run` without Docker and the override path was exercised.

## 8. Next tasks, in priority order

1. **Kubernetes Job runner.** Implement `Runner` as a Kubernetes Job (workspace shipped as a tarball in a ConfigMap or object storage, `restrictedPodSecurity`, no network policy egress) so validation executes tests in the cluster instead of reporting `not_run`.
2. **Push approved patches to a branch and open a merge request.** Today the diff stays an artifact. Add a `git` integration (token stored like provider keys) that pushes `projectdesk/<cycle>` and opens a PR; protected branches remain manual.
3. **Review agent and `REVIEWING` state.** A second model reviews the approved patch for security and scope before `TESTING`; disagreement blocks.
4. **Integrations page and MCP tool registry.** Register tools (repository, CI status, monitoring) with scopes and audit; expose them to agents through the gateway's `Tools` capability.
5. **Monitoring-backed outcomes.** Pull metrics for the Rediscover step from a configured source instead of the cycle's hand-entered numbers.
6. **Streaming.** Surface token streaming in the panel for providers that support it (adapter capability already exposed).
7. **Per-provider spend limits.** Token totals exist per job and globally; add per-provider monthly caps with a hard stop.
8. **Agent role defaults in the chart.** Seed a provider and role assignments from values for fresh environments.
