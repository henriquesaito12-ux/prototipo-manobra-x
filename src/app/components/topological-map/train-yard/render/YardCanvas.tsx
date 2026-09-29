import type { ProjectedComposition, ProjectedScene } from '../project'
import { DETAIL_MARKER_VARIANTS } from '../../legendCatalog'
import { resolveStatusOverlay } from '../styles'
import { Composition, type CompositionHighlight, type HoverSegmentoHandler } from './Composition'
import { ComposicaoJ105Layer } from './ComposicaoJ105Layer'
import { ComposicaoJ105V2Layer } from './ComposicaoJ105V2Layer'
import { Connections } from './Connections'
import { Divider } from './Divider'
import { EtapaCorteLayer } from './EtapaCorteLayer'
import { EtapaFechamentoLayer } from './EtapaFechamentoLayer'
import { EtapaInclusaoRota1Layer } from './EtapaInclusaoRota1Layer'
import { EtapaInclusaoRota2Layer } from './EtapaInclusaoRota2Layer'
import { EtapaParadaLayer } from './EtapaParadaLayer'
import { EtapaRetiradaLayer } from './EtapaRetiradaLayer'
import { EtapaRetiradaRota2Layer } from './EtapaRetiradaRota2Layer'
import type {
  EtapaHighlightInclusaoRota1,
  EtapaHighlightInclusaoRota2,
  EtapaHighlightRetirada,
  EtapaHighlightRetiradaRota2,
} from './Composition'
import { Line } from './Line'
import { Marker } from './Marker'

// Casca SVG do mapa topológico de pátio: monta o viewBox, o pattern de hachura
// global de status interditado, e despacha o desenho de linhas/elementos/conexões
// para os componentes especializados. REGRA DE COORDENADAS: todo `x` vindo de
// `ProjectedScene` é relativo ao início da área de trilhos — o X final de desenho
// é sempre `scene.labelGutterWidth + elemento.x` (nunca renderizar `x` cru).

interface YardCanvasProps {
  scene: ProjectedScene
  /** Zoom semântico — abaixo do limiar (ver `ZOOM_SEMANTICO_LIMIAR`, `PlanejamentoScreen.tsx`),
   *  marcadores de `DETAIL_MARKER_VARIANTS` desenham com fade-out (`Marker.tsx`) em vez de sumir
   *  abrupto. Default `true` (nenhum marcador de detalhe escondido) — só quem tem noção de zoom
   *  (`ZoomableMapa`) passa `false`. */
  detalheVisivel?: boolean
  /** Bloco/Grupo ativo no Plano de Manobra (painel esquerdo) — repassado a cada `Composition`
   *  para destacar os segmentos correspondentes e esmaecer o resto do trem (ver `Composition.tsx`). */
  highlight?: CompositionHighlight | null
  /** Repassado a cada `Composition` — ver doc em `Composition.tsx` (`HoverSegmentoHandler`). */
  onHoverSegmento?: HoverSegmentoHandler
  /** Repassado a cada `Composition` — ver doc em `Composition.tsx` (seleção pontual de
   *  veículo(s), clique num chip de `TagVagao`). */
  veiculosFoco?: Set<string> | null
  /** Exclusivo do trem J105 (2026-09-21, pedido explícito): desenha a composição veículo a veículo
   *  conforme o passo selecionado (`ComposicaoJ105Layer`) no lugar do destaque de trajeto da
   *  PARADA. Ausente/`false` = comportamento de sempre, idêntico para todos os outros trens. */
  modoJ105?: boolean
  /** Passo (1..38) do J105 em destaque — só usado quando `modoJ105`. */
  passoJ105?: number | null
  /** Instante (s) da linha do tempo animada do J105 V2 — quando presente (só nesse trem), a
   *  composição é desenhada por `ComposicaoJ105V2Layer`, interpolada no tempo, em vez do estado
   *  estático do passo. `null`/ausente = J105 V1 e todo o resto, inalterados. */
  tempoJ105V2?: number | null
  /** Id do marcador (`ProjectedMarker.id`) cujo glyph genérico (`Marker.tsx`) NÃO deve desenhar —
   *  hoje só o AMV do Travessão 2 no J105 (`AMV_T2_MARKER_ID`, `visualJ105.ts`), substituído pelo
   *  losango dedicado que `ComposicaoJ105Layer` desenha por cima de tudo (ver lá,
   *  `AmvJ105Marker`) — sem isso os dois desenhariam sobrepostos no mesmo ponto. */
  markerOcultoId?: string
}

