import { rotuloDaLinha } from '../data/patio';

interface TrainYardSVGProps {
  onTrackClick?: (trackId: string) => void;
  executionMode?: boolean;
  /** Reservado para a futura sincronização visual com o cluster/etapa ativo no Plano Manobra X. Ainda não utilizado. */
  etapaAtivaId?: string | null;
}

// Track band height — thinner to match the compact inner group
const TH = 9;

const FREE_FILL    = 'var(--vli-track-free-fill)';
const FREE_BDR     = 'var(--vli-track-free-border)';
const BLOCKED_FILL = 'var(--vli-track-blocked-fill)';
const BLOCKED_BDR  = 'var(--vli-track-blocked-border)';
const TRAIN_FILL   = 'var(--vli-track-train-fill)';
const TEXT_HI      = 'var(--vli-text-hi)';
const TEXT_LO      = 'var(--vli-text-lo)';
const DANGER       = 'var(--vli-danger)';
const DANGER_TEXT  = 'var(--vli-danger-text)';
const DANGER_BG    = 'var(--vli-danger-bg)';
const WARNING_TEXT = 'var(--vli-warning-text)';

// ── Y centers — equal 28 px spacing (centre-to-centre) ────────────────────
const YLP =  14;
const Y7  =  42;
const Y6  =  70;
const Y5  =  98;
const Y4  = 126;
const Y3  = 154;
const Y2  = 182;
const Y1  = 210;

const YCCO = 232;
const YE1  = 250;
const YE2  = 268;

// ── X extents ──────────────────────────────────────────────────────────────
// L1–L4 span x=80–980 (same start and length as the CCO/EVS lines).
// L5–LP keep staggered starts from the reference SVG topology.
const LP_XS = 440, LP_XE = 550;
const L7_XS = 285, L7_XE = 635;
const L6_XS = 245, L6_XE = 955;
const L5_XS = 160, L5_XE = 960;
const L4_XS =  80, L4_XE = 980;   // aligned with CCO ─────────────────────
const L3_XS =  80, L3_XE = 980;
const L2_XS =  80, L2_XE = 980;
const L1_XS =  80, L1_XE = 980;

// ── Track descriptors ──────────────────────────────────────────────────────
interface Track {
  id: string; label: string; y: number;
  xStart: number; xEnd: number;
  color: string; border: string;
  isDashed?: boolean; isBlocked?: boolean; isTransit?: boolean;
  trainLabel?: string; trainX?: number; trainW?: number;
}

