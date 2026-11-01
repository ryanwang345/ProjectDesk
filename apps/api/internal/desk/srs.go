package desk

import (
	"context"
	"fmt"
	"hash/crc32"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	SRSRatingAgain = 1
	SRSRatingHard  = 2
	SRSRatingGood  = 3
	SRSRatingEasy  = 4

	SRSModeRecognition = "recognition"
	SRSModeProductive  = "productive"

	maxDailySRSQueue = 20
	srsXPPerRecall   = 5
)

type VocabularySRSState struct {
	CardID          string     `json:"cardId"`
	Stability       float64    `json:"stability"`
	Difficulty      float64    `json:"difficulty"`
	Reps            int        `json:"reps"`
	Lapses          int        `json:"lapses"`
	State           string     `json:"state"`
	LastRating      int        `json:"lastRating"`
	RecognitionReps int        `json:"recognitionReps"`
	ProductiveReps  int        `json:"productiveReps"`
	LastReviewedAt  *time.Time `json:"lastReviewedAt,omitempty"`
	DueAt           time.Time  `json:"dueAt"`
}

type SRSScheduleResult struct {
	Next            VocabularySRSState `json:"next"`
	Retrievability  float64            `json:"retrievability"`
	ScheduledDays   float64            `json:"scheduledDays"`
	KeepInReviewTab bool               `json:"keepInReviewTab"`
}

// FSRSRetrievability computes the power-law forgetting curve R(t, S) = (1 + 19/81 * t / S)^(-0.5),
// where R(S, S) = 0.90 (90% target retention at elapsed days == stability).
func FSRSRetrievability(elapsedDays, stability float64) float64 {
	if stability <= 0 {
		return 0
	}
	if elapsedDays <= 0 {
		return 1.0
	}
	r := math.Pow(1.0+(19.0/81.0)*(elapsedDays/stability), -0.5)
	return math.Max(0.01, math.Min(1.0, r))
}

func clampFloat(val, lo, hi float64) float64 {
	if val < lo {
		return lo
	}
	if val > hi {
		return hi
	}
	return val
}

// ScheduleVocabularyReview deterministically computes the next FSRS state for a vocabulary card.
// It distinguishes passive recognition from active productive recall.
func ScheduleVocabularyReview(prev VocabularySRSState, rating int, mode string, now time.Time) (SRSScheduleResult, error) {
	if rating < SRSRatingAgain || rating > SRSRatingEasy {
		return SRSScheduleResult{}, fmt.Errorf("%w: rating must be between 1 and 4", ErrInvalid)
	}
	if mode != SRSModeRecognition && mode != SRSModeProductive {
		mode = SRSModeRecognition
	}
	next := prev
	if next.Stability <= 0 {
		next.Stability = 1.0
	}
	if next.Difficulty <= 0 {
		next.Difficulty = 5.0
	}

	elapsedDays := 0.0
	if prev.LastReviewedAt != nil && now.After(*prev.LastReviewedAt) {
		elapsedDays = now.Sub(*prev.LastReviewedAt).Hours() / 24.0
	}
	retrievability := 0.90
	if prev.Reps > 0 && prev.LastReviewedAt != nil {
		retrievability = FSRSRetrievability(elapsedDays, prev.Stability)
	}

	// Update difficulty D in [1.0, 10.0] with mean reversion toward 5.0.
	deltaD := -0.65 * float64(rating-3)
	rawD := prev.Difficulty + deltaD
	next.Difficulty = math.Round(clampFloat(0.9*rawD+0.1*5.0, 1.0, 10.0)*100) / 100

	modeBonus := 1.0
	if mode == SRSModeProductive {
		modeBonus = 1.18
	}

	var scheduledDays float64
	if prev.Reps == 0 {
		switch rating {
		case SRSRatingAgain:
			next.Stability = 0.25
			next.Lapses++
			next.State = "relearning"
			scheduledDays = 0.01 // ~15 minutes (due again in current/next session)
		case SRSRatingHard:
			next.Stability = 1.0 * modeBonus
			next.State = "learning"
			scheduledDays = 1.0
		case SRSRatingGood:
			next.Stability = 2.6 * modeBonus
			next.State = "review"
			scheduledDays = next.Stability
		case SRSRatingEasy:
			next.Stability = 6.0 * modeBonus
			next.State = "review"
			scheduledDays = next.Stability
		}
	} else if rating == SRSRatingAgain {
		next.Lapses++
		next.Stability = math.Round(clampFloat(prev.Stability*0.32, 0.25, 2.0)*100) / 100
		next.State = "relearning"
		scheduledDays = 0.01
	} else {
		ratingMult := 1.0
		switch rating {
		case SRSRatingHard:
			ratingMult = 0.45
		case SRSRatingGood:
			ratingMult = 1.0
		case SRSRatingEasy:
			ratingMult = 1.35
		}
		growth := 1.0 + math.Exp(1.05)*(11.0-next.Difficulty)*math.Pow(prev.Stability, -0.20)*(math.Exp(0.75*(1.0-retrievability))-1.0)*ratingMult*modeBonus
		growth = clampFloat(growth, 1.15, 4.5)
		next.Stability = math.Round(clampFloat(prev.Stability*growth, 0.5, 365.0)*100) / 100
		if next.Stability >= 2.0 {
			next.State = "review"
		} else {
			next.State = "learning"
		}
		scheduledDays = next.Stability
	}

	next.Reps = prev.Reps + 1
	next.LastRating = rating
	if rating >= SRSRatingGood {
		if mode == SRSModeProductive {
			next.ProductiveReps++
		} else {
			next.RecognitionReps++
		}
	}
	reviewedAt := now.UTC()
	next.LastReviewedAt = &reviewedAt
	next.DueAt = reviewedAt.Add(time.Duration(scheduledDays * float64(24*time.Hour)))

	// Keep in_review true on english_cards until the learner achieves solid stability (>= 7 days) and productive recall.
	keepInReview := rating <= SRSRatingHard || next.Stability < 7.0 || next.ProductiveReps == 0

	return SRSScheduleResult{
		Next:            next,
		Retrievability:  math.Round(retrievability*1000) / 1000,
		ScheduledDays:   math.Round(scheduledDays*100) / 100,
		KeepInReviewTab: keepInReview,
	}, nil
}

type SrsReviewItem struct {
	CardID          string             `json:"cardId"`
	Word            string             `json:"word"`
	Pronunciation   string             `json:"pronunciation"`
	Meaning         string             `json:"meaning"`
	Mode            string             `json:"mode"` // "recognition" | "productive"
	Prompt          string             `json:"prompt"`
	PromptZh        string             `json:"promptZh"`
	ContextSentence string             `json:"contextSentence"`
	BlankedSentence string             `json:"blankedSentence"`
	PassageTitle    string             `json:"passageTitle,omitempty"`
	Options         []string           `json:"options"`
	AnswerIndex     int                `json:"answerIndex"`
	State           VocabularySRSState `json:"state"`
	Retrievability  float64            `json:"retrievability"`
	Intervals       map[string]string  `json:"intervals"`
}

