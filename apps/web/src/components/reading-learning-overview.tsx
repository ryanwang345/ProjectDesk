import { ArrowRight, BookOpen, Check, Clock, Flame, Play, RotateCcw, Sparkles, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { QUESTION_TYPE_LABELS, type LearningProgress, type ReadingLearningDashboard } from '@/lib/reading'
import { cn } from '@/lib/utils'

export function ReadingLearningOverview({ data, progress, module, onModuleChange, onDaily, onResume, onPractice, busy }: {
  data: ReadingLearningDashboard | null
  progress: LearningProgress | null
  module: 'academic' | 'general'
  onModuleChange: (module: 'academic' | 'general') => void
  onDaily: () => void
  onResume: (id: string) => void
  onPractice: (id: string) => void
  busy: boolean
}) {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  const daily = data?.daily.session
  const dailyDone = daily?.status === 'submitted'
  const answered = Object.values(daily?.answers ?? {}).filter((answer) => answer.trim()).length
  const unfinished = (data?.activeSessions ?? []).filter((session) => session.id !== daily?.id)
  const weeklyDays = progress?.weekly.filter((day) => day.reading + day.vocabulary > 0).length ?? 0
  const milestones = [
    { label: zh ? '首次完成阅读' : 'First reading finished', done: (data?.readingCompletions ?? 0) >= 1 },
    { label: zh ? '本周学习三天' : 'Three active days this week', done: weeklyDays >= 3 },
    { label: zh ? '重做五道错题' : 'Five mistakes revisited', done: (data?.mistakes.retries ?? 0) >= 5 },
  ]
  return (
    <>
      <section aria-labelledby="reading-welcome" className="space-y-5" data-testid="reading-welcome">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">IELTS Reading</p>
            <h1 id="reading-welcome" className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">{zh ? '每天读一点，稳步向前。' : 'Your reading, one day at a time.'}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{(data?.readingCompletions ?? 0) > 0
              ? (zh ? `欢迎回来。你已完成 ${data?.readingCompletions} 次阅读练习，继续从上次的积累出发。` : `Welcome back. You have finished ${data?.readingCompletions} reading sessions. Build on what you have learned.`)
              : (zh ? '从五道题开始，找到适合自己的节奏。完成练习后，我们会为你推荐下一步。' : 'Start with five questions and find your rhythm. Your practice will shape what comes next.')}</p>
          </div>
          <div className="inline-flex rounded-full border border-border bg-card p-1" role="group" aria-label={zh ? '阅读模块' : 'Reading module'}>
            {(['academic', 'general'] as const).map((item) => (
              <button key={item} type="button" data-testid={`module-${item}`} aria-pressed={module === item} onClick={() => onModuleChange(item)} className={cn('rounded-full px-4 py-2 text-xs font-medium', module === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {item === 'academic' ? 'Academic' : 'General Training'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label={zh ? '真实学习进度' : 'Your saved learning progress'}>
          <span className="inline-flex items-center gap-2"><Star className="size-4 text-primary" aria-hidden="true" /><strong data-testid="learning-xp">{progress ? progress.xp.toLocaleString() : '—'}</strong><span className="text-muted-foreground">XP</span></span>
          <span className="inline-flex items-center gap-2"><Flame className="size-4 text-primary" aria-hidden="true" /><strong data-testid="learning-streak">{progress?.streak ?? '—'}</strong><span className="text-muted-foreground">{zh ? '天学习连续记录' : 'day learning streak'}</span></span>
          <span className="inline-flex items-center gap-2"><BookOpen className="size-4 text-primary" aria-hidden="true" /><span className="text-muted-foreground">{data ? `${data.questionsAnswered} ${zh ? '道阅读题已作答' : 'reading questions answered'}` : (zh ? '正在加载学习进度…' : 'Loading your learning progress…')}</span></span>
        </div>
        <p className="text-xs text-muted-foreground">{zh ? '阅读与词汇学习共享 XP 和学习天数。' : 'Reading and vocabulary share your XP and active learning days.'}</p>
      </section>

      <section aria-labelledby="daily-reading-title" className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-sm sm:p-8" data-testid="daily-reading-card">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase"><Sparkles className="size-4" aria-hidden="true" />{dailyDone ? (zh ? '今日挑战已完成' : 'Today’s challenge, completed') : (zh ? '每日阅读挑战' : 'Your daily reading challenge')}</p>
            <h2 id="daily-reading-title" className="font-display text-2xl leading-snug sm:text-3xl">{data?.daily.title ?? (zh ? '五道题，一点新收获。' : 'Five questions. A fresh perspective.')}</h2>
            <p className="max-w-xl text-sm leading-relaxed opacity-90">{dailyDone
              ? (zh ? `答对 ${daily.score}/5 题，获得 ${daily.xpEarned ?? 0} XP。先看看证据，再决定下一步。` : `${daily.score}/5 correct · ${daily.xpEarned ?? 0} XP earned. Look at the evidence, then choose your next step.`)
              : (zh ? '一段短文，五道题，大约五分钟。无需赶时间，专注理解。' : 'A short passage, five questions, about five minutes. Take your time and focus on understanding.')}</p>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Button data-testid="start-daily-reading" disabled={busy || !data} onClick={onDaily} className="rounded-full bg-background px-5 text-primary hover:bg-background/90">
                {dailyDone ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
                {dailyDone ? (zh ? '查看今日总结' : 'View today’s summary') : daily ? (zh ? '继续今日挑战' : 'Continue challenge') : (zh ? '开始今日挑战' : 'Start daily challenge')}
              </Button>
              <span className="inline-flex items-center gap-1.5 text-xs opacity-90"><Clock className="size-3.5" aria-hidden="true" />{zh ? '5 题 · 约 5 分钟' : '5 questions · about 5 min'}</span>
            </div>
          </div>
          <div className="min-w-32 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-4" aria-label={zh ? '每日挑战进度' : 'Daily challenge progress'}>
            <p className="font-display text-3xl">{!data ? '—' : dailyDone ? 5 : answered}<span className="text-base opacity-75"> / 5</span></p>
            <p className="mt-1 text-xs opacity-90">{dailyDone ? (zh ? '已完成' : 'completed') : (zh ? '已作答' : 'answered')}</p>
            <progress className="mt-3 h-1.5 w-28 accent-background" value={data ? (dailyDone ? 5 : answered) : undefined} max={5} aria-label={zh ? '五道题作答进度' : 'Questions answered out of five'} />
          </div>
        </div>
        <p className="mt-5 text-xs opacity-80">{zh ? '每道正确答案 10 XP · 自动保存 · 每个模块每天仅奖励一次' : '10 XP per correct answer · Progress saved · One reward per module, per day'}</p>
      </section>

      <section aria-labelledby="continue-reading-title" data-testid="reading-continue">
        <h2 id="continue-reading-title" className="font-display text-xl">{zh ? '接着上次的进度' : 'Pick up where you left off'}</h2>
        {!data ? <p className="mt-2 text-sm text-muted-foreground">{zh ? '正在读取已保存的练习…' : 'Checking your saved practice…'}</p> : unfinished.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{zh ? '暂无未完成的练习。开始挑战后，进度会出现在这里。' : 'No unfinished practice. When you start a session, your saved progress will appear here.'}</p> : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {unfinished.slice(0, 4).map((session) => {
              const count = Object.values(session.answers).filter((answer) => answer.trim()).length
              return <article key={session.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                <div><p className="line-clamp-2 text-sm font-medium">{session.testTitle}</p><p className="mt-1 text-xs text-muted-foreground">{count}/{session.total} {zh ? '已作答' : 'answered'} · {session.kind === 'daily' ? (zh ? '每日挑战' : 'Daily challenge') : session.mode === 'exam' ? (zh ? '模考，计时仍在继续' : 'Exam · the clock keeps running') : (zh ? '练习' : 'Practice')}</p></div>
                <div className="flex items-center gap-3"><progress className="h-1.5 min-w-0 flex-1 accent-primary" max={Math.max(1, session.total)} value={count} aria-label={`${count} of ${session.total} answered`} /><Button variant="outline" size="sm" disabled={busy} onClick={() => onResume(session.id)} data-testid={`resume-reading-${session.id}`} className="rounded-full">{zh ? '继续' : 'Resume'}<ArrowRight className="size-3.5" /></Button></div>
              </article>
            })}
          </div>
        )}
        {unfinished.length > 4 ? <details className="mt-3 text-sm"><summary className="cursor-pointer text-primary">{zh ? '更多未完成练习' : 'More unfinished practice'} ({unfinished.length - 4})</summary><div className="mt-2 flex flex-wrap gap-2">{unfinished.slice(4).map((session) => <Button key={session.id} variant="outline" size="sm" disabled={busy} onClick={() => onResume(session.id)}>{session.testTitle}</Button>)}</div></details> : null}
      </section>

      <section aria-labelledby="recommended-reading-title" data-testid="reading-recommendations">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="recommended-reading-title" className="font-display text-xl">{zh ? '适合你的下一步' : 'A useful next step for you'}</h2><p className="text-xs text-muted-foreground">{zh ? '根据正确率、练习时间和样本量推荐' : 'Based on accuracy, recency, and sample size'}</p></div>
        {!data ? <p className="mt-3 text-sm text-muted-foreground">{zh ? '正在查找练习…' : 'Finding your next exercise…'}</p> : <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.recommendations.map((item) => <article key={item.testId} className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5">
            <div><p className="text-xs font-medium text-primary">{item.accuracy === undefined ? (zh ? '入门练习' : 'Build your baseline') : (zh ? '根据你的练习记录' : 'From your practice')}</p><h3 className="mt-2 text-sm font-semibold">{QUESTION_TYPE_LABELS[item.type]?.[zh ? 'zh' : 'en'] ?? item.title}</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.accuracy === undefined ? (zh ? '先积累一些作答记录，再判断哪些题型需要加强。' : 'Try a short set before we draw conclusions about your strengths.') : `${item.accuracy}% ${zh ? '正确率，基于' : 'accuracy across'} ${item.sampleSize} ${zh ? '道不同题目' : 'distinct questions'}. ${zh ? '结合近期练习表现推荐。' : item.reason}`}</p><p className="mt-2 text-xs text-muted-foreground">{item.questionCount} {zh ? '题' : 'questions'} · {Math.ceil(item.durationSeconds / 60)} {zh ? '分钟' : 'min'}</p></div>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onPractice(item.testId)} className="justify-between rounded-full">{zh ? '开始练习' : 'Try this exercise'}<ArrowRight className="size-3.5" /></Button>
          </article>)}
        </div>}
      </section>

      <section aria-labelledby="reading-week-title" className="rounded-3xl border border-border bg-card p-5 sm:p-6" data-testid="reading-weekly-activity">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="reading-week-title" className="font-display text-xl">{zh ? '过去七天的学习' : 'Your last seven days'}</h2><span className="text-xs text-muted-foreground">{progress ? weeklyDays : '—'}/7 {zh ? '天有学习记录' : 'active learning days'}</span></div>
        <div className="mt-5 grid grid-cols-7 gap-2" role="list" aria-label={zh ? '学习活动日历' : 'Weekly learning activity'}>
          {(progress?.weekly ?? []).map((day) => {
            const date = new Date(`${day.day}T12:00:00`)
            const active = day.reading + day.vocabulary > 0
            const label = `${day.day}: ${day.reading} reading, ${day.vocabulary} vocabulary, ${day.xp} XP`
            return <div key={day.day} role="listitem" aria-label={label} title={label} className="text-center">
              <span className="text-[10px] text-muted-foreground sm:text-xs">{date.toLocaleDateString(zh ? 'zh-CN' : 'en', { weekday: 'short' })}</span>
              <span className={cn('mx-auto mt-2 grid size-9 place-items-center rounded-xl border text-xs sm:size-11', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground')}>{active ? <Check className="size-4" aria-hidden="true" /> : date.getDate()}</span>
            </div>
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{zh ? '记录真实完成的阅读和词汇学习。休息后随时可以继续。' : 'Completed reading and vocabulary practice count. You can always return after a break.'} {progress?.timezone}</p>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4" aria-label={zh ? '学习里程碑' : 'Learning milestones'}>
          {milestones.map((milestone) => <span key={milestone.label} className={cn('inline-flex items-center gap-1.5 text-xs', milestone.done ? 'text-primary' : 'text-muted-foreground')}><span role="img" className={cn('grid size-4 place-items-center rounded-full border', milestone.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border')} aria-label={!data ? (zh ? '正在加载' : 'Loading') : milestone.done ? (zh ? '已达成' : 'Achieved') : (zh ? '尚未达成' : 'Not yet achieved')}>{milestone.done ? <Check className="size-2.5" aria-hidden="true" /> : null}</span>{milestone.label}</span>)}
        </div>
      </section>
    </>
  )
}
