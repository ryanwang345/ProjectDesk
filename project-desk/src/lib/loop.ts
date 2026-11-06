export const STAGES = ['discover', 'deliver', 'validate', 'rediscover'] as const
export const SIGNAL_KINDS = ['events', 'metrics', 'feedback', 'alerts', 'trends'] as const

export type Stage = (typeof STAGES)[number]
export type SignalKind = (typeof SIGNAL_KINDS)[number]

export type Delivery = {
  commit: boolean
  ci: boolean
  tests: boolean
  deploy: boolean
  release: boolean
}

export type Practices = {
  trunk: boolean
  pipeline: boolean
  automatedDeploy: boolean
  featureFlag: boolean
}

export type Metrics = {
  activation: number | null
  conversion: number | null
  revenueCents: number | null
  latencyMs: number | null
  errorRate: number | null
}

export type Cycle = {
  id: string
  title: string
  stage: Stage
  signalKind: SignalKind
  signal: string
  finding: string
  score: number
  startedAt: string
  delivery: Delivery
  practices: Practices
  metrics: Metrics
  lesson: string
  priority: string
  updatedAt: string
  /** Orchestration state underneath the four stages; see WORKFLOW_META in platform.ts. */
  workflowState: string
  originCycleId: string | null
  /** Repository name under the API's authorized repos root, or empty. */
  repo: string
}

export type CycleInput = Omit<Cycle, 'id' | 'startedAt' | 'updatedAt' | 'workflowState' | 'originCycleId'>

export const STAGE_META: Record<
  Stage,
  { label: string; line: string; work: string }
> = {
  discover: {
    label: 'Discover',
    line: 'Read the signal',
    work: 'Signal detection, root cause, and an opportunity score.',
  },
  deliver: {
    label: 'Deliver',
    line: 'Ship the change',
    work: 'Commit, build, test, deploy, and release. Pain to production stays inside 48 hours.',
  },
  validate: {
    label: 'Validate',
    line: 'Measure the effect',
    work: 'Compare the change with the numbers that decide whether it worked.',
  },
  rediscover: {
    label: 'Rediscover',
    line: 'Write the next signal',
    work: 'Keep the lesson. It becomes the signal for the next cycle.',
  },
}

export const SIGNAL_META: Record<SignalKind, { label: string; source: string }> = {
  events: { label: 'Events', source: 'User behavior' },
  metrics: { label: 'Metrics', source: 'Business data' },
  feedback: { label: 'Feedback', source: 'Customer notes' },
  alerts: { label: 'Alerts', source: 'Monitoring' },
  trends: { label: 'Trends', source: 'Market' },
}

export const DELIVERY_STEPS: { key: keyof Delivery; label: string }[] = [
  { key: 'commit', label: 'Code commit' },
  { key: 'ci', label: 'CI / build' },
  { key: 'tests', label: 'Tests' },
  { key: 'deploy', label: 'Deploy' },
  { key: 'release', label: 'Release' },
]

export const PRACTICES: { key: keyof Practices; label: string }[] = [
  { key: 'trunk', label: 'Trunk-based development' },
  { key: 'pipeline', label: 'CI/CD pipeline' },
  { key: 'automatedDeploy', label: 'Automated deployment' },
  { key: 'featureFlag', label: 'Feature flag' },
]

const emptyDelivery = (): Delivery => ({
  commit: false,
  ci: false,
  tests: false,
  deploy: false,
  release: false,
})

const defaultPractices = (): Practices => ({
  trunk: true,
  pipeline: true,
  automatedDeploy: true,
  featureFlag: false,
})

const emptyMetrics = (): Metrics => ({
  activation: null,
  conversion: null,
  revenueCents: null,
  latencyMs: null,
  errorRate: null,
})

export function emptyCycleInput(): CycleInput {
  return {
    title: '',
    stage: 'discover',
    signalKind: 'events',
    signal: '',
    finding: '',
    score: 50,
    delivery: emptyDelivery(),
    practices: defaultPractices(),
    metrics: emptyMetrics(),
    lesson: '',
    priority: '',
    repo: '',
  }
}

export function toCycleInput(cycle: Cycle): CycleInput {
  return {
    title: cycle.title,
    stage: cycle.stage,
    signalKind: cycle.signalKind,
    signal: cycle.signal,
    finding: cycle.finding,
    score: cycle.score,
    delivery: { ...cycle.delivery },
    practices: { ...cycle.practices },
    metrics: { ...cycle.metrics },
    lesson: cycle.lesson,
    priority: cycle.priority,
    repo: cycle.repo ?? '',
  }
}

export function nextCycleInput(input: CycleInput): CycleInput {
  const title = input.priority.trim() || `Next: ${input.title.trim()}`
  return {
    ...emptyCycleInput(),
    title: title.slice(0, 80),
    signalKind: 'feedback',
    signal: input.lesson.trim(),
    score: input.score,
  }
}

export function deliveryWindow(startedAt: string, now = Date.now()): { hours: number; label: string } {
  const start = new Date(startedAt).getTime()
  if (Number.isNaN(start)) return { hours: 0, label: 'Start time unknown' }
  const hours = Math.max(0, (now - start) / 3_600_000)
  if (hours <= 24) return { hours, label: 'Inside 24 hours' }
  if (hours <= 48) return { hours, label: 'Inside 48 hours' }
  return { hours, label: 'Past 48 hours' }
}

export function deliveryCount(delivery: Delivery): number {
  return DELIVERY_STEPS.filter((step) => delivery[step.key]).length
}

export type CycleErrors = Partial<
  Record<'title' | 'signal' | 'finding' | 'lesson' | 'priority' | 'metrics' | 'score', string>
>

export function validateCycle(input: CycleInput): CycleErrors {
  const errors: CycleErrors = {}
  if (!input.title.trim()) errors.title = 'Enter a title.'
  else if (input.title.trim().length > 80) errors.title = 'Keep the title under 80 characters.'
  if (input.signal.trim().length > 280) errors.signal = 'Keep the signal under 280 characters.'
  if (input.finding.trim().length > 280) errors.finding = 'Keep the finding under 280 characters.'
  if (input.lesson.trim().length > 280) errors.lesson = 'Keep the lesson under 280 characters.'
  if (input.priority.trim().length > 120) errors.priority = 'Keep the priority under 120 characters.'
  if (input.score < 0 || input.score > 100) errors.score = 'Score the opportunity from 0 to 100.'
  if (!metricsInRange(input.metrics)) {
    errors.metrics = 'Percents stay between 0 and 100. Latency is milliseconds up to 600000.'
  }
  return errors
}

function metricsInRange(metrics: Metrics): boolean {
  const percents = [metrics.activation, metrics.conversion, metrics.errorRate]
  if (percents.some((value) => value !== null && (value < 0 || value > 100))) return false
  if (metrics.revenueCents !== null && metrics.revenueCents < 0) return false
  if (metrics.latencyMs !== null && (metrics.latencyMs < 0 || metrics.latencyMs > 600000)) return false
  return true
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

export function centsToDollars(cents: number): number {
  return cents / 100
}
