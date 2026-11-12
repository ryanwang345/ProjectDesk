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
	{7, `
ALTER TABLE english_cards ADD COLUMN IF NOT EXISTS pronunciation TEXT NOT NULL DEFAULT '';
`},
	{8, `
ALTER TABLE english_cards ADD COLUMN IF NOT EXISTS senses JSONB NOT NULL DEFAULT '[]'::jsonb;
`},
	{9, `
ALTER TABLE english_cards ADD COLUMN IF NOT EXISTS band JSONB NOT NULL DEFAULT '{}'::jsonb;
`},
	{10, `
UPDATE english_cards
SET
    examples = ARRAY[
        'She started her career as an administrative assistant at a law firm.',
        'Doctors spend too much time on routine administrative tasks.',
        'Your application was delayed because of an administrative error.',
        'Automating payroll helped reduce our administrative overhead.',
        'Please contact the administrative staff if you need to reschedule.',
        'Small businesses struggle with the administrative burden of new tax rules.',
        'There is a small administrative fee for changing your booking.',
        'The officer was placed on administrative leave during the inquiry.',
        'The capital serves as the political and administrative center of the region.',
        'Her new role combines teaching with administrative duties.'
    ],
    band = '{
        "collocations": [
            "administrative burden",
            "administrative tasks",
            "administrative overhead",
            "administrative error",
            "administrative staff",
            "administrative duties",
            "administrative leave",
            "administrative costs"
        ],
        "writing": "Reducing the administrative burden on teachers allows them to dedicate more time to classroom instruction.",
        "writingZh": "减轻教师的行政负担，能让他们把更多时间投入到课堂教学中。",
        "speaking": "I spend far too much of my working week dealing with tedious administrative tasks rather than teaching.",
        "speakingZh": "我每周工作中有太多时间都花在处理繁琐的行政事务上，而不是教学上。",
        "examples": [
            "Automating the invoicing workflow significantly reduced our monthly administrative overhead.",
            "The hospital apologized after a patient record was misplaced due to an administrative error.",
            "Universities have been criticized for increasing spending on administrative staff while freezing teaching posts.",
            "Small firms often lack the resources to cope with the heavy administrative costs of regulatory compliance.",
            "She was promoted to department head, a role that carries substantial administrative duties.",
            "The official was placed on paid administrative leave pending the outcome of the investigation."
        ],
        "examplesZh": [
            "将发票流程自动化，显著降低了我们每月的行政管理开销。",
            "病历因行政失误而放错地方后，医院公开致歉。",
            "高校因在冻结教学岗位的同时增加行政人员开支而受到批评。",
            "小企业往往缺乏足够的资源来应对合规带来的高昂行政成本。",
            "她晋升为部门主管，这一职位承担着大量的行政职责。",
            "在调查结果出来之前，该官员被安排带薪行政休假。"
        ],
        "weak": "The administrative is very difficult in this company.",
        "fix": "Use administrative as an adjective before a noun such as burden, tasks, overhead, or error.",
        "fixZh": "将 administrative 作为形容词放在 burden、tasks、overhead 或 error 等名词前使用。",
        "paraphrases": [
            "managerial",
            "bureaucratic",
            "organizational",
            "clerical"
        ],
        "zh": "将 administrative 作为前置形容词修饰具体名词（如 burden、tasks、overhead、error），切勿单独当作名词使用。"
    }'::jsonb
WHERE lower(word) = 'administrative';
`},
	{11, `
UPDATE english_cards
SET
    band = '{
        "collocations": [
            "add weight to",
            "add fuel to the fire",
            "add a new dimension",
            "add value to",
            "add momentum to",
            "add significantly to"
        ],
        "writing": "These recent findings add considerable weight to the argument that urban green spaces reduce stress.",
        "writingZh": "这些最新研究结果为“城市绿地能缓解压力”这一论点增添了很有力的分量。",
        "speaking": "I think working abroad really adds a new dimension to your CV.",
        "speakingZh": "我认为海外工作经历确实能为你的简历增添新的亮点。",
        "examples": [
            "The new features add significant value to the existing software suite.",
            "The policy changes risk adding fuel to the fire during an already volatile economic period.",
            "Successful marketing campaigns add momentum to brand growth.",
            "Increased regulation will add substantially to the operational costs of small businesses."
        ],
        "examplesZh": [
            "这些新功能为现有的软件套件增添了可观的价值。",
            "在经济本就动荡的时期，这些政策变动恐有火上浇油的风险。",
            "成功的营销活动会为品牌增长注入动力。",
            "监管力度的加大将大幅增加小企业的运营成本。"
        ],
        "weak": "We need to add to the problem.",
        "fix": "Use add in a clear collocation like add to the problem''s complexity or add weight to an argument.",
        "fixZh": "把 add 放在明确的搭配中使用，例如 add to the problem''s complexity（增加问题的复杂性）或 add weight to an argument（为论点增加分量）。",
        "paraphrases": [
            "contribute to",
            "augment",
            "supplement",
            "incorporate"
        ],
        "zh": "多用高级搭配如 add weight to 或 add value to，避免单用 add。"
    }'::jsonb
WHERE lower(word) = 'add';
`},
	{12, `
CREATE TABLE IF NOT EXISTS reading_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    module TEXT NOT NULL CHECK (module IN ('academic', 'general')),
    category TEXT NOT NULL CHECK (category IN ('full', 'passage', 'question_type')),
    difficulty TEXT NOT NULL DEFAULT 'Band 7.0–8.5',
    duration_seconds INT NOT NULL DEFAULT 3600,
    passages JSONB NOT NULL DEFAULT '[]'::jsonb,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reading_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES reading_tests(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('practice', 'exam')),
    module TEXT NOT NULL CHECK (module IN ('academic', 'general')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'submitted')),
    duration_seconds INT NOT NULL DEFAULT 3600,
    elapsed_seconds INT NOT NULL DEFAULT 0,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    flags JSONB NOT NULL DEFAULT '{}'::jsonb,
    bookmarks JSONB NOT NULL DEFAULT '{}'::jsonb,
    highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
    score INT NOT NULL DEFAULT 0,
    total INT NOT NULL DEFAULT 0,
    band NUMERIC(3,1) NOT NULL DEFAULT 0.0,
    results JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reading_sessions_status_idx ON reading_sessions (status, submitted_at DESC);
`},
	{13, `
-- The existing application is a single shared learner workspace.
CREATE TABLE learning_profile (
    id TEXT PRIMARY KEY CHECK (id = 'workspace'),
    timezone TEXT NOT NULL,
    completed JSONB NOT NULL DEFAULT '[]'::jsonb,
    legacy_imported BOOLEAN NOT NULL DEFAULT false,
    legacy_last_day DATE,
    legacy_streak INT NOT NULL DEFAULT 0
);
CREATE TABLE learning_events (
    event_key TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('reading', 'vocabulary', 'legacy')),
    xp INT NOT NULL CHECK (xp >= 0),
    activity_day DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX learning_events_day_idx ON learning_events (activity_day);
ALTER TABLE reading_tests ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE reading_sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'standard'
    CHECK (kind IN ('standard', 'daily', 'mistake_review'));
ALTER TABLE reading_sessions ADD COLUMN challenge_day DATE;
ALTER TABLE reading_sessions ADD COLUMN review_type TEXT NOT NULL DEFAULT '';
CREATE TABLE reading_daily_challenges (
    day DATE NOT NULL,
    module TEXT NOT NULL CHECK (module IN ('academic', 'general')),
    session_id UUID NOT NULL UNIQUE REFERENCES reading_sessions(id),
    PRIMARY KEY (day, module)
);
CREATE TABLE reading_mistakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES reading_tests(id),
    question_id TEXT NOT NULL,
    module TEXT NOT NULL,
    question JSONB NOT NULL,
    passage JSONB NOT NULL,
    user_answer TEXT NOT NULL DEFAULT '',
    incorrect_count INT NOT NULL DEFAULT 1,
    retry_count INT NOT NULL DEFAULT 0,
    correct_retries INT NOT NULL DEFAULT 0,
    first_wrong_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_wrong_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    UNIQUE (test_id, question_id)
);
CREATE INDEX reading_mistakes_review_idx ON reading_mistakes (module, resolved_at, last_wrong_at);
-- Bring genuine historical incorrect answers into the review queue.
INSERT INTO reading_mistakes (test_id,question_id,module,question,passage,user_answer,incorrect_count,first_wrong_at,last_wrong_at)
SELECT DISTINCT ON (s.test_id,answer->>'questionId')
    s.test_id,answer->>'questionId',s.module,q,p,COALESCE(answer->>'userAnswer',''),
    count(*) OVER w,min(s.submitted_at) OVER w,max(s.submitted_at) OVER w
FROM reading_sessions s JOIN reading_tests t ON t.id=s.test_id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.results->'questions','[]'::jsonb)) answer
CROSS JOIN LATERAL jsonb_array_elements(t.questions) q
CROSS JOIN LATERAL jsonb_array_elements(t.passages) p
WHERE s.status='submitted' AND answer->>'correct'='false'
    AND q->>'id'=answer->>'questionId' AND p->>'id'=q->>'passageId'
WINDOW w AS (PARTITION BY s.test_id,answer->>'questionId')
ORDER BY s.test_id,answer->>'questionId',s.submitted_at DESC;
CREATE TABLE reading_review_items (
    session_id UUID NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    mistake_id UUID NOT NULL REFERENCES reading_mistakes(id),
    PRIMARY KEY (session_id, question_id)
);
-- A saved reading word has one genuine passage example; never invent nine more.
ALTER TABLE english_cards DROP CONSTRAINT english_cards_examples_count;
ALTER TABLE english_cards ADD CONSTRAINT english_cards_examples_count
    CHECK (cardinality(examples) BETWEEN 1 AND 10);
CREATE TABLE reading_vocabulary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES english_cards(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES reading_sessions(id),
    passage_id TEXT NOT NULL,
    paragraph_label TEXT NOT NULL,
    context TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (card_id, session_id, passage_id, paragraph_label)
);
`},
	{14, `
ALTER TABLE english_quizzes ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
`},
	{15, `
CREATE INDEX IF NOT EXISTS english_cards_lower_word_idx ON english_cards (lower(word));
CREATE INDEX IF NOT EXISTS english_cards_updated_at_idx ON english_cards (updated_at DESC);
CREATE INDEX IF NOT EXISTS reading_tests_visible_idx ON reading_tests (hidden, module, category, created_at ASC);
CREATE INDEX IF NOT EXISTS reading_sessions_module_status_idx ON reading_sessions (module, status, updated_at DESC);
`},
	{16, `
ALTER TABLE learning_profile
    ADD COLUMN IF NOT EXISTS daily_minutes INT NOT NULL DEFAULT 15 CHECK (daily_minutes BETWEEN 5 AND 60),
    ADD COLUMN IF NOT EXISTS target_band NUMERIC(2,1) NOT NULL DEFAULT 7.0 CHECK (target_band >= 4.0 AND target_band <= 9.0),
    ADD COLUMN IF NOT EXISTS preferred_module TEXT NOT NULL DEFAULT 'academic' CHECK (preferred_module IN ('academic', 'general'));

CREATE TABLE IF NOT EXISTS vocabulary_srs (
    card_id UUID PRIMARY KEY REFERENCES english_cards(id) ON DELETE CASCADE,
    stability DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    difficulty DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    reps INT NOT NULL DEFAULT 0,
    lapses INT NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'learning' CHECK (state IN ('new', 'learning', 'review', 'relearning')),
    last_rating INT NOT NULL DEFAULT 0,
    recognition_reps INT NOT NULL DEFAULT 0,
    productive_reps INT NOT NULL DEFAULT 0,
    last_reviewed_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vocabulary_srs_due_idx ON vocabulary_srs (due_at ASC);

CREATE TABLE IF NOT EXISTS vocabulary_review_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES english_cards(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 4),
    mode TEXT NOT NULL CHECK (mode IN ('recognition', 'productive')),
    stability_before DOUBLE PRECISION NOT NULL,
    stability_after DOUBLE PRECISION NOT NULL,
    difficulty_before DOUBLE PRECISION NOT NULL,
    difficulty_after DOUBLE PRECISION NOT NULL,
    scheduled_days DOUBLE PRECISION NOT NULL,
    elapsed_ms INT NOT NULL DEFAULT 0,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vocabulary_review_logs_reviewed_at_idx ON vocabulary_review_logs (reviewed_at DESC);

INSERT INTO vocabulary_srs (card_id, stability, difficulty, state, due_at)
SELECT id, 0.8, 5.5, 'learning', now()
FROM english_cards
WHERE in_review = true
ON CONFLICT (card_id) DO NOTHING;

INSERT INTO vocabulary_srs (card_id, stability, difficulty, state, due_at)
SELECT DISTINCT card_id, 1.0, 5.5, 'learning', now()
FROM reading_vocabulary
ON CONFLICT (card_id) DO NOTHING;
`},
{17, `
INSERT INTO english_cards (word, meaning, examples, senses, generated)
SELECT v.word, v.meaning, v.examples, v.senses::jsonb, true
FROM (VALUES
	('archipelago', '群岛', ARRAY['The ferry connects several islands in the archipelago.', 'She spent a month exploring the archipelago by boat.', 'Each island in the archipelago has its own traditions.', 'The archipelago appears as a chain on the map.', 'Fishing supports many families across the archipelago.', 'A storm interrupted flights to the archipelago.', 'The documentary follows wildlife across a remote archipelago.', 'Visitors need permits to camp in the archipelago.', 'The archipelago includes both large islands and tiny rocks.', 'Our guide grew up on the northernmost island of the archipelago.'], '[{"pos": "n", "en": "A group of islands in the same area of sea.", "zh": "群岛"}]'),
	('peninsula', '半岛', ARRAY['The village stands at the end of a narrow peninsula.', 'A coastal road runs around the peninsula.', 'The peninsula is connected to the mainland by a strip of land.', 'We could see water on both sides of the peninsula.', 'The map shows several beaches along the peninsula.', 'A lighthouse marks the tip of the peninsula.', 'The peninsula becomes crowded during the summer holidays.', 'Farmers grow olives on the sheltered side of the peninsula.', 'The walking trail crosses the peninsula from east to west.', 'They chose a hotel overlooking the peninsula.'], '[{"pos": "n", "en": "Land that extends into water and remains connected to a larger land area.", "zh": "半岛"}]'),
	('estuary', '河口；河口湾', ARRAY['The river widens as it enters the estuary.', 'Birdwatchers gathered beside the estuary at dawn.', 'The tide changes the water level in the estuary.', 'A bridge spans the narrowest part of the estuary.', 'Researchers collected water samples from the estuary.', 'The estuary provides shelter for young fish.', 'The proposed port would occupy part of the estuary.', 'We followed a footpath along the estuary.', 'Salt water moves farther into the estuary during dry weather.', 'Local volunteers removed plastic from the estuary.'], '[{"pos": "n", "en": "The tidal area near a river mouth where river water meets seawater.", "zh": "河口；河口湾"}]'),
	('tributary', '支流', ARRAY['A small tributary joins the main river near the town.', 'We followed the tributary upstream into the hills.', 'Heavy rain caused the tributary to overflow.', 'The map labels every major tributary in the valley.', 'This tributary carries water from the forest.', 'A footbridge crosses the tributary behind the school.', 'Pollution in a tributary can affect the larger river.', 'The tributary becomes shallow during the dry season.', 'Engineers measured the flow of the tributary.', 'They restored trees along the banks of the tributary.'], '[{"pos": "n", "en": "A river or stream that flows into a larger river.", "zh": "支流"}]'),
	('plateau', '高原', ARRAY['The road climbs steeply before reaching the plateau.', 'A cool wind swept across the plateau.', 'The village lies on a high plateau above the valley.', 'We stopped on the plateau to study the map.', 'The plateau supports grassland rather than dense forest.', 'Farmers on the plateau store water for the dry months.', 'A deep canyon cuts through the plateau.', 'The research station stands near the edge of the plateau.', 'Snow covered the plateau during our visit.', 'The trail offers a clear view across the plateau.'], '[{"pos": "n", "en": "A large area of land that is high and relatively flat.", "zh": "高原"}]'),
	('hemisphere', '半球', ARRAY['The diagram divides Earth into a northern and a southern hemisphere.', 'The flight took us into the southern hemisphere.', 'She compared seasonal temperatures in each hemisphere.', 'Our classroom globe shows the western hemisphere in detail.', 'The equator forms the boundary between one hemisphere and the other.', 'The report focuses on bird migration in the northern hemisphere.', 'We used a globe to locate the country in its hemisphere.', 'The researcher compared ocean currents across each hemisphere.', 'The map places the eastern hemisphere on the right.', 'The telescope is designed for observing stars from the southern hemisphere.'], '[{"pos": "n", "en": "One half of the Earth, especially its northern or southern half.", "zh": "半球"}]'),
	('latitude', '纬度', ARRAY['The guide recorded our latitude using a handheld receiver.', 'The two cities lie at almost the same latitude.', 'Lines of latitude run across the classroom map.', 'Enter the latitude before entering the longitude.', 'The report compares rainfall at different degrees of latitude.', 'The island is located at a low latitude.', 'The ship''s log includes its latitude at noon.', 'She marked the latitude of the research station.', 'The exercise asks students to read latitude from a map.', 'A place''s latitude helps describe its geographical location.'], '[{"pos": "n", "en": "The position of a place north or south of the equator, measured in degrees.", "zh": "纬度"}]'),
	('longitude', '经度', ARRAY['The navigation screen displays both latitude and longitude.', 'The captain checked the vessel''s longitude.', 'The map uses lines of longitude to identify locations.', 'Enter the longitude in the second box.', 'The two towns have similar latitude but different longitude.', 'The museum explains how sailors once measured longitude.', 'She copied the station''s longitude into her notebook.', 'The exercise gives the longitude of three ports.', 'A mistake in longitude placed the marker in the sea.', 'The coordinates include a longitude east of the prime meridian.'], '[{"pos": "n", "en": "The position of a place east or west of the prime meridian, measured in degrees.", "zh": "经度"}]'),
	('equator', '赤道', ARRAY['The equator divides Earth into northern and southern halves.', 'We traced the equator on the globe.', 'The ship crossed the equator during the voyage.', 'The map shows several countries along the equator.', 'The research project compares sites near the equator.', 'She placed a red thread around the globe''s equator.', 'The question asks how far the island is from the equator.', 'The equator is marked as zero degrees latitude.', 'The pilot announced when the aircraft crossed the equator.', 'Their journey began south of the equator.'], '[{"pos": "n", "en": "The imaginary line around Earth halfway between its poles.", "zh": "赤道"}]'),
	('watershed', '流域；集水区', ARRAY['The project protects forests throughout the watershed.', 'Rain falling in this watershed eventually reaches the lake.', 'The council produced a map of the watershed.', 'Farms occupy much of the upper watershed.', 'Water quality depends on activities across the watershed.', 'The reservoir collects water from a large watershed.', 'Volunteers monitor streams within the watershed.', 'The report describes soil erosion in the watershed.', 'Several towns share responsibility for managing the watershed.', 'Restoring vegetation can help protect the watershed.'], '[{"pos": "n", "en": "An area of land whose water drains into the same river or body of water.", "zh": "流域；集水区"}]'),
	('biodiversity', '生物多样性', ARRAY['The survey records biodiversity in the woodland.', 'The wetland supports a high level of biodiversity.', 'The council made biodiversity a priority in its park plan.', 'Students compared biodiversity in two school gardens.', 'Protecting old trees can benefit local biodiversity.', 'The report links habitat loss to declining biodiversity.', 'The museum has an exhibition about marine biodiversity.', 'The farm planted hedges to encourage biodiversity.', 'Researchers need reliable data to measure biodiversity.', 'The restoration project aims to improve biodiversity along the river.'], '[{"pos": "n", "en": "The variety of living things in a place or across the planet.", "zh": "生物多样性"}]'),
	('ecosystem', '生态系统', ARRAY['The pond is a small ecosystem with many interacting species.', 'A change in water temperature can affect the ecosystem.', 'The diagram shows how energy moves through an ecosystem.', 'The forest ecosystem includes plants, animals, fungi, and soil.', 'Pollution disrupted the balance of the river ecosystem.', 'The team studied a fragile coastal ecosystem.', 'Students built a model of a grassland ecosystem.', 'Removing one species can alter the wider ecosystem.', 'The reserve protects an ecosystem rather than a single animal.', 'The article describes how an ecosystem recovers after disturbance.'], '[{"pos": "n", "en": "Living things and their physical surroundings interacting as a system.", "zh": "生态系统"}]'),
	('deforestation', '森林砍伐；毁林', ARRAY['The satellite images reveal deforestation along the new road.', 'The essay examines the causes of deforestation.', 'Deforestation has reduced habitat for several local species.', 'The campaign calls for better monitoring of deforestation.', 'The report distinguishes deforestation from selective tree cutting.', 'The community opposed further deforestation near its water source.', 'Demand for farmland can contribute to deforestation.', 'Researchers compared deforestation across three regions.', 'The company published a policy on preventing deforestation.', 'The chart shows a decline in the rate of deforestation.'], '[{"pos": "n", "en": "The removal of forest over a large area.", "zh": "森林砍伐；毁林"}]'),
	('reforestation', '重新造林；森林恢复', ARRAY['The village began a reforestation project on the hillside.', 'The charity provides seedlings for reforestation.', 'Successful reforestation requires care after trees are planted.', 'The report tracks the progress of reforestation over ten years.', 'Local residents chose native species for the reforestation project.', 'The budget includes funding for reforestation after the fire.', 'Reforestation can restore habitat on damaged land.', 'The team compared natural recovery with managed reforestation.', 'Students volunteered at a reforestation site.', 'The proposal connects reforestation with long-term land management.'], '[{"pos": "n", "en": "Planting or restoring forest in an area where forest was removed.", "zh": "重新造林；森林恢复"}]'),
	('wetland', '湿地', ARRAY['The wetland lies between the river and the village.', 'We watched migrating birds from a hide beside the wetland.', 'The city restored a wetland near the floodplain.', 'A boardwalk allows visitors to cross the wetland safely.', 'The wetland contains reeds, shallow pools, and muddy banks.', 'The plan would drain part of the wetland.', 'Researchers measured water levels in the wetland.', 'The nature reserve protects a freshwater wetland.', 'The wetland helps slow water after heavy rainfall.', 'Visitors must stay on marked paths in the wetland.'], '[{"pos": "n", "en": "Land that is covered by water or has waterlogged soil for part or all of the year.", "zh": "湿地"}]'),
	('mangrove', '红树林植物；红树林', ARRAY['The boat passed beneath the roots of a mangrove tree.', 'The village planted a mangrove belt along the shore.', 'Young fish shelter among the mangrove roots.', 'The guide explained how a mangrove survives salty conditions.', 'The mangrove forest extends around the sheltered bay.', 'The project restores damaged mangrove habitat.', 'Mud collected around the base of the mangrove.', 'The students drew the unusual roots of a mangrove.', 'A raised path leads visitors through the mangrove forest.', 'The report compares mangrove cover before and after the storm.'], '[{"pos": "n", "en": "A tree or shrub that grows along warm coasts in salty, waterlogged ground.", "zh": "红树林植物；红树林"}]'),
	('aquifer', '含水层', ARRAY['The village draws drinking water from an underground aquifer.', 'The well reaches an aquifer beneath the valley.', 'The report estimates how much water remains in the aquifer.', 'Rainwater slowly replenishes the aquifer.', 'Excessive pumping can lower water levels in an aquifer.', 'The map shows the boundaries of the aquifer.', 'Pollution entered the aquifer through cracks in the rock.', 'Farmers depend on the aquifer during dry periods.', 'Scientists tested water samples from the aquifer.', 'The plan limits new wells to protect the aquifer.'], '[{"pos": "n", "en": "An underground layer of rock or sediment that stores and carries water.", "zh": "含水层"}]'),
	('biodegradable', '可生物降解的', ARRAY['The supplier described the packaging as biodegradable.', 'A biodegradable label does not specify how quickly something breaks down.', 'The team tested biodegradable material under controlled conditions.', 'The restaurant switched to biodegradable food containers.', 'The brochure explains how to dispose of biodegradable bags.', 'Students compared biodegradable packaging with conventional plastic.', 'The product contains biodegradable fibres.', 'The council asked for evidence supporting the biodegradable claim.', 'Some biodegradable materials require specific composting conditions.', 'The research focuses on making biodegradable alternatives more durable.'], '[{"pos": "adj", "en": "Able to break down through biological processes under suitable conditions.", "zh": "可生物降解的"}]'),
	('pollinator', '传粉者；传粉昆虫或动物', ARRAY['A bee is one familiar example of a pollinator.', 'The garden provides food for a local pollinator.', 'The survey records each pollinator visiting the flowers.', 'The farmer planted a strip of pollinator habitat.', 'A pollinator can carry pollen from one flower to another.', 'The project studies pollinator activity during the growing season.', 'Students watched a pollinator land on a blossom.', 'The report links pollinator diversity with varied flower resources.', 'The new park includes a pollinator garden.', 'The researcher identified the moth as a nocturnal pollinator.'], '[{"pos": "n", "en": "An animal that carries pollen between flowers and helps plants reproduce.", "zh": "传粉者；传粉昆虫或动物"}]'),
	('microplastic', '微塑料', ARRAY['The laboratory found microplastic particles in the water sample.', 'The project measures microplastic pollution along the coast.', 'A filter trapped a small microplastic fragment.', 'The article describes several sources of microplastic waste.', 'Students examined microplastic particles under a microscope.', 'The team used clean equipment to avoid microplastic contamination.', 'The report compares methods for detecting microplastic material.', 'Researchers collected sand to study microplastic distribution.', 'The exhibition explains how larger plastic waste becomes microplastic debris.', 'The experiment tested whether the filter could capture microplastic particles.'], '[{"pos": "n", "en": "A very small piece of plastic, usually less than five millimetres across.", "zh": "微塑料"}]'),
	('sustainability', '可持续性', ARRAY['The council evaluated the sustainability of the transport plan.', 'The course examines sustainability in food production.', 'The company published a report on environmental sustainability.', 'Students discussed the long-term sustainability of the project.', 'Water use is central to the farm''s sustainability strategy.', 'The proposal balances cost, access, and sustainability.', 'The committee asked how sustainability would be measured.', 'The library hosts workshops on sustainability at home.', 'Repairing equipment can support the sustainability of a service.', 'The study questions the financial sustainability of the current model.'], '[{"pos": "n", "en": "The ability to continue over time without exhausting resources or causing lasting damage.", "zh": "可持续性"}]'),
	('renewable', '可再生的', ARRAY['The village plans to generate more renewable energy.', 'Wind is one source of renewable electricity.', 'The report compares renewable and non-renewable resources.', 'The school installed a display about renewable power.', 'The project uses renewable materials where practical.', 'Investment in renewable energy increased in the study area.', 'The factory signed a contract for renewable electricity.', 'The essay discusses the limits of renewable energy storage.', 'The island combines several renewable energy sources.', 'The proposal includes training for jobs in the renewable energy sector.'], '[{"pos": "adj", "en": "Replenished naturally so that a resource can be used repeatedly.", "zh": "可再生的"}]'),
	('decarbonization', '脱碳；减少碳排放', ARRAY['The company published a decarbonization plan for its factories.', 'The workshop explored decarbonization in heavy industry.', 'The report tracks progress toward transport decarbonization.', 'Better insulation is part of the building''s decarbonization strategy.', 'The city linked decarbonization with improvements in public transport.', 'The study compares the costs of different decarbonization pathways.', 'The committee requested clearer decarbonization targets.', 'The engineer described the practical challenges of decarbonization.', 'The investment supports decarbonization of the heating network.', 'The article distinguishes decarbonization goals from completed emissions reductions.'], '[{"pos": "n", "en": "Reducing carbon emissions from an activity, economy, or energy system.", "zh": "脱碳；减少碳排放"}]'),
	('electrification', '电气化；通电', ARRAY['The railway closed temporarily for electrification work.', 'Rural electrification brought power to several villages.', 'The report examines electrification of public transport.', 'The project combines electrification with grid improvements.', 'The factory''s electrification plan includes new heating equipment.', 'The study estimates demand after widespread vehicle electrification.', 'Electrification changed how the workshop powered its tools.', 'The museum explains the history of household electrification.', 'The proposal includes electrification of the bus depot.', 'The engineer discussed the infrastructure needed for electrification.'], '[{"pos": "n", "en": "Introducing electricity to a place or replacing other power sources with electricity.", "zh": "电气化；通电"}]'),
	('desalination', '海水或咸水淡化', ARRAY['The coastal town built a small desalination plant.', 'Desalination provides an additional source of fresh water.', 'The report compares energy use in different desalination systems.', 'The island relies on desalination during the dry season.', 'The project tested a solar-powered desalination unit.', 'The proposal considers the environmental effects of desalination.', 'Students studied the stages of the desalination process.', 'The plant releases concentrated salt water after desalination.', 'The council compared desalination with reducing water demand.', 'The engineer explained why desalination requires regular maintenance.'], '[{"pos": "n", "en": "Removing salt from seawater or other salty water to produce fresh water.", "zh": "海水或咸水淡化"}]'),
	('urbanization', '城市化', ARRAY['The chapter traces urbanization over the last century.', 'Rapid urbanization increased demand for housing.', 'The map shows urbanization spreading along the railway.', 'The study links urbanization with changes in land use.', 'The city plans new services to respond to urbanization.', 'Students compared urbanization in three regions.', 'Urbanization has changed the landscape around the old town.', 'The report examines transport challenges associated with urbanization.', 'The essay discusses both opportunities and pressures created by urbanization.', 'The survey tracks migration as one driver of urbanization.'], '[{"pos": "n", "en": "The growth of towns and cities and the increasing share of people living in them.", "zh": "城市化"}]'),
	('gentrification', '街区中产化；绅士化', ARRAY['The documentary explores gentrification in a former industrial neighbourhood.', 'Rising rents became a major concern during gentrification.', 'The residents debated the effects of gentrification.', 'The study follows businesses affected by gentrification.', 'The council considered tenant protections in areas experiencing gentrification.', 'The article distinguishes building repairs from wider gentrification.', 'Some residents welcomed investment but worried about gentrification.', 'The survey asks how gentrification changes local services.', 'The essay examines displacement linked to gentrification.', 'The exhibition presents different experiences of gentrification.'], '[{"pos": "n", "en": "Changes in a neighbourhood as wealthier residents and investment arrive, often raising costs and displacing existing residents.", "zh": "街区中产化；绅士化"}]'),
	('congestion', '拥堵', ARRAY['Roadworks caused severe congestion near the bridge.', 'The new bus lane aims to reduce traffic congestion.', 'Morning congestion added twenty minutes to the journey.', 'The report measures congestion at major junctions.', 'The city introduced a congestion charge in the centre.', 'Better train services could ease road congestion.', 'The map highlights areas with frequent congestion.', 'Deliveries were delayed by congestion around the market.', 'The planners considered pedestrian congestion outside the station.', 'The proposal addresses congestion without widening the road.'], '[{"pos": "n", "en": "A situation in which too many vehicles or people crowd a space and slow movement.", "zh": "拥堵"}]'),
	('pedestrianization', '步行化；设置步行区', ARRAY['The council proposed pedestrianization of the shopping street.', 'Pedestrianization created more space for outdoor seating.', 'The report evaluates traffic changes after pedestrianization.', 'Shopkeepers discussed delivery access during the pedestrianization trial.', 'The plan combines pedestrianization with improved bus stops.', 'Residents were invited to comment on pedestrianization.', 'The street''s pedestrianization required a new delivery schedule.', 'The study compares sales before and after pedestrianization.', 'Accessibility was a central concern in the pedestrianization debate.', 'The town tested pedestrianization on summer weekends.'], '[{"pos": "n", "en": "Changing a street or area so that people on foot have priority and most vehicles are restricted.", "zh": "步行化；设置步行区"}]'),
	('ecotourism', '生态旅游', ARRAY['The village developed an ecotourism programme led by local guides.', 'The essay examines whether ecotourism benefits conservation.', 'The reserve limits visitor numbers as part of its ecotourism policy.', 'The lodge describes its approach to ecotourism.', 'Income from ecotourism helps fund trail maintenance.', 'The report questions unsupported ecotourism claims.', 'The project includes ecotourism training for local residents.', 'The island hopes to expand ecotourism without damaging habitats.', 'The tour operator explains the principles of ecotourism.', 'The study measures the local economic effects of ecotourism.'], '[{"pos": "n", "en": "Tourism designed to support conservation and local communities while limiting environmental harm.", "zh": "生态旅游"}]'),
	('diplomacy', '外交；外交手段', ARRAY['The dispute was resolved through patient diplomacy.', 'She plans to study international diplomacy.', 'The meeting provided an opportunity for quiet diplomacy.', 'The report examines the role of diplomacy in preventing conflict.', 'The agreement followed months of diplomacy.', 'The museum documents the history of regional diplomacy.', 'The minister emphasized dialogue and diplomacy.', 'Students discussed cultural exchanges as a form of diplomacy.', 'The lecture compared public statements with private diplomacy.', 'Successful diplomacy often requires careful listening.'], '[{"pos": "n", "en": "Managing relations between countries through communication and negotiation.", "zh": "外交；外交手段"}]'),
	('sovereignty', '主权', ARRAY['The debate focused on national sovereignty.', 'The treaty recognizes the sovereignty of both states.', 'The lecture explains sovereignty in international relations.', 'The article discusses the relationship between sovereignty and cooperation.', 'The government described the decision as a matter of sovereignty.', 'Students compared different interpretations of sovereignty.', 'The negotiators disagreed about territorial sovereignty.', 'The report avoids taking a position on disputed sovereignty.', 'The constitution sets out principles of state sovereignty.', 'The essay asks how international agreements affect sovereignty.'], '[{"pos": "n", "en": "The authority of a state to govern itself and make decisions about its territory.", "zh": "主权"}]'),
	('bilateral', '双边的', ARRAY['The two countries signed a bilateral trade agreement.', 'The ministers held bilateral talks after the conference.', 'The scholarship is funded through a bilateral programme.', 'The report reviews bilateral cooperation on water management.', 'The dispute affected bilateral relations.', 'The universities established a bilateral exchange scheme.', 'The agreement created a bilateral committee.', 'The meeting addressed bilateral transport links.', 'The two agencies launched a bilateral research project.', 'The article compares bilateral and multilateral negotiations.'], '[{"pos": "adj", "en": "Involving two countries, groups, or parties.", "zh": "双边的"}]'),
	('multilateral', '多边的', ARRAY['The conference aimed to produce a multilateral agreement.', 'The report examines multilateral cooperation on climate policy.', 'Several countries joined the multilateral research programme.', 'The dispute was discussed in a multilateral forum.', 'The proposal seeks support from multilateral institutions.', 'The course compares bilateral and multilateral diplomacy.', 'The initiative uses a multilateral funding model.', 'The delegates agreed to continue multilateral talks.', 'The article describes the challenges of multilateral negotiations.', 'The project requires a multilateral response to shared risks.'], '[{"pos": "adj", "en": "Involving three or more countries or parties working together.", "zh": "多边的"}]'),
	('ceasefire', '停火；停火协议', ARRAY['The negotiators announced a temporary ceasefire.', 'The ceasefire allowed aid workers to enter the area.', 'Both sides agreed to extend the ceasefire.', 'Observers were appointed to monitor the ceasefire.', 'The report describes alleged violations of the ceasefire.', 'The ceasefire began at midnight.', 'The talks focused on maintaining the ceasefire.', 'The agreement sets out conditions for a ceasefire.', 'Residents hoped the ceasefire would lead to lasting peace.', 'A ceasefire does not necessarily settle the underlying dispute.'], '[{"pos": "n", "en": "An agreement or period in which fighting stops, without necessarily ending a conflict.", "zh": "停火；停火协议"}]'),
	('diaspora', '散居海外的群体；海外侨民', ARRAY['The festival brought together members of the diaspora.', 'The museum records stories from the local diaspora.', 'She studies language use within a diaspora community.', 'The diaspora maintains close ties with relatives overseas.', 'The report examines investment by the diaspora.', 'The association supports new arrivals from the diaspora.', 'The novel explores identity and the experience of diaspora.', 'The programme connects young people across the diaspora.', 'The archive includes letters written by members of the diaspora.', 'The researcher interviewed families from several diaspora communities.'], '[{"pos": "n", "en": "A community of people living outside a shared country or region of origin.", "zh": "散居海外的群体；海外侨民"}]'),
	('globalization', '全球化', ARRAY['The essay examines how globalization affects local businesses.', 'Cheaper communication has contributed to globalization.', 'The course explores cultural changes associated with globalization.', 'The report discusses both benefits and risks of globalization.', 'The factory''s supply chain illustrates economic globalization.', 'Students debated the relationship between globalization and inequality.', 'The chapter traces the history of globalization.', 'Globalization can connect producers with distant customers.', 'The article considers how communities respond to globalization.', 'The research distinguishes different measures of globalization.'], '[{"pos": "n", "en": "The increasing connection of countries through trade, communication, movement, and shared activity.", "zh": "全球化"}]'),
	('interdependence', '相互依存', ARRAY['The crisis revealed the interdependence of regional supply chains.', 'The diagram shows interdependence between plants and pollinators.', 'The essay explores economic interdependence between neighbouring countries.', 'The project encourages students to recognize their interdependence.', 'Trade can deepen interdependence between producers and customers.', 'The lecture explains interdependence within an ecosystem.', 'The report highlights the interdependence of energy and water systems.', 'The team discussed interdependence rather than complete self-sufficiency.', 'The agreement acknowledges the interdependence of the two markets.', 'Understanding interdependence can improve joint planning.'], '[{"pos": "n", "en": "A relationship in which people, places, or systems depend on one another.", "zh": "相互依存"}]'),
	('remittance', '汇款；汇款金额', ARRAY['She sends a remittance to her family each month.', 'The bank charged a fee for the remittance.', 'The report compares international remittance services.', 'The family used the remittance to pay school fees.', 'He kept the receipt for the overseas remittance.', 'The app displays the status of each remittance.', 'The study examines how remittance costs affect households.', 'The payment office asked for the remittance reference number.', 'A delayed remittance caused difficulties for the recipient.', 'The survey records the value of the latest remittance.'], '[{"pos": "n", "en": "Money sent to someone in another place, often by a worker to family members overseas.", "zh": "汇款；汇款金额"}]'),
	('tariff', '关税', ARRAY['The importer paid a tariff on the shipment.', 'The proposal would reduce the tariff on certain goods.', 'The report explains how a tariff affects import costs.', 'The two countries negotiated a lower tariff.', 'The retailer reviewed prices after the tariff changed.', 'The chart compares tariff rates across product categories.', 'The agreement includes a timetable for tariff reductions.', 'The company applied for a tariff exemption.', 'The essay distinguishes a tariff from a domestic sales tax.', 'The customs form lists the applicable tariff code.'], '[{"pos": "n", "en": "A tax placed on goods entering or leaving a country.", "zh": "关税"}]'),
	('literacy', '读写能力；识字能力', ARRAY['The library offers adult literacy classes.', 'The programme supports early literacy through shared reading.', 'The survey measures literacy among school leavers.', 'The volunteers received training in literacy teaching.', 'The report links access to books with literacy development.', 'The workshop focuses on digital literacy.', 'Financial literacy helps people interpret everyday money information.', 'The school includes media literacy in its curriculum.', 'The project provides literacy resources in several languages.', 'The study compares different ways of assessing literacy.'], '[{"pos": "n", "en": "The ability to read and write, or to understand and use information in a particular area.", "zh": "读写能力；识字能力"}]'),
	('numeracy', '基本计算能力；数理素养', ARRAY['The course builds confidence in basic numeracy.', 'The assessment includes reading, writing, and numeracy.', 'The teacher used shopping examples to teach numeracy.', 'The workshop helps adults improve workplace numeracy.', 'The report tracks numeracy skills across age groups.', 'Understanding a utility bill requires some numeracy.', 'The game encourages children to practise numeracy.', 'The curriculum connects numeracy with practical problem-solving.', 'The survey asks employers which numeracy skills they need.', 'The project provides free numeracy materials online.'], '[{"pos": "n", "en": "The ability to understand and use numbers in everyday situations.", "zh": "基本计算能力；数理素养"}]'),
	('sanitation', '环境卫生；卫生设施', ARRAY['The project improves access to safe sanitation.', 'The school needs better sanitation facilities.', 'The report examines sanitation in rapidly growing towns.', 'The emergency plan includes water supply and sanitation.', 'The council invested in public sanitation infrastructure.', 'The survey asks households about sanitation services.', 'The camp installed temporary sanitation units.', 'The engineer inspected the village''s sanitation system.', 'Reliable sanitation is important for community health.', 'The proposal includes funding for sanitation maintenance.'], '[{"pos": "n", "en": "Systems and practices for safely handling human waste and keeping living conditions clean.", "zh": "环境卫生；卫生设施"}]'),
	('vaccination', '疫苗接种', ARRAY['The clinic keeps a record of each vaccination.', 'The school sent families information about the vaccination programme.', 'The survey asks about access to vaccination services.', 'The report compares vaccination coverage across districts.', 'The nurse answered questions about the vaccination appointment.', 'The campaign provided vaccination information in several languages.', 'The study examines barriers to vaccination.', 'The health centre opened an additional vaccination room.', 'The form includes a section for vaccination history.', 'The interview focused on communication during the vaccination campaign.'], '[{"pos": "n", "en": "Giving a vaccine to help the body''s immune system recognize a particular infection.", "zh": "疫苗接种"}]'),
	('epidemiology', '流行病学', ARRAY['She is studying epidemiology at university.', 'The course introduces basic methods in epidemiology.', 'The report draws on research in environmental epidemiology.', 'The team combines laboratory work with epidemiology.', 'The lecture explains the role of comparison groups in epidemiology.', 'The journal publishes studies in public health and epidemiology.', 'The project uses epidemiology to investigate patterns of illness.', 'Students discussed the difference between clinical care and epidemiology.', 'The department offers a seminar on cancer epidemiology.', 'Reliable population data are important in epidemiology.'], '[{"pos": "n", "en": "The study of how health conditions are distributed in populations and what influences them.", "zh": "流行病学"}]'),
	('malnutrition', '营养不良', ARRAY['The report examines the causes of childhood malnutrition.', 'The survey screens households for signs of malnutrition.', 'The programme addresses malnutrition through several community services.', 'The study distinguishes different forms of malnutrition.', 'Poverty and limited food access can contribute to malnutrition.', 'The clinic collects data on malnutrition in the district.', 'The course explains why malnutrition is not only a lack of food.', 'The charity supports projects tackling malnutrition.', 'The article discusses malnutrition among older adults.', 'The assessment includes questions about the risk of malnutrition.'], '[{"pos": "n", "en": "Poor health caused by too little, too much, or an unbalanced supply of nutrients.", "zh": "营养不良"}]'),
	('pandemic', '大流行；全球性流行病', ARRAY['The museum collected accounts of daily life during the pandemic.', 'The report reviews lessons from the pandemic.', 'The company changed its working arrangements during the pandemic.', 'The study examines how the pandemic affected education.', 'The emergency plan includes preparation for a future pandemic.', 'The interview focused on travel changes during the pandemic.', 'The pandemic disrupted several international supply chains.', 'The archive contains public notices issued during the pandemic.', 'Researchers compared communication strategies used during the pandemic.', 'The article distinguishes a local outbreak from a pandemic.'], '[{"pos": "n", "en": "An epidemic that spreads across many countries or a very large area.", "zh": "大流行；全球性流行病"}]'),
	('antimicrobial', '抗微生物的', ARRAY['The laboratory tested the material''s antimicrobial properties.', 'The study examines antimicrobial resistance in bacteria.', 'The product label describes an antimicrobial coating.', 'The report calls for careful monitoring of antimicrobial use.', 'The course explains the difference between antimicrobial and antibacterial.', 'The researchers compared several antimicrobial compounds.', 'The project investigates antimicrobial activity under laboratory conditions.', 'The team measured the durability of the antimicrobial surface.', 'The article discusses the limits of antimicrobial product claims.', 'The survey records antimicrobial prescribing practices.'], '[{"pos": "adj", "en": "Acting against microorganisms, such as certain bacteria or fungi.", "zh": "抗微生物的"}]'),
	('telemedicine', '远程医疗', ARRAY['The rural clinic introduced a telemedicine service.', 'The appointment took place through a telemedicine platform.', 'The report compares access to telemedicine across regions.', 'A reliable internet connection is important for telemedicine.', 'The hospital trained staff to use telemedicine equipment.', 'The study examines patient experiences of telemedicine.', 'The service combines telemedicine with in-person appointments.', 'The proposal considers privacy in telemedicine consultations.', 'The interview explored the limitations of telemedicine.', 'The health centre provides a room for telemedicine calls.'], '[{"pos": "n", "en": "Providing clinical care or consultation over a distance using communication technology.", "zh": "远程医疗"}]'),
	('microfinance', '小额金融服务', ARRAY['The cooperative offers microfinance to small traders.', 'The report examines the costs of microfinance loans.', 'The programme combines microfinance with business training.', 'She compared several microfinance providers before applying.', 'The study explores both benefits and risks of microfinance.', 'The organization publishes its microfinance lending terms.', 'The workshop explains savings services within microfinance.', 'The project measures the long-term effects of microfinance.', 'The survey includes customers of local microfinance institutions.', 'The article questions whether microfinance alone can reduce poverty.'], '[{"pos": "n", "en": "Small-scale financial services designed for people or businesses with limited access to conventional banking.", "zh": "小额金融服务"}]'),
	('itinerary', '行程；旅行路线', ARRAY['The travel agent emailed our final itinerary.', 'We added a museum visit to the itinerary.', 'The itinerary includes two days in the mountains.', 'Please check the departure times on your itinerary.', 'She designed an itinerary with fewer hotel changes.', 'Bad weather forced us to revise the itinerary.', 'The guide distributed a printed itinerary to the group.', 'Our itinerary leaves one afternoon free.', 'The application asks for a brief travel itinerary.', 'The itinerary lists every overnight stop.'], '[{"pos": "n", "en": "A plan showing the places and activities included in a journey.", "zh": "行程；旅行路线"}]'),
	('layover', '中途停留；转机等待', ARRAY['We had a three-hour layover between flights.', 'The itinerary includes a layover at the international airport.', 'She used the layover to charge her phone.', 'A long layover can make a cheaper ticket less convenient.', 'The airline provided information about our layover.', 'We stayed inside the terminal during the layover.', 'The travel agent suggested a shorter layover.', 'The delayed flight reduced our layover to forty minutes.', 'They booked a hotel room for the overnight layover.', 'Check whether you need additional documents during the layover.'], '[{"pos": "n", "en": "A temporary stop between parts of a journey, especially while changing flights.", "zh": "中途停留；转机等待"}]'),
	('stopover', '中途停留；中途逗留', ARRAY['We arranged a two-day stopover on the way home.', 'The ticket allows a stopover before the final flight.', 'During the stopover, we explored the old town.', 'She booked a hotel for the stopover.', 'The itinerary includes a stopover to visit relatives.', 'The travel agent explained the conditions of the stopover.', 'A stopover gave us time to rest between long flights.', 'We added a stopover without changing the final destination.', 'The brochure advertises a city stopover package.', 'Check the entry requirements before planning a stopover.'], '[{"pos": "n", "en": "A break in a journey before continuing to the final destination.", "zh": "中途停留；中途逗留"}]'),
	('visa', '签证', ARRAY['She checked whether the journey required a visa.', 'The application form asks for the visa number.', 'He kept a copy of his visa with his travel documents.', 'The website explains the different visa categories.', 'The office requested an additional document for the visa application.', 'Her visa specifies the permitted length of stay.', 'The travel agent reminded us to check the visa conditions.', 'The student applied for a visa before booking the flight.', 'The passport contained a visa for an earlier trip.', 'The report examines delays in visa processing.'], '[{"pos": "n", "en": "Official permission to enter, stay in, or travel through a country under specified conditions.", "zh": "签证"}]'),
	('consulate', '领事馆', ARRAY['She contacted the consulate after losing her passport.', 'The consulate is located near the city centre.', 'He booked an appointment at the consulate.', 'The notice lists the consulate''s opening hours.', 'The consulate requested copies of the supporting documents.', 'The visitors waited outside the consulate.', 'The website provides contact details for the nearest consulate.', 'The consulate issued a public travel notice.', 'The lecture explains the difference between a consulate and an embassy.', 'The family sought information from the consulate.'], '[{"pos": "n", "en": "An office representing a country abroad that provides services such as assistance to its citizens.", "zh": "领事馆"}]'),
	('monsoon', '季风；季风雨季', ARRAY['The farmers prepared their fields before the monsoon.', 'Heavy monsoon rain flooded the road.', 'The report compares the timing of the monsoon across several years.', 'The journey was delayed by the summer monsoon.', 'The climate chart shows a clear monsoon season.', 'The forecast discusses changes in monsoon winds.', 'The reservoir fills during the monsoon.', 'The village repairs its drains before the monsoon begins.', 'The documentary follows farming through the monsoon cycle.', 'The study examines how a weak monsoon affects water supplies.'], '[{"pos": "n", "en": "A seasonal wind system, often associated with a distinct rainy season.", "zh": "季风；季风雨季"}]'),
	('cyclone', '气旋', ARRAY['The forecast tracked a cyclone over the ocean.', 'The island prepared for the approaching tropical cyclone.', 'The diagram shows air moving around a cyclone.', 'The cyclone brought strong winds to the coast.', 'The report reviews the emergency response to the cyclone.', 'The school building was repaired after the cyclone.', 'The satellite image shows the centre of the cyclone.', 'The storm warning described the expected path of the cyclone.', 'The research team compared rainfall before and after the cyclone.', 'The harbour closed as the cyclone moved closer.'], '[{"pos": "n", "en": "A weather system with winds rotating around an area of low atmospheric pressure.", "zh": "气旋"}]'),
	('glacier', '冰川', ARRAY['The guide led us to a viewpoint above the glacier.', 'The glacier moves slowly down the valley.', 'The photograph shows the glacier''s position several decades ago.', 'Meltwater flows from the edge of the glacier.', 'Researchers placed instruments on the glacier.', 'The trail ends before the glacier begins.', 'The report measures changes in the glacier''s thickness.', 'Deep cracks formed across the surface of the glacier.', 'The museum displays a model of a mountain glacier.', 'The study compares the glacier with neighbouring ice fields.'], '[{"pos": "n", "en": "A large mass of ice that forms on land and moves slowly under its own weight.", "zh": "冰川"}]'),
	('tsunami', '海啸', ARRAY['The coastal town installed a tsunami warning sign.', 'The drill practised evacuation after a tsunami alert.', 'The museum explains how a tsunami can form.', 'The map identifies areas exposed to tsunami risk.', 'The report reviews communication during the tsunami emergency.', 'The school marked a route to higher ground for a tsunami evacuation.', 'The researchers used a model to study tsunami waves.', 'The documentary includes accounts from tsunami survivors.', 'The harbour was rebuilt after the tsunami.', 'The lesson distinguishes a tsunami from an ordinary wind-driven wave.'], '[{"pos": "n", "en": "A series of large sea waves caused by a major displacement of water, often after an undersea earthquake.", "zh": "海啸"}]'),
	('multiculturalism', '多元文化主义；多元文化共存', ARRAY['The essay explores multiculturalism in urban communities.', 'The festival celebrates multiculturalism through food and music.', 'The course examines different approaches to multiculturalism.', 'The report discusses multiculturalism in public education.', 'Students debated the relationship between multiculturalism and social inclusion.', 'The museum presents local stories of multiculturalism.', 'The policy statement expresses support for multiculturalism.', 'The research investigates everyday experiences of multiculturalism.', 'The library organized a discussion about language and multiculturalism.', 'The article distinguishes multiculturalism as a social reality from a policy approach.'], '[{"pos": "n", "en": "The presence or support of different cultural communities within one society.", "zh": "多元文化主义；多元文化共存"}]')
) AS v(word, meaning, examples, senses)
WHERE NOT EXISTS (
    SELECT 1 FROM english_cards WHERE lower(english_cards.word) = lower(v.word)
);
`},
{18, `
UPDATE english_cards SET pronunciation = '/klɒɡ/' WHERE lower(word) = 'clog' AND (pronunciation = '' OR pronunciation LIKE '%...%');
UPDATE english_cards SET meaning = '堵塞，阻塞；阻碍；木屐' WHERE lower(word) = 'clog' AND (meaning LIKE '%堵塞阻碍障碍碍%' OR meaning = '');
UPDATE english_cards SET pronunciation = '/pəˈdes.tri.ə.naɪzd/' WHERE lower(word) = 'pedestrianized' AND (pronunciation = '' OR pronunciation LIKE '%...%');
UPDATE english_cards SET pronunciation = '/ˈbaɪ.lɔː/' WHERE lower(word) = 'bylaw' AND (pronunciation = '' OR pronunciation LIKE '%...%');
UPDATE english_cards SET pronunciation = '/ˈslʌɡ.ɪʃ/' WHERE lower(word) = 'sluggish' AND (pronunciation = '' OR pronunciation LIKE '%...%');
UPDATE english_cards SET pronunciation = '/prɪˌsɪp.ɪˈteɪ.ʃən/' WHERE lower(word) = 'precipitation' AND (pronunciation = '' OR pronunciation LIKE '%...%');
UPDATE english_cards SET pronunciation = '/kəˈmjuːt/' WHERE lower(word) = 'commute' AND (pronunciation = '' OR pronunciation LIKE '%...%');
UPDATE english_cards SET pronunciation = '/ˈkrɒs.wɪnd/' WHERE lower(word) = 'crosswind' AND (pronunciation = '' OR pronunciation LIKE '%...%');
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
