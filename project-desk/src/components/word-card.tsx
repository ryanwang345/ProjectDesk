import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { BandNotes } from '@/components/band-notes'
import { Pronunciation } from '@/components/pronunciation'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import type { EnglishCard, WordSense } from '@/lib/english'
import { translateExample } from '@/lib/example-zh'

const POS_SHORT: Record<string, string> = {
  adjective: 'adj.',
  adverb: 'adv.',
  verb: 'v.',
  noun: 'n.',
  preposition: 'prep.',
  conjunction: 'conj.',
  pronoun: 'pron.',
  interjection: 'int.',
  determiner: 'det.',
}

function shortPos(pos: string) {
  const key = pos.trim().toLowerCase().replace(/\.$/, '')
  return POS_SHORT[key] ?? pos
}

function groupSenses(senses: WordSense[]) {
  const order: string[] = []
  const grouped = new Map<string, WordSense[]>()
  for (const sense of senses) {
    const pos = sense.pos.trim() || '—'
    const items = grouped.get(pos)
    if (items) items.push(sense)
    else {
      grouped.set(pos, [sense])
      order.push(pos)
    }
  }
  return order.map((pos) => ({ pos, items: grouped.get(pos) ?? [] }))
}

function sectionId(cardId: string, name: string) {
  return `word-${cardId}-${name}`
}

