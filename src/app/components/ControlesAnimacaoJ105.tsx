import { ChevronLeft, ChevronRight, Crosshair, Maximize2, Pause, Play, RotateCcw } from 'lucide-react';
import {
  DURACAO_TOTAL_J105,
  ESTAGIOS_J105,
  TEMPO_EM_CORTE_J105,
  TEMPO_EM_MARCHA_J105,
  TEMPO_PARADO_J105,
  formatarRelogioJ105,
} from '../data/animacaoJ105';
import { HeaderTooltip } from './PageHeader';

// Controles de reprodução da Visão Topológica animada — EXCLUSIVOS do J105 V2.
//
// Portados em CONCEITO da engine de referência da equipe
// (`animacao/ficha-1090-vmx539-only1A-patio-animado.html`): play/pause, seletor de velocidade,
// "Pátio inteiro" × "Seguir a peça", navegação por etapa e scrubber de tempo. Nada do CSS dela
// veio junto — lá os botões usam uma paleta própria (`--accent`, `--surface-2`); aqui tudo usa os
// tokens do Manobra X e o MESMO chrome dos outros controles flutuantes do mapa (`BotaoZoom`,
// `MapaNavegacaoPainel`): `PANEL_BG` + borda + `var(--vli-shadow)`, Manrope, cantos de 0.25rem.
//
// Também enxugado em relação ao protótipo: 3 velocidades em vez de 5 (1×/30× real e 120× já
// cobrem "acompanhar uma ação", "ver a etapa" e "varrer o plano"; os 5 níveis dele eram para um
// cenário de 2 h em tela cheia), e os cartões de estatística do topo viraram uma linha discreta
// dentro da própria barra, em vez de uma faixa de 5 cards acima do mapa.

const PANEL_BG = 'var(--vli-panel-bg)';
const BORDER = 'var(--vli-border)';
const TEXT_HI = 'var(--vli-text-hi)';
const TEXT_MD = 'var(--vli-text-md)';
const TEXT_LO = 'var(--vli-text-lo)';
const VLI_PRIMARY = 'var(--vli-primary-text)';
const VLI_PRIMARY_SOLID = 'var(--vli-primary)';
const FONT = 'Manrope, sans-serif';

/**
 * Multiplicadores de tempo oferecidos. 1× é tempo real (o plano inteiro leva ~1 h 54), por isso
 * vem com o aviso de quanto disso é gente parada — sem ele a tela parece travada.
 * A escala cobre dois usos opostos, por pedido explícito do usuário (2026-09-23): 30×/60× pra
 * acompanhar um deslocamento com detalhe, e 300×/600× pra atravessar rápido os trechos longos de
 * tempo humano parado (o Fechamento final sozinho tem 810 s sem ninguém se mexer).
 */
export const VELOCIDADES_J105 = [1, 30, 60, 120, 300, 600] as const;
export type VelocidadeJ105 = (typeof VELOCIDADES_J105)[number];

function BotaoControle({
  onClick,
  title,
  ativo = false,
  children,
  largura,
}: {
  onClick: () => void;
  title: string;
  ativo?: boolean;
  children: React.ReactNode;
  largura?: string;
}) {
  return (
    <HeaderTooltip label={title}><button
      onClick={onClick}
     
      aria-label={title}
      aria-pressed={ativo}
      className="flex items-center justify-center"
      style={{
        height: '1.625rem',
        minWidth: largura ?? '1.625rem',
        padding: largura ? '0 0.4375rem' : 0,
        gap: '0.25rem',
        border: `1px solid ${ativo ? VLI_PRIMARY_SOLID : BORDER}`,
        borderRadius: '0.25rem',
        backgroundColor: ativo ? VLI_PRIMARY_SOLID : PANEL_BG,
        color: ativo ? '#fff' : TEXT_MD,
        fontSize: '0.625rem',
        fontWeight: 600,
        fontFamily: FONT,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        if (ativo) return;
        e.currentTarget.style.color = TEXT_HI;
        e.currentTarget.style.borderColor = VLI_PRIMARY;
      }}
      onMouseLeave={(e) => {
        if (ativo) return;
        e.currentTarget.style.color = TEXT_MD;
        e.currentTarget.style.borderColor = BORDER;
      }}
    >
      {children}
    </button></HeaderTooltip>
  );
}

/** Grupo segmentado (velocidade/enquadramento) — botões colados, mesma altura dos demais. */
function Segmentado({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center" style={{ gap: '0.125rem' }}>
      {children}
    </div>
  );
}

