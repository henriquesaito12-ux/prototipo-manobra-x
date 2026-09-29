import type { ProjectedMarker } from '../project'

// Badges pequenos sobre a linha (interdição, ETA, CCO, ...). O conjunto de
// `variant` é extensível pelo backend — variantes desconhecidas caem num
// estilo neutro sem caixa, em vez de lançar exceção. Caixa e texto têm
// width/height/cor PRÓPRIOS por variante (não um tamanho fixo genérico) —
// cada badge é centrado em `marker.x`.

interface MarkerProps {
  marker: ProjectedMarker
  labelGutterWidth: number
  /** Falso = variante de "detalhe fino" atualmente abaixo do zoom semântico (ver
   *  `DETAIL_MARKER_VARIANTS`/`ZOOM_SEMANTICO_LIMIAR`) — desenha com opacidade 0 (fade, não
   *  `display:none`/desmonte) em vez de sumir abruptamente ao cruzar o limiar. Default `true`
   *  (marcadores essenciais, sempre visíveis, não passam prop nenhuma). */
  visible?: boolean
  /** Verdadeiro = não desenha nada (glyph genérico deste marcador substituído por um componente
   *  dedicado desenhado em outra camada — hoje só o AMV do Travessão 2 no J105,
   *  `AmvJ105Marker`/`ComposicaoJ105Layer.tsx`, que precisa de um losango com estado
   *  neutro/ativo, não do círculo genérico deste componente). Default `false` (comportamento
   *  normal, todo o resto do app). */
  oculto?: boolean
}

interface MarkerBoxStyle {
  fill: string
  stroke: string
  strokeWidth: number
  width: number
  height: number
  rx?: number
  dashArray?: string
}

interface MarkerTextStyle {
  color: string
  fontSize: number
  fontWeight: number
  letterSpacing?: number
}

interface MarkerTickStyle {
  color: string
  strokeWidth: number
  length: number
}

/**
 * Cunha (calço/chock) — triângulo-retângulo alongado e baixo, não o glyph unicode "▷"
 * (que lê como botão de "play", achatado/equilátero demais pra parecer um calço real).
 * Base horizontal cheia + hipotenusa inclinada de uma ponta à outra (perfil de cunha
 * sob a roda). `width` >> `height` por design (2026-07-30, feedback: "mais inclinado
 * e longo"). `flip` espelha a inclinação (hipotenusa desce pra esquerda em vez de direita).
 */
interface MarkerWedgeStyle {
  fill: string
  stroke: string
  strokeWidth: number
  width: number
  height: number
  flip?: boolean
}

export interface MarkerVariantStyle {
  /** Ausente = variante "neutra sem caixa" (default). */
  box?: MarkerBoxStyle
  text: MarkerTextStyle
  /** Traço fino perpendicular à linha, centrado em `marker.y` (ex.: marco de quilometragem). */
  tick?: MarkerTickStyle
  /** Cunha triangular alongada (calço) — ver `MarkerWedgeStyle`. */
  wedge?: MarkerWedgeStyle
  /** Desloca o texto verticalmente a partir de `marker.y` (negativo = acima da linha). Default 0. */
  textDy?: number
}

