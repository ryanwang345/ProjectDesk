package desk

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"projectdesk/internal/ai"
)

// All 12 official IELTS Reading question types.
const (
	QMultipleChoice          = "multiple_choice"
	QTrueFalseNotGiven       = "tfng"
	QYesNoNotGiven           = "ynng"
	QMatchingHeadings        = "matching_headings"
	QMatchingInformation     = "matching_information"
	QMatchingFeatures        = "matching_features"
	QMatchingSentenceEndings = "matching_sentence_endings"
	QSentenceCompletion      = "sentence_completion"
	QSummaryCompletion       = "summary_completion"
	QTableCompletion         = "table_completion"
	QDiagramCompletion       = "diagram_completion"
	QShortAnswer             = "short_answer"
)

var validQuestionTypes = map[string]bool{
	QMultipleChoice:          true,
	QTrueFalseNotGiven:       true,
	QYesNoNotGiven:           true,
	QMatchingHeadings:        true,
	QMatchingInformation:     true,
	QMatchingFeatures:        true,
	QMatchingSentenceEndings: true,
	QSentenceCompletion:      true,
	QSummaryCompletion:       true,
	QTableCompletion:         true,
	QDiagramCompletion:       true,
	QShortAnswer:             true,
}

type ReadingParagraph struct {
	Label   string `json:"label"`
	Heading string `json:"heading,omitempty"`
	Text    string `json:"text"`
}

type ReadingPassage struct {
	ID         string             `json:"id"`
	Index      int                `json:"index"`
	Title      string             `json:"title"`
	Subtitle   string             `json:"subtitle,omitempty"`
	WordCount  int                `json:"wordCount"`
	Paragraphs []ReadingParagraph `json:"paragraphs"`
}

type ReadingQuestion struct {
	ID                string   `json:"id"`
	Number            int      `json:"number"`
	PassageID         string   `json:"passageId"`
	Type              string   `json:"type"`
	GroupInstruction  string   `json:"groupInstruction,omitempty"`
	ContextText       string   `json:"contextText,omitempty"`
	Prompt            string   `json:"prompt"`
	Options           []string `json:"options,omitempty"`
	WordLimit         int      `json:"wordLimit,omitempty"`
	CorrectAnswer     string   `json:"correctAnswer,omitempty"`
	AcceptableAnswers []string `json:"acceptableAnswers,omitempty"`
	Explanation       string   `json:"explanation,omitempty"`
	ExplanationZh     string   `json:"explanationZh,omitempty"`
	EvidenceParagraph string   `json:"evidenceParagraph,omitempty"`
	EvidenceQuote     string   `json:"evidenceQuote,omitempty"`
}

type ReadingTest struct {
	ID              string            `json:"id"`
	Slug            string            `json:"slug"`
	Title           string            `json:"title"`
	Subtitle        string            `json:"subtitle"`
	Module          string            `json:"module"`   // "academic" | "general"
	Category        string            `json:"category"` // "full" | "passage" | "question_type"
	Difficulty      string            `json:"difficulty"`
	DurationSeconds int               `json:"durationSeconds"`
	QuestionCount   int               `json:"questionCount"`
	QuestionTypes   []string          `json:"questionTypes,omitempty"`
	Passages        []ReadingPassage  `json:"passages"`
	Questions       []ReadingQuestion `json:"questions,omitempty"`
	CreatedAt       time.Time         `json:"createdAt"`
	Hidden          bool              `json:"-"`
}

type ReadingHighlight struct {
	ID             string `json:"id"`
	PassageID      string `json:"passageId"`
	ParagraphLabel string `json:"paragraphLabel"`
	Text           string `json:"text"`
	Color          string `json:"color"`
	Note           string `json:"note,omitempty"`
}

type ReadingQuestionResult struct {
	QuestionKey       string   `json:"questionKey,omitempty"`
	QuestionID        string   `json:"questionId"`
	Number            int      `json:"number"`
	PassageID         string   `json:"passageId"`
	Type              string   `json:"type"`
	UserAnswer        string   `json:"userAnswer"`
	CorrectAnswer     string   `json:"correctAnswer"`
	AcceptableAnswers []string `json:"acceptableAnswers,omitempty"`
	Correct           bool     `json:"correct"`
	Explanation       string   `json:"explanation"`
	ExplanationZh     string   `json:"explanationZh,omitempty"`
	EvidenceParagraph string   `json:"evidenceParagraph,omitempty"`
	EvidenceQuote     string   `json:"evidenceQuote,omitempty"`
}

type ReadingTypeBreakdown struct {
	Type    string  `json:"type"`
	Correct int     `json:"correct"`
	Total   int     `json:"total"`
	Percent float64 `json:"percent"`
}

type ReadingSessionResults struct {
	Score         int                     `json:"score"`
	Total         int                     `json:"total"`
	ScaledOutOf40 int                     `json:"scaledOutOf40"`
	Band          float64                 `json:"band"`
	Accuracy      float64                 `json:"accuracy"`
	TimeSpent     int                     `json:"timeSpent"`
	ByType        []ReadingTypeBreakdown  `json:"byType"`
	Questions     []ReadingQuestionResult `json:"questions"`
}

type ReadingSession struct {
	ID              string                 `json:"id"`
	TestID          string                 `json:"testId"`
	TestTitle       string                 `json:"testTitle"`
	Mode            string                 `json:"mode"`   // "practice" | "exam"
	Module          string                 `json:"module"` // "academic" | "general"
	Status          string                 `json:"status"` // "active" | "submitted"
	DurationSeconds int                    `json:"durationSeconds"`
	ElapsedSeconds  int                    `json:"elapsedSeconds"`
	Answers         map[string]string      `json:"answers"`
	Flags           map[string]bool        `json:"flags"`
	Bookmarks       map[string]bool        `json:"bookmarks"`
	Highlights      []ReadingHighlight     `json:"highlights"`
	Score           int                    `json:"score"`
	Total           int                    `json:"total"`
	Band            float64                `json:"band"`
	Results         *ReadingSessionResults `json:"results,omitempty"`
	StartedAt       time.Time              `json:"startedAt"`
	SubmittedAt     *time.Time             `json:"submittedAt,omitempty"`
	UpdatedAt       time.Time              `json:"updatedAt"`
	Kind            string                 `json:"kind"`
	ChallengeDay    string                 `json:"challengeDay,omitempty"`
	XPEarned        int                    `json:"xpEarned"`
}

type ReadingSessionBundle struct {
	Session ReadingSession `json:"session"`
	Test    ReadingTest    `json:"test"`
}

type ReadingAnalytics struct {
	TotalSessions    int                    `json:"totalSessions"`
	CompletedExams   int                    `json:"completedExams"`
	AverageBand      float64                `json:"averageBand"`
	HighestBand      float64                `json:"highestBand"`
	AverageAccuracy  float64                `json:"averageAccuracy"`
	TotalTimeSeconds int                    `json:"totalTimeSeconds"`
	ByType           []ReadingTypeBreakdown `json:"byType"`
	RecentSessions   []ReadingSession       `json:"recentSessions"`
}

// RedactForActiveSession strips answer keys, explanations, and evidence quotes
// from a ReadingTest so that active exam sessions cannot leak answers via the API.
func RedactTestForActiveSession(test ReadingTest) ReadingTest {
	redacted := test
	questions := make([]ReadingQuestion, len(test.Questions))
	for i, q := range test.Questions {
		q.CorrectAnswer = ""
		q.AcceptableAnswers = nil
		q.Explanation = ""
		q.ExplanationZh = ""
		q.EvidenceParagraph = ""
		q.EvidenceQuote = ""
		questions[i] = q
	}
	redacted.Questions = questions
	return redacted
}

