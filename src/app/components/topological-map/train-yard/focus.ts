import {
  computeClearGeometry,
  computeFechamentoGeometry,
  computeInclusaoRota1Geometry,
  computeInclusaoRota2Geometry,
  computeParadaGeometry,
  computeRetiradaRota1Geometry,
  computeRetiradaRota2Geometry,
} from './etapaParada'
import type { ProjectedComposition, ProjectedScene, ProjectedSegment } from './project'
import type {
  CompositionHighlight,
  EtapaHighlightClear,
  EtapaHighlightCorte,
  EtapaHighlightFechamento,
  EtapaHighlightInclusaoRota1,
  EtapaHighlightInclusaoRota2,
  EtapaHighlightParada,
  EtapaHighlightRetirada,
  EtapaHighlightRetiradaRota2,
} from './render/Composition'
import { resolveTrackHeight } from './render/Line'

// Acha, na cena já projetada, o retângulo (em coordenadas ABSOLUTAS de viewBox — já somando
// `labelGutterWidth`, mesma convenção de `YardCanvas`) que `ZoomableMapa` usa pra centralizar e
// ajustar o zoom da câmera — puro, sem DOM, sem medir o SVG renderizado.
//
// `findCompositionFocusTarget` DIFERENCIA os 3 níveis de seleção do Plano de Manobra (nada
// selecionado / Bloco / Grupo — ver `Composition.tsx`) — 2026-08-27, pedido explícito do usuário:
// "quando clico no bloco A ou B, não tá ancorando, mantém na mesma posição do J614... grupo
// mesma coisa". Nada selecionado = composição INTEIRA (todos os Blocos); Bloco = só os segmentos
// daquele Bloco; Grupo = só o(s) segmento(s) daquele Cluster (o mais específico). Etapa, quando
// presente, tem prioridade e usa seu próprio alvo geométrico (trecho/rota que a camada de Etapa
// desenha, ex. `EtapaParadaLayer.tsx`) — não a posição da composição.

