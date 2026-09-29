// Estado VISUAL da composição do J105 passo a passo — o que o mapa desenha em cada um dos 38
// passos (quais veículos estão engatados em quais grupos, em qual linha, e onde o corte acontece).
// Exclusivo do J105: nenhum outro trem tem esse nível de detalhe por etapa (os demais usam o pino
// único de `Composition.tsx`, inalterado).
//
// Fonte: as imagens de referência do plano (`J105/passo-*.jpg`, fora do código) + o texto de cada
// etapa (`planoManobraJ105.ts`). As imagens são esquemáticas (desenham só ~8 quadradinhos por
// grupo); aqui as contagens são as REAIS da composição (92 vagões + 3 locomotivas + 1 vagão bom),
// por pedido explícito do usuário (2026-09-21) — a estrutura (quais grupos existem, onde cortam,
// para qual linha vão) segue as imagens, só a quantidade é a de verdade.
//
// Ordem física do trem (energia distribuída: uma locomotiva na cabeça, uma no meio, uma na cauda):
//   LOCO A · [vagão bom] · 8 vagões · POS 9-10 · 37 vagões · LOCO B · 30 vagões · POS 78 ·
//   4 vagões · POS 83-84 · 8 vagões · LOCO C
// As posições citadas no plano (9/10, 78, 83/84) são globais na composição de 92 vagões.
//
// SIMPLIFICAÇÕES CONSCIENTES (documentadas em vez de escondidas):
// - Só o trem estacionado na LN3 do episódio do vagão bom (`TRECHOS.estacLN3`/
//   `grupoEstacionadoLN3`) é desenhado — SEMPRE, em todos os 38 passos, apagado (`esmaecido`, ver
//   `ComposicaoJ105Layer`), pedido explícito do usuário 2026-09-22 depois de notar que sumia no
//   Passo 15 quando o texto do plano volta a citar "veículos estacionados" na LN3. Os avariados
//   que os ciclos de corte do próprio J105 deixam pra trás continuam representados só como o
//   bloco `retirado` de `paradosAte`, sem o "resto do trem" ao redor deles (esse resto nunca é
//   citado pelo plano, diferente do vagão bom).
// - O AMV do Travessão 2 (badge dedicado, `AmvJ105Marker`/`ComposicaoJ105Layer.tsx`) só aparece
//   nos passos que o citam no texto do plano (`passoCitaAmvJ105`) — preenchido nos passos de
//   manipulação de fato (`amvAtivoDoPassoJ105`), neutro nos de "até livrar o AMV" que também o
//   citam. Os rótulos de texto das imagens ("Blocos B e C em modo de espera") ainda não são
//   desenhados.

/** Papel visual de cada quadradinho — o mesmo vocabulário de cor pedido pelo usuário:
 *  azul = locomotiva, branco = vagão normal, vermelho = vagão a retirar, verde = vagão a incluir.
 *  `alvo` é o estado intermediário (vagão já marcado para retirada, ainda engatado): desenhado com
 *  contorno vermelho e preenchimento claro, como nas imagens de referência. */
export type PapelVeiculoJ105 = 'loco' | 'vagao' | 'alvo' | 'retirado' | 'bom';

/** Um trecho contíguo da composição — o modelo trabalha em trechos (e não vagão a vagão) porque é
 *  assim que a manobra acontece: os cortes sempre caem nas fronteiras entre eles. */
interface TrechoJ105 {
  id: string;
  papel: PapelVeiculoJ105;
  quantidade: number;
}

const TRECHOS: Record<string, TrechoJ105> = {
  locoA: { id: 'locoA', papel: 'loco', quantidade: 1 },
  bom: { id: 'bom', papel: 'bom', quantidade: 1 },
  // Trem JÁ estacionado na LN3 ao qual o "vagão bom" pertencia antes do corte do Passo 7 — NÃO é
  // o J105, é um consist alheio já parado no pátio (`J105/passo-06.jpg`/`passo-07.jpg`: fileira de
  // vagões cinza colada à cauda do vagão bom/verde). Só entra no desenho pra dar contexto ao corte
  // do Passo 7 ("faz o corte do vagão bom do restante do trem que ele pertencia", pedido explícito
  // do usuário, 2026-09-22) — pedido explícito de representar (antes era conscientemente omitido,
  // ver comentário no topo do arquivo). Contagem ESQUEMÁTICA (3, igual às imagens de referência):
  // não há contagem real conhecida pra esse trem, só o "vagão bom" que ele cede importa ao plano.
  estacLN3: { id: 'estacLN3', papel: 'vagao', quantidade: 3 },
  preA: { id: 'preA', papel: 'vagao', quantidade: 8 },
  alvo1: { id: 'alvo1', papel: 'alvo', quantidade: 2 },
  postA: { id: 'postA', papel: 'vagao', quantidade: 37 },
  locoB: { id: 'locoB', papel: 'loco', quantidade: 1 },
  preB: { id: 'preB', papel: 'vagao', quantidade: 30 },
  alvo2: { id: 'alvo2', papel: 'alvo', quantidade: 1 },
  midB: { id: 'midB', papel: 'vagao', quantidade: 4 },
  alvo3: { id: 'alvo3', papel: 'alvo', quantidade: 2 },
  postB: { id: 'postB', papel: 'vagao', quantidade: 8 },
  locoC: { id: 'locoC', papel: 'loco', quantidade: 1 },
};

