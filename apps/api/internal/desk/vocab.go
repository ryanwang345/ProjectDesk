package desk

import (
	_ "embed"
	"fmt"
	"strings"
)

//go:embed vocab_extra.txt
var vocabExtra string

func extraVocab() ([]ieltsEntry, error) {
	seen := map[string]bool{}
	for _, entry := range ieltsEntries {
		seen[strings.ToLower(entry.Word)] = true
	}
	var out []ieltsEntry
	for _, line := range strings.Split(vocabExtra, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.Split(line, "\t")
		if len(parts) != 3 {
			return nil, fmt.Errorf("bad vocabulary line %q", line)
		}
		word, meaning, kind := strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]), strings.TrimSpace(parts[2])
		key := strings.ToLower(word)
		if word == "" || meaning == "" || seen[key] {
			continue
		}
		switch kind {
		case "n", "v", "vi", "adj", "adv":
		default:
			return nil, fmt.Errorf("unknown kind %s for %s", kind, word)
		}
		seen[key] = true
		out = append(out, ieltsEntry{Word: word, Meaning: meaning, Kind: kind})
	}
	return out, nil
}

func variedExamples(word, kind string) ([]string, error) {
	if custom, ok := ieltsCustom[strings.ToLower(word)]; ok && len(custom) == ExampleCount {
		return append([]string(nil), custom...), nil
	}
	banks, ok := variedFrames[kind]
	if !ok {
		return ieltsExamples(word, kind)
	}
	lines := banks[bankIndex(word, len(banks))]
	if len(lines) != ExampleCount {
		return nil, fmt.Errorf("missing varied frames for %s (%s)", word, kind)
	}
	out := make([]string, ExampleCount)
	for i, frame := range lines {
		out[i] = fmt.Sprintf(frame, word)
	}
	return out, nil
}

func bankIndex(word string, n int) int {
	h := 0
	for _, r := range strings.ToLower(word) {
		h = h*33 + int(r)
	}
	if h < 0 {
		h = -h
	}
	return h % n
}

