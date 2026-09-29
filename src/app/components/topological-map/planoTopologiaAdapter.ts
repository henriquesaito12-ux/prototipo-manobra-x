import type { BlocoManobra, PlanoManobra } from '../../data/planoManobra'
import type { CompositionElement, CompositionUnit, Segment, YardTopology } from './train-yard/types'

// Ponte entre o Plano de Manobra (`planoManobra.ts`) e o mapa (`train-yard/`): o pátio `eht`
// (`mocks/eht.ts`) não tem posição real por trem — é um fixture único do BFF, sem esse contrato
// ainda. Enquanto isso, a composição de CADA trem selecionado é sintetizada aqui a partir do
// próprio Plano (Bloco > Grupo > vagões reais) e alocada numa linha escolhida
// deterministicamente pelo nome do trem (`pickLineIdForTrem`) — troca de trem tende a trocar de
// linha no mapa, o suficiente pra o operador perceber a mudança visualmente. Não é dado real de
// posição; substituir por um contrato de localização por trem assim que o backend tiver isso.

/** Linhas candidatas pra hospedar a composição de um trem — exclui só L4 (única interditada no
 *  fixture `eht`, ver `mocks/eht.ts`/`EHT_STATUS.lineStatus`), pra nunca desenhar um trem
 *  "estacionado" numa via bloqueada. */
const CANDIDATE_LINE_IDS = ['L1', 'L2', 'L3', 'L5']

/** Soma dos códigos de caractere do nome do trem — hash determinístico simples (mesmo trem →
 *  sempre o mesmo valor, sem estado nem aleatoriedade), reaproveitado pelos fallbacks de
 *  `pickLineIdForTrem`/`pickPosicaoRelativaForTrem` com módulos DIFERENTES (linha × posição).
 *  Só um hash — com só 4 linhas × 5 posições candidatas, alguns nomes de trem colidem nos DOIS
 *  módulos ao mesmo tempo (mesmo trecho de linha, mesma posição — dá pra confirmar rodando o
 *  hash pros nomes reais do dia). Pra ELIMINAR esse risco nos trens que hoje aparecem de
 *  verdade na barra de seleção, `POSICAO_TREM_CONHECIDO` abaixo escolhe linha/posição à mão pra
 *  cada um (garantindo os 4 tipos de linha usados e nenhum par se sobrepondo); o hash cobre só
 *  quem não está nessa lista (trens futuros/fora do mock narrativo). */
function hashTrem(trem: string): number {
  return [...trem].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
}

/** Posições relativas candidatas ao longo da linha (0 = encostado numa ponta, 1 = na outra) —
 *  espalhadas de propósito (não só o centro): alguns trens ficam mais pra uma ponta, outros mais
 *  pra outra, outros no meio — pedido explícito pra nunca "empilhar" vários trens na mesma
 *  posição visual só porque compartilham a mesma linha. */
const POSICOES_RELATIVAS = [0.08, 0.28, 0.5, 0.72, 0.92]

/**
 * Linha + posição relativa escolhidas à mão pros trens do mock narrativo rico (mesmos 7 de
 * `planosManobraMock`, `planoManobra.ts`) — cobre as 4 linhas candidatas (`CANDIDATE_LINE_IDS`).
 * Nos pares que compartilham linha (R045/R150 em L1, J300/R088 em L3), cada trem do par fica
 * numa ponta oposta — nunca colados na mesma posição visual (só um trem é desenhado por vez, ver
 * `injectTrainComposition`, mas a distância entre as posições ajuda a notar a troca de seleção).
 * J275/J614 também compartilham L2, mas J614 é exceção deliberada: fica encostado no início
 * (esquerda) da linha — pedido explícito (2026-08-25), não a ponta oposta de J275.
 */
