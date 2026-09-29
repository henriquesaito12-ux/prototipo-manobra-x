// Painel lateral "Ações operacionais" da aba Trem — substitui o antigo modal (2026-09-29, pedido
// explícito do usuário). Mesmo componente/padrão do painel de filtro (`PainelLateralShell`):
// empurra o conteúdo pra esquerda em telas largas, vira overlay com scrim abaixo de 1280px.
//
// É uma construção NOVA, não reaproveita `AcoesOperacionaisForm` (que continua servindo o fluxo
// de importação/cadastro manual, fora do escopo — mesmo modelo de dados, `AcoesOperacionais`,
// mas layout e cores próprios daqui: vermelho pra retirada, verde pra inclusão, sem laranja).
//
// Layout denso (2º ajuste do usuário): cada retirada/inclusão é UMA linha de 36px, de ponta a
// ponta, separada por divisor fino — sem cartões nem caixas aninhadas; títulos de seção sticky.
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ListChecks, Lock, MessageSquare, Minus, Plus, Search, X } from 'lucide-react';
import { HeaderTooltip } from '../PageHeader';
import {
  blocosDaComposicao,
  mesmoVeiculo,
  novoIdAcao,
  rotuloVeiculo,
  type AcoesOperacionais,
  type DadosFichaLeitura,
  type InclusaoBloco,
  type RetiradaVagao,
  type VeiculoComposicao,
} from '../../data/fichaModelo';
import { BotaoFicha, IdVeiculo, PainelLateralShell, T } from './fichaUi';

export type ModoAberturaAcoes = 'topo' | 'retirar' | 'incluir';
/** `nonce` incrementa a cada abertura — reabrir no MESMO modo (ex.: clicar "Retirar vagões" duas
 *  vezes) precisa focar de novo, e um `useEffect` só reroda quando alguma dependência muda. */
export interface AberturaAcoes { modo: ModoAberturaAcoes; nonce: number }

const LARGURA_PAINEL = '26.25rem'; // ~420px de design
/** Padding horizontal das linhas e títulos (14px). */
const PX = '0.875rem';
const ALTURA_LINHA = '2.25rem'; // 36px
const LARGURA_POS = '1.5rem';
const GAP = '0.5rem';

const campoEstilo: React.CSSProperties = {
  height: '1.75rem',
  padding: '0 0.4375rem',
  borderRadius: '0.25rem',
  border: `1px solid ${T.border}`,
  backgroundColor: T.panel,
  color: T.hi,
  fontSize: '0.75rem',
  fontFamily: T.font,
  outline: 'none',
  minWidth: 0,
};

const botaoIcone: React.CSSProperties = {
  position: 'relative',
  width: '1.625rem',
  height: '1.625rem',
  border: 'none',
  borderRadius: '0.25rem',
  background: 'transparent',
  color: T.lo,
  cursor: 'pointer',
  flexShrink: 0,
};

const linhaEstilo: React.CSSProperties = { height: ALTURA_LINHA, padding: `0 ${PX}`, gap: GAP };

function MsgErroLinha({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center" style={{ gap: '0.25rem', fontSize: '0.625rem', fontWeight: 600, color: T.danger, fontFamily: T.font }}>
      <AlertCircle size="0.6875rem" strokeWidth={2.5} style={{ flexShrink: 0 }} />
      {children}
    </div>
  );
}

function BotaoRemover({ onClick, rotulo }: { onClick: () => void; rotulo: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={rotulo} className="flex items-center justify-center vli-btn-remover" style={botaoIcone}>
      <X size="0.8125rem" />
    </button>
  );
}

/** Título de seção: fica preso no topo da área de rolagem enquanto a seção está visível (sticky
 *  é relativo ao pai — a própria seção —, então ele sai junto quando a seção termina). */
