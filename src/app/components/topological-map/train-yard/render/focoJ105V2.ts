import type { CorpoAnimadoJ105 } from '../../../../data/animacaoJ105'
import type { PapelVeiculoJ105 } from '../../../../data/visualJ105'
import {
  INDICE_NO_TRECHO_J105_V2,
  TOTAL_REAL_DO_TRECHO_J105_V2,
  TRECHO_DO_VEICULO_J105_V2,
  type TrechoJ105V2,
} from '../../../../data/composicaoGeralJ105V2'

// Liga o clique num veículo da "Composição Geral do Trem" (J105 V2, `PlanManobraX.tsx`) ao corpo
// desenhado no mapa animado (`ComposicaoJ105V2Layer`). Exclusivo do J105 V2.
//
// O modelo visual (`visualJ105.ts`) trabalha em TRECHOS, e `CorpoAnimadoJ105.veiculos` só guarda
// papel + quantidade de cada trecho, sem o id. Mas todo corpo é sempre uma fatia contígua da MESMA
// ordem canônica (abaixo) — os cortes só partem essa sequência, nunca a reordenam; os únicos
// trechos que podem faltar no meio dela são os que já saíram (avariados cortados) ou ainda não
// entraram (vagão bom). Então dá pra reconhecer cada entrada de `veiculos` pela posição + papel +
// quantidade (a quantidade de um trecho nunca muda, só o papel dos avariados).

interface Slot {
  trecho: TrechoJ105V2
  quantidade: number
  papeis: PapelVeiculoJ105[]
  /** Pode estar ausente no MEIO de um corpo (já cortado / ainda não engatado). */
  pulavel: boolean
}

/** Mesma ordem e quantidades de `TRECHOS`/`TREM_COM_BOM` (`visualJ105.ts`). */
const SLOTS: Slot[] = [
  { trecho: 'locoA', quantidade: 1, papeis: ['loco'], pulavel: false },
  { trecho: 'bom', quantidade: 1, papeis: ['bom'], pulavel: true },
  { trecho: 'preA', quantidade: 8, papeis: ['vagao'], pulavel: false },
  { trecho: 'alvo1', quantidade: 2, papeis: ['vagao', 'alvo', 'retirado'], pulavel: true },
  { trecho: 'postA', quantidade: 37, papeis: ['vagao'], pulavel: false },
  { trecho: 'locoB', quantidade: 1, papeis: ['loco'], pulavel: false },
  { trecho: 'preB', quantidade: 30, papeis: ['vagao'], pulavel: false },
  { trecho: 'alvo2', quantidade: 1, papeis: ['vagao', 'alvo', 'retirado'], pulavel: true },
  { trecho: 'midB', quantidade: 4, papeis: ['vagao'], pulavel: false },
  { trecho: 'alvo3', quantidade: 2, papeis: ['vagao', 'alvo', 'retirado'], pulavel: true },
  { trecho: 'postB', quantidade: 8, papeis: ['vagao'], pulavel: false },
  { trecho: 'locoC', quantidade: 1, papeis: ['loco'], pulavel: false },
]

const PILHAS_RETIRADOS: TrechoJ105V2[] = ['alvo1', 'alvo2', 'alvo3']

function casa(entrada: CorpoAnimadoJ105['veiculos'][number], slot: Slot): boolean {
  return entrada.quantidade === slot.quantidade && slot.papeis.includes(entrada.papel)
}

/** Alinha `veiculos` a partir do slot `inicio`: entrada i casa com um slot, e entre dois slots
 *  casados só podem faltar slots `pulavel`. `null` quando não alinha. */
function alinharDesde(veiculos: CorpoAnimadoJ105['veiculos'], inicio: number): TrechoJ105V2[] | null {
  const trechos: TrechoJ105V2[] = []
  let s = inicio
  for (const entrada of veiculos) {
    while (s < SLOTS.length && !casa(entrada, SLOTS[s])) {
      if (!SLOTS[s].pulavel || trechos.length === 0) return null
      s += 1
    }
    if (s >= SLOTS.length) return null
    trechos.push(SLOTS[s].trecho)
    s += 1
  }
  return trechos
}

