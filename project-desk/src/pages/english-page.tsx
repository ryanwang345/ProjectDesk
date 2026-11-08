import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { BandNotes } from '@/components/band-notes'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EnglishTabs, EnglishTop } from '@/components/english-chrome'
import { LessonPath } from '@/components/lesson-path'
import { LessonPlayer } from '@/components/lesson-player'
import { Pronunciation } from '@/components/pronunciation'
import { Button } from '@/components/ui/button'
import { useEnglish } from '@/hooks/use-english'
import { ensureBand } from '@/lib/api'
import { useI18n } from '@/i18n'
import type { EnglishCard } from '@/lib/english'
import { currentLesson, lessonCount, loadProgress, recordCompletion, type LessonProgress } from '@/lib/lesson'
import type { StorageProblem } from '@/lib/projects'

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
  const [tab, setTab] = useState<'learn' | 'words' | 'me'>('learn')
  const [lesson, setLesson] = useState<number | null>(null)
  const [progress, setProgress] = useState(loadProgress)
  const showNav = lesson === null

  function openPractice() {
    const index = currentLesson(progress.completed, lessonCount(cards.length))
    setLesson(index)
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
  } else if (lesson !== null) {
    body = (
      <LessonPlayer
        lesson={lesson}
        onExit={() => setLesson(null)}
        onComplete={(correct) => setProgress((current) => recordCompletion(current, lesson, correct))}
      />
    )
  } else if (tab === 'words') {
    body = <WordDesk desk={desk} />
  } else if (tab === 'me') {
    body = <MePanel desk={desk} progress={progress} />
  } else {
    body = (
      <LessonPath
        cards={cards}
        progress={progress}
        onStart={setLesson}
      />
    )
  }

  return (
    <div className="english-app fixed inset-0 z-40 overflow-y-auto">
      <div className={`mx-auto w-full max-w-[430px] px-4 pt-2 ${showNav ? 'pb-32' : 'pb-8'}`}>
        <EnglishTop
          streak={progress.streak}
          xp={progress.xp}
          onWords={lesson === null && tab === 'learn' ? () => setTab('words') : undefined}
        />
        {body}
      </div>
      {showNav ? (
        <EnglishTabs
          tab={tab}
          onChange={(next) => {
            if (next === 'practice') openPractice()
            else setTab(next)
          }}
        />
      ) : null}
    </div>
  )
}

