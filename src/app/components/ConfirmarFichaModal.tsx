import { rotuloTrem } from '../data/trensAtivos';
import { CheckCircle2, Download, X } from 'lucide-react';
import type { FichaResumo } from '../data/fichaOperacao';

const VLI_PRIMARY = 'var(--vli-primary)';
const VLI_PRIMARY_TEXT = 'var(--vli-primary-text)';
const PANEL_BG   = 'var(--vli-panel-bg)';
const BORDER     = 'var(--vli-border)';
const TEXT_HI    = 'var(--vli-text-hi)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
const FONT       = 'Manrope, sans-serif';
const RADIUS     = '0.375rem';

interface Props {
  isOpen: boolean;
  ficha: FichaResumo;
  onClose: () => void;
  onConfirmar: () => void;
  onBaixarPdf: () => void;
}

export function ConfirmarFichaModal({ isOpen, ficha, onClose, onConfirmar, onBaixarPdf }: Props) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center no-print"
      style={{ zIndex: 200, backgroundColor: 'rgba(0,0,0,0.75)', fontFamily: FONT }}
    >
      <div
        style={{
          backgroundColor: PANEL_BG,
          borderRadius: RADIUS,
          width: '30rem',
          fontFamily: FONT,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '1.25rem' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center" style={{ gap: '0.75rem' }}>
              <div
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  backgroundColor: VLI_PRIMARY,
                  borderRadius: RADIUS,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size="1.25rem" strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: TEXT_HI, lineHeight: 1.3, fontFamily: FONT }}>
                  Confirmar Ficha
                </div>
                <div style={{ fontSize: '0.6875rem', color: TEXT_LO, marginTop: '0.25rem', letterSpacing: '0.03em', fontFamily: FONT, fontWeight: 600 }}>
                  Trem {rotuloTrem(ficha.trem)} · OS {ficha.os}
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
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          <p style={{ fontSize: '0.8125rem', color: TEXT_MD, lineHeight: 1.6, margin: '0 0 1.25rem', fontFamily: FONT, fontWeight: 500 }}>
            Confirma que revisou os dados da composição do trem{' '}
            <span style={{ color: VLI_PRIMARY_TEXT, fontWeight: 700 }}>{rotuloTrem(ficha.trem)}</span>, incluindo vagões com
            restrição ou retenção? Essa ficha ficará marcada como revisada.
          </p>

          <div className="flex items-center" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
            <button
              onClick={onClose}
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
              Cancelar
            </button>
            <button
              onClick={onConfirmar}
              style={{
                flex: 1,
                height: '2rem',
                backgroundColor: VLI_PRIMARY,
                border: 'none',
                borderRadius: RADIUS,
                cursor: 'pointer',
                fontSize: '0.75rem',
                letterSpacing: '0.05em',
                color: '#fff',
                fontFamily: FONT,
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--vli-primary-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = VLI_PRIMARY; }}
            >
              Confirmar Revisão
            </button>
          </div>

          {/* Ação secundária — menos peso visual que a confirmação acima */}
          <button
            onClick={onBaixarPdf}
            className="flex items-center justify-center w-full"
            style={{
              gap: '0.375rem',
              height: '2.25rem',
              border: 'none',
              borderRadius: RADIUS,
              backgroundColor: 'transparent',
              color: TEXT_LO,
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              cursor: 'pointer',
              fontFamily: FONT,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_MD; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_LO; }}
          >
            <Download size="0.8125rem" strokeWidth={2.25} />
            Baixar Ficha em PDF
          </button>
        </div>
      </div>
    </div>
  );
}
