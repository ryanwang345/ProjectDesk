# Project Desk

A small React desk for the projects you are actually working on. A Go API saves each card in Postgres. nginx serves the built page and forwards `/api` to Go.

The app lives in this folder. On this machine that path is `/workspace/project-desk`. On your own computer, `/Users/rwang/vail-projects/react-serve/project-desk` is where the clone puts it.

## Run it

Postgres needs a database named `projectdesk` owned by a user named `projectdesk` with the password `projectdesk`. The API listens on port `47292`.

```bash
cd server
go run ./cmd/server
```

In another terminal, from this folder:

```bash
npm install
npm run serve
```

`npm run serve` builds the app and starts nginx at [http://127.0.0.1:47291](http://127.0.0.1:47291).

- `/` is the desk
- `/about` explains how the app is served
- `/api/projects` is the Go API
- `/api/healthz` checks that Go can reach Postgres
- `/healthz` is nginx itself, and returns the text `ok`

For UI work with hot reload, keep the Go API running and use:

```bash
npm run dev
```

Vite listens on port `47311` and proxies `/api` to the Go server.

## Docker

This starts Postgres, the Go API, and nginx together. Go dependencies are vendored, so the API image does not download modules during the build:

```bash
docker compose up --build
```

The page is at [http://127.0.0.1:47291](http://127.0.0.1:47291). Postgres is published on port `54329`.

## Kubernetes

Helmfile installs the chart in `chart/` into the existing `rwang` namespace. `createNamespace` is false, so Helm does not try to create or patch that namespace. The chart runs Postgres with a 1Gi PersistentVolumeClaim, the Go API, and nginx. Jenkins publishes `docker.io/rwang345/project-desk-web` and `docker.io/rwang345/project-desk-api`. Create a pull secret before the first install so the namespace can pull those private images:

```bash
kubectl create secret docker-registry dockerhub -n rwang \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=rwang345 \
  --docker-password='<Docker Hub access token>'
helmfile apply
kubectl port-forward -n rwang svc/web 47291:80
```

The page is again at [http://127.0.0.1:47291](http://127.0.0.1:47291). The web Service is ClusterIP because the `rwang` namespace quota does not allow NodePorts. Query the cards with:

```bash
kubectl exec -n rwang deploy/postgres -- psql -U projectdesk -d projectdesk -c "SELECT name, status FROM projects;"
```

## Argo CD

Argo CD syncs the Helm chart in `chart/` from `main` into the `rwang` namespace. Install Argo CD, then apply the project and application in `argocd/`.

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f argocd/project.yaml
kubectl apply -f argocd/application.yaml
kubectl port-forward -n argocd svc/argocd-server 8080:443
```

The initial admin password is stored in `argocd-initial-admin-secret`:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

Sign in at `https://127.0.0.1:8080` as `admin`. The Project Desk application appears after Argo CD can clone the repository. The chart pulls `project-desk-web:latest` and `project-desk-api:latest` from Docker Hub, so the `dockerhub` pull secret must exist in the `rwang` namespace before the first sync.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 47311 |
| `npm run build` | Typecheck and write `dist/` |
| `npm run serve` | Build, then serve `dist/` with nginx on port 47291 |
| `npm run lint` | Run oxlint |
| `go run ./cmd/server` | Go API on port 47292, from the `server` directory |
| `go test ./...` | Run the Go tests, from the `server` directory |
