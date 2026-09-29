// Visão do Pátio usada pela aba Pátio da Ficha Operacional: todos os veículos que estão no pátio
// (vagões e locomotivas), onde estão e em que situação, já com as correções do operador aplicadas
// por cima da fonte (`correcoesLeitura.ts`).
//
// A posição do vagão vem do dado de localização (`patioVagoes`) e a atividade vem do dado de
// situação (`situacaoVagoes`), unidos pelo número do veículo (`mesclarVagoesESituacao`).
import { mesclarVagoesESituacao, normalizarNumero, type CampoFonte, type DadosFichaLeitura } from './fichaModelo';
import { codigoAtividade, separarLinha } from './glossarioFicha';
import { REGRA_CONFLITO_PADRAO, resolverCampo, type CorrecoesLeitura, type OverrideCampo, type RegraConflito, type Valor } from './correcoesLeitura';

export type TipoVeiculoPatio = 'vagao' | 'locomotiva';

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
}

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

  const comChave = (itens: BaseVeiculo[], tipo: TipoVeiculoPatio) => {
    const chaves = chavesPorOcorrencia(tipo, itens);
    return itens.map((base, i) => {
      const campos = correcoes.patio[chaves[i]] ?? {};
      const v: VeiculoNoPatio = { ...base, chave: chaves[i], fonte: {}, overrides: {}, conflitos: [] };
      for (const campo of base.temLocalizacao ? CAMPOS_EDITAVEIS[tipo] : []) {
        const valorFonte = base[campo];
        v.fonte[campo] = valorFonte;
        const r = resolverCampo(valorFonte, campos[campo], regra);
        if (!r.override) continue;
        (v as unknown as Record<string, Valor>)[campo] = r.valor;
        v.overrides[campo] = r.override;
        if (r.conflito) v.conflitos.push(campo);
      }
      return v;
    });
  };
  return [...comChave(vagoes, 'vagao'), ...comChave(locomotivas, 'locomotiva')];
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
