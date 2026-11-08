import { useState, type FormEvent, type ReactNode } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LessonPath } from '@/components/lesson-path'
import { LessonPlayer } from '@/components/lesson-player'
import { useEnglish } from '@/hooks/use-english'
import { useI18n } from '@/i18n'
import { loadProgress, recordCompletion } from '@/lib/lesson'
import {
  EXAMPLE_COUNT,
  emptyExamples,
  hasEnglishErrors,
  validateEnglish,
  type EnglishCard,
  type EnglishErrors,
  type EnglishInput,
} from '@/lib/english'
import type { StorageProblem } from '@/lib/projects'

const PROBLEM_KEY = {
  unavailable: 'english.unreachable',
  'write-failed': 'english.writeFailed',
} as const satisfies Record<StorageProblem, 'english.unreachable' | 'english.writeFailed'>

const emptyInput: EnglishInput = { word: '', meaning: '', examples: emptyExamples() }

export function EnglishPage() {
  const { t } = useI18n()
  const { cards, ready, problem } = useEnglish()
  const [view, setView] = useState<'path' | 'words'>('path')
  const [lesson, setLesson] = useState<number | null>(null)
  const [progress, setProgress] = useState(loadProgress)

  if (view === 'words') return <WordDesk onBack={() => setView('path')} />

  if (!ready) {
    return (
      <div aria-busy="true" className="h-48 animate-pulse rounded-xl bg-muted">
        <p className="sr-only">{t('english.loading')}</p>
      </div>
    )
  }

  if (problem && cards.length === 0) {
    return <p className="text-sm text-destructive">{t('english.unreachable')}</p>
  }

  if (lesson !== null) {
    return (
      <LessonPlayer
        lesson={lesson}
        onExit={() => setLesson(null)}
        onComplete={(correct) => setProgress((current) => recordCompletion(current, lesson, correct))}
      />
    )
  }

  return (
    <LessonPath
      cards={cards}
      progress={progress}
      onStart={setLesson}
      onOpenWords={() => setView('words')}
    />
  )
}

