import { useState } from 'react';
import { X, Settings, GripVertical, Minus, Plus, RefreshCw, Check, Zap, Scale } from 'lucide-react';

const VLI_ORANGE = 'var(--vli-accent)';
const VLI_PRIMARY = 'var(--vli-primary)';
const VLI_PRIMARY_TEXT = 'var(--vli-primary-text)';
const BG_DEEP    = 'var(--vli-bg-deep)';
const PANEL_BG   = 'var(--vli-panel-bg)';
const SURFACE    = 'var(--vli-surface)';
const BORDER     = 'var(--vli-border)';
const TEXT_HI    = 'var(--vli-text-hi)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
const DANGER        = 'var(--vli-danger)';
const DANGER_TEXT   = 'var(--vli-danger-text)';
const DANGER_BG_STRONG = 'var(--vli-danger-bg-strong)';
const FONT       = 'Manrope, sans-serif';
const RADIUS     = '0.375rem';

interface ParametersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSalvar?: () => void;
}

const initialQueue = [
  { id: 'J614', label: 'Trem J614 (Vazio)' },
  { id: 'R045', label: 'Trem R045 (Formação)' },
];

const initialRestrictions: Record<string, boolean> = {
  L1: false,
  L2: false,
  L3: false,
  'L4 (MRS)': true,
  L5: false,
  L6: false,
  L7: false,
  EVS1: false,
  EVS2: false,
};

function SectionTitle({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center" style={{ gap: '0.5rem', marginBottom: '0.5rem' }}>
      <div
        style={{
          width: '1.25rem',
          height: '1.25rem',
          borderRadius: '0.25rem',
          backgroundColor: VLI_PRIMARY,
          color: '#fff',
          fontSize: '0.6875rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT,
        }}
      >
        {index}
      </div>
      <span
        style={{
          color: TEXT_HI,
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontFamily: FONT,
        }}
      >
        {children}
      </span>
    </div>
  );
}

