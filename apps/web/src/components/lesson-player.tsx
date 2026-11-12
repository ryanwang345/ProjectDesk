import { useEffect, useMemo, useRef, useState } from 'react'
import { Heart, Sparkles, Star, X } from 'lucide-react'
import { BandDrill } from '@/components/band-notes'
import { Pronunciation } from '@/components/pronunciation'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { ApiError, prepareLesson } from '@/lib/api'
import type { EnglishCard } from '@/lib/english'
import {
  HEARTS,
  XP_PER_CORRECT,
  buildQuestions,
  createSeededRandom,
  lessonWords,
  matchesLessonAnswer,
  type Question,
} from '@/lib/lesson'

export function LessonPlayer({
  lesson,
  cards,
  onExit,
  onComplete,
  earnedXP = null,
  rewardEligible = true,
}: {
  lesson: number
  cards?: EnglishCard[]
  onExit: () => void
  onComplete: (correct: number) => void
  earnedXP?: number | null
  rewardEligible?: boolean
}) {
  const { t } = useI18n()
  const [words, setWords] = useState<EnglishCard[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [failed, setFailed] = useState('')
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [hearts, setHearts] = useState(HEARTS)
  const [correctCount, setCorrectCount] = useState(0)
  const heartsLeft = useRef(HEARTS)
  const correctTotal = useRef(0)
  const resultRef = useRef<HTMLDivElement>(null)
  const [finished, setFinished] = useState<'done' | 'hearts' | null>(null)
  const [bandStep, setBandStep] = useState(-1)
  const [bandPicked, setBandPicked] = useState<string | null>(null)
  const [bandChecked, setBandChecked] = useState(false)
  const [bandDone, setBandDone] = useState(false)

  const cardsRef = useRef(cards)
  cardsRef.current = cards
  const loadedLessonRef = useRef<number | null>(null)
  const isStartedRef = useRef(false)
  isStartedRef.current = started
  const questionsRef = useRef(questions)
  questionsRef.current = questions

  const fallbackWords = useMemo(() => (cards ? lessonWords(cards, lesson) : []), [cards, lesson])
  const fallbackQuestions = useMemo(
    () =>
      cards && fallbackWords.length > 0
        ? buildQuestions(fallbackWords, cards, createSeededRandom(lesson * 1000 + 42))
        : [],
    [cards, fallbackWords, lesson],
  )

  useEffect(() => {
    // If questions for this lesson are already loaded and the user has started, do not re-run
    if (loadedLessonRef.current === lesson && questionsRef.current.length > 0) return

    let cancel = false
    setStep(0)
    setPicked(null)
    setChecked(false)
    setStarted(false)
    setFinished(null)
    setCorrectCount(0)
    setHearts(HEARTS)
    heartsLeft.current = HEARTS
    correctTotal.current = 0
    setFailed('')

    const currentCards = cardsRef.current || []
    const fallbackW = lessonWords(currentCards, lesson)
    const fallbackQ = fallbackW.length > 0 ? buildQuestions(fallbackW, currentCards, createSeededRandom(lesson * 1000 + 42)) : []

    // Pre-populate words for preview screen immediately
    if (fallbackW.length > 0) {
      setWords(fallbackW)
    }

    let isResolved = false

    // Safety fallback timer if network request hangs
    const timer = window.setTimeout(() => {
      if (cancel || isResolved) return
      if (fallbackQ.length > 0) {
        setWords((prev) => (prev.length > 0 ? prev : fallbackW))
        setQuestions((prev) => (prev.length > 0 ? prev : fallbackQ))
        loadedLessonRef.current = lesson
      }
    }, 1500)

    prepareLesson(lesson)
      .then((pack) => {
        if (cancel) return
        isResolved = true
        window.clearTimeout(timer)
        // If the user has already started answering fallback questions, do NOT disrupt the ongoing quiz
        if (isStartedRef.current && loadedLessonRef.current === lesson) {
          return
        }
        setWords(pack.cards)
        setQuestions(pack.questions)
        loadedLessonRef.current = lesson
      })
      .catch((error: unknown) => {
        if (cancel) return
        isResolved = true
        window.clearTimeout(timer)
        if (fallbackQ.length > 0) {
          setWords((prev) => (prev.length > 0 ? prev : fallbackW))
          setQuestions((prev) => (prev.length > 0 ? prev : fallbackQ))
          loadedLessonRef.current = lesson
        } else {
          setFailed(error instanceof ApiError ? error.message : t('english.writing'))
        }
      })

    return () => {
      cancel = true
      window.clearTimeout(timer)
    }
  }, [lesson, t])

  const question = questions[step]
  const correct = checked && picked !== null && Boolean(question && matchesLessonAnswer(picked, question.answer))
  const progress = questions.length === 0 ? 0 : Math.round(((step + (checked ? 1 : 0)) / questions.length) * 100)

  useEffect(() => {
    if (checked) resultRef.current?.scrollIntoView({ block: 'nearest' })
  }, [checked, step])

  useEffect(() => {
    if (finished !== 'done') return
    if (!words.some((card) => !card.band?.writing || !card.band?.weak)) return
    let cancel = false
    prepareLesson(lesson)
      .then((pack) => {
        if (!cancel) setWords(pack.cards)
      })
      .catch(() => {})
    return () => {
      cancel = true
    }
  }, [finished, lesson, words])

  function check() {
    if (!question || picked === null || checked) return
    const right = matchesLessonAnswer(picked, question.answer)
    setChecked(true)
    if (right) {
      correctTotal.current += 1
      setCorrectCount(correctTotal.current)
      return
    }
    heartsLeft.current -= 1
    setHearts(heartsLeft.current)
  }

  function continueLesson() {
    if (!question) return
    if (heartsLeft.current <= 0) {
      setFinished('hearts')
      return
    }
    if (step + 1 >= questions.length) {
      onComplete(correctTotal.current)
      setFinished('done')
      return
    }
    setStep((current) => current + 1)
    setPicked(null)
    setChecked(false)
  }

  if (failed) {
    return (
      <div className="w-full">
        <p className="text-sm text-destructive">{failed}</p>
        <Button type="button" className="mt-4" onClick={onExit}>{t('english.backToPath')}</Button>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div
        aria-busy="true"
        className="flex min-h-[320px] w-full flex-col items-center justify-center gap-4 rounded-3xl border border-border/80 bg-card p-8 text-center shadow-xs"
      >
        <div className="relative flex size-14 items-center justify-center">
          <div className="absolute size-14 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <Sparkles className="size-6 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-base font-semibold text-foreground">
            {t('english.writing')}
          </p>
          <p className="text-xs text-muted-foreground">
            正在准备学术语境与真题题干，预备即刻开始…
          </p>
        </div>
        <div className="flex items-center gap-2 pt-2">
          {fallbackQuestions.length > 0 ? (
            <Button
              type="button"
              className="rounded-full px-5 text-xs font-semibold shadow-sm"
              onClick={() => {
                setWords(fallbackWords)
                setQuestions(fallbackQuestions)
              }}
            >
              直接进入练习
            </Button>
          ) : null}
          <Button type="button" variant="ghost" className="rounded-full text-xs" onClick={onExit}>
            {t('english.backToPath')}
          </Button>
        </div>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="flex w-full flex-col gap-4 pb-4">
        <div className="flex items-center gap-3">
          <Button type="button" size="icon" variant="ghost" aria-label={t('english.quit')} onClick={onExit}>
            <X />
          </Button>
          <h1 className="flex-1 text-xl font-medium">{t('english.lessonNode', { n: lesson + 1 })}</h1>
          <span className="inline-flex items-center gap-1 text-primary" aria-hidden="true">
            {Array.from({ length: words.length }, (_, index) => (
              <Star key={index} className="size-3.5 fill-primary" />
            ))}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">{words.length}/{words.length}</span>
        </div>
        <p className="text-sm text-muted-foreground">{t('english.learnThese')}</p>
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {words.map((card) => {
            const cloze = questions.find((item) => item.kind === 'cloze' && item.answer.toLowerCase() === card.word.toLowerCase())
            const example = cloze && cloze.kind === 'cloze' ? `${cloze.before}${cloze.answer}${cloze.after}` : ''
            const chinese = cloze?.chinese ?? ''
            const senses = card.senses ?? []
            return (
              <li key={card.id} className="rounded-3xl border border-border bg-card px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-medium">{card.word}</p>
                    <Pronunciation word={card.word} pronunciation={card.pronunciation} />
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{card.meaning}</span>
                </div>
                {senses.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-2">
                    {senses.map((sense, index) => (
                      <li key={`${sense.pos}-${index}`}>
                        <p className="text-sm">
                          <span className="mr-2 rounded-md bg-primary/15 px-1.5 py-0.5 text-[11px] text-primary">{sense.pos}</span>
                          <span>{sense.zh}</span>
                        </p>
                        {sense.en ? <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{sense.en}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">{card.meaning}</p>
                )}
                {example ? (
                  <div className="mt-3 rounded-2xl bg-background/50 px-3 py-2">
                    <p className="flex items-start gap-2 text-sm leading-relaxed">
                      <span className="flex-1"><Highlighted word={card.word} example={example} /></span>
                      <Pronunciation word={example} showText={false} />
                    </p>
                    {chinese ? <p className="mt-1 text-sm text-primary">{chinese}</p> : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
        <Button type="button" className="h-12 w-full rounded-full text-base" onClick={() => setStarted(true)}>
          {t('english.startPractice', { n: words.length })}
        </Button>
      </div>
    )
  }

  const bandCards = words.filter((card) => Boolean(card.band?.writing && card.band?.weak))
  const bandCard = finished === 'done' ? bandCards[bandStep] : undefined
  if (bandCard) {
    return (
      <BandDrill
        card={bandCard}
        index={bandStep}
        total={bandCards.length}
        picked={bandPicked}
        checked={bandChecked}
        onPick={setBandPicked}
        onCheck={() => setBandChecked(true)}
        onContinue={() => {
          if (bandStep + 1 >= bandCards.length) {
            setBandStep(-1)
            setBandDone(true)
            return
          }
          setBandStep((current) => current + 1)
          setBandPicked(null)
          setBandChecked(false)
        }}
        onExit={() => setBandStep(-1)}
      />
    )
  }

  if (finished) {
    const won = finished === 'done'
    return (
      <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-5xl tracking-tight">{won ? t('english.lessonDone') : t('english.outOfHearts')}</h1>
        <p className="text-muted-foreground">
          {won ? earnedXP === null ? t('english.lessonProgressPending') : t('english.lessonScore', { correct: correctCount, total: questions.length, xp: earnedXP }) : t('english.tryAgain')}
        </p>
        {won && bandCards.length > 0 ? (
          bandDone ? (
            <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">✓ {t('english.bandDone')}</p>
          ) : (
            <div className="mt-2 flex w-full max-w-md flex-col gap-3 rounded-3xl border border-primary/30 bg-card p-4 text-left">
              <div>
                <p className="font-medium">{t('english.bandOffer')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('english.bandOfferNote', { n: bandCards.length })}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full"
                onClick={() => {
                  setBandPicked(null)
                  setBandChecked(false)
                  setBandStep(0)
                }}
              >
                {t('english.bandStart')}
              </Button>
            </div>
          )
        ) : null}
        <Button type="button" className="mt-2 h-12 px-8 text-base" onClick={onExit}>{t('english.backToPath')}</Button>
      </div>
    )
  }

  const promptCard = question.kind === 'meaning'
    ? words.find((card) => card.word.toLowerCase() === question.prompt.toLowerCase())
    : words.find((card) => card.word.toLowerCase() === question.answer.toLowerCase())
  const pickedCard = question.kind !== 'meaning' && picked
    ? words.find((card) => matchesLessonAnswer(card.word, picked))
    : undefined

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="icon" variant="ghost" aria-label={t('english.quit')} onClick={onExit}>
          <X />
        </Button>
        <div className="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">{t('english.questionOf', { n: step + 1, total: questions.length })}</p>
        <p className="flex items-center gap-0.5" aria-label={t('english.hearts', { n: hearts })}>
          {Array.from({ length: HEARTS }, (_, index) => (
            <Heart
              key={index}
              className={index < hearts ? 'size-4 fill-rose-400 text-rose-400' : 'size-4 text-muted-foreground/35'}
              aria-hidden="true"
            />
          ))}
        </p>
      </div>
      <div className="flex items-center justify-end text-xs text-muted-foreground">
        <p className="rounded-full border border-border px-2 py-0.5">{t('english.choiceKind')}</p>
      </div>
      <h1 className="text-xl font-medium">{question.kind === 'meaning' ? t('english.promptMeaning') : question.kind === 'definition' ? t('english.promptDefinition') : t('english.promptCloze')}</h1>
      {question.kind === 'meaning' && promptCard ? (
        <div className="flex items-center justify-between rounded-3xl border border-primary/30 bg-card px-4 py-4">
          <div>
            <p className="text-3xl font-medium">{promptCard.word}</p>
            <Pronunciation word={promptCard.word} pronunciation={promptCard.pronunciation} />
          </div>
          <Pronunciation word={promptCard.word} showText={false} orb />
        </div>
      ) : (
        <Prompt question={question} words={words} picked={picked} checked={checked} />
      )}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {question.choices.map((choice, index) => {
          const selected = picked === choice
          const showCorrect = checked && matchesLessonAnswer(choice, question.answer)
          const showWrong = checked && selected && !showCorrect
          const letter = 'ABCD'[index] ?? ''
          return (
            <button
              key={`${choice}-${index}`}
              type="button"
              disabled={checked}
              aria-pressed={selected}
              className={
                showCorrect
                  ? 'flex min-w-0 items-center gap-3 rounded-2xl border border-primary bg-primary/15 px-3 py-3 text-left'
                  : showWrong
                    ? 'flex min-w-0 items-center gap-3 rounded-2xl border border-destructive bg-destructive/10 px-3 py-3 text-left'
                    : selected
                      ? 'flex min-w-0 items-center gap-3 rounded-2xl border border-primary bg-card px-3 py-3 text-left'
                      : 'flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-left'
              }
              onClick={() => setPicked(choice)}
            >
              <span className={`grid size-7 place-items-center rounded-full text-xs font-medium ${showCorrect ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{letter}</span>
              <span className="min-w-0 flex-1 text-sm break-words">{choice}</span>
              {showCorrect ? <span className="text-xs text-primary">{t('english.correct')}</span> : null}
            </button>
          )
        })}
      </div>
      <div ref={resultRef}>
        {checked && picked ? (
          <Result question={question} picked={picked} correct={correct} card={promptCard} pickedCard={pickedCard} rewardEligible={rewardEligible} />
        ) : null}
        {checked ? (
          <Button type="button" className="mt-3 h-12 w-full rounded-full text-base" onClick={continueLesson}>{t('english.continueNext')}</Button>
        ) : (
          <Button type="button" className="h-12 w-full rounded-full text-base" disabled={picked === null} onClick={check}>{t('english.check')}</Button>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">{t('footer')}</p>
    </div>
  )
}

function Result({ question, picked, correct, card, pickedCard, rewardEligible }: {
  question: Question
  picked: string
  correct: boolean
  card?: EnglishCard
  pickedCard?: EnglishCard
  rewardEligible: boolean
}) {
  const { t } = useI18n()
  return (
    <div role="status" data-testid="lesson-answer-feedback" className={`rounded-3xl border px-4 py-4 ${correct ? 'border-primary/40 bg-primary/10' : 'border-destructive/40 bg-destructive/10'}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 font-medium">
          <span className={`grid size-5 place-items-center rounded-full text-xs ${correct ? 'bg-primary text-primary-foreground' : 'bg-destructive text-white'}`}>{correct ? '✓' : '×'}</span>
          {correct ? t('english.answeredRight') : t('english.wrong')}
        </p>
        {correct && rewardEligible ? <span className="text-sm text-primary">{t('english.points', { n: XP_PER_CORRECT })}</span> : null}
      </div>
      {!correct ? (
        <div className="mt-3 space-y-2 text-sm" data-testid="lesson-answer-comparison">
          <p><span className="text-muted-foreground">{t('english.youChose')}: </span><strong>{picked}</strong>{pickedCard ? ` · ${pickedCard.meaning}` : ''}</p>
          <p>{t('english.correctAnswer', { answer: question.answer })}{question.kind !== 'meaning' && card ? ` · ${card.meaning}` : ''}</p>
          {question.kind === 'cloze' ? <p className="rounded-xl bg-background/60 px-3 py-2 leading-relaxed" data-testid="lesson-corrected-sentence">{question.before}<strong className="font-semibold text-primary">{question.answer}</strong>{question.after}</p> : null}
        </div>
      ) : null}
      {question.why ? <p className="mt-3 text-sm leading-relaxed">{question.why}</p> : null}
      {question.chinese ? <p className="mt-2 text-sm text-primary">{question.chinese}</p> : null}
      {card ? (
        <p className="mt-3 text-sm">
          <span className="text-muted-foreground">{t('english.standard')}: </span>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">{card.meaning}</span>
        </p>
      ) : null}
    </div>
  )
}

function Highlighted({ word, example }: { word: string; example: string }) {
  const match = example.toLowerCase().indexOf(word.trim().toLowerCase())
  if (match < 0 || word.trim() === '') return example
  const end = match + word.trim().length
  return (
    <>
      {example.slice(0, match)}
      <strong className="font-semibold text-primary">{example.slice(match, end)}</strong>
      {example.slice(end)}
    </>
  )
}

function wordPronunciation(words: EnglishCard[], word: string) {
  return words.find((card) => card.word.toLowerCase() === word.toLowerCase())?.pronunciation ?? ''
}

function Prompt({ question, words, picked, checked }: { question: Question; words: EnglishCard[]; picked: string | null; checked: boolean }) {
  const { t } = useI18n()
  if (question.kind === 'meaning') {
    return (
      <h1 className="flex items-baseline gap-3 font-display text-5xl tracking-tight">
        <span>{question.prompt}</span>
        <Pronunciation word={question.prompt} pronunciation={wordPronunciation(words, question.prompt)} textClassName="text-lg" />
      </h1>
    )
  }
  if (question.kind === 'definition') {
    return (
      <p className="rounded-3xl border border-primary/30 bg-card px-4 py-4 text-xl leading-relaxed" data-testid="lesson-definition">
        {question.prompt}
      </p>
    )
  }
  const filled = picked
  const wrong = checked && picked !== null && !matchesLessonAnswer(picked, question.answer)
  const intendedMeaning = words.find((card) => card.word.toLowerCase() === question.answer.toLowerCase())?.meaning
  return (
    <div>
      {intendedMeaning ? <p className="mb-3 text-sm text-muted-foreground" data-testid="lesson-intended-meaning">{t('english.intendedMeaning')}: <span className="font-medium text-foreground">{intendedMeaning}</span></p> : null}
      <p className="text-2xl leading-relaxed" data-testid="lesson-cloze-sentence">
        {question.before}
        <span data-testid="lesson-cloze-selection" className={`mx-1 inline-block min-w-20 border-b-2 px-1 text-center font-display ${wrong ? 'border-destructive text-destructive' : filled ? 'border-primary text-primary' : 'border-muted-foreground/40'}`}>
          {filled || '\u00a0'}
        </span>
        {question.after}
      </p>
      {filled ? <div className="mt-2"><Pronunciation word={filled} pronunciation={wordPronunciation(words, filled)} /></div> : null}
    </div>
  )
}
