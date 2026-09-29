import { RotateCcw } from 'lucide-react'
import type { ProjectedScene } from '../project'
import { computeRetiradaRota1Geometry } from '../etapaParada'
import { DIM_OVERLAY_FILL, DIM_OVERLAY_OPACITY, type EtapaHighlightRetirada } from './Composition'
import { resolveTrackHeight } from './Line'

// Camada de destaque da Rota 1 de RETIRADA (deslocamento inicial da locomotiva de manobra) —
// bem diferente de Parada/Corte/Clear: aquelas representam a COMPOSIÇÃO PRINCIPAL (já parada
// desde a Parada), esta representa uma LOCOMOTIVA DE MANOBRA SEPARADA vindo buscá-la, numa linha
// diferente (`linhaOrigem`, ex. "Linha 3"). MESMO azul "de botão" das outras rotas/camadas
// (`--vli-primary` — 2026-08-25, "o azul precisa ser o mesmo utilizado nas outras rotas.. o mesmo
// do botão"; revoga uma cor distinta usada antes, `--vli-map-blue-label`).
//
// ESCOPO (2026-08-25, "vamos simplificar... quero fazer só UMA coisa agora", depois estendido pra
// incluir T3 e o trecho final): Trecho 1 — traço destacado em Linha 3 (direita pra esquerda),
// terminando na junção real com T3 — seguido da travessia T3, desenhada exatamente sobre a
// conexão real do mapa base entre Linha 3 e Linha Desvio (`geometria.conexao`, sem recalcular por
// `distanciaDestinoM` — ver `etapaParada.ts`) — seguido do trecho final em Linha Desvio, que parte
// da PRÓPRIA ponta da T3 (`conexaoDestinoX`) e anda `distanciaDestinoM` na direção
// `direcaoDestino` ("+25m pra direita"), terminando no pino de chegada (`PinoChegada`, mesmo glyph
// de `PinoReferencia`). MESMA espessura/estilo já usado no trajeto de Parada/Clear
// (`EtapaParadaLayer.tsx`, `ROTA_ESPESSURA`/`ROTA_HALO_ESPESSURA`). Tag de reversão (mesmo padrão
// do badge de distância "1200m"/"71m", sem a cauda) marca onde a reversão acontece — deslocada
// pra ESQUERDA da junção, com um vão até a linha, de propósito (não sobre ela — ver
// `REVERSAO_OFFSET_X`). `juncaoDestinoX`/`destinoX` (o destino FIXO reaproveitado do Clear, pelo
// qual `finalX` NÃO passa mais — ver `etapaParada.ts`) ficam sem uso aqui.

interface EtapaRetiradaLayerProps {
  scene: ProjectedScene
  labelGutterWidth: number
  etapa?: EtapaHighlightRetirada | null
}

// MESMO azul "de botão" usado nas outras rotas/camadas de destaque (`--vli-primary`, ver
// `EtapaParadaLayer.tsx`) — pedido explícito (2026-08-25): "o azul precisa ser o mesmo utilizado
// nas outras rotas.. o mesmo do botão" (revoga a cor distinta usada antes, `--vli-map-blue-label`).
const ROTA_COR = 'var(--vli-primary)'
const ROTA_HALO_OPACITY = 0.22
// MESMA espessura do trajeto de Parada/Clear (`EtapaParadaLayer.tsx`) — pedido explícito
// (2026-08-25): "quero EXATAMENTE o mesmo padrão visual... não precisa ser mais grossa".
const ROTA_ESPESSURA = 3
const ROTA_HALO_ESPESSURA = 7
/** Fundo/texto/borda da tag de reversão — MESMOS tokens do badge flutuante de distância
 *  ("1200m"/"71m", `EtapaParadaLayer.tsx`/`EtapaCorteLayer.tsx`, `CARTAO_BG`/`CARTAO_BORDA`/
 *  `CARTAO_TEXTO`), duplicados aqui de propósito — pedido explícito (2026-08-25): "deixe o
 *  reversão no mesmo padrão desse componente" (revoga a cor de aviso usada antes,
 *  `--vli-warning-text`/`--vli-warning-bg`, que vinha do chip "⟲ Reversão" do cartão de texto). */
