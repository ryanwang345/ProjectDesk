package desk

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestWorldVocabularyHasOriginalCompleteEntries(t *testing.T) {
	entries, err := worldVocabulary()
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 60 {
		t.Fatalf("want 60 new world-topic words, got %d", len(entries))
	}
	seen := map[string]bool{}
	for _, entry := range ieltsEntries {
		seen[strings.ToLower(entry.Word)] = true
	}
	extra, err := extraVocab()
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range extra {
		seen[strings.ToLower(entry.Word)] = true
	}
	for _, entry := range entries {
		if seen[entry.Word] {
			t.Fatalf("%s already exists in the library", entry.Word)
		}
		seen[entry.Word] = true
		frames := getBuiltinTemplateFrames()
		examples := map[string]bool{}
		for _, sentence := range entry.Examples {
			if examples[strings.ToLower(sentence)] {
				t.Fatalf("%s repeats an example", entry.Word)
			}
			examples[strings.ToLower(sentence)] = true
			frame := strings.ReplaceAll(strings.ToLower(sentence), entry.Word, "___")
			if frames[frame] {
				t.Fatalf("%s uses a generic template rather than a contextual example", entry.Word)
			}
		}
	}
	if len(seen) != 10611 {
		t.Fatalf("want 10611 unique seed headwords, got %d", len(seen))
	}
}

func TestWorldVocabularyPersistsWithoutOverwritingExistingCards(t *testing.T) {
	store := learningTestStore(t, false)
	ctx := context.Background()
	existing, err := store.ListEnglish(ctx)
	if err != nil {
		t.Fatal(err)
	}
	wantWords := map[string]bool{}
	for _, card := range existing {
		wantWords[strings.ToLower(card.Word)] = true
	}
	for _, entry := range ieltsEntries {
		wantWords[strings.ToLower(entry.Word)] = true
	}
	extra, _ := extraVocab()
	for _, entry := range extra {
		wantWords[strings.ToLower(entry.Word)] = true
	}
	entries, _ := worldVocabulary()
	for _, entry := range entries {
		wantWords[entry.Word] = true
	}
	if err := store.seedIelts(ctx); err != nil {
		t.Fatal(err)
	}
	cards, err := store.ListEnglish(ctx)
	if err != nil || len(cards) != len(wantWords) {
		t.Fatalf("wrong persisted vocabulary count: %d, %v", len(cards), err)
	}
	var original EnglishCard
	for _, card := range cards {
		if card.Word == "aquifer" {
			original = card
		}
	}
	if original.ID == "" || len(original.Examples) != ExampleCount || len(original.Senses) != 1 || original.Senses[0].En == "" || original.InReview {
		t.Fatalf("new card is incomplete or already marked for review: %+v", original)
	}
	if _, err := store.SetEnglishReview(ctx, original.ID, true); err != nil {
		t.Fatal(err)
	}
	if _, err := store.pool.Exec(ctx, `UPDATE english_cards SET meaning='用户自己的释义' WHERE id=$1`, original.ID); err != nil {
		t.Fatal(err)
	}
	if err := store.seedIelts(ctx); err != nil {
		t.Fatal(err)
	}
	cards, err = store.ListEnglish(ctx)
	if err != nil || len(cards) != len(wantWords) {
		t.Fatal("repeat seed duplicated cards or returned a stale library:", len(cards), err)
	}
	for _, card := range cards {
		if card.Word != "aquifer" {
			continue
		}
		if card.ID != original.ID || card.Meaning != "用户自己的释义" || !card.InReview {
			t.Fatal("repeat seed replaced the learner's card or review state")
		}
	}
	for _, entry := range entries {
		var examples, senses []byte
		if err := store.pool.QueryRow(ctx, `SELECT to_jsonb(examples),senses FROM english_cards WHERE word=$1`, entry.Word).Scan(&examples, &senses); err != nil {
			t.Fatal(err)
		}
		var savedExamples []string
		var savedSenses WordSenses
		if err := json.Unmarshal(examples, &savedExamples); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(senses, &savedSenses); err != nil {
			t.Fatal(err)
		}
		if len(savedExamples) != 10 || len(savedSenses) != 1 || savedSenses[0].En != entry.Definition {
			t.Fatalf("saved content differs for %s", entry.Word)
		}
	}
	progress, err := store.GetLearningProgress(ctx, "UTC")
	if err != nil || progress.XP != 0 || progress.Streak != 0 {
		t.Fatal("adding vocabulary fabricated learning progress:", progress, err)
	}
}