export interface GrupoVisualJ105 {
  /** Mesmo vocabulário de `apoio.linha` (`planoManobraJ105.ts`) — resolvido contra o pátio por
   *  `resolveLineIdByNome` (`train-yard/etapaParada.ts`), igual ao resto do mapa. */
  linha: string;
  /** Posição da CABEÇA do grupo (locomotiva líder) na linha, em metros do início dela. */
  posicaoM: number;
  veiculos: { papel: PapelVeiculoJ105; quantidade: number }[];
  /** Marca de corte (X) — só no passo em que o desengate de fato acontece.
   *  `cauda`: na traseira do grupo, onde ele se separou do conjunto que ficou para trás.
   *  `atras-da-cabeca`: logo atrás da locomotiva líder (corte da própria locomotiva). */
  corte?: 'cauda' | 'atras-da-cabeca';
  /** Seta de sentido do movimento deste grupo neste passo. */
  seta?: 'direita' | 'esquerda';
  /** Grupo que NÃO é do J105 (`grupoEstacionadoLN3`) — desenhado mais apagado (opacidade reduzida
   *  em `ComposicaoJ105Layer`), pra distinguir de relance do trem em manobra sem escondê-lo. */
  esmaecido?: boolean;
}

/** Trechos "vivos" em cada fase do plano — conforme os avariados vão ficando para trás na LN3 e o
 *  vagão bom entra na composição, a lista do trem principal muda. */
const TREM_INICIAL = ['locoA', 'preA', 'alvo1', 'postA', 'locoB', 'preB', 'alvo2', 'midB', 'alvo3', 'postB', 'locoC'];
const TREM_COM_BOM = ['locoA', 'bom', 'preA', 'alvo1', 'postA', 'locoB', 'preB', 'alvo2', 'midB', 'alvo3', 'postB', 'locoC'];
const TREM_SEM_ALVO1 = ['locoA', 'bom', 'preA', 'postA', 'locoB', 'preB', 'alvo2', 'midB', 'alvo3', 'postB', 'locoC'];
const TREM_SEM_ALVO2 = ['locoA', 'bom', 'preA', 'postA', 'locoB', 'preB', 'midB', 'alvo3', 'postB', 'locoC'];
const TREM_FINAL = ['locoA', 'bom', 'preA', 'postA', 'locoB', 'preB', 'midB', 'postB', 'locoC'];

/**
 * TRAVESSÃO 2 — o AMV que liga a Linha do Desvio à L3, confirmado pelo usuário sobre o mapa
 * (2026-09-21): é o travessão do MEIO do pátio, não o do extremo. No fixture EHT
 * (`train-yard/mocks/eht.ts`) é a conexão `eht-amv-64`: L Desvio em 651 m ↔ L3 em 537 m. Toda a
 * geometria dos passos é ancorada nele — é onde o trem para no marco, onde os cortes acontecem e
 * por onde a composição cruza entre as duas linhas.
 */
export const T2_DESVIO_M = 651;
export const T2_LN3_M = 537;
/** Folga além do AMV para o "puxa até livrar o AMV": o último veículo precisa ultrapassá-lo. */
const FOLGA_LIVRAR_M = 20;

/**
 * Régua de desenho — quanto cada veículo "ocupa" de linha no mapa. NÃO é o comprimento real
 * (9 m por vagão, 20 m por locomotiva): a composição de 92 vagões ficava comprida demais na tela,
 * e o usuário pediu para achatá-la (2026-09-21, "sei que os 92 vagões ficou muito... pode
 * representar ele menor"). Com 5 m por vagão o trem inteiro ocupa ~490 m de linha em vez de
 * ~890 m, cabendo antes do Travessão 2 sem perder nenhum vagão da contagem.
 * Exportada porque `ComposicaoJ105Layer` desenha com a MESMA régua — se as duas divergirem, a
 * cauda do grupo deixa de cair no travessão nas paradas de corte.
 * `LOCO_M` = `VAGAO_M` (2026-09-22, pedido explícito do usuário: "a locomotiva pode ter a mesma
 * largura que os vagões") — igualado de propósito, não só coincidentemente igual, pra nunca
 * divergir se `VAGAO_M` mudar de novo. Continuam 2 constantes (não 1 só) porque `comprimentoM`
 * (abaixo) e o resto do arquivo distinguem `papel === 'loco'` explicitamente — a leitura do código
 * some se colapsar num valor só.
 */
export const VAGAO_M = 5;
export const LOCO_M = VAGAO_M;

function comprimentoM(ids: string[]): number {
  return ids.reduce((soma, id) => soma + TRECHOS[id].quantidade * (TRECHOS[id].papel === 'loco' ? LOCO_M : VAGAO_M), 0);
}

/** Cabeça do grupo quando ele está parado com a PONTA DE CORTE (a cauda do grupo) no marco do
 *  Travessão 2 — é assim que o plano descreve as paradas antes de cada corte. */
function cabecaComCaudaNoT2(ids: string[], t2: number): number {
  return t2 + comprimentoM(ids);
}

/** Cabeça do grupo depois de "puxar até livrar o AMV": a cauda passa do travessão com folga. */
function cabecaAposLivrarAmv(ids: string[], t2: number): number {
  return t2 + comprimentoM(ids) + FOLGA_LIVRAR_M;
}