const CARTAO_BG = 'var(--vli-surface)'
const CARTAO_BORDA = 'var(--vli-border)'
const CARTAO_TEXTO = 'var(--vli-text-hi)'

/** Trecho de trajeto (reto ou diagonal) — halo suave + núcleo sólido, mesmo efeito de "rota
 *  selecionada" das outras camadas (`EtapaParadaLayer.tsx`). Serve tanto pro Trecho 1 (reto, em
 *  Linha 3) quanto pra T3 (diagonal, sobre a conexão real entre Linha 3 e Linha Desvio —
 *  2026-08-25: "faça uma linha passando exatamente em cima da T3"). */
function TrechoLinha({ x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number }) {
  if (Math.abs(x1 - x0) <= 0 && Math.abs(y1 - y0) <= 0) return null
  return (
    <>
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={ROTA_COR} strokeOpacity={ROTA_HALO_OPACITY} strokeWidth={ROTA_HALO_ESPESSURA} strokeLinecap="round" />
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={ROTA_COR} strokeWidth={ROTA_ESPESSURA} strokeLinecap="round" />
    </>
  )
}

/** Marcador de INÍCIO — MESMO glyph de `EtapaParadaLayer.tsx` (`MarcadorOrigem`): anel vazado +
 *  ponto central, duplicado aqui de propósito. Só marca a ponta direita do Trecho 1, "pra
 *  representar que é o início" (2026-08-25) — não tem rótulo próprio, o traço já é auto-
 *  explicativo daqui em diante. */
function MarcadorInicio({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={5.5} fill="var(--vli-map-canvas-bg)" stroke={ROTA_COR} strokeWidth={2.5} />
      <circle cx={x} cy={y} r={2} fill={ROTA_COR} />
    </g>
  )
}

/** Comprimento do braço da seta de sentido — mesma proporção de `EtapaParadaLayer.tsx`
 *  (`SETA_TAMANHO`), duplicada aqui de propósito. */
const SETA_TAMANHO = 7

/** Quanto a ponta inicial (direita) do Trecho 1 estica além do ponto real — cosmético, mesmo
 *  espírito do Trecho 1 esticar além da junção real do lado esquerdo (2026-08-25: "aumente o
 *  comprimento da linha um pouco pra direita também"). */
const INICIO_EXTENSAO_X = 20

/** Seta de sentido — MESMO "recorte" (triângulo na cor do fundo do canvas, por cima do traço
 *  sólido) usado no trajeto de Parada/Clear, só que com ângulo livre em vez de só
 *  esquerda/direita — precisa apontar na diagonal também (T3), não só reto (Trecho 1)
 *  (2026-08-25: "coloque a setinha pra esquerda... na linha azul que está na diagonal (T3), deixe
 *  a setinha pra diagonal pra baixo"). `anguloGraus` seguindo a convenção de `rotate()` do SVG (0°
 *  = apontando pra direita, 90° = pra baixo, 180° = pra esquerda). */
function Seta({ x, y, anguloGraus }: { x: number; y: number; anguloGraus: number }) {
  const pontos = `0,${-SETA_TAMANHO * 0.7} 0,${SETA_TAMANHO * 0.7} ${SETA_TAMANHO},0`
  return (
    <g transform={`translate(${x}, ${y}) rotate(${anguloGraus})`}>
      <polygon points={pontos} fill="var(--vli-map-canvas-bg)" />
    </g>
  )
}

/** Deslocamento da tag de reversão em relação à junção real — só em X, continuando na mesma
 *  direção do trecho ("mais pra esquerda"), mesmo eixo Y da linha (2026-08-25: "não é pra subir,
 *  apenas ir pra esquerda"). Trecho 1 termina na junção real (`juncaoOrigemX`), NÃO aqui — de
 *  propósito: a tag fica à esquerda do fim da linha, com um vão entre os dois, pra não ficar em
 *  cima dela (2026-08-25: "ele precisa ficar mais pra esquerda, pra não ficar em cima da linha"). */
