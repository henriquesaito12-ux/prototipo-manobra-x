import type {
  Connection,
  CompositionUnit,
  Line,
  LineStatus,
  LineType,
  Segment,
  VehicleInfo,
  YardElement,
  YardTopology,
} from './types'
import { computeScale, toWidth, toX, type ComputeScaleOptions, type Scale } from './scale'

// Motor de projeção do mapa topológico: converte o contrato (topologia + dimensões reais)
// em coordenadas de desenho já resolvidas (X/Y/width). Puro — sem React, sem I/O. Reusa
// `computeScale`/`toX`/`toWidth` de `./scale.ts` para tudo que é escala X; aqui só resolve
// Y ordinal, offsets locais-de-linha e o encadeamento de segmentos/conexões.

/** Y-base para order=0 quando a linha não tem `hint.y`. */
const Y_BASE = 20
/** Espaçamento fixo entre `order`s consecutivos — gaps em `order` viram gaps em Y (intencional). */
const Y_SPACING = 28
/**
 * Margem direita do viewBox, só pra não cortar texto/ícone centrado num elemento que caia
 * exatamente no fim de uma linha (`at.from === line.length`) — caso real: marcador `km` no
 * fim do pátio `eht` (label "754+313" ficava com metade cortada, textAnchor="middle" sem
 * espaço à direita do último `x` de trilho). Não afeta a escala de desenho: `trackAreaWidth`
 * (o que `scale.ts` usa pra `toX`/`toWidth`) permanece intocado, só o viewBox fica maior.
 */
const RIGHT_EDGE_MARGIN = 48

export interface ProjectOptions {
  /** Largura útil em unidades de viewBox reservada às linhas (exclui calha de rótulo). */
  trackAreaWidth: number
  /** Largura reservada aos rótulos das linhas, à esquerda da área de trilhos. */
  labelGutterWidth: number
  minRenderWidth?: number
}

export interface ProjectedScene {
  viewBoxWidth: number
  viewBoxHeight: number
  labelGutterWidth: number
  lines: ProjectedLine[]
  connections: ProjectedConnection[]
}

export interface ProjectedLine {
  id: string
  label: string
  type: LineType
  status: LineStatus[]
  x: number
  y: number
  width: number
  /** length/offset saneados (não os brutos do contrato) — já prontos para a camada de render. */
  length: number
  offset: number
  /** Presente só quando `hint.path` foi fornecido — bypassa X/Y padrão para essa linha. */
  path?: { x: number; y: number }[]
  elements: ProjectedElement[]
}

interface ProjectedElementBase {
  id?: string
  x: number
  y: number
}

export interface ProjectedComposition extends ProjectedElementBase {
  kind: 'composition'
  label?: string
  width: number
  segments: ProjectedSegment[]
  /** Repassado sem alteração de `CompositionElement.background` (ver `types.ts`) — só o
   *  componente de render (`Composition.tsx`) decide o que fazer com isso. */
  background?: boolean
}

export interface ProjectedSegment {
  kind: string
  count: number
  x: number
  width: number
  color?: string
  detail?: VehicleInfo[]
  blocoId?: string
  blocoNome?: string
  clusterId?: string
  /** Um por `Segment.units` — largura do segmento dividida em partes iguais, uma por veículo
   *  (o contrato não dá comprimento físico individual, só o total do segmento). Ausente quando
   *  `Segment.units` também está ausente (ver `types.ts`). */
  units?: ProjectedUnit[]
  /** Repassado sem projeção própria — pareado por índice com `units` no momento de desenhar
   *  (ver `CompositionDetalhada`, `types.ts`), nunca ocupa posição própria na largura do
   *  segmento. */
  incoming?: CompositionUnit[]
}

export interface ProjectedUnit {
  id: string
  kind: 'locomotiva' | 'vagao'
  x: number
  width: number
}

export interface ProjectedMarker extends ProjectedElementBase {
  kind: 'marker'
  variant: string
  label?: string
}

export interface ProjectedLabel extends ProjectedElementBase {
  kind: 'label'
  text: string
}

