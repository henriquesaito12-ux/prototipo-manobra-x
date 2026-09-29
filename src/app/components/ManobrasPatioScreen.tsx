import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Fuel, Search, Train, Wrench } from 'lucide-react';
import { PageHeader, HeaderTitulo, HeaderDivider } from './PageHeader';
import { FiltroSelect } from './FiltroSelect';
import { ConfirmarMovimentacaoModal } from './ConfirmarMovimentacaoModal';
import { EHT_TOPOLOGY } from './topological-map/train-yard/mocks/eht';
import { planosManobraMock, type BlocoManobra, type ItemComposicao } from '../data/planoManobra';

const BG_DEEP    = 'var(--vli-bg-deep)';
const PANEL_BG   = 'var(--vli-panel-bg)';
const SURFACE    = 'var(--vli-surface)';
const BORDER     = 'var(--vli-border)';
const TEXT_HI    = 'var(--vli-text-hi)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
const HOVER_TINT = 'var(--vli-hover-tint)';
const VLI_PRIMARY_TEXT = 'var(--vli-primary-text)';
const SUCCESS_TEXT = 'var(--vli-success-text)';
const SUCCESS_BG   = 'var(--vli-success-bg)';
const WARNING_TEXT = 'var(--vli-warning-text)';
const WARNING_BG   = 'var(--vli-warning-bg)';
const DANGER_TEXT  = 'var(--vli-danger-text)';
const DANGER_BG    = 'var(--vli-danger-bg)';
const FONT       = 'Manrope, sans-serif';
const RADIUS     = '0.375rem';
const COLUNA_W   = '15.75rem';

// ───────────────────────────── Colunas do board ─────────────────────────────
// Mesma fonte de linhas já usada pela Visão Topológica (`EHT_TOPOLOGY`, o snapshot real do
// pátio Hélio Torres) — não uma lista de linhas separada. `order` é o mesmo ordinal usado pelo
// mapa (`Line.order`); `status` também vem de lá, então uma linha interditada no mapa (hoje só
// a L4) aparece igualmente sinalizada aqui. "Manutenção"/"Abastecimento" são colunas fixas, sem
// equivalente físico no pátio — sempre no final.
interface ColunaBoard {
  id: string;
  label: string;
  especial?: 'manutencao' | 'abastecimento';
  interditada?: boolean;
}

const COLUNAS_LINHA: ColunaBoard[] = [...EHT_TOPOLOGY.lines]
  .sort((a, b) => a.order - b.order)
  .map((linha) => ({ id: linha.id, label: linha.label, interditada: linha.status?.includes('interditada') }));

const COLUNAS: ColunaBoard[] = [
  ...COLUNAS_LINHA,
  { id: 'manutencao', label: 'Manutenção', especial: 'manutencao' },
  { id: 'abastecimento', label: 'Abastecimento', especial: 'abastecimento' },
];

// ───────────────────────────── Status do card ─────────────────────────────
// Vocabulário ainda não existe em nenhum outro lugar do protótipo (a aba "Visão pátio -
// Vagões/locomotivas" da Ficha Operacional guarda só colunas de planilha, sem um campo de
// status semântico) — só as CORES são reaproveitadas, mesma tríade sucesso/atenção/perigo já
// usada em Restrições (perigo) e na coluna "Retirar" da Ficha Operacional (perigo) / coluna
// "Restrição" (atenção).
type StatusPatio = 'disponivel' | 'ag-manobra' | 'manutencao';

const STATUS_LABEL: Record<StatusPatio, string> = {
  disponivel: 'Disponível',
  'ag-manobra': 'Ag. Manobra',
  manutencao: 'Em Manutenção',
};

const STATUS_COR: Record<StatusPatio, { cor: string; bg: string }> = {
  disponivel: { cor: SUCCESS_TEXT, bg: SUCCESS_BG },
  'ag-manobra': { cor: WARNING_TEXT, bg: WARNING_BG },
  manutencao: { cor: DANGER_TEXT, bg: DANGER_BG },
};

