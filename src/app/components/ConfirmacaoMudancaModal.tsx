import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

const VLI_ORANGE = 'var(--vli-accent)';
// Só usado como texto/borda sobre fundo escuro nesta tela (nunca preenchimento sólido) —
// pode usar a variante mais clara direto.
const VLI_PRIMARY = 'var(--vli-primary-text)';
const PANEL_BG   = 'var(--vli-panel-bg)';
const SURFACE    = 'var(--vli-surface)';
const BORDER     = 'var(--vli-border)';
const TEXT_HI    = 'var(--vli-text-hi)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
const DANGER            = 'var(--vli-danger)';
const DANGER_STRONG     = 'var(--vli-danger-strong)';
const DANGER_STRONG_HOVER = 'var(--vli-danger-strong-hover)';
const FONT       = 'Manrope, sans-serif';
const RADIUS     = '0.375rem';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  linhaOriginal: string;
  linhaNova: string;
  tipo: 'linha' | 'ordem';
}

export function ConfirmacaoMudancaModal({ isOpen, onClose, onConfirm, linhaOriginal, linhaNova, tipo }: Props) {
  const [justificativa, setJustificativa] = useState('');

  if (!isOpen) return null;

  const podeConfirmar = justificativa.trim().length > 0;

  const fechar = () => {
    setJustificativa('');
    onClose();
  };

  const confirmar = () => {
    if (!podeConfirmar) return;
    onConfirm();
    setJustificativa('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 200, backgroundColor: 'rgba(0,0,0,0.75)', fontFamily: FONT }}
    >
      <div
        style={{
          backgroundColor: PANEL_BG,
          borderRadius: RADIUS,
          width: '38.75rem',
          fontFamily: FONT,
          overflow: 'hidden',
          boxShadow: 'var(--vli-shadow)',
        }}
      >
        {/* Header */}
        <div
          style={{
            borderBottom: `1px solid ${BORDER}`,
            padding: '1.25rem',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center" style={{ gap: '0.75rem' }}>
              <div
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  backgroundColor: DANGER,
                  borderRadius: RADIUS,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size="1.25rem" strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', color: TEXT_HI, lineHeight: 1.3, fontFamily: FONT }}>
                  Registrar Desvio Manual
                </div>
                <div style={{ fontSize: '0.6875rem', color: TEXT_LO, textTransform: 'uppercase', marginTop: '0.25rem', letterSpacing: '0.05em', fontFamily: FONT, fontWeight: 600 }}>
                  Registro de Alteração · Manobra X
                </div>
              </div>
            </div>
            <button
              onClick={fechar}
              style={{ cursor: 'pointer', border: 'none', background: 'none', padding: '0.25rem', color: TEXT_MD, display: 'flex' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_HI; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_MD; }}
            >
              <X size="1.25rem" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          {/* Contextual note */}
          <div
            style={{
              borderLeft: `0.1875rem solid ${VLI_PRIMARY}`,
              padding: '0.5rem 0 0.5rem 1rem',
              marginBottom: '1.5rem',
            }}
          >
            <p style={{ fontSize: '0.875rem', color: TEXT_MD, lineHeight: 1.6, margin: 0, fontFamily: FONT, fontWeight: 500 }}>
              {tipo === 'linha' ? (
                <>
                  Você selecionou manualmente a{' '}
                  <span style={{ color: VLI_PRIMARY, fontWeight: 700, textTransform: 'uppercase' }}>
                    {linhaNova}
                  </span>{' '}
                  como destino alternativo. A sugestão original do sistema era a{' '}
                  <span style={{ color: TEXT_HI, fontWeight: 600 }}>EVS1 (ETA 1)</span>.
                </>
              ) : (
                <>Você está alterando a ordem das ações do roteiro.</>
              )}
            </p>
          </div>

          {/* Justificativa */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: TEXT_LO,
                marginBottom: '0.5rem',
                fontFamily: FONT,
              }}
            >
              Justificativa da Alteração
            </div>
            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Descreva o motivo da alteração manual (ex.: condição da via, orientação do CCO, avaria identificada)..."
              rows={3}
              style={{
                width: '100%',
                resize: 'vertical',
                backgroundColor: SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: RADIUS,
                padding: '0.75rem',
                color: TEXT_HI,
                fontSize: '0.8125rem',
                fontFamily: FONT,
                lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: '0.6875rem', color: TEXT_LO, marginTop: '0.5rem', marginBottom: 0, fontFamily: FONT, fontWeight: 500 }}>
              Registre o motivo da alteração manual para rastreabilidade do turno.
            </p>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center" style={{ gap: '0.75rem' }}>
            <button
              onClick={fechar}
              style={{
                flex: 1,
                height: '2rem',
                backgroundColor: 'transparent',
                border: `1px solid ${BORDER}`,
                borderRadius: RADIUS,
                cursor: 'pointer',
                fontSize: '0.75rem',
                letterSpacing: '0.05em',
                color: TEXT_MD,
                fontFamily: FONT,
                transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--vli-hover-tint)'; e.currentTarget.style.color = TEXT_HI; e.currentTarget.style.borderColor = TEXT_LO; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = TEXT_MD; e.currentTarget.style.borderColor = BORDER; }}
            >
              Desfazer (Manter {tipo === 'linha' ? 'EVS1 (ETA 1)' : linhaOriginal})
            </button>
            <button
              onClick={confirmar}
              disabled={!podeConfirmar}
              style={{
                flex: 1,
                height: '2rem',
                backgroundColor: podeConfirmar ? DANGER_STRONG : BORDER,
                border: 'none',
                borderRadius: RADIUS,
                cursor: podeConfirmar ? 'pointer' : 'not-allowed',
                fontSize: '0.75rem',
                letterSpacing: '0.05em',
                color: podeConfirmar ? '#fff' : TEXT_LO,
                fontFamily: FONT,
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => { if (podeConfirmar) e.currentTarget.style.backgroundColor = DANGER_STRONG_HOVER; }}
              onMouseLeave={(e) => { if (podeConfirmar) e.currentTarget.style.backgroundColor = DANGER_STRONG; }}
            >
              Confirmar Alteração
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