// NormalizeReadingAnswer normalizes a user or answer-key string for comparison.
func NormalizeReadingAnswer(raw string) string {
	s := strings.TrimSpace(strings.ToLower(raw))
	s = strings.Trim(s, ".,;:!?\"'()[]{}")
	s = strings.Join(strings.Fields(s), " ")
	switch s {
	case "t":
		return "true"
	case "f":
		return "false"
	case "ng", "notgiven", "not-given":
		return "not given"
	case "y":
		return "yes"
	case "n":
		return "no"
	}
	return s
}

var numberWords = map[string]string{
	"one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
	"six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
	"eleven": "11", "twelve": "12", "thirteen": "13", "fourteen": "14",
	"fifteen": "15", "sixteen": "16", "seventeen": "17", "eighteen": "18",
	"nineteen": "19", "twenty": "20", "thirty": "30", "forty": "40",
	"fifty": "50", "sixty": "60", "seventy": "70", "eighty": "80",
	"ninety": "90", "hundred": "100",
}

func canonicalAnswerForms(raw string) []string {
	norm := NormalizeReadingAnswer(raw)
	if norm == "" {
		return nil
	}
	forms := []string{norm}
	if digit, ok := numberWords[norm]; ok {
		forms = append(forms, digit)
	}
	for word, digit := range numberWords {
		if norm == digit {
			forms = append(forms, word)
		}
	}
	// If multiple choice option is formatted like "A. Something" or "A", also accept the leading option letter if the key is a single letter or vice versa.
	if len(norm) > 2 && (norm[1] == '.' || norm[1] == ')') {
		forms = append(forms, strings.TrimSpace(norm[:1]))
	}
	return forms
}

// CheckReadingAnswer validates a user's answer against the question's correct answer and acceptable variants,
// including checking word limit constraints for completion / short answer questions.
func CheckReadingAnswer(q ReadingQuestion, userAnswer string) bool {
	trimmed := strings.TrimSpace(userAnswer)
	if trimmed == "" {
		return false
	}
	if q.WordLimit > 0 {
		words := strings.Fields(trimmed)
		if len(words) > q.WordLimit {
			return false
		}
	}
	userForms := canonicalAnswerForms(trimmed)
	if len(userForms) == 0 {
		return false
	}
	targets := append([]string{q.CorrectAnswer}, q.AcceptableAnswers...)
	for _, target := range targets {
		for _, tf := range canonicalAnswerForms(target) {
			for _, uf := range userForms {
				if uf == tf && uf != "" {
					return true
				}
			}
		}
	}
	return false
}

// CalculateIeltsReadingBand converts a raw score out of total questions into an
// official-scale IELTS Reading band score (0.0 to 9.0 in 0.5 increments) for
// either "academic" or "general" module.
func CalculateIeltsReadingBand(correct, total int, module string) (float64, int) {
	if total <= 0 || correct <= 0 {
		return 0.0, 0
	}
	if correct > total {
		correct = total
	}
	scaled := int(math.Round(float64(correct) * 40.0 / float64(total)))
	if scaled > 40 {
		scaled = 40
	}
	if strings.ToLower(strings.TrimSpace(module)) == "general" {
		switch {
		case scaled >= 40:
			return 9.0, scaled
		case scaled >= 39:
			return 8.5, scaled
		case scaled >= 37:
			return 8.0, scaled
		case scaled >= 36:
			return 7.5, scaled
		case scaled >= 34:
			return 7.0, scaled
		case scaled >= 32:
			return 6.5, scaled
		case scaled >= 30:
			return 6.0, scaled
		case scaled >= 27:
			return 5.5, scaled
		case scaled >= 23:
			return 5.0, scaled
		case scaled >= 19:
			return 4.5, scaled
		case scaled >= 15:
			return 4.0, scaled
		case scaled >= 12:
			return 3.5, scaled
		case scaled >= 9:
			return 3.0, scaled
		case scaled >= 6:
			return 2.5, scaled
		default:
			return 2.0, scaled
		}
	}
	// Academic Reading conversion table (out of 40)
	switch {
	case scaled >= 39:
		return 9.0, scaled
	case scaled >= 37:
		return 8.5, scaled
	case scaled >= 35:
		return 8.0, scaled
	case scaled >= 33:
		return 7.5, scaled
	case scaled >= 30:
		return 7.0, scaled
	case scaled >= 27:
		return 6.5, scaled
	case scaled >= 23:
		return 6.0, scaled
	case scaled >= 19:
		return 5.5, scaled
	case scaled >= 15:
		return 5.0, scaled
	case scaled >= 13:
		return 4.5, scaled
	case scaled >= 10:
		return 4.0, scaled
	case scaled >= 8:
		return 3.5, scaled
	case scaled >= 6:
		return 3.0, scaled
	case scaled >= 4:
		return 2.5, scaled
	default:
		return 2.0, scaled
	}
}

// ScoreReadingSession grades every question in the test and computes per-question-type analytics.
func ScoreReadingSession(test ReadingTest, answers map[string]string, elapsedSeconds int) ReadingSessionResults {
	if answers == nil {
		answers = map[string]string{}
	}
	qResults := make([]ReadingQuestionResult, 0, len(test.Questions))
	typeOrder := []string{}
	typeStats := map[string]*ReadingTypeBreakdown{}

	correctCount := 0
	for _, q := range test.Questions {
		userAns := strings.TrimSpace(answers[q.ID])
		if userAns == "" {
			userAns = strings.TrimSpace(answers[fmt.Sprintf("%d", q.Number)])
		}
		isCorrect := CheckReadingAnswer(q, userAns)
		if isCorrect {
			correctCount++
		}
		qResults = append(qResults, ReadingQuestionResult{
			QuestionKey:       readingQuestionFingerprint(q),
			QuestionID:        q.ID,
			Number:            q.Number,
			PassageID:         q.PassageID,
			Type:              q.Type,
			UserAnswer:        userAns,
			CorrectAnswer:     q.CorrectAnswer,
			AcceptableAnswers: q.AcceptableAnswers,
			Correct:           isCorrect,
			Explanation:       q.Explanation,
			ExplanationZh:     q.ExplanationZh,
			EvidenceParagraph: q.EvidenceParagraph,
			EvidenceQuote:     q.EvidenceQuote,
		})
		tb, ok := typeStats[q.Type]
		if !ok {
			tb = &ReadingTypeBreakdown{Type: q.Type}
			typeStats[q.Type] = tb
			typeOrder = append(typeOrder, q.Type)
		}
		tb.Total++
		if isCorrect {
			tb.Correct++
		}
	}

	byType := make([]ReadingTypeBreakdown, 0, len(typeOrder))
	for _, tName := range typeOrder {
		tb := typeStats[tName]
		if tb.Total > 0 {
			tb.Percent = math.Round(float64(tb.Correct)*1000.0/float64(tb.Total)) / 10.0
		}
		byType = append(byType, *tb)
	}

	total := len(test.Questions)
	band, scaled := CalculateIeltsReadingBand(correctCount, total, test.Module)
	var accuracy float64
	if total > 0 {
		accuracy = math.Round(float64(correctCount)*1000.0/float64(total)) / 10.0
	}

	return ReadingSessionResults{
		Score:         correctCount,
		Total:         total,
		ScaledOutOf40: scaled,
		Band:          band,
		Accuracy:      accuracy,
		TimeSpent:     elapsedSeconds,
		ByType:        byType,
		Questions:     qResults,
	}
}

