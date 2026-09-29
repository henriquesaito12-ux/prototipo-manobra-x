import { useState } from 'react';
import { ArrowRight, Plus, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { TrainYardSVG } from './TrainYardSVG';
import { ConfirmacaoMudancaModal } from './ConfirmacaoMudancaModal';

// VLI tokens
const VLI_ORANGE = 'var(--vli-accent)';
const BG_DEEP    = 'var(--vli-bg-deep)';
const PANEL_BG   = 'var(--vli-panel-bg)';
const SURFACE    = 'var(--vli-surface)';
const BORDER     = 'var(--vli-border)';
const TEXT_HI    = 'var(--vli-text-hi)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
const TRACK_FREE_BDR    = 'var(--vli-track-free-border)';
const TRACK_BLOCKED_BDR = 'var(--vli-track-blocked-border)';
const SUCCESS_STRONG    = 'var(--vli-success-strong)';
const SUCCESS_BORDER    = 'var(--vli-success-border)';
const TOAST_BG   = 'var(--vli-toast-success-bg)';
const TOAST_TEXT = 'var(--vli-toast-success-text)';
const VLI_PRIMARY       = 'var(--vli-primary)';
// Texto/ícone/borda/traço de legenda direto sobre fundo escuro — mais claro que o azul de
// preenchimento sólido (que continua em VLI_PRIMARY, ex.: o badge numerado de SectionTitle).
const VLI_PRIMARY_TEXT  = 'var(--vli-primary-text)';
const HOVER_TINT = 'var(--vli-hover-tint)';

const FONT = 'Manrope, sans-serif';
const RADIUS = '0.375rem';

function PanelHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        borderBottom: `1px solid ${BORDER}`,
        padding: '1rem 1.25rem',
      }}
    >
      {title ? (
        <div className="flex items-center" style={{ gap: '0.75rem' }}>
          <div style={{ width: '0.25rem', height: '1rem', backgroundColor: VLI_PRIMARY_TEXT, borderRadius: '0.125rem' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: TEXT_HI, fontFamily: FONT }}>
            {title}
          </span>
        </div>
      ) : (
        <div />
      )}
      {right}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '0.6875rem',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: TEXT_LO,
        marginBottom: '0.75rem',
        fontFamily: FONT,
      }}
    >
      {children}
    </div>
  );
}

interface RoteiroAtivoPanelProps {
  onReordenar: () => void;
}

