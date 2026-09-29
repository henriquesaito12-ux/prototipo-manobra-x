// Dados de identidade e topologia do pátio ativo.
//
// O objetivo desta estrutura é permitir que outros pátios (ex.: Imperatriz, Ribeirão)
// sejam adicionados no futuro apenas criando um novo `PatioConfig` com os dados de
// linhas/nomes daquele pátio e trocando a referência `PATIO_ATIVO` — sem alterar a
// lógica dos componentes de tela.
//
// Observação: a GEOMETRIA visual do pátio (coordenadas x/y do SVG em TrainYardSVG)
// ainda é um layout único, não data-driven. Ao habilitar um novo pátio de verdade,
// essa geometria também precisará ser revisada — está fora do escopo do MVP1.

export interface LinhaPatio {
  /** Identificador curto usado em toda a aplicação (ex.: 'L3', 'EVS1'). */
  id: string;
  /** Rótulo completo exibido no mapa topológico (ex.: 'L3 (765)'). */
  rotulo: string;
}

export interface PatioConfig {
  /** Sigla operacional do pátio (ex.: 'EHT'). */
  sigla: string;
  /** Nome do pátio, sem o prefixo "Pátio" (ex.: 'Hélio Torres'). */
  nome: string;
  linhas: LinhaPatio[];
}

export const PATIO_HELIO_TORRES: PatioConfig = {
  sigla: 'EHT',
  nome: 'Hélio Torres',
  linhas: [
    { id: 'L8', rotulo: 'L8' },
    { id: 'L7', rotulo: 'L7 (330)' },
    { id: 'L6', rotulo: 'L6 (830)' },
    { id: 'L5', rotulo: 'L5 (875)' },
    { id: 'L4', rotulo: 'L4 (765)' },
    { id: 'L3', rotulo: 'L3 (765)' },
    { id: 'L2', rotulo: 'L2 (810)' },
    { id: 'L1', rotulo: 'L1 (810)' },
    { id: 'EVS1', rotulo: 'EVS1 - L. Norte (1200)' },
    { id: 'EVS2', rotulo: 'EVS2 - L. Sul (1665)' },
  ],
};

/** Pátio piloto do MVP1. Trocar esta referência para alternar de pátio. */
export const PATIO_ATIVO: PatioConfig = PATIO_HELIO_TORRES;

/** Pátios previstos para expansão futura — fora do escopo do MVP1, sem dados de topologia ainda. */
export const PATIOS_FUTUROS: Array<{ sigla: string; nome: string }> = [
  { sigla: 'EEL', nome: 'Eldorado' },
  { sigla: 'EIM', nome: 'Imperatriz' },
  { sigla: 'ERB', nome: 'Ribeirão' },
];

/** Nomes de todos os pátios (ativo + futuros) — usado em filtros que já podem listar os 3. */
export const NOMES_PATIOS: string[] = [PATIO_ATIVO.nome, ...PATIOS_FUTUROS.map((p) => p.nome)];

export function rotuloDaLinha(id: string): string {
  return PATIO_ATIVO.linhas.find((l) => l.id === id)?.rotulo ?? id;
}