// Exportado (junto com o tipo acima) pra `LegendPanel.tsx` reusar a MESMA fonte de
// verdade visual em vez de duplicar cor/box/tick por variante — evita a legenda
// dessincronizar do render real quando uma variante muda aqui.
//
// Cores via `var(--vli-map-*)` (`theme.css`) — mesma cor de domínio em ambos os temas, só a
// luminosidade muda pra manter contraste em fundo claro/escuro (ver comentário equivalente em
// `styles.ts`). `--vli-map-neutral-light` é o único caso onde dark e light INVERTEM só entre
// si (cinza-claro no dark → cinza-escuro no light, sem trocar de família de cor) — calço de
// madeira/batente usam essa cor tanto pro fill quanto pro texto, e um cinza claro sobre fundo
// branco ficaria ilegível se não escurecesse no tema claro.
export const MARKER_VARIANT_STYLES: Record<string, MarkerVariantStyle> = {
  interdicao: {
    box: { fill: 'var(--vli-map-red-fill)', stroke: 'var(--vli-map-red-border)', strokeWidth: 1.2, width: 148, height: 20, rx: 1 },
    text: { color: 'var(--vli-map-red-label)', fontSize: 9, fontWeight: 700, letterSpacing: 0.5 },
  },
  eta: {
    box: { fill: 'var(--vli-map-red-fill)', stroke: 'var(--vli-map-red-strong)', strokeWidth: 1, width: 96, height: 20, rx: 1 },
    text: { color: 'var(--vli-map-yellow-strong)', fontSize: 10, fontWeight: 700 },
  },
  cco: {
    box: { fill: 'var(--vli-map-navy-fill)', stroke: 'var(--vli-map-navy-border)', strokeWidth: 1, width: 100, height: 16, rx: 1, dashArray: '4 2' },
    text: { color: 'var(--vli-map-slate-label)', fontSize: 9, fontWeight: 400 },
  },
  abastecimento: {
    box: { fill: 'var(--vli-map-green-fill)', stroke: 'var(--vli-map-green-border)', strokeWidth: 1, width: 110, height: 18, rx: 1 },
    text: { color: 'var(--vli-map-green-label)', fontSize: 9, fontWeight: 600 },
  },
  // "Rampa (descendente)" na legenda oficial — caixa com percentual (ex. "1,0%"). Reduzida e
  // com cor mais sóbria em 2026-07-30 (feedback: caixa vermelha berrante demais, competindo
  // visualmente com AMVs/interdição — rampa é só leitura de referência, não alerta).
  declividade: {
    box: { fill: 'var(--vli-map-brown-fill)', stroke: 'var(--vli-map-brown-border)', strokeWidth: 1, width: 42, height: 14, rx: 1 },
    text: { color: 'var(--vli-map-brown-label)', fontSize: 7, fontWeight: 700 },
  },
  // "Uso de freio manual" na legenda oficial — ícone ⊕ vermelho. Corrigido de `amv` (nome/cor
  // errados) em 2026-07-22: o ⊕ vermelho nunca foi AMV, ver `amv-manual`/`amv-mola` abaixo.
  // Caixa/círculo ao redor removido em 2026-07-30: a legenda real é só o glyph "⊕", uma
  // segunda forma circular ao redor duplicava o próprio símbolo.
  'freio-manual': {
    text: { color: 'var(--vli-map-red-strong)', fontSize: 16, fontWeight: 700 },
  },
  // AMV manual — círculo azul com ponto cheio, por oposição a `amv-mola` (círculo vazado).
  // Corrige a suposição anterior (`amv` = ⊕ vermelho, errada — ver `freio-manual`). Cor via os
  // tokens dedicados "visão topológica / amv" (bg/border/text) — bg/text coincidem em valor com
  // `--vli-map-navy-fill`/`--vli-map-blue-label`, mas a borda do AMV é mais sutil que a "navy"
  // usada pela linha "carga", por isso não compartilha a mesma variável.
  // Tamanho reduzido de 18→13 (2026-09-22, pedido explícito do usuário: "os AMVs estão muito
  // grandes") — `rx: 6.5` mantém o círculo perfeito (metade de `width`/`height`), fonte 9→7
  // acompanha a caixa menor sem estourar a borda.
  'amv-manual': {
    box: { fill: 'var(--vli-map-amv-bg)', stroke: 'var(--vli-map-amv-border)', strokeWidth: 1, width: 13, height: 13, rx: 6.5 },
    text: { color: 'var(--vli-map-amv-text)', fontSize: 7, fontWeight: 700 },
  },
  // AMV de mola — mesma paleta de `amv-manual`, círculo vazado (sem fill) marca a diferença.
  'amv-mola': {
    box: { fill: 'none', stroke: 'var(--vli-map-amv-border)', strokeWidth: 1, width: 13, height: 13, rx: 6.5 },
    text: { color: 'var(--vli-map-amv-text)', fontSize: 7, fontWeight: 700 },
  },
  // Calço de metal — cunha vazada (contorno), por oposição a `calco-madeira` (preenchida).
  // Trocado de glyph unicode "▷" pra `wedge` em 2026-07-30 (feedback: parecia botão de "play",
  // não um calço — cunha real é mais inclinada e alongada, ver `MarkerWedgeStyle`).
  'calco-metal': {
    wedge: { fill: 'none', stroke: 'var(--vli-map-slate-label)', strokeWidth: 1.2, width: 18, height: 6 },
    text: { color: 'var(--vli-map-slate-label)', fontSize: 11, fontWeight: 400 },
  },
  // Calço de madeira — mesma cunha de `calco-metal`, preenchida (cor mais sólida marca a diferença).
  'calco-madeira': {
    wedge: { fill: 'var(--vli-map-neutral-light)', stroke: 'var(--vli-map-neutral-light)', strokeWidth: 1, width: 18, height: 6 },
    text: { color: 'var(--vli-map-neutral-light)', fontSize: 11, fontWeight: 700 },
  },
  // Seção de bloqueio — caixa amarela "SB" (ex.: "SB EEL-EVS1").
  'secao-bloqueio': {
    box: { fill: 'var(--vli-map-amber-fill)', stroke: 'var(--vli-map-yellow-strong)', strokeWidth: 1, width: 90, height: 18, rx: 1 },
    text: { color: 'var(--vli-map-yellow-strong)', fontSize: 9, fontWeight: 700 },
  },
  // Limite de manobra — caixa amarela "LM", mesmo tratamento visual de `secao-bloqueio`.
  'limite-manobra': {
    box: { fill: 'var(--vli-map-amber-fill)', stroke: 'var(--vli-map-yellow-strong)', strokeWidth: 1, width: 40, height: 18, rx: 1 },
    text: { color: 'var(--vli-map-yellow-strong)', fontSize: 9, fontWeight: 700 },
  },
  // Passagem em nível — marcador pontual (glyph ✕), distinto do `DividerElement`/`Divider.tsx`
  // (barra "PN" que atravessa 2 linhas) — este é o ponto na própria linha, não o vão entre linhas.
  'passagem-nivel': {
    text: { color: 'var(--vli-map-yellow-strong)', fontSize: 12, fontWeight: 700 },
  },
  // Batente — fim físico da via. Ícone provisório (bolinha cheia) até o ícone definitivo
  // de design (bandeira) ficar pronto — ver ata de reunião 2026-07-28.
  batente: {
    box: { fill: 'var(--vli-map-neutral-light)', stroke: 'var(--vli-map-neutral-light)', strokeWidth: 1, width: 10, height: 10, rx: 5 },
    text: { color: 'var(--vli-map-neutral-light)', fontSize: 11, fontWeight: 400 },
  },
  // Marco de quilometragem (map_waypoint) — traço fino cruzando o trilho + rótulo
  // deslocado acima da linha, para não competir visualmente com AMVs e composições
  // que ficam centrados em `marker.y`. Sutil de propósito: é referência de leitura
  // (quilometragem oficial da via), não um estado operacional do pátio.
  km: {
    text: { color: 'var(--vli-map-slate-label)', fontSize: 8, fontWeight: 500 },
    tick: { color: 'var(--vli-map-slate-label)', strokeWidth: 1, length: 10 },
    textDy: -10,
  },
  default: {
    text: { color: 'var(--vli-map-slate-label)', fontSize: 10, fontWeight: 400 },
  },
}