/**
 * Régua do tempo — cada etapa aparece como uma fatia, com a parte de TEMPO HUMANO (parado) em tom
 * neutro e a de marcha no azul do produto, exatamente a divisão que `EstagioJ105` guarda. É a
 * ideia da `drawTimeline()` da engine de referência, com duas diferenças: aqui ela também é o
 * scrubber (clicar/arrastar navega no tempo — no protótipo eram dois controles separados, um
 * `<input type=range>` e um SVG só de leitura), e o cursor usa o token de destaque do produto.
 */
function ReguaTempo({
  tempoS,
  onSeek,
  indiceEstagio,
}: {
  tempoS: number;
  onSeek: (t: number) => void;
  indiceEstagio: number;
}) {
  const pct = (t: number) => (DURACAO_TOTAL_J105 > 0 ? (t / DURACAO_TOTAL_J105) * 100 : 0);

  const seekDoEvento = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0) return;
    const fracao = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    onSeek(fracao * DURACAO_TOTAL_J105);
  };

  return (
    <div
      role="slider"
      aria-label="Linha do tempo da manobra"
      aria-valuemin={0}
      aria-valuemax={Math.round(DURACAO_TOTAL_J105)}
      aria-valuenow={Math.round(tempoS)}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        seekDoEvento(e);
      }}
      onPointerMove={(e) => {
        // Só arrasta com o botão pressionado (`buttons` é um bitmask; 1 = principal).
        if (e.buttons & 1) seekDoEvento(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(tempoS + 30); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(tempoS - 30); }
      }}
      style={{
        position: 'relative',
        height: '0.875rem',
        flex: 1,
        minWidth: '5rem',
        cursor: 'pointer',
        borderRadius: '0.1875rem',
        overflow: 'hidden',
        backgroundColor: 'var(--vli-surface)',
        border: `1px solid ${BORDER}`,
        touchAction: 'none',
      }}
    >
      {ESTAGIOS_J105.map((e, i) => (
        <div key={e.passo}>
          {/* tempo humano (parado) */}
          <div
            style={{
              position: 'absolute',
              left: `${pct(e.t0)}%`,
              width: `${pct(e.offsetS)}%`,
              top: 0,
              bottom: 0,
              backgroundColor: TEXT_LO,
              opacity: i === indiceEstagio ? 0.45 : 0.22,
            }}
          />
          {/* marcha (ou operação de corte, mais discreta — o trem não anda nela) */}
          <div
            style={{
              position: 'absolute',
              left: `${pct(e.t0 + e.offsetS)}%`,
              width: `${pct(e.moveS)}%`,
              top: 0,
              bottom: 0,
              backgroundColor: e.rolaDeFato ? VLI_PRIMARY_SOLID : TEXT_LO,
              opacity: e.rolaDeFato ? (i === indiceEstagio ? 0.95 : 0.55) : i === indiceEstagio ? 0.6 : 0.3,
            }}
          />
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: `${pct(tempoS)}%`,
          top: 0,
          bottom: 0,
          width: '2px',
          marginLeft: '-1px',
          backgroundColor: TEXT_HI,
        }}
      />
    </div>
  );
}

