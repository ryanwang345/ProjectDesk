import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  Download,
  ExternalLink,
  FastForward,
  Flag,
  Flame,
  Headphones,
  History,
  Keyboard,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Rewind,
  Sparkles,
  Target,
  Upload,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react'
import { Pronunciation } from '@/components/pronunciation'
import { InteractiveGlossText } from '@/components/interactive-gloss-text'
import { Button } from '@/components/ui/button'
import { useLearningProgress, recordVocabularyCompletion } from '@/hooks/use-learning-progress'
import { useI18n } from '@/i18n'
import { loadProgress } from '@/lib/lesson'
import {
  formatAccentBadge,
  isListeningAnswerCorrect,
  LISTENING_QUESTION_TYPE_LABELS,
  LISTENING_TESTS,
  loadListeningHistory,
  saveListeningAttempt,
  type ListeningAttemptRecord,
  type ListeningPart,
  type ListeningTest,
  type ListeningTranscriptSegment,
} from '@/lib/listening'
import { formatDurationClock } from '@/lib/reading'
import { stopSpeech } from '@/lib/speech'
import { cn } from '@/lib/utils'

type ListeningMode = 'practice' | 'exam'
type CategoryFilter = 'all' | 'full' | 'part1' | 'part2' | 'part3' | 'part4' | 'history'
type LeftPanelTab = 'transcript' | 'dictation' | 'map'
type PlaybackRateOption = 0.8 | 1.0 | 1.2

