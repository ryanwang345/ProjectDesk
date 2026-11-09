# Reading practice library

The library contains original, unofficial practice material. Scores are estimates,
not certified IELTS results. The new papers use hypothetical case studies and
invented organisations; they do not reproduce official test passages.

The format follows the published [Academic Reading format](https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-reading)
and [General Training Reading format](https://ielts.org/take-a-test/test-types/ielts-general-training-test/ielts-general-training-format-reading),
checked on 8 November 2026: 60 minutes, three parts and 40 questions. The new
Academic paper has 2,309 words, within the published 2,150–2,750 range; the new
General Training paper has 2,303 words, within its 2,150–2,375 range.

## New material

| Paper | Parts | Questions |
| --- | --- | --- |
| Academic Test 2 | Seed banks; underwater sound; the repair economy | 40 |
| General Training Test 2 | Community notices; staff handbook; walking maps | 40 |

Each part is also available as a 20-minute individual practice set. Each paper
provides separate True/False/Not Given, matching headings and summary completion
drills. Those practice sets reuse the paper's questions and are not additional
unseen questions. In total, the update adds two full papers, six passage sets and
six question-type drills, bringing the library to 22 entries.

New content lives in `server/internal/desk/reading_content/*.json` and is embedded
in the API binary. `expandedReadingTests` derives passage sets and drills, with
instructions renumbered to match their answer sheets. Seed loading runs when the
API starts; restart or rebuild the API to load changes into an existing database.
Existing paper slugs remain unchanged.

## Exam behaviour

- Instructions appear before a timed attempt starts.
- The server calculates elapsed exam time from the start timestamp. Navigating
  away, backgrounding the tab and reloading do not pause the clock.
- The browser remembers the current attempt and restores saved answers on reload.
  Returning to the dashboard saves first and provides a resume button.
- Active exams hide vocabulary assistance and immediate answer checking. Answer
  keys and explanations remain redacted until submission.
- Manual submission reviews unanswered and flagged questions. At expiry, answers
  are locked and automatic submission retries after network failures.
- A three-second transport allowance accepts the final in-flight submission;
  reconnecting later grades saved answers. Submitted answers cannot be overwritten
  by an autosave racing with submission.
- Practice mode retains its pause and immediate feedback controls.

## Verification

From `server`, run `go test -mod=vendor ./...`. The library checks cover actual word
counts, question numbering, passage references, unique IDs, exact evidence quotes,
extractive answers, answer options and perfect/blank grading. Clock checks cover
time away, final submission, late reconnection and submitted-answer protection.

From `e2e`, run the reading spec against a local app:

```sh
E2E_BASE_URL=http://127.0.0.1:47311 npx cypress run --spec cypress/e2e/reading.cy.ts
```

The spec exercises library navigation, practice feedback, mobile layout, exam
instructions, assistance restrictions, answer review, reload recovery, automatic
submission and recovery from a failed submission.
