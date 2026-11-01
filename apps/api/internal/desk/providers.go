package desk

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"projectdesk/internal/ai"
)

// ProviderRecord is what the API returns. The key never leaves the server;
// HasKey tells the settings page whether one is stored.
type ProviderRecord struct {
	ID           string          `json:"id"`
	Name         string          `json:"name"`
	Kind         ai.Kind         `json:"kind"`
	BaseURL      string          `json:"baseUrl"`
	Model        string          `json:"model"`
	HasKey       bool            `json:"hasKey"`
	IsDefault    bool            `json:"isDefault"`
	Capabilities ai.Capabilities `json:"capabilities"`
	CreatedAt    time.Time       `json:"createdAt"`
	UpdatedAt    time.Time       `json:"updatedAt"`
}

type ProviderInput struct {
	Name      string
	Kind      ai.Kind
	BaseURL   string
	Model     string
	APIKey    *string // nil keeps the stored key; empty string clears it
	IsDefault bool
}

// AgentRoles are the orchestration roles that can be bound to a provider.
var AgentRoles = []string{"discovery", "product", "architecture", "development", "qa", "devops", "review", "knowledge"}

// jobRole maps a job kind to the agent role that runs it.
var jobRole = map[string]string{
	"analyze":       "discovery",
	"specification": "product",
	"plan":          "architecture",
	"patch":         "development",
	"validate":      "qa",
	"outcome":       "knowledge",
}

type Assignment struct {
	Role       string  `json:"role"`
	ProviderID *string `json:"providerId"`
	Model      string  `json:"model"`
}

const providerColumns = `id::text, name, kind, base_url, model, api_key IS NOT NULL AND length(api_key) > 0, is_default, created_at, updated_at`

func validateProvider(in ProviderInput) error {
	in.Name = strings.TrimSpace(in.Name)
	known := false
	for _, k := range ai.Kinds {
		if k == in.Kind {
			known = true
		}
	}
	switch {
	case in.Name == "":
		return fmt.Errorf("%w: enter a provider name", ErrInvalid)
	case len([]rune(in.Name)) > 80:
		return fmt.Errorf("%w: keep the provider name under 80 characters", ErrInvalid)
	case !known:
		return fmt.Errorf("%w: choose openai, gemini, anthropic, ollama, or demo", ErrInvalid)
	case in.Kind != ai.KindDemo && strings.TrimSpace(in.Model) == "":
		return fmt.Errorf("%w: enter a model name", ErrInvalid)
	case in.BaseURL != "" && !strings.HasPrefix(in.BaseURL, "http://") && !strings.HasPrefix(in.BaseURL, "https://"):
		return fmt.Errorf("%w: the endpoint must start with http:// or https://", ErrInvalid)
	}
	return nil
}

func (s *Store) ListProviders(ctx context.Context) ([]ProviderRecord, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+providerColumns+` FROM providers ORDER BY is_default DESC, created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ProviderRecord{}
	for rows.Next() {
		rec, err := scanProvider(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, rec)
	}
	return out, rows.Err()
}

func (s *Store) GetProvider(ctx context.Context, id string) (ProviderRecord, error) {
	rec, err := scanProvider(s.pool.QueryRow(ctx, `SELECT `+providerColumns+` FROM providers WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return ProviderRecord{}, ErrNotFound
	}
	return rec, err
}

func (s *Store) CreateProvider(ctx context.Context, in ProviderInput, sealer *Sealer) (ProviderRecord, error) {
	if err := validateProvider(in); err != nil {
		return ProviderRecord{}, err
	}
	var key []byte
	if in.APIKey != nil && *in.APIKey != "" {
		sealed, err := sealer.Seal(*in.APIKey)
		if err != nil {
			return ProviderRecord{}, fmt.Errorf("%w: %v", ErrInvalid, err)
		}
		key = sealed
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ProviderRecord{}, err
	}
	defer tx.Rollback(ctx)
	var count int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM providers`).Scan(&count); err != nil {
		return ProviderRecord{}, err
	}
	isDefault := in.IsDefault || count == 0
	if isDefault {
		if _, err := tx.Exec(ctx, `UPDATE providers SET is_default = false WHERE is_default`); err != nil {
			return ProviderRecord{}, err
		}
	}
	rec, err := scanProvider(tx.QueryRow(ctx, `
		INSERT INTO providers (name, kind, base_url, model, api_key, is_default)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+providerColumns,
		strings.TrimSpace(in.Name), in.Kind, strings.TrimSpace(in.BaseURL), strings.TrimSpace(in.Model), key, isDefault))
	if err != nil {
		return ProviderRecord{}, err
	}
	return rec, tx.Commit(ctx)
}

func (s *Store) UpdateProvider(ctx context.Context, id string, in ProviderInput, sealer *Sealer) (ProviderRecord, error) {
	if err := validateProvider(in); err != nil {
		return ProviderRecord{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ProviderRecord{}, err
	}
	defer tx.Rollback(ctx)
	if in.IsDefault {
		if _, err := tx.Exec(ctx, `UPDATE providers SET is_default = false WHERE is_default AND id <> $1`, id); err != nil {
			if isInvalidUUID(err) {
				return ProviderRecord{}, ErrNotFound
			}
			return ProviderRecord{}, err
		}
	}
	query := `UPDATE providers SET name = $2, kind = $3, base_url = $4, model = $5, is_default = $6, updated_at = now()`
	args := []any{id, strings.TrimSpace(in.Name), in.Kind, strings.TrimSpace(in.BaseURL), strings.TrimSpace(in.Model), in.IsDefault}
	if in.APIKey != nil {
		var key []byte
		if *in.APIKey != "" {
			sealed, err := sealer.Seal(*in.APIKey)
			if err != nil {
				return ProviderRecord{}, fmt.Errorf("%w: %v", ErrInvalid, err)
			}
			key = sealed
		}
		query += `, api_key = $7`
		args = append(args, key)
	}
	rec, err := scanProvider(tx.QueryRow(ctx, query+` WHERE id = $1 RETURNING `+providerColumns, args...))
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return ProviderRecord{}, ErrNotFound
	}
	if err != nil {
		return ProviderRecord{}, err
	}
	return rec, tx.Commit(ctx)
}

