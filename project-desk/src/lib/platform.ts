import type { Cycle, Stage } from '@/lib/loop'

// Types and copy for the AI platform: providers, agent roles, the workflow
// state machine, jobs, artifacts, and the knowledge base. The API is the
// source of truth; this file only mirrors its shapes.

export type ProviderKind = 'openai' | 'anthropic' | 'ollama' | 'demo'

export type Capabilities = {
  jsonMode: boolean
  streaming: boolean
  tools: boolean
  simulated: boolean
}

export type Provider = {
  id: string
  name: string
  kind: ProviderKind
  baseUrl: string
  model: string
  hasKey: boolean
  isDefault: boolean
  capabilities: Capabilities
  createdAt: string
  updatedAt: string
}

export type ProviderInput = {
  name: string
  kind: ProviderKind
  baseUrl: string
  model: string
  /** undefined keeps the stored key, '' clears it */
  apiKey?: string
  isDefault: boolean
}

export type ProviderTest = {
  ok: boolean
  name: string
  ms: number
  simulated: boolean
  model?: string
  sample?: string
  error?: string
}

export type Assignment = {
  role: string
  providerId: string | null
  model: string
}

export const PROVIDER_KIND_META: Record<ProviderKind, { label: string; hint: string; needsKey: boolean; defaultModel: string }> = {
  openai: {
    label: 'OpenAI-compatible',
    hint: 'OpenAI, DeepSeek, xAI, vLLM, Azure OpenAI: any /v1/chat/completions endpoint.',
    needsKey: true,
    defaultModel: 'gpt-4o-mini',
  },
  anthropic: {
    label: 'Anthropic',
    hint: 'Claude models through the Messages API.',
    needsKey: true,
    defaultModel: 'claude-3-5-haiku-latest',
  },
  ollama: {
    label: 'Ollama (local)',
    hint: 'A model served by Ollama on this network. No key needed.',
    needsKey: false,
    defaultModel: 'llama3.1',
  },
  demo: {
    label: 'Demo (simulated)',
    hint: 'Deterministic offline replies for trying the workflow. Everything it produces is labeled simulated and is not real analysis.',
    needsKey: false,
    defaultModel: 'demo-deterministic',
  },
}

export const ROLE_META: Record<string, { label: string; does: string }> = {
  discovery: { label: 'Discovery', does: 'Analyzes signals into hypotheses and a proposed score.' },
  product: { label: 'Product', does: 'Writes the specification.' },
  architecture: { label: 'Architecture', does: 'Writes the implementation plan.' },
  development: { label: 'Development', does: 'Proposes a patch in an isolated workspace.' },
  qa: { label: 'QA', does: 'Explains validation failures and proposes bounded repairs.' },
  devops: { label: 'DevOps', does: 'Reserved for deployment automation (not wired yet).' },
  review: { label: 'Review', does: 'Reserved for automated code review (not wired yet).' },
  knowledge: { label: 'Knowledge', does: 'Judges the outcome and writes lessons.' },
}

export type WorkflowState =
  | 'PENDING'
  | 'ANALYZING'
  | 'AWAITING_APPROVAL'
  | 'PLANNING'
  | 'IMPLEMENTING'
  | 'TESTING'
  | 'REVIEWING'
  | 'READY_FOR_DEPLOYMENT'
  | 'DEPLOYED'
  | 'MONITORING'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'FAILED'
  | 'CANCELLED'

export const WORKFLOW_META: Record<WorkflowState, { label: string; tone: 'quiet' | 'active' | 'wait' | 'good' | 'bad' }> = {
  PENDING: { label: 'Not started', tone: 'quiet' },
  ANALYZING: { label: 'Analyzing', tone: 'active' },
  AWAITING_APPROVAL: { label: 'Awaiting your approval', tone: 'wait' },
  PLANNING: { label: 'Planning', tone: 'active' },
  IMPLEMENTING: { label: 'Implementing', tone: 'active' },
  TESTING: { label: 'Testing', tone: 'active' },
  REVIEWING: { label: 'Reviewing', tone: 'active' },
  READY_FOR_DEPLOYMENT: { label: 'Ready for deployment', tone: 'good' },
  DEPLOYED: { label: 'Deployed', tone: 'good' },
  MONITORING: { label: 'Monitoring', tone: 'active' },
  COMPLETED: { label: 'Completed', tone: 'good' },
  BLOCKED: { label: 'Blocked', tone: 'bad' },
  FAILED: { label: 'Failed', tone: 'bad' },
  CANCELLED: { label: 'Cancelled', tone: 'quiet' },
}

