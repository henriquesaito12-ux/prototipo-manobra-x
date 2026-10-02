// Visão do Pátio usada pela aba Pátio da Ficha Operacional: todos os veículos que estão no pátio
// (vagões e locomotivas), onde estão e em que situação, já com as correções do operador aplicadas
// por cima da fonte (`correcoesLeitura.ts`).
//
// A posição do vagão vem do dado de localização (`patioVagoes`) e a atividade vem do dado de
// situação (`situacaoVagoes`), unidos pelo número do veículo (`mesclarVagoesESituacao`).
import { mesclarVagoesESituacao, mesmoVeiculo, normalizarNumero, rotuloVeiculo, type CampoFonte, type DadosFichaLeitura } from './fichaModelo';
import { codigoAtividade, separarLinha } from './glossarioFicha';
import {
  manualPrevalece,
  REGRA_CONFLITO_PADRAO,
  resolverCampo,
  type CorrecoesLeitura,
  type Desconsideracao,
  type OverrideCampo,
  type RegraConflito,
  type TipoVeiculoPatio,
  type Valor,
  type VeiculoManual,
} from './correcoesLeitura';

export type { TipoVeiculoPatio };

export type CampoEditavelPatio = 'linha' | 'seq';

/**
 * Só Linha e Posição são editáveis, em vagão e em locomotiva (2026-09-29, pedido explícito do
 * usuário — antes vagão também editava origem/destino/mercadoria/pedido/pesos e locomotiva editava
 * combustível/posição no trem; passaram a somente leitura, sem override). Nunca editáveis: situação
 * e remetente/destinatário (vêm da Situação Vagões), permanência (calculada) e número/série (chave
 * de identificação do veículo).
 */
export const CAMPOS_EDITAVEIS: Record<TipoVeiculoPatio, CampoEditavelPatio[]> = {
  vagao: ['linha', 'seq'],
  locomotiva: ['linha', 'seq'],
};

export const CAMPOS_NUMERICOS: ReadonlySet<CampoEditavelPatio> = new Set(['seq']);

export interface VeiculoNoPatio {
  /** Identidade estável (`chaveVeiculoPatio`) — é a chave das correções. */
  chave: string;
  tipo: TipoVeiculoPatio;
  serie: string;
  numero: string;
  linha?: string;
  seq?: number;
  atividade?: string;
  permanencia?: string;
  origem?: string;
  destino?: string;
  remetente?: string;
  destinatario?: string;
  mercadoria?: string;
  pedido?: string;
  pesoUtilT?: number;
  pesoBrutoT?: number;
  combustivelL?: number;
  posicaoTrem?: string;
  bruto: CampoFonte[];
  /** Está na Visão pátio. Vagão que só existe na Situação Vagões não tem nada editável. */
  temLocalizacao: boolean;
  /** Valor da FONTE de cada campo editável (antes das correções) — vira `valorFonte` ao corrigir. */
  fonte: Partial<Record<CampoEditavelPatio, Valor>>;
  /** Campos com correção aplicada (ausente = vale a fonte). */
  overrides: Partial<Record<CampoEditavelPatio, OverrideCampo>>;
  /** Campos em conflito fonte × correção — só preenchido com a regra 'sinalizar' (ainda não usada). */
  conflitos: CampoEditavelPatio[];
  /** Registro incluído pelo operador (ausente = veio da fonte). */
  manual?: VeiculoManual;
  /** Veículo da fonte desconsiderado no plano — continua na tabela, fora de contagens e do plano. */
  desconsideracao?: Desconsideracao;
  /** Registro manual que a fonte passou a trazer também — só com a regra 'sinalizar'. */
  conflitoManual?: boolean;
  /** Lugar na sequência da linha, contando também os desconsiderados (que não têm `seq`) — é o
   *  que a ordenação padrão usa, pra o desconsiderado continuar onde estava. */
  ordem?: number;
}

// ---------------------------------------------------------------------------------------
// Linhas do pátio — lista fechada
// ---------------------------------------------------------------------------------------