// ───────────────────────────── Cards ─────────────────────────────
interface CardPatio {
  id: string;
  tipo: 'bloco' | 'avulso';
  nome: string;
  /** Ausente para vagão avulso — só Blocos pertencem a um trem. */
  trem?: string;
  resumo?: string;
  status: StatusPatio;
  colunaId: string;
  /** Presente só quando `tipo === 'bloco'` — é o que permite expandir pro detalhe vagão a
   *  vagão (mesmo objeto usado pelo Plano de Manobra, não uma cópia). */
  bloco?: BlocoManobra;
}

/**
 * Composição física do Bloco inteiro (união das listas "antes" de todos os Clusters, com os
 * problemáticos marcados "retirado") — mesma lógica de `derivarComposicaoDoBloco` em
 * `PlanManobraX.tsx` (não exportada de lá, por isso duplicada aqui; ambas leem só o `BlocoManobra`
 * do Plano de Manobra, sem inventar dado novo). É o "zoom progressivo": o card mostra o Bloco
 * agregado por padrão, e só deriva o vagão a vagão quando o operador expande.
 */
function derivarComposicaoDoBloco(bloco: BlocoManobra): ItemComposicao[] {
  const porId = new Map<string, ItemComposicao>();
  for (const cluster of bloco.clusters) {
    for (const item of cluster.composicao.antes) {
      if (item.tipo === 'incluido') continue;
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

function criarCardBloco(trem: string, blocoId: string, colunaId: string, status: StatusPatio): CardPatio {
  const bloco = planosManobraMock[trem]?.blocos.find((b) => b.id === blocoId);
  if (!bloco) throw new Error(`Bloco ${blocoId} não encontrado no plano do trem ${trem}`);
  return {
    id: `card-${trem}-${bloco.id}`,
    tipo: 'bloco',
    nome: bloco.nome,
    trem,
    resumo: `${bloco.locomotivas} loco + ${bloco.vagoes} vagões`,
    status,
    colunaId,
    bloco,
  };
}

function criarCardAvulso(id: string, nome: string, colunaId: string, status: StatusPatio): CardPatio {
  return { id, tipo: 'avulso', nome, status, colunaId };
}

/**
 * Dados de exemplo: os Blocos de trens já existentes no Plano de Manobra (`planosManobraMock`),
 * distribuídos nas linhas do pátio — nenhum bloco/trem inventado. A L4 fica sem card de
 * propósito: é a única linha interditada no mock real (ver `COLUNAS_LINHA`), então não faz
 * sentido nenhuma composição estacionada lá. Os vagões avulsos em Manutenção/Abastecimento
 * reaproveitam ids/motivos reais de vagões "retirado" do mock (mesma convenção dos Blocos), mas
 * de trens que NÃO têm bloco no board — assim o mesmo vagão nunca aparece simultaneamente como
 * card avulso E dentro do detalhe expandido de um Bloco.
 */
const CARDS_INICIAIS: CardPatio[] = [
  criarCardBloco('J614', 'blocoA', 'L1', 'disponivel'),
  criarCardBloco('J614', 'blocoB', 'L2', 'ag-manobra'),
  criarCardBloco('R045', 'blocoA', 'L3', 'disponivel'),
  criarCardAvulso('card-avulso-vg-96204', 'VG-96204', 'manutencao', 'manutencao'),
  criarCardAvulso('card-avulso-vg-85260', 'VG-85260', 'manutencao', 'manutencao'),
  criarCardAvulso('card-avulso-vg-97210', 'VG-97210', 'abastecimento', 'ag-manobra'),
];

function cardCorrespondeQuery(card: CardPatio, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (card.nome.toLowerCase().includes(q)) return true;
  if (card.tipo === 'bloco' && card.bloco) {
    return derivarComposicaoDoBloco(card.bloco).some((item) => item.id.toLowerCase().includes(q));
  }
  return false;
}

// ───────────────────────────── Chip de vagão (detalhe expandido) ─────────────────────────────
// Mesmas cores/convenção do `TagVagao` de `PlanManobraX.tsx` (locomotiva/vagão neutros,
// "retirado" em vermelho) — versão compacta, sem "incluído" (o detalhe aqui é sempre "agora",
// não um "antes/depois" de manobra futura.
// `bg` usa os mesmos tokens dedicados de `TagVagao` (`--vli-wagon-retirado-bg`/
// `--vli-wagon-incluido-bg`, `theme.css`) — não `DANGER_BG`/`SUCCESS_BG` diretos: aqui esses dois
// também alimentam `STATUS_COR` (badge "Disponível"/"Em Manutenção" do card, sem relação com
// vagão retirado/incluído) — reaproveitar os mesmos mudaria os dois badges sem querer.
const TIPO_VEICULO_ESTILO: Record<ItemComposicao['tipo'], { cor: string; bg: string; destaque: boolean }> = {
  locomotiva: { cor: TEXT_MD, bg: 'transparent', destaque: false },
  vagao: { cor: TEXT_MD, bg: 'transparent', destaque: false },
  retirado: { cor: DANGER_TEXT, bg: 'var(--vli-wagon-retirado-bg)', destaque: true },
  incluido: { cor: SUCCESS_TEXT, bg: 'var(--vli-wagon-incluido-bg)', destaque: true },
};

function ChipVeiculo({ item }: { item: ItemComposicao }) {
  const estilo = TIPO_VEICULO_ESTILO[item.tipo];
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: '0.25rem',
        height: '1.5rem',
        padding: '0 0.5rem',
        borderRadius: '0.1875rem',
        border: `1px solid ${estilo.destaque ? estilo.cor : BORDER}`,
        backgroundColor: estilo.bg,
        color: estilo.cor,
        fontSize: '0.65625rem',
        fontWeight: estilo.destaque ? 600 : 400,
        fontFamily: FONT,
        whiteSpace: 'nowrap',
      }}
    >
      {item.tipo === 'locomotiva' && <Train size="0.625rem" strokeWidth={2.5} />}
      {item.id}
    </span>
  );
}

