import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const steps = [
  {
    title: 'React builds static files',
    body: 'Vite compiles this interface into HTML, CSS, and JavaScript in the dist folder. There is no application server behind the page.',
  },
  {
    title: 'nginx serves those files',
    body: 'nginx answers on this host, sends the built assets, and returns index.html for any path it does not recognize. That is why refreshing /about still opens the app.',
  },
  {
    title: 'The desk stays in the browser',
    body: 'Projects are written to localStorage under the key vail.projects.v1. Nothing on the desk is sent to a server.',
  },
]

export function AboutPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">How it runs</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Project Desk is a small React app with nginx in front of it. The board is the product. This page is
          how the two pieces meet.
        </p>
      </div>
      <div className="grid gap-3">
        {steps.map((step, index) => (
          <Card key={step.title}>
            <CardHeader>
              <CardDescription>0{index + 1}</CardDescription>
              <CardTitle>{step.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{step.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
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
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
