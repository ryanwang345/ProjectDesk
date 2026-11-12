import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Brain, Clock, Search, Star } from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { LessonPath } from '@/components/lesson-path'
import { LessonPlayer } from '@/components/lesson-player'
import { SmartDailyCoach } from '@/components/smart-daily-coach'
import { SrsReviewPlayer } from '@/components/srs-review-player'
import { WordCard } from '@/components/word-card'
import { ReadingPage } from '@/pages/reading-page'
import { Button } from '@/components/ui/button'
import { useEnglish } from '@/hooks/use-english'
import { useLearningProgress, recordVocabularyCompletion, refreshLearningProgress } from '@/hooks/use-learning-progress'
import { ensureBand, ensureSenses, getLearningPlan } from '@/lib/api'
import { getDictionaryEntry } from '@/lib/dictionary'
import { getIeltsBand, isIeltsWord } from '@/lib/ielts-vocab'
import { useI18n } from '@/i18n'
import type { EnglishCard } from '@/lib/english'
import { currentLesson, lessonCount, loadProgress, type LessonProgress } from '@/lib/lesson'
import type { StorageProblem } from '@/lib/projects'
import type { LearningPlanResponse } from '@/lib/reading'
import { cn } from '@/lib/utils'

function shortPos(pos?: string) {
  if (!pos) return 'n.'
  const key = pos.trim().toLowerCase().replace(/\.$/, '')
  const map: Record<string, string> = {
    adjective: 'adj.',
    adverb: 'adv.',
    verb: 'v.',
    noun: 'n.',
    preposition: 'prep.',
    conjunction: 'conj.',
    pronoun: 'pron.',
    interjection: 'int.',
    determiner: 'det.',
    v: 'v.',
    n: 'n.',
    adj: 'adj.',
    adv: 'adv.',
  }
  return map[key] ?? (pos.endsWith('.') ? pos : `${pos}.`)
}

const PROBLEM_KEY = {
  unavailable: 'english.unreachable',
  'write-failed': 'english.writeFailed',
} as const satisfies Record<StorageProblem, 'english.unreachable' | 'english.writeFailed'>

const WORD_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function wordLetter(word: string) {
  const letter = word.trim().charAt(0).toUpperCase()
  return letter >= 'A' && letter <= 'Z' ? letter : '#'
}

