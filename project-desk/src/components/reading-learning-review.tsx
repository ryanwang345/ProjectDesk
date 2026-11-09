import { useEffect, useState } from 'react'
import { ArrowRight, Check, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { listReadingMistakes, listReadingVocabulary } from '@/lib/api'
import { QUESTION_TYPE_LABELS, type ReadingAnalytics, type ReadingLearningDashboard, type ReadingMistake, type ReadingQuestionType, type ReadingSavedWord } from '@/lib/reading'
import { cn } from '@/lib/utils'

export function ReadingLearningReview({ data, analytics, module, busy, onReview, onHistory, revision }: {
  data: ReadingLearningDashboard | null
  analytics: ReadingAnalytics | null
  module: 'academic' | 'general'
  busy: boolean
  onReview: (type?: ReadingQuestionType) => void
  onHistory: () => void
  revision: number
}) {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  const [type, setType] = useState('')
  const [resolved, setResolved] = useState(false)
  const [mistakes, setMistakes] = useState<ReadingMistake[]>([])
  const [savedWords, setSavedWords] = useState<ReadingSavedWord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    setLoading(true)
    void Promise.all([listReadingMistakes(module, type, resolved), listReadingVocabulary()]).then(([items, words]) => {
      if (active) { setMistakes(items); setSavedWords(words); setError(false) }
    }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [module, type, resolved, revision])
  const summary = data?.mistakes
  return (
    <section aria-labelledby="reading-review-title" className="space-y-5" data-testid="reading-learning-review">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold tracking-[0.15em] text-primary uppercase">{zh ? '回顾与巩固' : 'Reflect & remember'}</p><h2 id="reading-review-title" className="mt-1 font-display text-2xl">{zh ? '把错题变成下一步' : 'Turn mistakes into your next step'}</h2><p className="mt-2 text-sm text-muted-foreground">{zh ? '先尝试回忆，再查看证据。一次重做，就是一次新的理解。' : 'Try recalling the answer before checking the evidence. A retry is another chance to understand.'}</p></div>
        <Button variant="outline" size="sm" className="rounded-full" disabled={busy || !summary?.open} onClick={() => onReview(type ? type as ReadingQuestionType : undefined)} data-testid="retry-reading-mistakes"><RotateCcw className="size-3.5" />{zh ? '重做错题' : 'Retry mistakes'}{summary ? ` (${summary.open})` : ''}</Button>
      </div>
      {summary && summary.retries > 0 ? <p className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary" data-testid="reading-improvement-feedback"><Check className="mr-2 inline size-4" aria-hidden="true" />{zh ? `已重做 ${summary.retries} 道错题，其中 ${summary.correctRetries} 次答对；${summary.resolved} 道错题已正确重做。` : `${summary.correctRetries} correct across ${summary.retries} retries. ${summary.resolved} mistakes successfully revisited.`}</p> : null}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="inline-flex gap-1 rounded-full bg-muted p-1" role="group" aria-label={zh ? '错题状态' : 'Mistake status'}>
            <Button size="sm" variant={resolved ? 'ghost' : 'default'} className="rounded-full text-xs" aria-pressed={!resolved} onClick={() => setResolved(false)}>{zh ? '待复习' : 'To review'} ({summary?.open ?? '—'})</Button>
            <Button size="sm" variant={resolved ? 'default' : 'ghost'} className="rounded-full text-xs" aria-pressed={resolved} onClick={() => setResolved(true)}>{zh ? '已正确重做' : 'Revisited'} ({summary?.resolved ?? '—'})</Button>
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">{zh ? '按题型筛选' : 'Question type'}
            <select value={type} onChange={(event) => setType(event.target.value)} className="max-w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground" data-testid="mistake-type-filter">
              <option value="">{zh ? '全部题型' : 'All question types'}</option>
              {(summary?.byType ?? []).map((item) => <option key={item.type} value={item.type}>{QUESTION_TYPE_LABELS[item.type][zh ? 'zh' : 'en']} ({resolved ? item.resolved : item.open})</option>)}
            </select>
          </label>
        </div>
        {error ? <p role="alert" className="mt-4 text-sm text-destructive">{zh ? '无法加载错题和词汇，请稍后重试。' : 'Could not load review and vocabulary. Please try again.'}</p> : loading ? <p className="mt-4 text-sm text-muted-foreground">{zh ? '正在加载已保存的作答…' : 'Loading saved answers…'}</p> : mistakes.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{resolved ? (zh ? '重做错题并答对后，进步记录会出现在这里。' : 'Correct retries will appear here as your review grows.') : (zh ? '该分组暂无待复习错题。完成阅读后，需巩固的题目会保存在这里。' : 'No open mistakes in this group. After a reading session, questions to revisit will be saved here.')}</p> : <div className="mt-4 divide-y divide-border">
          {mistakes.map((item) => <article key={item.id} className="py-4 first:pt-0" data-testid={`reading-mistake-${item.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-medium text-primary">{QUESTION_TYPE_LABELS[item.question.type][zh ? 'zh' : 'en']}</p>
              {item.diagnosis ? (
                <span className="rounded-full border border-primary/25 bg-primary/8 px-2.5 py-0.5 text-[11px] font-medium text-primary" data-testid="mistake-diagnosis-badge">
                  {zh ? item.diagnosis.labelZh : item.diagnosis.label}
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-sm font-medium leading-relaxed">{item.question.prompt}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{item.passage.title} · {item.retryCount} {zh ? '次重做' : 'retries'} · {item.correctRetries} {zh ? '次答对' : 'correct'}</p>
            {item.diagnosis ? (
              <div className="mt-2.5 rounded-2xl border border-border/80 bg-background/60 p-3 text-xs leading-relaxed">
                <p className="font-medium text-foreground">
                  {zh ? '苏格拉底定位提示（看答案前先自检）：' : 'Socratic Self-Check (Before revealing answer): '}
                  <span className="font-normal text-muted-foreground">{zh ? item.diagnosis.socraticHintZh : item.diagnosis.socraticHint}</span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {zh ? `常见错因：${item.diagnosis.whyItHappensZh}` : `Why this trap happens: ${item.diagnosis.whyItHappens}`}
                </p>
              </div>
            ) : null}
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-primary focus-visible:rounded focus-visible:outline-2">{zh ? '查看原作答与证据' : 'See your answer and the evidence'}</summary>
              <div className="mt-3 space-y-2 rounded-2xl bg-muted/40 p-4">
                <p className="text-xs"><span className="text-muted-foreground">{zh ? '你的作答：' : 'Your answer: '}</span>{item.userAnswer || (zh ? '未作答' : 'No answer')}</p>
                <p className="text-xs"><span className="text-muted-foreground">{zh ? '正确答案：' : 'Correct answer: '}</span><strong>{item.question.correctAnswer}</strong></p>
                <p className="text-xs leading-relaxed">{zh && item.question.explanationZh ? item.question.explanationZh : item.question.explanation}</p>
                {item.question.evidenceQuote ? <blockquote className="border-l-2 border-primary pl-3 text-xs leading-relaxed text-muted-foreground">“{item.question.evidenceQuote}”<p className="mt-1 not-italic">{zh ? '段落' : 'Paragraph'} {item.question.evidenceParagraph}</p></blockquote> : null}
                <details className="text-xs"><summary className="cursor-pointer text-primary">{zh ? '阅读原文段落' : 'Read the source paragraph'}</summary><p className="mt-2 leading-relaxed">{item.passage.paragraphs.find((paragraph) => paragraph.label === item.question.evidenceParagraph)?.text}</p></details>
              </div>
            </details>
          </article>)}
          {mistakes.length === 50 ? <p className="pt-3 text-xs text-muted-foreground">{zh ? '显示最近 50 道题。按题型缩小范围。' : 'Showing the latest 50. Filter by question type to narrow your review.'}</p> : null}
        </div>}
      </div>

      <details className="rounded-3xl border border-border bg-card p-5 sm:p-6" data-testid="reading-performance-details">
        <summary className="cursor-pointer font-display text-lg">{zh ? '查看阅读表现与历史记录' : 'Explore your reading performance'}</summary>
        <p className="mt-3 text-xs text-muted-foreground">{zh ? '最近 30 次常规练习和模考。每日挑战与错题重做不用于预估 Band。' : 'Your most recent 30 standard sessions. Daily challenges and retries do not affect estimated bands.'}</p>
        {!analytics || analytics.totalSessions === 0 ? <p className="mt-3 text-sm text-muted-foreground">{zh ? '完成一次常规练习后，真实数据会显示在这里。' : 'Finish a standard practice session to begin building your performance history.'}</p> : <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat label={zh ? '平均正确率' : 'Average accuracy'} value={`${analytics.averageAccuracy}%`} />
            <Stat label={zh ? '已完成常规练习' : 'Standard sessions'} value={String(analytics.totalSessions)} />
            <Stat label={zh ? '非官方平均预估 Band' : 'Average estimated band · unofficial'} value={analytics.averageBand.toFixed(1)} />
          </div>
          <div className="mt-5 space-y-4">{analytics.byType.map((item) => <div key={item.type}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{QUESTION_TYPE_LABELS[item.type][zh ? 'zh' : 'en']}</span><span className="text-muted-foreground">{item.correct}/{item.total} · {item.percent}%</span></div>
            <progress className="mt-1 h-1.5 w-full accent-primary" value={item.correct} max={Math.max(1, item.total)} aria-label={`${QUESTION_TYPE_LABELS[item.type].en}: ${item.correct} of ${item.total}`} />
          </div>)}</div>
        </>}
        <Button variant="outline" className="mt-4 rounded-full" size="sm" onClick={onHistory}>{zh ? '打开练习历史' : 'Open session history'}<ArrowRight className="size-3.5" /></Button>
      </details>

      <details className="rounded-3xl border border-border bg-card p-5 sm:p-6" data-testid="reading-saved-vocabulary">
        <summary className="cursor-pointer font-display text-lg">{zh ? '最近从阅读保存的词汇' : 'Recently saved reading vocabulary'} ({savedWords.length})</summary>
        <p className="mt-3 text-sm text-muted-foreground">{zh ? '保留原文语境，并加入词汇页的复习列表。' : 'Keep the passage context and revisit these words in your vocabulary review.'}</p>
        {savedWords.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">{zh ? '练习时选择一个词，或使用词汇助手手动输入，然后保存。模考期间在交卷后使用。' : 'Select a passage word during practice, or type it in the vocabulary assistant, then save it. In exams, vocabulary is available after submission.'}</p> : <ul className="mt-4 divide-y divide-border">{savedWords.map((word) => <li key={word.id} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{word.word}<span className="ml-2 font-normal text-muted-foreground">{word.meaning}</span></p><Link className="text-xs font-medium text-primary underline underline-offset-2" to={`/english?tab=words&word=${encodeURIComponent(word.cardId)}`}>{zh ? '在词汇页复习' : 'Review in vocabulary'}</Link></div>
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{word.context}</p><p className="mt-1 text-[10px] text-muted-foreground">{word.passageTitle}</p>
        </li>)}</ul>}
      </details>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className={cn('rounded-2xl bg-muted/40 p-4')}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl text-primary">{value}</p></div>
}
