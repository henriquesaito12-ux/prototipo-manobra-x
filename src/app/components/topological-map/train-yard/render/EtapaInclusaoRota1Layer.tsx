import type { ProjectedScene } from '../project'
import { computeInclusaoRota1Geometry } from '../etapaParada'
import { DIM_OVERLAY_FILL, DIM_OVERLAY_OPACITY, type EtapaHighlightInclusaoRota1 } from './Composition'
import { resolveTrackHeight } from './Line'

// Camada de destaque da Rota 1 de INCLUSÃO (deslocamento inicial da locomotiva) — parte do MESMO
// ponto onde a Rota 2 de Retirada terminou (`geometria.origemX`, reaproveitado via
// `computeInclusaoRota1Geometry`, nunca recalculado do zero), cruza UMA travessia real (BRANCH L4
// FIM) até a linha de destino (o trecho mais longo da rota) e termina nos vagões de substituição.
// SEM reversão — mais simples que as duas rotas de Retirada: só um trecho reto, uma travessia
// diagonal, outro trecho reto, na MESMA direção o tempo todo.
//
// MESMO padrão visual das Rotas de Retirada (`EtapaRetiradaLayer.tsx`/`EtapaRetiradaRota2Layer.tsx`),
// TODAS as constantes/componentes duplicados aqui de propósito — pedido explícito do usuário,
// 2026-08-26: "use como referência o mesmo padrão visual já validado nas rotas anteriores...
// mesma espessura de linha, mesmo comprimento proporcional/espaçado, sem sobreposição de
// elementos". Pino de chegada = MESMO glyph azul das outras etapas (sem marcador especial — pedido
// explícito). Vagões a incluir aparecem em VERDE no destino, MESMO formato/estilo do chip
// horizontal de vagões cortados da etapa CORTE (`EtapaCorteLayer.tsx`, `FileiraVagoesCortados`),
// só a cor/sinal trocados (vermelho/− → verde/+).

interface EtapaInclusaoRota1LayerProps {
  scene: ProjectedScene
  labelGutterWidth: number
  etapa?: EtapaHighlightInclusaoRota1 | null
}

// MESMO azul "de botão" das outras rotas/camadas de destaque (`--vli-primary`).
const ROTA_COR = 'var(--vli-primary)'
const ROTA_HALO_OPACITY = 0.22
// MESMA espessura do trajeto das outras rotas.
const ROTA_ESPESSURA = 3
const ROTA_HALO_ESPESSURA = 7

/** Trecho de trajeto (reto ou diagonal) — halo suave + núcleo sólido, MESMO componente das Rotas
 *  de Retirada, duplicado aqui. */
function TrechoLinha({ x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number }) {
  if (Math.abs(x1 - x0) <= 0 && Math.abs(y1 - y0) <= 0) return null
  return (
    <>
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={ROTA_COR} strokeOpacity={ROTA_HALO_OPACITY} strokeWidth={ROTA_HALO_ESPESSURA} strokeLinecap="round" />
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={ROTA_COR} strokeWidth={ROTA_ESPESSURA} strokeLinecap="round" />
    </>
  )
}

/** Comprimento do braço da seta de sentido — mesma proporção das outras camadas. */
const SETA_TAMANHO = 7

/** Seta de sentido — MESMO "recorte" (triângulo na cor do fundo do canvas) das outras camadas,
 *  com ângulo livre pra apontar reto ou na diagonal. `anguloGraus` na convenção de `rotate()` do
 *  SVG (0° = direita, 90° = baixo, 180° = esquerda). */
function Seta({ x, y, anguloGraus }: { x: number; y: number; anguloGraus: number }) {
  const pontos = `0,${-SETA_TAMANHO * 0.7} 0,${SETA_TAMANHO * 0.7} ${SETA_TAMANHO},0`
  return (
    <g transform={`translate(${x}, ${y}) rotate(${anguloGraus})`}>
      <polygon points={pontos} fill="var(--vli-map-canvas-bg)" />
    </g>
  )
}

