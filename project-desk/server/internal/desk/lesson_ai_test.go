package desk

import (
	"strings"
	"testing"
)

func TestAcceptLessonKeepsModelSentences(t *testing.T) {
	card := EnglishCard{ID: "1", Word: "abandon", Meaning: "放弃", Generated: false}
	examples := make([]string, ExampleCount)
	for i := range examples {
		examples[i] = strings.TrimSpace(strings.Repeat("She chose to abandon the plan. ", 1))
		examples[i] = []string{
			"She chose to abandon the plan.",
			"I will not abandon you at the station.",
			"They had to abandon the picnic when it rained.",
			"He refused to abandon the idea.",
			"Do not abandon your bag on the train.",
			"The crew will abandon ship only as a last resort.",
			"She might abandon the course after this term.",
			"We should not abandon the old rule yet.",
			"He did abandon the match at halftime.",
			"I cannot abandon this work tonight.",
		}[i]
	}
	draft := lessonDraft{
		Questions: []LessonQuestion{
			{Kind: "meaning", Prompt: "abandon", Answer: "放弃", Choices: []string{"放弃", "摘要", "学院", "影响"}, Why: "It means you leave something.", Chinese: "放弃"},
			{Kind: "cloze", Before: "She chose to ", After: " the plan.", Answer: "abandon", Choices: []string{"abandon", "abandon", "abandon", "abandon"}, Why: "You leave the plan behind.", Chinese: "她决定放弃这个计划。"},
		},
	}
	draft.Words = append(draft.Words, struct {
		Word     string   `json:"word"`
		Examples []string `json:"examples"`
	}{Word: "abandon", Examples: examples})

	// Meaning choices must be meanings of lesson cards. Use one card, so every choice must be its meaning.
	draft.Questions[0].Choices = []string{"放弃", "放弃", "放弃", "放弃"}

	gotExamples, questions, err := acceptLesson([]EnglishCard{card}, map[string]bool{"abandon": true}, draft)
	if err != nil {
		t.Fatal(err)
	}
	if len(gotExamples["abandon"]) != 10 || len(questions) != 2 {
		t.Fatalf("examples %d questions %d", len(gotExamples["abandon"]), len(questions))
	}
	if questions[1].Chinese != "她决定放弃这个计划。" {
		t.Fatalf("chinese = %q", questions[1].Chinese)
	}
}

func TestAcceptLessonRejectsATemplateGap(t *testing.T) {
	card := EnglishCard{ID: "1", Word: "abandon", Meaning: "放弃"}
	draft := lessonDraft{Questions: []LessonQuestion{
		{Kind: "meaning", Prompt: "abandon", Answer: "离开", Choices: []string{"离开", "离开", "离开", "离开"}, Why: "no", Chinese: "离开"},
	}}
	if _, _, err := acceptLesson([]EnglishCard{card}, map[string]bool{"abandon": true}, draft); err == nil {
		t.Fatal("expected a rejection when the meaning was changed and sentences were missing")
	}
}
