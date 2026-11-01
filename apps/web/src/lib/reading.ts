export type ReadingQuestionType =
  | 'multiple_choice'
  | 'tfng'
  | 'ynng'
  | 'matching_headings'
  | 'matching_information'
  | 'matching_features'
  | 'matching_sentence_endings'
  | 'sentence_completion'
  | 'summary_completion'
  | 'table_completion'
  | 'diagram_completion'
  | 'short_answer'

export type ReadingParagraph = {
  label: string
  heading?: string
  text: string
}

export type ReadingPassage = {
  id: string
  index: number
  title: string
  subtitle?: string
  wordCount: number
  paragraphs: ReadingParagraph[]
}

export type ReadingQuestion = {
  id: string
  number: number
  passageId: string
  type: ReadingQuestionType
  groupInstruction?: string
  contextText?: string
  prompt: string
  options?: string[]
  wordLimit?: number
  correctAnswer?: string
  acceptableAnswers?: string[]
  explanation?: string
  explanationZh?: string
  evidenceParagraph?: string
  evidenceQuote?: string
}

export type ReadingTest = {
  id: string
  slug: string
  title: string
  subtitle: string
  module: 'academic' | 'general'
  category: 'full' | 'passage' | 'question_type'
  difficulty: string
  durationSeconds: number
  questionCount: number
  questionTypes?: ReadingQuestionType[]
  passages: ReadingPassage[]
  questions?: ReadingQuestion[]
  createdAt: string
}

export type ReadingHighlight = {
  id: string
  passageId: string
  paragraphLabel: string
  text: string
  color: 'amber' | 'emerald' | 'sky'
  note?: string
}

export type ReadingQuestionResult = {
  questionId: string
  number: number
  passageId: string
  type: ReadingQuestionType
  userAnswer: string
  correctAnswer: string
  acceptableAnswers?: string[]
  correct: boolean
  explanation: string
  explanationZh?: string
  evidenceParagraph?: string
  evidenceQuote?: string
}

export type ReadingTypeBreakdown = {
  type: ReadingQuestionType
  correct: number
  total: number
  percent: number
}

export type ReadingSessionResults = {
  score: number
  total: number
  scaledOutOf40: number
  band: number
  accuracy: number
  timeSpent: number
  byType: ReadingTypeBreakdown[]
  questions: ReadingQuestionResult[]
}

export type ReadingSession = {
  id: string
  testId: string
  testTitle: string
  mode: 'practice' | 'exam'
  module: 'academic' | 'general'
  status: 'active' | 'submitted'
  durationSeconds: number
  elapsedSeconds: number
  answers: Record<string, string>
  flags: Record<string, boolean>
  bookmarks: Record<string, boolean>
  highlights: ReadingHighlight[]
  score: number
  total: number
  band: number
  results?: ReadingSessionResults
  startedAt: string
  submittedAt?: string
  updatedAt: string
  kind?: 'standard' | 'daily' | 'mistake_review'
  challengeDay?: string
  xpEarned?: number
}

export type ReadingSessionBundle = {
  session: ReadingSession
  test: ReadingTest
}

export type ReadingAnalytics = {
  totalSessions: number
  completedExams: number
  averageBand: number
  highestBand: number
  averageAccuracy: number
  totalTimeSeconds: number
  byType: ReadingTypeBreakdown[]
  recentSessions: ReadingSession[]
}

export type ReadingAIExplanation = {
  questionId: string
  correctAnswer: string
  whyCorrect: string
  whyWrong: string
  evidenceParagraph: string
  evidenceQuote: string
  chineseSummary: string
  simulated: boolean
}

export type ReadingVocabResponse = {
  term: string
  pos: string
  definition: string
  chinese: string
  synonyms: string[]
  examples: string[]
  examplesZh: string[]
  simulated: boolean
}

export type ReadingGenerateRequest = {
  topic: string
  module: 'academic' | 'general'
  difficulty: string
  questionTypes: ReadingQuestionType[]
}

export const QUESTION_TYPE_LABELS: Record<ReadingQuestionType, { en: string; zh: string }> = {
  multiple_choice: { en: 'Multiple Choice', zh: '多项选择题' },
  tfng: { en: 'True / False / Not Given', zh: '判断题 (T/F/NG)' },
  ynng: { en: 'Yes / No / Not Given', zh: '观点判断题 (Y/N/NG)' },
  matching_headings: { en: 'Matching Headings', zh: '段落标题配对' },
  matching_information: { en: 'Matching Information', zh: '段落信息配对' },
  matching_features: { en: 'Matching Features', zh: '特征/人物配对' },
  matching_sentence_endings: { en: 'Matching Sentence Endings', zh: '句尾配对' },
  sentence_completion: { en: 'Sentence Completion', zh: '句子填空' },
  summary_completion: { en: 'Summary Completion', zh: '摘要填空' },
  table_completion: { en: 'Note / Table / Flowchart Completion', zh: '笔记/表格/流程图填空' },
  diagram_completion: { en: 'Diagram Label Completion', zh: '图表标签填空' },
  short_answer: { en: 'Short Answer Questions', zh: '简答题' },
}

