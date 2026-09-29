import { ELEMENT_KIND_LABELS, LINE_TYPE_LABELS, MARKER_VARIANT_LABELS, STATUS_LABELS } from '../legendCatalog'
import type { Line, YardElement, YardTopology } from './types'

// Filtro interativo da legenda: cada categoria (tipo de linha, status, marcador, kind de
// elemento) guarda um mapa chave→visível. Chave ausente é tratada como visível (`!== false`) —
// assim variantes novas que ainda não têm entrada no catálogo (ver `legendCatalog.ts`) aparecem
// por padrão, sem exigir que este filtro seja atualizado toda vez que o contrato ganha um valor
// novo.
export interface LegendFilterState {
  lineTypes: Record<string, boolean>
  lineStatuses: Record<string, boolean>
  markerVariants: Record<string, boolean>
  elementKinds: Record<string, boolean>
}

function only(labels: Record<string, string>, keysOn: string[]): Record<string, boolean> {
  const onSet = new Set(keysOn)
  return Object.fromEntries(Object.keys(labels).map((key) => [key, onSet.has(key)]))
}

/**
 * Estado inicial da legenda ao abrir o mapa — só o necessário pra leitura rápida do pátio:
 * linhas de controle (pátio/CCO), interdição, composições (trem/vagões) e ETA prevista; todo o
 * resto começa desligado. Decisão de produto pra já iniciar numa visão limpa, não uma restrição
 * técnica: o operador liga o que quiser individualmente a qualquer momento em `LegendChips.tsx`
 * (inclui "Mostrar tudo"/"Ocultar tudo" pra ajuste em lote). Independente do zoom semântico
 * (`ZOOM_SEMANTICO_LIMIAR`/`DETAIL_MARKER_VARIANTS`) — são dois filtros ortogonais.
 */
export function createEssentialLegendFilter(): LegendFilterState {
  return {
    lineTypes: only(LINE_TYPE_LABELS, ['controle-patio', 'controle-cco']),
    lineStatuses: only(STATUS_LABELS, ['interditada']),
    markerVariants: only(MARKER_VARIANT_LABELS, ['eta']),
    elementKinds: only(ELEMENT_KIND_LABELS, ['composition']),
  }
}

/** Quais chaves de cada categoria têm pelo menos 1 elemento de fato no pátio — ver
 *  `computeLegendPresence`. */
export interface LegendPresence {
  lineTypes: Set<string>
  lineStatuses: Set<string>
  markerVariants: Set<string>
  elementKinds: Set<string>
}

/**
 * Varre a topologia BRUTA (sempre a original, nunca a já filtrada pela legenda — senão desligar
 * um item o faria sumir da própria legenda, sem jeito de religar) e devolve quais chaves de cada
 * categoria aparecem em pelo menos 1 linha/elemento. `LegendChips.tsx` usa isso pra não listar
 * categorias que essa instância do pátio simplesmente não tem (ex.: EHT não tem nenhuma linha
 * "Recebimento" nem marcador "AMV de mola") — item sem nenhum dado real nunca vai aparecer no
 * mapa mesmo ligado, então não faz sentido ocupar espaço na legenda. Não tem relação com zoom
 * semântico: um marcador de detalhe ausente por zoom (`DETAIL_MARKER_VARIANTS`) ainda TEM dado
 * real no pátio, então continua listado (com o aviso de zoom, ver `Chip`).
 */
export function computeLegendPresence(topology: YardTopology): LegendPresence {
  const lineTypes = new Set<string>()
  const lineStatuses = new Set<string>()
  const markerVariants = new Set<string>()
  const elementKinds = new Set<string>()

  for (const line of topology.lines ?? []) {
    lineTypes.add(line.type)
    for (const status of line.status ?? []) lineStatuses.add(status)
    for (const el of line.elements ?? []) {
      if (el.kind === 'marker') markerVariants.add(el.variant)
      else elementKinds.add(el.kind)
    }
  }

  return { lineTypes, lineStatuses, markerVariants, elementKinds }
}

/** "Mostrar tudo" / "Ocultar tudo" — aplica o mesmo valor a toda categoria conhecida hoje. */
export function setAllLegendFilter(filter: LegendFilterState, visible: boolean): LegendFilterState {
  const setAll = (rec: Record<string, boolean>) => Object.fromEntries(Object.keys(rec).map((key) => [key, visible]))
  return {
    lineTypes: setAll(filter.lineTypes),
    lineStatuses: setAll(filter.lineStatuses),
    markerVariants: setAll(filter.markerVariants),
    elementKinds: setAll(filter.elementKinds),
  }
}

function filterElements(
  elements: YardElement[] | undefined,
  markerVariants: Record<string, boolean>,
  elementKinds: Record<string, boolean>,
  forcedVisibleMarkerId: string | undefined,
): YardElement[] | undefined {
  if (!elements) return elements
  // `marker` tem entrada própria por variante (ver MARKER_VARIANT_LABELS); `composition` tem
  // sua própria entrada de kind (ver ELEMENT_KIND_LABELS) — rótulo e divisor não são afetados
  // pelo filtro, sempre passam (estrutura de layout, não informação operacional).
  return elements.filter((el) => {
    if (el.kind === 'marker') return el.id === forcedVisibleMarkerId || markerVariants[el.variant] !== false
    if (el.kind === 'composition') return elementKinds.composition !== false
    return true
  })
}

function filterLine(line: Line, filter: LegendFilterState, forcedVisibleMarkerId: string | undefined): Line {
  return {
    ...line,
    status: line.status?.filter((status) => filter.lineStatuses[status] !== false),
    elements: filterElements(line.elements, filter.markerVariants, filter.elementKinds, forcedVisibleMarkerId),
  }
}

/**
 * Aplica o filtro da legenda sobre a topologia ANTES de projetar (`project()`, em `project.ts`).
 * Uma linha cujo tipo foi desligado some por completo — `project()` já descarta com segurança
 * (`console.warn`, sem quebrar) qualquer `Connection` que apontava para ela. Status e variantes de
 * marcador desligados só removem o overlay/elemento específico; a linha em si permanece.
 *
 * `forcedVisibleMarkerId` (2026-09-22, pedido explícito do usuário): o marcador do AMV em
 * manipulação AGORA (`amvAtivoDoPassoJ105`, `visualJ105.ts`) precisa aparecer no mapa mesmo com a
 * categoria "AMV manual" desligada na legenda — ligar a categoria inteira mostraria TODOS os AMVs
 * do pátio, não só o citado no passo selecionado ("deve aparecer somente o AMV que está sendo
 * citado, não todos"). Só esse ÚNICO id furta o filtro de variante; os demais marcadores da mesma
 * variante continuam obedecendo a legenda normalmente.
 */
export function filterTopology(topology: YardTopology, filter: LegendFilterState, forcedVisibleMarkerId?: string): YardTopology {
  const lines = topology.lines
    .filter((line) => filter.lineTypes[line.type] !== false)
    .map((line) => filterLine(line, filter, forcedVisibleMarkerId))
  return { ...topology, lines }
}
