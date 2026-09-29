// Aba Trem da Ficha Operacional — o trem que chega e o que muda nele por decisão do operador.
//
// Ordem das seções: Resumo → Ações operacionais → Composição. Os dados da fonte (resumo e
// composição) são só leitura. As ações do operador (vagões a retirar + inclusões por bloco,
// modelo `AcoesOperacionais`, salvo a cada mudança) aparecem numa seção compacta de leitura e são
// editadas no painel lateral `PainelAcoesOperacionais` (aberto pelo `DetalheFicha`). Com o painel
// aberto, os vagões da composição viram selecionáveis pra retirada.
import { ArrowRight, Check, Eye, ListChecks, Lock, Minus, MousePointerClick, Pencil, Plus, Train } from 'lucide-react';
import { HeaderTooltip, SecaoCartao } from '../PageHeader';
import {
  blocosDaComposicao,
  mesmoVeiculo,
  novoIdAcao,
  restricaoDoVeiculo,
  rotuloVeiculo,
  seriesDaComposicao,
  type AcoesOperacionais,
  type DadosFichaLeitura,
  type RestricaoVeiculo,
  type TipoVeiculo,
  type VeiculoComposicao,
} from '../../data/fichaModelo';
import { dicaColuna, traduzirRestricao } from '../../data/glossarioFicha';
import type { ModoAberturaAcoes } from './PainelAcoesOperacionais';
import {
  alternarNaLista,
  BadgeSecao,
  BotaoFicha,
  CardResumo,
  EstadoVazio,
  fmtNum,
  fmtT,
  GradeCards,
  GrupoFiltro,
  IdVeiculo,
  OpcaoFiltro,
  ordenar,
  Pill,
  Rota,
  T,
  TabelaSangrada,
  tdStyle,
  Th,
  useOrdenacao,
} from './fichaUi';

// ---------------------------------------------------------------------------------------
// Filtro
// ---------------------------------------------------------------------------------------

/** Sentinela da opção "Sem restrição" no grupo Restrição (as demais opções são os tipos de
 *  restrição presentes nos dados — nunca fixas no código). */
export const SEM_RESTRICAO = '__sem_restricao__';

export interface FiltroTrem {
  tipos: TipoVeiculo[];
  series: string[];
  blocos: string[];
  /** Rótulo do tipo de restrição (ex.: "Isolado") ou `SEM_RESTRICAO`. */
  restricoes: string[];
  /** Grupo "Ação operacional" — só uma opção hoje ("A retirar"). */
  aRetirar: boolean;
}

export const FILTRO_TREM_PADRAO: FiltroTrem = { tipos: [], series: [], blocos: [], restricoes: [], aRetirar: false };

export function filtroTremAtivo(f: FiltroTrem): boolean {
  return f.tipos.length > 0 || f.series.length > 0 || f.blocos.length > 0 || f.restricoes.length > 0 || f.aRetirar;
}

/** Quantos GRUPOS têm alguma seleção (não quantas opções) — é o número que aparece no título do
 *  painel, ex.: "Filtros — Trem (2)". */
export function contarFiltrosAtivosTrem(f: FiltroTrem): number {
  return [f.tipos.length > 0, f.series.length > 0, f.blocos.length > 0, f.restricoes.length > 0, f.aRetirar].filter(Boolean).length;
}

/** Rótulo do tipo de restrição do veículo (o mesmo mostrado na tabela), ou `undefined` se não
 *  tiver restrição. */
function rotuloRestricaoDoVeiculo(dados: DadosFichaLeitura, v: VeiculoComposicao): string | undefined {
  const r = restricaoDoVeiculo(dados, v);
  return r ? traduzirRestricao(r.codigo).rotulo : undefined;
}

