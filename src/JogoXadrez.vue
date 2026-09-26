<template>
  <div
    ref="rootRef"
    class="ros-chess"
    :class="{ 'ros-chess--low': modoLeve }"
    :dir="estado.idioma === 'ar-AR' ? 'rtl' : 'ltr'"
  >
    <canvas ref="canvasRef" class="ros-chess__canvas" />

    <!-- player cards (opponent above the 3D board, me below) -->
    <template v-if="phase === 'playing' || phase === 'ended'">
      <div
        class="ros-chess__pcard ros-chess__pcard--top"
        :class="{ 'is-active': turn === topColor && phase === 'playing' }"
      >
        <span class="ros-chess__avatar" :class="topColor === 'w' ? 'is-w' : 'is-b'">
          <img
            v-if="uiUrls[topColor === 'w' ? 'K' : 'k']"
            :src="uiUrls[topColor === 'w' ? 'K' : 'k']"
            alt=""
          />
        </span>
        <span class="ros-chess__pname">{{ topName }}</span>
        <span v-if="aiThinking && mode === 'ai'" class="ros-chess__thinking">
          <span class="ros-chess__pontos" aria-hidden="true"><i /><i /><i /></span>
          {{ txt('thinking') }}
        </span>
        <span class="ros-chess__caps">
          <img v-for="(u, i) in capsFor(topColor)" :key="i" :src="u" alt="" />
          <b v-if="advFor(topColor) > 0">+{{ advFor(topColor) }}</b>
        </span>
        <span class="ros-chess__turn-dot" />
        <button class="ros-chess__icon-btn" :aria-label="txt('newGame')" @click="toMenu">
          <Icone nome="fechar" :tamanho="18" />
        </button>
      </div>
      <div
        class="ros-chess__pcard ros-chess__pcard--bottom"
        :class="{ 'is-active': turn === bottomColor && phase === 'playing' }"
      >
        <span class="ros-chess__avatar" :class="bottomColor === 'w' ? 'is-w' : 'is-b'">
          <img
            v-if="uiUrls[bottomColor === 'w' ? 'K' : 'k']"
            :src="uiUrls[bottomColor === 'w' ? 'K' : 'k']"
            alt=""
          />
        </span>
        <span class="ros-chess__pname">{{ bottomName }}</span>
        <span class="ros-chess__caps">
          <img v-for="(u, i) in capsFor(bottomColor)" :key="i" :src="u" alt="" />
          <b v-if="advFor(bottomColor) > 0">+{{ advFor(bottomColor) }}</b>
        </span>
        <span class="ros-chess__turn-dot" />
      </div>
    </template>

    <transition name="chess-fade">
      <div v-if="checkFlash && phase === 'playing'" class="ros-chess__check">
        {{ txt('check') }}
      </div>
    </transition>

    <!-- menu (the live 3D board glows behind the glass) -->
    <div v-if="phase === 'menu'" class="ros-chess__menu">
      <div class="ros-chess__hero">
        <img v-if="uiUrls.K" :src="uiUrls.K" class="ros-chess__hero-piece is-l" alt="" />
        <img v-if="uiUrls.q" :src="uiUrls.q" class="ros-chess__hero-piece is-r" alt="" />
      </div>
      <div class="ros-chess__logo">{{ txt('title') }}</div>
      <div class="ros-chess__sub">{{ txt('tagline') }}</div>
      <div class="ros-chess__menu-btns">
        <button class="ros-chess__mbtn ros-chess__mbtn--ai" @click="phase = 'aisetup'">
          <Icone nome="robo" :tamanho="22" />
          <span>{{ txt('vsAi') }}</span>
          <small>{{ txt('vsAiHint') }}</small>
        </button>
        <button class="ros-chess__mbtn" @click="startLocal">
          <Icone nome="pessoas" :tamanho="22" />
          <span>{{ txt('local') }}</span>
          <small>{{ txt('localHint') }}</small>
        </button>
        <button class="ros-chess__mbtn ros-chess__mbtn--online" @click="hostOnline">
          <Icone nome="qr" :tamanho="22" />
          <span>{{ txt('createOnline') }}</span>
          <small>{{ txt('createHint') }}</small>
        </button>
        <button class="ros-chess__mbtn" @click="phase = 'join'">
          <Icone nome="entrar" :tamanho="22" />
          <span>{{ txt('joinOnline') }}</span>
          <small>{{ txt('joinHint') }}</small>
        </button>
      </div>
    </div>

    <!-- vs AI: pick side + difficulty -->
    <div v-if="phase === 'aisetup'" class="ros-chess__menu">
      <div class="ros-chess__logo">{{ txt('vsAi') }}</div>
      <div class="ros-chess__sub">{{ txt('chooseLevel') }}</div>
      <div class="ros-chess__side-row">
        <button class="ros-chess__side" :class="{ 'is-on': aiSide === 'w' }" @click="aiSide = 'w'">
          <img v-if="uiUrls.K" :src="uiUrls.K" alt="" />
          <span>{{ txt('white') }}</span>
        </button>
        <button class="ros-chess__side" :class="{ 'is-on': aiSide === 'b' }" @click="aiSide = 'b'">
          <img v-if="uiUrls.k" :src="uiUrls.k" alt="" />
          <span>{{ txt('black') }}</span>
        </button>
      </div>
      <div class="ros-chess__menu-btns">
        <button class="ros-chess__mbtn" @click="startAI('easy')">
          <Icone nome="sorriso" :tamanho="22" />
          <span>{{ txt('level_easy') }}</span>
          <small>{{ txt('level_easy_hint') }}</small>
        </button>
        <button class="ros-chess__mbtn" @click="startAI('medium')">
          <Icone nome="cerebro" :tamanho="22" />
          <span>{{ txt('level_medium') }}</span>
          <small>{{ txt('level_medium_hint') }}</small>
        </button>
        <button class="ros-chess__mbtn" @click="startAI('hard')">
          <Icone nome="fogo" :tamanho="22" />
          <span>{{ txt('level_hard') }}</span>
          <small>{{ txt('level_hard_hint') }}</small>
        </button>
      </div>
      <button class="ros-chess__ghost-btn" @click="phase = 'menu'">{{ txt('cancel') }}</button>
    </div>

    <!-- host: waiting w/ QR -->
    <div v-if="phase === 'waiting'" class="ros-chess__wait">
      <div class="ros-chess__wait-card">
        <div class="ros-chess__wait-title">{{ txt('waiting') }}</div>
        <img v-if="qr" :src="qr" class="ros-chess__qr" :alt="txt('scanQr')" />
        <div class="ros-chess__code-row">
          <span class="ros-chess__code-label">{{ txt('code') }}</span>
          <span class="ros-chess__code">{{ code }}</span>
          <button class="ros-chess__copy" @click="copyInvite">
            <Icone nome="copiar" :tamanho="16" />
          </button>
        </div>
        <div class="ros-chess__wait-hint">{{ txt('scanQr') }}</div>
        <button class="ros-chess__ghost-btn" @click="toMenu">{{ txt('cancel') }}</button>
      </div>
    </div>

    <!-- guest: join by code -->
    <div v-if="phase === 'join'" class="ros-chess__wait">
      <div class="ros-chess__wait-card">
        <div class="ros-chess__wait-title">{{ txt('enterCode') }}</div>
        <input
          v-model="joinInput"
          class="ros-chess__code-input"
          maxlength="5"
          :placeholder="txt('codePlaceholder')"
          @keyup.enter="guestJoin"
        />
        <div v-if="joinError" class="ros-chess__err">{{ joinError }}</div>
        <button class="ros-chess__solid-btn" :disabled="joinInput.length < 5" @click="guestJoin">
          {{ txt('join') }}
        </button>
        <button class="ros-chess__ghost-btn" @click="toMenu">{{ txt('cancel') }}</button>
      </div>
    </div>

    <!-- promotion picker -->
    <div v-if="promoPending" class="ros-chess__promo">
      <div class="ros-chess__promo-title">{{ txt('promote') }}</div>
      <div class="ros-chess__promo-row">
        <button
          v-for="p in ['Q', 'R', 'B', 'N']"
          :key="p"
          class="ros-chess__promo-btn"
          @click="choosePromo(p)"
        >
          <img
            v-if="uiUrls[myColorForPromo === 'w' ? p : p.toLowerCase()]"
            :src="uiUrls[myColorForPromo === 'w' ? p : p.toLowerCase()]"
            alt=""
          />
        </button>
      </div>
    </div>

    <!-- result -->
    <transition name="chess-pop">
      <div v-if="phase === 'ended'" class="ros-chess__over">
        <div class="ros-chess__over-title">{{ resultText }}</div>
        <button class="ros-chess__solid-btn" @click="toMenu">
          <Icone nome="reiniciar" :tamanho="19" /> {{ txt('newGame') }}
        </button>
      </div>
    </transition>

    <div v-if="onlineToast" class="ros-chess__net-toast">{{ onlineToast }}</div>
  </div>