// ───────────────────────────── Toggle Destacar/Isolar ─────────────────────────────
// Mesmo padrão visual do `LayoutSegmentedControl` de `PlanejamentoScreen.tsx` (radiogroup em
// pílula, opção ativa com `--vli-active-bg`), só com rótulo em texto em vez de ícone.
type ModoFiltroTrem = 'destacar' | 'isolar';

function ModoFiltroToggle({ valor, onChange }: { valor: ModoFiltroTrem; onChange: (v: ModoFiltroTrem) => void }) {
  const opcoes: { valor: ModoFiltroTrem; label: string }[] = [
    { valor: 'destacar', label: 'Destacar' },
    { valor: 'isolar', label: 'Isolar' },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Modo do filtro por trem"
      className="flex items-center shrink-0"
      style={{ gap: '0.125rem', padding: '0.125rem', borderRadius: RADIUS, border: `1px solid ${BORDER}` }}
    >
      {opcoes.map(({ valor: v, label }) => {
        const ativo = valor === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(v)}
            style={{
              height: '1.5rem',
              padding: '0 0.625rem',
              border: 'none',
              borderRadius: '0.25rem',
              backgroundColor: ativo ? 'var(--vli-active-bg)' : 'transparent',
              color: ativo ? VLI_PRIMARY_TEXT : TEXT_MD,
              fontSize: '0.625rem',
              fontWeight: 700,
              letterSpacing: '0.03em',
              fontFamily: FONT,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.backgroundColor = HOVER_TINT; }}
            onMouseLeave={(e) => { if (!ativo) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────────── Card do board ─────────────────────────────
interface CardBoardProps {
  card: CardPatio;
  expanded: boolean;
  onToggleExpand: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  dragging: boolean;
  /** `true` quando o filtro por trem está ativo (modo "destacar") e este card NÃO é do trem
   *  filtrado — só esmaece, nunca some (quem some é o modo "isolar", antes de chegar aqui). */
  esmaecido: boolean;
  highlighted: boolean;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}

function CardBoard({ card, expanded, onToggleExpand, onDragStart, onDragEnd, dragging, esmaecido, highlighted, registerRef }: CardBoardProps) {
  const statusEstilo = STATUS_COR[card.status];
  const composicao = card.tipo === 'bloco' && card.bloco ? derivarComposicaoDoBloco(card.bloco) : [];

  return (
    <div
      ref={(el) => registerRef(card.id, el)}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => { if (card.tipo === 'bloco') onToggleExpand(); }}
      style={{
        marginBottom: '0.5rem',
        border: `1px solid ${highlighted ? VLI_PRIMARY_TEXT : BORDER}`,
        borderRadius: RADIUS,
        backgroundColor: PANEL_BG,
        boxShadow: highlighted ? '0 0 0 3px color-mix(in srgb, var(--vli-primary-text) 35%, transparent)' : 'var(--vli-shadow)',
        opacity: dragging ? 0.4 : esmaecido ? 0.35 : 1,
        cursor: card.tipo === 'bloco' ? 'pointer' : 'grab',
        transition: 'opacity 0.15s, border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <div style={{ padding: '0.625rem 0.75rem' }}>
        <div className="flex items-center justify-between" style={{ gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: TEXT_HI, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {card.nome}
          </span>
          {card.trem && (
            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: VLI_PRIMARY_TEXT, fontFamily: FONT, flexShrink: 0 }}>
              {card.trem}
            </span>
          )}
        </div>
        {card.resumo && (
          <div style={{ fontSize: '0.6875rem', color: TEXT_MD, fontFamily: FONT, marginBottom: '0.5rem' }}>{card.resumo}</div>
        )}
        <div className="flex items-center justify-between">
          <span
            style={{
              fontSize: '0.625rem',
              fontWeight: 700,
              color: statusEstilo.cor,
              backgroundColor: statusEstilo.bg,
              padding: '0.125rem 0.5rem',
              borderRadius: '62.4375rem',
              fontFamily: FONT,
              whiteSpace: 'nowrap',
            }}
          >
            {STATUS_LABEL[card.status]}
          </span>
          {card.tipo === 'bloco' && (
            <ChevronDown
              size="0.8125rem"
              color={TEXT_LO}
              style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            />
          )}
        </div>
      </div>

      {card.tipo === 'bloco' && expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '0.625rem 0.75rem 0.75rem', backgroundColor: SURFACE }} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: TEXT_LO, marginBottom: '0.375rem' }}>
            Vagões do Bloco
          </div>
          <div className="flex flex-wrap" style={{ gap: '0.25rem' }}>
            {composicao.map((item, i) => (
              <ChipVeiculo key={`${item.id}-${i}`} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Tela ─────────────────────────────
export function ManobrasPatioScreen() {
  const [cards, setCards] = useState<CardPatio[]>(CARDS_INICIAIS);
  const [busca, setBusca] = useState('');
  const [buscaSemResultado, setBuscaSemResultado] = useState(false);
  const [tremFiltro, setTremFiltro] = useState('todos');
  const [modoFiltro, setModoFiltro] = useState<ModoFiltroTrem>('destacar');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColuna, setDragOverColuna] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ cardId: string; fromColunaId: string; toColunaId: string } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const trensOptions = useMemo(
    () => [{ value: 'todos', label: 'Todos os trens' }, ...Object.keys(planosManobraMock).map((trem) => ({ value: trem, label: trem }))],
    [],
  );

  // Rola até o card encontrado pela busca (ou recém-movido) e apaga o destaque sozinho depois
  // de alguns segundos — mesmo princípio de "chamar atenção sem precisar de ação extra do
  // operador" do toast de sucesso usado em outras telas.
  useEffect(() => {
    if (!highlightId) return;
    cardRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    const timeout = setTimeout(() => setHighlightId(null), 2200);
    return () => clearTimeout(timeout);
  }, [highlightId]);

  function executarBusca() {
    const encontrado = cards.find((c) => cardCorrespondeQuery(c, busca));
    if (!encontrado) {
      setBuscaSemResultado(true);
      return;
    }
    setBuscaSemResultado(false);
    if (encontrado.tipo === 'bloco') setExpandedId(encontrado.id);
    setHighlightId(encontrado.id);
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, cardId: string) {
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(cardId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverColuna(null);
  }

  function handleDrop(colunaId: string) {
    setDragOverColuna(null);
    const cardId = draggingId;
    setDraggingId(null);
    if (!cardId) return;
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.colunaId === colunaId) return;
    // Nunca move de imediato — só abre a confirmação. O card continua fisicamente na coluna
    // original até "Confirmar"; cancelar não precisa de nenhuma lógica de "devolver", porque
    // ele nunca saiu de lá.
    setPendingMove({ cardId: card.id, fromColunaId: card.colunaId, toColunaId: colunaId });
  }

  function confirmarMovimentacao() {
    if (!pendingMove) return;
    setCards((prev) => prev.map((c) => (c.id === pendingMove.cardId ? { ...c, colunaId: pendingMove.toColunaId } : c)));
    setHighlightId(pendingMove.cardId);
    setPendingMove(null);
  }

  const colunaPorId = (id: string) => COLUNAS.find((c) => c.id === id);
  const cardPendente = pendingMove ? cards.find((c) => c.id === pendingMove.cardId) : undefined;
  const isolando = tremFiltro !== 'todos' && modoFiltro === 'isolar';
  const destacando = tremFiltro !== 'todos' && modoFiltro === 'destacar';

  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: BG_DEEP, fontFamily: FONT }}>
      <PageHeader>
        <div className="flex items-center" style={{ gap: '1rem', minWidth: 0, flex: 1 }}>
          <HeaderTitulo>Manobras do Pátio</HeaderTitulo>
          <HeaderDivider tall />

          <div
            className="flex items-center shrink-0"
            style={{ gap: '0.375rem', width: '14.375rem', height: '1.875rem', padding: '0 0.625rem', borderRadius: RADIUS, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}
          >
            <Search size="0.8125rem" color={TEXT_LO} style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setBuscaSemResultado(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') executarBusca(); }}
              placeholder="Buscar vagão ou série..."
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: TEXT_HI, fontSize: '0.6875rem', fontFamily: FONT }}
            />
          </div>
          {buscaSemResultado && (
            <span style={{ fontSize: '0.625rem', color: DANGER_TEXT, fontFamily: FONT, whiteSpace: 'nowrap', flexShrink: 0 }}>
              Nenhum vagão encontrado
            </span>
          )}

          <HeaderDivider tall />

          <div className="flex items-center shrink-0" style={{ gap: '0.5rem' }}>
            <span style={{ fontSize: '0.6875rem', color: TEXT_LO, fontFamily: FONT, whiteSpace: 'nowrap' }}>Filtrar por trem</span>
            <div style={{ width: '8.25rem' }}>
              <FiltroSelect value={tremFiltro} onChange={setTremFiltro} options={trensOptions} ariaLabel="Filtrar por trem" height={30} />
            </div>
            {tremFiltro !== 'todos' && <ModoFiltroToggle valor={modoFiltro} onChange={setModoFiltro} />}
          </div>
        </div>
      </PageHeader>

      <div className="flex" style={{ flex: 1, minHeight: 0, gap: '0.75rem', padding: '1rem', overflowX: 'auto', overflowY: 'hidden' }}>
        {COLUNAS.map((coluna) => {
          const cardsColuna = cards.filter((c) => c.colunaId === coluna.id);
          const cardsVisiveis = isolando ? cardsColuna.filter((c) => c.trem === tremFiltro) : cardsColuna;

          return (
            <div
              key={coluna.id}
              className="flex flex-col shrink-0"
              style={{
                width: COLUNA_W,
                height: '100%',
                backgroundColor: SURFACE,
                borderRadius: RADIUS,
                border: `1px solid ${dragOverColuna === coluna.id ? VLI_PRIMARY_TEXT : BORDER}`,
                overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOverColuna(coluna.id); }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragOverColuna((prev) => (prev === coluna.id ? null : prev));
              }}
              onDrop={(e) => { e.preventDefault(); handleDrop(coluna.id); }}
            >
              <div
                className="flex items-center justify-between shrink-0"
                style={{ gap: '0.375rem', padding: '0.625rem 0.75rem', borderBottom: `1px solid ${BORDER}` }}
              >
                <div className="flex items-center" style={{ gap: '0.375rem', minWidth: 0 }}>
                  {coluna.especial === 'manutencao' && <Wrench size="0.8125rem" color={TEXT_MD} style={{ flexShrink: 0 }} />}
                  {coluna.especial === 'abastecimento' && <Fuel size="0.8125rem" color={TEXT_MD} style={{ flexShrink: 0 }} />}
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: TEXT_HI, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {coluna.label}
                  </span>
                  {coluna.interditada && <AlertTriangle size="0.75rem" color={DANGER_TEXT} style={{ flexShrink: 0 }} />}
                </div>
                <span style={{ fontSize: '0.625rem', color: TEXT_LO, fontFamily: FONT, flexShrink: 0 }}>{cardsVisiveis.length}</span>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.625rem' }}>
                {cardsVisiveis.length === 0 ? (
                  <div style={{ fontSize: '0.6875rem', color: TEXT_LO, fontFamily: FONT, textAlign: 'center', padding: '1rem 0.25rem' }}>
                    {coluna.interditada ? 'Linha interditada' : 'Sem composições'}
                  </div>
                ) : (
                  cardsVisiveis.map((card) => (
                    <CardBoard
                      key={card.id}
                      card={card}
                      expanded={expandedId === card.id}
                      onToggleExpand={() => setExpandedId((prev) => (prev === card.id ? null : card.id))}
                      onDragStart={(e) => handleDragStart(e, card.id)}
                      onDragEnd={handleDragEnd}
                      dragging={draggingId === card.id}
                      esmaecido={destacando && card.trem !== tremFiltro}
                      highlighted={highlightId === card.id}
                      registerRef={(id, el) => { cardRefs.current[id] = el; }}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center shrink-0" style={{ gap: '1.25rem', padding: '0.625rem 1rem', borderTop: `1px solid ${BORDER}` }}>
        <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: TEXT_LO, fontFamily: FONT }}>
          Legenda
        </span>
        {(Object.keys(STATUS_LABEL) as StatusPatio[]).map((status) => (
          <div key={status} className="flex items-center" style={{ gap: '0.375rem' }}>
            <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', backgroundColor: STATUS_COR[status].cor }} />
            <span style={{ fontSize: '0.6875rem', color: TEXT_MD, fontFamily: FONT }}>{STATUS_LABEL[status]}</span>
          </div>
        ))}
      </div>

      <ConfirmarMovimentacaoModal
        isOpen={!!pendingMove}
        itemNome={cardPendente?.nome ?? ''}
        itemTrem={cardPendente?.trem}
        origemLabel={(pendingMove && colunaPorId(pendingMove.fromColunaId)?.label) ?? ''}
        destinoLabel={(pendingMove && colunaPorId(pendingMove.toColunaId)?.label) ?? ''}
        onConfirm={confirmarMovimentacao}
        onClose={() => setPendingMove(null)}
      />
    </div>
  );
}
