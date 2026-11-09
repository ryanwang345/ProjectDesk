package desk

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

func (s *Store) seedReading(ctx context.Context) error {
	tests := builtinReadingTests()
	for _, t := range tests {
		if err := validateSeedTest(t); err != nil {
			return fmt.Errorf("seed reading %s: %w", t.Slug, err)
		}
		passagesRaw, err := json.Marshal(t.Passages)
		if err != nil {
			return err
		}
		questionsRaw, err := json.Marshal(t.Questions)
		if err != nil {
			return err
		}
		_, err = s.pool.Exec(ctx, `
			INSERT INTO reading_tests (slug, title, subtitle, module, category, difficulty, duration_seconds, passages, questions)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
			ON CONFLICT (slug) DO UPDATE
			SET title = EXCLUDED.title,
			    subtitle = EXCLUDED.subtitle,
			    module = EXCLUDED.module,
			    category = EXCLUDED.category,
			    difficulty = EXCLUDED.difficulty,
			    duration_seconds = EXCLUDED.duration_seconds,
			    passages = EXCLUDED.passages,
			    questions = EXCLUDED.questions`,
			t.Slug, t.Title, t.Subtitle, t.Module, t.Category, t.Difficulty, t.DurationSeconds, passagesRaw, questionsRaw,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func validateSeedTest(t ReadingTest) error {
	if len(t.Passages) == 0 || len(t.Questions) == 0 {
		return fmt.Errorf("empty passages or questions")
	}
	for i, q := range t.Questions {
		if q.Number != i+1 {
			return fmt.Errorf("question %s has number %d, want %d", q.ID, q.Number, i+1)
		}
		if !validQuestionTypes[q.Type] {
			return fmt.Errorf("question %d has invalid type %s", q.Number, q.Type)
		}
		if !CheckReadingAnswer(q, q.CorrectAnswer) {
			return fmt.Errorf("question %d (%s) failed self-check for answer %q", q.Number, q.ID, q.CorrectAnswer)
		}
	}
	return nil
}

func academicPassage1() ReadingPassage {
	return ReadingPassage{
		ID:        "ac1-p1",
		Index:     1,
		Title:     "The Architecture of Subterranean Cooling: From Persian Qanats to Modern Earth Tubes",
		Subtitle:  "Reading Passage 1 · Questions 1–13 · Spend about 20 minutes on this passage.",
		WordCount: 685,
		Paragraphs: []ReadingParagraph{
			{
				Label: "A",
				Text:  "Long before mechanical air conditioning transformed urban architecture in the twentieth century, builders across the arid Iranian plateau mastered passive subterranean cooling. Central to this vernacular engineering tradition was the qanat: a gently sloping underground channel excavated through alluvial fans to transport mountain groundwater over tens of kilometres without surface evaporation. While primarily designed for irrigation and drinking water, qanats also functioned as thermal batteries, drawing heat away from densely packed mud-brick settlements.",
			},
			{
				Label: "B",
				Text:  "The cooling power of a qanat reached its peak when paired with a badgir, or traditional windcatcher. Rising as a masonry tower above the roofline, the windcatcher intercepted prevailing breezes and directed warm outside air down a vertical shaft that intersected the underground water stream. As the air travelled across the cold, rushing water and damp tunnel walls, sensible heat was absorbed through both convection and evaporative cooling, lowering indoor temperatures by up to fifteen degrees Celsius compared with the street outside.",
			},
			{
				Label: "C",
				Text:  "Crucially, this coupled system could operate even on calm, windless afternoons. When external wind speeds dropped to zero, the windcatcher reversed its airflow direction and acted as a solar chimney. Sun-heated walls warmed the air at the top of the tower, creating a buoyant updraft that exhausted stale indoor air through the roof while pulling cool air up from the subterranean qanat shaft below. Field measurements by architectural historian Mehdi Bahadori in Yazd demonstrated that this buoyancy-driven mode maintained a steady indoor breeze of 0.4 metres per second.",
			},
			{
				Label: "D",
				Text:  "In the late twentieth century, European and North American engineers adapted these principles into closed-loop earth-to-air heat exchangers, commonly called earth tubes. Because seasonal temperature fluctuations attenuate rapidly with soil depth, the ground three metres below the surface remains at a nearly constant temperature year-round—typically around twelve degrees Celsius in temperate climates. Outside ventilation air is drawn through buried polyethylene or concrete pipes, pre-cooling the air in summer and pre-warming it in winter before it enters a building's ventilation unit.",
			},
			{
				Label: "E",
				Text:  "Despite their low operational energy use, modern earth tubes face engineering hurdles that ancient qanats avoided. In humid climates, cooling warm outdoor air below its dew point inside a buried pipe causes moisture to condense on the inner tube walls. Without a continuous two-percent drainage slope and antimicrobial pipe linings, stagnant condensation can foster mould growth and degrade indoor air quality. Contemporary standards developed by researcher Klaus Sedlbauer therefore mandate automated humidity sensors that bypass the earth tube whenever outdoor dew points exceed safe thresholds.",
			},
			{
				Label: "F",
				Text:  "Today, hybrid civic buildings in Madrid, Melbourne, and Masdar City combine deep thermal labyrinths with low-energy mechanical fans. Post-occupancy audits of the Melbourne Council House 2 building showed that subterranean thermal labyrinths cut peak cooling electricity demand by 38 percent while paying back their construction cost within seven years. Rather than viewing vernacular architecture as a historical curiosity, building physicists increasingly treat qanat thermodynamics as a blueprint for decarbonizing urban cooling.",
			},
		},
	}
}

func academicPassage2() ReadingPassage {
	return ReadingPassage{
		ID:        "ac1-p2",
		Index:     2,
		Title:     "Rewilding Urban Waterways: Ecological and Economic Outcomes of Daylighted Rivers",
		Subtitle:  "Reading Passage 2 · Questions 14–26 · Spend about 20 minutes on this passage.",
		WordCount: 660,
		Paragraphs: []ReadingParagraph{
			{
				Label: "A",
				Text:  "Throughout thenineteenth and twentieth centuries, rapidly industrializing cities treated small rivers and streams as inconvenient obstacles or open sewers. Across Europe, North America, and East Asia, thousands of kilometres of urban tributaries were straightened, lined with concrete, and buried beneath asphalt roadways inside underground culverts. While burying streams freed surface land for highways and factories, it severed riparian ecosystems and accelerated downstream flash flooding.",
			},
			{
				Label: "B",
				Text:  "Over the past twenty-five years, a counter-movement known as 'daylighting'—uncovering buried streams and restoring them to open-air channels—has gained momentum among hydrologists and urban planners. Perhaps the most celebrated example is the Cheonggyecheon restoration in central Seoul, completed in 2005. Engineers dismantled an elevated six-lane motorway, excavated the buried waterway beneath it, and established a 5.8-kilometre linear park. Within three years, biodiversity surveys recorded a sixfold increase in bird, insect, and fish species along the corridor.",
			},
			{
				Label: "C",
				Text:  "Hydrologist Elena Bernhardt cautions, however, that simply removing a concrete roof does not automatically restore ecological function. In a comparative study of forty-two daylighted streams in the United States, Bernhardt found that projects confined to narrow, steep-sided channels failed to reduce nitrogen and phosphorus runoff unless they also re-established vegetated floodplains and riffle-pool streambeds. Microorganisms living in porous gravel beds and root zones are essential for filtering urban pollutants before water reaches larger rivers.",
			},
			{
				Label: "D",
				Text:  "In Zurich, municipal engineer Conradin Berset pioneered a systematic programme that daylighted more than twenty kilometres of small brooks—locally called Bachkonzept—between 1988 and 2015. Instead of routing clean hillside spring water into the municipal wastewater treatment plant, Zurich separated clean stream flow into newly opened surface channels. This single administrative and engineering reform reduced the volume of water entering the city's sewage treatment plants by thirty percent, saving millions of Swiss francs in pumping and chemical treatment expenses each year.",
			},
			{
				Label: "E",
				Text:  "Critics of urban river restoration often point to high upfront excavation costs and the loss of street parking. Yet urban economist Jun-Seok Kim demonstrated that daylighting frequently generates substantial microclimatic and property-value dividends. Infrared thermal mapping in Seoul showed that the restored Cheonggyecheon corridor lowered summer ambient air temperatures by 3.6 degrees Celsius in adjacent neighbourhoods, while commercial rents within two hundred metres of the stream rose 22 percent faster than in comparable districts.",
			},
			{
				Label: "F",
				Text:  "Nevertheless, sociologists warn of 'ecological gentrification,' whereby newly amenitized green corridors price out long-standing small workshops and low-income tenants. Urban planner Isabelle Anguelovski argues that river daylighting must be paired with community land trusts and commercial rent stabilization so that environmental restoration benefits existing residents rather than displacing them.",
			},
		},
	}
}

func academicPassage3() ReadingPassage {
	return ReadingPassage{
		ID:        "ac1-p3",
		Index:     3,
		Title:     "The Cognitive Neuroscience of Bilingual Executive Control",
		Subtitle:  "Reading Passage 3 · Questions 27–40 · Spend about 20 minutes on this passage.",
		WordCount: 690,
		Paragraphs: []ReadingParagraph{
			{
				Label: "A",
				Text:  "For much of the early twentieth century, educational psychologists widely believed that raising children with two languages caused cognitive confusion and delayed lexical development. That deficit model was overturned in 1962 when Elizabeth Peal and Wallace Lambert compared French-English bilingual and monolingual children in Montreal who were carefully matched for socioeconomic status. Peal and Lambert discovered that bilingual participants outperformed monolinguals on both verbal and non-verbal reasoning tasks, inaugurating decades of research into how managing two linguistic systems shapes the human brain.",
			},
			{
				Label: "B",
				Text:  "A foundational finding of modern psycholinguistics is that a bilingual speaker's two languages remain simultaneously active in the mind, even when only one language is needed. Eye-tracking experiments show that when Russian-English bilinguals hear the English word 'marker', their gaze briefly fixates on a postage stamp—called 'marka' in Russian—before settling on the drawing pen. Because both lexicons compete for selection, the brain must continuously recruit domain-general executive control networks in the dorsolateral prefrontal cortex and anterior cingulate cortex to inhibit the non-target language.",
			},
			{
				Label: "C",
				Text:  "Developmental cognitive neuroscientist Ellen Bialystok proposed that this lifelong practice in resolving lexical competition strengthens executive functioning beyond language itself. In laboratory tasks such as the Flanker test and the Dimensional Change Card Sort, Bialystok and her colleagues observed that lifelong bilinguals switched rules faster and ignored distracting visual stimuli more effectively than monolinguals. Furthermore, clinical retrospective analyses of patients in Toronto memory clinics indicated that bilingual older adults developed symptoms of dementia an average of 4.1 years later than monolingual patients with equivalent levels of underlying brain pathology.",
			},
			{
				Label: "D",
				Text:  "Over the past decade, however, the 'bilingual advantage' hypothesis has sparked intense methodological debate. Psychologist Kenneth Paap conducted meta-analyses of behavioural reaction-time studies with young university students and reported that many small-sample experiments showing a bilingual advantage failed to replicate in larger cohorts. Paap argued that publication bias—the tendency of journals to publish positive differences while shelving null results—inflated early claims about general cognitive superiority in healthy young adults.",
			},
			{
				Label: "E",
				Text:  "To reconcile these conflicting behavioural findings, neuroscientists David Green and Jubin Abutalebi formulated the Adaptive Control Hypothesis. They contend that bilingualism is not a single uniform state; rather, cognitive demands depend on the interactional context in which languages are used. A speaker in a 'single-language context' (using one language exclusively at home and another exclusively at work) experiences far less rapid switching demand than a speaker in a 'dual-language context', where both languages are used with different interlocutors in the same environment, requiring constant monitoring and inhibitory control.",
			},
			{
				Label: "F",
				Text:  "Structural neuroimaging studies increasingly support this nuanced view. Even when young bilinguals and monolinguals achieve identical reaction times on simple computer tasks, functional MRI scans reveal that bilinguals accomplish the same accuracy with lower metabolic activation in the anterior cingulate cortex—a hallmark of neural efficiency—and higher white-matter integrity in the corpus callosum. Thus, the contemporary scientific consensus has moved beyond a simplistic yes-or-no debate toward mapping how specific bilingual experiences sculpt neural reserve across the lifespan.",
			},
		},
	}
}

func academicFullQuestions() []ReadingQuestion {
	return []ReadingQuestion{
		// Passage 1: Q1–Q5 Matching Headings (Type 4)
		{
			ID:                "ac1-q1",
			Number:            1,
			PassageID:         "ac1-p1",
			Type:              QMatchingHeadings,
			GroupInstruction:  "Questions 1–5: Choose the correct heading for Paragraphs B–F from the list of headings (i–viii) below.",
			Prompt:            "Paragraph B",
			Options:           []string{"i. How buoyancy reverses airflow on windless days", "ii. Combining wind towers with underground water channels", "iii. Condensation risks and hygiene controls in buried pipes", "iv. Measurable energy savings in contemporary civic buildings", "v. Constant ground temperatures and closed-loop pipe design", "vi. Financial failure of ancient irrigation networks", "vii. Legal disputes over groundwater ownership"},
			CorrectAnswer:     "ii",
			AcceptableAnswers: []string{"ii. Combining wind towers with underground water channels"},
			Explanation:       "Paragraph B explains how pairing a qanat with a badgir (windcatcher) channelled breezes across underground water to cool indoor air.",
			ExplanationZh:     "B 段阐述了风塔（badgir）与地下坎儿井水道结合，利用对流与蒸发将室内降温高达 15 摄氏度，对应标题 ii。",
			EvidenceParagraph: "B",
			EvidenceQuote:     "The cooling power of a qanat reached its peak when paired with a badgir, or traditional windcatcher.",
		},
		{
			ID:                "ac1-q2",
			Number:            2,
			PassageID:         "ac1-p1",
			Type:              QMatchingHeadings,
			GroupInstruction:  "Questions 1–5: Choose the correct heading for Paragraphs B–F from the list of headings (i–viii) below.",
			Prompt:            "Paragraph C",
			Options:           []string{"i. How buoyancy reverses airflow on windless days", "ii. Combining wind towers with underground water channels", "iii. Condensation risks and hygiene controls in buried pipes", "iv. Measurable energy savings in contemporary civic buildings", "v. Constant ground temperatures and closed-loop pipe design", "vi. Financial failure of ancient irrigation networks", "vii. Legal disputes over groundwater ownership"},
			CorrectAnswer:     "i",
			AcceptableAnswers: []string{"i. How buoyancy reverses airflow on windless days"},
			Explanation:       "Paragraph C describes how on calm, windless afternoons, the windcatcher reverses airflow and functions as a buoyancy-driven solar chimney.",
			ExplanationZh:     "C 段说明在无风的午后，风塔会反转气流方向，利用热浮力充当太阳能烟囱，对应标题 i。",
			EvidenceParagraph: "C",
			EvidenceQuote:     "When external wind speeds dropped to zero, the windcatcher reversed its airflow direction and acted as a solar chimney.",
		},
		{
			ID:                "ac1-q3",
			Number:            3,
			PassageID:         "ac1-p1",
			Type:              QMatchingHeadings,
			GroupInstruction:  "Questions 1–5: Choose the correct heading for Paragraphs B–F from the list of headings (i–viii) below.",
			Prompt:            "Paragraph D",
			Options:           []string{"i. How buoyancy reverses airflow on windless days", "ii. Combining wind towers with underground water channels", "iii. Condensation risks and hygiene controls in buried pipes", "iv. Measurable energy savings in contemporary civic buildings", "v. Constant ground temperatures and closed-loop pipe design", "vi. Financial failure of ancient irrigation networks", "vii. Legal disputes over groundwater ownership"},
			CorrectAnswer:     "v",
			AcceptableAnswers: []string{"v. Constant ground temperatures and closed-loop pipe design"},
			Explanation:       "Paragraph D explains how soil three metres underground stays around 12°C year-round and how closed-loop earth tubes pre-cool or pre-warm air.",
			ExplanationZh:     "D 段介绍了地下三米恒温特性以及闭环地埋管（earth tubes）的设计原理，对应标题 v。",
			EvidenceParagraph: "D",
			EvidenceQuote:     "European and North American engineers adapted these principles into closed-loop earth-to-air heat exchangers, commonly called earth tubes.",
		},
		{
			ID:                "ac1-q4",
			Number:            4,
			PassageID:         "ac1-p1",
			Type:              QMatchingHeadings,
			GroupInstruction:  "Questions 1–5: Choose the correct heading for Paragraphs B–F from the list of headings (i–viii) below.",
			Prompt:            "Paragraph E",
			Options:           []string{"i. How buoyancy reverses airflow on windless days", "ii. Combining wind towers with underground water channels", "iii. Condensation risks and hygiene controls in buried pipes", "iv. Measurable energy savings in contemporary civic buildings", "v. Constant ground temperatures and closed-loop pipe design", "vi. Financial failure of ancient irrigation networks", "vii. Legal disputes over groundwater ownership"},
			CorrectAnswer:     "iii",
			AcceptableAnswers: []string{"iii. Condensation risks and hygiene controls in buried pipes"},
			Explanation:       "Paragraph E focuses on moisture condensation inside buried pipes in humid climates and the drainage/sensor controls needed to prevent mould.",
			ExplanationZh:     "E 段聚焦于潮湿气候下地埋管内部的冷凝水风险、霉菌隐患以及湿度传感器与排水坡度控制，对应标题 iii。",
			EvidenceParagraph: "E",
			EvidenceQuote:     "In humid climates, cooling warm outdoor air below its dew point inside a buried pipe causes moisture to condense on the inner tube walls.",
		},
		{
			ID:                "ac1-q5",
			Number:            5,
			PassageID:         "ac1-p1",
			Type:              QMatchingHeadings,
			GroupInstruction:  "Questions 1–5: Choose the correct heading for Paragraphs B–F from the list of headings (i–viii) below.",
			Prompt:            "Paragraph F",
			Options:           []string{"i. How buoyancy reverses airflow on windless days", "ii. Combining wind towers with underground water channels", "iii. Condensation risks and hygiene controls in buried pipes", "iv. Measurable energy savings in contemporary civic buildings", "v. Constant ground temperatures and closed-loop pipe design", "vi. Financial failure of ancient irrigation networks", "vii. Legal disputes over groundwater ownership"},
			CorrectAnswer:     "iv",
			AcceptableAnswers: []string{"iv. Measurable energy savings in contemporary civic buildings"},
			Explanation:       "Paragraph F highlights modern civic buildings like Melbourne Council House 2, cutting peak cooling electricity demand by 38 percent.",
			ExplanationZh:     "F 段展示了墨尔本市政大厦等现代公共建筑实测削减 38% 峰值制冷电耗并在七年内收回成本，对应标题 iv。",
			EvidenceParagraph: "F",
			EvidenceQuote:     "Post-occupancy audits of the Melbourne Council House 2 building showed that subterranean thermal labyrinths cut peak cooling electricity demand by 38 percent",
		},
		// Passage 1: Q6–Q9 True/False/Not Given (Type 2)
		{
			ID:                "ac1-q6",
			Number:            6,
			PassageID:         "ac1-p1",
			Type:              QTrueFalseNotGiven,
			GroupInstruction:  "Questions 6–9: Do the following statements agree with the information given in Reading Passage 1? Choose TRUE, FALSE, or NOT GIVEN.",
			Prompt:            "The primary purpose of constructing qanats was to cool residential buildings rather than to supply water.",
			Options:           []string{"TRUE", "FALSE", "NOT GIVEN"},
			CorrectAnswer:     "FALSE",
			Explanation:       "Paragraph A states that qanats were 'primarily designed for irrigation and drinking water', and cooling was a secondary benefit.",
			ExplanationZh:     "A 段明确指出坎儿井主要设计用于灌溉和饮用水，降温是附带功能，因此题干说法错误（FALSE）。",
			EvidenceParagraph: "A",
			EvidenceQuote:     "While primarily designed for irrigation and drinking water, qanats also functioned as thermal batteries",
		},
		{
			ID:                "ac1-q7",
			Number:            7,
			PassageID:         "ac1-p1",
			Type:              QTrueFalseNotGiven,
			GroupInstruction:  "Questions 6–9: Do the following statements agree with the information given in Reading Passage 1? Choose TRUE, FALSE, or NOT GIVEN.",
			Prompt:            "A windcatcher coupled with a qanat can still ventilate a building when there is no wind outside.",
			Options:           []string{"TRUE", "FALSE", "NOT GIVEN"},
			CorrectAnswer:     "TRUE",
			Explanation:       "Paragraph C states that the coupled system operated on calm, windless afternoons by reversing airflow and acting as a solar chimney.",
			ExplanationZh:     "C 段证实，在无风的午后，该耦合系统会反转气流并充当太阳能烟囱继续通风，故选 TRUE。",
			EvidenceParagraph: "C",
			EvidenceQuote:     "Crucially, this coupled system could operate even on calm, windless afternoons.",
		},
		{
			ID:                "ac1-q8",
			Number:            8,
			PassageID:         "ac1-p1",
			Type:              QTrueFalseNotGiven,
			GroupInstruction:  "Questions 6–9: Do the following statements agree with the information given in Reading Passage 1? Choose TRUE, FALSE, or NOT GIVEN.",
			Prompt:            "Concrete earth tubes are more effective at transferring heat than polyethylene pipes.",
			Options:           []string{"TRUE", "FALSE", "NOT GIVEN"},
			CorrectAnswer:     "NOT GIVEN",
			Explanation:       "Paragraph D mentions both polyethylene and concrete pipes, but never compares their heat-transfer efficiency.",
			ExplanationZh:     "D 段仅提及聚乙烯管或混凝土管，并未比较两者的传热效率高低，故选 NOT GIVEN。",
			EvidenceParagraph: "D",
			EvidenceQuote:     "Outside ventilation air is drawn through buried polyethylene or concrete pipes",
		},
		{
			ID:                "ac1-q9",
			Number:            9,
			PassageID:         "ac1-p1",
			Type:              QTrueFalseNotGiven,
			GroupInstruction:  "Questions 6–9: Do the following statements agree with the information given in Reading Passage 1? Choose TRUE, FALSE, or NOT GIVEN.",
			Prompt:            "Melbourne Council House 2 recouped the construction cost of its subterranean thermal labyrinth in seven years.",
			Options:           []string{"TRUE", "FALSE", "NOT GIVEN"},
			CorrectAnswer:     "TRUE",
			Explanation:       "Paragraph F directly confirms that the thermal labyrinths paid back their construction cost within seven years.",
			ExplanationZh:     "F 段明确说明墨尔本 Council House 2 的地下热迷宫在七年内收回了建造成本，故选 TRUE。",
			EvidenceParagraph: "F",
			EvidenceQuote:     "paying back their construction cost within seven years.",
		},
		// Passage 1: Q10–Q11 Diagram Label Completion (Type 11)
		{
			ID:                "ac1-q10",
			Number:            10,
			PassageID:         "ac1-p1",
			Type:              QDiagramCompletion,
			GroupInstruction:  "Questions 10–11: Complete the diagram labels for the Qanat & Windcatcher Airflow System. Choose NO MORE THAN TWO WORDS from the passage for each answer.",
			ContextText:       "[Diagram: Windless Afternoon Operation] Sun-heated tower top acts as a (10) ________ → exhausts stale indoor air upward → draws cool air from the subterranean qanat.",
			Prompt:            "Label 10: On windless afternoons, the sun-heated windcatcher tower functions as a ________.",
			WordLimit:         2,
			CorrectAnswer:     "solar chimney",
			Explanation:       "Paragraph C states that when wind speeds dropped to zero, the windcatcher acted as a 'solar chimney'.",
			ExplanationZh:     "C 段指出，当外部风速降为零时，风塔反转气流方向并充当“太阳能烟囱”（solar chimney）。",
			EvidenceParagraph: "C",
			EvidenceQuote:     "When external wind speeds dropped to zero, the windcatcher reversed its airflow direction and acted as a solar chimney.",
		},
		{
			ID:                "ac1-q11",
			Number:            11,
			PassageID:         "ac1-p1",
			Type:              QDiagramCompletion,
			GroupInstruction:  "Questions 10–11: Complete the diagram labels for the Qanat & Windcatcher Airflow System. Choose NO MORE THAN TWO WORDS from the passage for each answer.",
			ContextText:       "[Diagram: Modern Earth Tube Safeguards] Buried pipe with 2% drainage slope + automated (11) ________ to bypass the tube when dew points are high.",
			Prompt:            "Label 11: Contemporary standards require automated ________ to bypass the earth tube when outdoor dew points exceed safe limits.",
			WordLimit:         2,
			CorrectAnswer:     "humidity sensors",
			Explanation:       "Paragraph E states that contemporary standards mandate automated 'humidity sensors' that bypass the earth tube.",
			ExplanationZh:     "E 段指出，现行标准要求安装自动“湿度传感器”（humidity sensors），在露点过高时旁通地埋管。",
			EvidenceParagraph: "E",
			EvidenceQuote:     "Contemporary standards developed by researcher Klaus Sedlbauer therefore mandate automated humidity sensors that bypass the earth tube",
		},
		// Passage 1: Q12–Q13 Short Answer Questions (Type 12)
		{
			ID:                "ac1-q12",
			Number:            12,
			PassageID:         "ac1-p1",
			Type:              QShortAnswer,
			GroupInstruction:  "Questions 12–13: Answer the questions below. Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Reading Passage 1.",
			Prompt:            "By how many degrees Celsius could a qanat and windcatcher lower indoor temperatures compared with the street outside?",
			WordLimit:         3,
			CorrectAnswer:     "15",
			AcceptableAnswers: []string{"fifteen", "15 degrees", "fifteen degrees"},
			Explanation:       "Paragraph B notes that the system lowered indoor temperatures by up to fifteen degrees Celsius.",
			ExplanationZh:     "B 段指出，该系统可将室内温度比室外街道降低多达 15 摄氏度（fifteen / 15）。",
			EvidenceParagraph: "B",
			EvidenceQuote:     "lowering indoor temperatures by up to fifteen degrees Celsius compared with the street outside.",
		},
		{
			ID:                "ac1-q13",
			Number:            13,
			PassageID:         "ac1-p1",
			Type:              QShortAnswer,
			GroupInstruction:  "Questions 12–13: Answer the questions below. Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Reading Passage 1.",
			Prompt:            "What unwanted biological growth can stagnant condensation cause inside unlined earth tubes?",
			WordLimit:         2,
			CorrectAnswer:     "mould",
			AcceptableAnswers: []string{"mould growth", "mold", "mold growth"},
			Explanation:       "Paragraph E warns that stagnant condensation can foster 'mould growth' and degrade indoor air quality.",
			ExplanationZh:     "E 段指出，滞留的冷凝水会滋生霉菌（mould / mould growth）并降低室内空气质量。",
			EvidenceParagraph: "E",
			EvidenceQuote:     "stagnant condensation can foster mould growth and degrade indoor air quality.",
		},

		// Passage 2: Q14–Q18 Matching Information (Type 5)
		{
			ID:                "ac1-q14",
			Number:            14,
			PassageID:         "ac1-p2",
			Type:              QMatchingInformation,
			GroupInstruction:  "Questions 14–18: Reading Passage 2 has six paragraphs, A–F. Which paragraph contains the following information?",
			Prompt:            "A reference to the risk that restored green corridors may displace existing low-income residents and small businesses",
			Options:           []string{"A", "B", "C", "D", "E", "F"},
			CorrectAnswer:     "F",
			Explanation:       "Paragraph F discusses 'ecological gentrification' pricing out small workshops and low-income tenants.",
			ExplanationZh:     "F 段提及“生态绅士化”（ecological gentrification）可能导致原有小作坊和低收入租户被迫搬离。",
			EvidenceParagraph: "F",
			EvidenceQuote:     "sociologists warn of 'ecological gentrification,' whereby newly amenitized green corridors price out long-standing small workshops and low-income tenants.",
		},
		{
			ID:                "ac1-q15",
			Number:            15,
			PassageID:         "ac1-p2",
			Type:              QMatchingInformation,
			GroupInstruction:  "Questions 14–18: Reading Passage 2 has six paragraphs, A–F. Which paragraph contains the following information?",
			Prompt:            "Data showing how diverting clean spring water into open channels lowered municipal sewage treatment volume",
			Options:           []string{"A", "B", "C", "D", "E", "F"},
			CorrectAnswer:     "D",
			Explanation:       "Paragraph D explains how Zurich's Bachkonzept programme reduced water entering sewage treatment plants by 30 percent.",
			ExplanationZh:     "D 段介绍了苏黎世将清洁山泉水引流至地表溪流，使污水处理厂进水量减少了 30%。",
			EvidenceParagraph: "D",
			EvidenceQuote:     "This single administrative and engineering reform reduced the volume of water entering the city's sewage treatment plants by thirty percent",
		},
		{
			ID:                "ac1-q16",
			Number:            16,
			PassageID:         "ac1-p2",
			Type:              QMatchingInformation,
			GroupInstruction:  "Questions 14–18: Reading Passage 2 has six paragraphs, A–F. Which paragraph contains the following information?",
			Prompt:            "Evidence that uncovering a stream can cool surrounding city blocks and raise nearby commercial rents",
			Options:           []string{"A", "B", "C", "D", "E", "F"},
			CorrectAnswer:     "E",
			Explanation:       "Paragraph E reports thermal mapping (3.6°C cooler) and 22% faster commercial rent growth near the Cheonggyecheon stream.",
			ExplanationZh:     "E 段引用了首尔清溪川周边夏季降温 3.6°C 以及 200 米内商业租金涨幅高出 22% 的实证数据。",
			EvidenceParagraph: "E",
			EvidenceQuote:     "Infrared thermal mapping in Seoul showed that the restored Cheonggyecheon corridor lowered summer ambient air temperatures by 3.6 degrees Celsius",
		},
		{
			ID:                "ac1-q17",
			Number:            17,
			PassageID:         "ac1-p2",
			Type:              QMatchingInformation,
			GroupInstruction:  "Questions 14–18: Reading Passage 2 has six paragraphs, A–F. Which paragraph contains the following information?",
			Prompt:            "Reasons why nineteenth- and twentieth-century cities buried their small rivers underground",
			Options:           []string{"A", "B", "C", "D", "E", "F"},
			CorrectAnswer:     "A",
			Explanation:       "Paragraph A explains that cities buried tributaries in culverts to free surface land for highways and factories and to hide open sewers.",
			ExplanationZh:     "A 段说明了 19 至 20 世纪工业化城市将支流埋入地下涵洞以腾出地面修建公路和工厂的原因。",
			EvidenceParagraph: "A",
			EvidenceQuote:     "While burying streams freed surface land for highways and factories, it severed riparian ecosystems",
		},
		{
			ID:                "ac1-q18",
			Number:            18,
			PassageID:         "ac1-p2",
			Type:              QMatchingInformation,
			GroupInstruction:  "Questions 14–18: Reading Passage 2 has six paragraphs, A–F. Which paragraph contains the following information?",
			Prompt:            "An explanation of why steep, narrow daylighted channels fail to filter out agricultural and urban nutrients",
			Options:           []string{"A", "B", "C", "D", "E", "F"},
			CorrectAnswer:     "C",
			Explanation:       "Paragraph C explains that narrow, steep-sided channels lack vegetated floodplains and gravel beds needed to filter nitrogen and phosphorus.",
			ExplanationZh:     "C 段解释了狭窄陡峭的河道因缺乏植被洪泛区和多孔砾石床微生物群落，无法有效过滤氮磷污染物。",
			EvidenceParagraph: "C",
			EvidenceQuote:     "projects confined to narrow, steep-sided channels failed to reduce nitrogen and phosphorus runoff unless they also re-established vegetated floodplains",
		},
		// Passage 2: Q19–Q22 Matching Features (Type 6)
		{
			ID:                "ac1-q19",
			Number:            19,
			PassageID:         "ac1-p2",
			Type:              QMatchingFeatures,
			GroupInstruction:  "Questions 19–22: Match each finding or recommendation with the correct expert, A, B, C, or D.",
			Prompt:            "Separating clean hillside spring water from municipal sewers cuts wastewater treatment costs.",
			Options:           []string{"A. Elena Bernhardt", "B. Conradin Berset", "C. Jun-Seok Kim", "D. Isabelle Anguelovski"},
			CorrectAnswer:     "B",
			AcceptableAnswers: []string{"B. Conradin Berset"},
			Explanation:       "Paragraph D credits Zurich municipal engineer Conradin Berset with separating clean spring water from wastewater plants.",
			ExplanationZh:     "D 段指出苏黎世市政工程师 Conradin Berset（B）通过将山泉水与污水管网分离，大幅降低了污水处理费。",
			EvidenceParagraph: "D",
			EvidenceQuote:     "In Zurich, municipal engineer Conradin Berset pioneered a systematic programme that daylighted more than twenty kilometres of small brooks",
		},
		{
			ID:                "ac1-q20",
			Number:            20,
			PassageID:         "ac1-p2",
			Type:              QMatchingFeatures,
			GroupInstruction:  "Questions 19–22: Match each finding or recommendation with the correct expert, A, B, C, or D.",
			Prompt:            "Uncovering a buried stream does not reduce nutrient pollution unless floodplains and gravel streambeds are restored.",
			Options:           []string{"A. Elena Bernhardt", "B. Conradin Berset", "C. Jun-Seok Kim", "D. Isabelle Anguelovski"},
			CorrectAnswer:     "A",
			AcceptableAnswers: []string{"A. Elena Bernhardt"},
			Explanation:       "Paragraph C describes hydrologist Elena Bernhardt's study of 42 daylighted streams showing floodplains and riffle-pool beds are required.",
			ExplanationZh:     "C 段水文学家 Elena Bernhardt（A）对 42 条复明河流的研究表明，必须恢复洪泛区与砾石河床才能削减氮磷污染。",
			EvidenceParagraph: "C",
			EvidenceQuote:     "Hydrologist Elena Bernhardt cautions, however, that simply removing a concrete roof does not automatically restore ecological function.",
		},
		{
			ID:                "ac1-q21",
			Number:            21,
			PassageID:         "ac1-p2",
			Type:              QMatchingFeatures,
			GroupInstruction:  "Questions 19–22: Match each finding or recommendation with the correct expert, A, B, C, or D.",
			Prompt:            "River restoration should be combined with community land trusts and rent stabilization to protect local tenants.",
			Options:           []string{"A. Elena Bernhardt", "B. Conradin Berset", "C. Jun-Seok Kim", "D. Isabelle Anguelovski"},
			CorrectAnswer:     "D",
			AcceptableAnswers: []string{"D. Isabelle Anguelovski"},
			Explanation:       "Paragraph F cites urban planner Isabelle Anguelovski recommending community land trusts and commercial rent stabilization.",
			ExplanationZh:     "F 段城市规划学者 Isabelle Anguelovski（D）主张将河道复明与社区土地信托及租金稳定机制结合。",
			EvidenceParagraph: "F",
			EvidenceQuote:     "Urban planner Isabelle Anguelovski argues that river daylighting must be paired with community land trusts and commercial rent stabilization",
		},
		{
			ID:                "ac1-q22",
			Number:            22,
			PassageID:         "ac1-p2",
			Type:              QMatchingFeatures,
			GroupInstruction:  "Questions 19–22: Match each finding or recommendation with the correct expert, A, B, C, or D.",
			Prompt:            "Restored urban waterways measurably reduce local summer heat and boost surrounding property values.",
			Options:           []string{"A. Elena Bernhardt", "B. Conradin Berset", "C. Jun-Seok Kim", "D. Isabelle Anguelovski"},
			CorrectAnswer:     "C",
			AcceptableAnswers: []string{"C. Jun-Seok Kim"},
			Explanation:       "Paragraph E cites urban economist Jun-Seok Kim's findings on microclimatic cooling and commercial rent increases.",
			ExplanationZh:     "E 段城市经济学家 Jun-Seok Kim（C）证明了河道复明能带来显著的微气候降温与周边物业增值收益。",
			EvidenceParagraph: "E",
			EvidenceQuote:     "urban economist Jun-Seok Kim demonstrated that daylighting frequently generates substantial microclimatic and property-value dividends.",
		},
		// Passage 2: Q23–Q26 Summary Completion (Type 9)
		{
			ID:                "ac1-q23",
			Number:            23,
			PassageID:         "ac1-p2",
			Type:              QSummaryCompletion,
			GroupInstruction:  "Questions 23–26: Complete the summary of the Cheonggyecheon and US stream studies below. Choose NO MORE THAN TWO WORDS from Reading Passage 2 for each answer.",
			ContextText:       "In Seoul's Cheonggyecheon project, engineers removed an elevated highway and created a 5.8-kilometre (23) ________, leading to a sixfold rise in wildlife species. However, US research shows that pollutant filtering depends on microorganisms living in root zones and porous (24) ________. Meanwhile, in Zurich, diverting clean spring water out of the sewage system cut treatment plant inflow by thirty percent, while in Seoul the restored corridor mitigated the urban heat island and raised nearby (25) ________. To prevent the displacement of existing residents—a process termed (26) ________—planners recommend pairing ecological restoration with rent stabilization.",
			Prompt:            "Blank 23: Engineers removed an elevated highway and established a 5.8-kilometre ________.",
			WordLimit:         2,
			CorrectAnswer:     "linear park",
			Explanation:       "Paragraph B states that engineers established a '5.8-kilometre linear park'.",
			ExplanationZh:     "B 段指出，工程师拆除了高架公路并建成了一条 5.8 公里长的“带状公园”（linear park）。",
			EvidenceParagraph: "B",
			EvidenceQuote:     "Engineers dismantled an elevated six-lane motorway, excavated the buried waterway beneath it, and established a 5.8-kilometre linear park.",
		},
		{
			ID:                "ac1-q24",
			Number:            24,
			PassageID:         "ac1-p2",
			Type:              QSummaryCompletion,
			GroupInstruction:  "Questions 23–26: Complete the summary of the Cheonggyecheon and US stream studies below. Choose NO MORE THAN TWO WORDS from Reading Passage 2 for each answer.",
			Prompt:            "Blank 24: Microorganisms living in root zones and porous ________ are essential for filtering urban pollutants.",
			WordLimit:         2,
			CorrectAnswer:     "gravel beds",
			Explanation:       "Paragraph C states that microorganisms living in 'porous gravel beds and root zones' filter urban pollutants.",
			ExplanationZh:     "C 段指出，栖息在多孔“砾石床”（gravel beds）和根区中的微生物对过滤城市污染物至关重要。",
			EvidenceParagraph: "C",
			EvidenceQuote:     "Microorganisms living in porous gravel beds and root zones are essential for filtering urban pollutants",
		},
		{
			ID:                "ac1-q25",
			Number:            25,
			PassageID:         "ac1-p2",
			Type:              QSummaryCompletion,
			GroupInstruction:  "Questions 23–26: Complete the summary of the Cheonggyecheon and US stream studies below. Choose NO MORE THAN TWO WORDS from Reading Passage 2 for each answer.",
			Prompt:            "Blank 25: Within two hundred metres of the restored stream, ________ rose 22 percent faster than in comparable districts.",
			WordLimit:         2,
			CorrectAnswer:     "commercial rents",
			Explanation:       "Paragraph E reports that 'commercial rents within two hundred metres of the stream rose 22 percent faster'.",
			ExplanationZh:     "E 段指出，河道 200 米范围内的“商业租金”（commercial rents）涨幅比同类街区快 22%。",
			EvidenceParagraph: "E",
			EvidenceQuote:     "while commercial rents within two hundred metres of the stream rose 22 percent faster than in comparable districts.",
		},
		{
			ID:                "ac1-q26",
			Number:            26,
			PassageID:         "ac1-p2",
			Type:              QSummaryCompletion,
			GroupInstruction:  "Questions 23–26: Complete the summary of the Cheonggyecheon and US stream studies below. Choose NO MORE THAN TWO WORDS from Reading Passage 2 for each answer.",
			Prompt:            "Blank 26: Sociologists warn of ________, whereby newly greened corridors price out low-income tenants.",
			WordLimit:         2,
			CorrectAnswer:     "ecological gentrification",
			Explanation:       "Paragraph F states that sociologists warn of 'ecological gentrification'.",
			ExplanationZh:     "F 段指出，社会学家警告会出现“生态绅士化”（ecological gentrification）现象。",
			EvidenceParagraph: "F",
			EvidenceQuote:     "Nevertheless, sociologists warn of 'ecological gentrification,' whereby newly amenitized green corridors price out long-standing small workshops",
		},

		// Passage 3: Q27–Q30 Multiple Choice (Type 1)
		{
			ID:                "ac1-q27",
			Number:            27,
			PassageID:         "ac1-p3",
			Type:              QMultipleChoice,
			GroupInstruction:  "Questions 27–30: Choose the correct letter, A, B, C, or D.",
			Prompt:            "Why was Peal and Lambert's 1962 Montreal study considered a turning point?",
			Options:           []string{"A. It proved that monolingual children acquire vocabulary faster than bilinguals.", "B. It controlled for socioeconomic status and showed bilinguals excelled in verbal and non-verbal reasoning.", "C. It was the first study to use functional MRI scans on bilingual children.", "D. It demonstrated that French and English are stored in separate hemispheres."},
			CorrectAnswer:     "B",
			AcceptableAnswers: []string{"B. It controlled for socioeconomic status and showed bilinguals excelled in verbal and non-verbal reasoning."},
			Explanation:       "Paragraph A explains that Peal and Lambert matched participants for socioeconomic status and found bilinguals outperformed monolinguals on verbal and non-verbal reasoning.",
			ExplanationZh:     "A 段说明 Peal 和 Lambert 在控制社会经济地位变量后，发现双语儿童在言语和非言语推理任务上均优于单语儿童，故选 B。",
			EvidenceParagraph: "A",
			EvidenceQuote:     "Peal and Lambert discovered that bilingual participants outperformed monolinguals on both verbal and non-verbal reasoning tasks",
		},
		{
			ID:                "ac1-q28",
			Number:            28,
			PassageID:         "ac1-p3",
			Type:              QMultipleChoice,
			GroupInstruction:  "Questions 27–30: Choose the correct letter, A, B, C, or D.",
			Prompt:            "What do the Russian-English eye-tracking experiments in Paragraph B illustrate?",
			Options:           []string{"A. Bilinguals often confuse the meanings of basic concrete nouns.", "B. Visual attention is slower in people who speak more than one language.", "C. Both of a bilingual's languages remain active simultaneously, creating lexical competition.", "D. Spoken Russian words are processed faster than spoken English words."},
			CorrectAnswer:     "C",
			AcceptableAnswers: []string{"C. Both of a bilingual's languages remain active simultaneously, creating lexical competition."},
			Explanation:       "Paragraph B uses the 'marker'/'marka' eye-tracking study to demonstrate that both languages remain simultaneously active and compete for selection.",
			ExplanationZh:     "B 段通过俄英双语者听到“marker”时短暂注视邮票（俄语 marka）的眼动实验，证明双语者的两种语言在脑中同时保持激活并产生词汇竞争，故选 C。",
			EvidenceParagraph: "B",
			EvidenceQuote:     "A foundational finding of modern psycholinguistics is that a bilingual speaker's two languages remain simultaneously active in the mind",
		},
		{
			ID:                "ac1-q29",
			Number:            29,
			PassageID:         "ac1-p3",
			Type:              QMultipleChoice,
			GroupInstruction:  "Questions 27–30: Choose the correct letter, A, B, C, or D.",
			Prompt:            "According to Kenneth Paap, why did early behavioural studies appear to show a consistent bilingual advantage in young adults?",
			Options:           []string{"A. Journals preferentially published positive findings from small samples while leaving null results unpublished.", "B. Young university students were tested in noisy environments.", "C. Researchers failed to measure white-matter integrity.", "D. Participants in early studies were mostly simultaneous interpreters."},
			CorrectAnswer:     "A",
			AcceptableAnswers: []string{"A. Journals preferentially published positive findings from small samples while leaving null results unpublished."},
			Explanation:       "Paragraph D explains Paap's argument about publication bias—journals publishing positive differences while shelving null results.",
			ExplanationZh:     "D 段指出 Paap 认为存在发表偏倚（publication bias），即期刊倾向于发表小样本阳性结果而搁置无差异结果，故选 A。",
			EvidenceParagraph: "D",
			EvidenceQuote:     "Paap argued that publication bias—the tendency of journals to publish positive differences while shelving null results—inflated early claims",
		},
		{
			ID:                "ac1-q30",
			Number:            30,
			PassageID:         "ac1-p3",
			Type:              QMultipleChoice,
			GroupInstruction:  "Questions 27–30: Choose the correct letter, A, B, C, or D.",
			Prompt:            "What do functional MRI scans reveal when young bilinguals and monolinguals achieve identical reaction times?",
			Options:           []string{"A. Bilinguals rely exclusively on the right hemisphere.", "B. Bilinguals show lower metabolic activation in the anterior cingulate cortex, indicating greater neural efficiency.", "C. Monolinguals have higher white-matter integrity in the corpus callosum.", "D. Neither group activates the dorsolateral prefrontal cortex."},
			CorrectAnswer:     "B",
			AcceptableAnswers: []string{"B. Bilinguals show lower metabolic activation in the anterior cingulate cortex, indicating greater neural efficiency."},
			Explanation:       "Paragraph F states that fMRI scans show bilinguals achieve the same accuracy with lower metabolic activation in the anterior cingulate cortex—a hallmark of neural efficiency.",
			ExplanationZh:     "F 段指出，即使反应时间相同，功能性磁共振成像显示双语者前扣带回皮层的代谢激活更低，体现了更高的神经效率，故选 B。",
			EvidenceParagraph: "F",
			EvidenceQuote:     "bilinguals accomplish the same accuracy with lower metabolic activation in the anterior cingulate cortex—a hallmark of neural efficiency",
		},
		// Passage 3: Q31–Q34 Yes/No/Not Given (Type 3)
		{
			ID:                "ac1-q31",
			Number:            31,
			PassageID:         "ac1-p3",
			Type:              QYesNoNotGiven,
			GroupInstruction:  "Questions 31–34: Do the following statements agree with the claims of the writer in Reading Passage 3? Choose YES, NO, or NOT GIVEN.",
			Prompt:            "Earlier twentieth-century psychologists were mistaken in their belief that bilingualism harmed children's cognitive development.",
			Options:           []string{"YES", "NO", "NOT GIVEN"},
			CorrectAnswer:     "YES",
			Explanation:       "Paragraph A describes the early twentieth-century belief as a 'deficit model' that was 'overturned' in 1962.",
			ExplanationZh:     "A 段指出早期心理学家的“缺陷模型”在 1962 年被推翻，说明作者认同该早期观点是错误的，故选 YES。",
			EvidenceParagraph: "A",
			EvidenceQuote:     "That deficit model was overturned in 1962 when Elizabeth Peal and Wallace Lambert compared French-English bilingual and monolingual children",
		},
		{
			ID:                "ac1-q32",
			Number:            32,
			PassageID:         "ac1-p3",
			Type:              QYesNoNotGiven,
			GroupInstruction:  "Questions 31–34: Do the following statements agree with the claims of the writer in Reading Passage 3? Choose YES, NO, or NOT GIVEN.",
			Prompt:            "Bilingualism completely prevents the physical brain pathology associated with dementia in older age.",
			Options:           []string{"YES", "NO", "NOT GIVEN"},
			CorrectAnswer:     "NO",
			Explanation:       "Paragraph C states that bilingual older adults had 'equivalent levels of underlying brain pathology'—it delayed clinical symptoms by 4.1 years rather than preventing the physical pathology.",
			ExplanationZh:     "C 段指出双语老年患者拥有“同等程度的潜在脑部病变”，双语只是将痴呆临床症状推迟了 4.1 年，而非完全阻止脑部病理改变，故选 NO。",
			EvidenceParagraph: "C",
			EvidenceQuote:     "bilingual older adults developed symptoms of dementia an average of 4.1 years later than monolingual patients with equivalent levels of underlying brain pathology.",
		},
		{
			ID:                "ac1-q33",
			Number:            33,
			PassageID:         "ac1-p3",
			Type:              QYesNoNotGiven,
			GroupInstruction:  "Questions 31–34: Do the following statements agree with the claims of the writer in Reading Passage 3? Choose YES, NO, or NOT GIVEN.",
			Prompt:            "Adults who learn a second language after age thirty gain the same white-matter integrity as childhood bilinguals.",
			Options:           []string{"YES", "NO", "NOT GIVEN"},
			CorrectAnswer:     "NOT GIVEN",
			Explanation:       "The passage never compares adults who learn a second language after age thirty with childhood bilinguals.",
			ExplanationZh:     "文章并未比较 30 岁以后习得第二语言的成年人与童年双语者的白质完整性，故选 NOT GIVEN。",
			EvidenceParagraph: "F",
			EvidenceQuote:     "higher white-matter integrity in the corpus callosum.",
		},
		{
			ID:                "ac1-q34",
			Number:            34,
			PassageID:         "ac1-p3",
			Type:              QYesNoNotGiven,
			GroupInstruction:  "Questions 31–34: Do the following statements agree with the claims of the writer in Reading Passage 3? Choose YES, NO, or NOT GIVEN.",
			Prompt:            "The cognitive demands placed on a bilingual brain vary according to the social environment in which the two languages are spoken.",
			Options:           []string{"YES", "NO", "NOT GIVEN"},
			CorrectAnswer:     "YES",
			Explanation:       "Paragraph E explains Green and Abutalebi's Adaptive Control Hypothesis: cognitive demands depend on the interactional context.",
			ExplanationZh:     "E 段阐述了适应性控制假说：双语对大脑的认知需求取决于使用语言的互动语境（单语语境或双语混合语境），故选 YES。",
			EvidenceParagraph: "E",
			EvidenceQuote:     "cognitive demands depend on the interactional context in which languages are used.",
		},
		// Passage 3: Q35–Q37 Matching Sentence Endings (Type 7)
		{
			ID:                "ac1-q35",
			Number:            35,
			PassageID:         "ac1-p3",
			Type:              QMatchingSentenceEndings,
			GroupInstruction:  "Questions 35–37: Complete each sentence with the correct ending, A–E, below.",
			Prompt:            "In Toronto memory clinic studies, lifelong bilingualism was found to...",
			Options:           []string{"A. delay the clinical onset of dementia symptoms by over four years.", "B. require constant monitoring and inhibition in the same environment.", "C. eliminate lexical competition between Russian and English.", "D. impose minimal switching demands between home and work.", "E. replace the function of the corpus callosum."},
			CorrectAnswer:     "A",
			AcceptableAnswers: []string{"A. delay the clinical onset of dementia symptoms by over four years."},
			Explanation:       "Paragraph C states that Toronto memory clinic analyses showed bilingual older adults developed dementia symptoms an average of 4.1 years later.",
			ExplanationZh:     "C 段指出多伦多记忆诊所的研究显示终身双语者出现痴呆症状的平均时间推迟了 4.1 年，对应 A。",
			EvidenceParagraph: "C",
			EvidenceQuote:     "bilingual older adults developed symptoms of dementia an average of 4.1 years later",
		},
		{
			ID:                "ac1-q36",
			Number:            36,
			PassageID:         "ac1-p3",
			Type:              QMatchingSentenceEndings,
			GroupInstruction:  "Questions 35–37: Complete each sentence with the correct ending, A–E, below.",
			Prompt:            "According to the Adaptive Control Hypothesis, speaking in a dual-language context tends to...",
			Options:           []string{"A. delay the clinical onset of dementia symptoms by over four years.", "B. require constant monitoring and inhibition in the same environment.", "C. eliminate lexical competition between Russian and English.", "D. impose minimal switching demands between home and work.", "E. replace the function of the corpus callosum."},
			CorrectAnswer:     "B",
			AcceptableAnswers: []string{"B. require constant monitoring and inhibition in the same environment."},
			Explanation:       "Paragraph E states that a dual-language context requires constant monitoring and inhibitory control in the same environment.",
			ExplanationZh:     "E 段指出，双语混合语境（dual-language context）需要在同一环境中持续进行监控与抑制控制，对应 B。",
			EvidenceParagraph: "E",
			EvidenceQuote:     "where both languages are used with different interlocutors in the same environment, requiring constant monitoring and inhibitory control.",
		},
		{
			ID:                "ac1-q37",
			Number:            37,
			PassageID:         "ac1-p3",
			Type:              QMatchingSentenceEndings,
			GroupInstruction:  "Questions 35–37: Complete each sentence with the correct ending, A–E, below.",
			Prompt:            "Operating in a strict single-language context is thought to...",
			Options:           []string{"A. delay the clinical onset of dementia symptoms by over four years.", "B. require constant monitoring and inhibition in the same environment.", "C. eliminate lexical competition between Russian and English.", "D. impose minimal switching demands between home and work.", "E. replace the function of the corpus callosum."},
			CorrectAnswer:     "D",
			AcceptableAnswers: []string{"D. impose minimal switching demands between home and work."},
			Explanation:       "Paragraph E notes that a speaker in a single-language context (one language at home, another at work) experiences far less rapid switching demand.",
			ExplanationZh:     "E 段说明在单一语言语境（在家用一种语言、工作用另一种语言）中，快速切换的需求要少得多，对应 D。",
			EvidenceParagraph: "E",
			EvidenceQuote:     "A speaker in a 'single-language context' (using one language exclusively at home and another exclusively at work) experiences far less rapid switching demand",
		},
		// Passage 3: Q38–Q40 Note / Table / Sentence Completion (Types 8 & 10)
		{
			ID:                "ac1-q38",
			Number:            38,
			PassageID:         "ac1-p3",
			Type:              QTableCompletion,
			GroupInstruction:  "Questions 38–40: Complete the research summary table below. Choose NO MORE THAN TWO WORDS from Reading Passage 3 for each answer.",
			ContextText:       "[Table: Brain Regions & Cognitive Mechanisms in Bilingualism]\n• Dorsolateral prefrontal cortex & anterior cingulate cortex: recruited to inhibit the (38) ________ language.\n• Behavioral tasks (e.g. Flanker test): lifelong bilinguals ignored distracting (39) ________ more effectively.\n• Corpus callosum: structural MRI shows higher white-matter integrity, contributing to lifelong (40) ________.",
			Prompt:            "Table Blank 38: Executive control networks are continuously recruited to inhibit the ________ language.",
			WordLimit:         2,
			CorrectAnswer:     "non-target",
			Explanation:       "Paragraph B states that executive control networks are recruited 'to inhibit the non-target language'.",
			ExplanationZh:     "B 段指出，大脑执行控制网络被持续调用以抑制“非目标”（non-target）语言。",
			EvidenceParagraph: "B",
			EvidenceQuote:     "to inhibit the non-target language.",
		},
		{
			ID:                "ac1-q39",
			Number:            39,
			PassageID:         "ac1-p3",
			Type:              QTableCompletion,
			GroupInstruction:  "Questions 38–40: Complete the research summary table below. Choose NO MORE THAN TWO WORDS from Reading Passage 3 for each answer.",
			Prompt:            "Table Blank 39: In the Flanker test, lifelong bilinguals switched rules faster and ignored distracting ________.",
			WordLimit:         2,
			CorrectAnswer:     "visual stimuli",
			Explanation:       "Paragraph C states that lifelong bilinguals 'ignored distracting visual stimuli more effectively than monolinguals'.",
			ExplanationZh:     "C 段指出，在 Flanker 测试中，终身双语者能更有效地忽略干扰性的“视觉刺激”（visual stimuli）。",
			EvidenceParagraph: "C",
			EvidenceQuote:     "switched rules faster and ignored distracting visual stimuli more effectively than monolinguals.",
		},
		{
			ID:                "ac1-q40",
			Number:            40,
			PassageID:         "ac1-p3",
			Type:              QSentenceCompletion,
			GroupInstruction:  "Questions 38–40: Complete the research summary table below. Choose NO MORE THAN TWO WORDS from Reading Passage 3 for each answer.",
			Prompt:            "Blank 40: Contemporary research maps how specific bilingual experiences sculpt ________ across the lifespan.",
			WordLimit:         2,
			CorrectAnswer:     "neural reserve",
			Explanation:       "Paragraph F concludes that contemporary science maps 'how specific bilingual experiences sculpt neural reserve across the lifespan'.",
			ExplanationZh:     "F 段总结指出，当代科学致力于描绘特定双语经历如何在全生命周期中塑造“神经储备”（neural reserve）。",
			EvidenceParagraph: "F",
			EvidenceQuote:     "mapping how specific bilingual experiences sculpt neural reserve across the lifespan.",
		},
	}
}

func generalFullTest() ReadingTest {
	p1 := ReadingPassage{
		ID:        "gt1-p1",
		Index:     1,
		Title:     "Section 1: Harbourside Community Bike-Share Rules & Regional Rail Fare Guide",
		Subtitle:  "Section 1 · Questions 1–14 · Everyday notices, memberships, and travel guidelines",
		WordCount: 520,
		Paragraphs: []ReadingParagraph{
			{
				Label: "A",
				Text:  "Harbourside Bike-Share Pass Tiers: Residents and visitors may choose between three membership tiers. The Casual Day Pass costs $8 and includes unlimited 30-minute rides for 24 hours. The Commuter Monthly Pass ($24/month) extends the free ride window to 45 minutes per trip. The Annual Cargo Pass ($140/year) grants 60-minute rides on both standard bicycles and front-loader electric cargo bikes.",
			},
			{
				Label: "B",
				Text:  "Docking and Late Fees: Every trip must end at an official solar docking station. Wait for the green chime and a double beep on the handlebar screen to confirm the lock has engaged. Trips exceeding your tier's included time window incur an overage charge of $3 per additional 15 minutes. Bicycles left outside an official dock are subject to a $65 retrieval fee.",
			},
			{
				Label: "C",
				Text:  "Safety and Mechanical Faults: Helmets are mandatory for all riders under 18 and strongly recommended for adults. If you discover a flat tyre, faulty brake, or damaged light before riding, press the red wrench button on the dock keypad and rotate the saddle backward 180 degrees to alert maintenance crews.",
			},
			{
				Label: "D",
				Text:  "HarbourLink Regional Rail Zones: Peak fares apply on weekdays between 06:30–09:00 and 16:00–18:30. Off-peak fares (30% discount) apply at all other times, including weekends and public holidays, provided you tap onto the platform reader outside peak windows.",
			},
			{
				Label: "E",
				Text:  "Carrying Bicycles on Trains: Folding bicycles enclosed in a carry bag are permitted on all HarbourLink services at no extra charge. Full-size bicycles and e-bikes are welcome on off-peak trains and in the designated green-striped carriage on weekend services, but are strictly prohibited on weekday peak-hour trains.",
			},
		},
	}
	p2 := ReadingPassage{
		ID:        "gt1-p2",
		Index:     2,
		Title:     "Section 2: Northstar Engineering — Workplace Ergonomics & Study Leave Handbook",
		Subtitle:  "Section 2 · Questions 15–27 · Staff policies, equipment allowances, and professional development",
		WordCount: 540,
		Paragraphs: []ReadingParagraph{
			{
				Label: "A",
				Text:  "Workstation Assessments: All full-time and part-time employees working more than twenty hours per week are entitled to an ergonomic assessment within thirty days of onboarding. Remote and hybrid staff may book a virtual video consultation with the Occupational Health Coordinator or complete the self-assessment checklist on the staff intranet.",
			},
			{
				Label: "B",
				Text:  "Equipment Reimbursement: Following an approved assessment, employees may claim up to $450 once every three years toward an adjustable task chair, split keyboard, or monitor arm. Itemized tax receipts must be uploaded to the Finance Portal within forty-five days of purchase; handwritten invoices or bank statements alone cannot be accepted.",
			},
			{
				Label: "C",
				Text:  "Micro-Break Protocol: For roles involving continuous screen work, Northstar recommends the 50/10 rhythm: fifty minutes of focused work followed by ten minutes of non-screen tasks such as standing meetings, document filing, or stretching in the wellness room on Level 4.",
			},
			{
				Label: "D",
				Text:  "Professional Development Leave: Permanent staff who have completed at least twelve months of continuous service may apply for up to five days of paid Study Leave per calendar year. The course or certification exam must be directly related to the employee's current department or an approved internal career pathway.",
			},
			{
				Label: "E",
				Text:  "Application Deadlines and Exam Resits: Study Leave requests must be endorsed by a line manager at least four weeks prior to the course start date. Paid leave covers the first sitting of an accredited examination; employees who need to resit an exam must use annual leave or unpaid leave for subsequent attempts.",
			},
		},
	}
	p3 := ReadingPassage{
		ID:        "gt1-p3",
		Index:     3,
		Title:     "Section 3: The Longitude Problem and the Birth of the Marine Chronometer",
		Subtitle:  "Section 3 · Questions 28–40 · Historical narrative on navigation and precision horology",
		WordCount: 620,
		Paragraphs: []ReadingParagraph{
			{
				Label: "A",
				Text:  "For centuries, mariners crossing open oceans could determine their latitude with reasonable accuracy by measuring the angle of the sun or pole star above the horizon. Determining longitude—one's east-west position—was far more treacherous. Because the Earth rotates 360 degrees every twenty-four hours (or fifteen degrees per hour), calculating longitude at sea required knowing the exact time at a reference meridian simultaneously with local solar noon aboard the ship.",
			},
			{
				Label: "B",
				Text:  "After a fleet commanded by Sir Cloudesley Shovell wrecked on the Isles of Scilly in 1707 due to a navigational miscalculation, the British Parliament passed the Longitude Act of 1714. The Act established the Board of Longitude and offered a top prize of £20,000 for any practical method capable of determining a ship's longitude to within half a degree after a voyage to the West Indies.",
			},
			{
				Label: "C",
				Text:  "Most astronomers on the Board, including Nevil Maskelyne, favoured the 'lunar distance' method, which used complex tables of the Moon's position relative to background stars. Pendulum clocks, the most accurate timekeepers on land, were useless on a rolling deck because pitching waves, humidity changes, and temperature swings altered the pendulum's swing and thickened lubricating oils.",
			},
			{
				Label: "D",
				Text:  "A self-taught Yorkshire carpenter named John Harrison defied the astronomical establishment by spending four decades perfecting mechanical sea clocks. His early machines—H1, H2, and H3—used counter-balanced spring-connected bars to neutralize the ship's motion. His breakthrough came in 1759 with H4, a large pocket-watch-sized marine chronometer measuring just thirteen centimetres across.",
			},
			{
				Label: "E",
				Text:  "Inside H4, Harrison incorporated a bimetallic strip of brass and steel to compensate automatically for temperature changes, diamond and ruby pallet jewels to minimize friction without oil, and a high-frequency balance wheel. On its 1761 sea trial to Jamaica aboard HMS Deptford, H4 lost only 5.1 seconds over eighty-one days—an error of barely one nautical mile, far surpassing Parliament's accuracy requirement.",
			},
		},
	}

	questions := []ReadingQuestion{
		{ID: "gt1-q1", Number: 1, PassageID: "gt1-p1", Type: QTrueFalseNotGiven, GroupInstruction: "Questions 1–5: Do the following statements agree with the information in Section 1? Choose TRUE, FALSE, or NOT GIVEN.", Prompt: "The Commuter Monthly Pass allows riders to use electric cargo bikes for 60 minutes per trip.", Options: []string{"TRUE", "FALSE", "NOT GIVEN"}, CorrectAnswer: "FALSE", Explanation: "Paragraph A states that the Commuter Monthly Pass gives 45-minute rides; only the Annual Cargo Pass grants 60-minute rides on electric cargo bikes.", ExplanationZh: "A 段说明月卡（Commuter Monthly Pass）免费时长为 45 分钟，只有年卡（Annual Cargo Pass）才包含 60 分钟电动货运自行车骑行。", EvidenceParagraph: "A", EvidenceQuote: "The Commuter Monthly Pass ($24/month) extends the free ride window to 45 minutes per trip."},
		{ID: "gt1-q2", Number: 2, PassageID: "gt1-p1", Type: QTrueFalseNotGiven, GroupInstruction: "Questions 1–5: Choose TRUE, FALSE, or NOT GIVEN.", Prompt: "Leaving a bike-share bicycle outside an official docking station results in a $65 fee.", Options: []string{"TRUE", "FALSE", "NOT GIVEN"}, CorrectAnswer: "TRUE", Explanation: "Paragraph B states that bicycles left outside an official dock are subject to a $65 retrieval fee.", ExplanationZh: "B 段明确指出，未停放在官方站点外的自行车需缴纳 65 美元回收费。", EvidenceParagraph: "B", EvidenceQuote: "Bicycles left outside an official dock are subject to a $65 retrieval fee."},
		{ID: "gt1-q3", Number: 3, PassageID: "gt1-p1", Type: QTrueFalseNotGiven, GroupInstruction: "Questions 1–5: Choose TRUE, FALSE, or NOT GIVEN.", Prompt: "Riders over 18 are fined by police if they ride without a helmet.", Options: []string{"TRUE", "FALSE", "NOT GIVEN"}, CorrectAnswer: "FALSE", Explanation: "Paragraph C states helmets are mandatory for riders under 18 and 'strongly recommended for adults'.", ExplanationZh: "C 段说明头盔仅对 18 岁以下骑行者强制要求，成年人为强烈建议佩戴，因此题干错误。", EvidenceParagraph: "C", EvidenceQuote: "Helmets are mandatory for all riders under 18 and strongly recommended for adults."},
		{ID: "gt1-q4", Number: 4, PassageID: "gt1-p1", Type: QTrueFalseNotGiven, GroupInstruction: "Questions 1–5: Choose TRUE, FALSE, or NOT GIVEN.", Prompt: "Folding bicycles inside a carry bag can be taken onto weekday peak-hour trains for free.", Options: []string{"TRUE", "FALSE", "NOT GIVEN"}, CorrectAnswer: "TRUE", Explanation: "Paragraph E states that folding bicycles enclosed in a carry bag are permitted on all HarbourLink services at no extra charge.", ExplanationZh: "E 段指出，装入携行袋的折叠自行车可在所有班次（含高峰期）免费携带上车。", EvidenceParagraph: "E", EvidenceQuote: "Folding bicycles enclosed in a carry bag are permitted on all HarbourLink services at no extra charge."},
		{ID: "gt1-q5", Number: 5, PassageID: "gt1-p1", Type: QTrueFalseNotGiven, GroupInstruction: "Questions 1–5: Choose TRUE, FALSE, or NOT GIVEN.", Prompt: "Senior citizens receive a 50% discount on HarbourLink off-peak rail fares.", Options: []string{"TRUE", "FALSE", "NOT GIVEN"}, CorrectAnswer: "NOT GIVEN", Explanation: "Senior citizen discounts are not mentioned anywhere in Section 1.", ExplanationZh: "文中未提及老年人乘车折扣，故选 NOT GIVEN。", EvidenceParagraph: "D", EvidenceQuote: "Off-peak fares (30% discount) apply at all other times"},
		{ID: "gt1-q6", Number: 6, PassageID: "gt1-p1", Type: QShortAnswer, GroupInstruction: "Questions 6–9: Answer the questions below. Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 1.", Prompt: "How much is the overage charge for each extra 15 minutes beyond a pass's free ride window?", WordLimit: 2, CorrectAnswer: "$3", AcceptableAnswers: []string{"3", "3 dollars", "three dollars"}, Explanation: "Paragraph B states that overage charges are $3 per additional 15 minutes.", ExplanationZh: "B 段指出超时费为每 15 分钟 3 美元（$3）。", EvidenceParagraph: "B", EvidenceQuote: "incur an overage charge of $3 per additional 15 minutes."},
		{ID: "gt1-q7", Number: 7, PassageID: "gt1-p1", Type: QShortAnswer, GroupInstruction: "Questions 6–9: Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 1.", Prompt: "Which button on the dock keypad should you press if a bicycle has a flat tyre?", WordLimit: 3, CorrectAnswer: "red wrench", AcceptableAnswers: []string{"red wrench button", "wrench button"}, Explanation: "Paragraph C instructs riders to press the 'red wrench button' on the dock keypad.", ExplanationZh: "C 段说明遇到故障应按下桩位键盘上的红色扳手按钮（red wrench button）。", EvidenceParagraph: "C", EvidenceQuote: "press the red wrench button on the dock keypad"},
		{ID: "gt1-q8", Number: 8, PassageID: "gt1-p1", Type: QShortAnswer, GroupInstruction: "Questions 6–9: Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 1.", Prompt: "What percentage discount applies to off-peak HarbourLink rail fares?", WordLimit: 2, CorrectAnswer: "30%", AcceptableAnswers: []string{"30", "30 percent", "thirty percent"}, Explanation: "Paragraph D states that off-peak fares carry a 30% discount.", ExplanationZh: "D 段指出非高峰时段票价可享 30% 折扣。", EvidenceParagraph: "D", EvidenceQuote: "Off-peak fares (30% discount) apply at all other times"},
		{ID: "gt1-q9", Number: 9, PassageID: "gt1-p1", Type: QShortAnswer, GroupInstruction: "Questions 6–9: Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 1.", Prompt: "Which carriage on weekend trains is designated for full-size bicycles?", WordLimit: 3, CorrectAnswer: "green-striped", AcceptableAnswers: []string{"green-striped carriage"}, Explanation: "Paragraph E specifies the 'green-striped carriage' on weekend services.", ExplanationZh: "E 段说明周末列车上标有绿色条纹的车厢（green-striped carriage）可供全尺寸自行车停放。", EvidenceParagraph: "E", EvidenceQuote: "in the designated green-striped carriage on weekend services"},
		{ID: "gt1-q10", Number: 10, PassageID: "gt1-p1", Type: QMatchingInformation, GroupInstruction: "Questions 10–14: Which paragraph in Section 1 (A–E) contains the following information?", Prompt: "How to signal to maintenance staff that a docked bicycle needs repair", Options: []string{"A", "B", "C", "D", "E"}, CorrectAnswer: "C", Explanation: "Paragraph C explains pressing the red wrench button and rotating the saddle 180 degrees.", ExplanationZh: "C 段说明如何向维修人员标记故障车辆。", EvidenceParagraph: "C", EvidenceQuote: "rotate the saddle backward 180 degrees to alert maintenance crews."},
		{ID: "gt1-q11", Number: 11, PassageID: "gt1-p1", Type: QMatchingInformation, GroupInstruction: "Questions 10–14: Which paragraph in Section 1 (A–E) contains the following information?", Prompt: "The visual and audio signals confirming that a bicycle is properly locked in a dock", Options: []string{"A", "B", "C", "D", "E"}, CorrectAnswer: "B", Explanation: "Paragraph B describes the green chime and double beep on the handlebar screen.", ExplanationZh: "B 段说明了确认锁车成功的绿灯提示音与双响声。", EvidenceParagraph: "B", EvidenceQuote: "Wait for the green chime and a double beep on the handlebar screen to confirm the lock has engaged."},
		{ID: "gt1-q12", Number: 12, PassageID: "gt1-p1", Type: QMatchingInformation, GroupInstruction: "Questions 10–14: Which paragraph in Section 1 (A–E) contains the following information?", Prompt: "The price and ride-duration limits of each bike-share membership option", Options: []string{"A", "B", "C", "D", "E"}, CorrectAnswer: "A", Explanation: "Paragraph A lists the Casual Day Pass, Commuter Monthly Pass, and Annual Cargo Pass prices and durations.", ExplanationZh: "A 段列出了三种会员卡的价格与免费骑行时长。", EvidenceParagraph: "A", EvidenceQuote: "Residents and visitors may choose between three membership tiers."},
		{ID: "gt1-q13", Number: 13, PassageID: "gt1-p1", Type: QMatchingInformation, GroupInstruction: "Questions 10–14: Which paragraph in Section 1 (A–E) contains the following information?", Prompt: "The exact morning and afternoon time windows when peak rail fares are charged", Options: []string{"A", "B", "C", "D", "E"}, CorrectAnswer: "D", Explanation: "Paragraph D specifies 06:30–09:00 and 16:00–18:30 on weekdays.", ExplanationZh: "D 段列出了工作日早晚高峰的具体时间段。", EvidenceParagraph: "D", EvidenceQuote: "Peak fares apply on weekdays between 06:30–09:00 and 16:00–18:30."},
		{ID: "gt1-q14", Number: 14, PassageID: "gt1-p1", Type: QMatchingInformation, GroupInstruction: "Questions 10–14: Which paragraph in Section 1 (A–E) contains the following information?", Prompt: "Rules distinguishing folding bikes from full-size bikes on passenger trains", Options: []string{"A", "B", "C", "D", "E"}, CorrectAnswer: "E", Explanation: "Paragraph E outlines the rules for folding bikes versus full-size bikes and e-bikes.", ExplanationZh: "E 段规定了折叠车与全尺寸自行车乘车的不同要求。", EvidenceParagraph: "E", EvidenceQuote: "Folding bicycles enclosed in a carry bag are permitted on all HarbourLink services"},

		// Section 2: Q15–Q20 Sentence Completion (Type 8)
		{ID: "gt1-q15", Number: 15, PassageID: "gt1-p2", Type: QSentenceCompletion, GroupInstruction: "Questions 15–20: Complete the sentences below. Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 2.", Prompt: "Employees working over 20 hours per week are eligible for an ergonomic check within ________ of joining.", WordLimit: 2, CorrectAnswer: "30 days", AcceptableAnswers: []string{"thirty days"}, Explanation: "Paragraph A specifies 'within thirty days of onboarding'.", ExplanationZh: "A 段规定入职后 30 天内（thirty days / 30 days）可进行人体工学评估。", EvidenceParagraph: "A", EvidenceQuote: "entitled to an ergonomic assessment within thirty days of onboarding."},
		{ID: "gt1-q16", Number: 16, PassageID: "gt1-p2", Type: QSentenceCompletion, GroupInstruction: "Questions 15–20: Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 2.", Prompt: "The maximum ergonomic equipment reimbursement of $450 can be claimed once every ________.", WordLimit: 2, CorrectAnswer: "3 years", AcceptableAnswers: []string{"three years"}, Explanation: "Paragraph B states 'up to $450 once every three years'.", ExplanationZh: "B 段说明每三年（three years）最多可报销 450 美元。", EvidenceParagraph: "B", EvidenceQuote: "claim up to $450 once every three years"},
		{ID: "gt1-q17", Number: 17, PassageID: "gt1-p2", Type: QSentenceCompletion, GroupInstruction: "Questions 15–20: Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 2.", Prompt: "To claim equipment reimbursement, staff must upload itemized ________ to the Finance Portal.", WordLimit: 2, CorrectAnswer: "tax receipts", AcceptableAnswers: []string{"receipts"}, Explanation: "Paragraph B states that 'Itemized tax receipts must be uploaded to the Finance Portal'.", ExplanationZh: "B 段要求上传明细税务收据（tax receipts）。", EvidenceParagraph: "B", EvidenceQuote: "Itemized tax receipts must be uploaded to the Finance Portal within forty-five days"},
		{ID: "gt1-q18", Number: 18, PassageID: "gt1-p2", Type: QSentenceCompletion, GroupInstruction: "Questions 15–20: Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 2.", Prompt: "Northstar's 50/10 rhythm pairs 50 minutes of screen work with 10 minutes of ________ tasks.", WordLimit: 2, CorrectAnswer: "non-screen", Explanation: "Paragraph C recommends 'ten minutes of non-screen tasks'.", ExplanationZh: "C 段建议每专心工作 50 分钟后进行 10 分钟非屏幕（non-screen）活动。", EvidenceParagraph: "C", EvidenceQuote: "followed by ten minutes of non-screen tasks"},
		{ID: "gt1-q19", Number: 19, PassageID: "gt1-p2", Type: QSentenceCompletion, GroupInstruction: "Questions 15–20: Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 2.", Prompt: "Permanent staff qualify for up to five days of paid Study Leave after ________ of continuous service.", WordLimit: 2, CorrectAnswer: "12 months", AcceptableAnswers: []string{"twelve months", "1 year", "one year"}, Explanation: "Paragraph D requires 'at least twelve months of continuous service'.", ExplanationZh: "D 段规定连续工作满 12 个月（twelve months）的正式员工可申请带薪学习假。", EvidenceParagraph: "D", EvidenceQuote: "completed at least twelve months of continuous service"},
		{ID: "gt1-q20", Number: 20, PassageID: "gt1-p2", Type: QSentenceCompletion, GroupInstruction: "Questions 15–20: Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 2.", Prompt: "Study Leave applications must be approved by a ________ at least four weeks in advance.", WordLimit: 2, CorrectAnswer: "line manager", AcceptableAnswers: []string{"manager"}, Explanation: "Paragraph E requires endorsement by a 'line manager' at least four weeks prior.", ExplanationZh: "E 段规定需提前至少四周获得直属经理（line manager）批准。", EvidenceParagraph: "E", EvidenceQuote: "Study Leave requests must be endorsed by a line manager at least four weeks prior"},
		// Section 2: Q21–Q27 Multiple Choice & YNNG
		{ID: "gt1-q21", Number: 21, PassageID: "gt1-p2", Type: QMultipleChoice, GroupInstruction: "Questions 21–24: Choose the correct letter, A, B, C, or D.", Prompt: "How can remote employees complete their ergonomic workstation check?", Options: []string{"A. Only by visiting the headquarters clinic in person", "B. By booking a virtual video consultation or completing the intranet self-assessment checklist", "C. By hiring an external private physiotherapist", "D. By waiting two years after onboarding"}, CorrectAnswer: "B", AcceptableAnswers: []string{"B. By booking a virtual video consultation or completing the intranet self-assessment checklist"}, Explanation: "Paragraph A states remote and hybrid staff may book a virtual video consultation or complete the self-assessment checklist on the intranet.", ExplanationZh: "A 段说明远程和混合办公员工可预约视频咨询或填写内网自评表，故选 B。", EvidenceParagraph: "A", EvidenceQuote: "Remote and hybrid staff may book a virtual video consultation with the Occupational Health Coordinator or complete the self-assessment checklist"},
		{ID: "gt1-q22", Number: 22, PassageID: "gt1-p2", Type: QMultipleChoice, GroupInstruction: "Questions 21–24: Choose the correct letter, A, B, C, or D.", Prompt: "Which of the following is NOT accepted as proof of purchase for equipment reimbursement?", Options: []string{"A. An itemized tax receipt uploaded within 45 days", "B. A receipt for an adjustable task chair", "C. A handwritten invoice or bank statement alone", "D. A receipt for a split keyboard"}, CorrectAnswer: "C", AcceptableAnswers: []string{"C. A handwritten invoice or bank statement alone"}, Explanation: "Paragraph B states that 'handwritten invoices or bank statements alone cannot be accepted'.", ExplanationZh: "B 段明确指出手写发票或单独的银行账单不予受理，故选 C。", EvidenceParagraph: "B", EvidenceQuote: "handwritten invoices or bank statements alone cannot be accepted."},
		{ID: "gt1-q23", Number: 23, PassageID: "gt1-p2", Type: QMultipleChoice, GroupInstruction: "Questions 21–24: Choose the correct letter, A, B, C, or D.", Prompt: "Where is the staff wellness room located?", Options: []string{"A. Level 1", "B. Level 2", "C. Level 4", "D. Basement"}, CorrectAnswer: "C", AcceptableAnswers: []string{"C. Level 4"}, Explanation: "Paragraph C mentions 'stretching in the wellness room on Level 4'.", ExplanationZh: "C 段提到健康活动室位于 4 楼（Level 4），故选 C。", EvidenceParagraph: "C", EvidenceQuote: "stretching in the wellness room on Level 4."},
		{ID: "gt1-q24", Number: 24, PassageID: "gt1-p2", Type: QMultipleChoice, GroupInstruction: "Questions 21–24: Choose the correct letter, A, B, C, or D.", Prompt: "What must an employee use if they need to resit an examination for a second time?", Options: []string{"A. Paid Study Leave", "B. Sick leave", "C. Annual leave or unpaid leave", "D. Emergency leave"}, CorrectAnswer: "C", AcceptableAnswers: []string{"C. Annual leave or unpaid leave"}, Explanation: "Paragraph E states that employees who need to resit an exam must use annual leave or unpaid leave.", ExplanationZh: "E 段规定补考需使用年假或无薪假，故选 C。", EvidenceParagraph: "E", EvidenceQuote: "employees who need to resit an exam must use annual leave or unpaid leave for subsequent attempts."},
		{ID: "gt1-q25", Number: 25, PassageID: "gt1-p2", Type: QYesNoNotGiven, GroupInstruction: "Questions 25–27: Do the following statements agree with the policy in Section 2? Choose YES, NO, or NOT GIVEN.", Prompt: "Part-time staff working fifteen hours per week are automatically entitled to the $450 equipment allowance.", Options: []string{"YES", "NO", "NOT GIVEN"}, CorrectAnswer: "NO", Explanation: "Paragraph A restricts automatic entitlement to employees working 'more than twenty hours per week'.", ExplanationZh: "A 段规定每周工作超过 20 小时的员工才享有该评估与补贴资格，15 小时不符合条件，故选 NO。", EvidenceParagraph: "A", EvidenceQuote: "working more than twenty hours per week are entitled to an ergonomic assessment"},
		{ID: "gt1-q26", Number: 26, PassageID: "gt1-p2", Type: QYesNoNotGiven, GroupInstruction: "Questions 25–27: Choose YES, NO, or NOT GIVEN.", Prompt: "Study Leave can be used for a course connected to an approved internal career pathway.", Options: []string{"YES", "NO", "NOT GIVEN"}, CorrectAnswer: "YES", Explanation: "Paragraph D states the course must relate to the employee's current department or 'an approved internal career pathway'.", ExplanationZh: "D 段说明课程与当前部门或经批准的内部职业发展路径相关即可申请，故选 YES。", EvidenceParagraph: "D", EvidenceQuote: "directly related to the employee's current department or an approved internal career pathway."},
		{ID: "gt1-q27", Number: 27, PassageID: "gt1-p2", Type: QYesNoNotGiven, GroupInstruction: "Questions 25–27: Choose YES, NO, or NOT GIVEN.", Prompt: "Unused Study Leave days can be rolled over into the following calendar year.", Options: []string{"YES", "NO", "NOT GIVEN"}, CorrectAnswer: "NOT GIVEN", Explanation: "The policy mentions 'per calendar year' but does not state whether unused days can roll over.", ExplanationZh: "政策仅提及每自然年最多五天，未说明未休完的天数能否结转至次年，故选 NOT GIVEN。", EvidenceParagraph: "D", EvidenceQuote: "up to five days of paid Study Leave per calendar year."},

		// Section 3: Q28–Q40
		{ID: "gt1-q28", Number: 28, PassageID: "gt1-p3", Type: QMatchingHeadings, GroupInstruction: "Questions 28–32: Choose the correct heading for Paragraphs A–E of Section 3.", Prompt: "Paragraph A", Options: []string{"i. Why rotation and timekeeping are linked to east-west position", "ii. A naval disaster prompts a national competition", "iii. Why astronomers distrusted pendulum clocks at sea", "iv. A carpenter's miniature watch triumphantly passes its ocean trial", "v. Shifting from large sea clocks to a pocket-sized design"}, CorrectAnswer: "i", AcceptableAnswers: []string{"i. Why rotation and timekeeping are linked to east-west position"}, Explanation: "Paragraph A explains how Earth's 15-degree-per-hour rotation links longitude calculation to precise timekeeping.", ExplanationZh: "A 段解释了地球自转（每小时 15 度）如何将经度计算与精准授时联系在一起，对应 i。", EvidenceParagraph: "A", EvidenceQuote: "Because the Earth rotates 360 degrees every twenty-four hours (or fifteen degrees per hour), calculating longitude at sea required knowing the exact time"},
		{ID: "gt1-q29", Number: 29, PassageID: "gt1-p3", Type: QMatchingHeadings, GroupInstruction: "Questions 28–32: Choose the correct heading for Paragraphs A–E of Section 3.", Prompt: "Paragraph B", Options: []string{"i. Why rotation and timekeeping are linked to east-west position", "ii. A naval disaster prompts a national competition", "iii. Why astronomers distrusted pendulum clocks at sea", "iv. A carpenter's miniature watch triumphantly passes its ocean trial", "v. Shifting from large sea clocks to a pocket-sized design"}, CorrectAnswer: "ii", AcceptableAnswers: []string{"ii. A naval disaster prompts a national competition"}, Explanation: "Paragraph B describes the 1707 Isles of Scilly shipwreck and the resulting Longitude Act of 1714 with its £20,000 prize.", ExplanationZh: "B 段讲述了 1707 年舰队触礁海难促使英国议会通过 1714 年《经度法》并设立两万英镑悬赏，对应 ii。", EvidenceParagraph: "B", EvidenceQuote: "After a fleet commanded by Sir Cloudesley Shovell wrecked on the Isles of Scilly in 1707"},
		{ID: "gt1-q30", Number: 30, PassageID: "gt1-p3", Type: QMatchingHeadings, GroupInstruction: "Questions 28–32: Choose the correct heading for Paragraphs A–E of Section 3.", Prompt: "Paragraph C", Options: []string{"i. Why rotation and timekeeping are linked to east-west position", "ii. A naval disaster prompts a national competition", "iii. Why astronomers distrusted pendulum clocks at sea", "iv. A carpenter's miniature watch triumphantly passes its ocean trial", "v. Shifting from large sea clocks to a pocket-sized design"}, CorrectAnswer: "iii", AcceptableAnswers: []string{"iii. Why astronomers distrusted pendulum clocks at sea"}, Explanation: "Paragraph C explains why astronomers favoured lunar distances and why pendulum clocks failed on rolling ships.", ExplanationZh: "C 段解释了天文学家青睐月距法以及摆钟在颠簸船甲板上失效的原因，对应 iii。", EvidenceParagraph: "C", EvidenceQuote: "Pendulum clocks, the most accurate timekeepers on land, were useless on a rolling deck"},
		{ID: "gt1-q31", Number: 31, PassageID: "gt1-p3", Type: QMatchingHeadings, GroupInstruction: "Questions 28–32: Choose the correct heading for Paragraphs A–E of Section 3.", Prompt: "Paragraph D", Options: []string{"i. Why rotation and timekeeping are linked to east-west position", "ii. A naval disaster prompts a national competition", "iii. Why astronomers distrusted pendulum clocks at sea", "iv. A carpenter's miniature watch triumphantly passes its ocean trial", "v. Shifting from large sea clocks to a pocket-sized design"}, CorrectAnswer: "v", AcceptableAnswers: []string{"v. Shifting from large sea clocks to a pocket-sized design"}, Explanation: "Paragraph D traces John Harrison's progression from early sea clocks (H1–H3) to the 13 cm pocket-watch-sized H4.", ExplanationZh: "D 段记述了 John Harrison 从早期大型航海钟（H1–H3）转向 13 厘米怀表式 H4 的突破，对应 v。", EvidenceParagraph: "D", EvidenceQuote: "His breakthrough came in 1759 with H4, a large pocket-watch-sized marine chronometer"},
		{ID: "gt1-q32", Number: 32, PassageID: "gt1-p3", Type: QMatchingHeadings, GroupInstruction: "Questions 28–32: Choose the correct heading for Paragraphs A–E of Section 3.", Prompt: "Paragraph E", Options: []string{"i. Why rotation and timekeeping are linked to east-west position", "ii. A naval disaster prompts a national competition", "iii. Why astronomers distrusted pendulum clocks at sea", "iv. A carpenter's miniature watch triumphantly passes its ocean trial", "v. Shifting from large sea clocks to a pocket-sized design"}, CorrectAnswer: "iv", AcceptableAnswers: []string{"iv. A carpenter's miniature watch triumphantly passes its ocean trial"}, Explanation: "Paragraph E details H4's internal innovations and its 1761 sea trial to Jamaica losing only 5.1 seconds.", ExplanationZh: "E 段详述了 H4 的内部精密结构及其在 1761 年牙买加航海测试中 81 天仅慢 5.1 秒的辉煌表现，对应 iv。", EvidenceParagraph: "E", EvidenceQuote: "On its 1761 sea trial to Jamaica aboard HMS Deptford, H4 lost only 5.1 seconds over eighty-one days"},
		{ID: "gt1-q33", Number: 33, PassageID: "gt1-p3", Type: QSummaryCompletion, GroupInstruction: "Questions 33–36: Complete the summary of Section 3 below. Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 3.", Prompt: "Because the Earth turns by ________ every hour, sailors needed an accurate clock showing reference-meridian time.", WordLimit: 2, CorrectAnswer: "15 degrees", AcceptableAnswers: []string{"fifteen degrees"}, Explanation: "Paragraph A states the Earth rotates 'fifteen degrees per hour'.", ExplanationZh: "A 段指出地球每小时自转 15 度（fifteen degrees / 15 degrees）。", EvidenceParagraph: "A", EvidenceQuote: "Because the Earth rotates 360 degrees every twenty-four hours (or fifteen degrees per hour)"},
		{ID: "gt1-q34", Number: 34, PassageID: "gt1-p3", Type: QSummaryCompletion, GroupInstruction: "Questions 33–36: Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 3.", Prompt: "The 1714 Longitude Act offered a top reward of ________ for a method accurate to within half a degree.", WordLimit: 2, CorrectAnswer: "£20,000", AcceptableAnswers: []string{"20,000", "20000", "20,000 pounds"}, Explanation: "Paragraph B states the Act offered a top prize of £20,000.", ExplanationZh: "B 段说明头奖金额为 £20,000。", EvidenceParagraph: "B", EvidenceQuote: "offered a top prize of £20,000 for any practical method"},
		{ID: "gt1-q35", Number: 35, PassageID: "gt1-p3", Type: QSummaryCompletion, GroupInstruction: "Questions 33–36: Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 3.", Prompt: "Astronomer Nevil Maskelyne preferred the ________ method over mechanical clocks.", WordLimit: 2, CorrectAnswer: "lunar distance", Explanation: "Paragraph C notes that Maskelyne favoured the 'lunar distance' method.", ExplanationZh: "C 段说明天文学家 Maskelyne 推崇“月距”（lunar distance）法。", EvidenceParagraph: "C", EvidenceQuote: "Most astronomers on the Board, including Nevil Maskelyne, favoured the 'lunar distance' method"},
		{ID: "gt1-q36", Number: 36, PassageID: "gt1-p3", Type: QSummaryCompletion, GroupInstruction: "Questions 33–36: Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 3.", Prompt: "Inside H4, Harrison used a ________ of brass and steel to compensate for temperature changes.", WordLimit: 2, CorrectAnswer: "bimetallic strip", Explanation: "Paragraph E explains that Harrison incorporated a 'bimetallic strip' of brass and steel.", ExplanationZh: "E 段指出 Harrison 在 H4 内部采用了黄铜与钢制成的“双金属片”（bimetallic strip）来自动补偿温度变化。", EvidenceParagraph: "E", EvidenceQuote: "Harrison incorporated a bimetallic strip of brass and steel to compensate automatically for temperature changes"},
		{ID: "gt1-q37", Number: 37, PassageID: "gt1-p3", Type: QTableCompletion, GroupInstruction: "Questions 37–40: Complete the comparison notes below. Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 3.", Prompt: "Pendulum clocks failed at sea because temperature swings thickened ________.", WordLimit: 2, CorrectAnswer: "lubricating oils", AcceptableAnswers: []string{"oils"}, Explanation: "Paragraph C notes that temperature swings 'thickened lubricating oils'.", ExplanationZh: "C 段指出温度剧烈波动会使润滑油（lubricating oils）变稠。", EvidenceParagraph: "C", EvidenceQuote: "temperature swings altered the pendulum's swing and thickened lubricating oils."},
		{ID: "gt1-q38", Number: 38, PassageID: "gt1-p3", Type: QTableCompletion, GroupInstruction: "Questions 37–40: Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 3.", Prompt: "John Harrison's original profession in Yorkshire was a ________.", WordLimit: 1, CorrectAnswer: "carpenter", Explanation: "Paragraph D introduces John Harrison as a 'self-taught Yorkshire carpenter'.", ExplanationZh: "D 段介绍 John Harrison 原本是约克郡的一名木匠（carpenter）。", EvidenceParagraph: "D", EvidenceQuote: "A self-taught Yorkshire carpenter named John Harrison"},
		{ID: "gt1-q39", Number: 39, PassageID: "gt1-p3", Type: QTableCompletion, GroupInstruction: "Questions 37–40: Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 3.", Prompt: "To eliminate the need for oil, H4 used pallet jewels made of diamond and ________.", WordLimit: 1, CorrectAnswer: "ruby", Explanation: "Paragraph E mentions 'diamond and ruby pallet jewels to minimize friction without oil'.", ExplanationZh: "E 段指出 H4 使用了钻石和红宝石（ruby）擒纵叉瓦来减少摩擦。", EvidenceParagraph: "E", EvidenceQuote: "diamond and ruby pallet jewels to minimize friction without oil"},
		{ID: "gt1-q40", Number: 40, PassageID: "gt1-p3", Type: QTableCompletion, GroupInstruction: "Questions 37–40: Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from Section 3.", Prompt: "During its 81-day voyage to Jamaica in 1761, H4 lost only ________ seconds.", WordLimit: 1, CorrectAnswer: "5.1", Explanation: "Paragraph E states that 'H4 lost only 5.1 seconds over eighty-one days'.", ExplanationZh: "E 段指出 H4 在 81 天航程中仅慢了 5.1 秒。", EvidenceParagraph: "E", EvidenceQuote: "H4 lost only 5.1 seconds over eighty-one days"},
	}

	return ReadingTest{
		Slug:            "general-full-1",
		Title:           "General Training Reading Test 1: Community Transit, Workplace Policy & Marine Chronometers",
		Subtitle:        "Full 60-minute General Training simulation · 3 sections · 40 questions",
		Module:          "general",
		Category:        "full",
		Difficulty:      "Band 6.5–8.5",
		DurationSeconds: 3600,
		Passages:        []ReadingPassage{p1, p2, p3},
		Questions:       questions,
	}
}

func renumberQuestions(in []ReadingQuestion) []ReadingQuestion {
	out := make([]ReadingQuestion, len(in))
	for i, q := range in {
		q.Number = i + 1
		q.ID = fmt.Sprintf("q%d", q.Number)
		out[i] = q
	}
	return out
}

func builtinReadingTests() []ReadingTest {
	p1 := academicPassage1()
	p2 := academicPassage2()
	p3 := academicPassage3()
	fullQ := academicFullQuestions()

	acFull := ReadingTest{
		Slug:            "academic-full-1",
		Title:           "Academic Reading Test 1: Subterranean Cooling, Daylighted Rivers & Bilingual Neuroscience",
		Subtitle:        "Full 60-minute computer-delivered IELTS Academic simulation · 3 passages · 40 questions",
		Module:          "academic",
		Category:        "full",
		Difficulty:      "Band 7.0–9.0",
		DurationSeconds: 3600,
		Passages:        []ReadingPassage{p1, p2, p3},
		Questions:       fullQ,
	}

	gtFull := generalFullTest()

	// Individual Passage Practice sets
	acPassage1Set := ReadingTest{
		Slug:            "academic-passage-1",
		Title:           "Passage 1 Drill: Subterranean Cooling & Windcatchers",
		Subtitle:        "Single-passage practice · Headings, TFNG, Diagram & Short Answer (13 questions · 20 min)",
		Module:          "academic",
		Category:        "passage",
		Difficulty:      "Band 6.5–8.0",
		DurationSeconds: 1200,
		Passages:        []ReadingPassage{p1},
		Questions:       renumberQuestions(fullQ[0:13]),
	}

	acPassage2Set := ReadingTest{
		Slug:            "academic-passage-2",
		Title:           "Passage 2 Drill: Rewilding Urban Waterways",
		Subtitle:        "Single-passage practice · Matching Information, Features & Summary Completion (13 questions · 20 min)",
		Module:          "academic",
		Category:        "passage",
		Difficulty:      "Band 7.0–8.5",
		DurationSeconds: 1200,
		Passages:        []ReadingPassage{p2},
		Questions:       renumberQuestions(fullQ[13:26]),
	}

	acPassage3Set := ReadingTest{
		Slug:            "academic-passage-3",
		Title:           "Passage 3 Drill: Bilingual Executive Control",
		Subtitle:        "Single-passage practice · Multiple Choice, YNNG, Sentence Endings & Table Completion (14 questions · 20 min)",
		Module:          "academic",
		Category:        "passage",
		Difficulty:      "Band 7.5–9.0",
		DurationSeconds: 1200,
		Passages:        []ReadingPassage{p3},
		Questions:       renumberQuestions(fullQ[26:40]),
	}

	// Question Type Practice Drills
	tfngYnngQuestions := append([]ReadingQuestion{}, fullQ[5:9]...)
	tfngYnngQuestions = append(tfngYnngQuestions, fullQ[30:34]...)
	typeDrillTfng := ReadingTest{
		Slug:            "drill-tfng-ynng",
		Title:           "Question Type Drill: True/False/Not Given & Yes/No/Not Given",
		Subtitle:        "Targeted accuracy practice on distinguishing FALSE/NO from NOT GIVEN (8 questions · 12 min)",
		Module:          "academic",
		Category:        "question_type",
		Difficulty:      "Band 7.0–9.0",
		DurationSeconds: 720,
		Passages:        []ReadingPassage{p1, p3},
		Questions:       renumberQuestions(tfngYnngQuestions),
	}

	matchingQuestions := append([]ReadingQuestion{}, fullQ[0:5]...)
	matchingQuestions = append(matchingQuestions, fullQ[13:22]...)
	matchingQuestions = append(matchingQuestions, fullQ[34:37]...)
	typeDrillMatching := ReadingTest{
		Slug:            "drill-matching-all",
		Title:           "Question Type Drill: Matching Headings, Information, Features & Endings",
		Subtitle:        "Targeted scanning and paragraph-mapping practice across all 4 matching types (17 questions · 20 min)",
		Module:          "academic",
		Category:        "question_type",
		Difficulty:      "Band 7.0–8.5",
		DurationSeconds: 1200,
		Passages:        []ReadingPassage{p1, p2, p3},
		Questions:       renumberQuestions(matchingQuestions),
	}

	completionQuestions := append([]ReadingQuestion{}, fullQ[9:13]...)
	completionQuestions = append(completionQuestions, fullQ[22:26]...)
	completionQuestions = append(completionQuestions, fullQ[37:40]...)
	typeDrillCompletion := ReadingTest{
		Slug:            "drill-completion-all",
		Title:           "Question Type Drill: Diagram, Summary, Table, Sentence & Short Answer",
		Subtitle:        "Precision word-limit extraction practice across all completion formats (11 questions · 15 min)",
		Module:          "academic",
		Category:        "question_type",
		Difficulty:      "Band 6.5–8.5",
		DurationSeconds: 900,
		Passages:        []ReadingPassage{p1, p2, p3},
		Questions:       renumberQuestions(completionQuestions),
	}

	tests := []ReadingTest{
		acFull,
		gtFull,
		acPassage1Set,
		acPassage2Set,
		acPassage3Set,
		typeDrillTfng,
		typeDrillMatching,
		typeDrillCompletion,
	}
	tests = append(tests, expandedReadingTests()...)
	for i := range tests {
		tests[i].QuestionCount = len(tests[i].Questions)
		for j := range tests[i].Passages {
			words := 0
			for _, paragraph := range tests[i].Passages[j].Paragraphs {
				words += len(strings.Fields(paragraph.Text))
			}
			tests[i].Passages[j].WordCount = words
		}
	}
	return tests
}
