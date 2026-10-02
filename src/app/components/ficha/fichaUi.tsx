// Peças visuais compartilhadas pelas abas da Ficha Operacional. Só apresentação — nenhuma peça
// aqui conhece a origem do dado (upload/integração).
import { forwardRef, useEffect, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as SelectPrimitive from '@radix-ui/react-select';
import { AlertTriangle, ArrowDown, ArrowUp, Ban, Check, ChevronDown, ChevronsUpDown, Filter, Info, Minus, Plus, ShieldCheck, X, XCircle, type LucideIcon } from 'lucide-react';
import { HeaderTooltip } from '../PageHeader';
import { dicaColuna, type TipoRestricao, type TomAtividade } from '../../data/glossarioFicha';

export const T = {
  primary: 'var(--vli-primary)',
  primaryText: 'var(--vli-primary-text)',
  panel: 'var(--vli-panel-bg)',
  surface: 'var(--vli-surface)',
  border: 'var(--vli-border)',
  hi: 'var(--vli-text-hi)',
  md: 'var(--vli-text-md)',
  lo: 'var(--vli-text-lo)',
  sutil: 'var(--vli-text-sutil)',
  success: 'var(--vli-success-text)',
  successBg: 'var(--vli-success-bg)',
  danger: 'var(--vli-danger-text)',
  dangerBg: 'var(--vli-danger-bg)',
  /** Verde de INCLUSÃO (painel Ações operacionais, aba Trem) — #16A34A, token próprio (não
   *  `success`, que é o "sucesso" genérico do app noutro tom/opacidade). Vermelho de retirada
   *  reaproveita `danger`/`dangerBg` — já são #DC2626 a 8%, pedido à risca. */
  incluir: 'var(--vli-incluir-fg)',
  incluirBg: 'var(--vli-incluir-bg)',
  warning: 'var(--vli-warning-text)',
  warningBg: 'var(--vli-warning-bg)',
  hover: 'var(--vli-hover-tint)',
  active: 'var(--vli-active-bg)',
  /** Azul de marca #0E74BA — seleção, destaque, itens prontos e tudo que é editável. Em
   *  superfície (bloco, ponto, borda) usa a cor cheia; em TEXTO usa `azulTexto`, clareada no
   *  tema escuro pra manter contraste. */
  azul: 'var(--vli-marca-azul)',
  azulTexto: 'var(--vli-badge-editavel-fg)',
  azulBg: 'var(--vli-badge-editavel-bg)',
  azulBorda: 'var(--vli-badge-editavel-border)',
  /** Laranja de marca #EF7A1D — locomotivas. */
  laranja: 'var(--vli-marca-laranja)',
  laranjaTexto: 'var(--vli-wagon-locomotiva-fg)',
  /** Laranja de 'edição ativa' — só o formulário de Ações Operacionais do fluxo de importação/
   *  cadastro (`AcoesOperacionaisForm`) ainda usa. */
  edit: 'var(--vli-accent)',
  editBg: 'color-mix(in srgb, var(--vli-accent) 7%, var(--vli-panel-bg))',
  editBorder: 'color-mix(in srgb, var(--vli-accent) 45%, var(--vli-border))',
  divisor: 'color-mix(in srgb, var(--vli-border) 55%, transparent)',
  font: 'Manrope, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  radius: '0.375rem',
} as const;

export function fmtNum(n: number | undefined, casas = 0): string {
  if (n === undefined) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function fmtT(n: number | undefined): string {
  if (n === undefined) return '—';
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t`;
}

/** "HH:MM" de um datetime ISO. */
export function fmtHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------------------
// Tabela
// ---------------------------------------------------------------------------------------

export const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  fontSize: '0.5625rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: T.lo,
  borderBottom: `1px solid ${T.border}`,
  fontFamily: T.font,
  whiteSpace: 'nowrap',
  backgroundColor: T.panel,
};

/** Separação da coluna fixa à direita (ex.: Ações do Pátio) do conteúdo que rola por baixo dela. */
export const SOMBRA_FIXA_DIREITA = 'inset 1px 0 0 var(--vli-border), -0.625rem 0 0.75rem -0.625rem rgba(0,0,0,0.35)';

export function tdStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    padding: '0.4375rem 0.75rem',
    fontSize: '0.75rem',
    fontFamily: T.font,
    color: T.md,
    borderBottom: `1px solid ${T.divisor}`,
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    ...extra,
  };
}

/**
 * Cabeçalho de coluna. `colunas` = nomes técnicos do campo na fonte: no modo normal o rótulo
 * legível aparece e o nome técnico fica no tooltip; com "Colunas da fonte" ligado (`fonte`) os
 * papéis se invertem — o nome técnico aparece e o rótulo legível vai pro tooltip.
 */
// ---------------------------------------------------------------------------------------
// Ordenação por coluna — clicar no cabeçalho alterna crescente → decrescente → ordem original.
// ---------------------------------------------------------------------------------------

export type DirecaoOrdem = 'asc' | 'desc';
export interface Ordem<K extends string> { chave: K; direcao: DirecaoOrdem }

export function useOrdenacao<K extends string>() {
  const [ordem, setOrdem] = useState<Ordem<K> | null>(null);
  const alternar = (chave: K) =>
    setOrdem((o) => (!o || o.chave !== chave ? { chave, direcao: 'asc' } : o.direcao === 'asc' ? { chave, direcao: 'desc' } : null));
  /** Props prontas pro `Th` da coluna. */
  const th = (chave: K) => ({ ordem: ordem?.chave === chave ? ordem.direcao : null, onOrdenar: () => alternar(chave) });
  return { ordem, th };
}

export type ValorOrdenavel = string | number | undefined;

/** Ordena mantendo estável; vazio (—) sempre por último, nos dois sentidos. Texto compara em
 *  pt-BR com números "naturais" (LN3 antes de LN10). Sem ordem = devolve como veio. */
export function ordenar<T, K extends string>(itens: T[], ordem: Ordem<K> | null, valor: (item: T, chave: K) => ValorOrdenavel): T[] {
  if (!ordem) return itens;
  const fator = ordem.direcao === 'asc' ? 1 : -1;
  const vazio = (v: ValorOrdenavel) => v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));
  return itens
    .map((item, i) => ({ item, i, v: valor(item, ordem.chave) }))
    .sort((a, b) => {
      if (vazio(a.v) || vazio(b.v)) return vazio(a.v) === vazio(b.v) ? a.i - b.i : vazio(a.v) ? 1 : -1;
      const c = typeof a.v === 'number' && typeof b.v === 'number'
        ? a.v - b.v
        : String(a.v).localeCompare(String(b.v), 'pt-BR', { numeric: true, sensitivity: 'base' });
      return c * fator || a.i - b.i;
    })
    .map((x) => x.item);
}

/**
 * Cabeçalho de coluna. `colunas` = nomes técnicos do campo na fonte: no modo normal o rótulo
 * legível aparece e o nome técnico fica no tooltip; com "Colunas da fonte" ligado (`fonte`) os
 * papéis se invertem. `onOrdenar` torna a coluna ordenável (clique no cabeçalho).
 */
export function Th({ children, colunas, fonte = false, alinhar, largura, ordem, onOrdenar, sticky }: {
  children: string;
  colunas?: string[];
  fonte?: boolean;
  alinhar?: 'right' | 'center';
  largura?: string;
  ordem?: DirecaoOrdem | null;
  onOrdenar?: () => void;
  /** Coluna fixa durante a rolagem horizontal (ex.: Linha/Posição/Veículo no Pátio). */
  /** Coluna fixa durante a rolagem horizontal (ex.: Linha/Posição/Veículo à esquerda e Ações à
   *  direita no Pátio). Fixa à direita ganha a sombra de separação `SOMBRA_FIXA_DIREITA`. */
  sticky?: { left?: string; right?: string };
}) {
  let conteudo: React.ReactNode = children;
  if (colunas && colunas.length > 0) {
    conteudo = fonte ? (
      <HeaderTooltip label={children}>
        <span style={{ cursor: 'help', fontFamily: T.mono, fontSize: '0.625rem', textTransform: 'none', letterSpacing: 0, color: T.md }}>{colunas.join(' / ')}</span>
      </HeaderTooltip>
    ) : (
      <HeaderTooltip label={dicaColuna(...colunas)}>
        <span style={{ cursor: 'help', borderBottom: `1px dotted ${T.lo}` }}>{children}</span>
      </HeaderTooltip>
    );
  }
  if (onOrdenar) {
    const Icone = ordem === 'asc' ? ArrowUp : ordem === 'desc' ? ArrowDown : ChevronsUpDown;
    conteudo = (
      <span className="inline-flex items-center" style={{ gap: '0.25rem' }}>
        {conteudo}
        <button
          type="button"
          onClick={onOrdenar}
          aria-label={`Ordenar por ${children}${ordem === 'asc' ? ' (crescente)' : ordem === 'desc' ? ' (decrescente)' : ''}`}
          className="inline-flex items-center justify-center"
          style={{ width: '1rem', height: '1rem', padding: 0, border: 'none', borderRadius: '0.1875rem', background: 'transparent', color: ordem ? T.azulTexto : T.lo, opacity: ordem ? 1 : 0.55, cursor: 'pointer' }}
        >
          <Icone size="0.6875rem" strokeWidth={2.5} />
        </button>
      </span>
    );
  }
  return (
    <th
      aria-sort={ordem === 'asc' ? 'ascending' : ordem === 'desc' ? 'descending' : undefined}
      onClick={onOrdenar ? (e) => { if (e.target === e.currentTarget) onOrdenar(); } : undefined}
      style={{
        ...thStyle,
        textAlign: alinhar ?? 'left',
        width: largura,
        // Coluna fixa não pode ser comprimida pela tabela: o deslocamento (`left`) das colunas
        // fixas seguintes é calculado a partir desta largura.
        ...(sticky && largura && { minWidth: largura, maxWidth: largura }),
        cursor: onOrdenar ? 'pointer' : undefined,
        color: ordem ? T.hi : thStyle.color,
        ...(sticky && { position: 'sticky', left: sticky.left, right: sticky.right, zIndex: 2 }),
        ...(sticky?.right !== undefined && { boxShadow: SOMBRA_FIXA_DIREITA }),
      }}
    >
      {conteudo}
    </th>
  );
}

/** Linha de título de grupo dentro de uma tabela (ex.: "Linha LN3 · 28 vagões") — mesmo estilo da
 *  antiga aba Pátio · Vagões. */
export function LinhaGrupo({ colSpan, titulo, detalhe }: { colSpan: number; titulo: React.ReactNode; detalhe?: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: '0.4375rem 0.75rem', backgroundColor: 'color-mix(in srgb, var(--vli-surface) 55%, var(--vli-panel-bg))', borderBottom: `1px solid ${T.divisor}`, fontFamily: T.font }}>
        <span className="flex items-center" style={{ gap: '0.5rem' }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: T.hi }}>{titulo}</span>
          {detalhe && <span style={{ fontSize: '0.625rem', color: T.lo }}>{detalhe}</span>}
        </span>
      </td>
    </tr>
  );
}

export function Rota({ origem, destino }: { origem?: string; destino?: string }) {
  if (!origem && !destino) return <span style={{ color: T.lo }}>—</span>;
  return (
    <span className="inline-flex items-center" style={{ gap: '0.25rem' }}>
      {origem || '—'}
      <span style={{ color: T.lo }}>→</span>
      {destino || '—'}
    </span>
  );
}

export type EstadoChipVeiculo = 'locomotiva' | 'vagao' | 'retirar' | 'incluir';

/** Mesmas 4 cores do `TagVagao` "suave" da Composição Geral do Planejamento (J105-V2): azul =
 *  vagão, laranja = locomotiva, vermelho = a retirar, verde = a incluir. */
const ESTILO_CHIP: Record<EstadoChipVeiculo, { cor: string; bg: string }> = {
  locomotiva: { cor: 'var(--vli-wagon-locomotiva-fg)', bg: 'var(--vli-wagon-locomotiva-bg)' },
  vagao: { cor: 'var(--vli-wagon-vagao-fg)', bg: 'var(--vli-wagon-vagao-bg)' },
  retirar: { cor: T.danger, bg: T.dangerBg },
  incluir: { cor: T.incluir, bg: T.incluirBg },
};

/** Chip de veículo no padrão do Planejamento — fundo/borda clareados na direção do painel, texto
 *  na cor cheia; retirar/incluir ganham o ícone de menos/mais, como lá.
 *  `semFundo`: sem preenchimento próprio (só borda), pra usar dentro de uma linha que já tem o
 *  mesmo tom por trás — evita dois vermelhos translúcidos empilhados ficando mais escuros que o
 *  resto da linha (pedido explícito do usuário). */
export function ChipVeiculo({ estado, children, semFundo = false }: { estado: EstadoChipVeiculo; children: React.ReactNode; semFundo?: boolean }) {
  const e = ESTILO_CHIP[estado];
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: '0.1875rem',
        height: '1.375rem',
        padding: '0 0.375rem',
        borderRadius: '0.1875rem',
        border: `1px solid color-mix(in srgb, ${e.cor} 45%, var(--vli-panel-bg))`,
        backgroundColor: semFundo ? 'transparent' : `color-mix(in srgb, ${e.bg} 55%, var(--vli-panel-bg))`,
        color: e.cor,
        fontSize: '0.6875rem',
        fontWeight: 600,
        fontFamily: T.font,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {estado === 'retirar' && <Minus size="0.625rem" strokeWidth={3} />}
      {estado === 'incluir' && <Plus size="0.625rem" strokeWidth={3} />}
      {children}
    </span>
  );
}

/** Identificação do veículo — série pequena em cinza + número em negrito, ou (`chip`) série em
 *  cinza + número dentro do chip colorido. `riscado` = número riscado. */
export function IdVeiculo({ serie, numero, riscado = false, chip, chipSemFundo }: { serie: string; numero: string; riscado?: boolean; chip?: EstadoChipVeiculo; chipSemFundo?: boolean }) {
  const numeroSemSerie = serie && numero.toUpperCase().startsWith(serie.toUpperCase()) ? numero.slice(serie.length).replace(/^[\s-]+/, '') : numero;
  if (chip) {
    return (
      <span className="inline-flex items-center" style={{ gap: '0.375rem' }}>
        {serie && <span style={{ fontSize: '0.625rem', fontWeight: 600, color: T.lo, letterSpacing: '0.02em' }}>{serie}</span>}
        <ChipVeiculo estado={chip} semFundo={chipSemFundo}>{numeroSemSerie || numero}</ChipVeiculo>
      </span>
    );
  }
  return (
    <span className="inline-flex items-baseline" style={{ gap: '0.3125rem' }}>
      {serie && <span style={{ fontSize: '0.625rem', fontWeight: 600, color: T.lo, letterSpacing: '0.02em' }}>{serie}</span>}
      <span
        style={{
          fontWeight: 700,
          color: T.hi,
          fontVariantNumeric: 'tabular-nums',
          textDecoration: riscado ? 'line-through' : undefined,
          textDecorationColor: riscado ? T.danger : undefined,
          textDecorationThickness: riscado ? '1.5px' : undefined,
        }}
      >
        {numeroSemSerie || numero}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------------------

export type Tom = TomAtividade | 'marca' | 'acao' | 'incluir';

const CORES_TOM: Record<Tom, { fg: string; bg: string; borda: string }> = {
  perigo: { fg: T.danger, bg: T.dangerBg, borda: 'color-mix(in srgb, var(--vli-danger-text) 30%, transparent)' },
  aviso: { fg: T.warning, bg: T.warningBg, borda: 'color-mix(in srgb, var(--vli-warning-text) 30%, transparent)' },
  info: { fg: T.azulTexto, bg: T.azulBg, borda: T.azulBorda },
  sucesso: { fg: T.success, bg: T.successBg, borda: 'color-mix(in srgb, var(--vli-success-text) 30%, transparent)' },
  neutro: { fg: T.md, bg: T.surface, borda: T.border },
  marca: { fg: T.azulTexto, bg: T.azulBg, borda: T.azulBorda },
  acao: { fg: T.edit, bg: T.editBg, borda: T.editBorder },
  /** Verde de inclusão (painel Ações operacionais) — ver comentário de `T.incluir`. */
  incluir: { fg: T.incluir, bg: T.incluirBg, borda: 'color-mix(in srgb, var(--vli-incluir-fg) 30%, transparent)' },
};

/** `semFundo`: sem preenchimento próprio (só borda) — pra usar dentro de uma linha que já tem o
 *  mesmo tom por trás, evitando dois fundos translúcidos da mesma cor empilhados (mais escuro que
 *  o resto da linha). */
export function Pill({ tom, children, icone: Icone, forte = false, dica, semFundo = false }: { tom: Tom; children: React.ReactNode; icone?: LucideIcon; forte?: boolean; dica?: string; semFundo?: boolean }) {
  const c = CORES_TOM[tom];
  const el = (
    <span
      className="inline-flex items-center"
      style={{
        gap: '0.25rem',
        height: forte ? '1.375rem' : '1.1875rem',
        padding: forte ? '0 0.5625rem' : '0 0.4375rem',
        borderRadius: '62.4375rem',
        border: `1px solid ${c.borda}`,
        backgroundColor: semFundo ? 'transparent' : c.bg,
        color: c.fg,
        fontSize: forte ? '0.6875rem' : '0.625rem',
        fontWeight: 700,
        fontFamily: T.font,
        whiteSpace: 'nowrap',
        cursor: dica ? 'help' : undefined,
      }}
    >
      {Icone && <Icone size={forte ? '0.75rem' : '0.6875rem'} strokeWidth={2.5} />}
      {children}
    </span>
  );
  return dica ? <HeaderTooltip label={dica}>{el}</HeaderTooltip> : el;
}

/** Badge do header de seção (ex.: "Composição editável") — uppercase compacto, azul de marca. */
export function BadgeSecao({ children, tom = 'marca', icone: Icone }: { children: React.ReactNode; tom?: 'marca' | 'neutro'; icone?: LucideIcon }) {
  const c = CORES_TOM[tom];
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: '0.1875rem',
        fontSize: '0.5625rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        lineHeight: 1,
        padding: '0.1875rem 0.3125rem',
        borderRadius: '0.1875rem',
        border: `1px solid ${c.borda}`,
        backgroundColor: c.bg,
        color: c.fg,
        fontFamily: T.font,
        whiteSpace: 'nowrap',
      }}
    >
      {Icone && <Icone size="0.5625rem" strokeWidth={2.5} />}
      {children}
    </span>
  );
}

export const ICONE_RESTRICAO: Record<TipoRestricao, LucideIcon> = {
  bloqueio: Ban,
  atencao: XCircle,
  alerta: AlertTriangle,
  verificar: ShieldCheck,
  informativo: Info,
};

export const TOM_RESTRICAO: Record<TipoRestricao, Tom> = {
  bloqueio: 'perigo',
  atencao: 'perigo',
  alerta: 'aviso',
  verificar: 'sucesso',
  informativo: 'info',
};

// ---------------------------------------------------------------------------------------
// Botões e popover (edição do Pátio, modal de Ações operacionais)
// ---------------------------------------------------------------------------------------

type VarianteBotao = 'primario' | 'secundario' | 'discreto' | 'perigo' | 'incluir';

const ESTILO_BOTAO: Record<VarianteBotao, React.CSSProperties> = {
  primario: { border: 'none', backgroundColor: T.primary, color: '#fff' },
  secundario: { border: `1px solid ${T.border}`, backgroundColor: T.panel, color: T.md },
  discreto: { border: '1px solid transparent', backgroundColor: 'transparent', color: T.lo },
  perigo: { border: `1px solid color-mix(in srgb, var(--vli-danger-text) 35%, transparent)`, backgroundColor: 'transparent', color: T.danger },
  /** Outline verde de inclusão — par do `perigo` (retirada) com o mesmo peso visual. */
  incluir: { border: `1px solid color-mix(in srgb, var(--vli-incluir-fg) 35%, transparent)`, backgroundColor: 'transparent', color: T.incluir },
};

/** Botão compacto das ações da ficha. `forwardRef` porque vira gatilho de popover/tooltip
 *  (Radix `asChild` precisa do ref e das props repassadas ao elemento DOM). */
export const BotaoFicha = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao; icone?: LucideIcon }>(
  function BotaoFicha({ variante = 'secundario', icone: Icone, children, style, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        {...rest}
        className={`inline-flex items-center${rest.className ? ` ${rest.className}` : ''}`}
        style={{
          gap: '0.25rem',
          height: '1.5rem',
          padding: '0 0.5rem',
          borderRadius: '0.25rem',
          fontSize: '0.6875rem',
          fontWeight: 600,
          fontFamily: T.font,
          whiteSpace: 'nowrap',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          ...ESTILO_BOTAO[variante],
          ...style,
        }}
      >
        {Icone && <Icone size="0.6875rem" strokeWidth={2.25} />}
        {children}
      </button>
    );
  },
);

/** Popover da ficha — mesma superfície do design system (painel neutro, borda fina). `dica`
 *  põe um tooltip no mesmo gatilho (Tooltip e Popover do Radix aninham pelo `asChild`). */
export function PopoverFicha({
  aberto,
  onAbertoChange,
  gatilho,
  dica,
  largura = '17rem',
  alinhar = 'end',
  children,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  gatilho: React.ReactElement;
  dica?: string;
  largura?: string;
  alinhar?: 'start' | 'center' | 'end';
  children: React.ReactNode;
}) {
  const trigger = <PopoverPrimitive.Trigger asChild>{gatilho}</PopoverPrimitive.Trigger>;
  return (
    <PopoverPrimitive.Root open={aberto} onOpenChange={onAbertoChange}>
      {dica ? <HeaderTooltip label={dica}>{trigger}</HeaderTooltip> : trigger}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={alinhar}
          sideOffset={6}
          collisionPadding={12}
          onClick={(e) => e.stopPropagation()}
          style={{
            zIndex: 60,
            width: largura,
            backgroundColor: T.panel,
            border: `1px solid ${T.border}`,
            borderRadius: T.radius,
            boxShadow: 'var(--vli-shadow), 0 0.5rem 1.5rem rgba(0,0,0,0.22)',
            padding: '0.875rem',
            fontFamily: T.font,
          }}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------------------
// Filtro lateral — ícone ao lado da busca + painel que empurra o conteúdo (não sobrepõe)
// ---------------------------------------------------------------------------------------

/** Ícone de filtro, ao lado da busca. Ponto azul de marca = algum filtro reduzindo a lista
 *  ("Colunas da fonte" não conta — é modo de exibição, não filtro). */
export function BotaoFiltro({ ativo, temFiltro, onClick }: { ativo: boolean; temFiltro: boolean; onClick: () => void }) {
  return (
    <HeaderTooltip label="Filtros">
      <button
        type="button"
        aria-pressed={ativo}
        aria-label="Abrir filtros"
        onClick={onClick}
        className="flex items-center justify-center shrink-0"
        style={{
          position: 'relative',
          width: '1.75rem',
          height: '1.75rem',
          border: `1px solid ${ativo ? T.primaryText : T.border}`,
          borderRadius: '0.375rem',
          backgroundColor: ativo ? T.active : T.panel,
          color: ativo ? T.primaryText : T.md,
          cursor: 'pointer',
        }}
      >
        <Filter size="0.75rem" strokeWidth={2.25} />
        {temFiltro && (
          <span
            aria-hidden
            style={{ position: 'absolute', top: '0.25rem', right: '0.25rem', width: '0.4375rem', height: '0.4375rem', borderRadius: '50%', backgroundColor: T.azul, border: `1px solid ${T.panel}` }}
          />
        )}
      </button>
    </HeaderTooltip>
  );
}

/** Abaixo desta largura de tela, o painel lateral vira overlay com scrim (não sobra espaço pra
 *  empurrar conteúdo) — usado por `PainelLateralShell`. */
const LARGURA_TELA_ESTREITA = 1280;

export function useTelaEstreita(limite = LARGURA_TELA_ESTREITA) {
  const [estreita, setEstreita] = useState(() => typeof window !== 'undefined' && window.innerWidth < limite);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${limite - 1}px)`);
    const aoMudar = () => setEstreita(window.innerWidth < limite);
    mql.addEventListener('change', aoMudar);
    aoMudar();
    return () => mql.removeEventListener('change', aoMudar);
  }, [limite]);
  return estreita;
}

