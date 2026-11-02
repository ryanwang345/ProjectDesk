export const STATUSES = ['sketch', 'building', 'shipped'] as const

export type Status = (typeof STATUSES)[number]

export type Project = {
  id: string
  name: string
  note: string
  status: Status
  updatedAt: string
}

export type ProjectInput = {
  name: string
  note: string
  status: Status
}

export type StorageProblem = 'unavailable' | 'unreadable' | 'write-failed'

export const STATUS_META: Record<
  Status,
  { label: string; hint: string; empty: string; dot: string }
> = {
  sketch: {
    label: 'Sketch',
    hint: 'Named, not started',
    empty: 'Nothing sketched yet.',
    dot: 'bg-[oklch(0.62_0.03_80)]',
  },
  building: {
    label: 'Building',
    hint: 'In progress',
    empty: 'Nothing in progress.',
    dot: 'bg-[oklch(0.72_0.13_75)]',
  },
  shipped: {
    label: 'Shipped',
    hint: 'Done for now',
    empty: 'Nothing shipped yet.',
    dot: 'bg-[oklch(0.48_0.08_163)]',
  },
}

const STORAGE_KEY = 'vail.projects.v1'
const NAME_LIMIT = 80
const NOTE_LIMIT = 280

export function validateProject(
  input: ProjectInput,
): Partial<Record<'name' | 'note', string>> {
  const errors: Partial<Record<'name' | 'note', string>> = {}
  const name = input.name.trim()
  const note = input.note.trim()

  if (!name) {
    errors.name = 'Enter a name.'
  } else if (name.length > NAME_LIMIT) {
    errors.name = `Keep the name under ${NAME_LIMIT} characters.`
  }

  if (note.length > NOTE_LIMIT) {
    errors.note = `Keep the note under ${NOTE_LIMIT} characters.`
  }

  return errors
}

export function createProject(input: ProjectInput, now = new Date()): Project {
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    note: input.note.trim(),
    status: input.status,
    updatedAt: now.toISOString(),
  }
}

export function withUpdate(
  project: Project,
  patch: Partial<Pick<Project, 'name' | 'note' | 'status'>>,
  now = new Date(),
): Project {
  return {
    ...project,
    ...patch,
    name: patch.name === undefined ? project.name : patch.name.trim(),
    note: patch.note === undefined ? project.note : patch.note.trim(),
    updatedAt: now.toISOString(),
  }
}

export function projectsByStatus(projects: Project[], status: Status): Project[] {
  return projects
    .filter((project) => project.status === status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function sampleProjects(now = Date.now()): Project[] {
  const at = (hoursAgo: number) => new Date(now - hoursAgo * 60 * 60 * 1000).toISOString()

  return [
    {
      id: 'sample-lift-status',
      name: 'Lift status board',
      note: 'A quiet page for which lifts are spinning this morning.',
      status: 'sketch',
      updatedAt: at(50),
    },
    {
      id: 'sample-cabin-notes',
      name: 'Cabin week notes',
      note: 'Who is bringing the chili, and which day we ski the back bowls.',
      status: 'building',
      updatedAt: at(5),
    },
    {
      id: 'sample-gear-checkout',
      name: 'Gear checkout',
      note: 'A shared list so jackets stop living in three different cars.',
      status: 'shipped',
      updatedAt: at(24 * 12),
    },
  ]
}

export function formatUpdated(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'Updated date unknown'

  const delta = then - now
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (Math.abs(delta) < minute) return 'Updated just now'
  if (Math.abs(delta) < hour) {
    return `Updated ${relative.format(Math.round(delta / minute), 'minute')}`
  }
  if (Math.abs(delta) < day) {
    return `Updated ${relative.format(Math.round(delta / hour), 'hour')}`
  }
  return `Updated ${relative.format(Math.round(delta / day), 'day')}`
}

export function loadProjects(): {
  projects: Project[]
  problem: Extract<StorageProblem, 'unavailable' | 'unreadable'> | null
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { projects: [], problem: null }

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isProject)) {
      return { projects: [], problem: 'unreadable' }
    }

    return { projects: parsed, problem: null }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { projects: [], problem: 'unreadable' }
    }
    return { projects: [], problem: 'unavailable' }
  }
}

export function saveProjects(projects: Project[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
    return true
  } catch {
    return false
  }
}

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false
  const project = value as Record<string, unknown>
  return (
    typeof project.id === 'string' &&
    project.id.length > 0 &&
    typeof project.name === 'string' &&
    typeof project.note === 'string' &&
    typeof project.updatedAt === 'string' &&
    isStatus(project.status)
  )
}

function isStatus(value: unknown): value is Status {
  return STATUSES.some((status) => status === value)
}
