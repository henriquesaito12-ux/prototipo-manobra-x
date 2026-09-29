import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { BookOpen, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { LINE_TYPE_LABELS } from './legendCatalog'
import { LINE_TYPE_STYLES, STATUS_OVERLAYS } from './train-yard/styles'
import { AmvJ105Marker, MarcaCorte, MarcoJ105Marker, estiloDe } from './train-yard/render/ComposicaoJ105Layer'
import type { PapelVeiculoJ105 } from '../../data/visualJ105'

// Legenda da Visão Topológica do J105 V2 — 2026-09-24, pedido explícito do usuário: a legenda
// genérica (`LegendChips`) listava itens que não aparecem neste mapa e era um controle de
// visibilidade (toggles + "Mostrar/Ocultar tudo"). Aqui é só referência, sem cliques, e cada
// símbolo é desenhado pelo MESMO componente/token que o mapa usa (não uma aproximação):
// - linhas: `LINE_TYPE_STYLES` (o mesmo de `Line.tsx`);
// - AMV, marco e corte: `AmvJ105Marker`, `MarcoJ105Marker`, `MarcaCorte` (`ComposicaoJ105Layer`);
// - veículos: `estiloDe` (a paleta da régua de vagões).
//
// Validação item a item do que ficou de fora: os marcadores de detalhe do pátio EHT (calço de
// metal, freio manual, rampa, batente, marco de km e o glyph genérico de AMV) começam desligados no
// filtro da legenda (`createEssentialLegendFilter`) e, sem os toggles, o J105 V2 usa esse filtro
// fixo (ver `PlanejamentoScreen.tsx`) — nunca aparecem no mapa, então não entram aqui. O item
// "Composição (trem/vagões)" também sai: no V2 não há composição genérica, o trem é a régua do
// `ComposicaoJ105V2Layer`, descrita pelas cores de veículo abaixo.
//
// Mesmo cabeçalho colapsável de `LegendChips` ("LEGENDA" + chevron), sem mudança de padrão.

/** Mesmo cinza claro do passo aberto na aba Manobras (`fundoAberto`, `PlanManobraX.tsx`). */
const FUNDO_ABERTA = 'color-mix(in srgb, var(--vli-surface) 60%, var(--vli-panel-bg))'

const ICONE_W = 26
const ICONE_H = 14

function IconeSvg({ children, viewBox = `0 0 ${ICONE_W} ${ICONE_H}` }: { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg width={ICONE_W} height={ICONE_H} viewBox={viewBox} aria-hidden="true" className="shrink-0">
      {children}
    </svg>
  )
}

/** Três blocos colados, como a régua de vagões desenha — mesma altura do bloco no mapa. */
function IconeVeiculo({ papel }: { papel: PapelVeiculoJ105 }) {
  const estilo = estiloDe(papel)
  const altura = 7
  const largura = 7
  return (
    <IconeSvg>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={2 + i * largura}
          y={(ICONE_H - altura) / 2}
          width={largura}
          height={altura}
          fill={estilo.preenchimento}
          stroke={estilo.contorno}
          strokeWidth={0.5}
        />
      ))}
    </IconeSvg>
  )
}

/** Trecho de faixa de linha como `Line.tsx` desenha: banda (preenchimento + borda, com o tracejado
 *  do tipo) e o trilho central fino por cima. */
function IconeLinha({ tipo, restrita = false }: { tipo: string; restrita?: boolean }) {
  const s = LINE_TYPE_STYLES[tipo]
  // `restrita`: a mesma faixa, recolorida como `Line.tsx` faz com o status "restrita".
  const o = STATUS_OVERLAYS.restrita
  const fill = restrita ? o.fill : s.fill
  const borda = restrita ? o.borderColor : s.border
  const altura = 6
  return (
    <IconeSvg>
      <rect x={1} y={ICONE_H / 2 - altura / 2} width={ICONE_W - 2} height={altura} fill={fill} stroke={borda} strokeWidth={1} strokeDasharray={s.dashArray} />
      <line x1={1} y1={ICONE_H / 2} x2={ICONE_W - 1} y2={ICONE_H / 2} stroke={borda} strokeWidth={0.5} strokeDasharray={s.centerRailDashArray} />
    </IconeSvg>
  )
}

