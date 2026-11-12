package desk

import (
	"errors"
	"testing"
)

func TestValidate(t *testing.T) {
	if err := Validate(Input{Name: "Night bus", Note: "Last chair.", Status: "sketch"}); err != nil {
		t.Fatal(err)
	}
	if err := Validate(Input{Name: "   ", Note: "", Status: "sketch"}); !errors.Is(err, ErrInvalid) {
		t.Fatalf("blank name should be invalid, got %v", err)
	}
	if err := Validate(Input{Name: "Trail", Note: "", Status: "later"}); !errors.Is(err, ErrInvalid) {
		t.Fatalf("bad status should be invalid, got %v", err)
	}
}