const POSICAO_TREM_CONHECIDO: Record<string, { linha: string; posicaoRelativa: number }> = {
  R045: { linha: 'L1', posicaoRelativa: 0.18 },
  R150: { linha: 'L1', posicaoRelativa: 0.78 },
  J275: { linha: 'L2', posicaoRelativa: 0.22 },
  // J614 fica encostado no início (esquerda) da Linha Desvio — pedido explícito (2026-08-25):
  // clicar no trem deve mostrá-lo já no começo do trecho, não no meio dele.
  J614: { linha: 'L2', posicaoRelativa: 0 },
  J300: { linha: 'L3', posicaoRelativa: 0.25 },
  R088: { linha: 'L3', posicaoRelativa: 0.8 },
  J420: { linha: 'L5', posicaoRelativa: 0.5 },
  // J105 (2026-09-21): L2 ("L Desvio") é a linha onde o plano de manobra deste trem começa e
  // termina (`planoManobraJ105.ts`) — 0.6 fica livre entre J588 (0.44) e J640 (0.85), mesma linha.
  J105: { linha: 'L2', posicaoRelativa: 0.6 },
  // 2026-08-26, pedido explícito do usuário: "os outros trens ali no mapa, precisam ser
  // representados como um trem a ser selecionado também... e ele no mapa precisa ter relação" —
  // os 7 trens "de fundo" (`TREM_FUNDO_SELECIONAVEL`, `fichaOperacao.ts`) recebem posição à mão
  // igual ao `from` já usado pela composição de fundo ESTÁTICA correspondente
  // (`eht-fundo-*`, `mocks/eht.ts`) — quando um deles é selecionado, a composição sintetizada
  // aqui nasce bem perto de onde o bloco de fundo já estava, então a troca "contexto anônimo →
  // trem selecionado" lê como o MESMO trem, não como um novo aparecendo do nada (ver
  // `backgroundElementIdForTrem`/`injectTrainComposition` abaixo, que remove o bloco de fundo
  // estático assim que o trem real correspondente é injetado, pra não desenhar os dois
  // sobrepostos). L4 fica de fora (única linha interditada, `CANDIDATE_LINE_IDS`) — o trem de
  // fundo que estava lá (`eht-fundo-L4-0`) continua só como contexto anônimo, não selecionável.
  J602: { linha: 'L1', posicaoRelativa: 0.32 },
  R039: { linha: 'L1', posicaoRelativa: 0.86 },
  J588: { linha: 'L2', posicaoRelativa: 0.44 },
  J640: { linha: 'L2', posicaoRelativa: 0.85 },
  J356: { linha: 'L3', posicaoRelativa: 0.07 },
  R073: { linha: 'L3', posicaoRelativa: 0.51 },
  R512: { linha: 'L5', posicaoRelativa: 0.05 },
}

/** Id do elemento de fundo estático (`eht-fundo-*`, `mocks/eht.ts`) que cada trem "de fundo"
 *  (ver `POSICAO_TREM_CONHECIDO` acima) substitui quando selecionado — consumido por
 *  `injectTrainComposition` pra remover o bloco anônimo da MESMA posição antes de desenhar a
 *  composição real, evitando as duas desenhadas uma em cima da outra. */
const BACKGROUND_ELEMENT_ID_POR_TREM: Record<string, string> = {
  J602: 'eht-fundo-L1-0',
  R039: 'eht-fundo-L1-1',
  J588: 'eht-fundo-L2-0',
  J640: 'eht-fundo-L2-1',
  J356: 'eht-fundo-L3-0',
  R073: 'eht-fundo-L3-1',
  R512: 'eht-fundo-L5-0',
}

/** Ver `BACKGROUND_ELEMENT_ID_POR_TREM` — `undefined` pra qualquer trem que não seja um dos "de
 *  fundo" (nada a excluir). */
export function backgroundElementIdForTrem(trem: string): string | undefined {
  return BACKGROUND_ELEMENT_ID_POR_TREM[trem]
}

/** Escolha de linha — trens conhecidos (`POSICAO_TREM_CONHECIDO`) usam a atribuição à mão;
 *  qualquer outro cai no hash do nome, módulo o número de linhas candidatas (não garante que
 *  todo par caia em linhas diferentes, mas é o suficiente pra maioria das trocas de seleção
 *  mudarem de linha visivelmente). */
export function pickLineIdForTrem(trem: string): string {
  return POSICAO_TREM_CONHECIDO[trem]?.linha ?? CANDIDATE_LINE_IDS[hashTrem(trem) % CANDIDATE_LINE_IDS.length]
}

/** Escolha de posição relativa — mesma regra de `pickLineIdForTrem` (à mão pros conhecidos,
 *  hash com módulo diferente pros demais, pra não variar em sincronia com a escolha de linha). */
function pickPosicaoRelativaForTrem(trem: string): number {
  return POSICAO_TREM_CONHECIDO[trem]?.posicaoRelativa ?? POSICOES_RELATIVAS[hashTrem(trem) % POSICOES_RELATIVAS.length]
}

