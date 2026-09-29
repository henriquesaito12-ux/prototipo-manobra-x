import { RotateCcw } from 'lucide-react'
import type { ProjectedScene } from '../project'
import { computeRetiradaRota2Geometry } from '../etapaParada'
import { DIM_OVERLAY_FILL, DIM_OVERLAY_OPACITY, type EtapaHighlightRetiradaRota2 } from './Composition'
import { resolveTrackHeight } from './Line'

// Camada de destaque da Rota 2 de RETIRADA (retirada até o destino) — parte do MESMO ponto onde
// a Rota 1 termina (`geometria.origemX`, reaproveitado via `computeRetiradaRota2Geometry`, nunca
// recalculado do zero), anda em Linha Desvio até reverter, cruza um travessão real (T3) até
// Linha Meio (Linha 3 — o trecho mais longo da rota), cruza um SEGUNDO travessão real (BRANCH L4
// FIM) até Linha Final (Linha 4), e termina no pino de chegada. Só UMA reversão, logo no Trecho 1
// — tudo depois dela anda na MESMA direção (`etapa.direcaoPosReversao`).
//
// MESMO padrão visual da Rota 1 (`EtapaRetiradaLayer.tsx`), TODAS as constantes/componentes
// duplicados aqui de propósito (motor de mapa mantém cada camada de destaque independente) —
// pedido explícito do usuário, 2026-08-25: "use como referência EXATA o padrão visual que
// acabamos de acertar na Rota 1... mesma espessura de linha, mesmo comprimento
// proporcional/espaçado (não comprimido), mesmo estilo de ícone de reversão como marcador de fim
// de trecho, sem sobreposição de elementos". SEM `MarcadorInicio` na origem (diferente da Rota 1):
// aquele ponto já é o pino de chegada da Rota 1, não precisa de um segundo marcador ali.

interface EtapaRetiradaRota2LayerProps {
  scene: ProjectedScene
  labelGutterWidth: number
  etapa?: EtapaHighlightRetiradaRota2 | null
}

// MESMO azul "de botão" das outras rotas/camadas de destaque (`--vli-primary`).
const ROTA_COR = 'var(--vli-primary)'
const ROTA_HALO_OPACITY = 0.22
// MESMA espessura do trajeto da Rota 1/Parada/Clear.
const ROTA_ESPESSURA = 3
const ROTA_HALO_ESPESSURA = 7
/** Fundo/texto/borda da tag de reversão — MESMOS tokens do badge flutuante de distância e da tag
 *  de reversão da Rota 1. */
const CARTAO_BG = 'var(--vli-surface)'
const CARTAO_BORDA = 'var(--vli-border)'
const CARTAO_TEXTO = 'var(--vli-text-hi)'

/** Trecho de trajeto (reto ou diagonal) — halo suave + núcleo sólido, MESMO componente da Rota 1
 *  (`EtapaRetiradaLayer.tsx`, `TrechoLinha`), duplicado aqui. Serve pros 3 trechos retos (Linha
 *  Desvio, Linha Meio, Linha Final) e pras 2 travessias diagonais (T3, BRANCH L4 FIM). */
function TrechoLinha({ x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number }) {
  if (Math.abs(x1 - x0) <= 0 && Math.abs(y1 - y0) <= 0) return null
  return (
    <>
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={ROTA_COR} strokeOpacity={ROTA_HALO_OPACITY} strokeWidth={ROTA_HALO_ESPESSURA} strokeLinecap="round" />
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={ROTA_COR} strokeWidth={ROTA_ESPESSURA} strokeLinecap="round" />
    </>
  )
}

/** Comprimento do braço da seta de sentido — mesma proporção da Rota 1. */
const SETA_TAMANHO = 7

/** Seta de sentido — MESMO "recorte" (triângulo na cor do fundo do canvas, por cima do traço
 *  sólido) da Rota 1, com ângulo livre pra apontar reto ou na diagonal. `anguloGraus` na
 *  convenção de `rotate()` do SVG (0° = direita, 90° = baixo, 180° = esquerda). */
function Seta({ x, y, anguloGraus }: { x: number; y: number; anguloGraus: number }) {
  const pontos = `0,${-SETA_TAMANHO * 0.7} 0,${SETA_TAMANHO * 0.7} ${SETA_TAMANHO},0`
  return (
    <g transform={`translate(${x}, ${y}) rotate(${anguloGraus})`}>
      <polygon points={pontos} fill="var(--vli-map-canvas-bg)" />
    </g>
  )
}

/** Deslocamento da tag de reversão em relação à junção real — MESMO valor da Rota 1
 *  (`REVERSAO_OFFSET_X`, `EtapaRetiradaLayer.tsx`), só que sempre pro lado direito aqui (ver
 *  onde é usado, abaixo) em vez de continuar o sentido do percurso. */
const REVERSAO_OFFSET_X = 72

