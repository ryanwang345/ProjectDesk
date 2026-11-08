package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"projectdesk/internal/desk"
)

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://projectdesk:projectdesk@127.0.0.1:5432/projectdesk?sslmode=disable"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "47292"
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	store, err := desk.Connect(ctx, databaseURL)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer store.Close()

	platform := &desk.Platform{
		Store:           store,
		Sealer:          desk.NewSealer(os.Getenv("PROJECT_DESK_SECRET_KEY")),
		ReposRoot:       envOr("PROJECT_DESK_REPOS", "./samples"),
		MaxJobsPerCycle: envInt("PROJECT_DESK_MAX_JOBS_PER_CYCLE", 40),
		MaxRepairs:      envInt("PROJECT_DESK_MAX_REPAIRS", 2),
		TestTimeout:     time.Duration(envInt("PROJECT_DESK_TEST_TIMEOUT_SECONDS", 300)) * time.Second,
		AdminToken:      os.Getenv("PROJECT_DESK_ADMIN_TOKEN"),
	}
	if os.Getenv("PROJECT_DESK_RUNNER") != "none" {
		platform.Runner = desk.DockerRunner{Binary: os.Getenv("PROJECT_DESK_DOCKER")}
	}
	if !platform.Sealer.Enabled() {
		log.Printf("PROJECT_DESK_SECRET_KEY is not set: provider API keys cannot be stored (Ollama and demo providers still work)")
	}

	// The worker runs in-process by default. PROJECT_DESK_WORKER=0 turns it
	// off for API-only replicas; a dedicated worker replica can run with
	// PROJECT_DESK_WORKER_ONLY=1.
	workerCtx, cancelWorker := context.WithCancel(ctx)
	defer cancelWorker()
	workerDone := make(chan struct{})
	if os.Getenv("PROJECT_DESK_WORKER") != "0" {
		worker := desk.NewWorker(store, envInt("PROJECT_DESK_WORKER_CONCURRENCY", 2), platform.Executors())
		go func() {
			defer close(workerDone)
			worker.Run(workerCtx)
		}()
		log.Printf("ai worker started (concurrency %d, repos %s)", envInt("PROJECT_DESK_WORKER_CONCURRENCY", 2), platform.ReposRoot)
	} else {
		close(workerDone)
	}

	go func() {
		store.WritePronunciations(ctx, platform.Sealer)
		store.WriteSenses(ctx, platform.Sealer)
	}()

	if os.Getenv("PROJECT_DESK_WORKER_ONLY") == "1" {
		<-ctx.Done()
		cancelWorker()
		<-workerDone
		return
	}

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           desk.NewHandler(store, platform),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	log.Printf("project desk api listening on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
	cancelWorker()
	select {
	case <-workerDone:
	case <-time.After(30 * time.Second):
		log.Printf("worker did not stop in time; in-flight jobs will be recovered on restart")
	}
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v, err := strconv.Atoi(os.Getenv(key)); err == nil && v > 0 {
		return v
	}
	return def
}
