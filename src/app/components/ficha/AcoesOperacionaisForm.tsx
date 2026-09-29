// Formulário de Ações Operacionais — a ÚNICA área de entrada manual da Ficha Operacional. Usado
// igual no fluxo de importação (pré-preenchido pela aba da planilha) e na tela principal (a
// qualquer momento; é o que continua existindo quando a fonte for o UNILOG, sem upload).
// Visual de "edição ativa" (laranja) para nunca se confundir com as abas de leitura.
import { useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Lock, Minus, PackagePlus, PackageMinus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  mesmoVeiculo,
  novoIdAcao,
  restricaoDoVeiculo,
  rotuloVeiculo,
  temErros,
  validarAcoes,
  blocosDaComposicao,
  pedidoValido,
  salvarPedidoInclusao,
  validarPedidoInclusao,
  type AcoesOperacionais,
  type ErrosPedidoInclusao,
  type PedidoInclusao,
  type DadosFichaLeitura,
  type InclusaoBloco,
  type RetiradaVagao,
  type VeiculoComposicao,
} from '../../data/fichaModelo';
import { MOTIVOS_RETIRADA, traduzirRestricao } from '../../data/glossarioFicha';
import { FiltroSelect } from '../FiltroSelect';
import { ICONE_RESTRICAO, IdVeiculo, Pill, T, TOM_RESTRICAO, tdStyle, thStyle } from './fichaUi';
import { HeaderTooltip } from '../PageHeader';

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: '1.875rem',
  backgroundColor: T.panel,
  border: `1px solid ${T.border}`,
  borderRadius: '0.25rem',
  padding: '0 0.5rem',
  color: T.hi,
  fontSize: '0.75rem',
  fontFamily: T.font,
  outline: 'none',
};

const QUALQUER = '__qualquer__';

function BotaoIcone({ onClick, rotulo, children, perigo = false }: { onClick: () => void; rotulo: string; children: React.ReactNode; perigo?: boolean }) {
  return (
    <HeaderTooltip label={rotulo}><button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
     
      className="flex items-center justify-center"
      style={{ width: '1.75rem', height: '1.75rem', border: 'none', borderRadius: '0.25rem', background: 'transparent', color: T.lo, cursor: 'pointer', flexShrink: 0 }}
      onMouseEnter={(e) => { e.currentTarget.style.color = perigo ? T.danger : T.hi; e.currentTarget.style.backgroundColor = T.hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = T.lo; e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {children}
    </button></HeaderTooltip>
  );
}

function BotaoAdicionar({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center"
      style={{
        gap: '0.375rem',
        height: '1.875rem',
        padding: '0 0.75rem',
        borderRadius: '0.25rem',
        border: `1px dashed ${T.editBorder}`,
        backgroundColor: T.panel,
        color: disabled ? T.lo : T.edit,
        fontSize: '0.6875rem',
        fontWeight: 700,
        fontFamily: T.font,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Plus size="0.8125rem" strokeWidth={2.5} />
      {children}
    </button>
  );
}

function Subtitulo({ icone: Icone, titulo, contagem, descricao }: { icone: typeof Plus; titulo: string; contagem: number; descricao: string }) {
  return (
    <div style={{ marginBottom: '0.625rem' }}>
      <div className="flex items-center" style={{ gap: '0.375rem' }}>
        <Icone size="0.875rem" color={T.edit} strokeWidth={2.25} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: T.hi, fontFamily: T.font }}>{titulo}</span>
        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: T.edit, backgroundColor: T.editBg, border: `1px solid ${T.editBorder}`, borderRadius: '62.4375rem', padding: '0 0.375rem', fontFamily: T.font }}>{contagem}</span>
      </div>
      <p style={{ margin: '0.25rem 0 0', fontSize: '0.6875rem', color: T.lo, fontFamily: T.font, lineHeight: 1.5, maxWidth: '46rem' }}>{descricao}</p>
    </div>
  );
}

