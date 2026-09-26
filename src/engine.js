/**
 * XADREZ — pure, complete chess-rules engine for the RoqueOS Games gallery.
 *
 * Full legal move generation (every piece), castling, en passant, promotion,
 * and check / checkmate / stalemate detection (moves that leave your own king
 * in check are filtered out). No AI — the game is two-player, online (moves
 * relayed over Realtime Database) or local pass-and-play. Framework-free and
 * fully unit-testable.
 *
 * Board: row 0 = rank 8 (black back rank), row 7 = rank 1 (white). White pieces
 * are UPPERCASE (P N B R Q K), black lowercase, '.' empty. White moves up
 * (row −), black down (row +).
 */

export const WHITE = 'w'
export const BLACK = 'b'

const START = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  ['.', '.', '.', '.', '.', '.', '.', '.'],
  ['.', '.', '.', '.', '.', '.', '.', '.'],
  ['.', '.', '.', '.', '.', '.', '.', '.'],
  ['.', '.', '.', '.', '.', '.', '.', '.'],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
]

const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8
export const colorOf = (ch) => (ch === '.' ? null : ch === ch.toUpperCase() ? WHITE : BLACK)
const isEnemy = (ch, color) => ch !== '.' && colorOf(ch) !== color
const isOwn = (ch, color) => ch !== '.' && colorOf(ch) === color
const clone = (b) => b.map((row) => row.slice())
const other = (c) => (c === WHITE ? BLACK : WHITE)

export function createGame(opts = {}) {
  return {
    status: 'idle', // 'idle' | 'playing' | 'checkmate' | 'stalemate'
    board: clone(START),
    turn: WHITE,
    castling: { wk: true, wq: true, bk: true, bq: true },
    enPassant: null, // [r,c] target square or null
    winner: 0, // 0 | WHITE | BLACK (checkmate)
    moves: 0,
    mode: opts.mode || 'local',
  }
}

export function startGame(state) {
  state.board = clone(START)
  state.turn = WHITE
  state.castling = { wk: true, wq: true, bk: true, bq: true }
  state.enPassant = null
  state.winner = 0
  state.moves = 0
  state.status = 'playing'
  return state
}

const KNIGHT = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
]
const KING = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
]
const BISHOP = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]
const ROOK = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

/** Is (tr,tc) attacked by any piece of `byColor`? */
export function squareAttacked(board, tr, tc, byColor) {
  // pawns
  const pd = byColor === WHITE ? 1 : -1 // a byColor pawn sits `pd` rows toward its own side
  for (const dc of [-1, 1]) {
    const r = tr + pd
    const c = tc + dc
    if (inB(r, c)) {
      const ch = board[r][c]
      if (ch !== '.' && colorOf(ch) === byColor && ch.toUpperCase() === 'P') return true
    }
  }
  // knights
  for (const [dr, dc] of KNIGHT) {
    const r = tr + dr
    const c = tc + dc
    if (inB(r, c)) {
      const ch = board[r][c]
      if (ch !== '.' && colorOf(ch) === byColor && ch.toUpperCase() === 'N') return true
    }
  }
  // king
  for (const [dr, dc] of KING) {
    const r = tr + dr
    const c = tc + dc
    if (inB(r, c)) {
      const ch = board[r][c]
      if (ch !== '.' && colorOf(ch) === byColor && ch.toUpperCase() === 'K') return true
    }
  }
  // sliding: diagonals (bishop/queen)
  for (const [dr, dc] of BISHOP) {
    let r = tr + dr
    let c = tc + dc
    while (inB(r, c)) {
      const ch = board[r][c]
      if (ch !== '.') {
        if (colorOf(ch) === byColor && (ch.toUpperCase() === 'B' || ch.toUpperCase() === 'Q'))
          return true
        break
      }
      r += dr
      c += dc
    }
  }
  // sliding: orthogonals (rook/queen)
  for (const [dr, dc] of ROOK) {
    let r = tr + dr
    let c = tc + dc
    while (inB(r, c)) {
      const ch = board[r][c]
      if (ch !== '.') {
        if (colorOf(ch) === byColor && (ch.toUpperCase() === 'R' || ch.toUpperCase() === 'Q'))
          return true
        break
      }
      r += dr
      c += dc
    }
  }
  return false
}

export function findKing(board, color) {
  const k = color === WHITE ? 'K' : 'k'
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c] === k) return [r, c]
  return null
}