export interface ProjectedDivider {
  kind: 'divider'
  id?: string
  label?: string
  x: number
  y0: number
  y1: number
}

export type ProjectedElement = ProjectedComposition | ProjectedMarker | ProjectedLabel | ProjectedDivider

export interface ProjectedConnection {
  id?: string
  kind?: string
  fromLineId: string
  toLineId: string
  /** Tipo de linha (`LineType`) de cada ponta — permite à camada de render acentuar
   *  visualmente conexões que tocam um tipo específico (ex.: "passagem"), sem
   *  precisar conhecer os ids das linhas. `projectConnection` sempre os popula;
   *  opcionais só para não obrigar fixtures de teste a declará-los. */
  fromLineType?: LineType
  toLineType?: LineType
  from: { x: number; y: number }
  to: { x: number; y: number }
}

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0
}

/** offset ausente/negativo/não-finito cai para 0 (mesma regra de `scale.ts`, não exportada de lá). */
function sanitizeOffset(offset: number | undefined): number {
  return isFiniteNonNegative(offset) ? offset : 0
}

/**
 * Posição local (at.from/at.to/atFrom/atTo) saneada e clampada em [0, length] — nunca "vaza" da
 * linha. `context`, quando passado, loga quando um valor PRESENTE precisou ser corrigido (inválido
 * ou fora do range) — não loga quando o valor está ausente (`undefined`), que é um caso normal do
 * contrato (ex.: `at.to` opcional), não uma anomalia.
 */
function sanitizeLocal(
  value: number | undefined,
  length: number,
  context?: { label: string; info?: Record<string, unknown> },
): number {
  const safeLength = isFiniteNonNegative(length) ? length : 0
  if (value === undefined) return 0

  const v = isFiniteNonNegative(value) ? value : 0
  const clamped = Math.min(v, safeLength)

  if (context && clamped !== value) {
    console.warn(`[train-yard/project] posição local saneada — ${context.label}`, {
      original: value,
      usado: clamped,
      lineLength: safeLength,
      ...context.info,
    })
  }

  return clamped
}

/** Y topológico: `hint.y` sobrescreve a fórmula de `order` quando presente. */
function computeLineY(line: Line): number {
  if (isFiniteNonNegative(line.hint?.y)) return line.hint!.y!
  const order = Number.isFinite(line.order) ? line.order : 0
  return Y_BASE + order * Y_SPACING
}

/** Divide `segWidth` em partes iguais, uma por unidade — o contrato não dá comprimento físico
 *  individual (ver `CompositionUnit`), então a única divisão possível é uniforme dentro do
 *  segmento (mesma lógica visual dos chips do Antes/Depois, que também não pesam por vagão). */
function projectUnits(units: CompositionUnit[], segStartX: number, segWidth: number): ProjectedUnit[] {
  const unitWidth = segWidth / units.length
  return units.map((unit, i) => ({ id: unit.id, kind: unit.kind, x: segStartX + i * unitWidth, width: unitWidth }))
}

function projectSegments(
  segments: Segment[],
  startX: number,
  scale: Scale,
  opts: ComputeScaleOptions,
): ProjectedSegment[] {
  let cursorX = startX
  return segments.map((seg) => {
    const width = toWidth(scale, seg.length, opts)
    const projected: ProjectedSegment = {
      kind: seg.kind,
      count: seg.count,
      x: cursorX,
      width,
      color: seg.color,
      detail: seg.detail,
      blocoId: seg.blocoId,
      blocoNome: seg.blocoNome,
      clusterId: seg.clusterId,
      units: seg.units?.length ? projectUnits(seg.units, cursorX, width) : undefined,
      incoming: seg.incoming,
    }
    cursorX += width
    return projected
  })
}