/**
 * Casca do painel lateral — usada pelo painel de Filtro e pelo de Ações operacionais (mesmo
 * componente/padrão pros dois, pedido explícito do usuário). Em telas largas é irmão flex do
 * conteúdo da aba (a linha que envolve os dois é `flex` horizontal, ver `FichaOperacaoScreen`):
 * ao abrir ganha largura e empurra o conteúdo pra esquerda, sem backdrop nem `position: fixed`.
 * Abaixo de `LARGURA_TELA_ESTREITA` (1280px) não sobra espaço pra empurrar — vira overlay com
 * scrim (aí sim monta só quando aberto). Só um painel deve ficar aberto por vez; isso é
 * responsabilidade de quem chama (fecha o outro ao abrir um), não desta casca.
 */
export function PainelLateralShell({ aberto, onFechar, titulo, ariaLabel, largura, cabecalhoExtra, rodape, corpoRef, compacto = false, children }: {
  aberto: boolean;
  onFechar: () => void;
  /** Conteúdo do header — texto simples (Filtro) ou ícone + texto (Ações operacionais). */
  titulo: React.ReactNode;
  ariaLabel: string;
  largura: string;
  cabecalhoExtra?: React.ReactNode;
  rodape?: React.ReactNode;
  /** Ref do corpo rolável — pra quem chama controlar a rolagem (ex.: abrir no topo). */
  corpoRef?: React.Ref<HTMLDivElement>;
  /** Header 40px / rodapé 48px e corpo sem padding nem gap — as seções cuidam do próprio
   *  espaçamento (linhas de ponta a ponta, títulos sticky). */
  compacto?: boolean;
  children: React.ReactNode;
}) {
  const estreita = useTelaEstreita();
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, onFechar]);

  const corpo = (
    <div className="flex flex-col" aria-label={ariaLabel} style={{ width: largura, height: '100%', backgroundColor: T.panel, fontFamily: T.font }}>
      <div className="flex items-center shrink-0" style={{ gap: '0.5rem', borderBottom: `1px solid ${T.border}`, ...(compacto ? { height: '2.5rem', padding: '0 0.5rem 0 0.875rem' } : { padding: '0.875rem 1rem' }) }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: '0.75rem', fontWeight: 700, color: T.hi, whiteSpace: 'nowrap' }}>{titulo}</span>
        {cabecalhoExtra}
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="flex items-center justify-center"
          style={{ width: '1.75rem', height: '1.75rem', border: 'none', borderRadius: '0.25rem', background: 'transparent', color: T.lo, cursor: 'pointer', flexShrink: 0 }}
        >
          <X size="0.875rem" />
        </button>
      </div>
      <div ref={corpoRef} className="flex flex-col" style={{ flex: 1, minHeight: 0, overflowY: 'auto', ...(compacto ? {} : { padding: '1rem', gap: '1.125rem' }) }}>
        {children}
      </div>
      {rodape && <div className="flex items-center shrink-0" style={{ borderTop: `1px solid ${T.border}`, ...(compacto ? { height: '3rem', padding: '0 0.875rem' } : { padding: '0.75rem 1rem' }) }}>{rodape}</div>}
    </div>
  );

  if (estreita) {
    if (!aberto) return null;
    return (
      <div className="fixed inset-0 no-print" style={{ zIndex: 200 }}>
        <div onClick={onFechar} className="fixed inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />
        <div className="fixed top-0 right-0" style={{ height: '100%', width: largura, maxWidth: '100vw', boxShadow: 'var(--vli-shadow), -0.75rem 0 2rem rgba(0,0,0,0.3)' }}>
          {corpo}
        </div>
      </div>
    );
  }

  return (
    <div
      className="shrink-0 no-print"
      aria-hidden={!aberto}
      style={{ width: aberto ? largura : 0, overflow: 'hidden', borderLeft: aberto ? `1px solid ${T.border}` : 'none', transition: 'width 200ms ease-in-out' }}
    >
      {corpo}
    </div>
  );
}

