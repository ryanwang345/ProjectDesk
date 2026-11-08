package desk

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestParseDictionaryNotesKeepsSeveralSenses(t *testing.T) {
	body := []byte(`[{"word":"approach","meanings":[
		{"partOfSpeech":"noun","definitions":[{"definition":"A way of dealing with something."},{"definition":"The act of coming closer."}]},
		{"partOfSpeech":"verb","definitions":[{"definition":"To come near or nearer to."}]}
	]}]`)
	got := parseDictionaryNotes(body)
	for _, piece := range []string{"noun: A way of dealing with something.", "noun: The act of coming closer.", "verb: To come near or nearer to."} {
		if !strings.Contains(got, piece) {
			t.Fatalf("notes missing %q\n%s", piece, got)
		}
	}
}

func TestAcceptSensesRewritesIntoPartsOfSpeech(t *testing.T) {
	cards := []EnglishCard{{Word: "approach", Meaning: "方法"}}
	var draft senseDraft
	raw := []byte(`{"words":[{"word":"Approach","senses":[
		{"pos":"noun","en":"a way of dealing with a problem","zh":"方法"},
		{"pos":"Verb","en":"to move closer to a place","zh":"靠近"},
		{"pos":"mystery","en":"not a real class","zh":"未知"},
		{"pos":"noun","en":"same meaning again","zh":"方法"}
	]}]}`)
	if err := json.Unmarshal(raw, &draft); err != nil {
		t.Fatal(err)
	}
	got := acceptSenses(cards, draft)["approach"]
	if len(got) != 2 {
		t.Fatalf("got %#v", got)
	}
	if got[0].Pos != "noun" || got[1].Pos != "verb" {
		t.Fatalf("parts = %s %s", got[0].Pos, got[1].Pos)
	}
}