</template>

<script setup>
// O Xadrez. Fala com o sistema só pelo `host` do jogo-sdk: identidade, áudio,
// modo leve, métricas, aviso e a sala da partida online chegam por ele, e é por
// isso que o mesmo arquivo roda dentro do RoqueOS, no `yarn dev` do repo e no
// teste.
//
// O que toca a GPU mora em `tabuleiro3d.js` (renderer e as opções dele, pixel
// ratio, sombra, luzes, materiais, geometrias das peças, texturas) e veio do
// RoqueOS SEM MUDANÇA, em 25/09/2026, como a arte 2D das peças em
// `arteDoTabuleiro.js`. Daqui só mudou de onde vem o modo leve que vai para lá.
// Mexer ali pede teste no iPhone de verdade antes de subir: verde no desktop não
// é verde no iPhone.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { emModoE2E } from '@roqueos-games/jogo-sdk'
import { bakeChessSet, spriteUrl } from './arteDoTabuleiro.js'
import { createBoardScene, buildChessSet3D } from './tabuleiro3d.js'
import {
  createGame,
  startGame,
  legalMoves,
  applyMove,
  serialize,
  deserialize,
  inCheck,
  isGameOver,
  WHITE,
  BLACK,
} from './engine.js'
import { bestMove as chessAiMove } from './ai.js'
import { criarSom } from './som.js'
import { traduzir } from './textos.js'
import Icone from './Icone.vue'

const props = defineProps({
  /** O host do contrato v1 do jogo-sdk, com a capacidade `sala`. */
  host: { type: Object, required: true },
  /** `{ ativo, idioma, textos }`, reativo; quem escreve é o `montar` do jogo. */
  estado: { type: Object, required: true },
})

const host = props.host
const txt = (chave, valores) => traduzir(props.estado.textos, chave, valores)

// ── Reactive UI ──────────────────────────────────────────────────────────────
const rootRef = ref(null)
const canvasRef = ref(null)
const phase = ref('menu') // 'menu'|'aisetup'|'join'|'waiting'|'playing'|'ended'
const mode = ref('local') // 'local' | 'ai' | 'online'
const aiLevel = ref('medium') // 'easy' | 'medium' | 'hard'
const aiSide = ref('w') // which colour the human picks in the AI setup
const humanColor = ref(WHITE) // the side the human controls vs the AI
const aiThinking = ref(false)
const turn = ref(WHITE)
const checkFlash = ref(false)
const resultText = ref('')
const code = ref('')
const qr = ref('')
const joinInput = ref('')
const joinError = ref('')
const myColor = ref(WHITE) // online: which side I control
const oppName = ref('')
const onlineToast = ref('')
const promoPending = ref(null) // { from, to } awaiting a promo choice
const myColorForPromo = ref('w')
const uiUrls = ref({}) // baked 2D piece sprites (cards/menu/promotion icons)
const captured = ref({ w: [], b: [], adv: 0 }) // pieces captured BY each side
// O perfil leve, lido do host ao montar: liga a classe `ros-chess--low` no CSS e
// é o mesmo valor que vai para o `lowEnd` do tabuleiro 3D.
const modoLeve = ref(false)
// O nome de quem joga. Vinha do `authStore` do RoqueOS, que é reativo; aqui vem
// da identidade do host e acompanha o `aoMudar` dela, para quem entra na conta
// com a partida aberta ver o próprio nome no cartão.
const nomeDoJogador = ref(null)

// ── Engine (plain) + 3D scene ────────────────────────────────────────────────
let game = null
let scene3d = null
let selected = null // [r,c]
let legalForSel = [] // moves from the selected square
let lastMove = null // { from, to }
let unsub = null
let resizeObserver = null
let lastSerialized = ''
let pararIdentidade = null
// O link do convite (o do QR e o do "copiar"), que o host devolve ao criar a
// sala. Antes o jogo montava o link sozinho, com o endereço do RoqueOS escrito
// no código; agora quem sabe o endereço é o host.
let linkDoConvite = ''

