// Fichas Operacionais do protótipo — caixa de entrada: várias fichas chegam (uma por trem/OS) e
// o operador trata uma a uma.
//
// `FichaResumo` carrega só a IDENTIFICAÇÃO da ficha e as AÇÕES OPERACIONAIS (entrada manual). Os
// dados de leitura (composição, restrições, pátio, situação) NÃO moram aqui: ficam na fonte de
// dados (`fonteDadosFicha.ts`), que este arquivo apenas semeia com os mocks abaixo.
//
// J105 / J105 V2 usam o arquivo REAL do modelo (`fixtures/fichaJ105.planilha.json`, extraído de
// `modelo_ficha_operacao.xlsx`) passando pelo MESMO parser do upload. Os demais trens são gerados
// (`gerarComposicao`) e convertidos para o modelo neutro em `mockParaLeitura`.

import { TREM_J105_V2 } from './animacaoJ105';
import {
  acoesVazias,
  novoIdAcao,
  totaisDaComposicao,
  type AcoesOperacionais,
  type DadosFichaLeitura,
  type NotaSap,
  type VeiculoComposicao,
} from './fichaModelo';
import { TIPO_RESTRICAO_LABEL, type TipoRestricao } from './glossarioFicha';
import { registrarDadosFicha } from './fonteDadosFicha';
import { TRENS_ATIVOS } from './trensAtivos';
import { correcoesVazias, type CorrecoesLeitura } from './correcoesLeitura';
import { interpretarPlanilha, type PlanilhaBruta } from '../utils/fichaImport';
import planilhaJ105 from './fixtures/fichaJ105.planilha.json';

export interface FichaResumo {
  id: string;
  trem: string;
  os: string;
  patioNome: string;
  /** Data de referência da ficha, no formato ISO (AAAA-MM-DD). */
  data: string;
  recebidoEm: string;
  /** Horário previsto de chegada do trem no pátio (lista lateral do Plano de Manobra). */
  eta?: string;
  /** Presente quando a ficha foi movida para a lixeira (ISO datetime). */
  excluidaEm?: string;
  /** Decisão manual do operador — nunca vem de integração. */
  acoes: AcoesOperacionais;
  /** Correções manuais sobre os dados de leitura — a fonte em si nunca é alterada. */
  correcoes: CorrecoesLeitura;
}

/** Vagão como gerado pelos mocks — formato interno deste arquivo, convertido em `mockParaLeitura`. */
interface VagaoMock {
  veiculo: string;
  serie: string;
  origem: string;
  destino: string;
  mercadoria: string;
  restricaoConsolidada: string;
  tipoRestricao?: TipoRestricao;
  reterSap: boolean;
  reterPlano: boolean;
  seqVale?: number;
  seqFca?: number;
  hollowFriso?: string;
  volta?: number;
  bloco?: string;
  notasSap?: NotaSap[];
  aRetirar?: boolean;
  motivoRetirada?: string;
}

interface VagaoIncluir {
  veiculo: string;
  serie: string;
  bloco?: string;
}

type FichaMock = Omit<FichaResumo, 'acoes' | 'correcoes'> & { vagoes: VagaoMock[]; vagoesIncluir?: VagaoIncluir[] };

/** Data "atual" do turno no protótipo — usada como padrão do seletor de histórico. */
export const HOJE = '2026-08-24';

// ============================================================================
// Geração da composição completa dos trens (~80-90 vagões cada, como no relatório real) —
// a grande maioria "limpa" (sem restrição), com algumas exceções pontuais inseridas nas
// posições indicadas em `excecoes`. Mantém o mock legível sem exigir ~900 objetos escritos
// à mão.
// ============================================================================

const SERIES_CARREGADO = ['PCD', 'PED'];
const SERIES_VAZIO = ['HPD', 'HFE', 'HFD'];

/** Códigos de estação (estilo relatório real GPV/Vale, ex.: EPW/ETB) — a maioria dos vagões
 *  segue o trecho principal do trem, mas uma minoria (posições múltiplas de 9) sai num destino
 *  próprio, pra deixar claro que Origem/Destino são lidos por vagão (colunas Ori/Des), não
 *  fixos pra composição inteira. */
const DESTINOS_ALTERNATIVOS = ['EBJ', 'EVN'];

/** Mercadoria (coluna "Mercadoria" da Ficha do trem real) — no relatório amostrado ela costuma
 *  vir vazia mesmo em vagões carregados; aqui preenchemos só uma minoria dos carregados, pra
 *  demonstrar os dois casos ("—" quando vazia, texto quando preenchida). */
const MERCADORIAS = ['MINÉRIO DE FERRO', 'FERTILIZANTE', 'CARVÃO MINERAL'];

/** Reporting mark plausível no estilo do relatório (número + dígito verificador), só para
 *  os vagões de enchimento — os vagões "nomeados" (com restrição) mantêm o estilo
 *  "SÉRIE-NNNNN" já usado no resto do app. */
function numeroVeiculo(seed: number, i: number): string {
  const base = 700000 + seed * 137 + i * 7;
  const check = (i % 9) + 1;
  return `${base}-${check}`;
}

interface VagaoFixo {
  posicao: number;
  dados: Partial<VagaoMock> & { veiculo: string; serie: string };
}

/** Monta a composição de um trem: locomotiva(s) + vagões, distribuídos em blocos/voltas, com
 *  alguns vagões "fixos" (nomeados, geralmente com restrição) inseridos nas posições pedidas
 *  e o restante preenchido por vagões limpos gerados em sequência. `bloco` é calculado aqui a
 *  partir da própria sequência de geração (cada locomotiva abre um bloco novo) e `origem`/
 *  `destino` são atribuídos por vagão — os mesmos dois princípios usados no parser real
 *  (`lib/fichaImport.ts`) pra ler o upload. */
