import { NavLink } from 'react-router-dom'
import { LOCALES, useI18n, type MessageKey } from '@/i18n'
import { cn } from '@/lib/utils'

const links: { to: string; label: MessageKey; end: boolean }[] = [
  { to: '/', label: 'nav.desk', end: true },
  { to: '/english', label: 'nav.english', end: false },
  { to: '/about', label: 'nav.about', end: false },
]

export function SiteHeader() {
  const { t, locale, setLocale } = useI18n()
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <NavLink to="/" className="font-display text-xl leading-none tracking-tight text-foreground sm:text-2xl">
          {t('brand')}
        </NavLink>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label={t('nav.primary')} className="flex items-center gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
                    isActive && 'bg-secondary text-foreground',
                  )
                }
              >
                {t(link.label)}
              </NavLink>
            ))}
          </nav>
          <label className="sr-only" htmlFor="locale">{t('lang')}</label>
          <select
            id="locale"
            aria-label={t('lang')}
            value={locale}
            onChange={(event) => setLocale(event.target.value as 'en' | 'zh')}
            className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
          >
            {LOCALES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
      </div>
    </header>
  )
}
