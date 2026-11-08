import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

export function NotFoundPage() {
  const { t } = useI18n()
  return (
    <div className="relative mx-auto max-w-lg py-20 text-center">
      <p className="pointer-events-none absolute inset-x-0 top-6 font-display text-8xl tracking-tight text-primary/15" aria-hidden="true">404</p>
      <p className="relative text-sm text-muted-foreground">404</p>
      <h1 className="relative mt-2 font-display text-4xl tracking-tight">{t('missing.title')}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {t('missing.body')}
      </p>
      <Button asChild className="mt-6">
        <Link to="/">{t('missing.back')}</Link>
      </Button>
    </div>
  )
}
