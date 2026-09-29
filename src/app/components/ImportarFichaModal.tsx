import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  Download,
  FileSpreadsheet,
  TrainFront,
  Upload,
  Warehouse,
  X,
} from 'lucide-react';
import { HOJE } from '../data/fichaOperacao';
import { temErros, validarAcoes, type AcoesOperacionais, type NovaFichaDados } from '../data/fichaModelo';
import {
  ABA_ACOES_OPERACIONAIS,
  ABA_FICHA_DO_TREM,
  ABA_PATIO_LOCOMOTIVAS,
  ABA_PATIO_VAGOES,
  ABA_SITUACAO_VAGOES,
  baixarModeloXlsx,
  FichaImportError,
  parseFichaXlsx,
  type ResultadoImportacao,
} from '../utils/fichaImport';
import { NOMES_PATIOS } from '../data/patio';
import { FiltroSelect } from './FiltroSelect';
import { DataPickerField, HeaderTooltip } from './PageHeader';
import { AcoesOperacionaisForm } from './ficha/AcoesOperacionaisForm';

const VLI_PRIMARY = 'var(--vli-primary-text)';
const VLI_PRIMARY_SOLID = 'var(--vli-primary)';
const PANEL_BG   = 'var(--vli-panel-bg)';
const SURFACE    = 'var(--vli-surface)';
const BORDER     = 'var(--vli-border)';
const TEXT_HI    = 'var(--vli-text-hi)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
const SUCCESS_TEXT = 'var(--vli-success-text)';
const DANGER_TEXT = 'var(--vli-danger-text)';
const DANGER_BG   = 'var(--vli-danger-bg)';
const WARNING_TEXT = 'var(--vli-warning-text)';
const EDIT = 'var(--vli-accent)';
const HOVER_TINT  = 'var(--vli-hover-tint)';
const FONT       = 'Manrope, sans-serif';
const RADIUS     = '0.375rem';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportar: (dados: NovaFichaDados) => void;
}

/** As 5 abas do modelo (`modelo_ficha_operacao.xlsx`). Quatro são LEITURA (exibidas como estão,
 *  no futuro virão do UNILOG); "Ações Operacionais" é ENTRADA MANUAL — no upload só pré-preenche o
 *  formulário, que o operador revisa aqui mesmo antes de importar. */
