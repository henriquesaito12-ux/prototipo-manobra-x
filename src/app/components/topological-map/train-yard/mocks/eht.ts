import { mergeYardLayers } from '../mergeYardLayers'
import type { CompositionElement, CompositionUnit, YardElements, YardMap, YardStatus, YardTopology } from '../types'

// Dados REAIS do pátio EHT (Hélio Torres), extraídos de
// `manobra-x-bff/data/mocks/{yard-map,yard-status,yard-elements}.json` (chave "eht") em
// 2026-07-31. Não são dados fabricados para o protótipo — são o fixture real usado pelo bff em
// modo mock, congelado aqui como snapshot estático para o protótipo poder rodar sem rede.
// Se o bff atualizar o fixture "eht", este arquivo NÃO acompanha automaticamente — é um snapshot,
// não um espelho ao vivo.

// --- Tráfego de FUNDO do pátio (2026-08-26, pedido explícito do usuário) -------------------
//
// "Preciso adicionar uma CAMADA DE FUNDO mostrando TODOS os vagões e trens do pátio — inclusive
// os que NÃO fazem parte do plano sendo visualizado — pra dar contexto real de como o pátio
// está". Composições MOCKADAS e ESTÁTICAS (não reagem à navegação de Bloco/Grupo/Etapa — fase
// futura, fora de escopo agora), uma ou duas por linha, `background: true` (ver `types.ts`,
// `Composition.tsx`) — desenhadas à escala real, tratamento visual neutro, nunca vinculadas a um
// Bloco/Cluster do Plano de Manobra. Posições escolhidas à mão pra ficarem razoavelmente
// afastadas de onde `planoTopologiaAdapter.ts` (`POSICAO_TREM_CONHECIDO`) já posiciona os trens
// do mock narrativo — aproximado, não uma garantia matemática de zero sobreposição (é
// contexto/mockup, não um sistema de ocupação real de pátio).
//
// Mesmos comprimentos-padrão por unidade de `planoTopologiaAdapter.ts` (`UNIT_LENGTH`:
// locomotiva 20m, vagão 9m — reduzido de 15, 2026-08-27, "diminuir a largura dos vagões") — a
// mesma régua de escala já estabelecida, reaproveitada aqui.
const COMPRIMENTO_LOCOMOTIVA_M = 20
const COMPRIMENTO_VAGAO_M = 9

/** Ids de vagão de fundo — mesmo estilo "NNNNNN-N" já visto na Ficha Operacional (ex.:
 *  "701521-3"), só numa faixa alta (7xxxxx) que nunca colide com os ids reais usados pelos trens
 *  do mock narrativo (`planoManobra.ts`, todos abaixo de 700000 ou em outro formato). Cada grupo
 *  de fundo usa uma faixa de `inicio` própria (100 em 100) só pra ficarem visualmente
 *  distinguíveis entre si no tooltip — não tem significado operacional. */
function idsVagaoFundo(inicio: number, quantidade: number): string[] {
  return Array.from({ length: quantidade }, (_, i) => {
    const n = inicio + i
    return `${700000 + n}-${n % 10}`
  })
}

/** Ids de locomotiva de fundo — mesmo estilo "GT46-0NNN" já usado pelas locomotivas reais dos
 *  trens do mock (ex.: "GT46-0117"), numa faixa (02xx) que nunca colide com elas. */
function idsLocomotivaFundo(inicio: number, quantidade: number): string[] {
  return Array.from({ length: quantidade }, (_, i) => `GT46-0${200 + inicio + i}`)
}

/**
 * Monta UMA composição de fundo — locomotiva(s) + um único segmento de vagões (mesma convenção
 * de agrupamento de `agruparEmSegmentos`, `planoTopologiaAdapter.ts`, só que sem Bloco/Cluster do
 * Plano: nenhum campo `blocoId`/`clusterId`/`incoming`, ver `Segment`, `types.ts`). `idInicio`
 * dirige a faixa de ids gerados (locomotiva e vagão usam a MESMA faixa numérica, sem colidir
 * entre si por usarem prefixos diferentes).
 */
/** `trem` (opcional): quando presente, este bloco de fundo TEM identidade real — é um dos trens
 *  "de fundo" selecionáveis (`TREM_FUNDO_SELECIONAVEL`, `fichaOperacao.ts`; posição de
 *  `POSICAO_TREM_CONHECIDO`, `planoTopologiaAdapter.ts`) — vira `label` (mesmo campo que
 *  `buildTrainComposition` usa pro trem selecionado), lido no tooltip (`tituloSegmentoFundo`,
 *  `Composition.tsx`) pra já avisar QUAL trem é aquele antes mesmo de selecionar. Ausente = bloco
 *  puramente anônimo/contexto (ex.: `eht-fundo-L4-0`, na linha interditada — nunca selecionável). */