const getTracksForMode = (executionMode: boolean): Track[] => {
  if (executionMode) {
    // Execução Ao Vivo - Trem J614 na L3 pronto para deslink
    return [
      { id: 'LP', label: rotuloDaLinha('L8'), y: YLP, xStart: LP_XS, xEnd: LP_XE, color: FREE_FILL, border: FREE_BDR, isTransit: true },
      { id: 'L7', label: rotuloDaLinha('L7'), y: Y7,  xStart: L7_XS, xEnd: L7_XE, color: FREE_FILL, border: FREE_BDR },
      { id: 'L6', label: rotuloDaLinha('L6'), y: Y6,  xStart: L6_XS, xEnd: L6_XE, color: FREE_FILL, border: FREE_BDR },
      { id: 'L5', label: rotuloDaLinha('L5'), y: Y5,  xStart: L5_XS, xEnd: L5_XE, color: FREE_FILL, border: FREE_BDR },
      { id: 'L4', label: rotuloDaLinha('L4'), y: Y4,  xStart: L4_XS, xEnd: L4_XE, color: FREE_FILL, border: FREE_BDR },
      { id: 'L3', label: rotuloDaLinha('L3'), y: Y3,  xStart: L3_XS, xEnd: L3_XE, color: TRAIN_FILL,  border: FREE_BDR,
        trainLabel: 'J614: 02 GT46 + 08 VG (Cauda: VG 4552)', trainX: 0.12, trainW: 320 },
      { id: 'L2', label: rotuloDaLinha('L2'), y: Y2,  xStart: L2_XS, xEnd: L2_XE, color: FREE_FILL, border: FREE_BDR },
      { id: 'L1', label: rotuloDaLinha('L1'), y: Y1,  xStart: L1_XS, xEnd: L1_XE, color: FREE_FILL, border: FREE_BDR },
    ];
  } else {
    // Planejamento - Estado original
    return [
      { id: 'LP', label: rotuloDaLinha('L8'), y: YLP, xStart: LP_XS, xEnd: LP_XE, color: FREE_FILL, border: FREE_BDR, isTransit: true },
      { id: 'L7', label: rotuloDaLinha('L7'), y: Y7,  xStart: L7_XS, xEnd: L7_XE, color: FREE_FILL, border: FREE_BDR },
      { id: 'L6', label: rotuloDaLinha('L6'), y: Y6,  xStart: L6_XS, xEnd: L6_XE, color: FREE_FILL, border: FREE_BDR },
      { id: 'L5', label: rotuloDaLinha('L5'), y: Y5,  xStart: L5_XS, xEnd: L5_XE, color: FREE_FILL, border: FREE_BDR },
      { id: 'L4', label: rotuloDaLinha('L4'), y: Y4,  xStart: L4_XS, xEnd: L4_XE, color: BLOCKED_FILL, border: BLOCKED_BDR, isBlocked: true },
      { id: 'L3', label: rotuloDaLinha('L3'), y: Y3,  xStart: L3_XS, xEnd: L3_XE, color: TRAIN_FILL,  border: FREE_BDR,
        trainLabel: '01 GT46 + 02 U20 + 08 VG', trainX: 0.08, trainW: 240 },
      { id: 'L2', label: rotuloDaLinha('L2'), y: Y2,  xStart: L2_XS, xEnd: L2_XE, color: FREE_FILL,   border: FREE_BDR,
        trainLabel: '04 Dash Planalto', trainX: 0.36, trainW: 170 },
      { id: 'L1', label: rotuloDaLinha('L1'), y: Y1,  xStart: L1_XS, xEnd: L1_XE, color: FREE_FILL,   border: FREE_BDR },
    ];
  }
};