const ESTRUTURA_ABAS: Array<{ aba: string; manual: boolean; descricao: string; colunas: string[] }> = [
  { aba: ABA_FICHA_DO_TREM, manual: false, descricao: 'Identificação do trem, composição ordenada, totais e restrições por veículo. Obrigatória.', colunas: ['Veiculo', 'Prop', 'Ori', 'Des', 'Mercadoria', 'Tu', 'Tb', 'Restricao', 'Observacao'] },
  { aba: ABA_PATIO_VAGOES, manual: false, descricao: 'Posição física de cada vagão no pátio (linha e sequência).', colunas: ['Sér', 'Veículo', 'Tmo', 'P', 'Local', 'Lin', 'Seq', 'Perm', 'Org', 'Dst', 'Pedido', 'Merc', 'TU', 'TB'] },
  { aba: ABA_SITUACAO_VAGOES, manual: false, descricao: 'Atividade de cada vagão do pátio (ex.: Avariado, Ag Tração).', colunas: ['AO filha', 'Lin.', 'Seq.', 'Ser.', 'Vagão', 'Atividade', 'Ori.', 'Dest.', 'TU', 'TB'] },
  { aba: ABA_PATIO_LOCOMOTIVAS, manual: false, descricao: 'Posição das locomotivas no pátio, com combustível e posição (frente/traseira).', colunas: ['Sér', 'Veículo', 'Lin', 'Seq', 'Comb. (L)', 'Posição'] },
  { aba: ABA_ACOES_OPERACIONAIS, manual: true, descricao: 'Vagões a retirar e inclusões por bloco. Pode vir vazia — é revisada e completada no formulário antes de importar.', colunas: ['Seq', 'Sér', 'Veiculo', 'Motivo', 'Bloco', 'Quantidade'] },
];

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

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: PANEL_BG,
  border: `1px solid ${BORDER}`,
  borderRadius: '0.25rem',
  padding: '0.4375rem 0.5625rem',
  color: TEXT_HI,
  fontSize: '0.75rem',
  fontFamily: FONT,
};

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportarFichaModal({ isOpen, onClose, onImportar }: Props) {
  const [trem, setTrem] = useState('');
  const [os, setOs] = useState('');
  const [patioNome, setPatioNome] = useState(NOMES_PATIOS[0]);
  // Mockado: começa em HOJE, editável — a planilha importada (Unilog) não traz essa data, mas
  // toda ficha do sistema passa a exibir uma, igual ao cadastro manual.
  const [data, setData] = useState(HOJE);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [importada, setImportada] = useState<ResultadoImportacao | null>(null);
  const [acoes, setAcoes] = useState<AcoesOperacionais | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTrem('');
      setOs('');
      setPatioNome(NOMES_PATIOS[0]);
      setData(HOJE);
      setArquivo(null);
      setImportada(null);
      setAcoes(null);
      setErro(null);
      setCarregando(false);
      setArrastando(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const processarArquivo = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setErro('Formato não suportado. Envie o arquivo .xlsx (ou .xls) exportado do UNILOG, no modelo de 5 abas.');
      setArquivo(null);
      setImportada(null);
      return;
    }
    setErro(null);
    setArquivo(file);
    setImportada(null);
    setCarregando(true);
    try {
      const resultado = await parseFichaXlsx(file);
      setImportada(resultado);
      setAcoes(resultado.acoes);
      setTrem((prev) => prev || resultado.leitura.cabecalho.trem);
      setOs((prev) => prev || resultado.leitura.cabecalho.os);
    } catch (e) {
      setErro(e instanceof FichaImportError ? e.message : 'Não foi possível ler este arquivo — verifique se ele mantém o layout original do relatório.');
      setArquivo(null);
      setImportada(null);
    } finally {
      setCarregando(false);
    }
  };

  const trocarArquivo = () => {
    setArquivo(null);
    setImportada(null);
    setAcoes(null);
    setErro(null);
  };

  const errosAcoes = importada && acoes ? temErros(validarAcoes(acoes, importada.leitura.composicao)) : false;
  const podeImportar =
    trem.trim().length > 0 &&
    os.trim().length > 0 &&
    !!importada &&
    !!acoes &&
    !errosAcoes;

  const confirmarImportacao = () => {
    if (!podeImportar || !importada || !acoes) return;
    onImportar({ trem: trem.trim(), os: os.trim(), patioNome, data, leitura: importada.leitura, acoes });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center no-print"
      style={{ zIndex: 200, backgroundColor: 'rgba(0,0,0,0.75)', fontFamily: FONT, padding: '1rem' }}
    >
      <div
        style={{
          backgroundColor: PANEL_BG,
          borderRadius: RADIUS,
          width: '100%',
          maxWidth: importada ? '66rem' : '48.75rem',
          maxHeight: '90vh',
          fontFamily: FONT,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--vli-shadow), 0 0.75rem 2rem rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${BORDER}`, padding: '1.25rem' }}>
          <div className="flex items-center" style={{ gap: '0.75rem' }}>
            <div
              style={{
                width: '2.5rem', height: '2.5rem', backgroundColor: VLI_PRIMARY_SOLID, borderRadius: RADIUS,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0,
              }}
            >
              <Upload size="1.25rem" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: TEXT_HI, lineHeight: 1.3, fontFamily: FONT }}>
                Importar Ficha
              </div>
              <div style={{ fontSize: '0.6875rem', color: TEXT_LO, marginTop: '0.25rem', letterSpacing: '0.03em', fontFamily: FONT, fontWeight: 600 }}>
                Importe a planilha exportada do UNILOG e já registre as ações operacionais
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ cursor: 'pointer', border: 'none', background: 'none', padding: '0.25rem', color: TEXT_MD, display: 'flex' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_HI; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_MD; }}
          >
            <X size="1.25rem" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <div className="grid grid-cols-4" style={{ gap: '0.625rem', marginBottom: '1.25rem' }}>
            <Campo label="Trem">
              <input type="text" value={trem} onChange={(e) => setTrem(e.target.value)} placeholder="Ex.: R220" style={inputStyle} />
            </Campo>
            <Campo label="O.S.">
              <input type="text" value={os} onChange={(e) => setOs(e.target.value)} placeholder="Ex.: 9995/2026" style={inputStyle} />
            </Campo>
            <Campo label="Pátio">
              <FiltroSelect
                ariaLabel="Pátio"
                value={patioNome}
                onChange={setPatioNome}
                options={NOMES_PATIOS.map((nome) => ({ value: nome, label: nome }))}
                variant="field"
              />
            </Campo>
            <Campo label="Data da Ficha">
              <DataPickerField value={data} onChange={setData} />
            </Campo>
          </div>

          {!arquivo ? (
            <>
              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastando(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) processarArquivo(f);
                }}
                className="flex flex-col items-center justify-center"
                style={{
                  gap: '0.5rem',
                  padding: '1.75rem 1.25rem',
                  border: `1.5px dashed ${arrastando ? VLI_PRIMARY : BORDER}`,
                  borderRadius: RADIUS,
                  backgroundColor: arrastando ? 'var(--vli-active-bg)' : SURFACE,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background-color 0.15s',
                  marginBottom: '0.75rem',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) processarArquivo(f); }}
                />
                <Upload size="1.375rem" color={arrastando ? VLI_PRIMARY : TEXT_LO} strokeWidth={2} />
                <div style={{ fontSize: '0.75rem', color: TEXT_HI, fontWeight: 600, fontFamily: FONT, textAlign: 'center' }}>
                  Arraste um arquivo aqui ou clique para selecionar
                </div>
                <div style={{ fontSize: '0.6875rem', color: TEXT_LO, fontFamily: FONT, textAlign: 'center' }}>
                  Formatos aceitos: .xlsx, .xls — arquivo único, no modelo de 5 abas
                </div>
              </div>

              {erro && (
                <div
                  className="flex items-center"
                  style={{ gap: '0.5rem', padding: '0.625rem 0.75rem', borderRadius: RADIUS, backgroundColor: DANGER_BG, marginBottom: '0.75rem' }}
                >
                  <AlertTriangle size="0.875rem" color={DANGER_TEXT} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: DANGER_TEXT, fontWeight: 600, fontFamily: FONT }}>{erro}</span>
                </div>
              )}

              <button
                onClick={() => baixarModeloXlsx()}
                className="flex items-center"
                style={{
                  gap: '0.375rem', border: 'none', background: 'transparent', color: VLI_PRIMARY, fontSize: '0.75rem',
                  letterSpacing: '0.02em', cursor: 'pointer', padding: 0, marginBottom: '1.25rem', fontFamily: FONT, textDecoration: 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
              >
                <Download size="0.8125rem" strokeWidth={2.5} />
                Baixar modelo de planilha
              </button>

              {/* Especificação das abas */}
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: TEXT_LO, marginBottom: '0.5rem', fontFamily: FONT }}>
                Abas esperadas no arquivo
              </div>
              <p style={{ fontSize: '0.6875rem', color: TEXT_MD, lineHeight: 1.5, margin: '0 0 0.625rem', fontFamily: FONT }}>
                Use os nomes de aba abaixo. Só "Ficha do trem" é obrigatória — abas ausentes deixam a seção correspondente vazia.
              </p>
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: RADIUS, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Aba', 'Natureza', 'Conteúdo'].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.05em',
                            textTransform: 'uppercase', color: TEXT_LO, borderBottom: `1px solid ${BORDER}`, fontFamily: FONT,
                            backgroundColor: SURFACE, whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ESTRUTURA_ABAS.map((e, i) => (
                      <tr key={e.aba}>
                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, color: TEXT_HI, fontFamily: FONT, borderBottom: i < ESTRUTURA_ABAS.length - 1 ? `1px solid ${BORDER}` : 'none', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                          {e.aba}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: i < ESTRUTURA_ABAS.length - 1 ? `1px solid ${BORDER}` : 'none', verticalAlign: 'top' }}>
                          <span
                            style={{
                              fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                              padding: '0.125rem 0.4375rem', borderRadius: '62.4375rem', whiteSpace: 'nowrap',
                              color: e.manual ? EDIT : TEXT_LO,
                              border: `1px solid ${e.manual ? EDIT : BORDER}`,
                            }}
                          >
                            {e.manual ? 'Entrada manual' : 'Leitura'}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: TEXT_MD, fontFamily: FONT, borderBottom: i < ESTRUTURA_ABAS.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                          <div style={{ marginBottom: '0.375rem' }}>{e.descricao}</div>
                          <div className="flex flex-wrap" style={{ gap: '0.25rem' }}>
                            {e.colunas.map((c) => (
                              <span
                                key={c}
                                style={{
                                  fontSize: '0.625rem', fontWeight: 600, color: TEXT_MD, fontFamily: FONT,
                                  padding: '0.125rem 0.4375rem', borderRadius: '62.4375rem', border: `1px solid ${BORDER}`,
                                  backgroundColor: PANEL_BG, whiteSpace: 'nowrap',
                                }}
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              {/* Arquivo selecionado + resumo de validação */}
              <div className="flex items-center justify-between" style={{ padding: '0.625rem 0.75rem', border: `1px solid ${BORDER}`, borderRadius: RADIUS, backgroundColor: SURFACE, marginBottom: '0.75rem' }}>
                <div className="flex items-center" style={{ gap: '0.625rem', minWidth: 0 }}>
                  <FileSpreadsheet size="1.125rem" color={VLI_PRIMARY} strokeWidth={2} style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: TEXT_HI, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {arquivo.name}
                    </div>
                    <div style={{ fontSize: '0.625rem', color: TEXT_LO, fontFamily: FONT }}>{formatarTamanho(arquivo.size)}</div>
                  </div>
                </div>
                <button
                  onClick={trocarArquivo}
                  style={{
                    flexShrink: 0, border: `1px solid ${BORDER}`, borderRadius: RADIUS, background: 'transparent',
                    color: TEXT_MD, fontSize: '0.6875rem', letterSpacing: '0.02em', cursor: 'pointer', padding: '0.375rem 0.75rem', fontFamily: FONT,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_HI; e.currentTarget.style.borderColor = TEXT_LO; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_MD; e.currentTarget.style.borderColor = BORDER; }}
                >
                  Trocar arquivo
                </button>
              </div>

              {carregando && (
                <p style={{ fontSize: '0.75rem', color: TEXT_MD, fontFamily: FONT, marginBottom: '0.75rem' }}>
                  Lendo as abas do arquivo…
                </p>
              )}

              {erro && (
                <div
                  className="flex items-center"
                  style={{ gap: '0.5rem', padding: '0.625rem 0.75rem', borderRadius: RADIUS, backgroundColor: DANGER_BG, marginBottom: '0.75rem' }}
                >
                  <AlertTriangle size="0.875rem" color={DANGER_TEXT} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: DANGER_TEXT, fontWeight: 600, fontFamily: FONT }}>{erro}</span>
                </div>
              )}

              {importada && acoes && (
                <>
                  {importada.avisos.length > 0 && (
                    <div className="flex flex-col" style={{ gap: '0.25rem', padding: '0.5625rem 0.75rem', borderRadius: RADIUS, backgroundColor: HOVER_TINT, marginBottom: '0.875rem' }}>
                      {importada.avisos.map((a) => (
                        <span key={a} className="flex items-center" style={{ gap: '0.375rem', fontSize: '0.6875rem', color: TEXT_MD, fontFamily: FONT }}>
                          <AlertTriangle size="0.75rem" color={WARNING_TEXT} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                          {a}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: TEXT_LO, marginBottom: '0.5rem', fontFamily: FONT }}>
                    Dados lidos · somente leitura
                  </div>
                  <ResumoLeitura r={importada} />

                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: EDIT, margin: '1.25rem 0 0.25rem', fontFamily: FONT }}>
                    Revise as ações operacionais
                  </div>
                  <p style={{ fontSize: '0.6875rem', color: TEXT_MD, margin: '0 0 0.625rem', fontFamily: FONT, lineHeight: 1.5 }}>
                    {importada.acoes.retiradas.length + importada.acoes.inclusoes.length > 0
                      ? `Pré-preenchido a partir da aba "${ABA_ACOES_OPERACIONAIS}" da planilha — ajuste o que precisar antes de importar.`
                      : 'A planilha não trouxe ações. Você pode preenchê-las agora ou depois, na aba "Ações Operacionais" da ficha.'}
                  </p>
                  <AcoesOperacionaisForm acoes={acoes} onChange={setAcoes} dados={importada.leitura} rotuloOk="Sem pendências" />
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center shrink-0" style={{ gap: '0.75rem', borderTop: `1px solid ${BORDER}`, padding: '1.25rem' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, height: '2rem', backgroundColor: 'transparent', border: `1px solid ${BORDER}`, borderRadius: RADIUS,
              cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '0.05em', color: TEXT_MD, fontFamily: FONT,
              transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = HOVER_TINT; e.currentTarget.style.color = TEXT_HI; e.currentTarget.style.borderColor = TEXT_LO; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = TEXT_MD; e.currentTarget.style.borderColor = BORDER; }}
          >
            Cancelar
          </button>
          <button
            onClick={confirmarImportacao}
            disabled={!podeImportar}
            style={{
              flex: 1, height: '2rem', backgroundColor: podeImportar ? VLI_PRIMARY_SOLID : BORDER, border: 'none', borderRadius: RADIUS,
              cursor: podeImportar ? 'pointer' : 'not-allowed', fontSize: '0.75rem', letterSpacing: '0.05em',
              color: podeImportar ? '#fff' : TEXT_LO, fontFamily: FONT, transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => { if (podeImportar) e.currentTarget.style.backgroundColor = 'var(--vli-primary-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = podeImportar ? VLI_PRIMARY_SOLID : BORDER; }}
          >
            {errosAcoes ? 'Corrija as ações operacionais' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Resumo do que foi lido — uma linha por aba de leitura, já na linguagem da tela. */
function ResumoLeitura({ r }: { r: ResultadoImportacao }) {
  const l = r.leitura;
  const linhas = (itens: { linha: string }[]) => new Set(itens.map((i) => i.linha)).size;
  const atividades = new Map<string, number>();
  l.situacaoVagoes.forEach((s) => atividades.set(s.atividade, (atividades.get(s.atividade) ?? 0) + 1));
  const itens = [
    {
      icone: ClipboardList,
      titulo: 'Ficha do Trem',
      aba: ABA_FICHA_DO_TREM,
      resumo: `Trem ${l.cabecalho.trem || '—'} · ${l.cabecalho.origem || '—'} → ${l.cabecalho.destino || '—'} · ${l.totais.locomotivas} locomotivas, ${l.totais.vagoes} vagões · ${l.restricoes.length} restrição(ões)`,
      vazio: l.composicao.length === 0,
    },
    { icone: Warehouse, titulo: 'Pátio · Vagões', aba: ABA_PATIO_VAGOES, resumo: `${l.patioVagoes.length} vagões em ${linhas(l.patioVagoes)} linha(s)`, vazio: l.patioVagoes.length === 0 },
    { icone: TrainFront, titulo: 'Pátio · Locomotivas', aba: ABA_PATIO_LOCOMOTIVAS, resumo: `${l.patioLocomotivas.length} locomotiva(s) em ${linhas(l.patioLocomotivas)} linha(s)`, vazio: l.patioLocomotivas.length === 0 },
    { icone: Activity, titulo: 'Situação Vagões', aba: ABA_SITUACAO_VAGOES, resumo: Array.from(atividades.entries()).map(([a, n]) => `${n} ${a}`).join(' · ') || '—', vazio: l.situacaoVagoes.length === 0 },
  ];
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: RADIUS, overflow: 'hidden' }}>
      {itens.map((it, i) => {
        const Icone = it.icone;
        return (
          <div key={it.aba} className="flex items-center" style={{ gap: '0.625rem', padding: '0.5rem 0.75rem', borderTop: i === 0 ? undefined : `1px solid ${BORDER}`, fontFamily: FONT }}>
            <Icone size="0.875rem" color={it.vazio ? TEXT_LO : SUCCESS_TEXT} strokeWidth={2.25} style={{ flexShrink: 0 }} />
            <span style={{ width: '9.5rem', flexShrink: 0, fontSize: '0.75rem', fontWeight: 700, color: TEXT_HI }}>{it.titulo}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: '0.75rem', color: it.vazio ? TEXT_LO : TEXT_MD }}>{it.vazio ? 'Sem dados nesta aba' : it.resumo}</span>
            <HeaderTooltip label={"Aba de origem na planilha"}><span style={{ fontSize: '0.625rem', color: TEXT_LO, whiteSpace: 'nowrap' }}>{it.aba}</span></HeaderTooltip>
          </div>
        );
      })}
    </div>
  );
}
