// Mapas de estilo por domínio (tipo de linha, status, segmento de composição).
// Decisão explícita: objetos-literais simples, sem registry/classe — hoje só 2
// kinds de elemento (Line, Segment) renderizam, abaixo do gatilho de "3+ usos
// idênticos" para abstração. Cores em hex direto (não tokens de UI geral):
// são identidade visual de domínio do mapa de pátio, herdada do SVG legado
// em `trackData.ts`.

import type { LineStatus, LineType, Segment } from './types'

export interface LineTypeStyle {
  fill: string
  border: string
  labelColor: string
  labelFontWeight: number
  dashArray?: string
  /** Dasharray do TRILHO CENTRAL, quando distinto do `dashArray` da banda externa
   *  (ex.: "passagem" usa um tracejado mais curto no trilho central). Ausente =
   *  trilho central sólido (ver `render/Line.tsx`). */
  centerRailDashArray?: string
  /** Tamanho de fonte do rótulo da linha, em unidades de viewBox; fallback 12 (ver `resolveLabelFontSize`). */
  labelFontSize?: number
  /** Altura da banda de trilho, em unidades de viewBox; fallback 9 (ver `render/Line.tsx`). */
  trackHeight?: number
}

export interface StatusOverlay {
  fill: string
  hachureStroke: string
  borderColor: string
  /** Z-order para composição em camadas quando múltiplos status coexistem. Maior = por cima. */
  precedence: number
}

// --- LineType -------------------------------------------------------------