function projectElement(
  el: YardElement,
  offset: number,
  lineLength: number,
  y: number,
  scale: Scale,
  opts: ComputeScaleOptions,
  rawLineById: Map<string, Line>,
): ProjectedElement {
  const from = sanitizeLocal(el.at?.from, lineLength, {
    label: `elemento ${el.kind} (${el.id ?? 'sem id'}) — at.from`,
    info: { elementId: el.id, elementKind: el.kind },
  })

  if (el.kind === 'divider') {
    const targetLine = rawLineById.get(el.spanToLineId)
    if (!targetLine) {
      console.warn('[train-yard/project] divisor sem linha de destino — degradado para altura zero', {
        elementId: el.id,
        spanToLineId: el.spanToLineId,
      })
    }
    return {
      kind: 'divider',
      id: el.id,
      label: el.label,
      x: toX(scale, offset + from),
      y0: y,
      y1: targetLine ? computeLineY(targetLine) : y,
    }
  }

  if (el.kind === 'composition') {
    // `at.to` ausente (fora do contrato, mas payload pode chegar malformado): degrada para
    // composição de largura zero em `from` em vez de lançar/gerar NaN.
    const to =
      el.at?.to !== undefined
        ? sanitizeLocal(el.at.to, lineLength, {
            label: `composição ${el.id ?? 'sem id'} — at.to`,
            info: { elementId: el.id },
          })
        : from
    const startX = toX(scale, offset + from)
    const endX = toX(scale, offset + to)
    return {
      kind: 'composition',
      id: el.id,
      label: el.label,
      x: startX,
      y,
      width: Math.max(endX - startX, 0),
      segments: projectSegments(el.segments, startX, scale, opts),
      background: el.background,
    }
  }

  if (el.kind === 'marker') {
    return {
      kind: 'marker',
      id: el.id,
      variant: el.variant,
      label: el.label,
      x: toX(scale, offset + from),
      y,
    }
  }

  return {
    kind: 'label',
    id: el.id,
    text: el.text,
    x: toX(scale, offset + from),
    y,
  }
}

function projectLine(
  line: Line,
  scale: Scale,
  opts: ComputeScaleOptions,
  rawLineById: Map<string, Line>,
): ProjectedLine {
  const offset = sanitizeOffset(line.offset)
  const length = isFiniteNonNegative(line.length) ? line.length : 0
  const y = computeLineY(line)

  return {
    id: line.id,
    label: line.label,
    type: line.type,
    status: line.status ?? [],
    x: toX(scale, offset),
    y,
    width: toWidth(scale, length, opts),
    length,
    offset,
    path: line.hint?.path,
    elements: (line.elements ?? []).map((el) =>
      projectElement(el, offset, length, y, scale, opts, rawLineById),
    ),
  }
}

/**
 * Resolve o ponto de uma `Connection` ao longo de uma linha já projetada.
 *
 * Fallback quando `atFrom`/`atTo` estão AUSENTES: usa o fim da linha (`line.length`). Isto é uma
 * degradação visual de compatibilidade, não a semântica real — ver
 * `docs/contracts/yard-topology.md` seção "Aberto para o time de domínio": o dado que o backend
 * deveria trafegar é a posição real do aparelho de mudança de via. Quando o valor está PRESENTE
 * mas é inválido (não-finito/negativo), cai em 0 (saneamento padrão), não no fim da linha — um
 * valor malformado não é a mesma coisa que um valor ausente.
 */
function resolveConnectionPoint(at: number | undefined, line: ProjectedLine, connId: string): number {
  if (at === undefined) {
    console.warn('[train-yard/project] troca de faixa sem posição — usando fim da linha (fallback)', {
      connectionId: connId,
      lineId: line.id,
      lineLength: line.length,
    })
    return sanitizeLocal(line.length, line.length)
  }
  return sanitizeLocal(at, line.length, {
    label: `troca de faixa ${connId} — posição em ${line.id}`,
    info: { connectionId: connId, lineId: line.id },
  })
}

