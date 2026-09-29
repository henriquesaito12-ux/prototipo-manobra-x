import { useState } from 'react';
import { Bell } from 'lucide-react';
import { PlanejamentoScreen } from './components/PlanejamentoScreen';
import { ParametersModal } from './components/ParametersModal';
import { FichaOperacaoScreen } from './components/FichaOperacaoScreen';
import { ExecucaoAoVivoScreen } from './components/ExecucaoAoVivoScreen';
import { Sidebar, type Screen } from './components/Sidebar';
import { PageHeader, HeaderTitulo } from './components/PageHeader';
import { PATIO_ATIVO } from './data/patio';
import { fichasMock, HOJE, type FichaResumo } from './data/fichaOperacao';
import type { AcoesOperacionais } from './data/fichaModelo';
import type { CorrecoesLeitura } from './data/correcoesLeitura';

// VLI tokens (mirror across components)
const BG_DEEP    = 'var(--vli-bg-deep)';
const BORDER     = 'var(--vli-border)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
const SUCCESS_BORDER    = 'var(--vli-success-border)';
const SUCCESS_BG        = 'var(--vli-success-bg)';
const SUCCESS_TEXT      = 'var(--vli-success-text)';
const TOAST_BG   = 'var(--vli-toast-success-bg)';
const TOAST_TEXT = 'var(--vli-toast-success-text)';
const FONT       = 'Manrope, sans-serif';
const RADIUS     = '0.375rem';

/** Header de "Execução Ao Vivo" — única tela sem dropdown de pátio/data (é um subtítulo
 *  estático + badge/sino), mas reaproveita a mesma casca/título do `PageHeader` compartilhado
 *  com Ficha Operacional e Planejamento (`PageHeader.tsx`), pra não divergir visualmente. */