/** Comprimento nominal (m) por unidade — dirige a escala física da composição no mapa. `vagao`
 *  reduzido de 15 pra 9, 2026-08-27, pedido explícito do usuário: "pode diminuir a largura dos
 *  vagões, consequente o comprimento do trem deve diminuir também (de todos)" — cada quadradinho
 *  fica mais estreito e, por tabela, o comprimento total da composição (`comprimento` nas
 *  Métricas Gerais, `PlanManobraX.tsx`) encolhe junto, sem precisar de nenhuma lógica separada
 *  (é literalmente `count × UNIT_LENGTH`, ver `agruparEmSegmentos` abaixo). `locomotiva` não
 *  mencionada, mantida. MESMO valor duplicado em `COMPRIMENTO_VAGAO_M`, `mocks/eht.ts` — os
 *  trens de fundo do pátio usam a MESMA régua de escala (ver comentário lá). */
const UNIT_LENGTH: Record<CompositionUnit['kind'], number> = { locomotiva: 20, vagao: 9 }

interface VeiculoDoBloco {
  id: string
  tipo: CompositionUnit['kind']
  /** Presente só quando este veículo é o problema de ALGUM Cluster do bloco — ver
   *  `derivarVeiculosDoBloco`. */
  clusterId?: string
}

interface VeiculosDoBloco {
  veiculos: VeiculoDoBloco[]
  /** Vagões que substituiriam os retirados de cada Cluster (`ClusterManobra.composicao.depois`,
   *  itens "incluído") — ainda não existem fisicamente, por isso não entram em `veiculos`. Vive
   *  separado pra virar `Segment.incoming` em `agruparEmSegmentos` (chip verde empilhado acima
   *  do vermelho correspondente, ver `Composition.tsx`). */
  incluidosPorCluster: Map<string, string[]>
}

/**
 * Deriva a composição física ATUAL de um Bloco a partir das listas "antes" de todos os seus
 * Clusters — `BlocoManobra` só guarda contagem agregada (`locomotivas`/`vagoes`), não uma lista
 * de ids; quem tem ids reais é `ClusterManobra.composicao.antes`, mas cada Cluster documenta o
 * BLOCO INTEIRO no momento da sua própria etapa, não só o trecho que afeta. A união de todas as
 * listas "antes" reconstrói "o que está fisicamente no bloco agora, e qual problema cada vagão
 * carrega": um vagão "retirado" num Cluster ainda está fisicamente presente (a Retirada é uma
 * etapa futura do plano, não algo já executado) — só fica marcado com o id daquele Cluster.
 * Sempre sobrescreve nesse caso: o mesmo vagão pode aparecer normal num Cluster anterior do bloco
 * e "retirado" num posterior (caso real do Bloco B no mock J614 — ver `planoManobra.ts`).
 */
function derivarVeiculosDoBloco(bloco: BlocoManobra): VeiculosDoBloco {
  const porId = new Map<string, VeiculoDoBloco>()
  const incluidosPorCluster = new Map<string, string[]>()
  for (const cluster of bloco.clusters) {
    for (const item of cluster.composicao.antes) {
      if (item.tipo === 'incluido') continue // ainda não existe fisicamente no bloco
      if (item.tipo === 'retirado') {
        porId.set(item.id, { id: item.id, tipo: 'vagao', clusterId: cluster.id })
      } else if (!porId.has(item.id)) {
        porId.set(item.id, { id: item.id, tipo: item.tipo === 'locomotiva' ? 'locomotiva' : 'vagao' })
      }
    }
    const incluidos = cluster.composicao.depois.filter((item) => item.tipo === 'incluido').map((item) => item.id)
    if (incluidos.length) incluidosPorCluster.set(cluster.id, incluidos)
  }
  return { veiculos: [...porId.values()], incluidosPorCluster }
}

/** Agrupa veículos em `Segment`s — locomotiva(s) primeiro, depois vagões normais, depois os
 *  vagões de cada Cluster problemático (na ordem dos Clusters do bloco) — mesma convenção usada
 *  antes à mão no mock `eht.ts`, agora derivada em vez de escrita manualmente por trem. Cada
 *  grupo de Cluster ganha `incoming` (pareado por índice com `units`) quando esse Cluster tem
 *  vagões "incluído" previstos (ver `derivarVeiculosDoBloco`). */
