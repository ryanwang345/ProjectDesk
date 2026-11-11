export type GrammarCategory = 'clauses' | 'inversion' | 'tenses' | 'hedging' | 'errors'

export interface GrammarQuiz {
  question: string
  questionZh?: string
  options: string[]
  correctIndex: number
  explanation: string
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

export const GRAMMAR_CATEGORIES: { id: GrammarCategory | 'all'; labelZh: string; labelEn: string; desc: string }[] = [
  { id: 'all', labelZh: '全部语法', labelEn: 'All Topics', desc: '雅思 7-9 分 Grammatical Range & Accuracy 核心要点' },
  { id: 'clauses', labelZh: '复合从句', labelEn: 'Complex Clauses', desc: '让步状语、名词性从句与定语从句的高阶应用' },
  { id: 'inversion', labelZh: '虚拟与倒装', labelEn: 'Inversion & Conditionals', desc: '否定倒装、省略 if 的虚拟条件句与强调裂句' },
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
    },
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
    examTips: '全文使用 1-2 次否定前置倒装即可，切忌通篇频繁堆砌，确保语境自然切题。',
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
    examTips: '写作中使用分词短语时，务必检查分词的逻辑主语是否与主句的主语一致，严防考官扣分的悬垂修饰（Dangling Participle）。',
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
    examTips: '牢记四大 Academic Hedging 利器：tends to, arguably, is plausible to assume, could potentially。',
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
]
