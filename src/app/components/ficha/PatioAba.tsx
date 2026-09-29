// Aba Pátio da Ficha Operacional — quais vagões e locomotivas estão no pátio, onde estão e em que
// situação. Uma página só, com rolagem: indicadores, depois "Vagões no pátio" e "Locomotivas no
// pátio", cada uma numa lista contínua (sem faixas de agrupamento por linha — a linha é uma coluna,
// já que a posição sozinha se repete entre linhas).
//
// Os dados vêm da fonte e o operador pode corrigi-los: o "Editar" do header de cada seção põe a
// tabela daquela seção em modo de edição. Cada correção vira um override sobre a fonte
// (`correcoesLeitura.ts`); a lista é recalculada a partir dele, então mudar a Linha reordena o
// veículo na hora (a ordenação padrão é por Linha e, dentro dela, por Posição).
import { useMemo, useState } from 'react';
import { Lock, Pencil, RotateCcw, TrainFront, Warehouse } from 'lucide-react';
import { HeaderTooltip, SecaoCartao } from '../PageHeader';
import { rotuloVeiculo, seriesDaComposicao } from '../../data/fichaModelo';
import { separarLinha, traduzirAtividade } from '../../data/glossarioFicha';
import { corrigirCampo, restaurarCampo, type CorrecoesLeitura, type OverrideCampo, type Valor } from '../../data/correcoesLeitura';
import {
  agruparPorLinha,
  CAMPOS_NUMERICOS,
  contarPatio,
  FAIXAS_PERMANENCIA,
  faixaPermanencia,
  type CampoEditavelPatio,
  type TipoVeiculoPatio,
  type VeiculoNoPatio,
} from '../../data/patioFicha';
import { USUARIO_ATUAL } from '../../data/sessao';
import {
  alternarNaLista,
  BadgeSecao,
  BotaoFicha,
  CardResumo,
  EstadoVazio,
  fmtHora,
  fmtNum,
  fmtT,
  GradeCards,
  GrupoFiltro,
  IdVeiculo,
  OpcaoFiltro,
  ordenar,
  Pill,
  PopoverFicha,
  Rota,
  T,
  TabelaSangrada,
  tdStyle,
  Th,
  useOrdenacao,
} from './fichaUi';

/** Nome curto da linha (ex.: "LN3" a partir de "LN3-PAEHT") — mesma regra do agrupamento antigo,
 *  usada agora na célula da coluna Linha. */
const nomeLinha = (linha?: string) => (linha ? separarLinha(linha).linha : undefined);

// Linha, Posição e Veículo ficam fixas (sticky) durante a rolagem horizontal — larguras fixas pra
// calcular o deslocamento (`left`) de cada uma.
const LARGURA_LINHA = '4.5rem';
const LARGURA_SEQ = '6rem';
const LARGURA_VEICULO = '11rem';
const ESQ_LINHA = '0rem';
const ESQ_SEQ = LARGURA_LINHA;
const ESQ_VEICULO = `calc(${LARGURA_LINHA} + ${LARGURA_SEQ})`;

// ---------------------------------------------------------------------------------------
// Filtro
// ---------------------------------------------------------------------------------------

/** Sentinela da opção "Outra situação" no grupo Situação (vagão sem atividade informada). */
const SEM_ATIVIDADE = '__sem_atividade__';

export interface FiltroPatio {
  linhas: string[];
  tipos: TipoVeiculoPatio[];
  series: string[];
  /** Código da atividade (ex.: "AG TRACAO") ou `SEM_ATIVIDADE`. */
  atividades: string[];
  /** Id de `FAIXAS_PERMANENCIA`. */
  permanencias: string[];
  editados: boolean;
}

export const FILTRO_PATIO_PADRAO: FiltroPatio = { linhas: [], tipos: [], series: [], atividades: [], permanencias: [], editados: false };

export function filtroPatioAtivo(f: FiltroPatio): boolean {
  return f.linhas.length > 0 || f.tipos.length > 0 || f.series.length > 0 || f.atividades.length > 0 || f.permanencias.length > 0 || f.editados;
}