const pendingTimers = new Set()
const later = (fn, ms) => {
  const id = setTimeout(() => {
    pendingTimers.delete(id)
    fn()
  }, ms)
  pendingTimers.add(id)
  return id
}

const lerNome = () => {
  try {
    return host.identidade.atual()?.nome || null
  } catch {
    return null
  }
}

// the human always sits at the bottom of the table (guest / AI-as-black flip)
const flip = computed(
  () =>
    (mode.value === 'online' && myColor.value === BLACK) ||
    (mode.value === 'ai' && humanColor.value === BLACK),
)
const topColor = computed(() => (flip.value ? WHITE : BLACK))
const bottomColor = computed(() => (flip.value ? BLACK : WHITE))
const meName = () => nomeDoJogador.value || txt('you')
const aiName = computed(() => `${txt('ai')} · ${txt(`level_${aiLevel.value}`)}`)
// Online, quem joga fica sempre embaixo, de brancas ou de pretas, e o oponente
// em cima. Antes os nomes do anfitrião saíam trocados: ele via o próprio nome no
// cartão de cima, o das pretas, e o do convidado no de baixo, ao lado das
// brancas dele (`flip ? oponente : eu` no de cima, e o espelho no de baixo, que
// só acertava para o convidado). Defeito do componente antigo, achado na
// extração em 25/09/2026.
const topName = computed(() => {
  if (mode.value === 'ai') return aiName.value // the AI is always the opponent (top)
  if (mode.value === 'online') return oppName.value || txt('opponent')
  return txt('black')
})
const bottomName = computed(() => {
  if (mode.value === 'ai') return meName()
  if (mode.value === 'online') return meName()
  return txt('white')
})

// captured pieces + material advantage (recomputed after every board change)
const PIECE_VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 }
const INIT_COUNT = { P: 8, N: 2, B: 2, R: 2, Q: 1, K: 1 }
const syncCaptures = () => {
  if (!game) return
  const alive = {
    w: { P: 0, N: 0, B: 0, R: 0, Q: 0, K: 0 },
    b: { P: 0, N: 0, B: 0, R: 0, Q: 0, K: 0 },
  }
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const ch = game.board[r][c]
      if (ch === '.') continue
      alive[ch === ch.toUpperCase() ? 'w' : 'b'][ch.toUpperCase()]++
    }
  }
  const order = ['Q', 'R', 'B', 'N', 'P']
  const byW = [] // black pieces white has captured (lowercase sprites)
  const byB = []
  let vw = 0
  let vb = 0
  for (const p of order) {
    for (let i = 0; i < INIT_COUNT[p] - alive.b[p]; i++) {
      byW.push(p.toLowerCase())
      vw += PIECE_VAL[p]
    }
    for (let i = 0; i < INIT_COUNT[p] - alive.w[p]; i++) {
      byB.push(p)
      vb += PIECE_VAL[p]
    }
  }
  captured.value = { w: byW, b: byB, adv: vw - vb }
}
const capsFor = (color) =>
  (color === WHITE ? captured.value.w : captured.value.b)
    .map((ch) => uiUrls.value[ch])
    .filter(Boolean)
const advFor = (color) => (color === WHITE ? captured.value.adv : -captured.value.adv)

// ── Audio ────────────────────────────────────────────────────────────────────
const som = criarSom(host.audio, later)
// Chamado de dentro do gesto (toque, clique), sem `await` antes: o iOS só
// libera o áudio assim.
const primeAudio = () => {
  try {
    host.audio.destravar()?.catch?.(() => {})
  } catch {
    /* best-effort */
  }
}
const buzz = (p) => {
  try {
    navigator.vibrate?.(p)
  } catch {
    /* best-effort */
  }
}

// ── Scene sync ───────────────────────────────────────────────────────────────
const findKingLocal = (board, color) => {
  const k = color === WHITE ? 'K' : 'k'
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c] === k) return [r, c]
  return null
}

const boardCells = () => {
  const cells = []
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const ch = game.board[r][c]
      if (ch !== '.') cells.push({ sq: [r, c], key: ch })
    }
  }
  return cells
}

const syncScene = () => {
  if (!scene3d || !game) return
  scene3d.setPieces(boardCells())
  const inChk = phase.value === 'playing' && inCheck(game.board, game.turn)
  scene3d.setHighlights({
    lastMove,
    selected,
    targets: legalForSel.map((m) => ({
      sq: m.to,
      capture: game.board[m.to[0]][m.to[1]] !== '.' || !!m.enPassant,
    })),
    check: inChk ? findKingLocal(game.board, game.turn) : null,
  })
}

// ── Interaction (raycast tap from the scene) ─────────────────────────────────
const aiColor = () => (humanColor.value === WHITE ? BLACK : WHITE)
const myTurn = () =>
  phase.value === 'playing' &&
  !aiThinking.value &&
  (mode.value === 'ai'
    ? game.turn === humanColor.value
    : mode.value === 'local' || game.turn === myColor.value)

const onTap = (r, c) => {
  if (!myTurn() || promoPending.value) return
  primeAudio()
  // pick a destination?
  if (selected) {
    const m = legalForSel.find((mm) => mm.to[0] === r && mm.to[1] === c)
    if (m) {
      // promotion?
      const piece = game.board[selected[0]][selected[1]]
      const lastRow = game.turn === WHITE ? 0 : 7
      if (piece.toUpperCase() === 'P' && r === lastRow) {
        promoPending.value = { from: [...selected], to: [r, c] }
        myColorForPromo.value = game.turn
        return
      }
      commitMove({ from: [...selected], to: [r, c] })
      return
    }
  }
  // select own piece
  const ch = game.board[r][c]
  if (ch !== '.' && (ch === ch.toUpperCase() ? WHITE : BLACK) === game.turn) {
    selected = [r, c]
    legalForSel = legalMoves(game).filter((m) => m.from[0] === r && m.from[1] === c)
  } else {
    selected = null
    legalForSel = []
  }
  syncScene()
}

const choosePromo = (p) => {
  const mvp = promoPending.value
  promoPending.value = null
  commitMove({ from: mvp.from, to: mvp.to, promo: p })
}

