export type SpeechAccent = 'auto' | 'en-GB' | 'en-US'
export type SpeechPreferences = { accent: SpeechAccent; speed: 'normal' | 'slow' }
export type SpeechState = {
  text: string
  status: 'idle' | 'loading' | 'playing' | 'ready' | 'error'
  source?: 'recording' | 'neural' | 'device'
  accent?: string
  sourceUrl?: string
  license?: { name: string; url: string }
}

type RecordedClip = { audio: string; text?: string; sourceUrl?: string; license?: { name: string; url: string } }
type AudioClip = { url: string; bytes: number; source: 'recording' | 'neural'; accent?: string; sourceUrl?: string; license?: { name: string; url: string } }

const STORAGE_KEY = 'projectdesk.pronunciation'
const listeners = new Set<() => void>()
let preferences: SpeechPreferences = { accent: 'auto', speed: 'normal' }
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<SpeechPreferences> | null
  if (saved?.accent === 'en-GB' || saved?.accent === 'en-US') preferences.accent = saved.accent
  if (saved?.speed === 'slow') preferences.speed = saved.speed
} catch { /* Optional browser storage. */ }
let state: SpeechState = { text: '', status: 'idle' }
let generation = 0
let controller: AbortController | null = null
let activeAudio: HTMLAudioElement | null = null
let utterance: SpeechSynthesisUtterance | null = null
let readyClip: { key: string; clip: AudioClip } | null = null
let cancelAudio: (() => void) | null = null
const audioCache = new Map<string, AudioClip>()
const recordingCache = new Map<string, RecordedClip[]>()
let audioBytes = 0
let neuralStatus: { available: boolean; checkedAt: number } | null = null

export const subscribeSpeech = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const getSpeechPreferences = () => preferences
export const getSpeechState = () => state
function emit() { for (const listener of listeners) listener() }
function setState(next: SpeechState) { state = next; emit() }

export function setSpeechPreferences(next: Partial<SpeechPreferences>) {
  stopSpeech()
  preferences = { ...preferences, ...next }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)) } catch { /* Optional storage. */ }
  emit()
}

export function stopSpeech() {
  generation++
  controller?.abort()
  controller = null
  cancelAudio?.()
  cancelAudio = null
  if (activeAudio) {
    activeAudio.onended = null
    activeAudio.onerror = null
    activeAudio.pause()
    activeAudio.removeAttribute('src')
    activeAudio = null
  }
  if (utterance) {
    utterance.onend = null
    utterance.onerror = null
    utterance = null
  }
  window.speechSynthesis?.cancel()
  setState({ ...state, status: 'idle' })
}

// Accent remains consistent when explicitly selected. Novelty/effect voices are
// excluded; natural and enhanced voices rank above compact system voices.
export function preferredEnglishVoice(voices: SpeechSynthesisVoice[], accent: SpeechAccent): SpeechSynthesisVoice | undefined {
  const english = voices.filter((voice) => /^en(?:[-_]|$)/i.test(voice.lang) && !/\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|hysterical|jester|organ|trinoids|whisper|wobble|zarvox)\b/i.test(voice.name))
  function score(voice: SpeechSynthesisVoice) {
    const language = voice.lang.replace('_', '-').toLowerCase()
    const requested = accent === 'auto' ? 'en-gb' : accent.toLowerCase()
    let total = accent === 'auto' ? (language === requested ? 20 : 0) : language === requested ? 250 : -250
    if (/natural|neural/i.test(voice.name)) total += 120
    if (/premium|enhanced/i.test(voice.name)) total += 90
    if (/google|siri|online/i.test(voice.name)) total += 50
    if (!voice.localService) total += 15
    if (voice.default) total += 5
    return total
  }
  return english.sort((a, b) => score(b) - score(a))[0]
}

function safeLink(raw?: string): string | undefined {
  if (!raw) return undefined
  try {
    const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw)
    return url.protocol === 'https:' ? url.href : undefined
  } catch { return undefined }
}

function recordingAccent(url: string): 'en-GB' | 'en-US' | undefined {
  if (/(?:[-_])(?:uk|gb)(?:[-_.])/i.test(url)) return 'en-GB'
  if (/(?:[-_])us(?:[-_.])/i.test(url)) return 'en-US'
  return undefined
}

async function boundedFetch<T>(signal: AbortSignal, milliseconds: number, run: (bounded: AbortSignal) => Promise<T>): Promise<T> {
  const bounded = new AbortController()
  const abort = () => bounded.abort()
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) bounded.abort()
  const timer = window.setTimeout(abort, milliseconds)
  try { return await run(bounded.signal) }
  finally { window.clearTimeout(timer); signal.removeEventListener('abort', abort) }
}

