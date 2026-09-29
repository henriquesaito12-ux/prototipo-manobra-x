import type { ProjectedComposition, ProjectedSegment } from '../project'

// Marcador de composição — representação de PLANEJAMENTO: em vez de desenhar o trem inteiro à
// escala (quadradinho por vagão/locomotiva), UM SÓ pino aparece na posição em que a composição
// começa na linha (`composition.x`/`.y`, ver `project.ts`), com um cartão flutuante acima
// informando só o que o nível de seleção ativo do Plano de Manobra (`highlight`, painel esquerdo)
// pede — pedido explícito (2026-08-25, "fica mais simples do que tentar representar todos os
// vagõezinhos"), substitui a versão anterior que desenhava um bloco colorido por Bloco/Cluster à
// escala física real:
// - "nenhum" (nada selecionado): cabeçalho com ícone + nome do trem, resumo com locomotivas,
//   vagões e BLOCOS do trem inteiro.
// - "bloco" (Bloco expandido sem Grupo aberto dentro dele): cabeçalho "<trem> · <Bloco>", resumo
//   com locomotivas, vagões e GRUPOS só daquele Bloco.
// - "grupo" (Cluster expandido): sem cabeçalho — só os vagões que aquele Grupo retira/inclui.
// O pino NUNCA se move entre esses níveis — é sempre o mesmo ponto físico (onde a composição
// começa); só o conteúdo do cartão muda. Sem hover/click próprio (é só leitura, a seleção
// acontece no painel esquerdo — ver `PlanManobraX.tsx`).

/**
 * Destaque de uma etapa específica dentro do Grupo ativo — hoje PARADA e CORTE (Clear/Retirada/
 * Inclusão/Fechamento ainda não têm comportamento próprio no mapa). Os campos vêm direto de
 * `EtapaManobra.apoio`/`vagoesRetirados` (`planoManobra.ts`), copiados (não importados — mesma
 * regra de desacoplamento de `CompositionHighlight`, ver abaixo) para o tipo espelho
 * `EtapaHighlightPlano` em `PlanManobraX.tsx`. Consumido por `etapaParada.ts`/
 * `EtapaParadaLayer.tsx`/`EtapaCorteLayer.tsx` para calcular a geometria do ponto/trecho
 * destacado — ver esses arquivos para a convenção `direcao` (EDV = offset crescente da linha,
 * ECJ = decrescente) e a regra de que `referencia` é só o rótulo do marcador, não a fonte da
 * posição (não há, no modelo do mapa, nenhum vínculo entre os T1/T2/T3 do Plano e os AMVs reais
 * do pátio).
 */
export interface EtapaHighlightParada {
  tipo: 'PARADA'
  linha: string
  referencia?: string
  direcao?: string
  distanciaM: number
}

/**
 * Corte NÃO desloca a composição — acontece um pouco ANTES de onde a Parada do mesmo Grupo já
 * parou (nunca no mesmo ponto nem depois). `distanciaM` aqui é a POSIÇÃO estacionária do corte —
 * `apoio.posCabecaM` da PRÓPRIA etapa (`PlanManobraX.tsx`), sempre menor que o `distanciaM` da
 * Parada-irmã — não uma distância percorrida; nome do campo mantido igual ao de
 * `EtapaHighlightParada` de propósito, pra `computeParadaGeometry` calcular a posição das duas
 * etapas sem precisar de uma função própria. `referenciaM` é a posição FIXA do rótulo T1/T2/T3...
 * — sempre igual ao `distanciaM` da Parada-irmã (2026-08-25, "a referência T3 precisa estar fixa
 * no mesmo lugar, desde Parada, não pode mudar de lugar"), desenhada separada do marcador de ação
 * (que fica em `distanciaM`/`posCabecaM`, antes dela) — ver `EtapaCorteLayer.tsx`. `vagoes` são
 * os ids retirados nessa etapa (`EtapaManobra.vagoesRetirados`), mostrados como chips flutuantes
 * à esquerda do marcador.
 */
export interface EtapaHighlightCorte {
  tipo: 'CORTE'
  linha: string
  referencia?: string
  direcao?: string
  distanciaM: number
  referenciaM: number
  vagoes: string[]
}

/**
 * Clear TEM trajeto real, mesmo visual da Parada (`EtapaParadaLayer.tsx` reaproveitado pros dois
 * tipos) — mas não parte do zero da linha: continua de onde a composição já estava ao final da
 * Parada/Corte do mesmo Grupo. `origemM` é essa posição absoluta (mesmo eixo de
 * `EtapaHighlightParada.distanciaM`, resolvida por quem monta o destaque em `PlanManobraX.tsx` a
 * partir da Parada-irmã); `distanciaM` é o quanto se desloca a partir dali, na mesma `direcao`.
 */
export interface EtapaHighlightClear {
  tipo: 'CLEAR'
  linha: string
  referencia?: string
  direcao?: string
  origemM: number
  distanciaM: number
}

/**
 * Rota 1 da RETIRADA (deslocamento inicial da locomotiva de manobra) — DIFERENTE de
 * Parada/Corte/Clear: não é a composição principal (já parada desde Parada/Clear), é uma
 * LOCOMOTIVA DE MANOBRA SEPARADA vindo buscar a composição, então tem sua própria linha de
 * origem (`linhaOrigem`, ex. "Linha 3") e muda de linha no meio do trajeto (reversão + travessão)
 * até chegar na linha/ponto onde a composição já está. `destinoAbsolutoM` é esse ponto — a MESMA
 * posição final da etapa CLEAR do Grupo (resolvida por quem monta o destaque em
 * `PlanManobraX.tsx` somando `distanciaM` da Parada + do Clear), reaproveitada, não recalculada.
 * O ponto onde a locomotiva muda de linha (a reversão) é resolvido contra a conexão REAL entre as
 * duas linhas na cena projetada (`ProjectedScene.connections`) — diferente de Parada/Corte/Clear,
 * que nunca amarram posição a AMVs reais (ver `etapaParada.ts`), aqui o pedido explícito foi
 * "ultrapassar o ponto de conexão... real entre as duas linhas". Ver
 * `computeRetiradaRota1Geometry`/`EtapaRetiradaLayer.tsx`.
 */
