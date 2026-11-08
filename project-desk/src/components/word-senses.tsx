import { useI18n } from '@/i18n'
import type { MessageKey } from '@/i18n/messages'
import type { WordSense } from '@/lib/english'

const posKey: Record<string, MessageKey> = {
  noun: 'english.pos.noun',
  verb: 'english.pos.verb',
  adjective: 'english.pos.adjective',
  adverb: 'english.pos.adverb',
  preposition: 'english.pos.preposition',
  conjunction: 'english.pos.conjunction',
  pronoun: 'english.pos.pronoun',
  determiner: 'english.pos.determiner',
  phrase: 'english.pos.phrase',
}

export function WordSenses({ senses, compact = false }: { senses?: WordSense[]; compact?: boolean }) {
  const { t } = useI18n()
  const items = senses ?? []
  if (items.length === 0) return null
  const label = (pos: string) => (posKey[pos] ? t(posKey[pos]) : pos)

  if (compact) {
    return (
      <p className="text-sm text-muted-foreground">
        {items.map((sense, index) => (
          <span key={`${sense.pos}-${sense.zh}-${index}`}>
            {index > 0 ? ' · ' : ''}
            <span className="font-medium text-foreground">{label(sense.pos)}</span> {sense.zh}
          </span>
        ))}
      </p>
    )
  }

  return (
    <div className="mt-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('english.meanings')}</p>
      <ol className="mt-2 flex flex-col gap-2">
        {items.map((sense, index) => (
          <li key={`${sense.pos}-${sense.zh}-${index}`}>
            <p className="text-sm">
              <span className="mr-2 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tracking-wide uppercase">{label(sense.pos)}</span>
              <span>{sense.zh}</span>
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{sense.en}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
