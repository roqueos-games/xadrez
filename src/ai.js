/**
 * XADREZ — AI opponent (pure, unit-tested). Negamax + alpha-beta over the engine
 * move generator, with a material + piece-square-table evaluation and
 * capture-first move ordering. Difficulty = search depth + a "blunder" chance,
 * so Fácil is beatable and Difícil is sharp. Framework-free; the component runs
 * bestMove() off a timer so the "thinking" UI paints first.
 *
 * Board convention (from engine.js): row 0 = rank 8 (Black back rank), row 7 =
 * rank 1 (White). Piece-square tables are written from White's perspective in
 * those same rows; a Black piece reads the vertically-mirrored row (7 - r), and
 * its contribution is negated — so the symmetric start position evaluates to 0.
 */
import { legalMoves, nextState, colorOf, WHITE, inCheck } from './engine'

const MATE = 100000
const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 }

// prettier-ignore
const PST_P = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
]
// prettier-ignore
const PST_N = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
]
// prettier-ignore
const PST_B = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 5, 5, 10, 10, 5, 5, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
]
// prettier-ignore
const PST_R = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [5, 10, 10, 10, 10, 10, 10, 5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [0, 0, 0, 5, 5, 0, 0, 0],
]
// prettier-ignore
const PST_Q = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 5, 5, 5, 0, -10],
  [-5, 0, 5, 5, 5, 5, 0, -5],
  [0, 0, 5, 5, 5, 5, 0, -5],
  [-10, 5, 5, 5, 5, 5, 0, -10],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
]
// prettier-ignore
const PST_K = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20],
]
const PST = { P: PST_P, N: PST_N, B: PST_B, R: PST_R, Q: PST_Q, K: PST_K }

/** Static score, from White's side (positive = White is better). */
export function evaluate(state) {
  const b = state.board
  let s = 0
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const ch = b[r][c]
      if (ch === '.') continue
      const T = ch.toUpperCase()
      const white = colorOf(ch) === WHITE
      const base = VAL[T] + (white ? PST[T][r][c] : PST[T][7 - r][c])
      s += white ? base : -base
    }
  }
  return s
}

// negamax works from the side-to-move's perspective
const evalRelative = (state) => (state.turn === WHITE ? evaluate(state) : -evaluate(state))

/** Legal moves ordered captures/promotions first (MVV-LVA-ish) for good pruning. */
export function orderMoves(state) {
  const b = state.board
  const scoreOf = (m) => {
    let sc = 0
    const tgt = b[m.to[0]][m.to[1]]
    if (tgt !== '.') sc += 10 * VAL[tgt.toUpperCase()] - VAL[b[m.from[0]][m.from[1]].toUpperCase()]
    if (m.enPassant) sc += 10 * VAL.P
    if (m.promo) sc += VAL[m.promo]
    return sc
  }
  return legalMoves(state)
    .map((m) => ({ m, sc: scoreOf(m) }))
    .sort((a, z) => z.sc - a.sc)
    .map((x) => x.m)
}

/**
 * O mate, visto de quem está para jogar e não tem lance nenhum.
 *
 * O `ply` entra SOMANDO: levar mate no lance 6 é menos ruim do que levar no
 * lance 2. É essa soma que faz a IA resistir em vez de aceitar o mate mais
 * curto, e que faz ela FECHAR uma partida ganha em vez de adiar. Fica exposta
 * porque por dentro da busca as duas versões são o mesmo número enorme e
 * negativo, e nenhum tabuleiro separa uma da outra.
 */
export const mateScoreAt = (ply) => -MATE + ply

/**
 * A folha da árvore: acabou a profundidade e a posição vale o que a avaliação
 * estática disser. Exposta pelo mesmo motivo que a de cima: é o horizonte da
 * busca, e por dentro da recursão um horizonte um lance mais fundo devolve
 * quase sempre a mesma jogada.
 */
export const isLeaf = (depth) => depth <= 0

function negamax(state, depth, alpha, beta, ply) {
  const moves = orderMoves(state)
  if (moves.length === 0) {
    // no legal moves → checkmate (in check) is a loss; else stalemate (draw)
    return inCheck(state.board, state.turn) ? mateScoreAt(ply) : 0
  }
  if (isLeaf(depth)) return evalRelative(state)
  let best = -Infinity
  for (const m of moves) {
    const sc = -negamax(nextState(state, m), depth - 1, -beta, -alpha, ply + 1)
    // Math.max, e não `if (sc > best) best = sc`: reatribuir um valor IGUAL não
    // muda nada, então `>` e `>=` decidem o mesmo aqui e a comparação solta
    // deixava um mutante que nenhum teste pode matar.
    best = Math.max(best, sc)
    alpha = Math.max(alpha, best)
    if (alpha >= beta) break
  }
  return best
}

export const LEVELS = {
  easy: { depth: 1, blunder: 0.45, window: 60 },
  medium: { depth: 2, blunder: 0.12, window: 30 },
  hard: { depth: 3, blunder: 0, window: 0 },
}

/**
 * Best move for `state.turn` at the given level. `rng` is injectable for
 * deterministic tests. Returns a legal move object (or null if none).
 */
export function bestMove(state, level = 'medium', rng = Math.random) {
  const cfg = LEVELS[level] || LEVELS.medium
  const moves = orderMoves(state)
  if (!moves.length) return null
  // an easy bot occasionally just plays a random legal move (a human blunder)
  if (cfg.blunder && rng() < cfg.blunder) return moves[Math.floor(rng() * moves.length)]

  let bestScore = -Infinity
  const scored = []
  for (const m of moves) {
    const sc = -negamax(nextState(state, m), cfg.depth - 1, -Infinity, Infinity, 1)
    scored.push({ m, sc })
    bestScore = Math.max(bestScore, sc)
  }
  // pick among near-best so play isn't robotically repetitive (hard = strict)
  const pool = scored.filter((x) => x.sc >= bestScore - cfg.window)
  return (pool.length ? pool[Math.floor(rng() * pool.length)] : scored[0]).m
}