const REVERSAO_TAG_ALTURA = 20
const REVERSAO_TAG_ICONE = 12
const REVERSAO_TAG_PADDING_X = 9
const REVERSAO_TAG_GAP = 4

/** Largura estimada de um texto — mesma régua da Rota 1/`EtapaCorteLayer.tsx`, duplicada aqui por
 *  convenção. */
function medirLarguraTexto(texto: string): number {
  return texto.length * 5.4
}

/** Largura total da tag de reversão ("Reversão", texto fixo) — usada tanto por `TagReversao`
 *  quanto pelo cálculo de até onde o Trecho 1 pode esticar sem encostar nela (mesmo padrão da
 *  Rota 1). */
function larguraTagReversao(): number {
  return REVERSAO_TAG_ICONE + REVERSAO_TAG_GAP + medirLarguraTexto('Reversão') + REVERSAO_TAG_PADDING_X * 2
}

/** Tag de reversão — MESMO padrão do badge flutuante de distância e da tag de reversão da Rota 1:
 *  cartão sólido, sem cauda/rabicho. Marca onde o Trecho 1 (Linha Desvio) termina. */
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

/** Path de um pino de mapa (bulbo + ponta) — MESMO glyph da Rota 1/`PinoReferencia`, duplicado
 *  aqui de propósito. */
const PINO_PATH_D = 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0'
const PINO_PONTA_X = 12
const PINO_PONTA_Y = 21.8
const PINO_TAMANHO = 22

/** Pino de chegada — MESMO tratamento da Rota 1: sólido na cor do trajeto, "furo" central e
 *  contorno na cor do fundo do canvas. Marca o ponto final da Rota 2. */
function PinoChegada({ x, y }: { x: number; y: number }) {
  const escala = PINO_TAMANHO / 24
  return (
    <g transform={`translate(${x - PINO_PONTA_X * escala}, ${y - PINO_PONTA_Y * escala}) scale(${escala})`}>
      <path d={PINO_PATH_D} fill={ROTA_COR} stroke="var(--vli-map-canvas-bg)" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={12} cy={10} r={3} fill="var(--vli-map-canvas-bg)" />
    </g>
  )
}

