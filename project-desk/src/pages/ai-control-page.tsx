import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cancelJob, getPlatformStatus, getUsage, listCycles, listEvents, listJobs } from '@/lib/api'
import type { Cycle } from '@/lib/loop'
import { JOB_LABEL, formatWhen, workflowMeta, type Event, type Job, type PlatformStatus, type Usage } from '@/lib/platform'

export function AiControlPage() {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [status, setStatus] = useState<PlatformStatus | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [u, s, j, e, c] = await Promise.all([getUsage(), getPlatformStatus(), listJobs(40), listEvents(60), listCycles()])
      setUsage(u)
      setStatus(s)
      setJobs(j)
      setEvents(e)
      setCycles(c)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The control center could not load.')
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(timer)
  }, [load])

  const byState = cycles.reduce<Record<string, Cycle[]>>((acc, cycle) => {
    const key = cycle.workflowState || 'PENDING'
    ;(acc[key] ??= []).push(cycle)
    return acc
  }, {})
  const attention = [...(byState.AWAITING_APPROVAL ?? []), ...(byState.BLOCKED ?? []), ...(byState.FAILED ?? [])]

  return (
    <div className="flex flex-col gap-8">
      <div className="max-w-xl">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">AI control center</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          What the agents are doing, what is waiting on you, and what it has cost. The worker runs inside the Go API.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Running" value={usage ? usage.running + usage.queued : '–'} hint={usage ? `${usage.queued} queued` : ''} />
        <Stat label="Finished" value={usage?.done ?? '–'} hint={usage ? `${usage.failed} failed` : ''} />
        <Stat label="Tokens" value={usage ? usage.promptTokens + usage.completionTokens : '–'} hint={usage ? `${usage.promptTokens} in · ${usage.completionTokens} out` : ''} />
        <Stat
          label="Sandbox"
          value={status ? (status.runnerReady ? status.runner : 'off') : '–'}
          hint={status ? (status.runnerReady ? 'tests run in containers' : 'tests report not run') : ''}
        />
      </div>

      <section className="grid gap-3">
        <h2 className="font-display text-2xl tracking-tight">Needs a person</h2>
        {attention.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is waiting on approval, blocked, or failed.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {attention.map((cycle) => (
              <li key={cycle.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{cycle.title}</p>
                  <p className="text-xs text-muted-foreground">{workflowMeta(cycle.workflowState).label}</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/loop?cycle=${cycle.id}`}>Open</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-2xl tracking-tight">Cycles by state</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(byState)
            .sort((a, b) => b[1].length - a[1].length)
            .map(([state, list]) => (
              <Badge key={state} variant="outline">
                {workflowMeta(state).label}: {list.length}
              </Badge>
            ))}
          {cycles.length === 0 ? <span className="text-sm text-muted-foreground">No cycles yet.</span> : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Execution history</CardTitle>
            <CardDescription>Latest agent runs across all cycles.</CardDescription>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs yet.</p>
            ) : (
              <ul className="grid gap-2">
                {jobs.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant={job.status === 'failed' ? 'destructive' : job.status === 'running' ? 'default' : 'outline'}>{job.status}</Badge>
                    <span>{JOB_LABEL[job.kind] ?? job.kind}</span>
                    <span className="text-muted-foreground">{job.providerName}{job.model ? ` · ${job.model}` : ''}</span>
                    {job.simulated ? <Badge variant="outline" className="border-amber-600/50 text-amber-900">Simulated</Badge> : null}
                    <span className="text-muted-foreground tabular-nums">{job.promptTokens + job.completionTokens} tok</span>
                    <span className="text-muted-foreground">{formatWhen(job.createdAt)}</span>
                    {job.status === 'queued' || job.status === 'running' ? (
                      <Button type="button" size="xs" variant="ghost" onClick={() => void cancelJob(job.id).then(load)}>Stop</Button>
                    ) : null}
                    {job.error ? <span className="w-full text-xs text-destructive">{job.error}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>Every state change, approval, and run, newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
            ) : (
              <ul className="grid gap-1.5 text-sm">
                {events.map((event) => (
                  <li key={event.id} className="flex gap-2">
                    <span className="shrink-0 text-muted-foreground tabular-nums">{formatWhen(event.createdAt)}</span>
                    <span>
                      <span className="font-medium">{event.kind}</span>{' '}
                      <span className="text-muted-foreground">{event.message}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
