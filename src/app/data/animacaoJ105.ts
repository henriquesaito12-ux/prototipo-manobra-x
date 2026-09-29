// Linha do tempo CONTÍNUA do J105 V2 — o modelo de animação que substitui, só nesse trem, o
// "um passo = um estado estático" do J105 V1.
//
// EXCLUSIVO do J105 V2 (`TREM_J105_V2`). O J105 V1 e todos os demais trens não importam nada
// daqui: continuam lendo `gruposDoPassoJ105` direto, passo a passo, como sempre.
//
// ---------------------------------------------------------------------------------------------
// De onde vem o modelo
// ---------------------------------------------------------------------------------------------
// Portado (conceito, não código) da engine de referência escrita pela equipe em
// `animacao/ficha-1090-vmx539-only1A-patio-animado.html`. Dela vêm três ideias:
//   1. STAGES — cada etapa da manobra tem `t0`/`t1` em segundos, e dentro dela o tempo se divide
//      em TEMPO HUMANO (`offsetS`, ninguém se move: rádio, caminhada, destravar cadeado) e
//      OPERAÇÃO (`moveS`, que ou é marcha de fato — `rolaDeFato` — ou é operação com o trem
//      parado, caso do corte).
//   2. TRACKS — a posição de cada corpo é INTERPOLÁVEL no tempo, em vez de saltar de um estado
//      pro outro. É isso que dá o movimento fluido entre etapas.
//   3. Travessia de linha como INTERPOLAÇÃO DE FAIXA — quando um corpo troca de linha, origem e
//      destino são interpolados juntos (x e y), e o corpo desliza na diagonal entre as duas
//      faixas. É o que a engine de referência faz em `sample()` (`y0 + (y1-y0)*u`).
//
// O que NÃO veio de lá: a paleta/CSS (o produto tem os próprios tokens), o layout de página
// inteira, e os dados do cenário dele (ficha 1090/VMX539, 25 stages) — que não são os do J105.
//
// ---------------------------------------------------------------------------------------------
// De onde vêm os DADOS (e por que não são um segundo mock)
// ---------------------------------------------------------------------------------------------
// As posições NÃO são redigitadas aqui: cada um dos 38 passos é lido de `gruposDoPassoJ105(n)`,
// a MESMA função que o V1 desenha. Este arquivo só responde "onde o trem está no segundo t",
// interpolando entre os quadros-chave que aquela função já define. Consequência deliberada:
// corrigir a geometria de um passo no V1 corrige o V2 no mesmo commit — os dois nunca divergem.
//
// A única coisa que o plano do J105 não tem e a animação precisa é TEMPO. As durações abaixo são
// derivadas das constantes de física da própria engine de referência (`DATA.physics`): velocidade
// de manobra 4,2 m/s, corte 180 s, e o catálogo de tempo humano `D_offsets`
// (40 s deslocamento · 50 s engate · 155 s corte · 235 s ciclo de AMV). Não são medição de campo —
// são a mesma régua que o protótipo da equipe usa, aplicada à sequência do J105.

import {
  gruposDoPassoJ105,
  passoCitaAmvJ105,
  T2_DESVIO_M,
  T2_LN3_M,
  type GrupoVisualJ105,
} from './visualJ105';

/** Id do trem V2 na lista de trens — o V1 continua sendo `'J105'`, intocado. Toda a lógica nova
 *  do produto (mapa animado, controles de reprodução) é condicionada a ESTE id. */
export const TREM_J105_V2 = 'J105-V2';

/** Total de passos do plano — o mesmo do V1 (é o mesmo plano, só a visualização muda). */
export const TOTAL_PASSOS_J105 = 38;

// --------------------------------------------------------------------- física (engine de ref.)

/** Velocidade de manobra, m/s — `DATA.physics.v` da engine de referência. */
const VELOCIDADE_MANOBRA_MS = 4.2;
/** Duração da operação de corte com o trem PARADO, s — `DATA.physics.t_cut`. Não é marcha: o
 *  trem não anda um metro durante um corte (fecha torneira, teste de resistência, haste de
 *  desengate), por isso entra como `moveS` com `rolaDeFato: false`. */
