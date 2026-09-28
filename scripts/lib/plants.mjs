/** Top-down plant artwork. */
import {
  blobPath,
  circle,
  closedSpline,
  css,
  dropShadow,
  ellipse,
  g,
  makeRandom,
  n,
  path,
  pick,
  rand,
  shade,
  sunGradient,
  svgDoc,
  vary,
} from './svg.mjs'

export const PALETTES = {
  deciduous: { h: 104, s: 44, l: 42 },
  lightGreen: { h: 88, s: 55, l: 52 },
  darkGreen: { h: 132, s: 38, l: 28 },
  conifer: { h: 152, s: 36, l: 26 },
  olive: { h: 74, s: 30, l: 44 },
  autumn: { h: 32, s: 68, l: 48 },
  purple: { h: 292, s: 30, l: 38 },
  silver: { h: 110, s: 14, l: 62 },
}

/**
 * A crown built from overlapping leaf clumps. The clumps shrink and lighten
 * toward the top-left so the canopy reads as a dome rather than a disc.
 */
function crown(r, cx, cy, radius, base, opts = {}) {
  const { clumps = 26, spread = 0.72, clumpScale = 0.34, wobble = 0.3, squash = 1 } = opts
  const parts = []
  // Outer silhouette first, so gaps between clumps do not punch through.
  parts.push(path(blobPath(r, cx, cy, radius * 0.94, 0.09, 13, squash), css(shade(base, -10))))

  const items = []
  for (let i = 0; i < clumps; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * radius * spread
    const x = cx + Math.cos(a) * d
    const y = cy + Math.sin(a) * d * squash
    // Distance from the lit corner drives both size and lightness.
    const lit = 1 - Math.hypot(x - (cx - radius * 0.3), y - (cy - radius * 0.3)) / (radius * 2)
    const cr = radius * clumpScale * rand(r, 0.6, 1.15) * (0.82 + lit * 0.3)
    const col = vary(r, shade(base, -8 + lit * 22), 9, 7, 5)
    items.push({ x, y, cr, col, lit })
  }
  // Paint darkest first so highlights sit on top.
  items.sort((a, b) => a.lit - b.lit)
  for (const it of items) {
    parts.push(path(blobPath(r, it.x, it.y, it.cr, wobble, 7, squash), css(it.col)))
  }
  return parts.join('')
}

/** Branch structure glimpsed through the canopy. */
function branches(r, cx, cy, radius, count = 6) {
  const parts = []
  const col = 'hsl(28 26% 24% / 0.5)'
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand(r, -0.3, 0.3)
    const len = radius * rand(r, 0.5, 0.78)
    const mx = cx + Math.cos(a) * len * 0.5
    const my = cy + Math.sin(a) * len * 0.5
    parts.push(
      `<path d="M${n(cx)} ${n(cy)}Q${n(mx + rand(r, -4, 4))} ${n(my + rand(r, -4, 4))} ${n(cx + Math.cos(a) * len)} ${n(cy + Math.sin(a) * len)}" stroke="${col}" stroke-width="${n(radius * 0.06)}" stroke-linecap="round" fill="none"/>`,
    )
  }
  return parts.join('')
}

export function deciduousTree({ seed, size, palette = PALETTES.deciduous, blossom = null, trunk = true }) {
  const r = makeRandom(seed)
  const w = size
  const c = w / 2
  const radius = w * 0.47
  const defs = `<defs>${dropShadow('sh', w * 0.035, w * 0.045, w * 0.028, 0.3)}${sunGradient('sun', palette)}</defs>`
  let body = ''
  body += g(`filter="url(#sh)"`, crown(r, c, c, radius, palette, { clumps: 30 }))
  if (trunk) {
    body += g('opacity="0.55"', branches(r, c, c, radius, 7))
    body += circle(c, c, w * 0.045, 'hsl(28 30% 26%)')
  }
  if (blossom) {
    const parts = []
    for (let i = 0; i < 34; i++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * radius * 0.85
      const col = vary(r, blossom, 12, 10, 8)
      parts.push(circle(c + Math.cos(a) * d, c + Math.sin(a) * d, w * rand(r, 0.014, 0.03), css(col, 0.95)))
    }
    body += parts.join('')
  }
  body += `<circle cx="${n(c)}" cy="${n(c)}" r="${n(radius)}" fill="url(#sun)"/>`
  return svgDoc(w, w, body, defs)
}

