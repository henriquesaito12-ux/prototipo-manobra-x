// Correções manuais do operador sobre os DADOS DE LEITURA do Pátio (posição e situação de vagões
// e locomotivas). A composição do trem (aba Trem) não é corrigível: lá o operador só decide o que
// retirar e incluir (`AcoesOperacionais`), nunca altera o dado da fonte.
//
// A fonte nunca é sobrescrita. Cada campo corrigido guarda um override com o valor da fonte NO
// MOMENTO da correção, o valor corrigido, o autor e o horário; a visão da tela é montada por cima
// da fonte (`patioFicha.ts`). Como o valor da fonte da época fica guardado, dá pra saber, quando a
// integração mandar um dado novo, se a fonte mudou desde a correção — é isso que permite aplicar
// qualquer uma das regras de conflito (`RegraConflito`) sem mudar este modelo.

//
// Além da correção de campo, o operador ajusta QUAIS veículos estão no pátio (o dado do UNILOG pode
// não refletir a realidade): inclui veículos que a fonte não trouxe (`VeiculoManual`, registro
// próprio, sem valor original) e desconsidera veículos da fonte (`Desconsideracao`, override sobre
// o veículo — o dado original nunca é apagado). A visão final aplica, nesta ordem: fonte →
// correções de Linha/Posição → inclusões manuais e desconsiderações (`montarPatio`).

export type Valor = string | number | undefined;

export type TipoVeiculoPatio = 'vagao' | 'locomotiva';

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

/** Dados de um veículo incluído pelo operador. Série, número, Linha e Posição são obrigatórios
 *  (e, no vagão, a Situação); o resto é opcional. */
export interface DadosVeiculoManual {
  serie: string;
  numero: string;
  linha: string;
  seq: number;
  /** Só vagão — mesma grafia da fonte (ex.: "Ag Tração"). */
  atividade?: string;
  mercadoria?: string;
  pedido?: string;
  pesoUtilT?: number;
  pesoBrutoT?: number;
  origem?: string;
  destino?: string;
  remetente?: string;
  destinatario?: string;
  /** Só locomotiva. */
  combustivelL?: number;
  /** Só locomotiva — "Frente"/"Traseira". */
  posicaoTrem?: string;
}

/** Veículo que não veio da fonte. Não tem valor original; pode ser excluído de verdade. */
export interface VeiculoManual {
  origem: 'manual';
  tipo: TipoVeiculoPatio;
  dados: DadosVeiculoManual;
  autor: string;
  /** Data/hora da inclusão (ISO). */
  em: string;
  /** Última vez que Linha/Posição foi alterada depois da inclusão — é quando o veículo entra na
   *  sequência da linha (`aplicarSequencia`, `patioFicha.ts`). Ausente = na inclusão. */
  posicionadoEm?: string;
}

/** Veículo da fonte marcado para NÃO entrar no plano. A linha da fonte continua intacta. */
export interface Desconsideracao {
  desconsiderado: true;
  motivo?: string;
  autor: string;
  em: string;
  /** Identificação do veículo na fonte quando foi desconsiderado — se uma atualização da fonte
   *  deixar de trazê-lo, a desconsideração fica órfã (conflito, ver `conflitosPatio`). */
  serie: string;
  numero: string;
}

export interface CorrecoesLeitura {
  /** Chave = identidade estável do veículo no pátio (`chaveVeiculoPatio`, `patioFicha.ts`). */
  patio: Record<string, OverridesVeiculo>;
  /** Veículos incluídos pelo operador. Chave = `manual:<tipo>:<id>` (também é a chave do veículo
   *  na visão do pátio). */
  manuais: Record<string, VeiculoManual>;
  /** Desconsiderações, pela mesma chave de `patio` (só veículos da fonte). */
  desconsiderados: Record<string, Desconsideracao>;
}

