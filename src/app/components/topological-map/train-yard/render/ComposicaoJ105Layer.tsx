import { ScissorsLineDashed } from 'lucide-react'
import type { ProjectedScene } from '../project'
import { resolveLineIdByNome } from '../etapaParada'
import { AMV_T2_MARKER_ID, amvAtivoDoPassoJ105, gruposDoPassoJ105, LOCO_M, passoCitaAmvJ105, passoCitaMarcoJ105, VAGAO_M, type GrupoVisualJ105, type PapelVeiculoJ105 } from '../../../../data/visualJ105'

// Composição do J105 desenhada veículo a veículo, sobre a MESMA cena projetada que o resto do mapa
// usa — pedido explícito do usuário (2026-09-21): "a visão do mapa em si não deve mudar, apenas o
// trem representado que deve ir mudando conforme vai mudando de passo", usando as imagens de
// referência do plano (`J105/passo-*.jpg`) como modelo visual.
//
// Exclusivo do J105: os demais trens continuam com o pino único de `Composition.tsx` (representação
// de planejamento, ver comentário no topo daquele arquivo) — nada aqui altera o caminho deles.
//
// O QUE muda por passo (quais grupos existem, onde cortam, para qual linha vão) vive em
// `visualJ105.ts`; este arquivo só desenha. Escala: cada veículo ocupa seu comprimento REAL em
// metros convertido para unidades de viewBox pela mesma regra do resto do mapa
// (metros ÷ comprimento da linha × largura desenhada) — um trem de 92 vagões ocupa de fato
// ~metade da Linha do Desvio, como na vida real.

/** Régua compartilhada com `visualJ105.ts` (comprimento "achatado" de cada veículo) — as posições
 *  dos grupos são calculadas lá com estes mesmos valores. */
const COMPRIMENTO_VAGAO_M = VAGAO_M
const COMPRIMENTO_LOCO_M = LOCO_M
/** Altura do bloco — MESMO valor fixo que os demais trens usam pro trem em foco/de fundo
 *  (`FG_BLOCK_ALTURA`/`BG_BLOCK_ALTURA`, `Composition.tsx`), pedido explícito do usuário,
 *  2026-09-22: "deixe a altura dos vagoes e locomotivas iguais aos outros trens J614, R045 etc".
 *  Substitui o cálculo anterior baseado na faixa do trilho (`alturaTrilho`/`resolveTrackHeight`) e
 *  a diferença de altura vagão×locomotiva (`ALTURA_VAGAO_FATOR`) — como os demais trens desenham
 *  TODO segmento (vagão ou locomotiva) na mesma altura fixa, sem variar por tipo de linha, o J105
 *  passa a fazer o mesmo, pra não destoar visualmente lado a lado no mesmo pátio. */
export const ALTURA_VEICULO = 7

