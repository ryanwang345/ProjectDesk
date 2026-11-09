import { useState } from 'react'
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { explainReadingQuestion } from '@/lib/api'
import {
  QUESTION_TYPE_LABELS,
  formatDurationClock,
  type ReadingAIExplanation,
  type ReadingQuestionResult,
  type ReadingSession,
  type ReadingTest,
} from '@/lib/reading'

export function ReadingResultsView({
  test,
  session,
  onBackToDashboard,
  onOpenSplitReview,
  onRetake,
}: {
  test: ReadingTest
  session: ReadingSession
  onBackToDashboard: () => void
  onOpenSplitReview: () => void
  onRetake: () => void
}) {
  const { locale } = useI18n()
  const isZh = locale === 'zh'
  const results = session.results
  const [filter, setFilter] = useState<'all' | 'wrong' | 'correct'>('all')
  const [aiExplanations, setAiExplanations] = useState<Record<string, ReadingAIExplanation>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (!results) return null

  const filteredQuestions = results.questions.filter((item) => {
    if (filter === 'wrong') return !item.correct
    if (filter === 'correct') return item.correct
    return true
  })

  async function handleAskAI(item: ReadingQuestionResult) {
    setLoadingId(item.questionId)
    try {
      const exp = await explainReadingQuestion({
        sessionId: session.id,
        testId: test.id,
        questionId: item.questionId,
        userAnswer: item.userAnswer,
      })
      setAiExplanations((prev) => ({ ...prev, [item.questionId]: exp }))
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="reading-results-view">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBackToDashboard}>
          <ChevronLeft className="size-4" />
          {isZh ? '返回阅读主页' : 'Back to Reading Dashboard'}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onOpenSplitReview}>
            <BookOpen className="mr-1.5 size-4 text-primary" />
            {isZh ? '在分屏试卷中对照原文' : 'Review in Split-Screen Exam'}
          </Button>
          <Button type="button" size="sm" className="rounded-full" onClick={onRetake}>
            {isZh ? '重新练习本套题' : 'Practice Again'}
          </Button>
        </div>
      </div>

      {/* Hero Band & Score Banner */}
      <section className="rounded-3xl border border-primary/30 bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary uppercase">
                {test.module === 'general'
                  ? isZh
                    ? 'IELTS 培训类阅读'
                    : 'IELTS General Training'
                  : isZh
                    ? 'IELTS 学术类阅读'
                    : 'IELTS Academic'}
              </span>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
                {isZh ? '非官方预估分 (Unofficial Band Estimate)' : 'Unofficial Band Estimate'}
              </span>
            </div>
            <h1 className="mt-3 font-display text-3xl tracking-tight">{test.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isZh
                ? '根据 Academic / General Training 常用分数区间预估。实际考试分数线可能因试卷而异；短篇练习按 40 题比例折算，仅供参考。'
                : 'Estimated from typical Academic / General Training score ranges. Actual boundaries vary by paper. Shorter drills are scaled to 40 questions for practice reference.'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
            <div className="flex items-center justify-between text-xs text-primary">
              <span>{isZh ? '预估雅思阅读总分' : 'Estimated IELTS Band'}</span>
              <Award className="size-4" />
            </div>
            <p className="mt-2 font-display text-4xl font-semibold text-primary" data-testid="reading-band-score">
              {results.band.toFixed(1)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isZh ? `折合 40 题得分：${results.scaledOutOf40} / 40` : `Scaled score: ${results.scaledOutOf40} / 40`}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{isZh ? '原始答对题数' : 'Raw Score'}</span>
              <CheckCircle2 className="size-4 text-emerald-400" />
            </div>
            <p className="mt-2 font-display text-4xl font-semibold" data-testid="reading-raw-score">
              {results.score} <span className="text-xl text-muted-foreground">/ {results.total}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isZh
                ? `答对 ${results.score} 题 · 答错/未答 ${results.total - results.score} 题`
                : `${results.score} correct · ${results.total - results.score} incorrect/blank`}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{isZh ? '总体正确率' : 'Accuracy'}</span>
              <Target className="size-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-4xl font-semibold">{results.accuracy.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {session.mode === 'exam' ? (isZh ? '全真计时模考' : 'Exam Simulation') : isZh ? '自主练习模式' : 'Practice Mode'}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{isZh ? '用时统计' : 'Time Spent'}</span>
              <Clock className="size-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-4xl font-semibold tabular-nums">
              {formatDurationClock(results.timeSpent)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isZh
                ? `平均每题 ${Math.max(1, Math.round(results.timeSpent / Math.max(1, results.total)))} 秒`
                : `Avg ${Math.max(1, Math.round(results.timeSpent / Math.max(1, results.total)))}s per question`}
            </p>
          </div>
        </div>
      </section>

      {/* Accuracy by Question Type */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="text-lg font-medium">{isZh ? '各题型正确率分析' : 'Accuracy by Question Type'}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.byType.map((bt) => (
            <div key={bt.type} className="rounded-2xl border border-border bg-background/50 p-3.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">{QUESTION_TYPE_LABELS[bt.type]?.[isZh ? 'zh' : 'en'] ?? bt.type}</span>
                <span className="font-semibold text-primary tabular-nums">
                  {bt.correct}/{bt.total} ({bt.percent}%)
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${bt.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Detailed Question-by-Question Explanations */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">{isZh ? '逐题详解与原文证据定位' : 'Detailed Answer Explanations & Passage Evidence'}</h2>
          <div className="flex items-center gap-1 rounded-full bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-full px-3 py-1 ${filter === 'all' ? 'bg-card font-medium text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              {isZh ? `全部 (${results.questions.length})` : `All (${results.questions.length})`}
            </button>
            <button
              type="button"
              onClick={() => setFilter('wrong')}
              className={`rounded-full px-3 py-1 ${filter === 'wrong' ? 'bg-card font-medium text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              {isZh
                ? `错题/未答 (${results.questions.filter((q) => !q.correct).length})`
                : `Incorrect (${results.questions.filter((q) => !q.correct).length})`}
            </button>
            <button
              type="button"
              onClick={() => setFilter('correct')}
              className={`rounded-full px-3 py-1 ${filter === 'correct' ? 'bg-card font-medium text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              {isZh
                ? `正确 (${results.questions.filter((q) => q.correct).length})`
                : `Correct (${results.questions.filter((q) => q.correct).length})`}
            </button>
          </div>
        </div>

        <ol className="mt-4 flex flex-col gap-3">
          {filteredQuestions.map((item) => {
            const qMeta = test.questions?.find((q) => q.id === item.questionId)
            const aiExp = aiExplanations[item.questionId]
            return (
              <li
                key={item.questionId}
                className={`rounded-2xl border p-4 text-sm ${
                  item.correct ? 'border-border bg-background/40' : 'border-destructive/40 bg-destructive/5'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        item.correct ? 'bg-emerald-500 text-white' : 'bg-destructive text-white'
                      }`}
                    >
                      {item.number}
                    </span>
                    <div>
                      <span className="text-[11px] font-medium text-primary uppercase">
                        {QUESTION_TYPE_LABELS[item.type]?.[isZh ? 'zh' : 'en'] ?? item.type}
                      </span>
                      <p className="mt-0.5 font-medium">{qMeta?.prompt}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full text-xs"
                    disabled={loadingId === item.questionId}
                    onClick={() => void handleAskAI(item)}
                  >
                    <Sparkles className="mr-1 size-3.5 text-primary" />
                    {loadingId === item.questionId
                      ? isZh
                        ? 'AI 诊断中…'
                        : 'Analyzing…'
                      : isZh
                        ? 'AI 错因与同义替换精讲'
                        : 'AI Tutor Explanation'}
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4 pl-8 text-xs">
                  <span className="inline-flex items-center gap-1">
                    {item.correct ? (
                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                    ) : (
                      <XCircle className="size-3.5 text-rose-400" />
                    )}
                    <span className="text-muted-foreground">{isZh ? '你的作答：' : 'Your answer:'}</span>
                    <strong className={item.correct ? 'text-emerald-300' : 'text-rose-300'}>
                      {item.userAnswer || (isZh ? '（未作答）' : '(Blank)')}
                    </strong>
                  </span>
                  <span>
                    <span className="text-muted-foreground">{isZh ? '标准答案：' : 'Correct answer:'}</span>{' '}
                    <strong className="text-primary">{item.correctAnswer}</strong>
                  </span>
                  {item.evidenceParagraph ? (
                    <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-primary">
                      {isZh ? `原文依据：${item.evidenceParagraph} 段` : `Evidence: Paragraph ${item.evidenceParagraph}`}
                    </span>
                  ) : null}
                </div>

                <div className="mt-2.5 pl-8 text-xs leading-relaxed">
                  {item.explanation ? <p className="text-foreground">{item.explanation}</p> : null}
                  {item.explanationZh ? <p className="mt-1 text-muted-foreground">{item.explanationZh}</p> : null}
                  {item.evidenceQuote ? (
                    <blockquote className="mt-2 border-l-2 border-primary pl-2.5 italic text-muted-foreground">
                      “{item.evidenceQuote}”
                    </blockquote>
                  ) : null}

                  {aiExp ? (
                    <div className="mt-3 rounded-xl border border-primary/30 bg-card p-3">
                      <p className="text-[11px] font-semibold text-primary uppercase">
                        {isZh ? 'AI 考官诊断' : 'AI Examiner Breakdown'}
                      </p>
                      <p className="mt-1">
                        <strong>{isZh ? '正确依据：' : 'Why Correct: '}</strong>
                        {aiExp.whyCorrect}
                      </p>
                      <p className="mt-1">
                        <strong>{isZh ? '作答点评：' : 'Your Answer Analysis: '}</strong>
                        {aiExp.whyWrong}
                      </p>
                      {aiExp.chineseSummary ? <p className="mt-1 text-primary">{aiExp.chineseSummary}</p> : null}
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
