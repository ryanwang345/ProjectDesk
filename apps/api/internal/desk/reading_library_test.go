package desk

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

func TestExpandedReadingPapersHaveExamLengthAndGroundedQuestions(t *testing.T) {
	fullCount := 0
	for _, paper := range expandedReadingTests() {
		t.Run(paper.Slug, func(t *testing.T) {
			if err := validateSeedTest(paper); err != nil {
				t.Fatal(err)
			}
			passages := map[string]ReadingPassage{}
			totalWords := 0
			for _, p := range paper.Passages {
				passages[p.ID] = p
				words := 0
				for _, para := range p.Paragraphs {
					words += len(strings.Fields(para.Text))
				}
				if words != p.WordCount {
					t.Errorf("%s: reported %d words, actual %d", p.ID, p.WordCount, words)
				}
				totalWords += words
			}
			if paper.QuestionCount != len(paper.Questions) {
				t.Fatal("question count does not match the answer sheet")
			}
			if paper.Category == "full" {
				fullCount++
				upper := 2750
				if paper.Module == "general" {
					upper = 2375
				}
				if totalWords < 2150 || totalWords > upper || paper.DurationSeconds != 3600 || len(paper.Passages) != 3 || len(paper.Questions) != 40 {
					t.Fatalf("invalid exam format: %d words, %d seconds, %d parts, %d questions", totalWords, paper.DurationSeconds, len(paper.Passages), len(paper.Questions))
				}
			}
			ids := map[string]bool{}
			answers := map[string]string{}
			for _, q := range paper.Questions {
				if ids[q.ID] {
					t.Fatalf("duplicate question ID %s", q.ID)
				}
				ids[q.ID] = true
				answers[q.ID] = q.CorrectAnswer
				p, ok := passages[q.PassageID]
				if !ok {
					t.Fatalf("question %d refers to an absent passage", q.Number)
				}
				var evidence string
				for _, para := range p.Paragraphs {
					if para.Label == q.EvidenceParagraph {
						evidence = para.Text
					}
				}
				if q.EvidenceQuote == "" || !strings.Contains(evidence, q.EvidenceQuote) || q.Explanation == "" {
					t.Fatalf("question %d needs an exact evidence quote and explanation", q.Number)
				}
				if q.WordLimit > 0 && !strings.Contains(strings.ToLower(evidence), strings.ToLower(q.CorrectAnswer)) {
					t.Errorf("extractive answer %q not found in question %d evidence paragraph", q.CorrectAnswer, q.Number)
				}
				if len(q.Options) > 0 {
					found := false
					for _, option := range q.Options {
						code, _, _ := strings.Cut(option, ".")
						found = found || strings.EqualFold(code, q.CorrectAnswer)
					}
					if !found {
						t.Errorf("question %d has no option for key %q", q.Number, q.CorrectAnswer)
					}
				}
			}
			perfect := ScoreReadingSession(paper, answers, 1800)
			if perfect.Score != len(paper.Questions) || perfect.Accuracy != 100 {
				t.Fatal("full answer key did not score 100%")
			}
			if blank := ScoreReadingSession(paper, nil, 1800); blank.Score != 0 {
				t.Fatal("unanswered questions received credit")
			}
		})
	}
	if fullCount != 2 {
		t.Fatalf("expected two new full papers, got %d", fullCount)
	}
}

func TestReadingLibrarySlugsAreUniqueAndDrillNumbersAreAccurate(t *testing.T) {
	slugs := map[string]bool{}
	for _, paper := range builtinReadingTests() {
		if slugs[paper.Slug] {
			t.Fatalf("duplicate slug %s", paper.Slug)
		}
		slugs[paper.Slug] = true
	}
	for _, paper := range expandedReadingTests() {
		if paper.Category == "full" {
			continue
		}
		for start := 0; start < len(paper.Questions); {
			end := start + 1
			for end < len(paper.Questions) && paper.Questions[end].GroupInstruction == paper.Questions[start].GroupInstruction {
				end++
			}
			prefix := fmt.Sprintf("Questions %d–%d: ", start+1, end)
			if !strings.HasPrefix(paper.Questions[start].GroupInstruction, prefix) {
				t.Errorf("%s: expected instruction prefix %s", paper.Slug, prefix)
			}
			start = end
		}
	}
}

func TestExamClockAndDeadlinePreserveSavedWork(t *testing.T) {
	start := time.Date(2026, 11, 8, 10, 0, 0, 0, time.UTC)
	session := ReadingSession{
		Mode: "exam", Status: "active", StartedAt: start, DurationSeconds: 3600,
		Answers: map[string]string{"q1": "TRUE"},
	}
	if elapsed := readingElapsedSeconds(session, start.Add(20*time.Minute)); elapsed != 1200 {
		t.Fatalf("time away must count: got %d seconds", elapsed)
	}
	patch := ReadingSessionPatch{ElapsedSeconds: 1, Answers: map[string]string{"q1": "FALSE"}}
	current := applyReadingSessionPatch(session, patch, start.Add(30*time.Minute))
	if current.ElapsedSeconds != 1800 || current.Answers["q1"] != "FALSE" {
		t.Fatal("an active exam should use server time and accept in-time answers")
	}
	final := applyReadingSessionPatch(session, patch, start.Add(3601*time.Second))
	if final.Answers["q1"] != "FALSE" || final.ElapsedSeconds != 3600 {
		t.Fatal("the final in-flight submission should be accepted with capped time")
	}
	expired := applyReadingSessionPatch(session, patch, start.Add(2*time.Hour))
	if expired.ElapsedSeconds != 3600 || expired.Answers["q1"] != "TRUE" {
		t.Fatal("an expired reconnect must preserve saved answers and cap time")
	}
	session.Status = "submitted"
	session.ElapsedSeconds = 1234
	locked := applyReadingSessionPatch(session, patch, start.Add(time.Hour))
	if locked.Answers["q1"] != "TRUE" || locked.ElapsedSeconds != 1234 {
		t.Fatal("submitted attempts must keep their answers and elapsed time")
	}
	session.Status, session.Mode = "active", "practice"
	practice := applyReadingSessionPatch(session, ReadingSessionPatch{ElapsedSeconds: 1300}, start.Add(2*time.Hour))
	if practice.ElapsedSeconds != 1300 {
		t.Fatal("practice time must still support pausing")
	}
}
