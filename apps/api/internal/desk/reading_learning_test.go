package desk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestLearningStreakAcrossCalendarBoundaries(t *testing.T) {
	for _, test := range []struct {
		name, today, legacy string
		days                []string
		legacyStreak, want  int
	}{
		{"new learner", "2026-11-08", "", nil, 0, 0},
		{"today and yesterday", "2026-11-08", "", []string{"2026-11-08", "2026-11-07"}, 0, 2},
		{"rest of current day remains open", "2026-11-08", "", []string{"2026-11-07", "2026-11-06"}, 0, 2},
		{"missed day resets", "2026-11-08", "", []string{"2026-11-06"}, 0, 0},
		{"month boundary", "2026-03-01", "", []string{"2026-03-01", "2026-02-28"}, 0, 2},
		{"leap day", "2024-03-01", "", []string{"2024-03-01", "2024-02-29", "2024-02-28"}, 0, 3},
		{"legacy streak connects without invented dates", "2026-11-08", "2026-11-07", []string{"2026-11-08"}, 4, 5},
		{"stale legacy streak expires", "2026-11-08", "2026-10-01", nil, 4, 0},
	} {
		t.Run(test.name, func(t *testing.T) {
			days := map[string]bool{}
			for _, day := range test.days {
				days[day] = true
			}
			if got := learningStreak(days, test.today, test.legacy, test.legacyStreak); got != test.want {
				t.Fatalf("got %d want %d", got, test.want)
			}
		})
	}
	if _, err := learningLocation("America/Los_Angeles"); err != nil {
		t.Fatal("portable timezone data is missing:", err)
	}
	if _, err := learningLocation("not-a-timezone"); !errors.Is(err, ErrInvalid) {
		t.Fatal("invalid timezone accepted")
	}
}

