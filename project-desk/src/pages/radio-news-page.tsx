import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Clock,
  Headphones,
  Radio,
  Search,
} from 'lucide-react'
import { RadioNewsPlayer } from '@/components/radio-news-player'
import { useI18n } from '@/i18n'
import {
  RADIO_BROADCASTS,
  RADIO_STATIONS,
  type RadioCategory,
} from '@/lib/radio-news'
import { formatDurationClock } from '@/lib/reading'
import { cn } from '@/lib/utils'

export function RadioNewsPage() {
  const { locale } = useI18n()
  const zh = locale === 'zh'

  const [selectedStationId, setSelectedStationId] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<RadioCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeBroadcastId, setActiveBroadcastId] = useState<string>(RADIO_BROADCASTS[0].id)

  // Filter broadcasts
  const filteredBroadcasts = useMemo(() => {
    return RADIO_BROADCASTS.filter((b) => {
      if (selectedStationId !== 'all' && b.stationId !== selectedStationId) {
        return false
      }
      if (selectedCategory !== 'all' && b.category !== selectedCategory) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = b.title.toLowerCase().includes(q) || b.titleZh.includes(q)
        const matchSummary = b.summary.toLowerCase().includes(q) || b.summaryZh.includes(q)
        const matchLexis = b.keyLexis.some((k) => k.word.toLowerCase().includes(q) || k.meaning.includes(q))
        if (!matchTitle && !matchSummary && !matchLexis) return false
      }
      return true
    })
  }, [selectedStationId, selectedCategory, searchQuery])

  // Active broadcast
  const activeBroadcast =
    RADIO_BROADCASTS.find((b) => b.id === activeBroadcastId) ||
    filteredBroadcasts[0] ||
    RADIO_BROADCASTS[0]

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Top Welcome & Navigation Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-r from-card via-card/80 to-background p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-primary text-primary-foreground shadow-lg shadow-emerald-900/30">
              <Radio className="size-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                  {zh ? '高品质本地广播' : 'Local Radio Broadcasts'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {RADIO_STATIONS.length} {zh ? '个精选频道' : 'Stations'} · {RADIO_BROADCASTS.length} {zh ? '期特辑' : 'Broadcasts'}
                </span>
              </div>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {zh ? '本地英语广播电台' : 'Local Radio News & Broadcasts'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {zh
                  ? '精选伦敦与国际调频广播原声，涵盖城市治安、海洋生态、绿色建筑与历史文化。支持双语对照、实时同步、划词查词与一键加入生词本。'
                  : 'Authentic metropolitan and international English radio broadcasts with synchronized transcripts, bilingual subtitles, and instant dictionary lookups.'}
              </p>
            </div>
          </div>

          {/* Quick link to IELTS Listening Exams */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/listening"
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card/80 px-4 py-2.5 text-xs font-semibold text-foreground shadow-sm transition hover:border-primary/40 hover:bg-muted/60"
            >
              <Headphones className="size-4 text-primary" />
              <span>{zh ? '前往雅思听力真题' : 'IELTS Listening Tests'}</span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </div>

      {/* Station Selector Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {RADIO_STATIONS.map((station) => {
          const isSelected = selectedStationId === station.id
          const broadcastCount = RADIO_BROADCASTS.filter((b) => b.stationId === station.id).length

          return (
            <button
              key={station.id}
              type="button"
              onClick={() => {
                setSelectedStationId(isSelected ? 'all' : station.id)
                const first = RADIO_BROADCASTS.find((b) => b.stationId === station.id)
                if (first) setActiveBroadcastId(first.id)
              }}
              className={cn(
                'flex flex-col text-left rounded-2xl border p-4 transition-all',
                isSelected
                  ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary/40'
                  : 'border-border/80 bg-card/70 hover:border-border hover:bg-card',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-primary">{station.frequency}</span>
                <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {broadcastCount} {zh ? '期特辑' : 'episodes'}
                </span>
              </div>
              <h3 className="mt-1 font-semibold text-foreground text-sm sm:text-base">
                {zh ? station.nameZh : station.name}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                {zh ? station.descriptionZh : station.description}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                <span>{zh ? station.cityZh : station.city}</span>
                <span className={cn('font-medium', isSelected ? 'text-primary' : 'text-muted-foreground')}>
                  {isSelected ? (zh ? '正在收听' : 'Selected') : zh ? '点击调频' : 'Tune in'}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Broadcast Episodes Filter & Selection Strip */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: zh ? '全部特辑' : 'All Broadcasts' },
              { id: 'community', label: zh ? '本地社区' : 'Community' },
              { id: 'world', label: zh ? '全球生态' : 'Global Ecology' },
              { id: 'science', label: zh ? '绿色建筑' : 'Architecture' },
              { id: 'culture', label: zh ? '人文艺术' : 'Arts & Culture' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id as RadioCategory)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition',
                  selectedCategory === cat.id
                    ? 'border border-primary/30 bg-primary/15 text-primary shadow-xs'
                    : 'border border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={zh ? '检索电台标题、词汇或话题…' : 'Search radio broadcasts or lexis…'}
              className="h-8 w-60 rounded-full border border-border bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Broadcast Episode Selector Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filteredBroadcasts.map((b) => {
            const isActive = b.id === activeBroadcast.id

            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setActiveBroadcastId(b.id)}
                className={cn(
                  'flex flex-col text-left rounded-2xl border p-4 transition-all',
                  isActive
                    ? 'border-emerald-500/60 bg-emerald-950/20 shadow-md ring-1 ring-emerald-500/30'
                    : 'border-border/70 bg-card/60 hover:border-border hover:bg-card/90',
                )}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold text-emerald-400">{b.stationFrequency}</span>
                  <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                    <Clock className="size-3" />
                    {formatDurationClock(b.durationSeconds)}
                  </span>
                </div>
                <h4 className="mt-1 font-semibold text-foreground text-sm line-clamp-1">
                  {zh ? b.titleZh : b.title}
                </h4>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {zh ? b.summaryZh : b.summary}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px]">
                  <span className="text-muted-foreground">{zh ? b.categoryLabelZh : b.categoryLabel}</span>
                  <span className={cn('font-semibold', isActive ? 'text-emerald-400' : 'text-muted-foreground')}>
                    {isActive ? (zh ? '● 正在播放' : '● Playing') : zh ? '点击收听' : 'Listen'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Radio News Player Component */}
      <RadioNewsPlayer broadcast={activeBroadcast} />
    </div>
  )
}