export interface FocusTarget {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Margem ao redor do alvo — a câmera não encosta a caixa/chip na borda da tela. */
const FOCUS_PADDING_X = 40
const FOCUS_PADDING_Y = 40

function comPadding(x0: number, y0: number, x1: number, y1: number): FocusTarget {
  return { x0: x0 - FOCUS_PADDING_X, x1: x1 + FOCUS_PADDING_X, y0: y0 - FOCUS_PADDING_Y, y1: y1 + FOCUS_PADDING_Y }
}

/** Margem ao redor do alvo do pino/segmento — simétrica (2026-08-27: o antigo `CartaoPino`, que
 *  só crescia PRA CIMA do pino, foi removido do mapa — o resumo trem/Bloco/Grupo agora mora num
 *  painel fixo no canto inferior esquerdo, `PainelInfoMapa`, `PlanejamentoScreen.tsx` — não há
 *  mais nada acima do pino reservando espaço extra). */
const PIN_MARGEM_LATERAL = 90
const PIN_MARGEM_VERTICAL = 40

/** Alvo = a composição INTEIRA (todos os Blocos) — nível "nada selecionado". */
function alvoComposicaoInteira(scene: ProjectedScene, composition: ProjectedComposition): FocusTarget {
  const x0 = scene.labelGutterWidth + composition.x
  const x1 = x0 + composition.width
  const y = composition.y
  return { x0: x0 - PIN_MARGEM_LATERAL, x1: x1 + PIN_MARGEM_LATERAL, y0: y - PIN_MARGEM_VERTICAL, y1: y + PIN_MARGEM_VERTICAL }
}

/** Alvo = a união (min/max) de um subconjunto de segmentos da composição — níveis Bloco (todos
 *  os segmentos daquele `blocoId`) e Grupo (só o(s) segmento(s) daquele `clusterId`). `null`
 *  quando a lista vier vazia (Bloco/Grupo sem nenhum segmento correspondente — não deveria
 *  acontecer com um `highlight` válido, mas evita quebrar). */
function alvoSegmentos(scene: ProjectedScene, composition: ProjectedComposition, segmentos: ProjectedSegment[]): FocusTarget | null {
  if (segmentos.length === 0) return null
  const x0 = scene.labelGutterWidth + Math.min(...segmentos.map((s) => s.x))
  const x1 = scene.labelGutterWidth + Math.max(...segmentos.map((s) => s.x + s.width))
  const y = composition.y
  return { x0: x0 - PIN_MARGEM_LATERAL, x1: x1 + PIN_MARGEM_LATERAL, y0: y - PIN_MARGEM_VERTICAL, y1: y + PIN_MARGEM_VERTICAL }
}

/**
 * `null` quando o trem `trem` não tem composição REAL na cena (ficha não aprovada, ou pátio
 * vazio) — quem chama decide o que fazer nesse caso (hoje: não mover a câmera).
 *
 * 2026-08-27, bug corrigido — pedido explícito do usuário: "quando clico no tren, nos blocos ou
 * grupos, deve ancorar corretamente... não está ancorando no mapa". Causa raiz #1: esta função
 * pegava a PRIMEIRA composição de QUALQUER tipo na cena, sem checar `background`/id — corrigido
 * buscando por id EXATO (`composicao-${trem}`, mesma convenção de `buildTrainComposition`), igual
 * à busca já usada em `composicaoSelecionada`, `PlanejamentoScreen.tsx`.
 *
 * Causa raiz #2 (reportada em seguida, com o #1 já corrigido): "quando clico em J614... não
 * mostra o trem todo, só o primeiro bloco. se eu clico no bloco A ou B, não tá ancorando, mantém
 * na mesma posição do J614... grupo mesma coisa" — ANTES desta correção, os 3 níveis de seleção
 * (nada/Bloco/Grupo) sempre resolviam pro MESMO alvo (só o PONTO INICIAL da composição, com uma
 * margem lateral fixa e pequena — 90 unidades — bem menor que o comprimento real de um trem
 * inteiro) — um design que fazia sentido ENQUANTO existia o `CartaoPino` flutuante (o "pino" era
 * só um ponto de ancoragem pro cartão, a posição em si não importava tanto). Sem o cartão, a
 * câmera agora PRECISA mostrar fisicamente a área certa: `highlight` (opcional) direciona o alvo
 * pro subconjunto de segmentos certo — Grupo (`clusterId`) é o mais específico, Bloco
 * (`blocoId` sem `clusterId`) vem em seguida, e sem `highlight` nenhum mostra a composição
 * INTEIRA (todos os Blocos, não só o primeiro).
 */
export function findCompositionFocusTarget(
  scene: ProjectedScene,
  trem: string,
  highlight?: CompositionHighlight | null,
): FocusTarget | null {
  const idAlvo = `composicao-${trem}`
  for (const line of scene.lines) {
    for (const el of line.elements) {
      if (el.kind !== 'composition' || el.id !== idAlvo) continue
      const composition = el as ProjectedComposition
      if (highlight?.clusterId) {
        const segmentos = composition.segments.filter((s) => s.clusterId === highlight.clusterId)
        return alvoSegmentos(scene, composition, segmentos) ?? alvoComposicaoInteira(scene, composition)
      }
      if (highlight?.blocoId) {
        const segmentos = composition.segments.filter((s) => s.blocoId === highlight.blocoId)
        return alvoSegmentos(scene, composition, segmentos) ?? alvoComposicaoInteira(scene, composition)
      }
      return alvoComposicaoInteira(scene, composition)
    }
  }
  return null
}

/**
 * Alvo = um ou mais veículos (locomotiva/vagão) ESPECÍFICOS da composição do trem — 2026-08-27,
 * pedido explícito do usuário: "se eu clicar em algum vagão, ou locomotiva, ele deve ancorar no
 * mapa mostrando esse vagão específico" (clique num chip de `TagVagao`, "Composição Geral do Trem
 * — Antes/Depois", `PlanManobraX.tsx`), e em seguida: "eu posso ir selecionando mais de um
 * [vagão]" — multi-seleção, não mais um veículo só. Busca em TODOS os segmentos da composição
 * (não filtra por Bloco/Grupo — o veículo pode estar em qualquer um deles) pelos ids exatos das
 * unidades (`ProjectedUnit.id`, mesmo id mostrado no chip) e enquadra a UNIÃO (min/max) de todos
 * os encontrados — mesma técnica de `alvoSegmentos` acima, só que por unidade em vez de por
 * segmento inteiro. Margem de `comPadding` (a mesma dos alvos de Etapa "de ponto", não a
 * `PIN_MARGEM_LATERAL`/`PIN_MARGEM_VERTICAL` acima — bem maior demais pra um veículo só, ~9-20m de
 * comprimento real): um veículo sozinho precisa de uma câmera BEM mais próxima que um Bloco/Grupo
 * inteiro pra realmente parecer "ancorado nele". `null` quando `veiculoIds` vem vazio ou nenhum
 * dos ids é encontrado na composição do trem (seleção vazia, ou ids inválidos/obsoletos).
 */
export function findVeiculoFocusTarget(scene: ProjectedScene, trem: string, veiculoIds: string[]): FocusTarget | null {
  if (veiculoIds.length === 0) return null
  const idAlvo = `composicao-${trem}`
  const idsAlvo = new Set(veiculoIds)
  for (const line of scene.lines) {
    for (const el of line.elements) {
      if (el.kind !== 'composition' || el.id !== idAlvo) continue
      const composition = el as ProjectedComposition
      const encontrados = composition.segments.flatMap((segmento) => segmento.units?.filter((u) => u.id && idsAlvo.has(u.id)) ?? [])
      if (encontrados.length === 0) continue
      const x0 = scene.labelGutterWidth + Math.min(...encontrados.map((u) => u.x))
      const x1 = scene.labelGutterWidth + Math.max(...encontrados.map((u) => u.x + u.width))
      return comPadding(x0, composition.y, x1, composition.y)
    }
  }
  return null
}

/**
 * Etapa PARADA em destaque — bounding box do TRECHO (início≠fim) calculado por
 * `computeParadaGeometry` (`etapaParada.ts`), o MESMO usado por `EtapaParadaLayer.tsx` pra
 * desenhar o trecho/seta/marcador — câmera e conteúdo renderizado nunca discordam sobre onde o
 * trecho está. `null` quando a linha citada não existe na cena (mesmo caso de
 * `computeParadaGeometry`).
 */
export function findEtapaFocusTarget(scene: ProjectedScene, etapa: EtapaHighlightParada): FocusTarget | null {
  const geometria = computeParadaGeometry(scene, etapa)
  if (!geometria) return null
  const linha = scene.lines.find((l) => l.id === geometria.lineId)
  const trackHeight = linha ? resolveTrackHeight(linha.type) : 9
  const x0 = scene.labelGutterWidth + Math.min(geometria.xStart, geometria.xEnd)
  const x1 = scene.labelGutterWidth + Math.max(geometria.xStart, geometria.xEnd)
  return comPadding(x0, geometria.y - trackHeight, x1, geometria.y + trackHeight)
}

/**
 * Etapa CLEAR em destaque — mesma lógica de `findEtapaFocusTarget` (trecho início≠fim, mesmo
 * tratamento visual da Parada), só troca `computeParadaGeometry` por `computeClearGeometry`
 * porque o trecho do Clear não parte do início físico da linha (ver `EtapaHighlightClear`).
 */
export function findEtapaClearFocusTarget(scene: ProjectedScene, etapa: EtapaHighlightClear): FocusTarget | null {
  const geometria = computeClearGeometry(scene, etapa)
  if (!geometria) return null
  const linha = scene.lines.find((l) => l.id === geometria.lineId)
  const trackHeight = linha ? resolveTrackHeight(linha.type) : 9
  const x0 = scene.labelGutterWidth + Math.min(geometria.xStart, geometria.xEnd)
  const x1 = scene.labelGutterWidth + Math.max(geometria.xStart, geometria.xEnd)
  return comPadding(x0, geometria.y - trackHeight, x1, geometria.y + trackHeight)
}

/** Margem ao redor do PONTO de um Corte — assimétrica pelo mesmo motivo do pino de composição
 *  (`alvoDoPino`, acima): rótulo de referência cresce PRA CIMA do ícone, fileira de vagões
 *  cortados cresce PRA ESQUERDA dele NA HORIZONTAL (2026-08-25 — os vagões ficam pra trás do
 *  ponto de corte, "antes" na direção do trecho, nunca passando pra depois/direita da tesoura),
 *  então a câmera precisa de bem mais espaço à esquerda do que à direita. Esquerda generosa o
 *  bastante pra alguns vagões (`EtapaCorteLayer.tsx`, `medirLarguraChip`) sem cortar a fileira. */
const CORTE_MARGEM_ESQUERDA = 260
const CORTE_MARGEM_DIREITA = 40
const CORTE_MARGEM_CIMA = 45
const CORTE_MARGEM_BAIXO = 30

/**
 * Etapa CORTE em destaque — SEM trecho (a composição não se desloca): o alvo é um PONTO só
 * (mesma posição da Parada-irmã, ver `EtapaHighlightCorte`), com margem suficiente pro rótulo de
 * referência acima e a fileira horizontal de vagões cortados à esquerda do ícone
 * (`EtapaCorteLayer.tsx`) — mesma categoria de alvo "ponto + conteúdo flutuante" do pino de
 * composição (`alvoDoPino`), não a de um trecho longo como a Parada.
 */
export function findEtapaCorteFocusTarget(scene: ProjectedScene, etapa: EtapaHighlightCorte): FocusTarget | null {
  const geometria = computeParadaGeometry(scene, etapa)
  if (!geometria) return null
  const x = scene.labelGutterWidth + geometria.xEnd
  const y = geometria.y
  return { x0: x - CORTE_MARGEM_ESQUERDA, x1: x + CORTE_MARGEM_DIREITA, y0: y - CORTE_MARGEM_CIMA, y1: y + CORTE_MARGEM_BAIXO }
}

/** Margem ao redor do trajeto da Rota 1 de Retirada — bem menor que a de outras camadas de
 *  ponto/ícone (ex. `CORTE_MARGEM_*`, acima): o trecho real (25m) já é curto, margem generosa só
 *  encolhia ainda mais ele relativo ao container. Margem pequena = o trecho ocupa uma fração
 *  MAIOR da tela, mais "comprido" visualmente (2026-08-25, pedido explícito: "o trajeto precisa
 *  ser mais comprido/espaçado visualmente... ocupando mais espaço horizontal na tela"). */
const RETIRADA_MARGEM_X = 20
const RETIRADA_MARGEM_CIMA = 30
const RETIRADA_MARGEM_BAIXO = 20
/** MESMO deslocamento de `REVERSAO_OFFSET_X` (`EtapaRetiradaLayer.tsx`) — duplicado aqui (motor de
 *  mapa mantém câmera/render independentes) só pra saber o quão mais à esquerda a tag de reversão
 *  fica em relação à junção real, e não cortar ela no enquadramento. */
const RETIRADA_TAG_REVERSAO_OFFSET_X = 72
/** Meia-largura aproximada da tag de reversão (pra não cortar ela na borda do enquadramento). */
const RETIRADA_TAG_REVERSAO_MARGEM = 40
/** MESMA extensão de `INICIO_EXTENSAO_X` (`EtapaRetiradaLayer.tsx`) — duplicada aqui só pra saber
 *  o quanto a ponta inicial (direita) estica além do ponto real, e não cortar o marcador de
 *  início no enquadramento (2026-08-25, "aumente o comprimento da linha um pouco pra direita
 *  também, consequentemente empurrando o ponto inicial pra direita também"). */
const RETIRADA_INICIO_EXTENSAO_X = 20

/**
 * Rota 1 de Retirada em destaque — os 3 trechos desenhados por `EtapaRetiradaLayer.tsx` (Linha 3
 * → T3 → Linha Desvio, terminando no pino de chegada) e a tag de reversão, que fica mais à
 * esquerda que a junção real (ver `TagReversao`). `null` nos mesmos casos de
 * `computeRetiradaRota1Geometry` (linha não resolve ou não existe conexão real entre elas).
 */
export function findEtapaRetiradaFocusTarget(scene: ProjectedScene, etapa: EtapaHighlightRetirada): FocusTarget | null {
  const geometria = computeRetiradaRota1Geometry(scene, etapa)
  if (!geometria) return null
  // Inclui os 3 trechos (Linha 3 → T3 → Linha Desvio), o pino de chegada e a tag de reversão
  // (2026-08-25: câmera precisa enquadrar a Rota 1 inteira, agora que ela desenha até o final).
  const sentido = geometria.origemX >= geometria.juncaoOrigemX ? -1 : 1
  const reversaoX = geometria.juncaoOrigemX + sentido * RETIRADA_TAG_REVERSAO_OFFSET_X
  const origemXVisual = geometria.origemX - sentido * RETIRADA_INICIO_EXTENSAO_X
  const xs = [origemXVisual, geometria.juncaoOrigemX, geometria.conexaoDestinoX, geometria.finalX, reversaoX]
  const ys = [geometria.yOrigem, geometria.yDestino]
  const x0 = scene.labelGutterWidth + Math.min(...xs) - RETIRADA_TAG_REVERSAO_MARGEM
  const x1 = scene.labelGutterWidth + Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  return { x0: x0 - RETIRADA_MARGEM_X, x1: x1 + RETIRADA_MARGEM_X, y0: y0 - RETIRADA_MARGEM_CIMA, y1: y1 + RETIRADA_MARGEM_BAIXO }
}

/** MESMO deslocamento de `REVERSAO_OFFSET_X` (`EtapaRetiradaRota2Layer.tsx`) — duplicado aqui
 *  pelo mesmo motivo de `RETIRADA_TAG_REVERSAO_OFFSET_X` acima. */
const RETIRADA_ROTA2_TAG_REVERSAO_OFFSET_X = 72
/** Meia-largura aproximada da tag de reversão da Rota 2 — mesma régua da Rota 1. */
const RETIRADA_ROTA2_TAG_REVERSAO_MARGEM = 40

/**
 * Rota 2 de Retirada em destaque — os 3 trechos desenhados por `EtapaRetiradaRota2Layer.tsx`
 * (Linha Desvio → T3 → Linha Meio → BRANCH L4 FIM → Linha Final, terminando no pino de chegada) e
 * a tag de reversão, que fica SEMPRE do lado direito da junção real do Trecho 1 (2026-08-26,
 * pedido explícito do usuário — diferente da Rota 1, que continua no sentido do percurso). `null`
 * nos mesmos casos de `computeRetiradaRota2Geometry`.
 */
export function findEtapaRetiradaRota2FocusTarget(scene: ProjectedScene, etapa: EtapaHighlightRetiradaRota2): FocusTarget | null {
  const geometria = computeRetiradaRota2Geometry(scene, etapa)
  if (!geometria) return null
  const reversaoTagX = geometria.reversaoX + RETIRADA_ROTA2_TAG_REVERSAO_OFFSET_X
  const xs = [geometria.origemX, geometria.reversaoX, geometria.meioInicioX, geometria.meioFimX, geometria.finalInicioX, geometria.finalX, reversaoTagX]
  const ys = [geometria.yOrigem, geometria.yMeio, geometria.yFinal]
  const x0 = scene.labelGutterWidth + Math.min(...xs)
  const x1 = scene.labelGutterWidth + Math.max(...xs) + RETIRADA_ROTA2_TAG_REVERSAO_MARGEM
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  return { x0: x0 - RETIRADA_MARGEM_X, x1: x1 + RETIRADA_MARGEM_X, y0: y0 - RETIRADA_MARGEM_CIMA, y1: y1 + RETIRADA_MARGEM_BAIXO }
}

/** MESMA régua de `medirLarguraChip`/`FileiraVagoesIncluidos` (`EtapaInclusaoRota1Layer.tsx`),
 *  duplicada aqui só pra saber o quanto a fileira de chips estica à direita do pino de chegada, e
 *  não cortar os vagões no enquadramento. */
function larguraFileiraVagoesIncluidos(vagoes: string[]): number {
  if (vagoes.length === 0) return 0
  const medirLarguraChip = (texto: string) => texto.length * 4.6 + 14
  const gapPino = 20
  const gapChip = 4
  const larguras = vagoes.map((id) => medirLarguraChip(`+ ${id}`))
  return gapPino + larguras.reduce((soma, l) => soma + l, 0) + gapChip * (vagoes.length - 1)
}

/**
 * Rota 1 de Inclusão em destaque — os 3 trechos desenhados por `EtapaInclusaoRota1Layer.tsx`
 * (Linha Origem → BRANCH L4 FIM → Linha Destino, terminando no pino de chegada) e a fileira de
 * vagões a incluir, que estica à direita do pino. `null` nos mesmos casos de
 * `computeInclusaoRota1Geometry`.
 */
export function findEtapaInclusaoRota1FocusTarget(scene: ProjectedScene, etapa: EtapaHighlightInclusaoRota1): FocusTarget | null {
  const geometria = computeInclusaoRota1Geometry(scene, etapa)
  if (!geometria) return null
  const xs = [geometria.origemX, geometria.juncaoOrigemX, geometria.juncaoDestinoX, geometria.finalX]
  const ys = [geometria.yOrigem, geometria.yDestino]
  const larguraChips = larguraFileiraVagoesIncluidos(etapa.vagoesIncluidos)
  const x0 = scene.labelGutterWidth + Math.min(...xs)
  const x1 = scene.labelGutterWidth + Math.max(...xs) + larguraChips
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  return { x0: x0 - RETIRADA_MARGEM_X, x1: x1 + RETIRADA_MARGEM_X, y0: y0 - RETIRADA_MARGEM_CIMA, y1: y1 + RETIRADA_MARGEM_BAIXO }
}

/** MESMO deslocamento de `REVERSAO_OFFSET_X` (`EtapaInclusaoRota2Layer.tsx`) — duplicado aqui pelo
 *  mesmo motivo de `RETIRADA_TAG_REVERSAO_OFFSET_X`/`RETIRADA_ROTA2_TAG_REVERSAO_OFFSET_X` acima. */
const INCLUSAO_ROTA2_TAG_REVERSAO_OFFSET_X = 72
/** Meia-largura aproximada da tag de reversão da Rota 2 de Inclusão — mesma régua das outras. */
const INCLUSAO_ROTA2_TAG_REVERSAO_MARGEM = 40

/**
 * Rota 2 de Inclusão em destaque — os 2 trechos desenhados por `EtapaInclusaoRota2Layer.tsx`
 * (Linha 3 → T3 → Linha Desvio, terminando no MESMO ponto fixo da Rota 1 de Retirada — sem pino
 * novo) e a tag de reversão, do lado direito da junção real do Trecho 1 (mesma convenção da Rota 2
 * de Retirada). `null` nos mesmos casos de `computeInclusaoRota2Geometry`.
 */
export function findEtapaInclusaoRota2FocusTarget(scene: ProjectedScene, etapa: EtapaHighlightInclusaoRota2): FocusTarget | null {
  const geometria = computeInclusaoRota2Geometry(scene, etapa)
  if (!geometria) return null
  const reversaoTagX = geometria.reversaoX + INCLUSAO_ROTA2_TAG_REVERSAO_OFFSET_X
  const xs = [geometria.origemX, geometria.reversaoX, geometria.finalInicioX, geometria.finalX, reversaoTagX]
  const ys = [geometria.yOrigem, geometria.yFinal]
  const x0 = scene.labelGutterWidth + Math.min(...xs)
  const x1 = scene.labelGutterWidth + Math.max(...xs) + INCLUSAO_ROTA2_TAG_REVERSAO_MARGEM
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  return { x0: x0 - RETIRADA_MARGEM_X, x1: x1 + RETIRADA_MARGEM_X, y0: y0 - RETIRADA_MARGEM_CIMA, y1: y1 + RETIRADA_MARGEM_BAIXO }
}

/** MESMO deslocamento de `SELO_OFFSET_X` (`EtapaFechamentoLayer.tsx`) — duplicado aqui pelo mesmo
 *  motivo dos outros offsets de tag/selo acima, pra não cortar o selo de conclusão no
 *  enquadramento. */
const FECHAMENTO_SELO_OFFSET_X = 72
/** Meia-largura aproximada do selo "Manobra concluída" (bem mais largo que as tags de reversão —
 *  texto maior). */
const FECHAMENTO_SELO_MARGEM = 90

/**
 * FECHAMENTO em destaque — o único trecho (reto, recuo) desenhado por `EtapaFechamentoLayer.tsx`,
 * o pino de chegada e o selo de conclusão, que fica do lado do pino no sentido do recuo. `null`
 * nos mesmos casos de `computeFechamentoGeometry`.
 */
export function findEtapaFechamentoFocusTarget(scene: ProjectedScene, etapa: EtapaHighlightFechamento): FocusTarget | null {
  const geometria = computeFechamentoGeometry(scene, etapa)
  if (!geometria) return null
  const sentido = geometria.origemX <= geometria.finalX ? 1 : -1
  const seloX = geometria.finalX + sentido * FECHAMENTO_SELO_OFFSET_X
  const xs = [geometria.origemX, geometria.finalX, seloX]
  const x0 = scene.labelGutterWidth + Math.min(...xs) - FECHAMENTO_SELO_MARGEM
  const x1 = scene.labelGutterWidth + Math.max(...xs) + FECHAMENTO_SELO_MARGEM
  return { x0: x0 - RETIRADA_MARGEM_X, x1: x1 + RETIRADA_MARGEM_X, y0: geometria.y - RETIRADA_MARGEM_CIMA, y1: geometria.y + RETIRADA_MARGEM_BAIXO }
}

/** `null` quando nada selecionado — o mapa não muda nesse caso, quem chama (`ZoomableMapa`) cai
 *  pro alvo agregado (`findCompositionFocusTarget(scene, trem)`, sem `highlight` = composição
 *  inteira — ver comentário do topo do arquivo). Etapa, quando presente, tem prioridade sobre
 *  Bloco/Grupo: usa seu próprio alvo geométrico (trecho/rota). Etapa sem geometria resolvível cai
 *  pro alvo de Bloco/Grupo em vez de não mover a câmera. `trem` e `highlight` — repassados pra
 *  `findCompositionFocusTarget` nos níveis Bloco/Grupo (ver comentário lá — precisa saber QUAL
 *  composição é a real e qual subconjunto de segmentos mostrar). */
export function findHighlightFocusTarget(scene: ProjectedScene, highlight: CompositionHighlight, trem: string): FocusTarget | null {
  if (highlight.etapa) {
    const etapa = highlight.etapa
    const alvo =
      etapa.tipo === 'CORTE' ? findEtapaCorteFocusTarget(scene, etapa)
      : etapa.tipo === 'CLEAR' ? findEtapaClearFocusTarget(scene, etapa)
      : etapa.tipo === 'RETIRADA' && etapa.rotaIndex === 1 ? findEtapaRetiradaRota2FocusTarget(scene, etapa as EtapaHighlightRetiradaRota2)
      : etapa.tipo === 'RETIRADA' ? findEtapaRetiradaFocusTarget(scene, etapa as EtapaHighlightRetirada)
      : etapa.tipo === 'INCLUSAO' && etapa.rotaIndex === 1 ? findEtapaInclusaoRota2FocusTarget(scene, etapa as EtapaHighlightInclusaoRota2)
      : etapa.tipo === 'INCLUSAO' ? findEtapaInclusaoRota1FocusTarget(scene, etapa)
      : etapa.tipo === 'FECHAMENTO' ? findEtapaFechamentoFocusTarget(scene, etapa)
      : findEtapaFocusTarget(scene, etapa)
    if (alvo) return alvo
  }
  if (highlight.clusterId || highlight.blocoId) return findCompositionFocusTarget(scene, trem, highlight)
  return null
}
