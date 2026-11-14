import { type ReactNode, useEffect, useRef, useState } from 'react'
import {
  Eye,
  EyeOff,
  Mic,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Square,
  Volume2,
} from 'lucide-react'
import {
  type RadioLiveWeather,
  type RadioVocabularyItem,
} from '@/lib/radio-news'
import { preferredEnglishVoice, setSpeechPreferences, speakWord, stopSpeech } from '@/lib/speech'
import { cn } from '@/lib/utils'

// Internal helper to split English paragraph into clean sentences
function splitEnglishSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  const raw = cleaned.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [cleaned]
  const out: string[] = []
  for (const s of raw) {
    const trimmed = s.trim()
    if (!trimmed) continue
    // Merge tiny abbreviations like "U.S." or "p.m." with previous or next
    if (out.length > 0 && (trimmed.length < 18 || /^(?:U\.S\.|a\.m\.|p\.m\.|St\.|Mr\.|Ms\.|Dr\.)/i.test(trimmed))) {
      out[out.length - 1] = `${out[out.length - 1]} ${trimmed}`
    } else {
      out.push(trimmed)
    }
  }
  return out
}

function splitChineseSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  return cleaned
    .split(/(?<=[。！？；])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function speakWithRateAndCallback(text: string, rate: number, onEnd?: () => void) {
  stopSpeech()
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    setSpeechPreferences({ speed: rate < 0.9 ? 'slow' : 'normal' })
    void speakWord(text).finally(() => onEnd?.())
    return
  }
  const synth = window.speechSynthesis
  synth.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  const voice = preferredEnglishVoice(synth.getVoices(), 'en-US')
  if (voice) utter.voice = voice
  utter.lang = voice?.lang ?? 'en-US'
  utter.rate = rate
  utter.pitch = 1
  utter.onend = () => onEnd?.()
  utter.onerror = () => onEnd?.()
  synth.speak(utter)
}