function MsgErro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center" style={{ gap: '0.25rem', marginTop: '0.25rem', fontSize: '0.625rem', fontWeight: 600, color: T.danger, fontFamily: T.font, whiteSpace: 'normal' }}>
      <AlertCircle size="0.6875rem" strokeWidth={2.5} style={{ flexShrink: 0 }} />
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Busca de vagão da composição (não digitar do zero)
// ---------------------------------------------------------------------------------------

function BuscaVagao({ dados, jaSelecionados, onEscolher }: { dados: DadosFichaLeitura; jaSelecionados: RetiradaVagao[]; onEscolher: (v: VeiculoComposicao) => void }) {
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const jaNaLista = (v: VeiculoComposicao) => jaSelecionados.some((r) => mesmoVeiculo(r.numero, v.numero));
  const termo = q.trim().toLowerCase();
  const opcoes = dados.composicao
    .filter((v) => v.tipo === 'vagao')
    .filter((v) => !termo || rotuloVeiculo(v).toLowerCase().includes(termo) || String(v.posicao) === termo)
    .slice(0, 8);
  const escolhiveis = opcoes.filter((v) => !jaNaLista(v));

  const escolher = (v: VeiculoComposicao) => {
    if (jaNaLista(v)) return;
    onEscolher(v);
    setQ('');
    setDestaque(0);
    inputRef.current?.focus();
  };

  return (
    <div style={{ position: 'relative', maxWidth: '26rem' }}>
      <div className="flex items-center" style={{ ...inputStyle, gap: '0.375rem', borderColor: aberto ? T.edit : T.border }}>
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
          placeholder="Buscar vagão da composição por número ou posição…"
          aria-label="Buscar vagão da composição para retirar"
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: T.hi, fontSize: '0.75rem', fontFamily: T.font }}
        />
      </div>
      {aberto && (
        <div
          role="listbox"
          style={{ position: 'absolute', zIndex: 50, top: 'calc(100% + 0.25rem)', left: 0, right: 0, backgroundColor: T.panel, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: 'var(--vli-shadow), 0 0.5rem 1.5rem rgba(0,0,0,0.18)', padding: '0.25rem', maxHeight: '18rem', overflowY: 'auto' }}
        >
          {opcoes.length === 0 ? (
            <div style={{ padding: '0.625rem', fontSize: '0.6875rem', color: T.lo, fontFamily: T.font }}>Nenhum vagão da composição corresponde a “{q}”.</div>
          ) : (
            opcoes.map((v) => {
              const usado = jaNaLista(v);
              const r = restricaoDoVeiculo(dados, v);
              const ativo = !usado && escolhiveis[destaque] === v;
              return (
                <div
                  key={`${v.posicao}-${v.numero}`}
                  role="option"
                  aria-selected={ativo}
                  aria-disabled={usado}
                  onMouseDown={(e) => { e.preventDefault(); escolher(v); }}
                  className="flex items-center"
                  style={{ gap: '0.625rem', padding: '0.375rem 0.5rem', borderRadius: '0.25rem', cursor: usado ? 'not-allowed' : 'pointer', backgroundColor: ativo ? T.hover : 'transparent', opacity: usado ? 0.5 : 1, fontSize: '0.75rem', fontFamily: T.font }}
                >
                  <span style={{ width: '2rem', color: T.lo, fontVariantNumeric: 'tabular-nums', fontSize: '0.6875rem' }}>#{v.posicao}</span>
                  <IdVeiculo serie={v.serie} numero={v.numero} />
                  <span style={{ color: T.lo, fontSize: '0.6875rem' }}>{v.bloco}</span>
                  <span style={{ marginLeft: 'auto' }} className="flex items-center">
                    {usado ? (
                      <span style={{ fontSize: '0.625rem', fontWeight: 600, color: T.lo }}>Já na lista</span>
                    ) : r ? (
                      <Pill tom={TOM_RESTRICAO[traduzirRestricao(r.codigo).nivel]} icone={ICONE_RESTRICAO[traduzirRestricao(r.codigo).nivel]}>{traduzirRestricao(r.codigo).rotulo}</Pill>
                    ) : null}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Formulário
// ---------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------
// Inclusões como PEDIDO (modal da Ficha Operacional) — bloco + quantidade (+ tipo), validados
// antes de salvar: linha inválida mostra a mensagem ao lado do campo e fica só na tela, sem ir
// para as ações salvas; pedido repetido (mesmo bloco + tipo) soma na quantidade existente.
// ---------------------------------------------------------------------------------------

/** O Select (Radix) não aceita valor vazio — "sem bloco" vira este sentinela na tela. */
const SEM_BLOCO = '__sem_bloco__';
const PEDIDO_NOVO: PedidoInclusao = { bloco: '', quantidade: '1', serie: '' };

function InclusoesComoPedido({ inclusoes, onChange, blocos, series, somenteLeitura }: {
  inclusoes: InclusaoBloco[];
  onChange: (inclusoes: InclusaoBloco[]) => void;
  blocos: string[];
  series: string[];
  somenteLeitura: boolean;
}) {
  // Edições inválidas de pedidos já salvos ficam aqui até serem corrigidas (ou a linha removida).
  const [rascunhos, setRascunhos] = useState<Record<string, PedidoInclusao>>({});
  const [novo, setNovo] = useState<PedidoInclusao>(PEDIDO_NOVO);
  const [tentouAdicionar, setTentouAdicionar] = useState(false);

  const valoresDe = (inc: InclusaoBloco): PedidoInclusao => rascunhos[inc.id] ?? { bloco: inc.bloco, quantidade: String(inc.quantidade), serie: inc.serie };
  const semRascunho = (id: string) => setRascunhos((r) => { const n = { ...r }; delete n[id]; return n; });

  const editar = (inc: InclusaoBloco, patch: Partial<PedidoInclusao>) => {
    const p = { ...valoresDe(inc), ...patch };
    if (!pedidoValido(validarPedidoInclusao(p, blocos))) {
      setRascunhos((r) => ({ ...r, [inc.id]: p }));
      return;
    }
    semRascunho(inc.id);
    onChange(salvarPedidoInclusao(inclusoes, p, inc.id));
  };

  const adicionar = () => {
    if (!pedidoValido(validarPedidoInclusao(novo, blocos))) {
      setTentouAdicionar(true);
      return;
    }
    onChange(salvarPedidoInclusao(inclusoes, novo));
    setNovo(PEDIDO_NOVO);
    setTentouAdicionar(false);
  };

  const opcoesBloco = (atual: string) => [
    ...(atual ? [] : [{ value: SEM_BLOCO, label: 'Selecione o bloco…' }]),
    ...Array.from(new Set([...blocos, atual].filter(Boolean))).map((b) => ({ value: b, label: b })),
  ];
  const opcoesSerie = (atual: string) => [{ value: QUALQUER, label: 'Qualquer' }, ...Array.from(new Set([...series, atual].filter(Boolean))).map((s) => ({ value: s, label: s }))];

  const campos = (p: PedidoInclusao, erros: ErrosPedidoInclusao, mudar: (patch: Partial<PedidoInclusao>) => void) => (
    <>
      <td style={tdStyle({ verticalAlign: 'top' })}>
        <FiltroSelect ariaLabel="Bloco" value={p.bloco || SEM_BLOCO} onChange={(b) => mudar({ bloco: b === SEM_BLOCO ? '' : b })} options={opcoesBloco(p.bloco)} variant="field" />
        {erros.bloco && <MsgErro>{erros.bloco}</MsgErro>}
      </td>
      <td style={tdStyle({ verticalAlign: 'top' })}>
        <input
          type="number"
          min={1}
          step={1}
          value={p.quantidade}
          onChange={(e) => mudar({ quantidade: e.target.value })}
          aria-label="Quantidade de vagões"
          style={{ ...inputStyle, width: '6rem', textAlign: 'center', fontWeight: 700 }}
        />
        {erros.quantidade && <MsgErro>{erros.quantidade}</MsgErro>}
      </td>
      <td style={tdStyle({ verticalAlign: 'top' })}>
        <FiltroSelect ariaLabel="Tipo de vagão" value={p.serie || QUALQUER} onChange={(s) => mudar({ serie: s === QUALQUER ? '' : s })} options={opcoesSerie(p.serie)} variant="field" />
      </td>
    </>
  );

  if (somenteLeitura) {
    return inclusoes.length === 0 ? (
      <div style={{ padding: '0.75rem', border: `1px dashed ${T.border}`, borderRadius: T.radius, fontSize: '0.6875rem', color: T.lo, fontFamily: T.font, textAlign: 'center' }}>Nenhuma inclusão.</div>
    ) : (
      <div className="flex flex-col" style={{ gap: '0.25rem', fontSize: '0.75rem', color: T.md, fontFamily: T.font }}>
        {inclusoes.map((i) => <span key={i.id}>{i.bloco} · {i.quantidade} {i.quantidade === 1 ? 'vagão' : 'vagões'}{i.serie ? ` ${i.serie}` : ''}</span>)}
      </div>
    );
  }

  const errosNovo = tentouAdicionar ? validarPedidoInclusao(novo, blocos) : {};
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: T.radius, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '36rem' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '12rem' }}>Bloco</th>
            <th style={{ ...thStyle, width: '9rem' }}>Quantidade</th>
            <th style={thStyle}>Tipo de vagão <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>· opcional</span></th>
            <th style={{ ...thStyle, width: '9.5rem' }} />
          </tr>
        </thead>
        <tbody>
          {inclusoes.map((inc) => {
            const p = valoresDe(inc);
            return (
              <tr key={inc.id}>
                {campos(p, rascunhos[inc.id] ? validarPedidoInclusao(p, blocos) : {}, (patch) => editar(inc, patch))}
                <td style={tdStyle({ verticalAlign: 'top', paddingTop: '0.3125rem' })}>
                  <BotaoIcone perigo rotulo="Remover inclusão" onClick={() => { semRascunho(inc.id); onChange(inclusoes.filter((x) => x.id !== inc.id)); }}>
                    <Trash2 size="0.8125rem" />
                  </BotaoIcone>
                </td>
              </tr>
            );
          })}
          {/* Linha de novo pedido — só entra nas ações ao clicar em "Adicionar inclusão", se válida. */}
          <tr style={{ backgroundColor: 'color-mix(in srgb, var(--vli-surface) 45%, var(--vli-panel-bg))' }}>
            {campos(novo, errosNovo, (patch) => setNovo((n) => ({ ...n, ...patch })))}
            <td style={tdStyle({ verticalAlign: 'top' })}>
              <BotaoAdicionar disabled={blocos.length === 0} onClick={adicionar}>Adicionar inclusão</BotaoAdicionar>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function AcoesOperacionaisForm({
  acoes,
  onChange,
  dados,
  somenteLeitura = false,
  motivoSomenteLeitura,
  rotuloOk = 'Salvo automaticamente',
  notaSubstituicao = true,
  inclusoesComoPedido = false,
}: {
  acoes: AcoesOperacionais;
  onChange: (acoes: AcoesOperacionais) => void;
  dados: DadosFichaLeitura;
  somenteLeitura?: boolean;
  motivoSomenteLeitura?: string;
  rotuloOk?: string;
  /** Frase "cada vagão retirado é substituído…" no texto de retirada. A Ficha Operacional (modal de
   *  Ações operacionais) não mostra; importação e cadastro manual continuam mostrando. */
  notaSubstituicao?: boolean;
  /** Inclusões como PEDIDO (bloco + quantidade, validado antes de salvar, repetido soma) — o
   *  modal da Ficha Operacional usa; importação e cadastro manual seguem com a tabela antiga. */
  inclusoesComoPedido?: boolean;
}) {
  const erros = useMemo(() => validarAcoes(acoes, dados.composicao), [acoes, dados.composicao]);
  const blocos = blocosDaComposicao(dados.composicao);
  const seriesVagao = Array.from(new Set(dados.composicao.filter((v) => v.tipo === 'vagao').map((v) => v.serie))).sort();
  const totalVagoes = dados.composicao.filter((v) => v.tipo === 'vagao').length;
  const qtdErros = Object.keys(erros.retiradas).length + Object.keys(erros.inclusoes).length;
  const adicionais = acoes.inclusoes.reduce((s, i) => s + (Number.isFinite(i.quantidade) ? Math.max(0, i.quantidade) : 0), 0);

  const setRetiradas = (retiradas: RetiradaVagao[]) => onChange({ ...acoes, retiradas });
  const setInclusoes = (inclusoes: InclusaoBloco[]) => onChange({ ...acoes, inclusoes });
  const patchRetirada = (id: string, patch: Partial<RetiradaVagao>) => setRetiradas(acoes.retiradas.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const patchInclusao = (id: string, patch: Partial<InclusaoBloco>) => setInclusoes(acoes.inclusoes.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const adicionarRetirada = (v: VeiculoComposicao) => {
    if (acoes.retiradas.some((r) => mesmoVeiculo(r.numero, v.numero))) return;
    const restricao = restricaoDoVeiculo(dados, v);
    setRetiradas([
      ...acoes.retiradas,
      { id: novoIdAcao('ret'), numero: v.numero, serie: v.serie, posicao: v.posicao, motivo: '', observacao: restricao?.observacao ?? '' },
    ]);
  };

  const sugestoes = dados.composicao.filter((v) => v.tipo === 'vagao' && restricaoDoVeiculo(dados, v) && !acoes.retiradas.some((r) => mesmoVeiculo(r.numero, v.numero)));
  const blocoPadrao = blocos.find((b) => dados.composicao.some((v) => v.bloco === b && v.tipo === 'vagao')) ?? blocos[0] ?? '';

  return (
    <section style={{ border: `1px solid ${T.editBorder}`, borderRadius: T.radius, backgroundColor: T.panel, overflow: 'hidden', flexShrink: 0, boxShadow: `inset 3px 0 0 ${T.edit}` }}>
      <header className="flex flex-wrap items-center justify-between" style={{ gap: '0.375rem 0.875rem', minHeight: '2.125rem', padding: '0.375rem 0.875rem 0.375rem 1.0625rem', backgroundColor: T.editBg, borderBottom: `1px solid ${T.editBorder}` }}>
        <span className="flex items-center" style={{ gap: '0.5rem' }}>
          <span className="flex items-center" style={{ gap: '0.3125rem', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.edit, fontFamily: T.font }}>
            <Pencil size="0.75rem" strokeWidth={2.25} />
            Ações operacionais
          </span>
          <Pill tom="acao">Entrada manual do operador</Pill>
        </span>
        <span className="flex items-center" style={{ gap: '0.3125rem', fontSize: '0.6875rem', fontWeight: 600, fontFamily: T.font, color: somenteLeitura ? T.lo : qtdErros > 0 ? T.danger : T.success }}>
          {somenteLeitura ? (
            <><Lock size="0.75rem" /> {motivoSomenteLeitura ?? 'Somente leitura'}</>
          ) : qtdErros > 0 ? (
            <><AlertCircle size="0.75rem" strokeWidth={2.5} /> {qtdErros} pendência{qtdErros > 1 ? 's' : ''} para corrigir</>
          ) : (
            <><CheckCircle2 size="0.75rem" strokeWidth={2.5} /> {rotuloOk}</>
          )}
        </span>
      </header>

      <div style={{ padding: '0.875rem 0.875rem 0.875rem 1.0625rem' }}>
        {/* ---------------- Vagões a retirar ---------------- */}
        <Subtitulo
          icone={PackageMinus}
          titulo="Vagões a retirar"
          contagem={acoes.retiradas.length}
          descricao={`Selecione na composição os vagões que saem do trem.${notaSubstituicao ? " Cada vagão retirado é substituído por um vagão pronto para tração no mesmo bloco." : ""}`}
        />
        {!somenteLeitura && (
          <div className="flex flex-col" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
            <BuscaVagao dados={dados} jaSelecionados={acoes.retiradas} onEscolher={adicionarRetirada} />
            {sugestoes.length > 0 && (
              <div className="flex flex-wrap items-center" style={{ gap: '0.3125rem', fontSize: '0.625rem', color: T.lo, fontFamily: T.font }}>
                <span>Com restrição na ficha:</span>
                {sugestoes.slice(0, 6).map((v) => (
                  <button
                    key={v.numero}
                    type="button"
                    onClick={() => adicionarRetirada(v)}
                    className="inline-flex items-center"
                    style={{ gap: '0.1875rem', height: '1.25rem', padding: '0 0.4375rem', borderRadius: '0.1875rem', border: `1px dashed ${T.editBorder}`, background: 'transparent', color: T.md, fontSize: '0.625rem', fontWeight: 600, fontFamily: T.font, cursor: 'pointer' }}
                  >
                    <Plus size="0.625rem" strokeWidth={2.5} color={T.edit} />
                    {rotuloVeiculo(v)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {acoes.retiradas.length === 0 ? (
          <div style={{ padding: '0.75rem', border: `1px dashed ${T.border}`, borderRadius: T.radius, fontSize: '0.6875rem', color: T.lo, fontFamily: T.font, textAlign: 'center' }}>
            Nenhum vagão marcado para retirada.
          </div>
        ) : (
          <div style={{ border: `1px solid ${T.border}`, borderRadius: T.radius, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '46rem' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: '3.5rem' }}>Pos.</th>
                  <th style={{ ...thStyle, width: '11rem' }}>Vagão</th>
                  <th style={{ ...thStyle, width: '10rem' }}>Restrição na ficha</th>
                  <th style={{ ...thStyle, width: '13rem' }}>Motivo da retirada</th>
                  <th style={thStyle}>Observação</th>
                  {!somenteLeitura && <th style={{ ...thStyle, width: '2.5rem' }} />}
                </tr>
              </thead>
              <tbody>
                {acoes.retiradas.map((r) => {
                  const v = dados.composicao.find((c) => mesmoVeiculo(c.numero, r.numero));
                  const restr = v ? restricaoDoVeiculo(dados, v) : undefined;
                  const erro = erros.retiradas[r.id];
                  return (
                    <tr key={r.id} style={{ backgroundColor: erro ? T.dangerBg : undefined }}>
                      <td style={tdStyle({ color: T.lo, fontVariantNumeric: 'tabular-nums', verticalAlign: 'top', paddingTop: '0.75rem' })}>{v?.posicao ?? r.posicao ?? '—'}</td>
                      <td style={tdStyle({ verticalAlign: 'top', paddingTop: '0.625rem' })}>
                        <IdVeiculo serie={r.serie || v?.serie || ''} numero={r.numero} />
                        {v && <div style={{ fontSize: '0.625rem', color: T.lo }}>{v.bloco}</div>}
                        {erro && <MsgErro>{erro}</MsgErro>}
                      </td>
                      <td style={tdStyle({ verticalAlign: 'top', paddingTop: '0.625rem' })}>
                        {restr ? (
                          <Pill tom={TOM_RESTRICAO[traduzirRestricao(restr.codigo).nivel]} icone={ICONE_RESTRICAO[traduzirRestricao(restr.codigo).nivel]} dica={restr.observacao}>
                            {traduzirRestricao(restr.codigo).rotulo}
                          </Pill>
                        ) : (
                          <span style={{ color: T.lo }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle({ verticalAlign: 'top' })}>
                        {somenteLeitura ? (
                          <span style={{ color: r.motivo ? T.hi : T.lo }}>{r.motivo || 'Não informado'}</span>
                        ) : (
                          <input
                            list="motivos-retirada"
                            value={r.motivo}
                            onChange={(e) => patchRetirada(r.id, { motivo: e.target.value })}
                            placeholder="Selecione ou digite…"
                            aria-label={`Motivo da retirada do vagão ${r.numero}`}
                            style={inputStyle}
                          />
                        )}
                      </td>
                      <td style={tdStyle({ verticalAlign: 'top', whiteSpace: 'normal' })}>
                        {somenteLeitura ? (
                          <span style={{ color: r.observacao ? T.md : T.lo }}>{r.observacao || '—'}</span>
                        ) : (
                          <input
                            value={r.observacao}
                            onChange={(e) => patchRetirada(r.id, { observacao: e.target.value })}
                            placeholder="Observação (opcional)"
                            aria-label={`Observação da retirada do vagão ${r.numero}`}
                            style={inputStyle}
                          />
                        )}
                      </td>
                      {!somenteLeitura && (
                        <td style={tdStyle({ verticalAlign: 'top', paddingTop: '0.3125rem' })}>
                          <BotaoIcone perigo rotulo={`Remover ${r.numero} da lista`} onClick={() => setRetiradas(acoes.retiradas.filter((x) => x.id !== r.id))}>
                            <Trash2 size="0.8125rem" />
                          </BotaoIcone>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <datalist id="motivos-retirada">
          {MOTIVOS_RETIRADA.map((m) => <option key={m} value={m} />)}
        </datalist>

        <div style={{ height: 1, backgroundColor: T.divisor, margin: '1.125rem 0' }} />

        {/* ---------------- Inclusões ---------------- */}
        <Subtitulo
          icone={PackagePlus}
          titulo={inclusoesComoPedido ? 'Inclusões por bloco' : 'Inclusões adicionais por bloco'}
          contagem={inclusoesComoPedido ? acoes.inclusoes.length : adicionais}
          descricao={
            inclusoesComoPedido
              ? 'Informe o bloco e a quantidade. Os vagões serão escolhidos pelo plano entre os disponíveis no pátio.'
              : 'Vagões a mais, além das substituições dos retirados. Informe o bloco de destino e a quantidade; o tipo de vagão é opcional (vazio = qualquer vagão pronto para tração).'
          }
        />

        {inclusoesComoPedido ? (
          <InclusoesComoPedido inclusoes={acoes.inclusoes} onChange={setInclusoes} blocos={blocos} series={seriesVagao} somenteLeitura={somenteLeitura} />
        ) : acoes.inclusoes.length === 0 ? (
          <div style={{ padding: '0.75rem', border: `1px dashed ${T.border}`, borderRadius: T.radius, fontSize: '0.6875rem', color: T.lo, fontFamily: T.font, textAlign: 'center', marginBottom: somenteLeitura ? 0 : '0.625rem' }}>
            Nenhuma inclusão adicional.
          </div>
        ) : (
          <div style={{ border: `1px solid ${T.border}`, borderRadius: T.radius, overflowX: 'auto', marginBottom: somenteLeitura ? 0 : '0.625rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '40rem' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: '10rem' }}>Bloco de destino</th>
                  <th style={{ ...thStyle, width: '8.5rem' }}>Quantidade</th>
                  <th style={{ ...thStyle, width: '11rem' }}>Tipo de vagão</th>
                  <th style={thStyle}>Observação</th>
                  {!somenteLeitura && <th style={{ ...thStyle, width: '2.5rem' }} />}
                </tr>
              </thead>
              <tbody>
                {acoes.inclusoes.map((inc) => {
                  const erro = erros.inclusoes[inc.id];
                  const opcoesBloco = Array.from(new Set([...blocos, inc.bloco].filter(Boolean)));
                  return (
                    <tr key={inc.id} style={{ backgroundColor: erro ? T.dangerBg : undefined }}>
                      <td style={tdStyle({ verticalAlign: 'top' })}>
                        {somenteLeitura ? (
                          <span style={{ color: T.hi, fontWeight: 600 }}>{inc.bloco}</span>
                        ) : (
                          <FiltroSelect ariaLabel="Bloco de destino" value={inc.bloco} onChange={(b) => patchInclusao(inc.id, { bloco: b })} options={opcoesBloco.map((b) => ({ value: b, label: b }))} variant="field" />
                        )}
                        {erro && <MsgErro>{erro}</MsgErro>}
                      </td>
                      <td style={tdStyle({ verticalAlign: 'top' })}>
                        {somenteLeitura ? (
                          <span style={{ color: T.hi, fontWeight: 700 }}>{inc.quantidade}</span>
                        ) : (
                          <div className="flex items-center" style={{ border: `1px solid ${T.border}`, borderRadius: '0.25rem', height: '1.875rem', width: '7rem', backgroundColor: T.panel }}>
                            <BotaoIcone rotulo="Diminuir" onClick={() => patchInclusao(inc.id, { quantidade: Math.max(1, (inc.quantidade || 1) - 1) })}><Minus size="0.75rem" /></BotaoIcone>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={Number.isFinite(inc.quantidade) ? inc.quantidade : ''}
                              onChange={(e) => patchInclusao(inc.id, { quantidade: e.target.value === '' ? NaN : Number(e.target.value) })}
                              aria-label="Quantidade de vagões a incluir"
                              style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', textAlign: 'center', color: T.hi, fontWeight: 700, fontSize: '0.75rem', fontFamily: T.font, MozAppearance: 'textfield' }}
                            />
                            <BotaoIcone rotulo="Aumentar" onClick={() => patchInclusao(inc.id, { quantidade: (Number.isFinite(inc.quantidade) ? inc.quantidade : 0) + 1 })}><Plus size="0.75rem" /></BotaoIcone>
                          </div>
                        )}
                      </td>
                      <td style={tdStyle({ verticalAlign: 'top' })}>
                        {somenteLeitura ? (
                          <span style={{ color: inc.serie ? T.hi : T.lo }}>{inc.serie || 'Qualquer'}</span>
                        ) : (
                          <FiltroSelect
                            ariaLabel="Tipo de vagão"
                            value={inc.serie || QUALQUER}
                            onChange={(s) => patchInclusao(inc.id, { serie: s === QUALQUER ? '' : s })}
                            options={[{ value: QUALQUER, label: 'Qualquer' }, ...Array.from(new Set([...seriesVagao, inc.serie].filter(Boolean))).map((s) => ({ value: s, label: s }))]}
                            variant="field"
                          />
                        )}
                      </td>
                      <td style={tdStyle({ verticalAlign: 'top', whiteSpace: 'normal' })}>
                        {somenteLeitura ? (
                          <span style={{ color: inc.observacao ? T.md : T.lo }}>{inc.observacao || '—'}</span>
                        ) : (
                          <input value={inc.observacao} onChange={(e) => patchInclusao(inc.id, { observacao: e.target.value })} placeholder="Observação (opcional)" aria-label="Observação da inclusão" style={inputStyle} />
                        )}
                      </td>
                      {!somenteLeitura && (
                        <td style={tdStyle({ verticalAlign: 'top', paddingTop: '0.3125rem' })}>
                          <BotaoIcone perigo rotulo="Remover inclusão" onClick={() => setInclusoes(acoes.inclusoes.filter((x) => x.id !== inc.id))}>
                            <Trash2 size="0.8125rem" />
                          </BotaoIcone>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!somenteLeitura && !inclusoesComoPedido && (
          <BotaoAdicionar
            disabled={blocos.length === 0}
            onClick={() => setInclusoes([...acoes.inclusoes, { id: novoIdAcao('inc'), bloco: blocoPadrao, quantidade: 1, serie: '', observacao: '' }])}
          >
            Adicionar inclusão
          </BotaoAdicionar>
        )}
      </div>

      {/* Resultado previsto — o efeito das decisões acima sobre a composição. */}
      <footer className="flex flex-wrap items-center" style={{ gap: '0.375rem 1rem', padding: '0.625rem 0.875rem 0.625rem 1.0625rem', borderTop: `1px solid ${T.divisor}`, backgroundColor: 'color-mix(in srgb, var(--vli-surface) 50%, var(--vli-panel-bg))', fontSize: '0.6875rem', color: T.md, fontFamily: T.font }}>
        <span style={{ fontWeight: 700, fontSize: '0.5625rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: T.lo }}>Resultado previsto</span>
        <span>{totalVagoes} vagões na ficha</span>
        <span style={{ color: T.danger, fontWeight: 600 }}>−{acoes.retiradas.length} retirados</span>
        <span style={{ color: T.success, fontWeight: 600 }}>+{acoes.retiradas.length} substituições</span>
        <span style={{ color: T.success, fontWeight: 600 }}>+{adicionais} adicionais</span>
        <span className="flex items-center" style={{ gap: '0.25rem', color: T.hi, fontWeight: 700 }}>
          <ArrowRight size="0.75rem" color={T.lo} />
          {totalVagoes + adicionais} vagões após as ações
        </span>
        {temErros(erros) && !somenteLeitura && <span style={{ color: T.danger, fontWeight: 600 }}>· corrija as pendências acima</span>}
      </footer>
    </section>
  );
}