func formatIntervalLabel(days float64) string {
	if days < 0.05 {
		return "15m"
	}
	if days < 1.0 {
		hours := max(1, int(math.Round(days*24)))
		return fmt.Sprintf("%dh", hours)
	}
	d := int(math.Round(days))
	if d >= 30 {
		return fmt.Sprintf("%dmo", max(1, d/30))
	}
	return fmt.Sprintf("%dd", max(1, d))
}

func blankWordInSentence(sentence, word string) string {
	sentence = strings.TrimSpace(sentence)
	word = strings.TrimSpace(word)
	if sentence == "" || word == "" {
		return ""
	}
	pattern := `(?i)\b` + regexp.QuoteMeta(word) + `(?:s|es|ed|ing|d)?\b`
	re, err := regexp.Compile(pattern)
	if err == nil && re.MatchString(sentence) {
		return re.ReplaceAllString(sentence, "______")
	}
	return ""
}

func bestContextSentence(card EnglishCard, readingContext string) string {
	if s := strings.TrimSpace(readingContext); s != "" {
		return s
	}
	if s := strings.TrimSpace(card.Band.Writing); s != "" {
		return s
	}
	if s := strings.TrimSpace(card.Band.Speaking); s != "" {
		return s
	}
	for _, ex := range card.Band.Examples {
		if strings.TrimSpace(ex) != "" {
			return strings.TrimSpace(ex)
		}
	}
	for _, ex := range card.Examples {
		if strings.TrimSpace(ex) != "" && !isSharedSentenceFrame(nil, card.ID, ex, card.Word) {
			return strings.TrimSpace(ex)
		}
	}
	if len(card.Examples) > 0 {
		return strings.TrimSpace(card.Examples[0])
	}
	return fmt.Sprintf("Using %s accurately in academic writing improves lexical precision.", card.Word)
}

func (s *Store) syncVocabularySRS(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO vocabulary_srs (card_id, stability, difficulty, state, due_at)
		SELECT id, 0.8, 5.5, 'learning', now()
		FROM english_cards
		WHERE in_review = true
		ON CONFLICT (card_id) DO NOTHING
	`)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO vocabulary_srs (card_id, stability, difficulty, state, due_at)
		SELECT DISTINCT card_id, 1.0, 5.5, 'learning', now()
		FROM reading_vocabulary
		ON CONFLICT (card_id) DO NOTHING
	`)
	return err
}