function montar(ids: string[], papeisSobrescritos: Record<string, PapelVeiculoJ105> = {}) {
  return ids.map((id) => {
    const trecho = TRECHOS[id];
    return { papel: papeisSobrescritos[id] ?? trecho.papel, quantidade: trecho.quantidade };
  });
}

/** Posição do conjunto que já cruzou para a LN3 (do outro lado do travessão) — hoisted pro escopo
 *  do módulo (fora de `gruposDoPassoJ105`) só pra `ESTACIONADO_LN3_CABECA_M` (abaixo) também
 *  enxergar, sem duplicar a fórmula; valor idêntico ao que os `case`s de LN3 sempre usaram. */
const NA_LN3 = T2_LN3_M - 40;

/** Cabeça FIXA (M) do trem estacionado na LN3 (`grupoEstacionadoLN3`) — nunca muda, é o âncora
 *  contra o qual todo grupo que "chega na LN3 e encosta nos veículos estacionados" se posiciona
 *  (`cabecaEncostandoEstacionado`, abaixo). Calibrado pra [locoA, bom] (Passos 6/7) encostar
 *  exatamente quando parado em `NA_LN3`. */
const ESTACIONADO_LN3_CABECA_M = NA_LN3 - comprimentoM(['locoA', 'bom']);

/**
 * Grupo estático do trem estacionado na LN3 (ver `TRECHOS.estacLN3`) — SEMPRE na mesma posição
 * (nunca se move, é isso que "estacionado" significa) e SEMPRE desenhado, em TODOS os 38 passos,
 * desde o Passo 1 (pedido explícito do usuário, 2026-09-22: "preciso que os vagões ali na L3
 * sempre fiquem visíveis... desde o passo 1", depois de notar que sumiam no Passo 15, quando
 * `locoA` reaparece na LN3 pra engatar nos avariados retirados — sem este grupo sempre presente,
 * a cena parecia vazia onde deveriam estar os "veículos estacionados" que o texto do plano cita).
 * `esmaecido: true` (opacidade reduzida, `ComposicaoJ105Layer`) — não é o J105, é só contexto do
 * pátio.
 * A cabeça (lado direito, voltado pro Travessão 2) fica em `ESTACIONADO_LN3_CABECA_M`, onde
 * encosta exatamente na cauda de [locoA, bom] quando parado em `NA_LN3` (Passos 6/7/9), pra
 * desenhar os dois grupos GRUDADOS até o corte do Passo 7 separá-los (visualmente, com
 * `MarcaCorte`/`corte: 'cauda'` no grupo [locoA, bom]) — a separação FÍSICA (com vão entre os
 * dois) só aparece no Passo 8, quando [locoA, bom] já puxou pra frente.
 *
 * ANTES do Passo 6 (`passo < 6`), o vagão bom (`TRECHOS.bom`) já É desenhado aqui, na frente do
 * trio cinza — mesmo esmaecimento dos vagões cinza (2026-09-22, pedido explícito do usuário: "no
 * passo 6, parece que o vagão bom surgiu do nada, mas ele já estava ali... deixe ele verdinho
 * desde o início (mas meio transparente)"), no LUGAR EXATO onde ele aparece acoplado a `locoA` no
 * Passo 6 (`ESTACIONADO_LN3_CABECA_M + comprimentoM(['bom'])`, a mesma posição, só sem a
 * locomotiva ainda) — pra passo 5→6 ser só uma troca de opacidade + a locomotiva chegando, nunca
 * um "pulo" de posição. A PARTIR do Passo 6 o vagão bom sai daqui e passa a ser desenhado pelo
 * grupo [locoA, bom] em si (opacidade cheia, "fica mais vivo quando engata na locomotiva").
 */
function grupoEstacionadoLN3(passo: number): GrupoVisualJ105 {
  if (passo < 6) {
    return {
      linha: 'Linha 3',
      posicaoM: ESTACIONADO_LN3_CABECA_M + comprimentoM(['bom']),
      veiculos: montar(['bom', 'estacLN3']),
      esmaecido: true,
    };
  }
  return { linha: 'Linha 3', posicaoM: ESTACIONADO_LN3_CABECA_M, veiculos: montar(['estacLN3']), esmaecido: true };
}

/**
 * Cabeça (M) de um grupo que chega na LN3 pra encostar no trem estacionado (`grupoEstacionadoLN3`)
 * — a CAUDA do grupo cai exatamente em `ESTACIONADO_LN3_CABECA_M`, não importa o comprimento do
 * grupo que chega.
 * Correção (2026-09-22, usuário notou no Passo 15): antes, todo "chega na LN3" usava o mesmo
 * `NA_LN3` fixo como CABEÇA do grupo — coincidência que só funcionava pra [locoA, bom] (Passos
 * 6/7, o grupo com que essa constante foi calibrada). Qualquer grupo mais comprido (C1/C2/C3
 * FRENTE, dezenas de metros) tinha a cauda bem ANTES do trem estacionado, cobrindo-o por
 * completo em vez de encostar nele — por isso ele "não aparecia".
 */
function cabecaEncostandoEstacionado(ids: string[]): number {
  return ESTACIONADO_LN3_CABECA_M + comprimentoM(ids);
}

