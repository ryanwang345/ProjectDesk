import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  ExternalLink,
  Headphones,
  Mic,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Sparkles,
  Umbrella,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { InteractiveGlossText } from '@/components/interactive-gloss-text'
import { useEnglish } from '@/hooks/use-english'
import { useI18n } from '@/i18n'
import {
  classifyArticleTopic,
  extractLiveCollocations,
  extractLiveKeyLexis,
  extractLiveLiaisons,
  fetchLiveRadioBulletin,
  fetchRichTorontoWeather,
  getCachedLiveRadioBulletin,
  STATION_680_NEWS,
  type LiveStreamStation,
  type RadioBulletin,
  type RadioCollocationItem,
  type RadioLiveArticle,
  type RadioLiveWeather,
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

function WeatherIconSvg({ code = 2, size = 'md' }: { code?: number; size?: 'sm' | 'lg' | 'md' }) {
  const cls = size === 'lg' ? 'size-11 sm:size-12' : size === 'sm' ? 'size-5' : 'size-7'
  const isClear = code === 0 || code === 1
  const isRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82)
  const isSnow = (code >= 71 && code <= 77) || (code >= 85 && code <= 86)

  if (isClear) {
    return (
      <svg viewBox="0 0 64 64" className={cls} aria-hidden="true">
        <circle cx="32" cy="32" r="14" fill="#fbbf24" stroke="#f59e0b" strokeWidth="2" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line
            key={deg}
            x1="32"
            y1="8"
            x2="32"
            y2="13"
            stroke="#fbbf24"
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(${deg} 32 32)`}
          />
        ))}
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 64 64" className={cls} aria-hidden="true">
      {code <= 2 && (
        <g>
          <circle cx="22" cy="24" r="10" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="22"
              y1="8"
              x2="22"
              y2="11"
              stroke="#fbbf24"
              strokeWidth="2.2"
              strokeLinecap="round"
              transform={`rotate(${deg} 22 24)`}
            />
          ))}
        </g>
      )}
      <path
        d="M22 44h24a10 10 0 0 0 1.5-19.8A13 13 0 0 0 23 21a11 11 0 0 0-1 23Z"
        fill="#f8fafc"
        stroke="#cbd5e1"
        strokeWidth="1.5"
      />
      {isRain && (
        <g stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round">
          <line x1="25" y1="48" x2="23" y2="55" />
          <line x1="34" y1="48" x2="32" y2="55" />
          <line x1="43" y1="48" x2="41" y2="55" />
        </g>
      )}
      {isSnow && (
        <g fill="#bae6fd">
          <circle cx="25" cy="51" r="2.2" />
          <circle cx="34" cy="53" r="2.2" />
          <circle cx="43" cy="51" r="2.2" />
        </g>
      )}
    </svg>
  )
}

function TorontoWeatherWidget({
  weather,
  updatedTimeLabel,
  zh,
  onRefresh,
  isRefreshing,
}: {
  weather?: RadioLiveWeather
  updatedTimeLabel: string | null
  zh: boolean
  onRefresh: () => void
  isRefreshing: boolean
}) {
  const temp = weather ? Math.round(weather.temperatureC) : 6
  const feels = weather ? Math.round(weather.feelsLikeC) : 3
  const high = weather?.highC ?? temp + 1
  const low = weather?.lowC ?? temp - 4
  const yHigh = weather?.yesterdayHighC ?? temp - 1
  const yLow = weather?.yesterdayLowC ?? temp - 5
  const yLabel = weather?.yesterdayLabel ?? 'Yesterday'
  const cond = zh ? weather?.conditionZh || '多云间晴' : weather?.condition || 'Partly cloudy'
  const wind = weather ? Math.round(weather.windSpeedKmh) : 13
  const gust = weather ? Math.round(weather.windGustsKmh) : 30
  const compass = weather?.windCompass ?? 'NW'
  const pressure = weather?.pressureKpa ?? 101.3
  const humidity = weather?.humidityPct ?? 61
  const visibility = weather?.visibilityKm ?? 24
  const ceiling = weather?.ceilingM ?? 3400
  const sunrise = weather?.sunrise ?? '7:10AM'
  const sunset = weather?.sunset ?? '4:53PM'
  const precipAlert = zh
    ? weather?.precipAlertZh || '未来 3 小时内预计无明显降水'
    : weather?.precipAlertEn || 'No significant precipitation expected within the next 3 hours'
  const hourlySummary = zh
    ? weather?.hourlySummaryZh || `今日${cond}，稍晚云层渐开。伴有阵风。`
    : weather?.hourlySummaryEn || 'Cloudy with clear breaks developing in the evening. Windy.'

  const hourlyList =
    weather?.hourly && weather.hourly.length >= 5
      ? weather.hourly.slice(0, 5)
      : [
          { timeLabel: '12pm', tempC: temp + 1, feelsLikeC: feels + 1, precipProbPct: 30, weatherCode: 2 },
          { timeLabel: '1pm', tempC: temp + 1, feelsLikeC: feels, precipProbPct: 30, weatherCode: 3 },
          { timeLabel: '2pm', tempC: temp + 1, feelsLikeC: feels, precipProbPct: 30, weatherCode: 3 },
          { timeLabel: '3pm', tempC: temp + 1, feelsLikeC: feels, precipProbPct: 30, weatherCode: 3 },
          { timeLabel: '4pm', tempC: temp, feelsLikeC: feels, precipProbPct: 30, weatherCode: 2 },
        ]

  const todayDateStr = weather?.observedAt
    ? new Date(weather.observedAt).toLocaleDateString(zh ? 'zh-CN' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : zh
      ? '今日日出日落'
      : 'Sunrise / Sunset'

  return (
    <section className="rounded-2xl bg-gradient-to-br from-[#4f86c6] via-[#376fb2] to-[#235391] p-3.5 text-white shadow-sm sm:p-4">
      {/* Compact Header */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h2 className="font-display text-base font-bold tracking-tight text-white sm:text-lg">
            Toronto, ON
          </h2>
          <span className="text-[11px] text-white/80">
            {updatedTimeLabel
              ? zh
                ? `更新于 ${updatedTimeLabel}`
                : `Updated at ${updatedTimeLabel}`
              : zh
                ? '多伦多实时气象观测站'
                : 'Live Toronto Airport & Downtown Telemetry'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://www.theweathernetwork.com/en/city/ca/ontario/toronto/hourly"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/95 transition hover:bg-white/20"
          >
            {zh ? '完整 72 小时' : 'Full 72 hours'} <ArrowRight className="size-3" />
          </a>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 rounded-full border border-white/35 bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
          >
            <RefreshCw className={cn('size-3', isRefreshing && 'animate-spin')} />
            {isRefreshing ? (zh ? '同步中…' : 'Syncing…') : zh ? '同步气象与新闻' : 'Sync Live'}
          </button>
        </div>
      </div>

      {/* Main Current + Hourly Forecast Grid */}
      <div className="grid grid-cols-1 items-stretch gap-2.5 lg:grid-cols-12">
        {/* Current Temp Card */}
        <div className="flex flex-col justify-between rounded-xl bg-[#193558]/75 p-3 backdrop-blur-sm lg:col-span-5">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-3">
              <WeatherIconSvg code={weather?.weatherCode ?? 2} size="lg" />
              <div className="flex items-start leading-none">
                <span className="font-sans text-4xl font-light tracking-tighter text-white sm:text-5xl">
                  {temp}
                </span>
                <span className="mt-0.5 text-base font-semibold text-white/90 sm:text-lg">°C</span>
              </div>
            </div>
            <div className="flex flex-col text-right text-xs">
              <span className="text-sm font-semibold text-white">{cond}</span>
              <span className="text-[11px] font-medium text-white/85">
                {zh ? `体感 ${feels}°` : `Feels ${feels}°`} · H:{high}° L:{low}°
              </span>
            </div>
          </div>

          <a
            href="https://www.theweathernetwork.com/en/city/ca/ontario/toronto/current"
            target="_blank"
            rel="noreferrer"
            className="mt-2.5 flex items-center justify-between rounded-lg bg-[#0f233c]/85 px-3 py-1.5 text-[11px] font-medium text-white/95 transition hover:bg-[#0f233c]"
          >
            <span className="flex items-center gap-2 truncate">
              <Umbrella className="size-3.5 shrink-0 text-sky-300" />
              <span className="truncate">{precipAlert}</span>
            </span>
            <ArrowRight className="size-3 shrink-0 text-white/75" />
          </a>
        </div>

        {/* Hourly Forecast Section */}
        <div className="flex flex-col justify-between gap-2 lg:col-span-7">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {hourlyList.map((h) => (
              <div
                key={h.timeLabel}
                className="flex flex-col items-center justify-between rounded-xl bg-[#132c4a]/85 px-1.5 py-1.5 text-center"
              >
                <span className="text-[11px] font-semibold text-white/90">{h.timeLabel}</span>
                <div className="my-0.5">
                  <WeatherIconSvg code={h.weatherCode} size="sm" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-white">{h.tempC}°</span>
                  <span className="text-[10px] text-white/70">({h.feelsLikeC}°)</span>
                </div>
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-sky-200">
                  <span>🌧</span>
                  <span>{h.precipProbPct}%</span>
                </span>
              </div>
            ))}
          </div>

          <div className=" truncate rounded-lg bg-[#132c4a]/85 px-3 py-1.5 text-[11px] font-medium text-white/95">
            <span className="mr-1.5 font-bold text-sky-200">{zh ? '逐时趋势:' : 'Hourly:'}</span>
            {hourlySummary}
          </div>
        </div>
      </div>

      {/* Today's Conditions Compact Strip */}
      <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
        {/* 1. Sunrise & Sunset */}
        <div className="flex flex-col justify-between rounded-xl bg-[#132c4a]/85 px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-white/80">{todayDateStr}</span>
            <svg viewBox="0 0 60 26" className="h-4 w-9 shrink-0" aria-hidden="true">
              <path d="M4 22 A26 20 0 0 1 56 22" fill="rgba(255,255,255,0.12)" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="2 2" />
              <circle cx="30" cy="8" r="4.5" fill="#fbbf24" />
            </svg>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] leading-tight text-white/90">
            <span>↑ {sunrise}</span>
            <span>↓ {sunset}</span>
          </div>
        </div>

        {/* 2. Wind */}
        <div className="flex flex-col justify-between rounded-xl bg-[#132c4a]/85 px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/75">Wind</span>
            <span className="text-[10px] font-semibold text-sky-300">{compass}</span>
          </div>
          <div className="mt-0.5 flex items-baseline justify-between">
            <span className="text-xs font-bold text-white">
              {wind} <span className="text-[10px] font-normal text-white/75">km/h</span>
            </span>
            <span className="text-[10px] text-white/80">Gust {gust}</span>
          </div>
        </div>

        {/* 3. Pressure */}
        <div className="flex flex-col justify-between rounded-xl bg-[#132c4a]/85 px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/75">Pressure</span>
            <svg viewBox="0 0 40 22" className="h-3.5 w-6 shrink-0" aria-hidden="true">
              <path d="M4 19 A16 16 0 0 1 36 19" fill="none" stroke="#86efac" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="20" y1="19" x2="15" y2="8" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="mt-0.5 text-xs font-bold text-white">
            {pressure.toFixed(1)} <span className="text-[10px] font-normal text-white/80">↑kPa</span>
          </span>
        </div>

        {/* 4. Humidity */}
        <div className="flex flex-col justify-between rounded-xl bg-[#132c4a]/85 px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/75">Humidity</span>
            <span className="text-[10px] font-semibold text-amber-300">
              {humidity >= 60 ? 'Humid' : humidity >= 35 ? 'Moderate' : 'Dry'}
            </span>
          </div>
          <span className="mt-0.5 text-xs font-bold text-white">{humidity}%</span>
        </div>

        {/* 5. Visibility */}
        <div className="flex flex-col justify-between rounded-xl bg-[#132c4a]/85 px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/75">Visibility</span>
            <span className="text-[10px] text-sky-200">Clear</span>
          </div>
          <span className="mt-0.5 text-xs font-bold text-white">
            {visibility} <span className="text-[10px] font-normal text-white/80">km</span>
          </span>
        </div>

        {/* 6. Ceiling */}
        <div className="flex flex-col justify-between rounded-xl bg-[#132c4a]/85 px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/75">Ceiling</span>
            <span className="text-[10px] text-white/70">Cloud base</span>
          </div>
          <span className="mt-0.5 text-xs font-bold text-white">
            {ceiling} <span className="text-[10px] font-normal text-white/80">m</span>
          </span>
        </div>

        {/* 7. Yesterday */}
        <div className="flex flex-col justify-between rounded-xl bg-[#132c4a]/85 px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/75">Yesterday</span>
            <span className="text-[10px] text-white/70">{yLabel}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs font-bold text-white">
            <span>
              <span className="mr-0.5 text-[10px] font-normal text-white/70">H</span>
              {yHigh}°
            </span>
            <span className="text-white/90">
              <span className="mr-0.5 text-[10px] font-normal text-white/70">L</span>
              {yLow}°
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

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

  // Active news wheel segment & live news bulletin state
  const [liveBulletin, setLiveBulletin] = useState<RadioBulletin | null>(() => getCachedLiveRadioBulletin())
  const [isRefreshingNews, setIsRefreshingNews] = useState(false)
  const [activeSegmentId, setActiveSegmentId] = useState<string>(station.wheelSegments[0].id)
  const [selectedArticle, setSelectedArticle] = useState<RadioLiveArticle | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [showChinese, setShowChinese] = useState(true)
  const [activeWordToAdd, setActiveWordToAdd] = useState<string | null>(null)

  const segments: RadioNewsWheelSegment[] =
    liveBulletin && liveBulletin.segments.length > 0 ? liveBulletin.segments : station.wheelSegments

  const currentSegment: RadioNewsWheelSegment =
    segments.find((s) => s.id === activeSegmentId) || segments[0]

  const activeTranscriptText = selectedArticle
    ? `${selectedArticle.title}. ${selectedArticle.summary}`
    : currentSegment.text
  const extractedLexis = extractLiveKeyLexis(activeTranscriptText)
  const activeKeyLexis: RadioVocabularyItem[] =
    extractedLexis.length > 0 ? extractedLexis : currentSegment.keyLexis
  const activeCollocations: RadioCollocationItem[] = extractLiveCollocations(activeTranscriptText)
  const extractedLiaisons = extractLiveLiaisons(activeTranscriptText)
  const activeLiaisons =
    extractedLiaisons.length > 0 ? extractedLiaisons : currentSegment.liaisons

  const allFeedArticles: RadioLiveArticle[] = liveBulletin?.liveArticles ?? []
  const cityNewsArticles = allFeedArticles.filter(
    (a) => a.source.toLowerCase().includes('citynews') || a.link.toLowerCase().includes('citynews.ca'),
  )
  const baseArticles = cityNewsArticles
  const filterArticlesByKey = (key: string) => {
    if (key === 'ALL') return baseArticles
    if (key.startsWith('TOPIC:')) {
      const topicId = key.slice(6)
      return baseArticles.filter((a) => classifyArticleTopic(a).id === topicId)
    }
    return baseArticles.filter((a) => a.category === key)
  }
  const displayedFeedArticles = filterArticlesByKey(categoryFilter)
  const activeTopic = classifyArticleTopic(
    selectedArticle ??
      currentSegment.relatedArticles?.[0] ?? {
        title: currentSegment.title,
        summary: currentSegment.text,
        category: currentSegment.timeMark,
        link: currentSegment.sourceUrl ?? '',
      },
  )

  // Fetch real-time 680 News / CityNews Toronto bulletin on mount and every 5 minutes
  useEffect(() => {
    let active = true
    const loadLive = (force: boolean) => {
      void fetchLiveRadioBulletin(force, (partial) => {
        if (active && partial.segments.length > 0) {
          setLiveBulletin(partial)
        }
      }).then((data) => {
        if (active && data && data.segments.length > 0) {
          setLiveBulletin(data)
        }
      })
      void fetchRichTorontoWeather().then((richW) => {
        if (active && richW) {
          setLiveBulletin((prev) => (prev ? { ...prev, weather: richW } : prev))
        }
      })
    }
    loadLive(false)
    const timer = window.setInterval(() => loadLive(false), 5 * 60 * 1000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  async function handleRefreshLiveNews() {
    if (isRefreshingNews) return
    setIsRefreshingNews(true)
    try {
      const data = await fetchLiveRadioBulletin(true, (partial) => {
        if (partial.segments.length > 0) {
          setLiveBulletin(partial)
        }
      })
      if (data && data.segments.length > 0) {
        setLiveBulletin(data)
      }
    } finally {
      setIsRefreshingNews(false)
    }
  }

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

  function renderHighlighted(text: string, lexis: RadioVocabularyItem[]) {
    const words = lexis.map((k) => k.word.replace(/[^a-z]/gi, '')).filter(Boolean)
    if (words.length === 0) return <InteractiveGlossText text={text} contextSentence={text} />
    const re = new RegExp(`\\b((?:${words.join('|')})[a-z]*)\\b`, 'gi')
    const parts = text.split(re)
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <mark key={i} className="rounded bg-primary/15 px-0.5 font-semibold text-primary underline decoration-primary/60 underline-offset-4">
          <InteractiveGlossText text={part} contextSentence={text} />
        </mark>
      ) : (
        <Fragment key={i}>
          <InteractiveGlossText text={part} contextSentence={text} />
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

  async function handleAddCollocationToWordbook(item: RadioCollocationItem) {
    setActiveWordToAdd(item.phrase)
    try {
      const existing = desk.cards.find((c) => c.word.toLowerCase() === item.phrase.toLowerCase())
      if (existing) {
        await desk.markReview(existing.id, true)
      } else {
        await desk.adoptCard({
          id: `seed-phrase-${item.phrase.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          word: item.phrase,
          meaning: item.meaningZh,
          pronunciation: item.patternEn,
          inReview: true,
          generated: true,
          updatedAt: new Date().toISOString(),
          examples: [item.contextSnippet],
          senses: [
            {
              pos: item.patternZh,
              zh: item.meaningZh,
              en: item.meaningEn,
            },
          ],
          band: {
            zh: item.band,
            collocations: [item.phrase],
            writing: item.usageEn,
            writingZh: item.usageZh,
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
  const clip = (seg: RadioNewsWheelSegment) => formatDurationClock(seg.endSecond - seg.startSecond)
  const updatedTimeLabel = liveBulletin?.updatedAt
    ? new Date(liveBulletin.updatedAt).toLocaleTimeString(zh ? 'zh-CN' : 'en-CA', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

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

      {/* Toronto, ON Weather Widget (replaces The 680 News Clock) */}
      <TorontoWeatherWidget
        weather={liveBulletin?.weather}
        updatedTimeLabel={updatedTimeLabel}
        zh={zh}
        onRefresh={() => void handleRefreshLiveNews()}
        isRefreshing={isRefreshingNews}
      />

      {/* Transcript + Collocations (Left 8 cols) & Key Lexis (Right 4 cols) */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <section className="flex flex-col gap-3.5 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Headphones className="size-4 text-primary" />
              {zh ? '680 核心时段原声与精听文稿' : '680 News transcripts'}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {zh ? '划过或点击单词即可查看释义并一键加入生词本' : 'Hover or click any word for the dictionary'}
              </span>
              <button
                type="button"
                onClick={() => void handleRefreshLiveNews()}
                disabled={isRefreshingNews}
                className={cn(btn, 'px-2.5 py-1 text-[11px]')}
                title={zh ? '从 CityNews 680 实时拉取最新新闻' : 'Fetch latest live news from CityNews 680'}
              >
                <RefreshCw className={cn('size-3 text-primary', isRefreshingNews && 'animate-spin')} />
                {isRefreshingNews ? (zh ? '同步中…' : 'Syncing…') : zh ? '刷新实时新闻' : 'Refresh Live News'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {segments.map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => {
                    setSelectedArticle(null)
                    setActiveSegmentId(seg.id)
                  }}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-xs font-bold transition',
                    !selectedArticle && seg.id === activeSegmentId
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  {seg.timeMark}
                </button>
              ))}
              {selectedArticle && (
                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  className="rounded-full border border-primary/50 bg-primary/15 px-3.5 py-1.5 text-xs font-bold text-primary"
                >
                  {zh ? '← 返回时段联播' : '← Back to slot digest'}
                </button>
              )}
            </div>

            {liveBulletin?.weather && (
              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {zh
                  ? `多伦多: ${Math.round(liveBulletin.weather.temperatureC)}°C · ${liveBulletin.weather.conditionZh} · 风速 ${Math.round(liveBulletin.weather.windSpeedKmh)} km/h`
                  : `Toronto: ${Math.round(liveBulletin.weather.temperatureC)}°C · ${liveBulletin.weather.condition} · Wind ${Math.round(liveBulletin.weather.windSpeedKmh)} km/h`}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {selectedArticle ? selectedArticle.category : currentSegment.timeMark}
                  </span>
                  <span className="rounded border border-border bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {zh ? activeTopic.labelZh : activeTopic.labelEn}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold leading-snug text-foreground">
                  {selectedArticle
                    ? zh
                      ? selectedArticle.titleZh || selectedArticle.title
                      : selectedArticle.title
                    : zh
                      ? currentSegment.titleZh
                      : currentSegment.title}
                </h3>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {zh ? '播音主播：' : 'Anchor: '}
                    {selectedArticle ? selectedArticle.source || 'CityNews 680 Newsroom' : currentSegment.anchor}
                  </span>
                  {(selectedArticle?.source || currentSegment.sourceName) && (
                    <span>· {selectedArticle?.source || currentSegment.sourceName}</span>
                  )}
                  {(selectedArticle?.link || currentSegment.sourceUrl) && (
                    <a
                      href={selectedArticle?.link || currentSegment.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                    >
                      {zh ? '查看新闻原文' : 'Original report'} <ExternalLink className="size-3" />
                    </a>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  void speakWord(
                    selectedArticle ? `${selectedArticle.title}. ${selectedArticle.summary}` : currentSegment.text,
                  )
                }
                className={cn(btn, 'shrink-0')}
              >
                <Mic className="size-3.5 text-primary" /> {zh ? '朗读跟读 (Shadowing)' : 'Shadowing'}
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-background/60 p-4">
              <div className="mb-2 flex items-center justify-between text-[10px] font-bold tracking-wider text-primary uppercase">
                <span>Original broadcast transcript</span>
                <span className="font-mono text-muted-foreground">{clip(currentSegment)}</span>
              </div>
              <p className="text-base leading-8 text-foreground">
                {renderHighlighted(activeTranscriptText, activeKeyLexis)}
              </p>
            </div>

            {showChinese && (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
                <span className="mb-1 block text-xs font-semibold text-foreground">{zh ? '中文对照' : 'Translation'}</span>
                {selectedArticle
                  ? `${selectedArticle.titleZh || selectedArticle.title}${selectedArticle.summaryZh ? ` —— ${selectedArticle.summaryZh}` : ''}`
                  : currentSegment.textZh}
              </div>
            )}

            {activeCollocations.length > 0 && (
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Sparkles className="size-3.5 text-primary" />
                    {zh ? '680 新闻短语搭配学习卡 (Collocations & Phrases)' : '680 News collocations & phrases'}
                  </h4>
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {activeCollocations.length} {zh ? '组搭配' : 'phrases'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {activeCollocations.map((item) => {
                    const isSaved = desk.cards.some(
                      (c) => c.word.toLowerCase() === item.phrase.toLowerCase() && c.inReview,
                    )
                    const isAdding = activeWordToAdd === item.phrase
                    return (
                      <div
                        key={item.phrase}
                        className="flex flex-col justify-between rounded-xl border border-border bg-card p-3.5 transition hover:border-primary/40"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-display text-sm font-semibold text-foreground">
                                  {item.phrase}
                                </span>
                                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                  {item.band}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                                <span>{zh ? item.patternZh : item.patternEn}</span>
                                <button
                                  type="button"
                                  onClick={() => void speakWord(item.phrase)}
                                  aria-label={zh ? '朗读短语' : 'Pronounce phrase'}
                                  className="hover:text-foreground"
                                >
                                  <Volume2 className="size-3.5 text-primary" />
                                </button>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleAddCollocationToWordbook(item)}
                              disabled={isAdding}
                              className={cn(
                                btn,
                                'shrink-0 px-2.5 py-1 text-[11px]',
                                isSaved && 'border-primary/50 bg-primary/10 text-primary',
                              )}
                            >
                              {isSaved ? <BookmarkCheck className="size-3" /> : <BookmarkPlus className="size-3" />}
                              {isSaved
                                ? zh
                                  ? '已收录'
                                  : 'Saved'
                                : isAdding
                                  ? zh
                                    ? '添加中…'
                                    : 'Adding…'
                                  : zh
                                    ? '+ 生词本'
                                    : '+ Review'}
                            </button>
                          </div>
                          <p className="mt-2 text-xs font-semibold text-foreground">{item.meaningZh}</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                            {zh ? item.usageZh : item.usageEn}
                          </p>
                        </div>
                        <p className="mt-2 line-clamp-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground italic">
                          “{item.contextSnippet}”
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {activeLiaisons.length > 0 && (
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <h4 className="mb-3 flex items-center gap-2 text-xs font-bold text-foreground">
                  <Sparkles className="size-3.5 text-primary" />
                  {zh ? '真实生活连读与音变诊断 (Liaisons & Reductions)' : 'Liaisons & reductions'}
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {activeLiaisons.map((l) => (
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

        <aside className="flex flex-col gap-3.5 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Sparkles className="size-4 text-primary" />
              {zh ? '680 新闻高频词汇' : '680 News lexis'}
            </h2>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {activeKeyLexis.length} {zh ? '核心词' : 'words'}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {activeKeyLexis.map((item) => {
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
                  <p className="mt-2 line-clamp-2 rounded-lg bg-muted/50 p-2 text-xs leading-relaxed text-muted-foreground italic">
                    “{item.contextSnippet}”
                  </p>
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
              ? '680 News 具有典型的北美全新闻快节奏（每分钟 180–220 词），信息高度精炼，词汇贴近生活（路况、气象、市政、股票与汇率）。每天坚持 15–20 分钟泛听，并随时点击生词或短语搭配加入生词本。'
              : '680 News runs at a brisk North American all-news pace (about 180–220 wpm) with everyday vocabulary: traffic, weather, city hall, markets. Listen 15–20 minutes a day and save new words and collocations as you go.'}
          </div>
        </aside>
      </div>

      {/* All toronto.citynews.ca/feed/ Live Articles Directory */}
      <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <Radio className="size-4 text-primary" />
              {zh ? 'CityNews 680 实时新闻流 (toronto.citynews.ca/feed/)' : 'CityNews 680 Live Feed (toronto.citynews.ca/feed/)'}
            </h2>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary">
              {displayedFeedArticles.length} {zh ? '条新闻' : 'articles'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://toronto.citynews.ca/feed/"
              target="_blank"
              rel="noreferrer"
              className={cn(btn, 'px-3 py-1 text-xs')}
            >
              toronto.citynews.ca/feed/ <ExternalLink className="size-3" />
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: 'ALL', labelEn: 'All Categories', labelZh: '全部栏目' },
              { key: 'Traffic & Weather', labelEn: 'Traffic & Weather', labelZh: '路况与气象' },
              { key: 'Top Headlines', labelEn: 'Top Headlines', labelZh: '核心要闻' },
              { key: 'Business News', labelEn: 'Business News', labelZh: '商业财经' },
              { key: 'Sports & Culture', labelEn: 'Sports & Culture', labelZh: '体育与文化' },
              { key: 'TOPIC:GTA', labelEn: 'GTA & Municipal', labelZh: '多伦多民生' },
              { key: 'TOPIC:WORLD', labelEn: 'Canada & World', labelZh: '加国与国际' },
              { key: 'TOPIC:CRIME', labelEn: 'Crime & Justice', labelZh: '治安与司法' },
            ] as const
          ).map((f) => {
            const count = filterArticlesByKey(f.key).length
            if (f.key.startsWith('TOPIC:') && count === 0) return null
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setCategoryFilter(f.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition',
                  categoryFilter === f.key
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-background/60 text-muted-foreground hover:text-foreground',
                )}
              >
                <span>{zh ? f.labelZh : f.labelEn}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.2 font-mono text-[10px]',
                    categoryFilter === f.key
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {displayedFeedArticles.length === 0 ? (
          <div className="rounded-2xl border border-border bg-background/50 p-6 text-center text-xs text-muted-foreground">
            {isRefreshingNews
              ? zh
                ? '正在从 toronto.citynews.ca/feed/ 同步实时新闻…'
                : 'Syncing live news from toronto.citynews.ca/feed/…'
              : zh
                ? '正在加载实时新闻流，或点击右上角“同步最新新闻”刷新。'
                : 'Loading live news feed, or click "Sync Live News" above.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {displayedFeedArticles.map((art, index) => {
              const isSelected = selectedArticle?.link === art.link && selectedArticle?.title === art.title
              const topic = classifyArticleTopic(art)
              return (
                <article
                  key={`${art.link}-${index}`}
                  className={cn(
                    'flex flex-col justify-between gap-3 rounded-2xl border p-4 transition',
                    isSelected ? 'border-primary bg-primary/10' : 'border-border bg-background/60 hover:border-primary/40',
                  )}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-bold text-primary">#{String(index + 1).padStart(2, '0')}</span>
                        <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {art.category}
                        </span>
                        <span className="rounded border border-border bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {zh ? topic.labelZh : topic.labelEn}
                        </span>
                        <span className="font-medium">{art.source}</span>
                      </div>
                      {art.publishedAt && (
                        <span className="font-mono text-[10px]">
                          {new Date(art.publishedAt).toLocaleString(zh ? 'zh-CN' : 'en-CA', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>

                    <h3 className="font-display text-sm font-semibold leading-snug text-foreground sm:text-base">
                      <InteractiveGlossText text={art.title} contextSentence={art.title} />
                    </h3>
                    {showChinese && art.titleZh && (
                      <p className="text-xs font-medium text-foreground/80">{art.titleZh}</p>
                    )}

                    {art.summary && (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        <InteractiveGlossText text={art.summary} contextSentence={art.summary} />
                      </p>
                    )}
                    {showChinese && art.summaryZh && (
                      <p className="rounded-lg bg-muted/40 p-2 text-xs leading-relaxed text-muted-foreground">
                        {art.summaryZh}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedArticle(art)}
                        className={cn(
                          btn,
                          'px-2.5 py-1 text-[11px]',
                          isSelected && 'border-primary bg-primary text-primary-foreground hover:text-primary-foreground',
                        )}
                      >
                        <Headphones className="size-3" />
                        {isSelected ? (zh ? '正在精听' : 'Reading') : zh ? '载入精听文稿' : 'Load in Reader'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void speakWord(`${art.title}. ${art.summary}`)}
                        className={cn(btn, 'px-2.5 py-1 text-[11px]')}
                      >
                        <Volume2 className="size-3 text-primary" />
                        {zh ? '朗读' : 'Listen'}
                      </button>
                    </div>
                    {art.link && (
                      <a
                        href={art.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        {zh ? '阅读原文' : 'Read on CityNews'} <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
