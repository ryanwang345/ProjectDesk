package desk

import (
	"embed"
	"encoding/json"
	"fmt"
	"strings"
)

// These are original practice papers, not reproduced official IELTS papers.
//
//go:embed reading_content/*.json
var readingLibrary embed.FS

func expandedReadingTests() []ReadingTest {
	entries, err := readingLibrary.ReadDir("reading_content")
	if err != nil {
		panic(err)
	}
	var tests []ReadingTest
	for _, entry := range entries {
		data, err := readingLibrary.ReadFile("reading_content/" + entry.Name())
		if err != nil {
			panic(err)
		}
		var full ReadingTest
		if err := json.Unmarshal(data, &full); err != nil {
			panic(fmt.Sprintf("reading library %s: %v", entry.Name(), err))
		}
		tests = append(tests, full)
		for _, passage := range full.Passages {
			var questions []ReadingQuestion
			for _, q := range full.Questions {
				if q.PassageID == passage.ID {
					questions = append(questions, q)
				}
			}
			practice := full
			practice.Slug = fmt.Sprintf("%s-passage-%d", full.Slug, passage.Index)
			practice.Title = passage.Title
			practice.Subtitle = "Original passage practice · " + full.Module + " · 20 minutes"
			practice.Category = "passage"
			practice.DurationSeconds = 1200
			practice.Passages = []ReadingPassage{passage}
			practice.Passages[0].Index = 1
			practice.Questions = reframeReadingQuestions(questions)
			practice.QuestionCount = len(practice.Questions)
			practice.Passages[0].Subtitle = fmt.Sprintf("Questions 1–%d · Spend about 20 minutes on this part.", practice.QuestionCount)
			tests = append(tests, practice)
		}
		// Fresh, focused sets use the new material rather than recycling Test 1.
		for _, kind := range []string{QTrueFalseNotGiven, QMatchingHeadings, QSummaryCompletion} {
			var questions []ReadingQuestion
			used := map[string]bool{}
			for _, q := range full.Questions {
				if q.Type == kind {
					questions = append(questions, q)
					used[q.PassageID] = true
				}
			}
			if len(questions) == 0 {
				continue
			}
			drill := full
			drill.Slug = full.Slug + "-drill-" + kind
			drill.Title = "Targeted practice: " + strings.ReplaceAll(kind, "_", " ")
			drill.Subtitle = full.Title
			drill.Category = "question_type"
			drill.DurationSeconds = len(questions) * 90
			drill.Passages = nil
			for _, passage := range full.Passages {
				if used[passage.ID] {
					passage.Index = len(drill.Passages) + 1
					passage.Subtitle = "Use this passage to answer the practice questions."
					drill.Passages = append(drill.Passages, passage)
				}
			}
			drill.Questions = reframeReadingQuestions(questions)
			drill.QuestionCount = len(drill.Questions)
			tests = append(tests, drill)
		}
	}
	return tests
}

// Keep group instructions in sync with question numbers in derived practice sets.
func reframeReadingQuestions(questions []ReadingQuestion) []ReadingQuestion {
	out := renumberQuestions(questions)
	for start := 0; start < len(out); {
		end := start + 1
		for end < len(out) && questions[end].GroupInstruction == questions[start].GroupInstruction {
			end++
		}
		_, instruction, found := strings.Cut(questions[start].GroupInstruction, ": ")
		if !found {
			instruction = questions[start].GroupInstruction
		}
		for i := start; i < end; i++ {
			out[i].GroupInstruction = fmt.Sprintf("Questions %d–%d: %s", start+1, end, instruction)
		}
		start = end
	}
	return out
}