/** Quantos GRUPOS têm alguma seleção (não quantas opções) — número que aparece no título do
 *  painel, ex.: "Filtros — Pátio (2)". */
export function contarFiltrosAtivosPatio(f: FiltroPatio): number {
  return [f.linhas.length > 0, f.tipos.length > 0, f.series.length > 0, f.atividades.length > 0, f.permanencias.length > 0, f.editados].filter(Boolean).length;
}

const temCorrecao = (v: VeiculoNoPatio) => Object.keys(v.overrides).length > 0;

/** Cada atividade distinta presente, mais "Outra situação" pra vagão sem atividade informada
 *  (antes esses vagões simplesmente não apareciam em nenhuma opção do grupo). */
function atividadesComContagem(veiculos: VeiculoNoPatio[]): [string, number][] {
  const m = new Map<string, number>();
  let semAtividade = 0;
  veiculos.forEach((v) => { if (v.atividade) m.set(v.atividade, (m.get(v.atividade) ?? 0) + 1); else semAtividade += 1; });
  const lista = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  if (semAtividade > 0) lista.push([SEM_ATIVIDADE, semAtividade]);
  return lista;
}

export function FiltroPainelPatio({ veiculos, filtro, onFiltroChange }: {
  veiculos: VeiculoNoPatio[];
  filtro: FiltroPatio;
  onFiltroChange: (f: FiltroPatio) => void;
}) {
  const linhas = agruparPorLinha(veiculos);
  const series = seriesDaComposicao(veiculos);
  const atividades = atividadesComContagem(veiculos);
  const faixasComContagem = FAIXAS_PERMANENCIA.map((f) => ({ ...f, contagem: veiculos.filter((v) => faixaPermanencia(v) === f.id).length }));

  return (
    <>
      {linhas.length > 1 && (
        <GrupoFiltro titulo="Linha">
          {linhas.map((l) => (
            <OpcaoFiltro key={l.codigo} ativo={filtro.linhas.includes(l.codigo)} onClick={() => onFiltroChange({ ...filtro, linhas: alternarNaLista(filtro.linhas, l.codigo) })} contagem={l.veiculos.length}>
              {l.nome}
            </OpcaoFiltro>
          ))}
        </GrupoFiltro>
      )}
      <GrupoFiltro titulo="Tipo de veículo">
        <OpcaoFiltro ativo={filtro.tipos.includes('vagao')} onClick={() => onFiltroChange({ ...filtro, tipos: alternarNaLista(filtro.tipos, 'vagao') })} contagem={veiculos.filter((v) => v.tipo === 'vagao').length}>
          Vagão
        </OpcaoFiltro>
        <OpcaoFiltro ativo={filtro.tipos.includes('locomotiva')} onClick={() => onFiltroChange({ ...filtro, tipos: alternarNaLista(filtro.tipos, 'locomotiva') })} contagem={veiculos.filter((v) => v.tipo === 'locomotiva').length}>
          Locomotiva
        </OpcaoFiltro>
      </GrupoFiltro>
      {series.length > 1 && (
        <GrupoFiltro titulo="Série">
          {series.map((s) => (
            <OpcaoFiltro key={s} ativo={filtro.series.includes(s)} onClick={() => onFiltroChange({ ...filtro, series: alternarNaLista(filtro.series, s) })} contagem={veiculos.filter((v) => v.serie === s).length}>
              {s}
            </OpcaoFiltro>
          ))}
        </GrupoFiltro>
      )}
      {atividades.length > 1 && (
        <GrupoFiltro titulo="Situação">
          {atividades.map(([a, n]) => (
            <OpcaoFiltro key={a} ativo={filtro.atividades.includes(a)} onClick={() => onFiltroChange({ ...filtro, atividades: alternarNaLista(filtro.atividades, a) })} contagem={n}>
              {a === SEM_ATIVIDADE ? 'Outra situação' : traduzirAtividade(a).rotulo}
            </OpcaoFiltro>
          ))}
        </GrupoFiltro>
      )}
      {faixasComContagem.filter((f) => f.contagem > 0).length > 1 && (
        <GrupoFiltro titulo="Permanência">
          {faixasComContagem.map((f) => (
            <OpcaoFiltro key={f.id} ativo={filtro.permanencias.includes(f.id)} onClick={() => onFiltroChange({ ...filtro, permanencias: alternarNaLista(filtro.permanencias, f.id) })} contagem={f.contagem}>
              {f.rotulo}
            </OpcaoFiltro>
          ))}
        </GrupoFiltro>
      )}
      <GrupoFiltro titulo="Correção">
        <OpcaoFiltro ativo={filtro.editados} onClick={() => onFiltroChange({ ...filtro, editados: !filtro.editados })} contagem={veiculos.filter(temCorrecao).length}>
          Editado manualmente
        </OpcaoFiltro>
      </GrupoFiltro>
    </>
  );
}

