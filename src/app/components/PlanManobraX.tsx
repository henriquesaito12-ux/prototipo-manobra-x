import { rotuloTrem, tremDesabilitado } from '../data/trensAtivos';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ChevronDown,
  Clock,
  Flag,
  MapPin,
  Ruler,
  User,
  ClipboardCheck,
  FileText,
  Info,
  Loader2,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Train,
  Trash2,
  Users,
} from 'lucide-react';
import {
  TIPO_ETAPA_LABEL,
  TIPO_ETAPA_RESPONSAVEL,
  planosManobraMock,
  planoFallback,
  duracaoClusterMin,
  formatarDuracaoMin,
  clusterMaisCritico,
  metricasGeraisPlano,
  type BlocoManobra,
  type ClusterManobra,
  type EtapaManobra,
  type ItemComposicao,
  type MetricasGeraisPlano,
  type PlanoManobra,
  type RotaManobra,
} from '../data/planoManobra';
import { fichasMock } from '../data/fichaOperacao';
import { DURACAO_TOTAL_J105, TREM_J105_V2, formatarRelogioJ105 } from '../data/animacaoJ105';
import { fichaPassoJ105V2, type FichaPassoJ105V2 } from '../data/fichaPassosJ105V2';
import { passoDoEtapaId } from '../data/visualJ105';
import { COMPOSICAO_GERAL_J105_V2, metricasGeraisJ105V2, type BlocoComposicaoGeralJ105V2 } from '../data/composicaoGeralJ105V2';
import { SecaoCartao, HeaderTooltip } from './PageHeader';
import LogoVLI from '../../imports/Logo_VLI.svg';

const VLI_PRIMARY_TEXT = 'var(--vli-primary-text)';
const VLI_PRIMARY_SOLID = 'var(--vli-primary)';
const PANEL_BG   = 'var(--vli-panel-bg)';
const SURFACE    = 'var(--vli-surface)';
const BORDER     = 'var(--vli-border)';
const TEXT_HI    = 'var(--vli-text-hi)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
const SUCCESS_TEXT = 'var(--vli-success-text)';
// `--vli-wagon-incluido-bg`/`--vli-wagon-retirado-bg` (não `--vli-success-bg`/`--vli-danger-bg`,
// o véu de aviso genérico) — 2026-08-27, pedido explícito do usuário: fundo dedicado do chip
// `TagVagao` (vagão a retirar/incluir), com hex exatos por tema; cor/borda continuam em
// `SUCCESS_TEXT`/`DANGER_TEXT` ("a border pode manter o mesmo tom").
const SUCCESS_BG    = 'var(--vli-wagon-incluido-bg)';
const WARNING_TEXT = 'var(--vli-warning-text)';
const WARNING_BG    = 'var(--vli-warning-bg)';
const DANGER_TEXT  = 'var(--vli-danger-text)';
const DANGER_BG    = 'var(--vli-wagon-retirado-bg)';
const HOVER_TINT   = 'var(--vli-hover-tint)';
const FONT       = 'Manrope, sans-serif';
const RADIUS     = '0.375rem';
const BLOCO_HEADER_H = '3.4375rem';
const LIST_W     = '9.5rem';

/**
 * Todas as ações de edição do plano, reunidas num só objeto. O plano é sempre editável direto
 * na tela (sem modal, sem modo de edição para ligar/desligar); cada ação já aplica a mudança de
 * verdade no plano do trem selecionado. Se o resultado não for o desejado, o operador tem o
 * botão "Voltar ao Plano Sugerido" para descartar tudo e recomeçar da sugestão original.
 * Escopo deliberadamente restrito: a composição (retirado/incluído), a descrição de cada etapa e
 * a sequência de um Grupo já foram decididas pelo plano e não são editáveis aqui — só a
 * estrutura de Grupos do Bloco (criar/remover) permanece ajustável.
 */
interface EditorPlano {
  adicionarGrupo: (blocoId: string) => void;
  removerGrupo: (blocoId: string, clusterId: string) => void;
}

interface PlanManobraXProps {
  trenSelecionado: string;
  onSelecionarTrem: (trem: string) => void;
  /** Data do turno mostrada no header (dropdown ao lado do pátio) — filtra a barra de seleção
   *  de trem, igual à Ficha de Operação. */
  dataSelecionada: string;
  statusFichaPorTrem?: Record<string, { pendente: boolean; fichaId: string }>;
  onRevisarFicha?: (trem: string) => void;
  /** Ações do trem selecionado — vivem aqui, no header do trem/OS, ao lado do "Editar". */
  onAjustarParametros?: () => void;
  /** "Confirmar Plano"/"Imprimir" — ao lado de "Ver Ficha", no header do trem/OS (mesmo
   *  handler recebido pela tela de Planejamento; só a posição na tela mudou). */
  onImprimirPlano?: () => void;
  onConfirmarPlano?: () => void;
  planoConfirmado?: boolean;
  /** Bloco/Grupo com destaque sincronizado na Visão Topológica (`PlanejamentoScreen.tsx`) —
   *  `null`/ausente = nenhuma seleção. */
  destaque?: DestaquePlano | null;
  onDestaqueChange?: (next: DestaquePlano | null) => void;
  /** Conjunto de ids de veículo(s) atualmente selecionados (toggle) na "Composição Geral do Trem
   *  — Antes/Depois" (`ComposicaoGeralSecao`) — ver doc completa em `veiculosFoco`,
   *  `PlanejamentoScreen.tsx`. Usado aqui só pra saber quais chips (`TagVagao`) desenhar como
   *  selecionados; `undefined`/conjunto vazio = nenhum. */
  veiculosFoco?: Set<string> | null;
  /** Clicar num vagão/locomotiva na coluna "Antes" da "Composição Geral do Trem — Antes/Depois"
   *  (`ComposicaoGeralSecao` — "Depois" não é clicável, ver `LinhaBlocoComposicao`) — 2026-08-27,
   *  pedido explícito do usuário: "se eu clicar em algum vagão, ou locomotiva, ele deve ancorar no
   *  mapa mostrando esse vagão específico", refinado em seguida: "ao clicar, ele deve se manter
   *  selecionado, podendo clicar novamente pra deselecionar... eu posso ir selecionando mais de
   *  um". Faz TOGGLE (o chamador, `PlanejamentoScreen.tsx`, decide add/remove no `Set` de
   *  `veiculosFoco` — este componente não sabe de seleção, só relata o clique) — por isso um
   *  callback à parte de `onDestaqueChange`, não mais um campo dentro de `DestaquePlano`. */
  onFocarVeiculo?: (veiculoId: string) => void;
  /** Botão "Limpar seleção" que aparece na `ComposicaoGeralSecao` assim que `veiculosFoco` deixa
   *  de estar vazio — 2026-08-28, pedido explícito do usuário: "sempre que eu começar a
   *  selecionar os vagões ou locomotivas, deve depois aparecer um botão de resetar... pra limpar
   *  tudo e voltar ao normal". Esvaziar o `Set` é decisão do chamador (`PlanejamentoScreen.tsx`,
   *  mesmo dono de `veiculosFoco`/`alternarFocoVeiculo`) — este componente só dispara. */
  onLimparFocoVeiculos?: () => void;
}

/** Espelho de `EtapaHighlight` (`Composition.tsx`) — mesmo shape nos campos que o mapa lê (cópia
 *  deliberada, não import, pra este arquivo não se acoplar ao motor de mapa), mais `etapaId`:
 *  campo EXTRA, só deste lado — o mapa não precisa saber qual etapa gerou o destaque, só a
 *  geometria; o painel precisa do id pra saber qual cartão pintar como ativo (ver
 *  `GrupoAccordionItem`). Excesso de campo não quebra a compatibilidade estrutural com
 *  `CompositionHighlight` do lado do mapa (o mapa só lê os campos que declara usar). Hoje PARADA,
 *  CORTE e CLEAR têm destaque próprio no mapa (ver `EtapaParadaLayer.tsx`/`EtapaCorteLayer.tsx`). */
export interface EtapaHighlightParadaPlano {
  etapaId: string;
  tipo: 'PARADA';
  linha: string;
  referencia?: string;
  direcao?: string;
  distanciaM: number;
}

/** Corte não desloca a composição — `distanciaM` aqui é `apoio.posCabecaM` da PRÓPRIA etapa
 *  (sempre um pouco antes do `distanciaM` da Parada-irmã), não uma distância percorrida.
 *  `referenciaM` é a posição FIXA do rótulo T1/T2/T3... — sempre o `distanciaM` da Parada-irmã
 *  (resolvida aqui do mesmo jeito que `origemM` do Clear), nunca a posição do marcador de ação —
 *  ver `EtapaHighlightCorte` no mapa. */
export interface EtapaHighlightCortePlano {
  etapaId: string;
  tipo: 'CORTE';
  linha: string;
  referencia?: string;
  direcao?: string;
  distanciaM: number;
  referenciaM: number;
  vagoes: string[];
}

/** Clear TEM trajeto real (mesmo visual da Parada), mas não parte do zero da linha — `origemM` é
 *  a posição onde a composição já estava ao final da Parada/Corte deste Grupo (resolvida em
 *  `selecionarEtapa`, `GrupoAccordionItem`, a partir do `apoio.distanciaM` da etapa PARADA do
 *  cluster), `distanciaM` é o quanto se desloca a partir dali — ver `EtapaHighlightClear` no mapa. */
export interface EtapaHighlightClearPlano {
  etapaId: string;
  tipo: 'CLEAR';
  linha: string;
  referencia?: string;
  direcao?: string;
  origemM: number;
  distanciaM: number;
}

/** Rota 1 de Retirada (deslocamento inicial da locomotiva de manobra) — DIFERENTE das outras: não
 *  é a composição principal, é uma locomotiva separada numa linha própria (`linhaOrigem`) que
 *  muda de linha no meio do trajeto (reversão + travessão) até chegar no MESMO ponto onde o Clear
 *  já terminou (`destinoAbsolutoM`, resolvido em `selecionarRota` somando `distanciaM` da Parada
 *  + do Clear deste Grupo) — ver `EtapaHighlightRetirada` no mapa. `rotaIndex` identifica QUAL
 *  rota desta etapa está ativa (a etapa sozinha não basta — Retirada tem 2 rotas, cada uma com
 *  seu próprio destaque; hoje só a Rota 1 — `rotaIndex: 0` — é clicável, ver
 *  `rotaClicavelNoMapa`). */
export interface EtapaHighlightRetiradaPlano {
  etapaId: string;
  tipo: 'RETIRADA';
  rotaIndex: number;
  linhaOrigem: string;
  direcaoOrigem: string;
  distanciaOrigemM: number;
  travessaoLabel?: string;
  distanciaTravessaoM: number;
  linhaDestino: string;
  direcaoDestino: string;
  distanciaDestinoM: number;
  destinoAbsolutoM: number;
}

/** Rota 2 de Retirada (retirada até o destino) — parte do MESMO ponto onde a Rota 1 termina
 *  (`origemRota1`, os campos que `computeRetiradaRota1Geometry` usa pra resolver aquele ponto,
 *  reaproveitados aqui em vez de recalculados — pedido explícito do usuário, 2026-08-25:
 *  "reaproveite essa posição, não calcule um novo ponto"), cruza 2 travessões reais (T3 e BRANCH
 *  L4 FIM) até o destino final. Só 1 reversão, logo no início — tudo depois dela anda na MESMA
 *  direção, `direcaoPosReversao`. Mesmo shape de `EtapaHighlightRetiradaRota2`
 *  (`render/Composition.tsx`), sem acoplar este arquivo ao motor de mapa. */
export interface EtapaHighlightRetiradaRota2Plano {
  etapaId: string;
  tipo: 'RETIRADA';
  rotaIndex: number;
  direcaoOrigem: string;
  distanciaOrigemM: number;
  travessao1Label?: string;
  linhaMeio: string;
  distanciaMeioM: number;
  travessao2Label?: string;
  linhaFinal: string;
  distanciaFinalM: number;
  direcaoPosReversao: string;
  origemRota1: {
    linhaOrigem: string;
    direcaoOrigem: string;
    distanciaOrigemM: number;
    linhaDestino: string;
    direcaoDestino: string;
    distanciaDestinoM: number;
    destinoAbsolutoM: number;
  };
}

/** Rota 1 de Inclusão (deslocamento inicial da locomotiva) — parte do MESMO ponto onde a Rota 2 de
 *  Retirada termina (`origemRetiradaRota2`, os campos que `computeRetiradaRota2Geometry` usa pra
 *  resolver aquele ponto, reaproveitados aqui — pedido explícito do usuário, 2026-08-26: "essa
 *  rota continua de onde a última rota (Retirada — Rota 2) terminou... reaproveite esse ponto como
 *  origem, não calcule um novo"), cruza 1 travessão real (BRANCH L4 FIM) até o destino final. SEM
 *  reversão — mais simples que as rotas de Retirada, uma única direção o tempo todo. Mesmo shape
 *  de `EtapaHighlightInclusaoRota1` (`render/Composition.tsx`), sem acoplar este arquivo ao motor
 *  de mapa. */
export interface EtapaHighlightInclusaoRota1Plano {
  etapaId: string;
  tipo: 'INCLUSAO';
  rotaIndex: number;
  direcaoOrigem: string;
  distanciaOrigemM: number;
  travessaoLabel?: string;
  linhaDestino: string;
  distanciaDestinoM: number;
  vagoesIncluidos: string[];
  origemRetiradaRota2: {
    direcaoOrigem: string;
    distanciaOrigemM: number;
    linhaMeio: string;
    distanciaMeioM: number;
    linhaFinal: string;
    distanciaFinalM: number;
    direcaoPosReversao: string;
    origemRota1: {
      linhaOrigem: string;
      direcaoOrigem: string;
      distanciaOrigemM: number;
      linhaDestino: string;
      direcaoDestino: string;
      distanciaDestinoM: number;
      destinoAbsolutoM: number;
    };
  };
}

/** Rota 2 de Inclusão (inclusão até o destino) — parte do MESMO ponto onde a Rota 1 de Inclusão
 *  termina (`origemInclusaoRota1`, os campos que `computeInclusaoRota1Geometry` usa pra resolver
 *  aquele ponto, reaproveitados aqui — pedido explícito do usuário, 2026-08-26: "essa rota continua
 *  de onde a Rota 1 da Inclusão terminou... reaproveite esse ponto, não calcule um novo"), cruza 1
 *  travessão real (T3) e TERMINA de volta no MESMO ponto fixo onde a locomotiva partiu na Rota 1 de
 *  RETIRADA (fechamento do ciclo, não um ponto calculado a partir de `distanciaFinalM`). Mesmo
 *  shape de `EtapaHighlightInclusaoRota2` (`render/Composition.tsx`), sem acoplar este arquivo ao
 *  motor de mapa. */
export interface EtapaHighlightInclusaoRota2Plano {
  etapaId: string;
  tipo: 'INCLUSAO';
  rotaIndex: number;
  direcaoOrigem: string;
  distanciaOrigemM: number;
  travessaoLabel?: string;
  linhaFinal: string;
  distanciaFinalM: number;
  direcaoPosReversao: string;
  origemInclusaoRota1: {
    direcaoOrigem: string;
    distanciaOrigemM: number;
    linhaDestino: string;
    distanciaDestinoM: number;
    origemRetiradaRota2: {
      direcaoOrigem: string;
      distanciaOrigemM: number;
      linhaMeio: string;
      distanciaMeioM: number;
      linhaFinal: string;
      distanciaFinalM: number;
      direcaoPosReversao: string;
      origemRota1: {
        linhaOrigem: string;
        direcaoOrigem: string;
        distanciaOrigemM: number;
        linhaDestino: string;
        direcaoDestino: string;
        distanciaDestinoM: number;
        destinoAbsolutoM: number;
      };
    };
  };
}

/** FECHAMENTO (recuo final da composição) — parte do MESMO ponto onde a Rota 2 de Inclusão termina
 *  (`origemInclusaoRota2`, os campos que `computeInclusaoRota2Geometry` usa pra resolver aquele
 *  ponto, reaproveitados aqui — pedido explícito do usuário, 2026-08-26: "o mesmo ponto onde a
 *  última rota (Inclusão — Rota 2) terminou... reaproveite essa posição, não calcule uma nova"), e
 *  recua `distanciaM` na direção `direcao` (sentido oposto ao de chegada da última rota). Última
 *  etapa do ciclo do Grupo. Mesmo shape de `EtapaHighlightFechamento` (`render/Composition.tsx`),
 *  sem acoplar este arquivo ao motor de mapa. */
export interface EtapaHighlightFechamentoPlano {
  etapaId: string;
  tipo: 'FECHAMENTO';
  direcao: string;
  distanciaM: number;
  origemInclusaoRota2: {
    direcaoOrigem: string;
    distanciaOrigemM: number;
    linhaFinal: string;
    direcaoPosReversao: string;
    origemInclusaoRota1: {
      direcaoOrigem: string;
      distanciaOrigemM: number;
      linhaDestino: string;
      distanciaDestinoM: number;
      origemRetiradaRota2: {
        direcaoOrigem: string;
        distanciaOrigemM: number;
        linhaMeio: string;
        distanciaMeioM: number;
        linhaFinal: string;
        distanciaFinalM: number;
        direcaoPosReversao: string;
        origemRota1: {
          linhaOrigem: string;
          direcaoOrigem: string;
          distanciaOrigemM: number;
          linhaDestino: string;
          direcaoDestino: string;
          distanciaDestinoM: number;
          destinoAbsolutoM: number;
        };
      };
    };
  };
}

export type EtapaHighlightPlano =
  | EtapaHighlightParadaPlano
  | EtapaHighlightCortePlano
  | EtapaHighlightClearPlano
  | EtapaHighlightRetiradaPlano
  | EtapaHighlightRetiradaRota2Plano
  | EtapaHighlightInclusaoRota1Plano
  | EtapaHighlightInclusaoRota2Plano
  | EtapaHighlightFechamentoPlano;

/** Seleção de Bloco/Grupo ativa — `clusterId` presente = Grupo específico; ausente = Bloco
 *  inteiro. Mesmo shape de `CompositionHighlight` (`Composition.tsx`), sem acoplar este
 *  arquivo ao motor de mapa. `etapa`, quando presente, é sempre um refinamento DENTRO do Grupo
 *  já destacado (nunca aparece sem `clusterId`) — ver `GrupoAccordionItem`. */
export interface DestaquePlano {
  blocoId: string;
  clusterId?: string;
  etapa?: EtapaHighlightPlano;
}

/** As 2 abas do subheader entre o header do trem/OS e o conteúdo — "Visão Geral" (Métricas +
 *  Composição Geral) e "Manobras" (Blocos A/B). Ver `AbaSubheader`. */
type AbaPlano = 'geral' | 'manobras';

