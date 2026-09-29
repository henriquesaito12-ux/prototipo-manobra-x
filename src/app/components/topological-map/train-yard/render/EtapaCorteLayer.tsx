import { ScissorsLineDashed } from 'lucide-react'
import type { ProjectedScene } from '../project'
import { computeParadaGeometry, computePontoNaLinha } from '../etapaParada'
import { DIM_OVERLAY_FILL, DIM_OVERLAY_OPACITY, type EtapaHighlightCorte } from './Composition'
import { resolveTrackHeight } from './Line'

// Camada de destaque da etapa CORTE — mesmo espírito de esmaecimento das demais linhas da PARADA
// (`EtapaParadaLayer.tsx`), mas SEM deslocamento: o Corte não desloca a composição. `distanciaM`
// aqui é `apoio.posCabecaM` da PRÓPRIA etapa (resolvido em `PlanManobraX.tsx` — ver
// `EtapaHighlightCorte`), sempre um pouco MENOR que o `distanciaM` da Parada-irmã — o ponto de
// corte fica antes da referência onde a composição parou, nunca no mesmo ponto nem depois. Por
// isso esta camada nunca desenha trajeto/seta de sentido/ponto de partida/badge de distância — só
// o PONTO onde a ação ocorre.
//
// Acabamento (2026-08-25, quatro rounds de ajuste):
// - SEM pino/marcador de destino — só o ícone de tesoura direto sobre a linha, mais discreto que
//   um marcador de trajeto (não é um destino, é uma ação pontual). Ícone
//   `ScissorsLineDashed` (tesoura cortando uma linha tracejada — mesma referência visual de
//   ícones de biblioteca tipo Material/Heroicons), na cor de perigo (`--vli-danger-text`), mesma
//   cor semântica do chip "retirado".
// - Vagões cortados na HORIZONTAL, alinhados ao longo da própria linha (como se estivessem
//   posicionados na composição em cima do trajeto), À ESQUERDA do ícone — não à direita: a
//   tesoura marca o ponto de corte, os vagões cortados ficam pra trás dele (na direção "antes"),
//   nunca avançando pra depois/direita dela.
// - Chips retangulares (raio pequeno, 3px), não mais pílulas — mesma cor/conteúdo do chip
//   "retirado" de `TagVagao` (`PlanManobraX.tsx`), só o formato muda. Fundo sólido/opaco
//   (`--vli-surface`, não um tom translúcido nem vermelho vivo cheio), borda/texto continuam o
//   vermelho semântico.
// - Rótulo T1/T2/T3... desenhado numa posição FIXA e independente do ícone (`RotuloReferencia` em
//   `etapa.referenciaM`, não em cima do ícone que fica em `distanciaM`/`posCabecaM`) — a
//   referência não pode "seguir" o marcador de ação pra um ponto diferente do estabelecido pela
//   Parada.

interface EtapaCorteLayerProps {
  scene: ProjectedScene
  labelGutterWidth: number
  etapa?: EtapaHighlightCorte | null
}

const CARTAO_BG = 'var(--vli-surface)'
const CARTAO_BORDA = 'var(--vli-border)'
const CARTAO_TEXTO = 'var(--vli-text-hi)'
// Borda/texto continuam o vermelho semântico de "retirado" — só o FUNDO mudou (2026-08-25):
// primeiro pedido foi "não precisa ser transparente, pode ser mais opaco", mas um preenchimento
// vermelho vivo sólido trocou a cor do chip inteiro, não só a opacidade — o pedido era um fundo
// ESCURO e opaco (não translúcido misturando com o que está atrás), mantendo borda/texto
// vermelhos, não um selo vermelho cheio. `--vli-surface` é o mesmo fundo sólido (opaco, sem alpha)
// já usado no cartão de referência (`CARTAO_BG`) e no chip do pino de composição — reaproveitado
// aqui só com a borda/texto na cor semântica de perigo.
const CHIP_BORDA = 'var(--vli-danger-text)'
const CHIP_BG = 'var(--vli-surface)'
const CHIP_TEXTO = 'var(--vli-danger-text)'
const ICONE_COR = 'var(--vli-danger-text)'
/** Raio de canto dos chips de vagão — retangular, não mais pílula (2026-08-25). */
const CHIP_RAIO = 3

const ICONE_TAMANHO = 18

/** Ícone da ação de corte — direto sobre a linha, sem contorno de marcador de destino (a ação
 *  acontece ali, não é um ponto de chegada de trajeto) e SEM rótulo de referência (2026-08-25,
 *  correção: o T3 precisa ficar fixo na posição da Parada, não seguir este ícone — ver
 *  `RotuloReferencia`, desenhado separado, na posição fixa `etapa.referenciaM`). */
