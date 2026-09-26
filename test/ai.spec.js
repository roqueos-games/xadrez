import { describe, it, expect } from 'vitest'
import { createGame, startGame, applyMove, legalMoves } from '../src/engine.js'
import { bestMove, evaluate, orderMoves, mateScoreAt, isLeaf, LEVELS } from '../src/ai.js'

const emptyBoard = () => Array.from({ length: 8 }, () => new Array(8).fill('.'))
// minimal state that the AI + engine read (board/turn/castling/enPassant)
const st = (board, turn = 'w') => ({
  board,
  turn,
  castling: { wk: false, wq: false, bk: false, bq: false },
  enPassant: null,
})
const sameMove = (a, b) =>
  a.from[0] === b.from[0] && a.from[1] === b.from[1] && a.to[0] === b.to[0] && a.to[1] === b.to[1]

describe('chess/ai', () => {
  it('evaluates the symmetric start position as 0', () => {
    const g = startGame(createGame())
    expect(evaluate(g)).toBe(0)
  })

  it('orders captures/promotions ahead of quiet moves', () => {
    // white pawn e2 can capture a black queen on d3
    const b = emptyBoard()
    b[7][4] = 'K'
    b[0][4] = 'k'
    b[6][4] = 'P'
    b[5][3] = 'q'
    const ordered = orderMoves(st(b))
    expect(ordered[0].to).toEqual([5, 3]) // the queen capture ranks first
  })

  it('returns a legal move from the opening', () => {
    const g = startGame(createGame())
    const m = bestMove(g, 'medium', () => 0.9) // avoid the blunder branch
    expect(m).toBeTruthy()
    expect(legalMoves(g).some((lm) => sameMove(lm, m))).toBe(true)
  })

  it('grabs a hanging queen for free (hard)', () => {
    const b = emptyBoard()
    b[7][4] = 'K'
    b[0][4] = 'k'
    b[6][4] = 'P' // white pawn e2
    b[5][3] = 'q' // undefended black queen d3
    const m = bestMove(st(b), 'hard')
    expect(m.to).toEqual([5, 3]) // exd3 wins the queen
  })

  it('finds mate in one (hard)', () => {
    // black king a8, white king c6, white queen b1 → Qb7#
    const b = emptyBoard()
    b[0][0] = 'k'
    b[2][2] = 'K'
    b[7][1] = 'Q'
    const m = bestMove(st(b), 'hard')
    // apply on a full playing state and confirm it is checkmate
    const g = createGame()
    g.board = b.map((row) => row.slice())
    g.turn = 'w'
    g.castling = { wk: false, wq: false, bk: false, bq: false }
    g.enPassant = null
    g.status = 'playing'
    const r = applyMove(g, m)
    expect(r.ok).toBe(true)
    expect(g.status).toBe('checkmate')
    expect(g.winner).toBe('w')
  })

  it('easy blunders a random legal move when the RNG says so', () => {
    const g = startGame(createGame())
    // rng()=0 → 0 < 0.45 (easy blunder) → returns orderMoves[0]
    const m = bestMove(g, 'easy', () => 0)
    expect(sameMove(m, orderMoves(g)[0])).toBe(true)
  })

  it('exposes monotonically deeper difficulty levels', () => {
    expect(LEVELS.easy.depth).toBeLessThan(LEVELS.medium.depth)
    expect(LEVELS.medium.depth).toBeLessThan(LEVELS.hard.depth)
    expect(LEVELS.hard.blunder).toBe(0)
  })
})

describe('chess/ai: a peça vale o que ela é MAIS onde ela está', () => {
  /**
   * A avaliação é material somado à tabela de casas, e a soma é o que faz o
   * cavalo sair da borda e o peão avançar. Trocada por subtração, a IA continua
   * jogando: ela só passa a preferir exatamente as casas erradas, o que na tela
   * aparece como uma IA "esquisita" e não como um defeito.
   */
  const so = (r, c, peca) => {
    const b = emptyBoard()
    b[r][c] = peca
    return st(b)
  }

  it('o peão branco no centro avançado vale mais do que o parado na frente do rei', () => {
    expect(evaluate(so(3, 3, 'P'))).toBe(125) // 100 de peão + 25 da casa
    expect(evaluate(so(6, 3, 'P'))).toBe(80) // 100 de peão menos 20 da casa
  })

  it('cavalo na borda é cavalo dormindo, e a conta diz isso', () => {
    expect(evaluate(so(3, 3, 'N'))).toBe(340) // 320 + 20
    expect(evaluate(so(0, 0, 'N'))).toBe(270) // 320 menos 50
  })

  it('a peça preta lê a tabela espelhada e entra com o sinal trocado', () => {
    // Linha 4 para as pretas é a mesma casa que a linha 3 para as brancas.
    expect(evaluate(so(4, 3, 'p'))).toBe(-125)
    expect(evaluate(so(1, 3, 'p'))).toBe(-80)
  })
})

describe('chess/ai: as duas bordas da busca', () => {
  it('levar mate mais tarde pontua mais alto, exatamente por lance', () => {
    expect(mateScoreAt(0)).toBe(-100000)
    expect(mateScoreAt(6)).toBeGreaterThan(mateScoreAt(2))
    expect(mateScoreAt(6) - mateScoreAt(2)).toBe(4)
  })

  it('a folha é a profundidade zero, não a negativa', () => {
    // Com `< 0` no lugar do `<= 0` a busca desce um lance a mais do que o nível
    // promete, e o "Fácil" passa a enxergar o que só o "Difícil" deveria ver.
    expect(isLeaf(1)).toBe(false)
    expect(isLeaf(0)).toBe(true)
    expect(isLeaf(-1)).toBe(true)
  })
})

describe('chess/ai: de onde vem o erro e de onde vem o nível', () => {
  const dado = (...v) => {
    let i = 0
    return () => v[Math.min(i++, v.length - 1)]
  }

  it('o erro do fácil sai do dado, e o dado é lido duas vezes', () => {
    // `cfg.blunder && rng() < cfg.blunder`: o primeiro lado liga o erro no
    // nível, o segundo joga o dado. Virado `||`, o nível sozinho já erra
    // SEMPRE, e o número que deveria decidir vira o índice do lance sorteado.
    const g = startGame(createGame())
    const lances = orderMoves(g)
    const chutado = bestMove(g, 'easy', dado(0.1, 0.6))
    expect(sameMove(chutado, lances[Math.floor(0.6 * lances.length)])).toBe(true)
  })

  it('um nível desconhecido cai no médio em vez de derrubar a partida', () => {
    const g = startGame(createGame())
    const inventado = bestMove(g, 'nivel-que-nao-existe', dado(0.9, 0.3))
    const medio = bestMove(g, 'medium', dado(0.9, 0.3))
    expect(sameMove(inventado, medio)).toBe(true)
  })
})
