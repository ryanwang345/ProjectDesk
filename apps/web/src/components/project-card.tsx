import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useI18n, type MessageKey } from '@/i18n'
import {
  STATUSES,
  formatUpdated,
  type Project,
  type Status,
} from '@/lib/projects'

type ProjectCardProps = {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
  onStatus: (project: Project, status: Status) => void
}

export function ProjectCard({ project, onEdit, onDelete, onStatus }: ProjectCardProps) {
  const { t, locale } = useI18n()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="break-words">{project.name}</CardTitle>
        <CardAction className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('project.editName', { name: project.name })}
            onClick={() => onEdit(project)}
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('project.removeName', { name: project.name })}
            onClick={() => onDelete(project)}
          >
            <Trash2 />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className={project.note ? 'break-words text-muted-foreground' : 'text-muted-foreground italic'}>
          {project.note || t('project.noNote')}
        </p>
      </CardContent>
      <CardFooter className="flex-wrap items-center justify-between gap-2">
        <Select
          value={project.status}
          onValueChange={(value) => onStatus(project, value as Status)}
        >
          <SelectTrigger aria-label={t('project.statusFor', { name: project.name })} className="w-[9.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`status.${status}` as MessageKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{formatUpdated(project.updatedAt, now, locale)}</p>
      </CardFooter>
    </Card>
  )
}
