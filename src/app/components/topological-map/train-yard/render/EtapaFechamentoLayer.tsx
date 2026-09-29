import { CheckCircle2, Undo2 } from 'lucide-react'
import type { ProjectedScene } from '../project'
import { computeFechamentoGeometry } from '../etapaParada'
import { DIM_OVERLAY_FILL, DIM_OVERLAY_OPACITY, type EtapaHighlightFechamento } from './Composition'
import { resolveTrackHeight } from './Line'

// Camada de destaque do FECHAMENTO (recuo final da composição) — última etapa do ciclo do Grupo.
// Parte do MESMO ponto onde a Rota 2 de Inclusão termina (`geometria.origemX`, reaproveitado via
// `computeFechamentoGeometry`, nunca recalculado do zero) e RECUA `etapa.distanciaM` na Linha
// Desvio, sentido OPOSTO ao de chegada da última rota — pedido explícito do usuário, 2026-08-26:
// "isso é um RECUO... use algum indicador visual que deixe claro que é um movimento de ré/recuo...
// não só mais um trecho igual aos de ida". Sem travessão, sem reversão — só um trecho reto, com
// tratamento visual distinto (tracejado, em vez do traço sólido das outras camadas) + a seta
// apontando no sentido real do recuo + uma tag "Recuo" com ícone de ré (`Undo2`, mesma família do
// `RotateCcw` da tag de reversão, mas semântica diferente: aqui não há troca de ponta do motor, só
// deslocamento pra trás). Termina no MESMO pino padronizado das outras rotas (pedido explícito:
// "pode usar o mesmo pin já padronizado") + um selo de conclusão (`CheckCircle2`, verde) — sinaliza
// visualmente que o ciclo de manobra deste Grupo terminou (pedido explícito do usuário: "o
// resultado final deve deixar claro visualmente que o ciclo de manobra desse grupo terminou").
//
// O campo "Clear até travessão" do card (informativo, ecoa a distância que o CLEAR já percorreu lá
// na etapa 3 do mesmo Grupo) NÃO vira elemento visual aqui — só texto de apoio no card
// (`ApoioTagsEtapa`, `PlanManobraX.tsx`), conforme pedido explícito do usuário: "não tente
// representar visualmente os 71m como um segmento separado".

interface EtapaFechamentoLayerProps {
  scene: ProjectedScene
  labelGutterWidth: number
  etapa?: EtapaHighlightFechamento | null
}

// MESMO azul "de botão" das outras camadas de destaque (`--vli-primary`).
const ROTA_COR = 'var(--vli-primary)'
const ROTA_HALO_OPACITY = 0.22
// MESMA espessura do trajeto das outras rotas.
const ROTA_ESPESSURA = 3
const ROTA_HALO_ESPESSURA = 7
/** Padrão tracejado do trecho de recuo — só o núcleo sólido (o halo continua contínuo, mais sutil
 *  por trás, só pra dar profundidade), pra diferenciar visualmente de um trecho de ida sem deixar
 *  de comunicar "mesma espessura/mesma rota" (2026-08-26, pedido explícito do usuário: "um estilo
 *  de trajeto levemente diferente"). */
const RECUO_TRACEJADO = '14 8'

/** Fundo/texto/borda da tag de recuo — MESMOS tokens neutros do badge de reversão das outras
 *  camadas. */
const CARTAO_BG = 'var(--vli-surface)'
const CARTAO_BORDA = 'var(--vli-border)'
const CARTAO_TEXTO = 'var(--vli-text-hi)'
/** Selo de conclusão — cor de sucesso, MESMO token já usado pelos chips de vagão incluído
 *  (`EtapaInclusaoRota1Layer.tsx`). */
const SELO_BORDA = 'var(--vli-success-text)'
const SELO_TEXTO = 'var(--vli-success-text)'

/** Trecho de recuo — halo suave contínuo + núcleo tracejado, MESMA espessura do `TrechoLinha` das
 *  outras camadas (duplicado aqui), só com o núcleo tracejado pra sinalizar "recuo". */
function TrechoRecuo({ x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number }) {
  if (Math.abs(x1 - x0) <= 0 && Math.abs(y1 - y0) <= 0) return null
  return (
    <>
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={ROTA_COR} strokeOpacity={ROTA_HALO_OPACITY} strokeWidth={ROTA_HALO_ESPESSURA} strokeLinecap="round" />
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={ROTA_COR} strokeWidth={ROTA_ESPESSURA} strokeLinecap="round" strokeDasharray={RECUO_TRACEJADO} />
    </>
  )
}

