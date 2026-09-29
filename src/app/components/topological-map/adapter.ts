import { PATIO_ATIVO } from '../../data/patio';
import { fichasMock } from '../../data/fichaOperacao';
import type { Connection, Line, YardTopology } from './train-yard/types';

// Adaptador — converte os dados mock que o projeto principal já usa (linhas do pátio ativo em
// `patio.ts`, trens/ETAs em `fichaOperacao.ts`, restrições ativas do próprio painel) para o
// shape `YardTopology` que o componente de mapa topológico (mapa-topologico-prototipo) consome.
// Não é um espelho do mock `train-yard/mocks/eht.ts` do protótipo — aquele é um snapshot de OUTRO
// pátio EHT (real, mas de uma fonte de dados diferente); aqui a topologia vem da configuração de
// linhas que a própria Ficha Operacional/Plano de Manobra já usam (`PATIO_ATIVO.linhas`).

/** Extrai o comprimento em metros do rótulo opaco de uma linha (ex.: "L3 (765)" → 765). Linhas
 *  sem número entre parênteses (ex.: o rabicho "L8") caem no fallback — ver `LINHA_SEM_METRAGEM`. */
function comprimentoDoRotulo(rotulo: string): number | null {
  const match = rotulo.match(/\((\d+)\)/);
  return match ? Number(match[1]) : null;
}

/** L8 (rabicho/linha de passagem) não tem metragem no rótulo — comprimento aproximado a partir
 *  da proporção visual do SVG estático anterior (span curto, próximo ao centro do pátio). */
const LINHA_SEM_METRAGEM = 110;
const LINHA_SEM_METRAGEM_OFFSET = 360;

/** Linhas com restrição ativa — mesmas 3 linhas citadas em "Restrições Ativas"
 *  (ver `RestrictionsPanel.tsx`): "Linhas L3 e L4 INTERDITADAS (MRS)" e
 *  "Linha L7 interditada para testes de sinalização". */
const LINHAS_INTERDITADAS = new Set(['L3', 'L4', 'L7']);

/** Ordem visual topo→base, igual à do SVG estático anterior (L8 no topo, EVS2 na base). */
const ORDEM_LINHAS = ['L8', 'L7', 'L6', 'L5', 'L4', 'L3', 'L2', 'L1', 'EVS1', 'EVS2'];

