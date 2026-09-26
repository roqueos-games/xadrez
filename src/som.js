// O som do Xadrez, procedural: nenhum arquivo de áudio, só osciladores curtos (o
// lance, a captura, o xeque e o fim de partida). O AudioContext é do host (no
// RoqueOS, o compartilhado com os apps de música; fora dele, um próprio), e o jogo
// só toca quando o contexto já está rodando, porque tocar num contexto suspenso
// enfileira som que sai tudo junto depois. O Xadrez não tem botão de mudo, nem
// tinha antes da extração.
//
// Frequências, formas de onda e envelopes são os mesmos do componente de antes da
// extração, em 25/09/2026: o jogo tem de soar igual.

/**
 * @param {{ contexto: () => AudioContext | null }} audio a capacidade `audio` do host
 * @param {(fn: () => void, ms: number) => unknown} agendar o `later` do jogo: as
 *   notas atrasadas usam o relógio dele, que desmontar limpa, para nenhuma nota
 *   tocar depois que a janela fechou.
 */
export function criarSom(audio, agendar) {
  let volume = null
  let dono = null

  const contexto = () => {
    try {
      const c = audio.contexto()
      if (!c || c.state !== 'running') return null
      // O ganho mestre pertence a UM contexto. Se o host trocar de contexto (o
      // iOS fecha o antigo ao voltar do fundo), recria em vez de ligar num nó
      // morto.
      if (dono !== c) {
        volume = c.createGain()
        volume.gain.value = 0.4
        volume.connect(c.destination)
        dono = c
      }
      return c
    } catch {
      return null
    }
  }

  const blip = (freq, type = 'sine', peak = 0.1, dur = 0.1) => {
    const c = contexto()
    if (!c) return
    const now = c.currentTime
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(peak, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    g.connect(volume)
    o.connect(g)
    o.start(now)
    o.stop(now + dur + 0.02)
  }

  return {
    /** Um lance sem captura. */
    lance() {
      blip(360, 'sine', 0.12, 0.09)
    },
    /** Um lance que tomou peça. */
    captura() {
      blip(220, 'triangle', 0.14, 0.14)
    },
    /** Xeque: dois toques, o segundo mais grave, 90 ms depois. */
    xeque() {
      blip(720, 'square', 0.1, 0.12)
      agendar(() => blip(560, 'square', 0.1, 0.12), 90)
    },
    /** Fim de partida: arpejo que sobe na vitória e desce na derrota. */
    fim(venceu) {
      const notas = venceu ? [60, 64, 67, 72] : [64, 60, 55]
      notas.forEach((m, i) =>
        agendar(() => blip(440 * Math.pow(2, (m - 69) / 12), 'triangle', 0.14, 0.3), i * 110),
      )
    },
  }
}
