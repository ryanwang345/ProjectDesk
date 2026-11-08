package desk

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

type ieltsEntry struct {
	Word    string
	Meaning string
	Kind    string
}

var ieltsFramesV1 = map[string][]string{
	"n": {
		"The lecture explains %s in simple language.",
		"This paragraph is about %s.",
		"Students wrote a short note on %s.",
		"The chart is related to %s.",
		"Her essay returns to %s in the conclusion.",
		"The tutor asked a question about %s.",
		"You can find %s in the reading passage.",
		"The report gives an example of %s.",
		"People in the survey talked about %s.",
		"Understanding %s helps in the IELTS reading test.",
	},
	"v": {
		"Students learn to %s when they read academic texts.",
		"The class practised how to %s during the seminar.",
		"Researchers need to %s before they publish.",
		"It is useful to %s in this kind of study.",
		"The lecturer showed the group how to %s.",
		"A careful writer will %s when the evidence is clear.",
		"They decided to %s after reading the report.",
		"Experts know when to %s and when to wait.",
		"The task asks you to %s and then explain your choice.",
		"In the exam, you may have to %s under time pressure.",
	},
	"vi": {
		"This pattern can %s over a long period.",
		"The same result may %s in another study.",
		"Small changes %s when the rules are new.",
		"The effect will %s if funding stops.",
		"Similar problems %s in many cities.",
		"A new trend can %s without warning.",
		"These events %s more often in winter.",
		"Growth may %s after a strong year.",
		"The difference can %s from year to year.",
		"Nothing will %s if the plan stays the same.",
	},
	"adj": {
		"The result is %s in this study.",
		"The change looks %s on the chart.",
		"Her answer was %s and well supported.",
		"The problem became %s after the new policy.",
		"Researchers describe the effect as %s.",
		"The evidence seems %s to most readers.",
		"This case is %s for students of English.",
		"The author treats the issue as %s.",
		"The two groups are %s in one important way.",
		"A writer can sound %s without long sentences.",
	},
	"adv": {
		"The numbers changed %s over ten years.",
		"She explained the result %s.",
		"The cost increased %s after the new rule.",
		"Students should read the question %s.",
		"The population grew %s during that period.",
		"He answered %s and then gave an example.",
		"The price fell %s in the final year.",
		"The author states the claim %s.",
		"Attendance rose %s from 2010 to 2020.",
		"The team worked %s and finished the report.",
	},
}

var ieltsFrames = map[string][]string{
	"n": {
		"I looked up %s before the seminar.",
		"The lecture kept coming back to %s.",
		"She wrote %s in the margin so she would remember it.",
		"We argued about %s on the way home.",
		"The article mentions %s in the opening paragraph.",
		"He asked what %s means in ordinary words.",
		"My draft is weak because I skipped %s.",
		"The group spent an hour on %s and still disagreed.",
		"I can give a daily-life example of %s.",
		"If the exam asks about %s, define it first.",
	},
	"v": {
		"She was not sure how to %s.",
		"The instructions tell you to %s.",
		"I stayed late so I could %s.",
		"He paused, then chose to %s.",
		"We practised until we could %s without notes.",
		"The tutor asked whether we should %s.",
		"It is harder than it looks to %s.",
		"They agreed it was time to %s.",
		"You can lose marks if you forget to %s.",
		"Let me %s, and you tell me if it sounds right.",
	},
	"vi": {
		"This kind of change can %s over a few years.",
		"The same thing may %s in another city.",
		"Nothing will %s if we keep the old plan.",
		"Small problems %s when the rules are new.",
		"The effect can %s without any warning.",
		"We watched the numbers %s from one year to the next.",
		"A new habit can %s once people see the benefit.",
		"The gap may %s if funding stops.",
		"These events %s more often in winter.",
		"Researchers want to know why it began to %s.",
	},
	"adj": {
		"The result looks %s once you see the chart.",
		"Her answer sounded %s, and she had the numbers.",
		"The problem became %s after the new rule.",
		"Everyone in the room called the idea %s.",
		"The two groups are %s in one important way.",
		"The evidence seems %s to most readers.",
		"Readers found the tone %s.",
		"The author treats the issue as %s.",
		"On the page, the change is %s.",
		"I would not call that example %s.",
	},
	"adv": {
		"The numbers moved %s over ten years.",
		"She explained the result %s, then gave an example.",
		"Costs rose %s after the new rule.",
		"Read the question %s before you answer.",
		"The city grew %s during those years.",
		"He replied %s and sat down.",
		"Prices fell %s in the last year.",
		"The writer states the claim %s.",
		"Attendance climbed %s from 2010 to 2020.",
		"The team worked %s and still made the deadline.",
	},
}

