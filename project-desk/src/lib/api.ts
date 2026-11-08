import type { EnglishCard } from '@/lib/english'
import type { Question } from '@/lib/lesson'
import type { Project, ProjectInput } from '@/lib/projects'

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