function gerarComposicao(opts: {
  locomotivas: string[];
  origem: string;
  destino: string;
  totalVagoes: number;
  seed: number;
  numVoltas?: number;
  vagoesFixos?: VagaoFixo[];
}): VagaoMock[] {
  const { locomotivas, origem, destino, totalVagoes, seed, numVoltas = 4, vagoesFixos = [] } = opts;
  const composicao: VagaoMock[] = [];
  const totalBlocos = locomotivas.length;
  const vagoesPorBloco = Math.ceil(totalVagoes / totalBlocos);
  let contadorVagao = 0; // índice do vagão (sem contar locomotivas) — independente de quantas
  // locomotivas já foram inseridas, para não desalinhar `vagoesFixos.posicao`.

  locomotivas.forEach((loco, blocoIdx) => {
    composicao.push({
      veiculo: loco,
      serie: 'DASH-9',
      // Locomotivas não têm Ori/Des/Mercadoria na "Ficha do trem" real (só aparecem no
      // cabeçalho de vagões) — ficam vazias, a tela exibe "—".
      origem: '',
      destino: '',
      mercadoria: '',
      restricaoConsolidada: 'Nenhuma',
      reterSap: false,
      reterPlano: false,
      volta: 1,
      bloco: `Bloco ${String.fromCharCode(65 + blocoIdx)}`,
    });

    for (let i = 0; i < vagoesPorBloco && contadorVagao < totalVagoes; i++) {
      const posicaoGlobal = contadorVagao;
      const fixo = vagoesFixos.find((f) => f.posicao === posicaoGlobal);
      const carregado = i < vagoesPorBloco * 0.4;
      const serieGerada = carregado
        ? SERIES_CARREGADO[posicaoGlobal % SERIES_CARREGADO.length]
        : SERIES_VAZIO[posicaoGlobal % SERIES_VAZIO.length];
      const volta = Math.min(numVoltas, Math.floor(i / Math.ceil(vagoesPorBloco / numVoltas)) + 1);
      const destinoVagao = posicaoGlobal > 0 && posicaoGlobal % 9 === 0
        ? DESTINOS_ALTERNATIVOS[posicaoGlobal % DESTINOS_ALTERNATIVOS.length]
        : destino;
      const mercadoria = carregado && posicaoGlobal % 5 === 0
        ? MERCADORIAS[posicaoGlobal % MERCADORIAS.length]
        : '';

      const base: VagaoMock = {
        veiculo: numeroVeiculo(seed, posicaoGlobal),
        serie: serieGerada,
        origem,
        destino: destinoVagao,
        mercadoria,
        restricaoConsolidada: 'Nenhuma',
        reterSap: false,
        reterPlano: false,
        volta,
        bloco: `Bloco ${String.fromCharCode(65 + blocoIdx)}`,
      };

      composicao.push(fixo ? { ...base, ...fixo.dados, bloco: base.bloco, volta: fixo.dados.volta ?? base.volta } : base);
      contadorVagao++;
    }
  });

  // Numeração sequencial VALE/FCA pela posição final na composição — os poucos vagões com
  // `seqFca` explicitamente definido em `vagoesFixos` (para demonstrar divergência entre as
  // duas numerações) mantêm o valor fixo; o resto é sequencial.
  composicao.forEach((v, i) => {
    if (v.seqVale === undefined) v.seqVale = i + 1;
    if (v.seqFca === undefined) v.seqFca = i + 1;
  });

  return composicao;
}