function RoteiroAtivoPanel({ onReordenar }: RoteiroAtivoPanelProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  return (
    <div
      className="flex flex-col"
      style={{
        width: '20rem',
        flexShrink: 0,
        backgroundColor: PANEL_BG,
        borderRadius: RADIUS,
        overflow: 'hidden',
        boxShadow: 'var(--vli-shadow)',
      }}
    >
      <PanelHeader
        title="Roteiro Ativo"
        right={
          <span
            style={{
              fontSize: '0.6875rem',
              color: VLI_PRIMARY_TEXT,
              fontWeight: 700,
              letterSpacing: '0.05em',
              fontFamily: FONT,
            }}
          >
            TREM J614
          </span>
        }
      />

      <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }}>
        {/* Missão */}
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.8125rem', color: TEXT_HI, lineHeight: 1.5, margin: 0, marginBottom: '0.75rem', fontFamily: FONT, fontWeight: 500 }}>
            <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>MISSÃO:</span> Isolar vagão VG 4552 na L3 e recuar composição para a ETA 1.
          </p>
          <div
            style={{
              backgroundColor: SURFACE,
              borderRadius: RADIUS,
              padding: '0.5rem 0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              border: `1px solid ${BORDER}`,
            }}
          >
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: VLI_PRIMARY_TEXT, letterSpacing: '0.05em', fontFamily: FONT }}>
              ROTA EXPRESSA
            </span>
            <span style={{ fontSize: '0.6875rem', color: TEXT_MD, fontFamily: FONT, fontWeight: 500 }}>
              L3 → ETA 1
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.75rem', color: TEXT_LO, fontFamily: FONT, margin: 0 }}>
            Arraste para reordenar
          </p>
          <button
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: VLI_PRIMARY_TEXT,
              padding: 0,
              fontSize: '0.6875rem',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontFamily: FONT,
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
          >
            <Plus size="0.75rem" strokeWidth={2.5} />
            ADICIONAR
          </button>
        </div>

        {/* Action 1 — active */}
        <div
          style={{
            backgroundColor: SURFACE,
            padding: '1rem',
            marginBottom: '0.5rem',
            position: 'relative',
            borderRadius: RADIUS,
            cursor: draggedIndex === 0 ? 'grabbing' : 'default',
          }}
        >
          <div
            onMouseDown={() => { setDraggedIndex(0); onReordenar(); }}
            onMouseUp={() => setDraggedIndex(null)}
            style={{ position: 'absolute', right: '0.75rem', top: '0.75rem', color: TEXT_LO, cursor: 'grab', display: 'flex' }}
          >
            <GripVertical size="1rem" />
          </div>
          <div className="flex items-center" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: '1.25rem',
                height: '1.25rem',
                backgroundColor: VLI_PRIMARY,
                borderRadius: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.6875rem',
                fontWeight: 700,
                flexShrink: 0,
                fontFamily: FONT,
              }}
            >
              1
            </div>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: TEXT_MD, fontFamily: FONT }}>
              Rádio · Manobrador 1
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: TEXT_HI, lineHeight: 1.5, marginBottom: '1rem', fontFamily: FONT }}>
            "Realizar deslink do vagão de cauda{' '}
            <span style={{ fontWeight: 700, color: VLI_PRIMARY_TEXT }}>VG 4552</span>{' '}
            na{' '}
            <span style={{ fontWeight: 700, color: VLI_PRIMARY_TEXT }}>
              LINHA L3
            </span>
            ."
          </p>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: '0.6875rem', color: TEXT_LO, fontFamily: FONT }}>Est. 4 min</span>
            <button
              onClick={() => setConfirmed(true)}
              style={{
                width: '7.5rem',
                height: '2rem',
                backgroundColor: confirmed ? SUCCESS_STRONG : VLI_ORANGE,
                color: '#fff',
                border: 'none',
                borderRadius: RADIUS,
                fontSize: '0.6875rem',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                fontFamily: FONT,
                transition: 'background-color 0.15s, filter 0.15s',
              }}
              onMouseEnter={(e) => { if (confirmed) { e.currentTarget.style.filter = 'brightness(0.9)'; } else { e.currentTarget.style.backgroundColor = 'var(--vli-accent-hover)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.backgroundColor = confirmed ? SUCCESS_STRONG : VLI_ORANGE; }}
            >
              {confirmed ? '✓ CONFIRMADO' : 'CONFIRMAR'}
            </button>
          </div>
        </div>

        {/* Action 2 — pending */}
        <div
          style={{
            borderLeft: `0.1875rem solid ${BORDER}`,
            opacity: 0.55,
            padding: '1rem',
            position: 'relative',
            cursor: draggedIndex === 1 ? 'grabbing' : 'default',
          }}
        >
          <div
            onMouseDown={() => { setDraggedIndex(1); onReordenar(); }}
            onMouseUp={() => setDraggedIndex(null)}
            style={{ position: 'absolute', right: '0.75rem', top: '0.75rem', color: TEXT_LO, cursor: 'grab', display: 'flex' }}
          >
            <GripVertical size="1rem" />
          </div>
          <div className="flex items-center" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: '1.25rem',
                height: '1.25rem',
                border: `1px solid ${BORDER}`,
                borderRadius: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: TEXT_LO,
                fontSize: '0.6875rem',
                fontWeight: 700,
                flexShrink: 0,
                fontFamily: FONT,
              }}
            >
              2
            </div>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: TEXT_LO, fontFamily: FONT }}>
              Rádio · Maquinista
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: TEXT_MD, lineHeight: 1.5, fontFamily: FONT }}>
            "Avançar composição até a via de passagem{' '}
            <span style={{ fontWeight: 700, textTransform: 'uppercase', color: TEXT_HI }}>ETA 1</span>."
          </p>
        </div>
      </div>
    </div>
  );
}