/**
 * A tapered branch, drawn as a filled lens rather than a stroke so it narrows
 * to a point the way a real conifer branch does when seen from above.
 */
function branchFan(cx, cy, angle, inner, outer, width, curve, col) {
  const ca = Math.cos(angle)
  const sa = Math.sin(angle)
  // Perpendicular, for the half-width offsets.
  const px = -sa
  const py = ca
  const bx = cx + ca * inner
  const by = cy + sa * inner
  const tx = cx + ca * outer + px * curve
  const ty = cy + sa * outer + py * curve
  const mx = (bx + tx) / 2 + px * curve * 0.5
  const my = (by + ty) / 2 + py * curve * 0.5
  return (
    `<path d="M${n(bx + px * width)} ${n(by + py * width)}` +
    `Q${n(mx + px * width * 0.8)} ${n(my + py * width * 0.8)} ${n(tx)} ${n(ty)}` +
    `Q${n(mx - px * width * 0.8)} ${n(my - py * width * 0.8)} ${n(bx - px * width)} ${n(by - py * width)}Z" fill="${col}"/>`
  )
}

export function coniferTree({ seed, size, palette = PALETTES.conifer, tiers = 4 }) {
  const r = makeRandom(seed)
  const w = size
  const c = w / 2
  const defs = `<defs>${dropShadow('sh', w * 0.03, w * 0.04, w * 0.025, 0.32)}</defs>`
  const layers = []

  // Soft mass underneath, so gaps between branches do not show the ground.
  layers.push(path(blobPath(r, c, c, w * 0.42, 0.06, 15), css(shade(palette, -12))))

  // Outer tiers first: each successive tier is shorter and lighter, which is
  // what gives a top-down conifer its concentric, layered look.
  for (let t = 0; t < tiers; t++) {
    const frac = 1 - (t / tiers) * 0.72
    const outer = w * 0.47 * frac
    const inner = outer * 0.2
    const count = Math.max(7, Math.round(20 * frac))
    const col = css(shade(palette, -4 + t * 8))
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + t * 0.55 + rand(r, -0.05, 0.05)
      layers.push(
        branchFan(
          c,
          c,
          a,
          inner,
          outer * rand(r, 0.88, 1.02),
          outer * rand(r, 0.09, 0.14),
          outer * rand(r, -0.14, 0.14),
          col,
        ),
      )
    }
  }
  let body = g('filter="url(#sh)"', layers.join(''))
  body += circle(c, c, w * 0.04, css(shade(palette, 22)))
  return svgDoc(w, w, body, defs)
}

