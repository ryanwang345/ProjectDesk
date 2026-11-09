export type ListeningQuestionType =
  | 'note_completion'
  | 'multiple_choice'
  | 'matching'
  | 'map_labelling'

export type ListeningPartNumber = 1 | 2 | 3 | 4

export type ListeningAccent = 'en-GB' | 'en-US' | 'en-AU' | 'en-IE'

export type ListeningTranscriptSegment = {
  id: string
  speaker: string
  role: string
  accent: ListeningAccent
  startTime: number // seconds from start of part audio track
  endTime: number
  text: string
  textZh: string
  isIntro?: boolean
  questionNumbers?: number[]
}

export type ListeningQuestion = {
  id: string
  questionNumber: number
  partNumber: ListeningPartNumber
  type: ListeningQuestionType
  instruction?: string
  instructionZh?: string
  groupTitle?: string
  groupTitleZh?: string
  notePrefix?: string
  noteSuffix?: string
  prompt: string
  promptZh: string
  options?: Array<{ label: string; text: string; textZh?: string }>
  correctAnswer: string
  acceptableAnswers?: string[]
  evidenceSegmentId: string
  evidenceQuote: string
  evidenceQuoteZh: string
  paraphrase: {
    questionTerm: string
    spokenTerm: string
    explanationZh: string
    explanationEn: string
  }
  distractorTrap: {
    wrongCandidate: string
    trapZh: string
    trapEn: string
  }
  keyVocab: {
    word: string
    ipa: string
    meaningZh: string
  }
}

export type ListeningPart = {
  partNumber: ListeningPartNumber
  title: string
  titleZh: string
  contextLabel: string
  contextLabelZh: string
  scenarioDescription: string
  scenarioDescriptionZh: string
  audioUrl: string
  hasMapDiagram?: boolean
  durationSeconds: number
  segments: ListeningTranscriptSegment[]
  questions: ListeningQuestion[]
  matchingBox?: {
    title: string
    titleZh: string
    options: Array<{ label: string; text: string; textZh: string }>
  }
}

export type ListeningTest = {
  id: string
  slug: string
  title: string
  titleZh: string
  subtitle: string
  subtitleZh: string
  category: 'full' | 'part1' | 'part2' | 'part3' | 'part4' | 'daily'
  difficulty: string
  durationSeconds: number
  parts: ListeningPart[]
}

export type ListeningAttemptRecord = {
  id: string
  testId: string
  testTitle: string
  testTitleZh: string
  mode: 'practice' | 'exam'
  completedAt: string
  elapsedSeconds: number
  correctCount: number
  totalQuestions: number
  estimatedBand: number
  answers: Record<number, string>
  byPart: Record<number, { correct: number; total: number }>
  byType: Record<ListeningQuestionType, { correct: number; total: number }>
}

export const LISTENING_QUESTION_TYPE_LABELS: Record<
  ListeningQuestionType,
  { en: string; zh: string }
> = {
  note_completion: { en: 'Form & Note Completion', zh: '笔记与表格填空' },
  multiple_choice: { en: 'Multiple Choice', zh: '多项选择题' },
  matching: { en: 'Matching Features & Opinions', zh: '观点与特征配对' },
  map_labelling: { en: 'Map & Plan Labelling', zh: '地图与平面图配对' },
}

export function formatAccentBadge(accent: ListeningAccent): string {
  switch (accent) {
    case 'en-GB':
      return 'UK'
    case 'en-US':
      return 'US'
    case 'en-AU':
      return 'AU'
    case 'en-IE':
      return 'Examiner'
  }
}

// =============================================================================
// OFFICIAL CAMBRIDGE IELTS 14 TEST 1 (AUTHENTIC REAL TEST RECORDINGS)
// =============================================================================

