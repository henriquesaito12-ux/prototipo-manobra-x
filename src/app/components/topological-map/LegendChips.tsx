import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { BookOpen, ChevronDown, Eye, EyeOff, ZoomIn } from 'lucide-react'
import { useState } from 'react'
import { DETAIL_MARKER_VARIANTS, ELEMENT_KIND_LABELS, LINE_TYPE_LABELS, MARKER_VARIANT_LABELS, STATUS_LABELS } from './legendCatalog'
import { setAllLegendFilter, type LegendFilterState, type LegendPresence } from './train-yard/filterTopology'
import { MARKER_VARIANT_STYLES, type MarkerVariantStyle } from './train-yard/render/Marker'
import { LINE_TYPE_STYLES, STATUS_OVERLAYS } from './train-yard/styles'
import { HeaderTooltip } from '../PageHeader'

// Legenda interativa como bloco de chips, FORA da área do mapa (acima do canvas, nunca por
// cima dele — ver `TopologicalPanel`, que renderiza isto como irmão do canvas, não como overlay
// absoluto dentro dele). Colapsada por padrão — só a linha "Legenda" + seta; clicar expande a
// lista completa de chips (`flex-wrap`, sem scroll horizontal — a altura cresce com o número de
// linhas e a área do mapa, `flex: 1` no container pai, cede espaço automaticamente). Cada chip é
// o próprio toggle: clicar liga/desliga aquela categoria no mapa (ver `filterTopology.ts`).
//
// O colapse em si usa `AccordionPrimitive` (Radix) com as MESMAS classes CSS do colapse de
// Bloco/Grupo (`vli-collapsible-trigger`/`vli-collapsible-content`/`vli-chevron`, definidas em
// `theme.css`) — mesma animação de altura+opacidade (250ms ease-in-out) e mesma rotação do
// chevron, sem duplicar CSS. `type="single" collapsible` com um único Item simula um
// on/off simples (não é um grupo de vários itens).

interface LegendChipsProps {
  filter: LegendFilterState
  onChange: (next: LegendFilterState) => void
  /** Restrições Ativas também está aberto — os dois juntos podem passar da altura disponível e
   *  espremer o mapa (que fica ACIMA, com `flex: 1`). Só nesse caso a legenda limita a própria
   *  altura e rola por dentro; com Restrições fechado, a legenda mostra todas as linhas de chips
   *  livremente (o conjunto de categorias é pequeno o bastante pra nunca cobrir o mapa sozinho). */
  restricoesAbertas: boolean
  /** Zoom semântico atual (ver `ZoomableMapa`/`ZOOM_SEMANTICO_LIMIAR`) — usado só pra avisar,
   *  num chip de marcador de detalhe que esteja ATIVO na legenda, que ele não vai aparecer no
   *  mapa até o operador dar mais zoom (senão o item parece ligado sem nunca desenhar, sem pista
   *  do motivo). Não filtra nada aqui — a legenda continua controlando só a categoria em si. */
  detalheVisivel: boolean
  /** Rótulo pronto pro tooltip do aviso acima (ex.: "175%") — evita repetir a conversão
   *  zoom→porcentagem aqui, `ZoomableMapa` já faz essa conta com o mesmo `ZOOM_MIN`. */
  zoomThresholdLabel: string
  /** Quais chaves de cada categoria têm pelo menos 1 elemento real neste pátio (ver
   *  `computeLegendPresence`) — item sem nenhum dado (ex.: "Recebimento", "AMV de mola" no EHT)
   *  nunca aparece no mapa mesmo ligado, então nem entra na lista de chips. */
  presence: LegendPresence
}

const MARKER_ICON_W = 30
const MARKER_ICON_H = 13
// Coordenadas internas do preview permanecem nas mesmas medidas de `Marker.tsx`/`legendCatalog`
// (tick/wedge/box/fontSize foram calibrados nessa escala) — só o `width`/`height` de saída
// encolhe para caber num chip; o SVG escala tudo proporcionalmente via viewBox.
const PREVIEW_VIEWBOX_W = 64
const PREVIEW_VIEWBOX_H = 26

/** Mini-render isolado de uma variante de marcador — mesma lógica de box/tick/text de
 *  `Marker.tsx`, só que num SVG pequeno e fixo em vez de projetado na régua do pátio. */
function MarkerChipIcon({ style, sampleLabel }: { style: MarkerVariantStyle; sampleLabel?: string }) {
  const x = PREVIEW_VIEWBOX_W / 2
  const y = PREVIEW_VIEWBOX_H / 2
  const textDy = style.textDy ?? 0
  const label = sampleLabel ?? '•'

  return (
    <svg
      width={MARKER_ICON_W}
      height={MARKER_ICON_H}
      viewBox={`0 0 ${PREVIEW_VIEWBOX_W} ${PREVIEW_VIEWBOX_H}`}
      aria-hidden="true"
      className="shrink-0"
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
        {label}
      </text>
    </svg>
  )
}