func (s *Store) GetDueVocabularyReviews(ctx context.Context, limit int) ([]SrsReviewItem, error) {
	if limit <= 0 || limit > maxDailySRSQueue {
		limit = 12
	}
	if err := s.syncVocabularySRS(ctx); err != nil {
		return nil, err
	}
	allCards, err := s.listEnglishSorted(ctx)
	if err != nil {
		return nil, err
	}
	cardMap := make(map[string]EnglishCard, len(allCards))
	for _, c := range allCards {
		cardMap[c.ID] = c
	}

	now := time.Now().UTC()
	rows, err := s.pool.Query(ctx, `
		SELECT
			v.card_id::text,
			v.stability,
			v.difficulty,
			v.reps,
			v.lapses,
			v.state,
			v.last_rating,
			v.recognition_reps,
			v.productive_reps,
			v.last_reviewed_at,
			v.due_at,
			COALESCE(rv.context, ''),
			COALESCE(rv.passage_title, '')
		FROM vocabulary_srs v
		JOIN english_cards c ON c.id = v.card_id
		LEFT JOIN LATERAL (
			SELECT r.context, COALESCE(p->>'title', 'IELTS Reading Passage') AS passage_title
			FROM reading_vocabulary r
			JOIN reading_sessions rs ON rs.id = r.session_id
			JOIN reading_tests rt ON rt.id = rs.test_id
			LEFT JOIN LATERAL (
				SELECT value p FROM jsonb_array_elements(rt.passages) WHERE value->>'id' = r.passage_id
			) src ON true
			WHERE r.card_id = v.card_id
			ORDER BY r.created_at DESC
			LIMIT 1
		) rv ON true
		WHERE v.due_at <= $1 OR c.in_review = true
		ORDER BY v.lapses DESC, v.due_at ASC, v.stability ASC
		LIMIT $2
	`, now, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []SrsReviewItem{}
	for rows.Next() {
		var st VocabularySRSState
		var readingContext, passageTitle string
		if err := rows.Scan(
			&st.CardID,
			&st.Stability,
			&st.Difficulty,
			&st.Reps,
			&st.Lapses,
			&st.State,
			&st.LastRating,
			&st.RecognitionReps,
			&st.ProductiveReps,
			&st.LastReviewedAt,
			&st.DueAt,
			&readingContext,
			&passageTitle,
		); err != nil {
			return nil, err
		}
		card, ok := cardMap[st.CardID]
		if !ok {
			continue
		}
		if enriched := s.ApplyBuiltinBand(ctx, []EnglishCard{card}); len(enriched) > 0 {
			card = enriched[0]
		}

		// Choose recall mode: once learner has 1+ recognition rep, challenge them with productive contextual cloze.
		mode := SRSModeRecognition
		if st.RecognitionReps >= 1 {
			mode = SRSModeProductive
		}
		contextSent := bestContextSentence(card, readingContext)
		blanked := blankWordInSentence(contextSent, card.Word)
		if blanked == "" {
			blanked = fmt.Sprintf("In IELTS academic contexts, ______ means \"%s\".", card.Meaning)
		}

		// Build 4 deterministic options so tests and sessions are stable.
		options, answerIdx := buildSRSOptions(card, allCards, mode, st.Reps)
		prompt := fmt.Sprintf("What is the core meaning of \"%s\"?", card.Word)
		promptZh := fmt.Sprintf("“%s” 最核心的词义是什么？", card.Word)
		if mode == SRSModeProductive {
			prompt = "Complete the sentence using the most precise vocabulary word:"
			promptZh = "结合语境，选择或输入最准确的词完成句子："
		}

		elapsedDays := 0.0
		if st.LastReviewedAt != nil && now.After(*st.LastReviewedAt) {
			elapsedDays = now.Sub(*st.LastReviewedAt).Hours() / 24.0
		}
		retr := 0.90
		if st.Reps > 0 && st.LastReviewedAt != nil {
			retr = FSRSRetrievability(elapsedDays, st.Stability)
		}

		intervals := map[string]string{}
		for name, r := range map[string]int{"again": SRSRatingAgain, "hard": SRSRatingHard, "good": SRSRatingGood, "easy": SRSRatingEasy} {
			sim, _ := ScheduleVocabularyReview(st, r, mode, now)
			intervals[name] = formatIntervalLabel(sim.ScheduledDays)
		}

		items = append(items, SrsReviewItem{
			CardID:          card.ID,
			Word:            card.Word,
			Pronunciation:   card.Pronunciation,
			Meaning:         card.Meaning,
			Mode:            mode,
			Prompt:          prompt,
			PromptZh:        promptZh,
			ContextSentence: contextSent,
			BlankedSentence: blanked,
			PassageTitle:    passageTitle,
			Options:         options,
			AnswerIndex:     answerIdx,
			State:           st,
			Retrievability:  math.Round(retr*100) / 100,
			Intervals:       intervals,
		})
	}
	return items, rows.Err()
}

func buildSRSOptions(target EnglishCard, pool []EnglishCard, mode string, reps int) ([]string, int) {
	correct := target.Meaning
	if mode == SRSModeProductive {
		correct = target.Word
	}
	distractors := []string{}
	seed := int(crc32.ChecksumIEEE([]byte(target.ID+":"+mode))) + reps*7
	if len(pool) > 0 {
		for offset := 1; offset < len(pool) && len(distractors) < 3; offset++ {
			cand := pool[(seed+offset*31)%len(pool)]
			if cand.ID == target.ID {
				continue
			}
			val := strings.TrimSpace(cand.Meaning)
			if mode == SRSModeProductive {
				val = strings.TrimSpace(cand.Word)
			}
			if val == "" || strings.EqualFold(val, correct) {
				continue
			}
			dup := false
			for _, d := range distractors {
				if strings.EqualFold(d, val) {
					dup = true
					break
				}
			}
			if !dup {
				distractors = append(distractors, val)
			}
		}
	}
	fallbacks := []string{"administrative", "sustainable", "inevitable", "hypothesis"}
	if mode == SRSModeRecognition {
		fallbacks = []string{"可持续的；长久的", "不可避免的", "显著的；重要的", "假说；前提"}
	}
	for _, fb := range fallbacks {
		if len(distractors) >= 3 {
			break
		}
		if !strings.EqualFold(fb, correct) {
			distractors = append(distractors, fb)
		}
	}
	answerIdx := seed % 4
	if answerIdx < 0 {
		answerIdx = -answerIdx
	}
	options := make([]string, 0, 4)
	dIdx := 0
	for i := 0; i < 4; i++ {
		if i == answerIdx {
			options = append(options, correct)
		} else if dIdx < len(distractors) {
			options = append(options, distractors[dIdx])
			dIdx++
		}
	}
	return options, answerIdx
}

type SrsReviewInput struct {
	CardID    string `json:"cardId"`
	Rating    int    `json:"rating"`
	Mode      string `json:"mode"`
	ElapsedMs int    `json:"elapsedMs"`
}

type SrsReviewResponse struct {
	Schedule  SRSScheduleResult `json:"schedule"`
	AwardedXP int               `json:"awardedXp"`
	Progress  LearningProgress  `json:"progress"`
}

func (s *Store) SubmitVocabularyReview(ctx context.Context, in SrsReviewInput, zone string) (SrsReviewResponse, error) {
	if strings.TrimSpace(in.CardID) == "" {
		return SrsReviewResponse{}, fmt.Errorf("%w: cardId is required", ErrInvalid)
	}
	if in.Rating < SRSRatingAgain || in.Rating > SRSRatingEasy {
		return SrsReviewResponse{}, fmt.Errorf("%w: rating must be between 1 and 4", ErrInvalid)
	}
	if in.Mode != SRSModeRecognition && in.Mode != SRSModeProductive {
		in.Mode = SRSModeRecognition
	}
	if err := s.ensureLearningProfile(ctx, zone); err != nil {
		return SrsReviewResponse{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SrsReviewResponse{}, err
	}
	defer tx.Rollback(ctx)

	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM english_cards WHERE id = $1)`, in.CardID).Scan(&exists); err != nil {
		if isInvalidUUID(err) {
			return SrsReviewResponse{}, ErrNotFound
		}
		return SrsReviewResponse{}, err
	}
	if !exists {
		return SrsReviewResponse{}, ErrNotFound
	}

	prev := VocabularySRSState{
		CardID:     in.CardID,
		Stability:  1.0,
		Difficulty: 5.0,
		State:      "new",
		DueAt:      time.Now().UTC(),
	}
	err = tx.QueryRow(ctx, `
		SELECT stability, difficulty, reps, lapses, state, last_rating, recognition_reps, productive_reps, last_reviewed_at, due_at
		FROM vocabulary_srs
		WHERE card_id = $1
		FOR UPDATE
	`, in.CardID).Scan(
		&prev.Stability,
		&prev.Difficulty,
		&prev.Reps,
		&prev.Lapses,
		&prev.State,
		&prev.LastRating,
		&prev.RecognitionReps,
		&prev.ProductiveReps,
		&prev.LastReviewedAt,
		&prev.DueAt,
	)
	if err != nil && err != pgx.ErrNoRows {
		return SrsReviewResponse{}, err
	}

	now := time.Now().UTC()
	sched, err := ScheduleVocabularyReview(prev, in.Rating, in.Mode, now)
	if err != nil {
		return SrsReviewResponse{}, err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO vocabulary_srs (
			card_id, stability, difficulty, reps, lapses, state, last_rating,
			recognition_reps, productive_reps, last_reviewed_at, due_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
		ON CONFLICT (card_id) DO UPDATE SET
			stability = EXCLUDED.stability,
			difficulty = EXCLUDED.difficulty,
			reps = EXCLUDED.reps,
			lapses = EXCLUDED.lapses,
			state = EXCLUDED.state,
			last_rating = EXCLUDED.last_rating,
			recognition_reps = EXCLUDED.recognition_reps,
			productive_reps = EXCLUDED.productive_reps,
			last_reviewed_at = EXCLUDED.last_reviewed_at,
			due_at = EXCLUDED.due_at,
			updated_at = now()
	`,
		in.CardID,
		sched.Next.Stability,
		sched.Next.Difficulty,
		sched.Next.Reps,
		sched.Next.Lapses,
		sched.Next.State,
		sched.Next.LastRating,
		sched.Next.RecognitionReps,
		sched.Next.ProductiveReps,
		sched.Next.LastReviewedAt,
		sched.Next.DueAt,
	)
	if err != nil {
		return SrsReviewResponse{}, err
	}

	elapsedMs := clampInt(in.ElapsedMs, 0, 600000)
	_, err = tx.Exec(ctx, `
		INSERT INTO vocabulary_review_logs (
			card_id, rating, mode, stability_before, stability_after,
			difficulty_before, difficulty_after, scheduled_days, elapsed_ms, reviewed_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
	`,
		in.CardID,
		in.Rating,
		in.Mode,
		prev.Stability,
		sched.Next.Stability,
		prev.Difficulty,
		sched.Next.Difficulty,
		sched.ScheduledDays,
		elapsedMs,
		now,
	)
	if err != nil {
		return SrsReviewResponse{}, err
	}

	_, err = tx.Exec(ctx, `UPDATE english_cards SET in_review = $2, updated_at = now() WHERE id = $1`, in.CardID, sched.KeepInReviewTab)
	if err != nil {
		return SrsReviewResponse{}, err
	}

	var profileZone string
	if err := tx.QueryRow(ctx, `SELECT timezone FROM learning_profile WHERE id='workspace'`).Scan(&profileZone); err != nil {
		return SrsReviewResponse{}, err
	}
	loc, _ := learningLocation(profileZone)
	day := now.In(loc).Format("2006-01-02")

	xp := 0
	if in.Rating >= SRSRatingGood {
		xp = srsXPPerRecall
		tag, err := tx.Exec(ctx, `
			INSERT INTO learning_events (event_key, kind, xp, activity_day)
			VALUES ($1, 'vocabulary', $2, $3::date)
			ON CONFLICT DO NOTHING
		`, "srs:"+in.CardID+":"+day, xp, day)
		if err != nil {
			return SrsReviewResponse{}, err
		}
		if tag.RowsAffected() == 0 {
			xp = 0
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return SrsReviewResponse{}, err
	}
	s.invalidateEnglishCache()
	progress, err := s.GetLearningProgress(ctx, zone)
	if err != nil {
		return SrsReviewResponse{}, err
	}
	return SrsReviewResponse{
		Schedule:  sched,
		AwardedXP: xp,
		Progress:  progress,
	}, nil
}

func clampInt(val, lo, hi int) int {
	if val < lo {
		return lo
	}
	if val > hi {
		return hi
	}
	return val
}

// EnrollLessonWordsInSRS enrolls the 5 words of a completed lesson into vocabulary_srs
// so the learner will review them on a spaced schedule before forgetting.
func (s *Store) EnrollLessonWordsInSRS(ctx context.Context, lesson, correct int) {
	words, _, _, err := s.lessonCards(ctx, lesson)
	if err != nil || len(words) == 0 {
		return
	}
	initialStability := 2.5
	initialDueHours := 48
	if correct < 7 {
		initialStability = 1.0
		initialDueHours = 12
	} else if correct >= 9 {
		initialStability = 4.0
		initialDueHours = 72
	}
	dueAt := time.Now().UTC().Add(time.Duration(initialDueHours) * time.Hour)
	for _, w := range words {
		_, _ = s.pool.Exec(ctx, `
			INSERT INTO vocabulary_srs (card_id, stability, difficulty, reps, state, last_rating, recognition_reps, last_reviewed_at, due_at)
			VALUES ($1, $2, 5.0, 1, 'review', 3, 1, now(), $3)
			ON CONFLICT (card_id) DO NOTHING
		`, w.ID, initialStability, dueAt)
	}
}

type ReadingMistakeDiagnosis struct {
	Category       string `json:"category"`
	Label          string `json:"label"`
	LabelZh        string `json:"labelZh"`
	WhyItHappens   string `json:"whyItHappens"`
	WhyItHappensZh string `json:"whyItHappensZh"`
	SocraticHint   string `json:"socraticHint"`
	SocraticHintZh string `json:"socraticHintZh"`
}

// DiagnoseReadingMistake deterministically classifies a reading mistake based on question type,
// user answer, word limit, and evidence paragraph—never inventing unsupported claims.
func DiagnoseReadingMistake(item ReadingMistake) ReadingMistakeDiagnosis {
	ua := strings.TrimSpace(item.UserAnswer)
	q := item.Question
	para := strings.TrimSpace(q.EvidenceParagraph)
	if para == "" {
		para = "the relevant section"
	} else {
		para = "Paragraph " + para
	}
	paraZh := "相关段落"
	if strings.TrimSpace(q.EvidenceParagraph) != "" {
		paraZh = "段落 " + strings.TrimSpace(q.EvidenceParagraph)
	}

	if ua == "" {
		return ReadingMistakeDiagnosis{
			Category:       "unanswered_pacing",
			Label:          "Unanswered / Pacing Gap",
			LabelZh:        "未作答 / 时间分配不足",
			WhyItHappens:   "Leaving questions blank forfeits guaranteed marks—especially on closed-option items where there is no penalty for guessing.",
			WhyItHappensZh: "空题会直接丢分；雅思阅读答错不扣分，必须在规定时间内完成定位与作答。",
			SocraticHint:   fmt.Sprintf("Scan %s for the key noun phrase in the question prompt before looking at the answer key.", para),
			SocraticHintZh: fmt.Sprintf("先不看答案：去 %s 找到题干核心名词对应的句子，尝试独立作答。", paraZh),
		}
	}

	if q.WordLimit > 0 && len(strings.Fields(ua)) > q.WordLimit {
		return ReadingMistakeDiagnosis{
			Category:       "word_limit_violation",
			Label:          fmt.Sprintf("Word Limit Exceeded (Max %d)", q.WordLimit),
			LabelZh:        fmt.Sprintf("超出字数限制（最多 %d 词）", q.WordLimit),
			WhyItHappens:   fmt.Sprintf("Your answer contained %d words, but the instruction strictly permits at most %d.", len(strings.Fields(ua)), q.WordLimit),
			WhyItHappensZh: fmt.Sprintf("你的答案包含 %d 个词，但题目指令严格限制最多 %d 个词。", len(strings.Fields(ua)), q.WordLimit),
			SocraticHint:   fmt.Sprintf("Check %s and strip articles or extra modifiers until only the core %d-word phrase remains.", para, q.WordLimit),
			SocraticHintZh: fmt.Sprintf("回到 %s，去掉多余冠词或修饰语，只保留核心的 %d 个词以内。", paraZh, q.WordLimit),
		}
	}

	switch q.Type {
	case QTrueFalseNotGiven:
		return ReadingMistakeDiagnosis{
			Category:       "false_vs_not_given",
			Label:          "TRUE / FALSE / NOT GIVEN Logic Trap",
			LabelZh:        "TRUE / FALSE / NOT GIVEN 逻辑混淆",
			WhyItHappens:   "FALSE requires direct contradiction in the passage, whereas NOT GIVEN means the specific claim or comparison is absent.",
			WhyItHappensZh: "FALSE 要求原文出现直接矛盾的表述；而 NOT GIVEN 表示原文根本未提及该具体断言或比较关系。",
			SocraticHint:   fmt.Sprintf("Read %s carefully: does the author explicitly contradict the statement, confirm it via paraphrase, or omit the target detail?", para),
			SocraticHintZh: fmt.Sprintf("细读 %s：作者是直接反驳了题干、用同义改写证实了题干，还是根本没有提及该细节？", paraZh),
		}
	case QYesNoNotGiven:
		return ReadingMistakeDiagnosis{
			Category:       "yes_vs_no_not_given",
			Label:          "Writer's View / Stance Confusion",
			LabelZh:        "作者观点（YES / NO / NOT GIVEN）混淆",
			WhyItHappens:   "Yes/No/Not Given tests the writer's evaluative claim rather than isolated background facts.",
			WhyItHappensZh: "YES/NO/NOT GIVEN 考查作者的态度与观点判断，容易将背景事实或他人观点误判为作者观点。",
			SocraticHint:   fmt.Sprintf("In %s, look for attitude markers (modals, evaluative adjectives, contrast connectors) that reveal the writer's stance.", para),
			SocraticHintZh: fmt.Sprintf("在 %s 中寻找表达作者态度的情态动词、评价性形容词或转折词，再判断观点是否一致。", paraZh),
		}
	case QMatchingHeadings:
		return ReadingMistakeDiagnosis{
			Category:       "heading_scope_trap",
			Label:          "Detail vs. Main Idea Scope Trap",
			LabelZh:        "局部细节与段落主旨混淆",
			WhyItHappens:   "A distractor heading often repeats a single example from the paragraph rather than summarizing the paragraph's overarching purpose.",
			WhyItHappensZh: "干扰项标题常借用段落中的某个具体例子或原词，而非概括全段的核心主旨。",
			SocraticHint:   fmt.Sprintf("Re-read the first and last sentences of %s: what single thesis connects the whole paragraph?", para),
			SocraticHintZh: fmt.Sprintf("重读 %s 的首尾句与转折句：哪一个选项能概括整段的核心论点，而非单一细节？", paraZh),
		}
	case QMatchingInformation, QMatchingFeatures:
		return ReadingMistakeDiagnosis{
			Category:       "location_distractor",
			Label:          "Keyword Overlap / Paraphrase Trap",
			LabelZh:        "原词复现干扰 / 同义替换漏判",
			WhyItHappens:   "IELTS passages often mention a keyword in multiple places while expressing the exact target claim through synonyms in only one location.",
			WhyItHappensZh: "雅思阅读常在多处出现题干原词作为干扰，而真正的答案往往通过同义改写隐藏在特定段落。",
			SocraticHint:   fmt.Sprintf("Compare your chosen option with %s and identify the exact synonym phrase that matches the prompt.", para),
			SocraticHintZh: fmt.Sprintf("对比你的选项与 %s，找出与题干形成严格同义替换的词组。", paraZh),
		}
	default:
		return ReadingMistakeDiagnosis{
			Category:       "lexical_precision",
			Label:          "Paraphrase & Contextual Precision",
			LabelZh:        "同义替换定位与词形精准度",
			WhyItHappens:   "The selected answer either came from a nearby distractor clause or did not match the grammatical slot required by the prompt.",
			WhyItHappensZh: "所填答案可能来自邻近的干扰分句，或未能严格匹配题干空缺处的语法与语义要求。",
			SocraticHint:   fmt.Sprintf("Locate the paraphrase of the words immediately before and after the blank in %s.", para),
			SocraticHintZh: fmt.Sprintf("在 %s 中定位题干空格前后词语的同义改写，锁定唯一符合语法的原文词。", paraZh),
		}
	}
}

type LearnerProfileSettings struct {
	DailyMinutes    int     `json:"dailyMinutes"`
	TargetBand      float64 `json:"targetBand"`
	PreferredModule string  `json:"preferredModule"`
	Timezone        string  `json:"timezone"`
}

type BestNextActivity struct {
	ID               string `json:"id"`
	Kind             string `json:"kind"` // "srs" | "mistakes" | "reading_daily" | "vocab_lesson" | "reading_practice"
	Title            string `json:"title"`
	TitleZh          string `json:"titleZh"`
	Reason           string `json:"reason"`
	ReasonZh         string `json:"reasonZh"`
	CognitivePrinciple string `json:"cognitivePrinciple"`
	CognitivePrincipleZh string `json:"cognitivePrincipleZh"`
	EstimatedMinutes int    `json:"estimatedMinutes"`
	CtaLabel         string `json:"ctaLabel"`
	CtaLabelZh       string `json:"ctaLabelZh"`
	LessonIndex      *int   `json:"lessonIndex,omitempty"`
	MistakeType      string `json:"mistakeType,omitempty"`
	TestID           string `json:"testId,omitempty"`
	DueCount         int    `json:"dueCount,omitempty"`
}

type DailyStudyStep struct {
	ID               string `json:"id"`
	Kind             string `json:"kind"` // "srs" | "vocab_lesson" | "reading_daily" | "mistakes"
	StepNumber       int    `json:"stepNumber"`
	Title            string `json:"title"`
	TitleZh          string `json:"titleZh"`
	Subtitle         string `json:"subtitle"`
	SubtitleZh       string `json:"subtitleZh"`
	Minutes          int    `json:"minutes"`
	Status           string `json:"status"` // "completed" | "ready" | "up_next"
	LessonIndex      *int   `json:"lessonIndex,omitempty"`
	DueCount         int    `json:"dueCount,omitempty"`
	OpenMistakes     int    `json:"openMistakes,omitempty"`
}

type DailyStudySession struct {
	TargetMinutes    int              `json:"targetMinutes"`
	CompletedMinutes int              `json:"completedMinutes"`
	Steps            []DailyStudyStep `json:"steps"`
}

type SrsSummary struct {
	DueNow        int      `json:"dueNow"`
	TotalTracked  int      `json:"totalTracked"`
	LearningCount int      `json:"learningCount"`
	YoungCount    int      `json:"youngCount"`
	MatureCount   int      `json:"matureCount"`
	Retention7d   *float64 `json:"retention7d,omitempty"`
	ReviewsToday  int      `json:"reviewsToday"`
}

type ProficiencyEstimate struct {
	SufficientEvidence bool     `json:"sufficientEvidence"`
	QuestionsAnswered  int      `json:"questionsAnswered"`
	ReadingAccuracy    *float64 `json:"readingAccuracy,omitempty"`
	EstimatedBandRange string   `json:"estimatedBandRange"`
	CefrLevel          string   `json:"cefrLevel"`
	ConfidenceNote     string   `json:"confidenceNote"`
	ConfidenceNoteZh   string   `json:"confidenceNoteZh"`
	WeakestSkill       string   `json:"weakestSkill,omitempty"`
	StrongestSkill     string   `json:"strongestSkill,omitempty"`
}

type LearningPlanResponse struct {
	Profile      LearnerProfileSettings `json:"profile"`
	Progress     LearningProgress       `json:"progress"`
	NextActivity BestNextActivity       `json:"nextActivity"`
	DailySession DailyStudySession      `json:"dailySession"`
	Srs          SrsSummary             `json:"srs"`
	Proficiency  ProficiencyEstimate    `json:"proficiency"`
}

func (s *Store) UpdateLearningProfileSettings(ctx context.Context, in LearnerProfileSettings, zone string) (LearnerProfileSettings, error) {
	if err := s.ensureLearningProfile(ctx, zone); err != nil {
		return LearnerProfileSettings{}, err
	}
	minutes := in.DailyMinutes
	if minutes == 0 {
		minutes = 15
	}
	if minutes < 5 || minutes > 60 {
		return LearnerProfileSettings{}, fmt.Errorf("%w: dailyMinutes must be between 5 and 60", ErrInvalid)
	}
	band := in.TargetBand
	if band == 0 {
		band = 7.0
	}
	if band < 4.0 || band > 9.0 {
		return LearnerProfileSettings{}, fmt.Errorf("%w: targetBand must be between 4.0 and 9.0", ErrInvalid)
	}
	module, err := validReadingModule(in.PreferredModule)
	if err != nil {
		return LearnerProfileSettings{}, err
	}
	var out LearnerProfileSettings
	err = s.pool.QueryRow(ctx, `
		UPDATE learning_profile
		SET daily_minutes = $1, target_band = $2, preferred_module = $3
		WHERE id = 'workspace'
		RETURNING daily_minutes, target_band::float8, preferred_module, timezone
	`, minutes, band, module).Scan(&out.DailyMinutes, &out.TargetBand, &out.PreferredModule, &out.Timezone)
	return out, err
}

func (s *Store) GetLearningPlan(ctx context.Context, module, zone string) (LearningPlanResponse, error) {
	if err := s.ensureLearningProfile(ctx, zone); err != nil {
		return LearningPlanResponse{}, err
	}
	if err := s.syncVocabularySRS(ctx); err != nil {
		return LearningPlanResponse{}, err
	}
	progress, err := s.GetLearningProgress(ctx, zone)
	if err != nil {
		return LearningPlanResponse{}, err
	}

	var profile LearnerProfileSettings
	err = s.pool.QueryRow(ctx, `
		SELECT daily_minutes, target_band::float8, preferred_module, timezone
		FROM learning_profile
		WHERE id = 'workspace'
	`).Scan(&profile.DailyMinutes, &profile.TargetBand, &profile.PreferredModule, &profile.Timezone)
	if err != nil {
		return LearningPlanResponse{}, err
	}
	if strings.TrimSpace(module) != "" {
		if m, err := validReadingModule(module); err == nil {
			profile.PreferredModule = m
		}
	}

	loc, _ := learningLocation(profile.Timezone)
	now := time.Now().In(loc)
	today := now.Format("2006-01-02")

	// 1. Compute SRS summary deterministically.
	var srs SrsSummary
	err = s.pool.QueryRow(ctx, `
		SELECT
			count(*) FILTER (WHERE v.due_at <= now() OR c.in_review = true),
			count(*),
			count(*) FILTER (WHERE v.stability < 3.0),
			count(*) FILTER (WHERE v.stability >= 3.0 AND v.stability < 14.0),
			count(*) FILTER (WHERE v.stability >= 14.0)
		FROM vocabulary_srs v
		JOIN english_cards c ON c.id = v.card_id
	`).Scan(&srs.DueNow, &srs.TotalTracked, &srs.LearningCount, &srs.YoungCount, &srs.MatureCount)
	if err != nil {
		return LearningPlanResponse{}, err
	}
	if srs.DueNow > maxDailySRSQueue {
		srs.DueNow = maxDailySRSQueue
	}

	var total7d, recalled7d int
	_ = s.pool.QueryRow(ctx, `
		SELECT
			count(*),
			count(*) FILTER (WHERE rating >= 3),
			count(*) FILTER (WHERE (reviewed_at AT TIME ZONE $1)::date = $2::date)
		FROM vocabulary_review_logs
		WHERE reviewed_at >= now() - interval '7 days'
	`, profile.Timezone, today).Scan(&total7d, &recalled7d, &srs.ReviewsToday)
	if total7d > 0 {
		ret := math.Round(float64(recalled7d)*1000/float64(total7d)) / 10
		srs.Retention7d = &ret
	}

	// 2. Get reading dashboard for preferredModule.
	readingDash, err := s.GetReadingLearning(ctx, profile.PreferredModule, profile.Timezone)
	if err != nil {
		return LearningPlanResponse{}, err
	}

	// 3. Find next uncompleted vocabulary lesson.
	cardCount, _ := s.englishCardCount(ctx)
	totalLessons := max(1, (cardCount+4)/5)
	completedSet := make(map[int]bool, len(progress.Completed))
	for _, idx := range progress.Completed {
		completedSet[idx] = true
	}
	nextLesson := 0
	for i := 0; i < totalLessons; i++ {
		if !completedSet[i] {
			nextLesson = i
			break
		}
	}

	// Check today's activity from progress.Weekly.
	todayVocabEvents := 0
	for _, d := range progress.Weekly {
		if d.Day == today {
			todayVocabEvents = d.Vocabulary
			break
		}
	}
	dailyReadingDone := readingDash.Daily.Session != nil && readingDash.Daily.Session.Status == "submitted"
	vocabLessonDoneToday := todayVocabEvents > 0 && srs.ReviewsToday < todayVocabEvents

	// 4. Compute honest, sample-size-aware ProficiencyEstimate.
	proficiency := computeProficiencyEstimate(ctx, s, profile.PreferredModule, readingDash.QuestionsAnswered)

	// 5. Build the 10-20 minute Smart Daily Study Session.
	dailySession := buildDailyStudySession(profile.DailyMinutes, srs, nextLesson, vocabLessonDoneToday, dailyReadingDone, readingDash)

	// 6. Select the single highest-impact "Best Next Learning Activity" with transparent cognitive rationale.
	nextActivity := selectBestNextActivity(srs, readingDash, nextLesson, dailyReadingDone, proficiency)

	return LearningPlanResponse{
		Profile:      profile,
		Progress:     progress,
		NextActivity: nextActivity,
		DailySession: dailySession,
		Srs:          srs,
		Proficiency:  proficiency,
	}, nil
}

func computeProficiencyEstimate(ctx context.Context, s *Store, module string, questionsAnswered int) ProficiencyEstimate {
	est := ProficiencyEstimate{
		SufficientEvidence: questionsAnswered >= 15,
		QuestionsAnswered:  questionsAnswered,
		EstimatedBandRange: "Calibrating (15+ questions needed)",
		CefrLevel:          "Calibrating",
		ConfidenceNote:     fmt.Sprintf("You have answered %d reading questions so far. Complete at least 15 questions across passages before we estimate an unofficial IELTS band range.", questionsAnswered),
		ConfidenceNoteZh:   fmt.Sprintf("目前已作答 %d 道阅读题。需至少完成 15 道题目后，系统才会给出基于真实样本的非官方雅思分数区间估计。", questionsAnswered),
	}

	var totalCorrect, totalScored int
	_ = s.pool.QueryRow(ctx, `
		SELECT COALESCE(sum(score), 0), COALESCE(sum(total), 0)
		FROM reading_sessions
		WHERE module = $1 AND status = 'submitted' AND kind != 'mistake_review'
	`, module).Scan(&totalCorrect, &totalScored)

	if totalScored > 0 && questionsAnswered > 0 {
		denom := max(questionsAnswered, min(totalScored, questionsAnswered))
		acc := math.Round(float64(totalCorrect)*1000/float64(max(1, denom))) / 10
		if acc > 100 {
			acc = 100
		}
		est.ReadingAccuracy = &acc

		if questionsAnswered >= 15 {
			est.SufficientEvidence = true
			switch {
			case acc >= 88:
				est.EstimatedBandRange = "8.0–8.5 (Unofficial)"
				est.CefrLevel = "C1–C2"
			case acc >= 75:
				est.EstimatedBandRange = "7.0–7.5 (Unofficial)"
				est.CefrLevel = "C1"
			case acc >= 62:
				est.EstimatedBandRange = "6.0–6.5 (Unofficial)"
				est.CefrLevel = "B2"
			case acc >= 48:
				est.EstimatedBandRange = "5.5–6.0 (Unofficial)"
				est.CefrLevel = "B1–B2"
			default:
				est.EstimatedBandRange = "4.5–5.5 (Unofficial)"
				est.CefrLevel = "B1"
			}
			est.ConfidenceNote = fmt.Sprintf("Based on %.1f%% accuracy across %d answered questions. Unofficial diagnostic estimate.", acc, questionsAnswered)
			est.ConfidenceNoteZh = fmt.Sprintf("基于 %d 道已作答题目（正确率 %.1f%%）计算的诊断区间（非官方成绩）。", questionsAnswered, acc)
		}
	}

	// Identify weakest & strongest question types when sample size >= 5.
	type typeAcc struct {
		kind string
		acc  float64
	}
	scoredTypes := []typeAcc{}
	for _, rec := range readingDashRecommendationsForSkillSummary(ctx, s, module) {
		if rec.SampleSize >= 5 && rec.Accuracy != nil {
			scoredTypes = append(scoredTypes, typeAcc{kind: rec.Type, acc: *rec.Accuracy})
		}
	}
	if len(scoredTypes) > 0 {
		sort.Slice(scoredTypes, func(i, j int) bool { return scoredTypes[i].acc < scoredTypes[j].acc })
		est.WeakestSkill = scoredTypes[0].kind
		if len(scoredTypes) > 1 && scoredTypes[len(scoredTypes)-1].acc >= 70 {
			est.StrongestSkill = scoredTypes[len(scoredTypes)-1].kind
		}
	}
	return est
}

func readingDashRecommendationsForSkillSummary(ctx context.Context, s *Store, module string) []ReadingRecommendation {
	tests, err := s.readingLearningTests(ctx)
	if err != nil {
		return nil
	}
	rows, err := s.pool.Query(ctx, `SELECT `+readingSessionColumns+` FROM reading_sessions s JOIN reading_tests t ON t.id=s.test_id WHERE s.module=$1 AND s.status='submitted' ORDER BY s.submitted_at DESC LIMIT 100`, module)
	if err != nil {
		return nil
	}
	defer rows.Close()
	sessions := []ReadingSession{}
	for rows.Next() {
		if sess, err := scanReadingSession(rows); err == nil {
			sessions = append(sessions, sess)
		}
	}
	return buildReadingRecommendations(tests, sessions, module, time.Now())
}

func buildDailyStudySession(targetMinutes int, srs SrsSummary, nextLesson int, vocabLessonDoneToday, dailyReadingDone bool, readingDash ReadingLearningDashboard) DailyStudySession {
	if targetMinutes < 5 {
		targetMinutes = 15
	}
	srsMin := max(2, int(math.Round(float64(targetMinutes)*0.22)))
	vocabMin := max(3, int(math.Round(float64(targetMinutes)*0.28)))
	readingMin := max(4, int(math.Round(float64(targetMinutes)*0.30)))
	reviewMin := max(2, targetMinutes-srsMin-vocabMin-readingMin)

	srsDone := srs.DueNow == 0 && srs.ReviewsToday > 0
	srsStatus := "ready"
	if srsDone {
		srsStatus = "completed"
	} else if srs.DueNow == 0 {
		srsStatus = "completed"
	}

	vocabStatus := "ready"
	if vocabLessonDoneToday {
		vocabStatus = "completed"
	}

	readingStatus := "ready"
	if dailyReadingDone {
		readingStatus = "completed"
	}

	mistakeDone := readingDash.Mistakes.Open == 0 && readingDash.Mistakes.Resolved > 0
	mistakeStatus := "ready"
	if mistakeDone || readingDash.Mistakes.Open == 0 {
		mistakeStatus = "completed"
	}

	steps := []DailyStudyStep{
		{
			ID:         "step-srs",
			Kind:       "srs",
			StepNumber: 1,
			Title:      fmt.Sprintf("Spaced Recall (%d due)", srs.DueNow),
			TitleZh:    fmt.Sprintf("间隔检索复习（%d 词待复习）", srs.DueNow),
			Subtitle:   "Active retrieval before memory decay (FSRS)",
			SubtitleZh: "在遗忘临界点前主动回忆，强化长期记忆",
			Minutes:    srsMin,
			Status:     srsStatus,
			DueCount:   srs.DueNow,
		},
		{
			ID:          "step-vocab",
			Kind:        "vocab_lesson",
			StepNumber:  2,
			Title:       fmt.Sprintf("Contextual Vocabulary · Lesson %d", nextLesson+1),
			TitleZh:     fmt.Sprintf("语境词汇精学 · 第 %d 课", nextLesson+1),
			Subtitle:    "Learn 5 words with Band 9 collocations & active recall",
			SubtitleZh:  "掌握 5 个核心词的高分搭配、避错指南与语境造句",
			Minutes:     vocabMin,
			Status:      vocabStatus,
			LessonIndex: &nextLesson,
		},
		{
			ID:         "step-reading",
			Kind:       "reading_daily",
			StepNumber: 3,
			Title:      "5-Question IELTS Reading Excerpt",
			TitleZh:    "每日 5 题雅思阅读精练",
			Subtitle:   readingDash.Daily.Title,
			SubtitleZh: "5 道真题级同源题，专注证据定位与同义替换",
			Minutes:    readingMin,
			Status:     readingStatus,
		},
		{
			ID:           "step-mistakes",
			Kind:         "mistakes",
			StepNumber:   4,
			Title:        fmt.Sprintf("Targeted Mistake Remediation (%d open)", readingDash.Mistakes.Open),
			TitleZh:      fmt.Sprintf("错题诊断与重做（%d 道待攻克）", readingDash.Mistakes.Open),
			Subtitle:     "Verify passage evidence and resolve recurring traps",
			SubtitleZh:   "定位原文证据段，消除 FALSE/NOT GIVEN 等高频陷阱",
			Minutes:      reviewMin,
			Status:       mistakeStatus,
			OpenMistakes: readingDash.Mistakes.Open,
		},
	}

	completedMin := 0
	for _, st := range steps {
		if st.Status == "completed" {
			completedMin += st.Minutes
		}
	}
	return DailyStudySession{
		TargetMinutes:    targetMinutes,
		CompletedMinutes: completedMin,
		Steps:            steps,
	}
}

func selectBestNextActivity(srs SrsSummary, readingDash ReadingLearningDashboard, nextLesson int, dailyReadingDone bool, prof ProficiencyEstimate) BestNextActivity {
	// Priority 1: Due FSRS vocabulary reviews (prevent forgetting of already-invested effort).
	if srs.DueNow > 0 {
		estMin := max(2, min(6, (srs.DueNow+2)/3))
		return BestNextActivity{
			ID:                   "srs_review",
			Kind:                 "srs",
			Title:                fmt.Sprintf("Review %d due vocabulary words in context", srs.DueNow),
			TitleZh:              fmt.Sprintf("在语境中复习 %d 个到期核心词", srs.DueNow),
			Reason:               fmt.Sprintf("%d words from your lessons and saved reading passages have reached their FSRS recall threshold. Active retrieval right now multiplies memory stability.", srs.DueNow),
			ReasonZh:             fmt.Sprintf("你在课程和阅读中积累的 %d 个词汇已到达 FSRS 最佳抗遗忘复习点，现在主动检索能成倍提升记忆稳定性。", srs.DueNow),
			CognitivePrinciple:   "Spaced Retrieval & Desirable Difficulty",
			CognitivePrincipleZh: "间隔重复与合意困难（FSRS 主动检索）",
			EstimatedMinutes:     estMin,
			CtaLabel:             "Start Spaced Recall",
			CtaLabelZh:           "开始间隔复习",
			DueCount:             srs.DueNow,
		}
	}

	// Priority 2: Open reading mistakes (deliberate remediation of observed errors).
	if readingDash.Mistakes.Open > 0 {
		focusType := ""
		maxOpen := 0
		for _, bt := range readingDash.Mistakes.ByType {
			if bt.Open > maxOpen {
				maxOpen = bt.Open
				focusType = bt.Type
			}
		}
		return BestNextActivity{
			ID:                   "mistake_remediation",
			Kind:                 "mistakes",
			Title:                fmt.Sprintf("Resolve %d open reading mistakes with evidence", readingDash.Mistakes.Open),
			TitleZh:              fmt.Sprintf("结合原文证据攻克 %d 道阅读错题", readingDash.Mistakes.Open),
			Reason:               fmt.Sprintf("You have %d unresolved reading questions. Re-locating the passage evidence before seeing the answer key is the fastest way to raise your IELTS accuracy.", readingDash.Mistakes.Open),
			ReasonZh:             fmt.Sprintf("你有 %d 道未解决的阅读错题。在看答案前先回原文定位证据句，是提升雅思阅读正确率最高效的方式。", readingDash.Mistakes.Open),
			CognitivePrinciple:   "Deliberate Practice & Error Remediation",
			CognitivePrincipleZh: "刻意练习与错因溯源训练",
			EstimatedMinutes:     max(3, min(8, readingDash.Mistakes.Open*2)),
			CtaLabel:             "Review Mistakes Now",
			CtaLabelZh:           "立即攻克错题",
			MistakeType:          focusType,
		}
	}

	// Priority 3: Daily 5-question reading challenge if not completed today.
	if !dailyReadingDone {
		return BestNextActivity{
			ID:                   "daily_reading",
			Kind:                 "reading_daily",
			Title:                fmt.Sprintf("Complete Today's 5-Question Reading: %s", readingDash.Daily.Title),
			TitleZh:              fmt.Sprintf("完成今日 5 题阅读精练：%s", readingDash.Daily.Title),
			Reason:               "A focused 5-minute passage excerpt builds daily comprehension and evidence-scanning speed without exam fatigue.",
			ReasonZh:             "用 5 分钟完成一段高密度短文与 5 道同源题，在不产生疲劳感的前提下训练同义替换与证据定位。",
			CognitivePrinciple:   "Comprehensible Input & Evidence Localization",
			CognitivePrincipleZh: "可理解性输入与证据定位训练",
			EstimatedMinutes:     5,
			CtaLabel:             "Start 5-Min Reading",
			CtaLabelZh:           "开始 5 分钟阅读",
		}
	}

	// Priority 4: Weakest reading skill drill if we have sufficient evidence of a weak question type.
	if prof.WeakestSkill != "" && len(readingDash.Recommendations) > 0 {
		rec := readingDash.Recommendations[0]
		if rec.Accuracy != nil && *rec.Accuracy < 75 {
			return BestNextActivity{
				ID:                   "skill_drill",
				Kind:                 "reading_practice",
				Title:                fmt.Sprintf("Target Weak Skill: %s", rec.Title),
				TitleZh:              fmt.Sprintf("专项突破薄弱题型：%s", rec.Title),
				Reason:               fmt.Sprintf("Your accuracy on this question type is %.1f%% across %d questions. Let's work on a targeted set.", *rec.Accuracy, rec.SampleSize),
				ReasonZh:             fmt.Sprintf("你在该题型上的历史正确率为 %.1f%%（基于 %d 题样本）。针对薄弱环节进行专项训练收益最高。", *rec.Accuracy, rec.SampleSize),
				CognitivePrinciple:   "Adaptive Difficulty & Targeted Skill Transfer",
				CognitivePrincipleZh: "自适应难度与薄弱项迁移训练",
				EstimatedMinutes:     max(5, rec.DurationSeconds/60),
				CtaLabel:             "Practice Targeted Skill",
				CtaLabelZh:           "开始专项突破",
				TestID:               rec.TestID,
			}
		}
	}

	// Priority 5: Next contextual vocabulary lesson.
	return BestNextActivity{
		ID:                   "vocab_lesson",
		Kind:                 "vocab_lesson",
		Title:                fmt.Sprintf("Start Contextual Vocabulary Lesson %d", nextLesson+1),
		TitleZh:              fmt.Sprintf("开始第 %d 课语境词汇精学", nextLesson+1),
		Reason:               fmt.Sprintf("Your due reviews and daily reading are clear. Master 5 new words with IELTS Band 9 collocations in Lesson %d.", nextLesson+1),
		ReasonZh:             fmt.Sprintf("今日待复习词汇与阅读挑战均已就绪。现在学习第 %d 课的 5 个核心词及其雅思高分搭配，并自动加入间隔复习计划。", nextLesson+1),
		CognitivePrinciple:   "Contextual Vocabulary Acquisition & Active Recall",
		CognitivePrincipleZh: "语境词汇习得与主动检索",
		EstimatedMinutes:     4,
		CtaLabel:             fmt.Sprintf("Start Lesson %d", nextLesson+1),
		CtaLabelZh:           fmt.Sprintf("开始第 %d 课", nextLesson+1),
		LessonIndex:          &nextLesson,
	}
}