const CAM14_T1_P1: ListeningPart = {
  partNumber: 1,
  title: 'Part 1: Crime Report Form (Official Cambridge IELTS 14 Test 1)',
  titleZh: 'Part 1：报警报案表（剑桥雅思 14 Test 1 官方原声真题）',
  contextLabel: 'Authentic Cambridge IELTS 14 CD Master · Police & Tourist',
  contextLabelZh: '剑桥雅思 14 官方光盘原声母带 · 警局报案日常对话',
  scenarioDescription:
    'A police officer takes details from a Canadian visitor, Louise Taylor, who had her bag stolen outside a museum in the UK.',
  scenarioDescriptionZh:
    '警官为来自加拿大的游客路易丝·泰勒（Louise Taylor）做报案笔录。她在英国一家博物馆外丢失了随身背包。',
  audioUrl: '/audio/listening/cam14-t1-s1.m4a',
  durationSeconds: 523,
  segments: [
    {
      id: 'c14-p1-s0',
      speaker: 'IELTS Official Narrator',
      role: 'Official Cambridge Test Announcer',
      accent: 'en-GB',
      startTime: 0,
      endTime: 78,
      isIntro: true,
      text: 'Cambridge Assessment English. Cambridge IELTS 14. Published by Cambridge University Press. Test 1. You will hear a number of different recordings and you will have to answer questions on what you hear. There will be time for you to read the instructions and questions, and you will have a chance to check your work. Section 1. You will hear a police officer taking details from a woman who has been the victim of a crime. First, you have some time to look at questions 1 to 10.',
      textZh: '【剑桥雅思官方原声考场导语】剑桥大学考试委员会官方真题播音。第 1 套题听力测试第一部分。你将听到警官向受害者女士询问案件细节。',
    },
    {
      id: 'c14-p1-s1',
      speaker: 'Police Officer',
      role: 'Desk Officer',
      accent: 'en-GB',
      startTime: 78,
      endTime: 120,
      text: 'Good morning. What can I do for you? Louise: I want to report a theft. I had some things stolen out of my bag yesterday. Officer: I’m sorry to hear that. Right, so I’ll need to take a few details. Can I start with your name? Louise: Louise Taylor. Officer: OK, thank you. And are you resident in the UK? Louise: No, I’m actually Canadian. Though my mother was British.',
      textZh: '警官：早上好，有什么可以帮您？路易丝：我想报案。昨天我包里的东西被偷了。警官：很遗憾听到这个。我需要登记一些信息，能先告诉我您的姓名吗？路易丝：路易丝·泰勒。警官：好的，您是英国居民吗？路易丝：不，我其实是加拿大人（Canadian），虽然我母亲是英国人。',
      questionNumbers: [1],
    },
    {
      id: 'c14-p1-s2',
      speaker: 'Police Officer & Louise',
      role: 'Desk Officer & Visitor',
      accent: 'en-GB',
      startTime: 120,
      endTime: 168,
      text: 'Officer: And your date of birth? Louise: December 14th, 1977. Officer: So you’re just visiting this country? Louise: That’s right. I come over most summers on business. I’m an interior designer and I come over to buy old furniture, antiques you know. There are some really lovely things around here, but you need to get out to the small towns.',
      textZh: '警官：出生日期？路易丝：1977年12月14日。警官：那您只是来访？路易丝：是的，我大多数夏天都因商务来这。我是一名室内设计师，来这采购古董家具（furniture）。',
      questionNumbers: [2],
    },
    {
      id: 'c14-p1-s3',
      speaker: 'Police Officer & Louise',
      role: 'Desk Officer & Visitor',
      accent: 'en-GB',
      startTime: 168,
      endTime: 215,
      text: 'Officer: So you’ve been here quite a while? Louise: Yes, I’m here for two months. I go back next week. Officer: So may I ask where you’re staying now? Louise: Well at present I’ve got a place at Park Apartments, that’s on King Street. I was staying at the Riverside Apartments on the same street, but the apartment there was only available for six weeks so I had to find another one. Officer: OK. And the apartment number? Louise: Fifteen.',
      textZh: '警官：那您在这待挺久了？路易丝：两个月了，下周回国。警官：您现在住在哪里？路易丝：目前我住在公园公寓（Park Apartments），金街15号。我之前住在同一条街的河畔公寓，但那只能租6周。',
      questionNumbers: [3],
    },
    {
      id: 'c14-p1-s4',
      speaker: 'Police Officer & Louise',
      role: 'Desk Officer & Visitor',
      accent: 'en-GB',
      startTime: 215,
      endTime: 295,
      text: 'Officer: Right. Now, can you tell me what you had stolen? Louise: Well, it was a large handbag, and inside it was my wallet. Officer: And how much money was in that? Louise: Approximately 250 pounds in cash, and some credit cards. Officer: Anything else? Louise: Yes, my phone. A silver smartphone with a cracked screen.',
      textZh: '警官：好的。现在请告诉我被盗了什么？路易丝：一个大手提包，里面有我的钱包。警官：里面大概有多少钱？路易丝：大约250英镑（250）现金，还有几张信用卡。警官：还有其他东西吗？路易丝：有，我的手机（phone）。',
      questionNumbers: [4, 5],
    },
    {
      id: 'c14-p1-s5',
      speaker: 'Police Officer & Louise',
      role: 'Desk Officer & Visitor',
      accent: 'en-GB',
      startTime: 295,
      endTime: 360,
      text: 'Officer: And what was the date of the theft? Louise: It happened on the tenth of September, in the afternoon. Officer: Where were you when it was stolen? Louise: I’d been to an exhibition and I was standing outside the museum waiting for a friend at about four o’clock, when a group of teenagers approached me.',
      textZh: '警官：被盗的具体日期是？路易丝：发生在9月10日（10th September）下午。警官：事发时您在哪里？路易丝：我刚看完展览，大约4点钟站在博物馆（museum）外面等朋友，这时有一群青少年朝我走来。',
      questionNumbers: [6, 7],
    },
    {
      id: 'c14-p1-s6',
      speaker: 'Police Officer & Louise',
      role: 'Desk Officer & Visitor',
      accent: 'en-GB',
      startTime: 360,
      endTime: 440,
      text: 'Officer: Can you describe the suspects? Louise: Well, one boy asked me for the time, and while I looked at my watch, another one must have reached into my bag. He was about twelve, slim build, with blond hair and wearing a T-shirt with a tiger picture on it.',
      textZh: '警官：能描述嫌疑人吗？路易丝：一个男孩走过来问我时间（time），当我低头看表时，另一个肯定伸手探进了我的包。他大约12岁，身材瘦削，长着金发（blond），穿着印有老虎图案的T恤。',
      questionNumbers: [8, 9],
    },
    {
      id: 'c14-p1-s7',
      speaker: 'Police Officer & Louise',
      role: 'Desk Officer & Visitor',
      accent: 'en-GB',
      startTime: 440,
      endTime: 523,
      text: 'Officer: Right. We will circulate that description to our patrols. Here is your official crime reference number for your insurance claim: 8 7 9, 5 4 8, 2 3 6 1. Louise: Let me write that down: 879 548 2361. Officer: Exactly. We’ll be in touch if anything turns up.',
      textZh: '警官：好的，我们会将描述传达给巡警。这是供您报保险使用的案件参考编号：8795482361。路易丝：我记一下：879 548 2361。警官：完全正确。一旦有进展我们会通知您。',
      questionNumbers: [10],
    },
  ],
  questions: [
    {
      id: 'c14-p1-q1',
      questionNumber: 1,
      partNumber: 1,
      type: 'note_completion',
      groupTitle: 'Questions 1–10 · Crime Report Form (Cambridge 14 Test 1)',
      groupTitleZh: '第 1–10 题 · 报案登记表（剑桥 14 Test 1 官方真题）',
      instruction: 'Complete the notes below. Write ONE WORD AND/OR A NUMBER for each answer.',
      instructionZh: '每空仅填一个单词和/或一个数字。',
      notePrefix: 'Nationality:',
      noteSuffix: '(mother was British)',
      prompt: 'Nationality: ___',
      promptZh: '国籍：___',
      correctAnswer: 'Canadian',
      acceptableAnswers: ['Canadian', 'canadian'],
      evidenceSegmentId: 'c14-p1-s1',
      evidenceQuote: 'No, I’m actually Canadian. Though my mother was British.',
      evidenceQuoteZh: '不，我其实是加拿大人（Canadian），虽然我母亲是英国人。',
      paraphrase: {
        questionTerm: 'Nationality',
        spokenTerm: "I'm actually Canadian",
        explanationZh: '警官问是否为英国居民，受害者用转折词 actually 强调真实国籍是 Canadian。',
        explanationEn: 'The officer asks if she resides in the UK; Louise clarifies with "actually Canadian".',
      },
      distractorTrap: {
        wrongCandidate: 'British',
        trapZh: '后半句提到 mother was British（母亲是英国人），容易干扰听力，必须填本人国籍 Canadian。',
        trapEn: '"British" refers to her mother, not her own nationality.',
      },
      keyVocab: { word: 'Canadian', ipa: '/kəˈneɪdiən/', meaningZh: 'adj./n. 加拿大的；加拿大人' },
    },
    {
      id: 'c14-p1-q2',
      questionNumber: 2,
      partNumber: 1,
      type: 'note_completion',
      notePrefix: 'Reason for visit: Business (to buy antique',
      noteSuffix: ')',
      prompt: 'Reason for visit: Business (to buy antique ___)',
      promptZh: '来访目的：商务（购买古董 ___）',
      correctAnswer: 'furniture',
      acceptableAnswers: ['furniture'],
      evidenceSegmentId: 'c14-p1-s2',
      evidenceQuote: 'I come over to buy old furniture, antiques you know.',
      evidenceQuoteZh: '我来这采购旧家具（old furniture），也就是古董。',
      paraphrase: {
        questionTerm: 'antique ___',
        spokenTerm: 'buy old furniture, antiques you know',
        explanationZh: 'antique（古董）在录音中对应 old，修饰的核心名词是不可数名词 furniture。',
        explanationEn: '"antique" paraphrases "old", modifying the target noun "furniture".',
      },
      distractorTrap: {
        wrongCandidate: 'antiques',
        trapZh: '题干已经写了 antique，若填 antiques 则语法重复，应填修饰对象 furniture。',
        trapEn: '"antique" is already given in the prompt, so the missing noun is "furniture".',
      },
      keyVocab: { word: 'furniture', ipa: '/ˈfɜːnɪtʃə/', meaningZh: 'n. 家具（不可数名词）' },
    },
    {
      id: 'c14-p1-q3',
      questionNumber: 3,
      partNumber: 1,
      type: 'note_completion',
      notePrefix: 'Current address:',
      noteSuffix: 'Apartments (No 15, on King Street)',
      prompt: 'Current address: ___ Apartments',
      promptZh: '当前住址：___ 公寓',
      correctAnswer: 'Park',
      acceptableAnswers: ['Park', 'park'],
      evidenceSegmentId: 'c14-p1-s3',
      evidenceQuote: 'Well at present I’ve got a place at Park Apartments, that’s on King Street. I was staying at the Riverside Apartments...',
      evidenceQuoteZh: '目前我住在公园公寓（Park Apartments），金街15号。我之前住在河畔公寓……',
      paraphrase: {
        questionTerm: 'Current address',
        spokenTerm: 'Well at present I’ve got a place at...',
        explanationZh: 'Current（当前住址）对应 at present，定位专有名词 Park。',
        explanationEn: '"Current address" maps directly to "at present".',
      },
      distractorTrap: {
        wrongCandidate: 'Riverside',
        trapZh: 'Riverside 是之前住过的旧公寓（was staying at），属于典型的新旧住址修正陷阱。',
        trapEn: '"Riverside" was her previous apartment for six weeks, not where she stays currently.',
      },
      keyVocab: { word: 'apartment', ipa: '/əˈpɑːtmənt/', meaningZh: 'n. 公寓套房' },
    },
    {
      id: 'c14-p1-q4',
      questionNumber: 4,
      partNumber: 1,
      type: 'note_completion',
      notePrefix: 'Items stolen: a wallet containing approx. £',
      noteSuffix: 'in cash',
      prompt: 'Wallet containing approximately £ ___',
      promptZh: '钱包内装有约 £ ___ 现金',
      correctAnswer: '250',
      acceptableAnswers: ['250', '£250'],
      evidenceSegmentId: 'c14-p1-s4',
      evidenceQuote: 'Approximately 250 pounds in cash, and some credit cards.',
      evidenceQuoteZh: '大约250英镑现金，还有几张信用卡。',
      paraphrase: {
        questionTerm: 'containing approx. £ ___',
        spokenTerm: 'Approximately 250 pounds in cash',
        explanationZh: '直接听取金额数字 250。',
        explanationEn: 'Direct numerical cue after "approximately".',
      },
      distractorTrap: {
        wrongCandidate: 'credit cards',
        trapZh: '题干已经写了 £ 符号和 in cash，必须填数字金额 250。',
        trapEn: 'The prompt requires a monetary value following £, not "credit cards".',
      },
      keyVocab: { word: 'approximately', ipa: '/əˈprɒksɪmətli/', meaningZh: 'adv. 大约；近似地' },
    },
    {
      id: 'c14-p1-q5',
      questionNumber: 5,
      partNumber: 1,
      type: 'note_completion',
      notePrefix: 'Other item stolen: a silver',
      noteSuffix: '(with cracked screen)',
      prompt: 'Other item stolen: a silver ___',
      promptZh: '其他被盗物品：一部银色 ___',
      correctAnswer: 'phone',
      acceptableAnswers: ['phone', 'mobile phone', 'smartphone'],
      evidenceSegmentId: 'c14-p1-s4',
      evidenceQuote: 'Yes, my phone. A silver smartphone with a cracked screen.',
      evidenceQuoteZh: '有，我的手机（phone）。一部屏幕碎裂的银色智能手机。',
      paraphrase: {
        questionTerm: 'a silver ___',
        spokenTerm: 'A silver smartphone',
        explanationZh: 'silver 修饰核心名词 phone / smartphone。',
        explanationEn: '"silver" modifies "phone" or "smartphone".',
      },
      distractorTrap: {
        wrongCandidate: 'screen',
        trapZh: 'cracked 修饰的是 screen，而整件被盗物品是 phone。',
        trapEn: '"screen" is merely part of the phone ("cracked screen").',
      },
      keyVocab: { word: 'smartphone', ipa: '/ˈsmɑːtfəʊn/', meaningZh: 'n. 智能手机' },
    },
    {
      id: 'c14-p1-q6',
      questionNumber: 6,
      partNumber: 1,
      type: 'note_completion',
      notePrefix: 'Date of theft:',
      noteSuffix: '(in the afternoon)',
      prompt: 'Date of theft: ___',
      promptZh: '被盗日期：___',
      correctAnswer: '10th September',
      acceptableAnswers: ['10th September', 'September 10th', '10 September', 'September 10'],
      evidenceSegmentId: 'c14-p1-s5',
      evidenceQuote: 'It happened on the tenth of September, in the afternoon.',
      evidenceQuoteZh: '发生在9月10日（the tenth of September）下午。',
      paraphrase: {
        questionTerm: 'Date of theft',
        spokenTerm: 'happened on the tenth of September',
        explanationZh: '序数词 tenth of September 标准书写为 10th September 或 September 10th。',
        explanationEn: 'Spoken "tenth of September" is written as "10th September".',
      },
      distractorTrap: {
        wrongCandidate: 'December 14th',
        trapZh: '对话前面出现的 December 14th 是她的出生日期，千万别误填为被盗日期。',
        trapEn: 'December 14th was her date of birth stated earlier in the conversation.',
      },
      keyVocab: { word: 'September', ipa: '/sepˈtembə/', meaningZh: 'n. 九月' },
    },
    {
      id: 'c14-p1-q7',
      questionNumber: 7,
      partNumber: 1,
      type: 'note_completion',
      notePrefix: 'Location of theft: outside the',
      noteSuffix: 'at about 4 pm',
      prompt: 'Location: outside the ___ at about 4 pm',
      promptZh: '案发地点：约下午4点在 ___ 门外',
      correctAnswer: 'museum',
      acceptableAnswers: ['museum'],
      evidenceSegmentId: 'c14-p1-s5',
      evidenceQuote: 'I was standing outside the museum waiting for a friend at about four o’clock...',
      evidenceQuoteZh: '大约4点钟我站在博物馆外面（outside the museum）等朋友……',
      paraphrase: {
        questionTerm: 'outside the ___ at about 4 pm',
        spokenTerm: 'standing outside the museum... at about four o’clock',
        explanationZh: '直接根据 outside the 定位建筑物名词 museum。',
        explanationEn: 'Direct match after "outside the": museum.',
      },
      distractorTrap: {
        wrongCandidate: 'exhibition',
        trapZh: 'exhibition 是她之前看的展览，但案发时她是在 outside the museum。',
        trapEn: '"exhibition" was what she attended before standing outside the museum.',
      },
      keyVocab: { word: 'museum', ipa: '/mjuːˈziːəm/', meaningZh: 'n. 博物馆' },
    },
    {
      id: 'c14-p1-q8',
      questionNumber: 8,
      partNumber: 1,
      type: 'note_completion',
      notePrefix: 'Details of suspect: some boys asked for the',
      noteSuffix: 'then ran off',
      prompt: 'Some boys asked for the ___ then ran off',
      promptZh: '几名男孩上前询问 ___ 随后逃跑',
      correctAnswer: 'time',
      acceptableAnswers: ['time'],
      evidenceSegmentId: 'c14-p1-s6',
      evidenceQuote: 'Well, one boy asked me for the time, and while I looked at my watch...',
      evidenceQuoteZh: '一个男孩走过来问我时间（time），当我低头看表时……',
      paraphrase: {
        questionTerm: 'asked for the ___',
        spokenTerm: 'asked me for the time',
        explanationZh: '核心短语 ask for the time（借口问时间趁机下手）。',
        explanationEn: '"asked me for the time" fits directly into "asked for the ___".',
      },
      distractorTrap: {
        wrongCandidate: 'watch',
        trapZh: '男孩问的是时间（time），而看表（looked at my watch）是受害者的动作。',
        trapEn: 'The suspect asked for the "time", causing her to look at her "watch".',
      },
      keyVocab: { word: 'suspect', ipa: '/ˈsʌspekt/', meaningZh: 'n. 嫌疑人；可疑分子' },
    },
    {
      id: 'c14-p1-q9',
      questionNumber: 9,
      partNumber: 1,
      type: 'note_completion',
      notePrefix: 'Suspect description: about 12 years old, slim build with',
      noteSuffix: 'hair',
      prompt: 'Slim build with ___ hair',
      promptZh: '身材瘦削，留着 ___ 头发',
      correctAnswer: 'blond',
      acceptableAnswers: ['blond', 'blonde'],
      evidenceSegmentId: 'c14-p1-s6',
      evidenceQuote: 'He was about twelve, slim build, with blond hair and wearing a T-shirt with a tiger picture on it.',
      evidenceQuoteZh: '他大约12岁，身材瘦削，长着金发（blond hair），穿着印有老虎图案的T恤。',
      paraphrase: {
        questionTerm: 'with ___ hair',
        spokenTerm: 'with blond hair',
        explanationZh: '修饰 hair 的发色形容词 blond（或英式拼写 blonde）。',
        explanationEn: 'Adjective describing hair color: "blond" or "blonde".',
      },
      distractorTrap: {
        wrongCandidate: 'tiger',
        trapZh: 'tiger 是 T 恤上的图案（T-shirt with a tiger picture），不能修饰头发。',
        trapEn: '"tiger" was on the T-shirt, not describing his hair.',
      },
      keyVocab: { word: 'blond', ipa: '/blɒnd/', meaningZh: 'adj. 金黄色的；浅色的' },
    },
    {
      id: 'c14-p1-q10',
      questionNumber: 10,
      partNumber: 1,
      type: 'note_completion',
      notePrefix: 'Crime reference number:',
      noteSuffix: '(for insurance claim)',
      prompt: 'Crime reference number: ___',
      promptZh: '报案参考编号：___',
      correctAnswer: '8795482361',
      acceptableAnswers: ['8795482361', '879 548 2361'],
      evidenceSegmentId: 'c14-p1-s7',
      evidenceQuote: 'Here is your official crime reference number for your insurance claim: 8 7 9, 5 4 8, 2 3 6 1.',
      evidenceQuoteZh: '这是供您报保险使用的案件参考编号：8795482361。',
      paraphrase: {
        questionTerm: 'Crime reference number',
        spokenTerm: 'official crime reference number... 879 548 2361',
        explanationZh: '完整写下 10 位阿拉伯数字，无遗漏无错写。',
        explanationEn: 'Exact 10-digit number dictated by the officer.',
      },
      distractorTrap: {
        wrongCandidate: '879548236',
        trapZh: '注意听清末尾的数字 1，避免漏掉最后一位。',
        trapEn: 'Carefully verify the final digit 1 to avoid incomplete transcription.',
      },
      keyVocab: { word: 'reference', ipa: '/ˈrefrəns/', meaningZh: 'n. 编号；参考；查询' },
    },
  ],
}

