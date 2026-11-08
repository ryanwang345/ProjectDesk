import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

export function NotFoundPage() {
  const { t } = useI18n()
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">{t('missing.title')}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {t('missing.body')}
      </p>
      <Button asChild className="mt-6">
        <Link to="/">{t('missing.back')}</Link>
      </Button>
    </div>
  )
}
