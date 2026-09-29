import { rotuloTrem, tremDesabilitado } from '../data/trensAtivos';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CloudOff,
  Inbox,
  Loader2,
  RotateCcw,
  Search,
  Train,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { HOJE, type FichaResumo } from '../data/fichaOperacao';
import {
  mesmoVeiculo,
  restricaoDoVeiculo,
  rotuloVeiculo,
  temErros,
  validarAcoes,
  type AcoesOperacionais,
  type DadosFichaLeitura,
  type NovaFichaDados,
  type VeiculoComposicao,
} from '../data/fichaModelo';
import { registrarDadosFicha, useDadosFicha } from '../data/fonteDadosFicha';
import { correcoesVazias, type CorrecoesLeitura } from '../data/correcoesLeitura';
import { montarPatio } from '../data/patioFicha';
import { traduzirRestricao } from '../data/glossarioFicha';
import { NOMES_PATIOS } from '../data/patio';
import { ConfirmarFichaModal } from './ConfirmarFichaModal';
import { ConfirmarTodasModal } from './ConfirmarTodasModal';
import { DesfazerConfirmacaoModal } from './DesfazerConfirmacaoModal';
import { ExcluirFichaModal } from './ExcluirFichaModal';
import { ExcluirDefinitivamenteModal } from './ExcluirDefinitivamenteModal';
import { ImportarFichaModal } from './ImportarFichaModal';
import { PageHeader, HeaderTitulo, HeaderDivider, PatioHeaderDropdown, DataHeaderDropdown, HeaderTooltip, PainelCard, PainelCardHeader, formatarData } from './PageHeader';
import { FiltroPainelTrem, filtroTremAtivo, contarFiltrosAtivosTrem, FILTRO_TREM_PADRAO, TremAba, type FiltroTrem } from './ficha/TremAba';
import { FiltroPainelPatio, filtroPatioAtivo, contarFiltrosAtivosPatio, FILTRO_PATIO_PADRAO, PatioAba, type FiltroPatio } from './ficha/PatioAba';
import { BotaoFiltro, EstadoVazio, PainelFiltro } from './ficha/fichaUi';
import { PainelAcoesOperacionais, type AberturaAcoes, type ModoAberturaAcoes } from './ficha/PainelAcoesOperacionais';
import { imprimirComPagina } from '../utils/imprimir';
import LogoVLI from '../../imports/Logo_VLI.svg';

const VLI_PRIMARY = 'var(--vli-primary)';
const VLI_PRIMARY_TEXT = 'var(--vli-primary-text)';
const PANEL_BG   = 'var(--vli-panel-bg)';
const SURFACE    = 'var(--vli-surface)';
const BORDER     = 'var(--vli-border)';
const TEXT_HI    = 'var(--vli-text-hi)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
const SUCCESS_TEXT = 'var(--vli-success-text)';
const DANGER_TEXT  = 'var(--vli-danger-text)';
const WARNING_TEXT = 'var(--vli-warning-text)';
const HOVER_TINT   = 'var(--vli-hover-tint)';
const FONT       = 'Manrope, sans-serif';
const RADIUS     = '0.375rem';
/** Largura da lista lateral de trens — estreita: o detalhe é a prioridade de espaço horizontal. */
const LIST_W     = '11rem';

interface Props {
  fichas: FichaResumo[];
  validadas: Record<string, boolean>;
  onAtualizarAcoes: (fichaId: string, acoes: AcoesOperacionais) => void;
  onAtualizarCorrecoes: (fichaId: string, correcoes: CorrecoesLeitura) => void;
  onValidarFicha: (fichaId: string, v: boolean) => void;
  onCriarFicha: (novaFicha: FichaResumo) => void;
  /** Move a ficha pra lixeira (soft delete) — não confunda com `onExcluirDefinitivamente`. */
  onMoverParaLixeira: (fichaId: string) => void;
  onRestaurarFicha: (fichaId: string) => void;
  /** Remove a ficha de verdade, sem volta — só chamado de dentro da Lixeira, com confirmação. */
  onExcluirDefinitivamente: (fichaId: string) => void;
  fichaFocoId?: string | null;
  onFocoAplicado?: () => void;
}

/** Formata o datetime ISO de `excluidaEm` pra "dd/mm/aaaa hh:mm" — usado só na linha da Lixeira. */
function formatarExclusao(iso: string) {
  const d = new Date(iso);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()} ${hora}:${min}`;
}

function horaAtual() {
  const agora = new Date();
  return `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
}

/** Item da lista lateral de trens. O número à direita é a quantidade de veículos com restrição
 *  (dado de leitura); vem da mesma fonte que a tela usa, sem acesso direto ao upload. */
