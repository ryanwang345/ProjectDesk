package desk

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/crc32"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type ReadingRecommendation struct {
	TestID          string     `json:"testId"`
	Title           string     `json:"title"`
	Type            string     `json:"type"`
	Reason          string     `json:"reason"`
	Accuracy        *float64   `json:"accuracy,omitempty"`
	SampleSize      int        `json:"sampleSize"`
	LastPracticed   *time.Time `json:"lastPracticed,omitempty"`
	QuestionCount   int        `json:"questionCount"`
	DurationSeconds int        `json:"durationSeconds"`
}

type ReadingMistake struct {
	ID             string          `json:"id"`
	Module         string          `json:"module"`
	Question       ReadingQuestion `json:"question"`
	Passage        ReadingPassage  `json:"passage"`
	UserAnswer     string          `json:"userAnswer"`
	IncorrectCount int             `json:"incorrectCount"`
	RetryCount     int             `json:"retryCount"`
	CorrectRetries int             `json:"correctRetries"`
	FirstWrongAt   time.Time       `json:"firstWrongAt"`
	LastWrongAt    time.Time       `json:"lastWrongAt"`
	ResolvedAt     *time.Time      `json:"resolvedAt,omitempty"`
}

type MistakeTypeSummary struct {
	Type     string `json:"type"`
	Open     int    `json:"open"`
	Resolved int    `json:"resolved"`
}
type ReadingMistakeSummary struct {
	Open           int                  `json:"open"`
	Resolved       int                  `json:"resolved"`
	Retries        int                  `json:"retries"`
	CorrectRetries int                  `json:"correctRetries"`
	ByType         []MistakeTypeSummary `json:"byType"`
}

type DailyReadingSummary struct {
	Day     string          `json:"day"`
	Title   string          `json:"title"`
	Session *ReadingSession `json:"session,omitempty"`
}

type ReadingLearningDashboard struct {
	Progress           LearningProgress        `json:"progress"`
	Daily              DailyReadingSummary     `json:"daily"`
	ActiveSessions     []ReadingSession        `json:"activeSessions"`
	Recommendations    []ReadingRecommendation `json:"recommendations"`
	Mistakes           ReadingMistakeSummary   `json:"mistakes"`
	ReadingCompletions int                     `json:"readingCompletions"`
	QuestionsAnswered  int                     `json:"questionsAnswered"`
}

func (s *Store) readingLearningTests(ctx context.Context) ([]ReadingTest, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+readingTestColumns+` FROM reading_tests WHERE NOT hidden ORDER BY slug`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tests := []ReadingTest{}
	for rows.Next() {
		test, err := scanReadingTest(rows, true)
		if err != nil {
			return nil, err
		}
		tests = append(tests, test)
	}
	return tests, rows.Err()
}

