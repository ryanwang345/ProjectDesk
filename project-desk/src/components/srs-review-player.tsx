import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, Brain, Check, RotateCcw, Sparkles, X } from 'lucide-react'
import { Pronunciation } from '@/components/pronunciation'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { listDueVocabularyReviews, submitVocabularyReview } from '@/lib/api'
import type { LearningProgress, SrsReviewItem } from '@/lib/reading'
import { cn } from '@/lib/utils'

export function SrsReviewPlayer({
  onExit,
  onProgressUpdate,
}: {
  onExit: () => void
  onProgressUpdate: (progress: LearningProgress) => void
}) {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  const [items, setItems] = useState<SrsReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [typedAnswer, setTypedAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sessionXp, setSessionXp] = useState(0)
  const [recalledCount, setRecalledCount] = useState(0)
  const [finished, setFinished] = useState(false)
  const cardStartRef = useRef<number>(0)

  useEffect(() => {
    let active = true
    cardStartRef.current = performance.now()
    listDueVocabularyReviews(12)
      .then((res) => {
        if (!active) return
        setItems(res)
        setLoading(false)
        cardStartRef.current = performance.now()
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Unable to load due reviews')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const current = items[index]

  function checkChoice(choiceIndex: number) {
    if (!current || revealed) return
    setSelectedChoice(choiceIndex)
    const ok = choiceIndex === current.answerIndex
    setWasCorrect(ok)
    setRevealed(true)
  }

  function checkTyped(e: React.FormEvent) {
    e.preventDefault()
    if (!current || revealed || !typedAnswer.trim()) return
    const ok = typedAnswer.trim().toLowerCase() === current.word.trim().toLowerCase()
    setWasCorrect(ok)
    setRevealed(true)
  }

  async function rateCard(rating: 1 | 2 | 3 | 4) {
    if (!current || submitting) return
    setSubmitting(true)
    setError('')
    const elapsedMs = Math.max(200, Math.round(performance.now() - cardStartRef.current))
    try {
      const res = await submitVocabularyReview({
        cardId: current.cardId,
        rating,
        mode: current.mode,
        elapsedMs,
      })
      onProgressUpdate(res.progress)
      setSessionXp((prev) => prev + res.awardedXp)
      if (rating >= 3) {
        setRecalledCount((prev) => prev + 1)
      }
      if (index + 1 >= items.length) {
        setFinished(true)
      } else {
        setIndex((prev) => prev + 1)
        setSelectedChoice(null)
        setTypedAnswer('')
        setRevealed(false)
        setWasCorrect(null)
        cardStartRef.current = performance.now()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save review rating')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <section className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm" data-testid="srs-review-player">
        <p className="text-sm text-muted-foreground">
          {zh ? '正在按 FSRS 记忆曲线准备待复习词汇…' : 'Preparing your FSRS spaced-recall queue…'}
        </p>
      </section>
    )
  }

  if (items.length === 0 || finished) {
    return (
      <section className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-border bg-card p-8 text-center shadow-sm" data-testid="srs-review-complete">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary">
          <Sparkles className="size-7" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
            {zh ? 'FSRS 间隔复习完成' : 'Spaced Recall Complete'}
          </p>
          <h2 className="font-display text-3xl tracking-tight">
            {items.length === 0
              ? (zh ? '当前没有到期词汇' : 'All due words are up to date')
              : (zh ? `已完成 ${items.length} 个词汇的主动检索` : `Reviewed ${items.length} vocabulary items`)}
          </h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            {items.length === 0
              ? (zh ? '你的记忆曲线处于良好状态。去完成一节新词汇课或阅读练习吧。' : 'Your memory schedule is clear right now. Try a new vocabulary lesson or reading passage.')
              : (zh
                  ? `本次稳定召回 ${recalledCount}/${items.length} 词，获得 +${sessionXp} XP。系统已根据你的召回质量重新计算下次复习间隔。`
                  : `Recalled ${recalledCount}/${items.length} items accurately · +${sessionXp} XP earned. Next intervals have been updated based on your retrieval strength.`)}
          </p>
        </div>
        <div className="flex justify-center gap-3 pt-2">
          <Button onClick={onExit} className="rounded-full px-6" data-testid="srs-finish-btn">
            {zh ? '返回学习主页' : 'Back to learning'}
          </Button>
        </div>
      </section>
    )
  }

  const isProductive = current.mode === 'productive'
  const retrPercent = Math.round(current.retrievability * 100)

  return (
    <section className="mx-auto max-w-2xl space-y-5" data-testid="srs-review-player">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {zh ? '退出复习' : 'Exit review'}
        </button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-medium text-foreground">
            <Brain className="size-3.5 text-primary" aria-hidden="true" />
            {isProductive
              ? (zh ? '主动产出检索 (语境填空)' : 'Productive Recall (Context Cloze)')
              : (zh ? '词义辨识检索' : 'Recognition Recall')}
          </span>
          <span>
            {index + 1} / {items.length}
          </span>
        </div>
      </div>

      <progress
        className="h-1.5 w-full overflow-hidden rounded-full accent-primary"
        value={index + (revealed ? 1 : 0)}
        max={items.length}
        aria-label={zh ? '复习进度' : 'Review progress'}
      />

      {error ? (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <article className="space-y-6 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary">
              {zh ? `记忆留存率 ~${retrPercent}%` : `Est. retention ~${retrPercent}%`}
            </span>
            <span>
              {zh ? `稳定度 S=${current.state.stability.toFixed(1)}天` : `Stability S=${current.state.stability.toFixed(1)}d`}
            </span>
          </div>
          {current.passageTitle ? (
            <span className="inline-flex items-center gap-1 text-xs text-primary">
              <BookOpen className="size-3.5" aria-hidden="true" />
              {zh ? `源自阅读：${current.passageTitle}` : `From reading: ${current.passageTitle}`}
            </span>
          ) : null}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            {zh ? current.promptZh : current.prompt}
          </p>

          {isProductive ? (
            <div className="space-y-3 rounded-2xl border border-border/80 bg-background/60 p-4 sm:p-5">
              <p className="font-display text-lg leading-relaxed sm:text-xl" data-testid="srs-cloze-sentence">
                {revealed ? current.contextSentence : current.blankedSentence}
              </p>
              <p className="text-xs text-muted-foreground">
                {zh ? `目标词义提示：${current.meaning}` : `Meaning cue: ${current.meaning}`}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-3xl tracking-tight sm:text-4xl" data-testid="srs-target-word">
                {current.word}
              </h2>
              <Pronunciation word={current.word} pronunciation={current.pronunciation} />
            </div>
          )}
        </div>

        {isProductive && !revealed ? (
          <form onSubmit={checkTyped} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              placeholder={zh ? '直接拼写该词，或点击下方选项…' : 'Type the exact word, or pick an option below…'}
              className="h-10 min-w-52 flex-1 rounded-xl border border-border bg-background px-3.5 text-sm focus:border-primary focus:outline-none"
              data-testid="srs-type-input"
            />
            <Button type="submit" variant="outline" size="sm" disabled={!typedAnswer.trim()} className="h-10 rounded-xl px-4">
              {zh ? '验证拼写' : 'Check spelling'}
            </Button>
          </form>
        ) : null}

        <div className="grid gap-2.5 sm:grid-cols-2" role="group" aria-label={zh ? '候选答案' : 'Answer choices'}>
          {current.options.map((opt, idx) => {
            const isAnswer = idx === current.answerIndex
            const isPicked = selectedChoice === idx
            return (
              <button
                key={`${opt}-${idx}`}
                type="button"
                disabled={revealed}
                onClick={() => checkChoice(idx)}
                data-testid={`srs-option-${idx}`}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition',
                  !revealed && 'border-border bg-background hover:border-primary/50 hover:bg-primary/5',
                  revealed && isAnswer && 'border-primary bg-primary/12 text-foreground',
                  revealed && isPicked && !isAnswer && 'border-destructive/60 bg-destructive/10 text-destructive',
                  revealed && !isAnswer && !isPicked && 'border-border/50 bg-background/40 text-muted-foreground opacity-70',
                )}
              >
                <span>{opt}</span>
                {revealed && isAnswer ? <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
                {revealed && isPicked && !isAnswer ? <X className="size-4 shrink-0 text-destructive" aria-hidden="true" /> : null}
              </button>
            )
          })}
        </div>

        {revealed ? (
          <div className="space-y-4 border-t border-border pt-5" data-testid="srs-feedback-panel">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-muted/50 p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-semibold uppercase', wasCorrect ? 'text-primary' : 'text-destructive')}>
                    {wasCorrect
                      ? (zh ? '检索成功 · 记忆强化' : 'Recalled accurately')
                      : (zh ? '检索偏差 · 立即重塑记忆' : 'Retrieval lapse — review context')}
                  </span>
                  <span className="font-display text-lg font-semibold text-foreground">{current.word}</span>
                  <Pronunciation word={current.word} pronunciation={current.pronunciation} />
                </div>
                <p className="text-sm text-foreground">{current.meaning}</p>
                <p className="pt-1 text-xs leading-relaxed text-muted-foreground">{current.contextSentence}</p>
              </div>
              <Pronunciation word={current.contextSentence} showText={false} />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {zh
                  ? '根据刚才的回忆流畅度选择下次复习间隔（FSRS 自动排期）：'
                  : 'Rate your recall effort to schedule the next FSRS review interval:'}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    {
                      rating: 1 as const,
                      key: 'again' as const,
                      label: zh ? '忘记 / 重来' : 'Again',
                      recommended: wasCorrect === false,
                    },
                    {
                      rating: 2 as const,
                      key: 'hard' as const,
                      label: zh ? '吃力' : 'Hard',
                      recommended: false,
                    },
                    {
                      rating: 3 as const,
                      key: 'good' as const,
                      label: zh ? '良好' : 'Good',
                      recommended: wasCorrect === true,
                    },
                    {
                      rating: 4 as const,
                      key: 'easy' as const,
                      label: zh ? '轻松秒答' : 'Easy',
                      recommended: false,
                    },
                  ]
                ).map((btn) => (
                  <button
                    key={btn.rating}
                    type="button"
                    disabled={submitting}
                    onClick={() => rateCard(btn.rating)}
                    data-testid={`srs-rate-${btn.key}`}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-2xl border px-3 py-2.5 text-center transition',
                      btn.recommended
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-background text-foreground hover:border-primary/50',
                    )}
                  >
                    <span className="text-xs font-semibold">{btn.label}</span>
                    <span className={cn('mt-0.5 text-[11px]', btn.recommended ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
                      {current.intervals[btn.key]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <span>{zh ? '先主动做出选择，再揭晓语境与答案' : 'Make an active recall attempt before revealing the answer'}</span>
            <button
              type="button"
              onClick={() => {
                setWasCorrect(false)
                setRevealed(true)
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              {zh ? '不记得，直接看解析' : 'Show answer'}
            </button>
          </div>
        )}
      </article>
    </section>
  )
}
