# Reading learning experience

The Reading dashboard uses the existing React router, UI components, English
vocabulary cards, Go API and PostgreSQL store. It keeps Academic and General
Training libraries, timed exams, practice feedback, histories and AI generation.
The seven dashboard sections follow the learning sequence: welcome, daily
challenge, unfinished practice, recommendations, activity, library, then review.
Detailed performance and passage evidence use native disclosure controls.

## Modified file groups

| Area | Files |
| --- | --- |
| Dashboard and review | `src/pages/reading-page.tsx`, `src/components/reading-learning-overview.tsx`, `src/components/reading-learning-review.tsx` |
| Reading and vocabulary UI | `src/components/reading-exam.tsx`, `src/components/reading-results.tsx`, `src/pages/english-page.tsx`, `src/components/lesson-player.tsx`, `src/i18n/messages.ts` |
| Shared client data | `src/hooks/use-learning-progress.ts`, `src/lib/api.ts`, `src/lib/reading.ts` |
| Persistence and API | `server/internal/desk/migrate.go`, `learning.go`, `learning_http.go`, `reading_learning.go`, `reading_vocabulary.go`, `reading.go`, `http.go` |
| Verification and development | `server/internal/desk/reading_learning_test.go`, `e2e/cypress/e2e/reading-learning.cy.ts`, `e2e/cypress/e2e/reading.cy.ts`, `e2e/cypress.config.ts`, `vite.config.ts` |
| Documentation | `docs/reading-learning.md`, `docs/reading-practice.md`, `e2e/README.md` |

## Persistence and migration

Migration **13** runs through the existing transactional startup migrator. No
manual SQL or new service is required. It adds:

- `learning_profile`: the workspace timezone, completed vocabulary lessons and
  one-time legacy import state.
- `learning_events`: unique reward events and actual activity dates shared by
  reading and vocabulary.
- `reading_daily_challenges`: one session for each server-calculated day/module.
- `reading_mistakes` and `reading_review_items`: original question/passage
  snapshots, incorrect answers, retries and correct retries.
- `reading_vocabulary`: real source context linked to existing English cards.
- Session kind/challenge metadata and hidden test snapshots for daily and review
  sessions. Hidden tests do not appear in the library or support ordinary cloning.

Historical submitted results backfill genuine mistakes. Profile initialization
imports real historical reading activity with **zero retrospective XP**. Existing
browser vocabulary progress is imported once when a browser with nonempty legacy
progress connects. Its XP and completed lessons are retained, together with the
known last day/streak; unknown historical dates are not invented. The original
local storage is retained rather than rewritten with combined reading XP.

The English examples constraint now permits 1–10 examples: passage words have one
real context example, rather than nine fabricated extras. Existing ordinary card
creation still requires ten examples through its existing validation.

## Rewards, days and resuming

Reading submission locks the session row and commits grading, saved answers,
mistakes and its reward event in one transaction. The `reading:<session UUID>`
event key prevents repeat submissions and concurrent requests from awarding XP
twice. Each correct reading answer earns 10 XP, matching the existing vocabulary
rule. A newly started ordinary practice attempt is a separate rewarded session.

Daily creation takes an advisory transaction lock and has a `(day,module)` unique
constraint. Starting again resumes the same active session or opens its completed
summary. Five existing related questions and their actual evidence paragraphs
form a short excerpt of at most 550 words. Five minutes is a learning target,
not an exam deadline. All five answers must be present before completion.

Mistake review resumes an existing matching module/type review or snapshots up to
ten open mistakes. Each question needs an answer before finishing. Correct retries
resolve the original mistakes; wrong retries update their counts. Duplicate
submission cannot increment retry counts. The dashboard lists the most recent
50 mistakes per filter, and exposes the question-type totals separately.

The first profile initialization stores the browser's IANA timezone, or UTC for a
bare API request. Dates and streak boundaries then use that stable timezone on
the server. Timezone data is embedded for minimal container portability. The
weekly calendar reports the last seven calendar days with actual completions.

