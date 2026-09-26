import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// board3d is the shared 3D board (chess + checkers). Stub `three` with the
// shared headless stub — every THREE symbol board3d uses is covered, so
// createBoardScene() builds a live scene and we can drive its input.
//
// Na extração (25/09/2026) o `board3d.js` do RoqueOS virou `src/tabuleiro3d.js`
// sem mudar uma linha, e o dublê comum de lá virou `threeStub.js`, recortado ao
// que este arquivo toca. Os cinco casos seguem abaixo, sem mudança.
vi.mock('three', async () => (await import('./threeStub.js')).criarThreeFalso())

import { createBoardScene, buildChessSet3D } from '../src/tabuleiro3d.js'

const make2dStub = () => {
  const stub = new Proxy(function () {}, {
    get: (_t, p) => (p === Symbol.toPrimitive ? () => 0 : stub),
    set: () => true,
    apply: () => stub,
  })
  return stub
}

describe('board3d input (orbit drag + pinch)', () => {
  let canvas
  let scene
  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => make2dStub())
    canvas = document.createElement('canvas')
    canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 600,
      height: 600,
      right: 600,
      bottom: 600,
    })
    scene = createBoardScene({
      canvas,
      coords: true,
      set: buildChessSet3D({ quality: 'low' }),
      onTap: () => {},
    })
  })
  afterEach(() => {
    scene?.dispose?.()
    vi.restoreAllMocks()
  })

  // jsdom lacks a rich PointerEvent — dispatch a plain event with the fields the
  // handlers read.
  const send = (type, id, x, y) => {
    const ev = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(ev, { pointerId: id, isPrimary: id === 1, clientX: x, clientY: y })
    canvas.dispatchEvent(ev)
  }

  it('builds a live board scene exposing orbit state', () => {
    expect(typeof scene.getState).toBe('function')
    const s = scene.getState()
    expect(typeof s.theta).toBe('number')
    expect(typeof s.zoom).toBe('number')
  })

  it('one-finger drag turns the board the way the finger moves (axis was inverted)', () => {
    const before = scene.getState().theta
    send('pointerdown', 1, 300, 300)
    send('pointermove', 1, 380, 300) // drag RIGHT 80px
    const after = scene.getState().theta
    // fixed convention: dragging right DECREASES theta (down.theta − dx·k)
    expect(after).toBeLessThan(before)
    send('pointerup', 1, 380, 300)
  })

  it('one-finger drag tilts the board the way the finger moves (vertical was inverted)', () => {
    const before = scene.getState().phi
    send('pointerdown', 1, 300, 200)
    send('pointermove', 1, 300, 260) // drag DOWN 60px
    const after = scene.getState().phi
    // fixed convention: dragging down tilts to show more of the top → phi decreases
    expect(after).toBeLessThan(before)
    send('pointerup', 1, 300, 260)
  })

  it('two-finger pinch-out zooms IN (smaller orbit radius)', () => {
    const z0 = scene.getState().zoom
    send('pointerdown', 1, 260, 300)
    send('pointerdown', 2, 340, 300) // 80px apart
    send('pointermove', 1, 180, 300)
    send('pointermove', 2, 420, 300) // spread to 240px → zoom in
    const z1 = scene.getState().zoom
    expect(z1).toBeLessThan(z0)
    send('pointerup', 1, 180, 300)
    send('pointerup', 2, 420, 300)
  })

  it('pinch-in zooms OUT (larger orbit radius) back toward the fit', () => {
    // start zoomed-in, then bring fingers together → zoom value grows
    send('pointerdown', 1, 120, 300)
    send('pointerdown', 2, 480, 300) // far apart
    send('pointermove', 1, 260, 300)
    send('pointermove', 2, 340, 300) // together → zoom out
    const z = scene.getState().zoom
    send('pointerup', 1, 260, 300)
    send('pointerup', 2, 340, 300)
    expect(z).toBeGreaterThan(0.62) // moved up from the min
  })
})