export interface EtapaHighlightRetirada {
  tipo: 'RETIRADA'
  /** Sempre 0 nesta variante — `number`, não o literal `0`, pra continuar estruturalmente
   *  compatível com o lado Plano (`PlanManobraX.tsx`, `EtapaHighlightRetiradaPlano.rotaIndex:
   *  number`), que não tem como declarar literais por rota (motor de mapa e painel ficam
   *  deliberadamente desacoplados — ver comentário no topo de `PlanManobraX.tsx`). Quem despacha
   *  pra este componente x `EtapaRetiradaRota2Layer` (`YardCanvas.tsx`) checa o valor em
   *  tempo de execução, não por narrowing de union. */
  rotaIndex: number
  linhaOrigem: string
  direcaoOrigem: string
  distanciaOrigemM: number
  travessaoLabel?: string
  distanciaTravessaoM: number
  linhaDestino: string
  direcaoDestino: string
  distanciaDestinoM: number
  destinoAbsolutoM: number
}

/** Só os campos de `EtapaHighlightRetirada` que `computeRetiradaRota1Geometry` (`etapaParada.ts`)
 *  realmente lê pra resolver a origem/destino da Rota 1 — usado por
 *  `EtapaHighlightRetiradaRota2.origemRota1` pra reaproveitar o MESMO ponto onde a Rota 1 termina
 *  (2026-08-25, pedido explícito: "reaproveite essa posição, não calcule um novo ponto"), sem
 *  precisar do objeto `EtapaHighlightRetirada` inteiro (que carrega campos só de renderização da
 *  Rota 1, como `travessaoLabel`, que a Rota 2 não usa). `EtapaHighlightRetirada` satisfaz este
 *  shape estruturalmente (é um superconjunto) — nenhuma das duas interfaces referencia a outra. */
export interface RetiradaRota1Origem {
  linhaOrigem: string
  direcaoOrigem: string
  distanciaOrigemM: number
  linhaDestino: string
  direcaoDestino: string
  distanciaDestinoM: number
  destinoAbsolutoM: number
}

/**
 * Rota 2 da RETIRADA (retirada até o destino) — parte do MESMO ponto onde a Rota 1 termina
 * (`origemRota1`, reaproveitado via `computeRetiradaRota1Geometry` dentro de
 * `computeRetiradaRota2Geometry` — não recalculado do zero), anda um trecho em Linha Desvio até
 * reverter, cruza um travessão real até Linha 3 (trecho bem mais longo, a maior distância da
 * rota), cruza um SEGUNDO travessão real até Linha 4, e termina no destino final (pedido
 * explícito do usuário, 2026-08-25: "use como referência EXATA o padrão visual que acabamos de
 * acertar na Rota 1"). Só UMA reversão, logo no início — tudo depois dela (as duas travessias +
 * Linha 3 + Linha 4) anda na MESMA direção, `direcaoPosReversao` ("Direção 2" da Rota no Plano).
 * Ver `EtapaRetiradaRota2Layer.tsx`.
 */
export interface EtapaHighlightRetiradaRota2 {
  tipo: 'RETIRADA'
  /** Sempre 1 nesta variante — ver comentário equivalente em `EtapaHighlightRetirada`. */
  rotaIndex: number
  direcaoOrigem: string
  distanciaOrigemM: number
  travessao1Label?: string
  linhaMeio: string
  distanciaMeioM: number
  travessao2Label?: string
  linhaFinal: string
  distanciaFinalM: number
  direcaoPosReversao: string
  origemRota1: RetiradaRota1Origem
}

/** Só os campos de `EtapaHighlightRetiradaRota2` que `computeRetiradaRota2Geometry`
 *  (`etapaParada.ts`) realmente lê — mesma razão de `RetiradaRota1Origem` acima: usado por
 *  `EtapaHighlightInclusaoRota1.origemRetiradaRota2` pra reaproveitar o MESMO ponto onde a Rota 2
 *  de Retirada termina (2026-08-26, pedido explícito: "essa rota continua de onde a última rota
 *  (Retirada — Rota 2) terminou... reaproveite esse ponto como origem, não calcule um novo").
 *  `EtapaHighlightRetiradaRota2` satisfaz este shape estruturalmente (superconjunto). */
export interface RetiradaRota2Origem {
  direcaoOrigem: string
  distanciaOrigemM: number
  linhaMeio: string
  distanciaMeioM: number
  linhaFinal: string
  distanciaFinalM: number
  direcaoPosReversao: string
  origemRota1: RetiradaRota1Origem
}

/**
 * Rota 1 da INCLUSÃO (deslocamento inicial da locomotiva) — parte do MESMO ponto onde a Rota 2 de
 * Retirada termina (`origemRetiradaRota2`, reaproveitado via `computeRetiradaRota2Geometry`
 * dentro de `computeInclusaoRota1Geometry` — não recalculado do zero), cruza UM travessão real até
 * a linha de destino (o trecho mais longo da rota) e termina nos vagões de substituição. SEM
 * reversão — mais simples que as duas rotas de Retirada: só um trecho, uma travessia, outro
 * trecho, na MESMA direção o tempo todo (`direcaoOrigem`, não há "Direção 2"). Mostra os vagões a
 * incluir em verde no destino (`FileiraVagoesIncluidos`, `EtapaInclusaoRota1Layer.tsx`), mesmo
 * padrão dos vagões cortados em vermelho da etapa CORTE (`EtapaCorteLayer.tsx`), só a cor/sinal
 * trocados. Ver `EtapaInclusaoRota1Layer.tsx`.
 */
