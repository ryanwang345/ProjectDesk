package desk

import "testing"

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
