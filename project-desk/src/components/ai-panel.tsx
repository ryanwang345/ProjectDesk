import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useWorkflow } from '@/hooks/use-workflow'
import {
  cancelCycleWorkflow,
  cancelJob,
  decideAnalysis,
  decideArtifact,
  editArtifact,
  listProviders,
  markDeployed,
  overrideValidation,
  resetCycleWorkflow,
  startJob,
} from '@/lib/api'
import type { Cycle } from '@/lib/loop'
import {
  ARTIFACT_LABEL,
  JOB_LABEL,
  formatWhen,
  workflowMeta,
  type Analysis,
  type Artifact,
  type ArtifactKind,
  type Job,
  type JobKind,
  type ValidationData,
  type Workflow,
} from '@/lib/platform'
import { cn } from '@/lib/utils'

type AiPanelProps = {
  cycle: Cycle
  /** Called when the server changed the cycle (stage, score, finding, state). */
  onCycleUpdated: (cycle: Cycle) => void
}

const TONE_CLASS = {
  quiet: 'border-border text-muted-foreground',
  active: 'border-primary/40 bg-primary/10 text-primary',
  wait: 'border-amber-600/40 bg-amber-100/60 text-amber-900',
  good: 'border-primary/40 bg-primary/10 text-primary',
  bad: 'border-destructive/40 bg-destructive/10 text-destructive',
}

export function AiPanel({ cycle, onCycleUpdated }: AiPanelProps) {
  const { workflow, error, refresh, active } = useWorkflow(cycle.id, (next) => onCycleUpdated(next.cycle))
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [providerCount, setProviderCount] = useState<number | null>(null)

  useEffect(() => {
    listProviders()
      .then((list) => setProviderCount(list.length))
      .catch(() => setProviderCount(null))
  }, [])

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label)
    setMessage('')
    try {
      await action()
      await refresh()
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'That did not work.')
    } finally {
      setBusy('')
    }
  }

  if (!workflow) {
    return (
      <section aria-label="AI loop" className="rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">{error || 'Loading the AI loop…'}</p>
      </section>
    )
  }

  const state = workflow.cycle.workflowState || 'PENDING'
  const meta = workflowMeta(state)
  const actions = workflow.actions ?? []
  const runningJob = workflow.jobs.find((job) => job.status === 'running' || job.status === 'queued')
  const lastJob = workflow.jobs[0]
  const simulated = workflow.jobs.some((job) => job.simulated) || workflow.artifacts.some((a) => a.simulated)
  const proposedAnalysis = workflow.analyses.find((a) => a.status === 'proposed')
  const proposedArtifacts = workflow.artifacts.filter((a) => a.status === 'proposed')
  const latestValidation = workflow.artifacts.find((a) => a.kind === 'validation')

  return (
    <section aria-label="AI loop" data-testid="ai-panel" className="rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">AI loop</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              data-testid="workflow-state"
              className={cn('rounded-full border px-2.5 py-0.5 text-sm font-medium', TONE_CLASS[meta.tone])}
            >
              {meta.label}
            </span>
            {simulated ? <SimulatedBadge /> : null}
            {lastJob?.providerName ? (
              <span className="text-xs text-muted-foreground">
                {lastJob.providerName}
                {lastJob.model ? ` · ${lastJob.model}` : ''}
              </span>
            ) : null}
          </div>
        </div>
        {providerCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            No AI provider yet.{' '}
            <Link className="underline underline-offset-4" to="/ai/settings">
              Add one in AI Settings
            </Link>
            .
          </p>
        ) : null}
      </div>

      {runningJob ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>
            <span aria-busy="true" className="mr-2 inline-block size-2 animate-pulse rounded-full bg-primary" />
            {JOB_LABEL[runningJob.kind] ?? runningJob.kind} is {runningJob.status}
            {runningJob.attempts > 1 ? ` (attempt ${runningJob.attempts})` : ''}. It keeps running if you leave this page.
          </span>
          <Button type="button" size="sm" variant="outline" disabled={busy !== ''} onClick={() => void run('cancel-job', () => cancelJob(runningJob.id))}>
            Stop
          </Button>
        </div>
      ) : null}

      {lastJob && lastJob.status === 'failed' && !runningJob ? (
        <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {JOB_LABEL[lastJob.kind] ?? lastJob.kind} failed: {lastJob.error}
        </p>
      ) : null}

      <ActionBar
        cycle={workflow.cycle}
        actions={actions}
        busy={busy}
        disabled={active || busy !== ''}
        onStart={(kind) => void run(kind, () => startJob(cycle.id, kind))}
        onDeployed={() => void run('deployed', () => markDeployed(cycle.id))}
        onOverride={(reason) => void run('override', () => overrideValidation(cycle.id, reason))}
        onCancel={() => void run('cancel', () => cancelCycleWorkflow(cycle.id))}
        onReset={() => void run('reset', () => resetCycleWorkflow(cycle.id))}
      />

      {message ? (
        <p role="status" className="mt-3 text-sm text-destructive">
          {message}
        </p>
      ) : null}

      {proposedAnalysis ? (
        <AnalysisReview
          cycle={workflow.cycle}
          analysis={proposedAnalysis}
          disabled={busy !== ''}
          onDecide={(decision, applyScore, applyFinding) =>
            void run('analysis', () => decideAnalysis(cycle.id, proposedAnalysis.id, { decision, applyScore, applyFinding }))
          }
        />
      ) : null}

      {proposedArtifacts.map((artifact) => (
        <ArtifactReview
          key={artifact.id}
          artifact={artifact}
          disabled={busy !== ''}
          onDecide={(decision) => void run('artifact', () => decideArtifact(cycle.id, artifact.id, decision))}
          onEdit={(content) => run('edit', () => editArtifact(cycle.id, artifact.id, content))}
        />
      ))}

      {latestValidation && latestValidation.status !== 'proposed' ? (
        <ValidationCard artifact={latestValidation} />
      ) : null}

      <History workflow={workflow} />
    </section>
  )
}

