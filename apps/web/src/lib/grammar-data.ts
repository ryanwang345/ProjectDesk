export type GrammarCategory = 'clauses' | 'inversion' | 'tenses' | 'hedging' | 'errors'

export interface GrammarQuiz {
  id?: string
  question: string
  questionZh?: string
  options: string[]
  correctIndex: number
  explanation: string
  trapReason?: string
  bandTarget?: string
}

export interface GrammarExample {
  en: string
  zh: string
  audioText?: string
  contextTag?: string
}

export interface GrammarTopic {
  id: string
  title: string
  titleEn: string
  category: GrammarCategory
  bandTarget: string
  ieltsApplication: string
  formula: string
  summaryZh: string
  summaryEn: string
  explanationZh: string
  badExample: string
  badExampleZh: string
  badReason: string
  goodExample: string
  goodExampleZh: string
  goodUpgradeReason: string
  examples: GrammarExample[]
  quiz: GrammarQuiz
  quizzes?: GrammarQuiz[]
  examTips: string
}

export interface SentenceTemplate {
  id: string
  title: string
  taskType: 'Task 1' | 'Task 2'
  usage: string
  templateEn: string
  templateZh: string
  exampleEn: string
  exampleZh: string
  tags: string[]
}

export interface GrammarBankQuestion {
  id: string
  category: GrammarCategory
  topicId?: string
  topicTitle: string
  bandTarget: string
  difficulty: 'Foundation' | 'Advanced' | 'Master'
  question: string
  questionZh?: string
  options: string[]
  correctIndex: number
  explanation: string
  trapReason?: string
  sourceTag?: string
}

export const GRAMMAR_CATEGORIES: { id: GrammarCategory | 'all'; labelZh: string; labelEn: string; desc: string }[] = [
  { id: 'all', labelZh: '全部语法', labelEn: 'All Topics', desc: '雅思 7-9 分 Grammatical Range & Accuracy 核心要点' },
  { id: 'clauses', labelZh: '复合从句', labelEn: 'Complex Clauses', desc: '让步状语、名词性从句与定语从句的高阶应用' },
  { id: 'inversion', labelZh: '虚拟与倒装', labelEn: 'Inversion & Conditionals', desc: '否定倒装、省略 if 的虚拟条件句与让步倒装' },
  { id: 'tenses', labelZh: '时态与被动', labelEn: 'Tense & Passive', desc: '图表时态严谨性、现在完成时与学术客观被动' },
  { id: 'hedging', labelZh: '学术谨慎语气', labelEn: 'Hedging & Modality', desc: '学术客观严谨度（避免武断 absolute statement）' },
  { id: 'errors', labelZh: '写作避坑纠错', labelEn: 'Error Correction', desc: '逗号拼接、主谓一致、悬垂修饰与中式英语根治' },
]

