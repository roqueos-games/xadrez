import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  roundRectPath,
  paintBoard,
  bakeChessSet,
  bakeDiscSet,
  drawChessPiece,
  drawCheckersDisc,
  spriteUrl,
  BOARD_THEME,
} from '../src/arteDoTabuleiro.js'

// Recording canvas-2D stub: counts calls, tolerates any method/property.
//
// Ele GUARDA os argumentos e as atribuições de propriedade, de propósito. A
// versão anterior fazia `void args` e só contava chamadas: uma casa desenhada
// na coordenada errada, ou pintada com a cor da casa vizinha, produzia
// exatamente a mesma contagem e o teste passava. Contar chamada mede que o
// código rodou; guardar argumento mede que ele desenhou a coisa certa.
const makeCtx = () => {
  const calls = {}
  const log = []
  const stub = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === '__calls') return calls
      if (prop === '__log') return log
      if (prop === Symbol.toPrimitive) return () => 0
      return (...args) => {
        calls[prop] = (calls[prop] || 0) + 1
        log.push([prop, ...args])
        return stub
      }
    },
    set: (_t, prop, value) => {
      log.push([`=${String(prop)}`, value])
      return true
    },
    apply: () => stub,
  })
  return stub
}

/** Só as chamadas de um método, com seus argumentos. */
const chamadas = (c, metodo) => c.__log.filter(([m]) => m === metodo).map(([, ...args]) => args)

describe('games/boardArt', () => {
  let origGetContext
  beforeEach(() => {
    origGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => makeCtx())
  })
  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext
  })

  it('roundRectPath builds a closed rounded-rect path (Safari-14 safe, no ctx.roundRect)', () => {
    const c = makeCtx()
    roundRectPath(c, 0, 0, 100, 100, 12)
    expect(c.__calls.beginPath).toBe(1)
    expect(c.__calls.moveTo).toBe(1)
    expect(c.__calls.arcTo).toBe(4)
    expect(c.__calls.closePath).toBe(1)
  })

  it('paintBoard paints the frame plus all 64 squares', () => {
    const c = makeCtx()
    paintBoard(c, { x: 40, y: 40, cell: 40, frame: 18, lowEnd: true, coords: false })
    // 64 squares + 2 field overlays (sheen + vignette)
    expect(c.__calls.fillRect).toBeGreaterThanOrEqual(66)
    expect(c.__calls.fill).toBeGreaterThanOrEqual(1) // walnut frame
  })

  it('paintBoard engraves 16 coordinates when enabled and the board is big enough', () => {
    const c = makeCtx()
    paintBoard(c, { x: 40, y: 40, cell: 48, frame: 20, lowEnd: true, coords: true })
    expect(c.__calls.fillText).toBe(16) // 8 files + 8 ranks
  })

  it('bakeChessSet bakes all 12 piece sprites', () => {
    const set = bakeChessSet(48, 2)
    expect(set.size).toBe(12)
    for (const ch of ['P', 'N', 'B', 'R', 'Q', 'K', 'p', 'n', 'b', 'r', 'q', 'k']) {
      expect(set.get(ch)).toBeInstanceOf(HTMLCanvasElement)
    }
  })

  it('bakeDiscSet bakes men + kings for both players', () => {
    const set = bakeDiscSet(48, 2)
    expect([...set.keys()].sort()).toEqual(['1', '2', 'K1', 'K2'])
  })

  it('every chess piece draws as a filled + stroked vector silhouette (never a text glyph)', () => {
    for (const ch of ['P', 'N', 'B', 'R', 'Q', 'K', 'p', 'q']) {
      const c = makeCtx()
      drawChessPiece(c, ch)
      expect(c.__calls.fill).toBeGreaterThanOrEqual(2) // ground shadow + body
      expect(c.__calls.stroke).toBeGreaterThanOrEqual(1) // outline
      expect(c.__calls.fillText).toBeUndefined() // no Unicode glyphs
    }
  })

  it('a checkers king stacks two cylinders and wears the crown', () => {
    const man = makeCtx()
    drawCheckersDisc(man, 1, false)
    const king = makeCtx()
    drawCheckersDisc(king, 1, true)
    expect(king.__calls.ellipse).toBeGreaterThan(man.__calls.ellipse)
    expect(king.__calls.closePath).toBeGreaterThanOrEqual(1) // crown path
  })

  it('spriteUrl degrades to an empty string where toDataURL is unavailable (jsdom)', () => {
    const cv = document.createElement('canvas')
    expect(spriteUrl(cv)).toBe('')
    expect(spriteUrl(cv)).toBe('') // memoized — no repeated probe
  })

  it('exposes the classic tournament palette', () => {
    expect(BOARD_THEME.light).toBe('#f0d9b5')
    expect(BOARD_THEME.dark).toBe('#b58863')
  })
})