const DURACAO_CORTE_S = 180;

/** Tempo humano por tipo de etapa, s — `DATA.physics.D_offsets` da engine de referência. */
const TEMPO_HUMANO = {
  /** Deslocamento simples (`D_offsets["1"]`): rádio de autorização + preparo do maquinista. */
  deslocamento: 40,
  /** Engate (`D_offsets["3"]`): aproximação por rádio, puxada de confirmação, passagem do ar. */
  engate: 50,
  /** Corte (`D_offsets["2"]`): caminhada até o ponto, conferência, blocos em modo de espera. */
  corte: 155,
  /** Ciclo completo de manipulação manual do AMV (`D_offsets["C"]`): destravar cadeado, acionar
   *  o macaquinho, mover a agulha, travar, conferir vedação, comunicar por rádio. */
  amv: 235,
} as const;

/** Distância que o trem percorre ENTRANDO no pátio antes do Passo 1 — não existe no V1 (lá o
 *  Passo 1 já é um estado estático). Sem isso a animação começaria com o trem já parado no lugar
 *  e o primeiro passo ("Entrada do trem no pátio") não teria movimento nenhum pra mostrar. */
const ENTRADA_PATIO_M = 220;

// --------------------------------------------------------------------- tipos

/** Uma etapa da manobra na linha do tempo — o `stage` da engine de referência. */
export interface EstagioJ105 {
  /** Passo do plano (1..38) — mesma numeração do V1 e da lista de passos da aba Manobras. */
  passo: number;
  /** Início/fim absolutos na linha do tempo, em segundos. */
  t0: number;
  t1: number;
  /** Tempo humano no início da etapa: ninguém se move (ver comentário do topo). */
  offsetS: number;
  /** Tempo de operação depois do tempo humano — marcha de fato quando `rolaDeFato`, senão
   *  operação com o trem parado (corte). */
  moveS: number;
  /** `true` quando algum corpo de fato se desloca nesta etapa. */
  rolaDeFato: boolean;
}

/**
 * Um corpo desenhável num instante da animação — o que o `ComposicaoJ105V2Layer` renderiza.
 * Guarda ORIGEM e DESTINO separados (em vez de uma posição já resolvida) porque a conversão
 * metros → viewBox depende da linha, e cada uma tem sua própria projeção na cena: quem interpola
 * é o renderizador, depois de projetar as duas pontas (ver `ComposicaoJ105V2Layer`).
 */
export interface CorpoAnimadoJ105 {
  /** Identidade estável do corpo ao longo do tempo — chave de React e do casamento entre passos. */
  chave: string;
  linhaOrigem: string;
  linhaDestino: string;
  posicaoOrigemM: number;
  posicaoDestinoM: number;
  /** Fração já percorrida entre origem e destino (0..1). */
  u: number;
  veiculos: GrupoVisualJ105['veiculos'];
  corte?: GrupoVisualJ105['corte'];
  esmaecido?: boolean;
  /** `true` enquanto este corpo está de fato andando — o renderizador usa pra destacá-lo. */
  emMovimento: boolean;
}

export interface EstadoAnimadoJ105 {
  corpos: CorpoAnimadoJ105[];
  estagio: EstagioJ105;
  /** Índice de `ESTAGIOS_J105` — evita quem consome ter que procurar de novo. */
  indice: number;
  /** Algum corpo em marcha agora? (selo "em marcha" dos controles). */
  emMarcha: boolean;
}

// --------------------------------------------------------------------- quadros-chave

/**
 * Grupos de um passo, com o Passo 0 sintetizado: o trem ainda ENTRANDO no pátio, `ENTRADA_PATIO_M`
 * atrás da posição do Passo 1. Só existe pra dar movimento ao primeiro passo (ver
 * `ENTRADA_PATIO_M`); do Passo 1 em diante é `gruposDoPassoJ105` puro, sem nenhuma alteração.
 */
function quadro(passo: number): GrupoVisualJ105[] {
  if (passo >= 1) return gruposDoPassoJ105(passo);
  return gruposDoPassoJ105(1).map((grupo) =>
    grupoEstatico(grupo) ? grupo : { ...grupo, posicaoM: grupo.posicaoM - ENTRADA_PATIO_M },
  );
}

