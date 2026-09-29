import type { ProjectedConnection, ProjectedLine, ProjectedScene } from './project'
import type {
  EtapaHighlight,
  EtapaHighlightClear,
  EtapaHighlightFechamento,
  EtapaHighlightInclusaoRota1,
  EtapaHighlightInclusaoRota2,
  EtapaHighlightRetirada,
  EtapaHighlightRetiradaRota2,
  InclusaoRota1Origem,
  InclusaoRota2Origem,
  RetiradaRota1Origem,
  RetiradaRota2Origem,
} from './render/Composition'

// Geometria do destaque de PARADA/CORTE/CLEAR no mapa — puro, sem React (mesmo espírito de
// `scale.ts`/`project.ts`). Resolve os campos de `EtapaHighlight` (linha/referência/direção/
// distância, ver `Composition.tsx`) contra a cena já projetada (`ProjectedScene`) para um
// segmento desenhável. Reaproveitada por `EtapaCorteLayer.tsx` também: Corte não tem trajeto
// próprio, mas usa o mesmo `distanciaM` (`apoio.posCabecaM`) pra achar seu ponto (só `xEnd`/`y`
// importam pra ele, `xStart` é ignorado — ver `EtapaHighlightCorte`). Clear TEM trajeto real, mas
// não parte do zero da linha — `EtapaHighlightClear.origemM` desloca a ORIGEM do cálculo pro
// ponto onde a Parada-irmã já parou, em vez do início físico da linha (ver `computeSegmento`).
//
// DUAS CONVENÇÕES NOVAS fixadas aqui (confirmadas com o usuário antes de implementar — o modelo
// do mapa não tinha nenhuma das duas antes desta etapa):
// - `direcao` = sentido do offset ao longo da linha: "EDV" = offset crescente (o desenho anda
//   da esquerda pra direita, já que X cresce com o offset — ver `toX`, `scale.ts`), "ECJ" =
//   decrescente. Qualquer outro valor (ou ausente) cai no mesmo default de "EDV" — a origem do
//   trecho é sempre "o início da linha na direção dada", nunca a posição atual de uma composição
//   (não existe essa noção reaproveitável hoje — o trem já é sintetizado numa posição relativa
//   arbitrária, ver `planoTopologiaAdapter.ts`).
// - "referência" (T1/T2/T3...) é só o RÓTULO do marcador no ponto final, nunca a fonte da
//   posição — a posição vem inteiramente de `linha` + `direcao` + `distanciaM`. Não há, no
//   fixture do pátio, nenhum vínculo entre esses rótulos e os AMVs reais (`eht-amv-60..68`).

export interface ParadaGeometry {
  lineId: string
  /** Y da linha (centro do trilho) — mesma coordenada usada por `Line`/`Composition`. */
  y: number
  /** X (relativo à área de trilhos, SEM `labelGutterWidth` — mesma convenção de `ProjectedLine.x`)
   *  de onde a composição parte. */
  xStart: number
  /** X do ponto final — onde a Parada termina (o marcador de referência vai aqui). */
  xEnd: number
  /** `true` quando o desenho anda da esquerda pra direita (direção "EDV" ou ausente/desconhecida). */
  crescente: boolean
}

/** "Desvio" → linha cujo rótulo, sem o prefixo "L "/"Linha " e sem o sufixo "(NNN m)", bate
 *  (case-insensitive). Cobre os rótulos hoje existentes no fixture EHT ("L Desvio (1944 m)",
 *  "L3 (1758 m)", "L Principal (2034 m)", "Terminal da Ferradura") sem precisar de uma tabela
 *  de-para separada — a "Linha" do Plano de Manobra já usa esses mesmos nomes. */
