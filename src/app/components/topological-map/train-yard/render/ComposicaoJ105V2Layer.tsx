import type { ProjectedScene } from '../project'
import { resolveLineIdByNome } from '../etapaParada'
import {
  ALTURA_VEICULO,
  MarcaCorte,
  OPACIDADE_ESMAECIDO,
  acharPosicaoJuncaoT2,
  AmvJ105Marker,
  MarcoJ105Marker,
  estiloDe,
} from './ComposicaoJ105Layer'
import { estadoAnimadoJ105, type CorpoAnimadoJ105 } from '../../../../data/animacaoJ105'
import { focoDosVeiculos, papelVisivelJ105V2, trechosDosCorpos, type FocoJ105V2 } from './focoJ105V2'
import type { TrechoJ105V2 } from '../../../../data/composicaoGeralJ105V2'
import { passoCitaAmvJ105, passoCitaMarcoJ105, amvAtivoDoPassoJ105, type PapelVeiculoJ105 } from '../../../../data/visualJ105'

// Composição do J105 V2 desenhada num INSTANTE da linha do tempo, em vez de num passo discreto.
//
// Exclusivo do J105 V2. O J105 V1 continua em `ComposicaoJ105Layer` (passo a passo, estático) e os
// demais trens no pino único de `Composition.tsx` — nada aqui toca nenhum dos dois. O que este
// arquivo REAPROVEITA do V1 (em vez de reimplementar) é todo o vocabulário visual: a paleta por
// papel de veículo (`estiloDe`), a altura do bloco (`ALTURA_VEICULO`), a marca de corte
// (`MarcaCorte` — vão + traço + tesoura), o badge do AMV, a bolinha do marco e a âncora do
// Travessão 2. Assim as duas versões do trem lêem como o MESMO trem, só que uma parada no tempo e
// a outra em movimento.
//
// O que é próprio daqui é a GEOMETRIA INTERPOLADA: `CorpoAnimadoJ105` traz origem e destino
// separados (linha + metros), e é aqui que as duas pontas são projetadas na cena e interpoladas.
// Quando as linhas diferem (recuo/avanço pelo Travessão 2), x e y interpolam juntos e o corpo
// desliza na diagonal entre as duas faixas — mesma técnica do `sample()` da engine de referência.

/** Realce do corpo que está andando agora — `opacity` cheia contra os parados, que ficam um
 *  pouco recuados. Não troca a COR do veículo (a paleta por papel é o que diz o que cada bloco é);
 *  só a presença na tela, pra o olho achar sozinho quem se mexe. */
const OPACIDADE_PARADO = 0.85

/** Com veículo(s) em foco (clique na Composição Geral, `veiculosFoco`): tudo que não é o trecho
 *  focado recua pra esta opacidade — mesmo valor de `FG_OPACITY_FORA_FOCO` (`Composition.tsx`),
 *  o esmaecimento por unidade que os demais trens já usam. */
const OPACIDADE_FORA_FOCO = 0.18
/** Contorno do(s) veículo(s) em foco — cor de destaque do app, a mesma do anel do chip
 *  selecionado (`TagVagao`). */
const COR_FOCO = 'var(--vli-primary)'

interface GeometriaCorpo {
  xCabeca: number
  xCauda: number
  y: number
  altura: number
  escala: number
}

/** Acha, na cena projetada, a linha de nome `linha` (mesma resolução usada em toda parte do mapa,
 *  `resolveLineIdByNome`) — extraída de `projetarPonta` pra também ser reaproveitada por
 *  `limitesVisiveisCorpo` (abaixo), sem resolver a mesma linha duas vezes por corpo. */
function resolverLinha(scene: ProjectedScene, linha: string) {
  const lineId = resolveLineIdByNome(linha, scene.lines)
  return lineId ? scene.lines.find((l) => l.id === lineId) : undefined
}

/** Cabeça do corpo (em unidades de viewBox) para uma posição em metros numa linha da cena —
 *  MESMA fórmula de `geometriaGrupoJ105` (`ComposicaoJ105Layer`), aplicada a uma ponta de cada vez
 *  para que as duas possam ser interpoladas. `null` quando a linha não existe na cena. */
function projetarPonta(scene: ProjectedScene, labelGutterWidth: number, linha: string, posicaoM: number) {
  const line = resolverLinha(scene, linha)
  if (!line || line.length <= 0) return null
  const escala = line.width / line.length
  const x = labelGutterWidth + line.x + Math.min(1, Math.max(0, posicaoM / line.length)) * line.width
  return { x, y: line.y, escala }
}