// Cores via `var(--vli-map-*)` (definidos em `theme.css`, junto dos `--vli-track-*` que já
// existiam pro board estático antigo) — mesma cor de domínio nos dois temas, só a luminosidade
// muda (dark: fill escuro/traço-texto claro; light: fill claro/traço-texto escuro) pra manter
// contraste em fundo claro ou escuro. Antes disso os hex vinham fixos aqui (herdados do
// protótipo isolado, que nunca teve light mode) — por isso a legenda/mapa ficavam sempre
// escuros mesmo no tema claro do app.
export const LINE_TYPE_STYLES: Record<string, LineTypeStyle> = {
  // Linha padrão de pátio (livre) — mesma paleta das faixas L1/L2/L5/L6/L7 do protótipo.
  carga: {
    fill: 'var(--vli-map-navy-fill)',
    border: 'var(--vli-map-navy-border)',
    labelColor: 'var(--vli-map-navy-label)',
    labelFontWeight: 600,
    labelFontSize: 12,
  },
  // Linha de passagem (LP/L8) — estilo "transit", tracejado longo na banda externa
  // e um tracejado mais curto no trilho central.
  passagem: {
    fill: 'var(--vli-map-blue-fill)',
    border: 'var(--vli-map-blue-border)',
    labelColor: 'var(--vli-map-blue-label)',
    labelFontWeight: 500,
    labelFontSize: 10,
    dashArray: '18 5',
    centerRailDashArray: '14 4',
  },
  // Faixas de recebimento (EVS1/EVS2) — mesma paleta de "carga", rótulo menor,
  // banda mais alta (12 vs. 9 do padrão) — igual às faixas EVS do protótipo.
  recebimento: {
    fill: 'var(--vli-map-navy-fill)',
    border: 'var(--vli-map-navy-border)',
    labelColor: 'var(--vli-map-navy-label)',
    labelFontWeight: 600,
    labelFontSize: 10,
    trackHeight: 12,
  },
  // Linha divisória do CCO — renderizada como <line> tracejada fina, sem banda de
  // trilho e sem rótulo próprio (ver render/Line.tsx); fill/labelColor abaixo não
  // chegam a ser desenhados, mantidos só para satisfazer o shape de LineTypeStyle.
  cco: {
    fill: 'var(--vli-map-navy-fill)',
    border: 'var(--vli-map-slate-border)',
    labelColor: 'var(--vli-map-slate-label)',
    labelFontWeight: 400,
    dashArray: '10 5',
  },
  // Ramal/rabicho (ex.: rabicho da linha 7) — destaque em amarelo, mesma
  // identidade do roteamento especial visto no protótipo de referência.
  ramal: {
    fill: 'var(--vli-map-gold-fill)',
    border: 'var(--vli-map-gold-border)',
    labelColor: 'var(--vli-map-yellow-strong)',
    labelFontWeight: 500,
    labelFontSize: 10,
  },
  // As 4 entradas abaixo vêm da legenda oficial (2026-07-22): cada linha real carrega UM
  // desses 4 valores via cor, nunca 2 ao mesmo tempo. Relação com carga/passagem/recebimento/cco
  // (acima, eixo semântico do ADR-007) e com `ramal` (abaixo, já existente) NÃO confirmada com o
  // domínio — cores parecidas (ex.: bitola-metrica vs ramal, ambos amarelos) podem ser o mesmo
  // conceito ou não; não fundir sem pedido explícito.
  // Neutralizado em 2026-08-25 (feedback: o verde-água/turquesa original brigava com o azul dos
  // destaques de clique — pino/trajeto da composição e da etapa Parada, ver `Composition.tsx`/
  // `EtapaParadaLayer.tsx`). Cinza PURO (`--vli-map-gray-*`, R=G=B, sem matiz de azul nenhum —
  // ajustado 2026-08-25: a primeira tentativa usou "navy"/"slate", que ainda liam como azul) — o
  // pátio real (`mocks/eht.ts`) só usa `controle-patio`/`controle-cco`, então essa troca já
  // neutraliza toda linha visível hoje. Vermelho (`STATUS_OVERLAYS.interditada`) continua
  // intocado — pedido explícito de manter. `labelFontWeight` IGUAL ao de `controle-cco` — 2026-08-27,
  // pedido explícito do usuário, com print mostrando os rótulos das linhas do pátio: "aqui parece
  // q tem fontes mais grossas e mais finas. deixe todas no padrão da L Desvio e L Principal mesmo.
  // sem mudar o padrão" — revoga a distinção de peso por tipo (cco "tronco" mais forte que patio)
  // que existia antes; agora os dois tipos usam o MESMO peso, único jeito de garantir que TODA
  // linha do pátio (que só usa esses dois tipos) fique visualmente consistente.
  'controle-patio': {
    fill: 'var(--vli-map-gray-fill)',
    border: 'var(--vli-map-gray-border)',
    labelColor: 'var(--vli-map-gray-label)',
    labelFontWeight: 700,
    labelFontSize: 10,
  },
  'controle-cco': {
    fill: 'var(--vli-map-gray-fill)',
    border: 'var(--vli-map-gray-border)',
    labelColor: 'var(--vli-map-gray-label)',
    labelFontWeight: 700,
    labelFontSize: 10,
  },
  'bitola-metrica': {
    fill: 'var(--vli-map-gold-fill)',
    border: 'var(--vli-map-yellow-strong)',
    labelColor: 'var(--vli-map-yellow-strong)',
    labelFontWeight: 500,
    labelFontSize: 10,
  },
  'bitola-larga': {
    fill: 'var(--vli-map-green-fill)',
    border: 'var(--vli-map-green-border)',
    labelColor: 'var(--vli-map-green-label)',
    labelFontWeight: 500,
    labelFontSize: 10,
  },
  // Fallback para tipos desconhecidos/novos vindos do backend.
  default: {
    fill: 'var(--vli-map-navy-fill)',
    border: 'var(--vli-map-navy-border)',
    labelColor: 'var(--vli-map-default-label)',
    labelFontWeight: 500,
  },
}

// --- LineStatus -------------------------------------------------------------

// Chave tipada como string aberta (LineStatus | string): hoje só 'interditada'
// é real, mas a estrutura precisa suportar novos status sem quebrar o contrato.
export const STATUS_OVERLAYS: Record<string, StatusOverlay> = {
  interditada: {
    fill: 'var(--vli-map-red-fill)',
    hachureStroke: 'var(--vli-map-red-border)',
    borderColor: 'var(--vli-map-red-border)',
    precedence: 10,
  },
  // Linha com restrição de uso (hoje só o Terminal da Ferradura no J105 V2, ver
  // `marcarRestricaoFerradura`) — a MESMA faixa de sempre, só que vermelha: sem hachura (isso é
  // "interditada"), pedido explícito do usuário, 2026-09-24: "era só a linha normal, mas vermelha".
  // Tratada à parte em `Line.tsx` (recolore a banda em vez de sobrepor um overlay translúcido).
  restrita: {
    fill: 'var(--vli-map-red-fill)',
    hachureStroke: 'var(--vli-map-red-border)',
    borderColor: 'var(--vli-map-red-border)',
    precedence: 5,
  },
  default: {
    fill: 'var(--vli-map-red-fill)',
    hachureStroke: 'var(--vli-map-red-border)',
    borderColor: 'var(--vli-map-red-strong)',
    precedence: 0,
  },
}

