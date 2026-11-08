import { useEffect, useRef, useState } from 'react'
import { Heart, Star, X } from 'lucide-react'
import { BandDrill } from '@/components/band-notes'
import { Pronunciation } from '@/components/pronunciation'
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
  const [bandStep, setBandStep] = useState(-1)
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
      const drills = words.filter((card) => Boolean(card.band?.writing && card.band?.weak))
      if (drills.length > 0 && bandStep < 0) {
        setBandStep(0)
        return
      }
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
      <div className="flex flex-col gap-4 pb-4">
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
        <ol className="flex flex-col gap-3">
          {words.map((card) => {
            const cloze = questions.find((item) => item.kind === 'cloze' && item.answer.toLowerCase() === card.word.toLowerCase())
            const example = cloze && cloze.kind === 'cloze' ? `${cloze.before}${cloze.answer}${cloze.after}` : (card.examples[0] ?? '')
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
            onComplete(correctTotal.current)
            setFinished('done')
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

  const promptCard = question.kind === 'meaning'
    ? words.find((card) => card.word.toLowerCase() === question.prompt.toLowerCase())
    : words.find((card) => card.word.toLowerCase() === question.answer.toLowerCase())

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button type="button" size="icon" variant="ghost" aria-label={t('english.quit')} onClick={onExit}>
          <X />
        </Button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
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
      <h1 className="text-xl font-medium">{question.kind === 'meaning' ? t('english.promptMeaning') : t('english.promptCloze')}</h1>
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
      <div className="grid gap-2">
        {question.choices.map((choice, index) => {
          const selected = picked === choice
          const showCorrect = checked && choice === question.answer
          const showWrong = checked && selected && choice !== question.answer
          const letter = 'ABCD'[index] ?? ''
          return (
            <button
              key={`${choice}-${index}`}
              type="button"
              disabled={checked}
              aria-pressed={selected}
              className={
                showCorrect
                  ? 'flex items-center gap-3 rounded-2xl border border-primary bg-primary/15 px-3 py-3 text-left'
                  : showWrong
                    ? 'flex items-center gap-3 rounded-2xl border border-destructive bg-destructive/10 px-3 py-3 text-left'
                    : selected
                      ? 'flex items-center gap-3 rounded-2xl border border-primary bg-card px-3 py-3 text-left'
                      : 'flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-left'
              }
              onClick={() => setPicked(choice)}
            >
              <span className={`grid size-7 place-items-center rounded-full text-xs font-medium ${showCorrect ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{letter}</span>
              <span className="flex-1 text-sm">{choice}</span>
              {showCorrect ? <span className="text-xs text-primary">{t('english.correct')}</span> : null}
            </button>
          )
        })}
      </div>
      <div ref={resultRef}>
        {checked && picked ? <Result question={question} correct={correct} card={promptCard} /> : null}
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

function Result({ question, correct, card }: { question: Question; correct: boolean; card?: EnglishCard }) {
  const { t } = useI18n()
  return (
    <div className={`rounded-3xl border px-4 py-4 ${correct ? 'border-primary/40 bg-primary/10' : 'border-destructive/40 bg-destructive/10'}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 font-medium">
          <span className={`grid size-5 place-items-center rounded-full text-xs ${correct ? 'bg-primary text-primary-foreground' : 'bg-destructive text-white'}`}>{correct ? '✓' : '×'}</span>
          {correct ? t('english.answeredRight') : t('english.wrong')}
        </p>
        {correct ? <span className="text-sm text-primary">{t('english.points', { n: XP_PER_CORRECT })}</span> : null}
      </div>
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
