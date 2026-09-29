import { Move, X } from 'lucide-react';

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
  /** Nome do card arrastado — "Bloco B" ou o id de um vagão avulso ("VG-88057"). */
  itemNome: string;
  /** Trem associado, se houver (ausente para vagão avulso). */
  itemTrem?: string;
  origemLabel: string;
  destinoLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmação de drag-and-drop no board de Manobras do Pátio — mesmo padrão visual dos demais
 *  modais de confirmação do protótipo (`ConfirmarPlanoModal`/`ConfirmacaoMudancaModal`): backdrop
 *  escuro, painel com header (ícone + título + `X`) e footer com par Cancelar/Confirmar. Soltar o
 *  card nunca move de verdade — só chega até aqui; "Cancelar" simplesmente fecha sem aplicar nada,
 *  o que já é suficiente para o card "voltar" (ele nunca saiu da coluna original). */
export function ConfirmarMovimentacaoModal({ isOpen, itemNome, itemTrem, origemLabel, destinoLabel, onConfirm, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center no-print"
      style={{ zIndex: 200, backgroundColor: 'rgba(0,0,0,0.75)', fontFamily: FONT }}
    >
      <div style={{ backgroundColor: PANEL_BG, borderRadius: RADIUS, width: '27.5rem', fontFamily: FONT, overflow: 'hidden' }}>
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
                <Move size="1.1875rem" strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: TEXT_HI, lineHeight: 1.3, fontFamily: FONT }}>
                  Mover Composição
                </div>
                <div style={{ fontSize: '0.6875rem', color: TEXT_LO, marginTop: '0.25rem', letterSpacing: '0.03em', fontFamily: FONT, fontWeight: 600 }}>
                  {itemTrem ? `Trem ${itemTrem}` : 'Vagão avulso'}
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

        <div style={{ padding: '1.5rem' }}>
          <p style={{ fontSize: '0.8125rem', color: TEXT_MD, lineHeight: 1.6, margin: '0 0 0.875rem', fontFamily: FONT, fontWeight: 500 }}>
            Mover <span style={{ fontWeight: 700, color: TEXT_HI }}>{itemNome}</span> de{' '}
            <span style={{ fontWeight: 700, color: TEXT_HI }}>{origemLabel}</span> para{' '}
            <span style={{ fontWeight: 700, color: TEXT_HI }}>{destinoLabel}</span>?
          </p>

          <div
            className="flex items-center justify-between"
            style={{ gap: '0.5rem', border: `1px solid ${BORDER}`, borderRadius: RADIUS, backgroundColor: SURFACE, padding: '0.625rem', marginBottom: '1.25rem' }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: TEXT_HI, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {origemLabel}
            </span>
            <span style={{ color: TEXT_LO, fontSize: '0.75rem', fontFamily: FONT, flexShrink: 0 }}>→</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: TEXT_HI, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>
              {destinoLabel}
            </span>
          </div>

          <div className="flex items-center" style={{ gap: '0.75rem' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                minHeight: '2rem',
                backgroundColor: 'transparent',
                border: `1px solid ${BORDER}`,
                borderRadius: RADIUS,
                cursor: 'pointer',
                fontSize: '0.75rem',
                letterSpacing: '0.05em',
                color: TEXT_MD,
                fontFamily: FONT,
                whiteSpace: 'nowrap',
                transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--vli-hover-tint)'; e.currentTarget.style.color = TEXT_HI; e.currentTarget.style.borderColor = TEXT_LO; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = TEXT_MD; e.currentTarget.style.borderColor = BORDER; }}
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="flex items-center justify-center"
              style={{
                flex: 1,
                gap: '0.5rem',
                minHeight: '2rem',
                padding: '0 0.75rem',
                backgroundColor: VLI_PRIMARY,
                border: 'none',
                borderRadius: RADIUS,
                cursor: 'pointer',
                fontSize: '0.75rem',
                letterSpacing: '0.05em',
                color: '#fff',
                fontFamily: FONT,
                whiteSpace: 'nowrap',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--vli-primary-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = VLI_PRIMARY; }}
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