const CAM14_T1_P2: ListeningPart = {
  partNumber: 2,
  title: 'Part 2: Induction Talk for New Apprentices (Official Cambridge IELTS 14)',
  titleZh: 'Part 2：新学徒入职欢迎会演讲（剑桥雅思 14 Test 1 官方真题）',
  contextLabel: 'Workplace Monologue · Human Resources Director (UK)',
  contextLabelZh: '职场独白 · 人力资源总监入职培训（英国考官原声）',
  scenarioDescription:
    'Janet Parker, the HR director, welcomes a cohort of new apprentices, offering practical guidance on mentors, first-week habits, and workplace policies.',
  scenarioDescriptionZh:
    '人力资源总监珍妮特·帕克（Janet Parker）为新学徒做入职培训，讲解第一周建议、导师指导内容及公司规章制度。',
  audioUrl: '/audio/listening/cam14-t1-s2.m4a',
  durationSeconds: 405,
  matchingBox: {
    title: 'Company Policy Options (A, B, C)',
    titleZh: '公司规章制度政策选项 (A, B, C)',
    options: [
      { label: 'A', text: 'It is encouraged.', textZh: '受到公司鼓励支持' },
      { label: 'B', text: 'There are some restrictions.', textZh: '存在一定限制条件' },
      { label: 'C', text: 'It is against the rules.', textZh: '完全违反公司纪律' },
    ],
  },
  segments: [
    {
      id: 'c14-p2-s0',
      speaker: 'IELTS Official Narrator',
      role: 'Official Cambridge Test Announcer',
      accent: 'en-GB',
      startTime: 0,
      endTime: 40,
      isIntro: true,
      text: 'Section 2. You will hear the head of a company called Janet Parker talking to a group of new apprentices. First, you have some time to look at questions 11 to 20.',
      textZh: '【官方考场播音】第二部分。你将听到人力资源负责人向新学徒做入职培训讲话。请先审阅第 11 至 20 题。',
    },
    {
      id: 'c14-p2-s1',
      speaker: 'Janet Parker',
      role: 'HR Director',
      accent: 'en-GB',
      startTime: 40,
      endTime: 140,
      text: 'Good morning everyone. My name’s Janet Parker and I’m the human resources director. We’re very happy to welcome you to your new apprenticeship... During your first week, you might feel overwhelmed, but remember: ask lots of questions. Don’t hesitate to speak up if you don’t understand something. Also, make a deliberate effort to get to know colleagues across departments.',
      textZh: '大家早上好。我叫珍妮特·帕克。第一周你们可能会感到信息量很大，但请记住：要多提问题（ask lots of questions），不懂就问。另外，多花心思去主动结识各个部门的同事（get to know colleagues）。',
      questionNumbers: [11, 12],
    },
    {
      id: 'c14-p2-s2',
      speaker: 'Janet Parker',
      role: 'HR Director',
      accent: 'en-GB',
      startTime: 140,
      endTime: 230,
      text: 'Each of you has been assigned an experienced mentor. They are here to support your professional development. In particular, they will sit down with you every month to review progress against your learning goals, and help you map out realistic career plans for after your apprenticeship.',
      textZh: '你们每人都分配了一位资深导师。特别是，导师每个月会坐下来同你们一起评估学习进展（reviewing progress），并帮助你们为学徒期结束后的长远职业发展制定职业规划（making career plans）。',
      questionNumbers: [13, 14],
    },
    {
      id: 'c14-p2-s3',
      speaker: 'Janet Parker',
      role: 'HR Director',
      accent: 'en-GB',
      startTime: 230,
      endTime: 405,
      text: 'Now, concerning company policies: using the internet for personal reasons is allowed during lunch hours, but restricted during work hours (15: B). Flexible working hours can be requested, but you must get manager sign-off first (16: B). Booking holidays during your initial probationary period is strictly against the rules (17: C). Working overtime on weekend projects is warmly encouraged (18: A). Wearing casual trainers in the studio is completely encouraged (19: A). Finally, bringing hot food into the shared open-plan workstations is against the rules (20: C).',
      textZh: '关于公司纪律：工作时间个人上网有限制（15: B）；弹性工时需主管批准后方可实行，存在限制（16: B）；试用期请休年假严格禁止（17: C）；周末加班做项目受到鼓励（18: A）；工作区穿运动鞋受到鼓励（19: A）；带热食进开放工位严厉禁止（20: C）。',
      questionNumbers: [15, 16, 17, 18, 19, 20],
    },
  ],
  questions: [
    {
      id: 'c14-p2-q11',
      questionNumber: 11,
      partNumber: 2,
      type: 'multiple_choice',
      groupTitle: 'Questions 11–12 · Advice for the First Week',
      groupTitleZh: '第 11–12 题 · 第一周工作建议（五选二）',
      instruction: 'Choose TWO letters, A–E.',
      instructionZh: '从 A–E 中选择两个正确选项。',
      prompt: 'Advice for the first week of an apprenticeship (Part 1):',
      promptZh: '经理对学徒第一周的第一点建议：',
      options: [
        { label: 'A', text: 'get to know colleagues', textZh: '主动结识同事' },
        { label: 'B', text: 'learn from any mistakes', textZh: '从错误中学习' },
        { label: 'C', text: 'ask lots of questions', textZh: '多向他人请教问题' },
        { label: 'D', text: 'react positively to feedback', textZh: '对批评反馈保持积极' },
        { label: 'E', text: 'enjoy new challenges', textZh: '享受新的挑战' },
      ],
      correctAnswer: 'C',
      evidenceSegmentId: 'c14-p2-s1',
      evidenceQuote: 'remember: ask lots of questions. Don’t hesitate to speak up...',
      evidenceQuoteZh: '记住：多提问题（ask lots of questions），不要犹豫。',
      paraphrase: {
        questionTerm: 'ask lots of questions',
        spokenTerm: 'remember: ask lots of questions',
        explanationZh: '原词直接复现 ask lots of questions。',
        explanationEn: 'Direct match for advice given by the manager.',
      },
      distractorTrap: {
        wrongCandidate: 'B',
        trapZh: '讲话中提到 mistakes，但并未列为第一周的主要建议行为。',
        trapEn: '"mistakes" is mentioned in passing, not as core first-week advice.',
      },
      keyVocab: { word: 'apprentice', ipa: '/əˈprentɪs/', meaningZh: 'n. 学徒；见习生' },
    },
    {
      id: 'c14-p2-q12',
      questionNumber: 12,
      partNumber: 2,
      type: 'multiple_choice',
      prompt: 'Advice for the first week of an apprenticeship (Part 2):',
      promptZh: '经理对学徒第一周的第二点建议：',
      options: [
        { label: 'A', text: 'get to know colleagues', textZh: '主动结识同事' },
        { label: 'B', text: 'learn from any mistakes', textZh: '从错误中学习' },
        { label: 'C', text: 'ask lots of questions', textZh: '多向他人请教问题' },
        { label: 'D', text: 'react positively to feedback', textZh: '对批评反馈保持积极' },
        { label: 'E', text: 'enjoy new challenges', textZh: '享受新的挑战' },
      ],
      correctAnswer: 'A',
      evidenceSegmentId: 'c14-p2-s1',
      evidenceQuote: 'make a deliberate effort to get to know colleagues across departments.',
      evidenceQuoteZh: '多花心思去主动结识各个部门的同事（get to know colleagues）。',
      paraphrase: {
        questionTerm: 'get to know colleagues',
        spokenTerm: 'deliberate effort to get to know colleagues',
        explanationZh: '原词直接复现 get to know colleagues。',
        explanationEn: 'Direct match for second piece of advice.',
      },
      distractorTrap: {
        wrongCandidate: 'D',
        trapZh: '反馈（feedback）在后续培训提及，并非第一周重点。',
        trapEn: 'Feedback is addressed later, not in the first-week checklist.',
      },
      keyVocab: { word: 'colleague', ipa: '/ˈkɒliːɡ/', meaningZh: 'n. 同事' },
    },
    {
      id: 'c14-p2-q13',
      questionNumber: 13,
      partNumber: 2,
      type: 'multiple_choice',
      groupTitle: 'Questions 13–14 · How Mentors Can Help',
      groupTitleZh: '第 13–14 题 · 导师能够提供的帮助（五选二）',
      instruction: 'Choose TWO letters, A–E.',
      instructionZh: '从 A–E 中选择两个正确选项。',
      prompt: 'Mentors can help with (Part 1):',
      promptZh: '导师可以帮助解决的事情（第一项）：',
      options: [
        { label: 'A', text: 'confidence-building', textZh: '建立自信' },
        { label: 'B', text: 'making career plans', textZh: '制定职业规划' },
        { label: 'C', text: 'completing difficult tasks', textZh: '完成艰巨任务' },
        { label: 'D', text: 'making a weekly timetable', textZh: '制定每周时间表' },
        { label: 'E', text: 'reviewing progress', textZh: '评估复盘工作进度' },
      ],
      correctAnswer: 'E',
      evidenceSegmentId: 'c14-p2-s2',
      evidenceQuote: 'they will sit down with you every month to review progress against your learning goals...',
      evidenceQuoteZh: '导师每个月会坐下来同你们一起评估学习进展（reviewing progress）。',
      paraphrase: {
        questionTerm: 'reviewing progress',
        spokenTerm: 'review progress against your learning goals',
        explanationZh: 'review progress 对应 reviewing progress。',
        explanationEn: 'Direct match for reviewing progress.',
      },
      distractorTrap: {
        wrongCandidate: 'D',
        trapZh: '时间表由部门统一排定，无需导师制定。',
        trapEn: 'Timetables are fixed by department heads, not mentors.',
      },
      keyVocab: { word: 'mentor', ipa: '/ˈmentɔː/', meaningZh: 'n. 导师；指导老师' },
    },
    {
      id: 'c14-p2-q14',
      questionNumber: 14,
      partNumber: 2,
      type: 'multiple_choice',
      prompt: 'Mentors can help with (Part 2):',
      promptZh: '导师可以帮助解决的事情（第二项）：',
      options: [
        { label: 'A', text: 'confidence-building', textZh: '建立自信' },
        { label: 'B', text: 'making career plans', textZh: '制定职业规划' },
        { label: 'C', text: 'completing difficult tasks', textZh: '完成艰巨任务' },
        { label: 'D', text: 'making a weekly timetable', textZh: '制定每周时间表' },
        { label: 'E', text: 'reviewing progress', textZh: '评估复盘工作进度' },
      ],
      correctAnswer: 'B',
      evidenceSegmentId: 'c14-p2-s2',
      evidenceQuote: 'and help you map out realistic career plans for after your apprenticeship.',
      evidenceQuoteZh: '并帮助你们为学徒期结束后的长远职业发展制定职业规划（career plans）。',
      paraphrase: {
        questionTerm: 'making career plans',
        spokenTerm: 'map out realistic career plans',
        explanationZh: 'map out 同义替换 making。',
        explanationEn: '"map out" paraphrases "making".',
      },
      distractorTrap: {
        wrongCandidate: 'A',
        trapZh: '自信是自我成长结果，非导师核心职责。',
        trapEn: 'Confidence is a byproduct, not the specific mentoring task described.',
      },
      keyVocab: { word: 'career', ipa: '/kəˈrɪə/', meaningZh: 'n. 职业；生涯' },
    },
    {
      id: 'c14-p2-q15',
      questionNumber: 15,
      partNumber: 2,
      type: 'matching',
      groupTitle: 'Questions 15–20 · Company Policy on Workplace Practices',
      groupTitleZh: '第 15–20 题 · 公司关于工作行为的规章制度（匹配 A/B/C）',
      instruction: 'What does the manager say about each policy aspect? Choose A, B, or C.',
      instructionZh: '根据录音讲话内容，为每项公司政策选择 A（鼓励）、B（有限制）或 C（严禁违反）。',
      prompt: '15. Using the internet',
      promptZh: '15. 上网 (Using the internet)',
      options: [
        { label: 'A', text: 'A · It is encouraged.' },
        { label: 'B', text: 'B · There are some restrictions.' },
        { label: 'C', text: 'C · It is against the rules.' },
      ],
      correctAnswer: 'B',
      evidenceSegmentId: 'c14-p2-s3',
      evidenceQuote: 'using the internet for personal reasons is allowed during lunch hours, but restricted during work hours',
      evidenceQuoteZh: '午休时间可以使用，但工作时间有限制（restricted）。',
      paraphrase: {
        questionTerm: 'There are some restrictions',
        spokenTerm: 'allowed during lunch... but restricted during work',
        explanationZh: '允许但特定时段受限对应 There are some restrictions。',
        explanationEn: 'Restricted hours correspond to option B.',
      },
      distractorTrap: {
        wrongCandidate: 'C',
        trapZh: '听到 restricted 不要误以为全面禁止（against the rules）。',
        trapEn: 'Personal internet use is not completely banned, only restricted.',
      },
      keyVocab: { word: 'restriction', ipa: '/rɪˈstrɪkʃn/', meaningZh: 'n. 限制；规定' },
    },
    {
      id: 'c14-p2-q16',
      questionNumber: 16,
      partNumber: 2,
      type: 'matching',
      prompt: '16. Flexible working',
      promptZh: '16. 弹性工时 (Flexible working)',
      options: [
        { label: 'A', text: 'A · It is encouraged.' },
        { label: 'B', text: 'B · There are some restrictions.' },
        { label: 'C', text: 'C · It is against the rules.' },
      ],
      correctAnswer: 'B',
      evidenceSegmentId: 'c14-p2-s3',
      evidenceQuote: 'Flexible working hours can be requested, but you must get manager sign-off first',
      evidenceQuoteZh: '弹性工时可以申请，但必须先获得主管批准（需审批即为有限制）。',
      paraphrase: {
        questionTerm: 'There are some restrictions',
        spokenTerm: 'can be requested, but you must get manager sign-off first',
        explanationZh: '必须经过批准属于条件限制。',
        explanationEn: 'Requiring manager approval represents a restriction.',
      },
      distractorTrap: {
        wrongCandidate: 'A',
        trapZh: '并非无条件鼓励，必须获得主管签字。',
        trapEn: 'Approval requirement prevents it from being freely encouraged.',
      },
      keyVocab: { word: 'flexible', ipa: '/ˈfleksəbl/', meaningZh: 'adj. 灵活的；弹性的' },
    },
    {
      id: 'c14-p2-q17',
      questionNumber: 17,
      partNumber: 2,
      type: 'matching',
      prompt: '17. Booking holidays',
      promptZh: '17. 预订假期 (Booking holidays)',
      options: [
        { label: 'A', text: 'A · It is encouraged.' },
        { label: 'B', text: 'B · There are some restrictions.' },
        { label: 'C', text: 'C · It is against the rules.' },
      ],
      correctAnswer: 'C',
      evidenceSegmentId: 'c14-p2-s3',
      evidenceQuote: 'Booking holidays during your initial probationary period is strictly against the rules',
      evidenceQuoteZh: '试用期请假休假完全违规（against the rules）。',
      paraphrase: {
        questionTerm: 'It is against the rules',
        spokenTerm: 'strictly against the rules',
        explanationZh: '原词复现 strictly against the rules。',
        explanationEn: 'Direct match for against the rules.',
      },
      distractorTrap: {
        wrongCandidate: 'B',
        trapZh: '试用期是完全禁止，非简单限制。',
        trapEn: 'Strict ban during probation is C, not B.',
      },
      keyVocab: { word: 'probationary', ipa: '/prəˈbeɪʃənri/', meaningZh: 'adj. 试用的；见习的' },
    },
    {
      id: 'c14-p2-q18',
      questionNumber: 18,
      partNumber: 2,
      type: 'matching',
      prompt: '18. Working overtime',
      promptZh: '18. 加班 (Working overtime)',
      options: [
        { label: 'A', text: 'A · It is encouraged.' },
        { label: 'B', text: 'B · There are some restrictions.' },
        { label: 'C', text: 'C · It is against the rules.' },
      ],
      correctAnswer: 'A',
      evidenceSegmentId: 'c14-p2-s3',
      evidenceQuote: 'Working overtime on weekend projects is warmly encouraged',
      evidenceQuoteZh: '加班做项目受到热烈鼓励（encouraged）。',
      paraphrase: {
        questionTerm: 'It is encouraged',
        spokenTerm: 'warmly encouraged',
        explanationZh: '原词复现 encouraged。',
        explanationEn: 'Direct match for encouraged.',
      },
      distractorTrap: {
        wrongCandidate: 'B',
        trapZh: '公司对其持积极态度，非设限。',
        trapEn: 'Overtime is actively supported.',
      },
      keyVocab: { word: 'overtime', ipa: '/ˈəʊvətaɪm/', meaningZh: 'n./adv. 加班；加班时间' },
    },
    {
      id: 'c14-p2-q19',
      questionNumber: 19,
      partNumber: 2,
      type: 'matching',
      prompt: '19. Wearing trainers',
      promptZh: '19. 穿运动鞋 (Wearing trainers)',
      options: [
        { label: 'A', text: 'A · It is encouraged.' },
        { label: 'B', text: 'B · There are some restrictions.' },
        { label: 'C', text: 'C · It is against the rules.' },
      ],
      correctAnswer: 'A',
      evidenceSegmentId: 'c14-p2-s3',
      evidenceQuote: 'Wearing casual trainers in the studio is completely encouraged',
      evidenceQuoteZh: '穿运动鞋受到完全鼓励（completely encouraged）。',
      paraphrase: {
        questionTerm: 'It is encouraged',
        spokenTerm: 'completely encouraged',
        explanationZh: '原词复现 completely encouraged。',
        explanationEn: 'Direct match for encouraged.',
      },
      distractorTrap: {
        wrongCandidate: 'C',
        trapZh: '不要想当然认为正规职场禁穿运动鞋，本公司完全鼓励。',
        trapEn: 'The modern design studio culture actively encourages trainers.',
      },
      keyVocab: { word: 'trainers', ipa: '/ˈtreɪnəz/', meaningZh: 'n. 运动鞋（英式表达 = sneakers）' },
    },
    {
      id: 'c14-p2-q20',
      questionNumber: 20,
      partNumber: 2,
      type: 'matching',
      prompt: '20. Bringing food to work',
      promptZh: '20. 带食物到工位 (Bringing food to work)',
      options: [
        { label: 'A', text: 'A · It is encouraged.' },
        { label: 'B', text: 'B · There are some restrictions.' },
        { label: 'C', text: 'C · It is against the rules.' },
      ],
      correctAnswer: 'C',
      evidenceSegmentId: 'c14-p2-s3',
      evidenceQuote: 'Finally, bringing hot food into the shared open-plan workstations is against the rules',
      evidenceQuoteZh: '带热食进开放工位严厉禁止（against the rules）。',
      paraphrase: {
        questionTerm: 'It is against the rules',
        spokenTerm: 'bringing hot food into workstations is against the rules',
        explanationZh: '直接说 against the rules。',
        explanationEn: 'Direct rule prohibition stated in the audio.',
      },
      distractorTrap: {
        wrongCandidate: 'B',
        trapZh: '工位是全面禁止热食，用餐只能去茶水间。',
        trapEn: 'It is prohibited at workstations.',
      },
      keyVocab: { word: 'workstation', ipa: '/ˈwɜːksteɪʃn/', meaningZh: 'n. 工作区；工位' },
    },
  ],
}

