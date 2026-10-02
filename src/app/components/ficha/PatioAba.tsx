// Aba Pátio da Ficha Operacional — quais vagões e locomotivas estão no pátio, onde estão e em que
// situação. Uma página só, com rolagem: indicadores, depois "Vagões no pátio" e "Locomotivas no
// pátio", cada uma numa lista contínua (sem faixas de agrupamento por linha — a linha é uma coluna,
// já que a posição sozinha se repete entre linhas).
//
// Os dados vêm da fonte e o operador pode corrigi-los: o "Editar" do header de cada seção põe a
// tabela daquela seção em modo de edição. Cada correção vira um override sobre a fonte
// (`correcoesLeitura.ts`); a lista é recalculada a partir dele, então mudar a Linha reordena o
// veículo na hora (a ordenação padrão é por Linha e, dentro dela, por Posição).
//
// No modo de edição, a seção também ajusta QUAIS veículos estão no pátio: "Adicionar vagão/
// locomotiva" inclui um veículo que a fonte não trouxe (registro manual, excluível) e
// "Desconsiderar no plano" tira um veículo da fonte das contagens e do plano sem apagá-lo (a linha
// continua na tabela, esmaecida). Essas ações gravam na hora — não dependem do "Salvar", que vale
// só pros campos Linha/Posição em rascunho.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Ban, Check, Lock, Pencil, Plus, RotateCcw, Trash2, TrainFront, Undo2, UserPlus, Warehouse, X, type LucideIcon } from 'lucide-react';
import { HeaderTooltip, SecaoCartao } from '../PageHeader';
import { rotuloVeiculo, seriesDaComposicao } from '../../data/fichaModelo';
import { separarLinha, SITUACOES_VAGAO, traduzirAtividade } from '../../data/glossarioFicha';
import {
  adicionarVeiculoManual,
  considerarNovamente,
  corrigirCampo,
  desconsiderarVeiculo,
  editarVeiculoManual,
  excluirVeiculoManual,
  restaurarCampo,
  reverterTipo,
  type CorrecoesLeitura,
  type DadosVeiculoManual,
  type OverrideCampo,
  type Valor,
} from '../../data/correcoesLeitura';
import {
  agruparPorLinha,
  LINHAS_PATIO,
  considerados,
  contarPatio,
  ehDesconsiderado,
  ehManual,
  encontrarNoPatio,
  ordemDaLinha,
  posicaoMaxima,
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
  DropdownCelula,
  Rota,
  type OpcaoDropdown,
  SOMBRA_FIXA_DIREITA,
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
// calcular o deslocamento (`left`) de cada uma. As larguras são exatas (o `Th` fixo usa
// min = max = largura): a tabela nunca as comprime, então o deslocamento de cada coluna é sempre a
// soma real das anteriores — sem vão nem sobreposição entre Posição e Veículo. Em edição a Linha
// alarga pra caber o campo (`LARGURA_INPUT.linha`).
const LARGURA_SEQ = '6rem';
// Cabe número + marca de origem ("Manual"/"Desconsiderado") numa linha só.
const LARGURA_VEICULO = '13.5rem';
const ESQ_LINHA = '0rem';
function fixas(emEdicao: boolean) {
  const linha = emEdicao ? '10rem' : '4.5rem';
  return { linha, seq: linha, veiculo: `calc(${linha} + ${LARGURA_SEQ})` };
}
/** Coluna de ações da linha — só no modo de edição. */
const LARGURA_ACOES = '4.5rem';
/** Fixa à direita: as ações ficam à vista sem rolar a tabela (vagões têm 11 colunas). */
const COLUNA_ACOES: React.CSSProperties = { width: LARGURA_ACOES, textAlign: 'center', position: 'sticky', right: 0, zIndex: 1, boxShadow: SOMBRA_FIXA_DIREITA };

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
  /** Grupo "Correção" — como os demais grupos, várias opções somam (OU). */
  correcoes: TipoCorrecaoFiltro[];
}

type TipoCorrecaoFiltro = 'editado' | 'adicionado' | 'desconsiderado';

export const FILTRO_PATIO_PADRAO: FiltroPatio = { linhas: [], tipos: [], series: [], atividades: [], permanencias: [], correcoes: [] };

export function filtroPatioAtivo(f: FiltroPatio): boolean {
  return f.linhas.length > 0 || f.tipos.length > 0 || f.series.length > 0 || f.atividades.length > 0 || f.permanencias.length > 0 || f.correcoes.length > 0;
}

/** Quantos GRUPOS têm alguma seleção (não quantas opções) — número que aparece no título do
 *  painel, ex.: "Filtros — Pátio (2)". */
export function contarFiltrosAtivosPatio(f: FiltroPatio): number {
  return [f.linhas.length > 0, f.tipos.length > 0, f.series.length > 0, f.atividades.length > 0, f.permanencias.length > 0, f.correcoes.length > 0].filter(Boolean).length;
}

const temCorrecao = (v: VeiculoNoPatio) => Object.keys(v.overrides).length > 0;

const OPCOES_CORRECAO: { id: TipoCorrecaoFiltro; rotulo: string; testar: (v: VeiculoNoPatio) => boolean }[] = [
  { id: 'editado', rotulo: 'Editado manualmente', testar: temCorrecao },
  { id: 'adicionado', rotulo: 'Adicionado manualmente', testar: ehManual },
  { id: 'desconsiderado', rotulo: 'Desconsiderado', testar: ehDesconsiderado },
];

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
        {OPCOES_CORRECAO.map((o) => (
          <OpcaoFiltro key={o.id} ativo={filtro.correcoes.includes(o.id)} onClick={() => onFiltroChange({ ...filtro, correcoes: alternarNaLista(filtro.correcoes, o.id) })} contagem={veiculos.filter(o.testar).length}>
            {o.rotulo}
          </OpcaoFiltro>
        ))}
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

/** Campo de texto de célula — mesmo desenho do `DropdownCelula` (`fichaUi.tsx`): borda neutra, que
 *  só fica azul no hover/foco (e vermelha com erro), via `.vli-campo-celula` em `theme.css` — por
 *  isso a borda não vai inline aqui. */
const inputCelula: React.CSSProperties = {
  height: '1.5rem',
  padding: '0 0.4375rem',
  borderRadius: '0.25rem',
  backgroundColor: T.panel,
  color: T.hi,
  fontSize: '0.6875rem',
  fontWeight: 500,
  fontFamily: T.font,
  outline: 'none',
};