function IconeCorte({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x - ICONE_TAMANHO / 2}, ${y - ICONE_TAMANHO / 2})`}>
      <ScissorsLineDashed size={ICONE_TAMANHO} color={ICONE_COR} strokeWidth={2.25} />
    </g>
  )
}

/** Gap entre a etiqueta de referência e a linha — mesma folga que o ícone/pino de outras camadas
 *  de destaque usam acima do trilho. */
const ROTULO_GAP = 14

/** Etiqueta de referência (T1/T2/T3...) — posição FIXA e independente do marcador de ação
 *  (`IconeCorte`), sempre a mesma da Parada-irmã (`etapa.referenciaM`, ver `Composition.tsx`).
 *  Sem glyph de pino/ícone embaixo — só a etiqueta flutuando sobre o ponto fixo da linha. */
function RotuloReferencia({ x, y, texto }: { x: number; y: number; texto: string }) {
  return (
    <g transform={`translate(${x}, ${y - ROTULO_GAP})`}>
      <rect x={-11} y={-6.5} width={22} height={13} rx={3} fill={CARTAO_BG} stroke={CARTAO_BORDA} strokeWidth={1} />
      <text
        x={0}
        y={0.5}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={7.5}
        fontWeight={700}
        fill={CARTAO_TEXTO}
        fontFamily="Manrope, sans-serif"
      >
        {texto}
      </text>
    </g>
  )
}

function medirLarguraChip(texto: string): number {
  return texto.length * 4.6 + 14
}

const CHIP_ALTURA = 13
const CHIP_GAP = 4
/** Respiro entre o ícone e o primeiro chip — mesma régua de "nunca grudados" das outras camadas
 *  de destaque. */
const CHIP_GAP_ICONE = 12

/**
 * Fileira horizontal dos vagões cortados — alinhados ao longo da própria linha, na mesma altura
 * dela (como se estivessem posicionados na composição em cima do trajeto), terminando logo à
 * ESQUERDA do ícone (2026-08-25: os vagões ficam pra trás do ponto de corte, na direção "antes de
 * T3"; a tesoura fica onde já está — o corte não deve avançar pra depois/direita dela). Cada vagão
 * é seu próprio chip retangular (mesmo estilo/cor do chip "retirado" de `TagVagao`), não um card
 * único.
 */
function FileiraVagoesCortados({ x, y, vagoes }: { x: number; y: number; vagoes: string[] }) {
  const chipY = y - CHIP_ALTURA / 2
  const larguras = vagoes.map((id) => medirLarguraChip(`− ${id}`))
  const larguraTotal = larguras.reduce((soma, l) => soma + l, 0) + CHIP_GAP * (vagoes.length - 1)
  let cursorX = x - CHIP_GAP_ICONE - larguraTotal
  return (
    <g>
      {vagoes.map((id) => {
        const texto = `− ${id}`
        const largura = medirLarguraChip(texto)
        const chipX = cursorX
        cursorX += largura + CHIP_GAP
        return (
          <g key={id}>
            <rect x={chipX} y={chipY} width={largura} height={CHIP_ALTURA} rx={CHIP_RAIO} fill={CHIP_BG} stroke={CHIP_BORDA} strokeWidth={1} />
            <text
              x={chipX + largura / 2}
              y={chipY + CHIP_ALTURA / 2 + 0.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={7.5}
              fontWeight={700}
              fill={CHIP_TEXTO}
              fontFamily="Manrope, sans-serif"
            >
              {texto}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export function EtapaCorteLayer({ scene, labelGutterWidth, etapa }: EtapaCorteLayerProps) {
  if (!etapa) return null

  // Reaproveita a mesma geometria da Parada (`etapaParada.ts`) — só o ponto final (`xEnd`)
  // importa aqui, `xStart`/`crescente` (que descrevem um trajeto) são ignorados de propósito.
  const geometria = computeParadaGeometry(scene, etapa)
  if (!geometria) return null

  const { lineId, y, xEnd } = geometria
  const pontoX = labelGutterWidth + xEnd

  // Posição FIXA do rótulo T1/T2/T3... — independente do ponto de ação acima (2026-08-25, "a
  // referência T3 precisa estar fixa no mesmo lugar, desde Parada, não pode mudar de lugar"). Sem
  // resultado (linha não resolve — não deveria acontecer aqui já que `geometria` já resolveu a
  // mesma linha, mas defensivo), simplesmente não desenha o rótulo.
  const pontoReferencia = computePontoNaLinha(scene, etapa.linha, etapa.direcao, etapa.referenciaM)
  const referenciaX = pontoReferencia ? labelGutterWidth + pontoReferencia.x : null

  return (
    <g style={{ pointerEvents: 'none' }} data-etapa-highlight={etapa.tipo}>
      {/* Esmaece toda linha que não é a da etapa — mesma técnica/continuidade visual da Parada
         (`EtapaParadaLayer.tsx`), sinaliza que a Linha Desvio continua em destaque. */}
      {scene.lines
        .filter((line) => line.id !== lineId && line.type !== 'cco')
        .map((line) => {
          const trackHeight = resolveTrackHeight(line.type)
          return (
            <rect
              key={`dim-linha-corte-${line.id}`}
              x={labelGutterWidth + line.x}
              y={line.y - trackHeight / 2}
              width={line.width}
              height={trackHeight}
              fill={DIM_OVERLAY_FILL}
              fillOpacity={DIM_OVERLAY_OPACITY}
            />
          )
        })}

      <IconeCorte x={pontoX} y={y} />
      {etapa.vagoes.length > 0 && <FileiraVagoesCortados x={pontoX} y={y} vagoes={etapa.vagoes} />}
      {referenciaX != null && etapa.referencia && <RotuloReferencia x={referenciaX} y={y} texto={etapa.referencia} />}
    </g>
  )
}