export function TrainYardSVG({ onTrackClick, executionMode = false }: TrainYardSVGProps) {
  const tracks = getTracksForMode(executionMode);

  return (
    <svg viewBox="-180 0 1220 292" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke={BLOCKED_BDR} strokeWidth="3" />
        </pattern>
      </defs>

      {/* ── AMVs nas extremidades - Efeito semi-paralelepípedo ──── */}

      {/* LP - conectores nas extremidades */}
      <line x1={LP_XS} y1={YLP} x2={L7_XS} y2={Y7} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.5" />
      <line x1={LP_XE} y1={YLP} x2={L7_XE} y2={Y7} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.5" />

      {/* L7 - conectores nas extremidades */}
      <line x1={L7_XS} y1={Y7} x2={L6_XS} y2={Y6} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />
      <line x1={L7_XE} y1={Y7} x2={L6_XE} y2={Y6} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />

      {/* L6 - conectores nas extremidades */}
      <line x1={L6_XS} y1={Y6} x2={L5_XS} y2={Y5} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />
      <line x1={L6_XE} y1={Y6} x2={L5_XE} y2={Y5} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />

      {/* L5 - conectores nas extremidades */}
      <line x1={L5_XS} y1={Y5} x2={L4_XS} y2={Y4} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />
      <line x1={L5_XE} y1={Y5} x2={L4_XE} y2={Y4} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />

      {/* L4 - conectores nas extremidades */}
      <line x1={L4_XS} y1={Y4} x2={L3_XS} y2={Y3} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />
      <line x1={L4_XE} y1={Y4} x2={L3_XE} y2={Y3} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />

      {/* L3 - conectores nas extremidades */}
      <line x1={L3_XS} y1={Y3} x2={L2_XS} y2={Y2} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />
      <line x1={L3_XE} y1={Y3} x2={L2_XE} y2={Y2} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />

      {/* L2 - conectores nas extremidades */}
      <line x1={L2_XS} y1={Y2} x2={L1_XS} y2={Y1} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />
      <line x1={L2_XE} y1={Y2} x2={L1_XE} y2={Y1} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />

      {/* EVS - conectores nas extremidades (L1 até EVS) */}
      <line x1={L1_XS} y1={Y1} x2={80} y2={YE1} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />
      <line x1={L1_XE} y1={Y1} x2={980} y2={YE1} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />
      <line x1={80} y1={YE1} x2={80} y2={YE2} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />
      <line x1={980} y1={YE1} x2={980} y2={YE2} stroke={FREE_BDR} strokeWidth="1.2" opacity="0.6" />

      {/* ── Track bands ───────────────────────────────────────────────────── */}
      {tracks.map((t) => {
        const topY = t.y - TH / 2;
        const w    = t.xEnd - t.xStart;
        return (
          <g key={t.id} onClick={() => onTrackClick?.(t.id)} style={{ cursor: 'pointer' }}>
            {t.isDashed ? (
              <rect x={t.xStart} y={topY} width={w} height={TH}
                fill={t.color} stroke={t.border} strokeWidth="1" strokeDasharray="12 6" />
            ) : t.isBlocked ? (
              <>
                <rect x={t.xStart} y={topY} width={w} height={TH}
                  fill="url(#hatch)" stroke={t.border} strokeWidth="1" />
                <rect x={t.xStart} y={topY} width={w} height={TH}
                  fill="none" stroke={t.border} strokeWidth="1" />
              </>
            ) : t.isTransit ? (
              <rect x={t.xStart} y={topY} width={w} height={TH}
                fill={t.color} stroke={t.border} strokeWidth="1" strokeDasharray="18 5" />
            ) : (
              <rect x={t.xStart} y={topY} width={w} height={TH}
                fill={t.color} stroke={t.border} strokeWidth="1" />
            )}
            {/* Centre rail line */}
            <line x1={t.xStart} y1={t.y} x2={t.xEnd} y2={t.y}
              stroke={t.border} strokeWidth="0.5"
              strokeDasharray={t.isDashed ? '8 4' : t.isTransit ? '14 4' : undefined} />
          </g>
        );
      })}

      {/* ── Train markers ─────────────────────────────────────────────── */}
      {tracks.map((t, idx) => {
        if (!t.trainLabel || !t.trainX || !t.trainW) return null;
        const mx = t.xStart + (t.xEnd - t.xStart) * t.trainX;

        // Modo Execução - L3 com detalhamento de vagões
        if (executionMode && t.id === 'L3') {
          const locomotivaW = 60;
          const vagaoW = 50;
          const gap = 4;
          const vagaoCaudaW = 55;

          return (
            <g key={`train-${idx}`}>
              {/* Locomotiva 1 - GT46 */}
              <rect x={mx} y={t.y - 13} width={locomotivaW} height={26}
                fill="#0D2847" stroke="#FBBF24" strokeWidth="2" rx="1" />
              <rect x={mx + 4} y={t.y - 9} width={8} height={18}
                fill="#FBBF24" rx="1" />

              {/* Locomotiva 2 */}
              <rect x={mx + locomotivaW + gap} y={t.y - 13} width={locomotivaW} height={26}
                fill="#0D2847" stroke="#FBBF24" strokeWidth="2" rx="1" />
              <rect x={mx + locomotivaW + gap + 4} y={t.y - 9} width={8} height={18}
                fill="#FBBF24" rx="1" />

              {/* Vagão 1 */}
              <rect x={mx + 2 * locomotivaW + 2 * gap} y={t.y - 13} width={vagaoW} height={26}
                fill="#0A1E3D" stroke="#FBBF24" strokeWidth="1.5" rx="1" />

              {/* Vagão 2 */}
              <rect x={mx + 2 * locomotivaW + 2 * gap + vagaoW + gap} y={t.y - 13} width={vagaoW} height={26}
                fill="#0A1E3D" stroke="#FBBF24" strokeWidth="1.5" rx="1" />

              {/* Vagão 3 */}
              <rect x={mx + 2 * locomotivaW + 2 * gap + 2 * vagaoW + 2 * gap} y={t.y - 13} width={vagaoW} height={26}
                fill="#0A1E3D" stroke="#FBBF24" strokeWidth="1.5" rx="1" />

              {/* INDICADOR DE MANOBRA - linha tracejada vermelha */}
              <line
                x1={mx + 2 * locomotivaW + 2 * gap + 3 * vagaoW + 3 * gap}
                y1={t.y - 18}
                x2={mx + 2 * locomotivaW + 2 * gap + 3 * vagaoW + 3 * gap}
                y2={t.y + 18}
                stroke="#EF4444" strokeWidth="2" strokeDasharray="4 2" />
              <circle
                cx={mx + 2 * locomotivaW + 2 * gap + 3 * vagaoW + 3 * gap}
                cy={t.y - 22}
                r="4"
                fill="#EF4444" />

              {/* Vagão de Cauda (VG 4552) - após a linha de deslink */}
              <rect x={mx + 2 * locomotivaW + 2 * gap + 3 * vagaoW + 4 * gap} y={t.y - 13} width={vagaoCaudaW} height={26}
                fill="#0A1E3D" stroke="#EF4444" strokeWidth="2" rx="1" />

              {/* Label "DESLINK" */}
              <text
                x={mx + 2 * locomotivaW + 2 * gap + 3 * vagaoW + 3 * gap}
                y={t.y - 26}
                textAnchor="middle"
                fill="#EF4444"
                fontSize={8}
                fontWeight={700}
                fontFamily="Inter, sans-serif">
                DESLINK
              </text>
            </g>
          );
        }

        // Modo normal ou outros trens - com preenchimento sólido
        return (
          <rect key={`train-${idx}`} x={mx} y={t.y - 13} width={t.trainW} height={26}
            fill={TRAIN_FILL} stroke={WARNING_TEXT} strokeWidth="2" rx="1" />
        );
      })}

      {/* ── Blocked label box L4 (only in planning mode) ────────────────── */}
      {!executionMode && (() => {
        const t = tracks[4];
        const bx = t.xStart + (t.xEnd - t.xStart) * 0.38;
        return <rect x={bx} y={t.y - 10} width={148} height={20}
          fill={BLOCKED_FILL} stroke={BLOCKED_BDR} strokeWidth="1.2" rx="1" />;
      })()}

      {/* ── CCO separator ───────────────────────────────────────────────── */}
      <line x1="60" y1={YCCO} x2="1040" y2={YCCO}
        stroke={FREE_BDR} strokeWidth="1.5" strokeDasharray="10 5" />

      {/* ── EVS tracks ──────────────────────────────────────────────────── */}
      <rect x="80" y={YE1 - 6} width="900" height="12"
        fill={FREE_FILL} stroke={FREE_BDR} strokeWidth="1" />
      <line x1="80" y1={YE1} x2="980" y2={YE1} stroke={FREE_BDR} strokeWidth="0.5" />
      <rect x={856} y={YE1 - 10} width={96} height={20}
        fill={DANGER_BG} stroke={DANGER} strokeWidth="1" rx="1" />

      <rect x="80" y={YE2 - 6} width="900" height="12"
        fill={FREE_FILL} stroke={FREE_BDR} strokeWidth="1" />
      <line x1="80" y1={YE2} x2="980" y2={YE2} stroke={FREE_BDR} strokeWidth="0.5" />
      <rect x="210" y={YE2 - 8} width="100" height="16"
        fill={FREE_FILL} stroke={FREE_BDR} strokeWidth="1" strokeDasharray="4 2" rx="1" />
      <rect x={856} y={YE2 - 10} width={96} height={20}
        fill={DANGER_BG} stroke={DANGER} strokeWidth="1" rx="1" />

      {/* ── All text — rendered last ─────────────────────────────────────── */}
      <g fontFamily="Inter, sans-serif" style={{ pointerEvents: 'none' }}>

        {/* Track labels — all left-aligned at x=72 */}
        {tracks.map((t) => (
          <text
            key={`lbl-${t.id}`}
            x={72} y={t.y}
            textAnchor="end" dominantBaseline="middle"
            fill={t.isDashed ? TEXT_LO : t.isTransit ? FREE_BDR : TEXT_HI}
            fontSize={t.isTransit ? 10 : 12} fontWeight={t.isTransit ? 500 : 600}>
            {t.label}
          </text>
        ))}

        {/* Train labels */}
        {tracks.map((t, idx) => {
          if (!t.trainLabel || !t.trainX || !t.trainW) return null;
          const mx = t.xStart + (t.xEnd - t.xStart) * t.trainX;

          // Labels detalhados para execução L3
          if (executionMode && t.id === 'L3') {
            return (
              <g key={`train-lbl-${idx}`}>
                {/* Label GT46 */}
                <text x={mx + 30} y={t.y + 0.5}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#FBBF24" fontSize={8} fontWeight={700}>
                  GT46
                </text>

                {/* Label segunda locomotiva */}
                <text x={mx + 94} y={t.y + 0.5}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#FBBF24" fontSize={8} fontWeight={700}>
                  GT46
                </text>

                {/* Label Vagões */}
                <text x={mx + 169} y={t.y + 0.5}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#FBBF24" fontSize={8} fontWeight={600}>
                  VG
                </text>

                <text x={mx + 223} y={t.y + 0.5}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#FBBF24" fontSize={8} fontWeight={600}>
                  VG
                </text>

                <text x={mx + 277} y={t.y + 0.5}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#FBBF24" fontSize={8} fontWeight={600}>
                  VG
                </text>

                {/* Label Vagão de Cauda */}
                <text x={mx + 338.5} y={t.y + 0.5}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#EF4444" fontSize={8} fontWeight={700}>
                  VG 4552
                </text>
              </g>
            );
          }

          return (
            <text key={`train-lbl-${idx}`} x={mx + t.trainW / 2} y={t.y + 0.5}
              textAnchor="middle" dominantBaseline="middle"
              fill={WARNING_TEXT} fontSize={10} fontWeight={700}>
              {t.trainLabel}
            </text>
          );
        })}

        {/* Blocked label L4 (only in planning mode) */}
        {!executionMode && (() => {
          const t = tracks[4];
          const bx = t.xStart + (t.xEnd - t.xStart) * 0.38;
          return (
            <text x={bx + 74} y={t.y + 0.5}
              textAnchor="middle" dominantBaseline="middle"
              fill={DANGER_TEXT} fontSize={9} fontWeight={700} letterSpacing={0.5}>
              INTERDITADA (MRS)
            </text>
          );
        })()}

        {/* CCO separator label */}
        <text x={432} y={YCCO} textAnchor="middle" dominantBaseline="middle"
          fill={TEXT_LO} fontSize={9} letterSpacing={0.5}>
          LINHAS DE PASSAGEM (CCO)
        </text>

        {/* EVS labels */}
        <text x={72} y={YE1} textAnchor="end" dominantBaseline="middle"
          fill={TEXT_HI} fontSize={10} fontWeight={600}>{rotuloDaLinha('EVS1')}</text>
        <text x={72} y={YE2} textAnchor="end" dominantBaseline="middle"
          fill={TEXT_HI} fontSize={10} fontWeight={600}>{rotuloDaLinha('EVS2')}</text>

        {/* ETA badges */}
        <text x={904} y={YE1} textAnchor="middle" dominantBaseline="middle"
          fill={DANGER_TEXT} fontSize={10} fontWeight={700}>ETA 1</text>
        <text x={904} y={YE2} textAnchor="middle" dominantBaseline="middle"
          fill={DANGER_TEXT} fontSize={10} fontWeight={700}>ETA 2</text>

        {/* V606 label */}
        <text x={260} y={YE2} textAnchor="middle" dominantBaseline="middle"
          fill={TEXT_LO} fontSize={9}>V606 (CCO)</text>

      </g>

      {/* ── Rota de navegação (Execução) - RENDERIZADA POR ÚLTIMO (ACIMA DE TUDO) ──── */}
      {executionMode && (() => {
        // Trem J614 na L3 indo para ETA 1 (EVS1)
        const trainL3 = tracks.find(t => t.id === 'L3');
        if (!trainL3) return null;

        // FRENTE da composição = início das locomotivas GT46 (lado ESQUERDO)
        const trainFrontX = trainL3.xStart + (trainL3.xEnd - trainL3.xStart) * trainL3.trainX!;

        // Destino: início do badge ETA 1 na EVS1 (antes do texto)
        const destX = 840; // Antes do início do badge ETA 1 que começa em x=856

        // Rota seguindo a malha ferroviária PELA ESQUERDA:
        // 1. Da FRENTE do trem (locomotivas GT46) vai para a ESQUERDA até a extremidade ESQUERDA da L3
        // 2. Desce pela diagonal (AMV esquerdo) até L2
        // 3. Segue horizontal pela L2 até extremidade ESQUERDA
        // 4. Desce pela diagonal (AMV esquerdo) até L1
        // 5. Segue horizontal pela L1 até extremidade ESQUERDA
        // 6. Desce pela diagonal (AMV esquerdo) até EVS1
        // 7. Segue horizontal pela EVS1 até ETA 1

        const path = `
          M ${trainFrontX} ${Y3}
          L ${L3_XS} ${Y3}
          L ${L2_XS} ${Y2}
          L ${L2_XS} ${Y2}
          L ${L1_XS} ${Y1}
          L ${L1_XS} ${Y1}
          L ${80} ${YE1}
          L ${destX} ${YE1}
        `;

        return (
          <g>
            {/* Linha de brilho por baixo */}
            <path
              d={path}
              fill="none"
              stroke="#60A5FA"
              strokeWidth="8"
              strokeDasharray="14 6"
              opacity="0.4"
            />

            {/* Linha tracejada guia - azul brilhante - seguindo os trilhos */}
            <path
              d={path}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="4"
              strokeDasharray="14 6"
              opacity="1"
            />

            {/* Marcador de PARTIDA na frente das locomotivas GT46 (LADO ESQUERDO) */}
            <g transform={`translate(${trainFrontX}, ${Y3})`}>
              <circle r="7" fill="#22C55E" stroke="#86EFAC" strokeWidth="2" />
              <circle r="11" fill="none" stroke="#22C55E" strokeWidth="1.5" opacity="0.6" />
              <circle r="16" fill="none" stroke="#22C55E" strokeWidth="1" opacity="0.4" />
            </g>

            {/* Marcadores nos pontos de mudança (AMVs ESQUERDOS) */}
            <circle cx={L3_XS} cy={Y3} r="4" fill="#3B82F6" stroke="#60A5FA" strokeWidth="1.5" />
            <circle cx={L2_XS} cy={Y2} r="4" fill="#3B82F6" stroke="#60A5FA" strokeWidth="1.5" />
            <circle cx={L1_XS} cy={Y1} r="4" fill="#3B82F6" stroke="#60A5FA" strokeWidth="1.5" />
            <circle cx={80} cy={YE1} r="4" fill="#3B82F6" stroke="#60A5FA" strokeWidth="1.5" />

            {/* Seta no destino (ETA 1) */}
            <g transform={`translate(${destX}, ${YE1})`}>
              <circle r="8" fill="#3B82F6" stroke="#60A5FA" strokeWidth="2.5" />
              <circle r="13" fill="none" stroke="#3B82F6" strokeWidth="1.5" opacity="0.6" />
              <circle r="18" fill="none" stroke="#3B82F6" strokeWidth="1" opacity="0.4" />
              {/* Seta indicando direção */}
              <path d="M -3 0 L 3 0 L 0 -4 Z" fill="#fff" transform="rotate(0)" />
            </g>
          </g>
        );
      })()}
    </svg>
  );
}