/**
 * Onde os vagões retirados (alvo1/alvo2/alvo3 → `retirado`) se acumulam na LN3, DERIVADO da
 * geometria real de cada corte — não mais 3 posições arbitrárias (380/400/420 m) desconectadas de
 * onde o corte de fato acontece (pedido explícito do usuário, 2026-09-22: "os vagões retirados...
 * aparecendo instantaneamente numa nova posição... como se tivessem sido teletransportados", "a
 * posição de vagões já retirados deve ir se acumulando progressivamente"). Cada constante é a
 * cabeça (frente, lado T2) da pilha IMEDIATAMENTE depois daquele corte — a MESMA fórmula que o
 * corte em si usa pra recuar a cauda do grupo que continua (`C1_APOS`/`C2_APOS`/`C3_APOS`, ver os
 * `case`s 16/26/34), então o vagão retirado nunca se move: ele já nasce exatamente onde a cauda do
 * grupo-que-continua recuou até. A pilha cresce a partir do trem estacionado
 * (`ESTACIONADO_LN3_CABECA_M`): alvo1 encosta nele, alvo2 encosta em alvo1, alvo3 encosta em alvo2
 * — cada ciclo seguinte também chega/encosta nessa MESMA pilha (não mais em
 * `ESTACIONADO_LN3_CABECA_M` direto, ver `CABECA_LN3_C2`/`CABECA_LN3_C3` em `gruposDoPassoJ105`),
 * fechando o ciclo: chegada → corte → vira parte da pilha → próxima chegada encosta na pilha.
 */
const PILHA_RETIRADOS_APOS_C1_M = ESTACIONADO_LN3_CABECA_M + comprimentoM(['alvo1']);
const PILHA_RETIRADOS_APOS_C2_M = PILHA_RETIRADOS_APOS_C1_M + comprimentoM(['alvo2']);
const PILHA_RETIRADOS_APOS_C3_M = PILHA_RETIRADOS_APOS_C2_M + comprimentoM(['alvo3']);

/** Papel padrão dos trechos de avariado ANTES de o plano chegar neles: ainda são vagões comuns na
 *  composição (brancos) — só viram `alvo` (contorno vermelho) no passo em que a manobra começa a
 *  tratá-los, e `retirado` (vermelho sólido) depois do corte. */
const AINDA_NORMAIS: Record<string, PapelVeiculoJ105> = { alvo1: 'vagao', alvo2: 'vagao', alvo3: 'vagao' };
const ALVO1_ATIVO: Record<string, PapelVeiculoJ105> = { alvo2: 'vagao', alvo3: 'vagao' };
const ALVO2_ATIVO: Record<string, PapelVeiculoJ105> = { alvo3: 'vagao' };

/** Grupos de avariados já deixados na LN3 até este passo — reaparecem no mapa sempre que existirem,
 *  empilhados/acumulados na MESMA área de retirada (`PILHA_RETIRADOS_APOS_C1_M`/`C2_M`/`C3_M`),
 *  cada um encostando exatamente onde o corte anterior parou (nunca uma posição nova
 *  desconectada). `esmaecido` a partir do passo SEGUINTE ao corte (17/27/35, não mais 16/26/34) —
 *  2026-09-22, pedido explícito do usuário: "a partir do momento que a locomotiva larga o vagão
 *  ruim e desengata dele... o vermelho deve ficar um pouco apagadinho" (ex.: Passo 17), corrigido
 *  em seguida, mesma conversa: "no 16, ainda deve ficar vermelho vivo, pois ainda está sendo
 *  realizado o corte. só na 17 que fica apagado" — no PRÓPRIO passo do corte (16/26/34, `case`s
 *  correspondentes) a ação ainda está em curso, o vagão precisa continuar vívido; só terminou (e o
 *  vagão vira "contexto do pátio", mesmo tratamento de `grupoEstacionadoLN3`) a partir do passo
 *  seguinte. */
function paradosAte(passo: number): GrupoVisualJ105[] {
  const grupos: GrupoVisualJ105[] = [];
  if (passo >= 16) grupos.push({ linha: 'Linha 3', posicaoM: PILHA_RETIRADOS_APOS_C1_M, veiculos: [{ papel: 'retirado', quantidade: 2 }], esmaecido: passo > 16 });
  if (passo >= 26) grupos.push({ linha: 'Linha 3', posicaoM: PILHA_RETIRADOS_APOS_C2_M, veiculos: [{ papel: 'retirado', quantidade: 1 }], esmaecido: passo > 26 });
  if (passo >= 34) grupos.push({ linha: 'Linha 3', posicaoM: PILHA_RETIRADOS_APOS_C3_M, veiculos: [{ papel: 'retirado', quantidade: 2 }], esmaecido: passo > 34 });
  return grupos;
}

/**
 * Grupos desenhados no mapa para um passo (1..38). O primeiro grupo é sempre o conjunto "em ação".
 * Toda posição é a da CABEÇA do grupo, ancorada no Travessão 2 real: parada antes do corte = cauda
 * do grupo no marco do travessão; "puxa até livrar o AMV" = cauda um pouco além dele; recuo para a
 * LN3 = grupo já do outro lado. A composição inteira tem 888 m (92 vagões + 3 locomotivas), então
 * nas paradas coladas ao travessão parte do trem fica antes do início desenhado da linha — é o que
 * acontece de verdade (o trem é mais comprido que o trecho até o travessão) e o desenho corta ali.
 */
