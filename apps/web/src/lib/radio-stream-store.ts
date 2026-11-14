import { useSyncExternalStore } from 'react'
import Hls from 'hls.js'
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
  liveListeningSeconds: number
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
  liveListeningSeconds: 0,
  hasActivated: false,
  miniPlayerDismissed: false,
}

const listeners = new Set<() => void>()
let audioEl: HTMLAudioElement | null = null
let hlsInstance: Hls | null = null
let timerId: number | null = null

function emit() {
  for (const listener of listeners) {
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
        setState({ liveListeningSeconds: state.liveListeningSeconds + 1 })
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

export function startRadioStream(
  primaryUrl = STATION_680_NEWS.primaryStreamUrl,
  secondaryUrl = STATION_680_NEWS.secondaryStreamUrl,
) {
  const audio = getOrCreateAudio()
  if (!audio) return

  stopSpeech()
  setState({
    streamError: null,
    isBuffering: true,
    streamConnected: false,
    hasActivated: true,
    miniPlayerDismissed: false,
  })

  hlsInstance?.destroy()
  hlsInstance = null

  const fail = (reason: string) => {
    setState({
      isBuffering: false,
      isPlaying: false,
      streamConnected: false,
      streamError: reason,
    })
    syncTimer()
  }

  const urls = [primaryUrl, secondaryUrl]

  if (Hls.isSupported()) {
    const tryUrl = (index: number) => {
      const hls = new Hls({ lowLatencyMode: false, maxBufferLength: 20 })
      hlsInstance = hls
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return
        hls.destroy()
        hlsInstance = null
        if (index + 1 < urls.length) {
          tryUrl(index + 1)
        } else {
          fail(`${data.type}: ${data.details}`)
        }
      })
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        audio.volume = state.isMuted ? 0 : state.volume
        audio.playbackRate = state.playbackRate
        audio
          .play()
          .then(() => {
            setState({
              isPlaying: true,
              isBuffering: false,
              streamConnected: true,
            })
            syncTimer()
          })
          .catch((err: Error) => fail(err.message))
      })
      hls.loadSource(urls[index])
      hls.attachMedia(audio)
    }
    tryUrl(0)
  } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
    audio.src = urls[0]
    audio.volume = state.isMuted ? 0 : state.volume
    audio.playbackRate = state.playbackRate
    audio
      .play()
      .then(() => {
        setState({
          isPlaying: true,
          isBuffering: false,
          streamConnected: true,
        })
        syncTimer()
      })
      .catch((err: Error) => fail(err.message))
  } else {
    fail('HLS is not supported in this browser')
  }
}

export function stopRadioStream() {
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
    stopRadioStream()
  } else {
    startRadioStream(primaryUrl, secondaryUrl)
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

export function useRadioStream() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
