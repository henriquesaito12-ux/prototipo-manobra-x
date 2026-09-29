import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { AlertTriangle, ChevronDown } from 'lucide-react';

const DANGER_FG  = 'var(--vli-danger-text)';
const PANEL_BG   = 'var(--vli-panel-bg)';
const BORDER     = 'var(--vli-border)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
const HOVER_TINT = 'var(--vli-hover-tint)';
const FONT       = 'Manrope, sans-serif';
const RADIUS     = '0.375rem';

export interface Restricao {
  descricao: string;
}

const RESTRICOES_PADRAO: Restricao[] = [
  { descricao: 'Proibido retirar jumper (Fluxo Minério).' },
  { descricao: 'Pátio Norte com capacidade reduzida (manutenção).' },
  { descricao: 'Cruzamento km 42 bloqueado até 22h.' },
  { descricao: 'Velocidade máxima 20km/h no trecho Serra.' },
  { descricao: 'Linha L7 interditada para testes de sinalização.' },
];

/**
 * Colapsada por padrão — só o cabeçalho com a contagem de restrições (1 linha). Clicar expande
 * a lista completa; não tem mais botão de "expandir" separado (nem modal de tabela) — o próprio
 * cabeçalho é o colapse. Usa `AccordionPrimitive` (Radix) com as MESMAS classes CSS do colapse
 * de Bloco/Grupo (`vli-collapsible-trigger`/`vli-collapsible-content`/`vli-chevron`, em
 * `theme.css`) — mesma animação de altura+opacidade (250ms ease-in-out), sem CSS novo.
 * Estado de expandido/colapsado é controlado pelo pai (`MapaSidePanel`), não local — a Legenda
 * (`LegendChips.tsx`) precisa saber se este painel está aberto pra decidir se limita a própria
 * altura (só precisa rolar quando os dois estão abertos ao mesmo tempo, ver `LegendChips`).
 */
function RestrictionsList({
  style,
  expandido,
  onExpandidoChange,
  restrictions,
}: {
  style?: React.CSSProperties;
  expandido: boolean;
  onExpandidoChange: (v: boolean) => void;
  restrictions: Restricao[];
}) {
  return (
    <div
      className="flex flex-col"
      style={{ backgroundColor: PANEL_BG, borderRadius: RADIUS, overflow: 'hidden', fontFamily: FONT, boxShadow: 'var(--vli-shadow)', ...style }}
    >
      <AccordionPrimitive.Root
        type="single"
        collapsible
        value={expandido ? 'restricoes' : ''}
        onValueChange={(v) => onExpandidoChange(v === 'restricoes')}
      >
        <AccordionPrimitive.Item value="restricoes">
          <AccordionPrimitive.Header>
            <AccordionPrimitive.Trigger
              className="vli-collapsible-trigger flex items-center justify-between w-full transition-colors"
              style={{
                gap: '0.5rem',
                borderBottom: expandido ? `1px solid ${BORDER}` : 'none',
                padding: '0.625rem 0.875rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
              }}
              // 2026-08-27, pedido explícito do usuário: hover também "na LEGENDA e Restrições
              // Ativas".
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = HOVER_TINT; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <div className="flex items-center" style={{ gap: '0.5rem', minWidth: 0 }}>
                <AlertTriangle size="0.8125rem" color={DANGER_FG} strokeWidth={2.5} />
                <span style={{ color: TEXT_LO, fontSize: '0.625rem', fontWeight: 700, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.025em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Restrições Ativas
                </span>
                <span style={{ color: TEXT_LO, fontSize: '0.6875rem', fontFamily: FONT, whiteSpace: 'nowrap' }}>
                  ({restrictions.length})
                </span>
              </div>
              <ChevronDown size="0.875rem" color={TEXT_MD} className="vli-chevron" style={{ flexShrink: 0 }} />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>

          <AccordionPrimitive.Content className="vli-collapsible-content">
            {/* `maxHeight` cabe ~3 restrições — com mais que isso, rola por dentro em vez de
               crescer sem limite. Isso é o que garante que o mapa (que fica ACIMA deste painel,
               com `flex: 1`) nunca seja espremido até sumir quando a lista de restrições for
               longa; sem esse teto, o painel de restrições cresce pra caber tudo e consome todo
               o espaço vertical disponível, tirando a altura do mapa. */}
            <div className="flex flex-col" style={{ overflowY: 'auto', maxHeight: '11rem' }}>
              {restrictions.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start"
                  style={{
                    gap: '0.625rem',
                    padding: '0.625rem 0.875rem',
                    borderBottom: i < restrictions.length - 1 ? `1px solid ${BORDER}` : 'none',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = HOVER_TINT; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span style={{ color: TEXT_MD, fontSize: '0.75rem', fontFamily: FONT, lineHeight: 1.5 }}>
                    {r.descricao}
                  </span>
                </div>
              ))}
            </div>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      </AccordionPrimitive.Root>
    </div>
  );
}

export function RestrictionsPanel({
  style,
  expandido,
  onExpandidoChange,
  restricoes = RESTRICOES_PADRAO,
}: {
  style?: React.CSSProperties;
  expandido: boolean;
  onExpandidoChange: (v: boolean) => void;
  /** Lista a exibir; ausente = a lista padrão de sempre. Hoje só o J105 V2 passa a própria
   *  (`PlanejamentoScreen.tsx`). */
  restricoes?: Restricao[];
}) {
  return <RestrictionsList style={style} expandido={expandido} onExpandidoChange={onExpandidoChange} restrictions={restricoes} />;
}
