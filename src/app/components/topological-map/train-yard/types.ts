// YardTopology é o shape MESCLADO que `project()` consome (ver ADR-011) — reconstruído por
// `mergeYardLayers(map, status, elements)` a partir das 3 camadas abaixo. Não é mais o shape
// que trafega em rede: quem trafega em rede são `YardMap`/`YardStatus`/`YardElements`.
export interface YardTopology {
  yardId: string
  updatedAt: string                 // ISO — staleness, dedup de polling
  scale?: YardScale                  // parâmetros de escala vindos do contrato
  lines: Line[]
  connections?: Connection[]         // trocas de faixa — dinâmicas e posicionadas
}

// Camada 1 — Mapa: estrutura física do pátio (linhas, tipo, ordem, comprimento). Muda por obra/
// replanejamento físico, não por operação — sem polling, busca única no mount (ver ADR-011).
// GET /api/yards/:yardId/map
export interface YardMap {
  yardId: string
  name?: string                      // nome de exibição do pátio (ex.: "Pátio Eldorado"); cabeçalho do dashboard
  code?: string                      // código curto de exibição (ex.: "EHT"); cabeçalho do dashboard
  updatedAt: string
  scale?: YardScale
  lines: Array<Pick<Line, 'id' | 'label' | 'type' | 'order' | 'length' | 'offset' | 'hint' | 'scaleFactor'>>
}

// Camada 2 — Manobras/status: dinâmico, muda por operação (interdição, troca de linha).
// `connections` mudou de dono: saiu de `YardTopology`/mapa (era estrutura estática na v1) e
// passa a viver aqui, porque uma troca de faixa é estado operacional, não estrutura física
// (ver ADR-011). Polling parametrizável via VITE_YARD_STATUS_POLL_MS.
// GET /api/yards/:yardId/status
export interface YardStatus {
  yardId: string
  updatedAt: string
  lineStatus: Record<string /* Line['id'] */, LineStatus[]>
  connections?: Connection[]
}

// Camada 3 — Elementos: dinâmico, muda por operação (composição chega/sai, marcador aparece).
// Polling parametrizável via VITE_YARD_ELEMENTS_POLL_MS (independente da camada de status).
// GET /api/yards/:yardId/elements
export interface YardElements {
  yardId: string
  updatedAt: string
  elementsByLine: Record<string /* Line['id'] */, YardElement[]>
}

export interface YardScale {
  unit?: string                      // unidade do desenho de origem (informativa; front é agnóstico de unidade)
  originId?: string                  // origem comum (throat); default: menor offset
  // originOffset/span: verdade ABSOLUTA do pátio, independente de quais linhas estão no payload
  // atual. Sem eles, o fator de escala e a origem X são calculados a partir do min-offset/
  // max-end das linhas PRESENTES — instável: um payload parcial (ou uma linha removida/filtrada)
  // muda a régua de "100%" e a posição de TODAS as linhas, mesmo as que não mudaram seus próprios
  // dados.
  originOffset?: number              // offset absoluto que mapeia para X=0; default: menor offset das linhas presentes
  span?: number                      // extensão total real do pátio, mesma unidade de offset/length; default: maior extensão das linhas presentes
  scaleFactor?: number               // metros por unidade de desenho, default do pátio — ausente quando a razão não é uniforme entre linhas
}

export interface Line {
  id: string                         // id de máquina estável
  label: string                      // rótulo OPACO ("L3 (765)"); front não parseia — "765" é a
                                      // extensão útil da linha em metros, só para leitura humana
                                      // (legenda oficial "L(999) Linha e extensão útil")
  type: LineType
  order: number                      // Y topológico (ordinal, espaçamento fixo)
  length: number                     // comprimento em unidade de desenho — dirige a escala X
  offset?: number                    // posição do início desde a origem comum; default 0
  status?: LineStatus[]              // só os reais; 0..N empilhável
  elements?: YardElement[]
  hint?: LayoutHint
  scaleFactor?: number               // sobrescreve YardScale.scaleFactor só nesta linha; metros = length * scaleFactor
}

// 'controle-patio'/'controle-cco'/'bitola-metrica'/'bitola-larga' vêm da legenda oficial
// (2026-07-22) — cada linha carrega UM desses 4 valores via cor (nunca 2 ao mesmo tempo).
// RESOLVIDO em 2026-07-27 (ver manobra-x-bff/docs/adr/yard-digitizer/ADR-YD-003): é o MESMO
// eixo de 'carga'/'passagem'/'recebimento'/'cco' (eixo original do ADR-007) — o eixo antigo
// estava simplesmente errado, não são dimensões distintas. Segue listado aqui só porque fixtures
// não migradas (`legacy`, `eldorado`) ainda usam os valores antigos; novas fixtures usam sempre
// o eixo confirmado. Ver docs/contracts/yard-topology.md, seção `LineType`.
export type LineType =
  | 'carga'
  | 'passagem'
  | 'recebimento'
  | 'cco'
  | 'controle-patio'
  | 'controle-cco'
  | 'bitola-metrica'
  | 'bitola-larga'
  | (string & {})
export type LineStatus = 'interditada' | (string & {})   // não inventar; base = sem status