function resolveMarkerVariantStyle(variant: string): MarkerVariantStyle {
  return MARKER_VARIANT_STYLES[variant] ?? MARKER_VARIANT_STYLES.default
}

export function Marker({ marker, labelGutterWidth, visible = true, oculto = false }: MarkerProps) {
  if (oculto) return null
  const style = resolveMarkerVariantStyle(marker.variant)
  const x = labelGutterWidth + marker.x
  const y = marker.y

  // Contrato permite `label` ausente (ícone puro, ex.: AMV/calço/batente) — só não desenha
  // nada se a variante também não tem `box`/`tick`/`wedge` (nada pra mostrar).
  if (!marker.label && !style.box && !style.tick && !style.wedge) return null

  const textDy = style.textDy ?? 0

  return (
    <g
      data-marker-id={marker.id}
      data-marker-variant={marker.variant}
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 220ms ease-in-out',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {style.tick && (
        <line
          x1={x}
          y1={y - style.tick.length / 2}
          x2={x}
          y2={y + style.tick.length / 2}
          stroke={style.tick.color}
          strokeWidth={style.tick.strokeWidth}
        />
      )}
      {style.wedge && (
        <polygon
          points={(() => {
            const hw = style.wedge.width / 2
            const hh = style.wedge.height / 2
            // Base cheia (y+hh) de ponta a ponta + hipotenusa até um único vértice
            // no topo — `flip` decide se o vértice fica na ponta esquerda ou direita.
            const apexX = style.wedge.flip ? x - hw : x + hw
            return `${x - hw},${y + hh} ${x + hw},${y + hh} ${apexX},${y - hh}`
          })()}
          fill={style.wedge.fill}
          stroke={style.wedge.stroke}
          strokeWidth={style.wedge.strokeWidth}
          strokeLinejoin="round"
        />
      )}
      {style.box && (
        <rect
          x={x - style.box.width / 2}
          y={y - style.box.height / 2}
          width={style.box.width}
          height={style.box.height}
          fill={style.box.fill}
          stroke={style.box.stroke}
          strokeWidth={style.box.strokeWidth}
          strokeDasharray={style.box.dashArray}
          rx={style.box.rx}
        />
      )}
      {marker.label && (
        <text
          x={x}
          y={y + textDy + 0.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={style.text.color}
          fontSize={style.text.fontSize}
          fontWeight={style.text.fontWeight}
          letterSpacing={style.text.letterSpacing}
        >
          {marker.label}
        </text>
      )}
    </g>
  )
}
