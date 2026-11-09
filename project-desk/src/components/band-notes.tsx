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
      <BandLine label={t('english.bandWriting')} text={band.writing} />
      <BandLine label={t('english.bandSpeaking')} text={band.speaking} />
      {examples.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('english.bandExamples')}</p>
          <ul className="mt-1.5 flex flex-col gap-2">
            {examples.map((sentence) => (
              <li key={sentence} className="flex items-start gap-2 text-sm leading-relaxed">
                <span className="flex-1">{sentence}</span>
                <Pronunciation word={sentence} showText={false} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {band.weak || band.fix ? (
        <div className="mt-3 rounded-2xl border border-border bg-background/40 p-3 text-sm leading-relaxed">
          <p className="text-xs font-medium text-primary">{t('english.bandFix')}</p>
          {band.weak ? <p className="mt-2 text-muted-foreground line-through decoration-destructive/70">{band.weak}</p> : null}
          {band.fix ? <p className="mt-2">{band.fix}</p> : null}
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
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl tracking-tight">{card.word}</h1>
        <p className="text-xs font-medium text-muted-foreground tabular-nums">{index + 1} / {total}</p>
      </div>
      <p className="text-sm text-muted-foreground">{t('english.bandPick')}</p>
      <ul className="flex flex-wrap gap-2">
        {(card.band.collocations ?? []).map((phrase) => (
          <li key={phrase} className="rounded-full bg-primary/10 px-3 py-1 text-sm">{phrase}</li>
        ))}
      </ul>
      <div className="grid gap-2">
        {bandChoices(card).map((sentence) => (
          <button
            key={sentence}
            type="button"
            disabled={checked}
            aria-pressed={picked === sentence}
            className={
              checked && sentence === card.band.writing
                ? 'rounded-2xl border border-primary bg-primary/10 px-4 py-3 text-left text-sm leading-relaxed'
                : picked === sentence
                  ? 'rounded-2xl border border-primary bg-primary/10 px-4 py-3 text-left text-sm leading-relaxed'
                  : 'rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm leading-relaxed hover:border-primary/40'
            }
            onClick={() => onPick(sentence)}
          >
            {sentence}
          </button>
        ))}
      </div>
      {checked ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed">
          <p className="font-medium text-primary">{card.band.writing}</p>
          <p className="mt-2">{card.band.fix}</p>
          {card.band.zh ? <p className="mt-2 text-primary">{card.band.zh}</p> : null}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onExit}>{t('english.quit')}</Button>
        {checked ? (
          <Button type="button" className="h-12 flex-1 text-base" onClick={onContinue}>{t('english.continue')}</Button>
        ) : (
          <Button type="button" className="h-12 flex-1 text-base" disabled={picked === null} onClick={onCheck}>{t('english.check')}</Button>
        )}
      </div>
    </div>
  )
}

function BandLine({ label, text }: { label: string; text?: string }) {
  if (!text) return null
  return (
    <div className="mt-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 flex items-start gap-2 text-sm leading-relaxed">
        <span className="flex-1">{text}</span>
        <Pronunciation word={text} showText={false} />
      </p>
    </div>
  )
}
