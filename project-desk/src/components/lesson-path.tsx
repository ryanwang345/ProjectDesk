import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Flame, Lock, Star } from 'lucide-react'
import { Pronunciation } from '@/components/pronunciation'
import { WordSenses } from '@/components/word-senses'
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
  onOpenWords,
}: {
  cards: EnglishCard[]
  progress: LessonProgress
  onStart: (lesson: number) => void
  onOpenWords: () => void
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

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{t('english.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('english.pathLead')}</p>
        </div>
        <Button type="button" variant="outline" onClick={onOpenWords}>{t('english.words')}</Button>
      </div>

      <div className="flex items-center justify-center gap-6 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <Flame className="size-4 text-primary" aria-hidden="true" />
          <span>{t('english.streak', { n: progress.streak })}</span>
        </p>
        <p className="flex items-center gap-1.5 font-medium">
          <Star className="size-4 text-primary" aria-hidden="true" />
          <span>{t('english.xp', { n: progress.xp })}</span>
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" disabled={unit === 0} onClick={() => setUnit((current) => current - 1)}>
          <ChevronLeft data-icon="inline-start" />
          {t('english.earlier')}
        </Button>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t('english.unit', { n: unit + 1 })}
          {unitTitle ? ` · ${unitTitle}` : ''}
        </p>
        <Button type="button" variant="ghost" disabled={unit >= unitCount - 1} onClick={() => setUnit((current) => current + 1)}>
          {t('english.later')}
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>

      <ol className="mx-auto flex w-full max-w-sm flex-col gap-3">
        {Array.from({ length: LESSONS_PER_UNIT }, (_, offset) => unit * LESSONS_PER_UNIT + offset)
          .filter((index) => index < count)
          .map((index) => {
            const open = isLessonOpen(index, progress.completed)
            const done = progress.completed.includes(index)
            const current = index === active && open
            const shift = [0, 72, 0, -72][index % 4]
            return (
              <li key={index} className="flex flex-col items-center" style={{ transform: `translateX(${shift}px)` }}>
                <button
                  type="button"
                  disabled={!open}
                  className={
                    done
                      ? 'grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_14px_28px_-12px_oklch(0.35_0.08_163/0.9)] ring-4 ring-primary/15'
                      : current
                        ? 'grid size-[4.5rem] place-items-center rounded-full border-4 border-primary bg-card text-primary shadow-[0_18px_36px_-14px_oklch(0.35_0.08_163/0.75)] ring-8 ring-primary/10'
                        : 'grid size-16 place-items-center rounded-full border border-border bg-card/80 text-muted-foreground shadow-sm'
                  }
                  aria-label={t('english.lessonNode', { n: index + 1 })}
                  onClick={() => onStart(index)}
                >
                  {done ? <Check className="size-6" /> : open ? <span className="font-display text-xl">{index + 1}</span> : <Lock className="size-4" />}
                </button>
              </li>
            )
          })}
      </ol>

      <div className="mx-auto w-full max-w-sm">
        <p className="text-sm font-medium text-muted-foreground">{t('english.lessonNode', { n: preview + 1 })}</p>
        <ul className="flex flex-col">
        {previewWords.map((card) => (
          <li key={card.id} className="border-b border-border py-2.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="flex items-baseline gap-2">
                <span className="font-display text-xl tracking-tight">{card.word}</span>
                <Pronunciation word={card.word} pronunciation={card.pronunciation} />
              </span>
              <span className="text-sm text-muted-foreground">{card.meaning}</span>
            </div>
            <WordSenses senses={card.senses} compact />
          </li>
        ))}
        </ul>
      </div>
    </div>
  )
}