export interface EtapaHighlightInclusaoRota1 {
  tipo: 'INCLUSAO'
  rotaIndex: number
  direcaoOrigem: string
  distanciaOrigemM: number
  travessaoLabel?: string
  linhaDestino: string
  distanciaDestinoM: number
  vagoesIncluidos: string[]
  origemRetiradaRota2: RetiradaRota2Origem
}

/** Só os campos de `EtapaHighlightInclusaoRota1` que `computeInclusaoRota1Geometry`
 *  (`etapaParada.ts`) realmente lê — mesma razão de `RetiradaRota1Origem`/`RetiradaRota2Origem`
 *  acima: usado por `EtapaHighlightInclusaoRota2.origemInclusaoRota1` pra reaproveitar o MESMO
 *  ponto onde a Rota 1 de Inclusão termina (2026-08-26, pedido explícito: "essa rota continua de
 *  onde a Rota 1 da Inclusão terminou... reaproveite esse ponto, não calcule um novo").
 *  `EtapaHighlightInclusaoRota1` satisfaz este shape estruturalmente (superconjunto). */
export interface InclusaoRota1Origem {
  direcaoOrigem: string
  distanciaOrigemM: number
  linhaDestino: string
  distanciaDestinoM: number
  origemRetiradaRota2: RetiradaRota2Origem
}

/**
 * Rota 2 da INCLUSÃO (inclusão até o destino) — parte do MESMO ponto onde a Rota 1 de Inclusão
 * termina (`origemInclusaoRota1`, reaproveitado via `computeInclusaoRota1Geometry` dentro de
 * `computeInclusaoRota2Geometry` — não recalculado do zero), anda um trecho até reverter, cruza UM
 * travessão real (T3) e TERMINA de volta no MESMO ponto fixo onde a Rota 1 de RETIRADA encontrou a
 * composição parada em Linha Desvio, ref. T3 (fechamento do ciclo — pedido explícito do usuário,
 * 2026-08-26: "reaproveite exatamente essa posição/pin já existente, não crie um marcador novo"),
 * não num ponto calculado a partir de `distanciaFinalM`. Só UMA reversão, logo no início — o
 * trecho final (T3 → Linha Desvio) anda na MESMA direção, `direcaoPosReversao` ("Direção 2" da
 * Rota no Plano). Ver `EtapaInclusaoRota2Layer.tsx`.
 */
export interface EtapaHighlightInclusaoRota2 {
  tipo: 'INCLUSAO'
  /** Sempre 1 nesta variante — ver comentário equivalente em `EtapaHighlightRetirada`. */
  rotaIndex: number
  direcaoOrigem: string
  distanciaOrigemM: number
  travessaoLabel?: string
  linhaFinal: string
  distanciaFinalM: number
  direcaoPosReversao: string
  origemInclusaoRota1: InclusaoRota1Origem
}

/** Só os campos de `EtapaHighlightInclusaoRota2` que `computeInclusaoRota2Geometry`
 *  (`etapaParada.ts`) realmente lê. `EtapaHighlightInclusaoRota2` satisfaz este shape
 *  estruturalmente (superconjunto). */
export interface InclusaoRota2Origem {
  direcaoOrigem: string
  distanciaOrigemM: number
  linhaFinal: string
  direcaoPosReversao: string
  origemInclusaoRota1: InclusaoRota1Origem
}

/**
 * FECHAMENTO (recuo final da composição) — parte do MESMO ponto onde a Rota 2 de Inclusão termina
 * (`origemInclusaoRota2`, reaproveitado via `computeInclusaoRota2Geometry` dentro de
 * `computeFechamentoGeometry` — não recalculado do zero), e RECUA `distanciaM` na direção `direcao`
 * (sentido oposto ao de chegada da última rota — pedido explícito do usuário, 2026-08-26: "isso é
 * um RECUO... sentido oposto ao de chegada da última rota"). Sem travessão, sem reversão — só um
 * trecho reto, com tratamento visual distinto (tracejado) pra deixar claro que é um movimento de
 * ré, não mais um trecho de ida. Última etapa do ciclo do Grupo — o pino final ganha um selo de
 * conclusão (ver `EtapaFechamentoLayer.tsx`).
 */
export interface EtapaHighlightFechamento {
  tipo: 'FECHAMENTO'
  direcao: string
  distanciaM: number
  origemInclusaoRota2: InclusaoRota2Origem
}

/** `etapaId` — id da `EtapaManobra` real que originou este destaque (`PlanManobraX.tsx`,
 *  `construirDestaqueEtapa`/`construirDestaqueRota`, sempre preenchido lá com `etapa.id`) — o
 *  motor de mapa em si NUNCA lê este campo (só geometria, ver comentário de cada interface
 *  acima), mas ele SOBREVIVE no objeto em tempo de execução (tipagem estrutural: o lado Plano
 *  passa um objeto com MAIS campos que o mapa declara, TypeScript permite) — usado por
 *  `PainelInfoMapa` (`PlanejamentoScreen.tsx`, 2026-08-27, "essas outras informações... também
 *  deve ficar no canto inferior esquerdo do mapa") pra buscar de volta a `EtapaManobra` completa
 *  (`apoio`/`rotas`) em `plano` e montar os badges de Linha/Referência/Direção/Macro/Distância/
 *  Responsável ali — SEM duplicar esses campos em cada uma das 8 interfaces abaixo. */
