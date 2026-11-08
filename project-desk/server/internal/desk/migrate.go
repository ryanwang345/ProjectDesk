package desk

import (
	"context"
	"fmt"
)

// migrations extend the schema without touching existing rows. The legacy
// CREATE TABLE IF NOT EXISTS statements for projects and cycles still run
// first, so a fresh database and an upgraded one end in the same shape.
var migrations = []struct {
	version int
	sql     string
}{
	{1, `
CREATE TABLE IF NOT EXISTS providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    kind TEXT NOT NULL CHECK (kind IN ('openai', 'gemini', 'anthropic', 'ollama', 'demo')),
    base_url TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    api_key BYTEA,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS providers_one_default ON providers ((is_default)) WHERE is_default;

CREATE TABLE IF NOT EXISTS agent_assignments (
    role TEXT PRIMARY KEY,
    provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
    model TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cycles ADD COLUMN IF NOT EXISTS workflow_state TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS origin_cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL;
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS repo TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB,
    error TEXT NOT NULL DEFAULT '',
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    timeout_seconds INT NOT NULL DEFAULT 180,
    run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_at TIMESTAMPTZ,
    locked_by TEXT NOT NULL DEFAULT '',
    cancel_requested BOOLEAN NOT NULL DEFAULT false,
    provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
    model TEXT NOT NULL DEFAULT '',
    simulated BOOLEAN NOT NULL DEFAULT false,
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS jobs_claim ON jobs (status, run_after, created_at);
CREATE INDEX IF NOT EXISTS jobs_cycle ON jobs (cycle_id, created_at DESC);

CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected')),
    content JSONB NOT NULL,
    provider_name TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    simulated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS analyses_cycle ON analyses (cycle_id, created_at DESC);

CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('specification', 'plan', 'patch', 'validation', 'outcome')),
    version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected', 'superseded', 'passed', 'failed', 'blocked')),
    content TEXT NOT NULL DEFAULT '',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    note TEXT NOT NULL DEFAULT '',
    provider_name TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    simulated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ,
    UNIQUE (cycle_id, kind, version)
);
CREATE INDEX IF NOT EXISTS artifacts_cycle ON artifacts (cycle_id, kind, version DESC);

CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_cycle ON events (cycle_id, id DESC);

CREATE TABLE IF NOT EXISTS knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`},
	{2, `
ALTER TABLE providers DROP CONSTRAINT IF EXISTS providers_kind_check;
ALTER TABLE providers ADD CONSTRAINT providers_kind_check CHECK (kind IN ('openai', 'gemini', 'anthropic', 'ollama', 'demo'));
`},
	{3, `
CREATE TABLE IF NOT EXISTS english_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word TEXT NOT NULL CHECK (char_length(word) BETWEEN 1 AND 80),
    meaning TEXT NOT NULL CHECK (char_length(meaning) BETWEEN 1 AND 160),
    example TEXT NOT NULL CHECK (char_length(example) BETWEEN 1 AND 280),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO english_cards (word, meaning, example)
SELECT seed.word, seed.meaning, seed.example
FROM (VALUES
    ('order', '点单', 'I order a cup of milk tea every afternoon.'),
    ('across', '在对面', 'A new shop opened across the street.'),
    ('cheaper', '更便宜', 'Their cup is two dollars cheaper than ours.'),
    ('once', '一次', 'People order once and then stop coming back.'),
    ('save', '保存', 'Save this card when the sentence sounds right.')
) AS seed(word, meaning, example)
WHERE NOT EXISTS (SELECT 1 FROM english_cards);
`},
	{4, `
ALTER TABLE english_cards ADD COLUMN IF NOT EXISTS examples TEXT[];

UPDATE english_cards SET examples = ARRAY[
    'I order a cup of milk tea every afternoon.',
    'She likes to order the same drink every time.',
    'We order lunch at the counter, then wait by the window.',
    'Please order for both of us while I find a table.',
    'They order online and pick the cups up on the way home.',
    'I always order a small size when I am not very thirsty.',
    'Did you order the milk tea with less sugar?',
    'Customers order once, taste it, and then compare the price.',
    'You can order a hot cup or a cold cup.',
    'I order an extra cup when a friend is coming over.'
] WHERE word = 'order';

UPDATE english_cards SET examples = ARRAY[
    'A new shop opened across the street.',
    'I saw her wave from across the road.',
    'The cheaper cups are sold across from our door.',
    'We walked across the street to see the new menu.',
    'Their sign is easy to read from across the square.',
    'He lives across the hall from the tea shop.',
    'A bus stop sits across from the entrance.',
    'I looked across the counter and asked for a smaller cup.',
    'The line stretched across the sidewalk at noon.',
    'She pointed across the street and said the price was lower there.'
] WHERE word = 'across';

UPDATE english_cards SET examples = ARRAY[
    'Their cup is two dollars cheaper than ours.',
    'A smaller size is cheaper if you only want a few sips.',
    'Lunch is cheaper before noon.',
    'The shop across the street is cheaper, so people try it.',
    'This week the cold drink is cheaper than the hot one.',
    'Buying two cups is not cheaper than buying one.',
    'I chose the cheaper topping and skipped the extra pearls.',
    'Is the new shop really cheaper, or does the cup look smaller?',
    'We made the large size cheaper so more people would stay.',
    'A plain tea is cheaper than a milk tea with pearls.'
] WHERE word = 'cheaper';

UPDATE english_cards SET examples = ARRAY[
    'People order once and then stop coming back.',
    'I tried their milk tea once and liked the first sip.',
    'Please say the size once, then the sugar level.',
    'She visited the new shop once last week.',
    'We open the door once and the smell of tea fills the room.',
    'He paid once for both cups.',
    'I only need to hear the price once.',
    'Call me once when the order is ready.',
    'They came once, looked at the menu, and left.',
    'Measure the sugar once so every cup tastes the same.'
] WHERE word = 'once';

UPDATE english_cards SET examples = ARRAY[
    'Save this card when the sentence sounds right.',
    'I save a seat by the window for my friend.',
    'Save the receipt if you want to come back tomorrow.',
    'We save the last cup for the evening rush.',
    'Please save your progress before you close the page.',
    'She likes to save a little of the drink for later.',
    'Save the word, then read the ten sentences out loud.',
    'I save money when I skip the extra pearls.',
    'Can you save my order while I find my wallet?',
    'We save the quiet table for people who come to study.'
] WHERE word = 'save';

UPDATE english_cards
SET examples = ARRAY[example, example, example, example, example, example, example, example, example, example]
WHERE examples IS NULL;

ALTER TABLE english_cards ALTER COLUMN examples SET NOT NULL;
ALTER TABLE english_cards DROP COLUMN example;
ALTER TABLE english_cards DROP CONSTRAINT IF EXISTS english_cards_examples_count;
ALTER TABLE english_cards ADD CONSTRAINT english_cards_examples_count CHECK (cardinality(examples) = 10);
`},
	{5, `
ALTER TABLE english_cards ADD COLUMN IF NOT EXISTS in_review BOOLEAN NOT NULL DEFAULT false;
`},
	{6, `
ALTER TABLE english_cards ADD COLUMN IF NOT EXISTS generated BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS english_quizzes (
    lesson INTEGER PRIMARY KEY,
    word_ids TEXT[] NOT NULL,
    questions JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`},
}

func migrate(ctx context.Context, s *Store) error {
	if _, err := s.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`); err != nil {
		return err
	}
	for _, m := range migrations {
		var applied bool
		if err := s.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, m.version).Scan(&applied); err != nil {
			return err
		}
		if applied {
			continue
		}
		tx, err := s.pool.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, m.sql); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("migration %d: %w", m.version, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, m.version); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	return nil
}