/** Linhas do Pátio Hélio Torres, na ordem da tela (2026-10-02, pedido explícito do usuário). Linha
 *  não é campo aberto: inclusão e movimentação só aceitam estas. */
export const LINHAS_PATIO = ['L4', 'L3', 'L Desvio', 'L Principal', 'Terminal Ferradura'];

/** Código da fonte (UNILOG) → linha do pátio. LN3/LND1 são diretos; LCR (onde vêm as locomotivas)
 *  não tem correspondência confirmada — PROVISÓRIO em L Principal (protótipo). */
const LINHA_POR_CODIGO: Record<string, string> = { LN3: 'L3', LN4: 'L4', LND1: 'L Desvio', LCR: 'L Principal' };

export function linhaDoPatio(codigo?: string): string | undefined {
  if (!codigo) return undefined;
  if (LINHAS_PATIO.includes(codigo)) return codigo;
  return LINHA_POR_CODIGO[separarLinha(codigo).linha.toUpperCase()] ?? codigo;
}

/** Índice da linha na ordem da tela (linha fora da lista vai pro fim). */
export const ordemDaLinha = (linha?: string) => {
  const i = linha ? LINHAS_PATIO.indexOf(linha) : -1;
  return i < 0 ? LINHAS_PATIO.length : i;
};

/** Até que posição dá pra pôr um veículo na linha: as ocupadas (1..N, só considerados do mesmo
 *  tipo, sem contar o próprio veículo) + 1 — não existe posição livre no meio nem depois do fim. */
export function posicaoMaxima(veiculos: VeiculoNoPatio[], tipo: TipoVeiculoPatio, linha: string, ignorar?: string): number {
  return veiculos.filter((v) => v.tipo === tipo && v.linha === linha && !v.desconsideracao && v.chave !== ignorar).length + 1;
}

export const ehManual = (v: VeiculoNoPatio) => !!v.manual;
export const ehDesconsiderado = (v: VeiculoNoPatio) => !!v.desconsideracao;
/** O que entra em indicadores, totais e no plano: tudo, menos os desconsiderados. */
export const considerados = (veiculos: VeiculoNoPatio[]) => veiculos.filter((v) => !v.desconsideracao);

/** `tipo:número#ocorrência` — a fonte real repete linhas idênticas (ex.: J105 traz 286019-8 duas
 *  vezes), então só o número não identifica a linha; a ocorrência mantém a correção presa à
 *  mesma linha quando a fonte é recarregada com o mesmo conteúdo. */
function chavesPorOcorrencia(tipo: TipoVeiculoPatio, itens: { numero: string }[]): string[] {
  const vistos = new Map<string, number>();
  return itens.map((v) => {
    const n = normalizarNumero(v.numero);
    const ocorrencia = (vistos.get(n) ?? 0) + 1;
    vistos.set(n, ocorrencia);
    return `${tipo}:${n}#${ocorrencia}`;
  });
}

type BaseVeiculo = Omit<VeiculoNoPatio, 'chave' | 'fonte' | 'overrides' | 'conflitos'>;

const mesmaIdentidade = (a: { serie: string; numero: string }, b: { serie: string; numero: string }) => mesmoVeiculo(rotuloVeiculo(a), rotuloVeiculo(b));

function veiculoManual(chave: string, m: VeiculoManual): VeiculoNoPatio {
  const d = m.dados;
  return {
    chave,
    tipo: m.tipo,
    serie: d.serie,
    numero: d.numero,
    linha: d.linha,
    seq: d.seq,
    atividade: m.tipo === 'vagao' ? d.atividade : undefined,
    origem: d.origem,
    destino: d.destino,
    remetente: d.remetente,
    destinatario: d.destinatario,
    mercadoria: d.mercadoria,
    pedido: d.pedido,
    pesoUtilT: d.pesoUtilT,
    pesoBrutoT: d.pesoBrutoT,
    combustivelL: m.tipo === 'locomotiva' ? d.combustivelL : undefined,
    posicaoTrem: m.tipo === 'locomotiva' ? d.posicaoTrem : undefined,
    bruto: [],
    temLocalizacao: true,
    fonte: {},
    overrides: {},
    conflitos: [],
    manual: m,
  };
}