export function FiltroPainelTrem({ dados, acoes, filtro, onFiltroChange }: {
  dados: DadosFichaLeitura;
  acoes: AcoesOperacionais;
  filtro: FiltroTrem;
  onFiltroChange: (f: FiltroTrem) => void;
}) {
  const comp = dados.composicao;
  const series = seriesDaComposicao(comp);
  const blocos = blocosDaComposicao(comp);
  // Tipos de restrição presentes nos dados agora — nunca uma lista fixa (a fonte pode trazer
  // outras no futuro). "Sem restrição" entra como mais uma opção do mesmo grupo.
  const tiposRestricao = Array.from(new Set(comp.map((v) => rotuloRestricaoDoVeiculo(dados, v)).filter((r): r is string => !!r)));
  const semRestricaoQtd = comp.filter((v) => !rotuloRestricaoDoVeiculo(dados, v)).length;
  const opcoesRestricao = tiposRestricao.length + (semRestricaoQtd > 0 ? 1 : 0);

  return (
    <>
      <GrupoFiltro titulo="Tipo de veículo">
        <OpcaoFiltro ativo={filtro.tipos.includes('locomotiva')} onClick={() => onFiltroChange({ ...filtro, tipos: alternarNaLista(filtro.tipos, 'locomotiva') })} contagem={comp.filter((v) => v.tipo === 'locomotiva').length}>
          Locomotiva
        </OpcaoFiltro>
        <OpcaoFiltro ativo={filtro.tipos.includes('vagao')} onClick={() => onFiltroChange({ ...filtro, tipos: alternarNaLista(filtro.tipos, 'vagao') })} contagem={comp.filter((v) => v.tipo === 'vagao').length}>
          Vagão
        </OpcaoFiltro>
      </GrupoFiltro>
      {series.length > 1 && (
        <GrupoFiltro titulo="Série">
          {series.map((s) => (
            <OpcaoFiltro key={s} ativo={filtro.series.includes(s)} onClick={() => onFiltroChange({ ...filtro, series: alternarNaLista(filtro.series, s) })} contagem={comp.filter((v) => v.serie === s).length}>
              {s}
            </OpcaoFiltro>
          ))}
        </GrupoFiltro>
      )}
      {blocos.length > 1 && (
        <GrupoFiltro titulo="Bloco">
          {blocos.map((b) => (
            <OpcaoFiltro key={b} ativo={filtro.blocos.includes(b)} onClick={() => onFiltroChange({ ...filtro, blocos: alternarNaLista(filtro.blocos, b) })} contagem={comp.filter((v) => v.bloco === b).length}>
              {b}
            </OpcaoFiltro>
          ))}
        </GrupoFiltro>
      )}
      {opcoesRestricao > 1 && (
        <GrupoFiltro titulo="Restrição">
          {tiposRestricao.map((rotulo) => (
            <OpcaoFiltro key={rotulo} ativo={filtro.restricoes.includes(rotulo)} onClick={() => onFiltroChange({ ...filtro, restricoes: alternarNaLista(filtro.restricoes, rotulo) })} contagem={comp.filter((v) => rotuloRestricaoDoVeiculo(dados, v) === rotulo).length}>
              {rotulo}
            </OpcaoFiltro>
          ))}
          <OpcaoFiltro ativo={filtro.restricoes.includes(SEM_RESTRICAO)} onClick={() => onFiltroChange({ ...filtro, restricoes: alternarNaLista(filtro.restricoes, SEM_RESTRICAO) })} contagem={semRestricaoQtd}>
            Sem restrição
          </OpcaoFiltro>
        </GrupoFiltro>
      )}
      <GrupoFiltro titulo="Ação operacional">
        <OpcaoFiltro ativo={filtro.aRetirar} onClick={() => onFiltroChange({ ...filtro, aRetirar: !filtro.aRetirar })} contagem={acoes.retiradas.length}>
          A retirar
        </OpcaoFiltro>
      </GrupoFiltro>
    </>
  );
}

// ---------------------------------------------------------------------------------------
// Ações operacionais — seção compacta (leitura; a edição é no painel lateral)
// ---------------------------------------------------------------------------------------

const textoColunaVazia: React.CSSProperties = { fontSize: '0.75rem', color: T.lo, fontFamily: T.font };
const linkAcao: React.CSSProperties = { border: 'none', background: 'transparent', padding: 0, fontSize: '0.75rem', fontWeight: 600, fontFamily: T.font, cursor: 'pointer' };

function ContadorPilula({ n, cor }: { n: number; cor: string }) {
  return (
    <span style={{ fontSize: '0.6875rem', fontWeight: 600, lineHeight: '1rem', color: cor, backgroundColor: `color-mix(in srgb, ${cor} 10%, transparent)`, borderRadius: '62.4375rem', padding: '0 0.375rem', fontFamily: T.font, fontVariantNumeric: 'tabular-nums' }}>
      {n}
    </span>
  );
}

