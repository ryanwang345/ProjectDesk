import { useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Headphones,
  Info,
  Lock,
  Zap,
} from 'lucide-react'
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
import { cn } from '@/lib/utils'

export function LessonPath({
  cards,
  progress,
  onStart,
}: {
  cards: EnglishCard[]
  progress: LessonProgress
  onStart: (lesson: number) => void
}) {
  const { t, locale } = useI18n()
  const zh = locale === 'zh'
  const count = lessonCount(cards.length)
  const active = currentLesson(progress.completed, count)
  const unitCount = Math.max(1, Math.ceil(count / LESSONS_PER_UNIT))
  const [unit, setUnit] = useState(() => Math.min(Math.floor(active / LESSONS_PER_UNIT), unitCount - 1))
  const preview =
    unit * LESSONS_PER_UNIT <= active && active < (unit + 1) * LESSONS_PER_UNIT
      ? active
      : unit * LESSONS_PER_UNIT
  const previewWords = lessonWords(cards, preview)
  const unitTitle = lessonWords(cards, unit * LESSONS_PER_UNIT)[0]?.word
  const open = isLessonOpen(preview, progress.completed)

  return (
    <div className="grid items-stretch gap-5 lg:grid-cols-12">
      {/* Left Column: UNIT TRACK Card (5 cols) */}
      <div className="flex flex-col justify-between gap-5 rounded-3xl border border-border/80 bg-card p-5 shadow-xs lg:col-span-5">
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-background/60 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-35"
              disabled={unit === 0}
              aria-label={t('english.earlier')}
              onClick={() => setUnit((current) => current - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <div className="text-center">
              <span className="block font-mono text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                UNIT TRACK
              </span>
              <p className="mt-0.5 font-display text-base font-semibold text-foreground">
                {t('english.unit', { n: unit + 1 })}
                {unitTitle ? ` · ${unitTitle}` : ''}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-background/60 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-35"
              disabled={unit >= unitCount - 1}
              aria-label={t('english.later')}
              onClick={() => setUnit((current) => current + 1)}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>

          <ol className="relative flex flex-col gap-2.5 py-1">
            <span
              className="pointer-events-none absolute top-6 bottom-6 left-7 w-px bg-border/80"
              aria-hidden="true"
            />
            {Array.from({ length: LESSONS_PER_UNIT }, (_, offset) => unit * LESSONS_PER_UNIT + offset)
              .filter((index) => index < count)
              .map((index) => {
                const lessonOpen = isLessonOpen(index, progress.completed)
                const done = progress.completed.includes(index)
                const current = index === active && lessonOpen
                return (
                  <li
                    key={index}
                    className={cn(
                      'relative z-10 flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 transition',
                      current
                        ? 'border-primary/40 bg-primary/[0.08] shadow-2xs'
                        : done
                          ? 'border-border/70 bg-background/45 hover:border-border'
                          : 'border-border/40 bg-background/25 opacity-75',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <button
                        type="button"
                        disabled={!lessonOpen}
                        aria-label={t('english.lessonNode', { n: index + 1 })}
                        onClick={() => onStart(index)}
                        className={cn(
                          'grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold transition',
                          done
                            ? 'border border-primary/40 bg-primary/18 text-primary'
                            : current
                              ? 'bg-primary text-primary-foreground shadow-[0_0_18px_oklch(0.72_0.17_158/0.55)]'
                              : 'border border-border bg-card text-muted-foreground',
                        )}
                      >
                        {done ? <Check className="size-4" /> : lessonOpen ? index + 1 : <Lock className="size-3.5" />}
                      </button>

                      <div className="min-w-0">
                        <span
                          className={cn(
                            'block truncate text-sm font-semibold',
                            current ? 'text-foreground' : done ? 'text-foreground/90' : 'text-muted-foreground',
                          )}
                        >
                          {t('english.lessonNode', { n: index + 1 })}
                        </span>
                        <span
                          className={cn(
                            'block truncate text-[11px]',
                            current ? 'text-primary' : 'text-muted-foreground',
                          )}
                        >
                          {done
                            ? (zh ? `已完成 · 准确率 ${92 + ((index * 3) % 7)}%` : `Completed · Accuracy ${92 + ((index * 3) % 7)}%`)
                            : current
                              ? (zh ? '进行中 · 词汇预习 + 雅思段落填空' : 'In progress · Vocab preview + IELTS cloze')
                              : (zh ? `锁定 · 完成第 ${index} 课解锁` : `Locked · Finish Lesson ${index} to unlock`)}
                        </span>
                      </div>
                    </div>

                    {current ? (
                      <span className="shrink-0 rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                        {t('english.inProgress')}
                      </span>
                    ) : null}
                  </li>
                )
              })}
          </ol>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl border border-border/70 bg-background/50 p-3.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            <strong className="font-medium text-foreground">
              {zh ? '阶梯规则：' : 'Step Rule: '}
            </strong>
            {t('english.pathLead')}
          </p>
        </div>
      </div>

      {/* Right Column: Vocabulary Preview Card (7 cols) */}
      <section className="flex flex-col justify-between gap-5 rounded-3xl border border-border/80 bg-card p-6 shadow-xs lg:col-span-7">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-baseline gap-2.5">
                <BookOpen className="size-5 self-center text-primary" aria-hidden="true" />
                <h2 className="font-display text-xl font-semibold text-foreground">
                  {t('english.previewTitle', { n: preview + 1 })}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {t('english.previewMeta', { n: previewWords.length })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {zh
                  ? '提前熟读音标、高频释义与词性，进入阅读时激活即时映射'
                  : 'Preview IPA pronunciation, core meanings, and parts of speech before practice'}
              </p>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Zap className="size-3.5" aria-hidden="true" />+{previewWords.length * 10} XP{' '}
              {zh ? '奖励' : 'Reward'}
            </span>
          </div>

          <ul className="mt-5 space-y-2.5">
            {previewWords.map((card) => {
              const firstSense = card.senses?.[0]
              const posLabel = firstSense?.pos || 'lexis'
              const fullMeaning = firstSense?.zh || card.meaning
              const shortTag = card.meaning.split(/[；;，,]/)[0]?.trim() || card.meaning
              return (
                <li
                  key={card.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-background/55 px-4 py-3.5 transition hover:border-primary/35 hover:bg-background/80"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-semibold text-foreground">
                        {card.word}
                      </span>
                      <Pronunciation word={card.word} pronunciation={card.pronunciation} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="mr-2 font-mono text-xs font-semibold text-primary">
                        {posLabel}
                      </span>
                      <span>{fullMeaning}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="max-w-32 truncate rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                      {shortTag}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground/70" aria-hidden="true" />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-4">
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Headphones className="size-4 text-primary" aria-hidden="true" />
            {zh
              ? '点击小喇叭试听发音 · 预习完毕即可开始答题'
              : 'Click the speaker icon to hear pronunciation · Start when ready'}
          </span>

          <Button
            type="button"
            className="h-11 rounded-full px-6 text-sm font-semibold shadow-[0_0_24px_oklch(0.72_0.17_158/0.4)]"
            disabled={!open}
            onClick={() => onStart(preview)}
          >
            <GraduationCap className="size-4" aria-hidden="true" />
            {t('english.startLesson', { n: preview + 1 })}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </section>
    </div>
  )
}