const LARGURA_INPUT: Record<CampoEditavelPatio, string> = { linha: '8.5rem', seq: '4rem' };

/**
 * Linha e Posição nunca são campo aberto (2026-10-02, pedido explícito do usuário): Linha é uma
 * das linhas do pátio (`LINHAS_PATIO`) e Posição só vai de 1 até a primeira depois da última
 * ocupada (`posicaoMaxima`) — não existe número livre no meio nem depois do fim; pôr numa posição
 * ocupada empurra os de trás.
 */
function SeletorLinha({ valor, onChange, rotulo, invalido }: { valor: string; onChange: (v: string) => void; rotulo: string; invalido?: boolean }) {
  // Linha que veio da fonte com código fora da lista continua visível como opção, pra não sumir.
  const opcoes = [...(valor && !LINHAS_PATIO.includes(valor) ? [valor] : []), ...LINHAS_PATIO].map((l) => ({ valor: l, rotulo: nomeLinha(l) ?? l }));
  return <DropdownCelula rotulo={rotulo} invalido={invalido} valor={valor} onChange={onChange} opcoes={opcoes} placeholder="Linha" largura={LARGURA_INPUT.linha} />;
}

function SeletorPosicao({ valor, maxima, onChange, rotulo, invalido, desabilitado }: {
  valor: string;
  maxima: number;
  onChange: (v: string) => void;
  rotulo: string;
  invalido?: boolean;
  desabilitado?: boolean;
}) {
  const opcoes = Array.from({ length: maxima }, (_, i) => ({ valor: String(i + 1), rotulo: `${i + 1}º` }));
  return <DropdownCelula rotulo={rotulo} invalido={invalido} desabilitado={desabilitado} valor={desabilitado ? '' : valor} onChange={onChange} opcoes={opcoes} placeholder="—" largura={LARGURA_INPUT.seq} numerico />;
}


const paraTexto = (v: Valor) => (v === undefined ? '' : String(v));

/** Ordem padrão da tabela: linhas na ordem do pátio (`LINHAS_PATIO`) e, dentro delas, a ordem
 *  física (`ordem`, que mantém o desconsiderado no lugar dele); sem linha vai por último. Uma coluna
 *  ordenada pelo cabeçalho substitui isso. */
function ordenarPadrao(veiculos: VeiculoNoPatio[]): VeiculoNoPatio[] {
  return [...veiculos].sort((a, b) =>
    ordemDaLinha(a.linha) - ordemDaLinha(b.linha)
    || (a.linha ?? '').localeCompare(b.linha ?? '')
    || (a.ordem ?? a.seq ?? Number.MAX_SAFE_INTEGER) - (b.ordem ?? b.seq ?? Number.MAX_SAFE_INTEGER));
}

// ---------------------------------------------------------------------------------------
// Inclusão manual — linha de inclusão no fim da tabela
// ---------------------------------------------------------------------------------------

type CampoInclusao =
  | 'serie' | 'numero' | 'linha' | 'seq' | 'atividade' | 'mercadoria' | 'pedido' | 'pesoUtilT' | 'pesoBrutoT'
  | 'origem' | 'destino' | 'remetente' | 'destinatario' | 'combustivelL' | 'posicaoTrem';

type RascunhoInclusao = Partial<Record<CampoInclusao, string>>;

const OBRIGATORIOS_INCLUSAO: Record<TipoVeiculoPatio, CampoInclusao[]> = {
  vagao: ['serie', 'numero', 'linha', 'seq', 'atividade'],
  locomotiva: ['serie', 'numero', 'linha', 'seq'],
};

const DECIMAIS_INCLUSAO: CampoInclusao[] = ['pesoUtilT', 'pesoBrutoT', 'combustivelL'];

const ROTULO_INCLUSAO: Record<CampoInclusao, string> = {
  serie: 'Série', numero: 'Número', linha: 'Linha', seq: 'Posição', atividade: 'Situação', mercadoria: 'Mercadoria', pedido: 'Pedido',
  pesoUtilT: 'Peso útil', pesoBrutoT: 'Peso bruto', origem: 'Origem', destino: 'Destino', remetente: 'Remetente', destinatario: 'Destinatário',
  combustivelL: 'Combustível', posicaoTrem: 'Posição no trem',
};

interface ValidacaoInclusao {
  erros: Partial<Record<CampoInclusao, string>>;
  /** Veículo com a mesma série + número já no pátio (da fonte ou manual, desconsiderado ou não). */
  existente?: VeiculoNoPatio;
  /** Última posição possível na linha escolhida (ocupadas + 1). */
  maxima: number;
  /** Preenchido só quando a inclusão pode ser gravada. */
  dados?: DadosVeiculoManual;
}

function validarInclusao(tipo: TipoVeiculoPatio, r: RascunhoInclusao, veiculos: VeiculoNoPatio[]): ValidacaoInclusao {
  const t = (c: CampoInclusao) => (r[c] ?? '').trim();
  const decimal = (c: CampoInclusao) => (t(c) ? Number(t(c).replace(',', '.')) : undefined);
  const erros: ValidacaoInclusao['erros'] = {};
  for (const c of OBRIGATORIOS_INCLUSAO[tipo]) if (!t(c)) erros[c] = `Informe ${ROTULO_INCLUSAO[c].toLowerCase()}.`;
  if (t('linha') && !LINHAS_PATIO.includes(t('linha'))) erros.linha = 'Escolha uma das linhas do pátio.';
  const maxima = t('linha') ? posicaoMaxima(veiculos, tipo, t('linha')) : 1;
  if (t('seq') && !(/^\d+$/.test(t('seq')) && Number(t('seq')) >= 1 && Number(t('seq')) <= maxima)) erros.seq = `Posição deve estar entre 1 e ${maxima}.`;
  for (const c of DECIMAIS_INCLUSAO) {
    const n = decimal(c);
    if (n !== undefined && (Number.isNaN(n) || n < 0)) erros[c] = `${ROTULO_INCLUSAO[c]} deve ser um número.`;
  }

  const serie = t('serie').toUpperCase();
  const numero = t('numero');
  const existente = serie && numero ? encontrarNoPatio(veiculos, { serie, numero }) : undefined;
  const seq = Number(t('seq'));

  if (Object.keys(erros).length > 0 || existente) return { erros, existente, maxima };
  const opcional = (c: CampoInclusao) => t(c) || undefined;
  const dados: DadosVeiculoManual = { serie, numero, linha: t('linha'), seq };
  if (tipo === 'vagao') {
    Object.assign(dados, {
      atividade: t('atividade'), mercadoria: opcional('mercadoria'), pedido: opcional('pedido'), pesoUtilT: decimal('pesoUtilT'), pesoBrutoT: decimal('pesoBrutoT'),
      origem: opcional('origem'), destino: opcional('destino'), remetente: opcional('remetente'), destinatario: opcional('destinatario'),
    });
  } else {
    Object.assign(dados, { combustivelL: decimal('combustivelL'), pesoBrutoT: decimal('pesoBrutoT'), posicaoTrem: opcional('posicaoTrem') });
  }
  return { erros, maxima, dados };
}

