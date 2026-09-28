import { clamp } from './geometry'
import type { Rect, Vec2, Viewport } from './types'

/** Pixels per metre. 4 px/m shows ~250 m across a laptop; 800 shows ~2 m. */
export const MIN_SCALE = 1.5
export const MAX_SCALE = 800
export const DEFAULT_SCALE = 32

export const worldToScreen = (vp: Viewport, p: Vec2): Vec2 => ({
  x: (p.x - vp.ox) * vp.scale,
  y: (p.y - vp.oy) * vp.scale,
})

export const screenToWorld = (vp: Viewport, p: Vec2): Vec2 => ({
  x: p.x / vp.scale + vp.ox,
  y: p.y / vp.scale + vp.oy,
})

/** World-space rectangle currently visible in a viewport of the given size. */
export function visibleRect(vp: Viewport, width: number, height: number): Rect {
  return { x: vp.ox, y: vp.oy, w: width / vp.scale, h: height / vp.scale }
}

/** Zoom about a fixed screen point, so the world point under the cursor stays put. */
export function zoomAt(vp: Viewport, screenPoint: Vec2, factor: number): Viewport {
  const next = clamp(vp.scale * factor, MIN_SCALE, MAX_SCALE)
  if (next === vp.scale) return vp
  const world = screenToWorld(vp, screenPoint)
  return {
    scale: next,
    ox: world.x - screenPoint.x / next,
    oy: world.y - screenPoint.y / next,
  }
}

export function panBy(vp: Viewport, dxScreen: number, dyScreen: number): Viewport {
  return { ...vp, ox: vp.ox - dxScreen / vp.scale, oy: vp.oy - dyScreen / vp.scale }
}

/** Frame a world rectangle with a little breathing room. */
export function fitRect(rect: Rect, width: number, height: number, padding = 0.12): Viewport {
  if (rect.w <= 0 || rect.h <= 0) {
    return { ox: rect.x - width / 2 / DEFAULT_SCALE, oy: rect.y - height / 2 / DEFAULT_SCALE, scale: DEFAULT_SCALE }
  }
  const usableW = width * (1 - padding * 2)
  const usableH = height * (1 - padding * 2)
  const scale = clamp(Math.min(usableW / rect.w, usableH / rect.h), MIN_SCALE, MAX_SCALE)
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  return { scale, ox: cx - width / 2 / scale, oy: cy - height / 2 / scale }
}

// ---------------------------------------------------------------------------
// Adaptive grid and scale bar
// ---------------------------------------------------------------------------

/** Round a value up to the next 1 / 2 / 5 x 10^n. Keeps grid labels readable. */
export function niceStep(raw: number): number {
  if (raw <= 0) return 1
  const exp = Math.floor(Math.log10(raw))
  const pow = 10 ** exp
  const frac = raw / pow
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10
  return nice * pow
}

export interface GridSpec {
  /** Metres between minor lines. */
  minor: number
  /** Metres between major (labelled) lines. */
  major: number
  /** Minor lines fade out as they approach the density limit. */
  minorOpacity: number
}

/**
 * Pick grid spacing so minor lines stay roughly 8-80 px apart at any zoom.
 * `base` is the document's preferred spacing, used verbatim when it fits.
 */
export function gridSpec(scale: number, base: number): GridSpec {
  const targetPx = 26
  let minor = base
  // Step by decades until the spacing is in a comfortable range.
  while (minor * scale < 8) minor *= 10
  while (minor * scale > 140) minor /= 10
  const major = minor * (minor * scale < 18 ? 10 : 5)
  const px = minor * scale
  const minorOpacity = clamp((px - 6) / (targetPx - 6), 0, 1)
  return { minor, major, minorOpacity }
}

export interface ScaleBarSpec {
  /** Length of the bar in metres. */
  meters: number
  /** Length of the bar in pixels. */
  pixels: number
  label: string
  /** Number of alternating segments. */
  segments: number
}

/** A scale bar sized to sit near `targetPx` wide while showing a round number. */
export function scaleBarSpec(scale: number, targetPx = 140): ScaleBarSpec {
  const meters = niceStep(targetPx / scale)
  const segments = meters / 10 ** Math.floor(Math.log10(meters)) === 2 ? 4 : 5
  return {
    meters,
    pixels: meters * scale,
    label: formatDistance(meters),
    segments,
  }
}

/** Human distance: mm below a centimetre, cm below a metre, km above 1000 m. */
export function formatDistance(meters: number): string {
  const m = Math.abs(meters)
  if (m === 0) return '0 m'
  if (m < 0.01) return `${round(meters * 1000, 0)} mm`
  if (m < 1) return `${round(meters * 100, m < 0.1 ? 1 : 0)} cm`
  if (m < 1000) return `${round(meters, m < 10 ? 2 : m < 100 ? 1 : 0)} m`
  return `${round(meters / 1000, 2)} km`
}

export function formatArea(squareMeters: number): string {
  const a = Math.abs(squareMeters)
  if (a < 1) return `${round(squareMeters * 10000, 0)} cm²`
  if (a < 10000) return `${round(squareMeters, a < 10 ? 2 : a < 100 ? 1 : 0)} m²`
  return `${round(squareMeters / 10000, 2)} ha`
}

function round(v: number, places: number): string {
  const s = v.toFixed(places)
  // Trim trailing zeros but keep at least an integer part.
  return places > 0 ? s.replace(/\.?0+$/, '') : s
}
