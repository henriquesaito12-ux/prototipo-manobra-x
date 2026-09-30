// Composição Geral REAL do J105 V2 — Antes/Depois por Bloco (A/B/C), transcrita da imagem de
// referência do plano (2026-09-24, pedido explícito do usuário: "não são dados de exemplo... são
// os vagões reais... na ordem exata"). Substitui, SÓ na aba "Visão Geral" do J105 V2, a lista
// sintetizada por `construirPlanoJ105` (`vagoesPassagemJ105`, numeração fictícia 705100-0,
// 705101-1...). O J105 V1 continua lendo o plano compartilhado, intocado.
//
// Cada Bloco começa pela sua locomotiva (A = 8442-6 na cabeça, B = 8439-6 no meio, C = 8443-6 na
// cauda — energia distribuída, mesma ordem de `LOCOMOTIVAS_J105`). "Antes" traz os 5 avariados
// marcados `retirado` na posição física onde estão; "Depois" já sem eles e com o vagão bom
// (`incluido`) logo atrás da locomotiva líder.

import type { ItemComposicao } from './planoManobra';
import { interpretarPlanilha, type PlanilhaBruta } from '../utils/fichaImport';
import planilhaJ105 from './fixtures/fichaJ105.planilha.json';

export interface BlocoComposicaoGeralJ105V2 {
  letra: 'A' | 'B' | 'C';
  antes: ItemComposicao[];
  depois: ItemComposicao[];
}

const RETIRADOS = new Set(['705327-4', '705328-2', '342663-7', '253578-5', '253577-7']);
const VAGAO_BOM_ID = '241504-6';

const LOCO_A = '8442-6';
const LOCO_B = '8439-6';
const LOCO_C = '8443-6';

/** Ordem física dos vagões do Bloco A no "Antes" (retirados incluídos, na posição deles). */
const VAGOES_A = [
  '618186-4', '306011-0', '617652-6', '304770-9', '305834-4', '314305-8', '705327-4', '705328-2', '705257-0', '705258-8', '618194-5', '056422-2',
  '604824-2', '056379-0', '603461-6', '342729-3', '617780-8', '604442-5', '314280-9', '605126-0', '605185-5', '604832-3', '604697-5', '314257-4', '604917-6',
  '640909-1', '604559-6', '617683-6', '305642-2', '603530-2', '305896-4', '063006-3', '605260-6', '640906-7', '605036-1', '304940-0', '604961-3', '314312-1',
  '603525-6', '604455-7', '617744-1', '603554-0', '617798-1', '342688-2', '617799-9', '603564-7',
];

/** Ordem física dos vagões do Bloco B no "Antes" (retirados incluídos, na posição deles). */
const VAGOES_B = [
  '305851-4', '617663-1', '603427-6', '618261-5', '619095-2', '637182-5', '060988-9', '618197-0', '608214-9', '646115-8', '254175-1', '254176-9', '637108-6',
  '705271-5', '705272-3', '603475-6', '253686-2', '253685-4', '314227-2', '314030-0', '314082-2', '314097-1', '254040-1', '254039-8', '253609-9', '253610-2',
  '254172-6', '254171-8', '253844-0', '342663-7', '253501-7', '253502-5', '254004-5', '254003-7', '253578-5', '253577-7', '705291-0', '705292-8', '342806-1',
  '254092-4', '254091-6', '254014-2', '254013-4', '254186-6', '254185-8', '306056-0',
];

const loco = (id: string): ItemComposicao => ({ id, tipo: 'locomotiva' });
const antes = (ids: string[]): ItemComposicao[] => ids.map((id) => ({ id, tipo: RETIRADOS.has(id) ? 'retirado' : 'vagao' }));
const depois = (ids: string[]): ItemComposicao[] => ids.filter((id) => !RETIRADOS.has(id)).map((id) => ({ id, tipo: 'vagao' }));

export const COMPOSICAO_GERAL_J105_V2: BlocoComposicaoGeralJ105V2[] = [
  {
    letra: 'A',
    antes: [loco(LOCO_A), ...antes(VAGOES_A)],
    depois: [loco(LOCO_A), { id: VAGAO_BOM_ID, tipo: 'incluido' }, ...depois(VAGOES_A)],
  },
  {
    letra: 'B',
    antes: [loco(LOCO_B), ...antes(VAGOES_B)],
    depois: [loco(LOCO_B), ...depois(VAGOES_B)],
  },
  {
    letra: 'C',
    antes: [loco(LOCO_C)],
    depois: [loco(LOCO_C)],
  },
];

/**
 * Trecho do modelo visual do J105 (`TRECHOS`, `visualJ105.ts`) em que cada veículo real está —
 * é o que liga o clique num chip da Composição Geral ao corpo desenhado no mapa animado
 * (`ComposicaoJ105V2Layer`). O mapa trabalha em trechos, não vagão a vagão, então o destaque é do
 * trecho inteiro que contém o veículo. Os avariados são as âncoras: o que vem antes de
 * 705327-4/705328-2 é `preA`, o que vem depois é `postA`; no Bloco B, 342663-7 separa `preB` de
 * `midB` e 253578-5/253577-7 separam `midB` de `postB`.
 */
export type TrechoJ105V2 =
  | 'locoA' | 'bom' | 'preA' | 'alvo1' | 'postA'
  | 'locoB' | 'preB' | 'alvo2' | 'midB' | 'alvo3' | 'postB'
  | 'locoC';

