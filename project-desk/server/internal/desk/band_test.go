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
		"writingZh":"费用是家庭是否选择火车出行的关键因素。",
		"speaking":"Price is a real factor when students pick a course.",
		"speakingZh":"学生在选课时，价格是一个很实际的考量因素。",
		"examples":[
			"Housing affordability has become a deciding factor for young families.",
			"Several environmental factors contributed to the decline in crop yields.",
			"Cost is a key factor in whether families choose the train.",
			"Without the headword this line is skipped."
		],
		"examplesZh":[
			"住房负担能力已成为年轻家庭的决定性因素。",
			"多种环境因素导致了农作物产量的下降。",
			"费用是家庭是否选择火车出行的关键因素。",
			"没有关键词的句子会被跳过。"
		],
		"weak":"It is a very factor thing in life today.",
		"fix":"Use factor inside a noun phrase.",
		"fixZh":"将 factor 放在名词短语中使用。",
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
	if len(got.Examples) != 2 || len(got.ExamplesZh) != 2 {
		t.Fatalf("examples = %#v, zh = %#v", got.Examples, got.ExamplesZh)
	}
	if len(got.Paraphrases) != 3 || got.Paraphrases[0] != "cause" {
		t.Fatalf("paraphrases = %#v", got.Paraphrases)
	}
}