function SimulatedBadge() {
  return (
    <Badge variant="outline" className="border-amber-600/50 text-amber-900" title="Produced by the demo provider. Not real analysis.">
      Simulated
    </Badge>
  )
}

function ActionBar({
  cycle,
  actions,
  busy,
  disabled,
  onStart,
  onDeployed,
  onOverride,
  onCancel,
  onReset,
}: {
  cycle: Cycle
  actions: string[]
  busy: string
  disabled: boolean
  onStart: (kind: JobKind) => void
  onDeployed: () => void
  onOverride: (reason: string) => void
  onCancel: () => void
  onReset: () => void
}) {
  const [overriding, setOverriding] = useState(false)
  const [reason, setReason] = useState('')
  const steps: JobKind[] = ['analyze', 'specification', 'plan', 'patch', 'validate', 'outcome']
  const needsRepo = actions.includes('patch') && !cycle.repo

  return (
    <div className="mt-4 grid gap-2">
      <div className="flex flex-wrap gap-2">
        {steps
          .filter((kind) => actions.includes(kind))
          .map((kind) => (
            <Button key={kind} type="button" size="sm" disabled={disabled || (kind === 'patch' && needsRepo)} onClick={() => onStart(kind)}>
              {busy === kind ? 'Starting…' : JOB_LABEL[kind]}
            </Button>
          ))}
        {actions.includes('deployed') ? (
          <Button type="button" size="sm" disabled={disabled} onClick={onDeployed}>
            Mark deployed
          </Button>
        ) : null}
        {actions.includes('override') ? (
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setOverriding((v) => !v)}>
            Override validation
          </Button>
        ) : null}
        {actions.includes('reset') ? (
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onReset}>
            Reset
          </Button>
        ) : null}
        {actions.includes('cancel') && cycle.workflowState !== 'PENDING' ? (
          <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onCancel}>
            Cancel AI loop
          </Button>
        ) : null}
      </div>
      {needsRepo ? (
        <p className="text-sm text-muted-foreground">Choose a repository in the Deliver stage and save before generating a patch.</p>
      ) : null}
      {actions.includes('decide') ? (
        <p className="text-sm text-muted-foreground">Review the proposal below. Nothing is applied until you approve it.</p>
      ) : null}
      {overriding ? (
        <div className="grid gap-2 rounded-xl border border-border p-3">
          <Label htmlFor="override-reason">Why is it safe to continue without passing validation?</Label>
          <Textarea id="override-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: tests were run by hand on staging, build 123." />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={disabled || reason.trim().length < 10} onClick={() => { onOverride(reason.trim()); setOverriding(false); setReason('') }}>
              Record override
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOverriding(false)}>
              Keep blocked
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function AnalysisReview({
  cycle,
  analysis,
  disabled,
  onDecide,
}: {
  cycle: Cycle
  analysis: Analysis
  disabled: boolean
  onDecide: (decision: 'approve' | 'reject', applyScore: boolean, applyFinding: boolean) => void
}) {
  const c = analysis.content
  const [applyScore, setApplyScore] = useState(true)
  const [applyFinding, setApplyFinding] = useState(cycle.finding.trim() === '')

  return (
    <div data-testid="analysis-review" className="mt-4 grid gap-3 rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg tracking-tight">Proposed analysis</h3>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {analysis.providerName} · {analysis.model}
          {analysis.simulated ? <SimulatedBadge /> : null}
        </span>
      </div>
      <p className="text-sm">{c.summary}</p>

      <div>
        <p className="text-sm font-medium">Hypotheses (not confirmed)</p>
        <ul className="mt-1 grid gap-2">
          {c.hypotheses.map((h, index) => (
            <li key={index} className="rounded-lg border border-border/80 px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span>
                  <span className="mr-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">Hypothesis</span>
                  {h.cause}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{Math.round(h.confidence * 100)}%</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Evidence: {h.evidence}</p>
            </li>
          ))}
        </ul>
      </div>

      {c.missingInformation.length > 0 ? (
        <Bullets title="Missing information" items={c.missingInformation} />
      ) : null}

      <div className="rounded-lg bg-muted px-3 py-2 text-sm">
        <span className="font-medium">Proposed score {c.proposedScore}</span>
        <span className="text-muted-foreground"> (currently {cycle.score}) — {c.scoreRationale}</span>
      </div>

      <div className="text-sm">
        <p className="font-medium">Opportunity: {c.opportunity.title}</p>
        <p className="text-muted-foreground">{c.opportunity.outcome}</p>
      </div>
      <Bullets title="Acceptance criteria" items={c.acceptanceCriteria} />

      <div className="grid gap-1.5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={applyScore} onChange={() => setApplyScore((v) => !v)} />
          Replace the opportunity score {cycle.score} with {c.proposedScore}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={applyFinding} onChange={() => setApplyFinding((v) => !v)} />
          {cycle.finding.trim() ? 'Replace my root cause with the top hypothesis' : 'Use the top hypothesis as the root cause (labeled as a hypothesis)'}
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={disabled} onClick={() => onDecide('approve', applyScore, applyFinding)}>
          Approve analysis
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onDecide('reject', false, false)}>
          Reject
        </Button>
      </div>
    </div>
  )
}

