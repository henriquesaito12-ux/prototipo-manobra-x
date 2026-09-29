import * as SelectPrimitive from '@radix-ui/react-select';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronDown, type LucideIcon } from 'lucide-react';
import { HOJE } from '../data/fichaOperacao';
import { NOMES_PATIOS } from '../data/patio';

// Header compartilhado pelas telas de nível de página (Ficha Operacional, Planejamento, e
// futuras telas com o mesmo padrão, ex. Execução Ao Vivo) — antes cada tela reimplementava o
// próprio header do zero, e o estilo foi divergindo aos poucos (tamanho de fonte do título,
// cor dos dropdowns, altura dos divisores, altura dos botões de ação) sem que ninguém tivesse
// decidido isso de propósito. Este arquivo é a ÚNICA fonte da aparência dessas peças; qualquer
// ajuste visual futuro (cor, tamanho, espaçamento) muda aqui e reflete em todas as telas.
//
// O que É compartilhado: a "casca" do header (altura/padding/borda/fundo), o wrapper da área
// de ações à direita, e os componentes visuais (título, divisor, dropdown de pátio, dropdown
// de data). O que NÃO é compartilhado — de propósito — é a composição de cada tela (quais
// dropdowns/toggles/botões aparecem, em que ordem, com que conteúdo funcional): cada tela
// continua montando o próprio lado esquerdo (`children` do `PageHeader`) e a própria área de
// ações (`acoes`), só que a partir das mesmas peças visuais.

const PANEL_BG   = 'var(--vli-panel-bg)';
const BORDER     = 'var(--vli-border)';
const TEXT_HI    = 'var(--vli-text-hi)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
const HOVER_TINT = 'var(--vli-hover-tint)';
const HEADER_BG  = 'var(--vli-sidebar-bg)';
const FONT       = 'Manrope, sans-serif';
const RADIUS     = '0.375rem';

export const PAGE_HEADER_HEIGHT = '3rem';

