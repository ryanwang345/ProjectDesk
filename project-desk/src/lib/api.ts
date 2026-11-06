import type { Cycle, CycleInput } from '@/lib/loop'
import type {
  Analysis,
  Artifact,
  Assignment,
  Event,
  Job,
  JobKind,
  KnowledgeEntry,
  PlatformStatus,
  Provider,
  ProviderInput,
  ProviderTest,
  Repo,
  Usage,
  Workflow,
} from '@/lib/platform'
import type { Project, ProjectInput } from '@/lib/projects'

/** Error carrying the API's message so screens can show it as written. */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const ADMIN_TOKEN_KEY = 'projectdesk.adminToken'

/** The optional admin token for AI settings changes lives in sessionStorage only. */
export function getAdminToken(): string {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setAdminToken(token: string) {
  try {
    if (token) window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
    else window.sessionStorage.removeItem(ADMIN_TOKEN_KEY)
  } catch {
    // Session storage is unavailable; the token is simply not remembered.
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken()
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export function listCycles(): Promise<Cycle[]> {
  return request<Cycle[]>('/api/cycles')
}

export function createCycle(input: CycleInput): Promise<Cycle> {
  return request<Cycle>('/api/cycles', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateCycle(id: string, input: CycleInput): Promise<Cycle> {
  return request<Cycle>(`/api/cycles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteCycle(id: string): Promise<void> {
  return request<void>(`/api/cycles/${id}`, { method: 'DELETE' })
}

export function loadSampleCycle(): Promise<Cycle> {
  return request<Cycle>('/api/cycles/sample', { method: 'POST' })
}

// ---- AI platform ----------------------------------------------------------

export function getPlatformStatus(): Promise<PlatformStatus> {
  return request<PlatformStatus>('/api/platform')
}

export function listRepos(): Promise<Repo[]> {
  return request<Repo[]>('/api/repos')
}

export function listProviders(): Promise<Provider[]> {
  return request<Provider[]>('/api/providers')
}

export function createProvider(input: ProviderInput): Promise<Provider> {
  return request<Provider>('/api/providers', { method: 'POST', body: JSON.stringify(input) })
}

export function updateProvider(id: string, input: ProviderInput): Promise<Provider> {
  return request<Provider>(`/api/providers/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deleteProvider(id: string): Promise<void> {
  return request<void>(`/api/providers/${id}`, { method: 'DELETE' })
}

export function testProvider(input: Partial<ProviderInput> & { id?: string }): Promise<ProviderTest> {
  return request<ProviderTest>('/api/providers/test', { method: 'POST', body: JSON.stringify(input) })
}

export function listProviderModels(id: string): Promise<{ models: { id: string }[]; error?: string }> {
  return request(`/api/providers/${id}/models`)
}

export function listAgents(): Promise<{ roles: string[]; assignments: Assignment[] }> {
  return request('/api/agents')
}

export function setAgent(role: string, input: { providerId: string | null; model: string }): Promise<Assignment> {
  return request<Assignment>(`/api/agents/${role}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function getWorkflow(cycleId: string): Promise<Workflow> {
  return request<Workflow>(`/api/cycles/${cycleId}/workflow`)
}

export function startJob(cycleId: string, kind: JobKind): Promise<Job> {
  return request<Job>(`/api/cycles/${cycleId}/${kind}`, { method: 'POST', body: '{}' })
}

export function decideAnalysis(
  cycleId: string,
  analysisId: string,
  input: { decision: 'approve' | 'reject'; applyScore: boolean; applyFinding: boolean },
): Promise<Analysis> {
  return request<Analysis>(`/api/cycles/${cycleId}/analyses/${analysisId}/decision`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function decideArtifact(
  cycleId: string,
  artifactId: string,
  decision: 'approve' | 'reject',
): Promise<{ artifact: Artifact; knowledge?: number; followUp?: Cycle | null }> {
  return request(`/api/cycles/${cycleId}/artifacts/${artifactId}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  })
}

export function editArtifact(cycleId: string, artifactId: string, content: string): Promise<Artifact> {
  return request<Artifact>(`/api/cycles/${cycleId}/artifacts/${artifactId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  })
}

export function overrideValidation(cycleId: string, reason: string): Promise<{ state: string }> {
  return request(`/api/cycles/${cycleId}/validation/override`, { method: 'POST', body: JSON.stringify({ reason }) })
}

export function markDeployed(cycleId: string): Promise<Cycle> {
  return request<Cycle>(`/api/cycles/${cycleId}/deployed`, { method: 'POST', body: '{}' })
}

export function cancelCycleWorkflow(cycleId: string): Promise<Cycle> {
  return request<Cycle>(`/api/cycles/${cycleId}/cancel`, { method: 'POST', body: '{}' })
}

export function resetCycleWorkflow(cycleId: string): Promise<Cycle> {
  return request<Cycle>(`/api/cycles/${cycleId}/reset`, { method: 'POST', body: '{}' })
}

export function listJobs(limit = 50): Promise<Job[]> {
  return request<Job[]>(`/api/jobs?limit=${limit}`)
}

export function cancelJob(id: string): Promise<Job> {
  return request<Job>(`/api/jobs/${id}/cancel`, { method: 'POST', body: '{}' })
}

export function listEvents(limit = 100): Promise<Event[]> {
  return request<Event[]>(`/api/events?limit=${limit}`)
}

export function getUsage(): Promise<Usage> {
  return request<Usage>('/api/usage')
}

export function searchKnowledge(query: string): Promise<KnowledgeEntry[]> {
  return request<KnowledgeEntry[]>(`/api/knowledge?q=${encodeURIComponent(query)}`)
}

export function addKnowledge(input: { title: string; body: string; tags: string[] }): Promise<KnowledgeEntry> {
  return request<KnowledgeEntry>('/api/knowledge', { method: 'POST', body: JSON.stringify(input) })
}
