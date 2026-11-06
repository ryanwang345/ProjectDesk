import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { LoopEditor } from '@/components/loop-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCycles } from '@/hooks/use-cycles'
import {
  SIGNAL_META,
  STAGE_META,
  deliveryWindow,
  emptyCycleInput,
  nextCycleInput,
  validateCycle,
  type Cycle,
  type CycleInput,
} from '@/lib/loop'
import { cn } from '@/lib/utils'
import type { StorageProblem } from '@/lib/projects'

const PROBLEM_COPY: Record<StorageProblem, string> = {
  unavailable: 'The loop could not reach the Go API. Start the API and Postgres, then reload.',
  'write-failed': 'The last change did not save in Postgres. Try again.',
}

export function LoopPage() {
  const { cycles, ready, problem, addCycle, saveCycle, removeCycle, addSample, absorbCycle } = useCycles()
  const [params] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get('cycle'))
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Cycle | null>(null)
  const selected = cycles.find((cycle) => cycle.id === selectedId) ?? cycles[0] ?? null

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">The loop</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Discover a signal, ship it within 48 hours, measure what changed, and write the next signal.
          </p>
        </div>
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus data-icon="inline-start" />
          Start a cycle
        </Button>
      </div>

      {problem ? (
        <p role="status" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {PROBLEM_COPY[problem]}
        </p>
      ) : null}

      {!ready ? (
        <div aria-busy="true" className="h-64 animate-pulse rounded-xl bg-muted">
          <p className="sr-only">Loading the loop</p>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            {creating ? (
              <CreateCycle
                onCancel={() => setCreating(false)}
                onCreate={async (input) => {
                  const created = await addCycle(input)
                  setSelectedId(created.id)
                  setCreating(false)
                }}
              />
            ) : null}
            {selected ? (
              <LoopEditor
                key={selected.id}
                cycle={selected}
                onSave={(input) => saveCycle(selected.id, input).then(() => undefined)}
                onNext={async (input) => {
                  const created = await addCycle(nextCycleInput(input))
                  setSelectedId(created.id)
                }}
                onDelete={() => setPendingDelete(selected)}
                onServerUpdate={absorbCycle}
              />
            ) : creating ? null : (
              <EmptyLoop onSample={async () => {
                const created = await addSample()
                setSelectedId(created.id)
              }} />
            )}
          </div>
          <CycleList
            cycles={cycles}
            selectedId={selected?.id ?? null}
            onSelect={(id) => {
              setCreating(false)
              setSelectedId(id)
            }}
          />
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this cycle?"
        description={
          pendingDelete
            ? `"${pendingDelete.title}" will be deleted from Postgres. There is no undo.`
            : ''
        }
        confirmLabel="Remove"
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        onConfirm={() => {
          if (pendingDelete) {
            void removeCycle(pendingDelete.id)
            setSelectedId(null)
          }
        }}
      />
    </div>
  )
}

function CreateCycle({
  onCreate,
  onCancel,
}: {
  onCreate: (input: CycleInput) => Promise<void>
  onCancel: () => void
}) {
  const [input, setInput] = useState<CycleInput>(emptyCycleInput)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validateCycle(input)
    if (errors.title) {
      setError(errors.title)
      return
    }
    setError('')
    try {
      await onCreate(input)
    } catch {
      setError('The loop could not save this cycle.')
    }
  }

  return (
    <form className="mb-6 grid gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5" onSubmit={submit}>
      <div>
        <h2 className="font-display text-2xl tracking-tight">New cycle</h2>
        <p className="mt-1 text-sm text-muted-foreground">Start with the signal. The score and the ship come next.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cycle-title">Title</Label>
        <Input
          id="cycle-title"
          value={input.title}
          autoComplete="off"
          placeholder="The change you are about to make"
          aria-invalid={Boolean(error)}
          onChange={(event) => setInput((current) => ({ ...current, title: event.target.value }))}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cycle-signal">Signal</Label>
        <Textarea
          id="cycle-signal"
          value={input.signal}
          placeholder="What did you notice?"
          onChange={(event) => setInput((current) => ({ ...current, signal: event.target.value }))}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Add cycle</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

function CycleList({
  cycles,
  selectedId,
  onSelect,
}: {
  cycles: Cycle[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <aside className="rounded-2xl border border-border bg-card/70 p-3">
      <h2 className="px-2 py-1 text-sm font-medium">Cycles</h2>
      {cycles.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted-foreground">No cycles yet.</p>
      ) : (
        <ul className="grid gap-1">
          {cycles.map((cycle) => {
            const window = deliveryWindow(cycle.startedAt)
            const active = cycle.id === selectedId
            return (
              <li key={cycle.id}>
                <button
                  type="button"
                  data-cycle-title={cycle.title}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onSelect(cycle.id)}
                  className={cn(
                    'w-full rounded-xl px-2 py-2 text-left hover:bg-secondary',
                    active && 'bg-secondary',
                  )}
                >
                  <span className="block text-sm font-medium">{cycle.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {STAGE_META[cycle.stage].label} · {SIGNAL_META[cycle.signalKind].label} · {window.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}

function EmptyLoop({ onSample }: { onSample: () => Promise<void> }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/70 px-6 py-14 text-center">
      <h2 className="font-display text-3xl tracking-tight">The loop is quiet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        A cycle starts when something in the product is worth changing. The lesson at the end starts the next one.
      </p>
      <Button type="button" className="mt-6" variant="outline" onClick={() => void onSample()}>
        Load an example
      </Button>
    </div>
  )
}