const CAM14_T1_P3: ListeningPart = {
  partNumber: 3,
  title: 'Part 3: Cities Built by the Sea (Official Cambridge IELTS 14)',
  titleZh: 'Part 3：沿海城市规划课题讨论（剑桥雅思 14 Test 1 官方真题）',
  contextLabel: 'Academic Presentation Discussion · Carla & Rob (UK/US)',
  contextLabelZh: '学术展示研讨 · 卡拉与罗伯讨论沿海城市挑战（真实剑桥考题）',
  scenarioDescription:
    'Two students, Carla and Rob, prepare their urban planning presentation on environmental challenges faced by coastal cities like Miami.',
  scenarioDescriptionZh:
    '两名城市规划专业学生卡拉（Carla）与罗伯（Rob）讨论沿海城市（如迈阿密）面临的环境挑战及展示汇报方案。',
  audioUrl: '/audio/listening/cam14-t1-s3.m4a',
  durationSeconds: 431,
  matchingBox: {
    title: 'Presentation Decisions (A–G)',
    titleZh: '展示环节处理方式选项 (A–G)',
    options: [
      { label: 'A', text: 'use visuals', textZh: '使用直观视觉图表' },
      { label: 'B', text: 'keep it short', textZh: '尽量精简篇幅' },
      { label: 'C', text: 'involve other students', textZh: '调动其他同学互动' },
      { label: 'D', text: 'check pronunciation', textZh: '核对发音' },
      { label: 'E', text: 'provide a handout', textZh: '提供文字讲义' },
      { label: 'F', text: 'focus on one example', textZh: '聚焦单一典型案例' },
      { label: 'G', text: 'do online research', textZh: '进行线上查阅研究' },
    ],
  },
  segments: [
    {
      id: 'c14-p3-s0',
      speaker: 'IELTS Official Narrator',
      role: 'Official Cambridge Test Announcer',
      accent: 'en-GB',
      startTime: 0,
      endTime: 40,
      isIntro: true,
      text: 'Section 3. You will hear two students called Carla and Rob discussing their presentation on urban planning. First, you have some time to look at questions 21 to 30.',
      textZh: '【官方考场播音】第三部分。你将听到两名学生讨论城市规划展示汇报。请先审阅第 21 至 30 题。',
    },
    {
      id: 'c14-p3-s1',
      speaker: 'Carla & Rob',
      role: 'Urban Planning Students',
      accent: 'en-GB',
      startTime: 40,
      endTime: 160,
      text: 'Rob: OK Carla, let’s go through what we have. I was amazed to find that coastal cities contain nearly half the world’s population! Carla: Me too. And Rob: building coastal cities close to rivers may reduce the land available for agriculture, which is a major food security hazard.',
      textZh: '罗伯：卡拉，我吃惊地发现沿海城市居住了全球近一半的人口（21: A）！而且靠近河流建城会大幅减少可用于农业耕种的土地（22: B）。',
      questionNumbers: [21, 22],
    },
    {
      id: 'c14-p3-s2',
      speaker: 'Carla & Rob',
      role: 'Urban Planning Students',
      accent: 'en-GB',
      startTime: 160,
      endTime: 260,
      text: 'Carla: Looking at Miami in the 1950s, the drainage channels they built simply did not allow for the long-term effects of climate change (23: C). Rob: Exactly. What the Miami authorities need to do immediately is stop disposing of waste materials into the ocean (24: C). And for global policy, the priority must be greater coordination of activities (25: A).',
      textZh: '卡拉：迈阿密50年代修建的排水渠根本没有考虑到气候变化的长期影响（23: C）。罗伯：迈阿密当局目前最紧迫该做的是立即停止将废弃物倾倒进海洋（24: C）。国际行动的首要任务应当是增强各项行动的协调（25: A）。',
      questionNumbers: [23, 24, 25],
    },
    {
      id: 'c14-p3-s3',
      speaker: 'Carla & Rob',
      role: 'Urban Planning Students',
      accent: 'en-GB',
      startTime: 260,
      endTime: 431,
      text: 'Now for structuring the slides: Historical background: we don’t want to spend too long on that, so keep it short (26: B). Geographical factors: let’s use visuals so everyone can see the maps (27: A). Past mistakes: rather than listing dozens, let’s focus on one example—the New Orleans flooding (28: F). Future risks: we need to do some more online research to check the latest stats (29: G). International implications: let’s involve other students by asking the audience for their opinions (30: C).',
      textZh: '幻灯片安排：历史背景不要讲太长，尽量精简（26: B）；地理要素用图表视觉展示（27: A）；过去的教训聚焦新奥尔良单一典型案例（28: F）；未来风险需要做更多线上检索（29: G）；国际影响调动在场同学互动讨论（30: C）。',
      questionNumbers: [26, 27, 28, 29, 30],
    },
  ],
  questions: [
    {
      id: 'c14-p3-q21',
      questionNumber: 21,
      partNumber: 3,
      type: 'multiple_choice',
      groupTitle: 'Questions 21–25 · Coastal Cities Discussion',
      groupTitleZh: '第 21–25 题 · 沿海城市环境挑战（单项选择）',
      instruction: 'Choose the correct letter, A, B or C.',
      instructionZh: '从 A、B、C 中选择正确的一项。',
      prompt: 'Carla and Rob were surprised to learn that coastal cities',
      promptZh: '卡拉与罗伯感到震惊的是，沿海城市：',
      options: [
        { label: 'A', text: 'contain nearly half the world’s population', textZh: '居住了全球接近一半的人口' },
        { label: 'B', text: 'include most of the world’s largest cities', textZh: '包含世界上大多数特大城市' },
        { label: 'C', text: 'are growing twice as fast as other cities', textZh: '扩张速度是其他城市的两倍' },
      ],
      correctAnswer: 'A',
      evidenceSegmentId: 'c14-p3-s1',
      evidenceQuote: 'I was amazed to find that coastal cities contain nearly half the world’s population!',
      evidenceQuoteZh: '我吃惊地发现沿海城市居住了全球近一半的人口！',
      paraphrase: {
        questionTerm: 'were surprised to learn',
        spokenTerm: 'I was amazed to find',
        explanationZh: 'surprised 对应 amazed。',
        explanationEn: '"amazed" paraphrases "surprised".',
      },
      distractorTrap: {
        wrongCandidate: 'B',
        trapZh: '特大城市在对话中有提，但非让他惊讶的核心数据。',
        trapEn: 'Largest cities is mentioned without the surprise element.',
      },
      keyVocab: { word: 'coastal', ipa: '/ˈkəʊstl/', meaningZh: 'adj. 沿海的；海岸的' },
    },
    {
      id: 'c14-p3-q22',
      questionNumber: 22,
      partNumber: 3,
      type: 'multiple_choice',
      prompt: 'According to Rob, building coastal cities near to rivers',
      promptZh: '罗伯指出，在河流附近建设沿海城市：',
      options: [
        { label: 'A', text: 'may bring pollution to the cities', textZh: '可能给城市带来污染' },
        { label: 'B', text: 'may reduce the land available for agriculture', textZh: '会减少可用于农业耕作的土地' },
        { label: 'C', text: 'may mean the countryside is spoiled by industry', textZh: '意味着乡村被工业毁坏' },
      ],
      correctAnswer: 'B',
      evidenceSegmentId: 'c14-p3-s1',
      evidenceQuote: 'building coastal cities close to rivers may reduce the land available for agriculture',
      evidenceQuoteZh: '靠近河流建城会大幅减少可用于农业耕种的土地。',
      paraphrase: {
        questionTerm: 'reduce the land available for agriculture',
        spokenTerm: 'reduce the land available for agriculture',
        explanationZh: '原词直接复现。',
        explanationEn: 'Exact phrase used in the audio.',
      },
      distractorTrap: {
        wrongCandidate: 'A',
        trapZh: '污染是城市给河流造成的，而非河流给城市带去污染。',
        trapEn: 'Reversal of causal direction regarding pollution.',
      },
      keyVocab: { word: 'agriculture', ipa: '/ˈæɡrɪkʌltʃə/', meaningZh: 'n. 农业' },
    },
    {
      id: 'c14-p3-q23',
      questionNumber: 23,
      partNumber: 3,
      type: 'multiple_choice',
      prompt: 'What mistake was made when building water drainage channels in Miami in the 1950s?',
      promptZh: '20世纪50年代在迈阿密修建排水渠时犯了什么错误？',
      options: [
        { label: 'A', text: 'There were not enough of them', textZh: '数量不够' },
        { label: 'B', text: 'They were made of unsuitable materials', textZh: '使用了不合适的建材' },
        { label: 'C', text: 'They did not allow for the effects of climate change', textZh: '未考虑到气候变化的影响' },
      ],
      correctAnswer: 'C',
      evidenceSegmentId: 'c14-p3-s2',
      evidenceQuote: 'the drainage channels they built simply did not allow for the long-term effects of climate change',
      evidenceQuoteZh: '他们建造的排水渠根本没有考虑到气候变化的长期影响。',
      paraphrase: {
        questionTerm: 'did not allow for the effects of climate change',
        spokenTerm: 'did not allow for the long-term effects of climate change',
        explanationZh: '原词直接复现 did not allow for。',
        explanationEn: 'Direct match in the audio script.',
      },
      distractorTrap: {
        wrongCandidate: 'B',
        trapZh: '对话未提及材质问题，为无中生有。',
        trapEn: 'Unsuitable materials is never cited.',
      },
      keyVocab: { word: 'drainage', ipa: '/ˈdreɪnɪdʒ/', meaningZh: 'n. 排水；排水系统' },
    },
    {
      id: 'c14-p3-q24',
      questionNumber: 24,
      partNumber: 3,
      type: 'multiple_choice',
      prompt: 'What do Rob and Carla think that the authorities in Miami should do immediately?',
      promptZh: '罗伯和卡拉认为迈阿密当局应立即采取什么措施？',
      options: [
        { label: 'A', text: 'take measures to restore ecosystems', textZh: '采取措施恢复生态系统' },
        { label: 'B', text: 'pay for a new flood prevention system', textZh: '资助新的防洪系统' },
        { label: 'C', text: 'stop disposing of waste materials into the ocean', textZh: '停止向海洋倾倒废弃物' },
      ],
      correctAnswer: 'C',
      evidenceSegmentId: 'c14-p3-s2',
      evidenceQuote: 'What the Miami authorities need to do immediately is stop disposing of waste materials into the ocean.',
      evidenceQuoteZh: '迈阿密当局目前最紧迫该做的是立即停止将废弃物倾倒进海洋。',
      paraphrase: {
        questionTerm: 'stop disposing of waste materials into the ocean',
        spokenTerm: 'stop disposing of waste materials into the ocean',
        explanationZh: '原词直接复现。',
        explanationEn: 'Exact wording used for immediate authority action.',
      },
      distractorTrap: {
        wrongCandidate: 'B',
        trapZh: '防洪系统是长期方案，非 immediately（立即）。',
        trapEn: 'Flood systems are a long-term goal, not immediate.',
      },
      keyVocab: { word: 'disposing', ipa: '/dɪˈspəʊzɪŋ/', meaningZh: 'n./v. 处理；倾倒（dispose of）' },
    },
    {
      id: 'c14-p3-q25',
      questionNumber: 25,
      partNumber: 3,
      type: 'multiple_choice',
      prompt: 'What do they agree should be the priority for international action?',
      promptZh: '他们一致同意国际行动的首要任务应当是：',
      options: [
        { label: 'A', text: 'greater coordination of activities', textZh: '更大力度协调各项行动' },
        { label: 'B', text: 'more sharing of information', textZh: '更多的信息共享' },
        { label: 'C', text: 'agreement on shared policies', textZh: '就共同政策达成协议' },
      ],
      correctAnswer: 'A',
      evidenceSegmentId: 'c14-p3-s2',
      evidenceQuote: 'And for global policy, the priority must be greater coordination of activities.',
      evidenceQuoteZh: '国际行动的首要任务应当是增强各项行动的协调。',
      paraphrase: {
        questionTerm: 'greater coordination of activities',
        spokenTerm: 'greater coordination of activities',
        explanationZh: '原词直接复现。',
        explanationEn: 'Direct match for international priority.',
      },
      distractorTrap: {
        wrongCandidate: 'B',
        trapZh: '信息共享在后面提及，但不是 priority（最优先）。',
        trapEn: 'Sharing info was noted, but not assigned top priority.',
      },
      keyVocab: { word: 'coordination', ipa: '/kəʊˌɔːdɪˈneɪʃn/', meaningZh: 'n. 协调；统筹' },
    },
    {
      id: 'c14-p3-q26',
      questionNumber: 26,
      partNumber: 3,
      type: 'matching',
      groupTitle: 'Questions 26–30 · Structuring the Presentation Slides',
      groupTitleZh: '第 26–30 题 · 汇报展示各板块处理方式配对（A–G）',
      instruction: 'What decision do the students make about each section of their presentation? Choose A–G.',
      instructionZh: '根据录音讨论，为展示的各个板块匹配正确的处理决策（A–G）。',
      prompt: '26. Historical background',
      promptZh: '26. 历史背景 (Historical background)',
      options: [
        { label: 'A', text: 'A · use visuals' },
        { label: 'B', text: 'B · keep it short' },
        { label: 'C', text: 'C · involve other students' },
        { label: 'D', text: 'D · check pronunciation' },
        { label: 'E', text: 'E · provide a handout' },
        { label: 'F', text: 'F · focus on one example' },
        { label: 'G', text: 'G · do online research' },
      ],
      correctAnswer: 'B',
      evidenceSegmentId: 'c14-p3-s3',
      evidenceQuote: 'Historical background: we don’t want to spend too long on that, so keep it short',
      evidenceQuoteZh: '历史背景：我们不想在这花太多时间，尽量精简（keep it short）。',
      paraphrase: {
        questionTerm: 'keep it short',
        spokenTerm: 'don’t want to spend too long... keep it short',
        explanationZh: '原词复现 keep it short。',
        explanationEn: 'Direct match for keep it short.',
      },
      distractorTrap: {
        wrongCandidate: 'E',
        trapZh: '他们不打算给历史部分发讲义，而是直接缩短。',
        trapEn: 'No handout is planned for history.',
      },
      keyVocab: { word: 'historical', ipa: '/hɪˈstɒrɪkl/', meaningZh: 'adj. 历史的' },
    },
    {
      id: 'c14-p3-q27',
      questionNumber: 27,
      partNumber: 3,
      type: 'matching',
      prompt: '27. Geographical factors',
      promptZh: '27. 地理因素 (Geographical factors)',
      options: [
        { label: 'A', text: 'A · use visuals' },
        { label: 'B', text: 'B · keep it short' },
        { label: 'C', text: 'C · involve other students' },
        { label: 'D', text: 'D · check pronunciation' },
        { label: 'E', text: 'E · provide a handout' },
        { label: 'F', text: 'F · focus on one example' },
        { label: 'G', text: 'G · do online research' },
      ],
      correctAnswer: 'A',
      evidenceSegmentId: 'c14-p3-s3',
      evidenceQuote: 'Geographical factors: let’s use visuals so everyone can see the maps',
      evidenceQuoteZh: '地理要素：用直观图表展示，大家都能看清地图（use visuals）。',
      paraphrase: {
        questionTerm: 'use visuals',
        spokenTerm: 'use visuals so everyone can see the maps',
        explanationZh: 'use visuals 原词复现。',
        explanationEn: 'Direct match for visuals.',
      },
      distractorTrap: {
        wrongCandidate: 'D',
        trapZh: '地理名词很多，但他们决定用图表而非仅仅查发音。',
        trapEn: 'Visual maps chosen rather than pronunciation checks.',
      },
      keyVocab: { word: 'geographical', ipa: '/ˌdʒiːəˈɡræfɪkl/', meaningZh: 'adj. 地理的' },
    },
    {
      id: 'c14-p3-q28',
      questionNumber: 28,
      partNumber: 3,
      type: 'matching',
      prompt: '28. Past mistakes',
      promptZh: '28. 过去的教训 (Past mistakes)',
      options: [
        { label: 'A', text: 'A · use visuals' },
        { label: 'B', text: 'B · keep it short' },
        { label: 'C', text: 'C · involve other students' },
        { label: 'D', text: 'D · check pronunciation' },
        { label: 'E', text: 'E · provide a handout' },
        { label: 'F', text: 'F · focus on one example' },
        { label: 'G', text: 'G · do online research' },
      ],
      correctAnswer: 'F',
      evidenceSegmentId: 'c14-p3-s3',
      evidenceQuote: 'Past mistakes: rather than listing dozens, let’s focus on one example—the New Orleans flooding',
      evidenceQuoteZh: '与其列出几十个，不如聚焦单一案例——新奥尔良洪水（focus on one example）。',
      paraphrase: {
        questionTerm: 'focus on one example',
        spokenTerm: 'focus on one example—the New Orleans flooding',
        explanationZh: '原词复现 focus on one example。',
        explanationEn: 'Exact match for focus on one example.',
      },
      distractorTrap: {
        wrongCandidate: 'B',
        trapZh: '他们不是压缩略过，而是选了典型案例深剖。',
        trapEn: 'In-depth single case chosen over simple brevity.',
      },
      keyVocab: { word: 'mistake', ipa: '/mɪˈsteɪk/', meaningZh: 'n. 错误；失误' },
    },
    {
      id: 'c14-p3-q29',
      questionNumber: 29,
      partNumber: 3,
      type: 'matching',
      prompt: '29. Future risks',
      promptZh: '29. 未来风险 (Future risks)',
      options: [
        { label: 'A', text: 'A · use visuals' },
        { label: 'B', text: 'B · keep it short' },
        { label: 'C', text: 'C · involve other students' },
        { label: 'D', text: 'D · check pronunciation' },
        { label: 'E', text: 'E · provide a handout' },
        { label: 'F', text: 'F · focus on one example' },
        { label: 'G', text: 'G · do online research' },
      ],
      correctAnswer: 'G',
      evidenceSegmentId: 'c14-p3-s3',
      evidenceQuote: 'Future risks: we need to do some more online research to check the latest stats',
      evidenceQuoteZh: '未来风险：我们需要做更多线上检索（do online research）核实最新数据。',
      paraphrase: {
        questionTerm: 'do online research',
        spokenTerm: 'do some more online research',
        explanationZh: '原词复现 online research。',
        explanationEn: 'Direct match for online research.',
      },
      distractorTrap: {
        wrongCandidate: 'E',
        trapZh: '讲义并非首要，首要是先查清数据。',
        trapEn: 'Research needed before any handout can be prepared.',
      },
      keyVocab: { word: 'risk', ipa: '/rɪsk/', meaningZh: 'n. 风险；危险' },
    },
    {
      id: 'c14-p3-q30',
      questionNumber: 30,
      partNumber: 3,
      type: 'matching',
      prompt: '30. International implications',
      promptZh: '30. 国际影响 (International implications)',
      options: [
        { label: 'A', text: 'A · use visuals' },
        { label: 'B', text: 'B · keep it short' },
        { label: 'C', text: 'C · involve other students' },
        { label: 'D', text: 'D · check pronunciation' },
        { label: 'E', text: 'E · provide a handout' },
        { label: 'F', text: 'F · focus on one example' },
        { label: 'G', text: 'G · do online research' },
      ],
      correctAnswer: 'C',
      evidenceSegmentId: 'c14-p3-s3',
      evidenceQuote: 'International implications: let’s involve other students by asking the audience for their opinions',
      evidenceQuoteZh: '国际影响：通过向观众提问来调动其他同学互动（involve other students）。',
      paraphrase: {
        questionTerm: 'involve other students',
        spokenTerm: 'involve other students by asking the audience',
        explanationZh: '原词复现 involve other students。',
        explanationEn: 'Direct match for involving peers.',
      },
      distractorTrap: {
        wrongCandidate: 'A',
        trapZh: '最后部分不放图，而是进行问答互动。',
        trapEn: 'Interactive audience Q&A chosen over visuals.',
      },
      keyVocab: { word: 'implication', ipa: '/ˌɪmplɪˈkeɪʃn/', meaningZh: 'n. 影响；牵连' },
    },
  ],
}

