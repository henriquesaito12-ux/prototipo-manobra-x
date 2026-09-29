import type { ProjectedScene } from '../project'
import { computeClearGeometry, computeParadaGeometry } from '../etapaParada'
import { DIM_OVERLAY_FILL, DIM_OVERLAY_OPACITY, type EtapaHighlightClear, type EtapaHighlightParada } from './Composition'
import { resolveTrackHeight } from './Line'

// Camada de destaque das etapas PARADA e CLEAR sobre o mapa — desenhada por ÚLTIMO em
// `YardCanvas.tsx` (depois de linhas, marcadores E composições), mesmo lugar de precedência que o
// véu de esmaecimento de Bloco/Grupo já usa dentro de `Composition.tsx` (o véu sempre fica por
// cima do que esmaece, nunca escondido por baixo). Só ativa quando `highlight.etapa` está presente
// — sem isso, nenhuma linha do mapa muda (nível "nenhum", mesma convenção do `nivel` em
// `Composition.tsx`).
//
// Acabamento visual (2026-08-25, feedback): mesma lógica de composição de um traçado de rota do
// Google Maps — origem em anel simples, destino em "pino" (bulbo + ponta), trajeto num traço
// grosso e vivo (não uma faixa translúcida) e a distância num badge flutuante por cima do meio do
// trajeto, com uma "cauda" apontando pra ele — não é pra parecer mapa de ruas real, só reaplicar
// essa MESMA linguagem visual (a mais familiar pra "aqui → ali, tantos metros"). Cor azul
// (`--vli-map-blue-label`, 2026-08-25) — trocada do laranja/warning original a pedido explícito.
//
// Escopo desta camada: PARADA e CLEAR — as duas têm trajeto real (início≠fim), mesmo tratamento
// visual (2026-08-25, pedido explícito: "o marcador de origem pode reaproveitar o estilo já
// usado... e o de destino o mesmo pin usado na Parada"), só a ORIGEM do cálculo difere (Clear não
// parte do zero da linha, ver `computeClearGeometry`/`EtapaHighlightClear`). CORTE tem sua própria
// camada (`EtapaCorteLayer.tsx` — ponto estático, sem trajeto). Retirada/Inclusão/Fechamento ainda
// não têm geometria própria no mapa.
//
// A etiqueta de referência (T1/T2/T3...) fica presa ao ponto FIXO já estabelecido (2026-08-25,
// correção: "a referência precisa estar fixa no mesmo lugar, desde Parada, não pode mudar de
// lugar") — na Parada isso é o próprio pino de chegada; no Clear, a origem (mesmo ponto da
// Parada) é que carrega a etiqueta, porque o pino de chegada do Clear é um destino NOVO, sem
// referência própria (ver `rotuloNaOrigem` em `EtapaParadaLayer`).

interface EtapaParadaLayerProps {
  scene: ProjectedScene
  labelGutterWidth: number
  etapa?: EtapaHighlightParada | EtapaHighlightClear | null
}

// `--vli-primary` (2026-08-25, ajustado do azul vivo do mapa, `--vli-map-blue-label`, pro mesmo
// azul "de botão" já usado no resto do produto, ver `Composition.tsx`).
const ROTA_COR = 'var(--vli-primary)'
const ROTA_HALO_OPACITY = 0.22
const ROTA_ESPESSURA = 3
const ROTA_HALO_ESPESSURA = 7
/** Fundo/texto/borda dos cartões flutuantes (badge de distância, etiqueta de referência) —
 *  MESMOS tokens do resto da interface (2026-08-25, ajuste depois do "está destoando do resto
 *  da interface"): `--vli-surface`/`--vli-text-hi`/`--vli-border`, mesma razão/mesmos tokens de
 *  `Composition.tsx` (`CARTAO_BG`/`CARTAO_TEXTO_PRIMARIO`/`CARTAO_BORDA`) — duplicado aqui de
 *  propósito, mesma regra de independência entre as duas camadas de destaque. Um cartão só (sem
 *  distinção primário/secundário — cada um mostra um único valor curto). */
const CARTAO_BG = 'var(--vli-surface)'
const CARTAO_BORDA = 'var(--vli-border)'
const CARTAO_TEXTO = 'var(--vli-text-hi)'

