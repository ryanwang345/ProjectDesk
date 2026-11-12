import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ProjectColumn } from '@/components/project-column'
import { ProjectDialog } from '@/components/project-dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProjects } from '@/hooks/use-projects'
import { useI18n } from '@/i18n'
import {
  STATUSES,
  projectsByStatus,
  type Project,
  type ProjectInput,
  type Status,
} from '@/lib/projects'

function useDesktopBoard() {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const onChange = (event: MediaQueryListEvent) => setDesktop(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return desktop
}

const PROBLEM_KEY = {
  unavailable: 'desk.unreachable',
  'write-failed': 'desk.writeFailed',
} as const

export function BoardPage() {
  const { t } = useI18n()
  const {
    projects,
    ready,
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
    if (draft) return updateProject(draft.id, input)
    return addProject(input)
  }

  function handleStatus(project: Project, status: Status) {
    if (project.status === status) return
    void updateProject(project.id, {
      name: project.name,
      note: project.note,
      status,
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
            {t('desk.title')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {t('desk.lead')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {projects.length > 0 ? (
            <Button type="button" variant="outline" onClick={() => setClearOpen(true)}>
              {t('desk.clear')}
            </Button>
          ) : null}
          <Button type="button" onClick={openCreate}>
            <Plus data-icon="inline-start" />
            {t('desk.add')}
          </Button>
        </div>
      </div>

      {problem ? (
        <p
          role="status"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {t(PROBLEM_KEY[problem])}
        </p>
      ) : null}

      {!ready ? (
        <div aria-busy="true" aria-live="polite" className="grid gap-4 lg:grid-cols-3">
          <p className="sr-only">Loading projects</p>
          {STATUSES.map((status) => (
            <div key={status} className="h-48 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyDesk onAdd={openCreate} onSamples={useSamples} />
      ) : (
        desktop ? (
          <div className="grid gap-4 lg:grid-cols-3">
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
                  {t(`status.${status}`)}
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
        title={t('desk.removeTitle')}
        description={pendingDelete ? t('desk.removeBody', { name: pendingDelete.name }) : ''}
        confirmLabel={t('desk.remove')}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        onConfirm={() => {
          if (pendingDelete) removeProject(pendingDelete.id)
        }}
      />
      <ConfirmDialog
        open={clearOpen}
        title={t('desk.clearTitle')}
        description={t('desk.clearBody')}
        confirmLabel={t('desk.clearConfirm')}
        onOpenChange={setClearOpen}
        onConfirm={clearProjects}
      />
    </div>
  )
}

function EmptyDesk({ onAdd, onSamples }: { onAdd: () => void; onSamples: () => void }) {
  const { t } = useI18n()
  return (
    <div className="rounded-3xl border border-dashed border-primary/30 bg-card/75 px-6 py-16 text-center shadow-[0_24px_50px_-36px_oklch(0.32_0.05_160/0.8)]">
      <h2 className="font-display text-3xl tracking-tight">{t('desk.emptyTitle')}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {t('desk.emptyBody')}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={onAdd}>
          <Plus data-icon="inline-start" />
          {t('desk.add')}
        </Button>
        <Button type="button" variant="outline" onClick={onSamples}>
          {t('desk.examples')}
        </Button>
      </div>
    </div>
  )
}
