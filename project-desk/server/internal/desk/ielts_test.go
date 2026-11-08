package desk

import "testing"

func TestFullVocabularyIsInTheIeltsRange(t *testing.T) {
	extra, err := extraVocab()
	if err != nil {
		t.Fatal(err)
	}
	total := len(ieltsEntries) + len(extra)
	if total < 4500 || total > 5000 {
		t.Fatalf("vocabulary should be between 4500 and 5000 headwords, got %d", total)
	}
	for _, entry := range extra {
		examples, err := variedExamples(entry.Word, entry.Kind)
		if err != nil {
			t.Fatal(err)
		}
		input := EnglishInput{Word: entry.Word, Meaning: entry.Meaning, Examples: examples}
		if err := ValidateEnglish(NormalizeEnglish(input)); err != nil {
			t.Fatalf("%s: %v", entry.Word, err)
		}
	}
}

func TestIeltsListHasTenUsableSentences(t *testing.T) {
	if len(ieltsEntries) != 570 {
		t.Fatalf("IELTS academic list should have 570 headwords, got %d", len(ieltsEntries))
	}
	seen := map[string]bool{}
	for _, entry := range ieltsEntries {
		if seen[entry.Word] {
			t.Fatalf("duplicate word %s", entry.Word)
		}
		seen[entry.Word] = true
		examples, err := ieltsExamples(entry.Word, entry.Kind)
		if err != nil {
			t.Fatal(err)
		}
		input := EnglishInput{Word: entry.Word, Meaning: entry.Meaning, Examples: examples}
		if err := ValidateEnglish(NormalizeEnglish(input)); err != nil {
			t.Fatalf("%s: %v", entry.Word, err)
		}
	}
}
