package ai

import (
	"context"
	"encoding/json"
	"regexp"
	"strings"
)

// demo answers offline with deterministic JSON so the workflow can be
// exercised without credentials. Every response is marked Simulated and the
// UI labels anything produced by it. It never claims to have inspected code.
type demo struct {
	cfg Config
}

func newDemo(cfg Config) *demo { return &demo{cfg: cfg} }

func (p *demo) Kind() Kind { return KindDemo }

func (p *demo) Capabilities() Capabilities {
	return Capabilities{JSONMode: true, Streaming: false, Tools: false, Simulated: true}
}

func (p *demo) Models(context.Context) ([]Model, error) {
	return []Model{{ID: "demo-deterministic"}}, nil
}

var taskPattern = regexp.MustCompile(`(?m)^task:\s*([a-z_]+)`)

func (p *demo) Generate(_ context.Context, req Request) (Response, error) {
	task := ""
	signal := ""
	for _, m := range req.Messages {
		if match := taskPattern.FindStringSubmatch(m.Content); match != nil && task == "" {
			task = match[1]
		}
		if i := strings.Index(m.Content, "<signal>"); i >= 0 {
			rest := m.Content[i+len("<signal>"):]
			if j := strings.Index(rest, "</signal>"); j >= 0 {
				signal = strings.TrimSpace(rest[:j])
			}
		}
	}
	if signal == "" {
		signal = "the reported problem"
	}
	short := signal
	if len(short) > 90 {
		short = short[:90] + "…"
	}

	var body any
	switch task {
	case "analyze":
		body = map[string]any{
			"summary": "Simulated analysis of: " + short,
			"hypotheses": []map[string]any{
				{"cause": "A stylesheet or component rule that exists in one environment is missing in the other.", "evidence": "none; inferred from the report only", "confidence": 0.5},
				{"cause": "Build or dependency versions differ between the environments.", "evidence": "none; inferred from the report only", "confidence": 0.3},
			},
			"missingInformation": []string{
				"Which commit is deployed to each environment",
				"Browser console output from the affected environment",
				"Whether the issue reproduces in a fresh session",
			},
			"proposedScore":  68,
			"scoreRationale": "Visible to every user of the affected screen, but no data loss. Simulated estimate.",
			"opportunity":    map[string]any{"title": "Make the affected UI consistent across environments", "outcome": "The element renders the same in staging and production."},
			"acceptanceCriteria": []string{
				"The element renders with the intended styles in both environments",
				"A regression test covers the element's styling",
				"The root cause is documented in the cycle",
			},
		}
	case "specification":
		body = map[string]any{
			"problem":                   "Simulated specification for: " + short,
			"solution":                  "Align the implementation so the behavior is identical in all environments.",
			"functionalRequirements":    []string{"The element renders the same in every environment", "Existing behavior is unchanged"},
			"nonFunctionalRequirements": []string{"No measurable change to page load time"},
			"acceptanceCriteria":        []string{"A regression test exists and passes", "Manual check in staging and production matches"},
			"risks":                     []string{"The fix may depend on an environment setting outside the repository"},
			"affectedComponents":        []string{"Frontend styling", "Build configuration"},
		}
	case "plan":
		body = map[string]any{
			"approach":        "Simulated plan: locate the styling difference, correct the source of truth, add a regression test.",
			"affectedFiles":   []string{"styles.css", "index.html"},
			"changes":         []string{"Apply the shared button class to the affected element", "Add a test that asserts the class is present"},
			"dependencies":    []string{},
			"testingStrategy": "Run the sample repository's test command inside the sandbox runner.",
			"deployment":      "Standard pipeline; no migration.",
			"tasks": []map[string]any{
				{"title": "Restore the button class", "detail": "Add class=\"btn\" to the search button in index.html."},
				{"title": "Add regression test", "detail": "Assert the search button carries the btn class."},
			},
		}
	case "patch":
		body = map[string]any{
			"summary": "Simulated patch: add the missing button class.",
			"diff":    "--- a/index.html\n+++ b/index.html\n@@ -8,7 +8,7 @@\n   <body>\n     <header>\n       <h1>Sample Shop</h1>\n-      <button id=\"search\">Search</button>\n+      <button id=\"search\" class=\"btn\">Search</button>\n     </header>\n     <main>\n       <p>Search the catalog.</p>\n",
		}
	case "repair":
		body = map[string]any{
			"category":    "unknown",
			"explanation": "Simulated: the runner reported a failure. No repair is proposed without evidence.",
			"repairDiff":  "",
		}
	case "outcome":
		body = map[string]any{
			"solved":      "unknown",
			"regressions": "unknown",
			"evidence":    []string{"Simulated: no production metrics were connected"},
			"lessons":     []string{"Connect monitoring so the next cycle can be judged from evidence."},
			"followUp":    map[string]any{"needed": false, "title": "", "signal": "", "priority": 0},
		}
	default:
		body = map[string]any{"text": "Simulated reply."}
	}
	raw, _ := json.Marshal(body)
	return Response{Text: string(raw), Model: "demo-deterministic", Simulated: true, Usage: Usage{}}, nil
}