// ---------------------------------------------------------------------------------------
// J614 — ficha "vitrine": os vagões nomeados abaixo (GT46-0117/0132, VG-880xx, VG 4552) são
// os MESMOS já referenciados pelo Plano Manobra X (`planoManobra.ts`) para este trem — os
// nomes/textos de restrição não podem mudar, senão o plano de manobra perde a consistência
// com a ficha. O restante da composição (~80 vagões) é gerado para completar o total real.
// ---------------------------------------------------------------------------------------
const vagoesJ614 = gerarComposicao({
  locomotivas: ['GT46-0117', 'GT46-0132'],
  origem: 'EPW',
  destino: 'ETB',
  totalVagoes: 87,
  seed: 11,
  vagoesFixos: [
    { posicao: 0, dados: { veiculo: 'VG-88011', serie: 'VG' } },
    { posicao: 1, dados: { veiculo: 'VG-88034', serie: 'VG' } },
    {
      posicao: 40,
      dados: {
        veiculo: 'VG-88062',
        serie: 'VG',
        // Demonstra o complemento da "Planilha1" (vagões a retirar) — independente da
        // taxonomia de restrição: este vagão não tem `tipoRestricao`, só `aRetirar`.
        aRetirar: true,
        motivoRetirada: 'Avariado',
      },
    },
    {
      posicao: 41,
      dados: {
        veiculo: 'VG-88079',
        serie: 'VG',
        restricaoConsolidada: 'Restrição de velocidade — eixo trincado',
        tipoRestricao: 'atencao',
        reterSap: true,
        seqFca: 47, // diverge do Seq. VALE — numerações VLI e FCA nem sempre coincidem
        notasSap: [
          {
            equipamento: 'VG-88079',
            nota: '45198',
            ordem: '80231455',
            descricao: 'Trinca em eixo — restrição de 40km/h até substituição',
            data: '20/05/2026',
          },
        ],
      },
    },
    {
      posicao: 42,
      dados: {
        veiculo: 'VG-88057',
        serie: 'VG',
        restricaoConsolidada: 'Avaria em rodeiro — cuidado ao manobrar',
        tipoRestricao: 'bloqueio',
        reterSap: true,
        hollowFriso: 'Hollow + friso alto e fino — roda dianteira esquerda',
        seqFca: 48,
        notasSap: [
          {
            equipamento: 'VG-88057',
            nota: '45231',
            ordem: '80231402',
            descricao: 'Avaria em rodeiro — desgaste hollow acima do limite',
            data: '18/05/2026',
          },
          {
            equipamento: 'VG-88057',
            nota: '45233',
            ordem: '80231403',
            descricao: 'Inspeção complementar de friso solicitada pela manutenção',
            data: '19/05/2026',
          },
        ],
      },
    },
    {
      posicao: 43,
      dados: {
        veiculo: 'VG-88091',
        serie: 'VG',
        reterPlano: true,
      },
    },
    {
      posicao: 45,
      dados: {
        veiculo: 'VG-88095',
        serie: 'VG',
        aRetirar: true,
        motivoRetirada: 'Ag Tração',
      },
    },
    {
      posicao: 50,
      dados: {
        veiculo: 'VG-88103',
        serie: 'VG',
        aRetirar: true,
        motivoRetirada: 'Não Operacional',
      },
    },
    {
      posicao: 55,
      dados: {
        veiculo: 'VG-88110',
        serie: 'VG',
        aRetirar: true,
        motivoRetirada: 'Avariado',
      },
    },
    {
      posicao: 60,
      dados: {
        veiculo: numeroVeiculo(11, 60),
        serie: 'HFE',
        restricaoConsolidada: 'Ruído anormal no rolamento — monitorar durante o trajeto',
        tipoRestricao: 'alerta',
      },
    },
    {
      posicao: 61,
      dados: {
        veiculo: numeroVeiculo(11, 61),
        serie: 'HFD',
        restricaoConsolidada: 'Pendência de inspeção periódica — verificar antes da liberação',
        tipoRestricao: 'verificar',
      },
    },
    {
      posicao: 62,
      dados: {
        veiculo: numeroVeiculo(11, 62),
        serie: 'HPD',
        restricaoConsolidada: 'Etiqueta de campanha de manutenção preventiva — sem impacto operacional',
        tipoRestricao: 'informativo',
      },
    },
  ],
});
// Último vagão da composição é a "VG 4552" de cauda, já usada como referência de fim de
// composição em outras telas do protótipo.
vagoesJ614[vagoesJ614.length - 1] = {
  ...vagoesJ614[vagoesJ614.length - 1],
  veiculo: 'VG 4552',
  serie: 'VG',
};

/** Mock de "vagões a incluir" (ver `vagoesIncluir`, `FichaResumo`) — só o trem J614 tem, pra
 *  a seção nova (2026-08-31) ter conteúdo real pra mostrar. Formato `VagaoIncluir` (veículo/
 *  série/bloco só — sem origem/destino/mercadoria/restrição, ver comentário no tipo). */
const vagoesIncluirJ614: VagaoIncluir[] = [
  { veiculo: '701801-2', serie: 'PED', bloco: 'Bloco A' },
  { veiculo: '701808-7', serie: 'PCD', bloco: 'Bloco A' },
  { veiculo: '701815-2', serie: 'HFE', bloco: 'Bloco A' },
  { veiculo: '701822-8', serie: 'HPD', bloco: 'Bloco B' },
  { veiculo: '701839-2', serie: 'PED', bloco: 'Bloco B' },
  { veiculo: '701846-7', serie: 'PCD', bloco: 'Bloco B' },
];

/**
 * `fichasMock` exportado abaixo fica filtrado pelos trens de `TRENS_ATIVOS` (`trensAtivos.ts`).
 * Os demais trens continuam todos aqui, intactos, só fora das telas — pra voltar um trem, é só
 * incluí-lo naquela lista.
 */
