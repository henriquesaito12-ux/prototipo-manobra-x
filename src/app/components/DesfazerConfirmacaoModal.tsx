import { rotuloTrem } from '../data/trensAtivos';
import { RotateCcw, X } from 'lucide-react';
import type { FichaResumo } from '../data/fichaOperacao';

const PANEL_BG      = 'var(--vli-panel-bg)';
const BORDER        = 'var(--vli-border)';
const TEXT_HI       = 'var(--vli-text-hi)';
const TEXT_MD       = 'var(--vli-text-md)';
const TEXT_LO       = 'var(--vli-text-lo)';
const WARNING_TEXT  = 'var(--vli-warning-text)';
const FONT          = 'Manrope, sans-serif';
const RADIUS        = '0.375rem';

interface Props {
  isOpen: boolean;
  ficha: FichaResumo;
  onClose: () => void;
  onDesfazer: () => void;
}

export function DesfazerConfirmacaoModal({ isOpen, ficha, onClose, onDesfazer }: Props) {
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
          width: '28.75rem',
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
                  backgroundColor: WARNING_TEXT,
                  borderRadius: RADIUS,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                <RotateCcw size="1.1875rem" strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: TEXT_HI, lineHeight: 1.3, fontFamily: FONT }}>
                  Desfazer Confirmação
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
            Esta ficha voltará para o estado pendente e suas informações saem do planejamento até
            que ela seja confirmada novamente. Deseja continuar?
          </p>

          <div className="flex items-center" style={{ gap: '0.75rem' }}>
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
              onClick={onDesfazer}
              style={{
                flex: 1,
                height: '2rem',
                backgroundColor: WARNING_TEXT,
                border: 'none',
                borderRadius: RADIUS,
                cursor: 'pointer',
                fontSize: '0.75rem',
                letterSpacing: '0.05em',
                color: '#fff',
                fontFamily: FONT,
                transition: 'filter 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(0.9)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
            >
              Desfazer Confirmação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
