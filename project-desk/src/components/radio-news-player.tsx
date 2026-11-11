import { useEffect, useRef, useState } from 'react'
import {
  BookmarkCheck,
  BookmarkPlus,
  Compass,
  FastForward,
  Headphones,
  Mic,
  Pause,
  Play,
  Radio,
  Repeat,
  Rewind,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { InteractiveGlossText } from '@/components/interactive-gloss-text'
import { useEnglish } from '@/hooks/use-english'
import { useI18n } from '@/i18n'
import type { RadioBroadcast, RadioSegment, RadioVocabularyItem } from '@/lib/radio-news'
import { formatDurationClock } from '@/lib/reading'
import { speakWord, stopSpeech } from '@/lib/speech'
import { cn } from '@/lib/utils'

export type RadioNewsPlayerProps = {
  broadcast: RadioBroadcast
  onSelectStation?: (stationId: string) => void
}

type SpeedOption = 0.75 | 1.0 | 1.25 | 1.5

export function RadioNewsPlayer({ broadcast }: RadioNewsPlayerProps) {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  const desk = useEnglish()

  // Audio HTML5 state
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null)
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(broadcast.durationSeconds)
  const [playbackRate, setPlaybackRate] = useState<SpeedOption>(1.0)
  const [volume, setVolume] = useState(1.0)
  const [isMuted, setIsMuted] = useState(false)
  const [audioSourceError, setAudioSourceError] = useState(false)

  // UX toggles
  const [showChinese, setShowChinese] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const [loopingSegmentId, setLoopingSegmentId] = useState<string | null>(null)
  const [activeWordToAdd, setActiveWordToAdd] = useState<string | null>(null)

  // Active segment calculation based on currentTime
  const activeSegmentIndex = broadcast.segments.findIndex(
    (seg) => currentTime >= seg.startSecond && currentTime < seg.endSecond,
  )
  const currentSegment: RadioSegment | undefined =
    activeSegmentIndex >= 0 ? broadcast.segments[activeSegmentIndex] : broadcast.segments[0]

  // Reset playback when switching broadcast
  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(broadcast.durationSeconds)
    setAudioSourceError(false)
    setLoopingSegmentId(null)
    stopSpeech()

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current.playbackRate = playbackRate
    }
  }, [broadcast.id, broadcast.durationSeconds, playbackRate])

  // Playback rate sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  // Volume & Mute sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  // Segment looping enforcement
  useEffect(() => {
    if (!loopingSegmentId) return
    const target = broadcast.segments.find((s) => s.id === loopingSegmentId)
    if (!target) return

    if (currentTime >= target.endSecond) {
      if (audioRef.current) {
        audioRef.current.currentTime = target.startSecond
        audioRef.current.play().catch(() => {})
      }
    }
  }, [currentTime, loopingSegmentId, broadcast.segments])

  // Auto-scroll transcript to active segment
  useEffect(() => {
    if (!autoScroll || activeSegmentIndex < 0) return
    const seg = broadcast.segments[activeSegmentIndex]
    if (!seg) return

    const el = segmentRefs.current[seg.id]
    if (el && transcriptContainerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeSegmentIndex, autoScroll, broadcast.segments])

  // Spacebar keyboard listener for play/pause toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        jumpSeconds(-5)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        jumpSeconds(5)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying])

  function togglePlay() {
    if (!audioRef.current) return
    stopSpeech()

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          // Fallback to speech synthesis if audio file cannot be loaded
          setAudioSourceError(true)
          if (currentSegment) {
            void speakWord(currentSegment.text)
          }
        })
    }
  }

  function jumpSeconds(offset: number) {
    if (!audioRef.current) return
    const target = Math.max(0, Math.min(duration, audioRef.current.currentTime + offset))
    audioRef.current.currentTime = target
    setCurrentTime(target)
  }

  function seekTo(second: number) {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.max(0, Math.min(duration, second))
    setCurrentTime(audioRef.current.currentTime)
    if (!isPlaying) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
    }
  }

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekTo(ratio * duration)
  }

  async function handleAddLexisToWordbook(item: RadioVocabularyItem) {
    setActiveWordToAdd(item.word)
    try {
      const existing = desk.cards.find((c) => c.word.toLowerCase() === item.word.toLowerCase())
      if (existing) {
        await desk.markReview(existing.id, true)
      } else {
        desk.adoptCard({
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
      // silently handle
    } finally {
      setTimeout(() => setActiveWordToAdd(null), 1200)
    }
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Hidden HTML5 Audio Element */}
      <audio
        ref={audioRef}
        src={audioSourceError && broadcast.audioFallbackUrl ? broadcast.audioFallbackUrl : broadcast.audioUrl}
        preload="metadata"
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime)
          }
        }}
        onDurationChange={() => {
          if (audioRef.current && audioRef.current.duration > 0 && !isNaN(audioRef.current.duration)) {
            setDuration(audioRef.current.duration)
          }
        }}
        onEnded={() => {
          setIsPlaying(false)
          setLoopingSegmentId(null)
        }}
        onError={() => {
          if (!audioSourceError && broadcast.audioFallbackUrl) {
            setAudioSourceError(true)
          }
        }}
      />

      {/* Top Radio Station Header & Tuning Dial Card */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-background p-6 shadow-xl backdrop-blur-xl sm:p-8">
        {/* Glow ambient background effect */}
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6">
          {/* Station Frequency & On-Air Badge Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-primary shadow-inner">
                <Radio className="size-5 animate-pulse" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold tracking-wider text-primary uppercase">
                    {broadcast.stationFrequency}
                  </span>
                  <span className="size-1 rounded-full bg-border" />
                  <span className="text-xs font-semibold text-foreground">
                    {zh ? broadcast.stationName : broadcast.stationName}
                  </span>
                  <span className="rounded-md border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {broadcast.stationCity}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {zh ? broadcast.categoryLabelZh : broadcast.categoryLabel} · {broadcast.broadcastDate}
                </p>
              </div>
            </div>

            {/* LIVE ON AIR Pulse Indicator */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition-all',
                  isPlaying
                    ? 'border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                    : 'border border-border/80 bg-card/60 text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'size-2 rounded-full',
                    isPlaying ? 'animate-ping bg-emerald-400' : 'bg-muted-foreground',
                  )}
                />
                <span>{isPlaying ? (zh ? '● 直播播送中' : '● ON AIR') : zh ? '○ 待机准备' : '○ STANDBY'}</span>
              </div>

              {/* Animated Equalizer Wave Bars */}
              <div className="hidden items-end gap-1 sm:flex h-6" aria-hidden="true">
                {[0.4, 0.9, 0.6, 1.0, 0.7, 0.3, 0.8].map((h, i) => (
                  <span
                    key={i}
                    className={cn(
                      'w-1 rounded-full transition-all duration-300',
                      isPlaying ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30',
                    )}
                    style={{
                      height: isPlaying ? `${Math.max(25, h * 100)}%` : '20%',
                      animationDelay: `${i * 120}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Broadcast Title and Summary */}
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
              {zh ? broadcast.titleZh : broadcast.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {zh ? broadcast.title : broadcast.titleZh}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-foreground/80 sm:text-base">
              {zh ? broadcast.summaryZh : broadcast.summary}
            </p>
          </div>

          {/* Audio Console Controller Bar */}
          <div className="rounded-2xl border border-border/80 bg-background/80 p-4 shadow-inner backdrop-blur-md">
            {/* Timeline Progress Bar */}
            <div className="flex flex-col gap-1.5">
              <div
                role="slider"
                aria-label="Audio progress"
                aria-valuenow={currentTime}
                aria-valuemin={0}
                aria-valuemax={duration}
                tabIndex={0}
                onClick={handleTimelineClick}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') jumpSeconds(-5)
                  if (e.key === 'ArrowRight') jumpSeconds(5)
                }}
                className="group relative flex h-4 w-full cursor-pointer items-center"
              >
                <div className="h-2 w-full rounded-full bg-muted/60 transition-all group-hover:h-2.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div
                  className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-md transition-transform group-hover:scale-125"
                  style={{ left: `calc(${progressPercent}% - 8px)` }}
                />
              </div>

              {/* Time display: Current / Total */}
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span className="font-medium text-foreground">{formatDurationClock(currentTime)}</span>
                <span>{formatDurationClock(duration)}</span>
              </div>
            </div>

            {/* Playback Control Buttons */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                {/* 5s Rewind */}
                <button
                  type="button"
                  onClick={() => jumpSeconds(-5)}
                  title={zh ? '快退 5 秒 (←)' : 'Rewind 5s (←)'}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-primary/50 hover:text-foreground active:scale-95"
                >
                  <Rewind className="size-4" />
                </button>

                {/* Primary Play / Pause Button */}
                <button
                  type="button"
                  onClick={togglePlay}
                  title={zh ? (isPlaying ? '暂停 (空格)' : '播放 (空格)') : isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                  className="inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-95"
                >
                  {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
                </button>

                {/* 5s Fast-forward */}
                <button
                  type="button"
                  onClick={() => jumpSeconds(5)}
                  title={zh ? '快进 5 秒 (→)' : 'Fast Forward 5s (→)'}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-primary/50 hover:text-foreground active:scale-95"
                >
                  <FastForward className="size-4" />
                </button>

                {/* Speed Selector */}
                <div className="ml-2 flex items-center rounded-full border border-border bg-card/60 p-0.5 text-xs font-medium">
                  {([0.75, 1.0, 1.25, 1.5] as SpeedOption[]).map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setPlaybackRate(rate)}
                      className={cn(
                        'rounded-full px-2 py-0.5 transition',
                        playbackRate === rate
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume and Display Toggles */}
              <div className="flex items-center gap-3">
                {/* Volume Slider */}
                <div className="hidden items-center gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => setIsMuted((v) => !v)}
                    className="text-muted-foreground hover:text-foreground"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value))
                      setIsMuted(false)
                    }}
                    className="h-1.5 w-16 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                    aria-label="Volume slider"
                  />
                </div>

                {/* Bilingual Toggle */}
                <button
                  type="button"
                  onClick={() => setShowChinese((v) => !v)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition',
                    showChinese
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span>{showChinese ? (zh ? '双语对照' : 'Bilingual') : zh ? '纯英沉浸' : 'EN Only'}</span>
                </button>

                {/* Auto-scroll toggle */}
                <button
                  type="button"
                  onClick={() => setAutoScroll((v) => !v)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition',
                    autoScroll
                      ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                  title={zh ? '跟随播放滚动文本' : 'Auto-scroll transcript with audio'}
                >
                  <Sparkles className="size-3" />
                  <span>{zh ? '滚屏' : 'Scroll'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dual-Column Content: Transcript & Key Lexis Spotlight */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Synchronized Transcript with Interactive Word-Level Dictionary (8 Cols) */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Headphones className="size-4 text-primary" />
              <h2 className="font-semibold text-foreground">
                {zh ? '电台原声同步文稿' : 'Synchronized Radio Transcript'}
              </h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                {broadcast.segments.length} {zh ? '个段落' : 'segments'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {zh ? '💡 划过或点击单词即可查看释义并一键加入生词本' : '💡 Hover or click any word for instant dictionary'}
            </span>
          </div>

          <div
            ref={transcriptContainerRef}
            className="flex max-h-[680px] flex-col gap-3 overflow-y-auto rounded-3xl border border-border/80 bg-card/60 p-4 shadow-sm sm:p-6"
          >
            {broadcast.segments.map((seg) => {
              const isActive = currentTime >= seg.startSecond && currentTime < seg.endSecond
              const isLooping = loopingSegmentId === seg.id

              return (
                <div
                  key={seg.id}
                  ref={(el) => {
                    segmentRefs.current[seg.id] = el
                  }}
                  className={cn(
                    'group relative rounded-2xl border p-4 transition-all duration-200',
                    isActive
                      ? 'border-primary/50 bg-primary/10 shadow-md ring-1 ring-primary/30'
                      : 'border-border/60 bg-background/50 hover:border-border hover:bg-background/80',
                  )}
                >
                  {/* Segment Meta Header */}
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => seekTo(seg.startSecond)}
                        className="font-mono font-semibold text-primary transition hover:underline"
                        title={zh ? '点击跳转至该时间戳' : 'Click to seek here'}
                      >
                        [{formatDurationClock(seg.startSecond)}]
                      </button>
                      <span className="font-medium text-foreground">{seg.speaker}</span>
                      <span className="text-[11px] text-muted-foreground">· {seg.speakerRole}</span>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100">
                      {/* Segment Repeat / Loop Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          if (isLooping) {
                            setLoopingSegmentId(null)
                          } else {
                            setLoopingSegmentId(seg.id)
                            seekTo(seg.startSecond)
                          }
                        }}
                        title={zh ? '单句复读循环' : 'Loop this paragraph'}
                        className={cn(
                          'inline-flex size-7 items-center justify-center rounded-lg border transition',
                          isLooping
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                            : 'border-border/70 bg-card text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <Repeat className="size-3.5" />
                      </button>

                      {/* Speech Pronunciation Shadowing */}
                      <button
                        type="button"
                        onClick={() => {
                          void speakWord(seg.text)
                        }}
                        title={zh ? '朗读此段英文（影子跟读）' : 'Shadowing speech synthesis'}
                        className="inline-flex size-7 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                      >
                        <Mic className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Interactive Gloss English Text */}
                  <div className="text-sm leading-relaxed text-foreground sm:text-base">
                    <InteractiveGlossText text={seg.text} contextSentence={seg.text} />
                  </div>

                  {/* Chinese Bilingual Translation */}
                  {showChinese && seg.textZh && (
                    <div className="mt-2.5 border-t border-border/40 pt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {seg.textZh}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Key News Lexis & Band 7+ Spotlight Drawer (4 Cols) */}
        <div className="flex flex-col gap-4 lg:col-span-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-400" />
              <h2 className="font-semibold text-foreground">
                {zh ? '电台重点词汇与考点' : 'Radio Lexis Spotlight'}
              </h2>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {broadcast.keyLexis.length} {zh ? '核心词' : 'words'}
            </span>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-border/80 bg-card/60 p-4 shadow-sm">
            {broadcast.keyLexis.map((item) => {
              const isSaved = desk.cards.some(
                (c) => c.word.toLowerCase() === item.word.toLowerCase() && c.inReview,
              )
              const isAdding = activeWordToAdd === item.word

              return (
                <div
                  key={item.word}
                  className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/60 p-3.5 transition hover:border-primary/40 hover:bg-background/90"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{item.word}</span>
                        <span className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          {item.band}
                        </span>
                        <span className="text-[11px] text-muted-foreground italic">{item.pos}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <span>{item.ipa}</span>
                        <button
                          type="button"
                          onClick={() => speakWord(item.word)}
                          title={zh ? '朗读单词' : 'Pronounce word'}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Volume2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Add to Wordbook Button */}
                    <button
                      type="button"
                      onClick={() => handleAddLexisToWordbook(item)}
                      disabled={isAdding}
                      title={isSaved ? (zh ? '已在生词本' : 'In Wordbook') : zh ? '加入生词本复习' : 'Add to Wordbook'}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition',
                        isSaved
                          ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      )}
                    >
                      {isSaved ? (
                        <>
                          <BookmarkCheck className="size-3 text-emerald-400" />
                          <span>{zh ? '已收录' : 'Saved'}</span>
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="size-3" />
                          <span>{isAdding ? (zh ? '添加中…' : 'Adding…') : zh ? '+ 生词本' : '+ Review'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-foreground/90">{item.meaning}</p>
                  <p className="rounded-lg bg-muted/40 p-2 text-[11px] leading-relaxed text-muted-foreground italic">
                    “{item.contextSnippet}”
                  </p>
                </div>
              )
            })}
          </div>

          {/* Radio Learning Tip Card */}
          <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4 text-xs leading-relaxed text-foreground/80">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <Compass className="size-4" />
              <span>{zh ? '电台精听研习指南' : 'Radio Learning Tip'}</span>
            </div>
            <p className="mt-1.5">
              {zh
                ? '新闻电台语速自然，信息密度高。建议首遍盲听抓取主旨，第二遍配合双语对照查阅生词，第三遍利用 🔁 单句复读并开启影子跟读（Shadowing），全方位提升语感与口语节奏。'
                : 'Radio broadcasts feature natural cadence and high lexical density. Listen once without subtitles for gist, then review with bilingual transcripts, and use the loop button for sentence shadowing.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