export type EtapaHighlight = (
  | EtapaHighlightParada
  | EtapaHighlightCorte
  | EtapaHighlightClear
  | EtapaHighlightRetirada
  | EtapaHighlightRetiradaRota2
  | EtapaHighlightInclusaoRota1
  | EtapaHighlightInclusaoRota2
  | EtapaHighlightFechamento
) & { etapaId?: string }

/** Seleção ativa no Plano de Manobra (painel esquerdo) — `clusterId` presente restringe o
 *  destaque ao Grupo específico; ausente, destaca o Bloco inteiro. `null`/`undefined` = nenhuma
 *  seleção, cartão do pino mostra o resumo do trem inteiro (ver `resolverConteudoCartao`).
 *  `etapa`, quando presente, é sempre um refinamento DENTRO do Grupo já destacado (nunca aparece
 *  sem `clusterId` — ver `GrupoAccordionItem`, `PlanManobraX.tsx`). */
export interface CompositionHighlight {
  blocoId: string
  clusterId?: string
  etapa?: EtapaHighlight
}

/**
 * Conteúdo do tooltip de hover sobre uma composição INTEIRA (trem — não mais por segmento
 * isolado, ver `HoverSegmentoHandler`) — 2026-08-27, pedido explícito do usuário: "deixe evidente
 * qual a locomotiva, e quais os vagões. e caso tenha um vagão a retirar ele deve ficar vermelho".
 * `vagoes[].retirado` = `true` quando o vagão pertence a um segmento com `clusterId` (mesma
 * convenção de `corSegmentoDestaque` — só acontece no trem em foco do Plano de Manobra; trens de
 * fundo nunca têm `clusterId`, `retirado` sempre `false` neles). `trem` = `composition.label`,
 * quando presente (trens de fundo com identidade real, ver `mocks/eht.ts`).
 */
export interface HoverTooltipInfo {
  trem?: string
  locomotivas: string[]
  vagoes: { id: string; retirado: boolean }[]
}

/**
 * Callback do tooltip de hover sobre uma composição (trem/vagões) — `info` presente + `x`/`y`
 * (coordenada de TELA, `MouseEvent.clientX`/`clientY`) = mostrar/mover o tooltip; `info` `null` =
 * esconder. Substitui o `<title>` nativo do SVG (2026-08-27, pedido explícito do usuário: "o
 * tooltip no hover nos trens deve seguir o padrão da plataforma também") — quem efetivamente
 * desenha o cartão do tooltip é `ZoomableMapa` (`PlanejamentoScreen.tsx`), MESMOS tokens de
 * `CartaoPino` abaixo (inclusive o clamp de posição pra nunca vazar do frame do mapa — "não pode
 * acontecer isso de quebrar e eu não conseguir ler os outros"); este componente só relata o
 * hover, não sabe desenhar HTML.
 */
export type HoverSegmentoHandler = (info: HoverTooltipInfo | null, x?: number, y?: number) => void

/** Monta o `HoverTooltipInfo` de uma composição inteira a partir dos seus segmentos — usado no
 *  `<g>` que envolve TODOS os segmentos (não mais um handler por segmento individual), tanto no
 *  trem em foco (`Composition`) quanto no de fundo (`BackgroundComposition`), pra hover em
 *  QUALQUER ponto do trem mostrar o MESMO resumo completo (locomotiva(s) + vagões), não só o
 *  pedaço embaixo do cursor. */
function buildHoverTooltipInfo(composition: ProjectedComposition): HoverTooltipInfo {
  const locomotivas: string[] = []
  const vagoes: { id: string; retirado: boolean }[] = []
  for (const segmento of composition.segments) {
    const retirado = !!segmento.clusterId
    if (segmento.units?.length) {
      for (const unidade of segmento.units) {
        if (segmento.kind === 'locomotiva') locomotivas.push(unidade.id ?? '—')
        else vagoes.push({ id: unidade.id ?? '—', retirado })
      }
    } else if (segmento.kind === 'locomotiva') {
      locomotivas.push(`${segmento.count} locomotiva${segmento.count === 1 ? '' : 's'}`)
    } else {
      vagoes.push({ id: segmento.count === 1 ? '1 vagão' : `${segmento.count} vagões`, retirado })
    }
  }
  return { trem: composition.label, locomotivas, vagoes }
}

interface CompositionProps {
  composition: ProjectedComposition
  labelGutterWidth: number
  highlight?: CompositionHighlight | null
  onHoverSegmento?: HoverSegmentoHandler
  /** Repassado direto a `BlocoSegmentoDestaque` — ver doc lá (seleção pontual de veículo(s),
   *  clique num chip de `TagVagao`). Sem efeito na composição de FUNDO (`BackgroundComposition`,
   *  abaixo) — ids de veículo de outro trem/composição nunca colidem com os da seleção. */
  veiculosFoco?: Set<string> | null
}

/**
 * Esmaecimento por destaque de Grupo/Etapa — não é um filtro de opacidade no `<g>` inteiro (isso
 * apagaria o rótulo/destaque junto): é um véu na cor do PRÓPRIO fundo do canvas
 * (`--vli-map-canvas-bg`, o mesmo por trás de toda a cena) por cima do que não está selecionado,
 * simulando aquilo "recuar" para o fundo sem escondê-lo por completo. Exportadas para
 * `EtapaParadaLayer.tsx` reaproveitar o MESMO véu nas linhas não destacadas.
 */
export const DIM_OVERLAY_FILL = 'var(--vli-map-canvas-bg)'
export const DIM_OVERLAY_OPACITY = 0.62

