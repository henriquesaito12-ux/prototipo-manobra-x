import type { ProjectedConnection } from '../project'

// Trocas de faixa: uma <line> diagonal por `ProjectedConnection`, ligando um
// ponto de `fromLineId` a um ponto de `toLineId`. Visual idêntico a
// TRACK_CONNECTORS/EVS_CONNECTORS do SVG legado (`../trackData.ts`). Sem
// interação — no domínio, só as composições são clicáveis (ver Composition.tsx).

interface ConnectionsProps {
  connections: ProjectedConnection[]
  labelGutterWidth: number
}

export function Connections({ connections, labelGutterWidth }: ConnectionsProps) {
  return (
    <g>
      {connections.map((conn, index) => {
        const connectionId = conn.id ?? `${conn.fromLineId}-${conn.toLineId}-${index}`
        // Conector que toca linha de passagem (transit) usa a cor de acento dela
        // (#4A90D9), como no protótipo; os demais usam cinza PURO (sem matiz de azul) — mesmo
        // token de `styles.ts` (`--vli-map-gray-border`), trocado em 2026-08-25 (primeiro pra
        // `--vli-map-navy-border`, depois pro cinza puro — "navy" ainda lia como azul).
        const accent = conn.fromLineType === 'passagem' || conn.toLineType === 'passagem'
        const stroke = accent ? 'var(--vli-map-blue-border)' : 'var(--vli-map-gray-border)'
        const opacity = accent ? 0.5 : 0.6
        return (
          <line
            key={connectionId}
            data-connection-id={connectionId}
            x1={labelGutterWidth + conn.from.x}
            y1={conn.from.y}
            x2={labelGutterWidth + conn.to.x}
            y2={conn.to.y}
            stroke={stroke}
            strokeWidth={1.2}
            opacity={opacity}
          />
        )
      })}
    </g>
  )
}
