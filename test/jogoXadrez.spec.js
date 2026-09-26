// O Xadrez inteiro, montado pelo contrato do jogo-sdk com o host falso.
//
// Nenhum mock de store, de analytics, de i18n ou do `useRealtimeMatch` do
// RoqueOS: se o jogo ainda alcançasse algo do RoqueOS, este arquivo não rodaria
// fora dele. Os sete casos do teste que rodava no front antes da extração, em
// 25/09/2026, estão aqui (marcados com "Do front:"), com os do contrato e os da
// partida online em volta. O único mock é o do three, porque o jsdom não tem
// WebGL (ver threeStub.js); a sala é a do host falso, com as mesmas regras de
// quem senta onde que o RoqueOS usa.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import * as THREE from 'three'
import { VERSAO_DO_CONTRATO } from '@roqueos-games/jogo-sdk'
import { criarHostFalso } from '@roqueos-games/jogo-sdk/host-falso'
import jogo from '../src/index.js'
import { traduzir } from '../src/textos.js'
import { createGame, startGame, applyMove, serialize } from '../src/engine.js'
import { sqToWorld } from '../src/tabuleiro3d.js'
import ptBR from '../i18n/pt-BR.json'
import enUS from '../i18n/en-US.json'
import tela from '../src/JogoXadrez.vue?raw'

vi.mock('three', async () => (await import('./threeStub.js')).criarThreeFalso())

// A textura do tabuleiro e as figuras 2D das peças são desenhadas em canvas 2D.
// O jsdom não tem canvas 2D; este contexto aceita qualquer chamada, de qualquer
// profundidade, e não desenha nada (o mesmo dublê do teste de lá).
const ctx2d = () => {
  const stub = new Proxy(function () {}, {
    get: (_t, prop) => (prop === Symbol.toPrimitive ? () => 0 : stub),
    set: () => true,
    apply: () => stub,
  })
  return stub
}
// Uma figura qualquer no lugar do PNG da peça. O jsdom não implementa o
// `toDataURL`, e sem figura o cartão não mostra as peças tomadas.
const FIGURA = 'data:image/png;base64,eA=='

const RETANGULO = { left: 0, top: 0, width: 480, height: 560, right: 480, bottom: 560, x: 0, y: 0 }

let el = null
let host = null
let montagem = null

const palco = () => {
  el = document.createElement('div')
  document.body.appendChild(el)
  return el
}
const montou = () =>
  vi.waitFor(() => {
    if (!el.querySelector('.ros-chess')) throw new Error('o Xadrez ainda não montou')
  })
const montarCom = async (h, { ativo = true } = {}) => {
  host = h
  montagem = jogo.mount(palco(), host, { windowId: 'w1', ativo })
  // O app só monta com o texto do idioma carregado.
  await montou()
  await nextTick()
}
// Com conta, por padrão: a partida online pede conta. O convidado tem teste
// próprio.
const montar = ({ ativo = true, ...opcoesDoHost } = {}) =>
  montarCom(criarHostFalso({ jogoId: 'chess', uid: 'eu', nome: 'Roque', ...opcoesDoHost }), {
    ativo,
  })
const $ = (sel) => el.querySelector(sel)
const $$ = (sel) => [...el.querySelectorAll(sel)]
const texto = (sel) => $(sel)?.textContent.trim()
const eventos = (nome) =>
  host.chamadas.filter((c) => c.capacidade === 'metricas' && c.args[0] === nome)
const avisos = () => host.chamadas.filter((c) => c.capacidade === 'avisar').map((c) => c.args)
const tecla = (key) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))
const esperar = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
  await nextTick()
}
const botaoDoMenu = (chave) =>
  $$('.ros-chess__mbtn').find((b) => b.querySelector('span')?.textContent === ptBR[chave])
const canvas = () => $('.ros-chess__canvas')
const renderizador = () => canvas().__renderizador
// Um toque de verdade no tabuleiro: o `tabuleiro3d.js` ouve o ponteiro no
// canvas, e o raycaster do dublê acerta a casa pedida. Evento "cru", como no
// teste do tabuleiro: o jsdom não tem PointerEvent.
const ponteiro = (tipo, x = 240, y = 280) => {
  const ev = new Event(tipo, { bubbles: true, cancelable: true })
  Object.assign(ev, { pointerId: 1, isPrimary: true, clientX: x, clientY: y })
  canvas().dispatchEvent(ev)
}
const tocar = (r, c) => {
  THREE.Raycaster.mira = sqToWorld(r, c)
  ponteiro('pointerdown')
  ponteiro('pointerup')
  THREE.Raycaster.mira = null
}
// O `estado` da sala depois de uma lista de lances, como o outro lado mandaria.
const depoisDe = (...lances) => {
  const g = createGame({ mode: 'online' })
  startGame(g)
  for (const [from, to] of lances) applyMove(g, { from, to })
  return serialize(g)
}
const E4 = [
  [6, 4],
  [4, 4],
]
const E5 = [
  [1, 4],
  [3, 4],
]
const F3 = [
  [6, 5],
  [5, 5],
]
const G4 = [
  [6, 6],
  [4, 6],
]
const DH4 = [
  [0, 3],
  [4, 7],
]
const codigoNaTela = () => texto('.ros-chess__code')
// Cria a sala pela tela, como o anfitrião, e devolve o código.
const criarSalaPelaTela = async () => {
  $('.ros-chess__mbtn--online').click()
  await vi.waitFor(() => expect($('.ros-chess__wait')).not.toBeNull())
  return codigoNaTela()
}
// Entra numa sala pela tela, como o convidado.
const entrarPelaTela = async (codigo) => {
  botaoDoMenu('joinOnline').click()
  await nextTick()
  const campo = $('.ros-chess__code-input')
  campo.value = codigo
  campo.dispatchEvent(new Event('input'))
  await nextTick()
  $('.ros-chess__solid-btn').click()
  await esperar()
}