/** A palm or tree fern: a few broad, feathered fronds around a crown. */
export function palmTree({ seed, size, palette = { h: 132, s: 44, l: 34 }, fronds = 11 }) {
  const r = makeRandom(seed)
  const w = size
  const c = w / 2
  const defs = `<defs>${dropShadow('sh', w * 0.03, w * 0.04, w * 0.03, 0.3)}</defs>`
  const parts = []
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rand(r, -0.1, 0.1)
    const len = w * rand(r, 0.36, 0.48)
    const curve = len * rand(r, -0.22, 0.22)
    const col = vary(r, palette, 10, 10, 10)
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    // Leaflets along both sides of the rib.
    const leaflets = []
    const steps = 9
    for (let k = 1; k <= steps; k++) {
      const t = k / steps
      const d = len * t
      const bx = c + ca * d - sa * curve * t * t
      const by = c + sa * d + ca * curve * t * t
      const lw = len * 0.3 * Math.sin(t * Math.PI) ** 0.6
      for (const side of [-1, 1]) {
        const la = a + side * 1.0
        leaflets.push(
          `<path d="M${n(bx)} ${n(by)}Q${n(bx + Math.cos(la) * lw * 0.7 + ca * lw * 0.3)} ${n(by + Math.sin(la) * lw * 0.7 + sa * lw * 0.3)} ${n(bx + Math.cos(la) * lw * 0.35 + ca * lw * 0.9)} ${n(by + Math.sin(la) * lw * 0.35 + sa * lw * 0.9)}" stroke="${css(col)}" stroke-width="${n(len * 0.055)}" fill="none" stroke-linecap="round"/>`,
        )
      }
    }
    parts.push(leaflets.join(''))
    parts.push(
      `<path d="M${n(c)} ${n(c)}Q${n(c + ca * len * 0.5 - sa * curve * 0.25)} ${n(c + sa * len * 0.5 + ca * curve * 0.25)} ${n(c + ca * len - sa * curve)} ${n(c + sa * len + ca * curve)}" stroke="${css(shade(col, -8))}" stroke-width="${n(len * 0.05)}" fill="none" stroke-linecap="round"/>`,
    )
  }
  parts.push(circle(c, c, w * 0.06, css(shade(palette, -14))))
  return svgDoc(w, w, g('filter="url(#sh)"', parts.join('')), defs)
}

export function shrub({ seed, size, palette = PALETTES.lightGreen, flowers = null }) {
  const r = makeRandom(seed)
  const w = size
  const c = w / 2
  const defs = `<defs>${dropShadow('sh', w * 0.03, w * 0.04, w * 0.03, 0.26)}</defs>`
  let body = g(
    'filter="url(#sh)"',
    crown(r, c, c, w * 0.46, palette, { clumps: 18, clumpScale: 0.4, spread: 0.6, wobble: 0.34 }),
  )
  if (flowers) {
    const parts = []
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * w * 0.4
      parts.push(
        circle(c + Math.cos(a) * d, c + Math.sin(a) * d, w * rand(r, 0.02, 0.042), css(vary(r, flowers, 14, 10, 10))),
      )
    }
    body += parts.join('')
  }
  return svgDoc(w, w, body, defs)
}

/**
 * A rectangular clipped hedge, drawn as dense foliage inside a soft box.
 * `clump` is the foliage scale in px; keeping it absolute rather than relative
 * to the box means a 4 m hedge costs four times a 1 m one, not sixteen.
 */
export function hedge({ seed, width, height, palette = PALETTES.darkGreen, clump = 14 }) {
  const r = makeRandom(seed)
  const radius = Math.min(height, width) * 0.1
  const defs = `<defs>${dropShadow('sh', 2, 3, 2.4, 0.3)}<clipPath id="clip"><rect x="1" y="1" width="${n(width - 2)}" height="${n(height - 2)}" rx="${n(radius)}"/></clipPath></defs>`
  const parts = [`<rect x="1" y="1" width="${n(width - 2)}" height="${n(height - 2)}" rx="${n(radius)}" fill="${css(shade(palette, -8))}"/>`]
  const step = clump
  for (let y = 0; y < height + step; y += step) {
    for (let x = 0; x < width + step; x += step) {
      const cx = x + rand(r, -step * 0.35, step * 0.35)
      const cy = y + rand(r, -step * 0.35, step * 0.35)
      // Crown of the hedge catches the light; the near edge falls into shadow.
      const lit = 1 - Math.abs(cy / height - 0.38) * 1.6
      parts.push(path(blobPath(r, cx, cy, step * rand(r, 0.5, 0.78), 0.3, 6), css(vary(r, shade(palette, lit * 18), 8, 6, 5))))
    }
  }
  const body = g('filter="url(#sh)"', g('clip-path="url(#clip)"', parts.join('')))
  return svgDoc(width, height, body, defs)
}

