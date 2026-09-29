import { useEffect, useMemo, useState } from 'react';
import { ClipboardPlus, Plus, Trash2, X } from 'lucide-react';
import { HOJE } from '../data/fichaOperacao';
import {
  acoesVazias,
  temErros,
  totaisDaComposicao,
  validarAcoes,
  type AcoesOperacionais,
  type DadosFichaLeitura,
  type NovaFichaDados,
  type TipoVeiculo,
  type VeiculoComposicao,
  type VeiculoPatio,
} from '../data/fichaModelo';
import { CODIGOS_RESTRICAO_CADASTRO, traduzirRestricao } from '../data/glossarioFicha';
import { NOMES_PATIOS } from '../data/patio';
import { FiltroSelect } from './FiltroSelect';
import { DataPickerField, HeaderTooltip } from './PageHeader';
import { AcoesOperacionaisForm } from './ficha/AcoesOperacionaisForm';

const VLI_ORANGE = 'var(--vli-accent)';
const VLI_PRIMARY = 'var(--vli-primary-text)';
const VLI_PRIMARY_SOLID = 'var(--vli-primary)';
const PANEL_BG   = 'var(--vli-panel-bg)';
const SURFACE    = 'var(--vli-surface)';
const BORDER     = 'var(--vli-border)';
const TEXT_HI    = 'var(--vli-text-hi)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
const DANGER_TEXT = 'var(--vli-danger-text)';
const FONT       = 'Manrope, sans-serif';
const RADIUS     = '0.375rem';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSalvar: (dados: NovaFichaDados) => void;
}

const PATIO_OPTIONS = NOMES_PATIOS.map((nome) => ({ value: nome, label: nome }));
const SEM_RESTRICAO = '__nenhuma__';

/** Cadastro manual — fallback para quando os dados do trem não chegaram pela fonte. Gera o mesmo
 *  modelo neutro (`DadosFichaLeitura` + `AcoesOperacionais`) que o upload gera. */
type Aba = 'ficha' | 'patioVagoes' | 'patioLocomotivas' | 'acoes';

const ABAS: Array<{ id: Aba; label: string }> = [
  { id: 'ficha', label: 'Ficha do Trem' },
  { id: 'patioVagoes', label: 'Pátio · Vagões' },
  { id: 'patioLocomotivas', label: 'Pátio · Locomotivas' },
  { id: 'acoes', label: 'Ações Operacionais' },
];

interface LinhaComposicao {
  tipo: TipoVeiculo;
  serie: string;
  numero: string;
  origem: string;
  destino: string;
  mercadoria: string;
  restricao: string;
  observacao: string;
}

function linhaEmBranco(tipo: TipoVeiculo = 'vagao'): LinhaComposicao {
  return { tipo, serie: '', numero: '', origem: '', destino: '', mercadoria: '', restricao: '', observacao: '' };
}

interface LinhaPatio {
  serie: string;
  numero: string;
  linha: string;
  seq: string;
  origem: string;
  destino: string;
  mercadoria: string;
  extra: string;
}

const linhaPatioEmBranco = (): LinhaPatio => ({ serie: '', numero: '', linha: '', seq: '', origem: '', destino: '', mercadoria: '', extra: '' });

function patioParaModelo(l: LinhaPatio, locomotiva: boolean): VeiculoPatio {
  const seq = Number(l.seq);
  return {
    serie: l.serie.trim(),
    numero: l.numero.trim(),
    local: '',
    linha: l.linha.trim(),
    seq: Number.isFinite(seq) && l.seq.trim() ? seq : undefined,
    origem: l.origem.trim() || undefined,
    destino: l.destino.trim() || undefined,
    mercadoria: l.mercadoria.trim() || undefined,
    posicaoTrem: locomotiva ? l.extra.trim() || undefined : undefined,
    bruto: [{ coluna: 'Origem', valor: 'Cadastro manual' }],
  };
}