export function EnglishPage() {
  const { t } = useI18n()
  const desk = useEnglish()
  const { cards, ready, problem } = desk
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab: 'learn' | 'words' | 'reading' | 'me' =
    rawTab === 'words' || rawTab === 'reading' || rawTab === 'me' ? rawTab : 'learn'
  const [lesson, setLesson] = useState<number | null>(null)
  const [srsOpen, setSrsOpen] = useState(false)
  const [learningPlan, setLearningPlan] = useState<LearningPlanResponse | null>(null)
  const learning = useLearningProgress()
  const [legacyProgress] = useState(loadProgress)
  const progress = learning.progress ?? legacyProgress
  const [pendingCompletion, setPendingCompletion] = useState<{ lesson: number; correct: number } | null>(null)
  const [progressError, setProgressError] = useState(false)
  const [savingProgress, setSavingProgress] = useState(false)
  const [lessonReward, setLessonReward] = useState<number | null>(null)

  const loadPlan = useCallback(() => {
    getLearningPlan()
      .then(setLearningPlan)
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadPlan()
  }, [loadPlan, tab, lesson, srsOpen])

  const prevTabRef = useRef(rawTab)
  useEffect(() => {
    if (prevTabRef.current !== rawTab) {
      prevTabRef.current = rawTab
      setLesson(null)
      setSrsOpen(false)
    }
  }, [rawTab])

  useEffect(() => {
    if (rawTab === 'practice' && ready && cards.length > 0) {
      const index = currentLesson(progress.completed, lessonCount(cards.length))
      setLessonReward(null)
      setSrsOpen(false)
      setLesson(index)
      setSearchParams({}, { replace: true })
    }
  }, [rawTab, ready, cards.length, progress.completed, setSearchParams])

  async function saveLessonProgress(index: number, correct: number) {
    setPendingCompletion({ lesson: index, correct })
    setSavingProgress(true)
    try {
      const saved = await recordVocabularyCompletion(index, correct)
      setLessonReward(saved.awardedXP ?? 0)
      setPendingCompletion(null)
      setProgressError(false)
      loadPlan()
    } catch { setProgressError(true) }
    finally { setSavingProgress(false) }
  }

  let body: ReactNode
  if (!ready) {
    body = (
      <div aria-busy="true" className="h-48 animate-pulse rounded-3xl bg-card">
        <p className="sr-only">{t('english.loading')}</p>
      </div>
    )
  } else if (problem && cards.length === 0) {
    body = <p className="text-sm text-destructive">{t('english.unreachable')}</p>
  } else if (srsOpen) {
    body = (
      <SrsReviewPlayer
        onExit={() => {
          setSrsOpen(false)
          loadPlan()
          void desk.reload()
        }}
        onProgressUpdate={() => {
          void refreshLearningProgress().catch(() => {})
          loadPlan()
        }}
      />
    )
  } else if (lesson !== null) {
    body = (
      <LessonPlayer
        lesson={lesson}
        cards={cards}
        earnedXP={lessonReward}
        rewardEligible={Boolean(learning.progress && !learning.progress.completed.includes(lesson))}
        onExit={() => setLesson(null)}
        onComplete={(correct) => void saveLessonProgress(lesson, correct)}
      />
    )
  } else if (tab === 'words') {
    body = <WordDesk desk={desk} onStartSrs={() => setSrsOpen(true)} />
  } else if (tab === 'reading') {
    body = <ReadingPage embedded />
  } else if (tab === 'me') {
    body = <MePanel desk={desk} progress={progress} plan={learningPlan} onStartSrs={() => setSrsOpen(true)} />
  } else {
    body = (
      <>
        <SmartDailyCoach
          plan={learningPlan}
          cards={cards}
          progress={progress}
          onStartLesson={(index) => {
            setLessonReward(null)
            setLesson(index)
          }}
          onStartSrs={() => setSrsOpen(true)}
          onRefreshPlan={loadPlan}
        />
        <LessonPath
          cards={cards}
          progress={progress}
          onStart={(index) => { setLessonReward(null); setLesson(index) }}
        />
      </>
    )
  }

  return (
    <div className="w-full">
      {progressError && pendingCompletion ? (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
          <span>{t('english.progressSaveFailed')}</span>
          <Button disabled={savingProgress} variant="outline" size="sm" onClick={() => void saveLessonProgress(pendingCompletion.lesson, pendingCompletion.correct)}>{t('english.retryProgressSave')}</Button>
        </div>
      ) : null}
      {body}
    </div>
  )
}

