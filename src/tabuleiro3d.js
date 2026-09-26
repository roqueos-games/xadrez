// Real-3D board-game engine shared by Chess + Checkers (Three.js).
//
// Everything is procedural — Staunton chess pieces are lathe-turned profiles
// (exactly how the real pieces are made), the knight is an extruded silhouette,
// checkers discs are grooved lathe profiles. PBR materials (lacquered ivory /
// ebony), a wooden board with an engraved-coordinates frame, soft shadows, an
// orbitable perspective camera and arcing move animations. No external assets.
//
// Board space: cell = 1 unit, board centered at origin. Engine row 0 (black's
// home rank) sits at z = -3.5; column 0 at x = -3.5. The camera side handles
// the "flip" (black player looks from -z) — coordinates never remap.

import * as THREE from 'three'

const BOARD_TOP = 0.3 // y of the playing surface

export const sqToWorld = (r, c) => ({ x: c - 3.5, z: r - 3.5 })
export const worldToSq = (x, z) => {
  const c = Math.floor(x + 4)
  const r = Math.floor(z + 4)
  if (r < 0 || r > 7 || c < 0 || c > 7) return null
  return [r, c]
}

// ── Procedural wood textures (canvas) ───────────────────────────────────────

const rng = (seed) => {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const grain = (c, x, y, w, h, base, streak, count, rnd) => {
  c.save()
  c.beginPath()
  c.rect(x, y, w, h)
  c.clip()
  c.fillStyle = base
  c.fillRect(x, y, w, h)
  c.strokeStyle = streak
  for (let i = 0; i < count; i++) {
    c.globalAlpha = 0.05 + rnd() * 0.1
    c.lineWidth = 1 + rnd() * 2.5
    const yy = y + rnd() * h
    c.beginPath()
    c.moveTo(x - 10, yy)
    c.bezierCurveTo(
      x + w * 0.33,
      yy + (rnd() - 0.5) * 14,
      x + w * 0.66,
      yy + (rnd() - 0.5) * 14,
      x + w + 10,
      yy + (rnd() - 0.5) * 8,
    )
    c.stroke()
  }
  c.restore()
  c.globalAlpha = 1
}

/** Board-top texture: walnut frame w/ engraved coordinates + tournament squares. */
export function makeBoardTexture({ size = 2048, coords = true } = {}) {
  const cv = document.createElement('canvas')
  cv.width = size
  cv.height = size
  const c = cv.getContext('2d')
  if (!c) return cv
  const rnd = rng(20260703)
  const frame = size * 0.052
  const field = size - frame * 2
  const cell = field / 8

  // walnut frame with subtle grain
  grain(c, 0, 0, size, size, '#3a2a1c', '#1c120a', 90, rnd)
  const edge = c.createLinearGradient(0, 0, 0, size)
  edge.addColorStop(0, 'rgba(255,255,255,0.10)')
  edge.addColorStop(0.5, 'rgba(255,255,255,0)')
  edge.addColorStop(1, 'rgba(0,0,0,0.22)')
  c.fillStyle = edge
  c.fillRect(0, 0, size, size)

  // gold inlay line around the field
  c.strokeStyle = 'rgba(226, 190, 132, 0.6)'
  c.lineWidth = size * 0.0035
  c.strokeRect(
    frame - size * 0.008,
    frame - size * 0.008,
    field + size * 0.016,
    field + size * 0.016,
  )

  // squares with per-square woody variation
  for (let r = 0; r < 8; r++) {
    for (let col = 0; col < 8; col++) {
      const light = (r + col) % 2 === 0
      grain(
        c,
        frame + col * cell,
        frame + r * cell,
        cell,
        cell,
        light ? '#efd9b4' : '#b08054',
        light ? '#c9ab7c' : '#7c5636',
        14,
        rnd,
      )
      // gentle per-square sheen
      const g = c.createLinearGradient(0, frame + r * cell, 0, frame + (r + 1) * cell)
      g.addColorStop(0, 'rgba(255,255,255,0.05)')
      g.addColorStop(1, 'rgba(0,0,0,0.05)')
      c.fillStyle = g
      c.fillRect(frame + col * cell, frame + r * cell, cell, cell)
    }
  }
  // field vignette
  const vig = c.createRadialGradient(
    size / 2,
    size / 2,
    field * 0.35,
    size / 2,
    size / 2,
    field * 0.72,
  )
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.10)')
  c.fillStyle = vig
  c.fillRect(frame, frame, field, field)

  // engraved coordinates (a–h along white's edge, 1–8 up the side)
  if (coords) {
    c.fillStyle = 'rgba(236, 208, 158, 0.85)'
    c.font = `600 ${Math.round(frame * 0.52)}px -apple-system, 'Segoe UI', Roboto, sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    const files = 'abcdefgh'
    for (let i = 0; i < 8; i++) {
      // engine row 0 = rank 8 (top of texture = -z = black home)
      c.fillText(files[i], frame + i * cell + cell / 2, size - frame / 2)
      c.fillText(String(8 - i), frame / 2, frame + i * cell + cell / 2)
    }
  }
  return cv
}

/** Plain dark-walnut texture for the board sides. */
export function makeWoodSideTexture(size = 512) {
  const cv = document.createElement('canvas')
  cv.width = size
  cv.height = size / 4
  const c = cv.getContext('2d')
  if (c) grain(c, 0, 0, cv.width, cv.height, '#2e2115', '#150d07', 40, rng(77))
  return cv
}

// ── Lathe profiles (Staunton set) ────────────────────────────────────────────
// Profiles are arrays of [radius, height] in cell units, bottom at y = 0.
// A tiny helper builds smooth arcs (sphere caps, coves) between key points.

const arcPts = (cx, cy, rad, a0, a1, n) => {
  const out = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)])
  }
  return out
}

const BASE = [
  [0.0, 0.0],
  [0.3, 0.0],
  [0.32, 0.02],
  [0.32, 0.07],
  [0.27, 0.1],
  [0.24, 0.13],
  [0.235, 0.17],
]

const chessProfiles = {
  P: [
    ...BASE,
    [0.15, 0.23],
    [0.11, 0.3],
    [0.095, 0.36],
    [0.15, 0.4],
    [0.155, 0.43],
    [0.1, 0.455],
    ...arcPts(0, 0.585, 0.15, -1.25, Math.PI / 2, 12),
  ],
  B: [
    ...BASE,
    [0.15, 0.24],
    [0.105, 0.34],
    [0.09, 0.44],
    [0.16, 0.485],
    [0.165, 0.52],
    [0.1, 0.545],
    ...arcPts(0, 0.71, 0.155, -1.1, 1.05, 10),
    [0.045, 0.86],
    ...arcPts(0, 0.9, 0.045, -0.9, Math.PI / 2, 8),
  ],
  Q: [
    ...BASE,
    [0.16, 0.25],
    [0.115, 0.38],
    [0.095, 0.52],
    [0.17, 0.57],
    [0.175, 0.605],
    [0.11, 0.64],
    // flared coronet (a smooth crown, not a gear) topped by a small orb
    [0.15, 0.7],
    [0.23, 0.82],
    [0.235, 0.85],
    [0.2, 0.85],
    [0.14, 0.82],
    [0.09, 0.84],
    [0.075, 0.88],
    ...arcPts(0, 0.925, 0.062, -0.9, Math.PI / 2, 8),
  ],
  K: [
    ...BASE,
    [0.17, 0.25],
    [0.12, 0.38],
    [0.1, 0.52],
    [0.18, 0.57],
    [0.185, 0.605],
    [0.115, 0.64],
    [0.15, 0.78],
    [0.23, 0.89],
    [0.16, 0.89],
    [0.05, 0.93],
    [0.0, 0.93],
  ],
  R: [
    ...BASE,
    [0.17, 0.22],
    [0.14, 0.3],
    [0.135, 0.44],
    [0.16, 0.5],
    [0.22, 0.52],
    [0.22, 0.62],
    [0.17, 0.62],
    [0.17, 0.56],
    [0.0, 0.56],
  ],
  // knight base only — the head is an extruded silhouette on top
  NBASE: [...BASE, [0.2, 0.2], [0.23, 0.24], [0.235, 0.27], [0.0, 0.27]],
}

/** The refined 2-D horse silhouette (same one the sprites use), as a Shape. */
function knightShape(s) {
  const sh = new THREE.Shape()
  const X = (px) => (px - 50) * s
  const Y = (py) => (80 - py) * s
  sh.moveTo(X(36), Y(78))
  sh.bezierCurveTo(X(35.5), Y(69), X(38), Y(62), X(43), Y(56.5))
  sh.bezierCurveTo(X(37), Y(55.5), X(32.5), Y(50), X(31.5), Y(44.5))
  sh.bezierCurveTo(X(31), Y(41.5), X(32.5), Y(39.5), X(35), Y(39))
  sh.bezierCurveTo(X(32), Y(36.5), X(30.5), Y(33.5), X(31), Y(30.5))
  sh.bezierCurveTo(X(27.5), Y(30.5), X(24), Y(29), X(23), Y(26))
  sh.bezierCurveTo(X(22), Y(22.5), X(24), Y(19.4), X(27.5), Y(19.2))
  sh.bezierCurveTo(X(30.5), Y(19), X(33), Y(19.6), X(35.5), Y(18))
  sh.bezierCurveTo(X(37), Y(17), X(38), Y(15.5), X(38.6), Y(12.5))
  sh.bezierCurveTo(X(39.2), Y(9.5), X(41.8), Y(9.2), X(42.2), Y(12))
  sh.lineTo(X(43.4), Y(16))
  sh.bezierCurveTo(X(44.6), Y(13), X(47.4), Y(12.4), X(47.8), Y(15.4))
  sh.lineTo(X(48.6), Y(19))
  sh.bezierCurveTo(X(56), Y(23.5), X(62.5), Y(32), X(64.5), Y(43))
  sh.bezierCurveTo(X(66.5), Y(53), X(65), Y(68), X(64), Y(78))
  sh.closePath()
  return sh
}

// ── Piece factories ──────────────────────────────────────────────────────────

const latheFrom = (profile, segments) =>
  new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)),
    segments,
  )

/**
 * Build the chess piece factories. Returns Map(char → () => THREE.Group).
 * Uppercase = white material, lowercase = black.
 */
export function buildChessSet3D({ quality = 'high' } = {}) {
  const seg = quality === 'high' ? 48 : 24
  const mats = {
    w: new THREE.MeshPhysicalMaterial({
      color: 0xf3e7cd,
      roughness: 0.34,
      metalness: 0.02,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
    }),
    b: new THREE.MeshPhysicalMaterial({
      color: 0x262b35,
      roughness: 0.3,
      metalness: 0.06,
      clearcoat: 0.65,
      clearcoatRoughness: 0.25,
    }),
  }

  const geoms = {}
  for (const [k, p] of Object.entries(chessProfiles)) geoms[k] = latheFrom(p, seg)
  geoms.CROSSV = new THREE.BoxGeometry(0.055, 0.2, 0.055)
  geoms.CROSSH = new THREE.BoxGeometry(0.16, 0.055, 0.055)
  geoms.MERLON = new THREE.BoxGeometry(0.1, 0.1, 0.085)
  const ks = knightShape(0.0115)
  geoms.NHEAD = new THREE.ExtrudeGeometry(ks, {
    depth: 0.15,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.045,
    bevelSegments: 3,
    curveSegments: quality === 'high' ? 12 : 6,
  })
  geoms.NHEAD.translate(0, 0.24, -0.075)

  const mesh = (g, m) => {
    const me = new THREE.Mesh(g, m)
    me.castShadow = true
    return me
  }

  const factories = new Map()
  const make = (ch) => {
    const white = ch === ch.toUpperCase()
    const m = white ? mats.w : mats.b
    const type = ch.toUpperCase()
    const g = new THREE.Group()
    if (type === 'N') {
      g.add(mesh(geoms.NBASE, m))
      const head = mesh(geoms.NHEAD, m)
      // knights face their opponent
      head.rotation.y = white ? -Math.PI / 2 : Math.PI / 2
      g.add(head)
    } else {
      g.add(mesh(geoms[type], m))
      if (type === 'K') {
        const v = mesh(geoms.CROSSV, m)
        v.position.y = 1.02
        const h = mesh(geoms.CROSSH, m)
        h.position.y = 1.02
        g.add(v, h)
      }
      if (type === 'R') {
        for (let i = 0; i < 5; i++) {
          const t = mesh(geoms.MERLON, m)
          const a = (i / 5) * Math.PI * 2
          t.position.set(Math.cos(a) * 0.165, 0.6, Math.sin(a) * 0.165)
          t.rotation.y = -a
          g.add(t)
        }
      }
    }
    return g
  }
  for (const ch of ['P', 'N', 'B', 'R', 'Q', 'K']) {
    factories.set(ch, () => make(ch))
    factories.set(ch.toLowerCase(), () => make(ch.toLowerCase()))
  }
  return { factories, dispose: () => Object.values(geoms).forEach((g) => g.dispose()) }
}

/** Checkers discs: grooved turned-wood men + stacked crowned kings. */
export function buildCheckersSet3D({ quality = 'high' } = {}) {
  const seg = quality === 'high' ? 48 : 24
  const mats = {
    1: new THREE.MeshPhysicalMaterial({
      color: 0xeadfc2,
      roughness: 0.4,
      clearcoat: 0.45,
      clearcoatRoughness: 0.35,
    }),
    2: new THREE.MeshPhysicalMaterial({
      color: 0x2b313d,
      roughness: 0.32,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
    }),
  }
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xd9a53c,
    roughness: 0.28,
    metalness: 0.85,
  })

  // grooved disc profile (r, y): rim, groove rings on the top face
  const disc = [
    [0.0, 0.0],
    [0.36, 0.0],
    [0.385, 0.03],
    [0.385, 0.12],
    [0.36, 0.15],
    [0.3, 0.15],
    [0.29, 0.13],
    [0.27, 0.13],
    [0.26, 0.15],
    [0.18, 0.15],
    [0.17, 0.13],
    [0.15, 0.13],
    [0.14, 0.15],
    [0.0, 0.15],
  ]
  const discGeom = latheFrom(disc, seg)
  const crownGeom = new THREE.TorusGeometry(0.14, 0.035, 10, 5)
  crownGeom.rotateX(Math.PI / 2)

  const mesh = (g, m) => {
    const me = new THREE.Mesh(g, m)
    me.castShadow = true
    return me
  }

  const factories = new Map()
  const make = (p, king) => {
    const g = new THREE.Group()
    g.add(mesh(discGeom, mats[p]))
    if (king) {
      const top = mesh(discGeom, mats[p])
      top.position.y = 0.15
      const crown = mesh(crownGeom, gold)
      crown.position.y = 0.33
      g.add(top, crown)
    }
    return g
  }
  factories.set('1', () => make(1, false))
  factories.set('2', () => make(2, false))
  factories.set('K1', () => make(1, true))
  factories.set('K2', () => make(2, true))
  return {
    factories,
    dispose: () => {
      discGeom.dispose()
      crownGeom.dispose()
    },
  }
}

// ── The scene ────────────────────────────────────────────────────────────────

/**
 * createBoardScene({ canvas, lowEnd, coords, set, onTap })
 *  set   — { factories } from buildChessSet3D / buildCheckersSet3D
 *  onTap — (row, col) called for a tap that wasn't an orbit drag
 */
export function createBoardScene({ canvas, lowEnd = false, coords = true, set, onTap }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !lowEnd,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : 2))
  if (!lowEnd) {
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
  }

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80)

  // camera orbit state (spherical around the board center). `fit` is the
  // distance that frames the WHOLE board for the current aspect (computed in
  // resize()); the wheel/pinch adjusts a relative zoom on top of it.
  const orbit = { theta: 0, phi: 0.82, fit: 12, zoom: 1, targetTheta: 0 }
  const applyCamera = () => {
    const radius = orbit.fit * orbit.zoom
    const y = radius * Math.cos(orbit.phi)
    const d = radius * Math.sin(orbit.phi)
    camera.position.set(Math.sin(orbit.theta) * d, y, Math.cos(orbit.theta) * d)
    camera.lookAt(0, -0.4, 0)
  }
  applyCamera()

  // lights
  scene.add(new THREE.HemisphereLight(0xfff2dd, 0x2c221a, 0.75))
  const key = new THREE.DirectionalLight(0xffffff, 1.35)
  key.position.set(4.5, 10, 5.5)
  if (!lowEnd) {
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -6
    key.shadow.camera.right = 6
    key.shadow.camera.top = 6
    key.shadow.camera.bottom = -6
    key.shadow.camera.far = 24
    key.shadow.bias = -0.0004
  }
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.28)
  fill.position.set(-6, 7, -5)
  scene.add(fill)

  // board slab (textured top + walnut sides)
  const boardTexCv = makeBoardTexture({ coords })
  const boardTex = new THREE.CanvasTexture(boardTexCv)
  boardTex.anisotropy = 8
  if ('colorSpace' in boardTex) boardTex.colorSpace = THREE.SRGBColorSpace
  const sideTex = new THREE.CanvasTexture(makeWoodSideTexture())
  const topMat = new THREE.MeshPhysicalMaterial({
    map: boardTex,
    roughness: 0.5,
    clearcoat: 0.25,
    clearcoatRoughness: 0.35,
  })
  const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.7 })
  const botMat = new THREE.MeshStandardMaterial({ color: 0x17100a, roughness: 0.9 })
  const slabW = 8 / (1 - 2 * 0.052) // squares span 8 units; frame extends beyond
  const slab = new THREE.Mesh(new THREE.BoxGeometry(slabW, 0.6, slabW), [
    sideMat,
    sideMat,
    topMat,
    botMat,
    sideMat,
    sideMat,
  ])
  slab.position.y = BOARD_TOP - 0.3
  slab.receiveShadow = true
  scene.add(slab)

  // soft ground shadow-catcher (invisible except for received shadows)
  if (!lowEnd) {
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 })
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.31
    ground.receiveShadow = true
    scene.add(ground)
  }

  // ── highlights (pooled overlay meshes just above the surface) ─────────────
  const HL_Y = BOARD_TOP + 0.012
  const mkTint = (color, opacity) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.96, 0.96),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    )
    m.rotation.x = -Math.PI / 2
    m.visible = false
    scene.add(m)
    return m
  }
  const mkDot = () => {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(0.13, 24),
      new THREE.MeshBasicMaterial({
        color: 0x2f4d2a,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    )
    m.rotation.x = -Math.PI / 2
    m.visible = false
    scene.add(m)
    return m
  }
  const mkRing = () => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.43, 32),
      new THREE.MeshBasicMaterial({
        color: 0x9c2f22,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    )
    m.rotation.x = -Math.PI / 2
    m.visible = false
    scene.add(m)
    return m
  }
  const hl = {
    last: [mkTint(0xb9c94d, 0.5), mkTint(0xb9c94d, 0.5)],
    sel: mkTint(0xffd35a, 0.55),
    check: mkTint(0xe12d2d, 0.55),
    dots: Array.from({ length: 28 }, mkDot),
    rings: Array.from({ length: 14 }, mkRing),
    must: Array.from({ length: 12 }, () => {
      const m = mkRing()
      m.material = m.material.clone()
      m.material.color.set(0xe5c98a)
      return m
    }),
  }
  const place = (meshObj, sq) => {
    const { x, z } = sqToWorld(sq[0], sq[1])
    meshObj.position.set(x, HL_Y, z)
    meshObj.visible = true
  }
  const state = { check: null, mustPulse: [] }
  const setHighlights = ({ lastMove, selected, targets = [], check, must = [] } = {}) => {
    hl.last.forEach((m) => (m.visible = false))
    hl.sel.visible = false
    hl.check.visible = false
    hl.dots.forEach((m) => (m.visible = false))
    hl.rings.forEach((m) => (m.visible = false))
    hl.must.forEach((m) => (m.visible = false))
    if (lastMove) {
      place(hl.last[0], lastMove.from)
      place(hl.last[1], lastMove.to)
    }
    if (selected) place(hl.sel, selected)
    let di = 0
    let ri = 0
    for (const tItem of targets) {
      if (tItem.capture && ri < hl.rings.length) place(hl.rings[ri++], tItem.sq)
      else if (!tItem.capture && di < hl.dots.length) place(hl.dots[di++], tItem.sq)
    }
    state.check = check || null
    if (check) place(hl.check, check)
    state.mustPulse = []
    let mi = 0
    for (const sq of must) {
      if (mi < hl.must.length) {
        place(hl.must[mi], sq)
        state.mustPulse.push(hl.must[mi])
        mi++
      }
    }
  }

  // ── pieces (pooled per sprite key) ──────────────────────────────────────────
  const pools = new Map() // key → { free: [], used: [] }
  const bySquare = new Map() // "r,c" → { key, group }
  const takePiece = (key) => {
    let pool = pools.get(key)
    if (!pool) {
      pool = { free: [], used: [] }
      pools.set(key, pool)
    }
    let g = pool.free.pop()
    if (!g) {
      g = set.factories.get(key)()
      scene.add(g)
    }
    pool.used.push(g)
    g.visible = true
    return g
  }
  const releaseAll = () => {
    for (const pool of pools.values()) {
      for (const g of pool.used) {
        g.visible = false
        pool.free.push(g)
      }
      pool.used.length = 0
    }
    bySquare.clear()
  }

  /** cells: array of { sq: [r,c], key } — full board state. */
  const setPieces = (cells) => {
    releaseAll()
    for (const { sq, key } of cells) {
      const g = takePiece(key)
      const { x, z } = sqToWorld(sq[0], sq[1])
      g.position.set(x, BOARD_TOP, z)
      g.scale.setScalar(1)
      bySquare.set(`${sq[0]},${sq[1]}`, { key, group: g })
    }
  }

  // ── move animation (arc glide, optional hop for knights) ───────────────────
  const anims = []
  const animateMove = (from, to, { hop = false, dur = 260 } = {}) => {
    const entry = bySquare.get(`${to[0]},${to[1]}`)
    if (!entry) return
    const a = sqToWorld(from[0], from[1])
    const b = sqToWorld(to[0], to[1])
    const dist = Math.hypot(b.x - a.x, b.z - a.z)
    anims.push({
      group: entry.group,
      a,
      b,
      lift: hop ? 0.55 : Math.min(0.4, 0.12 + dist * 0.05),
      t0: performance.now(),
      dur,
    })
    entry.group.position.set(a.x, BOARD_TOP, a.z)
  }

  // ── input: 1-finger orbit drag · 2-finger pinch-zoom · tap ─────────────────
  let down = null
  let moved = false
  const pointers = new Map() // pointerId → { x, y } (all active pointers)
  let pinch = null // { dist, zoom } while two fingers are down
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const pickSquare = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect()
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObject(slab, false)
    if (!hit.length) return null
    return worldToSq(hit[0].point.x, hit[0].point.z)
  }
  const pinchDist = () => {
    const it = pointers.values()
    const a = it.next().value
    const b = it.next().value
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }
  const onPointerDown = (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      /* jsdom */
    }
    if (pointers.size >= 2) {
      down = null // second finger down → pinch, not orbit
      pinch = { dist: pinchDist() || 1, zoom: orbit.zoom }
      return
    }
    down = { x: e.clientX, y: e.clientY, theta: orbit.theta, phi: orbit.phi }
    moved = false
  }
  const onPointerMove = (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    // pinch: spread fingers → zoom in (smaller radius), pinch together → zoom out
    if (pinch && pointers.size >= 2) {
      const d = pinchDist()
      if (d > 0) {
        orbit.zoom = Math.min(1.35, Math.max(0.62, pinch.zoom * (pinch.dist / d)))
        applyCamera()
      }
      return
    }
    if (!down) return
    const dx = e.clientX - down.x
    const dy = e.clientY - down.y
    if (!moved && Math.hypot(dx, dy) > 7) moved = true
    if (moved) {
      // drag turns/tilts the board the way the finger moves (both axes were
      // inverted vs direct manipulation)
      orbit.theta = down.theta - dx * 0.006
      orbit.targetTheta = orbit.theta
      orbit.phi = Math.min(1.25, Math.max(0.45, down.phi - dy * 0.004))
      applyCamera()
    }
  }
  const onPointerUp = (e) => {
    const wasTap = down && !moved && pointers.size === 1
    pointers.delete(e.pointerId)
    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch {
      /* jsdom */
    }
    if (wasTap && onTap) {
      const sq = pickSquare(e.clientX, e.clientY)
      if (sq) onTap(sq[0], sq[1])
    }
    if (pointers.size < 2) pinch = null
    if (pointers.size === 1) {
      // one finger remains after a pinch → reseed orbit so the view doesn't jump
      const p = pointers.values().next().value
      down = { x: p.x, y: p.y, theta: orbit.theta, phi: orbit.phi }
      moved = true
    } else if (pointers.size === 0) {
      down = null
    }
  }
  const onWheel = (e) => {
    e.preventDefault()
    orbit.zoom = Math.min(1.35, Math.max(0.62, orbit.zoom + e.deltaY * 0.0009))
    applyCamera()
  }
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })

  /** side: 'w' looks from +z (default), 'b' from -z. Eases the camera around. */
  const setSide = (side) => {
    orbit.targetTheta = side === 'b' ? Math.PI : 0
  }

  // ── frame loop ──────────────────────────────────────────────────────────────
  let rafId = 0
  let disposed = false
  const easeOut = (k) => 1 - Math.pow(1 - k, 3)
  const tick = () => {
    if (disposed) return
    const now = performance.now()
    // camera settle toward targetTheta (side switches)
    if (Math.abs(orbit.targetTheta - orbit.theta) > 0.001 && !down) {
      orbit.theta += (orbit.targetTheta - orbit.theta) * 0.12
      applyCamera()
    }
    // move animations
    for (let i = anims.length - 1; i >= 0; i--) {
      const an = anims[i]
      const k = Math.min(1, (now - an.t0) / an.dur)
      const e = easeOut(k)
      const x = an.a.x + (an.b.x - an.a.x) * e
      const z = an.a.z + (an.b.z - an.a.z) * e
      an.group.position.set(x, BOARD_TOP + Math.sin(Math.PI * e) * an.lift, z)
      if (k >= 1) {
        an.group.position.y = BOARD_TOP
        anims.splice(i, 1)
      }
    }
    // check + must-capture pulses
    if (state.check) hl.check.material.opacity = 0.4 + 0.2 * Math.sin(now / 220)
    for (const m of state.mustPulse) m.material.opacity = 0.4 + 0.3 * Math.sin(now / 260)
    renderer.render(scene, camera)
    rafId = requestAnimationFrame(tick)
  }
  tick()

  const resize = () => {
    const rect = canvas.parentElement?.getBoundingClientRect?.()
    const w = Math.max(1, Math.round(rect?.width || canvas.clientWidth || 480))
    const h = Math.max(1, Math.round(rect?.height || canvas.clientHeight || 560))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    // Frame the WHOLE board (frame + tallest pieces + coord rows) for this
    // aspect. The near row widens in perspective, so a fixed world half-width
    // underframes on narrow (mobile) viewports and clips the a1/h1 corners.
    // Numerically pull the camera back until every extreme point lands inside
    // the frustum with a margin; fall back to an analytic estimate where the
    // projection API is unavailable (e.g. the test stub).
    const R = slabW / 2 + 0.05
    const yTop = BOARD_TOP + 0.05
    const yTall = BOARD_TOP + 1.85 // top of the tallest piece (king)
    const probe = new THREE.Vector3(0, 0, 0)
    if (typeof probe.project === 'function' && typeof camera.updateMatrixWorld === 'function') {
      const pts = [
        [-R, yTop, R],
        [R, yTop, R],
        [-R, yTop, -R],
        [R, yTop, -R],
        [-4, yTall, R],
        [4, yTall, R],
        [-4, yTall, -R],
        [4, yTall, -R],
        [0, yTop, R + 0.4],
        [0, yTop, -R - 0.4],
      ].map((p) => new THREE.Vector3(p[0], p[1], p[2]))
      const margin = 0.92 // keep everything within 92% of the frustum
      const savedZoom = orbit.zoom
      orbit.zoom = 1
      for (let i = 0; i < 5; i++) {
        applyCamera()
        camera.updateMatrixWorld(true)
        let maxN = 0.001
        for (const p of pts) {
          const n = p.clone().project(camera)
          maxN = Math.max(maxN, Math.abs(n.x), Math.abs(n.y))
        }
        orbit.fit = Math.min(28, Math.max(8, (orbit.fit * maxN) / margin))
      }
      orbit.zoom = savedZoom
    } else {
      const vHalf = (camera.fov * Math.PI) / 360
      const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect)
      orbit.fit = Math.min(24, Math.max(9, Math.max(5.5 / Math.tan(hHalf), 3.9 / Math.tan(vHalf))))
    }
    applyCamera()
  }
  resize()

  const dispose = () => {
    disposed = true
    if (rafId) cancelAnimationFrame(rafId)
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerUp)
    canvas.removeEventListener('wheel', onWheel)
    boardTex.dispose()
    sideTex.dispose()
    set.dispose?.()
    renderer.dispose()
  }

  return {
    setPieces,
    setHighlights,
    animateMove,
    setSide,
    resize,
    dispose,
    pickSquare,
    // read-only orbit state (drag axis / pinch-zoom regression tests)
    getState: () => ({ theta: orbit.theta, phi: orbit.phi, zoom: orbit.zoom }),
  }
}