// Select five related extractive questions. Their evidence paragraphs form a
// short, genuine excerpt; heading/diagram tasks that need a whole text are kept
// in the library. The original paper's answer keys are retained server-side.
func buildDailyReadingTest(tests []ReadingTest, module, day string) (ReadingTest, error) {
	type candidate struct {
		passage   ReadingPassage
		questions []ReadingQuestion
	}
	candidates := []candidate{}
	eligible := map[string]bool{QTrueFalseNotGiven: true, QYesNoNotGiven: true, QSentenceCompletion: true, QShortAnswer: true, QMultipleChoice: true, QTableCompletion: true}
	for _, test := range tests {
		if test.Module != module || test.Category != "full" {
			continue
		}
		for _, passage := range test.Passages {
			grouped := map[string][]ReadingQuestion{}
			order := []string{}
			for _, q := range test.Questions {
				if q.PassageID != passage.ID || !eligible[q.Type] || q.ContextText != "" {
					continue
				}
				if _, ok := grouped[q.Type]; !ok {
					order = append(order, q.Type)
				}
				grouped[q.Type] = append(grouped[q.Type], q)
			}
			for _, kind := range order {
				questions := grouped[kind]
				if len(questions) < 5 {
					continue
				}
				offset := int(crc32.ChecksumIEEE([]byte(day+passage.ID))) % (len(questions) - 4)
				selected := append([]ReadingQuestion(nil), questions[offset:offset+5]...)
				labels := map[string]bool{}
				for _, q := range selected {
					labels[q.EvidenceParagraph] = true
				}
				excerpt := passage
				excerpt.Paragraphs = nil
				excerpt.WordCount = 0
				excerpt.Index = 1
				for _, paragraph := range passage.Paragraphs {
					if labels[paragraph.Label] {
						excerpt.Paragraphs = append(excerpt.Paragraphs, paragraph)
						excerpt.WordCount += len(strings.Fields(paragraph.Text))
					}
				}
				if excerpt.WordCount > 0 && excerpt.WordCount <= 550 {
					candidates = append(candidates, candidate{excerpt, selected})
				}
			}
		}
	}
	if len(candidates) == 0 {
		return ReadingTest{}, fmt.Errorf("%w: no five-question challenge is available for this module", ErrInvalid)
	}
	chosen := candidates[int(crc32.ChecksumIEEE([]byte(day+module)))%len(candidates)]
	questions := renumberQuestions(chosen.questions)
	instruction := "Questions 1–5: Complete the answers using the excerpt. Follow the word limit shown for each question."
	switch questions[0].Type {
	case QTrueFalseNotGiven:
		instruction = "Questions 1–5: Do the statements agree with the excerpt? Choose TRUE, FALSE or NOT GIVEN."
	case QYesNoNotGiven:
		instruction = "Questions 1–5: Do the statements agree with the writer's views? Choose YES, NO or NOT GIVEN."
	case QMultipleChoice:
		instruction = "Questions 1–5: Choose the correct letter, A, B, C or D."
	}
	for i := range questions {
		questions[i].GroupInstruction = instruction
	}
	chosen.passage.Subtitle = "A short excerpt for today's five-question practice."
	return ReadingTest{Slug: "daily-" + module + "-" + day, Title: chosen.passage.Title, Subtitle: "Daily reading · 5 questions · about 5 minutes", Module: module, Category: "question_type", Difficulty: "Daily practice", DurationSeconds: 300, QuestionCount: 5, Passages: []ReadingPassage{chosen.passage}, Questions: questions}, nil
}

func insertLearningReadingTest(ctx context.Context, tx pgx.Tx, test ReadingTest) (string, error) {
	passages, err := json.Marshal(test.Passages)
	if err != nil {
		return "", err
	}
	questions, err := json.Marshal(test.Questions)
	if err != nil {
		return "", err
	}
	var id string
	err = tx.QueryRow(ctx, `INSERT INTO reading_tests (slug,title,subtitle,module,category,difficulty,duration_seconds,passages,questions,hidden) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,true) RETURNING id::text`, test.Slug, test.Title, test.Subtitle, test.Module, test.Category, test.Difficulty, test.DurationSeconds, passages, questions).Scan(&id)
	return id, err
}