// Paleta — MESMOS tokens que `Composition.tsx` usa pro trem em destaque dos demais trens
// (`FG_LOCOMOTIVA_*`/`FG_VAGAO_*`/`FG_RETIRADO_*`, ver comentário lá: "as locomotivas sao
// laranjas... os vagões sao dessa cor aqui verdinho" — reaproveitados aqui, não reinventados),
// trocados 2026-09-22 por pedido explícito do usuário: os quadrados sólidos brancos/azuis
// isolados do J105 tinham contraste ruim (sobretudo o vagão branco sumindo no fundo claro do
// light mode) — "quero que a Visão Topológica do J105 adote a mesma linguagem visual já usada
// nos outros trens". `--vli-map-segment-vagao`/`--vli-map-trem-locomotiva-*` já herdam o mesmo
// tratamento de contraste dark/light que o resto do mapa (ver `theme.css`), o problema não existe
// mais nessa paleta.
const COR_LOCO = 'var(--vli-map-trem-locomotiva-bg)'
const COR_LOCO_BORDA = 'var(--vli-map-trem-locomotiva-border)'
const COR_VAGAO = 'var(--vli-map-segment-vagao)'
const COR_VAGAO_BORDA = 'var(--vli-map-segment-vagao-border)'
const COR_RETIRADO = 'var(--vli-danger-strong-hover)'
const COR_RETIRADO_BORDA = 'var(--vli-danger-deep)'
// `alvo` (marcado pra retirada, ainda engatado) não existe como estado próprio no motor genérico
// (os demais trens não desenham essa granularidade veículo a veículo). 1ª tentativa: âmbar de
// "atenção" (`--vli-warning-text`) — trocado 2026-09-22 por pedido explícito do usuário: "os
// vagões sinalizados que serão cortados, não podem ficar amarelo, pois confunde com a
// locomotiva" (o laranja da locomotiva e o âmbar do alvo liam parecido demais lado a lado, ex.:
// Passo 11). Agora usa o MESMO vermelho de `retirado` — o vagão já é visualmente "vermelho" antes
// mesmo do corte de fato acontecer; a diferença de estado (ainda engatado vs. já separado) segue
// vindo do vão/traço de `MarcaCorte`, que só aparece no passo em que o corte de fato ocorre.
const COR_ALVO = COR_RETIRADO
const COR_ALVO_BORDA = COR_RETIRADO_BORDA
// `bom` (vagão sendo incluído) também não existe no motor genérico — mantido no verde de
// "incluído" já usado no resto do produto (legenda "Composição Geral", chip `TagVagao`), única
// cor desta paleta que não veio de `Composition.tsx` porque lá não há equivalente.
const COR_INCLUIDO = 'var(--vli-success-text)'
/** Opacidade dos grupos `esmaecido` (`grupoEstacionadoLN3`, `visualJ105.ts`) — visível o passo
 *  todo, mas claramente "não é o J105 em manobra", sem precisar de uma segunda paleta de cor. */
export const OPACIDADE_ESMAECIDO = 0.4

interface EstiloVeiculo {
  preenchimento: string
  contorno: string
  comprimentoM: number
}

/** `alvo` = vagão já marcado para retirada mas ainda engatado: mesmo vermelho de `retirado` (ver
 *  `COR_ALVO` acima) — o corte em si só muda o `MarcaCorte` (vão + traço), não a cor do vagão. */
export function estiloDe(papel: PapelVeiculoJ105): EstiloVeiculo {
  switch (papel) {
    case 'loco':
      return { preenchimento: COR_LOCO, contorno: COR_LOCO_BORDA, comprimentoM: COMPRIMENTO_LOCO_M }
    case 'retirado':
      return { preenchimento: COR_RETIRADO, contorno: COR_RETIRADO_BORDA, comprimentoM: COMPRIMENTO_VAGAO_M }
    case 'alvo':
      return { preenchimento: COR_ALVO, contorno: COR_ALVO_BORDA, comprimentoM: COMPRIMENTO_VAGAO_M }
    case 'bom':
      return { preenchimento: COR_INCLUIDO, contorno: COR_VAGAO_BORDA, comprimentoM: COMPRIMENTO_VAGAO_M }
    default:
      return { preenchimento: COR_VAGAO, contorno: COR_VAGAO_BORDA, comprimentoM: COMPRIMENTO_VAGAO_M }
  }
}

/** Largura do vão físico aberto na régua no ponto de corte — em unidades de viewBox, não em
 *  metros (não é um deslocamento real de posição, só o "tira um pedacinho" visual). */
const CORTE_VAO_LARGURA = 1.6

/** Cor do traço/ícone de corte — vermelho semântico de "ação de corte", MESMO token que
 *  `EtapaCorteLayer.tsx` já usa pro ícone equivalente dos demais trens (`ICONE_COR` lá,
 *  `--vli-danger-text`) — não `COR_RETIRADO` (esse é o preenchimento do VAGÃO retirado/alvo, um
 *  estado diferente do marcador de ação). 2026-09-22: rodada anterior tinha trocado por um tom
 *  neutro ("a barra vermelha tá muito feia"); pedido seguinte do usuário reverteu — "pode manter
 *  o traço vermelho entre os vagões" — mantendo o traço FINO da rodada anterior (o que incomodava
 *  não era a cor em si, era a barra grossa/protuberante), agora com o ícone de tesoura (abaixo)
 *  completando a leitura "aqui foi feito um corte", como pedido. */
