package desk

import (
	"encoding/json"
	"testing"
)

func TestCleanPronunciationKeepsIPA(t *testing.T) {
	cases := map[string]string{
		"/əˈbæn.dən/":           "/əˈbæn.dən/",
		"əˈbæn.dən":             "/əˈbæn.dən/",
		"/əˈbæn.dən/ (British)": "/əˈbæn.dən/",
		"/wɒn(t)s/":             "/wɒn(t)s/",
		"/əˈbæn.dn̩/":           "/əˈbæn.dn̩/",
		"/hens/":                "/hens/",
		"/abandon/":             "/abandon/",
		"not a pronunciation":   "",
		"":                      "",
	}
	for in, want := range cases {
		if got := cleanPronunciation(in); got != want {
			t.Errorf("clean %q = %q, want %q", in, got, want)
		}
	}
}

func TestAcceptPronunciationsKeepsTheLessonWords(t *testing.T) {
	cards := []EnglishCard{
		{Word: "abandon", Meaning: "放弃"},
		{Word: "accurate", Meaning: "准确的"},
		{Word: "hence", Meaning: "因此"},
	}
	var draft pronunciationDraft
	raw := []byte(`{"words":[{"word":"Abandon","pronunciation":"/əˈbæn.dən/"},{"word":"accurate","pronunciation":"/accurate/"},{"word":"hence","pronunciation":"/hens/"},{"word":"other","pronunciation":"/ˈʌð.ə/"}]}`)
	if err := json.Unmarshal(raw, &draft); err != nil {
		t.Fatal(err)
	}
	got := acceptPronunciations(cards, draft)
	if got["abandon"] != "/əˈbæn.dən/" {
		t.Fatalf("abandon = %q", got["abandon"])
	}
	if _, ok := got["accurate"]; ok {
		t.Fatal("spelling wrapped in slashes should be dropped")
	}
	if got["hence"] != "/hens/" {
		t.Fatalf("hence = %q", got["hence"])
	}
	if _, ok := got["other"]; ok {
		t.Fatal("a word outside the batch should be dropped")
	}
}