function ArtifactReview({
  artifact,
  disabled,
  onDecide,
  onEdit,
}: {
  artifact: Artifact
  disabled: boolean
  onDecide: (decision: 'approve' | 'reject') => void
  onEdit: (content: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(artifact.content)
  const editable = artifact.kind === 'specification' || artifact.kind === 'plan'
  const data = artifact.data as { summary?: string; files?: string[]; repair?: boolean }

  return (
    <div data-testid={`artifact-${artifact.kind}`} className="mt-4 grid gap-3 rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg tracking-tight">
          {ARTIFACT_LABEL[artifact.kind]} v{artifact.version}
          {data.repair ? ' (repair proposal)' : ''}
        </h3>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {artifact.providerName} · {artifact.model}
          {artifact.simulated ? <SimulatedBadge /> : null}
        </span>
      </div>
      {artifact.kind === 'patch' ? (
        <>
          {data.summary ? <p className="text-sm">{data.summary}</p> : null}
          {data.files?.length ? <p className="text-xs text-muted-foreground">Files: {data.files.join(', ')}</p> : null}
          <Diff diff={artifact.content} />
          <p className="text-xs text-muted-foreground">
            This diff was checked in an isolated copy of the repository. Approving it starts validation; nothing is pushed to a branch.
          </p>
        </>
      ) : editing ? (
        <Textarea rows={14} value={draft} onChange={(event) => setDraft(event.target.value)} className="font-mono text-xs" />
      ) : (
        <Markdownish text={artifact.content} />
      )}
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button type="button" size="sm" disabled={disabled} onClick={() => void onEdit(draft).then(() => setEditing(false))}>
              Save edit
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setDraft(artifact.content); setEditing(false) }}>
              Discard
            </Button>
          </>
        ) : (
          <>
            <Button type="button" size="sm" disabled={disabled} onClick={() => onDecide('approve')}>
              Approve {ARTIFACT_LABEL[artifact.kind].toLowerCase()}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onDecide('reject')}>
              Reject
            </Button>
            {editable ? (
              <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => setEditing(true)}>
                Edit before approving
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function ValidationCard({ artifact }: { artifact: Artifact }) {
  const data = artifact.data as unknown as ValidationData
  const [showOutput, setShowOutput] = useState(false)
  return (
    <div data-testid="validation-card" className="mt-4 grid gap-3 rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg tracking-tight">Validation v{artifact.version}</h3>
        <Badge variant={artifact.status === 'passed' ? 'default' : artifact.status === 'failed' ? 'destructive' : 'outline'}>
          {artifact.status}
        </Badge>
      </div>
      <ul className="grid gap-1.5">
        {data.gates?.map((gate) => (
          <li key={gate.name} className="flex items-start gap-2 text-sm">
            <span
              className={cn(
                'mt-1 inline-block size-2 shrink-0 rounded-full',
                gate.status === 'pass' && 'bg-primary',
                gate.status === 'fail' && 'bg-destructive',
                gate.status === 'not_run' && 'bg-muted-foreground/40',
              )}
            />
            <span>
              <span className="font-medium">{gate.name}</span>
              <span className="text-muted-foreground"> — {gate.status.replace('_', ' ')}. {gate.detail}</span>
              {gate.seconds ? <span className="text-muted-foreground tabular-nums"> ({gate.seconds.toFixed(1)}s)</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Runner: {data.runner}. Repairs used {data.repairsUsed} of {data.maxRepairs}.
      </p>
      {data.analysis ? (
        <div className="rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="font-medium">QA analysis ({data.analysis.category}):</span> {data.analysis.explanation}
        </div>
      ) : null}
      {data.output ? (
        <div>
          <Button type="button" size="xs" variant="ghost" onClick={() => setShowOutput((v) => !v)}>
            {showOutput ? 'Hide test output' : 'Show test output'}
          </Button>
          {showOutput ? <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted px-3 py-2 text-xs">{data.output}</pre> : null}
        </div>
      ) : null}
    </div>
  )
}

function History({ workflow }: { workflow: Workflow }) {
  const [open, setOpen] = useState(false)
  const decided = workflow.artifacts.filter((a) => a.status !== 'proposed')
  const totalTokens = workflow.jobs.reduce((sum, job) => sum + job.promptTokens + job.completionTokens, 0)
  return (
    <div className="mt-4">
      <Button type="button" size="xs" variant="ghost" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide history' : `History (${workflow.events.length} events, ${workflow.jobs.length} runs, ${totalTokens} tokens)`}
      </Button>
      {open ? (
        <div className="mt-2 grid gap-4 text-sm">
          {decided.length > 0 ? (
            <div>
              <p className="font-medium">Artifacts</p>
              <ul className="mt-1 grid gap-1">
                {decided.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span className="text-foreground">{ARTIFACT_LABEL[a.kind as ArtifactKind]} v{a.version}</span>
                    <Badge variant="outline">{a.status}</Badge>
                    {a.simulated ? <SimulatedBadge /> : null}
                    <span>{formatWhen(a.decidedAt ?? a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <p className="font-medium">Runs</p>
            <ul className="mt-1 grid gap-1">
              {workflow.jobs.map((job: Job) => (
                <li key={job.id} className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  <span className="text-foreground">{JOB_LABEL[job.kind] ?? job.kind}</span>
                  <Badge variant="outline">{job.status}</Badge>
                  <span>{job.providerName}{job.model ? ` · ${job.model}` : ''}</span>
                  <span className="tabular-nums">{job.promptTokens + job.completionTokens} tokens</span>
                  <span>{formatWhen(job.createdAt)}</span>
                  {job.error ? <span className="text-destructive">{job.error}</span> : null}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium">Timeline</p>
            <ul className="mt-1 grid gap-1">
              {workflow.events.map((event) => (
                <li key={event.id} className="flex gap-2 text-muted-foreground">
                  <span className="shrink-0 tabular-nums">{formatWhen(event.createdAt)}</span>
                  <span>
                    <span className="text-foreground">{event.kind}</span> {event.message}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

/** Renders the headings and bullets our artifacts use, without a markdown dependency. */
function Markdownish({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="grid gap-1 text-sm">
      {lines.map((line, index) => {
        if (line.startsWith('# ')) return <p key={index} className="font-display text-base">{line.slice(2)}</p>
        if (line.startsWith('## ')) return <p key={index} className="mt-2 font-medium">{line.slice(3)}</p>
        if (line.startsWith('- ')) return <p key={index} className="pl-4 text-muted-foreground">• {line.slice(2)}</p>
        if (/^\d+\. /.test(line)) return <p key={index} className="pl-4 text-muted-foreground">{line.replace(/\*\*/g, '')}</p>
        if (line.trim() === '') return null
        return <p key={index} className="text-muted-foreground">{line}</p>
      })}
    </div>
  )
}

function Diff({ diff }: { diff: string }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-lg bg-muted px-3 py-2 text-xs leading-5">
      {diff.split('\n').map((line, index) => (
        <span
          key={index}
          className={cn(
            'block',
            line.startsWith('+') && !line.startsWith('+++') && 'bg-primary/10 text-primary',
            line.startsWith('-') && !line.startsWith('---') && 'bg-destructive/10 text-destructive',
            (line.startsWith('@@') || line.startsWith('diff ')) && 'text-muted-foreground',
          )}
        >
          {line || ' '}
        </span>
      ))}
    </pre>
  )
}
