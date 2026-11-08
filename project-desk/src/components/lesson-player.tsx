import { useEffect, useRef, useState } from 'react'
import { Heart, X } from 'lucide-react'
import { BandDrill, BandNotes } from '@/components/band-notes'
import { Pronunciation } from '@/components/pronunciation'
import { WordSenses } from '@/components/word-senses'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { ApiError, prepareLesson } from '@/lib/api'
import type { EnglishCard } from '@/lib/english'
import {
  HEARTS,
  XP_PER_CORRECT,
  type Question,
} from '@/lib/lesson'

export function LessonPlayer({
  lesson,
  onExit,
  onComplete,
}: {
  lesson: number
  onExit: () => void
  onComplete: (correct: number) => void
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
  const [bandStep, setBandStep] = useState(0)
  const [bandPicked, setBandPicked] = useState<string | null>(null)
  const [bandChecked, setBandChecked] = useState(false)

  useEffect(() => {
    let cancel = false
    prepareLesson(lesson)
      .then((pack) => {
        if (cancel) return
        setWords(pack.cards)
        setQuestions(pack.questions)
      })
      .catch((error: unknown) => {
        if (cancel) return
        setFailed(error instanceof ApiError ? error.message : t('english.writing'))
      })
    return () => {
      cancel = true
    }
  }, [lesson, t])

  const question = questions[step]
  const correct = checked && picked === question?.answer
  const progress = questions.length === 0 ? 0 : Math.round(((step + (checked ? 1 : 0)) / questions.length) * 100)

  useEffect(() => {
    if (checked) resultRef.current?.scrollIntoView({ block: 'nearest' })
  }, [checked, step])

  function check() {
    if (!question || picked === null || checked) return
    const right = picked === question.answer
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
      <div className="mx-auto max-w-xl">
        <p className="text-sm text-destructive">{failed}</p>
        <Button type="button" className="mt-4" onClick={onExit}>{t('english.backToPath')}</Button>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div aria-busy="true" className="mx-auto flex h-48 max-w-xl items-center justify-center rounded-xl bg-muted">
        <p className="text-sm text-muted-foreground">{t('english.writing')}</p>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button type="button" size="icon" variant="ghost" aria-label={t('english.quit')} onClick={onExit}>
            <X />
          </Button>
          <h1 className="font-display text-3xl tracking-tight">{t('english.lessonNode', { n: lesson + 1 })}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('english.learnThese')}</p>
        <ol className="flex flex-col gap-3">
          {words.map((card) => {
            const cloze = questions.find((item) => item.kind === 'cloze' && item.answer.toLowerCase() === card.word.toLowerCase())
            const example = cloze && cloze.kind === 'cloze' ? `${cloze.before}${cloze.answer}${cloze.after}` : (card.examples[0] ?? '')
            const chinese = cloze?.chinese ?? ''
            return (
              <li key={card.id} className="rounded-2xl border border-border bg-card px-4 py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="flex items-baseline gap-2">
                    <span className="font-display text-2xl tracking-tight">{card.word}</span>
                    <Pronunciation word={card.word} pronunciation={card.pronunciation} />
                  </span>
                  <span className="text-sm text-muted-foreground">{card.meaning}</span>
                </div>
                <WordSenses senses={card.senses} />
                <BandNotes band={card.band} />
                {example ? (
                  <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed">
                    <span className="flex-1">{example}</span>
                    <Pronunciation word={example} showText={false} />
                  </p>
                ) : null}
                {chinese ? <p className="mt-1 text-sm leading-relaxed text-primary">{chinese}</p> : null}
              </li>
            )
          })}
        </ol>
        <Button type="button" className="h-12 text-base" onClick={() => setStarted(true)}>{t('english.start')}</Button>
      </div>
    )
  }

  const bandCards = words.filter((card) => Boolean(card.band?.writing && card.band?.weak))
  const bandCard = started ? bandCards[bandStep] : undefined
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
            return
          }
          setBandStep((current) => current + 1)
          setBandPicked(null)
          setBandChecked(false)
        }}
        onExit={onExit}
      />
    )
  }

  if (finished) {
    const won = finished === 'done'
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-5xl tracking-tight">{won ? t('english.lessonDone') : t('english.outOfHearts')}</h1>
        <p className="text-muted-foreground">
          {won ? t('english.lessonScore', { correct: correctCount, total: questions.length, xp: correctCount * XP_PER_CORRECT }) : t('english.tryAgain')}
        </p>
        <Button type="button" className="mt-2 h-12 px-8 text-base" onClick={onExit}>{t('english.backToPath')}</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col">
      <div className="flex items-center gap-3">
        <Button type="button" size="icon" variant="ghost" aria-label={t('english.quit')} onClick={onExit}>
          <X />
        </Button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs font-medium text-muted-foreground tabular-nums">{t('english.questionOf', { n: step + 1, total: questions.length })}</p>
        <p className="flex items-center gap-0.5" aria-label={t('english.hearts', { n: hearts })}>
          {Array.from({ length: HEARTS }, (_, index) => (
            <Heart
              key={index}
              className={index < hearts ? 'size-4 fill-destructive text-destructive' : 'size-4 text-muted-foreground/35'}
              aria-hidden="true"
            />
          ))}
        </p>
      </div>

      <div className="flex flex-col gap-6 py-8">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {question.kind === 'meaning' ? t('english.promptMeaning') : t('english.promptCloze')}
        </p>
        <Prompt question={question} words={words} picked={picked} checked={checked} />
        <div className="grid gap-3">
          {question.choices.map((choice) => {
            const selected = picked === choice
            const showCorrect = checked && choice === question.answer
            const showWrong = checked && selected && choice !== question.answer
            const card = words.find((item) => item.word.toLowerCase() === choice.toLowerCase())
            const gloss = question.kind === 'cloze' ? card?.meaning : ''
            const ipa = question.kind === 'cloze' ? card?.pronunciation : ''
            return (
              <div key={choice} className="flex items-stretch gap-2">
                <button
                  type="button"
                  disabled={checked}
                  aria-pressed={selected}
                  className={
                    showCorrect
                      ? 'flex-1 rounded-2xl border-2 border-primary bg-primary/10 px-4 py-3 text-left'
                      : showWrong
                        ? 'flex-1 rounded-2xl border-2 border-destructive bg-destructive/10 px-4 py-3 text-left'
                        : selected
                          ? 'flex-1 rounded-2xl border-2 border-primary bg-card px-4 py-3 text-left'
                          : 'flex-1 rounded-2xl border-2 border-border bg-card px-4 py-3 text-left hover:bg-muted'
                  }
                  onClick={() => setPicked(choice)}
                >
                  <span className="flex items-baseline gap-2 text-base font-medium">
                    <span>{choice}</span>
                    {ipa ? <span className="text-sm font-normal text-muted-foreground">{ipa}</span> : null}
                  </span>
                  {checked && gloss ? <span className="mt-0.5 block text-sm text-muted-foreground">{gloss}</span> : null}
                </button>
                {question.kind === 'cloze' ? <Pronunciation word={choice} pronunciation={ipa} showText={false} /> : null}
              </div>
            )
          })}
        </div>
      </div>

      <div ref={resultRef} className={`rounded-2xl px-4 py-4 ${correct ? 'bg-primary/10' : checked ? 'bg-destructive/10' : ''}`}>
        {checked && picked ? <Result question={question} correct={correct} /> : null}
        {checked ? (
          <Button type="button" className="h-12 w-full text-base" onClick={continueLesson}>{t('english.continue')}</Button>
        ) : (
          <Button type="button" className="h-12 w-full text-base" disabled={picked === null} onClick={check}>{t('english.check')}</Button>
        )}
      </div>
    </div>
  )
}