func readingQuestionFingerprint(q ReadingQuestion) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(q.Type+"\x00"+q.Prompt+"\x00"+q.EvidenceQuote+"\x00"+q.CorrectAnswer)))
}

const readingTestColumns = `id::text, slug, title, subtitle, module, category, difficulty, duration_seconds, passages, questions, created_at, hidden`
const readingSessionColumns = `s.id::text, s.test_id::text, t.title, s.mode, s.module, s.status, s.duration_seconds, s.elapsed_seconds, s.answers, s.flags, s.bookmarks, s.highlights, s.score, s.total, s.band::float8, s.results, s.started_at, s.submitted_at, s.updated_at, s.kind, COALESCE(s.challenge_day::text, ''), COALESCE((SELECT xp FROM learning_events WHERE event_key = 'reading:' || s.id::text), 0)`

func scanReadingTest(row scanner, includeQuestions bool) (ReadingTest, error) {
	var t ReadingTest
	var passagesRaw, questionsRaw []byte
	err := row.Scan(
		&t.ID,
		&t.Slug,
		&t.Title,
		&t.Subtitle,
		&t.Module,
		&t.Category,
		&t.Difficulty,
		&t.DurationSeconds,
		&passagesRaw,
		&questionsRaw,
		&t.CreatedAt,
		&t.Hidden,
	)
	if err != nil {
		return ReadingTest{}, err
	}
	if len(passagesRaw) > 0 {
		if uErr := json.Unmarshal(passagesRaw, &t.Passages); uErr != nil {
			return ReadingTest{}, uErr
		}
	}
	var questions []ReadingQuestion
	if len(questionsRaw) > 0 {
		if uErr := json.Unmarshal(questionsRaw, &questions); uErr != nil {
			return ReadingTest{}, uErr
		}
	}
	t.QuestionCount = len(questions)
	seenTypes := map[string]bool{}
	for _, q := range questions {
		if !seenTypes[q.Type] {
			t.QuestionTypes = append(t.QuestionTypes, q.Type)
			seenTypes[q.Type] = true
		}
	}
	if includeQuestions {
		t.Questions = questions
	}
	if t.Passages == nil {
		t.Passages = []ReadingPassage{}
	}
	return t, nil
}

func scanReadingSession(row scanner) (ReadingSession, error) {
	var s ReadingSession
	var answersRaw, flagsRaw, bookmarksRaw, highlightsRaw, resultsRaw []byte
	err := row.Scan(
		&s.ID,
		&s.TestID,
		&s.TestTitle,
		&s.Mode,
		&s.Module,
		&s.Status,
		&s.DurationSeconds,
		&s.ElapsedSeconds,
		&answersRaw,
		&flagsRaw,
		&bookmarksRaw,
		&highlightsRaw,
		&s.Score,
		&s.Total,
		&s.Band,
		&resultsRaw,
		&s.StartedAt,
		&s.SubmittedAt,
		&s.UpdatedAt,
		&s.Kind,
		&s.ChallengeDay,
		&s.XPEarned,
	)
	if err != nil {
		return ReadingSession{}, err
	}
	s.Answers = map[string]string{}
	s.Flags = map[string]bool{}
	s.Bookmarks = map[string]bool{}
	s.Highlights = []ReadingHighlight{}
	if len(answersRaw) > 0 {
		_ = json.Unmarshal(answersRaw, &s.Answers)
	}
	if len(flagsRaw) > 0 {
		_ = json.Unmarshal(flagsRaw, &s.Flags)
	}
	if len(bookmarksRaw) > 0 {
		_ = json.Unmarshal(bookmarksRaw, &s.Bookmarks)
	}
	if len(highlightsRaw) > 0 {
		_ = json.Unmarshal(highlightsRaw, &s.Highlights)
	}
	if len(resultsRaw) > 0 && string(resultsRaw) != "null" && string(resultsRaw) != "{}" {
		var res ReadingSessionResults
		if uErr := json.Unmarshal(resultsRaw, &res); uErr == nil && res.Total > 0 {
			s.Results = &res
		}
	}
	return s, nil
}

func (s *Store) ensureReadingCache(ctx context.Context) error {
	s.readingMu.RLock()
	if s.readingCached {
		s.readingMu.RUnlock()
		return nil
	}
	s.readingMu.RUnlock()

	s.readingMu.Lock()
	defer s.readingMu.Unlock()
	if s.readingCached {
		return nil
	}
	rows, err := s.pool.Query(ctx, `
		SELECT `+readingTestColumns+`
		FROM reading_tests
		WHERE NOT hidden
		ORDER BY CASE category WHEN 'full' THEN 1 WHEN 'passage' THEN 2 ELSE 3 END, created_at ASC`)
	if err != nil {
		return err
	}
	defer rows.Close()

	tests := make([]ReadingTest, 0, 32)
	byKey := make(map[string]ReadingTest, 64)
	for rows.Next() {
		t, err := scanReadingTest(rows, true)
		if err != nil {
			return err
		}
		tests = append(tests, t)
		byKey[t.ID] = t
		byKey[t.Slug] = t
	}
	if err := rows.Err(); err != nil {
		return err
	}
	s.readingTests = tests
	s.readingByKey = byKey
	s.readingCached = true
	return nil
}

func (s *Store) ListReadingTests(ctx context.Context, module string) ([]ReadingTest, error) {
	if err := s.ensureReadingCache(ctx); err != nil {
		return nil, err
	}
	m := strings.ToLower(strings.TrimSpace(module))
	filterModule := m == "academic" || m == "general"
	s.readingMu.RLock()
	out := make([]ReadingTest, 0, len(s.readingTests))
	for _, t := range s.readingTests {
		if filterModule && t.Module != m {
			continue
		}
		t.Questions = nil
		out = append(out, t)
	}
	s.readingMu.RUnlock()
	return out, nil
}

func (s *Store) GetReadingTest(ctx context.Context, id string, includeAnswers bool) (ReadingTest, error) {
	if err := s.ensureReadingCache(ctx); err == nil {
		s.readingMu.RLock()
		t, ok := s.readingByKey[id]
		s.readingMu.RUnlock()
		if ok {
			if !includeAnswers {
				t = RedactTestForActiveSession(t)
			}
			return t, nil
		}
	}
	row := s.pool.QueryRow(ctx, `SELECT `+readingTestColumns+` FROM reading_tests WHERE id::text = $1 OR slug = $1`, id)
	t, err := scanReadingTest(row, true)
	if errors.Is(err, pgx.ErrNoRows) {
		return ReadingTest{}, ErrNotFound
	}
	if err != nil {
		return ReadingTest{}, err
	}
	if !includeAnswers {
		t = RedactTestForActiveSession(t)
	}
	return t, nil
}

func (s *Store) StartReadingSession(ctx context.Context, testID, mode string, durationSeconds int) (ReadingSessionBundle, error) {
	test, err := s.GetReadingTest(ctx, testID, true)
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	if test.Hidden {
		return ReadingSessionBundle{}, fmt.Errorf("%w: resume this challenge or review through its learning action", ErrInvalid)
	}
	mode = strings.ToLower(strings.TrimSpace(mode))
	if mode != "exam" && mode != "practice" {
		mode = "practice"
	}
	if durationSeconds <= 0 {
		durationSeconds = test.DurationSeconds
	}
	if mode == "exam" && test.Category == "full" {
		durationSeconds = 3600
	}
	var sessionID string
	err = s.pool.QueryRow(ctx, `
		INSERT INTO reading_sessions (test_id, mode, module, status, duration_seconds, total)
		VALUES ($1, $2, $3, 'active', $4, $5)
		RETURNING id::text`,
		test.ID, mode, test.Module, durationSeconds, len(test.Questions),
	).Scan(&sessionID)
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	return s.GetReadingSession(ctx, sessionID)
}