const COR_CORTE = 'var(--vli-danger-text)'

/** Ícone de tesoura acima do corte — MESMO ícone (`ScissorsLineDashed`, lucide-react) que
 *  `EtapaCorteLayer.tsx` usa pro marcador de corte dos demais trens (`IconeCorte` lá) — pedido
 *  explícito do usuário, 2026-09-22: "inclua aquele ícone de tesoura logo acima, usado nas
 *  versões anteriores". Menor que o de `EtapaCorteLayer` (18 → 9 unidades) porque a régua do J105
 *  desenha numa escala bem mais compacta (`ALTURA_VEICULO = 7` vs. a faixa de trilho inteira) —
 *  um ícone do mesmo tamanho absoluto dominaria o desenho. */
const CORTE_ICONE_TAMANHO = 9
/** Respiro entre o topo do bloco e a base do ícone. */
const CORTE_ICONE_GAP = 1.5

/**
 * Marca de corte — REDESENHADA (2026-09-22, pedido explícito do usuário: o "X" vermelho lia como
 * "erro/proibido", não como "aqui foi feito um corte operacional"). Trocado por vocabulário mais
 * técnico-ferroviário: um VÃO real interrompendo a régua contínua de blocos (como o espaço físico
 * de um desengate) + um traço vertical fino no meio dele + o ícone de tesoura acima (ver
 * `CORTE_ICONE_TAMANHO`) marcando a ação. O vão é só um retângulo na cor do fundo do canvas
 * "apagando" uma fatia da régua contínua (não reposiciona nenhum vagão — a lógica de posição
 * permanece intocada, isto é puramente uma máscara visual por cima dela).
 */
export function MarcaCorte({ x, y, altura }: { x: number; y: number; altura: number }) {
  const iconeCy = y - altura / 2 - CORTE_ICONE_GAP - CORTE_ICONE_TAMANHO / 2
  return (
    <g>
      <rect
        x={x - CORTE_VAO_LARGURA / 2}
        y={y - altura / 2 - 0.4}
        width={CORTE_VAO_LARGURA}
        height={altura + 0.8}
        fill="var(--vli-map-canvas-bg)"
      />
      <line x1={x} y1={y - altura / 2 - 0.6} x2={x} y2={y + altura / 2 + 0.6} stroke={COR_CORTE} strokeWidth={0.7} strokeLinecap="round" />
      <g transform={`translate(${x - CORTE_ICONE_TAMANHO / 2}, ${iconeCy - CORTE_ICONE_TAMANHO / 2})`}>
        <ScissorsLineDashed size={CORTE_ICONE_TAMANHO} color={COR_CORTE} strokeWidth={2.25} />
      </g>
    </g>
  )
}

/** Dimensões do badge do AMV — retângulo pequeno o bastante pra não competir com a régua de
 *  vagões, grande o bastante pra "AMV" caber com folga em maiúsculas. */
const AMV_BADGE_W = 15
const AMV_BADGE_H = 8.5
const AMV_BADGE_RX = 1.4
/** Fração do caminho da diagonal do travessão (0 = encostado na linha principal, 1 = na outra
 *  ponta) onde o CENTRO do badge fica ancorado — pedido explícito do usuário, 2026-09-22, com
 *  referência visual: "mais pro meio do travessão", não colado em cima da linha principal (1ª
 *  tentativa). Um pouco menos da metade (não 0.5 cravado) porque o badge tem largura própria — a
 *  metade visual "parece" um pouco mais alta que a metade matemática da diagonal. */
const AMV_BADGE_FRACAO_DIAGONAL = 0.42