// --- Blocos à escala real do trem em destaque (locomotivas/vagões) -------------------------
//
// 2026-08-26, pedido explícito do usuário: "quando clica no trem, bloco ou grupo, deve mostrar,
// ao invés do pin, deve mostrar os vagõezinhos do trem e locomotivas" — revoga o pino único
// (`PinoComposicao`, removido) pros 3 níveis de destaque SEM Etapa (nada/Bloco/Grupo
// selecionados): a composição passa a desenhar um bloco por segmento, à escala real (mesma
// projeção de `project.ts`/`scale.ts` que já dirige tudo o mais), igual em espírito à camada de
// fundo (`BackgroundComposition`, abaixo) — mas aqui COLORIDA por identidade (locomotiva ×
// vagão × vagão retirado) e sensível ao nível de destaque ativo (fora do Bloco/Grupo focado
// esmaece, dentro fica em opacidade plena), já que esta É a composição em foco no Plano de
// Manobra, não contexto de fundo. Etapa continua com seu próprio trajeto (ver `if
// (highlight?.etapa)` mais abaixo) — comportamento intocado.
// Cores por identidade (2026-08-26, pedido explícito do usuário: "as locomotivas sao laranjas.
// os vagões sao dessa cor aqui verdinho" — com print de referência) — MESMOS tokens já
// desenhados pra exatamente esse propósito (`SEGMENT_BLOCK_STYLES`/`styles.ts`, "Estilo dos
// blocos coloridos da composição segmentada sobre a linha"), até então não consumidos por este
// componente (o pino+cartão os deixou órfãos desde o refactor de 2026-08-25) — reaproveitados
// aqui em vez de inventar uma paleta nova.
const FG_LOCOMOTIVA_FILL = 'var(--vli-map-trem-locomotiva-bg)'
const FG_LOCOMOTIVA_BORDA = 'var(--vli-map-trem-locomotiva-border)'
const FG_LOCOMOTIVA_TEXTO = 'var(--vli-map-trem-locomotiva-text)'
const FG_VAGAO_FILL = 'var(--vli-map-segment-vagao)'
const FG_VAGAO_BORDA = 'var(--vli-map-segment-vagao-border)'
const FG_VAGAO_TEXTO = 'var(--vli-map-segment-vagao-text)'
// Histórico (2026-08-27): começou em `--vli-danger-bg` (véu de aviso, 8% de opacidade — saía
// quase transparente); tentou-se depois o mesmo tom apagado do chip `TagVagao`
// (`--vli-wagon-retirado-bg`), mas no quadradinho pequeno do mapa ficou estranho (pedido
// explícito: "ficou estranho... deixe o mesmo tom que estava antes mesmo") — voltou pro tom
// anterior, que funcionou bem aqui: `--vli-danger-strong`/`--vli-danger-strong-hover`, sólido e
// mais escuro que o vermelho vívido original (`--vli-danger`), com texto branco (mesmo padrão de
// fundo sólido de perigo usado em qualquer outro lugar do app, ex.: `ExcluirDefinitivamenteModal.tsx`).
// Esse tom apagado continua correto pro chip `TagVagao`/`ChipVeiculo` (não mexer lá) — só o
// quadradinho do mapa, menor e sem texto na maioria das vezes, pede mais contraste. Ajuste fino
// em seguida (pedido explícito: "deixe um pouco mais escuro só") — um degrau mais escuro cada:
// fill pro tom que antes era só a borda (`--vli-danger-strong-hover`), borda pro tom mais escuro
// que existe (`--vli-danger-deep`, novo — não havia um 4º tom de vermelho no design system).
const FG_RETIRADO_FILL = 'var(--vli-danger-strong-hover)'
const FG_RETIRADO_BORDA = 'var(--vli-danger-deep)'
const FG_RETIRADO_TEXTO = '#fff'
/** Opacidade de quem está FORA do escopo em foco (Bloco/Grupo destacado) — mesmo valor de
 *  `DIM_OVERLAY_OPACITY` só que aplicado direto no bloco (não um véu por cima). */
const FG_OPACITY_FORA_FOCO = 0.38
/** Altura do bloco — 2026-08-26, pedido explícito do usuário: "o trem acaba ocupando muito
 *  espaço... ele precisa ser bem mais reduzido" (com print mostrando o trem em foco visivelmente
 *  mais alto que a própria faixa do trilho por baixo, `DEFAULT_TRACK_HEIGHT = 9`, `Line.tsx` — o
 *  valor antigo, 10, ultrapassava essa faixa na maioria dos tipos de linha, "vazando" pra fora
 *  dela). Reduzido pra caber dentro da faixa padrão — mesma altura da camada de fundo
 *  (`BG_BLOCK_ALTURA`); opacidade plena (`emFoco` = 1) já é o que diferencia o trem em foco dos
 *  outros do pátio, não precisa também ser mais alto. */
const FG_BLOCK_ALTURA = 7
const FG_LARGURA_MIN_ROTULO = 16
// Cada quadradinho de veículo ocupa a LARGURA REAL do próprio espaço (`unidade.width`), sem
// encolher nem abrir vão — pedido explícito do usuário, 2026-08-26: "sobre os espaçamentos dos
// vagões, eu sempre deixaria eles colados, nunca espaçados" (reverte a interpolação de largura
// por zoom testada mais cedo na mesma sessão — `fracaoLarguraUnidade`/`FG_UNIDADE_GAP`, removidas
// — que tentava resolver "vagões não ficam separados" abrindo vão entre eles; a correção real era
// o oposto: vagões colados, só o traço da borda (`stroke`) entre um `<rect>` e o vizinho já marca
// a fronteira de cada veículo, igual ao acoplamento físico real do trem).

