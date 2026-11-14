import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  Clock,
  ExternalLink,
  Headphones,
  Mic,
  Pause,
  Play,
  Radio,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { InteractiveGlossText } from '@/components/interactive-gloss-text'
import { useEnglish } from '@/hooks/use-english'
import { useI18n } from '@/i18n'
import {
  STATION_680_NEWS,
  type LiveStreamStation,
  type RadioNewsWheelSegment,
  type RadioVocabularyItem,
} from '@/lib/radio-news'
import { formatDurationClock } from '@/lib/reading'
import Hls from 'hls.js'
import { speakWord, stopSpeech } from '@/lib/speech'
import { cn } from '@/lib/utils'

export type RadioNewsPlayerProps = {
  station?: LiveStreamStation
}

const SLOT_COLORS = ['bg-primary', 'bg-amber-400', 'bg-sky-400', 'bg-violet-400']

export function RadioNewsPlayer({ station = STATION_680_NEWS }: RadioNewsPlayerProps) {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  const desk = useEnglish()

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hlsInstanceRef = useRef<Hls | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [, setStreamConnected] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [volume, setVolume] = useState(1.0)
  const [isMuted, setIsMuted] = useState(false)
  const [liveListeningSeconds, setLiveListeningSeconds] = useState(0)
  const [playbackRate, setPlaybackRate] = useState<0.5 | 0.8 | 1 | 1.1 | 1.25>(1)

  // Active news wheel segment
  const [activeSegmentId, setActiveSegmentId] = useState<string>(station.wheelSegments[0].id)
  const [showChinese, setShowChinese] = useState(true)
  const [activeWordToAdd, setActiveWordToAdd] = useState<string | null>(null)

  const currentSegment: RadioNewsWheelSegment =
    station.wheelSegments.find((s) => s.id === activeSegmentId) || station.wheelSegments[0]

  // Track live listening timer
  useEffect(() => {
    if (!isPlaying) return
    const interval = window.setInterval(() => {
      setLiveListeningSeconds((prev) => prev + 1)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [isPlaying])

  // Volume & Mute Sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  // Playback speed sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate, isPlaying])

  function renderHighlighted(seg: RadioNewsWheelSegment) {
    const words = seg.keyLexis.map((k) => k.word.replace(/[^a-z]/gi, '')).filter(Boolean)
    if (words.length === 0) return <InteractiveGlossText text={seg.text} contextSentence={seg.text} />
    const re = new RegExp(`\\b((?:${words.join('|')})[a-z]*)\\b`, 'gi')
    const parts = seg.text.split(re)
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <mark key={i} className="rounded bg-primary/15 px-0.5 font-semibold text-primary underline decoration-primary/60 underline-offset-4">
          <InteractiveGlossText text={part} contextSentence={seg.text} />
        </mark>
      ) : (
        <Fragment key={i}>
          <InteractiveGlossText text={part} contextSentence={seg.text} />
        </Fragment>
      ),
    )
  }

  // Connect to the official 680 News HLS stream (hls.js bundled; native HLS on Safari)
  function startStream() {
    const audio = audioRef.current
    if (!audio) return
    stopSpeech()
    setStreamError(null)
    setIsBuffering(true)
    setStreamConnected(false)

    hlsInstanceRef.current?.destroy()
    hlsInstanceRef.current = null

    const fail = (reason: string) => {
      setIsBuffering(false)
      setIsPlaying(false)
      setStreamConnected(false)
      setStreamError(reason)
    }

    const urls = [station.primaryStreamUrl, station.secondaryStreamUrl]

    if (Hls.isSupported()) {
      const tryUrl = (index: number) => {
        const hls = new Hls({ lowLatencyMode: false, maxBufferLength: 20 })
        hlsInstanceRef.current = hls
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return
          hls.destroy()
          hlsInstanceRef.current = null
          if (index + 1 < urls.length) tryUrl(index + 1)
          else fail(`${data.type}: ${data.details}`)
        })
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          audio.play().then(() => {
            setIsPlaying(true)
            setIsBuffering(false)
            setStreamConnected(true)
          }).catch((err: Error) => fail(err.message))
        })
        hls.loadSource(urls[index])
        hls.attachMedia(audio)
      }
      tryUrl(0)
    } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = urls[0]
      audio.play().then(() => {
        setIsPlaying(true)
        setIsBuffering(false)
        setStreamConnected(true)
      }).catch((err: Error) => fail(err.message))
    } else {
      fail('HLS is not supported in this browser')
    }
  }

  function togglePlay() {
    const audio = audioRef.current
    if (isPlaying || isBuffering) {
      audio?.pause()
      hlsInstanceRef.current?.destroy()
      hlsInstanceRef.current = null
      setIsPlaying(false)
      setIsBuffering(false)
      setStreamConnected(false)
    } else {
      startStream()
    }
  }

  // Keyboard shortcut: Spacebar toggles Play/Pause
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeech()
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy()
      }
    }
  }, [])

  async function handleAddLexisToWordbook(item: RadioVocabularyItem) {
    setActiveWordToAdd(item.word)
    try {
      const existing = desk.cards.find((c) => c.word.toLowerCase() === item.word.toLowerCase())
      if (existing) {
        await desk.markReview(existing.id, true)
      } else {
        await desk.adoptCard({
          id: `seed-${item.word}`,
          word: item.word,
          meaning: item.meaning,
          pronunciation: item.ipa,
          inReview: true,
          generated: true,
          updatedAt: new Date().toISOString(),
          examples: [item.contextSnippet],
          senses: [
            {
              pos: item.pos,
              zh: item.meaning,
              en: '',
            },
          ],
          band: {
            zh: item.band,
            collocations: [],
            writing: '',
            speaking: '',
            weak: '',
            fix: '',
            paraphrases: [],
          },
        })
      }
    } catch {
      // ignore
    } finally {
      setTimeout(() => setActiveWordToAdd(null), 1200)
    }
  }

  const btn = 'inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:text-primary'
  const statusLabel = streamError
    ? zh ? '连接失败' : 'Connection failed'
    : isBuffering
      ? zh ? '缓冲连接中…' : 'Connecting…'
      : isPlaying
        ? zh ? '680 直播信号已连接' : '680 live signal connected'
        : zh ? '直播待命' : 'Standby'
  const segIndex = Math.max(0, station.wheelSegments.findIndex((x) => x.id === currentSegment.id))
  const clip = (seg: RadioNewsWheelSegment) => formatDurationClock(seg.endSecond - seg.startSecond)

  return (
    <div className="flex flex-col gap-5">
      <audio
        ref={audioRef}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false)
          setIsPlaying(true)
        }}
        onPause={() => setIsPlaying(false)}
        onError={() => setIsBuffering(false)}
        preload="none"
      />

      {/* Station header */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
            <Radio className="size-7" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{station.name}</h1>
              <span className="rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">{station.callSign}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Toronto, Canada · 24/7 North American English Intensive Listening Station
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-semibold text-primary">
            ● {zh ? '24/7 官方实况广播' : '24/7 official live feed'}
          </span>
          <span className={cn('rounded-full border px-3 py-1 font-semibold', streamError ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'border-primary/40 bg-primary/10 text-primary')}>
            ● {statusLabel}
          </span>
          <span className="rounded-full border border-border bg-background/60 px-3 py-1 font-mono text-muted-foreground">
            {zh ? '已收听 ' : 'Listened '}{formatDurationClock(liveListeningSeconds)}
          </span>
          <Link to="/listening" className={cn(btn, 'ml-auto')}>
            {zh ? '返回雅思听力' : 'IELTS Listening'} <ArrowRight className="size-3" />
          </Link>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground sm:text-sm">{zh ? station.descriptionZh : station.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={station.officialWebUrl} target="_blank" rel="noreferrer" className={btn}>
            {zh ? 'CityNews 官网直播' : 'CityNews Official Stream'} <ExternalLink className="size-3" />
          </a>
          <a href={station.radioplayerUrl} target="_blank" rel="noreferrer" className={btn}>
            Radioplayer <ExternalLink className="size-3" />
          </a>
        </div>
      </section>

      {streamError && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {zh
            ? '无法连接 680 News 直播流（可能是网络、地区限制或广告拦截器所致）。详情：'
            : 'Could not connect to the 680 News live stream (network, regional restriction, or an ad blocker may be the cause). Details: '}
          <span className="font-mono">{streamError}</span>
          {' · '}
          <a href={station.officialWebUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
            {zh ? '在 CityNews 官网收听' : 'Listen on CityNews'}
          </a>
        </div>
      )}

      {/* Player bar */}
      <section className="rounded-3xl border border-primary/30 bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-5">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? (zh ? '暂停直播' : 'Pause live stream') : zh ? '收听 680 News 直播' : 'Play 680 News live'}
            title={zh ? '播放 / 暂停（空格）' : 'Play / pause (Space)'}
            className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-110 active:scale-95"
          >
            {isPlaying ? <Pause className="size-7 fill-current" /> : <Play className="ml-1 size-7 fill-current" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-base font-bold text-foreground sm:text-lg">
              {isPlaying ? (zh ? '正在收听 680 News 直播' : 'Listening to 680 News live') : zh ? '点击收听 680 News 直播' : 'Click to listen to 680 News live'}
              <span className="text-muted-foreground">· 24/7 ALL-NEWS</span>
              <span className={cn('size-2 rounded-full', isPlaying ? 'animate-pulse bg-primary' : 'bg-muted-foreground')} />
            </p>
            <p className="text-xs text-muted-foreground">
              {zh ? '多伦多实时广播 · 天气与财经' : 'Toronto live audio · weather and business'}
            </p>
          </div>
          <div className="flex h-9 items-end gap-1" aria-hidden="true">
            {[0.3, 0.8, 0.5, 1, 0.7, 0.9, 0.4, 0.85, 0.6, 0.3, 0.7, 0.5].map((h, i) => (
              <span
                key={i}
                className={cn('w-1 rounded-full', isPlaying ? 'animate-pulse bg-primary' : 'bg-muted-foreground/30')}
                style={{ height: isPlaying ? `${Math.max(25, h * 100)}%` : '20%', animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>
          <div className="flex min-w-48 flex-col gap-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setIsMuted((v) => !v)} aria-label={isMuted ? 'Unmute' : 'Mute'} className="text-muted-foreground hover:text-foreground">
                {isMuted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
              <input
                type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume}
                onChange={(e) => { setVolume(parseFloat(e.target.value)); setIsMuted(false) }}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                aria-label="Volume"
              />
              <span className="w-9 text-right font-mono text-xs text-muted-foreground">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowChinese((v) => !v)}
                className={cn(btn, showChinese && 'border-primary/50 bg-primary/10 text-primary')}
              >
                {zh ? (showChinese ? '双语对照 (中)' : '纯英沉浸') : showChinese ? 'Bilingual' : 'English only'}
              </button>
              <div className="flex items-center rounded-full border border-border bg-background/60 p-0.5 text-[11px] font-semibold">
                {([0.5, 0.8, 1, 1.1, 1.25] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPlaybackRate(r)}
                    className={cn('rounded-full px-2 py-0.5', playbackRate === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {r.toFixed(r === 1.25 ? 2 : 1)}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* News clock slots */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Clock className="size-4 text-primary" />
          {zh ? '680 新闻轮盘 (The 680 News Clock)' : 'The 680 News Clock'}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {station.wheelFeatures.map((feat, i) => {
            const seg = station.wheelSegments[i]
            const selected = i === segIndex
            return (
              <button
                key={feat.title}
                type="button"
                onClick={() => seg && setActiveSegmentId(seg.id)}
                className={cn(
                  'flex flex-col gap-2 rounded-2xl border p-4 text-left transition',
                  selected ? 'border-primary/60 bg-primary/10' : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <span className={cn('size-2.5 rounded-full', SLOT_COLORS[i])} />
                    {zh ? ['路况与天气', '大都会要闻', '商业财经', '体育与文化'][i] : ['Traffic & Weather', 'Top Headlines', 'Business & TSX', 'Sports & Culture'][i]}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {selected ? (zh ? '已载入' : 'Active') : `Slot 0${i + 1}`}
                  </span>
                </div>
                <span className="font-display text-base font-semibold text-foreground">{zh ? feat.titleZh : feat.title}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{zh ? feat.descZh : feat.desc}</span>
                <span className="mt-auto pt-1 text-xs font-semibold text-primary">
                  {selected ? (zh ? '已载入文稿 ✓' : 'Transcript loaded ✓') : zh ? '载入文稿' : 'Load transcript'}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Now-selected hero */}
      <section className="relative flex h-40 items-end overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/25 via-card to-background p-5">
        <Radio className="absolute top-5 right-6 size-24 text-primary/15" aria-hidden="true" />
        <div className="relative">
          <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground uppercase">
            {currentSegment.timeMark}
          </span>
          <p className="mt-2 font-display text-lg font-semibold text-foreground">{zh ? currentSegment.titleZh : currentSegment.title}</p>
        </div>
      </section>

      {/* Transcript + lexis */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="flex flex-col gap-3 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Headphones className="size-4 text-primary" />
              {zh ? '680 核心时段原声与精听文稿' : '680 News transcripts'}
            </h2>
            <span className="text-xs text-muted-foreground">
              {zh ? '划过或点击单词即可查看释义并一键加入生词本' : 'Hover or click any word for the dictionary'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {station.wheelSegments.map((seg) => (
              <button
                key={seg.id}
                type="button"
                onClick={() => setActiveSegmentId(seg.id)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-bold transition',
                  seg.id === activeSegmentId ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {seg.timeMark}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">{zh ? currentSegment.titleZh : currentSegment.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {zh ? '播音主播：' : 'Anchor: '}{currentSegment.anchor}
                </p>
              </div>
              <button type="button" onClick={() => void speakWord(currentSegment.text)} className={btn}>
                <Mic className="size-3.5 text-primary" /> {zh ? '朗读跟读 (Shadowing)' : 'Shadowing'}
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-background/60 p-4">
              <div className="mb-2 flex items-center justify-between text-[10px] font-bold tracking-wider text-primary uppercase">
                <span>Original broadcast transcript</span>
                <span className="font-mono text-muted-foreground">{clip(currentSegment)}</span>
              </div>
              <p className="text-base leading-8 text-foreground">{renderHighlighted(currentSegment)}</p>
            </div>

            {showChinese && (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
                <span className="mb-1 block text-xs font-semibold text-foreground">{zh ? '中文对照' : 'Translation'}</span>
                {currentSegment.textZh}
              </div>
            )}

            {currentSegment.liaisons.length > 0 && (
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <h4 className="mb-3 flex items-center gap-2 text-xs font-bold text-foreground">
                  <Sparkles className="size-3.5 text-primary" />
                  {zh ? '真实生活连读与音变诊断 (Liaisons & Reductions)' : 'Liaisons & reductions'}
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {currentSegment.liaisons.map((l) => (
                    <button
                      key={l.phrase}
                      type="button"
                      onClick={() => void speakWord(l.phrase)}
                      className="rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/50"
                    >
                      <span className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-primary">“{l.phrase}”</span>
                        <Volume2 className="size-3.5 text-muted-foreground" />
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{l.ipa}</span>
                      <span className="mt-1 block text-xs text-foreground/85">{zh ? l.noteZh : l.note}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-3 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Sparkles className="size-4 text-primary" />
              {zh ? '680 新闻高频词汇' : '680 News lexis'}
            </h2>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {currentSegment.keyLexis.length} {zh ? '核心词' : 'words'}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {currentSegment.keyLexis.map((item) => {
              const isSaved = desk.cards.some((c) => c.word.toLowerCase() === item.word.toLowerCase() && c.inReview)
              const isAdding = activeWordToAdd === item.word
              return (
                <div key={item.word} className="rounded-2xl border border-border bg-card p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base font-semibold text-foreground">{item.word}</span>
                        <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">{item.band}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                        <span>{item.pos} · {item.ipa}</span>
                        <button type="button" onClick={() => void speakWord(item.word)} aria-label={zh ? '朗读单词' : 'Pronounce'} className="hover:text-foreground">
                          <Volume2 className="size-3.5 text-primary" />
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleAddLexisToWordbook(item)}
                      disabled={isAdding}
                      className={cn(btn, 'px-2.5', isSaved && 'border-primary/50 bg-primary/10 text-primary')}
                    >
                      {isSaved ? <BookmarkCheck className="size-3" /> : <BookmarkPlus className="size-3" />}
                      {isSaved ? (zh ? '已收录' : 'Saved') : isAdding ? (zh ? '添加中…' : 'Adding…') : zh ? '+ 生词本' : '+ Review'}
                    </button>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{item.meaning}</p>
                  <p className="mt-2 rounded-lg bg-muted/50 p-2 text-xs leading-relaxed text-muted-foreground italic">“{item.contextSnippet}”</p>
                </div>
              )
            })}
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs leading-relaxed text-foreground/85">
            <p className="mb-1.5 flex items-center gap-2 font-bold text-primary">
              <Radio className="size-4" />
              {zh ? '为什么 680 News 是学英语的神器？' : 'Why 680 News for English?'}
            </p>
            {zh
              ? '680 News 具有典型的北美全新闻快节奏（每分钟 180–220 词），信息高度精炼，词汇贴近生活（路况、气象、市政、股票与汇率）。每天坚持 15–20 分钟泛听，并随时点击生词加入生词本。'
              : '680 News runs at a brisk North American all-news pace (about 180–220 wpm) with everyday vocabulary: traffic, weather, city hall, markets. Listen 15–20 minutes a day and save new words as you go.'}
          </div>
        </aside>
      </div>
    </div>
  )
}