// ---------------------------------------------------------------------------------------
// Ações da linha (modo de edição) — botões de ícone, cada um com aria-label e tooltip
// ---------------------------------------------------------------------------------------

const OPACIDADE_DESCONSIDERADO = 0.45;

// Ações com borda e cor própria — a coluna fica fixa à direita, sobre o conteúdo que rola, e
// precisa ser lida de relance (antes, ícones "discretos" sem borda ficavam apagados demais).
type TomAcaoLinha = 'neutro' | 'azul' | 'perigo';

const CORES_ACAO_LINHA: Record<TomAcaoLinha, { cor: string; borda: string; fundo: string }> = {
  neutro: { cor: T.hi, borda: T.border, fundo: T.surface },
  azul: { cor: T.azulTexto, borda: T.azulBorda, fundo: T.azulBg },
  perigo: { cor: T.danger, borda: 'color-mix(in srgb, var(--vli-danger-text) 40%, transparent)', fundo: T.dangerBg },
};

const estiloBotaoIcone = (tom: TomAcaoLinha): React.CSSProperties => ({
  width: '1.75rem',
  height: '1.75rem',
  padding: 0,
  justifyContent: 'center',
  color: CORES_ACAO_LINHA[tom].cor,
  border: `1px solid ${CORES_ACAO_LINHA[tom].borda}`,
  backgroundColor: CORES_ACAO_LINHA[tom].fundo,
});

const IconeAcao = ({ icone: Icone }: { icone: LucideIcon }) => <Icone size="0.875rem" strokeWidth={2.25} />;

function BotaoIconeLinha({ icone, rotulo, onClick, tom = 'neutro' }: { icone: LucideIcon; rotulo: string; onClick: () => void; tom?: TomAcaoLinha }) {
  return (
    <HeaderTooltip label={rotulo}>
      <BotaoFicha aria-label={rotulo} onClick={onClick} style={estiloBotaoIcone(tom)}>
        <IconeAcao icone={icone} />
      </BotaoFicha>
    </HeaderTooltip>
  );
}

/** "Reverter" do header da seção — desfaz todas as alterações daquele tipo de veículo. Pede
 *  confirmação porque é em massa e exclui de vez os veículos adicionados; o resumo diz exatamente
 *  o que vai voltar. */
function AcaoReverter({ nomes, resumo, onConfirmar }: { nomes: { varios: string }; resumo: string[]; onConfirmar: () => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <PopoverFicha
      aberto={aberto}
      onAbertoChange={setAberto}
      dica={`Desfazer todas as alterações de ${nomes.varios}`}
      largura="18rem"
      gatilho={
        <BotaoFicha variante="discreto" icone={RotateCcw} aria-label={`Reverter alterações de ${nomes.varios}`} style={{ color: T.md }}>
          Reverter
        </BotaoFicha>
      }
    >
      <div className="flex flex-col" style={{ gap: '0.625rem', fontSize: '0.6875rem', color: T.md }}>
        <strong style={{ color: T.hi, fontSize: '0.75rem' }}>Reverter alterações de {nomes.varios}?</strong>
        <span style={{ lineHeight: 1.5 }}>Tudo volta a ser como veio da fonte:</span>
        <ul style={{ margin: 0, paddingLeft: '1rem', lineHeight: 1.6 }}>
          {resumo.map((r) => <li key={r}>{r}</li>)}
        </ul>
        <span className="flex justify-end" style={{ gap: '0.375rem' }}>
          <BotaoFicha onClick={() => setAberto(false)}>Cancelar</BotaoFicha>
          <BotaoFicha variante="perigo" icone={RotateCcw} onClick={() => { onConfirmar(); setAberto(false); }}>Reverter</BotaoFicha>
        </span>
      </div>
    </PopoverFicha>
  );
}

