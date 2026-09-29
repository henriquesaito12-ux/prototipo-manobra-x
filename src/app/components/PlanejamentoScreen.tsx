import { rotuloTrem, tremDesabilitado } from '../data/trensAtivos';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, Minus, PanelLeft, PanelRight, PanelsLeftRight, Plus, RotateCcw, Train } from 'lucide-react';
import { TrainYardSVG, projectYardScene } from './topological-map/train-yard/TrainYardSVG';
import { AMV_T2_MARKER_ID, passoDoEtapaId } from '../data/visualJ105';
import { alvoCameraJ105 } from './topological-map/train-yard/render/ComposicaoJ105Layer';
import { alvoCameraJ105V2, alvoVeiculosJ105V2 } from './topological-map/train-yard/render/ComposicaoJ105V2Layer';
import {
  DURACAO_TOTAL_J105,
  TOTAL_PASSOS_J105,
  TREM_J105_V2,
  estadoAnimadoJ105,
  estagioEmT,
  inicioDoPasso,
} from '../data/animacaoJ105';
import { ControlesAnimacaoJ105, type VelocidadeJ105 } from './ControlesAnimacaoJ105';
import { resolverConteudoCartao } from './topological-map/train-yard/render/Composition';
import type { CompositionHighlight, ConteudoCartao, HoverTooltipInfo } from './topological-map/train-yard/render/Composition';
import type { ProjectedComposition } from './topological-map/train-yard/project';
import { findCompositionFocusTarget, findHighlightFocusTarget, findVeiculoFocusTarget } from './topological-map/train-yard/focus';
import { LegendChips } from './topological-map/LegendChips';
import { LegendaJ105V2 } from './topological-map/LegendaJ105V2';
import { EHT_TOPOLOGY } from './topological-map/train-yard/mocks/eht';
import { computeLegendPresence, createEssentialLegendFilter, filterTopology, type LegendFilterState } from './topological-map/train-yard/filterTopology';
import { backgroundElementIdForTrem, buildTrainComposition, filterUnapprovedBackgroundTrains, injectTrainComposition, marcarRestricaoFerradura, pickLineIdForTrem, removerComposicoesDeFundo } from './topological-map/planoTopologiaAdapter';
import { PlanManobraX, construirDestaqueEtapa } from './PlanManobraX';
import { MapaNavegacaoPainel } from './MapaNavegacaoPainel';
import { RestrictionsPanel, type Restricao } from './RestrictionsPanel';
import { ConfirmarPlanoModal } from './ConfirmarPlanoModal';
import { fichasMock, HOJE } from '../data/fichaOperacao';
import { planosManobraMock, planoFallback, TIPO_ETAPA_RESPONSAVEL, type EtapaManobra, type PlanoManobra } from '../data/planoManobra';
import { PATIO_ATIVO } from '../data/patio';
import { PageHeader, HeaderTitulo, HeaderDivider, PatioHeaderDropdown, DataHeaderDropdown, HeaderTooltip, PainelCard, PainelCardHeader } from './PageHeader';
import { imprimirComPagina } from '../utils/imprimir';

// `EHT_TOPOLOGY` é um snapshot estático (mock, ver `mocks/eht.ts`) — a presença de cada
// categoria/variante no pátio nunca muda em runtime, então calcula uma vez aqui (não a cada
// render/useMemo) e reusa. `LegendChips` usa isso pra não listar item sem nenhum dado real neste
// pátio (ver `computeLegendPresence`). A composição em si NÃO está mais na topologia estática
// (ver `mocks/eht.ts`) — é sintetizada por trem em runtime (`planoTopologiaAdapter.ts`), então
// `computeLegendPresence` sozinho nunca acharia nenhuma pra reportar; força a entrada manualmente
// porque sabemos que sempre existe uma (o trem selecionado sempre desenha algo no mapa).
const EHT_LEGEND_PRESENCE = computeLegendPresence(EHT_TOPOLOGY);
EHT_LEGEND_PRESENCE.elementKinds.add('composition');
// Filtro FIXO do mapa do J105 V2 — o estado inicial "essencial" da legenda, nunca alterado (a
// legenda do V2 não tem toggles, ver `LegendaJ105V2.tsx`). Criado uma vez só pra não invalidar
// o `useMemo` da topologia a cada render.
const FILTRO_LEGENDA_J105_V2 = createEssentialLegendFilter();
// Restrições Ativas do J105 V2 — só uma, no Terminal da Ferradura (2026-09-24, pedido explícito do
// usuário). Os demais trens seguem com a lista padrão de `RestrictionsPanel`.
const RESTRICOES_J105_V2: Restricao[] = [{ descricao: 'Terminal da Ferradura com manobra restrita.' }];

const PANEL_BG   = 'var(--vli-panel-bg)';
const BG_DEEP    = 'var(--vli-bg-deep)';
const MAP_CANVAS_BG = 'var(--vli-map-canvas-bg)';
const BORDER     = 'var(--vli-border)';
const TEXT_HI    = 'var(--vli-text-hi)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
// Só usado como texto/borda/traço de legenda sobre fundo escuro nesta tela — pode usar a
// variante mais clara direto.
const VLI_PRIMARY = 'var(--vli-primary-text)';
const HOVER_TINT = 'var(--vli-hover-tint)';
const FONT       = 'Manrope, sans-serif';
const RADIUS     = '0.375rem';
// Mesma duração/curva do colapse de Bloco/Grupo (`vli-collapse-open/close`, `theme.css`) — os
// dois toggles de painel (Planejamento do dia / Mapa) precisam "parecer parte do mesmo sistema".
// `flex-grow` (não `flex-basis`) é o que anima: `flexBasis`/`flexShrink` ficam fixos em 0%/1 nos
// dois estados, só o grow muda 0↔1 — interpolação contínua de um número. Misturar unidades no
// `flex-basis` (0px fechado vs 0% aberto, como era antes) faz o navegador pular em vez de animar.
const PANEL_TRANSITION = 'flex 250ms ease-in-out';
// Aplicado ao conteúdo INTERNO do painel (não ao container que anima o flex) — sem isso o texto
// reflui/"pula" enquanto o container ainda está encolhendo; com o fade, o conteúdo já está
// transparente antes de ficar visualmente espremido.
const PANEL_CONTENT_FADE = 'opacity 250ms ease-in-out';
// Faixa "usável" da divisória arrastável entre os dois painéis (`PainelResizer`) — abaixo desse
// piso o painel do lado que está encolhendo já quebraria visualmente (texto sem espaço, mapa
// espremido), então o arrasto SNAPA pro modo "só o painel oposto" em vez de deixar o usuário
// encolher além disso (ver `handleResizerPointerMove`). Dois critérios, o mais restritivo manda:
// percentual da largura total (`SPLIT_SNAP_MIN_PERCENT`) E largura mínima em px
// (`SPLIT_SNAP_MIN_PX`) — só o percentual falha em telas muito largas (20% de 3000px ainda é
// enorme) ou muito estreitas (20% de 800px já é pouco).
const SPLIT_SNAP_MIN_PERCENT = 20;
const SPLIT_SNAP_MIN_PX = 280;
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const ZOOM_STEP = 0.25;
// "Zoom semântico": abaixo deste nível, marcadores de detalhe fino (AMV, calço, freio manual,
// rampa/declividade, km, CCO, abastecimento, seção de bloqueio, limite de manobra — ver
// `DETAIL_MARKER_VARIANTS` em `legendCatalog.ts`) somem do mapa (fade, não corte abrupto — ver
// `Marker.tsx`), mesmo que estejam ativos na legenda. Objetivo é só reduzir poluição visual no
// zoom base (trechos curtos acumulam ícone em cima de ícone); linhas, composições, interdição e
// ETA continuam sempre visíveis, controlados só pela legenda. 1.75 = 175% (zoom base é 1 = 100%
// em `ZoomableMapa`) — dentro da faixa 150-200% pedida, ajustável aqui se um caso real pedir
// outro ponto de corte.
const ZOOM_SEMANTICO_LIMIAR = 1.75;
// Piso real (não 0) pra altura do mapa dentro de `TopologicalPanel` — com `minHeight: 0`, o
// mapa podia ser espremido até quase sumir no instante em que Legenda e Restrições Ativas
// animavam abrindo ao mesmo tempo (as duas ainda crescendo pro tamanho final), e só voltava ao
// tamanho normal depois que a animação delas terminava — um "achata e volta" visível. Com um
// mínimo fixo em pixels, o mapa nunca fica menor que isso em nenhum momento da animação.
const MAP_MIN_HEIGHT = 140;

// Cursor customizado da área do mapa no zoom base (sem pan possível ainda): seta triangular
// preta preenchida, moderna, SEM a haste/cabo longo do cursor padrão do SO (o path é uma única
// forma fechada e compacta, mesmo desenho usado por ícones de "cursor/pointer" de ferramentas de
// design). Contorno branco fino só pra garantir contraste em cima de qualquer cor de trilho/fundo
// do mapa, dark ou light. Hotspot (onde o clique realmente acontece) fica na ponta da seta
// (topo-esquerda do path) — por isso "4 4" logo depois da URL. O `, auto` final é o fallback
// nativo caso o navegador não consiga carregar o cursor customizado.
const MAP_CURSOR_SVG =
  `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24'>` +
  `<path d='M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z' ` +
  `fill='rgb(20,20,20)' stroke='white' stroke-width='1' stroke-linejoin='round'/>` +
  `</svg>`;
const MAP_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(MAP_CURSOR_SVG)}") 4 4, auto`;

function clamp(valor: number, min: number, max: number) {
  return Math.min(max, Math.max(min, valor));
}