export function ControlesAnimacaoJ105({
  tempoS,
  tocando,
  velocidade,
  seguindo,
  passo,
  indiceEstagio,
  emMarcha,
  onTocarPausar,
  onVelocidade,
  onSeguir,
  onSeek,
  onEtapa,
}: {
  tempoS: number;
  tocando: boolean;
  velocidade: VelocidadeJ105;
  /** `true` = câmera segue a composição; `false` = pátio inteiro. */
  seguindo: boolean;
  /** Passo (1..38) corrente — mostrado no relógio, sincronizado com a lista de passos. */
  passo: number;
  indiceEstagio: number;
  emMarcha: boolean;
  onTocarPausar: () => void;
  onVelocidade: (v: VelocidadeJ105) => void;
  onSeguir: (seguir: boolean) => void;
  onSeek: (t: number) => void;
  onEtapa: (direcao: -1 | 1) => void;
}) {
  return (
    <div
      className="flex flex-col"
      style={{
        gap: '0.375rem',
        padding: '0.375rem 0.5rem',
        borderRadius: '0.375rem',
        border: `1px solid ${BORDER}`,
        backgroundColor: PANEL_BG,
        boxShadow: 'var(--vli-shadow)',
        fontFamily: FONT,
      }}
    >
      <div className="flex items-center flex-wrap" style={{ gap: '0.375rem' }}>
        <BotaoControle onClick={onTocarPausar} title={tocando ? 'Pausar' : 'Tocar'} ativo={tocando}>
          {tocando ? <Pause size="0.75rem" fill="currentColor" /> : <Play size="0.75rem" fill="currentColor" />}
        </BotaoControle>

        <BotaoControle onClick={() => onSeek(0)} title="Voltar ao início">
          <RotateCcw size="0.6875rem" />
        </BotaoControle>

        <Segmentado>
          <BotaoControle onClick={() => onEtapa(-1)} title="Etapa anterior">
            <ChevronLeft size="0.75rem" />
          </BotaoControle>
          <BotaoControle onClick={() => onEtapa(1)} title="Próxima etapa">
            <ChevronRight size="0.75rem" />
          </BotaoControle>
        </Segmentado>

        <Segmentado>
          {VELOCIDADES_J105.map((v) => (
            <BotaoControle
              key={v}
              onClick={() => onVelocidade(v)}
              title={v === 1 ? 'Tempo real (1 s da animação = 1 s no pátio)' : `${v} vezes mais rápido que o tempo real`}
              ativo={velocidade === v}
              largura="auto"
            >
              {v}×
            </BotaoControle>
          ))}
        </Segmentado>

        <Segmentado>
          <BotaoControle onClick={() => onSeguir(false)} title="Enquadrar o pátio inteiro" ativo={!seguindo}>
            <Maximize2 size="0.6875rem" />
          </BotaoControle>
          <BotaoControle onClick={() => onSeguir(true)} title="Seguir a composição em movimento" ativo={seguindo}>
            <Crosshair size="0.6875rem" />
          </BotaoControle>
        </Segmentado>

        <div
          className="flex items-baseline"
          style={{ gap: '0.25rem', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}
        >
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: TEXT_HI }}>{formatarRelogioJ105(tempoS)}</span>
          <span style={{ fontSize: '0.625rem', color: TEXT_LO }}>/ {formatarRelogioJ105(DURACAO_TOTAL_J105)}</span>
        </div>
      </div>

      <div className="flex items-center" style={{ gap: '0.5rem' }}>
        <span
          style={{
            fontSize: '0.5625rem',
            fontWeight: 700,
            color: TEXT_LO,
            letterSpacing: '0.025em',
            whiteSpace: 'nowrap',
            minWidth: '3.25rem',
          }}
        >
          PASSO {passo}
        </span>
        <ReguaTempo tempoS={tempoS} onSeek={onSeek} indiceEstagio={indiceEstagio} />
      </div>

      {/* Indicadores de contexto — versão discreta dos cartões de estatística do protótipo de
         referência: uma linha só, dentro da própria barra, em vez de uma faixa de cards acima do
         mapa (que não cabe no painel lateral da Visão Topológica sem empurrar o canvas). */}
      <div
        className="flex items-center flex-wrap"
        style={{ gap: '0.5rem', fontSize: '0.5625rem', color: TEXT_LO, fontVariantNumeric: 'tabular-nums' }}
      >
        <span style={{ color: emMarcha ? VLI_PRIMARY : TEXT_LO, fontWeight: emMarcha ? 700 : 500 }}>
          {emMarcha ? 'Em marcha' : 'Parado'}
        </span>
        <span style={{ color: BORDER }}>·</span>
        <span>Marcha {formatarRelogioJ105(TEMPO_EM_MARCHA_J105)}</span>
        <span style={{ color: BORDER }}>·</span>
        <span>Tempo humano {formatarRelogioJ105(TEMPO_PARADO_J105)}</span>
        {/* Sem esta terceira parcela os dois números acima não fecham com o total do relógio: a
           operação de corte é tempo com o trem PARADO que não é tempo humano de espera (ver
           `DURACAO_CORTE_S`), então não cabe em nenhuma das outras duas. */}
        <span style={{ color: BORDER }}>·</span>
        <span>Corte {formatarRelogioJ105(TEMPO_EM_CORTE_J105)}</span>
        {velocidade === 1 && (
          <>
            <span style={{ color: BORDER }}>·</span>
            <span>
              tempo real — {Math.round((100 * TEMPO_PARADO_J105) / Math.max(1, DURACAO_TOTAL_J105))}% do plano é gente
              parada
            </span>
          </>
        )}
      </div>
    </div>
  );
}