function WordDesk({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const { cards, ready, problem, addCard, saveCard, markReview, removeCard } = useEnglish()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<EnglishCard | null>(null)
  const [pendingDelete, setPendingDelete] = useState<EnglishCard | null>(null)
  const [shownId, setShownId] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [exampleAt, setExampleAt] = useState<Record<string, number>>({})
  const [exampleOpen, setExampleOpen] = useState<Record<string, boolean>>({})
  const [wordQuery, setWordQuery] = useState('')
  const current = cards.find((card) => card.id === shownId) ?? cards[0] ?? null
  const review = cards.filter((card) => card.inReview)
  const query = wordQuery.trim().toLowerCase()
  const catalog = [...cards].sort((a, b) => a.word.localeCompare(b.word))
  const visibleWords = query
    ? catalog.filter((card) => card.word.toLowerCase().includes(query) || card.meaning.toLowerCase().includes(query))
    : catalog

  function refreshWord() {
    const pool = cards.filter((card) => card.id !== current?.id)
    const choices = pool.length > 0 ? pool : cards
    const next = choices[Math.floor(Math.random() * choices.length)]
    if (next) setShownId(next.id)
  }

  function showExample(id: string) {
    setExampleOpen((open) => ({ ...open, [id]: true }))
  }

  function refreshExample(card: EnglishCard) {
    const count = Math.max(card.examples.length, 1)
    setExampleAt((currentIndexes) => {
      const index = currentIndexes[card.id] ?? 0
      const next = exampleOpen[card.id] ? (index + 1) % count : index
      return { ...currentIndexes, [card.id]: next }
    })
    setExampleOpen((open) => ({ ...open, [card.id]: true }))
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{t('english.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t('english.lead')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onBack}>{t('english.backToPath')}</Button>
          <Button type="button" variant="outline" onClick={refreshWord} disabled={!ready || cards.length < 2}>
            <RefreshCw data-icon="inline-start" />
            {t('english.refresh')}
          </Button>
          <Button type="button" onClick={() => { setAdding(true); setEditing(null) }}>
            <Plus data-icon="inline-start" />
            {t('english.add')}
          </Button>
        </div>
      </div>

      {problem ? (
        <p role="status" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t(PROBLEM_KEY[problem])}
        </p>
      ) : null}

      {adding || editing ? (
        <WordForm
          key={editing?.id ?? 'new'}
          initial={
            editing
              ? { word: editing.word, meaning: editing.meaning, examples: [...editing.examples, ...emptyExamples()].slice(0, EXAMPLE_COUNT) }
              : emptyInput
          }
          submitLabel={editing ? t('english.save') : t('english.add')}
          onCancel={() => { setAdding(false); setEditing(null) }}
          onSubmit={async (input) => {
            if (editing) await saveCard(editing.id, input)
            else await addCard(input)
            setAdding(false)
            setEditing(null)
          }}
        />
      ) : null}

      {!ready ? (
        <div aria-busy="true" className="h-48 animate-pulse rounded-xl bg-muted">
          <p className="sr-only">{t('english.loading')}</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/70 px-6 py-14 text-center">
          <h2 className="font-display text-3xl tracking-tight">{t('english.emptyTitle')}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t('english.emptyBody')}</p>
        </div>
      ) : current ? (
        <div className="grid gap-8">
          <Card>
            <CardHeader>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('english.current')}</p>
              <CardTitle className="font-display text-4xl tracking-tight">{current.word}</CardTitle>
              <p className="text-sm text-muted-foreground">{current.meaning}</p>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('english.how')}</p>
              {current.generated ? (
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-base leading-relaxed">
                {current.examples.map((example, index) => (
                  <li key={`${current.id}-${index}`}>
                    <ExampleSentence word={current.word} example={example} />
                  </li>
                ))}
              </ol>
              ) : <p className="mt-3 text-sm text-muted-foreground">{t('english.awaitAI')}</p>}
            </CardContent>
            <CardFooter className="gap-2">
              <Button
                type="button"
                disabled={current.inReview || reviewing}
                onClick={() => {
                  setReviewing(true)
                  void markReview(current.id, true).finally(() => setReviewing(false))
                }}
              >
                <Plus data-icon="inline-start" />
                {current.inReview ? t('english.inReview') : t('english.addReview')}
              </Button>
            </CardFooter>
          </Card>

          <section className="grid gap-3">
            <h2 className="font-display text-3xl tracking-tight">{t('english.reviewTitle')}</h2>
            {review.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('english.reviewEmpty')}</p>
            ) : (
              <ul className="grid gap-2">
                {review.map((card) => (
                  <WordRow
                    key={card.id}
                    card={card}
                    example={exampleOpen[card.id] ? card.examples[exampleAt[card.id] ?? 0] : undefined}
                    onShow={() => setShownId(card.id)}
                    onExample={() => showExample(card.id)}
                    onRefreshExample={() => refreshExample(card)}
                  >
                    <Button type="button" size="sm" variant="ghost" onClick={() => void markReview(card.id, false)}>
                      {t('english.removeReview')}
                    </Button>
                  </WordRow>
                ))}
              </ul>
            )}
          </section>

          <section className="grid gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-3xl tracking-tight">{t('english.allWords')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t('english.wordCount', { n: visibleWords.length })}</p>
              </div>
              <div className="grid w-full gap-1.5 sm:max-w-xs">
                <Label htmlFor="english-search">{t('english.search')}</Label>
                <Input
                  id="english-search"
                  value={wordQuery}
                  autoComplete="off"
                  placeholder={t('english.searchPh')}
                  onChange={(event) => setWordQuery(event.target.value)}
                />
              </div>
            </div>
            {visibleWords.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('english.noMatch')}</p>
            ) : (
            <ul className="grid gap-2">
              {visibleWords.map((card) => (
                <WordRow
                  key={card.id}
                  card={card}
                  example={exampleOpen[card.id] ? card.examples[exampleAt[card.id] ?? 0] : undefined}
                  onShow={() => setShownId(card.id)}
                  onExample={() => showExample(card.id)}
                  onRefreshExample={() => refreshExample(card)}
                >
                  <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(card); setAdding(false) }}>
                    {t('english.edit')}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPendingDelete(card)}>
                    {t('english.remove')}
                  </Button>
                </WordRow>
              ))}
            </ul>
            )}
          </section>
        </div>
      ) : null}

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