function mapearTrechos(): Map<string, TrechoJ105V2> {
  const mapa = new Map<string, TrechoJ105V2>([
    [LOCO_A, 'locoA'],
    [LOCO_B, 'locoB'],
    [LOCO_C, 'locoC'],
    [VAGAO_BOM_ID, 'bom'],
  ]);
  // Percorre o Bloco na ordem física: cada avariado fecha o trecho comum anterior a ele e abre o
  // seguinte (`trechosComuns[i]` vem antes de `ancoras[i]`, o último vem depois de todas).
  const atribuir = (ids: string[], ancoras: Record<string, TrechoJ105V2>, trechosComuns: TrechoJ105V2[]) => {
    let i = 0;
    let dentroDeAncora = false;
    for (const id of ids) {
      const ancora = ancoras[id];
      if (ancora) {
        mapa.set(id, ancora);
        dentroDeAncora = true;
        continue;
      }
      if (dentroDeAncora) {
        i += 1;
        dentroDeAncora = false;
      }
      mapa.set(id, trechosComuns[i]);
    }
  };
  atribuir(VAGOES_A, { '705327-4': 'alvo1', '705328-2': 'alvo1' }, ['preA', 'postA']);
  atribuir(VAGOES_B, { '342663-7': 'alvo2', '253578-5': 'alvo3', '253577-7': 'alvo3' }, ['preB', 'midB', 'postB']);
  return mapa;
}

export const TRECHO_DO_VEICULO_J105_V2: ReadonlyMap<string, TrechoJ105V2> = mapearTrechos();

/** Posição de cada veículo DENTRO do seu trecho (0 = o mais próximo da cabeça do trem) e o total
 *  de veículos reais daquele trecho — é o que deixa o clique destacar o vagão exato no mapa, e não
 *  o trecho inteiro. */
function mapearPosicoes(): { indice: Map<string, number>; total: Map<TrechoJ105V2, number> } {
  const indice = new Map<string, number>();
  const total = new Map<TrechoJ105V2, number>();
  for (const [id, trecho] of TRECHO_DO_VEICULO_J105_V2) {
    const n = total.get(trecho) ?? 0;
    indice.set(id, n);
    total.set(trecho, n + 1);
  }
  return { indice, total };
}
const POSICOES = mapearPosicoes();
export const INDICE_NO_TRECHO_J105_V2: ReadonlyMap<string, number> = POSICOES.indice;
export const TOTAL_REAL_DO_TRECHO_J105_V2: ReadonlyMap<TrechoJ105V2, number> = POSICOES.total;

/**
 * "Métricas Gerais" do J105 V2 (aba Visão Geral) — 2026-09-24, pedido explícito do usuário: os
 * valores derivados do plano compartilhado com o V1 (`metricasGeraisPlano`) estavam errados pra
 * este trem ("Blocos: 1", comprimento pela régua média de 16 m/vagão, tempo somando os 38
 * passos como "grupos"). Tudo o que dá pra derivar vem da composição real acima; o tempo vem da
 * MESMA linha do tempo que a lista de 38 passos e os controles da animação usam
 * (`DURACAO_TOTAL_J105`). O comprimento não tem fonte no modelo (nenhum vagão carrega metragem) —
 * vem do plano de referência.
 */
export interface MetricasGeraisJ105V2 {
  locomotivasIds: string[];
  blocos: string[];
  vagoesAntes: number;
  vagoesDepois: number;
  retirados: number;
  incluidos: number;
  comprimentoAntesM: number;
  comprimentoDepoisM: number;
  /** Soma do Tb (peso bruto, t) de cada veículo, Antes → Depois. */
  pesoBrutoAntesT: number;
  pesoBrutoDepoisT: number;
  /** Duração total do plano, em segundos. */
  tempoPlanejadoS: number;
}

const COMPRIMENTO_INICIAL_M = 1479;
const COMPRIMENTO_FINAL_M = 1417;

/** Tb de cada veículo, por número, lido da planilha real do J105 (Ficha do trem + Visão pátio —
 *  o vagão bom incluído só existe na Visão pátio). Veículo sem Tb conta como 0. */
function mapearPesosBrutos(): Map<string, number> {
  const { leitura } = interpretarPlanilha(planilhaJ105 as PlanilhaBruta);
  const pesos = new Map<string, number>();
  for (const v of [...leitura.patioLocomotivas, ...leitura.patioVagoes, ...leitura.composicao]) {
    if (v.pesoBrutoT != null) pesos.set(v.numero, v.pesoBrutoT);
  }
  return pesos;
}
const PESO_BRUTO_T = mapearPesosBrutos();
const somarPesoBruto = (itens: ItemComposicao[]) => itens.reduce((s, i) => s + (PESO_BRUTO_T.get(i.id) ?? 0), 0);

export function metricasGeraisJ105V2(tempoPlanejadoS: number): MetricasGeraisJ105V2 {
  const antesTodos = COMPOSICAO_GERAL_J105_V2.flatMap((b) => b.antes);
  const depoisTodos = COMPOSICAO_GERAL_J105_V2.flatMap((b) => b.depois);
  return {
    locomotivasIds: [LOCO_A, LOCO_B, LOCO_C].map((id) => `S7B ${id}`),
    blocos: COMPOSICAO_GERAL_J105_V2.map((b) => b.letra),
    vagoesAntes: antesTodos.filter((i) => i.tipo !== 'locomotiva').length,
    vagoesDepois: depoisTodos.filter((i) => i.tipo !== 'locomotiva').length,
    retirados: antesTodos.filter((i) => i.tipo === 'retirado').length,
    incluidos: depoisTodos.filter((i) => i.tipo === 'incluido').length,
    comprimentoAntesM: COMPRIMENTO_INICIAL_M,
    comprimentoDepoisM: COMPRIMENTO_FINAL_M,
    pesoBrutoAntesT: somarPesoBruto(antesTodos),
    pesoBrutoDepoisT: somarPesoBruto(depoisTodos),
    tempoPlanejadoS,
  };
}
