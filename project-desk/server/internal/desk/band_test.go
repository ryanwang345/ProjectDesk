package desk

import (
	"encoding/json"
	"testing"
)

func TestAcceptBandKeepsPreciseUse(t *testing.T) {
	cards := []EnglishCard{{Word: "factor", Meaning: "因素"}}
	var draft bandDraft
	raw := []byte(`{"words":[{"word":"Factor","band":{
		"collocations":["a key factor","factor in the decision","contributing factor","deciding factor","not a phrase"],
		"writing":"Cost is a key factor in whether families choose the train.",
		"speaking":"Price is a real factor when students pick a course.",
		"examples":[
			"Housing affordability has become a deciding factor for young families.",
			"Several environmental factors contributed to the decline in crop yields.",
			"Cost is a key factor in whether families choose the train.",
			"Without the headword this line is skipped."
		],
		"weak":"It is a very factor thing in life today.",
		"fix":"Use factor inside a noun phrase.",
		"paraphrases":["cause","factor","influence","determinant"],
		"zh":"放进名词短语，不要只写 very important。"
	}}]}`)
	if err := json.Unmarshal(raw, &draft); err != nil {
		t.Fatal(err)
	}
	got := acceptBand(cards, draft)["factor"]
	if !got.ready() {
		t.Fatalf("note = %#v", got)
	}
	if len(got.Collocations) != 4 {
		t.Fatalf("collocations = %#v", got.Collocations)
	}
	if len(got.Examples) != 2 {
		t.Fatalf("examples = %#v", got.Examples)
	}
	if len(got.Paraphrases) != 3 || got.Paraphrases[0] != "cause" {
		t.Fatalf("paraphrases = %#v", got.Paraphrases)
	}
}