func (s *Store) DeleteProvider(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM providers WHERE id = $1`, id)
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

// OpenProvider builds the adapter for a stored provider, decrypting its key.
// Returns the record too, so callers can label output with name and model.
func (s *Store) OpenProvider(ctx context.Context, id string, sealer *Sealer) (ai.Provider, ProviderRecord, error) {
	var rec ProviderRecord
	var sealed []byte
	err := s.pool.QueryRow(ctx, `SELECT `+providerColumns+`, api_key FROM providers WHERE id = $1`, id).Scan(
		&rec.ID, &rec.Name, &rec.Kind, &rec.BaseURL, &rec.Model, &rec.HasKey, &rec.IsDefault, &rec.CreatedAt, &rec.UpdatedAt, &sealed)
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return nil, rec, ErrNotFound
	}
	if err != nil {
		return nil, rec, err
	}
	key, err := sealer.Open(sealed)
	if err != nil {
		return nil, rec, err
	}
	p, err := ai.New(ai.Config{Kind: rec.Kind, BaseURL: rec.BaseURL, Model: rec.Model, APIKey: key})
	if err != nil {
		return nil, rec, err
	}
	rec.Capabilities = p.Capabilities()
	return p, rec, nil
}

// ProviderForRole resolves the provider an agent role should use: its
// assignment first, then the default provider.
func (s *Store) ProviderForRole(ctx context.Context, role string, sealer *Sealer) (ai.Provider, ProviderRecord, error) {
	var id *string
	var model string
	err := s.pool.QueryRow(ctx, `SELECT provider_id::text, model FROM agent_assignments WHERE role = $1`, role).Scan(&id, &model)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, ProviderRecord{}, err
	}
	if id == nil {
		var def string
		err := s.pool.QueryRow(ctx, `SELECT id::text FROM providers WHERE is_default LIMIT 1`).Scan(&def)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ProviderRecord{}, fmt.Errorf("%w: no AI provider is configured; add one under AI Settings", ErrInvalid)
		}
		if err != nil {
			return nil, ProviderRecord{}, err
		}
		id = &def
	}
	p, rec, err := s.OpenProvider(ctx, *id, sealer)
	if err != nil {
		return nil, rec, err
	}
	if model != "" && model != rec.Model {
		rec.Model = model
		var key string
		if rec.HasKey {
			var sealed []byte
			if err := s.pool.QueryRow(ctx, `SELECT api_key FROM providers WHERE id = $1`, rec.ID).Scan(&sealed); err != nil {
				return nil, rec, err
			}
			if key, err = sealer.Open(sealed); err != nil {
				return nil, rec, err
			}
		}
		if p, err = ai.New(ai.Config{Kind: rec.Kind, BaseURL: rec.BaseURL, Model: model, APIKey: key}); err != nil {
			return nil, rec, err
		}
	}
	return p, rec, nil
}

func (s *Store) ListAssignments(ctx context.Context) ([]Assignment, error) {
	rows, err := s.pool.Query(ctx, `SELECT role, provider_id::text, model FROM agent_assignments`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	byRole := map[string]Assignment{}
	for rows.Next() {
		var a Assignment
		if err := rows.Scan(&a.Role, &a.ProviderID, &a.Model); err != nil {
			return nil, err
		}
		byRole[a.Role] = a
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := make([]Assignment, 0, len(AgentRoles))
	for _, role := range AgentRoles {
		if a, ok := byRole[role]; ok {
			out = append(out, a)
		} else {
			out = append(out, Assignment{Role: role})
		}
	}
	return out, nil
}

func (s *Store) SetAssignment(ctx context.Context, a Assignment) error {
	known := false
	for _, role := range AgentRoles {
		if role == a.Role {
			known = true
		}
	}
	if !known {
		return fmt.Errorf("%w: unknown agent role %q", ErrInvalid, a.Role)
	}
	if a.ProviderID != nil && *a.ProviderID == "" {
		a.ProviderID = nil
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO agent_assignments (role, provider_id, model, updated_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (role) DO UPDATE SET provider_id = EXCLUDED.provider_id, model = EXCLUDED.model, updated_at = now()`,
		a.Role, a.ProviderID, strings.TrimSpace(a.Model))
	if isInvalidUUID(err) {
		return ErrNotFound
	}
	return err
}

func scanProvider(row scanner) (ProviderRecord, error) {
	var rec ProviderRecord
	err := row.Scan(&rec.ID, &rec.Name, &rec.Kind, &rec.BaseURL, &rec.Model, &rec.HasKey, &rec.IsDefault, &rec.CreatedAt, &rec.UpdatedAt)
	if err != nil {
		return rec, err
	}
	if p, perr := ai.New(ai.Config{Kind: rec.Kind, Model: rec.Model}); perr == nil {
		rec.Capabilities = p.Capabilities()
	}
	return rec, nil
}