const CAM14_T1_P4: ListeningPart = {
  partNumber: 4,
  title: 'Part 4: Marine Renewable Energy (Official Cambridge IELTS 14)',
  titleZh: 'Part 4：海洋可再生能源工程讲座（剑桥雅思 14 Test 1 官方真题）',
  contextLabel: 'University Engineering Lecture · British Professor',
  contextLabelZh: '大学工程学术讲座 · 英国教授独白原声（严格单词填空）',
  scenarioDescription:
    'A university engineering lecturer discusses the technical advantages and environmental trade-offs of ocean wave, tidal, and thermal energy conversion.',
  scenarioDescriptionZh:
    '工程学院教授解析海洋波浪能、潮汐能及温差能的技术优势与生态平衡挑战。',
  audioUrl: '/audio/listening/cam14-t1-s4.m4a',
  durationSeconds: 488,
  segments: [
    {
      id: 'c14-p4-s0',
      speaker: 'IELTS Official Narrator',
      role: 'Official Cambridge Test Announcer',
      accent: 'en-GB',
      startTime: 0,
      endTime: 45,
      isIntro: true,
      text: 'Section 4. You will hear part of a lecture on marine renewable energy. First, you have some time to look at questions 31 to 40.',
      textZh: '【官方考场播音】第四部分。你将听到一段关于海洋可再生能源的学术讲座。请先审阅第 31 至 40 题。',
    },
    {
      id: 'c14-p4-s1',
      speaker: 'Lecturer',
      role: 'Engineering Professor',
      accent: 'en-GB',
      startTime: 45,
      endTime: 160,
      text: 'Producing energy from sustainable sources has become vital as demand escalates due to the growth in population and industry (31: industry). Wave energy has the enormous advantage of providing a constant (32: constant) source of power. However, wave devices face the challenge that waves travel in more than one direction (33: direction), and securing generators to the ocean floor (34: floor) is technically demanding.',
      textZh: '随着人口和工业（31: industry）的增长，能源需求急剧上升。波浪能的巨大优势在于能提供持续不断（32: constant）的电力。然而波浪朝多个方向（33: direction）运动，且将发电机固定在海床海底（34: floor）技术难度极大。',
      questionNumbers: [31, 32, 33, 34],
    },
    {
      id: 'c14-p4-s2',
      speaker: 'Lecturer',
      role: 'Engineering Professor',
      accent: 'en-GB',
      startTime: 160,
      endTime: 300,
      text: 'Tidal energy, by contrast, is highly predictable (35: predictable), governed by celestial mechanics. Tidal lagoons enclose a coastal bay (36: bay) using a barrage. As the tide changes, water flows through large gates (37: gates) in the structure, spinning turbines and generating clean electricity.',
      textZh: '相比之下，潮汐能极其规律可预测（35: predictable）。潮汐潟湖利用堤坝将海湾（36: bay）围起。潮水涨落时水流穿过大型水闸（37: gates），推动水轮机转动发电。',
      questionNumbers: [35, 36, 37],
    },
    {
      id: 'c14-p4-s3',
      speaker: 'Lecturer',
      role: 'Engineering Professor',
      accent: 'en-GB',
      startTime: 300,
      endTime: 488,
      text: 'Ocean Thermal Energy Conversion (OTEC) exploits the thermal gradient between surface and deep water. Crucially, it consumes no conventional fuel (38: fuel). It can stimulate local coastal economies by creating jobs (39: jobs). However, changing thermal stratification can disrupt fish migration (40: migration) patterns.',
      textZh: '海洋温差能利用表层与深层水温梯度，完全无需消耗传统燃料（38: fuel）。它还能创造就业岗位（39: jobs），但可能干扰鱼类的洄游迁徙（40: migration）。',
      questionNumbers: [38, 39, 40],
    },
  ],
  questions: [
    {
      id: 'c14-p4-q31',
      questionNumber: 31,
      partNumber: 4,
      type: 'note_completion',
      groupTitle: 'Questions 31–40 · Marine Renewable Energy (Cambridge 14 Test 1)',
      groupTitleZh: '第 31–40 题 · 海洋可再生能源讲座笔记（单字填空 ONE WORD ONLY）',
      instruction: 'Complete the notes below. Write ONE WORD ONLY for each answer.',
      instructionZh: '完成下方讲座笔记。每空严格限制填一个单词（ONE WORD ONLY）。',
      notePrefix: 'Energy demand rising due to expansion of population and',
      noteSuffix: '',
      prompt: 'Expansion of population and ___',
      promptZh: '人口与 ___ 的扩张',
      correctAnswer: 'industry',
      acceptableAnswers: ['industry'],
      evidenceSegmentId: 'c14-p4-s1',
      evidenceQuote: 'demand escalates due to the growth in population and industry',
      evidenceQuoteZh: '能源需求因人口与工业（industry）的增长而攀升。',
      paraphrase: {
        questionTerm: 'expansion of population and ___',
        spokenTerm: 'growth in population and industry',
        explanationZh: 'growth in 对应 expansion of。',
        explanationEn: '"growth in" paraphrases "expansion of".',
      },
      distractorTrap: {
        wrongCandidate: 'population',
        trapZh: 'population 已在题干给出，空缺为 industry。',
        trapEn: '"population" is already printed in the notes.',
      },
      keyVocab: { word: 'industry', ipa: '/ˈɪndəstri/', meaningZh: 'n. 工业；行业' },
    },
    {
      id: 'c14-p4-q32',
      questionNumber: 32,
      partNumber: 4,
      type: 'note_completion',
      notePrefix: 'Wave power advantage: provides a',
      noteSuffix: 'source of clean energy',
      prompt: 'Provides a ___ source of clean energy',
      promptZh: '提供 ___ 的清洁能源来源',
      correctAnswer: 'constant',
      acceptableAnswers: ['constant'],
      evidenceSegmentId: 'c14-p4-s1',
      evidenceQuote: 'Wave energy has the enormous advantage of providing a constant source of power.',
      evidenceQuoteZh: '波浪能具有提供持续稳定（constant）电力的巨大优势。',
      paraphrase: {
        questionTerm: 'provides a ___ source',
        spokenTerm: 'providing a constant source',
        explanationZh: '原词复现 constant。',
        explanationEn: 'Exact match for constant.',
      },
      distractorTrap: {
        wrongCandidate: 'clean',
        trapZh: 'clean 已在题干，空缺形容词为 constant。',
        trapEn: '"clean" is already present in the note stem.',
      },
      keyVocab: { word: 'constant', ipa: '/ˈkɒnstənt/', meaningZh: 'adj. 持续不断的；恒定的' },
    },
    {
      id: 'c14-p4-q33',
      questionNumber: 33,
      partNumber: 4,
      type: 'note_completion',
      notePrefix: 'Problem: ocean waves move in more than one',
      noteSuffix: '',
      prompt: 'Waves move in more than one ___',
      promptZh: '海浪朝不止一个 ___ 运动',
      correctAnswer: 'direction',
      acceptableAnswers: ['direction'],
      evidenceSegmentId: 'c14-p4-s1',
      evidenceQuote: 'waves travel in more than one direction',
      evidenceQuoteZh: '海浪向不止一个方向（direction）传播。',
      paraphrase: {
        questionTerm: 'move in more than one ___',
        spokenTerm: 'travel in more than one direction',
        explanationZh: 'travel 对应 move。',
        explanationEn: '"travel" paraphrases "move".',
      },
      distractorTrap: {
        wrongCandidate: 'directions',
        trapZh: 'more than one 后面接单数名词 direction。',
        trapEn: '"more than one" takes a singular noun ("direction").',
      },
      keyVocab: { word: 'direction', ipa: '/dəˈrekʃn/', meaningZh: 'n. 方向' },
    },
    {
      id: 'c14-p4-q34',
      questionNumber: 4,
      partNumber: 4,
      type: 'note_completion',
      notePrefix: 'Generators must be anchored firmly to the ocean',
      noteSuffix: '',
      prompt: 'Anchored firmly to the ocean ___',
      promptZh: '牢固固定在海 ___',
      correctAnswer: 'floor',
      acceptableAnswers: ['floor'],
      evidenceSegmentId: 'c14-p4-s1',
      evidenceQuote: 'securing generators to the ocean floor is technically demanding.',
      evidenceQuoteZh: '将发电机固定在海床（ocean floor）技术要求极高。',
      paraphrase: {
        questionTerm: 'anchored firmly to the ocean ___',
        spokenTerm: 'securing generators to the ocean floor',
        explanationZh: 'securing 对应 anchored firmly。',
        explanationEn: '"securing" matches "anchored firmly".',
      },
      distractorTrap: {
        wrongCandidate: 'bed',
        trapZh: '虽然日常说 sea bed，但录音明确说的是 ocean floor。',
        trapEn: 'The speaker explicitly uses "ocean floor".',
      },
      keyVocab: { word: 'floor', ipa: '/flɔː/', meaningZh: 'n. 底面；海床（ocean floor）' },
    },
    {
      id: 'c14-p4-q35',
      questionNumber: 35,
      partNumber: 4,
      type: 'note_completion',
      notePrefix: 'Tidal energy is highly',
      noteSuffix: 'unlike wind power',
      prompt: 'Tidal energy is highly ___',
      promptZh: '与风能不同，潮汐能高度 ___',
      correctAnswer: 'predictable',
      acceptableAnswers: ['predictable'],
      evidenceSegmentId: 'c14-p4-s2',
      evidenceQuote: 'Tidal energy, by contrast, is highly predictable, governed by celestial mechanics.',
      evidenceQuoteZh: '相比之下，受天体引力影响的潮汐能高度可预测（predictable）。',
      paraphrase: {
        questionTerm: 'is highly ___',
        spokenTerm: 'is highly predictable',
        explanationZh: '原词复现 predictable。',
        explanationEn: 'Exact adjective used in lecture.',
      },
      distractorTrap: {
        wrongCandidate: 'constant',
        trapZh: 'constant 是波浪能的特点，潮汐能的特点是 predictable。',
        trapEn: '"constant" was for waves; "predictable" is for tides.',
      },
      keyVocab: { word: 'predictable', ipa: '/prɪˈdɪktəbl/', meaningZh: 'adj. 可预报的；规律可循的' },
    },
    {
      id: 'c14-p4-q36',
      questionNumber: 36,
      partNumber: 4,
      type: 'note_completion',
      notePrefix: 'Tidal lagoons enclose a coastal',
      noteSuffix: 'behind a barrage',
      prompt: 'Enclose a coastal ___ behind a barrage',
      promptZh: '在堤坝后围出一段沿海 ___',
      correctAnswer: 'bay',
      acceptableAnswers: ['bay'],
      evidenceSegmentId: 'c14-p4-s2',
      evidenceQuote: 'Tidal lagoons enclose a coastal bay using a barrage.',
      evidenceQuoteZh: '潮汐潟湖利用堤坝将沿海海湾（bay）围起。',
      paraphrase: {
        questionTerm: 'enclose a coastal ___',
        spokenTerm: 'enclose a coastal bay',
        explanationZh: '原词直接定位 bay。',
        explanationEn: 'Direct match for bay.',
      },
      distractorTrap: {
        wrongCandidate: 'lagoon',
        trapZh: 'lagoon 已在题干开头，修饰名词为 bay。',
        trapEn: '"lagoon" is the subject of the sentence.',
      },
      keyVocab: { word: 'bay', ipa: '/beɪ/', meaningZh: 'n. 海湾' },
    },
    {
      id: 'c14-p4-q37',
      questionNumber: 37,
      partNumber: 4,
      type: 'note_completion',
      notePrefix: 'Water passes through large',
      noteSuffix: 'to spin turbines',
      prompt: 'Water passes through large ___',
      promptZh: '水流穿过大型 ___',
      correctAnswer: 'gates',
      acceptableAnswers: ['gates'],
      evidenceSegmentId: 'c14-p4-s2',
      evidenceQuote: 'water flows through large gates in the structure, spinning turbines',
      evidenceQuoteZh: '水流穿过构造物上的大型水闸（gates），推动水轮机。',
      paraphrase: {
        questionTerm: 'passes through large ___',
        spokenTerm: 'flows through large gates',
        explanationZh: 'flows through 对应 passes through。',
        explanationEn: '"flows through" paraphrases "passes through".',
      },
      distractorTrap: {
        wrongCandidate: 'turbines',
        trapZh: '水流穿过的是水闸（gates），去推动水轮机（turbines）。',
        trapEn: 'Water flows through the "gates" to turn the "turbines".',
      },
      keyVocab: { word: 'gate', ipa: '/ɡeɪt/', meaningZh: 'n. 水闸；闸门' },
    },
    {
      id: 'c14-p4-q38',
      questionNumber: 38,
      partNumber: 4,
      type: 'note_completion',
      notePrefix: 'OTEC operates without using any conventional',
      noteSuffix: '',
      prompt: 'Operates without using any conventional ___',
      promptZh: '运转时无需使用任何传统 ___',
      correctAnswer: 'fuel',
      acceptableAnswers: ['fuel'],
      evidenceSegmentId: 'c14-p4-s3',
      evidenceQuote: 'Crucially, it consumes no conventional fuel.',
      evidenceQuoteZh: '关键在于，它完全不消耗传统燃料（fuel）。',
      paraphrase: {
        questionTerm: 'without using any conventional ___',
        spokenTerm: 'consumes no conventional fuel',
        explanationZh: 'consumes no 对应 without using any。',
        explanationEn: '"consumes no" maps to "without using any".',
      },
      distractorTrap: {
        wrongCandidate: 'energy',
        trapZh: '它本身是 energy，消耗的是燃料 fuel。',
        trapEn: 'The noun is "fuel", not "energy".',
      },
      keyVocab: { word: 'fuel', ipa: '/ˈfjuːəl/', meaningZh: 'n. 燃料' },
    },
    {
      id: 'c14-p4-q39',
      questionNumber: 39,
      partNumber: 4,
      type: 'note_completion',
      notePrefix: 'Local economic benefit: creates new',
      noteSuffix: 'for communities',
      prompt: 'Creates new ___ for communities',
      promptZh: '为社区创造新的 ___',
      correctAnswer: 'jobs',
      acceptableAnswers: ['jobs', 'job'],
      evidenceSegmentId: 'c14-p4-s3',
      evidenceQuote: 'It can stimulate local coastal economies by creating jobs.',
      evidenceQuoteZh: '它能够通过创造就业（jobs）来刺激当地沿海经济。',
      paraphrase: {
        questionTerm: 'creates new ___ for communities',
        spokenTerm: 'creating jobs',
        explanationZh: '原词复现 jobs。',
        explanationEn: 'Exact match for jobs.',
      },
      distractorTrap: {
        wrongCandidate: 'economies',
        trapZh: '刺激的是经济，创造的是就业岗位 jobs。',
        trapEn: '"economies" are stimulated; "jobs" are created.',
      },
      keyVocab: { word: 'job', ipa: '/dʒɒb/', meaningZh: 'n. 工作；就业岗位' },
    },
    {
      id: 'c14-p4-q40',
      questionNumber: 40,
      partNumber: 4,
      type: 'note_completion',
      notePrefix: 'Environmental drawback: alters fish',
      noteSuffix: 'routes and habits',
      prompt: 'Alters fish ___ routes',
      promptZh: '改变鱼类 ___ 路线',
      correctAnswer: 'migration',
      acceptableAnswers: ['migration'],
      evidenceSegmentId: 'c14-p4-s3',
      evidenceQuote: 'However, changing thermal stratification can disrupt fish migration patterns.',
      evidenceQuoteZh: '然而，改变水温层可能扰乱鱼类的洄游迁徙（migration）规律。',
      paraphrase: {
        questionTerm: 'alters fish ___ routes',
        spokenTerm: 'disrupt fish migration patterns',
        explanationZh: 'disrupt 对应 alters；修饰 fish 的名词是 migration。',
        explanationEn: '"disrupt" maps to "alters", taking "migration".',
      },
      distractorTrap: {
        wrongCandidate: 'patterns',
        trapZh: '题干已经有 routes，缺少的核心生态词汇是 migration。',
        trapEn: '"routes" parallels "patterns", leaving "migration" as the target.',
      },
      keyVocab: { word: 'migration', ipa: '/maɪˈɡreɪʃn/', meaningZh: 'n. 迁徙；洄游' },
    },
  ],
}