/**
 * Ornamental grass. Blades are filled tapers rather than constant-width
 * strokes — a stroked radial burst reads as a spider, a tapered one as foliage.
 */
export function grassTuft({ seed, size, palette = PALETTES.olive, blades = 64 }) {
  const r = makeRandom(seed)
  const w = size
  const c = w / 2
  const defs = `<defs>${dropShadow('sh', w * 0.025, w * 0.03, w * 0.025, 0.22)}</defs>`
  const parts = []

  // Shadowed mass at the base keeps the centre from looking hollow.
  parts.push(path(blobPath(r, c, c, w * 0.17, 0.25, 9), css(shade(palette, -18))))

  const items = []
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + rand(r, -0.12, 0.12)
    const len = w * rand(r, 0.26, 0.47)
    items.push({ a, len, bend: rand(r, -0.45, 0.45), col: vary(r, palette, 12, 12, 16) })
  }
  // Longest blades at the back so the tuft has some depth.
  items.sort((x, y) => y.len - x.len)

  for (const { a, len, bend, col } of items) {
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const tipX = c + ca * len - sa * bend * len * 0.4
    const tipY = c + sa * len + ca * bend * len * 0.4
    const midX = c + ca * len * 0.5 - sa * bend * len * 0.14
    const midY = c + sa * len * 0.5 + ca * bend * len * 0.14
    const halfW = w * rand(r, 0.016, 0.03)
    parts.push(
      `<path d="M${n(c - sa * halfW)} ${n(c + ca * halfW)}` +
        `Q${n(midX - sa * halfW * 0.55)} ${n(midY + ca * halfW * 0.55)} ${n(tipX)} ${n(tipY)}` +
        `Q${n(midX + sa * halfW * 0.55)} ${n(midY - ca * halfW * 0.55)} ${n(c + sa * halfW)} ${n(c - ca * halfW)}Z" fill="${css(col)}"/>`,
    )
  }
  parts.push(circle(c, c, w * 0.045, css(shade(palette, -22))))
  return svgDoc(w, w, g('filter="url(#sh)"', parts.join('')), defs)
}

/** A drift of flowers: a green mat with coloured heads scattered over it. */
export function flowerBed({ seed, width, height, bloom, foliage = PALETTES.lightGreen, count = 40 }) {
  const r = makeRandom(seed)
  const defs = `<defs>${dropShadow('sh', 1.5, 2, 2, 0.22)}</defs>`
  const parts = []
  const rx = width / 2
  const ry = height / 2
  // The mat has to follow the bed's own proportions: a 3 x 1.2 m border is an
  // ellipse, not a circle inscribed in its short side.
  parts.push(path(blobPath(r, rx, ry, rx * 0.95, 0.13, 13, ry / rx), css(shade(foliage, -14))))
  // Foliage and flower scale come off the short axis, which is what actually
  // sets how big an individual plant looks in the bed.
  const clump = Math.min(rx, ry)
  for (let i = 0; i < count * 1.4; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r())
    const x = rx + Math.cos(a) * d * rx * 0.85
    const y = ry + Math.sin(a) * d * ry * 0.85
    parts.push(path(blobPath(r, x, y, clump * rand(r, 0.22, 0.42), 0.3, 6), css(vary(r, foliage, 10, 8, 8))))
  }
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r())
    const x = rx + Math.cos(a) * d * rx * 0.82
    const y = ry + Math.sin(a) * d * ry * 0.82
    const rr = clump * rand(r, 0.12, 0.22)
    const col = vary(r, bloom, 14, 8, 8)
    // Five petals plus a centre reads as a flower even at 12 px.
    const petals = []
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * Math.PI * 2 + r()
      petals.push(circle(x + Math.cos(pa) * rr * 0.6, y + Math.sin(pa) * rr * 0.6, rr * 0.62, css(col)))
    }
    parts.push(petals.join(''), circle(x, y, rr * 0.38, css(shade({ h: 48, s: 80, l: 60 }, 0))))
  }
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