/**
 * Trecho de cada entrada de `veiculos` de cada corpo (paralelo a `corpo.veiculos`); `null` na
 * entrada que não pertence ao J105 (o trem alheio estacionado na LN3).
 */
export function trechosDosCorpos(corpos: CorpoAnimadoJ105[]): (TrechoJ105V2 | null)[][] {
  let pilha = 0
  return corpos.map((corpo) => {
    // Pilhas de avariados já deixados na LN3: entram em `corpos` na ordem dos ciclos (1, 2, 3 —
    // `paradosAte`), então a n-ésima pilha é a do n-ésimo avariado.
    if (corpo.veiculos.length > 0 && corpo.veiculos.every((v) => v.papel === 'retirado') && !corpo.emMovimento && corpo.chave.startsWith('estatico:')) {
      const trecho = PILHAS_RETIRADOS[pilha] ?? null
      pilha += 1
      return corpo.veiculos.map(() => trecho)
    }
    for (let inicio = 0; inicio < SLOTS.length; inicio += 1) {
      const alinhado = alinharDesde(corpo.veiculos, inicio)
      if (alinhado) return alinhado
    }
    // Trem estacionado na LN3 (vagão bom + vagões alheios antes do Passo 6): só o bom é do J105.
    return corpo.veiculos.map((v) => (v.papel === 'bom' ? 'bom' : null))
  })
}

/** Veículos focados, por trecho: posição (0 = mais perto da cabeça) de cada um dentro do trecho,
 *  na régua DO MAPA. */
export type FocoJ105V2 = Map<TrechoJ105V2, Set<number>>

/** Quantidade de cada trecho no modelo do mapa (`TRECHOS`, `visualJ105.ts`). */
const QUANTIDADE_NO_MAPA = new Map(SLOTS.map((s) => [s.trecho, s.quantidade]))

/**
 * Converte os ids clicados em (trecho, posição no mapa). O modelo do mapa tem as contagens de
 * cada trecho arredondadas em relação à lista real (ex.: `postB` desenha 8 vagões, a lista real
 * tem 10 entre o último avariado e a locomotiva C) — a posição é reescalada proporcionalmente,
 * pra o 1º vagão real cair no 1º do mapa e o último no último.
 */
export function focoDosVeiculos(veiculosFoco: Set<string> | null | undefined): FocoJ105V2 {
  const foco: FocoJ105V2 = new Map()
  if (!veiculosFoco) return foco
  for (const id of veiculosFoco) {
    const trecho = TRECHO_DO_VEICULO_J105_V2.get(id)
    if (!trecho) continue
    const noMapa = QUANTIDADE_NO_MAPA.get(trecho) ?? 1
    const real = TOTAL_REAL_DO_TRECHO_J105_V2.get(trecho) ?? 1
    const i = INDICE_NO_TRECHO_J105_V2.get(id) ?? 0
    const posicao = Math.min(noMapa - 1, Math.floor((i * noMapa) / real))
    if (!foco.has(trecho)) foco.set(trecho, new Set())
    foco.get(trecho)!.add(posicao)
  }
  return foco
}

/** Os avariados que o modelo ainda desenha como vagão comum antes do ciclo deles
 *  (`AINDA_NORMAIS`, `visualJ105.ts`) — no V2 já nascem vermelhos (`alvo`), 2026-09-24, pedido
 *  explícito do usuário: "podem ficar vermelhos desde o início". V1 não passa por aqui. */
export function papelVisivelJ105V2(papel: PapelVeiculoJ105, trecho: TrechoJ105V2 | null): PapelVeiculoJ105 {
  if (papel === 'vagao' && (trecho === 'alvo1' || trecho === 'alvo2' || trecho === 'alvo3')) return 'alvo'
  return papel
}