var variedFrames = map[string][][]string{
	"n": {
		{
			"The news story kept returning to %s.",
			"She mentioned %s while we were having lunch.",
			"We could not agree about %s.",
			"His email never really explained %s.",
			"I understood %s after the second example.",
			"The form asks for %s near the top.",
			"They spent the whole meeting on %s.",
			"A clear answer begins with %s.",
			"I heard a short piece about %s on the radio.",
			"Without %s, the plan falls apart.",
		},
		{
			"My notes from class are mostly about %s.",
			"The guide gives a plain definition of %s.",
			"People in the queue were talking about %s.",
			"She drew a quick diagram of %s.",
			"The first chapter is only about %s.",
			"He lost marks because he ignored %s.",
			"We need a real example of %s, not a slogan.",
			"The poster in the hall explains %s.",
			"I wrote %s in my phone so I would not forget.",
			"The question is really about %s.",
		},
		{
			"During the interview she was asked about %s.",
			"The map key includes %s.",
			"Our group project focuses on %s.",
			"He finally saw why %s matters.",
			"The doctor used simple words for %s.",
			"I compared two articles on %s.",
			"The budget line for %s is too small.",
			"Children ask surprising questions about %s.",
			"The sign by the door mentions %s.",
			"If you remember one thing, remember %s.",
		},
		{
			"The podcast episode is about %s.",
			"She circled %s in the reading passage.",
			"We changed our plan because of %s.",
			"His presentation opened with %s.",
			"The city report has a section on %s.",
			"I can explain %s to a friend in one minute.",
			"The debate was really about %s.",
			"The photo caption mentions %s.",
			"A good essay needs a clear line on %s.",
			"Please check the figure for %s before you submit.",
		},
	},
	"v": {
		{
			"I need to %s before Friday.",
			"She showed me how to %s when I got stuck.",
			"The city wants residents to %s.",
			"Can you %s and then send me the result?",
			"He refused to %s.",
			"We will lose time if we forget to %s.",
			"The instructions say to %s first.",
			"I watched her %s and followed the same steps.",
			"It takes practice to %s well.",
			"Please %s and keep a copy for yourself.",
		},
		{
			"They asked me to %s at the start of the meeting.",
			"I was too tired to %s properly.",
			"The app reminds you to %s.",
			"We decided to %s after we read the notice.",
			"She can %s without looking at her notes.",
			"He offered to %s for the whole group.",
			"You should %s before you book the ticket.",
			"The teacher let us %s in pairs.",
			"I will %s tonight and check it in the morning.",
			"Nobody wanted to %s, so I did it.",
		},
		{
			"The leaflet tells new students to %s.",
			"We stayed late in order to %s.",
			"He had to %s twice because the first try failed.",
			"She promised to %s by noon.",
			"I still do not know when to %s.",
			"The coach told the team to %s.",
			"We can %s online or at the office.",
			"He paused, then began to %s.",
			"They hired someone to %s.",
			"If the form is wrong, you must %s again.",
		},
		{
			"My host family helped me %s.",
			"The video shows a simple way to %s.",
			"We agreed to %s and share what we find.",
			"She was the first person to %s.",
			"I forgot to %s, and it caused a delay.",
			"The manager asked who would %s.",
			"You can %s from home.",
			"He tried to %s, but the office was closed.",
			"We should %s before the deadline.",
			"Let me %s, and tell me if I missed a step.",
		},
	},
	"vi": {
		{
			"The numbers began to %s after June.",
			"Nothing will %s if we keep waiting.",
			"This pattern can %s in other cities too.",
			"We watched the situation %s over the winter.",
			"Small problems %s when nobody is in charge.",
			"The gap may %s if the funding stops.",
			"A new habit can %s once people see the benefit.",
			"Researchers asked why it started to %s.",
			"The same change might %s next year.",
			"These cases %s more often in busy months.",
		},
		{
			"Costs continue to %s.",
			"The crowd started to %s near the station.",
			"Interest can %s when the story is personal.",
			"The risk will %s if the rule stays vague.",
			"Sales %s every December.",
			"We expect demand to %s.",
			"The argument seemed to %s from one comment.",
			"Hope can %s after a single good result.",
			"The noise began to %s after midnight.",
			"Attendance may %s when the class moves online.",
		},
		{
			"Tension can %s before an exam.",
			"The plants %s if you water them too often.",
			"Rumours %s quickly in a small office.",
			"The river starts to %s after heavy rain.",
			"Confidence will %s with each successful try.",
			"Queues %s around lunchtime.",
			"The pain should %s within a day.",
			"Support began to %s once the facts were clear.",
			"Dust will %s if the windows stay open.",
			"The difference can %s from one sample to the next.",
		},
		{
			"Prices %s when supply is short.",
			"The fire alarm made everyone %s.",
			"Motivation can %s halfway through a long course.",
			"We let the dough %s for an hour.",
			"Complaints %s whenever the bus is late.",
			"The ice will %s by afternoon.",
			"A rumour can %s faster than the correction.",
			"Smiles %s when the results go up.",
			"The class started to %s near the end.",
			"Traffic may %s after the new bridge opens.",
		},
	},
	"adj": {
		{
			"The room felt %s as soon as we walked in.",
			"Her answer was %s, and she gave a reason.",
			"The instructions are %s if you read them slowly.",
			"He looked %s after the long flight.",
			"This example is %s for the writing task.",
			"The streets were %s at seven in the morning.",
			"I felt %s and closed the laptop.",
			"The result was %s, so we checked it again.",
			"Her choice was %s, and she explained why.",
			"The plan is %s, which is why people trust it.",
		},
		{
			"The soup tasted %s.",
			"His tone sounded %s.",
			"The estimate is %s, so we can decide.",
			"The path is %s after the rain.",
			"Her description was %s.",
			"The news left everyone %s.",
			"That excuse is not %s.",
			"The colours look %s in daylight.",
			"His recovery was %s, and he came back to class.",
			"Keep the language %s.",
		},
		{
			"The price felt %s.",
			"I felt %s and went home early.",
			"The rule is %s.",
			"Her coat looks %s in this weather.",
			"The comment seemed %s, so she asked him to explain.",
			"The road was %s, so we walked.",
			"The data look %s, but the sample is small.",
			"He seemed %s before the talk.",
			"The break was %s, and then we started again.",
			"The ending of the film is %s.",
		},
		{
			"The water looked %s, so we bought bottles.",
			"She remained %s even when the questions got hard.",
			"This word is %s in academic writing.",
			"The apartment is %s, with a desk by the window.",
			"His apology sounded %s.",
			"Everyone was %s when the train was cancelled.",
			"The difference is %s once you put the charts side by side.",
			"The topic is %s, so it is easy to support with an example.",
			"The shop was %s, so we came back later.",
			"That sentence is %s and easy to follow.",
		},
	},
	"adv": {
		{
			"She explained the rule %s.",
			"He answered %s and then gave an example.",
			"Please read the question %s.",
			"The team worked %s and still made the deadline.",
			"Prices moved %s over the year.",
			"I wrote the address down %s.",
			"She spoke %s so the visitors could follow.",
			"He checked the total %s before paying.",
			"The city grew %s during those ten years.",
			"We finished %s and had time to review.",
		},
		{
			"The lecturer stated the claim %s.",
			"Attendance rose %s from one term to the next.",
			"She nodded %s and opened her notebook.",
			"He drove %s because the road was icy.",
			"Costs increased %s after the new fee.",
			"I listened %s the second time.",
			"They agreed %s and left the room.",
			"The numbers fell %s in the final quarter.",
			"She repeated the word %s.",
			"He closed the shop %s at six.",
		},
		{
			"The children played %s in the courtyard.",
			"She smiled %s when she saw the score.",
			"He typed %s and kept making mistakes.",
			"We walked %s so we would not miss the turn.",
			"The speaker paused %s.",
			"Rain fell %s all afternoon.",
			"She packed %s and caught the early train.",
			"He replied %s to every email.",
			"The crowd moved %s toward the exit.",
			"I slept %s for the first time all week.",
		},
		{
			"She greeted the class %s.",
			"He measured the ingredients %s.",
			"The band played %s until midnight.",
			"We searched %s and found the keys in the kitchen.",
			"She breathed %s and started the talk.",
			"He turned %s when someone called his name.",
			"The plan changed %s.",
			"I remember the day %s.",
			"They argued %s, then shook hands.",
			"The lights went out %s.",
		},
	},
}