/** Path de um pino de mapa (bulbo + ponta) — MESMO glyph azul já usado em todos os outros
 *  destinos do mapa (pedido explícito do usuário: "não precisa de um marcador especial
 *  diferente"), duplicado aqui de propósito. */
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

// Vagões a incluir em VERDE — MESMOS tokens semânticos de sucesso, MESMO fundo neutro opaco
// (`--vli-surface`) que a etapa CORTE usa pros vagões retirados (só borda/texto na cor certa —
// 2026-08-25/26, mesma régua: "não precisa ser transparente... fundo ESCURO e opaco", ver
// `EtapaCorteLayer.tsx`).
const CARTAO_BG = 'var(--vli-surface)'
const CHIP_BORDA = 'var(--vli-success-text)'
const CHIP_BG = CARTAO_BG
const CHIP_TEXTO = 'var(--vli-success-text)'
const CHIP_RAIO = 3

function medirLarguraChip(texto: string): number {
  return texto.length * 4.6 + 14
}

const CHIP_ALTURA = 13
const CHIP_GAP = 4
/** Respiro entre o pino e o primeiro chip — mesma régua de "nunca grudados" das outras camadas. */
const CHIP_GAP_PINO = 20

/** Fileira horizontal dos vagões a incluir — alinhados ao longo da própria linha, na mesma altura
 *  dela, à DIREITA do pino (2026-08-26: diferente da etapa CORTE, cujos vagões cortados ficam
 *  atrás/à esquerda do ícone porque marcam um ponto NO MEIO do trajeto; aqui o pino é o destino
 *  FINAL da rota — a fileira estende pra frente, no sentido de chegada, sem sobrepor o traço azul
 *  que vem da esquerda). MESMO estilo de chip retangular da `FileiraVagoesCortados`
 *  (`EtapaCorteLayer.tsx`), só cor/sinal trocados (vermelho/− → verde/+). */