export function gruposDoPassoJ105(passo: number): GrupoVisualJ105[] {
  const parados = paradosAte(passo);
  // `grupoEstacionadoLN3()` entra em TODOS os passos (não só 6-9) — ver seu comentário.
  const g = (grupos: GrupoVisualJ105[]): GrupoVisualJ105[] => [...grupos, ...parados, grupoEstacionadoLN3(passo)];

  // Conjuntos que se repetem ao longo dos três ciclos de corte.
  const C1_FRENTE = ['locoA', 'bom', 'preA', 'alvo1'];
  const C1_RESTO = ['postA', 'locoB', 'preB', 'alvo2', 'midB', 'alvo3', 'postB', 'locoC'];
  const C1_APOS = ['locoA', 'bom', 'preA'];
  const C2_FRENTE = ['locoA', 'bom', 'preA', 'postA', 'locoB', 'preB', 'alvo2'];
  const C2_RESTO = ['midB', 'alvo3', 'postB', 'locoC'];
  const C2_APOS = ['locoA', 'bom', 'preA', 'postA', 'locoB', 'preB'];
  const C3_FRENTE = ['locoA', 'bom', 'preA', 'postA', 'locoB', 'preB', 'midB', 'alvo3'];
  const C3_RESTO = ['postB', 'locoC'];
  const C3_APOS = ['locoA', 'bom', 'preA', 'postA', 'locoB', 'preB', 'midB'];

  /** Trem parado com a locomotiva líder logo ANTES do travessão (marco do Travessão 2). */
  const CABECA_NO_MARCO = T2_DESVIO_M - 10;
  /**
   * Cabeça do conjunto que fica esperando na Linha do Desvio durante o corte de cada ciclo
   * (`*_RESTO`) — `T2_DESVIO_M` em si, NUNCA um valor deslocado (2026-09-22, pedido explícito do
   * usuário: "um corte é apenas uma desconexão lógica... nenhum vagão deve se mover de posição").
   * É exatamente onde a cauda do grupo `*_FRENTE` já para (`cabecaComCaudaNoT2`, usado no passo de
   * "puxa até o marco" que antecede cada corte — Passos 11/20/29): o `*_RESTO` é a continuação
   * física do MESMO trem logo atrás dali, então sua cabeça tem que encostar exatamente em
   * `T2_DESVIO_M`, senão o corte (Passos 12/21/30) desenha o `*_RESTO` alguns metros pra trás de
   * onde ele estava um passo antes — um salto que parecia o próprio corte "empurrando" os vagões,
   * quando na verdade só a desconexão lógica (tracejado + X, `MarcaCorte`) deveria aparecer.
   */
  const RESTO_ESPERANDO = T2_DESVIO_M;
  /** Cabeça do grupo parado na LN3 durante cada ciclo (chegada + corte do avariado) — calculada UMA
   *  vez a partir do grupo *_FRENTE (o mais comprido dos dois, ver `cabecaEncostandoEstacionado`) e
   *  reaproveitada pelos dois passos do par (chegada e corte): a locomotiva não se move entre eles,
   *  só o avariado cortado deixa de ser desenhado — mesma cabeça, cauda menor.
   *  Ciclo 1 encosta no trem estacionado (`ESTACIONADO_LN3_CABECA_M`); Ciclos 2 e 3 encostam na
   *  pilha de retirados que o ciclo ANTERIOR já deixou ali (`PILHA_RETIRADOS_APOS_C1_M`/`C2_M`,
   *  não mais direto em `ESTACIONADO_LN3_CABECA_M`) — é a MESMA pilha crescendo, não um novo ponto
   *  de encontro a cada ciclo (2026-09-22, pedido explícito do usuário sobre os Passos 26/34). */
  const CABECA_LN3_C1 = cabecaEncostandoEstacionado(C1_FRENTE);
  const CABECA_LN3_C2 = PILHA_RETIRADOS_APOS_C1_M + comprimentoM(C2_FRENTE);
  const CABECA_LN3_C3 = PILHA_RETIRADOS_APOS_C2_M + comprimentoM(C3_FRENTE);

  switch (passo) {
    // --- Entrada no pátio e corte da locomotiva líder ----------------------------------------
    // Entrando no pátio: ainda antes do travessão, mas longe o bastante do início da linha para o
    // trem inteiro (~490 m na régua de desenho) aparecer sem cortar na borda.
    case 1:
      return g([{ linha: 'Desvio', posicaoM: 560, veiculos: montar(TREM_INICIAL, AINDA_NORMAIS), seta: 'direita' }]);
    case 2:
      return g([{ linha: 'Desvio', posicaoM: CABECA_NO_MARCO, veiculos: montar(TREM_INICIAL, AINDA_NORMAIS) }]);
    case 3:
      return g([{ linha: 'Desvio', posicaoM: CABECA_NO_MARCO, veiculos: montar(TREM_INICIAL, AINDA_NORMAIS), corte: 'atras-da-cabeca' }]);
    case 4:
    case 5:
      return g([
        {
          linha: 'Desvio',
          posicaoM: T2_DESVIO_M + FOLGA_LIVRAR_M + LOCO_M,
          veiculos: montar(['locoA']),
          seta: passo === 4 ? 'direita' : undefined,
        },
        { linha: 'Desvio', posicaoM: CABECA_NO_MARCO - LOCO_M, veiculos: montar(TREM_INICIAL.slice(1), AINDA_NORMAIS) },
      ]);

    // --- Busca do vagão bom na LN3 -----------------------------------------------------------
    // Passo 7: `corte: 'cauda'` em [locoA, bom] marca (tracejado + X, `MarcaCorte`) a separação
    // exata na fronteira com `grupoEstacionadoLN3()` — os dois grupos ficam grudados (mesma
    // posição de encosto) até aqui; só no Passo 8 o vão de fato aparece.
    case 6:
    case 7:
      return g([
        { linha: 'Linha 3', posicaoM: cabecaEncostandoEstacionado(['locoA', 'bom']), veiculos: montar(['locoA', 'bom']), corte: passo === 7 ? 'cauda' : undefined },
        { linha: 'Desvio', posicaoM: CABECA_NO_MARCO - LOCO_M, veiculos: montar(TREM_INICIAL.slice(1), AINDA_NORMAIS) },
      ]);
    // Passo 9 (manipulação do AMV) fica PARADO na mesma posição que o Passo 8 já tinha alcançado
    // (pedido explícito do usuário, 2026-09-22: "precisa manter a mesma posição que estavam no
    // passo 8") — sem isso, [locoA, bom] regredia de volta pra `NA_LN3`, reagrupando visualmente
    // com o trem estacionado que já tinha sido cortado dele no Passo 7. Mesmo padrão de "passo de
    // deslocamento + passo de manipulação parado compartilham a MESMA posição" já usado em
    // Passos 13/14, 17/18, 22/23, 31/32 (`seta` só no passo que de fato se move).
    case 8:
    case 9:
      return g([
        {
          linha: 'Linha 3',
          posicaoM: cabecaAposLivrarAmv(['locoA', 'bom'], T2_LN3_M),
          veiculos: montar(['locoA', 'bom']),
          seta: passo === 8 ? 'direita' : undefined,
        },
        { linha: 'Desvio', posicaoM: CABECA_NO_MARCO - LOCO_M, veiculos: montar(TREM_INICIAL.slice(1), AINDA_NORMAIS) },
      ]);
    // Sem `seta` (2026-09-22, pedido explícito do usuário) — o recuo em si já aconteceu no
    // Passo 9→10, este passo desenha o resultado já engatado ao J105, parado.
    case 10:
      return g([{ linha: 'Desvio', posicaoM: CABECA_NO_MARCO, veiculos: montar(TREM_COM_BOM, AINDA_NORMAIS) }]);

    // --- Ciclo 1: retirada dos avariados das posições 9 e 10 ---------------------------------
    case 11:
      return g([{ linha: 'Desvio', posicaoM: cabecaComCaudaNoT2(C1_FRENTE, T2_DESVIO_M), veiculos: montar(TREM_COM_BOM, ALVO1_ATIVO) }]);
    case 12:
      return g([
        { linha: 'Desvio', posicaoM: cabecaComCaudaNoT2(C1_FRENTE, T2_DESVIO_M), veiculos: montar(C1_FRENTE, { alvo1: 'retirado' }), corte: 'cauda' },
        { linha: 'Desvio', posicaoM: RESTO_ESPERANDO, veiculos: montar(C1_RESTO, ALVO1_ATIVO) },
      ]);
    case 13:
    case 14:
      return g([
        {
          linha: 'Desvio',
          posicaoM: cabecaAposLivrarAmv(C1_FRENTE, T2_DESVIO_M),
          veiculos: montar(C1_FRENTE, { alvo1: 'retirado' }),
          seta: passo === 13 ? 'direita' : undefined,
        },
        { linha: 'Desvio', posicaoM: RESTO_ESPERANDO, veiculos: montar(C1_RESTO, ALVO1_ATIVO) },
      ]);
    case 15:
      return g([
        { linha: 'Linha 3', posicaoM: CABECA_LN3_C1, veiculos: montar(C1_FRENTE, { alvo1: 'retirado' }), seta: 'esquerda' },
        { linha: 'Desvio', posicaoM: RESTO_ESPERANDO, veiculos: montar(C1_RESTO, ALVO1_ATIVO) },
      ]);
    case 16:
      return g([
        { linha: 'Linha 3', posicaoM: CABECA_LN3_C1, veiculos: montar(C1_APOS), corte: 'cauda' },
        { linha: 'Desvio', posicaoM: RESTO_ESPERANDO, veiculos: montar(C1_RESTO, ALVO1_ATIVO) },
      ]);
    case 17:
    case 18:
      return g([
        {
          linha: 'Linha 3',
          posicaoM: cabecaAposLivrarAmv(C1_APOS, T2_LN3_M),
          veiculos: montar(C1_APOS),
          seta: passo === 17 ? 'direita' : undefined,
        },
        { linha: 'Desvio', posicaoM: RESTO_ESPERANDO, veiculos: montar(C1_RESTO, ALVO1_ATIVO) },
      ]);
    case 19:
      return g([{ linha: 'Desvio', posicaoM: CABECA_NO_MARCO, veiculos: montar(TREM_SEM_ALVO1, ALVO1_ATIVO), seta: 'esquerda' }]);

    // --- Ciclo 2: retirada do avariado da posição 78 -----------------------------------------
    case 20:
      return g([{ linha: 'Desvio', posicaoM: cabecaComCaudaNoT2(C2_FRENTE, T2_DESVIO_M), veiculos: montar(TREM_SEM_ALVO1, ALVO2_ATIVO) }]);
    case 21:
      return g([
        { linha: 'Desvio', posicaoM: cabecaComCaudaNoT2(C2_FRENTE, T2_DESVIO_M), veiculos: montar(C2_FRENTE, { alvo2: 'retirado' }), corte: 'cauda' },
        { linha: 'Desvio', posicaoM: RESTO_ESPERANDO, veiculos: montar(C2_RESTO, ALVO2_ATIVO) },
      ]);
    case 22:
    case 23:
      return g([
        {
          linha: 'Desvio',
          posicaoM: cabecaAposLivrarAmv(C2_FRENTE, T2_DESVIO_M),
          veiculos: montar(C2_FRENTE, { alvo2: 'retirado' }),
          seta: passo === 22 ? 'direita' : undefined,
        },
        { linha: 'Desvio', posicaoM: RESTO_ESPERANDO, veiculos: montar(C2_RESTO, ALVO2_ATIVO) },
      ]);
    case 24:
    case 25:
      return g([
        {
          linha: 'Linha 3',
          posicaoM: CABECA_LN3_C2,
          veiculos: montar(C2_FRENTE, { alvo2: 'retirado' }),
          seta: passo === 24 ? 'esquerda' : undefined,
        },
        { linha: 'Desvio', posicaoM: RESTO_ESPERANDO, veiculos: montar(C2_RESTO, ALVO2_ATIVO) },
      ]);
    case 26:
      return g([
        { linha: 'Linha 3', posicaoM: CABECA_LN3_C2, veiculos: montar(C2_APOS), corte: 'cauda' },
        { linha: 'Desvio', posicaoM: RESTO_ESPERANDO, veiculos: montar(C2_RESTO, ALVO2_ATIVO) },
      ]);
    case 27:
      return g([
        { linha: 'Linha 3', posicaoM: cabecaAposLivrarAmv(C2_APOS, T2_LN3_M), veiculos: montar(C2_APOS) },
        { linha: 'Desvio', posicaoM: RESTO_ESPERANDO, veiculos: montar(C2_RESTO, ALVO2_ATIVO) },
      ]);
    case 28:
      return g([{ linha: 'Desvio', posicaoM: CABECA_NO_MARCO, veiculos: montar(TREM_SEM_ALVO2, ALVO2_ATIVO), seta: 'esquerda' }]);

    // --- Ciclo 3: retirada dos avariados das posições 83 e 84 --------------------------------
    case 29:
      return g([{ linha: 'Desvio', posicaoM: cabecaComCaudaNoT2(C3_FRENTE, T2_DESVIO_M), veiculos: montar(TREM_SEM_ALVO2) }]);
    case 30:
      return g([
        { linha: 'Desvio', posicaoM: cabecaComCaudaNoT2(C3_FRENTE, T2_DESVIO_M), veiculos: montar(C3_FRENTE, { alvo3: 'retirado' }), corte: 'cauda' },
        { linha: 'Desvio', posicaoM: RESTO_ESPERANDO, veiculos: montar(C3_RESTO) },
      ]);
    case 31:
    case 32:
      return g([
        {
          linha: 'Desvio',
          posicaoM: cabecaAposLivrarAmv(C3_FRENTE, T2_DESVIO_M),
          veiculos: montar(C3_FRENTE, { alvo3: 'retirado' }),
          seta: passo === 31 ? 'direita' : undefined,
        },
        { linha: 'Desvio', posicaoM: RESTO_ESPERANDO, veiculos: montar(C3_RESTO) },
      ]);
    case 33:
      return g([
        { linha: 'Linha 3', posicaoM: CABECA_LN3_C3, veiculos: montar(C3_FRENTE, { alvo3: 'retirado' }), seta: 'esquerda' },
        { linha: 'Desvio', posicaoM: RESTO_ESPERANDO, veiculos: montar(C3_RESTO) },
      ]);
    case 34:
      return g([
        { linha: 'Linha 3', posicaoM: CABECA_LN3_C3, veiculos: montar(C3_APOS), corte: 'cauda' },
        { linha: 'Desvio', posicaoM: RESTO_ESPERANDO, veiculos: montar(C3_RESTO) },
      ]);
    case 35:
      return g([
        { linha: 'Linha 3', posicaoM: cabecaAposLivrarAmv(C3_APOS, T2_LN3_M), veiculos: montar(C3_APOS) },
        { linha: 'Desvio', posicaoM: RESTO_ESPERANDO, veiculos: montar(C3_RESTO) },
      ]);
    case 36:
      return g([{ linha: 'Desvio', posicaoM: CABECA_NO_MARCO, veiculos: montar(TREM_FINAL), seta: 'esquerda' }]);

    // --- Saída do pátio ----------------------------------------------------------------------
    // Sentido EDV = offset CRESCENTE da linha (convenção de `etapaParada.ts`): o marco de saída
    // fica depois do travessão, no fim da Linha do Desvio.
    case 37:
      return g([{ linha: 'Desvio', posicaoM: 1800, veiculos: montar(TREM_FINAL), seta: 'direita' }]);
    case 38:
      return g([{ linha: 'Desvio', posicaoM: 1944, veiculos: montar(TREM_FINAL), seta: 'direita' }]);

    default:
      return g([{ linha: 'Desvio', posicaoM: CABECA_NO_MARCO, veiculos: montar(TREM_INICIAL, AINDA_NORMAIS) }]);
  }
}