export function YardCanvas({ scene, detalheVisivel = true, highlight, onHoverSegmento, veiculosFoco, modoJ105 = false, passoJ105, tempoJ105V2, markerOcultoId }: YardCanvasProps) {
  const { labelGutterWidth } = scene
  const hatchStroke = resolveStatusOverlay('interditada').hachureStroke

  return (
    <svg
      viewBox={`0 0 ${scene.viewBoxWidth} ${scene.viewBoxHeight}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
    >
      {/* Sem `<title>` nativo — 2026-08-28, pedido explícito do usuário: "quando o mouse tá parado
         no mapa, aparece um tooltip 'mapa topológico do pátio' fora do padrão... pode remover".
         Era o tooltip default do navegador pra SVG (fora do padrão visual da plataforma, ver
         `TooltipHoverTrem` acima pro tooltip que É do padrão) — sem substituto: nenhum caller
         passava um `title` customizado (só o default), então não sobra conteúdo pra migrar. */}
      <defs>
        <pattern
          id="hatch-interditada"
          patternUnits="userSpaceOnUse"
          width={8}
          height={8}
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={8} stroke={hatchStroke} strokeWidth={3} />
        </pattern>
      </defs>

      <Connections connections={scene.connections} labelGutterWidth={labelGutterWidth} />

      {scene.lines.map((line) => (
        <Line key={line.id} line={line} labelGutterWidth={labelGutterWidth} />
      ))}

      {/* Não-composição primeiro, composições por último — em SVG quem desenha por último fica
         por cima. Duas passadas separadas (em vez de uma única `flatMap` na ordem natural dos
         elementos) garantem que o pino da composição SEMPRE fique acima de marcador/divisor/
         rótulo de QUALQUER linha, mesmo os de uma linha vizinha que viria depois no array
         `scene.lines` (o cartão flutuante do pino cresce bem além do ponto onde a composição está
         ancorada — ver `Composition.tsx` — e nesse caso sobrepõe elementos ao redor; sem as duas
         passadas, um marcador de uma linha posterior no array podia acabar desenhado por cima
         dele). */}
      {scene.lines.flatMap((line) =>
        line.elements
          .filter((el) => el.kind !== 'composition')
          .map((el, idx) => {
            const key = el.id ?? `${line.id}-${el.kind}-${idx}`
            if (el.kind === 'marker') {
              const visible = detalheVisivel || !DETAIL_MARKER_VARIANTS.has(el.variant)
              return (
                <Marker
                  key={key}
                  marker={el}
                  labelGutterWidth={labelGutterWidth}
                  visible={visible}
                  oculto={markerOcultoId != null && el.id === markerOcultoId}
                />
              )
            }
            if (el.kind === 'divider') {
              return <Divider key={key} divider={el} labelGutterWidth={labelGutterWidth} />
            }
            return (
              <text
                key={key}
                x={labelGutterWidth + el.x}
                y={el.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--vli-map-slate-label)"
                fontSize={9}
                letterSpacing={0.5}
              >
                {el.text}
              </text>
            )
          }),
      )}

      {scene.lines.flatMap((line) =>
        line.elements
          .filter((el): el is ProjectedComposition => el.kind === 'composition')
          .map((el, idx) => (
            <Composition
              key={el.id ?? `${line.id}-composition-${idx}`}
              composition={el}
              labelGutterWidth={labelGutterWidth}
              highlight={highlight}
              onHoverSegmento={onHoverSegmento}
              veiculosFoco={veiculosFoco}
            />
          )),
      )}

      {/* Por último — mesma precedência do véu de esmaecimento de Bloco/Grupo dentro de
         `Composition.tsx` (sempre por cima do que esmaece). Cada camada só desenha algo quando a
         etapa em destaque é do seu próprio tipo (ver `EtapaParadaLayer.tsx`/`EtapaCorteLayer.tsx`)
         — `EtapaParadaLayer` atende PARADA e CLEAR (mesmo trajeto visual, ver comentário no topo
         daquele arquivo). */}
      {modoJ105 ? (
        // J105: a composição desenhada veículo a veículo já mostra onde o trem está e o que a
        // etapa faz com ele (corte, grupos separados, sentido) — o trajeto/pino da PARADA seria
        // uma segunda leitura do mesmo dado, em outro lugar da linha. Só este trem entra aqui.
        // V2 troca o estado estático do passo pela posição interpolada no instante `tempoJ105V2`
        // (mesma régua visual, ver `ComposicaoJ105V2Layer`); V1 segue exatamente como antes.
        tempoJ105V2 != null ? (
          <ComposicaoJ105V2Layer scene={scene} labelGutterWidth={labelGutterWidth} tempoS={tempoJ105V2} veiculosFoco={veiculosFoco} />
        ) : (
          <ComposicaoJ105Layer scene={scene} labelGutterWidth={labelGutterWidth} passo={passoJ105} />
        )
      ) : (
        <EtapaParadaLayer
          scene={scene}
          labelGutterWidth={labelGutterWidth}
          etapa={highlight?.etapa?.tipo === 'PARADA' || highlight?.etapa?.tipo === 'CLEAR' ? highlight.etapa : null}
        />
      )}
      <EtapaCorteLayer scene={scene} labelGutterWidth={labelGutterWidth} etapa={highlight?.etapa?.tipo === 'CORTE' ? highlight.etapa : null} />
      {/* RETIRADA tem 2 rotas com formas de destaque totalmente diferentes (Rota 1: locomotiva
         vindo buscar a composição; Rota 2: retirada até o destino, com 2 travessias em vez de 1)
         — despachadas por `rotaIndex`, não por `tipo` sozinho (as duas variantes de
         `EtapaHighlight` compartilham `tipo: 'RETIRADA'`, ver `Composition.tsx`). `rotaIndex` é
         `number` (não literal) dos dois lados, então o narrowing aqui é por checagem em tempo de
         execução + cast, não por discriminated union automático. */}
      <EtapaRetiradaLayer
        scene={scene}
        labelGutterWidth={labelGutterWidth}
        etapa={highlight?.etapa?.tipo === 'RETIRADA' && highlight.etapa.rotaIndex === 0 ? (highlight.etapa as EtapaHighlightRetirada) : null}
      />
      <EtapaRetiradaRota2Layer
        scene={scene}
        labelGutterWidth={labelGutterWidth}
        etapa={highlight?.etapa?.tipo === 'RETIRADA' && highlight.etapa.rotaIndex === 1 ? (highlight.etapa as EtapaHighlightRetiradaRota2) : null}
      />
      <EtapaInclusaoRota1Layer
        scene={scene}
        labelGutterWidth={labelGutterWidth}
        etapa={highlight?.etapa?.tipo === 'INCLUSAO' && highlight.etapa.rotaIndex === 0 ? (highlight.etapa as EtapaHighlightInclusaoRota1) : null}
      />
      <EtapaInclusaoRota2Layer
        scene={scene}
        labelGutterWidth={labelGutterWidth}
        etapa={highlight?.etapa?.tipo === 'INCLUSAO' && highlight.etapa.rotaIndex === 1 ? (highlight.etapa as EtapaHighlightInclusaoRota2) : null}
      />
      <EtapaFechamentoLayer
        scene={scene}
        labelGutterWidth={labelGutterWidth}
        etapa={highlight?.etapa?.tipo === 'FECHAMENTO' ? highlight.etapa : null}
      />
    </svg>
  )
}