/** Mesma regra do parser: cada locomotiva abre um bloco novo. */
function montarLeitura(trem: string, os: string, linhas: LinhaComposicao[], patioVagoes: LinhaPatio[], patioLocos: LinhaPatio[]): DadosFichaLeitura {
  let blocoIdx = -1;
  const composicao: VeiculoComposicao[] = linhas
    .filter((l) => l.numero.trim())
    .map((l, i) => {
      if (l.tipo === 'locomotiva' || blocoIdx < 0) blocoIdx = l.tipo === 'locomotiva' ? blocoIdx + 1 : 0;
      return {
        posicao: i + 1,
        tipo: l.tipo,
        serie: l.serie.trim(),
        numero: l.numero.trim(),
        bloco: `Bloco ${String.fromCharCode(65 + Math.max(0, blocoIdx))}`,
        origem: l.origem.trim() || undefined,
        destino: l.destino.trim() || undefined,
        mercadoria: l.mercadoria.trim() || undefined,
        bruto: [{ coluna: 'Origem', valor: 'Cadastro manual' }],
      };
    });
  const primeiroVagao = composicao.find((v) => v.tipo === 'vagao');
  return {
    cabecalho: { trem, os, origem: primeiroVagao?.origem ?? '', destino: primeiroVagao?.destino ?? '' },
    composicao,
    totais: totaisDaComposicao(composicao),
    restricoes: linhas
      .filter((l) => l.numero.trim() && l.restricao)
      .map((l) => ({ posicao: composicao.find((v) => v.numero === l.numero.trim())?.posicao, serie: l.serie.trim(), numero: l.numero.trim(), codigo: l.restricao, observacao: l.observacao.trim() })),
    patioVagoes: patioVagoes.filter((p) => p.numero.trim()).map((p) => patioParaModelo(p, false)),
    patioLocomotivas: patioLocos.filter((p) => p.numero.trim()).map((p) => patioParaModelo(p, true)),
    situacaoVagoes: [],
  };
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: PANEL_BG,
  border: `1px solid ${BORDER}`,
  borderRadius: '0.25rem',
  padding: '0.4375rem 0.5625rem',
  color: TEXT_HI,
  fontSize: '0.75rem',
  fontFamily: FONT,
};