// ---------------------------------------------------------------------------------------
// Sequência da linha — Posição é a ORDEM do veículo na linha (1..N, sem buraco), por tipo
// ---------------------------------------------------------------------------------------
// Não existe posição "livre": pôr um veículo na posição p de uma linha empurra quem estava de p em
// diante uma casa pra trás; tirar (mover pra outra linha, desconsiderar) faz quem estava atrás
// subir. Por isso a posição final não é um valor guardado — é o resultado de, a partir da ordem da
// fonte, aplicar em ordem cronológica cada movimentação (override de Linha/Posição), inclusão
// manual e desconsideração. "Restaurar valor original" e "Considerar novamente" só apagam o evento:
// o veículo volta ao lugar que teria sem ele.

type EventoSequencia =
  | { tipo: 'posicionar'; em: string; chave: string; linha: string; seq?: number }
  | { tipo: 'desconsiderar'; em: string; chave: string };

/** Sequências por `tipo|linha` (chaves na ordem física, desconsiderados incluídos). */
type Sequencias = Map<string, string[]>;

const grupo = (tipo: TipoVeiculoPatio, linha: string) => `${tipo}|${linha}`;

function aplicarSequencia(
  veiculos: VeiculoNoPatio[],
  eventos: EventoSequencia[],
): void {
  const porChave = new Map(veiculos.map((v) => [v.chave, v]));
  const seqs: Sequencias = new Map();
  const ondeEsta = new Map<string, string>();
  const fora = new Set<string>();
  const add = (g: string, chave: string, indice?: number) => {
    const lista = seqs.get(g) ?? [];
    if (indice === undefined || indice >= lista.length) lista.push(chave);
    else lista.splice(indice, 0, chave);
    seqs.set(g, lista);
    ondeEsta.set(chave, g);
  };
  const remover = (chave: string) => {
    const g = ondeEsta.get(chave);
    if (!g) return;
    seqs.set(g, (seqs.get(g) ?? []).filter((k) => k !== chave));
    ondeEsta.delete(chave);
  };
  /** Índice na lista em que entra o veículo que vai ocupar a posição `p` (contando só
   *  considerados); posição além do fim = no fim. */
  const indiceDaPosicao = (g: string, p: number | undefined) => {
    const lista = seqs.get(g) ?? [];
    if (!p || p < 1) return lista.length;
    let n = 0;
    for (let i = 0; i < lista.length; i += 1) {
      if (fora.has(lista[i])) continue;
      n += 1;
      if (n === p) return i;
    }
    return lista.length;
  };

  // Ponto de partida: ordem da fonte (já renumerada) — manuais só entram no evento de inclusão.
  [...veiculos]
    .filter((v) => !v.manual && v.linha)
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    .forEach((v) => add(grupo(v.tipo, v.linha!), v.chave));

  [...eventos]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.em.localeCompare(b.e.em) || a.i - b.i)
    .forEach(({ e }) => {
      const v = porChave.get(e.chave);
      if (!v) return;
      if (e.tipo === 'desconsiderar') {
        fora.add(e.chave);
        return;
      }
      remover(e.chave);
      const g = grupo(v.tipo, e.linha);
      add(g, e.chave, indiceDaPosicao(g, e.seq));
    });

  // Numeração final 1..N só dos considerados; desconsiderado fica sem posição, mas no lugar.
  for (const [g, lista] of seqs) {
    const linha = g.slice(g.indexOf('|') + 1);
    let n = 0;
    lista.forEach((chave, i) => {
      const v = porChave.get(chave)!;
      v.linha = linha;
      v.ordem = i;
      v.seq = fora.has(chave) ? undefined : (n += 1);
    });
  }
}

