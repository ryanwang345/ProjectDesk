import { useCallback, useEffect, useState } from 'react'
import {
  Award,
  BookOpen,
  Clock,
  FileText,
  Filter,
  History,
  Layers,
  Play,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { ReadingExamView } from '@/components/reading-exam'
import { ReadingResultsView } from '@/components/reading-results'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/i18n'
import {
  generateReadingPractice,
  getReadingAnalytics,
  getReadingSession,
  listReadingTests,
  startReadingSession,
  submitReadingSession,
} from '@/lib/api'
import {
  ALL_QUESTION_TYPES,
  formatDurationClock,
  QUESTION_TYPE_LABELS,
  type ReadingAnalytics,
  type ReadingHighlight,
  type ReadingQuestionType,
  type ReadingSession,
  type ReadingTest,
} from '@/lib/reading'
import { cn } from '@/lib/utils'

type ReadingCategoryTab = 'full' | 'passage' | 'question_type' | 'ai' | 'history'
type ReadingModule = 'academic' | 'general'
type ReadingMode = 'practice' | 'exam'

const ACTIVE_READING_SESSION_KEY = 'reading-active-session'

function rememberReadingSession(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_READING_SESSION_KEY, id)
    else localStorage.removeItem(ACTIVE_READING_SESSION_KEY)
  } catch { /* The exam also works when browser storage is unavailable. */ }
}

type ViewState =
  | { kind: 'dashboard' }
  | { kind: 'exam'; session: ReadingSession; test: ReadingTest; reviewMode?: boolean }
  | { kind: 'results'; session: ReadingSession; test: ReadingTest }