function construirLinhas(): Line[] {
  const linhasPorId = new Map(PATIO_ATIVO.linhas.map((l) => [l.id, l]));
  const linhas: Line[] = [];
  let order = 0;

  for (const id of ORDEM_LINHAS) {
    const linhaPatio = linhasPorId.get(id);
    if (!linhaPatio) continue;

    const ehEvs = id.startsWith('EVS');
    const length = comprimentoDoRotulo(linhaPatio.rotulo) ?? LINHA_SEM_METRAGEM;

    linhas.push({
      id,
      label: linhaPatio.rotulo,
      type: id === 'L8' ? 'passagem' : ehEvs ? 'recebimento' : 'carga',
      order: order++,
      length,
      offset: id === 'L8' ? LINHA_SEM_METRAGEM_OFFSET : 0,
      status: LINHAS_INTERDITADAS.has(id) ? ['interditada'] : undefined,
      elements: [],
    });

    // Divisória do CCO — separa as linhas de manobra (L1-L8) das faixas de recebimento
    // (EVS1/EVS2), mesmo papel visual da linha tracejada "LINHAS DE PASSAGEM (CCO)" do SVG
    // estático anterior. Vem logo após L1, antes da primeira EVS.
    if (id === 'L1') {
      linhas.push({
        id: 'CCO-DIV',
        label: '',
        type: 'cco',
        order: order++,
        length: 1665,
        offset: 0,
      });
    }
  }

  // Composições de exemplo — mesmas duas ilustrativas do SVG estático anterior (trem em L3,
  // "04 Dash Planalto" em L2), agora como `CompositionElement` no vocabulário do novo motor.
  // L3 e L2 são linhas VERTICALMENTE ADJACENTES (Y_SPACING=28 no motor de projeção, altura fixa
  // da caixa de composição=26 — só ~2 unidades de folga entre uma linha e a próxima), então os
  // intervalos `at.from`/`at.to` das duas PRECISAM ficar bem separados no eixo X — do contrário
  // as caixas colidem visualmente mesmo sem se sobreporem verticalmente (bug corrigido em
  // 2026-07-31: "04 Dash Planalto" ficava colado/ilegível sob "J614"). Larguras calculadas para
  // caber a label inteira sem estourar a caixa (fator de escala deste pátio ≈ 0,625 px/metro:
  // span 1665 m sobre 1040 unidades de viewBox).
  const l3 = linhas.find((l) => l.id === 'L3');
  if (l3) {
    l3.elements = [
      {
        id: 'composicao-l3',
        kind: 'composition',
        label: 'J614',
        at: { from: 40, to: 280 },
        segments: [
          { kind: 'locomotiva', count: 3, length: 90 },
          { kind: 'vagao', count: 8, length: 150 },
        ],
      },
    ];
  }
  const l2 = linhas.find((l) => l.id === 'L2');
  if (l2) {
    l2.elements = [
      {
        id: 'composicao-l2',
        kind: 'composition',
        label: '04 Dash Planalto',
        // Começa em 430 (bem depois do fim de L3 em 280) — zero sobreposição em X com a
        // composição de L3, e intervalo largo o bastante (260 un.) para o texto não estourar.
        at: { from: 430, to: 690 },
        segments: [{ kind: 'locomotiva', count: 4, length: 260 }],
      },
    ];
  }

  // Badge de interdição em L4 — mesmo texto do box vermelho do SVG estático anterior.
  const l4 = linhas.find((l) => l.id === 'L4');
  if (l4) {
    l4.elements = [
      { id: 'interdicao-l4', kind: 'marker', variant: 'interdicao', label: 'INTERDITADA (MRS)', at: { from: l4.length * 0.45 } },
    ];
  }

  // ETAs reais — os 2 próximos trens a chegar (mesmo dado usado na coluna "ETA" de "Trens do
  // Dia", ver `fichaOperacao.ts`), plotados como marcadores nas faixas de recebimento (EVS1/EVS2)
  // onde o SVG estático anterior já mostrava badges "ETA 1"/"ETA 2".
  const proximasEtas = fichasMock
    .filter((f): f is typeof f & { eta: string } => Boolean(f.eta))
    .sort((a, b) => a.eta.localeCompare(b.eta))
    .slice(0, 2);

  const evs1 = linhas.find((l) => l.id === 'EVS1');
  if (evs1 && proximasEtas[0]) {
    evs1.elements = [
      { id: 'eta-evs1', kind: 'marker', variant: 'eta', label: `ETA ${proximasEtas[0].eta}`, at: { from: evs1.length * 0.72 } },
    ];
  }
  const evs2 = linhas.find((l) => l.id === 'EVS2');
  if (evs2 && proximasEtas[1]) {
    evs2.elements = [
      { id: 'eta-evs2', kind: 'marker', variant: 'eta', label: `ETA ${proximasEtas[1].eta}`, at: { from: evs2.length * 0.72 } },
    ];
  }

  return linhas;
}

/** Conectores (trocas de faixa/AMV) entre cada par de linhas adjacentes, em ambas as
 *  extremidades — mesmo efeito visual dos conectores diagonais do SVG estático anterior. */
function construirConexoes(linhas: Line[]): Connection[] {
  const conexoes: Connection[] = [];
  const navegaveis = linhas.filter((l) => l.type !== 'cco');

  for (let i = 0; i < navegaveis.length - 1; i++) {
    const de = navegaveis[i];
    const para = navegaveis[i + 1];
    conexoes.push(
      { id: `${de.id}-${para.id}-inicio`, fromLineId: de.id, toLineId: para.id, atFrom: 0, atTo: 0 },
      { id: `${de.id}-${para.id}-fim`, fromLineId: de.id, toLineId: para.id, atFrom: de.length, atTo: para.length },
    );
  }
  return conexoes;
}

/** Topologia do pátio ativo (Hélio Torres), pronta para `<TrainYardSVG topology={...} />`. */
export function construirTopologiaPatioAtivo(): YardTopology {
  const lines = construirLinhas();
  return {
    yardId: PATIO_ATIVO.sigla,
    updatedAt: new Date(0).toISOString(),
    scale: { unit: 'm', scaleFactor: 1 },
    lines,
    connections: construirConexoes(lines),
  };
}