Vocabulary completion locks the shared profile, persists completed lesson
indices, and rewards each lesson once. Replaying a lesson on another day can
record activity without another XP reward. The UI uses server-confirmed
`awardedXP`, including zero for repeat/retried submissions. Reading answers are
graded by the server; vocabulary retains its existing client-supplied correct
count contract, validated to the lesson's supported 0–10 range.

## Recommendations and review

Recommendations inspect the most recent 200 submitted standard/daily sessions in
the selected module, excluding mistake retries. They count the latest result for
each distinct source question; fingerprints prevent full papers, passage drills
and daily snapshots from inflating confidence by repeating the same question.
At least five distinct questions are needed to display a type's accuracy. Weakness
uses smoothed accuracy `(correct + 2) / (sample + 4)` and recency, with more weight
on accuracy. Recommendations reuse available module-specific exercises; these
may contain previously seen material. Sparse histories receive starter exercises
without invented accuracy. The existing band analytics remain separate and omit
daily/review sessions.

Saved mistakes contain original answer keys, explanations and passage evidence.
These appear behind a disclosure so learners can recall before revealing them.
Retry and correct-retry counts describe improvement without claiming mastery.

The practice vocabulary drawer accepts selected or typed passage words. The API
checks the actual passage/paragraph, stores its full context, reuses or creates
an English card and adds it to the existing review list. Definitions from known
cards or available providers can be used; otherwise learners enter a definition.
No generic fallback is presented as a verified definition. Active timed exams
continue to block assistance; words can be saved after submission.

## Scope and limitations

The existing app has a **single shared workspace**, without learner sign-in or
per-user reading ownership. Its admin token protects AI settings, not learner
sessions. Learning therefore follows the same workspace scope; this change does
not claim authenticated individual personalization. Adding learner identities
later requires scoped ownership and migration of existing shared data.

The first nonempty browser legacy import wins for the shared workspace. Other
browsers' old local-only histories cannot be merged automatically without risking
duplicate rewards. Vocabulary lessons retain the existing index-based identity.
Daily variety depends on the existing question bank and is not guaranteed to be
unseen or official IELTS material. The dashboard uses recorded progress only;
failed loads show unavailable/loading states and keep standard practice usable.

## Verification

Run backend unit tests from `server`:

```sh
go test -race -mod=vendor ./...
```

Set `PROJECT_DESK_TEST_DATABASE_URL` to an isolated PostgreSQL database to also run
the integration tests. They create and remove their own unique schemas. Coverage
includes migration from version 12, genuine historical mistake/activity backfill,
simultaneous starts/submissions, answer persistence, repeat reward prevention,
mistake resolution, shared vocabulary rewards, legacy import and timezone/streak
boundaries. Mixed daily-excerpt/full-passage reviews retain each question's
original evidence. Unit tests validate five-question evidence-grounded challenges for
both modules and recommendation sample size, recency and source deduplication.

Frontend checks from `project-desk` and `e2e`, respectively:

```sh
npm run build
npm run typecheck
```

Browser write tests require a fresh disposable application database. They are
disabled by default to avoid adding test sessions/rewards to deployed learners'
progress. Start the API against the disposable database, then run from `e2e`:

```sh
env -u ELECTRON_RUN_AS_NODE \
  E2E_BASE_URL=http://127.0.0.1:17311 \
  E2E_ALLOW_LEARNING_WRITES=true E2E_RETRIES=0 \
  npx cypress run --browser electron \
  --spec cypress/e2e/reading-learning.cy.ts,cypress/e2e/reading.cy.ts
```

The writing specs persist real answers, XP and vocabulary. They need a new
workspace on each daily test run because a completed daily attempt intentionally
cannot be recreated that day. They do not call paid enrichment providers.
Read-only checks exercise dashboard order, keyboard tabs, mobile width, failure
recovery and library navigation without the write flag. Existing exam coverage
checks briefing, answer redaction, review, autosave/reload, authoritative timing
and retry after failed automatic submission.

For isolated ports, set API `PORT=17492` and run Vite with
`PROJECT_DESK_API_PROXY=http://127.0.0.1:17492 npm run dev -- --port 17311`.
The proxy defaults to the original API port when this variable is absent.
