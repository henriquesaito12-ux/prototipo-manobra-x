// Modelo de domínio da Ficha Operacional, separado em duas naturezas de dado:
//
// 1. DADOS DE LEITURA (`DadosFichaLeitura`) — Ficha do Trem, Visão Pátio (vagões/locomotivas) e
//    Situação Vagões. Hoje chegam pelo upload da planilha; no futuro, pela integração com o UNILOG.
//    A tela só recebe este objeto já pronto (ver `fonteDadosFicha.ts`) e nunca sabe de onde veio.
//
// 2. DADOS DE ENTRADA MANUAL (`AcoesOperacionais`) — decisão humana do operador (quais vagões
//    retirar, quantos incluir por bloco). Nunca virá de integração; é estado da própria aplicação.
//
// Nenhum tipo aqui conhece colunas de Excel. O dado original da fonte fica disponível apenas em
// `CampoFonte[]` (`bruto`), usado na visão "colunas da fonte" pra conferência.
//
// 3. CORREÇÕES MANUAIS dos dados de leitura — ver `correcoesLeitura.ts`. Nunca alteram a fonte;
//    são aplicadas por cima dela, e cada linha corrigida carrega `correcao` (metadado de exibição).

/** Par coluna/valor exatamente como veio da fonte — só para conferência ("colunas da fonte"). */
/** Metadado de exibição: presente só em linhas afetadas por correção manual. */
export interface MarcaCorrecao {
  origem: 'fonte' | 'manual';
  alterados: { campo: string; rotulo: string; original: string }[];
}

export interface CampoFonte {
  coluna: string;
  valor: string;
}

export interface CabecalhoTrem {
  trem: string;
  os: string;
  origem: string;
  destino: string;
  /** Data/hora de emissão do relatório na fonte, texto livre (ex.: "02/09/2026 08:19:38"). */
  emitidoEm?: string;
  inicio?: string;
  fim?: string;
  obsFormacao?: string;
  obsParada?: string;
}

export type TipoVeiculo = 'locomotiva' | 'vagao';

export interface VeiculoComposicao {
  /** Posição na composição ordenada (1 = cabeça do trem). */
  posicao: number;
  tipo: TipoVeiculo;
  serie: string;
  numero: string;
  /** Bloco = locomotiva(s) + vagões até a próxima locomotiva. Derivado da ordem, nunca lido pronto. */
  bloco: string;
  origem?: string;
  destino?: string;
  mercadoria?: string;
  pesoBrutoT?: number;
  pesoUtilT?: number;
  bruto: CampoFonte[];
  correcao?: MarcaCorrecao;
}

export interface TotaisComposicao {
  locomotivas: number;
  vagoes: number;
  toneladasUteis?: number;
  toneladasBrutas?: number;
  comprimentoM?: number;
}

export interface NotaSap {
  equipamento: string;
  nota: string;
  ordem: string;
  descricao: string;
  data: string;
}

export interface RestricaoVeiculo {
  posicao?: number;
  serie: string;
  numero: string;
  /** Código como veio da fonte (ex.: "VIAJA COM RESTRICAO") — ver `CATALOGO_RESTRICAO`. */
  codigo: string;
  observacao: string;
  notasSap?: NotaSap[];
}

/** Uma linha de "Visão pátio" (vagões ou locomotivas) — onde o veículo está fisicamente. */
export interface VeiculoPatio {
  serie: string;
  numero: string;
  local: string;
  linha: string;
  seq?: number;
  proprietario?: string;
  trem?: string;
  permanencia?: string;
  origem?: string;
  destino?: string;
  pedido?: string;
  mercadoria?: string;
  pesoUtilT?: number;
  pesoBrutoT?: number;
  /** Só locomotivas. */
  combustivelL?: number;
  /** Só locomotivas — "Frente"/"Traseira" como veio da fonte. */
  posicaoTrem?: string;
  bruto: CampoFonte[];
  correcao?: MarcaCorrecao;
}

export interface SituacaoVagao {
  areaOperacional: string;
  linha: string;
  seq?: number;
  serie: string;
  numero: string;
  proprietario?: string;
  /** Campo principal da aba — ex.: "Avariado", "Ag Tração". Ver `CATALOGO_ATIVIDADE`. */
  atividade: string;
  pedido?: string;
  trem?: string;
  origem?: string;
  destino?: string;
  mercadoria?: string;
  remetente?: string;
  destinatario?: string;
  pesoUtilT?: number;
  pesoBrutoT?: number;
  bruto: CampoFonte[];
  correcao?: MarcaCorrecao;
}