export function inCheck(board, color) {
  const kp = findKing(board, color)
  if (!kp) return false
  return squareAttacked(board, kp[0], kp[1], other(color))
}

const PROMOS = ['Q', 'R', 'B', 'N']

/** Pseudo-legal moves (before filtering for own-king safety). */
function pseudoMoves(state) {
  const { board, turn, castling, enPassant } = state
  const out = []
  const add = (fr, fc, tr, tc, extra = {}) => out.push({ from: [fr, fc], to: [tr, tc], ...extra })

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const ch = board[r][c]
      if (ch === '.' || colorOf(ch) !== turn) continue
      const t = ch.toUpperCase()

      if (t === 'P') {
        const fwd = turn === WHITE ? -1 : 1
        const startRow = turn === WHITE ? 6 : 1
        const lastRow = turn === WHITE ? 0 : 7
        // forward 1
        if (inB(r + fwd, c) && board[r + fwd][c] === '.') {
          if (r + fwd === lastRow) for (const p of PROMOS) add(r, c, r + fwd, c, { promo: p })
          else add(r, c, r + fwd, c)
          // forward 2 (the en-passant target is derived from the move distance)
          if (r === startRow && board[r + 2 * fwd][c] === '.') add(r, c, r + 2 * fwd, c)
        }
        // captures + en passant
        for (const dc of [-1, 1]) {
          const nr = r + fwd
          const nc = c + dc
          if (!inB(nr, nc)) continue
          if (isEnemy(board[nr][nc], turn)) {
            if (nr === lastRow) for (const p of PROMOS) add(r, c, nr, nc, { promo: p })
            else add(r, c, nr, nc)
          } else if (enPassant && enPassant[0] === nr && enPassant[1] === nc) {
            add(r, c, nr, nc, { enPassant: true })
          }
        }
      } else if (t === 'N') {
        for (const [dr, dc] of KNIGHT) {
          const nr = r + dr
          const nc = c + dc
          if (inB(nr, nc) && !isOwn(board[nr][nc], turn)) add(r, c, nr, nc)
        }
      } else if (t === 'K') {
        for (const [dr, dc] of KING) {
          const nr = r + dr
          const nc = c + dc
          if (inB(nr, nc) && !isOwn(board[nr][nc], turn)) add(r, c, nr, nc)
        }
        // castling
        const rk = turn === WHITE ? 7 : 0
        if (r === rk && c === 4 && !inCheck(board, turn)) {
          const kSide = turn === WHITE ? castling.wk : castling.bk
          const qSide = turn === WHITE ? castling.wq : castling.bq
          if (
            kSide &&
            board[rk][5] === '.' &&
            board[rk][6] === '.' &&
            board[rk][7] === (turn === WHITE ? 'R' : 'r') &&
            !squareAttacked(board, rk, 5, other(turn)) &&
            !squareAttacked(board, rk, 6, other(turn))
          ) {
            add(r, c, rk, 6, { castle: 'k' })
          }
          if (
            qSide &&
            board[rk][3] === '.' &&
            board[rk][2] === '.' &&
            board[rk][1] === '.' &&
            board[rk][0] === (turn === WHITE ? 'R' : 'r') &&
            !squareAttacked(board, rk, 3, other(turn)) &&
            !squareAttacked(board, rk, 2, other(turn))
          ) {
            add(r, c, rk, 2, { castle: 'q' })
          }
        }
      } else {
        const dirs = t === 'B' ? BISHOP : t === 'R' ? ROOK : [...BISHOP, ...ROOK] // Q
        for (const [dr, dc] of dirs) {
          let nr = r + dr
          let nc = c + dc
          while (inB(nr, nc)) {
            if (board[nr][nc] === '.') add(r, c, nr, nc)
            else {
              if (isEnemy(board[nr][nc], turn)) add(r, c, nr, nc)
              break
            }
            nr += dr
            nc += dc
          }
        }
      }
    }
  }
  return out
}

/** Make a move on a fresh board (no legality check) → new board. */
export function boardAfter(state, m) {
  const b = clone(state.board)
  const [fr, fc] = m.from
  const [tr, tc] = m.to
  let piece = b[fr][fc]
  b[fr][fc] = '.'
  if (m.enPassant) b[fr][tc] = '.' // remove the passed pawn (same row as mover, target col)
  if (m.promo) piece = state.turn === WHITE ? m.promo : m.promo.toLowerCase()
  b[tr][tc] = piece
  if (m.castle === 'k') {
    b[tr][5] = b[tr][7]
    b[tr][7] = '.'
  } else if (m.castle === 'q') {
    b[tr][3] = b[tr][0]
    b[tr][0] = '.'
  }
  return b
}

