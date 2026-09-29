// Tradução da nomenclatura técnica da fonte (planilha hoje, UNILOG amanhã) para linguagem
// operacional. É o ÚNICO lugar que conhece códigos/abreviações da fonte — a tela usa só os
// rótulos daqui e mostra o termo original como tooltip.

/** Nível de severidade — mesma taxonomia de 5 tipos usada no relatório físico. */
export type TipoRestricao = 'bloqueio' | 'atencao' | 'alerta' | 'verificar' | 'informativo';

export const TIPOS_RESTRICAO: TipoRestricao[] = ['bloqueio', 'atencao', 'alerta', 'verificar', 'informativo'];

export const TIPO_RESTRICAO_LABEL: Record<TipoRestricao, string> = {
  bloqueio: 'Bloqueio',
  atencao: 'Atenção',
  alerta: 'Alerta',
  verificar: 'Verificar',
  informativo: 'Informativo',
};

export const SEVERIDADE_RANK: Record<TipoRestricao, number> = { bloqueio: 0, atencao: 1, alerta: 2, verificar: 3, informativo: 4 };

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

/** Primeira letra maiúscula, resto minúsculo — fallback pra códigos que ainda não estão no catálogo. */
export function capitalizar(s: string): string {
  const t = s.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

interface EntradaRestricao { rotulo: string; nivel: TipoRestricao }

const CATALOGO_RESTRICAO: Record<string, EntradaRestricao> = {
  'VIAJA COM RESTRICAO': { rotulo: 'Viaja com restrição', nivel: 'alerta' },
  ISOLADO: { rotulo: 'Isolado', nivel: 'atencao' },
  'MANUTENCAO PREVENTIVA': { rotulo: 'Manutenção preventiva', nivel: 'informativo' },
  BLOQUEADO: { rotulo: 'Bloqueado', nivel: 'bloqueio' },
  AVARIADO: { rotulo: 'Avariado', nivel: 'bloqueio' },
  // Códigos usados pelos dados de demonstração (mesma taxonomia de 5 níveis).
  BLOQUEIO: { rotulo: 'Bloqueio', nivel: 'bloqueio' },
  ATENCAO: { rotulo: 'Atenção', nivel: 'atencao' },
  ALERTA: { rotulo: 'Alerta', nivel: 'alerta' },
  VERIFICAR: { rotulo: 'Verificar', nivel: 'verificar' },
  INFORMATIVO: { rotulo: 'Informativo', nivel: 'informativo' },
};

/** Opções do cadastro manual de restrição (Criar Ficha). */
export const CODIGOS_RESTRICAO_CADASTRO = ['VIAJA COM RESTRICAO', 'ISOLADO', 'MANUTENCAO PREVENTIVA', 'BLOQUEADO'];

export function traduzirRestricao(codigo: string): EntradaRestricao {
  const achado = CATALOGO_RESTRICAO[semAcento(codigo)];
  return achado ?? { rotulo: capitalizar(codigo) || 'Restrição', nivel: 'verificar' };
}

export type TomAtividade = 'perigo' | 'aviso' | 'info' | 'sucesso' | 'neutro';

const CATALOGO_ATIVIDADE: Record<string, { rotulo: string; tom: TomAtividade; descricao: string }> = {
  AVARIADO: { rotulo: 'Avariado', tom: 'perigo', descricao: 'Vagão com avaria — não pode seguir viagem.' },
  'AG TRACAO': { rotulo: 'Pronto p/ tração', tom: 'info', descricao: 'Vagão pronto, aguardando locomotiva/formação de trem.' },
  'NAO OPERACIONAL': { rotulo: 'Não operacional', tom: 'perigo', descricao: 'Vagão fora de operação.' },
  'AG MANUTENCAO': { rotulo: 'Aguardando manutenção', tom: 'aviso', descricao: 'Vagão aguardando oficina.' },
  'AG CARGA': { rotulo: 'Aguardando carga', tom: 'aviso', descricao: 'Vagão aguardando carregamento.' },
  'AG DESCARGA': { rotulo: 'Aguardando descarga', tom: 'aviso', descricao: 'Vagão aguardando descarregamento.' },
  LIBERADO: { rotulo: 'Liberado', tom: 'sucesso', descricao: 'Vagão liberado para uso.' },
};

/** Código canônico da atividade (sem acento, maiúsculo, ex.: "AG TRACAO") — classifica o
 *  vagão sem depender do rótulo exibido. */
export function codigoAtividade(atividade: string): string {
  return semAcento(atividade);
}

export function traduzirAtividade(codigo: string): { rotulo: string; tom: TomAtividade; descricao?: string } {
  const achado = CATALOGO_ATIVIDADE[semAcento(codigo)];
  return achado ?? { rotulo: codigo.trim() ? capitalizar(codigo) : 'Sem atividade', tom: 'neutro' };
}

/** Motivos sugeridos na retirada — texto livre continua permitido ("Outro"). */
export const MOTIVOS_RETIRADA = ['Avariado', 'Ag Tração', 'Não operacional', 'Restrição de carga', 'Manutenção', 'Pendência de inspeção'];

/**
 * Rótulo legível de cada coluna da fonte. Chave = cabeçalho exatamente como vem na fonte.
 * `aConfirmar` marca abreviações cujo significado ainda não foi validado com a operação — a tela
 * mantém o termo original visível nesses casos.
 */
export const GLOSSARIO_COLUNAS: Record<string, { rotulo: string; aConfirmar?: boolean }> = {
  // Ficha do trem
  Prop: { rotulo: 'Proprietário' },
  Tr: { rotulo: 'Tração', aConfirmar: true },
  Cm: { rotulo: 'Comando', aConfirmar: true },
  Av: { rotulo: 'Avaria', aConfirmar: true },
  Ori: { rotulo: 'Origem' },
  Des: { rotulo: 'Destino' },
  Mercadoria: { rotulo: 'Mercadoria' },
  Dm: { rotulo: 'Dm', aConfirmar: true },
  'Ser/Num': { rotulo: 'Série/Número' },
  'Chave CT-e': { rotulo: 'Chave CT-e' },
  Dnx: { rotulo: 'Destino do próximo trecho', aConfirmar: true },
  Tu: { rotulo: 'Peso útil (t)' },
  Tb: { rotulo: 'Peso bruto (t)' },
  // Visão pátio
  Sér: { rotulo: 'Série' },
  Veículo: { rotulo: 'Veículo' },
  Tmo: { rotulo: 'Tmo', aConfirmar: true },
  P: { rotulo: 'Proprietário' },
  Local: { rotulo: 'Local' },
  Lin: { rotulo: 'Linha' },
  Seq: { rotulo: 'Posição na linha' },
  Trem: { rotulo: 'Trem' },
  Perm: { rotulo: 'Permanência' },
  Org: { rotulo: 'Origem' },
  Dst: { rotulo: 'Destino' },
  Pedido: { rotulo: 'Pedido' },
  Desp: { rotulo: 'Despacho' },
  'Chave do CT-e': { rotulo: 'Chave CT-e' },
  Merc: { rotulo: 'Mercadoria' },
  'Det Merc': { rotulo: 'Detalhe da mercadoria' },
  TU: { rotulo: 'Peso útil (t)' },
  TB: { rotulo: 'Peso bruto (t)' },
  'Data Início': { rotulo: 'Início' },
  'Comb. (L)': { rotulo: 'Combustível (L)' },
  Posição: { rotulo: 'Posição no trem' },
  // Situação vagões
  'AO filha': { rotulo: 'Área operacional' },
  'Lin.': { rotulo: 'Linha' },
  'Seq.': { rotulo: 'Posição na linha' },
  'Ser.': { rotulo: 'Série' },
  Vagão: { rotulo: 'Vagão' },
  'P.': { rotulo: 'Proprietário' },
  'Frt.': { rotulo: 'Frota', aConfirmar: true },
  Atividade: { rotulo: 'Atividade' },
  'Ori.': { rotulo: 'Origem' },
  'Dest.': { rotulo: 'Destino' },
  'Merc.': { rotulo: 'Mercadoria' },
  Remetente: { rotulo: 'Remetente' },
  'Destinat.': { rotulo: 'Destinatário' },
};

export function rotuloColuna(coluna: string): string {
  return GLOSSARIO_COLUNAS[coluna]?.rotulo ?? coluna;
}

/** Tooltip "termo original" — usado em cabeçalhos traduzidos. */
export function dicaColuna(...colunas: string[]): string {
  const aConfirmar = colunas.some((c) => GLOSSARIO_COLUNAS[c]?.aConfirmar);
  return `Coluna na fonte: ${colunas.join(' / ')}${aConfirmar ? ' — significado a confirmar com a operação' : ''}`;
}

/** "LND1-PAEHT" → { linha: "LND1", patio: "PAEHT" } */
export function separarLinha(codigo: string): { linha: string; patio?: string } {
  const [linha, ...resto] = codigo.split('-');
  return { linha: linha || codigo, patio: resto.join('-') || undefined };
}
