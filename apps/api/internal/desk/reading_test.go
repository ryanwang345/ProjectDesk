package desk

import "testing"

func TestBuiltinReadingTestsCoverAllTwelveTypesAndPassValidation(t *testing.T) {
	tests := builtinReadingTests()
	if len(tests) < 6 {
		t.Fatalf("expected at least 6 built-in reading tests, got %d", len(tests))
	}
	seenTypes := map[string]bool{}
	var acFullFound, gtFullFound bool
	for _, rt := range tests {
		if err := validateSeedTest(rt); err != nil {
			t.Fatalf("%s: %v", rt.Slug, err)
		}
		if rt.Slug == "academic-full-1" {
			acFullFound = true
			if len(rt.Passages) != 3 || len(rt.Questions) != 40 {
				t.Fatalf("academic-full-1 should have 3 passages and 40 questions, got %d passages and %d questions", len(rt.Passages), len(rt.Questions))
			}
		}
		if rt.Slug == "general-full-1" {
			gtFullFound = true
			if len(rt.Passages) != 3 || len(rt.Questions) != 40 {
				t.Fatalf("general-full-1 should have 3 passages and 40 questions, got %d passages and %d questions", len(rt.Passages), len(rt.Questions))
			}
		}
		for _, q := range rt.Questions {
			seenTypes[q.Type] = true
		}
	}
	if !acFullFound || !gtFullFound {
		t.Fatalf("expected both academic-full-1 and general-full-1")
	}
	for qType := range validQuestionTypes {
		if !seenTypes[qType] {
			t.Fatalf("missing IELTS question type %s in built-in tests", qType)
		}
	}
}

func TestCheckReadingAnswerHandlesVariantsAndWordLimits(t *testing.T) {
	tfngQ := ReadingQuestion{
		ID:            "q1",
		Type:          QTrueFalseNotGiven,
		CorrectAnswer: "NOT GIVEN",
	}
	for _, valid := range []string{"NOT GIVEN", "not given", "NG", "not-given"} {
		if !CheckReadingAnswer(tfngQ, valid) {
			t.Fatalf("expected %q to match NOT GIVEN", valid)
		}
	}
	if CheckReadingAnswer(tfngQ, "FALSE") {
		t.Fatalf("did not expect FALSE to match NOT GIVEN")
	}

	numQ := ReadingQuestion{
		ID:                "q2",
		Type:              QShortAnswer,
		WordLimit:         2,
		CorrectAnswer:     "15",
		AcceptableAnswers: []string{"15 degrees", "fifteen degrees"},
	}
	for _, valid := range []string{"15", "fifteen", "15 degrees", "Fifteen Degrees."} {
		if !CheckReadingAnswer(numQ, valid) {
			t.Fatalf("expected %q to match number question", valid)
		}
	}
	if CheckReadingAnswer(numQ, "more than fifteen degrees") {
		t.Fatalf("expected answer exceeding wordLimit=2 to be rejected")
	}

	mcQ := ReadingQuestion{
		ID:                "q3",
		Type:              QMultipleChoice,
		CorrectAnswer:     "B",
		AcceptableAnswers: []string{"B. Continuous sensor calibration"},
	}
	if !CheckReadingAnswer(mcQ, "b") || !CheckReadingAnswer(mcQ, "B. Continuous sensor calibration") {
		t.Fatalf("expected both letter and full option text to match multiple choice")
	}
}

func TestCalculateIeltsReadingBandAcademicAndGeneral(t *testing.T) {
	// Academic 30/40 -> 7.0; General Training 30/40 -> 6.0
	acBand, acScaled := CalculateIeltsReadingBand(30, 40, "academic")
	if acBand != 7.0 || acScaled != 30 {
		t.Fatalf("Academic 30/40 = (%v, %d), want (7.0, 30)", acBand, acScaled)
	}
	gtBand, gtScaled := CalculateIeltsReadingBand(30, 40, "general")
	if gtBand != 6.0 || gtScaled != 30 {
		t.Fatalf("General 30/40 = (%v, %d), want (6.0, 30)", gtBand, gtScaled)
	}
	// Academic 39/40 -> 9.0
	band9, _ := CalculateIeltsReadingBand(39, 40, "academic")
	if band9 != 9.0 {
		t.Fatalf("Academic 39/40 = %v, want 9.0", band9)
	}
}

func TestScoreReadingSessionAndRedaction(t *testing.T) {
	full := builtinReadingTests()[0] // academic-full-1 (40 questions)
	redacted := RedactTestForActiveSession(full)
	for _, q := range redacted.Questions {
		if q.CorrectAnswer != "" || len(q.AcceptableAnswers) != 0 || q.Explanation != "" || q.EvidenceQuote != "" {
			t.Fatalf("redacted question %s still exposed protected fields: %#v", q.ID, q)
		}
	}

	answers := map[string]string{}
	for i, q := range full.Questions {
		if i < 35 {
			answers[q.ID] = q.CorrectAnswer
		} else {
			answers[q.ID] = "wrong answer"
		}
	}
	res := ScoreReadingSession(full, answers, 2850)
	if res.Score != 35 || res.Total != 40 || res.Band != 8.0 {
		t.Fatalf("unexpected score result: score=%d total=%d band=%v", res.Score, res.Total, res.Band)
	}
	if len(res.ByType) == 0 {
		t.Fatalf("expected question-type breakdown")
	}
}

func TestFallbackGeneratedReadingTestIsValid(t *testing.T) {
	gen := buildFallbackGeneratedTest("Urban Vertical Farming", "academic", "Band 7.0-8.0", []string{QTrueFalseNotGiven, QMultipleChoice})
	if err := validateGeneratedReadingTest(&gen); err != nil {
		t.Fatalf("fallback generated test failed validation: %v", err)
	}
}