/**
 * Ícone dedicado do AMV do Travessão 2 — SUBSTITUI o círculo azul genérico de `Marker.tsx` só
 * pro J105 (`markerOcultoId`/`YardCanvas.tsx`, o glyph genérico nem chega a desenhar nesse ponto).
 * Redesenhado 2026-09-22 em 3 rodadas (pedido explícito do usuário, sempre com referência visual):
 * 1ª — losango flutuando acima da linha, lia como "ícone solto".
 * 2ª — quadradinho sem texto, EM CIMA da linha, colado na régua de vagões ("não é isso, está em
 *      cima da linha do trem e ele não fica lá").
 * 3ª (atual) — BADGE retangular com o texto "AMV" dentro (não mais número solto — pedido
 *      explícito: "ao invés de número tá escrito AMV"), ancorado no MEIO da diagonal do travessão
 *      (`AMV_BADGE_FRACAO_DIAGONAL`/`acharPosicaoJuncaoT2`, abaixo — não mais colado onde a diagonal
 *      encosta na linha principal, pedido explícito: "mais pro meio do travessão").
 * Cor NEUTRA nos dois estados (nunca vermelho, reservado a alerta/retirada, ver `COR_RETIRADO` em
 * `MarcaCorte`) — só a INTENSIDADE muda: cinza-azulado discreto (`--vli-text-lo`, mesmo tom de
 * rótulo/linha do resto do pátio) quando neutro, cor de destaque do produto (`--vli-primary`, a
 * MESMA da seta de sentido — não uma cor nova) quando ativo/sendo manipulado.
 */
export function AmvJ105Marker({ x, y, ativo }: { x: number; y: number; ativo: boolean }) {
  const cor = ativo ? 'var(--vli-primary)' : 'var(--vli-text-lo)'
  return (
    <g pointerEvents="none">
      <rect x={x - AMV_BADGE_W / 2} y={y - AMV_BADGE_H / 2} width={AMV_BADGE_W} height={AMV_BADGE_H} rx={AMV_BADGE_RX} fill={cor} />
      <text
        x={x}
        y={y + 0.4}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={5}
        fontWeight={700}
        fill="#fff"
        letterSpacing={0.3}
        fontFamily="Manrope, sans-serif"
      >
        AMV
      </text>
    </g>
  )
}

/** Cor sólida da bolinha do marco — `--vli-map-yellow-dot`, MESMO tom nos dois temas (2026-09-23,
 *  pedido explícito do usuário, com imagem de referência: "o marco, no light mode, precisa ser
 *  mais amarelo mesmo... não tanto marrom" — o token usado antes, `--vli-map-yellow-strong`, é
 *  tunado pra CONTRASTE DE TEXTO e por isso escurece pra um marrom/âmbar no light, o que não faz
 *  sentido pra um preenchimento sólido; ver comentário do token em `theme.css`). */
const COR_MARCO = 'var(--vli-map-yellow-dot)'
/** Raio (viewBox units) da bolinha do marco — pequeno o bastante pra não competir com o badge do
 *  AMV nem com a régua de vagões (os dois nunca aparecem juntos no mesmo passo, mas ocupam a mesma
 *  região visual do travessão). */
const MARCO_RAIO = 3

/**
 * Bolinha amarela sólida marcando ONDE o trem deve parar — pedido explícito do usuário,
 * 2026-09-22, com imagem de referência (Passo 2 selecionado): "quando for um passo falando de
 * Marco, ele precisa ser representado assim, em cima do travessão, como uma bolinha amarela. é
 * onde o trem deve parar." Reaproveita o MESMO ponto de ancoragem que `AmvJ105Marker` usa
 * (`acharPosicaoJuncaoT2`, meio da diagonal do Travessão 2) — os passos "de marco" (2, 20, 29,
 * `passoCitaMarcoJ105`) e os "de AMV citado" (`passoCitaAmvJ105`) são conjuntos disjuntos, então
 * nunca desenham no mesmo passo.
 */
