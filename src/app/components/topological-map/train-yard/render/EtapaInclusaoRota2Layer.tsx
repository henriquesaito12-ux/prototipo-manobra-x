import { RotateCcw } from 'lucide-react'
import type { ProjectedScene } from '../project'
import { computeInclusaoRota2Geometry } from '../etapaParada'
import { DIM_OVERLAY_FILL, DIM_OVERLAY_OPACITY, type EtapaHighlightInclusaoRota2 } from './Composition'
import { resolveTrackHeight } from './Line'

// Camada de destaque da Rota 2 de INCLUSÃO (inclusão até o destino) — parte do MESMO ponto onde a
// Rota 1 de Inclusão termina (`geometria.origemX`, reaproveitado via `computeInclusaoRota2Geometry`,
// nunca recalculado do zero), anda em Linha 3 até reverter, cruza um travessão real (T3) até Linha
// Desvio, e termina no MESMO ponto fixo onde a locomotiva partiu lá na Rota 1 de RETIRADA —
// fechamento do ciclo. Só UMA reversão, logo no Trecho 1 — o trecho final (T3 → Linha Desvio) anda
// na direção pós-reversão (`etapa.direcaoPosReversao`).
//
// MESMO padrão visual das rotas anteriores (`EtapaRetiradaLayer.tsx`/`EtapaRetiradaRota2Layer.tsx`/
// `EtapaInclusaoRota1Layer.tsx`), TODAS as constantes/componentes duplicados aqui de propósito —
// pedido explícito do usuário, 2026-08-26: "use como referência o mesmo padrão visual já validado
// nas rotas anteriores... mesma espessura de linha, mesmo comprimento proporcional/espaçado, sem
// sobreposição de elementos, mesmo estilo de ícone de reversão". O ponto final é a posição original
// da composição (Parada/Corte/Clear) — "reaproveite exatamente essa posição/pin já existente, não
// crie um marcador novo" (2026-08-26) — MESMO glyph de pino azul das outras rotas (`PinoChegada`),
// não um marcador diferente, na posição exata reaproveitada de `computeRetiradaRota1Geometry`.

interface EtapaInclusaoRota2LayerProps {
  scene: ProjectedScene
  labelGutterWidth: number
  etapa?: EtapaHighlightInclusaoRota2 | null
}

// MESMO azul "de botão" das outras rotas/camadas de destaque (`--vli-primary`).
const ROTA_COR = 'var(--vli-primary)'
const ROTA_HALO_OPACITY = 0.22
// MESMA espessura do trajeto das outras rotas.
const ROTA_ESPESSURA = 3
const ROTA_HALO_ESPESSURA = 7
/** Fundo/texto/borda da tag de reversão — MESMOS tokens das outras rotas. */
const CARTAO_BG = 'var(--vli-surface)'
const CARTAO_BORDA = 'var(--vli-border)'
const CARTAO_TEXTO = 'var(--vli-text-hi)'

/** Trecho de trajeto (reto ou diagonal) — halo suave + núcleo sólido, MESMO componente das outras
 *  rotas, duplicado aqui. */
function TrechoLinha({ x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number }) {
  if (Math.abs(x1 - x0) <= 0 && Math.abs(y1 - y0) <= 0) return null
  return (
    <>
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={ROTA_COR} strokeOpacity={ROTA_HALO_OPACITY} strokeWidth={ROTA_HALO_ESPESSURA} strokeLinecap="round" />
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={ROTA_COR} strokeWidth={ROTA_ESPESSURA} strokeLinecap="round" />
    </>
  )
}

/** Comprimento do braço da seta de sentido — mesma proporção das outras rotas. */
const SETA_TAMANHO = 7

/** Seta de sentido — MESMO "recorte" (triângulo na cor do fundo do canvas) das outras rotas, com
 *  ângulo livre pra apontar reto ou na diagonal. `anguloGraus` na convenção de `rotate()` do SVG
 *  (0° = direita, 90° = baixo, 180° = esquerda). */
