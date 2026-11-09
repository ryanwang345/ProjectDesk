import type { EnglishCard } from '@/lib/english'
import type { Question } from '@/lib/lesson'
import type { Project, ProjectInput } from '@/lib/projects'
import type {
  ReadingAIExplanation,
  ReadingAnalytics,
  ReadingGenerateRequest,
  ReadingHighlight,
  ReadingQuestionResult,
  ReadingSession,
  ReadingSessionBundle,
  ReadingTest,
  ReadingVocabResponse,
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

export function prepareLesson(lesson: number): Promise<{ cards: EnglishCard[]; questions: Question[] }> {
  return request(`/api/english-lessons/${lesson}`, { method: 'POST' })
}

export function listEnglish(): Promise<EnglishCard[]> {
  return request<EnglishCard[]>('/api/english')
}

export function deleteEnglish(id: string): Promise<void> {
  return request<void>(`/api/english/${id}`, { method: 'DELETE' })
}

export function setEnglishReview(id: string, inReview: boolean): Promise<EnglishCard> {
  return request<EnglishCard>(`/api/english/${id}/review`, {
    method: inReview ? 'POST' : 'DELETE',
  })
}

export function listReadingTests(module?: 'academic' | 'general'): Promise<ReadingTest[]> {
  const query = module ? `?module=${encodeURIComponent(module)}` : ''
  return request<ReadingTest[]>(`/api/reading/tests${query}`)
}

export function getReadingAnalytics(module?: 'academic' | 'general'): Promise<ReadingAnalytics> {
  const query = module ? `?module=${encodeURIComponent(module)}` : ''
  return request<ReadingAnalytics>(`/api/reading/analytics${query}`)
}

export function startReadingSession(input: {
  testId: string
  mode: 'practice' | 'exam'
  durationSeconds?: number
}): Promise<ReadingSessionBundle> {
  return request<ReadingSessionBundle>('/api/reading/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
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