/**
 * Visão do pátio na tela — as três camadas, nesta ordem: (1) dado da fonte (linha convertida pra
 * linha do pátio e posição renumerada 1..N na ordem da fonte), (2) movimentações de Linha e
 * Posição, (3) inclusões manuais e desconsiderações — (2) e (3) aplicadas juntas, em ordem
 * cronológica, sobre a sequência de cada linha (`aplicarSequencia`). Desconsiderados continuam na
 * lista (a tabela os mostra esmaecidos, sem posição); quem conta ou planeja usa `considerados` /
 * `patioParaPlanejamento`.
 */
export function montarPatio(dados: DadosFichaLeitura, correcoes: CorrecoesLeitura, regra: RegraConflito = REGRA_CONFLITO_PADRAO): VeiculoNoPatio[] {
  const vagoes: BaseVeiculo[] = mesclarVagoesESituacao(dados.patioVagoes, dados.situacaoVagoes).map((v) => ({
    tipo: 'vagao',
    serie: v.serie,
    numero: v.numero,
    linha: v.linha,
    seq: v.seq,
    atividade: v.atividade,
    permanencia: v.permanencia,
    origem: v.origem,
    destino: v.destino,
    remetente: v.remetente,
    destinatario: v.destinatario,
    mercadoria: v.mercadoria,
    pedido: v.pedido,
    pesoUtilT: v.pesoUtilT,
    pesoBrutoT: v.pesoBrutoT,
    bruto: v.bruto,
    temLocalizacao: v.temLocalizacao,
  }));
  const locomotivas: BaseVeiculo[] = dados.patioLocomotivas.map((l) => ({
    tipo: 'locomotiva',
    serie: l.serie,
    numero: l.numero,
    linha: l.linha,
    seq: l.seq,
    origem: l.origem,
    destino: l.destino,
    mercadoria: l.mercadoria,
    pedido: l.pedido,
    pesoUtilT: l.pesoUtilT,
    pesoBrutoT: l.pesoBrutoT,
    combustivelL: l.combustivelL,
    posicaoTrem: l.posicaoTrem,
    bruto: l.bruto,
    temLocalizacao: true,
  }));

  const eventos: EventoSequencia[] = [];

  const comChave = (itens: BaseVeiculo[], tipo: TipoVeiculoPatio) => {
    // Chave pela ordem ORIGINAL da fonte (não muda com a renumeração abaixo).
    const chaves = chavesPorOcorrencia(tipo, itens);
    const veiculos = itens.map((base, i): VeiculoNoPatio => ({ ...base, linha: linhaDoPatio(base.linha), chave: chaves[i], fonte: {}, overrides: {}, conflitos: [] }));

    // Fonte renumerada 1..N por linha, na ordem em que ela vem (a fonte real tem buraco e
    // repetição — ex.: LN3 pula de 20 pra 23 e repete 25–27). O número original fica em `bruto`.
    const porLinha = new Map<string, VeiculoNoPatio[]>();
    veiculos.forEach((v) => { if (v.linha) porLinha.set(v.linha, [...(porLinha.get(v.linha) ?? []), v]); });
    porLinha.forEach((vs) =>
      vs
        .map((v, i) => ({ v, i }))
        .sort((a, b) => (a.v.seq ?? Number.MAX_SAFE_INTEGER) - (b.v.seq ?? Number.MAX_SAFE_INTEGER) || a.i - b.i)
        .forEach(({ v }, n) => { v.seq = n + 1; }),
    );

    for (const v of veiculos) {
      const campos = correcoes.patio[v.chave] ?? {};
      let em: string | undefined;
      for (const campo of v.temLocalizacao ? CAMPOS_EDITAVEIS[tipo] : []) {
        v.fonte[campo] = v[campo];
        const r = resolverCampo(v[campo], campos[campo], regra);
        if (!r.override) continue;
        v.overrides[campo] = r.override;
        if (r.conflito) v.conflitos.push(campo);
        if (!em || r.override.em > em) em = r.override.em;
      }
      // Movimentação: vira evento na sequência; a posição final sai de `aplicarSequencia`.
      if (em) {
        const linha = String(v.overrides.linha?.valor ?? v.fonte.linha ?? '');
        if (linha) eventos.push({ tipo: 'posicionar', em, chave: v.chave, linha, seq: v.overrides.seq ? Number(v.overrides.seq.valor) : Number(v.fonte.seq) });
      }
      const desc = correcoes.desconsiderados?.[v.chave];
      if (desc) {
        v.desconsideracao = desc;
        eventos.push({ tipo: 'desconsiderar', em: desc.em, chave: v.chave });
      }
    }
    return veiculos;
  };
  const daFonte = [...comChave(vagoes, 'vagao'), ...comChave(locomotivas, 'locomotiva')];

  // Camada 3: inclusões manuais. Se a fonte passou a trazer o mesmo veículo, um dos dois sai da
  // visão, conforme a regra de conflito (`manualPrevalece`, `correcoesLeitura.ts`).
  const prevalece = manualPrevalece(regra);
  const ocultosDaFonte = new Set<string>();
  const manuais: VeiculoNoPatio[] = [];
  for (const [chave, m] of Object.entries(correcoes.manuais ?? {})) {
    const igualNaFonte = daFonte.find((f) => mesmaIdentidade(f, m.dados));
    if (igualNaFonte && !prevalece) continue;
    const v = veiculoManual(chave, m);
    if (igualNaFonte) {
      ocultosDaFonte.add(igualNaFonte.chave);
      if (regra === 'sinalizar') v.conflitoManual = true;
    }
    manuais.push(v);
    eventos.push({ tipo: 'posicionar', em: m.posicionadoEm ?? m.em, chave, linha: m.dados.linha, seq: m.dados.seq });
  }
  const todos = [...daFonte.filter((f) => !ocultosDaFonte.has(f.chave)), ...manuais];
  aplicarSequencia(todos, eventos.filter((e) => !ocultosDaFonte.has(e.chave)));
  return todos;
}