function LinhaFicha({ ficha, ativa, validada, onClick }: { ficha: FichaResumo; ativa: boolean; validada: boolean; onClick: () => void }) {
  const desabilitada = tremDesabilitado(ficha.trem);
  return (
    <HeaderTooltip label={desabilitada ? 'Trem indisponível no protótipo' : `Trem ${rotuloTrem(ficha.trem)} · OS ${ficha.os} · Pátio ${ficha.patioNome}`}><button
      onClick={onClick}
      disabled={desabilitada}
      className="flex items-start w-full"
      style={{
        gap: '0.375rem',
        padding: '0.5rem 0.625rem',
        border: 'none',
        borderLeft: `0.125rem solid ${ativa ? VLI_PRIMARY_TEXT : 'transparent'}`,
        backgroundColor: ativa ? 'var(--vli-active-bg)' : 'transparent',
        cursor: desabilitada ? 'not-allowed' : 'pointer',
        opacity: desabilitada ? 0.45 : 1,
        textAlign: 'left',
        fontFamily: FONT,
      }}
      onMouseEnter={(e) => { if (!ativa && !desabilitada) e.currentTarget.style.backgroundColor = HOVER_TINT; }}
      onMouseLeave={(e) => { if (!ativa) e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {validada ? (
        <CheckCircle2 size="0.75rem" color={SUCCESS_TEXT} strokeWidth={2.25} style={{ flexShrink: 0, marginTop: '0.125rem' }} />
      ) : (
        <AlertTriangle size="0.75rem" color={WARNING_TEXT} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: '0.125rem' }} />
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: ativa ? VLI_PRIMARY_TEXT : TEXT_HI, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {rotuloTrem(ficha.trem)}
        </span>
        <div style={{ fontSize: '0.625rem', color: TEXT_LO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          OS {ficha.os}
        </div>
      </div>
    </button></HeaderTooltip>
  );
}

function DetalheVazio() {
  return (
    <div className="flex flex-col items-center justify-center" style={{ flex: 1, minHeight: 0, gap: '0.625rem' }}>
      <Inbox size="1.875rem" strokeWidth={1.5} color={TEXT_LO} />
      <span style={{ fontSize: '0.8125rem', color: TEXT_LO, fontFamily: FONT, fontWeight: 400 }}>
        Selecione uma ficha na lista para ver os detalhes.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Abas
// ---------------------------------------------------------------------------------------

/** Duas abas de topo, as duas coisas que o motor de planejamento precisa conhecer: o TREM que
 *  chega (e o que muda nele por decisão do operador) e o estado do PÁTIO (onde está cada vagão
 *  e locomotiva, e em que situação). */
type AbaFicha = 'trem' | 'patio';

interface DefAba { id: AbaFicha; label: string; contagem?: number }

/** `direita`: busca, filtro e lixeira — mesmo subheader das abas, lado direito (pedido explícito
 *  do usuário: esses botões saem do cabeçalho de título e passam a viver aqui). */
function AbasFicha({ abas, ativa, onChange, direita }: { abas: DefAba[]; ativa: AbaFicha; onChange: (a: AbaFicha) => void; direita?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between shrink-0 no-print" style={{ gap: '1rem', minHeight: '2.5rem', borderBottom: `1px solid ${BORDER}`, padding: '0.25rem 1rem 0' }}>
      {/* `alignSelf: 'flex-end'`: só a faixa das abas precisa encostar embaixo, pra sublinhado da
          aba ativa colar no divisor da linha (pedido explícito do usuário) — busca/filtro/lixeira
          continuam centralizados na altura da linha. */}
      <div role="tablist" aria-label="Visões da ficha" className="flex items-center shrink-0" style={{ alignSelf: 'flex-end', gap: '1.5rem', overflowX: 'auto', minWidth: 0 }}>
        {abas.map((a) => {
        const sel = a.id === ativa;
        return (
          <button
            key={a.id}
            role="tab"
            type="button"
            aria-selected={sel}
            onClick={() => onChange(a.id)}
            className="flex items-center"
            style={{
              gap: '0.375rem',
              padding: '0.625rem 0.125rem 0.5rem',
              background: 'transparent',
              border: 'none',
              borderBottom: `0.125rem solid ${sel ? 'var(--vli-marca-azul)' : 'transparent'}`,
              color: sel ? TEXT_HI : TEXT_LO,
              fontSize: '0.75rem',
              fontWeight: sel ? 700 : 500,
              fontFamily: FONT,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {a.label}
            {a.contagem !== undefined && (
              <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '0.0625rem 0.3125rem', borderRadius: '62.4375rem', backgroundColor: SURFACE, border: `1px solid ${BORDER}`, color: sel ? TEXT_HI : TEXT_LO }}>
                {a.contagem}
              </span>
            )}
          </button>
        );
      })}
      </div>
      {direita && <div className="flex items-center shrink-0" style={{ gap: '0.625rem' }}>{direita}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Impressão
// ---------------------------------------------------------------------------------------

function ImpressaoFicha({ ficha, dados }: { ficha: FichaResumo; dados: DadosFichaLeitura }) {
  const th: React.CSSProperties = { textAlign: 'left', padding: '0.25rem 0.5rem', fontSize: '0.625rem', borderBottom: '1px solid #999', fontFamily: FONT };
  const td: React.CSSProperties = { padding: '0.1875rem 0.5rem', fontSize: '0.6875rem', borderBottom: '1px solid #ddd', fontFamily: FONT };
  const retirar = (v: VeiculoComposicao) => ficha.acoes.retiradas.find((r) => mesmoVeiculo(r.numero, v.numero));
  return (
    <div className="print-area only-print" style={{ padding: '1.5rem' }}>
      <div className="flex items-center" style={{ gap: '0.875rem', marginBottom: '1rem' }}>
        <img src={LogoVLI} alt="VLI" style={{ height: '1.875rem' }} />
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: FONT }}>Ficha Operacional</div>
          <div style={{ fontSize: '0.75rem', fontFamily: FONT, marginTop: '0.125rem' }}>
            Pátio {ficha.patioNome} · Trem {rotuloTrem(ficha.trem)} · OS {ficha.os} · {formatarData(ficha.data)} · {dados.cabecalho.origem} → {dados.cabecalho.destino}
          </div>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{['Pos.', 'Veículo', 'Tipo', 'Bloco', 'Origem → Destino', 'Restrição', 'Ação'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {dados.composicao.map((v) => {
            const r = restricaoDoVeiculo(dados, v);
            const ret = retirar(v);
            return (
              <tr key={`${v.posicao}-${v.numero}`}>
                <td style={td}>{v.posicao}</td>
                <td style={{ ...td, fontWeight: 700 }}>{rotuloVeiculo(v)}</td>
                <td style={td}>{v.tipo === 'locomotiva' ? 'Locomotiva' : 'Vagão'}</td>
                <td style={td}>{v.bloco}</td>
                <td style={td}>{v.origem || '—'} → {v.destino || '—'}</td>
                <td style={td}>{r ? `${traduzirRestricao(r.codigo).rotulo}${r.observacao ? ` — ${r.observacao}` : ''}` : '—'}</td>
                <td style={td}>{ret ? <strong className="print-badge-alerta">Retirar{ret.motivo ? ` — ${ret.motivo}` : ''}</strong> : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {ficha.acoes.inclusoes.length > 0 && (
        <p style={{ fontSize: '0.75rem', fontFamily: FONT, marginTop: '0.75rem' }}>
          <strong>Inclusões adicionais:</strong>{' '}
          {ficha.acoes.inclusoes.map((i) => `${i.bloco}: ${i.quantidade}${i.serie ? ` ${i.serie}` : ''}`).join(' · ')}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Detalhe
// ---------------------------------------------------------------------------------------

function DetalheFicha({ ficha, validada, onAtualizarAcoes, onAtualizarCorrecoes, onExcluir, onRevisar }: {
  ficha: FichaResumo;
  /** Ficha confirmada: não pode ir pra lixeira; composição e Pátio ficam travados. */
  validada: boolean;
  onAtualizarAcoes: (acoes: AcoesOperacionais) => void;
  onAtualizarCorrecoes: (c: CorrecoesLeitura) => void;
  onExcluir: () => void;
  /** Mesma ação do botão "Ficha Confirmada — Revisar" do topo — usada pelo aviso de somente
   *  leitura no painel de Ações operacionais. */
  onRevisar: () => void;
}) {
  const [excluirOpen, setExcluirOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState<AbaFicha>('trem');
  const [painelFiltroAberto, setPainelFiltroAberto] = useState(false);
  // Painel lateral de Ações operacionais — só um painel lateral aberto por vez (filtro OU ações).
  const [acoesPainelAberto, setAcoesPainelAberto] = useState(false);
  const [aberturaAcoes, setAberturaAcoes] = useState<AberturaAcoes>({ modo: 'topo', nonce: 0 });
  const [destaqueRetirada, setDestaqueRetirada] = useState<string | null>(null);
  const [filtroTrem, setFiltroTrem] = useState<FiltroTrem>(FILTRO_TREM_PADRAO);
  const [filtroPatio, setFiltroPatio] = useState<FiltroPatio>(FILTRO_PATIO_PADRAO);
  const estado = useDadosFicha(ficha);
  const dados = estado.estado === 'pronto' ? estado.dados : null;
  // Pátio = fonte + correções do operador (overrides); a composição do trem não tem correção.
  const veiculosPatio = useMemo(() => (dados ? montarPatio(dados, ficha.correcoes) : []), [dados, ficha.correcoes]);

  useEffect(() => {
    setBusca('');
    setAba('trem');
    setPainelFiltroAberto(false);
    setAcoesPainelAberto(false);
    setDestaqueRetirada(null);
    setFiltroTrem(FILTRO_TREM_PADRAO);
    setFiltroPatio(FILTRO_PATIO_PADRAO);
  }, [ficha.id]);

  const alternarFiltro = () => {
    setPainelFiltroAberto((p) => !p);
    setAcoesPainelAberto(false);
  };
  // O nonce faz o painel reaplicar o foco/rolagem mesmo quando já estava aberto.
  const abrirAcoes = (modo: ModoAberturaAcoes) => {
    setAberturaAcoes((a) => ({ modo, nonce: a.nonce + 1 }));
    setAcoesPainelAberto(true);
    setPainelFiltroAberto(false);
  };
  const mudarAba = (nova: AbaFicha) => {
    setAba(nova);
    if (nova !== 'trem') setAcoesPainelAberto(false);
  };
  const limparDestaque = useCallback(() => setDestaqueRetirada(null), []);

  const pendencias = dados && temErros(validarAcoes(ficha.acoes, dados.composicao));
  const abas: DefAba[] = [
    { id: 'trem', label: 'Trem', contagem: dados?.composicao.length },
    { id: 'patio', label: 'Pátio', contagem: dados ? veiculosPatio.length : undefined },
  ];

  let conteudo: React.ReactNode;
  if (estado.estado === 'carregando') {
    conteudo = <EstadoVazio icone={Loader2} titulo="Buscando dados da ficha…" />;
  } else if (estado.estado === 'erro') {
    conteudo = <EstadoVazio icone={CloudOff} titulo="Não foi possível obter os dados da ficha" descricao={estado.mensagem} />;
  } else if (!dados) {
    conteudo = <EstadoVazio icone={CloudOff} titulo="Dados da ficha ainda não recebidos" descricao="A composição deste trem ainda não chegou. Cadastre a ficha manualmente ou aguarde o próximo envio de dados." />;
  } else if (aba === 'trem') {
    conteudo = (
      <TremAba
        dados={dados}
        acoes={ficha.acoes}
        onAcoesChange={onAtualizarAcoes}
        busca={busca}
        filtro={filtroTrem}
        editavel={!validada}
        acoesPainelAberto={acoesPainelAberto}
        onAbrirAcoes={abrirAcoes}
        onDestacarRetirada={setDestaqueRetirada}
      />
    );
  } else {
    conteudo = (
      <PatioAba
        veiculos={veiculosPatio}
        correcoes={ficha.correcoes}
        onCorrecoesChange={onAtualizarCorrecoes}
        busca={busca}
        filtro={filtroPatio}
        editavel={!validada}
      />
    );
  }

  const temFiltroAtivo = aba === 'trem' ? filtroTremAtivo(filtroTrem) : filtroPatioAtivo(filtroPatio);
  const qtdFiltrosAtivos = aba === 'trem' ? contarFiltrosAtivosTrem(filtroTrem) : contarFiltrosAtivosPatio(filtroPatio);
  const limparFiltros = () => (aba === 'trem' ? setFiltroTrem(FILTRO_TREM_PADRAO) : setFiltroPatio(FILTRO_PATIO_PADRAO));
  const painelFiltroConteudo = !dados ? null : aba === 'trem' ? (
    <FiltroPainelTrem
      dados={dados}
      acoes={ficha.acoes}
      filtro={filtroTrem}
      onFiltroChange={setFiltroTrem}
    />
  ) : (
    <FiltroPainelPatio
      veiculos={veiculosPatio}
      filtro={filtroPatio}
      onFiltroChange={setFiltroPatio}
    />
  );

  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <PainelCard className="no-print">
        <PainelCardHeader>
          <p className="flex items-center flex-wrap" style={{ fontSize: '0.8125rem', lineHeight: 1.5, margin: 0, gap: '0.375rem', fontFamily: FONT, minWidth: 0 }}>
            <span className="flex items-center" style={{ gap: '0.375rem', color: TEXT_HI, fontWeight: 700 }}>
              <Train size="0.9375rem" strokeWidth={2.25} style={{ flexShrink: 0 }} />
              Trem {rotuloTrem(ficha.trem)}
            </span>
            <span style={{ color: TEXT_LO }}>·</span>
            <span style={{ color: TEXT_LO, fontWeight: 400 }}>Pátio {ficha.patioNome}</span>
            <span style={{ color: TEXT_LO }}>·</span>
            <span style={{ color: TEXT_LO, fontWeight: 400 }}>OS {ficha.os}</span>
            <span style={{ color: TEXT_LO }}>·</span>
            <span style={{ color: TEXT_LO, fontWeight: 400 }}>{formatarData(ficha.data)}</span>
            {pendencias && (
              <span className="flex items-center" style={{ gap: '0.25rem', marginLeft: '0.375rem', fontSize: '0.6875rem', fontWeight: 600, color: DANGER_TEXT }}>
                <AlertTriangle size="0.75rem" strokeWidth={2.5} /> Alterações do operador com pendência
              </span>
            )}
          </p>
        </PainelCardHeader>

        <AbasFicha
          abas={abas}
          ativa={aba}
          onChange={mudarAba}
          direita={
            <>
              <BuscaHeader value={busca} onChange={setBusca} />
              {dados && <BotaoFiltro ativo={painelFiltroAberto} temFiltro={temFiltroAtivo} onClick={alternarFiltro} />}
              <HeaderTooltip label={validada ? 'Fichas confirmadas não podem ser excluídas — desfaça a confirmação primeiro.' : undefined}><button
                onClick={() => { if (!validada) setExcluirOpen(true); }}
                disabled={validada}
                aria-label="Excluir ficha"
                style={{
                  width: '1.75rem', height: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${BORDER}`, borderRadius: RADIUS, background: 'transparent', color: TEXT_MD,
                  cursor: validada ? 'not-allowed' : 'pointer', opacity: validada ? 0.4 : 1,
                }}
                onMouseEnter={(e) => { if (!validada) { e.currentTarget.style.color = DANGER_TEXT; e.currentTarget.style.borderColor = DANGER_TEXT; } }}
                onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_MD; e.currentTarget.style.borderColor = BORDER; }}
              >
                <Trash2 size="0.75rem" />
              </button></HeaderTooltip>
            </>
          }
        />

        {/* Conteúdo da aba + painéis laterais (filtro, ações) como IRMÃOS flex: o painel não sobrepõe nada, ele
            ganha largura e empurra o conteúdo pra esquerda (ver `PainelFiltro`). */}
        <div className="flex" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="flex flex-col" style={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', padding: '1rem', gap: '1rem' }}>
            {conteudo}
          </div>

          <PainelFiltro
            aberto={painelFiltroAberto && !!dados}
            onFechar={() => setPainelFiltroAberto(false)}
            onLimpar={temFiltroAtivo ? limparFiltros : undefined}
            titulo={`Filtros — ${aba === 'trem' ? 'Trem' : 'Pátio'}${qtdFiltrosAtivos > 0 ? ` (${qtdFiltrosAtivos})` : ''}`}
          >
            {painelFiltroConteudo}
          </PainelFiltro>

          {dados && (
            <PainelAcoesOperacionais
              dados={dados}
              acoes={ficha.acoes}
              onAcoesChange={onAtualizarAcoes}
              editavel={!validada}
              aberto={acoesPainelAberto && aba === 'trem'}
              abertura={aberturaAcoes}
              destaqueRetiradaId={destaqueRetirada}
              onLimparDestaque={limparDestaque}
              onFechar={() => setAcoesPainelAberto(false)}
              onRevisarFicha={onRevisar}
            />
          )}
        </div>
      </PainelCard>

      {dados && <ImpressaoFicha ficha={ficha} dados={dados} />}

      <ExcluirFichaModal
        isOpen={excluirOpen}
        ficha={ficha}
        onClose={() => setExcluirOpen(false)}
        onExcluir={() => {
          setExcluirOpen(false);
          onExcluir();
        }}
      />
    </div>
  );
}

/**
 * Busca "Buscar por vagão ou série" do header da Ficha Operacional — 2026-08-31, pedido
 * explícito do usuário: saiu da barra full-width abaixo dos cards de KPI (que ocupava uma linha
 * inteira só pra isso) e virou um ícone de lupa no MESMO grupo de botões do header (Editar/
 * Filtros/Excluir), que expande em transição suave pra um campo de texto ao clicar.
 * A `div` (não o `input`) é o elemento que anima `width` — precisa ser o MESMO elemento montado
 * o tempo todo (nunca trocar de tipo entre os dois estados), senão a transição CSS não tem o que
 * interpolar: ela só funciona porque o React reconcilia o mesmo nó, só o `style`/conteúdo interno
 * muda. `HeaderTooltip` envolve incondicionalmente por isso também (o `asChild`/`Slot` do Radix
 * não insere nenhum nó de DOM a mais, então não quebra essa continuidade).
 * Fechar (Esc/blur) só quando o campo está vazio — pedido explícito: "se tiver texto digitado,
 * mantenha aberto até o usuário limpar ou fechar manualmente" (o botão "x" sempre limpa E fecha).
 */
function BuscaHeader({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) inputRef.current?.focus();
  }, [aberto]);

  function tentarFechar() {
    if (value.trim() === '') setAberto(false);
  }

  function limparEFechar() {
    onChange('');
    setAberto(false);
  }

  return (
    <HeaderTooltip label="Buscar por vagão ou série">
      <div
        onClick={aberto ? undefined : () => setAberto(true)}
        className="flex items-center shrink-0"
        style={{
          // `gap: 0` fechado — mesmo com o `<input>` em `width: 0`, um `gap` diferente de zero
          // ainda reserva aquele espaço ENTRE ele e o ícone, empurrando o ícone pra esquerda do
          // centro do botão (reportado pelo usuário: "o ícone do pesquisar está levemente
          // desalinhado para esquerda").
          gap: aberto ? '0.375rem' : 0,
          width: aberto ? '13rem' : '1.75rem',
          height: '1.75rem',
          padding: aberto ? '0 0.5rem' : 0,
          justifyContent: aberto ? 'flex-start' : 'center',
          border: `1px solid ${aberto ? VLI_PRIMARY_TEXT : BORDER}`,
          borderRadius: RADIUS,
          // `PANEL_BG` (branco no light), mesmo motivo do `BotaoFiltros` acima.
          backgroundColor: PANEL_BG,
          color: TEXT_MD,
          overflow: 'hidden',
          cursor: aberto ? 'text' : 'pointer',
          transition: 'width 220ms ease-in-out, padding 220ms ease-in-out, gap 220ms ease-in-out, border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => { if (!aberto) { e.currentTarget.style.borderColor = TEXT_LO; e.currentTarget.style.color = TEXT_HI; } }}
        onMouseLeave={(e) => { if (!aberto) { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_MD; } }}
      >
        <Search size="0.75rem" strokeWidth={2.25} style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') tentarFechar(); }}
          onBlur={tentarFechar}
          placeholder="Buscar por vagão ou série..."
          tabIndex={aberto ? 0 : -1}
          style={{
            // `width: 0` explícito (não só confiar no `flex-shrink` do pai) quando fechado —
            // um `<input>` tem `min-width: auto` (conteúdo do placeholder) por padrão, então sem
            // isso ele "vaza" por baixo do `overflow: hidden` do container enquanto ainda encolhido.
            width: aberto ? '100%' : 0,
            minWidth: 0,
            opacity: aberto ? 1 : 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: TEXT_HI,
            fontSize: '0.75rem',
            fontFamily: FONT,
            transition: 'width 220ms ease-in-out, opacity 150ms ease-in-out',
          }}
        />
        {aberto && (
          <button
            type="button"
            aria-label="Fechar busca"
            onClick={(e) => { e.stopPropagation(); limparEFechar(); }}
            className="flex items-center justify-center shrink-0"
            style={{ width: '1rem', height: '1rem', padding: 0, border: 'none', background: 'transparent', color: TEXT_LO, cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_HI; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_LO; }}
          >
            <X size="0.75rem" />
          </button>
        )}
      </div>
    </HeaderTooltip>
  );
}


/** Vista alternativa da tela (não uma rota separada) — lista as fichas na lixeira, com
 *  Restaurar/Excluir definitivamente por linha. Só identificação básica (trem/OS/pátio/data),
 *  sem a tabela de vagões — não faz sentido editar a composição de uma ficha que já saiu da
 *  listagem principal. Reaproveita as mesmas cores/tipografia/espaçamento de `LinhaFicha`. */
function LixeiraView({ fichas, onRestaurar, onExcluirDefinitivo }: {
  fichas: FichaResumo[];
  onRestaurar: (fichaId: string) => void;
  onExcluirDefinitivo: (ficha: FichaResumo) => void;
}) {
  if (fichas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ flex: 1, minHeight: 0, gap: '0.625rem' }}>
        <Trash2 size="1.875rem" strokeWidth={1.5} color={TEXT_LO} />
        <span style={{ fontSize: '0.8125rem', color: TEXT_LO, fontFamily: FONT, fontWeight: 400 }}>
          A lixeira está vazia.
        </span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.25rem 1.5rem' }}>
      {fichas.map((f) => (
        <div
          key={f.id}
          className="flex items-center justify-between"
          style={{ padding: '0.75rem 0.25rem', borderBottom: `1px solid ${BORDER}`, gap: '0.75rem' }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="flex items-center flex-wrap" style={{ gap: '0.375rem' }}>
              <Train size="0.875rem" strokeWidth={2.25} color={TEXT_HI} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: TEXT_HI, fontFamily: FONT }}>
                Trem {rotuloTrem(f.trem)}
              </span>
              <span style={{ color: TEXT_LO, fontSize: '0.75rem' }}>·</span>
              <span style={{ fontSize: '0.75rem', color: TEXT_LO, fontFamily: FONT }}>OS {f.os}</span>
              <span style={{ color: TEXT_LO, fontSize: '0.75rem' }}>·</span>
              <span style={{ fontSize: '0.75rem', color: TEXT_LO, fontFamily: FONT }}>Pátio {f.patioNome}</span>
              <span style={{ color: TEXT_LO, fontSize: '0.75rem' }}>·</span>
              <span style={{ fontSize: '0.75rem', color: TEXT_LO, fontFamily: FONT }}>{formatarData(f.data)}</span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: TEXT_LO, fontFamily: FONT, marginTop: '0.1875rem' }}>
              Excluída em {f.excluidaEm ? formatarExclusao(f.excluidaEm) : '—'}
            </div>
          </div>

          <div className="flex items-center shrink-0" style={{ gap: '0.5rem' }}>
            <button
              onClick={() => onRestaurar(f.id)}
              className="flex items-center justify-center"
              style={{
                gap: '0.375rem',
                height: '1.875rem',
                padding: '0 0.75rem',
                borderRadius: RADIUS,
                border: `1px solid ${BORDER}`,
                backgroundColor: 'transparent',
                color: TEXT_MD,
                fontSize: '0.6875rem',
                letterSpacing: '0.03em',
                cursor: 'pointer',
                fontFamily: FONT,
                whiteSpace: 'nowrap',
                transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = HOVER_TINT; e.currentTarget.style.color = TEXT_HI; e.currentTarget.style.borderColor = TEXT_LO; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = TEXT_MD; e.currentTarget.style.borderColor = BORDER; }}
            >
              <RotateCcw size="0.8125rem" strokeWidth={2.25} />
              Restaurar
            </button>
            <HeaderTooltip label={"Excluir definitivamente"}><button
              onClick={() => onExcluirDefinitivo(f)}
              aria-label="Excluir definitivamente"
             
              style={{
                width: '1.875rem',
                height: '1.875rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${BORDER}`,
                borderRadius: RADIUS,
                background: 'transparent',
                color: TEXT_MD,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = DANGER_TEXT; e.currentTarget.style.borderColor = DANGER_TEXT; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_MD; e.currentTarget.style.borderColor = BORDER; }}
            >
              <Trash2 size="0.8125rem" />
            </button></HeaderTooltip>
          </div>
        </div>
      ))}
    </div>
  );
}

const TODOS_PATIOS = 'todos';

export function FichaOperacaoScreen({ fichas, validadas, onAtualizarAcoes, onAtualizarCorrecoes, onValidarFicha, onCriarFicha, onMoverParaLixeira, onRestaurarFicha, onExcluirDefinitivamente, fichaFocoId, onFocoAplicado }: Props) {
  const [dataSelecionada, setDataSelecionada] = useState(HOJE);
  const [patioSelecionado, setPatioSelecionado] = useState(NOMES_PATIOS[0]);
  // Sempre há um trem selecionado por padrão (o primeiro do dia) — mesmo padrão da barra de
  // seleção de trem do Plano de Manobra, agora que a seleção vive nos chips e não numa lista
  // lateral que precisava de um clique explícito para abrir o primeiro item.
  const [fichaSelecionadaId, setFichaSelecionadaId] = useState<string | null>(
    () => fichas.find((f) => f.data === HOJE && f.patioNome === NOMES_PATIOS[0] && !f.excluidaEm && !tremDesabilitado(f.trem))?.id ?? null,
  );
  const [importarOpen, setImportarOpen] = useState(false);
  const [confirmarTodasOpen, setConfirmarTodasOpen] = useState(false);
  const [confirmarOpen, setConfirmarOpen] = useState(false);
  const [desfazerOpen, setDesfazerOpen] = useState(false);
  const [buscaTrem, setBuscaTrem] = useState('');
  // Lixeira é uma segunda "vista" da mesma tela (não uma rota separada) — substitui a lista +
  // detalhe principal enquanto aberta; `fichaParaExcluirDefinitivo` guarda qual linha da
  // lixeira está com o modal de confirmação de exclusão permanente aberto.
  const [lixeiraAberta, setLixeiraAberta] = useState(false);
  const [fichaParaExcluirDefinitivo, setFichaParaExcluirDefinitivo] = useState<FichaResumo | null>(null);

  useEffect(() => {
    if (!fichaFocoId) return;
    const ficha = fichas.find((f) => f.id === fichaFocoId);
    if (ficha) {
      setDataSelecionada(ficha.data);
      setPatioSelecionado(TODOS_PATIOS);
      setFichaSelecionadaId(ficha.id);
      setLixeiraAberta(false);
    }
    onFocoAplicado?.();
  }, [fichaFocoId]);

  // Fichas na lixeira saem de TODA derivação da listagem principal (datas disponíveis, lista
  // lateral, seleção, contagem de pendentes) — mas continuam no array `fichas` até serem
  // restauradas ou excluídas de verdade, ver `fichasLixeira` mais abaixo.
  const fichasAtivas = fichas.filter((f) => !f.excluidaEm);
  const fichasLixeira = fichas.filter((f) => !!f.excluidaEm);

  const datasDisponiveis = Array.from(new Set(fichasAtivas.map((f) => f.data))).sort((a, b) => (a < b ? 1 : -1));
  const fichasDoDia = fichasAtivas.filter(
    (f) => f.data === dataSelecionada && (patioSelecionado === TODOS_PATIOS || f.patioNome === patioSelecionado),
  );
  const fichaSelecionada = fichasDoDia.find((f) => f.id === fichaSelecionadaId) ?? null;
  const fichasPendentesDia = fichasDoDia.filter((f) => !validadas[f.id]);
  const pendentesDia = fichasPendentesDia.length;
  const fichasFiltradas = fichasDoDia.filter((f) => f.trem.toLowerCase().includes(buscaTrem.trim().toLowerCase()));
  const validadaSelecionada = fichaSelecionada ? !!validadas[fichaSelecionada.id] : false;

  const selecionarData = (data: string) => {
    setDataSelecionada(data);
    const primeira = fichasAtivas.filter((f) => !tremDesabilitado(f.trem)).find(
      (f) => f.data === data && (patioSelecionado === TODOS_PATIOS || f.patioNome === patioSelecionado),
    );
    setFichaSelecionadaId(primeira?.id ?? null);
  };

  const selecionarPatio = (patio: string) => {
    setPatioSelecionado(patio);
    const primeira = fichasAtivas.filter((f) => !tremDesabilitado(f.trem)).find(
      (f) => f.data === dataSelecionada && (patio === TODOS_PATIOS || f.patioNome === patio),
    );
    setFichaSelecionadaId(primeira?.id ?? null);
  };

  // Ficha nova (importação): os dados de leitura vão para a fonte de dados; a
  // ficha em si guarda só identificação + ações operacionais.
  const handleSalvarNovaFicha = (dados: NovaFichaDados) => {
    const novaFicha: FichaResumo = {
      id: `f-${Date.now()}`,
      trem: dados.trem,
      os: dados.os,
      patioNome: dados.patioNome,
      data: dados.data,
      recebidoEm: horaAtual(),
      acoes: dados.acoes,
      correcoes: correcoesVazias(),
    };
    registrarDadosFicha(novaFicha.id, dados.leitura);
    onCriarFicha(novaFicha);
    // Navega pra data escolhida no formulário (não sempre HOJE) — senão a ficha recém-criada/
    // importada some da listagem quando a data escolhida for diferente da selecionada no header.
    setDataSelecionada(novaFicha.data);
    setPatioSelecionado(TODOS_PATIOS);
    setFichaSelecionadaId(novaFicha.id);
  };

  const handleConfirmarTodas = () => {
    fichasPendentesDia.forEach((f) => onValidarFicha(f.id, true));
    setConfirmarTodasOpen(false);
  };

  const handleExcluir = () => {
    // Trava "confirmada não pode ser excluída" também aqui, além do botão em `DetalheFicha` —
    // defesa em profundidade, já que este handler é o que de fato dispara a mudança de estado.
    if (!fichaSelecionada || validadaSelecionada) return;
    const idExcluida = fichaSelecionada.id;
    const proxima = fichasDoDia.find((f) => f.id !== idExcluida && !tremDesabilitado(f.trem));
    onMoverParaLixeira(idExcluida);
    setFichaSelecionadaId(proxima?.id ?? null);
  };

  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Header — título + seletores de data/pátio + ações da ficha selecionada, sempre
          visíveis independente do scroll da tabela abaixo. Casca/peças visuais compartilhadas
          com o header de Planejamento via `PageHeader.tsx` — só a composição (o que aparece)
          é específica desta tela. */}
      <PageHeader
        acoes={
          <>
            {!lixeiraAberta && pendentesDia > 0 && (
              <button
                onClick={() => setConfirmarTodasOpen(true)}
                className="flex items-center justify-center shrink-0"
                style={{
                  gap: '0.375rem',
                  height: '2rem',
                  padding: '0 0.75rem',
                  borderRadius: RADIUS,
                  border: `1px solid ${BORDER}`,
                  backgroundColor: 'transparent',
                  color: TEXT_MD,
                  fontSize: '0.6875rem',
                  letterSpacing: '0.03em',
                  cursor: 'pointer',
                  fontFamily: FONT,
                  whiteSpace: 'nowrap',
                  transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = HOVER_TINT; e.currentTarget.style.color = TEXT_HI; e.currentTarget.style.borderColor = TEXT_LO; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = TEXT_MD; e.currentTarget.style.borderColor = BORDER; }}
              >
                <CheckCircle2 size="0.875rem" strokeWidth={2.5} />
                Confirmar Todas ({pendentesDia})
              </button>
            )}

            {!lixeiraAberta && fichaSelecionada && (
              <button
                onClick={() => (validadaSelecionada ? setDesfazerOpen(true) : setConfirmarOpen(true))}
                className="flex items-center justify-center shrink-0"
                style={{
                  gap: '0.375rem',
                  height: '2rem',
                  padding: '0 0.875rem',
                  borderRadius: RADIUS,
                  fontFamily: FONT,
                  fontSize: '0.6875rem',
                  letterSpacing: '0.03em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  border: validadaSelecionada ? `1px solid ${BORDER}` : 'none',
                  backgroundColor: validadaSelecionada ? 'transparent' : VLI_PRIMARY,
                  color: validadaSelecionada ? SUCCESS_TEXT : '#fff',
                  transition: 'background-color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => { if (validadaSelecionada) { e.currentTarget.style.backgroundColor = HOVER_TINT; e.currentTarget.style.borderColor = TEXT_LO; } else { e.currentTarget.style.backgroundColor = 'var(--vli-primary-hover)'; } }}
                onMouseLeave={(e) => { if (validadaSelecionada) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = BORDER; } else { e.currentTarget.style.backgroundColor = VLI_PRIMARY; } }}
              >
                {validadaSelecionada && <CheckCircle2 size="0.875rem" strokeWidth={2.5} />}
                {validadaSelecionada ? 'Ficha Confirmada — Revisar' : 'Confirmar Ficha'}
              </button>
            )}
          </>
        }
      >
        <div className="flex items-baseline" style={{ gap: '0.625rem', minWidth: 0 }}>
          {lixeiraAberta ? (
            <>
              <button
                onClick={() => setLixeiraAberta(false)}
                aria-label="Voltar para Ficha Operacional"
                className="flex items-center justify-center"
                style={{ border: 'none', background: 'transparent', color: TEXT_MD, cursor: 'pointer', padding: '0.125rem' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_HI; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_MD; }}
              >
                <ArrowLeft size="1rem" />
              </button>
              <HeaderTitulo>Lixeira</HeaderTitulo>
            </>
          ) : (
            <>
              <HeaderTitulo>Ficha Operacional</HeaderTitulo>
              <HeaderDivider />
              <PatioHeaderDropdown
                value={patioSelecionado}
                onChange={selecionarPatio}
                opcoesExtras={[{ value: TODOS_PATIOS, label: 'Todos os pátios' }]}
                formatarRotulo={(v) => (v === TODOS_PATIOS ? 'Todos os pátios' : `Pátio ${v}`)}
              />
              <HeaderDivider />
              <DataHeaderDropdown value={dataSelecionada} onChange={selecionarData} datasDisponiveis={datasDisponiveis} />
            </>
          )}
        </div>
      </PageHeader>

      {/* Corpo — lista lateral de trens (estreita) + detalhe, lado a lado (ou a Lixeira,
          substituindo os dois enquanto `lixeiraAberta`). */}
      {lixeiraAberta ? (
        <LixeiraView
          fichas={fichasLixeira}
          onRestaurar={onRestaurarFicha}
          onExcluirDefinitivo={setFichaParaExcluirDefinitivo}
        />
      ) : (
      <div className="flex" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div
          className="flex flex-col shrink-0 no-print"
          style={{ width: LIST_W, borderRight: `1px solid ${BORDER}`, overflow: 'hidden', backgroundColor: PANEL_BG }}
        >
          <div style={{ padding: '0.625rem 0.625rem 0', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', color: TEXT_LO, fontFamily: FONT, textTransform: 'uppercase' }}>
            Fichas do Trem
          </div>

          <div className="flex flex-col shrink-0" style={{ padding: '0.5rem', gap: '0.375rem', borderBottom: `1px solid ${BORDER}` }}>
            <button
              onClick={() => setImportarOpen(true)}
              className="flex items-center justify-center"
              style={{
                gap: '0.375rem',
                height: '1.75rem',
                width: '100%',
                borderRadius: RADIUS,
                border: `1px solid ${BORDER}`,
                backgroundColor: SURFACE,
                color: TEXT_MD,
                fontSize: '0.6875rem',
                letterSpacing: '0.02em',
                cursor: 'pointer',
                fontFamily: FONT,
                whiteSpace: 'nowrap',
                transition: 'background-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = BORDER; e.currentTarget.style.color = TEXT_HI; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SURFACE; e.currentTarget.style.color = TEXT_MD; }}
            >
              <Upload size="0.8125rem" strokeWidth={2.5} />
              Importar Ficha
            </button>
          </div>

          <div className="flex items-center shrink-0" style={{ margin: '0.5rem', gap: '0.375rem', height: '1.625rem', padding: '0 0.5rem', borderRadius: RADIUS, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
            <Search size="0.75rem" color={TEXT_LO} style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={buscaTrem}
              onChange={(e) => setBuscaTrem(e.target.value)}
              placeholder="Buscar trem..."
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: TEXT_HI, fontSize: '0.6875rem', fontFamily: FONT }}
            />
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {fichasFiltradas.length === 0 ? (
              <p style={{ padding: '0.75rem 0.625rem', fontSize: '0.6875rem', color: TEXT_LO, fontFamily: FONT }}>
                Nenhuma ficha encontrada.
              </p>
            ) : (
              fichasFiltradas.map((f) => (
                <LinhaFicha
                  key={f.id}
                  ficha={f}
                  ativa={f.id === fichaSelecionadaId}
                  validada={!!validadas[f.id]}
                  onClick={() => setFichaSelecionadaId(f.id)}
                />
              ))
            )}
          </div>

          {/* Item de navegação pra Lixeira — mesmo padrão do Gmail (ícone + label + contador,
             na lista de pastas, não um botão de ação). Visualmente mais discreto que os botões
             do header (sem borda/preenchimento), coerente com o resto desta coluna. Wrapper com
             `padding: 12` + `borderTop` reproduz exatamente a mesma "moldura" da seção do
             usuário (Carlos Eduardo) no menu lateral principal — mesma altura de área (56px:
             12 + 32 do botão + 12), pra as duas linhas divisórias ficarem alinhadas na tela. */}
          <div className="shrink-0" style={{ padding: '0.75rem', borderTop: `1px solid ${BORDER}` }}>
            <button
              onClick={() => setLixeiraAberta(true)}
              className="flex items-center w-full"
              style={{
                gap: '0.5rem',
                height: '2rem',
                padding: '0 0.625rem',
                border: 'none',
                borderRadius: RADIUS,
                background: 'transparent',
                color: TEXT_MD,
                fontSize: '0.75rem',
                fontFamily: FONT,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = HOVER_TINT; e.currentTarget.style.color = TEXT_HI; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = TEXT_MD; }}
            >
              <Trash2 size="0.875rem" strokeWidth={2.25} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Lixeira
              </span>
              {fichasLixeira.length > 0 && (
                <span
                  style={{
                    flexShrink: 0,
                    minWidth: '1.125rem',
                    height: '1.125rem',
                    padding: '0 0.3125rem',
                    borderRadius: '62.4375rem',
                    backgroundColor: SURFACE,
                    border: `1px solid ${BORDER}`,
                    color: TEXT_MD,
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {fichasLixeira.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Detalhe — filtros/resumo + tabela de composição, ocupando o restante da largura. */}
        {fichaSelecionada ? (
          <DetalheFicha
            ficha={fichaSelecionada}
            validada={validadaSelecionada}
            onAtualizarAcoes={(acoes) => onAtualizarAcoes(fichaSelecionada.id, acoes)}
            onAtualizarCorrecoes={(c) => onAtualizarCorrecoes(fichaSelecionada.id, c)}
            onExcluir={handleExcluir}
            onRevisar={() => setDesfazerOpen(true)}
          />
        ) : (
          <DetalheVazio />
        )}
      </div>
      )}

      <ImportarFichaModal
        isOpen={importarOpen}
        onClose={() => setImportarOpen(false)}
        onImportar={handleSalvarNovaFicha}
      />

      <ConfirmarTodasModal
        isOpen={confirmarTodasOpen}
        fichas={fichasPendentesDia}
        onClose={() => setConfirmarTodasOpen(false)}
        onConfirmar={handleConfirmarTodas}
      />

      {fichaSelecionada && (
        <>
          <ConfirmarFichaModal
            isOpen={confirmarOpen}
            ficha={fichaSelecionada}
            onClose={() => setConfirmarOpen(false)}
            onBaixarPdf={() => imprimirComPagina('landscape', 12)}
            onConfirmar={() => {
              onValidarFicha(fichaSelecionada.id, true);
              setConfirmarOpen(false);
            }}
          />

          <DesfazerConfirmacaoModal
            isOpen={desfazerOpen}
            ficha={fichaSelecionada}
            onClose={() => setDesfazerOpen(false)}
            onDesfazer={() => {
              onValidarFicha(fichaSelecionada.id, false);
              setDesfazerOpen(false);
            }}
          />
        </>
      )}

      {fichaParaExcluirDefinitivo && (
        <ExcluirDefinitivamenteModal
          isOpen
          ficha={fichaParaExcluirDefinitivo}
          onClose={() => setFichaParaExcluirDefinitivo(null)}
          onExcluir={() => {
            onExcluirDefinitivamente(fichaParaExcluirDefinitivo.id);
            setFichaParaExcluirDefinitivo(null);
          }}
        />
      )}
    </div>
  );
}