func TestDailyChallengeUsesFiveGroundedQuestionsInBothModules(t *testing.T) {
	tests := builtinReadingTests()
	for _, module := range []string{"academic", "general"} {
		for offset := 0; offset < 30; offset++ {
			day := time.Date(2026, 11, 1+offset, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
			challenge, err := buildDailyReadingTest(tests, module, day)
			if err != nil {
				t.Fatal(err)
			}
			repeated, _ := buildDailyReadingTest(tests, module, day)
			if len(challenge.Questions) != 5 || len(challenge.Passages) != 1 || challenge.DurationSeconds != 300 || challenge.Module != module || challenge.Title != repeated.Title {
				t.Fatalf("invalid daily challenge: %+v", challenge)
			}
			if challenge.Passages[0].WordCount > 550 {
				t.Fatal("daily excerpt is too long")
			}
			if err := validateSeedTest(challenge); err != nil {
				t.Fatal(err)
			}
			text := ""
			for _, p := range challenge.Passages[0].Paragraphs {
				text += p.Text
			}
			answers := map[string]string{}
			for _, q := range challenge.Questions {
				if !strings.Contains(text, q.EvidenceQuote) {
					t.Fatalf("question %d lost its evidence", q.Number)
				}
				answers[q.ID] = q.CorrectAnswer
			}
			if score := ScoreReadingSession(challenge, answers, 300); score.Score != 5 {
				t.Fatal("daily answer key failed")
			}
		}
	}
}

func TestRecommendationsRespectSampleSizeRecencyAndModule(t *testing.T) {
	now := time.Date(2026, 11, 8, 12, 0, 0, 0, time.UTC)
	tests := builtinReadingTests()
	for i := range tests {
		tests[i].ID = tests[i].Slug
	}
	starter := buildReadingRecommendations(tests, nil, "academic", now)
	if len(starter) == 0 {
		t.Fatal("new learner has no starter exercises")
	}
	for _, item := range starter {
		if item.Accuracy != nil || item.SampleSize != 0 {
			t.Fatal("fabricated starter accuracy")
		}
	}
	session := ReadingSession{TestID: "source", Module: "academic", Status: "submitted", Kind: "standard", UpdatedAt: now, Results: &ReadingSessionResults{}}
	for i := 0; i < 6; i++ {
		session.Results.Questions = append(session.Results.Questions, ReadingQuestionResult{QuestionID: fmt.Sprint(i), QuestionKey: fmt.Sprintf("shared-question-%d", i), Type: QTrueFalseNotGiven, Correct: i == 0})
	}
	session.Results.Questions = append(session.Results.Questions, ReadingQuestionResult{QuestionID: "tiny", Type: QMatchingHeadings, Correct: false})
	cloned := session
	cloned.TestID = "another-daily-or-drill-containing-the-same-questions"
	recommendations := buildReadingRecommendations(tests, []ReadingSession{session, cloned}, "academic", now)
	if len(recommendations) == 0 || recommendations[0].Type != QTrueFalseNotGiven || recommendations[0].SampleSize != 6 || recommendations[0].Accuracy == nil {
		t.Fatalf("weak type was not recommended with distinct evidence: %+v", recommendations)
	}
	for _, item := range recommendations {
		if item.Type == QMatchingHeadings && item.Accuracy != nil {
			t.Fatal("a single error was labelled a weakness")
		}
	}
	general := buildReadingRecommendations(tests, []ReadingSession{session}, "general", now)
	for _, item := range general {
		if item.Accuracy != nil {
			t.Fatal("Academic history leaked into General recommendations")
		}
	}
	old := session
	old.UpdatedAt = now.Add(-21 * 24 * time.Hour)
	if items := buildReadingRecommendations(tests, []ReadingSession{old}, "academic", now); !strings.Contains(items[0].Reason, "recently") {
		t.Fatal("stale practice was not acknowledged")
	}
}

func learningTestStore(t *testing.T, legacy bool) *Store {
	t.Helper()
	databaseURL := os.Getenv("PROJECT_DESK_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set PROJECT_DESK_TEST_DATABASE_URL to run PostgreSQL persistence checks")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	schemaName := fmt.Sprintf("reading_learning_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+pgx.Identifier{schemaName}.Sanitize()); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schemaName
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+pgx.Identifier{schemaName}.Sanitize()+" CASCADE")
		admin.Close()
	})
	store := &Store{pool: pool}
	for _, sql := range []string{schema, cycleSchema} {
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	if legacy {
		if _, err := pool.Exec(ctx, `CREATE TABLE schema_migrations (version INT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
			t.Fatal(err)
		}
		for _, migration := range migrations {
			if migration.version >= 13 {
				break
			}
			if _, err := pool.Exec(ctx, migration.sql); err != nil {
				t.Fatal(err)
			}
			if _, err := pool.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES ($1)`, migration.version); err != nil {
				t.Fatal(err)
			}
		}
		if err := store.seedReading(ctx); err != nil {
			t.Fatal(err)
		}
		test := builtinReadingTests()[0]
		var id string
		if err := pool.QueryRow(ctx, `SELECT id::text FROM reading_tests WHERE slug=$1`, test.Slug).Scan(&id); err != nil {
			t.Fatal(err)
		}
		result, _ := json.Marshal(ScoreReadingSession(test, nil, 120))
		if _, err := pool.Exec(ctx, `INSERT INTO reading_sessions (test_id,mode,module,status,total,results,submitted_at) VALUES ($1,'practice','academic','submitted',40,$2::jsonb,now())`, id, result); err != nil {
			t.Fatal(err)
		}
	}
	if err := migrate(ctx, store); err != nil {
		t.Fatal(err)
	}
	if !legacy {
		if err := store.seedReading(ctx); err != nil {
			t.Fatal(err)
		}
	}
	return store
}