/**
 * Corpo que nunca se move: o trem alheio estacionado na LN3 (`esmaecido`) e as pilhas de vagões
 * já retirados. Eles APARECEM e SOMEM em quadros distintos, mas nunca viajam — casá-los por
 * índice com os corpos em manobra produziria interpolações sem sentido (uma pilha de retirados
 * "voando" até a locomotiva). Por isso são casados por posição, não por índice.
 */
function grupoEstatico(grupo: GrupoVisualJ105): boolean {
  return grupo.esmaecido === true || grupo.veiculos.every((v) => v.papel === 'retirado');
}

function chaveEstatica(grupo: GrupoVisualJ105): string {
  return `estatico:${grupo.linha}:${grupo.posicaoM}:${grupo.veiculos.map((v) => `${v.papel}x${v.quantidade}`).join('+')}`;
}

function totalVeiculos(grupo: GrupoVisualJ105): number {
  return grupo.veiculos.reduce((soma, v) => soma + v.quantidade, 0);
}

/**
 * Distância física percorrida por um corpo entre dois quadros, em metros de linha.
 * Mesma linha: diferença direta. Linhas diferentes (recuo/avanço pelo Travessão 2): o caminho real
 * passa PELO travessão, então soma os dois trechos — da origem até o travessão na linha de origem,
 * e do travessão até o destino na linha de destino. Um simples `|a-b|` entre linhas diferentes não
 * mede caminho nenhum (são réguas independentes).
 */
function distanciaPercorridaM(anterior: GrupoVisualJ105, atual: GrupoVisualJ105): number {
  if (anterior.linha === atual.linha) return Math.abs(atual.posicaoM - anterior.posicaoM);
  const t2De = anterior.linha === 'Linha 3' ? T2_LN3_M : T2_DESVIO_M;
  const t2Para = atual.linha === 'Linha 3' ? T2_LN3_M : T2_DESVIO_M;
  return Math.abs(t2De - anterior.posicaoM) + Math.abs(atual.posicaoM - t2Para);
}

/** Passo cujo texto descreve um ENGATE (aproximação fina + puxada de confirmação + passagem do
 *  ar) — tempo humano próprio, maior que o de um deslocamento simples. Derivado da posição do
 *  passo na sequência do plano (`planoManobraJ105.ts`): são os recuos que terminam encostando em
 *  outro veículo. */
const PASSOS_DE_ENGATE = new Set([6, 10, 15, 19, 24, 26, 28, 33, 36]);

/** Tempo humano (s) de um passo — ver `TEMPO_HUMANO`. Manipulação de AMV tem prioridade: são os
 *  passos em que o operador está fisicamente no aparelho e nada mais acontece. */
function tempoHumanoDoPasso(passo: number, temCorte: boolean): number {
  if (passoCitaAmvJ105(passo)) return TEMPO_HUMANO.amv;
  if (temCorte) return TEMPO_HUMANO.corte;
  if (PASSOS_DE_ENGATE.has(passo)) return TEMPO_HUMANO.engate;
  return TEMPO_HUMANO.deslocamento;
}

// --------------------------------------------------------------------- montagem da linha do tempo

function montarEstagios(): EstagioJ105[] {
  const estagios: EstagioJ105[] = [];
  let t = 0;
  for (let passo = 1; passo <= TOTAL_PASSOS_J105; passo += 1) {
    const anterior = quadro(passo - 1);
    const atual = quadro(passo);
    const temCorte = atual.some((grupo) => grupo.corte != null);

    // Maior distância percorrida entre os corpos em manobra deste passo — é ela que dita a
    // duração da marcha (todos os corpos andam juntos, no mesmo intervalo).
    const dinAnterior = anterior.filter((g) => !grupoEstatico(g));
    const dinAtual = atual.filter((g) => !grupoEstatico(g));
    let distancia = 0;
    for (let i = 0; i < Math.min(dinAnterior.length, dinAtual.length); i += 1) {
      distancia = Math.max(distancia, distanciaPercorridaM(dinAnterior[i], dinAtual[i]));
    }

    const offsetS = tempoHumanoDoPasso(passo, temCorte);
    // Corte não é marcha: o trem fica parado os `DURACAO_CORTE_S` inteiros (ver constante).
    const rolaDeFato = !temCorte && distancia > 0.5;
    const moveS = temCorte ? DURACAO_CORTE_S : Math.round(distancia / VELOCIDADE_MANOBRA_MS);

    estagios.push({ passo, t0: t, t1: t + offsetS + moveS, offsetS, moveS, rolaDeFato });
    t += offsetS + moveS;
  }
  return estagios;
}

