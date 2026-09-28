import { useCallback, useEffect, useRef, useState } from 'react'

import { preloadImages } from '@/core/imageCache'
import type { AssetDef, GardenDoc, MaterialDef } from '@/core/types'

/**
 * A read-only isometric render of the plan.
 *
 * Deliberately not an editing mode: no picking, no gizmos, no orbit inertia.
 * It renders on demand — when the plan, the compass or the sun changes — and
 * then sits idle, so it costs nothing while you look at it.
 *
 * three.js is imported dynamically so the 2D planner never pays for it.
 */

export type Compass = 0 | 90 | 180 | 270

export interface IsoViewProps {
  doc: GardenDoc
  assets: ReadonlyMap<string, AssetDef>
  materials: ReadonlyMap<string, MaterialDef>
  hiddenBands: readonly number[]
  /** Which corner the camera looks from. */
  compass: Compass
  /** Sun elevation in degrees above the horizon. */
  sunElevation: number
  shadows: boolean
  onReady?: (api: { exportPng: (name: string) => void; decalCount: number }) => void
}

/** The classic 2:1 isometric elevation, ~35.264 degrees. */
const ISO_ELEVATION = Math.atan(Math.SQRT1_2)

export function IsoView({
  doc,
  assets,
  materials,
  hiddenBands,
  compass,
  sunElevation,
  shadows,
  onReady,
}: IsoViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<{
    THREE: typeof import('three')
    renderer: import('three').WebGLRenderer
    scene: import('three').Scene
    camera: import('three').OrthographicCamera
    sun: import('three').DirectionalLight
    content: import('three').Group | null
    bounds: { x: number; y: number; w: number; h: number }
    dispose: () => void
  } | null>(null)

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)

  // --- one-time setup ------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    if (!container) return

    void (async () => {
      try {
        const THREE = await import('three')
        const { disposeMaterialCache } = await import('./builders')
        const { disposeTextureCache } = await import('./buildScene')
        if (cancelled) return

        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        renderer.setClearColor(0xeef1ec, 1)
        container.append(renderer.domElement)
        renderer.domElement.style.display = 'block'
        renderer.domElement.style.width = '100%'
        renderer.domElement.style.height = '100%'

        const scene = new THREE.Scene()
        const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 2000)

        // Sky/ground hemisphere keeps shadowed faces readable rather than
        // black, which matters when the only light is one hard sun.
        scene.add(new THREE.HemisphereLight(0xdfeaf2, 0x6f7a5e, 1.15))
        const ambient = new THREE.AmbientLight(0xffffff, 0.35)
        scene.add(ambient)

        const sun = new THREE.DirectionalLight(0xfff4e0, 1.5)
        sun.castShadow = true
        sun.shadow.mapSize.set(2048, 2048)
        scene.add(sun)
        scene.add(sun.target)

        stateRef.current = {
          THREE,
          renderer,
          scene,
          camera,
          sun,
          content: null,
          bounds: { x: 0, y: 0, w: 20, h: 20 },
          dispose: () => {
            disposeMaterialCache()
            disposeTextureCache()
            renderer.dispose()
            renderer.domElement.remove()
          },
        }
        setStatus('ready')
      } catch (error) {
        if (cancelled) return
        setStatus('error')
        setMessage(
          error instanceof Error ? error.message : 'This browser could not start WebGL.',
        )
      }
    })()

    return () => {
      cancelled = true
      stateRef.current?.dispose()
      stateRef.current = null
    }
  }, [])

  // --- camera framing ------------------------------------------------------
  const frame = useCallback(() => {
    const state = stateRef.current
    const container = containerRef.current
    if (!state || !container) return
    const { THREE, camera, renderer, sun, bounds } = state

    const width = container.clientWidth
    const height = container.clientHeight
    if (width === 0 || height === 0) return
    renderer.setSize(width, height, false)

    const centre = new THREE.Vector3(bounds.x + bounds.w / 2, 0, bounds.y + bounds.h / 2)
    // Diagonal, plus headroom for anything tall standing at the back.
    const radius = Math.max(6, Math.hypot(bounds.w, bounds.h) * 0.62)
    const aspect = width / height
    const half = radius * 1.08
    camera.left = -half * aspect
    camera.right = half * aspect
    camera.top = half
    camera.bottom = -half
    camera.near = 0.1
    camera.far = radius * 12
    camera.updateProjectionMatrix()

    const azimuth = ((compass + 45) * Math.PI) / 180
    const distance = radius * 4
    camera.position.set(
      centre.x + Math.sin(azimuth) * Math.cos(ISO_ELEVATION) * distance,
      centre.y + Math.sin(ISO_ELEVATION) * distance,
      centre.z + Math.cos(azimuth) * Math.cos(ISO_ELEVATION) * distance,
    )
    camera.lookAt(centre)

    // Sun follows the camera azimuth so shadows always fall away from the
    // viewer; a sun behind the scene flattens everything into silhouette.
    const sunAzimuth = azimuth + Math.PI * 0.35
    const elevation = (sunElevation * Math.PI) / 180
    const sunDistance = radius * 3
    sun.position.set(
      centre.x + Math.sin(sunAzimuth) * Math.cos(elevation) * sunDistance,
      centre.y + Math.sin(elevation) * sunDistance,
      centre.z + Math.cos(sunAzimuth) * Math.cos(elevation) * sunDistance,
    )
    sun.target.position.copy(centre)
    sun.target.updateMatrixWorld()

    const shadowCamera = sun.shadow.camera as import('three').OrthographicCamera
    shadowCamera.left = -radius * 1.3
    shadowCamera.right = radius * 1.3
    shadowCamera.top = radius * 1.3
    shadowCamera.bottom = -radius * 1.3
    shadowCamera.near = 0.5
    shadowCamera.far = sunDistance * 2.2
    shadowCamera.updateProjectionMatrix()
    sun.castShadow = shadows
  }, [compass, sunElevation, shadows])

  const render = useCallback(() => {
    const state = stateRef.current
    if (!state) return
    frame()
    state.renderer.render(state.scene, state.camera)
  }, [frame])

  // --- rebuild when the plan changes ---------------------------------------
  useEffect(() => {
    if (status !== 'ready') return
    let cancelled = false

    void (async () => {
      const state = stateRef.current
      if (!state) return
      const { buildScene, disposeScene } = await import('./buildScene')

      // Textures and decals read from the shared image cache, which may not
      // have every asset yet if the plan was restored but never scrolled.
      const sources = new Set<string>()
      for (const object of Object.values(doc.objects)) {
        const asset = assets.get(object.assetId)
        if (asset) sources.add(asset.src)
      }
      for (const surface of doc.surfaces) {
        const material = materials.get(surface.materialId)
        if (material?.textureSrc) sources.add(material.textureSrc)
      }
      await preloadImages(sources)
      if (cancelled || !stateRef.current) return

      if (state.content) {
        state.scene.remove(state.content)
        disposeScene(state.content)
      }

      const result = buildScene(doc, assets, materials, hiddenBands)
      state.content = result.root
      state.bounds = result.bounds
      state.scene.add(result.root)

      render()
      onReady?.({
        decalCount: result.decalCount,
        exportPng: (name: string) => {
          render()
          state.renderer.domElement.toBlob((blob) => {
            if (!blob) return
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = `${name}.png`
            document.body.append(anchor)
            anchor.click()
            anchor.remove()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
          }, 'image/png')
        },
      })
    })()

    return () => {
      cancelled = true
    }
    // `onReady` is intentionally excluded: it is a fresh closure each render
    // and would rebuild the whole scene on every parent update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, doc, assets, materials, hiddenBands, render])

  // Re-render when the camera or sun controls move, without rebuilding.
  useEffect(() => {
    if (status === 'ready') render()
  }, [status, compass, sunElevation, shadows, render])

  // Keep the canvas matched to its container.
  useEffect(() => {
    const container = containerRef.current
    if (!container || status !== 'ready') return
    const observer = new ResizeObserver(() => render())
    observer.observe(container)
    return () => observer.disconnect()
  }, [status, render])

  return (
    <div ref={containerRef} className="relative h-full w-full bg-[#eef1ec]">
      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center text-sm text-stone-500">
          Preparing the 3D view…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          <div>
            <p className="text-sm font-medium text-stone-700">The 3D view could not start</p>
            <p className="mt-1 text-xs text-stone-500">{message}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default IsoView