function TituloSecao({ icone: Icone, cor, corBg, titulo, contagem, apoio }: {
  icone: typeof Minus;
  cor: string;
  corBg: string;
  titulo: string;
  contagem: number;
  /** Sem apoio (ficha confirmada): a instrução de edição não se aplica, então some. */
  apoio?: string;
}) {
  return (
    <>
      <div className="flex items-center" style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: T.panel, gap: '0.375rem', padding: `0.625rem ${PX} 0.25rem` }}>
        <Icone size="0.875rem" color={cor} strokeWidth={2.5} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: T.hi, fontFamily: T.font }}>{titulo}</span>
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, lineHeight: '1rem', color: cor, backgroundColor: corBg, borderRadius: '62.4375rem', padding: '0 0.375rem', fontFamily: T.font, fontVariantNumeric: 'tabular-nums' }}>{contagem}</span>
      </div>
      {apoio && <p title={apoio} style={{ margin: 0, padding: `0 ${PX} 0.5rem`, fontSize: '0.75rem', color: T.md, fontFamily: T.font, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{apoio}</p>}
    </>
  );
}

function TextoVazio({ children }: { children: React.ReactNode }) {
  return <span style={{ display: 'block', padding: `0.25rem ${PX} 0.375rem`, fontSize: '0.75rem', color: T.lo, fontFamily: T.font }}>{children}</span>;
}

// ---------------------------------------------------------------------------------------
// Seção "Vagões a retirar"
// ---------------------------------------------------------------------------------------

