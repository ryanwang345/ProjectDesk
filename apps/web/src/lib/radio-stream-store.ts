import { useSyncExternalStore } from 'react'
import type HlsType from 'hls.js'
import { STATION_680_NEWS } from '@/lib/radio-news'
import { stopSpeech } from '@/lib/speech'

export type RadioPlaybackRate = 0.5 | 0.8 | 1 | 1.1 | 1.25

export type RadioStreamState = {
  isPlaying: boolean
  isBuffering: boolean
  streamConnected: boolean
  streamError: string | null
  volume: number
  isMuted: boolean
  playbackRate: RadioPlaybackRate
  hasActivated: boolean
  miniPlayerDismissed: boolean
}

let state: RadioStreamState = {
  isPlaying: false,
  isBuffering: false,
  streamConnected: false,
  streamError: null,
  volume: 1.0,
  isMuted: false,
  playbackRate: 1,
  hasActivated: false,
  miniPlayerDismissed: false,
}

let liveListeningSeconds = 0
const listeners = new Set<() => void>()
const clockListeners = new Set<() => void>()

let audioEl: HTMLAudioElement | null = null
let hlsInstance: HlsType | null = null
let timerId: number | null = null
let streamSessionId = 0

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

function emitClock() {
  for (const listener of clockListeners) {
    listener()
  }
}

function setState(patch: Partial<RadioStreamState>) {
  state = { ...state, ...patch }
  emit()
}

function syncTimer() {
  if (state.isPlaying && timerId === null && typeof window !== 'undefined') {
    timerId = window.setInterval(() => {
      if (state.isPlaying) {
        liveListeningSeconds += 1
        emitClock()
      }
    }, 1000)
  } else if (!state.isPlaying && timerId !== null && typeof window !== 'undefined') {
    window.clearInterval(timerId)
    timerId = null
  }
}

function getOrCreateAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!audioEl) {
    audioEl = new Audio()
    audioEl.preload = 'none'
    audioEl.volume = state.isMuted ? 0 : state.volume
    audioEl.playbackRate = state.playbackRate

    audioEl.addEventListener('waiting', () => {
      setState({ isBuffering: true })
    })
    audioEl.addEventListener('playing', () => {
      setState({ isBuffering: false, isPlaying: true, streamConnected: true })
      syncTimer()
    })
    audioEl.addEventListener('pause', () => {
      setState({ isPlaying: false })
      syncTimer()
    })
    audioEl.addEventListener('error', () => {
      setState({ isBuffering: false })
      syncTimer()
    })
  }
  return audioEl
}

function snapAudioToLiveEdge(audio: HTMLAudioElement, hls: HlsType | null) {
  if (hls && typeof hls.liveSyncPosition === 'number' && Number.isFinite(hls.liveSyncPosition) && hls.liveSyncPosition > 0) {
    try {
      audio.currentTime = hls.liveSyncPosition
    } catch {
      // ignore seek errors before buffer is ready
    }
    return
  }
  if (audio.seekable && audio.seekable.length > 0) {
    try {
      audio.currentTime = audio.seekable.end(audio.seekable.length - 1)
    } catch {
      // ignore
    }
  }
}

