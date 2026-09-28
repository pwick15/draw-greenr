/** Top-down artwork for built form, furniture, water and leisure items. */
import {
  blobPath,
  circle,
  css,
  dropShadow,
  ellipse,
  g,
  line,
  makeRandom,
  n,
  path,
  polygonPath,
  rand,
  rect,
  rrect,
  shade,
  svgDoc,
  vary,
} from './svg.mjs'

const WOOD = { h: 32, s: 46, l: 58 }
const DARK_WOOD = { h: 26, s: 34, l: 38 }
const METAL = { h: 210, s: 6, l: 58 }
const SLATE = { h: 215, s: 8, l: 42 }
const FABRIC = { h: 8, s: 52, l: 52 }

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

/**
 * A house seen from above: roof plane, ridge, eaves shadow and a skylight.
 * `roof` drives the whole palette so one generator covers every variant.
 */
export function house({ width, height, roof, ridge = 'gable', skylight = true }) {
  const defs = `<defs>${dropShadow('sh', 3, 4, 3.4, 0.34)}</defs>`
  const inset = Math.min(width, height) * 0.045
  const parts = []
  parts.push(`<path d="${rrect(0, 0, width, height, Math.min(width, height) * 0.025)}" fill="${css(shade(roof, -14))}"/>`)
  parts.push(`<path d="${rrect(inset, inset, width - inset * 2, height - inset * 2, Math.min(width, height) * 0.015)}" fill="${css(roof)}"/>`)

  // Roof tile striations, running with the slope.
  const along = width >= height
  const count = Math.round((along ? height : width) / (Math.min(width, height) * 0.09))
  for (let i = 1; i < count; i++) {
    const t = i / count
    if (along) parts.push(line(inset, inset + (height - inset * 2) * t, width - inset, inset + (height - inset * 2) * t, css(shade(roof, -8), 0.5), Math.min(width, height) * 0.006))
    else parts.push(line(inset + (width - inset * 2) * t, inset, inset + (width - inset * 2) * t, height - inset, css(shade(roof, -8), 0.5), Math.min(width, height) * 0.006))
  }

  if (ridge === 'gable') {
    // Ridge line down the long axis, with the two roof planes shaded apart.
    if (along) {
      parts.push(rect(inset, inset, width - inset * 2, (height - inset * 2) / 2, css(shade(roof, 7), 0.55)))
      parts.push(line(inset, height / 2, width - inset, height / 2, css(shade(roof, -22)), Math.min(width, height) * 0.02))
    } else {
      parts.push(rect(inset, inset, (width - inset * 2) / 2, height - inset * 2, css(shade(roof, 7), 0.55)))
      parts.push(line(width / 2, inset, width / 2, height - inset, css(shade(roof, -22)), Math.min(width, height) * 0.02))
    }
  } else if (ridge === 'hip') {
    const cx = width / 2
    const cy = height / 2
    const k = Math.min(width, height) * 0.22
    parts.push(path(polygonPath([[inset, inset], [width - inset, inset], [cx + k, cy - k], [cx - k, cy - k]]), css(shade(roof, 8), 0.5)))
    parts.push(path(polygonPath([[inset, height - inset], [width - inset, height - inset], [cx + k, cy + k], [cx - k, cy + k]]), css(shade(roof, -8), 0.4)))
    parts.push(line(cx - k, cy - k, cx + k, cy - k, css(shade(roof, -22)), Math.min(width, height) * 0.015))
  }

  if (skylight) {
    const sw = Math.min(width, height) * 0.18
    parts.push(`<path d="${rrect(width * 0.62, height * 0.55, sw * 1.3, sw, sw * 0.12)}" fill="hsl(196 62% 62%)"/>`)
    parts.push(`<path d="${rrect(width * 0.62, height * 0.55, sw * 1.3, sw, sw * 0.12)}" fill="none" stroke="${css(shade(roof, -26))}" stroke-width="${n(sw * 0.1)}"/>`)
  }
  // Chimney
  const chw = Math.min(width, height) * 0.13
  parts.push(`<path d="${rrect(width * 0.18, height * 0.2, chw, chw * 1.2, chw * 0.14)}" fill="${css(shade(roof, -30))}"/>`)
  parts.push(`<path d="${rrect(width * 0.18 + chw * 0.15, height * 0.2 + chw * 0.15, chw * 0.7, chw * 0.9, chw * 0.1)}" fill="hsl(0 0% 18%)"/>`)

  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

/** Decking / terrace: planks with a subtle grain and a rim board. */
export function decking({ seed, width, height, tone = WOOD, plankMeters = 0.16, ppm = 64 }) {
  const r = makeRandom(seed)
  const defs = `<defs>${dropShadow('sh', 1.5, 2, 1.6, 0.2)}</defs>`
  const parts = [rect(0, 0, width, height, css(shade(tone, -12)))]
  const plank = plankMeters * ppm
  for (let y = 0; y < height; y += plank) {
    const h = Math.min(plank, height - y) - 1
    parts.push(rect(1, y + 0.5, width - 2, Math.max(1, h), css(vary(r, tone, 4, 6, 4))))
    for (let i = 0; i < 3; i++) {
      const gx = rand(r, 2, width - 4)
      parts.push(ellipse(gx, y + h / 2, rand(r, 4, 14), Math.max(0.4, h * 0.12), css(shade(tone, -9), 0.5)))
    }
  }
  parts.push(`<rect x="0.5" y="0.5" width="${n(width - 1)}" height="${n(height - 1)}" fill="none" stroke="${css(shade(tone, -22))}" stroke-width="1.5"/>`)
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

/** A straight run of fence: posts plus rails. */
export function fence({ width, height, tone = DARK_WOOD, posts = 6 }) {
  const parts = []
  const railH = height * 0.16
  parts.push(rect(0, height * 0.28, width, railH, css(tone)))
  parts.push(rect(0, height * 0.58, width, railH, css(shade(tone, -6))))
  for (let i = 0; i < posts; i++) {
    const x = (i / (posts - 1)) * (width - height * 0.36)
    parts.push(`<path d="${rrect(x, height * 0.18, height * 0.36, height * 0.64, height * 0.08)}" fill="${css(shade(tone, 8))}"/>`)
  }
  const defs = `<defs>${dropShadow('sh', 1, 1.6, 1.2, 0.3)}</defs>`
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

/** A low wall run, drawn as coursed blocks. */
export function wallRun({ seed, width, height, tone = { h: 36, s: 10, l: 62 } }) {
  const r = makeRandom(seed)
  const parts = [rect(0, 0, width, height, css(shade(tone, -14)))]
  const bw = height * 0.9
  let offset = 0
  for (let y = 0; y < height; y += height / 2) {
    for (let x = -bw; x < width + bw; x += bw) {
      parts.push(rect(x + offset + 0.6, y + 0.6, bw - 1.2, height / 2 - 1.2, css(vary(r, tone, 6, 4, 7))))
    }
    offset = offset === 0 ? bw / 2 : 0
  }
  const defs = `<defs>${dropShadow('sh', 1, 1.6, 1.2, 0.3)}</defs>`
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

/** Stairs: a run of treads, narrowing option for a curved flight. */
export function stairs({ width, height, treads = 5, tone = SLATE, fan = false }) {
  const parts = [rect(0, 0, width, height, css(shade(tone, -12)))]
  for (let i = 0; i < treads; i++) {
    const t = i / treads
    const h = height / treads
    const inset = fan ? (width * 0.18 * (1 - t)) : 0
    parts.push(rect(inset, t * height + 1, width - inset * 2, h - 2, css(shade(tone, 6 + i * 2))))
  }
  const defs = `<defs>${dropShadow('sh', 1.5, 2, 1.6, 0.28)}</defs>`
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

/** Shed or greenhouse: a small pitched roof box. */
export function shed({ width, height, roof = { h: 8, s: 30, l: 40 }, glass = false }) {
  const defs = `<defs>${dropShadow('sh', 2, 2.8, 2.2, 0.32)}</defs>`
  const parts = [`<path d="${rrect(0, 0, width, height, 2)}" fill="${css(shade(roof, -16))}"/>`]
  parts.push(rect(2, 2, width - 4, (height - 4) / 2, css(glass ? { h: 192, s: 40, l: 72 } : shade(roof, 6), glass ? 0.9 : 1)))
  parts.push(rect(2, height / 2, width - 4, (height - 4) / 2, css(glass ? { h: 192, s: 34, l: 62 } : shade(roof, -6), glass ? 0.9 : 1)))
  parts.push(line(2, height / 2, width - 2, height / 2, css(shade(roof, -30)), 2))
  if (glass) {
    const bays = Math.max(2, Math.round(width / (height * 0.5)))
    for (let i = 1; i < bays; i++) {
      parts.push(line((i / bays) * width, 2, (i / bays) * width, height - 2, 'hsl(200 12% 92% / 0.85)', 1.6))
    }
  }
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------

function chairTop(x, y, s, tone, angle = 0) {
  const body =
    `<path d="${rrect(-s * 0.4, -s * 0.44, s * 0.8, s * 0.7, s * 0.1)}" fill="${css(tone)}"/>` +
    `<path d="${rrect(-s * 0.44, -s * 0.5, s * 0.88, s * 0.2, s * 0.08)}" fill="${css(shade(tone, -14))}"/>`
  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)})">${body}</g>`
}

export function diningSet({ width, height, shape = 'rect', seats = 6, tone = WOOD }) {
  const defs = `<defs>${dropShadow('sh', 2, 2.6, 2.2, 0.3)}</defs>`
  const cx = width / 2
  const cy = height / 2
  const parts = []
  const chairS = Math.min(width, height) * 0.24

  if (shape === 'round') {
    const tr = Math.min(width, height) * 0.3
    for (let i = 0; i < seats; i++) {
      const a = (i / seats) * 360
      const rad = (a * Math.PI) / 180
      parts.push(chairTop(cx + Math.cos(rad) * (tr + chairS * 0.62), cy + Math.sin(rad) * (tr + chairS * 0.62), chairS, tone, a + 90))
    }
    parts.push(circle(cx, cy, tr, css(shade(tone, -12))))
    parts.push(circle(cx, cy, tr * 0.93, css(tone)))
    parts.push(circle(cx, cy, tr * 0.16, css(shade(tone, -18))))
  } else {
    const tw = width * 0.52
    const th = height * 0.54
    const perSide = Math.ceil(seats / 2)
    for (let i = 0; i < perSide; i++) {
      const t = (i + 0.5) / perSide
      parts.push(chairTop(cx - tw / 2 + tw * t, cy - th / 2 - chairS * 0.6, chairS, tone, 180))
      if (i * 2 + 1 < seats) parts.push(chairTop(cx - tw / 2 + tw * t, cy + th / 2 + chairS * 0.6, chairS, tone, 0))
    }
    parts.push(`<path d="${rrect(cx - tw / 2, cy - th / 2, tw, th, Math.min(tw, th) * 0.06)}" fill="${css(shade(tone, -12))}"/>`)
    parts.push(`<path d="${rrect(cx - tw / 2 + 2, cy - th / 2 + 2, tw - 4, th - 4, Math.min(tw, th) * 0.05)}" fill="${css(tone)}"/>`)
    const planks = Math.max(3, Math.round(th / (Math.min(tw, th) * 0.18)))
    for (let i = 1; i < planks; i++) {
      parts.push(line(cx - tw / 2 + 3, cy - th / 2 + (th * i) / planks, cx + tw / 2 - 3, cy - th / 2 + (th * i) / planks, css(shade(tone, -10), 0.6), 1.2))
    }
  }
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

export function bench({ width, height, tone = WOOD }) {
  const defs = `<defs>${dropShadow('sh', 1.6, 2.2, 1.8, 0.3)}</defs>`
  const parts = [
    `<path d="${rrect(0, height * 0.3, width, height * 0.62, height * 0.08)}" fill="${css(shade(tone, -12))}"/>`,
  ]
  const slats = 4
  for (let i = 0; i < slats; i++) {
    const y = height * 0.33 + (i * height * 0.58) / slats
    parts.push(`<path d="${rrect(width * 0.02, y, width * 0.96, (height * 0.58) / slats - 2, 1.5)}" fill="${css(vary(makeRandom(i), tone, 3, 4, 3))}"/>`)
  }
  parts.push(`<path d="${rrect(0, height * 0.06, width, height * 0.2, height * 0.06)}" fill="${css(shade(tone, -20))}"/>`)
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

export function lounger({ width, height, tone = FABRIC }) {
  const defs = `<defs>${dropShadow('sh', 1.6, 2.2, 1.8, 0.3)}</defs>`
  const parts = [
    `<path d="${rrect(0, 0, width, height, width * 0.2)}" fill="${css(shade(METAL, -8))}"/>`,
    `<path d="${rrect(width * 0.08, height * 0.05, width * 0.84, height * 0.9, width * 0.16)}" fill="${css(tone)}"/>`,
  ]
  for (let i = 1; i < 7; i++) {
    parts.push(line(width * 0.1, (height * i) / 7, width * 0.9, (height * i) / 7, css(shade(tone, -12), 0.5), 1.2))
  }
  parts.push(`<path d="${rrect(width * 0.12, height * 0.03, width * 0.76, height * 0.2, width * 0.14)}" fill="${css(shade(tone, 10))}"/>`)
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

export function parasol({ size, tone = { h: 42, s: 40, l: 72 }, panels = 8 }) {
  const c = size / 2
  const defs = `<defs>${dropShadow('sh', 2.5, 3.2, 2.6, 0.32)}</defs>`
  const parts = []
  for (let i = 0; i < panels; i++) {
    const a0 = (i / panels) * Math.PI * 2
    const a1 = ((i + 1) / panels) * Math.PI * 2
    const col = i % 2 === 0 ? tone : shade(tone, -9)
    parts.push(
      `<path d="M${n(c)} ${n(c)}L${n(c + Math.cos(a0) * c * 0.94)} ${n(c + Math.sin(a0) * c * 0.94)}A${n(c * 0.94)} ${n(c * 0.94)} 0 0 1 ${n(c + Math.cos(a1) * c * 0.94)} ${n(c + Math.sin(a1) * c * 0.94)}Z" fill="${css(col)}"/>`,
    )
  }
  parts.push(circle(c, c, size * 0.07, css(shade(METAL, -14))))
  return svgDoc(size, size, g('filter="url(#sh)"', parts.join('')), defs)
}

export function grill({ width, height }) {
  const defs = `<defs>${dropShadow('sh', 1.6, 2.2, 1.8, 0.32)}</defs>`
  const parts = [
    `<path d="${rrect(0, 0, width, height, Math.min(width, height) * 0.16)}" fill="hsl(0 0% 22%)"/>`,
    `<path d="${rrect(width * 0.06, height * 0.08, width * 0.88, height * 0.84, Math.min(width, height) * 0.12)}" fill="hsl(0 0% 34%)"/>`,
  ]
  const bars = 9
  for (let i = 0; i < bars; i++) {
    const y = height * 0.14 + (i * height * 0.72) / (bars - 1)
    parts.push(line(width * 0.11, y, width * 0.89, y, 'hsl(0 0% 58%)', Math.max(1, height * 0.035)))
  }
  parts.push(`<path d="${rrect(width * 0.3, -height * 0.07, width * 0.4, height * 0.1, height * 0.05)}" fill="hsl(0 0% 28%)"/>`)
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

export function trampoline({ size }) {
  const c = size / 2
  const defs = `<defs>${dropShadow('sh', 2.5, 3.2, 2.8, 0.3)}</defs>`
  const parts = [
    circle(c, c, c * 0.98, 'hsl(214 22% 30%)'),
    circle(c, c, c * 0.86, 'hsl(214 14% 20%)'),
    circle(c, c, c * 0.72, 'hsl(214 10% 14%)'),
  ]
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2
    parts.push(line(c + Math.cos(a) * c * 0.73, c + Math.sin(a) * c * 0.73, c + Math.cos(a) * c * 0.85, c + Math.sin(a) * c * 0.85, 'hsl(210 8% 62%)', size * 0.012))
  }
  return svgDoc(size, size, g('filter="url(#sh)"', parts.join('')), defs)
}

export function sandbox({ seed, width, height }) {
  const r = makeRandom(seed)
  const defs = `<defs>${dropShadow('sh', 1.6, 2.2, 1.8, 0.28)}</defs>`
  const frame = Math.min(width, height) * 0.1
  const parts = [
    `<path d="${rrect(0, 0, width, height, frame * 0.5)}" fill="${css(WOOD)}"/>`,
    rect(frame, frame, width - frame * 2, height - frame * 2, 'hsl(44 58% 76%)'),
  ]
  for (let i = 0; i < 120; i++) {
    parts.push(circle(rand(r, frame, width - frame), rand(r, frame, height - frame), rand(r, 0.5, 1.6), `hsl(${n(rand(r, 38, 48))} 50% ${n(rand(r, 64, 84))}%)`))
  }
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

export function playhouse({ width, height }) {
  return house({ seed: 'playhouse', width, height, roof: { h: 6, s: 52, l: 48 }, ridge: 'gable', skylight: false })
}

export function car({ width, height, tone = { h: 210, s: 40, l: 48 } }) {
  const defs = `<defs>${dropShadow('sh', 2, 2.6, 2.2, 0.34)}</defs>`
  const parts = [
    `<path d="${rrect(width * 0.06, 0, width * 0.88, height, width * 0.22)}" fill="${css(tone)}"/>`,
    `<path d="${rrect(width * 0.2, height * 0.12, width * 0.6, height * 0.34, width * 0.1)}" fill="hsl(206 24% 26%)"/>`,
    `<path d="${rrect(width * 0.18, height * 0.56, width * 0.64, height * 0.3, width * 0.1)}" fill="hsl(206 24% 30%)"/>`,
    `<path d="${rrect(0, height * 0.18, width * 0.08, height * 0.18, width * 0.03)}" fill="hsl(0 0% 18%)"/>`,
    `<path d="${rrect(0, height * 0.64, width * 0.08, height * 0.18, width * 0.03)}" fill="hsl(0 0% 18%)"/>`,
    `<path d="${rrect(width * 0.92, height * 0.18, width * 0.08, height * 0.18, width * 0.03)}" fill="hsl(0 0% 18%)"/>`,
    `<path d="${rrect(width * 0.92, height * 0.64, width * 0.08, height * 0.18, width * 0.03)}" fill="hsl(0 0% 18%)"/>`,
  ]
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

export function pond({ seed, width, height, natural = true }) {
  const r = makeRandom(seed)
  const defs = `<defs>${dropShadow('sh', 1.5, 2, 2.2, 0.2)}<radialGradient id="wg" cx="38%" cy="32%" r="70%"><stop offset="0%" stop-color="hsl(192 62% 66%)"/><stop offset="100%" stop-color="hsl(200 52% 40%)"/></radialGradient></defs>`
  const rx = width / 2
  const ry = height / 2
  const parts = []
  const outline = natural
    ? blobPath(r, rx, ry, Math.min(rx, ry) * 0.95, 0.16, 12, ry / rx > 1 ? 1 : 1)
    : `M0 0H${n(width)}V${n(height)}H0Z`
  // Stone/planting margin, then water.
  parts.push(`<path d="${outline}" fill="hsl(80 16% 46%)" transform="translate(${n(rx)} ${n(ry)}) scale(1.06) translate(${n(-rx)} ${n(-ry)})"/>`)
  parts.push(`<path d="${outline}" fill="url(#wg)"/>`)
  for (let i = 0; i < 8; i++) {
    const y = ry + rand(r, -ry * 0.7, ry * 0.7)
    const w = rand(r, rx * 0.2, rx * 0.7)
    const x = rx + rand(r, -rx * 0.4, rx * 0.4)
    parts.push(`<path d="M${n(x - w / 2)} ${n(y)}q${n(w * 0.25)} ${n(-height * 0.035)} ${n(w * 0.5)} 0t${n(w * 0.5)} 0" stroke="hsl(190 60% 84% / 0.5)" stroke-width="${n(Math.min(width, height) * 0.016)}" fill="none" stroke-linecap="round"/>`)
  }
  if (natural) {
    for (let i = 0; i < 7; i++) {
      const a = r() * Math.PI * 2
      const d = rand(r, 0.35, 0.8)
      const px = rx + Math.cos(a) * rx * d
      const py = ry + Math.sin(a) * ry * d
      const lr = Math.min(rx, ry) * rand(r, 0.08, 0.15)
      parts.push(`<path d="${blobPath(r, px, py, lr, 0.12, 9)}" fill="hsl(126 40% 40%)"/>`)
      parts.push(`<path d="M${n(px)} ${n(py)}L${n(px + lr)} ${n(py)}" stroke="hsl(200 52% 40%)" stroke-width="${n(lr * 0.22)}"/>`)
    }
  }
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

export function pool({ width, height, round = false }) {
  const defs = `<defs>${dropShadow('sh', 2, 2.6, 2.4, 0.26)}<linearGradient id="pw" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0%" stop-color="hsl(192 74% 62%)"/><stop offset="100%" stop-color="hsl(200 68% 44%)"/></linearGradient></defs>`
  const parts = []
  const rr = round ? Math.min(width, height) / 2 : Math.min(width, height) * 0.06
  parts.push(`<path d="${rrect(0, 0, width, height, rr)}" fill="hsl(36 14% 84%)"/>`)
  const m = Math.min(width, height) * 0.08
  parts.push(`<path d="${rrect(m, m, width - m * 2, height - m * 2, Math.max(0, rr - m))}" fill="url(#pw)"/>`)
  for (let i = 1; i < 5; i++) {
    parts.push(line(m * 1.6, m + ((height - m * 2) * i) / 5, width - m * 1.6, m + ((height - m * 2) * i) / 5, 'hsl(196 60% 86% / 0.45)', Math.min(width, height) * 0.02))
  }
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

// ---------------------------------------------------------------------------
// Ground details
// ---------------------------------------------------------------------------

export function steppingStones({ seed, width, height, count = 5 }) {
  const r = makeRandom(seed)
  const parts = []
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const x = width * t
    const y = height / 2 + rand(r, -height * 0.16, height * 0.16)
    const rr = Math.min(width / count, height) * rand(r, 0.3, 0.4)
    parts.push(`<path d="${blobPath(r, x, y, rr, 0.16, 8)}" fill="hsl(36 8% ${n(rand(r, 58, 70))}%)"/>`)
  }
  const defs = `<defs>${dropShadow('sh', 0.8, 1.2, 1, 0.28)}</defs>`
  return svgDoc(width, height, g('filter="url(#sh)"', parts.join('')), defs)
}

export function firepit({ size }) {
  const c = size / 2
  const r = makeRandom('firepit')
  const parts = [circle(c, c, c * 0.96, 'hsl(30 8% 52%)'), circle(c, c, c * 0.74, 'hsl(24 14% 24%)')]
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    parts.push(`<path d="${blobPath(r, c + Math.cos(a) * c * 0.85, c + Math.sin(a) * c * 0.85, c * 0.16, 0.2, 7)}" fill="hsl(32 10% ${n(rand(r, 52, 68))}%)"/>`)
  }
  parts.push(circle(c, c, c * 0.34, 'hsl(18 70% 48%)'))
  parts.push(circle(c, c, c * 0.2, 'hsl(42 92% 60%)'))
  const defs = `<defs>${dropShadow('sh', 1.4, 1.8, 1.6, 0.3)}</defs>`
  return svgDoc(size, size, g('filter="url(#sh)"', parts.join('')), defs)
}

export function birdbath({ size }) {
  const c = size / 2
  const parts = [
    circle(c, c, c * 0.96, 'hsl(30 6% 66%)'),
    circle(c, c, c * 0.8, 'hsl(30 6% 78%)'),
    circle(c, c, c * 0.62, 'hsl(196 46% 60%)'),
    circle(c, c, c * 0.2, 'hsl(30 6% 72%)'),
  ]
  const defs = `<defs>${dropShadow('sh', 1.2, 1.6, 1.4, 0.3)}</defs>`
  return svgDoc(size, size, g('filter="url(#sh)"', parts.join('')), defs)
}

export function compost({ size }) {
  const parts = [
    `<path d="${rrect(0, 0, size, size, size * 0.08)}" fill="hsl(120 16% 28%)"/>`,
    `<path d="${rrect(size * 0.08, size * 0.08, size * 0.84, size * 0.84, size * 0.05)}" fill="hsl(28 26% 22%)"/>`,
  ]
  const r = makeRandom('compost')
  for (let i = 0; i < 40; i++) {
    parts.push(circle(rand(r, size * 0.12, size * 0.88), rand(r, size * 0.12, size * 0.88), rand(r, 1, 3), `hsl(${n(rand(r, 20, 60))} ${n(rand(r, 20, 50))}% ${n(rand(r, 22, 42))}%)`))
  }
  const defs = `<defs>${dropShadow('sh', 1.4, 1.8, 1.6, 0.3)}</defs>`
  return svgDoc(size, size, g('filter="url(#sh)"', parts.join('')), defs)
}

export { WOOD, DARK_WOOD, METAL, SLATE, FABRIC }
