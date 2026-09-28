/**
 * Seamlessly tileable ground textures.
 *
 * Every scattered element is emitted up to four times, wrapped across the tile
 * edges, so the pattern repeats without a visible seam. Konva tiles these with
 * `fillPatternRepeat: 'repeat'`, which means a whole lawn — however large — is
 * a single fill.
 */
import { blobPath, circle, css, ellipse, line, makeRandom, n, path, polygonPath, rand, rect, shade, svgDoc, vary } from './svg.mjs'

/** Emit `draw(x, y)` for every wrapped position that can touch the tile. */
function wrapped(size, x, y, radius, draw) {
  const out = []
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) {
      const px = x + dx
      const py = y + dy
      if (px + radius < 0 || px - radius > size || py + radius < 0 || py - radius > size) continue
      out.push(draw(px, py))
    }
  }
  return out.join('')
}

/**
 * Wrap tile contents in a clip at the tile bounds. Wrapped copies deliberately
 * overhang the edges; the viewBox clips them when rasterised anyway, but an
 * explicit clip makes that true in every renderer.
 */
function tileDoc(size, parts) {
  const defs = `<defs><clipPath id="tile"><rect width="${n(size)}" height="${n(size)}"/></clipPath></defs>`
  return svgDoc(size, size, `<g clip-path="url(#tile)">${parts}</g>`, defs)
}

export function lawn({ size, seed = 'lawn', base = { h: 96, s: 48, l: 46 } }) {
  const r = makeRandom(seed)
  const parts = [rect(0, 0, size, size, css(base))]
  // Broad mown bands first.
  for (let i = 0; i < 4; i++) {
    parts.push(rect(0, (i * size) / 4, size, size / 8, css(shade(base, 4), 0.5)))
  }
  // Leafy clumps give it the hand-drawn look a flat green never has.
  for (let i = 0; i < 46; i++) {
    const x = r() * size
    const y = r() * size
    const rr = size * rand(r, 0.03, 0.075)
    const col = vary(r, base, 8, 10, 9)
    parts.push(wrapped(size, x, y, rr * 1.4, (px, py) => path(blobPath(r, px, py, rr, 0.35, 7), css(col, 0.8))))
  }
  for (let i = 0; i < 150; i++) {
    const x = r() * size
    const y = r() * size
    const len = size * rand(r, 0.012, 0.03)
    const col = css(vary(r, shade(base, -10), 10, 10, 8), 0.65)
    parts.push(wrapped(size, x, y, len * 2, (px, py) => line(px, py, px + rand(r, -len, len), py - len, col, size * 0.006, 'stroke-linecap="round"')))
  }
  return tileDoc(size, parts.join(''))
}

export function earth({ size, seed = 'earth', base = { h: 26, s: 36, l: 30 } }) {
  const r = makeRandom(seed)
  const parts = [rect(0, 0, size, size, css(base))]
  for (let i = 0; i < 40; i++) {
    const x = r() * size
    const y = r() * size
    const rr = size * rand(r, 0.05, 0.14)
    const col = vary(r, base, 5, 8, 7)
    parts.push(wrapped(size, x, y, rr * 1.4, (px, py) => path(blobPath(r, px, py, rr, 0.3, 8), css(col, 0.7))))
  }
  // Rake lines.
  for (let i = 0; i < 10; i++) {
    const y = (i / 10) * size + rand(r, -2, 2)
    parts.push(line(0, y, size, y + rand(r, -3, 3), css(shade(base, -7), 0.5), size * 0.008))
  }
  for (let i = 0; i < 130; i++) {
    const x = r() * size
    const y = r() * size
    const rr = size * rand(r, 0.004, 0.012)
    const col = css(vary(r, base, 12, 16, rand(r, -16, 16)), 0.85)
    parts.push(wrapped(size, x, y, rr * 2, (px, py) => circle(px, py, rr, col)))
  }
  return tileDoc(size, parts.join(''))
}

export function paving({ size, seed = 'paving', base = { h: 32, s: 8, l: 68 }, cols = 4, rows = 8 }) {
  const r = makeRandom(seed)
  const parts = [rect(0, 0, size, size, css(shade(base, -16)))]
  const bw = size / cols
  const bh = size / rows
  for (let row = 0; row < rows; row++) {
    // Running bond: every other course offset by half a brick.
    const offset = row % 2 === 0 ? 0 : bw / 2
    for (let col = -1; col <= cols; col++) {
      const x = col * bw + offset
      parts.push(
        wrapped(size, x + bw / 2, row * bh + bh / 2, Math.max(bw, bh), (px, py) =>
          rect(px - bw / 2 + 0.8, py - bh / 2 + 0.8, bw - 1.6, bh - 1.6, css(vary(r, base, 4, 3, 6))),
        ),
      )
    }
  }
  return tileDoc(size, parts.join(''))
}

export function cobbles({ size, seed = 'cobbles', base = { h: 28, s: 6, l: 58 } }) {
  const r = makeRandom(seed)
  const parts = [rect(0, 0, size, size, css(shade(base, -26)))]
  const cell = size / 7
  for (let gy = -1; gy <= 7; gy++) {
    for (let gx = -1; gx <= 7; gx++) {
      const x = (gx + 0.5) * cell + rand(r, -cell * 0.18, cell * 0.18)
      const y = (gy + 0.5) * cell + rand(r, -cell * 0.18, cell * 0.18)
      const rr = cell * rand(r, 0.38, 0.5)
      const col = vary(r, base, 6, 4, 10)
      parts.push(wrapped(size, x, y, rr * 1.5, (px, py) => path(blobPath(r, px, py, rr, 0.22, 7), css(col))))
    }
  }
  return tileDoc(size, parts.join(''))
}