function SectionHelp({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '0.6875rem',
        color: TEXT_LO,
        fontFamily: FONT,
        fontWeight: 500,
        marginBottom: '0.75rem',
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

export function ParametersModal({ isOpen, onClose, onSalvar }: ParametersModalProps) {
  const [queue, setQueue] = useState(initialQueue);
  const [teamCount, setTeamCount] = useState(2);
  const [restrictions, setRestrictions] = useState(initialRestrictions);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [strategyMode, setStrategyMode] = useState<'tempo' | 'peso'>('tempo');

  if (!isOpen) return null;

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newQueue = [...queue];
    const dragged = newQueue.splice(dragIndex, 1)[0];
    newQueue.splice(index, 0, dragged);
    setQueue(newQueue);
    setDragIndex(index);
  };
  const handleDragEnd = () => setDragIndex(null);

  const toggleRestriction = (key: string) => {
    setRestrictions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleReset = () => {
    setQueue(initialQueue);
    setTeamCount(2);
    setRestrictions(initialRestrictions);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(2px)', fontFamily: FONT }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full mx-4"
        style={{
          maxWidth: '45rem',
          backgroundColor: PANEL_BG,
          borderRadius: RADIUS,
          overflow: 'hidden',
          fontFamily: FONT,
          boxShadow: 'var(--vli-shadow)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '1.25rem', borderBottom: `1px solid ${BORDER}` }}
        >
          <div className="flex items-center" style={{ gap: '0.75rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                backgroundColor: VLI_ORANGE,
                borderRadius: RADIUS,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              <Settings size="1.25rem" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ color: TEXT_HI, fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', fontFamily: FONT, lineHeight: 1.3 }}>
                Ajuste de Parâmetros
              </div>
              <div style={{ color: TEXT_LO, fontSize: '0.6875rem', fontFamily: FONT, marginTop: '0.25rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Configuração manual do turno
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              color: TEXT_MD,
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_HI; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_MD; }}
          >
            <X size="1.25rem" />
          </button>
        </div>

        {/* Body */}
        <div className="grid" style={{ padding: '1.5rem', gap: '1.5rem', gridTemplateColumns: '1fr 1fr' }}>
          {/* Section 1: Priority Queue */}
          <div>
            <SectionTitle index={1}>Prioridade de Fila</SectionTitle>
            <SectionHelp>Ordene por prioridade (arraste para reordenar)</SectionHelp>
            <div className="flex flex-col" style={{ gap: '0.5rem' }}>
              {queue.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center"
                  style={{
                    gap: '0.5rem',
                    backgroundColor: SURFACE,
                    borderRadius: RADIUS,
                    padding: '0.75rem',
                    cursor: 'grab',
                    opacity: dragIndex === index ? 0.5 : 1,
                    transition: 'opacity 0.1s',
                  }}
                >
                  <GripVertical size="0.875rem" color={TEXT_LO} />
                  <span style={{ color: VLI_PRIMARY_TEXT, fontSize: '0.75rem', fontFamily: FONT, fontWeight: 700, minWidth: '1rem' }}>
                    {index + 1}.
                  </span>
                  <span style={{ color: TEXT_HI, fontSize: '0.75rem', fontFamily: FONT, fontWeight: 500 }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2 + 3 + 4 stacked */}
          <div className="flex flex-col" style={{ gap: '1.5rem' }}>
            <div>
              <SectionTitle index={2}>Equipe em Campo</SectionTitle>
              <SectionHelp>Número real de manobradores ativos no pátio agora</SectionHelp>
              <div className="flex items-center" style={{ gap: 0 }}>
                <button
                  onClick={() => setTeamCount((v) => Math.max(0, v - 1))}
                  style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    backgroundColor: 'transparent',
                    border: `1px solid ${BORDER}`,
                    borderRadius: `${RADIUS} 0 0 ${RADIUS}`,
                    color: TEXT_MD,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--vli-hover-tint)'; e.currentTarget.style.color = TEXT_HI; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = TEXT_MD; }}
                >
                  <Minus size="0.875rem" />
                </button>
                <div
                  style={{
                    width: '3rem',
                    height: '2.25rem',
                    backgroundColor: SURFACE,
                    borderTop: `1px solid ${BORDER}`,
                    borderBottom: `1px solid ${BORDER}`,
                    color: VLI_PRIMARY_TEXT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    fontWeight: 700,
                    fontFamily: FONT,
                  }}
                >
                  {teamCount}
                </div>
                <button
                  onClick={() => setTeamCount((v) => Math.min(10, v + 1))}
                  style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    backgroundColor: 'transparent',
                    border: `1px solid ${BORDER}`,
                    borderRadius: `0 ${RADIUS} ${RADIUS} 0`,
                    color: TEXT_MD,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--vli-hover-tint)'; e.currentTarget.style.color = TEXT_HI; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = TEXT_MD; }}
                >
                  <Plus size="0.875rem" />
                </button>
              </div>
            </div>

            <div>
              <SectionTitle index={3}>Interdições Temporárias</SectionTitle>
              <SectionHelp>Marque manualmente as linhas indisponíveis para o turno</SectionHelp>
              <div className="flex flex-wrap" style={{ gap: '0.5rem' }}>
                {Object.entries(restrictions).map(([key, active]) => (
                  <button
                    key={key}
                    onClick={() => toggleRestriction(key)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      height: '1.75rem',
                      fontSize: '0.6875rem',
                      fontFamily: FONT,
                      letterSpacing: '0.05em',
                      border: `1px solid ${active ? DANGER : BORDER}`,
                      borderRadius: RADIUS,
                      backgroundColor: active ? DANGER_BG_STRONG : 'transparent',
                      color: active ? DANGER_TEXT : TEXT_LO,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.borderColor = TEXT_MD; e.currentTarget.style.color = TEXT_HI; } }}
                    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_LO; } }}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle index={4}>Preferência do Turno</SectionTitle>
              <SectionHelp>Registro informativo para a equipe (não recalcula a malha automaticamente)</SectionHelp>
              <div className="flex" style={{ gap: '0.5rem' }}>
                {[
                  { id: 'tempo' as const, icon: Zap, label: 'Tempo / Agilidade', hint: 'Para via livre' },
                  { id: 'peso'  as const, icon: Scale, label: 'Peso Médio', hint: 'Para CCO congestionado' },
                ].map(({ id, icon: Icon, label, hint }) => {
                  const active = strategyMode === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setStrategyMode(id)}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        fontFamily: FONT,
                        textAlign: 'left',
                        border: `1px solid ${active ? VLI_PRIMARY_TEXT : BORDER}`,
                        borderRadius: RADIUS,
                        backgroundColor: active ? 'var(--vli-active-bg)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.borderColor = TEXT_MD; e.currentTarget.style.backgroundColor = 'var(--vli-hover-tint)'; } }}
                      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.backgroundColor = 'transparent'; } }}
                    >
                      <Icon size="1rem" color={active ? VLI_PRIMARY_TEXT : TEXT_MD} strokeWidth={2.5} />
                      <div style={{
                        fontSize: '0.75rem',
                        color: active ? TEXT_HI : TEXT_MD,
                        marginTop: '0.5rem',
                        letterSpacing: '0.04em',
                      }}>
                        {label}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: TEXT_LO, marginTop: '0.25rem', fontWeight: 500 }}>
                        {hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '1.25rem', borderTop: `1px solid ${BORDER}` }}
        >
          <button
            onClick={handleReset}
            className="flex items-center"
            style={{
              gap: '0.5rem',
              color: TEXT_LO,
              fontSize: '0.6875rem',
              fontFamily: FONT,
              letterSpacing: '0.05em',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_HI; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_LO; }}
          >
            <RefreshCw size="0.75rem" strokeWidth={2.5} />
            Restaurar Posições
          </button>
          <div className="flex" style={{ gap: '0.75rem' }}>
            <button
              onClick={onClose}
              style={{
                width: '7.5rem',
                height: '2rem',
                fontSize: '0.75rem',
                fontFamily: FONT,
                letterSpacing: '0.05em',
                border: `1px solid ${BORDER}`,
                borderRadius: RADIUS,
                backgroundColor: 'transparent',
                color: TEXT_MD,
                cursor: 'pointer',
                transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--vli-hover-tint)'; e.currentTarget.style.color = TEXT_HI; e.currentTarget.style.borderColor = TEXT_LO; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = TEXT_MD; e.currentTarget.style.borderColor = BORDER; }}
            >
              Cancelar
            </button>
            <button
              onClick={() => { onSalvar?.(); onClose(); }}
              className="flex items-center justify-center"
              style={{
                width: '11.25rem',
                height: '2rem',
                gap: '0.5rem',
                fontSize: '0.75rem',
                fontFamily: FONT,
                letterSpacing: '0.05em',
                border: 'none',
                borderRadius: RADIUS,
                backgroundColor: VLI_ORANGE,
                color: '#fff',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--vli-accent-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = VLI_ORANGE; }}
            >
              <Check size="0.875rem" strokeWidth={2.5} />
              Salvar Configuração
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
