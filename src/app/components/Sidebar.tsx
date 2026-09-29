import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ClipboardCheck, Map, Radio, Settings, ChevronLeft, ChevronRight, ChevronDown, Sun, Moon, LogOut, User } from 'lucide-react';
import LogoVliDark from '../../imports/logo_darkmode.png';
import LogoVliLight from '../../imports/logo_lightmode.png';
import LogoManobraXDark from '../../imports/manobrax_darkmode.png';
import LogoManobraXLight from '../../imports/manobrax_lightmode.png';
import { useTheme } from '../ThemeContext';
import { HeaderTooltip } from './PageHeader';

const VLI_ORANGE = 'var(--vli-accent)';
const VLI_PRIMARY_TEXT = 'var(--vli-primary-text)';
const SIDEBAR_BG = 'var(--vli-sidebar-bg)';
const SIDEBAR_SHADOW = 'var(--vli-sidebar-shadow)';
const BORDER     = 'var(--vli-border)';
const TEXT_HI    = 'var(--vli-text-hi)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
const HOVER_TINT = 'var(--vli-hover-tint)';
const FONT       = 'Manrope, sans-serif';
const RADIUS     = '0.375rem';
const WIDTH_EXPANDED  = '14rem';
const WIDTH_COLLAPSED = '4.25rem';

export type Screen = 'ficha' | 'planejamento' | 'execucao';

type NavItem = { id: Screen; label: string; icon: typeof Map; disabled?: boolean };

const ITEMS: NavItem[] = [
  { id: 'ficha', label: 'Ficha Operacional', icon: ClipboardCheck },
  { id: 'planejamento', label: 'Planejamento', icon: Map },
  { id: 'execucao', label: 'Execução Ao Vivo', icon: Radio, disabled: true },
];

interface SidebarProps {
  screen: Screen;
  onNavigate: (s: Screen) => void;
  pendentesFicha?: number;
}

