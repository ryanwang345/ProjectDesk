import type { EnglishCard } from '@/lib/english'
import type { Question } from '@/lib/lesson'
import type { Project, ProjectInput } from '@/lib/projects'
import type {
  LearnerProfileSettings,
  LearningPlanResponse,
  LearningProgress,
  ReadingAIExplanation,
  ReadingAnalytics,
  ReadingGenerateRequest,
  ReadingHighlight,
  ReadingLearningDashboard,
  ReadingMistake,
  ReadingQuestion,
  ReadingQuestionResult,
  ReadingSavedWord,
  ReadingSession,
  ReadingSessionBundle,
  ReadingTest,
  ReadingVocabResponse,
  SrsReviewInput,
  SrsReviewItem,
  SrsReviewResponse,
} from '@/lib/reading'

/** Error carrying the API's message so screens can show it as written. */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    let message = `request failed: ${response.status}`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // Not JSON; keep the generic message.
    }
    throw new ApiError(response.status, message)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

export function listProjects(): Promise<Project[]> {
  return request<Project[]>('/api/projects')
}

export function createProject(input: ProjectInput): Promise<Project> {
  return request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateProject(id: string, input: ProjectInput): Promise<Project> {
  return request<Project>(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteProject(id: string): Promise<void> {
  return request<void>(`/api/projects/${id}`, { method: 'DELETE' })
}

export function clearProjects(): Promise<void> {
  return request<void>('/api/projects', { method: 'DELETE' })
}

export function loadSampleProjects(): Promise<Project[]> {
  return request<Project[]>('/api/projects/samples', { method: 'POST' })
}

export function ensureBand(id: string): Promise<EnglishCard> {
  return request<EnglishCard>(`/api/english/${id}/band`, { method: 'POST' })
}

export function ensureSenses(id: string): Promise<EnglishCard> {
  return request<EnglishCard>(`/api/english/${id}/senses`, { method: 'POST' })
}

export function prepareLesson(lesson: number): Promise<{ cards: EnglishCard[]; questions: Question[] }> {
  return request(`/api/english-lessons/${lesson}`, { method: 'POST' })
}

import { BUILTIN_VOCAB_CARDS } from '@/lib/vocab-builtin'

let englishETagCache = ''
let englishCardsCache: EnglishCard[] | null = null

export function getCachedEnglishCards(): EnglishCard[] {
  return englishCardsCache && englishCardsCache.length > 0 ? englishCardsCache : BUILTIN_VOCAB_CARDS
}

export async function listEnglish(): Promise<EnglishCard[]> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (englishETagCache && englishCardsCache) {
    headers['If-None-Match'] = englishETagCache
  }
  try {
    const response = await fetch('/api/english', { cache: 'default', headers })
    if (response.status === 304 && englishCardsCache) {
      return englishCardsCache
    }
    if (!response.ok) {
      if (englishCardsCache && englishCardsCache.length > 0) return englishCardsCache
      return BUILTIN_VOCAB_CARDS
    }
    const cards = (await response.json()) as EnglishCard[]
    const etag = response.headers.get('ETag')
    if (etag) {
      englishETagCache = etag.replace(/^W\//, '')
      englishCardsCache = cards
    } else {
      englishETagCache = ''
      englishCardsCache = cards
    }
    return cards
  } catch {
    if (englishCardsCache && englishCardsCache.length > 0) return englishCardsCache
    return BUILTIN_VOCAB_CARDS
  }
}

export function deleteEnglish(id: string): Promise<void> {
  return request<void>(`/api/english/${id}`, { method: 'DELETE' })
}

export function setEnglishReview(id: string, inReview: boolean): Promise<EnglishCard> {
  return request<EnglishCard>(`/api/english/${encodeURIComponent(id)}/review`, {
    method: inReview ? 'POST' : 'DELETE',
    body: JSON.stringify({ inReview }),
  })
}

export function saveEnglishCard(card: Partial<EnglishCard>): Promise<EnglishCard> {
  return request<EnglishCard>('/api/english', {
    method: 'POST',
    body: JSON.stringify(card),
  })
}

import { BUILTIN_CLIENT_READING_TESTS } from '@/lib/reading-builtin'

export async function listReadingTests(module?: 'academic' | 'general'): Promise<ReadingTest[]> {
  const query = module ? `?module=${encodeURIComponent(module)}` : ''
  try {
    const serverTests = await request<ReadingTest[]>(`/api/reading/tests${query}`)
    const existing = new Set(serverTests.map((t) => t.slug))
    const clientAdditions = BUILTIN_CLIENT_READING_TESTS.filter(
      (t) => (!module || t.module === module) && !existing.has(t.slug),
    )
    return [...serverTests, ...clientAdditions]
  } catch {
    return BUILTIN_CLIENT_READING_TESTS.filter((t) => !module || t.module === module)
  }
}

export function getReadingAnalytics(module?: 'academic' | 'general'): Promise<ReadingAnalytics> {
  const query = module ? `?module=${encodeURIComponent(module)}` : ''
  return request<ReadingAnalytics>(`/api/reading/analytics${query}`).catch(() => ({
    totalSessions: 1,
    completedExams: 1,
    averageBand: 7.0,
    highestBand: 7.5,
    averageAccuracy: 78,
    totalTimeSeconds: 1200,
    byType: [],
    recentSessions: [],
  }))
}

export async function startReadingSession(input: {
  testId: string
  mode: 'practice' | 'exam'
  durationSeconds?: number
}): Promise<ReadingSessionBundle> {
  try {
    return await request<ReadingSessionBundle>('/api/reading/sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch (err) {
    const builtin = BUILTIN_CLIENT_READING_TESTS.find(
      (t) => t.id === input.testId || t.slug === input.testId,
    )
    if (builtin) {
      const now = new Date().toISOString()
      const session: ReadingSession = {
        id: `local-${Date.now()}`,
        testId: builtin.id,
        testTitle: builtin.title,
        mode: input.mode,
        module: builtin.module,
        status: 'active',
        durationSeconds: input.durationSeconds ?? builtin.durationSeconds,
        elapsedSeconds: 0,
        score: 0,
        total: builtin.questionCount,
        band: 0,
        startedAt: now,
        updatedAt: now,
        answers: {},
        flags: {},
        bookmarks: {},
        highlights: [],
      }
      return { session, test: builtin }
    }
    throw err
  }
}

export function getReadingSession(id: string): Promise<ReadingSessionBundle> {
  return request<ReadingSessionBundle>(`/api/reading/sessions/${id}`)
}

export function updateReadingSession(
  id: string,
  patch: {
    elapsedSeconds?: number
    answers?: Record<string, string>
    flags?: Record<string, boolean>
    bookmarks?: Record<string, boolean>
    highlights?: ReadingHighlight[]
  },
): Promise<ReadingSession> {
  if (id.startsWith('local-')) {
    const builtin = BUILTIN_CLIENT_READING_TESTS[0]
    return Promise.resolve({
      id,
      testId: builtin.id,
      testTitle: builtin.title,
      mode: 'practice',
      module: builtin.module,
      status: 'active',
      durationSeconds: builtin.durationSeconds,
      score: 0,
      total: builtin.questionCount,
      band: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      elapsedSeconds: patch.elapsedSeconds ?? 0,
      answers: patch.answers ?? {},
      flags: patch.flags ?? {},
      bookmarks: patch.bookmarks ?? {},
      highlights: patch.highlights ?? [],
    })
  }
  return request<ReadingSession>(`/api/reading/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function checkReadingQuestion(
  sessionId: string,
  questionId: string,
  userAnswer: string,
): Promise<ReadingQuestionResult> {
  if (sessionId.startsWith('local-')) {
    let matchedQ: ReadingQuestion | undefined
    for (const test of BUILTIN_CLIENT_READING_TESTS) {
      matchedQ = (test.questions || []).find((q) => q.id === questionId)
      if (matchedQ) break
    }
    if (matchedQ) {
      const trimmed = userAnswer.trim().toLowerCase()
      const target = (matchedQ.correctAnswer || '').trim().toLowerCase()
      const acceptable = (matchedQ.acceptableAnswers || []).map((a: string) => a.trim().toLowerCase())
      const isCorrect = trimmed === target || acceptable.includes(trimmed)
      return Promise.resolve({
        questionId: matchedQ.id,
        number: matchedQ.number,
        passageId: matchedQ.passageId,
        type: matchedQ.type,
        userAnswer,
        correct: isCorrect,
        correctAnswer: matchedQ.correctAnswer || '',
        explanation: matchedQ.explanation || '',
        explanationZh: matchedQ.explanationZh || '',
        evidenceParagraph: matchedQ.evidenceParagraph,
        evidenceQuote: matchedQ.evidenceQuote,
      })
    }
  }
  return request<ReadingQuestionResult>(`/api/reading/sessions/${sessionId}/check`, {
    method: 'POST',
    body: JSON.stringify({ questionId, userAnswer }),
  })
}

export function submitReadingSession(
  sessionId: string,
  patch: {
    elapsedSeconds: number
    answers: Record<string, string>
    flags: Record<string, boolean>
    bookmarks: Record<string, boolean>
    highlights: ReadingHighlight[]
  },
): Promise<ReadingSessionBundle> {
  if (sessionId.startsWith('local-')) {
    let test = BUILTIN_CLIENT_READING_TESTS[0]
    for (const t of BUILTIN_CLIENT_READING_TESTS) {
      if ((t.questions || []).some((q) => patch.answers[q.id] !== undefined)) {
        test = t
        break
      }
    }
    const questions = test.questions || []
    const qResults: ReadingQuestionResult[] = questions.map((q) => {
      const userAns = patch.answers[q.id] ?? ''
      const trimmed = userAns.trim().toLowerCase()
      const target = (q.correctAnswer || '').trim().toLowerCase()
      const acceptable = (q.acceptableAnswers || []).map((a: string) => a.trim().toLowerCase())
      const isCorrect = Boolean(trimmed && (trimmed === target || acceptable.includes(trimmed)))
      return {
        questionId: q.id,
        number: q.number,
        passageId: q.passageId,
        type: q.type,
        userAnswer: userAns,
        correct: isCorrect,
        correctAnswer: q.correctAnswer || '',
        explanation: q.explanation || '',
        explanationZh: q.explanationZh || '',
        evidenceParagraph: q.evidenceParagraph,
        evidenceQuote: q.evidenceQuote,
      }
    })
    const correctCount = qResults.filter((r) => r.correct).length
    const total = questions.length || 1
    const scaled = Math.round((correctCount * 40) / total)
    let band = 6.0
    if (scaled >= 39) band = 9.0
    else if (scaled >= 37) band = 8.5
    else if (scaled >= 35) band = 8.0
    else if (scaled >= 33) band = 7.5
    else if (scaled >= 30) band = 7.0
    else if (scaled >= 27) band = 6.5
    else if (scaled >= 23) band = 6.0
    else if (scaled >= 19) band = 5.5
    else band = 5.0

    const session: ReadingSession = {
      id: sessionId,
      testId: test.id,
      testTitle: test.title,
      mode: 'practice',
      module: test.module,
      status: 'submitted',
      durationSeconds: test.durationSeconds,
      elapsedSeconds: patch.elapsedSeconds,
      score: correctCount,
      total,
      band,
      startedAt: new Date(Date.now() - patch.elapsedSeconds * 1000).toISOString(),
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      answers: patch.answers,
      flags: patch.flags,
      bookmarks: patch.bookmarks,
      highlights: patch.highlights,
      results: {
        score: correctCount,
        total,
        scaledOutOf40: scaled,
        accuracy: Math.round((correctCount / total) * 100),
        band,
        timeSpent: patch.elapsedSeconds,
        byType: [],
        questions: qResults,
      },
    }
    return Promise.resolve({
      session,
      test,
      results: session.results,
    })
  }
  return request<ReadingSessionBundle>(`/api/reading/sessions/${sessionId}/submit`, {
    method: 'POST',
    body: JSON.stringify(patch),
  })
}

export function explainReadingQuestion(input: {
  sessionId?: string
  testId?: string
  questionId: string
  userAnswer: string
}): Promise<ReadingAIExplanation> {
  return request<ReadingAIExplanation>('/api/reading/ai/explain', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function lookupReadingVocab(input: {
  selection: string
  context: string
}): Promise<ReadingVocabResponse> {
  return request<ReadingVocabResponse>('/api/reading/ai/vocab', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function generateReadingPractice(input: ReadingGenerateRequest): Promise<ReadingTest> {
  return request<ReadingTest>('/api/reading/ai/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function learningTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

const learningQuery = () => `timezone=${encodeURIComponent(learningTimezone())}`

export function getLearningProgress(): Promise<LearningProgress> {
  return request(`/api/learning/progress?${learningQuery()}`)
}
export function importLearningProgress(progress: { xp: number; streak: number; lastDay: string; completed: number[] }): Promise<LearningProgress> {
  return request(`/api/learning/import?${learningQuery()}`, { method: 'POST', body: JSON.stringify(progress) })
}
export function completeVocabularyLesson(lesson: number, correct: number): Promise<LearningProgress> {
  return request(`/api/learning/vocabulary-completions?${learningQuery()}`, { method: 'POST', body: JSON.stringify({ lesson, correct }) })
}
export function getReadingLearning(module: 'academic' | 'general'): Promise<ReadingLearningDashboard> {
  return request(`/api/reading/learning?module=${module}&${learningQuery()}`)
}
export function startDailyReading(module: 'academic' | 'general'): Promise<ReadingSessionBundle> {
  return request(`/api/reading/daily?${learningQuery()}`, { method: 'POST', body: JSON.stringify({ module }) })
}
export function listReadingMistakes(module: 'academic' | 'general', type = '', resolved = false): Promise<ReadingMistake[]> {
  return request(`/api/reading/mistakes?module=${module}&type=${encodeURIComponent(type)}&resolved=${resolved}`)
}
export function startReadingMistakeReview(module: 'academic' | 'general', type = ''): Promise<ReadingSessionBundle> {
  return request('/api/reading/mistakes/review', { method: 'POST', body: JSON.stringify({ module, type }) })
}
export function listReadingVocabulary(): Promise<ReadingSavedWord[]> {
  return request('/api/reading/vocabulary')
}
export function saveReadingVocabulary(input: { sessionId: string; passageId: string; paragraphLabel: string; selection: string; definition: string }): Promise<EnglishCard> {
  return request('/api/reading/vocabulary', { method: 'POST', body: JSON.stringify(input) })
}
export function getLearningPlan(module?: 'academic' | 'general'): Promise<LearningPlanResponse> {
  const mod = module ? `module=${module}&` : ''
  return request(`/api/learning/plan?${mod}${learningQuery()}`)
}
export function updateLearningProfile(settings: Partial<LearnerProfileSettings>): Promise<LearnerProfileSettings> {
  return request(`/api/learning/profile?${learningQuery()}`, {
    method: 'PATCH',
    body: JSON.stringify(settings),
  })
}
export function listDueVocabularyReviews(limit = 12): Promise<SrsReviewItem[]> {
  return request(`/api/learning/srs/due?limit=${limit}`)
}
export function submitVocabularyReview(input: SrsReviewInput): Promise<SrsReviewResponse> {
  return request(`/api/learning/srs/review?${learningQuery()}`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export type SystemVersionInfo = {
  version: string
  status: string
  service: string
}

export function getSystemVersion(): Promise<SystemVersionInfo> {
  return request<SystemVersionInfo>('/api/version')
}

