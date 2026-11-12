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
Run Postgres, API, and Web all in one command:
```bash
make dev
# Or: docker compose up --build
```
- **Web App**: [http://localhost:47291](http://localhost:47291)
- **API Server**: [http://localhost:47292](http://localhost:47292)
- **Postgres DB**: `localhost:54329`

Stop stack:
```bash
make dev-down
```

---

## 🛠️ Developer Commands

| Command | Description |
| :--- | :--- |
| `make dev` | Start Postgres, Go API, and Web frontend locally via Docker Compose |
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
- **GitOps (`ArgoCD`)**: Continuously reconciles cluster state from `deploy/helm` with automated self-healing.
- **Cloudflare Zero Trust**: Exposes Ingress securely to public domain (`www.ryanwang.dev`) via `cloudflared`.