// ---------------------------------------------------------------------------------------
// Célula com correção
// ---------------------------------------------------------------------------------------

/** Todo campo que a tabela EXIBE, editável ou não (`fmtCampo` formata pra leitura nos dois casos —
 *  só `CampoEditavelPatio`, mais estreito, entra em override/edição). */
type CampoExibivelPatio = CampoEditavelPatio | 'mercadoria' | 'pedido' | 'pesoUtilT' | 'pesoBrutoT' | 'combustivelL' | 'posicaoTrem';

function fmtCampo(campo: CampoExibivelPatio, valor: Valor): string {
  if (valor === undefined || valor === '') return '—';
  switch (campo) {
    case 'seq': return `${valor}º`;
    case 'pesoUtilT':
    case 'pesoBrutoT': return fmtT(Number(valor));
    case 'combustivelL': return `${fmtNum(Number(valor))} L`;
    case 'linha': return separarLinha(String(valor)).linha;
    default: return String(valor);
  }
}

/** Ponto azul de célula corrigida; clicar abre o detalhe com "Restaurar valor original". */
function MarcadorEdicao({ campo, override, onRestaurar }: { campo: CampoEditavelPatio; override: OverrideCampo; onRestaurar?: () => void }) {
  const [aberto, setAberto] = useState(false);
  const original = fmtCampo(campo, override.valorFonte);
  const texto = `Editado por ${override.autor} às ${fmtHora(override.em)} · valor original: ${original}`;
  const ponto: React.CSSProperties = { width: '0.4375rem', height: '0.4375rem', borderRadius: '50%', backgroundColor: T.azul, flexShrink: 0 };
  if (!onRestaurar) {
    return (
      <HeaderTooltip label={texto}>
        <span aria-label={texto} style={{ ...ponto, cursor: 'help' }} />
      </HeaderTooltip>
    );
  }
  return (
    <PopoverFicha
      aberto={aberto}
      onAbertoChange={setAberto}
      dica={texto}
      alinhar="start"
      largura="15rem"
      gatilho={<button type="button" aria-label={texto} style={{ ...ponto, padding: 0, border: 'none', cursor: 'pointer' }} />}
    >
      <div className="flex flex-col" style={{ gap: '0.5rem', fontSize: '0.6875rem', color: T.md }}>
        <span>Editado por <strong style={{ color: T.hi }}>{override.autor}</strong> às {fmtHora(override.em)}</span>
        <span>Valor original: <strong style={{ color: T.hi }}>{original}</strong></span>
        <BotaoFicha
          icone={RotateCcw}
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            onRestaurar();
            setAberto(false);
          }}
        >
          Restaurar valor original
        </BotaoFicha>
      </div>
    </PopoverFicha>
  );
}

const inputCelula: React.CSSProperties = {
  height: '1.5rem',
  padding: '0 0.375rem',
  borderRadius: '0.1875rem',
  border: `1px solid ${T.azulBorda}`,
  backgroundColor: T.panel,
  color: T.hi,
  fontSize: '0.6875rem',
  fontFamily: T.font,
  outline: 'none',
};

