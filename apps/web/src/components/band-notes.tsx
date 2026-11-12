import { X } from 'lucide-react'
import { Pronunciation } from '@/components/pronunciation'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import type { BandNote, EnglishCard } from '@/lib/english'

export function BandNotes({ band }: { band?: BandNote | null }) {
  const { t } = useI18n()
  if (!band?.writing || !band.speaking) return null
  const collocations = band.collocations ?? []
  const examples = (band.examples ?? []).filter((sentence) => sentence.trim() !== '')
  const paraphrases = band.paraphrases ?? []

  return (
    <section className="mt-4 rounded-3xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-primary">{t('english.bandTitle')}</h3>
        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium tracking-wide text-primary-foreground uppercase">{t('english.highBand')}</span>
      </div>
      {band.zh ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{band.zh}</p> : null}
      {collocations.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {collocations.map((phrase) => (
            <li key={phrase} className="rounded-full border border-primary/30 px-3 py-1 text-sm text-primary">{phrase}</li>
          ))}
        </ul>
      ) : null}
      <BandLine label={t('english.bandWriting')} text={band.writing} zh={band.writingZh} />
      <BandLine label={t('english.bandSpeaking')} text={band.speaking} zh={band.speakingZh} />
      {examples.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('english.bandExamples')}</p>
          <ul className="mt-1.5 flex flex-col gap-2.5">
            {examples.map((sentence, index) => {
              const sentenceZh = band.examplesZh?.[index]?.trim()
              return (
                <li key={sentence} className="flex items-start gap-2 text-sm leading-relaxed">
                  <div className="min-w-0 flex-1">
                    <p>{sentence}</p>
                    {sentenceZh ? <p className="mt-0.5 text-muted-foreground">{sentenceZh}</p> : null}
                  </div>
                  <Pronunciation word={sentence} showText={false} />
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
      {band.weak || band.fix ? (
        <div className="mt-3 rounded-2xl border border-border bg-background/40 p-3 text-sm leading-relaxed">
          <p className="text-xs font-medium text-primary">{t('english.bandFix')}</p>
          {band.weak ? <p className="mt-2 text-muted-foreground line-through decoration-destructive/70">{band.weak}</p> : null}
          {band.fix ? <p className="mt-2">{band.fix}</p> : null}
          {band.fixZh ? <p className="mt-1 text-muted-foreground">{band.fixZh}</p> : null}
        </div>
      ) : null}
      {paraphrases.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">{t('english.bandParaphrase')}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {paraphrases.map((phrase) => (
              <li key={phrase} className="rounded-full bg-card px-3 py-1 text-sm">{phrase}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

export function bandChoices(card: EnglishCard): string[] {
  const writing = card.band?.writing ?? ''
  const weak = card.band?.weak ?? ''
  const flip = [...card.word].reduce((total, char) => total + char.charCodeAt(0), 0) % 2 === 1
  return flip ? [weak, writing] : [writing, weak]
}

export function BandDrill({
  card,
  index,
  total,
  picked,
  checked,
  onPick,
  onCheck,
  onContinue,
  onExit,
}: {
  card: EnglishCard
  index: number
  total: number
  picked: string | null
  checked: boolean
  onPick: (sentence: string) => void
  onCheck: () => void
  onContinue: () => void
  onExit: () => void
}) {
  const { t } = useI18n()
  const strong = card.band.writing ?? ''
  const right = checked && picked === strong
  const collocations = card.band.collocations ?? []
  const progress = Math.round(((index + (checked ? 1 : 0)) / total) * 100)
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="icon" variant="ghost" aria-label={t('english.bandSkip')} onClick={onExit}>
          <X />
        </Button>
        <div className="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">{t('english.bandStep', { n: index + 1, total })}</p>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{t('english.bandUnscored')}</span>
      </div>
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-medium">{t('english.bandPick')}</h1>
        <p className="inline-flex w-fit flex-wrap items-center gap-2 rounded-full bg-primary/10 py-1 ps-3 pe-1 text-primary">
          <span className="font-medium">{card.word}</span>
          <span className="text-sm">{card.meaning}</span>
          <Pronunciation word={card.word} pronunciation={card.pronunciation} showText={false} />
        </p>
      </div>
      <div className="grid gap-2">
        {bandChoices(card).map((sentence, index) => {
          const isStrong = sentence === strong
          const selected = picked === sentence
          const tone = checked && isStrong
            ? 'border-primary bg-primary/15'
            : checked && selected
              ? 'border-destructive bg-destructive/10'
              : selected
                ? 'border-primary bg-card'
                : 'border-border bg-card hover:border-primary/40'
          return (
            <button
              key={sentence}
              type="button"
              disabled={checked}
              aria-pressed={selected}
              className={`flex min-w-0 items-start gap-3 rounded-2xl border px-3 py-3 text-left ${tone}`}
              onClick={() => onPick(sentence)}
            >
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-medium ${checked && isStrong ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{'AB'[index]}</span>
              <span className="min-w-0 flex-1 pt-0.5 text-sm leading-relaxed break-words">{sentence}</span>
              {checked && isStrong ? <span className="shrink-0 pt-1 text-xs text-primary">{t('english.bandStronger')}</span> : null}
            </button>
          )
        })}
      </div>
      {checked ? (
        <div role="status" className={`rounded-3xl border px-4 py-4 text-sm leading-relaxed ${right ? 'border-primary/40 bg-primary/10' : 'border-destructive/40 bg-destructive/10'}`}>
          <p className="inline-flex items-center gap-2 font-medium">
            <span className={`grid size-5 place-items-center rounded-full text-xs ${right ? 'bg-primary text-primary-foreground' : 'bg-destructive text-white'}`}>{right ? '✓' : '×'}</span>
            {right ? t('english.bandRight') : t('english.bandWrongPick')}
          </p>
          {!right && card.band.weakFixed ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground">{t('english.bandYourFix')}</p>
              <p className="mt-1 text-muted-foreground line-through decoration-destructive/70">{card.band.weak}</p>
              <div className="mt-1.5 flex items-start gap-2 rounded-2xl bg-background/60 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{card.band.weakFixed}</p>
                  {card.band.weakFixedZh ? <p className="mt-0.5 text-muted-foreground">{card.band.weakFixedZh}</p> : null}
                </div>
                <Pronunciation word={card.band.weakFixed} showText={false} />
              </div>
            </div>
          ) : null}
          {card.band.fix ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground">{card.band.weakFixed ? t('english.bandProblem') : t('english.bandWhy')}</p>
              <p className="mt-1">{card.band.fix}</p>
              {card.band.fixZh ? <p className="mt-0.5 text-muted-foreground">{card.band.fixZh}</p> : null}
            </div>
          ) : null}
          <p className="mt-3 text-xs font-medium text-muted-foreground">{t('english.bandStrongLabel')}</p>
          <div className="mt-1.5 flex items-start gap-2 rounded-2xl bg-background/60 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-primary">{strong}</p>
              {card.band.writingZh ? <p className="mt-0.5 text-muted-foreground">{card.band.writingZh}</p> : null}
            </div>
            <Pronunciation word={strong} showText={false} />
          </div>
          {collocations.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground">{t('english.bandAlsoTry')}</p>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {collocations.map((phrase) => (
                  <li key={phrase} className="rounded-full border border-primary/30 bg-card px-3 py-1 text-primary">{phrase}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {checked ? (
        <Button type="button" className="h-12 w-full rounded-full text-base" onClick={onContinue}>{t('english.continue')}</Button>
      ) : (
        <Button type="button" className="h-12 w-full rounded-full text-base" disabled={picked === null} onClick={onCheck}>{t('english.check')}</Button>
      )}
    </div>
  )
}

function BandLine({ label, text, zh }: { label: string; text?: string; zh?: string }) {
  if (!text) return null
  return (
    <div className="mt-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="mt-1 flex items-start gap-2 text-sm leading-relaxed">
        <div className="min-w-0 flex-1">
          <p>{text}</p>
          {zh ? <p className="mt-0.5 text-muted-foreground">{zh}</p> : null}
        </div>
        <Pronunciation word={text} showText={false} />
      </div>
    </div>
  )
}
