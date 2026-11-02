import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">This path is not on the desk</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        nginx handed the request to the app, and the app does not have a page here.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Back to the desk</Link>
      </Button>
    </div>
  )
}