const REVERSAO_OFFSET_X = 72
/** Respiro entre a ponta do Trecho 1 (esticado além da junção real) e a borda da tag de reversão
 *  — pequeno de propósito, só pra deixar claro que os dois são elementos separados sem criar um
 *  vão grande (2026-08-25: "aumente pouca coisa... mas sem encostar"). */
const GAP_LINHA_TAG = 8

const REVERSAO_TAG_ALTURA = 20
const REVERSAO_TAG_ICONE = 12
const REVERSAO_TAG_PADDING_X = 9
const REVERSAO_TAG_GAP = 4

/** Largura estimada de um texto — mesma régua de `medirLarguraChip` (`EtapaCorteLayer.tsx`,
 *  duplicada aqui por convenção: cada camada de destaque mantém suas próprias constantes). */
function medirLarguraTexto(texto: string): number {
  return texto.length * 5.4
}

/** Largura total da tag de reversão ("Reversão", texto fixo) — usada tanto por `TagReversao`
 *  quanto pelo cálculo de até onde o Trecho 1 pode esticar sem encostar nela (ver
 *  `EtapaRetiradaLayer`, "aumente pouca coisa o comprimento da linha da L3... mas sem encostar"). */
function larguraTagReversao(): number {
  return REVERSAO_TAG_ICONE + REVERSAO_TAG_GAP + medirLarguraTexto('Reversão') + REVERSAO_TAG_PADDING_X * 2
}

/** Tag de reversão — MESMO padrão do badge flutuante de distância ("1200m"/"71m",
 *  `EtapaParadaLayer.tsx`/`EtapaCorteLayer.tsx`): cartão sólido, SEM a cauda/rabicho triangular
 *  que aquele badge tem (2026-08-25: "no mesmo padrão desse componente... sem a setinha pra
 *  baixo") — aqui é só a pílula. Substitui o ícone isolado de antes por uma tag com texto
 *  (2026-08-25: "ao invés de um ícone isolado, deixe a tag com o texto 'Reversão' também"),
 *  marcando onde o Trecho 1 termina. */
function TagReversao({ x, y }: { x: number; y: number }) {
  const texto = 'Reversão'
  const largura = larguraTagReversao()
  const left = x - largura / 2
  const top = y - REVERSAO_TAG_ALTURA / 2
  const iconeX = left + REVERSAO_TAG_PADDING_X
  const textoX = iconeX + REVERSAO_TAG_ICONE + REVERSAO_TAG_GAP
  return (
    <g>
      <rect x={left} y={top} width={largura} height={REVERSAO_TAG_ALTURA} rx={REVERSAO_TAG_ALTURA / 2} fill={CARTAO_BG} stroke={CARTAO_BORDA} strokeWidth={1} />
      <g transform={`translate(${iconeX}, ${y - REVERSAO_TAG_ICONE / 2})`}>
        <RotateCcw size={REVERSAO_TAG_ICONE} color={CARTAO_TEXTO} strokeWidth={2.5} />
      </g>
      <text x={textoX} y={y + 0.5} dominantBaseline="middle" fontSize={9.5} fontWeight={700} fill={CARTAO_TEXTO} fontFamily="Manrope, sans-serif">
        {texto}
      </text>
    </g>
  )
}

/** Path de um pino de mapa (bulbo + ponta) em coordenadas 24×24 — MESMO glyph de
 *  `EtapaParadaLayer.tsx` (`PinoReferencia`)/`Composition.tsx` (`PinoComposicao`), duplicado aqui
 *  de propósito (motor de mapa mantém cada camada de destaque independente). A ponta cai em
 *  (12, 21.8) — mesma proporção do glyph "place"/"map-pin". */
const PINO_PATH_D = 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0'
const PINO_PONTA_X = 12
const PINO_PONTA_Y = 21.8
const PINO_TAMANHO = 22

