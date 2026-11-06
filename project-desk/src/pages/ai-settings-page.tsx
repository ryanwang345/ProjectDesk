import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ApiError,
  createProvider,
  deleteProvider,
  getAdminToken,
  getPlatformStatus,
  listAgents,
  listProviders,
  setAdminToken,
  setAgent,
  testProvider,
  updateProvider,
} from '@/lib/api'
import {
  PROVIDER_KIND_META,
  ROLE_META,
  type Assignment,
  type PlatformStatus,
  type Provider,
  type ProviderInput,
  type ProviderKind,
  type ProviderTest,
} from '@/lib/platform'

const KINDS: ProviderKind[] = ['openai', 'anthropic', 'ollama', 'demo']

function emptyProvider(): ProviderInput {
  return { name: '', kind: 'openai', baseUrl: '', model: PROVIDER_KIND_META.openai.defaultModel, apiKey: '', isDefault: false }
}

export function AiSettingsPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [status, setStatus] = useState<PlatformStatus | null>(null)
  const [editing, setEditing] = useState<Provider | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [token, setToken] = useState(getAdminToken())

  const load = useCallback(async () => {
    try {
      const [list, agents, platform] = await Promise.all([listProviders(), listAgents(), getPlatformStatus()])
      setProviders(list)
      setAssignments(agents.assignments)
      setStatus(platform)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI settings could not load.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function report(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) {
      setError('This server requires an admin token for settings changes. Enter it below.')
      return
    }
    setError(cause instanceof Error ? cause.message : 'That did not work.')
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">AI settings</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Connect the models the loop may use. Keys are encrypted in Postgres and never sent back to the browser.
          </p>
        </div>
        <Button type="button" onClick={() => { setAdding(true); setEditing(null) }}>
          Add provider
        </Button>
      </div>

      {status ? (
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <Badge variant={status.secretStorage ? 'outline' : 'destructive'}>
            {status.secretStorage ? 'Key storage on' : 'Key storage off: set PROJECT_DESK_SECRET_KEY'}
          </Badge>
          <Badge variant="outline">Sandbox runner: {status.runnerReady ? status.runner : 'not available'}</Badge>
          <Badge variant="outline">{status.reposConfigured} authorized repositories</Badge>
          {status.adminTokenRequired ? <Badge variant="outline">Admin token required</Badge> : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {adding || editing ? (
        <ProviderForm
          key={editing?.id ?? 'new'}
          initial={editing ? { name: editing.name, kind: editing.kind, baseUrl: editing.baseUrl, model: editing.model, isDefault: editing.isDefault } : emptyProvider()}
          existing={editing}
          onCancel={() => { setAdding(false); setEditing(null) }}
          onSave={async (input) => {
            try {
              if (editing) await updateProvider(editing.id, input)
              else await createProvider(input)
              setAdding(false)
              setEditing(null)
              await load()
            } catch (cause) {
              report(cause)
              throw cause
            }
          }}
        />
      ) : null}

      <section className="grid gap-3">
        <h2 className="font-display text-2xl tracking-tight">Providers</h2>
        {providers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/70 px-6 py-10 text-center text-sm text-muted-foreground">
            No providers yet. Add OpenAI, Anthropic, a local Ollama, or the simulated demo provider to try the workflow offline.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {providers.map((provider) => (
              <li key={provider.id} data-testid="provider-card" className="grid gap-2 rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{provider.name}</span>
                    {provider.isDefault ? <Badge>Default</Badge> : null}
                    {provider.capabilities.simulated ? (
                      <Badge variant="outline" className="border-amber-600/50 text-amber-900">Simulated</Badge>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">{PROVIDER_KIND_META[provider.kind].label}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {provider.model || 'no model'}
                  {provider.baseUrl ? ` · ${provider.baseUrl}` : ''}
                  {PROVIDER_KIND_META[provider.kind].needsKey ? (provider.hasKey ? ' · key stored' : ' · no key') : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(provider); setAdding(false) }}>
                    Edit
                  </Button>
                  {!provider.isDefault ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void updateProvider(provider.id, { name: provider.name, kind: provider.kind, baseUrl: provider.baseUrl, model: provider.model, isDefault: true })
                          .then(load)
                          .catch(report)
                      }
                    >
                      Make default
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Remove provider "${provider.name}"?`)) {
                        void deleteProvider(provider.id).then(load).catch(report)
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="font-display text-2xl tracking-tight">Agent roles</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each role uses the default provider unless you assign one here. A model override applies to that role only.
          </p>
        </div>
        <ul className="grid gap-2">
          {assignments.map((assignment) => (
            <RoleRow
              key={assignment.role}
              assignment={assignment}
              providers={providers}
              onChange={async (next) => {
                try {
                  await setAgent(assignment.role, next)
                  await load()
                } catch (cause) {
                  report(cause)
                }
              }}
            />
          ))}
        </ul>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Admin token</CardTitle>
          <CardDescription>
            Only needed when the server sets PROJECT_DESK_ADMIN_TOKEN. Kept in this tab's session storage, never in Postgres.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="admin-token">Token</Label>
            <Input id="admin-token" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={() => { setAdminToken(token); setError('') }}>
            Use token
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function ProviderForm({
  initial,
  existing,
  onSave,
  onCancel,
}: {
  initial: ProviderInput
  existing: Provider | null
  onSave: (input: ProviderInput) => Promise<void>
  onCancel: () => void
}) {
  const [input, setInput] = useState<ProviderInput>(initial)
  const [apiKey, setApiKey] = useState('')
  const [test, setTest] = useState<ProviderTest | null>(null)
  const [pending, setPending] = useState<'save' | 'test' | null>(null)
  const [error, setError] = useState('')
  const kindMeta = PROVIDER_KIND_META[input.kind]

  function payload(): ProviderInput {
    const base: ProviderInput = { name: input.name, kind: input.kind, baseUrl: input.baseUrl, model: input.model, isDefault: input.isDefault }
    if (apiKey !== '') base.apiKey = apiKey
    if (!existing && apiKey === '') base.apiKey = ''
    return base
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending('save')
    setError('')
    try {
      await onSave(payload())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The provider could not be saved.')
    } finally {
      setPending(null)
    }
  }

  async function runTest() {
    setPending('test')
    setTest(null)
    try {
      const body = { ...payload(), ...(existing ? { id: existing.id } : {}) }
      setTest(await testProvider(body))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The test could not run.')
    } finally {
      setPending(null)
    }
  }

  return (
    <form data-testid="provider-form" className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5" onSubmit={submit}>
      <div>
        <h2 className="font-display text-2xl tracking-tight">{existing ? `Edit ${existing.name}` : 'New provider'}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{kindMeta.hint}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="provider-name">Name</Label>
          <Input id="provider-name" value={input.name} autoComplete="off" placeholder="Team OpenAI" onChange={(event) => setInput((c) => ({ ...c, name: event.target.value }))} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="provider-kind">Kind</Label>
          <select
            id="provider-kind"
            value={input.kind}
            className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm"
            onChange={(event) => {
              const kind = event.target.value as ProviderKind
              setInput((c) => ({ ...c, kind, model: c.model || PROVIDER_KIND_META[kind].defaultModel }))
            }}
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>{PROVIDER_KIND_META[kind].label}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="provider-model">Model</Label>
          <Input id="provider-model" value={input.model} autoComplete="off" placeholder={kindMeta.defaultModel} onChange={(event) => setInput((c) => ({ ...c, model: event.target.value }))} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="provider-url">Endpoint (optional)</Label>
          <Input id="provider-url" value={input.baseUrl} autoComplete="off" placeholder={input.kind === 'ollama' ? 'http://127.0.0.1:11434' : 'https://api.openai.com/v1'} onChange={(event) => setInput((c) => ({ ...c, baseUrl: event.target.value }))} />
        </div>
        {kindMeta.needsKey ? (
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="provider-key">API key {existing?.hasKey ? '(leave blank to keep the stored key)' : ''}</Label>
            <Input id="provider-key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={input.isDefault} onChange={() => setInput((c) => ({ ...c, isDefault: !c.isDefault }))} />
          Use as the default provider
        </label>
      </div>
      {test ? (
        <p role="status" data-testid="provider-test-result" className={test.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
          {test.ok ? `Connected in ${test.ms} ms (${test.model ?? 'model unknown'})${test.simulated ? ' — simulated' : ''}` : `Connection failed: ${test.error}`}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending !== null}>{pending === 'save' ? 'Saving' : existing ? 'Save changes' : 'Add provider'}</Button>
        <Button type="button" variant="outline" disabled={pending !== null} onClick={() => void runTest()}>
          {pending === 'test' ? 'Testing' : 'Test connection'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

function RoleRow({
  assignment,
  providers,
  onChange,
}: {
  assignment: Assignment
  providers: Provider[]
  onChange: (next: { providerId: string | null; model: string }) => Promise<void>
}) {
  const meta = ROLE_META[assignment.role] ?? { label: assignment.role, does: '' }
  const [model, setModel] = useState(assignment.model)
  return (
    <li className="grid gap-2 rounded-xl border border-border bg-card px-4 py-3 sm:grid-cols-[10rem_1fr_12rem_8rem] sm:items-center">
      <div>
        <p className="text-sm font-medium">{meta.label}</p>
      </div>
      <p className="text-xs text-muted-foreground">{meta.does}</p>
      <select
        aria-label={`${meta.label} provider`}
        value={assignment.providerId ?? ''}
        className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm"
        onChange={(event) => void onChange({ providerId: event.target.value || null, model })}
      >
        <option value="">Default provider</option>
        {providers.map((provider) => (
          <option key={provider.id} value={provider.id}>{provider.name}</option>
        ))}
      </select>
      <Input
        aria-label={`${meta.label} model override`}
        placeholder="model"
        value={model}
        onChange={(event) => setModel(event.target.value)}
        onBlur={() => {
          if (model !== assignment.model) void onChange({ providerId: assignment.providerId, model })
        }}
      />
    </li>
  )
}