// ============================================================================
// 5. Weather Spoken Briefing Bar (Daily Weather & Traffic Oral Templates)
// ============================================================================
export function WeatherSpokenBriefingBar({
  weather,
  zh,
}: {
  weather?: RadioLiveWeather
  zh: boolean
}) {
  const [open, setOpen] = useState(false)
  const [styleIdx, setStyleIdx] = useState<0 | 1 | 2>(0)

  const temp = weather ? Math.round(weather.temperatureC) : 6
  const feels = weather ? Math.round(weather.feelsLikeC) : 3
  const high = weather?.highC ?? temp + 1
  const low = weather?.lowC ?? temp - 4
  const cond = (weather?.condition || 'Partly cloudy').toLowerCase()
  const wind = weather ? Math.round(weather.windSpeedKmh) : 13
  const gust = weather ? Math.round(weather.windGustsKmh) : 30
  const compass = weather?.windCompass ?? 'NW'
  const humidity = weather?.humidityPct ?? 61
  const pressure = weather?.pressureKpa ?? 101.3

  const scripts = [
    {
      id: 'casual',
      labelEn: 'Casual Small Talk',
      labelZh: '日常寒暄 (Small Talk)',
      tag: 'Spoken · Band 6.5+',
      en: `It’s ${temp} degrees and ${cond} in Toronto right now, but with that ${wind} km/h breeze it feels closer to ${feels}°C—definitely dress in layers if you’re heading out.`,
      zh: `多伦多现在 ${temp} 度、${weather?.conditionZh || '多云'}，但加上 ${wind} 公里的风速，体感只有 ${feels}°C 左右——出门一定记得多穿点。`,
      highlights: ['dress in layers (穿多层保暖)', 'feels closer to (体感接近)', 'heading out (出门)'],
    },
    {
      id: 'office',
      labelEn: 'Office & Commute',
      labelZh: '职场通勤 (Office Chat)',
      tag: 'Natural · Band 7.0+',
      en: `We’re looking at a high of ${high}°C and an overnight low of ${low}°C today, with ${compass} gusts reaching ${gust} km/h and ${humidity}% humidity across the GTA.`,
      zh: `今天最高气温预计 ${high}°C，夜间最低 ${low}°C，大多伦多地区伴有高达 ${gust} km/h 的${compass}阵风，湿度 ${humidity}%。`,
      highlights: ['looking at a high of (预计最高温)', 'overnight low (夜间最低温)', 'gusts reaching (阵风达)'],
    },
    {
      id: 'anchor',
      labelEn: '680 Weather Anchor',
      labelZh: '广播主播腔 (680 Anchor)',
      tag: 'Broadcast · Band 8.0',
      en: `Checking the 680 Weather Centre: current conditions are ${cond} at ${temp} degrees Celsius, factoring in the wind chill it feels like ${feels}, with barometric pressure holding at ${pressure.toFixed(1)} kilopascals.`,
      zh: `这里是 680 气象中心：当前天气${weather?.conditionZh || '多云'}，气温 ${temp} 摄氏度，计入风寒效应后体感 ${feels} 度，气压维持在 ${pressure.toFixed(1)} 千帕。`,
      highlights: ['factoring in (计入/考虑到)', 'wind chill (风寒效应)', 'barometric pressure (大气压强)'],
    },
  ]

  const current = scripts[styleIdx]

  return (
    <div className="mt-2.5 rounded-xl bg-[#0f233c]/80 px-3 py-2 text-white backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-left text-xs font-semibold text-white hover:text-sky-200"
        >
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-sky-400/20 text-sky-300">
            <Mic className="size-3" />
          </span>
          <span>
            {zh
              ? '🌤️ 今日多伦多天气口语表达训练 (Speak Today’s Weather · 3 种场景)'
              : '🌤️ Speak Today’s Toronto Weather (Small Talk · Office · 680 Anchor)'}
          </span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-sky-200">
            {open ? (zh ? '收起 ▲' : 'Hide ▲') : zh ? '展开跟读 ▼' : 'Practice ▼'}
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setOpen(true)
              speakWithRateAndCallback(current.en, 1.0)
            }}
            className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white transition hover:bg-white/25"
          >
            <Volume2 className="size-3 text-sky-300" />
            {zh ? '朗读示范' : 'Listen'}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(true)
              speakWithRateAndCallback(current.en, 0.8)
            }}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/90 transition hover:bg-white/20"
          >
            0.8x
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-2.5 border-t border-white/15 pt-2.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {scripts.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyleIdx(idx as 0 | 1 | 2)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
                    styleIdx === idx
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-white/10 text-white/85 hover:bg-white/20',
                  )}
                >
                  {zh ? s.labelZh : s.labelEn}
                </button>
              ))}
            </div>
            <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-sky-200">
              {current.tag}
            </span>
          </div>

          <p className="text-sm leading-relaxed font-medium text-white">“{current.en}”</p>
          <p className="mt-1 text-xs text-white/75">{current.zh}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold text-sky-300">
              {zh ? '地道气象词块：' : 'Key chunks:'}
            </span>
            {current.highlights.map((chunk) => (
              <button
                key={chunk}
                type="button"
                onClick={() => speakWithRateAndCallback(chunk.split('(')[0].trim(), 0.95)}
                className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-white/90 transition hover:bg-white/20"
              >
                🔊 {chunk}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// 1. Transcript Intensive View (Reading / Cloze Dictation / Sentence Loop)
// ============================================================================
export function TranscriptIntensiveBox({
  transcriptText,
  translationText,
  keyLexis,
  durationLabel,
  zh,
  renderHighlighted,
}: {
  transcriptText: string
  translationText: string
  keyLexis: RadioVocabularyItem[]
  durationLabel: string
  zh: boolean
  renderHighlighted: (text: string, lexis: RadioVocabularyItem[]) => ReactNode
}) {
  const [mode, setMode] = useState<'read' | 'cloze' | 'sentences'>('read')
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({})
  const [revealAll, setRevealAll] = useState(false)
  const [loopingIndex, setLoopingIndex] = useState<number | null>(null)
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const [revealedZhMap, setRevealedZhMap] = useState<Record<number, boolean>>({})
  const loopTimerRef = useRef<number | null>(null)
  const activeLoopRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      activeLoopRef.current = null
      if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current)
    }
  }, [])

  // Build Cloze tokens from transcriptText + keyLexis
  const targetWords = keyLexis.map((k) => k.word.toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean)
  const clozeTokens: { type: 'text' | 'blank'; value: string; answer?: string; blankIndex?: number }[] = []

  if (mode === 'cloze') {
    const wordsAndSpaces = transcriptText.split(/(\s+)/)
    let blankCount = 0
    const usedAnswers = new Set<string>()

    for (const token of wordsAndSpaces) {
      const clean = token.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
      const lower = clean.toLowerCase()
      const matchesLexis = targetWords.some((tw) => lower === tw || (lower.startsWith(tw) && lower.length <= tw.length + 3))
      const isImportantLongWord = clean.length >= 7 && /^[a-zA-Z]+$/.test(clean) && !/^(however|because|through|between|another|toronto|citynews|degrees|celsius|morning|evening|officials)$/i.test(clean)

      if (
        blankCount < 6 &&
        clean.length >= 4 &&
        !usedAnswers.has(lower) &&
        (matchesLexis || (targetWords.length < 4 && isImportantLongWord))
      ) {
        const prefix = token.slice(0, token.indexOf(clean))
        const suffix = token.slice(token.indexOf(clean) + clean.length)
        if (prefix) clozeTokens.push({ type: 'text', value: prefix })
        clozeTokens.push({
          type: 'blank',
          value: clean,
          answer: clean,
          blankIndex: blankCount,
        })
        if (suffix) clozeTokens.push({ type: 'text', value: suffix })
        usedAnswers.add(lower)
        blankCount++
      } else {
        clozeTokens.push({ type: 'text', value: token })
      }
    }
  }

  const totalBlanks = clozeTokens.filter((t) => t.type === 'blank').length
  const solvedBlanks = clozeTokens.filter(
    (t) =>
      t.type === 'blank' &&
      t.blankIndex !== undefined &&
      (revealAll || (userAnswers[t.blankIndex] ?? '').trim().toLowerCase() === (t.answer ?? '').toLowerCase()),
  ).length

  const enSentences = splitEnglishSentences(transcriptText)
  const zhSentences = splitChineseSentences(translationText)

  function stopSentenceLoop() {
    activeLoopRef.current = null
    setLoopingIndex(null)
    setPlayingIndex(null)
    if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current)
    stopSpeech()
  }

  function playSentence(idx: number, sentence: string, rate: number, loop: boolean) {
    if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current)
    if (loop && activeLoopRef.current === idx) {
      stopSentenceLoop()
      return
    }
    activeLoopRef.current = loop ? idx : null
    setLoopingIndex(loop ? idx : null)
    setPlayingIndex(idx)

    const run = () => {
      speakWithRateAndCallback(sentence, rate, () => {
        if (activeLoopRef.current === idx) {
          loopTimerRef.current = window.setTimeout(run, 1100)
        } else {
          setPlayingIndex(null)
        }
      })
    }
    run()
  }

  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-primary uppercase">
          <span>Original broadcast transcript</span>
          <span className="font-mono text-muted-foreground">· {durationLabel}</span>
        </div>

        {/* 3-Mode Intensive Listening Switcher */}
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-card p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => {
              stopSentenceLoop()
              setMode('read')
            }}
            className={cn(
              'rounded-full px-2.5 py-1 transition',
              mode === 'read' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {zh ? '📖 精读高亮' : '📖 Read'}
          </button>
          <button
            type="button"
            onClick={() => {
              stopSentenceLoop()
              setMode('cloze')
            }}
            className={cn(
              'rounded-full px-2.5 py-1 transition',
              mode === 'cloze' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {zh ? '✍️ 挖空听写' : '✍️ Cloze Dictation'}
          </button>
          <button
            type="button"
            onClick={() => {
              stopSentenceLoop()
              setMode('sentences')
            }}
            className={cn(
              'rounded-full px-2.5 py-1 transition',
              mode === 'sentences'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {zh ? '🔁 逐句精听' : '🔁 Sentence Loop'}
          </button>
        </div>
      </div>

      {/* Mode 1: Standard Highlighted Reading */}
      {mode === 'read' && (
        <p className="text-base leading-8 text-foreground">{renderHighlighted(transcriptText, keyLexis)}</p>
      )}

      {/* Mode 2: Cloze Dictation */}
      {mode === 'cloze' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => speakWithRateAndCallback(transcriptText, 1.0)}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground shadow-xs hover:brightness-110"
              >
                <Play className="size-3 fill-current" />
                {zh ? '播放新闻原声 (1.0x)' : 'Play Audio (1.0x)'}
              </button>
              <button
                type="button"
                onClick={() => speakWithRateAndCallback(transcriptText, 0.8)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-foreground hover:border-primary/40"
              >
                🐢 {zh ? '0.8x 慢速听写' : '0.8x Slow'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-primary">
                {solvedBlanks} / {totalBlanks} {zh ? '已填对' : 'correct'}
              </span>
              <button
                type="button"
                onClick={() => setRevealAll((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                {revealAll ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                {revealAll ? (zh ? '隐藏答案' : 'Hide Answers') : zh ? '显示答案' : 'Show Answers'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserAnswers({})
                  setRevealAll(false)
                }}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                title={zh ? '重置填空' : 'Reset'}
              >
                <RotateCcw className="size-3" />
              </button>
            </div>
          </div>

          <div className="text-base leading-9 text-foreground">
            {clozeTokens.map((tok, i) => {
              if (tok.type === 'text') {
                return <span key={i}>{tok.value}</span>
              }
              const bIdx = tok.blankIndex ?? 0
              const ans = tok.answer ?? ''
              const val = revealAll ? ans : (userAnswers[bIdx] ?? '')
              const isCorrect = val.trim().toLowerCase() === ans.toLowerCase()
              return (
                <span key={i} className="mx-1 inline-flex items-center gap-1 align-baseline">
                  <input
                    type="text"
                    value={val}
                    disabled={revealAll}
                    placeholder={`${ans[0]}${'_'.repeat(Math.max(2, ans.length - 1))}`}
                    onChange={(e) => setUserAnswers((prev) => ({ ...prev, [bIdx]: e.target.value }))}
                    style={{ width: `${Math.max(ans.length + 2, 7)}ch` }}
                    className={cn(
                      'rounded-lg border px-2 py-0.5 font-mono text-sm font-semibold transition outline-none',
                      isCorrect
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'border-primary/50 bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => speakWithRateAndCallback(ans, 0.9)}
                    title={zh ? '听该词发音提示' : 'Hear word hint'}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <Volume2 className="size-3.5" />
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Mode 3: Sentence-by-Sentence Intensive Loop */}
      {mode === 'sentences' && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {zh
                ? '点击任意单句精听，或开启「单句循环 (Loop)」反复磨耳朵：'
                : 'Click any sentence to play, slow down to 0.75x, or loop continuously:'}
            </span>
            {loopingIndex !== null && (
              <button
                type="button"
                onClick={stopSentenceLoop}
                className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-0.5 text-[11px] font-bold text-destructive"
              >
                <Square className="size-2.5 fill-current" />
                {zh ? '停止单句循环' : 'Stop Loop'}
              </button>
            )}
          </div>

          {enSentences.map((sent, idx) => {
            const isPlayingThis = playingIndex === idx
            const isLoopingThis = loopingIndex === idx
            const showSentZh = revealedZhMap[idx] ?? false
            const matchingZh = zhSentences[idx] ?? ''

            return (
              <div
                key={idx}
                className={cn(
                  'rounded-xl border p-3 transition',
                  isPlayingThis || isLoopingThis
                    ? 'border-primary bg-primary/10 shadow-xs'
                    : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                    #{idx + 1}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => playSentence(idx, sent, 1.0, false)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-semibold text-foreground hover:border-primary/50 hover:text-primary"
                    >
                      <Play className="size-3 fill-current text-primary" /> 1.0x
                    </button>
                    <button
                      type="button"
                      onClick={() => playSentence(idx, sent, 0.75, false)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-semibold text-foreground hover:border-primary/50 hover:text-primary"
                    >
                      🐢 0.75x
                    </button>
                    <button
                      type="button"
                      onClick={() => playSentence(idx, sent, 0.9, true)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition',
                        isLoopingThis
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Repeat className="size-3" />
                      {isLoopingThis ? (zh ? '循环中…' : 'Looping…') : zh ? '单句循环' : 'Loop'}
                    </button>
                    {matchingZh && (
                      <button
                        type="button"
                        onClick={() => setRevealedZhMap((prev) => ({ ...prev, [idx]: !showSentZh }))}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        {showSentZh ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                        {showSentZh ? (zh ? '隐藏译文' : 'Hide') : zh ? '查看译文' : 'Meaning'}
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-2 text-sm leading-7 font-medium text-foreground">
                  {renderHighlighted(sent, keyLexis)}
                </p>

                {showSentZh && matchingZh && (
                  <p className="mt-1.5 border-t border-border/60 pt-1.5 text-xs text-muted-foreground">
                    {matchingZh}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// 2. Active Shadowing Studio (Record & Compare + SpeechRecognition Diff)
// ============================================================================
type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

export function ActiveShadowingStudio({
  transcriptText,
  zh,
  onClose,
}: {
  transcriptText: string
  zh: boolean
  onClose: () => void
}) {
  const sentences = splitEnglishSentences(transcriptText)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const targetSentence = sentences[selectedIdx] ?? transcriptText

  const [isRecording, setIsRecording] = useState(false)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [recognizedText, setRecognizedText] = useState<string>('')
  const [recError, setRecError] = useState<string | null>(null)
  const [isPlayingUserAudio, setIsPlayingUserAudio] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const userAudioRef = useRef<HTMLAudioElement | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
      recognitionRef.current?.stop()
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [recordedUrl])

  async function startRecording() {
    stopSpeech()
    setRecError(null)
    setRecognizedText('')
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl)
      setRecordedUrl(null)
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          setRecordedUrl(URL.createObjectURL(blob))
        }
      }

      recorder.start()
      setIsRecording(true)

      // Start Web Speech API recognition if supported in browser
      const win = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionInstance
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance
      }
      const SR = win.SpeechRecognition || win.webkitSpeechRecognition
      if (SR) {
        const recognition = new SR()
        recognition.lang = 'en-US'
        recognition.continuous = true
        recognition.interimResults = true
        recognition.onresult = (event) => {
          let full = ''
          for (let i = 0; i < event.results.length; i++) {
            full += `${event.results[i][0].transcript} `
          }
          setRecognizedText(full.trim())
        }
        recognition.onerror = () => {
          // Non-fatal: MediaRecorder still works
        }
        recognitionRef.current = recognition
        recognition.start()
      }
    } catch {
      setRecError(
        zh
          ? '无法访问麦克风，请在浏览器地址栏允许麦克风权限后再试。'
          : 'Microphone access denied. Please allow microphone permission in your browser.',
      )
      setIsRecording(false)
    }
  }

  function stopRecording() {
    setIsRecording(false)
    recognitionRef.current?.stop()
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  function playUserRecording() {
    if (!recordedUrl) return
    stopSpeech()
    if (!userAudioRef.current) {
      userAudioRef.current = new Audio()
    }
    userAudioRef.current.src = recordedUrl
    setIsPlayingUserAudio(true)
    userAudioRef.current.onended = () => setIsPlayingUserAudio(false)
    void userAudioRef.current.play().catch(() => setIsPlayingUserAudio(false))
  }

  // Word-by-word pronunciation match calculation
  const targetWords = targetSentence
    .split(/\s+/)
    .map((w) => ({ raw: w, clean: w.toLowerCase().replace(/[^a-z0-9]/g, '') }))
    .filter((w) => w.clean.length > 0)

  const spokenSet = new Set(
    recognizedText
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean),
  )

  const matchedCount = targetWords.filter((w) => spokenSet.has(w.clean)).length
  const accuracyPct =
    recognizedText && targetWords.length > 0 ? Math.round((matchedCount / targetWords.length) * 100) : null

  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Mic className="size-3.5" />
          </span>
          <h4 className="text-xs font-bold text-foreground">
            {zh ? '🎙️ 680 跟读录音棚与发音诊断 (Active Shadowing Studio)' : '🎙️ Active Shadowing & Recording Studio'}
          </h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          {zh ? '收起录音棚 ✕' : 'Close ✕'}
        </button>
      </div>

      {/* Sentence selector pills */}
      {sentences.length > 1 && (
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">
            {zh ? '选择跟读单句：' : 'Target sentence:'}
          </span>
          {sentences.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSelectedIdx(idx)
                setRecognizedText('')
                setRecordedUrl(null)
              }}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[11px] font-bold transition',
                selectedIdx === idx
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {zh ? `第 ${idx + 1} 句` : `Sentence #${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Target Sentence with Word-by-Word Pronunciation Diff */}
      <div className="rounded-xl border border-border bg-card p-3.5">
        <p className="text-sm leading-7 font-medium text-foreground">
          {targetWords.map((w, idx) => {
            const hasResult = recognizedText.trim().length > 0
            const matched = hasResult && spokenSet.has(w.clean)
            return (
              <button
                key={idx}
                type="button"
                onClick={() => speakWithRateAndCallback(w.clean, 0.9)}
                title={zh ? '点击单独听该词发音' : 'Click to hear word'}
                className={cn(
                  'mr-1.5 inline-block rounded px-1 py-0.5 text-left transition hover:bg-primary/15',
                  hasResult &&
                    (matched
                      ? 'bg-emerald-500/15 font-semibold text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/15 text-amber-800 underline decoration-amber-500/70 decoration-wavy dark:text-amber-300'),
                )}
              >
                {w.raw}
              </button>
            )
          })}
        </p>

        {/* Action controls */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => speakWithRateAndCallback(targetSentence, 1.0)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary"
            >
              <Volume2 className="size-3.5 text-primary" />
              {zh ? '1. 听主播示范 (1.0x)' : '1. Model (1.0x)'}
            </button>
            <button
              type="button"
              onClick={() => speakWithRateAndCallback(targetSentence, 0.8)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              🐢 0.8x
            </button>

            {!isRecording ? (
              <button
                type="button"
                onClick={() => void startRecording()}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-xs hover:brightness-110"
              >
                <Mic className="size-3.5" />
                {recordedUrl
                  ? zh
                    ? '2. 重新录音跟读'
                    : '2. Record Again'
                  : zh
                    ? '2. 开始录音跟读'
                    : '2. Record My Voice'}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex animate-pulse items-center gap-1.5 rounded-full bg-destructive px-3.5 py-1.5 text-xs font-bold text-white"
              >
                <Square className="size-3 fill-current" />
                {zh ? '停止录音 (正在倾听…)' : 'Stop Recording…'}
              </button>
            )}

            {recordedUrl && (
              <button
                type="button"
                onClick={playUserRecording}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/25"
              >
                {isPlayingUserAudio ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-current" />}
                {zh ? '3. 回放我的录音' : '3. Play My Recording'}
              </button>
            )}
          </div>

          {accuracyPct !== null && (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                {zh ? `匹配度 ${accuracyPct}%` : `Accuracy ${accuracyPct}%`} ({matchedCount}/{targetWords.length})
              </span>
            </div>
          )}
        </div>

        {recError && <p className="mt-2 text-xs text-destructive">{recError}</p>}

        {recognizedText && (
          <div className="mt-2.5 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{zh ? '语音识别结果：' : 'Recognized speech: '}</span>“
            {recognizedText}”
            <span className="ml-2 text-[11px] text-primary">
              {zh ? '（点击上方标黄单词可单独正音）' : '(Click any amber word above to hear its pronunciation)'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
