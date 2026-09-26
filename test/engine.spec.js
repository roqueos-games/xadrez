import { describe, it, expect } from 'vitest'
import {
  WHITE,
  BLACK,
  colorOf,
  createGame,
  startGame,
  legalMoves,
  applyMove,
  inCheck,
  squareAttacked,
  findKing,
  serialize,
  deserialize,
  isGameOver,
  nextState,
} from '../src/engine.js'

const mv = (s, from, to, promo) => applyMove(s, { from, to, ...(promo ? { promo } : {}) })
const has = (moves, from, to) =>
  moves.some(
    (m) => m.from[0] === from[0] && m.from[1] === from[1] && m.to[0] === to[0] && m.to[1] === to[1],
  )

const withKings = () => {
  const s = startGame(createGame())
  s.board = Array.from({ length: 8 }, () => new Array(8).fill('.'))
  s.board[7][4] = 'K'
  s.board[0][4] = 'k'
  s.castling = { wk: false, wq: false, bk: false, bq: false }
  s.enPassant = null
  return s
}

describe('chess/engine — setup + basic moves', () => {
  it('the opening position has 20 legal moves for White', () => {
    const s = startGame(createGame())
    expect(legalMoves(s)).toHaveLength(20)
    expect(s.turn).toBe(WHITE)
  })

  it('a knight jumps out of the corner', () => {
    const s = startGame(createGame())
    const moves = legalMoves(s)
    expect(has(moves, [7, 1], [5, 0])).toBe(true) // Nb1-a3
    expect(has(moves, [7, 1], [5, 2])).toBe(true) // Nb1-c3
  })

  it('a pawn may step one or two squares from its start', () => {
    const s = startGame(createGame())
    const moves = legalMoves(s)
    expect(has(moves, [6, 4], [5, 4])).toBe(true) // e2-e3
    expect(has(moves, [6, 4], [4, 4])).toBe(true) // e2-e4
  })

  it('colorOf classifies pieces', () => {
    expect(colorOf('P')).toBe(WHITE)
    expect(colorOf('q')).toBe(BLACK)
    expect(colorOf('.')).toBeNull()
  })
})

describe('chess/engine — attacks + check', () => {
  it('detects an attacked square and a king in check', () => {
    const s = withKings()
    s.board[3][4] = 'r' // black rook on the e-file, checking the white king on e1
    expect(squareAttacked(s.board, 7, 4, BLACK)).toBe(true)
    expect(inCheck(s.board, WHITE)).toBe(true)
    expect(findKing(s.board, WHITE)).toEqual([7, 4])
  })

  it('a pinned piece cannot expose its king', () => {
    const s = withKings()
    s.board[6][4] = 'N' // white knight in front of its king
    s.board[3][4] = 'r' // black rook pinning it down the e-file
    s.turn = WHITE
    const moves = legalMoves(s)
    // the pinned knight has no legal move (any jump uncovers the check)
    expect(moves.some((m) => m.from[0] === 6 && m.from[1] === 4)).toBe(false)
  })
})

describe('chess/engine — special moves', () => {
  it('castles king-side and moves the rook too', () => {
    const s = withKings()
    s.board[7][7] = 'R'
    s.castling.wk = true
    s.turn = WHITE
    expect(has(legalMoves(s), [7, 4], [7, 6])).toBe(true)
    mv(s, [7, 4], [7, 6])
    expect(s.board[7][6]).toBe('K')
    expect(s.board[7][5]).toBe('R')
    expect(s.board[7][7]).toBe('.')
  })

  it('captures en passant', () => {
    const s = withKings()
    s.board[3][4] = 'P' // white pawn on e5
    s.board[1][3] = 'p' // black pawn on d7
    s.turn = BLACK
    mv(s, [1, 3], [3, 3]) // d7-d5, sets the en-passant target on d6 = [2,3]
    expect(s.enPassant).toEqual([2, 3])
    expect(has(legalMoves(s), [3, 4], [2, 3])).toBe(true)
    mv(s, [3, 4], [2, 3]) // exd6 e.p.
    expect(s.board[2][3]).toBe('P')
    expect(s.board[3][3]).toBe('.') // the captured pawn is gone
  })

  it('promotes a pawn to a queen', () => {
    const s = withKings()
    s.board[1][0] = 'P' // white pawn about to promote on a8
    s.turn = WHITE
    mv(s, [1, 0], [0, 0], 'Q')
    expect(s.board[0][0]).toBe('Q')
  })
})

describe('chess/engine — game end', () => {
  it('recognises the Fool’s Mate (checkmate)', () => {
    const s = startGame(createGame())
    mv(s, [6, 5], [5, 5]) // 1. f3
    mv(s, [1, 4], [3, 4]) // 1... e5
    mv(s, [6, 6], [4, 6]) // 2. g4
    mv(s, [0, 3], [4, 7]) // 2... Qh4#
    expect(s.status).toBe('checkmate')
    expect(s.winner).toBe(BLACK)
    expect(isGameOver(s)).toBe(true)
  })

  it('recognises stalemate (no move, not in check)', () => {
    const s = withKings()
    // classic corner stalemate: black king a8, white queen c7, white king a6-ish
    s.board = Array.from({ length: 8 }, () => new Array(8).fill('.'))
    s.board[0][0] = 'k' // a8
    s.board[1][2] = 'Q' // c7 — covers b8/b7/a7, but does not check a8
    s.board[2][1] = 'K' // b6, supports
    s.turn = BLACK
    expect(inCheck(s.board, BLACK)).toBe(false)
    expect(legalMoves(s)).toHaveLength(0)
  })
})

describe('chess/engine — serialization', () => {
  it('round-trips board + turn + castling + en passant', () => {
    const s = startGame(createGame())
    mv(s, [6, 4], [4, 4]) // e4 → en passant target appears
    const str = serialize(s)
    const back = deserialize(str)
    expect(back.board).toEqual(s.board)
    expect(back.turn).toBe(s.turn)
    expect(back.castling).toEqual(s.castling)
    expect(back.enPassant).toEqual(s.enPassant)
  })
})

describe('chess/engine — nextState (pure child generator for the AI search)', () => {
  it('produces the next core state without mutating the input', () => {
    const s = startGame(createGame())
    const before = serialize(s)
    // e2-e4 (a pawn double push) → en-passant target appears, turn flips
    const ns = nextState(s, { from: [6, 4], to: [4, 4] })
    expect(serialize(s)).toBe(before) // original untouched
    expect(ns.board[4][4]).toBe('P')
    expect(ns.board[6][4]).toBe('.')
    expect(ns.turn).toBe(BLACK)
    expect(ns.moves).toBe(s.moves + 1)
    expect(ns.enPassant).toEqual([5, 4])
    expect(ns.castling).toEqual(s.castling)
  })

  it('agrees with applyMove on the resulting board/turn/castling', () => {
    const s = startGame(createGame())
    const move = { from: [6, 4], to: [4, 4] }
    const ns = nextState(s, move)
    const clone = startGame(createGame())
    applyMove(clone, move)
    expect(ns.board).toEqual(clone.board)
    expect(ns.turn).toBe(clone.turn)
    expect(ns.castling).toEqual(clone.castling)
    expect(ns.enPassant).toEqual(clone.enPassant)
  })

  it('drops castling rights when the king moves', () => {
    const s = withKings()
    s.turn = WHITE
    const ns = nextState(s, { from: [7, 4], to: [7, 5] }) // Ke1-f1
    expect(ns.castling.wk).toBe(false)
    expect(ns.castling.wq).toBe(false)
  })
})