export interface DadosFichaLeitura {
  cabecalho: CabecalhoTrem;
  composicao: VeiculoComposicao[];
  /** Totais informados pela fonte; ausentes são calculados da composição (`totaisDaComposicao`). */
  totais: TotaisComposicao;
  restricoes: RestricaoVeiculo[];
  patioVagoes: VeiculoPatio[];
  patioLocomotivas: VeiculoPatio[];
  situacaoVagoes: SituacaoVagao[];
  /** Local/área consultados nos relatórios de pátio (ex.: "EPW", "EYD"). */
  contextoPatio?: { localVagoes?: string; localLocomotivas?: string; areaOperacional?: string };
}

// ============================================================================
// Entrada manual
// ============================================================================

export interface RetiradaVagao {
  id: string;
  /** Número do vagão na composição — chave de ligação com `VeiculoComposicao.numero`. */
  numero: string;
  serie: string;
  posicao?: number;
  motivo: string;
  observacao: string;
}

export interface InclusaoBloco {
  id: string;
  bloco: string;
  quantidade: number;
  /** Opcional — vazio = qualquer vagão pronto para tração. */
  serie: string;
  observacao: string;
}

export interface AcoesOperacionais {
  retiradas: RetiradaVagao[];
  inclusoes: InclusaoBloco[];
}

/** O que os fluxos de criação (upload / cadastro manual) entregam para virar uma ficha nova. */
export interface NovaFichaDados {
  trem: string;
  os: string;
  patioNome: string;
  /** AAAA-MM-DD */
  data: string;
  leitura: DadosFichaLeitura;
  acoes: AcoesOperacionais;
}

// ---------------------------------------------------------------------------------------
// Inclusão = pedido. O operador informa bloco + quantidade (+ tipo, opcional) e o motor de
// planejamento escolhe quais vagões do pátio entram; antes do plano não existe vagão real.
// ---------------------------------------------------------------------------------------

/** Como o formulário edita um pedido (quantidade como texto, pra validar o que foi digitado). */
export interface PedidoInclusao {
  bloco: string;
  quantidade: string;
  serie: string;
}

export interface ErrosPedidoInclusao {
  bloco?: string;
  quantidade?: string;
}

export function validarPedidoInclusao(p: PedidoInclusao, blocos: string[]): ErrosPedidoInclusao {
  const erros: ErrosPedidoInclusao = {};
  if (!p.bloco) erros.bloco = 'Selecione o bloco.';
  else if (blocos.length > 0 && !blocos.includes(p.bloco)) erros.bloco = 'Bloco não existe nesta composição.';
  const q = p.quantidade.trim();
  if (!/^\d+$/.test(q) || Number(q) < 1) erros.quantidade = 'Informe um número inteiro maior que zero.';
  return erros;
}

export const pedidoValido = (e: ErrosPedidoInclusao) => !e.bloco && !e.quantidade;

/**
 * Grava um pedido VÁLIDO. Se já existe pedido do mesmo bloco + tipo, soma a quantidade nele em
 * vez de criar outra linha. `idEditado` = pedido que está sendo alterado (se ele passar a coincidir
 * com outro, os dois viram um só, com as quantidades somadas).
 */
export function salvarPedidoInclusao(inclusoes: InclusaoBloco[], p: PedidoInclusao, idEditado?: string): InclusaoBloco[] {
  const quantidade = Number(p.quantidade.trim());
  const outras = inclusoes.filter((i) => i.id !== idEditado);
  const mesma = outras.find((i) => i.bloco === p.bloco && i.serie === p.serie);
  if (mesma) return outras.map((i) => (i.id === mesma.id ? { ...i, quantidade: i.quantidade + quantidade } : i));
  if (idEditado) return inclusoes.map((i) => (i.id === idEditado ? { ...i, bloco: p.bloco, quantidade, serie: p.serie } : i));
  return [...inclusoes, { id: novoIdAcao('inc'), bloco: p.bloco, quantidade, serie: p.serie, observacao: '' }];
}

export function acoesVazias(): AcoesOperacionais {
  return { retiradas: [], inclusoes: [] };
}

let contadorId = 0;
export function novoIdAcao(prefixo: string): string {
  contadorId += 1;
  return `${prefixo}-${Date.now().toString(36)}-${contadorId}`;
}

// ============================================================================
// Helpers
// ============================================================================

export function normalizarNumero(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, ' ');
}

/** "HPD 618186-4" — sem duplicar a série quando o número já a contém (ex.: mocks "VG-88011"). */
export function rotuloVeiculo(v: { serie: string; numero: string }): string {
  if (!v.serie) return v.numero;
  return normalizarNumero(v.numero).startsWith(normalizarNumero(v.serie)) ? v.numero : `${v.serie} ${v.numero}`;
}