export function workflowMeta(state: string) {
  return WORKFLOW_META[state as WorkflowState] ?? { label: state || 'Not started', tone: 'quiet' as const }
}

/** Which stage a workflow state belongs to; mirrors StageFor in Go. */
export function stageForState(state: string): Stage | null {
  switch (state) {
    case 'PENDING':
    case 'ANALYZING':
      return 'discover'
    case 'PLANNING':
    case 'IMPLEMENTING':
    case 'REVIEWING':
      return 'deliver'
    case 'TESTING':
    case 'READY_FOR_DEPLOYMENT':
      return 'validate'
    case 'DEPLOYED':
    case 'MONITORING':
    case 'COMPLETED':
      return 'rediscover'
    default:
      return null
  }
}

export type JobKind = 'analyze' | 'specification' | 'plan' | 'patch' | 'validate' | 'outcome'

export type Job = {
  id: string
  cycleId: string | null
  kind: JobKind | string
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
  payload: unknown
  result: unknown
  error: string
  attempts: number
  maxAttempts: number
  timeoutSeconds: number
  runAfter: string
  cancelRequested: boolean
  providerName: string
  model: string
  simulated: boolean
  promptTokens: number
  completionTokens: number
  createdAt: string
  updatedAt: string
  finishedAt: string | null
}

export const JOB_LABEL: Record<string, string> = {
  analyze: 'Analyze with AI',
  specification: 'Generate specification',
  plan: 'Generate implementation plan',
  patch: 'Generate patch',
  validate: 'Run validation',
  outcome: 'Evaluate outcome',
}

export type Hypothesis = { cause: string; evidence: string; confidence: number }

export type AnalysisContent = {
  summary: string
  hypotheses: Hypothesis[]
  missingInformation: string[]
  proposedScore: number
  scoreRationale: string
  opportunity: { title: string; outcome: string }
  acceptanceCriteria: string[]
}

export type Analysis = {
  id: string
  cycleId: string
  jobId: string | null
  status: 'proposed' | 'approved' | 'rejected'
  content: AnalysisContent
  providerName: string
  model: string
  simulated: boolean
  createdAt: string
  decidedAt: string | null
}

export type ArtifactKind = 'specification' | 'plan' | 'patch' | 'validation' | 'outcome'

export type Gate = { name: string; status: 'pass' | 'fail' | 'not_run'; detail: string; seconds?: number }

export type ValidationData = {
  patchId: string
  patchVersion: number
  gates: Gate[]
  passed: boolean
  runner: string
  output?: string
  analysis?: { category: string; explanation: string; repairDiff: string }
  repairArtifactId?: string
  repairsUsed: number
  maxRepairs: number
}

export type Artifact = {
  id: string
  cycleId: string
  jobId: string | null
  kind: ArtifactKind
  version: number
  status: 'proposed' | 'approved' | 'rejected' | 'superseded' | 'passed' | 'failed' | 'blocked'
  content: string
  data: Record<string, unknown>
  note: string
  providerName: string
  model: string
  simulated: boolean
  createdAt: string
  decidedAt: string | null
}

export const ARTIFACT_LABEL: Record<ArtifactKind, string> = {
  specification: 'Specification',
  plan: 'Implementation plan',
  patch: 'Patch',
  validation: 'Validation',
  outcome: 'Outcome',
}

export type Event = {
  id: number
  cycleId: string | null
  jobId: string | null
  kind: string
  message: string
  data: Record<string, unknown>
  createdAt: string
}

export type Workflow = {
  cycle: Cycle
  analyses: Analysis[]
  artifacts: Artifact[]
  jobs: Job[]
  events: Event[]
  actions: string[] | null
}

export type PlatformStatus = {
  secretStorage: boolean
  adminTokenRequired: boolean
  runner: string
  runnerReady: boolean
  reposConfigured: number
  maxJobsPerCycle: number
  maxRepairs: number
  states: string[]
}

export type Usage = {
  promptTokens: number
  completionTokens: number
  done: number
  failed: number
  running: number
  queued: number
}

export type KnowledgeEntry = {
  id: string
  cycleId: string | null
  title: string
  body: string
  tags: string[]
  createdAt: string
}

export type Repo = { name: string; description: string }

export function hasActiveJob(jobs: Job[]): boolean {
  return jobs.some((job) => job.status === 'queued' || job.status === 'running')
}

export function latestArtifact(artifacts: Artifact[], kind: ArtifactKind): Artifact | undefined {
  return artifacts.find((artifact) => artifact.kind === kind)
}

export function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
