// Premium board-game art shared by Chess + Checkers (canvas painters).
//
// Everything here is hand-drawn vector art — NO Unicode glyph pieces (they
// render differently per platform font and read as cheap). Pieces/discs are
// baked once per cell size into offscreen sprite canvases and blitted by the
// game render loops; the board is a classic tournament palette inside a
// walnut frame with engraved coordinates.
//
// All painters draw in a normalized 0..100 box unless stated otherwise.

export const BOARD_THEME = {
  light: '#f0d9b5',
  dark: '#b58863',
  frameTop: '#50392a',
  frameBot: '#241812',
  frameEdge: 'rgba(255, 255, 255, 0.10)',
  inlay: 'rgba(226, 190, 132, 0.55)',
  coord: 'rgba(238, 213, 166, 0.85)',
}

const TAU = Math.PI * 2

/** Safari-14-safe rounded-rect path (no ctx.roundRect in the build target). */
export function roundRectPath(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  c.beginPath()
  c.moveTo(x + rr, y)
  c.arcTo(x + w, y, x + w, y + h, rr)
  c.arcTo(x + w, y + h, x, y + h, rr)
  c.arcTo(x, y + h, x, y, rr)
  c.arcTo(x, y, x + w, y, rr)
  c.closePath()
}

/** Safe toDataURL (jsdom without the canvas package throws). Memoized so an
 * unsupported environment only pays (and logs) the failed probe once. */
let dataUrlSupported = null
export function spriteUrl(cv) {
  if (dataUrlSupported === false) return ''
  try {
    const u = cv.toDataURL('image/png')
    dataUrlSupported = true
    return typeof u === 'string' && u.startsWith('data:image') ? u : ''
  } catch {
    dataUrlSupported = false
    return ''
  }
}

/**
 * Paint the walnut frame + the classic 8×8 squares (+ optional coordinates).
 * Highlights and pieces are painted by the caller on top.
 */