// Rótulo de amostra por variante — algumas fazem mais sentido com um número/percentual de
// exemplo (AMV, rampa) do que com o glyph fixo já embutido no `label` real.
const MARKER_SAMPLE_LABELS: Record<string, string> = {
  'amv-manual': '1',
  'amv-mola': '1',
  'calco-metal': '',
  'calco-madeira': '',
  'freio-manual': '⊕',
  'secao-bloqueio': 'SB',
  'limite-manobra': 'LM',
  declividade: '◄ 1,0%',
  batente: '',
  'passagem-nivel': '✕',
  km: '753',
  interdicao: 'INTERDITADO',
  eta: 'ETA 19:45',
  cco: 'CCO',
  abastecimento: 'ABASTECIMENTO',
}

/** Chip clicável — ícone + nome, estado ativo/inativo por opacidade e borda. Toda a legenda é
 *  feita destes, categoria após categoria, numa única faixa que rola horizontalmente.
 *  Hover usa `--vli-hover-tint` (mesmo token de hover do resto do app, já correto nos dois
 *  temas) em vez do antigo `hover:brightness-125` — esse filtro multiplica o brilho da cor
 *  JÁ renderizada, então num chip ativo em light mode (fundo claro sobre painel claro) ele
 *  estourava pra branco puro sem contraste nenhum; em dark mode não dava pra notar porque o
 *  fundo de base já é escuro o bastante pra "sobrar espaço" antes de estourar. */
function Chip({
  active,
  onClick,
  icon,
  label,
  zoomHint,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  /** Presente = este item está ATIVO na legenda mas é de detalhe fino e o zoom atual está
   *  abaixo do limiar — não vai aparecer no mapa até o operador dar mais zoom. Só existe pra
   *  explicar, num tooltip + selo discreto, por que um item "ligado" não desenha nada agora
   *  (ver `LegendChipsProps.detalheVisivel`) — não é um terceiro estado de toggle. */
  zoomHint?: string
}) {
  const backgroundColor = active
    ? 'color-mix(in srgb, var(--color-panel-bg) 55%, transparent)'
    : 'transparent';
  return (
    <HeaderTooltip label={zoomHint ?? label}><button
      type="button"
      onClick={onClick}
      aria-pressed={active}
     
      className="flex items-center gap-1.5 shrink-0 rounded-full border px-2 py-1 cursor-pointer transition-colors font-manrope"
      style={{
        backgroundColor,
        borderColor: active
          ? 'var(--color-border-subtle)'
          : 'color-mix(in srgb, var(--color-border-subtle) 45%, transparent)',
        opacity: active ? 1 : 0.4,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--vli-hover-tint)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = backgroundColor; }}
    >
      {icon}
      <span className="text-[10.5px] text-text-md whitespace-nowrap">{label}</span>
      {zoomHint && <ZoomIn size={10} strokeWidth={2.5} className="shrink-0 text-vli-orange" aria-hidden="true" />}
    </button></HeaderTooltip>
  )
}

function ActionChip({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 shrink-0 rounded-full border border-border-subtle bg-transparent px-2 py-1 cursor-pointer text-text-md hover:text-text-hi transition-colors font-manrope"
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--vli-hover-tint)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {icon}
      <span className="text-[10.5px] whitespace-nowrap">{label}</span>
    </button>
  )
}

function Divider() {
  return <span className="w-px h-4 shrink-0 bg-border-subtle" style={{ opacity: 0.6 }} />
}