export function EtapaRetiradaRota2Layer({ scene, labelGutterWidth, etapa }: EtapaRetiradaRota2LayerProps) {
  if (!etapa) return null

  const geometria = computeRetiradaRota2Geometry(scene, etapa)
  if (!geometria) return null

  const {
    lineIdOrigem,
    lineIdMeio,
    lineIdFinal,
    yOrigem,
    yMeio,
    yFinal,
    origemX: origemXLocal,
    reversaoX: reversaoXLocal,
    conexaoT3,
    meioInicioX: meioInicioXLocal,
    meioFimX: meioFimXLocal,
    conexaoBranch,
    finalInicioX: finalInicioXLocal,
    finalX: finalXLocal,
  } = geometria

  const origemX = labelGutterWidth + origemXLocal
  const reversaoAnchorX = labelGutterWidth + reversaoXLocal
  const meioInicioX = labelGutterWidth + meioInicioXLocal
  const meioFimX = labelGutterWidth + meioFimXLocal
  const finalInicioX = labelGutterWidth + finalInicioXLocal
  const finalX = labelGutterWidth + finalXLocal

  // Tag de reversão SEMPRE do lado direito da linha (X crescente), independente do sentido do
  // percurso — diferente da Rota 1 (que continua no sentido do percurso): pedido explícito do
  // usuário, 2026-08-26 ("na rota 2, a reversão deve estar do lado direito da linha"). Como a
  // ponta direita do Trecho 1 já é o próprio `origemX` (o pino da Rota 1, sem marcador próprio
  // aqui), a tag flutua nesse mesmo lado, sem precisar esticar o traço até ela (diferente da
  // Rota 1: aqui o traço termina normalmente na junção real, sem gap especial).
  const reversaoTagX = reversaoAnchorX + REVERSAO_OFFSET_X

  const sentidoOrigem = origemX <= reversaoAnchorX ? 1 : -1
  const meioTrecho1X = (origemX + reversaoAnchorX) / 2
  const anguloTrecho1 = sentidoOrigem === -1 ? 180 : 0

  const meioT3X = (reversaoAnchorX + meioInicioX) / 2
  const meioT3Y = (yOrigem + yMeio) / 2
  const anguloT3 = (Math.atan2(yMeio - yOrigem, meioInicioX - reversaoAnchorX) * 180) / Math.PI

  // Seta da Linha 3 apontando pra esquerda — sentido real do percurso (ECJ) — pedido explícito
  // do usuário, 2026-08-26: "a seta ali na L3 está invertida... é pra apontar pra esquerda mesmo"
  // (correção do pedido anterior, que pedia pra direita).
  const anguloTrechoMeio = 180
  const meioTrechoMeioX = (meioInicioX + meioFimX) / 2

  const meioBranchX = (meioFimX + finalInicioX) / 2
  const meioBranchY = (yMeio + yFinal) / 2
  const anguloBranch = (Math.atan2(yFinal - yMeio, finalInicioX - meioFimX) * 180) / Math.PI

  const anguloTrechoFinal = finalInicioX <= finalX ? 0 : 180
  const meioTrechoFinalX = (finalInicioX + finalX) / 2

  return (
    <g style={{ pointerEvents: 'none' }} data-etapa-highlight={etapa.tipo} data-rota-index={2}>
      {/* Esmaece toda linha que não faz parte da Rota 2 (Linha Desvio/Meio/Final). */}
      {scene.lines
        .filter((line) => line.id !== lineIdOrigem && line.id !== lineIdMeio && line.id !== lineIdFinal && line.type !== 'cco')
        .map((line) => {
          const trackHeight = resolveTrackHeight(line.type)
          return (
            <rect
              key={`dim-linha-retirada-rota2-${line.id}`}
              x={labelGutterWidth + line.x}
              y={line.y - trackHeight / 2}
              width={line.width}
              height={trackHeight}
              fill={DIM_OVERLAY_FILL}
              fillOpacity={DIM_OVERLAY_OPACITY}
            />
          )
        })}

      {/* Esmaece também as conexões/travessões do mapa base, EXCETO T3 e BRANCH L4 FIM — elas
         fazem parte do trecho em destaque, desenhadas por cima logo abaixo. */}
      {scene.connections
        .filter((conn) => conn !== conexaoT3 && conn !== conexaoBranch)
        .map((conn, i) => (
          <line
            key={`dim-conexao-retirada-rota2-${conn.id ?? i}`}
            x1={labelGutterWidth + conn.from.x}
            y1={conn.from.y}
            x2={labelGutterWidth + conn.to.x}
            y2={conn.to.y}
            stroke={DIM_OVERLAY_FILL}
            strokeOpacity={DIM_OVERLAY_OPACITY}
            strokeWidth={4}
          />
        ))}

      {/* Trecho 1 — Linha Desvio, a partir do MESMO ponto onde a Rota 1 terminou até a junção
         real com T3, onde a reversão acontece. */}
      <TrechoLinha x0={origemX} y0={yOrigem} x1={reversaoAnchorX} y1={yOrigem} />
      {Math.abs(reversaoAnchorX - origemX) > SETA_TAMANHO * 4 && <Seta x={meioTrecho1X} y={yOrigem} anguloGraus={anguloTrecho1} />}

      {/* T3 — a travessia real entre Linha Desvio e Linha Meio, exatamente sobre a conexão do
         mapa base. */}
      <TrechoLinha x0={reversaoAnchorX} y0={yOrigem} x1={meioInicioX} y1={yMeio} />
      {Math.hypot(meioInicioX - reversaoAnchorX, yMeio - yOrigem) > SETA_TAMANHO * 4 && (
        <Seta x={meioT3X} y={meioT3Y} anguloGraus={anguloT3} />
      )}

      {/* Trecho 2 — Linha Meio (Linha 3), o trecho mais longo da rota: já renderiza bem mais
         espaçado que os outros pela própria distância real, sem precisar de nenhum ajuste
         cosmético extra. */}
      <TrechoLinha x0={meioInicioX} y0={yMeio} x1={meioFimX} y1={yMeio} />
      {Math.abs(meioFimX - meioInicioX) > SETA_TAMANHO * 4 && <Seta x={meioTrechoMeioX} y={yMeio} anguloGraus={anguloTrechoMeio} />}

      {/* BRANCH L4 FIM — a travessia real entre Linha Meio e Linha Final, exatamente sobre a
         conexão do mapa base. */}
      <TrechoLinha x0={meioFimX} y0={yMeio} x1={finalInicioX} y1={yFinal} />
      {Math.hypot(finalInicioX - meioFimX, yFinal - yMeio) > SETA_TAMANHO * 4 && (
        <Seta x={meioBranchX} y={meioBranchY} anguloGraus={anguloBranch} />
      )}

      {/* Trecho 3 — Linha Final (Linha 4), até o pino de chegada. */}
      <TrechoLinha x0={finalInicioX} y0={yFinal} x1={finalX} y1={yFinal} />
      {Math.abs(finalX - finalInicioX) > SETA_TAMANHO * 4 && <Seta x={meioTrechoFinalX} y={yFinal} anguloGraus={anguloTrechoFinal} />}

      {/* Ponto final do Trecho 1 — a tag de reversão marca onde ele termina. */}
      <TagReversao x={reversaoTagX} y={yOrigem} />

      {/* Ponto final da Rota 2 — mesmo pino de chegada usado nas outras etapas/rotas. */}
      <PinoChegada x={finalX} y={yFinal} />
    </g>
  )
}