interface TopologicalCenterProps {
  onLinhaClick: (linhaId: string) => void;
}

function TopologicalCenter({ onLinhaClick }: TopologicalCenterProps) {
  return (
    <div
      className="flex flex-col"
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: PANEL_BG,
        borderRadius: RADIUS,
        height: '100%',
        overflow: 'hidden',
        boxShadow: 'var(--vli-shadow)',
      }}
    >
      <PanelHeader
        title="Visão Topológica em Tempo Real"
        right={
          <div className="flex items-center" style={{ gap: '1rem' }}>
            {[
              { color: TRACK_FREE_BDR, label: 'Livre' },
              { color: VLI_PRIMARY_TEXT, label: 'Trem' },
              { color: TRACK_BLOCKED_BDR, label: 'Interditado' },
            ].map((item) => (
              <div key={item.label} className="flex items-center" style={{ gap: '0.5rem' }}>
                <div style={{ width: '1rem', height: '0.125rem', backgroundColor: item.color, borderRadius: '0.0625rem' }} />
                <span style={{ color: TEXT_MD, fontSize: '0.6875rem', fontFamily: FONT, fontWeight: 500 }}>{item.label}</span>
              </div>
            ))}
          </div>
        }
      />

      {/* Breadcrumb de operação */}
      <div style={{ padding: '1rem 1rem 0 1rem', display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            backgroundColor: BG_DEEP,
            border: `1px solid ${BORDER}`,
            borderRadius: RADIUS,
            padding: '0.5rem 1rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: TEXT_MD, fontFamily: FONT, fontWeight: 500 }}>
            (L3) Deslink VG 4552
          </span>
          <span style={{ color: BORDER, fontSize: '0.75rem', fontFamily: FONT }}>────</span>
          <span style={{ fontSize: '0.75rem', color: TEXT_MD, fontFamily: FONT, fontWeight: 500 }}>
            (EVS1) Avanço para ETA 1
          </span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: '1rem' }}>
        <TrainYardSVG executionMode={true} onTrackClick={onLinhaClick} />
      </div>
    </div>
  );
}