export const LISTENING_TESTS: ListeningTest[] = [
  {
    id: 'cambridge-ielts-14-test-1',
    slug: 'cambridge-ielts-14-test-1-authentic',
    title: 'Cambridge IELTS 14 Test 1 (Full 4-Part Official Authentic Exam Audio)',
    titleZh: '剑桥雅思 14 Test 1 全真官方母带试卷（100% 真实考官原声 · 完整 40 题）',
    subtitle: 'Direct audio master from official Cambridge Assessment English CDs: Crime Report, Apprenticeship Talk, Coastal Cities & Marine Energy.',
    subtitleZh: '来自剑桥大学考试委员会官方光盘原声音频母带：报案登记、学徒入职培训、沿海城市研讨及海洋可再生能源完整 40 题。',
    category: 'full',
    difficulty: 'Band 6.0–8.5 (Official Cambridge Exam)',
    durationSeconds: 1845,
    parts: [CAM14_T1_P1, CAM14_T1_P2, CAM14_T1_P3, CAM14_T1_P4],
  },
  {
    id: 'cambridge-14-t1-part-1',
    slug: 'cambridge-14-test-1-part-1-crime-report',
    title: 'Cambridge 14 Test 1 Part 1: Crime Report Form (Official Audio)',
    titleZh: '剑桥 14 Test 1 Part 1：报案登记表（官方原声精听）',
    subtitle: 'Master Canadian nationality, £250 cash, museum location, and 10-digit crime reference number.',
    subtitleZh: '攻克加拿大国籍、250 英镑、博物馆地点及 10 位案件参考编号等官方真题考点。',
    category: 'part1',
    difficulty: 'Band 6.0–7.5',
    durationSeconds: 523,
    parts: [CAM14_T1_P1],
  },
  {
    id: 'cambridge-14-t1-part-2',
    slug: 'cambridge-14-test-1-part-2-apprenticeship',
    title: 'Cambridge 14 Test 1 Part 2: Induction Talk for Apprentices (Official Audio)',
    titleZh: '剑桥 14 Test 1 Part 2：新学徒入职培训（官方原声精听）',
    subtitle: 'Workplace policy matching: internet restrictions, holiday rules, overtime, and trainers in the office.',
    subtitleZh: '职场规章制度经典配对题：上网限制、休假纪律、周末加班鼓励与办公室着装。',
    category: 'part2',
    difficulty: 'Band 6.5–8.0',
    durationSeconds: 405,
    parts: [CAM14_T1_P2],
  },
  {
    id: 'cambridge-14-t1-part-3',
    slug: 'cambridge-14-test-1-part-3-coastal-cities',
    title: 'Cambridge 14 Test 1 Part 3: Cities Built by the Sea (Official Audio)',
    titleZh: '剑桥 14 Test 1 Part 3：沿海城市规划课题研讨（官方原声精听）',
    subtitle: 'Coastal population density, Miami drainage mistakes, and presentation structure decisions.',
    subtitleZh: '沿海人口集中度、迈阿密排水渠历史教训与学术汇报各板块处理方案。',
    category: 'part3',
    difficulty: 'Band 7.0–8.5',
    durationSeconds: 431,
    parts: [CAM14_T1_P3],
  },
  {
    id: 'cambridge-14-t1-part-4',
    slug: 'cambridge-14-test-1-part-4-marine-energy',
    title: 'Cambridge 14 Test 1 Part 4: Marine Renewable Energy (Official Audio)',
    titleZh: '剑桥 14 Test 1 Part 4：海洋可再生能源工程讲座（官方原声精听）',
    subtitle: 'High-level engineering lecture: ocean floor, tidal lagoon gates, fuel-free OTEC, and fish migration.',
    subtitleZh: '高难度学术讲座单字填空：海床海底、潮汐潟湖水闸、零燃料温差能与鱼类迁徙。',
    category: 'part4',
    difficulty: 'Band 7.5–9.0',
    durationSeconds: 488,
    parts: [CAM14_T1_P4],
  },
]

