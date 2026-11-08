import { Volume2 } from 'lucide-react'
import { useI18n } from '@/i18n'

let speaking: SpeechSynthesisUtterance | null = null

function englishVoice(synth: SpeechSynthesis) {
  const voices = synth.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('en'))
  return voices.find((voice) => voice.localService && voice.lang.toLowerCase().startsWith('en-gb'))
    ?? voices.find((voice) => voice.localService)
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('en-gb'))
    ?? voices[0]
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.getVoices()
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    window.speechSynthesis.getVoices()
  })
}

export function speakWord(word: string) {
  const synth = window.speechSynthesis
  const text = word.trim()
  if (!synth || text === '') return

  const play = (fallback: boolean) => {
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 0.9
    utter.volume = 1
    const voice = fallback ? undefined : englishVoice(synth)
    if (voice) {
      utter.voice = voice
      utter.lang = voice.lang
    } else {
      utter.lang = 'en-US'
    }
    // Keep the utterance alive. Chrome drops speech that nothing still references.
    speaking = utter
    utter.onend = () => {
      if (speaking === utter) speaking = null
    }
    utter.onerror = (event) => {
      if (speaking === utter) speaking = null
      if (!fallback && event.error !== 'interrupted' && event.error !== 'canceled') play(true)
    }
    synth.resume()
    synth.speak(utter)
  }

  // Cancelling and speaking in the same turn makes Chrome stay silent.
  if (synth.speaking || synth.pending) {
    synth.cancel()
    window.setTimeout(() => play(false), 80)
    return
  }
  play(false)
}

export function Pronunciation({
  word,
  pronunciation,
  showText = true,
  textClassName = 'text-sm',
  orb = false,
}: {
  word: string
  pronunciation?: string
  showText?: boolean
  textClassName?: string
  orb?: boolean
}) {
  const { t } = useI18n()
  const ipa = pronunciation?.trim() ?? ''
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      {showText && ipa ? (
        <span className={`font-sans font-normal tracking-normal text-muted-foreground ${textClassName}`}>{ipa}</span>
      ) : null}
      <button
        type="button"
        className={
          orb
            ? 'inline-flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary hover:bg-primary/25'
            : 'inline-flex size-7 items-center justify-center rounded-full text-primary hover:bg-primary/10'
        }
        aria-label={t('english.pronounce', { word })}
        onClick={(event) => {
          event.stopPropagation()
          speakWord(word)
        }}
      >
        <Volume2 className={orb ? 'size-5' : 'size-4'} aria-hidden="true" />
      </button>
    </span>
  )
}