/**
 * Painel de filtro — construído sobre `PainelLateralShell` (mesmo componente que o painel de
 * Ações operacionais usa). `onLimpar` só vem quando há filtro ativo.
 */
export function PainelFiltro({ aberto, onFechar, onLimpar, titulo, children }: { aberto: boolean; onFechar: () => void; onLimpar?: () => void; titulo: string; children: React.ReactNode }) {
  return (
    <PainelLateralShell
      aberto={aberto}
      onFechar={onFechar}
      titulo={titulo}
      ariaLabel={titulo}
      largura="19rem"
      cabecalhoExtra={
        onLimpar && (
          <button type="button" onClick={onLimpar} style={{ border: 'none', background: 'transparent', padding: 0, color: T.azulTexto, fontSize: '0.6875rem', fontWeight: 600, fontFamily: T.font, cursor: 'pointer', flexShrink: 0 }}>
            Limpar filtros
          </button>
        )
      }
    >
      {children}
    </PainelLateralShell>
  );
}

/** Grupo de opções dentro do painel — rótulo pequeno uppercase, sem caixa aninhada. */
export function GrupoFiltro({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col" style={{ gap: '0.5rem' }}>
      <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.lo, fontFamily: T.font }}>{titulo}</span>
      <div className="flex flex-col" style={{ gap: '0.125rem' }}>{children}</div>
    </div>
  );
}