/** Busca de vagão da composição — só vagão (locomotiva não entra), só os ainda não retirados. */
function BuscaRetirar({ dados, jaRetirados, onEscolher, inputRef }: {
  dados: DadosFichaLeitura;
  jaRetirados: RetiradaVagao[];
  onEscolher: (v: VeiculoComposicao) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);

  const jaNaLista = (v: VeiculoComposicao) => jaRetirados.some((r) => mesmoVeiculo(r.numero, v.numero));
  const termo = q.trim().toLowerCase();
  // Sem limite de linhas — a lista já rola dentro do próprio dropdown (pedido explícito do
  // usuário: "pode mostrar todas as linhas, não tem problema").
  const opcoes = dados.composicao
    .filter((v) => v.tipo === 'vagao')
    .filter((v) => !termo || rotuloVeiculo(v).toLowerCase().includes(termo) || String(v.posicao) === termo);
  const escolhiveis = opcoes.filter((v) => !jaNaLista(v));

  const escolher = (v: VeiculoComposicao) => {
    if (jaNaLista(v)) return;
    onEscolher(v);
    setQ('');
    setDestaque(0);
    inputRef.current?.focus();
  };

  return (
    <div style={{ position: 'relative' }}>
      <div className="flex items-center" style={{ height: '2rem', padding: '0 0.5rem', gap: '0.375rem', border: `1px solid ${aberto ? T.azul : T.border}`, borderRadius: '0.25rem', backgroundColor: T.panel }}>
        <Search size="0.75rem" color={T.lo} style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setAberto(true); setDestaque(0); }}
          onFocus={() => setAberto(true)}
          onBlur={() => setAberto(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setDestaque((d) => Math.min(d + 1, escolhiveis.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setDestaque((d) => Math.max(d - 1, 0)); }
            else if (e.key === 'Enter' && escolhiveis[destaque]) { e.preventDefault(); escolher(escolhiveis[destaque]); }
            else if (e.key === 'Escape') setAberto(false);
          }}
          placeholder="Buscar por número ou posição…"
          aria-label="Buscar vagão da composição para retirar"
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: T.hi, fontSize: '0.75rem', fontFamily: T.font }}
        />
      </div>
      {aberto && (
        <div role="listbox" style={{ position: 'absolute', zIndex: 50, top: 'calc(100% + 0.25rem)', left: 0, right: 0, backgroundColor: T.panel, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: 'var(--vli-shadow), 0 0.5rem 1.5rem rgba(0,0,0,0.18)', padding: '0.25rem', maxHeight: '14rem', overflowY: 'auto' }}>
          {opcoes.length === 0 ? (
            <div style={{ padding: '0.625rem', fontSize: '0.6875rem', color: T.lo, fontFamily: T.font }}>Nenhum vagão da composição corresponde.</div>
          ) : (
            opcoes.map((v) => {
              const usado = jaNaLista(v);
              const ativo = !usado && escolhiveis[destaque] === v;
              return (
                <div
                  key={`${v.posicao}-${v.numero}`}
                  role="option"
                  aria-selected={ativo}
                  aria-disabled={usado}
                  onMouseDown={(e) => { e.preventDefault(); escolher(v); }}
                  className="flex items-center"
                  style={{ gap: '0.5rem', padding: '0.375rem 0.5rem', borderRadius: '0.25rem', cursor: usado ? 'not-allowed' : 'pointer', backgroundColor: ativo ? T.hover : 'transparent', opacity: usado ? 0.5 : 1, fontSize: '0.75rem', fontFamily: T.font }}
                >
                  <span style={{ width: '1.75rem', color: T.lo, fontVariantNumeric: 'tabular-nums', fontSize: '0.6875rem' }}>#{v.posicao}</span>
                  <IdVeiculo serie={v.serie} numero={v.numero} />
                  <span style={{ color: T.lo, fontSize: '0.6875rem', marginLeft: 'auto' }}>{usado ? 'Já retirado' : v.bloco}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/** Uma linha: posição · veículo · bloco · remover (editável) — ou posição · veículo · bloco ·
 *  motivo (ou "—") · ícone de observação com tooltip quando existir (ficha confirmada: mostra
 *  tudo como texto, sem perder informação, mas sem nada clicável pra editar). */
function ItemRetirada({ r, veiculo, editavel, destacado, onRemover }: {
  r: RetiradaVagao;
  veiculo?: VeiculoComposicao;
  editavel: boolean;
  destacado: boolean;
  onRemover: () => void;
}) {
  const serie = r.serie || veiculo?.serie || '';
  const posicao = veiculo?.posicao ?? r.posicao;
  const temObs = r.observacao.trim().length > 0;

  return (
    <div id={`acoes-ret-${r.id}`} style={{ borderTop: `1px solid ${T.divisor}`, backgroundColor: destacado ? T.dangerBg : 'transparent', transition: 'background-color 0.6s ease-out', fontFamily: T.font }}>
      <div className="flex items-center" style={linhaEstilo}>
        <span style={{ width: LARGURA_POS, flexShrink: 0, fontSize: '0.75rem', color: T.sutil, fontVariantNumeric: 'tabular-nums' }}>{posicao ?? '—'}</span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {serie && <span style={{ fontSize: '0.6875rem', color: T.sutil, marginRight: '0.25rem' }}>{serie}</span>}
          <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: T.hi, fontVariantNumeric: 'tabular-nums' }}>{r.numero}</span>
        </span>
        <span style={{ width: '3.25rem', flexShrink: 0, fontSize: '0.75rem', color: T.md, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{veiculo?.bloco ?? '—'}</span>
        {editavel ? (
          <BotaoRemover onClick={onRemover} rotulo={`Remover ${r.numero} da lista`} />
        ) : (
          <>
            <span style={{ width: '6rem', flexShrink: 0, fontSize: '0.75rem', color: r.motivo ? T.md : T.lo, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.motivo || '—'}</span>
            {temObs ? (
              <HeaderTooltip label={r.observacao}>
                <MessageSquare size="0.8125rem" color={T.azul} style={{ flexShrink: 0, cursor: 'help' }} aria-label={`Observação: ${r.observacao}`} />
              </HeaderTooltip>
            ) : (
              <span style={{ width: '0.8125rem', flexShrink: 0 }} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SecaoRetirar({ dados, acoes, onAcoesChange, editavel, destaqueId, buscaRef }: {
  dados: DadosFichaLeitura;
  acoes: AcoesOperacionais;
  onAcoesChange: (a: AcoesOperacionais) => void;
  editavel: boolean;
  destaqueId: string | null;
  buscaRef: React.RefObject<HTMLInputElement | null>;
}) {
  const retiradas = acoes.retiradas;
  const veiculoDe = (numero: string) => dados.composicao.find((v) => mesmoVeiculo(v.numero, numero));

  const adicionar = (v: VeiculoComposicao) => {
    onAcoesChange({ ...acoes, retiradas: [...retiradas, { id: novoIdAcao('ret'), numero: v.numero, serie: v.serie, posicao: v.posicao, motivo: '', observacao: '' }] });
  };
  const remover = (id: string) => onAcoesChange({ ...acoes, retiradas: retiradas.filter((r) => r.id !== id) });

  return (
    <section>
      <TituloSecao icone={Minus} cor={T.danger} corBg={T.dangerBg} titulo="Vagões a retirar" contagem={retiradas.length} apoio={editavel ? 'Busque na composição ou clique nos vagões da tabela ao lado.' : undefined} />

      {editavel && (
        <div style={{ padding: `0 ${PX} 0.5rem` }}>
          <BuscaRetirar dados={dados} jaRetirados={retiradas} onEscolher={adicionar} inputRef={buscaRef} />
        </div>
      )}

      {retiradas.length === 0 ? (
        <TextoVazio>Nenhum vagão selecionado.</TextoVazio>
      ) : (
        retiradas.map((r) => (
          <ItemRetirada
            key={r.id}
            r={r}
            veiculo={veiculoDe(r.numero)}
            editavel={editavel}
            destacado={destaqueId === r.id}
            onRemover={() => remover(r.id)}
          />
        ))
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------
// Seção "Inclusões por bloco"
// ---------------------------------------------------------------------------------------

/** Até 3 blocos, cada um em UMA linha própria (sem duplicar bloco entre linhas — é essa
 *  ambiguidade, junto com a soma automática de pedidos "iguais", que causava o comportamento
 *  estranho ao clicar em "Adicionar inclusão"). Bloco e quantidade se editam direto na própria
 *  linha, sem soma nem mesclagem: cada linha é sempre a sua própria entrada. */
const MAX_INCLUSOES = 3;

function SecaoInclusoes({ acoes, onAcoesChange, blocos, editavel, adicionarRef }: {
  acoes: AcoesOperacionais;
  onAcoesChange: (a: AcoesOperacionais) => void;
  blocos: string[];
  editavel: boolean;
  adicionarRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const inclusoes = acoes.inclusoes;
  // Texto em edição da quantidade (permite apagar o campo antes de digitar de novo); só vira valor
  // do modelo quando for um inteiro >= 1 válido — inválido fica só aqui até corrigir ou sair do campo.
  const [quantidadeTexto, setQuantidadeTexto] = useState<Record<string, string>>({});

  const patch = (id: string, p: Partial<InclusaoBloco>) => onAcoesChange({ ...acoes, inclusoes: inclusoes.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  const remover = (id: string) => {
    setQuantidadeTexto((s) => { const n = { ...s }; delete n[id]; return n; });
    onAcoesChange({ ...acoes, inclusoes: inclusoes.filter((i) => i.id !== id) });
  };

  const blocosUsados = inclusoes.map((i) => i.bloco);
  const opcoesBloco = (atual: string) => blocos.filter((b) => b === atual || !blocosUsados.includes(b));
  const adicionar = () => {
    const bloco = blocos.find((b) => !blocosUsados.includes(b)) ?? blocos[0] ?? '';
    onAcoesChange({ ...acoes, inclusoes: [...inclusoes, { id: novoIdAcao('inc'), bloco, quantidade: 1, serie: '', observacao: '' }] });
  };

  const textoQtd = (inc: InclusaoBloco) => quantidadeTexto[inc.id] ?? String(inc.quantidade);
  const erroQtd = (texto: string) => (/^\d+$/.test(texto.trim()) && Number(texto.trim()) >= 1 ? undefined : 'Informe um número inteiro maior que zero.');
  const mudarQuantidade = (inc: InclusaoBloco, texto: string) => {
    setQuantidadeTexto((s) => ({ ...s, [inc.id]: texto }));
    if (!erroQtd(texto)) patch(inc.id, { quantidade: Number(texto.trim()) });
  };
  const finalizarQuantidade = (id: string) => setQuantidadeTexto((s) => { const n = { ...s }; delete n[id]; return n; });

  const semBlocos = blocos.length === 0;
  const atingiuMaximo = inclusoes.length >= MAX_INCLUSOES;

  return (
    <section>
      <TituloSecao icone={Plus} cor={T.incluir} corBg={T.incluirBg} titulo="Inclusões por bloco" contagem={inclusoes.length} apoio="Os vagões serão escolhidos pelo plano entre os disponíveis no pátio." />

      {inclusoes.length === 0 ? (
        <TextoVazio>Nenhuma inclusão.</TextoVazio>
      ) : (
        inclusoes.map((inc) => {
          if (!editavel) {
            return (
              <div key={inc.id} className="flex items-center" style={{ ...linhaEstilo, borderTop: `1px solid ${T.divisor}`, fontSize: '0.75rem', color: T.md, fontFamily: T.font }}>
                <span style={{ width: '6.5rem', color: T.hi, fontWeight: 500 }}>{inc.bloco}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{inc.quantidade} {inc.quantidade === 1 ? 'vagão' : 'vagões'}</span>
                {inc.serie && <span>{inc.serie}</span>}
              </div>
            );
          }
          const texto = textoQtd(inc);
          const emEdicao = quantidadeTexto[inc.id] !== undefined;
          const erro = emEdicao ? erroQtd(texto) : undefined;
          return (
            <div key={inc.id} style={{ borderTop: `1px solid ${T.divisor}` }}>
              <div className="flex items-center" style={linhaEstilo}>
                <select
                  value={inc.bloco}
                  onChange={(e) => patch(inc.id, { bloco: e.target.value })}
                  aria-label="Bloco"
                  style={{ ...campoEstilo, width: '6.5rem', flexShrink: 0 }}
                >
                  {opcoesBloco(inc.bloco).map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={texto}
                  onChange={(e) => mudarQuantidade(inc, e.target.value)}
                  onBlur={() => finalizarQuantidade(inc.id)}
                  aria-label="Quantidade de vagões"
                  aria-invalid={!!erro}
                  style={{ ...campoEstilo, width: '3.5rem', flexShrink: 0, textAlign: 'center', borderColor: erro ? T.danger : T.border }}
                />
                <span style={{ flex: 1, fontSize: '0.75rem', color: T.lo, fontFamily: T.font }}>{inc.quantidade === 1 ? 'vagão' : 'vagões'}</span>
                <BotaoRemover onClick={() => remover(inc.id)} rotulo="Remover inclusão" />
              </div>
              {erro && (
                <div style={{ padding: `0 ${PX} 0.375rem` }}>
                  <MsgErroLinha>{erro}</MsgErroLinha>
                </div>
              )}
            </div>
          );
        })
      )}

      {editavel && (
        <div style={{ padding: `0.375rem ${PX} 0.75rem`, borderTop: inclusoes.length > 0 ? `1px solid ${T.divisor}` : undefined }}>
          {atingiuMaximo ? (
            <span style={{ fontSize: '0.75rem', color: T.lo, fontFamily: T.font }}>Máximo de {MAX_INCLUSOES} blocos.</span>
          ) : (
            <button
              ref={adicionarRef}
              type="button"
              onClick={adicionar}
              disabled={semBlocos}
              className="inline-flex items-center"
              style={{
                gap: '0.3125rem',
                height: '1.625rem',
                padding: '0 0.625rem',
                borderRadius: '0.25rem',
                border: `1px solid color-mix(in srgb, ${T.incluir} 35%, transparent)`,
                backgroundColor: 'transparent',
                color: semBlocos ? T.lo : T.incluir,
                fontSize: '0.75rem',
                fontWeight: 600,
                fontFamily: T.font,
                cursor: semBlocos ? 'not-allowed' : 'pointer',
                opacity: semBlocos ? 0.6 : 1,
              }}
            >
              <Plus size="0.75rem" strokeWidth={2.5} />
              Adicionar inclusão
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------------------

/** Contador do header ("− 3" / "+ 2") — clicar rola o corpo até a seção. */
function ContadorHeader({ sinal, n, cor, onClick, rotulo }: { sinal: string; n: number; cor: string; onClick: () => void; rotulo: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      style={{ height: '1.25rem', padding: '0 0.4375rem', border: 'none', borderRadius: '62.4375rem', backgroundColor: `color-mix(in srgb, ${cor} 10%, transparent)`, color: cor, fontSize: '0.6875rem', fontWeight: 700, fontFamily: T.font, fontVariantNumeric: 'tabular-nums', cursor: 'pointer', flexShrink: 0 }}
    >
      {sinal} {n}
    </button>
  );
}

export function PainelAcoesOperacionais({
  dados,
  acoes,
  onAcoesChange,
  editavel,
  aberto,
  abertura,
  destaqueRetiradaId,
  onLimparDestaque,
  onFechar,
  onRevisarFicha,
}: {
  dados: DadosFichaLeitura;
  acoes: AcoesOperacionais;
  onAcoesChange: (a: AcoesOperacionais) => void;
  /** Falso com a ficha confirmada: painel abre só pra consulta (sem busca/remover/adicionar). */
  editavel: boolean;
  aberto: boolean;
  abertura: AberturaAcoes;
  /** Id da retirada recém-adicionada pela composição — o painel rola até ela e a destaca. */
  destaqueRetiradaId: string | null;
  onLimparDestaque: () => void;
  onFechar: () => void;
  /** Dispara a mesma ação do botão "Ficha Confirmada — Revisar" do topo da tela — usado pelo link
   *  do aviso de somente leitura, quando a ficha está confirmada. */
  onRevisarFicha: () => void;
}) {
  const buscaRef = useRef<HTMLInputElement>(null);
  const corpoRef = useRef<HTMLDivElement>(null);
  const retirarRef = useRef<HTMLDivElement>(null);
  const inclusoesRef = useRef<HTMLDivElement>(null);
  const adicionarRef = useRef<HTMLButtonElement>(null);

  /** Rola só o corpo do painel (scrollIntoView arrastaria também os contêineres de fora). */
  const rolarPara = (alvo: HTMLElement | null, centralizar = false) => {
    const corpo = corpoRef.current;
    if (!corpo || !alvo) return;
    const caixa = alvo.getBoundingClientRect();
    const recuo = centralizar ? (corpo.clientHeight - caixa.height) / 2 : 0;
    corpo.scrollTo({ top: corpo.scrollTop + caixa.top - corpo.getBoundingClientRect().top - recuo, behavior: 'smooth' });
  };

  // Cada abertura (nonce novo) leva o painel pro ponto certo: busca em foco (retirar), seção de
  // inclusões com foco no "Adicionar" (incluir), ou topo (editar / clique na linha da tabela).
  useEffect(() => {
    if (!aberto) return;
    if (abertura.modo === 'retirar') {
      const t = setTimeout(() => buscaRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    if (abertura.modo === 'incluir') {
      rolarPara(inclusoesRef.current);
      const t = setTimeout(() => adicionarRef.current?.focus({ preventScroll: true }), 260);
      return () => clearTimeout(t);
    }
    corpoRef.current?.scrollTo({ top: 0 });
  }, [aberto, abertura.nonce, abertura.modo]);

  // Vagão retirado clicando na composição: rola até o item e o destaca por um instante, sem
  // roubar o foco (pedido explícito do usuário).
  useEffect(() => {
    if (!destaqueRetiradaId) return;
    rolarPara(document.getElementById(`acoes-ret-${destaqueRetiradaId}`), true);
    const t = setTimeout(onLimparDestaque, 1600);
    return () => clearTimeout(t);
  }, [destaqueRetiradaId, onLimparDestaque]);

  const blocos = blocosDaComposicao(dados.composicao);

  return (
    <PainelLateralShell
      aberto={aberto}
      onFechar={onFechar}
      ariaLabel="Ações operacionais"
      largura={LARGURA_PAINEL}
      corpoRef={corpoRef}
      compacto
      titulo={
        <span className="flex items-center" style={{ gap: '0.375rem' }}>
          <ListChecks size="0.875rem" color={T.md} strokeWidth={2.25} />
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.hi }}>Ações operacionais</span>
        </span>
      }
      cabecalhoExtra={
        <span className="flex items-center" style={{ gap: '0.25rem' }}>
          <ContadorHeader sinal="−" n={acoes.retiradas.length} cor={T.danger} onClick={() => rolarPara(retirarRef.current)} rotulo={`${acoes.retiradas.length} vagões a retirar — ir para a seção`} />
          <ContadorHeader sinal="+" n={acoes.inclusoes.length} cor={T.incluir} onClick={() => rolarPara(inclusoesRef.current)} rotulo={`${acoes.inclusoes.length} inclusões — ir para a seção`} />
        </span>
      }
      rodape={
        <div className="flex items-center justify-between" style={{ width: '100%' }}>
          {editavel ? (
            <span className="flex items-center" style={{ gap: '0.3125rem', fontSize: '0.6875rem', fontWeight: 500, color: T.lo, fontFamily: T.font }}>
              <Check size="0.75rem" strokeWidth={2.5} /> Salvo automaticamente
            </span>
          ) : (
            <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: T.lo, fontFamily: T.font }}>Somente leitura</span>
          )}
          <BotaoFicha variante="primario" onClick={onFechar} style={{ height: '1.875rem', padding: '0 1rem' }}>{editavel ? 'Concluir' : 'Fechar'}</BotaoFicha>
        </div>
      }
    >
      {!editavel && (
        <div className="flex items-center flex-wrap" style={{ gap: '0.5rem', margin: `0.625rem ${PX}`, padding: '0.5rem 0.625rem', borderRadius: T.radius, backgroundColor: T.surface, fontFamily: T.font }}>
          <Lock size="0.75rem" color={T.lo} style={{ flexShrink: 0 }} />
          <span style={{ flex: '1 1 auto', fontSize: '0.75rem', color: T.md }}>Ficha confirmada. Para editar, clique em Revisar ficha.</span>
          <button
            type="button"
            onClick={onRevisarFicha}
            style={{ flexShrink: 0, border: 'none', background: 'transparent', padding: 0, fontSize: '0.75rem', fontWeight: 600, color: T.azulTexto, fontFamily: T.font, cursor: 'pointer' }}
          >
            Revisar ficha
          </button>
        </div>
      )}
      <div ref={retirarRef}>
        <SecaoRetirar dados={dados} acoes={acoes} onAcoesChange={onAcoesChange} editavel={editavel} destaqueId={destaqueRetiradaId} buscaRef={buscaRef} />
      </div>
      <div style={{ height: 1, flexShrink: 0, backgroundColor: T.divisor, margin: '0.625rem 0' }} />
      <div ref={inclusoesRef}>
        <SecaoInclusoes acoes={acoes} onAcoesChange={onAcoesChange} blocos={blocos} editavel={editavel} adicionarRef={adicionarRef} />
      </div>
    </PainelLateralShell>
  );
}