function agruparEmSegmentos({ veiculos, incluidosPorCluster }: VeiculosDoBloco, blocoId: string, blocoNome: string): Segment[] {
  const locomotivas = veiculos.filter((v) => v.tipo === 'locomotiva')
  const normais = veiculos.filter((v) => v.tipo === 'vagao' && !v.clusterId)
  const porCluster = new Map<string, VeiculoDoBloco[]>()
  for (const v of veiculos) {
    if (v.tipo !== 'vagao' || !v.clusterId) continue
    const lista = porCluster.get(v.clusterId) ?? []
    lista.push(v)
    porCluster.set(v.clusterId, lista)
  }

  const grupos: { tipo: CompositionUnit['kind']; clusterId?: string; itens: VeiculoDoBloco[] }[] = []
  if (locomotivas.length) grupos.push({ tipo: 'locomotiva', itens: locomotivas })
  if (normais.length) grupos.push({ tipo: 'vagao', itens: normais })
  for (const [clusterId, itens] of porCluster) grupos.push({ tipo: 'vagao', clusterId, itens })

  return grupos.map(({ tipo, clusterId, itens }) => {
    const incluidos = clusterId ? incluidosPorCluster.get(clusterId) : undefined
    return {
      kind: tipo,
      count: itens.length,
      length: itens.length * UNIT_LENGTH[tipo],
      blocoId,
      blocoNome,
      clusterId,
      units: itens.map((v) => ({ id: v.id, kind: tipo })),
      incoming: incluidos?.map((id) => ({ id, kind: 'vagao' as const })),
    }
  })
}

/**
 * Composição sintética do trem inteiro (todos os Blocos, em sequência) para desenhar no mapa.
 * Rótulo é só o nome do trem (ex.: "J614") — o resumo por tipo ("01 GT46 + 02 U20 + 08 VG") que
 * existia antes não aparece mais: em zoom baixo o operador só precisa identificar QUAL trem está
 * ali; o detalhe por vagão já vem do zoom semântico (ver `Composition.tsx`).
 */
export function buildTrainComposition(plano: PlanoManobra, lineLength: number): CompositionElement {
  const segments = plano.blocos.flatMap((bloco) => agruparEmSegmentos(derivarVeiculosDoBloco(bloco), bloco.id, bloco.nome))
  const comprimentoTotal = segments.reduce((soma, seg) => soma + seg.length, 0)
  // Margem mínima nas pontas da linha — mesmo trem nunca fica com a composição colada rente ao
  // início/fim visual da via. `espacoDisponivel` negativo (composição mais longa que a própria
  // linha, comum na L5 "Terminal da Ferradura", 200 m) cai pra 0 — `from` então só respeita a
  // margem, mesmo comportamento de antes (sempre `from >= 0`).
  const MARGEM = 20
  const espacoDisponivel = Math.max(0, lineLength - comprimentoTotal - MARGEM * 2)
  // Posição relativa determinística por trem (ver `pickPosicaoRelativaForTrem`) — NÃO centralizado
  // sempre: um trem pode ficar mais perto de uma ponta da linha, outro mais perto da outra, outro
  // no meio, pedido explícito pra nunca "empilhar" trens na mesma posição visual.
  const from = Math.max(0, Math.round(MARGEM + espacoDisponivel * pickPosicaoRelativaForTrem(plano.trem)))
  return {
    id: `composicao-${plano.trem}`,
    kind: 'composition',
    label: plano.trem,
    at: { from, to: from + comprimentoTotal },
    segments,
  }
}

/**
 * Injeta `composition` na linha `lineId` de uma CÓPIA de `topology` (nunca muta o original —
 * `EHT_TOPOLOGY` é module-level e compartilhado). A topologia base não tem mais nenhuma
 * composição fixa (além do tráfego de fundo estático, `eht-fundo-*`); toda composição REAL
 * desenhada no mapa vem daqui, uma por trem selecionado (ver `ZoomableMapa`,
 * `PlanejamentoScreen.tsx`).
 *
 * `excludeElementId` (opcional) remove um elemento existente da MESMA linha antes de anexar —
 * usado quando o trem selecionado é um dos "de fundo" (`backgroundElementIdForTrem` acima): o
 * bloco de contexto estático que ocupava aquela posição sai de cena no mesmo instante em que a
 * composição real do trem entra, pra nunca desenhar as duas sobrepostas.
 */
export function injectTrainComposition(
  topology: YardTopology,
  lineId: string,
  composition: CompositionElement,
  excludeElementId?: string,
): YardTopology {
  return {
    ...topology,
    lines: topology.lines.map((line) => {
      if (line.id !== lineId) return line
      const elements = excludeElementId ? (line.elements ?? []).filter((el) => el.id !== excludeElementId) : (line.elements ?? [])
      return { ...line, elements: [...elements, composition] }
    }),
  }
}