func TestReadingLearningPostgresPersistenceAndIdempotentRewards(t *testing.T) {
	store := learningTestStore(t, false)
	ctx := context.Background()
	zone := "America/Los_Angeles"
	initial, err := store.GetReadingLearning(ctx, "academic", zone)
	if err != nil {
		t.Fatal(err)
	}
	if initial.Progress.XP != 0 || initial.Progress.Streak != 0 || initial.Mistakes.Open != 0 {
		t.Fatal("new workspace contains invented progress")
	}
	var group sync.WaitGroup
	ids := make(chan string, 8)
	for i := 0; i < 8; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			bundle, err := store.StartDailyReading(ctx, "academic", zone)
			if err != nil {
				t.Error(err)
				return
			}
			ids <- bundle.Session.ID
		}()
	}
	group.Wait()
	close(ids)
	sessionID := ""
	for id := range ids {
		if sessionID == "" {
			sessionID = id
		}
		if id != sessionID {
			t.Fatal("concurrent starts created different daily attempts")
		}
	}
	bundle, err := store.GetReadingSession(ctx, sessionID)
	if err != nil {
		t.Fatal(err)
	}
	if len(bundle.Test.Questions) != 5 || bundle.Test.Questions[0].CorrectAnswer != "" {
		t.Fatal("daily question shape or redaction failed")
	}
	full, err := store.GetReadingTest(ctx, bundle.Test.ID, true)
	if err != nil {
		t.Fatal(err)
	}
	first := full.Questions[0]
	if _, err := store.UpdateReadingSession(ctx, sessionID, ReadingSessionPatch{Answers: map[string]string{first.ID: "wrong"}, ElapsedSeconds: 40}); err != nil {
		t.Fatal(err)
	}
	reloaded, err := store.GetReadingSession(ctx, sessionID)
	if err != nil || reloaded.Session.Answers[first.ID] != "wrong" {
		t.Fatal("answers did not persist")
	}
	if _, err := store.SubmitReadingSession(ctx, sessionID, ReadingSessionPatch{}); !errors.Is(err, ErrInvalid) {
		t.Fatal("an incomplete daily challenge was submitted")
	}
	answers := map[string]string{}
	for _, q := range full.Questions {
		answers[q.ID] = q.CorrectAnswer
	}
	answers[first.ID] = "wrong"
	for i := 0; i < 8; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			result, err := store.SubmitReadingSession(ctx, sessionID, ReadingSessionPatch{Answers: answers, ElapsedSeconds: 120})
			if err != nil {
				t.Error(err)
				return
			}
			if result.Session.XPEarned != 40 {
				t.Errorf("wrong earned XP %d", result.Session.XPEarned)
			}
		}()
	}
	group.Wait()
	progress, err := store.GetLearningProgress(ctx, zone)
	if err != nil {
		t.Fatal(err)
	}
	if progress.XP != 40 || progress.Streak != 1 {
		t.Fatalf("duplicate reward or wrong streak: %+v", progress)
	}
	again, err := store.StartDailyReading(ctx, "academic", zone)
	if err != nil || again.Session.ID != sessionID || again.Session.Status != "submitted" {
		t.Fatal("completed daily challenge was replaced")
	}
	if _, err := store.StartReadingSession(ctx, full.ID, "practice", 300); !errors.Is(err, ErrInvalid) {
		t.Fatal("hidden daily test could be cloned for rewards")
	}
	mistakes, err := store.ListReadingMistakes(ctx, "academic", "", false)
	if err != nil || len(mistakes) != 1 {
		t.Fatalf("wrong mistake queue: %d %v", len(mistakes), err)
	}
	review, err := store.StartReadingMistakeReview(ctx, "academic", first.Type)
	if err != nil {
		t.Fatal(err)
	}
	resumed, err := store.StartReadingMistakeReview(ctx, "academic", first.Type)
	if err != nil || resumed.Session.ID != review.Session.ID {
		t.Fatal("mistake review cannot resume")
	}
	if _, err := store.SubmitReadingSession(ctx, review.Session.ID, ReadingSessionPatch{}); !errors.Is(err, ErrInvalid) {
		t.Fatal("blank review submission counted as a retry")
	}
	unchanged, err := store.ListReadingMistakes(ctx, "academic", "", false)
	if err != nil || len(unchanged) != 1 || unchanged[0].RetryCount != 0 {
		t.Fatal("incomplete review changed improvement history")
	}
	reviewTest, err := store.GetReadingTest(ctx, review.Test.ID, true)
	if err != nil {
		t.Fatal(err)
	}
	retryAnswers := map[string]string{}
	for _, q := range reviewTest.Questions {
		retryAnswers[q.ID] = q.CorrectAnswer
	}
	if _, err := store.SubmitReadingSession(ctx, review.Session.ID, ReadingSessionPatch{Answers: retryAnswers, ElapsedSeconds: 30}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.SubmitReadingSession(ctx, review.Session.ID, ReadingSessionPatch{Answers: retryAnswers}); err != nil {
		t.Fatal(err)
	}
	resolved, err := store.ListReadingMistakes(ctx, "academic", "", true)
	if err != nil || len(resolved) != 1 || resolved[0].RetryCount != 1 || resolved[0].CorrectRetries != 1 {
		t.Fatalf("retry improvement or duplicate retry tracking failed: %+v %v", resolved, err)
	}
	paragraph := full.Passages[0].Paragraphs[0]
	term := strings.Trim(strings.Fields(paragraph.Text)[0], ".,:;\"'")
	wordInput := SaveReadingWordRequest{SessionID: sessionID, PassageID: full.Passages[0].ID, ParagraphLabel: paragraph.Label, Selection: term, Definition: "A word saved from the passage for review."}
	card, err := store.SaveReadingWord(ctx, wordInput)
	if err != nil {
		t.Fatal(err)
	}
	same, err := store.SaveReadingWord(ctx, wordInput)
	if err != nil || same.ID != card.ID || !same.InReview {
		t.Fatal("vocabulary saving was not idempotent")
	}
	words, err := store.ListReadingVocabulary(ctx)
	if err != nil || len(words) != 1 || words[0].Context != paragraph.Text {
		t.Fatalf("reading context did not persist: %+v %v", words, err)
	}
	wordInput.Selection = "thisisnotinthepassage"
	if _, err := store.SaveReadingWord(ctx, wordInput); !errors.Is(err, ErrInvalid) {
		t.Fatal("non-passage vocabulary accepted")
	}
	imported, err := store.ImportLearningProgress(ctx, legacyLearningProgress{XP: 70, Streak: 2, LastDay: previousLearningDay(initial.Daily.Day), Completed: []int{1}}, zone)
	if err != nil {
		t.Fatal(err)
	}
	if imported.XP != 120 || imported.Streak != 3 {
		t.Fatalf("legacy progress did not merge correctly: %+v", imported)
	}
	repeated, err := store.ImportLearningProgress(ctx, legacyLearningProgress{XP: 70, Streak: 2, LastDay: previousLearningDay(initial.Daily.Day), Completed: []int{1}}, zone)
	if err != nil || repeated.XP != 120 {
		t.Fatal("legacy progress was imported twice")
	}
	vocab, err := store.CompleteVocabularyLesson(ctx, 0, 8, zone)
	if err != nil {
		t.Fatal(err)
	}
	repeat, err := store.CompleteVocabularyLesson(ctx, 0, 8, zone)
	if err != nil || vocab.XP != 200 || repeat.XP != 200 {
		t.Fatalf("shared vocabulary XP duplicated: %+v %+v %v", vocab, repeat, err)
	}
	if vocab.AwardedXP == nil || *vocab.AwardedXP != 80 || repeat.AwardedXP == nil || *repeat.AwardedXP != 0 {
		t.Fatal("the completion response must report the actual new XP, including zero for replay")
	}
	general, err := store.StartDailyReading(ctx, "general", zone)
	if err != nil || general.Session.Module != "general" || general.Session.ID == sessionID {
		t.Fatal("General Training was not preserved")
	}
	dashboard, err := store.GetReadingLearning(ctx, "academic", zone)
	if err != nil {
		t.Fatal(err)
	}
	if dashboard.Mistakes.Resolved != 1 || dashboard.Progress.XP != 200 || dashboard.Mistakes.Open != 0 {
		t.Fatalf("dashboard progress is inconsistent: %+v", dashboard)
	}
}

