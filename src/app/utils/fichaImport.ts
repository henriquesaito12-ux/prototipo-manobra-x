// Parser do upload da Ficha Operacional (arquivo .xlsx exportado do UNILOG, modelo
// `modelo_ficha_operacao.xlsx`). Converte as 5 abas no modelo neutro de `fichaModelo.ts` —
// `DadosFichaLeitura` (4 abas de leitura) + `AcoesOperacionais` (aba de decisão manual, que no
// upload só serve de pré-preenchimento do formulário). Nada fora deste arquivo conhece coluna de
// planilha; quando a fonte virar a API do UNILOG, este arquivo deixa de ser usado sem tocar na tela.
//
// A aba "Ficha do trem" é um relatório, não uma tabela: blocos repetidos de cabeçalho de
// locomotivas ("Veiculo/Prop/…/Tb") + locomotivas, cabeçalho de vagões ("Veiculo/Ori/…/Tb") +
// vagões, seguidos dos totais, da tabela de restrições e das observações.
import * as XLSX from 'xlsx';
import {
  acoesVazias,
  novoIdAcao,
  totaisDaComposicao,
  type AcoesOperacionais,
  type CabecalhoTrem,
  type CampoFonte,
  type DadosFichaLeitura,
  type RestricaoVeiculo,
  type SituacaoVagao,
  type TotaisComposicao,
  type VeiculoComposicao,
  type VeiculoPatio,
} from '../data/fichaModelo';

export const ABA_FICHA_DO_TREM = 'Ficha do trem';
export const ABA_PATIO_VAGOES = 'Visão pátio - Vagões';
export const ABA_SITUACAO_VAGOES = 'Situação Vagões';
export const ABA_ACOES_OPERACIONAIS = 'Ações Operacionais';
export const ABA_PATIO_LOCOMOTIVAS = 'Visão pátio - locomotivas';
/** Layout antigo (4 abas) — "vagões a retirar" vinha numa aba "Planilha1". Ainda aceito. */
const ABA_LEGADA_RETIRAR = 'Planilha1';

export const ABAS_MODELO = [ABA_FICHA_DO_TREM, ABA_PATIO_VAGOES, ABA_SITUACAO_VAGOES, ABA_ACOES_OPERACIONAIS, ABA_PATIO_LOCOMOTIVAS] as const;

export type Linha = Array<string | number | null>;
/** Conteúdo cru do arquivo: nome da aba → linhas (matriz de células). */
export type PlanilhaBruta = Record<string, Linha[]>;

export interface ResultadoImportacao {
  leitura: DadosFichaLeitura;
  /** Pré-preenchimento do formulário de Ações Operacionais — o operador revisa antes de salvar. */
  acoes: AcoesOperacionais;
  abasEncontradas: string[];
  avisos: string[];
}

export class FichaImportError extends Error {}