function Result({ question, correct }: { question: Question; correct: boolean }) {
  const { t } = useI18n()
  return (
    <div className="mb-3 flex flex-col gap-2">
      <p className="font-display text-2xl">{correct ? t('english.correct') : t('english.wrong')}</p>
      {question.why ? <p className="text-sm leading-relaxed">{question.why}</p> : null}
      {question.chinese ? <p className="text-base leading-relaxed text-primary">{question.chinese}</p> : null}
    </div>
  )
}

function wordPronunciation(words: EnglishCard[], word: string) {
  return words.find((card) => card.word.toLowerCase() === word.toLowerCase())?.pronunciation ?? ''
}

function Prompt({ question, words, picked, checked }: { question: Question; words: EnglishCard[]; picked: string | null; checked: boolean }) {
  if (question.kind === 'meaning') {
    return (
      <h1 className="flex items-baseline gap-3 font-display text-5xl tracking-tight">
        <span>{question.prompt}</span>
        <Pronunciation word={question.prompt} pronunciation={wordPronunciation(words, question.prompt)} textClassName="text-lg" />
      </h1>
    )
  }
  const filled = checked ? question.answer : picked
  return (
    <div>
      <p className="text-2xl leading-relaxed">
        {question.before}
        <span className={`mx-1 inline-block min-w-20 border-b-2 px-1 text-center font-display ${filled ? 'border-primary text-primary' : 'border-muted-foreground/40'}`}>
          {filled || '\u00a0'}
        </span>
        {question.after}
      </p>
      {filled ? <div className="mt-2"><Pronunciation word={filled} pronunciation={wordPronunciation(words, filled)} /></div> : null}
    </div>
  )
}
