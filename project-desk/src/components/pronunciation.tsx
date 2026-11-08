import { Volume2 } from 'lucide-react'
import { useI18n } from '@/i18n'

export function speakWord(word: string) {
  const synth = window.speechSynthesis
  if (!synth || word.trim() === '') return
  synth.cancel()
  const utter = new SpeechSynthesisUtterance(word.trim())
  utter.lang = 'en-GB'
  utter.rate = 0.85
  const voice = synth.getVoices().find((item) => item.lang === 'en-GB')
    ?? synth.getVoices().find((item) => item.lang.toLowerCase().startsWith('en'))
  if (voice) utter.voice = voice
  synth.speak(utter)
}

export function Pronunciation({
  word,
  pronunciation,
  showText = true,
  textClassName = 'text-sm',
}: {
  word: string
  pronunciation?: string
  showText?: boolean
  textClassName?: string
}) {
  const { t } = useI18n()
  const ipa = pronunciation?.trim() ?? ''
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {showText && ipa ? (
        <span className={`font-sans font-normal tracking-normal text-muted-foreground ${textClassName}`}>{ipa}</span>
      ) : null}
      <button
        type="button"
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={t('english.pronounce', { word })}
        onClick={(event) => {
          event.stopPropagation()
          speakWord(word)
        }}
      >
        <Volume2 className="size-4" aria-hidden="true" />
      </button>
    </span>
  )
}