const LARGURA_INPUT: Partial<Record<CampoEditavelPatio, string>> = { linha: '7rem', seq: '3.5rem' };

const ID_LISTA_LINHAS = 'ficha-patio-linhas';

function EditorCampo({ campo, valor, onChange }: {
  campo: CampoEditavelPatio;
  valor: string;
  onChange: (v: string) => void;
}) {
  const estilo = { ...inputCelula, width: LARGURA_INPUT[campo] ?? '8.5rem' };
  // Linha: sugestões vêm do <datalist> único renderizado pela aba (`ID_LISTA_LINHAS`).
  if (campo === 'linha') return <input list={ID_LISTA_LINHAS} value={valor} onChange={(e) => onChange(e.target.value)} style={estilo} />;
  return <input type="number" value={valor} onChange={(e) => onChange(e.target.value)} style={estilo} />;
}

type Rascunho = Record<string, Partial<Record<CampoEditavelPatio, string>>>;

const paraTexto = (v: Valor) => (v === undefined ? '' : String(v));

function paraValor(campo: CampoEditavelPatio, texto: string): Valor {
  const t = texto.trim();
  if (t === '') return undefined;
  if (!CAMPOS_NUMERICOS.has(campo)) return t;
  const n = Number(t.replace(',', '.'));
  return Number.isNaN(n) ? undefined : n;
}

// ---------------------------------------------------------------------------------------
// Aba
// ---------------------------------------------------------------------------------------

type ColunaPatio = 'linha' | 'seq' | 'veiculo' | 'situacao' | 'permanencia' | 'rota' | 'empresas' | 'mercadoria' | 'pedido' | 'pesoUtil' | 'pesoBruto' | 'combustivel' | 'posicaoTrem';

/** Valor de cada coluna ordenável — o que a célula mostra (situação pelo rótulo, permanência como
 *  número pra "10" vir depois de "9"). */
function valorColuna(v: VeiculoNoPatio, coluna: ColunaPatio): string | number | undefined {
  switch (coluna) {
    case 'linha': return nomeLinha(v.linha);
    case 'seq': return v.seq;
    case 'veiculo': return rotuloVeiculo(v);
    case 'situacao': return v.atividade ? traduzirAtividade(v.atividade).rotulo : undefined;
    case 'permanencia': {
      const n = Number(String(v.permanencia ?? '').replace(',', '.'));
      return v.permanencia && !Number.isNaN(n) ? n : v.permanencia;
    }
    case 'rota': return [v.origem, v.destino].filter(Boolean).join(' ') || undefined;
    case 'empresas': return [v.remetente, v.destinatario].filter(Boolean).join(' ') || undefined;
    case 'mercadoria': return v.mercadoria;
    case 'pedido': return v.pedido;
    case 'pesoUtil': return v.pesoUtilT;
    case 'pesoBruto': return v.pesoBrutoT;
    case 'combustivel': return v.combustivelL;
    case 'posicaoTrem': return v.posicaoTrem;
  }
}

const NOME_SECAO: Record<TipoVeiculoPatio, { titulo: string; um: string; varios: string }> = {
  vagao: { titulo: 'Vagões no pátio', um: 'vagão', varios: 'vagões' },
  locomotiva: { titulo: 'Locomotivas no pátio', um: 'locomotiva', varios: 'locomotivas' },
};