/** Nº do passo a partir do id da etapa (`j105-eN`, ver `planoManobraJ105.ts`) — `null` quando o id
 *  não é de uma etapa do J105. */
export function passoDoEtapaId(etapaId: string | undefined): number | null {
  const m = etapaId ? /^j105-e(\d+)$/.exec(etapaId) : null;
  return m ? Number(m[1]) : null;
}

/**
 * Passos em que o operador está DE FATO manipulando o AMV do Travessão 2 (destrava o cadeado,
 * aciona o macaquinho, move a agulha, trava de novo) — texto "Passo N — Manipulação do AMV..."
 * nas imagens de referência (`J105/passo-05.jpg` e as 7 seguintes do mesmo padrão) e em
 * `planoManobraJ105.ts` (campo `titulo`, todas com `referencia: 'T2'`). Diferente dos passos de
 * circulação em volta dele (4, 8, 13, 17, 22, 26, 31, 34 — "até LIVRAR o AMV", locomotiva ainda se
 * movendo, ninguém mexendo no aparelho ainda): sem essa distinção, os passos 4 e 5 desenhavam
 * exatamente igual no mapa (pedido explícito do usuário, 2026-09-22 — "hoje na visão topológica o
 * passo 4 e 5 está igual").
 * Todos os 8 ciclos do plano manipulam o MESMO AMV (Travessão 2 = `eht-no-64` no fixture EHT,
 * `train-yard/mocks/eht.ts`) — o plano do J105 nunca manipula outro aparelho.
 */