const commitMove = (move) => {
  const wasCapture = game.board[move.to[0]][move.to[1]] !== '.'
  const mover = game.board[move.from[0]][move.from[1]]
  const r = applyMove(game, move)
  if (!r.ok) return
  selected = null
  legalForSel = []
  lastMove = { from: move.from, to: move.to }
  turn.value = game.turn
  syncCaptures()
  syncScene()
  scene3d?.animateMove(move.from, move.to, { hop: mover?.toUpperCase() === 'N' })
  if (wasCapture || r.captured) som.captura()
  else som.lance()
  buzz(6)
  if (r.check) {
    checkFlash.value = true
    som.xeque()
    later(() => (checkFlash.value = false), 900)
  }
  if (mode.value === 'online') pushState()
  checkEnd()
  if (mode.value === 'ai') maybeAiMove()
}

// Vs-AI: when it's the bot's turn, think off a timer so the "pensando" UI paints
// first, then play. Guarded so leaving the game mid-think can't apply a stray move.
const maybeAiMove = () => {
  if (mode.value !== 'ai' || phase.value !== 'playing') return
  if (isGameOver(game) || game.turn !== aiColor()) return
  aiThinking.value = true
  syncScene()
  later(() => {
    if (mode.value !== 'ai' || phase.value !== 'playing' || game.turn !== aiColor()) {
      aiThinking.value = false
      return
    }
    const mv = chessAiMove(game, aiLevel.value)
    aiThinking.value = false
    if (mv) commitMove(mv)
  }, 460)
}

const checkEnd = () => {
  if (game.status === 'checkmate') {
    endGame(game.winner)
  } else if (game.status === 'stalemate') {
    endGame(0)
  }
}

const endGame = (winner) => {
  phase.value = 'ended'
  aiThinking.value = false
  const draw = winner === 0
  if (draw) resultText.value = txt('stalemate')
  else {
    const vsHuman = mode.value === 'online' || mode.value === 'ai'
    const meColor = mode.value === 'ai' ? humanColor.value : myColor.value
    const iWon = vsHuman ? winner === meColor : true
    resultText.value = vsHuman
      ? iWon
        ? txt('youWin')
        : txt('youLose')
      : winner === WHITE
        ? txt('whiteWins')
        : txt('blackWins')
    som.fim(!vsHuman || iWon)
  }
  host.metricas.evento('game_over', {
    result: draw ? 'draw' : 'win',
    mode: mode.value,
    ...(mode.value === 'ai' ? { level: aiLevel.value } : {}),
  })
}

// ── Local + start ────────────────────────────────────────────────────────────
const startLocal = () => {
  primeAudio()
  mode.value = 'local'
  game = createGame({ mode: 'local' })
  startGame(game)
  turn.value = WHITE
  selected = null
  legalForSel = []
  lastMove = null
  phase.value = 'playing'
  syncCaptures()
  scene3d?.setSide('w')
  syncScene()
  host.metricas.evento('game_start', { mode: 'local' })
}

// ── Vs AI ─────────────────────────────────────────────────────────────────────
const startAI = (level, side) => {
  primeAudio()
  mode.value = 'ai'
  aiLevel.value = level || aiLevel.value
  humanColor.value = (side || aiSide.value) === 'b' ? BLACK : WHITE
  game = createGame({ mode: 'ai' })
  startGame(game)
  turn.value = WHITE
  selected = null
  legalForSel = []
  lastMove = null
  aiThinking.value = false
  phase.value = 'playing'
  syncCaptures()
  scene3d?.setSide(humanColor.value === WHITE ? 'w' : 'b')
  syncScene()
  host.metricas.evento('game_start', { mode: 'ai', level: aiLevel.value })
  maybeAiMove() // the AI opens if the human chose to play Black
}

const toMenu = () => {
  phase.value = 'menu'
  aiThinking.value = false
  cleanupOnline()
}

// ── Online ───────────────────────────────────────────────────────────────────
// A sala é do host (`host.sala`): criar, entrar, observar e jogar. O jogo não
// fala com banco nenhum. O que atravessa a sala é o mesmo de antes da extração,
// de propósito: o `estado` é o `serialize` do motor e a `vez` é 'w' ou 'b', porque
// do outro lado pode estar um RoqueOS antigo, aberto durante o deploy.
const cleanupOnline = () => {
  if (unsub) {
    unsub()
    unsub = null
  }
  code.value = ''
  qr.value = ''
  oppName.value = ''
}

const makeQr = async (url) => {
  try {
    const QRCode = (await import('qrcode')).default
    qr.value = await QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      color: { dark: '#241812', light: '#f6efe2' },
    })
  } catch {
    qr.value = ''
  }
}

// O aviso de "partida online pede conta". Antes o jogo olhava a conta no
// `authStore` antes de tudo; agora quem sabe é o host, que recusa a sala sem
// conta (o `criar` lança e o `entrar` devolve 'sem-conta'), e o jogo avisa com o
// mesmo texto e o mesmo tipo de antes.
const avisarQuePedeConta = () => host.avisar(txt('needAccount'), { tipo: 'aviso' })

const hostOnline = async () => {
  primeAudio()
  // A partida nova só vira a da tela depois que a sala existe: sem conta o host
  // recusa, e a tela fica como estava, como antes, quando a conta era olhada
  // antes de mexer em qualquer coisa.
  const nova = createGame({ mode: 'online' })
  startGame(nova)
  let sala
  try {
    sala = await host.sala.criar({ estadoInicial: serialize(nova), vez: WHITE })
  } catch (erro) {
    if (erro?.codigo === 'sem-conta') {
      avisarQuePedeConta()
      return
    }
    throw erro
  }
  mode.value = 'online'
  myColor.value = WHITE
  game = nova
  // A vez de quem abre é das brancas. Sem isto o cartão aceso era o da vez da
  // partida anterior até o primeiro lance.
  turn.value = WHITE
  syncCaptures()
  syncScene()
  code.value = sala.codigo
  linkDoConvite = sala.link
  makeQr(sala.link)
  phase.value = 'waiting'
  subscribeMatch(sala.codigo)
  host.metricas.evento('game_start', { mode: 'online-host' })
}