/** Comprimento do braço da seta de sentido — mesma proporção das outras camadas. */
const SETA_TAMANHO = 7

/** Seta de sentido — MESMO "recorte" das outras camadas, apontando no sentido REAL do recuo
 *  (nunca fixo — segue `etapa.direcao`, o oposto do sentido de chegada da última rota). */
function Seta({ x, y, anguloGraus }: { x: number; y: number; anguloGraus: number }) {
  const pontos = `0,${-SETA_TAMANHO * 0.7} 0,${SETA_TAMANHO * 0.7} ${SETA_TAMANHO},0`
  return (
    <g transform={`translate(${x}, ${y}) rotate(${anguloGraus})`}>
      <polygon points={pontos} fill="var(--vli-map-canvas-bg)" />
    </g>
  )
}

const TAG_ALTURA = 20
const TAG_ICONE = 12
const TAG_PADDING_X = 9
const TAG_GAP = 4

/** Largura estimada de um texto — mesma régua das outras camadas, duplicada aqui por convenção. */
function medirLarguraTexto(texto: string): number {
  return texto.length * 5.4
}

/** Tag de recuo — MESMO padrão de cartão sólido sem cauda das outras tags, ícone `Undo2` (seta de
 *  "voltar", não `RotateCcw` — aqui não há troca de ponta do motor, só deslocamento pra trás) +
 *  texto com a distância, já que não há nenhum outro rótulo de distância nesta camada (rota de um
 *  trecho só). Fica acima da linha (não em cima do traço tracejado) — posição de MEIO de trecho,
 *  diferente das tags de reversão (que marcam uma PONTA de trecho). */
function TagRecuo({ x, y, distanciaM }: { x: number; y: number; distanciaM: number }) {
  const texto = `Recuo · ${distanciaM}m`
  const largura = TAG_ICONE + TAG_GAP + medirLarguraTexto(texto) + TAG_PADDING_X * 2
  const left = x - largura / 2
  const top = y - TAG_ALTURA / 2
  const iconeX = left + TAG_PADDING_X
  const textoX = iconeX + TAG_ICONE + TAG_GAP
  return (
    <g>
      <rect x={left} y={top} width={largura} height={TAG_ALTURA} rx={TAG_ALTURA / 2} fill={CARTAO_BG} stroke={CARTAO_BORDA} strokeWidth={1} />
      <g transform={`translate(${iconeX}, ${y - TAG_ICONE / 2})`}>
        <Undo2 size={TAG_ICONE} color={CARTAO_TEXTO} strokeWidth={2.5} />
      </g>
      <text x={textoX} y={y + 0.5} dominantBaseline="middle" fontSize={9.5} fontWeight={700} fill={CARTAO_TEXTO} fontFamily="Manrope, sans-serif">
        {texto}
      </text>
    </g>
  )
}

/** Selo "Manobra concluída" — MESMO padrão de cartão sólido, cor de sucesso — pedido explícito do
 *  usuário, 2026-08-26: "o resultado final deve deixar claro visualmente que o ciclo de manobra
 *  desse grupo terminou". Fica do lado do pino, na MESMA altura da linha (mesma convenção da tag
 *  de reversão das outras camadas — não acima dele), deslocado no sentido do recuo (longe do
 *  traço tracejado que chega por trás), pra não sobrepor nem o pino nem a tag de recuo. */
function SeloConclusao({ x, y }: { x: number; y: number }) {
  const texto = 'Manobra concluída'
  const largura = TAG_ICONE + TAG_GAP + medirLarguraTexto(texto) + TAG_PADDING_X * 2
  const left = x - largura / 2
  const top = y - TAG_ALTURA / 2
  const iconeX = left + TAG_PADDING_X
  const textoX = iconeX + TAG_ICONE + TAG_GAP
  return (
    <g>
      <rect x={left} y={top} width={largura} height={TAG_ALTURA} rx={TAG_ALTURA / 2} fill={CARTAO_BG} stroke={SELO_BORDA} strokeWidth={1.5} />
      <g transform={`translate(${iconeX}, ${y - TAG_ICONE / 2})`}>
        <CheckCircle2 size={TAG_ICONE} color={SELO_TEXTO} strokeWidth={2.5} />
      </g>
      <text x={textoX} y={y + 0.5} dominantBaseline="middle" fontSize={9.5} fontWeight={700} fill={SELO_TEXTO} fontFamily="Manrope, sans-serif">
        {texto}
      </text>
    </g>
  )
}