export const GRAMMAR_TOPICS: GrammarTopic[] = [
  {
    id: 'inverted-conditionals',
    title: '虚拟语气省略倒装 (Inverted Conditionals)',
    titleEn: 'Inverted Conditionals without "If"',
    category: 'inversion',
    bandTarget: 'Band 8.0+',
    ieltsApplication: 'Task 2 政策假设、社会后果推演与反事实论证',
    formula: 'Were + S + to do... / Had + S + done... / Should + S + do...',
    summaryZh: '省略 if 将助动词 had / were / should 提前至句首，极大提升句式复杂度与正式学术质感。',
    summaryEn: 'Omitting "if" by inverting auxiliary verbs elevates syntactic maturity and formal academic register.',
    explanationZh:
      '雅思考官在评分标准 Grammatical Range 中重点关注考生能否“自然运用多种复杂句式”。在 Task 2 论证中，使用 "If governments had taken measures..." 属于常规表达，若转换为 "Had governments taken proactive measures..."，瞬间凸显学术论述力度。',
    badExample: 'If the government does not support renewable energy, climate change will get worse.',
    badExampleZh: '如果政府不支持可再生能源，气候变化就会恶化。（句式直白普通，Band 6.0 常见水准）',
    badReason: '使用最基础的 if 真实条件句，词汇与结构缺乏多样性，属于口语化直译。',
    goodExample: 'Were governments to withdraw subsidies for clean energy, global carbon reduction targets would remain largely elusive.',
    goodExampleZh: '假若各国政府取消对清洁能源的补贴，全球碳减排目标将基本化为泡影。（Band 8.5 典范）',
    goodUpgradeReason: '采用 "Were + S + to V" 倒装假设，搭配 withdraw subsidies 与 remain largely elusive，学术论述极具权威感。',
    examples: [
      {
        en: 'Had policymakers foreseen the rampant urbanization, municipal transit infrastructure would have been modernized earlier.',
        zh: '倘若政策制定者此前预见到了如此迅猛的城市化进程，市政公共交通基础设施本会更早完成现代化改造。',
        contextTag: '过去反事实推论',
      },
      {
        en: 'Should financial instability persist, underprivileged families will inevitably bear the heaviest burden.',
        zh: '万一金融动荡持续下去，弱势家庭必将首当其冲承受最沉重的负担。',
        contextTag: '将来可能性假设',
      },
      {
        en: 'Were it not for strict copyright enforcement, creative industries could scarcely flourish.',
        zh: '若非有严格的版权执法，创意产业几乎绝无繁荣的可能。',
        contextTag: '双重否定强调',
      },
    ],
    quiz: {
      question: 'Choose the correct inverted conditional sentence for academic Task 2 essay:',
      questionZh: '请为雅思 Task 2 议论文选出正确、语法规范的高分倒装虚拟句：',
      options: [
        'If had the authorities intervened promptly, the ecological catastrophe could have been averted.',
        'Had the authorities intervened promptly, the ecological catastrophe could have been averted.',
        'Did the authorities intervene promptly, the ecological catastrophe could be averted.',
        'Had the authorities intervene promptly, the ecological catastrophe would averted.',
      ],
      correctIndex: 1,
      explanation:
        '倒装条件句省略 if，直接将助动词 Had 提前至句首，主语后接过去分词 intervened：Had + S + done。选项 A 既保留了 if 又倒装属于严重语法错误；选项 C 用 did 错误；选项 D 动词形式错误。',
      trapReason: '选项 A 混淆了 if 与倒装助动词，倒装时绝不可再出现 if。',
    },
    quizzes: [
      {
        id: 'inv-1',
        question: 'Choose the correct inverted conditional sentence for academic Task 2 essay:',
        questionZh: '请为雅思 Task 2 选出正确、语法规范的倒装虚拟句：',
        options: [
          'If had the authorities intervened promptly, the ecological catastrophe could have been averted.',
          'Had the authorities intervened promptly, the ecological catastrophe could have been averted.',
          'Did the authorities intervene promptly, the ecological catastrophe could be averted.',
          'Had the authorities intervene promptly, the ecological catastrophe would averted.',
        ],
        correctIndex: 1,
        explanation: 'Had + 主语 + 过去分词，省略 if。A 项 if 与倒装共存错误；C 项 did 无法表示过去完成虚拟；D 项动词原形错误。',
      },
      {
        id: 'inv-2',
        question: 'Complete the future hypothetical sentence: "_______ subsidies be discontinued, many green startups would collapse."',
        questionZh: '补全将来推测假设句：“万一补贴中断，许多绿色初创企业恐将倒闭。”',
        options: ['If should', 'Were to', 'Should', 'Would'],
        correctIndex: 2,
        explanation: 'Should + 主语 + 动词原形（be discontinued）表示“万一……”，省略 if 时直接用 Should 开头。',
      },
      {
        id: 'inv-3',
        question: 'Which sentence correctly expresses "If it were not for modern medical breakthroughs..." in an inverted structure?',
        questionZh: '“若非现代医学取得突破……”的规范省略倒装句是哪一句？',
        options: [
          'Were it not for modern medical breakthroughs, infectious diseases would remain fatal.',
          'Was it not for modern medical breakthroughs, infectious diseases would remain fatal.',
          'Not were it for modern medical breakthroughs, infectious diseases would remain fatal.',
          'Had it not be for modern medical breakthroughs, infectious diseases would remain fatal.',
        ],
        correctIndex: 0,
        explanation: '“Were it not for + 名词”是表示“若非/要不是……”的经典倒装形式，虚拟语气中单数主语 it 也严格使用 were 而非 was。',
      },
    ],
    examTips: '在 Task 2 结论段或主体段最后一句话中，用一个倒装虚拟句提出反面警示，往往能给考官留下极佳的句式深度印象。',
  },
  {
    id: 'negative-inversion',
    title: '否定副词前置倒装 (Negative Inversion for Emphasis)',
    titleEn: 'Negative Adverbial Inversion',
    category: 'inversion',
    bandTarget: 'Band 7.5+',
    ieltsApplication: 'Task 2 强化观点深度、强调极端情况或驳斥对立论调',
    formula: 'Not only + 助动词 + S + V..., but S also... / Rarely / Seldom + 助动词 + S + V...',
    summaryZh: '将否定或半否定词（Not only, Seldom, Rarely, Under no circumstances）置于句首引发部分倒装。',
    summaryEn: 'Placing negative adverbs at the front triggers subject-auxiliary inversion, creating striking rhetorical emphasis.',
    explanationZh:
      '普通陈述句 "Technology not only broadens access, but also boosts efficiency" 虽然语法正确但平淡无奇。前置并倒装为 "Not only does technology broaden access, but it also boosts efficiency"，既展示了倒装控制力，又增强了论证力量。',
    badExample: 'Students not only can learn academic knowledge from university, but also they make many friends.',
    badExampleZh: '学生不仅可以从大学学到学术知识，而且他们还交了很多朋友。（结构松散，缺乏倒装张力）',
    badReason: '语序平铺直叙，且 but also 后面分句代词使用不紧凑。',
    goodExample: 'Not only does higher education impart specialized expertise, but it also cultivates critical analytical thinking.',
    goodExampleZh: '高等教育不仅传授专门领域的专业知识，更能切实培养批判性分析思维。（Band 8.0 规范句）',
    goodUpgradeReason: '助动词 does 提前实现部分倒装，谓语动词从基础的 learn/make 进阶为 impart expertise / cultivate critical thinking。',
    examples: [
      {
        en: 'Rarely do unmonitored subsidies deliver genuine long-term economic prosperity.',
        zh: '缺乏监管的财政补贴极少能够带来真正长期的经济繁荣。',
        contextTag: 'Seldom/Rarely 倒装',
      },
      {
        en: 'Under no circumstances should public safety be compromised for immediate commercial gain.',
        zh: '在任何情况下，公共安全都绝不应当为眼前的商业利益而妥协。',
        contextTag: '介词短语否定倒装',
      },
      {
        en: 'Hardly had the controversial regulation been enacted when public protests erupted across the capital.',
        zh: '这项备受争议的法规刚一颁布，首都各地便爆发了公众抗议。',
        contextTag: 'Hardly... when... 倒装',
      },
    ],
    quiz: {
      question: 'Which sentence correctly demonstrates negative inversion for an academic Task 2 essay?',
      questionZh: '下列哪一句正确运用了否定前置倒装且符合学术写作规范？',
      options: [
        'Seldom people consider the psychological repercussions of remote working.',
        'Seldom do people consider the psychological repercussions of remote working.',
        'Seldom are people consider the psychological repercussions of remote working.',
        'Not only people ignore this issue, but they also exacerbate it.',
      ],
      correctIndex: 1,
      explanation:
        'Seldom 置于句首时句子需进行部分倒装：Seldom + 助动词 (do/does/did) + 主语 + 实义动词原形。选项 B 语法完全正确；选项 A 和 D 缺少助动词倒装；选项 C 助动词 are 不能直接搭配实义动词原形 consider。',
    },
    quizzes: [
      {
        id: 'neg-1',
        question: 'Which sentence correctly demonstrates negative inversion for an academic Task 2 essay?',
        questionZh: '下列哪一句正确运用了否定前置倒装且符合学术写作规范？',
        options: [
          'Seldom people consider the psychological repercussions of remote working.',
          'Seldom do people consider the psychological repercussions of remote working.',
          'Seldom are people consider the psychological repercussions of remote working.',
          'Not only people ignore this issue, but they also exacerbate it.',
        ],
        correctIndex: 1,
        explanation: 'Seldom 置于句首需部分倒装：Seldom + do + 主语 + 动词原形。',
      },
      {
        id: 'neg-2',
        question: 'Identify the sentence with correct word order after "Under no circumstances":',
        questionZh: '选出 "Under no circumstances"（绝不）后语序完全正确的句子：',
        options: [
          'Under no circumstances governments should disregard public health warnings.',
          'Under no circumstances should governments disregard public health warnings.',
          'Under no circumstances should governments to disregard public health warnings.',
          'Under no circumstances governments do disregard public health warnings.',
        ],
        correctIndex: 1,
        explanation: '否定介词短语置于句首，情态动词 should 必须提前置于主语 governments 之前，后接动词原形 disregard。',
      },
    ],
    examTips: '全文使用 1-2 次否定前置倒装即可，切忌通篇频繁堆砌，确保语境自然切题。',
  },
  {
    id: 'concessive-inversion',
    title: '让步状语倒装与对比 (Concessive Inversion with As/Though)',
    titleEn: 'Concessive Inversion (Adjective/Adverb + As/Though)',
    category: 'inversion',
    bandTarget: 'Band 8.0+',
    ieltsApplication: 'Task 2 对立观点承认、反驳前置让步与论证深度展现',
    formula: 'Adj / Adv / Verb + as / though + S + may be / seem, S + V...',
    summaryZh: '将形容词或副词置于句首，紧随 as 或 though，比单纯使用 Although 更有学术张力与修辞美感。',
    summaryEn: 'Fronting the adjective or adverb with "as/though" conveys sophisticated concession in academic argumentation.',
    explanationZh:
      '承认对方观点的合理性是大作文获得高分（Band 8+ Task Achievement）的核心技巧。用 "Although the initial cost is high..." 很普通，而改用 "Formidable though the upfront expenditure may appear, the long-term ecological returns far outweigh the initial investment" 能立即拉开与 6 分考生的句式层次差距。',
    badExample: 'Although artificial intelligence is powerful, it still cannot completely replace human empathy.',
    badExampleZh: '虽然人工智能很强大，但它仍然不能完全取代人类的同理心。（句式平实无奇）',
    badReason: '单纯的 although 从句属于初中级常规句型，缺乏修辞吸引力。',
    goodExample: 'Powerful though artificial intelligence has become, it remains fundamentally incapable of replicating nuanced human empathy.',
    goodExampleZh: '尽管人工智能已变得如此强大，它在本质上依然无法复刻人类微妙复杂的情感共鸣。（Band 8.5 典范）',
    goodUpgradeReason: 'Powerful though + 倒装前置形容词，搭配 remains fundamentally incapable of replicating，论辩成熟度极高。',
    examples: [
      {
        en: 'Costly as municipal railway projects are to construct, they provide irreplaceable environmental dividends for generations.',
        zh: '尽管市政铁路项目的修建成本高昂，但它们为子孙后代带来了无可替代的环保红利。',
        contextTag: 'Costly as... 让步',
      },
      {
        en: 'Promising though this economic hypothesis may sound, its practical efficacy has yet to be corroborated.',
        zh: '尽管该经济学假说听起来前景可期，其实际成效却尚待证实。',
        contextTag: 'Promising though... 谨慎求证',
      },
    ],
    quiz: {
      question: 'Choose the correct concessive sentence utilizing "though" inversion:',
      questionZh: '请选出正确使用 though 让步前置倒装的句子：',
      options: [
        'Though formidable the task may appear, international consensus must be forged.',
        'Formidable though the task may appear, international consensus must be forged.',
        'Formidable although the task may appear, international consensus must be forged.',
        'As formidable though the task may appear, international consensus must be forged.',
      ],
      correctIndex: 1,
      explanation:
        '形容词前置让步结构中，只能用 as 或 though（Adj + as/though + S + V）；although 绝不能用在此种倒装结构中；选项 A 词序错误。',
    },
    quizzes: [
      {
        id: 'con-1',
        question: 'Choose the correct concessive sentence utilizing "though" inversion:',
        questionZh: '请选出正确使用 though 让步前置倒装的句子：',
        options: [
          'Though formidable the task may appear, international consensus must be forged.',
          'Formidable though the task may appear, international consensus must be forged.',
          'Formidable although the task may appear, international consensus must be forged.',
          'As formidable though the task may appear, international consensus must be forged.',
        ],
        correctIndex: 1,
        explanation: '形容词前置让步结构公式为：Adj + as/though + S + be/V。although 绝不可用于倒装。',
      },
      {
        id: 'con-2',
        question: 'Which of the following phrases is grammatically INCORRECT?',
        questionZh: '下列哪个让步结构在语法上是错误的？',
        options: [
          'Difficult as it is to implement...',
          'Much though I appreciate the proposal...',
          'Hard although they tried...',
          'Try as they might...',
        ],
        correctIndex: 2,
        explanation: '倒装让步结构中不能用 although，必须用 as 或 though（应为 Hard though they tried 或 Hard as they tried）。',
      },
    ],
    examTips: '注意：只有 as 和 though 可以接在形容词/副词后表示倒装让步，although 绝不能用于此类倒装！',
  },
  {
    id: 'participle-clauses',
    title: '分词短语作状语与定语 (Participle Clauses)',
    titleEn: 'Present & Past Participle Clauses',
    category: 'clauses',
    bandTarget: 'Band 7.5+',
    ieltsApplication: 'Task 1 图表趋势归因、Task 2 紧凑逻辑承接与原因补充',
    formula: 'V-ing / V-ed / Having + V3, S + V... 或 S + V..., thereby V-ing...',
    summaryZh: '使用分词短语替代冗长连词从句，精简句子结构，形成学术英语特有的紧凑高密度信息流。',
    summaryEn: 'Reduces cumbersome adverbial clauses into concise participial modifiers, achieving high lexical density.',
    explanationZh:
      '中国考生常连续使用 "Because they want to ..., so they ..." 或多个 "which leads to ... which results in ..." 导致句子冗长松垮。使用分词短语 "..., thereby creating a ripple effect" 或 "Having established a dominant market presence, ..." 可显著提升连贯与紧凑度。',
    badExample: 'The factory increased production by 20% in 2021, and this caused carbon emissions to rise sharply.',
    badExampleZh: '该工厂在 2021 年将产量提高了 20%，这导致碳排放急剧增加。（典型的 and this caused 串联低分句）',
    badReason: '用 and this caused 串联句子，缺乏主从逻辑层级，属于雅思 5.5-6.0 典型特征。',
    goodExample: 'The factory augmented output by 20% in 2021, thereby precipitating a sharp surge in carbon emissions.',
    goodExampleZh: '该工厂于 2021 年将产量扩大了 20%，从而诱发了碳排放量的剧烈攀升。（Band 8.0 规范句）',
    goodUpgradeReason: '使用 ", thereby precipitating..." 现在分词短语做自然结果状语，语意衔接紧密连贯。',
    examples: [
      {
        en: 'Viewed from a socio-economic vantage point, mandatory community service instills civic responsibility in adolescents.',
        zh: '从社会经济学的视角来看，强制性社区服务能向青少年灌输公民责任感。',
        contextTag: '过去分词做状语',
      },
      {
        en: 'Having depleted domestic oil reserves, several developing nations were forced to rely on imported natural gas.',
        zh: '在国内石油储量枯竭之后，若干发展中国家被迫依赖进口天然气。',
        contextTag: '现在完成分词表示先后',
      },
      {
        en: 'The government unveiled an ambitious subsidy package, aiming to accelerate the transition towards green energy.',
        zh: '政府推出了一项雄心勃勃的补贴计划，旨在加速向绿色能源的转型。',
        contextTag: '现在分词伴随目的状语',
      },
    ],
    quiz: {
      question: 'Identify the grammatically flawless sentence with a participle clause:',
      questionZh: '请找出带有分词从句且语法完全正确的学术句子：',
      options: [
        'Having evaluated the experimental data, the hypothesis was confirmed by the scientists.',
        'Having evaluated the experimental data, the scientists confirmed the hypothesis.',
        'Evaluating the experimental data, the hypothesis confirmed.',
        'After evaluated the experimental data, the scientists confirmed the hypothesis.',
      ],
      correctIndex: 1,
      explanation:
        '选项 A 存在悬垂修饰错误（Dangling Modifier）：逻辑主语是 scientists 而非 hypothesis，不能让 hypothesis 作为主语去 evaluate 数据。选项 B 逻辑主语一致且语态正确；选项 D 中 after 作为介词后面需接 having evaluated 或 evaluating。',
    },
    quizzes: [
      {
        id: 'par-1',
        question: 'Identify the grammatically flawless sentence with a participle clause:',
        questionZh: '请找出带有分词从句且语法完全正确的学术句子：',
        options: [
          'Having evaluated the experimental data, the hypothesis was confirmed by the scientists.',
          'Having evaluated the experimental data, the scientists confirmed the hypothesis.',
          'Evaluating the experimental data, the hypothesis confirmed.',
          'After evaluated the experimental data, the scientists confirmed the hypothesis.',
        ],
        correctIndex: 1,
        explanation: '分词短语的逻辑主语必须与主句主语（scientists）一致，严防悬垂修饰。',
      },
      {
        id: 'par-2',
        question: 'Choose the sentence that correctly uses ", thereby + V-ing" for Task 1 data analysis:',
        questionZh: '选出在 Task 1 图表描述中正确使用 ", thereby + V-ing" 的句子：',
        options: [
          'Passenger numbers dipped markedly in 2020, thereby precipitated widespread transport deficits.',
          'Passenger numbers dipped markedly in 2020, thereby precipitating widespread transport deficits.',
          'Passenger numbers dipped markedly in 2020, thereby precipitate widespread transport deficits.',
          'Passenger numbers dipped markedly in 2020, thereby to precipitate widespread transport deficits.',
        ],
        correctIndex: 1,
        explanation: 'thereby（借此/从而）是副词，在分句后做连带结果状语时，必须紧接现在分词 precipitating。',
      },
    ],
    examTips: '写作中使用分词短语时，务必检查分词的逻辑主语是否与主句的主语一致，严防考官扣分的悬垂修饰（Dangling Participle）。',
  },
  {
    id: 'absolute-construction',
    title: '独立主格结构 (Absolute Nominative Construction)',
    titleEn: 'Absolute Constructions for Dense Academic Packaging',
    category: 'clauses',
    bandTarget: 'Band 8.5+',
    ieltsApplication: 'Task 2 背景铺垫、原因附带说明与高信息密度论述',
    formula: '名词/代词 + 分词(doing/done) / 形容词 / 介词短语, S + V...',
    summaryZh: '拥有自身独立逻辑主语的非谓语短语，不依赖主句主语，能在单句中优雅凝练地包容多维背景。',
    summaryEn: 'An autonomous non-finite phrase with its own head noun, packaging circumstantial backdrop with exceptional economy.',
    explanationZh:
      '一般考生写两个原因时会用 "Because resources are limited, and because demand is rising, governments must..."。运用独立主格结构简化为 "Resources being finite and consumer demand escalating, governments are compelled to ration supplies."，语篇密度与学术凝练感立即拉满。',
    badExample: 'Because the global population is expanding rapidly, so food security has become an urgent concern.',
    badExampleZh: '因为全球人口迅速膨胀，所以粮食安全已成为紧迫关切。（because 和 so 连用，中式英语常见错误）',
    badReason: '连词冗余（because ... so ...），句式松散。',
    goodExample: 'Global population expanding at an unprecedented pace, sustainable food production has emerged as a paramount geopolitical concern.',
    goodExampleZh: '全球人口正以前所未有的速度急剧扩张，可持续粮食生产已上升为至关重要的地缘政治关切。（独立主格示范）',
    goodUpgradeReason: '"Global population expanding..." 构成独立主格，无多余连词，行文洗练有力。',
    examples: [
      {
        en: 'All considerations factored into the decision, transitioning to nuclear power remains the most viable pathway.',
        zh: '将所有考量因素权衡在内，转向核电依然是最切实可行的路径。',
        contextTag: '过去分词独立主格',
      },
      {
        en: 'The technological hurdles overcome, automated vehicles will rapidly transform urban logistics.',
        zh: '一旦技术瓶颈得以突破，自动驾驶车辆将迅速重塑城市物流格局。',
        contextTag: '条件/时间独立主格',
      },
    ],
    quiz: {
      question: 'Which of the following exhibits a legitimate absolute construction?',
      questionZh: '下列哪句话包含了规范成立的“独立主格”结构？',
      options: [
        'Weather permitting, the municipal park will host the environmental summit.',
        'Being fine weather, the municipal park will host the environmental summit.',
        'Because the weather permitting, the park will host the summit.',
        'Weather is permitted, the park will host the summit.',
      ],
      correctIndex: 0,
      explanation:
        '选项 A 是经典独立主格 "Weather permitting"（名词 Weather + 现在分词 permitting，逻辑主语是 weather 而非 park）。选项 B 是典型的悬垂分词错误（主语变成了 park）；选项 C 连词 because 后不能直接跟非谓语；选项 D 逗号连接两个独立完整谓语形成逗号拼接。',
    },
    quizzes: [
      {
        id: 'abs-1',
        question: 'Which of the following exhibits a legitimate absolute construction?',
        questionZh: '下列哪句话包含了规范成立的“独立主格”结构？',
        options: [
          'Weather permitting, the municipal park will host the environmental summit.',
          'Being fine weather, the municipal park will host the environmental summit.',
          'Because the weather permitting, the park will host the summit.',
          'Weather is permitted, the park will host the summit.',
        ],
        correctIndex: 0,
        explanation: 'Weather permitting 独立主格，天气是 permitting 的施动者，独立于主句主语 park。',
      },
    ],
    examTips: '独立主格是冲刺写作 8.5+ 的加分利器，整篇大作文用 1 次即可震撼考官，切忌生搬硬套。',
  },
  {
    id: 'cleft-sentences',
    title: '强调裂句结构 (Cleft Sentences for Focus)',
    titleEn: 'It-Clefts & Wh-Clefts',
    category: 'clauses',
    bandTarget: 'Band 8.0+',
    ieltsApplication: 'Task 2 核心根源定位、关键归因与有力反驳',
    formula: 'It is/was [焦点内容] that/who... / What [主语] truly requires is [核心内容]',
    summaryZh: '通过 It-cleft 或 Wh-cleft 将论点核心聚焦提炼，明确指出问题症结所在。',
    summaryEn: 'Splits a single clause into two sections to foreground critical arguments or identify root causes.',
    explanationZh:
      '当你想强调“正是缺乏自律而非设备问题导致了失败”，普通句表达为 "Lack of discipline causes failure, not devices"。转换为强调句 "It is the deficiency in self-discipline rather than the inadequacy of equipment that precipitates failure"，论证力量与考官关注度截然不同。',
    badExample: 'Poverty causes high crime rates in urban areas, not the police shortage.',
    badExampleZh: '是贫困导致了城市地区的高犯罪率，而不是警力短缺。（口头直述句）',
    badReason: '语法平淡，无法在书面语中传达坚定的修辞焦点与逻辑对比。',
    goodExample: 'It is socio-economic deprivation rather than lenient sentencing that underpins the resurgence of urban crime.',
    goodExampleZh: '正是社会经济层面的贫困匮乏而非宽松的量刑尺度，构成了城市犯罪死灰复燃的根本诱因。（Band 8.5 典范）',
    goodUpgradeReason: '采用 It is ... rather than ... that ... 经典对比裂句结构，用词精准深刻。',
    examples: [
      {
        en: 'What modern societies urgently necessitate is not more superficial legislation, but rigorous enforcement mechanisms.',
        zh: '现代社会当务之急所需的并非更多浮于表面的法条，而是严密的执行机制。',
        contextTag: 'Wh-裂句强调核心诉求',
      },
      {
        en: 'It was the proliferation of online misinformation that eroded public trust in institutional guidelines.',
        zh: '正是网络虚假信息的泛滥成灾，蚕食了公众对权威机构指导方针的信任。',
        contextTag: 'It-cleft 历史归因强调',
      },
    ],
    quiz: {
      question: 'Which of the following sentences correctly utilizes an It-cleft structure?',
      questionZh: '下列哪个句子正确运用了 It-cleft 分裂强调句结构？',
      options: [
        'It is the lack of municipal funding which leads directly to the collapse of public transit.',
        'It is the lack of municipal funding that leads directly to the collapse of public transit.',
        'It is the lack of municipal funding what leads directly to the collapse of public transit.',
        'That is the lack of municipal funding that leads directly to the collapse of public transit.',
      ],
      correctIndex: 1,
      explanation:
        '标准的 It-cleft 强调句式为：It + be动词 + 被强调成分 + that + 其它成分（强调人时可用 who）。规范学术英语中应优先使用 that；which 在强调句中被普遍视为不规范用法；what 和 that 引导词混淆更属严重错误。',
    },
    quizzes: [
      {
        id: 'cle-1',
        question: 'Which of the following sentences correctly utilizes an It-cleft structure?',
        questionZh: '下列哪个句子正确运用了 It-cleft 分裂强调句结构？',
        options: [
          'It is the lack of municipal funding which leads directly to the collapse of public transit.',
          'It is the lack of municipal funding that leads directly to the collapse of public transit.',
          'It is the lack of municipal funding what leads directly to the collapse of public transit.',
          'That is the lack of municipal funding that leads directly to the collapse of public transit.',
        ],
        correctIndex: 1,
        explanation: 'It is ... that ... 强调句中，引导词必须为 that，不得用 which 或 what。',
      },
    ],
    examTips: '在主体段末尾提炼论点原因时使用强调句，能清晰明了地向考官传递论证落脚点。',
  },
  {
    id: 'hedging-modality',
    title: '学术谨慎语气与限制性修饰 (Hedging & Modality)',
    titleEn: 'Academic Hedging and Cautious Language',
    category: 'hedging',
    bandTarget: 'Band 7.5+',
    ieltsApplication: 'Task 2 论述客观性、避免武断绝对化（Band 8.0+ 关键评分考量）',
    formula: 'It would appear that... / tends to suggest... / is arguably attributable to...',
    summaryZh: '运用情态动词、模糊限定副词与虚拟试探性动词，使论证客观留有余地，符合严谨学术学术规范。',
    summaryEn: 'Mitigates overgeneralized or dogmatic assertions using modals, cautious verbs, and probability adverbs.',
    explanationZh:
      '雅思大作文最忌讳“说大话、把话说绝”，如 "All young people spend too much time on smartphones and will definitely fail their exams." 这种武断断言会直接在 Task Achievement 和 GRA 上扣分。改用 "A substantial proportion of adolescents appear to allocate disproportionate time to digital devices, which may arguably impair academic performance." 才是高分学术风范。',
    badExample: 'Social media completely ruins human relationships and always makes people depressed.',
    badExampleZh: '社交媒体完全毁了人际关系，而且总是让人抑郁。（典型的武断极端观点，中学生作文通病）',
    badReason: '使用 completely, ruins, always 等绝对化极端词汇，违反了学术议论文应有的客观谨慎准则。',
    goodExample: 'Excessive reliance on virtual interactions tends to undermine face-to-face interpersonal rapport, potentially predisposing vulnerable individuals to psychological distress.',
    goodExampleZh: '过度依赖线上虚拟互动往往会削弱面对面的社交默契，并可能使易受影响的个体更容易陷入心理困扰。（严谨学术规范）',
    goodUpgradeReason: '引入 tends to, potentially, predisposing 等缓和谨慎语词（hedges），行文沉稳中肯。',
    examples: [
      {
        en: 'The statistical correlation arguably indicates that parental involvement exerts a pivotal influence on early literacy.',
        zh: '这一统计相关性可以说在很大程度上表明，家长的参与对幼儿早期的读写能力起到了关键性影响。',
        contextTag: 'arguably 慎重论断',
      },
      {
        en: 'It is plausible to assume that automated transportation could substantially curtail traffic casualties.',
        zh: '我们有充分理由推测，自动化交通系统或将大幅削减交通事故伤亡人数。',
        contextTag: 'It is plausible to assume',
      },
    ],
    quiz: {
      question: 'Which statement exhibits appropriate academic hedging suitable for IELTS Task 2?',
      questionZh: '下列哪句话展现了适合雅思 Task 2 的学术谨慎语气（Hedging）？',
      options: [
        'AI will unquestionably eliminate every traditional clerical job within five years.',
        'The rapid integration of AI could foreseeably displace a considerable proportion of routine administrative roles.',
        'Everybody knows that AI is obviously the sole cause of future unemployment.',
        'Nobody can deny that technology will 100% replace human workforce.',
      ],
      correctIndex: 1,
      explanation:
        '选项 B 使用了 could foreseeably（可以预见地可能）和 a considerable proportion（相当比例的），符合学术谨慎性；选项 A（will unquestionably every）、C（everybody knows, sole cause）和 D（nobody can deny, 100%）均犯了极端武断的大忌。',
    },
    quizzes: [
      {
        id: 'hed-1',
        question: 'Which statement exhibits appropriate academic hedging suitable for IELTS Task 2?',
        questionZh: '下列哪句话展现了适合雅思 Task 2 的学术谨慎语气（Hedging）？',
        options: [
          'AI will unquestionably eliminate every traditional clerical job within five years.',
          'The rapid integration of AI could foreseeably displace a considerable proportion of routine administrative roles.',
          'Everybody knows that AI is obviously the sole cause of future unemployment.',
          'Nobody can deny that technology will 100% replace human workforce.',
        ],
        correctIndex: 1,
        explanation: 'could foreseeably 与 a considerable proportion 恰如其分地传达了客观推测，避免武断结论。',
      },
      {
        id: 'hed-2',
        question: 'How should the dogmatic statement "Tourism always destroys local traditions" be best revised for academic writing?',
        questionZh: '如何将武断的“旅游业总是摧毁当地传统”修改为严谨的学术论述？',
        options: [
          'Tourism 100% ruins all historical customs without doubt.',
          'Uncontrolled tourism tends to erode cultural authenticity, potentially commercializing local heritage.',
          'Everyone knows that tourism inevitably damages every single heritage site.',
          'Tourism definitely wrecks the traditions of all communities.',
        ],
        correctIndex: 1,
        explanation: '采用 tends to 与 potentially 缓和绝对语气，用 erode 和 commercialize 替换粗暴的 destroys。',
      },
    ],
    examTips: '牢记四大 Academic Hedging 利器：tends to, arguably, is plausible to assume, could potentially。',
  },
  {
    id: 'nominalization-density',
    title: '学术名词化与高密度表达 (Nominalization)',
    titleEn: 'Nominalization for Academic Register and Density',
    category: 'clauses',
    bandTarget: 'Band 8.0+',
    ieltsApplication: 'Task 1 趋势概括、Task 2 主题句提炼与论证浓缩',
    formula: '动词/形容词 -> 抽象名词短语做主语 (The rapid proliferation of... has triggered...)',
    summaryZh: '将动词、形容词或从句转化为抽象名词概念，增强句子的客观凝练感与学术密度。',
    summaryEn: 'Transforms actions and adjectives into conceptual noun phrases, elevating scholarly maturity.',
    explanationZh:
      '考官一眼就能辨别 6 分与 8 分文章的区别：6 分考生通篇是动作主体句子 "Because cities grow fast, people consume more water."；而 8 分考生善用名词化："The rapid expansion of metropolitan areas has precipitated a surge in municipal water consumption."。',
    badExample: 'Because people are living longer, governments must spend much more money to care for the elderly.',
    badExampleZh: '因为人们活得更长，所以政府必须花更多钱来照顾老人。（口语化从句串联）',
    badReason: '依靠 because 从句加常规动词 living longer / spend money，缺乏学术词汇密度。',
    goodExample: 'Demographic ageing has necessitated a substantial escalation in governmental fiscal allocations for elderly healthcare.',
    goodExampleZh: '人口老龄化必然要求政府大幅追加用于老年医疗保健的财政拨款。（名词化高阶句）',
    goodUpgradeReason: 'Demographic ageing（老龄化）作主语，escalation in allocations（拨款追加）作宾语，学术规格拉满。',
    examples: [
      {
        en: 'The rampant proliferation of social media platforms has altered cognitive processing patterns among youths.',
        zh: '社交媒体平台的迅猛蔓延已深刻改变了青少年的认知加工模式。',
        contextTag: 'proliferation 替代 grow fast',
      },
      {
        en: 'A gradual deterioration in air quality was observable across major industrial hubs.',
        zh: '在各主要工业枢纽中，均可观察到空气质量的逐步恶化。（Task 1 图表描写）',
        contextTag: 'deterioration 替代 became worse',
      },
    ],
    quiz: {
      question: 'Which revision exhibits superior academic nominalization over "When the economy deteriorated, many people lost their jobs"?',
      questionZh: '将“当经济恶化时，许多人失去了工作”提升为学术名词化表达，最佳选项是：',
      options: [
        'Because the economy became bad, unemployment happened to lots of workers.',
        'Economic deterioration precipitated a dramatic escalation in unemployment rates.',
        'When economy went down, jobs were lost by people in huge amounts.',
        'The economy being worse, losing jobs became popular.',
      ],
      correctIndex: 1,
      explanation:
        '选项 B 将动词/形容词成功提炼为 "Economic deterioration"（经济恶化）和 "escalation in unemployment rates"（失业率攀升），由及物动词 precipitated（诱发）连接，是规范的 Band 8.5 学术句。',
    },
    quizzes: [
      {
        id: 'nom-1',
        question: 'Which revision exhibits superior academic nominalization over "When the economy deteriorated, many people lost their jobs"?',
        questionZh: '将“当经济恶化时，许多人失去了工作”提升为学术名词化表达，最佳选项是：',
        options: [
          'Because the economy became bad, unemployment happened to lots of workers.',
          'Economic deterioration precipitated a dramatic escalation in unemployment rates.',
          'When economy went down, jobs were lost by people in huge amounts.',
          'The economy being worse, losing jobs became popular.',
        ],
        correctIndex: 1,
        explanation: 'Economic deterioration 与 escalation in unemployment 构成了高阶学术名词化闭环。',
      },
    ],
    examTips: '段落首句（Topic Sentence）尽量尝试用名词化短语作主语，迅速确立学术专业基调。',
  },
  {
    id: 'comma-splice-run-on',
    title: '逗号拼接与流水句纠正 (Comma Splices & Run-on Sentences)',
    titleEn: 'Eliminating Comma Splices and Run-ons',
    category: 'errors',
    bandTarget: 'Band 7.0+ 根基',
    ieltsApplication: '全卷写作严禁出现的硬伤错误（Band 6 封顶陷阱）',
    formula: 'S1 + V1; S2 + V2  或  S1 + V1, and S2 + V2  或  Although S1 + V1, S2 + V2',
    summaryZh: '严禁仅用逗号将两个完整独立的单句连接在一起，这是中国考生被直接扣分的头号元凶。',
    summaryEn: 'Never join two independent clauses with only a comma. Use semicolons, coordinating conjunctions, or subordination.',
    explanationZh:
      '汉语是“意合语言”，一个逗号可以接连串起五六个短句；但英语是“形合语言”，每个独立主谓句子必须通过连词（and, but, although）、分号（;）或从句引导词建立语法联系。出现 2 处 comma splice，考官就会将 Grammatical Accuracy 锁定在 6 分以下！',
    badExample: 'Electric cars are becoming more affordable, they produce fewer emissions than traditional gasoline vehicles.',
    badExampleZh: '电动汽车正变得越来越亲民，它们产生的排放物少于传统汽油车。（两个完整独立句子仅用一个逗号隔开，严重语法错误！）',
    badReason: '典型的 Comma Splice 逗号粘连错误，两句话主谓俱全，必须有连词或分号隔开。',
    goodExample: 'Electric cars are becoming increasingly accessible; furthermore, they generate significantly lower lifecycle emissions than conventional vehicles.',
    goodExampleZh: '电动汽车正变得日益普及亲民；此外，它们在全生命周期内产生的排放显著低于传统燃油车辆。（标准分号+连接副词）',
    goodUpgradeReason: '采用分号加转折连接副词 furthermore，或者转换为从属复合句，彻底根除拼接硬伤。',
    examples: [
      {
        en: 'While public transportation minimizes road congestion, private vehicles still offer unparalleled convenience.',
        zh: '尽管公共交通能够减少道路拥堵，但私家车依然提供着无与伦比的便利性。（从属从句修复法）',
        contextTag: '从句引导修复',
      },
      {
        en: 'The policy was met with skepticism; nevertheless, municipal authorities insisted on its phased rollout.',
        zh: '该政策遭遇了普遍怀疑；然而，市政当局依然坚持分阶段推进落地。（分号连接法）',
        contextTag: '分号与副词修复',
      },
    ],
    quiz: {
      question: 'Identify the sentence that suffers from a Comma Splice error:',
      questionZh: '请找出以下哪个句子存在“逗号拼接（Comma Splice）”语法硬伤：',
      options: [
        'Renewable energy is expanding rapidly; however, fossil fuels remain predominant in industrial sectors.',
        'Although remote learning offers temporal flexibility, it often lacks dynamic face-to-face stimulation.',
        'Tuition fees have escalated sharply in recent years, many underprivileged students cannot afford university.',
        'Governments must intervene promptly, or the environmental degradation will reach an irreversible tipping point.',
      ],
      correctIndex: 2,
      explanation:
        '选项 C 中 "Tuition fees have escalated..." 与 "many underprivileged students cannot afford..." 是两个结构完整的独立句子，仅仅使用逗号连接，属于典型的 Comma Splice；应使用分号、加连词 and/so、或用 since/because 改为原因状语从句。',
    },
    quizzes: [
      {
        id: 'cs-1',
        question: 'Identify the sentence that suffers from a Comma Splice error:',
        questionZh: '请找出以下哪个句子存在“逗号拼接（Comma Splice）”语法硬伤：',
        options: [
          'Renewable energy is expanding rapidly; however, fossil fuels remain predominant in industrial sectors.',
          'Although remote learning offers temporal flexibility, it often lacks dynamic face-to-face stimulation.',
          'Tuition fees have escalated sharply in recent years, many underprivileged students cannot afford university.',
          'Governments must intervene promptly, or the environmental degradation will reach an irreversible tipping point.',
        ],
        correctIndex: 2,
        explanation: '选项 C 仅用逗号连接两个完整独立句子，没有连词，属于典型拼接错误。',
      },
      {
        id: 'cs-2',
        question: 'Which of the following is the CORRECT way to punctuate two independent clauses joined by "however"?',
        questionZh: '用 "however" 连接两个独立分句时，标点符号完全正确的是：',
        options: [
          'Solar power is green, however it requires massive land area.',
          'Solar power is green; however, it requires massive land area.',
          'Solar power is green, however, it requires massive land area.',
          'Solar power is green however; it requires massive land area.',
        ],
        correctIndex: 1,
        explanation: 'however 是副词而非并列连词，不能用逗号连接两个主谓句。必须使用分号（; however,）或句号（. However,）。',
      },
    ],
    examTips: '写完大作文检查时，特别注意查找逗号前后是否都是完整独立句子（有独立主语和谓语动词）。若是，立即补上连词或改为分号！',
  },
  {
    id: 'subject-verb-agreement',
    title: '复杂后置修饰下的主谓一致 (Subject-Verb Agreement)',
    titleEn: 'Advanced Subject-Verb Agreement with Intervening Phrases',
    category: 'errors',
    bandTarget: 'Band 7.0+',
    ieltsApplication: '长难句、图表数据描述段及复合主语',
    formula: 'The proportion of [复数名词] + 单数谓语 (is/has) / A variety of [复数名词] + 复数谓语',
    summaryZh: '当主语中心词与谓语动词之间插入冗长定语、同位语或介词短语时，确保谓语动词紧扣中心词单复数。',
    summaryEn: 'Ensure the finite verb agrees with the true head noun rather than deceptive intervening plural modifiers.',
    explanationZh:
      '中国考生在写长句时，往往“看邻近词定单复数”。例如主语是 "The proliferation of digital entertainment options among today\'s young generations"，中心词是单数 proliferation，但紧邻谓语的是 generations，极易误写为 have 而非 has。',
    badExample: 'The number of students who study abroad have increased dramatically over the decade.',
    badExampleZh: '出国留学的学生人数在过去十年中急剧增加。（谓语动词 have 错用复数）',
    badReason: '"The number of" 的中心词是 the number（数量，单数），谓语必须用单数 has；只有 "A number of"（许多）后接复数。',
    goodExample: 'The number of undergraduates enrolled in STEM disciplines has surged precipitously across the OECD.',
    goodExampleZh: '经合组织各成员国在 STEM 学科注册就读的本科生人数已出现急剧攀升。（单数 has 准确一致）',
    goodUpgradeReason: '谓语动词 has 与真正的核心主语 the number 严格保持单数一致，长句定语不干扰主干。',
    examples: [
      {
        en: 'The pervasive dissemination of false narratives across social platforms constitutes a severe threat to social cohesion.',
        zh: '虚假言论在社交平台上的广泛传播，对社会凝聚力构成了严重威胁。（中心词 dissemination 对应单数 constitutes）',
        contextTag: '长介词修饰主语',
      },
      {
        en: 'Neither the municipal government nor the local community leaders were prepared for the scale of the flooding.',
        zh: '无论是市政府还是当地社区领袖，都未曾对这场洪水的规模做好充分准备。（就近原则 leaders -> were）',
        contextTag: 'Neither... nor... 就近原则',
      },
    ],
    quiz: {
      question: 'Select the sentence with impeccable subject-verb agreement:',
      questionZh: '请选出主谓一致完全正确、无可挑剔的学术句子：',
      options: [
        'The proportion of overseas investments allocated to renewable infrastructure have doubled.',
        'The proportion of overseas investments allocated to renewable infrastructure has doubled.',
        'A wide array of ecological initiatives was introduced by the regional commission.',
        'Every participant in these workshops are required to submit a comprehensive proposal.',
      ],
      correctIndex: 1,
      explanation:
        '选项 B 的主语核心词是 "The proportion"（单数），尽管后面跟有复数修饰成分 overseas investments，谓语动词依然必须用单数 has doubled。选项 A 错在 have；选项 C 中 a wide array of + 复数名词通常接复数 were；选项 D 中 Every participant 必须接单数 is required。',
    },
    quizzes: [
      {
        id: 'sva-1',
        question: 'Select the sentence with impeccable subject-verb agreement:',
        questionZh: '请选出主谓一致完全正确、无可挑剔的学术句子：',
        options: [
          'The proportion of overseas investments allocated to renewable infrastructure have doubled.',
          'The proportion of overseas investments allocated to renewable infrastructure has doubled.',
          'A wide array of ecological initiatives was introduced by the regional commission.',
          'Every participant in these workshops are required to submit a comprehensive proposal.',
        ],
        correctIndex: 1,
        explanation: '核心词 The proportion 是单数，中间修饰语不改变单数属性，谓语动词用 has doubled。',
      },
      {
        id: 'sva-2',
        question: 'Choose the correct verb for: "The implementation of stringent environmental policies, alongside comprehensive tax incentives, _______ essential for decarbonization."',
        questionZh: '为“严苛环保政策的推行，伴随全面的税收激励，对脱碳至关重要”选择正确动词：',
        options: ['are', 'is', 'were', 'being'],
        correctIndex: 1,
        explanation: '主语核心词是单数 "The implementation"，“alongside...”是伴随插入语，不影响主语单数，谓语动词用 is。',
      },
    ],
    examTips: '在 Task 1 描写数据时，牢记：The proportion / The percentage / The number of + 复数名词 -> 统统接单数谓语 (is / was / has)！',
  },
  {
    id: 'tense-aspect-consistency',
    title: '图表与学术论述时态严密性 (Tense & Aspect Accuracy)',
    titleEn: 'Tense & Aspect Control in Task 1 & Task 2',
    category: 'tenses',
    bandTarget: 'Band 7.5+',
    ieltsApplication: 'Task 1 图表过去时/现在完成时混合判定，Task 2 普遍真理与现存趋势',
    formula: '过去固定年份 -> 一般过去时 (rose, fell)；持续至今 -> 现在完成时 (has climbed)；普遍真理 -> 一般现在时',
    summaryZh: '杜绝时态混乱（Tense Shifting）。根据图表时间轴严格锁定基准时态，确保时态前后呼应。',
    summaryEn: 'Precise mastery over past simple for historical data vs. present perfect for continuous ongoing trends.',
    explanationZh:
      '雅思 Task 1 中，如果图表截止年份是过去（例如 2000-2020），全文必须严密锁定一般过去时（decreased, peaked）；若图表持续到当前或未注明过去年份，才使用现在完成时或一般现在时。许多考生在一个复合句内忽而过去的 fell 忽而现在的 is increasing，是考官扣减 GRA 分数的典型失误。',
    badExample: 'In 2010, the car production was 50,000, and it has risen to 80,000 by 2015, and now it drops.',
    badExampleZh: '2010 年汽车产量为 5 万辆，到 2015 年上升到 8 万辆，现在下降了。（时态随意乱跳）',
    badReason: '2015 年已经是过去的固定节点，不能用现在完成时 has risen；整句话时态缺乏统一的时间坐标基准。',
    goodExample: 'Between 2010 and 2015, automotive manufacturing expanded markedly from 50,000 to 80,000 units, before experiencing a moderate downturn in the ensuing decade.',
    goodExampleZh: '2010 年至 2015 年间，汽车制造业大幅扩张，从 50,000 辆增至 80,000 辆，随后在接下来的十年中经历了温和下滑。（统一过去时态序列）',
    goodUpgradeReason: '全句以过去时间为锚点，谓语动词 expanded 与非谓语 before experiencing 严谨契合。',
    examples: [
      {
        en: 'Over the preceding two decades, domestic expenditure on tertiary education has risen by an unprecedented 45%.',
        zh: '在过去的二十年间，国内的高等教育支出增长了前所未有的 45%。（持续至今的区间用现在完成时）',
        contextTag: 'Over the past... 现在完成时',
      },
      {
        en: 'By the time the new tax legislation was enacted in 2018, corporate revenues had already dwindled significantly.',
        zh: '到 2018 年新税法颁布之时，企业营收早已大幅缩水。（过去的过去用过去完成时）',
        contextTag: 'By the time... 过去完成时',
      },
    ],
    quiz: {
      question: 'Which sentence correctly reflects Task 1 reporting standards for historical data (e.g. 2005-2020)?',
      questionZh: '下列哪句话符合雅思 Task 1 历史数据（2005-2020 年）的标准学术时态规范？',
      options: [
        'The consumption of fossil fuels fluctuates between 2005 and 2010, and then it has declined sharply.',
        'The consumption of fossil fuels fluctuated between 2005 and 2010, after which it declined sharply.',
        'The consumption of fossil fuels had fluctuated between 2005 and 2010, after which it has declined sharply.',
        'The consumption of fossil fuels was fluctuating between 2005 and 2010, and now it declined sharply.',
      ],
      correctIndex: 1,
      explanation:
        '在 2005-2010 等明确已逝去的时间段内，图表动作应采用一般过去时（fluctuated, declined）。选项 B 时态一致严密；选项 A 和 C 误用了现在完成时 has declined，选项 D 过去进行时和 now 混搭极其混乱。',
    },
    quizzes: [
      {
        id: 'ten-1',
        question: 'Which sentence correctly reflects Task 1 reporting standards for historical data (e.g. 2005-2020)?',
        questionZh: '下列哪句话符合雅思 Task 1 历史数据（2005-2020 年）的标准学术时态规范？',
        options: [
          'The consumption of fossil fuels fluctuates between 2005 and 2010, and then it has declined sharply.',
          'The consumption of fossil fuels fluctuated between 2005 and 2010, after which it declined sharply.',
          'The consumption of fossil fuels had fluctuated between 2005 and 2010, after which it has declined sharply.',
          'The consumption of fossil fuels was fluctuating between 2005 and 2010, and now it declined sharply.',
        ],
        correctIndex: 1,
        explanation: '历史区间数据（2005-2010）严格统一使用一般过去时（fluctuated, declined）。',
      },
      {
        id: 'ten-2',
        question: 'Complete the sentence with correct tense: "Since the introduction of strict emission quotas in 2015, urban smog levels _______ noticeably."',
        questionZh: '补全句子时态：“自 2015 年实行严格排污配额以来，城市雾霾程度已显著下降。”',
        options: ['fell', 'have dropped', 'had dropped', 'drop'],
        correctIndex: 1,
        explanation: 'Since + 过去时间点，主句动作持续至今，必须用现在完成时 have dropped。',
      },
    ],
    examTips: '拿到 Task 1 题目第一件事：圈出时间跨度！只要截止年份在今天以前，整篇主体分析必须全篇用一般过去时。',
  },
]