/** Pino de chegada — MESMO tratamento de `PinoReferencia` (`EtapaParadaLayer.tsx`): sólido na cor
 *  do trajeto, "furo" central e contorno na cor do fundo do canvas (pra não se misturar com o
 *  traço grosso do trajeto bem embaixo dele). Marca o ponto final da Rota 1 (2026-08-25: "ao
 *  chegar no final, coloque o pin utilizado nas outras etapas"). */
function PinoChegada({ x, y }: { x: number; y: number }) {
  const escala = PINO_TAMANHO / 24
  return (
    <g transform={`translate(${x - PINO_PONTA_X * escala}, ${y - PINO_PONTA_Y * escala}) scale(${escala})`}>
      <path d={PINO_PATH_D} fill={ROTA_COR} stroke="var(--vli-map-canvas-bg)" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={12} cy={10} r={3} fill="var(--vli-map-canvas-bg)" />
    </g>
  )
}

export function EtapaRetiradaLayer({ scene, labelGutterWidth, etapa }: EtapaRetiradaLayerProps) {
  if (!etapa) return null

  const geometria = computeRetiradaRota1Geometry(scene, etapa)
  if (!geometria) return null

  const {
    lineIdOrigem,
    yOrigem,
    yDestino,
    origemX: origemXLocal,
    juncaoOrigemX: juncaoOrigemXLocal,
    conexaoDestinoX: conexaoDestinoXLocal,
    finalX: finalXLocal,
    conexao,
  } = geometria

  const origemX = labelGutterWidth + origemXLocal
  const juncaoOrigemX = labelGutterWidth + juncaoOrigemXLocal
  const conexaoDestinoX = labelGutterWidth + conexaoDestinoXLocal
  const finalX = labelGutterWidth + finalXLocal

  // Ícone de reversão deslocado só em X — mais pra fora, continuando na mesma direção do trecho
  // ("mais pra esquerda"), mesmo eixo Y da linha (2026-08-25).
  const sentido = origemX >= juncaoOrigemX ? -1 : 1
  const reversaoX = juncaoOrigemX + sentido * REVERSAO_OFFSET_X

  // Ponta inicial (direita) esticada um pouco além do ponto real (`origemX`, 25m da junção) —
  // cosmético, igual ao Trecho 1 esticar além da junção do outro lado (2026-08-25: "aumente o
  // comprimento da linha um pouco pra direita também, consequentemente empurrando o ponto inicial
  // pra direita também"). "Pra direita" aqui é sempre o OPOSTO do sentido do percurso (o trecho
  // sempre estica pras PONTAS, nunca no sentido do movimento).
  const origemXVisual = origemX - sentido * INICIO_EXTENSAO_X

  // Trecho 1 estica um pouco além da junção real com T3, chegando perto da tag SEM encostar
  // (2026-08-25: "aumente pouca coisa o comprimento da linha da L3... até chegar na tag de
  // reversão. mas sem encostar") — pára `GAP_LINHA_TAG` antes da borda da tag mais próxima da
  // linha, descontando também o raio da ponta arredondada do próprio traço (`ROTA_HALO_ESPESSURA
  // / 2`), senão a ponta arredondada encostaria antes do cálculo prever.
  const bordaTagLadoLinha = reversaoX - sentido * (larguraTagReversao() / 2)
  const trecho1FimX = bordaTagLadoLinha - sentido * (GAP_LINHA_TAG + ROTA_HALO_ESPESSURA / 2)

  // Seta do Trecho 1 — sempre horizontal, no sentido do percurso (ECJ = pra esquerda), a meio
  // caminho do trecho desenhado (2026-08-25: "coloque a setinha pra esquerda").
  const meioTrecho1X = (origemXVisual + trecho1FimX) / 2
  const anguloTrecho1 = sentido === -1 ? 180 : 0

  // Seta da T3 — segue o ÂNGULO REAL da diagonal (não só esquerda/direita), a meio caminho dela
  // (2026-08-25: "na linha azul que está na diagonal (T3), deixe a setinha pra diagonal pra
  // baixo").
  const meioT3X = (juncaoOrigemX + conexaoDestinoX) / 2
  const meioT3Y = (yOrigem + yDestino) / 2
  const anguloT3 = (Math.atan2(yDestino - yOrigem, conexaoDestinoX - juncaoOrigemX) * 180) / Math.PI

  return (
    <g style={{ pointerEvents: 'none' }} data-etapa-highlight={etapa.tipo}>
      {/* Esmaece toda linha que não é a Linha 3 — só ela está em destaque nesta etapa por
         enquanto. */}
      {scene.lines
        .filter((line) => line.id !== lineIdOrigem && line.type !== 'cco')
        .map((line) => {
          const trackHeight = resolveTrackHeight(line.type)
          return (
            <rect
              key={`dim-linha-retirada-${line.id}`}
              x={labelGutterWidth + line.x}
              y={line.y - trackHeight / 2}
              width={line.width}
              height={trackHeight}
              fill={DIM_OVERLAY_FILL}
              fillOpacity={DIM_OVERLAY_OPACITY}
            />
          )
        })}

      {/* Esmaece também as conexões/travessões do mapa base, EXCETO a T3 — ela agora faz parte
         do trecho em destaque, desenhada por cima logo abaixo (2026-08-25, "remova... a linha
         diagonal cinza" / depois "faça uma linha passando exatamente em cima da T3"). */}
      {scene.connections
        .filter((conn) => conn !== conexao)
        .map((conn, i) => (
          <line
            key={`dim-conexao-retirada-${conn.id ?? i}`}
            x1={labelGutterWidth + conn.from.x}
            y1={conn.from.y}
            x2={labelGutterWidth + conn.to.x}
            y2={conn.to.y}
            stroke={DIM_OVERLAY_FILL}
            strokeOpacity={DIM_OVERLAY_OPACITY}
            strokeWidth={4}
          />
        ))}

      {/* Trecho 1 — Linha 3, esticado um pouco além do ponto real em AMBAS as pontas: a direita
         (partida, `origemXVisual`) e a esquerda (junção com T3, `trecho1FimX`) — cosmético dos
         dois lados, mesmo espírito (2026-08-25: "aumente o comprimento da linha um pouco pra
         direita também" / "...até chegar na tag de reversão. mas sem encostar"). */}
      <TrechoLinha x0={origemXVisual} y0={yOrigem} x1={trecho1FimX} y1={yOrigem} />
      {Math.abs(trecho1FimX - origemXVisual) > SETA_TAMANHO * 4 && <Seta x={meioTrecho1X} y={yOrigem} anguloGraus={anguloTrecho1} />}

      {/* Início do Trecho 1 — só pra representar que é o início (2026-08-25: "inclua o ícone de
         início na ponta direita da linha da L3"), empurrado junto com a ponta esticada. */}
      <MarcadorInicio x={origemXVisual} y={yOrigem} />

      {/* T3 — a travessia real até Linha Desvio, exatamente sobre a conexão do mapa base. */}
      <TrechoLinha x0={juncaoOrigemX} y0={yOrigem} x1={conexaoDestinoX} y1={yDestino} />
      {Math.hypot(conexaoDestinoX - juncaoOrigemX, yDestino - yOrigem) > SETA_TAMANHO * 4 && (
        <Seta x={meioT3X} y={meioT3Y} anguloGraus={anguloT3} />
      )}

      {/* Trecho final — Linha Desvio, a partir da própria ponta da T3, andando `distanciaDestinoM`
         na direção `direcaoDestino` (2026-08-25: "da ponta final do T3, +25m pra direita"). */}
      <TrechoLinha x0={conexaoDestinoX} y0={yDestino} x1={finalX} y1={yDestino} />

      {/* Ponto final do Trecho 1 — a tag de reversão marca onde ele termina. */}
      <TagReversao x={reversaoX} y={yOrigem} />

      {/* Ponto final da Rota 1 — mesmo pino de chegada usado nas outras etapas. */}
      <PinoChegada x={finalX} y={yDestino} />
    </g>
  )
}