/** Comprimento do braço da seta de sentido — pequena o bastante pra não competir com o pino nem
 *  com o badge de distância, que agora dividem o trajeto com ela. */
const SETA_TAMANHO = 7

/**
 * Marcador de PARTIDA — anel vazado + ponto central, deliberadamente "menor e mais neutro" que o
 * pino de chegada (`PinoReferencia`): mesma distinção origem/destino de um app de rotas (círculo
 * simples on origem, pino saliente no destino), não os dois tratamentos iguais.
 */
function MarcadorOrigem({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={5.5} fill="var(--vli-map-canvas-bg)" stroke={ROTA_COR} strokeWidth={2.5} />
      <circle cx={x} cy={y} r={2} fill={ROTA_COR} />
    </g>
  )
}

/** Etiqueta de referência (T1/T2/T3...) — desenhada separada do glyph do marcador embaixo dela
 *  (2026-08-25: precisa poder flutuar tanto sobre o anel de origem quanto sobre o pino de chegada,
 *  dependendo de QUAL dos dois está na posição fixa da referência — ver `EtapaParadaLayer`). `y` é
 *  a base onde a etiqueta encosta (mesmo ponto em que ela "aponta" pra baixo). */
function RotuloReferencia({ x, y, texto }: { x: number; y: number; texto: string }) {
  return (
    <g transform={`translate(${x}, ${y - 13})`}>
      <rect x={-11} y={-6.5} width={22} height={13} rx={3} fill={CARTAO_BG} stroke={CARTAO_BORDA} strokeWidth={1} />
      <text
        x={0}
        y={0.5}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={7.5}
        fontWeight={700}
        fill={CARTAO_TEXTO}
        fontFamily="Manrope, sans-serif"
      >
        {texto}
      </text>
    </g>
  )
}

/** Path de um pino de mapa (bulbo + ponta) em coordenadas 24×24 — mesma proporção do glyph
 *  "place"/"map-pin" já usado em várias bibliotecas de ícone (inclusive `lucide-react`, já
 *  dependência deste projeto), reimplementado aqui à mão pra poder colorir bulbo e "furo" (o
 *  círculo interno) de forma independente, coisa que o componente pronto não permite. A ponta do
 *  pino cai em (12, 21.8) neste espaço de 24×24 — é o ponto que `PinoReferencia` ancora
 *  exatamente em cima da posição calculada (ver `escala`/`translate` abaixo). */
const PINO_PATH_D = 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0'
const PINO_PONTA_X = 12
const PINO_PONTA_Y = 21.8

/** Y do topo do bulbo do pino — onde a etiqueta de referência encosta quando é ELE que carrega o
 *  rótulo (ver `topoBulboY`/`RotuloReferencia`). */
function topoBulboY(y: number, tamanho: number): number {
  return y - tamanho * ((PINO_PONTA_Y - 2) / 24)
}

/**
 * Marcador de CHEGADA — pino saliente (bulbo + ponta), sólido na cor do trajeto, com o "furo"
 * central clássico (círculo vazado na cor do fundo do canvas) e um contorno fino, também na cor
 * do fundo, ao redor do pino inteiro — sem esse contorno a ponta do pino se misturava com o
 * traço grosso do trajeto bem embaixo dela, mesma cor dos dois (bug visual reportado 2026-08-25:
 * "difícil perceber que é um elemento separado"). Só o glyph — sem rótulo embutido (2026-08-25:
 * a etiqueta de referência agora é desenhada separada, `RotuloReferencia`, porque no Clear ela
 * precisa flutuar sobre a ORIGEM, não sobre este pino — ver `EtapaParadaLayer`).
 */
function PinoReferencia({ x, y, tamanho }: { x: number; y: number; tamanho: number }) {
  const escala = tamanho / 24
  return (
    <g transform={`translate(${x - PINO_PONTA_X * escala}, ${y - PINO_PONTA_Y * escala}) scale(${escala})`}>
      <path d={PINO_PATH_D} fill={ROTA_COR} stroke="var(--vli-map-canvas-bg)" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={12} cy={10} r={3} fill="var(--vli-map-canvas-bg)" />
    </g>
  )
}