/** "Excluir" — só veículo adicionado manualmente; pede confirmação (exclusão definitiva). */
function AcaoExcluir({ rotuloVeiculo: rotulo, onConfirmar }: { rotuloVeiculo: string; onConfirmar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const dica = `Excluir ${rotulo}`;
  return (
    <PopoverFicha
      aberto={aberto}
      onAbertoChange={setAberto}
      dica={dica}
      largura="16rem"
      gatilho={<BotaoFicha aria-label={dica} style={estiloBotaoIcone('perigo')}><IconeAcao icone={Trash2} /></BotaoFicha>}
    >
      <div className="flex flex-col" style={{ gap: '0.625rem', fontSize: '0.6875rem', color: T.md }}>
        <strong style={{ color: T.hi, fontSize: '0.75rem' }}>Excluir {rotulo}?</strong>
        <span style={{ lineHeight: 1.5 }}>O veículo foi adicionado manualmente e será removido do pátio. Esta ação não pode ser desfeita.</span>
        <span className="flex justify-end" style={{ gap: '0.375rem' }}>
          <BotaoFicha onClick={() => setAberto(false)}>Cancelar</BotaoFicha>
          <BotaoFicha variante="perigo" icone={Trash2} onClick={() => { onConfirmar(); setAberto(false); }}>Excluir</BotaoFicha>
        </span>
      </div>
    </PopoverFicha>
  );
}

const dicaManual = (v: VeiculoNoPatio) => (v.manual ? `Adicionado manualmente por ${v.manual.autor} às ${fmtHora(v.manual.em)}` : '');
const dicaDesconsiderado = (v: VeiculoNoPatio) =>
  v.desconsideracao
    ? `Desconsiderado por ${v.desconsideracao.autor} às ${fmtHora(v.desconsideracao.em)}${v.desconsideracao.motivo ? ` · motivo: ${v.desconsideracao.motivo}` : ''}`
    : '';

/**
 * Marca de ORIGEM do registro, ao lado do número do veículo, na mesma linha. Linguagem visual
 * propositalmente diferente da Pill de Situação (pílula preenchida e colorida): etiqueta
 * retangular, uppercase compacta, sem preenchimento — tracejada pro "Manual", sólida cinza pro
 * "Desconsiderado". Texto completo no tooltip e no aria-label.
 */
function MarcaRegistro({ tipo, dica }: { tipo: 'manual' | 'desconsiderado'; dica: string }) {
  const manual = tipo === 'manual';
  const Icone = manual ? UserPlus : Ban;
  return (
    <HeaderTooltip label={dica}>
      <span
        aria-label={dica}
        className="inline-flex items-center"
        style={{
          gap: '0.1875rem',
          height: '1.0625rem',
          padding: '0 0.3125rem',
          borderRadius: '0.1875rem',
          border: `1px ${manual ? 'dashed' : 'solid'} ${manual ? T.md : T.border}`,
          color: manual ? T.hi : T.md,
          fontSize: '0.5625rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontFamily: T.font,
          whiteSpace: 'nowrap',
          cursor: 'help',
          flexShrink: 0,
        }}
      >
        <Icone size="0.625rem" strokeWidth={2.5} />
        {manual ? 'Manual' : 'Desconsiderado'}
      </span>
    </HeaderTooltip>
  );
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

const NOME_SECAO: Record<TipoVeiculoPatio, { titulo: string; um: string; varios: string; g: 'o' | 'a' }> = {
  vagao: { titulo: 'Vagões no pátio', um: 'vagão', varios: 'vagões', g: 'o' },
  locomotiva: { titulo: 'Locomotivas no pátio', um: 'locomotiva', varios: 'locomotivas', g: 'a' },
};

export function PatioAba({ veiculos: veiculosSalvos, montar, correcoes, onCorrecoesChange, busca, filtro, editavel }: {
  /** Pátio inteiro, com as correções já aplicadas (`montarPatio`). */
  veiculos: VeiculoNoPatio[];
  /** Monta o pátio a partir de outras correções (`montarPatio` com os dados da ficha) — é como a
   *  edição mostra o rascunho já reposicionado, antes do Salvar. */
  montar: (c: CorrecoesLeitura) => VeiculoNoPatio[];
  correcoes: CorrecoesLeitura;
  onCorrecoesChange: (c: CorrecoesLeitura) => void;
  busca: string;
  filtro: FiltroPatio;
  /** Falso com a ficha confirmada. */
  editavel: boolean;
}) {
  // Uma seção em edição por vez (vagões OU locomotivas). O rascunho são as PRÓPRIAS correções com
  // as movimentações aplicadas: cada troca de Linha/Posição já reposiciona a linha inteira na
  // tabela (2026-10-02, pedido explícito do usuário — "na edição mesmo precisa reposicionar, não
  // somente ao salvar"). Salvar grava o rascunho; Cancelar descarta as movimentações.
  const [edicao, setEdicao] = useState<{ tipo: TipoVeiculoPatio; correcoes: CorrecoesLeitura } | null>(null);
  const veiculos = useMemo(() => (edicao ? montar(edicao.correcoes) : veiculosSalvos), [edicao, montar, veiculosSalvos]);
  // Veículo que acabou de ser movido — a linha dele pisca e é rolada pra vista (ela muda de lugar).
  const [movido, setMovido] = useState<{ chave: string; n: number } | null>(null);
  const ultimoEm = useRef(0);
  // Ordenação por seção, dentro de cada linha do pátio (o agrupamento por linha não se desfaz).
  const ordemPorTipo = { vagao: useOrdenacao<ColunaPatio>(), locomotiva: useOrdenacao<ColunaPatio>() };
  // Linha de inclusão aberta (só na seção em edição).
  const [inclusao, setInclusao] = useState<{ tipo: TipoVeiculoPatio; rascunho: RascunhoInclusao; tentou: boolean } | null>(null);

  // Ficha confirmada no meio da edição: sai do modo de edição (nenhuma ação fica disponível).
  useEffect(() => {
    if (!editavel) {
      setEdicao(null);
      setInclusao(null);
    }
  }, [editavel]);

  const sairDaEdicao = () => {
    setEdicao(null);
    setInclusao(null);
  };

  // Desconsiderados não entram nos indicadores (nem nos totais das seções, mais abaixo).
  const contagem = useMemo(() => contarPatio(considerados(veiculos)), [veiculos]);

  const q = busca.trim().toLowerCase();
  // Tipo de veículo já é resolvido por `mostra()` (esconde a seção inteira) — não precisa entrar
  // aqui de novo.
  const visivel = (v: VeiculoNoPatio) =>
    (filtro.linhas.length === 0 || filtro.linhas.includes(v.linha ?? '')) &&
    (filtro.series.length === 0 || filtro.series.includes(v.serie)) &&
    (filtro.atividades.length === 0 || filtro.atividades.includes(v.atividade || SEM_ATIVIDADE)) &&
    (filtro.permanencias.length === 0 || filtro.permanencias.includes(faixaPermanencia(v) ?? '')) &&
    (filtro.correcoes.length === 0 || OPCOES_CORRECAO.some((o) => filtro.correcoes.includes(o.id) && o.testar(v))) &&
    (!q || rotuloVeiculo(v).toLowerCase().includes(q) || v.numero.toLowerCase().includes(q) || (v.pedido ?? '').toLowerCase().includes(q));

  const salvar = () => {
    if (!edicao) return;
    if (edicao.correcoes !== correcoes) onCorrecoesChange(edicao.correcoes);
    sairDaEdicao();
  };

  /** Ações que gravam na hora (incluir, excluir, desconsiderar, considerar, restaurar): valem pras
   *  correções salvas E pro rascunho aberto, pra o Cancelar só descartar movimentações. As
   *  operações são puras e por chave, então aplicar nas duas dá o mesmo resultado. */
  const aplicarAgora = (f: (c: CorrecoesLeitura) => CorrecoesLeitura) => {
    onCorrecoesChange(f(correcoes));
    setEdicao((e) => (e ? { ...e, correcoes: f(e.correcoes) } : e));
  };

  /** Horário estritamente crescente: a sequência é refeita na ordem dos eventos, e duas
   *  movimentações no mesmo milissegundo ficariam empatadas. */
  const emAgora = () => {
    ultimoEm.current = Math.max(Date.now(), ultimoEm.current + 1);
    return new Date(ultimoEm.current).toISOString();
  };

  /** Move o veículo no rascunho: sai da posição antiga (os de trás sobem) e entra em `seq` na
   *  `linha` (os de lá em diante descem) — a tabela já mostra o resultado. */
  const mover = (v: VeiculoNoPatio, linha: string, seq: number) => {
    if (!edicao || (linha === v.linha && seq === v.seq)) return;
    const em = emAgora();
    setEdicao((e) => {
      if (!e) return e;
      let c = e.correcoes;
      // Veículo manual não tem valor original: a alteração vai direto no registro.
      if (v.manual) c = editarVeiculoManual(c, v.chave, { linha, seq }, em);
      else {
        c = corrigirCampo(c, v.chave, 'linha', linha, v.fonte.linha, USUARIO_ATUAL, em);
        c = corrigirCampo(c, v.chave, 'seq', seq, v.fonte.seq, USUARIO_ATUAL, em);
      }
      return { ...e, correcoes: c };
    });
    setMovido((m) => ({ chave: v.chave, n: (m?.n ?? 0) + 1 }));
  };

  // Animação de reposicionamento (FLIP): depois de cada render na edição, compara onde cada linha
  // estava com onde ficou e a faz deslizar da posição antiga pra nova — quem foi empurrado desce,
  // quem subiu sobe, o movido atravessa a tabela. Linha nova (inclusão) entra com fade. Usa
  // `offsetTop` (relativo à tabela), então rolar a página entre um render e outro não conta como
  // movimento. Só anima entre dois renders EM edição (entrar/sair dela muda a altura das linhas).
  const posicoesAnteriores = useRef(new Map<string, number>());
  const estavaEmEdicao = useRef(false);
  useLayoutEffect(() => {
    const animar = !!edicao && estavaEmEdicao.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const novas = new Map<string, number>();
    document.querySelectorAll<HTMLTableRowElement>('tr[data-chave]').forEach((tr) => {
      const chave = tr.dataset.chave!;
      novas.set(chave, tr.offsetTop);
      if (!animar) return;
      const antes = posicoesAnteriores.current.get(chave);
      if (antes === undefined) {
        tr.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
        return;
      }
      const dy = antes - tr.offsetTop;
      if (dy !== 0) tr.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 420, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
    });
    posicoesAnteriores.current = novas;
    estavaEmEdicao.current = !!edicao;
  }, [veiculos, edicao]);

  useEffect(() => {
    if (!movido) return;
    document.querySelector(`[data-chave="${CSS.escape(movido.chave)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const t = setTimeout(() => setMovido(null), 1200);
    return () => clearTimeout(t);
  }, [movido]);

  const confirmarInclusao = () => {
    if (!inclusao) return;
    const { dados } = validarInclusao(inclusao.tipo, inclusao.rascunho, veiculos);
    if (!dados) {
      setInclusao({ ...inclusao, tentou: true });
      return;
    }
    // O registro é criado uma vez só (a chave é gerada na criação) e entra igual nas duas.
    const { correcoes: comNovo, chave } = adicionarVeiculoManual(correcoes, inclusao.tipo, dados, USUARIO_ATUAL);
    const registro = comNovo.manuais[chave];
    aplicarAgora((c) => ({ ...c, manuais: { ...c.manuais, [chave]: registro } }));
    setInclusao(null);
    setMovido({ chave, n: 0 });
  };

  const setCampoInclusao = (campo: CampoInclusao, texto: string) =>
    setInclusao((i) => (i ? { ...i, rascunho: { ...i.rascunho, [campo]: texto } } : i));

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
   *  corrigir — fica somente leitura mesmo em edição; veículo desconsiderado também, até ser
   *  considerado novamente. */
  const celula = (v: VeiculoNoPatio, campo: CampoEditavelPatio, emEdicao: boolean) => {
    if (emEdicao && v.temLocalizacao && !v.desconsideracao) {
      const rotulo = `${campo === 'linha' ? 'Linha' : 'Posição'} de ${rotuloVeiculo(v)}`;
      // Trocar a Linha leva o veículo pro fim da linha nova (a primeira posição livre); dali o
      // operador ajusta a Posição, se quiser pôr no meio.
      return campo === 'linha'
        ? <SeletorLinha rotulo={rotulo} valor={v.linha ?? ''} onChange={(l) => mover(v, l, posicaoMaxima(veiculos, v.tipo, l, v.chave))} />
        : <SeletorPosicao rotulo={rotulo} valor={paraTexto(v.seq)} maxima={posicaoMaxima(veiculos, v.tipo, v.linha ?? '', v.chave)} onChange={(p) => v.linha && mover(v, v.linha, Number(p))} />;
    }
    const ov = v.overrides[campo];
    const conteudo = (
      <span className="inline-flex items-center" style={{ gap: '0.375rem' }}>
        <span style={{ color: v[campo] === undefined ? T.lo : undefined }}>{fmtCampo(campo, v[campo])}</span>
        {ov && <MarcadorEdicao campo={campo} override={ov} onRestaurar={editavel && !v.desconsideracao ? () => aplicarAgora((c) => restaurarCampo(c, v.chave, campo)) : undefined} />}
      </span>
    );
    if (emEdicao && v.desconsideracao) {
      return (
        <HeaderTooltip label="Veículo desconsiderado — considere novamente para editar">
          <span className="inline-flex items-center" style={{ cursor: 'default' }}>{conteudo}</span>
        </HeaderTooltip>
      );
    }
    return somenteLeitura(emEdicao, conteudo);
  };

  // Linha desconsiderada fica esmaecida. Colunas fixas (sticky) precisam de fundo opaco, então
  // nelas a opacidade vai no conteúdo; nas demais, na própria célula. Badges e ações nunca
  // esmaecem.
  const esmaecer = (v: VeiculoNoPatio, conteudo: React.ReactNode) =>
    v.desconsideracao ? <span style={{ opacity: OPACIDADE_DESCONSIDERADO }}>{conteudo}</span> : conteudo;
  // Fundo da linha (hover, destaque do manual) vem só do CSS (`.vli-linha-patio`, `theme.css`),
  // em toda célula — nada de background inline, nem nas colunas fixas.
  const classeLinha = (v: VeiculoNoPatio) =>
    ['vli-linha-patio', v.manual && 'vli-linha-manual', movido?.chave === v.chave && 'vli-linha-movida'].filter(Boolean).join(' ');
  const tdFixa = (left: string, extra?: React.CSSProperties) =>
    tdStyle({ position: 'sticky', left, zIndex: 1, ...extra });
  const td = (v: VeiculoNoPatio, extra?: React.CSSProperties) => tdStyle({ ...extra, ...(v.desconsideracao && { opacity: OPACIDADE_DESCONSIDERADO }) });

  const celulaVeiculo = (v: VeiculoNoPatio) => (
    <span className="inline-flex items-center" style={{ gap: '0.375rem', whiteSpace: 'nowrap' }}>
      {esmaecer(v, <IdVeiculo serie={v.serie} numero={v.numero} />)}
      {v.manual && <MarcaRegistro tipo="manual" dica={dicaManual(v)} />}
      {v.desconsideracao && <MarcaRegistro tipo="desconsiderado" dica={dicaDesconsiderado(v)} />}
    </span>
  );

  /** Coluna de ações — só existe no modo de edição (que já não abre com a ficha confirmada). */
  const celulaAcoes = (v: VeiculoNoPatio) => {
    const rotulo = rotuloVeiculo(v);
    let acao: React.ReactNode;
    if (v.manual) {
      acao = <AcaoExcluir rotuloVeiculo={rotulo} onConfirmar={() => aplicarAgora((c) => excluirVeiculoManual(c, v.chave))} />;
    } else if (v.desconsideracao) {
      acao = <BotaoIconeLinha icone={Undo2} rotulo={`Considerar ${rotulo} novamente`} tom="azul" onClick={() => aplicarAgora((c) => considerarNovamente(c, v.chave))} />;
    } else {
      // Direto, sem confirmação: é reversível na hora ("Considerar novamente", mesmo lugar).
      acao = <BotaoIconeLinha icone={Ban} rotulo={`Desconsiderar ${rotulo} no plano`} onClick={() => { const em = emAgora(); aplicarAgora((c) => desconsiderarVeiculo(c, v.chave, v, undefined, USUARIO_ATUAL, em)); }} />;
    }
    return <td style={tdStyle(COLUNA_ACOES)}>{acao}</td>;
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
      <tr key={v.chave} data-chave={v.chave} className={classeLinha(v)}>
        <td style={tdFixa(ESQ_LINHA)}>{esmaecer(v, celula(v, 'linha', emEdicao))}</td>
        <td style={tdFixa(fixas(emEdicao).seq, { fontVariantNumeric: 'tabular-nums' })}>{esmaecer(v, celula(v, 'seq', emEdicao))}</td>
        <td style={tdFixa(fixas(emEdicao).veiculo)}>{celulaVeiculo(v)}</td>
        {/* Situação e Remetente → Destinatário vêm da Situação Vagões; Permanência é calculada —
            nenhum dos três é editável. */}
        <td style={td(v)}>
          {somenteLeitura(emEdicao, at ? <Pill tom={at.tom} dica={emEdicao ? undefined : v.manual ? 'Informado na inclusão manual' : `Na fonte: "${v.atividade}"`}>{at.rotulo}</Pill> : <span style={{ color: T.lo }}>—</span>)}
        </td>
        <td style={td(v, { color: v.permanencia ? T.md : T.lo })}>{somenteLeitura(emEdicao, v.permanencia ?? '—')}</td>
        <td style={td(v)}>{celulaRota(v, emEdicao)}</td>
        <td style={td(v)}>
          {somenteLeitura(emEdicao, v.remetente || v.destinatario ? <Rota origem={v.remetente} destino={v.destinatario} /> : <span style={{ color: T.lo }}>—</span>)}
        </td>
        <td style={td(v)}>{leitura('mercadoria', v.mercadoria, emEdicao)}</td>
        <td style={td(v, { fontVariantNumeric: 'tabular-nums' })}>{leitura('pedido', v.pedido, emEdicao)}</td>
        <td style={td(v, { fontVariantNumeric: 'tabular-nums' })}>{leitura('pesoUtilT', v.pesoUtilT, emEdicao)}</td>
        <td style={td(v, { fontVariantNumeric: 'tabular-nums' })}>{leitura('pesoBrutoT', v.pesoBrutoT, emEdicao)}</td>
        {emEdicao && celulaAcoes(v)}
      </tr>
    );
  };

  const linhaLocomotiva = (v: VeiculoNoPatio, emEdicao: boolean) => (
    <tr key={v.chave} data-chave={v.chave} className={classeLinha(v)}>
      <td style={tdFixa(ESQ_LINHA)}>{esmaecer(v, celula(v, 'linha', emEdicao))}</td>
      <td style={tdFixa(fixas(emEdicao).seq, { fontVariantNumeric: 'tabular-nums' })}>{esmaecer(v, celula(v, 'seq', emEdicao))}</td>
      <td style={tdFixa(fixas(emEdicao).veiculo)}>{celulaVeiculo(v)}</td>
      <td style={td(v, { fontVariantNumeric: 'tabular-nums' })}>{leitura('combustivelL', v.combustivelL, emEdicao)}</td>
      <td style={td(v, { fontVariantNumeric: 'tabular-nums' })}>{leitura('pesoBrutoT', v.pesoBrutoT, emEdicao)}</td>
      <td style={td(v)}>{leitura('posicaoTrem', v.posicaoTrem, emEdicao, v.posicaoTrem ? <Pill tom="neutro">{v.posicaoTrem}</Pill> : undefined)}</td>
      {emEdicao && celulaAcoes(v)}
    </tr>
  );

  // Linha de inclusão: os mesmos campos da tabela, na mesma coluna em que o veículo vai aparecer.
  const linhaInclusao = (tipo: TipoVeiculoPatio, colunas: number) => {
    if (!inclusao || inclusao.tipo !== tipo) return null;
    const { rascunho, tentou } = inclusao;
    const val = validarInclusao(tipo, rascunho, veiculos);
    const erroVisivel = (c: CampoInclusao) => (tentou ? val.erros[c] : c === 'seq' && rascunho.seq ? val.erros.seq : undefined);
    const estilo = (_c: CampoInclusao, largura: string): React.CSSProperties => ({ ...inputCelula, width: largura });
    const obrig = (c: CampoInclusao) => OBRIGATORIOS_INCLUSAO[tipo].includes(c);
    const rotuloCampo = (c: CampoInclusao) => `${ROTULO_INCLUSAO[c]}${obrig(c) ? ' (obrigatório)' : ''}`;
    const campo = (c: CampoInclusao, largura: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
      <input
        className="vli-campo-celula"
        aria-label={rotuloCampo(c)}
        aria-invalid={!!erroVisivel(c)}
        placeholder={`${ROTULO_INCLUSAO[c]}${obrig(c) ? ' *' : ''}`}
        value={rascunho[c] ?? ''}
        onChange={(e) => setCampoInclusao(c, e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') confirmarInclusao(); if (e.key === 'Escape') setInclusao(null); }}
        style={estilo(c, largura)}
        {...extra}
      />
    );
    const seletor = (c: CampoInclusao, largura: string, opcoes: OpcaoDropdown[], vazio: string) => (
      <DropdownCelula rotulo={rotuloCampo(c)} invalido={!!erroVisivel(c)} valor={rascunho[c] ?? ''} onChange={(v) => setCampoInclusao(c, v)} opcoes={opcoes} placeholder={vazio} largura={largura} />
    );
    const par = (a: React.ReactNode, b: React.ReactNode) => (
      <span className="inline-flex items-center" style={{ gap: '0.25rem' }}>{a}<span style={{ color: T.lo }}>→</span>{b}</span>
    );
    const fundo = 'color-mix(in srgb, var(--vli-badge-editavel-bg) 60%, var(--vli-panel-bg))';
    const tdInc = (extra?: React.CSSProperties) => tdStyle({ backgroundColor: fundo, ...extra });
    const tdIncFixa = (left: string) => tdStyle({ position: 'sticky', left, zIndex: 1, backgroundColor: fundo });

    const mensagens: { tom: 'erro' | 'aviso'; texto: React.ReactNode }[] = [];
    if (val.existente?.desconsideracao) {
      const existente = val.existente;
      mensagens.push({
        tom: 'aviso',
        texto: (
          <span className="inline-flex items-center flex-wrap" style={{ gap: '0.5rem' }}>
            {rotuloVeiculo(existente)} já está no pátio, desconsiderado no plano.
            {editavel && (
              <BotaoFicha
                icone={Undo2}
                style={{ color: T.azulTexto }}
                onClick={() => { aplicarAgora((c) => considerarNovamente(c, existente.chave)); setInclusao(null); }}
              >
                Considerar novamente
              </BotaoFicha>
            )}
          </span>
        ),
      });
    } else if (val.existente) {
      const e = val.existente;
      mensagens.push({ tom: 'erro', texto: `${rotuloVeiculo(e)} já está no pátio${e.linha ? ` (linha ${nomeLinha(e.linha)}${e.seq ? `, posição ${e.seq}º` : ''})` : ''}.` });
    }
    (Object.keys(val.erros) as CampoInclusao[]).forEach((c) => { if (erroVisivel(c)) mensagens.push({ tom: 'erro', texto: val.erros[c] }); });
    // Não é erro: entrar numa posição ocupada é o jeito de pôr o veículo no meio da linha.
    const seqEscolhida = Number(rascunho.seq);
    if (rascunho.linha && seqEscolhida >= 1 && seqEscolhida < val.maxima) {
      mensagens.push({ tom: 'aviso', texto: `Os veículos da ${seqEscolhida}ª posição em diante da ${rascunho.linha} descem uma posição.` });
    }

    return (
      <>
        <tr>
          <td style={tdIncFixa(ESQ_LINHA)}>
            <SeletorLinha
              rotulo={rotuloCampo('linha')}
              invalido={!!erroVisivel('linha')}
              valor={rascunho.linha ?? ''}
              // Linha nova → Posição sugerida no fim dela (a primeira livre).
              onChange={(l) => setInclusao((i) => (i ? { ...i, rascunho: { ...i.rascunho, linha: l, seq: String(posicaoMaxima(veiculos, tipo, l)) } } : i))}
            />
          </td>
          <td style={tdIncFixa(fixas(true).seq)}>
            <SeletorPosicao
              rotulo={rotuloCampo('seq')}
              invalido={!!erroVisivel('seq')}
              desabilitado={!rascunho.linha}
              valor={rascunho.seq ?? ''}
              maxima={val.maxima}
              onChange={(p) => setCampoInclusao('seq', p)}
            />
          </td>
          <td style={tdIncFixa(fixas(true).veiculo)}>
            <span className="inline-flex items-center" style={{ gap: '0.25rem' }}>
              {campo('serie', '3.5rem', { style: { ...estilo('serie', '3.5rem'), textTransform: 'uppercase' } })}
              {campo('numero', '6rem')}
            </span>
          </td>
          {tipo === 'vagao' ? (
            <>
              <td style={tdInc()}>{seletor('atividade', '9.5rem', SITUACOES_VAGAO.map((s) => ({ valor: s, rotulo: traduzirAtividade(s).rotulo })), 'Situação *')}</td>
              <td style={tdInc({ color: T.lo })}>—</td>
              <td style={tdInc()}>{par(campo('origem', '4rem'), campo('destino', '4rem'))}</td>
              <td style={tdInc()}>{par(campo('remetente', '6.5rem'), campo('destinatario', '6.5rem'))}</td>
              <td style={tdInc()}>{campo('mercadoria', '7rem')}</td>
              <td style={tdInc()}>{campo('pedido', '6rem')}</td>
              <td style={tdInc()}>{campo('pesoUtilT', '4.5rem', { inputMode: 'decimal' })}</td>
              <td style={tdInc()}>{campo('pesoBrutoT', '4.5rem', { inputMode: 'decimal' })}</td>
            </>
          ) : (
            <>
              <td style={tdInc()}>{campo('combustivelL', '5rem', { inputMode: 'decimal' })}</td>
              <td style={tdInc()}>{campo('pesoBrutoT', '4.5rem', { inputMode: 'decimal' })}</td>
              <td style={tdInc()}>{seletor('posicaoTrem', '6.5rem', [{ valor: 'Frente', rotulo: 'Frente' }, { valor: 'Traseira', rotulo: 'Traseira' }], 'Posição no trem')}</td>
            </>
          )}
          <td style={tdInc(COLUNA_ACOES)}>
            <span className="inline-flex items-center" style={{ gap: '0.125rem' }}>
              <BotaoIconeLinha icone={Check} rotulo={`Adicionar ${NOME_SECAO[tipo].um}`} tom="azul" onClick={confirmarInclusao} />
              <BotaoIconeLinha icone={X} rotulo="Cancelar inclusão" onClick={() => setInclusao(null)} />
            </span>
          </td>
        </tr>
        {mensagens.length > 0 && (
          <tr>
            <td colSpan={colunas} style={tdStyle({ backgroundColor: fundo, paddingTop: 0 })}>
              <div className="flex flex-col" role="status" style={{ position: 'sticky', left: '0.75rem', width: 'fit-content', gap: '0.25rem', fontSize: '0.6875rem', whiteSpace: 'normal' }}>
                {mensagens.map((m, i) => (
                  <span key={i} style={{ color: m.tom === 'erro' ? T.danger : T.warning, fontWeight: 600 }}>{m.texto}</span>
                ))}
              </div>
            </td>
          </tr>
        )}
      </>
    );
  };

  const cabecalho = (tipo: TipoVeiculoPatio, emEdicao: boolean) => {
    const { th } = ordemPorTipo[tipo];
    return (
      <tr>
        <Th largura={fixas(emEdicao).linha} colunas={['Linha']} sticky={{ left: ESQ_LINHA }} {...th('linha')}>Linha</Th>
        <Th largura={LARGURA_SEQ} colunas={['Seq']} sticky={{ left: fixas(emEdicao).seq }} {...th('seq')}>Posição</Th>
        <Th largura={LARGURA_VEICULO} colunas={['Sér', 'Veículo']} sticky={{ left: fixas(emEdicao).veiculo }} {...th('veiculo')}>Veículo</Th>
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
        {emEdicao && <Th largura={LARGURA_ACOES} alinhar="center" sticky={{ right: '0rem' }}>Ações</Th>}
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
    const visiveis = ordenarPadrao(doTipo.filter(visivel));
    // Com filtro/busca ativos, o header mostra "N de total" — sem eles, só o total. Os totais
    // contam só os considerados; os desconsiderados aparecem à parte.
    const consideradosDoTipo = considerados(doTipo).length;
    const visiveisConsiderados = considerados(visiveis).length;
    const qtdDesconsiderados = doTipo.length - consideradosDoTipo;
    const totalSecao = `${visiveisConsiderados}${visiveisConsiderados !== consideradosDoTipo ? ` de ${consideradosDoTipo}` : ''}`
      + (qtdDesconsiderados > 0 ? ` · ${qtdDesconsiderados} desconsiderado${qtdDesconsiderados > 1 ? 's' : ''}` : '');
    const colunas = (tipo === 'vagao' ? 11 : 6) + (emEdicao ? 1 : 0);
    const incluindo = inclusao?.tipo === tipo;
    // Ficha confirmada: o bloqueio precisa ficar evidente, não sumir — botão "Editar" continua
    // visível, só desabilitado, com cadeado e o caminho pra desbloquear no tooltip (2026-09-29,
    // pedido explícito do usuário: antes o botão simplesmente desaparecia e parecia que a edição
    // tinha sido removida).
    // O que "Reverter" desfaz nesta seção (só aparece com a ficha editável e fora da edição).
    const qtd = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
    const movidos = doTipo.filter((v) => !v.manual && temCorrecao(v)).length;
    const adicionados = doTipo.filter(ehManual).length;
    const desconsiderados = doTipo.filter(ehDesconsiderado).length;
    const resumoAlteracoes = [
      movidos > 0 && `${qtd(movidos, `${nomes.um} movid${nomes.g}`, `${nomes.varios} movid${nomes.g}s`)} volta${movidos > 1 ? 'm' : ''} à posição original`,
      adicionados > 0 && `${qtd(adicionados, `${nomes.um} adicionad${nomes.g}`, `${nomes.varios} adicionad${nomes.g}s`)} ${adicionados > 1 ? `são excluíd${nomes.g}s` : `é excluíd${nomes.g}`}`,
      desconsiderados > 0 && `${qtd(desconsiderados, `${nomes.um} desconsiderad${nomes.g}`, `${nomes.varios} desconsiderad${nomes.g}s`)} volta${desconsiderados > 1 ? 'm' : ''} ao plano`,
    ].filter((x): x is string => !!x);
    const acoes = emEdicao ? (
      <>
        <BotaoFicha onClick={sairDaEdicao}>Cancelar</BotaoFicha>
        <BotaoFicha variante="primario" onClick={salvar}>Salvar</BotaoFicha>
      </>
    ) : !editavel ? (
      <HeaderTooltip label="Ficha confirmada. Clique em Revisar para editar.">
        <BotaoFicha variante="discreto" icone={Lock} disabled style={{ color: T.lo }}>
          Editar
        </BotaoFicha>
      </HeaderTooltip>
    ) : (
      <>
        {/* "Reverter" aparece sempre que a seção tem alguma alteração salva (2026-10-02, pedido
            explícito do usuário) — some de novo quando volta tudo à fonte. */}
        {resumoAlteracoes.length > 0 && !outraEmEdicao && (
          <AcaoReverter nomes={nomes} resumo={resumoAlteracoes} onConfirmar={() => aplicarAgora((c) => reverterTipo(c, tipo))} />
        )}
        <HeaderTooltip label={outraEmEdicao ? 'Salve ou cancele a edição da outra seção primeiro' : `Corrigir dados de ${nomes.varios}`}>
          <BotaoFicha variante="discreto" icone={Pencil} disabled={outraEmEdicao} onClick={() => setEdicao({ tipo, correcoes })} style={{ color: T.azulTexto }}>
            Editar
          </BotaoFicha>
        </HeaderTooltip>
      </>
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
        {/* Em edição a tabela aparece mesmo vazia — é nela que fica a linha de inclusão. */}
        {doTipo.length === 0 && !incluindo ? (
          <EstadoVazio icone={tipo === 'vagao' ? Warehouse : TrainFront} titulo={`Sem ${nomes.varios} no pátio`} descricao="Ainda não chegou a posição desses veículos para esta ficha." />
        ) : visiveis.length === 0 && !incluindo ? (
          <EstadoVazio icone={tipo === 'vagao' ? Warehouse : TrainFront} titulo="Nenhum veículo para os filtros atuais" />
        ) : (
          <TabelaSangrada minWidth={tipo === 'vagao' ? '78rem' : '46rem'}>
            <thead>{cabecalho(tipo, emEdicao)}</thead>
            <tbody>
              {ordenar(visiveis, ordemPorTipo[tipo].ordem, valorColuna).map((v) => (tipo === 'vagao' ? linhaVagao(v, emEdicao) : linhaLocomotiva(v, emEdicao)))}
              {emEdicao && linhaInclusao(tipo, colunas)}
            </tbody>
          </TabelaSangrada>
        )}
        {emEdicao && !incluindo && (
          <div style={{ paddingTop: '0.5rem' }}>
            <BotaoFicha variante="discreto" icone={Plus} onClick={() => setInclusao({ tipo, rascunho: {}, tentou: false })} style={{ color: T.azulTexto, paddingLeft: 0 }}>
              Adicionar {nomes.um}
            </BotaoFicha>
          </div>
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

    </>
  );
}
