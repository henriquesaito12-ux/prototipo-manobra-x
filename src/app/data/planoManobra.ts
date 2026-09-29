// Dados mockados do "Plano Manobra X" — hierarquia de 3 níveis usada pelo algoritmo de
// manobra: a Composição/Trem é dividida em Blocos — cada Bloco é 1 locomotiva + TODOS os
// vagões associados a ela (a unidade completa que ela puxa/empurra, não a locomotiva
// isolada). Um trem pode ter múltiplos blocos colados formando uma composição maior. Dentro
// de um Bloco, um ou mais Clusters agrupam um conjunto CONTÍGUO de vagões com problema que
// exige intervenção — "Cluster" é o termo do time técnico/motor de otimização e é usado no
// código (tipos, campos, nomes de função); na UI exibida ao operador o rótulo é "Grupo". As 6
// etapas operacionais (Parada → Corte → Clear → Retirada → Inclusão → Fechamento) são
// executadas para o CLUSTER INTEIRO como unidade — uma única etapa de Retirada/Inclusão pode
// envolver múltiplos vagões do cluster de uma vez, não é uma sequência por vagão individual.
// O algoritmo resolve um cluster por vez, "deslizando" pela composição até tratar todos os
// clusters de todos os blocos. Os valores de tempo/distância são plausíveis, não calculados.
//
// Esta tela é só PLANEJAMENTO — o plano é uma sugestão que o operador ainda vai confirmar ou
// editar, não a execução real (isso é uma tela futura, não implementada). Por isso o modelo
// de dados não tem status de execução/progresso (nada de "concluído"/"em andamento" por
// etapa ou cluster) — só a estrutura do plano em si.

import { construirPlanoJ105 } from './planoManobraJ105';
import { TREM_J105_V2 } from './animacaoJ105';
import { TRENS_ATIVOS } from './trensAtivos';

export type TipoEtapaManobra = 'PARADA' | 'CORTE' | 'CLEAR' | 'RETIRADA' | 'INCLUSAO' | 'FECHAMENTO' | 'PERSONALIZADA';

export const TIPO_ETAPA_LABEL: Record<TipoEtapaManobra, string> = {
  PARADA: 'Parada',
  CORTE: 'Corte',
  CLEAR: 'Clear',
  RETIRADA: 'Retirada',
  INCLUSAO: 'Inclusão',
  FECHAMENTO: 'Fechamento',
  PERSONALIZADA: 'Personalizada',
};

export interface TrechoCaminho {
  trecho: string;
  comprimentoM: number;
  distanciaAcumuladaM: number;
  destino: string;
}

/** Quem executa cada TIPO de etapa — fixo por tipo (não varia por Grupo/Bloco), mesma legenda
 *  que já aparece uma vez no topo do Plano de Manobra impresso. Nomenclatura alinhada ao Plano
 *  de Manobra em PDF (referência de detalhe da tela). */
export const TIPO_ETAPA_RESPONSAVEL: Record<TipoEtapaManobra, string> = {
  PARADA: 'Maquinista do Trem',
  CORTE: 'Operador da Manobra',
  CLEAR: 'Maquinista do Trem',
  RETIRADA: 'Maquinista de Manobra / Operador de Manobra',
  INCLUSAO: 'Maquinista de Manobra / Operador de Manobra',
  FECHAMENTO: 'Operador da Manobra',
  PERSONALIZADA: '—',
};

/** Campos de apoio compactos exibidos em Parada/Corte/Clear/Fechamento — a etapa acontece "no
 *  lugar", sem rota de deslocamento (essa só existe em Retirada/Inclusão, ver `RotaManobra`). */
export interface ApoioEtapa {
  linha?: string;
  referencia?: string;
  direcao?: string;
  macro?: number;
  /** Rótulo do campo de distância — "Distância" (Parada), "Distância geométrica" (Clear) ou
   *  "Recuo" (Fechamento). */
  distanciaLabel?: string;
  distanciaM?: number;
  /** CLEAR: travessão sendo liberado pelo puxão de cabeça — pode coincidir com `referencia`
   *  (mesmo travessão), mas é um campo próprio porque semanticamente são coisas diferentes: a
   *  referência é o ponto onde a composição está, o travessão é o que a manobra libera. */
  travessao?: string;
  /** CORTE: sentido do corte em relação à composição (ex.: "Head"/"Tail"). */
  sentido?: string;
  /** CORTE: distância da cabeça da composição até o ponto de corte, antes de desengatar. */
  posCabecaM?: number;
  /** CORTE: distância da cabeça da composição até o ponto de corte, depois de desengatar. */
  cabecaAposCorteM?: number;
  /** FECHAMENTO: lado da composição que fecha (ex.: "head"/"tail"). */
  lado?: string;
  /** FECHAMENTO: folga livre entre a composição fechada e o travessão de referência. */
  clearAteTravessaoM?: number;
}

/** Um trecho percorrido dentro de uma Rota — uma linha (ou travessão, quando `travessao: true`)
 *  e a distância percorrida nela antes de seguir para o próximo trecho/destino final. */
export interface SegmentoRota {
  linha: string;
  distanciaM: number;
  travessao?: boolean;
}

/** Reversão de sentido no meio de uma Rota (motor troca de ponta) — só aparece quando a
 *  manobra exige, com o tempo extra que ela consome. */
export interface ReversaoRota {
  local: string;
  tempoSeg: number;
}

/**
 * Uma das 2 rotas de uma etapa de Retirada/Inclusão: Rota 1 é o deslocamento inicial da
 * locomotiva (sem carga) até alcançar a composição/vagões; Rota 2 é o trajeto de retirada (até
 * o estacionamento) ou inclusão (até o destino final), já com a carga.
 */
export interface RotaManobra {
  titulo: string;
  /** Frase de contexto exibida logo abaixo do título (ex.: "Desloque a locomotiva até a
   *  composição pela Linha 3, cruzando o travessão T3."). */
  descricao?: string;
  segmentos: SegmentoRota[];
  destinoFinal: string;
  /** Direção do trajeto — quando há `reversao`, é a direção ANTES dela ("Direção 1" na tela). */
  direcao: string;
  /** Direção após a reversão ("Direção 2" na tela) — só usada quando `reversao` está presente. */
  direcao2?: string;
  macro?: number;
  distanciaTotalM: number;
  chegada?: 'Puxando' | 'Empurrando';
  reversao?: ReversaoRota;
  /** Sobrescreve a frase gerada para o último trecho (ex.: "Alcance a composição na Linha X,
   *  referência Y.") — usado sobretudo na Rota 1, cujo trajeto termina ao alcançar a composição/
   *  vagões, não numa distância a percorrer até `destinoFinal`. */
  instrucaoFinal?: string;
}

export interface EtapaManobra {
  id: string;
  tipo: TipoEtapaManobra;
  descricao: string;
  /** Offset em relação ao início da manobra do cluster (T+0). */
  tempoEstimado: string;
  grupoVagoes: string;
  // Campos legados, usados hoje só na impressão do plano (`PlanoImpressao`) para Retirada/
  // Inclusão — mantidos como estão para não quebrar o PDF; a tela usa os campos ricos abaixo.
  rotaOrigem?: string;
  rotaDestino?: string;
  distanciaTotalM?: number;
  sentido?: 'Puxando' | 'Empurrando';
  vagoesRetirados?: string[];
  vagoesIncluidos?: string[];
  /** Vagão(ões) que a etapa menciona sem retirar nem incluir (ex.: vagão de referência para
   *  posicionamento) — chip neutro (cinza) em `VagoesEtapa`, mesmo tratamento visual de
   *  retirado/incluído, só sem a cor semântica. */
  vagoesReferencia?: string[];
  caminho?: TrechoCaminho[];
  /** Painel "Sequência de Manobra" na tela — Parada/Corte/Clear/Fechamento. */
  apoio?: ApoioEtapa;
  /** Painel "Sequência de Manobra" na tela — Retirada/Inclusão (sempre 2 rotas). */
  rotas?: RotaManobra[];
  /** Agentes envolvidos na etapa (ex.: "Maquinista de viagem", "Operador de manobra") — usado
   *  hoje só pelo card de passo dedicado do trem J105 (formato "Passo N / Agentes / instrução",
   *  sem os badges estruturados dos demais trens; ver `PassosJ105Lista`, `PlanManobraX.tsx`).
   *  Os demais trens não preenchem este campo (continuam usando `TIPO_ETAPA_RESPONSAVEL`). */
  agentes?: string[];
  /** Parágrafo de instrução operacional completa (o "como fazer") — mesmo uso exclusivo do card
   *  de passo do J105 acima; `descricao` continua sendo a frase curta usada pelos demais trens. */
  instrucaoCompleta?: string;
}

export type CriticidadeCluster = 'Baixa' | 'Média' | 'Alta';

/** Um item da composição visual "antes/depois" de um cluster. */
export interface ItemComposicao {
  id: string;
  tipo: 'locomotiva' | 'vagao' | 'retirado' | 'incluido';
}

/**
 * Um conjunto CONTÍGUO de vagões com problema, dentro de um bloco, que exige intervenção.
 * As 6 etapas do cluster tratam esse conjunto como unidade — uma etapa de Retirada ou
 * Inclusão pode envolver mais de um vagão.
 */
export interface ClusterManobra {
  id: string;
  titulo: string;
  /** "{vagões} · {descrição}" combinado — usado no Plano de Manobra impresso. Na tela, o
   *  cabeçalho do Grupo (fechado) mostra os vagões como chip (ver `descricaoProblema`, o mesmo
   *  texto sem os ids) em vez de repetir os ids em texto corrido. */
  resumoProblema: string;
  /** Só a descrição do problema, sem os ids de vagão (ex.: "avaria em rodeiro") — usada no
   *  cabeçalho do Grupo na tela, ao lado dos chips de retirado/incluído. */
  descricaoProblema: string;
  criticidade: CriticidadeCluster;
  /** Composição relevante ao cluster antes e depois da intervenção — usada na visão "antes/depois". */
  composicao: {
    antes: ItemComposicao[];
    depois: ItemComposicao[];
  };
  etapas: EtapaManobra[];
}

