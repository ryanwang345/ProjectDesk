package desk

import (
	"strings"
	"testing"
)

func TestParseRSSItemsAndClassify(t *testing.T) {
	sampleXML := `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>CityNews Toronto</title>
    <item>
      <title>Major collision on Highway 401 causes eastbound commuter delays</title>
      <link>https://toronto.citynews.ca/2026/11/13/401-collision/</link>
      <description><![CDATA[<p>Emergency crews are responding to a multi-vehicle collision on Highway 401 near Yonge Street during the morning commute.</p>]]></description>
      <pubDate>Fri, 13 Nov 2026 12:00:00 +0000</pubDate>
      <category>Traffic</category>
    </item>
    <item>
      <title>Bank of Canada signals steady interest rate amid cooling inflation</title>
      <link>https://toronto.citynews.ca/2026/11/13/boc-rate/</link>
      <description><![CDATA[<p>Economists say the benchmark rate will hold steady as inflation eases across Canadian markets.</p>]]></description>
      <pubDate>Fri, 13 Nov 2026 12:30:00 +0000</pubDate>
      <category>Business</category>
    </item>
  </channel>
</rss>`

	items := parseRSSItems([]byte(sampleXML), feedSpec{
		url:         "https://toronto.citynews.ca/feed/",
		source:      "CityNews 680 Toronto",
		defaultSlot: "Top Headlines",
	})
	if len(items) != 2 {
		t.Fatalf("expected 2 RSS items, got %d", len(items))
	}
	if items[0].Category != "Traffic & Weather" {
		t.Fatalf("expected Traffic & Weather category, got %q", items[0].Category)
	}
	if items[1].Category != "Business News" {
		t.Fatalf("expected Business News category, got %q", items[1].Category)
	}
}

func TestExtractRadioLexisAndLiaisonsFromLiveText(t *testing.T) {
	svc := newRadioNewsService()
	liveText := "Emergency crews are responding to a multi-vehicle collision on the commuter corridor. Provincial authorities announced new infrastructure legislation to curb inflation."
	fallback := defaultRadioSegments()[0].KeyLexis

	lexis := svc.extractRadioLexis(liveText, fallback)
	if len(lexis) < 4 {
		t.Fatalf("expected at least 4 lexis items, got %d", len(lexis))
	}

	foundCollision := false
	for _, item := range lexis {
		if strings.EqualFold(item.Word, "collision") {
			foundCollision = true
			if !strings.Contains(strings.ToLower(item.ContextSnippet), "collision") {
				t.Fatalf("expected context snippet to contain matched word, got %q", item.ContextSnippet)
			}
		}
	}
	if !foundCollision {
		t.Fatalf("expected 'collision' to be extracted from live text")
	}

	liaisons := extractRadioLiaisons(liveText, defaultRadioSegments()[0].Liaisons)
	if len(liaisons) < 2 {
		t.Fatalf("expected at least 2 liaisons, got %d", len(liaisons))
	}
}
