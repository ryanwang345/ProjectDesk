import { ProjectCard } from '@/components/project-card'
import { STATUS_META, projectsByStatus, type Project, type Status } from '@/lib/projects'

type ProjectColumnProps = {
  status: Status
  projects: Project[]
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
  onStatus: (project: Project, status: Status) => void
}

export function ProjectColumn({
  status,
  projects,
  onEdit,
  onDelete,
  onStatus,
}: ProjectColumnProps) {
  const meta = STATUS_META[status]
  const visible = projectsByStatus(projects, status)

  return (
    <section aria-labelledby={`column-${status}`} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <div>
          <h2 id={`column-${status}`} className="flex items-center gap-2 text-sm font-medium">
            <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden />
            {meta.label}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.hint}</p>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">{visible.length}</p>
      </div>
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-10 text-center text-sm text-muted-foreground">
          {meta.empty}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatus={onStatus}
            />
          ))}
        </div>
      )}
    </section>
  )
}