const TODAS_AS_FICHAS_MOCK: FichaMock[] = [
  {
    id: 'f-j105',
    trem: 'J105',
    os: '50092901',
    patioNome: 'Hélio Torres',
    data: HOJE,
    recebidoEm: '05:58',
    eta: '17:40',
    // 3 locomotivas (S7B 8442-6/8439-6/8443-6), 92 vagões — mesma composição do Plano de Manobra
    // v3 deste trem (`J105/plano-manobra-j105-v3.html`, `planosManobraMock.J105`); os 5 vagões
    // `aRetirar` abaixo são os MESMOS avariados citados nos passos daquele plano (pedido
    // explícito de consistência entre telas, mesmo critério dos demais trens).
    vagoes: gerarComposicao({
      locomotivas: ['S7B 8442-6', 'S7B 8439-6', 'S7B 8443-6'],
      origem: 'EHT',
      destino: 'EBJ',
      totalVagoes: 92,
      seed: 105,
      vagoesFixos: [
        {
          posicao: 8,
          dados: {
            veiculo: 'HFE 705327-4',
            serie: 'HFE',
            restricaoConsolidada: 'Avariado — retirada de composição',
            tipoRestricao: 'bloqueio',
            reterSap: true,
            aRetirar: true,
            motivoRetirada: 'Avariado',
          },
        },
        {
          posicao: 9,
          dados: {
            veiculo: 'HFE 705328-2',
            serie: 'HFE',
            restricaoConsolidada: 'Avariado — retirada de composição',
            tipoRestricao: 'bloqueio',
            reterSap: true,
            aRetirar: true,
            motivoRetirada: 'Avariado',
          },
        },
        {
          posicao: 45,
          dados: {
            veiculo: 'HPD 342663-7',
            serie: 'HPD',
            restricaoConsolidada: 'Avariado — retirada de composição',
            tipoRestricao: 'bloqueio',
            reterSap: true,
            aRetirar: true,
            motivoRetirada: 'Avariado',
          },
        },
        {
          posicao: 55,
          dados: {
            veiculo: 'HFE 253578-5',
            serie: 'HFE',
            restricaoConsolidada: 'Avariado — retirada de composição',
            tipoRestricao: 'bloqueio',
            reterSap: true,
            aRetirar: true,
            motivoRetirada: 'Avariado',
          },
        },
        {
          posicao: 56,
          dados: {
            veiculo: 'HFE 253577-7',
            serie: 'HFE',
            restricaoConsolidada: 'Avariado — retirada de composição',
            tipoRestricao: 'bloqueio',
            reterSap: true,
            aRetirar: true,
            motivoRetirada: 'Avariado',
          },
        },
      ],
    }),
  },
  {
    id: 'f1',
    trem: 'J614',
    os: '9882/2026',
    patioNome: 'Hélio Torres',
    data: HOJE,
    recebidoEm: '06:42',
    eta: '18:50',
    vagoes: vagoesJ614,
    vagoesIncluir: vagoesIncluirJ614,
  },
  {
    id: 'f2',
    trem: 'R045',
    os: '9915/2026',
    patioNome: 'Hélio Torres',
    data: HOJE,
    recebidoEm: '07:15',
    eta: '19:20',
    // 2 locomotivas (Bloco A/Bloco B) — mesma divisão do Plano de Manobra deste trem
    // (`planosManobraMock.R045`, `planoManobra.ts`); os vagões marcados `aRetirar` abaixo são os
    // MESMOS retirados nos Grupos daquele plano (pedido explícito de consistência entre telas).
    vagoes: gerarComposicao({
      locomotivas: ['GT46-0148', 'GT46-0149'],
      origem: 'EPW',
      destino: 'ETB',
      totalVagoes: 82,
      seed: 22,
      vagoesFixos: [
        {
          posicao: 15,
          dados: {
            veiculo: 'VG-91017',
            serie: 'VG',
            restricaoConsolidada: 'Restrição de carga — capacidade reduzida em 15%',
            tipoRestricao: 'atencao',
            reterSap: true,
            aRetirar: true,
            motivoRetirada: 'Restrição de Carga',
            notasSap: [
              {
                equipamento: 'VG-91017',
                nota: '45410',
                ordem: '80231488',
                descricao: 'Estrutura do estrado com corrosão — carga limitada até reparo',
                data: '22/05/2026',
              },
            ],
          },
        },
        {
          posicao: 30,
          dados: {
            veiculo: 'VG-91023',
            serie: 'VG',
            restricaoConsolidada: 'Pendência de inspeção periódica — verificar antes da liberação',
            tipoRestricao: 'verificar',
            aRetirar: true,
            motivoRetirada: 'Pendência de Inspeção',
          },
        },
        {
          posicao: 45,
          dados: {
            veiculo: 'VG-91050',
            serie: 'VG',
            restricaoConsolidada: 'Aguardando tração — impedido de seguir viagem',
            tipoRestricao: 'bloqueio',
            reterSap: true,
            aRetirar: true,
            motivoRetirada: 'Ag Tração',
          },
        },
      ],
    }),
  },
  {
    id: 'f3',
    trem: 'J300',
    os: '9931/2026',
    patioNome: 'Hélio Torres',
    data: '2026-08-23',
    recebidoEm: '07:50',
    eta: '19:45',
    // 2 locomotivas (Bloco A/Bloco B) — mesma divisão do Plano de Manobra deste trem
    // (`planosManobraMock.J300`); vagões `aRetirar` abaixo são os MESMOS retirados nos Grupos.
    vagoes: gerarComposicao({
      locomotivas: ['GT46-0155', 'GT46-0156'],
      origem: 'EPW',
      destino: 'ETB',
      totalVagoes: 80,
      seed: 33,
      vagoesFixos: [
        {
          posicao: 12,
          dados: {
            veiculo: 'VG-77318',
            serie: 'VG',
            restricaoConsolidada: 'Roda com desgaste acima do limite',
            tipoRestricao: 'bloqueio',
            reterSap: true,
            hollowFriso: 'Hollow acima do limite — roda traseira direita',
            aRetirar: true,
            motivoRetirada: 'Roda com Desgaste',
            notasSap: [
              {
                equipamento: 'VG-77318',
                nota: '45260',
                ordem: '80231470',
                descricao: 'Desgaste hollow acima do limite normativo',
                data: '21/05/2026',
              },
            ],
          },
        },
        {
          posicao: 50,
          dados: {
            veiculo: 'VG-77455',
            serie: 'VG',
            restricaoConsolidada: 'Mangueira de freio com vazamento',
            tipoRestricao: 'atencao',
            reterSap: true,
            aRetirar: true,
            motivoRetirada: 'Mangueira de Freio',
            notasSap: [
              {
                equipamento: 'VG-77455',
                nota: '45280',
                ordem: '80231475',
                descricao: 'Vazamento de ar na mangueira de freio — reparo pendente',
                data: '21/05/2026',
              },
            ],
          },
        },
        {
          posicao: 65,
          dados: {
            veiculo: 'VG-77470',
            serie: 'VG',
            restricaoConsolidada: 'Etiqueta de campanha de manutenção preventiva — sem impacto operacional',
            tipoRestricao: 'informativo',
            aRetirar: true,
            motivoRetirada: 'Campanha Preventiva',
          },
        },
      ],
    }),
  },
  {
    id: 'f11',
    trem: 'J420',
    os: '9988/2026',
    patioNome: 'Hélio Torres',
    data: '2026-08-23',
    recebidoEm: '08:05',
    eta: '20:05',
    // 3 locomotivas (Bloco A/B/C) — mesma divisão do Plano de Manobra deste trem
    // (`planosManobraMock.J420`); vagões `aRetirar` abaixo são os MESMOS retirados nos Grupos.
    vagoes: gerarComposicao({
      locomotivas: ['GT46-0330', 'GT46-0331', 'GT46-0332'],
      origem: 'EPW',
      destino: 'ETB',
      totalVagoes: 78,
      seed: 111,
      vagoesFixos: [
        {
          posicao: 25,
          dados: {
            veiculo: 'VG-95511',
            serie: 'VG',
            restricaoConsolidada: 'Ruído anormal no rolamento — monitorar durante o trajeto',
            tipoRestricao: 'alerta',
            aRetirar: true,
            motivoRetirada: 'Ruído no Rolamento',
          },
        },
        {
          posicao: 35,
          dados: {
            veiculo: 'VG-95560',
            serie: 'VG',
            restricaoConsolidada: 'Sensor de temperatura do rodeiro com falha',
            tipoRestricao: 'atencao',
            reterSap: true,
            aRetirar: true,
            motivoRetirada: 'Falha no Sensor',
            notasSap: [
              {
                equipamento: 'VG-95560',
                nota: '46102',
                ordem: '80231512',
                descricao: 'Sensor de temperatura sem leitura — bloqueado até substituição',
                data: '23/05/2026',
              },
            ],
          },
        },
        {
          posicao: 60,
          dados: {
            veiculo: 'VG-95610',
            serie: 'VG',
            restricaoConsolidada: 'Mangueira de freio com vazamento',
            tipoRestricao: 'bloqueio',
            reterSap: true,
            aRetirar: true,
            motivoRetirada: 'Mangueira de Freio',
            notasSap: [
              {
                equipamento: 'VG-95610',
                nota: '46150',
                ordem: '80231520',
                descricao: 'Vazamento de ar na mangueira de freio — reparo pendente',
                data: '24/05/2026',
              },
            ],
          },
        },
      ],
    }),
  },
  {
    id: 'f12',
    trem: 'R150',
    os: '9990/2026',
    patioNome: 'Hélio Torres',
    data: '2026-08-22',
    recebidoEm: '08:20',
    eta: '20:20',
    // 2 locomotivas (Bloco A/Bloco B) — mesma divisão do Plano de Manobra deste trem
    // (`planosManobraMock.R150`); vagões `aRetirar` abaixo são os MESMOS retirados nos Grupos.
    vagoes: gerarComposicao({
      locomotivas: ['GT46-0512', 'GT46-0513'],
      origem: 'EPW',
      destino: 'ETB',
      totalVagoes: 84,
      seed: 122,
      vagoesFixos: [
        {
          posicao: 8,
          dados: {
            veiculo: 'VG-96204',
            serie: 'VG',
            restricaoConsolidada: 'Mangueira de freio danificada',
            tipoRestricao: 'bloqueio',
            reterSap: true,
            aRetirar: true,
            motivoRetirada: 'Mangueira de Freio',
            notasSap: [
              {
                equipamento: 'VG-96204',
                nota: '45602',
                ordem: '80231540',
                descricao: 'Mangueira de freio com ruptura — troca obrigatória antes da liberação',
                data: '24/05/2026',
              },
            ],
          },
        },
        {
          posicao: 40,
          dados: {
            veiculo: 'VG-96240',
            serie: 'VG',
            restricaoConsolidada: 'Etiqueta de campanha de manutenção preventiva — sem impacto operacional',
            tipoRestricao: 'informativo',
            aRetirar: true,
            motivoRetirada: 'Campanha Preventiva',
          },
        },
        {
          posicao: 55,
          dados: {
            veiculo: 'VG-96410',
            serie: 'VG',
            restricaoConsolidada: 'Avaria em rodeiro — cuidado ao manobrar',
            tipoRestricao: 'bloqueio',
            reterSap: true,
            aRetirar: true,
            motivoRetirada: 'Avaria em Rodeiro',
            notasSap: [
              {
                equipamento: 'VG-96410',
                nota: '45640',
                ordem: '80231550',
                descricao: 'Avaria em rodeiro — desgaste hollow acima do limite',
                data: '24/05/2026',
              },
            ],
          },
        },
        {
          posicao: 70,
          dados: {
            veiculo: 'VG-96450',
            serie: 'VG',
            restricaoConsolidada: 'Pendência de inspeção periódica — verificar antes da liberação',
            tipoRestricao: 'verificar',
            aRetirar: true,
            motivoRetirada: 'Pendência de Inspeção',
          },
        },
      ],
    }),
  },
  {
    id: 'f13',
    trem: 'J275',
    os: '9993/2026',
    patioNome: 'Hélio Torres',
    data: '2026-08-22',
    recebidoEm: '08:35',
    eta: '20:40',
    // 2 locomotivas (Bloco A/Bloco B) — mesma divisão do Plano de Manobra deste trem
    // (`planosManobraMock.J275`); vagões `aRetirar` abaixo são os MESMOS retirados nos Grupos.
    vagoes: gerarComposicao({
      locomotivas: ['GT46-0087', 'GT46-0088'],
      origem: 'EPW',
      destino: 'ETB',
      totalVagoes: 76,
      seed: 133,
      vagoesFixos: [
        {
          posicao: 10,
          dados: {
            veiculo: 'VG-85110',
            serie: 'VG',
            restricaoConsolidada: 'Roda com desgaste acima do limite',
            tipoRestricao: 'bloqueio',
            reterSap: true,
            hollowFriso: 'Hollow acima do limite — roda dianteira direita',
            aRetirar: true,
            motivoRetirada: 'Roda com Desgaste',
            notasSap: [
              {
                equipamento: 'VG-85110',
                nota: '45700',
                ordem: '80231560',
                descricao: 'Desgaste hollow acima do limite normativo',
                data: '25/05/2026',
              },
            ],
          },
        },
        {
          posicao: 50,
          dados: {
            veiculo: 'VG-85260',
            serie: 'VG',
            restricaoConsolidada: 'Restrição de velocidade — eixo trincado',
            tipoRestricao: 'atencao',
            reterSap: true,
            aRetirar: true,
            motivoRetirada: 'Eixo Trincado',
            notasSap: [
              {
                equipamento: 'VG-85260',
                nota: '45705',
                ordem: '80231561',
                descricao: 'Trinca em eixo — restrição de 40km/h até substituição',
                data: '25/05/2026',
              },
            ],
          },
        },
      ],
    }),
  },
  {
    id: 'f14',
    trem: 'R088',
    os: '9996/2026',
    patioNome: 'Hélio Torres',
    data: '2026-08-21',
    recebidoEm: '08:50',
    eta: '21:05',
    // 3 locomotivas (Bloco A/B/C) — mesma divisão do Plano de Manobra deste trem
    // (`planosManobraMock.R088`); vagões `aRetirar` abaixo são os MESMOS retirados nos Grupos.
    vagoes: gerarComposicao({
      locomotivas: ['GT46-0640', 'GT46-0641', 'GT46-0642'],
      origem: 'EPW',
      destino: 'ETB',
      totalVagoes: 81,
      seed: 144,
      vagoesFixos: [
        {
          posicao: 10,
          dados: {
            veiculo: 'VG-97210',
            serie: 'VG',
            restricaoConsolidada: 'Mangueira de freio danificada',
            tipoRestricao: 'bloqueio',
            reterSap: true,
            aRetirar: true,
            motivoRetirada: 'Mangueira de Freio',
            notasSap: [
              {
                equipamento: 'VG-97210',
                nota: '45810',
                ordem: '80231570',
                descricao: 'Mangueira de freio com ruptura — troca obrigatória antes da liberação',
                data: '25/05/2026',
              },
            ],
          },
        },
        {
          posicao: 33,
          dados: {
            veiculo: 'VG-97318',
            serie: 'VG',
            restricaoConsolidada: 'Pendência de inspeção periódica — verificar antes da liberação',
            tipoRestricao: 'verificar',
            aRetirar: true,
            motivoRetirada: 'Pendência de Inspeção',
          },
        },
        {
          posicao: 65,
          dados: {
            veiculo: 'VG-97460',
            serie: 'VG',
            restricaoConsolidada: 'Ruído anormal no rolamento — monitorar durante o trajeto',
            tipoRestricao: 'alerta',
            aRetirar: true,
            motivoRetirada: 'Ruído no Rolamento',
          },
        },
      ],
    }),
  },
  {
    id: 'f4',
    trem: 'J602',
    os: '9840/2026',
    patioNome: 'Hélio Torres',
    // 2026-08-26, pedido explícito do usuário: "os outros trens ali no mapa, precisam ser
    // representados como um trem a ser selecionado também" — os trens de fundo do pátio EHT
    // (`mocks/eht.ts`, `composicaoFundo`) precisam de uma entrada selecionável "de hoje" pra
    // aparecer na lista/seletor (ver `TREM_MOCK_RICO` abaixo e `POSICAO_TREM_CONHECIDO`,
    // `planoTopologiaAdapter.ts`) — data original (24/05) trocada por `HOJE` só pra isso.
    data: HOJE,
    recebidoEm: '06:50',
    eta: '17:30',
    vagoes: gerarComposicao({
      locomotivas: ['GT46-0109'],
      origem: 'EPW',
      destino: 'ETB',
      totalVagoes: 78,
      seed: 44,
    }),
  },
  {
    id: 'f5',
    trem: 'R039',
    os: '9855/2026',
    patioNome: 'Hélio Torres',
    // Mesma razão de `J602` acima.
    data: HOJE,
    recebidoEm: '07:30',
    eta: '18:10',
    vagoes: gerarComposicao({
      locomotivas: ['GT46-0121'],
      origem: 'EPW',
      destino: 'ETB',
      totalVagoes: 76,
      seed: 55,
      vagoesFixos: [
        {
          posicao: 20,
          dados: {
            veiculo: 'VG-70344',
            serie: 'VG',
            restricaoConsolidada: 'Mangueira de freio danificada',
            tipoRestricao: 'bloqueio',
            reterSap: true,
            notasSap: [
              {
                equipamento: 'VG-70344',
                nota: '44980',
                ordem: '80231390',
                descricao: 'Mangueira de freio com ruptura — troca obrigatória antes da liberação',
                data: '17/05/2026',
              },
            ],
          },
        },
      ],
    }),
  },
  {
    id: 'f6',
    trem: 'J588',
    os: '9801/2026',
    patioNome: 'Hélio Torres',
    // Mesma razão de `J602` acima.
    data: HOJE,
    recebidoEm: '06:38',
    eta: '17:00',
    vagoes: gerarComposicao({
      locomotivas: ['GT46-0102'],
      origem: 'EPW',
      destino: 'ETB',
      totalVagoes: 74,
      seed: 66,
    }),
  },
  {
    id: 'f7',
    trem: 'J410',
    os: '9960/2026',
    patioNome: 'Imperatriz',
    data: HOJE,
    recebidoEm: '07:05',
    eta: '21:20',
    vagoes: gerarComposicao({
      locomotivas: ['GT46-0201'],
      origem: 'IMZ',
      destino: 'ACL',
      totalVagoes: 81,
      seed: 77,
      vagoesFixos: [
        {
          posicao: 18,
          dados: {
            veiculo: 'VG-82029',
            serie: 'VG',
            restricaoConsolidada: 'Sensor de temperatura do rodeiro com falha',
            tipoRestricao: 'atencao',
            reterSap: true,
            notasSap: [
              {
                equipamento: 'VG-82029',
                nota: '46102',
                ordem: '80231512',
                descricao: 'Sensor de temperatura sem leitura — bloqueado até substituição',
                data: '23/05/2026',
              },
            ],
          },
        },
        {
          posicao: 35,
          dados: {
            veiculo: numeroVeiculo(77, 35),
            serie: 'HFE',
            restricaoConsolidada: 'Etiqueta de campanha de manutenção preventiva — sem impacto operacional',
            tipoRestricao: 'informativo',
          },
        },
      ],
    }),
  },
  {
    id: 'f8',
    trem: 'R210',
    os: '9944/2026',
    patioNome: 'Imperatriz',
    data: '2026-05-24',
    recebidoEm: '06:55',
    eta: '19:00',
    vagoes: gerarComposicao({
      locomotivas: ['GT46-0198'],
      origem: 'IMZ',
      destino: 'ACL',
      totalVagoes: 79,
      seed: 88,
    }),
  },
  {
    id: 'f9',
    trem: 'J512',
    os: '9971/2026',
    patioNome: 'Ribeirão',
    data: HOJE,
    recebidoEm: '07:20',
    eta: '21:50',
    vagoes: gerarComposicao({
      locomotivas: ['GT46-0311'],
      origem: 'RBR',
      destino: 'BTM',
      totalVagoes: 83,
      seed: 99,
      vagoesFixos: [
        {
          posicao: 22,
          dados: {
            veiculo: 'VG-93158',
            serie: 'VG',
            restricaoConsolidada: 'Pendência de inspeção periódica — verificar antes da liberação',
            tipoRestricao: 'verificar',
          },
        },
      ],
    }),
  },
  {
    id: 'f10',
    trem: 'R318',
    os: '9902/2026',
    patioNome: 'Ribeirão',
    data: '2026-05-23',
    recebidoEm: '06:45',
    eta: '18:30',
    vagoes: gerarComposicao({
      locomotivas: ['GT46-0287'],
      origem: 'RBR',
      destino: 'BTM',
      totalVagoes: 77,
      seed: 100,
      vagoesFixos: [
        {
          posicao: 10,
          dados: {
            veiculo: 'VG-92890',
            serie: 'VG',
            restricaoConsolidada: 'Mangueira de freio com vazamento',
            tipoRestricao: 'atencao',
            reterSap: true,
            notasSap: [
              {
                equipamento: 'VG-92890',
                nota: '45877',
                ordem: '80231499',
                descricao: 'Vazamento de ar na mangueira de freio — reparo pendente',
                data: '22/05/2026',
              },
            ],
          },
        },
      ],
    }),
  },
  // 2026-08-26, pedido explícito do usuário — mesma razão do comentário em `J602` acima: trens
  // "de fundo" do pátio EHT (`eht-fundo-L2-1`/`L3-0`/`L3-1`/`L5-0`, `mocks/eht.ts`) que não
  // tinham NENHUMA ficha própria (diferente de J602/R039/J588, que já existiam noutra data e só
  // precisaram trocar pra `HOJE`) — sem manobra/restrição elaborada, só o básico pra aparecer na
  // lista e ter uma Ficha Operacional simples de aprovar.
  {
    id: 'f15',
    trem: 'J640',
    os: '9773/2026',
    patioNome: 'Hélio Torres',
    data: HOJE,
    recebidoEm: '07:10',
    eta: '19:40',
    vagoes: gerarComposicao({ locomotivas: ['GT46-0155'], origem: 'EPW', destino: 'ETB', totalVagoes: 72, seed: 141 }),
  },
  {
    id: 'f16',
    trem: 'J356',
    os: '9784/2026',
    patioNome: 'Hélio Torres',
    data: HOJE,
    recebidoEm: '06:42',
    eta: '18:35',
    vagoes: gerarComposicao({ locomotivas: ['GT46-0163'], origem: 'EPW', destino: 'ETB', totalVagoes: 68, seed: 152 }),
  },
  {
    id: 'f17',
    trem: 'R073',
    os: '9791/2026',
    patioNome: 'Hélio Torres',
    data: HOJE,
    recebidoEm: '07:45',
    eta: '20:05',
    vagoes: gerarComposicao({ locomotivas: ['GT46-0174'], origem: 'EPW', destino: 'ETB', totalVagoes: 80, seed: 163 }),
  },
  {
    id: 'f18',
    trem: 'R512',
    os: '9762/2026',
    patioNome: 'Hélio Torres',
    data: HOJE,
    recebidoEm: '06:28',
    eta: '18:15',
    vagoes: gerarComposicao({ locomotivas: ['GT46-0182'], origem: 'EPW', destino: 'ETB', totalVagoes: 71, seed: 174 }),
  },
];