export function resolveLineIdByNome(nome: string, lines: Pick<ProjectedLine, 'id' | 'label'>[]): string | undefined {
  const alvo = nome.trim().toLowerCase().replace(/^linha\s+/, '')
  for (const line of lines) {
    const label = line.label
      .toLowerCase()
      // `\s*` (não `\s+`): cobre tanto "L Desvio" (espaço antes da palavra) quanto "L3" (dígito
      // colado, sem espaço) — bug real encontrado 2026-08-25 tentando resolver "Linha 3": com
      // `\s+` a label "l3 (1758 m)" nunca perdia o "l" (não há espaço depois dele), então nunca
      // batia com o alvo "3".
      .replace(/^l\s*/, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim()
    if (label === alvo) return line.id
  }
  return undefined
}

/** `null` quando a linha citada não existe na cena (nome não resolve) ou não tem comprimento
 *  válido — quem chama decide o que fazer (hoje: não desenhar a camada, ver
 *  `EtapaParadaLayer.tsx`/`EtapaCorteLayer.tsx`). Núcleo compartilhado por `computeParadaGeometry`
 *  (Parada/Corte, `origemM` sempre 0 — o trecho parte do início físico da linha) e por Clear
 *  (`origemM` = onde a Parada-irmã já parou, ver `EtapaHighlightClear`). */
function computeSegmento(scene: ProjectedScene, linha: string, direcao: string | undefined, origemM: number, distanciaM: number): ParadaGeometry | null {
  const lineId = resolveLineIdByNome(linha, scene.lines)
  if (!lineId) {
    console.warn('[train-yard/etapaParada] linha da etapa não encontrada na cena', { linha })
    return null
  }
  const line = scene.lines.find((l) => l.id === lineId)
  if (!line || line.length <= 0) return null

  const crescente = direcao !== 'ECJ'
  const clamp = (v: number) => Math.min(Math.max(v, 0), line.length)
  const origemClampada = clamp(origemM)
  const destinoClampada = clamp(origemM + distanciaM)
  if (origemClampada !== origemM || destinoClampada !== origemM + distanciaM) {
    console.warn('[train-yard/etapaParada] trecho da etapa fora dos limites da linha — clampado', {
      lineId,
      lineLength: line.length,
      origemM,
      distanciaM,
    })
  }

  const toX = (metros: number) => {
    const frac = metros / line.length
    return crescente ? line.x + frac * line.width : line.x + line.width - frac * line.width
  }

  return { lineId, y: line.y, xStart: toX(origemClampada), xEnd: toX(destinoClampada), crescente }
}

export interface PontoNaLinha {
  lineId: string
  x: number
  y: number
}

/**
 * Resolve um ponto FIXO absoluto (distância do início físico da linha) contra a cena projetada —
 * usado quando um marcador precisa de uma posição independente da geometria "início→fim" de
 * `computeSegmento` (ex.: a etiqueta de referência T1/T2/T3... do Corte, que fica no mesmo lugar
 * fixo estabelecido pela Parada, mesmo quando o marcador de ação do Corte, `posCabecaM`, fica um
 * pouco antes dela — 2026-08-25, "a referência T3 precisa estar fixa no mesmo lugar, desde
 * Parada, não pode mudar de lugar"). `null` nos mesmos casos de `computeSegmento`.
 */
export function computePontoNaLinha(scene: ProjectedScene, linha: string, direcao: string | undefined, distanciaM: number): PontoNaLinha | null {
  const geometria = computeSegmento(scene, linha, direcao, 0, distanciaM)
  if (!geometria) return null
  return { lineId: geometria.lineId, x: geometria.xEnd, y: geometria.y }
}

/** `null` quando a linha citada pela etapa não existe na cena (nome não resolve) ou não tem
 *  comprimento válido — quem chama decide o que fazer (hoje: não desenhar a camada, ver
 *  `EtapaParadaLayer.tsx`). Parada/Corte sempre partem do início físico da linha (`origemM = 0`);
 *  Clear tem sua própria origem (`etapa.origemM`, ver `computeClearGeometry`); Retirada Rota 1 tem
 *  sua própria função inteira (`computeRetiradaRota1Geometry`), não passa por aqui. */
export function computeParadaGeometry(
  scene: ProjectedScene,
  etapa: Exclude<
    EtapaHighlight,
    | EtapaHighlightClear
    | EtapaHighlightRetirada
    | EtapaHighlightRetiradaRota2
    | EtapaHighlightInclusaoRota1
    | EtapaHighlightInclusaoRota2
    | EtapaHighlightFechamento
  >,
): ParadaGeometry | null {
  return computeSegmento(scene, etapa.linha, etapa.direcao, 0, etapa.distanciaM)
}

/** Geometria do trecho de Clear — mesma lógica de `computeParadaGeometry`, mas a ORIGEM do
 *  trecho é `etapa.origemM` (onde a composição já estava ao final da Parada/Corte do mesmo
 *  Grupo), não o início físico da linha. */
export function computeClearGeometry(scene: ProjectedScene, etapa: EtapaHighlightClear): ParadaGeometry | null {
  return computeSegmento(scene, etapa.linha, etapa.direcao, etapa.origemM, etapa.distanciaM)
}

/** Offset físico (metros do início FÍSICO da linha, `line.x` — sempre o mesmo lado,
 *  independente de EDV/ECJ de qualquer etapa) de um X de desenho já projetado — inverso de
 *  `toX`/`computeSegmento`. Usado só por `computeRetiradaRota1Geometry`, que precisa converter o
 *  ponto de uma CONEXÃO real (em pixels) de volta pra "metros" pra poder recuar
 *  `distanciaOrigemM` a partir dele — as outras camadas nunca precisam disso porque nunca partem
 *  de um ponto que não seja o próprio início/origem já conhecido em metros. */
function offsetFisico(x: number, line: ProjectedLine): number {
  return line.width > 0 ? ((x - line.x) / line.width) * line.length : 0
}

/** A `ProjectedConnection` entre `lineIdA`/`lineIdB` cujo lado em `lineIdB` fica mais perto de
 *  `pontoAlvoB` (em pixels) — pode haver mais de uma conexão real entre duas linhas num pátio
 *  (várias chaves ao longo do trecho), então "a mais próxima do ponto que já sabemos" é a
 *  heurística mais simples pra achar a correta sem precisar de um id explícito no fixture. `null`
 *  quando não existe nenhuma conexão entre as duas linhas na cena. */
function encontrarConexaoMaisProxima(
  scene: ProjectedScene,
  lineIdA: string,
  lineIdB: string,
  pontoAlvoB: { x: number; y: number },
): ProjectedConnection | null {
  let melhor: ProjectedConnection | null = null
  let melhorDist = Infinity
  for (const conn of scene.connections) {
    const ehAparaB = conn.fromLineId === lineIdA && conn.toLineId === lineIdB
    const ehBparaA = conn.fromLineId === lineIdB && conn.toLineId === lineIdA
    if (!ehAparaB && !ehBparaA) continue
    const pontoB = ehAparaB ? conn.to : conn.from
    const dist = Math.hypot(pontoB.x - pontoAlvoB.x, pontoB.y - pontoAlvoB.y)
    if (dist < melhorDist) {
      melhorDist = dist
      melhor = conn
    }
  }
  return melhor
}

export interface RetiradaRota1Geometry {
  lineIdOrigem: string
  lineIdDestino: string
  yOrigem: number
  yDestino: number
  /** Início do Trecho 1 (locomotiva parte daqui, Linha Origem). */
  origemX: number
  /** Fim do Trecho 1 / lado "Linha Origem" da travessia — onde a reversão acontece. */
  juncaoOrigemX: number
  /** Início do Trecho 3 / lado "Linha Destino" da travessia. */
  juncaoDestinoX: number
  /** Fim do Trecho 3 — MESMO ponto final do Clear, reaproveitado (`etapa.destinoAbsolutoM`). */
  destinoX: number
  /** A conexão real (T3) entre Linha Origem e Linha Destino — os PRÓPRIOS pontos da travessia
   *  física (`from`/`to`, em pixels), não os recuados por `distanciaDestinoM`/`distanciaOrigemM`
   *  (`juncaoOrigemX`/`juncaoDestinoX` acima). Usada por `EtapaRetiradaLayer.tsx` pra desenhar o
   *  destaque exatamente em cima do traço diagonal já existente no mapa base (2026-08-25: "faça
   *  uma linha passando exatamente em cima da T3"). */
  conexao: ProjectedConnection
  /** Lado "Linha Destino" da `conexao` — onde a travessia T3 chega em Linha Destino (mesmo Y de
   *  `yDestino`). Ponto de partida do trecho final, `distanciaDestinoM` a partir daqui (2026-08-25:
   *  "da ponta final do T3, +25m pra direita"), não mais recuado a partir do destino fixo (ver
   *  `finalX`, que substitui `juncaoDestinoX`/`destinoX` pra esse propósito). */
  conexaoDestinoX: number
  /** Ponto final da Rota 1 — `distanciaDestinoM` depois de `conexaoDestinoX`, na direção
   *  `direcaoDestino`, andando a partir da própria conexão real (não do destino fixo do Clear).
   *  Onde o pino de chegada é desenhado. */
  finalX: number
}

/** Ponto (em X de desenho) `distanciaM` ANTES de `offsetFimM` (metros físicos, já no eixo da
 *  própria linha), na direção dada — inverso de "andar `distanciaM` na direção X terminando em
 *  `offsetFimM`". Usado pra recuar a partir de um fim já conhecido (`computeRetiradaRota1Geometry`
 *  usa isso duas vezes: Trecho 1 recua da junção real; Trecho 3 recua do destino fixo). */
function recuarNaLinha(line: ProjectedLine, offsetFimM: number, direcao: string | undefined, distanciaM: number): number {
  const crescente = direcao !== 'ECJ'
  const offsetInicioM = crescente ? offsetFimM - distanciaM : offsetFimM + distanciaM
  const offsetClampado = Math.min(Math.max(offsetInicioM, 0), line.length)
  return line.x + (offsetClampado / line.length) * line.width
}

/** Ponto (em X de desenho) `distanciaM` DEPOIS de `offsetInicioM` (metros físicos, já no eixo da
 *  própria linha), na direção dada — inverso de `recuarNaLinha`: parte de um INÍCIO já conhecido
 *  e anda pra frente, em vez de recuar a partir de um fim já conhecido. Usada pelo trecho final da
 *  Rota 1 de Retirada, que agora parte do ponto real da travessia T3 (`conexaoDestinoX`) e anda
 *  `distanciaDestinoM` na direção `direcaoDestino` (2026-08-25: "da ponta final do T3, +25m pra
 *  direita"). */
function avancarNaLinha(line: ProjectedLine, offsetInicioM: number, direcao: string | undefined, distanciaM: number): number {
  const crescente = direcao !== 'ECJ'
  const offsetFimM = crescente ? offsetInicioM + distanciaM : offsetInicioM - distanciaM
  const offsetClampado = Math.min(Math.max(offsetFimM, 0), line.length)
  return line.x + (offsetClampado / line.length) * line.width
}

/**
 * Geometria da Rota 1 de Retirada (locomotiva de manobra) — bem diferente de
 * `computeParadaGeometry`/`computeClearGeometry`: começa numa linha, muda pra outra no meio (na
 * conexão REAL entre elas, `encontrarConexaoMaisProxima` — pedido explícito do usuário, ao
 * contrário de Parada/Corte/Clear que nunca amarram posição a AMVs reais) e termina num ponto FIXO
 * já conhecido (`etapa.destinoAbsolutoM`, o mesmo do Clear). Resolve de trás pra frente, dos DOIS
 * lados: o destino é fixo → recua `distanciaDestinoM` a partir dele pra achar onde o Trecho 3
 * começa (`juncaoDestinoX`) — não o ponto real da conexão em si, senão o Trecho 3 desenhado não
 * bateria com o próprio rótulo "25m" (bug real encontrado 2026-08-25: a conexão real fica ~88m do
 * destino, não os 25m do plano — usar o ponto real ali fazia o Trecho 3 desenhar 88m de verdade,
 * bem mais largo que o Trecho 1, mesmo os dois rotulados "25m"). A conexão real entre as linhas só
 * ancora o lado "Linha Origem" (onde a reversão acontece de fato — pedido explícito do usuário,
 * "ultrapassar o ponto de conexão... real"); o Trecho 1 recua `distanciaOrigemM` a partir dali do
 * mesmo jeito. `null` quando qualquer uma das linhas não resolve OU não existe conexão real entre
 * elas na cena.
 */
export function computeRetiradaRota1Geometry(scene: ProjectedScene, etapa: RetiradaRota1Origem): RetiradaRota1Geometry | null {
  const lineIdOrigem = resolveLineIdByNome(etapa.linhaOrigem, scene.lines)
  const lineIdDestino = resolveLineIdByNome(etapa.linhaDestino, scene.lines)
  if (!lineIdOrigem || !lineIdDestino) {
    console.warn('[train-yard/etapaParada] linha da Rota 1 de Retirada não encontrada na cena', {
      linhaOrigem: etapa.linhaOrigem,
      linhaDestino: etapa.linhaDestino,
    })
    return null
  }
  const lineOrigem = scene.lines.find((l) => l.id === lineIdOrigem)
  const lineDestino = scene.lines.find((l) => l.id === lineIdDestino)
  if (!lineOrigem || !lineDestino || lineOrigem.length <= 0 || lineDestino.length <= 0) return null

  const destinoPonto = computePontoNaLinha(scene, etapa.linhaDestino, etapa.direcaoDestino, etapa.destinoAbsolutoM)
  if (!destinoPonto) return null

  const juncaoDestinoX = recuarNaLinha(lineDestino, etapa.destinoAbsolutoM, etapa.direcaoDestino, etapa.distanciaDestinoM)

  const conexao = encontrarConexaoMaisProxima(scene, lineIdOrigem, lineIdDestino, { x: juncaoDestinoX, y: lineDestino.y })
  if (!conexao) {
    console.warn('[train-yard/etapaParada] nenhuma conexão real entre as linhas da Rota 1 de Retirada', {
      linhaOrigem: etapa.linhaOrigem,
      linhaDestino: etapa.linhaDestino,
    })
    return null
  }
  const juncaoOrigemPonto = conexao.fromLineId === lineIdOrigem ? conexao.from : conexao.to
  const conexaoDestinoPonto = conexao.fromLineId === lineIdDestino ? conexao.from : conexao.to

  const offsetJuncaoOrigem = offsetFisico(juncaoOrigemPonto.x, lineOrigem)
  const origemX = recuarNaLinha(lineOrigem, offsetJuncaoOrigem, etapa.direcaoOrigem, etapa.distanciaOrigemM)

  const offsetConexaoDestino = offsetFisico(conexaoDestinoPonto.x, lineDestino)
  const finalX = avancarNaLinha(lineDestino, offsetConexaoDestino, etapa.direcaoDestino, etapa.distanciaDestinoM)

  return {
    lineIdOrigem,
    lineIdDestino,
    yOrigem: lineOrigem.y,
    yDestino: lineDestino.y,
    origemX,
    juncaoOrigemX: juncaoOrigemPonto.x,
    juncaoDestinoX,
    destinoX: destinoPonto.x,
    conexao,
    conexaoDestinoX: conexaoDestinoPonto.x,
    finalX,
  }
}

export interface RetiradaRota2Geometry {
  lineIdOrigem: string
  lineIdMeio: string
  lineIdFinal: string
  yOrigem: number
  yMeio: number
  yFinal: number
  /** Início do Trecho 1 (Linha Desvio) — o MESMO ponto onde a Rota 1 termina, reaproveitado via
   *  `computeRetiradaRota1Geometry(scene, etapa.origemRota1)` (pedido explícito do usuário,
   *  2026-08-25: "reaproveite essa posição, não calcule um novo ponto"). */
  origemX: number
  /** Fim do Trecho 1 / onde a reversão acontece — lado "Linha Desvio" da conexão REAL entre Linha
   *  Desvio e Linha Meio (T3), mais próxima do ponto ideal (origem + `distanciaOrigemM`) — MESMO
   *  padrão da Rota 1 (`juncaoOrigemX`/`conexao`, ver acima): o ponto ideal só serve pra achar a
   *  conexão real, o desenho usa sempre o ponto real. */
  reversaoX: number
  /** A conexão real (T3) entre Linha Desvio e Linha Meio. */
  conexaoT3: ProjectedConnection
  /** Lado "Linha Meio" de `conexaoT3` — início do Trecho 2 (Linha 3). */
  meioInicioX: number
  /** Fim do Trecho 2 — lado "Linha Meio" da conexão REAL entre Linha Meio e Linha Final (BRANCH
   *  L4 FIM), mais próxima do ponto ideal (início do Trecho 2 − `distanciaMeioM`). */
  meioFimX: number
  /** A conexão real (BRANCH L4 FIM) entre Linha Meio e Linha Final. */
  conexaoBranch: ProjectedConnection
  /** Lado "Linha Final" de `conexaoBranch` — início do Trecho 3 (Linha 4). */
  finalInicioX: number
  /** Fim do Trecho 3 — ponto final da Rota 2 (pino de chegada), `distanciaFinalM` depois de
   *  `finalInicioX`. Sem correção por conexão real depois deste ponto — é o fim da rota, não há
   *  mais nada pra ancorar (mesmo padrão do `finalX` da Rota 1). */
  finalX: number
}

/**
 * Geometria da Rota 2 de Retirada (retirada até o destino) — encadeia DUAS travessias reais (T3 e
 * BRANCH L4 FIM, mesmo padrão de âncora-pela-conexão-real da Rota 1, `encontrarConexaoMaisProxima`)
 * a partir do MESMO ponto onde a Rota 1 termina (`etapa.origemRota1`, resolvido via
 * `computeRetiradaRota1Geometry` — não recalculado do zero, pedido explícito do usuário,
 * 2026-08-25). Só UMA reversão, logo no Trecho 1 (Linha Desvio); tudo depois dela (T3 → Linha 3 →
 * BRANCH L4 FIM → Linha 4) anda na MESMA direção, `etapa.direcaoPosReversao`. `null` quando a Rota
 * 1 não resolve (mesmos casos de `computeRetiradaRota1Geometry`) OU quando Linha Meio/Linha Final
 * não resolvem OU não existe conexão real entre as linhas encadeadas na cena.
 */
export function computeRetiradaRota2Geometry(scene: ProjectedScene, etapa: RetiradaRota2Origem): RetiradaRota2Geometry | null {
  const rota1 = computeRetiradaRota1Geometry(scene, etapa.origemRota1)
  if (!rota1) return null
  const lineOrigem = scene.lines.find((l) => l.id === rota1.lineIdDestino)
  if (!lineOrigem || lineOrigem.length <= 0) return null

  const lineIdMeio = resolveLineIdByNome(etapa.linhaMeio, scene.lines)
  const lineIdFinal = resolveLineIdByNome(etapa.linhaFinal, scene.lines)
  if (!lineIdMeio || !lineIdFinal) {
    console.warn('[train-yard/etapaParada] linha da Rota 2 de Retirada não encontrada na cena', {
      linhaMeio: etapa.linhaMeio,
      linhaFinal: etapa.linhaFinal,
    })
    return null
  }
  const lineMeio = scene.lines.find((l) => l.id === lineIdMeio)
  const lineFinal = scene.lines.find((l) => l.id === lineIdFinal)
  if (!lineMeio || !lineFinal || lineMeio.length <= 0 || lineFinal.length <= 0) return null

  // Origem = MESMO ponto onde a Rota 1 terminou.
  const origemX = rota1.finalX
  const offsetOrigem = offsetFisico(origemX, lineOrigem)
  const alvoReversao = avancarNaLinha(lineOrigem, offsetOrigem, etapa.direcaoOrigem, etapa.distanciaOrigemM)

  const conexaoT3 = encontrarConexaoMaisProxima(scene, lineIdMeio, rota1.lineIdDestino, { x: alvoReversao, y: lineOrigem.y })
  if (!conexaoT3) {
    console.warn('[train-yard/etapaParada] nenhuma conexão real (T3) entre Linha Desvio e Linha Meio na Rota 2 de Retirada', {
      linhaMeio: etapa.linhaMeio,
    })
    return null
  }
  const reversaoX = (conexaoT3.fromLineId === rota1.lineIdDestino ? conexaoT3.from : conexaoT3.to).x
  const meioInicioX = (conexaoT3.fromLineId === lineIdMeio ? conexaoT3.from : conexaoT3.to).x

  const offsetMeioInicio = offsetFisico(meioInicioX, lineMeio)
  const alvoMeioFim = avancarNaLinha(lineMeio, offsetMeioInicio, etapa.direcaoPosReversao, etapa.distanciaMeioM)

  const conexaoBranch = encontrarConexaoMaisProxima(scene, lineIdFinal, lineIdMeio, { x: alvoMeioFim, y: lineMeio.y })
  if (!conexaoBranch) {
    console.warn('[train-yard/etapaParada] nenhuma conexão real (BRANCH L4 FIM) entre Linha Meio e Linha Final na Rota 2 de Retirada', {
      linhaFinal: etapa.linhaFinal,
    })
    return null
  }
  const meioFimX = (conexaoBranch.fromLineId === lineIdMeio ? conexaoBranch.from : conexaoBranch.to).x
  const finalInicioX = (conexaoBranch.fromLineId === lineIdFinal ? conexaoBranch.from : conexaoBranch.to).x

  const offsetFinalInicio = offsetFisico(finalInicioX, lineFinal)
  const finalX = avancarNaLinha(lineFinal, offsetFinalInicio, etapa.direcaoPosReversao, etapa.distanciaFinalM)

  return {
    lineIdOrigem: rota1.lineIdDestino,
    lineIdMeio,
    lineIdFinal,
    yOrigem: lineOrigem.y,
    yMeio: lineMeio.y,
    yFinal: lineFinal.y,
    origemX,
    reversaoX,
    conexaoT3,
    meioInicioX,
    meioFimX,
    conexaoBranch,
    finalInicioX,
    finalX,
  }
}

export interface InclusaoRota1Geometry {
  lineIdOrigem: string
  lineIdDestino: string
  yOrigem: number
  yDestino: number
  /** Início do trecho (Linha 4) — o MESMO ponto onde a Rota 2 de Retirada termina, reaproveitado
   *  via `computeRetiradaRota2Geometry(scene, etapa.origemRetiradaRota2)` (pedido explícito do
   *  usuário, 2026-08-26: "reaproveite esse ponto como origem, não calcule um novo"). */
  origemX: number
  /** Fim do trecho / lado "Linha Origem" da travessia — lado real da conexão (BRANCH L4 FIM),
   *  mais próxima do ponto ideal (origem + `distanciaOrigemM`). */
  juncaoOrigemX: number
  /** A conexão real (BRANCH L4 FIM) entre Linha Origem e Linha Destino. */
  conexao: ProjectedConnection
  /** Lado "Linha Destino" de `conexao` — início do trecho final (Linha 3). */
  juncaoDestinoX: number
  /** Fim do trecho final — onde estão os vagões de substituição (pino de chegada). */
  finalX: number
}

/**
 * Geometria da Rota 1 de Inclusão (deslocamento inicial da locomotiva) — SEM reversão, mais
 * simples que as duas rotas de Retirada: parte do MESMO ponto onde a Rota 2 de Retirada termina
 * (`etapa.origemRetiradaRota2`, resolvido via `computeRetiradaRota2Geometry` — não recalculado do
 * zero, pedido explícito do usuário, 2026-08-26), cruza UMA travessia real (âncora-pela-conexão-
 * real, mesmo padrão de `computeRetiradaRota1Geometry`/`computeRetiradaRota2Geometry`,
 * `encontrarConexaoMaisProxima`) e termina num trecho final na direção destino. Só UMA direção o
 * tempo todo (`etapa.direcaoOrigem`, sem "Direção 2" — não há reversão). `null` quando a Rota 2 de
 * Retirada não resolve (mesmos casos de `computeRetiradaRota2Geometry`) OU Linha Destino não
 * resolve OU não existe conexão real entre as linhas na cena.
 */
export function computeInclusaoRota1Geometry(scene: ProjectedScene, etapa: InclusaoRota1Origem): InclusaoRota1Geometry | null {
  const rota2 = computeRetiradaRota2Geometry(scene, etapa.origemRetiradaRota2)
  if (!rota2) return null
  const lineOrigem = scene.lines.find((l) => l.id === rota2.lineIdFinal)
  if (!lineOrigem || lineOrigem.length <= 0) return null

  const lineIdDestino = resolveLineIdByNome(etapa.linhaDestino, scene.lines)
  if (!lineIdDestino) {
    console.warn('[train-yard/etapaParada] linha da Rota 1 de Inclusão não encontrada na cena', { linhaDestino: etapa.linhaDestino })
    return null
  }
  const lineDestino = scene.lines.find((l) => l.id === lineIdDestino)
  if (!lineDestino || lineDestino.length <= 0) return null

  // Origem = MESMO ponto onde a Rota 2 de Retirada terminou.
  const origemX = rota2.finalX
  const offsetOrigem = offsetFisico(origemX, lineOrigem)
  const alvoJuncao = avancarNaLinha(lineOrigem, offsetOrigem, etapa.direcaoOrigem, etapa.distanciaOrigemM)

  const conexao = encontrarConexaoMaisProxima(scene, lineIdDestino, rota2.lineIdFinal, { x: alvoJuncao, y: lineOrigem.y })
  if (!conexao) {
    console.warn('[train-yard/etapaParada] nenhuma conexão real (BRANCH L4 FIM) entre Linha Origem e Linha Destino na Rota 1 de Inclusão', {
      linhaDestino: etapa.linhaDestino,
    })
    return null
  }
  const juncaoOrigemX = (conexao.fromLineId === rota2.lineIdFinal ? conexao.from : conexao.to).x
  const juncaoDestinoX = (conexao.fromLineId === lineIdDestino ? conexao.from : conexao.to).x

  const offsetJuncaoDestino = offsetFisico(juncaoDestinoX, lineDestino)
  const finalX = avancarNaLinha(lineDestino, offsetJuncaoDestino, etapa.direcaoOrigem, etapa.distanciaDestinoM)

  return {
    lineIdOrigem: rota2.lineIdFinal,
    lineIdDestino,
    yOrigem: lineOrigem.y,
    yDestino: lineDestino.y,
    origemX,
    juncaoOrigemX,
    conexao,
    juncaoDestinoX,
    finalX,
  }
}

export interface InclusaoRota2Geometry {
  lineIdOrigem: string
  lineIdFinal: string
  yOrigem: number
  yFinal: number
  /** Início do Trecho 1 (Linha 3) — o MESMO ponto onde a Rota 1 de Inclusão termina, reaproveitado
   *  via `computeInclusaoRota1Geometry(scene, etapa.origemInclusaoRota1)` (pedido explícito do
   *  usuário, 2026-08-26: "reaproveite esse ponto, não calcule um novo"). */
  origemX: number
  /** Fim do Trecho 1 / onde a reversão acontece — lado "Linha 3" da conexão REAL (T3) entre Linha
   *  3 e Linha Desvio, mais próxima do ponto ideal (origem + `distanciaOrigemM`) — mesmo padrão
   *  de `RetiradaRota2Geometry.reversaoX`. */
  reversaoX: number
  /** A conexão real (T3) entre Linha 3 e Linha Desvio. */
  conexaoT3: ProjectedConnection
  /** Lado "Linha Desvio" de `conexaoT3` — início do trecho final. */
  finalInicioX: number
  /** Fim do trecho final — NÃO é `distanciaFinalM` andado a partir de `finalInicioX`: é o MESMO
   *  ponto fixo onde a Rota 1 de RETIRADA encontrou a composição parada em Linha Desvio, ref. T3
   *  (`computeRetiradaRota1Geometry(...).finalX` — o mesmo pino que `EtapaRetiradaLayer.tsx`
   *  desenha, NÃO `.origemX`: esse é o início da Rota 1 em Linha 3, uma linha diferente, onde a
   *  locomotiva de manobra parte pra buscar a composição, não onde ela "sai daqui" no sentido do
   *  pedido do usuário — 2026-08-26: "é o fechamento do ciclo... reaproveite exatamente essa
   *  posição/pin já existente"). Garante o MESMO pixel do pino original, em vez de um ponto só
   *  aproximadamente igual calculado a partir da própria travessia T3 desta rota. */
  finalX: number
}

/**
 * Geometria da Rota 2 de Inclusão (inclusão até o destino) — parte do MESMO ponto onde a Rota 1 de
 * Inclusão termina (`etapa.origemInclusaoRota1`, resolvido via `computeInclusaoRota1Geometry` —
 * não recalculado do zero), cruza UMA travessia real (T3, mesmo padrão de âncora-pela-conexão-real
 * das demais rotas, `encontrarConexaoMaisProxima`) e TERMINA no MESMO ponto fixo onde a Rota 1 de
 * Retirada encontrou a composição parada — fechamento do ciclo. Esse ponto final vem de
 * `computeRetiradaRota1Geometry(...).finalX`, chamado de novo aqui com os dados originais
 * encadeados (`etapa.origemInclusaoRota1.origemRetiradaRota2.origemRota1`), não de
 * `avancarNaLinha` a partir da travessia — reaproveita o pino original em vez de recalcular uma
 * posição só aproximadamente igual. `null` quando a Rota 1 de Inclusão não resolve (mesmos casos
 * de `computeInclusaoRota1Geometry`), quando a Rota 1 de Retirada original não resolve (mesmos
 * casos de `computeRetiradaRota1Geometry`), OU quando Linha Final não resolve OU não existe
 * conexão real (T3) entre as linhas encadeadas na cena.
 */
export function computeInclusaoRota2Geometry(scene: ProjectedScene, etapa: InclusaoRota2Origem): InclusaoRota2Geometry | null {
  const rota1Inclusao = computeInclusaoRota1Geometry(scene, etapa.origemInclusaoRota1)
  if (!rota1Inclusao) return null
  const lineOrigem = scene.lines.find((l) => l.id === rota1Inclusao.lineIdDestino)
  if (!lineOrigem || lineOrigem.length <= 0) return null

  const lineIdFinal = resolveLineIdByNome(etapa.linhaFinal, scene.lines)
  if (!lineIdFinal) {
    console.warn('[train-yard/etapaParada] linha da Rota 2 de Inclusão não encontrada na cena', { linhaFinal: etapa.linhaFinal })
    return null
  }
  const lineFinal = scene.lines.find((l) => l.id === lineIdFinal)
  if (!lineFinal || lineFinal.length <= 0) return null

  // Ponto final fixo — MESMO ponto onde a Rota 1 de Retirada encontrou a composição parada em
  // Linha Desvio, ref. T3 (fechamento: "a locomotiva saiu daqui na Retirada e volta pra cá
  // trazendo os vagões novos" — 2026-08-26). `.finalX`, não `.origemX` (esse é o início da Rota 1
  // em Linha 3, ver comentário de `InclusaoRota2Geometry.finalX`). Reaproveitado via
  // computeRetiradaRota1Geometry, não recalculado.
  const origemRota1RetiradaGeometry = computeRetiradaRota1Geometry(scene, etapa.origemInclusaoRota1.origemRetiradaRota2.origemRota1)
  if (!origemRota1RetiradaGeometry) return null

  // Origem = MESMO ponto onde a Rota 1 de Inclusão terminou.
  const origemX = rota1Inclusao.finalX
  const offsetOrigem = offsetFisico(origemX, lineOrigem)
  const alvoReversao = avancarNaLinha(lineOrigem, offsetOrigem, etapa.direcaoOrigem, etapa.distanciaOrigemM)

  const conexaoT3 = encontrarConexaoMaisProxima(scene, lineIdFinal, rota1Inclusao.lineIdDestino, { x: alvoReversao, y: lineOrigem.y })
  if (!conexaoT3) {
    console.warn('[train-yard/etapaParada] nenhuma conexão real (T3) entre Linha 3 e Linha Desvio na Rota 2 de Inclusão', {
      linhaFinal: etapa.linhaFinal,
    })
    return null
  }
  const reversaoX = (conexaoT3.fromLineId === rota1Inclusao.lineIdDestino ? conexaoT3.from : conexaoT3.to).x
  const finalInicioX = (conexaoT3.fromLineId === lineIdFinal ? conexaoT3.from : conexaoT3.to).x

  return {
    lineIdOrigem: rota1Inclusao.lineIdDestino,
    lineIdFinal,
    yOrigem: lineOrigem.y,
    yFinal: lineFinal.y,
    origemX,
    reversaoX,
    conexaoT3,
    finalInicioX,
    finalX: origemRota1RetiradaGeometry.finalX,
  }
}

export interface FechamentoGeometry {
  lineId: string
  y: number
  /** Início do recuo — o MESMO ponto onde a Rota 2 de Inclusão termina, reaproveitado via
   *  `computeInclusaoRota2Geometry(scene, etapa.origemInclusaoRota2)` (pedido explícito do
   *  usuário, 2026-08-26: "o mesmo ponto onde a última rota (Inclusão — Rota 2) terminou...
   *  reaproveite essa posição, não calcule uma nova"). */
  origemX: number
  /** Fim do recuo — `distanciaM` andado a partir de `origemX` na direção `etapa.direcao` (sentido
   *  oposto ao de chegada da última rota). Sem travessão/conexão real envolvida — trecho reto
   *  simples na mesma linha, mesmo padrão de `avancarNaLinha` das outras camadas. */
  finalX: number
}

/**
 * Geometria do FECHAMENTO (recuo final da composição) — parte do MESMO ponto onde a Rota 2 de
 * Inclusão termina (`etapa.origemInclusaoRota2`, resolvido via `computeInclusaoRota2Geometry` —
 * não recalculado do zero) e anda `etapa.distanciaM` na direção `etapa.direcao` (recuo, sentido
 * oposto ao de chegada). Última etapa do ciclo — sem travessão, sem conexão real envolvida, só um
 * trecho reto na própria Linha Desvio. `null` quando a Rota 2 de Inclusão não resolve (mesmos
 * casos de `computeInclusaoRota2Geometry`).
 */
export function computeFechamentoGeometry(scene: ProjectedScene, etapa: EtapaHighlightFechamento): FechamentoGeometry | null {
  const rota2 = computeInclusaoRota2Geometry(scene, etapa.origemInclusaoRota2)
  if (!rota2) return null
  const line = scene.lines.find((l) => l.id === rota2.lineIdFinal)
  if (!line || line.length <= 0) return null

  const origemX = rota2.finalX
  const offsetOrigem = offsetFisico(origemX, line)
  const finalX = avancarNaLinha(line, offsetOrigem, etapa.direcao, etapa.distanciaM)

  return { lineId: rota2.lineIdFinal, y: line.y, origemX, finalX }
}
