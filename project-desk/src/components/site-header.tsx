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
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/80 px-3 py-2 shadow-[0_18px_50px_-28px_oklch(0.32_0.05_160/0.65)] backdrop-blur-xl sm:px-4">
        <NavLink to="/" className="flex items-center gap-2.5 font-display text-xl leading-none tracking-tight text-foreground sm:text-2xl">
          <span className="grid size-8 place-items-center rounded-full bg-primary text-sm text-primary-foreground shadow-[0_8px_18px_-8px_oklch(0.35_0.08_163/0.9)]" aria-hidden="true">
            {t('brand').slice(0, 1)}
          </span>
          {t('brand')}
        </NavLink>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label={t('nav.primary')} className="flex items-center gap-0.5 rounded-full bg-muted/80 p-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
                    isActive && 'bg-card text-foreground shadow-sm',
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
            className="h-8 rounded-full border border-border bg-card px-3 text-sm shadow-sm"
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