// ---------------------------------------------------------------------------------------
// Conversão mock → modelo neutro
// ---------------------------------------------------------------------------------------

const IMPORTACAO_J105 = interpretarPlanilha(planilhaJ105 as PlanilhaBruta);

/** Estado do pátio Hélio Torres no momento do relatório real — compartilhado pelas fichas
 *  mockadas do mesmo pátio (o pátio é um só; só o trem muda). */
const PATIO_HELIO_TORRES = {
  patioVagoes: IMPORTACAO_J105.leitura.patioVagoes,
  patioLocomotivas: IMPORTACAO_J105.leitura.patioLocomotivas,
  situacaoVagoes: IMPORTACAO_J105.leitura.situacaoVagoes,
  contextoPatio: IMPORTACAO_J105.leitura.contextoPatio,
};

const CODIGO_POR_TIPO: Record<TipoRestricao, string> = {
  bloqueio: 'BLOQUEIO', atencao: 'ATENCAO', alerta: 'ALERTA', verificar: 'VERIFICAR', informativo: 'INFORMATIVO',
};

function mockParaLeitura(f: FichaMock): DadosFichaLeitura {
  const ehLoco = (v: VagaoMock) => v.serie === 'DASH-9';
  const composicao: VeiculoComposicao[] = f.vagoes.map((v, i) => ({
    posicao: i + 1,
    tipo: ehLoco(v) ? 'locomotiva' : 'vagao',
    serie: v.serie,
    numero: v.veiculo,
    bloco: v.bloco ?? 'Bloco A',
    origem: v.origem || undefined,
    destino: v.destino || undefined,
    mercadoria: v.mercadoria || undefined,
    pesoBrutoT: ehLoco(v) ? 196 : ['PCD', 'PED'].includes(v.serie) ? 98 : 22,
    bruto: [
      { coluna: 'Sér', valor: v.serie },
      { coluna: 'Seq. VALE', valor: v.seqVale ? String(v.seqVale) : '' },
      { coluna: 'Seq. FCA', valor: v.seqFca ? String(v.seqFca) : '' },
      { coluna: 'Volta', valor: v.volta ? String(v.volta) : '' },
      { coluna: 'Hollow + Friso', valor: v.hollowFriso ?? '' },
    ],
  }));
  const primeiro = f.vagoes.find((v) => !ehLoco(v));
  return {
    cabecalho: { trem: f.trem, os: f.os, origem: primeiro?.origem ?? '', destino: primeiro?.destino ?? '' },
    composicao,
    totais: { ...totaisDaComposicao(composicao), comprimentoM: Math.round(composicao.length * 16.1) },
    restricoes: f.vagoes
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v.tipoRestricao)
      .map(({ v, i }) => ({
        posicao: i + 1,
        serie: v.serie,
        numero: v.veiculo,
        codigo: CODIGO_POR_TIPO[v.tipoRestricao!],
        observacao: v.restricaoConsolidada || TIPO_RESTRICAO_LABEL[v.tipoRestricao!],
        notasSap: v.notasSap,
      })),
    ...(f.patioNome === 'Hélio Torres'
      ? PATIO_HELIO_TORRES
      : { patioVagoes: [], patioLocomotivas: [], situacaoVagoes: [] }),
  };
}