/** Casa "618194-5" com "HPD 618194-5" (fontes diferentes trazem ou não a série junto). */
export function mesmoVeiculo(a: string, b: string): boolean {
  const x = normalizarNumero(a);
  const y = normalizarNumero(b);
  if (!x || !y) return false;
  return x === y || x.endsWith(` ${y}`) || y.endsWith(` ${x}`);
}

/** Uma linha da tabela unificada de vagões do pátio (Mudança 6) — funde `VeiculoPatio` (posição
 *  física) e `SituacaoVagao` (atividade/status), o mesmo vagão sob duas lentes que antes eram
 *  abas separadas. Campos opcionais porque um vagão pode vir de só uma das duas fontes. */
export interface VeiculoPatioSituacao {
  serie: string;
  numero: string;
  linha?: string;
  seq?: number;
  local?: string;
  permanencia?: string;
  /** Só quando o vagão aparece em Situação Vagões — ex.: "Avariado", "Ag Tração". */
  atividade?: string;
  areaOperacional?: string;
  origem?: string;
  destino?: string;
  /** Só Situação Vagões — estação física (`origem`/`destino`) e empresa (`remetente`/
   *  `destinatario`) não são redundantes, por isso as duas convivem na tabela unificada. */
  remetente?: string;
  destinatario?: string;
  /** Pedido da Visão pátio — o único exibido. */
  pedido?: string;
  /** Pedido que veio da Situação Vagões. Os dois relatórios trazem pedidos DIFERENTES pro mesmo
   *  vagão e só o da Visão pátio é exibido; este fica guardado, sem uso na tela, caso precise. */
  pedidoSituacao?: string;
  mercadoria?: string;
  pesoUtilT?: number;
  pesoBrutoT?: number;
  proprietario?: string;
  trem?: string;
  correcao?: MarcaCorrecao;
  bruto: CampoFonte[];
  /** O vagão está na Visão pátio (localização/carga). Sem isso ele só existe na Situação Vagões e
   *  nada nele é editável — só dado da Visão pátio pode ser corrigido pelo operador. */
  temLocalizacao: boolean;
}

/**
 * Funde Pátio · Vagões (posição física) e Situação Vagões (atividade/status) num só universo de
 * vagões (Mudança 6, 2026-09-28) — eram duas abas descrevendo o MESMO vagão sob lentes
 * diferentes. Campos presentes nos dois lados (linha, posição, origem/destino, pesos, pedido)
 * usam SEMPRE o valor da Visão pátio; da Situação entram só situação e remetente/destinatário. Nenhuma
 * linha se perde: quem aparece só numa das fontes ainda vira linha, com os campos da outra em
 * branco. `bruto` concatena as duas origens, pra "colunas da fonte" mostrar tudo.
 * Pareamento por OCORRÊNCIA do número, não por número único: a planilha real repete linhas
 * idênticas (ex.: J105 traz 286019-8 duas vezes nas duas abas); a 1ª ocorrência de um número em
 * Pátio casa com a 1ª em Situação, a 2ª com a 2ª — assim a tabela unificada mostra exatamente as
 * mesmas linhas que cada aba mostrava antes, sem colapsar duplicatas em silêncio.
 */
export function mesclarVagoesESituacao(patio: VeiculoPatio[], situacao: SituacaoVagao[]): VeiculoPatioSituacao[] {
  const linhas: VeiculoPatioSituacao[] = patio.map((p) => ({
    serie: p.serie,
    numero: p.numero,
    linha: p.linha,
    seq: p.seq,
    local: p.local,
    permanencia: p.permanencia,
    origem: p.origem,
    destino: p.destino,
    pedido: p.pedido,
    mercadoria: p.mercadoria,
    pesoUtilT: p.pesoUtilT,
    pesoBrutoT: p.pesoBrutoT,
    proprietario: p.proprietario,
    trem: p.trem,
    correcao: p.correcao,
    bruto: p.bruto,
    temLocalizacao: true,
  }));

  // Fila, por número, das linhas de Pátio ainda sem par em Situação.
  const semPar = new Map<string, VeiculoPatioSituacao[]>();
  linhas.forEach((l) => {
    const k = normalizarNumero(l.numero);
    semPar.set(k, [...(semPar.get(k) ?? []), l]);
  });

  situacao.forEach((s) => {
    const atual = semPar.get(normalizarNumero(s.numero))?.shift();
    if (!atual) {
      linhas.push({
        serie: s.serie,
        numero: s.numero,
        linha: s.linha,
        seq: s.seq,
        atividade: s.atividade,
        areaOperacional: s.areaOperacional,
        origem: s.origem,
        destino: s.destino,
        remetente: s.remetente,
        destinatario: s.destinatario,
        pedidoSituacao: s.pedido,
        mercadoria: s.mercadoria,
        pesoUtilT: s.pesoUtilT,
        pesoBrutoT: s.pesoBrutoT,
        proprietario: s.proprietario,
        trem: s.trem,
        correcao: s.correcao,
        bruto: s.bruto,
        temLocalizacao: false,
      });
      return;
    }
    Object.assign(atual, {
      atividade: s.atividade,
      areaOperacional: s.areaOperacional,
      remetente: s.remetente,
      destinatario: s.destinatario,
      pedidoSituacao: s.pedido,
      bruto: [...atual.bruto, ...s.bruto],
    });
  });

  return linhas;
}

