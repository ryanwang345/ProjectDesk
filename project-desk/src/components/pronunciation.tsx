import { useSyncExternalStore } from 'react'
import { LoaderCircle, Square, Volume2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import { getSpeechState, speakWord, stopSpeech, subscribeSpeech } from '@/lib/speech'

export { speakWord } from '@/lib/speech'

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
  const { t, locale } = useI18n()
  const state = useSyncExternalStore(subscribeSpeech, getSpeechState)
  const ipa = pronunciation?.trim() ?? ''
  const current = state.text === word.trim().replace(/\s+/g, ' ')
  const loading = current && state.status === 'loading'
  const playing = current && state.status === 'playing'
  const isZh = locale === 'zh'
  const label = playing || loading
    ? (isZh ? '停止播放' : 'Stop pronunciation')
    : current && state.status === 'ready'
      ? (isZh ? '再次点击播放' : 'Tap again to play')
      : t('english.pronounce', { word })
  let detail = ''
  if (current) {
    if (state.status === 'error') detail = isZh ? '无法播放，请重试' : 'Could not play. Try again.'
    else if (state.status === 'ready') detail = isZh ? '点击播放' : 'Tap to play'
    else if (state.source === 'recording') detail = isZh ? '真人录音' : 'Recording'
    else if (state.source === 'neural') detail = isZh ? 'AI 语音' : 'AI voice'
    else if (state.source === 'device') detail = isZh ? '设备语音' : 'Device voice'
    if (detail && state.accent === 'en-GB') detail += ' · UK'
    if (detail && state.accent === 'en-US') detail += ' · US'
  }
  const Icon = loading ? LoaderCircle : playing ? Square : Volume2
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle" data-pronunciation={word}>
      {showText && ipa ? (
        <span className={`font-sans font-normal tracking-normal text-muted-foreground ${textClassName}`}>{ipa}</span>
      ) : null}
      <button
        type="button"
        className={orb
          ? 'inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary hover:bg-primary/25'
          : 'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/10'}
        aria-label={label}
        aria-pressed={playing || loading}
        title={label}
        onClick={(event) => {
          event.stopPropagation()
          if (playing || loading) stopSpeech()
          else void speakWord(word)
        }}
      >
        <Icon className={`${orb ? 'size-5' : 'size-4'} ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
      </button>
      {detail ? (
        <span className="text-[10px] font-normal text-muted-foreground" aria-live="polite">
          {state.source === 'recording' && state.sourceUrl ? (
            <a href={state.sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-border underline-offset-2" onClick={(event) => event.stopPropagation()}>{detail}</a>
          ) : detail}
          {state.source === 'recording' && state.license ? <>{' '}<a href={state.license.url} target="_blank" rel="noreferrer" className="underline decoration-border underline-offset-2" onClick={(event) => event.stopPropagation()}>{state.license.name}</a></> : null}
        </span>
      ) : null}
    </span>
  )
}