var ieltsCustom = map[string][]string{
	"consist": {
		"Groups consist of people who share a goal.",
		"A good essay can consist of four clear parts.",
		"The course does consist of listening and reading.",
		"Their diet can consist of rice and vegetables.",
		"The team will consist of six students.",
		"This list can consist of short academic words.",
		"The report may consist of charts and comments.",
		"A week can consist of five study days.",
		"The sample can consist of men and women.",
		"His answer should consist of reasons and examples.",
	},
	"constitute": {
		"Women constitute half of the class.",
		"These facts constitute the main evidence.",
		"Students constitute a large part of the city.",
		"Taxes constitute most of the public income.",
		"Ten schools constitute the local group.",
		"Hard work can constitute a real advantage.",
		"These tasks constitute the final exam.",
		"Oil and gas constitute the main exports.",
		"The members constitute a new committee.",
		"Small firms constitute most of the sector.",
	},
	"despite": {
		"She passed the test despite the difficult reading.",
		"The shop stayed open despite the bad weather.",
		"He kept studying despite a long day at work.",
		"Prices rose despite a fall in demand.",
		"They finished on time despite several problems.",
		"The city grew despite a lack of water.",
		"She spoke calmly despite the hard question.",
		"Sales increased despite the higher price.",
		"He remained kind despite the delay.",
		"The plan worked despite a late start.",
	},
	"hence": {
		"The road was closed, hence the long delay.",
		"Demand rose, hence the higher price.",
		"She studied daily, hence her better score.",
		"The data were incomplete, hence the caution.",
		"Costs fell, hence the larger profit.",
		"The rule changed, hence the new form.",
		"Time was short, hence the brief answer.",
		"The sample was small, hence the warning.",
		"Rain was heavy, hence the cancelled trip.",
		"Evidence was weak, hence the careful claim.",
	},
	"overall": {
		"The overall result was better than last year.",
		"Overall, sales rose during the decade.",
		"The overall cost stayed within the budget.",
		"Overall, students found the lecture clear.",
		"The overall trend points upward.",
		"Overall, the benefits outweigh the costs.",
		"The overall score improved after more practice.",
		"Overall, the two groups gave similar answers.",
		"The overall plan needs one more revision.",
		"Overall, the evidence supports the claim.",
	},
	"prior": {
		"Please read the chapter prior to the seminar.",
		"She had prior experience in a research lab.",
		"Prior knowledge makes the passage easier.",
		"He sent a note prior to the meeting.",
		"They needed prior approval for the trip.",
		"Prior studies reported a similar result.",
		"No one may enter prior to nine o'clock.",
		"She checked prior work before she wrote.",
		"Prior notice is required for a refund.",
		"The chart shows the years prior to 2020.",
	},
	"whereas": {
		"Tea is popular here, whereas coffee is popular there.",
		"The city grew, whereas the town stayed small.",
		"Reading was hard, whereas listening was easier.",
		"Prices rose in May, whereas they fell in June.",
		"One group agreed, whereas the other group refused.",
		"Buses are cheap, whereas taxis are expensive.",
		"Summer is dry, whereas winter is wet.",
		"He likes charts, whereas she likes tables.",
		"The first method is fast, whereas the second is careful.",
		"Demand increased, whereas supply stayed the same.",
	},
	"furthermore": {
		"The price is high. Furthermore, the cup is small.",
		"The data are clear. Furthermore, the sample is large.",
		"She finished early. Furthermore, her answer was correct.",
		"The town is quiet. Furthermore, the rent is low.",
		"He cited a study. Furthermore, he explained the chart.",
		"The rule is new. Furthermore, it applies to every shop.",
		"The course is short. Furthermore, the tutor is helpful.",
		"Sales fell. Furthermore, costs continued to rise.",
		"The road is closed. Furthermore, the bus is late.",
		"The claim is bold. Furthermore, the evidence is thin.",
	},
	"nevertheless": {
		"The test was hard. Nevertheless, she passed.",
		"It was raining. Nevertheless, the shop stayed open.",
		"The data were limited. Nevertheless, the trend was clear.",
		"He was tired. Nevertheless, he finished the essay.",
		"Prices rose. Nevertheless, people kept buying tea.",
		"The sample was small. Nevertheless, the result mattered.",
		"Time was short. Nevertheless, the talk was useful.",
		"The road was icy. Nevertheless, the bus arrived.",
		"Costs increased. Nevertheless, the firm hired more staff.",
		"The question was new. Nevertheless, he answered it.",
	},
	"overseas": {
		"She plans to study overseas next year.",
		"Overseas students often take IELTS.",
		"He found a job overseas after graduation.",
		"The firm sells tea to overseas markets.",
		"Overseas travel can be expensive.",
		"Her brother lives overseas and calls on Sunday.",
		"Overseas experience strengthened her application.",
		"The university welcomes overseas applicants.",
		"They compared local prices with overseas prices.",
		"An overseas degree is one option after school.",
	},
	"underlie": {
		"Several causes underlie the change in price.",
		"Clear rules underlie a fair test.",
		"Different values underlie the two cultures.",
		"One idea can underlie the whole essay.",
		"Economic factors underlie the new policy.",
		"A simple principle can underlie the theory.",
		"Fear can underlie a sudden decision.",
		"Shared goals underlie the team project.",
		"Old habits underlie the current method.",
		"Strong evidence should underlie every claim.",
	},
	"comprise": {
		"The course will comprise reading and writing.",
		"Women comprise half of the staff.",
		"The book will comprise ten short chapters.",
		"Three parts comprise the final report.",
		"The sample can comprise students from two cities.",
		"The plan will comprise cost and time.",
		"These tasks comprise the morning session.",
		"The group can comprise experts and teachers.",
		"The region will comprise five new towns.",
		"The list can comprise words from every level.",
	},
	"plus": {
		"The fee is ten dollars plus tax.",
		"The course teaches reading plus writing.",
		"Two years of work plus a degree are required.",
		"The total is the rent plus the bills.",
		"She bought tea plus a small cake.",
		"The score is accuracy plus speed.",
		"The team needs a writer plus a designer.",
		"Breakfast is included, plus a free drink.",
		"The map shows roads plus the bus stops.",
		"He listed costs plus the likely risks.",
	},
	"thereby": {
		"She checked every figure, thereby avoiding a mistake.",
		"The firm cut costs, thereby raising its profit.",
		"He cited the source, thereby supporting the claim.",
		"They widened the road, thereby reducing the delay.",
		"The class reviewed the chart, thereby finding the trend.",
		"She set a timer, thereby finishing on time.",
		"The city planted trees, thereby cooling the streets.",
		"He asked a question, thereby clarifying the task.",
		"They shared the data, thereby helping other researchers.",
		"The shop lowered the price, thereby attracting more guests.",
	},
	"via": {
		"She sent the file via email.",
		"Goods arrived via the main port.",
		"He applied via the university website.",
		"News spread via social media.",
		"They travelled via Singapore.",
		"The payment went via the bank.",
		"Students registered via an online form.",
		"The message came via her tutor.",
		"Water reached the town via an old canal.",
		"Readers accessed the article via the library.",
	},
	"behalf": {
		"She spoke on behalf of the whole class.",
		"He signed the form on behalf of his partner.",
		"The lawyer acted on behalf of the family.",
		"I am writing on behalf of the research team.",
		"They collected money on behalf of the school.",
		"The guide spoke on behalf of the visitors.",
		"She accepted the prize on behalf of her group.",
		"He asked a question on behalf of the students.",
		"The firm replied on behalf of the client.",
		"We thanked the host on behalf of everyone.",
	},
	"albeit": {
		"The result was useful, albeit limited.",
		"She agreed, albeit with some doubts.",
		"The change was real, albeit slow.",
		"The sample was broad, albeit not perfect.",
		"He smiled, albeit briefly.",
		"The gain was clear, albeit small.",
		"The method works, albeit only in this case.",
		"Prices fell, albeit later than expected.",
		"The talk was short, albeit informative.",
		"The town grew, albeit at a modest pace.",
	},
	"nonetheless": {
		"The chart is simple. Nonetheless, it shows a clear trend.",
		"She was nervous. Nonetheless, she gave the talk.",
		"Funds were low. Nonetheless, the project continued.",
		"The room was noisy. Nonetheless, students kept reading.",
		"Evidence was mixed. Nonetheless, the conclusion stood.",
		"The task was long. Nonetheless, they met the deadline.",
		"Rent was high. Nonetheless, the cafe stayed busy.",
		"He disagreed. Nonetheless, he listened carefully.",
		"The start was slow. Nonetheless, sales recovered.",
		"The rule is strict. Nonetheless, people accept it.",
	},
	"notwithstanding": {
		"Notwithstanding the delay, the class still finished.",
		"The plan succeeded, notwithstanding several objections.",
		"Notwithstanding the cost, the city built the bridge.",
		"She kept the promise, notwithstanding the pressure.",
		"Notwithstanding the rain, the market stayed open.",
		"The result held, notwithstanding a small sample.",
		"Notwithstanding his doubts, he submitted the essay.",
		"Demand grew, notwithstanding the higher fee.",
		"Notwithstanding the risk, they started the project.",
		"The shop expanded, notwithstanding local complaints.",
	},
	"so-called": {
		"The so-called expert had never visited the site.",
		"This so-called solution created a new problem.",
		"The so-called benefit was hard to measure.",
		"A so-called friend shared the data too soon.",
		"The so-called rule applied to only one group.",
		"Their so-called plan was only a short note.",
		"The so-called improvement lasted one week.",
		"A so-called expert panel reviewed the report.",
		"The so-called savings never reached the shop.",
		"This so-called fact needed a better source.",
	},
	"whereby": {
		"They signed a deal whereby both sides share the cost.",
		"This is a system whereby students choose their courses.",
		"There is a rule whereby late work loses marks.",
		"They made a plan whereby each person writes one part.",
		"It is a process whereby raw data become a chart.",
		"The school has a scheme whereby mentors help new students.",
		"This is a method whereby you compare two years.",
		"They agreed a contract whereby rent rises each year.",
		"There is a policy whereby staff work from home on Friday.",
		"It is a route whereby goods reach the city market.",
	},
}