function formatarData(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function th(children: React.ReactNode) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '0.25rem 0.5rem',
        fontSize: '0.5625rem',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: TEXT_LO,
        borderBottom: `1px solid ${BORDER}`,
        fontFamily: FONT,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function td(children: React.ReactNode) {
  return (
    <td style={{ padding: '0.25rem 0.5rem', fontSize: '0.625rem', fontFamily: FONT, color: TEXT_MD, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>
      {children}
    </td>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.1875rem 0.5rem',
        borderRadius: '62.4375rem',
        border: `1px solid ${BORDER}`,
        backgroundColor: SURFACE,
        fontSize: '0.625rem',
        fontWeight: 500,
        color: TEXT_MD,
        fontFamily: FONT,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/** Botão-ícone pequeno e discreto (26x26, sem borda, muda de cor no hover) — mesmo padrão já
 *  usado em outras telas do app (ex.: remover linha na Ficha de Operação). */
function BotaoIcone({
  onClick,
  title,
  hoverColor = DANGER_TEXT,
  style,
  children,
}: {
  onClick: () => void;
  title: string;
  hoverColor?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <HeaderTooltip label={title}><button
      onClick={onClick}
     
      aria-label={title}
      className="flex items-center justify-center shrink-0"
      style={{ width: '1.625rem', height: '1.625rem', border: 'none', background: 'transparent', color: TEXT_LO, cursor: 'pointer', borderRadius: '0.25rem', ...style }}
      onMouseEnter={(e) => { e.currentTarget.style.color = hoverColor; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_LO; }}
    >
      {children}
    </button></HeaderTooltip>
  );
}

/**
 * Linha de um trem na lista lateral de seleção — mesmo padrão da lista de "Fichas do Dia" na
 * Ficha Operacional. Trens sem ficha aprovada nunca somem da lista, só ganham um ícone de alerta
 * discreto; o clique neles é tratado pelo chamador (bloqueia edição e navega).
 *
 * A segunda linha ("Ficha · O.S.") reforça que a origem do trem é a Ficha Operacional cadastrada/
 * importada, não uma integração externa. Mostra a O.S. em vez da data porque a data já aparece
 * no cabeçalho da lista (`Fichas de dd/mm/aaaa`) — repeti-la aqui seria redundante.
 *
 * 2026-08-28, pedido explícito do usuário: "o alerta faz sentido se a ficha não for aprovada,
 * agora o check não" — aprovada é o estado normal/esperado de todo trem da lista, não precisa de
 * ícone nenhum sinalizando isso; só o caso excepcional (não aprovada) ganha um ícone, o
 * `AlertTriangle`. Refinado em seguida: "pode alinhar todos os trens com o título 'trem'. Se tiver
 * alerta ele cria o ícone e empurra pra frente" — SEM slot reservado pro ícone: o normal (aprovada)
 * alinha flush com o cabeçalho "Trem"/"ETA" da lista (`ListaTrensLateral`, mesmo `padding`
 * horizontal); só a linha excepcional com alerta desloca o próprio texto pra direita ao abrir
 * espaço pro ícone — não é o caso comum que devia ceder lugar pro raro, e sim o contrário.
 */
function LinhaTrem({ trem, eta, os, ativo, aprovada, desabilitado = false, onClick }: { trem: string; eta?: string; os: string; ativo: boolean; aprovada: boolean; desabilitado?: boolean; onClick: () => void }) {
  return (
    <HeaderTooltip label={desabilitado ? 'Trem indisponível no protótipo' : aprovada ? undefined : 'Ficha não aprovada'}><button
      onClick={onClick}
      disabled={desabilitado}
      className="flex items-center w-full"
      style={{
        gap: '0.375rem',
        padding: '0.4375rem 0.625rem',
        border: 'none',
        borderLeft: `0.125rem solid ${ativo ? VLI_PRIMARY_TEXT : 'transparent'}`,
        backgroundColor: ativo ? 'var(--vli-active-bg)' : 'transparent',
        cursor: desabilitado ? 'not-allowed' : 'pointer',
        opacity: desabilitado ? 0.45 : 1,
        textAlign: 'left',
        fontFamily: FONT,
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => { if (!ativo && !desabilitado) e.currentTarget.style.backgroundColor = HOVER_TINT; }}
      onMouseLeave={(e) => { if (!ativo) e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {!aprovada && <AlertTriangle size="0.75rem" strokeWidth={2.5} color={WARNING_TEXT} style={{ flexShrink: 0 }} />}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: ativo ? 600 : 400, color: ativo ? VLI_PRIMARY_TEXT : TEXT_HI, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {rotuloTrem(trem)}
        </span>
        <span style={{ display: 'block', fontSize: '0.625rem', color: TEXT_LO, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          OS {os}
        </span>
      </span>
      <span style={{ flexShrink: 0, fontSize: '0.6875rem', color: ativo ? VLI_PRIMARY_TEXT : TEXT_LO, fontFamily: FONT }}>
        {eta ?? '—'}
      </span>
    </button></HeaderTooltip>
  );
}

/** Lista lateral de seleção de trem — trens da data selecionada no header (padrão "hoje"),
 *  mesmo padrão da lista de "Fichas do Dia" na Ficha Operacional. */
function ListaTrensLateral({
  trenSelecionado,
  statusFichaPorTrem,
  onSelecionar,
  dataSelecionada,
}: {
  trenSelecionado: string;
  statusFichaPorTrem: Record<string, { pendente: boolean; fichaId: string }>;
  onSelecionar: (trem: string) => void;
  dataSelecionada: string;
}) {
  const [busca, setBusca] = useState('');
  const trensDoDia = fichasMock.filter((f) => f.data === dataSelecionada);
  const trensFiltrados = trensDoDia.filter((f) => f.trem.toLowerCase().includes(busca.trim().toLowerCase()));
  return (
    <div className="flex flex-col shrink-0 no-print" style={{ width: LIST_W, borderRight: `1px solid ${BORDER}`, overflow: 'hidden' }}>
      <div style={{ padding: '0.625rem 0.625rem 0' }}>
        <div style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', color: TEXT_LO, fontFamily: FONT, textTransform: 'uppercase' }}>
          Trens
        </div>
        {/* Reforça que a lista vem das Fichas Operacionais da data escolhida no filtro do header
           (`DataHeaderDropdown`, `PlanejamentoScreen`) — mudar a data lá muda quem aparece aqui. */}
        <div style={{ fontSize: '0.59375rem', color: TEXT_LO, fontFamily: FONT, marginTop: '0.125rem' }}>
          Fichas de {formatarData(dataSelecionada)}
        </div>
      </div>
      <div className="flex items-center shrink-0" style={{ margin: '0.5rem', gap: '0.375rem', height: '1.625rem', padding: '0 0.5rem', borderRadius: RADIUS, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
        <Search size="0.75rem" color={TEXT_LO} style={{ flexShrink: 0 }} />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar trem..."
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: TEXT_HI, fontSize: '0.6875rem', fontFamily: FONT }}
        />
      </div>
      <div className="flex items-center shrink-0" style={{ gap: '0.375rem', padding: '0 0.625rem 0.25rem' }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: TEXT_LO, fontFamily: FONT }}>
          Trem
        </span>
        <span style={{ flexShrink: 0, fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: TEXT_LO, fontFamily: FONT }}>
          ETA
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {trensDoDia.length === 0 ? (
          <p style={{ padding: '0.75rem 0.625rem', fontSize: '0.6875rem', color: TEXT_LO, fontFamily: FONT }}>
            Nenhuma Ficha cadastrada para essa data.
          </p>
        ) : trensFiltrados.length === 0 ? (
          <p style={{ padding: '0.75rem 0.625rem', fontSize: '0.6875rem', color: TEXT_LO, fontFamily: FONT }}>
            Nenhum trem encontrado.
          </p>
        ) : (
          trensFiltrados.map((f) => (
            <LinhaTrem
              key={f.trem}
              trem={f.trem}
              eta={f.eta}
              os={f.os}
              ativo={f.trem === trenSelecionado}
              aprovada={!statusFichaPorTrem[f.trem]?.pendente}
              desabilitado={tremDesabilitado(f.trem)}
              onClick={() => onSelecionar(f.trem)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/** Uma etiqueta "rótulo: valor" compacta — mesmo papel de `.apoio-tag` no Plano de Manobra
 *  impresso, só que como chip (fundo próprio) em vez de texto corrido com "·" entre os campos. */
function ApoioTag({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '0.1875rem',
        padding: '0.125rem 0.4375rem',
        borderRadius: '0.25rem',
        backgroundColor: PANEL_BG,
        fontSize: '0.59375rem',
        color: TEXT_LO,
        fontFamily: FONT,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontWeight: 700, color: TEXT_MD }}>{label}:</span> {valor}
    </span>
  );
}

/** Fileira de `ApoioTag` — sempre termina no responsável (fixo por tipo de etapa,
 *  `TIPO_ETAPA_RESPONSAVEL`); os demais campos só aparecem quando a etapa os tem (Parada/Corte/
 *  Clear/Fechamento acontecem "no lugar" — `apoio` — Retirada/Inclusão têm rotas próprias, ver
 *  `RotaBox`, e por isso não repetem esses campos aqui). Corte e Fechamento têm campos extras
 *  próprios (ver `ApoioEtapa`), só exibidos nesses dois tipos. */
function ApoioTagsEtapa({ etapa }: { etapa: EtapaManobra }) {
  const apoio = etapa.apoio;
  return (
    <div className="flex flex-wrap items-center" style={{ gap: '0.3125rem', marginTop: '0.375rem', paddingTop: '0.375rem', borderTop: `1px dashed ${BORDER}` }}>
      {apoio?.linha && <ApoioTag label="Linha" valor={apoio.linha} />}
      {apoio?.referencia && <ApoioTag label="Referência" valor={apoio.referencia} />}
      {etapa.tipo === 'CLEAR' && apoio?.travessao && <ApoioTag label="Travessão" valor={apoio.travessao} />}
      {apoio?.direcao && <ApoioTag label="Direção" valor={apoio.direcao} />}
      {apoio?.macro != null && <ApoioTag label="Macro" valor={apoio.macro} />}
      {etapa.tipo === 'CORTE' && apoio?.sentido && <ApoioTag label="Sentido" valor={apoio.sentido} />}
      {etapa.tipo === 'CORTE' && apoio?.posCabecaM != null && <ApoioTag label="Pós-cabeça" valor={`${apoio.posCabecaM} m`} />}
      {etapa.tipo === 'CORTE' && apoio?.cabecaAposCorteM != null && <ApoioTag label="Cabeça após corte" valor={`${apoio.cabecaAposCorteM} m`} />}
      {etapa.tipo === 'FECHAMENTO' && apoio?.lado && <ApoioTag label="Lado" valor={apoio.lado} />}
      {etapa.tipo === 'FECHAMENTO' && apoio?.clearAteTravessaoM != null && <ApoioTag label="Clear até travessão" valor={`${apoio.clearAteTravessaoM} m`} />}
      {apoio?.distanciaM != null && <ApoioTag label={apoio.distanciaLabel ?? 'Distância'} valor={`${apoio.distanciaM} m`} />}
      <ApoioTag label="Responsável" valor={TIPO_ETAPA_RESPONSAVEL[etapa.tipo]} />
    </div>
  );
}

/** Todos os travessões que uma Rota cruza (segmentos marcados `travessao`), juntos — usados
 *  como "Referência" no rodapé da Rota, mesma convenção do apoio das outras etapas. Uma Rota
 *  pode cruzar mais de um travessão (ex.: Retirada/Inclusão que atravessa 2 AMVs). */
function referenciasRota(rota: RotaManobra): string | undefined {
  const travessoes = rota.segmentos.filter((s) => s.travessao).map((s) => s.linha);
  return travessoes.length > 0 ? travessoes.join(', ') : undefined;
}

/** Linha inicial → linha final do trajeto (ignora o meio) — usada como "Linha" no rodapé da
 *  Rota. Quando início e fim coincidem, mostra só uma vez. */
function linhaResumoRota(rota: RotaManobra): string {
  if (rota.segmentos.length === 0) return '—';
  const primeira = rota.segmentos[0].linha;
  const ultima = rota.segmentos[rota.segmentos.length - 1].linha;
  return primeira === ultima ? primeira : `${primeira} → ${ultima}`;
}

/** Um trecho do "stepper" visual de uma Rota — chip normal (segmento), chip final (destino,
 *  destacado) ou chip de reversão (destacado em laranja/warning). Só o stepper — a prosa
 *  correspondente é gerada à parte por `frasesRota`, porque uma reversão funde 2 chips numa
 *  única frase (ver ali). */
interface ChipRota {
  chip: string;
  tipo: 'segmento' | 'final' | 'reversao';
}

function chipsRota(rota: RotaManobra): ChipRota[] {
  const chips: ChipRota[] = [];
  // `reversaoInserida` evita duplicar o chip quando 2 segmentos seguidos têm o mesmo `linha`
  // (ex.: Rota 2 de Retirada, "Linha Desvio · 25m" seguido de "Linha Desvio · 0m" — o 0m só marca
  // a posição exata da reversão pro stepper, não é um novo trecho; sem a guarda, os dois batiam
  // com `reversao.local` e o chip "⟲ Reversão" aparecia duas vezes seguidas).
  let reversaoInserida = false;
  rota.segmentos.forEach((seg) => {
    chips.push({ chip: `${seg.linha} · ${seg.distanciaM} m`, tipo: 'segmento' });
    if (rota.reversao && !reversaoInserida && seg.linha === rota.reversao.local) {
      chips.push({ chip: '⟲ Reversão', tipo: 'reversao' });
      reversaoInserida = true;
    }
  });
  chips.push({ chip: rota.destinoFinal, tipo: 'final' });
  return chips;
}

/**
 * Decompõe uma Rota em frases em prosa, na ordem em que os trechos são percorridos.
 * `destaque: true` marca a frase que envolve a reversão — ela funde o trecho ANTES da reversão
 * (a distância percorrida até a locomotiva trocar de ponta), a própria reversão e, quando o
 * trecho seguinte tem distância > 0, também ele ("Ande Xm na direção Y. Reverta o motor da
 * locomotiva e ande Zm na direção W.") — só quando esse trecho seguinte não é o último da Rota,
 * pra não engolir a frase de chegada final. Trechos de distância 0 (posição já alcançada, sem
 * deslocamento) não geram frase própria.
 */
function frasesRota(rota: RotaManobra): { texto: string; destaque: boolean }[] {
  const segs = rota.segmentos;
  const revLocal = rota.reversao?.local;
  const frases: { texto: string; destaque: boolean }[] = [];
  let direcaoAtual = rota.direcao;
  let i = 0;
  while (i < segs.length) {
    const seg = segs[i];
    const ultimo = i === segs.length - 1;
    const ehReversao = revLocal != null && seg.linha === revLocal;

    if (seg.distanciaM === 0 && !ehReversao) {
      i += 1;
      continue;
    }

    if (ehReversao) {
      const preTexto =
        seg.distanciaM === 0
          ? ''
          : seg.travessao
            ? `Passe pelo travessão ${seg.linha} e siga por ${seg.distanciaM}m. `
            : `Ande ${seg.distanciaM}m na direção ${direcaoAtual}. `;
      direcaoAtual = rota.direcao2 ?? rota.direcao;
      let texto = `${preTexto}Reverta o motor da locomotiva`;
      const prox = segs[i + 1];
      const proxUltimo = i + 1 === segs.length - 1;
      if (prox && prox.distanciaM > 0 && !proxUltimo) {
        texto += prox.travessao
          ? ` e ande ${prox.distanciaM}m na direção ${direcaoAtual} para entrar no travessão ${prox.linha}.`
          : ` e ande ${prox.distanciaM}m na direção ${direcaoAtual}.`;
        i += 1;
      } else {
        texto += '.';
        if (prox && prox.distanciaM === 0) i += 1;
      }
      frases.push({ texto, destaque: true });
      i += 1;
      continue;
    }

    if (seg.travessao) {
      frases.push({ texto: `Passe pelo travessão ${seg.linha} e siga por ${seg.distanciaM}m.`, destaque: false });
    } else if (ultimo) {
      frases.push({
        texto:
          rota.instrucaoFinal ??
          `Ande ${seg.distanciaM}m em ${seg.linha} até ${rota.destinoFinal}.${rota.chegada ? ` Chegada: ${rota.chegada.toLowerCase()}.` : ''}`,
        destaque: false,
      });
    } else {
      frases.push({ texto: `Ande ${seg.distanciaM}m em ${seg.linha} na direção ${direcaoAtual}.`, destaque: false });
    }
    i += 1;
  }
  return frases;
}

// Nunca preencher um chip com cor sólida — parece um botão clicável. O destino final fica
// neutro, igual a qualquer outro trecho da rota (o "→" antes dele já indica chegada); só a
// reversão (evento realmente excepcional) ganha cor própria.
const COR_CHIP_ROTA: Record<ChipRota['tipo'], { cor: string; bg: string; borda: string }> = {
  segmento: { cor: TEXT_MD, bg: PANEL_BG, borda: BORDER },
  final: { cor: TEXT_MD, bg: PANEL_BG, borda: BORDER },
  reversao: { cor: WARNING_TEXT, bg: WARNING_BG, borda: WARNING_TEXT },
};

/**
 * Uma das 2 rotas de uma etapa de Retirada/Inclusão — título em destaque, a frase de contexto
 * (`descricao`), o trajeto completo em "stepper" (chips ligados por setas, destino final sempre
 * destacado), o mesmo trajeto em prosa passo a passo (`frasesRota` — a frase que envolve
 * reversão ganha destaque em laranja/warning, informação operacional crítica) e o rodapé com
 * Linha/Macro/Referência/Direção (1/2 quando há reversão)/Distância total/Responsável. A caixa
 * INTEIRA fica clicável quando `onClick` está presente (hoje só a Rota 1, ver
 * `rotaClicavelNoMapa`) — destaca o trajeto dela na Visão Topológica; a seleção é POR ROTA, não
 * pela etapa inteira (2026-08-25, feedback explícito: clicar não pode marcar as duas rotas da
 * mesma etapa como ativas juntas — cada `RotaBox` tem seu próprio estado, mesmo padrão de
 * `EtapaCard`, só num nível abaixo).
 */
function RotaBox({ rota, tipoEtapa, ativo = false, onClick }: { rota: RotaManobra; tipoEtapa: EtapaManobra['tipo']; ativo?: boolean; onClick?: () => void }) {
  const chips = useMemo(() => chipsRota(rota), [rota]);
  const frases = useMemo(() => frasesRota(rota), [rota]);
  const referencias = referenciasRota(rota);
  const clicavel = Boolean(onClick);
  return (
    <HeaderTooltip label={clicavel ? 'Destacar esta rota na Visão Topológica' : undefined}><div
      role={clicavel ? 'button' : undefined}
      tabIndex={clicavel ? 0 : undefined}
     
      onClick={onClick}
      onKeyDown={
        clicavel
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      style={{
        border: `1px solid ${ativo ? VLI_PRIMARY_SOLID : BORDER}`,
        borderRadius: RADIUS,
        padding: '0.5rem 0.75rem',
        backgroundColor: ativo ? 'var(--vli-active-bg)' : PANEL_BG,
        cursor: clicavel ? 'pointer' : undefined,
      }}
      onMouseEnter={clicavel ? (e) => { if (!ativo) e.currentTarget.style.backgroundColor = HOVER_TINT; } : undefined}
      onMouseLeave={clicavel ? (e) => { e.currentTarget.style.backgroundColor = ativo ? 'var(--vli-active-bg)' : PANEL_BG; } : undefined}
    >
      <span
        style={{
          display: 'inline-block',
          fontSize: '0.5625rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: TEXT_HI,
          backgroundColor: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: '0.25rem',
          padding: '0.1875rem 0.5rem',
          fontFamily: FONT,
        }}
      >
        {rota.titulo}
      </span>

      {rota.descricao && (
        <div style={{ fontSize: '0.65625rem', color: TEXT_LO, fontStyle: 'italic', fontFamily: FONT, marginTop: '0.3125rem' }}>
          {rota.descricao}
        </div>
      )}

      <div className="flex flex-wrap items-center" style={{ gap: '0.25rem', marginTop: '0.5rem' }}>
        {chips.map((passo, i) => {
          const estilo = COR_CHIP_ROTA[passo.tipo];
          return (
            <span key={i} className="flex items-center" style={{ gap: '0.25rem' }}>
              {i > 0 && <ArrowRight size="0.625rem" color={TEXT_LO} style={{ flexShrink: 0 }} />}
              <span
                style={{
                  fontSize: '0.59375rem',
                  fontWeight: 700,
                  color: estilo.cor,
                  backgroundColor: estilo.bg,
                  border: `1px solid ${estilo.borda}`,
                  borderRadius: '62.4375rem',
                  padding: '0.1875rem 0.5625rem',
                  fontFamily: FONT,
                  whiteSpace: 'nowrap',
                }}
              >
                {passo.chip}
              </span>
            </span>
          );
        })}
      </div>

      <div className="flex flex-col" style={{ gap: '0.1875rem', marginTop: '0.5rem' }}>
        {frases.map((frase, i) => (
          <div
            key={i}
            style={{
              fontSize: '0.65625rem',
              color: TEXT_MD,
              fontFamily: FONT,
              padding: '0.125rem 0.5rem',
              borderLeft: `0.125rem solid ${frase.destaque ? WARNING_TEXT : BORDER}`,
              backgroundColor: frase.destaque ? WARNING_BG : 'transparent',
              borderRadius: '0 0.25rem 0.25rem 0',
            }}
          >
            {frase.texto}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center" style={{ gap: '0.3125rem', marginTop: '0.5rem', paddingTop: '0.375rem', borderTop: `1px dashed ${BORDER}` }}>
        <ApoioTag label="Linha" valor={linhaResumoRota(rota)} />
        {rota.macro != null && <ApoioTag label="Macro" valor={rota.macro} />}
        {referencias && <ApoioTag label="Referência" valor={referencias} />}
        <ApoioTag label={rota.reversao ? 'Direção 1' : 'Direção'} valor={rota.direcao} />
        {rota.reversao && rota.direcao2 && <ApoioTag label="Direção 2" valor={rota.direcao2} />}
        <ApoioTag label="Distância total" valor={`${rota.distanciaTotalM} m`} />
        {rota.chegada && <ApoioTag label="Chegada" valor={rota.chegada} />}
        <ApoioTag label="Responsável" valor={TIPO_ETAPA_RESPONSAVEL[tipoEtapa]} />
      </div>
    </div></HeaderTooltip>
  );
}

/**
 * Vagão(ões) que uma etapa menciona — Corte/Retirada (retirado, vermelho), Inclusão (incluído,
 * verde) ou só uma referência sem retirar/incluir (`vagoesReferencia`, cinza/neutro — mesmo chip
 * "vagão" já usado em "Vagões do Bloco").
 */
function itensVagaoDaEtapa(etapa: EtapaManobra): { id: string; tipo: ItemComposicao['tipo'] }[] {
  return [
    ...(etapa.vagoesRetirados ?? []).map((id) => ({ id, tipo: 'retirado' as const })),
    ...(etapa.vagoesIncluidos ?? []).map((id) => ({ id, tipo: 'incluido' as const })),
    ...(etapa.vagoesReferencia ?? []).map((id) => ({ id, tipo: 'vagao' as const })),
  ];
}

/** Escapa caracteres especiais de regex — os ids de vagão têm hífen, que é literal aqui, mas
 *  outros caracteres (ponto, parênteses etc.) precisam ser escapados pra não virar sintaxe de
 *  regex por acaso. */
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Troca, DENTRO do texto corrido, cada menção a um id de vagão pelo chip `TagVagao` compacto
 * correspondente — o chip fica exatamente onde o id aparecia na frase (ex.: "Desengate do vagão
 * [VG-88057] (avaria em rodeiro)"), não anexado depois do texto. Sem os ids pra trocar, devolve o
 * texto puro. Só leitura: esta seção não é editável (a descrição do plano é decidida no
 * algoritmo, não digitada aqui).
 */
function textoComChipsDeVagao(texto: string, itens: { id: string; tipo: ItemComposicao['tipo'] }[]): React.ReactNode {
  if (itens.length === 0) return texto;
  const porId = new Map(itens.map((item) => [item.id, item]));
  const regex = new RegExp(`(${itens.map((item) => escaparRegex(item.id)).join('|')})`, 'g');
  return texto.split(regex).map((parte, i) => {
    const item = porId.get(parte);
    return item ? <TagVagao key={i} item={item} compact /> : parte;
  });
}

/** Etapa PARADA, CORTE ou CLEAR com dados suficientes pra desenhar no mapa (`EtapaParadaLayer.tsx`
 *  exige linha + distância pras duas etapas de trajeto; `EtapaCorteLayer.tsx` exige linha +
 *  vagões retirados — a origem/posição vem da Parada-irmã em todos os casos, checagem completa
 *  fica em `selecionarEtapa`, aqui só o que dá pra saber sem o cluster inteiro) — outros tipos
 *  ainda não têm destaque próprio no mapa, então nunca ficam clicáveis (ver
 *  `EtapaCard`/`EtapasCluster`). RETIRADA/INCLUSÃO usam `rotas`, não o cartão inteiro — ver
 *  `rotaClicavelNoMapa`, abaixo, chamado por Rota em vez de por etapa (2026-08-25, feedback:
 *  clicar não pode destacar o card inteiro, só a Rota específica clicada). */
export function etapaClicavelNoMapa(etapa: EtapaManobra): boolean {
  if (etapa.tipo === 'PARADA') return Boolean(etapa.apoio?.linha) && etapa.apoio?.distanciaM != null;
  if (etapa.tipo === 'CORTE') return Boolean(etapa.apoio?.linha) && Boolean(etapa.vagoesRetirados?.length);
  if (etapa.tipo === 'CLEAR') return Boolean(etapa.apoio?.linha) && etapa.apoio?.distanciaM != null;
  if (etapa.tipo === 'FECHAMENTO') return Boolean(etapa.apoio?.linha) && etapa.apoio?.distanciaM != null;
  return false;
}

/** Rota específica com dados suficientes pra desenhar no mapa — `RETIRADA` índice `0` exige a
 *  Rota 1 com seus 3 segmentos + reversão (`EtapaRetiradaLayer.tsx`); índice `1` exige a Rota 2
 *  com seus 6 segmentos (2 travessões) + reversão (`EtapaRetiradaRota2Layer.tsx`, 2026-08-25).
 *  `INCLUSAO` índice `0` exige a Rota 1 com seus 3 segmentos (1 travessão), SEM reversão
 *  (`EtapaInclusaoRota1Layer.tsx`, 2026-08-26); índice `1` exige a Rota 2 com seus 4 segmentos
 *  (1 travessão, mais o segmento de distância 0 que marca a reversão) + reversão
 *  (`EtapaInclusaoRota2Layer.tsx`, 2026-08-26). */
export function rotaClicavelNoMapa(etapa: EtapaManobra, rotaIndex: number): boolean {
  if (etapa.tipo === 'RETIRADA' && rotaIndex === 0) {
    const rota1 = etapa.rotas?.[0];
    return Boolean(rota1 && rota1.segmentos.length === 3 && rota1.reversao);
  }
  if (etapa.tipo === 'RETIRADA' && rotaIndex === 1) {
    const rota2 = etapa.rotas?.[1];
    return Boolean(rota2 && rota2.segmentos.length === 6 && rota2.reversao);
  }
  if (etapa.tipo === 'INCLUSAO' && rotaIndex === 0) {
    const rota1 = etapa.rotas?.[0];
    return Boolean(rota1 && rota1.segmentos.length === 3 && !rota1.reversao);
  }
  if (etapa.tipo === 'INCLUSAO' && rotaIndex === 1) {
    const rota2 = etapa.rotas?.[1];
    return Boolean(rota2 && rota2.segmentos.length === 4 && rota2.reversao);
  }
  return false;
}

/**
 * Um cartão de etapa completo — número + tipo + descrição, com os vagões mencionados
 * substituídos por chips no lugar exato onde apareceriam na frase (`textoComChipsDeVagao`) — os
 * chips são parte do texto, não um bloco à parte depois dele; quebra em quantas linhas precisar,
 * nunca corta/trunca a frase. A descrição/chips continuam só leitura (o plano vem decidido do
 * algoritmo). O cartão INTEIRO fica clicável quando `onClick` está presente (hoje PARADA/CORTE/
 * CLEAR, ver `etapaClicavelNoMapa`) — destaca o trecho correspondente na Visão Topológica, mesmo
 * padrão de "clicar destaca no mapa" já usado no header de Bloco/Grupo (ver `GrupoAccordionItem`).
 * Quando a etapa é Retirada/Inclusão, a seleção acontece um nível ABAIXO: cada `RotaBox` (não o
 * cartão) é clicável individualmente (`rotaAtivaIndex`/`onSelecionarRota`, hoje só a Rota 1) —
 * `onClick` neste nível fica `undefined` pra esses tipos (ver `EtapasCluster`), então o cartão
 * nunca marca as duas rotas como ativas juntas. Além disso, os campos ricos que o Plano de
 * Manobra impresso já tinha (`ApoioTagsEtapa`), quando a etapa não usa `rotas`.
 */
function EtapaCard({
  etapa,
  idx,
  ativo = false,
  onClick,
  rotaAtivaIndex,
  onSelecionarRota,
}: {
  etapa: EtapaManobra;
  idx: number;
  ativo?: boolean;
  onClick?: () => void;
  /** Índice da Rota ativa DESTA etapa (quando ela é a etapa ativa) — `undefined` = nenhuma rota
   *  dela em destaque. Só faz sentido pra etapas com `rotas` (Retirada/Inclusão). */
  rotaAtivaIndex?: number;
  onSelecionarRota?: (etapa: EtapaManobra, rotaIndex: number) => void;
}) {
  const clicavel = Boolean(onClick);
  return (
    <HeaderTooltip label={clicavel ? 'Destacar este trecho na Visão Topológica' : undefined}><div
      role={clicavel ? 'button' : undefined}
      tabIndex={clicavel ? 0 : undefined}
     
      onClick={onClick}
      onKeyDown={
        clicavel
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      style={{
        padding: '0.75rem 0.875rem',
        border: `1px solid ${ativo ? VLI_PRIMARY_SOLID : BORDER}`,
        borderRadius: RADIUS,
        backgroundColor: ativo ? 'var(--vli-active-bg)' : SURFACE,
        cursor: clicavel ? 'pointer' : undefined,
      }}
      onMouseEnter={clicavel ? (e) => { if (!ativo) e.currentTarget.style.backgroundColor = HOVER_TINT; } : undefined}
      onMouseLeave={clicavel ? (e) => { e.currentTarget.style.backgroundColor = ativo ? 'var(--vli-active-bg)' : SURFACE; } : undefined}
    >
      <div className="flex items-center" style={{ gap: '0.5rem' }}>
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: '1.25rem', height: '1.25rem', borderRadius: '0.25rem', backgroundColor: VLI_PRIMARY_SOLID, color: '#fff', fontSize: '0.625rem', fontWeight: 700 }}
        >
          {idx + 1}
        </div>
        <span style={{ fontSize: '0.65625rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: TEXT_HI, fontFamily: FONT, whiteSpace: 'nowrap' }}>
          {TIPO_ETAPA_LABEL[etapa.tipo]}
        </span>
      </div>

      <div style={{ marginLeft: '1.75rem', marginTop: '0.25rem', color: TEXT_HI, fontSize: '0.75rem', fontFamily: FONT, lineHeight: 1.7, wordBreak: 'break-word' }}>
        {textoComChipsDeVagao(etapa.descricao, itensVagaoDaEtapa(etapa))}
      </div>

      <div style={{ marginLeft: '1.75rem', marginTop: '0.25rem' }}>
        {etapa.rotas && etapa.rotas.length > 0 ? (
          <div className="flex flex-col" style={{ gap: '0.625rem', marginTop: '0.625rem' }}>
            {etapa.rotas.map((rota, i) => (
              <RotaBox
                key={i}
                rota={rota}
                tipoEtapa={etapa.tipo}
                ativo={rotaAtivaIndex === i}
                onClick={onSelecionarRota && rotaClicavelNoMapa(etapa, i) ? () => onSelecionarRota(etapa, i) : undefined}
              />
            ))}
          </div>
        ) : (
          <ApoioTagsEtapa etapa={etapa} />
        )}
      </div>
    </div></HeaderTooltip>
  );
}

/**
 * Sequência numerada das etapas de um cluster — ordem fixa do plano, sem indicação de status de
 * execução (esta tela é só planejamento; nada aqui está "em andamento" ou "concluído"). A
 * descrição/sequência continuam só leitura (ver `EtapaCard`); `etapaAtivaId`/`onSelecionarEtapa`
 * decidem qual cartão fica clicável/destacado (PARADA/CORTE/CLEAR); `rotaAtivaId`/
 * `rotaAtivaIndex`/`onSelecionarRota` fazem o mesmo um nível abaixo, por Rota, pras etapas que
 * usam `rotas` (Retirada/Inclusão) — os dois mecanismos nunca se aplicam à mesma etapa.
 */
function EtapasCluster({
  etapas,
  etapaAtivaId,
  onSelecionarEtapa,
  rotaAtivaId,
  rotaAtivaIndex,
  onSelecionarRota,
}: {
  etapas: EtapaManobra[];
  /** Id da etapa destacada no mapa agora, quando o Grupo deste cluster é o Grupo ativo (ver
   *  `GrupoAccordionItem`) — `undefined` quando nenhuma etapa está em destaque. */
  etapaAtivaId?: string;
  onSelecionarEtapa?: (etapa: EtapaManobra) => void;
  /** Id da etapa CUJA rota está ativa — junto com `rotaAtivaIndex`, identifica a Rota específica
   *  em destaque (uma etapa tem 2 rotas; a etapa sozinha não basta). */
  rotaAtivaId?: string;
  rotaAtivaIndex?: number;
  onSelecionarRota?: (etapa: EtapaManobra, rotaIndex: number) => void;
}) {
  return (
    <div className="flex flex-col" style={{ gap: '0.75rem' }}>
      {etapas.map((etapa, idx) => (
        <EtapaCard
          key={etapa.id}
          etapa={etapa}
          idx={idx}
          ativo={etapa.id === etapaAtivaId}
          onClick={onSelecionarEtapa && etapaClicavelNoMapa(etapa) ? () => onSelecionarEtapa(etapa) : undefined}
          rotaAtivaIndex={etapa.id === rotaAtivaId ? rotaAtivaIndex : undefined}
          onSelecionarRota={onSelecionarRota}
        />
      ))}
    </div>
  );
}

/** `destaque: true` em todos os 4 tipos agora — 2026-08-27, pedido explícito do usuário:
 *  "preciso que a locomotiva seja representada pelo laranja, os vagões por azul... só pra fazer
 *  uma relação melhor com o mapa" (locomotiva/vagão eram neutros/sem cor até então). `cor`
 *  (borda + texto do chip) de locomotiva/vagão reaproveita cor que o quadradinho correspondente
 *  já usa no mapa (`--vli-wagon-locomotiva-fg`/`--vli-wagon-vagao-fg`, `theme.css`) — não um
 *  laranja/azul genérico — pra essa relação visual funcionar. `bg` segue o MESMO padrão "tom
 *  escuro dessaturado" de retirado/incluído (`--vli-wagon-locomotiva-bg`/`--vli-wagon-vagao-bg`,
 *  `theme.css`), pedido explícito: "pode manter o padrão de ter uma borda colorida, e o fundo
 *  mais escuro com opacidade". 2026-08-28, pedido explícito do usuário: "estão meio apagados...
 *  deixe a cor um pouco mais evidente, tanto da borda quanto do texto" — `-fg` passou a apontar
 *  pro tom de PREENCHIMENTO do elemento no mapa (bem mais vívido no dark), não mais pro de
 *  BORDA (esse ficava escuro/dessaturado demais pra servir de texto sobre o fundo escuro do
 *  chip; ver comentário em `theme.css`). */
const TIPO_ITEM_ESTILO: Record<ItemComposicao['tipo'], { cor: string; bg: string; destaque: boolean }> = {
  locomotiva: { cor: 'var(--vli-wagon-locomotiva-fg)', bg: 'var(--vli-wagon-locomotiva-bg)', destaque: true },
  vagao: { cor: 'var(--vli-wagon-vagao-fg)', bg: 'var(--vli-wagon-vagao-bg)', destaque: true },
  retirado: { cor: DANGER_TEXT, bg: DANGER_BG, destaque: true },
  incluido: { cor: SUCCESS_TEXT, bg: SUCCESS_BG, destaque: true },
};

/** `compact`: variante mini, mesma altura de uma linha de texto — usada quando o chip precisa
 *  ficar embutido no meio de um texto corrido (`textoComChipsDeVagao`) ou no cabeçalho do Grupo
 *  fechado (`GrupoAccordionItem`), em vez de um bloco maior. `onClick` (opcional — só passado na
 *  coluna "Antes" da grade "Antes/Depois", `LinhaBlocoComposicao` — "Depois" e os chips compactos
 *  inline nunca passam `onClick`, ver ali) — 2026-08-27, pedido explícito do usuário: "se eu
 *  clicar em algum vagão, ou locomotiva, ele deve ancorar no mapa mostrando esse vagão
 *  específico", refinado em seguida pra toggle + multi-seleção (`selecionado`, ver
 *  `veiculosFoco`/`alternarFocoVeiculo`, `PlanejamentoScreen.tsx`). Continua um `<span>` (não um
 *  `<button>`) em qualquer um dos casos — `role="button"`/`tabIndex`/`onKeyDown` só entram quando
 *  `onClick` está presente, pra não mudar o comportamento/acessibilidade dos lugares que usam
 *  `TagVagao` sem clique. */
function TagVagao({ item, compact = false, onClick, selecionado = false, suave = false }: { item: ItemComposicao; compact?: boolean; onClick?: () => void; selecionado?: boolean; suave?: boolean }) {
  const estilo = TIPO_ITEM_ESTILO[item.tipo];
  const iconSize = compact ? '0.5625rem' : '0.625rem';
  const clicavel = !!onClick;
  // Hover e seleção escurecem o PRÓPRIO tom do chip (mistura da cor do tipo no fundo), em vez do
  // clarão branco (`brightness`) + anel azul de antes — 2026-09-24, pedido explícito do usuário:
  // "o hover pode ser um tomzinho mais escuro... o selected não precisa da borda, pode ser outro
  // tom mais escuro... mesmo comportamento pros vagões/locomotivas de outras cores". Cada tipo
  // (locomotiva, vagão, retirado, incluído) escurece na sua própria cor.
  // `suave` (só a Composição Geral do J105 V2, pedido explícito do usuário 2026-09-24: "um pouco
  // menos forte... mais clarinho"): fundo e borda clareados na direção do fundo do painel; o texto
  // continua na cor cheia do tipo, pra não perder leitura.
  const bgBase = suave ? `color-mix(in srgb, ${estilo.bg} 55%, var(--vli-panel-bg))` : estilo.bg;
  const borda = suave ? `color-mix(in srgb, ${estilo.cor} 45%, var(--vli-panel-bg))` : estilo.cor;
  const tom = (pct: number) => `color-mix(in srgb, ${estilo.cor} ${pct}%, ${bgBase})`;
  const fundoRepouso = selecionado ? tom(24) : bgBase;
  const fundoHover = selecionado ? tom(30) : tom(12);
  return (
    <HeaderTooltip label={clicavel ? `Mostrar ${item.id} no mapa` : undefined}><span
      className="inline-flex items-center"
      role={clicavel ? 'button' : undefined}
      tabIndex={clicavel ? 0 : undefined}
      aria-pressed={clicavel ? selecionado : undefined}
     
      onClick={onClick}
      onKeyDown={clicavel ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{
        gap: compact ? '0.125rem' : '0.1875rem',
        height: compact ? '1.0625rem' : '1.375rem',
        padding: compact ? '0 0.3125rem' : '0 0.375rem',
        borderRadius: '0.1875rem',
        border: `1px solid ${estilo.destaque ? borda : BORDER}`,
        backgroundColor: fundoRepouso,
        color: estilo.cor,
        fontSize: compact ? '0.59375rem' : '0.625rem',
        fontWeight: estilo.destaque ? 600 : 400,
        fontFamily: FONT,
        whiteSpace: 'nowrap',
        verticalAlign: compact ? 'middle' : undefined,
        cursor: clicavel ? 'pointer' : undefined,
        // Seleção é persistente (toggle), então o tom mais escuro (`fundoRepouso`) fica mesmo sem
        // o mouse em cima.
        transition: clicavel ? 'background-color 120ms ease' : undefined,
      }}
      onMouseEnter={clicavel ? (e) => { e.currentTarget.style.backgroundColor = fundoHover; } : undefined}
      onMouseLeave={clicavel ? (e) => { e.currentTarget.style.backgroundColor = fundoRepouso; } : undefined}
    >
      {/* Sem o ícone de trem no chip suave (J105 V2) — a cor laranja já identifica a locomotiva,
          e o chip compacto não tem folga pra ícone (2026-09-24, pedido explícito do usuário). */}
      {item.tipo === 'locomotiva' && !suave && <Train size={iconSize} strokeWidth={2.5} />}
      {item.tipo === 'retirado' && <Minus size={iconSize} strokeWidth={3} />}
      {item.tipo === 'incluido' && <Plus size={iconSize} strokeWidth={3} />}
      {item.id}
    </span></HeaderTooltip>
  );
}

function LegendaItem({ cor, label, icon }: { cor: string; label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center" style={{ gap: '0.3125rem' }}>
      {icon ?? <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', backgroundColor: cor }} />}
      <span style={{ fontSize: '0.625rem', color: TEXT_LO, fontFamily: FONT, fontWeight: 400 }}>{label}</span>
    </div>
  );
}

/**
 * Conteúdo completo de um Grupo (cluster) — as etapas da manobra, só leitura: o plano já foi
 * decidido (ver `EtapasCluster`), este painel não edita composição nem sequência. Não repete
 * retirado/incluído nem criticidade/resumo: isso já está todo no cabeçalho (trigger) logo acima,
 * como chip (ver `GrupoAccordionItem`) — um "Antes/Depois" aqui embaixo seria a mesma informação
 * duas vezes.
 */
function GrupoDetalhe({
  cluster,
  etapaAtivaId,
  onSelecionarEtapa,
  rotaAtivaId,
  rotaAtivaIndex,
  onSelecionarRota,
}: {
  cluster: ClusterManobra;
  etapaAtivaId?: string;
  onSelecionarEtapa?: (etapa: EtapaManobra) => void;
  rotaAtivaId?: string;
  rotaAtivaIndex?: number;
  onSelecionarRota?: (etapa: EtapaManobra, rotaIndex: number) => void;
}) {
  return (
    <div style={{ padding: '1rem 1rem 1.25rem 1rem' }}>
      <div style={{ fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: TEXT_LO, marginBottom: '0.875rem' }}>
        Sequência de Manobra
      </div>
      <EtapasCluster
        etapas={cluster.etapas}
        etapaAtivaId={etapaAtivaId}
        onSelecionarEtapa={onSelecionarEtapa}
        rotaAtivaId={rotaAtivaId}
        rotaAtivaIndex={rotaAtivaIndex}
        onSelecionarRota={onSelecionarRota}
      />
    </div>
  );
}

/**
 * Um Grupo (cluster) dentro de um Bloco — accordion EXCLUSIVO com os demais Grupos do mesmo
 * bloco (ver Root em `BlocoAccordionItem`, mais abaixo): abrir um Grupo fecha automaticamente
 * qualquer outro que estivesse aberto naquele bloco. O cabeçalho já comunica problema/
 * criticidade sem precisar abrir, e o conteúdo completo expande inline logo abaixo quando
 * clicado. Grupos vazios (sem etapas) ganham um botão de remover ao lado do cabeçalho — fora do
 * Trigger, porque Trigger já é um <button> e não pode aninhar outro.
 */
/**
 * Constrói o destaque de uma etapa "de cartão inteiro" (Parada/Corte/Clear/Fechamento — as que
 * NÃO usam `rotas`, ver `rotaClicavelNoMapa`) a partir dos dados do plano, SEM efeito colateral
 * (não chama `onDestaqueChange`) — função pura, reaproveitada tanto por `selecionarEtapa`
 * (`GrupoAccordionItem`, clique no painel esquerdo) quanto pelo controle de navegação do mapa
 * (`MapaNavegacaoPainel`, `PlanejamentoScreen.tsx`, 2026-08-26: "reaproveite o mesmo estado... não
 * crie um sistema de estado paralelo"). `null` quando a etapa não tem dados suficientes pro mapa
 * (mesmos casos que já faziam `selecionarEtapa` retornar cedo) — MESMA lógica dela, só devolvendo
 * o objeto em vez de despachar.
 */
export function construirDestaqueEtapa(cluster: ClusterManobra, etapa: EtapaManobra): EtapaHighlightPlano | null {
  if (!etapa.apoio || !etapa.apoio.linha) return null;

  if (etapa.tipo === 'PARADA') {
    if (etapa.apoio.distanciaM == null) return null;
    return {
      etapaId: etapa.id,
      tipo: 'PARADA',
      linha: etapa.apoio.linha,
      referencia: etapa.apoio.referencia,
      direcao: etapa.apoio.direcao,
      distanciaM: etapa.apoio.distanciaM,
    };
  }

  if (etapa.tipo === 'CORTE') {
    if (!etapa.vagoesRetirados || etapa.vagoesRetirados.length === 0) return null;
    if (etapa.apoio.posCabecaM == null) return null;
    const paradaDoCorte = cluster.etapas.find((e) => e.tipo === 'PARADA');
    if (paradaDoCorte?.apoio?.distanciaM == null) return null;
    return {
      etapaId: etapa.id,
      tipo: 'CORTE',
      linha: etapa.apoio.linha,
      referencia: etapa.apoio.referencia,
      direcao: etapa.apoio.direcao,
      distanciaM: etapa.apoio.posCabecaM,
      referenciaM: paradaDoCorte.apoio.distanciaM,
      vagoes: etapa.vagoesRetirados,
    };
  }

  if (etapa.tipo === 'CLEAR') {
    if (etapa.apoio.distanciaM == null) return null;
    const parada = cluster.etapas.find((e) => e.tipo === 'PARADA');
    if (parada?.apoio?.distanciaM == null) return null;
    return {
      etapaId: etapa.id,
      tipo: 'CLEAR',
      linha: etapa.apoio.linha,
      referencia: etapa.apoio.referencia,
      direcao: etapa.apoio.direcao,
      origemM: parada.apoio.distanciaM,
      distanciaM: etapa.apoio.distanciaM,
    };
  }

  if (etapa.tipo === 'FECHAMENTO') {
    if (etapa.apoio.distanciaM == null) return null;
    // Origem = MESMO ponto onde a última rota (Inclusão — Rota 2) terminou — reaproveitada aqui,
    // não recalculada do zero. Precisamos encadear a MESMA cadeia inteira que a própria Rota 2 de
    // Inclusão usa: sua Rota 1 → Retirada Rota 2 → Retirada Rota 1 → Parada + Clear.
    const inclusao = cluster.etapas.find((e) => e.tipo === 'INCLUSAO');
    const inclusaoRota1 = inclusao?.rotas?.[0];
    const inclusaoRota2 = inclusao?.rotas?.[1];
    if (!inclusaoRota1 || inclusaoRota1.segmentos.length !== 3 || inclusaoRota1.reversao) return null;
    if (!inclusaoRota2 || inclusaoRota2.segmentos.length !== 4 || !inclusaoRota2.reversao) return null;
    const [iRota1SegOrigem, , iRota1SegDestino] = inclusaoRota1.segmentos;
    const [iRota2SegOrigem, , , iRota2SegFinal] = inclusaoRota2.segmentos;
    const retirada = cluster.etapas.find((e) => e.tipo === 'RETIRADA');
    const retiradaRota1 = retirada?.rotas?.[0];
    const retiradaRota2 = retirada?.rotas?.[1];
    if (!retiradaRota1 || retiradaRota1.segmentos.length !== 3 || !retiradaRota1.reversao) return null;
    if (!retiradaRota2 || retiradaRota2.segmentos.length !== 6 || !retiradaRota2.reversao) return null;
    const [rRota1SegOrigem, , rRota1SegDestino] = retiradaRota1.segmentos;
    const [rRota2SegOrigem, , , rRota2SegMeio, , rRota2SegFinal] = retiradaRota2.segmentos;
    const parada = cluster.etapas.find((e) => e.tipo === 'PARADA');
    const clear = cluster.etapas.find((e) => e.tipo === 'CLEAR');
    if (parada?.apoio?.distanciaM == null || clear?.apoio?.distanciaM == null) return null;
    // O recuo anda no sentido OPOSTO ao de chegada do Clear (que avançou a composição pra liberar
    // o travessão) — não um valor arbitrário do plano.
    const direcaoRecuo = clear.apoio.direcao === 'EDV' ? 'ECJ' : clear.apoio.direcao === 'ECJ' ? 'EDV' : clear.apoio.direcao;
    if (!direcaoRecuo) return null;
    return {
      etapaId: etapa.id,
      tipo: 'FECHAMENTO',
      direcao: direcaoRecuo,
      distanciaM: etapa.apoio.distanciaM,
      origemInclusaoRota2: {
        direcaoOrigem: inclusaoRota2.direcao,
        distanciaOrigemM: iRota2SegOrigem.distanciaM,
        linhaFinal: iRota2SegFinal.linha,
        direcaoPosReversao: inclusaoRota2.direcao2 ?? inclusaoRota2.direcao,
        origemInclusaoRota1: {
          direcaoOrigem: inclusaoRota1.direcao,
          distanciaOrigemM: iRota1SegOrigem.distanciaM,
          linhaDestino: iRota1SegDestino.linha,
          distanciaDestinoM: iRota1SegDestino.distanciaM,
          origemRetiradaRota2: {
            direcaoOrigem: retiradaRota2.direcao,
            distanciaOrigemM: rRota2SegOrigem.distanciaM,
            linhaMeio: rRota2SegMeio.linha,
            distanciaMeioM: rRota2SegMeio.distanciaM,
            linhaFinal: rRota2SegFinal.linha,
            distanciaFinalM: rRota2SegFinal.distanciaM,
            direcaoPosReversao: retiradaRota2.direcao2 ?? retiradaRota2.direcao,
            origemRota1: {
              linhaOrigem: rRota1SegOrigem.linha,
              direcaoOrigem: retiradaRota1.direcao,
              distanciaOrigemM: rRota1SegOrigem.distanciaM,
              linhaDestino: rRota1SegDestino.linha,
              direcaoDestino: retiradaRota1.direcao2 ?? retiradaRota1.direcao,
              distanciaDestinoM: rRota1SegDestino.distanciaM,
              destinoAbsolutoM: parada.apoio.distanciaM + clear.apoio.distanciaM,
            },
          },
        },
      },
    };
  }

  return null;
}

/**
 * Constrói o destaque de uma Rota específica de Retirada/Inclusão (`rotaIndex` 0 ou 1, ver
 * `rotaClicavelNoMapa`) — MESMA razão de ser de `construirDestaqueEtapa` (função pura, sem
 * `onDestaqueChange`, reaproveitada por `selecionarRota` e pelo controle de navegação do mapa).
 * `null` nos mesmos casos em que `selecionarRota` já retornava cedo.
 */
export function construirDestaqueRota(cluster: ClusterManobra, etapa: EtapaManobra, rotaIndex: number): EtapaHighlightPlano | null {
  if (etapa.tipo === 'RETIRADA' && rotaIndex === 0) {
    const rota1 = etapa.rotas?.[0];
    if (!rota1 || rota1.segmentos.length !== 3 || !rota1.reversao) return null;
    const [segOrigem, segTravessao, segDestino] = rota1.segmentos;
    const parada = cluster.etapas.find((e) => e.tipo === 'PARADA');
    const clear = cluster.etapas.find((e) => e.tipo === 'CLEAR');
    if (parada?.apoio?.distanciaM == null || clear?.apoio?.distanciaM == null) return null;
    return {
      etapaId: etapa.id,
      tipo: 'RETIRADA',
      rotaIndex: 0,
      linhaOrigem: segOrigem.linha,
      direcaoOrigem: rota1.direcao,
      distanciaOrigemM: segOrigem.distanciaM,
      travessaoLabel: segTravessao.linha,
      distanciaTravessaoM: segTravessao.distanciaM,
      linhaDestino: segDestino.linha,
      direcaoDestino: rota1.direcao2 ?? rota1.direcao,
      distanciaDestinoM: segDestino.distanciaM,
      destinoAbsolutoM: parada.apoio.distanciaM + clear.apoio.distanciaM,
    };
  }

  if (etapa.tipo === 'RETIRADA' && rotaIndex === 1) {
    const rota1 = etapa.rotas?.[0];
    const rota2 = etapa.rotas?.[1];
    if (!rota1 || rota1.segmentos.length !== 3 || !rota1.reversao) return null;
    if (!rota2 || rota2.segmentos.length !== 6 || !rota2.reversao) return null;
    const [rota1SegOrigem, , rota1SegDestino] = rota1.segmentos;
    const [segOrigem, , segT3, segMeio, segBranch, segFinal] = rota2.segmentos;
    const parada = cluster.etapas.find((e) => e.tipo === 'PARADA');
    const clear = cluster.etapas.find((e) => e.tipo === 'CLEAR');
    if (parada?.apoio?.distanciaM == null || clear?.apoio?.distanciaM == null) return null;
    return {
      etapaId: etapa.id,
      tipo: 'RETIRADA',
      rotaIndex: 1,
      direcaoOrigem: rota2.direcao,
      distanciaOrigemM: segOrigem.distanciaM,
      travessao1Label: segT3.linha,
      linhaMeio: segMeio.linha,
      distanciaMeioM: segMeio.distanciaM,
      travessao2Label: segBranch.linha,
      linhaFinal: segFinal.linha,
      distanciaFinalM: segFinal.distanciaM,
      direcaoPosReversao: rota2.direcao2 ?? rota2.direcao,
      origemRota1: {
        linhaOrigem: rota1SegOrigem.linha,
        direcaoOrigem: rota1.direcao,
        distanciaOrigemM: rota1SegOrigem.distanciaM,
        linhaDestino: rota1SegDestino.linha,
        direcaoDestino: rota1.direcao2 ?? rota1.direcao,
        distanciaDestinoM: rota1SegDestino.distanciaM,
        destinoAbsolutoM: parada.apoio.distanciaM + clear.apoio.distanciaM,
      },
    };
  }

  if (etapa.tipo === 'INCLUSAO' && rotaIndex === 0) {
    const rota1 = etapa.rotas?.[0];
    if (!rota1 || rota1.segmentos.length !== 3 || rota1.reversao) return null;
    const [segOrigem, segTravessao, segDestino] = rota1.segmentos;
    const retirada = cluster.etapas.find((e) => e.tipo === 'RETIRADA');
    const retiradaRota1 = retirada?.rotas?.[0];
    const retiradaRota2 = retirada?.rotas?.[1];
    if (!retiradaRota1 || retiradaRota1.segmentos.length !== 3 || !retiradaRota1.reversao) return null;
    if (!retiradaRota2 || retiradaRota2.segmentos.length !== 6 || !retiradaRota2.reversao) return null;
    const [rRota1SegOrigem, , rRota1SegDestino] = retiradaRota1.segmentos;
    const [rRota2SegOrigem, , , rRota2SegMeio, , rRota2SegFinal] = retiradaRota2.segmentos;
    const parada = cluster.etapas.find((e) => e.tipo === 'PARADA');
    const clear = cluster.etapas.find((e) => e.tipo === 'CLEAR');
    if (parada?.apoio?.distanciaM == null || clear?.apoio?.distanciaM == null) return null;
    return {
      etapaId: etapa.id,
      tipo: 'INCLUSAO',
      rotaIndex: 0,
      direcaoOrigem: rota1.direcao,
      distanciaOrigemM: segOrigem.distanciaM,
      travessaoLabel: segTravessao.linha,
      linhaDestino: segDestino.linha,
      distanciaDestinoM: segDestino.distanciaM,
      vagoesIncluidos: etapa.vagoesIncluidos ?? [],
      origemRetiradaRota2: {
        direcaoOrigem: retiradaRota2.direcao,
        distanciaOrigemM: rRota2SegOrigem.distanciaM,
        linhaMeio: rRota2SegMeio.linha,
        distanciaMeioM: rRota2SegMeio.distanciaM,
        linhaFinal: rRota2SegFinal.linha,
        distanciaFinalM: rRota2SegFinal.distanciaM,
        direcaoPosReversao: retiradaRota2.direcao2 ?? retiradaRota2.direcao,
        origemRota1: {
          linhaOrigem: rRota1SegOrigem.linha,
          direcaoOrigem: retiradaRota1.direcao,
          distanciaOrigemM: rRota1SegOrigem.distanciaM,
          linhaDestino: rRota1SegDestino.linha,
          direcaoDestino: retiradaRota1.direcao2 ?? retiradaRota1.direcao,
          distanciaDestinoM: rRota1SegDestino.distanciaM,
          destinoAbsolutoM: parada.apoio.distanciaM + clear.apoio.distanciaM,
        },
      },
    };
  }

  if (etapa.tipo === 'INCLUSAO' && rotaIndex === 1) {
    const rota1 = etapa.rotas?.[0];
    const rota2 = etapa.rotas?.[1];
    if (!rota1 || rota1.segmentos.length !== 3 || rota1.reversao) return null;
    if (!rota2 || rota2.segmentos.length !== 4 || !rota2.reversao) return null;
    const [rota1SegOrigem, , rota1SegDestino] = rota1.segmentos;
    const [segOrigem, , segT3, segFinal] = rota2.segmentos;
    const retirada = cluster.etapas.find((e) => e.tipo === 'RETIRADA');
    const retiradaRota1 = retirada?.rotas?.[0];
    const retiradaRota2 = retirada?.rotas?.[1];
    if (!retiradaRota1 || retiradaRota1.segmentos.length !== 3 || !retiradaRota1.reversao) return null;
    if (!retiradaRota2 || retiradaRota2.segmentos.length !== 6 || !retiradaRota2.reversao) return null;
    const [rRota1SegOrigem, , rRota1SegDestino] = retiradaRota1.segmentos;
    const [rRota2SegOrigem, , , rRota2SegMeio, , rRota2SegFinal] = retiradaRota2.segmentos;
    const parada = cluster.etapas.find((e) => e.tipo === 'PARADA');
    const clear = cluster.etapas.find((e) => e.tipo === 'CLEAR');
    if (parada?.apoio?.distanciaM == null || clear?.apoio?.distanciaM == null) return null;
    return {
      etapaId: etapa.id,
      tipo: 'INCLUSAO',
      rotaIndex: 1,
      direcaoOrigem: rota2.direcao,
      distanciaOrigemM: segOrigem.distanciaM,
      travessaoLabel: segT3.linha,
      linhaFinal: segFinal.linha,
      distanciaFinalM: segFinal.distanciaM,
      direcaoPosReversao: rota2.direcao2 ?? rota2.direcao,
      origemInclusaoRota1: {
        direcaoOrigem: rota1.direcao,
        distanciaOrigemM: rota1SegOrigem.distanciaM,
        linhaDestino: rota1SegDestino.linha,
        distanciaDestinoM: rota1SegDestino.distanciaM,
        origemRetiradaRota2: {
          direcaoOrigem: retiradaRota2.direcao,
          distanciaOrigemM: rRota2SegOrigem.distanciaM,
          linhaMeio: rRota2SegMeio.linha,
          distanciaMeioM: rRota2SegMeio.distanciaM,
          linhaFinal: rRota2SegFinal.linha,
          distanciaFinalM: rRota2SegFinal.distanciaM,
          direcaoPosReversao: retiradaRota2.direcao2 ?? retiradaRota2.direcao,
          origemRota1: {
            linhaOrigem: rRota1SegOrigem.linha,
            direcaoOrigem: retiradaRota1.direcao,
            distanciaOrigemM: rRota1SegOrigem.distanciaM,
            linhaDestino: rRota1SegDestino.linha,
            direcaoDestino: retiradaRota1.direcao2 ?? retiradaRota1.direcao,
            distanciaDestinoM: rRota1SegDestino.distanciaM,
            destinoAbsolutoM: parada.apoio.distanciaM + clear.apoio.distanciaM,
          },
        },
      },
    };
  }

  return null;
}

function GrupoAccordionItem({
  cluster,
  editor,
  blocoId,
  ativo = false,
  destaque = null,
  onDestaqueChange,
}: {
  cluster: ClusterManobra;
  editor: EditorPlano;
  blocoId: string;
  /** Este Grupo é o destaque sincronizado com a Visão Topológica agora? */
  ativo?: boolean;
  /** Destaque completo do plano (repassado de `BlocoAccordionItem`) — só usado aqui pra saber
   *  se alguma etapa DESTE cluster está ativa (`destaque.etapa`), já que `ativo` acima só diz
   *  se o GRUPO está ativo, não a etapa dentro dele. */
  destaque?: DestaquePlano | null;
  onDestaqueChange?: (next: DestaquePlano | null) => void;
}) {
  // "Grupo N" já vem no início de `titulo` ("Grupo N — <descrição genérica>"); o resto da
  // descrição genérica é redundante com `resumoProblema` (que já traz o vagão + o problema),
  // então o título consolidado usa só o prefixo "Grupo N" + o resumoProblema.
  const prefixoGrupo = cluster.titulo.split('—')[0].trim();
  const vazio = cluster.etapas.length === 0;
  const headerBg = ativo ? 'var(--vli-active-bg)' : PANEL_BG;
  // Etapa ativa só conta quando é DESTE grupo — `destaque.etapa` nunca aparece sem `clusterId`
  // apontando pro mesmo cluster (ver `DestaquePlano`), mas o grupo aqui embaixo confirma pelo
  // `ativo` recebido (já resolvido em `BlocoAccordionItem`) em vez de comparar `clusterId` de novo.
  const etapaAtivaId = ativo ? destaque?.etapa?.etapaId : undefined;
  // Retirada/Inclusão destacam por ROTA, não pela etapa inteira (2026-08-25, feedback: "quando
  // clico em retirada, ele tá selecionando tanto a rota 1 como a rota 2... o click só deve
  // funcionar na Rota 1 ou Rota 2, e não no card maior") — `rotaAtivaId`/`rotaAtivaIndex` juntos
  // identificam QUAL rota, de QUAL etapa, está ativa; `EtapaCard` só marca UMA `RotaBox` como
  // ativa quando os dois batem (ver `EtapasCluster`).
  const rotaAtivaEtapa = ativo && destaque?.etapa?.tipo === 'RETIRADA' ? destaque.etapa : undefined;
  const rotaAtivaId = rotaAtivaEtapa?.etapaId;
  const rotaAtivaIndex = rotaAtivaEtapa?.rotaIndex;

  /** Clicar num cartão de etapa (hoje PARADA/CORTE/CLEAR/FECHAMENTO, ver `etapaClicavelNoMapa`)
   *  destaca o trecho/ponto correspondente na Visão Topológica — clicar de novo na mesma etapa
   *  volta pro destaque só do Grupo (remove `etapa`, mantém `blocoId`/`clusterId`), mesmo padrão
   *  de toggle já usado no resto do accordion. A construção do objeto de destaque em si vive em
   *  `construirDestaqueEtapa` (função pura, fora deste componente) — reaproveitada também pelo
   *  controle de navegação do mapa (`MapaNavegacaoPainel`, `PlanejamentoScreen.tsx`). */
  function selecionarEtapa(etapa: EtapaManobra) {
    if (!onDestaqueChange) return;
    if (etapaAtivaId === etapa.id) {
      onDestaqueChange({ blocoId, clusterId: cluster.id });
      return;
    }
    const highlightEtapa = construirDestaqueEtapa(cluster, etapa);
    if (!highlightEtapa) return;
    onDestaqueChange({ blocoId, clusterId: cluster.id, etapa: highlightEtapa });
  }

  /** Clicar numa Rota específica (RETIRADA/INCLUSÃO, ver `rotaClicavelNoMapa`) destaca o trajeto
   *  dela na Visão Topológica — independente das outras rotas da MESMA etapa (2026-08-25,
   *  feedback: clicar não pode marcar Rota 1 E Rota 2 como ativas juntas, só a clicada). Mesmo
   *  padrão de toggle de `selecionarEtapa`, mas comparando `rotaAtivaId` + `rotaAtivaIndex` (a
   *  etapa sozinha não basta — a mesma etapa tem 2 rotas). Construção do objeto em
   *  `construirDestaqueRota` (mesma razão de `construirDestaqueEtapa` acima). */
  function selecionarRota(etapa: EtapaManobra, rotaIndex: number) {
    if (!onDestaqueChange) return;
    if (rotaAtivaId === etapa.id && rotaAtivaIndex === rotaIndex) {
      onDestaqueChange({ blocoId, clusterId: cluster.id });
      return;
    }
    const highlightEtapa = construirDestaqueRota(cluster, etapa, rotaIndex);
    if (!highlightEtapa) return;
    onDestaqueChange({ blocoId, clusterId: cluster.id, etapa: highlightEtapa });
  }
  return (
    <AccordionPrimitive.Item
      value={cluster.id}
      id={`grupo-${cluster.id}`}
      style={{ borderTop: `1px solid ${BORDER}`, borderLeft: `0.1875rem solid ${BORDER}`, overflow: 'hidden', flexShrink: 0 }}
    >
      <div
        className="flex items-center"
        style={{ backgroundColor: headerBg }}
        onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.backgroundColor = HOVER_TINT; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = headerBg; }}
      >
        <AccordionPrimitive.Header style={{ flex: 1, minWidth: 0 }}>
          <HeaderTooltip label={"Destacar este grupo na Visão Topológica"}><AccordionPrimitive.Trigger
            className="vli-collapsible-trigger flex items-center justify-between w-full"
           
            style={{
              gap: '0.625rem',
              padding: '0.6875rem 0.875rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: FONT,
            }}
          >
            <div className="flex items-baseline justify-between flex-wrap" style={{ gap: '0.25rem 1rem', minWidth: 0, flex: 1 }}>
              <div className="flex items-center flex-wrap" style={{ gap: '0.375rem', minWidth: 0 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: TEXT_HI, fontFamily: FONT, whiteSpace: 'nowrap' }}>
                  {prefixoGrupo}
                </span>
                <span style={{ color: TEXT_LO, fontFamily: FONT }}>—</span>
                {cluster.composicao.antes.filter((item) => item.tipo === 'retirado').map((item) => (
                  <TagVagao key={`grupo-antes-${item.id}`} item={item} compact />
                ))}
                {cluster.composicao.depois.filter((item) => item.tipo === 'incluido').map((item) => (
                  <TagVagao key={`grupo-depois-${item.id}`} item={item} compact />
                ))}
              </div>
              <div className="flex items-center flex-wrap shrink-0" style={{ gap: '0.375rem' }}>
                <Chip>{formatarDuracaoMin(duracaoClusterMin(cluster))}</Chip>
                <Chip>{cluster.etapas.length} etapas previstas</Chip>
              </div>
            </div>
            <ChevronDown size="0.875rem" color={TEXT_LO} className="vli-chevron" style={{ flexShrink: 0 }} />
          </AccordionPrimitive.Trigger></HeaderTooltip>
        </AccordionPrimitive.Header>
        {vazio && (
          <BotaoIcone
            onClick={() => editor.removerGrupo(blocoId, cluster.id)}
            title="Remover grupo vazio"
            style={{ marginRight: '0.625rem', flexShrink: 0 }}
          >
            <Trash2 size="0.8125rem" />
          </BotaoIcone>
        )}
      </div>
      <AccordionPrimitive.Content className="vli-collapsible-content">
        <GrupoDetalhe
          cluster={cluster}
          etapaAtivaId={etapaAtivaId}
          onSelecionarEtapa={selecionarEtapa}
          rotaAtivaId={rotaAtivaId}
          rotaAtivaIndex={rotaAtivaIndex}
          onSelecionarRota={selecionarRota}
        />
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}

/**
 * Composição física do Bloco inteiro — união das listas "antes" de todos os Clusters (o que está
 * no Bloco agora, com os problemáticos marcados "retirado") — mesma convenção de
 * `derivarVeiculosDoBloco`/`agruparEmSegmentos` em `planoTopologiaAdapter.ts` (o mapa usa a mesma
 * lógica pra sintetizar a composição do Bloco), aqui reaproveitada pela Composição Geral (ver
 * `ComposicaoGeralSecao`). Nunca inclui os vagões "incluído" (previstos pelo "Depois" de cada
 * Grupo): esses ainda não existem fisicamente no Bloco, misturá-los aqui leria como "já estão no
 * trem". Ordem: locomotiva(s) primeiro, depois os demais vagões (normais e retirados, na ordem
 * física em que aparecem pela primeira vez).
 */
function derivarComposicaoDoBloco(bloco: BlocoManobra): ItemComposicao[] {
  const porId = new Map<string, ItemComposicao>();
  for (const cluster of bloco.clusters) {
    for (const item of cluster.composicao.antes) {
      if (item.tipo === 'incluido') continue; // ainda não existe fisicamente no bloco
      if (item.tipo === 'retirado') {
        porId.set(item.id, { id: item.id, tipo: 'retirado' });
      } else if (!porId.has(item.id)) {
        porId.set(item.id, item);
      }
    }
  }
  const todos = [...porId.values()];
  const locomotivas = todos.filter((v) => v.tipo === 'locomotiva');
  const vagoes = todos.filter((v) => v.tipo !== 'locomotiva');
  return [...locomotivas, ...vagoes];
}

/**
 * Composição do Bloco DEPOIS do plano executado — parte do físico já resolvido por
 * `derivarComposicaoDoBloco` (que já sabe, olhando TODOS os Clusters do Bloco, se um vagão foi
 * marcado "retirado" em algum deles — mesmo que outro Cluster o mencione só como vagão normal),
 * remove os retirados (já saíram) e anexa os "incluído" de todos os Clusters ao final (verde) —
 * o par exato do "antes", usado na Composição Geral pra montar a visão lado a lado (ver
 * `ComposicaoGeralSecao`).
 */
function derivarComposicaoDepoisDoBloco(bloco: BlocoManobra): ItemComposicao[] {
  const mantidos = derivarComposicaoDoBloco(bloco).filter((item) => item.tipo !== 'retirado');
  // Um vagão incluído por um Grupo mais cedo já aparece em `mantidos` (Grupos seguintes o citam
  // como vagão normal, já fisicamente presente na composição) — sem este filtro ele apareceria
  // duplicado: uma vez cinza (mantido) e outra verde (incluído).
  const idsMantidos = new Set(mantidos.map((item) => item.id));

  const incluidos: ItemComposicao[] = [];
  const vistos = new Set<string>();
  for (const cluster of bloco.clusters) {
    for (const item of cluster.composicao.depois) {
      if (item.tipo === 'incluido' && !vistos.has(item.id) && !idsMantidos.has(item.id)) {
        vistos.add(item.id);
        incluidos.push(item);
      }
    }
  }
  return [...mantidos, ...incluidos];
}

/**
 * Título de seção da aba "Visão Geral" — rótulo pequeno em caixa alta, FORA do painel, com uma
 * área opcional à direita pra ações da seção. 2026-09-24, pedido explícito do usuário: "mantenha o
 * mesmo padrão de título" — Métricas Gerais e Composição Geral do Trem usavam dois estilos
 * diferentes; agora as duas seções passam por aqui.
 */
function TituloSecao({ children, acoes }: { children: React.ReactNode; acoes?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between" style={{ gap: '0.75rem', minHeight: '1.375rem', marginBottom: '0.5rem' }}>
      <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: TEXT_LO, fontFamily: FONT }}>
        {children}
      </span>
      {acoes}
    </div>
  );
}

/** Subtítulo DENTRO de um painel (ex.: "Antes"/"Depois") — um nível abaixo de `TituloSecao`:
 *  caixa normal, peso médio, pra não competir com o título da seção. */
function SubtituloPainel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: TEXT_MD, fontFamily: FONT, marginBottom: '0.5rem' }}>
      {children}
    </div>
  );
}

/**
 * Uma linha da seção de Composição Geral — só o chip-grid do Bloco (o badge com o nome do Bloco
 * foi removido a pedido do usuário, 2026-09-24). `letra` só é passada pelo J105 V2, cuja
 * composição real vem separada em Blocos A/B/C (`COMPOSICAO_GERAL_J105_V2`) e precisa deles
 * demarcados como no plano de referência; os demais trens continuam sem badge.
 */
function LinhaBlocoComposicao({
  chave,
  letra,
  suave = false,
  itens,
  veiculosFoco,
  onFocarVeiculo,
}: {
  chave: string;
  letra?: string;
  /** Repassado a `TagVagao.suave` — ver lá (só o J105 V2). */
  suave?: boolean;
  itens: ItemComposicao[];
  /** Ver doc em `veiculosFoco`, `PlanejamentoScreen.tsx` — só usado pra marcar os chips
   *  selecionados (`TagVagao.selecionado`); a decisão de aceitar clique é `onFocarVeiculo`. */
  veiculosFoco?: Set<string> | null;
  /** 2026-08-27, pedido explícito do usuário: "só os trens 'antes' são clicáveis... os trens em
   *  'depois' não são selecionáveis" — quem decide se ESTA linha é clicável é o chamador
   *  (`ComposicaoGeralSecao`, abaixo): passa `onFocarVeiculo` na linha "Antes", `undefined` na
   *  "Depois". Este componente não sabe qual seção é — só repassa o que recebeu. */
  onFocarVeiculo?: (veiculoId: string) => void;
}) {
  const chips = (
    <div className="flex flex-wrap" style={{ gap: '0.25rem', flex: 1, minWidth: 0 }}>
      {itens.map((item, idx) => (
        <TagVagao
          key={`${chave}-${item.id}-${idx}`}
          item={item}
          selecionado={!!veiculosFoco?.has(item.id)}
          onClick={onFocarVeiculo ? () => onFocarVeiculo(item.id) : undefined}
          suave={suave}
          // Compacto junto com o suave (só J105 V2): mesma altura dos chips de locomotiva das
          // Métricas Gerais, pra a lista ocupar menos altura.
          compact={suave}
        />
      ))}
    </div>
  );
  if (!letra) return chips;
  return (
    <div className="flex items-start" style={{ gap: '0.5rem' }}>
      <span
        className="inline-flex items-center justify-center shrink-0"
        style={{
          width: '1.0625rem',
          height: '1.0625rem',
          borderRadius: '0.1875rem',
          // Quadrado claro com a letra escura (mockup do usuário, 2026-09-24) — o cinza sólido
          // anterior pesava mais que os próprios chips.
          backgroundColor: SURFACE,
          color: TEXT_MD,
          fontSize: '0.625rem',
          fontWeight: 700,
          fontFamily: FONT,
        }}
      >
        {letra}
      </span>
      {chips}
    </div>
  );
}

// `SecaoCartaoJ105V2` (o cabeçalho conectado validado 2026-09-24 na Visão Geral do J105 V2)
// generalizou 2026-09-25 pra `SecaoCartao` (`PageHeader.tsx`) — reaproveitado por outras telas
// (ex. Ficha Operacional), não mais duplicado aqui.

/** Item da legenda de cores no cabeçalho da Composição Geral do J105 V2 — quadradinho colorido +
 *  texto (o mockup troca a bolinha/ícone de `LegendaItem` por um quadrado). Mesmas cores dos
 *  chips (`TIPO_ITEM_ESTILO`/`TagVagao`), pra a legenda continuar batendo com o que se vê. */
function LegendaQuadrado({ cor, label }: { cor: string; label: string }) {
  return (
    <span className="flex items-center" style={{ gap: '0.3125rem', fontSize: '0.625rem', color: TEXT_LO, fontFamily: FONT, whiteSpace: 'nowrap' }}>
      <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '0.125rem', backgroundColor: cor }} />
      {label}
    </span>
  );
}

/**
 * "Composição Geral do Trem" do J105 V2 no padrão de seção com cabeçalho (`SecaoCartao`):
 * cabeçalho só com o título e, à direita, o "Limpar seleção" quando há veículo selecionado; no
 * corpo, o seletor Antes/Depois com a legenda de cores ao lado e um grupo por Bloco (A, B, C)
 * separados por divisor fino. Mesmos chips e mesmo clique de sempre (`LinhaBlocoComposicao`).
 */
function ComposicaoGeralCartaoJ105V2({
  blocos,
  veiculosFoco,
  onFocarVeiculo,
  onLimparFocoVeiculos,
}: {
  blocos: BlocoComposicaoGeralJ105V2[];
  veiculosFoco?: Set<string> | null;
  onFocarVeiculo?: (veiculoId: string) => void;
  onLimparFocoVeiculos?: () => void;
}) {
  // "Antes"/"Depois" alternados por um seletor segmentado, em vez de empilhados com rolagem —
  // 2026-09-24, pedido explícito do usuário ("um flap que mudo de antes para depois"). Começa em
  // "Antes" (o físico atual, o que se confere primeiro).
  const [lado, setLado] = useState<'antes' | 'depois'>('antes');
  const opcoes: { id: 'antes' | 'depois'; label: string }[] = [
    { id: 'antes', label: 'Antes' },
    { id: 'depois', label: 'Depois' },
  ];
  const seletor = (
    <div
      role="tablist"
      aria-label="Estado da composição"
      className="inline-flex"
      style={{ padding: '0.125rem', gap: '0.125rem', borderRadius: RADIUS, backgroundColor: SURFACE }}
    >
      {opcoes.map((o) => {
        const ativo = lado === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => setLado(o.id)}
            style={{
              height: '1.375rem',
              padding: '0 0.75rem',
              border: 'none',
              borderRadius: '0.25rem',
              backgroundColor: ativo ? PANEL_BG : 'transparent',
              boxShadow: ativo ? '0 1px 2px rgba(15, 23, 42, 0.12)' : undefined,
              color: ativo ? TEXT_HI : TEXT_LO,
              fontSize: '0.6875rem',
              fontWeight: ativo ? 600 : 500,
              fontFamily: FONT,
              cursor: 'pointer',
              transition: 'background-color 120ms ease, color 120ms ease',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
  const estado = (lado: 'antes' | 'depois') => (
    <div style={{ padding: '0.75rem 0 0.25rem' }}>
      <div className="flex flex-wrap items-center justify-between" style={{ gap: '0.5rem 0.75rem', marginBottom: '0.375rem' }}>
        {seletor}
        {/* Legenda ao lado do seletor, não no cabeçalho — 2026-09-24, pedido explícito do usuário:
            libera o cabeçalho (fica só título + Limpar seleção) e aproxima a legenda dos chips. */}
        <div className="flex flex-wrap items-center" style={{ gap: '0.25rem 0.75rem' }}>
          <LegendaQuadrado cor="var(--vli-wagon-locomotiva-fg)" label="Locomotiva" />
          <LegendaQuadrado cor="var(--vli-wagon-vagao-fg)" label="Vagão" />
          <LegendaQuadrado cor={DANGER_TEXT} label="Retirado" />
          <LegendaQuadrado cor={SUCCESS_TEXT} label="Adicionado" />
        </div>
      </div>
      {blocos.map((b, i) => (
        <div key={`${lado}-${b.letra}`} style={{ padding: '0.5rem 0', borderTop: i === 0 ? undefined : `1px solid ${DIVISOR_FICHA}` }}>
          <LinhaBlocoComposicao
            chave={`${lado}-${b.letra}`}
            letra={b.letra}
            suave
            itens={b[lado]}
            veiculosFoco={veiculosFoco}
            onFocarVeiculo={onFocarVeiculo}
          />
        </div>
      ))}
    </div>
  );

  return (
    <SecaoCartao
      icone={Train}
      titulo="Composição Geral do Trem"
      direita={
          !!veiculosFoco?.size && onLimparFocoVeiculos ? (
            <button
              type="button"
              onClick={onLimparFocoVeiculos}
              className="flex items-center"
              style={{
                gap: '0.25rem',
                height: '1.125rem',
                padding: '0 0.4375rem',
                borderRadius: '0.1875rem',
                border: `1px solid ${BORDER}`,
                backgroundColor: PANEL_BG,
                color: TEXT_LO,
                fontSize: '0.625rem',
                fontWeight: 600,
                fontFamily: FONT,
                cursor: 'pointer',
                transition: 'color 120ms ease, border-color 120ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_HI; e.currentTarget.style.borderColor = TEXT_LO; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_LO; e.currentTarget.style.borderColor = BORDER; }}
            >
              <RotateCcw size="0.625rem" strokeWidth={2.5} />
              Limpar seleção ({veiculosFoco.size})
            </button>
          ) : undefined
      }
    >
      {estado(lado)}
    </SecaoCartao>
  );
}

/**
 * Conteúdo de "Composição Geral do Trem" — Antes/Depois de todos os Blocos de uma vez, embutido
 * direto na aba "Visão Geral" (não é mais modal: o operador não precisa clicar em nada pra ver
 * o panorama inteiro, já é a própria aba). "Antes" é o físico atual (retirados marcados, ainda
 * presentes); "Depois" é o físico já sem os retirados e com os incluídos previstos.
 */
function ComposicaoGeralSecao({
  plano,
  blocosJ105V2,
  veiculosFoco,
  onFocarVeiculo,
  onLimparFocoVeiculos,
}: {
  plano: PlanoManobra;
  /** Só o J105 V2: composição real por Bloco A/B/C (`COMPOSICAO_GERAL_J105_V2`) no lugar da
   *  derivada de `plano.blocos` (que nele é sintetizada, numeração fictícia). Nela "Depois"
   *  também é clicável — 2026-09-24, pedido explícito do usuário: "seja no estado Antes ou
   *  Depois". */
  blocosJ105V2?: BlocoComposicaoGeralJ105V2[];
  veiculosFoco?: Set<string> | null;
  onFocarVeiculo?: (veiculoId: string) => void;
  onLimparFocoVeiculos?: () => void;
}) {
  if (blocosJ105V2) {
    return (
      <ComposicaoGeralCartaoJ105V2
        blocos={blocosJ105V2}
        veiculosFoco={veiculosFoco}
        onFocarVeiculo={onFocarVeiculo}
        onLimparFocoVeiculos={onLimparFocoVeiculos}
      />
    );
  }
  const linhasAntes = blocosJ105V2
    ? blocosJ105V2.map((b) => ({ chave: `antes-${b.letra}`, letra: b.letra as string | undefined, itens: b.antes }))
    : plano.blocos.map((bloco) => ({ chave: `antes-${bloco.id}`, letra: undefined, itens: derivarComposicaoDoBloco(bloco) }));
  const linhasDepois = blocosJ105V2
    ? blocosJ105V2.map((b) => ({ chave: `depois-${b.letra}`, letra: b.letra as string | undefined, itens: b.depois }))
    : plano.blocos.map((bloco) => ({ chave: `depois-${bloco.id}`, letra: undefined, itens: derivarComposicaoDepoisDoBloco(bloco) }));
  return (
    <div>
      <TituloSecao
        acoes={
          !!veiculosFoco?.size && onLimparFocoVeiculos ? (
            <button
              type="button"
              onClick={onLimparFocoVeiculos}
              className="flex items-center"
              style={{
                gap: '0.25rem',
                height: '1.375rem',
                padding: '0 0.5rem',
                borderRadius: '0.1875rem',
                border: `1px solid ${BORDER}`,
                backgroundColor: 'transparent',
                color: TEXT_LO,
                fontSize: '0.65625rem',
                fontWeight: 600,
                fontFamily: FONT,
                cursor: 'pointer',
                transition: 'color 120ms ease, border-color 120ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_HI; e.currentTarget.style.borderColor = TEXT_LO; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_LO; e.currentTarget.style.borderColor = BORDER; }}
            >
              <RotateCcw size="0.6875rem" strokeWidth={2.5} />
              Limpar seleção ({veiculosFoco!.size})
            </button>
          ) : undefined
        }
      >
        Composição Geral do Trem
      </TituloSecao>
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: RADIUS, backgroundColor: PANEL_BG, padding: '0.875rem' }}>
      <div className="flex flex-wrap items-center" style={{ gap: '0.375rem 0.875rem', marginBottom: '0.875rem' }}>
        {/* Cores iguais às de `TIPO_ITEM_ESTILO`/`TagVagao` acima — 2026-08-27, pedido explícito
           do usuário: "deixe na legenda os vagões também" (não existia item de Vagão na
           legenda; Locomotiva também ganhou a cor nova, antes neutra/TEXT_HI). 2026-08-28:
           `-fg` em vez de `-border` (ver comentário em `TIPO_ITEM_ESTILO`) — legenda tem que
           continuar batendo com a cor real do chip abaixo. */}
        <LegendaItem cor="var(--vli-wagon-locomotiva-fg)" label="Locomotiva" icon={<Train size="0.6875rem" strokeWidth={2.5} color="var(--vli-wagon-locomotiva-fg)" />} />
        <LegendaItem cor="var(--vli-wagon-vagao-fg)" label="Vagão" />
        <LegendaItem cor={DANGER_TEXT} label="Retirado" />
        <LegendaItem cor={SUCCESS_TEXT} label="Adicionado" />
        {/* Só aparece com alguma seleção ativa (2026-08-28, pedido explícito do usuário) — sem
           isso, um botão "Limpar seleção" sempre visível seria ruído quando não há nada pra
           limpar. */}
      </div>

      <SubtituloPainel>Antes</SubtituloPainel>
      <div className="flex flex-col" style={{ gap: '0.625rem' }}>
        {linhasAntes.map((linha) => (
          <LinhaBlocoComposicao
            key={linha.chave}
            chave={linha.chave}
            letra={linha.letra}
            itens={linha.itens}
            veiculosFoco={veiculosFoco}
            onFocarVeiculo={onFocarVeiculo}
          />
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${BORDER}`, margin: '1.125rem 0' }} />

      <SubtituloPainel>Depois</SubtituloPainel>
      <div className="flex flex-col" style={{ gap: '0.625rem' }}>
        {linhasDepois.map((linha) => (
          // 2026-08-27, pedido explícito do usuário: "os trens em 'depois' não são selecionáveis"
          // — SEM `onFocarVeiculo` aqui (`TagVagao` só vira clicável quando recebe `onClick`, ver
          // `LinhaBlocoComposicao`/`TagVagao`); `veiculosFoco` continua repassado só pra refletir
          // visualmente (`selecionado`) o mesmo veículo já escolhido em "Antes", se ainda presente.
          // Exceção: J105 V2 (`blocosJ105V2`), onde "Depois" também é clicável.
          <LinhaBlocoComposicao
            key={linha.chave}
            chave={linha.chave}
            letra={linha.letra}
            itens={linha.itens}
            veiculosFoco={veiculosFoco}
            onFocarVeiculo={blocosJ105V2 ? onFocarVeiculo : undefined}
          />
        ))}
      </div>
    </div>
    </div>
  );
}

/** Um card do painel "Métricas Gerais" — rótulo pequeno, valor em destaque e, opcionalmente, uma
 *  linha de detalhe abaixo. `flex: 1` faz os 5 cards dividirem a largura toda em blocos
 *  horizontais (ver `MetricasGeraisSecao`), em vez de uma lista de texto corrido. */
function CardMetrica({ label, valor, sub }: { label: string; valor: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div
      style={{
        flex: '1 1 9.375rem',
        minWidth: '9.375rem',
        padding: '0.625rem 0.875rem',
        border: `1px solid ${BORDER}`,
        borderRadius: RADIUS,
        backgroundColor: SURFACE,
      }}
    >
      <div style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: TEXT_LO, fontFamily: FONT, whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div className="flex items-center" style={{ gap: '0.25rem', fontSize: '1rem', fontWeight: 700, color: TEXT_HI, fontFamily: FONT, marginTop: '0.25rem', whiteSpace: 'nowrap' }}>
        {valor}
      </div>
      {sub && (
        <div style={{ fontSize: '0.625rem', color: TEXT_LO, fontFamily: FONT, marginTop: '0.1875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/**
 * Resumo do plano inteiro — Locomotivas/Blocos/Vagões/Comprimento/Tempo Planejado, em blocos
 * horizontais (um `CardMetrica` por métrica, `flex-wrap` só entra em ação se a largura não
 * comportar as 5 lado a lado). Vive na aba "Visão Geral" (ver `VisaoGeralConteudo`).
 */
function MetricasGeraisSecao({ plano }: { plano: PlanoManobra }) {
  const m = useMemo(() => metricasGeraisPlano(plano), [plano]);
  return (
    <div>
      <TituloSecao>Métricas Gerais</TituloSecao>
      <div className="flex flex-wrap" style={{ gap: '0.625rem' }}>
        <CardMetrica label="Locomotivas" valor={m.locomotivasCount} sub={m.locomotivasIds.join(' · ') || undefined} />
        <CardMetrica label="Blocos" valor={plano.blocos.length} sub={m.blocosNomes.join(', ') || undefined} />
        <CardMetrica
          label="Vagões"
          valor={<>{m.vagoesAntes}<ArrowRight size="0.75rem" color={TEXT_LO} />{m.vagoesDepois}</>}
          sub={`${m.retirados} retirado${m.retirados !== 1 ? 's' : ''} · ${m.incluidos} incluído${m.incluidos !== 1 ? 's' : ''}`}
        />
        <CardMetrica
          label="Comprimento"
          valor={<>{m.comprimentoAntesM}<ArrowRight size="0.75rem" color={TEXT_LO} />{m.comprimentoDepoisM} m</>}
        />
        <CardMetrica
          label="Tempo Planejado"
          valor={formatarDuracaoMin(m.tempoPlanejadoMin)}
          sub={`${m.gruposCount} grupo${m.gruposCount !== 1 ? 's' : ''}`}
        />
      </div>
    </div>
  );
}

/** Um valor da faixa compacta de métricas do J105 V2 — rótulo pequeno em cima, valor logo abaixo,
 *  sem card próprio (a faixa inteira é UM painel, as métricas são separadas por divisória). */
function MetricaFaixa({ label, children, detalhe }: { label: string; children: React.ReactNode; detalhe?: React.ReactNode }) {
  // Divisória à esquerda de TODAS; a da 1ª de cada linha cai fora da área visível (ver o
  // `overflow: hidden` + margem negativa em `MetricasGeraisFaixaJ105V2`), então quando o painel
  // estreita e as métricas quebram de linha nenhuma fica com divisória pendurada.
  return (
    <div className="flex flex-col" style={{ flex: '0 1 auto', gap: '0.1875rem', minWidth: 0, padding: '0 1.25rem 0 0.875rem', borderLeft: `1px solid ${DIVISOR_FICHA}` }}>
      <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: TEXT_LO, fontFamily: FONT }}>
        {label}
      </span>
      <span className="flex flex-wrap items-center" style={{ gap: '0 0.25rem', fontSize: '1.125rem', fontWeight: 700, color: TEXT_HI, fontFamily: FONT, fontVariantNumeric: 'tabular-nums' }}>
        {children}
      </span>
      {detalhe && (
        <span style={{ fontSize: '0.59375rem', color: TEXT_LO, fontFamily: FONT }}>{detalhe}</span>
      )}
    </div>
  );
}

const formatarMetros = (m: number) => m.toLocaleString('pt-BR');
const formatarToneladas = (t: number) => t.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/**
 * "Métricas Gerais" do J105 V2 — 2026-09-24, pedido explícito do usuário: valores reais (ver
 * `metricasGeraisJ105V2`) e bem menos altura que os 5 cards de `MetricasGeraisSecao`, pra
 * Composição Geral do Trem (o que mais se consulta nesta aba) subir na tela. Uma faixa só, em
 * dois níveis de peso:
 * - linha principal — Vagões, Tempo Planejado, Comprimento e Peso Bruto, o que muda de trem pra trem e se
 *   confere no dia a dia (valor maior, Antes → Depois);
 * - linha de apoio — Locomotivas e Blocos, consulta ocasional (e já visíveis nos chips da
 *   Composição Geral logo abaixo), em texto corrido discreto, sem perder nenhum id.
 * Exclusivo do J105 V2; os demais trens continuam em `MetricasGeraisSecao`.
 */
function MetricasGeraisFaixaJ105V2() {
  const m = useMemo(() => metricasGeraisJ105V2(DURACAO_TOTAL_J105), []);
  return (
    <SecaoCartao icone={BarChart3} titulo="Métricas Gerais">
      {/* flex-wrap: em painel estreito as métricas descem pra linha de baixo (e o valor de cada
          uma quebra dentro dela) em vez de se sobrepor. A margem negativa empurra a divisória da
          1ª métrica de cada linha pra fora do `overflow: hidden`. */}
      <div style={{ overflow: 'hidden', padding: '0.75rem 0' }}>
      <div className="flex flex-wrap" style={{ rowGap: '0.75rem', marginLeft: 'calc(-0.875rem - 1px)' }}>
        <MetricaFaixa
          label="Vagões"
          detalhe={
            <>
              <span style={{ color: DANGER_TEXT, fontWeight: 600 }}>{m.retirados} retirados</span>
              {' · '}
              <span style={{ color: SUCCESS_TEXT, fontWeight: 600 }}>{m.incluidos} incluído{m.incluidos !== 1 ? 's' : ''}</span>
            </>
          }
        >
          {m.vagoesAntes}
          <ArrowRight size="0.75rem" color={TEXT_LO} />
          {m.vagoesDepois}
        </MetricaFaixa>
        <MetricaFaixa label="Tempo Planejado" detalhe="min:s">
          {formatarRelogioJ105(m.tempoPlanejadoS)}
        </MetricaFaixa>
        <MetricaFaixa label="Comprimento" detalhe="inicial → final">
          {formatarMetros(m.comprimentoAntesM)}
          <ArrowRight size="0.75rem" color={TEXT_LO} />
          {formatarMetros(m.comprimentoDepoisM)} m
        </MetricaFaixa>
        <MetricaFaixa label="Peso Bruto" detalhe="inicial → final">
          {formatarToneladas(m.pesoBrutoAntesT)}
          <ArrowRight size="0.75rem" color={TEXT_LO} />
          {formatarToneladas(m.pesoBrutoDepoisT)} t
        </MetricaFaixa>
      </div>
      </div>
      <div
        className="flex flex-wrap items-center"
        style={{ gap: '0.25rem 1.25rem', padding: '0.625rem 0', borderTop: `1px solid ${DIVISOR_FICHA}`, fontSize: '0.6875rem', color: TEXT_LO, fontFamily: FONT }}
      >
        {/* Locomotivas como chips laranja, no mesmo tom dos chips de locomotiva da Composição
            Geral (`TIPO_ITEM_ESTILO.locomotiva`), e o ícone também laranja — 2026-09-24, pedido
            explícito do usuário. Sem o ícone de trem dentro de cada chip: o da linha já diz o que
            eles são. */}
        <span className="flex flex-wrap items-center" style={{ gap: '0.3125rem' }}>
          <Train size="0.75rem" strokeWidth={2} color={TIPO_ITEM_ESTILO.locomotiva.cor} />
          <strong style={{ color: TEXT_HI, fontWeight: 700 }}>{m.locomotivasIds.length} locomotivas</strong>
          {m.locomotivasIds.map((id) => (
            <span
              key={id}
              className="inline-flex items-center"
              style={{
                height: '1.0625rem',
                padding: '0 0.3125rem',
                borderRadius: '0.1875rem',
                // Mesmo tom clarinho dos chips suaves da Composição Geral (`TagVagao.suave`).
                border: `1px solid color-mix(in srgb, ${TIPO_ITEM_ESTILO.locomotiva.cor} 45%, var(--vli-panel-bg))`,
                backgroundColor: `color-mix(in srgb, ${TIPO_ITEM_ESTILO.locomotiva.bg} 55%, var(--vli-panel-bg))`,
                color: TIPO_ITEM_ESTILO.locomotiva.cor,
                fontSize: '0.59375rem',
                fontWeight: 600,
                fontFamily: FONT,
                whiteSpace: 'nowrap',
              }}
            >
              {id}
            </span>
          ))}
        </span>
        <span>
          <strong style={{ color: TEXT_HI, fontWeight: 700 }}>{m.blocos.length} blocos</strong> {m.blocos.join(', ')}
        </span>
      </div>
    </SecaoCartao>
  );
}

/** Aba "Visão Geral" — Métricas Gerais (blocos horizontais) + Composição Geral do trem, sempre
 *  visíveis, roláveis juntas; nenhum dos dois precisa mais de clique/modal pra aparecer. */
function VisaoGeralConteudo({
  plano,
  veiculosFoco,
  onFocarVeiculo,
  onLimparFocoVeiculos,
}: {
  plano: PlanoManobra;
  veiculosFoco?: Set<string> | null;
  onFocarVeiculo?: (veiculoId: string) => void;
  onLimparFocoVeiculos?: () => void;
}) {
  return (
    <div className="flex flex-col no-print" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1rem', gap: '1.25rem' }}>
      {plano.trem === TREM_J105_V2 ? (
        <MetricasGeraisFaixaJ105V2 />
      ) : (
        <MetricasGeraisSecao plano={plano} />
      )}
      <ComposicaoGeralSecao
        plano={plano}
        blocosJ105V2={plano.trem === TREM_J105_V2 ? COMPOSICAO_GERAL_J105_V2 : undefined}
        veiculosFoco={veiculosFoco}
        onFocarVeiculo={onFocarVeiculo}
        onLimparFocoVeiculos={onLimparFocoVeiculos}
      />
    </div>
  );
}

/**
 * Subheader de 2 abas — "Visão Geral" (Métricas + Composição Geral, ver `VisaoGeralConteudo`) e
 * "Manobras" (Blocos A/B, ver `BlocoAccordionItem`) — fica entre o header do trem/OS e o
 * conteúdo, mesmo padrão visual de aba sublinhada (sem depender do componente genérico
 * `ui/tabs.tsx`, que usa tokens Tailwind/shadcn não mapeados pras cores `--vli-*` deste app).
 */
function AbaSubheader({ aba, onChange }: { aba: AbaPlano; onChange: (a: AbaPlano) => void }) {
  const abas: { id: AbaPlano; label: string }[] = [
    { id: 'geral', label: 'Visão Geral' },
    { id: 'manobras', label: 'Manobras' },
  ];
  return (
    <div className="flex items-center no-print shrink-0" style={{ gap: '1.375rem', borderBottom: `1px solid ${BORDER}`, padding: '0 1.25rem' }}>
      {abas.map((a) => {
        const ativo = aba === a.id;
        return (
          <button
            key={a.id}
            onClick={() => onChange(a.id)}
            style={{
              padding: '0.625rem 0.125rem',
              background: 'transparent',
              border: 'none',
              borderBottom: `0.125rem solid ${ativo ? VLI_PRIMARY_SOLID : 'transparent'}`,
              color: ativo ? TEXT_HI : TEXT_LO,
              fontSize: '0.75rem',
              fontWeight: ativo ? 700 : 500,
              fontFamily: FONT,
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.color = TEXT_MD; }}
            onMouseLeave={(e) => { if (!ativo) e.currentTarget.style.color = TEXT_LO; }}
          >
            {a.label}
          </button>
        );
      })}
    </div>
  );
}

/** Largura da coluna do número (`PassoJ105Linha`) — a célula INTEIRA (altura da linha toda, não
 *  um quadradinho pequeno flutuando nela) é o indicador, como a primeira coluna de uma tabela. */
const PASSO_J105_COL_NUMERO = '1.75rem';

/**
 * Linha densa de um único passo do J105 — formato exclusivo deste trem, 1 linha por passo (2026-
 * 09-22, pedido explícito do usuário, complemento à densidade já pedida antes), desenhada como
 * TABELA: coluna do número (largura fixa, altura igual à da própria linha, separada da frase por
 * um traço vertical) + coluna da frase + chevron de detalhes, com um divisor horizontal (1px)
 * entre cada linha (item, não a linha colapsada sozinha — ver `AccordionPrimitive.Item` abaixo,
 * pra o traço nunca ficar espremido entre a linha e o próprio painel expandido dela) — pedido
 * explícito do usuário depois de ver a 1ª versão (quadrado pequeno solto): "quero que ele seja do
 * tamanho da linha mesmo... pode ter um divider entre cada linha, como se fosse uma tabela mesmo".
 * - Número (não mais "Passo N —" repetido no texto): preenche a coluna inteira, sem noção de
 *   "executado" no produto (esta tela é só planejamento, ver doc de `PassosJ105Lista`) — fica
 *   neutro, só troca de cor no passo ATIVO (preenchido com a cor de destaque).
 * - `cluster.resumoProblema` (= `passo.titulo` de `planoManobraJ105.ts`, SEM o prefixo "Passo N —"
 *   — esse número já vive só na coluna à esquerda agora) no tamanho da lista de trens da sidebar
 *   (`LinhaTrem`, 0.75rem) — peso/cor invertidos do texto comum pro ativo: cinza (`TEXT_MD`) nos
 *   demais, branco de alto contraste (`TEXT_HI`) + peso 600 só no ativo (pedido explícito:
 *   "texto em branco puro vs. cinza nos demais").
 * - Chevron à direita (2026-09-22, pedido explícito do usuário, substitui o ícone `Users` com
 *   tooltip da rodada anterior: "quero remover esse ícone de agentes. no lugar dele, pode deixar
 *   um chevron que, ao clicar deve expandir para um texto mais completo abaixo") — clicar nele
 *   expande um painel com "Envolvidos" (renomeado de "Agentes", mesmo pedido) e o parágrafo
 *   completo de procedimento (`etapa.instrucaoCompleta`), semelhante às imagens de referência do
 *   plano (`J105/passo-*.jpg`, que trazem o detalhamento por extenso). `AccordionPrimitive`
 *   (Radix) com as MESMAS classes (`vli-collapsible-trigger`/`vli-collapsible-content`/
 *   `vli-chevron`, `theme.css`) que o resto do produto já usa pra colapsáveis (ex.:
 *   `RestrictionsList`) — sem CSS novo. O Trigger fica isolado só no botão do chevron
 *   (`stopPropagation` no clique) pra não competir com o clique na LINHA.
 * - Clicar na LINHA (2026-09-23, pedido explícito do usuário: "sempre que eu clicar em algum
 *   passo de manobra, já deve expandir os detalhes da descrição") força `expandido = true` (nunca
 *   fecha — só o chevron fecha, ver `onClick` abaixo) além de continuar selecionando o passo na
 *   Visão Topológica, reaproveitando EXATAMENTE o mesmo mecanismo dos outros trens
 *   (`construirDestaqueEtapa` + `onDestaqueChange`, mesmo par usado por `selecionarEtapa` em
 *   `GrupoAccordionItem`) — nenhum estado paralelo. `linha`/`direção`/AMV/posição continuam vivos
 *   em `etapa.apoio` (usados pelo mapa), só não aparecem como badge aqui.
 * - Envolvidos em CHIPS (2026-09-23, pedido explícito do usuário: "os envolvidos podem estar em
 *   chips"), não mais texto corrido — um chip neutro por pessoa/função (`EnvolvidoChip`), mesma
 *   linguagem visual (canto arredondado, borda + fundo translúcido) dos chips de vagão
 *   (`TagVagao`) só que sem cor semântica (agente não tem "tipo" pra mapear numa cor). SEM o
 *   rótulo "Envolvidos" acima deles (2026-09-23, pedido explícito do usuário, esclarecido depois
 *   de uma 1ª leitura errada que tinha removido os chips junto: "o chip de maquinista de viagem e
 *   operador pode manter tá? só o título 'envolvidos'") — os próprios chips já comunicam quem
 *   está envolvido, o rótulo era redundante.
 * - Divisor entre a linha (título) e o painel expandido (2026-09-23, pedido explícito do usuário:
 *   "deixe um divider entre o título e a descrição") — `borderTop` no próprio
 *   `AccordionPrimitive.Content`, largura cheia (não alinhado ao recuo do texto), separando
 *   visualmente o cabeçalho do conteúdo.
 * - Área aberta (linha + painel, enquanto `expandido`) num tom azul clarinho (2026-09-23, pedido
 *   explícito do usuário: "toda área aberta pode ser um tom azul clarinho") — MESMO token
 *   `--vli-active-bg` que já marca o passo ATIVO (o fundo já era exatamente esse "azul clarinho"
 *   translúcido só pro `ativo`; agora também acende quando só `expandido`, sem `ativo` — ex.:
 *   abrindo pelo chevron um passo que não é o selecionado no mapa).
 * - SÓ UM passo expandido por vez (2026-09-23, pedido explícito do usuário: "só deve expandir um
 *   passo por vez") — `expandido` NÃO é mais estado local deste componente; vem de
 *   `PassosJ105Lista` (um único `expandidoId` pra lista inteira, mesmo padrão de "accordion
 *   exclusivo" que `BlocoAccordionItem`/`GrupoAccordionItem` já usam pros demais trens — abrir um
 *   fecha automaticamente o anterior).
 * - Clicar na LINHA inteira ou só no chevron sempre EXPANDE quando fechado (pedido explícito:
 *   "deve expandir independente se clica na área toda ou só na setinha") — mas os dois têm
 *   ALCANCES diferentes: a linha também seleciona/deseleciona no mapa (`onClick`, montado por
 *   `PassosJ105Lista`); o chevron (`onAlternarExpansao`) só abre/fecha o painel, nunca mexe no
 *   mapa — mesma separação de sempre (`stopPropagation` no chevron).
 * - Clicar de novo na linha que JÁ está aberta FECHA e deseleciona o mapa, voltando ao foco geral
 *   do trem (2026-09-23, pedido explícito do usuário: "se eu clico de volta no passo que está
 *   aberto, ele deve fechar, e 'desselecionar' o mapa volta pro foco no trem geral e tira o
 *   foco") — a lógica de abrir vs. fechar (e selecionar vs. desselecionar) mora inteira em
 *   `onClick`, construído por `PassosJ105Lista` a partir do `expandido` atual; este componente só
 *   chama o que recebe, sem replicar a decisão aqui.
 * - Setas ↑/↓ navegam pro passo anterior/seguinte (2026-09-23, pedido explícito do usuário: "além
 *   do click 1 por 1... posso usar a setinha pra cima e pra baixo, pra ir passando rápidamente os
 *   planos") — só funciona com a LINHA em foco de teclado (`tabIndex=0`, clique/Tab chegam nela
 *   normalmente); `onNavegar`, montado por `PassosJ105Lista`, sempre ABRE+seleciona o passo
 *   vizinho (nunca fecha/alterna — diferente do clique na própria linha) e move o foco de teclado
 *   pra ele, pra a segunda seta em sequência continuar do novo passo, não do antigo.
 */
function PassoJ105Linha({
  cluster,
  numero,
  ultimo,
  ativo,
  expandido,
  onAlternarExpansao,
  onClick,
  onNavegar,
  rowRef,
  ficha,
}: {
  cluster: ClusterManobra;
  /** Só o J105 V2: ficha técnica do passo (PDF v4, `fichaPassoJ105V2`) — quando presente, o
   *  painel expandido vira uma ficha em blocos (`FichaTecnicaPassoJ105`) em vez de só chips +
   *  parágrafo. Ausente = J105 V1, painel de sempre. */
  ficha?: FichaPassoJ105V2;
  /** Posição deste passo na sequência (1-based) — só pra coluna do número, não muda o `id` usado
   *  pra sincronizar com o mapa (esse continua vindo de `cluster`/`etapa`). */
  numero: number;
  /** Última linha da lista não ganha divisor embaixo (senão fecha a lista inteira com um traço
   *  solto, sem próxima linha pra "separar"). */
  ultimo: boolean;
  ativo: boolean;
  /** Se ESTE passo é o único expandido da lista (`expandidoId === cluster.id` em
   *  `PassosJ105Lista`) — não é mais estado próprio, ver doc acima. */
  expandido: boolean;
  /** Alterna SÓ a expansão deste passo (abre se fechado, fecha se aberto) — usado exclusivamente
   *  pelo chevron, nunca mexe na seleção do mapa. */
  onAlternarExpansao: () => void;
  /** Clique na linha inteira — decide abrir+selecionar ou fechar+desselecionar (ver doc acima);
   *  montado por `PassosJ105Lista`, que já sabe se este passo está `expandido`. */
  onClick: () => void;
  /** Seta ↑ ('anterior') ou ↓ ('proximo') — navega pro passo vizinho, ver doc acima. */
  onNavegar: (direcao: 'anterior' | 'proximo') => void;
  /** Guarda o nó DOM da linha em `PassosJ105Lista`, pra `onNavegar` conseguir mover o foco de
   *  teclado pro passo vizinho depois de selecioná-lo. */
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  const etapa = cluster.etapas[0];
  const envolvidos = etapa?.agentes && etapa.agentes.length > 0 ? etapa.agentes : undefined;
  const detalhe = etapa?.instrucaoCompleta;
  // "Área aberta" — linha + painel ficam no tom azul clarinho tanto quando o passo está ATIVO
  // (selecionado no mapa) quanto quando só está EXPANDIDO (aberto pelo chevron sem estar
  // selecionado) — ver doc acima.
  const aberto = ativo || expandido;
  // J105 V2 com o passo aberto: título em peso 600. O número continua no quadradinho de sempre
  // (o badge circular e a borda azul lateral do mockup foram revertidos a pedido do usuário).
  // Fechado, a linha segue igual à do V1.
  const cabecalhoFicha = !!ficha && expandido;
  // J105 V2: passo aberto em cinza neutro, com o azul reservado ao quadradinho do número
  // (2026-09-24, pedido explícito do usuário). V1 segue no azul clarinho de sempre.
  // Um pouco mais claro que `SURFACE` (mistura com o fundo do painel), pedido do usuário.
  const fundoAberto = ficha ? 'color-mix(in srgb, var(--vli-surface) 60%, var(--vli-panel-bg))' : 'var(--vli-active-bg)';

  return (
    <AccordionPrimitive.Root type="single" collapsible value={expandido ? 'detalhe' : ''} onValueChange={() => onAlternarExpansao()}>
      <AccordionPrimitive.Item value="detalhe" style={{ borderBottom: ultimo ? 'none' : `1px solid ${BORDER}` }}>
        <div
          ref={rowRef}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); onNavegar('proximo'); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); onNavegar('anterior'); }
          }}
          role="button"
          tabIndex={0}
          className="flex items-stretch w-full"
          style={{
            backgroundColor: aberto ? fundoAberto : 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: FONT,
            transition: 'background-color 0.15s',
            outline: 'none',
          }}
          onMouseEnter={(e) => { if (!aberto) e.currentTarget.style.backgroundColor = HOVER_TINT; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = aberto ? fundoAberto : 'transparent'; }}
        >
          {/* Coluna do número — mesma altura da linha inteira, como célula de tabela. */}
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: PASSO_J105_COL_NUMERO,
              borderRight: `1px solid ${BORDER}`,
              backgroundColor: ativo ? VLI_PRIMARY_SOLID : 'transparent',
              fontSize: '0.6875rem',
              fontWeight: ativo ? 700 : 500,
              color: ativo ? '#fff' : TEXT_LO,
              fontFamily: FONT,
            }}
          >
            {numero}
          </div>

          <div className="flex items-center" style={{ flex: 1, minWidth: 0, gap: '0.375rem', padding: '0.25rem 0.375rem 0.25rem 0.625rem' }}>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: '0.75rem',
                fontWeight: ativo || cabecalhoFicha ? 600 : 400,
                color: ativo || cabecalhoFicha ? TEXT_HI : TEXT_MD,
                fontFamily: FONT,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {cluster.resumoProblema}
            </span>

            <AccordionPrimitive.Header asChild>
              <span className="flex items-center shrink-0">
                <AccordionPrimitive.Trigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={expandido ? 'Recolher detalhes do passo' : 'Expandir detalhes do passo'}
                    className="vli-collapsible-trigger flex items-center justify-center transition-colors"
                    style={{ width: '1.125rem', height: '1.125rem', border: 'none', background: 'none', borderRadius: '0.25rem', padding: 0, cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = HOVER_TINT; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <ChevronDown size="0.75rem" color={TEXT_LO} className="vli-chevron" strokeWidth={2} />
                  </button>
                </AccordionPrimitive.Trigger>
              </span>
            </AccordionPrimitive.Header>
          </div>
        </div>

        {/* Mesmo fundo azul clarinho da linha aberta, nos dois trens — 2026-09-24, pedido
            explícito do usuário: o corpo branco da ficha do V2 perdia o destaque do passo aberto. */}
        <AccordionPrimitive.Content className="vli-collapsible-content" style={{ backgroundColor: fundoAberto, borderTop: `1px solid ${BORDER}` }}>
          {ficha ? (
            <FichaTecnicaPassoJ105 ficha={ficha} envolvidos={envolvidos} procedimento={detalhe} />
          ) : (
          <div style={{ padding: `0.5rem 0.625rem 0.625rem calc(${PASSO_J105_COL_NUMERO} + 0.625rem)`, fontFamily: FONT }}>
            {envolvidos && (
              <div className="flex flex-wrap items-center" style={{ gap: '0.25rem', marginBottom: detalhe ? '0.5rem' : 0 }}>
                {envolvidos.map((nome) => (
                  <EnvolvidoChip key={nome} nome={nome} />
                ))}
              </div>
            )}
            {detalhe && <div style={{ fontSize: '0.6875rem', color: TEXT_MD, lineHeight: 1.5 }}>{detalhe}</div>}
          </div>
          )}
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    </AccordionPrimitive.Root>
  );
}

/** Divisor da ficha do passo — bem mais claro que `BORDER` (separa seções de UMA superfície, não
 *  delimita caixas), derivado do token pra acompanhar o tema escuro. */
const DIVISOR_FICHA = 'color-mix(in srgb, var(--vli-border) 55%, transparent)';

const ROTULO_FICHA: React.CSSProperties = {
  fontSize: '0.5625rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: TEXT_LO,
  fontFamily: FONT,
  whiteSpace: 'nowrap',
};

/** Um dado técnico da linha de estatísticas — ícone + rótulo em cima, valor em negrito embaixo.
 *  Separado do vizinho só por divisória vertical fina (nunca por caixa). */
function EstatisticaFicha({ icone: Icone, label, children, primeira }: { icone: typeof Clock; label: string; children: React.ReactNode; primeira: boolean }) {
  return (
    <div
      className="flex flex-col"
      style={{
        flex: '1 1 0',
        minWidth: '4.5rem',
        gap: '0.1875rem',
        paddingLeft: primeira ? 0 : '0.75rem',
        borderLeft: primeira ? undefined : `1px solid ${DIVISOR_FICHA}`,
      }}
    >
      <span className="flex items-center" style={{ ...ROTULO_FICHA, gap: '0.25rem' }}>
        <Icone size="0.6875rem" strokeWidth={2} />
        {label}
      </span>
      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: TEXT_HI, fontFamily: FONT, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {children}
      </span>
    </div>
  );
}

/** Responsável pelo passo, na ficha do J105 V2 — pill neutra com ícone de pessoa, sem borda. */
function ResponsavelPill({ nome }: { nome: string }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: '0.25rem',
        height: '1.25rem',
        padding: '0 0.5rem',
        borderRadius: '999px',
        // Cinza um tom acima do fundo do passo aberto (`SURFACE`), sem borda: só o contraste
        // suficiente pra ler como chip, sem competir com o número em azul (2026-09-24, pedidos
        // explícitos do usuário).
        backgroundColor: 'color-mix(in srgb, var(--vli-text-lo) 14%, transparent)',
        color: TEXT_HI,
        fontSize: '0.625rem',
        fontWeight: 500,
        fontFamily: FONT,
        whiteSpace: 'nowrap',
      }}
    >
      <User size="0.6875rem" strokeWidth={2} color={TEXT_LO} />
      {nome}
    </span>
  );
}

/**
 * Painel expandido de um passo do J105 V2 como ficha técnica. 2026-09-24, pedido explícito do
 * usuário (com mockup): UMA superfície plana abaixo do cabeçalho, hierarquia só por tipografia e
 * divisores finos, sem caixas aninhadas. De cima pra baixo, separados por divisor:
 * - contexto (Bloco · Grupo) à esquerda e Responsáveis à direita, na mesma linha;
 * - estatísticas (Linha, Referência, Direção, Distância, Duração) numa linha só;
 * - Procedimento.
 * Campo sem valor no PDF (Referência/Direção "—") é omitido da linha, não vira espaço vazio.
 */
function FichaTecnicaPassoJ105({ ficha, envolvidos, procedimento }: { ficha: FichaPassoJ105V2; envolvidos?: string[]; procedimento?: string }) {
  // Passos fora de Bloco/Grupo (1, 37 e 38 — entrada e saída do pátio) mostram só o trem, pra a
  // linha de contexto não ficar vazia (2026-09-24, pedido explícito do usuário).
  const contexto = [ficha.bloco && `Bloco ${ficha.bloco}`, ficha.grupo && `Grupo ${ficha.grupo}`].filter(Boolean).join(' · ') || 'J105';
  // Sentido EDV = offset crescente da linha (direita no mapa), ECJ = decrescente (esquerda) —
  // mesma convenção de `etapaParada.ts`/`visualJ105.ts`.
  const IconeDirecao = ficha.direcao === 'ECJ' ? ArrowLeft : ArrowRight;
  const estatisticas: { icone: typeof Clock; label: string; valor: string }[] = [
    { icone: MapPin, label: 'Linha', valor: ficha.linha },
    ...(ficha.referencia ? [{ icone: Flag, label: 'Referência', valor: ficha.referencia }] : []),
    ...(ficha.direcao ? [{ icone: IconeDirecao, label: 'Direção', valor: ficha.direcao }] : []),
    { icone: Ruler, label: 'Distância', valor: `${ficha.distanciaM.toLocaleString('pt-BR')} m` },
    { icone: Clock, label: 'Duração', valor: ficha.duracao },
  ];
  const secao: React.CSSProperties = { padding: '0.625rem 0', borderTop: `1px solid ${DIVISOR_FICHA}` };
  return (
    <div style={{ padding: `0 0.875rem 0.25rem calc(${PASSO_J105_COL_NUMERO} + 0.625rem)`, fontFamily: FONT }}>
      {(contexto || envolvidos) && (
        <div className="flex flex-wrap items-center justify-between" style={{ gap: '0.375rem 0.75rem', padding: '0.625rem 0' }}>
          <span style={ROTULO_FICHA}>{contexto}</span>
          {envolvidos && (
            <div className="flex flex-wrap items-center" style={{ gap: '0.25rem' }}>
              {envolvidos.map((nome) => (
                <ResponsavelPill key={nome} nome={nome} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap" style={{ ...secao, rowGap: '0.5rem' }}>
        {estatisticas.map((e, i) => (
          <EstatisticaFicha key={e.label} icone={e.icone} label={e.label} primeira={i === 0}>
            {e.valor}
          </EstatisticaFicha>
        ))}
      </div>

      {procedimento && (
        <div style={secao}>
          <div style={{ ...ROTULO_FICHA, marginBottom: '0.25rem' }}>Procedimento</div>
          <div style={{ fontSize: '0.6875rem', color: TEXT_MD, lineHeight: 1.55 }}>{procedimento}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Passo corrente do J105 V2 em cima do mapa — 2026-09-30, pedido explícito do usuário: no modo
 * "Só Visão Topológica Atual" a lista de passos some, então o mapa precisa se bastar. Barra
 * discreta de UMA linha (mesma altura dos botões de zoom, fundo translúcido, sem sombra), pra
 * informar sem competir com o mapa: número + título do passo e, em texto secundário, os mesmos
 * dados da ficha da aba "Manobras" (`fichaPassoJ105V2`). Procedimento e responsáveis — texto
 * longo, consulta ocasional — ficam atrás do botão ⓘ, num painel que só abre sob demanda. Sem
 * setas próprias: a navegação é a dos controles da animação, que já movem este mesmo passo.
 */
export function PassoAtualMapaJ105({ plano, passo, totalPassos }: { plano: PlanoManobra; passo: number; totalPassos: number }) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const cluster = useMemo(() => {
    for (const bloco of plano.blocos) {
      for (const c of bloco.clusters) {
        if (c.etapas.some((e) => passoDoEtapaId(e.id) === passo)) return c;
      }
    }
    return undefined;
  }, [plano, passo]);
  const ficha = fichaPassoJ105V2(passo);
  if (!cluster) return null;
  const etapa = cluster.etapas[0];
  const envolvidos = etapa?.agentes && etapa.agentes.length > 0 ? etapa.agentes : [];
  const procedimento = etapa?.instrucaoCompleta;
  const temDetalhes = !!procedimento || envolvidos.length > 0;

  const contexto = ficha && [ficha.bloco && `Bloco ${ficha.bloco}`, ficha.grupo && ficha.grupo].filter(Boolean).join(' · ');
  const IconeDirecao = ficha?.direcao === 'ECJ' ? ArrowLeft : ArrowRight;
  const dados: { icone: typeof Clock; label: string; valor: string }[] = ficha
    ? [
        { icone: MapPin, label: 'Linha', valor: ficha.linha },
        ...(ficha.referencia ? [{ icone: Flag, label: 'Referência', valor: ficha.referencia }] : []),
        ...(ficha.direcao ? [{ icone: IconeDirecao, label: 'Direção', valor: ficha.direcao }] : []),
        { icone: Ruler, label: 'Distância', valor: `${ficha.distanciaM.toLocaleString('pt-BR')} m` },
        { icone: Clock, label: 'Duração', valor: ficha.duracao },
      ]
    : [];
  const fundo = 'color-mix(in srgb, var(--vli-panel-bg) 88%, transparent)';
  const separador = <span aria-hidden style={{ width: 1, height: '0.75rem', backgroundColor: BORDER, flexShrink: 0 }} />;

  return (
    <div className="relative" style={{ display: 'inline-flex', maxWidth: '100%', fontFamily: FONT, cursor: 'default' }}>
      <div
        className="flex items-center"
        style={{
          minWidth: 0,
          height: '1.875rem',
          gap: '0.5rem',
          padding: '0 0.25rem 0 0.3125rem',
          backgroundColor: fundo,
          backdropFilter: 'blur(4px)',
          border: `1px solid ${BORDER}`,
          borderRadius: RADIUS,
        }}
      >
        <span
          className="flex items-center justify-center shrink-0"
          title={`Passo ${passo} de ${totalPassos}`}
          style={{ minWidth: '1.25rem', height: '1.25rem', padding: '0 0.25rem', borderRadius: '0.25rem', backgroundColor: VLI_PRIMARY_SOLID, color: '#fff', fontSize: '0.625rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
        >
          {passo}
        </span>
        <span title={cluster.resumoProblema} style={{ flex: '1 1 auto', minWidth: '6rem', fontSize: '0.75rem', fontWeight: 600, color: TEXT_HI, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {cluster.resumoProblema}
        </span>
        {dados.length > 0 && (
          <>
            {separador}
            <span className="flex items-center" style={{ flex: '0 1 auto', minWidth: 0, gap: '0.625rem', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '0.6875rem', color: TEXT_MD, fontVariantNumeric: 'tabular-nums' }}>
              {contexto && <span style={{ ...ROTULO_FICHA, flexShrink: 0 }}>{contexto}</span>}
              {dados.map(({ icone: Icone, label, valor }) => (
                <span key={label} className="inline-flex items-center" title={label} style={{ gap: '0.1875rem', flexShrink: 0 }}>
                  <Icone size="0.6875rem" strokeWidth={2} color={TEXT_LO} aria-label={label} />
                  {valor}
                </span>
              ))}
            </span>
          </>
        )}
        {temDetalhes && (
          <button
            type="button"
            onClick={() => setDetalhesAbertos((v) => !v)}
            aria-expanded={detalhesAbertos}
            aria-label={detalhesAbertos ? 'Ocultar procedimento' : 'Ver procedimento'}
            title={detalhesAbertos ? 'Ocultar procedimento' : 'Ver procedimento e responsáveis'}
            className="flex items-center justify-center shrink-0"
            style={{
              width: '1.375rem', height: '1.375rem', border: 'none', borderRadius: '0.25rem', padding: 0, cursor: 'pointer',
              backgroundColor: detalhesAbertos ? 'var(--vli-active-bg)' : 'transparent',
              color: detalhesAbertos ? VLI_PRIMARY_SOLID : TEXT_LO,
            }}
          >
            <Info size="0.8125rem" strokeWidth={2} />
          </button>
        )}
      </div>

      {detalhesAbertos && temDetalhes && (
        <div
          className="absolute"
          style={{
            top: 'calc(100% + 0.25rem)',
            left: 0,
            width: 'min(28rem, 100%)',
            minWidth: 'min(18rem, 100%)',
            maxHeight: '14rem',
            overflowY: 'auto',
            padding: '0.625rem 0.75rem',
            backgroundColor: PANEL_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: RADIUS,
            boxShadow: 'var(--vli-shadow)',
            zIndex: 1,
          }}
        >
          {procedimento && (
            <>
              <div style={{ ...ROTULO_FICHA, marginBottom: '0.25rem' }}>Procedimento</div>
              <div style={{ fontSize: '0.6875rem', color: TEXT_MD, lineHeight: 1.55 }}>{procedimento}</div>
            </>
          )}
          {envolvidos.length > 0 && (
            <div className="flex flex-wrap items-center" style={{ gap: '0.25rem', marginTop: procedimento ? '0.5rem' : 0 }}>
              {envolvidos.map((nome) => <ResponsavelPill key={nome} nome={nome} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Chip de uma pessoa/função envolvida num passo do J105 (`PassoJ105Linha`) — mesma linguagem
 *  visual dos chips de vagão (`TagVagao`: canto arredondado, borda + texto na mesma cor), só que
 *  neutro (sem cor semântica — um agente não tem "tipo" pra mapear numa cor de domínio) e nunca
 *  clicável (é só informação, não referencia nada no mapa). */
function EnvolvidoChip({ nome }: { nome: string }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        height: '1.0625rem',
        padding: '0 0.375rem',
        borderRadius: '0.1875rem',
        border: `1px solid ${BORDER}`,
        backgroundColor: 'var(--vli-surface)',
        color: TEXT_MD,
        fontSize: '0.625rem',
        fontWeight: 500,
        fontFamily: FONT,
        whiteSpace: 'nowrap',
      }}
    >
      {nome}
    </span>
  );
}

/**
 * Aba "Manobras" do J105 — lista plana dos 38 passos, cada um com seu indicador numérico quadrado
 * (sem headers de Bloco/Grupo, ver `PassoJ105Linha`), reaproveitando o MESMO estado de destaque
 * (`destaque`/`onDestaqueChange`) que `BlocoAccordionItem`/`GrupoAccordionItem` usam pros demais
 * trens, só que num componente dedicado — nada em `BlocoAccordionItem`/`GrupoAccordionItem` foi
 * alterado para isto existir. Sem `gap` entre linhas — só o padding vertical mínimo de cada
 * `PassoJ105Linha` separa uma da seguinte, pra maximizar quantos passos cabem na tela.
 * `expandidoId` — QUAL passo tem o painel de detalhes aberto, ÚNICO pra lista inteira (2026-09-23,
 * pedido explícito do usuário: "só deve expandir um passo por vez") — abrir um fecha
 * automaticamente o anterior, mesmo espírito do accordion exclusivo de Bloco/Grupo dos demais
 * trens (ver comentário acima), só que vivendo aqui (não é o mesmo estado de `destaque`: dá pra
 * expandir um passo sem selecioná-lo no mapa, via o chevron).
 * Clicar na linha JÁ aberta fecha e deseleciona (2026-09-23, pedido explícito do usuário: "se eu
 * clico de volta no passo que está aberto, ele deve fechar, e 'desselecionar' o mapa volta pro
 * foco no trem geral") — `onDestaqueChange(null)` limpa o destaque por completo (não mais o
 * `{blocoId, clusterId}` parcial de antes, que mantinha um resquício de seleção); com `destaque`
 * nulo, `passoJ105` (`PlanejamentoScreen.tsx`) cai no fallback `?? 1`, e o Passo 1 é exatamente o
 * trem inteiro parado no pátio — o "foco geral" pedido, sem precisar de um caso especial pra ele.
 * Setas ↑/↓ passeiam pela lista inteira (2026-09-23, pedido explícito do usuário: "além do click 1
 * por 1... posso usar a setinha pra cima e pra baixo, pra ir passando rápidamente os planos") —
 * `selecionarIndice` é a MESMA lógica de "abrir+selecionar" que o clique-pra-abrir já usava,
 * extraída aqui pra não duplicar (a única diferença de uma seta pro clique é que a seta NUNCA
 * fecha/alterna, só anda pro vizinho); fora dos limites da lista (seta ↑ no passo 1, ↓ no
 * último), não faz nada. `linhaRefs` guarda o nó de cada linha só pra mover o foco de teclado
 * junto com a seleção — sem isso, a segunda seta em sequência navegaria a partir do passo
 * ANTIGO (o que ainda está com foco), não do que acabou de ficar selecionado.
 */
function PassosJ105Lista({
  plano,
  destaque = null,
  onDestaqueChange,
  seguirDestaque = false,
}: {
  plano: PlanoManobra;
  destaque?: DestaquePlano | null;
  onDestaqueChange?: (next: DestaquePlano | null) => void;
  /** J105 V2: a lista OBEDECE ao `destaque` que chega de fora, em vez de só reagir a clique.
   *  Ver o efeito abaixo. `false` (padrão, J105 V1) = comportamento de sempre, inalterado. */
  seguirDestaque?: boolean;
}) {
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const linhaRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const clusters = plano.blocos.flatMap((bloco) => bloco.clusters.map((cluster) => ({ blocoId: bloco.id, cluster })));

  /**
   * J105 V2 — o relógio da animação é quem manda: o passo do instante corrente abre sozinho
   * (fechando o anterior, já que `expandidoId` guarda um id só) e rola pra dentro da vista.
   *
   * 2026-09-23, pedido explícito do usuário: até aqui o indicador "PASSO N" embaixo do mapa e esta
   * lista eram duas fontes de verdade independentes — o relógio publicava o `destaque` (que só
   * pintava a linha de ativa) e a EXPANSÃO continuava presa ao clique manual. Passa a ser uma
   * fonte só: o tempo da animação empurra `destaque`, e este efeito reflete `destaque` na
   * expansão. Vale nos dois sentidos (tocar, arrastar o scrubber, pular de etapa, rebobinar), já
   * que todos eles mexem no mesmo `destaque`.
   *
   * NÃO chama `focus()` de propósito (diferente de `selecionarIndice`, que é resposta a uma ação
   * do teclado/mouse do usuário): roubar o foco a cada troca de passo tiraria o cursor de onde o
   * usuário estivesse — inclusive dos próprios controles de reprodução, que deixariam de receber
   * a barra de espaço/setas no meio da animação.
   */
  const clusterAtivoId = seguirDestaque ? destaque?.clusterId ?? null : null;
  useEffect(() => {
    if (!seguirDestaque) return;
    setExpandidoId(clusterAtivoId);
    if (!clusterAtivoId) return;
    linhaRefs.current[clusterAtivoId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [seguirDestaque, clusterAtivoId]);

  const selecionarIndice = (idx: number) => {
    const alvo = clusters[idx];
    if (!alvo) return;
    const { blocoId, cluster } = alvo;
    const etapa = cluster.etapas[0];
    setExpandidoId(cluster.id);
    linhaRefs.current[cluster.id]?.focus();
    if (!onDestaqueChange || !etapa || !etapaClicavelNoMapa(etapa)) return;
    const highlightEtapa = construirDestaqueEtapa(cluster, etapa);
    if (!highlightEtapa) return;
    onDestaqueChange({ blocoId, clusterId: cluster.id, etapa: highlightEtapa });
  };

  return (
    <div className="no-print flex flex-col" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {clusters.map(({ blocoId, cluster }, idx) => {
        const etapa = cluster.etapas[0];
        const ativo = destaque?.clusterId === cluster.id && destaque?.etapa?.etapaId === etapa?.id;
        const expandido = expandidoId === cluster.id;
        const clicavel = Boolean(onDestaqueChange && etapa && etapaClicavelNoMapa(etapa));
        return (
          <PassoJ105Linha
            key={cluster.id}
            cluster={cluster}
            numero={idx + 1}
            ultimo={idx === clusters.length - 1}
            ativo={ativo}
            expandido={expandido}
            rowRef={(el) => { linhaRefs.current[cluster.id] = el; }}
            ficha={seguirDestaque ? fichaPassoJ105V2(idx + 1) : undefined}
            onAlternarExpansao={() => setExpandidoId(expandido ? null : cluster.id)}
            onNavegar={(direcao) => selecionarIndice(direcao === 'proximo' ? idx + 1 : idx - 1)}
            onClick={() => {
              if (expandido) {
                // Já aberto — fecha e desseleciona (volta ao foco geral do trem, ver doc acima).
                setExpandidoId(null);
                if (clicavel) onDestaqueChange?.(null);
                return;
              }
              selecionarIndice(idx);
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Um Bloco inteiro — largura total, empilhado com os demais. Accordion EXCLUSIVO com os demais
 * Blocos (ver Root em `PlanManobraX`, mais abaixo): abrir um Bloco fecha automaticamente
 * qualquer outro que estivesse aberto. Ao expandir, mostra todos os seus Grupos, também em
 * accordion exclusivo entre si (só um Grupo aberto por vez dentro do Bloco). O "aberto" de
 * Bloco/Grupo é sempre exatamente `destaque` (a mesma seleção usada pelo destaque no mapa) — não
 * existe um estado de abertura separado do destaque, então os dois nunca dessincronizam. Sem
 * sticky (deu problema de conteúdo vazando por cima do cabeçalho durante a rolagem). Sempre tem
 * um botão de "novo grupo" ao lado do cabeçalho — a edição do plano é sempre possível, sem modo
 * de edição para ligar/desligar.
 */
function BlocoAccordionItem({
  bloco,
  editor,
  destaque = null,
  onDestaqueChange,
}: {
  bloco: BlocoManobra;
  editor: EditorPlano;
  destaque?: DestaquePlano | null;
  onDestaqueChange?: (next: DestaquePlano | null) => void;
}) {
  const blocoAberto = destaque?.blocoId === bloco.id;
  // "Ativo" pro Bloco inteiro é só quando NÃO há um Grupo específico destacado dentro dele —
  // selecionar um Grupo é mais específico que selecionar o Bloco todo, não os dois ao mesmo
  // tempo (mesma regra usada no mapa, ver `resolverLinhasCartao` em `Composition.tsx`).
  const ativo = blocoAberto && !destaque?.clusterId;
  const headerBg = ativo ? 'var(--vli-active-bg)' : SURFACE;
  return (
    <AccordionPrimitive.Item
      value={bloco.id}
      id={`bloco-${bloco.id}`}
      style={{ border: `1px solid ${BORDER}`, borderRadius: RADIUS, backgroundColor: PANEL_BG, boxShadow: 'var(--vli-shadow)', overflow: 'hidden', flexShrink: 0 }}
    >
      <div
        className="flex items-center"
        style={{ backgroundColor: headerBg }}
        // 2026-08-27, pedido explícito do usuário — mesmo hover que o cabeçalho de Grupo (acima
        // neste arquivo) já tinha; este de Bloco estava sem.
        onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.backgroundColor = HOVER_TINT; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = headerBg; }}
      >
        <AccordionPrimitive.Header style={{ flex: 1, minWidth: 0 }}>
          <HeaderTooltip label={"Destacar este bloco na Visão Topológica"}><AccordionPrimitive.Trigger
            className="vli-collapsible-trigger flex items-center justify-between w-full"
           
            style={{
              height: BLOCO_HEADER_H,
              padding: '0 0.875rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: FONT,
            }}
          >
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: TEXT_HI, fontFamily: FONT }}>
                {bloco.nome}
              </div>
              <div style={{ fontSize: '0.625rem', color: TEXT_LO, fontFamily: FONT, fontWeight: 400, marginTop: '0.125rem' }}>
                {bloco.locomotivas} loco + {bloco.vagoes} vagões · {bloco.clusters.length} grupo{bloco.clusters.length !== 1 ? 's' : ''} no bloco
              </div>
            </div>
            <ChevronDown size="1rem" color={TEXT_LO} className="vli-chevron" style={{ flexShrink: 0, marginLeft: '0.5rem' }} />
          </AccordionPrimitive.Trigger></HeaderTooltip>
        </AccordionPrimitive.Header>
      </div>
      <AccordionPrimitive.Content className="vli-collapsible-content">
        <AccordionPrimitive.Root
          type="single"
          collapsible
          value={blocoAberto ? destaque?.clusterId ?? '' : ''}
          onValueChange={(value) =>
            onDestaqueChange?.(value ? { blocoId: bloco.id, clusterId: value } : { blocoId: bloco.id })
          }
          className="flex flex-col"
          style={{ paddingTop: '0.25rem' }}
        >
          {bloco.clusters.map((cluster) => (
            <GrupoAccordionItem
              key={cluster.id}
              cluster={cluster}
              editor={editor}
              blocoId={bloco.id}
              ativo={destaque?.clusterId === cluster.id}
              destaque={destaque}
              onDestaqueChange={onDestaqueChange}
            />
          ))}
          {bloco.clusters.length === 0 && (
            <div style={{ padding: '1rem', fontSize: '0.6875rem', color: TEXT_LO, fontFamily: FONT, fontStyle: 'italic' }}>
              Nenhum grupo neste bloco.
            </div>
          )}
        </AccordionPrimitive.Root>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}

/** Um item da composição na impressão — mesma classificação visual do card (locomotiva/vagão/
 *  retirado/incluído), só que como texto simples com destaque de cor via classe (não chip). */
function ItemComposicaoImpressao({ item }: { item: ItemComposicao }) {
  if (item.tipo === 'retirado') return <span className="print-badge-alerta">{item.id} (retirado)</span>;
  if (item.tipo === 'incluido') return <span className="print-badge-sucesso">{item.id} (incluído)</span>;
  return <span>{item.id}{item.tipo === 'locomotiva' ? ' (loco)' : ''}</span>;
}

function ListaComposicaoImpressao({ itens }: { itens: ItemComposicao[] }) {
  return (
    <>
      {itens.map((item, i) => (
        <span key={item.id}>
          {i > 0 && ', '}
          <ItemComposicaoImpressao item={item} />
        </span>
      ))}
    </>
  );
}

/**
 * Conteúdo impresso de UM trem. Não carrega a classe `print-area` própria — quem a define é o
 * wrapper que a chama (`ImpressaoLotePlanos`), uma única vez pra todo o lote; isso evita ter
 * vários elementos `position: absolute` da `.print-area` se sobrepondo na mesma página (cada
 * trem aqui é só um bloco em fluxo normal, separado por `quebrarAntes`). */
function PlanoImpressao({ plano, patioNome, data, quebrarAntes = false }: { plano: PlanoManobra; patioNome?: string; data?: string; quebrarAntes?: boolean }) {
  const totalClusters = plano.blocos.reduce((soma, b) => soma + b.clusters.length, 0);
  const totalEtapas = plano.blocos.reduce(
    (soma, b) => soma + b.clusters.reduce((s, c) => s + c.etapas.length, 0),
    0,
  );
  const totalMin = plano.blocos.reduce(
    (soma, b) => soma + b.clusters.reduce((s, c) => s + duracaoClusterMin(c), 0),
    0,
  );
  const critico = clusterMaisCritico(plano);

  return (
    <div style={{ padding: 24, ...(quebrarAntes ? { breakBefore: 'page', pageBreakBefore: 'always' } : {}) }}>
      <div className="flex items-center" style={{ gap: 14, marginBottom: 16 }}>
        <img src={LogoVLI} alt="VLI" style={{ height: 30 }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>Plano de Manobras</div>
          <div style={{ fontSize: 12, fontFamily: FONT, marginTop: 2 }}>
            Trem {rotuloTrem(plano.trem)} · OS {plano.os}
            {patioNome && <> · Pátio {patioNome}</>}
            {data && <> · {formatarData(data)}</>}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #cbd5e1' }}>
        {plano.trem === TREM_J105_V2 ? (
          // J105 V2: mesmos valores reais da faixa de Métricas Gerais (`metricasGeraisJ105V2`) —
          // o plano compartilhado com o V1 tem 1 Bloco sintético e soma os passos como "grupos".
          (() => {
            const m = metricasGeraisJ105V2(DURACAO_TOTAL_J105);
            return (
              <>
                {m.blocos.length} blocos ({m.blocos.join(', ')}) · {m.locomotivasIds.length} locomotivas · {m.vagoesAntes} → {m.vagoesDepois} vagões · {formatarMetros(m.comprimentoAntesM)} → {formatarMetros(m.comprimentoDepoisM)} m · {totalEtapas} passos · tempo total estimado: {formatarRelogioJ105(m.tempoPlanejadoS)}
              </>
            );
          })()
        ) : (
          <>{plano.blocos.length} blocos · {totalClusters} grupos · {totalEtapas} etapas no plano · tempo total estimado: {formatarDuracaoMin(totalMin)}</>
        )}
        {critico && (
          <div style={{ marginTop: 4 }}>
            Mais urgente: <strong>{critico.cluster.titulo} · {critico.bloco.nome}</strong>
          </div>
        )}
      </div>

      {plano.blocos.map((bloco) => (
        <div key={bloco.id} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            {bloco.nome} — {bloco.locomotivas} loco + {bloco.vagoes} vagões
          </div>

          {bloco.clusters.map((cluster) => {
            return (
            <div
              key={cluster.id}
              style={{
                marginBottom: 12,
                paddingLeft: 8,
                borderLeft: '2px solid #cbd5e1',
                breakInside: 'avoid',
                pageBreakInside: 'avoid',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>
                {cluster.titulo} · {cluster.criticidade} · {cluster.etapas.length} etapas previstas
              </div>
              <div style={{ fontSize: 11, marginBottom: 8 }}>{cluster.resumoProblema}</div>

              <div style={{ fontSize: 11, marginBottom: 10 }}>
                <div style={{ marginBottom: 2 }}>
                  <strong>Antes:</strong> <ListaComposicaoImpressao itens={cluster.composicao.antes} />
                </div>
                <div>
                  <strong>Depois:</strong> <ListaComposicaoImpressao itens={cluster.composicao.depois} />
                </div>
              </div>

              {cluster.etapas.map((etapa, idx) => (
                <div
                  key={etapa.id}
                  style={{
                    marginBottom: 10,
                    paddingBottom: 10,
                    borderBottom: '1px solid #cbd5e1',
                    breakInside: 'avoid',
                    pageBreakInside: 'avoid',
                  }}
                >
                  <div className="flex items-center" style={{ gap: 8, marginBottom: 4 }}>
                    <strong>{idx + 1}. {TIPO_ETAPA_LABEL[etapa.tipo]}</strong>
                    <span>{etapa.tempoEstimado}</span>
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>{etapa.descricao}</div>
                  <div style={{ fontSize: 11, marginBottom: 4 }}>{etapa.grupoVagoes}</div>
                  {etapa.rotaOrigem && etapa.rotaDestino && (
                    <div style={{ fontSize: 11, marginBottom: 4 }}>
                      Rota: {etapa.rotaOrigem} → {etapa.rotaDestino}
                      {etapa.distanciaTotalM != null && ` · ${etapa.distanciaTotalM} m`}
                      {etapa.sentido && ` · ${etapa.sentido}`}
                    </div>
                  )}
                  {etapa.vagoesRetirados && <div style={{ fontSize: 11, marginBottom: 4 }}>Retirados: {etapa.vagoesRetirados.join(', ')}</div>}
                  {etapa.vagoesIncluidos && <div style={{ fontSize: 11, marginBottom: 4 }}>Incluídos: {etapa.vagoesIncluidos.join(', ')}</div>}
                  {etapa.caminho && etapa.caminho.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
                      <thead>
                        <tr>
                          {th('Trecho')}
                          {th('Compr. (m)')}
                          {th('Dist. acum. (m)')}
                          {th('Destino')}
                        </tr>
                      </thead>
                      <tbody>
                        {etapa.caminho.map((t, i) => (
                          <tr key={i}>
                            {td(t.trecho)}
                            {td(t.comprimentoM)}
                            {td(t.distanciaAcumuladaM)}
                            {td(t.destino)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Aplica `atualizar` só no bloco indicado, preservando o resto do plano intocado. */
function comBlocoAtualizado(plano: PlanoManobra, blocoId: string, atualizar: (b: BlocoManobra) => BlocoManobra): PlanoManobra {
  return { ...plano, blocos: plano.blocos.map((b) => (b.id === blocoId ? atualizar(b) : b)) };
}

export function PlanManobraX({ trenSelecionado, onSelecionarTrem, dataSelecionada, statusFichaPorTrem = {}, onRevisarFicha, onAjustarParametros, onImprimirPlano, onConfirmarPlano, planoConfirmado = false, destaque = null, onDestaqueChange, veiculosFoco, onFocarVeiculo, onLimparFocoVeiculos }: PlanManobraXProps) {
  // Pátio e data para o cabeçalho do Plano impresso — não vêm do PlanoManobra (só tem trem/OS).
  const fichaAtual = fichasMock.find((f) => f.trem === trenSelecionado);
  // Trens de datas anteriores (fora do "hoje" narrativo) não têm entrada em `planosManobraMock`
  // — cai num plano simples neutro em vez de mostrar (por engano) o plano de outro trem.
  const planoOriginal = planosManobraMock[trenSelecionado] ?? planoFallback(trenSelecionado, fichaAtual?.os ?? '—');

  // Cópia local e independente do mock — o plano exibido é uma SUGESTÃO que o operador pode
  // ajustar direto na tela, a qualquer momento (sem modo de edição, sem modal). Se o plano do
  // trem selecionado já foi alterado, `editado` fica true e libera o botão de reverter.
  const [planos, setPlanos] = useState<Record<string, PlanoManobra>>(() => JSON.parse(JSON.stringify(planosManobraMock)));
  const plano = planos[trenSelecionado] ?? planoOriginal;
  const editado = JSON.stringify(plano) !== JSON.stringify(planoOriginal);
  const pendente = !!statusFichaPorTrem[trenSelecionado]?.pendente;

  // A ficha aprovada não revela o plano na hora — simula a geração do plano de manobra por um
  // instante antes de exibir os blocos. Cada trem só passa por isso uma vez: sair e voltar a um
  // trem cujo plano já foi gerado não trava de novo no loading.
  const [planosGerados, setPlanosGerados] = useState<Set<string>>(new Set());
  const gerando = !pendente && !planosGerados.has(trenSelecionado);

  // Aba ativa do subheader (Visão Geral / Manobras) — ver `AbaSubheader`. Fica no componente
  // (não por trem): trocar de trem mantém a aba que o operador estava vendo.
  const [aba, setAba] = useState<AbaPlano>('geral');

  useEffect(() => {
    if (pendente || planosGerados.has(trenSelecionado)) return;
    const timer = setTimeout(() => {
      setPlanosGerados((prev) => new Set(prev).add(trenSelecionado));
    }, 1100);
    return () => clearTimeout(timer);
  }, [pendente, trenSelecionado, planosGerados]);

  // Blocos (e, dentro deles, Grupos) sempre vêm fechados por padrão ao trocar de trem — o
  // operador abre manualmente o que quiser revisar (edições de cada trem ficam guardadas
  // independentemente em `planos`, uma não afeta a outra). O "aberto" de Bloco/Grupo é sempre
  // exatamente `destaque` (accordion exclusivo em cada nível, ver `BlocoAccordionItem`), e o pai
  // (`PlanejamentoScreen.tsx`) já zera `destaque` ao trocar de trem/data — nenhum reset próprio
  // é necessário aqui.

  /** Aplica `fn` só no plano do trem selecionado, preservando os demais trens intocados. */
  function atualizarPlano(fn: (p: PlanoManobra) => PlanoManobra) {
    setPlanos((prev) => ({ ...prev, [trenSelecionado]: fn(prev[trenSelecionado] ?? planoOriginal) }));
  }

  /** Descarta todas as edições do trem selecionado, voltando ao plano sugerido original. */
  function reverterPlano() {
    setPlanos((prev) => ({ ...prev, [trenSelecionado]: JSON.parse(JSON.stringify(planoOriginal)) }));
  }

  const editor: EditorPlano = {
    adicionarGrupo: (blocoId) => {
      atualizarPlano((p) => comBlocoAtualizado(p, blocoId, (b) => {
        const novo: ClusterManobra = {
          id: `${blocoId}-novo-${Date.now()}`,
          titulo: `Grupo ${b.clusters.length + 1} — Novo grupo`,
          resumoProblema: 'Descrever o problema deste grupo',
          descricaoProblema: 'Descrever o problema deste grupo',
          criticidade: 'Baixa',
          composicao: { antes: [], depois: [] },
          etapas: [],
        };
        return { ...b, clusters: [...b.clusters, novo] };
      }));
    },
    removerGrupo: (blocoId, clusterId) => {
      atualizarPlano((p) => comBlocoAtualizado(p, blocoId, (b) => ({
        ...b,
        clusters: b.clusters.filter((c) => c.id !== clusterId),
      })));
    },
  };

  return (
    <div
      className="flex flex-col"
      style={{
        height: '100%',
        backgroundColor: PANEL_BG,
        // Sem radius/sombra própria — 2026-08-28, pedido explícito do usuário: este componente
        // agora vive colado (sem gutter) dentro do `PainelCard` de "Planos de Manobra"
        // (`PlanejamentoScreen.tsx`, única chamada), que já é o card fechado (borda+radius) da
        // composição inteira; um segundo card arredondado/elevado por dentro dele, sem respiro
        // nenhum ao redor, só duplicava a moldura e impedia divisórias internas (ex.: a borda da
        // lista de trens, `ListaTrensLateral`) de alcançar a borda física do painel.
        overflow: 'hidden',
        fontFamily: FONT,
      }}
    >
      <div className="flex" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <ListaTrensLateral
          trenSelecionado={trenSelecionado}
          statusFichaPorTrem={statusFichaPorTrem}
          onSelecionar={onSelecionarTrem}
          dataSelecionada={dataSelecionada}
        />

        <div className="flex flex-col" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {/* Header — trem em destaque e a OS do lado (uma linha só). "Confirmar Plano" e
              "Imprimir" ficam aqui, ao lado de "Ver Ficha" — ações do trem selecionado, não do
              header principal da página. */}
          <div
            className="flex items-center justify-between shrink-0 no-print"
            style={{ gap: '0.625rem', flexWrap: 'nowrap', overflowX: 'auto', borderBottom: `1px solid ${BORDER}`, padding: '0.625rem 1.25rem' }}
          >
            {/* `minWidth:0` + ellipsis deixa o nome do trem encolher/truncar em vez de vazar por
               cima dos botões à direita quando o painel fica estreito — sem isso, o texto do
               título continuava no seu tamanho natural e desenhava por baixo/sobre "Ver Ficha" e
               "Confirmar Plano" (que não encolhem, `shrink-0`). Se ainda assim não sobrar espaço
               nem para o título mínimo nem para os botões, a linha rola na horizontal em vez de
               cortar ou sobrepor conteúdo. */}
            <div className="flex items-center" style={{ gap: '0.5rem', minWidth: '2.5rem', flexShrink: 1 }}>
              <Train size="1.125rem" strokeWidth={2} color={TEXT_HI} style={{ flexShrink: 0 }} />
              <span style={{ color: TEXT_HI, fontSize: '1.125rem', fontWeight: 700, fontFamily: FONT, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {rotuloTrem(plano.trem)}
              </span>
            </div>
            {pendente ? (
              <span style={{ flexShrink: 0, fontSize: '0.5625rem', fontWeight: 700, color: WARNING_TEXT, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                ⚠ Ficha não aprovada
              </span>
            ) : gerando ? (
              <span className="flex items-center" style={{ flexShrink: 0, gap: '0.375rem', fontSize: '0.5625rem', fontWeight: 700, color: TEXT_MD, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                <Loader2 size="0.6875rem" strokeWidth={2.5} className="animate-spin" />
                Gerando plano...
              </span>
            ) : (
              <div className="flex items-center shrink-0" style={{ gap: '0.5rem' }}>
                {editado && (
                  <HeaderTooltip label={"Descarta as edições feitas neste trem e volta ao plano sugerido original"}><button
                    onClick={reverterPlano}
                   
                    className="flex items-center shrink-0"
                    style={{
                      gap: '0.375rem',
                      height: '1.875rem',
                      padding: '0 0.75rem',
                      borderRadius: RADIUS,
                      border: `1px solid ${BORDER}`,
                      backgroundColor: 'transparent',
                      color: TEXT_MD,
                      fontSize: '0.625rem',
                      letterSpacing: '0.04em',
                      fontFamily: FONT,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_HI; e.currentTarget.style.borderColor = WARNING_TEXT; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_MD; e.currentTarget.style.borderColor = BORDER; }}
                  >
                    <RotateCcw size="0.75rem" strokeWidth={2.5} />
                    Voltar ao Plano Sugerido
                  </button></HeaderTooltip>
                )}
                {/* "Ver Ficha" só aparece com a Ficha de Operação já aprovada (mesma condição
                   `!pendente` acima) — leva pra Ficha Operacional já com este trem selecionado,
                   reaproveitando o mesmo `onRevisarFicha` usado pelo botão "Revisar Ficha" no
                   estado pendente (é a mesma navegação, só que a partir de um trem já aprovado). */}
                <HeaderTooltip label={"Abrir a Ficha de Operação deste trem"}><button
                  onClick={() => onRevisarFicha?.(plano.trem)}
                 
                  className="flex items-center shrink-0"
                  style={{
                    gap: '0.375rem',
                    height: '1.875rem',
                    padding: '0 0.75rem',
                    borderRadius: RADIUS,
                    border: `1px solid ${BORDER}`,
                    backgroundColor: 'transparent',
                    color: TEXT_MD,
                    fontSize: '0.625rem',
                    letterSpacing: '0.04em',
                    fontFamily: FONT,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_HI; e.currentTarget.style.borderColor = TEXT_LO; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_MD; e.currentTarget.style.borderColor = BORDER; }}
                >
                  <FileText size="0.75rem" strokeWidth={2.5} />
                  Ver Ficha
                </button></HeaderTooltip>

                <button
                  onClick={onImprimirPlano}
                  className="flex items-center justify-center shrink-0"
                  style={{
                    gap: '0.375rem',
                    height: '1.875rem',
                    padding: '0 0.75rem',
                    backgroundColor: VLI_PRIMARY_SOLID,
                    border: 'none',
                    borderRadius: RADIUS,
                    color: '#fff',
                    fontSize: '0.625rem',
                    letterSpacing: '0.04em',
                    fontFamily: FONT,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--vli-primary-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = VLI_PRIMARY_SOLID; }}
                >
                  <Printer size="0.75rem" strokeWidth={2.5} />
                  Imprimir Plano
                </button>
              </div>
            )}
          </div>

          {pendente ? (
            <div className="flex flex-col items-center justify-center flex-1 no-print" style={{ padding: '1.5rem', gap: '0.875rem' }}>
              <ClipboardCheck size="1.875rem" strokeWidth={1.5} color={TEXT_LO} />
              <p style={{ fontSize: '0.75rem', color: TEXT_MD, lineHeight: 1.6, margin: 0, textAlign: 'center', fontFamily: FONT, fontWeight: 500, maxWidth: '15rem' }}>
                Aguardando confirmação da Ficha Operacional para gerar o plano de manobra.
              </p>
              <button
                onClick={() => onRevisarFicha?.(plano.trem)}
                className="flex items-center justify-center"
                style={{
                  gap: '0.5rem',
                  height: '2rem',
                  padding: '0 1.25rem',
                  borderRadius: RADIUS,
                  border: `1px solid ${BORDER}`,
                  backgroundColor: SURFACE,
                  color: TEXT_MD,
                  fontSize: '0.75rem',
                  letterSpacing: '0.05em',
                  fontFamily: FONT,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = BORDER; e.currentTarget.style.color = TEXT_HI; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SURFACE; e.currentTarget.style.color = TEXT_MD; }}
              >
                Revisar Ficha
              </button>
            </div>
          ) : gerando ? (
            <div className="flex flex-col items-center justify-center flex-1 no-print" style={{ padding: '1.5rem', gap: '0.875rem' }}>
              <Loader2 size="1.875rem" strokeWidth={1.5} color={TEXT_LO} className="animate-spin" />
              <p style={{ fontSize: '0.75rem', color: TEXT_MD, lineHeight: 1.6, margin: 0, textAlign: 'center', fontFamily: FONT, fontWeight: 500, maxWidth: '15rem' }}>
                Gerando plano de manobra a partir da ficha aprovada...
              </p>
            </div>
          ) : (
            <>
              <AbaSubheader
                aba={aba}
                onChange={(next) => {
                  setAba(next);
                  // 2026-08-27, pedido explícito do usuário: voltar pra "Visão Geral" enquanto uma
                  // Etapa/Grupo/Bloco está destacado (ex.: Parada selecionada dentro de "Manobras")
                  // deve soltar o destaque — a câmera do mapa volta pro nível "trem" inteiro, em vez
                  // de continuar ancorada na sequência que não está mais visível nesta aba.
                  if (next === 'geral') onDestaqueChange?.(null);
                }}
              />
              {aba === 'geral' ? (
                <VisaoGeralConteudo plano={plano} veiculosFoco={veiculosFoco} onFocarVeiculo={onFocarVeiculo} onLimparFocoVeiculos={onLimparFocoVeiculos} />
              ) : trenSelecionado === 'J105' || trenSelecionado === TREM_J105_V2 ? (
                /* J105: formato exclusivo — lista plana dos 38 passos do plano de origem, sem
                   Bloco/Grupo (ver `PassosJ105Lista`/`planoManobraJ105.ts`). Nenhum outro trem
                   passa por este ramo; `BlocoAccordionItem`/`GrupoAccordionItem` continuam sendo
                   o caminho de todos os demais, inalterado.
                   O J105 V2 entra pelo MESMO ramo: é o mesmo plano de 38 passos (mesmos títulos,
                   agentes e instruções — ver `construirPlanoJ105`), e só a Visão Topológica muda
                   nele. Sem esta condição o V2 caía no accordion genérico de Bloco/Grupo, que
                   mostra o card "Composição J105 — N grupos no bloco" e recorta o título de cada
                   Cluster no travessão ("Passo 2 —", sem a descrição). */
                /* `key` por trem: J105 e J105 V2 renderizam ESTE MESMO componente, então sem ela
                   o React preserva o estado interno (`expandidoId`) ao trocar de um pro outro — o
                   passo que estava aberto no V2 continuava aberto no V1, mesmo com o destaque do
                   mapa já zerado por `selecionarTrem`. Trocar de trem remonta a lista. */
                <PassosJ105Lista
                  key={plano.trem}
                  plano={plano}
                  destaque={destaque}
                  onDestaqueChange={onDestaqueChange}
                  seguirDestaque={trenSelecionado === TREM_J105_V2}
                />
              ) : (
                /* Blocos empilhados em coluna única — accordion EXCLUSIVO (só um Bloco aberto por
                   vez, ver `BlocoAccordionItem`), cada um com seus Grupos aninhados dentro, também
                   em accordion exclusivo entre si, sempre editável direto na tela (sem modo de
                   edição para ligar/desligar, sem modal). */
                <AccordionPrimitive.Root
                  type="single"
                  collapsible
                  value={destaque?.blocoId ?? ''}
                  onValueChange={(value) => onDestaqueChange?.(value ? { blocoId: value } : null)}
                  className="no-print flex flex-col"
                  style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1rem', gap: '0.875rem' }}
                >
                  {plano.blocos.map((bloco) => (
                    <BlocoAccordionItem
                      key={bloco.id}
                      bloco={bloco}
                      editor={editor}
                      destaque={destaque}
                      onDestaqueChange={onDestaqueChange}
                    />
                  ))}
                </AccordionPrimitive.Root>
              )}
            </>
          )}
        </div>
      </div>

      {/* "Imprimir"/"Confirmar Plano" no header da página são ações do trem selecionado — imprime
          só o plano em tela, não o turno inteiro. */}
      <div className="print-area only-print">
        <PlanoImpressao plano={plano} patioNome={fichaAtual?.patioNome} data={fichaAtual?.data} />
      </div>
    </div>
  );
}