/**
 * Pátio que o planejamento recebe: a mesma montagem da tela (fonte → Linha/Posição → inclusões
 * e desconsiderações), sem os desconsiderados. É a porta de entrada do pátio da ficha no motor de
 * planejamento.
 */
export function patioParaPlanejamento(dados: DadosFichaLeitura, correcoes: CorrecoesLeitura, regra: RegraConflito = REGRA_CONFLITO_PADRAO): VeiculoNoPatio[] {
  return considerados(montarPatio(dados, correcoes, regra));
}

/** Casos de conflito fonte × inclusão/desconsideração (integração futura — a tela ainda não os
 *  exibe): registros manuais que a fonte passou a trazer e desconsiderações cujo veículo a fonte
 *  deixou de trazer. */
export function conflitosPatio(dados: DadosFichaLeitura, correcoes: CorrecoesLeitura): { manuaisNaFonte: string[]; desconsideracoesOrfas: string[] } {
  const daFonte = montarPatio(dados, { ...correcoes, manuais: {} });
  const chavesFonte = new Set(daFonte.map((v) => v.chave));
  return {
    manuaisNaFonte: Object.entries(correcoes.manuais ?? {}).filter(([, m]) => daFonte.some((f) => mesmaIdentidade(f, m.dados))).map(([k]) => k),
    desconsideracoesOrfas: Object.keys(correcoes.desconsiderados ?? {}).filter((k) => !chavesFonte.has(k)),
  };
}

/** Veículo do pátio com a mesma série + número (vagão ou locomotiva, da fonte ou manual). */
export function encontrarNoPatio(veiculos: VeiculoNoPatio[], id: { serie: string; numero: string }): VeiculoNoPatio | undefined {
  return veiculos.find((v) => mesmaIdentidade(v, id));
}

// ---------------------------------------------------------------------------------------
// Situação e agrupamento — só FATOS (contagens); nenhum estado inferido (ex.: "linha bloqueada")
// ---------------------------------------------------------------------------------------

/** Cor/categoria na fileira esquemática: azul = pronto p/ tração, vermelho = avariado, laranja =
 *  locomotiva; qualquer outra atividade (ou vagão sem dado de situação) fica neutra. */
