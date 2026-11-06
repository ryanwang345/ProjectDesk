import { useEffect, useState, type FormEvent } from 'react'
import { AiPanel } from '@/components/ai-panel'
import { LoopRing } from '@/components/loop-ring'
import { Button } from '@/components/ui/button'
import { listRepos } from '@/lib/api'
import type { Repo } from '@/lib/platform'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DELIVERY_STEPS,
  PRACTICES,
  SIGNAL_KINDS,
  SIGNAL_META,
  STAGE_META,
  centsToDollars,
  deliveryCount,
  deliveryWindow,
  dollarsToCents,
  toCycleInput,
  validateCycle,
  type Cycle,
  type CycleErrors,
  type CycleInput,
  type Metrics,
  type Stage,
} from '@/lib/loop'

type LoopEditorProps = {
  cycle: Cycle
  onSave: (input: CycleInput) => Promise<void>
  onNext: (input: CycleInput) => Promise<void>
  onDelete: () => void
  /** The AI loop changed the cycle on the server (stage, score, finding). */
  onServerUpdate?: (cycle: Cycle) => void
}

export function LoopEditor({ cycle, onSave, onNext, onDelete, onServerUpdate }: LoopEditorProps) {
  const [input, setInput] = useState<CycleInput>(() => toCycleInput(cycle))
  const [errors, setErrors] = useState<CycleErrors>({})
  const [pending, setPending] = useState<'save' | 'next' | null>(null)
  const window = deliveryWindow(cycle.startedAt)
  const shipped = deliveryCount(input.delivery)

  function setStage(stage: Stage) {
    setInput((current) => ({ ...current, stage }))
  }

  // When an agent step moves the cycle (approved score, new stage), bring
  // those fields into the form without discarding unrelated edits.
  function syncFromServer(next: Cycle) {
    setInput((current) => ({
      ...current,
      stage: next.stage,
      score: next.score,
      finding: next.finding,
      delivery: { ...current.delivery, deploy: current.delivery.deploy || next.delivery.deploy },
    }))
    onServerUpdate?.(next)
  }

  async function persist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateCycle(input)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setPending('save')
    try {
      await onSave(input)
    } catch {
      setErrors({ title: 'The loop could not save this cycle.' })
    } finally {
      setPending(null)
    }
  }

  async function startNext() {
    if (!input.lesson.trim()) {
      setErrors({ lesson: 'Write what you learned before starting the next cycle.' })
      setStage('rediscover')
      return
    }
    const nextErrors = validateCycle(input)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setPending('next')
    try {
      await onSave(input)
      await onNext(input)
    } catch {
      setErrors({ lesson: 'The loop could not start the next cycle.' })
    } finally {
      setPending(null)
    }
  }

  return (
    <form className="grid gap-6" onSubmit={persist}>
      <LoopRing
        stage={input.stage}
        hoursLabel={window.hours < 1 ? 'Now' : `${Math.round(window.hours)}h`}
        detail={window.label}
        onStage={setStage}
      />
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {STAGE_META[input.stage].label}
            </p>
            <h2 className="font-display text-2xl tracking-tight">{input.title}</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{STAGE_META[input.stage].work}</p>
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            {shipped} of {DELIVERY_STEPS.length} shipped
          </p>
        </div>

        {input.stage === 'discover' ? (
          <DiscoverFields input={input} errors={errors} onChange={setInput} />
        ) : null}
        {input.stage === 'deliver' ? (
          <DeliverFields input={input} onChange={setInput} />
        ) : null}
        {input.stage === 'validate' ? (
          <ValidateFields input={input} errors={errors} onChange={setInput} />
        ) : null}
        {input.stage === 'rediscover' ? (
          <RediscoverFields input={input} errors={errors} onChange={setInput} />
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="submit" disabled={pending !== null}>
            {pending === 'save' ? 'Saving' : 'Save this cycle'}
          </Button>
          {input.stage === 'rediscover' ? (
            <Button type="button" variant="outline" disabled={pending !== null} onClick={() => void startNext()}>
              {pending === 'next' ? 'Starting' : 'Start the next cycle'}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onDelete}>
            Remove
          </Button>
        </div>
      </div>
      <AiPanel cycle={cycle} onCycleUpdated={syncFromServer} />
    </form>
  )
}

function DiscoverFields({
  input,
  errors,
  onChange,
}: {
  input: CycleInput
  errors: CycleErrors
  onChange: (update: (current: CycleInput) => CycleInput) => void
}) {
  return (
    <div className="mt-5 grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="cycle-signal">Signal</Label>
        <Textarea
          id="cycle-signal"
          value={input.signal}
          aria-invalid={Boolean(errors.signal)}
          placeholder="What changed in behavior, a metric, a note, an alert, or the market?"
          onChange={(event) => onChange((current) => ({ ...current, signal: event.target.value }))}
        />
        {errors.signal ? <FieldError>{errors.signal}</FieldError> : null}
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Where it came from</legend>
        <div className="flex flex-wrap gap-2">
          {SIGNAL_KINDS.map((kind) => (
            <label key={kind} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
              <input
                type="radio"
                name="signal-kind"
                checked={input.signalKind === kind}
                onChange={() => onChange((current) => ({ ...current, signalKind: kind }))}
              />
              <span>{SIGNAL_META[kind].label}</span>
              <span className="text-muted-foreground">{SIGNAL_META[kind].source}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor="cycle-finding">Root cause</Label>
        <Textarea
          id="cycle-finding"
          value={input.finding}
          aria-invalid={Boolean(errors.finding)}
          placeholder="What is actually going on?"
          onChange={(event) => onChange((current) => ({ ...current, finding: event.target.value }))}
        />
        {errors.finding ? <FieldError>{errors.finding}</FieldError> : null}
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="cycle-score">Opportunity score</Label>
          <span className="text-sm tabular-nums">{input.score}</span>
        </div>
        <input
          id="cycle-score"
          type="range"
          min={0}
          max={100}
          value={input.score}
          onChange={(event) =>
            onChange((current) => ({ ...current, score: Number(event.target.value) }))
          }
        />
        {errors.score ? <FieldError>{errors.score}</FieldError> : null}
      </div>
    </div>
  )
}

function DeliverFields({
  input,
  onChange,
}: {
  input: CycleInput
  onChange: (update: (current: CycleInput) => CycleInput) => void
}) {
  const [repos, setRepos] = useState<Repo[]>([])
  useEffect(() => {
    listRepos()
      .then(setRepos)
      .catch(() => setRepos([]))
  }, [])

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="cycle-repo">Repository for the coding agent</Label>
        <select
          id="cycle-repo"
          value={input.repo}
          onChange={(event) => onChange((current) => ({ ...current, repo: event.target.value }))}
          className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm"
        >
          <option value="">None (no patch generation)</option>
          {repos.map((repo) => (
            <option key={repo.name} value={repo.name}>
              {repo.name}
              {repo.description ? ` — ${repo.description}` : ''}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Only repositories under the API's authorized root are listed. Agents work on a throwaway copy.
        </p>
      </div>
      <CheckList
        title="Ship path"
        items={DELIVERY_STEPS}
        values={input.delivery}
        onToggle={(key) =>
          onChange((current) => ({
            ...current,
            delivery: { ...current.delivery, [key]: !current.delivery[key] },
          }))
        }
      />
      <CheckList
        title="How it ships"
        items={PRACTICES}
        values={input.practices}
        onToggle={(key) =>
          onChange((current) => ({
            ...current,
            practices: { ...current.practices, [key]: !current.practices[key] },
          }))
        }
      />
    </div>
  )
}

function CheckList<Key extends string>({
  title,
  items,
  values,
  onToggle,
}: {
  title: string
  items: { key: Key; label: string }[]
  values: Record<Key, boolean>
  onToggle: (key: Key) => void
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{title}</legend>
      {items.map((item) => (
        <label key={item.key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values[item.key]}
            onChange={() => onToggle(item.key)}
          />
          {item.label}
        </label>
      ))}
    </fieldset>
  )
}

function ValidateFields({
  input,
  errors,
  onChange,
}: {
  input: CycleInput
  errors: CycleErrors
  onChange: (update: (current: CycleInput) => CycleInput) => void
}) {
  function setMetric(key: keyof Metrics, raw: string, asCents = false) {
    onChange((current) => {
      const metrics = { ...current.metrics }
      if (raw.trim() === '') {
        metrics[key] = null
      } else {
        const value = Number(raw)
        if (Number.isNaN(value)) return current
        metrics[key] = asCents ? dollarsToCents(value) : value
      }
      return { ...current, metrics }
    })
  }

  const revenue = input.metrics.revenueCents
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <MetricField
        id="metric-activation"
        label="Activation rate %"
        placeholder="23.6"
        value={input.metrics.activation}
        onChange={(raw) => setMetric('activation', raw)}
      />
      <MetricField
        id="metric-conversion"
        label="Conversion rate %"
        placeholder="8.7"
        value={input.metrics.conversion}
        onChange={(raw) => setMetric('conversion', raw)}
      />
      <MetricField
        id="metric-revenue"
        label="Revenue $"
        placeholder="128000"
        value={revenue === null ? null : centsToDollars(revenue)}
        onChange={(raw) => setMetric('revenueCents', raw, true)}
      />
      <MetricField
        id="metric-latency"
        label="Latency p95 ms"
        placeholder="210"
        value={input.metrics.latencyMs}
        onChange={(raw) => setMetric('latencyMs', raw)}
      />
      <MetricField
        id="metric-error"
        label="Error rate %"
        placeholder="0.21"
        value={input.metrics.errorRate}
        onChange={(raw) => setMetric('errorRate', raw)}
      />
      {errors.metrics ? <FieldError>{errors.metrics}</FieldError> : null}
    </div>
  )
}

function MetricField({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string
  label: string
  placeholder: string
  value: number | null
  onChange: (raw: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        placeholder={placeholder}
        value={value === null ? '' : String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function RediscoverFields({
  input,
  errors,
  onChange,
}: {
  input: CycleInput
  errors: CycleErrors
  onChange: (update: (current: CycleInput) => CycleInput) => void
}) {
  return (
    <div className="mt-5 grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="cycle-lesson">Lesson</Label>
        <Textarea
          id="cycle-lesson"
          value={input.lesson}
          aria-invalid={Boolean(errors.lesson)}
          placeholder="What should the next cycle already know?"
          onChange={(event) => onChange((current) => ({ ...current, lesson: event.target.value }))}
        />
        {errors.lesson ? <FieldError>{errors.lesson}</FieldError> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cycle-priority">Updated priority</Label>
        <Input
          id="cycle-priority"
          value={input.priority}
          aria-invalid={Boolean(errors.priority)}
          placeholder="What moves to the front of the line?"
          onChange={(event) => onChange((current) => ({ ...current, priority: event.target.value }))}
        />
        {errors.priority ? <FieldError>{errors.priority}</FieldError> : null}
      </div>
    </div>
  )
}

function FieldError({ children }: { children: string }) {
  return <p className="text-sm text-destructive">{children}</p>
}