export function paintBoard(c, { x, y, cell, frame, lowEnd = false, flip = false, coords = true }) {
  const size = cell * 8
  const fx = x - frame
  const fy = y - frame
  const fs = size + frame * 2

  // frame with drop shadow
  c.save()
  if (!lowEnd) {
    c.shadowColor = 'rgba(0, 0, 0, 0.5)'
    c.shadowBlur = 26
    c.shadowOffsetY = 12
  }
  roundRectPath(c, fx, fy, fs, fs, Math.max(8, frame * 0.55))
  const fg = c.createLinearGradient(fx, fy, fx, fy + fs)
  fg.addColorStop(0, BOARD_THEME.frameTop)
  fg.addColorStop(1, BOARD_THEME.frameBot)
  c.fillStyle = fg
  c.fill()
  c.restore()

  // frame edge highlight + gold inlay around the playing field
  roundRectPath(c, fx + 1.25, fy + 1.25, fs - 2.5, fs - 2.5, Math.max(7, frame * 0.5))
  c.strokeStyle = BOARD_THEME.frameEdge
  c.lineWidth = 1.5
  c.stroke()
  c.strokeStyle = BOARD_THEME.inlay
  c.lineWidth = 1.5
  c.strokeRect(x - 2.5, y - 2.5, size + 5, size + 5)

  // squares
  for (let r = 0; r < 8; r++) {
    for (let col = 0; col < 8; col++) {
      c.fillStyle = (r + col) % 2 === 0 ? BOARD_THEME.light : BOARD_THEME.dark
      c.fillRect(x + col * cell, y + r * cell, cell, cell)
    }
  }
  // one soft top sheen + edge vignette across the whole field (depth, cheap)
  const sheen = c.createLinearGradient(0, y, 0, y + size)
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.07)')
  sheen.addColorStop(0.25, 'rgba(255, 255, 255, 0)')
  sheen.addColorStop(1, 'rgba(0, 0, 0, 0.08)')
  c.fillStyle = sheen
  c.fillRect(x, y, size, size)
  const vig = c.createRadialGradient(
    x + size / 2,
    y + size / 2,
    size * 0.35,
    x + size / 2,
    y + size / 2,
    size * 0.75,
  )
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.12)')
  c.fillStyle = vig
  c.fillRect(x, y, size, size)

  // coordinates engraved on the frame (files a–h, ranks 1–8), flip-aware
  if (coords && cell >= 26 && frame >= 13) {
    c.save()
    c.fillStyle = BOARD_THEME.coord
    c.font = `700 ${Math.round(frame * 0.46)}px -apple-system, 'Segoe UI', Roboto, sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    const files = 'abcdefgh'
    for (let i = 0; i < 8; i++) {
      const file = files[flip ? 7 - i : i]
      c.fillText(file, x + i * cell + cell / 2, y + size + frame / 2 + 0.5)
      const rank = flip ? i + 1 : 8 - i
      c.fillText(String(rank), x - frame / 2, y + i * cell + cell / 2 + 0.5)
    }
    c.restore()
  }
}

// ── Chess piece set (custom Staunton-style vectors) ──────────────────────────

const CHESS_STYLE = {
  w: {
    top: '#fefaf0',
    bot: '#d5c8ab',
    line: '#43392c',
    detail: 'rgba(67, 57, 44, 0.5)',
    slit: '#43392c',
  },
  b: {
    top: '#5a6373',
    bot: '#14171d',
    line: '#05070a',
    detail: 'rgba(226, 232, 240, 0.30)',
    slit: '#c7ced9',
  },
}

const fillStroke = (c) => {
  c.fill()
  c.stroke()
}

/** Continues a silhouette from (xR, 80) around the plinth back to (xL, 80). */
const slab = (c, xL, xR) => {
  c.lineTo(xR + 3.5, 80)
  c.quadraticCurveTo(xR + 8.5, 80.5, xR + 8.5, 84.5)
  c.quadraticCurveTo(xR + 8.5, 88.5, xR + 3.5, 88.5)
  c.lineTo(xL - 3.5, 88.5)
  c.quadraticCurveTo(xL - 8.5, 88.5, xL - 8.5, 84.5)
  c.quadraticCurveTo(xL - 8.5, 80.5, xL - 3.5, 80)
  c.closePath()
}

const PIECE_PATHS = {
  P: (c) => {
    c.beginPath()
    c.moveTo(38, 80)
    c.lineTo(41.5, 60)
    c.quadraticCurveTo(43, 52, 40.5, 48.5)
    c.quadraticCurveTo(36.5, 48, 37.5, 44)
    c.lineTo(42.8, 42)
    c.arc(50, 32, 12.8, 2.5, 0.64, false)
    c.lineTo(62.5, 44)
    c.quadraticCurveTo(63.5, 48, 59.5, 48.5)
    c.quadraticCurveTo(57, 52, 58.5, 60)
    c.lineTo(62, 80)
    slab(c, 38, 62)
    fillStroke(c)
  },
  R: (c, st) => {
    c.beginPath()
    c.moveTo(36.5, 80)
    c.lineTo(38.5, 56)
    c.lineTo(35, 51)
    c.lineTo(35, 45)
    c.lineTo(30.5, 41)
    c.lineTo(30.5, 21.5)
    c.lineTo(39, 21.5)
    c.lineTo(39, 28.5)
    c.lineTo(45.5, 28.5)
    c.lineTo(45.5, 21.5)
    c.lineTo(54.5, 21.5)
    c.lineTo(54.5, 28.5)
    c.lineTo(61, 28.5)
    c.lineTo(61, 21.5)
    c.lineTo(69.5, 21.5)
    c.lineTo(69.5, 41)
    c.lineTo(65, 45)
    c.lineTo(65, 51)
    c.lineTo(61.5, 56)
    c.lineTo(63.5, 80)
    slab(c, 36.5, 63.5)
    fillStroke(c)
    c.save()
    c.strokeStyle = st.detail
    c.lineWidth = 1.8
    c.beginPath()
    c.moveTo(36, 50.5)
    c.lineTo(64, 50.5)
    c.stroke()
    c.restore()
  },
  N: (c, st) => {
    c.beginPath()
    c.moveTo(36, 80)
    c.bezierCurveTo(35.5, 69, 38, 62, 43, 56.5)
    c.bezierCurveTo(37, 55.5, 32.5, 50, 31.5, 44.5)
    c.bezierCurveTo(31, 41.5, 32.5, 39.5, 35, 39)
    c.bezierCurveTo(32, 36.5, 30.5, 33.5, 31, 30.5)
    c.bezierCurveTo(27.5, 30.5, 24, 29, 23, 26)
    c.bezierCurveTo(22, 22.5, 24, 19.4, 27.5, 19.2)
    c.bezierCurveTo(30.5, 19, 33, 19.6, 35.5, 18)
    c.bezierCurveTo(37, 17, 38, 15.5, 38.6, 12.5)
    c.bezierCurveTo(39.2, 9.5, 41.8, 9.2, 42.2, 12)
    c.lineTo(43.4, 16)
    c.bezierCurveTo(44.6, 13, 47.4, 12.4, 47.8, 15.4)
    c.lineTo(48.6, 19)
    c.bezierCurveTo(56, 23.5, 62.5, 32, 64.5, 43)
    c.bezierCurveTo(66.5, 53, 65, 68, 64, 80)
    slab(c, 36, 64)
    fillStroke(c)
    c.save()
    c.fillStyle = st.slit
    c.beginPath()
    c.arc(37.5, 26.5, 1.9, 0, TAU)
    c.fill()
    c.beginPath()
    c.arc(27.3, 23.4, 1.3, 0, TAU)
    c.fill()
    c.strokeStyle = st.detail
    c.lineWidth = 1.8
    c.beginPath()
    c.moveTo(50, 24)
    c.bezierCurveTo(55, 29, 58.5, 36, 60, 44)
    c.stroke()
    c.restore()
  },
  B: (c, st) => {
    c.beginPath()
    c.moveTo(38.5, 80)
    c.lineTo(42.5, 60)
    c.quadraticCurveTo(44, 53, 41.5, 50.5)
    c.quadraticCurveTo(37, 50, 38.5, 46)
    c.quadraticCurveTo(33.5, 38.5, 38.5, 29)
    c.bezierCurveTo(41.5, 23, 45.5, 19.5, 50, 18)
    c.bezierCurveTo(54.5, 19.5, 58.5, 23, 61.5, 29)
    c.quadraticCurveTo(66.5, 38.5, 61.5, 46)
    c.quadraticCurveTo(63, 50, 58.5, 50.5)
    c.quadraticCurveTo(56, 53, 57.5, 60)
    c.lineTo(61.5, 80)
    slab(c, 38.5, 61.5)
    fillStroke(c)
    c.beginPath()
    c.arc(50, 12.6, 4.1, 0, TAU)
    fillStroke(c)
    c.save()
    c.strokeStyle = st.slit
    c.lineWidth = 2.4
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(45, 40)
    c.lineTo(54.5, 28)
    c.stroke()
    c.restore()
  },
  Q: (c, st) => {
    c.beginPath()
    c.moveTo(37.5, 80)
    c.lineTo(42, 60)
    c.quadraticCurveTo(43.5, 52.5, 40.5, 49)
    c.lineTo(36, 46)
    c.lineTo(30, 23)
    c.lineTo(39.5, 37.5)
    c.lineTo(41, 18.5)
    c.lineTo(47, 35.5)
    c.lineTo(50, 16.5)
    c.lineTo(53, 35.5)
    c.lineTo(59, 18.5)
    c.lineTo(60.5, 37.5)
    c.lineTo(70, 23)
    c.lineTo(64, 46)
    c.lineTo(59.5, 49)
    c.quadraticCurveTo(56.5, 52.5, 58, 60)
    c.lineTo(62.5, 80)
    slab(c, 37.5, 62.5)
    fillStroke(c)
    c.save()
    c.lineWidth = 2.1
    for (const [px, py] of [
      [30, 21.5],
      [41, 17],
      [50, 14.8],
      [59, 17],
      [70, 21.5],
    ]) {
      c.beginPath()
      c.arc(px, py, 2.7, 0, TAU)
      fillStroke(c)
    }
    c.strokeStyle = st.detail
    c.lineWidth = 1.8
    c.beginPath()
    c.moveTo(40.5, 49.5)
    c.quadraticCurveTo(50, 53, 59.5, 49.5)
    c.stroke()
    c.restore()
  },
  K: (c, st) => {
    c.save()
    c.lineWidth = 2.6
    c.beginPath()
    c.moveTo(47.7, 4)
    c.lineTo(52.3, 4)
    c.lineTo(52.3, 9.4)
    c.lineTo(57.4, 9.4)
    c.lineTo(57.4, 14)
    c.lineTo(52.3, 14)
    c.lineTo(52.3, 20)
    c.lineTo(47.7, 20)
    c.lineTo(47.7, 14)
    c.lineTo(42.6, 14)
    c.lineTo(42.6, 9.4)
    c.lineTo(47.7, 9.4)
    c.closePath()
    fillStroke(c)
    c.restore()
    // bell body + straight-sided flat crown (reads "king", never "big pawn")
    c.beginPath()
    c.moveTo(37.5, 80)
    c.lineTo(42, 60)
    c.quadraticCurveTo(43.5, 52.5, 40.5, 49)
    c.lineTo(36, 46.5)
    c.quadraticCurveTo(32.5, 44.5, 34.5, 38)
    c.bezierCurveTo(36, 32, 38, 28.5, 38, 25)
    c.quadraticCurveTo(38, 21.5, 41.5, 21.5)
    c.lineTo(58.5, 21.5)
    c.quadraticCurveTo(62, 21.5, 62, 25)
    c.bezierCurveTo(62, 28.5, 64, 32, 65.5, 38)
    c.quadraticCurveTo(67.5, 44.5, 64, 46.5)
    c.lineTo(59.5, 49)
    c.quadraticCurveTo(56.5, 52.5, 58, 60)
    c.lineTo(62.5, 80)
    slab(c, 37.5, 62.5)
    fillStroke(c)
    c.save()
    c.strokeStyle = st.detail
    c.lineWidth = 1.8
    c.beginPath()
    c.moveTo(41, 53.5)
    c.quadraticCurveTo(50, 57, 59, 53.5)
    c.stroke()
    c.beginPath()
    c.moveTo(39.5, 29.5)
    c.quadraticCurveTo(50, 32.5, 60.5, 29.5)
    c.stroke()
    c.restore()
  },
}

export function drawChessPiece(c, ch) {
  const white = ch === ch.toUpperCase()
  const st = white ? CHESS_STYLE.w : CHESS_STYLE.b
  c.save()
  c.lineJoin = 'round'
  c.lineCap = 'round'
  c.fillStyle = 'rgba(10, 8, 5, 0.28)'
  c.beginPath()
  c.ellipse(50, 88, 25, 5, 0, 0, TAU)
  c.fill()
  const grad = c.createLinearGradient(0, 8, 0, 92)
  grad.addColorStop(0, st.top)
  grad.addColorStop(1, st.bot)
  c.fillStyle = grad
  c.strokeStyle = st.line
  c.lineWidth = 3.2
  PIECE_PATHS[ch.toUpperCase()](c, st)
  c.restore()
}

/** Bake the 12-piece sprite set at a CSS size × pixel ratio. Map ch → canvas. */
export function bakeChessSet(sizeCss, ratio = 1) {
  const m = new Map()
  for (const ch of ['P', 'N', 'B', 'R', 'Q', 'K', 'p', 'n', 'b', 'r', 'q', 'k']) {
    const cv = document.createElement('canvas')
    const s = Math.max(4, Math.round(sizeCss * ratio))
    cv.width = s
    cv.height = s
    const c = cv.getContext('2d')
    if (c) {
      c.scale(s / 100, s / 100)
      drawChessPiece(c, ch)
    }
    m.set(ch, cv)
  }
  return m
}

// ── Checkers disc set (turned-wood draughts pieces) ──────────────────────────

const DISC_STYLE = {
  1: {
    hi: '#fdf8ec',
    mid: '#e9ddc1',
    lo: '#c2b28e',
    side: '#a39472',
    sideLo: '#7d7057',
    line: '#4e4433',
    groove: 'rgba(78, 68, 51, 0.4)',
  },
  2: {
    hi: '#6d7789',
    mid: '#454d5c',
    lo: '#242a34',
    side: '#232833',
    sideLo: '#111419',
    line: '#05070a',
    groove: 'rgba(255, 255, 255, 0.24)',
  },
}

const RX = 30
const RY = 10.5
const CYL_H = 11

function drawCylinder(c, st, yTop) {
  const sg = c.createLinearGradient(20, 0, 80, 0)
  sg.addColorStop(0, st.side)
  sg.addColorStop(0.5, st.sideLo)
  sg.addColorStop(1, st.side)
  c.fillStyle = sg
  c.beginPath()
  c.moveTo(50 - RX, yTop)
  c.lineTo(50 - RX, yTop + CYL_H)
  c.ellipse(50, yTop + CYL_H, RX, RY, 0, Math.PI, 0, true)
  c.lineTo(50 + RX, yTop)
  c.closePath()
  c.fill()
  c.strokeStyle = st.line
  c.lineWidth = 2
  c.stroke()

  const tg = c.createRadialGradient(42, yTop - 4, 3, 50, yTop, RX)
  tg.addColorStop(0, st.hi)
  tg.addColorStop(0.55, st.mid)
  tg.addColorStop(1, st.lo)
  c.fillStyle = tg
  c.beginPath()
  c.ellipse(50, yTop, RX, RY, 0, 0, TAU)
  c.fill()
  c.stroke()

  c.strokeStyle = st.groove
  c.lineWidth = 1.6
  for (const k of [0.72, 0.45]) {
    c.beginPath()
    c.ellipse(50, yTop, RX * k, RY * k, 0, 0, TAU)
    c.stroke()
  }
}

function drawCrown(c, yTop) {
  const g = c.createLinearGradient(0, yTop - 7, 0, yTop + 5)
  g.addColorStop(0, '#ffe084')
  g.addColorStop(1, '#c08a12')
  c.fillStyle = g
  c.strokeStyle = '#7a5510'
  c.lineWidth = 1.6
  c.lineJoin = 'round'
  c.beginPath()
  c.moveTo(39, yTop + 4)
  c.lineTo(37, yTop - 3)
  c.lineTo(43.5, yTop - 0.5)
  c.lineTo(50, yTop - 6.5)
  c.lineTo(56.5, yTop - 0.5)
  c.lineTo(63, yTop - 3)
  c.lineTo(61, yTop + 4)
  c.closePath()
  fillStroke(c)
  c.fillStyle = '#8a2f2f'
  for (const px of [43, 50, 57]) {
    c.beginPath()
    c.arc(px, yTop + 1.5, 1.1, 0, TAU)
    c.fill()
  }
}

export function drawCheckersDisc(c, player, king = false) {
  const st = DISC_STYLE[player]
  c.save()
  c.fillStyle = 'rgba(8, 6, 4, 0.32)'
  c.beginPath()
  c.ellipse(50, 76, 27, 6.5, 0, 0, TAU)
  c.fill()
  const baseTop = king ? 60 : 55
  drawCylinder(c, st, baseTop)
  if (king) {
    drawCylinder(c, st, baseTop - 12)
    drawCrown(c, baseTop - 13)
  }
  c.restore()
}

/** Bake disc sprites: '1'/'2' men + 'K1'/'K2' kings. Map key → canvas. */
export function bakeDiscSet(sizeCss, ratio = 1) {
  const m = new Map()
  for (const [key, player, king] of [
    ['1', 1, false],
    ['2', 2, false],
    ['K1', 1, true],
    ['K2', 2, true],
  ]) {
    const cv = document.createElement('canvas')
    const s = Math.max(4, Math.round(sizeCss * ratio))
    cv.width = s
    cv.height = s
    const c = cv.getContext('2d')
    if (c) {
      c.scale(s / 100, s / 100)
      drawCheckersDisc(c, player, king)
    }
    m.set(key, cv)
  }
  return m
}