function mockParaAcoes(f: FichaMock): AcoesOperacionais {
  const acoes = acoesVazias();
  f.vagoes.forEach((v, i) => {
    if (v.aRetirar) acoes.retiradas.push({ id: novoIdAcao('ret'), numero: v.veiculo, serie: v.serie, posicao: i + 1, motivo: v.motivoRetirada ?? '', observacao: '' });
  });
  const porBloco = new Map<string, number>();
  (f.vagoesIncluir ?? []).forEach((v) => porBloco.set(v.bloco ?? 'Bloco A', (porBloco.get(v.bloco ?? 'Bloco A') ?? 0) + 1));
  porBloco.forEach((quantidade, bloco) => acoes.inclusoes.push({ id: novoIdAcao('inc'), bloco, quantidade, serie: '', observacao: '' }));
  return acoes;
}

function acoesJ105(): AcoesOperacionais {
  // O modelo real não traz motivo; os 5 são os avariados do Plano de Manobra do J105.
  return {
    retiradas: IMPORTACAO_J105.acoes.retiradas.map((r) => ({ ...r, id: novoIdAcao('ret'), motivo: r.motivo || 'Avariado' })),
    inclusoes: IMPORTACAO_J105.acoes.inclusoes.map((inc) => ({ ...inc, id: novoIdAcao('inc') })),
  };
}

