import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ProjectColumn } from '@/components/project-column'
import { ProjectDialog } from '@/components/project-dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProjects } from '@/hooks/use-projects'
import {
  STATUSES,
  STATUS_META,
  projectsByStatus,
  type Project,
  type ProjectInput,
  type Status,
  type StorageProblem,
} from '@/lib/projects'

function useDesktopBoard() {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const onChange = (event: MediaQueryListEvent) => setDesktop(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return desktop
}

const PROBLEM_COPY: Record<StorageProblem, string> = {
  unavailable:
    'This browser is not keeping a local save. You can still edit, and a reload will start from an empty desk.',
  unreadable:
    'The saved desk could not be read, so it was left empty. The next change you make writes a fresh save.',
  'write-failed':
    'The last change did not save. Check that this site is allowed to store data, then try again.',
}

export function BoardPage() {
  const {
    projects,
    problem,
    addProject,
    updateProject,
    removeProject,
    useSamples,
    clearProjects,
  } = useProjects()
  const desktop = useDesktopBoard()
  const [formOpen, setFormOpen] = useState(false)
  const [formSession, setFormSession] = useState(0)
  const [draft, setDraft] = useState<Project | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null)
  const [clearOpen, setClearOpen] = useState(false)

  function openCreate() {
    setDraft(null)
    setFormSession((session) => session + 1)
    setFormOpen(true)
  }

  function openEdit(project: Project) {
    setDraft(project)
    setFormSession((session) => session + 1)
    setFormOpen(true)
  }

  function handleSubmit(input: ProjectInput) {
    if (draft) {
      updateProject(draft.id, input)
      return
    }
    addProject(input)
  }

  function handleStatus(project: Project, status: Status) {
    if (project.status === status) return
    updateProject(project.id, { status })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
            The desk
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Projects you are actually working on. They stay in this browser, and nginx serves the page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {projects.length > 0 ? (
            <Button type="button" variant="outline" onClick={() => setClearOpen(true)}>
              Clear desk
            </Button>
          ) : null}
          <Button type="button" onClick={openCreate}>
            <Plus data-icon="inline-start" />
            Add a project
          </Button>
        </div>
      </div>

      {problem ? (
        <p
          role="status"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {PROBLEM_COPY[problem]}
        </p>
      ) : null}

      {projects.length === 0 ? (
        <EmptyDesk onAdd={openCreate} onSamples={useSamples} />
      ) : (
        desktop ? (
          <div className="grid gap-4 md:grid-cols-3">
            {STATUSES.map((status) => (
              <ProjectColumn
                key={status}
                status={status}
                projects={projects}
                onEdit={openEdit}
                onDelete={setPendingDelete}
                onStatus={handleStatus}
              />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="sketch">
            <TabsList className="w-full">
              {STATUSES.map((status) => (
                <TabsTrigger key={status} value={status} className="flex-1">
                  {STATUS_META[status].label}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {projectsByStatus(projects, status).length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            {STATUSES.map((status) => (
              <TabsContent key={status} value={status} className="mt-4">
                <ProjectColumn
                  status={status}
                  projects={projects}
                  onEdit={openEdit}
                  onDelete={setPendingDelete}
                  onStatus={handleStatus}
                />
              </TabsContent>
            ))}
          </Tabs>
        )
      )}

      <ProjectDialog
        key={formSession}
        session={formSession}
        open={formOpen}
        draft={draft}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this project?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" will leave this browser. There is no undo.`
            : ''
        }
        confirmLabel="Remove"
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        onConfirm={() => {
          if (pendingDelete) removeProject(pendingDelete.id)
        }}
      />
      <ConfirmDialog
        open={clearOpen}
        title="Clear the desk?"
        description="Every project saved in this browser will be removed."
        confirmLabel="Clear desk"
        onOpenChange={setClearOpen}
        onConfirm={clearProjects}
      />
    </div>
  )
}

function EmptyDesk({ onAdd, onSamples }: { onAdd: () => void; onSamples: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/70 px-6 py-14 text-center">
      <h2 className="font-display text-3xl tracking-tight">Nothing on the desk</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Add the next thing you mean to finish. A name is enough, and it stays on this machine.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={onAdd}>
          <Plus data-icon="inline-start" />
          Add a project
        </Button>
        <Button type="button" variant="outline" onClick={onSamples}>
          Load three examples
        </Button>
      </div>
    </div>
  )
}