export const ESTAGIOS_J105: EstagioJ105[] = montarEstagios();

/** Duração total do plano, em segundos. */
export const DURACAO_TOTAL_J105: number = ESTAGIOS_J105[ESTAGIOS_J105.length - 1]?.t1 ?? 0;

/** Soma do tempo humano (parado) de todas as etapas — usada nos indicadores de contexto. */
export const TEMPO_PARADO_J105: number = ESTAGIOS_J105.reduce((soma, e) => soma + e.offsetS, 0);
/** Soma do tempo de marcha de fato (exclui a operação de corte, que é com o trem parado). */
export const TEMPO_EM_MARCHA_J105: number = ESTAGIOS_J105.reduce(
  (soma, e) => soma + (e.rolaDeFato ? e.moveS : 0),
  0,
);
/** Soma da operação de corte — trem parado, mas não é tempo humano de espera: é a terceira
 *  parcela que falta pra `TEMPO_PARADO_J105 + TEMPO_EM_MARCHA_J105` fechar com `DURACAO_TOTAL_J105`. */
export const TEMPO_EM_CORTE_J105: number = ESTAGIOS_J105.reduce(
  (soma, e) => soma + (e.rolaDeFato ? 0 : e.moveS),
  0,
);

/** Estágio (e seu índice) que contém o instante `t` — o último quando `t` passa do fim. */
export function estagioEmT(t: number): { estagio: EstagioJ105; indice: number } {
  for (let i = 0; i < ESTAGIOS_J105.length; i += 1) {
    if (t < ESTAGIOS_J105[i].t1) return { estagio: ESTAGIOS_J105[i], indice: i };
  }
  const indice = ESTAGIOS_J105.length - 1;
  return { estagio: ESTAGIOS_J105[indice], indice };
}

/** Instante em que um passo (1..38) começa — usado pelo clique na lista de passos e pelo
 *  navegador de etapa (anterior/próxima). */
export function inicioDoPasso(passo: number): number {
  const estagio = ESTAGIOS_J105.find((e) => e.passo === passo);
  return estagio ? estagio.t0 : 0;
}

// --------------------------------------------------------------------- amostragem no tempo

/**
 * Estado desenhável no instante `t` — o `sample()` da engine de referência, adaptado ao modelo de
 * grupos do produto.
 *
 * Como os corpos são casados entre o quadro anterior e o atual:
 * - ESTÁTICOS (pilhas de retirados, trem estacionado na LN3) — casados por posição/conteúdo, nunca
 *   por índice. Aparecem/somem no limite do passo, que é exatamente quando o corte que os cria
 *   acontece; como nada se move num corte, não há salto visível.
 * - EM MANOBRA — casados por índice (o grupo 0 é sempre o conjunto "em ação", o 1 é o que ficou
 *   esperando). A posição interpola do quadro anterior pro atual.
 *
 * E como a COMPOSIÇÃO de cada corpo muda:
 * - Corte (o corpo ENCOLHE): vale já no início da etapa. Correto porque num corte nenhum veículo
 *   se move — só o engate abre — então trocar a composição na hora não produz salto nenhum.
 * - Engate (o corpo CRESCE): só vale no FIM do movimento. É quando o engate de fato acontece; usar
 *   a composição nova desde o início desenharia o trem inteiro já reunido lá no ponto de partida,
 *   do outro lado do pátio.
 * Um corpo que existia antes e não existe mais (o conjunto absorvido por um engate) continua
 * desenhado na posição antiga até o fim do movimento, e some no mesmo instante em que o corpo que
 * o absorveu cresce — é isso que faz os dois lerem como "engataram".
 */