export type CategoriaPatio = 'pronto' | 'avariado' | 'locomotiva' | 'outra';

export function categoriaDoVeiculo(v: VeiculoNoPatio): CategoriaPatio {
  if (v.tipo === 'locomotiva') return 'locomotiva';
  const cod = codigoAtividade(v.atividade ?? '');
  if (cod === 'AG TRACAO') return 'pronto';
  if (cod === 'AVARIADO') return 'avariado';
  return 'outra';
}

export interface LinhaDoPatio {
  /** Código como está no dado (ex.: "LND1-PAEHT"); vazio = veículo sem linha informada. */
  codigo: string;
  /** Nome curto exibido (ex.: "LND1"). */
  nome: string;
  /** Na ordem da sequência física. */
  veiculos: VeiculoNoPatio[];
}

export function agruparPorLinha(veiculos: VeiculoNoPatio[]): LinhaDoPatio[] {
  const porLinha = new Map<string, VeiculoNoPatio[]>();
  veiculos.forEach((v) => {
    const codigo = v.linha ?? '';
    porLinha.set(codigo, [...(porLinha.get(codigo) ?? []), v]);
  });
  return Array.from(porLinha.entries())
    .map(([codigo, vs]) => ({
      codigo,
      nome: codigo ? separarLinha(codigo).linha : 'Sem linha informada',
      veiculos: [...vs].sort((a, b) => (a.seq ?? Number.MAX_SAFE_INTEGER) - (b.seq ?? Number.MAX_SAFE_INTEGER)),
    }))
    .sort((a, b) => (a.codigo ? 0 : 1) - (b.codigo ? 0 : 1) || a.nome.localeCompare(b.nome));
}

// ---------------------------------------------------------------------------------------
// Faixas de permanência (filtro do Pátio) — só se aplica a vagão. Limites em dias, de propósito
// numa constante isolada pra serem fáceis de ajustar (provisórios, 2026-09-29, pedido explícito
// do usuário).
// ---------------------------------------------------------------------------------------

export interface FaixaPermanencia {
  id: string;
  rotulo: string;
  testar: (dias: number) => boolean;
}

export const FAIXAS_PERMANENCIA: FaixaPermanencia[] = [
  { id: 'ate2', rotulo: 'Até 2 dias', testar: (d) => d <= 2 },
  { id: '2a5', rotulo: 'De 2 a 5 dias', testar: (d) => d > 2 && d <= 5 },
  { id: 'mais5', rotulo: 'Mais de 5 dias', testar: (d) => d > 5 },
];

/** Faixa do vagão, ou `undefined` (locomotiva, ou permanência ausente/não numérica — nesse caso
 *  o veículo simplesmente não aparece em nenhuma faixa, mas continua nas demais). */
export function faixaPermanencia(v: VeiculoNoPatio): string | undefined {
  if (v.tipo !== 'vagao') return undefined;
  const dias = Number(String(v.permanencia ?? '').replace(',', '.'));
  if (Number.isNaN(dias)) return undefined;
  return FAIXAS_PERMANENCIA.find((f) => f.testar(dias))?.id;
}

export interface ContagemPatio {
  prontos: number;
  avariados: number;
  locomotivas: number;
  /** Só na visão do pátio inteiro: linhas com pelo menos um veículo. */
  linhasOcupadas: number;
}

export function contarPatio(veiculos: VeiculoNoPatio[]): ContagemPatio {
  const c = { prontos: 0, avariados: 0, locomotivas: 0 };
  veiculos.forEach((v) => {
    const cat = categoriaDoVeiculo(v);
    if (cat === 'pronto') c.prontos += 1;
    else if (cat === 'avariado') c.avariados += 1;
    else if (cat === 'locomotiva') c.locomotivas += 1;
  });
  const linhasOcupadas = new Set(veiculos.map((v) => v.linha).filter(Boolean)).size;
  return { ...c, linhasOcupadas };
}