export interface Connection {
  id?: string
  fromLineId: string
  toLineId: string
  atFrom?: number                    // posição ao longo da fromLine (unidade do contrato)
  atTo?: number                      // posição ao longo da toLine
  kind?: string
}

export type YardElement = CompositionElement | MarkerElement | LabelElement | DividerElement

interface ElementBase { id?: string; at: { from: number; to?: number } }

export interface CompositionElement extends ElementBase {
  kind: 'composition'
  label?: string
  segments: Segment[]                // blocos em sequência, à escala; granularidade por vagão via `Segment.units`
  /** `true` = composição de CONTEXTO do pátio (outro trem/vagões estacionados, sem vínculo com o
   *  Plano de Manobra em visualização) — desenhada à escala real (blocos neutros/cinza,
   *  opacidade reduzida), nunca como o pino/cartão do trem selecionado, e nunca some quando uma
   *  Etapa do Plano está em destaque (ver `Composition.tsx`, `BackgroundComposition`). Ausente/
   *  `false` = comportamento de sempre (composição do trem selecionado no Plano de Manobra,
   *  `planoTopologiaAdapter.ts`). 2026-08-26, pedido explícito do usuário: "camada de fundo
   *  mostrando TODOS os vagões e trens do pátio... pra dar contexto real". */
  background?: boolean
}

export interface Segment {
  kind: 'locomotiva' | 'vagao' | (string & {})   // vocabulário PT-BR do domínio (ver LineType/LineStatus)
  count: number
  length: number                     // comprimento real do bloco — obrigatório, dirige a escala
  color?: string                     // hint opcional (hex); default = mapa kind→cor do front
  detail?: VehicleInfo[]             // revelado no hover/click (zoom baixo, caixa agregada)
  /** Vínculo com o Bloco/Grupo do Plano de Manobra (`BlocoManobra.id`/`ClusterManobra.id`) —
   *  opcional porque nem toda composição do pátio tem um plano associado; quando ausente, o
   *  segmento nunca destaca/esmaece com a seleção do Plano (ver `Composition.tsx`, prop `highlight`). */
  blocoId?: string
  /** Rótulo de exibição do Bloco (`BlocoManobra.nome`, ex.: "Bloco A") — `blocoId` sozinho
   *  ("blocoA") não é apresentável. Ausente quando `blocoId` também está ausente. Usado no
   *  cabeçalho do cartão do pino no nível "Bloco" (ex.: "J614 · Bloco A"), ver
   *  `Composition.tsx`. */
  blocoNome?: string
  clusterId?: string
  /** Um vagão/locomotiva por unidade do segmento — opcional; presente só onde o pátio realmente
   *  conhece a identidade individual de cada veículo (não é o caso geral do contrato). Quando
   *  ausente, o segmento só pode ser desenhado agregado (comportamento anterior); quando
   *  presente, DEVE ter exatamente `count` entradas — é o que permite ao "zoom semântico" abrir
   *  a caixa agregada em chips individuais (ver `Composition.tsx`, `ZOOM_SEMANTICO_LIMIAR`).
   *
   *  Convenção de quem monta o segmento (ver `planoTopologiaAdapter.ts`): um segmento `vagao` com
   *  `clusterId` SEMPRE contém só os vagões que esse Cluster vai retirar — ainda fisicamente
   *  presentes (a Retirada é uma etapa futura do plano), desenhados em vermelho
   *  (`VehicleChip`, status "retirado"). Um segmento sem `clusterId` é sempre normal. Não há um
   *  terceiro caso "incluído": vagão incluído ainda não existe fisicamente, por isso vive só em
   *  `incoming` (abaixo), nunca aqui. */
  units?: CompositionUnit[]
  /** Vagões que substituiriam `units` quando a etapa de Inclusão do Cluster rodar — preview,
   *  ainda não existem fisicamente no pátio. Só faz sentido num segmento com `clusterId`;
   *  pareado por índice com `units` (mesmo índice = "este entra no lugar daquele"). Desenhado
   *  como chip verde (status "incluído") empilhado ACIMA do chip vermelho correspondente, no
   *  zoom de detalhe (ver `Composition.tsx`, `CompositionDetalhada`). */
  incoming?: CompositionUnit[]
}

/** Um vagão ou locomotiva individual dentro de um `Segment` — id real do veículo (mesmo `id`
 *  usado em `ItemComposicao` do Plano de Manobra, quando aplicável) + o tipo físico do veículo. */
export interface CompositionUnit {
  id: string
  kind: 'locomotiva' | 'vagao'
}

export interface VehicleInfo { id?: string; model?: string; cargo?: string; [k: string]: unknown }

export interface MarkerElement extends ElementBase { kind: 'marker'; variant: string; label?: string }
export interface LabelElement  extends ElementBase { kind: 'label'; text: string }

// Divisor vertical (ex.: PN — passagem de nível) cruzando de sua linha-hospedeira até
// `spanToLineId`; `at.from` dá a posição X (local à hospedeira), a projeção resolve Y0/Y1
// via `computeLineY` das duas linhas — nunca coordenada de pixel arbitrária.
export interface DividerElement extends ElementBase { kind: 'divider'; spanToLineId: string; label?: string }

export interface LayoutHint { y?: number; path?: { x: number; y: number }[] }
