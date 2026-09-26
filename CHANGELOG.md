# Changelog

## 0.1.0 (25/09/2026)

- O Xadrez sai do repositório do RoqueOS e passa a falar com ele só pelo `jogo-sdk` 0.2.0.
  Regra, IA, tabuleiro 3D, arte 2D das peças, som, visual, nomes e dados de evento
  (`game_start` com `mode` e, contra a IA, `level`; `game_over` com `result`, `mode` e `level`)
  e o gancho `window.__chess` ficam como eram. O código que toca a GPU
  (`src/tabuleiro3d.js`, que era o `utils/games/board3d.js` de lá, e `src/arteDoTabuleiro.js`,
  que era o `boardArt.js`) veio sem mudar uma linha.
- A partida online deixa de falar com o Firebase: a sala vem do host, pela capacidade `sala`
  do SDK. O `estado` do tabuleiro e a `vez` que atravessam a sala têm o formato de antes. O
  link do convite (o do QR e o do "copiar") vem do host.
- O convite pelo link é lido uma vez, ao abrir o jogo. Um segundo convite com a janela já
  aberta não chega ao jogo (limitação aceita nesta versão; antes vinha por uma prop que mudava).
- `three` e `qrcode` viram `peerDependencies`: o RoqueOS fornece os dele, nas mesmas versões de
  antes.
- Texto nos dez idiomas em `i18n/`, ícones SVG próprios (o do QR desenhado aqui), os três
  pontos de "pensando…" em CSS, e o jogo roda sozinho com `yarn dev`, com a partida online
  entre duas abas.
- O convidado que entra numa partida online já está jogando. Antes ele continuava na tela de
  digitar o código, por cima do tabuleiro, e nunca conseguia mexer uma peça.
- O anfitrião vê o próprio nome no cartão de baixo e o do convidado no de cima. Antes os dois
  nomes saíam trocados para ele (só o convidado via certo).
- Começar uma partida online acende o cartão das brancas, de quem é a vez. Antes ficava aceso
  o cartão da vez da partida anterior até o primeiro lance.
- Sem conta, quem recusa a sala é o host (antes o jogo olhava a conta sozinho); o aviso "Entre
  na sua conta para jogar online" é o mesmo, com o mesmo tipo.
- O nome do jogador no cartão vem da identidade do host (antes vinha da store de conta do
  RoqueOS) e continua acompanhando quem entra e sai com o jogo aberto.
- O perfil leve do aparelho chega pelo host e liga a classe `ros-chess--low`.