/**
 * Remove da topologia as composições de FUNDO (`background: true`, `types.ts`) sem ficha
 * aprovada — pedido explícito do usuário, 2026-08-31: "se os trens não estão com ficha
 * aprovadas, eles nao devem aparecer no mapa (nem mais transparentes) não devem aparecer".
 * Mesma regra que já vale pro trem SELECIONADO (`fichaAprovada`, `ZoomableMapa`/
 * `PlanejamentoScreen.tsx`: sem ficha aprovada não há Plano de Manobra de verdade ainda) — só
 * que agora aplicada a TODOS os blocos "de fundo", não só o em foco no momento.
 * Blocos de fundo SEM `label` (contexto puramente anônimo, nunca vinculado a nenhum trem real —
 * ex.: `eht-fundo-L4-0`, sua locomotiva "GT46-0900") NÃO são exceção: mesmo sem uma ficha
 * própria pra aprovar, ainda são visualmente um trem/composição estacionado no pátio — o usuário
 * confirmou 2026-08-31 que também não devem aparecer ("ainda está aparecendo um trem GT46-0900").
 * Falha fechada: sem `label` (ou sem entrada correspondente em `statusFichaPorTrem`) = tratado
 * como não aprovado, nunca como "sempre visível".
 */
export function filterUnapprovedBackgroundTrains(
  topology: YardTopology,
  statusFichaPorTrem: Record<string, { pendente: boolean }>,
): YardTopology {
  return {
    ...topology,
    lines: topology.lines.map((line) => ({
      ...line,
      elements: (line.elements ?? []).filter((el) => {
        if (el.kind !== 'composition' || !el.background) return true
        if (!el.label) return false
        return !statusFichaPorTrem[el.label]?.pendente
      }),
    })),
  }
}

/**
 * Remove da topologia TODAS as composições de FUNDO (`background: true`) — não só as sem ficha
 * aprovada (`filterUnapprovedBackgroundTrains`, acima), TODAS, aprovadas ou não. Exclusivo do
 * J105 (pedido explícito do usuário, 2026-09-22, com print mostrando os trens de fundo "16"/"18"
 * no meio do mapa: "remova todos os outros trens do pátio... mostre só os que fazem parte do
 * plano mesmo"): o J105 é o ÚNICO trem cujo mapa já não desenha o pino/composição sintetizado dos
 * demais trens (`ComposicaoJ105Layer` desenha a composição dele por fora do mecanismo de
 * `elements`/`kind: 'composition'` da cena — ver comentário em `PlanejamentoScreen.tsx`, "J105:
 * nada de composição sintetizada aqui"), então filtrar TODO `kind === 'composition'` da topologia
 * só pra esse trem nunca corre o risco de remover a composição do próprio J105 (ela não vive
 * nesse mecanismo) — só limpa o contexto de outros trens estacionados, que aqui é ruído, não
 * informação do plano. Não mexe no toggle "Composição" da legenda (`legendFilter`): filtra a
 * TOPOLOGIA antes dela, então o chip continua reletindo o estado real da UI, só que sem efeito
 * nenhum enquanto o trem selecionado for o J105 (nada sobra pra ele ligar/desligar).
 */
/** Linha do Terminal da Ferradura no pátio EHT (`train-yard/mocks/eht.ts`). */
const LINHA_TERMINAL_FERRADURA = 'L5'

/**
 * J105 V2: pinta de vermelho o Terminal da Ferradura, casando com a restrição listada em
 * "Restrições Ativas" — 2026-09-24, pedido explícito do usuário: "no mapa fique vermelho o
 * terminal da ferradura", esclarecido em seguida: "era só a linha normal, mas vermelha" (sem
 * hachura de interditada e sem caixa de texto). Usa o status `restrita` (`STATUS_OVERLAYS`,
 * desenhado em `Line.tsx`). Aplicado só à topologia do V2 (não ao mock do pátio, `EHT_STATUS`),
 * então nenhum outro trem vê a restrição.
 */
export function marcarRestricaoFerradura(topology: YardTopology): YardTopology {
  return {
    ...topology,
    lines: topology.lines.map((line) => {
      if (line.id !== LINHA_TERMINAL_FERRADURA) return line
      const status = line.status ?? []
      return { ...line, status: status.includes('restrita') ? status : [...status, 'restrita'] }
    }),
  }
}

export function removerComposicoesDeFundo(topology: YardTopology): YardTopology {
  return {
    ...topology,
    lines: topology.lines.map((line) => ({
      ...line,
      elements: (line.elements ?? []).filter((el) => el.kind !== 'composition' || !el.background),
    })),
  }
}