export function WordCard({
  card,
  reviewing,
  bandState,
  onReview,
  onRemove,
}: {
  card: EnglishCard
  reviewing: boolean
  bandState: 'idle' | 'wait' | 'failed'
  onReview: (inReview: boolean) => void
  onRemove: () => void
}) {
  const { t } = useI18n()
  const senses = card.senses ?? []
  const groups = groupSenses(senses)
  const gloss = senses.map((sense) => sense.zh.trim()).filter(Boolean).slice(0, 3).join('；') || card.meaning
  const examples = card.examples.filter((sentence) => sentence.trim() !== '')
  const [sensesOpen, setSensesOpen] = useState(false)
  const [examplesOpen, setExamplesOpen] = useState(false)
  const shownExamples = examplesOpen ? examples : examples.slice(0, 3)
  const hasGloss = senses.some((sense) => sense.en.trim() !== '')
  const sections = [
    { id: sectionId(card.id, 'sense'), label: t('english.dictSense') },
    { id: sectionId(card.id, 'examples'), label: t('english.dictExamples') },
    { id: sectionId(card.id, 'usage'), label: t('english.dictUsage') },
  ]

  useEffect(() => {
    setSensesOpen(false)
    setExamplesOpen(false)
  }, [card.id])

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <article className="min-w-0 rounded-3xl border border-border bg-card lg:order-2">
      <div className="grid lg:grid-cols-[8.5rem_minmax(0,1fr)]">
        <nav className="flex gap-4 overflow-x-auto border-b border-border px-4 py-3 text-sm text-muted-foreground lg:flex-col lg:gap-3 lg:border-r lg:border-b-0 lg:px-5 lg:py-8" aria-label={t('english.dictSense')}>
          {sections.map((section) => (
            <button key={section.id} type="button" className="shrink-0 text-left hover:text-foreground" onClick={() => jump(section.id)}>
              {section.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 px-4 py-6 md:px-8 md:py-8">
          <div className="flex items-center gap-3">
            <h2 className="text-5xl font-semibold tracking-tight">{card.word}</h2>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full hover:bg-muted"
              aria-pressed={card.inReview}
              aria-label={card.inReview ? t('english.removeReview') : t('english.addReview')}
              disabled={reviewing}
              onClick={() => onReview(!card.inReview)}
            >
              <Star className={card.inReview ? 'size-5 fill-primary text-primary' : 'size-5 text-muted-foreground'} aria-hidden="true" />
            </button>
          </div>
          {card.pronunciation ? (
            <p className="mt-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm">
                <Pronunciation word={card.word} pronunciation={card.pronunciation} />
              </span>
            </p>
          ) : (
            <p className="mt-4">
              <Pronunciation word={card.word} showText={false} />
            </p>
          )}
          {gloss ? (
            <p className="mt-6 max-w-3xl text-base leading-relaxed">
              <span className="font-semibold underline decoration-primary decoration-2 underline-offset-4">{card.word}</span>
              {t('english.commonSense', { meaning: gloss })}
            </p>
          ) : null}

          <section id={sectionId(card.id, 'sense')} className="scroll-mt-24 mt-8">
            <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="h-4 w-1 rounded-full bg-primary" aria-hidden="true" />
              {t('english.dictSense')}
            </h3>
            {groups.length === 0 ? (
              <p className="mt-4 text-base">{card.meaning}</p>
            ) : (
              <dl className="mt-4 flex flex-col gap-4">
                {groups.map((group) => (
                  <div key={group.pos} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3">
                    <dt className="pt-0.5 text-sm text-muted-foreground italic">{shortPos(group.pos)}</dt>
                    <dd className="min-w-0">
                      <p className="text-base leading-relaxed">{group.items.map((sense) => sense.zh).filter(Boolean).join('；') || card.meaning}</p>
                      {sensesOpen ? (
                        <ul className="mt-1 flex flex-col gap-1">
                          {group.items.filter((sense) => sense.en.trim() !== '').map((sense, index) => (
                            <li key={`${sense.en}-${index}`} className="text-sm leading-relaxed text-muted-foreground">{sense.en}</li>
                          ))}
                        </ul>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {hasGloss ? (
              <button type="button" className="mt-4 text-sm text-muted-foreground hover:text-foreground" onClick={() => setSensesOpen((open) => !open)}>
                {sensesOpen ? t('english.fewerSenses') : t('english.moreSenses')}
              </button>
            ) : null}
          </section>

          <section id={sectionId(card.id, 'examples')} className="scroll-mt-24 mt-10">
            <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="h-4 w-1 rounded-full bg-primary" aria-hidden="true" />
              {t('english.dictExamples')}
            </h3>
            {shownExamples.length === 0 ? null : (
              <ol className="mt-4 flex flex-col gap-4">
                {shownExamples.map((sentence) => {
                  const zh = translateExample(sentence, card.word, gloss)
                  return (
                    <li key={sentence} className="flex items-start gap-3 text-base leading-relaxed">
                      <div className="min-w-0 flex-1">
                        <p><Highlighted word={card.word} example={sentence} /></p>
                        {zh ? <p className="mt-1 text-sm text-muted-foreground">{zh}</p> : null}
                      </div>
                      <Pronunciation word={sentence} showText={false} />
                    </li>
                  )
                })}
              </ol>
            )}
            {examples.length > 3 ? (
              <button type="button" className="mt-4 text-sm text-muted-foreground hover:text-foreground" onClick={() => setExamplesOpen((open) => !open)}>
                {examplesOpen ? t('english.fewerExamples') : t('english.moreExamples')}
              </button>
            ) : null}
          </section>

          <section id={sectionId(card.id, 'usage')} className="scroll-mt-24 mt-10">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="h-4 w-1 rounded-full bg-primary" aria-hidden="true" />
              {t('english.dictUsage')}
            </h3>
            <BandNotes band={card.band} />
            {bandState === 'wait' && !card.band?.writing ? <p className="text-sm text-muted-foreground">{t('english.bandWait')}</p> : null}
            {bandState === 'failed' && !card.band?.writing ? <p className="text-sm text-destructive">{t('english.bandFailed')}</p> : null}
          </section>

          <div className="mt-8">
            <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={onRemove}>
              {t('english.remove')}
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}

function Highlighted({ word, example }: { word: string; example: string }) {
  const match = example.toLowerCase().indexOf(word.trim().toLowerCase())
  if (match < 0 || word.trim() === '') return example
  const end = match + word.trim().length
  return (
    <>
      {example.slice(0, match)}
      <span className="font-semibold underline decoration-primary decoration-2 underline-offset-4">{example.slice(match, end)}</span>
      {example.slice(end)}
    </>
  )
}
