import { BookOpen, Dumbbell, FileText, Flame, Library, Star, UserRound } from 'lucide-react'
import { ThemePicker } from '@/components/theme-picker'
import { SpeechSettings } from '@/components/speech-settings'
import { useI18n } from '@/i18n'
import type { MessageKey } from '@/i18n'

export function EnglishTop({
  streak,
  xp,
  onWords,
}: {
  streak: number
  xp: number
  onWords?: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 bg-background/90 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
      <button type="button" className="flex items-center gap-2 text-left" onClick={onWords}>
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground" aria-hidden="true">
          <BookOpen className="size-4" />
        </span>
        <span>
          <span className="block text-sm font-medium leading-none">{t('brand')}</span>
          <span className="mt-1 block text-[10px] tracking-[0.16em] text-primary uppercase">{t('english.learnMark')}</span>
        </span>
      </button>
      <div className="flex items-center gap-2 text-xs">
        <SpeechSettings />
        <ThemePicker />
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1">
          <Flame className="size-3.5 text-primary" aria-hidden="true" />
          {streak}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1">
          <Star className="size-3.5 text-primary" aria-hidden="true" />
          {xp} XP
        </span>
      </div>
    </div>
  )
}

const tabs = [
  { id: 'learn', icon: BookOpen, label: 'english.tabLearn' },
  { id: 'words', icon: Library, label: 'english.tabWords' },
  { id: 'reading', icon: FileText, label: 'english.tabReading' },
  { id: 'practice', icon: Dumbbell, label: 'english.tabPractice' },
  { id: 'me', icon: UserRound, label: 'english.tabMe' },
] as const satisfies ReadonlyArray<{ id: string; icon: typeof BookOpen; label: MessageKey }>

export function EnglishTabs({
  tab,
  onChange,
  variant,
}: {
  tab: 'learn' | 'words' | 'reading' | 'me'
  onChange: (tab: 'learn' | 'words' | 'reading' | 'me' | 'practice') => void
  variant: 'bar' | 'rail'
}) {
  const { t } = useI18n()
  const buttons = tabs.map((item) => {
    const active = item.id !== 'practice' && tab === item.id
    const Icon = item.icon
    return (
      <button
        key={item.id}
        type="button"
        className={
          variant === 'rail'
            ? `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'}`
            : `flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] ${active ? 'text-primary' : 'text-muted-foreground'}`
        }
        aria-current={active ? 'page' : undefined}
        onClick={() => onChange(item.id)}
      >
        <Icon className="size-5" aria-hidden="true" />
        {t(item.label)}
      </button>
    )
  })

  if (variant === 'rail') {
    return (
      <nav className="hidden h-full w-56 shrink-0 flex-col gap-1 border-r border-border bg-background/80 px-3 py-4 lg:flex" aria-label={t('nav.primary')}>
        {buttons}
      </nav>
    )
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label={t('nav.primary')}>
      <div className="grid w-full grid-cols-5 px-2 py-2">
        {buttons}
      </div>
    </nav>
  )
}
