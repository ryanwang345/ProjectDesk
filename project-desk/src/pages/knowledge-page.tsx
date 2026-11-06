import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { addKnowledge, searchKnowledge } from '@/lib/api'
import { formatWhen, type KnowledgeEntry } from '@/lib/platform'

export function KnowledgePage() {
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (q: string) => {
    try {
      setEntries(await searchKnowledge(q))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The knowledge base could not load.')
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(query), 200)
    return () => window.clearTimeout(timer)
  }, [query, load])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Knowledge base</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Lessons from approved outcomes, plus anything you add by hand. The discovery agent reads matching entries before it analyzes a new signal.
          </p>
        </div>
        <Button type="button" onClick={() => setAdding(true)}>Add a lesson</Button>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="knowledge-search">Search</Label>
        <Input id="knowledge-search" value={query} placeholder="staging, button, monitoring…" onChange={(event) => setQuery(event.target.value)} />
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {adding ? (
        <AddLesson
          onCancel={() => setAdding(false)}
          onAdded={async () => {
            setAdding(false)
            await load(query)
          }}
        />
      ) : null}

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/70 px-6 py-10 text-center text-sm text-muted-foreground">
          {query ? 'Nothing matches that search.' : 'No lessons yet. Approve an outcome in the loop or add one here.'}
        </p>
      ) : (
        <ul className="grid gap-3">
          {entries.map((entry) => (
            <li key={entry.id} data-testid="knowledge-entry" className="grid gap-2 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{entry.title}</p>
                <span className="text-xs text-muted-foreground">{formatWhen(entry.createdAt)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{entry.body}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {entry.tags.map((tag) => (
                  <Badge key={tag} variant={tag === 'simulated' ? 'outline' : 'secondary'} className={tag === 'simulated' ? 'border-amber-600/50 text-amber-900' : ''}>
                    {tag}
                  </Badge>
                ))}
                {entry.cycleId ? (
                  <Link className="text-xs underline underline-offset-4" to={`/loop?cycle=${entry.cycleId}`}>
                    Open the cycle
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AddLesson({ onAdded, onCancel }: { onAdded: () => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await addKnowledge({
        title,
        body,
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      })
      await onAdded()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The lesson could not be saved.')
    }
  }

  return (
    <form className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5" onSubmit={submit}>
      <div className="grid gap-1.5">
        <Label htmlFor="lesson-title">Title</Label>
        <Input id="lesson-title" value={title} autoComplete="off" onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="lesson-body">What should the next cycle know?</Label>
        <Textarea id="lesson-body" value={body} onChange={(event) => setBody(event.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="lesson-tags">Tags (comma separated)</Label>
        <Input id="lesson-tags" value={tags} autoComplete="off" placeholder="frontend, staging" onChange={(event) => setTags(event.target.value)} />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit">Save lesson</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