/** Opção liga/desliga (checkbox) do painel de filtro. */
/** Opção com contagem 0 não filtraria nada — fica desabilitada em cinza, sem sumir (o grupo se
 *  reconstrói conforme os dados carregados, e uma opção que zerou pode voltar a ter itens depois). */
export function OpcaoFiltro({ ativo, onClick, children, contagem }: { ativo: boolean; onClick: () => void; children: React.ReactNode; contagem?: number }) {
  const desabilitada = contagem === 0;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={ativo}
      disabled={desabilitada}
      onClick={onClick}
      className="flex items-center"
      style={{
        gap: '0.5rem',
        width: '100%',
        padding: '0.4375rem 0.375rem',
        border: 'none',
        borderRadius: '0.25rem',
        background: 'transparent',
        fontSize: '0.75rem',
        fontFamily: T.font,
        cursor: desabilitada ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        color: desabilitada ? T.lo : ativo ? T.hi : T.md,
        fontWeight: ativo ? 700 : 500,
        opacity: desabilitada ? 0.55 : 1,
      }}
      onMouseEnter={(e) => { if (!desabilitada) e.currentTarget.style.backgroundColor = T.hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <span
        className="flex items-center justify-center"
        style={{ flexShrink: 0, width: '0.875rem', height: '0.875rem', borderRadius: '0.1875rem', border: `1px solid ${ativo ? T.azul : T.border}`, backgroundColor: ativo ? T.azul : 'transparent' }}
      >
        {ativo && <Check size="0.625rem" strokeWidth={3} color="#fff" />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {contagem !== undefined && <span style={{ color: T.lo, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{contagem}</span>}
    </button>
  );
}

/** Liga/desliga um valor numa lista de seleção múltipla (filtros de checkbox). */
export function alternarNaLista<V>(lista: V[], valor: V): V[] {
  return lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];
}

// ---------------------------------------------------------------------------------------
// Diversos
// ---------------------------------------------------------------------------------------

export function EstadoVazio({ icone: Icone, titulo, descricao }: { icone: LucideIcon; titulo: string; descricao?: string }) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ gap: '0.375rem', padding: '2rem 1rem', textAlign: 'center' }}>
      <Icone size="1.5rem" strokeWidth={1.5} color={T.lo} />
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: T.md, fontFamily: T.font }}>{titulo}</span>
      {descricao && <span style={{ fontSize: '0.6875rem', color: T.lo, fontFamily: T.font, maxWidth: '28rem', lineHeight: 1.5 }}>{descricao}</span>}
    </div>
  );
}

