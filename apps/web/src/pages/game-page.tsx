import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BookOpen, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { useEnglish } from '@/hooks/use-english'
import { useI18n } from '@/i18n'
import type { EnglishCard } from '@/lib/english'
import { speakWord } from '@/lib/speech'
import { BUILTIN_VOCAB_CARDS } from '@/lib/vocab-builtin'

const BEST_KEY = 'hydro_racer_3d_best_v1'

class SoundFX {
  private ctx: AudioContext | null = null
  private engineOsc: OscillatorNode | null = null
  private engineSub: OscillatorNode | null = null
  private engineFilter: BiquadFilterNode | null = null
  private engineGain: GainNode | null = null
  muted = false

  ensure(): AudioContext | null {
    if (this.muted) return null
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) this.ctx = new AudioCtx()
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  updateEngine(active: boolean, speed: number, gear: number, boost: boolean) {
    if (this.muted || !active) {
      if (this.engineGain && this.ctx) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08)
      }
      return
    }
    const ctx = this.ensure()
    if (!ctx) return
    if (!this.engineOsc) {
      this.engineOsc = ctx.createOscillator()
      this.engineSub = ctx.createOscillator()
      this.engineFilter = ctx.createBiquadFilter()
      this.engineGain = ctx.createGain()

      this.engineOsc.type = 'sawtooth'
      this.engineSub.type = 'triangle'
      this.engineFilter.type = 'lowpass'
      this.engineFilter.frequency.value = 320
      this.engineGain.gain.value = 0

      this.engineOsc.connect(this.engineFilter)
      this.engineSub.connect(this.engineFilter)
      this.engineFilter.connect(this.engineGain).connect(ctx.destination)
      this.engineOsc.start()
      this.engineSub.start()
    }
    const baseFreq = 52 + speed * 1.45 + (gear - 1) * 9 + (boost ? 24 : 0)
    this.engineOsc.frequency.setTargetAtTime(baseFreq, ctx.currentTime, 0.06)
    this.engineSub?.frequency.setTargetAtTime(baseFreq * 0.5, ctx.currentTime, 0.06)
    this.engineFilter?.frequency.setTargetAtTime(boost ? 780 : 300 + speed * 6, ctx.currentTime, 0.08)
    this.engineGain?.gain.setTargetAtTime(boost ? 0.055 : 0.032, ctx.currentTime, 0.08)
  }

  stopEngine() {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04)
    }
  }

  playCountdown(go: boolean) {
    const ctx = this.ensure()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(go ? 880 : 440, ctx.currentTime)
    gain.gain.setValueAtTime(0.14, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (go ? 0.32 : 0.16))
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (go ? 0.34 : 0.17))
  }

  playJump() {
    const ctx = this.ensure()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.16)
    gain.gain.setValueAtTime(0.14, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.18)
  }

  playGearUp(perfect: boolean) {
    const ctx = this.ensure()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(perfect ? 320 : 210, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(perfect ? 740 : 340, ctx.currentTime + 0.18)
    gain.gain.setValueAtTime(0.16, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
  }

  playGift() {
    const ctx = this.ensure()
    if (!ctx) return
    const now = ctx.currentTime
    ;[587.33, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + i * 0.06)
      gain.gain.setValueAtTime(0.15, now + i * 0.06)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.06)
      osc.stop(now + i * 0.06 + 0.19)
    })
  }

  playWordComplete() {
    const ctx = this.ensure()
    if (!ctx) return
    const now = ctx.currentTime
    ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + i * 0.06)
      gain.gain.setValueAtTime(0.14, now + i * 0.06)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.06)
      osc.stop(now + i * 0.06 + 0.23)
    })
  }

  playWrongLetter() {
    const ctx = this.ensure()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(190, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.14)
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  }

  playCrash() {
    const ctx = this.ensure()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(140, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(36, ctx.currentTime + 0.28)
    gain.gain.setValueAtTime(0.22, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  }
}

type GamePhase = 'start' | 'countdown' | 'playing' | 'paused' | 'gameover'
type DifficultyLevel = 'easy' | 'normal' | 'hard'

const DIFFICULTY_CONFIG: Record<
  DifficultyLevel,
  {
    labelEn: string
    labelZh: string
    startSpeed: number
    maxSpeed: number
    accel: number
    minSlots: number
    extraSlotChance: number
    highlightHint: boolean
    scoreMult: number
  }
> = {
  easy: {
    labelEn: 'Easy',
    labelZh: '简单',
    startSpeed: 18,
    maxSpeed: 38,
    accel: 0.24,
    minSlots: 1,
    extraSlotChance: 0.45,
    highlightHint: true,
    scoreMult: 1,
  },
  normal: {
    labelEn: 'Normal',
    labelZh: '普通',
    startSpeed: 23,
    maxSpeed: 50,
    accel: 0.38,
    minSlots: 2,
    extraSlotChance: 0.45,
    highlightHint: true,
    scoreMult: 1.5,
  },
  hard: {
    labelEn: 'Hard',
    labelZh: '困难',
    startSpeed: 29,
    maxSpeed: 62,
    accel: 0.55,
    minSlots: 3,
    extraSlotChance: 0.45,
    highlightHint: false,
    scoreMult: 2,
  },
}

type WordChallenge = {
  card: EnglishCard
  letters: string[]
  missingIndices: number[]
  filledIndices: number[]
}

function buildWordChallenge(card: EnglishCard): WordChallenge {
  const clean = card.word.trim().toLowerCase()
  const letters = clean.split('')
  const count = clean.length >= 9 ? 3 : clean.length >= 6 ? 2 : 1

  const candidates: number[] = []
  for (let i = 1; i < letters.length; i++) {
    if (/[a-z]/.test(letters[i])) candidates.push(i)
  }
  const picked: number[] = []
  const step = Math.max(1, Math.floor(candidates.length / count))
  for (let i = 0; i < candidates.length && picked.length < count; i += step) {
    picked.push(candidates[i])
  }
  if (picked.length === 0 && letters.length > 0) picked.push(0)
  picked.sort((a, b) => a - b)

  return { card, letters, missingIndices: picked, filledIndices: [] }
}

function randomDecoyLetters(target: string, count: number): string[] {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'
  const out: string[] = []
  while (out.length < count) {
    const ch = alphabet[Math.floor(Math.random() * alphabet.length)]
    if (ch !== target && !out.includes(ch)) out.push(ch)
  }
  return out
}

export function GamePage() {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  const { cards } = useEnglish()

  const usableCards = cards.filter((c) => /^[a-zA-Z]{4,14}$/.test(c.word.trim()) && c.meaning)
  const effectiveCards = usableCards.length >= 3 ? usableCards : BUILTIN_VOCAB_CARDS
  const cardsRef = useRef<EnglishCard[]>(effectiveCards)
  cardsRef.current = effectiveCards

  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sfxRef = useRef<SoundFX>(new SoundFX())
  const startGameRef = useRef<(() => void) | null>(null)
  const togglePauseRef = useRef<(() => void) | null>(null)
  const gearUpRef = useRef<(() => void) | null>(null)
  const gasRef = useRef(false)
  const brakeRef = useRef(false)
  const mutedRef = useRef(false)

  const [phase, setPhase] = useState<GamePhase>('start')
  const [countdownLabel, setCountdownLabel] = useState<'3' | '2' | '1' | 'GO!'>('3')
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('normal')
  const difficultyRef = useRef<DifficultyLevel>('normal')
  difficultyRef.current = difficulty

  const [score, setScore] = useState(0)
  const [wordsDone, setWordsDone] = useState(0)
  const [stage, setStage] = useState(1)
  const [rivalScore, setRivalScore] = useState(0)
  const [rivalWordsDone, setRivalWordsDone] = useState(0)
  const [isBraking, setIsBraking] = useState(false)
  const [streak, setStreak] = useState(0)
  const [mph, setMph] = useState(0)
  const [gear, setGear] = useState(1)
  const [posRank, setPosRank] = useState<1 | 2>(1)
  const [isTurbo, setIsTurbo] = useState(false)
  const [rpmNeedle, setRpmNeedle] = useState(0.25)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [callout, setCallout] = useState<{ text: string; tone: 'sky' | 'amber' | 'emerald' | 'rose' } | null>(null)
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(BEST_KEY) || 0)
    } catch {
      return 0
    }
  })
  const [muted, setMuted] = useState(false)
  const [challenge, setChallenge] = useState<WordChallenge | null>(null)
  const [challengeFeedback, setChallengeFeedback] = useState<'none' | 'hit' | 'miss' | 'complete'>('none')
  const [learnedWords, setLearnedWords] = useState<EnglishCard[]>([])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      sfxRef.current.muted = next
      mutedRef.current = next
      return next
    })
  }, [])

  const pronounceCard = useCallback((card: EnglishCard) => {
    if (mutedRef.current) return
    void speakWord(card.word, { allowAI: false })
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const sfx = sfxRef.current
    const width = Math.max(container.clientWidth, 320)
    const height = Math.max(container.clientHeight, 320)

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height, false)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.85

    const scene = new THREE.Scene()
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = envRT.texture
    scene.environmentIntensity = 0.35

    // Dynamic 4-biome sky backdrop (GPU shader for smooth 60fps day/dusk/night/dawn transitions)
    const skyUniforms = {
      uTopColor: { value: new THREE.Color(0x0369a1) },
      uMidColor: { value: new THREE.Color(0x0ea5e9) },
      uHorizonColor: { value: new THREE.Color(0xfde68a) },
      uSunColor: { value: new THREE.Color(0xfef08a) },
      uSunPos: { value: new THREE.Vector2(0.18, 0.34) },
    }
    const skyMat = new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform vec2 uSunPos;
        varying vec2 vUv;
        void main() {
          float h = clamp(vUv.y, 0.0, 1.0);
          vec3 sky = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.45, h));
          sky = mix(sky, uTopColor, smoothstep(0.45, 0.95, h));
          float d = distance(vUv, uSunPos);
          float glow = exp(-d * 4.5) * 0.65;
          sky += uSunColor * glow;
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    })
    const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(520, 220), skyMat)
    skyPlane.position.set(0, 58, -210)
    scene.add(skyPlane)

    scene.background = new THREE.Color(0x0369a1)
    scene.fog = new THREE.FogExp2(0xfde68a, 0.0048)

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 280)
    camera.position.set(0, 4.6, 8.8)
    camera.lookAt(0, 1.2, -12)

    const hemiLight = new THREE.HemisphereLight(0xfef3c7, 0x0e7490, 0.72)
    scene.add(hemiLight)

    const dirLight = new THREE.DirectionalLight(0xffedd5, 0.95)
    dirLight.position.set(-24, 34, 18)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(1024, 1024)
    dirLight.shadow.camera.near = 5
    dirLight.shadow.camera.far = 95
    const d = 28
    dirLight.shadow.camera.left = -d
    dirLight.shadow.camera.right = d
    dirLight.shadow.camera.top = d
    dirLight.shadow.camera.bottom = -d
    scene.add(dirLight)

    // Post-processing Bloom (high threshold so only sun & floodlights softly glow)
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.14, 0.4, 1.15)
    composer.addPass(bloomPass)
    composer.addPass(new OutputPass())

    // Materials (Water is handled by the reflective Water shader below)
    const matConcrete = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9, flatShading: true })
    const matSkirt = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, flatShading: true })
    const matHull = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      roughness: 0.28,
      metalness: 0.45,
      flatShading: true,
    })
    const matHullRival = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.3,
      metalness: 0.45,
      flatShading: true,
    })
    const matHullAccent = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.6 })
    const matGlass = new THREE.MeshStandardMaterial({
      color: 0x020617,
      roughness: 0.1,
      metalness: 0.9,
    })
    const matTurbine = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.48, metalness: 0.55 })
    const matRamp = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, flatShading: true })

    // Sponsor banner texture along stadium canal walls
    const bannerCanvas = document.createElement('canvas')
    bannerCanvas.width = 512
    bannerCanvas.height = 64
    const bCtx = bannerCanvas.getContext('2d')
    if (bCtx) {
      const blocks = [
        { bg: '#0f172a', fg: '#f8fafc', txt: 'TOPSPEED' },
        { bg: '#0284c7', fg: '#ffffff', txt: 'HYDRO' },
        { bg: '#334155', fg: '#e2e8f0', txt: 'LINGUADESK' },
        { bg: '#0f172a', fg: '#38bdf8', txt: 'PRESS' },
      ]
      blocks.forEach((b, i) => {
        bCtx.fillStyle = b.bg
        bCtx.fillRect(i * 128, 0, 128, 64)
        bCtx.fillStyle = b.fg
        bCtx.font = 'bold 20px system-ui, sans-serif'
        bCtx.textAlign = 'center'
        bCtx.textBaseline = 'middle'
        bCtx.fillText(b.txt, i * 128 + 64, 34)
      })
    }
    const bannerTex = new THREE.CanvasTexture(bannerCanvas)
    bannerTex.colorSpace = THREE.SRGBColorSpace
    bannerTex.wrapS = THREE.RepeatWrapping
    bannerTex.repeat.set(3, 1)
    const matBanner = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.6 })

    // High-resolution stadium cheering crowd texture for crisp bleachers
    const crowdCanvas = document.createElement('canvas')
    crowdCanvas.width = 512
    crowdCanvas.height = 256
    const crowdCtx = crowdCanvas.getContext('2d')
    if (crowdCtx) {
      crowdCtx.fillStyle = '#1e293b'
      crowdCtx.fillRect(0, 0, 512, 256)
      const shirtColors = ['#fbbf24', '#f97316', '#f8fafc', '#38bdf8', '#fde047', '#94a3b8', '#e2e8f0']
      for (let row = 4; row < 252; row += 6) {
        crowdCtx.fillStyle = '#0f172a'
        crowdCtx.fillRect(0, row + 4, 512, 2)
        for (let col = 2; col < 510; col += 4) {
          crowdCtx.fillStyle = shirtColors[(row * 7 + col * 3) % shirtColors.length]
          crowdCtx.fillRect(col, row, 2, 3)
        }
      }
    }
    const crowdTex = new THREE.CanvasTexture(crowdCanvas)
    crowdTex.colorSpace = THREE.SRGBColorSpace
    crowdTex.wrapS = THREE.RepeatWrapping
    crowdTex.repeat.set(2, 1)
    const matCrowd = new THREE.MeshStandardMaterial({ map: crowdTex, roughness: 0.85 })
    const matGantry = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5, flatShading: true })

    // Cached 3D Letter Cube textures (A-Z, normal & highlighted hint)
    const letterMaterials = new Map<string, THREE.MeshStandardMaterial>()
    function getLetterMaterial(letter: string, highlighted: boolean): THREE.MeshStandardMaterial {
      const upper = letter.toUpperCase()
      const key = `${upper}:${highlighted ? '1' : '0'}`
      const existing = letterMaterials.get(key)
      if (existing) return existing

      const c = document.createElement('canvas')
      c.width = 128
      c.height = 128
      const ctx = c.getContext('2d')
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 128, 128)
        if (highlighted) {
          grad.addColorStop(0, '#fbbf24')
          grad.addColorStop(1, '#d97706')
        } else {
          grad.addColorStop(0, '#0ea5e9')
          grad.addColorStop(1, '#1d4ed8')
        }
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, 128, 128)

        ctx.strokeStyle = highlighted ? '#fef08a' : '#bae6fd'
        ctx.lineWidth = highlighted ? 10 : 8
        ctx.strokeRect(5, 5, 118, 118)

        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 76px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(upper, 64, 68)
      }

      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: highlighted ? 0.22 : 0.3,
        emissive: new THREE.Color(highlighted ? 0xf59e0b : 0x0284c7),
        emissiveIntensity: highlighted ? 0.45 : 0.2,
      })
      letterMaterials.set(key, mat)
      return mat
    }

    const letterBoxGeo = new THREE.BoxGeometry(1.35, 1.35, 1.35)
    function createLetterCube(letter: string, isTarget = false) {
      const g = new THREE.Group()
      const cube = new THREE.Mesh(letterBoxGeo, getLetterMaterial(letter, isTarget))
      cube.castShadow = true
      g.add(cube)
      g.position.y = 1.05
      g.userData = { type: 'letter', letter: letter.toLowerCase(), isTarget, radius: 1.05 }
      return g
    }

    // Build Racing Hovercraft (black skirt, cyan hull, cockpit, giant rear turbine fan)
    function createHovercraft(bodyMat: THREE.MeshStandardMaterial) {
      const group = new THREE.Group()

      // Inflatable black rubber skirt
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.36, 3.2), matSkirt)
      skirt.position.set(0, 0.2, 0)
      skirt.castShadow = true
      group.add(skirt)

      const noseSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.88, 0.36, 10), matSkirt)
      noseSkirt.position.set(0, 0.2, -1.55)
      group.add(noseSkirt)

      // Sleek hull
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.48, 2.7), bodyMat)
      hull.position.set(0, 0.56, 0.05)
      hull.castShadow = true
      group.add(hull)

      const bow = new THREE.Mesh(new THREE.ConeGeometry(0.76, 1.25, 6), bodyMat)
      bow.rotation.x = -Math.PI / 2
      bow.scale.set(1.0, 1.0, 0.65)
      bow.position.set(0, 0.52, -1.75)
      bow.castShadow = true
      group.add(bow)

      // Racing stripe
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 2.5), matHullAccent)
      stripe.position.set(0, 0.82, -0.2)
      group.add(stripe)

      // Cockpit canopy
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.38, 1.15), matGlass)
      canopy.position.set(0, 0.92, -0.35)
      canopy.rotation.x = 0.14
      group.add(canopy)

      // Giant rear ducted turbine fan
      const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.13, 8, 16), matTurbine)
      shroud.position.set(0, 1.02, 1.28)
      shroud.castShadow = true
      group.add(shroud)

      const fanGroup = new THREE.Group()
      fanGroup.position.set(0, 1.02, 1.28)
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.05, 0.05), matHullAccent)
        blade.rotation.z = (i * Math.PI) / 4
        fanGroup.add(blade)
      }
      group.add(fanGroup)
      group.userData = { fan: fanGroup }

      // Side thrusters + glowing exhaust rings
      const exhaustMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      ;[-0.82, 0.82].forEach((x) => {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 8), matTurbine)
        pod.rotation.x = Math.PI / 2
        pod.position.set(x, 0.65, 0.85)
        group.add(pod)

        const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.17, 12), exhaustMat)
        glowRing.position.set(x, 0.65, 1.31)
        group.add(glowRing)
      })
      group.userData.exhaustMat = exhaustMat

      return group
    }

    const playerCraft = createHovercraft(matHull)
    scene.add(playerCraft)

    // Load custom Blender boat model (/models/player-boat.glb) with Draco support
    let disposed = false
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('/draco/')
    const gltfLoader = new GLTFLoader()
    gltfLoader.setDRACOLoader(dracoLoader)

    gltfLoader.load(
      '/models/player-boat.glb',
      (gltf) => {
        if (disposed) return
        const model = gltf.scene

        // Auto-align boat's exact longitudinal spine to the -Z axis (handles diagonal Tripo/Blender exports)
        model.updateMatrixWorld(true)
        const pts: { x: number; z: number }[] = []
        const v = new THREE.Vector3()
        let sumX = 0
        let sumZ = 0
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh
          if (!mesh.isMesh || !mesh.geometry) return
          const pos = mesh.geometry.attributes.position
          if (!pos) return
          const step = Math.max(1, Math.floor(pos.count / 1500))
          for (let i = 0; i < pos.count; i += step) {
            v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
            pts.push({ x: v.x, z: v.z })
            sumX += v.x
            sumZ += v.z
          }
        })

        if (pts.length > 10) {
          const meanX = sumX / pts.length
          const meanZ = sumZ / pts.length
          let cxx = 0
          let czz = 0
          let cxz = 0
          for (const p of pts) {
            const dx = p.x - meanX
            const dz = p.z - meanZ
            cxx += dx * dx
            czz += dz * dz
            cxz += dx * dz
          }
          // Principal axis angle relative to +Z
          const yawToZ = 0.5 * Math.atan2(2 * cxz, czz - cxx)
          model.rotation.y = -yawToZ
          model.updateMatrixWorld(true)

          // Verify whether the narrower bow is at -Z or +Z; flip 180 deg if bow is at +Z
          let minZ = Infinity
          let maxZ = -Infinity
          const alignedPts: { x: number; z: number }[] = []
          for (const p of pts) {
            const cos = Math.cos(-yawToZ)
            const sin = Math.sin(-yawToZ)
            const rx = (p.x - meanX) * cos + (p.z - meanZ) * sin
            const rz = -(p.x - meanX) * sin + (p.z - meanZ) * cos
            if (rz < minZ) minZ = rz
            if (rz > maxZ) maxZ = rz
            alignedPts.push({ x: rx, z: rz })
          }
          const spanZ = maxZ - minZ
          let negWidth = 0
          let negCount = 0
          let posWidth = 0
          let posCount = 0
          for (const ap of alignedPts) {
            if (ap.z < minZ + spanZ * 0.28) {
              negWidth += Math.abs(ap.x)
              negCount += 1
            } else if (ap.z > maxZ - spanZ * 0.28) {
              posWidth += Math.abs(ap.x)
              posCount += 1
            }
          }
          const avgNegW = negCount > 0 ? negWidth / negCount : 0
          const avgPosW = posCount > 0 ? posWidth / posCount : 0
          if (avgPosW < avgNegW) {
            model.rotation.y += Math.PI
          }
        }

        // Normalize bounding box to match ~3.4m hull length
        const box = new THREE.Box3().setFromObject(model)
        const size = new THREE.Vector3()
        box.getSize(size)
        const scaleFactor = 3.4 / Math.max(size.z, size.x, 0.001)
        model.scale.multiplyScalar(scaleFactor)

        // Auto-level any built-in roll tilt (common in AI-generated 3D meshes)
        const rollPivot = new THREE.Group()
        rollPivot.add(model)
        rollPivot.updateMatrixWorld(true)

        let sumRX = 0
        let sumRY = 0
        const rollPts: { x: number; y: number }[] = []
        rollPivot.traverse((obj) => {
          const mesh = obj as THREE.Mesh
          if (!mesh.isMesh || !mesh.geometry) return
          const pos = mesh.geometry.attributes.position
          if (!pos) return
          const step = Math.max(1, Math.floor(pos.count / 1500))
          for (let i = 0; i < pos.count; i += step) {
            v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
            rollPts.push({ x: v.x, y: v.y })
            sumRX += v.x
            sumRY += v.y
          }
        })
        if (rollPts.length > 10) {
          const mx = sumRX / rollPts.length
          const my = sumRY / rollPts.length
          let cxx = 0
          let cxy = 0
          for (const p of rollPts) {
            const dx = p.x - mx
            const dy = p.y - my
            cxx += dx * dx
            cxy += dx * dy
          }
          if (cxx > 0.0001) {
            const rollAngle = Math.atan2(cxy, cxx)
            rollPivot.rotation.z = -rollAngle
          }
        }

        const scaledBox = new THREE.Box3().setFromObject(rollPivot)
        const center = new THREE.Vector3()
        scaledBox.getCenter(center)
        rollPivot.position.set(-center.x, -scaledBox.min.y - 0.04, -center.z)

        let customFan: THREE.Object3D | undefined
        model.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            obj.castShadow = true
            obj.receiveShadow = true
          }
          if (obj.name.toLowerCase().includes('fan') || obj.name.toLowerCase().includes('prop')) {
            customFan = obj
          }
        })

        // Replace procedural fallback children with the custom Blender boat
        while (playerCraft.children.length > 0) {
          const child = playerCraft.children[0]
          playerCraft.remove(child)
        }
        playerCraft.add(rollPivot)
        playerCraft.userData.fan = customFan
        playerCraft.userData.exhaustMat = undefined
      },
      undefined,
      () => {
        // Keep procedural fallback hovercraft if model fails to load
      },
    )

    // Rival hovercraft racing alongside you!
    const rivalCraft = createHovercraft(matHullRival)
    rivalCraft.position.set(5.2, 0.05, -6)
    scene.add(rivalCraft)

    // Water Ramps
    function createWaterRamp() {
      const g = new THREE.Group()
      const shape = new THREE.Shape()
      shape.moveTo(-1.4, 0)
      shape.lineTo(1.4, 0)
      shape.lineTo(1.4, 0.95)
      shape.closePath()

      const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.3, bevelEnabled: false })
      geo.rotateY(Math.PI / 2)
      geo.translate(-1.15, 0, 0)
      const mesh = new THREE.Mesh(geo, matRamp)
      mesh.castShadow = true
      mesh.receiveShadow = true
      g.add(mesh)

      g.userData = { type: 'ramp', radius: 1.25 }
      return g
    }

    // Scrolling Water Canal & Stadium Grandstand Chunks
    const TRACK_WIDTH = 28
    const CHUNK_LEN = 30
    const NUM_CHUNKS = 5
    const chunks: THREE.Group[] = []

    // Seamless procedural wave normal map for realistic Water shader (zero external assets)
    const nSize = 256
    const nData = new Uint8Array(nSize * nSize * 4)
    const heightAt = (u: number, v: number) => {
      const a = Math.PI * 2
      return (
        Math.sin(u * a * 3 + v * a * 2) * 0.3 +
        Math.cos(u * a * 5 - v * a * 4) * 0.22 +
        Math.sin(u * a * 8 + v * a * 7) * 0.12
      )
    }
    const eps = 1 / nSize
    for (let y = 0; y < nSize; y++) {
      for (let x = 0; x < nSize; x++) {
        const u = x / nSize
        const v = y / nSize
        const dx = (heightAt(u + eps, v) - heightAt(u - eps, v)) * 1.1
        const dy = (heightAt(u, v + eps) - heightAt(u, v - eps)) * 1.1
        const len = Math.hypot(dx, dy, 1)
        const idx = (y * nSize + x) * 4
        nData[idx] = Math.round(((-dx / len) * 0.5 + 0.5) * 255)
        nData[idx + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255)
        nData[idx + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255)
        nData[idx + 3] = 255
      }
    }
    const waterNormals = new THREE.DataTexture(nData, nSize, nSize, THREE.RGBAFormat)
    waterNormals.wrapS = THREE.RepeatWrapping
    waterNormals.wrapT = THREE.RepeatWrapping
    waterNormals.magFilter = THREE.LinearFilter
    waterNormals.minFilter = THREE.LinearMipmapLinearFilter
    waterNormals.generateMipmaps = true
    waterNormals.needsUpdate = true

    const waterGeo = new THREE.PlaneGeometry(TRACK_WIDTH, 180)
    const waterSurface = new Water(waterGeo, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: new THREE.Vector3(-0.45, 0.35, -0.82).normalize(),
      sunColor: 0xfde68a,
      waterColor: 0x064e63,
      distortionScale: 1.4,
      fog: true,
    })
    waterSurface.rotation.x = -Math.PI / 2
    waterSurface.position.set(0, 0, -55)
    scene.add(waterSurface)

    const matNeonArch = new THREE.MeshBasicMaterial({ color: 0xfde047 })
    const matTowerGlass = new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      roughness: 0.2,
      metalness: 0.65,
      flatShading: true,
    })
    const matTowerAccent = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.65,
      metalness: 0.35,
    })
    const matBoardwalk = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
    const matPalmTrunk = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9, flatShading: true })
    const matPalmLeaf = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.7, flatShading: true })
    const matLampGlow = new THREE.MeshBasicMaterial({ color: 0xfef9c3 })
    const ferrisWheels: THREE.Group[] = []

    function createCanalChunk(zCenter: number, chunkIdx: number) {
      const group = new THREE.Group()
      group.position.z = zCenter
      const zone = chunkIdx % 4

      if (zone === 0 || zone === 3) {
        const archLeft = new THREE.Mesh(new THREE.BoxGeometry(0.65, 10.5, 0.65), matSkirt)
        archLeft.position.set(-(TRACK_WIDTH / 2 + 0.7), 5.2, 0)
        const archRight = new THREE.Mesh(new THREE.BoxGeometry(0.65, 10.5, 0.65), matSkirt)
        archRight.position.set(TRACK_WIDTH / 2 + 0.7, 5.2, 0)
        const archSpan = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH + 2.1, 0.7, 0.7), matSkirt)
        archSpan.position.set(0, 10.3, 0)
        const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH + 0.8, 0.24, 0.76), matNeonArch)
        neonStrip.position.set(0, 9.95, 0)
        group.add(archLeft, archRight, archSpan, neonStrip)
      }

      // Base canal retaining walls & sponsor banners
      ;[-1, 1].forEach((side) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, CHUNK_LEN), matConcrete)
        wall.position.set(side * (TRACK_WIDTH / 2 + 0.9), 0.9, 0)
        wall.receiveShadow = true
        group.add(wall)

        const banner = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, CHUNK_LEN), matBanner)
        banner.position.set(side * (TRACK_WIDTH / 2 - 0.02), 1.25, 0)
        group.add(banner)

        if (zone === 0) {
          // Zone 0: Stadium Grandstand Bleachers + Roof + Floodlight
          const stand = new THREE.Mesh(new THREE.BoxGeometry(6.4, 5.8, CHUNK_LEN - 2), matCrowd)
          stand.position.set(side * (TRACK_WIDTH / 2 + 5.2), 2.9, 0)
          stand.rotation.z = side * 0.3
          group.add(stand)

          if (side === -1) {
            const roof = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.55, CHUNK_LEN - 2), matConcrete)
            roof.position.set(side * (TRACK_WIDTH / 2 + 4.8), 8.5, 0)
            roof.rotation.z = -0.15
            const lightBar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.7, 9), matLampGlow)
            lightBar.position.set(side * (TRACK_WIDTH / 2 + 1.8), 8.0, 0)
            const gantry = new THREE.Mesh(new THREE.BoxGeometry(0.45, 4.8, 0.45), matGantry)
            gantry.position.set(side * (TRACK_WIDTH / 2 + 0.5), 3.4, -6)
            group.add(roof, lightBar, gantry)
          }
        } else if (zone === 1) {
          // Zone 1: Waterfront Glass Skyscrapers & Neon Penthouses
          const towerH = side === -1 ? 19 : 15
          const tower = new THREE.Mesh(new THREE.BoxGeometry(7.2, towerH, CHUNK_LEN - 2.6), matTowerGlass)
          tower.position.set(side * (TRACK_WIDTH / 2 + 6.2), towerH / 2 + 0.5, 0)
          const topCrown = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.8, CHUNK_LEN - 5), matTowerAccent)
          topCrown.position.set(side * (TRACK_WIDTH / 2 + 6.2), towerH + 1.8, 0)
          const neonBand = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.35, CHUNK_LEN - 2.4), matNeonArch)
          neonBand.position.set(side * (TRACK_WIDTH / 2 + 6.2), towerH - 0.8, 0)
          const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.25, 5.5, 6), matTowerAccent)
          spire.position.set(side * (TRACK_WIDTH / 2 + 6.2), towerH + 5.8, 0)
          group.add(tower, topCrown, neonBand, spire)
        } else if (zone === 2) {
          // Zone 2: Open Harbor Palm Promenade & Glowing Street Lamps
          const deck = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.6, CHUNK_LEN), matBoardwalk)
          deck.position.set(side * (TRACK_WIDTH / 2 + 5.2), 1.8, 0)
          group.add(deck)

          ;[-4, 4].forEach((pz) => {
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 5.6, 6), matPalmTrunk)
            trunk.position.set(side * (TRACK_WIDTH / 2 + 4.4), 4.6, pz)
            trunk.rotation.z = -side * 0.14
            const crown = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.4, 6), matPalmLeaf)
            crown.position.set(side * (TRACK_WIDTH / 2 + 4.8), 7.4, pz)
            const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6), matTowerAccent)
            lampPost.position.set(side * (TRACK_WIDTH / 2 + 2.4), 3.9, -pz)
            const lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), matLampGlow)
            lampHead.position.set(side * (TRACK_WIDTH / 2 + 2.4), 6.1, -pz)
            group.add(trunk, crown, lampPost, lampHead)
          })
        } else {
          // Zone 3: Harbor Ferris Wheel (left) + Digital Pavilion & Media Tower (right)
          if (side === -1) {
            const supportL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9.5, 0.5), matTowerAccent)
            supportL.position.set(side * (TRACK_WIDTH / 2 + 6.2), 5.2, -1.6)
            supportL.rotation.x = 0.22
            const supportR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9.5, 0.5), matTowerAccent)
            supportR.position.set(side * (TRACK_WIDTH / 2 + 6.2), 5.2, 1.6)
            supportR.rotation.x = -0.22

            const wheel = new THREE.Group()
            wheel.position.set(side * (TRACK_WIDTH / 2 + 6.2), 9.2, 0)
            const rim = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.22, 8, 20), matNeonArch)
            rim.rotation.y = Math.PI / 2
            wheel.add(rim)
            for (let g = 0; g < 8; g++) {
              const ang = (g / 8) * Math.PI * 2
              const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.12, 10.4, 0.12), matTowerAccent)
              spoke.rotation.x = ang
              const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), matLampGlow)
              cabin.position.set(0, Math.cos(ang) * 5.2, Math.sin(ang) * 5.2)
              wheel.add(spoke, cabin)
            }
            ferrisWheels.push(wheel)
            group.add(supportL, supportR, wheel)
          } else {
            const pavilion = new THREE.Mesh(new THREE.BoxGeometry(6.8, 4.5, CHUNK_LEN - 2.5), matTowerAccent)
            pavilion.position.set(side * (TRACK_WIDTH / 2 + 5.8), 3.6, 0)
            const mediaScreen = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.8, CHUNK_LEN - 4), matNeonArch)
            mediaScreen.position.set(side * (TRACK_WIDTH / 2 + 2.4), 7.8, 0)
            group.add(pavilion, mediaScreen)
          }
        }
      })

      return group
    }

    for (let i = 0; i < NUM_CHUNKS; i++) {
      const chunk = createCanalChunk(10 - i * CHUNK_LEN, i)
      chunks.push(chunk)
      scene.add(chunk)
    }

    // Distant Sunset Skyline (Real-looking glass skyscrapers, floodlight mast & steel bridge)
    const backdropGroup = new THREE.Group()
    scene.add(backdropGroup)

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(9, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, fog: false }),
    )
    sun.position.set(-55, 32, -185)
    backdropGroup.add(sun)

    // Procedural glass-curtain-wall skyscraper facade texture
    const bldgCanvas = document.createElement('canvas')
    bldgCanvas.width = 256
    bldgCanvas.height = 512
    const bldgCtx = bldgCanvas.getContext('2d')
    if (bldgCtx) {
      const facadeGrad = bldgCtx.createLinearGradient(0, 0, 256, 512)
      facadeGrad.addColorStop(0, '#334155')
      facadeGrad.addColorStop(0.5, '#1e293b')
      facadeGrad.addColorStop(1, '#0f172a')
      bldgCtx.fillStyle = facadeGrad
      bldgCtx.fillRect(0, 0, 256, 512)

      for (let y = 10; y < 502; y += 16) {
        bldgCtx.fillStyle = '#475569'
        bldgCtx.fillRect(0, y + 11, 256, 4)

        for (let x = 8; x < 248; x += 18) {
          const seed = (y * 13 + x * 7) % 19
          if (seed < 4) {
            bldgCtx.fillStyle = '#fde68a'
          } else if (seed < 8) {
            bldgCtx.fillStyle = '#fdba74'
          } else if (seed < 14) {
            bldgCtx.fillStyle = '#38bdf8'
          } else {
            bldgCtx.fillStyle = '#1e3a5f'
          }
          bldgCtx.fillRect(x, y, 13, 10)
        }
      }
    }
    const buildingTex = new THREE.CanvasTexture(bldgCanvas)
    buildingTex.colorSpace = THREE.SRGBColorSpace
    buildingTex.wrapS = THREE.RepeatWrapping
    buildingTex.wrapT = THREE.RepeatWrapping

    const matBuilding = new THREE.MeshStandardMaterial({
      map: buildingTex,
      roughness: 0.35,
      metalness: 0.45,
      fog: false,
    })
    const matRoofTrim = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.7,
      metalness: 0.3,
      fog: false,
    })

    const skyscrapers = [
      { x: -78, z: -158, w: 20, h: 46, d: 18 },
      { x: -50, z: -146, w: 18, h: 64, d: 16 },
      { x: -26, z: -162, w: 22, h: 52, d: 18 },
      { x: 24, z: -166, w: 24, h: 48, d: 18 },
      { x: 54, z: -150, w: 19, h: 68, d: 18 },
      { x: 82, z: -160, w: 22, h: 44, d: 18 },
    ]
    const proceduralSkyline = new THREE.Group()
    backdropGroup.add(proceduralSkyline)

    skyscrapers.forEach((b, idx) => {
      const tower = new THREE.Group()
      const mainBody = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), matBuilding)
      mainBody.position.y = b.h / 2
      tower.add(mainBody)

      const crown = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.72, b.h * 0.14, b.d * 0.72), matRoofTrim)
      crown.position.y = b.h + (b.h * 0.14) / 2
      tower.add(crown)

      const roofBeacon = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.74, 0.8, b.d * 0.74), matNeonArch)
      roofBeacon.position.y = b.h + 0.4
      tower.add(roofBeacon)

      if (idx % 2 === 1) {
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 14, 6), matRoofTrim)
        spire.position.y = b.h + b.h * 0.14 + 7
        tower.add(spire)
      }

      tower.position.set(b.x, -4, b.z)
      proceduralSkyline.add(tower)
    })

    // Load Downtown Toronto Yonge-Dundas Square backdrop (/models/downtown_toronto_yonge_and_dundas.glb)
    gltfLoader.load(
      '/models/downtown_toronto_yonge_and_dundas.glb',
      (gltf) => {
        if (disposed) return
        const city = gltf.scene

        const box = new THREE.Box3().setFromObject(city)
        const size = new THREE.Vector3()
        box.getSize(size)
        const maxSpan = Math.max(size.x, size.z, 0.001)
        const scaleFactor = 200 / maxSpan
        city.scale.multiplyScalar(scaleFactor)

        // Orient wider side facing the player camera
        if (size.z > size.x * 1.1) {
          city.rotation.y = Math.PI / 2
        }

        const scaledBox = new THREE.Box3().setFromObject(city)
        const center = new THREE.Vector3()
        scaledBox.getCenter(center)
        city.position.set(-center.x, -scaledBox.min.y - 3, -155 - center.z)

        city.traverse((obj) => {
          const mesh = obj as THREE.Mesh
          if (!mesh.isMesh) return
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const m of mats) {
            if (m && 'fog' in m) {
              ;(m as THREE.MeshStandardMaterial).fog = false
            }
          }
        })

        proceduralSkyline.visible = false
        backdropGroup.add(city)
      },
      undefined,
      () => {
        // Keep procedural skyline if backdrop model is unavailable
      },
    )

    // Iconic Skyline Needle Observation Tower (CN-Tower inspired silhouette)
    const needleTower = new THREE.Group()
    const needleShaft = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 3.2, 72, 8), matRoofTrim)
    needleShaft.position.y = 34
    const needlePod = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 5.2, 4.5, 12), matTowerGlass)
    needlePod.position.y = 56
    const needleRing = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.45, 8, 24), matNeonArch)
    needleRing.rotation.x = Math.PI / 2
    needleRing.position.y = 56
    const needleSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.8, 22, 6), matRoofTrim)
    needleSpire.position.y = 78
    needleTower.add(needleShaft, needlePod, needleRing, needleSpire)
    needleTower.position.set(4, -4, -172)
    backdropGroup.add(needleTower)

    const floodMast = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 56, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8, fog: false }),
    )
    floodMast.position.set(-34, 28, -135)
    backdropGroup.add(floodMast)

    const floodHead = new THREE.Mesh(
      new THREE.BoxGeometry(10, 5, 1.6),
      new THREE.MeshBasicMaterial({ color: 0xfef9c3, fog: false }),
    )
    floodHead.position.set(-34, 54, -135)
    backdropGroup.add(floodHead)

    const matBridgeSteel = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.6,
      metalness: 0.4,
      fog: false,
    })
    const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(240, 2.4, 5), matBridgeSteel)
    bridgeDeck.position.set(10, 20, -138)
    bridgeDeck.rotation.z = 0.03
    backdropGroup.add(bridgeDeck)

    ;[32, -40].forEach((px) => {
      const pylonL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 42, 2.4), matBridgeSteel)
      pylonL.position.set(px - 3, 21, -138)
      const pylonR = new THREE.Mesh(new THREE.BoxGeometry(2.4, 42, 2.4), matBridgeSteel)
      pylonR.position.set(px + 3, 21, -138)
      const cross = new THREE.Mesh(new THREE.BoxGeometry(8.5, 2.2, 2.6), matBridgeSteel)
      cross.position.set(px, 34, -138)
      backdropGroup.add(pylonL, pylonR, cross)
    })

    // Cruising LinguaDesk Sky Blimp & sweeping stadium searchlights
    const blimpGroup = new THREE.Group()
    const blimpBody = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.25, fog: false }),
    )
    blimpBody.scale.set(2.4, 0.9, 0.9)
    const blimpStripe = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 0.7, 3.8),
      matNeonArch,
    )
    blimpGroup.add(blimpBody, blimpStripe)
    blimpGroup.position.set(-28, 44, -125)
    backdropGroup.add(blimpGroup)

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      fog: false,
    })
    const beamGeo = new THREE.ConeGeometry(11, 85, 12, 1, true)
    const beamLeft = new THREE.Mesh(beamGeo, beamMat)
    beamLeft.position.set(-28, 38, -128)
    beamLeft.rotation.z = -0.35
    const beamRight = new THREE.Mesh(beamGeo, beamMat)
    beamRight.position.set(30, 38, -132)
    beamRight.rotation.z = 0.35
    backdropGroup.add(beamLeft, beamRight)

    const BIOMES = [
      {
        labelEn: 'GOLDEN HARBOR',
        labelZh: '🌅 黄金日落港湾',
        top: new THREE.Color(0x0369a1),
        mid: new THREE.Color(0x0ea5e9),
        horizon: new THREE.Color(0xfde68a),
        sun: new THREE.Color(0xfef08a),
        fog: new THREE.Color(0xfde68a),
        water: new THREE.Color(0x064e63),
        hemiSky: new THREE.Color(0xfef3c7),
        hemiGround: new THREE.Color(0x0e7490),
        dir: new THREE.Color(0xffedd5),
        neon: new THREE.Color(0xfde047),
        sunY: 32,
        bloom: 0.14,
      },
      {
        labelEn: 'CRIMSON DUSK',
        labelZh: '🌆 玫瑰暮色海湾',
        top: new THREE.Color(0x312e81),
        mid: new THREE.Color(0x7c3aed),
        horizon: new THREE.Color(0xfb7185),
        sun: new THREE.Color(0xfdba74),
        fog: new THREE.Color(0xfda4af),
        water: new THREE.Color(0x1e1b4b),
        hemiSky: new THREE.Color(0xfecdd3),
        hemiGround: new THREE.Color(0x4c1d95),
        dir: new THREE.Color(0xfda4af),
        neon: new THREE.Color(0xf472b6),
        sunY: 22,
        bloom: 0.2,
      },
      {
        labelEn: 'NEON NIGHT',
        labelZh: '🌃 霓虹夜航都市',
        top: new THREE.Color(0x020617),
        mid: new THREE.Color(0x0f172a),
        horizon: new THREE.Color(0x1e1b4b),
        sun: new THREE.Color(0x38bdf8),
        fog: new THREE.Color(0x0f172a),
        water: new THREE.Color(0x082f49),
        hemiSky: new THREE.Color(0x38bdf8),
        hemiGround: new THREE.Color(0x312e81),
        dir: new THREE.Color(0x93c5fd),
        neon: new THREE.Color(0x22d3ee),
        sunY: 42,
        bloom: 0.28,
      },
      {
        labelEn: 'AURORA DAWN',
        labelZh: '🌌 极光晨曦峡湾',
        top: new THREE.Color(0x0c4a6e),
        mid: new THREE.Color(0x0284c7),
        horizon: new THREE.Color(0x6ee7b7),
        sun: new THREE.Color(0xa7f3d0),
        fog: new THREE.Color(0xa7f3d0),
        water: new THREE.Color(0x064e3b),
        hemiSky: new THREE.Color(0xd1fae5),
        hemiGround: new THREE.Color(0x0f766e),
        dir: new THREE.Color(0xecfdf5),
        neon: new THREE.Color(0x34d399),
        sunY: 28,
        bloom: 0.18,
      },
    ]

    // Water spray wake particles
    const sprayParticles: THREE.Mesh[] = []
    const sprayGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22)
    const sprayMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.8 })

    function emitWake(craft: THREE.Group) {
      ;[-0.68, 0.68].forEach((offsetX) => {
        if (Math.random() > 0.72) return
        const p = new THREE.Mesh(sprayGeo, sprayMat)
        p.position.set(craft.position.x + offsetX, 0.25, craft.position.z + 1.65)
        p.userData = {
          vx: (Math.random() - 0.5) * 2.8 + offsetX * 1.4,
          vy: 1.8 + Math.random() * 2.2,
          vz: 5 + Math.random() * 2.5,
          life: 0.48,
        }
        scene.add(p)
        sprayParticles.push(p)
      })
    }

    const burstColors = [0x38bdf8, 0xfacc15, 0x34d399, 0xf472b6]
    const burstGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2)
    function emitBurst(x: number, y: number, z: number, count = 14) {
      for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: burstColors[i % burstColors.length] })
        const p = new THREE.Mesh(burstGeo, mat)
        p.position.set(x, y, z)
        p.userData = {
          vx: (Math.random() - 0.5) * 9,
          vy: 2.5 + Math.random() * 5.5,
          vz: (Math.random() - 0.5) * 6,
          life: 0.65,
          disposeMat: true,
        }
        scene.add(p)
        sprayParticles.push(p)
      }
    }

    // Game state
    let state: GamePhase = 'start'
    let entities: THREE.Group[] = []
    let speed = 23
    let distance = 0
    let raceTime = 0
    let currentGear = 1
    let rpm = 0.2
    let boostTimer = 0
    let completedWordsCount = 0
    let currentStage = 1
    let bonusScore = 0
    let currentStreak = 0
    let lastReportedScore = -1
    let craftX = 0
    let craftY = 0
    let craftVelY = 0
    let isGrounded = true
    let spawnTimer = 0
    let rowCounter = 0
    let wordCursor = 0
    let activeChallenge: WordChallenge | null = null
    let feedbackTimer = 0
    let spinTimer = 0
    let shakeTimer = 0
    let calloutTimer = 0
    let countdownTimer = 0
    let lastCountdownBeep = 0
    let hudTick = 0

    // Rival AI racer state
    let rivalX = 5.2
    let rivalZ = -7
    let rivalY = 0
    let rivalVelY = 0
    let rivalGrounded = true
    let rivalSpinTimer = 0
    let rivalSpeed = 23
    let rivalDistance = 0
    let rivalBonusScore = 0
    let rivalWordsCount = 0
    let rivalLetterHits = 0
    let rivalBoostTimer = 0
    let lastReportedRivalScore = -1

    const LANE_LIMIT = TRACK_WIDTH / 2 - 2.3
    const keys = { left: false, right: false }

    function showCallout(text: string, tone: 'sky' | 'amber' | 'emerald' | 'rose') {
      setCallout({ text, tone })
      calloutTimer = 0.95
    }

    function clearEntities() {
      for (const e of entities) scene.remove(e)
      entities = []
    }

    function nextVocabCard(): EnglishCard {
      const pool = cardsRef.current
      const reviewPool = pool.filter((c) => c.inReview && c.word && c.meaning)
      const list = reviewPool.length >= 3 ? reviewPool : pool
      const card = list[wordCursor % list.length]
      wordCursor += 1
      return card
    }

    function spawnLetterGateRow(zPos: number) {
      if (!activeChallenge) return
      const cfg = DIFFICULTY_CONFIG[difficultyRef.current]
      const remainingIndices = activeChallenge.missingIndices.filter(
        (idx) => !activeChallenge!.filledIndices.includes(idx),
      )
      if (remainingIndices.length === 0) return

      const remainingChars = new Set(remainingIndices.map((idx) => activeChallenge!.letters[idx]))
      const pickIdx = remainingIndices[Math.floor(Math.random() * remainingIndices.length)]
      const targetChar = activeChallenge.letters[pickIdx] ?? 'a'
      const decoys = randomDecoyLetters(targetChar, 2).filter((d) => !remainingChars.has(d))
      while (decoys.length < 2) {
        const extra = randomDecoyLetters(targetChar, 1)[0]
        if (!remainingChars.has(extra) && !decoys.includes(extra)) decoys.push(extra)
      }
      const choices = [targetChar, ...decoys].sort(() => Math.random() - 0.5)
      const laneXs = [-6.5, 0, 6.5]

      choices.forEach((ch, idx) => {
        const isMatch = remainingChars.has(ch)
        const cube = createLetterCube(ch, cfg.highlightHint && isMatch)
        cube.position.x = laneXs[idx]
        cube.position.z = zPos
        scene.add(cube)
        entities.push(cube)
      })
    }

    function spawnRow(zPos: number, allowLetterGate = true) {
      rowCounter += 1
      if (allowLetterGate && activeChallenge && rowCounter % 3 === 0) {
        spawnLetterGateRow(zPos)
        return
      }

      if (Math.random() < 0.65) {
        const obj = createWaterRamp()
        obj.position.x = (Math.random() - 0.5) * (LANE_LIMIT * 1.6)
        obj.position.z = zPos + (Math.random() - 0.5) * 3
        scene.add(obj)
        entities.push(obj)
      }
    }

    function populateInitialProps() {
      clearEntities()
      rowCounter = 0
      for (let z = -22; z >= -105; z -= 11) {
        spawnRow(z, false)
      }
    }

    function startNewChallenge(speakTarget = false) {
      const card = nextVocabCard()
      activeChallenge = buildWordChallenge(card)
      setChallenge({ ...activeChallenge })
      if (speakTarget && !mutedRef.current) {
        void speakWord(card.word, { allowAI: false })
      }
    }

    function triggerGearUp() {
      if (state !== 'playing') return
      const inGreenZone = rpm >= 0.62 && rpm <= 0.88
      if (currentGear < 5) {
        currentGear += 1
        setGear(currentGear)
      }
      if (inGreenZone) {
        boostTimer = 1.6
        bonusScore += 20
        rpm = 0.35
        emitBurst(playerCraft.position.x, 0.8, playerCraft.position.z + 1.2, 16)
        showCallout(zh ? '完美换挡 TURBO +20!' : 'PERFECT SHIFT +20!', 'emerald')
        sfx.playGearUp(true)
      } else {
        rpm = Math.max(0.2, rpm - 0.25)
        showCallout(zh ? `换挡 GEAR ${currentGear}` : `GEAR ${currentGear}`, 'sky')
        sfx.playGearUp(false)
      }
    }

    function startGame() {
      sfx.ensure()
      const cfg = DIFFICULTY_CONFIG[difficultyRef.current]
      speed = cfg.startSpeed
      distance = 0
      raceTime = 0
      currentGear = 1
      rpm = 0.25
      boostTimer = 0
      completedWordsCount = 0
      currentStage = 1
      bonusScore = 0
      currentStreak = 0
      lastReportedScore = 0
      setStage(1)
      brakeRef.current = false
      gasRef.current = false
      setIsBraking(false)
      craftX = 0
      craftY = 0
      craftVelY = 0
      isGrounded = true
      rivalX = 5.2
      rivalZ = -7
      rivalY = 0
      rivalVelY = 0
      rivalGrounded = true
      rivalSpinTimer = 0
      rivalSpeed = cfg.startSpeed
      rivalDistance = 0
      rivalBonusScore = 0
      rivalWordsCount = 0
      rivalLetterHits = 0
      rivalBoostTimer = 0
      lastReportedRivalScore = 0
      spawnTimer = 0
      spinTimer = 0
      shakeTimer = 0
      calloutTimer = 0
      playerCraft.visible = true
      playerCraft.position.set(0, 0, 0)
      playerCraft.rotation.set(0, 0, 0)
      rivalCraft.position.set(5.2, 0.05, -7)
      rivalCraft.rotation.set(0, 0, 0)
      camera.fov = 60
      camera.updateProjectionMatrix()
      setScore(0)
      setWordsDone(0)
      setRivalScore(0)
      setRivalWordsDone(0)
      setStreak(0)
      setGear(1)
      setPosRank(1)
      setIsTurbo(false)
      setMph(Math.round(cfg.startSpeed * 2.8))
      setElapsedSec(0)
      setCallout(null)
      setLearnedWords([])
      setChallengeFeedback('none')
      startNewChallenge(false)
      populateInitialProps()
      countdownTimer = 2.1
      lastCountdownBeep = 4
      setCountdownLabel('3')
      state = 'countdown'
      setPhase('countdown')
    }

    function finalizeGameOver() {
      state = 'gameover'
      sfx.stopEngine()
      playerCraft.visible = true
      const total = Math.floor(distance) + bonusScore
      setScore(total)
      setBestScore((prev) => {
        const next = Math.max(prev, total)
        try {
          localStorage.setItem(BEST_KEY, String(next))
        } catch {
          // ignore storage errors
        }
        return next
      })
      setPhase('gameover')
    }

    function triggerCollision() {
      sfx.playCrash()
      shakeTimer = 0.35
      finalizeGameOver()
    }

    function togglePause() {
      if (state === 'playing') {
        keys.left = false
        keys.right = false
        gasRef.current = false
        brakeRef.current = false
        setIsBraking(false)
        state = 'paused'
        setPhase('paused')
      } else if (state === 'paused') {
        state = 'playing'
        setPhase('playing')
      }
    }

    startGameRef.current = startGame
    togglePauseRef.current = togglePause
    gearUpRef.current = triggerGearUp

    function jump(power = 11.5) {
      if (state !== 'playing' || !isGrounded) return
      craftVelY = power
      isGrounded = false
      sfx.playJump()
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (state === 'playing' || state === 'paused') {
          e.preventDefault()
          togglePause()
        }
        return
      }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true
      if (e.code === 'ArrowUp' || e.code === 'KeyW') gasRef.current = true
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault()
        brakeRef.current = true
      }
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE' || e.code === 'KeyG') && !e.repeat) {
        e.preventDefault()
        triggerGearUp()
      }
      if (e.code === 'Space') {
        e.preventDefault()
        if (state === 'start' || state === 'gameover') startGame()
        else if (state === 'playing') jump()
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false
      if (e.code === 'ArrowUp' || e.code === 'KeyW') gasRef.current = false
      if (e.code === 'ArrowDown' || e.code === 'KeyS') brakeRef.current = false
    }

    let pointerActive = false
    let lastPointerX = 0
    let pointerStartY = 0

    function onPointerDown(e: PointerEvent) {
      if (state !== 'playing') return
      pointerActive = true
      lastPointerX = e.clientX
      pointerStartY = e.clientY
    }

    function onPointerMove(e: PointerEvent) {
      if (!pointerActive || state !== 'playing') return
      const dx = e.clientX - lastPointerX
      lastPointerX = e.clientX
      craftX = THREE.MathUtils.clamp(craftX + dx * 0.045, -LANE_LIMIT, LANE_LIMIT)
      if (pointerStartY - e.clientY > 45) {
        jump()
        pointerStartY = e.clientY
      }
    }

    function onPointerUp() {
      pointerActive = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const w = Math.max(entry.contentRect.width, 320)
      const h = Math.max(entry.contentRect.height, 320)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
      composer.setSize(w, h)
      bloomPass.resolution.set(w, h)
    })
    resizeObserver.observe(container)

    populateInitialProps()

    const clock = new THREE.Clock()
    let rafId = 0

    const animate = () => {
      rafId = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05)
      const moveSpeed = state === 'playing' ? speed : state === 'start' ? 12 : 0

      // Spin turbine fans
      const playerFan = playerCraft.userData.fan as THREE.Group | undefined
      const rivalFan = rivalCraft.userData.fan as THREE.Group | undefined
      if (state !== 'paused') {
        if (playerFan) playerFan.rotation.z += dt * (8 + moveSpeed * 0.6)
        if (rivalFan) rivalFan.rotation.z += dt * (8 + moveSpeed * 0.6)
      }

      if (feedbackTimer > 0) {
        feedbackTimer -= dt
        if (feedbackTimer <= 0) setChallengeFeedback('none')
      }
      if (calloutTimer > 0) {
        calloutTimer -= dt
        if (calloutTimer <= 0) setCallout(null)
      }
      if (shakeTimer > 0) {
        shakeTimer = Math.max(0, shakeTimer - dt)
        camera.position.x += (Math.random() - 0.5) * 0.65
        camera.position.y += (Math.random() - 0.5) * 0.45
      }

      for (const chunk of chunks) {
        chunk.position.z += moveSpeed * dt
        if (chunk.position.z > 25) {
          chunk.position.z -= NUM_CHUNKS * CHUNK_LEN
        }
      }
      if (state !== 'paused') {
        for (const wheel of ferrisWheels) {
          wheel.rotation.x += dt * 0.45
        }
      }

      for (let i = sprayParticles.length - 1; i >= 0; i--) {
        const p = sprayParticles[i]
        p.userData.life -= dt
        p.position.x += p.userData.vx * dt
        p.position.y += p.userData.vy * dt
        p.position.z += p.userData.vz * dt
        p.userData.vy -= 6 * dt
        p.scale.setScalar(Math.max(0.01, p.userData.life * 2))
        if (p.userData.life <= 0) {
          scene.remove(p)
          if (p.userData.disposeMat) (p.material as THREE.Material).dispose()
          sprayParticles.splice(i, 1)
        }
      }

      if (state === 'start') {
        const t = clock.elapsedTime
        playerCraft.position.x = Math.sin(t * 1.1) * 2.2 - 1.5
        playerCraft.rotation.z = -Math.cos(t * 1.1) * 0.12
        rivalCraft.position.x = Math.sin(t * 0.9 + 1.4) * 2.2 + 3.2
        rivalCraft.position.z = -7 + Math.sin(t * 0.7) * 2.5
        emitWake(playerCraft)
        emitWake(rivalCraft)
        for (const e of entities) {
          e.position.z += moveSpeed * dt
          if (e.position.z > 14) e.position.z -= 110
        }
      }

      if (state === 'countdown') {
        countdownTimer -= dt
        const step = Math.ceil(countdownTimer / 0.7)
        if (step !== lastCountdownBeep && step >= 1 && step <= 3) {
          lastCountdownBeep = step
          setCountdownLabel(String(step) as '3' | '2' | '1')
          sfx.playCountdown(false)
        }
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.12)
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 4.6, 0.12)
        camera.lookAt(0, 1.2, -12)
        emitWake(playerCraft)
        emitWake(rivalCraft)
        if (countdownTimer <= 0) {
          state = 'playing'
          setPhase('playing')
          sfx.playCountdown(true)
          showCallout('GO!', 'emerald')
        }
      }

      if (state === 'playing') {
        const cfg = DIFFICULTY_CONFIG[difficultyRef.current]
        raceTime += dt

        if (boostTimer > 0) boostTimer = Math.max(0, boostTimer - dt)
        const isBrakeActive = brakeRef.current
        const gasBonus = !isBrakeActive && gasRef.current ? 5.5 : 0
        const gearBonus = (currentGear - 1) * 2.2
        const stageSpeedBonus = (currentStage - 1) * 2.2
        const boostExtra = boostTimer > 0 ? 11 : 0
        const targetMax = cfg.maxSpeed + gasBonus + gearBonus + stageSpeedBonus + boostExtra
        const minCruiseSpeed = cfg.startSpeed * 0.62

        if (isBrakeActive) {
          boostTimer = 0
          speed = Math.max(minCruiseSpeed, speed - dt * 24)
          if (currentGear > 1 && speed < cfg.startSpeed + (currentGear - 1) * 2.2) {
            currentGear -= 1
            setGear(currentGear)
          }
        } else {
          speed = Math.min(targetMax, speed + dt * (cfg.accel + (gasRef.current ? 1.8 : 0)))
        }

        // Oscillating RPM needle so player can time GEAR UP
        rpm = isBrakeActive
          ? Math.max(0.12, rpm - dt * 0.45)
          : (rpm + dt * (0.28 + (gasRef.current ? 0.25 : 0))) % 1.0

        distance += speed * dt * 0.5 * cfg.scoreMult
        const currentScore = Math.floor(distance) + bonusScore
        if (currentScore !== lastReportedScore) {
          lastReportedScore = currentScore
          setScore(currentScore)
        }

        // Rival AI speed, distance & score progression
        if (rivalBoostTimer > 0) rivalBoostTimer = Math.max(0, rivalBoostTimer - dt)
        const rivalSkill = difficultyRef.current === 'hard' ? 1.06 : difficultyRef.current === 'easy' ? 0.91 : 0.99
        const rivalTargetMax = (cfg.maxSpeed + 3.2) * rivalSkill + (rivalBoostTimer > 0 ? 7.5 : 0)
        rivalSpeed = THREE.MathUtils.lerp(rivalSpeed, rivalTargetMax, dt * 1.4)
        rivalDistance += rivalSpeed * dt * 0.5 * cfg.scoreMult
        const currentRivalScore = Math.floor(rivalDistance) + rivalBonusScore
        if (currentRivalScore !== lastReportedRivalScore) {
          lastReportedRivalScore = currentRivalScore
          setRivalScore(currentRivalScore)
        }

        hudTick += dt
        if (hudTick >= 0.06) {
          hudTick = 0
          setMph(Math.round(speed * 2.8))
          setRpmNeedle(rpm)
          setElapsedSec(raceTime)
          setPosRank(playerCraft.position.z <= rivalCraft.position.z ? 1 : 2)
          setIsTurbo(boostTimer > 0)
          setIsBraking(isBrakeActive)
        }

        const steerInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
        craftX = THREE.MathUtils.clamp(craftX + steerInput * 17.5 * dt, -LANE_LIMIT, LANE_LIMIT)
        playerCraft.position.x = THREE.MathUtils.lerp(playerCraft.position.x, craftX, 0.25)
        playerCraft.rotation.z = THREE.MathUtils.lerp(playerCraft.rotation.z, -steerInput * 0.24, 0.18)

        // Rival AI steering: actively aims for target letter cubes & ramps ahead
        const t = clock.elapsedTime
        let desiredRivalX = Math.sin(t * 0.7) * 4.2 + (craftX > 0 ? -3.8 : 3.8)
        let bestTargetZ = -999
        for (const ent of entities) {
          if (ent.position.z < rivalZ - 1.5 && ent.position.z > rivalZ - 46) {
            const isGoal =
              (ent.userData.type === 'letter' && ent.userData.isTarget) ||
              ent.userData.type === 'ramp'
            if (isGoal && ent.position.z > bestTargetZ) {
              bestTargetZ = ent.position.z
              desiredRivalX = ent.position.x
            }
          }
        }
        desiredRivalX = THREE.MathUtils.clamp(desiredRivalX, -LANE_LIMIT, LANE_LIMIT)
        const rivalSteerDelta = THREE.MathUtils.clamp(desiredRivalX - rivalX, -1, 1)
        const rivalAgility = difficultyRef.current === 'hard' ? 12.5 : difficultyRef.current === 'easy' ? 7.5 : 10
        rivalX = THREE.MathUtils.clamp(rivalX + rivalSteerDelta * rivalAgility * dt, -LANE_LIMIT, LANE_LIMIT)
        rivalZ = THREE.MathUtils.clamp(rivalZ + (speed - rivalSpeed) * dt * 0.55, -24, 9)

        // Solid boat-to-boat collision resolution (prevents clipping/ghosting)
        const hullDx = craftX - rivalX
        const hullDz = playerCraft.position.z - rivalZ
        const hullDy = Math.abs(craftY - rivalY)
        const minGapX = 2.25
        const minGapZ = 3.45
        if (Math.abs(hullDx) < minGapX && Math.abs(hullDz) < minGapZ && hullDy < 1.35) {
          const overlapX = minGapX - Math.abs(hullDx)
          const overlapZ = minGapZ - Math.abs(hullDz)
          const midX = (craftX + rivalX) * 0.5
          const midZ = (playerCraft.position.z + rivalZ) * 0.5
          if (overlapX <= overlapZ) {
            const signX = hullDx >= 0 ? 1 : -1
            craftX = THREE.MathUtils.clamp(craftX + signX * overlapX * 0.58, -LANE_LIMIT, LANE_LIMIT)
            rivalX = THREE.MathUtils.clamp(rivalX - signX * overlapX * 0.58, -LANE_LIMIT, LANE_LIMIT)
          } else {
            const signZ = hullDz >= 0 ? 1 : -1
            rivalZ = THREE.MathUtils.clamp(rivalZ - signZ * overlapZ * 0.9, -24, 9)
            const avgSpd = (speed + rivalSpeed) * 0.5
            if (signZ > 0) {
              speed = Math.min(targetMax, avgSpd + 2.5)
              rivalSpeed = Math.max(cfg.startSpeed * 0.8, avgSpd - 2)
            } else {
              rivalSpeed = Math.min(rivalTargetMax, avgSpd + 2.5)
              speed = Math.max(minCruiseSpeed, avgSpd - 2)
            }
          }
          emitBurst(midX, 0.7, midZ, 8)
          shakeTimer = Math.max(shakeTimer, 0.12)
        }

        rivalCraft.position.x = THREE.MathUtils.lerp(rivalCraft.position.x, rivalX, 0.22)
        rivalCraft.position.z = THREE.MathUtils.lerp(rivalCraft.position.z, rivalZ, 0.2)
        rivalCraft.rotation.z = THREE.MathUtils.lerp(rivalCraft.rotation.z, -rivalSteerDelta * 0.22, 0.15)

        if (!rivalGrounded) {
          rivalVelY -= 28 * dt
          rivalY += rivalVelY * dt
          rivalCraft.rotation.x = THREE.MathUtils.clamp(rivalVelY * 0.035, -0.35, 0.45)
          if (rivalY <= 0) {
            rivalY = 0
            rivalVelY = 0
            rivalGrounded = true
            rivalCraft.rotation.x = 0
          }
        } else {
          rivalY = 0.06 + Math.sin(t * 7.5) * 0.05
          rivalCraft.rotation.x = THREE.MathUtils.lerp(rivalCraft.rotation.x, 0, 0.2)
          emitWake(rivalCraft)
        }
        rivalCraft.position.y = rivalY
        if (rivalSpinTimer > 0) {
          rivalSpinTimer = Math.max(0, rivalSpinTimer - dt)
          rivalCraft.rotation.y = (rivalSpinTimer / 0.6) * Math.PI * 2
        } else {
          rivalCraft.rotation.y = THREE.MathUtils.lerp(rivalCraft.rotation.y, 0, 0.22)
        }

        if (!isGrounded) {
          craftVelY -= 28 * dt
          craftY += craftVelY * dt
          playerCraft.rotation.x = THREE.MathUtils.clamp(craftVelY * 0.035, -0.35, 0.45)
          if (craftY <= 0) {
            craftY = 0
            craftVelY = 0
            isGrounded = true
            playerCraft.rotation.x = 0
          }
        } else {
          emitWake(playerCraft)
          playerCraft.rotation.x = THREE.MathUtils.lerp(playerCraft.rotation.x, 0, 0.2)
          craftY = Math.sin(t * 8) * 0.05
        }
        playerCraft.position.y = craftY

        if (spinTimer > 0) {
          spinTimer = Math.max(0, spinTimer - dt)
          playerCraft.rotation.y = (spinTimer / 0.65) * Math.PI * 2
        } else {
          playerCraft.rotation.y = THREE.MathUtils.lerp(playerCraft.rotation.y, 0, 0.25)
        }

        const exhaustMat = playerCraft.userData.exhaustMat as THREE.MeshBasicMaterial | undefined
        if (exhaustMat) {
          exhaustMat.color.setHex(boostTimer > 0 ? 0xa5f3fc : gasRef.current ? 0x38bdf8 : 0x0284c7)
        }
        sfx.updateEngine(true, speed, currentGear, boostTimer > 0)

        const targetFov = 60 + ((speed - 18) / 36) * 9 + (boostTimer > 0 ? 4 : 0)
        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.1)
          camera.updateProjectionMatrix()
        }
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, playerCraft.position.x * 0.55, 0.1)
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 4.6 + craftY * 0.5, 0.1)
        camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, -steerInput * 0.045, 0.1)
        camera.lookAt(playerCraft.position.x * 0.35, 1.2 + craftY * 0.4, -12)

        spawnTimer += speed * dt
        if (spawnTimer >= 11) {
          spawnTimer = 0
          spawnRow(-105, true)
        }

        for (let i = entities.length - 1; i >= 0; i--) {
          const e = entities[i]
          e.position.z += speed * dt
          if (e.userData.type === 'letter') {
            e.position.y = 1.05 + Math.sin(clock.elapsedTime * 3.5 + e.position.x) * 0.15
            e.rotation.y = Math.sin(clock.elapsedTime * 2.2 + e.position.x) * 0.22
            if (e.userData.isTarget) {
              const pulse = 1 + Math.sin(clock.elapsedTime * 6.5) * 0.09
              e.scale.setScalar(pulse)
            }
          }

          const dz = Math.abs(e.position.z - playerCraft.position.z)
          const dx = Math.abs(e.position.x - playerCraft.position.x)
          if (dz < 1.35 && dx < (e.userData.radius as number) + 0.65) {
            if (e.userData.type === 'letter' && activeChallenge) {
              const picked = String(e.userData.letter || '')
              const matchedIdx = activeChallenge.missingIndices.find(
                (idx) => !activeChallenge!.filledIndices.includes(idx) && activeChallenge!.letters[idx] === picked,
              )

              const gateZ = e.position.z
              for (let k = entities.length - 1; k >= 0; k--) {
                if (entities[k].userData.type === 'letter' && Math.abs(entities[k].position.z - gateZ) < 2) {
                  scene.remove(entities[k])
                  entities.splice(k, 1)
                }
              }

              if (matchedIdx !== undefined) {
                activeChallenge.filledIndices = [...activeChallenge.filledIndices, matchedIdx]
                currentStreak += 1
                setStreak(currentStreak)
                const mult = Math.min(4, currentStreak)
                const letterPts = 15 * mult
                bonusScore += letterPts
                emitBurst(e.position.x, e.position.y, e.position.z, 14)

                if (activeChallenge.filledIndices.length >= activeChallenge.missingIndices.length) {
                  const completedCard = activeChallenge.card
                  completedWordsCount += 1
                  const nextStage = Math.floor(completedWordsCount / 3) + 1
                  const wordPts = 30 * mult
                  bonusScore += wordPts
                  setWordsDone(completedWordsCount)
                  setLearnedWords((prev) =>
                    prev.some((w) => w.id === completedCard.id) ? prev : [completedCard, ...prev].slice(0, 12),
                  )
                  emitBurst(playerCraft.position.x, playerCraft.position.y + 1.2, playerCraft.position.z, 26)
                  if (nextStage > currentStage) {
                    currentStage = nextStage
                    bonusScore += 50
                    setStage(currentStage)
                    const stageBiome = BIOMES[(currentStage - 1) % BIOMES.length]
                    showCallout(
                      zh ? `STAGE ${currentStage} · ${stageBiome.labelZh} +50!` : `STAGE ${currentStage} · ${stageBiome.labelEn} +50!`,
                      'amber',
                    )
                  } else {
                    showCallout(
                      zh ? `单词完成 +${letterPts + wordPts}!` : `WORD +${letterPts + wordPts}!`,
                      'emerald',
                    )
                  }
                  sfx.playWordComplete()
                  setChallenge({ ...activeChallenge })
                  setChallengeFeedback('complete')
                  feedbackTimer = 0.85
                  if (!mutedRef.current) {
                    void speakWord(completedCard.word, { allowAI: false })
                  }
                  const completedId = completedCard.id
                  window.setTimeout(() => {
                    if (state === 'playing' && activeChallenge?.card.id === completedId) {
                      startNewChallenge(false)
                    }
                  }, 750)
                } else {
                  showCallout(
                    mult > 1 ? `+${letterPts} (x${mult} COMBO!)` : `+${letterPts}!`,
                    'sky',
                  )
                  sfx.playGift()
                  setChallenge({ ...activeChallenge })
                  setChallengeFeedback('hit')
                  feedbackTimer = 0.45
                }
              } else {
                currentStreak = 0
                setStreak(0)
                showCallout(zh ? '字母不对哦' : 'OOPS!', 'rose')
                sfx.playWrongLetter()
                setChallengeFeedback('miss')
                feedbackTimer = 0.45
              }
              break
            } else if (e.userData.type === 'ramp') {
              if (craftY < 0.8) {
                craftVelY = 14.5
                isGrounded = false
                spinTimer = 0.65
                bonusScore += 10
                emitBurst(playerCraft.position.x, 0.6, playerCraft.position.z, 12)
                showCallout(zh ? '飞跃浪花 +10!' : 'BIG AIR +10!', 'amber')
                sfx.playJump()
              }
            } else if (e.userData.type === 'obstacle') {
              if (craftY < (e.userData.height as number) * 0.72) {
                triggerCollision()
                break
              }
            }
          }

          // Rival entity interaction (competes for letter cubes & jumps off ramps)
          const rdz = Math.abs(e.position.z - rivalCraft.position.z)
          const rdx = Math.abs(e.position.x - rivalCraft.position.x)
          if (rdz < 1.35 && rdx < (e.userData.radius as number) + 0.65) {
            if (e.userData.type === 'letter') {
              const gateZ = e.position.z
              const wasTarget = Boolean(e.userData.isTarget)
              for (let k = entities.length - 1; k >= 0; k--) {
                if (entities[k].userData.type === 'letter' && Math.abs(entities[k].position.z - gateZ) < 2) {
                  scene.remove(entities[k])
                  entities.splice(k, 1)
                }
              }
              emitBurst(rivalCraft.position.x, 1.0, rivalCraft.position.z, 10)
              rivalBonusScore += wasTarget ? 25 : 10
              if (wasTarget) {
                rivalBoostTimer = 0.75
                rivalLetterHits += 1
                if (rivalLetterHits % 2 === 0) {
                  rivalWordsCount += 1
                  rivalBonusScore += 30
                  setRivalWordsDone(rivalWordsCount)
                }
              }
              break
            } else if (e.userData.type === 'ramp' && rivalY < 0.8) {
              rivalVelY = 13.5
              rivalGrounded = false
              rivalSpinTimer = 0.6
              rivalBonusScore += 10
              emitBurst(rivalCraft.position.x, 0.6, rivalCraft.position.z, 10)
            }
          }

          if (e.position.z > 14) {
            scene.remove(e)
            entities.splice(i, 1)
          }
        }
      }

      if (state === 'paused') {
        sfx.stopEngine()
      }

      // Animate realistic Water shader ripples & dynamic scenic biome cycle
      if (state !== 'paused') {
        const waterUniforms = waterSurface.material.uniforms as Record<string, { value: unknown }>
        const waterTime = waterUniforms.time as { value: number } | undefined
        if (waterTime) {
          waterTime.value += dt * (0.7 + moveSpeed * 0.06)
        }

        // Change surrounding biome based on current Stage (or slow preview on Start screen)
        const targetBiome =
          state === 'start'
            ? BIOMES[Math.floor((clock.elapsedTime * 0.35) / 14) % BIOMES.length]
            : BIOMES[(currentStage - 1) % BIOMES.length]
        const lerpRate = Math.min(1, dt * (state === 'start' ? 0.6 : 1.8))

        skyUniforms.uTopColor.value.lerp(targetBiome.top, lerpRate)
        skyUniforms.uMidColor.value.lerp(targetBiome.mid, lerpRate)
        skyUniforms.uHorizonColor.value.lerp(targetBiome.horizon, lerpRate)
        skyUniforms.uSunColor.value.lerp(targetBiome.sun, lerpRate)
        ;(scene.background as THREE.Color).copy(skyUniforms.uTopColor.value)
        if (scene.fog instanceof THREE.FogExp2) {
          scene.fog.color.lerp(targetBiome.fog, lerpRate)
        }
        hemiLight.color.lerp(targetBiome.hemiSky, lerpRate)
        hemiLight.groundColor.lerp(targetBiome.hemiGround, lerpRate)
        dirLight.color.lerp(targetBiome.dir, lerpRate)
        matNeonArch.color.lerp(targetBiome.neon, lerpRate)
        beamMat.color.copy(matNeonArch.color)

        const wSunColor = waterUniforms.sunColor as { value: THREE.Color } | undefined
        const wWaterColor = waterUniforms.waterColor as { value: THREE.Color } | undefined
        if (wSunColor) wSunColor.value.copy(skyUniforms.uSunColor.value)
        if (wWaterColor) wWaterColor.value.lerp(targetBiome.water, lerpRate)

        const sunY = THREE.MathUtils.lerp(sun.position.y, targetBiome.sunY, lerpRate)
        sun.position.y = sunY
        ;(sun.material as THREE.MeshBasicMaterial).color.copy(skyUniforms.uSunColor.value)
        skyUniforms.uSunPos.value.set(
          0.18 + Math.sin(clock.elapsedTime * 0.08) * 0.04,
          THREE.MathUtils.clamp((sunY + 10) / 110, 0.15, 0.72),
        )
        bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, targetBiome.bloom, lerpRate)

        // Cruise blimp & sweep searchlights across the city skyline
        const skyT = clock.elapsedTime
        blimpGroup.position.x = Math.sin(skyT * 0.14) * 52
        blimpGroup.position.y = 43 + Math.sin(skyT * 0.8) * 1.4
        blimpGroup.rotation.y = Math.cos(skyT * 0.14) > 0 ? 0 : Math.PI
        beamLeft.rotation.z = -0.3 + Math.sin(skyT * 0.9) * 0.28
        beamRight.rotation.z = 0.3 + Math.cos(skyT * 0.85) * 0.28
      }

      composer.render()
    }

    animate()

    return () => {
      disposed = true
      dracoLoader.dispose()
      sfx.stopEngine()
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      skyMat.dispose()
      beamGeo.dispose()
      beamMat.dispose()
      matNeonArch.dispose()
      matTowerGlass.dispose()
      matTowerAccent.dispose()
      matBoardwalk.dispose()
      matPalmTrunk.dispose()
      matPalmLeaf.dispose()
      matLampGlow.dispose()
      bannerTex.dispose()
      crowdTex.dispose()
      buildingTex.dispose()
      waterNormals.dispose()
      waterGeo.dispose()
      envRT.dispose()
      pmremGenerator.dispose()
      composer.dispose()
      for (const mat of letterMaterials.values()) {
        mat.map?.dispose()
        mat.dispose()
      }
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100svh-10rem)] min-h-[520px] w-full overflow-hidden rounded-2xl border border-border bg-slate-900 shadow-sm select-none"
    >
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />

      {/* Turbo Speed Edge Glow */}
      {phase === 'playing' && isTurbo && (
        <div className="pointer-events-none absolute inset-0 z-10 shadow-[inset_0_0_90px_rgba(34,211,238,0.45)] transition-opacity" />
      )}

      {/* Top HUD */}
      <div className="pointer-events-none absolute inset-x-4 top-3 z-10 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg border border-amber-400/50 bg-gradient-to-b from-slate-800/90 to-slate-950/90 px-3 py-1 text-xs font-black tracking-wider text-amber-300 shadow-lg backdrop-blur-md">
            POS <span className="ml-1 font-mono text-sm text-white">{posRank}/2</span>
          </div>
          <div className="rounded-lg border border-emerald-400/45 bg-gradient-to-b from-emerald-950/85 to-slate-950/90 px-3 py-1 text-xs font-black tracking-wider text-emerald-300 shadow-lg backdrop-blur-md">
            {zh ? '关卡' : 'STAGE'}{' '}
            <span className="ml-1 font-mono text-sm text-white">{stage}</span>
            <span className="ml-1.5 font-mono text-[11px] font-bold text-emerald-300/80">
              ({wordsDone % 3}/3)
            </span>
          </div>
          <div className="rounded-lg border border-white/20 bg-gradient-to-b from-slate-800/85 to-slate-950/90 px-3 py-1 text-xs font-bold text-slate-200 shadow-lg backdrop-blur-md">
            {zh ? '得分' : 'SCORE'}{' '}
            <span className="ml-1 font-mono text-sm font-black text-cyan-300">{score}</span>
          </div>
          <div className="rounded-lg border border-white/20 bg-gradient-to-b from-slate-800/85 to-slate-950/90 px-3 py-1 text-xs font-bold text-slate-200 shadow-lg backdrop-blur-md">
            {zh ? '单词' : 'WORDS'}{' '}
            <span className="ml-1 font-mono text-sm font-black text-amber-400">{wordsDone}</span>
          </div>
          <div className="rounded-lg border border-white/20 bg-gradient-to-b from-slate-800/85 to-slate-950/90 px-3 py-1 text-xs font-bold text-slate-200 shadow-lg backdrop-blur-md">
            {zh ? '最高' : 'BEST'}{' '}
            <span className="ml-1 font-mono text-sm font-black text-cyan-300">{bestScore}</span>
          </div>
          <div className="rounded-lg border border-white/15 bg-slate-900/75 px-2.5 py-1 text-[11px] font-bold tracking-wide text-slate-300 uppercase backdrop-blur-md">
            {zh ? DIFFICULTY_CONFIG[difficulty].labelZh : DIFFICULTY_CONFIG[difficulty].labelEn}
          </div>
          {phase === 'playing' && (
            <div className="rounded-lg border border-rose-400/40 bg-gradient-to-b from-rose-950/85 to-slate-950/90 px-3 py-1 text-xs font-bold text-rose-200 shadow-lg backdrop-blur-md">
              {zh ? '对手' : 'RIVAL'}{' '}
              <span className="ml-1 font-mono text-sm font-black text-rose-300">{rivalScore}</span>
              <span className="mx-1.5 text-rose-500/70">·</span>
              <span className="text-[11px] text-rose-200/80">{zh ? '词' : 'W'}</span>{' '}
              <span className="font-mono text-sm font-black text-amber-300">{rivalWordsDone}</span>
            </div>
          )}
          {streak > 1 && (
            <div className="animate-bounce rounded-lg border border-amber-300 bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-xs font-black text-slate-950 shadow-lg">
              🔥 x{Math.min(4, streak)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(phase === 'playing' || phase === 'paused') && (
            <button
              type="button"
              onClick={() => togglePauseRef.current?.()}
              className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/25 bg-gradient-to-b from-slate-700/85 to-slate-900/90 px-3 py-1.5 text-xs font-bold text-white shadow-md backdrop-blur-md transition hover:brightness-110"
            >
              {phase === 'paused' ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              <span>{phase === 'paused' ? (zh ? '继续' : 'Resume') : (zh ? '暂停' : 'Pause')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleMute}
            className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/25 bg-gradient-to-b from-slate-700/85 to-slate-900/90 px-3 py-1.5 text-xs font-bold text-white shadow-md backdrop-blur-md transition hover:brightness-110"
          >
            {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            <span>{muted ? (zh ? '静音' : 'Muted') : (zh ? '音效' : 'Sound')}</span>
          </button>
        </div>
      </div>

      {/* 3-2-1-GO! Studio Race Countdown */}
      {phase === 'countdown' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div
            className="-skew-x-12 animate-ping text-7xl font-black tracking-widest text-amber-300 drop-shadow-[0_6px_24px_rgba(0,0,0,0.7)] sm:text-8xl"
            style={{ animationDuration: '0.7s' }}
          >
            {countdownLabel}
          </div>
        </div>
      )}

      {/* Floating Arcade Callout */}
      {phase === 'playing' && callout && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center">
          <div
            className={`animate-bounce rounded-full px-4 py-1.5 text-sm font-black tracking-wide text-white shadow-lg ${
              callout.tone === 'emerald'
                ? 'bg-emerald-500'
                : callout.tone === 'amber'
                  ? 'bg-amber-500 text-slate-950'
                  : callout.tone === 'rose'
                    ? 'bg-rose-500'
                    : 'bg-sky-500'
            }`}
          >
            {callout.text}
          </div>
        </div>
      )}

      {/* Active Word Challenge (positioned neatly above racing dashboard) */}
      {phase === 'playing' && challenge && (
        <div className="pointer-events-auto absolute inset-x-4 bottom-24 z-10 flex justify-center">
          <div
            className={`flex max-w-lg items-center gap-3 rounded-2xl border px-4 py-2 text-white shadow-xl backdrop-blur-md transition-colors ${
              challengeFeedback === 'complete'
                ? 'border-emerald-400 bg-emerald-900/85'
                : challengeFeedback === 'hit'
                  ? 'border-sky-400 bg-sky-900/85'
                  : challengeFeedback === 'miss'
                    ? 'border-red-400 bg-red-900/85'
                    : 'border-sky-400/40 bg-slate-900/80'
            }`}
          >
            <BookOpen className="size-4 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1 font-mono text-base font-black tracking-wider">
                {challenge.letters.map((ch, idx) => {
                  const isMissing = challenge.missingIndices.includes(idx)
                  const isFilled = isMissing && challenge.filledIndices.includes(idx)
                  if (isMissing && !isFilled) {
                    return (
                      <span
                        key={idx}
                        className="inline-flex h-6 min-w-5 animate-pulse items-center justify-center rounded-md border border-amber-400 bg-amber-400/20 px-1 text-xs text-amber-300"
                      >
                        _
                      </span>
                    )
                  }
                  return (
                    <span key={idx} className={isFilled ? 'text-emerald-300' : 'text-white'}>
                      {ch}
                    </span>
                  )
                })}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-slate-200">{challenge.card.meaning}</p>
            </div>
            <button
              type="button"
              onClick={() => pronounceCard(challenge.card)}
              aria-label={zh ? '朗读单词' : 'Pronounce word'}
              className="ml-1 shrink-0 rounded-lg bg-white/10 p-1.5 text-sky-300 transition hover:bg-white/20"
            >
              <Volume2 className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Racing Dashboard HUD (Console Cluster + Gear Up + Gas Pedal) */}
      {phase === 'playing' && (
        <div className="pointer-events-none absolute inset-x-4 bottom-2.5 z-10 flex items-end justify-between gap-3">
          <div className="hidden w-12 sm:block" />

          {/* Brushed-Metal & Glass Racing Console */}
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border-2 border-slate-400/50 bg-gradient-to-b from-slate-700/90 via-slate-900/95 to-slate-950/95 px-3.5 py-2 text-white shadow-[0_12px_32px_rgba(0,0,0,0.65)] backdrop-blur-md">
            {/* Left Metallic Dial */}
            <div className="hidden size-11 shrink-0 items-center justify-center rounded-full border-2 border-slate-300/70 bg-gradient-to-b from-slate-200 to-slate-400 shadow-inner sm:flex">
              <div className="size-7 rounded-full border border-slate-500/40 bg-gradient-to-b from-slate-100 to-slate-300" />
            </div>

            <div className="flex flex-col gap-1">
              {/* RPM / Shift Timing Bar */}
              <div className="relative h-3 w-40 overflow-hidden rounded-full border border-slate-500/60 bg-slate-800 shadow-inner sm:w-52">
                <div className="absolute inset-y-0 left-0 w-[62%] bg-gradient-to-r from-amber-500/40 to-amber-400/60" />
                <div className="absolute inset-y-0 left-[62%] w-[26%] bg-emerald-400/90 shadow-[0_0_10px_#34d399]" />
                <div className="absolute inset-y-0 right-0 w-[12%] bg-rose-500/80" />
                <div
                  className="absolute inset-y-0 w-1.5 rounded-full bg-white shadow-[0_0_6px_#fff]"
                  style={{ left: `${Math.round(rpmNeedle * 95)}%` }}
                />
              </div>

              {/* Speed / Gear / Time Readout */}
              <div className="flex items-center justify-between gap-3 font-mono">
                <div className="flex items-baseline gap-1">
                  <span className="text-[9px] font-bold text-slate-400">SPEED</span>
                  <span className="text-sm font-black text-cyan-300">{String(mph).padStart(3, '0')}</span>
                  <span className="text-[9px] text-slate-400">MPH</span>
                </div>
                <div className="flex items-baseline gap-1 rounded bg-slate-800/90 px-2 py-0.5 border border-white/10">
                  <span className="text-[9px] font-bold text-slate-400">GEAR</span>
                  <span className="text-sm font-black text-white">{gear}</span>
                </div>
                <div className="hidden items-baseline gap-1 sm:flex">
                  <span className="text-[9px] font-bold text-slate-400">TIME</span>
                  <span className="text-sm font-black text-slate-100">{elapsedSec.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Glossy Circular GEAR UP Button with Shortcut Badge */}
            <button
              type="button"
              onClick={() => gearUpRef.current?.()}
              title={zh ? '换挡加速 (快捷键: Shift / E / G)' : 'Gear Up (Shortcut: Shift / E / G)'}
              className="relative flex size-13 shrink-0 cursor-pointer flex-col items-center justify-center rounded-full border-2 border-cyan-200 bg-gradient-to-b from-cyan-300 via-sky-400 to-cyan-600 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.55)] transition hover:brightness-110 active:scale-95"
            >
              <span className="text-xs leading-none font-black">▲</span>
              <span className="mt-0.5 text-[8px] leading-none font-black tracking-tight">GEAR UP</span>
              <span className="mt-0.5 rounded bg-slate-950/80 px-1 text-[7px] leading-tight font-bold text-cyan-200">
                SHIFT/E
              </span>
            </button>
          </div>

          {/* Brake & Gas Pedals */}
          <div className="pointer-events-auto flex items-end gap-2">
            {/* Brake Pedal (S / ↓) */}
            <button
              type="button"
              onPointerDown={() => {
                brakeRef.current = true
              }}
              onPointerUp={() => {
                brakeRef.current = false
              }}
              onPointerLeave={() => {
                brakeRef.current = false
              }}
              title={zh ? '刹车减速 (快捷键: S / ↓)' : 'Brake (Shortcut: S / ↓)'}
              className={`flex h-14 w-11 cursor-pointer flex-col items-center justify-between rounded-xl border-2 p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.5)] transition active:scale-95 ${
                isBraking
                  ? 'border-rose-400 bg-gradient-to-b from-rose-200 via-rose-400 to-rose-600'
                  : 'border-slate-300 bg-gradient-to-b from-slate-200 via-slate-400 to-slate-600'
              }`}
              aria-label="Brake"
            >
              <span className="text-[8px] leading-none font-black text-slate-900">BRK</span>
              <div className="flex w-full flex-col gap-1">
                {[0, 1, 2].map((slot) => (
                  <span key={slot} className="h-1 w-full rounded-xs bg-slate-800 shadow-inner" />
                ))}
              </div>
              <span className="rounded bg-slate-950/80 px-1 text-[7px] leading-tight font-bold text-rose-200">
                S / ↓
              </span>
            </button>

            {/* Metallic Ribbed Gas Pedal (W / ↑) */}
            <button
              type="button"
              onPointerDown={() => {
                gasRef.current = true
              }}
              onPointerUp={() => {
                gasRef.current = false
              }}
              onPointerLeave={() => {
                gasRef.current = false
              }}
              title={zh ? '油门加速 (快捷键: W / ↑)' : 'Throttle (Shortcut: W / ↑)'}
              className="flex h-18 w-12 cursor-pointer flex-col items-center justify-between rounded-xl border-2 border-slate-200 bg-gradient-to-b from-slate-100 via-slate-300 to-slate-500 p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.5)] transition active:scale-95 active:border-cyan-300"
              aria-label="Throttle"
            >
              <span className="text-[8px] leading-none font-black text-slate-800">GAS</span>
              <div className="flex w-full flex-col gap-1">
                {[0, 1, 2, 3].map((slot) => (
                  <span key={slot} className="h-1.5 w-full rounded-xs bg-slate-800 shadow-inner" />
                ))}
              </div>
              <span className="rounded bg-slate-950/80 px-1 text-[7px] leading-tight font-bold text-cyan-200">
                W / ↑
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Start Overlay */}
      {phase === 'start' && (
        <div
          onClick={() => startGameRef.current?.()}
          className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center p-4 text-center"
        >
          <h1
            className="text-4xl font-black tracking-wide text-cyan-300 sm:text-6xl"
            style={{
              textShadow: '0 3px 0 #0e7490, 0 6px 0 #155e75, 0 12px 24px rgba(10,35,60,0.55)',
              WebkitTextStroke: '1.5px #083344',
            }}
          >
            HYDRO RACER
            <span className="block text-3xl text-amber-300 sm:text-5xl">3D</span>
          </h1>
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-5 inline-flex items-center gap-1 rounded-2xl border border-white/50 bg-white/85 p-1 shadow-md backdrop-blur"
          >
            {(['easy', 'normal', 'hard'] as DifficultyLevel[]).map((lvl) => {
              const active = difficulty === lvl
              const cfg = DIFFICULTY_CONFIG[lvl]
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDifficulty(lvl)}
                  className={`cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition ${
                    active
                      ? lvl === 'hard'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : lvl === 'easy'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'bg-sky-500 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  {zh ? cfg.labelZh : cfg.labelEn}
                </button>
              )
            })}
          </div>
          <p className="mt-4 animate-pulse text-xl font-extrabold text-white drop-shadow-md sm:text-2xl">
            {zh ? '点击或按空格开始！' : 'Tap to start !'}
          </p>
          <span className="mt-3 rounded-full bg-slate-900/75 px-4 py-1.5 text-xs font-semibold text-slate-100 backdrop-blur">
            {zh
              ? 'A/D 转向 · W/↑ 加速 · S/↓ 刹车 · Shift/E/G 换挡 · Space 跳跃 · 抢先撞击字母方块！'
              : 'A/D Steer · W/↑ Gas · S/↓ Brake · Shift/E/G Gear Up · Space Jump · Race for letters!'}
          </span>
        </div>
      )}

      {/* Paused Overlay */}
      {phase === 'paused' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xs rounded-2xl border-2 border-sky-400/50 bg-white/95 p-6 text-center shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900">{zh ? '已暂停' : 'PAUSED'}</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {zh ? '按 P 或 Esc 继续比赛' : 'Press P or Esc to resume'}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => togglePauseRef.current?.()}
                className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-sky-500 to-cyan-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-md transition hover:brightness-105"
              >
                {zh ? '继续竞速' : 'Resume'}
              </button>
              <button
                type="button"
                onClick={() => startGameRef.current?.()}
                className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                {zh ? '重新开始' : 'Restart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border-2 border-sky-400/50 bg-white/95 p-6 text-center shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900">{zh ? '撞到浮标啦！' : 'WIPEOUT!'}</h2>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between border-b border-slate-200 pb-1 font-semibold text-slate-600">
                <span>{zh ? '本局得分' : 'Your Score'}</span>
                <strong className="text-sky-600">{score}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1 font-semibold text-slate-600">
                <span>{zh ? '到达关卡' : 'Stage Reached'}</span>
                <strong className="text-emerald-600">STAGE {stage}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1 font-semibold text-slate-600">
                <span>{zh ? '拼写完成单词' : 'Your Words'}</span>
                <strong className="text-sky-600">{wordsDone}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1 font-semibold text-rose-600">
                <span>{zh ? '对手得分 / 单词' : 'Rival Score / Words'}</span>
                <strong>{rivalScore} · {rivalWordsDone}</strong>
              </div>
              <div className="flex justify-between pb-1 font-semibold text-slate-600">
                <span>{zh ? '历史最高' : 'Best Score'}</span>
                <strong className="text-sky-600">{bestScore}</strong>
              </div>
            </div>

            {learnedWords.length > 0 && (
              <div className="mt-3 max-h-32 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 text-left">
                <p className="mb-1.5 text-[11px] font-bold text-slate-500">
                  {zh ? '本局完成单词（点击发音）：' : 'Completed words (tap to hear):'}
                </p>
                <div className="space-y-1">
                  {learnedWords.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => pronounceCard(w)}
                      className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs hover:bg-sky-100/70"
                    >
                      <span className="font-bold text-slate-800">{w.word}</span>
                      <span className="truncate text-slate-600">{w.meaning}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 flex justify-center gap-1 rounded-xl bg-slate-100 p-1">
              {(['easy', 'normal', 'hard'] as DifficultyLevel[]).map((lvl) => {
                const active = difficulty === lvl
                const cfg = DIFFICULTY_CONFIG[lvl]
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDifficulty(lvl)}
                    className={`flex-1 cursor-pointer rounded-lg py-1 text-xs font-bold transition ${
                      active ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {zh ? cfg.labelZh : cfg.labelEn}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => startGameRef.current?.()}
              className="mt-3 w-full cursor-pointer rounded-xl bg-gradient-to-r from-sky-500 to-cyan-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-md transition hover:brightness-105"
            >
              {zh ? '再来一局 (Space)' : 'Play Again (Space)'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