const PASSOS_MANIPULACAO_AMV_T2 = new Set([5, 9, 14, 18, 23, 27, 32, 35]);

/**
 * Passos em que o badge do AMV do Travessão 2 aparece no mapa — MESMO conjunto de
 * `PASSOS_MANIPULACAO_AMV_T2` (não mais uma união mais ampla). Histórico: uma rodada anterior
 * (2026-09-22, "o AMV só deve aparecer nas etapas que é citado manipulação de AMV") tinha incluído
 * também os passos de circulação "até LIVRAR o AMV" que citam a palavra "AMV" no título (4, 8, 13,
 * 17, 22, 31), desenhando o badge NEUTRO/cinza neles — revogado pelo pedido seguinte do usuário,
 * mesma data: "remova a marcação do AMV cinza quando é 'livra o amv'... só quero que mostre o AMV
 * quando for 'Manipulação de AMV'". Como visibilidade e estado agora coincidem, o badge nunca mais
 * desenha neutro — só aparece já ativo/preenchido (ver `amvAtivoDoPassoJ105`, mesmo conjunto).
 */

/**
 * Passos em que o texto do plano manda o trem parar exatamente no marco do Travessão 2
 * (`planoManobraJ105.ts`, campo `titulo` contém "marco", `distanciaM: 651` — o mesmo ponto físico
 * do AMV/`eht-no-64`): 2 ("Trem para no marco do Travessão 2"), 20 e 29 ("... e para no marco",
 * `referencia: 'Pos. 78'`/`'Pos. 83/84'`, mas mesma `distanciaM`, logo o mesmo marco). Pedido
 * explícito do usuário, 2026-09-22: "quando for um passo falando de Marco, ele precisa ser
 * representado assim, em cima do travessão, como uma bolinha amarela. é onde o trem deve parar."
 * O passo 37 ("marco de saída do pátio sentido EDV", `distanciaM: 1800`) também cita "marco" no
 * título, mas é um ponto diferente — fim de linha, sem travessão/diagonal ali — então fica de
 * fora: a imagem de referência do usuário mostra a bolinha em cima da diagonal, o que não existe
 * nesse outro ponto. Nenhuma sobreposição com `PASSOS_MANIPULACAO_AMV_T2` (conjuntos disjuntos).
 */