export function ListeningPage() {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  const sharedLearning = useLearningProgress()
  const fallbackProgress = loadProgress()
  const progress = sharedLearning.progress ?? fallbackProgress

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [selectedMode, setSelectedMode] = useState<ListeningMode>('practice')
  const [history, setHistory] = useState<ListeningAttemptRecord[]>(() => loadListeningHistory())

  // Active exam/practice session state
  const [activeTest, setActiveTest] = useState<ListeningTest | null>(null)
  const [sessionMode, setSessionMode] = useState<ListeningMode>('practice')
  const [activePartIndex, setActivePartIndex] = useState(0)
  const [activeQuestionNumber, setActiveQuestionNumber] = useState<number>(1)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [flagged, setFlagged] = useState<Record<number, boolean>>({})
  const [revealedQuestions, setRevealedQuestions] = useState<Record<number, boolean>>({})
  const [completedRecord, setCompletedRecord] = useState<ListeningAttemptRecord | null>(null)

  // Real HTML5 <audio> playback state
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const snippetEndRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [customAudioByPart, setCustomAudioByPart] = useState<
    Record<number, { url: string; name: string }>
  >({})
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [trackDuration, setTrackDuration] = useState<number>(0)
  const [playbackRate, setPlaybackRate] = useState<PlaybackRateOption>(1.0)
  const [isMuted, setIsMuted] = useState(false)

  // Exam timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(1800)

  // Left workbench panel controls
  const [leftTab, setLeftTab] = useState<LeftPanelTab>('transcript')
  const [showChineseTranscript, setShowChineseTranscript] = useState(true)
  const [highlightCues, setHighlightCues] = useState(true)
  const [scratchpad, setScratchpad] = useState('')

  // Dictation lab state
  const [dictationSegmentId, setDictationSegmentId] = useState<string>('')
  const [dictationInput, setDictationInput] = useState('')
  const [dictationChecked, setDictationChecked] = useState(false)

  const currentPart: ListeningPart | undefined = activeTest?.parts[activePartIndex]
  const activeAudioSource = useMemo(() => {
    if (!currentPart) return ''
    return customAudioByPart[currentPart.partNumber]?.url ?? currentPart.audioUrl
  }, [currentPart, customAudioByPart])

  const effectiveDuration = useMemo(() => {
    if (trackDuration > 0 && Number.isFinite(trackDuration)) {
      return Math.ceil(trackDuration)
    }
    return currentPart?.durationSeconds ?? 120
  }, [trackDuration, currentPart])

  const allTestQuestions = useMemo(
    () => activeTest?.parts.flatMap((part) => part.questions) ?? [],
    [activeTest],
  )

  const currentSegment = useMemo(() => {
    if (!currentPart) return null
    return (
      currentPart.segments.find(
        (seg) => currentTime >= seg.startTime && currentTime < seg.endTime,
      ) ?? currentPart.segments[0] ?? null
    )
  }, [currentPart, currentTime])

  // Clean up audio on unmount
  useEffect(() => {
    const audioEl = audioRef.current
    return () => {
      stopSpeech()
      audioEl?.pause()
    }
  }, [])

  // Keep <audio> playbackRate and mute state synchronized
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.playbackRate = playbackRate
    el.preservesPitch = true
    el.muted = isMuted
  }, [playbackRate, isMuted, activeAudioSource])

  // Fallback progression in headless environments where <audio> does not advance on its own
  useEffect(() => {
    if (!isPlaying || !currentPart || completedRecord) return
    const timer = window.setInterval(() => {
      const el = audioRef.current
      if (el && !el.paused && el.currentTime > 0) {
        return
      }
      setCurrentTime((prev) => {
        const next = prev + playbackRate
        if (snippetEndRef.current && next >= snippetEndRef.current) {
          snippetEndRef.current = null
          setIsPlaying(false)
          return prev
        }
        if (next >= effectiveDuration) {
          setIsPlaying(false)
          return effectiveDuration
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [isPlaying, currentPart, playbackRate, effectiveDuration, completedRecord])

  // Session elapsed/countdown clock
  useEffect(() => {
    if (!activeTest || completedRecord) return
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
      if (sessionMode === 'exam') {
        setRemainingSeconds((prev) => (prev <= 1 ? 0 : prev - 1))
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [activeTest, completedRecord, sessionMode])

  function stopAllAudio() {
    stopSpeech()
    snippetEndRef.current = null
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setIsPlaying(false)
  }

  function startListeningSession(test: ListeningTest, mode: ListeningMode) {
    stopAllAudio()
    const firstPart = test.parts[0]
    const firstQuestion = firstPart?.questions[0]?.questionNumber ?? 1
    const firstDialogueSeg =
      firstPart?.segments.find((s) => !s.isIntro) ?? firstPart?.segments[0]
    setActiveTest(test)
    setSessionMode(mode)
    setActivePartIndex(0)
    setActiveQuestionNumber(firstQuestion)
    setAnswers({})
    setFlagged({})
    setRevealedQuestions({})
    setCompletedRecord(null)
    setCurrentTime(0)
    setTrackDuration(firstPart?.durationSeconds ?? 120)
    setElapsedSeconds(0)
    setRemainingSeconds(test.durationSeconds)
    setLeftTab(firstPart?.hasMapDiagram ? 'map' : 'transcript')
    setDictationSegmentId(firstDialogueSeg?.id ?? '')
    setDictationInput('')
    setDictationChecked(false)
  }

  function handleSelectPart(index: number) {
    if (!activeTest) return
    const nextPart = activeTest.parts[index]
    if (!nextPart) return
    stopAllAudio()
    setActivePartIndex(index)
    setCurrentTime(0)
    setTrackDuration(nextPart.durationSeconds)
    setActiveQuestionNumber(nextPart.questions[0]?.questionNumber ?? 1)
    if (nextPart.hasMapDiagram) {
      setLeftTab('map')
    } else if (leftTab === 'map') {
      setLeftTab('transcript')
    }
    const firstDialogueSeg =
      nextPart.segments.find((s) => !s.isIntro) ?? nextPart.segments[0]
    setDictationSegmentId(firstDialogueSeg?.id ?? '')
    setDictationInput('')
    setDictationChecked(false)
  }

  function togglePlayPause() {
    if (!currentPart) return
    const el = audioRef.current
    if (isPlaying) {
      stopAllAudio()
      return
    }
    snippetEndRef.current = null
    if (currentTime >= effectiveDuration - 0.5) {
      setCurrentTime(0)
      if (el) el.currentTime = 0
    }
    setIsPlaying(true)
    if (el) {
      el.playbackRate = playbackRate
      el.preservesPitch = true
      void el.play().catch(() => {
        /* Fallback timer handles headless browsers */
      })
    }
  }

  function seekToTime(seconds: number) {
    const clamped = Math.max(0, Math.min(effectiveDuration, seconds))
    snippetEndRef.current = null
    setCurrentTime(clamped)
    if (audioRef.current) {
      audioRef.current.currentTime = clamped
    }
  }

  function playSegmentSlice(
    seg: ListeningTranscriptSegment,
    stopAtEnd = false,
    overrideRate?: PlaybackRateOption,
  ) {
    stopSpeech()
    if (overrideRate) {
      setPlaybackRate(overrideRate)
    }
    snippetEndRef.current = stopAtEnd ? seg.endTime : null
    setCurrentTime(seg.startTime)
    setIsPlaying(true)
    const el = audioRef.current
    if (el) {
      el.currentTime = seg.startTime
      el.playbackRate = overrideRate ?? playbackRate
      el.preservesPitch = true
      void el.play().catch(() => {
        /* Fallback timer handles headless browsers */
      })
    }
  }

  function playResultsEvidenceSlice(part: ListeningPart, seg?: ListeningTranscriptSegment) {
    if (!seg) return
    const el = audioRef.current
    if (!el) return
    const targetSrc = customAudioByPart[part.partNumber]?.url ?? part.audioUrl
    if (!el.src.endsWith(targetSrc)) {
      el.src = targetSrc
    }
    snippetEndRef.current = seg.endTime
    el.currentTime = seg.startTime
    el.playbackRate = 1.0
    el.preservesPitch = true
    setIsPlaying(true)
    void el.play().catch(() => {})
  }

  function handleCustomAudioUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !currentPart) return
    stopAllAudio()
    const objectUrl = URL.createObjectURL(file)
    setCustomAudioByPart((prev) => ({
      ...prev,
      [currentPart.partNumber]: {
        url: objectUrl,
        name: file.name,
      },
    }))
    setCurrentTime(0)
    event.target.value = ''
  }

  function handleSubmitSession() {
    if (!activeTest) return
    stopAllAudio()
    const record = saveListeningAttempt(activeTest, sessionMode, answers, elapsedSeconds)
    setCompletedRecord(record)
    setHistory(loadListeningHistory())
    if (record.correctCount > 0) {
      void recordVocabularyCompletion(1, Math.min(5, Math.max(1, record.correctCount))).catch(() => {})
    }
  }

  // Compute summary stats for dashboard
  const bestBand = useMemo(() => {
    if (history.length === 0) return null
    return Math.max(...history.map((item) => item.estimatedBand))
  }, [history])

  const totalQuestionsAnswered = useMemo(
    () => history.reduce((sum, item) => sum + item.totalQuestions, 0),
    [history],
  )

  const filteredTests = useMemo(() => {
    if (categoryFilter === 'all' || categoryFilter === 'history') return LISTENING_TESTS
    return LISTENING_TESTS.filter((test) => test.category === categoryFilter)
  }, [categoryFilter])

  // Shared hidden <audio> element used in both Exam/Practice and Results views
  const sharedAudioElement = (
    <audio
      ref={audioRef}
      src={activeAudioSource || '/audio/listening/part1.m4a'}
      preload="metadata"
      onLoadedMetadata={(e) => {
        const dur = e.currentTarget.duration
        if (dur && Number.isFinite(dur)) {
          setTrackDuration(dur)
        }
      }}
      onTimeUpdate={(e) => {
        const now = e.currentTarget.currentTime
        setCurrentTime(now)
        if (snippetEndRef.current !== null && now >= snippetEndRef.current) {
          e.currentTarget.pause()
          snippetEndRef.current = null
          setIsPlaying(false)
        }
      }}
      onEnded={() => {
        snippetEndRef.current = null
        setIsPlaying(false)
      }}
      className="hidden"
    />
  )

  // ---------------------------------------------------------------------------
  // VIEW 3: DIAGNOSTIC RESULTS & DISTRACTOR REVIEW
  // ---------------------------------------------------------------------------
  if (activeTest && completedRecord) {
    const accuracyPct = Math.round(
      (completedRecord.correctCount / Math.max(1, completedRecord.totalQuestions)) * 100,
    )

    return (
      <div className="mx-auto max-w-7xl space-y-6" data-testid="listening-results-view">
        {sharedAudioElement}

        {/* Top Back & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/85 px-5 py-3.5">
          <button
            type="button"
            onClick={() => {
              stopAllAudio()
              setActiveTest(null)
              setCompletedRecord(null)
            }}
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {zh ? '返回雅思听力工作台' : 'Back to IELTS Listening Workbench'}
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => startListeningSession(activeTest, 'practice')}
              className="rounded-xl text-xs"
            >
              <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
              {zh ? '进入精听复盘重练' : 'Retry in Practice Mode'}
            </Button>
          </div>
        </div>

        {/* Score Hero Banner */}
        <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/14 via-card/95 to-card p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-0.5 text-[11px] font-semibold text-primary">
                  <Headphones className="size-3.5" aria-hidden="true" />
                  {zh ? 'IELTS 听力诊断报告' : 'IELTS Listening Diagnostic Report'}
                </span>
                <span className="rounded-full border border-border/80 bg-background/60 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  {zh ? '非官方预估分 · 按 40 题标准折算' : 'Unofficial Estimate · Scaled to 40 Questions'}
                </span>
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {zh ? activeTest.titleZh : activeTest.title}
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {zh
                  ? '以下为逐题录音证据句、同义替换映射（Paraphrase Map）与考官自我修正干扰项拆解。点击「重听证据原句」可直接回放考场原声切片。'
                  : 'Review exact spoken evidence, paraphrase mappings, and examiner distractor traps below. Click "Replay Evidence Audio" to hear the exact multi-speaker audio slice.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-primary/30 bg-background/75 px-4 py-3 text-center">
                <span className="block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {zh ? '预估听力 Band' : 'Est. Band'}
                </span>
                <span className="mt-1 block font-mono text-2xl font-bold text-primary">
                  {completedRecord.estimatedBand.toFixed(1)}
                </span>
              </div>
              <div className="rounded-2xl border border-border/80 bg-background/75 px-4 py-3 text-center">
                <span className="block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {zh ? '答对题数' : 'Raw Score'}
                </span>
                <span className="mt-1 block font-mono text-2xl font-bold text-foreground">
                  {completedRecord.correctCount}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{completedRecord.totalQuestions}
                  </span>
                </span>
              </div>
              <div className="rounded-2xl border border-border/80 bg-background/75 px-4 py-3 text-center">
                <span className="block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {zh ? '正确率' : 'Accuracy'}
                </span>
                <span className="mt-1 block font-mono text-2xl font-bold text-foreground">
                  {accuracyPct}%
                </span>
              </div>
              <div className="rounded-2xl border border-border/80 bg-background/75 px-4 py-3 text-center">
                <span className="block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {zh ? '用时' : 'Time Spent'}
                </span>
                <span className="mt-1 block font-mono text-2xl font-bold text-foreground">
                  {formatDurationClock(completedRecord.elapsedSeconds)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Question-by-Question Paraphrase & Distractor Breakdown */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground">
            {zh
              ? '逐题同义替换与干扰项深度复盘 (Paraphrase & Distractor Lab)'
              : 'Question-by-Question Paraphrase & Distractor Analysis'}
          </h2>

          <div className="space-y-4">
            {activeTest.parts.map((part) =>
              part.questions.map((q) => {
                const userAns = completedRecord.answers[q.questionNumber] ?? ''
                const isCorrect = isListeningAnswerCorrect(q, userAns)
                const seg = part.segments.find((s) => s.id === q.evidenceSegmentId)

                return (
                  <article
                    key={q.id}
                    className={cn(
                      'rounded-2xl border p-5 transition',
                      isCorrect
                        ? 'border-border/80 bg-card/85'
                        : 'border-amber-500/35 bg-amber-500/[0.04]',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            'inline-flex size-7 items-center justify-center rounded-lg font-mono text-xs font-bold',
                            isCorrect
                              ? 'bg-primary/15 text-primary'
                              : 'bg-destructive/15 text-destructive',
                          )}
                        >
                          Q{q.questionNumber}
                        </span>
                        <span className="rounded-md border border-border/70 bg-background/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          Part {q.partNumber} ·{' '}
                          {zh
                            ? LISTENING_QUESTION_TYPE_LABELS[q.type].zh
                            : LISTENING_QUESTION_TYPE_LABELS[q.type].en}
                        </span>
                        {seg && (
                          <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                            {seg.speaker} ({formatAccentBadge(seg.accent)}) ·{' '}
                            {formatDurationClock(Math.floor(seg.startTime))}
                          </span>
                        )}
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                            <CheckCircle2 className="size-4" aria-hidden="true" />
                            {zh ? '回答正确' : 'Correct'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                            <XCircle className="size-4" aria-hidden="true" />
                            {zh ? '需攻克干扰项' : 'Needs Review'}
                          </span>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => playResultsEvidenceSlice(part, seg)}
                        className="h-8 rounded-xl border-primary/30 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20"
                      >
                        <Volume2 className="mr-1.5 size-3.5" aria-hidden="true" />
                        {zh ? '重听考场原声切片' : 'Replay Evidence Audio'}
                      </Button>
                    </div>

                    <p className="mt-3 text-sm font-medium text-foreground">
                      {zh ? q.promptZh : q.prompt}
                    </p>

                    {/* User Answer vs Correct Answer */}
                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                      <div
                        className={cn(
                          'rounded-xl border px-3.5 py-2.5 text-xs',
                          isCorrect
                            ? 'border-primary/25 bg-primary/8'
                            : 'border-destructive/30 bg-destructive/8',
                        )}
                      >
                        <span className="block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                          {zh ? '你的作答 (Your Answer)' : 'Your Answer'}
                        </span>
                        <span className="mt-0.5 block font-mono text-sm font-bold text-foreground">
                          {userAns.trim() ? userAns : zh ? '（未作答）' : '(Blank)'}
                        </span>
                      </div>

                      <div className="rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-xs">
                        <span className="block text-[10px] font-semibold tracking-wider text-primary uppercase">
                          {zh ? '官方标准答案 (Correct Answer)' : 'Official Answer Key'}
                        </span>
                        <span className="mt-0.5 block font-mono text-sm font-bold text-primary">
                          {q.correctAnswer}
                        </span>
                      </div>
                    </div>

                    {/* Evidence Quote + Paraphrase + Distractor */}
                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      <div className="rounded-xl border border-border/70 bg-background/50 p-3 text-xs">
                        <span className="font-semibold text-primary">
                          {zh ? '🎙️ 录音原文证据：' : '🎙️ Spoken Evidence:'}
                        </span>
                        <div className="mt-1 font-medium text-foreground">
                          “<InteractiveGlossText text={q.evidenceQuote} />”
                        </div>
                        <p className="mt-1 text-muted-foreground">{q.evidenceQuoteZh}</p>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-background/50 p-3 text-xs">
                        <span className="font-semibold text-emerald-400">
                          {zh ? '🔄 同义替换映射：' : '🔄 Paraphrase Mapping:'}
                        </span>
                        <p className="mt-1 font-mono text-[11px] text-foreground">
                          {q.paraphrase.questionTerm} ↔ {q.paraphrase.spokenTerm}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {zh ? q.paraphrase.explanationZh : q.paraphrase.explanationEn}
                        </p>
                      </div>

                      <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-3 text-xs">
                        <span className="font-semibold text-amber-400">
                          {zh
                            ? `⚠️ 考官干扰项 (${q.distractorTrap.wrongCandidate})：`
                            : `⚠️ Distractor Trap (${q.distractorTrap.wrongCandidate}):`}
                        </span>
                        <p className="mt-1 text-muted-foreground">
                          {zh ? q.distractorTrap.trapZh : q.distractorTrap.trapEn}
                        </p>
                      </div>
                    </div>

                    {/* Key Vocabulary Strip */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/40 px-3.5 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {zh ? '听力核心词' : 'Key Listening Lexis'}
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {q.keyVocab.word}
                        </span>
                        <Pronunciation
                          word={q.keyVocab.word}
                          pronunciation={q.keyVocab.ipa}
                        />
                        <span className="text-muted-foreground">{q.keyVocab.meaningZh}</span>
                      </div>
                    </div>
                  </article>
                )
              }),
            )}
          </div>
        </section>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // VIEW 2: COMPUTER-DELIVERED IELTS LISTENING EXAM & INTENSIVE WORKBENCH
  // ---------------------------------------------------------------------------
  if (activeTest && currentPart) {
    const answeredCount = allTestQuestions.filter(
      (q) => (answers[q.questionNumber] ?? '').trim().length > 0,
    ).length
    const progressPct = Math.min(
      100,
      Math.round((currentTime / Math.max(1, effectiveDuration)) * 100),
    )

    const dictationTargetSegment =
      currentPart.segments.find((s) => s.id === dictationSegmentId) ??
      currentPart.segments.find((s) => !s.isIntro) ??
      currentPart.segments[0]

    const customSourceInfo = customAudioByPart[currentPart.partNumber]

    return (
      <div className="mx-auto max-w-7xl space-y-4" data-testid="listening-exam-view">
        {sharedAudioElement}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleCustomAudioUpload}
          className="hidden"
        />

        {/* Top Sticky IELTS Computer-Delivered Audio & Exam Toolbar */}
        <header className="sticky top-12 z-20 rounded-2xl border border-border/80 bg-card/95 p-3.5 shadow-md backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Exit & Part Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  stopAllAudio()
                  setActiveTest(null)
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-border/80 bg-background/70 px-3 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                {zh ? '退出' : 'Exit'}
              </button>

              <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background/60 p-1">
                {activeTest.parts.map((part, idx) => {
                  const active = idx === activePartIndex
                  return (
                    <button
                      key={part.partNumber}
                      type="button"
                      onClick={() => handleSelectPart(idx)}
                      className={cn(
                        'rounded-lg px-3 py-1 text-xs font-semibold transition',
                        active
                          ? 'bg-primary text-primary-foreground shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Part {part.partNumber}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Center: Real Studio Audio Transport Controls */}
            <div className="flex flex-1 flex-wrap items-center justify-center gap-2.5 px-2">
              <button
                type="button"
                onClick={() => seekToTime(currentTime - 5)}
                disabled={sessionMode === 'exam'}
                title={zh ? '后退 5 秒' : 'Rewind 5s'}
                className="inline-flex size-8 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground transition hover:text-foreground disabled:opacity-40"
              >
                <Rewind className="size-3.5" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                aria-label={
                  isPlaying
                    ? zh
                      ? '暂停听力音频'
                      : 'Pause listening audio'
                    : zh
                      ? '播放听力音频'
                      : 'Play listening audio'
                }
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-[0_0_18px_oklch(0.72_0.17_158/0.35)] transition hover:opacity-95"
              >
                {isPlaying ? (
                  <>
                    <Pause className="size-3.5" aria-hidden="true" />
                    <span>{zh ? '暂停录音' : 'Pause Audio'}</span>
                  </>
                ) : (
                  <>
                    <Play className="size-3.5" aria-hidden="true" />
                    <span>{zh ? '播放真题录音' : 'Play Exam Audio'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => seekToTime(currentTime + 5)}
                disabled={sessionMode === 'exam'}
                title={zh ? '快进 5 秒' : 'Forward 5s'}
                className="inline-flex size-8 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground transition hover:text-foreground disabled:opacity-40"
              >
                <FastForward className="size-3.5" aria-hidden="true" />
              </button>

              {/* Scrubber Bar with Question Cue Markers */}
              <div className="flex min-w-[180px] flex-1 max-w-sm flex-col gap-1">
                <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>{formatDurationClock(Math.floor(currentTime))}</span>
                  <span className="truncate px-1 font-sans text-[11px] font-semibold text-primary">
                    {currentSegment
                      ? `${currentSegment.speaker} · ${formatAccentBadge(currentSegment.accent)}`
                      : ''}
                  </span>
                  <span>{formatDurationClock(effectiveDuration)}</span>
                </div>
                <div
                  className="relative h-2.5 w-full cursor-pointer overflow-hidden rounded-full bg-muted"
                  onClick={(e) => {
                    if (sessionMode === 'exam') return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const ratio = Math.max(
                      0,
                      Math.min(1, (e.clientX - rect.left) / rect.width),
                    )
                    seekToTime(ratio * effectiveDuration)
                  }}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                  {/* Question Cue Markers on Scrubber (Practice mode) */}
                  {sessionMode === 'practice' &&
                    currentPart.segments
                      .filter((s) => (s.questionNumbers?.length ?? 0) > 0)
                      .map((s) => {
                        const leftPct = Math.min(
                          98,
                          Math.max(2, (s.startTime / Math.max(1, effectiveDuration)) * 100),
                        )
                        return (
                          <span
                            key={s.id}
                            style={{ left: `${leftPct}%` }}
                            title={`Q${s.questionNumbers?.join(', Q')} @ ${formatDurationClock(Math.floor(s.startTime))}`}
                            className="absolute top-0 h-full w-1 bg-amber-400/90"
                          />
                        )
                      })}
                </div>
              </div>

              {/* Speed Selector (0.8x / 1.0x / 1.2x) */}
              {sessionMode === 'practice' && (
                <button
                  type="button"
                  onClick={() =>
                    setPlaybackRate((r) => (r === 1.0 ? 0.8 : r === 0.8 ? 1.2 : 1.0))
                  }
                  className="rounded-lg border border-border/70 bg-background/70 px-2.5 py-1 font-mono text-[11px] font-semibold text-foreground"
                  title={zh ? '切换倍速 (0.8x / 1.0x / 1.2x)' : 'Cycle playback speed'}
                >
                  {playbackRate.toFixed(1)}x
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition',
                  !isMuted
                    ? 'border-primary/35 bg-primary/12 text-primary'
                    : 'border-border/70 bg-background/60 text-muted-foreground',
                )}
              >
                {isMuted ? (
                  <VolumeX className="size-3.5" aria-hidden="true" />
                ) : (
                  <Volume2 className="size-3.5" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">
                  {customSourceInfo
                    ? customSourceInfo.name.slice(0, 14)
                    : zh
                      ? '多角色实录音轨'
                      : 'Multi-Voice Track'}
                </span>
              </button>

              {/* Download Built-in M4A or Load Custom MP3 */}
              <a
                href={activeAudioSource}
                download={`ielts-listening-part-${currentPart.partNumber}.m4a`}
                title={zh ? '下载本部分真题级录音文件 (.m4a)' : 'Download Part Audio (.m4a)'}
                className="inline-flex size-8 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              >
                <Download className="size-3.5" aria-hidden="true" />
              </a>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={
                  zh
                    ? '导入本地剑桥雅思 MP3/M4A 音频文件'
                    : 'Load local Cambridge IELTS MP3/M4A audio file'
                }
                className="inline-flex size-8 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              >
                <Upload className="size-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Right: Timer, Progress & Submit */}
            <div className="flex items-center gap-2.5">
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/70 px-3 py-1.5 font-mono text-xs font-semibold text-foreground">
                <Clock className="size-3.5 text-primary" aria-hidden="true" />
                <span>
                  {sessionMode === 'exam'
                    ? formatDurationClock(remainingSeconds)
                    : formatDurationClock(elapsedSeconds)}
                </span>
              </div>

              <span className="hidden rounded-xl border border-border/70 bg-background/60 px-2.5 py-1.5 font-mono text-xs text-muted-foreground sm:inline-block">
                {answeredCount} / {allTestQuestions.length} {zh ? '已填' : 'ans'}
              </span>

              <Button
                type="button"
                size="sm"
                onClick={handleSubmitSession}
                className="rounded-xl px-4 text-xs font-bold"
              >
                {zh ? '交卷并查看精析' : 'Submit & Review'}
              </Button>
            </div>
          </div>
        </header>

        {/* Split-Screen Main Area */}
        <div className="grid gap-5 lg:grid-cols-12">
          {/* LEFT PANEL: Context, Interactive Map (Part 2), Synchronized Transcript & Dictation Lab */}
          <div className="space-y-4 lg:col-span-6">
            <div className="rounded-2xl border border-border/80 bg-card/90 p-5">
              {/* Part Header */}
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-3.5">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    <Headphones className="size-3" aria-hidden="true" />
                    {zh ? currentPart.contextLabelZh : currentPart.contextLabel}
                  </span>
                  <h2 className="mt-1.5 font-display text-lg font-bold text-foreground">
                    {zh ? currentPart.titleZh : currentPart.title}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {zh ? currentPart.scenarioDescriptionZh : currentPart.scenarioDescription}
                  </p>
                </div>
              </div>

              {/* Left Panel Mode Tabs */}
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {currentPart.hasMapDiagram && (
                    <button
                      type="button"
                      onClick={() => setLeftTab('map')}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                        leftTab === 'map'
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border/70 bg-background/60 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {zh ? '庄园导览平面图 (Map)' : 'Visitor Map Plan'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setLeftTab('transcript')}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                      leftTab === 'transcript'
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border/70 bg-background/60 text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <BookOpen className="size-3.5" aria-hidden="true" />
                    {sessionMode === 'exam'
                      ? zh
                        ? '考场音频状态与草稿'
                        : 'Exam Audio & Scratchpad'
                      : zh
                        ? '同步双语精听原文'
                        : 'Live Synced Transcript'}
                  </button>

                  {sessionMode === 'practice' && (
                    <button
                      type="button"
                      onClick={() => setLeftTab('dictation')}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                        leftTab === 'dictation'
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border/70 bg-background/60 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Keyboard className="size-3.5" aria-hidden="true" />
                      {zh ? '句子精听听写舱' : 'Sentence Dictation Lab'}
                    </button>
                  )}
                </div>

                {leftTab === 'transcript' && sessionMode === 'practice' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowChineseTranscript((v) => !v)}
                      className={cn(
                        'rounded-lg border px-2 py-1 text-[11px] font-medium transition',
                        showChineseTranscript
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-border/70 text-muted-foreground',
                      )}
                    >
                      {zh ? '双语译文' : 'CN Gloss'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHighlightCues((v) => !v)}
                      className={cn(
                        'rounded-lg border px-2 py-1 text-[11px] font-medium transition',
                        highlightCues
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-border/70 text-muted-foreground',
                      )}
                    >
                      {zh ? '答案句线索' : 'Cue Tags'}
                    </button>
                    <span className="hidden items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2 py-1 text-[11px] font-medium text-emerald-400 sm:inline-flex">
                      <Sparkles className="size-3 text-emerald-400" aria-hidden="true" />
                      {zh ? '点击词汇查小词典' : 'Click word for dictionary'}
                    </span>
                  </div>
                )}
              </div>

              {/* TAB CONTENT 1: INTERACTIVE ARCHITECTURAL MAP FOR PART 2 */}
              {leftTab === 'map' && currentPart.hasMapDiagram && (
                <div className="mt-4 space-y-3" data-testid="listening-map-diagram">
                  <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/8 px-3.5 py-2 text-xs">
                    <span className="font-semibold text-primary">
                      {zh
                        ? '🧭 地图题做题秘诀：先找底部的南门起点 (Main South Gate)，再根据上北下南、左西右东追踪导游路线'
                        : '🧭 Map Tip: Anchor at the Main South Gate at the bottom, then follow North/South/West/East cues.'}
                    </span>
                  </div>

                  {/* Interactive SVG Map of Greenfield Heritage Mill */}
                  <div className="overflow-hidden rounded-2xl border border-border bg-background/80 p-3">
                    <svg
                      viewBox="0 0 560 390"
                      className="h-auto w-full select-none"
                      role="img"
                      aria-label="Greenfield Heritage Mill Visitor Map"
                    >
                      {/* Background Grid */}
                      <rect x="0" y="0" width="560" height="390" rx="16" fill="oklch(0.18 0.02 160)" />

                      {/* Compass Rose (Top Left) */}
                      <g transform="translate(46, 48)">
                        <circle cx="0" cy="0" r="24" fill="oklch(0.23 0.02 160)" stroke="oklch(0.45 0.08 158)" strokeWidth="1.5" />
                        <text x="0" y="-10" textAnchor="middle" fill="oklch(0.82 0.16 158)" fontSize="10" fontWeight="bold">N</text>
                        <text x="0" y="17" textAnchor="middle" fill="oklch(0.70 0.03 160)" fontSize="9">S</text>
                        <text x="-13" y="3" textAnchor="middle" fill="oklch(0.70 0.03 160)" fontSize="9">W</text>
                        <text x="13" y="3" textAnchor="middle" fill="oklch(0.70 0.03 160)" fontSize="9">E</text>
                        <polygon points="0,-7 -4,4 0,1 4,4" fill="oklch(0.75 0.17 158)" />
                      </g>

                      {/* Stream & Mill Pond in Center */}
                      <path
                        d="M 20 155 Q 170 150 265 155 T 540 140"
                        fill="none"
                        stroke="oklch(0.55 0.13 220)"
                        strokeWidth="16"
                        opacity="0.65"
                      />
                      <ellipse
                        cx="265"
                        cy="185"
                        rx="95"
                        ry="42"
                        fill="oklch(0.32 0.08 220)"
                        stroke="oklch(0.60 0.14 220)"
                        strokeWidth="2"
                      />
                      <text x="265" y="185" textAnchor="middle" fill="oklch(0.92 0.04 220)" fontSize="12" fontWeight="bold">
                        MILL POND (磨坊池塘)
                      </text>
                      <text x="265" y="201" textAnchor="middle" fill="oklch(0.78 0.04 220)" fontSize="10">
                        Historic Water Basin
                      </text>

                      {/* Central Cobble Path from South Gate */}
                      <path
                        d="M 265 345 L 265 228"
                        stroke="oklch(0.58 0.04 90)"
                        strokeWidth="18"
                        strokeDasharray="6 3"
                      />
                      <text x="265" y="290" textAnchor="middle" fill="oklch(0.92 0.02 90)" fontSize="10" fontWeight="bold">
                        Central Path
                      </text>

                      {/* Wooden Footbridge North of Pond */}
                      <rect
                        x="295"
                        y="132"
                        width="58"
                        height="26"
                        rx="5"
                        fill="oklch(0.45 0.09 65)"
                        stroke="oklch(0.75 0.12 75)"
                        strokeWidth="2"
                      />
                      <text x="324" y="148" textAnchor="middle" fill="white" fontSize="9.5" fontWeight="bold">
                        Footbridge (木桥)
                      </text>

                      {/* Old Waterwheel Landmark (North-West of Pond) */}
                      <circle
                        cx="165"
                        cy="128"
                        r="20"
                        fill="oklch(0.30 0.05 60)"
                        stroke="oklch(0.75 0.14 75)"
                        strokeWidth="2.5"
                      />
                      <text x="165" y="131" textAnchor="middle" fill="oklch(0.92 0.08 80)" fontSize="9.5" fontWeight="bold">
                        Waterwheel
                      </text>

                      {/* Building C: Beside Old Waterwheel */}
                      <g transform="translate(55, 92)">
                        <rect
                          x="0"
                          y="0"
                          width="82"
                          height="50"
                          rx="8"
                          fill="oklch(0.28 0.08 158)"
                          stroke="oklch(0.74 0.17 158)"
                          strokeWidth="2.5"
                        />
                        <text x="41" y="24" textAnchor="middle" fill="oklch(0.86 0.17 158)" fontSize="15" fontWeight="bold">
                          [ C ]
                        </text>
                        <text x="41" y="40" textAnchor="middle" fill="oklch(0.85 0.03 160)" fontSize="9.5">
                          Beside Wheel
                        </text>
                      </g>

                      {/* Building D: Far North-East Corner across Footbridge */}
                      <g transform="translate(395, 45)">
                        <rect
                          x="0"
                          y="0"
                          width="115"
                          height="56"
                          rx="8"
                          fill="oklch(0.28 0.08 158)"
                          stroke="oklch(0.74 0.17 158)"
                          strokeWidth="2.5"
                        />
                        <text x="57" y="25" textAnchor="middle" fill="oklch(0.86 0.17 158)" fontSize="15" fontWeight="bold">
                          [ D ]
                        </text>
                        <text x="57" y="42" textAnchor="middle" fill="oklch(0.85 0.03 160)" fontSize="9.5">
                          NE Corner · Pines
                        </text>
                      </g>

                      {/* Building A: West of Lower Path before Mill Pond */}
                      <g transform="translate(120, 255)">
                        <rect
                          x="0"
                          y="0"
                          width="105"
                          height="54"
                          rx="8"
                          fill="oklch(0.28 0.08 158)"
                          stroke="oklch(0.74 0.17 158)"
                          strokeWidth="2.5"
                        />
                        <text x="52" y="24" textAnchor="middle" fill="oklch(0.86 0.17 158)" fontSize="15" fontWeight="bold">
                          [ A ]
                        </text>
                        <text x="52" y="41" textAnchor="middle" fill="oklch(0.85 0.03 160)" fontSize="9.5">
                          West of Entrance
                        </text>
                      </g>

                      {/* Building B: East of Lower Path, Directly Opposite A */}
                      <g transform="translate(305, 255)">
                        <rect
                          x="0"
                          y="0"
                          width="105"
                          height="54"
                          rx="8"
                          fill="oklch(0.28 0.08 158)"
                          stroke="oklch(0.74 0.17 158)"
                          strokeWidth="2.5"
                        />
                        <text x="52" y="24" textAnchor="middle" fill="oklch(0.86 0.17 158)" fontSize="15" fontWeight="bold">
                          [ B ]
                        </text>
                        <text x="52" y="41" textAnchor="middle" fill="oklch(0.85 0.03 160)" fontSize="9.5">
                          Opposite A (East)
                        </text>
                      </g>

                      {/* Building E: Far South-East Orchard */}
                      <g transform="translate(435, 275)">
                        <rect
                          x="0"
                          y="0"
                          width="95"
                          height="48"
                          rx="8"
                          fill="oklch(0.24 0.03 160)"
                          stroke="oklch(0.52 0.06 160)"
                          strokeWidth="2"
                        />
                        <text x="47" y="22" textAnchor="middle" fill="oklch(0.82 0.05 160)" fontSize="14" fontWeight="bold">
                          [ E ]
                        </text>
                        <text x="47" y="37" textAnchor="middle" fill="oklch(0.72 0.03 160)" fontSize="9">
                          SE Orchard
                        </text>
                      </g>

                      {/* Main South Gate (Starting Point) */}
                      <g transform="translate(195, 342)">
                        <rect
                          x="0"
                          y="0"
                          width="140"
                          height="34"
                          rx="8"
                          fill="oklch(0.68 0.17 158)"
                        />
                        <text x="70" y="21" textAnchor="middle" fill="oklch(0.14 0.03 160)" fontSize="11" fontWeight="bold">
                          ▲ YOU ARE HERE · SOUTH GATE
                        </text>
                      </g>
                    </svg>
                  </div>
                </div>
              )}

              {/* TAB CONTENT 2: LIVE TRANSCRIPT OR EXAM SCRATCHPAD */}
              {leftTab === 'transcript' && (
                <div className="mt-4 space-y-3">
                  {sessionMode === 'exam' ? (
                    <div className="space-y-4 rounded-2xl border border-border/70 bg-background/60 p-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                          <Headphones className="size-5" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {zh
                              ? '全真机考模式进行中（交卷后解锁双语原文与同义替换精析）'
                              : 'Strict Exam Mode Active (Transcript unlocks upon submission)'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {zh
                              ? '当前正在播放多角色考场实录音轨（含考官导语、提示音及英/美/澳口音）。请边听边在右侧作答。'
                              : 'Playing multi-speaker exam recording with official announcer intro and chime cues. Answer on the right as you listen.'}
                          </p>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="listening-scratchpad"
                          className="block text-xs font-semibold text-muted-foreground"
                        >
                          {zh ? '📝 考场速记草稿本 (Listening Scratchpad)' : '📝 Exam Scratchpad'}
                        </label>
                        <textarea
                          id="listening-scratchpad"
                          rows={6}
                          value={scratchpad}
                          onChange={(e) => setScratchpad(e.target.value)}
                          placeholder={
                            zh
                              ? '在此速记听到的数字、邮编、日期或方位词（例如：150 -> 185, HB4 9LP）...'
                              : 'Jot down numbers, postcodes, or spatial notes here...'
                          }
                          className="mt-1.5 w-full rounded-xl border border-border bg-card p-3 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-[540px] space-y-2.5 overflow-y-auto pr-1">
                      {currentPart.segments.map((seg) => {
                        const isActive = currentSegment?.id === seg.id
                        const hasCues = (seg.questionNumbers?.length ?? 0) > 0

                        return (
                          <div
                            key={seg.id}
                            onClick={() => playSegmentSlice(seg, false)}
                            className={cn(
                              'group cursor-pointer rounded-2xl border p-3.5 transition-all',
                              isActive
                                ? 'border-primary/50 bg-primary/12 shadow-2xs'
                                : seg.isIntro
                                  ? 'border-border/50 bg-background/30 opacity-85 hover:opacity-100'
                                  : 'border-border/70 bg-background/50 hover:border-primary/30 hover:bg-background/80',
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] font-semibold text-primary">
                                  {formatDurationClock(Math.floor(seg.startTime))}
                                </span>
                                <span className="text-xs font-bold text-foreground">
                                  {seg.speaker}
                                </span>
                                <span className="rounded border border-border/70 px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                                  {formatAccentBadge(seg.accent)}
                                </span>
                                {highlightCues &&
                                  hasCues &&
                                  seg.questionNumbers?.map((qNum) => (
                                    <span
                                      key={qNum}
                                      className="rounded-full bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300"
                                    >
                                      {zh ? `第 ${qNum} 题线索` : `Q${qNum} Cue`}
                                    </span>
                                  ))}
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  playSegmentSlice(seg, true)
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary opacity-85 transition group-hover:opacity-100"
                              >
                                <Volume2 className="size-3" aria-hidden="true" />
                                {zh ? '单句切片精听' : 'Play Turn'}
                              </button>
                            </div>

                            <div className="mt-2 text-xs leading-relaxed text-foreground sm:text-sm">
                              <InteractiveGlossText
                                text={seg.text}
                                contextSentence={seg.text}
                              />
                            </div>

                            {showChineseTranscript && (
                              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                                {seg.textZh}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT 3: SENTENCE DICTATION LAB */}
              {leftTab === 'dictation' && sessionMode === 'practice' && dictationTargetSegment && (
                <div className="mt-4 space-y-4 rounded-2xl border border-border/70 bg-background/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        {zh ? '🎯 考场关键句精听听写训练 (Dictation Lab)' : '🎯 Key Sentence Dictation Drill'}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {zh
                          ? '选择包含考点的录音原句，直接回放该句实录切片并默写，专治连读弱读与拼写丢分。'
                          : 'Listen repeatedly to an exam audio slice and type what you hear to master connected speech.'}
                      </p>
                    </div>

                    <select
                      aria-label={zh ? '选择听写句子' : 'Select dictation sentence'}
                      value={dictationTargetSegment.id}
                      onChange={(e) => {
                        setDictationSegmentId(e.target.value)
                        setDictationInput('')
                        setDictationChecked(false)
                      }}
                      className="h-8 rounded-xl border border-border bg-card px-2.5 text-xs font-medium text-foreground"
                    >
                      {currentPart.segments
                        .filter((s) => !s.isIntro)
                        .map((s, i) => (
                          <option key={s.id} value={s.id}>
                            {zh
                              ? `第 ${i + 1} 句 · ${s.speaker} (${formatAccentBadge(s.accent)})`
                              : `Turn ${i + 1} · ${s.speaker} (${formatAccentBadge(s.accent)})`}
                            {s.questionNumbers?.length
                              ? ` [Q${s.questionNumbers.join(', Q')}]`
                              : ''}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => playSegmentSlice(dictationTargetSegment, true, 1.0)}
                      className="rounded-xl text-xs"
                    >
                      <Volume2 className="mr-1.5 size-3.5" aria-hidden="true" />
                      {zh ? '播放本句原音切片 (1.0x)' : 'Play Audio Slice (1.0x)'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => playSegmentSlice(dictationTargetSegment, true, 0.8)}
                      className="rounded-xl text-xs"
                    >
                      {zh ? '慢速重播切片 (0.8x)' : 'Play Slow Slice (0.8x)'}
                    </Button>
                  </div>

                  <textarea
                    rows={3}
                    value={dictationInput}
                    onChange={(e) => {
                      setDictationInput(e.target.value)
                      setDictationChecked(false)
                    }}
                    placeholder={
                      zh
                        ? '在此输入你听到的英文句子（支持部分核心词听写）...'
                        : 'Type the English sentence or key phrases you hear...'
                    }
                    className="w-full rounded-xl border border-border bg-card p-3 text-xs text-foreground focus:border-primary focus:outline-none sm:text-sm"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setDictationChecked(true)}
                      className="rounded-xl text-xs"
                    >
                      {zh ? '核对听写原文' : 'Check Dictation'}
                    </Button>
                  </div>

                  {dictationChecked && (
                    <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/8 p-3.5 text-xs">
                      <p className="font-semibold text-primary">
                        {zh ? '标准录音原文：' : 'Official Transcript:'}
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {dictationTargetSegment.text}
                      </p>
                      <p className="text-muted-foreground">{dictationTargetSegment.textZh}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: OFFICIAL IELTS QUESTION SHEET */}
          <div className="space-y-4 lg:col-span-6">
            <div className="rounded-2xl border border-border/80 bg-card/90 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3.5">
                <div>
                  <span className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                    {zh ? 'OFFICIAL QUESTION SHEET · 答题卷' : 'OFFICIAL QUESTION SHEET'}
                  </span>
                  <h3 className="mt-0.5 font-display text-base font-bold text-foreground">
                    {zh
                      ? `Part ${currentPart.partNumber} 题目区（共 ${currentPart.questions.length} 题）`
                      : `Part ${currentPart.partNumber} Questions (${currentPart.questions.length} items)`}
                  </h3>
                </div>
              </div>

              {/* Optional Matching Features Box (e.g. Part 3 Research Evaluation Findings A-E) */}
              {currentPart.matchingBox && (
                <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/8 p-4">
                  <h4 className="text-xs font-bold tracking-wide text-primary uppercase">
                    {zh ? currentPart.matchingBox.titleZh : currentPart.matchingBox.title}
                  </h4>
                  <div className="mt-2.5 grid gap-1.5">
                    {currentPart.matchingBox.options.map((opt) => (
                      <div
                        key={opt.label}
                        className="flex items-baseline gap-2.5 rounded-lg bg-background/60 px-3 py-1.5 text-xs"
                      >
                        <span className="font-mono font-bold text-primary">{opt.label}</span>
                        <span className="font-medium text-foreground">{opt.text}</span>
                        {zh && (
                          <span className="text-muted-foreground">（{opt.textZh}）</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Questions List */}
              <div className="mt-4 space-y-4">
                {currentPart.questions.map((q) => {
                  const userAns = answers[q.questionNumber] ?? ''
                  const isFlagged = Boolean(flagged[q.questionNumber])
                  const isRevealed = Boolean(revealedQuestions[q.questionNumber])
                  const isCorrect = isListeningAnswerCorrect(q, userAns)
                  const isCurrent = activeQuestionNumber === q.questionNumber

                  return (
                    <div
                      key={q.id}
                      id={`listening-q-${q.questionNumber}`}
                      onClick={() => setActiveQuestionNumber(q.questionNumber)}
                      className={cn(
                        'rounded-2xl border p-4 transition-all',
                        isCurrent
                          ? 'border-primary/45 bg-background/85 shadow-2xs'
                          : 'border-border/75 bg-background/45 hover:border-border',
                      )}
                    >
                      {/* Group Title & Instruction Banner if present on this question */}
                      {q.groupTitle && (
                        <div className="mb-3 border-b border-border/60 pb-2.5">
                          <p className="text-xs font-bold text-foreground">
                            {zh ? q.groupTitleZh : q.groupTitle}
                          </p>
                          {q.instruction && (
                            <p className="mt-0.5 text-[11px] font-semibold text-amber-400">
                              {zh ? q.instructionZh : q.instruction}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex size-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold',
                              userAns.trim()
                                ? 'bg-primary text-primary-foreground'
                                : 'border border-border bg-card text-foreground',
                            )}
                          >
                            {q.questionNumber}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {zh
                              ? LISTENING_QUESTION_TYPE_LABELS[q.type].zh
                              : LISTENING_QUESTION_TYPE_LABELS[q.type].en}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {sessionMode === 'practice' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setRevealedQuestions((prev) => ({
                                  ...prev,
                                  [q.questionNumber]: !prev[q.questionNumber],
                                }))
                              }}
                              className="rounded-lg border border-border/70 bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                            >
                              {isRevealed
                                ? zh
                                  ? '收起精析'
                                  : 'Hide Key'
                                : zh
                                  ? '核对本题'
                                  : 'Check'}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setFlagged((prev) => ({
                                ...prev,
                                [q.questionNumber]: !prev[q.questionNumber],
                              }))
                            }}
                            aria-label={`Flag question ${q.questionNumber}`}
                            className={cn(
                              'inline-flex size-6 items-center justify-center rounded-lg border transition',
                              isFlagged
                                ? 'border-amber-500/40 bg-amber-500/20 text-amber-400'
                                : 'border-border/60 text-muted-foreground hover:text-foreground',
                            )}
                          >
                            <Flag className="size-3" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {/* Question Input Controls by Type */}
                      {q.type === 'note_completion' ? (
                        <div className="mt-3 space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs leading-relaxed text-foreground sm:text-sm">
                            {q.notePrefix && <span>{q.notePrefix}</span>}
                            <input
                              type="text"
                              aria-label={`Question ${q.questionNumber} answer`}
                              value={userAns}
                              onChange={(e) =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [q.questionNumber]: e.target.value,
                                }))
                              }
                              placeholder={
                                zh
                                  ? `填写第 ${q.questionNumber} 题答案...`
                                  : `Q${q.questionNumber} answer...`
                              }
                              className="h-8 min-w-[150px] rounded-xl border border-primary/40 bg-card px-3 font-mono text-xs font-bold text-primary placeholder:font-sans placeholder:font-normal placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                            />
                            {q.noteSuffix && <span>{q.noteSuffix}</span>}
                          </div>
                          {zh && (
                            <p className="text-xs text-muted-foreground">{q.promptZh}</p>
                          )}
                        </div>
                      ) : q.type === 'map_labelling' || q.type === 'matching' ? (
                        <div className="mt-3 space-y-2.5">
                          <p className="text-xs font-semibold text-foreground sm:text-sm">
                            {zh ? q.promptZh : q.prompt}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {(q.options ?? []).map((opt) => {
                              const picked = userAns.toUpperCase() === opt.label
                              return (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() =>
                                    setAnswers((prev) => ({
                                      ...prev,
                                      [q.questionNumber]: opt.label,
                                    }))
                                  }
                                  className={cn(
                                    'inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 font-mono text-xs font-bold transition',
                                    picked
                                      ? 'border-primary bg-primary text-primary-foreground shadow-2xs'
                                      : 'border-border/80 bg-card text-foreground hover:border-primary/40',
                                  )}
                                >
                                  {opt.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        /* Multiple Choice */
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-semibold text-foreground sm:text-sm">
                            {zh ? q.promptZh : q.prompt}
                          </p>
                          <div className="grid gap-1.5">
                            {(q.options ?? []).map((opt) => {
                              const picked = userAns.toUpperCase() === opt.label
                              return (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() =>
                                    setAnswers((prev) => ({
                                      ...prev,
                                      [q.questionNumber]: opt.label,
                                    }))
                                  }
                                  className={cn(
                                    'flex items-start gap-2.5 rounded-xl border px-3 py-2 text-left text-xs transition',
                                    picked
                                      ? 'border-primary/50 bg-primary/14 text-foreground'
                                      : 'border-border/70 bg-card/70 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'inline-flex size-5 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold',
                                      picked
                                        ? 'bg-primary text-primary-foreground'
                                        : 'border border-border bg-background text-foreground',
                                    )}
                                  >
                                    {opt.label}
                                  </span>
                                  <div>
                                    <span className="font-medium text-foreground">
                                      {opt.text}
                                    </span>
                                    {zh && opt.textZh && (
                                      <span className="block text-[11px] text-muted-foreground">
                                        {opt.textZh}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Instant Practice Feedback Drawer */}
                      {sessionMode === 'practice' && isRevealed && (
                        <div className="mt-3 space-y-2 rounded-xl border border-primary/30 bg-primary/8 p-3 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-primary">
                              {userAns.trim()
                                ? isCorrect
                                  ? zh
                                    ? '✓ 回答正确！'
                                    : '✓ Correct!'
                                  : zh
                                    ? `✕ 你的答案：${userAns} · 标准答案：${q.correctAnswer}`
                                    : `✕ Your answer: ${userAns} · Key: ${q.correctAnswer}`
                                : zh
                                  ? `标准答案：${q.correctAnswer}`
                                  : `Official Answer: ${q.correctAnswer}`}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                const seg = currentPart.segments.find(
                                  (s) => s.id === q.evidenceSegmentId,
                                )
                                if (seg) playSegmentSlice(seg, true)
                              }}
                              className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2"
                            >
                              <Volume2 className="size-3" aria-hidden="true" />
                              {zh ? '定位并重听证据原声切片' : 'Replay Evidence Audio Slice'}
                            </button>
                          </div>

                          <div className="text-foreground">
                            “<InteractiveGlossText text={q.evidenceQuote} />”
                          </div>
                          <p className="text-muted-foreground">
                            {zh ? q.paraphrase.explanationZh : q.paraphrase.explanationEn}
                          </p>
                          <p className="text-amber-300">
                            ⚠️ {zh ? q.distractorTrap.trapZh : q.distractorTrap.trapEn}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Computer-Delivered IELTS Question Palette */}
        <footer className="sticky bottom-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/95 px-4 py-2.5 shadow-md backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-1.5">
            {allTestQuestions.map((q) => {
              const hasAns = (answers[q.questionNumber] ?? '').trim().length > 0
              const isFlag = Boolean(flagged[q.questionNumber])
              const isCur = activeQuestionNumber === q.questionNumber

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    const partIdx = activeTest.parts.findIndex(
                      (p) => p.partNumber === q.partNumber,
                    )
                    if (partIdx !== -1 && partIdx !== activePartIndex) {
                      handleSelectPart(partIdx)
                    }
                    setActiveQuestionNumber(q.questionNumber)
                    document
                      .getElementById(`listening-q-${q.questionNumber}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}
                  className={cn(
                    'relative inline-flex size-7 items-center justify-center rounded-lg font-mono text-xs font-bold transition',
                    isCur
                      ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                      : '',
                    hasAns
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  {q.questionNumber}
                  {isFlag && (
                    <span
                      className="absolute -top-1 -right-1 size-2 rounded-full bg-amber-400"
                      aria-hidden="true"
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-primary" />
              {zh ? '已作答' : 'Answered'}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-400" />
              {zh ? '已标记复查' : 'Flagged'}
            </span>
          </div>
        </footer>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // VIEW 1: IELTS LISTENING PRACTICE WORKBENCH DASHBOARD
  // ---------------------------------------------------------------------------
  const fullMockTest = LISTENING_TESTS[0]

  return (
    <div className="mx-auto max-w-7xl space-y-6" data-testid="listening-page">
      {/* Top SRS Listening Workbench Hero Header */}
      <section className="rounded-3xl border border-border/80 bg-card/85 p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/12 px-3 py-0.5 text-[11px] font-semibold text-primary">
                <Headphones className="size-3.5" aria-hidden="true" />
                IELTS LISTENING WORKBENCH
              </span>
              <span className="rounded-full border border-border/80 bg-background/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {zh
                  ? '内置英/美/澳多角色实录 M4A 音轨 · 支持导入本地剑桥真题 MP3'
                  : 'Built-in UK/US/AU Multi-Speaker M4A Audio · Supports Local Cambridge MP3 Import'}
              </span>
            </div>

            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {zh
                ? '雅思听力 · 全真多角色机考与精听训练舱'
                : 'IELTS Listening · Multi-Speaker Exam Simulation & Dictation'}
            </h1>
            <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {zh
                ? '内置剑桥雅思 14 Test 1 与 Test 2 完整官方母带真题音频（全套 80 题官方考官原声），包含考官导语、双音钟声与英/美/澳口音，支持 30 分钟全真模拟机考与单 Section 逐句精听。'
                : 'Includes authentic Cambridge IELTS 14 Test 1 & Test 2 official audio masters (80 official exam questions) with examiner narration, test chimes, UK/US/AU accents, and full 30-minute exam simulation.'}
            </p>
          </div>

          {/* Right KPI Strip & Mode Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 rounded-2xl border border-border/80 bg-background/60 px-3.5 py-2 text-xs">
              <Flame className="size-4 text-primary" aria-hidden="true" />
              <div>
                <span className="block text-[10px] text-muted-foreground">
                  {zh ? '连续学习' : 'Streak'}
                </span>
                <span className="font-mono font-bold text-foreground">
                  {progress.streak} {zh ? '天' : 'd'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl border border-border/80 bg-background/60 px-3.5 py-2 text-xs">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              <div>
                <span className="block text-[10px] text-muted-foreground">
                  {zh ? '累计经验' : 'Total XP'}
                </span>
                <span className="font-mono font-bold text-foreground">{progress.xp} XP</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl border border-border/80 bg-background/60 px-3.5 py-2 text-xs">
              <Target className="size-4 text-primary" aria-hidden="true" />
              <div>
                <span className="block text-[10px] text-muted-foreground">
                  {zh ? '最高预估 Band' : 'Best Band'}
                </span>
                <span className="font-mono font-bold text-primary">
                  {bestBand ? bestBand.toFixed(1) : zh ? '待测评' : 'Calibrating'}
                </span>
              </div>
            </div>

            {/* Practice vs Exam Mode Toggle */}
            <div
              role="group"
              aria-label={zh ? '选择练习模式' : 'Select listening mode'}
              className="flex items-center rounded-2xl border border-border/80 bg-background/70 p-1"
            >
              <button
                type="button"
                onClick={() => setSelectedMode('practice')}
                className={cn(
                  'rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                  selectedMode === 'practice'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {zh ? '精听训练模式' : 'Practice Mode'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('exam')}
                className={cn(
                  'rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                  selectedMode === 'exam'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {zh ? '全真机考模式' : 'Exam Mode'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Full Mock / Daily Challenge Card */}
      <section className="rounded-3xl border border-primary/35 bg-gradient-to-r from-primary/18 via-primary/10 to-card p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold text-primary-foreground">
                <Sparkles className="size-3" aria-hidden="true" />
                {zh ? '推荐首选 · 多角色考场原声四部分联考' : 'Featured · Multi-Voice 4-Part Simulation'}
              </span>
              <span className="rounded-full border border-primary/30 bg-background/60 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                Parts 1–4 · UK / US / AU Voices · 24 Questions
              </span>
            </div>

            <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
              {zh ? fullMockTest.titleZh : fullMockTest.title}
            </h2>
            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {zh ? fullMockTest.subtitleZh : fullMockTest.subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                type="button"
                onClick={() => startListeningSession(fullMockTest, selectedMode)}
                className="rounded-xl px-5 font-bold shadow-[0_0_20px_oklch(0.72_0.17_158/0.35)]"
              >
                <Play className="mr-1.5 size-4" aria-hidden="true" />
                {selectedMode === 'exam'
                  ? zh
                    ? '开始 30 分钟全真机考'
                    : 'Start 30-Min Exam Simulation'
                  : zh
                    ? '开始四部分真题录音联练'
                    : 'Start 4-Part Practice Session'}
              </Button>
              <span className="text-xs text-muted-foreground">
                {zh
                  ? `已累计完成 ${history.length} 次听力训练 · 共作答 ${totalQuestionsAnswered} 题`
                  : `${history.length} sessions completed · ${totalQuestionsAnswered} questions answered`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:w-80 lg:grid-cols-2">
            {[
              { part: 'Part 1 (UK+US)', descZh: '公寓办卡双人对话', descEn: 'Social Dialogue' },
              { part: 'Part 2 (UK)', descZh: '水磨坊平面图独白', descEn: 'Map Labelling' },
              { part: 'Part 3 (UK/US/AU)', descZh: '微塑料三人研讨', descEn: 'Academic Seminar' },
              { part: 'Part 4 (UK)', descZh: '古剧场声学讲座', descEn: 'Lecture Notes' },
            ].map((item) => (
              <div
                key={item.part}
                className="rounded-2xl border border-border/80 bg-background/75 px-3.5 py-2.5"
              >
                <span className="font-mono text-xs font-bold text-primary">{item.part}</span>
                <span className="mt-0.5 block text-xs font-medium text-foreground">
                  {zh ? item.descZh : item.descEn}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', zh: '全部套题 (5)', en: 'All Sets (5)' },
              { id: 'full', zh: '完整模考 (Part 1–4)', en: 'Full Test' },
              { id: 'part1', zh: 'Part 1 · 对话填表', en: 'Part 1 · Dialogue' },
              { id: 'part2', zh: 'Part 2 · 地图方位', en: 'Part 2 · Map Plan' },
              { id: 'part3', zh: 'Part 3 · 学术研讨', en: 'Part 3 · Seminar' },
              { id: 'part4', zh: 'Part 4 · 讲座填空', en: 'Part 4 · Lecture' },
              { id: 'history', zh: `训练记录 (${history.length})`, en: `History (${history.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={cn(
                'rounded-xl px-3.5 py-1.5 text-xs font-semibold transition',
                categoryFilter === tab.id
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'border border-border/80 bg-card/70 text-muted-foreground hover:text-foreground',
              )}
            >
              {zh ? tab.zh : tab.en}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Grid: Test Cards on Left (8 cols), Audio Pack & Examiner Trap Guide on Right (4 cols) */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          {categoryFilter === 'history' ? (
            history.length === 0 ? (
              <div className="rounded-2xl border border-border/80 bg-card/80 p-8 text-center">
                <History className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {zh ? '暂无听力训练记录' : 'No listening attempts yet'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {zh
                    ? '选择任意 Part 专项或全真模考交卷后，你的 Band 预估分与错题精析会保存在这里。'
                    : 'Complete any listening set to track your estimated band score and distractor diagnostics here.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => {
                  const matchedTest = LISTENING_TESTS.find((t) => t.id === item.testId)
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card/85 p-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                            Band {item.estimatedBand.toFixed(1)}
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            {zh ? item.testTitleZh : item.testTitle}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {zh
                            ? `答对 ${item.correctCount}/${item.totalQuestions} 题 · 用时 ${formatDurationClock(item.elapsedSeconds)}`
                            : `Score ${item.correctCount}/${item.totalQuestions} · Time ${formatDurationClock(item.elapsedSeconds)}`}
                        </p>
                      </div>

                      {matchedTest && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setActiveTest(matchedTest)
                            setCompletedRecord(item)
                          }}
                          className="rounded-xl text-xs"
                        >
                          {zh ? '查看逐题精析报告' : 'View Diagnostic Report'}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            <div className="grid gap-4">
              {filteredTests.map((test) => {
                const qCount = test.parts.reduce((acc, p) => acc + p.questions.length, 0)
                const hasMap = test.parts.some((p) => p.hasMapDiagram)

                return (
                  <article
                    key={test.id}
                    className="rounded-2xl border border-border/80 bg-card/85 p-5 transition hover:border-primary/35"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-primary/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-primary">
                            {test.difficulty}
                          </span>
                          <span className="rounded-lg border border-border/70 bg-background/60 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                            {qCount} {zh ? '道真题级设问' : 'Questions'}
                          </span>
                          {hasMap && (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                              <MapPin className="size-3" aria-hidden="true" />
                              {zh ? '含可视化地图题' : 'Interactive Map'}
                            </span>
                          )}
                        </div>

                        <h3 className="font-display text-lg font-bold text-foreground">
                          {zh ? test.titleZh : test.title}
                        </h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {zh ? test.subtitleZh : test.subtitle}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => startListeningSession(test, selectedMode)}
                          className="rounded-xl text-xs font-bold"
                        >
                          <Play className="mr-1.5 size-3.5" aria-hidden="true" />
                          {selectedMode === 'exam'
                            ? zh
                              ? '进入机考模式'
                              : 'Start Exam'
                            : zh
                              ? '进入精听练习'
                              : 'Start Practice'}
                        </Button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Studio Audio Pack Downloads + Official British Council Links + Trap Guide */}
        <aside className="space-y-4 lg:col-span-4">
          {/* Built-in Studio Audio Pack & External Official IELTS Links */}
          <div className="rounded-2xl border border-primary/30 bg-card/90 p-5">
            <div className="flex items-center gap-2">
              <Headphones className="size-4 text-primary" aria-hidden="true" />
              <h3 className="font-display text-sm font-bold text-foreground">
                {zh ? '考场实录音轨包与官方真题音源' : 'Studio Audio Tracks & Official Sources'}
              </h3>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {zh
                ? '应用已内置合成四段完整多角色考场音轨（含考官导语、钟声与英/美/澳不同说话人声线）。你可直接下载离线听，或在进入练习后点击上传按钮加载本地剑桥雅思 MP3。'
                : 'Four multi-speaker exam tracks (with examiner narration, chimes, and UK/US/AU voices) are bundled locally. Download them below or load your own Cambridge IELTS MP3 inside the player.'}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((partNum) => (
                <a
                  key={partNum}
                  href={`/audio/listening/part${partNum}.m4a`}
                  download={`ielts-listening-part${partNum}.m4a`}
                  className="inline-flex items-center justify-between rounded-xl border border-border/80 bg-background/60 px-3 py-2 text-xs font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  <span>Part {partNum} Audio (.m4a)</span>
                  <Download className="size-3.5 text-primary" aria-hidden="true" />
                </a>
              ))}
            </div>

            <div className="mt-3 border-t border-border/60 pt-3">
              <p className="text-[11px] font-semibold text-muted-foreground">
                {zh ? '官方免费真题 MP3 下载入口（British Council / IELTS.org）：' : 'Official Free IELTS MP3 Portals:'}
              </p>
              <div className="mt-1.5 flex flex-col gap-1.5 text-xs">
                <a
                  href="https://takeielts.britishcouncil.org/take-ielts/prepare/free-ielts-english-practice-tests/listening"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-between rounded-lg bg-primary/10 px-2.5 py-1.5 font-medium text-primary hover:bg-primary/15"
                >
                  <span>British Council Official Listening Samples</span>
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
                <a
                  href="https://ielts.org/take-a-test/preparation-resources/sample-test-questions/academic-test"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-between rounded-lg bg-background/70 px-2.5 py-1.5 font-medium text-muted-foreground hover:text-foreground"
                >
                  <span>IELTS.org Official Sample Audio & Tasks</span>
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/85 p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-400" aria-hidden="true" />
              <h3 className="font-display text-sm font-bold text-foreground">
                {zh ? '雅思听力四大必考干扰项法则' : 'Top 4 IELTS Listening Trap Patterns'}
              </h3>
            </div>

            <div className="mt-3.5 space-y-3 text-xs">
              <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                <p className="font-semibold text-primary">
                  {zh ? '1. 新旧信息自我修正 (Self-Correction)' : '1. Speaker Self-Correction'}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {zh
                    ? 'Part 1 常先报出去年的价格或旧邮编（used to be £150），紧接着用 Starting this September / actually 给出真正答案（£185）。'
                    : 'Speakers state an outdated fee or postcode first, then correct themselves with "actually" or "starting this term".'}
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                <p className="font-semibold text-primary">
                  {zh ? '2. 地图题起点归位与左右朝向' : '2. Map Orientation & Starting Point'}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {zh
                    ? 'Part 2 地图题务必先圈出 You Are Here（如南侧正门），注意 instead of crossing the bridge 等否定路径指示。'
                    : 'Always anchor at "You Are Here" and watch for negative path cues like "instead of crossing the bridge".'}
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                <p className="font-semibold text-primary">
                  {zh ? '3. 预设假设反转 (Assumed... However)' : '3. Hypothesis Reversal in Part 3'}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {zh
                    ? 'Part 3 学生常先说 We assumed X would dominate（原以为是 X），真正答案永远在 However / turned out to be 之后。'
                    : 'In academic discussions, initial assumptions ("we thought...") are almost always overturned after "However".'}
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                <p className="font-semibold text-primary">
                  {zh ? '4. 题干否定词消化与单复数同义替换' : '4. Negation & Active-to-Passive Shifts'}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {zh
                    ? '若笔记题干已写 must not use a ___，录音说 requires no flash，切勿重复填 no，严格遵守 ONE WORD ONLY。'
                    : 'If the note stem already includes "must not use a ___" and the audio says "no flash", write only "flash".'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/85 p-5">
            <div className="flex items-center gap-2">
              <Compass className="size-4 text-primary" aria-hidden="true" />
              <h3 className="font-display text-sm font-bold text-foreground">
                {zh ? '为什么精听比盲刷题提分快 3 倍？' : 'Why Deliberate Listening Works'}
              </h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {zh
                ? '只对答案不重听原句，下次遇到相同的同义替换（如 complimentary = free、clogged = blocked up）依然会漏听。使用本工作台的「单句切片精听」与「句子听写舱」，把声音信号与词义直接建立条件反射。'
                : 'Checking answer keys without re-listening leaves phonological blind spots intact. Use the synced turn player and Dictation Lab to wire spoken paraphrases directly to comprehension.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