async function recordedAudio(text: string, accent: SpeechAccent, signal: AbortSignal): Promise<AudioClip | null> {
  const word = text.toLowerCase()
  if (!/^[a-z]+(?:['’-][a-z]+)*$/.test(word) || word.length > 60) return null
  let clips = recordingCache.get(word)
  if (!clips) {
    clips = await boundedFetch(signal, 2200, async (bounded) => {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal: bounded, referrerPolicy: 'no-referrer' })
      if (!response.ok) return []
      const entries = await response.json() as Array<{ phonetics?: RecordedClip[] }>
      return Array.isArray(entries) ? entries.flatMap((entry) => entry.phonetics ?? []).filter((clip) => safeLink(clip.audio)) : []
    })
    // Cache actual dictionary results, not transient network failures.
    if (recordingCache.size >= 128) recordingCache.delete(recordingCache.keys().next().value!)
    recordingCache.set(word, clips)
  }
  const candidates = clips.filter((clip) => accent === 'auto' || recordingAccent(clip.audio) === accent)
  const recording = candidates.find((clip) => recordingAccent(clip.audio) === (accent === 'auto' ? 'en-GB' : accent)) ?? candidates[0]
  const url = safeLink(recording?.audio)
  if (!recording || !url) return null
  const licenseUrl = safeLink(recording.license?.url)
  return { url, bytes: 0, source: 'recording', accent: recordingAccent(url), sourceUrl: safeLink(recording.sourceUrl), license: licenseUrl ? { name: recording.license!.name, url: licenseUrl } : undefined }
}

async function neuralAudio(text: string, accent: SpeechAccent, signal: AbortSignal): Promise<AudioClip | null> {
  if (!neuralStatus || Date.now() - neuralStatus.checkedAt > 60000) {
    const available = await boundedFetch(signal, 1800, async (bounded) => {
      const response = await fetch('/api/english/speech', { signal: bounded })
      return response.ok && (await response.json() as { available: boolean }).available === true
    })
    neuralStatus = { available, checkedAt: Date.now() }
  }
  if (!neuralStatus.available) return null
  return boundedFetch(signal, 22000, async (bounded) => {
    const response = await fetch('/api/english/speech', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: bounded,
      body: JSON.stringify({ text, accent }),
    })
    if (!response.ok || !response.headers.get('Content-Type')?.startsWith('audio/')) return null
    const blob = await response.blob()
    if (blob.size === 0 || blob.size > 4 * 1024 * 1024) return null
    return { url: URL.createObjectURL(blob), bytes: blob.size, source: 'neural', accent: accent === 'auto' ? 'en-GB' : accent }
  })
}

// Recover the original licensed recording when the dictionary's audio mirror
// fails. Ask Commons for its MP3 derivative, which also plays on Safari.
async function originalRecording(clip: AudioClip, signal: AbortSignal): Promise<AudioClip | null> {
  if (!clip.sourceUrl) return null
  const source = new URL(clip.sourceUrl)
  if (source.hostname !== 'commons.wikimedia.org') return null
  const params = new URLSearchParams({ action: 'query', prop: 'videoinfo', viprop: 'url|derivatives', format: 'json', origin: '*' })
  const pageId = source.searchParams.get('curid')
  const title = decodeURIComponent(source.pathname.replace(/^\/wiki\//, ''))
  if (pageId && /^\d+$/.test(pageId)) params.set('pageids', pageId)
  else if (title.startsWith('File:')) params.set('titles', title)
  else return null
  return boundedFetch(signal, 2200, async (bounded) => {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal: bounded, referrerPolicy: 'no-referrer' })
    if (!response.ok) return null
    const result = await response.json() as { query?: { pages?: Record<string, { videoinfo?: Array<{ derivatives?: Array<{ src: string; type: string }> }> }> } }
    for (const page of Object.values(result.query?.pages ?? {})) {
      for (const media of page.videoinfo ?? []) {
        const mp3 = media.derivatives?.find((item) => item.type === 'audio/mpeg')
        const url = safeLink(mp3?.src)
        if (url && new URL(url).hostname === 'upload.wikimedia.org') return { ...clip, url }
      }
    }
    return null
  })
}

function rememberAudio(key: string, clip: AudioClip) {
  const previous = audioCache.get(key)
  if (previous) {
    if (previous.url !== clip.url && previous.url.startsWith('blob:')) URL.revokeObjectURL(previous.url)
    audioBytes -= previous.bytes
    audioCache.delete(key)
  }
  while (audioCache.size >= 48 || audioBytes + clip.bytes > 12 * 1024 * 1024) {
    const oldest = audioCache.keys().next().value!
    const removed = audioCache.get(oldest)!
    if (removed.url.startsWith('blob:')) URL.revokeObjectURL(removed.url)
    audioBytes -= removed.bytes
    audioCache.delete(oldest)
  }
  audioCache.set(key, clip)
  audioBytes += clip.bytes
}