// --- Segment['kind'] --------------------------------------------------------

export const SEGMENT_COLORS: Record<string, string> = {
  locomotiva: 'var(--vli-map-segment-locomotiva)',
  vagao: 'var(--vli-map-segment-vagao)',
  default: 'var(--vli-map-segment-default)',
}

export interface SegmentBlockStyle {
  fill: string
  border: string
  /** Cor do número de unidades centralizado no bloco (ver `Composition.tsx`). */
  text: string
}

// Estilo dos blocos coloridos da composição segmentada sobre a linha (`Composition.tsx`) — cada
// bloco é UM segmento (locomotiva(s) agrupadas ou vagões agrupados), não um retângulo por
// veículo. "locomotiva" usa a paleta terracota "visão topológica / trens / locomotiva" (único
// tom quente do motor de mapa, de propósito — destaca a cabeça do trem). "vagao" usa
// `--vli-map-segment-vagao` (fill) + `--vli-map-segment-vagao-border` (borda dedicada, mais
// escura que o fill nos dois temas — pedido explícito de cor pro light mode: #80B6CD/#3B7C96).
export const SEGMENT_BLOCK_STYLES: Record<string, SegmentBlockStyle> = {
  locomotiva: {
    fill: 'var(--vli-map-trem-locomotiva-bg)',
    border: 'var(--vli-map-trem-locomotiva-border)',
    text: 'var(--vli-map-trem-locomotiva-text)',
  },
  vagao: {
    fill: 'var(--vli-map-segment-vagao)',
    border: 'var(--vli-map-segment-vagao-border)',
    text: 'var(--vli-map-segment-vagao-text)',
  },
  default: {
    fill: 'var(--vli-map-segment-default)',
    border: 'var(--vli-map-neutral-light)',
    text: 'var(--vli-map-segment-vagao-text)',
  },
}

// Rótulo PT-BR (com pluralização) para o fallback textual do popover de segmento
// (`Composition.tsx`) — o `kind` do contrato é vocabulário de domínio (ver
// `Segment['kind']` em `types.ts`), nunca exibido cru na UI.
interface SegmentKindLabel { singular: string; plural: string }

export const SEGMENT_KIND_LABELS: Record<string, SegmentKindLabel> = {
  locomotiva: { singular: 'locomotiva', plural: 'locomotivas' },
  vagao: { singular: 'vagão', plural: 'vagões' },
}

// --- Resolvers ---------------------------------------------------------------

function warnUnknown(domain: string, key: string): void {
  if (import.meta.env.DEV) {
    console.warn(`[train-yard/styles] valor desconhecido para ${domain}: "${key}" — usando default`)
  }
}

export function resolveLineTypeStyle(type: LineType | string): LineTypeStyle {
  const style = LINE_TYPE_STYLES[type]
  if (style) return style
  warnUnknown('LineType', type)
  return LINE_TYPE_STYLES.default
}

export function resolveStatusOverlay(status: LineStatus | string): StatusOverlay {
  const overlay = STATUS_OVERLAYS[status]
  if (overlay) return overlay
  warnUnknown('LineStatus', status)
  return STATUS_OVERLAYS.default
}

export function resolveSegmentColor(kind: Segment['kind'] | string): string {
  const color = SEGMENT_COLORS[kind]
  if (color) return color
  warnUnknown('Segment.kind', kind)
  return SEGMENT_COLORS.default
}

/** Estilo (fill/border/text) do bloco colorido de um segmento — ver `SEGMENT_BLOCK_STYLES`. */
export function resolveSegmentBlockStyle(kind: Segment['kind'] | string): SegmentBlockStyle {
  const style = SEGMENT_BLOCK_STYLES[kind]
  if (style) return style
  warnUnknown('Segment.kind', kind)
  return SEGMENT_BLOCK_STYLES.default
}

/**
 * Rótulo PT-BR do `kind` de um segmento, pluralizado por `count` — usado no
 * fallback textual do popover quando não há `detail` por veículo. `kind`
 * desconhecido (fora do vocabulário do domínio) cai no valor cru — mesma
 * postura de "não inventar tradução" adotada para `LineType`/`LineStatus`.
 */
export function resolveSegmentKindLabel(kind: Segment['kind'] | string, count: number): string {
  const entry = SEGMENT_KIND_LABELS[kind]
  if (!entry) {
    warnUnknown('Segment.kind (rótulo)', kind)
    return kind
  }
  return count === 1 ? entry.singular : entry.plural
}
