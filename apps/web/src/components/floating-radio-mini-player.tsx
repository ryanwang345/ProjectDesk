import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { ExternalLink, Pause, Play, Radio, Volume2, VolumeX, X } from 'lucide-react'
import { useI18n } from '@/i18n'
import {
  dismissRadioMiniPlayer,
  setRadioVolume,
  toggleRadioMute,
  toggleRadioStream,
  useRadioStream,
} from '@/lib/radio-stream-store'
import { formatDurationClock } from '@/lib/reading'
import { cn } from '@/lib/utils'

export function FloatingRadioMiniPlayer({
  scrollContainerRef,
}: {
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
}) {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  const location = useLocation()
  const navigate = useNavigate()
  const stream = useRadioStream()
  const [scrolledPastMainPlayer, setScrolledPastMainPlayer] = useState(false)

  const isOnRadioPage = location.pathname.startsWith('/radio')

  useEffect(() => {
    const el = scrollContainerRef?.current
    const onScroll = () => {
      const y = (el ? el.scrollTop : 0) || window.scrollY || document.documentElement.scrollTop
      setScrolledPastMainPlayer(y > 420)
    }
    onScroll()
    el?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el?.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll)
    }
  }, [scrollContainerRef, location.pathname])

  const isStreamActiveOrPaused =
    stream.isPlaying || stream.isBuffering || (stream.hasActivated && !stream.miniPlayerDismissed)

  const shouldShow = isStreamActiveOrPaused && (!isOnRadioPage || scrolledPastMainPlayer)

  if (!shouldShow || typeof document === 'undefined') return null

  return createPortal(
    <aside
      aria-label={zh ? '680 News 悬浮迷你播放器' : '680 News floating mini player'}
      className={cn(
        'fixed inset-x-3 bottom-[calc(6.75rem+env(safe-area-inset-bottom,0px))] z-50 flex flex-col gap-2 rounded-2xl border border-primary/40 bg-card/95 p-2.5 shadow-xl backdrop-blur-md transition-all',
        'sm:inset-x-auto sm:right-5 sm:bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:w-80 sm:gap-2.5 sm:p-3.5',
        'lg:right-6 lg:bottom-6',
      )}
    >
      <div className="flex items-center justify-between gap-2.5">
        {/* Play / Pause Button */}
        <button
          type="button"
          onClick={() => toggleRadioStream()}
          aria-label={stream.isPlaying ? (zh ? '暂停 680 直播' : 'Pause 680 live') : zh ? '播放 680 直播' : 'Play 680 live'}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25 transition hover:brightness-110 active:scale-95 sm:size-10"
        >
          {stream.isPlaying ? (
            <Pause className="size-4 fill-current" />
          ) : (
            <Play className="ml-0.5 size-4 fill-current" />
          )}
        </button>

        {/* Station Info & Status */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Radio className="size-3.5 shrink-0 text-primary" />
            <span className="truncate text-xs font-bold text-foreground">680 NewsRadio Live</span>
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                stream.isPlaying
                  ? 'animate-pulse bg-emerald-500'
                  : stream.isBuffering
                    ? 'animate-ping bg-amber-400'
                    : 'bg-muted-foreground/50',
              )}
            />
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="truncate">
              {stream.isBuffering
                ? zh
                  ? '连接中…'
                  : 'Connecting…'
                : stream.isPlaying
                  ? zh
                    ? '实时播报中'
                    : 'Playing live'
                  : zh
                    ? '已暂停'
                    : 'Paused'}
            </span>
            <span>·</span>
            <span className="font-mono">{formatDurationClock(stream.liveListeningSeconds)}</span>
          </div>
        </div>

        {/* Equalizer Bars */}
        <div className="flex h-4 items-end gap-0.5 sm:h-5" aria-hidden="true">
          {[0.4, 0.9, 0.55, 1, 0.7, 0.45].map((h, i) => (
            <span
              key={i}
              className={cn(
                'w-0.5 rounded-full',
                stream.isPlaying ? 'animate-pulse bg-primary' : 'bg-muted-foreground/30',
              )}
              style={{
                height: stream.isPlaying ? `${Math.max(25, h * 100)}%` : '25%',
                animationDelay: `${i * 90}ms`,
              }}
            />
          ))}
        </div>

        {/* Quick Action on Mobile (Jump to /radio or Top) */}
        {!isOnRadioPage ? (
          <button
            type="button"
            onClick={() => navigate('/radio')}
            className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/25 sm:hidden"
          >
            <span>{zh ? '直播台' : 'Studio'}</span>
            <ExternalLink className="size-3" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              scrollContainerRef?.current?.scrollTo({ top: 0, behavior: 'smooth' })
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground sm:hidden"
          >
            ↑
          </button>
        )}

        {/* Close / Dismiss Mini Player */}
        <button
          type="button"
          onClick={() => dismissRadioMiniPlayer()}
          title={zh ? '停止播放并关闭小窗' : 'Stop and close mini player'}
          className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Bottom Controls (Desktop & Tablet >= 640px): Volume + Jump back to /radio */}
      <div className="hidden items-center justify-between gap-2 border-t border-border/60 pt-2 sm:flex">
        <div className="flex flex-1 items-center gap-1.5">
          <button
            type="button"
            onClick={() => toggleRadioMute()}
            aria-label={stream.isMuted ? 'Unmute' : 'Mute'}
            className="text-muted-foreground hover:text-foreground"
          >
            {stream.isMuted || stream.volume === 0 ? (
              <VolumeX className="size-3.5" />
            ) : (
              <Volume2 className="size-3.5" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={stream.isMuted ? 0 : stream.volume}
            onChange={(e) => setRadioVolume(parseFloat(e.target.value))}
            className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            aria-label="Volume"
          />
          <span className="font-mono text-[10px] text-muted-foreground">
            {Math.round((stream.isMuted ? 0 : stream.volume) * 100)}%
          </span>
        </div>

        {!isOnRadioPage ? (
          <button
            type="button"
            onClick={() => navigate('/radio')}
            className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/25"
          >
            <span>{zh ? '返回 680 直播台' : 'Open 680 Studio'}</span>
            <ExternalLink className="size-3" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              scrollContainerRef?.current?.scrollTo({ top: 0, behavior: 'smooth' })
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
          >
            {zh ? '回到顶部 ↑' : 'Top ↑'}
          </button>
        )}
      </div>
    </aside>,
    document.body,
  )
}