export const ALL_QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS) as ReadingQuestionType[]

export function formatDurationClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function countAnswerWords(input: string): number {
  const trimmed = input.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export type LearningDay = { day: string; reading: number; vocabulary: number; xp: number }
export type LearningProgress = {
  xp: number
  streak: number
  lastDay: string
  completed: number[]
  timezone: string
  weekly: LearningDay[]
  legacyImported: boolean
  awardedXP?: number
}
export type ReadingRecommendation = {
  testId: string
  title: string
  type: ReadingQuestionType
  reason: string
  accuracy?: number
  sampleSize: number
  lastPracticed?: string
  questionCount: number
  durationSeconds: number
}
export type ReadingMistakeDiagnosis = {
  category: string
  label: string
  labelZh: string
  whyItHappens: string
  whyItHappensZh: string
  socraticHint: string
  socraticHintZh: string
}

export type ReadingMistake = {
  id: string
  module: 'academic' | 'general'
  question: ReadingQuestion
  passage: ReadingPassage
  userAnswer: string
  incorrectCount: number
  retryCount: number
  correctRetries: number
  firstWrongAt: string
  lastWrongAt: string
  resolvedAt?: string
  diagnosis?: ReadingMistakeDiagnosis
}
export type ReadingLearningDashboard = {
  progress: LearningProgress
  daily: { day: string; title: string; session?: ReadingSession }
  activeSessions: ReadingSession[]
  recommendations: ReadingRecommendation[]
  mistakes: {
    open: number
    resolved: number
    retries: number
    correctRetries: number
    byType: Array<{ type: ReadingQuestionType; open: number; resolved: number }>
  }
  readingCompletions: number
  questionsAnswered: number
}
export type ReadingSavedWord = {
  id: string
  cardId: string
  word: string
  meaning: string
  context: string
  passageTitle: string
  createdAt: string
}

export type LearnerProfileSettings = {
  dailyMinutes: number
  targetBand: number
  preferredModule: 'academic' | 'general'
  timezone: string
}

export type BestNextActivity = {
  id: string
  kind: 'srs' | 'mistakes' | 'reading_daily' | 'vocab_lesson' | 'reading_practice'
  title: string
  titleZh: string
  reason: string
  reasonZh: string
  cognitivePrinciple: string
  cognitivePrincipleZh: string
  estimatedMinutes: number
  ctaLabel: string
  ctaLabelZh: string
  lessonIndex?: number
  mistakeType?: ReadingQuestionType
  testId?: string
  dueCount?: number
}

export type DailyStudyStep = {
  id: string
  kind: 'srs' | 'vocab_lesson' | 'reading_daily' | 'mistakes'
  stepNumber: number
  title: string
  titleZh: string
  subtitle: string
  subtitleZh: string
  minutes: number
  status: 'completed' | 'ready' | 'up_next'
  lessonIndex?: number
  dueCount?: number
  openMistakes?: number
}

export type DailyStudySession = {
  targetMinutes: number
  completedMinutes: number
  steps: DailyStudyStep[]
}

export type SrsSummary = {
  dueNow: number
  totalTracked: number
  learningCount: number
  youngCount: number
  matureCount: number
  retention7d?: number
  reviewsToday: number
}

export type ProficiencyEstimate = {
  sufficientEvidence: boolean
  questionsAnswered: number
  readingAccuracy?: number
  estimatedBandRange: string
  cefrLevel: string
  confidenceNote: string
  confidenceNoteZh: string
  weakestSkill?: ReadingQuestionType
  strongestSkill?: ReadingQuestionType
}

export type LearningPlanResponse = {
  profile: LearnerProfileSettings
  progress: LearningProgress
  nextActivity: BestNextActivity
  dailySession: DailyStudySession
  srs: SrsSummary
  proficiency: ProficiencyEstimate
}

export type VocabularySRSState = {
  cardId: string
  stability: number
  difficulty: number
  reps: number
  lapses: number
  state: 'new' | 'learning' | 'review' | 'relearning'
  lastRating: number
  recognitionReps: number
  productiveReps: number
  lastReviewedAt?: string
  dueAt: string
}

export type SrsReviewItem = {
  cardId: string
  word: string
  pronunciation: string
  meaning: string
  mode: 'recognition' | 'productive'
  prompt: string
  promptZh: string
  contextSentence: string
  blankedSentence: string
  passageTitle?: string
  options: string[]
  answerIndex: number
  state: VocabularySRSState
  retrievability: number
  intervals: Record<'again' | 'hard' | 'good' | 'easy', string>
}

export type SrsReviewInput = {
  cardId: string
  rating: 1 | 2 | 3 | 4
  mode: 'recognition' | 'productive'
  elapsedMs: number
}

export type SrsReviewResponse = {
  schedule: {
    next: VocabularySRSState
    retrievability: number
    scheduledDays: number
    keepInReviewTab: boolean
  }
  awardedXp: number
  progress: LearningProgress
}