/** `true` quando o segmento está DENTRO do escopo atualmente em foco — nada selecionado (trem
 *  inteiro) = tudo em foco; Bloco selecionado = só os segmentos daquele Bloco; Grupo selecionado
 *  = só o segmento daquele Cluster especificamente (os demais, mesmo do mesmo Bloco, saem de
 *  foco — o Grupo é o nível mais específico). */
function segmentoEmFoco(segmento: ProjectedSegment, highlight: CompositionHighlight | null | undefined): boolean {
  if (!highlight?.blocoId) return true
  if (highlight.clusterId) return segmento.clusterId === highlight.clusterId
  return !segmento.blocoId || segmento.blocoId === highlight.blocoId
}

/** Cor por identidade do segmento — locomotiva sempre na cor de destaque sólida; vagão com
 *  `clusterId` é sempre um vagão RETIRADO (convenção de `planoTopologiaAdapter.ts`: um segmento
 *  de vagão só carrega `clusterId` quando é o subtrecho que aquele Cluster vai retirar), em
 *  vermelho INDEPENDENTE do nível de destaque atual (é uma condição do vagão, não do que está
 *  focado agora); vagão normal fica no azul secundário. */
function corSegmentoDestaque(segmento: ProjectedSegment): { fill: string; borda: string; texto: string } {
  if (segmento.kind === 'locomotiva') return { fill: FG_LOCOMOTIVA_FILL, borda: FG_LOCOMOTIVA_BORDA, texto: FG_LOCOMOTIVA_TEXTO }
  if (segmento.clusterId) return { fill: FG_RETIRADO_FILL, borda: FG_RETIRADO_BORDA, texto: FG_RETIRADO_TEXTO }
  return { fill: FG_VAGAO_FILL, borda: FG_VAGAO_BORDA, texto: FG_VAGAO_TEXTO }
}

