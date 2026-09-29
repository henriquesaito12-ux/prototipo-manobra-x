import { useMemo } from 'react'
import { project, type ProjectedScene } from './project'
import { YardCanvas } from './render/YardCanvas'
import type { CompositionHighlight, HoverSegmentoHandler } from './render/Composition'
import type { YardTopology } from './types'
import { AMV_T2_MARKER_ID } from '../../../data/visualJ105'

// Componente fino de orquestração: recebe a topologia já mesclada (fetch/polling das 3 camadas
// vive em `useYardMap`/`useYardStatus`/`useYardElements` + `mergeYardLayers`, chamados em
// `Dashboard.tsx` — ver ADR-011; estados de domínio em `TopologicalPanel`) e projeta + desenha.
// Sem estado, sem I/O — só `project()` (puro) e `YardCanvas` (render).

/** Largura útil (viewBox) reservada às linhas — exclui a calha de rótulo. */
const TRACK_AREA_WIDTH = 1040
/** Piso da calha de rótulo — nunca menor que isso, mesmo com labels curtos. */
const MIN_LABEL_GUTTER_WIDTH = 180
/**
 * Estimativa CONSERVADORA de largura por caractere (viewBox units), fontSize 12 (`Line.tsx`).
 * Não é medição real — medir o `<text>` de fato (`getComputedTextLength`) exigiria montar o
 * SVG antes de calcular o layout final (2º passe de render), o que reabre o risco de CLS que o
 * ADR-007 fixou como requisito duro. Por isso o valor aqui é o pior caso plausível (largura de
 * caractere largo/maiúsculo, não a média) — labels com muitos caracteres largos ainda podem,
 * em teoria, superar a estimativa; não há teste automatizado que pegue isso (jsdom não mede
 * texto real). Ajustar aqui se um caso real vazar visualmente.
 */
const LABEL_CHAR_WIDTH_ESTIMATE = 7.5
/** Folga entre o fim do texto e o início da área de trilhos. */
const LABEL_PADDING = 20

interface TrainYardSVGProps {
  topology: YardTopology
  /** Repassado direto a `YardCanvas` — ver doc lá (zoom semântico). */
  detalheVisivel?: boolean
  /** Repassado direto a `YardCanvas`/`Composition` — Bloco/Grupo ativo no Plano de Manobra. */
  highlight?: CompositionHighlight | null
  /** Repassado direto a `YardCanvas`/`Composition` — ver doc em `Composition.tsx`
   *  (`HoverSegmentoHandler`). */
  onHoverSegmento?: HoverSegmentoHandler
  /** Repassado direto a `YardCanvas`/`Composition` — ver doc em `Composition.tsx` (seleção
   *  pontual de veículo(s), clique num chip de `TagVagao`). */
  veiculosFoco?: Set<string> | null
  /** Repassado direto a `YardCanvas` — ver doc lá (composição veículo a veículo, só do J105). */
  modoJ105?: boolean
  passoJ105?: number | null
  /** Repassado direto a `YardCanvas` — ver doc lá (linha do tempo animada, só do J105 V2). */
  tempoJ105V2?: number | null
}

/** Calha de rótulo dinâmica: labels mais longos que o padrão legado não podem vazar/cortar. */
function computeLabelGutterWidth(lines: YardTopology['lines']): number {
  const longestLabelLength = lines.reduce((max, line) => Math.max(max, line.label?.length ?? 0), 0)
  return Math.max(MIN_LABEL_GUTTER_WIDTH, longestLabelLength * LABEL_CHAR_WIDTH_ESTIMATE + LABEL_PADDING)
}

/**
 * Projeta a topologia com as MESMAS opções (`TRACK_AREA_WIDTH`, calha de rótulo) que este
 * componente usa internamente — exportada pra `ZoomableMapa` (`PlanejamentoScreen.tsx`)
 * conseguir achar, na mesma cena, onde um Bloco/Grupo em destaque cai em coordenadas de
 * viewBox e centralizar a câmera nele (pan/zoom automático), sem duplicar as constantes de
 * layout nem depender de medir o SVG já desenhado.
 */
export function projectYardScene(topology: YardTopology): ProjectedScene {
  const labelGutterWidth = computeLabelGutterWidth(topology.lines ?? [])
  return project(topology, { trackAreaWidth: TRACK_AREA_WIDTH, labelGutterWidth })
}

export function TrainYardSVG({ topology, detalheVisivel, highlight, onHoverSegmento, veiculosFoco, modoJ105, passoJ105, tempoJ105V2 }: TrainYardSVGProps) {
  const scene = useMemo(() => projectYardScene(topology), [topology])
  // Só o J105 substitui o glyph genérico do AMV pelo losango dedicado (`AmvJ105Marker`,
  // `ComposicaoJ105Layer.tsx`) — demais trens nunca ocultam marcador nenhum.
  const markerOcultoId = modoJ105 ? AMV_T2_MARKER_ID : undefined

  return (
    <YardCanvas
      scene={scene}
      detalheVisivel={detalheVisivel}
      highlight={highlight}
      onHoverSegmento={onHoverSegmento}
      veiculosFoco={veiculosFoco}
      modoJ105={modoJ105}
      passoJ105={passoJ105}
      tempoJ105V2={tempoJ105V2}
      markerOcultoId={markerOcultoId}
    />
  )
}