export function MarcoJ105Marker({ x, y }: { x: number; y: number }) {
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={MARCO_RAIO} fill={COR_MARCO} stroke="var(--vli-map-canvas-bg)" strokeWidth={0.6} />
    </g>
  )
}

/**
 * Acha, na cena já projetada, ONDE ancorar o centro do badge do AMV do Travessão 2
 * (`AMV_T2_MARKER_ID`) — não mais o ponto do marcador em si (que fica colado na linha principal),
 * e sim um ponto no MEIO da diagonal do travessão que liga essa linha à outra (`scene.connections`,
 * mesma conexão real que `Connections.tsx` desenha) — pedido explícito do usuário, 2026-09-22:
 * "mais pro meio do travessão". Acha a conexão comparando as pontas dela (`from`/`to`, coordenadas
 * SEM `labelGutterWidth`, mesma convenção de `ProjectedMarker.x`) com a posição do próprio
 * marcador — a ponta que coincide é "onde a diagonal encosta na linha principal"; a fração do
 * caminho até a ponta OPOSTA é o centro do badge (`AMV_BADGE_FRACAO_DIAGONAL`).
 * Sem conexão real encontrada (não deveria acontecer no fixture EHT), cai pra posição do próprio
 * marcador — mesma robustez de outras camadas do mapa quando um dado esperado não existe.
 * Reaproveitada também pela bolinha do marco (`MarcoJ105Marker`) — é o MESMO ponto físico (o AMV e
 * o marco de parada dos passos 2/20/29 vivem no mesmo travessão), então nomeada pelo ponto em si
 * (junção do Travessão 2), não mais só pelo AMV.
 */
export function acharPosicaoJuncaoT2(scene: ProjectedScene, labelGutterWidth: number): { x: number; y: number } | null {
  for (const line of scene.lines) {
    for (const el of line.elements ?? []) {
      if (el.kind !== 'marker' || el.id !== AMV_T2_MARKER_ID) continue
      const EPS = 0.5
      const conexao = scene.connections.find(
        (c) => (Math.hypot(c.from.x - el.x, c.from.y - el.y) < EPS) || (Math.hypot(c.to.x - el.x, c.to.y - el.y) < EPS),
      )
      if (!conexao) return { x: labelGutterWidth + el.x, y: el.y }
      const pertoDoFrom = Math.hypot(conexao.from.x - el.x, conexao.from.y - el.y) < EPS
      const ponta = pertoDoFrom ? conexao.from : conexao.to
      const outraPonta = pertoDoFrom ? conexao.to : conexao.from
      return {
        x: labelGutterWidth + ponta.x + (outraPonta.x - ponta.x) * AMV_BADGE_FRACAO_DIAGONAL,
        y: ponta.y + (outraPonta.y - ponta.y) * AMV_BADGE_FRACAO_DIAGONAL,
      }
    }
  }
  return null
}

interface ComposicaoJ105LayerProps {
  scene: ProjectedScene
  labelGutterWidth: number
  /** Passo selecionado (1..38) — `null`/ausente desenha a composição inicial (passo 1). */
  passo?: number | null
}

export function ComposicaoJ105Layer({ scene, labelGutterWidth, passo }: ComposicaoJ105LayerProps) {
  const passoResolvido = passo ?? 1
  const grupos = gruposDoPassoJ105(passoResolvido)
  // Badge do AMV só aparece nos passos que de fato citam o AMV no texto do plano — pedido
  // explícito do usuário, 2026-09-22: "o AMV só deve aparecer nas etapas que é citado
  // manipulação de AMV" (antes era desenhado em todos os 38 passos).
  const amv = passoCitaAmvJ105(passoResolvido) ? acharPosicaoJuncaoT2(scene, labelGutterWidth) : null
  const amvAtivo = amvAtivoDoPassoJ105(passoResolvido) != null
  // Bolinha do marco (ver doc de `MarcoJ105Marker`) — disjunto de `amv` (nunca os dois no mesmo
  // passo), mas resolvido independentemente por segurança (mesmo padrão de `alvoCameraJ105`).
  const marco = passoCitaMarcoJ105(passoResolvido) ? acharPosicaoJuncaoT2(scene, labelGutterWidth) : null

  return (
    <g data-composicao-j105="">
      {grupos.map((grupo, i) => (
        <GrupoDesenhado key={`${grupo.linha}-${grupo.posicaoM}-${i}`} grupo={grupo} scene={scene} labelGutterWidth={labelGutterWidth} />
      ))}
      {amv && <AmvJ105Marker x={amv.x} y={amv.y} ativo={amvAtivo} />}
      {marco && <MarcoJ105Marker x={marco.x} y={marco.y} />}
    </g>
  )
}