export const BAND_NINE_TEMPLATES: SentenceTemplate[] = [
  {
    id: 'tpl-concession',
    title: '对立观点让步与有力反驳 (Concession & Rebuttal)',
    taskType: 'Task 2',
    usage: '议论文主体段第 1 句或转折论证',
    templateEn: 'While proponents convincingly argue that [对立观点], empirical evidence suggests that [我方核心论点].',
    templateZh: '尽管支持者令人信服地主张……，但实证依据表明……。',
    exampleEn: 'While proponents convincingly argue that nuclear power offers virtually zero greenhouse emissions, empirical evidence suggests that the unresolved hazards of radioactive waste disposal pose unacceptable risks.',
    exampleZh: '尽管支持者令人信服地主张核能几乎不产生温室气体排放，但实证依据表明，放射性废料处置这一未决隐患带来了不可接受的风险。',
    tags: ['让步', '转折', 'Task 2 主体段'],
  },
  {
    id: 'tpl-inverted-consequence',
    title: '政策失察警示性反推 (Inverted Policy Warning)',
    taskType: 'Task 2',
    usage: '大作文结论段或论证末尾强调紧迫性',
    templateEn: 'Were policymakers to turn a blind eye to [核心问题], the ramifications for [受影响主体] would be both profound and irreversible.',
    templateZh: '假若政策制定者对……视而不见，其给……造成的负面恶果将既深远且不可逆转。',
    exampleEn: 'Were policymakers to turn a blind eye to escalating mental health crises among adolescents, the ramifications for societal productivity would be both profound and irreversible.',
    exampleZh: '假若政策制定者对青少年中日益加剧的心理健康危机视而不见，其对整个社会生产力造成的负面恶果将既深远且不可逆转。',
    tags: ['倒装虚拟', '结论段升华', 'Band 8+'],
  },
  {
    id: 'tpl-task1-divergence',
    title: '图表两项趋势鲜明对立对比 (Task 1 Marked Divergence)',
    taskType: 'Task 1',
    usage: '数据描述大作文对比段落首句',
    templateEn: 'A marked divergence was discernible between [主体A], which experienced a steep trajectory, and [主体B], which stagnated at [数据].',
    templateZh: '在……与……之间可明显观察到截然相反的走势，前者呈现急剧攀升轨迹，而后者则停滞在……。',
    exampleEn: 'A marked divergence was discernible between renewable power investment, which experienced a steep upward trajectory, and fossil fuel exploration, which stagnated at roughly 12 billion dollars.',
    exampleZh: '在可再生能源投资与传统化石燃料勘探之间可以清晰观察到截然相反的走势，前者呈现急剧攀升的强劲轨迹，而后者则停滞在约 120 亿美元的低谷。',
    tags: ['Task 1 图表', '对比对照', '高分句型'],
  },
  {
    id: 'tpl-cleft-root-cause',
    title: '问题根本成因深度剖析 (It-Cleft for Root Cause)',
    taskType: 'Task 2',
    usage: '原因分析型（Causes & Solutions）主体段',
    templateEn: 'It is not so much [表面原因] as [根本深层原因] that has precipitated [消极现状].',
    templateZh: '导致……严峻局面的，与其说是……，不如说是……。',
    exampleEn: 'It is not so much technological inadequacy as the persistent deficit in civic awareness that has precipitated urban recycling failures.',
    exampleZh: '导致城市垃圾分类回收遭遇挫败的，与其说是技术手段的不足，不如说是公众公民意识的持续欠缺。',
    tags: ['强调裂句', '深层归因', 'Band 8+'],
  },
  {
    id: 'tpl-concessive-though',
    title: '形容词前置让步句式 (Concessive Fronting)',
    taskType: 'Task 2',
    usage: '让步段转折核心句或反方观点承认',
    templateEn: 'Formidable though [问题/困难] may appear, it is by no means [无法克服的].',
    templateZh: '尽管……显得艰巨异常，但它绝非……。',
    exampleEn: 'Formidable though the financial hurdles of global reforestation may appear, they are by no means insurmountable when international co-financing is secured.',
    exampleZh: '尽管全球重新造林的资金障碍显得艰巨异常，但一旦获得国际联合融资支持，这些阻碍绝非不可逾越。',
    tags: ['让步倒装', '修辞前置', 'Band 8.5'],
  },
  {
    id: 'tpl-nominalized-driver',
    title: '学术名词化深层驱动句 (Nominalized Driver)',
    taskType: 'Task 2',
    usage: '议论文主体段主题句',
    templateEn: 'The inexorable expansion of [核心趋势] has acted as a primary catalyst for [后续结果].',
    templateZh: '……势不可挡的扩张，已成为引发……的主要催化剂。',
    exampleEn: 'The inexorable expansion of artificial intelligence algorithms has acted as a primary catalyst for the widespread restructuring of modern white-collar employment.',
    exampleZh: '人工智能算法势不可挡的扩张，已成为推动现代白领就业结构全面重组的主要催化剂。',
    tags: ['名词化', '主题句', 'Band 8+'],
  },
]