function Item({ icone, label }: { icone: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center" style={{ gap: '0.375rem', minWidth: 0 }}>
      {icone}
      <span style={{ fontSize: '0.65625rem', color: 'var(--vli-text-md)', fontFamily: 'Manrope, sans-serif', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

export function LegendaJ105V2() {
  const [expandido, setExpandido] = useState(false)
  const cx = ICONE_W / 2
  const cy = ICONE_H / 2

  return (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      value={expandido ? 'legenda' : ''}
      onValueChange={(v) => setExpandido(v === 'legenda')}
      className="font-manrope"
      // Aberta, a legenda inteira (título + itens) fica no mesmo cinza claro do passo aberto na
      // aba Manobras (2026-09-24, pedido explícito do usuário, no lugar de um divisor). A margem
      // negativa lateral cancela o padding de 16px do container pai, pra o cinza encostar nas
      // bordas do painel. Embaixo não precisa: o pai (`TopologicalPanel` em `PlanejamentoScreen`)
      // já zera o padding inferior, então a legenda já encosta na borda de baixo.
      style={{
        margin: '0 -16px',
        backgroundColor: expandido ? FUNDO_ABERTA : 'transparent',
        transition: 'background-color 150ms ease',
      }}
    >
      <AccordionPrimitive.Item value="legenda">
        <AccordionPrimitive.Header>
          <AccordionPrimitive.Trigger
            className="vli-collapsible-trigger flex items-center justify-between gap-2 border-none cursor-pointer transition-colors"
            // Mesmo padding do trigger de `LegendChips`; a margem negativa agora está no Root.
            style={{ padding: '10px 14px', width: '100%', backgroundColor: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--vli-hover-tint)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <span className="flex items-center gap-1 shrink-0">
              <BookOpen size="0.8125rem" strokeWidth={2.25} className="text-vli-orange shrink-0" />
              <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--vli-text-lo)', fontFamily: 'Manrope, sans-serif', textTransform: 'uppercase', letterSpacing: '0.025em', whiteSpace: 'nowrap' }}>
                Legenda
              </span>
            </span>
            <ChevronDown size="0.875rem" color="var(--vli-text-lo)" className="vli-chevron shrink-0" />
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>

        <AccordionPrimitive.Content className="vli-collapsible-content">
          {/* Tudo numa lista corrida só, sem grupos (2026-09-24, pedido explícito do usuário: ocupa
              menos altura). Ordem: estrutura do pátio primeiro, depois a composição. */}
          <div className="flex flex-wrap items-center" style={{ gap: '0.5rem 1rem', padding: '0.25rem 14px 0.625rem' }}>
              <Item icone={<IconeLinha tipo="controle-patio" />} label={LINE_TYPE_LABELS['controle-patio']} />
              <Item icone={<IconeLinha tipo="controle-cco" />} label={LINE_TYPE_LABELS['controle-cco']} />
              <Item icone={<IconeLinha tipo="controle-patio" restrita />} label="Linha com restrição" />
              <Item
                icone={<IconeSvg><AmvJ105Marker x={cx} y={cy} ativo /></IconeSvg>}
                label="AMV (manipulação do travessão)"
              />
              <Item
                icone={<IconeSvg><MarcoJ105Marker x={cx} y={cy} /></IconeSvg>}
                label="Marco (ponto de parada)"
              />
              <Item icone={<IconeVeiculo papel="loco" />} label="Locomotiva" />
              <Item icone={<IconeVeiculo papel="vagao" />} label="Vagão" />
              <Item icone={<IconeVeiculo papel="retirado" />} label="Vagão retirado" />
              <Item icone={<IconeVeiculo papel="bom" />} label="Vagão adicionado" />
              <Item
                // Corte desenhado sobre um trecho curto de régua, como no mapa (vão + traço +
                // tesoura acima do bloco) — viewBox mais alto pra caber a tesoura.
                icone={
                  <IconeSvg viewBox={`0 -8 ${ICONE_W} 22`}>
                    <rect x={3} y={cy - 3.5} width={20} height={7} fill={estiloDe('vagao').preenchimento} stroke={estiloDe('vagao').contorno} strokeWidth={0.5} />
                    <MarcaCorte x={cx} y={cy} altura={7} />
                  </IconeSvg>
                }
                label="Corte"
              />
          </div>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    </AccordionPrimitive.Root>
  )
}
