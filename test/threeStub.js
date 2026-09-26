// Um three de mentira para o teste. O jsdom não tem WebGL: o WebGLRenderer de
// verdade lança ao criar o contexto, e o tabuleiro 3D não nasce. Este dublê é o
// `tests/setup/threeStub.js` do RoqueOS (o que os testes do Xadrez usavam lá, até
// 25/09/2026), recortado ao que o `tabuleiro3d.js` toca: cena, câmera, luzes,
// grupo, malha, as geometrias torneadas e extrudadas das peças, os materiais, as
// texturas de canvas e o raycaster.
//
// Três coisas a mais que lá, para o teste ver pelo lado de fora o que antes só
// dava para ver abrindo o componente:
// - o renderer guarda as opções com que nasceu (sem o canvas), o pixel ratio, se o
//   mapa de sombra ligou, quantos quadros desenhou e se foi descartado, e se
//   pendura no canvas que o jogo entregou (`canvas.__renderizador`). É assim que
//   o teste confere que o modo leve do host chega no código de GPU e que
//   desmontar solta o contexto;
// - a câmera guarda o `fov` e o `aspect` com que nasceu. Lá ela não guardava, e o
//   enquadramento de recuo do `resize()` (o ramo sem `Vector3.project`, que é o
//   deste dublê) fazia conta com `undefined` e dava NaN, calado;
// - o raycaster acerta o ponto do tabuleiro que o teste mandar em
//   `Raycaster.mira` (`{ x, z }` no espaço do mundo; null é tocar fora do
//   tabuleiro, como era sempre lá). Sem isso o toque na casa, que é o único
//   jeito de jogar, ficava sem teste.
//
// O mock de módulo do Vitest é ESTRITO: ler um export que o dublê não tem lança.
// Por isso tudo o que o `tabuleiro3d.js` lê está aqui, inclusive o que só as
// Damas usam (`TorusGeometry`), porque o arquivo viaja inteiro.
//
// Uso: vi.mock('three', async () => (await import('./threeStub.js')).criarThreeFalso())
export function criarThreeFalso() {
  class Vec3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x
      this.y = y
      this.z = z
    }
    set(x, y, z) {
      this.x = x
      this.y = y
      this.z = z
      return this
    }
    setScalar(s) {
      return this.set(s, s, s)
    }
  }
  class Vec2 {
    constructor(x = 0, y = 0) {
      this.x = x
      this.y = y
    }
    set(x, y) {
      this.x = x
      this.y = y
      return this
    }
  }
  class Color {
    constructor(hex = 0xffffff) {
      this.hex = hex
    }
    set(hex) {
      this.hex = hex
      return this
    }
  }
  class Object3D {
    constructor() {
      this.children = []
      this.position = new Vec3()
      this.scale = new Vec3(1, 1, 1)
      this.rotation = new Vec3()
      this.visible = true
      this.castShadow = false
      this.receiveShadow = false
      this.userData = {}
    }
    add(...filhos) {
      this.children.push(...filhos)
    }
    remove(x) {
      this.children = this.children.filter((c) => c !== x)
    }
  }
  class Mesh extends Object3D {
    constructor(geometry, material) {
      super()
      this.geometry = geometry
      this.material = material
    }
  }
  class Geometry {
    constructor() {
      this.attributes = {}
      this.descartado = false
    }
    rotateX() {
      return this
    }
    translate() {
      return this
    }
    dispose() {
      this.descartado = true
    }
  }
  // As peças torneadas guardam o perfil, e o cavalo guarda a silhueta: o teste
  // do jogo não olha, mas é o que o dublê de lá fazia.
  class LatheGeometry extends Geometry {
    constructor(pontos) {
      super()
      this.pontos = pontos
    }
  }
  class ExtrudeGeometry extends Geometry {
    constructor(forma) {
      super()
      this.forma = forma
    }
  }
  class Shape {
    moveTo() {
      return this
    }
    lineTo() {
      return this
    }
    bezierCurveTo() {
      return this
    }
    closePath() {
      return this
    }
  }
  class Material {
    constructor(opcoes = {}) {
      Object.assign(this, opcoes)
      this.opacity = opcoes.opacity ?? 1
      this.color = new Color(opcoes.color)
      this.descartado = false
    }
    // As argolas de "captura obrigatória" das Damas clonam o material da argola.
    clone() {
      return new Material({ ...this, color: this.color.hex })
    }
    dispose() {
      this.descartado = true
    }
  }
  class Camera extends Object3D {
    constructor(fov, aspect) {
      super()
      this.fov = fov
      this.aspect = aspect
    }
    updateProjectionMatrix() {}
    lookAt() {}
  }
  class ShadowLight extends Object3D {
    constructor() {
      super()
      this.shadow = {
        mapSize: new Vec2(),
        camera: { left: 0, right: 0, top: 0, bottom: 0, far: 0 },
        bias: 0,
      }
    }
  }
  class CanvasTexture {
    constructor(imagem) {
      this.image = imagem
      this.anisotropy = 1
      this.colorSpace = ''
      this.descartado = false
    }
    dispose() {
      this.descartado = true
    }
  }
  class Raycaster {
    setFromCamera() {}
    intersectObject(objeto) {
      if (Raycaster.mira == null) return []
      const { x, z } = Raycaster.mira
      return [{ object: objeto, distance: 1, point: new Vec3(x, 0.3, z) }]
    }
  }
  Raycaster.mira = null
  class WebGLRenderer {
    constructor(opcoes = {}) {
      this.opcoes = { ...opcoes }
      delete this.opcoes.canvas
      this.pixelRatio = 1
      this.quadros = 0
      this.descartado = false
      this.shadowMap = { enabled: false, type: 0 }
      this.domElement = opcoes.canvas ?? document.createElement('canvas')
      if (opcoes.canvas) opcoes.canvas.__renderizador = this
    }
    setPixelRatio(r) {
      this.pixelRatio = r
    }
    setSize() {}
    render() {
      this.quadros++
    }
    dispose() {
      this.descartado = true
    }
  }
  return {
    Scene: Object3D,
    Group: Object3D,
    Mesh,
    BoxGeometry: class extends Geometry {},
    PlaneGeometry: class extends Geometry {},
    CircleGeometry: class extends Geometry {},
    RingGeometry: class extends Geometry {},
    TorusGeometry: class extends Geometry {},
    LatheGeometry,
    ExtrudeGeometry,
    Shape,
    MeshBasicMaterial: Material,
    MeshStandardMaterial: Material,
    MeshPhysicalMaterial: Material,
    ShadowMaterial: Material,
    HemisphereLight: class extends Object3D {},
    DirectionalLight: ShadowLight,
    PerspectiveCamera: Camera,
    CanvasTexture,
    Raycaster,
    WebGLRenderer,
    Vector2: Vec2,
    Vector3: Vec3,
    PCFSoftShadowMap: 2,
    SRGBColorSpace: 'srgb',
  }
}