/** Card de um número de resumo ("big number") — rótulo pequeno uppercase + valor em destaque.
 *  Mesmo card nas duas abas (resumo do trem e indicadores do pátio); `cor` pinta só o valor. */
export function CardResumo({ label, dica, cor, children }: { label: string; dica?: string; cor?: string; children: React.ReactNode }) {
  const rotulo = (
    <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.lo, fontFamily: T.font, cursor: dica ? 'help' : undefined }}>{label}</span>
  );
  return (
    <div className="flex flex-col" style={{ gap: '0.1875rem', minWidth: 0, padding: '0.5rem 0.75rem', borderRadius: T.radius, border: `1px solid ${T.border}`, backgroundColor: T.panel }}>
      {dica ? <HeaderTooltip label={dica}>{rotulo}</HeaderTooltip> : rotulo}
      <span className="flex items-center flex-wrap" style={{ gap: '0.25rem', fontSize: '1.125rem', fontWeight: 700, color: cor ?? T.hi, fontFamily: T.font, lineHeight: 1.3 }}>{children}</span>
    </div>
  );
}

/** Grade dos cards de resumo — sem título nem seção em volta, distribuída na largura da aba. */
export function GradeCards({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9.5rem, 1fr))', gap: '0.625rem', flexShrink: 0 }}>{children}</div>;
}

