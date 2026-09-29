// Correções manuais do operador sobre os DADOS DE LEITURA do Pátio (posição e situação de vagões
// e locomotivas). A composição do trem (aba Trem) não é corrigível: lá o operador só decide o que
// retirar e incluir (`AcoesOperacionais`), nunca altera o dado da fonte.
//
// A fonte nunca é sobrescrita. Cada campo corrigido guarda um override com o valor da fonte NO
// MOMENTO da correção, o valor corrigido, o autor e o horário; a visão da tela é montada por cima
// da fonte (`patioFicha.ts`). Como o valor da fonte da época fica guardado, dá pra saber, quando a
// integração mandar um dado novo, se a fonte mudou desde a correção — é isso que permite aplicar
// qualquer uma das regras de conflito (`RegraConflito`) sem mudar este modelo.

export type Valor = string | number | undefined;

export interface OverrideCampo {
  /** Valor que a fonte tinha quando o operador corrigiu. */
  valorFonte: Valor;
  /** Valor corrigido pelo operador. */
  valor: Valor;
  autor: string;
  /** Data/hora da correção (ISO). */
  em: string;
}

/** Overrides de um veículo, por campo. */
export type OverridesVeiculo = Record<string, OverrideCampo>;

export interface CorrecoesLeitura {
  /** Chave = identidade estável do veículo no pátio (`chaveVeiculoPatio`, `patioFicha.ts`). */
  patio: Record<string, OverridesVeiculo>;
}

export function correcoesVazias(): CorrecoesLeitura {
  return { patio: {} };
}

/** Quantidade de campos corrigidos manualmente. */
export function totalCorrecoes(c: CorrecoesLeitura): number {
  return Object.values(c.patio).reduce((s, campos) => s + Object.keys(campos).length, 0);
}

export function mesmoValor(a: Valor, b: Valor): boolean {
  const vazioA = a === undefined || a === '';
  const vazioB = b === undefined || b === '';
  if (vazioA || vazioB) return vazioA && vazioB;
  return String(a) === String(b);
}

// ---------------------------------------------------------------------------------------
// Conflito fonte × correção — PENDÊNCIA DE REGRA DE NEGÓCIO
// ---------------------------------------------------------------------------------------
// Ainda não está definido o que fazer quando a integração mandar um valor novo para um campo que
// o operador corrigiu. As três opções em discussão cabem no modelo acima, sem mudá-lo:
//   - 'manterCorrecao': a correção continua valendo (comportamento atual).
//   - 'aceitarFonte':   o valor novo da fonte prevalece; o override fica guardado, mas não se aplica.
//   - 'sinalizar':      a correção continua valendo e o campo sai marcado como em conflito, pra
//                       tela pedir uma decisão ao operador.
// Enquanto a regra não for decidida, vale `REGRA_CONFLITO_PADRAO` e a tela não exibe conflitos.

export type RegraConflito = 'manterCorrecao' | 'aceitarFonte' | 'sinalizar';

export const REGRA_CONFLITO_PADRAO: RegraConflito = 'manterCorrecao';

export interface CampoResolvido {
  valor: Valor;
  /** Override aplicado neste campo (ausente = vale a fonte). */
  override?: OverrideCampo;
  /** A fonte mudou depois da correção e a regra pede decisão do operador. */
  conflito: boolean;
}

export function resolverCampo(fonteAtual: Valor, override: OverrideCampo | undefined, regra: RegraConflito = REGRA_CONFLITO_PADRAO): CampoResolvido {
  if (!override) return { valor: fonteAtual, conflito: false };
  const fonteMudou = !mesmoValor(fonteAtual, override.valorFonte);
  if (fonteMudou && regra === 'aceitarFonte') return { valor: fonteAtual, conflito: false };
  return { valor: override.valor, override, conflito: fonteMudou && regra === 'sinalizar' };
}

// ---------------------------------------------------------------------------------------
// Operações (puras)
// ---------------------------------------------------------------------------------------

/** Corrige um campo. Voltar ao valor da fonte remove o override (é o mesmo que restaurar). */
export function corrigirCampo(
  c: CorrecoesLeitura,
  chave: string,
  campo: string,
  valor: Valor,
  valorFonte: Valor,
  autor: string,
  em: string = new Date().toISOString(),
): CorrecoesLeitura {
  if (mesmoValor(valor, valorFonte)) return restaurarCampo(c, chave, campo);
  return { ...c, patio: { ...c.patio, [chave]: { ...(c.patio[chave] ?? {}), [campo]: { valorFonte, valor, autor, em } } } };
}

/** "Restaurar valor original": remove a correção do campo, voltando a valer a fonte. */
export function restaurarCampo(c: CorrecoesLeitura, chave: string, campo: string): CorrecoesLeitura {
  const campos = { ...(c.patio[chave] ?? {}) };
  if (!(campo in campos)) return c;
  delete campos[campo];
  const patio = { ...c.patio };
  if (Object.keys(campos).length === 0) delete patio[chave];
  else patio[chave] = campos;
  return { ...c, patio };
}