const PASSOS_MARCO_T2 = new Set([2, 20, 29]);

/** Ver doc de `PASSOS_MARCO_T2`. */
export function passoCitaMarcoJ105(passo: number): boolean {
  return PASSOS_MARCO_T2.has(passo);
}

/** `true` quando o AMV do Travessão 2 deve aparecer no mapa neste passo — `false` nos demais,
 *  onde `AmvJ105Marker` não desenha nada. Ver doc acima: mesmo conjunto de
 *  `PASSOS_MANIPULACAO_AMV_T2`/`amvAtivoDoPassoJ105`. */
export function passoCitaAmvJ105(passo: number | null | undefined): boolean {
  return passo != null && PASSOS_MANIPULACAO_AMV_T2.has(passo);
}

/** Id do marcador real do Travessão 2 no fixture EHT (`train-yard/mocks/eht.ts`) — único AMV que
 *  o plano do J105 manipula. Exportado (não só interno de `amvAtivoDoPassoJ105`) porque o próprio
 *  ícone do AMV (`AmvJ105Marker`, `ComposicaoJ105Layer.tsx`) precisa dele quando visível (ver
 *  `passoCitaAmvJ105`) — só o ESTADO visual (neutro/ativo) vem de `amvAtivoDoPassoJ105`. */
export const AMV_T2_MARKER_ID = 'eht-no-64';

/** Id do marcador real do AMV a destacar no mapa quando `passo` é um dos de manipulação acima —
 *  `undefined` nos demais (nenhum destaque). */
export function amvAtivoDoPassoJ105(passo: number | null | undefined): string | undefined {
  return passo != null && PASSOS_MANIPULACAO_AMV_T2.has(passo) ? AMV_T2_MARKER_ID : undefined;
}
