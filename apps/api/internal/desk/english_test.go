package desk

import (
	"errors"
	"fmt"
	"testing"
)

func tenExamples(word string) []string {
	examples := make([]string, ExampleCount)
	for i := range examples {
		examples[i] = fmt.Sprintf("Sentence %d uses %s in a full line.", i+1, word)
	}
	return examples
}

func TestValidateEnglishRequiresTenSentences(t *testing.T) {
	ok := EnglishInput{Word: "order", Meaning: "点单", Examples: tenExamples("order")}
	if err := ValidateEnglish(NormalizeEnglish(ok)); err != nil {
		t.Fatal(err)
	}

	short := ok
	short.Examples = ok.Examples[:9]
	if err := ValidateEnglish(NormalizeEnglish(short)); !errors.Is(err, ErrInvalid) {
		t.Fatalf("nine examples should be invalid, got %v", err)
	}

	missing := ok
	missing.Examples = append([]string(nil), ok.Examples...)
	missing.Examples[3] = "This line never mentions the word."
	if err := ValidateEnglish(NormalizeEnglish(missing)); !errors.Is(err, ErrInvalid) {
		t.Fatalf("example without the word should be invalid, got %v", err)
	}
}