export function totaisDaComposicao(composicao: VeiculoComposicao[]): TotaisComposicao {
  const locomotivas = composicao.filter((v) => v.tipo === 'locomotiva').length;
  const pesoBruto = composicao.reduce((s, v) => s + (v.pesoBrutoT ?? 0), 0);
  return {
    locomotivas,
    vagoes: composicao.length - locomotivas,
    toneladasBrutas: pesoBruto > 0 ? pesoBruto : undefined,
  };
}

export function blocosDaComposicao(composicao: VeiculoComposicao[]): string[] {
  return Array.from(new Set(composicao.map((v) => v.bloco).filter(Boolean)));
}

/** Séries presentes na composição, da mais frequente pra menos frequente (empate: alfabética) —
 *  opções do filtro por Série não são fixas no código, seguem o que a fonte trouxer. */
export function seriesDaComposicao(composicao: { serie: string }[]): string[] {
  const contagem = new Map<string, number>();
  composicao.forEach((v) => { if (v.serie) contagem.set(v.serie, (contagem.get(v.serie) ?? 0) + 1); });
  return Array.from(contagem.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([serie]) => serie);
}

export function restricaoDoVeiculo(dados: DadosFichaLeitura, v: { numero: string; serie: string }): RestricaoVeiculo | undefined {
  const rotulo = rotuloVeiculo(v);
  return dados.restricoes.find((r) => mesmoVeiculo(rotuloVeiculo(r), rotulo) || mesmoVeiculo(r.numero, v.numero));
}

// ============================================================================
// Validação das Ações Operacionais
// ============================================================================

export interface ErrosAcoes {
  /** Por id de retirada. */
  retiradas: Record<string, string>;
  /** Por id de inclusão. */
  inclusoes: Record<string, string>;
}

export function validarAcoes(acoes: AcoesOperacionais, composicao: VeiculoComposicao[]): ErrosAcoes {
  const erros: ErrosAcoes = { retiradas: {}, inclusoes: {} };
  const vistos = new Set<string>();
  for (const r of acoes.retiradas) {
    const chave = normalizarNumero(r.numero);
    const veiculo = composicao.find((v) => mesmoVeiculo(v.numero, r.numero) || mesmoVeiculo(rotuloVeiculo(v), r.numero));
    if (!veiculo) erros.retiradas[r.id] = 'Vagão não encontrado na composição desta ficha.';
    else if (veiculo.tipo === 'locomotiva') erros.retiradas[r.id] = 'Locomotivas não entram na lista de retirada.';
    else if (vistos.has(chave)) erros.retiradas[r.id] = 'Vagão já está na lista de retirada.';
    vistos.add(chave);
  }
  const combinacoes = new Set<string>();
  const blocos = blocosDaComposicao(composicao);
  for (const inc of acoes.inclusoes) {
    const chave = `${inc.bloco}|${inc.serie}`;
    if (!inc.bloco) erros.inclusoes[inc.id] = 'Informe o bloco de destino.';
    else if (blocos.length > 0 && !blocos.includes(inc.bloco)) erros.inclusoes[inc.id] = 'Bloco não existe nesta composição.';
    else if (!Number.isInteger(inc.quantidade) || inc.quantidade < 1) erros.inclusoes[inc.id] = 'Quantidade deve ser um número inteiro maior que zero.';
    else if (combinacoes.has(chave)) erros.inclusoes[inc.id] = 'Já existe uma inclusão para este bloco e tipo — some as quantidades na mesma linha.';
    combinacoes.add(chave);
  }
  return erros;
}

export function temErros(erros: ErrosAcoes): boolean {
  return Object.keys(erros.retiradas).length > 0 || Object.keys(erros.inclusoes).length > 0;
}
