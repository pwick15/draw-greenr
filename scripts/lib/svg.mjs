/** Shared drawing helpers for the asset generators. */

/** Pixels per metre used by every generated SVG. */
export const PPM = 64

/** Deterministic PRNG so regenerating assets never churns the diff. */
export function makeRandom(seed) {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const lerp = (a, b, t) => a + (b - a) * t
export const rand = (r, lo, hi) => lo + r() * (hi - lo)
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length]
export const n = (v) => Math.round(v * 100) / 100

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

export function hsl(h, s, l, a = 1) {
  const hh = ((h % 360) + 360) % 360
  return a >= 1 ? `hsl(${n(hh)} ${n(s)}% ${n(l)}%)` : `hsl(${n(hh)} ${n(s)}% ${n(l)}% / ${n(a)})`
}

/** Jitter a base colour, for foliage that should not look like flat vinyl. */
export function vary(r, base, dh = 10, ds = 8, dl = 10) {
  return {
    h: base.h + rand(r, -dh, dh),
    s: clamp(base.s + rand(r, -ds, ds), 0, 100),
    l: clamp(base.l + rand(r, -dl, dl), 0, 100),
  }
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
export const shade = (c, dl) => ({ ...c, l: clamp(c.l + dl, 0, 100) })
export const css = (c, a = 1) => hsl(c.h, c.s, c.l, a)

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/**
 * A closed organic blob: a circle of `points` radii perturbed by `wobble`,
 * joined with a Catmull-Rom-ish cubic so the outline stays smooth.
 */
export function blobPath(r, cx, cy, radius, wobble = 0.22, points = 9, squash = 1) {
  const pts = []
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2
    const rr = radius * (1 + rand(r, -wobble, wobble))
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * squash])
  }
  return closedSpline(pts)
}

/** Closed cubic spline through `pts` (Catmull-Rom converted to Bezier). */
export function closedSpline(pts, tension = 1) {
  const len = pts.length
  if (len < 3) return ''
  let d = `M${n(pts[0][0])} ${n(pts[0][1])}`
  for (let i = 0; i < len; i++) {
    const p0 = pts[(i - 1 + len) % len]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % len]
    const p3 = pts[(i + 2) % len]
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension
    d += `C${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(p2[0])} ${n(p2[1])}`
  }
  return `${d}Z`
}

export function polygonPath(pts) {
  return `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`
}

/** Rounded rectangle path. */
export function rrect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  return (
    `M${n(x + rr)} ${n(y)}H${n(x + w - rr)}A${n(rr)} ${n(rr)} 0 0 1 ${n(x + w)} ${n(y + rr)}` +
    `V${n(y + h - rr)}A${n(rr)} ${n(rr)} 0 0 1 ${n(x + w - rr)} ${n(y + h)}` +
    `H${n(x + rr)}A${n(rr)} ${n(rr)} 0 0 1 ${n(x)} ${n(y + h - rr)}` +
    `V${n(y + rr)}A${n(rr)} ${n(rr)} 0 0 1 ${n(x + rr)} ${n(y)}Z`
  )
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function svgDoc(width, height, body, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" viewBox="0 0 ${n(width)} ${n(height)}">${extra}${body}</svg>\n`
}

export const g = (attrs, body) => `<g ${attrs}>${body}</g>`
export const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra ? ' ' + extra : ''}/>`
export const circle = (cx, cy, r, fill, extra = '') =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`
export const ellipse = (cx, cy, rx, ry, fill, extra = '') =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`
export const rect = (x, y, w, h, fill, extra = '') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`
export const line = (x1, y1, x2, y2, stroke, width, extra = '') =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${n(width)}"${extra ? ' ' + extra : ''}/>`

/**
 * A soft contact shadow. Top-down plans read much better with one: it is the
 * only cue that separates a tree crown from a flat green circle.
 */
export function dropShadow(id, dx = 0, dy = 0, blur = 2, opacity = 0.25) {
  return (
    `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%">` +
    `<feDropShadow dx="${n(dx)}" dy="${n(dy)}" stdDeviation="${n(blur)}" flood-color="#0b2010" flood-opacity="${n(opacity)}"/>` +
    `</filter>`
  )
}

/** Radial highlight suggesting light from the top-left. */
export function sunGradient(id, c, strength = 0.35) {
  return (
    `<radialGradient id="${id}" cx="33%" cy="28%" r="78%">` +
    `<stop offset="0%" stop-color="${css(shade(c, 14))}" stop-opacity="${n(strength)}"/>` +
    `<stop offset="55%" stop-color="${css(c)}" stop-opacity="0"/>` +
    `<stop offset="100%" stop-color="${css(shade(c, -20))}" stop-opacity="${n(strength * 0.9)}"/>` +
    `</radialGradient>`
  )
}
