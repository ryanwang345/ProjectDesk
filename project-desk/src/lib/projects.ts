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

export type StorageProblem = 'unavailable' | 'write-failed'

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

export function projectsByStatus(projects: Project[], status: Status): Project[] {
  return projects
    .filter((project) => project.status === status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
