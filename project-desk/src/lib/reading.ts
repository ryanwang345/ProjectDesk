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