// Dedicated comprehensive question bank for IELTS Grammar
export const GRAMMAR_QUESTION_BANK: GrammarBankQuestion[] = [
  {
    id: 'qb-1',
    category: 'inversion',
    topicId: 'inverted-conditionals',
    topicTitle: '省略 If 倒装虚拟',
    bandTarget: 'Band 8.0+',
    difficulty: 'Advanced',
    question: 'Choose the most academically rigorous sentence to express an unreal past condition:',
    questionZh: '选择最具学术严谨性的句子来表达过去反事实虚拟假设：',
    options: [
      'If the authorities had enacted the carbon quota earlier, emission levels would have declined.',
      'Had the authorities enacted the carbon quota earlier, emission levels would have declined.',
      'Had the authorities enacted the carbon quota earlier, emission levels will have declined.',
      'Did the authorities enact the carbon quota earlier, emission levels could decline.',
    ],
    correctIndex: 1,
    explanation: '“Had + S + done, S + would have done”是学术写作中最纯正的过去虚拟倒装结构。A 项语法正确但较为常规；C 项主句时态错用 will；D 项 did 无法表示对过去的假设。',
    trapReason: '不要混淆虚拟语气主句的 would have done 与从句的 Had + done。',
  },
  {
    id: 'qb-2',
    category: 'inversion',
    topicId: 'negative-inversion',
    topicTitle: '否定副词前置倒装',
    bandTarget: 'Band 8.0+',
    difficulty: 'Advanced',
    question: 'Select the sentence with accurate negative inversion word order:',
    questionZh: '选择否定词前置后语序完全正确的句子：',
    options: [
      'Rarely technological innovations provide completely risk-free remedies to socio-economic dilemmas.',
      'Rarely do technological innovations provide completely risk-free remedies to socio-economic dilemmas.',
      'Rarely are technological innovations provide completely risk-free remedies to socio-economic dilemmas.',
      'Rarely technological innovations do provide completely risk-free remedies to socio-economic dilemmas.',
    ],
    correctIndex: 1,
    explanation: '否定/半否定副词 Rarely 居首时，句子采用一般疑问句语序：Rarely + 助动词 do + 复数主语 + 实义动词原形 provide。',
    trapReason: 'C 选项错误使用了系动词 are 搭配实义动词原形 provide。',
  },
  {
    id: 'qb-3',
    category: 'inversion',
    topicId: 'concessive-inversion',
    topicTitle: '形容词前置让步倒装',
    bandTarget: 'Band 8.5+',
    difficulty: 'Master',
    question: 'Which sentence correctly demonstrates fronted adjective concession for Task 2 rebuttal?',
    questionZh: '哪句话正确展示了用于 Task 2 驳论的形容词前置让步倒装？',
    options: [
      'Although compelling the argument seems, empirical evidence tells another story.',
      'Compelling though the argument seems, empirical evidence points to a contradictory conclusion.',
      'Compelling although the argument seems, empirical evidence points to a contradictory conclusion.',
      'As compelling although the argument seems, empirical evidence contradicts it.',
    ],
    correctIndex: 1,
    explanation: '让步倒装中，形容词前置结构只能搭配 though 或 as（Adj + though/as + S + V）；although 绝不能用于倒装！',
    trapReason: '考生常习惯性使用 although 进行倒装，这是学术英语中的严重禁忌。',
  },
  {
    id: 'qb-4',
    category: 'clauses',
    topicId: 'participle-clauses',
    topicTitle: '分词悬垂修饰规避',
    bandTarget: 'Band 7.5+',
    difficulty: 'Foundation',
    question: 'Which sentence AVOIDS the critical Dangling Participle error?',
    questionZh: '下列哪个句子彻底避免了考官零容忍的“悬垂分词修饰（Dangling Modifier）”错误？',
    options: [
      'Walking through the dilapidated neighborhood, widespread infrastructural decay was observed by the inspectors.',
      'Walking through the dilapidated neighborhood, the inspectors observed widespread infrastructural decay.',
      'Having arrived in the metropolitan city, the high living costs shocked the international students.',
      'To improve academic performance, daily revision should be practiced by schools.',
    ],
    correctIndex: 1,
    explanation: '选项 B 的分词 Walking 逻辑主语是 inspectors，与主句主语严格契合。A 句主语是 decay（衰落无法自己走路）；C 句主语是 living costs（生活成本不能自己到达城市）。',
    trapReason: '中文没有分词悬垂概念，考生经常误用被动语态让非生物主语承接动作分词。',
  },
  {
    id: 'qb-5',
    category: 'clauses',
    topicId: 'cleft-sentences',
    topicTitle: 'It-Cleft 强调句',
    bandTarget: 'Band 8.0+',
    difficulty: 'Advanced',
    question: 'Choose the grammatically authentic cleft structure emphasizing the root cause:',
    questionZh: '选择强调根本原因的规范分裂句（It-Cleft）：',
    options: [
      'It is a chronic deficit in educational investment that perpetuates the cycle of generational poverty.',
      'It is a chronic deficit in educational investment which perpetuates the cycle of generational poverty.',
      'It is a chronic deficit in educational investment what perpetuates the cycle of generational poverty.',
      'That is a chronic deficit in educational investment that perpetuates the cycle of generational poverty.',
    ],
    correctIndex: 0,
    explanation: '规范 It 强调句式为：It + is + 被强调成分 + that。规范书面语中强调事物必须用 that 而非 which 或 what。',
  },
  {
    id: 'qb-6',
    category: 'clauses',
    topicId: 'absolute-construction',
    topicTitle: '独立主格结构',
    bandTarget: 'Band 8.5+',
    difficulty: 'Master',
    question: 'Identify the grammatically impeccable sentence featuring an absolute construction:',
    questionZh: '识别含有无可挑剔“独立主格”的学术句子：',
    options: [
      'The subsidies being slashed by the treasury, renewable power producers struggled to maintain profitability.',
      'Being slashed the subsidies by the treasury, renewable power producers struggled.',
      'Because the subsidies being slashed, renewable producers struggled.',
      'The subsidies were slashed by the treasury, renewable power producers struggled.',
    ],
    correctIndex: 0,
    explanation: '选项 A 中 "The subsidies being slashed by the treasury" 名词加分词构成完整独立主格；D 选项是逗号拼接两个谓语。',
  },
  {
    id: 'qb-7',
    category: 'hedging',
    topicId: 'hedging-modality',
    topicTitle: '学术谨慎语气',
    bandTarget: 'Band 7.5+',
    difficulty: 'Foundation',
    question: 'Identify the sentence that conforms to academic modesty by eliminating absolute overstatements:',
    questionZh: '找出消除武断极端用词、完全符合学术客观谨慎度的句子：',
    options: [
      'Video games are 100% the sole reason children become violent.',
      'Excessive exposure to violent interactive media may arguably predispose impressionable youths to aggressive behavior.',
      'Every parent definitely knows that smartphones completely ruin adolescent mental health.',
      'There is no doubt whatsoever that artificial intelligence will eliminate all human workers.',
    ],
    correctIndex: 1,
    explanation: '选项 B 使用了 may arguably（可以有根据地认为）和 predispose（使倾向于），客观留有余地，是 Band 8.5 学术范文的典型笔触。',
  },
  {
    id: 'qb-8',
    category: 'hedging',
    topicId: 'hedging-modality',
    topicTitle: '限制性情态表达',
    bandTarget: 'Band 8.0+',
    difficulty: 'Advanced',
    question: 'Which phrase is the most appropriate academic hedge to replace "prove"?',
    questionZh: '在学术写作中，替换过于绝对的“prove（证明）”最适宜的谨慎动词组合是：',
    options: ['completely demonstrate', 'lend credence to the hypothesis that', 'guarantee that', 'certify 100% that'],
    correctIndex: 1,
    explanation: '“lend credence to the hypothesis that...”（为……假说提供了可信度依据）是高阶学术论文中最经典的谨慎论断措辞。',
  },
  {
    id: 'qb-9',
    category: 'errors',
    topicId: 'comma-splice-run-on',
    topicTitle: '避免逗号拼接',
    bandTarget: 'Band 7.0+',
    difficulty: 'Foundation',
    question: 'Which of the following is PUNCTUATION-FLAWLESS and avoids comma splices?',
    questionZh: '下列哪句话标点完全正确，彻底杜绝了逗号拼接硬伤？',
    options: [
      'Global temperatures continue to climb, glaciers are shrinking at unprecedented rates.',
      'Global temperatures continue to climb; consequently, glaciers are receding at an unprecedented velocity.',
      'Global temperatures continue to climb, consequently glaciers are receding.',
      'Global temperatures continue to climb, therefore glaciers are receding.',
    ],
    correctIndex: 1,
    explanation: 'consequently 与 therefore 是连接副词，不能充当并列连词连接两个主谓独立句。必须使用分号（; consequently,）或句号。',
    trapReason: '国内考生常误将 therefore, however, consequently 当作 and/but 连词使用，仅用逗号连接导致严重失分。',
  },
  {
    id: 'qb-10',
    category: 'errors',
    topicId: 'subject-verb-agreement',
    topicTitle: '数据短语主谓一致',
    bandTarget: 'Band 7.0+',
    difficulty: 'Foundation',
    question: 'For IELTS Task 1 data reporting, choose the sentence with correct subject-verb agreement:',
    questionZh: '在 Task 1 图表描述中，选出主谓一致完全正确的句子：',
    options: [
      'The proportion of household budgets devoted to leisure activities have risen steadily.',
      'The proportion of household budgets devoted to leisure activities has risen steadily.',
      'A vast majority of rural commuters prefers private transport over rail.',
      'The number of international tourists visiting historical landmarks were 5 million.',
    ],
    correctIndex: 1,
    explanation: 'The proportion of... 的核心词是 The proportion（单数），尽管修饰语 budgets 是复数，谓语动词依然用单数 has risen。',
  },
  {
    id: 'qb-11',
    category: 'errors',
    topicId: 'subject-verb-agreement',
    topicTitle: '插话成分主谓一致',
    bandTarget: 'Band 7.5+',
    difficulty: 'Advanced',
    question: 'Complete the sentence: "The mayor, accompanied by several urban planning delegates, _______ scheduled to deliver the keynote address."',
    questionZh: '补全句子：“市长在数位城市规划代表的陪同下，定于今日发表主旨演讲。”',
    options: ['are', 'is', 'were', 'have been'],
    correctIndex: 1,
    explanation: 'accompanied by... 是伴随介词短语，真正的主语只有单数 The mayor，谓语动词必须用单数 is。',
  },
  {
    id: 'qb-12',
    category: 'tenses',
    topicId: 'tense-aspect-consistency',
    topicTitle: 'Task 1 图表过去时态纯正性',
    bandTarget: 'Band 7.0+',
    difficulty: 'Foundation',
    question: 'A line graph shows carbon emissions from 1990 to 2015. Which sentence is grammatically correct?',
    questionZh: '折线图显示 1990 至 2015 年间的碳排放。哪句话符合纯正学术时态？',
    options: [
      'Between 1990 and 2005, industrial emissions rose noticeably, after which they have dropped.',
      'Between 1990 and 2005, industrial emissions rose noticeably, after which they plummeted to an all-time low in 2015.',
      'Between 1990 and 2005, industrial emissions have risen noticeably, before dropping in 2015.',
      'Between 1990 and 2005, industrial emissions rise noticeably, and then decreased.',
    ],
    correctIndex: 1,
    explanation: '整个图表时间段（1990-2015）全在过去，全文必须严格保持一般过去时（rose, plummeted），绝不能混入现在完成时或一般现在时。',
  },
  {
    id: 'qb-13',
    category: 'tenses',
    topicId: 'tense-aspect-consistency',
    topicTitle: '现在完成时适用情境',
    bandTarget: 'Band 7.5+',
    difficulty: 'Advanced',
    question: 'Which sentence correctly utilizes the present perfect aspect in an essay introduction?',
    questionZh: '大作文开头段引入时代背景时，哪句话正确使用了现在完成时？',
    options: [
      'In the 19th century, the advent of rail transit has transformed global trade.',
      'Over the past three decades, pervasive digitization has fundamentally reshaped human social interaction.',
      'Last decade, digital technologies have altered educational methodologies.',
      'Since 2010 to 2020, social media has grown enormously.',
    ],
    correctIndex: 1,
    explanation: '“Over the past three decades”（过去三十年间，跨度持续至今）是现在完成时（has reshaped）的标志搭配。而 In the 19th century 和 Last decade 是已结束的时间，只能用一般过去时。',
  },
  {
    id: 'qb-14',
    category: 'clauses',
    topicId: 'nominalization-density',
    topicTitle: '学术名词化重构',
    bandTarget: 'Band 8.0+',
    difficulty: 'Advanced',
    question: 'Select the optimal academic revision for: "When factories pollute the rivers, local residents become sick."',
    questionZh: '将“工厂污染河流导致当地居民生病”升级为最高阶学术名词化，最佳句式为：',
    options: [
      'Industrial effluent discharge has precipitated severe public health vulnerabilities among local inhabitants.',
      'Because factories pollute waters, diseases happen to people who live nearby.',
      'The polluting of rivers by factories is making residents get sick.',
      'Factories polluting waters, this leads to sickness of neighbors.',
    ],
    correctIndex: 0,
    explanation: '将从句动作升级为抽象名词 "Industrial effluent discharge"（工业污水排放）与 "public health vulnerabilities"（公共健康脆弱性），极具 Band 8.5+ 权威质感。',
  },
  {
    id: 'qb-15',
    category: 'inversion',
    topicId: 'inverted-conditionals',
    topicTitle: 'Should 倒装条件',
    bandTarget: 'Band 7.5+',
    difficulty: 'Foundation',
    question: 'Transform "If you require further clarification, please contact our department" into an inverted structure:',
    questionZh: '将“若您需要进一步说明，请联系我们部门”改写为规范倒装句：',
    options: [
      'Had you require further clarification, contact us.',
      'Should you require further clarification, please contact our department.',
      'Were you require further clarification, contact us.',
      'If should you require further clarification, contact us.',
    ],
    correctIndex: 1,
    explanation: '真实可能性假设倒装公式为：Should + 主语 + 动词原形（require），省略 if。',
  },
  {
    id: 'qb-16',
    category: 'errors',
    topicId: 'subject-verb-agreement',
    topicTitle: 'Neither... nor 就近原则',
    bandTarget: 'Band 7.5+',
    difficulty: 'Advanced',
    question: 'Choose the correct form: "Neither the minister nor his senior economic advisors _______ convinced by the projections."',
    questionZh: '选出正确动词：“部长及其高级经济顾问均未被这些预测说服。”',
    options: ['was', 'were', 'is', 'has been'],
    correctIndex: 1,
    explanation: 'Neither... nor... 连接并列主语时，谓语动词采用“就近原则”（Proximity Principle）。离谓语最近的主语是复数 advisors，故选 were。',
  },
  {
    id: 'qb-17',
    category: 'clauses',
    topicId: 'participle-clauses',
    topicTitle: '现在分词短语作目的与伴随',
    bandTarget: 'Band 8.0+',
    difficulty: 'Advanced',
    question: 'Complete the sentence with an apposite participial clause: "The city council implemented congestion pricing, _______ private vehicle usage in the central business district."',
    questionZh: '补全分词结果/伴随状语：“市议会实施了拥堵收费，从而显著遏制了中心商务区的私家车使用。”',
    options: [
      'substantially curtailed',
      'substantially curtailing',
      'to substantial curtail',
      'and substantially curtail',
    ],
    correctIndex: 1,
    explanation: '“comma + 现在分词（substantially curtailing）”作主句动作的自然结果或伴随状语，逻辑主语为整个主句动作。',
  },
  {
    id: 'qb-18',
    category: 'inversion',
    topicId: 'negative-inversion',
    topicTitle: 'Not until 倒装位置',
    bandTarget: 'Band 8.5+',
    difficulty: 'Master',
    question: 'Which sentence correctly executes inversion with "Not until"?',
    questionZh: '使用 "Not until"（直到……才）时，倒装位置完全正确的是：',
    options: [
      'Not until did renewable energy become cost-competitive governments stopped subsidies.',
      'Not until renewable energy became cost-competitive did governments phase out fossil fuel subsidies.',
      'Not until renewable energy became cost-competitive, governments did phase out subsidies.',
      'Not until renewable energy did become cost-competitive governments phased out subsidies.',
    ],
    correctIndex: 1,
    explanation: '“Not until + 从句”结构中，Not until 引导的状语从句本身不倒装，而必须在**主句**中进行助动词倒装（did governments phase out）。',
    trapReason: '极易在从句中误倒装。牢记：从句正装，主句倒装！',
  },
  {
    id: 'qb-19',
    category: 'hedging',
    topicId: 'hedging-modality',
    topicTitle: '客观倾向性动词',
    bandTarget: 'Band 7.5+',
    difficulty: 'Foundation',
    question: 'Which cautious phrasing is most suitable to report general behavioral tendencies in academic writing?',
    questionZh: '在学术写作中，表达群体普遍行为倾向最得体的谨慎用语是：',
    options: [
      'Adolescents definitely copy whatever they see on digital platforms.',
      'Adolescents tend to replicate behaviors observed on digital media platforms.',
      'All teenagers always imitate influencers without thinking.',
      'There is a 100% guarantee that youths mimic video content.',
    ],
    correctIndex: 1,
    explanation: '“tend to + 动词原形”（往往倾向于……）是学术界公认最典雅通用的谨慎语气表达。',
  },
  {
    id: 'qb-20',
    category: 'clauses',
    topicId: 'cleft-sentences',
    topicTitle: 'Wh-Cleft 伪分裂句',
    bandTarget: 'Band 8.0+',
    difficulty: 'Advanced',
    question: 'Identify the sentence with an authentic Wh-cleft structure:',
    questionZh: '找出具有地道 Wh-cleft（伪分裂强调句）结构的句子：',
    options: [
      'What developing nations genuinely necessitate is technology transfer rather than mere financial aid.',
      'That developing nations necessitate is technology transfer.',
      'Which developing nations necessitate is technology transfer.',
      'Where developing nations necessitate is technology transfer.',
    ],
    correctIndex: 0,
    explanation: 'Wh-cleft 结构公式为：“What + 主谓分句 + be动词 + 强调核心内容”。',
  },
]
