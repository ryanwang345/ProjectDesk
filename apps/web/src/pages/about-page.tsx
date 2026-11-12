import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/i18n'

const steps = [
  {
    title: 'React builds static files',
    body: 'Vite compiles this interface into HTML, CSS, and JavaScript in the dist folder.',
  },
  {
    title: 'nginx serves the page and the API',
    body: 'nginx answers on this host, sends the built assets, and forwards /api to the Go server. Unknown page paths still return index.html, so refreshing /about opens the app.',
  },
  {
    title: 'Go saves each card in Postgres',
    body: 'Creating, editing, moving, or removing a project is a request to the Go API. Postgres stores the name, note, status, and updated time.',
  },
  {
    title: 'English cards keep a word and ten sentences',
    body: 'Each card stores one English word, its meaning, and ten sentences that use the word. Postgres keeps the set.',
  },
]

export function AboutPage() {
  const { t } = useI18n()
  return (
    <div className="flex w-full flex-col gap-8">
      <div>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{t('about.title')}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {t('about.lead')}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <Card key={step.title}>
            <CardHeader>
              <CardDescription className="font-display text-2xl tracking-tight text-primary">0{index + 1}</CardDescription>
              <CardTitle className="font-display text-2xl tracking-tight">{step.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{step.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>The fallback</CardTitle>
            <CardDescription>nginx.conf</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <pre className="overflow-x-auto rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
              <code>try_files $uri $uri/ /index.html;</code>
            </pre>
            <p className="text-muted-foreground">
              A direct check of nginx, outside React, is{' '}
              <a className="underline underline-offset-4 hover:text-foreground" href="/healthz">
                /healthz
              </a>
              . It returns the plain text <span className="text-foreground">ok</span>.
            </p>
            <p>
              <Link className="text-sm underline underline-offset-4" to="/">
                Back to the desk
              </Link>
              <span className="px-2 text-muted-foreground">·</span>
              <Link className="text-sm underline underline-offset-4" to="/english">
                Open English cards
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System & Runtime Versions</CardTitle>
            <CardDescription>Live deployment and container build info</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-xs font-mono">
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Web (Frontend):</span>
              <span className="rounded bg-primary/10 px-2 py-0.5 text-primary font-medium">{__APP_VERSION__}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">API Version Route:</span>
              <a className="underline underline-offset-2 hover:text-foreground" href="/api/version" target="_blank" rel="noreferrer">
                /api/version ↗
              </a>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Postgres Health:</span>
              <a className="underline underline-offset-2 hover:text-foreground" href="/api/healthz" target="_blank" rel="noreferrer">
                /api/healthz ↗
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
