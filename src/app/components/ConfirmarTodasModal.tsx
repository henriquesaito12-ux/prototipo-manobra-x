import { rotuloTrem } from '../data/trensAtivos';
import { CheckCircle2, X } from 'lucide-react';
import type { FichaResumo } from '../data/fichaOperacao';

const VLI_PRIMARY = 'var(--vli-primary)';
const PANEL_BG   = 'var(--vli-panel-bg)';
const SURFACE    = 'var(--vli-surface)';
const BORDER     = 'var(--vli-border)';
const TEXT_HI    = 'var(--vli-text-hi)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
const FONT       = 'Manrope, sans-serif';
const RADIUS     = '0.375rem';

interface Props {
  isOpen: boolean;
  fichas: FichaResumo[];
  onClose: () => void;
  onConfirmar: () => void;
}

export function ConfirmarTodasModal({ isOpen, fichas, onClose, onConfirmar }: Props) {
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
                  Confirmar Todas as Fichas
                </div>
                <div style={{ fontSize: '0.6875rem', color: TEXT_LO, marginTop: '0.25rem', letterSpacing: '0.03em', fontFamily: FONT, fontWeight: 600 }}>
                  {fichas.length} {fichas.length === 1 ? 'ficha pendente' : 'fichas pendentes'}
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
          <p style={{ fontSize: '0.8125rem', color: TEXT_MD, lineHeight: 1.6, margin: '0 0 0.875rem', fontFamily: FONT, fontWeight: 500 }}>
            Confirma que revisou os dados das composições abaixo, incluindo vagões com restrição ou
            retenção? Todas ficarão marcadas como revisadas.
          </p>

          <div
            className="flex flex-col"
            style={{
              gap: '0.375rem',
              maxHeight: '10rem',
              overflowY: 'auto',
              border: `1px solid ${BORDER}`,
              borderRadius: RADIUS,
              backgroundColor: SURFACE,
              padding: '0.625rem',
              marginBottom: '1.25rem',
            }}
          >
            {fichas.map((f) => (
              <div key={f.id} className="flex items-center justify-between" style={{ gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: TEXT_HI, fontFamily: FONT }}>
                  Trem {rotuloTrem(f.trem)}
                </span>
                <span style={{ fontSize: '0.6875rem', color: TEXT_LO, fontFamily: FONT, whiteSpace: 'nowrap' }}>
                  OS {f.os} · {f.patioNome}
                </span>
              </div>
            ))}
          </div>

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
        </div>
      </div>
    </div>
  );
}