/**
 * Faixa horizontal (viewBox) onde este corpo tem permissão de aparecer — a UNIÃO do trecho
 * DESENHADO da linha de origem com o da linha de destino (mesmo par que `geometriaCorpo`
 * interpola). Fora dela (posição < 0 ou > comprimento da linha) o corpo está fisicamente "antes do
 * início"/"depois do fim" do trecho mapeado — é exatamente a faixa reservada ao RÓTULO da linha
 * (`labelGutterWidth`, `Line.tsx`: o texto fica à esquerda dela) — 2026-09-23, bug reportado pelo
 * usuário: no Passo 1 ("Entrada do trem no pátio"), a régua de vagões nasce fora do trecho
 * desenhado (o trem ainda está "entrando" — ver `ENTRADA_PATIO_M`, `animacaoJ105.ts`) e, sem
 * recorte, cobria o texto "L Desvio (1944 m)". `CorpoDesenhado` usa esta faixa como `clipPath`:
 * cortar (não esconder o corpo inteiro) é o que faz os vagões "entrarem em cena" progressivamente
 * conforme a cabeça avança, em vez de aparecerem todos de uma vez ao cruzar o limite.
 * A UNIÃO das duas linhas (não só a de origem) garante que uma travessia do Travessão 2 nunca
 * corte o corpo NO MEIO da diagonal — só as duas pontas externas (antes do início físico de uma
 * linha, depois do fim físico da outra) ficam de fora. `null` só no mesmo caso em que
 * `geometriaCorpo` já teria retornado `null` (linha não resolve contra a cena).
 */
function limitesVisiveisCorpo(
  scene: ProjectedScene,
  labelGutterWidth: number,
  corpo: CorpoAnimadoJ105,
): { x0: number; x1: number } | null {
  const origem = resolverLinha(scene, corpo.linhaOrigem)
  const destino = resolverLinha(scene, corpo.linhaDestino)
  if (!origem || !destino) return null
  const bordas = [origem, destino].flatMap((line) => [labelGutterWidth + line.x, labelGutterWidth + line.x + line.width])
  return { x0: Math.min(...bordas), x1: Math.max(...bordas) }
}

/**
 * Geometria de um corpo animado já resolvida contra a cena. Interpola as DUAS pontas projetadas
 * (origem e destino) por `u` — é isso que faz a composição deslizar na diagonal entre a Linha do
 * Desvio e a LN3 quando o passo atravessa o Travessão 2, em vez de saltar de uma faixa pra outra.
 * A escala (metros → viewBox) também interpola: as duas linhas têm comprimentos diferentes, então
 * o mesmo trem ocupa larguras ligeiramente diferentes em cada uma — interpolar evita um "pulo" de
 * largura no meio da travessia.
 */
function geometriaCorpo(scene: ProjectedScene, labelGutterWidth: number, corpo: CorpoAnimadoJ105): GeometriaCorpo | null {
  const de = projetarPonta(scene, labelGutterWidth, corpo.linhaOrigem, corpo.posicaoOrigemM)
  const para = projetarPonta(scene, labelGutterWidth, corpo.linhaDestino, corpo.posicaoDestinoM)
  if (!de || !para) return null
  const u = Math.min(1, Math.max(0, corpo.u))
  const xCabeca = de.x + (para.x - de.x) * u
  const y = de.y + (para.y - de.y) * u
  const escala = de.escala + (para.escala - de.escala) * u

  const comprimentoTotalM = corpo.veiculos.reduce(
    (soma, v) => soma + v.quantidade * estiloDe(v.papel).comprimentoM,
    0,
  )
  return { xCabeca, xCauda: xCabeca - comprimentoTotalM * escala, y, altura: ALTURA_VEICULO, escala }
}

/** X do ponto de corte de um corpo — MESMA regra de `calcularXCorte` do V1 (cauda do corpo, ou
 *  logo atrás da locomotiva líder), reescrita aqui só porque lá ela recebe um `GrupoVisualJ105` e
 *  aqui a entrada é um corpo já interpolado. */
function xDoCorte(corpo: CorpoAnimadoJ105, xCabeca: number, xCauda: number, escala: number): number | null {
  if (corpo.corte === 'cauda') return xCauda
  if (corpo.corte === 'atras-da-cabeca') {
    const papelCabeca = corpo.veiculos[0]?.papel
    const comprimentoCabecaM = papelCabeca ? estiloDe(papelCabeca).comprimentoM : 0
    return xCabeca - comprimentoCabecaM * escala
  }
  return null
}