/** Rótulo fixo (~170px) de cada linha: ícone + título + contador. */
function RotuloLinha({ icone: Icone, cor, titulo, contagem }: { icone: typeof Minus; cor: string; titulo: string; contagem: number }) {
  return (
    <span className="inline-flex items-center" style={{ gap: '0.3125rem', fontSize: '0.75rem', fontWeight: 500, color: cor, fontFamily: T.font, whiteSpace: 'nowrap' }}>
      <Icone size="0.8125rem" strokeWidth={2.5} />
      {titulo}
      <ContadorPilula n={contagem} cor={cor} />
    </span>
  );
}

/** Quantidade de retiradas por bloco, na ordem da composição — blocos sem retirada não entram.
 *  Resumo puro (sem listar vagão a vagão): quem quer o detalhe individual vai à composição
 *  (que marca o vagão retirado) ou ao painel lateral (que lista todos com motivo/observação). */
function contarRetiradasPorBloco(dados: DadosFichaLeitura, retiradas: AcoesOperacionais['retiradas']) {
  const veiculoDe = (numero: string) => dados.composicao.find((v) => mesmoVeiculo(v.numero, numero));
  return blocosDaComposicao(dados.composicao)
    .map((bloco) => ({ bloco, total: retiradas.filter((r) => veiculoDe(r.numero)?.bloco === bloco).length }))
    .filter((g) => g.total > 0);
}

/** "Bloco C 2 (HFE)" — o tipo só entra quando informado. */
function InclusaoResumo({ i }: { i: AcoesOperacionais['inclusoes'][number] }) {
  return (
    <span style={{ fontSize: '0.75rem', fontFamily: T.font }}>
      <span style={{ color: T.md }}>{i.bloco} </span>
      <span style={{ fontWeight: 500, color: T.hi }}>{i.quantidade}</span>
      {i.serie && <span style={{ color: T.md }}> ({i.serie})</span>}
    </span>
  );
}