function ContentHeader({ title, subtitle, action, showMeta = true }: { title: string; subtitle?: string; action?: React.ReactNode; showMeta?: boolean }) {
  return (
    <PageHeader
      acoes={
        <>
          {action}
          {showMeta && (
            <>
              <div
                className="flex items-center"
                style={{ gap: '0.375rem', padding: '0.25rem 0.625rem', borderRadius: RADIUS, border: `1px solid ${BORDER}` }}
              >
                <span style={{ color: TEXT_MD, fontSize: '0.6875rem', fontFamily: FONT, fontWeight: 500, whiteSpace: 'nowrap' }}>
                  25/05/2026 · Turno Ativo
                </span>
              </div>
              <Bell size="0.9375rem" color={TEXT_MD} style={{ cursor: 'pointer', flexShrink: 0 }} />
            </>
          )}
        </>
      }
    >
      <div className="flex items-baseline" style={{ gap: '0.625rem', minWidth: 0 }}>
        <HeaderTitulo>{title}</HeaderTitulo>
        {subtitle && (
          <span style={{ color: TEXT_LO, fontSize: '0.75rem', fontFamily: FONT, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
          </span>
        )}
      </div>
    </PageHeader>
  );
}

function AoVivoBadge() {
  return (
    <div
      className="flex items-center"
      style={{
        gap: '0.375rem',
        padding: '0.25rem 0.625rem',
        borderRadius: RADIUS,
        border: `1px solid ${SUCCESS_BORDER}`,
        backgroundColor: SUCCESS_BG,
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ width: '0.4375rem', height: '0.4375rem', borderRadius: '50%', backgroundColor: SUCCESS_TEXT }} />
      <span style={{ fontSize: '0.6875rem', color: SUCCESS_TEXT, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: FONT }}>
        Ao Vivo
      </span>
    </div>
  );
}

export default function App() {
  const [modalOpen, setModalOpen] = useState(false);
  const [toastMsg, setToastMsg]   = useState<string | null>(null);
  const [screen, setScreen]       = useState<Screen>('ficha');
  const [fichas, setFichas]       = useState(fichasMock);
  const [fichaFocoId, setFichaFocoId] = useState<string | null>(null);
  // Fichas de dias anteriores já foram tratadas no turno da época — só as de hoje começam pendentes.
  const [validadas, setValidadas] = useState<Record<string, boolean>>(() => {
    const seed: Record<string, boolean> = {};
    fichasMock.forEach((f) => {
      if (f.data !== HOJE) seed[f.id] = true;
    });
    return seed;
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleConfirmarPlano = (trem: string) => showToast(`✓ Plano do trem ${trem} confirmado`);
  const handleSalvarParametros = () => showToast('✓ Configuração Salva');

  // Ações Operacionais são o único dado da ficha editado na tela — os dados de leitura vêm da
  // fonte (`fonteDadosFicha.ts`) e não são alterados aqui.
  const handleAtualizarAcoes = (fichaId: string, acoes: AcoesOperacionais) => {
    setFichas((prev) => prev.map((f) => (f.id === fichaId ? { ...f, acoes } : f)));
  };

  const handleAtualizarCorrecoes = (fichaId: string, correcoes: CorrecoesLeitura) => {
    setFichas((prev) => prev.map((f) => (f.id === fichaId ? { ...f, correcoes } : f)));
  };

  const handleValidarFicha = (fichaId: string, v: boolean) => {
    setValidadas((prev) => ({ ...prev, [fichaId]: v }));
  };

  const handleCriarFicha = (novaFicha: FichaResumo) => {
    setFichas((prev) => [...prev, novaFicha]);
    setValidadas((prev) => ({ ...prev, [novaFicha.id]: false }));
  };

  // "Excluir" não apaga mais de verdade — só marca a ficha como estando na lixeira (mesmo
  // modelo do Gmail). Ela some da listagem principal mas continua no array `fichas` até
  // alguém escolher "Excluir definitivamente" na Lixeira (ou "Restaurar", que reverte isso).
  const handleMoverParaLixeira = (fichaId: string) => {
    setFichas((prev) =>
      prev.map((f) => (f.id === fichaId ? { ...f, excluidaEm: new Date().toISOString() } : f)),
    );
  };

  const handleRestaurarFicha = (fichaId: string) => {
    setFichas((prev) =>
      prev.map((f) => (f.id === fichaId ? { ...f, excluidaEm: undefined } : f)),
    );
  };

  // Esta sim remove de verdade — a única ação irreversível das três, só disponível de dentro
  // da Lixeira (e com confirmação explícita antes, ver `ExcluirDefinitivamenteModal`).
  const handleExcluirDefinitivamente = (fichaId: string) => {
    setFichas((prev) => prev.filter((f) => f.id !== fichaId));
    setValidadas((prev) => {
      const { [fichaId]: _removido, ...resto } = prev;
      return resto;
    });
  };

  // Badge da sidebar reflete a caixa de entrada inteira (todos os pátios) — fichas na lixeira
  // não contam mais como pendentes nem aparecem pro Plano de Manobra.
  const fichasHoje = fichas.filter((f) => f.data === HOJE && !f.excluidaEm);
  const pendentesFicha = fichasHoje.filter((f) => !validadas[f.id]).length;

  // Status da Ficha de Operação por trem, para todos os trens de hoje — é o que a barra de
  // seleção de trem do Plano de Manobra usa para saber se pode exibir o plano completo.
  const statusFichaPorTremTodos: Record<string, { pendente: boolean; fichaId: string }> = {};
  fichasHoje.forEach((f) => {
    statusFichaPorTremTodos[f.trem] = { pendente: !validadas[f.id], fichaId: f.id };
  });

  const handleRevisarFicha = (trem: string) => {
    const ficha = fichas.find((f) => f.trem === trem && f.data === HOJE);
    if (!ficha) return;
    setFichaFocoId(ficha.id);
    setScreen('ficha');
  };

  return (
    // `height: 100%` (não `100vh`) — 2026-08-28: com o `zoom: 0.8` global (`theme.css`), `vh`
    // continua sendo lido contra a altura REAL da viewport, sem compensar o zoom do ancestral
    // (`html`), sobrando uma faixa branca embaixo/à direita (20% do que o zoom "economizou"). A
    // cadeia `height: 100%` de `html`→`body`→`#root` (`index.html`) já compensa isso — `%` sim
    // resolve contra o box (já escalado) do pai, ao contrário de `vh`.
    <div className="flex" style={{ height: '100%', overflow: 'hidden', backgroundColor: BG_DEEP, fontFamily: FONT }}>
      <Sidebar screen={screen} onNavigate={setScreen} pendentesFicha={pendentesFicha} />

      <div className="flex flex-col" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {screen === 'ficha' && (
          <FichaOperacaoScreen
            fichas={fichas}
            validadas={validadas}
            onAtualizarAcoes={handleAtualizarAcoes}
            onAtualizarCorrecoes={handleAtualizarCorrecoes}
            onValidarFicha={handleValidarFicha}
            onCriarFicha={handleCriarFicha}
            onMoverParaLixeira={handleMoverParaLixeira}
            onRestaurarFicha={handleRestaurarFicha}
            onExcluirDefinitivamente={handleExcluirDefinitivamente}
            fichaFocoId={fichaFocoId}
            onFocoAplicado={() => setFichaFocoId(null)}
          />
        )}

        {screen === 'execucao' && (
          <>
            <ContentHeader
              title="Execução Ao Vivo"
              subtitle={`Pátio ${PATIO_ATIVO.nome} · Turno Carlos Eduardo`}
              action={<AoVivoBadge />}
            />
            <ExecucaoAoVivoScreen />
          </>
        )}

        {screen === 'planejamento' && (
          <PlanejamentoScreen
            onAjustarParametros={() => setModalOpen(true)}
            onConfirmar={handleConfirmarPlano}
            statusFichaPorTremTodos={statusFichaPorTremTodos}
            onRevisarFicha={handleRevisarFicha}
          />
        )}

        {toastMsg && (
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
            {toastMsg}
          </div>
        )}

        <ParametersModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSalvar={handleSalvarParametros}
        />
      </div>
    </div>
  );
}