function composicaoFundo(id: string, from: number, locomotivas: number, vagoes: number, idInicio: number, trem?: string): CompositionElement {
  const unidadesLoco: CompositionUnit[] = idsLocomotivaFundo(idInicio, locomotivas).map((vid) => ({ id: vid, kind: 'locomotiva' }))
  const unidadesVagao: CompositionUnit[] = idsVagaoFundo(idInicio, vagoes).map((vid) => ({ id: vid, kind: 'vagao' }))
  const segments: CompositionElement['segments'] = []
  if (locomotivas > 0) {
    segments.push({ kind: 'locomotiva', count: locomotivas, length: locomotivas * COMPRIMENTO_LOCOMOTIVA_M, units: unidadesLoco })
  }
  if (vagoes > 0) {
    segments.push({ kind: 'vagao', count: vagoes, length: vagoes * COMPRIMENTO_VAGAO_M, units: unidadesVagao })
  }
  const comprimentoTotal = segments.reduce((soma, seg) => soma + seg.length, 0)
  return { id, kind: 'composition', background: true, label: trem, at: { from, to: from + comprimentoTotal }, segments }
}

export const EHT_MAP: YardMap = {
  yardId: 'eht',
  name: 'Pátio Hélio Torres',
  code: 'EHT',
  updatedAt: '2026-07-30T00:00:00Z',
  scale: { unit: 'm', originId: 'L1', originOffset: 0, span: 2034, scaleFactor: 1 },
  lines: [
    { id: 'L1', label: 'L Principal (2034 m)', type: 'controle-cco', order: 3, length: 2034, offset: 0 },
    { id: 'L2', label: 'L Desvio (1944 m)', type: 'controle-cco', order: 2, length: 1944, offset: 43 },
    { id: 'L3', label: 'L3 (1758 m)', type: 'controle-patio', order: 1, length: 1758, offset: 113 },
    { id: 'L4', label: 'L4 (344 m)', type: 'controle-patio', order: 0, length: 344, offset: 367 },
    { id: 'L5', label: 'Terminal da Ferradura', type: 'controle-patio', order: 4, offset: 50, length: 200 },
  ],
}

export const EHT_STATUS: YardStatus = {
  yardId: 'eht',
  updatedAt: '2026-07-30T00:00:00Z',
  // Nenhuma linha interditada (2026-08-26, pedido explícito do usuário: "remova a restrição da
  // L4") — `L4` continua fora de `CANDIDATE_LINE_IDS` (`planoTopologiaAdapter.ts`, lista
  // hardcoded, independente deste status), então tirar a interdição aqui não muda em nada onde
  // a composição é desenhada.
  lineStatus: {},
  connections: [
    { id: 'eht-amv-60', fromLineId: 'L1', toLineId: 'L2', atFrom: 2034, atTo: 1944 },
    { id: 'eht-amv-61', fromLineId: 'L2', toLineId: 'L3', atFrom: 1854, atTo: 1758 },
    { id: 'eht-amv-62', fromLineId: 'L2', toLineId: 'L3', atFrom: 1183, atTo: 1059 },
    { id: 'eht-amv-63', fromLineId: 'L3', toLineId: 'L4', atFrom: 634, atTo: 344 },
    { id: 'eht-amv-64', fromLineId: 'L2', toLineId: 'L3', atFrom: 651, atTo: 537 },
    { id: 'eht-amv-65', fromLineId: 'L3', toLineId: 'L2', atFrom: 310, atTo: 324 },
    { id: 'eht-amv-66', fromLineId: 'L4', toLineId: 'L3', atFrom: 0, atTo: 214 },
    { id: 'eht-amv-67', fromLineId: 'L3', toLineId: 'L2', atFrom: 0, atTo: 27 },
    { id: 'eht-amv-68', fromLineId: 'L2', toLineId: 'L1', atFrom: 0, atTo: 0 },
    { id: 'eht-conn-ferradura', fromLineId: 'L1', toLineId: 'L5', atFrom: 10, atTo: 0 },
  ],
}