export function estadoAnimadoJ105(t: number): EstadoAnimadoJ105 {
  const tempo = Math.max(0, Math.min(DURACAO_TOTAL_J105, t));
  const { estagio, indice } = estagioEmT(tempo);

  const inicioMovimento = estagio.t0 + estagio.offsetS;
  const u =
    tempo <= inicioMovimento
      ? 0
      : estagio.moveS <= 0
        ? 1
        : Math.min(1, (tempo - inicioMovimento) / estagio.moveS);
  const emMarcha = estagio.rolaDeFato && u > 0 && u < 1;

  const anterior = quadro(estagio.passo - 1);
  const atual = quadro(estagio.passo);

  const corpos: CorpoAnimadoJ105[] = [];

  // --- estáticos: casados por chave de conteúdo/posição, sem interpolação ---------------------
  for (const grupo of atual.filter(grupoEstatico)) {
    corpos.push({
      chave: chaveEstatica(grupo),
      linhaOrigem: grupo.linha,
      linhaDestino: grupo.linha,
      posicaoOrigemM: grupo.posicaoM,
      posicaoDestinoM: grupo.posicaoM,
      u: 1,
      veiculos: grupo.veiculos,
      corte: grupo.corte,
      esmaecido: grupo.esmaecido,
      emMovimento: false,
    });
  }

  // --- em manobra: casados por índice, posição interpolada ------------------------------------
  const dinAnterior = anterior.filter((g) => !grupoEstatico(g));
  const dinAtual = atual.filter((g) => !grupoEstatico(g));

  for (let i = 0; i < Math.max(dinAnterior.length, dinAtual.length); i += 1) {
    const de = dinAnterior[i];
    const para = dinAtual[i];

    // Corpo novo (o conjunto que ficou esperando, criado por um corte): nasce já na posição final.
    if (!de && para) {
      corpos.push({
        chave: `manobra:${i}`,
        linhaOrigem: para.linha,
        linhaDestino: para.linha,
        posicaoOrigemM: para.posicaoM,
        posicaoDestinoM: para.posicaoM,
        u: 1,
        veiculos: para.veiculos,
        corte: para.corte,
        emMovimento: false,
      });
      continue;
    }

    // Corpo absorvido por um engate: segue desenhado onde estava até o movimento terminar.
    if (de && !para) {
      if (u < 1) {
        corpos.push({
          chave: `manobra:${i}`,
          linhaOrigem: de.linha,
          linhaDestino: de.linha,
          posicaoOrigemM: de.posicaoM,
          posicaoDestinoM: de.posicaoM,
          u: 1,
          veiculos: de.veiculos,
          emMovimento: false,
        });
      }
      continue;
    }
    if (!de || !para) continue;

    // Composição: a do quadro anterior enquanto o corpo CRESCE e o movimento não terminou
    // (engate só vale no fim); a do quadro atual em todo o resto (inclusive cortes).
    const cresce = totalVeiculos(para) > totalVeiculos(de);
    const usarAnterior = cresce && u < 1;

    const anda = de.linha !== para.linha || Math.abs(para.posicaoM - de.posicaoM) > 0.5;
    corpos.push({
      chave: `manobra:${i}`,
      linhaOrigem: de.linha,
      linhaDestino: para.linha,
      posicaoOrigemM: de.posicaoM,
      posicaoDestinoM: para.posicaoM,
      u,
      veiculos: usarAnterior ? de.veiculos : para.veiculos,
      // Marca de corte só depois do tempo humano: durante o offset a equipe ainda está caminhando
      // até o ponto e conferindo — o engate ainda não abriu.
      corte: tempo > inicioMovimento ? para.corte : undefined,
      emMovimento: anda && estagio.rolaDeFato && u > 0 && u < 1,
    });
  }

  return { corpos, estagio, indice, emMarcha };
}

/** `mm:ss` — mesmo formato que o plano de manobra já usa pros tempos das etapas. */
export function formatarRelogioJ105(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
