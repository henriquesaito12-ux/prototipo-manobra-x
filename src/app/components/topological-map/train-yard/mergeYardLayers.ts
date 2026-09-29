import type { YardElements, YardMap, YardStatus, YardTopology } from './types'

/**
 * Reconstrói o shape `YardTopology` que `project()` consome a partir das 3 camadas
 * independentes (ver ADR-011). Função pura, sem I/O — o merge em si não é uma chamada de rede,
 * só composição de dados já buscados por `useYardMap`/`useYardStatus`/`useYardElements`.
 *
 * `updatedAt` do resultado é o mais recente entre as 3 camadas (usado para staleness/dedup).
 */
export function mergeYardLayers(map: YardMap, status?: YardStatus, elements?: YardElements): YardTopology {
  const lineStatus = status?.lineStatus ?? {}
  const elementsByLine = elements?.elementsByLine ?? {}

  const updatedAt = [map.updatedAt, status?.updatedAt, elements?.updatedAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)!

  return {
    yardId: map.yardId,
    updatedAt,
    scale: map.scale,
    lines: map.lines.map((line) => ({
      ...line,
      status: lineStatus[line.id],
      elements: elementsByLine[line.id],
    })),
    connections: status?.connections,
  }
}