function CorpoDesenhado({
  corpo,
  scene,
  labelGutterWidth,
  trechos,
  foco,
}: {
  corpo: CorpoAnimadoJ105
  scene: ProjectedScene
  labelGutterWidth: number
  /** Trecho de cada entrada de `corpo.veiculos` (`trechosDosCorpos`). */
  trechos: (TrechoJ105V2 | null)[]
  /** Veículos em foco por trecho — vazio = nenhuma seleção, desenho de sempre. */
  foco: FocoJ105V2
}) {
  const geo = geometriaCorpo(scene, labelGutterWidth, corpo)
  if (!geo) return null
  const { xCabeca, xCauda, y, altura, escala } = geo
  const limites = limitesVisiveisCorpo(scene, labelGutterWidth, corpo)

  // Ordem física (locomotiva líder primeiro), desenhada da cauda para a cabeça — mesma régua
  // contínua de blocos colados do V1 (`GrupoDesenhado`), sem vão entre veículos.
  const pecas: { papel: PapelVeiculoJ105; emFoco: boolean }[] = []
  corpo.veiculos.forEach((trecho, idx) => {
    const t = trechos[idx]
    const posicoes = t != null ? foco.get(t) : undefined
    const papel = papelVisivelJ105V2(trecho.papel, t)
    for (let i = 0; i < trecho.quantidade; i += 1) pecas.push({ papel, emFoco: !!posicoes?.has(i) })
  })
  const focoAtivo = foco.size > 0
  const corpoEmFoco = pecas.some((p) => p.emFoco)

  let cursor = xCauda
  const retangulos = [...pecas].reverse().map(({ papel, emFoco }, i) => {
    const estilo = estiloDe(papel)
    const largura = estilo.comprimentoM * escala
    const x = cursor
    cursor += largura
    return (
      <rect
        key={i}
        x={x}
        y={y - altura / 2}
        width={largura}
        height={altura}
        fill={estilo.preenchimento}
        stroke={estilo.contorno}
        strokeWidth={0.5}
        opacity={focoAtivo && corpoEmFoco && !emFoco ? OPACIDADE_FORA_FOCO : undefined}
      />
    )
  })

  // Contorno em volta de cada sequência contígua de peças em foco (vizinhos selecionados juntos
  // ganham um contorno só).
  const contornosFoco: { x0: number; x1: number }[] = []
  if (corpoEmFoco) {
    let c = xCauda
    for (const { papel, emFoco } of [...pecas].reverse()) {
      const largura = estiloDe(papel).comprimentoM * escala
      if (emFoco) {
        const ultimo = contornosFoco[contornosFoco.length - 1]
        if (ultimo && Math.abs(ultimo.x1 - c) < 1e-6) ultimo.x1 = c + largura
        else contornosFoco.push({ x0: c, x1: c + largura })
      }
      c += largura
    }
  }
  const destaque = contornosFoco.map((r, i) => (
    <rect
      key={`foco-${i}`}
      x={r.x0 - 1}
      y={y - altura / 2 - 1}
      width={r.x1 - r.x0 + 2}
      height={altura + 2}
      fill="none"
      stroke={COR_FOCO}
      strokeWidth={1.5}
      rx={1}
    />
  ))

  const xCorte = xDoCorte(corpo, xCabeca, xCauda, escala)
  const opacidade = focoAtivo
    ? corpoEmFoco ? 1 : OPACIDADE_FORA_FOCO
    : corpo.esmaecido ? OPACIDADE_ESMAECIDO : corpo.emMovimento ? 1 : OPACIDADE_PARADO

  // Sem `limites` (não deveria acontecer — `geometriaCorpo` já teria retornado `null` antes),
  // desenha sem recorte em vez de sumir o corpo inteiro.
  if (!limites) {
    return (
      <g opacity={opacidade}>
        {retangulos}
        {destaque}
        {xCorte != null && <MarcaCorte x={xCorte} y={y} altura={altura} />}
      </g>
    )
  }

  // Altura do clip = a viewBox inteira (não só `altura`, o bloco do veículo): o recorte é só
  // HORIZONTAL (limites da linha desenhada), nunca vertical — evita cortar o ícone de tesoura de
  // `MarcaCorte`, que desenha ACIMA do bloco (ver `CORTE_ICONE_GAP`/`CORTE_ICONE_TAMANHO`).
  const clipId = `clip-j105v2-${corpo.chave.replace(/[^a-zA-Z0-9_-]/g, '_')}`
  return (
    <>
      <clipPath id={clipId}>
        <rect x={limites.x0} y={0} width={Math.max(0, limites.x1 - limites.x0)} height={scene.viewBoxHeight} />
      </clipPath>
      <g opacity={opacidade} clipPath={`url(#${clipId})`}>
        {retangulos}
        {destaque}
        {xCorte != null && <MarcaCorte x={xCorte} y={y} altura={altura} />}
      </g>
    </>
  )
}