function InfoPanel() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="flex flex-col"
      style={{
        width: '20rem',
        flexShrink: 0,
        backgroundColor: PANEL_BG,
        borderRadius: RADIUS,
        overflow: 'hidden',
        boxShadow: 'var(--vli-shadow)',
      }}
    >
      <PanelHeader
        title="Informações"
        right={
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              color: TEXT_MD,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_HI; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_MD; }}
          >
            {collapsed ? <ChevronDown size="1rem" /> : <ChevronUp size="1rem" />}
          </button>
        }
      />

      {!collapsed && <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <SectionTitle>Ficha Técnica Integrada</SectionTitle>
          {[
            { label: 'OS', value: '9882/2026' },
            { label: 'Prefixo', value: 'J614' },
            { label: 'Comprimento', value: '765m' },
            { label: 'Peso Total', value: '3.200t' },
            { label: 'Num. Cauda', value: 'VG 4552', highlight: true },
          ].map((row, idx, arr) => (
            <div
              key={row.label}
              className="flex items-center justify-between"
              style={{
                padding: '0.5rem 0',
                borderBottom: idx < arr.length - 1 ? `1px solid ${BORDER}` : 'none',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: TEXT_LO, fontFamily: FONT, fontWeight: 500 }}>{row.label}</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: row.highlight ? 700 : 500,
                  color: row.highlight ? VLI_PRIMARY_TEXT : TEXT_HI,
                  fontFamily: FONT,
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <div>
          <SectionTitle>Ações Digitais</SectionTitle>

          <button
            style={{
              width: '100%',
              border: `1px solid ${BORDER}`,
              borderRadius: RADIUS,
              backgroundColor: 'transparent',
              padding: '1rem',
              marginBottom: '0.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'left',
              fontFamily: FONT,
              transition: 'background-color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = HOVER_TINT; e.currentTarget.style.borderColor = VLI_PRIMARY_TEXT; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = BORDER; }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: TEXT_HI, fontFamily: FONT }}>
                Sincronizar ficha de trem
              </div>
              <div style={{ fontSize: '0.6875rem', color: TEXT_LO, marginTop: '0.25rem', fontFamily: FONT, fontWeight: 500 }}>
                Enviar informações ao maquinista
              </div>
            </div>
            <ArrowRight size="1rem" color={VLI_PRIMARY_TEXT} strokeWidth={2.5} />
          </button>

          <button
            style={{
              width: '100%',
              border: `1px solid ${BORDER}`,
              borderRadius: RADIUS,
              backgroundColor: 'transparent',
              padding: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'left',
              fontFamily: FONT,
              transition: 'background-color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = HOVER_TINT; e.currentTarget.style.borderColor = VLI_PRIMARY_TEXT; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = BORDER; }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: TEXT_HI, fontFamily: FONT }}>
                Solicitar LDL
              </div>
              <div style={{ fontSize: '0.6875rem', color: TEXT_LO, marginTop: '0.25rem', fontFamily: FONT, fontWeight: 500 }}>
                Bloqueio de via digital
              </div>
            </div>
            <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', backgroundColor: VLI_PRIMARY_TEXT }} />
          </button>
        </div>
      </div>}
    </div>
  );
}

export function ExecucaoAoVivoScreen() {
  const [confirmado, setConfirmado] = useState(false);
  const [confirmacaoOpen, setConfirmacaoOpen] = useState(false);
  const [mudancaData, setMudancaData] = useState({
    linhaOriginal: 'EVS1 (ETA 1)',
    linhaNova: 'L4',
    tipo: 'linha' as 'linha' | 'ordem',
  });

  const handleLinhaClick = (linhaId: string) => {
    if (linhaId === 'L3') return;
    setMudancaData({ linhaOriginal: 'EVS1 (ETA 1)', linhaNova: linhaId, tipo: 'linha' });
    setConfirmacaoOpen(true);
  };

  const handleReordenar = () => {
    setMudancaData({ linhaOriginal: 'Ordem Original', linhaNova: 'Nova Ordem', tipo: 'ordem' });
    setConfirmacaoOpen(true);
  };

  return (
    <div
      className="flex flex-col"
      style={{ flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: BG_DEEP, fontFamily: FONT }}
    >
      {/* Main layout */}
      <div
        className="flex"
        style={{ flex: 1, minHeight: 0, padding: '1rem', gap: '1rem', overflow: 'hidden' }}
      >
        <TopologicalCenter onLinhaClick={handleLinhaClick} />

        <div className="flex flex-col" style={{ width: '20rem', height: '100%', gap: '1rem' }}>
          <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0, display: 'flex' }}>
            <RoteiroAtivoPanel onReordenar={handleReordenar} />
          </div>
          <InfoPanel />
        </div>
      </div>

      {/* Success toast */}
      {confirmado && (
        <div
          className="fixed bottom-6 left-1/2"
          style={{
            transform: 'translateX(-50%)',
            padding: '0.75rem 1.5rem',
            backgroundColor: TOAST_BG,
            border: `1px solid ${SUCCESS_BORDER}`,
            borderRadius: RADIUS,
            color: TOAST_TEXT,
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            fontFamily: FONT,
            zIndex: 100,
          }}
        >
          ✓ Alteração Registrada
        </div>
      )}

      <ConfirmacaoMudancaModal
        isOpen={confirmacaoOpen}
        onClose={() => setConfirmacaoOpen(false)}
        onConfirm={() => {
          setConfirmado(true);
          setTimeout(() => setConfirmado(false), 3000);
        }}
        linhaOriginal={mudancaData.linhaOriginal}
        linhaNova={mudancaData.linhaNova}
        tipo={mudancaData.tipo}
      />
    </div>
  );
}