func (s *Store) StartDailyReading(ctx context.Context, module, zone string) (ReadingSessionBundle, error) {
	module, err := validReadingModule(module)
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	progress, err := s.GetLearningProgress(ctx, zone)
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	location, _ := learningLocation(progress.Timezone)
	day := time.Now().In(location).Format("2006-01-02")
	tests, err := s.readingLearningTests(ctx)
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	test, err := buildDailyReadingTest(tests, module, day)
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, "daily:"+module+":"+day); err != nil {
		return ReadingSessionBundle{}, err
	}
	var sessionID string
	err = tx.QueryRow(ctx, `SELECT session_id::text FROM reading_daily_challenges WHERE day=$1::date AND module=$2`, day, module).Scan(&sessionID)
	if err != nil && err != pgx.ErrNoRows {
		return ReadingSessionBundle{}, err
	}
	if err == pgx.ErrNoRows {
		testID, err := insertLearningReadingTest(ctx, tx, test)
		if err != nil {
			return ReadingSessionBundle{}, err
		}
		if err := tx.QueryRow(ctx, `INSERT INTO reading_sessions (test_id,mode,module,duration_seconds,total,kind,challenge_day) VALUES ($1,'practice',$2,300,5,'daily',$3::date) RETURNING id::text`, testID, module, day).Scan(&sessionID); err != nil {
			return ReadingSessionBundle{}, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO reading_daily_challenges (day,module,session_id) VALUES ($1::date,$2,$3)`, day, module, sessionID); err != nil {
			return ReadingSessionBundle{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return ReadingSessionBundle{}, err
	}
	return s.GetReadingSession(ctx, sessionID)
}

func buildReadingRecommendations(tests []ReadingTest, sessions []ReadingSession, module string, now time.Time) []ReadingRecommendation {
	type stat struct {
		correct, total int
		last           time.Time
		priority       float64
	}
	stats := map[string]*stat{}
	questionKeys := map[string]string{}
	for _, test := range tests {
		for _, q := range test.Questions {
			questionKeys[test.ID+":"+q.ID] = readingQuestionFingerprint(q)
		}
	}
	seen := map[string]bool{}
	ordered := append([]ReadingSession(nil), sessions...)
	sort.SliceStable(ordered, func(i, j int) bool { return ordered[i].UpdatedAt.After(ordered[j].UpdatedAt) })
	for _, session := range ordered {
		if session.Module != module || session.Status != "submitted" || session.Kind == "mistake_review" || session.Results == nil {
			continue
		}
		for _, q := range session.Results.Questions {
			key := q.QuestionKey
			if key == "" {
				key = questionKeys[session.TestID+":"+q.QuestionID]
			}
			if key == "" {
				key = session.TestID + ":" + q.QuestionID
			}
			if seen[key] {
				continue
			}
			seen[key] = true
			item := stats[q.Type]
			if item == nil {
				item = &stat{}
				stats[q.Type] = item
			}
			item.total++
			if q.Correct {
				item.correct++
			}
			if session.UpdatedAt.After(item.last) {
				item.last = session.UpdatedAt
			}
		}
	}
	types := []string{}
	for kind, item := range stats {
		if item.total < 5 {
			continue
		}
		smoothed := float64(item.correct+2) / float64(item.total+4)
		days := math.Max(0, now.Sub(item.last).Hours()/24)
		item.priority = (1-smoothed)*0.8 + math.Min(days/30, 1)*0.2
		types = append(types, kind)
	}
	sort.Slice(types, func(i, j int) bool {
		a, b := stats[types[i]], stats[types[j]]
		if a.priority == b.priority {
			return types[i] < types[j]
		}
		return a.priority > b.priority
	})
	available := []ReadingTest{}
	for _, test := range tests {
		if test.Module == module && test.Category != "full" {
			available = append(available, test)
		}
	}
	sort.SliceStable(available, func(i, j int) bool { return len(available[i].Questions) < len(available[j].Questions) })
	recommendations := []ReadingRecommendation{}
	used := map[string]bool{}
	for _, kind := range types {
		if len(recommendations) >= 3 {
			break
		}
		for _, test := range available {
			if used[test.ID] {
				continue
			}
			matches := false
			for _, q := range test.Questions {
				matches = matches || q.Type == kind
			}
			if !matches {
				continue
			}
			item := stats[kind]
			accuracy := math.Round(float64(item.correct)*1000/float64(item.total)) / 10
			reason := "Build accuracy with a focused set."
			if accuracy >= 80 {
				reason = "Keep this skill fresh with a short review."
			}
			if now.Sub(item.last) > 14*24*time.Hour {
				reason = "Revisit a skill you have not practised recently."
			}
			recommendations = append(recommendations, ReadingRecommendation{TestID: test.ID, Title: test.Title, Type: kind, Reason: reason, Accuracy: &accuracy, SampleSize: item.total, LastPracticed: &item.last, QuestionCount: len(test.Questions), DurationSeconds: test.DurationSeconds})
			used[test.ID] = true
			break
		}
	}
	for _, test := range available {
		if len(recommendations) >= 3 {
			break
		}
		if used[test.ID] {
			continue
		}
		kind := ""
		if len(test.Questions) > 0 {
			kind = test.Questions[0].Type
		}
		n := 0
		if item := stats[kind]; item != nil {
			n = item.total
		}
		recommendations = append(recommendations, ReadingRecommendation{TestID: test.ID, Title: test.Title, Type: kind, Reason: "Starter practice — build a baseline before judging your accuracy.", SampleSize: n, QuestionCount: len(test.Questions), DurationSeconds: test.DurationSeconds})
		used[test.ID] = true
	}
	return recommendations
}

const readingMistakeColumns = `id::text,module,question,passage,user_answer,incorrect_count,retry_count,correct_retries,first_wrong_at,last_wrong_at,resolved_at`

func scanReadingMistake(row scanner) (ReadingMistake, error) {
	var item ReadingMistake
	var question, passage []byte
	err := row.Scan(&item.ID, &item.Module, &question, &passage, &item.UserAnswer, &item.IncorrectCount, &item.RetryCount, &item.CorrectRetries, &item.FirstWrongAt, &item.LastWrongAt, &item.ResolvedAt)
	if err != nil {
		return item, err
	}
	if err := json.Unmarshal(question, &item.Question); err != nil {
		return item, err
	}
	err = json.Unmarshal(passage, &item.Passage)
	return item, err
}

func (s *Store) ListReadingMistakes(ctx context.Context, module, kind string, resolved bool) ([]ReadingMistake, error) {
	module, err := validReadingModule(module)
	if err != nil {
		return nil, err
	}
	if kind != "" && !validQuestionTypes[kind] {
		return nil, fmt.Errorf("%w: unknown question type", ErrInvalid)
	}
	rows, err := s.pool.Query(ctx, `SELECT `+readingMistakeColumns+` FROM reading_mistakes WHERE module=$1 AND (question->>'type'=$2 OR $2='') AND (resolved_at IS NOT NULL)=$3 ORDER BY last_wrong_at DESC,id LIMIT 50`, module, kind, resolved)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ReadingMistake{}
	for rows.Next() {
		item, err := scanReadingMistake(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func recordReadingMistakes(ctx context.Context, tx pgx.Tx, session ReadingSession, test ReadingTest, results ReadingSessionResults) error {
	for i, result := range results.Questions {
		if session.Kind == "mistake_review" {
			_, err := tx.Exec(ctx, `UPDATE reading_mistakes m SET retry_count=m.retry_count+1,correct_retries=m.correct_retries+CASE WHEN $3 THEN 1 ELSE 0 END,incorrect_count=m.incorrect_count+CASE WHEN $3 THEN 0 ELSE 1 END,user_answer=$4,resolved_at=CASE WHEN $3 THEN now() ELSE NULL END,last_wrong_at=CASE WHEN $3 THEN m.last_wrong_at ELSE now() END FROM reading_review_items ri WHERE ri.session_id=$1 AND ri.question_id=$2 AND m.id=ri.mistake_id`, session.ID, result.QuestionID, result.Correct, result.UserAnswer)
			if err != nil {
				return err
			}
			continue
		}
		if result.Correct {
			continue
		}
		question := test.Questions[i]
		var passage ReadingPassage
		for _, p := range test.Passages {
			if p.ID == question.PassageID {
				passage = p
				break
			}
		}
		qRaw, err := json.Marshal(question)
		if err != nil {
			return err
		}
		pRaw, err := json.Marshal(passage)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `INSERT INTO reading_mistakes (test_id,question_id,module,question,passage,user_answer) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6) ON CONFLICT (test_id,question_id) DO UPDATE SET user_answer=EXCLUDED.user_answer,incorrect_count=reading_mistakes.incorrect_count+1,last_wrong_at=now(),resolved_at=NULL`, session.TestID, question.ID, session.Module, qRaw, pRaw, result.UserAnswer)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) StartReadingMistakeReview(ctx context.Context, module, kind string) (ReadingSessionBundle, error) {
	module, err := validReadingModule(module)
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	if kind != "" && !validQuestionTypes[kind] {
		return ReadingSessionBundle{}, fmt.Errorf("%w: unknown question type", ErrInvalid)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, "review:"+module+":"+kind); err != nil {
		return ReadingSessionBundle{}, err
	}
	var sessionID string
	err = tx.QueryRow(ctx, `SELECT id::text FROM reading_sessions WHERE kind='mistake_review' AND module=$1 AND review_type=$2 AND status='active' ORDER BY updated_at DESC LIMIT 1`, module, kind).Scan(&sessionID)
	if err == nil {
		if err := tx.Commit(ctx); err != nil {
			return ReadingSessionBundle{}, err
		}
		return s.GetReadingSession(ctx, sessionID)
	}
	if err != pgx.ErrNoRows {
		return ReadingSessionBundle{}, err
	}
	rows, err := tx.Query(ctx, `SELECT `+readingMistakeColumns+` FROM reading_mistakes WHERE module=$1 AND resolved_at IS NULL AND (question->>'type'=$2 OR $2='') ORDER BY last_wrong_at,id LIMIT 10 FOR UPDATE`, module, kind)
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	items := []ReadingMistake{}
	for rows.Next() {
		item, err := scanReadingMistake(rows)
		if err != nil {
			rows.Close()
			return ReadingSessionBundle{}, err
		}
		items = append(items, item)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return ReadingSessionBundle{}, err
	}
	if len(items) == 0 {
		return ReadingSessionBundle{}, fmt.Errorf("%w: no open mistakes to review", ErrInvalid)
	}
	test := ReadingTest{Slug: fmt.Sprintf("mistake-review-%d", time.Now().UnixNano()), Title: "Your mistake review", Subtitle: "Retry previous mistakes, then compare your evidence.", Module: module, Category: "question_type", Difficulty: "Personal review", DurationSeconds: len(items) * 90, Passages: []ReadingPassage{}, Questions: []ReadingQuestion{}}
	passageIDs := map[string]string{}
	for _, item := range items {
		// Daily excerpts and full papers share source identifiers, but can have
		// different paragraphs. Keep their evidence snapshots separate.
		paragraphs, err := json.Marshal(item.Passage.Paragraphs)
		if err != nil {
			return ReadingSessionBundle{}, err
		}
		passageKey := item.Passage.ID + ":" + item.Passage.Title + ":" + string(paragraphs)
		id, exists := passageIDs[passageKey]
		if !exists {
			p := item.Passage
			p.ID = fmt.Sprintf("review-p%d", len(test.Passages)+1)
			p.Index = len(test.Passages) + 1
			p.Subtitle = "Original passage for your saved mistakes."
			id = p.ID
			passageIDs[passageKey] = id
			test.Passages = append(test.Passages, p)
		}
		q := item.Question
		q.PassageID = id
		test.Questions = append(test.Questions, q)
	}
	test.Questions = reframeReadingQuestions(test.Questions)
	testID, err := insertLearningReadingTest(ctx, tx, test)
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	if err := tx.QueryRow(ctx, `INSERT INTO reading_sessions (test_id,mode,module,duration_seconds,total,kind,review_type) VALUES ($1,'practice',$2,$3,$4,'mistake_review',$5) RETURNING id::text`, testID, module, test.DurationSeconds, len(items), kind).Scan(&sessionID); err != nil {
		return ReadingSessionBundle{}, err
	}
	for i, item := range items {
		if _, err := tx.Exec(ctx, `INSERT INTO reading_review_items (session_id,question_id,mistake_id) VALUES ($1,$2,$3)`, sessionID, test.Questions[i].ID, item.ID); err != nil {
			return ReadingSessionBundle{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return ReadingSessionBundle{}, err
	}
	return s.GetReadingSession(ctx, sessionID)
}

func (s *Store) GetReadingLearning(ctx context.Context, module, zone string) (ReadingLearningDashboard, error) {
	module, err := validReadingModule(module)
	if err != nil {
		return ReadingLearningDashboard{}, err
	}
	progress, err := s.GetLearningProgress(ctx, zone)
	if err != nil {
		return ReadingLearningDashboard{}, err
	}
	dashboard := ReadingLearningDashboard{Progress: progress, ActiveSessions: []ReadingSession{}, Recommendations: []ReadingRecommendation{}, Mistakes: ReadingMistakeSummary{ByType: []MistakeTypeSummary{}}}
	location, _ := learningLocation(progress.Timezone)
	day := time.Now().In(location).Format("2006-01-02")
	tests, err := s.readingLearningTests(ctx)
	if err != nil {
		return dashboard, err
	}
	daily, err := buildDailyReadingTest(tests, module, day)
	if err != nil {
		return dashboard, err
	}
	dashboard.Daily = DailyReadingSummary{Day: day, Title: daily.Title}
	var dailyID string
	err = s.pool.QueryRow(ctx, `SELECT session_id::text FROM reading_daily_challenges WHERE day=$1::date AND module=$2`, day, module).Scan(&dailyID)
	if err == nil {
		bundle, err := s.GetReadingSession(ctx, dailyID)
		if err != nil {
			return dashboard, err
		}
		dashboard.Daily.Session = &bundle.Session
	} else if err != pgx.ErrNoRows {
		return dashboard, err
	}
	rows, err := s.pool.Query(ctx, `SELECT `+readingSessionColumns+` FROM reading_sessions s JOIN reading_tests t ON t.id=s.test_id WHERE s.module=$1 AND s.status='active' ORDER BY s.updated_at DESC LIMIT 12`, module)
	if err != nil {
		return dashboard, err
	}
	for rows.Next() {
		session, err := scanReadingSession(rows)
		if err != nil {
			rows.Close()
			return dashboard, err
		}
		session.ElapsedSeconds = readingElapsedSeconds(session, time.Now())
		dashboard.ActiveSessions = append(dashboard.ActiveSessions, session)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return dashboard, err
	}
	history, err := s.pool.Query(ctx, `SELECT `+readingSessionColumns+` FROM reading_sessions s JOIN reading_tests t ON t.id=s.test_id WHERE s.module=$1 AND s.status='submitted' ORDER BY s.submitted_at DESC LIMIT 200`, module)
	if err != nil {
		return dashboard, err
	}
	sessions := []ReadingSession{}
	for history.Next() {
		session, err := scanReadingSession(history)
		if err != nil {
			history.Close()
			return dashboard, err
		}
		sessions = append(sessions, session)
	}
	history.Close()
	if err := history.Err(); err != nil {
		return dashboard, err
	}
	dashboard.Recommendations = buildReadingRecommendations(tests, sessions, module, time.Now())
	if err := s.pool.QueryRow(ctx, `SELECT count(*),COALESCE(sum((SELECT count(*) FROM jsonb_each_text(answers) answer WHERE btrim(answer.value)<>'')),0) FROM reading_sessions WHERE module=$1 AND status='submitted'`, module).Scan(&dashboard.ReadingCompletions, &dashboard.QuestionsAnswered); err != nil {
		return dashboard, err
	}
	summaries, err := s.pool.Query(ctx, `SELECT question->>'type',count(*) FILTER (WHERE resolved_at IS NULL),count(*) FILTER (WHERE resolved_at IS NOT NULL),COALESCE(sum(retry_count),0),COALESCE(sum(correct_retries),0) FROM reading_mistakes WHERE module=$1 GROUP BY question->>'type' ORDER BY question->>'type'`, module)
	if err != nil {
		return dashboard, err
	}
	defer summaries.Close()
	for summaries.Next() {
		var item MistakeTypeSummary
		var retries, correct int
		if err := summaries.Scan(&item.Type, &item.Open, &item.Resolved, &retries, &correct); err != nil {
			return dashboard, err
		}
		dashboard.Mistakes.ByType = append(dashboard.Mistakes.ByType, item)
		dashboard.Mistakes.Open += item.Open
		dashboard.Mistakes.Resolved += item.Resolved
		dashboard.Mistakes.Retries += retries
		dashboard.Mistakes.CorrectRetries += correct
	}
	return dashboard, summaries.Err()
}