const guestJoin = async (presetCode) => {
  primeAudio()
  const c = (typeof presetCode === 'string' ? presetCode : joinInput.value).trim().toUpperCase()
  if (c.length < 5) return
  joinError.value = ''
  const res = await host.sala.entrar(c)
  if (res?.erro === 'sem-conta') {
    avisarQuePedeConta()
    return
  }
  if (res?.erro) {
    // 'propria' (a sala é de quem tenta entrar) caía no genérico antes também.
    joinError.value =
      res.erro === 'nao-encontrada'
        ? txt('codeNotFound')
        : res.erro === 'cheia'
          ? txt('roomFull')
          : txt('joinFailed')
    return
  }
  mode.value = 'online'
  myColor.value = BLACK
  code.value = c
  game = createGame({ mode: 'online' })
  startGame(game)
  // Quem entra já está jogando. Antes a fase ficava em 'join': o convidado
  // continuava vendo o cartão de digitar o código por cima do tabuleiro e nunca
  // podia mexer, porque o `myTurn` pede a fase 'playing' (só o anfitrião saía da
  // espera, pelo aviso da sala). Defeito do componente antigo, achado na
  // extração em 25/09/2026.
  turn.value = WHITE
  phase.value = 'playing'
  syncCaptures()
  scene3d?.setSide('b')
  syncScene()
  subscribeMatch(c)
  host.metricas.evento('game_start', { mode: 'online-guest' })
}

const subscribeMatch = (c) => {
  cleanupOnline()
  code.value = c
  unsub = host.sala.observar(c, (m) => {
    if (!m) {
      if (phase.value === 'playing') {
        onlineToast.value = txt('oppLeft')
        later(() => (onlineToast.value = ''), 3000)
      }
      return
    }
    // opponent name
    oppName.value = myColor.value === WHITE ? m.nomeDoConvidado || '' : m.nomeDoAnfitriao || ''
    if (m.situacao === 'jogando' && phase.value === 'waiting') {
      phase.value = 'playing'
      onlineToast.value = txt('oppJoined')
      later(() => (onlineToast.value = ''), 2500)
    }
    // apply remote state if it advanced past ours
    if (m.estado && m.estado !== lastSerialized && m.estado !== serialize(game)) {
      applyRemote(m)
    }
    if (m.situacao === 'encerrada' && phase.value === 'playing') {
      // opponent resigned / left
      if (game.status !== 'checkmate' && game.status !== 'stalemate') {
        phase.value = 'ended'
        resultText.value = txt('oppLeft')
      }
    }
  })
}

const applyRemote = (m) => {
  const prev = game.board.map((row) => row.slice())
  const d = deserialize(m.estado)
  game.board = d.board
  game.turn = d.turn
  game.castling = d.castling
  game.enPassant = d.enPassant
  game.status = m.situacao === 'encerrada' ? game.status : 'playing'
  lastSerialized = m.estado
  turn.value = game.turn
  selected = null
  legalForSel = []
  syncCaptures()
  // reconstruct the opponent's move for the highlight + glide animation
  let fromSq = null
  let toSq = null
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (prev[r][c] === game.board[r][c]) continue
      if (game.board[r][c] === '.') {
        if (!fromSq || prev[r][c].toUpperCase() !== 'R') fromSq = [r, c]
      } else if (!toSq || game.board[r][c].toUpperCase() !== 'R') {
        toSq = [r, c]
      }
    }
  }
  if (fromSq && toSq) lastMove = { from: fromSq, to: toSq }
  syncScene()
  if (fromSq && toSq) {
    const movedCh = game.board[toSq[0]][toSq[1]]
    scene3d?.animateMove(fromSq, toSq, { hop: movedCh?.toUpperCase() === 'N' })
    som.lance()
  }
  // detect end from the remote state
  const lm = legalMoves(game)
  if (lm.length === 0) {
    if (inCheck(game.board, game.turn)) endGame(game.turn === WHITE ? BLACK : WHITE)
    else endGame(0)
  } else if (inCheck(game.board, game.turn)) {
    checkFlash.value = true
    later(() => (checkFlash.value = false), 900)
  }
}

const pushState = () => {
  lastSerialized = serialize(game)
  const acabou = game.status === 'checkmate' || game.status === 'stalemate'
  const jogada = {
    estado: lastSerialized,
    vez: game.turn,
    vencedor: game.status === 'checkmate' ? game.winner : null,
    situacao: acabou ? 'encerrada' : 'jogando',
  }
  // Na hora, no mesmo tique do lance, como era o `sendMove`: nada de esperar
  // uma microtarefa antes. Assim as escritas chegam à sala na ordem dos lances,
  // mesmo com um host que entrega a resposta do outro lado na hora (o falso
  // entrega); adiada, a escrita do lance velho cairia depois da resposta e a
  // desfaria. Sala fora do ar não desfaz o lance local.
  try {
    host.sala.jogar(code.value, jogada)?.catch?.(() => {})
  } catch {
    /* best-effort */
  }
}

const copyInvite = async () => {
  try {
    await navigator.clipboard.writeText(linkDoConvite)
    host.avisar(txt('copied'), { tipo: 'sucesso' })
  } catch {
    /* best-effort */
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  const lowEnd = Boolean(host.desempenho.modoLeve())
  modoLeve.value = lowEnd
  nomeDoJogador.value = lerNome()
  game = createGame()
  startGame(game)
  syncCaptures()
  // bake the 2D sprite set for HUD icons (cards, menu hero, promotion picker)
  const ui = bakeChessSet(46, Math.min(window.devicePixelRatio || 1, 2))
  const urls = {}
  for (const [ch, cv] of ui) urls[ch] = spriteUrl(cv)
  uiUrls.value = urls
  // the real-3D board
  scene3d = createBoardScene({
    canvas: canvasRef.value,
    lowEnd,
    coords: true,
    set: buildChessSet3D({ quality: lowEnd ? 'low' : 'high' }),
    onTap,
  })
  syncScene()
  resizeObserver = new ResizeObserver(() => scene3d?.resize())
  resizeObserver.observe(rootRef.value)
  // Quem entra ou sai da conta com o jogo aberto vê o próprio nome (ou "Você")
  // no cartão sem reabrir o jogo.
  pararIdentidade = host.identidade.aoMudar(() => {
    nomeDoJogador.value = lerNome()
  })

  // O convite pelo link ou pelo QR. Antes chegava pela prop `joinCode`, que o
  // RoqueOS trocava com a janela aberta; agora é lido UMA vez, ao montar. Um
  // segundo convite com a janela já aberta não chega ao jogo (limitação aceita
  // nesta versão, escrita no README).
  const convite = host.sala.conviteRecebido()
  if (convite) {
    phase.value = 'join'
    joinInput.value = convite.toUpperCase()
    later(() => guestJoin(convite), 300)
  }

  if (emModoE2E()) {
    window.__chess = {
      get state() {
        return game
      },
      get thinking() {
        return aiThinking.value
      },
      startLocal,
      startAI: (level, side) => startAI(level, side),
      move: (from, to, promo) => commitMove({ from, to, ...(promo ? { promo } : {}) }),
      // Cover aid: a lively mid-game position.
      stage: () => {
        startLocal()
        const seq = [
          [
            [6, 4],
            [4, 4],
          ],
          [
            [1, 2],
            [3, 2],
          ],
          [
            [7, 6],
            [5, 5],
          ],
          [
            [0, 1],
            [2, 2],
          ],
          [
            [7, 5],
            [4, 2],
          ],
          [
            [1, 3],
            [2, 3],
          ],
        ]
        for (const [f, tt] of seq) commitMove({ from: f, to: tt })
      },
    }
  }
})