/**
 * Path de "balão de fala" — retângulo (aqui, em pílula) + a pontinha triangular como UM SÓ
 * contorno contínuo, não duas formas separadas (retângulo com stroke + triângulo sem stroke, que
 * deixava a pontinha "flutuando" sem contorno próprio — bug visual reportado 2026-08-25). Mesmo
 * helper de `Composition.tsx` (`pathBalao`), duplicado aqui de propósito.
 */
/** Meia-largura da cauda/rabicho do balão — fina o bastante pra não competir com o pino/marcador,
 *  mesma constante de `Composition.tsx` (`CAUDA_MEIA_LARGURA`), duplicada aqui de propósito. */
const CAUDA_MEIA_LARGURA = 3

function pathBalao(centroX: number, topoY: number, largura: number, altura: number, raio: number, pontaY: number): string {
  const x0 = centroX - largura / 2
  const x1 = centroX + largura / 2
  const baseY = topoY + altura
  const r = raio
  const cauda = CAUDA_MEIA_LARGURA
  return [
    `M ${x0 + r} ${topoY}`,
    `L ${x1 - r} ${topoY}`,
    `A ${r} ${r} 0 0 1 ${x1} ${topoY + r}`,
    `L ${x1} ${baseY - r}`,
    `A ${r} ${r} 0 0 1 ${x1 - r} ${baseY}`,
    `L ${centroX + cauda} ${baseY}`,
    `L ${centroX} ${pontaY}`,
    `L ${centroX - cauda} ${baseY}`,
    `L ${x0 + r} ${baseY}`,
    `A ${r} ${r} 0 0 1 ${x0} ${baseY - r}`,
    `L ${x0} ${topoY + r}`,
    `A ${r} ${r} 0 0 1 ${x0 + r} ${topoY}`,
    'Z',
  ].join(' ')
}

/**
 * Badge flutuante de distância — balão arredondado com "cauda" apontando pro trajeto, no meio do
 * trecho (padrão "4,6 km"/"13 min" de app de rotas: a métrica principal flutua SOBRE o trajeto,
 * não como texto solto do lado). Largura estimada pelo tamanho do texto (curto o bastante — "NNNNm"
 * — pra não precisar medir de verdade via DOM).
 */
function BadgeDistancia({ x, y, texto }: { x: number; y: number; texto: string }) {
  const altura = 14
  const largura = Math.max(26, texto.length * 5.2 + 12)
  // Gap um pouco maior que o do trajeto puro (2026-08-25 — mesmo pedido de separação do pino/
  // marcador aplicado aqui: "hoje estão grudados").
  const baseY = y - 18
  const topoY = baseY - altura
  return (
    <g>
      <path d={pathBalao(x, topoY, largura, altura, altura / 2, baseY + 5)} fill={CARTAO_BG} stroke={CARTAO_BORDA} strokeWidth={1} />
      <text
        x={x}
        y={topoY + altura / 2 + 0.5}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={7.5}
        fontWeight={700}
        fill={CARTAO_TEXTO}
        fontFamily="Manrope, sans-serif"
      >
        {texto}
      </text>
    </g>
  )
}