/**
 * A unidade completa de composição de 1 locomotiva: a locomotiva + TODOS os vagões que ela
 * puxa/empurra (não só os do cluster problemático). Um trem pode ter múltiplos blocos
 * colados entre si formando a composição inteira.
 */
export interface BlocoManobra {
  id: string;
  nome: string;
  locomotivas: number;
  /** Total de vagões do bloco inteiro (inclui os que não estão em nenhum cluster). */
  vagoes: number;
  clusters: ClusterManobra[];
}

export interface PlanoManobra {
  trem: string;
  os: string;
  blocos: BlocoManobra[];
}

/** Extrai os minutos de um offset no formato "T+HH:MM". */
export function parseOffsetMin(tempoEstimado: string): number {
  const match = /T\+(\d+):(\d+)/.exec(tempoEstimado);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Duração estimada de um cluster — offset da última etapa da sua sequência. */
export function duracaoClusterMin(cluster: ClusterManobra): number {
  return cluster.etapas.reduce((max, e) => Math.max(max, parseOffsetMin(e.tempoEstimado)), 0);
}

export function formatarDuracaoMin(totalMin: number): string {
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Comprimento médio assumido por item — não vem de dado físico real (o modelo não modela o
 *  comprimento de cada vagão/locomotiva individual), só o suficiente para o card "Métricas
 *  Gerais" ter um Antes/Depois plausível de comprimento total do trem. */
const COMPRIMENTO_LOCOMOTIVA_M = 20;
const COMPRIMENTO_VAGAO_M = 16;

export interface MetricasGeraisPlano {
  locomotivasCount: number;
  locomotivasIds: string[];
  blocosNomes: string[];
  vagoesAntes: number;
  vagoesDepois: number;
  retirados: number;
  incluidos: number;
  comprimentoAntesM: number;
  comprimentoDepoisM: number;
  tempoPlanejadoMin: number;
  gruposCount: number;
}

/** Resumo do plano inteiro (todos os Blocos) — cabeçalho "Métricas Gerais" da tela, antes da
 *  lista de Blocos. */
export function metricasGeraisPlano(plano: PlanoManobra): MetricasGeraisPlano {
  let vagoesAntes = 0;
  let locomotivasCount = 0;
  let retirados = 0;
  let incluidos = 0;
  let gruposCount = 0;
  let tempoPlanejadoMin = 0;
  const locomotivasIds = new Set<string>();

  for (const bloco of plano.blocos) {
    vagoesAntes += bloco.vagoes;
    locomotivasCount += bloco.locomotivas;
    for (const cluster of bloco.clusters) {
      gruposCount += 1;
      tempoPlanejadoMin += duracaoClusterMin(cluster);
      for (const item of cluster.composicao.antes) {
        if (item.tipo === 'locomotiva') locomotivasIds.add(item.id);
        else if (item.tipo === 'retirado') retirados += 1;
      }
      for (const item of cluster.composicao.depois) {
        if (item.tipo === 'incluido') incluidos += 1;
      }
    }
  }

  const vagoesDepois = vagoesAntes - retirados + incluidos;
  return {
    locomotivasCount,
    locomotivasIds: [...locomotivasIds],
    blocosNomes: plano.blocos.map((b) => b.nome.replace(/^Bloco\s*/i, '')),
    vagoesAntes,
    vagoesDepois,
    retirados,
    incluidos,
    comprimentoAntesM: locomotivasCount * COMPRIMENTO_LOCOMOTIVA_M + vagoesAntes * COMPRIMENTO_VAGAO_M,
    comprimentoDepoisM: locomotivasCount * COMPRIMENTO_LOCOMOTIVA_M + vagoesDepois * COMPRIMENTO_VAGAO_M,
    tempoPlanejadoMin,
    gruposCount,
  };
}

const PESO_CRITICIDADE: Record<CriticidadeCluster, number> = { Alta: 2, Média: 1, Baixa: 0 };

/** Cluster de maior criticidade do plano — usado para destacar "o mais urgente" de relance. */
export function clusterMaisCritico(plano: PlanoManobra): { bloco: BlocoManobra; cluster: ClusterManobra } | null {
  let melhor: { bloco: BlocoManobra; cluster: ClusterManobra } | null = null;
  for (const bloco of plano.blocos) {
    for (const cluster of bloco.clusters) {
      if (!melhor || PESO_CRITICIDADE[cluster.criticidade] > PESO_CRITICIDADE[melhor.cluster.criticidade]) {
        melhor = { bloco, cluster };
      }
    }
  }
  return melhor;
}

/**
 * Vagões "de passagem" — sem problema, presentes do início ao fim do plano (não entram em
 * nenhuma etapa) — só para o Bloco representar um volume realista: um trem real chega a ~55
 * vagões + 2 locomotivas (ver a tabela da Ficha Operacional, `fichaOperacao.ts`), bem mais do que
 * os poucos vagões nomeados no enredo (esses continuam sendo os únicos com problema/etapa).
 * Ids sequenciais num intervalo próprio por Bloco, sem colidir com os vagões nomeados (prefixo
 * "VG-8"/"VG "). O MESMO array é reusado em `antes` e `depois` de todos os Clusters de um
 * Bloco — são vagões que não mudam, então aparecem idênticos em qualquer "fotografia" do bloco.
 */
function vagoesDePassagem(inicio: number, quantidade: number): ItemComposicao[] {
  return Array.from({ length: quantidade }, (_, i) => ({ id: `${inicio + i}-${i % 10}`, tipo: 'vagao' as const }));
}

/** Converte um código curto de linha ("L2") no nome completo usado na prosa ("Linha 2") — nomes
 *  já completos (ex. "Linha Desvio") passam intocados. Só cosmético para as frases geradas por
 *  `gerarRotas`/`construirGrupoRico`; os campos legados (`rotaOrigem`/`rotaDestino`, usados só na
 *  impressão) continuam com o código curto. */
function nomeLinha(codigo: string): string {
  const m = /^L(\d+)$/.exec(codigo);
  return m ? `Linha ${m[1]}` : codigo;
}

/** Direção oposta — as duas únicas direções usadas no mock ("EDV"/"ECJ") se alternam quando a
 *  locomotiva reverte o motor no meio de uma Rota. */
function direcaoOposta(direcao: string): string {
  return direcao === 'EDV' ? 'ECJ' : direcao === 'ECJ' ? 'EDV' : direcao;
}

/**
 * Deriva as 2 Rotas de uma etapa de Retirada/Inclusão a partir da origem/destino/distância já
 * usadas no `caminho` legado (impressão) — Rota 1 é um deslocamento inicial curto da locomotiva
 * até alcançar a composição/vagões; Rota 2 é o trajeto completo até o destino final, passando
 * por um travessão (AMV) no meio. Mesma proporção pra qualquer etapa, só varia com os
 * parâmetros — evita reescrever as 2 rotas à mão em todo Grupo do mock. Gera também a frase de
 * contexto (`descricao`), a frase de chegada da Rota 1 (`instrucaoFinal`, "Alcance...") e, quando
 * há reversão, a `direcao2` (direção após a locomotiva trocar de ponta — default: a oposta de
 * `direcao`, já que só há 2 direções no pátio).
 */
function gerarRotas(params: {
  tipo: 'RETIRADA' | 'INCLUSAO';
  origem: string;
  destino: string;
  distanciaTotalM: number;
  sentido: 'Puxando' | 'Empurrando';
  amv: number;
  direcao: string;
  macro: number;
  reversao?: ReversaoRota;
  direcao2?: string;
}): RotaManobra[] {
  const { tipo, origem, destino, distanciaTotalM, sentido, amv, direcao, macro, reversao } = params;
  const direcao2 = reversao ? (params.direcao2 ?? direcaoOposta(direcao)) : undefined;
  const rota1DistM = Math.max(60, Math.round(distanciaTotalM * 0.65));
  const rota2Perna1M = Math.max(15, Math.round(distanciaTotalM * 0.1));
  const rota2Perna2M = Math.max(30, distanciaTotalM - rota2Perna1M - 10);
  const travessaoLabel = `T${amv}`;

  const rota1: RotaManobra = {
    titulo: 'Rota 1 — Deslocamento inicial da locomotiva',
    descricao:
      tipo === 'RETIRADA'
        ? `Desloque a locomotiva até a composição pela ${origem}, cruzando o travessão ${travessaoLabel}.`
        : `Desloque a locomotiva até os vagões de substituição pela ${origem}, cruzando o travessão ${travessaoLabel}.`,
    segmentos: [{ linha: origem, distanciaM: rota1DistM }],
    destinoFinal: tipo === 'RETIRADA' ? `Linha Desvio (Ref. ${travessaoLabel})` : 'Vagões de substituição',
    instrucaoFinal:
      tipo === 'RETIRADA'
        ? `Alcance a composição na ${origem}, referência ${travessaoLabel}.`
        : `Alcance os vagões de substituição na ${origem}, referência ${travessaoLabel}.`,
    direcao,
    distanciaTotalM: rota1DistM,
  };
  const rota2: RotaManobra = {
    titulo: tipo === 'RETIRADA' ? 'Rota 2 — Retirada até o destino' : 'Rota 2 — Inclusão até o destino',
    descricao:
      tipo === 'RETIRADA'
        ? `Retire os vagões desengatados pela Linha Desvio, cruzando o travessão ${travessaoLabel}, até a ${destino}.`
        : `Inclua os vagões de substituição na composição e siga pela ${origem} até a ${destino}.`,
    segmentos: [
      { linha: tipo === 'RETIRADA' ? 'Linha Desvio' : origem, distanciaM: rota2Perna1M },
      { linha: travessaoLabel, distanciaM: 10, travessao: true },
      { linha: tipo === 'RETIRADA' ? origem : 'Linha Desvio', distanciaM: rota2Perna2M },
    ],
    destinoFinal: tipo === 'RETIRADA' ? 'o ponto de parada dos vagões retirados' : destino,
    direcao,
    direcao2,
    macro,
    distanciaTotalM: rota2Perna1M + 10 + rota2Perna2M,
    chegada: sentido === 'Empurrando' ? 'Puxando' : 'Empurrando',
    reversao,
  };
  return [rota1, rota2];
}

const PASSAGEM_BLOCO_A = vagoesDePassagem(600000, 24);
const PASSAGEM_BLOCO_B = vagoesDePassagem(650000, 23);

export const planoManobraMock: PlanoManobra = {
  trem: 'J614',
  os: '9882/2026',
  blocos: [
    {
      id: 'blocoA',
      nome: 'Bloco A',
      locomotivas: 1,
      vagoes: 5 + PASSAGEM_BLOCO_A.length,
      clusters: [
        {
          id: 'a1',
          titulo: 'Grupo 1 — Vagões de cauda com avaria',
          resumoProblema: '342598-3, 342766-8, 618214-3 · cauda',
          descricaoProblema: 'cauda',
          criticidade: 'Baixa',
          composicao: {
            antes: [
              { id: 'GT46-0117', tipo: 'locomotiva' },
              { id: 'VG-88011', tipo: 'vagao' },
              { id: 'VG-88034', tipo: 'vagao' },
              ...PASSAGEM_BLOCO_A,
              { id: '342598-3', tipo: 'retirado' },
              { id: '342766-8', tipo: 'retirado' },
              { id: '618214-3', tipo: 'retirado' },
            ],
            depois: [
              { id: 'GT46-0117', tipo: 'locomotiva' },
              { id: 'VG-88011', tipo: 'vagao' },
              { id: 'VG-88034', tipo: 'vagao' },
              ...PASSAGEM_BLOCO_A,
              { id: 'VG-88091', tipo: 'incluido' },
              { id: 'VG-70228', tipo: 'incluido' },
            ],
          },
          etapas: [
            {
              id: 'a1-e1',
              tipo: 'PARADA',
              descricao: 'O Maquinista do Trem conduz a parada da composição na Linha Desvio, referência T3, a 1200m do início do trecho.',
              tempoEstimado: 'T+00:00',
              grupoVagoes: 'Composição completa · 01 GT46 + 02 U20 + 08 VG',
              // 1200m em EDV (offset crescente) cai pouco depois do AMV 62 real do pátio EHT (em
              // 1183m na Linha Desvio/L2, ver `mocks/eht.ts`) — cenário validado com o usuário
              // (2026-08-25) antes de implementar o destaque da Parada no mapa.
              apoio: { linha: 'Desvio', referencia: 'T3', direcao: 'EDV', macro: 12, distanciaLabel: 'Distância', distanciaM: 1200 },
            },
            {
              id: 'a1-e2',
              tipo: 'CORTE',
              descricao: 'O Operador da Manobra desengata o(s) vagão(ões) 342598-3, 342766-8, 618214-3, mantendo a composição na Linha Desvio, referência T3.',
              tempoEstimado: 'T+00:04',
              grupoVagoes: 'Vagões de cauda · 342598-3 + 342766-8 + 618214-3',
              vagoesRetirados: ['342598-3', '342766-8', '618214-3'],
              // Mesma referência (T3) da Parada deste grupo (`a1-e1`) — o Corte não desloca a
              // composição, acontece exatamente onde ela já parou (ver `EtapaCorteLayer.tsx`).
              apoio: { linha: 'Desvio', referencia: 'T3', direcao: 'EDV', sentido: 'Head', posCabecaM: 1154, cabecaAposCorteM: 46 },
            },
            {
              id: 'a1-e3',
              tipo: 'CLEAR',
              descricao: 'O Maquinista do Trem puxa a cabeça da composição na Linha Desvio, por 71m, até liberar o travessão T3.',
              tempoEstimado: 'T+00:06',
              grupoVagoes: 'Travessão T3',
              // Mesma referência (T3) da Parada/Corte deste grupo — o Clear continua do ponto
              // onde a composição já estava, não de um novo zero (ver `EtapaHighlightClear`,
              // `Composition.tsx`).
              apoio: { linha: 'Desvio', referencia: 'T3', travessao: 'T3', direcao: 'EDV', distanciaLabel: 'Distância geométrica', distanciaM: 71 },
            },
            {
              id: 'a1-e4',
              tipo: 'RETIRADA',
              descricao: 'O Maquinista de Manobra e o Operador da Manobra retiram o(s) vagão(ões) VG 4552, VG-4560 e o(s) levam até a Linha 5.',
              tempoEstimado: 'T+00:11',
              grupoVagoes: 'Vagões de cauda · VG 4552 + VG-4560',
              rotaOrigem: 'L3',
              rotaDestino: 'L5',
              distanciaTotalM: 340,
              sentido: 'Empurrando',
              vagoesRetirados: ['VG 4552', 'VG-4560'],
              caminho: [
                { trecho: 'L3 → AMV 12', comprimentoM: 120, distanciaAcumuladaM: 120, destino: 'AMV 12' },
                { trecho: 'AMV 12 → AMV 14', comprimentoM: 95, distanciaAcumuladaM: 215, destino: 'AMV 14' },
                { trecho: 'AMV 14 → L5', comprimentoM: 125, distanciaAcumuladaM: 340, destino: 'L5' },
              ],
              rotas: [
                {
                  titulo: 'Rota 1 — Deslocamento inicial da locomotiva',
                  descricao: 'Desloque a locomotiva até a composição pela Linha 3, cruzando o travessão T3.',
                  segmentos: [
                    { linha: 'Linha 3', distanciaM: 25 },
                    { linha: 'T3', distanciaM: 10, travessao: true },
                    { linha: 'Linha Desvio', distanciaM: 25 },
                  ],
                  destinoFinal: 'Linha Desvio (Ref. T3)',
                  instrucaoFinal: 'Alcance a composição na Linha Desvio, referência T3.',
                  direcao: 'ECJ',
                  direcao2: 'EDV',
                  macro: 23,
                  distanciaTotalM: 60,
                  // Reversão no ponto de conexão real entre Linha 3 e Linha Desvio (não um ponto
                  // arbitrário do plano — pedido explícito, ver `EtapaHighlightRetirada` no mapa).
                  reversao: { local: 'Linha 3', tempoSeg: 90 },
                },
                {
                  titulo: 'Rota 2 — Retirada até o destino',
                  descricao: 'Retire os vagões desengatados pela Linha Desvio, cruzando o travessão T3, até o Estacionamento EHT.',
                  segmentos: [
                    { linha: 'Linha Desvio', distanciaM: 25 },
                    { linha: 'Linha Desvio', distanciaM: 0 },
                    { linha: 'T3', distanciaM: 10, travessao: true },
                    { linha: 'Linha 3', distanciaM: 425 },
                    { linha: 'BRANCH L4 FIM', distanciaM: 10, travessao: true },
                    { linha: 'Linha 4', distanciaM: 25 },
                  ],
                  destinoFinal: 'Estacionamento EHT',
                  direcao: 'EDV',
                  direcao2: 'ECJ',
                  macro: 23,
                  distanciaTotalM: 495,
                  chegada: 'Empurrando',
                  reversao: { local: 'Linha Desvio', tempoSeg: 120 },
                },
              ],
            },
            {
              id: 'a1-e5',
              tipo: 'INCLUSAO',
              descricao: 'O Maquinista de Manobra e o Operador da Manobra incluem o(s) vagão(ões) 342766-8, 241059-1, 603443-8, 602965-5, 060896-3 em substituição.',
              tempoEstimado: 'T+00:16',
              grupoVagoes: 'Reforço · 05 VG',
              rotaOrigem: 'L4',
              rotaDestino: 'L3',
              distanciaTotalM: 210,
              sentido: 'Puxando',
              vagoesIncluidos: ['342766-8', '241059-1', '603443-8', '602965-5', '060896-3'],
              caminho: [
                { trecho: 'L4 → AMV 63', comprimentoM: 25, distanciaAcumuladaM: 25, destino: 'AMV 63' },
                { trecho: 'AMV 63 → L3', comprimentoM: 485, distanciaAcumuladaM: 510, destino: 'L3' },
              ],
              rotas: [
                {
                  titulo: 'Rota 1 — Deslocamento inicial da locomotiva',
                  // Continua do MESMO ponto onde a Rota 2 de Retirada terminou (Estacionamento EHT,
                  // Linha 4) — reaproveitado no destaque do mapa, não recalculado (ver
                  // `EtapaHighlightInclusaoRota1.origemRetiradaRota2`, `Composition.tsx`).
                  descricao: 'Desloque a locomotiva até os vagões de substituição pela Linha 4, cruzando o travessão BRANCH L4 FIM.',
                  segmentos: [
                    { linha: 'Linha 4', distanciaM: 25 },
                    { linha: 'BRANCH L4 FIM', distanciaM: 10, travessao: true },
                    { linha: 'Linha 3', distanciaM: 475 },
                  ],
                  destinoFinal: 'Start Vag Bons EHT',
                  instrucaoFinal: 'Alcance os vagões de substituição na Linha 3, referência BRANCH L4 FIM.',
                  direcao: 'EDV',
                  distanciaTotalM: 510,
                },
                {
                  titulo: 'Rota 2 — Inclusão até o destino',
                  // Continua do MESMO ponto onde a Rota 1 desta etapa terminou (Start Vag Bons EHT,
                  // Linha 3) e fecha o ciclo de volta no MESMO ponto fixo onde a locomotiva partiu
                  // lá na Rota 1 de Retirada — reaproveitado no destaque do mapa, não recalculado
                  // (ver `EtapaHighlightInclusaoRota2.origemInclusaoRota1`, `Composition.tsx`).
                  descricao: 'Leve os vagões de substituição pela Linha 3, cruzando o travessão T3, de volta à Linha Desvio, referência T3.',
                  segmentos: [
                    { linha: 'Linha 3', distanciaM: 50 },
                    { linha: 'Linha 3', distanciaM: 0 },
                    { linha: 'T3', distanciaM: 10, travessao: true },
                    { linha: 'Linha Desvio', distanciaM: 25 },
                  ],
                  destinoFinal: 'Linha Desvio (Ref. T3)',
                  direcao: 'ECJ',
                  direcao2: 'EDV',
                  macro: 23,
                  distanciaTotalM: 85,
                  chegada: 'Empurrando',
                  // Reversão no ponto de conexão real entre Linha 3 e Linha Desvio (mesma
                  // convenção das outras rotas — não um ponto arbitrário do plano).
                  reversao: { local: 'Linha 3', tempoSeg: 120 },
                },
              ],
            },
            {
              id: 'a1-e6',
              tipo: 'FECHAMENTO',
              // Continua do MESMO ponto onde a última rota (Inclusão — Rota 2) terminou (Linha
              // Desvio, referência T3) — reaproveitado no destaque do mapa, não recalculado (ver
              // `EtapaHighlightFechamento.origemInclusaoRota2`, `Composition.tsx`).
              descricao: 'O Operador da Manobra recua a cabeça do trem na Linha Desvio, por 39m, referência T3, para fechar a composição.',
              tempoEstimado: 'T+00:09',
              grupoVagoes: 'Composição consolidada · 01 GT46 + 02 U20 + 09 VG',
              apoio: { linha: 'Desvio', referencia: 'T3', lado: 'head', clearAteTravessaoM: 71, distanciaLabel: 'Recuo', distanciaM: 39 },
            },
          ],
        },
      ],
    },
    {
      id: 'blocoB',
      nome: 'Bloco B',
      locomotivas: 1,
      vagoes: 4 + PASSAGEM_BLOCO_B.length,
      clusters: [
        {
          id: 'b1',
          titulo: 'Grupo 1 — Vagão com avaria de rodeiro',
          resumoProblema: 'VG-88057 · avaria em rodeiro',
          descricaoProblema: 'avaria em rodeiro',
          criticidade: 'Alta',
          composicao: {
            antes: [
              { id: 'GT46-0132', tipo: 'locomotiva' },
              { id: 'VG-88062', tipo: 'vagao' },
              { id: 'VG-88079', tipo: 'vagao' },
              ...PASSAGEM_BLOCO_B,
              { id: 'VG-88057', tipo: 'retirado' },
            ],
            depois: [
              { id: 'GT46-0132', tipo: 'locomotiva' },
              { id: 'VG-88062', tipo: 'vagao' },
              { id: 'VG-88079', tipo: 'vagao' },
              ...PASSAGEM_BLOCO_B,
              { id: 'VG-88500', tipo: 'incluido' },
            ],
          },
          etapas: [
            {
              id: 'b1-e1',
              tipo: 'PARADA',
              descricao: 'O Maquinista do Trem conduz a parada da composição na Linha Desvio, referência T1, a 750m do início do trecho.',
              tempoEstimado: 'T+00:00',
              grupoVagoes: 'Bloco B completo · 01 GT46 + 03 VG',
              apoio: { linha: 'Desvio', referencia: 'T1', direcao: 'ECJ', macro: 17, distanciaLabel: 'Distância', distanciaM: 750 },
            },
            {
              id: 'b1-e2',
              tipo: 'CORTE',
              descricao: 'O Operador da Manobra desengata o(s) vagão(ões) VG-88057, mantendo a composição na Linha Desvio, referência T1.',
              tempoEstimado: 'T+00:05',
              grupoVagoes: 'Vagão avariado · VG-88057',
              vagoesRetirados: ['VG-88057'],
              apoio: { linha: 'Desvio', referencia: 'T1', direcao: 'ECJ', sentido: 'Tail', posCabecaM: 705, cabecaAposCorteM: 34 },
            },
            {
              id: 'b1-e3',
              tipo: 'CLEAR',
              descricao: 'O Maquinista do Trem puxa a cabeça da composição na Linha Desvio, por 150m, até liberar a via de passagem para EVS2 (ETA 2).',
              tempoEstimado: 'T+00:07',
              grupoVagoes: 'Via EVS2 (ETA 2)',
              apoio: { linha: 'Desvio', referencia: 'T1', direcao: 'ECJ', distanciaLabel: 'Distância', distanciaM: 150 },
            },
            {
              id: 'b1-e4',
              tipo: 'RETIRADA',
              descricao: 'O Maquinista de Manobra e o Operador da Manobra retiram o(s) vagão(ões) VG-88057 e o(s) levam até a Linha 7 (manutenção).',
              tempoEstimado: 'T+00:13',
              grupoVagoes: 'Vagão avariado · VG-88057',
              rotaOrigem: 'L4',
              rotaDestino: 'L7',
              distanciaTotalM: 280,
              sentido: 'Empurrando',
              vagoesRetirados: ['VG-88057'],
              caminho: [
                { trecho: 'L4 → AMV 17', comprimentoM: 140, distanciaAcumuladaM: 140, destino: 'AMV 17' },
                { trecho: 'AMV 17 → L7', comprimentoM: 140, distanciaAcumuladaM: 280, destino: 'L7' },
              ],
              // Exemplo de reversão: a locomotiva troca de ponta no travessão antes de seguir
              // pra manutenção — só a Rota 2 (já com o vagão avariado) exige a reversão.
              rotas: gerarRotas({
                tipo: 'RETIRADA', origem: 'Linha 4', destino: 'Linha 7', distanciaTotalM: 280, sentido: 'Empurrando',
                amv: 17, direcao: 'ECJ', macro: 17, reversao: { local: 'T17', tempoSeg: 90 },
              }),
            },
            {
              id: 'b1-e5',
              tipo: 'INCLUSAO',
              descricao: 'O Maquinista de Manobra e o Operador da Manobra incluem o(s) vagão(ões) VG-88500 em substituição.',
              tempoEstimado: 'T+00:18',
              grupoVagoes: 'Reserva · 01 VG',
              rotaOrigem: 'L8',
              rotaDestino: 'L4',
              distanciaTotalM: 200,
              sentido: 'Puxando',
              vagoesIncluidos: ['VG-88500'],
              caminho: [
                { trecho: 'L8 → AMV 21', comprimentoM: 100, distanciaAcumuladaM: 100, destino: 'AMV 21' },
                { trecho: 'AMV 21 → L4', comprimentoM: 100, distanciaAcumuladaM: 200, destino: 'L4' },
              ],
              rotas: gerarRotas({ tipo: 'INCLUSAO', origem: 'Linha 8', destino: 'Linha 4', distanciaTotalM: 200, sentido: 'Puxando', amv: 18, direcao: 'ECJ', macro: 17 }),
            },
            {
              id: 'b1-e6',
              tipo: 'FECHAMENTO',
              descricao: 'O Operador da Manobra recua a cabeça do trem na Linha Desvio, por 140m, referência T1, para fechar a composição.',
              tempoEstimado: 'T+00:22',
              grupoVagoes: 'Bloco B consolidado · 01 GT46 + 03 VG',
              apoio: { linha: 'Desvio', referencia: 'T1', direcao: 'ECJ', lado: 'tail', clearAteTravessaoM: 35, distanciaLabel: 'Recuo', distanciaM: 140 },
            },
          ],
        },
        {
          id: 'b2',
          titulo: 'Grupo 2 — Vagão retido por restrição SAP',
          resumoProblema: 'VG-88079 · restrição de velocidade (eixo trincado)',
          descricaoProblema: 'restrição de velocidade (eixo trincado)',
          criticidade: 'Média',
          composicao: {
            antes: [
              { id: 'GT46-0132', tipo: 'locomotiva' },
              { id: 'VG-88062', tipo: 'vagao' },
              { id: 'VG-88500', tipo: 'vagao' },
              ...PASSAGEM_BLOCO_B,
              { id: 'VG-88079', tipo: 'retirado' },
            ],
            depois: [
              { id: 'GT46-0132', tipo: 'locomotiva' },
              { id: 'VG-88062', tipo: 'vagao' },
              { id: 'VG-88500', tipo: 'vagao' },
              ...PASSAGEM_BLOCO_B,
              { id: 'VG-88510', tipo: 'incluido' },
            ],
          },
          etapas: [
            {
              id: 'b2-e1',
              tipo: 'PARADA',
              descricao: 'O Maquinista do Trem conduz a parada da composição na Linha Desvio, referência T1, a 1050m do início do trecho.',
              tempoEstimado: 'T+00:00',
              grupoVagoes: 'Bloco B completo · 01 GT46 + 03 VG',
              apoio: { linha: 'Desvio', referencia: 'T1', direcao: 'EDV', macro: 19, distanciaLabel: 'Distância', distanciaM: 1050 },
            },
            {
              id: 'b2-e2',
              tipo: 'CORTE',
              descricao: 'O Operador da Manobra desengata o(s) vagão(ões) VG-88079, mantendo a composição na Linha Desvio, referência T1.',
              tempoEstimado: 'T+00:03',
              grupoVagoes: 'Vagão retido · VG-88079',
              vagoesRetirados: ['VG-88079'],
              apoio: { linha: 'Desvio', referencia: 'T1', direcao: 'EDV', sentido: 'Head', posCabecaM: 985, cabecaAposCorteM: 23 },
            },
            {
              id: 'b2-e3',
              tipo: 'CLEAR',
              descricao: 'O Maquinista do Trem puxa a cabeça da composição na Linha Desvio, por 80m, até liberar a via de passagem para EVS3 (ETA 3).',
              tempoEstimado: 'T+00:05',
              grupoVagoes: 'Via EVS3 (ETA 3)',
              apoio: { linha: 'Desvio', referencia: 'T1', direcao: 'EDV', distanciaLabel: 'Distância', distanciaM: 80 },
            },
            {
              id: 'b2-e4',
              tipo: 'RETIRADA',
              descricao: 'O Maquinista de Manobra e o Operador da Manobra retiram o(s) vagão(ões) VG-88079 e o(s) levam até a Linha 6 (aguardar liberação SAP).',
              tempoEstimado: 'T+00:10',
              grupoVagoes: 'Vagão retido · VG-88079',
              rotaOrigem: 'L4',
              rotaDestino: 'L6',
              distanciaTotalM: 190,
              sentido: 'Empurrando',
              vagoesRetirados: ['VG-88079'],
              caminho: [
                { trecho: 'L4 → AMV 19', comprimentoM: 95, distanciaAcumuladaM: 95, destino: 'AMV 19' },
                { trecho: 'AMV 19 → L6', comprimentoM: 95, distanciaAcumuladaM: 190, destino: 'L6' },
              ],
              rotas: gerarRotas({ tipo: 'RETIRADA', origem: 'Linha 4', destino: 'Linha 6', distanciaTotalM: 190, sentido: 'Empurrando', amv: 19, direcao: 'EDV', macro: 19 }),
            },
            {
              id: 'b2-e5',
              tipo: 'INCLUSAO',
              descricao: 'O Maquinista de Manobra e o Operador da Manobra incluem o(s) vagão(ões) VG-88510 em substituição.',
              tempoEstimado: 'T+00:12',
              grupoVagoes: 'Avulso · 01 VG',
              rotaOrigem: 'L9',
              rotaDestino: 'L4',
              distanciaTotalM: 150,
              sentido: 'Puxando',
              vagoesIncluidos: ['VG-88510'],
              caminho: [
                { trecho: 'L9 → L4', comprimentoM: 150, distanciaAcumuladaM: 150, destino: 'L4' },
              ],
              rotas: gerarRotas({ tipo: 'INCLUSAO', origem: 'Linha 9', destino: 'Linha 4', distanciaTotalM: 150, sentido: 'Puxando', amv: 20, direcao: 'EDV', macro: 19 }),
            },
            {
              id: 'b2-e6',
              tipo: 'FECHAMENTO',
              descricao: 'O Operador da Manobra recua a cabeça do trem na Linha Desvio, por 65m, referência T1, para fechar a composição.',
              tempoEstimado: 'T+00:14',
              grupoVagoes: 'Bloco B consolidado · 01 GT46 + 03 VG',
              apoio: { linha: 'Desvio', referencia: 'T1', direcao: 'EDV', lado: 'head', clearAteTravessaoM: 16, distanciaLabel: 'Recuo', distanciaM: 65 },
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Fábrica de um plano simples (1 bloco, 1 cluster, 6 etapas) para os trens que ainda não têm
 * um mock narrativo dedicado como o do J614 — usada só para a barra de seleção de trem ter
 * algo real para mostrar ao trocar de trem, não para riqueza de detalhe.
 *
 * `vagoesTotais`/`locomotivas` default pro mesmo volume realista do J614 (~40-50 vagões, 1-2
 * locomotivas por trem inteiro, ver a tabela da Ficha Operacional em `fichaOperacao.ts`) — um
 * trem com só 1 locomotiva + 2 vagões no mapa é irreal e, de quebra, deixa o zoom automático de
 * enquadramento (Nível 1, ver `focus.ts`/`PlanejamentoScreen.tsx`) precisando de um multiplicador
 * enorme (composição minúscula perto do pátio inteiro) — bem diferente do multiplicador modesto
 * que o J614 (composição grande) já recebia, dando a falsa impressão de que só ELE não tinha
 * zoom. Igualando o volume de todos os trens, o comportamento de zoom fica consistente entre eles.
 * Preenchido com "vagões de passagem" (mesma técnica de `PASSAGEM_BLOCO_A/B` do J614) — só os
 * poucos vagões nomeados no enredo (`vagaoProblema`) continuam sendo os únicos com etapa.
 */
function planoSimples(params: {
  trem: string;
  os: string;
  criticidade: CriticidadeCluster;
  resumoProblema: string;
  vagaoProblema: string;
  locomotivas?: 1 | 2;
  vagoesTotais?: number;
}): PlanoManobra {
  const { trem, os, criticidade, resumoProblema, vagaoProblema, locomotivas = 1, vagoesTotais = 44 } = params;
  const locoItens: ItemComposicao[] =
    locomotivas === 2
      ? [
          { id: `${trem}-LOCO1`, tipo: 'locomotiva' },
          { id: `${trem}-LOCO2`, tipo: 'locomotiva' },
        ]
      : [{ id: `${trem}-LOCO`, tipo: 'locomotiva' }];
  // Base própria por trem (soma dos char codes do nome) — só pra não colidir com os ids de
  // passagem de outro trem se algum dia aparecerem lado a lado (hoje nunca aparecem: só a
  // composição do trem selecionado é desenhada por vez no mapa).
  const baseParaPassagem = 700000 + [...trem].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) * 100;
  // -2 (VG01/VG02 nomeados) -1 (o vagão com problema, ainda fisicamente presente — ver
  // `derivarVeiculosDoBloco`) = quantos vagões de passagem faltam pra fechar o total pedido.
  const vagoesPassagem = vagoesDePassagem(baseParaPassagem, Math.max(0, vagoesTotais - 3));
  return {
    trem,
    os,
    blocos: [
      {
        id: 'blocoA',
        nome: 'Bloco A',
        locomotivas,
        vagoes: vagoesTotais,
        clusters: [
          {
            id: `${trem}-c1`,
            titulo: `Grupo 1 — ${resumoProblema}`,
            resumoProblema: `${vagaoProblema} · ${resumoProblema.toLowerCase()}`,
            descricaoProblema: resumoProblema.toLowerCase(),
            criticidade,
            composicao: {
              antes: [
                ...locoItens,
                { id: `${trem}-VG01`, tipo: 'vagao' },
                { id: `${trem}-VG02`, tipo: 'vagao' },
                ...vagoesPassagem,
                { id: vagaoProblema, tipo: 'retirado' },
              ],
              depois: [
                ...locoItens,
                { id: `${trem}-VG01`, tipo: 'vagao' },
                { id: `${trem}-VG02`, tipo: 'vagao' },
                ...vagoesPassagem,
                { id: `${trem}-VG03`, tipo: 'incluido' },
              ],
            },
            etapas: [
              { id: `${trem}-e1`, tipo: 'PARADA', descricao: `O Maquinista do Trem conduz a parada da composição na Linha Desvio, referência T1, a 540m do início do trecho.`, tempoEstimado: 'T+00:00', grupoVagoes: `Composição completa · ${String(locomotivas).padStart(2, '0')} GT46 + ${String(vagoesTotais).padStart(2, '0')} VG`, apoio: { linha: 'Desvio', referencia: 'T1', direcao: 'EDV', macro: 10, distanciaLabel: 'Distância', distanciaM: 540 } },
              { id: `${trem}-e2`, tipo: 'CORTE', descricao: `O Operador da Manobra desengata o(s) vagão(ões) ${vagaoProblema}, mantendo a composição na Linha Desvio, referência T1.`, tempoEstimado: 'T+00:04', grupoVagoes: `Vagão avariado (${resumoProblema.toLowerCase()}) · ${vagaoProblema}`, vagoesRetirados: [vagaoProblema], apoio: { linha: 'Desvio', referencia: 'T1', direcao: 'EDV', sentido: 'Head', posCabecaM: 508, cabecaAposCorteM: 36 } },
              { id: `${trem}-e3`, tipo: 'CLEAR', descricao: `O Maquinista do Trem puxa a cabeça da composição na Linha Desvio, por 150m, até liberar a via de passagem.`, tempoEstimado: 'T+00:06', grupoVagoes: `Via de passagem`, apoio: { linha: 'Desvio', referencia: 'T1', direcao: 'EDV', distanciaLabel: 'Distância', distanciaM: 150 } },
              {
                id: `${trem}-e4`, tipo: 'RETIRADA', descricao: `O Maquinista de Manobra e o Operador da Manobra retiram o(s) vagão(ões) ${vagaoProblema} e o(s) levam até a Linha 5.`, tempoEstimado: 'T+00:11', grupoVagoes: `Vagão avariado · ${vagaoProblema}`,
                rotaOrigem: 'L3', rotaDestino: 'L5', distanciaTotalM: 300, sentido: 'Empurrando', vagoesRetirados: [vagaoProblema],
                rotas: gerarRotas({ tipo: 'RETIRADA', origem: 'Linha 3', destino: 'Linha 5', distanciaTotalM: 300, sentido: 'Empurrando', amv: 10, direcao: 'EDV', macro: 10 }),
              },
              {
                id: `${trem}-e5`, tipo: 'INCLUSAO', descricao: `O Maquinista de Manobra e o Operador da Manobra incluem o(s) vagão(ões) ${trem}-VG03 em substituição.`, tempoEstimado: 'T+00:16', grupoVagoes: `Reforço · 01 VG`,
                rotaOrigem: 'L6', rotaDestino: 'L2', distanciaTotalM: 200, sentido: 'Puxando', vagoesIncluidos: [`${trem}-VG03`],
                rotas: gerarRotas({ tipo: 'INCLUSAO', origem: 'Linha 6', destino: 'Linha 2', distanciaTotalM: 200, sentido: 'Puxando', amv: 11, direcao: 'EDV', macro: 10 }),
              },
              { id: `${trem}-e6`, tipo: 'FECHAMENTO', descricao: `O Operador da Manobra recua a cabeça do trem na Linha Desvio, por 170m, referência T1, para fechar a composição.`, tempoEstimado: 'T+00:20', grupoVagoes: `Composição consolidada · ${String(locomotivas).padStart(2, '0')} GT46 + ${String(vagoesTotais).padStart(2, '0')} VG`, apoio: { linha: 'Desvio', referencia: 'T1', direcao: 'EDV', lado: 'head', clearAteTravessaoM: 43, distanciaLabel: 'Recuo', distanciaM: 170 } },
            ],
          },
        ],
      },
    ],
  };
}

/** Uma rota de Retirada/Inclusão — mesmos campos usados nas etapas do J614
 *  (`rotaOrigem`/`rotaDestino`/`distanciaTotalM`/`sentido`/`caminho`). */
interface RotaEtapa {
  origem: string;
  destino: string;
  distanciaM: number;
  sentido: 'Puxando' | 'Empurrando';
}

/** Divide `distanciaTotalM` em 2 trechos plausíveis via um AMV intermediário — mesmo estilo dos
 *  `caminho` escritos à mão no J614, só que derivado em vez de repetido por Grupo. */
function gerarCaminho(origem: string, destino: string, distanciaTotalM: number, amv: number): TrechoCaminho[] {
  const primeiroTrecho = Math.round(distanciaTotalM * 0.55);
  return [
    { trecho: `${origem} → AMV ${amv}`, comprimentoM: primeiroTrecho, distanciaAcumuladaM: primeiroTrecho, destino: `AMV ${amv}` },
    { trecho: `AMV ${amv} → ${destino}`, comprimentoM: distanciaTotalM - primeiroTrecho, distanciaAcumuladaM: distanciaTotalM, destino },
  ];
}

/**
 * Especificação compacta de um Grupo (Cluster) rico — usada por `construirBlocoRico` para gerar
 * as 6 etapas completas (Parada/Corte/Clear/Retirada/Inclusão/Fechamento), no mesmo nível de
 * detalhe já escrito à mão para o J614 (`planoManobraMock`, acima), sem repetir a mesma estrutura
 * por extenso a cada Grupo — só a narrativa (problema/rota/vagões) muda entre eles.
 */
interface EspecificacaoGrupo {
  id: string;
  resumoProblema: string;
  criticidade: CriticidadeCluster;
  /** Vagão(ões) com problema — os MESMOS ids precisam estar marcados `aRetirar: true` na Ficha
   *  Operacional deste trem (`fichaOperacao.ts`): pedido explícito de consistência entre as duas
   *  telas (o vagão "a retirar" na Ficha é o mesmo retirado neste Grupo do Planejamento). */
  vagoesRetirados: string[];
  /** Vagões de substituição — ainda não existem fisicamente no trem (mesma regra do J614: não
   *  aparecem na Ficha Operacional, só entram quando a etapa de Inclusão rodar). */
  vagoesIncluidos: string[];
  motivoCorte: string;
  viaClear: string;
  amv: number;
  rotaRetirada: RotaEtapa;
  rotaInclusao: RotaEtapa;
}

interface EspecificacaoBloco {
  id: string;
  nome: string;
  locomotiva: string;
  /** 2 vagões sem problema, só para a composição "antes/depois" ter contexto além dos vagões de
   *  passagem (mesmo papel de VG-88011/VG-88034 no Bloco A do J614). */
  vagoesNormais: [string, string];
  passagemInicio: number;
  passagemQuantidade: number;
  grupos: EspecificacaoGrupo[];
}

/** Constrói um Cluster completo (composição antes/depois + 6 etapas) a partir de
 *  `EspecificacaoGrupo` — mesmos offsets de tempo do Grupo 1 do J614 (T+00/04/06/11/16/20) para
 *  todos os Grupos gerados aqui; não precisa variar, já que cada Cluster conta o tempo a partir
 *  do PRÓPRIO início (T+0), não de um relógio global do trem (ver `duracaoClusterMin`). */
function construirGrupoRico(blocoId: string, blocoNome: string, indice: number, passagem: ItemComposicao[], vagoesNormais: [string, string], locomotiva: string, spec: EspecificacaoGrupo): ClusterManobra {
  const retiradosTxt = spec.vagoesRetirados.join(' e ');
  const incluidosTxt = spec.vagoesIncluidos.join(' e ');
  const totalVagoesBloco = vagoesNormais.length + passagem.length + spec.vagoesRetirados.length;
  const resumoComposicao = `01 GT46 + ${String(totalVagoesBloco).padStart(2, '0')} VG`;
  const grupoId = `${blocoId}-g${indice + 1}`;
  // Campos de apoio/rotas ricos (painel "Sequência de Manobra" na tela) — derivados dos mesmos
  // parâmetros da especificação, sem precisar escrever à mão pra cada Grupo gerado.
  const direcao: string = indice % 2 === 0 ? 'EDV' : 'ECJ';
  const referencia = `T${indice + 1}`;
  const distanciaParadaM = Math.round(spec.rotaRetirada.distanciaM * 1.8);
  const distanciaClearM = Math.round(spec.rotaRetirada.distanciaM * 0.5);
  const recuoFechamentoM = Math.round(spec.rotaInclusao.distanciaM * 0.85);
  return {
    id: grupoId,
    titulo: `Grupo ${indice + 1} — ${spec.resumoProblema}`,
    resumoProblema: `${retiradosTxt} · ${spec.resumoProblema.toLowerCase()}`,
    descricaoProblema: spec.resumoProblema.toLowerCase(),
    criticidade: spec.criticidade,
    composicao: {
      antes: [
        { id: locomotiva, tipo: 'locomotiva' },
        { id: vagoesNormais[0], tipo: 'vagao' },
        { id: vagoesNormais[1], tipo: 'vagao' },
        ...passagem,
        ...spec.vagoesRetirados.map((id) => ({ id, tipo: 'retirado' as const })),
      ],
      depois: [
        { id: locomotiva, tipo: 'locomotiva' },
        { id: vagoesNormais[0], tipo: 'vagao' },
        { id: vagoesNormais[1], tipo: 'vagao' },
        ...passagem,
        ...spec.vagoesIncluidos.map((id) => ({ id, tipo: 'incluido' as const })),
      ],
    },
    etapas: [
      {
        id: `${grupoId}-e1`,
        tipo: 'PARADA',
        descricao: `O Maquinista do Trem conduz a parada da composição na Linha Desvio, referência ${referencia}, a ${distanciaParadaM}m do início do trecho.`,
        tempoEstimado: 'T+00:00',
        grupoVagoes: `${blocoNome} completo · ${resumoComposicao}`,
        apoio: { linha: 'Desvio', referencia, direcao, macro: spec.amv, distanciaLabel: 'Distância', distanciaM: distanciaParadaM },
      },
      {
        id: `${grupoId}-e2`,
        tipo: 'CORTE',
        descricao: `O Operador da Manobra desengata o(s) vagão(ões) ${retiradosTxt}, mantendo a composição na Linha Desvio, referência ${referencia}.`,
        tempoEstimado: 'T+00:04',
        grupoVagoes: `Vagão${spec.vagoesRetirados.length > 1 ? 'ões' : ''} com problema (${spec.motivoCorte}) · ${retiradosTxt}`,
        vagoesRetirados: spec.vagoesRetirados,
        apoio: {
          linha: 'Desvio', referencia, direcao,
          sentido: indice % 2 === 0 ? 'Head' : 'Tail',
          posCabecaM: Math.round(distanciaParadaM * 0.94),
          cabecaAposCorteM: Math.max(20, Math.round(spec.rotaRetirada.distanciaM * 0.12)),
        },
      },
      {
        id: `${grupoId}-e3`,
        tipo: 'CLEAR',
        descricao: `O Maquinista do Trem puxa a cabeça da composição na Linha Desvio, por ${distanciaClearM}m, até liberar a via de passagem para ${spec.viaClear}.`,
        tempoEstimado: 'T+00:06',
        grupoVagoes: `Via ${spec.viaClear}`,
        apoio: { linha: 'Desvio', referencia, direcao, distanciaLabel: 'Distância', distanciaM: distanciaClearM },
      },
      {
        id: `${grupoId}-e4`,
        tipo: 'RETIRADA',
        descricao: `O Maquinista de Manobra e o Operador da Manobra retiram o(s) vagão(ões) ${retiradosTxt} e o(s) levam até a ${nomeLinha(spec.rotaRetirada.destino)}.`,
        tempoEstimado: 'T+00:11',
        grupoVagoes: `Vagão${spec.vagoesRetirados.length > 1 ? 'ões' : ''} com problema · ${retiradosTxt}`,
        rotaOrigem: spec.rotaRetirada.origem,
        rotaDestino: spec.rotaRetirada.destino,
        distanciaTotalM: spec.rotaRetirada.distanciaM,
        sentido: spec.rotaRetirada.sentido,
        vagoesRetirados: spec.vagoesRetirados,
        caminho: gerarCaminho(spec.rotaRetirada.origem, spec.rotaRetirada.destino, spec.rotaRetirada.distanciaM, spec.amv),
        rotas: gerarRotas({
          tipo: 'RETIRADA', origem: nomeLinha(spec.rotaRetirada.origem), destino: nomeLinha(spec.rotaRetirada.destino),
          distanciaTotalM: spec.rotaRetirada.distanciaM, sentido: spec.rotaRetirada.sentido, amv: spec.amv, direcao, macro: spec.amv,
        }),
      },
      {
        id: `${grupoId}-e5`,
        tipo: 'INCLUSAO',
        descricao: `O Maquinista de Manobra e o Operador da Manobra incluem o(s) vagão(ões) ${incluidosTxt} em substituição.`,
        tempoEstimado: 'T+00:16',
        grupoVagoes: `Reforço · ${String(spec.vagoesIncluidos.length).padStart(2, '0')} VG`,
        rotaOrigem: spec.rotaInclusao.origem,
        rotaDestino: spec.rotaInclusao.destino,
        distanciaTotalM: spec.rotaInclusao.distanciaM,
        sentido: spec.rotaInclusao.sentido,
        vagoesIncluidos: spec.vagoesIncluidos,
        caminho: gerarCaminho(spec.rotaInclusao.origem, spec.rotaInclusao.destino, spec.rotaInclusao.distanciaM, spec.amv + 1),
        rotas: gerarRotas({
          tipo: 'INCLUSAO', origem: nomeLinha(spec.rotaInclusao.origem), destino: nomeLinha(spec.rotaInclusao.destino),
          distanciaTotalM: spec.rotaInclusao.distanciaM, sentido: spec.rotaInclusao.sentido, amv: spec.amv + 1, direcao, macro: spec.amv,
        }),
      },
      {
        id: `${grupoId}-e6`,
        tipo: 'FECHAMENTO',
        descricao: `O Operador da Manobra recua a cabeça do trem na Linha Desvio, por ${recuoFechamentoM}m, referência ${referencia}, para fechar a composição.`,
        tempoEstimado: 'T+00:20',
        grupoVagoes: `${blocoNome} consolidado · ${resumoComposicao}`,
        apoio: {
          linha: 'Desvio', referencia, direcao,
          lado: indice % 2 === 0 ? 'head' : 'tail',
          clearAteTravessaoM: Math.max(15, Math.round(recuoFechamentoM * 0.25)),
          distanciaLabel: 'Recuo', distanciaM: recuoFechamentoM,
        },
      },
    ],
  };
}

/** Constrói um Bloco completo (locomotiva + vagões normais + vagões de passagem + N Grupos) a
 *  partir de `EspecificacaoBloco` — mesma composição de camadas usada à mão nos dois Blocos do
 *  J614, só que parametrizada. */
function construirBlocoRico(spec: EspecificacaoBloco): BlocoManobra {
  const passagem = vagoesDePassagem(spec.passagemInicio, spec.passagemQuantidade);
  const clusters = spec.grupos.map((g, i) => construirGrupoRico(spec.id, spec.nome, i, passagem, spec.vagoesNormais, spec.locomotiva, g));
  const totalRetirados = spec.grupos.reduce((soma, g) => soma + g.vagoesRetirados.length, 0);
  return {
    id: spec.id,
    nome: spec.nome,
    locomotivas: 1,
    vagoes: spec.vagoesNormais.length + passagem.length + totalRetirados,
    clusters,
  };
}

/** Monta o `PlanoManobra` inteiro de um trem a partir de 2-3 `EspecificacaoBloco` — mesmo
 *  formato de `planoManobraMock` (J614), reutilizado pros demais trens com mock narrativo rico
 *  (ver `planosManobraMock` abaixo). */
function construirPlanoRico(trem: string, os: string, blocos: EspecificacaoBloco[]): PlanoManobra {
  return { trem, os, blocos: blocos.map(construirBlocoRico) };
}

/**
 * Um plano por trem — chave usada pela barra de seleção de trem no card Plano Manobra X.
 * J614 e os 6 trens abaixo (mesmo pátio, mesmo turno) têm mock narrativo rico — 2-3 Blocos, 1-3
 * Grupos por Bloco, sequência de manobra completa (ver `construirPlanoRico`); os demais ainda
 * usam `planoSimples` (1 único Bloco/Grupo) até ganharem o mesmo tratamento.
 */
const TODOS_OS_PLANOS_MOCK: Record<string, PlanoManobra> = {
  J614: planoManobraMock,
  // Formato exclusivo (38 passos lineares, sem Bloco/Grupo na tela) — ver `planoManobraJ105.ts`.
  J105: construirPlanoJ105(),
  // J105 V2 — MESMO plano de 38 passos do V1 (mesma função, mesmos ids de etapa); o que muda é
  // só a Visão Topológica, que nele é animada numa linha do tempo contínua em vez de estados
  // estáticos por passo (ver `animacaoJ105.ts`). Trem separado e independente na lista: nada aqui
  // altera o V1.
  [TREM_J105_V2]: construirPlanoJ105(TREM_J105_V2, '50092902'),
  R045: construirPlanoRico('R045', '9915/2026', [
    {
      id: 'blocoA',
      nome: 'Bloco A',
      locomotiva: 'GT46-0148',
      vagoesNormais: ['VG-91005', 'VG-91008'],
      passagemInicio: 910000,
      passagemQuantidade: 22,
      grupos: [
        {
          id: 'g1',
          resumoProblema: 'Restrição de carga — capacidade reduzida em 15%',
          criticidade: 'Média',
          vagoesRetirados: ['VG-91017'],
          vagoesIncluidos: ['VG-91201'],
          motivoCorte: 'restrição de carga',
          viaClear: 'EVS4',
          amv: 31,
          rotaRetirada: { origem: 'L2', destino: 'L5', distanciaM: 260, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L6', destino: 'L2', distanciaM: 190, sentido: 'Puxando' },
        },
        {
          id: 'g2',
          resumoProblema: 'Pendência de inspeção periódica',
          criticidade: 'Baixa',
          vagoesRetirados: ['VG-91023'],
          vagoesIncluidos: ['VG-91202'],
          motivoCorte: 'pendência de inspeção',
          viaClear: 'EVS5',
          amv: 33,
          rotaRetirada: { origem: 'L2', destino: 'L6', distanciaM: 210, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L7', destino: 'L2', distanciaM: 160, sentido: 'Puxando' },
        },
      ],
    },
    {
      id: 'blocoB',
      nome: 'Bloco B',
      locomotiva: 'GT46-0149',
      vagoesNormais: ['VG-91060', 'VG-91065'],
      passagemInicio: 913000,
      passagemQuantidade: 24,
      grupos: [
        {
          id: 'g1',
          resumoProblema: 'Vagão aguardando tração — impedido de seguir viagem',
          criticidade: 'Alta',
          vagoesRetirados: ['VG-91050'],
          vagoesIncluidos: ['VG-91203'],
          motivoCorte: 'aguardando tração',
          viaClear: 'EVS6',
          amv: 35,
          rotaRetirada: { origem: 'L4', destino: 'L7', distanciaM: 300, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L8', destino: 'L4', distanciaM: 210, sentido: 'Puxando' },
        },
      ],
    },
  ]),
  J300: construirPlanoRico('J300', '9931/2026', [
    {
      id: 'blocoA',
      nome: 'Bloco A',
      locomotiva: 'GT46-0155',
      vagoesNormais: ['VG-77320', 'VG-77330'],
      passagemInicio: 773000,
      passagemQuantidade: 24,
      grupos: [
        {
          id: 'g1',
          resumoProblema: 'Roda com desgaste acima do limite',
          criticidade: 'Alta',
          vagoesRetirados: ['VG-77318'],
          vagoesIncluidos: ['VG-77401'],
          motivoCorte: 'desgaste hollow acima do limite',
          viaClear: 'EVS2',
          amv: 41,
          rotaRetirada: { origem: 'L3', destino: 'L6', distanciaM: 290, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L7', destino: 'L3', distanciaM: 200, sentido: 'Puxando' },
        },
      ],
    },
    {
      id: 'blocoB',
      nome: 'Bloco B',
      locomotiva: 'GT46-0156',
      vagoesNormais: ['VG-77350', 'VG-77360'],
      passagemInicio: 776000,
      passagemQuantidade: 22,
      grupos: [
        {
          id: 'g1',
          resumoProblema: 'Mangueira de freio com vazamento',
          criticidade: 'Alta',
          vagoesRetirados: ['VG-77455'],
          vagoesIncluidos: ['VG-77402'],
          motivoCorte: 'mangueira de freio danificada',
          viaClear: 'EVS3',
          amv: 43,
          rotaRetirada: { origem: 'L4', destino: 'L7', distanciaM: 270, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L8', destino: 'L4', distanciaM: 190, sentido: 'Puxando' },
        },
        {
          id: 'g2',
          resumoProblema: 'Etiqueta de campanha — substituição preventiva programada',
          criticidade: 'Baixa',
          vagoesRetirados: ['VG-77470'],
          vagoesIncluidos: ['VG-77403'],
          motivoCorte: 'campanha de manutenção preventiva',
          viaClear: 'EVS5',
          amv: 45,
          rotaRetirada: { origem: 'L4', destino: 'L9', distanciaM: 230, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L9', destino: 'L4', distanciaM: 180, sentido: 'Puxando' },
        },
      ],
    },
  ]),
  J420: construirPlanoRico('J420', '9988/2026', [
    {
      id: 'blocoA',
      nome: 'Bloco A',
      locomotiva: 'GT46-0330',
      vagoesNormais: ['VG-95505', 'VG-95508'],
      passagemInicio: 955000,
      passagemQuantidade: 23,
      grupos: [
        {
          id: 'g1',
          resumoProblema: 'Ruído anormal no rolamento — monitorar durante o trajeto',
          criticidade: 'Média',
          vagoesRetirados: ['VG-95511'],
          vagoesIncluidos: ['VG-95601'],
          motivoCorte: 'ruído anormal no rolamento',
          viaClear: 'EVS1',
          amv: 51,
          rotaRetirada: { origem: 'L2', destino: 'L5', distanciaM: 250, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L6', destino: 'L2', distanciaM: 180, sentido: 'Puxando' },
        },
      ],
    },
    {
      id: 'blocoB',
      nome: 'Bloco B',
      locomotiva: 'GT46-0331',
      vagoesNormais: ['VG-95530', 'VG-95540'],
      passagemInicio: 956000,
      passagemQuantidade: 23,
      grupos: [
        {
          id: 'g1',
          resumoProblema: 'Sensor de temperatura do rodeiro com falha',
          criticidade: 'Alta',
          vagoesRetirados: ['VG-95560'],
          vagoesIncluidos: ['VG-95602'],
          motivoCorte: 'falha no sensor de temperatura',
          viaClear: 'EVS3',
          amv: 53,
          rotaRetirada: { origem: 'L4', destino: 'L7', distanciaM: 290, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L8', destino: 'L4', distanciaM: 210, sentido: 'Puxando' },
        },
      ],
    },
    {
      id: 'blocoC',
      nome: 'Bloco C',
      locomotiva: 'GT46-0332',
      vagoesNormais: ['VG-95570', 'VG-95580'],
      passagemInicio: 957000,
      passagemQuantidade: 22,
      grupos: [
        {
          id: 'g1',
          resumoProblema: 'Mangueira de freio com vazamento',
          criticidade: 'Alta',
          vagoesRetirados: ['VG-95610'],
          vagoesIncluidos: ['VG-95603'],
          motivoCorte: 'vazamento na mangueira de freio',
          viaClear: 'EVS6',
          amv: 55,
          rotaRetirada: { origem: 'L5', destino: 'L9', distanciaM: 260, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L9', destino: 'L5', distanciaM: 200, sentido: 'Puxando' },
        },
      ],
    },
  ]),
  R150: construirPlanoRico('R150', '9990/2026', [
    {
      id: 'blocoA',
      nome: 'Bloco A',
      locomotiva: 'GT46-0512',
      vagoesNormais: ['VG-96210', 'VG-96220'],
      passagemInicio: 962000,
      passagemQuantidade: 24,
      grupos: [
        {
          id: 'g1',
          resumoProblema: 'Mangueira de freio com ruptura — troca obrigatória antes da liberação',
          criticidade: 'Alta',
          vagoesRetirados: ['VG-96204'],
          vagoesIncluidos: ['VG-96301'],
          motivoCorte: 'mangueira de freio com ruptura',
          viaClear: 'EVS2',
          amv: 61,
          rotaRetirada: { origem: 'L2', destino: 'L6', distanciaM: 270, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L7', destino: 'L2', distanciaM: 190, sentido: 'Puxando' },
        },
        {
          id: 'g2',
          resumoProblema: 'Campanha de manutenção preventiva — sem impacto operacional',
          criticidade: 'Baixa',
          vagoesRetirados: ['VG-96240'],
          vagoesIncluidos: ['VG-96302'],
          motivoCorte: 'campanha de manutenção preventiva',
          viaClear: 'EVS4',
          amv: 63,
          rotaRetirada: { origem: 'L2', destino: 'L8', distanciaM: 230, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L9', destino: 'L2', distanciaM: 170, sentido: 'Puxando' },
        },
      ],
    },
    {
      id: 'blocoB',
      nome: 'Bloco B',
      locomotiva: 'GT46-0513',
      vagoesNormais: ['VG-96260', 'VG-96270'],
      passagemInicio: 965000,
      passagemQuantidade: 23,
      grupos: [
        {
          id: 'g1',
          resumoProblema: 'Avaria em rodeiro — cuidado ao manobrar',
          criticidade: 'Alta',
          vagoesRetirados: ['VG-96410'],
          vagoesIncluidos: ['VG-96303'],
          motivoCorte: 'avaria em rodeiro',
          viaClear: 'EVS5',
          amv: 65,
          rotaRetirada: { origem: 'L4', destino: 'L7', distanciaM: 280, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L8', destino: 'L4', distanciaM: 200, sentido: 'Puxando' },
        },
        {
          id: 'g2',
          resumoProblema: 'Pendência de inspeção periódica',
          criticidade: 'Baixa',
          vagoesRetirados: ['VG-96450'],
          vagoesIncluidos: ['VG-96304'],
          motivoCorte: 'pendência de inspeção',
          viaClear: 'EVS6',
          amv: 67,
          rotaRetirada: { origem: 'L4', destino: 'L9', distanciaM: 220, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L9', destino: 'L4', distanciaM: 160, sentido: 'Puxando' },
        },
      ],
    },
  ]),
  J275: construirPlanoRico('J275', '9993/2026', [
    {
      id: 'blocoA',
      nome: 'Bloco A',
      locomotiva: 'GT46-0087',
      vagoesNormais: ['VG-85105', 'VG-85108'],
      passagemInicio: 851000,
      passagemQuantidade: 24,
      grupos: [
        {
          id: 'g1',
          resumoProblema: 'Roda com desgaste acima do limite',
          criticidade: 'Alta',
          vagoesRetirados: ['VG-85110'],
          vagoesIncluidos: ['VG-85201'],
          motivoCorte: 'desgaste hollow acima do limite',
          viaClear: 'EVS1',
          amv: 71,
          rotaRetirada: { origem: 'L2', destino: 'L5', distanciaM: 260, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L6', destino: 'L2', distanciaM: 190, sentido: 'Puxando' },
        },
      ],
    },
    {
      id: 'blocoB',
      nome: 'Bloco B',
      locomotiva: 'GT46-0088',
      vagoesNormais: ['VG-85210', 'VG-85220'],
      passagemInicio: 854000,
      passagemQuantidade: 23,
      grupos: [
        {
          id: 'g1',
          resumoProblema: 'Restrição de velocidade — eixo trincado',
          criticidade: 'Média',
          vagoesRetirados: ['VG-85260'],
          vagoesIncluidos: ['VG-85202'],
          motivoCorte: 'trinca em eixo',
          viaClear: 'EVS3',
          amv: 73,
          rotaRetirada: { origem: 'L4', destino: 'L7', distanciaM: 300, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L8', destino: 'L4', distanciaM: 210, sentido: 'Puxando' },
        },
      ],
    },
  ]),
  R088: construirPlanoRico('R088', '9996/2026', [
    {
      id: 'blocoA',
      nome: 'Bloco A',
      locomotiva: 'GT46-0640',
      vagoesNormais: ['VG-97205', 'VG-97208'],
      passagemInicio: 972000,
      passagemQuantidade: 22,
      grupos: [
        {
          id: 'g1',
          resumoProblema: 'Mangueira de freio com ruptura — troca obrigatória antes da liberação',
          criticidade: 'Alta',
          vagoesRetirados: ['VG-97210'],
          vagoesIncluidos: ['VG-97401'],
          motivoCorte: 'mangueira de freio com ruptura',
          viaClear: 'EVS2',
          amv: 81,
          rotaRetirada: { origem: 'L2', destino: 'L6', distanciaM: 270, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L7', destino: 'L2', distanciaM: 190, sentido: 'Puxando' },
        },
      ],
    },
    {
      id: 'blocoB',
      nome: 'Bloco B',
      locomotiva: 'GT46-0641',
      vagoesNormais: ['VG-97320', 'VG-97330'],
      passagemInicio: 973000,
      passagemQuantidade: 22,
      grupos: [
        {
          id: 'g1',
          resumoProblema: 'Pendência de inspeção periódica — verificar antes da liberação',
          criticidade: 'Baixa',
          vagoesRetirados: ['VG-97318'],
          vagoesIncluidos: ['VG-97402'],
          motivoCorte: 'pendência de inspeção periódica',
          viaClear: 'EVS4',
          amv: 83,
          rotaRetirada: { origem: 'L4', destino: 'L8', distanciaM: 230, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L9', destino: 'L4', distanciaM: 170, sentido: 'Puxando' },
        },
      ],
    },
    {
      id: 'blocoC',
      nome: 'Bloco C',
      locomotiva: 'GT46-0642',
      vagoesNormais: ['VG-97440', 'VG-97450'],
      passagemInicio: 974000,
      passagemQuantidade: 22,
      grupos: [
        {
          id: 'g1',
          resumoProblema: 'Ruído anormal no rolamento — monitorar durante o trajeto',
          criticidade: 'Média',
          vagoesRetirados: ['VG-97460'],
          vagoesIncluidos: ['VG-97403'],
          motivoCorte: 'ruído anormal no rolamento',
          viaClear: 'EVS6',
          amv: 85,
          rotaRetirada: { origem: 'L5', destino: 'L9', distanciaM: 250, sentido: 'Empurrando' },
          rotaInclusao: { origem: 'L9', destino: 'L5', distanciaM: 190, sentido: 'Puxando' },
        },
      ],
    },
  ]),
  J410: planoSimples({ trem: 'J410', os: '9960/2026', criticidade: 'Média', resumoProblema: 'Vagão retido por restrição SAP', vagaoProblema: 'VG-73344', locomotivas: 2, vagoesTotais: 50 }),
  J512: planoSimples({ trem: 'J512', os: '9971/2026', criticidade: 'Baixa', resumoProblema: 'Vagão com pendência de inspeção', vagaoProblema: 'VG-84455', vagoesTotais: 40 }),
};

/** Só os trens de `TRENS_ATIVOS` (`trensAtivos.ts`) — os demais planos acima ficam fora das telas. */
export const planosManobraMock: Record<string, PlanoManobra> = Object.fromEntries(
  Object.entries(TODOS_OS_PLANOS_MOCK).filter(([trem]) => TRENS_ATIVOS.includes(trem)),
);

/**
 * Fallback para trens sem entrada em `planosManobraMock` — acontece ao navegar pra uma data
 * anterior no seletor de turno, cujos trens não têm um mock narrativo dedicado. Mesma estrutura
 * de `planoSimples`, com uma descrição neutra (não inventa uma intercorrência específica).
 */
export function planoFallback(trem: string, os: string): PlanoManobra {
  return planoSimples({
    trem,
    os,
    criticidade: 'Baixa',
    resumoProblema: 'Verificação de rotina da composição',
    // Id distinto de `${trem}-VG01` (o vagão normal já nomeado em `planoSimples`) — usar o
    // mesmo id faria `derivarVeiculosDoBloco` sobrescrever esse vagão como "retirado" e perder
    // uma unidade do total (`porId` é um Map por id).
    vagaoProblema: `${trem}-VGPROB`,
    vagoesTotais: 45,
  });
}