export async function startRadioStream(
  primaryUrl = STATION_680_NEWS.primaryStreamUrl,
  secondaryUrl = STATION_680_NEWS.secondaryStreamUrl,
) {
  const audio = getOrCreateAudio()
  if (!audio) return

  const sessionId = ++streamSessionId
  stopSpeech()
  setState({
    streamError: null,
    isBuffering: true,
    hasActivated: true,
    miniPlayerDismissed: false,
  })

  // Fast-resume existing HLS instance when returning from pause
  if (hlsInstance && state.streamConnected) {
    try {
      hlsInstance.startLoad(-1)
      audio.volume = state.isMuted ? 0 : state.volume
      audio.playbackRate = state.playbackRate
      await audio.play()
      if (sessionId !== streamSessionId) return
      setState({
        isPlaying: true,
        isBuffering: false,
        streamConnected: true,
      })
      syncTimer()
      return
    } catch {
      // Fall through to full reconnect if fast-resume fails
    }
  }

  setState({ streamConnected: false })
  hlsInstance?.destroy()
  hlsInstance = null

  const fail = (reason: string) => {
    if (sessionId !== streamSessionId) return
    setState({
      isBuffering: false,
      isPlaying: false,
      streamConnected: false,
      streamError: reason,
    })
    syncTimer()
  }

  const urls = [primaryUrl, secondaryUrl].filter(Boolean)

  try {
    // Dynamically lazy-load hls.js (~578 kB) only when playback actually starts
    const { default: Hls } = await import('hls.js')
    if (sessionId !== streamSessionId) return

    if (!Hls.isSupported()) {
      if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        const tryNative = (index: number) => {
          if (sessionId !== streamSessionId) return
          audio.src = urls[index]
          audio.volume = state.isMuted ? 0 : state.volume
          audio.playbackRate = state.playbackRate
          audio
            .play()
            .then(() => {
              if (sessionId !== streamSessionId) return
              snapAudioToLiveEdge(audio, null)
              setState({
                isPlaying: true,
                isBuffering: false,
                streamConnected: true,
              })
              syncTimer()
            })
            .catch((err: Error) => {
              if (index + 1 < urls.length) {
                tryNative(index + 1)
              } else {
                fail(err.message)
              }
            })
        }
        tryNative(0)
        return
      }
      fail('HLS is not supported in this browser')
      return
    }

    const tryUrl = (index: number) => {
      if (sessionId !== streamSessionId) return

      const hls = new Hls({
        lowLatencyMode: false,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 4,
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        backBufferLength: 8,
        enableWorker: true,
      })
      hlsInstance = hls

      let networkRetries = 0
      let mediaRetries = 0

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (sessionId !== streamSessionId || !data.fatal) return

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 1) {
          networkRetries += 1
          hls.startLoad()
          return
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < 1) {
          mediaRetries += 1
          hls.recoverMediaError()
          return
        }

        hls.destroy()
        if (hlsInstance === hls) {
          hlsInstance = null
        }
        if (index + 1 < urls.length) {
          tryUrl(index + 1)
        } else {
          fail(`${data.type}: ${data.details}`)
        }
      })

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (sessionId !== streamSessionId) return
        audio.volume = state.isMuted ? 0 : state.volume
        audio.playbackRate = state.playbackRate
        audio
          .play()
          .then(() => {
            if (sessionId !== streamSessionId) return
            setState({
              isPlaying: true,
              isBuffering: false,
              streamConnected: true,
            })
            syncTimer()
          })
          .catch((err: Error) => fail(err.message))
      })

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        if (sessionId !== streamSessionId) return
        hls.loadSource(urls[index])
      })
      hls.attachMedia(audio)
    }

    tryUrl(0)
  } catch (err) {
    fail(err instanceof Error ? err.message : 'Failed to load HLS player')
  }
}

export function jumpToLiveEdge() {
  if (!audioEl) return
  if (state.isPlaying) {
    snapAudioToLiveEdge(audioEl, hlsInstance)
  } else {
    void startRadioStream()
  }
}

export function pauseRadioStream() {
  streamSessionId += 1
  audioEl?.pause()
  hlsInstance?.stopLoad()
  setState({
    isPlaying: false,
    isBuffering: false,
  })
  syncTimer()
}

export function stopRadioStream() {
  streamSessionId += 1
  audioEl?.pause()
  hlsInstance?.destroy()
  hlsInstance = null
  setState({
    isPlaying: false,
    isBuffering: false,
    streamConnected: false,
  })
  syncTimer()
}

export function toggleRadioStream(
  primaryUrl = STATION_680_NEWS.primaryStreamUrl,
  secondaryUrl = STATION_680_NEWS.secondaryStreamUrl,
) {
  if (state.isPlaying || state.isBuffering) {
    pauseRadioStream()
  } else {
    void startRadioStream(primaryUrl, secondaryUrl)
  }
}

export function setRadioVolume(volume: number) {
  const clamped = Math.max(0, Math.min(1, volume))
  setState({ volume: clamped, isMuted: false })
  if (audioEl) {
    audioEl.volume = clamped
  }
}

export function toggleRadioMute() {
  const nextMuted = !state.isMuted
  setState({ isMuted: nextMuted })
  if (audioEl) {
    audioEl.volume = nextMuted ? 0 : state.volume
  }
}

export function setRadioPlaybackRate(rate: RadioPlaybackRate) {
  setState({ playbackRate: rate })
  if (audioEl) {
    audioEl.playbackRate = rate
  }
}

export function dismissRadioMiniPlayer() {
  stopRadioStream()
  setState({ miniPlayerDismissed: true })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return state
}

function subscribeClock(listener: () => void) {
  clockListeners.add(listener)
  return () => {
    clockListeners.delete(listener)
  }
}

function getClockSnapshot() {
  return liveListeningSeconds
}

export function useRadioStream() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useRadioListeningSeconds() {
  return useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot)
}