export function ReadingPage({ embedded = false }: { embedded?: boolean }) {
  const { locale } = useI18n()
  const isZh = locale === 'zh'

  const [tests, setTests] = useState<ReadingTest[]>([])
  const [analytics, setAnalytics] = useState<ReadingAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [moduleFilter, setModuleFilter] = useState<ReadingModule>('academic')
  const [categoryTab, setCategoryTab] = useState<ReadingCategoryTab>('full')
  const [selectedMode, setSelectedMode] = useState<ReadingMode>('practice')
  const [startingTestId, setStartingTestId] = useState<string | null>(null)
  const [view, setView] = useState<ViewState>({ kind: 'dashboard' })
  const [examBriefing, setExamBriefing] = useState<ReadingTest | null>(null)
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let savedId: string | null = null
    try { savedId = localStorage.getItem(ACTIVE_READING_SESSION_KEY) } catch { /* optional storage */ }
    if (savedId) {
      void getReadingSession(savedId).then((bundle) => {
        if (!active) return
        if (bundle.session.status === 'submitted') {
          rememberReadingSession(null)
          return
        }
        setResumeSessionId(bundle.session.id)
        setView({ kind: 'exam', session: bundle.session, test: bundle.test })
      }).catch(() => {
        if (active) setResumeSessionId(savedId)
      })
    }
    return () => { active = false }
  }, [])

  // AI Practice Generator state
  const [aiTopic, setAiTopic] = useState('')
  const [aiDifficulty, setAiDifficulty] = useState('Band 7.0-8.0')
  const [aiTypes, setAiTypes] = useState<ReadingQuestionType[]>([
    'tfng',
    'multiple_choice',
    'summary_completion',
  ])
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const refreshDashboard = useCallback(
    async (mod: ReadingModule) => {
      try {
        const [testsList, stats] = await Promise.all([
          listReadingTests(),
          getReadingAnalytics(mod),
        ])
        setTests(testsList)
        setAnalytics(stats)
        setError(null)
      } catch {
        setError(
          isZh
            ? '无法连接到雅思阅读后端服务，请确认 Go API 与 Postgres 已启动。'
            : 'Could not reach the IELTS Reading API. Make sure the Go server and Postgres are running.',
        )
      } finally {
        setLoading(false)
      }
    },
    [isZh],
  )

  useEffect(() => {
    let active = true
    Promise.all([listReadingTests(), getReadingAnalytics(moduleFilter)])
      .then(([testsList, stats]) => {
        if (!active) return
        setTests(testsList)
        setAnalytics(stats)
        setError(null)
      })
      .catch(() => {
        if (!active) return
        setError(
          isZh
            ? '无法连接到雅思阅读后端服务，请确认 Go API 与 Postgres 已启动。'
            : 'Could not reach the IELTS Reading API. Make sure the Go server and Postgres are running.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [moduleFilter, isZh])

  async function handleStartTest(testId: string, modeOverride?: ReadingMode, briefed = false) {
    const mode = modeOverride ?? selectedMode
    if (mode === 'exam' && !briefed) {
      const test = tests.find((item) => item.id === testId)
      if (test) { setExamBriefing(test); return }
    }
    setStartingTestId(testId)
    setError(null)
    try {
      const bundle = await startReadingSession({ testId, mode })
      rememberReadingSession(bundle.session.id)
      setResumeSessionId(bundle.session.id)
      setExamBriefing(null)
      setView({ kind: 'exam', session: bundle.session, test: bundle.test })
    } catch {
      setError(
        isZh
          ? '启动阅读练习失败，请重试。'
          : 'Could not start the reading session. Please try again.',
      )
    } finally {
      setStartingTestId(null)
    }
  }

  async function handleResumeSession() {
    if (!resumeSessionId) return
    setStartingTestId(resumeSessionId)
    try {
      const bundle = await getReadingSession(resumeSessionId)
      setView({ kind: bundle.session.status === 'submitted' ? 'results' : 'exam', ...bundle })
    } catch {
      setError(isZh ? '无法恢复答题，请重试。' : 'Could not resume your attempt. Please try again.')
    } finally { setStartingTestId(null) }
  }

  async function handleOpenHistorySession(sessionId: string, target: 'results' | 'exam') {
    setStartingTestId(sessionId)
    try {
      const bundle = await getReadingSession(sessionId)
      setView({
        kind: target,
        session: bundle.session,
        test: bundle.test,
        reviewMode: target === 'exam',
      })
    } catch {
      setError(
        isZh
          ? '加载历史记录失败。'
          : 'Could not load that reading attempt.',
      )
    } finally {
      setStartingTestId(null)
    }
  }

  async function handleSubmitExam(
    sessionId: string,
    payload: {
      elapsedSeconds: number
      answers: Record<string, string>
      flags: Record<string, boolean>
      bookmarks: Record<string, boolean>
      highlights: ReadingHighlight[]
    },
  ) {
    const bundle = await submitReadingSession(sessionId, payload)
    rememberReadingSession(null)
    setResumeSessionId(null)
    void refreshDashboard(moduleFilter)
    setView({ kind: 'results', session: bundle.session, test: bundle.test })
  }

  function toggleAiType(qt: ReadingQuestionType) {
    setAiTypes((prev) =>
      prev.includes(qt)
        ? prev.length > 1
          ? prev.filter((item) => item !== qt)
          : prev
        : [...prev, qt],
    )
  }

  async function handleGenerateAiPractice(e: React.FormEvent) {
    e.preventDefault()
    setAiGenerating(true)
    setAiError(null)
    try {
      const created = await generateReadingPractice({
        topic: aiTopic.trim() || 'Urban Biodiversity and Ecological Architecture',
        module: moduleFilter,
        difficulty: aiDifficulty,
        questionTypes: aiTypes,
      })
      setTests((prev) => [created, ...prev])
      const bundle = await startReadingSession({ testId: created.id, mode: selectedMode })
      rememberReadingSession(bundle.session.id)
      setResumeSessionId(bundle.session.id)
      setView({ kind: 'exam', session: bundle.session, test: bundle.test })
    } catch {
      setAiError(
        isZh
          ? '生成 AI 雅思阅读练习失败，请稍后重试。'
          : 'Failed to generate AI reading practice. Please try again.',
      )
    } finally {
      setAiGenerating(false)
    }
  }

  if (view.kind === 'exam') {
    return (
      <ReadingExamView
        test={view.test}
        session={view.session}
        reviewMode={view.reviewMode || view.session.status === 'submitted'}
        onSessionChange={(next) =>
          setView((curr) => (curr.kind === 'exam' ? { ...curr, session: next } : curr))
        }
        onSubmit={(payload) => handleSubmitExam(view.session.id, payload)}
        onOpenResults={
          view.session.status === 'submitted'
            ? () => setView({ kind: 'results', session: view.session, test: view.test })
            : undefined
        }
        onExit={() => {
          void refreshDashboard(moduleFilter)
          setView({ kind: 'dashboard' })
        }}
      />
    )
  }

  if (view.kind === 'results') {
    return (
      <ReadingResultsView
        test={view.test}
        session={view.session}
        onOpenSplitReview={() =>
          setView({
            kind: 'exam',
            session: view.session,
            test: view.test,
            reviewMode: true,
          })
        }
        onRetake={() => {
          setView({ kind: 'dashboard' })
          void handleStartTest(view.test.id, view.session.mode)
        }}
        onBackToDashboard={() => {
          void refreshDashboard(moduleFilter)
          setView({ kind: 'dashboard' })
        }}
      />
    )
  }

  const filteredTests = tests.filter((t) => {
    if (categoryTab === 'ai' || categoryTab === 'history') return false
    if (categoryTab === 'full') {
      return t.category === 'full' && t.module === moduleFilter
    }
    if (categoryTab === 'passage') {
      return t.category === 'passage' && t.module === moduleFilter
    }
    if (categoryTab === 'question_type') {
      return t.category === 'question_type' && t.module === moduleFilter
    }
    return true
  })

  const typeStatsMap = new Map(
    (analytics?.byType ?? []).map((item) => [item.type, item]),
  )

  return (
    <div className={cn('mx-auto w-full max-w-7xl space-y-6', embedded ? 'py-2' : '')}>
      <Dialog open={Boolean(examBriefing)} onOpenChange={(open) => { if (!open) setExamBriefing(null) }}>
        <DialogContent className="sm:max-w-xl" data-testid="reading-exam-briefing">
          <DialogHeader>
            <DialogTitle>{isZh ? '阅读考试说明' : 'Before you begin'}</DialogTitle>
            <DialogDescription>{examBriefing?.title}</DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium">
            {Math.round((examBriefing?.durationSeconds ?? 3600) / 60)} {isZh ? '分钟' : 'minutes'} · {examBriefing?.questionCount} {isZh ? '题' : 'questions'} · {examBriefing?.passages.length} {isZh ? '部分' : 'parts'}
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
            <li>{isZh ? '点击开始后计时。考试不可暂停，离开页面后计时继续。' : 'The clock starts when you begin. It cannot be paused and keeps running if you leave or reload.'}</li>
            <li>{isZh ? '所有答案必须在规定时间内完成，没有额外誊写时间。到时自动交卷。' : 'Enter all answers within the time limit. There is no extra transfer time. Your attempt submits automatically when time ends.'}</li>
            <li>{isZh ? '每题一分，答错不倒扣。注意每组题目的字数限制。' : 'Each correct answer earns one mark. There is no penalty for a wrong answer. Follow the word limit for each group.'}</li>
            <li>{isZh ? '可自由切换篇章、标记待检查题目及高亮文本。答题期间不提供答案或 AI 帮助。' : 'Move freely between parts, flag questions for review, and highlight text. Answers and AI help are available after submission.'}</li>
          </ul>
          <p className="text-xs text-muted-foreground">{isZh ? '原创非官方模拟题，分数仅供参考。' : 'Original, unofficial practice material. Band scores are estimates.'}</p>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExamBriefing(null)}>{isZh ? '返回' : 'Go back'}</Button>
            <Button data-testid="reading-begin-exam" disabled={startingTestId !== null} onClick={() => { if (examBriefing) void handleStartTest(examBriefing.id, 'exam', true) }}>
              {startingTestId ? (isZh ? '正在启动…' : 'Starting…') : (isZh ? '开始计时考试' : 'Begin timed test')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {resumeSessionId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm">{isZh ? '有一份未完成的答卷。模考计时仍在继续。' : 'You have an unfinished attempt. An exam clock continues while you are away.'}</p>
          <Button disabled={startingTestId !== null} data-testid="reading-resume" onClick={() => void handleResumeSession()}>{isZh ? '继续答题' : 'Resume attempt'}</Button>
        </div>
      ) : null}
      {/* Hero & Module / Mode Controls */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold tracking-wider text-primary uppercase">
              <BookOpen className="size-3.5" />
              {isZh ? '机考雅思阅读全真模考与精练' : 'Computer-Delivered IELTS Reading'}
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-4xl">
              {isZh ? 'IELTS Reading 雅思阅读训练中心' : 'IELTS Reading Practice & Exam Studio'}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isZh
                ? '还原机考双栏分屏界面、高亮笔记、段落证据定位、12 种官方题型评分与 AI 考官深度解析。支持 60 分钟全真模考与即时反馈练习模式。'
                : 'Original, unofficial IELTS practice papers with a split-screen exam, passage highlighting, timed submission, and detailed answer explanations.'}
            </p>
          </div>

          {/* Module & Mode Selectors */}
          <div className="flex flex-col gap-3 sm:items-end">
            <div
              role="group"
              aria-label={isZh ? '阅读模块选择' : 'Reading Module'}
              className="inline-flex rounded-2xl border border-border bg-muted/60 p-1"
            >
              <button
                type="button"
                data-testid="module-academic"
                onClick={() => setModuleFilter('academic')}
                className={cn(
                  'rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors',
                  moduleFilter === 'academic'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {isZh ? 'Academic 学术类 (A类)' : 'Academic'}
              </button>
              <button
                type="button"
                data-testid="module-general"
                onClick={() => setModuleFilter('general')}
                className={cn(
                  'rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors',
                  moduleFilter === 'general'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {isZh ? 'General 培训类 (G类)' : 'General Training'}
              </button>
            </div>

            <div
              role="group"
              aria-label={isZh ? '默认答题模式' : 'Default Mode'}
              className="inline-flex items-center gap-1 rounded-2xl border border-border bg-background p-1 text-xs"
            >
              <span className="px-2.5 text-[11px] text-muted-foreground">
                {isZh ? '启动模式:' : 'Launch in:'}
              </span>
              <button
                type="button"
                data-testid="mode-practice"
                onClick={() => setSelectedMode('practice')}
                className={cn(
                  'rounded-xl px-3 py-1 font-medium transition-colors',
                  selectedMode === 'practice'
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {isZh ? '练习模式 (即时批改)' : 'Practice Mode'}
              </button>
              <button
                type="button"
                data-testid="mode-exam"
                onClick={() => setSelectedMode('exam')}
                className={cn(
                  'rounded-xl px-3 py-1 font-medium transition-colors',
                  selectedMode === 'exam'
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {isZh ? '全真模考 (计时交卷)' : 'Exam Mode'}
              </button>
            </div>
          </div>
        </div>

        {/* Analytics Summary Cards */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-primary/25 bg-primary/8 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{isZh ? '预估雅思阅读 Band' : 'Estimated Reading Band'}</span>
              <Award className="size-4 text-primary" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold text-primary" data-testid="estimated-band">
                {analytics && analytics.completedExams > 0
                  ? analytics.averageBand.toFixed(1)
                  : '—'}
              </span>
              <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {isZh ? '非官方预估' : 'Unofficial'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {moduleFilter === 'academic'
                ? isZh
                  ? '基于 Academic 常用分数区间预估'
                  : 'Based on Academic 40-question scale'
                : isZh
                  ? '基于 General Training 常用分数区间预估'
                  : 'Based on General Training scale'}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{isZh ? '平均正确率' : 'Average Accuracy'}</span>
              <Target className="size-4 text-primary" />
            </div>
            <p className="mt-1.5 font-display text-3xl font-bold">
              {analytics && analytics.completedExams > 0
                ? `${Math.round(analytics.averageAccuracy)}%`
                : '0%'}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isZh ? '所有已提交套题与专项训练' : 'Across all submitted sessions'}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{isZh ? '已完成练习次数' : 'Completed Attempts'}</span>
              <TrendingUp className="size-4 text-primary" />
            </div>
            <p className="mt-1.5 font-display text-3xl font-bold">
              {analytics?.completedExams ?? 0}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isZh ? '每次练习自动保存至 Postgres' : 'Saved automatically in Postgres'}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{isZh ? '累计精读时长' : 'Total Reading Time'}</span>
              <Clock className="size-4 text-primary" />
            </div>
            <p className="mt-1.5 font-display text-3xl font-bold">
              {formatDurationClock(analytics?.totalTimeSeconds ?? 0)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isZh ? '建议全真模考控制在 60 分钟内' : 'Target 60:00 per full 3-passage test'}
            </p>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Navigation Tabs for Practice Categories */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div role="tablist" aria-label={isZh ? '练习分类' : 'Practice Categories'} className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            role="tab"
            aria-selected={categoryTab === 'full'}
            data-testid="tab-full-tests"
            onClick={() => setCategoryTab('full')}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors',
              categoryTab === 'full'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <Layers className="size-3.5" />
            {isZh ? '全真模考套题 (40题/60分钟)' : 'Full Reading Tests (40 Qs)'}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={categoryTab === 'passage'}
            data-testid="tab-passages"
            onClick={() => setCategoryTab('passage')}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors',
              categoryTab === 'passage'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <FileText className="size-3.5" />
            {isZh ? '单篇精读训练 (Passage 1–3)' : 'Individual Passages'}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={categoryTab === 'question_type'}
            data-testid="tab-question-types"
            onClick={() => setCategoryTab('question_type')}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors',
              categoryTab === 'question_type'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <Filter className="size-3.5" />
            {isZh ? '12 大题型专项突破' : 'Question Type Practice'}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={categoryTab === 'ai'}
            data-testid="tab-ai-generator"
            onClick={() => setCategoryTab('ai')}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors',
              categoryTab === 'ai'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <Sparkles className="size-3.5" />
            {isZh ? 'AI 命题生成' : 'AI Practice Generator'}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={categoryTab === 'history'}
            data-testid="tab-history"
            onClick={() => setCategoryTab('history')}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors',
              categoryTab === 'history'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <History className="size-3.5" />
            {isZh ? '练习历史与错题回顾' : 'Reading History'}
            {analytics && analytics.recentSessions.length > 0 && (
              <span className="rounded-full bg-background/25 px-1.5 py-0.2 text-[10px]">
                {analytics.recentSessions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Left Column: Selected Tab Content */}
        <div className="space-y-4">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-48 animate-pulse rounded-3xl border border-border bg-card p-6" />
              ))}
            </div>
          ) : categoryTab === 'ai' ? (
            <form
              onSubmit={(e) => void handleGenerateAiPractice(e)}
              className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-5"
            >
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Sparkles className="size-4" />
                  {isZh ? 'AI 原创雅思阅读命题引擎' : 'Original IELTS Passage & Question Generator'}
                </div>
                <h2 className="text-xl font-semibold">
                  {isZh ? '定制生成专属雅思阅读篇章' : 'Generate Custom IELTS Reading Practice'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isZh
                    ? '输入任意学术或社科主题，选择目标分数段与题型组合，系统将即时生成带段落编号 (A–D)、标准题型、答案校验及中英证据解析的原创篇章。'
                    : 'Choose an academic or general topic, target band difficulty, and question types. The backend validates answer consistency before saving.'}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="ai-topic" className="text-xs font-medium">
                    {isZh ? '文章主题 (Topic)' : 'Passage Topic'}
                  </label>
                  <input
                    id="ai-topic"
                    type="text"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder={
                      isZh
                        ? '例如：深海热液生态系统 / 城市垂直农业'
                        : 'e.g. Deep-Sea Hydrothermal Vents, Paleolithic Cave Art'
                    }
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="ai-difficulty" className="text-xs font-medium">
                    {isZh ? '难度分级 (Target Band)' : 'Difficulty Level'}
                  </label>
                  <select
                    id="ai-difficulty"
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                  >
                    <option value="Band 6.0-7.0">Band 6.0 – 7.0 (Intermediate Academic)</option>
                    <option value="Band 7.0-8.0">Band 7.0 – 8.0 (Exam Standard)</option>
                    <option value="Band 8.0-9.0">Band 8.0 – 9.0 (High Lexical Density)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-medium">
                  {isZh ? '包含题型 (可多选)' : 'Select Question Types'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {ALL_QUESTION_TYPES.map((qt) => {
                    const active = aiTypes.includes(qt)
                    const label = QUESTION_TYPE_LABELS[qt]
                    return (
                      <button
                        key={qt}
                        type="button"
                        onClick={() => toggleAiType(qt)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs transition-colors',
                          active
                            ? 'border-primary bg-primary/15 font-medium text-primary'
                            : 'border-border bg-background text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {isZh ? label.zh : label.en}
                      </button>
                    )
                  })}
                </div>
              </div>

              {aiError && <p className="text-xs text-destructive">{aiError}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="submit" disabled={aiGenerating} className="rounded-full gap-2">
                  <Sparkles className="size-4" />
                  {aiGenerating
                    ? isZh
                      ? '正在生成篇章与校验答案…'
                      : 'Generating & Validating Passage…'
                    : isZh
                      ? '生成并开始练习'
                      : 'Generate & Start Practice'}
                </Button>
              </div>
            </form>
          ) : categoryTab === 'history' ? (
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">
                {isZh ? '历史练习与模考记录' : 'Completed Reading Sessions'}
              </h2>
              {!analytics || analytics.recentSessions.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {isZh
                    ? '暂无已提交的阅读记录。选择任意套题或单篇开始你的第一次练习吧！'
                    : 'No completed reading sessions yet. Start any test or passage drill to track your progress.'}
                </p>
              ) : (
                <div className="mt-4 divide-y divide-border">
                  {analytics.recentSessions.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm">{item.testTitle}</span>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                            {item.module}
                          </span>
                          <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-medium text-primary uppercase">
                            {item.mode}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {isZh ? '得分:' : 'Score:'} {item.score}/{item.total} ·{' '}
                          {isZh ? '用时:' : 'Time:'} {formatDurationClock(item.elapsedSeconds)}
                          {item.submittedAt
                            ? ` · ${new Date(item.submittedAt).toLocaleString()}`
                            : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="block text-[10px] uppercase text-muted-foreground">
                            {isZh ? '预估 Band' : 'Est. Band'}
                          </span>
                          <span className="font-display text-xl font-bold text-primary">
                            {item.band.toFixed(1)}
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full text-xs"
                          disabled={startingTestId === item.id}
                          onClick={() => void handleOpenHistorySession(item.id, 'results')}
                        >
                          {isZh ? '查看详情' : 'View Report'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="rounded-full text-xs"
                          disabled={startingTestId === item.id}
                          onClick={() => void handleOpenHistorySession(item.id, 'exam')}
                        >
                          {isZh ? '分屏复盘' : 'Split-Screen Review'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredTests.map((test) => {
                const questionTypes = Array.from(
                  new Set((test.questions ?? []).map((q) => q.type)),
                )
                return (
                  <article
                    key={test.id}
                    data-testid={`reading-test-card-${test.slug}`}
                    className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 sm:p-6"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary uppercase">
                            {test.module === 'academic' ? 'Academic' : 'General Training'}
                          </span>
                          <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
                            {test.difficulty}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="size-3.5" />
                            {Math.round(test.durationSeconds / 60)} {isZh ? '分钟' : 'min'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <FileText className="size-3.5" />
                            {test.passages.length}{' '}
                            {isZh ? '篇文章' : test.passages.length === 1 ? 'passage' : 'passages'} ·{' '}
                            {test.questionCount} {isZh ? '题' : 'questions'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {test.passages.reduce((sum, p) => sum + p.wordCount, 0).toLocaleString()} {isZh ? '词' : 'words'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h2 className="text-lg font-semibold leading-snug">
                          {test.title}
                        </h2>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {test.subtitle}
                        </p>
                      </div>

                      {/* Question Type Pills */}
                      {questionTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {questionTypes.map((qt) => {
                            const label = QUESTION_TYPE_LABELS[qt]
                            return (
                              <span
                                key={qt}
                                className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground"
                              >
                                {label ? (isZh ? label.zh : label.en) : qt}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                      <div className="text-xs text-muted-foreground">
                        {test.passages.map((p, idx) => (
                          <span key={p.id} className="mr-3 inline-block">
                            <strong className="text-foreground">P{idx + 1}:</strong> {p.title}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs"
                          disabled={startingTestId !== null}
                          data-testid={`start-practice-${test.slug}`}
                          onClick={() => void handleStartTest(test.id, 'practice')}
                        >
                          {isZh ? '练习模式' : 'Practice Mode'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full gap-1.5 text-xs"
                          disabled={startingTestId !== null}
                          data-testid={`start-exam-${test.slug}`}
                          onClick={() => void handleStartTest(test.id, 'exam')}
                        >
                          <Play className="size-3.5" />
                          {startingTestId === test.id
                            ? isZh
                              ? '正在进入…'
                              : 'Starting…'
                            : isZh
                              ? '全真模考'
                              : 'Exam Simulation'}
                        </Button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar: 12 IELTS Question Types Mastery & Quick Guide */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold">
              {isZh ? '12 大雅思阅读题型掌握度' : 'Accuracy by Question Type'}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isZh
                ? '涵盖机考全部 12 种官方题型，自动统计历史正确率。'
                : 'Tracks your historical accuracy across all 12 official IELTS Reading question formats.'}
            </p>

            <div className="mt-4 space-y-2.5">
              {ALL_QUESTION_TYPES.map((qt) => {
                const stat = typeStatsMap.get(qt)
                const total = stat?.total ?? 0
                const correct = stat?.correct ?? 0
                const pct = total > 0 ? Math.round(stat?.percent ?? 0) : null
                const label = QUESTION_TYPE_LABELS[qt]
                return (
                  <div key={qt} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-medium">
                        {isZh ? label.zh : label.en}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {pct !== null ? `${correct}/${total} (${pct}%)` : isZh ? '未练习' : 'Not tried'}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          pct === null
                            ? 'w-0'
                            : pct >= 75
                              ? 'bg-emerald-500'
                              : pct >= 50
                                ? 'bg-amber-500'
                                : 'bg-rose-500',
                        )}
                        style={{ width: `${pct ?? 0}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-2.5">
            <h3 className="text-sm font-semibold">
              {isZh ? '机考阅读实用技巧' : 'Computer-Delivered Exam Tips'}
            </h3>
            <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>
                •{' '}
                {isZh
                  ? '选中文章任意句子即可添加黄色/绿色高亮笔记，方便回看定位。'
                  : 'Select any phrase in the passage to highlight evidence in yellow or green.'}
              </li>
              <li>
                •{' '}
                {isZh
                  ? '双击或选中生词即可唤起 AI 语境词汇助手，查看同义替换与中英例句。'
                  : 'Select any unfamiliar word to open the AI Vocabulary Assistant in context.'}
              </li>
              <li>
                •{' '}
                {isZh
                  ? '严格遵守字数限制（如 ONE WORD ONLY），超字数系统将实时提醒。'
                  : 'Watch word-limit badges (e.g. ONE WORD ONLY); live word counters warn if you exceed the limit.'}
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