function WordDesk({
  desk,
}: {
  desk: ReturnType<typeof useEnglish>
}) {
  const { t } = useI18n()
  const { cards, ready, problem, markReview, removeCard, adoptCard } = desk
  const [pendingDelete, setPendingDelete] = useState<EnglishCard | null>(null)
  const [shownId, setShownId] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [exampleAt, setExampleAt] = useState<Record<string, number>>({})
  const [wordQuery, setWordQuery] = useState('')
  const [letter, setLetter] = useState('A')
  const [bandState, setBandState] = useState<'idle' | 'wait' | 'failed'>('idle')
  const bandFlight = useRef<string | null>(null)
  const bandFailed = useRef<string | null>(null)
  const current = cards.find((card) => card.id === shownId) ?? cards.find((card) => wordLetter(card.word) === letter) ?? cards[0] ?? null
  const query = wordQuery.trim().toLowerCase()
  const catalog = [...cards].sort((a, b) => a.word.localeCompare(b.word))
  const visibleWords = catalog.filter((card) => {
    if (!query) return wordLetter(card.word) === letter
    const senses = card.senses ?? []
    return card.word.toLowerCase().includes(query)
      || card.meaning.toLowerCase().includes(query)
      || senses.some((sense) => sense.zh.includes(wordQuery.trim()))
  })

  useEffect(() => {
    if (!current) return
    const card = current
    if (card.band?.writing) {
      setBandState('idle')
      return
    }
    if (bandFlight.current === card.id || bandFailed.current === card.id) return
    const requested = card.id
    bandFlight.current = requested
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
  }, [current, adoptCard])

  function refreshExample(card: EnglishCard) {
    const count = Math.max(card.examples.length, 1)
    setExampleAt((indexes) => ({ ...indexes, [card.id]: ((indexes[card.id] ?? 0) + 1) % count }))
  }

  const example = current ? current.examples[exampleAt[current.id] ?? 0] : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-medium">{t('english.allWords')}</h1>
        <p className="text-xs text-primary">{t('english.savedCount', { n: cards.length })}</p>
      </div>
      <label className="sr-only" htmlFor="english-search">{t('english.search')}</label>
      <input
        id="english-search"
        value={wordQuery}
        autoComplete="off"
        placeholder={t('english.searchPh')}
        className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        onChange={(event) => setWordQuery(event.target.value)}
      />
      <div className="flex gap-1 overflow-x-auto pb-1">
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
              className={
                selected
                  ? 'grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-medium text-primary-foreground'
                  : 'grid size-8 shrink-0 place-items-center rounded-full text-sm text-muted-foreground disabled:opacity-30'
              }
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
      {problem ? <p className="text-sm text-destructive">{t(PROBLEM_KEY[problem])}</p> : null}
      {!ready || !current ? (
        <p className="text-sm text-muted-foreground">{ready ? t('english.emptyTitle') : t('english.loading')}</p>
      ) : (
        <article className="rounded-3xl border border-primary/25 bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-4xl font-medium tracking-tight">{current.word}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{current.meaning}</p>
              <Pronunciation word={current.word} pronunciation={current.pronunciation} />
            </div>
            <Pronunciation word={current.word} showText={false} orb />
          </div>
          <BandNotes band={current.band} />
          {bandState === 'wait' && !current.band?.writing ? <p className="mt-3 text-sm text-muted-foreground">{t('english.bandWait')}</p> : null}
          {bandState === 'failed' && !current.band?.writing ? <p className="mt-3 text-sm text-destructive">{t('english.bandFailed')}</p> : null}
          {example ? (
            <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed">
              <span className="flex-1"><Highlighted word={current.word} example={example} /></span>
              <Pronunciation word={example} showText={false} />
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => refreshExample(current)}>
              <RefreshCw data-icon="inline-start" />
              {t('english.refreshExample')}
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              disabled={current.inReview || reviewing}
              onClick={() => {
                setReviewing(true)
                void markReview(current.id, true).finally(() => setReviewing(false))
              }}
            >
              {current.inReview ? t('english.inReview') : t('english.addReview')}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => setPendingDelete(current)}>
              {t('english.remove')}
            </Button>
          </div>
        </article>
      )}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">{query ? t('english.allWords') : t('english.letterHeading', { letter })}</h2>
          <p className="text-xs text-muted-foreground">{t('english.wordCount', { n: visibleWords.length })}</p>
        </div>
        {visibleWords.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('english.noMatch')}</p>
        ) : (
          <ul className="flex flex-col">
            {visibleWords.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 border-b border-border py-3 text-left ${card.id === current?.id ? 'text-primary' : ''}`}
                  onClick={() => setShownId(card.id)}
                >
                  <span>
                    <span className="block text-lg">{card.word}</span>
                    <span className="block text-xs text-muted-foreground">{card.pronunciation}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">{card.meaning}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
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
}: {
  desk: ReturnType<typeof useEnglish>
  progress: LessonProgress
}) {
  const { t } = useI18n()
  const review = desk.cards.filter((card) => card.inReview)
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-medium">{t('english.tabMe')}</h1>
      <p className="text-sm text-muted-foreground">{t('english.meLead')}</p>
      <div className="grid grid-cols-2 gap-3">
        <p className="rounded-3xl border border-border bg-card p-4">
          <span className="block text-xs text-muted-foreground">{t('english.streak', { n: progress.streak })}</span>
        </p>
        <p className="rounded-3xl border border-border bg-card p-4">
          <span className="block text-xs text-muted-foreground">{t('english.xp', { n: progress.xp })}</span>
        </p>
      </div>
      <section>
        <h2 className="text-sm font-medium">{t('english.reviewTitle')}</h2>
        {review.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('english.reviewEmpty')}</p>
        ) : (
          <ul className="mt-2">
            {review.map((card) => (
              <li key={card.id} className="flex items-center justify-between gap-3 border-b border-border py-3">
                <span>
                  <span className="block">{card.word}</span>
                  <span className="text-sm text-muted-foreground">{card.meaning}</span>
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