export function LegendChips({ filter, onChange, restricoesAbertas, detalheVisivel, zoomThresholdLabel, presence }: LegendChipsProps) {
  const [expandido, setExpandido] = useState(false)

  function toggleLineType(key: string) {
    onChange({ ...filter, lineTypes: { ...filter.lineTypes, [key]: filter.lineTypes[key] === false } })
  }
  function toggleStatus(key: string) {
    onChange({ ...filter, lineStatuses: { ...filter.lineStatuses, [key]: filter.lineStatuses[key] === false } })
  }
  function toggleMarker(key: string) {
    onChange({ ...filter, markerVariants: { ...filter.markerVariants, [key]: filter.markerVariants[key] === false } })
  }
  function toggleElementKind(key: string) {
    onChange({ ...filter, elementKinds: { ...filter.elementKinds, [key]: filter.elementKinds[key] === false } })
  }

  return (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      value={expandido ? 'legenda' : ''}
      onValueChange={(v) => setExpandido(v === 'legenda')}
      className="font-manrope"
    >
      <AccordionPrimitive.Item value="legenda">
        <AccordionPrimitive.Header>
          <AccordionPrimitive.Trigger
            className="vli-collapsible-trigger flex items-center justify-between gap-2 border-none cursor-pointer transition-colors"
            // MESMO padding/altura do trigger de `RestrictionsPanel.tsx` ("Restrições Ativas") —
            // 2026-08-27, pedido explícito do usuário: "gostaria de manter um padrão no dropdown...
            // restrição ativa... ocupa toda a tela, de ponta a ponta. já legenda tem um padding em
            // volta... deixe a legenda igual restrição ativa". `margin: '0 -16px'` cancela
            // exatamente o `padding: 16` do container pai (`TopologicalPanel`, mais acima neste
            // arquivo) que embrulha a Legenda inteira — Restrições Ativas não tem esse problema
            // porque é um painel IRMÃO separado, sem pai com padding em volta (ver
            // `PlanejamentoScreen.tsx`); aqui precisa "furar" esse padding pra chegar de ponta a
            // ponta igual. Sem `rounded` — a borda arredondada agora é só do card por fora, não do
            // trigger (que encosta na borda dele).
            style={{ padding: '10px 14px', margin: '0 -16px', width: 'calc(100% + 32px)', backgroundColor: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--vli-hover-tint)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <span className="flex items-center gap-1 shrink-0">
              <BookOpen size="0.8125rem" strokeWidth={2.25} className="text-vli-orange shrink-0" />
              <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--vli-text-lo)', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', letterSpacing: '0.025em', whiteSpace: 'nowrap' }}>
                Legenda
              </span>
            </span>
            <ChevronDown size="0.875rem" color="var(--vli-text-lo)" className="vli-chevron shrink-0" />
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>

        <AccordionPrimitive.Content className="vli-collapsible-content">
        {/* Só limita a própria altura (e rola por dentro) quando Restrições Ativas também está
           aberto — os dois juntos que arriscam passar do espaço disponível e espremer o mapa.
           Sozinha, a legenda mostra todas as categorias sem cortar nada. `maxHeight` sempre um
           número (nunca `undefined`/"none" no estado "livre") — CSS não anima transições de/pra
           `none`, então isso ficaria um corte seco em vez de suave ao ligar/desligar Restrições
           Ativas com a legenda já aberta; 2000 nunca é de fato alcançado pelo conteúdo real, então
           funciona como "sem limite" só que continua animável. */}
        <div
          className="flex flex-wrap items-center gap-1.5 pt-2 overflow-y-auto"
          style={{ maxHeight: restricoesAbertas ? 110 : 2000, transition: 'max-height 250ms ease-in-out' }}
        >
          <ActionChip onClick={() => onChange(setAllLegendFilter(filter, true))} icon={<Eye size={11} strokeWidth={2} />} label="Mostrar tudo" />
          <ActionChip onClick={() => onChange(setAllLegendFilter(filter, false))} icon={<EyeOff size={11} strokeWidth={2} />} label="Ocultar tudo" />

          <Divider />

          {Object.entries(LINE_TYPE_LABELS).map(([key, label]) => {
            const style = LINE_TYPE_STYLES[key]
            if (!style || !presence.lineTypes.has(key)) return null
            const active = filter.lineTypes[key] !== false
            return (
              <Chip
                key={key}
                active={active}
                onClick={() => toggleLineType(key)}
                label={label}
                icon={<span className="w-4 h-1 rounded-sm shrink-0" style={{ backgroundColor: style.border }} />}
              />
            )
          })}

          <Divider />

          {Object.entries(STATUS_LABELS).map(([key, label]) => {
            const style = STATUS_OVERLAYS[key]
            if (!style || !presence.lineStatuses.has(key)) return null
            const active = filter.lineStatuses[key] !== false
            return (
              <Chip
                key={key}
                active={active}
                onClick={() => toggleStatus(key)}
                label={label}
                icon={
                  <span
                    className="w-4 h-2.5 rounded-sm shrink-0 border"
                    style={{ backgroundColor: style.fill, borderColor: style.borderColor }}
                  />
                }
              />
            )
          })}

          <Divider />

          {Object.entries(MARKER_VARIANT_LABELS).map(([key, label]) => {
            const style = MARKER_VARIANT_STYLES[key]
            if (!style || !presence.markerVariants.has(key)) return null
            const active = filter.markerVariants[key] !== false
            const zoomGated = active && !detalheVisivel && DETAIL_MARKER_VARIANTS.has(key)
            return (
              <Chip
                key={key}
                active={active}
                onClick={() => toggleMarker(key)}
                label={label}
                icon={<MarkerChipIcon style={style} sampleLabel={MARKER_SAMPLE_LABELS[key]} />}
                zoomHint={zoomGated ? `${label} — ativo na legenda, mas só aparece no mapa a partir de ${zoomThresholdLabel} de zoom` : undefined}
              />
            )
          })}

          <Divider />

          {Object.entries(ELEMENT_KIND_LABELS).map(([key, label]) => {
            if (!presence.elementKinds.has(key)) return null
            const active = filter.elementKinds[key] !== false
            return (
              <Chip
                key={key}
                active={active}
                onClick={() => toggleElementKind(key)}
                label={label}
                icon={
                  <span
                    className="w-4 h-2.5 rounded-sm shrink-0 border-2"
                    style={{ backgroundColor: 'var(--vli-map-composition-fill)', borderColor: 'var(--vli-map-composition-accent)' }}
                  />
                }
              />
            )
          })}
        </div>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    </AccordionPrimitive.Root>
  )
}