function WordRow({
  card,
  example,
  onShow,
  onExample,
  onRefreshExample,
  children,
}: {
  card: EnglishCard
  example?: string
  onShow: () => void
  onExample: () => void
  onRefreshExample: () => void
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" className="text-left" onClick={onShow}>
          <span className="font-display text-2xl tracking-tight">{card.word}</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">{card.meaning}</span>
        </button>
        <div className="flex flex-wrap gap-2">
          {card.generated ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={onExample}>
                {t('english.showExample')}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onRefreshExample}>
                <RefreshCw data-icon="inline-start" />
                {t('english.refreshExample')}
              </Button>
            </>
          ) : null}
          {children}
        </div>
      </div>
      {card.generated ? null : <p className="text-sm text-muted-foreground">{t('english.awaitAI')}</p>}
      {example && card.generated ? (
        <p className="text-sm leading-relaxed">
          <ExampleSentence word={card.word} example={example} />
        </p>
      ) : null}
    </li>
  )
}

function ExampleSentence({ word, example }: { word: string; example: string }) {
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

function WordForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: EnglishInput
  submitLabel: string
  onSubmit: (input: EnglishInput) => Promise<void>
  onCancel: () => void
}) {
  const { t, localize } = useI18n()
  const [input, setInput] = useState(initial)
  const [errors, setErrors] = useState<EnglishErrors>({})
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = validateEnglish(input)
    setErrors(next)
    if (hasEnglishErrors(next)) return
    setPending(true)
    try {
      await onSubmit({
        word: input.word.trim(),
        meaning: input.meaning.trim(),
        examples: input.examples.map((sentence) => sentence.trim()),
      })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t('english.writeFailed')
      setErrors({ form: message })
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="english-word">{t('english.word')}</Label>
          <Input
            id="english-word"
            value={input.word}
            autoComplete="off"
            placeholder={t('english.wordPh')}
            aria-invalid={Boolean(errors.word)}
            onChange={(event) => setInput((current) => ({ ...current, word: event.target.value }))}
          />
          {errors.word ? <p className="text-sm text-destructive">{localize(errors.word)}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="english-meaning">{t('english.meaning')}</Label>
          <Input
            id="english-meaning"
            value={input.meaning}
            autoComplete="off"
            placeholder={t('english.meaningPh')}
            aria-invalid={Boolean(errors.meaning)}
            onChange={(event) => setInput((current) => ({ ...current, meaning: event.target.value }))}
          />
          {errors.meaning ? <p className="text-sm text-destructive">{localize(errors.meaning)}</p> : null}
        </div>
      </div>
      <div className="grid gap-3">
        <p className="text-sm font-medium">{t('english.example')}</p>
        <p className="text-xs text-muted-foreground">{t('english.exampleHelp')}</p>
        {input.examples.map((sentence, index) => (
          <div key={index} className="grid gap-1.5">
            <Label htmlFor={`english-example-${index}`}>{t('english.exampleItem', { n: index + 1 })}</Label>
            <Textarea
              id={`english-example-${index}`}
              rows={2}
              value={sentence}
              placeholder={index === 0 ? t('english.examplePh') : t('english.exampleMorePh')}
              aria-invalid={Boolean(errors.examples?.[index])}
              onChange={(event) => {
                const value = event.target.value
                setInput((current) => ({
                  ...current,
                  examples: current.examples.map((item, itemIndex) => (itemIndex === index ? value : item)),
                }))
              }}
            />
            {errors.examples?.[index] ? (
              <p className="text-sm text-destructive">{localize(errors.examples[index])}</p>
            ) : null}
          </div>
        ))}
        {errors.form ? <p className="text-sm text-destructive">{localize(errors.form)}</p> : null}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{submitLabel}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>{t('english.cancel')}</Button>
      </div>
    </form>
  )
}