function Seta({ x, y, anguloGraus }: { x: number; y: number; anguloGraus: number }) {
  const pontos = `0,${-SETA_TAMANHO * 0.7} 0,${SETA_TAMANHO * 0.7} ${SETA_TAMANHO},0`
  return (
    <g transform={`translate(${x}, ${y}) rotate(${anguloGraus})`}>
      <polygon points={pontos} fill="var(--vli-map-canvas-bg)" />
    </g>
  )
}

/** Deslocamento da tag de reversão em relação à junção real — MESMO valor/convenção já validada
 *  na Rota 2 de Retirada (2026-08-26: "a reversão deve estar do lado direito da linha"), sempre
 *  pro lado direito, independente do sentido do percurso. */
const REVERSAO_OFFSET_X = 72

const REVERSAO_TAG_ALTURA = 20
const REVERSAO_TAG_ICONE = 12
const REVERSAO_TAG_PADDING_X = 9
const REVERSAO_TAG_GAP = 4

/** Largura estimada de um texto — mesma régua das outras rotas, duplicada aqui por convenção. */
function medirLarguraTexto(texto: string): number {
  return texto.length * 5.4
}

/** Largura total da tag de reversão ("Reversão", texto fixo). */
function larguraTagReversao(): number {
  return REVERSAO_TAG_ICONE + REVERSAO_TAG_GAP + medirLarguraTexto('Reversão') + REVERSAO_TAG_PADDING_X * 2
}

/** Tag de reversão — MESMO padrão das outras rotas: cartão sólido, sem cauda/rabicho. Marca onde
 *  o Trecho 1 (Linha 3) termina. */
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

/** Path de um pino de mapa (bulbo + ponta) — MESMO glyph azul já usado em todos os outros
 *  destinos do mapa, duplicado aqui de propósito. */
const PINO_PATH_D = 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0'
const PINO_PONTA_X = 12
const PINO_PONTA_Y = 21.8
const PINO_TAMANHO = 22

/** Pino de chegada — MESMO tratamento das outras rotas: sólido na cor do trajeto, "furo" central e
 *  contorno na cor do fundo do canvas. Marca o MESMO ponto físico onde a Rota 1 de Retirada
 *  encontrou a composição parada (fechamento do ciclo) — reaproveitado, não um marcador novo. */
function PinoChegada({ x, y }: { x: number; y: number }) {
  const escala = PINO_TAMANHO / 24
  return (
    <g transform={`translate(${x - PINO_PONTA_X * escala}, ${y - PINO_PONTA_Y * escala}) scale(${escala})`}>
      <path d={PINO_PATH_D} fill={ROTA_COR} stroke="var(--vli-map-canvas-bg)" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={12} cy={10} r={3} fill="var(--vli-map-canvas-bg)" />
    </g>
  )
}

