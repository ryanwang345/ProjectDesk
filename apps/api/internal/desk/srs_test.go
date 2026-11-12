package desk

import (
	"strings"
	"testing"
	"time"
)

func TestFSRSRetrievabilityAndScheduling(t *testing.T) {
	now := time.Date(2026, 11, 9, 10, 0, 0, 0, time.UTC)

	// At elapsedDays == stability, FSRS retrievability is 0.90.
	r := FSRSRetrievability(5.0, 5.0)
	if r < 0.899 || r > 0.901 {
		t.Fatalf("expected 90%% retrievability at t=S, got %f", r)
	}

	// First review in recognition mode with Good (3)
	initial := VocabularySRSState{
		CardID:     "card-1",
		Stability:  0.8,
		Difficulty: 5.5,
		State:      "learning",
		DueAt:      now,
	}
	res1, err := ScheduleVocabularyReview(initial, SRSRatingGood, SRSModeRecognition, now)
	if err != nil {
		t.Fatalf("ScheduleVocabularyReview failed: %v", err)
	}
	if res1.Next.Reps != 1 || res1.Next.RecognitionReps != 1 || res1.Next.ProductiveReps != 0 {
		t.Fatalf("unexpected reps after first recognition review: %+v", res1.Next)
	}
	if res1.Next.Stability < 2.5 {
		t.Fatalf("expected stability >= 2.5 after Good rating, got %f", res1.Next.Stability)
	}
	if !res1.KeepInReviewTab {
		t.Fatalf("expected KeepInReviewTab=true until stability >= 7 and productive recall is demonstrated")
	}

	// Second review 3 days later in productive mode with Good (3)
	later := now.Add(3 * 24 * time.Hour)
	res2, err := ScheduleVocabularyReview(res1.Next, SRSRatingGood, SRSModeProductive, later)
	if err != nil {
		t.Fatalf("second ScheduleVocabularyReview failed: %v", err)
	}
	if res2.Next.ProductiveReps != 1 {
		t.Fatalf("expected ProductiveReps=1, got %d", res2.Next.ProductiveReps)
	}
	if res2.Next.Stability <= res1.Next.Stability*1.5 {
		t.Fatalf("expected significant stability growth on productive recall, got %f -> %f", res1.Next.Stability, res2.Next.Stability)
	}

	// Third review with Easy (4) in productive mode should push stability >= 7.0 and clear KeepInReviewTab
	later2 := later.Add(6 * 24 * time.Hour)
	res3, err := ScheduleVocabularyReview(res2.Next, SRSRatingEasy, SRSModeProductive, later2)
	if err != nil {
		t.Fatalf("third ScheduleVocabularyReview failed: %v", err)
	}
	if res3.Next.Stability < 7.0 || res3.KeepInReviewTab {
		t.Fatalf("expected stability >= 7.0 and KeepInReviewTab=false, got stability=%f keep=%v", res3.Next.Stability, res3.KeepInReviewTab)
	}

	// Lapse (Again = 1) should reduce stability, increment lapses, and re-enable KeepInReviewTab
	resLapse, err := ScheduleVocabularyReview(res3.Next, SRSRatingAgain, SRSModeProductive, later2.Add(10*24*time.Hour))
	if err != nil {
		t.Fatalf("lapse ScheduleVocabularyReview failed: %v", err)
	}
	if resLapse.Next.Lapses != 1 || resLapse.Next.State != "relearning" || !resLapse.KeepInReviewTab {
		t.Fatalf("expected relearning state and KeepInReviewTab=true on lapse: %+v", resLapse)
	}
}

func TestDiagnoseReadingMistakeDeterminism(t *testing.T) {
	cases := []struct {
		name     string
		mistake  ReadingMistake
		category string
	}{
		{
			name: "unanswered question",
			mistake: ReadingMistake{
				UserAnswer: "",
				Question:   ReadingQuestion{Type: QMultipleChoice, EvidenceParagraph: "B"},
			},
			category: "unanswered_pacing",
		},
		{
			name: "word limit exceeded",
			mistake: ReadingMistake{
				UserAnswer: "the ancient Chinese rocket arrows",
				Question:   ReadingQuestion{Type: QSentenceCompletion, WordLimit: 2, EvidenceParagraph: "C"},
			},
			category: "word_limit_violation",
		},
		{
			name: "true false not given confusion",
			mistake: ReadingMistake{
				UserAnswer: "FALSE",
				Question:   ReadingQuestion{Type: QTrueFalseNotGiven, EvidenceParagraph: "A"},
			},
			category: "false_vs_not_given",
		},
		{
			name: "matching headings scope trap",
			mistake: ReadingMistake{
				UserAnswer: "iv",
				Question:   ReadingQuestion{Type: QMatchingHeadings, EvidenceParagraph: "D"},
			},
			category: "heading_scope_trap",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			diag := DiagnoseReadingMistake(tc.mistake)
			if diag.Category != tc.category {
				t.Fatalf("expected category %q, got %q", tc.category, diag.Category)
			}
			if !strings.Contains(diag.SocraticHint, "Paragraph "+tc.mistake.Question.EvidenceParagraph) {
				t.Fatalf("expected SocraticHint to reference Paragraph %s, got %q", tc.mistake.Question.EvidenceParagraph, diag.SocraticHint)
			}
		})
	}
}

func TestSelectBestNextActivityPriority(t *testing.T) {
	dash := ReadingLearningDashboard{
		Daily: DailyReadingSummary{Day: "2026-11-09", Title: "Urban Heat Islands"},
		Mistakes: ReadingMistakeSummary{
			Open:   3,
			ByType: []MistakeTypeSummary{{Type: QTrueFalseNotGiven, Open: 3}},
		},
	}
	prof := ProficiencyEstimate{SufficientEvidence: false, QuestionsAnswered: 5}

	// 1. When due SRS cards > 0, SRS recall comes first
	act1 := selectBestNextActivity(SrsSummary{DueNow: 5}, dash, 2, false, prof)
	if act1.Kind != "srs" || act1.DueCount != 5 {
		t.Fatalf("expected srs activity first when due>0, got %+v", act1)
	}

	// 2. When due SRS == 0 and open mistakes > 0, mistake remediation comes next
	act2 := selectBestNextActivity(SrsSummary{DueNow: 0}, dash, 2, false, prof)
	if act2.Kind != "mistakes" || act2.MistakeType != QTrueFalseNotGiven {
		t.Fatalf("expected mistakes remediation when due=0 and open mistakes>0, got %+v", act2)
	}

	// 3. When mistakes == 0 and daily reading not done, daily reading comes next
	dash.Mistakes.Open = 0
	act3 := selectBestNextActivity(SrsSummary{DueNow: 0}, dash, 2, false, prof)
	if act3.Kind != "reading_daily" {
		t.Fatalf("expected reading_daily when mistakes=0 and daily not done, got %+v", act3)
	}

	// 4. When daily reading is done, next vocabulary lesson is recommended
	act4 := selectBestNextActivity(SrsSummary{DueNow: 0}, dash, 2, true, prof)
	if act4.Kind != "vocab_lesson" || act4.LessonIndex == nil || *act4.LessonIndex != 2 {
		t.Fatalf("expected vocab_lesson 2 when daily reading is done, got %+v", act4)
	}
}
