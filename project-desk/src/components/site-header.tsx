import {
  BookOpen,
  Compass,
  Dumbbell,
  Flame,
  GraduationCap,
  Headphones,
  LayoutGrid,
  Layers,
  SlidersHorizontal,
  Tag,
  UserRound,
} from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useLearningProgress } from '@/hooks/use-learning-progress'
import { useI18n, type MessageKey } from '@/i18n'
import { loadProgress } from '@/lib/lesson'
import { cn } from '@/lib/utils'

type NavItem = {
  id: string
  to: string
  label: MessageKey
  icon: typeof BookOpen
  match: (pathname: string, tab: string | null) => boolean
}

const learningLinks: NavItem[] = [
  {
    id: 'learn',
    to: '/english',
    label: 'english.tabLearn',
    icon: GraduationCap,
    match: (pathname, tab) => pathname === '/english' && (!tab || tab === 'learn'),
  },
  {
    id: 'words',
    to: '/english?tab=words',
    label: 'english.tabWords',
    icon: Tag,
    match: (pathname, tab) => pathname === '/english' && tab === 'words',
  },
  {
    id: 'reading',
    to: '/reading',
    label: 'nav.reading',
    icon: BookOpen,
    match: (pathname, tab) => pathname === '/reading' || (pathname === '/english' && tab === 'reading'),
  },
  {
    id: 'listening',
    to: '/listening',
    label: 'nav.listening',
    icon: Headphones,
    match: (pathname) => pathname === '/listening',
  },
  {
    id: 'practice',
    to: '/english?tab=practice',
    label: 'english.tabPractice',
    icon: Dumbbell,
    match: (pathname, tab) => pathname === '/english' && tab === 'practice',
  },
  {
    id: 'me',
    to: '/english?tab=me',
    label: 'english.tabMe',
    icon: UserRound,
    match: (pathname, tab) => pathname === '/english' && tab === 'me',
  },
]

const workspaceLinks: NavItem[] = [
  {
    id: 'desk',
    to: '/',
    label: 'nav.desk',
    icon: LayoutGrid,
    match: (pathname) => pathname === '/',
  },
  {
    id: 'about',
    to: '/about',
    label: 'nav.about',
    icon: Compass,
    match: (pathname) => pathname === '/about',
  },
]

export function SiteHeader() {
  const { t, locale } = useI18n()
  const zh = locale === 'zh'
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const currentTab = searchParams.get('tab')
  const learning = useLearningProgress()
  const fallback = loadProgress()
  const progress = learning.progress ?? fallback

  const allItems = [...learningLinks, ...workspaceLinks]
  const completedLessons = progress.completed.length
  const srsLoadPercent = Math.min(100, Math.max(24, completedLessons > 0 ? Math.min(96, 50 + completedLessons * 8) : 68))
  const trackedWords = Math.max(5, completedLessons * 5)
  const masterLevel = Math.max(1, Math.floor(progress.xp / 100) + 1)

  return (
    <aside
      data-testid="left-sidebar-nav"
      className="z-40 flex shrink-0 flex-col border-b border-border/80 bg-card/90 px-3 py-2.5 backdrop-blur-xl lg:sticky lg:top-0 lg:h-svh lg:w-60 lg:justify-between lg:border-r lg:border-b-0 lg:px-3.5 lg:py-5"
    >
      <div className="flex flex-col gap-6">
        {/* Top Brand Header */}
        <div className="flex items-center justify-between gap-2 px-1">
          <Link
            to="/english"
            className="flex items-center gap-3 text-left text-foreground transition-opacity hover:opacity-90"
          >
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_oklch(0.72_0.17_158/0.45)]"
              aria-hidden="true"
            >
              <BookOpen className="size-4" />
            </span>
            <span>
              <span className="block font-display text-lg leading-none font-semibold tracking-tight">
                {t('brand')}
              </span>
              <span className="mt-1 block text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">
                SRS WORKBENCH
              </span>
            </span>
          </Link>

          {/* Compact stats on mobile */}
          <div className="flex items-center gap-1.5 text-xs lg:hidden">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-0.5">
              <Flame className="size-3.5 text-primary" aria-hidden="true" />
              {progress.streak}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-0.5">
              {progress.xp} XP
            </span>
          </div>
        </div>

        {/* Primary Navigation: vertical rail on desktop, fixed bottom bar on mobile */}
        <nav
          aria-label={t('nav.primary')}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 py-1.5 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:static lg:inset-auto lg:border-t-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
        >
          <div className="grid grid-cols-4 gap-0.5 sm:grid-cols-8 lg:flex lg:flex-col lg:gap-1">
            {allItems.map((item, idx) => {
              const active = item.match(location.pathname, currentTab)
              const Icon = item.icon
              const isWorkspaceStart = idx === learningLinks.length
              return (
                <div key={item.id} className={cn(isWorkspaceStart && 'lg:mt-2 lg:border-t lg:border-border/60 lg:pt-2')}>
                  <NavLink
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-medium transition-all lg:flex-row lg:justify-start lg:gap-3 lg:px-3.5 lg:py-2.5 lg:text-sm',
                      active
                        ? 'border border-primary/25 bg-primary/14 text-foreground shadow-2xs'
                        : 'border border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    <Icon
                      className={cn('size-4 shrink-0 lg:size-4', active ? 'text-primary' : 'text-muted-foreground')}
                      aria-hidden="true"
                    />
                    <span className="max-w-full truncate">{t(item.label)}</span>
                  </NavLink>
                </div>
              )
            })}
          </div>
        </nav>
      </div>

      {/* Bottom SRS Daily Load Card & Explorer Profile (Desktop) */}
      <div className="hidden flex-col gap-3 lg:flex">
        <div className="rounded-2xl border border-border/80 bg-background/60 p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">
              {zh ? 'SRS 每日负荷' : 'SRS Daily Load'}
            </span>
            <span className="font-mono font-semibold text-foreground">{srsLoadPercent}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${srsLoadPercent}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Flame className="size-3.5 text-primary" aria-hidden="true" />
              {progress.streak} {zh ? '天连续' : 'd streak'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Layers className="size-3.5 text-primary" aria-hidden="true" />
              {trackedWords} {zh ? '词追踪' : 'tracked'}
            </span>
          </div>
        </div>

        <Link
          to="/english?tab=me"
          className="flex items-center justify-between gap-2.5 rounded-2xl border border-border/70 bg-background/40 px-3 py-2.5 transition hover:border-primary/30 hover:bg-background/70"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
              <UserRound className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">Explorer</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                SRS Master Lvl {masterLevel}
              </span>
            </div>
          </div>
          <SlidersHorizontal className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      </div>
    </aside>
  )
}