export function EtapaInclusaoRota2Layer({ scene, labelGutterWidth, etapa }: EtapaInclusaoRota2LayerProps) {
  if (!etapa) return null

  const geometria = computeInclusaoRota2Geometry(scene, etapa)
  if (!geometria) return null

  const {
    lineIdOrigem,
    lineIdFinal,
    yOrigem,
    yFinal,
    origemX: origemXLocal,
    reversaoX: reversaoXLocal,
    conexaoT3,
    finalInicioX: finalInicioXLocal,
    finalX: finalXLocal,
  } = geometria

  const origemX = labelGutterWidth + origemXLocal
  const reversaoAnchorX = labelGutterWidth + reversaoXLocal
  const finalInicioX = labelGutterWidth + finalInicioXLocal
  const finalX = labelGutterWidth + finalXLocal

  // Tag de reversão sempre do lado direito da linha — mesma convenção já validada na Rota 2 de
  // Retirada.
  const reversaoTagX = reversaoAnchorX + REVERSAO_OFFSET_X

  const sentidoOrigem = origemX <= reversaoAnchorX ? 1 : -1
  const meioTrecho1X = (origemX + reversaoAnchorX) / 2
  const anguloTrecho1 = sentidoOrigem === -1 ? 180 : 0

  const meioT3X = (reversaoAnchorX + finalInicioX) / 2
  const meioT3Y = (yOrigem + yFinal) / 2
  const anguloT3 = (Math.atan2(yFinal - yOrigem, finalInicioX - reversaoAnchorX) * 180) / Math.PI

  const sentidoFinal = finalInicioX <= finalX ? 1 : -1
  const anguloTrechoFinal = sentidoFinal === -1 ? 180 : 0
  const meioTrechoFinalX = (finalInicioX + finalX) / 2

  return (
    <g style={{ pointerEvents: 'none' }} data-etapa-highlight={etapa.tipo} data-rota-index={1}>
      {/* Esmaece toda linha que não faz parte da Rota 2 (Linha 3/Linha Desvio). */}
      {scene.lines
        .filter((line) => line.id !== lineIdOrigem && line.id !== lineIdFinal && line.type !== 'cco')
        .map((line) => {
          const trackHeight = resolveTrackHeight(line.type)
          return (
            <rect
              key={`dim-linha-inclusao-rota2-${line.id}`}
              x={labelGutterWidth + line.x}
              y={line.y - trackHeight / 2}
              width={line.width}
              height={trackHeight}
              fill={DIM_OVERLAY_FILL}
              fillOpacity={DIM_OVERLAY_OPACITY}
            />
          )
        })}

      {/* Esmaece também as conexões/travessões do mapa base, EXCETO T3 — ela faz parte do trecho
         em destaque, desenhada por cima logo abaixo. */}
      {scene.connections
        .filter((conn) => conn !== conexaoT3)
        .map((conn, i) => (
          <line
            key={`dim-conexao-inclusao-rota2-${conn.id ?? i}`}
            x1={labelGutterWidth + conn.from.x}
            y1={conn.from.y}
            x2={labelGutterWidth + conn.to.x}
            y2={conn.to.y}
            stroke={DIM_OVERLAY_FILL}
            strokeOpacity={DIM_OVERLAY_OPACITY}
            strokeWidth={4}
          />
        ))}

      {/* Trecho 1 — Linha 3, a partir do MESMO ponto onde a Rota 1 de Inclusão terminou até a
         junção real com T3, onde a reversão acontece. */}
      <TrechoLinha x0={origemX} y0={yOrigem} x1={reversaoAnchorX} y1={yOrigem} />
      {Math.abs(reversaoAnchorX - origemX) > SETA_TAMANHO * 4 && <Seta x={meioTrecho1X} y={yOrigem} anguloGraus={anguloTrecho1} />}

      {/* T3 — a travessia real entre Linha 3 e Linha Desvio, exatamente sobre a conexão do mapa
         base. */}
      <TrechoLinha x0={reversaoAnchorX} y0={yOrigem} x1={finalInicioX} y1={yFinal} />
      {Math.hypot(finalInicioX - reversaoAnchorX, yFinal - yOrigem) > SETA_TAMANHO * 4 && (
        <Seta x={meioT3X} y={meioT3Y} anguloGraus={anguloT3} />
      )}

      {/* Trecho 2 — Linha Desvio, até o MESMO ponto fixo onde a Rota 1 de Retirada encontrou a
         composição parada (fechamento do ciclo). */}
      <TrechoLinha x0={finalInicioX} y0={yFinal} x1={finalX} y1={yFinal} />
      {Math.abs(finalX - finalInicioX) > SETA_TAMANHO * 4 && <Seta x={meioTrechoFinalX} y={yFinal} anguloGraus={anguloTrechoFinal} />}

      {/* Ponto final do Trecho 1 — a tag de reversão marca onde ele termina. */}
      <TagReversao x={reversaoTagX} y={yOrigem} />

      {/* Ponto final da Rota 2 — mesmo pino de chegada usado nas outras etapas/rotas, na posição
         exata reaproveitada (fechamento do ciclo). */}
      <PinoChegada x={finalX} y={yFinal} />
    </g>
  )
}
