import { useSyncExternalStore } from 'react'

/**
 * Low-resolution alpha coverage for an asset, sampled in normalised local
 * space (0..1 on both axes regardless of the artwork's aspect ratio).
 *
 * This is what lets a click fall *through* the transparent corner of a tree
 * crown to the bench behind it. Konva can do pixel-accurate hit testing with
 * `drawHitFromCache()`, but that allocates a full-size hit canvas per node —
 * unaffordable at a few hundred objects. One shared 96x96 mask per *asset*
 * costs 9 KB no matter how many times the asset is placed.
 */
export interface AlphaMask {
  res: number
  /** `res * res` alpha bytes, row-major. */
  data: Uint8Array
}

export interface LoadedImage {
  src: string
  image: HTMLImageElement
  width: number
  height: number
  mask: AlphaMask | null
  /** Set when the pixels could not be read (tainted canvas). */
  maskBlocked: boolean
}

export const MASK_RES = 96
/** Alpha at or below this counts as empty space. */
export const MASK_THRESHOLD = 10

const cache = new Map<string, LoadedImage>()
const pending = new Map<string, Promise<LoadedImage | null>>()
const failed = new Set<string>()
const listeners = new Set<() => void>()

let version = 0
function bump() {
  version++
  for (const l of listeners) l()
}

function buildMask(image: HTMLImageElement): { mask: AlphaMask | null; blocked: boolean } {
  const canvas = document.createElement('canvas')
  canvas.width = MASK_RES
  canvas.height = MASK_RES
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { mask: null, blocked: true }
  ctx.clearRect(0, 0, MASK_RES, MASK_RES)
  // Stretch to the full square: local space is normalised, so aspect is
  // reapplied at sample time by the caller.
  ctx.drawImage(image, 0, 0, MASK_RES, MASK_RES)
  try {
    const { data } = ctx.getImageData(0, 0, MASK_RES, MASK_RES)
    const alpha = new Uint8Array(MASK_RES * MASK_RES)
    for (let i = 0, j = 3; i < alpha.length; i++, j += 4) alpha[i] = data[j]
    return { mask: { res: MASK_RES, data: alpha }, blocked: false }
  } catch {
    // Cross-origin artwork; fall back to rectangular hit testing.
    return { mask: null, blocked: true }
  }
}

export function getImage(src: string): LoadedImage | undefined {
  return cache.get(src)
}

export function loadImage(src: string): Promise<LoadedImage | null> {
  const hit = cache.get(src)
  if (hit) return Promise.resolve(hit)
  const inFlight = pending.get(src)
  if (inFlight) return inFlight

  const promise = new Promise<LoadedImage | null>((resolve) => {
    const image = new Image()
    // Only meaningful for genuinely remote artwork. Setting it on blob: URLs
    // (every custom asset) has tripped up Safari, and they are same-origin
    // anyway, so the canvas stays untainted without it.
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      image.crossOrigin = 'anonymous'
    }
    image.decoding = 'async'
    image.onload = () => {
      const { mask, blocked } = buildMask(image)
      const entry: LoadedImage = {
        src,
        image,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        mask,
        maskBlocked: blocked,
      }
      cache.set(src, entry)
      pending.delete(src)
      bump()
      resolve(entry)
    }
    image.onerror = () => {
      failed.add(src)
      pending.delete(src)
      bump()
      resolve(null)
    }
    image.src = src
  })

  pending.set(src, promise)
  return promise
}

export function preloadImages(srcs: Iterable<string>): Promise<unknown> {
  return Promise.all([...srcs].map((s) => loadImage(s)))
}

export function hasFailed(src: string): boolean {
  return failed.has(src)
}

/** Drop a cached entry, e.g. after a custom asset's artwork is replaced. */
export function invalidateImage(src: string): void {
  cache.delete(src)
  pending.delete(src)
  failed.delete(src)
  bump()
}

// ---------------------------------------------------------------------------
// React binding
// ---------------------------------------------------------------------------

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

const getVersion = () => version

/**
 * Returns the loaded image for `src`, kicking off a load on first use and
 * re-rendering once it arrives. Returns `undefined` while loading.
 */
export function useLoadedImage(src: string | undefined): LoadedImage | undefined {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  if (!src) return undefined
  const hit = cache.get(src)
  if (!hit && !pending.has(src) && !failed.has(src)) void loadImage(src)
  return hit
}

/** Re-renders whenever *any* image finishes loading. For canvas layers. */
export function useImageCacheVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion)
}

// ---------------------------------------------------------------------------
// Mask sampling
// ---------------------------------------------------------------------------

/**
 * Sample coverage at normalised local coordinates.
 * `radius` is in normalised units and forgives near-misses on thin artwork.
 */
export function sampleMask(mask: AlphaMask, u: number, v: number, radius = 0): boolean {
  const { res, data } = mask
  if (radius <= 0) {
    const px = Math.floor(u * res)
    const py = Math.floor(v * res)
    if (px < 0 || py < 0 || px >= res || py >= res) return false
    return data[py * res + px] > MASK_THRESHOLD
  }
  const r = Math.max(1, Math.round(radius * res))
  const cx = Math.floor(u * res)
  const cy = Math.floor(v * res)
  const x0 = Math.max(0, cx - r)
  const x1 = Math.min(res - 1, cx + r)
  const y0 = Math.max(0, cy - r)
  const y1 = Math.min(res - 1, cy + r)
  for (let y = y0; y <= y1; y++) {
    const row = y * res
    for (let x = x0; x <= x1; x++) {
      if (data[row + x] > MASK_THRESHOLD) return true
    }
  }
  return false
}

/** Fraction of the mask that is opaque. Used to rank overlapping candidates. */
export function maskCoverage(mask: AlphaMask): number {
  let n = 0
  for (let i = 0; i < mask.data.length; i++) if (mask.data[i] > MASK_THRESHOLD) n++
  return n / mask.data.length
}

/**
 * Tight bounds of the opaque pixels, in normalised local space. Custom assets
 * get auto-trimmed on import, but built-ins and re-imports may still carry
 * padding, and a tight box makes selection outlines look right.
 */
export function maskExtent(mask: AlphaMask): { x0: number; y0: number; x1: number; y1: number } | null {
  const { res, data } = mask
  let minX = res
  let minY = res
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < res; y++) {
    const row = y * res
    for (let x = 0; x < res; x++) {
      if (data[row + x] > MASK_THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x0: minX / res, y0: minY / res, x1: (maxX + 1) / res, y1: (maxY + 1) / res }
}