func ieltsExamples(word, kind string) ([]string, error) {
	if kind == "custom" {
		sentences, ok := ieltsCustom[word]
		if !ok || len(sentences) != ExampleCount {
			return nil, fmt.Errorf("missing ten examples for %s", word)
		}
		return append([]string(nil), sentences...), nil
	}
	return fillFrames(ieltsFrames, word, kind)
}

func fillFrames(frames map[string][]string, word, kind string) ([]string, error) {
	lines, ok := frames[kind]
	if !ok || len(lines) != ExampleCount {
		return nil, fmt.Errorf("missing frames for %s (%s)", word, kind)
	}
	out := make([]string, ExampleCount)
	for i, frame := range lines {
		out[i] = fmt.Sprintf(frame, word)
	}
	return out, nil
}

func sameSentences(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func (s *Store) seedIelts(ctx context.Context) error {
	rows, err := s.pool.Query(ctx, `SELECT lower(word) FROM english_cards`)
	if err != nil {
		return err
	}
	defer rows.Close()
	have := map[string]bool{}
	for rows.Next() {
		var word string
		if err := rows.Scan(&word); err != nil {
			return err
		}
		have[word] = true
	}
	if err := rows.Err(); err != nil {
		return err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	extra, err := extraVocab()
	if err != nil {
		return err
	}
	if err := insertVocab(ctx, tx, ieltsEntries, have, false); err != nil {
		return err
	}
	if err := insertVocab(ctx, tx, extra, have, true); err != nil {
		return err
	}
	for _, entry := range ieltsEntries {
		if entry.Kind == "custom" || !have[strings.ToLower(entry.Word)] {
			continue
		}
		previous, err := fillFrames(ieltsFramesV1, entry.Word, entry.Kind)
		if err != nil {
			return err
		}
		fresh, err := ieltsExamples(entry.Word, entry.Kind)
		if err != nil {
			return err
		}
		var current []string
		if err := tx.QueryRow(ctx, `SELECT examples FROM english_cards WHERE lower(word) = $1`, strings.ToLower(entry.Word)).Scan(&current); err != nil {
			return err
		}
		if !sameSentences(current, previous) {
			continue
		}
		if _, err := tx.Exec(ctx, `UPDATE english_cards SET examples = $2 WHERE lower(word) = $1`, strings.ToLower(entry.Word), fresh); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE english_cards
		SET generated = true
		WHERE generated = false AND cardinality(examples) = 10`); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func insertVocab(ctx context.Context, tx pgx.Tx, entries []ieltsEntry, have map[string]bool, varied bool) error {
	for _, entry := range entries {
		key := strings.ToLower(entry.Word)
		if have[key] {
			continue
		}
		var examples []string
		var err error
		if varied {
			examples, err = variedExamples(entry.Word, entry.Kind)
		} else {
			examples, err = ieltsExamples(entry.Word, entry.Kind)
		}
		if err != nil {
			return err
		}
		input := NormalizeEnglish(EnglishInput{Word: entry.Word, Meaning: entry.Meaning, Examples: examples})
		if err := ValidateEnglish(input); err != nil {
			return fmt.Errorf("%s: %w", entry.Word, err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO english_cards (word, meaning, examples)
			VALUES ($1, $2, $3)`,
			input.Word, input.Meaning, input.Examples); err != nil {
			return err
		}
		have[key] = true
	}
	return nil
}