onUnmounted(() => {
  for (const id of pendingTimers) clearTimeout(id)
  pendingTimers.clear()
  cleanupOnline()
  resizeObserver?.disconnect()
  pararIdentidade?.()
  scene3d?.dispose()
  scene3d = null
  if (emModoE2E()) delete window.__chess
})
</script>

<style scoped lang="scss">
// Até 25/09/2026 este estilo morava em `apps/chess/styles/ros-chess.scss` do
// RoqueOS e importava os tokens do sistema. Veio para cá inteiro, com duas
// coisas a mais que lá vinham do normalize do Quasar, que no RoqueOS vale para a
// página toda e sozinho não existe:
// - toda caixa em `border-box` (o Quasar põe no <html> e todo mundo herda). Sem
//   isto o cartão do jogador, o cartão de espera, o QR, o campo do código e os
//   botões de tamanho fixo cresciam o padding e a borda por fora;
// - `font: inherit` nos botões e no campo. Sem isto eles caíam na fonte padrão
//   de controle do navegador, com outra altura de linha.
// No RoqueOS as duas já valiam, então lá nada muda.
.ros-chess {
  // Cores de identidade deste jogo, como custom property para que um tema
  // consiga alcançá-las. As que vêm do sistema herdam o token do RoqueOS quando
  // ele existe e caem no valor que o tema padrão do RoqueOS dá, em 25/09/2026,
  // quando o jogo roda sozinho: fora do RoqueOS não há `tokens-root.scss`
  // nenhum carregado.
  --ros-chess-texto: var(--ros-text, rgba(255, 255, 255, 0.95));
  --ros-chess-texto-100: var(--ros-text-100, #ffffff);
  --ros-chess-texto-suave: var(--ros-text-muted, rgba(255, 255, 255, 0.72));
  --ros-chess-borda-apagada: var(--ros-border-muted, rgba(255, 255, 255, 0.08));
  --ros-chess-borda-sutil: var(--ros-border-subtle, rgba(255, 255, 255, 0.12));
  --ros-chess-borda-suave: var(--ros-border-soft, rgba(255, 255, 255, 0.1));
  --ros-chess-linha-15: var(--ros-line-15, rgba(255, 255, 255, 0.15));
  --ros-chess-preenchimento-07: var(--ros-fill-07, rgba(255, 255, 255, 0.07));
  --ros-chess-preenchimento-08: var(--ros-fill-08, rgba(255, 255, 255, 0.08));
  --ros-chess-preenchimento-10: var(--ros-fill-10, rgba(255, 255, 255, 0.1));
  --ros-chess-preenchimento-16: var(--ros-fill-16, rgba(255, 255, 255, 0.16));
  --ros-chess-sombra-45: var(--ros-shadow-45, rgba(0, 0, 0, 0.45));
  --ros-chess-sombra-50: var(--ros-shadow-50, rgba(0, 0, 0, 0.5));
  --ros-chess-veu-30: var(--ros-scrim-30, rgba(0, 0, 0, 0.3));
  --ros-chess-veu-55: var(--ros-scrim-55, rgba(0, 0, 0, 0.55));
  --ros-chess-branco-rgb: var(--ros-white-rgb, 255, 255, 255);
  --ros-chess-preto-rgb: var(--ros-black-rgb, 0, 0, 0);
  --ros-chess-desfoque: var(--ros-backdrop-blur, blur(20px));
  --ros-chess-bg-1: rgba(226, 170, 90, 0.12);
  --ros-chess-bg-2: rgba(150, 96, 44, 0.14);
  --ros-chess-bg-3: #17120c;
  --ros-chess-bg-4: #0a0806;
  --ros-chess-bg-5: rgba(26, 20, 14, 0.6);
  --ros-chess-line-1: rgba(226, 190, 132, 0.55);
  --ros-chess-shadow-1: rgba(226, 190, 132, 0.25);
  --ros-chess-shadow-2: rgba(160, 110, 40, 0.18);
  --ros-chess-bg-6: #6d5636;
  --ros-chess-bg-7: #3c2c1a;
  --ros-chess-bg-8: #33271a;
  --ros-chess-bg-9: #191209;
  --ros-chess-fg-1: #e5c98a;
  --ros-chess-shadow-3: rgba(229, 201, 138, 0.8);
  --ros-chess-bg-10: rgba(150, 30, 25, 0.85);
  --ros-chess-line-2: rgba(255, 120, 100, 0.5);
  --ros-chess-fg-2: #ffe3dc;
  --ros-chess-bg-11: rgba(10, 8, 6, 0.55);
  --ros-chess-bg-12: #fdf6e8;
  --ros-chess-bg-13: #e2be84;
  --ros-chess-bg-14: #9a6b32;
  --ros-chess-bg-15: rgba(32, 25, 17, 0.78);
  --ros-chess-shadow-4: rgba(160, 110, 40, 0.2);
  --ros-chess-bg-16: rgba(32, 25, 17, 0.7);
  --ros-chess-shadow-5: rgba(226, 190, 132, 0.4);
  --ros-chess-bg-17: rgba(24, 19, 13, 0.82);
  --ros-chess-line-3: rgba(226, 190, 132, 0.22);
  --ros-chess-bg-18: #f6efe2;
  --ros-chess-bg-19: rgba(226, 190, 132, 0.1);
  --ros-chess-line-4: rgba(226, 190, 132, 0.3);
  --ros-chess-fg-3: #f87171;
  --ros-chess-bg-20: #3c2f1f;
  --ros-chess-bg-21: #221a10;
  --ros-chess-bg-22: #e2b268;
  --ros-chess-bg-23: #a9742f;
  --ros-chess-fg-4: #241a0d;
  --ros-chess-shadow-6: rgba(200, 150, 70, 0.35);
  --ros-chess-bg-24: rgba(10, 8, 6, 0.85);
  --ros-chess-bg-25: rgba(26, 20, 14, 0.92);
}

.ros-chess {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  background: radial-gradient(90% 70% at 18% -8%, var(--ros-chess-bg-1), transparent 55%),
    radial-gradient(80% 60% at 85% 108%, var(--ros-chess-bg-2), transparent 60%),
    linear-gradient(180deg, var(--ros-chess-bg-3) 0%, var(--ros-chess-bg-4) 100%);

  // O `box-sizing: inherit` do normalize do Quasar, só aqui dentro.
  * {
    box-sizing: inherit;
  }

  &__canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  // ── Player cards ────────────────────────────────────────────────────────────
  &__pcard {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: min(94%, 620px);
    height: 50px;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 8px 0 12px;
    border-radius: 13px;
    background: var(--ros-chess-bg-5);
    border: 1px solid var(--ros-chess-borda-apagada);
    backdrop-filter: var(--ros-chess-desfoque);
    -webkit-backdrop-filter: var(--ros-chess-desfoque);
    pointer-events: none;
    transition:
      border-color 0.25s ease,
      box-shadow 0.25s ease;

    &--top {
      top: 10px;
    }
    &--bottom {
      bottom: calc(12px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
    }

    &.is-active {
      border-color: var(--ros-chess-line-1);
      box-shadow:
        0 0 0 1px var(--ros-chess-shadow-1),
        0 10px 30px var(--ros-chess-shadow-2);

      .ros-chess__turn-dot {
        opacity: 1;
        animation: chess-dot 1.4s ease-in-out infinite;
      }
    }
  }

  &__avatar {
    width: 34px;
    height: 34px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 10px;
    border: 1px solid var(--ros-chess-borda-sutil);

    img {
      width: 30px;
      height: 30px;
    }

    &.is-w {
      background: linear-gradient(160deg, var(--ros-chess-bg-6), var(--ros-chess-bg-7));
    }
    &.is-b {
      background: linear-gradient(160deg, var(--ros-chess-bg-8), var(--ros-chess-bg-9));
    }
  }

  &__pname {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--ros-chess-texto);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  &__caps {
    display: flex;
    align-items: center;
    margin-left: auto;

    img {
      width: 19px;
      height: 19px;
      margin-left: -6px;
      filter: drop-shadow(0 1px 1px var(--ros-chess-sombra-50));
    }
    b {
      margin-left: 7px;
      font-size: 11.5px;
      font-weight: 800;
      color: var(--ros-chess-fg-1);
    }
  }

  &__turn-dot {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: 50%;
    background: var(--ros-chess-fg-1);
    box-shadow: 0 0 10px var(--ros-chess-shadow-3);
    opacity: 0;
    margin: 0 4px;
  }

  &__check {
    position: absolute;
    top: 70px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
    padding: 5px 14px;
    border-radius: 999px;
    background: var(--ros-chess-bg-10);
    border: 1px solid var(--ros-chess-line-2);
    color: var(--ros-chess-fg-2);
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }

  &__icon-btn {
    font: inherit;
    flex: none;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: var(--ros-chess-preenchimento-07);
    color: var(--ros-chess-texto-suave);
    cursor: pointer;
    pointer-events: auto;

    &:hover {
      background: var(--ros-chess-preenchimento-16);
      color: var(--ros-chess-texto);
    }
  }

  // ── Menu / overlays ─────────────────────────────────────────────────────────
  &__menu,
  &__wait,
  &__over,
  &__promo {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    z-index: 6;
    padding: 24px;
  }

  &__menu {
    background: var(--ros-chess-bg-11);
    backdrop-filter: var(--ros-chess-desfoque);
    -webkit-backdrop-filter: var(--ros-chess-desfoque);
  }

  &__hero {
    position: relative;
    height: 86px;
    width: 130px;
    margin-bottom: -6px;
    filter: drop-shadow(0 14px 22px rgba(var(--ros-chess-preto-rgb), 0.55));
  }

  &__hero-piece {
    position: absolute;
    bottom: 0;
    width: 76px;
    height: 76px;

    &.is-l {
      left: 0;
      transform: rotate(-7deg);
      z-index: 2;
    }
    &.is-r {
      right: 0;
      width: 86px;
      height: 86px;
      transform: rotate(6deg);
    }
  }

  &__over {
    background: var(--ros-chess-veu-55);
    backdrop-filter: var(--ros-chess-desfoque);
    -webkit-backdrop-filter: var(--ros-chess-desfoque);
  }

  &__promo {
    background: rgba(var(--ros-chess-preto-rgb), 0.6);
    backdrop-filter: var(--ros-chess-desfoque);
    -webkit-backdrop-filter: var(--ros-chess-desfoque);
    gap: 16px;
  }

  &__logo {
    font-size: clamp(38px, 10vw, 54px);
    font-weight: 800;
    letter-spacing: 7px;
    background: linear-gradient(
      120deg,
      var(--ros-chess-bg-12) 0%,
      var(--ros-chess-bg-13) 55%,
      var(--ros-chess-bg-14) 120%
    );
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  &__sub {
    font-size: 14px;
    color: var(--ros-chess-texto-suave);
    margin-bottom: 18px;
    text-align: center;
  }

  &__menu-btns {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(330px, 88%);
  }

  &__mbtn {
    font: inherit;
    display: grid;
    grid-template-columns: 26px 1fr;
    grid-template-rows: auto auto;
    column-gap: 12px;
    align-items: center;
    text-align: left;
    padding: 14px 18px;
    border: 1px solid var(--ros-chess-borda-suave);
    border-radius: 14px;
    background: var(--ros-chess-bg-15);
    color: var(--ros-chess-texto);
    cursor: pointer;
    transition:
      transform 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    // Era `.q-icon`; o ícone agora é o SVG do `Icone.vue`.
    .icone-xadrez {
      grid-row: 1 / 3;
      color: var(--ros-chess-bg-13);
    }
    span {
      font-size: 15px;
      font-weight: 700;
    }
    small {
      font-size: 11.5px;
      color: var(--ros-chess-texto-suave);
    }

    &:hover {
      transform: translateY(-2px);
      border-color: var(--ros-chess-line-1);
      box-shadow: 0 10px 26px var(--ros-chess-shadow-4);
    }
  }

  &__side-row {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  &__side {
    font: inherit;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 96px;
    padding: 12px 10px;
    border: 1px solid var(--ros-chess-borda-suave);
    border-radius: 14px;
    background: var(--ros-chess-bg-16);
    color: var(--ros-chess-texto-suave);
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      transform 0.15s ease,
      color 0.15s ease;

    img {
      width: 38px;
      height: 38px;
    }
    span {
      font-size: 12.5px;
      font-weight: 700;
    }

    &.is-on {
      border-color: var(--ros-chess-bg-13);
      color: var(--ros-chess-texto);
      box-shadow: 0 0 0 1px var(--ros-chess-shadow-5);
      transform: translateY(-2px);
    }
  }

  &__thinking {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--ros-chess-fg-1);
    white-space: nowrap;
  }

  // Os três pontos de "pensando…". Era o `q-spinner-dots` do Quasar, 16 px, na
  // cor do texto; aqui é CSS puro, no mesmo tamanho e na mesma cor (o mesmo
  // desenho que a Sinuca usa).
  &__pontos {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    width: 16px;
    height: 16px;
    flex: none;

    i {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: currentColor;
      animation: ros-chess-pontos 1s ease-in-out infinite;
    }
    i:nth-child(2) {
      animation-delay: 0.16s;
    }
    i:nth-child(3) {
      animation-delay: 0.32s;
    }
  }

  &__wait-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 26px 30px;
    border-radius: 20px;
    background: var(--ros-chess-bg-17);
    border: 1px solid var(--ros-chess-line-3);
    backdrop-filter: var(--ros-chess-desfoque);
    -webkit-backdrop-filter: var(--ros-chess-desfoque);
    box-shadow: 0 24px 60px var(--ros-chess-sombra-50);
    max-width: min(360px, 92%);
  }

  &__wait-title,
  &__over-title,
  &__promo-title {
    font-size: 22px;
    font-weight: 800;
    color: var(--ros-chess-texto-100);
    text-align: center;
  }

  &__qr {
    width: min(230px, 62vw);
    aspect-ratio: 1;
    border-radius: 16px;
    background: var(--ros-chess-bg-18);
    padding: 10px;
    box-shadow: 0 10px 30px var(--ros-chess-sombra-45);
  }

  &__code-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__code-label {
    font-size: 12px;
    color: var(--ros-chess-texto-suave);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  &__code {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 6px;
    color: var(--ros-chess-bg-13);
    padding: 4px 10px 4px 16px;
    border-radius: 10px;
    background: var(--ros-chess-bg-19);
    border: 1px solid var(--ros-chess-line-4);
    font-variant-numeric: tabular-nums;
  }

  &__copy {
    font: inherit;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 9px;
    background: var(--ros-chess-preenchimento-10);
    color: var(--ros-chess-texto);
    cursor: pointer;

    &:hover {
      background: rgba(var(--ros-chess-branco-rgb), 0.18);
    }
  }

  &__wait-hint {
    font-size: 13px;
    color: var(--ros-chess-texto-suave);
    text-align: center;
  }

  &__code-input {
    font: inherit;
    width: min(240px, 70vw);
    text-align: center;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 6px;
    text-transform: uppercase;
    padding: 12px;
    border: 1px solid var(--ros-chess-linha-15);
    border-radius: 12px;
    background: var(--ros-chess-veu-30);
    color: var(--ros-chess-texto-100);
    outline: none;

    &:focus {
      border-color: var(--ros-chess-bg-13);
    }
  }

  &__err {
    font-size: 13px;
    color: var(--ros-chess-fg-3);
  }

  &__promo-row {
    display: flex;
    gap: 12px;
  }

  &__promo-btn {
    font: inherit;
    width: 68px;
    height: 68px;
    display: grid;
    place-items: center;
    border: 1px solid var(--ros-chess-shadow-1);
    border-radius: 14px;
    background: linear-gradient(170deg, var(--ros-chess-bg-20), var(--ros-chess-bg-21));
    cursor: pointer;
    transition:
      transform 0.12s ease,
      border-color 0.12s ease;

    img {
      width: 52px;
      height: 52px;
    }

    &:hover {
      transform: translateY(-2px);
      border-color: var(--ros-chess-bg-13);
    }
  }

  &__solid-btn {
    font: inherit;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 11px 26px;
    border: none;
    border-radius: 999px;
    background: linear-gradient(135deg, var(--ros-chess-bg-22), var(--ros-chess-bg-23));
    color: var(--ros-chess-fg-4);
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 8px 26px var(--ros-chess-shadow-6);

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }

  &__ghost-btn {
    font: inherit;
    padding: 9px 20px;
    border: none;
    border-radius: 999px;
    background: var(--ros-chess-preenchimento-08);
    color: var(--ros-chess-texto-suave);
    font-size: 13px;
    cursor: pointer;
  }

  &__net-toast {
    position: absolute;
    bottom: calc(18px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 16px;
    border-radius: 999px;
    background: rgba(var(--ros-chess-preto-rgb), 0.6);
    color: var(--ros-chess-texto);
    font-size: 13px;
    z-index: 8;
  }
}

.chess-pop-enter-active {
  transition:
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.3s ease;
}
.chess-pop-enter-from {
  transform: scale(0.8);
  opacity: 0;
}
.chess-fade-enter-active,
.chess-fade-leave-active {
  transition: opacity 0.25s ease;
}
.chess-fade-enter-from,
.chess-fade-leave-to {
  opacity: 0;
}

// O perfil leve vem do host (`desempenho.modoLeve`), não do atributo que o
// RoqueOS põe no <html>: fora do RoqueOS esse atributo não existe.
.ros-chess--low {
  .ros-chess__menu,
  .ros-chess__over,
  .ros-chess__promo,
  .ros-chess__wait-card,
  .ros-chess__pcard {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .ros-chess__menu,
  .ros-chess__over,
  .ros-chess__promo {
    background: var(--ros-chess-bg-24);
  }
  .ros-chess__pcard {
    background: var(--ros-chess-bg-25);
  }
  .ros-chess__turn-dot {
    animation: none !important;
  }
}

@keyframes chess-dot {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.35);
    opacity: 0.7;
  }
}

@keyframes ros-chess-pontos {
  0%,
  80%,
  100% {
    opacity: 0.25;
    transform: scale(0.7);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