export function Sidebar({ screen, onNavigate, pendentesFicha = 0 }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [menuUsuarioAberto, setMenuUsuarioAberto] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const width = collapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED;
  const logoVli = theme === 'dark' ? LogoVliDark : LogoVliLight;
  const logoManobraX = theme === 'dark' ? LogoManobraXDark : LogoManobraXLight;

  return (
    <div
      className="flex flex-col shrink-0 no-print relative"
      style={{
        width,
        backgroundColor: SIDEBAR_BG,
        borderRight: `1px solid ${BORDER}`,
        boxShadow: SIDEBAR_SHADOW,
        fontFamily: FONT,
        // 2026-08-28, pedido explícito do usuário: "deixe a animação de reduzir o menu fluido
        // igual do abrir filtro" — mesma duração/curva da `SidebarFiltros`
        // (`FichaOperacaoScreen.tsx`, `ease-in-out` ~280ms), só que no `width` (não
        // `flex-basis`, esse painel não vive num flex row com irmão pra "empurrar"). Chegou a
        // levar um leve bounce (`cubic-bezier` com overshoot) no mesmo pedido, mas o usuário
        // achou estranho ao testar ("remova o bouncing") — voltou pro `ease-in-out` reto. O
        // botão circular de toggle (`position:absolute`, `right:-11` relativo à borda direita do
        // próprio menu) já acompanha o width de graça — não precisa de transition própria.
        transition: 'width 280ms ease-in-out',
        overflow: 'visible',
      }}
    >
      <button
        onClick={() => setCollapsed((prev) => !prev)}
        aria-label={collapsed ? 'Expandir menu' : 'Retrair menu'}
        className="flex items-center justify-center"
        style={{
          position: 'absolute',
          top: '2.125rem',
          right: '-0.6875rem',
          width: '1.375rem',
          height: '1.375rem',
          borderRadius: '50%',
          border: `1px solid ${BORDER}`,
          backgroundColor: SIDEBAR_BG,
          color: TEXT_LO,
          cursor: 'pointer',
          zIndex: 20,
          boxShadow: 'var(--vli-shadow), 0 0.0625rem 0.1875rem rgba(0,0,0,0.2)',
          transition: 'color 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_HI; e.currentTarget.style.borderColor = TEXT_LO; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_LO; e.currentTarget.style.borderColor = BORDER; }}
      >
        {collapsed ? <ChevronRight size="0.8125rem" /> : <ChevronLeft size="0.8125rem" />}
      </button>

      <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Marca */}
        <div
          className="flex items-center shrink-0"
          style={{ height: '3rem', padding: collapsed ? '0 0.75rem' : '0 1rem', borderBottom: `1px solid ${BORDER}` }}
        >
          <div className="flex items-center" style={{ gap: '0.625rem', minWidth: 0 }}>
            <img src={logoVli} alt="VLI" style={{ height: '1.25rem', flexShrink: 0 }} />
            {!collapsed && (
              <>
                <div style={{ width: 1, height: '1.25rem', backgroundColor: BORDER, flexShrink: 0 }} />
                <img src={logoManobraX} alt="Manobra X" style={{ height: '1.375rem', flexShrink: 0 }} />
              </>
            )}
          </div>
        </div>

        <nav className="flex flex-col" style={{ padding: '0.75rem', gap: '0.125rem', flex: 1 }}>
          {ITEMS.map((item) => {
            const { id, label, icon: Icon, disabled } = item;
            const active = screen === id;
            return (
              <HeaderTooltip key={id} label={collapsed ? label : undefined}><button
               
                onClick={() => { if (!disabled) onNavigate(id); }}
                disabled={disabled}
               
                className="flex items-center"
                style={{
                  gap: '0.625rem',
                  height: '2.375rem',
                  padding: collapsed ? 0 : '0 0.625rem',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  border: 'none',
                  borderRadius: RADIUS,
                  fontFamily: FONT,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  textAlign: 'left',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  backgroundColor: active ? 'var(--vli-active-bg)' : 'transparent',
                  color: disabled ? TEXT_LO : (active ? VLI_PRIMARY_TEXT : TEXT_MD),
                  opacity: disabled ? 0.5 : 1,
                  transition: 'background-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.backgroundColor = HOVER_TINT; }}
                onMouseLeave={(e) => { if (!active && !disabled) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
                  <Icon size="1rem" strokeWidth={2.25} />
                  {collapsed && id === 'ficha' && pendentesFicha > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-0.25rem',
                        right: '-0.375rem',
                        width: '0.4375rem',
                        height: '0.4375rem',
                        borderRadius: '50%',
                        backgroundColor: VLI_ORANGE,
                      }}
                    />
                  )}
                </div>
                {!collapsed && (
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', flex: 1 }}>{label}</span>
                )}
                {!collapsed && id === 'ficha' && pendentesFicha > 0 && (
                  <span
                    style={{
                      flexShrink: 0,
                      minWidth: '1.125rem',
                      height: '1.125rem',
                      padding: '0 0.3125rem',
                      borderRadius: '62.4375rem',
                      backgroundColor: VLI_ORANGE,
                      color: '#fff',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {pendentesFicha}
                  </span>
                )}
              </button></HeaderTooltip>
            );
          })}
        </nav>
      </div>

      {/* usuário */}
      <div className="flex flex-col shrink-0" style={{ borderTop: `1px solid ${BORDER}`, padding: '0.75rem', gap: '0.125rem' }}>
        <DropdownMenu.Root open={menuUsuarioAberto} onOpenChange={setMenuUsuarioAberto}>
          <DropdownMenu.Trigger asChild>
            <button
              className="flex items-center"
              style={{
                gap: '0.625rem',
                width: '100%',
                padding: collapsed ? '0.375rem 0' : '0.375rem 0.625rem',
                justifyContent: collapsed ? 'center' : 'flex-start',
                border: 'none',
                borderRadius: RADIUS,
                background: 'transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = HOVER_TINT; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <div
                style={{
                  width: '1.25rem',
                  height: '1.25rem',
                  borderRadius: '50%',
                  backgroundColor: 'var(--vli-text-lo)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.5625rem',
                  fontWeight: 700,
                  color: '#fff',
                  fontFamily: FONT,
                  flexShrink: 0,
                }}
              >
                CE
              </div>
              {!collapsed && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', minWidth: 0 }}>
                  <span style={{ color: TEXT_HI, fontSize: '0.6875rem', fontFamily: FONT, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Carlos Eduardo
                  </span>
                  {/* Menu abre pra cima: seta aponta pra cima quando aberto, gira de volta ao fechar. */}
                  <ChevronDown
                    size="0.75rem"
                    strokeWidth={2.25}
                    color={TEXT_MD}
                    style={{ flexShrink: 0, transform: menuUsuarioAberto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease-in-out' }}
                  />
                </span>
              )}
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="top"
              align="start"
              sideOffset={8}
              style={{
                backgroundColor: 'var(--vli-panel-bg)',
                border: `1px solid ${BORDER}`,
                borderRadius: RADIUS,
                padding: '0.375rem',
                minWidth: '10.5rem',
                boxShadow: 'var(--vli-shadow)',
                fontFamily: FONT,
                zIndex: 300,
              }}
            >
              <DropdownMenu.Item
                disabled
                onSelect={() => {}}
                className="flex items-center"
                style={{
                  gap: '0.625rem',
                  padding: '0.5625rem 0.625rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: TEXT_LO,
                  opacity: 0.5,
                  cursor: 'not-allowed',
                  outline: 'none',
                }}
              >
                <Settings size="0.875rem" strokeWidth={2.25} />
                Configurações
              </DropdownMenu.Item>

              <DropdownMenu.Separator style={{ height: 1, backgroundColor: BORDER, margin: '0.375rem 0.125rem' }} />

              <DropdownMenu.Item
                onSelect={toggleTheme}
                className="flex items-center"
                style={{
                  gap: '0.625rem',
                  padding: '0.5625rem 0.625rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: TEXT_HI,
                  cursor: 'pointer',
                  outline: 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = HOVER_TINT; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {theme === 'dark' ? <Sun size="0.875rem" strokeWidth={2.25} /> : <Moon size="0.875rem" strokeWidth={2.25} />}
                {theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
              </DropdownMenu.Item>

              <DropdownMenu.Separator style={{ height: 1, backgroundColor: BORDER, margin: '0.375rem 0.125rem' }} />

              <DropdownMenu.Item
                onSelect={() => {}}
                className="flex items-center"
                style={{
                  gap: '0.625rem',
                  padding: '0.5625rem 0.625rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: TEXT_MD,
                  cursor: 'pointer',
                  outline: 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = HOVER_TINT; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <LogOut size="0.875rem" strokeWidth={2.25} />
                Sair
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