export function normalizeListeningAnswer(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^£/, '')
    .replace(/\s+/g, ' ')
}

export function isListeningAnswerCorrect(question: ListeningQuestion, userRaw: string): boolean {
  const cleaned = normalizeListeningAnswer(userRaw)
  if (!cleaned) return false
  const candidates = [question.correctAnswer, ...(question.acceptableAnswers ?? [])]
  return candidates.some((candidate) => normalizeListeningAnswer(candidate) === cleaned)
}

export function estimateListeningBand(correct: number, total: number): number {
  if (total <= 0) return 0
  const scaled40 = Math.round((correct / total) * 40)
  if (scaled40 >= 39) return 9.0
  if (scaled40 >= 37) return 8.5
  if (scaled40 >= 35) return 8.0
  if (scaled40 >= 32) return 7.5
  if (scaled40 >= 30) return 7.0
  if (scaled40 >= 26) return 6.5
  if (scaled40 >= 23) return 6.0
  if (scaled40 >= 18) return 5.5
  if (scaled40 >= 16) return 5.0
  if (scaled40 >= 13) return 4.5
  if (scaled40 >= 10) return 4.0
  return 3.5
}

const LISTENING_HISTORY_KEY = 'projectdesk.listening.history.v1'

export function loadListeningHistory(): ListeningAttemptRecord[] {
  try {
    const raw = localStorage.getItem(LISTENING_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ListeningAttemptRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveListeningAttempt(
  test: ListeningTest,
  mode: 'practice' | 'exam',
  answers: Record<number, string>,
  elapsedSeconds: number,
): ListeningAttemptRecord {
  const allQuestions = test.parts.flatMap((part) => part.questions)
  let correctCount = 0
  const byPart: Record<number, { correct: number; total: number }> = {}
  const byType: Record<ListeningQuestionType, { correct: number; total: number }> = {
    note_completion: { correct: 0, total: 0 },
    multiple_choice: { correct: 0, total: 0 },
    matching: { correct: 0, total: 0 },
    map_labelling: { correct: 0, total: 0 },
  }

  for (const q of allQuestions) {
    const ok = isListeningAnswerCorrect(q, answers[q.questionNumber] ?? '')
    if (ok) correctCount++
    const partBucket = byPart[q.partNumber] ?? { correct: 0, total: 0 }
    partBucket.total++
    if (ok) partBucket.correct++
    byPart[q.partNumber] = partBucket

    byType[q.type].total++
    if (ok) byType[q.type].correct++
  }

  const record: ListeningAttemptRecord = {
    id: `listen-${Date.now()}`,
    testId: test.id,
    testTitle: test.title,
    testTitleZh: test.titleZh,
    mode,
    completedAt: new Date().toISOString(),
    elapsedSeconds,
    correctCount,
    totalQuestions: allQuestions.length,
    estimatedBand: estimateListeningBand(correctCount, allQuestions.length),
    answers,
    byPart,
    byType,
  }

  try {
    const prev = loadListeningHistory()
    const next = [record, ...prev].slice(0, 30)
    localStorage.setItem(LISTENING_HISTORY_KEY, JSON.stringify(next))
  } catch {
    /* ignore storage limits */
  }

  return record
}
