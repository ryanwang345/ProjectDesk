import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { Pronunciation } from '@/components/pronunciation'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import type { EnglishCard } from '@/lib/english'
import {
  LESSONS_PER_UNIT,
  currentLesson,
  isLessonOpen,
  lessonCount,
  lessonWords,
  type LessonProgress,
} from '@/lib/lesson'

export function LessonPath({
  cards,
  progress,
  onStart,
}: {
  cards: EnglishCard[]
  progress: LessonProgress
  onStart: (lesson: number) => void
}) {
  const { t } = useI18n()
  const count = lessonCount(cards.length)
  const active = currentLesson(progress.completed, count)
  const unitCount = Math.max(1, Math.ceil(count / LESSONS_PER_UNIT))
  const [unit, setUnit] = useState(() => Math.min(Math.floor(active / LESSONS_PER_UNIT), unitCount - 1))
  const preview = unit * LESSONS_PER_UNIT <= active && active < (unit + 1) * LESSONS_PER_UNIT
    ? active
    : unit * LESSONS_PER_UNIT
  const previewWords = lessonWords(cards, preview)
  const unitTitle = lessonWords(cards, unit * LESSONS_PER_UNIT)[0]?.word
  const open = isLessonOpen(preview, progress.completed)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {t('english.immersive')}
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">{t('english.title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('english.pathLead')}</p>
      </div>
      <div className="flex gap-2">
        <p className="rounded-full border border-border bg-card px-3 py-1.5 text-sm">{t('english.streak', { n: progress.streak })}</p>
        <p className="rounded-full border border-border bg-card px-3 py-1.5 text-sm">{t('english.xp', { n: progress.xp })}</p>
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-2 py-2">
        <button type="button" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground disabled:opacity-40" disabled={unit === 0} onClick={() => setUnit((current) => current - 1)}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t('english.earlier')}
        </button>
        <p className="text-center text-xs font-medium tracking-wide uppercase">
          {t('english.unit', { n: unit + 1 })}
          {unitTitle ? <span className="mt-0.5 block text-sm tracking-normal normal-case">{unitTitle}</span> : null}
        </p>
        <button type="button" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground disabled:opacity-40" disabled={unit >= unitCount - 1} onClick={() => setUnit((current) => current + 1)}>
          {t('english.later')}
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <ol className="relative mx-auto flex w-full max-w-xs flex-col items-center gap-7 py-2">
        <span className="absolute top-8 bottom-8 left-1/2 w-px -translate-x-1/2 bg-primary/25" aria-hidden="true" />
        {Array.from({ length: LESSONS_PER_UNIT }, (_, offset) => unit * LESSONS_PER_UNIT + offset)
          .filter((index) => index < count)
          .map((index) => {
            const lessonOpen = isLessonOpen(index, progress.completed)
            const done = progress.completed.includes(index)
            const current = index === active && lessonOpen
            return (
              <li key={index} className="relative z-10 flex items-center gap-3">
                <button
                  type="button"
                  disabled={!lessonOpen}
                  className={
                    done
                      ? 'grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_24px_oklch(0.8_0.17_158/0.55)]'
                      : current
                        ? 'grid size-16 place-items-center rounded-full border-4 border-primary bg-background text-xl font-semibold text-primary shadow-[0_0_28px_oklch(0.8_0.17_158/0.45)]'
                        : 'grid size-14 place-items-center rounded-full border border-border bg-card text-muted-foreground'
                  }
                  aria-label={t('english.lessonNode', { n: index + 1 })}
                  onClick={() => onStart(index)}
                >
                  {done ? <Check className="size-6" /> : lessonOpen ? index + 1 : <Lock className="size-4" />}
                </button>
                <span className={`absolute left-[4.5rem] w-24 text-xs ${current ? 'text-primary' : 'text-muted-foreground'}`}>
                  <span className="block font-medium">{t('english.lessonNode', { n: index + 1 })}</span>
                  {current ? <span>{t('english.inProgress')}</span> : null}
                </span>
              </li>
            )
          })}
      </ol>
      <section className="rounded-3xl border border-primary/25 bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{preview + 1}</span>
            <div>
              <h2 className="text-base font-medium">{t('english.previewTitle', { n: preview + 1 })}</h2>
              <p className="text-xs text-muted-foreground">{t('english.previewMeta', { n: previewWords.length })}</p>
            </div>
          </div>
          <p className="text-xs font-medium text-primary">+{previewWords.length * 10} XP</p>
        </div>
        <ul className="mt-3 divide-y divide-border">
          {previewWords.map((card) => (
            <li key={card.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="text-lg font-medium">{card.word}</span>
                  <Pronunciation word={card.word} pronunciation={card.pronunciation} />
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {card.senses?.[0] ? `${card.senses[0].pos} ${card.senses[0].zh}` : card.meaning}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{card.meaning}</span>
            </li>
          ))}
        </ul>
      </section>
      <Button type="button" className="h-12 w-full rounded-full text-base" disabled={!open} onClick={() => onStart(preview)}>
        {t('english.startLesson', { n: preview + 1 })}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t('footer')}</p>
    </div>
  )
}
