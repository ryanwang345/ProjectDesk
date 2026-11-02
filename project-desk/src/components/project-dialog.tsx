import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  STATUSES,
  STATUS_META,
  validateProject,
  type Project,
  type ProjectInput,
  type Status,
} from '@/lib/projects'

type ProjectDialogProps = {
  open: boolean
  session: number
  draft: Project | null
  onOpenChange: (open: boolean) => void
  onSubmit: (input: ProjectInput) => Promise<void>
}

const emptyInput: ProjectInput = {
  name: '',
  note: '',
  status: 'sketch',
}

export function ProjectDialog({
  open,
  session,
  draft,
  onOpenChange,
  onSubmit,
}: ProjectDialogProps) {
  const [input, setInput] = useState<ProjectInput>(() =>
    draft ? { name: draft.name, note: draft.note, status: draft.status } : emptyInput,
  )
  const [errors, setErrors] = useState<Partial<Record<'name' | 'note', string>>>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateProject(input)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    try {
      await onSubmit(input)
    } catch {
      setErrors({ name: 'The desk could not save this project.' })
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{draft ? 'Edit project' : 'Add a project'}</DialogTitle>
          <DialogDescription>
            A name is enough. The note is for the detail you will forget by Friday.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <Label htmlFor={`project-name-${session}`}>Name</Label>
            <Input
              id={`project-name-${session}`}
              name={`project-name-${session}`}
              value={input.name}
              autoComplete="off"
              placeholder="What are you making?"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `project-name-${session}-error` : undefined}
              onChange={(event) =>
                setInput((current) => ({ ...current, name: event.target.value }))
              }
            />
            {errors.name ? (
              <p id={`project-name-${session}-error`} className="text-sm text-destructive">
                {errors.name}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor={`project-note-${session}`}>Note</Label>
              <span className="text-xs text-muted-foreground">{input.note.trim().length}/280</span>
            </div>
            <Textarea
              id={`project-note-${session}`}
              name={`project-note-${session}`}
              value={input.note}
              autoComplete="off"
              placeholder="One or two lines so future you remembers why."
              aria-invalid={Boolean(errors.note)}
              aria-describedby={errors.note ? `project-note-${session}-error` : undefined}
              onChange={(event) =>
                setInput((current) => ({ ...current, note: event.target.value }))
              }
            />
            {errors.note ? (
              <p id={`project-note-${session}-error`} className="text-sm text-destructive">
                {errors.note}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="project-status">Status</Label>
            <Select
              value={input.status}
              onValueChange={(value) =>
                setInput((current) => ({ ...current, status: value as Status }))
              }
            >
              <SelectTrigger id="project-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_META[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{draft ? 'Save changes' : 'Add project'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
