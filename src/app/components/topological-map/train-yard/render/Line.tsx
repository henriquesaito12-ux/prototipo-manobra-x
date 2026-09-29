import type { ProjectedLine } from '../project'
import { resolveLineTypeStyle, resolveStatusOverlay } from '../styles'
import type { LineStatus } from '../types'

// Desenha a base de uma linha (retângulo ou polyline, se `hint.path` presente) +
// overlays de status empilhados por precedência + rótulo. Cor/traço vêm de
// `styles.ts` (identidade visual de domínio) — este arquivo só monta o SVG.
//
// Exceção: `type: 'cco'` é um separador de LAYOUT (divisória entre o pátio de
// manobra e as linhas de recebimento), não uma linha navegável — não tem banda
// de trilho, não tem overlay de status e não tem rótulo próprio (o texto vem de
// um `element` kind "label" da própria linha, desenhado por `YardCanvas`).

interface LineProps {
  line: ProjectedLine
  labelGutterWidth: number
}

/**
 * Altura padrão da faixa de trilho, em unidades de viewBox — herdada do SVG legado
 * (`trackData.ts`). Fallback quando `typeStyle.trackHeight` não é declarado (ver
 * `styles.ts`) — hoje só "recebimento" (EVS1/EVS2) declara uma altura maior (12). Exportada
 * para `YardCanvas.tsx` resolver a mesma altura pro bloco de composição sobre a linha (ver
 * `resolveTrackHeight`/`Composition.tsx`) — o trem nunca pode ultrapassar a faixa do trilho em
 * que está desenhado.
 */
export const DEFAULT_TRACK_HEIGHT = 9
/** Fallback de `labelFontSize` quando o tipo de linha não declara um (ver `styles.ts`). */
const DEFAULT_LABEL_FONT_SIZE = 12
/** Espessura da linha divisória do CCO — mais grossa que o trilho central comum (0.5). */
const CCO_DIVIDER_STROKE_WIDTH = 1.5

/** Altura da faixa de trilho de UMA linha — mesma resolução que `Line` usa pra desenhar a
 *  própria banda, reaproveitada por `YardCanvas.tsx` pra dimensionar o bloco de composição
 *  daquela linha (nunca pode ultrapassá-la). */
export function resolveTrackHeight(type: ProjectedLine['type']): number {
  return resolveLineTypeStyle(type).trackHeight ?? DEFAULT_TRACK_HEIGHT
}

function sortStatusByPrecedence(status: LineStatus[]): LineStatus[] {
  return [...status].sort((a, b) => resolveStatusOverlay(a).precedence - resolveStatusOverlay(b).precedence)
}

export function Line({ line, labelGutterWidth }: LineProps) {
  const x = labelGutterWidth + line.x
  const y = line.y
  const typeStyle = resolveLineTypeStyle(line.type)
  const trackHeight = resolveTrackHeight(line.type)
  const topY = y - trackHeight / 2
  const orderedStatus = sortStatusByPrecedence(line.status)
  const labelFontSize = typeStyle.labelFontSize ?? DEFAULT_LABEL_FONT_SIZE
  const isDivider = line.type === 'cco'

  if (isDivider) {
    // Divisória CCO: só uma linha fina tracejada, sem banda/overlay/rótulo.
    return (
      <g data-line-id={line.id}>
        <line
          x1={x}
          y1={y}
          x2={x + line.width}
          y2={y}
          stroke={typeStyle.border}
          strokeWidth={CCO_DIVIDER_STROKE_WIDTH}
          strokeDasharray={typeStyle.dashArray}
        />
      </g>
    )
  }

  // Trilho central: dasharray próprio quando o tipo declara um (ex.: "passagem") —
  // carga/recebimento (sem `centerRailDashArray`) ficam sólidos.
  const centerRailDashArray = typeStyle.centerRailDashArray

  // "interditada" substitui a banda base inteira (hachura, sem "carga" por baixo) e
  // recolore o trilho central — não é um overlay semi-transparente por cima, é a
  // aparência da própria faixa bloqueada (mesma semântica de `TrainYardSVG.tsx`
  // isBlocked). Demais status (hoje só o fallback "default") continuam como overlay
  // aditivo, desenhado por cima de tudo.
  const isBlocked = orderedStatus.includes('interditada')
  const blockOverlay = resolveStatusOverlay('interditada')
  // "restrita": mesma banda de sempre (mesmo formato/tracejado do tipo), só recolorida de vermelho
  // — sem hachura, que é exclusiva de "interditada". Interditada tem precedência se as duas vierem.
  const isRestrita = !isBlocked && orderedStatus.includes('restrita')
  const restritaOverlay = resolveStatusOverlay('restrita')
  const additiveStatus = orderedStatus.filter((status) => status !== 'interditada' && status !== 'restrita')
  const centerRailStroke = isBlocked ? blockOverlay.borderColor : isRestrita ? restritaOverlay.borderColor : typeStyle.border

  return (
    <g data-line-id={line.id}>
      {line.path ? (
        <polyline
          points={line.path.map((p) => `${labelGutterWidth + p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={typeStyle.border}
          strokeWidth={trackHeight}
          strokeDasharray={typeStyle.dashArray}
        />
      ) : (
        <>
          <rect
            x={x}
            y={topY}
            width={line.width}
            height={trackHeight}
            fill={isBlocked ? 'url(#hatch-interditada)' : isRestrita ? restritaOverlay.fill : typeStyle.fill}
            stroke={isBlocked ? blockOverlay.borderColor : isRestrita ? restritaOverlay.borderColor : typeStyle.border}
            strokeWidth={1}
            strokeDasharray={isBlocked ? undefined : typeStyle.dashArray}
          />
          {additiveStatus.map((status) => {
            const overlay = resolveStatusOverlay(status)
            // Status desconhecido: overlay genérico semi-transparente, sem semântica nova.
            return (
              <rect
                key={status}
                x={x}
                y={topY}
                width={line.width}
                height={trackHeight}
                fill={overlay.fill}
                opacity={0.5}
                stroke={overlay.borderColor}
                strokeWidth={1}
              />
            )
          })}
          {/* Trilho central: desenhado por último para ficar por cima da hachura de
              "interditada" (o pattern tem vãos transparentes que, senão, deixariam
              vazar a cor da banda base). */}
          <line
            x1={x}
            y1={y}
            x2={x + line.width}
            y2={y}
            stroke={centerRailStroke}
            strokeWidth={0.5}
            strokeDasharray={centerRailDashArray}
          />
        </>
      )}
      <text
        x={labelGutterWidth - 8}
        y={y}
        textAnchor="end"
        dominantBaseline="middle"
        fill={typeStyle.labelColor}
        fontWeight={typeStyle.labelFontWeight}
        fontSize={labelFontSize}
      >
        {line.label}
      </text>
    </g>
  )
}