function FileiraVagoesIncluidos({ x, y, vagoes }: { x: number; y: number; vagoes: string[] }) {
  const chipY = y - CHIP_ALTURA / 2
  let cursorX = x + CHIP_GAP_PINO
  return (
    <g>
      {vagoes.map((id) => {
        const texto = `+ ${id}`
        const largura = medirLarguraChip(texto)
        const chipX = cursorX
        cursorX += largura + CHIP_GAP
        return (
          <g key={id}>
            <rect x={chipX} y={chipY} width={largura} height={CHIP_ALTURA} rx={CHIP_RAIO} fill={CHIP_BG} stroke={CHIP_BORDA} strokeWidth={1} />
            <text
              x={chipX + largura / 2}
              y={chipY + CHIP_ALTURA / 2 + 0.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={7.5}
              fontWeight={700}
              fill={CHIP_TEXTO}
              fontFamily="Manrope, sans-serif"
            >
              {texto}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export function EtapaInclusaoRota1Layer({ scene, labelGutterWidth, etapa }: EtapaInclusaoRota1LayerProps) {
  if (!etapa) return null

  const geometria = computeInclusaoRota1Geometry(scene, etapa)
  if (!geometria) return null

  const {
    lineIdOrigem,
    lineIdDestino,
    yOrigem,
    yDestino,
    origemX: origemXLocal,
    juncaoOrigemX: juncaoOrigemXLocal,
    conexao,
    juncaoDestinoX: juncaoDestinoXLocal,
    finalX: finalXLocal,
  } = geometria

  const origemX = labelGutterWidth + origemXLocal
  const juncaoOrigemX = labelGutterWidth + juncaoOrigemXLocal
  const juncaoDestinoX = labelGutterWidth + juncaoDestinoXLocal
  const finalX = labelGutterWidth + finalXLocal

  const meioTrecho1X = (origemX + juncaoOrigemX) / 2
  const sentidoOrigem = origemX <= juncaoOrigemX ? 1 : -1
  const anguloTrecho1 = sentidoOrigem === -1 ? 180 : 0

  const meioTravessaoX = (juncaoOrigemX + juncaoDestinoX) / 2
  const meioTravessaoY = (yOrigem + yDestino) / 2
  const anguloTravessao = (Math.atan2(yDestino - yOrigem, juncaoDestinoX - juncaoOrigemX) * 180) / Math.PI

  const meioTrecho2X = (juncaoDestinoX + finalX) / 2
  const sentidoDestino = juncaoDestinoX <= finalX ? 1 : -1
  const anguloTrecho2 = sentidoDestino === -1 ? 180 : 0

  return (
    <g style={{ pointerEvents: 'none' }} data-etapa-highlight={etapa.tipo} data-rota-index={0}>
      {/* Esmaece toda linha que não faz parte da Rota 1 (Linha Origem/Destino). */}
      {scene.lines
        .filter((line) => line.id !== lineIdOrigem && line.id !== lineIdDestino && line.type !== 'cco')
        .map((line) => {
          const trackHeight = resolveTrackHeight(line.type)
          return (
            <rect
              key={`dim-linha-inclusao-rota1-${line.id}`}
              x={labelGutterWidth + line.x}
              y={line.y - trackHeight / 2}
              width={line.width}
              height={trackHeight}
              fill={DIM_OVERLAY_FILL}
              fillOpacity={DIM_OVERLAY_OPACITY}
            />
          )
        })}

      {/* Esmaece também as conexões/travessões do mapa base, EXCETO BRANCH L4 FIM — ela faz parte
         do trecho em destaque, desenhada por cima logo abaixo. */}
      {scene.connections
        .filter((conn) => conn !== conexao)
        .map((conn, i) => (
          <line
            key={`dim-conexao-inclusao-rota1-${conn.id ?? i}`}
            x1={labelGutterWidth + conn.from.x}
            y1={conn.from.y}
            x2={labelGutterWidth + conn.to.x}
            y2={conn.to.y}
            stroke={DIM_OVERLAY_FILL}
            strokeOpacity={DIM_OVERLAY_OPACITY}
            strokeWidth={4}
          />
        ))}

      {/* Trecho 1 — Linha Origem (Linha 4), a partir do MESMO ponto onde a Rota 2 de Retirada
         terminou até a junção real com BRANCH L4 FIM. */}
      <TrechoLinha x0={origemX} y0={yOrigem} x1={juncaoOrigemX} y1={yOrigem} />
      {Math.abs(juncaoOrigemX - origemX) > SETA_TAMANHO * 4 && <Seta x={meioTrecho1X} y={yOrigem} anguloGraus={anguloTrecho1} />}

      {/* BRANCH L4 FIM — a travessia real entre Linha Origem e Linha Destino, exatamente sobre a
         conexão do mapa base. */}
      <TrechoLinha x0={juncaoOrigemX} y0={yOrigem} x1={juncaoDestinoX} y1={yDestino} />
      {Math.hypot(juncaoDestinoX - juncaoOrigemX, yDestino - yOrigem) > SETA_TAMANHO * 4 && (
        <Seta x={meioTravessaoX} y={meioTravessaoY} anguloGraus={anguloTravessao} />
      )}

      {/* Trecho 2 — Linha Destino (Linha 3), o trecho mais longo da rota, até os vagões de
         substituição. */}
      <TrechoLinha x0={juncaoDestinoX} y0={yDestino} x1={finalX} y1={yDestino} />
      {Math.abs(finalX - juncaoDestinoX) > SETA_TAMANHO * 4 && <Seta x={meioTrecho2X} y={yDestino} anguloGraus={anguloTrecho2} />}

      {/* Ponto final — mesmo pino de chegada usado em todas as outras etapas/rotas. */}
      <PinoChegada x={finalX} y={yDestino} />

      {/* Vagões a incluir, em verde, alinhados à direita do pino. */}
      {etapa.vagoesIncluidos.length > 0 && <FileiraVagoesIncluidos x={finalX} y={yDestino} vagoes={etapa.vagoesIncluidos} />}
    </g>
  )
}
