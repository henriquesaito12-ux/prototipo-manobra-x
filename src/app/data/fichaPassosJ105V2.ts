// Ficha técnica de cada um dos 38 passos do J105 V2 — transcrita da tabela do Plano de Manobra
// v4 (`J105/plano-manobra-j105-v4.pdf`, fora do código-fonte): colunas Bloco, Grupo, Linha, Ref.,
// Dir., Dist. e Dur. Usada só no card expandido de cada passo na aba "Manobras" do J105 V2
// (`PassoJ105Linha`, `PlanManobraX.tsx`). O J105 V1 não lê este arquivo.
//
// Campos que o PDF traz como "—" viram `null` aqui: o card omite o que não tem valor em vez de
// desenhar um traço.

export interface FichaPassoJ105V2 {
  bloco: 'A' | 'B' | null;
  grupo: 'C1' | 'C2' | 'C3' | null;
  linha: 'Desvio' | 'Linha 3';
  referencia: string | null;
  direcao: 'EDV' | 'ECJ' | null;
  distanciaM: number;
  /** Duração estimada, `mm:ss` (coluna "Dur." do PDF). */
  duracao: string;
}

type Linha = [FichaPassoJ105V2['bloco'], FichaPassoJ105V2['grupo'], FichaPassoJ105V2['linha'], string | null, FichaPassoJ105V2['direcao'], number, string];

// Nº: Bloco, Grupo, Linha, Ref., Dir., Dist. (m), Dur.
const TABELA_V4: Linha[] = [
  /* 01 */ [null, null, 'Desvio', null, 'EDV', 560, '01:32'],
  /* 02 */ ['A', 'C1', 'Desvio', 'T2', 'EDV', 651, '00:59'],
  /* 03 */ ['A', 'C1', 'Desvio', 'T2', 'EDV', 651, '05:35'],
  /* 04 */ ['A', 'C1', 'Desvio', 'T2', 'EDV', 690, '00:48'],
  /* 05 */ ['A', 'C1', 'Desvio', 'T2', null, 651, '03:55'],
  /* 06 */ ['A', 'C1', 'Linha 3', 'T2', 'ECJ', 537, '01:05'],
  /* 07 */ ['A', 'C1', 'Linha 3', null, null, 500, '05:35'],
  /* 08 */ ['A', 'C1', 'Linha 3', 'T2', 'EDV', 537, '00:57'],
  /* 09 */ ['A', 'C1', 'Linha 3', 'T2', null, 537, '03:55'],
  /* 10 */ ['A', 'C1', 'Desvio', 'T2', 'ECJ', 651, '01:00'],
  /* 11 */ ['A', 'C1', 'Desvio', 'Pos. 9/10', 'EDV', 500, '00:57'],
  /* 12 */ ['A', 'C1', 'Desvio', 'Pos. 9/10', null, 500, '05:35'],
  /* 13 */ ['A', 'C1', 'Desvio', 'T2', 'EDV', 651, '00:45'],
  /* 14 */ ['A', 'C1', 'Desvio', 'T2', null, 651, '03:55'],
  /* 15 */ ['A', 'C1', 'Linha 3', 'T2', 'ECJ', 537, '01:11'],
  /* 16 */ ['A', 'C1', 'Linha 3', null, null, 500, '05:35'],
  /* 17 */ ['A', 'C1', 'Linha 3', 'T2', 'EDV', 537, '00:54'],
  /* 18 */ ['A', 'C1', 'Linha 3', 'T2', null, 537, '03:55'],
  /* 19 */ ['A', 'C1', 'Desvio', 'T2', 'ECJ', 651, '01:09'],
  /* 20 */ ['B', 'C2', 'Desvio', 'Pos. 78', 'EDV', 651, '02:16'],
  /* 21 */ ['B', 'C2', 'Desvio', 'Pos. 78', null, 651, '05:35'],
  /* 22 */ ['B', 'C2', 'Desvio', 'T2', 'EDV', 651, '00:45'],
  /* 23 */ ['B', 'C2', 'Desvio', 'T2', null, 651, '03:55'],
  /* 24 */ ['B', 'C2', 'Linha 3', null, 'ECJ', 500, '03:53'],
  /* 25 */ ['B', 'C2', 'Linha 3', 'Pos. 78', null, 500, '00:40'],
  /* 26 */ ['B', 'C2', 'Linha 3', null, 'ECJ', 500, '05:35'],
  /* 27 */ ['B', 'C2', 'Linha 3', 'T2', null, 537, '04:08'],
  /* 28 */ ['B', 'C2', 'Desvio', 'T2', 'ECJ', 651, '02:30'],
  /* 29 */ ['B', 'C3', 'Desvio', 'Pos. 83/84', 'EDV', 651, '02:22'],
  /* 30 */ ['B', 'C3', 'Desvio', 'Pos. 83/84', null, 651, '05:35'],
  /* 31 */ ['B', 'C3', 'Desvio', 'T2', 'EDV', 651, '00:45'],
  /* 32 */ ['B', 'C3', 'Desvio', 'T2', null, 651, '03:55'],
  /* 33 */ ['B', 'C3', 'Linha 3', null, 'ECJ', 500, '04:06'],
  /* 34 */ ['B', 'C3', 'Linha 3', null, null, 500, '05:35'],
  /* 35 */ ['B', 'C3', 'Linha 3', 'T2', null, 537, '04:06'],
  /* 36 */ ['B', 'C3', 'Desvio', 'T2', 'ECJ', 651, '02:35'],
  /* 37 */ [null, null, 'Desvio', 'Saída', 'EDV', 1800, '05:16'],
  /* 38 */ [null, null, 'Desvio', null, 'EDV', 1944, '01:14'],
];

/** Ficha do passo `numero` (1..38); `undefined` fora do intervalo. */
export function fichaPassoJ105V2(numero: number): FichaPassoJ105V2 | undefined {
  const l = TABELA_V4[numero - 1];
  if (!l) return undefined;
  const [bloco, grupo, linha, referencia, direcao, distanciaM, duracao] = l;
  return { bloco, grupo, linha, referencia, direcao, distanciaM, duracao };
}