async function playAudio(clip: AudioClip, text: string, key: string, current: number) {
  if (generation !== current) return
  const audio = new Audio(clip.url)
  activeAudio = audio
  audio.playbackRate = preferences.speed === 'slow' ? 0.8 : 1
  audio.preservesPitch = true
  const metadata = { text, source: clip.source, accent: clip.accent, sourceUrl: clip.sourceUrl, license: clip.license }
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const timer = window.setTimeout(() => finish(new Error('Audio did not start')), 8000)
    function finish(error?: unknown) {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      cancelAudio = null
      if (error) {
        audio.onended = null
        audio.onerror = null
        audio.pause()
        audio.removeAttribute('src')
        if (activeAudio === audio) activeAudio = null
        reject(error)
      }
      else resolve()
    }
    cancelAudio = () => finish(new DOMException('Playback stopped', 'AbortError'))
    audio.onerror = () => {
      if (settled && generation === current) setState({ ...metadata, status: 'error' })
      else finish(new Error('Audio could not be loaded'))
    }
    audio.onended = () => { if (generation === current) { activeAudio = null; setState({ ...metadata, status: 'idle' }) } }
    audio.play().then(() => {
      if (generation !== current) { audio.pause(); finish(); return }
      readyClip = null
      setState({ ...metadata, status: 'playing' })
      finish()
    }).catch((error: unknown) => {
      if (generation === current && error instanceof DOMException && error.name === 'NotAllowedError') {
        readyClip = { key, clip }
        setState({ ...metadata, status: 'ready' })
        finish()
      } else finish(error)
    })
  })
}

async function speakWithDevice(text: string, current: number, signal: AbortSignal) {
  const synth = window.speechSynthesis
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') throw new Error('Speech is unavailable')
  if (synth.getVoices().length === 0) {
    await new Promise<void>((resolve) => {
      const finish = () => { window.clearTimeout(timer); synth.removeEventListener('voiceschanged', finish); signal.removeEventListener('abort', finish); resolve() }
      const timer = window.setTimeout(finish, 600)
      synth.addEventListener('voiceschanged', finish, { once: true })
      signal.addEventListener('abort', finish, { once: true })
    })
  }
  // Chrome needs a separate task after cancel() before starting speech again.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 80))
  if (generation !== current || signal.aborted) return
  const utter = new SpeechSynthesisUtterance(text)
  const voice = preferredEnglishVoice(synth.getVoices(), preferences.accent)
  if (voice) utter.voice = voice
  utter.lang = voice?.lang ?? (preferences.accent === 'auto' ? 'en-GB' : preferences.accent)
  utter.rate = preferences.speed === 'slow' ? 0.8 : 1
  utter.pitch = 1
  utter.volume = 1
  utterance = utter
  const startTimer = window.setTimeout(() => {
    if (generation === current && state.status === 'loading') {
      synth.cancel()
      setState({ text, status: 'error', source: 'device' })
    }
  }, 7000)
  signal.addEventListener('abort', () => window.clearTimeout(startTimer), { once: true })
  utter.onstart = () => { window.clearTimeout(startTimer); if (generation === current) setState({ text, status: 'playing', source: 'device', accent: utter.lang }) }
  utter.onend = () => { window.clearTimeout(startTimer); if (generation === current) { utterance = null; setState({ ...state, status: 'idle' }) } }
  utter.onerror = (event) => {
    window.clearTimeout(startTimer)
    if (generation !== current || event.error === 'interrupted' || event.error === 'canceled') return
    utterance = null
    setState({ text, status: 'error', source: 'device' })
  }
  synth.resume()
  synth.speak(utter)
}

export async function speakWord(word: string) {
  const text = word.trim().replace(/\s+/g, ' ')
  if (!text) return
  stopSpeech()
  const current = generation
  controller = new AbortController()
  const signal = controller.signal
  const key = `${preferences.accent}:${text}`
  setState({ text, status: 'loading' })
  const prepared = readyClip?.key === key ? readyClip.clip : audioCache.get(key)
  const failedAudioUrls = new Set<string>()
  if (prepared) {
    try { await playAudio(prepared, text, key, current); return }
    catch { if (signal.aborted) return; failedAudioUrls.add(prepared.url) }
  }
  try {
    const recording = await recordedAudio(text, preferences.accent, signal)
    if (recording && generation === current) {
      if (!failedAudioUrls.has(recording.url)) {
        rememberAudio(key, recording)
        try { await playAudio(recording, text, key, current); return }
        catch { if (signal.aborted) return; failedAudioUrls.add(recording.url) }
      }
      const original = await originalRecording(recording, signal)
      if (original && !failedAudioUrls.has(original.url) && generation === current) {
        rememberAudio(key, original)
        try { await playAudio(original, text, key, current); return }
        catch { if (signal.aborted) return }
      }
    }
  } catch { if (signal.aborted) return }
  try {
    const neural = await neuralAudio(text, preferences.accent, signal)
    if (neural && generation === current) {
      rememberAudio(key, neural)
      try { await playAudio(neural, text, key, current); return }
      catch { if (signal.aborted) return }
    } else if (neural?.url.startsWith('blob:')) URL.revokeObjectURL(neural.url)
  } catch { if (signal.aborted) return }
  if (generation !== current) return
  try { await speakWithDevice(text, current, signal) }
  catch { if (generation === current) setState({ text, status: 'error' }) }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', stopSpeech)
}