/** Fully legal moves (own king not left in check). */
export function legalMoves(state) {
  const legal = []
  for (const m of pseudoMoves(state)) {
    const b = boardAfter(state, m)
    if (!inCheck(b, state.turn)) legal.push(m)
  }
  return legal
}

const sameMove = (a, b) =>
  a.from[0] === b.from[0] &&
  a.from[1] === b.from[1] &&
  a.to[0] === b.to[0] &&
  a.to[1] === b.to[1] &&
  (a.promo || null) === (b.promo || null)

/**
 * Apply an already-legal move `m`, returning the next CORE state
 * ({board,castling,enPassant,turn,moves}) WITHOUT status detection. Pure (no
 * mutation of `state`). Used by applyMove and by the AI search, which needs a
 * fast, correct child-state generator for every ply.
 */
export function nextState(state, m) {
  const board = boardAfter(state, m)
  const [fr, fc] = m.from
  const [tr, tc] = m.to
  const piece = state.board[fr][fc]

  // castling rights
  const cst = { ...state.castling }
  if (piece === 'K') {
    cst.wk = false
    cst.wq = false
  }
  if (piece === 'k') {
    cst.bk = false
    cst.bq = false
  }
  if (fr === 7 && fc === 0) cst.wq = false
  if (fr === 7 && fc === 7) cst.wk = false
  if (fr === 0 && fc === 0) cst.bq = false
  if (fr === 0 && fc === 7) cst.bk = false
  if (tr === 7 && tc === 0) cst.wq = false
  if (tr === 7 && tc === 7) cst.wk = false
  if (tr === 0 && tc === 0) cst.bq = false
  if (tr === 0 && tc === 7) cst.bk = false

  // en passant target (only when a pawn moved two squares)
  let enPassant = null
  if (piece.toUpperCase() === 'P' && Math.abs(tr - fr) === 2) enPassant = [(fr + tr) / 2, fc]

  return { board, castling: cst, enPassant, turn: other(state.turn), moves: state.moves + 1 }
}

/** Apply a legal move; updates castling/en-passant, toggles turn, sets status. */
export function applyMove(state, move) {
  const legal = legalMoves(state)
  const m = legal.find((lm) => sameMove(lm, move))
  if (!m) return { ok: false }
  const mover = state.turn
  const [tr, tc] = m.to
  const captured = state.board[tr][tc] !== '.' || m.enPassant

  const ns = nextState(state, m)
  state.board = ns.board
  state.castling = ns.castling
  state.enPassant = ns.enPassant
  state.turn = ns.turn
  state.moves = ns.moves

  const opponentMoves = legalMoves(state)
  if (opponentMoves.length === 0) {
    if (inCheck(state.board, state.turn)) {
      state.status = 'checkmate'
      state.winner = mover
    } else {
      state.status = 'stalemate'
      state.winner = 0
    }
  }
  return { ok: true, captured, check: inCheck(state.board, state.turn) }
}

export const isGameOver = (state) => state.status === 'checkmate' || state.status === 'stalemate'

// ── Serialization for online sync (compact, FEN-ish) ─────────────────────────
export function serialize(state) {
  const rows = state.board.map((row) => row.join(''))
  const cst =
    (state.castling.wk ? 'K' : '') +
      (state.castling.wq ? 'Q' : '') +
      (state.castling.bk ? 'k' : '') +
      (state.castling.bq ? 'q' : '') || '-'
  const ep = state.enPassant ? `${state.enPassant[0]}${state.enPassant[1]}` : '-'
  return `${rows.join('/')} ${state.turn} ${cst} ${ep}`
}

export function deserialize(str) {
  const [boardPart, turn, cst = '-', ep = '-'] = str.split(' ')
  const board = boardPart.split('/').map((row) => row.split(''))
  const castling = {
    wk: cst.includes('K'),
    wq: cst.includes('Q'),
    bk: cst.includes('k'),
    bq: cst.includes('q'),
  }
  const enPassant = ep === '-' ? null : [Number(ep[0]), Number(ep[1])]
  return { board, turn: turn || WHITE, castling, enPassant }
}
