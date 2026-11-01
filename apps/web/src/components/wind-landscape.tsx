import { useEffect, useRef } from 'react'

const vertexSource = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const fragmentSource = `
precision mediump float;
uniform sampler2D uPhoto;
uniform vec2 uCover;
uniform vec2 uCamera;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 uv = (vUv - 0.5) * uCover + 0.5 + uCamera;
  // Trace the near shoreline in the photograph, from the high left bank
  // down to the low right bank. Keep a still margin next to the grass.
  float shore = mix(0.55, 0.49, smoothstep(0.02, 0.18, uv.x));
  shore = mix(shore, 0.39, smoothstep(0.18, 0.31, uv.x));
  shore = mix(shore, 0.31, smoothstep(0.31, 0.43, uv.x));
  shore = mix(shore, 0.28, smoothstep(0.43, 0.53, uv.x));
  shore = mix(shore, 0.26, smoothstep(0.53, 0.68, uv.x));
  shore = mix(shore, 0.22, smoothstep(0.68, 0.83, uv.x));
  shore = mix(shore, 0.19, smoothstep(0.83, 1.0, uv.x));
  float lake = smoothstep(shore + 0.012, shore + 0.03, uv.y)
    * (1.0 - smoothstep(0.54, 0.57, uv.y));
  float ripple = sin(uv.x * 115.0 + uv.y * 31.0 + uTime * 1.2)
    + 0.45 * sin(uv.x * 183.0 - uv.y * 44.0 - uTime * 0.8);
  uv += vec2(ripple * 0.0007, ripple * 0.00012) * lake;
  gl_FragColor = texture2D(uPhoto, clamp(uv, 0.0, 1.0));
}
`

function createProgram(gl: WebGLRenderingContext) {
  const shaders: WebGLShader[] = []
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
    const shader = gl.createShader(type)
    if (!shader) break
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader)
      break
    }
    shaders.push(shader)
  }
  const program = shaders.length === 2 ? gl.createProgram() : null
  if (program) {
    gl.attachShader(program, shaders[0])
    gl.attachShader(program, shaders[1])
    gl.linkProgram(program)
  }
  shaders.forEach((shader) => gl.deleteShader(shader))
  if (!program) return null
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program
  gl.deleteProgram(program)
  return null
}

const plants = [
  { className: 'auth-plant-meadow-back', src: '/wind-meadow.png', depth: 0.3, phase: 0.3 },
  { className: 'auth-plant-meadow-front', src: '/wind-meadow.png', depth: 0.7, phase: 2.2 },
  { className: 'auth-plant-lupines-back', src: '/wind-lupines.png', depth: 0.55, phase: 1.3 },
  { className: 'auth-plant-lupines-front', src: '/wind-lupines.png', depth: 1, phase: 3.5 },
] as const

export function WindLandscape() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const gl = canvas?.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'low-power' })
    if (!container || !canvas || !gl) return

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointer = { x: 0, y: 0 }
    const camera = { x: 0, y: 0 }
    let disposed = false
    let frame = 0
    let lastFrame = 0
    let observer: ResizeObserver | undefined
    let program: WebGLProgram | null = null
    let buffer: WebGLBuffer | null = null
    let texture: WebGLTexture | null = null
    let cleanup = () => {}
    const image = new Image()

    const movePointer = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 2
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 2
    }
    const resetPointer = () => { pointer.x = 0; pointer.y = 0 }

    image.onload = () => {
      if (disposed) return
      program = createProgram(gl)
      buffer = gl.createBuffer()
      texture = gl.createTexture()
      if (!program || !buffer || !texture) return
      gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
      const position = gl.getAttribLocation(program, 'aPosition')
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      const uniforms = {
        photo: gl.getUniformLocation(program, 'uPhoto'),
        cover: gl.getUniformLocation(program, 'uCover'),
        camera: gl.getUniformLocation(program, 'uCamera'),
        time: gl.getUniformLocation(program, 'uTime'),
      }
      gl.uniform1i(uniforms.photo, 0)
      container.classList.add('is-ready')
      const plantElements = Array.from(container.querySelectorAll<HTMLElement>('.auth-plant'))

      const draw = (time: number) => {
        const rect = canvas.getBoundingClientRect()
        const density = Math.min(window.devicePixelRatio || 1, window.innerWidth < 600 ? 1.2 : 1.5)
        const width = Math.max(1, Math.min(Math.round(rect.width * density), 2200))
        const height = Math.max(1, Math.min(Math.round(rect.height * density), 1500))
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
        gl.viewport(0, 0, width, height)
        camera.x += (pointer.x - camera.x) * 0.065
        camera.y += (pointer.y - camera.y) * 0.065
        const imageAspect = image.width / image.height
        const viewAspect = width / height
        const coverX = Math.min(1, viewAspect / imageAspect) * 0.975
        const coverY = Math.min(1, imageAspect / viewAspect) * 0.975
        gl.uniform2f(uniforms.cover,
          coverX, coverY)
        const mobileOffset = window.innerWidth < 600 ? 0.05 * (1 - coverX) : 0
        gl.uniform2f(uniforms.camera, mobileOffset - camera.x * 0.006, camera.y * 0.004)
        gl.uniform1f(uniforms.time, time)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

        plantElements.forEach((element, index) => {
          const plant = plants[index]
          const wind = Math.sin(time * 0.78 + plant.phase) * 0.7
            + Math.sin(time * 1.43 + plant.phase * 1.7) * 0.3
          const sway = wind * plant.depth * 2.1
          const x = -camera.x * plant.depth * 12
          const y = camera.y * plant.depth * 5
          element.style.transform = `translate3d(${x}px, ${y}px, 0) rotateY(${sway * 1.4}deg) rotateZ(${sway}deg)`
        })
      }
      const tick = (now: number) => {
        if (now - lastFrame >= 30) {
          lastFrame = now
          draw(now / 1000)
        }
        if (!disposed && !motion.matches && !document.hidden) frame = requestAnimationFrame(tick)
      }
      const update = () => {
        cancelAnimationFrame(frame)
        if (motion.matches || document.hidden) return
        frame = requestAnimationFrame(tick)
      }
      observer = new ResizeObserver(() => { if (!motion.matches) draw(performance.now() / 1000) })
      observer.observe(canvas)
      motion.addEventListener('change', update)
      document.addEventListener('visibilitychange', update)
      window.addEventListener('pointermove', movePointer, { passive: true })
      window.addEventListener('pointerleave', resetPointer)
      update()
      cleanup = () => {
        motion.removeEventListener('change', update)
        document.removeEventListener('visibilitychange', update)
        window.removeEventListener('pointermove', movePointer)
        window.removeEventListener('pointerleave', resetPointer)
      }
    }
    image.src = '/login-landscape.jpg'

    return () => {
      disposed = true
      image.onload = null
      cancelAnimationFrame(frame)
      observer?.disconnect()
      cleanup()
      container.classList.remove('is-ready')
      if (texture) gl.deleteTexture(texture)
      if (buffer) gl.deleteBuffer(buffer)
      if (program) gl.deleteProgram(program)
    }
  }, [])

  return (
    <div ref={containerRef} className="auth-landscape" aria-hidden="true">
      <canvas ref={canvasRef} className="auth-wind-canvas" />
      {plants.map((plant) => (
        <img key={plant.className} className={`auth-plant ${plant.className}`} src={plant.src} alt="" draggable={false} />
      ))}
    </div>
  )
}
