import type { ProjectedDivider } from '../project'

// Divisor vertical (ex.: PN — passagem de nível) cruzando várias linhas. Único
// variant real hoje — estilo hardcoded, sem registry (ver `Marker.tsx` para o
// padrão de registry quando houver 2+ variantes reais).

interface DividerProps {
  divider: ProjectedDivider
  labelGutterWidth: number
}

const BAR_WIDTH = 10

export function Divider({ divider, labelGutterWidth }: DividerProps) {
  const x = labelGutterWidth + divider.x
  const y0 = Math.min(divider.y0, divider.y1)
  const height = Math.abs(divider.y1 - divider.y0)
  const yMid = y0 + height / 2

  return (
    <g data-divider-id={divider.id}>
      <rect
        x={x - BAR_WIDTH / 2}
        y={y0}
        width={BAR_WIDTH}
        height={height}
        fill="var(--vli-map-divider-fill)"
        stroke="var(--vli-map-divider-border)"
        strokeWidth={1.2}
      />
      {divider.label && (
        <text
          x={x}
          y={yMid}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--vli-map-default-label)"
          fontSize={8}
          fontWeight={700}
          letterSpacing={0.5}
          transform={`rotate(-90 ${x} ${yMid})`}
        >
          {divider.label}
        </text>
      )}
    </g>
  )
}