// J105-V2 não tem mock próprio: nasce do J105 em `fichasDoMock`.
// O mock do J105 entra mesmo fora de TRENS_ATIVOS: é a origem da ficha do J105-V2.
const MOCKS_VISIVEIS = TODAS_AS_FICHAS_MOCK.filter((f) => TRENS_ATIVOS.includes(f.trem) || f.trem === 'J105');

/** J105 V2 — mesmo trem físico do J105 (mesma leitura), registro próprio de ações. */
function fichasDoMock(f: FichaMock): FichaResumo[] {
  const { vagoes: _v, vagoesIncluir: _i, ...identidade } = f;
  if (f.trem !== 'J105') {
    registrarDadosFicha(f.id, mockParaLeitura(f));
    return [{ ...identidade, acoes: mockParaAcoes(f), correcoes: correcoesVazias() }];
  }
  registrarDadosFicha(f.id, IMPORTACAO_J105.leitura);
  registrarDadosFicha('f-j105-v2', IMPORTACAO_J105.leitura);
  // V2 traz também inclusões de exemplo (a leitura real do J105 não tem nenhuma), pra a Ficha
  // Operacional mostrar os dois tipos de ação do operador — retirada e inclusão.
  const acoesV2 = acoesJ105();
  acoesV2.inclusoes.push(
    { id: novoIdAcao('inc'), bloco: 'Bloco B', quantidade: 3, serie: '', observacao: '' },
    { id: novoIdAcao('inc'), bloco: 'Bloco C', quantidade: 2, serie: 'HFE', observacao: '' },
  );
  const v2: FichaResumo = { ...identidade, id: 'f-j105-v2', trem: TREM_J105_V2, os: '50092902', recebidoEm: '06:05', acoes: acoesV2, correcoes: correcoesVazias() };
  // Só o V2 aparece — o J105 antigo saiu das telas (2026-09-29, pedido explícito do usuário).
  return [v2];
}

export const fichasMock: FichaResumo[] = MOCKS_VISIVEIS.flatMap(fichasDoMock);