describe('games/boardArt: onde cada casa cai, e de que cor ela é', () => {
  /**
   * O tabuleiro é aritmética de coordenada pura, e é exatamente o tipo de
   * código que "parece funcionar": qualquer erro de sinal ainda desenha 64
   * quadrados, só que no lugar errado. Contar quadrados não distingue as duas
   * coisas; as coordenadas distinguem.
   */
  const semMoldura = () => {
    const c = makeCtx()
    paintBoard(c, { x: 100, y: 200, cell: 10, frame: 0, lowEnd: true, coords: false })
    return c
  }

  it('as 64 casas caem na grade exata a partir da origem', () => {
    const quadros = chamadas(semMoldura(), 'fillRect')
    // 64 casas + o brilho e a vinheta que cobrem o campo inteiro.
    expect(quadros).toHaveLength(66)
    expect(quadros[0]).toEqual([100, 200, 10, 10]) // a8
    expect(quadros[7]).toEqual([170, 200, 10, 10]) // h8, fim da primeira fileira
    expect(quadros[8]).toEqual([100, 210, 10, 10]) // a7, uma fileira abaixo
    expect(quadros[63]).toEqual([170, 270, 10, 10]) // h1
    expect(quadros[64]).toEqual([100, 200, 80, 80]) // brilho sobre o campo
  })

  it('a cor alterna casa a casa e recomeça invertida na fileira seguinte', () => {
    const c = semMoldura()
    const cores = c.__log.filter(([m]) => m === '=fillStyle').map(([, v]) => v)
    // A primeira atribuição de cor é o degradê da moldura; as 64 seguintes são
    // as casas, na mesma ordem dos fillRect.
    const casas = cores.slice(1, 65)
    expect(casas[0]).toBe(BOARD_THEME.light)
    expect(casas[1]).toBe(BOARD_THEME.dark)
    expect(casas[7]).toBe(BOARD_THEME.dark)
    expect(casas[8]).toBe(BOARD_THEME.dark) // a fileira seguinte começa escura
    expect(new Set(casas).size).toBe(2)
  })

  it('a moldura envolve o campo, e não fica dentro dele', () => {
    const c = makeCtx()
    paintBoard(c, { x: 100, y: 200, cell: 10, frame: 20, lowEnd: true, coords: false })
    // O contorno dourado abraça o campo com 2.5px de folga de cada lado.
    expect(chamadas(c, 'strokeRect')[0]).toEqual([97.5, 197.5, 85, 85])
  })

  it('as coordenadas só são gravadas quando a casa e a moldura têm tamanho', () => {
    // `cell >= 26 && frame >= 13` são os dois pisos de legibilidade, e ambos
    // são inclusivos: no tamanho exato o texto ainda cabe.
    const noLimite = makeCtx()
    paintBoard(noLimite, { x: 0, y: 0, cell: 26, frame: 13, coords: true, lowEnd: true })
    expect(chamadas(noLimite, 'fillText')).toHaveLength(16)

    const casaPequena = makeCtx()
    paintBoard(casaPequena, { x: 0, y: 0, cell: 25, frame: 13, coords: true, lowEnd: true })
    expect(chamadas(casaPequena, 'fillText')).toHaveLength(0)

    const molduraFina = makeCtx()
    paintBoard(molduraFina, { x: 0, y: 0, cell: 26, frame: 12, coords: true, lowEnd: true })
    expect(chamadas(molduraFina, 'fillText')).toHaveLength(0)
  })

  it('a letra e o número saem nas bordas certas, e o flip troca os dois', () => {
    const normal = makeCtx()
    paintBoard(normal, { x: 0, y: 0, cell: 30, frame: 20, coords: true, lowEnd: true })
    const textos = chamadas(normal, 'fillText')
    expect(textos[0]).toEqual(['a', 15, 250.5]) // abaixo do campo
    expect(textos[1]).toEqual(['8', -10, 15.5]) // à esquerda do campo

    const virado = makeCtx()
    paintBoard(virado, { x: 0, y: 0, cell: 30, frame: 20, coords: true, flip: true, lowEnd: true })
    const invertidos = chamadas(virado, 'fillText')
    expect(invertidos[0]).toEqual(['h', 15, 250.5])
    expect(invertidos[1]).toEqual(['1', -10, 15.5])
  })
})

describe('games/boardArt: o padrão de quem não pede nada', () => {
  it('sem dizer nada sobre coordenadas, o tabuleiro vem COM elas', () => {
    // `coords = true` é o padrão do parâmetro, e é o que a tela de xadrez usa:
    // ela chama sem passar a opção. Virado `false`, o tabuleiro perde as letras
    // e os números sem que nenhuma chamada do produto mude.
    const c = makeCtx()
    paintBoard(c, { x: 0, y: 0, cell: 30, frame: 20, lowEnd: true })
    expect(chamadas(c, 'fillText')).toHaveLength(16)
  })

  it('a dama desenha mais do que a peça simples, nos dois jogadores', () => {
    // Os pares [id, jogador, éDama] de `bakeDiscSet` são o que decide quem
    // ganha coroa. Virados, as quatro peças saem iguais e a dama vira uma peça
    // comum no meio do tabuleiro.
    for (const jogador of [1, 2]) {
      const simples = makeCtx()
      const dama = makeCtx()
      drawCheckersDisc(simples, jogador, false)
      drawCheckersDisc(dama, jogador, true)
      expect(dama.__log.length).toBeGreaterThan(simples.__log.length)
      expect(dama.__calls.ellipse).toBeGreaterThan(simples.__calls.ellipse || 0)
    }
  })
})