func (s *Store) GetReadingSession(ctx context.Context, sessionID string) (ReadingSessionBundle, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT `+readingSessionColumns+`
		FROM reading_sessions s
		JOIN reading_tests t ON t.id = s.test_id
		WHERE s.id::text = $1`, sessionID)
	session, err := scanReadingSession(row)
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return ReadingSessionBundle{}, ErrNotFound
	}
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	session.ElapsedSeconds = readingElapsedSeconds(session, time.Now())
	includeAnswers := session.Status == "submitted"
	test, err := s.GetReadingTest(ctx, session.TestID, includeAnswers)
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	return ReadingSessionBundle{
		Session: session,
		Test:    test,
	}, nil
}

type ReadingSessionPatch struct {
	ElapsedSeconds int                `json:"elapsedSeconds"`
	Answers        map[string]string  `json:"answers"`
	Flags          map[string]bool    `json:"flags"`
	Bookmarks      map[string]bool    `json:"bookmarks"`
	Highlights     []ReadingHighlight `json:"highlights"`
}

// Exam time belongs to the attempt, including time spent away from the page.
func readingElapsedSeconds(session ReadingSession, now time.Time) int {
	if session.Mode != "exam" || session.Status == "submitted" {
		return session.ElapsedSeconds
	}
	elapsed := max(0, int(now.Sub(session.StartedAt).Seconds()))
	return min(session.DurationSeconds, elapsed)
}

func applyReadingSessionPatch(session ReadingSession, patch ReadingSessionPatch, now time.Time) ReadingSession {
	if session.Status != "submitted" {
		if session.Mode == "exam" {
			session.ElapsedSeconds = readingElapsedSeconds(session, now)
		} else if patch.ElapsedSeconds > session.ElapsedSeconds {
			session.ElapsedSeconds = patch.ElapsedSeconds
		}
		// Allow the final in-flight autosubmit a small transport allowance. A later
		// reconnect grades saved answers rather than accepting work after the exam.
		deadline := session.StartedAt.Add(time.Duration(session.DurationSeconds)*time.Second + 3*time.Second)
		if patch.Answers != nil && (session.Mode != "exam" || !now.After(deadline)) {
			session.Answers = patch.Answers
		}
		if patch.Flags != nil {
			session.Flags = patch.Flags
		}
	}
	if patch.Bookmarks != nil {
		session.Bookmarks = patch.Bookmarks
	}
	if patch.Highlights != nil {
		session.Highlights = patch.Highlights
	}
	return session
}

func (s *Store) UpdateReadingSession(ctx context.Context, sessionID string, patch ReadingSessionPatch) (ReadingSession, error) {
	bundle, err := s.GetReadingSession(ctx, sessionID)
	if err != nil {
		return ReadingSession{}, err
	}
	session := applyReadingSessionPatch(bundle.Session, patch, time.Now())

	answersRaw, _ := json.Marshal(session.Answers)
	flagsRaw, _ := json.Marshal(session.Flags)
	bookmarksRaw, _ := json.Marshal(session.Bookmarks)
	highlightsRaw, _ := json.Marshal(session.Highlights)

	_, err = s.pool.Exec(ctx, `
		UPDATE reading_sessions
		SET elapsed_seconds = $2,
		    answers = $3::jsonb,
		    flags = $4::jsonb,
		    bookmarks = $5::jsonb,
		    highlights = $6::jsonb,
		    updated_at = now()
		WHERE id = $1 AND status = $7`,
		session.ID, session.ElapsedSeconds, answersRaw, flagsRaw, bookmarksRaw, highlightsRaw, session.Status,
	)
	if err != nil {
		return ReadingSession{}, err
	}
	updated, err := s.GetReadingSession(ctx, sessionID)
	if err != nil {
		return ReadingSession{}, err
	}
	return updated.Session, nil
}

func (s *Store) CheckPracticeQuestion(ctx context.Context, sessionID, questionID, userAnswer string) (ReadingQuestionResult, error) {
	bundle, err := s.GetReadingSession(ctx, sessionID)
	if err != nil {
		return ReadingQuestionResult{}, err
	}
	if bundle.Session.Mode == "exam" && bundle.Session.Status != "submitted" {
		return ReadingQuestionResult{}, fmt.Errorf("%w: immediate answer check is disabled in Exam Mode", ErrInvalid)
	}
	test, err := s.GetReadingTest(ctx, bundle.Session.TestID, true)
	if err != nil {
		return ReadingQuestionResult{}, err
	}
	for _, q := range test.Questions {
		if q.ID == questionID || fmt.Sprintf("%d", q.Number) == questionID {
			isCorrect := CheckReadingAnswer(q, userAnswer)
			return ReadingQuestionResult{
				QuestionID:        q.ID,
				Number:            q.Number,
				PassageID:         q.PassageID,
				Type:              q.Type,
				UserAnswer:        strings.TrimSpace(userAnswer),
				CorrectAnswer:     q.CorrectAnswer,
				AcceptableAnswers: q.AcceptableAnswers,
				Correct:           isCorrect,
				Explanation:       q.Explanation,
				ExplanationZh:     q.ExplanationZh,
				EvidenceParagraph: q.EvidenceParagraph,
				EvidenceQuote:     q.EvidenceQuote,
			}, nil
		}
	}
	return ReadingQuestionResult{}, ErrNotFound
}

func (s *Store) SubmitReadingSession(ctx context.Context, sessionID string, patch ReadingSessionPatch) (ReadingSessionBundle, error) {
	if err := s.ensureLearningProfile(ctx, ""); err != nil {
		return ReadingSessionBundle{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	defer tx.Rollback(ctx)
	session, err := scanReadingSession(tx.QueryRow(ctx, `SELECT `+readingSessionColumns+` FROM reading_sessions s JOIN reading_tests t ON t.id=s.test_id WHERE s.id::text=$1 FOR UPDATE OF s`, sessionID))
	if err != nil {
		return ReadingSessionBundle{}, readingNotFound(err)
	}
	if session.Status == "submitted" {
		if err := tx.Commit(ctx); err != nil {
			return ReadingSessionBundle{}, err
		}
		return s.GetReadingSession(ctx, sessionID)
	}
	session = applyReadingSessionPatch(session, patch, time.Now())
	fullTest, err := scanReadingTest(tx.QueryRow(ctx, `SELECT `+readingTestColumns+` FROM reading_tests WHERE id=$1`, session.TestID), true)
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	if session.Kind == "daily" || session.Kind == "mistake_review" {
		for _, q := range fullTest.Questions {
			if strings.TrimSpace(session.Answers[q.ID]) == "" {
				if session.Kind == "mistake_review" {
					return ReadingSessionBundle{}, fmt.Errorf("%w: answer each review question before finishing", ErrInvalid)
				}
				return ReadingSessionBundle{}, fmt.Errorf("%w: answer all five questions before completing the daily challenge", ErrInvalid)
			}
		}
	}
	results := ScoreReadingSession(fullTest, session.Answers, session.ElapsedSeconds)
	answersRaw, _ := json.Marshal(session.Answers)
	flagsRaw, _ := json.Marshal(session.Flags)
	bookmarksRaw, _ := json.Marshal(session.Bookmarks)
	highlightsRaw, _ := json.Marshal(session.Highlights)
	resultsRaw, _ := json.Marshal(results)
	_, err = tx.Exec(ctx, `UPDATE reading_sessions SET status='submitted',elapsed_seconds=$2,answers=$3::jsonb,flags=$4::jsonb,bookmarks=$5::jsonb,highlights=$6::jsonb,score=$7,total=$8,band=$9,results=$10::jsonb,submitted_at=now(),updated_at=now() WHERE id=$1`, session.ID, session.ElapsedSeconds, answersRaw, flagsRaw, bookmarksRaw, highlightsRaw, results.Score, results.Total, results.Band, resultsRaw)
	if err != nil {
		return ReadingSessionBundle{}, err
	}
	if err := recordReadingLearning(ctx, tx, session, results); err != nil {
		return ReadingSessionBundle{}, err
	}
	if err := recordReadingMistakes(ctx, tx, session, fullTest, results); err != nil {
		return ReadingSessionBundle{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ReadingSessionBundle{}, err
	}
	return s.GetReadingSession(ctx, sessionID)
}

func (s *Store) GetReadingAnalytics(ctx context.Context, module string) (ReadingAnalytics, error) {
	query := `
		SELECT ` + readingSessionColumns + `
		FROM reading_sessions s
		JOIN reading_tests t ON t.id = s.test_id
		WHERE s.status = 'submitted' AND s.kind = 'standard'`
	args := []any{}
	if m := strings.ToLower(strings.TrimSpace(module)); m == "academic" || m == "general" {
		query += ` AND s.module = $1`
		args = append(args, m)
	}
	query += ` ORDER BY s.submitted_at DESC NULLS LAST, s.updated_at DESC LIMIT 30`
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return ReadingAnalytics{}, err
	}
	defer rows.Close()

	sessions := []ReadingSession{}
	var bandSum, accSum float64
	var highestBand float64
	var totalTime int
	var completedExams int
	typeOrder := []string{}
	typeMap := map[string]*ReadingTypeBreakdown{}

	for rows.Next() {
		sess, err := scanReadingSession(rows)
		if err != nil {
			return ReadingAnalytics{}, err
		}
		sessions = append(sessions, sess)
		bandSum += sess.Band
		if sess.Band > highestBand {
			highestBand = sess.Band
		}
		totalTime += sess.ElapsedSeconds
		if sess.Mode == "exam" {
			completedExams++
		}
		if sess.Total > 0 {
			accSum += float64(sess.Score) * 100.0 / float64(sess.Total)
		}
		if sess.Results != nil {
			for _, bt := range sess.Results.ByType {
				agg, ok := typeMap[bt.Type]
				if !ok {
					agg = &ReadingTypeBreakdown{Type: bt.Type}
					typeMap[bt.Type] = agg
					typeOrder = append(typeOrder, bt.Type)
				}
				agg.Correct += bt.Correct
				agg.Total += bt.Total
			}
		}
	}
	if err := rows.Err(); err != nil {
		return ReadingAnalytics{}, err
	}

	byType := make([]ReadingTypeBreakdown, 0, len(typeOrder))
	for _, tName := range typeOrder {
		agg := typeMap[tName]
		if agg.Total > 0 {
			agg.Percent = math.Round(float64(agg.Correct)*1000.0/float64(agg.Total)) / 10.0
		}
		byType = append(byType, *agg)
	}

	n := len(sessions)
	var avgBand, avgAcc float64
	if n > 0 {
		avgBand = math.Round((bandSum/float64(n))*2.0) / 2.0
		avgAcc = math.Round((accSum/float64(n))*10.0) / 10.0
	}

	return ReadingAnalytics{
		TotalSessions:    n,
		CompletedExams:   completedExams,
		AverageBand:      avgBand,
		HighestBand:      highestBand,
		AverageAccuracy:  avgAcc,
		TotalTimeSeconds: totalTime,
		ByType:           byType,
		RecentSessions:   sessions,
	}, nil
}

// AI-Powered Reading Features

type ReadingAIExplainRequest struct {
	SessionID  string `json:"sessionId"`
	TestID     string `json:"testId"`
	QuestionID string `json:"questionId"`
	UserAnswer string `json:"userAnswer"`
}

type ReadingAIExplanation struct {
	QuestionID        string `json:"questionId"`
	CorrectAnswer     string `json:"correctAnswer"`
	WhyCorrect        string `json:"whyCorrect"`
	WhyWrong          string `json:"whyWrong"`
	EvidenceParagraph string `json:"evidenceParagraph"`
	EvidenceQuote     string `json:"evidenceQuote"`
	ChineseSummary    string `json:"chineseSummary"`
	Simulated         bool   `json:"simulated"`
}

func (s *Store) ExplainReadingQuestion(ctx context.Context, req ReadingAIExplainRequest, sealer *Sealer) (ReadingAIExplanation, error) {
	testID := strings.TrimSpace(req.TestID)
	if req.SessionID != "" {
		bundle, err := s.GetReadingSession(ctx, req.SessionID)
		if err != nil {
			return ReadingAIExplanation{}, err
		}
		if bundle.Session.Mode == "exam" && bundle.Session.Status != "submitted" {
			return ReadingAIExplanation{}, fmt.Errorf("%w: explanations are locked during an active Exam Mode session", ErrInvalid)
		}
		testID = bundle.Session.TestID
	}
	test, err := s.GetReadingTest(ctx, testID, true)
	if err != nil {
		return ReadingAIExplanation{}, err
	}

	var targetQ *ReadingQuestion
	for i := range test.Questions {
		if test.Questions[i].ID == req.QuestionID || fmt.Sprintf("%d", test.Questions[i].Number) == req.QuestionID {
			targetQ = &test.Questions[i]
			break
		}
	}
	if targetQ == nil {
		return ReadingAIExplanation{}, ErrNotFound
	}

	var passageText string
	for _, p := range test.Passages {
		if p.ID == targetQ.PassageID {
			for _, para := range p.Paragraphs {
				if para.Label == targetQ.EvidenceParagraph || targetQ.EvidenceParagraph == "" {
					passageText += fmt.Sprintf("[Paragraph %s] %s\n", para.Label, para.Text)
				}
			}
		}
	}

	userAns := strings.TrimSpace(req.UserAnswer)
	isCorrect := CheckReadingAnswer(*targetQ, userAns)

	fallback := ReadingAIExplanation{
		QuestionID:        targetQ.ID,
		CorrectAnswer:     targetQ.CorrectAnswer,
		WhyCorrect:        targetQ.Explanation,
		WhyWrong:          buildFallbackWhyWrong(*targetQ, userAns, isCorrect),
		EvidenceParagraph: targetQ.EvidenceParagraph,
		EvidenceQuote:     targetQ.EvidenceQuote,
		ChineseSummary:    targetQ.ExplanationZh,
		Simulated:         true,
	}

	provider, _, pErr := s.ProviderForRole(ctx, "english", sealer)
	if pErr != nil || !realPronunciationModel(provider) {
		return fallback, nil
	}

	doneInteractive := s.beginInteractiveAI()
	defer doneInteractive()

	var draft ReadingAIExplanation
	sys := `You are an expert IELTS Reading tutor. Reply with one JSON object and nothing else.
Use ONLY the provided passage text and official evidence. Never invent evidence that is not in the passage.
Return JSON with keys:
- whyCorrect: 1-2 clear English sentences explaining why the official answer is right based on the passage quote.
- whyWrong: 1-2 clear English sentences explaining why the learner's answer is wrong (or affirming why their answer works if they answered correctly).
- evidenceParagraph: paragraph letter (e.g. "B").
- evidenceQuote: exact quote from the passage.
- chineseSummary: 1-2 natural Chinese sentences summarizing the explanation and trap.`

	userPrompt := fmt.Sprintf(
		"Passage excerpt:\n%s\nQuestion (%s): %s\nCorrect Answer: %s\nLearner's Answer: %s\nSaved explanation: %s\nSaved quote (Paragraph %s): %s\n",
		passageText,
		targetQ.Type,
		targetQ.Prompt,
		targetQ.CorrectAnswer,
		userAns,
		targetQ.Explanation,
		targetQ.EvidenceParagraph,
		targetQ.EvidenceQuote,
	)

	_, genErr := ai.GenerateJSON(ctx, provider, ai.Request{
		Messages: []ai.Message{
			{Role: "system", Content: sys},
			{Role: "user", Content: userPrompt},
		},
		MaxTokens:   1200,
		Temperature: 0.2,
	}, &draft)
	if genErr != nil || strings.TrimSpace(draft.WhyCorrect) == "" {
		return fallback, nil
	}

	draft.QuestionID = targetQ.ID
	draft.CorrectAnswer = targetQ.CorrectAnswer
	if strings.TrimSpace(draft.EvidenceParagraph) == "" {
		draft.EvidenceParagraph = targetQ.EvidenceParagraph
	}
	if strings.TrimSpace(draft.EvidenceQuote) == "" {
		draft.EvidenceQuote = targetQ.EvidenceQuote
	}
	if strings.TrimSpace(draft.ChineseSummary) == "" {
		draft.ChineseSummary = targetQ.ExplanationZh
	}
	draft.Simulated = false
	return draft, nil
}

func buildFallbackWhyWrong(q ReadingQuestion, userAns string, isCorrect bool) string {
	if isCorrect {
		return fmt.Sprintf("Your answer (%q) matches the key evidence in Paragraph %s.", userAns, q.EvidenceParagraph)
	}
	if userAns == "" {
		return fmt.Sprintf("No answer was entered. Check Paragraph %s, which states: %q", q.EvidenceParagraph, q.EvidenceQuote)
	}
	switch q.Type {
	case QTrueFalseNotGiven, QYesNoNotGiven:
		return fmt.Sprintf("You selected %q, whereas the passage in Paragraph %s supports %q (%s).", userAns, q.EvidenceParagraph, q.CorrectAnswer, q.Explanation)
	default:
		return fmt.Sprintf("Your answer %q does not match the passage statement in Paragraph %s. %s", userAns, q.EvidenceParagraph, q.Explanation)
	}
}

type ReadingVocabRequest struct {
	Selection string `json:"selection"`
	Context   string `json:"context"`
}

type ReadingVocabResponse struct {
	Term       string   `json:"term"`
	Pos        string   `json:"pos"`
	Definition string   `json:"definition"`
	Chinese    string   `json:"chinese"`
	Synonyms   []string `json:"synonyms"`
	Examples   []string `json:"examples"`
	ExamplesZh []string `json:"examplesZh"`
	Simulated  bool     `json:"simulated"`
}

func (s *Store) LookupReadingVocab(ctx context.Context, req ReadingVocabRequest, sealer *Sealer) (ReadingVocabResponse, error) {
	term := oneLine(req.Selection, 80)
	if term == "" {
		return ReadingVocabResponse{}, fmt.Errorf("%w: select a word or phrase first", ErrInvalid)
	}
	contextSentence := oneLine(req.Context, 360)

	// Check if the word is already in english_cards for instant local enrichment.
	var savedMeaning string
	var savedSenses WordSenses
	var savedBand BandNote
	if cached, ok := s.englishCardByWord(ctx, term); ok {
		savedMeaning = cached.Meaning
		savedSenses = cached.Senses
		savedBand = cached.Band
	} else {
		var savedPron string
		var sensesRaw, bandRaw []byte
		_ = s.pool.QueryRow(ctx, `
			SELECT meaning, pronunciation, senses, band
			FROM english_cards
			WHERE lower(word) = lower($1)
			LIMIT 1`, term).Scan(&savedMeaning, &savedPron, &sensesRaw, &bandRaw)
		if len(sensesRaw) > 0 {
			_ = json.Unmarshal(sensesRaw, &savedSenses)
		}
		if len(bandRaw) > 0 {
			_ = json.Unmarshal(bandRaw, &savedBand)
		}
	}

	provider, _, pErr := s.ProviderForRole(ctx, "english", sealer)
	if pErr == nil && realPronunciationModel(provider) {
		doneInteractive := s.beginInteractiveAI()
		defer doneInteractive()
		var draft ReadingVocabResponse
		sys := `You are an IELTS Reading vocabulary assistant. Reply with one JSON object and nothing else.
Explain the selected word or phrase in the exact context of the passage sentence.
Return JSON with keys:
- term: the word or phrase
- pos: part of speech (noun, verb, adjective, adverb, phrase)
- definition: clear English definition in this context
- chinese: concise Chinese meaning in this context
- synonyms: 3 academic IELTS synonyms or paraphrases
- examples: 2 natural IELTS-level example sentences using the term
- examplesZh: 2 Chinese translations matching examples`
		userMsg := fmt.Sprintf("Selected term: %s\nPassage context: %s\n", term, contextSentence)
		if _, err := ai.GenerateJSON(ctx, provider, ai.Request{
			Messages: []ai.Message{
				{Role: "system", Content: sys},
				{Role: "user", Content: userMsg},
			},
			MaxTokens:   1000,
			Temperature: 0.2,
		}, &draft); err == nil && strings.TrimSpace(draft.Definition) != "" {
			draft.Term = term
			draft.Simulated = false
			return draft, nil
		}
	}

	pos := "phrase"
	definition := ""
	chinese := savedMeaning
	if len(savedSenses) > 0 {
		pos = savedSenses[0].Pos
		definition = savedSenses[0].En
		if savedSenses[0].Zh != "" {
			chinese = savedSenses[0].Zh
		}
	}
	if chinese == "" {
		chinese = lookupBuiltinVocabZh(term)
	}
	if definition == "" {
		definition = savedMeaning
	}
	if definition == "" {
		definition = chinese
	}
	synonyms := savedBand.Paraphrases
	if synonyms == nil {
		synonyms = []string{}
	}
	examples := savedBand.Examples
	if examples == nil {
		examples = []string{}
	}
	examplesZh := savedBand.ExamplesZh
	if examplesZh == nil {
		examplesZh = []string{}
	}
	return ReadingVocabResponse{Term: term, Pos: pos, Definition: definition, Chinese: chinese, Synonyms: synonyms, Examples: examples, ExamplesZh: examplesZh, Simulated: definition == ""}, nil
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

var builtinReadingGlossary = map[string]string{
	"subterranean":   "地下的；地表下的",
	"qanat":          "坎儿井（古代地下引水系统）",
	"aquifer":        "含水层",
	"evaporation":    "蒸发；挥发",
	"thermal":        "热量的；温热的",
	"rewilding":      "再野化；生态自然恢复",
	"culvert":        "暗渠；涵洞",
	"floodplain":     "洪泛区；河漫滩",
	"biodiversity":   "生物多样性",
	"bilingual":      "双语的",
	"executive":      "执行的；行政管理的",
	"neuroimaging":   "神经影像学",
	"cognitive":      "认知的",
	"chronometer":    "精密计时器；航海天文钟",
	"longitude":      "经度",
	"ergonomic":      "人体工程学的",
	"administrative": "行政的；管理的",
}

func lookupBuiltinVocabZh(term string) string {
	key := strings.ToLower(strings.Trim(term, ".,;:!?\"'()[]{}"))
	if zh, ok := builtinReadingGlossary[key]; ok {
		return zh
	}
	return "学术阅读核心词汇 / 短语（结合上下文理解）"
}

type ReadingGenerateRequest struct {
	Topic         string   `json:"topic"`
	Module        string   `json:"module"`     // "academic" | "general"
	Difficulty    string   `json:"difficulty"` // "Band 6.0-7.0" | "Band 7.0-8.0" | "Band 8.0-9.0"
	QuestionTypes []string `json:"questionTypes"`
}

func (s *Store) GenerateReadingPractice(ctx context.Context, req ReadingGenerateRequest, sealer *Sealer) (ReadingTest, error) {
	topic := oneLine(req.Topic, 100)
	if topic == "" {
		topic = "Renewable Marine Energy and Tidal Turbines"
	}
	module := strings.ToLower(strings.TrimSpace(req.Module))
	if module != "general" {
		module = "academic"
	}
	difficulty := oneLine(req.Difficulty, 40)
	if difficulty == "" {
		difficulty = "Band 7.0-8.0"
	}
	qTypes := make([]string, 0, len(req.QuestionTypes))
	for _, qt := range req.QuestionTypes {
		if validQuestionTypes[qt] {
			qTypes = append(qTypes, qt)
		}
	}
	if len(qTypes) == 0 {
		qTypes = []string{QTrueFalseNotGiven, QMultipleChoice, QSentenceCompletion}
	}

	var generated ReadingTest
	provider, _, pErr := s.ProviderForRole(ctx, "english", sealer)
	if pErr == nil && realPronunciationModel(provider) {
		doneInteractive := s.beginInteractiveAI()
		if aiTest, err := requestGeneratedReadingTest(ctx, provider, topic, module, difficulty, qTypes); err == nil {
			generated = aiTest
		}
		doneInteractive()
	}
	if len(generated.Passages) == 0 || len(generated.Questions) == 0 {
		generated = buildFallbackGeneratedTest(topic, module, difficulty, qTypes)
	}

	if err := validateGeneratedReadingTest(&generated); err != nil {
		return ReadingTest{}, err
	}

	passagesRaw, err := json.Marshal(generated.Passages)
	if err != nil {
		return ReadingTest{}, err
	}
	questionsRaw, err := json.Marshal(generated.Questions)
	if err != nil {
		return ReadingTest{}, err
	}

	var savedID string
	var createdAt time.Time
	slug := fmt.Sprintf("ai-%d", time.Now().UnixNano())
	err = s.pool.QueryRow(ctx, `
		INSERT INTO reading_tests (slug, title, subtitle, module, category, difficulty, duration_seconds, passages, questions)
		VALUES ($1, $2, $3, $4, 'passage', $5, $6, $7::jsonb, $8::jsonb)
		RETURNING id::text, created_at`,
		slug,
		generated.Title,
		generated.Subtitle,
		generated.Module,
		generated.Difficulty,
		generated.DurationSeconds,
		passagesRaw,
		questionsRaw,
	).Scan(&savedID, &createdAt)
	if err != nil {
		return ReadingTest{}, err
	}
	generated.ID = savedID
	generated.Slug = slug
	generated.CreatedAt = createdAt
	generated.QuestionCount = len(generated.Questions)
	s.invalidateReadingCache()
	return generated, nil
}

func validateGeneratedReadingTest(t *ReadingTest) error {
	if strings.TrimSpace(t.Title) == "" || len(t.Passages) == 0 || len(t.Questions) == 0 {
		return fmt.Errorf("%w: generated passage or questions are empty", ErrInvalid)
	}
	passageID := t.Passages[0].ID
	if passageID == "" {
		passageID = "p1"
		t.Passages[0].ID = passageID
	}
	words := 0
	for _, para := range t.Passages[0].Paragraphs {
		words += len(strings.Fields(para.Text))
	}
	t.Passages[0].WordCount = words
	if t.DurationSeconds <= 0 {
		t.DurationSeconds = 1200
	}
	for i := range t.Questions {
		q := &t.Questions[i]
		q.Number = i + 1
		q.ID = fmt.Sprintf("q%d", q.Number)
		q.PassageID = passageID
		if !validQuestionTypes[q.Type] {
			q.Type = QMultipleChoice
		}
		if strings.TrimSpace(q.CorrectAnswer) == "" || strings.TrimSpace(q.Prompt) == "" {
			return fmt.Errorf("%w: question %d is missing prompt or answer key", ErrInvalid, q.Number)
		}
		if !CheckReadingAnswer(*q, q.CorrectAnswer) {
			return fmt.Errorf("%w: question %d answer key failed self-consistency check", ErrInvalid, q.Number)
		}
	}
	return nil
}

func requestGeneratedReadingTest(ctx context.Context, provider ai.Provider, topic, module, difficulty string, qTypes []string) (ReadingTest, error) {
	sys := `You write original IELTS Reading practice passages and questions. Do not copy copyrighted materials.
Reply with one JSON object and nothing else.
Write 1 passage with 4 paragraphs labeled A, B, C, D (about 380-480 words total) on the requested topic, and 6 questions using the requested question types.
Every question must have an unambiguous correctAnswer supported by an exact quote from the passage.
JSON shape:
{
  "title": "...",
  "subtitle": "...",
  "passages": [{"id":"p1","index":1,"title":"...","subtitle":"...","paragraphs":[{"label":"A","heading":"...","text":"..."}]}],
  "questions": [{"id":"q1","number":1,"passageId":"p1","type":"tfng","groupInstruction":"...","prompt":"...","options":["TRUE","FALSE","NOT GIVEN"],"wordLimit":2,"correctAnswer":"TRUE","explanation":"...","explanationZh":"...","evidenceParagraph":"A","evidenceQuote":"..."}]
}`
	user := fmt.Sprintf("Topic: %s\nModule: %s\nDifficulty: %s\nQuestion types to include: %s\n", topic, module, difficulty, strings.Join(qTypes, ", "))
	var draft ReadingTest
	if _, err := ai.GenerateJSON(ctx, provider, ai.Request{
		Messages: []ai.Message{
			{Role: "system", Content: sys},
			{Role: "user", Content: user},
		},
		MaxTokens:   4500,
		Temperature: 0.3,
	}, &draft); err != nil {
		return ReadingTest{}, err
	}
	draft.Module = module
	draft.Category = "passage"
	draft.Difficulty = difficulty
	draft.DurationSeconds = 1200
	return draft, nil
}

func buildFallbackGeneratedTest(topic, module, difficulty string, qTypes []string) ReadingTest {
	cleanTopic := strings.TrimSpace(topic)
	if utf8.RuneCountInString(cleanTopic) > 60 {
		cleanTopic = string([]rune(cleanTopic)[:60])
	}
	return ReadingTest{
		Title:           fmt.Sprintf("AI Practice Passage: %s", cleanTopic),
		Subtitle:        fmt.Sprintf("Original %s reading drill (%s) generated for targeted skill building", strings.Title(module), difficulty),
		Module:          module,
		Category:        "passage",
		Difficulty:      difficulty,
		DurationSeconds: 1200,
		Passages: []ReadingPassage{
			{
				ID:       "p1",
				Index:    1,
				Title:    cleanTopic,
				Subtitle: "Systems analysis, empirical findings, and long-term implementation challenges",
				Paragraphs: []ReadingParagraph{
					{
						Label:   "A",
						Heading: "Early assumptions versus field measurements",
						Text:    fmt.Sprintf("Over the past two decades, researchers investigating %s initially assumed that scale alone would guarantee efficiency. Early pilot projects launched between 2008 and 2014 prioritized maximum capacity over local adaptability. However, longitudinal field measurements collected across twelve municipal sites revealed that smaller, modular installations consistently outperformed centralized facilities in both reliability and maintenance cost.", strings.ToLower(cleanTopic)),
					},
					{
						Label:   "B",
						Heading: "The role of adaptive monitoring protocols",
						Text:    "A pivotal shift occurred when engineering teams introduced continuous sensor calibration alongside quarterly community audits. Rather than waiting for annual inspections, automated telemetry flagged micro-variations in output within minutes. Consequently, unplanned downtime fell by 42 percent over a thirty-six-month observation window, disproving the earlier belief that continuous monitoring was prohibitively expensive.",
					},
					{
						Label:   "C",
						Heading: "Financial bottlenecks and regulatory lag",
						Text:    "Despite clear operational gains, widespread adoption remains constrained by outdated procurement rules. Municipal budgets typically separate capital expenditure from long-term operating savings, penalizing projects that require higher upfront investment in durable components. Policy analysts argue that harmonizing lifecycle accounting standards is essential before regional authorities can replicate these pilot successes at scale.",
					},
					{
						Label:   "D",
						Heading: "Future outlook for integrated networks",
						Text:    "Looking ahead, interdisciplinary consortia are combining predictive modelling with standardized hardware interfaces. By allowing components from different manufacturers to interoperate seamlessly, next-generation deployments avoid vendor lock-in and preserve flexibility as environmental and demographic demands evolve.",
					},
				},
			},
		},
		Questions: []ReadingQuestion{
			{
				ID:                "q1",
				Number:            1,
				PassageID:         "p1",
				Type:              QTrueFalseNotGiven,
				GroupInstruction:  "Do the following statements agree with the information given in the passage? Choose TRUE, FALSE, or NOT GIVEN.",
				Prompt:            "Early pilot projects between 2008 and 2014 focused on local adaptability rather than maximum capacity.",
				Options:           []string{"TRUE", "FALSE", "NOT GIVEN"},
				CorrectAnswer:     "FALSE",
				Explanation:       "Paragraph A states the opposite: early pilot projects prioritized maximum capacity over local adaptability.",
				ExplanationZh:     "A 段明确指出早期试点项目优先考虑最大容量而非本地适应性，与题干相反，故选 FALSE。",
				EvidenceParagraph: "A",
				EvidenceQuote:     "Early pilot projects launched between 2008 and 2014 prioritized maximum capacity over local adaptability.",
			},
			{
				ID:                "q2",
				Number:            2,
				PassageID:         "p1",
				Type:              QTrueFalseNotGiven,
				GroupInstruction:  "Do the following statements agree with the information given in the passage? Choose TRUE, FALSE, or NOT GIVEN.",
				Prompt:            "Modular installations proved more reliable than centralized facilities across twelve municipal sites.",
				Options:           []string{"TRUE", "FALSE", "NOT GIVEN"},
				CorrectAnswer:     "TRUE",
				Explanation:       "Paragraph A confirms that smaller, modular installations consistently outperformed centralized facilities in reliability and maintenance cost.",
				ExplanationZh:     "A 段证实，在 12 个市政站点的实地测量中，模块化设施在可靠性和维护成本上始终优于集中式设施。",
				EvidenceParagraph: "A",
				EvidenceQuote:     "smaller, modular installations consistently outperformed centralized facilities in both reliability and maintenance cost.",
			},
			{
				ID:                "q3",
				Number:            3,
				PassageID:         "p1",
				Type:              QMultipleChoice,
				GroupInstruction:  "Choose the correct letter, A, B, C, or D.",
				Prompt:            "What caused unplanned downtime to drop by 42 percent?",
				Options:           []string{"A. Expanding centralized facilities", "B. Continuous sensor calibration and automated telemetry", "C. Reducing the number of municipal sites", "D. Eliminating quarterly community audits"},
				CorrectAnswer:     "B",
				AcceptableAnswers: []string{"B. Continuous sensor calibration and automated telemetry"},
				Explanation:       "Paragraph B explains that continuous sensor calibration and automated telemetry flagged micro-variations within minutes, cutting unplanned downtime by 42 percent.",
				ExplanationZh:     "B 段指出，持续的传感器校准与自动遥测在数分钟内识别细微波动，使非计划停机时间减少了 42%。",
				EvidenceParagraph: "B",
				EvidenceQuote:     "automated telemetry flagged micro-variations in output within minutes. Consequently, unplanned downtime fell by 42 percent",
			},
			{
				ID:                "q4",
				Number:            4,
				PassageID:         "p1",
				Type:              QMatchingInformation,
				GroupInstruction:  "Which paragraph contains the following information? Choose the correct letter, A–D.",
				Prompt:            "An explanation of why municipal budgeting rules discourage investment in durable components",
				Options:           []string{"A", "B", "C", "D"},
				CorrectAnswer:     "C",
				Explanation:       "Paragraph C explains that municipal budgets separate capital expenditure from long-term operating savings, penalizing higher upfront investment.",
				ExplanationZh:     "C 段解释了市政预算将资本支出与长期运营节省分开核算，从而不利于采购耐用组件的前期投入。",
				EvidenceParagraph: "C",
				EvidenceQuote:     "Municipal budgets typically separate capital expenditure from long-term operating savings, penalizing projects that require higher upfront investment in durable components.",
			},
			{
				ID:                "q5",
				Number:            5,
				PassageID:         "p1",
				Type:              QSentenceCompletion,
				GroupInstruction:  "Complete the sentence below. Choose NO MORE THAN TWO WORDS from the passage for each answer.",
				Prompt:            "Policy analysts recommend harmonizing ________ standards so regional authorities can replicate pilot successes.",
				WordLimit:         2,
				CorrectAnswer:     "lifecycle accounting",
				Explanation:       "Paragraph C states that harmonizing lifecycle accounting standards is essential.",
				ExplanationZh:     "C 段指出，统一全生命周期核算（lifecycle accounting）标准至关重要。",
				EvidenceParagraph: "C",
				EvidenceQuote:     "Policy analysts argue that harmonizing lifecycle accounting standards is essential before regional authorities can replicate these pilot successes at scale.",
			},
			{
				ID:                "q6",
				Number:            6,
				PassageID:         "p1",
				Type:              QShortAnswer,
				GroupInstruction:  "Answer the question below. Choose NO MORE THAN TWO WORDS from the passage.",
				Prompt:            "What problem do standardized hardware interfaces help next-generation deployments avoid?",
				WordLimit:         2,
				CorrectAnswer:     "vendor lock-in",
				Explanation:       "Paragraph D notes that standardized hardware interfaces allow components to interoperate seamlessly and avoid vendor lock-in.",
				ExplanationZh:     "D 段指出，标准化硬件接口可让不同厂商组件无缝协作，避免供应商锁定（vendor lock-in）。",
				EvidenceParagraph: "D",
				EvidenceQuote:     "By allowing components from different manufacturers to interoperate seamlessly, next-generation deployments avoid vendor lock-in",
			},
		},
	}
}