function txt(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** "22,000" → 22 · "2066.2" → 2066.2 · "1.479,059" → 1479.059 */
export function numeroFonte(v: unknown): number | undefined {
  let s = txt(v);
  if (!s) return undefined;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function inteiroFonte(v: unknown): number | undefined {
  const n = numeroFonte(v);
  return n === undefined ? undefined : Math.round(n);
}

function opcional(v: unknown): string | undefined {
  return txt(v) || undefined;
}

/** "Data/Hora Início : 01/09/2026" → ["Data/Hora Início", "01/09/2026"] */
function rotuloValor(celula: unknown): [string, string] | null {
  const m = /^([^:]+):\s*(.*)$/.exec(txt(celula));
  return m ? [m[1].trim().toLowerCase(), m[2].trim()] : null;
}

/** Série na Ficha do trem pode vir marcada com "D " (ex.: "D HPD") — marca de destaque da fonte. */
function limparSerie(s: string): string {
  return s.replace(/^D\s+/, '').trim();
}

function camposFonte(cabecalho: Linha, linha: Linha, aPartirDe = 0): CampoFonte[] {
  const out: CampoFonte[] = [];
  cabecalho.forEach((h, i) => {
    const coluna = txt(h);
    if (i < aPartirDe || !coluna) return;
    out.push({ coluna, valor: txt(linha[i]) });
  });
  return out;
}

function letraBloco(idx: number): string {
  return `Bloco ${String.fromCharCode(65 + Math.max(0, idx))}`;
}

// ============================================================================
// Ficha do trem
// ============================================================================

function lerFichaDoTrem(rows: Linha[]): Pick<DadosFichaLeitura, 'cabecalho' | 'composicao' | 'totais' | 'restricoes'> {
  const cab: CabecalhoTrem = { trem: '', os: '', origem: '', destino: '' };
  for (const row of rows.slice(0, 5)) {
    for (const cel of row ?? []) {
      const rv = rotuloValor(cel);
      if (!rv) continue;
      const [rotulo, valor] = rv;
      if (rotulo === 'trem' && !cab.trem) cab.trem = valor;
      else if (rotulo === 'os' && !cab.os) cab.os = valor;
      else if (rotulo === 'origem' && !cab.origem) cab.origem = valor;
      else if (rotulo === 'destino' && !cab.destino) cab.destino = valor;
      else if (rotulo.startsWith('data/hora relat')) cab.emitidoEm = valor || undefined;
      else if (rotulo.startsWith('data/hora in')) cab.inicio = valor || undefined;
      else if (rotulo.startsWith('data/hora fim')) cab.fim = valor || undefined;
    }
  }

  const composicao: VeiculoComposicao[] = [];
  const restricoes: RestricaoVeiculo[] = [];
  const totaisFonte: Partial<TotaisComposicao> = {};
  let blocoIdx = -1;
  let i = 0;

  while (i < rows.length) {
    const row = rows[i] ?? [];
    const c0 = txt(row[0]);
    const c1 = txt(row[1]);
    const c2 = txt(row[2]);
    const c3 = txt(row[3]);

    const ehCabLoco = c2 === 'Veiculo' && c3 === 'Prop';
    const ehCabVagao = c2 === 'Veiculo' && c3 === 'Ori';
    if (ehCabLoco || ehCabVagao) {
      if (ehCabLoco) blocoIdx++;
      const bloco = letraBloco(blocoIdx);
      const cabecalho = row;
      i++;
      while (i < rows.length && txt(rows[i]?.[0]) !== '') {
        const r = rows[i];
        const serieFonte = txt(r[1]);
        composicao.push({
          posicao: inteiroFonte(r[0]) ?? composicao.length + 1,
          tipo: ehCabLoco ? 'locomotiva' : 'vagao',
          serie: limparSerie(serieFonte),
          numero: txt(r[2]),
          bloco,
          origem: ehCabVagao ? opcional(r[3]) : undefined,
          destino: ehCabVagao ? opcional(r[4]) : undefined,
          mercadoria: ehCabVagao ? opcional(r[5]) : undefined,
          pesoUtilT: ehCabVagao ? numeroFonte(r[10]) : undefined,
          pesoBrutoT: numeroFonte(r[11]),
          bruto: [{ coluna: 'Sér', valor: serieFonte }, ...camposFonte(cabecalho, r, 3)],
        });
        i++;
      }
      continue;
    }

    if (c1 === 'Veiculo' && c2 === 'Restricao') {
      i++;
      while (i < rows.length && txt(rows[i]?.[1]) !== '') {
        const r = rows[i];
        const veic = txt(r[1]);
        const espaco = veic.indexOf(' ');
        restricoes.push({
          posicao: inteiroFonte(r[0]),
          serie: espaco > 0 ? veic.slice(0, espaco) : '',
          numero: espaco > 0 ? veic.slice(espaco + 1) : veic,
          codigo: txt(r[2]),
          observacao: txt(r[3]),
        });
        i++;
      }
      continue;
    }

    const rotulo = c0.toLowerCase();
    if (rotulo === 'locos tracionando') totaisFonte.locomotivas = inteiroFonte(row[1]);
    else if (rotulo.startsWith('vag+')) totaisFonte.vagoes = inteiroFonte(row[1]);
    else if (rotulo === 'ton uteis') totaisFonte.toneladasUteis = numeroFonte(row[1]);
    else if (rotulo === 'ton brutas') totaisFonte.toneladasBrutas = numeroFonte(row[1]);
    else if (rotulo === 'comprimento') totaisFonte.comprimentoM = numeroFonte(row[1]);
    else if (rotulo.startsWith('obs forma')) cab.obsFormacao = opcional(row[1]);
    else if (rotulo.startsWith('obs parada')) cab.obsParada = opcional(row[1]);
    i++;
  }

  if (composicao.length === 0) {
    throw new FichaImportError(
      `Não foi possível reconhecer a composição na aba "${ABA_FICHA_DO_TREM}" — verifique se o arquivo mantém o layout original do relatório (cabeçalhos "Veiculo/Prop/…/Tb" e "Veiculo/Ori/…/Tb" por bloco).`,
    );
  }

  const calculados = totaisDaComposicao(composicao);
  const totais: TotaisComposicao = {
    locomotivas: totaisFonte.locomotivas ?? calculados.locomotivas,
    vagoes: totaisFonte.vagoes ?? calculados.vagoes,
    toneladasUteis: totaisFonte.toneladasUteis,
    toneladasBrutas: totaisFonte.toneladasBrutas ?? calculados.toneladasBrutas,
    comprimentoM: totaisFonte.comprimentoM,
  };

  return { cabecalho: cab, composicao, totais, restricoes };
}

// ============================================================================
// Tabelas simples (pátio / situação)
// ============================================================================

function acharCabecalho(rows: Linha[], obrigatorias: string[]): { idx: number; col: (nome: string) => number } | null {
  const idx = rows.findIndex((r) => obrigatorias.every((o) => (r ?? []).some((c) => txt(c) === o)));
  if (idx === -1) return null;
  const header = rows[idx].map(txt);
  return { idx, col: (nome) => header.indexOf(nome) };
}

function valorRotulado(rows: Linha[], rotulo: string): string | undefined {
  for (const row of rows.slice(0, 6)) {
    for (const cel of row ?? []) {
      const rv = rotuloValor(cel);
      if (rv && rv[0] === rotulo.toLowerCase()) return rv[1] || undefined;
    }
  }
  return undefined;
}

function lerPatio(rows: Linha[], locomotivas: boolean): VeiculoPatio[] {
  const cab = acharCabecalho(rows, ['Sér', 'Veículo']);
  if (!cab) return [];
  const { idx, col } = cab;
  const g = (r: Linha, nome: string) => (col(nome) >= 0 ? r[col(nome)] : null);
  const out: VeiculoPatio[] = [];
  for (let i = idx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (!txt(r[0]) || txt(r[0]) === 'Total Veículos') break;
    out.push({
      serie: txt(g(r, 'Sér')),
      numero: txt(g(r, 'Veículo')),
      local: txt(g(r, 'Local')),
      linha: txt(g(r, 'Lin')),
      seq: inteiroFonte(g(r, 'Seq')),
      proprietario: opcional(g(r, 'P')),
      trem: opcional(g(r, 'Trem')),
      permanencia: opcional(g(r, 'Perm')),
      origem: opcional(g(r, 'Org')),
      destino: opcional(g(r, 'Dst')),
      pedido: opcional(g(r, 'Pedido')),
      mercadoria: opcional(g(r, 'Merc')),
      pesoUtilT: numeroFonte(g(r, 'TU')),
      pesoBrutoT: numeroFonte(g(r, 'TB')),
      combustivelL: locomotivas ? numeroFonte(g(r, 'Comb. (L)')) : undefined,
      posicaoTrem: locomotivas ? opcional(g(r, 'Posição')) : undefined,
      bruto: camposFonte(rows[idx], r),
    });
  }
  return out;
}

function lerSituacao(rows: Linha[]): { itens: SituacaoVagao[]; area?: string } {
  const cab = acharCabecalho(rows, ['Vagão', 'Atividade']);
  if (!cab) return { itens: [] };
  const { idx, col } = cab;
  const g = (r: Linha, nome: string) => (col(nome) >= 0 ? r[col(nome)] : null);
  // "Área Operacional" é um cabeçalho com o valor na linha de baixo (não "Rótulo: valor").
  const idxArea = rows.findIndex((r) => txt(r?.[0]) === 'Área Operacional');
  const area = idxArea >= 0 ? opcional(rows[idxArea + 1]?.[0]) : undefined;
  const itens: SituacaoVagao[] = [];
  for (let i = idx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (!txt(g(r, 'Vagão'))) continue;
    itens.push({
      areaOperacional: txt(g(r, 'AO filha')),
      linha: txt(g(r, 'Lin.')),
      seq: inteiroFonte(g(r, 'Seq.')),
      serie: txt(g(r, 'Ser.')),
      numero: txt(g(r, 'Vagão')),
      proprietario: opcional(g(r, 'P.')),
      atividade: txt(g(r, 'Atividade')),
      pedido: opcional(g(r, 'Pedido')),
      trem: opcional(g(r, 'Trem')),
      origem: opcional(g(r, 'Ori.')),
      destino: opcional(g(r, 'Dest.')),
      mercadoria: opcional(g(r, 'Merc.')),
      remetente: opcional(g(r, 'Remetente')),
      destinatario: opcional(g(r, 'Destinat.')),
      pesoUtilT: numeroFonte(g(r, 'TU')),
      pesoBrutoT: numeroFonte(g(r, 'TB')),
      bruto: camposFonte(rows[idx], r),
    });
  }
  return { itens, area };
}

// ============================================================================
// Ações Operacionais (pré-preenchimento)
// ============================================================================

function lerAcoes(rows: Linha[], composicao: VeiculoComposicao[]): AcoesOperacionais {
  const acoes = acoesVazias();
  const cab = acharCabecalho(rows, ['Veiculo']);
  if (!cab) return acoes;
  const { idx, col } = cab;
  const header = rows[idx].map(txt);
  const iSeq = col('Seq');
  const iSer = col('Sér');
  const iVeic = col('Veiculo');
  const iMotivo = header.findIndex((h, i) => i > iVeic && /motivo|observ|ativ/i.test(h));
  const iBloco = col('Bloco');
  const iQtd = col('Quantidade');
  const iSerieInc = header.findIndex((h, i) => i > iBloco && iBloco >= 0 && /s[ée]rie|tipo/i.test(h));

  for (let i = idx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const numero = txt(r[iVeic]);
    if (numero) {
      const posicao = iSeq >= 0 ? inteiroFonte(r[iSeq]) : undefined;
      const naComposicao = composicao.find((v) => v.numero === numero);
      acoes.retiradas.push({
        id: novoIdAcao('ret'),
        numero,
        serie: (iSer >= 0 ? txt(r[iSer]) : '') || naComposicao?.serie || '',
        posicao: posicao ?? naComposicao?.posicao,
        motivo: iMotivo >= 0 ? txt(r[iMotivo]) : '',
        observacao: '',
      });
    }
    if (iBloco >= 0 && iQtd >= 0) {
      const blocoFonte = txt(r[iBloco]);
      const quantidade = inteiroFonte(r[iQtd]);
      if (blocoFonte && quantidade) {
        // Aceita "A" ou "Bloco A".
        const bloco = /^bloco/i.test(blocoFonte) ? `Bloco ${blocoFonte.replace(/^bloco\s*/i, '').toUpperCase()}` : `Bloco ${blocoFonte.toUpperCase()}`;
        acoes.inclusoes.push({ id: novoIdAcao('inc'), bloco, quantidade, serie: iSerieInc >= 0 ? txt(r[iSerieInc]) : '', observacao: '' });
      }
    }
  }
  return acoes;
}

function lerAcoesLegado(rows: Linha[], composicao: VeiculoComposicao[]): AcoesOperacionais {
  const acoes = acoesVazias();
  const idx = rows.findIndex((r) => (r ?? []).some((c) => txt(c) !== ''));
  if (idx === -1) return acoes;
  const header = rows[idx].map((c) => txt(c).toLowerCase());
  const iVag = header.findIndex((h) => h.includes('vag'));
  const iAtiv = header.findIndex((h) => h.includes('ativ'));
  if (iVag === -1) return acoes;
  for (let i = idx + 1; i < rows.length; i++) {
    const numero = txt(rows[i]?.[iVag]);
    if (!numero) continue;
    const v = composicao.find((c) => numero.endsWith(c.numero));
    acoes.retiradas.push({ id: novoIdAcao('ret'), numero: v?.numero ?? numero, serie: v?.serie ?? '', posicao: v?.posicao, motivo: iAtiv >= 0 ? txt(rows[i][iAtiv]) : '', observacao: '' });
  }
  return acoes;
}

// ============================================================================
// Entrada
// ============================================================================

export function interpretarPlanilha(bruta: PlanilhaBruta): ResultadoImportacao {
  const abas = Object.keys(bruta);
  if (!bruta[ABA_FICHA_DO_TREM]) {
    throw new FichaImportError(`A aba "${ABA_FICHA_DO_TREM}" não foi encontrada — ela é obrigatória. Abas no arquivo: ${abas.join(', ') || 'nenhuma'}.`);
  }
  const ficha = lerFichaDoTrem(bruta[ABA_FICHA_DO_TREM]);
  const avisos: string[] = [];
  for (const aba of ABAS_MODELO) {
    if (aba === ABA_ACOES_OPERACIONAIS && !bruta[aba] && bruta[ABA_LEGADA_RETIRAR]) continue;
    if (!bruta[aba]) avisos.push(`Aba "${aba}" não encontrada — essa seção ficará vazia.`);
  }

  const rowsVag = bruta[ABA_PATIO_VAGOES] ?? [];
  const rowsLoc = bruta[ABA_PATIO_LOCOMOTIVAS] ?? [];
  const situacao = lerSituacao(bruta[ABA_SITUACAO_VAGOES] ?? []);

  const leitura: DadosFichaLeitura = {
    ...ficha,
    patioVagoes: lerPatio(rowsVag, false),
    patioLocomotivas: lerPatio(rowsLoc, true),
    situacaoVagoes: situacao.itens,
    contextoPatio: {
      localVagoes: valorRotulado(rowsVag, 'Local'),
      localLocomotivas: valorRotulado(rowsLoc, 'Local'),
      areaOperacional: situacao.area,
    },
  };

  const acoes = bruta[ABA_ACOES_OPERACIONAIS]
    ? lerAcoes(bruta[ABA_ACOES_OPERACIONAIS], ficha.composicao)
    : bruta[ABA_LEGADA_RETIRAR]
      ? lerAcoesLegado(bruta[ABA_LEGADA_RETIRAR], ficha.composicao)
      : acoesVazias();

  return { leitura, acoes, abasEncontradas: abas, avisos };
}

export function planilhaBrutaDoWorkbook(wb: XLSX.WorkBook): PlanilhaBruta {
  const out: PlanilhaBruta = {};
  for (const nome of wb.SheetNames) {
    out[nome] = XLSX.utils.sheet_to_json<Linha>(wb.Sheets[nome], { header: 1, defval: null, raw: false, blankrows: true });
  }
  return out;
}

export async function parseFichaXlsx(file: File): Promise<ResultadoImportacao> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return interpretarPlanilha(planilhaBrutaDoWorkbook(workbook));
}

// ============================================================================
// "Baixar modelo de planilha" — mesmas 5 abas do modelo, só cabeçalhos.
// ============================================================================

const CABECALHO_PATIO = ['Sér', 'Veículo', 'Tmo', 'P', 'Local', 'Lin', 'Seq', 'Trem', 'Perm', 'Org', 'Dst', 'Pedido', 'Desp', 'Chave do CT-e', 'Merc', 'Det Merc', 'TU', 'TB', 'Data Início'];

export function gerarModeloWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['HISTÓRICO DA COMPOSIÇÃO - COMPOSIÇÃO ORDENADA DO TREM'],
    ['Trem: ', 'Origem: ', 'Destino: ', 'OS: ', 'Data/Hora Relatório: '],
    [],
    [null, null, 'Veiculo', 'Prop', 'Tr', 'Cm', 'Av', null, null, null, null, 'Tb'],
    [],
    [null, null, 'Veiculo', 'Ori', 'Des', 'Mercadoria', 'Dm', 'Ser/Num', 'Chave CT-e', 'Dnx', 'Tu', 'Tb'],
    [],
    ['Locos Tracionando'], ['Vag+Ca+Equip+Lr'], ['Ton Uteis'], ['Ton Brutas'], ['Comprimento'],
    [],
    [null, 'Veiculo', 'Restricao', 'Observacao'],
    [],
    ['OBS Formação:'], ['OBS Parada:'],
  ]), ABA_FICHA_DO_TREM);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Local: ', 'Veículo: V'], [], CABECALHO_PATIO]), ABA_PATIO_VAGOES);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Área Operacional', 'Grupo Estação', 'Classificado por'], [], [],
    ['AO filha', 'Lin.', 'Seq.', 'Ser.', 'Vagão', 'P.', 'Frt.', 'Pedido', 'Trem', 'Atividade', 'Ori.', 'Dest.', 'Merc.', 'Remetente', 'Destinat.', 'TU', 'TB'],
  ]), ABA_SITUACAO_VAGOES);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Vagões a Retirar', '', '', '', 'Inclusões adicionais'],
    ['Inclua abaixo os veículos que devem ser retirados da composição. Cada um deles será substituído por um vagão pronto para tração.', '', '', '', 'Caso queira incluir vagões adicionais, além das substituições, informe o bloco e a quantidade abaixo.'],
    ['Seq', 'Sér', 'Veiculo', 'Motivo', 'Bloco', 'Quantidade'],
  ]), ABA_ACOES_OPERACIONAIS);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Local: ', 'Veículo: L'], [], [...CABECALHO_PATIO, 'Comb. (L)', 'Posição']]), ABA_PATIO_LOCOMOTIVAS);
  return wb;
}

export function baixarModeloXlsx(nomeArquivo = 'modelo_ficha_operacao.xlsx'): void {
  XLSX.writeFile(gerarModeloWorkbook(), nomeArquivo);
}
