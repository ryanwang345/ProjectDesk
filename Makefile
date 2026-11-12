.PHONY: help dev dev-down build build-web build-api test test-api test-e2e lint clean

help:
	@echo "ProjectDesk Monorepo Commands:"
	@echo "  make dev         - Start full stack locally via Docker Compose (Postgres + API + Web)"
	@echo "  make dev-down    - Stop and teardown local Docker Compose stack"
	@echo "  make build       - Build all applications (Web + Go API)"
	@echo "  make build-web   - Build React web frontend"
	@echo "  make build-api   - Build Go backend API binary"
	@echo "  make test        - Run all tests (Go API unit tests + E2E typechecks)"
	@echo "  make test-api    - Run Go API unit tests"
	@echo "  make test-e2e    - Run Cypress E2E typecheck"
	@echo "  make lint        - Lint web frontend code"
	@echo "  make clean       - Remove build artifacts and node_modules"

dev:
	docker compose -f deploy/docker-compose.yml up --build

dev-down:
	docker compose -f deploy/docker-compose.yml down -v

build: build-web build-api

build-web:
	npm run build:web

build-api:
	cd apps/api && go build -v -o bin/server ./cmd/server

test: test-api test-e2e

test-api:
	cd apps/api && go test -mod=vendor ./...

test-e2e:
	npm run test:e2e

lint:
	npm run lint:web

clean:
	npm run clean
	rm -rf apps/api/bin