/** Geometria de um grupo já projetada na cena — cabeça/cauda em X de desenho, Y da linha e altura
 *  do retângulo. Função pura reaproveitada tanto pelo desenho (`GrupoDesenhado`) quanto pelo
 *  enquadramento de câmera (`alvoComposicaoJ105`, `PlanejamentoScreen.tsx`) — as duas precisam
 *  concordar exatamente sobre onde o grupo cai, senão a câmera engloba um retângulo que não é o
 *  desenhado. `null` quando a linha do grupo não existe na cena (mesmo critério do resto do mapa,
 *  ver `computeSegmento`, `etapaParada.ts`). */
function geometriaGrupoJ105(scene: ProjectedScene, labelGutterWidth: number, grupo: GrupoVisualJ105) {
  const lineId = resolveLineIdByNome(grupo.linha, scene.lines)
  const line = lineId ? scene.lines.find((l) => l.id === lineId) : undefined
  if (!line || line.length <= 0) return null

  const escala = line.width / line.length
  const y = line.y
  // Cabeça do grupo (locomotiva líder) ancorada na posição do passo; o resto do trem se estende
  // para trás (esquerda), como um trem de verdade parado naquele ponto.
  const xCabeca = labelGutterWidth + line.x + Math.min(1, Math.max(0, grupo.posicaoM / line.length)) * line.width
  const comprimentoTotalM = grupo.veiculos.reduce((soma, v) => soma + v.quantidade * estiloDe(v.papel).comprimentoM, 0)
  const xCauda = xCabeca - comprimentoTotalM * escala
  const altura = ALTURA_VEICULO
  return { xCabeca, xCauda, y, altura, escala }
}

/** Caixa (coordenadas de viewBox) que envolve TODOS os grupos desenhados num passo — usada como
 *  ÚLTIMO recurso por `alvoCameraJ105` (abaixo), quando o passo não tem nem corte nem AMV citado
 *  pra ancorar um enquadramento mais apertado. `null` quando nenhum grupo resolve contra a cena
 *  (não deveria acontecer em uso normal). */
export function alvoComposicaoJ105(scene: ProjectedScene, labelGutterWidth: number, grupos: GrupoVisualJ105[]) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const grupo of grupos) {
    const geo = geometriaGrupoJ105(scene, labelGutterWidth, grupo)
    if (!geo) continue
    x0 = Math.min(x0, geo.xCauda, geo.xCabeca)
    x1 = Math.max(x1, geo.xCauda, geo.xCabeca)
    y0 = Math.min(y0, geo.y - geo.altura / 2)
    y1 = Math.max(y1, geo.y + geo.altura / 2)
  }
  if (!Number.isFinite(x0)) return null
  return { x0, y0, x1, y1 }
}

/** X (viewBox) do ponto de corte de um grupo, dada sua geometria já projetada — MESMA fórmula que
 *  `GrupoDesenhado` usa pra desenhar `MarcaCorte` (extraída pra função própria, reaproveitada
 *  também por `alvoCameraJ105` abaixo, pra câmera e desenho NUNCA divergirem sobre onde o corte
 *  cai). `null` quando o grupo não tem corte neste passo. */