/** Corpo de `SecaoCartao` tem padding horizontal; tabelas encostam nas bordas com esta moldura. */
export function TabelaSangrada({ children, minWidth }: { children: React.ReactNode; minWidth?: string }) {
  return (
    <div style={{ overflowX: 'auto', margin: '0 -0.875rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth }}>{children}</table>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Dropdown compacto de célula (edição do Pátio)
// ---------------------------------------------------------------------------------------

export interface OpcaoDropdown {
  valor: string;
  rotulo: string;
}

/**
 * Dropdown de célula de tabela — mesma linguagem dos dropdowns do header (`PatioHeaderDropdown`,
 * `DataHeaderDropdown`, `PageHeader.tsx`): ChevronDown que gira ao abrir, painel com a mesma
 * superfície/sombra e transição de abertura, item com hover e ✓ no selecionado. Compacto (altura
 * de célula) e com altura máxima: listas longas (ex.: 28 posições da L3) rolam DENTRO do painel,
 * em vez de um select nativo do tamanho da tela (2026-10-02, pedido explícito do usuário).
 * Valor vazio mostra o `placeholder`.
 */
export function DropdownCelula({ valor, onChange, opcoes, rotulo, placeholder = 'Selecione', largura, invalido, desabilitado, numerico, tamanho = 'compacto' }: {
  valor: string;
  onChange: (v: string) => void;
  opcoes: OpcaoDropdown[];
  /** aria-label do campo. */
  rotulo: string;
  placeholder?: string;
  largura: string;
  invalido?: boolean;
  desabilitado?: boolean;
  /** `padrao`: altura dos campos de formulário/painel (1,75rem, ex.: Ações operacionais);
   *  `compacto` (default): altura de célula de tabela. */
  tamanho?: 'compacto' | 'padrao';
  /** Números alinhados (tabular-nums) — ex.: Posição. */
  numerico?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [hover, setHover] = useState(false);
  const destacado = !desabilitado && (aberto || hover);
  const padrao = tamanho === 'padrao';
  return (
    <SelectPrimitive.Root value={valor} onValueChange={onChange} open={aberto} onOpenChange={setAberto} disabled={desabilitado}>
      <SelectPrimitive.Trigger
        aria-label={rotulo}
        aria-invalid={invalido}
        className="flex items-center justify-between"
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        style={{
          width: largura,
          height: padrao ? '1.75rem' : '1.5rem',
          gap: '0.25rem',
          padding: padrao ? '0 0.4375rem' : '0 0.3125rem 0 0.4375rem',
          borderRadius: '0.25rem',
          border: `1px solid ${invalido ? T.danger : destacado ? T.azul : T.border}`,
          backgroundColor: aberto ? T.hover : T.panel,
          color: valor ? T.hi : T.lo,
          fontSize: padrao ? '0.75rem' : '0.6875rem',
          fontWeight: 500,
          fontFamily: T.font,
          fontVariantNumeric: numerico ? 'tabular-nums' : undefined,
          cursor: desabilitado ? 'not-allowed' : 'pointer',
          opacity: desabilitado ? 0.5 : 1,
          outline: 'none',
          transition: 'border-color 0.15s, background-color 0.15s',
        }}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon style={{ display: 'flex', flexShrink: 0 }}>
          <ChevronDown size="0.75rem" color={T.md} style={{ transform: aberto ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          collisionPadding={12}
          className="animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1"
          style={{
            // Acima do painel lateral em modo sobreposto (`PainelLateralShell`, zIndex 200) e das
            // modais — mesmo valor do `FiltroSelect`.
            zIndex: 400,
            minWidth: 'var(--radix-select-trigger-width)',
            maxHeight: 'min(13.5rem, var(--radix-select-content-available-height))',
            backgroundColor: T.panel,
            border: `1px solid ${T.border}`,
            borderRadius: T.radius,
            boxShadow: 'var(--vli-shadow), 0 0.5rem 1.5rem rgba(0,0,0,0.25)',
            fontFamily: T.font,
            overflow: 'hidden',
          }}
        >
          <SelectPrimitive.Viewport className="vli-dropdown-viewport" style={{ padding: '0.25rem' }}>
            {opcoes.map((o) => (
              <SelectPrimitive.Item
                key={o.valor}
                value={o.valor}
                className="vli-dropdown-item flex items-center justify-between"
                style={{
                  gap: '0.625rem',
                  padding: '0.375rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: padrao ? '0.75rem' : '0.6875rem',
                  color: T.hi,
                  fontVariantNumeric: numerico ? 'tabular-nums' : undefined,
                  cursor: 'pointer',
                  outline: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <SelectPrimitive.ItemText>{o.rotulo}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator style={{ display: 'flex', flexShrink: 0 }}>
                  <Check size="0.75rem" color={T.azulTexto} strokeWidth={2.5} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
