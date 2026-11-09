package desk

import (
	"strings"
	"testing"
)

func lessonFixture() []EnglishCard {
	return []EnglishCard{
		{ID: "1", Word: "aboard", Meaning: "在船上", Examples: []string{"The lecturer stated the claim aboard.", "We went aboard the ferry at noon."},
			Senses: WordSenses{{Pos: "adverb", En: "on or onto a ship, plane or train", Zh: "在船上"}}},
		{ID: "2", Word: "abroad", Meaning: "在国外", Examples: []string{"The lecturer stated the claim abroad.", "We went abroad the ferry at noon."},
			Senses: WordSenses{{Pos: "adverb", En: "in or to a foreign country", Zh: "在国外"}}},
		{ID: "3", Word: "abolish", Meaning: "废除", Examples: []string{"The leaflet tells new students to abolish."},
			Senses: WordSenses{{Pos: "verb", En: "to officially end a law or system", Zh: "废除"}}},
		{ID: "4", Word: "absence", Meaning: "缺席", Examples: []string{"Her absence from the meeting was noticed."}},
		{ID: "5", Word: "absent", Meaning: "缺席的", Examples: []string{"He was absent from school on Monday."}},
	}
}

func lessonReal() map[string][]string {
	return map[string][]string{
		"1": {"We went aboard the ferry at noon."},
		"2": {"We went abroad the ferry at noon."},
		"4": {"Her absence from the meeting was noticed."},
		"5": {"He was absent from school on Monday."},
	}
}

func findPlanned(qs []plannedQuestion, id string) (plannedQuestion, bool) {
	for _, q := range qs {
		if q.ID == id {
			return q, true
		}
	}
	return plannedQuestion{}, false
}

func TestQuizPlanUsesDefinitionWithoutARealSentence(t *testing.T) {
	plan := newQuizPlan(lessonFixture(), lessonReal(), nil)
	pending := plan.next()
	if _, ok := findPlanned(pending, "abolish-cloze"); ok {
		t.Fatal("a template sentence was used for a cloze")
	}
	q, ok := findPlanned(pending, "abolish-definition")
	if !ok {
		t.Fatal("expected a definition question for abolish")
	}
	if q.Prompt != "to officially end a law or system" || q.Answer != "abolish" || len(q.Choices) != 4 {
		t.Fatalf("definition question = %+v", q.LessonQuestion)
	}
}

func TestQuizPlanSkipsAChoiceThatMakesASavedSentence(t *testing.T) {
	plan := newQuizPlan(lessonFixture(), lessonReal(), nil)
	q, ok := findPlanned(plan.next(), "aboard-cloze")
	if !ok {
		t.Fatal("expected a cloze for aboard")
	}
	if q.Before != "We went " || q.After != " the ferry at noon." {
		t.Fatalf("cloze = %q ___ %q", q.Before, q.After)
	}
	if containsFold(q.Choices, "abroad") {
		t.Fatalf("abroad forms a saved sentence and must not be a choice: %v", q.Choices)
	}
}

func TestQuizPlanKeepsOverlappingMeaningsApart(t *testing.T) {
	plan := newQuizPlan(lessonFixture(), lessonReal(), nil)
	q, ok := findPlanned(plan.next(), "absence-meaning")
	if !ok {
		t.Fatal("expected a meaning question for absence")
	}
	if containsFold(q.Choices, "缺席的") {
		t.Fatalf("缺席的 overlaps 缺席: %v", q.Choices)
	}
}

func TestQuizPlanReplacesChoicesTheModelSaysAlsoFit(t *testing.T) {
	cards := lessonFixture()
	extra := []EnglishCard{{ID: "6", Word: "absorb", Meaning: "吸收"}, {ID: "7", Word: "abstract", Meaning: "抽象的"}}
	plan := newQuizPlan(cards, lessonReal(), extra)
	pending := plan.next()
	q, _ := findPlanned(pending, "absence-cloze")
	var other string
	for _, choice := range q.Choices {
		if choice != "absence" {
			other = choice
			break
		}
	}
	review := quizReview{}
	for _, p := range pending {
		fits := []string{p.Answer}
		if p.ID == q.ID {
			fits = append(fits, other)
		}
		review.Questions = append(review.Questions, struct {
			ID      string   `json:"id"`
			Fits    []string `json:"fits"`
			Why     string   `json:"why"`
			Chinese string   `json:"chinese"`
		}{ID: p.ID, Fits: fits, Why: "Because.", Chinese: "中文"})
	}
	plan.apply(pending, review)
	if _, ok := plan.accepted["absence-use"]; ok {
		t.Fatal("a question with two fitting choices was accepted")
	}
	next := plan.next()
	if len(next) != 1 || next[0].ID != q.ID {
		t.Fatalf("expected only %s to be asked again, got %d questions", q.ID, len(next))
	}
	if containsFold(next[0].Choices, other) {
		t.Fatalf("%s still offered after the model said it fits", other)
	}
	if got := plan.questions(); len(got) != len(pending)-1 || got[0].Kind != "meaning" {
		t.Fatalf("questions = %d, first kind %q", len(got), got[0].Kind)
	}
}

func TestQuizPlanDropsASentenceWhoseAnswerDoesNotFit(t *testing.T) {
	plan := newQuizPlan(lessonFixture(), lessonReal(), nil)
	pending := plan.next()
	q, _ := findPlanned(pending, "abroad-cloze")
	review := quizReview{}
	review.Questions = append(review.Questions, struct {
		ID      string   `json:"id"`
		Fits    []string `json:"fits"`
		Why     string   `json:"why"`
		Chinese string   `json:"chinese"`
	}{ID: q.ID, Fits: nil, Why: "No choice fits.", Chinese: ""})
	plan.apply([]plannedQuestion{q}, review)
	next, ok := findPlanned(plan.next(), "abroad-definition")
	if !ok || !strings.Contains(next.Prompt, "foreign country") {
		t.Fatalf("expected a definition question after the sentence was dropped, got %+v", next.LessonQuestion)
	}
}

func TestFastTemplateFrameFilter(t *testing.T) {
	known := getBuiltinTemplateFrames()
	if !known["the lecture explains ___ in simple language."] {
		t.Fatal("expected builtin template frame to be indexed")
	}
	cards := []EnglishCard{
		{ID: "1", Word: "alpha", Examples: []string{"We saw alpha at the gate.", "Unique alpha sentence."}},
		{ID: "2", Word: "beta", Examples: []string{"We saw beta at the gate."}},
		{ID: "3", Word: "gamma", Examples: []string{"We saw gamma at the gate."}},
	}
	if !isSharedSentenceFrame(cards, "we saw ___ at the gate.", "we saw ", " at the gate.") {
		t.Fatal("expected frame shared by 3 cards to be detected as template")
	}
	if isSharedSentenceFrame(cards, "unique ___ sentence.", "unique ", " sentence.") {
		t.Fatal("unique sentence frame should not be marked as shared template")
	}
}