function distanciaEntreToques(touches: React.TouchList) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Botão-ícone pequeno usado nos controles de zoom flutuantes sobre o mapa. */
function BotaoZoom({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <HeaderTooltip label={title}><button
      onClick={onClick}
     
      aria-label={title}
      className="flex items-center justify-center"
      style={{
        width: '1.625rem',
        height: '1.625rem',
        border: `1px solid ${BORDER}`,
        borderRadius: '0.25rem',
        backgroundColor: PANEL_BG,
        color: TEXT_MD,
        cursor: 'pointer',
        boxShadow: 'var(--vli-shadow)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_HI; e.currentTarget.style.borderColor = VLI_PRIMARY; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_MD; e.currentTarget.style.borderColor = BORDER; }}
    >
      {children}
    </button></HeaderTooltip>
  );
}

/** Largura/altura da trilha do switch (em rem — era 26px/14px/10px) — o "polegar" (bolinha) tem
 *  `SWITCH_THUMB_GAP` de folga em cada borda. Toda a aritmética abaixo (`top`/`left` do polegar)
 *  fica em rem de propósito, não px: só assim ela escala junto com `--font-size` da raiz. */
const SWITCH_TRACK_W = 1.625;
const SWITCH_TRACK_H = 0.875;
const SWITCH_THUMB = 0.625;
const SWITCH_THUMB_GAP = 0.125;

/**
 * Toggle do zoom semântico ("Ver detalhes ao aproximar") — ao lado dos botões de zoom (mesmo
 * `PANEL_BG`/borda/sombra flutuando sobre o canvas). LIGADO (padrão) = comportamento de
 * `ZOOM_SEMANTICO_LIMIAR` (elementos de detalhe só acima do limiar, ver `ZoomableMapa`);
 * DESLIGADO = todo item ativo na legenda aparece em qualquer zoom (comportamento anterior ao
 * zoom semântico). O tooltip (`title`, mesmo padrão de `BotaoZoom`) explica o propósito — não
 * abre popover próprio, consistente com o resto dos controles flutuantes do mapa.
 * `compacto` (2026-08-28, pedido do usuário pra corrigir a barra de controles sobrepondo em
 * painel estreito): esconde só o rótulo de texto, mantendo o switch — `title`/`aria-label` já
 * carregam a mesma explicação, então o controle continua identificável/acessível sem o texto.
 */
function ToggleDetalhamentoAutomatico({ ativo, onChange, compacto = false }: { ativo: boolean; onChange: (v: boolean) => void; compacto?: boolean }) {
  const label = 'Ver detalhes ao aproximar';
  const explicacao = 'Mostra mais detalhes no mapa conforme você aproxima o zoom.';
  return (
    <HeaderTooltip label={explicacao}><div
      className="flex items-center shrink-0"
     
      style={{
        gap: compacto ? 0 : '0.375rem',
        height: '1.625rem',
        padding: '0 0.5rem',
        border: `1px solid ${BORDER}`,
        borderRadius: '0.25rem',
        backgroundColor: PANEL_BG,
        boxShadow: 'var(--vli-shadow)',
        whiteSpace: 'nowrap',
        cursor: 'default',
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        aria-label={label}
        onClick={() => onChange(!ativo)}
        style={{
          position: 'relative',
          flexShrink: 0,
          width: `${SWITCH_TRACK_W}rem`,
          height: `${SWITCH_TRACK_H}rem`,
          borderRadius: 999,
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          backgroundColor: ativo ? VLI_PRIMARY : BORDER,
          transition: 'background-color 0.15s ease-in-out',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: `${(SWITCH_TRACK_H - SWITCH_THUMB) / 2}rem`,
            left: `${ativo ? SWITCH_TRACK_W - SWITCH_THUMB - SWITCH_THUMB_GAP : SWITCH_THUMB_GAP}rem`,
            width: `${SWITCH_THUMB}rem`,
            height: `${SWITCH_THUMB}rem`,
            borderRadius: '50%',
            backgroundColor: '#fff',
            transition: 'left 0.15s ease-in-out',
          }}
        />
      </button>
      {!compacto && <span style={{ fontSize: '0.625rem', color: TEXT_MD, fontFamily: FONT }}>{label}</span>}
    </div></HeaderTooltip>
  );
}

/** Estilo compartilhado dos itens do popover do seletor de trem — mesmo padrão de hover de
 *  `FiltroSelect.tsx`/`PageHeader.tsx` (troca de fundo, sem borda). */
const SELETOR_TREM_ITEM_STYLE: React.CSSProperties = {
  padding: '0.5rem 0.625rem',
  borderRadius: '0.25rem',
  fontSize: '0.75rem',
  fontWeight: 400,
  color: TEXT_HI,
  cursor: 'pointer',
  outline: 'none',
};

/**
 * Dropdown de trem flutuando sobre o canto superior esquerdo do mapa (mesmo nível dos controles
 * de zoom/"Ver detalhes ao aproximar" no canto direito, ver `ZoomableMapa`) — troca o trem
 * selecionado sem precisar voltar pra lista "Trens do Dia" do painel de Planejamento. Mesmo
 * `SelectPrimitive` (Radix) de `FiltroSelect.tsx`, só que com o CHROME dos controles flutuantes
 * (fundo/borda/sombra de `BotaoZoom`) em vez do chrome de campo de formulário — precisa se
 * destacar sobre um mapa cheio de linhas/dot grid, não misturar com o resto de um form.
 */
function SeletorTremMapa({ trem, trens, onSelecionar }: { trem: string; trens: string[]; onSelecionar: (trem: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <SelectPrimitive.Root value={trem} onValueChange={onSelecionar} onOpenChange={setOpen}>
      <SelectPrimitive.Trigger
        aria-label="Selecionar trem no mapa"
        className="flex items-center shrink-0"
        style={{
          gap: '0.25rem',
          height: '1.25rem',
          padding: '0 0.375rem',
          border: `1px solid ${open ? VLI_PRIMARY : BORDER}`,
          borderRadius: '0.25rem',
          backgroundColor: PANEL_BG,
          // `<button>` (o que `SelectPrimitive.Trigger` renderiza) não herda `color` do
          // ancestral por padrão (UA stylesheet aplica um preto/"buttontext" próprio) — sem
          // isso aqui, o texto do Value ficava escuro demais pra ler no dark mode mesmo com
          // `color: TEXT_HI` só nele (mesma causa já resolvida em `FiltroSelect.tsx`, que
          // define a cor no Trigger, não no Value).
          color: TEXT_HI,
          cursor: 'pointer',
          outline: 'none',
          boxShadow: 'var(--vli-shadow)',
          whiteSpace: 'nowrap',
          // `SelectPrimitive.Value` (Radix) ignora `style` custom no próprio elemento (só aplica
          // `pointer-events: none` internamente, descartando qualquer `style` passado a ele) —
          // por isso a fonte precisa ser definida aqui no Trigger, herdada pelo texto do Value,
          // não no `SelectPrimitive.Value` diretamente (bug real encontrado 2026-08-26: o texto
          // renderizava no tamanho padrão do navegador, 16px, mesmo com `fontSize` setado nele).
          fontSize: '0.59375rem',
          fontWeight: 600,
          fontFamily: FONT,
        }}
        // Hover — MESMO padrão de `BotaoZoom` — 2026-08-27, pedido explícito do usuário: "nos
        // componentes do mapa (J614, bloco, grupo, 0/6) também" precisam de hover. Reverte pro
        // estado `open` (não direto pra `BORDER`) — senão sair do hover enquanto o dropdown ainda
        // está aberto apagava o contorno de "aberto" à toa.
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = VLI_PRIMARY; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = open ? VLI_PRIMARY : BORDER; }}
      >
        <Train size="0.625rem" strokeWidth={2.5} color={TEXT_MD} />
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon style={{ display: 'flex', flexShrink: 0 }}>
          <ChevronDown size="0.625rem" color={TEXT_MD} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50"
          style={{
            backgroundColor: PANEL_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: RADIUS,
            boxShadow: 'var(--vli-shadow), 0 0.5rem 1.5rem rgba(0,0,0,0.25)',
            fontFamily: FONT,
            minWidth: '7.5rem',
            overflow: 'hidden',
          }}
        >
          <SelectPrimitive.Viewport style={{ padding: '0.25rem' }}>
            {trens.map((t) => (
              <SelectPrimitive.Item
                key={t}
                value={t}
                disabled={tremDesabilitado(t)}
                className="flex items-center justify-between"
                style={{ ...SELETOR_TREM_ITEM_STYLE, ...(tremDesabilitado(t) && { opacity: 0.45, cursor: 'not-allowed' }) }}
                onPointerEnter={(e) => { if (!tremDesabilitado(t)) e.currentTarget.style.backgroundColor = HOVER_TINT; }}
                onPointerLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <SelectPrimitive.ItemText>{rotuloTrem(t)}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator style={{ display: 'flex', flexShrink: 0, marginLeft: '0.625rem' }}>
                  <Check size="0.8125rem" color={VLI_PRIMARY} strokeWidth={2.5} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

/** As três opções de layout dos painéis — substituem os dois toggles independentes
 *  "Planejamento do dia"/"Mapa". Sempre exatamente uma ativa (nunca as duas, nunca nenhuma),
 *  o que elimina de raiz o caso "os dois desligados" que os toggles antigos precisavam tratar
 *  via `disabled`. `planoAtivo`/`mapaAtivo` (usados em toda a lógica de largura/fade já
 *  existente mais abaixo) passam a ser derivados destes valor — a transição de crescer/encolher
 *  não muda em nada. */
type LayoutModo = 'esquerda' | 'dividido' | 'direita';


/**
 * Seletor de layout em 3 ícones lado a lado (segmented control, estilo VS Code/Figma) — única
 * forma de trocar entre "só Planejamento do dia", "dividido" (padrão) e "só Visão Topológica".
 * 2026-08-28, pedido explícito do usuário: "o tooltip que aparece explicando cada coisa deve ser
 * da própria plataforma, no padrão do produto" — trocado o `title` nativo do navegador por
 * `HeaderTooltip` (`PageHeader.tsx`, MESMOS tokens visuais do resto do app).
 */
function LayoutSegmentedControl({ valor, onChange }: { valor: LayoutModo; onChange: (v: LayoutModo) => void }) {
  const opcoes: { valor: LayoutModo; label: string; icon: typeof PanelLeft }[] = [
    { valor: 'esquerda', label: 'Só Planos de Manobra', icon: PanelLeft },
    { valor: 'dividido', label: 'Planos de Manobra e Visão Topológica lado a lado', icon: PanelsLeftRight },
    { valor: 'direita', label: 'Só Visão Topológica Atual', icon: PanelRight },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Layout dos painéis"
      className="flex items-center shrink-0"
      style={{ gap: '0.125rem', padding: '0.125rem', borderRadius: RADIUS, border: `1px solid ${BORDER}` }}
    >
      {opcoes.map(({ valor: v, label, icon: Icon }) => {
        const ativo = valor === v;
        return (
          <HeaderTooltip key={v} label={label}>
            <button
              type="button"
              role="radio"
              aria-checked={ativo}
              aria-label={label}
              onClick={() => onChange(v)}
              className="flex items-center justify-center"
              style={{
                width: '1.625rem',
                height: '1.5rem',
                border: 'none',
                borderRadius: '0.25rem',
                backgroundColor: ativo ? 'var(--vli-active-bg)' : 'transparent',
                color: ativo ? VLI_PRIMARY : TEXT_MD,
                cursor: 'pointer',
                transition: 'background-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.backgroundColor = HOVER_TINT; }}
              onMouseLeave={(e) => { if (!ativo) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Icon size="0.875rem" strokeWidth={2.25} />
            </button>
          </HeaderTooltip>
        );
      })}
    </div>
  );
}

/**
 * Divisória arrastável entre "Planos de Manobra" e "Visão Topológica" — SEMPRE presente (mesmo
 * quando um dos dois está fechado via `LayoutSegmentedControl`, ver `leftPercent` abaixo), pra
 * servir também de affordance de "puxar de volta pra visão dividida" a partir de um modo "só um
 * painel": nesses modos ela fica encostada na borda visível (0% ou 100%) do container, mas o
 * hit-box de 10px continua arrastável dali — mesmo código de arrasto do modo dividido (ver
 * `handleResizerPointerMove` em `PlanejamentoScreen`), só o valor inicial de `leftPercent` muda.
 * Só a LINHA central (2px) é visível, e só destacada (cor de marca) em hover/arrasto — o hit-box
 * de 10px em si nunca pinta nada, pra não parecer uma borda grossa permanente no modo dividido.
 */
function PainelResizer({
  leftPercent,
  arrastando,
  onPointerDown,
}: {
  leftPercent: number;
  arrastando: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const [hover, setHover] = useState(false);
  const destacado = hover || arrastando;
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar painéis"
      className="no-print"
      onPointerDown={onPointerDown}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `${leftPercent}%`,
        width: '0.625rem',
        marginLeft: '-0.3125rem',
        cursor: 'col-resize',
        touchAction: 'none',
        zIndex: 5,
        transition: arrastando ? 'none' : 'left 250ms ease-in-out',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '50%',
          width: '0.125rem',
          marginLeft: '-0.0625rem',
          borderRadius: '0.0625rem',
          backgroundColor: destacado ? VLI_PRIMARY : 'transparent',
          transition: 'background-color 0.15s',
        }}
      />
    </div>
  );
}

/** Folga (px) entre o tooltip e a borda do frame do mapa — nunca encosta rente. Fica em px "reais"
 *  de propósito (não `rem`): entra em aritmética direta com `getBoundingClientRect()`/coordenadas
 *  de mouse, que o navegador sempre devolve em px de tela já renderizados — não em px de design.
 *  Pré-multiplicado por 0.8 (era 8) pra acompanhar o encolhimento geral de ~80% do resto da UI. */
const TOOLTIP_MARGEM_PX = 6.4;
/** Largura máxima do tooltip — o bastante pra caber uma dúzia de ids por linha antes de quebrar;
 *  clampada contra a largura do próprio frame do mapa embaixo (`Math.min`, ver `TooltipHoverTrem`).
 *  Mesmo motivo acima pra ficar em px reais. Pré-multiplicado por 0.8 (era 300). */
const TOOLTIP_LARGURA_MAX_PX = 240;
/** Cor do id de um vagão A RETIRAR no tooltip — MESMO token de `FG_RETIRADO_TEXTO`
 *  (`Composition.tsx`, o quadradinho do vagão já fica nessa cor no mapa) — pedido explícito do
 *  usuário, 2026-08-27: "caso tenha um vagão a retirar ele deve ficar vermelho". */
const TOOLTIP_RETIRADO_COR = 'var(--vli-tooltip-perigo)';

/**
 * Cartão de tooltip por hover sobre uma composição (trem/vagões) — 2026-08-27, pedido explícito
 * do usuário: "preciso visualizar o tooltip sempre no frame do mapa.. não pode acontecer isso de
 * quebrar e eu não conseguir ler os outros" (print mostrando o tooltip vazando pra fora do card
 * do mapa, cortado pela borda do painel vizinho) — a posição É clampada contra
 * `containerRef.getBoundingClientRect()` (o próprio frame do mapa, não a janela inteira): nunca
 * sai à direita/embaixo dele, e a altura é limitada ao espaço restante ATÉ a borda de baixo do
 * frame (com scroll interno como último recurso pra listas de vagões bem compridas — nunca
 * "estoura" e cobre outra coisa). Separado de "locomotiva(s)" e "vagões" em linhas próprias — "e
 * deixe evidente qual a locomotiva, e quais os vagões" — com os vagões a retirar em vermelho
 * (`TOOLTIP_RETIRADO_COR`).
 */
function TooltipHoverTrem({
  hover,
  containerRef,
}: {
  hover: { info: HoverTooltipInfo; x: number; y: number };
  containerRef: React.RefObject<HTMLDivElement>;
}) {
  const frame = containerRef.current?.getBoundingClientRect();
  const largura = frame ? Math.min(TOOLTIP_LARGURA_MAX_PX, frame.width - TOOLTIP_MARGEM_PX * 2) : TOOLTIP_LARGURA_MAX_PX;
  const left = frame
    ? Math.min(Math.max(hover.x + 14, frame.left + TOOLTIP_MARGEM_PX), frame.right - largura - TOOLTIP_MARGEM_PX)
    : hover.x + 14;
  const top = frame
    ? Math.min(Math.max(hover.y + 14, frame.top + TOOLTIP_MARGEM_PX), frame.bottom - TOOLTIP_MARGEM_PX)
    : hover.y + 14;
  const alturaMax = frame ? frame.bottom - top - TOOLTIP_MARGEM_PX : undefined;
  const { info } = hover;

  return (
    <div
      style={{
        position: 'fixed',
        left,
        top,
        width: largura,
        maxHeight: alturaMax,
        overflowY: 'auto',
        zIndex: 60,
        pointerEvents: 'none',
        backgroundColor: 'var(--vli-tooltip-bg)',
        border: '1px solid var(--vli-tooltip-borda)',
        borderRadius: '0.3125rem',
        boxShadow: 'var(--vli-shadow)',
        padding: '0.375rem 0.5625rem',
        fontFamily: FONT,
        fontSize: '0.6875rem',
        lineHeight: 1.5,
        color: 'var(--vli-tooltip-fg-secundario)',
      }}
    >
      {info.trem && (
        <div style={{ fontWeight: 700, color: 'var(--vli-tooltip-fg)', marginBottom: '0.125rem' }}>{info.trem}</div>
      )}
      {info.locomotivas.length > 0 && (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--vli-tooltip-fg)' }}>Locomotiva{info.locomotivas.length === 1 ? '' : 's'}: </span>
          {info.locomotivas.join(', ')}
        </div>
      )}
      {info.vagoes.length > 0 && (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--vli-tooltip-fg)' }}>Vagões: </span>
          {info.vagoes.map((v, i) => (
            <span key={i}>
              <span style={{ color: v.retirado ? TOOLTIP_RETIRADO_COR : undefined, fontWeight: v.retirado ? 700 : undefined }}>{v.id}</span>
              {i < info.vagoes.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Uma pill label:valor dentro de `PainelInfoMapa` — MESMO padrão visual de `ApoioTag`
 *  (`PlanManobraX.tsx`, painel "Sequência de Manobra": rótulo em negrito + valor, uma pill por
 *  campo) — pedido explícito do usuário, 2026-08-27, com print de referência mostrando esse
 *  formato pra Linha/Referência/Direção/Macro/Distância/Responsável. */
function BadgeInfoMapa({ label, valor }: { label: string; valor: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '0.1875rem',
        padding: '0.1875rem 0.4375rem',
        borderRadius: '0.25rem',
        border: `1px solid ${BORDER}`,
        backgroundColor: PANEL_BG,
        fontSize: '0.625rem',
        color: TEXT_MD,
        fontFamily: FONT,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontWeight: 700, color: TEXT_HI }}>{label}:</span> {valor}
    </span>
  );
}

/** Acha, dentro do `plano`, a `EtapaManobra` REAL que originou `etapaId` (ver comentário em
 *  `EtapaHighlight`, `Composition.tsx`) — percorre Bloco → Cluster → Etapas (a hierarquia
 *  completa do plano só existe aqui, não na cena projetada que o mapa usa pra desenhar).
 *  `null` quando não encontrada (não deveria acontecer com um `etapaId` válido, mas evita
 *  quebrar se o plano mudar sob o highlight). */
function encontrarEtapaReal(plano: PlanoManobra, etapaId: string | undefined): EtapaManobra | null {
  if (!etapaId) return null;
  for (const bloco of plano.blocos) {
    for (const cluster of bloco.clusters) {
      const etapa = cluster.etapas.find((e) => e.id === etapaId);
      if (etapa) return etapa;
    }
  }
  return null;
}

/** Monta os badges Linha/Referência/Direção/Macro/Distância/Responsável (Parada/Corte/Clear/
 *  Fechamento, a partir de `etapa.apoio` — MESMOS campos que `ApoioTagsEtapa`, `PlanManobraX.tsx`,
 *  já mostra na lista lateral) OU o resumo equivalente de rota (Retirada/Inclusão, sem `apoio`,
 *  a partir de `etapa.rotas[rotaIndex]`) — pedido explícito do usuário, 2026-08-27, com print de
 *  referência mostrando exatamente esse conjunto de campos. `Responsável` vem de `etapa.agentes`
 *  quando a etapa os preenche (hoje só o J105, ver `PassoJ105Linha`/"Envolvidos",
 *  `PlanManobraX.tsx`) — 2026-09-23, pedido explícito do usuário, com print mostrando a
 *  divergência: "no texto diz q é operador de manobra o responsável... mas no mapa diz que é
 *  maquinista do trem... no mapa está errado" (o painel usava sempre `TIPO_ETAPA_RESPONSAVEL`, um
 *  valor genérico por TIPO de etapa, ignorando os agentes REAIS daquele passo específico). Nos
 *  demais trens, que não preenchem `agentes`, cai pro mesmo fallback genérico de sempre
 *  (`TIPO_ETAPA_RESPONSAVEL`) — comportamento intocado. */
function badgesParaEtapa(etapa: EtapaManobra, rotaIndex: number | undefined): { label: string; valor: string }[] {
  const badges: { label: string; valor: string }[] = [];
  const apoio = etapa.apoio;
  if (apoio) {
    if (apoio.linha) badges.push({ label: 'Linha', valor: apoio.linha });
    if (apoio.referencia) badges.push({ label: 'Referência', valor: apoio.referencia });
    if (etapa.tipo === 'CLEAR' && apoio.travessao) badges.push({ label: 'Travessão', valor: apoio.travessao });
    if (apoio.direcao) badges.push({ label: 'Direção', valor: apoio.direcao });
    if (apoio.macro != null) badges.push({ label: 'Macro', valor: String(apoio.macro) });
    if (etapa.tipo === 'CORTE') {
      if (apoio.sentido) badges.push({ label: 'Sentido', valor: apoio.sentido });
      if (apoio.posCabecaM != null) badges.push({ label: 'Pós-cabeça', valor: `${apoio.posCabecaM} m` });
      if (apoio.cabecaAposCorteM != null) badges.push({ label: 'Cabeça após corte', valor: `${apoio.cabecaAposCorteM} m` });
    }
    if (etapa.tipo === 'FECHAMENTO') {
      if (apoio.lado) badges.push({ label: 'Lado', valor: apoio.lado });
      if (apoio.clearAteTravessaoM != null) badges.push({ label: 'Clear até travessão', valor: `${apoio.clearAteTravessaoM} m` });
    }
    if (apoio.distanciaM != null) badges.push({ label: apoio.distanciaLabel ?? 'Distância', valor: `${apoio.distanciaM} m` });
  } else if (etapa.rotas && rotaIndex != null && etapa.rotas[rotaIndex]) {
    const rota = etapa.rotas[rotaIndex];
    const origem = rota.segmentos[0]?.linha;
    if (origem) badges.push({ label: 'Linha', valor: origem });
    if (rota.macro != null) badges.push({ label: 'Macro', valor: String(rota.macro) });
    badges.push({ label: 'Direção', valor: rota.direcao2 ? `${rota.direcao} → ${rota.direcao2}` : rota.direcao });
    badges.push({ label: 'Destino', valor: rota.destinoFinal });
    badges.push({ label: 'Distância', valor: `${rota.distanciaTotalM} m` });
  }
  const responsavel = etapa.agentes && etapa.agentes.length > 0 ? etapa.agentes.join(', ') : TIPO_ETAPA_RESPONSAVEL[etapa.tipo];
  badges.push({ label: 'Responsável', valor: responsavel });
  return badges;
}

/**
 * Painel fixo no canto inferior ESQUERDO do mapa — 2026-08-27, pedido explícito do usuário:
 * "esse tooltip fixo [`CartaoPino`, o balão SVG que crescia sempre acima da composição
 * selecionada] quero que remova, pra não conflitar com o novo tooltip [de hover, `TooltipHoverTrem`
 * acima]. deixe ele na parte inferior do mapa, no canto inferior esquerdo" — substitui aquele
 * balão (removido de `Composition.tsx`) por um cartão HTML em posição FIXA, nunca mais ancorado
 * à posição da composição no mapa (então nunca conflita com o tooltip de hover, que segue o
 * cursor, nem com o resto do canvas).
 *
 * Dois modos, mutuamente exclusivos — MESMA regra de antes (`highlight?.etapa`), só mudou ONDE
 * desenha, não QUANDO:
 * - Etapa selecionada: badges Linha/Referência/Direção/Macro/Distância/Responsável da etapa REAL
 *   (`encontrarEtapaReal`, via `highlight.etapa.etapaId`) — a versão geométrica reduzida que o
 *   mapa usa pra desenhar o trajeto (`EtapaHighlight`, `Composition.tsx`) não carrega esses
 *   campos de propósito (motor de mapa/painel desacoplados), por isso a busca de volta ao
 *   `plano`. "a linha do trajeto deve permanecer [`EtapaParadaLayer` etc. — INALTERADOS, este
 *   painel não mexe neles]... essas outras informações [Linha/Referência/Direção/Macro/
 *   Distância/Responsável]... também deve ficar no canto inferior esquerdo".
 * - Nada/Bloco/Grupo selecionado: MESMO resumo que o antigo `CartaoPino` mostrava
 *   (`resolverConteudoCartao`, reaproveitado de `Composition.tsx` — pedido explícito: "cliquei no
 *   trem e aparece essas informações, mas se eu clicar no bloco, deve aparecer as informações do
 *   bloco e se eu clicar no grupo, deve aparecer informações do grupo" — MESMA lógica de sempre).
 */
function PainelInfoMapa({
  composicao,
  highlight,
  plano,
}: {
  composicao: ProjectedComposition | null;
  highlight: CompositionHighlight | null | undefined;
  plano: PlanoManobra;
}) {
  if (highlight?.etapa) {
    const etapaId = (highlight.etapa as { etapaId?: string }).etapaId;
    const etapaReal = encontrarEtapaReal(plano, etapaId);
    if (!etapaReal) return null;
    const rotaIndex = 'rotaIndex' in highlight.etapa ? highlight.etapa.rotaIndex : undefined;
    const badges = badgesParaEtapa(etapaReal, rotaIndex);
    return (
      <div className="absolute flex items-center flex-wrap" style={{ left: '0.5rem', bottom: '0.5rem', gap: '0.375rem', maxWidth: 'calc(100% - 1rem)' }}>
        {badges.map((b, i) => (
          <BadgeInfoMapa key={i} label={b.label} valor={b.valor} />
        ))}
      </div>
    );
  }

  if (!composicao) return null;
  const conteudo: ConteudoCartao = resolverConteudoCartao(composicao, highlight);
  if (!conteudo.cabecalho && conteudo.linhas.length === 0) return null;

  return (
    <div
      className="absolute flex flex-col"
      style={{
        left: '0.5rem',
        bottom: '0.5rem',
        gap: '0.1875rem',
        maxWidth: 'calc(100% - 1rem)',
        backgroundColor: 'var(--vli-surface)',
        border: `1px solid ${BORDER}`,
        borderRadius: RADIUS,
        boxShadow: 'var(--vli-shadow)',
        padding: '0.5rem 0.625rem',
      }}
    >
      {conteudo.cabecalho && (
        <div className="flex items-center" style={{ gap: '0.3125rem' }}>
          <Train size="0.75rem" color={VLI_PRIMARY} strokeWidth={2.5} />
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: TEXT_HI, fontFamily: FONT }}>{conteudo.cabecalho}</span>
        </div>
      )}
      {conteudo.linhas.map((linha, i) => (
        <span key={i} style={{ fontSize: '0.65625rem', fontWeight: 600, color: linha.cor, fontFamily: FONT }}>
          {linha.texto}
        </span>
      ))}
    </div>
  );
}

/**
 * Área do mapa com zoom (scroll do mouse / pinch) e pan (clique + arraste, quando dado zoom).
 * Fica contida dentro da própria caixa do mapa — não afeta o resto do painel (Restrições etc.).
 */
/**
 * Destaque equivalente ao de CLICAR no passo `passo` da lista do J105 — mesma forma que
 * `PassosJ105Lista` (`PlanManobraX.tsx`) monta (`blocoId` + `clusterId` + `construirDestaqueEtapa`),
 * só que a partir do número do passo em vez de um clique. É por aqui que o relógio da animação do
 * V2 mantém a lista de passos sincronizada enquanto toca, reaproveitando o MESMO canal de
 * `highlight` do clique — sem nenhum estado paralelo. `null` quando o passo não existe no plano.
 */
function destaqueDoPassoJ105(plano: PlanoManobra, passo: number): CompositionHighlight | null {
  for (const bloco of plano.blocos) {
    for (const cluster of bloco.clusters) {
      const etapa = cluster.etapas.find((e) => passoDoEtapaId(e.id) === passo);
      if (!etapa) continue;
      const etapaHighlight = construirDestaqueEtapa(cluster, etapa);
      if (!etapaHighlight) return null;
      return { blocoId: bloco.id, clusterId: cluster.id, etapa: etapaHighlight };
    }
  }
  return null;
}

function ZoomableMapa({
  trenSelecionado,
  trens,
  onSelecionarTrem,
  plano,
  fichaAprovada,
  statusFichaPorTremTodos,
  highlight,
  onHighlightChange,
  legendFilter,
  zoom,
  onZoomChange,
  detalheAutomatico,
  onDetalheAutomaticoChange,
  veiculosFoco,
}: {
  /** Trem ativo na barra de seleção do Plano de Manobra — decide EM QUAL LINHA o mapa desenha a
   *  composição (ver `planoTopologiaAdapter.ts`). Trocar de trem troca de linha (não é posição
   *  real do pátio — ver comentário no adapter). */
  trenSelecionado: string;
  /** Trens do dia/pátio ativo — opções do `SeletorTremMapa` flutuante (canto superior esquerdo).
   *  Mesma lista que alimenta a barra "Trens do Dia" do painel de Planejamento; trocar aqui ou
   *  lá dá no mesmo (`onSelecionarTrem` é o mesmo `selecionarTrem` de `PlanejamentoScreen`). */
  trens: string[];
  onSelecionarTrem: (trem: string) => void;
  /** Plano do trem selecionado — resolvido pelo pai (`TopologicalPanel`). Mesmo plano ORIGINAL do
   *  mock, não a cópia editável que `PlanManobraX` mantém internamente (edições ao vivo no plano
   *  ainda não refletem aqui). Também alimenta o `MapaNavegacaoPainel` flutuante (Bloco/Grupo/
   *  Etapa, ao lado do `SeletorTremMapa`). */
  plano: PlanoManobra;
  /** Ficha Operacional do trem selecionado já aprovada? Sem ficha aprovada não existe Plano de
   *  Manobra de verdade ainda (`PlanManobraX` mostra "Aguardando confirmação..." em vez do
   *  plano) — o mapa acompanha a mesma regra: nenhuma composição sintetizada/injetada na
   *  topologia, pátio aparece vazio (sem trem nenhuma linha) até a ficha ser aprovada. */
  fichaAprovada: boolean;
  /** Status (pendente/aprovada) de TODOS os trens do dia, não só o selecionado — usado só pra
   *  filtrar as composições de FUNDO (`filterUnapprovedBackgroundTrains`) dos trens "de fundo"
   *  (`TREM_FUNDO_SELECIONAVEL`) que ainda não têm ficha aprovada, pra elas não aparecerem no
   *  pátio (nem esmaecidas) até lá. */
  statusFichaPorTremTodos: Record<string, { pendente: boolean; fichaId: string }>;
  /** Bloco/Grupo ativo no Plano de Manobra (painel esquerdo) — repassado direto ao
   *  `TrainYardSVG` para destacar os segmentos da composição correspondentes e esmaecer o
   *  resto do trem (ver `Composition.tsx`). `null`/`undefined` = nenhuma seleção. TAMBÉM
   *  repassado ao `MapaNavegacaoPainel` flutuante — mesmo estado, os dois lêem/escrevem nele. */
  highlight?: CompositionHighlight | null;
  /** Setter do MESMO estado de `highlight` — usado pelo `MapaNavegacaoPainel` flutuante
   *  (2026-08-26: "reaproveite o mesmo estado... não crie um sistema de estado paralelo"). */
  onHighlightChange: (next: CompositionHighlight | null) => void;
  legendFilter: LegendFilterState;
  /** Controlado pelo pai (`MapaSidePanel`) — a Legenda (`LegendChips`, irmã deste componente,
   *  fora do canvas) também precisa saber o zoom atual pra explicar por que um marcador de
   *  detalhe ativo não está desenhando (ver `ZOOM_SEMANTICO_LIMIAR`). */
  zoom: number;
  onZoomChange: (next: number) => void;
  /** Liga/desliga o zoom semântico (toggle "Ver detalhes ao aproximar", ver
   *  `ToggleDetalhamentoAutomatico`). Desligado = todo item ativo na legenda desenha em
   *  qualquer zoom (comportamento anterior ao zoom semântico) — ver cálculo de `detalheVisivel`
   *  abaixo, mesma regra usada em `TopologicalPanel` pra `LegendChips`. */
  detalheAutomatico: boolean;
  onDetalheAutomaticoChange: (next: boolean) => void;
  /** Veículo(s) (vagão/locomotiva) focados pontualmente a partir de "Composição Geral do Trem"
   *  (`PlanManobraX`/`TagVagao`, ver `veiculosFoco`/`alternarFocoVeiculo` em `PlanejamentoScreen`)
   *  — multi-seleção (2026-08-27, pedido explícito: "eu posso ir selecionando mais de um
   *  [vagão]"), toggle por clique (clicar de novo desseleciona). Quando não-vazio, tem
   *  prioridade sobre `highlight` na câmera (ver `centralizarCameraNoAlvo` abaixo: enquadra a
   *  união de todos os selecionados) E é repassado direto a `TrainYardSVG`/`Composition` pra
   *  esmaecer os demais veículos no mapa ("os outros devem estar mais apagados, e o que cliquei
   *  fica em evidência"). Conjunto vazio = nenhum veículo focado, câmera cai pro alvo agregado
   *  normal (`highlight`/composição inteira), mapa sem esmaecimento por veículo. */
  veiculosFoco?: Set<string> | null;
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const arrastoRef = useRef<{
    startX: number;
    startY: number;
    origem: { x: number; y: number };
    pointerId: number;
    /** `false` até o ponteiro cruzar `ARRASTO_LIMIAR_PX` — só a partir daí chamamos
     *  `setPointerCapture` (ver `handlePointerMove`). Antes disso um clique simples continua
     *  chegando ao elemento embaixo do cursor: capturar o ponteiro já no `pointerdown`
     *  redirecionaria o `pointerup`/`click` correspondente pra este container. */
    capturado: boolean;
  } | null>(null);
  // Distância mínima (px de tela) antes de um `pointerdown` virar arrasto de pan — abaixo disso é
  // tratado como clique simples (ver `capturado` acima).
  const ARRASTO_LIMIAR_PX = 4;
  const pinchRef = useRef<{ distanciaInicial: number; zoomInicial: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [arrastando, setArrastando] = useState(false);
  // Tooltip de hover sobre uma composição (trem/vagões, `Composition.tsx`) — pedido explícito do
  // usuário, 2026-08-27: "o tooltip no hover nos trens deve seguir o padrão da plataforma
  // também" — substitui o `<title>` nativo do SVG (tooltip do sistema operacional, destoando do
  // resto da interface) por um cartão próprio, MESMOS tokens de `CartaoPino` (`Composition.tsx`:
  // `--vli-surface`/`--vli-border`/`--vli-text-hi`/`--vli-text-md`, Manrope) — a referência de
  // "padrão da plataforma" já estabelecida neste mapa (não existe nenhum outro componente de
  // tooltip por hover ativo no resto do app pra reaproveitar; ver pesquisa 2026-08-27). Guarda só
  // a posição BRUTA do cursor (`clientX`/`clientY`) — o clamp pro tooltip nunca vazar do frame do
  // mapa (ver `TooltipHoverTrem` abaixo) acontece no render, contra `containerRef`, não aqui.
  const [tooltipHover, setTooltipHover] = useState<{ info: HoverTooltipInfo; x: number; y: number } | null>(null);
  const handleHoverSegmento = useCallback((info: HoverTooltipInfo | null, x?: number, y?: number) => {
    setTooltipHover(info && x != null && y != null ? { info, x, y } : null);
  }, []);
  // Largura real do canvas (não a do painel inteiro — o mapa some por trás da lista de
  // Restrições/etc, então é ESTE container que dita quanto espaço a barra de controles flutuante
  // tem) — 2026-08-28, bug reportado pelo usuário: arrastar o divisor até o painel de Mapa ficar
  // estreito fazia a barra de seletores (Trem/Bloco/Grupo/Etapa) colidir/sobrepor o toggle "Ver
  // detalhes ao aproximar" + zoom, já que as duas eram dois blocos `position:absolute`
  // independentes, cada um sem noção da largura do outro. Vira UM layout flex-wrap só (ver JSX
  // abaixo) + este `ResizeObserver` pra saber quando esconder o rótulo do toggle (`controlesCompactos`,
  // abaixo) — só isso garante nenhuma sobreposição em NENHUMA largura, inclusive a mínima antes do
  // snap automático pra "só mapa" (`SPLIT_SNAP_MIN_PX`).
  const [larguraContainer, setLarguraContainer] = useState<number | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const largura = entries[0]?.contentRect.width;
      if (largura != null) setLarguraContainer(largura);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // Abaixo disso, o rótulo do toggle ("Ver detalhes ao aproximar") some, sobrando só o switch —
  // valor calibrado pra sobrar espaço suficiente pros seletores de Trem/Bloco/Grupo/Etapa (que já
  // quebram em mais linhas sozinhos, ver `flex-wrap` no JSX) mesmo na largura mínima do painel.
  const LARGURA_TOGGLE_COMPACTO = 480;
  const controlesCompactos = larguraContainer != null && larguraContainer < LARGURA_TOGGLE_COMPACTO;
  const lineId = useMemo(() => pickLineIdForTrem(trenSelecionado), [trenSelecionado]);
  // Injeta a composição sintetizada do trem ANTES do filtro da legenda (não depois) — assim o
  // toggle "Composição (trem/vagões)" da legenda continua controlando sua visibilidade como
  // qualquer outro elemento, em vez de ela sempre aparecer independente do filtro. Só injeta com
  // `fichaAprovada`: sem ficha aprovada não há Plano de Manobra de verdade ainda, então não há
  // trem real pra mostrar no pátio (mesma regra de `PlanManobraX`, que troca o painel inteiro por
  // "Aguardando confirmação..." nesse estado) — o pátio renderiza vazio, sem composição nenhuma.
  // `legendFilter` vem de `MapaSidePanel`. A legenda em si (`LegendChips`) vive FORA daqui,
  // embaixo do canvas — ver `TopologicalPanel`.
  // J105 desenha a própria composição veículo a veículo, por passo (`ComposicaoJ105Layer`) — ver
  // `visualJ105.ts`. Os demais trens seguem com o pino único sintetizado em `buildTrainComposition`.
  // J105 V2: MESMA régua veículo a veículo do V1 (por isso `modoJ105` também é verdadeiro pra
  // ele — é o que tira os trens de fundo, esconde o glyph genérico do AMV e impede a composição
  // sintetizada de `buildTrainComposition`), só que desenhada num INSTANTE da linha do tempo em
  // vez de num passo discreto (ver `animacaoJ105.ts`/`ComposicaoJ105V2Layer`).
  const modoJ105V2 = trenSelecionado === TREM_J105_V2;
  /** J105 V2 com a ficha ainda não aprovada — mapa só com o pátio, sem trem nem reprodução. */
  const v2SemFicha = modoJ105V2 && !fichaAprovada;
  const modoJ105 = trenSelecionado === 'J105' || modoJ105V2;
  const passoJ105 = useMemo(() => passoDoEtapaId(highlight?.etapa?.etapaId), [highlight]);
  // AMV do Travessão 2 (só J105) — precisa aparecer no mapa SEMPRE (todos os 38 passos, não só
  // durante manipulação), independente da legenda: é o losango dedicado (`AmvJ105Marker`,
  // `ComposicaoJ105Layer.tsx`), não um marcador opcional de contexto. `undefined` nos demais
  // trens (nenhum forçado, comportamento de sempre).
  const forcedVisibleMarkerId = modoJ105 ? AMV_T2_MARKER_ID : undefined;
  const topologiaPatio = useMemo(() => {
    // Sempre primeiro: tira do pátio qualquer trem "de fundo" sem ficha aprovada ainda, ANTES de
    // injetar a composição do trem selecionado ou aplicar o filtro da legenda — ver
    // `filterUnapprovedBackgroundTrains`.
    const topologiaAprovada = filterUnapprovedBackgroundTrains(EHT_TOPOLOGY, statusFichaPorTremTodos);
    // J105: nenhum trem de fundo aparece, aprovado ou não — só o que faz parte do próprio plano do
    // J105 (pedido explícito do usuário, 2026-09-22, ver `removerComposicoesDeFundo`). Aplicado
    // ANTES do `if (!fichaAprovada)` abaixo de propósito: o corte de trens de fundo é sobre a
    // IDENTIDADE do trem selecionado, não sobre o estado da ficha dele.
    const semFundo = modoJ105 ? removerComposicoesDeFundo(topologiaAprovada) : topologiaAprovada;
    // J105 V2: Terminal da Ferradura em vermelho (linha normal, só recolorida), casando com a restrição listada em
    // "Restrições Ativas" (`RESTRICOES_J105_V2`) — ver `marcarRestricaoFerradura`.
    const topologiaBase = modoJ105V2 ? marcarRestricaoFerradura(semFundo) : semFundo;
    if (!fichaAprovada) return filterTopology(topologiaBase, modoJ105V2 ? FILTRO_LEGENDA_J105_V2 : legendFilter, forcedVisibleMarkerId);
    // J105: nada de composição sintetizada aqui — quem desenha o trem é `ComposicaoJ105Layer`,
    // na posição do passo selecionado (senão o mesmo trem apareceria duas vezes, em lugares
    // diferentes: o pino na posição fixa e a composição na posição da etapa).
    // J105 V2: a legenda dele não é mais um controle (`LegendaJ105V2`), então o mapa usa sempre o
    // filtro essencial fixo — senão um item ligado/desligado na legenda interativa de outro trem
    // "vazaria" pra cá sem jeito de desfazer, e a legenda deixaria de bater com o mapa.
    if (modoJ105V2) return filterTopology(topologiaBase, FILTRO_LEGENDA_J105_V2, forcedVisibleMarkerId);
    if (modoJ105) return filterTopology(topologiaBase, legendFilter, forcedVisibleMarkerId);
    const lineLength = EHT_TOPOLOGY.lines.find((l) => l.id === lineId)?.length ?? 1000;
    const composicao = buildTrainComposition(plano, lineLength);
    // `backgroundElementIdForTrem`: quando `trenSelecionado` é um dos trens "de fundo" (ver
    // `POSICAO_TREM_CONHECIDO`, `planoTopologiaAdapter.ts`), remove o bloco de contexto estático
    // que ocupava a mesma posição — senão os dois desenham sobrepostos.
    const comTrem = injectTrainComposition(topologiaAprovada, lineId, composicao, backgroundElementIdForTrem(trenSelecionado));
    return filterTopology(comTrem, legendFilter, forcedVisibleMarkerId);
  }, [legendFilter, plano, lineId, fichaAprovada, trenSelecionado, statusFichaPorTremTodos, modoJ105, modoJ105V2, forcedVisibleMarkerId]);
  // Mesma projeção que `TrainYardSVG` desenha (`projectYardScene`, opções de layout idênticas)
  // — calculada aqui de novo (é pura/barata) só pra achar em que coordenada de viewBox o Bloco/
  // Grupo em destaque cai, e centralizar a câmera nele (ver efeito abaixo). Sem isso, `ZoomableMapa`
  // não tem nenhuma noção de onde as coisas ficam desenhadas — só o `TrainYardSVG` sabia.
  const scene = useMemo(() => projectYardScene(topologiaPatio), [topologiaPatio]);
  // Composição REAL do trem selecionado (não uma de fundo) dentro da cena já projetada — usada
  // por `PainelInfoMapa` pra montar o mesmo resumo trem/Bloco/Grupo que `resolverConteudoCartao`
  // já calculava (`Composition.tsx`), agora fora do SVG. Busca por id exato
  // (`composicao-${trenSelecionado}`, MESMA convenção de `buildTrainComposition`,
  // `planoTopologiaAdapter.ts`) — não só "a primeira composição da cena": uma linha pode ter
  // TANTO a composição real quanto (temporariamente, antes do highlight recalcular) um bloco de
  // fundo remanescente, e `background: true` nunca deve ser confundido com o trem em foco.
  const composicaoSelecionada = useMemo(() => {
    const idAlvo = `composicao-${trenSelecionado}`;
    for (const line of scene.lines) {
      const el = line.elements.find((e) => e.kind === 'composition' && e.id === idAlvo);
      if (el) return el as ProjectedComposition;
    }
    return null;
  }, [scene, trenSelecionado]);

  // ------------------------------------------------------------------ relógio da animação (V2)
  // Estado da reprodução do J105 V2. Mora AQUI (e não no componente de topo) porque tudo que
  // precisa dele já é prop deste componente: a cena projetada pra desenhar, e `highlight`/
  // `onHighlightChange` pra sincronizar com a lista de passos do painel esquerdo — o mesmo canal
  // que o clique num passo já usa. Nenhum outro trem chega a instanciar nada disso.
  const [tempoAnim, setTempoAnim] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [velocidadeAnim, setVelocidadeAnim] = useState<VelocidadeJ105>(30);
  const [seguindoAnim, setSeguindoAnim] = useState(false);
  // Sem ficha aprovada o V2 não tem trem nem controles — se estava tocando (ex.: troca de data),
  // pausa, pra o relógio não seguir andando escondido.
  useEffect(() => {
    if (v2SemFicha) setTocando(false);
  }, [v2SemFicha]);
  const estagioAnim = useMemo(() => estagioEmT(tempoAnim), [tempoAnim]);
  const emMarchaAnim = useMemo(() => estadoAnimadoJ105(tempoAnim).emMarcha, [tempoAnim]);
  /** Último passo que ESTE componente publicou em `highlight` — trava anti-laço da sincronia
   *  relógio ↔ lista de passos (ver os dois efeitos mais abaixo). */
  const passoAplicadoRef = useRef<number | null>(null);

  // Trocar de trem zera a reprodução — o relógio é do J105 V2, não do painel.
  // `passoAplicadoRef` (a trava anti-laço da sincronia com a lista de passos, declarada abaixo)
  // TAMBÉM precisa zerar aqui: `selecionarTrem` limpa o `highlight` ao trocar de trem, então o
  // passo que o relógio publicou por último deixa de estar publicado. Sem zerar, voltar pro V2
  // com o relógio de novo no passo 1 batia com o valor guardado, a trava suprimia a republicação
  // e a lista ficava sem nenhum passo aberto até o relógio virar de etapa.
  useEffect(() => {
    setTempoAnim(0);
    setTocando(false);
    passoAplicadoRef.current = null;
  }, [trenSelecionado]);

  // Laço de reprodução — `requestAnimationFrame` com delta real entre quadros (não um `setInterval`
  // de passo fixo): é assim que a engine de referência avança o relógio (`tick`), e é o que mantém
  // a velocidade correta independente da taxa de quadros da máquina. `velocidade` é o multiplicador
  // de tempo: 30× = 30 s de pátio por segundo de tela.
  useEffect(() => {
    if (!modoJ105V2 || !tocando) return;
    let raf = 0;
    let anterior: number | null = null;
    const quadro = (ts: number) => {
      if (anterior != null) {
        const delta = ((ts - anterior) / 1000) * velocidadeAnim;
        setTempoAnim((t) => Math.min(DURACAO_TOTAL_J105, t + delta));
      }
      anterior = ts;
      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
  }, [modoJ105V2, tocando, velocidadeAnim]);

  // Chegou ao fim: pausa sozinho (senão o botão continuaria dizendo "pausar" com o relógio parado).
  useEffect(() => {
    if (tocando && tempoAnim >= DURACAO_TOTAL_J105) setTocando(false);
  }, [tocando, tempoAnim]);

  // --- sincronia relógio ↔ lista de passos ---------------------------------------------------
  // Os dois sentidos passam pelo MESMO `highlight` que o clique num passo já usava (nenhum estado
  // paralelo): o relógio empurra o passo corrente pra lá enquanto toca, e um clique na lista
  // (que muda `highlight` por fora) puxa o relógio pro início daquele passo. `passoAplicadoRef`
  // guarda o último passo que ESTE componente publicou, pra um sentido não disparar o outro em
  // laço.
  const passoDoRelogio = estagioAnim.estagio.passo;
  const passoDoHighlight = passoJ105;

  useEffect(() => {
    if (!modoJ105V2) return;
    if (passoAplicadoRef.current === passoDoRelogio) return;
    passoAplicadoRef.current = passoDoRelogio;
    const destaque = destaqueDoPassoJ105(plano, passoDoRelogio);
    if (destaque) onHighlightChange(destaque);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoJ105V2, passoDoRelogio, plano]);

  useEffect(() => {
    if (!modoJ105V2 || passoDoHighlight == null) return;
    if (passoDoHighlight === passoDoRelogio) return;
    passoAplicadoRef.current = passoDoHighlight;
    setTempoAnim(inicioDoPasso(passoDoHighlight));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoJ105V2, passoDoHighlight]);

  const irParaEtapa = (direcao: -1 | 1) => {
    const alvo = Math.min(TOTAL_PASSOS_J105, Math.max(1, passoDoRelogio + direcao));
    setTempoAnim(inicioDoPasso(alvo));
  };
  const buscarNoTempo = (t: number) => {
    setTempoAnim(Math.min(DURACAO_TOTAL_J105, Math.max(0, t)));
  };

  // Margem extra além do limite "exato" (ver abaixo) — só pra não precisar arrastar até o
  // pixel-perfeito da borda pra enxergar rótulos que passam um pouco do fim do desenho.
  const PAN_FOLGA = 48;

  // Atraso do debounce da câmera (Gatilho 1, abaixo) — curto o bastante pra um clique único
  // continuar parecendo instantâneo, longo o bastante pra engolir os passos intermediários de
  // uma navegação rápida por setinha (ver comentário do efeito).
  const CENTRALIZAR_DEBOUNCE_MS = 150;

  function limitarPan(proximoPan: { x: number; y: number }, z: number) {
    // O conteúdo escalado mede largura/altura do container × z (o filho que recebe o
    // `scale()` já é 100%/100% do container — não tem tamanho intrínseco próprio). Logo, pra
    // alcançar a borda real do desenho em qualquer zoom, o limite de arrasto tem que ser
    // proporcional ao tamanho REAL do container, não um número fixo — um valor fixo (ex.: 160px)
    // é bom demais pra um pátio estreito e curto demais pra um largo, cortando as pontas do mapa
    // permanentemente (sem jeito de arrastar até elas) quando o container é mais largo do que o
    // fixo previa. `+ PAN_FOLGA` dá uma margem extra de conforto além do estritamente necessário.
    const rect = containerRef.current?.getBoundingClientRect();
    const largura = rect?.width ?? 0;
    const altura = rect?.height ?? 0;
    // `Math.max(0, ...)`: `z` nunca devia ficar abaixo de `ZOOM_MIN` (ambos os chamadores já
    // clampam antes), mas sem esse piso um `z < 1` residual inverteria o limite (min > max) e
    // `clamp` degeneraria pra uma constante errada em vez de "sem limite extra além da folga" —
    // guarda barata contra esse caso degenerado.
    const limiteX = Math.max(0, (largura * (z - 1)) / 2) + PAN_FOLGA;
    const limiteY = Math.max(0, (altura * (z - 1)) / 2) + PAN_FOLGA;
    return { x: clamp(proximoPan.x, -limiteX, limiteX), y: clamp(proximoPan.y, -limiteY, limiteY) };
  }

  // `origem`, quando presente, é a posição do mouse (em px, relativa ao container) no momento do
  // zoom — o ponto do mapa que estava embaixo do cursor fica ANCORADO na mesma posição de tela
  // depois do zoom (zoom "segue o mouse", em vez de sempre expandir a partir do centro do
  // container, que forçava arrastar depois pra reencontrar o trecho de interesse). Sem `origem`
  // (botões +/-, ajuste automático de câmera, `ZOOM_MIN`), mantém o comportamento antigo:
  // zoom cresce a partir do centro do container.
  function aplicarZoom(proximoZoom: number, origem?: { x: number; y: number }) {
    const z = clamp(proximoZoom, ZOOM_MIN, ZOOM_MAX);
    const zoomAnterior = zoom;
    onZoomChange(z);
    setPan((p) => {
      if (z === ZOOM_MIN) return { x: 0, y: 0 };
      if (!origem) return limitarPan(p, z);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return limitarPan(p, z);
      // `origem` relativo ao CENTRO do container (mesma referência de `transform-origin: center
      // center` no wrapper transformado, ver JSX abaixo) — fórmula clássica de "zoom to point":
      // ponto fixo (`mx`,`my`) + delta entre pan atual e o ponto, escalado pela razão de zoom.
      const mx = origem.x - rect.width / 2;
      const my = origem.y - rect.height / 2;
      const razao = z / zoomAnterior;
      return limitarPan({ x: mx + (p.x - mx) * razao, y: my + (p.y - my) * razao }, z);
    });
  }

  // Câmera (zoom + pan) se ajusta sozinha ao alvo ativo. O pino da composição não se move entre
  // nada-selecionado/Bloco/Grupo (só o cartão acima dele muda de conteúdo — ver `Composition.tsx`),
  // então o alvo de câmera desses 3 níveis é sempre o MESMO ponto (`findCompositionFocusTarget`,
  // `focus.ts`) — só a Etapa PARADA tem um alvo geométrico próprio (`findEtapaFocusTarget`, o
  // trecho que `EtapaParadaLayer.tsx` desenha). Sincronizado 1:1 com o accordion do Plano
  // (`PlanManobraX.tsx`) via `highlight`. Suave porque só muda `zoom`/`pan` (o
  // `transition: 'transform 0.15s ease-out'` do wrapper abaixo já anima qualquer mudança desses
  // dois, manual ou automática, sem precisar de lógica de animação própria aqui).
  //
  // Extraído de dentro do `useEffect` pra função nomeada (2026-08-26) — precisa ser chamado de
  // DOIS gatilhos agora, não só um: trocar de trem/Bloco/Grupo/Etapa (muda `scene`/`highlight`,
  // efeito logo abaixo) E redimensionar o CONTAINER em si (`ResizeObserver`, efeito seguinte). O
  // bug real que motivou o segundo gatilho: `pan` é guardado em PIXELS absolutos de tela,
  // calculados a partir do tamanho do container NO MOMENTO do ajuste — ao trocar de modo de
  // layout (só plano / dividido / só mapa, `LayoutSegmentedControl`), o container muda de
  // largura (a mesma % da viewBox agora vale um número de pixels diferente, `escalaBase` muda),
  // mas como `scene`/`highlight` não mudam nessa troca, o efeito antigo (só `[scene, highlight]`)
  // nunca recalculava — o `pan` antigo (em pixels da largura ANTIGA) ficava apontando pra um
  // pedaço errado do mapa na largura NOVA, perdendo o enquadramento do ponto/trajeto selecionado
  // (2026-08-26, pedido explícito do usuário, com prints comparando dividido vs. só-mapa: "o
  // ESTADO DO MAPA... deve ser MANTIDO — a troca de layout só deve expandir/reduzir o espaço
  // visível... sem resetar ou recalcular o enquadramento pra uma posição genérica").
  function centralizarCameraNoAlvo() {
    // J105: o alvo é um recorte do que REALMENTE importa no passo atual — não mais "todos os
    // grupos desenhados" (`alvoComposicaoJ105`, guardado como fallback dentro de
    // `alvoCameraJ105` pros passos sem corte/AMV) — pedido explícito do usuário, 2026-09-22: "não
    // preciso ver o trem todo... corte, pode dar zoom ali... manipulação de AMV, pode dar zoom no
    // AMV". Só ele passa por aqui; os demais trens continuam usando os alvos de `focus.ts`
    // (composição sintetizada/pino de etapa), inalterados.
    // `veiculosFoco` (clique num vagão/locomotiva na "Composição Geral do Trem", ver
    // `TagVagao`/`PlanManobraX`) tem prioridade sobre `highlight` — mostrar o(s) veículo(s)
    // clicado(s), não o bloco/grupo/trem inteiro que porventura já estivesse selecionado no Plano
    // de Manobra. Conjunto vazio (nenhum veículo focado, ou o último foi desselecionado) cai pro
    // alvo normal (`highlight`/composição inteira) — mesmo comportamento de antes.
    const alvo = modoJ105
      ? alvoCameraJ105(scene, scene.labelGutterWidth, passoJ105 ?? 1)
      : (veiculosFoco?.size ? findVeiculoFocusTarget(scene, trenSelecionado, Array.from(veiculosFoco)) : null) ??
        (highlight ? findHighlightFocusTarget(scene, highlight, trenSelecionado) : null) ??
        findCompositionFocusTarget(scene, trenSelecionado);
    if (!alvo) {
      // Nenhuma composição em cena (pátio vazio) — não há o que ancorar; cai pro zoom base (mesmo
      // efeito do botão "Restaurar zoom").
      aplicarZoom(ZOOM_MIN);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    const largura = rect?.width ?? 0;
    const altura = rect?.height ?? 0;
    if (!largura || !altura) return;

    // Escala base (zoom=1, pan=0): mesma conta que `preserveAspectRatio="xMidYMid meet"` do SVG
    // já faz sozinho pra caber a viewBox inteira no container — precisamos dela aqui pra saber
    // quanto 1 unidade de viewBox vale em pixels de tela ANTES do zoom extra do wrapper CSS.
    const escalaBase = Math.min(largura / scene.viewBoxWidth, altura / scene.viewBoxHeight);
    // Zoom que faz a caixa ocupar uma fração do container (nem colada na borda, nem minúscula no
    // meio de um mapa vazio) — o menor dos dois eixos manda, pra nunca cortar a caixa por fora do
    // container no outro eixo. Parada (a composição principal, já parada desde o início do Grupo)
    // usa uma fração bem maior que o pino da composição — um trecho pode ser comprido (ex.: 1200m
    // de uma linha de quase 2km) e precisa de uma câmera mais próxima pra ler o trajeto/badge/pino
    // direito (feedback do usuário, 2026-08-25); a caixa já inclui `FOCUS_PADDING_X/Y`
    // (`focus.ts`), então mesmo 95% ainda deixa margem suficiente pro ponto inicial e final
    // continuarem visíveis por inteiro. Clear e a Rota 1 de Retirada TÊM trajeto real também (ver
    // `EtapaParadaLayer.tsx`/`EtapaRetiradaLayer.tsx`), mas ficavam grandes DEMAIS na tela com a
    // mesma fração de Parada — usam uma fração menor, perto da de Corte (feedback do usuário,
    // 2026-08-25: "deixe um pouco menos de zoom, algo próximo do corte... pra não ficar muito
    // grande na tela"). Clear, especificamente, ainda ficava grande demais nessa fração — reduzida
    // de novo, um pouco abaixo da de Corte (2026-08-25: "tire um pouco mais do zoom da fase
    // Clear"). Corte não tem trajeto — é um ponto só (mesma categoria do pino de composição,
    // `alvoDoPino`), por isso usa a fração menor original (0.55).
    // Trem/Bloco/Grupo (sem Etapa) — 2026-08-27, pedido explícito do usuário: "a ancora pode ser
    // mais próxima... mais zoom. tanto no trem, quanto no bloco, quanto o grupo" — subida de 0.55
    // pra 0.75 (mesma régua/técnica das frações de Etapa acima, só um valor mais alto pros 3
    // níveis). CORTE continua com o 0.55 original (não mencionado no pedido) — por isso ganhou
    // seu próprio ramo aqui em vez de cair no mesmo `else` de antes.
    // J105: fração própria (não cai nas de cima — `highlight.etapa.tipo` é sempre 'PARADA' pra
    // este trem, mas o alvo aqui é a caixa de `alvoCameraJ105` — corte/AMV/grupos de composição,
    // não o trajeto/pino de `EtapaParadaLayer`; 0.8 deixa uma folga confortável ao redor do
    // recorte, mesmo agora que ele costuma ser bem mais apertado que "todos os grupos").
    const fracaoAlvo = modoJ105 ? 0.8
      : highlight?.etapa?.tipo === 'PARADA' ? 0.95
      : highlight?.etapa?.tipo === 'RETIRADA' || highlight?.etapa?.tipo === 'INCLUSAO' || highlight?.etapa?.tipo === 'FECHAMENTO' ? 0.6
      : highlight?.etapa?.tipo === 'CLEAR' ? 0.48
      : highlight?.etapa?.tipo === 'CORTE' ? 0.55
      : 0.75;
    const zoomParaCaberX = (largura * fracaoAlvo) / (escalaBase * (alvo.x1 - alvo.x0));
    const zoomParaCaberY = (altura * fracaoAlvo) / (escalaBase * (alvo.y1 - alvo.y0));
    const zoomAlvo = clamp(Math.min(zoomParaCaberX, zoomParaCaberY), ZOOM_MIN, ZOOM_MAX);

    const centroX = (alvo.x0 + alvo.x1) / 2;
    const centroY = (alvo.y0 + alvo.y1) / 2;
    const panAlvo = {
      x: -zoomAlvo * escalaBase * (centroX - scene.viewBoxWidth / 2),
      y: -zoomAlvo * escalaBase * (centroY - scene.viewBoxHeight / 2),
    };

    onZoomChange(zoomAlvo);
    setPan(limitarPan(panAlvo, zoomAlvo));
  }

  /**
   * Câmera do J105 V2 — não passa pelo `centralizarCameraNoAlvo` acima porque o alvo aqui muda a
   * CADA QUADRO, não a cada seleção:
   * - "Pátio inteiro" (padrão): zoom base e pan zerado, exatamente o mesmo enquadramento do botão
   *   "Restaurar zoom". O trem inteiro e as duas linhas ficam visíveis o plano todo, que é o que
   *   se quer ao assistir a manobra de ponta a ponta.
   * - "Seguir a composição": pan acompanha o centro dos corpos em manobra, com zoom FIXO
   *   (`ZOOM_SEGUIR_J105V2`). O zoom é fixo de propósito: enquadrar a caixa dos corpos faria o
   *   zoom variar junto com o comprimento desenhado do trem (que muda a cada corte), e a imagem
   *   ficaria "respirando" o tempo todo. Mesma escolha da engine de referência, que segue a peça
   *   com um `span` fixo de 520 m.
   */
  const ZOOM_SEGUIR_J105V2 = 2.2;
  useEffect(() => {
    if (!modoJ105V2) return;
    // Sem ficha aprovada não há trem desenhado — câmera no pátio inteiro, nunca seguindo.
    if (v2SemFicha) {
      onZoomChange(ZOOM_MIN);
      setPan({ x: 0, y: 0 });
      return;
    }
    // Veículo(s) selecionados na Composição Geral têm prioridade sobre os dois modos acima —
    // mesma regra dos demais trens (`centralizarCameraNoAlvo`): enquadra o trecho que contém o
    // veículo, com a mesma fração/limites de zoom usados lá.
    const alvoFoco = veiculosFoco?.size ? alvoVeiculosJ105V2(scene, scene.labelGutterWidth, tempoAnim, veiculosFoco) : null;
    if (alvoFoco) {
      const rect = containerRef.current?.getBoundingClientRect();
      const largura = rect?.width ?? 0;
      const altura = rect?.height ?? 0;
      if (!largura || !altura) return;
      const escalaBase = Math.min(largura / scene.viewBoxWidth, altura / scene.viewBoxHeight);
      const fracao = 0.6;
      const zx = (largura * fracao) / (escalaBase * Math.max(1, alvoFoco.x1 - alvoFoco.x0));
      const zy = (altura * fracao) / (escalaBase * Math.max(1, alvoFoco.y1 - alvoFoco.y0));
      const z = clamp(Math.min(zx, zy, ZOOM_SEGUIR_J105V2 * 2), ZOOM_MIN, ZOOM_MAX);
      const cx = (alvoFoco.x0 + alvoFoco.x1) / 2;
      const cy = (alvoFoco.y0 + alvoFoco.y1) / 2;
      onZoomChange(z);
      setPan(limitarPan({ x: -z * escalaBase * (cx - scene.viewBoxWidth / 2), y: -z * escalaBase * (cy - scene.viewBoxHeight / 2) }, z));
      return;
    }
    if (!seguindoAnim) {
      onZoomChange(ZOOM_MIN);
      setPan({ x: 0, y: 0 });
      return;
    }
    const alvo = alvoCameraJ105V2(scene, scene.labelGutterWidth, tempoAnim);
    if (!alvo) return;
    const rect = containerRef.current?.getBoundingClientRect();
    const largura = rect?.width ?? 0;
    const altura = rect?.height ?? 0;
    if (!largura || !altura) return;
    const escalaBase = Math.min(largura / scene.viewBoxWidth, altura / scene.viewBoxHeight);
    const centroX = (alvo.x0 + alvo.x1) / 2;
    const centroY = (alvo.y0 + alvo.y1) / 2;
    const z = ZOOM_SEGUIR_J105V2;
    onZoomChange(z);
    setPan(
      limitarPan(
        {
          x: -z * escalaBase * (centroX - scene.viewBoxWidth / 2),
          y: -z * escalaBase * (centroY - scene.viewBoxHeight / 2),
        },
        z,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoJ105V2, v2SemFicha, seguindoAnim, tempoAnim, scene, veiculosFoco]);

  // Gatilho 1: troca de trem (muda `scene`) OU seleção de Bloco/Grupo/Etapa (muda `highlight`).
  // Passa por um debounce curto (`CENTRALIZAR_DEBOUNCE_MS`) — 2026-09-23, pedido explícito do
  // usuário sobre a navegação por setinha do J105 (`PlanManobraX.tsx`): "o zoom no mapa ficou
  // muito vai e vem... não tá fluido quando começo a passar os passos. fica zoom in, zoom out
  // etc, etc". Causa: cada passo tem seu próprio enquadramento (`alvoCameraJ105` — corte bem
  // fechado, AMV, ou a composição inteira, alvos BEM diferentes entre si), então navegar rápido
  // (segurar/repetir a seta) disparava uma animação de câmera INTEIRA por passo intermediário —
  // o efeito visual de "zoom in, zoom out" repetido enquanto passa por eles. Sem debounce, cada
  // passo intermediário é só um degrau de uma sequência de animações concorrentes/interrompidas;
  // com debounce, só o ÚLTIMO passo (onde a navegação pausa) dispara UMA animação limpa, direto
  // do enquadramento anterior estável pro novo — sem os saltos intermediários visíveis.
  useEffect(() => {
    // J105 V2 tem câmera própria, dirigida pelo relógio da animação (efeito acima) — deixar este
    // gatilho rodar também faria os dois disputarem zoom/pan a cada quadro.
    if (modoJ105V2) return;
    const id = window.setTimeout(() => {
      centralizarCameraNoAlvo();
    }, CENTRALIZAR_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, highlight, veiculosFoco, modoJ105V2]);

  // Gatilho 2: o CONTAINER muda de tamanho (troca de modo de layout, arrasto da divisória,
  // resize da janela) — reancora no MESMO alvo pro tamanho novo, em vez de deixar o `pan` antigo
  // (calculado pro tamanho antigo) apontar pra um pedaço errado do mapa. Dispara várias vezes
  // durante a transição animada de 250ms do layout (`PANEL_TRANSITION`) — cada disparo só
  // reancora no mesmo alvo pro tamanho atual, o que produz o efeito certo: o ponto selecionado
  // continua centralizado enquanto o painel cresce/encolhe, não um salto único no fim.
  useEffect(() => {
    if (modoJ105V2) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => centralizarCameraNoAlvo());
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, highlight, veiculosFoco, modoJ105V2]);

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    const origem = rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : undefined;
    aplicarZoom(zoom + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP), origem);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (zoom <= ZOOM_MIN) return;
    arrastoRef.current = { startX: e.clientX, startY: e.clientY, origem: pan, pointerId: e.pointerId, capturado: false };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const arrasto = arrastoRef.current;
    if (!arrasto) return;
    const dx = e.clientX - arrasto.startX;
    const dy = e.clientY - arrasto.startY;
    if (!arrasto.capturado) {
      // Ainda dentro do limiar de clique — não vira arrasto (nem captura o ponteiro) até o
      // cursor se mover de verdade, senão um clique simples no trem nunca chegaria até o
      // `onClick` dele (ver comentário em `arrastoRef`).
      if (Math.hypot(dx, dy) < ARRASTO_LIMIAR_PX) return;
      arrasto.capturado = true;
      setArrastando(true);
      e.currentTarget.setPointerCapture(arrasto.pointerId);
    }
    setPan(limitarPan({ x: arrasto.origem.x + dx, y: arrasto.origem.y + dy }, zoom));
  }

  function handlePointerUp() {
    arrastoRef.current = null;
    setArrastando(false);
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2) {
      pinchRef.current = { distanciaInicial: distanciaEntreToques(e.touches), zoomInicial: zoom };
    }
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const razao = distanciaEntreToques(e.touches) / pinchRef.current.distanciaInicial;
      aplicarZoom(pinchRef.current.zoomInicial * razao);
    }
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length < 2) pinchRef.current = null;
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        borderRadius: RADIUS,
        // 2026-08-28, pedido explícito do usuário: "o frame específico do mapa, que começa o
        // fundo cinza com dot grid, pode ter uma borda ali" — borda só neste frame (a "superfície"
        // do canvas em si, com o dot grid), não no `TopologicalPanel` por fora dele (esse já
        // encosta direto na borda do `PainelCard`, ver ali — uma borda redundante bem em cima da
        // outra não era o pedido).
        border: `1px solid ${BORDER}`,
        touchAction: 'none',
        // Zoom base (sem pan possível ainda, `handlePointerDown` ignora zoom <= ZOOM_MIN): seta
        // Seta customizada (`MAP_CURSOR`) em toda a área do mapa, em qualquer nível de zoom —
        // sem troca pra cursor de mão (grab/grabbing) durante o pan, depois de várias tentativas
        // de cursor de mão (desenhado à mão, nativo do SO, assets prontos) não convencerem
        // visualmente; só a seta mesmo, de forma consistente.
        cursor: MAP_CURSOR,
        // Fundo próprio (não o branco/PANEL_BG herdado do card) — o canvas do mapa lê como uma
        // "superfície" distinta do chrome do painel ao redor. Token dedicado (`--vli-map-canvas-bg`,
        // não `BG_DEEP` direto): no dark mode, --vli-bg-deep é escuro demais e o dot grid contrasta
        // forte demais em cima dele — este token é um pouco mais claro só nesse tema. No light
        // mode os dois valores coincidem (--vli-bg-deep já ficava bom).
        backgroundColor: MAP_CANVAS_BG,
        // Dot grid — sinaliza visualmente que a área é interativa (zoom/pan), mesmo padrão de
        // "canvas" usado em ferramentas de diagrama. Puramente decorativo: fica fora da `div`
        // que recebe o `transform` do mapa, então não acompanha pan/zoom (fixo em relação ao
        // frame, não ao conteúdo) — só precisa avisar "isso aqui se arrasta", não simular um
        // canvas infinito. `color-mix` (não `BORDER` puro) — 2026-08-31, pedido explícito do
        // usuário: "deixe os dot grids um pouco mais sutil", os pontos competiam demais com o
        // resto do canvas na força total da cor de borda. 80% (não os 50% da primeira tentativa,
        // "mais sutil" demais) — ajuste fino também explícito do usuário.
        backgroundImage: `radial-gradient(circle, color-mix(in srgb, ${BORDER} 80%, transparent) 1px, transparent 1px)`,
        backgroundSize: '1.125rem 1.125rem',
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          // No modo "seguir a composição" do V2 o pan é recalculado a cada quadro; deixar a
          // transição de 0,15 s ligada faria a câmera correr sempre atrás do alvo (arrasto/
          // borrão constante) em vez de acompanhar. O movimento já é suave por si — quem
          // interpola é a posição do trem, não a câmera.
          transition: arrastando || (modoJ105V2 && seguindoAnim) ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        <TrainYardSVG
          topology={topologiaPatio}
          detalheVisivel={!detalheAutomatico || zoom >= ZOOM_SEMANTICO_LIMIAR}
          // Sem ficha aprovada o V2 também não desenha destaque de passo (o relógio da animação
          // segue publicando o Passo 1 em `highlight`, que cairia no trajeto genérico de PARADA).
          highlight={v2SemFicha ? null : highlight}
          onHoverSegmento={handleHoverSegmento}
          veiculosFoco={veiculosFoco}
          // J105 V2 sem ficha aprovada: mapa vazio — sem a composição (nem a animada, nem o
          // estado estático do V1 como fallback) e sem controles de reprodução (abaixo). 2026-09-24,
          // pedido explícito do usuário: "quando o J105-V2 não tiver ficha aprovada, não é possível
          // dar play, nem ver o trem".
          modoJ105={modoJ105 && !v2SemFicha}
          passoJ105={passoJ105}
          tempoJ105V2={modoJ105V2 && !v2SemFicha ? tempoAnim : null}
        />
      </div>

      {tooltipHover && (
        <TooltipHoverTrem hover={tooltipHover} containerRef={containerRef} />
      )}

      {/* Canto inferior ESQUERDO — resumo trem/Bloco/Grupo ou badges da Etapa em destaque, ver
         `PainelInfoMapa` (2026-08-27, pedido explícito do usuário: substitui o antigo balão
         sempre ancorado acima da composição, "deixe ele na parte inferior do mapa, no canto
         inferior esquerdo"). `stopPropagation` pela mesma razão dos outros dois cantos. */}
      {/* No J105 V2 o rodapé do canvas é dos controles de reprodução (abaixo) — os dois ocupam a
         mesma faixa. Os dados que `PainelInfoMapa` mostraria (linha, referência, responsável do
         passo) continuam à mão: são os do passo corrente, que o V2 mantém aberto e sincronizado
         na lista de passos do painel esquerdo enquanto a animação roda. */}
      {!modoJ105V2 && (
        <div onPointerDown={(e) => e.stopPropagation()}>
          <PainelInfoMapa composicao={composicaoSelecionada} highlight={highlight} plano={plano} />
        </div>
      )}

      {/* Controles de reprodução — só o J105 V2. Rodapé do canvas (não o topo, onde ficam zoom e
         seletores): é onde um "player" é procurado, e a barra é larga demais pra dividir a
         primeira linha com os botões de zoom. */}
      {modoJ105V2 && !v2SemFicha && (
        <div
          className="absolute"
          style={{ left: '0.5rem', right: '0.5rem', bottom: '0.5rem' }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ControlesAnimacaoJ105
            tempoS={tempoAnim}
            tocando={tocando}
            velocidade={velocidadeAnim}
            seguindo={seguindoAnim}
            passo={passoDoRelogio}
            indiceEstagio={estagioAnim.indice}
            emMarcha={emMarchaAnim}
            onTocarPausar={() => {
              // Tocar com o relógio no fim recomeça do zero (mesmo comportamento do protótipo).
              if (!tocando && tempoAnim >= DURACAO_TOTAL_J105) setTempoAnim(0);
              setTocando((v) => !v);
            }}
            onVelocidade={setVelocidadeAnim}
            onSeguir={setSeguindoAnim}
            onSeek={buscarNoTempo}
            onEtapa={irParaEtapa}
          />
        </div>
      )}

      {/* Barra de controles flutuante — seletores (Trem/Bloco/Grupo/Etapa) à esquerda, toggle de
         detalhe + zoom à direita. 2026-08-28, bug reportado pelo usuário: os dois grupos eram
         `position:absolute` independentes, ancorados cada um no seu canto, SEM noção da largura
         um do outro — num painel estreito, os seletores cresciam por cima do toggle/zoom em vez
         de ceder espaço. Virou UM `flex-wrap` só: os seletores (`flex-wrap` próprio, mesmo padrão
         de antes) ficam livres pra quebrar em quantas linhas precisarem, e o grupo
         toggle+zoom (`flexShrink:0`, nunca comprime) só desce pra segunda linha quando não sobra
         espaço nenhum ao lado dos seletores — nunca sobrepõe. `marginLeft:auto` mantém esse grupo
         encostado na direita tanto na 1ª linha quanto numa linha própria. `stopPropagation` migrou
         pra dentro de cada grupo (não no wrapper) — o vão vazio ENTRE os dois grupos, quando
         sobra, continua arrastável (pan do mapa), só os controles em si bloqueiam. */}
      <div
        className="absolute flex flex-wrap items-center"
        style={{ left: '0.5rem', right: '0.5rem', top: '0.5rem', gap: '0.375rem' }}
      >
        {/* Seletores (Trem/Passo/Etapa) + toggle de detalhamento — SÓ pros demais trens. J105
           some com os dois (2026-09-23, pedido explícito do usuário, com print de referência:
           "remova essas informações de J105, passo 2, 1/1 parada e ver detalhes ao aproximar..
           quero só o zoom ali. nos outros trens deixe como estava antes") — a régua veículo a
           veículo do J105 (`ComposicaoJ105Layer`) já mostra visualmente o que mudou passo a
           passo; o seletor de trem some junto porque, sem `MapaNavegacaoPainel` ao lado pra
           preencher a linha, ficaria um controle solto sem função clara nesta view. Zoom
           continua igual pros dois casos — nunca é isto que o pedido quis remover. */}
        {!modoJ105 && (
          <div
            className="flex items-center flex-wrap"
            style={{ gap: '0.375rem', minWidth: 0 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <SeletorTremMapa trem={trenSelecionado} trens={trens} onSelecionar={onSelecionarTrem} />
            <MapaNavegacaoPainel plano={plano} destaque={highlight ?? null} onDestaqueChange={onHighlightChange} />
          </div>
        )}

        {/* `onPointerDown` com `stopPropagation` — sem isso, o clique nestes botões também
           disparava o `handlePointerDown` do container (usado pra arrastar o mapa), que chama
           `setPointerCapture` nele sempre que zoom > 1. Isso redireciona os eventos de ponteiro
           seguintes (incluindo o que gera o `click`) pro container em vez do botão, "engolindo"
           o clique — por isso os botões só funcionavam no primeiro clique (zoom ainda em 1x). */}
        <div
          className="flex items-center"
          style={{ gap: '0.375rem', flexShrink: 0, marginLeft: 'auto' }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {!modoJ105 && <ToggleDetalhamentoAutomatico ativo={detalheAutomatico} onChange={onDetalheAutomaticoChange} compacto={controlesCompactos} />}
          <BotaoZoom onClick={() => aplicarZoom(zoom + ZOOM_STEP)} title="Aumentar zoom">
            <Plus size="0.8125rem" />
          </BotaoZoom>
          <BotaoZoom onClick={() => aplicarZoom(zoom - ZOOM_STEP)} title="Diminuir zoom">
            <Minus size="0.8125rem" />
          </BotaoZoom>
          <BotaoZoom onClick={() => { onZoomChange(ZOOM_MIN); setPan({ x: 0, y: 0 }); }} title="Restaurar zoom">
            <RotateCcw size="0.75rem" />
          </BotaoZoom>
        </div>
      </div>
    </div>
  );
}

/**
 * `highlight` é aceito e encaminhado ao mapa (`ZoomableMapa` → `TrainYardSVG` → `Composition`)
 * — sincronização visual entre o Bloco/Grupo selecionado no Plano e a composição no pátio.
 * O título ("Visão Topológica Atual") vive no header do painel que envolve este card — aqui é
 * só o mapa (zoom/pan) com a legenda (`LegendChips`) embaixo do canvas, fora dele.
 */
function TopologicalPanel({
  trenSelecionado,
  trens,
  onSelecionarTrem,
  fichaAprovada,
  statusFichaPorTremTodos,
  highlight,
  onHighlightChange,
  style,
  legendFilter,
  onLegendFilterChange,
  restricoesAbertas,
  zoom,
  onZoomChange,
  detalheAutomatico,
  onDetalheAutomaticoChange,
  veiculosFoco,
}: {
  trenSelecionado: string;
  /** Repassado direto a `ZoomableMapa` — opções/handler do `SeletorTremMapa` flutuante. */
  trens: string[];
  onSelecionarTrem: (trem: string) => void;
  /** Repassado direto a `ZoomableMapa` — ver doc lá (sem ficha aprovada, sem composição no
   *  pátio). */
  fichaAprovada: boolean;
  /** Repassado direto a `ZoomableMapa` — ver doc lá (filtra trens "de fundo" sem ficha aprovada). */
  statusFichaPorTremTodos: Record<string, { pendente: boolean; fichaId: string }>;
  highlight?: CompositionHighlight | null;
  /** Repassado direto a `ZoomableMapa` — ver doc em `veiculosFoco`, `PlanejamentoScreen`
   *  (componente de topo). */
  veiculosFoco?: Set<string> | null;
  /** Setter do MESMO estado de `highlight` — repassado a `ZoomableMapa`, que o encaminha pro
   *  `MapaNavegacaoPainel` flutuante (controle de navegação Bloco/Grupo/Etapa embutido no canvas,
   *  ao lado do `SeletorTremMapa`, 2026-08-26: "reaproveite o mesmo estado... não crie um sistema
   *  de estado paralelo"). Selecionar por ele chama o MESMO `onDestaqueChange` que `PlanManobraX`
   *  já usa — sincronização nos dois sentidos "de graça", já que os dois painéis só leem/escrevem
   *  o mesmo estado no ancestral comum (`PlanejamentoScreen`). */
  onHighlightChange: (next: CompositionHighlight | null) => void;
  style?: React.CSSProperties;
  legendFilter: LegendFilterState;
  onLegendFilterChange: (next: LegendFilterState) => void;
  restricoesAbertas: boolean;
  zoom: number;
  onZoomChange: (next: number) => void;
  detalheAutomatico: boolean;
  onDetalheAutomaticoChange: (next: boolean) => void;
}) {
  // Desligado ("Ver detalhes ao aproximar" off, ver `ToggleDetalhamentoAutomatico`): todo item
  // ativo na legenda desenha em qualquer zoom — mesma regra usada dentro de `ZoomableMapa` pro
  // `TrainYardSVG`, aqui só pra `LegendChips` saber se ainda faz sentido avisar (ícone de lupa)
  // que um marcador de detalhe está "esperando" mais zoom.
  const detalheVisivel = !detalheAutomatico || zoom >= ZOOM_SEMANTICO_LIMIAR;
  // Resolvido aqui (não dentro de `ZoomableMapa`) pra ficar num único lugar comum a quem mais
  // precisar do plano do trem selecionado neste painel. Mesmo fallback usado em
  // `PlanManobraX.tsx` (trens fora do mock narrativo caem num plano simples neutro, não no plano
  // de outro trem).
  const plano = useMemo(() => {
    const os = fichasMock.find((f) => f.trem === trenSelecionado)?.os ?? '—';
    return planosManobraMock[trenSelecionado] ?? planoFallback(trenSelecionado, os);
  }, [trenSelecionado]);
  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: PANEL_BG,
        borderRadius: RADIUS,
        overflow: 'hidden',
        boxShadow: 'var(--vli-shadow)',
        padding: '1rem',
        gap: '0.625rem',
        ...style,
      }}
    >
      <div style={{ flex: 1, minHeight: MAP_MIN_HEIGHT }}>
        <ZoomableMapa
          trenSelecionado={trenSelecionado}
          trens={trens}
          onSelecionarTrem={onSelecionarTrem}
          plano={plano}
          fichaAprovada={fichaAprovada}
          statusFichaPorTremTodos={statusFichaPorTremTodos}
          highlight={highlight}
          onHighlightChange={onHighlightChange}
          legendFilter={legendFilter}
          zoom={zoom}
          onZoomChange={onZoomChange}
          detalheAutomatico={detalheAutomatico}
          onDetalheAutomaticoChange={onDetalheAutomaticoChange}
          veiculosFoco={veiculosFoco}
        />
      </div>
      {/* J105 V2: legenda própria, só de referência (sem toggles), com os elementos que o mapa
          animado dele de fato desenha — ver `LegendaJ105V2.tsx`. Demais trens seguem na legenda
          interativa de sempre. */}
      {trenSelecionado === TREM_J105_V2 ? (
        <LegendaJ105V2 />
      ) : (
        <LegendChips
          filter={legendFilter}
          onChange={onLegendFilterChange}
          restricoesAbertas={restricoesAbertas}
          detalheVisivel={detalheVisivel}
          zoomThresholdLabel={`${Math.round(ZOOM_SEMANTICO_LIMIAR * 100)}%`}
          presence={EHT_LEGEND_PRESENCE}
        />
      )}
    </div>
  );
}


/**
 * Cabeçalho compartilhado pelos dois painéis principais (Planejamento do dia / Mapa) — só o
 * título. Sem X (a única forma de alternar entre os painéis é o `LayoutSegmentedControl` do
 * header superior — dois controles pra fazer a mesma coisa gerava risco de dessincronia) e sem
 * subtítulo de pátio (já fica evidente no header superior, junto com a data — repetir aqui era
 * redundante). Fina camada sobre `PainelCardHeader` (`PageHeader.tsx`, compartilhado com a Ficha
 * Operacional) só pra aceitar um título simples em vez de `children` livre — os dois painéis
 * daqui só precisam disso.
 */
function CabecalhoPainel({ titulo }: { titulo: string }) {
  return (
    <PainelCardHeader>
      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: TEXT_HI, fontFamily: FONT, whiteSpace: 'nowrap' }}>{titulo}</span>
    </PainelCardHeader>
  );
}

/**
 * Painel do Mapa — mesmo conteúdo que antes vivia no modal (visão topológica + restrições),
 * agora um painel fixo à direita que desliza e "empurra" o conteúdo principal (barra de trens,
 * Grupo, Antes/Depois, Sequência de Manobra). Sempre lado a lado com o conteúdo principal —
 * nunca overlay. Com os dois toggles do header ativos, metade/metade da linha (`flex: 1` nos
 * dois lados); com `fullWidth` (toggle "Planejamento do dia" desligado), ocupa a linha inteira
 * mas centra o conteúdo numa largura máxima confortável (mesmo padrão do antigo modo
 * fullscreen) em vez de esticar o mapa borda a borda. O mapa ocupa visivelmente mais altura
 * que as Restrições (informação principal vs. complementar) — os dois ficam colados (sem gap,
 * sem cantos/sombra na junção), como um único bloco com uma linha divisória.
 */
function MapaSidePanel({
  isOpen,
  fullWidth,
  widthPercent,
  transicionar,
  trenSelecionado,
  trens,
  onSelecionarTrem,
  fichaAprovada,
  statusFichaPorTremTodos,
  highlight,
  onHighlightChange,
  veiculosFoco,
}: {
  isOpen: boolean;
  fullWidth: boolean;
  /** Largura do painel em % da linha dos dois painéis — substitui o antigo `flex: 1 1 0%` fixo
   *  (metade/metade) pra permitir a proporção livre da divisória arrastável (`PainelResizer`,
   *  `PlanejamentoScreen`). `isOpen`/`fullWidth` continuam controlando fade de conteúdo/borda,
   *  independentes deste valor (podem valer 0%/100% sem depender de `isOpen`, ver chamador). */
  widthPercent: number;
  /** `false` durante o arrasto da divisória — desliga a transição de `flex` pra acompanhar o
   *  mouse sem lag/animação atrasada (mesmo motivo de `arrastando` em `ZoomableMapa`). */
  transicionar: boolean;
  /** Trem ativo na barra de seleção do Plano de Manobra — repassado até `ZoomableMapa`, que
   *  sintetiza e desenha a composição desse trem específico (ver `planoTopologiaAdapter.ts`). */
  trenSelecionado: string;
  /** Repassado direto a `TopologicalPanel`/`ZoomableMapa` — opções/handler do `SeletorTremMapa`
   *  flutuante (canto superior esquerdo do mapa, ver `ZoomableMapa`). */
  trens: string[];
  onSelecionarTrem: (trem: string) => void;
  /** Repassado direto a `TopologicalPanel`/`ZoomableMapa` — ver doc lá (sem ficha aprovada, sem
   *  composição no pátio). */
  fichaAprovada: boolean;
  /** Repassado direto a `TopologicalPanel`/`ZoomableMapa` — filtra trens "de fundo" sem ficha
   *  aprovada (ver `filterUnapprovedBackgroundTrains`). */
  statusFichaPorTremTodos: Record<string, { pendente: boolean; fichaId: string }>;
  /** Bloco/Grupo ativo no Plano de Manobra (painel esquerdo) — repassado até `Composition` via
   *  `TopologicalPanel`/`ZoomableMapa`/`TrainYardSVG`. */
  highlight?: CompositionHighlight | null;
  /** Setter do MESMO estado de `highlight` — repassado a `TopologicalPanel`/`MapaNavegacaoPainel`
   *  (controle de navegação Bloco/Grupo/Etapa embutido no painel do mapa, 2026-08-26). */
  onHighlightChange: (next: CompositionHighlight | null) => void;
  /** Repassado direto a `TopologicalPanel`/`ZoomableMapa` — ver doc em `veiculosFoco`,
   *  `PlanejamentoScreen` (componente de topo). */
  veiculosFoco?: Set<string> | null;
}) {
  // "Essencial" é o preset padrão ao abrir o mapa (decisão de produto pra já iniciar numa visão
  // limpa, ver `createEssentialLegendFilter`) — o operador troca pra "Completo" ou liga itens
  // individuais a qualquer momento em `LegendChips`.
  const [legendFilter, setLegendFilter] = useState<LegendFilterState>(() => createEssentialLegendFilter());
  // Compartilhado entre Legenda e Restrições Ativas — a Legenda só precisa limitar a própria
  // altura (e rolar por dentro) quando Restrições também está aberta, ver `LegendChips.tsx`.
  const [restricoesAbertas, setRestricoesAbertas] = useState(false);
  // Zoom vive aqui (não dentro de `ZoomableMapa`) porque a Legenda — irmã do mapa, fora do
  // canvas — também precisa dele: um marcador de detalhe fino ativo na legenda só aparece acima
  // de `ZOOM_SEMANTICO_LIMIAR`, e o chip avisa isso enquanto o zoom não chegou lá (ver
  // `LegendChips.tsx`). `pan` continua de estado local dentro de `ZoomableMapa` — ninguém fora
  // do canvas precisa saber a posição de arrasto.
  const [zoom, setZoom] = useState(ZOOM_MIN);
  // Toggle "Ver detalhes ao aproximar" (zoom semântico) — mora no mesmo nível de `zoom`/
  // `legendFilter` pela mesma razão: `MapaSidePanel` nunca desmonta ao trocar de layout
  // (`LayoutSegmentedControl` só redimensiona via `flex`/opacidade, não remonta), então o estado
  // sobrevive sozinho a qualquer troca entre painel dividido e "só mapa" (fullWidth) sem precisar
  // de nenhuma persistência extra. Ligado por padrão (mesmo comportamento já existente).
  const [detalheAutomatico, setDetalheAutomatico] = useState(true);

  return (
    <>
      <div
        className="shrink-0 no-print relative"
        style={{
          flex: `0 0 ${widthPercent}%`,
          minWidth: 0,
          overflow: 'hidden',
          transition: transicionar ? PANEL_TRANSITION : 'none',
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderLeft: isOpen && !fullWidth ? `1px solid ${BORDER}` : 'none',
            backgroundColor: BG_DEEP,
            overflow: 'hidden',
            transition: 'border-color 0.25s ease',
          }}
        >
          <div className="flex flex-col h-full" style={{ width: '100%', opacity: isOpen ? 1 : 0, transition: PANEL_CONTENT_FADE }}>
            <PainelCard>
              <CabecalhoPainel titulo="Visão Topológica Atual" />
              <div
                className="flex flex-col"
                style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
              >
                {/* Sempre ocupa a largura inteira do painel (sozinho ou dividido) — sem
                   `maxWidth`/centralização, mesmo princípio do painel de Planejamento acima. Sem
                   padding próprio (2026-08-28, pedido explícito do usuário: "os dividers podem ir
                   até o final... diminua o padding pra ganhar espaço") — Mapa/Restrições agora
                   preenchem o `PainelCard` até a borda dele, sem gutter próprio duplicado por
                   cima da margem que o card já tem. */}
                <div
                  className="flex flex-col"
                  style={{ width: '100%', height: '100%', minHeight: 0, gap: 0 }}
                >
                  {/* Mapa com `flex: 1` (não uma fração fixa como "2.1") e Restrições com
                     `flex: '0 0 auto'` (não "1.2") — Restrições agora só ocupa a altura do seu
                     próprio conteúdo (1 linha quando colapsada, a lista inteira quando expandida,
                     ver `RestrictionsPanel.tsx`), e o mapa absorve automaticamente o espaço que
                     sobra, sem precisar saber se Restrições está aberta ou fechada. */}
                  <TopologicalPanel
                  style={{
                    flex: 1,
                    minHeight: 0,
                    // Cantos e sombra próprios zerados nos 4 — 2026-08-28: Mapa+Restrições agora
                    // vivem colados na borda do `PainelCard` (ver acima), então essa dupla deixou
                    // de ser um "card dentro do card" com sua própria moldura arredondada/elevada;
                    // só o `PainelCard` por fora arredonda/eleva agora.
                    borderRadius: 0,
                    boxShadow: 'none',
                    // Zera só o padding de BAIXO (o `padding: '1rem'` de todos os lados continua
                    // valendo pros outros 3, é só um overwrite pontual do longhand por cima do
                    // shorthand, ver `TopologicalPanel`) — 2026-08-27, pedido explícito do usuário:
                    // "pode deixar ele mais colado com restrições ativas também, não precisa do
                    // espaçamento entre eles. o divider é suficiente" (a borda de cima de
                    // `RestrictionsPanel`, logo abaixo). Só faz sentido aqui, nesta composição
                    // específica (`TopologicalPanel` sempre com `RestrictionsPanel` colado embaixo
                    // — única chamada do componente, ver acima) — não no padding padrão do
                    // componente, que outros usos futuros ainda podem querer inteiro.
                    paddingBottom: 0,
                  }}
                  trenSelecionado={trenSelecionado}
                  trens={trens}
                  onSelecionarTrem={onSelecionarTrem}
                  fichaAprovada={fichaAprovada}
                  statusFichaPorTremTodos={statusFichaPorTremTodos}
                  highlight={highlight}
                  onHighlightChange={onHighlightChange}
                  legendFilter={legendFilter}
                  onLegendFilterChange={setLegendFilter}
                  restricoesAbertas={restricoesAbertas}
                  zoom={zoom}
                  onZoomChange={setZoom}
                  detalheAutomatico={detalheAutomatico}
                  onDetalheAutomaticoChange={setDetalheAutomatico}
                  veiculosFoco={veiculosFoco}
                />
                <RestrictionsPanel
                  style={{
                    flex: '0 0 auto',
                    borderRadius: 0,
                    borderTop: `1px solid ${BORDER}`,
                    boxShadow: 'none',
                  }}
                  expandido={restricoesAbertas}
                  onExpandidoChange={setRestricoesAbertas}
                  restricoes={trenSelecionado === TREM_J105_V2 ? RESTRICOES_J105_V2 : undefined}
                />
              </div>
            </div>
            </PainelCard>
          </div>
        </div>
      </div>
    </>
  );
}

interface PlanejamentoScreenProps {
  onAjustarParametros: () => void;
  onConfirmar: (trem: string) => void;
  /** Status de ficha de todos os trens de hoje (não só os do pátio ativo) — é o que a barra de
   *  seleção de trem do Plano de Manobra usa. */
  statusFichaPorTremTodos: Record<string, { pendente: boolean; fichaId: string }>;
  onRevisarFicha: (trem: string) => void;
}

export function PlanejamentoScreen({ onAjustarParametros, onConfirmar, statusFichaPorTremTodos, onRevisarFicha }: PlanejamentoScreenProps) {
  // Datas disponíveis pro seletor do header — mesma fonte da Ficha de Operação, mais recente
  // primeiro (HOJE sempre aparece porque é a data de todo turno em andamento no mock).
  const datasDisponiveis = Array.from(new Set(fichasMock.map((f) => f.data))).sort((a, b) => (a < b ? 1 : -1));
  const [dataSelecionada, setDataSelecionada] = useState<string>(HOJE);
  const trensDoDia = fichasMock.filter((f) => f.data === dataSelecionada);
  const [trenSelecionado, setTrenSelecionado] = useState<string>(trensDoDia.find((f) => !tremDesabilitado(f.trem))?.trem ?? trensDoDia[0]?.trem ?? 'J614');
  // Confirmar Plano/Imprimir são ações do trem selecionado (vivem no header do trem, dentro de
  // `PlanManobraX`) — a confirmação também é por trem, não por turno/data inteiro.
  const fichaSelecionada = trensDoDia.find((f) => f.trem === trenSelecionado);
  // Mesma regra usada dentro de `PlanManobraX` (`pendente`) — sem ficha aprovada não existe
  // Plano de Manobra de verdade ainda, então o mapa (`MapaSidePanel`) também não deve mostrar
  // nenhum trem no pátio (ver `ZoomableMapa`).
  const fichaAprovada = !statusFichaPorTremTodos[trenSelecionado]?.pendente;

  // Bloco/Grupo selecionado no Plano de Manobra (`PlanManobraX`) — vive aqui, no ancestral
  // comum aos dois painéis, para sincronizar o destaque/esmaecimento da composição na Visão
  // Topológica (`MapaSidePanel`) sem os painéis se conhecerem diretamente. `null` = nenhuma
  // seleção (mapa em opacidade normal).
  const [destaquePlano, setDestaquePlano] = useState<CompositionHighlight | null>(null);

  // Veículo(s) (vagão/locomotiva) especificamente focados — 2026-08-27, pedido explícito do
  // usuário: "se eu clicar em algum vagão, ou locomotiva, ele deve ancorar no mapa mostrando esse
  // vagão específico" (clique num chip de `TagVagao`, "Composição Geral do Trem — Antes/Depois",
  // `PlanManobraX.tsx`), refinado em seguida: "ao clicar, ele deve se manter selecionado, podendo
  // clicar novamente pra deselecionar... eu posso ir selecionando mais de um [vagão]... os outros
  // devem estar mais apagados, e o que cliquei fica em evidência" — multi-seleção com toggle (não
  // mais um pulo de câmera avulso), e some da seleção do próprio painel (não vem de `destaquePlano`
  // — Bloco/Grupo é um filtro persistente do Plano, isso é uma seleção pontual de veículo(s), não
  // aparece em nenhum dropdown do mapa). `alternarFocoVeiculo` faz toggle: chamar com um id já
  // presente remove; com um id ausente adiciona. Só "Antes" da Composição Geral é clicável (ver
  // `onFocarVeiculo` em `LinhaBlocoComposicao`, `PlanManobraX.tsx` — "Depois" não é selecionável).
  const [veiculosFoco, setVeiculosFoco] = useState<Set<string>>(() => new Set());
  const alternarFocoVeiculo = useCallback((id: string) => {
    setVeiculosFoco((atual) => {
      const next = new Set(atual);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  // Botão "Limpar seleção" que aparece na Composição Geral do Trem assim que `veiculosFoco` tem
  // algo dentro (`ComposicaoGeralSecao`, `PlanManobraX.tsx`) — 2026-08-28, pedido explícito do
  // usuário: "sempre que eu começar a selecionar os vagões ou locomotivas, deve depois aparecer
  // um botão de resetar... pra limpar tudo e voltar ao normal".
  const limparFocoVeiculos = useCallback(() => {
    setVeiculosFoco(new Set());
  }, []);

  const [patioSelecionado, setPatioSelecionado] = useState<string>(PATIO_ATIVO.nome);
  // Layout dos dois painéis — seleção única em 3 opções (`LayoutSegmentedControl`), sempre
  // exatamente uma ativa. `planoAtivo`/`mapaAtivo` seguem existindo como valores derivados só
  // pra não precisar reescrever toda a lógica de largura/fade que já usa esses dois booleanos.
  const [layoutModo, setLayoutModo] = useState<LayoutModo>('dividido');
  const planoAtivo = layoutModo !== 'direita';
  const mapaAtivo = layoutModo !== 'esquerda';

  // Proporção livre da divisória arrastável (`PainelResizer`) — só importa/persiste enquanto
  // `layoutModo === 'dividido'` (nos outros dois modos a largura de cada painel já é 100%/0% fixo,
  // ver `planoWidthPercent` abaixo); guardar aqui mesmo assim faz o arrasto "lembrar" a última
  // proporção usada quando o usuário volta pro modo dividido por um dos botões do header.
  const [splitRatio, setSplitRatio] = useState(50);
  // `true` só durante o arrasto ativo da divisória — desliga a transição de `flex` dos dois
  // painéis pra acompanhar o mouse sem lag (mesmo padrão de `arrastando` em `ZoomableMapa`).
  const [resizingPainel, setResizingPainel] = useState(false);
  const painelsRowRef = useRef<HTMLDivElement>(null);

  // Larguras efetivas dos dois painéis, em %, sempre somando 100 — os 3 modos de
  // `LayoutSegmentedControl` são só os 2 casos extremos (0/100, 100/0) desta mesma escala; o modo
  // "dividido" usa a proporção livre de `splitRatio`. Unificar os 3 modos numa única escala
  // contínua é o que permite a MESMA divisória (`PainelResizer`) e o MESMO handler de arrasto
  // cobrirem tanto o redimensionamento livre quanto o "puxar de volta" a partir de um painel
  // fechado (ver `handleResizerPointerMove`).
  const planoWidthPercent = layoutModo === 'esquerda' ? 100 : layoutModo === 'direita' ? 0 : splitRatio;
  const mapaWidthPercent = 100 - planoWidthPercent;

  function handleResizerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    setResizingPainel(true);
  }

  // Arrasto rastreado em `window` (não só no próprio elemento de 10px da divisória) — ela é fina
  // demais pra `setPointerCapture` sozinho garantir que TODO movimento rápido do mouse continue
  // "pertencendo" a ela: um arrasto veloz pode, entre dois frames, já ter saído da faixa de 10px
  // antes do browser processar a captura, perdendo o resto do gesto. Ouvir em `window` enquanto
  // `resizingPainel` for `true` (efeito abaixo) garante que TODO `pointermove`/`pointerup` do
  // gesto chega aqui, esteja o cursor sobre a divisória ou não.
  useEffect(() => {
    if (!resizingPainel) return;

    function handleMove(e: PointerEvent) {
      const rect = painelsRowRef.current?.getBoundingClientRect();
      if (!rect || !rect.width) return;
      const percent = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
      // Limiar de snap: o mais restritivo entre o piso percentual e o piso em px (ver
      // `SPLIT_SNAP_MIN_PERCENT`/`SPLIT_SNAP_MIN_PX`) — abaixo dele o painel encolhendo já
      // quebraria visualmente, então em vez de deixar chegar lá, já muda pro modo "só o painel
      // oposto" (mesmo estado que os botões do header controlam, ver `LayoutSegmentedControl`).
      const limiar = Math.max(SPLIT_SNAP_MIN_PERCENT, (SPLIT_SNAP_MIN_PX / rect.width) * 100);
      if (percent < limiar) {
        setLayoutModo('direita');
        setSplitRatio(limiar);
      } else if (percent > 100 - limiar) {
        setLayoutModo('esquerda');
        setSplitRatio(100 - limiar);
      } else {
        setLayoutModo('dividido');
        setSplitRatio(percent);
      }
    }

    function handleUp() {
      setResizingPainel(false);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [resizingPainel]);

  // Sempre troca a seleção, aprovado ou não — clicar num trem sem ficha aprovada não navega
  // direto para a Ficha de Operação, só mostra a tela "Aguardando confirmação..." dentro do
  // próprio Plano de Manobra; é o botão "Revisar Ficha" ali dentro que leva para lá.
  // J105-V2: abre o PDF exato que o usuário salvou (pedido explícito, 2026-09-29), em vez do
  // window.print() do próprio plano — os demais trens continuam imprimindo a tela normalmente
  // (não têm um PDF pronto equivalente).
  function imprimirPlano() {
    if (trenSelecionado === 'J105-V2') {
      window.open(`${import.meta.env.BASE_URL}plano-manobra-j105-v4.pdf`, '_blank');
      return;
    }
    imprimirComPagina('portrait', 15);
  }

  function selecionarTrem(trem: string) {
    setTrenSelecionado(trem);
    // O destaque é do plano do trem anterior — trocar de trem sem limpar deixaria o mapa
    // "destacando" um Bloco/Grupo que nem existe no plano recém-selecionado. Mesma razão pros
    // veículos focados — ids de outro trem, sem sentido continuar "selecionados" aqui.
    setDestaquePlano(null);
    setVeiculosFoco(new Set());
  }

  // Trocar de data reseta o trem selecionado pro primeiro da nova data — o antigo pode nem
  // existir nela (trens variam por turno/dia no mock).
  function selecionarData(data: string) {
    setDataSelecionada(data);
    setDestaquePlano(null);
    setVeiculosFoco(new Set());
    const primeiro = fichasMock.find((f) => f.data === data && !tremDesabilitado(f.trem));
    setTrenSelecionado(primeiro?.trem ?? '');
  }

  const [modalConfirmarAberto, setModalConfirmarAberto] = useState(false);
  // Confirmação é por trem — chave combina data+trem pra não colidir caso o mesmo código de
  // trem apareça em datas diferentes no mock; confirmar o R045 não deve marcar os outros trens
  // do mesmo turno como confirmados também.
  const [planosConfirmados, setPlanosConfirmados] = useState<Set<string>>(new Set());
  const chaveConfirmacao = (trem: string) => `${dataSelecionada}::${trem}`;
  const planoConfirmado = planosConfirmados.has(chaveConfirmacao(trenSelecionado));

  // Clicar de novo com o plano já confirmado desconfirma (toggle) — sem modal, é só reverter o
  // estado do botão; o modal de sucesso só faz sentido na transição pra confirmado.
  function handleConfirmarPlano() {
    const chave = chaveConfirmacao(trenSelecionado);
    if (planoConfirmado) {
      setPlanosConfirmados((prev) => {
        const next = new Set(prev);
        next.delete(chave);
        return next;
      });
      return;
    }
    onConfirmar(trenSelecionado);
    setPlanosConfirmados((prev) => new Set(prev).add(chave));
    setModalConfirmarAberto(true);
  }

  return (
    <>
      <div
        className="flex flex-col"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* "Confirmar Plano"/"Imprimir" saíram daqui — agora vivem no header do trem/OS (dentro
            de `PlanManobraX`), ao lado de "Ver Ficha". `handleConfirmarPlano`/`planoConfirmado`
            continuam sendo passados pra lá como props; a lógica não mudou, só o lugar na tela. */}
        <PageHeader
          acoes={
            <>
              <LayoutSegmentedControl valor={layoutModo} onChange={setLayoutModo} />
            </>
          }
        >
          {/* 2026-08-28, pedido explícito do usuário: "o botão de mudar só planos de manobra,
             visão lado a lado e visão topológica atual, deve ir pro canto direito da tela...
             ao invés de estar grudados" com pátio/data — migrou pra `acoes` (PageHeader já
             posiciona essa área na ponta direita, `justify-content: space-between`), em vez de
             ficar aqui do lado esquerdo colado no bloco de contexto. */}
          <div className="flex items-baseline" style={{ gap: '0.625rem', minWidth: 0 }}>
            <HeaderTitulo>Planejamento</HeaderTitulo>
            <HeaderDivider />
            <PatioHeaderDropdown value={patioSelecionado} onChange={setPatioSelecionado} />
            <HeaderDivider />
            <DataHeaderDropdown value={dataSelecionada} onChange={selecionarData} datasDisponiveis={datasDisponiveis} />
          </div>
        </PageHeader>

        <div
          ref={painelsRowRef}
          className="flex"
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            // Sem isso, arrastar a divisória sobre texto (títulos, chips) também SELECIONA esse
            // texto — o navegador não distingue "arrastando a divisória" de "arrastando pra
            // selecionar" só pelo elemento onde o gesto começou.
            userSelect: resizingPainel ? 'none' : undefined,
          }}
        >
          <div
            className="flex flex-col shrink-0"
            style={{
              flex: `0 0 ${planoWidthPercent}%`,
              minWidth: 0,
              overflow: 'hidden',
              transition: resizingPainel ? 'none' : PANEL_TRANSITION,
            }}
          >
            <div className="flex flex-col h-full" style={{ width: '100%', opacity: planoAtivo ? 1 : 0, transition: PANEL_CONTENT_FADE }}>
              <PainelCard>
                <CabecalhoPainel titulo="Planos de Manobra" />
                {/* Sozinho na tela (mapa desligado) ou dividido, sempre ocupa a largura inteira do
                   painel — sem `maxWidth`/centralização: espaço vazio nas laterais em telas largas
                   não é aceitável, o conteúdo tem que preencher até a borda. Sem padding próprio
                   (2026-08-28, pedido explícito do usuário: "os dividers podem ir até o final...
                   diminua o padding pra ganhar espaço") — `PlanManobraX` preenche o `PainelCard`
                   até a borda dele (a divisória da lista de trens, por exemplo, precisa alcançar
                   a borda física do card, não parar num gutter interno). */}
                <div
                  className="flex flex-col"
                  style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
                >
                  <div
                    className="flex flex-col"
                    style={{ width: '100%', height: '100%', minHeight: 0 }}
                  >
                    <PlanManobraX
                      trenSelecionado={trenSelecionado}
                      onSelecionarTrem={selecionarTrem}
                      dataSelecionada={dataSelecionada}
                      statusFichaPorTrem={statusFichaPorTremTodos}
                      onRevisarFicha={onRevisarFicha}
                      onAjustarParametros={onAjustarParametros}
                      onImprimirPlano={imprimirPlano}
                      onConfirmarPlano={handleConfirmarPlano}
                      planoConfirmado={planoConfirmado}
                      destaque={destaquePlano}
                      onDestaqueChange={setDestaquePlano}
                      veiculosFoco={veiculosFoco}
                      onFocarVeiculo={alternarFocoVeiculo}
                      onLimparFocoVeiculos={limparFocoVeiculos}
                    />
                  </div>
                </div>
              </PainelCard>
            </div>
          </div>

          <MapaSidePanel
            isOpen={mapaAtivo}
            fullWidth={!planoAtivo}
            widthPercent={mapaWidthPercent}
            transicionar={!resizingPainel}
            trenSelecionado={trenSelecionado}
            trens={trensDoDia.map((f) => f.trem)}
            onSelecionarTrem={selecionarTrem}
            fichaAprovada={fichaAprovada}
            statusFichaPorTremTodos={statusFichaPorTremTodos}
            highlight={destaquePlano}
            onHighlightChange={setDestaquePlano}
            veiculosFoco={veiculosFoco}
          />

          <PainelResizer
            leftPercent={planoWidthPercent}
            arrastando={resizingPainel}
            onPointerDown={handleResizerPointerDown}
          />
        </div>
      </div>

      <ConfirmarPlanoModal
        isOpen={modalConfirmarAberto}
        ficha={fichaSelecionada}
        onClose={() => setModalConfirmarAberto(false)}
        onImprimir={imprimirPlano}
      />
    </>
  );
}