func TestReadingLearningMigrationBackfillsActualHistory(t *testing.T) {
	store := learningTestStore(t, true)
	ctx := context.Background()
	dashboard, err := store.GetReadingLearning(ctx, "academic", "UTC")
	if err != nil {
		t.Fatal(err)
	}
	if dashboard.Mistakes.Open != 40 || dashboard.ReadingCompletions != 1 || dashboard.Progress.XP != 0 || dashboard.Progress.Streak != 1 {
		t.Fatalf("historical activity or mistakes were lost, or historical XP invented: %+v", dashboard)
	}
	if err := migrate(ctx, store); err != nil {
		t.Fatal("migration is not restart-safe:", err)
	}
}

func TestReadingMistakeReviewPreservesExcerptAndFullPassageEvidence(t *testing.T) {
	store := learningTestStore(t, false)
	ctx := context.Background()
	var testID string
	if err := store.pool.QueryRow(ctx, `SELECT id::text FROM reading_tests WHERE slug=$1`, builtinReadingTests()[0].Slug).Scan(&testID); err != nil {
		t.Fatal(err)
	}
	test, err := store.GetReadingTest(ctx, testID, true)
	if err != nil {
		t.Fatal(err)
	}
	first := test.Questions[0]
	var other ReadingQuestion
	var source ReadingPassage
	for _, passage := range test.Passages {
		if passage.ID == first.PassageID {
			source = passage
		}
	}
	for _, question := range test.Questions {
		if question.PassageID == first.PassageID && question.EvidenceParagraph != first.EvidenceParagraph {
			other = question
			break
		}
	}
	if other.ID == "" {
		t.Fatal("fixture needs two genuine evidence paragraphs")
	}
	excerpt := source
	excerpt.Paragraphs = nil
	for _, paragraph := range source.Paragraphs {
		if paragraph.Label == first.EvidenceParagraph {
			excerpt.Paragraphs = append(excerpt.Paragraphs, paragraph)
		}
	}
	// An older daily excerpt must not replace the full paper's later evidence.
	for index, item := range []struct {
		question ReadingQuestion
		passage  ReadingPassage
	}{{first, excerpt}, {other, source}} {
		question, _ := json.Marshal(item.question)
		passage, _ := json.Marshal(item.passage)
		if _, err := store.pool.Exec(ctx, `INSERT INTO reading_mistakes (test_id,question_id,module,question,passage,last_wrong_at) VALUES ($1,$2,'academic',$3::jsonb,$4::jsonb,$5)`, testID, item.question.ID, question, passage, time.Date(2026, 1, index+1, 0, 0, 0, 0, time.UTC)); err != nil {
			t.Fatal(err)
		}
	}
	review, err := store.StartReadingMistakeReview(ctx, "academic", "")
	if err != nil {
		t.Fatal(err)
	}
	full, err := store.GetReadingTest(ctx, review.Test.ID, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(full.Questions) != 2 || len(full.Passages) != 2 {
		t.Fatal("different source snapshots were conflated")
	}
	for _, question := range full.Questions {
		found := false
		for _, passage := range full.Passages {
			if passage.ID != question.PassageID {
				continue
			}
			for _, paragraph := range passage.Paragraphs {
				found = found || (paragraph.Label == question.EvidenceParagraph && strings.Contains(paragraph.Text, question.EvidenceQuote))
			}
		}
		if !found {
			t.Fatalf("review question %d lost its passage evidence", question.Number)
		}
	}
}
