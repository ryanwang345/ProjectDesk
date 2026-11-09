import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Highlighter,
  RotateCcw,
  Sparkles,
  Trash2,
  Type,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/i18n'
import {
  checkReadingQuestion,
  explainReadingQuestion,
  lookupReadingVocab,
  updateReadingSession,
} from '@/lib/api'
import {
  QUESTION_TYPE_LABELS,
  countAnswerWords,
  formatDurationClock,
  type ReadingAIExplanation,
  type ReadingHighlight,
  type ReadingPassage,
  type ReadingQuestion,
  type ReadingQuestionResult,
  type ReadingSession,
  type ReadingTest,
  type ReadingVocabResponse,
} from '@/lib/reading'

type FontSizeScale = 'sm' | 'base' | 'lg' | 'xl'

const FONT_SIZE_CLASS: Record<FontSizeScale, string> = {
  sm: 'text-sm leading-relaxed',
  base: 'text-base leading-relaxed',
  lg: 'text-lg leading-relaxed',
  xl: 'text-xl leading-relaxed',
}

export function ReadingExamView({
  test,
  session,
  reviewMode,
  onExit,
  onSessionChange,
  onSubmit,
  onOpenResults,
}: {
  test: ReadingTest
  session: ReadingSession
  reviewMode?: boolean
  onExit: () => void
  onSessionChange: (next: ReadingSession) => void
  onSubmit: (payload: {
    elapsedSeconds: number
    answers: Record<string, string>
    flags: Record<string, boolean>
    bookmarks: Record<string, boolean>
    highlights: ReadingHighlight[]
  }) => Promise<void>
  onOpenResults?: () => void
}) {
  const { locale } = useI18n()
  const isZh = locale === 'zh'
  const questions = useMemo(() => test.questions ?? [], [test.questions])
  const passages = useMemo(() => test.passages ?? [], [test.passages])

  const [activePassageId, setActivePassageId] = useState<string>(() => passages[0]?.id ?? '')
  const [activeQuestionId, setActiveQuestionId] = useState<string>(() => questions[0]?.id ?? '')
  const [mobileTab, setMobileTab] = useState<'passage' | 'questions'>('passage')
  const [fontSize, setFontSize] = useState<FontSizeScale>('base')

  const [answers, setAnswers] = useState<Record<string, string>>(() => ({ ...(session.answers ?? {}) }))
  const [flags, setFlags] = useState<Record<string, boolean>>(() => ({ ...(session.flags ?? {}) }))
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>(() => ({ ...(session.bookmarks ?? {}) }))
  const [highlights, setHighlights] = useState<ReadingHighlight[]>(() => [...(session.highlights ?? [])])
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => session.mode === 'exam' && session.status === 'active'
    ? Math.min(session.durationSeconds, Math.max(session.elapsedSeconds, Math.floor((Date.now() - Date.parse(session.startedAt)) / 1000)))
    : session.elapsedSeconds || 0)
  const [timerPaused, setTimerPaused] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [submitReviewOpen, setSubmitReviewOpen] = useState(false)
  const [exiting, setExiting] = useState(false)

  // Practice-mode per-question checks and AI explanations
  const [practiceChecks, setPracticeChecks] = useState<Record<string, ReadingQuestionResult>>({})
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [aiExplanations, setAiExplanations] = useState<Record<string, ReadingAIExplanation>>({})
  const [explainingId, setExplainingId] = useState<string | null>(null)

  // Evidence jump highlight in passage
  const [focusedEvidence, setFocusedEvidence] = useState<{
    passageId: string
    paragraphLabel: string
    quote?: string
  } | null>(null)

  // Text selection & AI Vocabulary Assistant
  const [selectedText, setSelectedText] = useState<string>('')
  const [selectedContext, setSelectedContext] = useState<string>('')
  const [selectedParagraph, setSelectedParagraph] = useState<string>('A')
  const [vocabOpen, setVocabOpen] = useState<boolean>(false)
  const [vocabLoading, setVocabLoading] = useState<boolean>(false)
  const [vocabResult, setVocabResult] = useState<ReadingVocabResponse | null>(null)
  const [vocabInput, setVocabInput] = useState<string>('')

  const isSubmitted = session.status === 'submitted' || Boolean(reviewMode)
  const isExamMode = session.mode === 'exam'
  const remainingSeconds = Math.max(0, session.durationSeconds - elapsedSeconds)
  const examExpired = isExamMode && remainingSeconds === 0 && !isSubmitted
  const assistanceAllowed = !isExamMode || isSubmitted
  const submissionInFlightRef = useRef(false)
  const onSubmitRef = useRef(onSubmit)
  onSubmitRef.current = onSubmit
  const onSessionChangeRef = useRef(onSessionChange)
  onSessionChangeRef.current = onSessionChange

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousPageOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      document.documentElement.style.overflow = previousPageOverflow
    }
  }, [])

  const latestPayloadRef = useRef({
    elapsedSeconds,
    answers,
    flags,
    bookmarks,
    highlights,
  })
  latestPayloadRef.current = {
    elapsedSeconds,
    answers,
    flags,
    bookmarks,
    highlights,
  }

  // Countdown / elapsed timer
  useEffect(() => {
    if (isSubmitted || timerPaused) return
    const initialElapsed = latestPayloadRef.current.elapsedSeconds
    const began = Date.now()
    const tick = () => {
      setElapsedSeconds(isExamMode
        ? Math.min(session.durationSeconds, Math.max(session.elapsedSeconds, Math.floor((Date.now() - Date.parse(session.startedAt)) / 1000)))
        : initialElapsed + Math.floor((Date.now() - began) / 1000))
    }
    tick()
    const timer = window.setInterval(() => {
      tick()
    }, 250)
    return () => window.clearInterval(timer)
  }, [isSubmitted, timerPaused, isExamMode, session.durationSeconds, session.elapsedSeconds, session.startedAt])

  // Auto-submit in Exam Mode when countdown hits zero
  useEffect(() => {
    if (!examExpired) return
    async function submitExpiredAttempt() {
      if (submissionInFlightRef.current) return
      submissionInFlightRef.current = true
      setSubmitting(true)
      try {
        await onSubmitRef.current(latestPayloadRef.current)
      } catch {
        setSubmitError(isZh ? '时间已到。交卷失败，正在自动重试，请保持页面打开。' : 'Time is up. Submission failed; retrying automatically. Keep this page open.')
      } finally {
        submissionInFlightRef.current = false
        setSubmitting(false)
      }
    }
    void submitExpiredAttempt()
    const retry = window.setInterval(() => void submitExpiredAttempt(), 5000)
    return () => window.clearInterval(retry)
  }, [examExpired, isZh])

  // Periodic autosave to Postgres
  useEffect(() => {
    if (isSubmitted || examExpired || submitting) return
    let active = true
    function save() {
      void updateReadingSession(session.id, latestPayloadRef.current)
        .then((saved) => {
          if (!active) return
          setSaveError(false)
          onSessionChangeRef.current(saved)
        })
        .catch(() => { if (active) setSaveError(true) })
    }
    const saveTimer = window.setTimeout(save, 600)
    const retryTimer = window.setInterval(save, 10000)
    return () => { active = false; window.clearTimeout(saveTimer); window.clearInterval(retryTimer) }
  }, [answers, flags, bookmarks, highlights, isSubmitted, examExpired, submitting, session.id])

  useEffect(() => {
    if (isSubmitted) return
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [isSubmitted])

  // Keyboard navigation (Alt+ArrowLeft / Alt+ArrowRight)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!event.altKey) return
      const currentIdx = questions.findIndex((q) => q.id === activeQuestionId)
      if (currentIdx < 0) return
      if (event.key === 'ArrowRight' && currentIdx + 1 < questions.length) {
        event.preventDefault()
        jumpToQuestion(questions[currentIdx + 1])
      } else if (event.key === 'ArrowLeft' && currentIdx > 0) {
        event.preventDefault()
        jumpToQuestion(questions[currentIdx - 1])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const currentPassage: ReadingPassage | undefined =
    passages.find((p) => p.id === activePassageId) ?? passages[0]

  const passageQuestions = useMemo(
    () => questions.filter((q) => q.passageId === currentPassage?.id),
    [questions, currentPassage],
  )

  const answeredCount = useMemo(
    () => questions.filter((q) => Boolean(answers[q.id]?.trim())).length,
    [questions, answers],
  )

  const submittedResultsByQ = useMemo(() => {
    const map: Record<string, ReadingQuestionResult> = {}
    for (const item of session.results?.questions ?? []) {
      map[item.questionId] = item
    }
    return map
  }, [session.results])

  function jumpToQuestion(q: ReadingQuestion) {
    setActiveQuestionId(q.id)
    if (q.passageId !== activePassageId) {
      setActivePassageId(q.passageId)
    }
    setMobileTab('questions')
    window.requestAnimationFrame(() => {
      document.getElementById(`reading-q-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  function jumpToEvidence(passageId: string, paragraphLabel: string, quote?: string) {
    setActivePassageId(passageId)
    setFocusedEvidence({ passageId, paragraphLabel, quote })
    setMobileTab('passage')
    window.requestAnimationFrame(() => {
      document
        .getElementById(`passage-${passageId}-para-${paragraphLabel}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  function setAnswer(questionId: string, value: string) {
    if (isSubmitted || examExpired || submitting) return
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  function toggleFlag(questionId: string) {
    setFlags((prev) => ({ ...prev, [questionId]: !prev[questionId] }))
  }

  function toggleBookmark(key: string) {
    setBookmarks((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handlePassageSelection(paragraphLabel: string, paragraphText: string) {
    const sel = window.getSelection()?.toString().trim() ?? ''
    if (sel.length >= 2 && sel.length <= 160) {
      setSelectedText(sel)
      setSelectedContext(paragraphText)
      setSelectedParagraph(paragraphLabel)
      setVocabInput(sel)
    }
  }

  function addHighlight(color: 'amber' | 'emerald' | 'sky') {
    if (!selectedText || !currentPassage) return
    const next: ReadingHighlight = {
      id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      passageId: currentPassage.id,
      paragraphLabel: selectedParagraph,
      text: selectedText,
      color,
    }
    setHighlights((prev) => [...prev, next])
    setSelectedText('')
  }

  function removeHighlight(id: string) {
    setHighlights((prev) => prev.filter((item) => item.id !== id))
  }

  async function handleLookupVocab(termToLookup?: string) {
    if (!assistanceAllowed) return
    const term = (termToLookup ?? vocabInput ?? selectedText).trim()
    if (!term) return
    setVocabOpen(true)
    setVocabLoading(true)
    try {
      const res = await lookupReadingVocab({
        selection: term,
        context: selectedContext || currentPassage?.paragraphs[0]?.text || '',
      })
      setVocabResult(res)
    } finally {
      setVocabLoading(false)
    }
  }

  async function handlePracticeCheck(q: ReadingQuestion) {
    const ans = answers[q.id] ?? ''
    setCheckingId(q.id)
    try {
      const res = await checkReadingQuestion(session.id, q.id, ans)
      setPracticeChecks((prev) => ({ ...prev, [q.id]: res }))
    } finally {
      setCheckingId(null)
    }
  }

  function handleRetryQuestion(qId: string) {
    setPracticeChecks((prev) => {
      const next = { ...prev }
      delete next[qId]
      return next
    })
    setAiExplanations((prev) => {
      const next = { ...prev }
      delete next[qId]
      return next
    })
    setAnswers((prev) => ({ ...prev, [qId]: '' }))
  }

  async function handleExplainWithAI(q: ReadingQuestion) {
    setExplainingId(q.id)
    try {
      const exp = await explainReadingQuestion({
        sessionId: session.id,
        testId: test.id,
        questionId: q.id,
        userAnswer: answers[q.id] ?? '',
      })
      setAiExplanations((prev) => ({ ...prev, [q.id]: exp }))
    } finally {
      setExplainingId(null)
    }
  }

  async function handleFinishAndSubmit() {
    if (submissionInFlightRef.current || isSubmitted) return
    submissionInFlightRef.current = true
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmitRef.current(latestPayloadRef.current)
    } catch {
      setSubmitError(isZh ? '交卷失败，答案仍保留在本页，请重试。' : 'Could not submit. Your answers are still on this page. Please try again.')
    } finally {
      submissionInFlightRef.current = false
      setSubmitting(false)
    }
  }

  async function handleExit() {
    if (isSubmitted) { onExit(); return }
    setExiting(true)
    try {
      const saved = await updateReadingSession(session.id, latestPayloadRef.current)
      onSessionChangeRef.current(saved)
      onExit()
    } catch {
      setSaveError(true)
    } finally { setExiting(false) }
  }

  const activeQuestionIndex = Math.max(
    0,
    questions.findIndex((q) => q.id === activeQuestionId),
  )

  return createPortal(
    <div data-testid="reading-exam-view" className="fixed inset-0 z-40 flex h-dvh w-full flex-col overflow-hidden bg-card shadow-lg">
      <Dialog open={submitReviewOpen} onOpenChange={setSubmitReviewOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="reading-submit-review">
          <DialogHeader>
            <DialogTitle>{isZh ? '检查并交卷' : 'Review your attempt'}</DialogTitle>
            <DialogDescription>{answeredCount}/{questions.length} {isZh ? '题已作答。交卷后无法修改答案。' : 'questions answered. Once submitted, your answers cannot be changed.'}</DialogDescription>
          </DialogHeader>
          <p className="text-sm">{questions.length - answeredCount} {isZh ? '题未答' : 'unanswered'} · {questions.filter((q) => flags[q.id]).length} {isZh ? '题已标记' : 'flagged for review'}</p>
          <div className="flex flex-wrap gap-2">
            {questions.filter((q) => !answers[q.id]?.trim() || flags[q.id]).map((q) => (
              <Button key={q.id} variant="outline" size="sm" onClick={() => { setSubmitReviewOpen(false); jumpToQuestion(q) }}>
                {q.number}{flags[q.id] ? ' ⚑' : ''}
              </Button>
            ))}
          </div>
          {submitError ? <p role="alert" className="text-sm text-destructive">{submitError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitReviewOpen(false)}>{isZh ? '继续检查' : 'Keep reviewing'}</Button>
            <Button data-testid="reading-confirm-submit" disabled={submitting} onClick={() => void handleFinishAndSubmit()}>{submitting ? (isZh ? '正在交卷…' : 'Submitting…') : (isZh ? '确认交卷' : 'Submit answers')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Top Exam Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/50 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Button type="button" variant="ghost" size="sm" disabled={exiting || submitting || examExpired} onClick={() => void handleExit()}>
            <ChevronLeft className="size-4" />
            {isZh ? '返回阅读主页' : 'Exit to Dashboard'}
          </Button>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">
              {test.module === 'general'
                ? isZh
                  ? 'IELTS 培训类阅读 (General Training)'
                  : 'IELTS General Training Reading'
                : isZh
                  ? 'IELTS 学术类阅读 (Academic)'
                  : 'IELTS Academic Reading'}{' '}
              · {isExamMode ? (isZh ? '全真模考模式' : 'Exam Mode') : isZh ? '练习模式' : 'Practice Mode'}
            </p>
            <h1 className="max-w-md truncate text-sm font-medium">{test.title}</h1>
          </div>
        </div>

        {/* Passage Selector Tabs */}
        <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1" role="tablist" aria-label="Reading Passages">
          {passages.map((p, idx) => {
            const pQs = questions.filter((q) => q.passageId === p.id)
            const firstNum = pQs[0]?.number ?? idx + 1
            const lastNum = pQs[pQs.length - 1]?.number ?? firstNum
            const active = p.id === currentPassage?.id
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  setActivePassageId(p.id)
                  if (pQs[0]) setActiveQuestionId(pQs[0].id)
                }}
              >
                {isZh ? `篇章 ${idx + 1}` : `Passage ${idx + 1}`} ({firstNum}–{lastNum})
              </button>
            )
          })}
        </div>

        {/* Timer, Font Controls, Vocab & Submit */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            data-testid="reading-timer"
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums ${
              !isSubmitted && remainingSeconds <= 300
                ? 'border-destructive/60 bg-destructive/10 text-destructive'
                : 'border-border bg-background text-foreground'
            }`}
          >
            <Clock className="size-3.5 text-primary" aria-hidden="true" />
            <span>{isSubmitted ? formatDurationClock(session.elapsedSeconds) : formatDurationClock(remainingSeconds)}</span>
            {!isExamMode && !isSubmitted ? (
              <button
                type="button"
                className="ml-1 text-[11px] text-muted-foreground underline hover:text-foreground"
                onClick={() => setTimerPaused((p) => !p)}
              >
                {timerPaused ? (isZh ? '继续' : 'Resume') : isZh ? '暂停' : 'Pause'}
              </button>
            ) : null}
          </div>

          {/* Font size switcher */}
          <div className="hidden items-center gap-0.5 rounded-full border border-border bg-background p-0.5 md:flex" aria-label="Font size">
            <Type className="mx-1.5 size-3.5 text-muted-foreground" aria-hidden="true" />
            {(['sm', 'base', 'lg', 'xl'] as const).map((scale) => (
              <button
                key={scale}
                type="button"
                aria-pressed={fontSize === scale}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium uppercase ${
                  fontSize === scale ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setFontSize(scale)}
              >
                {scale}
              </button>
            ))}
          </div>

          {assistanceAllowed ? <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full text-xs"
            onClick={() => setVocabOpen((open) => !open)}
          >
            <Sparkles className="mr-1 size-3.5 text-primary" />
            {isZh ? 'AI 词汇助手' : 'AI Vocab'}
          </Button> : null}

          <span className="text-xs text-muted-foreground tabular-nums" data-testid="reading-progress">
            {answeredCount}/{questions.length} {isZh ? '已答' : 'answered'}
          </span>

          {isSubmitted ? (
            onOpenResults ? (
              <Button type="button" size="sm" className="rounded-full" onClick={onOpenResults}>
                {isZh ? '查看成绩报告' : 'View Score Report'}
              </Button>
            ) : null
          ) : (
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              disabled={submitting}
              data-testid="reading-submit-button"
              onClick={() => isExamMode ? setSubmitReviewOpen(true) : void handleFinishAndSubmit()}
            >
              {submitting
                ? isZh
                  ? '正在交卷…'
                  : 'Submitting…'
                : isZh
                  ? '完成并交卷'
                  : 'Finish & Submit'}
            </Button>
          )}
        </div>
      </header>

      {submitError || saveError || examExpired ? (
        <p role="alert" className="border-b border-border bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {submitError || (examExpired
            ? (isZh ? '时间已到，答卷已锁定，正在交卷…' : 'Time is up. Answers are locked. Submitting your attempt…')
            : (isZh ? '保存失败，正在重试。离开前请等待保存成功。' : 'Autosave failed. Retrying. Wait for your answers to save before leaving.'))}
        </p>
      ) : null}

      {/* Mobile Tab Switcher (Passage vs Questions) */}
      <div className="grid grid-cols-2 border-b border-border bg-muted/30 p-1 lg:hidden">
        <button
          type="button"
          className={`rounded-xl py-2 text-xs font-medium ${
            mobileTab === 'passage' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
          onClick={() => setMobileTab('passage')}
        >
          <BookOpen className="mr-1 inline size-3.5" />
          {isZh ? '阅读文章' : 'Reading Passage'}
        </button>
        <button
          type="button"
          className={`rounded-xl py-2 text-xs font-medium ${
            mobileTab === 'questions' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
          onClick={() => setMobileTab('questions')}
        >
          {isZh ? `题目 (${answeredCount}/${questions.length})` : `Questions (${answeredCount}/${questions.length})`}
        </button>
      </div>

      {/* AI Vocabulary Assistant Drawer */}
      {vocabOpen && assistanceAllowed ? (
        <div className="border-b border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-1 items-center gap-2">
              <Sparkles className="size-4 shrink-0 text-primary" />
              <input
                type="text"
                value={vocabInput}
                onChange={(e) => setVocabInput(e.target.value)}
                placeholder={isZh ? '输入或在文中划词查询语境释义、同义替换与中英例句…' : 'Type or select any word/phrase in the passage to analyze in context…'}
                className="h-8 min-w-48 flex-1 rounded-full border border-border bg-background px-3 text-xs outline-none focus:border-primary"
              />
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-full text-xs"
                disabled={vocabLoading || !vocabInput.trim()}
                onClick={() => void handleLookupVocab(vocabInput)}
              >
                {vocabLoading ? (isZh ? '分析中…' : 'Analyzing…') : isZh ? '语境解析' : 'Explain in Context'}
              </Button>
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setVocabOpen(false)}>
              {isZh ? '收起' : 'Close'}
            </Button>
          </div>
          {vocabResult ? (
            <div className="mt-2.5 grid gap-2 rounded-2xl border border-border bg-card p-3 text-xs md:grid-cols-2">
              <div>
                <p className="font-semibold text-foreground">
                  {vocabResult.term}{' '}
                  <span className="ml-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">{vocabResult.pos}</span>
                  <span className="ml-2 text-primary">{vocabResult.chinese}</span>
                </p>
                <p className="mt-1 text-muted-foreground">{vocabResult.definition}</p>
                {vocabResult.synonyms.length > 0 ? (
                  <p className="mt-1.5">
                    <span className="text-muted-foreground">{isZh ? '雅思同义替换：' : 'IELTS Paraphrases: '}</span>
                    {vocabResult.synonyms.join(' · ')}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1 border-t border-border pt-2 md:border-t-0 md:border-l md:pt-0 md:pl-3">
                {vocabResult.examples.map((ex, idx) => (
                  <div key={ex}>
                    <p className="text-foreground">{ex}</p>
                    {vocabResult.examplesZh?.[idx] ? (
                      <p className="text-muted-foreground">{vocabResult.examplesZh[idx]}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Main Split-Screen Area */}
      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        {/* Left Panel: Reading Passage */}
        <section
          aria-label="Reading Passage"
          className={`min-h-0 overflow-y-auto border-r border-border px-4 py-5 md:px-7 ${
            mobileTab === 'questions' ? 'hidden lg:block' : 'block'
          }`}
        >
          {currentPassage ? (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {isZh ? `阅读篇章 ${currentPassage.index}` : `Reading Passage ${currentPassage.index}`} · {currentPassage.wordCount}{' '}
                    {isZh ? '词' : 'words'}
                  </span>
                  <h2 className="mt-2 font-display text-2xl leading-snug tracking-tight">{currentPassage.title}</h2>
                  {currentPassage.subtitle ? (
                    <p className="mt-1 text-xs text-muted-foreground">{currentPassage.subtitle}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="Bookmark passage"
                  aria-pressed={Boolean(bookmarks[currentPassage.id])}
                  onClick={() => toggleBookmark(currentPassage.id)}
                  className="rounded-full border border-border p-2 hover:bg-muted"
                >
                  <Bookmark
                    className={`size-4 ${bookmarks[currentPassage.id] ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
                  />
                </button>
              </div>

              {/* Selection Highlight & Vocab Toolbar */}
              {selectedText ? (
                <div className="sticky top-2 z-20 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/40 bg-card/95 px-3 py-2 text-xs shadow-md backdrop-blur">
                  <span className="max-w-xs truncate font-medium">“{selectedText}”</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-amber-300 hover:bg-amber-500/30"
                      onClick={() => addHighlight('amber')}
                    >
                      <Highlighter className="size-3" />
                      {isZh ? '黄色高亮' : 'Highlight'}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-emerald-300 hover:bg-emerald-500/30"
                      onClick={() => addHighlight('emerald')}
                    >
                      <Highlighter className="size-3" />
                      {isZh ? '绿色标注' : 'Green'}
                    </button>
                    {assistanceAllowed ? <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-1 text-primary hover:bg-primary/30"
                      onClick={() => void handleLookupVocab(selectedText)}
                    >
                      <Sparkles className="size-3" />
                      {isZh ? 'AI 查词' : 'AI Lookup'}
                    </button> : null}
                  </div>
                </div>
              ) : null}

              {/* Active Highlights Bar */}
              {highlights.filter((h) => h.passageId === currentPassage.id).length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-2xl bg-muted/40 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{isZh ? '已标注重点：' : 'Highlights:'}</span>
                  {highlights
                    .filter((h) => h.passageId === currentPassage.id)
                    .map((h) => (
                      <span
                        key={h.id}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs"
                      >
                        <strong className="text-primary">[{h.paragraphLabel}]</strong>{' '}
                        <span className="max-w-36 truncate">{h.text}</span>
                        <button
                          type="button"
                          aria-label={`Remove highlight ${h.text}`}
                          onClick={() => removeHighlight(h.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </span>
                    ))}
                </div>
              ) : null}

              {/* Paragraphs */}
              <div className={`mt-5 flex flex-col gap-5 ${FONT_SIZE_CLASS[fontSize]}`}>
                {currentPassage.paragraphs.map((para) => {
                  const isEvidenceTarget =
                    focusedEvidence?.passageId === currentPassage.id && focusedEvidence.paragraphLabel === para.label
                  const paraHighlights = highlights.filter(
                    (h) => h.passageId === currentPassage.id && h.paragraphLabel === para.label,
                  )
                  return (
                    <article
                      key={para.label}
                      id={`passage-${currentPassage.id}-para-${para.label}`}
                      onMouseUp={() => handlePassageSelection(para.label, para.text)}
                      className={`rounded-2xl border p-4 transition-colors ${
                        isEvidenceTarget
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border/60 bg-background/40 hover:border-border'
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="grid size-6 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                            {para.label}
                          </span>
                          {para.heading ? <span className="text-sm font-medium text-primary">{para.heading}</span> : null}
                        </span>
                        {isEvidenceTarget ? (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            {isZh ? '出题依据段落' : 'Evidence Paragraph'}
                          </span>
                        ) : null}
                      </div>
                      <p className="select-text">
                        <HighlightedParagraphText
                          text={para.text}
                          highlights={paraHighlights}
                          evidenceQuote={isEvidenceTarget ? focusedEvidence?.quote : undefined}
                        />
                      </p>
                    </article>
                  )
                })}
              </div>
            </div>
          ) : null}
        </section>

        {/* Right Panel: Questions */}
        <section
          aria-label="Reading Questions"
          className={`min-h-0 overflow-y-auto px-4 py-5 md:px-7 ${
            mobileTab === 'passage' ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="flex flex-col gap-5">
            {passageQuestions.map((q, idx) => {
              const prevQ = idx > 0 ? passageQuestions[idx - 1] : null
              const showGroupHeader = q.groupInstruction && q.groupInstruction !== prevQ?.groupInstruction
              const showContextBox = Boolean(q.contextText)
              const currentAnswer = answers[q.id] ?? ''
              const isFlagged = Boolean(flags[q.id])
              const isActive = q.id === activeQuestionId

              const checkResult: ReadingQuestionResult | undefined = isSubmitted
                ? submittedResultsByQ[q.id]
                : practiceChecks[q.id]
              const aiExp = aiExplanations[q.id]
              const wordCount = countAnswerWords(currentAnswer)
              const overWordLimit = Boolean(q.wordLimit && wordCount > q.wordLimit)

              return (
                <div key={q.id} className="flex flex-col gap-3">
                  {showGroupHeader ? (
                    <div className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3">
                      <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                        {QUESTION_TYPE_LABELS[q.type]?.[isZh ? 'zh' : 'en'] ?? q.type}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">{q.groupInstruction}</p>
                    </div>
                  ) : null}

                  {showContextBox ? (
                    <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-line">
                      {q.contextText}
                    </div>
                  ) : null}

                  <div
                    id={`reading-q-${q.id}`}
                    onClick={() => setActiveQuestionId(q.id)}
                    className={`rounded-2xl border p-4 transition-colors ${
                      isActive ? 'border-primary bg-card shadow-sm' : 'border-border bg-background/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                            checkResult
                              ? checkResult.correct
                                ? 'bg-emerald-500 text-white'
                                : 'bg-destructive text-white'
                              : currentAnswer.trim()
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {q.number}
                        </span>
                        <p className="text-sm font-medium leading-relaxed">{q.prompt}</p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Flag question ${q.number} for review`}
                        aria-pressed={isFlagged}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFlag(q.id)
                        }}
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${
                          isFlagged
                            ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Flag className="mr-1 inline size-3" />
                        {isZh ? '标记' : 'Flag'}
                      </button>
                    </div>

                    {/* Interactive Answer Input by Question Type */}
                    <div className="mt-3 pl-9">
                      <QuestionControl
                        question={q}
                        value={currentAnswer}
                        disabled={isSubmitted || examExpired || submitting}
                        overWordLimit={overWordLimit}
                        wordCount={wordCount}
                        isZh={isZh}
                        onChange={(val) => setAnswer(q.id, val)}
                      />

                      {/* Practice Mode Instant Actions */}
                      {!isExamMode && !isSubmitted ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-full text-xs"
                            disabled={!currentAnswer.trim() || checkingId === q.id}
                            onClick={() => void handlePracticeCheck(q)}
                          >
                            {checkingId === q.id
                              ? isZh
                                ? '核对中…'
                                : 'Checking…'
                              : isZh
                                ? '立即核对答案'
                                : 'Check Answer'}
                          </Button>
                          {checkResult ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 rounded-full text-xs"
                              onClick={() => handleRetryQuestion(q.id)}
                            >
                              <RotateCcw className="mr-1 size-3" />
                              {isZh ? '重做此题' : 'Retry'}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}

                      {/* Feedback & Explanation Box (Practice Mode Check or Post-Submit Review) */}
                      {checkResult ? (
                        <div
                          className={`mt-3 rounded-2xl border p-3.5 text-xs leading-relaxed ${
                            checkResult.correct
                              ? 'border-emerald-500/40 bg-emerald-500/10'
                              : 'border-destructive/40 bg-destructive/10'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="inline-flex items-center gap-1.5 font-semibold">
                              {checkResult.correct ? (
                                <>
                                  <CheckCircle2 className="size-4 text-emerald-400" />
                                  <span className="text-emerald-300">{isZh ? '回答正确' : 'Correct'}</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="size-4 text-rose-400" />
                                  <span className="text-rose-300">
                                    {isZh ? '回答有误' : 'Incorrect'} · {isZh ? '正确答案：' : 'Correct Answer: '}
                                    <strong className="underline">{checkResult.correctAnswer}</strong>
                                  </span>
                                </>
                              )}
                            </p>
                            <div className="flex items-center gap-1.5">
                              {checkResult.evidenceParagraph ? (
                                <button
                                  type="button"
                                  className="rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/30"
                                  onClick={() =>
                                    jumpToEvidence(q.passageId, checkResult.evidenceParagraph!, checkResult.evidenceQuote)
                                  }
                                >
                                  {isZh
                                    ? `定位原文 ${checkResult.evidenceParagraph} 段`
                                    : `Locate Paragraph ${checkResult.evidenceParagraph}`}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-background px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                                disabled={explainingId === q.id}
                                onClick={() => void handleExplainWithAI(q)}
                              >
                                <Sparkles className="size-3" />
                                {explainingId === q.id
                                  ? isZh
                                    ? 'AI 解析中…'
                                    : 'AI Thinking…'
                                  : isZh
                                    ? 'AI 深度精讲'
                                    : 'AI Deep Explain'}
                              </button>
                            </div>
                          </div>

                          {checkResult.explanation ? <p className="mt-2 text-foreground">{checkResult.explanation}</p> : null}
                          {checkResult.explanationZh ? (
                            <p className="mt-1 text-muted-foreground">{checkResult.explanationZh}</p>
                          ) : null}
                          {checkResult.evidenceQuote ? (
                            <blockquote className="mt-2 border-l-2 border-primary pl-2.5 italic text-muted-foreground">
                              “{checkResult.evidenceQuote}”
                            </blockquote>
                          ) : null}

                          {aiExp ? (
                            <div className="mt-3 rounded-xl border border-primary/30 bg-card p-3">
                              <p className="text-[11px] font-semibold text-primary uppercase">
                                {isZh ? 'AI 考官诊断' : 'AI Examiner Breakdown'}
                              </p>
                              <p className="mt-1">
                                <strong>{isZh ? '为什么正确：' : 'Why Correct: '}</strong>
                                {aiExp.whyCorrect}
                              </p>
                              <p className="mt-1">
                                <strong>{isZh ? '错因诊断：' : 'Your Answer Analysis: '}</strong>
                                {aiExp.whyWrong}
                              </p>
                              {aiExp.chineseSummary ? <p className="mt-1 text-primary">{aiExp.chineseSummary}</p> : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* Bottom Question Navigation Palette */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/50 px-4 py-2.5">
        <div className="flex flex-1 items-center gap-1 overflow-x-auto py-0.5" aria-label="Question Palette">
          {questions.map((q) => {
            const answered = Boolean(answers[q.id]?.trim())
            const flagged = Boolean(flags[q.id])
            const active = q.id === activeQuestionId
            const checkRes = isSubmitted ? submittedResultsByQ[q.id] : practiceChecks[q.id]
            return (
              <button
                key={q.id}
                type="button"
                aria-label={`Question ${q.number}`}
                aria-current={active ? 'step' : undefined}
                onClick={() => jumpToQuestion(q)}
                className={`relative grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold tabular-nums transition-all ${
                  active ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
                } ${
                  checkRes
                    ? checkRes.correct
                      ? 'bg-emerald-500 text-white'
                      : 'bg-destructive text-white'
                    : answered
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                {q.number}
                {flagged ? (
                  <span
                    className="absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-400 ring-1 ring-background"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full text-xs"
            disabled={activeQuestionIndex <= 0}
            onClick={() => {
              const prev = questions[activeQuestionIndex - 1]
              if (prev) jumpToQuestion(prev)
            }}
          >
            <ChevronLeft className="size-3.5" />
            {isZh ? '上一题' : 'Prev'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full text-xs"
            disabled={activeQuestionIndex + 1 >= questions.length}
            onClick={() => {
              const next = questions[activeQuestionIndex + 1]
              if (next) jumpToQuestion(next)
            }}
          >
            {isZh ? '下一题' : 'Next'}
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </footer>
    </div>,
    document.body,
  )
}

function QuestionControl({
  question,
  value,
  disabled,
  overWordLimit,
  wordCount,
  isZh,
  onChange,
}: {
  question: ReadingQuestion
  value: string
  disabled: boolean
  overWordLimit: boolean
  wordCount: number
  isZh: boolean
  onChange: (next: string) => void
}) {
  const options = question.options ?? []

  if (question.type === 'tfng' || question.type === 'ynng') {
    const choices = question.type === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN']
    return (
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Question ${question.number}`}>
        {choices.map((choice) => {
          const selected = value.toUpperCase() === choice
          return (
            <button
              key={choice}
              type="button"
              disabled={disabled}
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(choice)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:border-primary/50'
              }`}
            >
              {choice}
            </button>
          )
        })}
      </div>
    )
  }

  if (question.type === 'multiple_choice') {
    return (
      <div className="flex flex-col gap-2" role="radiogroup" aria-label={`Question ${question.number}`}>
        {options.map((option) => {
          const letter = option.split('.')[0]?.trim() ?? option
          const selected = value === letter || value === option
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(letter)}
              className={`rounded-xl border px-3.5 py-2.5 text-left text-xs leading-relaxed transition-colors ${
                selected
                  ? 'border-primary bg-primary/15 font-medium text-foreground'
                  : 'border-border bg-card text-foreground hover:border-primary/40'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    )
  }

  if (
    question.type === 'matching_headings' ||
    question.type === 'matching_information' ||
    question.type === 'matching_features' ||
    question.type === 'matching_sentence_endings'
  ) {
    if (options.length <= 6 && options.every((opt) => opt.length <= 3)) {
      return (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Question ${question.number}`}>
          {options.map((opt) => {
            const selected = value === opt
            return (
              <button
                key={opt}
                type="button"
                disabled={disabled}
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(opt)}
                className={`grid h-8 min-w-9 place-items-center rounded-lg border px-2.5 text-xs font-semibold ${
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:border-primary/50'
                }`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      )
    }
    return (
      <select
        aria-label={`Answer for question ${question.number}`}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs outline-none focus:border-primary"
      >
        <option value="">{isZh ? '— 请选择配对项 —' : '— Select matching option —'}</option>
        {options.map((opt) => {
          const code = opt.split('.')[0]?.trim() || opt
          return (
            <option key={opt} value={code}>
              {opt}
            </option>
          )
        })}
      </select>
    )
  }

  // Completion & Short Answer Questions
  return (
    <div>
      <input
        type="text"
        aria-label={`Answer for question ${question.number}`}
        disabled={disabled}
        value={value}
        placeholder={
          question.wordLimit
            ? isZh
              ? `填写答案（不超过 ${question.wordLimit} 个词）`
              : `Type your answer (NO MORE THAN ${question.wordLimit} WORDS)`
            : isZh
              ? '填写答案'
              : 'Type your answer'
        }
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 w-full max-w-md rounded-xl border bg-card px-3.5 text-sm outline-none ${
          overWordLimit ? 'border-destructive focus:border-destructive' : 'border-border focus:border-primary'
        }`}
      />
      {question.wordLimit ? (
        <p className={`mt-1 text-[11px] ${overWordLimit ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
          {wordCount}/{question.wordLimit} {isZh ? '词上限' : 'words max'}
          {overWordLimit
            ? isZh
              ? '（超出字数限制，判分时将视为错误）'
              : ' (Exceeds word limit!)'
            : ''}
        </p>
      ) : null}
    </div>
  )
}

function HighlightedParagraphText({
  text,
  highlights,
  evidenceQuote,
}: {
  text: string
  highlights: ReadingHighlight[]
  evidenceQuote?: string
}) {
  const target = evidenceQuote?.trim() || highlights[0]?.text?.trim()
  if (!target) return <>{text}</>
  const idx = text.toLowerCase().indexOf(target.toLowerCase())
  if (idx < 0) return <>{text}</>
  const end = idx + target.length
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-primary/25 px-1 py-0.5 font-medium text-foreground underline decoration-primary decoration-2">
        {text.slice(idx, end)}
      </mark>
      {text.slice(end)}
    </>
  )
}
