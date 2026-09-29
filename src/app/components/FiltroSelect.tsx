import { useState } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

const PANEL_BG   = 'var(--vli-panel-bg)';
const SURFACE    = 'var(--vli-surface)';
const BORDER     = 'var(--vli-border)';
const TEXT_HI    = 'var(--vli-text-hi)';
const TEXT_LO    = 'var(--vli-text-lo)';
// Só usado como borda/ícone sobre fundo escuro neste componente — pode usar a variante mais
// clara direto.
const VLI_PRIMARY = 'var(--vli-primary-text)';
const HOVER_TINT = 'var(--vli-hover-tint)';
const FONT       = 'Manrope, sans-serif';
const RADIUS     = '0.5rem';

export interface FiltroSelectOption {
  value: string;
  label: string;
}

interface FiltroSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FiltroSelectOption[];
  ariaLabel?: string;
  /** Altura do campo fechado — default 34 (usado nos filtros da lateral); telas com linhas
   *  mais densas (ex.: uma tabela) podem passar um valor menor. */
  height?: number;
  /** Cor do valor exibido no campo fechado — default TEXT_HI. Útil quando o próprio valor
   *  carrega significado (ex.: criticidade Baixa/Média/Alta com cores diferentes). */
  valueColor?: string;
  valueWeight?: number;
  /** Aparência do campo fechado — 'chip' (default) é o estilo usado nos filtros/painéis da
   *  tela (fundo `--vli-surface`, raio maior, realce de borda no hover/aberto). 'field' usa a
   *  mesma borda/fundo/raio/padding dos outros campos de formulário (`inputStyle` dos modais de
   *  Criar/Importar Ficha, `DataPickerField`) — para o Pátio ficar visualmente igual ao resto do
   *  formulário em vez de parecer um filtro de tela. */
  variant?: 'chip' | 'field';
}

export function FiltroSelect({ value, onChange, options, ariaLabel, height = 34, valueColor, valueWeight, variant = 'chip' }: FiltroSelectProps) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const destacado = variant === 'chip' && (open || hover);
  const isField = variant === 'field';

  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange} onOpenChange={setOpen}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className="flex items-center justify-between"
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        style={{
          width: '100%',
          minWidth: 0,
          height: isField ? undefined : `${height / 16}rem`,
          padding: isField ? '0.4375rem 0.5625rem' : '0 0.5rem 0 0.625rem',
          borderRadius: isField ? '0.25rem' : RADIUS,
          border: `1px solid ${destacado ? VLI_PRIMARY : BORDER}`,
          backgroundColor: isField ? PANEL_BG : SURFACE,
          color: valueColor ?? TEXT_HI,
          fontSize: '0.75rem',
          fontWeight: isField ? 400 : (valueWeight ?? 500),
          fontFamily: FONT,
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 0.15s',
        }}
      >
        <SelectPrimitive.Value style={{ display: 'block', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} />
        <SelectPrimitive.Icon style={{ display: 'flex', flexShrink: 0, marginLeft: '0.375rem' }}>
          <ChevronDown size="0.8125rem" color={TEXT_LO} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          // Precisa vencer o `zIndex: 200` das modais que usam este select (Criar/Importar
          // Ficha) — mesmo problema e mesmo valor do popover de data em `DataPickerField`
          // (`PageHeader.tsx`): o `z-50` do Tailwind (50) não bastava, o dropdown renderizava
          // atrás da própria modal, com as opções ali mas invisíveis.
          style={{
            zIndex: 400,
            backgroundColor: PANEL_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: RADIUS,
            boxShadow: 'var(--vli-shadow), 0 0.5rem 1.5rem rgba(0,0,0,0.25)',
            fontFamily: FONT,
            width: 'var(--radix-select-trigger-width)',
            minWidth: '10.625rem',
            overflow: 'hidden',
          }}
        >
          <SelectPrimitive.Viewport style={{ padding: '0.25rem' }}>
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className="flex items-center justify-between"
                style={{
                  padding: '0.5rem 0.625rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  color: TEXT_HI,
                  cursor: 'pointer',
                  outline: 'none',
                }}
                onPointerEnter={(e) => { e.currentTarget.style.backgroundColor = HOVER_TINT; }}
                onPointerLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <SelectPrimitive.ItemText>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{opt.label}</span>
                </SelectPrimitive.ItemText>
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