describe('Xadrez pelo jogo-sdk', () => {
  let origCtx
  let fila = []
  beforeEach(() => {
    window.__ROS_E2E__ = {} // instala o gancho __chess
    origCtx = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx2d())
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(FIGURA)
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(RETANGULO)
    // O laço do tabuleiro 3D pede quadro a quadro; aqui o quadro só anda quando
    // o teste manda (quase nunca: o que o teste olha é o estado, não o desenho).
    fila = []
    vi.stubGlobal('requestAnimationFrame', (fn) => fila.push(fn))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    THREE.Raycaster.mira = null
  })
  afterEach(() => {
    montagem?.desmontar()
    el?.remove()
    montagem = null
    el = null
    host = null
    HTMLCanvasElement.prototype.getContext = origCtx
    THREE.Raycaster.mira = null
    delete window.__ROS_E2E__
    delete window.__chess
    delete window.devicePixelRatio
    delete navigator.clipboard
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('é um jogo do SDK, com o id que o catálogo e a sala usam, e pede a sala', () => {
    expect(jogo.id).toBe('chess')
    expect(jogo.versaoDoContrato).toBe(VERSAO_DO_CONTRATO)
    expect(jogo.capacidades).toEqual(['sala'])
  })

  it('um host sem a sala é recusado ao montar, em vez de quebrar no clique', () => {
    const semSala = criarHostFalso({ jogoId: 'chess', sala: false })
    expect(() => jogo.mount(palco(), semSala, { ativo: true })).toThrow(/sala/)
  })

  // Do front: 'opens on the menu with vs-AI, local + online options'.
  it('abre no menu, com o nome do jogo e as quatro opções', async () => {
    await montar()
    expect(texto('.ros-chess__logo')).toBe(ptBR.title)
    expect(texto('.ros-chess__sub')).toBe(ptBR.tagline)
    expect($$('.ros-chess__mbtn')).toHaveLength(4)
    expect($('.ros-chess__mbtn--ai')).not.toBeNull()
    expect($('.ros-chess__mbtn--online')).not.toBeNull()
    expect($$('.ros-chess__mbtn span').map((s) => s.textContent)).toEqual([
      ptBR.vsAi,
      ptBR.local,
      ptBR.createOnline,
      ptBR.joinOnline,
    ])
    // As duas peças do menu são as figuras 2D, desenhadas ao montar.
    expect($$('.ros-chess__hero-piece')).toHaveLength(2)
    expect(window.__chess.state.status).toBe('playing')
  })

  it('fala o idioma do host, e troca quando o host troca', async () => {
    await montar({ idioma: 'en-US' })
    expect(texto('.ros-chess__logo')).toBe(enUS.title)
    expect(texto('.ros-chess__mbtn--ai span')).toBe(enUS.vsAi)
    host.disparar('idioma', 'pt-BR')
    await vi.waitFor(() => expect(texto('.ros-chess__logo')).toBe(ptBR.title))
    expect(texto('.ros-chess__mbtn--ai span')).toBe(ptBR.vsAi)
  })

  it('em árabe o jogo se desenha da direita para a esquerda', async () => {
    await montar({ idioma: 'ar-AR' })
    expect($('.ros-chess').getAttribute('dir')).toBe('rtl')
  })

  // Do front: 'vs AI: opens the setup, starts a match, and the bot replies'.
  it('contra a IA: a escolha de lado e nível, e a IA responde depois de pensar', async () => {
    await montar()
    $('.ros-chess__mbtn--ai').click()
    await nextTick()
    expect($('.ros-chess__side-row')).not.toBeNull()
    expect($$('.ros-chess__mbtn span').map((s) => s.textContent)).toEqual([
      ptBR.level_easy,
      ptBR.level_medium,
      ptBR.level_hard,
    ])
    vi.useFakeTimers()
    $$('.ros-chess__mbtn')[0].click() // Fácil, de brancas
    expect(window.__chess.state.status).toBe('playing')
    expect(eventos('game_start').map((c) => c.args)).toEqual([
      ['game_start', { mode: 'ai', level: 'easy' }],
    ])
    window.__chess.move(...E4) // o humano (brancas) joga e4, a IA (pretas) responde
    expect(window.__chess.thinking).toBe(true)
    await nextTick()
    expect(texto('.ros-chess__thinking')).toBe(ptBR.thinking)
    expect($$('.ros-chess__pontos i')).toHaveLength(3)
    vi.advanceTimersByTime(400)
    expect(window.__chess.state.moves).toBe(1)
    vi.advanceTimersByTime(200)
    expect(window.__chess.state.moves).toBe(2) // a IA respondeu
    expect(window.__chess.state.turn).toBe('w') // de volta ao humano
    expect(window.__chess.thinking).toBe(false)
  })

  it('contra a IA de pretas: a IA abre, e o humano fica embaixo, com as pretas', async () => {
    await montar()
    $('.ros-chess__mbtn--ai').click()
    await nextTick()
    $$('.ros-chess__side')[1].click() // Pretas
    await nextTick()
    expect($$('.ros-chess__side')[1].classList.contains('is-on')).toBe(true)
    vi.useFakeTimers()
    $$('.ros-chess__mbtn')[2].click() // Difícil
    await nextTick()
    expect($('.ros-chess__pcard--bottom .ros-chess__avatar').classList.contains('is-b')).toBe(true)
    expect(texto('.ros-chess__pcard--top .ros-chess__pname')).toBe(
      `${ptBR.ai} · ${ptBR.level_hard}`,
    )
    expect(texto('.ros-chess__pcard--bottom .ros-chess__pname')).toBe('Roque')
    vi.advanceTimersByTime(600)
    expect(window.__chess.state.moves).toBe(1) // a IA, de brancas, abriu
    expect(window.__chess.state.turn).toBe('b')
  })

  // Do front: 'starts a local game (20 opening moves) and tracks it'.
  it('jogar local começa a partida, com os cartões de brancas e pretas e game_start de antes', async () => {
    await montar()
    botaoDoMenu('local').click()
    await nextTick()
    expect(window.__chess.state.status).toBe('playing')
    expect(eventos('game_start').map((c) => c.args)).toEqual([['game_start', { mode: 'local' }]])
    expect(texto('.ros-chess__pcard--top .ros-chess__pname')).toBe(ptBR.black)
    expect(texto('.ros-chess__pcard--bottom .ros-chess__pname')).toBe(ptBR.white)
    expect($('.ros-chess__pcard--bottom').classList.contains('is-active')).toBe(true)
    expect($('.ros-chess__menu')).toBeNull()
  })

  it('o clique que começa a partida destrava o áudio no mesmo gesto', async () => {
    await montar()
    expect(host.contar('audio', 'destravar')).toBe(0)
    botaoDoMenu('local').click()
    expect(host.contar('audio', 'destravar')).toBe(1)
  })

  // Do front: 'plays a move and hands over the turn'.
  it('um lance passa a vez, e o cartão aceso troca', async () => {
    await montar()
    window.__chess.startLocal()
    window.__chess.move(...E4)
    expect(window.__chess.state.board[4][4]).toBe('P')
    expect(window.__chess.state.turn).toBe('b')
    await nextTick()
    expect($('.ros-chess__pcard--top').classList.contains('is-active')).toBe(true)
    expect($('.ros-chess__pcard--bottom').classList.contains('is-active')).toBe(false)
  })

  it('tocar na peça e depois na casa joga o lance; tocar na peça do outro não seleciona', async () => {
    await montar()
    window.__chess.startLocal()
    tocar(1, 4) // peão preto, fora da vez
    tocar(4, 4)
    expect(window.__chess.state.moves).toBe(0)
    tocar(6, 4) // e2
    tocar(4, 4) // e4
    expect(window.__chess.state.board[4][4]).toBe('P')
    expect(window.__chess.state.board[6][4]).toBe('.')
    expect(window.__chess.state.turn).toBe('b')
  })

  it('arrastar o tabuleiro gira a câmera e não joga', async () => {
    await montar()
    window.__chess.startLocal()
    tocar(6, 4)
    THREE.Raycaster.mira = sqToWorld(4, 4)
    ponteiro('pointerdown', 200, 280)
    ponteiro('pointermove', 260, 280)
    ponteiro('pointerup', 260, 280)
    expect(window.__chess.state.moves).toBe(0)
  })

  it('o peão que chega na última fileira abre a escolha, e a peça escolhida entra', async () => {
    await montar()
    window.__chess.startLocal()
    const st = window.__chess.state
    // Só os dois reis e um peão branco a um passo de promover.
    st.board = st.board.map((linha) => linha.map(() => '.'))
    st.board[7][4] = 'K'
    st.board[0][7] = 'k'
    st.board[1][0] = 'P'
    st.castling = { wk: false, wq: false, bk: false, bq: false }
    tocar(1, 0)
    tocar(0, 0)
    await nextTick()
    expect($('.ros-chess__promo')).not.toBeNull()
    expect(texto('.ros-chess__promo-title')).toBe(ptBR.promote)
    const opcoes = $$('.ros-chess__promo-btn')
    expect(opcoes).toHaveLength(4) // dama, torre, bispo, cavalo
    expect(st.board[1][0]).toBe('P') // nada anda antes da escolha
    opcoes[3].click()
    await nextTick()
    expect(st.board[0][0]).toBe('N')
    expect($('.ros-chess__promo')).toBeNull()
  })

  // Do front: 'ends the game on the Fool’s Mate'.
  it('o mate do louco encerra a partida, com o resultado e o game_over de antes', async () => {
    await montar()
    window.__chess.startLocal()
    window.__chess.move(...F3)
    window.__chess.move(...E5)
    window.__chess.move(...G4)
    window.__chess.move(...DH4) // Dh4#
    await nextTick()
    expect(window.__chess.state.status).toBe('checkmate')
    expect($('.ros-chess__over')).not.toBeNull()
    expect(texto('.ros-chess__over-title')).toBe(ptBR.blackWins)
    expect(eventos('game_over').map((c) => c.args)).toEqual([
      ['game_over', { result: 'win', mode: 'local' }],
    ])
  })

  it('afogamento é empate: o texto de antes e game_over "draw"', async () => {
    await montar()
    window.__chess.startLocal()
    const st = window.__chess.state
    // Rei preto em h8, rei branco em f7, dama branca em g5: Dg6 afoga.
    st.board = st.board.map((linha) => linha.map(() => '.'))
    st.board[0][7] = 'k'
    st.board[1][5] = 'K'
    st.board[3][6] = 'Q'
    st.castling = { wk: false, wq: false, bk: false, bq: false }
    window.__chess.move([3, 6], [2, 6])
    await nextTick()
    expect(st.status).toBe('stalemate')
    expect(texto('.ros-chess__over-title')).toBe(ptBR.stalemate)
    expect(eventos('game_over').map((c) => c.args)).toEqual([
      ['game_over', { result: 'draw', mode: 'local' }],
    ])
  })

  it('xeque acende o aviso, que some sozinho', async () => {
    await montar()
    vi.useFakeTimers()
    window.__chess.startLocal()
    window.__chess.move(...E4)
    window.__chess.move([1, 5], [2, 5]) // f6
    window.__chess.move([7, 3], [3, 7]) // Dh5+
    await nextTick()
    expect(texto('.ros-chess__check')).toBe(ptBR.check)
    vi.advanceTimersByTime(1000)
    await nextTick()
    // A saída é a <transition> do Vue, que espera dois quadros antes de tirar o
    // elemento; aqui o quadro só anda quando o teste manda.
    expect($('.ros-chess__check').classList.contains('chess-fade-leave-active')).toBe(true)
    for (let i = 0; i < 3; i++) for (const fn of fila.splice(0)) fn(0)
    vi.advanceTimersByTime(300)
    await nextTick()
    expect($('.ros-chess__check')).toBeNull()
  })

  it('a peça tomada vai para o cartão de quem tomou, com a vantagem de material', async () => {
    await montar()
    window.__chess.startLocal()
    window.__chess.move(...E4)
    window.__chess.move([1, 3], [3, 3]) // d5
    window.__chess.move([4, 4], [3, 3]) // exd5
    await nextTick()
    const baixo = $('.ros-chess__pcard--bottom')
    expect(baixo.querySelectorAll('.ros-chess__caps img')).toHaveLength(1)
    expect(baixo.querySelector('.ros-chess__caps b').textContent).toBe('+1')
    expect($('.ros-chess__pcard--top .ros-chess__caps b')).toBeNull()
  })

  it('o × do cartão volta ao menu', async () => {
    await montar()
    window.__chess.startLocal()
    await nextTick()
    const fechar = $('.ros-chess__icon-btn')
    expect(fechar.getAttribute('aria-label')).toBe(ptBR.newGame)
    fechar.click()
    await nextTick()
    expect($('.ros-chess__menu')).not.toBeNull()
    expect($('.ros-chess__pcard')).toBeNull()
  })

  it('stage() monta a cena da capa: meio de partida, seis lances', async () => {
    await montar()
    window.__chess.stage()
    expect(window.__chess.state.moves).toBe(6)
    expect(window.__chess.state.turn).toBe('w')
  })

  // ── Partida online, pela sala do host ──────────────────────────────────────

  // Do front: 'creating an online game shows the QR/code wait screen'.
  it('criar a partida online abre a espera com o código, o QR e o link que o host deu', async () => {
    await montar()
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const codigo = await criarSalaPelaTela()
    expect(codigo).toMatch(/^[A-Z2-9]{5}$/)
    expect(texto('.ros-chess__wait-title')).toBe(ptBR.waiting)
    // A sala nasce com o tabuleiro inicial no formato de antes e a vez das brancas.
    expect(host.salas.ler(codigo)).toMatchObject({
      anfitriao: 'eu',
      nomeDoAnfitriao: 'Roque',
      situacao: 'esperando',
      vez: 'w',
      estado: depoisDe(),
    })
    expect(eventos('game_start').map((c) => c.args)).toEqual([
      ['game_start', { mode: 'online-host' }],
    ])
    await vi.waitFor(() =>
      expect($('.ros-chess__qr')?.getAttribute('src')).toMatch(/^data:image\/png/),
    )
    $('.ros-chess__copy').click()
    await vi.waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`https://host-falso.invalid/chess?sala=${codigo}`),
    )
    await vi.waitFor(() => expect(avisos()).toContainEqual([ptBR.copied, { tipo: 'sucesso' }]))
  })

  it('online, anfitrião: o outro entra, e os lances vão e voltam pela sala no formato de antes', async () => {
    await montar()
    const codigo = await criarSalaPelaTela()
    expect(host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia', nome: 'Bia' })).toEqual({
      ok: true,
    })
    await nextTick()
    expect($('.ros-chess__wait')).toBeNull()
    expect(texto('.ros-chess__net-toast')).toBe(ptBR.oppJoined)
    expect(texto('.ros-chess__pcard--top .ros-chess__pname')).toBe('Bia')
    expect(texto('.ros-chess__pcard--bottom .ros-chess__pname')).toBe('Roque')
    expect($('.ros-chess__pcard--bottom').classList.contains('is-active')).toBe(true)

    tocar(6, 4)
    tocar(4, 4) // e4
    await vi.waitFor(() => expect(host.salas.ler(codigo).estado).toBe(depoisDe(E4)))
    expect(host.salas.ler(codigo)).toMatchObject({ vez: 'b', situacao: 'jogando', vencedor: null })
    // Fora da vez o toque não joga.
    tocar(6, 3)
    tocar(4, 3)
    expect(window.__chess.state.board[6][3]).toBe('P')

    host.disparar('sala', { acao: 'jogar', codigo, estado: depoisDe(E4, E5), vez: 'w' })
    await nextTick()
    expect(window.__chess.state.board[3][4]).toBe('p')
    expect(window.__chess.state.turn).toBe('w')
    expect($('.ros-chess__pcard--bottom').classList.contains('is-active')).toBe(true)

    tocar(7, 6)
    tocar(5, 5) // Cf3
    await vi.waitFor(() =>
      expect(host.salas.ler(codigo).estado).toBe(
        depoisDe(E4, E5, [
          [7, 6],
          [5, 5],
        ]),
      ),
    )
  })

  it('online: o lance vai para a sala no mesmo tique, e a resposta imediata do outro não é desfeita', async () => {
    await montar()
    const codigo = await criarSalaPelaTela()
    host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia', nome: 'Bia' })
    await nextTick()
    window.__chess.move(...E4)
    expect(host.salas.ler(codigo).estado).toBe(depoisDe(E4))
    host.disparar('sala', { acao: 'jogar', codigo, estado: depoisDe(E4, E5), vez: 'w' })
    await esperar()
    expect(host.salas.ler(codigo).estado).toBe(depoisDe(E4, E5))
    expect(window.__chess.state.board[3][4]).toBe('p')
    expect(window.__chess.state.turn).toBe('w')
  })

  // Antes, a partida online nova herdava o cartão aceso da partida anterior até o
  // primeiro lance.
  it('a partida online nova acende as brancas, mesmo vinda de uma partida parada na vez das pretas', async () => {
    await montar()
    host.disparar('sala', { acao: 'criar', codigo: 'ABC23', uid: 'ana', estadoInicial: depoisDe() })
    const pararNasPretas = async () => {
      window.__chess.startLocal()
      window.__chess.move(...E4)
      await nextTick()
      $('.ros-chess__icon-btn').click() // volta ao menu
      await nextTick()
    }
    await pararNasPretas()
    const codigo = await criarSalaPelaTela()
    host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia', nome: 'Bia' })
    await nextTick()
    expect($('.ros-chess__pcard--bottom').classList.contains('is-active')).toBe(true) // eu, brancas
    expect($('.ros-chess__pcard--top').classList.contains('is-active')).toBe(false)

    $('.ros-chess__icon-btn').click()
    await nextTick()
    await pararNasPretas()
    await entrarPelaTela('ABC23')
    expect($('.ros-chess__pcard--top').classList.contains('is-active')).toBe(true) // Ana, brancas
    expect($('.ros-chess__pcard--bottom').classList.contains('is-active')).toBe(false)
  })

  it('online, anfitrião: o mate que chega pela sala é derrota, com o game_over de antes', async () => {
    await montar()
    const codigo = await criarSalaPelaTela()
    host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia', nome: 'Bia' })
    await nextTick()
    window.__chess.move(...F3)
    host.disparar('sala', { acao: 'jogar', codigo, estado: depoisDe(F3, E5), vez: 'w' })
    window.__chess.move(...G4)
    host.disparar('sala', {
      acao: 'jogar',
      codigo,
      estado: depoisDe(F3, E5, G4, DH4),
      vez: 'w',
      vencedor: 'b',
      situacao: 'encerrada',
    })
    await nextTick()
    expect(texto('.ros-chess__over-title')).toBe(ptBR.youLose)
    expect(eventos('game_over').map((c) => c.args)).toEqual([
      ['game_over', { result: 'win', mode: 'online' }],
    ])
  })

  // Defeito do componente antigo, achado na extração em 25/09/2026: depois de
  // entrar, o convidado ficava na fase 'join', com o cartão de digitar o código
  // por cima do tabuleiro, e nunca podia jogar (o `myTurn` pede 'playing').
  it('online, convidado: entra pelo código e já está jogando, de pretas, embaixo', async () => {
    await montar()
    host.disparar('sala', {
      acao: 'criar',
      codigo: 'ABC23',
      uid: 'ana',
      nome: 'Ana',
      estadoInicial: depoisDe(),
      vez: 'w',
    })
    await entrarPelaTela('abc23')
    expect($('.ros-chess__wait')).toBeNull()
    expect(host.salas.ler('ABC23')).toMatchObject({
      convidado: 'eu',
      nomeDoConvidado: 'Roque',
      situacao: 'jogando',
    })
    expect(eventos('game_start').map((c) => c.args)).toEqual([
      ['game_start', { mode: 'online-guest' }],
    ])
    expect(texto('.ros-chess__pcard--top .ros-chess__pname')).toBe('Ana')
    expect(texto('.ros-chess__pcard--bottom .ros-chess__pname')).toBe('Roque')
    expect($('.ros-chess__pcard--bottom .ros-chess__avatar').classList.contains('is-b')).toBe(true)
    expect($('.ros-chess__pcard--top').classList.contains('is-active')).toBe(true)

    // Antes do lance da Ana, o toque do convidado não joga.
    tocar(1, 4)
    tocar(3, 4)
    expect(window.__chess.state.board[1][4]).toBe('p')

    host.disparar('sala', { acao: 'jogar', codigo: 'ABC23', estado: depoisDe(E4), vez: 'b' })
    await nextTick()
    expect(window.__chess.state.board[4][4]).toBe('P')
    expect($('.ros-chess__pcard--bottom').classList.contains('is-active')).toBe(true)

    tocar(1, 4)
    tocar(3, 4) // e5
    await vi.waitFor(() => expect(host.salas.ler('ABC23').estado).toBe(depoisDe(E4, E5)))
    expect(host.salas.ler('ABC23').vez).toBe('w')
  })

  it('online, convidado: o meu mate encerra a sala com o vencedor, no formato de antes', async () => {
    await montar()
    host.disparar('sala', {
      acao: 'criar',
      codigo: 'ABC23',
      uid: 'ana',
      nome: 'Ana',
      estadoInicial: depoisDe(),
      vez: 'w',
    })
    await entrarPelaTela('ABC23')
    host.disparar('sala', { acao: 'jogar', codigo: 'ABC23', estado: depoisDe(F3), vez: 'b' })
    window.__chess.move(...E5)
    host.disparar('sala', {
      acao: 'jogar',
      codigo: 'ABC23',
      estado: depoisDe(F3, E5, G4),
      vez: 'b',
    })
    window.__chess.move(...DH4)
    await vi.waitFor(() =>
      expect(host.salas.ler('ABC23')).toMatchObject({
        estado: depoisDe(F3, E5, G4, DH4),
        vez: 'w',
        vencedor: 'b',
        situacao: 'encerrada',
      }),
    )
    await nextTick()
    expect(texto('.ros-chess__over-title')).toBe(ptBR.youWin)
  })

  it('entrar: código que não existe, sala cheia e a própria sala dão o texto de antes', async () => {
    await montar()
    const tentar = async (codigo) => {
      const campo = $('.ros-chess__code-input')
      campo.value = codigo
      campo.dispatchEvent(new Event('input'))
      await nextTick()
      $('.ros-chess__solid-btn').click()
      await esperar()
      return texto('.ros-chess__err')
    }
    await entrarPelaTela('ZZZ22')
    expect(texto('.ros-chess__err')).toBe(ptBR.codeNotFound)

    host.disparar('sala', { acao: 'criar', codigo: 'CHE22', uid: 'ana', estadoInicial: depoisDe() })
    host.disparar('sala', { acao: 'entrar', codigo: 'CHE22', uid: 'bia' })
    expect(await tentar('CHE22')).toBe(ptBR.roomFull)

    // A sala é de quem tenta entrar ('propria' no SDK, 'own-match' antes): o
    // texto genérico, como era.
    host.disparar('sala', { acao: 'criar', codigo: 'MIN22', uid: 'eu', estadoInicial: depoisDe() })
    expect(await tentar('MIN22')).toBe(ptBR.joinFailed)

    expect($('.ros-chess__code-input')).not.toBeNull()
    expect(eventos('game_start')).toHaveLength(0)
  })

  it('o código com menos de cinco letras nem chega à sala', async () => {
    await montar()
    await entrarPelaTela('AB2')
    expect($('.ros-chess__solid-btn').disabled).toBe(true)
    expect(host.contar('sala', 'entrar')).toBe(0)
  })

  it('sem conta não há partida online: criar e entrar avisam com o texto e o tipo de antes, e nada muda', async () => {
    await montar({ uid: null, nome: null })
    $('.ros-chess__mbtn--online').click()
    await esperar()
    expect(avisos()).toEqual([[ptBR.needAccount, { tipo: 'aviso' }]])
    expect($('.ros-chess__menu')).not.toBeNull()
    expect($('.ros-chess__wait')).toBeNull()
    expect(eventos('game_start')).toHaveLength(0)

    host.disparar('sala', { acao: 'criar', codigo: 'ABC23', uid: 'ana', estadoInicial: depoisDe() })
    await entrarPelaTela('ABC23')
    expect(avisos()).toEqual([
      [ptBR.needAccount, { tipo: 'aviso' }],
      [ptBR.needAccount, { tipo: 'aviso' }],
    ])
    expect($('.ros-chess__err')).toBeNull()
    expect($('.ros-chess__code-input')).not.toBeNull()
    expect(host.salas.ler('ABC23').convidado).toBeNull()
    expect(eventos('game_start')).toHaveLength(0)
  })

  it('aberto pelo convite (link ou QR), entra sozinho na sala do código', async () => {
    const h = criarHostFalso({ jogoId: 'chess', uid: 'eu', nome: 'Roque', convite: 'abc23' })
    h.disparar('sala', {
      acao: 'criar',
      codigo: 'ABC23',
      uid: 'ana',
      nome: 'Ana',
      estadoInicial: depoisDe(),
      vez: 'w',
    })
    await montarCom(h)
    expect($('.ros-chess__code-input').value).toBe('ABC23')
    await vi.waitFor(() => expect(host.salas.ler('ABC23').convidado).toBe('eu'))
    await nextTick()
    expect($('.ros-chess__wait')).toBeNull()
    expect(texto('.ros-chess__pcard--top .ros-chess__pname')).toBe('Ana')
    expect(eventos('game_start').map((c) => c.args)).toEqual([
      ['game_start', { mode: 'online-guest' }],
    ])
  })

  it('sem convite, abre no menu e não tenta entrar em sala nenhuma', async () => {
    await montar()
    await new Promise((r) => setTimeout(r, 350))
    expect($('.ros-chess__menu')).not.toBeNull()
    expect(host.contar('sala', 'entrar')).toBe(0)
  })

  it('o anfitrião cair não mexe na partida do convidado (como antes); a sala encerrada é "o oponente saiu"', async () => {
    await montar()
    host.disparar('sala', { acao: 'criar', codigo: 'ABC23', uid: 'ana', estadoInicial: depoisDe() })
    await entrarPelaTela('ABC23')
    host.disparar('sala', { acao: 'anfitriaoSaiu', codigo: 'ABC23' })
    await nextTick()
    expect($('.ros-chess__over')).toBeNull()
    expect($('.ros-chess__net-toast')).toBeNull()
    host.disparar('sala', { acao: 'encerrar', codigo: 'ABC23' })
    await nextTick()
    expect(texto('.ros-chess__over-title')).toBe(ptBR.oppLeft)
  })

  it('a sala que some no meio da partida avisa que o oponente saiu, e o aviso some sozinho', async () => {
    await montar()
    host.disparar('sala', { acao: 'criar', codigo: 'ABC23', uid: 'ana', estadoInicial: depoisDe() })
    await entrarPelaTela('ABC23')
    vi.useFakeTimers()
    host.disparar('sala', { acao: 'sumir', codigo: 'ABC23' })
    await nextTick()
    expect(texto('.ros-chess__net-toast')).toBe(ptBR.oppLeft)
    vi.advanceTimersByTime(3100)
    await nextTick()
    expect($('.ros-chess__net-toast')).toBeNull()
  })

  it('cancelar a espera para de observar a sala', async () => {
    await montar()
    const codigo = await criarSalaPelaTela()
    $('.ros-chess__wait .ros-chess__ghost-btn').click()
    await nextTick()
    expect($('.ros-chess__menu')).not.toBeNull()
    host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia', nome: 'Bia' })
    await nextTick()
    expect($('.ros-chess__menu')).not.toBeNull()
    expect($('.ros-chess__net-toast')).toBeNull()
  })

  // ── O que o jogo pede ao sistema ───────────────────────────────────────────

  // Antes da extração o Xadrez não usava o localStorage nem o placar da conta
  // (não tem recorde nem entra no Pódio), e continua assim.
  it('o Xadrez não guarda nada: nenhuma chave de armazenamento, nenhum placar na conta', async () => {
    const h = criarHostFalso({ jogoId: 'chess', uid: 'eu', nome: 'Roque' })
    const usos = ['ler', 'gravar', 'apagar'].map((m) => vi.spyOn(h.armazenamento, m))
    await montarCom(h)
    window.__chess.startLocal()
    window.__chess.move(...F3)
    window.__chess.move(...E5)
    window.__chess.move(...G4)
    window.__chess.move(...DH4)
    await nextTick()
    $('.ros-chess__over .ros-chess__solid-btn').click() // Novo jogo
    await nextTick()
    await criarSalaPelaTela()
    for (const uso of usos) expect(uso).not.toHaveBeenCalled()
    expect(host.contar('placar', 'carregar')).toBe(0)
    expect(host.contar('placar', 'salvar')).toBe(0)
  })

  it('convidado (sem conta) joga local e contra a IA igual, como "Você", sem tocar no placar', async () => {
    await montar({ uid: null, nome: null })
    vi.useFakeTimers()
    window.__chess.startAI('easy')
    await nextTick()
    expect(texto('.ros-chess__pcard--bottom .ros-chess__pname')).toBe(ptBR.you)
    window.__chess.move(...E4)
    vi.advanceTimersByTime(600)
    expect(window.__chess.state.moves).toBe(2)
    window.__chess.startLocal()
    expect(window.__chess.state.status).toBe('playing')
    expect(host.contar('placar', 'carregar')).toBe(0)
    expect(host.contar('placar', 'salvar')).toBe(0)
  })

  it('o cartão mostra o nome da conta, e acompanha quem entra e sai com o jogo aberto', async () => {
    await montar({ uid: 'u1', nome: 'Ana' })
    window.__chess.startAI('medium')
    await nextTick()
    const baixo = $('.ros-chess__pcard--bottom .ros-chess__pname')
    expect(texto('.ros-chess__pcard--top .ros-chess__pname')).toBe(
      `${ptBR.ai} · ${ptBR.level_medium}`,
    )
    expect(baixo.textContent).toBe('Ana')
    host.disparar('identidade', { uid: 'u2', nome: 'Bia' })
    await nextTick()
    expect(baixo.textContent).toBe('Bia')
    host.disparar('identidade', { uid: null, nome: null })
    await nextTick()
    expect(baixo.textContent).toBe(ptBR.you)
  })

  // O componente de antes não ouvia teclado nenhum na janela, e continua assim:
  // o Xadrez se joga com o ponteiro. Com duas janelas abertas, tecla nenhuma mexe
  // em nenhuma das duas. O Enter só vale dentro do campo do código, que é do
  // próprio campo, e não da janela.
  it('tecla nenhuma mexe no jogo, ativo ou não; o Enter só vale no campo do código', async () => {
    await montar()
    for (const key of ['Enter', ' ', 'ArrowUp', 'Escape', 'e']) tecla(key)
    await nextTick()
    expect($('.ros-chess__menu')).not.toBeNull()
    expect(eventos('game_start')).toHaveLength(0)
    window.__chess.startLocal()
    montagem.ativar(false)
    for (const key of ['Enter', ' ', 'ArrowDown']) tecla(key)
    expect(window.__chess.state.moves).toBe(0)
    montagem.ativar(true)

    host.disparar('sala', { acao: 'criar', codigo: 'ABC23', uid: 'ana', estadoInicial: depoisDe() })
    await nextTick()
    $('.ros-chess__icon-btn').click() // volta ao menu
    await nextTick()
    botaoDoMenu('joinOnline').click()
    await nextTick()
    const campo = $('.ros-chess__code-input')
    campo.value = 'ABC23'
    campo.dispatchEvent(new Event('input'))
    await nextTick()
    tecla('Enter') // na janela: nada
    await esperar()
    expect(host.contar('sala', 'entrar')).toBe(0)
    campo.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await esperar()
    expect(host.contar('sala', 'entrar')).toBe(1)
    expect(host.salas.ler('ABC23').convidado).toBe('eu')
  })

  // O modo leve é a única coisa do código de GPU que muda de origem na
  // extração: vinha do composable do RoqueOS e agora vem do host.
  it('o perfil leve do host chega no three: sem antialias, sem sombra, pixel ratio de até 1,25', async () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true })
    await montar({ modoLeve: true })
    expect($('.ros-chess').classList.contains('ros-chess--low')).toBe(true)
    const r = renderizador()
    expect(r.opcoes).toEqual({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    })
    expect(r.pixelRatio).toBe(1.25)
    expect(r.shadowMap.enabled).toBe(false)
  })

  it('sem perfil leve o three nasce com antialias, sombra e pixel ratio de até 2', async () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true })
    await montar({ modoLeve: false })
    expect($('.ros-chess').classList.contains('ros-chess--low')).toBe(false)
    const r = renderizador()
    expect(r.opcoes).toEqual({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    expect(r.pixelRatio).toBe(2)
    expect(r.shadowMap.enabled).toBe(true)
  })

  it('o tabuleiro 3D nasce no canvas do jogo e desenha no requestAnimationFrame', async () => {
    await montar()
    const r = renderizador()
    expect(r.domElement).toBe(canvas())
    const antes = r.quadros
    for (const fn of fila.splice(0)) fn(16)
    expect(r.quadros).toBe(antes + 1)
  })

  // Do front: 'cleans up the E2E hook on unmount'.
  it('desmontar solta tudo: o gancho, o contexto WebGL, a sala, a identidade, a IA pendente e a tela', async () => {
    const h = criarHostFalso({ jogoId: 'chess', uid: 'eu', nome: 'Roque' })
    // O host falso não conta ouvintes de identidade; o embrulho conta quem parou.
    const pararIdentidade = vi.fn()
    const aoMudar = h.identidade.aoMudar
    h.identidade.aoMudar = (fn) => {
      const parar = aoMudar(fn)
      return () => {
        pararIdentidade()
        parar()
      }
    }
    await montarCom(h)
    const codigo = await criarSalaPelaTela()
    expect(host.salas.observadas()).toEqual([codigo])
    const r = renderizador()
    expect(window.__chess).toBeTruthy()
    vi.useFakeTimers()
    // Uma IA pensando no relógio na hora de fechar.
    window.__chess.startAI('easy', 'b')
    const st = window.__chess.state
    expect(window.__chess.thinking).toBe(true)
    expect(pararIdentidade).not.toHaveBeenCalled()
    montagem.desmontar()
    expect(pararIdentidade).toHaveBeenCalledTimes(1)
    expect(window.__chess).toBeUndefined()
    expect(r.descartado).toBe(true)
    expect(el.querySelector('.ros-chess')).toBeNull()
    // A resposta da IA que estava no relógio não chega a jogar.
    vi.advanceTimersByTime(2000)
    expect(st.moves).toBe(0)
    // Ninguém mais observa a sala: o outro entrar não chega a ninguém.
    expect(host.salas.observadas()).toEqual([])
    expect(() =>
      host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia', nome: 'Bia' }),
    ).not.toThrow()
    // Desmontar de novo acontece de verdade (a janela fecha e o componente em
    // volta desmonta depois) e não pode lançar.
    expect(() => montagem.desmontar()).not.toThrow()
  })

  it('desmontar antes de o texto chegar não monta nada depois', async () => {
    host = criarHostFalso({ jogoId: 'chess' })
    montagem = jogo.mount(palco(), host, { ativo: true })
    montagem.desmontar()
    await new Promise((r) => setTimeout(r, 50))
    expect(el.querySelector('.ros-chess')).toBeNull()
  })

  it('toda chave que a tela usa existe no pt-BR, os três níveis inclusive', () => {
    const usadas = [...tela.matchAll(/txt\('([\w.]+)'/g)].map((m) => m[1])
    expect(usadas.length).toBeGreaterThan(40)
    // `txt(\`level_${aiLevel.value}\`)` monta a chave em tempo de execução; a busca
    // acima não a vê.
    const niveis = ['easy', 'medium', 'hard'].map((n) => `level_${n}`)
    const faltando = [...usadas, ...niveis].filter((k) => traduzir(ptBR, k) === k)
    expect(faltando).toEqual([])
  })
})
