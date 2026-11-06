package desk

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const schema = `
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 280),
    status TEXT NOT NULL CHECK (status IN ('sketch', 'building', 'shipped')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`

type Project struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Note      string    `json:"note"`
	Status    string    `json:"status"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Input struct {
	Name   string
	Note   string
	Status string
}

var (
	ErrNotFound = errors.New("project not found")
	ErrInvalid  = errors.New("invalid project")
)

type Store struct {
	pool *pgxpool.Pool
}

func Connect(ctx context.Context, databaseURL string) (*Store, error) {
	var pool *pgxpool.Pool
	var err error
	for attempt := 1; attempt <= 30; attempt++ {
		pool, err = pgxpool.New(ctx, databaseURL)
		if err == nil {
			err = pool.Ping(ctx)
		}
		if err == nil {
			break
		}
		if pool != nil {
			pool.Close()
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(time.Second):
		}
	}
	if err != nil {
		return nil, err
	}
	if _, err := pool.Exec(ctx, schema); err != nil {
		pool.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	if _, err := pool.Exec(ctx, cycleSchema); err != nil {
		pool.Close()
		return nil, fmt.Errorf("migrate cycles: %w", err)
	}
	store := &Store{pool: pool}
	if err := migrate(ctx, store); err != nil {
		pool.Close()
		return nil, fmt.Errorf("migrate platform: %w", err)
	}
	return store, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) List(ctx context.Context) ([]Project, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, name, note, status, updated_at
		FROM projects
		ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	projects := []Project{}
	for rows.Next() {
		project, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}
	return projects, rows.Err()
}

func (s *Store) Create(ctx context.Context, input Input) (Project, error) {
	input = Normalize(input)
	if err := Validate(input); err != nil {
		return Project{}, err
	}
	row := s.pool.QueryRow(ctx, `
		INSERT INTO projects (name, note, status)
		VALUES ($1, $2, $3)
		RETURNING id::text, name, note, status, updated_at`,
		input.Name, input.Note, input.Status)
	return scanProject(row)
}

func (s *Store) Update(ctx context.Context, id string, input Input) (Project, error) {
	input = Normalize(input)
	if err := Validate(input); err != nil {
		return Project{}, err
	}
	row := s.pool.QueryRow(ctx, `
		UPDATE projects
		SET name = $2, note = $3, status = $4, updated_at = now()
		WHERE id = $1
		RETURNING id::text, name, note, status, updated_at`,
		id, input.Name, input.Note, input.Status)
	project, err := scanProject(row)
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return Project{}, ErrNotFound
	}
	return project, err
}

func (s *Store) Delete(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM projects WHERE id = $1`, id)
	if err != nil {
		if isInvalidUUID(err) {
			return ErrNotFound
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) Clear(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM projects`)
	return err
}

func (s *Store) ReplaceWithSamples(ctx context.Context) ([]Project, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM projects`); err != nil {
		return nil, err
	}
	samples := []struct {
		name   string
		note   string
		status string
		age    string
	}{
		{"Lift status board", "A quiet page for which lifts are spinning this morning.", "sketch", "50 hours"},
		{"Cabin week notes", "Who is bringing the chili, and which day we ski the back bowls.", "building", "5 hours"},
		{"Gear checkout", "A shared list so jackets stop living in three different cars.", "shipped", "12 days"},
	}
	for _, sample := range samples {
		if _, err := tx.Exec(ctx, `
			INSERT INTO projects (name, note, status, updated_at)
			VALUES ($1, $2, $3, now() - $4::interval)`,
			sample.name, sample.note, sample.status, sample.age); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.List(ctx)
}

func Validate(input Input) error {
	name := strings.TrimSpace(input.Name)
	note := strings.TrimSpace(input.Note)
	switch {
	case name == "":
		return fmt.Errorf("%w: enter a name", ErrInvalid)
	case len([]rune(name)) > 80:
		return fmt.Errorf("%w: keep the name under 80 characters", ErrInvalid)
	case len([]rune(note)) > 280:
		return fmt.Errorf("%w: keep the note under 280 characters", ErrInvalid)
	case input.Status != "sketch" && input.Status != "building" && input.Status != "shipped":
		return fmt.Errorf("%w: choose sketch, building, or shipped", ErrInvalid)
	default:
		return nil
	}
}

func Normalize(input Input) Input {
	return Input{
		Name:   strings.TrimSpace(input.Name),
		Note:   strings.TrimSpace(input.Note),
		Status: input.Status,
	}
}

type scanner interface {
	Scan(dest ...any) error
}

func scanProject(row scanner) (Project, error) {
	var project Project
	err := row.Scan(&project.ID, &project.Name, &project.Note, &project.Status, &project.UpdatedAt)
	return project, err
}

func isInvalidUUID(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "22P02"
}