const inputCompactStyle: React.CSSProperties = { ...inputStyle, minWidth: '5rem', padding: '0.3125rem 0.4375rem', fontSize: '0.6875rem' };

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: TEXT_LO, marginBottom: '0.25rem', fontFamily: FONT }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function BotaoRemover({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <HeaderTooltip label={title}><button
      type="button"
      onClick={onClick}
      aria-label={title}
     
      style={{ width: '1.625rem', height: '1.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: TEXT_LO, cursor: 'pointer', borderRadius: '0.25rem', flexShrink: 0 }}
      onMouseEnter={(e) => { e.currentTarget.style.color = DANGER_TEXT; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_LO; }}
    >
      <Trash2 size="0.875rem" />
    </button></HeaderTooltip>
  );
}

function BotaoAdicionar({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center"
      style={{ gap: '0.375rem', marginTop: '0.75rem', border: 'none', background: 'transparent', color: VLI_PRIMARY, fontSize: '0.75rem', letterSpacing: '0.03em', cursor: 'pointer', padding: 0, fontFamily: FONT }}
      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
    >
      <Plus size="0.875rem" strokeWidth={2.5} />
      {children}
    </button>
  );
}

function Explicacao({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '0.75rem', color: TEXT_MD, lineHeight: 1.5, margin: '0 0 0.875rem', fontFamily: FONT, fontWeight: 500 }}>{children}</p>;
}

function TabelaPatioEditavel({ linhas, locomotivas, onChange }: { linhas: LinhaPatio[]; locomotivas: boolean; onChange: (l: LinhaPatio[]) => void }) {
  const colunas: Array<{ key: keyof LinhaPatio; label: string }> = [
    { key: 'linha', label: 'Linha' },
    { key: 'seq', label: 'Posição' },
    { key: 'serie', label: 'Série' },
    { key: 'numero', label: 'Veículo' },
    { key: 'origem', label: 'Origem' },
    { key: 'destino', label: 'Destino' },
    { key: 'mercadoria', label: 'Mercadoria' },
    ...(locomotivas ? [{ key: 'extra' as const, label: 'Posição no trem' }] : []),
  ];
  return (
    <div>
      {linhas.length > 0 && (
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: RADIUS, overflow: 'auto', maxHeight: '17.5rem' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {colunas.map((c) => (
                  <th key={c.key} style={{ textAlign: 'left', padding: '0.375rem 0.4375rem', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: TEXT_LO, borderBottom: `1px solid ${BORDER}`, fontFamily: FONT, backgroundColor: SURFACE, whiteSpace: 'nowrap', position: 'sticky', top: 0 }}>
                    {c.label}
                  </th>
                ))}
                <th style={{ backgroundColor: SURFACE, borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0 }} />
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, idx) => (
                <tr key={idx}>
                  {colunas.map((c) => (
                    <td key={c.key} style={{ padding: '0.25rem', borderBottom: `1px solid ${BORDER}` }}>
                      <input type="text" value={linha[c.key]} onChange={(e) => onChange(linhas.map((l, i) => (i === idx ? { ...l, [c.key]: e.target.value } : l)))} style={inputCompactStyle} />
                    </td>
                  ))}
                  <td style={{ padding: '0.25rem', borderBottom: `1px solid ${BORDER}` }}>
                    <BotaoRemover onClick={() => onChange(linhas.filter((_, i) => i !== idx))} title="Remover linha" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <BotaoAdicionar onClick={() => onChange([...linhas, linhaPatioEmBranco()])}>Adicionar linha</BotaoAdicionar>
    </div>
  );
}

export function CriarFichaManualModal({ isOpen, onClose, onSalvar }: Props) {
  const [aba, setAba] = useState<Aba>('ficha');
  const [trem, setTrem] = useState('');
  const [os, setOs] = useState('');
  const [patioNome, setPatioNome] = useState(NOMES_PATIOS[0]);
  const [data, setData] = useState(HOJE);
  const [linhas, setLinhas] = useState<LinhaComposicao[]>([linhaEmBranco('locomotiva'), linhaEmBranco()]);
  const [patioVagoes, setPatioVagoes] = useState<LinhaPatio[]>([]);
  const [patioLocomotivas, setPatioLocomotivas] = useState<LinhaPatio[]>([]);
  const [acoes, setAcoes] = useState<AcoesOperacionais>(acoesVazias());

  useEffect(() => {
    if (isOpen) {
      setAba('ficha');
      setTrem('');
      setOs('');
      setPatioNome(NOMES_PATIOS[0]);
      setData(HOJE);
      setLinhas([linhaEmBranco('locomotiva'), linhaEmBranco()]);
      setPatioVagoes([]);
      setPatioLocomotivas([]);
      setAcoes(acoesVazias());
    }
  }, [isOpen]);

  const leitura = useMemo(() => montarLeitura(trem.trim(), os.trim(), linhas, patioVagoes, patioLocomotivas), [trem, os, linhas, patioVagoes, patioLocomotivas]);

  if (!isOpen) return null;

  const atualizarLinha = (idx: number, patch: Partial<LinhaComposicao>) => setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const contagemPorAba: Record<Aba, number> = {
    ficha: linhas.filter((l) => l.numero.trim()).length,
    patioVagoes: patioVagoes.filter((v) => v.numero.trim()).length,
    patioLocomotivas: patioLocomotivas.filter((v) => v.numero.trim()).length,
    acoes: acoes.retiradas.length + acoes.inclusoes.length,
  };

  const errosAcoes = temErros(validarAcoes(acoes, leitura.composicao));
  const podeSalvar = trem.trim().length > 0 && os.trim().length > 0 && linhas.length > 0 && linhas.every((l) => l.numero.trim().length > 0) && !errosAcoes;

  const salvar = () => {
    if (!podeSalvar) return;
    onSalvar({ trem: trem.trim(), os: os.trim(), patioNome, data, leitura, acoes });
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center no-print" style={{ zIndex: 200, backgroundColor: 'rgba(0,0,0,0.75)', fontFamily: FONT, padding: '1rem' }}>
      <div style={{ backgroundColor: PANEL_BG, borderRadius: RADIUS, width: '100%', maxWidth: '62rem', maxHeight: '90vh', fontFamily: FONT, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--vli-shadow), 0 0.75rem 2rem rgba(0,0,0,0.3)' }}>
        <div className="flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${BORDER}`, padding: '1.25rem' }}>
          <div className="flex items-center" style={{ gap: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', backgroundColor: VLI_PRIMARY_SOLID, borderRadius: RADIUS, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
              <ClipboardPlus size="1.25rem" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: TEXT_HI, lineHeight: 1.3, fontFamily: FONT }}>Criar Ficha</div>
              <div style={{ fontSize: '0.6875rem', color: TEXT_LO, marginTop: '0.25rem', letterSpacing: '0.03em', fontFamily: FONT, fontWeight: 600 }}>
                Cadastro manual — use quando os dados do trem não chegaram pela integração
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ cursor: 'pointer', border: 'none', background: 'none', padding: '0.25rem', color: TEXT_MD, display: 'flex' }}>
            <X size="1.25rem" />
          </button>
        </div>

        <div className="shrink-0" style={{ padding: '1rem 1.25rem 0' }}>
          <div className="grid grid-cols-4" style={{ gap: '0.625rem' }}>
            <Campo label="Trem"><input type="text" value={trem} onChange={(e) => setTrem(e.target.value)} placeholder="Ex.: R220" style={inputStyle} /></Campo>
            <Campo label="O.S."><input type="text" value={os} onChange={(e) => setOs(e.target.value)} placeholder="Ex.: 9995/2026" style={inputStyle} /></Campo>
            <Campo label="Pátio"><FiltroSelect ariaLabel="Pátio" value={patioNome} onChange={setPatioNome} options={PATIO_OPTIONS} variant="field" /></Campo>
            <Campo label="Data da Ficha"><DataPickerField value={data} onChange={setData} /></Campo>
          </div>
        </div>

        <div className="flex items-center shrink-0" style={{ gap: '0.25rem', padding: '0.875rem 1.25rem 0', borderBottom: `1px solid ${BORDER}`, overflowX: 'auto' }}>
          {ABAS.map((a) => {
            const ativa = aba === a.id;
            const manual = a.id === 'acoes';
            const cor = manual ? VLI_ORANGE : VLI_PRIMARY_SOLID;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                className="flex items-center"
                style={{ gap: '0.375rem', padding: '0.5rem 0.75rem', border: 'none', borderBottom: `0.125rem solid ${ativa ? cor : 'transparent'}`, background: 'transparent', color: manual ? VLI_ORANGE : ativa ? TEXT_HI : TEXT_MD, fontSize: '0.75rem', fontWeight: 700, fontFamily: FONT, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {a.label}
                {contagemPorAba[a.id] > 0 && (
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, color: ativa ? cor : TEXT_LO, backgroundColor: SURFACE, borderRadius: '62.4375rem', padding: '0.0625rem 0.375rem', border: `1px solid ${BORDER}` }}>
                    {contagemPorAba[a.id]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {aba === 'ficha' && (
            <>
              <Explicacao>Cadastre a composição na ordem do trem (cabeça → cauda). Cada locomotiva abre um novo bloco; as restrições entram por veículo.</Explicacao>
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: RADIUS, overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '52rem' }}>
                  <thead>
                    <tr>
                      {['#', 'Tipo', 'Série', 'Veículo', 'Origem', 'Destino', 'Mercadoria', 'Restrição', 'Observação da restrição', ''].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '0.375rem 0.4375rem', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: TEXT_LO, borderBottom: `1px solid ${BORDER}`, fontFamily: FONT, backgroundColor: SURFACE, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '0.25rem 0.4375rem', fontSize: '0.6875rem', color: TEXT_LO, borderBottom: `1px solid ${BORDER}` }}>{idx + 1}</td>
                        <td style={{ padding: '0.25rem', borderBottom: `1px solid ${BORDER}`, width: '8rem' }}>
                          <FiltroSelect ariaLabel="Tipo" value={l.tipo} onChange={(v) => atualizarLinha(idx, { tipo: v as TipoVeiculo })} options={[{ value: 'locomotiva', label: 'Locomotiva' }, { value: 'vagao', label: 'Vagão' }]} variant="field" />
                        </td>
                        {(['serie', 'numero', 'origem', 'destino', 'mercadoria'] as const).map((k) => (
                          <td key={k} style={{ padding: '0.25rem', borderBottom: `1px solid ${BORDER}` }}>
                            <input type="text" value={l[k]} onChange={(e) => atualizarLinha(idx, { [k]: e.target.value })} placeholder={k === 'numero' ? 'Obrigatório' : undefined} style={{ ...inputCompactStyle, borderColor: k === 'numero' && !l.numero.trim() ? DANGER_TEXT : BORDER }} />
                          </td>
                        ))}
                        <td style={{ padding: '0.25rem', borderBottom: `1px solid ${BORDER}`, width: '11rem' }}>
                          <FiltroSelect
                            ariaLabel="Restrição"
                            value={l.restricao || SEM_RESTRICAO}
                            onChange={(v) => atualizarLinha(idx, { restricao: v === SEM_RESTRICAO ? '' : v })}
                            options={[{ value: SEM_RESTRICAO, label: 'Nenhuma' }, ...CODIGOS_RESTRICAO_CADASTRO.map((c) => ({ value: c, label: traduzirRestricao(c).rotulo }))]}
                            variant="field"
                          />
                        </td>
                        <td style={{ padding: '0.25rem', borderBottom: `1px solid ${BORDER}` }}>
                          <input type="text" value={l.observacao} disabled={!l.restricao} onChange={(e) => atualizarLinha(idx, { observacao: e.target.value })} style={{ ...inputCompactStyle, opacity: l.restricao ? 1 : 0.5 }} />
                        </td>
                        <td style={{ padding: '0.25rem', borderBottom: `1px solid ${BORDER}` }}>
                          <BotaoRemover onClick={() => setLinhas((prev) => prev.filter((_, i) => i !== idx))} title="Remover veículo" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <BotaoAdicionar onClick={() => setLinhas((prev) => [...prev, linhaEmBranco()])}>Adicionar veículo</BotaoAdicionar>
            </>
          )}

          {aba === 'patioVagoes' && (
            <>
              <Explicacao>Opcional — onde cada vagão está no pátio (linha e posição na linha).</Explicacao>
              <TabelaPatioEditavel linhas={patioVagoes} locomotivas={false} onChange={setPatioVagoes} />
            </>
          )}

          {aba === 'patioLocomotivas' && (
            <>
              <Explicacao>Opcional — posição das locomotivas no pátio.</Explicacao>
              <TabelaPatioEditavel linhas={patioLocomotivas} locomotivas onChange={setPatioLocomotivas} />
            </>
          )}

          {aba === 'acoes' && (
            leitura.composicao.length === 0 ? (
              <Explicacao>Cadastre a composição na aba "Ficha do Trem" primeiro — as retiradas são escolhidas entre os vagões dela.</Explicacao>
            ) : (
              <AcoesOperacionaisForm acoes={acoes} onChange={setAcoes} dados={leitura} rotuloOk="Sem pendências" />
            )
          )}
        </div>

        <div className="flex items-center shrink-0" style={{ gap: '0.75rem', borderTop: `1px solid ${BORDER}`, padding: '1.25rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ flex: 1, height: '2rem', backgroundColor: 'transparent', border: `1px solid ${BORDER}`, borderRadius: RADIUS, cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '0.05em', color: TEXT_MD, fontFamily: FONT }}
          >
            Cancelar
          </button>
          <HeaderTooltip label={!podeSalvar ? (errosAcoes ? 'Corrija as pendências em Ações Operacionais' : 'Preencha Trem, O.S. e o Veículo de todas as linhas da composição') : undefined}><button
            type="button"
            onClick={salvar}
            disabled={!podeSalvar}
           
            style={{ flex: 1, height: '2rem', backgroundColor: podeSalvar ? VLI_ORANGE : BORDER, border: 'none', borderRadius: RADIUS, cursor: podeSalvar ? 'pointer' : 'not-allowed', fontSize: '0.75rem', letterSpacing: '0.05em', color: podeSalvar ? '#fff' : TEXT_LO, fontFamily: FONT }}
          >
            Salvar Ficha
          </button></HeaderTooltip>
        </div>
      </div>
    </div>
  );
}