export const EHT_ELEMENTS: YardElements = {
  yardId: 'eht',
  updatedAt: '2026-07-30T00:00:00Z',
  elementsByLine: {
    L1: [
      // A composição do trem selecionado NÃO é fixa aqui — é sintetizada em runtime a partir do
      // Plano de Manobra e injetada na linha certa (`pickLineIdForTrem`) por
      // `planoTopologiaAdapter.ts` (ver `ZoomableMapa`, `PlanejamentoScreen.tsx`). Esta linha só
      // guarda o que É fixo do pátio: marcadores, divisores, rampas.
      { id: 'eht-no-60', kind: 'marker', variant: 'amv-manual', label: '60', at: { from: 2034 } },
      { id: 'eht-wp-1', kind: 'marker', variant: 'km', label: '752+251', at: { from: 2034 } },
      { id: 'eht-wp-2', kind: 'marker', variant: 'km', label: '753', at: { from: 1277 } },
      { id: 'eht-wp-3', kind: 'marker', variant: 'km', label: '754', at: { from: 327 } },
      { id: 'eht-wp-4', kind: 'marker', variant: 'km', label: '754+313', at: { from: 0 } },
      { id: 'eht-rampa-L1-0-calco', kind: 'marker', variant: 'calco-metal', at: { from: 133 } },
      { id: 'eht-rampa-L1-0-freio', kind: 'marker', variant: 'freio-manual', label: '⊕', at: { from: 233 } },
      { id: 'eht-rampa-L1-0-declividade', kind: 'marker', variant: 'declividade', label: '◄ 0%', at: { from: 333 } },
      { id: 'eht-rampa-L1-1-calco', kind: 'marker', variant: 'calco-metal', at: { from: 382 } },
      { id: 'eht-rampa-L1-1-freio', kind: 'marker', variant: 'freio-manual', label: '⊕', at: { from: 482 } },
      { id: 'eht-rampa-L1-1-declividade', kind: 'marker', variant: 'declividade', label: '◄ 0,8%', at: { from: 582 } },
      { id: 'eht-rampa-L1-2-calco', kind: 'marker', variant: 'calco-metal', at: { from: 737 } },
      { id: 'eht-rampa-L1-2-freio', kind: 'marker', variant: 'freio-manual', label: '⊕', at: { from: 837 } },
      { id: 'eht-rampa-L1-2-declividade', kind: 'marker', variant: 'declividade', label: '◄ 1,3%', at: { from: 937 } },
      { id: 'eht-rampa-L1-3-calco', kind: 'marker', variant: 'calco-metal', at: { from: 1284 } },
      { id: 'eht-rampa-L1-3-freio', kind: 'marker', variant: 'freio-manual', label: '⊕', at: { from: 1384 } },
      { id: 'eht-rampa-L1-3-declividade', kind: 'marker', variant: 'declividade', label: '◄ 0,9%', at: { from: 1484 } },
      composicaoFundo('eht-fundo-L1-0', 650, 1, 18, 100, 'J602'),
      composicaoFundo('eht-fundo-L1-1', 1750, 1, 10, 200, 'R039'),
    ],
    L2: [
      { id: 'eht-no-61', kind: 'marker', variant: 'amv-manual', label: '61', at: { from: 1854 } },
      { id: 'eht-no-62', kind: 'marker', variant: 'amv-manual', label: '62', at: { from: 1183 } },
      { id: 'eht-no-64', kind: 'marker', variant: 'amv-manual', label: '64', at: { from: 651 } },
      { id: 'eht-no-68', kind: 'marker', variant: 'amv-manual', label: '68', at: { from: 0 } },
      { id: 'eht-rampa-L2-0-calco', kind: 'marker', variant: 'calco-metal', at: { from: 90 } },
      { id: 'eht-rampa-L2-0-freio', kind: 'marker', variant: 'freio-manual', label: '⊕', at: { from: 190 } },
      { id: 'eht-rampa-L2-0-declividade', kind: 'marker', variant: 'declividade', label: '◄ 0%', at: { from: 290 } },
      { id: 'eht-rampa-L2-1-calco', kind: 'marker', variant: 'calco-metal', at: { from: 339 } },
      { id: 'eht-rampa-L2-1-freio', kind: 'marker', variant: 'freio-manual', label: '⊕', at: { from: 439 } },
      { id: 'eht-rampa-L2-1-declividade', kind: 'marker', variant: 'declividade', label: '◄ 0,8%', at: { from: 539 } },
      { id: 'eht-rampa-L2-2-calco', kind: 'marker', variant: 'calco-metal', at: { from: 694 } },
      { id: 'eht-rampa-L2-2-freio', kind: 'marker', variant: 'freio-manual', label: '⊕', at: { from: 794 } },
      { id: 'eht-rampa-L2-2-declividade', kind: 'marker', variant: 'declividade', label: '◄ 1,3%', at: { from: 894 } },
      { id: 'eht-rampa-L2-3-calco', kind: 'marker', variant: 'calco-metal', at: { from: 1241 } },
      { id: 'eht-rampa-L2-3-freio', kind: 'marker', variant: 'freio-manual', label: '⊕', at: { from: 1341 } },
      { id: 'eht-rampa-L2-3-declividade', kind: 'marker', variant: 'declividade', label: '◄ 0,9%', at: { from: 1441 } },
      composicaoFundo('eht-fundo-L2-0', 850, 1, 22, 300, 'J588'),
      composicaoFundo('eht-fundo-L2-1', 1650, 2, 14, 400, 'J640'),
    ],
    L3: [
      { id: 'eht-no-63', kind: 'marker', variant: 'amv-manual', label: '63', at: { from: 634 } },
      { id: 'eht-no-65', kind: 'marker', variant: 'amv-manual', label: '65', at: { from: 310 } },
      { id: 'eht-no-67', kind: 'marker', variant: 'amv-manual', label: '67', at: { from: 0 } },
      { id: 'eht-rampa-L3-0-calco', kind: 'marker', variant: 'calco-metal', at: { from: 20 } },
      { id: 'eht-rampa-L3-0-freio', kind: 'marker', variant: 'freio-manual', label: '⊕', at: { from: 120 } },
      { id: 'eht-rampa-L3-0-declividade', kind: 'marker', variant: 'declividade', label: '◄ 0%', at: { from: 220 } },
      { id: 'eht-rampa-L3-1-calco', kind: 'marker', variant: 'calco-metal', at: { from: 269 } },
      { id: 'eht-rampa-L3-1-freio', kind: 'marker', variant: 'freio-manual', label: '⊕', at: { from: 369 } },
      { id: 'eht-rampa-L3-1-declividade', kind: 'marker', variant: 'declividade', label: '◄ 0,8%', at: { from: 469 } },
      { id: 'eht-rampa-L3-2-calco', kind: 'marker', variant: 'calco-metal', at: { from: 624 } },
      { id: 'eht-rampa-L3-2-freio', kind: 'marker', variant: 'freio-manual', label: '⊕', at: { from: 724 } },
      { id: 'eht-rampa-L3-2-declividade', kind: 'marker', variant: 'declividade', label: '◄ 1,3%', at: { from: 824 } },
      { id: 'eht-rampa-L3-3-calco', kind: 'marker', variant: 'calco-metal', at: { from: 1171 } },
      { id: 'eht-rampa-L3-3-freio', kind: 'marker', variant: 'freio-manual', label: '⊕', at: { from: 1271 } },
      { id: 'eht-rampa-L3-3-declividade', kind: 'marker', variant: 'declividade', label: '◄ 0,9%', at: { from: 1371 } },
      composicaoFundo('eht-fundo-L3-0', 120, 1, 12, 500, 'J356'),
      composicaoFundo('eht-fundo-L3-1', 900, 1, 16, 600, 'R073'),
    ],
    L4: [
      { id: 'eht-no-66', kind: 'marker', variant: 'amv-manual', label: '66', at: { from: 0 } },
      { id: 'eht-rampa-L4-1-calco', kind: 'marker', variant: 'calco-metal', at: { from: 15 } },
      { id: 'eht-rampa-L4-1-freio', kind: 'marker', variant: 'freio-manual', label: '⊕', at: { from: 115 } },
      { id: 'eht-rampa-L4-1-declividade', kind: 'marker', variant: 'declividade', label: '◄ 0,8%', at: { from: 215 } },
      // L4 nunca é escolhida pra hospedar o trem selecionado (`CANDIDATE_LINE_IDS`,
      // `planoTopologiaAdapter.ts`, exclui L4) — por isso comporta um grupo de fundo mais
      // generoso, sem risco nenhum de colidir com a composição em destaque.
      composicaoFundo('eht-fundo-L4-0', 40, 1, 14, 700),
    ],
    L5: [
      { id: 'eht-batente-ferradura', kind: 'marker', variant: 'batente', at: { from: 200 } },
      composicaoFundo('eht-fundo-L5-0', 10, 1, 4, 800, 'R512'),
    ],
  },
}

/** Topologia já mesclada, pronta para `<TopologicalMap data={EHT_TOPOLOGY} status="success" />`. */
export const EHT_TOPOLOGY: YardTopology = mergeYardLayers(EHT_MAP, EHT_STATUS, EHT_ELEMENTS)