export function EtapaParadaLayer({ scene, labelGutterWidth, etapa }: EtapaParadaLayerProps) {
  if (!etapa) return null

  const geometria = etapa.tipo === 'CLEAR' ? computeClearGeometry(scene, etapa) : computeParadaGeometry(scene, etapa)
  if (!geometria) return null

  const { lineId, y, xStart, xEnd, crescente } = geometria
  const linhaAlvo = scene.lines.find((l) => l.id === lineId)
  if (!linhaAlvo) return null

  const segX0 = labelGutterWidth + Math.min(xStart, xEnd)
  const segX1 = labelGutterWidth + Math.max(xStart, xEnd)
  const segWidth = Math.max(segX1 - segX0, 0)
  const origemX = labelGutterWidth + xStart
  const destinoX = labelGutterWidth + xEnd
  const meioX = (segX0 + segX1) / 2

  // Seta a meio caminho do trajeto, apontando no sentido de percurso (`crescente`) — na MESMA
  // altura da linha (o badge de distância flutua ACIMA, nunca colidem).
  const pontaX = crescente ? meioX + SETA_TAMANHO : meioX - SETA_TAMANHO
  const setaPontos = `${meioX},${y - SETA_TAMANHO * 0.7} ${meioX},${y + SETA_TAMANHO * 0.7} ${pontaX},${y}`

  // No Clear, a origem é o MESMO ponto fixo (referência T1/T2/T3...) que a Parada já estabeleceu
  // — a etiqueta precisa continuar ali, não seguir o pino de chegada (que agora é um NOVO ponto,
  // resultado do deslocamento, sem referência própria). Na Parada, a etiqueta continua no pino de
  // chegada, como sempre foi (2026-08-25, "a referência T3 precisa estar fixa no mesmo lugar,
  // desde Parada, não pode mudar de lugar"). Mesma altura flutuante nos dois casos
  // (`topoBulboY(y, 22)`) pra não pular de posição vertical trocando de marcador.
  const rotuloNaOrigem = etapa.tipo === 'CLEAR'
  const rotuloBaseY = topoBulboY(y, 22)

  return (
    <g style={{ pointerEvents: 'none' }} data-etapa-highlight={etapa.tipo}>
      {/* Esmaece toda linha que não é a da etapa — mesma técnica (véu na cor do fundo do canvas)
         já usada em `Composition.tsx` pro destaque de Bloco/Grupo, agora na faixa da linha
         inteira em vez de só nos segmentos do trem. */}
      {scene.lines
        .filter((line) => line.id !== lineId && line.type !== 'cco')
        .map((line) => {
          const trackHeight = resolveTrackHeight(line.type)
          return (
            <rect
              key={`dim-linha-${line.id}`}
              x={labelGutterWidth + line.x}
              y={line.y - trackHeight / 2}
              width={line.width}
              height={trackHeight}
              fill={DIM_OVERLAY_FILL}
              fillOpacity={DIM_OVERLAY_OPACITY}
            />
          )
        })}

      {/* Trajeto — traço grosso e vivo (não mais uma faixa translúcida): halo suave por baixo +
         núcleo sólido por cima, mesmo efeito de "rota selecionada" de um app de mapas, pra saltar
         aos olhos contra o resto do pátio esmaecido. */}
      {segWidth > 0 && (
        <>
          <line x1={segX0} y1={y} x2={segX1} y2={y} stroke={ROTA_COR} strokeOpacity={ROTA_HALO_OPACITY} strokeWidth={ROTA_HALO_ESPESSURA} strokeLinecap="round" />
          <line x1={segX0} y1={y} x2={segX1} y2={y} stroke={ROTA_COR} strokeWidth={ROTA_ESPESSURA} strokeLinecap="round" />
        </>
      )}

      {/* Sentido do movimento (direção EDV/ECJ da etapa). Só desenha se o trecho tiver espaço de
         sobra pra seta não ficar espremida contra as bordas. */}
      {segWidth > SETA_TAMANHO * 4 && <polygon points={setaPontos} fill="var(--vli-map-canvas-bg)" />}

      {/* Ponto de partida — início físico da linha na Parada; no Clear, a posição onde a
         composição já estava ao final da Parada/Corte do Grupo (`etapa.origemM`, ver
         `etapaParada.ts`/`computeClearGeometry`), nunca a posição "atual" recalculada do zero. */}
      <MarcadorOrigem x={origemX} y={y} />
      {rotuloNaOrigem && etapa.referencia && <RotuloReferencia x={origemX} y={rotuloBaseY} texto={etapa.referencia} />}

      {/* Distância percorrida, flutuando sobre o meio do trajeto. */}
      <BadgeDistancia x={meioX} y={y} texto={`${etapa.distanciaM}m`} />

      {/* Ponto final — no Clear, um destino NOVO (resultado do deslocamento), sem etiqueta
         própria; a referência já está marcada na origem. Na Parada, é o próprio ponto da
         referência (ver `etapaParada.ts`). */}
      <PinoReferencia x={destinoX} y={y} tamanho={22} />
      {!rotuloNaOrigem && etapa.referencia && <RotuloReferencia x={destinoX} y={rotuloBaseY} texto={etapa.referencia} />}
    </g>
  )
}