export function gravel({ size, seed = 'gravel', base = { h: 34, s: 12, l: 62 } }) {
  const r = makeRandom(seed)
  const parts = [rect(0, 0, size, size, css(shade(base, -8)))]
  for (let i = 0; i < 280; i++) {
    const x = r() * size
    const y = r() * size
    const rr = size * rand(r, 0.006, 0.02)
    const col = css(vary(r, base, 10, 8, rand(r, -14, 14)))
    parts.push(
      wrapped(size, x, y, rr * 2, (px, py) => ellipse(px, py, rr, rr * rand(r, 0.6, 1), col, `transform="rotate(${n(r() * 180)} ${n(px)} ${n(py)})"`)),
    )
  }
  return tileDoc(size, parts.join(''))
}

export function decking({ size, seed = 'decking', base = { h: 32, s: 42, l: 60 }, planks = 6 }) {
  const r = makeRandom(seed)
  const parts = [rect(0, 0, size, size, css(shade(base, -16)))]
  const ph = size / planks
  for (let i = 0; i < planks; i++) {
    parts.push(rect(0, i * ph + 0.8, size, ph - 1.6, css(vary(r, base, 3, 5, 4))))
    for (let k = 0; k < 4; k++) {
      const x = r() * size
      const rr = size * rand(r, 0.04, 0.12)
      parts.push(wrapped(size, x, i * ph + ph / 2, rr, (px, py) => ellipse(px, py, rr, ph * 0.14, css(shade(base, -8), 0.45))))
    }
    // Fixings at the plank ends read as a deck rather than a floor.
    parts.push(circle(size * 0.08, i * ph + ph / 2, size * 0.008, css(shade(base, -24), 0.7)))
    parts.push(circle(size * 0.92, i * ph + ph / 2, size * 0.008, css(shade(base, -24), 0.7)))
  }
  return tileDoc(size, parts.join(''))
}

export function wall({ size, seed = 'wall', base = { h: 210, s: 6, l: 56 }, cols = 3, rows = 6 }) {
  const r = makeRandom(seed)
  const parts = [rect(0, 0, size, size, css(shade(base, -24)))]
  const bw = size / cols
  const bh = size / rows
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : bw / 2
    for (let col = -1; col <= cols; col++) {
      const x = col * bw + offset
      parts.push(
        wrapped(size, x + bw / 2, row * bh + bh / 2, Math.max(bw, bh), (px, py) => {
          const c = vary(r, base, 5, 3, 7)
          return (
            rect(px - bw / 2 + 1, py - bh / 2 + 1, bw - 2, bh - 2, css(c)) +
            rect(px - bw / 2 + 1, py - bh / 2 + 1, bw - 2, (bh - 2) * 0.22, css(shade(c, 7), 0.6))
          )
        }),
      )
    }
  }
  return tileDoc(size, parts.join(''))
}

export function water({ size, seed = 'water', base = { h: 196, s: 58, l: 56 } }) {
  const r = makeRandom(seed)
  const parts = [rect(0, 0, size, size, css(base))]
  for (let i = 0; i < 26; i++) {
    const x = r() * size
    const y = r() * size
    const w = size * rand(r, 0.1, 0.3)
    const col = css(shade(base, rand(r, 8, 22)), rand(r, 0.3, 0.6))
    parts.push(
      wrapped(size, x, y, w, (px, py) =>
        `<path d="M${n(px - w / 2)} ${n(py)}q${n(w * 0.25)} ${n(-size * 0.03)} ${n(w * 0.5)} 0t${n(w * 0.5)} 0" stroke="${col}" stroke-width="${n(size * 0.012)}" fill="none" stroke-linecap="round"/>`,
      ),
    )
  }
  for (let i = 0; i < 16; i++) {
    const x = r() * size
    const y = r() * size
    const rr = size * rand(r, 0.04, 0.1)
    parts.push(wrapped(size, x, y, rr, (px, py) => path(blobPath(r, px, py, rr, 0.3, 7), css(shade(base, -12), 0.28))))
  }
  return tileDoc(size, parts.join(''))
}

export function bark({ size, seed = 'bark', base = { h: 20, s: 34, l: 26 } }) {
  const r = makeRandom(seed)
  const parts = [rect(0, 0, size, size, css(base))]
  for (let i = 0; i < 180; i++) {
    const x = r() * size
    const y = r() * size
    const w = size * rand(r, 0.02, 0.06)
    const h = w * rand(r, 0.3, 0.5)
    const col = css(vary(r, base, 8, 12, rand(r, -10, 14)))
    parts.push(
      wrapped(size, x, y, w, (px, py) =>
        path(polygonPath([[px - w / 2, py], [px - w * 0.2, py - h], [px + w / 2, py - h * 0.4], [px + w * 0.15, py + h * 0.6]]), col),
      ),
    )
  }
  return tileDoc(size, parts.join(''))
}

export function sand({ size, seed = 'sand', base = { h: 44, s: 52, l: 76 } }) {
  const r = makeRandom(seed)
  const parts = [rect(0, 0, size, size, css(base))]
  for (let i = 0; i < 8; i++) {
    const y = (i / 8) * size
    parts.push(`<path d="M0 ${n(y)}q${n(size * 0.25)} ${n(rand(r, -8, 8))} ${n(size * 0.5)} 0t${n(size * 0.5)} 0" stroke="${css(shade(base, -8), 0.5)}" stroke-width="${n(size * 0.01)}" fill="none"/>`)
  }
  for (let i = 0; i < 300; i++) {
    const x = r() * size
    const y = r() * size
    parts.push(wrapped(size, x, y, 2, (px, py) => circle(px, py, size * rand(r, 0.003, 0.008), css(vary(r, base, 6, 10, rand(r, -12, 10)), 0.8))))
  }
  return tileDoc(size, parts.join(''))
}