/** A plant in a pot, seen from above: rim ring plus a small crown. */
export function pottedPlant({ seed, size, potColor = { h: 18, s: 45, l: 48 }, palette = PALETTES.lightGreen }) {
  const r = makeRandom(seed)
  const w = size
  const c = w / 2
  const defs = `<defs>${dropShadow('sh', w * 0.03, w * 0.04, w * 0.03, 0.3)}</defs>`
  let body = ''
  body += g(
    'filter="url(#sh)"',
    circle(c, c, w * 0.47, css(shade(potColor, -10))) + circle(c, c, w * 0.4, css(potColor)) + circle(c, c, w * 0.35, css(shade(potColor, -16))),
  )
  body += circle(c, c, w * 0.33, 'hsl(28 32% 22%)')
  body += crown(r, c, c, w * 0.32, palette, { clumps: 11, clumpScale: 0.42, spread: 0.55 })
  return svgDoc(w, w, body, defs)
}

/** Vegetable bed: a timber frame with rows of small plants. */
export function vegBed({ seed, width, height, rows = 4 }) {
  const r = makeRandom(seed)
  const defs = `<defs>${dropShadow('sh', 2, 2.5, 2, 0.28)}</defs>`
  const frame = { h: 30, s: 32, l: 40 }
  const soil = { h: 26, s: 34, l: 26 }
  const border = Math.min(width, height) * 0.07
  const parts = [
    `<rect x="0" y="0" width="${n(width)}" height="${n(height)}" rx="${n(border)}" fill="${css(frame)}"/>`,
    `<rect x="${n(border)}" y="${n(border)}" width="${n(width - border * 2)}" height="${n(height - border * 2)}" fill="${css(soil)}"/>`,
  ]
  for (let i = 0; i < 90; i++) {
    parts.push(
      circle(rand(r, border, width - border), rand(r, border, height - border), rand(r, 0.6, 1.8), css(shade(soil, rand(r, -8, 10)), 0.8)),
    )
  }
  const rowH = (height - border * 2) / rows
  for (let row = 0; row < rows; row++) {
    const y = border + rowH * (row + 0.5)
    const perRow = Math.max(2, Math.round((width - border * 2) / (rowH * 0.9)))
    for (let i = 0; i < perRow; i++) {
      const x = border + ((i + 0.5) * (width - border * 2)) / perRow
      const rr = rowH * rand(r, 0.26, 0.36)
      const col = vary(r, PALETTES.lightGreen, 16, 12, 10)
      const leaves = []
      for (let l = 0; l < 6; l++) {
        const a = (l / 6) * Math.PI * 2 + r()
        leaves.push(ellipse(x + Math.cos(a) * rr * 0.5, y + Math.sin(a) * rr * 0.5, rr * 0.5, rr * 0.32, css(col), `transform="rotate(${n((a * 180) / Math.PI)} ${n(x + Math.cos(a) * rr * 0.5)} ${n(y + Math.sin(a) * rr * 0.5)})"`))
      }
      parts.push(leaves.join(''))
    }
  }
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

/** Climbers on a trellis, or a single stylised leafy column. */
export function climber({ seed, width, height, palette = PALETTES.darkGreen }) {
  const r = makeRandom(seed)
  const defs = `<defs>${dropShadow('sh', 1.5, 2, 1.8, 0.24)}</defs>`
  const parts = []
  parts.push(`<rect x="0" y="${n(height * 0.36)}" width="${n(width)}" height="${n(height * 0.28)}" fill="hsl(34 28% 46%)"/>`)
  const step = height * 0.4
  for (let x = 0; x < width; x += step) {
    parts.push(
      path(blobPath(r, x + rand(r, 0, step), height / 2 + rand(r, -height * 0.18, height * 0.18), height * rand(r, 0.26, 0.42), 0.3, 8), css(vary(r, palette, 12, 10, 12))),
    )
  }
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

export { crown, PALETTES as palettes, pick, closedSpline }