function calcularXCorte(grupo: GrupoVisualJ105, xCabeca: number, xCauda: number, escala: number): number | null {
  if (grupo.corte === 'cauda') return xCauda
  if (grupo.corte === 'atras-da-cabeca') {
    const papelCabeca = grupo.veiculos[0]?.papel
    const comprimentoCabecaM = papelCabeca ? estiloDe(papelCabeca).comprimentoM : 0
    return xCabeca - comprimentoCabecaM * escala
  }
  return null
}

/** Raio (metros, convertido via `escala` do grupo em questão) do enquadramento ao redor do PONTO
 *  do corte — pedido explícito do usuário, 2026-09-22: "não preciso ver o trem todo" nos passos de
 *  corte (ex.: Passo 3 — corte da locomotiva líder, Passo 7 — corte do vagão bom), só a
 *  locomotiva/vagão específico envolvido e o corte em si. */
const RAIO_ZOOM_CORTE_M = 70
/** Folga abaixo do bloco no enquadramento de corte — sem ícone ali, mesma folga de sempre. */
const RAIO_ZOOM_CORTE_Y_BAIXO = 10
/** Folga ACIMA do bloco — maior que a de baixo (`RAIO_ZOOM_CORTE_Y_BAIXO`) pra sobrar espaço pro
 *  ícone de tesoura que `MarcaCorte` desenha ali (`CORTE_ICONE_GAP + CORTE_ICONE_TAMANHO` = 10.5)
 *  não ficar cortado pela moldura da câmera. */
const RAIO_ZOOM_CORTE_Y_CIMA = 14
/** Meia-largura/altura (viewBox units, não metros — não há uma única linha/escala "dona" do AMV
 *  aqui) do enquadramento ao redor do AMV nos passos que o citam (`passoCitaAmvJ105`) — mesmo
 *  pedido: "manipulação de AMV, pode dar zoom no AMV", não a composição inteira. */
const RAIO_ZOOM_AMV_X = 55
const RAIO_ZOOM_AMV_Y = 26

/**
 * Caixa (viewBox) pra `centralizarCameraNoAlvo` (`PlanejamentoScreen.tsx`) ancorar o zoom/pan do
 * J105 neste passo — SUBSTITUI `alvoComposicaoJ105` como alvo principal (2026-09-22, pedido
 * explícito do usuário: "quero que dê mais zoom em algumas etapas... não preciso ver o trem
 * todo"). Prioridade:
 * 1. Passo cita o AMV (`passoCitaAmvJ105`) — enquadra só o badge do AMV (`acharPosicaoJuncaoT2`,
 *    mesmo ponto que `AmvJ105Marker` desenha).
 * 2. Algum grupo do passo tem corte (`calcularXCorte`, acima) — enquadra um raio pequeno ao redor
 *    do PONTO do corte, não o grupo inteiro (que pode ser o trem de 92 vagões inteiro, caso do
 *    corte da locomotiva líder, Passo 3).
 * 3. Nenhum dos dois — cai pra `alvoComposicaoJ105` (caixa de todos os grupos), mesmo
 *    comportamento de sempre pros passos "de deslocamento" (sem corte, sem AMV).
 * AMV e corte nunca coincidem no mesmo passo neste plano (conjuntos disjuntos,
 * `PASSOS_MANIPULACAO_AMV_T2`/passos com `corte`) — a ordem de prioridade aqui é só defensiva.
 */
export function alvoCameraJ105(scene: ProjectedScene, labelGutterWidth: number, passo: number) {
  const grupos = gruposDoPassoJ105(passo)

  if (passoCitaAmvJ105(passo)) {
    const amv = acharPosicaoJuncaoT2(scene, labelGutterWidth)
    if (amv) {
      return { x0: amv.x - RAIO_ZOOM_AMV_X, x1: amv.x + RAIO_ZOOM_AMV_X, y0: amv.y - RAIO_ZOOM_AMV_Y, y1: amv.y + RAIO_ZOOM_AMV_Y }
    }
  }

  for (const grupo of grupos) {
    if (!grupo.corte) continue
    const geo = geometriaGrupoJ105(scene, labelGutterWidth, grupo)
    if (!geo) continue
    const xCorte = calcularXCorte(grupo, geo.xCabeca, geo.xCauda, geo.escala)
    if (xCorte == null) continue
    const raioX = RAIO_ZOOM_CORTE_M * geo.escala
    return {
      x0: xCorte - raioX,
      x1: xCorte + raioX,
      y0: geo.y - geo.altura / 2 - RAIO_ZOOM_CORTE_Y_CIMA,
      y1: geo.y + geo.altura / 2 + RAIO_ZOOM_CORTE_Y_BAIXO,
    }
  }

  return alvoComposicaoJ105(scene, labelGutterWidth, grupos)
}