interface ComposicaoJ105V2LayerProps {
  scene: ProjectedScene
  labelGutterWidth: number
  /** Instante atual da linha do tempo, em segundos (ver `animacaoJ105.ts`). */
  tempoS: number
  /** Veículo(s) clicados na "Composição Geral do Trem" (`PlanManobraX.tsx`) — o trecho que os
   *  contém fica em evidência (contorno) e todo o resto recua. Vazio/ausente = desenho de sempre. */
  veiculosFoco?: Set<string> | null
}

export function ComposicaoJ105V2Layer({ scene, labelGutterWidth, tempoS, veiculosFoco }: ComposicaoJ105V2LayerProps) {
  const { corpos, estagio } = estadoAnimadoJ105(tempoS)
  const trechos = trechosDosCorpos(corpos)
  const foco = focoDosVeiculos(veiculosFoco)
  // AMV e marco seguem exatamente a mesma regra do V1 (só nos passos que os citam) — o que muda
  // é só que aqui o "passo corrente" vem do relógio, não de um clique.
  const amv = passoCitaAmvJ105(estagio.passo) ? acharPosicaoJuncaoT2(scene, labelGutterWidth) : null
  const marco = passoCitaMarcoJ105(estagio.passo) ? acharPosicaoJuncaoT2(scene, labelGutterWidth) : null

  return (
    <g data-composicao-j105-v2="">
      {corpos.map((corpo, i) => (
        <CorpoDesenhado key={corpo.chave} corpo={corpo} scene={scene} labelGutterWidth={labelGutterWidth} trechos={trechos[i]} foco={foco} />
      ))}
      {amv && <AmvJ105Marker x={amv.x} y={amv.y} ativo={amvAtivoDoPassoJ105(estagio.passo) != null} />}
      {marco && <MarcoJ105Marker x={marco.x} y={marco.y} />}
    </g>
  )
}

/**
 * Caixa (viewBox) que envolve os corpos EM MANOBRA no instante `tempoS` — alvo da câmera no modo
 * "Seguir a composição" (`ControlesAnimacaoJ105`). Ignora de propósito os corpos `esmaecido`
 * (contexto do pátio, não o trem) — seguir a união de tudo daria um enquadramento quase tão largo
 * quanto o pátio inteiro, que é justamente o outro modo. `null` quando nada resolve contra a cena.
 */
export function alvoCameraJ105V2(scene: ProjectedScene, labelGutterWidth: number, tempoS: number) {
  const { corpos } = estadoAnimadoJ105(tempoS)
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const corpo of corpos) {
    if (corpo.esmaecido) continue
    const geo = geometriaCorpo(scene, labelGutterWidth, corpo)
    if (!geo) continue
    x0 = Math.min(x0, geo.xCauda, geo.xCabeca)
    x1 = Math.max(x1, geo.xCauda, geo.xCabeca)
    y0 = Math.min(y0, geo.y - geo.altura / 2)
    y1 = Math.max(y1, geo.y + geo.altura / 2)
  }
  if (!Number.isFinite(x0)) return null
  return { x0, y0, x1, y1 }
}

/**
 * Caixa (viewBox) do(s) trecho(s) que contêm os veículos em `veiculosFoco` no instante `tempoS` —
 * alvo da câmera quando há veículo selecionado na Composição Geral. `null` quando nenhum veículo
 * focado aparece no mapa nesse instante.
 */
export function alvoVeiculosJ105V2(
  scene: ProjectedScene,
  labelGutterWidth: number,
  tempoS: number,
  veiculosFoco: Set<string> | null | undefined,
) {
  const foco = focoDosVeiculos(veiculosFoco)
  if (foco.size === 0) return null
  const { corpos } = estadoAnimadoJ105(tempoS)
  const trechos = trechosDosCorpos(corpos)
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  corpos.forEach((corpo, ci) => {
    const geo = geometriaCorpo(scene, labelGutterWidth, corpo)
    if (!geo) return
    // Da cauda pra cabeça, na mesma régua de `CorpoDesenhado`.
    let c = geo.xCauda
    const entradas = corpo.veiculos.map((v, i) => ({ v, t: trechos[ci][i] })).reverse()
    for (const { v, t } of entradas) {
      const larguraPeca = estiloDe(v.papel).comprimentoM * geo.escala
      const posicoes = t != null ? foco.get(t) : undefined
      // Da cauda pra cabeça: a peça desenhada k-ésima (da esquerda) é a posição `quantidade-1-k`.
      for (let k = 0; k < v.quantidade; k += 1) {
        if (posicoes?.has(v.quantidade - 1 - k)) {
          x0 = Math.min(x0, c)
          x1 = Math.max(x1, c + larguraPeca)
          y0 = Math.min(y0, geo.y - geo.altura / 2)
          y1 = Math.max(y1, geo.y + geo.altura / 2)
        }
        c += larguraPeca
      }
    }
  })
  if (!Number.isFinite(x0)) return null
  return { x0, y0, x1, y1 }
}
