package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
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

	ctx := context.Background()
	store, err := desk.Connect(ctx, databaseURL)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer store.Close()

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           desk.NewHandler(store),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("project desk api listening on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