function AcoesOperacionaisResumo({ dados, acoes, editavel, onAbrir }: {
  dados: DadosFichaLeitura;
  acoes: AcoesOperacionais;
  editavel: boolean;
  onAbrir: (modo: ModoAberturaAcoes) => void;
}) {
  const retiradas = acoes.retiradas;
  const inclusoes = acoes.inclusoes;
  const totalIncluir = inclusoes.reduce((t, i) => t + (i.quantidade || 0), 0);
  const vazioTotal = retiradas.length === 0 && inclusoes.length === 0;

  const direita = (
    <span className="flex items-center" style={{ gap: '0.5rem' }}>
      {/* Ficha confirmada: o bloqueio precisa ficar evidente — badge neutro em vez de simplesmente
          esconder o azul "Editável" (2026-09-29, pedido explícito do usuário). */}
      {editavel ? <BadgeSecao>Editável</BadgeSecao> : <BadgeSecao tom="neutro" icone={Lock}>Ficha confirmada · somente leitura</BadgeSecao>}
      {/* Vazio + editável: os dois botões do corpo já fazem o papel do "Editar". Ficha
          confirmada: o painel abre só pra consulta. */}
      {!(vazioTotal && editavel) && (
        <BotaoFicha variante="discreto" icone={editavel ? Pencil : Eye} onClick={() => onAbrir('topo')} style={{ color: T.azulTexto }}>
          {editavel ? 'Ver e editar' : 'Ver ações operacionais'}
        </BotaoFicha>
      )}
    </span>
  );

  if (vazioTotal) {
    return (
      <SecaoCartao titulo="Ações operacionais" direita={direita}>
        <div className="flex items-center" style={{ gap: '0.875rem', padding: '0.875rem 0', flexWrap: 'wrap' }}>
          <span className="flex items-center justify-center shrink-0" style={{ width: '2.25rem', height: '2.25rem', borderRadius: T.radius, backgroundColor: T.surface, color: T.lo }}>
            <ListChecks size="1.125rem" strokeWidth={2} />
          </span>
          <div className="flex flex-col" style={{ gap: '0.125rem', flex: '1 1 18rem', minWidth: 0, fontFamily: T.font }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: T.hi }}>Nenhuma ação operacional definida</span>
            <span style={{ fontSize: '0.75rem', color: T.md, lineHeight: 1.45 }}>
              {editavel
                ? 'Defina quais vagões saem do trem e quantos entram em cada bloco. Se não houver alterações, basta confirmar a ficha.'
                : 'Esta ficha foi confirmada sem retiradas nem inclusões.'}
            </span>
          </div>
          {editavel && (
            <span className="flex items-center shrink-0" style={{ gap: '0.5rem' }}>
              <BotaoFicha variante="perigo" icone={Minus} onClick={() => onAbrir('retirar')}>Retirar vagões</BotaoFicha>
              <BotaoFicha variante="incluir" icone={Plus} onClick={() => onAbrir('incluir')}>Incluir vagões</BotaoFicha>
            </span>
          )}
        </div>
      </SecaoCartao>
    );
  }

  const linhaGrade: React.CSSProperties = { display: 'grid', gridTemplateColumns: '10.625rem 1fr', gap: '0.875rem', padding: '0.6875rem 0', alignItems: 'start' };
  const retiradasPorBloco = contarRetiradasPorBloco(dados, retiradas);

  return (
    <SecaoCartao titulo="Ações operacionais" direita={direita}>
      <div className="flex flex-col">
        <div style={linhaGrade}>
          <RotuloLinha icone={Minus} cor={T.danger} titulo="Vagões a retirar" contagem={retiradas.length} />
          <div style={{ minWidth: 0 }}>
            {retiradas.length === 0 ? (
              <span className="inline-flex items-center flex-wrap" style={{ gap: '0.5rem' }}>
                <span style={textoColunaVazia}>Nenhum vagão a retirar</span>
                {editavel && <button type="button" onClick={() => onAbrir('retirar')} style={{ ...linkAcao, color: T.danger }}>+ Retirar vagões</button>}
              </span>
            ) : (
              <span className="inline-flex flex-wrap items-baseline" style={{ gap: '1.375rem', fontSize: '0.75rem', fontFamily: T.font }}>
                {retiradasPorBloco.map((g) => (
                  <span key={g.bloco}>
                    <span style={{ color: T.md }}>{g.bloco} </span>
                    <span style={{ fontWeight: 500, color: T.hi }}>{g.total}</span>
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>

        <div style={{ height: 1, backgroundColor: T.divisor }} />

        <div style={linhaGrade}>
          <RotuloLinha icone={Plus} cor={T.incluir} titulo="Inclusões" contagem={totalIncluir} />
          <div style={{ minWidth: 0 }}>
            {inclusoes.length === 0 ? (
              <span className="inline-flex items-center flex-wrap" style={{ gap: '0.5rem' }}>
                <span style={textoColunaVazia}>Nenhuma inclusão</span>
                {editavel && <button type="button" onClick={() => onAbrir('incluir')} style={{ ...linkAcao, color: T.incluir }}>+ Incluir vagões</button>}
              </span>
            ) : (
              <span className="inline-flex flex-wrap items-baseline" style={{ gap: '1.375rem', fontSize: '0.75rem', fontFamily: T.font }}>
                {inclusoes.map((i) => <InclusaoResumo key={i.id} i={i} />)}
                <span style={{ color: T.sutil }}>vagões definidos pelo plano</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </SecaoCartao>
  );
}

// ---------------------------------------------------------------------------------------
// Composição (só leitura)
// ---------------------------------------------------------------------------------------

/** Restrição como texto simples — rótulo + observação numa linha, cortada com "…"; o texto
 *  inteiro (e o código como veio da fonte) fica no tooltip. */
function TextoRestricao({ r }: { r: RestricaoVeiculo }) {
  const texto = [traduzirRestricao(r.codigo).rotulo, r.observacao].filter(Boolean).join(' — ');
  return (
    <HeaderTooltip label={`${texto} (código na fonte: ${r.codigo})`}>
      <span style={{ display: 'block', minWidth: '8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.md, cursor: 'help' }}>{texto}</span>
    </HeaderTooltip>
  );
}

/** "Bloco A" na fonte → "A" na coluna (só o identificador, sem o prefixo). */
const idBloco = (bloco: string) => bloco.replace(/^Bloco\s+/i, '');

// Pos. e Veículo ficam fixas (sticky) durante a rolagem horizontal — larguras fixas pra calcular
// o deslocamento (`left`) de cada uma; quando a composição está selecionável, a coluna de checkbox
// (mais à esquerda) também gruda, e Pos./Veículo deslocam pra depois dela.
// 8px de padding esquerdo + 14px da caixa, sem padding direito — o espaçamento até a próxima
// coluna já vem do padding esquerdo DELA (senão sobrava um vão entre o checkbox e o conteúdo).
const LARGURA_CHECKBOX = '1.375rem';
const LARGURA_POS = '4.5rem';
const LARGURA_VEICULO = '11rem';

type ColunaTrem = 'pos' | 'bloco' | 'veiculo' | 'tipo' | 'rota' | 'mercadoria' | 'peso' | 'restricao' | 'acao';

/** Célula "Ação operacional": só indica — clicar abre o painel de Ações operacionais, onde isso de
 *  fato se decide. */
function BadgeAcao({ estado, dica, onAbrir }: { estado: 'retirar' | 'incluir'; dica?: string; onAbrir: () => void }) {
  // A linha de "retirar" já tem o fundo vermelho claro por trás — sem fundo próprio aqui, senão
  // os dois vermelhos translúcidos empilhados escurecem o badge em relação ao resto da linha.
  const pill = estado === 'retirar'
    ? <Pill tom="perigo" icone={Minus} semFundo>Retirar</Pill>
    : <Pill tom="incluir" icone={Plus}>Incluir</Pill>;
  return (
    <HeaderTooltip label={dica ? `${dica} · ver em Ações operacionais` : 'Ver em Ações operacionais'}>
      <button type="button" onClick={onAbrir} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>{pill}</button>
    </HeaderTooltip>
  );
}

function CaixaSelecao({ marcada }: { marcada: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center"
      style={{
        width: '0.875rem',
        height: '0.875rem',
        borderRadius: '0.1875rem',
        border: `1.5px solid ${marcada ? T.danger : T.lo}`,
        backgroundColor: marcada ? T.danger : 'transparent',
        color: '#fff',
        verticalAlign: 'middle',
      }}
    >
      {marcada && <Check size="0.625rem" strokeWidth={3.5} />}
    </span>
  );
}

// ---------------------------------------------------------------------------------------
// Aba
// ---------------------------------------------------------------------------------------

export function TremAba({ dados, acoes, onAcoesChange, busca, filtro, editavel, acoesPainelAberto, onAbrirAcoes, onDestacarRetirada }: {
  dados: DadosFichaLeitura;
  acoes: AcoesOperacionais;
  onAcoesChange: (a: AcoesOperacionais) => void;
  busca: string;
  filtro: FiltroTrem;
  /** Falso com a ficha confirmada: o painel de ações abre só pra consulta. */
  editavel: boolean;
  acoesPainelAberto: boolean;
  onAbrirAcoes: (modo: ModoAberturaAcoes) => void;
  /** Retirada recém-criada pela tabela — o painel rola até ela e a destaca. */
  onDestacarRetirada: (id: string) => void;
}) {
  const { cabecalho: c, totais, composicao } = dados;
  /** Com o painel aberto, clicar num vagão da composição alterna a retirada dele. */
  const selecionavel = acoesPainelAberto && editavel;

  const retiradaDe = (v: VeiculoComposicao) => (v.tipo === 'vagao' ? acoes.retiradas.find((r) => mesmoVeiculo(r.numero, v.numero)) : undefined);

  const alternarRetirada = (v: VeiculoComposicao) => {
    const atual = retiradaDe(v);
    if (atual) {
      onAcoesChange({ ...acoes, retiradas: acoes.retiradas.filter((r) => r.id !== atual.id) });
      return;
    }
    const nova = { id: novoIdAcao('ret'), numero: v.numero, serie: v.serie, posicao: v.posicao, motivo: '', observacao: restricaoDoVeiculo(dados, v)?.observacao ?? '' };
    onAcoesChange({ ...acoes, retiradas: [...acoes.retiradas, nova] });
    onDestacarRetirada(nova.id);
  };

  // Ordenação dentro de cada bloco — o agrupamento por bloco nunca se desfaz.
  const { ordem, th } = useOrdenacao<ColunaTrem>();
  const valorColuna = (v: VeiculoComposicao, coluna: ColunaTrem) => {
    switch (coluna) {
      case 'pos': return v.posicao;
      case 'bloco': return idBloco(v.bloco);
      case 'veiculo': return rotuloVeiculo(v);
      case 'tipo': return v.tipo === 'locomotiva' ? 'Locomotiva' : 'Vagão';
      case 'rota': return [v.origem, v.destino].filter(Boolean).join(' ') || undefined;
      case 'mercadoria': return v.mercadoria;
      case 'peso': return v.pesoBrutoT;
      case 'restricao': {
        const r = restricaoDoVeiculo(dados, v);
        return r ? traduzirRestricao(r.codigo).rotulo : undefined;
      }
      case 'acao': return retiradaDe(v) ? 'Retirar' : undefined;
    }
  };

  const q = busca.trim().toLowerCase();
  const visivel = (v: VeiculoComposicao) =>
    (filtro.tipos.length === 0 || filtro.tipos.includes(v.tipo)) &&
    (filtro.series.length === 0 || filtro.series.includes(v.serie)) &&
    (filtro.blocos.length === 0 || filtro.blocos.includes(v.bloco)) &&
    (filtro.restricoes.length === 0 || filtro.restricoes.includes(rotuloRestricaoDoVeiculo(dados, v) ?? SEM_RESTRICAO)) &&
    (!filtro.aRetirar || !!retiradaDe(v)) &&
    (!q || rotuloVeiculo(v).toLowerCase().includes(q) || v.numero.toLowerCase().includes(q));
  // Inclusões NÃO entram aqui: antes do plano uma inclusão é só um pedido (bloco + quantidade),
  // não um vagão real — o motor é que escolhe quais vagões do pátio entram.
  // Lista contínua (sem faixa de grupo): ordem padrão por Pos. crescente — a ordem real do trem.
  const visiveis = [...composicao.filter(visivel)].sort((a, b) => a.posicao - b.posicao);
  // Com filtro/busca ativos, o header mostra "N de total" — sem eles, só o total.
  const totalComposicao = `${visiveis.length}${visiveis.length !== composicao.length ? ` de ${composicao.length}` : ''} veículos`;

  const ESQ_POS = selecionavel ? LARGURA_CHECKBOX : '0rem';
  const ESQ_VEICULO = selecionavel ? `calc(${LARGURA_CHECKBOX} + ${LARGURA_POS})` : LARGURA_POS;

  const Cabecalho = () => (
    <tr>
      {selecionavel && <th aria-label="Selecionar para retirada" style={{ width: LARGURA_CHECKBOX, padding: 0, position: 'sticky', left: '0rem', zIndex: 2, backgroundColor: T.panel }} />}
      <Th largura={LARGURA_POS} colunas={['Seq']} sticky={{ left: ESQ_POS }} {...th('pos')}>Pos.</Th>
      <Th largura="4rem" {...th('bloco')}>Bloco</Th>
      <Th largura={LARGURA_VEICULO} colunas={['Sér', 'Veiculo']} sticky={{ left: ESQ_VEICULO }} {...th('veiculo')}>Veículo</Th>
      <Th largura="7rem" {...th('tipo')}>Tipo</Th>
      <Th colunas={['Ori', 'Des']} {...th('rota')}>Origem → Destino</Th>
      <Th colunas={['Mercadoria']} {...th('mercadoria')}>Mercadoria</Th>
      <Th colunas={['Tb']} {...th('peso')}>Peso bruto</Th>
      <Th largura="10rem" colunas={['Restricao']} {...th('restricao')}>Restrição</Th>
      <Th largura="9rem" {...th('acao')}>Ação operacional</Th>
    </tr>
  );

  return (
    <>
      <GradeCards>
        <CardResumo label="Rota">
          {c.origem || '—'}
          <ArrowRight size="0.8125rem" color={T.lo} />
          {c.destino || '—'}
        </CardResumo>
        <CardResumo label="Locomotivas" dica={dicaColuna('Locos Tracionando')}>{fmtNum(totais.locomotivas)}</CardResumo>
        <CardResumo label="Vagões" dica={dicaColuna('Vag+Ca+Equip+Lr')}>{fmtNum(totais.vagoes)}</CardResumo>
        <CardResumo label="Peso bruto" dica={dicaColuna('Ton Brutas')}>{fmtNum(totais.toneladasBrutas, 1)} t</CardResumo>
        <CardResumo label="Peso útil" dica={dicaColuna('Ton Uteis')}>{fmtNum(totais.toneladasUteis, 1)} t</CardResumo>
        <CardResumo label="Comprimento" dica={dicaColuna('Comprimento')}>{fmtNum(totais.comprimentoM)} m</CardResumo>
      </GradeCards>

      <AcoesOperacionaisResumo dados={dados} acoes={acoes} editavel={editavel} onAbrir={onAbrirAcoes} />

      <SecaoCartao titulo={`Composição · ${totalComposicao}`}>
        {visiveis.length === 0 ? (
          <EstadoVazio icone={Train} titulo="Nenhum veículo para os filtros atuais" />
        ) : (
          <>
          {selecionavel && (
            <div className="flex items-center no-print" style={{ gap: '0.375rem', padding: '0.625rem 0 0', fontSize: '0.75rem', color: T.md, fontFamily: T.font }}>
              <MousePointerClick size="0.875rem" color={T.lo} />
              Clique em um vagão para adicioná-lo às retiradas.
            </div>
          )}
          <TabelaSangrada minWidth={selecionavel ? '55rem' : '53rem'}>
            <thead><Cabecalho /></thead>
            <tbody>
              {ordenar(visiveis, ordem, valorColuna).map((v) => {
                const r = restricaoDoVeiculo(dados, v);
                const ret = retiradaDe(v);
                const clicavel = selecionavel && v.tipo === 'vagao';
                // Fundo sólido por CSS (`.vli-linha-composicao`, `theme.css`) — nada de
                // background-color inline aqui: é exatamente o inline por célula (pras sticky
                // cobrirem o conteúdo por trás na rolagem) que dobrava o vermelho translúcido só
                // nessas colunas. Uma classe, um valor, em toda célula da linha.
                const classesLinha = ['vli-linha-composicao', ret && 'vli-linha-retirar', clicavel && 'vli-linha-selecionavel'].filter(Boolean).join(' ');
                const interacao = clicavel
                  ? {
                      role: 'checkbox' as const,
                      'aria-checked': !!ret,
                      'aria-label': `${ret ? 'Desfazer retirada do' : 'Retirar o'} vagão ${rotuloVeiculo(v)}`,
                      tabIndex: 0,
                      onClick: () => alternarRetirada(v),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternarRetirada(v); }
                      },
                    }
                  : {};
                return (
                  <tr key={`${v.posicao}-${v.numero}`} {...interacao} className={classesLinha} style={{ cursor: clicavel ? 'pointer' : undefined }}>
                    {selecionavel && (
                      <td style={tdStyle({ width: LARGURA_CHECKBOX, padding: '0.4375rem 0 0.4375rem 0.5rem', position: 'sticky', left: '0rem', zIndex: 1 })}>
                        {clicavel && <CaixaSelecao marcada={!!ret} />}
                      </td>
                    )}
                    <td style={tdStyle({ color: T.lo, fontVariantNumeric: 'tabular-nums', position: 'sticky', left: ESQ_POS, zIndex: 1 })}>{v.posicao}</td>
                    <td style={tdStyle({ fontSize: '0.8125rem' })}>{idBloco(v.bloco)}</td>
                    <td style={tdStyle({ position: 'sticky', left: ESQ_VEICULO, zIndex: 1 })}><IdVeiculo serie={v.serie} numero={v.numero} chip={ret ? 'retirar' : v.tipo} chipSemFundo={!!ret} /></td>
                    <td style={tdStyle()}>{v.tipo === 'locomotiva' ? 'Locomotiva' : 'Vagão'}</td>
                    <td style={tdStyle()}><Rota origem={v.origem} destino={v.destino} /></td>
                    <td style={tdStyle({ color: v.mercadoria ? T.md : T.lo })}>{v.mercadoria || '—'}</td>
                    <td style={tdStyle({ fontVariantNumeric: 'tabular-nums' })}>{fmtT(v.pesoBrutoT)}</td>
                    <td style={tdStyle({ maxWidth: '10rem' })}>
                      {r ? <TextoRestricao r={r} /> : <span style={{ color: T.lo }}>—</span>}
                    </td>
                    <td style={tdStyle()}>
                      {ret ? (
                        selecionavel
                          ? <Pill tom="perigo" icone={Minus} semFundo>Retirar</Pill>
                          : <BadgeAcao estado="retirar" dica={ret.motivo ? `Motivo: ${ret.motivo}` : undefined} onAbrir={() => onAbrirAcoes('topo')} />
                      ) : <span style={{ color: T.lo }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TabelaSangrada>
          </>
        )}
      </SecaoCartao>

    </>
  );
}