/** Path de um pino de mapa (bulbo + ponta) — MESMO glyph azul já usado em todos os outros destinos
 *  do mapa, duplicado aqui de propósito (pedido explícito do usuário: "pode usar o mesmo pin já
 *  padronizado"). */
const PINO_PATH_D = 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0'
const PINO_PONTA_X = 12
const PINO_PONTA_Y = 21.8
const PINO_TAMANHO = 22

function PinoChegada({ x, y }: { x: number; y: number }) {
  const escala = PINO_TAMANHO / 24
  return (
    <g transform={`translate(${x - PINO_PONTA_X * escala}, ${y - PINO_PONTA_Y * escala}) scale(${escala})`}>
      <path d={PINO_PATH_D} fill={ROTA_COR} stroke="var(--vli-map-canvas-bg)" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={12} cy={10} r={3} fill="var(--vli-map-canvas-bg)" />
    </g>
  )
}

/** Deslocamento vertical da tag de recuo acima da linha — evita sobrepor o traço tracejado. */
const TAG_RECUO_OFFSET_Y = 26
/** Deslocamento horizontal do selo de conclusão em relação ao pino — MESMO valor de
 *  `REVERSAO_OFFSET_X` das outras camadas, sempre no sentido do recuo (longe do traço que chega
 *  por trás do pino). */
const SELO_OFFSET_X = 72

export function EtapaFechamentoLayer({ scene, labelGutterWidth, etapa }: EtapaFechamentoLayerProps) {
  if (!etapa) return null

  const geometria = computeFechamentoGeometry(scene, etapa)
  if (!geometria) return null

  const { lineId, y, origemX: origemXLocal, finalX: finalXLocal } = geometria

  const origemX = labelGutterWidth + origemXLocal
  const finalX = labelGutterWidth + finalXLocal

  const sentido = origemX <= finalX ? 1 : -1
  const anguloTrecho = sentido === -1 ? 180 : 0
  const meioTrechoX = (origemX + finalX) / 2
  const seloX = finalX + sentido * SELO_OFFSET_X

  return (
    <g style={{ pointerEvents: 'none' }} data-etapa-highlight={etapa.tipo}>
      {/* Esmaece toda linha que não faz parte do trecho de recuo (só Linha Desvio permanece). */}
      {scene.lines
        .filter((line) => line.id !== lineId && line.type !== 'cco')
        .map((line) => {
          const trackHeight = resolveTrackHeight(line.type)
          return (
            <rect
              key={`dim-linha-fechamento-${line.id}`}
              x={labelGutterWidth + line.x}
              y={line.y - trackHeight / 2}
              width={line.width}
              height={trackHeight}
              fill={DIM_OVERLAY_FILL}
              fillOpacity={DIM_OVERLAY_OPACITY}
            />
          )
        })}

      {/* Esmaece também as conexões/travessões do mapa base — o recuo não cruza nenhuma. */}
      {scene.connections.map((conn, i) => (
        <line
          key={`dim-conexao-fechamento-${conn.id ?? i}`}
          x1={labelGutterWidth + conn.from.x}
          y1={conn.from.y}
          x2={labelGutterWidth + conn.to.x}
          y2={conn.to.y}
          stroke={DIM_OVERLAY_FILL}
          strokeOpacity={DIM_OVERLAY_OPACITY}
          strokeWidth={4}
        />
      ))}

      {/* Trecho único de recuo — tracejado, seta no sentido real do movimento de ré. */}
      <TrechoRecuo x0={origemX} y0={y} x1={finalX} y1={y} />
      {Math.abs(finalX - origemX) > SETA_TAMANHO * 4 && <Seta x={meioTrechoX} y={y} anguloGraus={anguloTrecho} />}

      {/* Tag de recuo — acima do meio do trecho, não sobre o traço tracejado. */}
      <TagRecuo x={meioTrechoX} y={y - TAG_RECUO_OFFSET_Y} distanciaM={etapa.distanciaM} />

      {/* Ponto final — mesmo pino de chegada usado em todas as outras etapas/rotas + selo de
         conclusão do ciclo (última etapa do Grupo), do lado do pino, longe do traço. */}
      <PinoChegada x={finalX} y={y} />
      <SeloConclusao x={seloX} y={y} />
    </g>
  )
}
