<template>
  <svg
    class="icone-xadrez"
    :width="tamanho"
    :height="tamanho"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="nome === 'robo'">
      <rect x="5" y="8" width="14" height="10.5" rx="2.5" />
      <path d="M12 8V4.5" />
      <path d="M9.3 12.5h.01" />
      <path d="M14.7 12.5h.01" />
      <path d="M10 15.5h4" />
      <path d="M3 12v3" />
      <path d="M21 12v3" />
    </template>
    <template v-else-if="nome === 'pessoas'">
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <circle cx="16.5" cy="9.5" r="2.5" />
      <path d="M16 14.2a4.5 4.5 0 0 1 4.5 4.8" />
    </template>
    <template v-else-if="nome === 'qr'">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M7 7h.01" />
      <path d="M17 7h.01" />
      <path d="M7 17h.01" />
      <path
        d="M14 14h2v2h-2zM18 14h2v2h-2zM16 16h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"
        fill="currentColor"
        stroke="none"
      />
    </template>
    <template v-else-if="nome === 'entrar'">
      <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14" />
      <path d="M10 16.5 14.5 12 10 7.5" />
      <path d="M14.5 12H4" />
    </template>
    <template v-else-if="nome === 'sorriso'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 14.2a4.2 4.2 0 0 0 7 0" />
      <path d="M9 9.8h.01" />
      <path d="M15 9.8h.01" />
    </template>
    <template v-else-if="nome === 'cerebro'">
      <path
        d="M9 20.5v-3H7.5A2.5 2.5 0 0 1 5 15v-2l-1.5-.5L5 9.5a7 7 0 0 1 13.8 1.6c0 2.2-1 3.8-2.3 5v4.4"
      />
      <path d="M11 8.5a2 2 0 0 1 3.5 1.3 2 2 0 0 1-1.5 1.9v1.3" />
    </template>
    <template v-else-if="nome === 'fogo'">
      <path
        d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-3.6-2.4-5.6-3.7-8.3-.5 2-1.6 3.1-2.8 3.6.2-2.8-.9-5.4-3-6.8.2 3.4-3.5 6.4-3.5 11.5A6.5 6.5 0 0 0 12 21z"
      />
    </template>
    <template v-else-if="nome === 'copiar'">
      <rect x="8.5" y="8.5" width="11" height="12" rx="2" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" />
    </template>
    <template v-else-if="nome === 'fechar'">
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </template>
    <template v-else-if="nome === 'reiniciar'">
      <path d="M5.2 13.5a7 7 0 1 0 1.9-6.4" />
      <path d="M4.5 4v4.5H9" />
    </template>
  </svg>
</template>

<script setup>
// Os ícones do Xadrez, desenhados aqui. O jogo roda num app Vue próprio, sem o
// Quasar do RoqueOS, então `q-icon` não existe para ele; e um jogo aberto não
// pode depender da fonte de ícones de outro produto. Desenho autoral, sem
// licença de terceiro, do catálogo comum dos jogos da roqueos-games. O `qr` não
// estava no catálogo e foi desenhado aqui, no mesmo traço: três quadros de canto
// com o ponto no meio e cinco módulos cheios no quarto canto.
defineProps({
  nome: {
    type: String,
    required: true,
    validator: (v) =>
      [
        'robo',
        'pessoas',
        'qr',
        'entrar',
        'sorriso',
        'cerebro',
        'fogo',
        'copiar',
        'fechar',
        'reiniciar',
      ].includes(v),
  },
  tamanho: { type: [Number, String], default: 18 },
})
</script>

<style scoped>
/* Em linha e centrado na vertical, como o `q-icon` que ele substitui: o botão de
   copiar o convite é um <button> sem flex, e um ícone em bloco ali encostaria na
   esquerda em vez de ficar no meio. Dentro de flex e grid dá no mesmo. */
.icone-xadrez {
  display: inline-block;
  vertical-align: middle;
  flex: none;
}
</style>