function BlocoSegmentoDestaque({
  segmento,
  y,
  emFoco,
  labelGutterWidth,
  veiculosFoco,
}: {
  segmento: ProjectedSegment
  y: number
  emFoco: boolean
  /** `segmento.x`/`segmento.units[].x` vêm em coordenada RELATIVA à área de trilhos (convenção
   *  de `ProjectedScene` — ver `YardCanvas.tsx`) — precisa somar aqui, unidade por unidade, não
   *  só uma vez no segmento (diferente de `BackgroundComposition`, que nunca desenha por
   *  unidade). */
  labelGutterWidth: number
  /** Seleção pontual de veículo(s) (clique num chip de `TagVagao`, "Composição Geral do Trem",
   *  `PlanManobraX.tsx`) — 2026-08-27, pedido explícito do usuário: "ao clicar em um vagão, os
   *  outros devem estar mais apagados, e o que cliquei fica em evidência". Quando não-vazio,
   *  SUBSTITUI o esmaecimento por Bloco/Grupo (`emFoco`) por um esmaecimento POR UNIDADE — cada
   *  veículo decide sua própria opacidade pelo próprio id, independente do escopo Bloco/Grupo
   *  atualmente aberto no painel (a seleção de veículo é um nível ortogonal, não um refinamento
   *  dele). Sem efeito em segmentos sem `units` (contagem agregada, sem id individual por
   *  veículo) — esses continuam só na régua de `emFoco`. */
  veiculosFoco?: Set<string> | null
}) {
  if (segmento.width <= 0) return null
  const { fill, borda, texto } = corSegmentoDestaque(segmento)
  const centroX = labelGutterWidth + segmento.x + segmento.width / 2
  const mostrarRotulo = segmento.count > 1 && segmento.width >= FG_LARGURA_MIN_ROTULO
  const unidades = segmento.units?.length ? segmento.units : null
  const veiculoFocoAtivo = !!veiculosFoco && veiculosFoco.size > 0
  return (
    <g opacity={veiculoFocoAtivo ? 1 : emFoco ? 1 : FG_OPACITY_FORA_FOCO}>
      {unidades ? (
        unidades.map((unidade, i) => (
          <rect
            key={unidade.id ?? i}
            x={labelGutterWidth + unidade.x}
            y={y - FG_BLOCK_ALTURA / 2}
            width={unidade.width}
            height={FG_BLOCK_ALTURA}
            fill={fill}
            stroke={borda}
            strokeWidth={0.6}
            opacity={veiculoFocoAtivo ? (unidade.id && veiculosFoco!.has(unidade.id) ? 1 : FG_OPACITY_FORA_FOCO) : undefined}
          />
        ))
      ) : (
        <rect
          x={labelGutterWidth + segmento.x}
          y={y - FG_BLOCK_ALTURA / 2}
          width={segmento.width}
          height={FG_BLOCK_ALTURA}
          fill={fill}
          stroke={borda}
          strokeWidth={1}
          rx={1.5}
        />
      )}
      {mostrarRotulo && (
        <text
          x={centroX}
          y={y + 0.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={6.5}
          fontWeight={700}
          fill={texto}
          fontFamily="Manrope, sans-serif"
        >
          {segmento.count}
        </text>
      )}
    </g>
  )
}

export interface LinhaCartao {
  texto: string
  cor: string
}

/** Conteúdo do resumo trem/Bloco/Grupo — `cabecalho` (ex.: "J614" ou "J614 · Bloco A") só
 *  aparece nos níveis "nenhum"/"bloco"; no nível "grupo" fica ausente (ver
 *  `resolverConteudoCartao`) e mostra só `linhas` (retirar/incluir). Renderizado FORA do mapa
 *  (`PainelInfoMapa`, `PlanejamentoScreen.tsx`, ver comentário abaixo). */
export interface ConteudoCartao {
  cabecalho?: string
  linhas: LinhaCartao[]
}

/** MESMOS tokens do resto da interface usados nas `linhas` do resumo (`resolverConteudoCartao`
 *  abaixo) — texto secundário/discreto; retirar/incluir usam as cores semânticas
 *  (vermelho/verde) diretamente, não este token. */
const CARTAO_TEXTO_SECUNDARIO = 'var(--vli-text-md)'

/**
 * Resolve o resumo trem/Bloco/Grupo a partir do `highlight` atual — 2026-08-27, pedido explícito
 * do usuário: "esse tooltip fixo quero que remova, pra não conflitar com o novo tooltip. deixe
 * ele na parte inferior do mapa, no canto inferior esquerdo" (o antigo balão SVG sempre visível,
 * `CartaoPino`, foi removido — este resumo agora é renderizado como painel HTML fixo por
 * `PainelInfoMapa`, `PlanejamentoScreen.tsx`, não mais ancorado à posição da composição no mapa).
 * Deriva tudo dos `segments` já sintetizados pelo adaptador (`planoTopologiaAdapter.ts`) — cada
 * Cluster contribui no máximo UM segmento com `clusterId` (o subtrecho retirado, pareado por
 * índice com `incoming` pros incluídos, ver `types.ts`), então não precisa voltar ao
 * `PlanoManobra` bruto pra montar isso.
 */
export function resolverConteudoCartao(composition: ProjectedComposition, highlight: CompositionHighlight | null | undefined): ConteudoCartao {
  if (highlight?.clusterId) {
    const segmentoGrupo = composition.segments.find((s) => s.clusterId === highlight.clusterId)
    const retirados = segmentoGrupo?.units ?? []
    const incluidos = segmentoGrupo?.incoming ?? []
    const linhas: LinhaCartao[] = []
    if (retirados.length > 0) linhas.push({ texto: `− ${retirados.map((u) => u.id).join(', ')}`, cor: 'var(--vli-danger-text)' })
    if (incluidos.length > 0) linhas.push({ texto: `+ ${incluidos.map((u) => u.id).join(', ')}`, cor: 'var(--vli-success-text)' })
    return { linhas }
  }

  const segmentosNoEscopo = highlight?.blocoId
    ? composition.segments.filter((s) => s.blocoId === highlight.blocoId)
    : composition.segments
  let locomotivas = 0
  let vagoes = 0
  const clusterIds = new Set<string>()
  const blocoIds = new Set<string>()
  for (const segment of segmentosNoEscopo) {
    if (segment.kind === 'locomotiva') locomotivas += segment.count
    else vagoes += segment.count
    if (segment.clusterId) clusterIds.add(segment.clusterId)
    if (segment.blocoId) blocoIds.add(segment.blocoId)
  }

  if (highlight?.blocoId) {
    const grupos = clusterIds.size
    const blocoNome = segmentosNoEscopo.find((s) => s.blocoNome)?.blocoNome ?? highlight.blocoId
    return {
      cabecalho: composition.label ? `${composition.label} · ${blocoNome}` : blocoNome,
      linhas: [{ texto: `${locomotivas} loco + ${vagoes} vagões · ${grupos} grupo${grupos === 1 ? '' : 's'}`, cor: CARTAO_TEXTO_SECUNDARIO }],
    }
  }

  const blocos = blocoIds.size
  return {
    cabecalho: composition.label,
    linhas: [{ texto: `${locomotivas} loco + ${vagoes} vagões · ${blocos} bloco${blocos === 1 ? '' : 's'}`, cor: CARTAO_TEXTO_SECUNDARIO }],
  }
}

// --- Camada de FUNDO do pátio (outros trens/vagões, sem vínculo com o Plano em visualização) ---
//
// Diferente do pino+cartão acima (uma abstração de PLANEJAMENTO, só o trem selecionado): aqui a
// composição é desenhada à ESCALA REAL — um quadradinho por VEÍCULO (não um bloco por segmento),
// na mesma régua de metro→pixel que já projeta tudo o mais (`project.ts`/`scale.ts`) — pedido
// explícito do usuário, 2026-08-26: "reaproveite essa mesma lógica de renderização... a lógica de
// escala real já estabelecida". MESMO padrão visual/cores do trem em destaque (`corSegmentoDestaque`
// — locomotiva laranja, vagão na cor "verdinho"/teal do design system, reaproveitados aqui, não
// reinventados — pedido explícito, 2026-08-26: "os outros trens precisam ser do mesmo padrão"),
// só mais apagado (opacidade bem mais baixa que o trem em foco — "podem ser mais apagadinhos"):
// nunca compete visualmente com o trem/trajeto realmente selecionado, mas também não finge ser
// "cinza genérico" — é reconhecível como o MESMO tipo de composição, só em segundo plano. Sem
// pino/cartão — cada quadradinho já é auto-explicativo; sem click customizado próprio. Tooltip de
// hover (`onHoverSegmento`, ver `HoverSegmentoHandler` acima) lista os ids ao passar o mouse —
// 2026-08-27, substituiu o `<title>` nativo do SVG usado até então ("o tooltip no hover nos
// trens deve seguir o padrão da plataforma também"): o cartão em si é desenhado por
// `ZoomableMapa` (`PlanejamentoScreen.tsx`), não aqui — este componente só relata o hover.

/** Opacidade do grupo inteiro (quadradinhos + rótulo) — bem mais apagada que o trem em foco
 *  (`FG_OPACITY_FORA_FOCO`, 0.38): "podem ser mais apagadinhos" — nunca compete visualmente com
 *  o trem realmente selecionado, mesmo usando a MESMA paleta de cores. */
const BG_OPACITY = 0.32
/** Altura do bloco — mais baixa que o trem em foco (`FG_BLOCK_ALTURA`, 10): discreto de
 *  propósito, sem tentar bater pixel-a-pixel com a faixa de trilho (`resolveTrackHeight`,
 *  `Line.tsx` — este componente não recebe o tipo da linha). */
const BG_BLOCK_ALTURA = 7
/** Abaixo desta largura projetada (px de viewBox), o rótulo de contagem não cabe legível — some
 *  (os quadradinhos e o tooltip continuam comunicando "tem vagão aqui"). */
const BG_LARGURA_MIN_ROTULO = 14

function BlocoSegmentoFundo({
  segmento,
  y,
  labelGutterWidth,
}: {
  segmento: ProjectedSegment
  y: number
  /** Mesma razão de `BlocoSegmentoDestaque` — `segmento.units[].x` precisa do offset por
   *  unidade, não só uma vez no segmento (ver comentário lá). */
  labelGutterWidth: number
}) {
  if (segmento.width <= 0) return null
  const { fill, borda, texto } = corSegmentoDestaque(segmento)
  const centroX = labelGutterWidth + segmento.x + segmento.width / 2
  const mostrarRotulo = segmento.count > 1 && segmento.width >= BG_LARGURA_MIN_ROTULO
  const unidades = segmento.units?.length ? segmento.units : null
  return (
    <g opacity={BG_OPACITY}>
      {unidades ? (
        unidades.map((unidade, i) => (
          <rect
            key={unidade.id ?? i}
            x={labelGutterWidth + unidade.x}
            y={y - BG_BLOCK_ALTURA / 2}
            width={unidade.width}
            height={BG_BLOCK_ALTURA}
            fill={fill}
            stroke={borda}
            strokeWidth={0.5}
          />
        ))
      ) : (
        <rect
          x={labelGutterWidth + segmento.x}
          y={y - BG_BLOCK_ALTURA / 2}
          width={segmento.width}
          height={BG_BLOCK_ALTURA}
          fill={fill}
          stroke={borda}
          strokeWidth={1}
          rx={1}
        />
      )}
      {mostrarRotulo && (
        <text
          x={centroX}
          y={y + 0.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={6}
          fontWeight={700}
          fill={texto}
          fontFamily="Manrope, sans-serif"
        >
          {segmento.count}
        </text>
      )}
    </g>
  )
}

/** Composição de fundo inteira — um `BlocoSegmentoFundo` por segmento, todos na MESMA linha/Y da
 *  composição (já projetados por `projectSegments`, ver `project.ts`) — sem pino, sem cartão,
 *  `pointerEvents` propositalmente SEM 'none' aqui (diferente do pino do trem selecionado): é o
 *  que faz o tooltip de hover funcionar ao passar o mouse. Handler no `<g>` que envolve a
 *  composição INTEIRA (não mais por segmento) — hover em QUALQUER ponto do trem mostra o MESMO
 *  resumo completo (`buildHoverTooltipInfo`, locomotiva(s) + vagões), 2026-08-27, pedido
 *  explícito do usuário: "deixe evidente qual a locomotiva, e quais os vagões". */
function BackgroundComposition({
  composition,
  labelGutterWidth,
  onHoverSegmento,
}: {
  composition: ProjectedComposition
  labelGutterWidth: number
  onHoverSegmento?: HoverSegmentoHandler
}) {
  const info = buildHoverTooltipInfo(composition)
  return (
    <g
      data-composition-id={composition.id}
      data-composition-background="true"
      onMouseEnter={(e) => onHoverSegmento?.(info, e.clientX, e.clientY)}
      onMouseMove={(e) => onHoverSegmento?.(info, e.clientX, e.clientY)}
      onMouseLeave={() => onHoverSegmento?.(null)}
    >
      {composition.segments.map((segmento, i) => (
        <BlocoSegmentoFundo key={segmento.units?.[0]?.id ?? i} segmento={segmento} labelGutterWidth={labelGutterWidth} y={composition.y} />
      ))}
    </g>
  )
}

export function Composition({ composition, labelGutterWidth, highlight, onHoverSegmento, veiculosFoco }: CompositionProps) {
  // Composição de FUNDO (outro trem/vagões do pátio, sem vínculo com o Plano) — desenhada à
  // escala real, SEMPRE visível (inclusive com uma Etapa em destaque: ela é contexto do pátio,
  // não compete com o trajeto da etapa) — ver bloco de comentário acima.
  if (composition.background) {
    return <BackgroundComposition composition={composition} labelGutterWidth={labelGutterWidth} onHoverSegmento={onHoverSegmento} />
  }

  // Com uma Etapa em destaque (hoje só PARADA — ver `EtapaParadaLayer.tsx`), o pino da composição
  // e seu cartão somem inteiramente: a etapa já desenha sua própria camada (trajeto/seta/badge/
  // pino de referência) no MESMO ponto/linha, então mostrar os dois ao mesmo tempo só competia
  // visualmente sem acrescentar informação — pedido explícito (2026-08-25): "só o trajeto"
  // enquanto uma Etapa estiver selecionada.
  if (highlight?.etapa) return null

  const y = composition.y
  const info = buildHoverTooltipInfo(composition)

  return (
    <g
      data-composition-id={composition.id}
      onMouseEnter={(e) => onHoverSegmento?.(info, e.clientX, e.clientY)}
      onMouseMove={(e) => onHoverSegmento?.(info, e.clientX, e.clientY)}
      onMouseLeave={() => onHoverSegmento?.(null)}
    >
      {composition.segments.map((segmento, i) => (
        <BlocoSegmentoDestaque
          key={segmento.units?.[0]?.id ?? i}
          segmento={segmento}
          labelGutterWidth={labelGutterWidth}
          y={y}
          emFoco={segmentoEmFoco(segmento, highlight ?? null)}
          veiculosFoco={veiculosFoco}
        />
      ))}
    </g>
  )
}