function GrupoDesenhado({ grupo, scene, labelGutterWidth }: { grupo: GrupoVisualJ105; scene: ProjectedScene; labelGutterWidth: number }) {
  const geo = geometriaGrupoJ105(scene, labelGutterWidth, grupo)
  if (!geo) return null
  const { xCabeca, xCauda, y, altura, escala } = geo

  // `veiculos` vem na ordem física (locomotiva líder primeiro); desenhamos da cauda para a cabeça,
  // então a cabeça fica à direita — mesma orientação das imagens de referência.
  const pecas: PapelVeiculoJ105[] = []
  for (const trecho of grupo.veiculos) {
    for (let i = 0; i < trecho.quantidade; i += 1) pecas.push(trecho.papel)
  }

  // Vagões COLADOS (sem vão entre eles) — mesma "régua contínua" que `Composition.tsx` usa pro
  // trem em destaque dos demais trens (`BlocoSegmentoDestaque`: "vagões colados, só o traço da
  // borda entre um <rect> e o vizinho já marca a fronteira de cada veículo, igual ao acoplamento
  // físico real do trem") — trocado 2026-09-22 por pedido explícito do usuário, que via os
  // quadrados do J105 como "grandes/isolados" (a antiga folga de 0.9m entre retângulos, removida
  // aqui, era exatamente o que os separava visualmente).
  // Locomotiva e vagão com o MESMO acabamento de canto (reto, sem `rx`) — 2026-09-22, pedido
  // explícito do usuário: "remova a borda arredondada das locomotivas" (revoga o canto
  // arredondado que uma rodada anterior tinha dado só à locomotiva, "dando um formato levemente
  // distinto do vagão padrão"; a identidade "isto é uma locomotiva" continua clara só pela cor —
  // `COR_LOCO` — mesmo padrão de `BlocoSegmentoDestaque`/`Composition.tsx`, que também não
  // diferencia canto por tipo de veículo). ALTURA igual à do vagão (`ALTURA_VEICULO`) — 2026-09-22,
  // pedido explícito do usuário: "deixe a altura dos vagoes e locomotivas iguais aos outros trens
  // J614, R045 etc".
  let cursor = xCauda
  const retangulos = [...pecas].reverse().map((papel, i) => {
    const estilo = estiloDe(papel)
    const largura = estilo.comprimentoM * escala
    const x = cursor
    cursor += largura
    return (
      <rect
        key={i}
        x={x}
        y={y - altura / 2}
        width={largura}
        height={altura}
        fill={estilo.preenchimento}
        stroke={estilo.contorno}
        strokeWidth={0.5}
      />
    )
  })

  // `cauda`: onde este grupo se separou do conjunto que ficou para trás (traseira, à esquerda).
  // `atras-da-cabeca`: logo atrás da locomotiva líder — o corte da própria locomotiva, que fica na
  // ponta direita do desenho. Mesma fórmula que `alvoCameraJ105` usa pra enquadrar a câmera nesse
  // ponto (`calcularXCorte`, extraída pra função própria) — nunca divergem.
  const xCorte = calcularXCorte(grupo, xCabeca, xCauda, escala)

  return (
    <g opacity={grupo.esmaecido ? OPACIDADE_ESMAECIDO : undefined}>
      {retangulos}
      {xCorte != null && <MarcaCorte x={xCorte} y={y} altura={altura} />}
    </g>
  )
}

