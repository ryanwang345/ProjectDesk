# ProjectDesk Monorepo

An enterprise full-stack monorepo featuring a React 19 frontend, Go 1.22 REST API, Cypress E2E testing, and Kubernetes GitOps (ArgoCD + Jenkins CI/CD + Cloudflare Zero Trust).

---

## 📁 Repository Architecture

```text
ProjectDesk/
├── apps/                                  # Deployable applications & services
│   ├── web/                               # React 19 + Vite + Tailwind CSS SPA
│   │   ├── src/                           # Frontend source code
│   │   ├── nginx/                         # Production Nginx reverse-proxy
│   │   ├── Dockerfile                     # Multi-stage container build
│   │   └── package.json                   # Workspace: apps/web
│   │
│   ├── api/                               # Go 1.22 backend RESTful API
│   │   ├── cmd/server/                    # Application entry point
│   │   ├── internal/                      # Core business logic & storage
│   │   ├── Dockerfile                     # Alpine-based minimal API container
│   │   └── go.mod                         # Go module definition
│   │
│   └── e2e/                               # Cypress E2E automated test suite
│       ├── cypress/                       # E2E test specs & fixtures
│       ├── Dockerfile                     # Cypress runner container
│       └── package.json                   # Workspace: apps/e2e
│
├── deploy/                                # Cloud-native & GitOps delivery assets
│   ├── helm/                              # Production Helm chart (values-*.yaml)
│   ├── argocd/                            # Declarative ArgoCD Applications & Ingress
│   └── docker-compose.yml                 # Local development full-stack orchestration
│
├── docs/                                  # Project documentation & design specs
├── Jenkinsfile                            # Polyglot monorepo CI/CD with incremental change detection
├── Makefile                               # Unified developer commands
└── package.json                           # Root npm workspaces configuration
```

---

## 🚀 Quick Start (Local Development)

### 1. Start Full Stack via Docker Compose
Run Postgres, API, and Web with the existing homelab Keycloak:
```bash
make dev
# Or: docker compose up --build
```
- **Web App**: [http://localhost:47291](http://localhost:47291)
- **API Server**: [http://localhost:47292](http://localhost:47292)
- **Postgres DB**: `localhost:54329`
- **Keycloak**: [https://keycloak.ryanwang.dev](https://keycloak.ryanwang.dev)

Sign-in uses the **homelab** realm. Import the public `projectdesk-web` client
from [Keycloak setup](docs/keycloak.md) into that realm before signing in.

The vocabulary Diagnostic Lab uses **self-hosted LanguageTool 6.6** for
rule-based US English grammar, spelling, and punctuation checks, and the
**Tatoeba API** for existing examples from CK's proofread English list (907).
Examples retain their author, source link, and text license. Related word forms
are excluded from the results. Neither feature calls an AI provider or needs an
API key. Opening a vocabulary card no longer automatically generates AI notes
or dictionary senses. Existing saved notes remain available. Startup AI
pronunciation enrichment is also off by default; it requires an explicit
`PROJECT_DESK_FILL_PRONUNCIATIONS=1` opt-in.

Compose starts the `languagetool` service automatically. Its initial build
downloads the official open-source distribution (about 250 MB). If you run the
Go API outside Compose, start LanguageTool first:

```bash
docker compose up -d --build languagetool
```

The API defaults to `http://127.0.0.1:8081`. Set
`PROJECT_DESK_LANGUAGETOOL_URL` to another **self-hosted** LanguageTool base URL
when needed (without `/v2/check`). Do not point it at LanguageTool's public/cloud
service if you require checks without AI rules. No language-identification model
is needed because requests explicitly select `en-US`.

The checker returns individual suggestions for the learner to accept and
recheck. It does not assign IELTS scores or generate rewrites. A service outage
shows an error rather than reporting a successful check; an empty example
search does not generate substitute sentences. Vocabulary-card audio uses
recordings or device speech, with the AI audio fallback disabled. Other app
features retain their existing provider settings.

```bash
# Use a Keycloak access token for the projectdesk-api audience.
curl http://localhost:47292/api/english/evaluate \
  -H "Authorization: Bearer $PROJECT_DESK_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"word":"school","sentence":"She go to school every day."}'
curl 'http://localhost:47292/api/english/examples?word=additional' \
  -H "Authorization: Bearer $PROJECT_DESK_ACCESS_TOKEN"
```

Stop stack:
```bash
make dev-down
```

### Page visibility settings

Open `/settings` to enable or disable individual navigation pages. Choices are
saved in this browser under `projectdesk.features.v1` and synchronized across
open tabs. Disabled pages are hidden from desktop/mobile navigation and blocked
by a route guard before their contents load, including English query-string tabs
and aliases such as `/board` and `/vocabulary`. Settings remains available even
when every optional page is disabled. These are personal browser preferences;
they do not change server API permissions or other users' settings.

---

## 🛠️ Developer Commands

| Command | Description |
| :--- | :--- |
| `make dev` | Start Postgres, Go API, and Web frontend locally via Docker Compose; use the existing Keycloak |
| `make dev-down` | Stop local Docker Compose environment |
| `make build` | Build all components (`apps/web` and `apps/api`) |
| `make build-web` | Build React frontend bundle |
| `make build-api` | Compile Go API backend binary |
| `make test` | Run Go API tests and Cypress E2E typechecks |
| `make test-api` | Run Go unit & integration tests (`go test -mod=vendor ./...`) |
| `make test-e2e` | Run Cypress test typechecks |
| `make lint` | Run web linter (`oxlint`) |
| `make clean` | Remove build artifacts, binaries, and node_modules |

---

## 🔄 CI/CD & GitOps Workflow

- **CI Pipeline (`Jenkinsfile`)**: Runs on Kubernetes agents using Pod templates. Features **intelligent path-based change detection** — only builds and pushes Docker images for services that actually changed in Git.
- **Image builds**: A pinned rootless BuildKit container builds and pushes the selected web, API, and E2E images. Changes to `Jenkinsfile` rebuild all components. See [CI image builds](docs/ci-image-builds.md) for runner requirements and verification.
- **GitOps (`ArgoCD`)**: Continuously reconciles cluster state from `deploy/helm` with automated self-healing.
- **Cloudflare Zero Trust**: Exposes Ingress securely to public domain (`www.ryanwang.dev`) via `cloudflared`.