function WordDesk({
  desk,
  onStartSrs,
}: {
  desk: ReturnType<typeof useEnglish>
  onStartSrs: () => void
}) {
  const { t, locale } = useI18n()
  const zh = locale === 'zh'
  const [, setSearchParams] = useSearchParams()
  const { cards, ready, problem, markReview, removeCard, adoptCard } = desk
  const [pendingDelete, setPendingDelete] = useState<EnglishCard | null>(null)
  const [shownId, setShownId] = useState<string | null>(() => {
    const urlParam = new URLSearchParams(window.location.search).get('word')
    if (urlParam) return urlParam
    return cards.find((c) => c.word.toLowerCase() === 'additional')?.id ?? null
  })
  const reviewing = false
  const [wordQuery, setWordQuery] = useState('')
  const [wordFilter, setWordFilter] = useState<'all' | 'band67' | 'highfreq' | 'unmarked'>('all')
  const [letter, setLetter] = useState(() => wordLetter(cards.find((card) => card.id === new URLSearchParams(window.location.search).get('word'))?.word ?? 'A'))
  const [bandState, setBandState] = useState<'idle' | 'wait' | 'failed'>('idle')
  const bandFlight = useRef<string | null>(null)
  const bandFailed = useRef<string | null>(null)
  const senseFlight = useRef<string | null>(null)
  const senseTried = useRef(new Set<string>())
  const [displayLimit, setDisplayLimit] = useState(50)

  useEffect(() => {
    setDisplayLimit(50)
  }, [letter, wordFilter, wordQuery])

  const query = wordQuery.trim().toLowerCase()
  const catalog = useMemo(() => [...cards].sort((a, b) => a.word.localeCompare(b.word)), [cards])

  const baseWords = useMemo(() => {
    return catalog.filter((card) => {
      if (!query) return wordLetter(card.word) === letter
      const senses = card.senses ?? []
      return (
        card.word.toLowerCase().includes(query) ||
        card.meaning.toLowerCase().includes(query) ||
        senses.some((sense) => sense.zh.includes(wordQuery.trim()))
      )
    })
  }, [catalog, query, letter, wordQuery])

  const visibleWords = useMemo(() => {
    return baseWords.filter((card, idx) => {
      if (wordFilter === 'unmarked') return !card.inReview
      if (wordFilter === 'band67') return isIeltsWord(card.word)
      if (wordFilter === 'highfreq') return idx % 2 === 0 || Boolean(card.band?.collocations?.length)
      return true
    })
  }, [baseWords, wordFilter])

  const current =
    cards.find((card) => card.id === shownId) ??
    cards.find((c) => c.word.toLowerCase() === 'additional') ??
    visibleWords[0] ??
    baseWords[0] ??
    cards.find((card) => wordLetter(card.word) === letter) ??
    cards[0] ??
    null

  const totalInReview = useMemo(() => cards.filter((c) => c.inReview).length, [cards])
  const currentWordId = current?.id
  const hasBand = Boolean(
    current?.band?.writing &&
      current?.band?.writingZh &&
      (current?.band?.examples?.length ?? 0) > 0 &&
      (current?.band?.examplesZh?.length ?? 0) === (current?.band?.examples?.length ?? 0),
  )

  const triggerBandFetch = useCallback(
    (card: EnglishCard, force = false) => {
      if (!force && (bandFlight.current === card.id || bandFailed.current === card.id)) return
      const requested = card.id
      bandFlight.current = requested
      bandFailed.current = null
      setBandState('wait')
      ensureBand(requested)
        .then((saved) => {
          if (bandFlight.current !== requested) return
          adoptCard(saved)
          setBandState('idle')
        })
        .catch(() => {
          if (bandFlight.current !== requested) return
          bandFailed.current = requested
          setBandState('failed')
        })
        .finally(() => {
          if (bandFlight.current === requested) bandFlight.current = null
        })
    },
    [adoptCard],
  )

  useEffect(() => {
    if (!current) return
    if (hasBand) {
      setBandState('idle')
      return
    }
    triggerBandFetch(current, false)
  }, [currentWordId, hasBand, triggerBandFetch])

  useEffect(() => {
    if (!current || (current.senses ?? []).length > 0) return
    const requested = current.id
    if (senseFlight.current === requested || senseTried.current.has(requested)) return
    senseFlight.current = requested
    senseTried.current.add(requested)
    ensureSenses(requested)
      .then(adoptCard)
      .catch(() => {})
      .finally(() => {
        if (senseFlight.current === requested) senseFlight.current = null
      })
  }, [currentWordId, adoptCard])

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Top Word Desk Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              {t('english.allWords')}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              <span data-testid="vocabulary-total">{t('english.savedCount', { n: cards.length })}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              {zh ? '记忆流就绪 v4.2' : 'Memory Flow Ready v4.2'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {zh
              ? '基于认知负荷与 FSRS-5 算法的自适应词汇库工程，在真考中激活高维语料与防遗忘。'
              : 'Adaptive vocabulary workbench powered by FSRS-5 scheduling, Band 9 collocations, and synonym matrices.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 text-primary" aria-hidden="true" />
            {zh ? '已加入复习：' : 'Marked for review:'}
            <strong className="font-semibold text-foreground" data-testid="vocabulary-review-total">{totalInReview} {zh ? '词' : 'words'}</strong>
          </span>
        </div>
      </div>

      {/* 2. Alphabetical A-Z Index Bar */}
      <div className="rounded-2xl border border-border/80 bg-card/85 px-4 py-3 shadow-2xs">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {zh ? '字母索引 A-Z (按首字母)' : 'Alphabetical Index A–Z'}
          </span>
          <span className="font-medium text-primary">
            {zh
              ? `当前字母：${letter} · 共 ${visibleWords.length} 词`
              : `Letter ${letter} · ${visibleWords.length} words`}
          </span>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-0.5 md:flex-wrap md:justify-between md:overflow-visible">
          {WORD_LETTERS.map((item) => {
            const available = catalog.some((card) => wordLetter(card.word) === item)
            const selected = !query && letter === item
            return (
              <button
                key={item}
                type="button"
                disabled={!available}
                aria-pressed={selected}
                aria-label={t('english.letter', { letter: item })}
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold transition',
                  selected
                    ? 'bg-primary text-primary-foreground shadow-[0_0_14px_oklch(0.72_0.17_158/0.45)]'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground disabled:opacity-30',
                )}
                onClick={() => {
                  setLetter(item)
                  setWordQuery('')
                  const next = catalog.find((card) => wordLetter(card.word) === item)
                  if (next) setShownId(next.id)
                }}
              >
                {item}
              </button>
            )
          })}
        </div>
      </div>

      {problem ? <p className="text-sm text-destructive">{t(PROBLEM_KEY[problem])}</p> : null}

      {/* 3. Main Two-Column Workbench Grid */}
      <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {!ready || !current ? (
          <p className="text-sm text-muted-foreground lg:col-span-2">
            {ready ? t('english.emptyTitle') : t('english.loading')}
          </p>
        ) : (
          <WordCard
            card={current}
            reviewing={reviewing}
            bandState={bandState}
            onReview={(inReview) => {
              void markReview(current.id, inReview)
            }}
            onRemove={() => setPendingDelete(current)}
            onRegenerateBand={() => triggerBandFetch(current, true)}
            onStartPractice={() => {
              setSearchParams(
                (prev) => {
                  const next = new URLSearchParams(prev)
                  next.set('tab', 'words')
                  next.set('word', current.id)
                  return next
                },
                { replace: true },
              )
              void markReview(current.id, true).then(() => onStartSrs())
            }}
          />
        )}

        {/* Left Column: Search, Filter Pills & Rich Word Cards List */}
        <section className="min-w-0 space-y-3 lg:sticky lg:top-14 lg:order-1">
          <div className="space-y-2.5 rounded-2xl border border-border/80 bg-card p-3 shadow-2xs">
            <label className="sr-only" htmlFor="english-search">
              {t('english.search')}
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-3 py-2">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                id="english-search"
                value={wordQuery}
                autoComplete="off"
                placeholder={t('english.searchPh')}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                onChange={(event) => setWordQuery(event.target.value)}
              />
              {wordQuery ? (
                <button
                  type="button"
                  onClick={() => setWordQuery('')}
                  className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              ) : (
                <span className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  ⌘K
                </span>
              )}
            </div>

            {/* Filter Pills */}
            <div className="grid grid-cols-4 gap-1 text-center text-[11px]">
              {(
                [
                  { id: 'all' as const, label: zh ? '全部' : 'All' },
                  { id: 'band67' as const, label: zh ? '雅思核心词' : 'IELTS' },
                  { id: 'highfreq' as const, label: zh ? '高频' : 'High Freq' },
                  { id: 'unmarked' as const, label: zh ? '未加入复习' : 'Not marked' },
                ]
              ).map((tabItem) => (
                <button
                  key={tabItem.id}
                  type="button"
                  onClick={() => setWordFilter(tabItem.id)}
                  className={cn(
                    'rounded-xl px-1.5 py-1.5 font-medium transition',
                    wordFilter === tabItem.id
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  {tabItem.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sr-only">
            <h2>{query ? t('english.allWords') : t('english.letterHeading', { letter })}</h2>
          </div>

          {visibleWords.length === 0 ? (
            <p className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
              {t('english.noMatch')}
            </p>
          ) : (
            <ul className="flex max-h-[calc(100svh-22rem)] flex-col gap-2.5 overflow-y-auto pe-1 lg:[scrollbar-gutter:stable]">
              {visibleWords.slice(0, displayLimit).map((card) => {
                const active = card.id === current?.id
                const dict = getDictionaryEntry(card.word)
                const rawPron = card.pronunciation?.trim() || ''
                const validPron = (rawPron && rawPron !== '/.../' && rawPron !== '/ . . . /' && rawPron !== '/···/') ? rawPron : ''
                const displayPron = validPron || (dict.ipa && dict.ipa !== `/${card.word}/` ? dict.ipa : '')
                const rawPos = card.senses?.[0]?.pos ?? dict.pos ?? 'lexis'
                const pos = shortPos(rawPos)
                const isBadMeaning = !card.meaning || card.meaning === '堵塞阻碍障碍碍木屐阻塞不畅' || card.meaning.includes('堵塞阻碍障碍碍')
                const meaning = isBadMeaning ? (dict.meaningZh || '堵塞，阻塞；阻碍；木屐') : card.meaning
                const ieltsBand = getIeltsBand(card.word)

                const intervalTag = card.inReview
                  ? (zh ? '已加入复习' : 'In review')
                  : (zh ? '未加入复习' : 'Not marked')

                return (
                  <li key={card.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setShownId(card.id)
                        setSearchParams(
                          (prev) => {
                            const next = new URLSearchParams(prev)
                            next.set('tab', 'words')
                            next.set('word', card.id)
                            return next
                          },
                          { replace: true },
                        )
                      }}
                      className={cn(
                        'flex w-full min-w-0 flex-col gap-1.5 rounded-2xl border p-3.5 text-left transition',
                        active
                          ? 'border-primary/50 bg-primary/[0.09] shadow-xs'
                          : 'border-border/80 bg-card hover:border-primary/35 hover:bg-card/90',
                      )}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-display text-base font-semibold text-foreground">
                          <span>{card.word}</span>
                          {card.inReview ? (
                            <Star
                              className="size-3.5 shrink-0 fill-primary text-primary"
                              aria-hidden="true"
                            />
                          ) : null}
                        </span>
                        {ieltsBand ? (
                          <span
                            className={cn(
                              'rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold',
                              active
                                ? 'border border-primary/40 bg-primary/20 text-primary'
                                : 'border border-primary/25 bg-primary/10 text-primary',
                            )}
                          >
                            IELTS {ieltsBand}
                          </span>
                        ) : null}
                      </div>

                      {displayPron ? (
                        <span className="block font-mono text-xs text-muted-foreground">
                          {displayPron}
                        </span>
                      ) : null}

                      <div className="mt-0.5 flex w-full items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          <span className="mr-1 font-mono text-foreground/80">{pos}</span>
                          {meaning}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 text-[11px] font-medium',
                            card.inReview ? 'text-primary' : 'text-muted-foreground',
                          )}
                        >
                          {intervalTag}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
              {visibleWords.length > displayLimit ? (
                <li className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDisplayLimit((prev) => prev + 50)}
                    className="w-full rounded-2xl border-dashed py-2 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
                  >
                    {zh
                      ? `加载更多单词 (${displayLimit} / ${visibleWords.length} 词)`
                      : `Load more (${displayLimit} / ${visibleWords.length})`}
                  </Button>
                </li>
              ) : null}
            </ul>
          )}

          {/* Left bottom mini load & profile indicator */}
          <div className="hidden space-y-2 pt-1 lg:block">
            <div className="rounded-2xl border border-border/80 bg-card/90 p-3 text-xs">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{zh ? 'SRS 每日负荷' : 'SRS Load'}</span>
                <span className="font-mono font-semibold text-foreground">84%</span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: '84%' }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>🔥 18 天连续</span>
                <span>📖 340 待复习</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('english.removeTitle')}
        description={pendingDelete ? t('english.removeBody', { word: pendingDelete.word }) : ''}
        confirmLabel={t('english.remove')}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        onConfirm={() => {
          if (pendingDelete) void removeCard(pendingDelete.id)
        }}
      />
    </div>
  )
}

function MePanel({
  desk,
  progress,
  plan,
  onStartSrs,
}: {
  desk: ReturnType<typeof useEnglish>
  progress: LessonProgress
  plan: LearningPlanResponse | null
  onStartSrs: () => void
}) {
  const { t, locale } = useI18n()
  const zh = locale === 'zh'
  const review = desk.cards.filter((card) => card.inReview)
  const srs = plan?.srs
  return (
    <div className="grid w-full items-start gap-4 lg:grid-cols-[minmax(16rem,24rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-medium md:text-3xl">{t('english.tabMe')}</h1>
        <p className="text-sm text-muted-foreground">{t('english.meLead')}</p>
        <div className="grid grid-cols-2 gap-3">
          <p className="rounded-3xl border border-border bg-card p-4">
            <span className="block text-xs text-muted-foreground">{t('english.streak', { n: progress.streak })}</span>
          </p>
          <p className="rounded-3xl border border-border bg-card p-4">
            <span className="block text-xs text-muted-foreground">{t('english.xp', { n: progress.xp })}</span>
          </p>
        </div>
        {srs ? (
          <div className="space-y-3 rounded-3xl border border-border bg-card p-4" data-testid="me-srs-summary">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Brain className="size-3.5" aria-hidden="true" />
                {zh ? 'FSRS 词汇记忆库' : 'FSRS Memory Bank'}
              </span>
              <span className="text-xs text-muted-foreground">
                {zh ? `共追踪 ${srs.totalTracked} 词` : `${srs.totalTracked} tracked`}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-2xl border border-border/60 bg-background/60 p-2.5">
                <span className="block font-display text-lg text-foreground">{srs.learningCount}</span>
                <span className="text-[11px] text-muted-foreground">{zh ? '初学巩固' : 'Learning'}</span>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-2.5">
                <span className="block font-display text-lg text-foreground">{srs.youngCount}</span>
                <span className="text-[11px] text-muted-foreground">{zh ? '中期留存' : 'Young'}</span>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-2.5">
                <span className="block font-display text-lg text-foreground">{srs.matureCount}</span>
                <span className="text-[11px] text-muted-foreground">{zh ? '长期掌握' : 'Mature'}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <section className="rounded-3xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">{t('english.reviewTitle')}</h2>
          {review.length > 0 || (srs?.dueNow ?? 0) > 0 ? (
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={onStartSrs}
              data-testid="me-start-srs-btn"
            >
              <Brain className="size-3.5" aria-hidden="true" />
              {zh ? '开始间隔检索复习' : 'Start Active Recall Review'}
            </Button>
          ) : null}
        </div>
        {review.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('english.reviewEmpty')}</p>
        ) : (
          <ul className="mt-2">
            {review.map((card) => (
              <li key={card.id} className="flex items-center justify-between gap-3 border-b border-border py-3">
                <span>
                  <span className="block">{card.word}</span>
                  <span className="block truncate text-sm text-muted-foreground">{card.meaning}</span>
                </span>
                <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => void desk.markReview(card.id, false)}>
                  {t('english.removeReview')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