export function correcoesVazias(): CorrecoesLeitura {
  return { patio: {}, manuais: {}, desconsiderados: {} };
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

// ---------------------------------------------------------------------------------------
// Inclusão manual e desconsideração (puras)
// ---------------------------------------------------------------------------------------

let contadorManual = 0;

export const ehChaveManual = (chave: string) => chave.startsWith('manual:');

/** Inclui um veículo que não veio da fonte. Devolve as correções e a chave do novo veículo. */
export function adicionarVeiculoManual(
  c: CorrecoesLeitura,
  tipo: TipoVeiculoPatio,
  dados: DadosVeiculoManual,
  autor: string,
  em: string = new Date().toISOString(),
): { correcoes: CorrecoesLeitura; chave: string } {
  contadorManual += 1;
  const chave = `manual:${tipo}:${Date.now().toString(36)}-${contadorManual}`;
  return { correcoes: { ...c, manuais: { ...(c.manuais ?? {}), [chave]: { origem: 'manual', tipo, dados, autor, em } } }, chave };
}

/** Altera Linha/Posição de um veículo manual — direto no registro (não há valor da fonte pra
 *  guardar como original). */
export function editarVeiculoManual(
  c: CorrecoesLeitura,
  chave: string,
  posicao: { linha: string; seq: number },
  em: string = new Date().toISOString(),
): CorrecoesLeitura {
  const atual = c.manuais?.[chave];
  if (!atual) return c;
  // Mover = sair da posição antiga e entrar na nova AGORA (por isso `posicionadoEm`).
  return { ...c, manuais: { ...c.manuais, [chave]: { ...atual, dados: { ...atual.dados, ...posicao }, posicionadoEm: em } } };
}

/** "Excluir": só veículo manual é apagado de verdade. */
export function excluirVeiculoManual(c: CorrecoesLeitura, chave: string): CorrecoesLeitura {
  if (!c.manuais?.[chave]) return c;
  const manuais = { ...c.manuais };
  delete manuais[chave];
  return { ...c, manuais };
}

/** "Reverter": desfaz TODAS as alterações de um tipo de veículo — movimentações de Linha/Posição,
 *  inclusões manuais (excluídas) e desconsiderações —, voltando ao dado da fonte. As chaves já
 *  começam pelo tipo (`vagao:…`, `locomotiva:…`, `manual:<tipo>:…`). */
export function reverterTipo(c: CorrecoesLeitura, tipo: TipoVeiculoPatio): CorrecoesLeitura {
  const doTipo = (chave: string) => chave.startsWith(`${tipo}:`) || chave.startsWith(`manual:${tipo}:`);
  const semTipo = <V,>(r: Record<string, V> | undefined) => Object.fromEntries(Object.entries(r ?? {}).filter(([k]) => !doTipo(k)));
  return { ...c, patio: semTipo(c.patio), manuais: semTipo(c.manuais), desconsiderados: semTipo(c.desconsiderados) };
}

/** "Desconsiderar no plano" — só veículo da fonte; o dado original não muda. */
export function desconsiderarVeiculo(
  c: CorrecoesLeitura,
  chave: string,
  veiculo: { serie: string; numero: string },
  motivo: string | undefined,
  autor: string,
  em: string = new Date().toISOString(),
): CorrecoesLeitura {
  if (ehChaveManual(chave)) return c;
  const m = motivo?.trim() || undefined;
  return { ...c, desconsiderados: { ...(c.desconsiderados ?? {}), [chave]: { desconsiderado: true, motivo: m, autor, em, serie: veiculo.serie, numero: veiculo.numero } } };
}

/** "Considerar novamente": desfaz a desconsideração. */
export function considerarNovamente(c: CorrecoesLeitura, chave: string): CorrecoesLeitura {
  if (!c.desconsiderados?.[chave]) return c;
  const desconsiderados = { ...c.desconsiderados };
  delete desconsiderados[chave];
  return { ...c, desconsiderados };
}

// ---------------------------------------------------------------------------------------
// Conflito fonte × inclusão/desconsideração — mesma regra (`RegraConflito`) dos campos
// ---------------------------------------------------------------------------------------
//   - Fonte passa a trazer um veículo igual (série + número) a um incluído manualmente:
//       'manterCorrecao' → vale o registro manual e a linha da fonte fica oculta;
//       'aceitarFonte'   → vale a linha da fonte e o registro manual fica guardado, sem aplicar;
//       'sinalizar'      → como 'manterCorrecao', com o veículo marcado como em conflito.
//   - Fonte deixa de trazer um veículo desconsiderado: não há o que exibir; a desconsideração
//     fica guardada (órfã) e, com 'sinalizar', é listada como conflito.

/** O registro manual vale (true) ou a linha da fonte igual a ele vale (false)? */
export function manualPrevalece(regra: RegraConflito = REGRA_CONFLITO_PADRAO): boolean {
  return regra !== 'aceitarFonte';
}