export function PatioAba({ veiculos, correcoes, onCorrecoesChange, busca, filtro, editavel }: {
  /** Pátio inteiro, com as correções já aplicadas (`montarPatio`). */
  veiculos: VeiculoNoPatio[];
  correcoes: CorrecoesLeitura;
  onCorrecoesChange: (c: CorrecoesLeitura) => void;
  busca: string;
  filtro: FiltroPatio;
  /** Falso com a ficha confirmada. */
  editavel: boolean;
}) {
  // Uma seção em edição por vez (vagões OU locomotivas).
  const [edicao, setEdicao] = useState<{ tipo: TipoVeiculoPatio; rascunho: Rascunho } | null>(null);
  // Ordenação por seção, dentro de cada linha do pátio (o agrupamento por linha não se desfaz).
  const ordemPorTipo = { vagao: useOrdenacao<ColunaPatio>(), locomotiva: useOrdenacao<ColunaPatio>() };

  const contagem = useMemo(() => contarPatio(veiculos), [veiculos]);
  const codigosLinha = useMemo(() => agruparPorLinha(veiculos).map((l) => l.codigo).filter(Boolean), [veiculos]);

  const q = busca.trim().toLowerCase();
  // Tipo de veículo já é resolvido por `mostra()` (esconde a seção inteira) — não precisa entrar
  // aqui de novo.
  const visivel = (v: VeiculoNoPatio) =>
    (filtro.linhas.length === 0 || filtro.linhas.includes(v.linha ?? '')) &&
    (filtro.series.length === 0 || filtro.series.includes(v.serie)) &&
    (filtro.atividades.length === 0 || filtro.atividades.includes(v.atividade || SEM_ATIVIDADE)) &&
    (filtro.permanencias.length === 0 || filtro.permanencias.includes(faixaPermanencia(v) ?? '')) &&
    (!filtro.editados || temCorrecao(v)) &&
    (!q || rotuloVeiculo(v).toLowerCase().includes(q) || v.numero.toLowerCase().includes(q) || (v.pedido ?? '').toLowerCase().includes(q));

  const salvar = (tipo: TipoVeiculoPatio) => {
    if (!edicao) return;
    let c = correcoes;
    const em = new Date().toISOString();
    for (const v of veiculos) {
      const campos = v.tipo === tipo ? edicao.rascunho[v.chave] : undefined;
      if (!campos) continue;
      for (const [campo, texto] of Object.entries(campos) as [CampoEditavelPatio, string][]) {
        const novo = paraValor(campo, texto);
        if (paraTexto(novo) === paraTexto(v[campo])) continue;
        c = corrigirCampo(c, v.chave, campo, novo, v.fonte[campo], USUARIO_ATUAL, em);
      }
    }
    if (c !== correcoes) onCorrecoesChange(c);
    setEdicao(null);
  };

  const valorRascunho = (v: VeiculoNoPatio, campo: CampoEditavelPatio) => edicao?.rascunho[v.chave]?.[campo] ?? paraTexto(v[campo]);
  const setRascunho = (v: VeiculoNoPatio, campo: CampoEditavelPatio, texto: string) =>
    setEdicao((e) => (e ? { ...e, rascunho: { ...e.rascunho, [v.chave]: { ...e.rascunho[v.chave], [campo]: texto } } } : e));

  /** Em modo de edição, o que não é editável continua texto, com o tooltip "Campo somente leitura". */
  const somenteLeitura = (emEdicao: boolean, conteudo: React.ReactNode) =>
    emEdicao ? (
      <HeaderTooltip label="Campo somente leitura">
        <span className="inline-flex items-center" style={{ cursor: 'default' }}>{conteudo}</span>
      </HeaderTooltip>
    ) : (
      conteudo
    );

  /** Célula de Linha ou Posição: valor + marcador de correção; em edição, o campo. São os ÚNICOS
   *  campos editáveis do Pátio. Vagão que só existe na Situação Vagões não tem localização pra
   *  corrigir — fica somente leitura mesmo em edição. */
  const celula = (v: VeiculoNoPatio, campo: CampoEditavelPatio, emEdicao: boolean) => {
    if (emEdicao && v.temLocalizacao) return <EditorCampo campo={campo} valor={valorRascunho(v, campo)} onChange={(t) => setRascunho(v, campo, t)} />;
    const ov = v.overrides[campo];
    return somenteLeitura(
      emEdicao,
      <span className="inline-flex items-center" style={{ gap: '0.375rem' }}>
        <span style={{ color: v[campo] === undefined ? T.lo : undefined }}>{fmtCampo(campo, v[campo])}</span>
        {ov && <MarcadorEdicao campo={campo} override={ov} onRestaurar={editavel ? () => onCorrecoesChange(restaurarCampo(correcoes, v.chave, campo)) : undefined} />}
      </span>,
    );
  };

  /** Célula somente leitura (mercadoria, pedido, pesos, combustível, posição no trem) — nunca vira
   *  campo, mesmo em edição; sem marcador de correção, porque não há override pra esses campos. */
  const leitura = (campo: CampoExibivelPatio, valor: Valor, emEdicao: boolean, conteudo?: React.ReactNode) =>
    somenteLeitura(emEdicao, conteudo ?? <span style={{ color: valor === undefined ? T.lo : undefined }}>{fmtCampo(campo, valor)}</span>);

  /** Origem → Destino — somente leitura (`Rota` já mostra "—" quando os dois faltam). */
  const celulaRota = (v: VeiculoNoPatio, emEdicao: boolean) => somenteLeitura(emEdicao, <Rota origem={v.origem} destino={v.destino} />);

  const linhaVagao = (v: VeiculoNoPatio, emEdicao: boolean) => {
    const at = v.atividade ? traduzirAtividade(v.atividade) : null;
    return (
      <tr key={v.chave}>
        <td style={tdStyle({ position: 'sticky', left: ESQ_LINHA, zIndex: 1, backgroundColor: T.panel })}>{celula(v, 'linha', emEdicao)}</td>
        <td style={tdStyle({ position: 'sticky', left: ESQ_SEQ, zIndex: 1, backgroundColor: T.panel, fontVariantNumeric: 'tabular-nums' })}>{celula(v, 'seq', emEdicao)}</td>
        <td style={tdStyle({ position: 'sticky', left: ESQ_VEICULO, zIndex: 1, backgroundColor: T.panel })}><IdVeiculo serie={v.serie} numero={v.numero} /></td>
        {/* Situação e Remetente → Destinatário vêm da Situação Vagões; Permanência é calculada —
            nenhum dos três é editável. */}
        <td style={tdStyle()}>
          {somenteLeitura(emEdicao, at ? <Pill tom={at.tom} dica={emEdicao ? undefined : `Na fonte: "${v.atividade}"`}>{at.rotulo}</Pill> : <span style={{ color: T.lo }}>—</span>)}
        </td>
        <td style={tdStyle({ color: v.permanencia ? T.md : T.lo })}>{somenteLeitura(emEdicao, v.permanencia ?? '—')}</td>
        <td style={tdStyle()}>{celulaRota(v, emEdicao)}</td>
        <td style={tdStyle()}>
          {somenteLeitura(emEdicao, v.remetente || v.destinatario ? <Rota origem={v.remetente} destino={v.destinatario} /> : <span style={{ color: T.lo }}>—</span>)}
        </td>
        <td style={tdStyle()}>{leitura('mercadoria', v.mercadoria, emEdicao)}</td>
        <td style={tdStyle({ fontVariantNumeric: 'tabular-nums' })}>{leitura('pedido', v.pedido, emEdicao)}</td>
        <td style={tdStyle({ fontVariantNumeric: 'tabular-nums' })}>{leitura('pesoUtilT', v.pesoUtilT, emEdicao)}</td>
        <td style={tdStyle({ fontVariantNumeric: 'tabular-nums' })}>{leitura('pesoBrutoT', v.pesoBrutoT, emEdicao)}</td>
      </tr>
    );
  };

  const linhaLocomotiva = (v: VeiculoNoPatio, emEdicao: boolean) => (
    <tr key={v.chave}>
      <td style={tdStyle({ position: 'sticky', left: ESQ_LINHA, zIndex: 1, backgroundColor: T.panel })}>{celula(v, 'linha', emEdicao)}</td>
      <td style={tdStyle({ position: 'sticky', left: ESQ_SEQ, zIndex: 1, backgroundColor: T.panel, fontVariantNumeric: 'tabular-nums' })}>{celula(v, 'seq', emEdicao)}</td>
      <td style={tdStyle({ position: 'sticky', left: ESQ_VEICULO, zIndex: 1, backgroundColor: T.panel })}><IdVeiculo serie={v.serie} numero={v.numero} /></td>
      <td style={tdStyle({ fontVariantNumeric: 'tabular-nums' })}>{leitura('combustivelL', v.combustivelL, emEdicao)}</td>
      <td style={tdStyle({ fontVariantNumeric: 'tabular-nums' })}>{leitura('pesoBrutoT', v.pesoBrutoT, emEdicao)}</td>
      <td style={tdStyle()}>{leitura('posicaoTrem', v.posicaoTrem, emEdicao, v.posicaoTrem ? <Pill tom="neutro">{v.posicaoTrem}</Pill> : undefined)}</td>
    </tr>
  );

  const cabecalho = (tipo: TipoVeiculoPatio, emEdicao: boolean) => {
    const { th } = ordemPorTipo[tipo];
    return (
      <tr>
        <Th largura={LARGURA_LINHA} colunas={['Linha']} sticky={{ left: ESQ_LINHA }} {...th('linha')}>Linha</Th>
        <Th largura={LARGURA_SEQ} colunas={['Seq']} sticky={{ left: ESQ_SEQ }} {...th('seq')}>Posição</Th>
        <Th largura={LARGURA_VEICULO} colunas={['Sér', 'Veículo']} sticky={{ left: ESQ_VEICULO }} {...th('veiculo')}>Veículo</Th>
        {tipo === 'vagao' ? (
          <>
            <Th largura="11rem" colunas={['Atividade']} {...th('situacao')}>Situação</Th>
            <Th colunas={['Perm']} {...th('permanencia')}>Permanência</Th>
            <Th colunas={['Org', 'Dst']} {...th('rota')}>Origem → Destino</Th>
            <Th colunas={['Remetente', 'Destinat.']} {...th('empresas')}>Remetente → Destinatário</Th>
            <Th colunas={['Merc']} {...th('mercadoria')}>Mercadoria</Th>
            <Th colunas={['Pedido']} {...th('pedido')}>Pedido</Th>
            <Th colunas={['TU']} {...th('pesoUtil')}>Peso útil</Th>
            <Th colunas={['TB']} {...th('pesoBruto')}>Peso bruto</Th>
          </>
        ) : (
          <>
            <Th colunas={['Comb. (L)']} {...th('combustivel')}>Combustível</Th>
            <Th colunas={['TB']} {...th('pesoBruto')}>Peso bruto</Th>
            <Th colunas={['Posição']} {...th('posicaoTrem')}>Posição no trem</Th>
          </>
        )}
      </tr>
    );
  };

  // Filtro por tipo esconde a seção do outro tipo inteira.
  const mostra = (tipo: TipoVeiculoPatio) => filtro.tipos.length === 0 || filtro.tipos.includes(tipo);

  const secao = (tipo: TipoVeiculoPatio) => {
    const nomes = NOME_SECAO[tipo];
    const emEdicao = edicao?.tipo === tipo;
    const outraEmEdicao = !!edicao && !emEdicao;
    const doTipo = veiculos.filter((v) => v.tipo === tipo);
    // Lista contínua (sem faixa de grupo): ordem padrão por Linha e, dentro dela, por Posição —
    // sem linha informada vai por último. Uma coluna ordenada pelo cabeçalho substitui isso.
    const visiveis = [...doTipo.filter(visivel)].sort((a, b) => {
      if (!!a.linha !== !!b.linha) return a.linha ? -1 : 1;
      return (nomeLinha(a.linha) ?? '').localeCompare(nomeLinha(b.linha) ?? '', 'pt-BR', { numeric: true, sensitivity: 'base' })
        || (a.seq ?? Number.MAX_SAFE_INTEGER) - (b.seq ?? Number.MAX_SAFE_INTEGER);
    });
    // Com filtro/busca ativos, o header mostra "N de total" — sem eles, só o total.
    const totalSecao = `${visiveis.length}${visiveis.length !== doTipo.length ? ` de ${doTipo.length}` : ''}`;
    // Ficha confirmada: o bloqueio precisa ficar evidente, não sumir — botão "Editar" continua
    // visível, só desabilitado, com cadeado e o caminho pra desbloquear no tooltip (2026-09-29,
    // pedido explícito do usuário: antes o botão simplesmente desaparecia e parecia que a edição
    // tinha sido removida).
    const acoes = emEdicao ? (
      <>
        <BotaoFicha onClick={() => setEdicao(null)}>Cancelar</BotaoFicha>
        <BotaoFicha variante="primario" onClick={() => salvar(tipo)}>Salvar</BotaoFicha>
      </>
    ) : !editavel ? (
      <HeaderTooltip label="Ficha confirmada. Clique em Revisar para editar.">
        <BotaoFicha variante="discreto" icone={Lock} disabled style={{ color: T.lo }}>
          Editar
        </BotaoFicha>
      </HeaderTooltip>
    ) : (
      <HeaderTooltip label={outraEmEdicao ? 'Salve ou cancele a edição da outra seção primeiro' : `Corrigir dados de ${nomes.varios}`}>
        <BotaoFicha variante="discreto" icone={Pencil} disabled={outraEmEdicao || doTipo.length === 0} onClick={() => setEdicao({ tipo, rascunho: {} })} style={{ color: T.azulTexto }}>
          Editar
        </BotaoFicha>
      </HeaderTooltip>
    );
    return (
      <SecaoCartao
        key={tipo}
        titulo={`${nomes.titulo} · ${totalSecao}`}
        direita={
          <span className="flex items-center" style={{ gap: '0.5rem' }}>
            {editavel ? <BadgeSecao>Editável</BadgeSecao> : <BadgeSecao tom="neutro" icone={Lock}>Ficha confirmada · somente leitura</BadgeSecao>}
            <span className="flex items-center" style={{ gap: '0.375rem' }}>{acoes}</span>
          </span>
        }
      >
        {doTipo.length === 0 ? (
          <EstadoVazio icone={tipo === 'vagao' ? Warehouse : TrainFront} titulo={`Sem ${nomes.varios} no pátio`} descricao="Ainda não chegou a posição desses veículos para esta ficha." />
        ) : visiveis.length === 0 ? (
          <EstadoVazio icone={tipo === 'vagao' ? Warehouse : TrainFront} titulo="Nenhum veículo para os filtros atuais" />
        ) : (
          <TabelaSangrada minWidth={tipo === 'vagao' ? '78rem' : '46rem'}>
            <thead>{cabecalho(tipo, emEdicao)}</thead>
            <tbody>
              {ordenar(visiveis, ordemPorTipo[tipo].ordem, valorColuna).map((v) => (tipo === 'vagao' ? linhaVagao(v, emEdicao) : linhaLocomotiva(v, emEdicao)))}
            </tbody>
          </TabelaSangrada>
        )}
      </SecaoCartao>
    );
  };


  return (
    <>
      {/* Indicadores do pátio inteiro (não mudam com filtro/busca) — mesmos cards do resumo do trem. */}
      <GradeCards>
        <CardResumo label="Prontos p/ tração" cor={T.azulTexto}>{contagem.prontos}</CardResumo>
        <CardResumo label="Avariados" cor={T.danger}>{contagem.avariados}</CardResumo>
        <CardResumo label="Locomotivas disponíveis" cor={T.laranjaTexto}>{contagem.locomotivas}</CardResumo>
        <CardResumo label="Linhas ocupadas">{contagem.linhasOcupadas}</CardResumo>
      </GradeCards>

      {mostra('locomotiva') && secao('locomotiva')}
      {mostra('vagao') && secao('vagao')}

      {edicao && <datalist id={ID_LISTA_LINHAS}>{codigosLinha.map((l) => <option key={l} value={l} />)}</datalist>}
    </>
  );
}
