import type { LineType, YardTopology } from './types'

// Núcleo puro de escala do mapa topológico. Eixo X à escala real (fiel), eixo Y é
// topológico/ordinal e não é tratado aqui (ver project.ts). Sem React, sem I/O.

/** Fator global de conversão unidade-do-contrato → unidades de viewBox, mais os dados de origem/span usados para derivá-lo. */
export interface Scale {
  s: number
  minOffset: number
  span: number
}

export interface ComputeScaleOptions {
  /** Largura útil em unidades de viewBox reservada às linhas (exclui calha de rótulo). */
  trackAreaWidth: number
  /** Largura mínima de render em unidades de viewBox; default ~2.5. */
  minRenderWidth?: number
}

const DEFAULT_MIN_RENDER_WIDTH = 2.5
// Span mínimo de fallback quando o pátio não tem nenhuma linha válida — evita s=Infinity/NaN.
const FALLBACK_SPAN = 1

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0
}

/** offset ausente/negativo/não-finito cai para 0 (origem comum segura). */
function sanitizeOffset(offset: number | undefined): number {
  return isFiniteNonNegative(offset) ? offset : 0
}

export function computeScale(topology: YardTopology, opts: ComputeScaleOptions): Scale {
  const lines = topology.lines ?? []
  const declaredOrigin = topology.scale?.originOffset
  const declaredSpan = topology.scale?.span

  let minOffset = Infinity
  let maxEnd = -Infinity

  for (const line of lines) {
    // length inválido (não-finito ou negativo) exclui a linha do cálculo de span.
    if (!isFiniteNonNegative(line.length)) {
      console.warn('[train-yard/scale] linha com length inválido, excluída do cálculo de escala', {
        lineId: line.id,
        length: line.length,
      })
      continue
    }

    const offset = sanitizeOffset(line.offset)
    const end = offset + line.length

    if (offset < minOffset) minOffset = offset
    if (end > maxEnd) maxEnd = end
  }

  // `originOffset`/`span` declarados no contrato são a verdade absoluta do pátio — preferidos
  // sobre o cálculo a partir das linhas presentes, que é só um fallback (payload parcial/filtrado
  // não deveria mudar a régua de escala nem a origem X de linhas que não mudaram). Fallback de
  // `span` usa o `minOffset` CALCULADO das linhas, nunca o `originOffset` declarado — os dois
  // fallbacks são independentes, um declarado sem o outro não deve contaminar o cálculo do que
  // ficou ausente.
  const computedMinOffset = minOffset
  let span = isFiniteNonNegative(declaredSpan) && declaredSpan > 0 ? declaredSpan : maxEnd - computedMinOffset
  if (isFiniteNonNegative(declaredOrigin)) minOffset = declaredOrigin

  if (!Number.isFinite(span) || span <= 0) {
    console.warn('[train-yard/scale] nenhuma linha válida para calcular o span do pátio — usando fallback', {
      lineCount: lines.length,
      fallbackSpan: FALLBACK_SPAN,
    })
    span = FALLBACK_SPAN
    minOffset = 0
  }

  const trackAreaWidth = isFiniteNonNegative(opts.trackAreaWidth) ? opts.trackAreaWidth : 0
  const s = trackAreaWidth / span

  console.log('[train-yard/scale] escala calculada', {
    s,
    minOffset,
    span,
    trackAreaWidth,
    lineCount: lines.length,
  })

  return { s, minOffset, span }
}

/** Posição u (unidade do contrato) → X relativo ao início da área de linhas. u inválido (não-finito/negativo) vira 0. */
export function toX(scale: Scale, u: number): number {
  if (!isFiniteNonNegative(u)) return 0
  return (u - scale.minOffset) * scale.s
}

/** Comprimento u → largura em X. Abaixo do mínimo de legibilidade, sacrifica fidelidade e usa o mínimo. */
export function toWidth(scale: Scale, u: number, opts?: ComputeScaleOptions): number {
  if (!isFiniteNonNegative(u)) return 0

  const minRenderWidth = opts?.minRenderWidth ?? DEFAULT_MIN_RENDER_WIDTH
  const width = u * scale.s

  return width < minRenderWidth ? minRenderWidth : width
}

/**
 * `scaleFactor` (metros por unidade de desenho) é distinto de `Scale.s` (fator de RENDER,
 * viewBox/unidade): aqui é o dado de domínio para exibir a régua real ao usuário. `YardScale.
 * scaleFactor` (default do pátio) vem ausente exatamente quando a razão NÃO é uniforme entre
 * linhas (ver types.ts) — por isso não dá pra ler um valor único "no global": cada linha pode
 * sobrescrever via `line.scaleFactor`, e é preciso resolver linha a linha e comparar.
 */
export type ResolvedScaleFactor =
  | { kind: 'uniform'; value: number }
  | { kind: 'mixed'; values: number[] }
  | { kind: 'unknown' }

/** Fator efetivo de uma linha: override da própria linha, senão o default do pátio. */
function effectiveLineScaleFactor(line: { scaleFactor?: number }, yardDefault: number | undefined): number | undefined {
  const value = line.scaleFactor ?? yardDefault
  return isFiniteNonNegative(value) && value > 0 ? value : undefined
}

/** Resolve o(s) scaleFactor(s) reais do pátio, linha a linha — nunca só o campo global do contrato. */
export function resolveScaleFactor(topology: YardTopology): ResolvedScaleFactor {
  const yardDefault = topology.scale?.scaleFactor
  const lines = topology.lines ?? []

  const values = new Set<number>()
  for (const line of lines) {
    const value = effectiveLineScaleFactor(line, yardDefault)
    if (value !== undefined) values.add(value)
  }

  if (values.size === 0) return { kind: 'unknown' }
  if (values.size === 1) return { kind: 'uniform', value: [...values][0] }
  return { kind: 'mixed', values: [...values].sort((a, b) => a - b) }
}

export interface LineScaleFactorRef {
  id: string
  label: string
  type: LineType
  /** comprimento em unidade de desenho (o dado real que TEMOS mesmo sem `scaleFactor` — a linha
   *  foi desenhada a partir dele; nunca "nenhuma informação"). Saneado como em `computeScale`. */
  length: number
}

export interface LineScaleFactorGroup {
  /** `null` = linha sem fator resolvível (nem override, nem default do pátio). */
  value: number | null
  lines: LineScaleFactorRef[]
}

/**
 * Agrupa as linhas por fator efetivo — base da modal de detalhe: lista achatada
 * (uma linha do contrato por linha da UI) cresce demais com pátios grandes, então
 * a UI mostra por GRUPO de valor, com as linhas daquele grupo identificadas dentro.
 * Ordenado por valor crescente; grupo `null` (sem fator) sempre por último.
 */
export function groupLinesByScaleFactor(topology: YardTopology): LineScaleFactorGroup[] {
  const yardDefault = topology.scale?.scaleFactor
  const lines = topology.lines ?? []

  const groups = new Map<number | null, LineScaleFactorRef[]>()
  for (const line of lines) {
    const value = effectiveLineScaleFactor(line, yardDefault) ?? null
    const bucket = groups.get(value) ?? []
    bucket.push({
      id: line.id,
      label: line.label,
      type: line.type,
      length: isFiniteNonNegative(line.length) ? line.length : 0,
    })
    groups.set(value, bucket)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === null) return 1
      if (b === null) return -1
      return a - b
    })
    .map(([value, groupLines]) => ({ value, lines: groupLines }))
}