function projectConnection(
  conn: Connection,
  lineMap: Map<string, ProjectedLine>,
  scale: Scale,
): ProjectedConnection | null {
  const connId = conn.id ?? `${conn.fromLineId}->${conn.toLineId}`
  const fromLine = lineMap.get(conn.fromLineId)
  const toLine = lineMap.get(conn.toLineId)
  if (!fromLine || !toLine) {
    // id inexistente: descarta a conexão, não quebra o render — mas registra
    // a anomalia (payload do backend referenciando uma linha que não existe).
    console.warn('[train-yard/project] troca de faixa descartada — linha inexistente', {
      connectionId: connId,
      fromLineId: conn.fromLineId,
      toLineId: conn.toLineId,
      fromLineFound: Boolean(fromLine),
      toLineFound: Boolean(toLine),
    })
    return null
  }

  const atFrom = resolveConnectionPoint(conn.atFrom, fromLine, connId)
  const atTo = resolveConnectionPoint(conn.atTo, toLine, connId)

  return {
    id: conn.id,
    kind: conn.kind,
    fromLineId: conn.fromLineId,
    toLineId: conn.toLineId,
    fromLineType: fromLine.type,
    toLineType: toLine.type,
    from: { x: toX(scale, fromLine.offset + atFrom), y: fromLine.y },
    to: { x: toX(scale, toLine.offset + atTo), y: toLine.y },
  }
}

/**
 * `order` é usado como valor ARITMÉTICO em `computeLineY` (`Y = Y_BASE + order * Y_SPACING`),
 * não como rank — um furo na sequência (ex.: 1, 2, 10) produz espaçamento vertical desproporcional
 * entre essas linhas, mesmo a ordem relativa estando correta. Contrato exige `order` denso/
 * sequencial (ver `docs/contracts/yard-topology.md`); o front não reordena/normaliza, só alerta.
 * Linhas com `hint.y` explícito não usam `order` para Y — excluídas da checagem.
 */
function warnOnOrderGaps(lines: Line[]): void {
  const orders = [...new Set(lines.filter((line) => !isFiniteNonNegative(line.hint?.y)).map((line) => line.order))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b)

  for (let i = 1; i < orders.length; i++) {
    const gap = orders[i] - orders[i - 1]
    if (gap > 1) {
      console.warn('[train-yard/project] furo na sequência de `order` — espaçamento vertical desproporcional', {
        orderAnterior: orders[i - 1],
        orderSeguinte: orders[i],
        furo: gap - 1,
      })
    }
  }
}

function computeViewBoxHeight(lines: Line[]): number {
  if (lines.length === 0) return Y_BASE * 2
  const maxY = Math.max(...lines.map(computeLineY))
  return maxY + Y_BASE
}

/** Projeta a topologia do contrato em coordenadas de desenho (viewBox), prontas para a camada de render. */
export function project(topology: YardTopology, opts: ProjectOptions): ProjectedScene {
  console.log('[train-yard/project] projetando topologia', {
    yardId: topology.yardId,
    updatedAt: topology.updatedAt,
    lineCount: topology.lines?.length ?? 0,
    connectionCount: topology.connections?.length ?? 0,
    opts,
  })

  const scale = computeScale(topology, opts)
  const lines = topology.lines ?? []
  warnOnOrderGaps(lines)
  const rawLineById = new Map(lines.map((line) => [line.id, line]))

  const projectedLines = lines.map((line) => projectLine(line, scale, opts, rawLineById))
  const lineMap = new Map(projectedLines.map((line) => [line.id, line]))

  const connections = (topology.connections ?? [])
    .map((conn) => projectConnection(conn, lineMap, scale))
    .filter((conn): conn is ProjectedConnection => conn !== null)

  const scene: ProjectedScene = {
    viewBoxWidth: opts.trackAreaWidth + opts.labelGutterWidth + RIGHT_EDGE_MARGIN,
    viewBoxHeight: computeViewBoxHeight(lines),
    labelGutterWidth: opts.labelGutterWidth,
    lines: projectedLines,
    connections,
  }

  const discardedConnections = (topology.connections?.length ?? 0) - connections.length
  console.log('[train-yard/project] cena projetada', {
    yardId: topology.yardId,
    viewBoxWidth: scene.viewBoxWidth,
    viewBoxHeight: scene.viewBoxHeight,
    linesRendered: scene.lines.length,
    connectionsRendered: scene.connections.length,
    connectionsDiscarded: discardedConnections,
  })

  return scene
}