export function formatarData(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Converte AAAA-MM-DD (formato usado nos dados) para Date local — evita o "dia errado" que
 *  `new Date(iso)` pode dar (interpreta como UTC meia-noite, desloca em fusos negativos). */
export function isoParaDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dateParaIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Casca do header de página — altura, padding, borda inferior e fundo idênticos em toda tela
 * que o usa. `children` é o lado esquerdo inteiro (cada tela monta a própria composição com
 * `HeaderTitulo`/`HeaderDivider`/os dropdowns/toggles); `acoes` é a área de botões à direita —
 * o wrapper em si (gap, alinhamento, distância da borda) é sempre o mesmo, só o conteúdo muda.
 */
export function PageHeader({ children, acoes }: { children: React.ReactNode; acoes?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between shrink-0 no-print"
      style={{ height: PAGE_HEADER_HEIGHT, padding: '0 1.5rem', borderBottom: `1px solid ${BORDER}`, backgroundColor: HEADER_BG, gap: '1rem' }}
    >
      {children}
      <div className="flex items-center shrink-0" style={{ gap: '0.5rem' }}>
        {acoes}
      </div>
    </div>
  );
}

/** Título da página (ex.: "Ficha Operacional", "Planejamento") — sempre o elemento de maior
 *  destaque do header, mesmo tamanho/peso/cor em toda tela. */
export function HeaderTitulo({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: TEXT_HI, fontSize: '1rem', fontWeight: 700, letterSpacing: '0.01em', fontFamily: FONT, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

/** Divisor vertical fino entre elementos do header (título/pátio/data/...). `tall` é usado só
 *  quando um divisor precisa separar um grupo de metadados de um grupo de ações/toggles bem
 *  mais alto ao lado — continua o mesmo divisor, só mais comprido. */
export function HeaderDivider({ tall = false }: { tall?: boolean }) {
  return <div style={{ width: 1, height: tall ? '1.375rem' : '0.75rem', backgroundColor: BORDER, flexShrink: 0 }} />;
}

/**
 * Tooltip explicativo padrão da plataforma — 2026-08-28, pedido explícito do usuário: "o tooltip
 * que aparece explicando cada coisa deve ser da própria plataforma, no padrão do produto" (era o
 * tooltip nativo do navegador, via `title`, nos botões de layout do header — `LayoutSegmentedControl`,
 * `PlanejamentoScreen.tsx`). MESMOS tokens visuais do outro tooltip customizado que já existe no
 * app (`TooltipHoverTrem`, `PlanejamentoScreen.tsx`: `--vli-surface`/`--vli-border`/`--vli-shadow`,
 * Manrope) — não o componente genérico `ui/tooltip.tsx` (esse usa cores padrão do template
 * shadcn, `bg-primary`, que não são os tokens de cor deste app). Animação de abertura via
 * `tw-animate-css` (já usada no mesmo `ui/tooltip.tsx`) — fade + leve zoom, tanto na abertura
 * quanto no fechamento. `children` precisa ser um único elemento que aceite `ref` (botão/trigger),
 * repassado direto ao `Trigger` via `asChild` — não embrulha em nenhum elemento extra.
 */
export function HeaderTooltip({ label, children }: { label?: string; children: React.ReactElement }) {
  // Sem texto = sem tooltip (vários gatilhos só têm dica em certo estado, ex.: "clicável").
  if (!label) return children;
  // Elemento desabilitado não dispara eventos de ponteiro, então o Radix nunca abriria o tooltip —
  // justo onde ele explica por que está desabilitado. Um <span> em volta recebe o hover no lugar.
  const desabilitado = (children.props as { disabled?: boolean }).disabled === true;
  // `vli-tooltip-desabilitado` (theme.css) faz o filho ocupar a largura toda do <span>: quando o
  // pai estica o <span> (ex.: coluna flex do menu lateral), o botão desabilitado ficava com a
  // largura do próprio conteúdo, grudado à esquerda — ícone desalinhado dos itens vizinhos.
  const gatilho = desabilitado ? <span className="vli-tooltip-desabilitado">{children}</span> : children;
  return (
    <TooltipPrimitive.Provider delayDuration={400}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{gatilho}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={8}
            className="z-50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1"
            style={{
              backgroundColor: 'var(--vli-tooltip-bg)',
              border: '1px solid var(--vli-tooltip-borda)',
              borderRadius: '0.3125rem',
              boxShadow: 'var(--vli-shadow)',
              padding: '0.3125rem 0.5625rem',
              fontSize: '0.6875rem',
              fontFamily: FONT,
              color: 'var(--vli-tooltip-fg)',
              maxWidth: '15rem',
              lineHeight: 1.4,
            }}
          >
            {label}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

/**
 * Moldura de "card fechado" (cabeçalho + conteúdo dentro da MESMA borda) — 2026-08-28, pedido
 * explícito do usuário: "adicione uma borda envolvendo TODO o bloco — título + conteúdo juntos
 * dentro do mesmo container, não só o conteúdo" (painéis "Planos de Manobra"/"Visão Topológica
 * Atual", `PlanejamentoScreen.tsx`), depois estendido pro mesmo padrão na Ficha Operacional
 * ("dá pra manter o mesmo padrão de header... a área do Trem J614/Pátio/OS/data, Editar e
 * deletar"). Vive aqui (não em cada tela) exatamente pra isso: uma tela nova que precise do MESMO
 * card fechado usa esta peça direto, em vez de reimplementar a moldura (e arriscar divergir).
 * `overflow: hidden` corta os cantos de dentro (`PainelCardHeader`/conteúdo) pelos cantos
 * arredondados do card. `className` opcional — a Ficha Operacional precisa de `no-print` aqui
 * (o card inteiro some no modo impressão, que usa uma tabela estática própria), o Planejamento
 * não usa nenhuma classe extra.
 */
export function PainelCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex flex-col${className ? ` ${className}` : ''}`}
      style={{
        flex: 1,
        minHeight: 0,
        margin: '0.75rem',
        border: `1px solid ${BORDER}`,
        borderRadius: RADIUS,
        backgroundColor: PANEL_BG,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

/** Altura fixa do cabeçalho de um `PainelCard` — mesma em toda tela que o usa, pra painéis lado a
 *  lado (ex.: Planejamento) ficarem PIXEL-idênticos mesmo com conteúdos de tamanho diferente. */
export const PANEL_CARD_HEADER_H = '3rem';

/**
 * Cabeçalho de um `PainelCard` — fundo `--vli-panel-header-bg` (tom "levemente elevado" em
 * relação ao corpo do card; branco puro no light, proporcionalmente mais claro no dark — ver
 * `theme.css` — NUNCA o `--vli-active-bg` forte usado pra sinalizar seleção em outros headers,
 * ex. Bloco/Grupo em `PlanManobraX.tsx`) + `borderBottom` dividindo do conteúdo abaixo. `children`
 * livre (não só um título) — a Ficha Operacional usa pra um cabeçalho bem mais rico (ícone +
 * trem + pátio + OS + data à esquerda, "Editar"/excluir à direita), não só texto.
 */
export function PainelCardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{
        height: PANEL_CARD_HEADER_H,
        padding: '0 1rem',
        backgroundColor: 'var(--vli-panel-header-bg)',
        borderBottom: `1px solid ${BORDER}`,
        gap: '0.75rem',
      }}
    >
      {children}
    </div>
  );
}

/** Fundo do cabeçalho de `SecaoCartao` — cinza neutro bem claro, entre `--vli-surface` e o fundo
 *  do painel (≈ #F8FAFC no tema claro), acompanhando o tema escuro. */
const SECAO_CABECALHO_BG = 'color-mix(in srgb, var(--vli-surface) 50%, var(--vli-panel-bg))';

/** Divisor fino entre cabeçalho e corpo de `SecaoCartao`, e entre os grupos internos do corpo —
 *  mesmo tom em toda seção que usa este padrão (borda padrão a 55% de opacidade). */
const SECAO_DIVISOR = 'color-mix(in srgb, var(--vli-border) 55%, transparent)';

/**
 * Seção de conteúdo com cabeçalho CONECTADO ao corpo — validado 2026-09-24 na aba "Visão Geral"
 * do J105 V2 (`PlanManobraX.tsx`, então `SecaoCartaoJ105V2`) e generalizado 2026-09-25 pra
 * qualquer tela: uma caixa só, sem caixas aninhadas dentro — cabeçalho cinza claro (ícone +
 * rótulo em caixa alta, área opcional à direita) e, separado por um divisor fino, o corpo como
 * superfície única — a hierarquia interna do corpo é só tipografia e divisores (mesmo
 * `SECAO_DIVISOR` acima), nunca outro card com fundo/borda próprios.
 */
export function SecaoCartao({ icone: Icone, titulo, direita, children }: { icone?: LucideIcon; titulo: string; direita?: React.ReactNode; children: React.ReactNode }) {
  return (
    // `flexShrink: 0`: em uma coluna flex rolável, com `overflow: hidden` (pro cabeçalho respeitar
    // o raio da borda) a seção passaria a poder encolher abaixo do conteúdo — cortada.
    <section style={{ border: `1px solid ${BORDER}`, borderRadius: RADIUS, backgroundColor: PANEL_BG, overflow: 'hidden', flexShrink: 0 }}>
      <header
        className="flex flex-wrap items-center justify-between"
        style={{ gap: '0.375rem 0.875rem', minHeight: '2.125rem', padding: '0.375rem 0.875rem', backgroundColor: SECAO_CABECALHO_BG, borderBottom: `1px solid ${SECAO_DIVISOR}` }}
      >
        <span className="flex items-center" style={{ gap: '0.3125rem', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: TEXT_LO, fontFamily: FONT, whiteSpace: 'nowrap' }}>
          {Icone && <Icone size="0.75rem" strokeWidth={2} />}
          {titulo}
        </span>
        {direita}
      </header>
      <div style={{ padding: '0 0.875rem' }}>{children}</div>
    </section>
  );
}

const SELECT_ITEM_STYLE: React.CSSProperties = {
  padding: '0.5rem 0.875rem',
  borderRadius: '0.25rem',
  fontSize: '0.75rem',
  color: TEXT_HI,
  cursor: 'pointer',
  outline: 'none',
  whiteSpace: 'nowrap',
};

function onItemHover(e: React.PointerEvent<HTMLDivElement>) {
  e.currentTarget.style.backgroundColor = HOVER_TINT;
}
function onItemLeave(e: React.PointerEvent<HTMLDivElement>) {
  e.currentTarget.style.backgroundColor = 'transparent';
}

interface PatioHeaderDropdownProps {
  value: string;
  onChange: (v: string) => void;
  /** Itens extras no topo da lista, antes dos pátios normais — ex.: "Todos os pátios" na Ficha
   *  Operacional (onde o pátio filtra de verdade a listagem). Ausente em telas que não
   *  precisam dessa opção (ex.: Planejamento, onde o pátio é só contexto). */
  opcoesExtras?: { value: string; label: string }[];
  /** Como exibir o valor selecionado no trigger — por padrão "Pátio {value}". */
  formatarRotulo?: (value: string) => string;
}

/** Dropdown de pátio no header — texto + chevron, sem caixa/borda (só um leve destaque de fundo
 *  no hover/aberto, ver `aberto` abaixo). Mesmo estilo em toda tela; o que muda por tela é só a
 *  lista de opções (`opcoesExtras`) e o rótulo exibido.
 *  2026-08-28, pedido explícito do usuário: "deixe um hover em pátio... e uma pequena
 *  animação/transição ao abrir o dropdown, e a setinha pra baixo deve ir pra cima" — `aberto`
 *  (controlado, não deixado só pro Radix) é o que permite girar a seta E tingir o fundo enquanto
 *  o dropdown está aberto (não só no hover do mouse); a transição de abertura do painel em si vem
 *  das classes `data-[state=...]` do Content (`tw-animate-css`, mesmo padrão do `HeaderTooltip`
 *  acima). */
export function PatioHeaderDropdown({ value, onChange, opcoesExtras = [], formatarRotulo }: PatioHeaderDropdownProps) {
  const [aberto, setAberto] = useState(false);
  const rotulo = formatarRotulo ? formatarRotulo(value) : `Pátio ${value}`;
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange} open={aberto} onOpenChange={setAberto}>
      <SelectPrimitive.Trigger
        aria-label="Selecionar pátio"
        className="flex items-center"
        style={{
          gap: '0.25rem',
          border: 'none',
          background: aberto ? HOVER_TINT : 'transparent',
          cursor: 'pointer',
          padding: '0.25rem 0.375rem',
          margin: '-0.25rem -0.375rem',
          borderRadius: '0.25rem',
          outline: 'none',
          transition: 'background-color 0.15s',
        }}
        onPointerEnter={(e) => { if (!aberto) e.currentTarget.style.backgroundColor = HOVER_TINT; }}
        onPointerLeave={(e) => { if (!aberto) e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <span style={{ color: TEXT_MD, fontSize: '0.75rem', fontFamily: FONT, fontWeight: 500, whiteSpace: 'nowrap' }}>
          {rotulo}
        </span>
        <SelectPrimitive.Icon style={{ display: 'flex', flexShrink: 0 }}>
          <ChevronDown
            size="0.75rem"
            color={TEXT_MD}
            style={{ transform: aberto ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1"
          style={{
            backgroundColor: PANEL_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: RADIUS,
            boxShadow: 'var(--vli-shadow), 0 0.5rem 1.5rem rgba(0,0,0,0.25)',
            fontFamily: FONT,
            overflow: 'hidden',
          }}
        >
          <SelectPrimitive.Viewport style={{ padding: '0.25rem' }}>
            {opcoesExtras.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className="flex items-center"
                style={SELECT_ITEM_STYLE}
                onPointerEnter={onItemHover}
                onPointerLeave={onItemLeave}
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
            {NOMES_PATIOS.map((nome) => (
              <SelectPrimitive.Item
                key={nome}
                value={nome}
                className="flex items-center"
                style={SELECT_ITEM_STYLE}
                onPointerEnter={onItemHover}
                onPointerLeave={onItemLeave}
              >
                <SelectPrimitive.ItemText>Pátio {nome}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

/** Dropdown de data no header, ao lado do pátio — um calendário de verdade (não uma lista), com
 *  "hoje" (HOJE) como padrão. Só as datas com turno registrado no mock (`datasDisponiveis`) são
 *  clicáveis; o resto aparece esmaecido. Mesmo estilo em toda tela. Hover/seta girando/transição
 *  de abertura — MESMO tratamento de `PatioHeaderDropdown` acima (2026-08-28, ver comentário lá),
 *  já tinha o `aberto` controlado (só faltava usá-lo pra isso). */
export function DataHeaderDropdown({ value, onChange, datasDisponiveis }: { value: string; onChange: (v: string) => void; datasDisponiveis: string[] }) {
  const [aberto, setAberto] = useState(false);
  const rotulo = (d: string) => (d === HOJE ? `Hoje · ${formatarData(d)}` : formatarData(d));
  const datasDisponiveisSet = new Set(datasDisponiveis);

  return (
    <PopoverPrimitive.Root open={aberto} onOpenChange={setAberto}>
      <PopoverPrimitive.Trigger asChild>
        <button
          aria-label="Selecionar data do turno"
          className="flex items-center"
          style={{
            gap: '0.3125rem',
            border: 'none',
            background: aberto ? HOVER_TINT : 'transparent',
            cursor: 'pointer',
            padding: '0.25rem 0.375rem',
            margin: '-0.25rem -0.375rem',
            borderRadius: '0.25rem',
            outline: 'none',
            color: TEXT_MD,
            transition: 'background-color 0.15s',
          }}
          onPointerEnter={(e) => { if (!aberto) e.currentTarget.style.backgroundColor = HOVER_TINT; }}
          onPointerLeave={(e) => { if (!aberto) e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <CalendarIcon size="0.75rem" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.75rem', fontFamily: FONT, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {rotulo(value)}
          </span>
          <ChevronDown
            size="0.75rem"
            style={{ flexShrink: 0, transform: aberto ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
          />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={8}
          className="z-50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1"
          style={{
            backgroundColor: PANEL_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: RADIUS,
            boxShadow: 'var(--vli-shadow), 0 0.5rem 1.5rem rgba(0,0,0,0.25)',
            padding: '0.625rem',
          }}
        >
          <DayPicker
            mode="single"
            locale={ptBR}
            selected={isoParaDate(value)}
            defaultMonth={isoParaDate(value)}
            disabled={(date) => !datasDisponiveisSet.has(dateParaIso(date))}
            onSelect={(date) => {
              if (!date) return;
              onChange(dateParaIso(date));
              setAberto(false);
            }}
            className="vli-daypicker"
            classNames={DAYPICKER_CLASS_NAMES}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

const DAYPICKER_CLASS_NAMES = {
  months: 'vli-daypicker-months',
  caption: 'vli-daypicker-caption',
  caption_label: 'vli-daypicker-caption-label',
  nav: 'vli-daypicker-nav',
  nav_button: 'vli-daypicker-nav-button',
  table: 'vli-daypicker-table',
  head_cell: 'vli-daypicker-head-cell',
  cell: 'vli-daypicker-cell',
  day: 'vli-daypicker-day',
  day_selected: 'vli-daypicker-day-selected',
  day_today: 'vli-daypicker-day-today',
  day_outside: 'vli-daypicker-day-outside',
  day_disabled: 'vli-daypicker-day-disabled',
};

/**
 * Campo de data para FORMULÁRIO (Criar Ficha / Importar Ficha) — mesmo calendário visual do
 * `DataHeaderDropdown` acima (mesmo `DayPicker`, mesmas classes `vli-daypicker-*`), só que com
 * aparência de campo de formulário (caixa com borda, altura/fonte iguais aos outros `input` do
 * modal) em vez do link discreto do header. Sem `disabled` — ao contrário do dropdown do header
 * (que só deixa escolher datas com turno já registrado no mock), aqui o usuário está definindo a
 * data de uma ficha nova, então qualquer data do calendário é uma escolha válida.
 */
export function DataPickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <PopoverPrimitive.Root open={aberto} onOpenChange={setAberto}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Selecionar data da ficha"
          className="flex items-center justify-between w-full"
          style={{
            gap: '0.375rem',
            width: '100%',
            backgroundColor: PANEL_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: '0.25rem',
            padding: '0.4375rem 0.5625rem',
            color: TEXT_HI,
            fontSize: '0.75rem',
            fontFamily: FONT,
            cursor: 'pointer',
          }}
        >
          <span className="flex items-center" style={{ gap: '0.375rem', minWidth: 0 }}>
            <CalendarIcon size="0.75rem" color={TEXT_MD} style={{ flexShrink: 0 }} />
            {formatarData(value)}
          </span>
          <ChevronDown size="0.75rem" color={TEXT_MD} style={{ flexShrink: 0 }} />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={8}
          // Precisa vencer o `zIndex: 200` dos modais (`CriarFichaManualModal`/
          // `ImportarFichaModal`, único lugar que usa este campo) — o `z-50` do Tailwind (50)
          // não bastava, o popover renderizava atrás da própria modal que o abriu. 400 fica
          // acima de todo `zIndex` já usado no app (maior valor hoje é 300, em `Sidebar.tsx`).
          style={{
            zIndex: 400,
            backgroundColor: PANEL_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: RADIUS,
            boxShadow: 'var(--vli-shadow), 0 0.5rem 1.5rem rgba(0,0,0,0.25)',
            padding: '0.625rem',
          }}
        >
          <DayPicker
            mode="single"
            locale={ptBR}
            selected={isoParaDate(value)}
            defaultMonth={isoParaDate(value)}
            onSelect={(date) => {
              if (!date) return;
              onChange(dateParaIso(date));
              setAberto(false);
            }}
            className="vli-daypicker"
            classNames={DAYPICKER_CLASS_NAMES}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
