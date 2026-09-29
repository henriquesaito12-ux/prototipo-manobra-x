import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { TIPO_ETAPA_LABEL, type ClusterManobra, type EtapaManobra, type PlanoManobra } from '../data/planoManobra';
import { construirDestaqueEtapa, construirDestaqueRota, type DestaquePlano } from './PlanManobraX';
import { HeaderTooltip } from './PageHeader';

const PANEL_BG   = 'var(--vli-panel-bg)';
const BORDER     = 'var(--vli-border)';
const TEXT_HI    = 'var(--vli-text-hi)';
const TEXT_MD    = 'var(--vli-text-md)';
const TEXT_LO    = 'var(--vli-text-lo)';
const VLI_PRIMARY = 'var(--vli-primary-text)';
const HOVER_TINT = 'var(--vli-hover-tint)';
const FONT       = 'Manrope, sans-serif';

/** "Grupo N" já vem no início de `cluster.titulo` ("Grupo N — <descrição>") — MESMA extração de
 *  `prefixoGrupo` (`PlanManobraX.tsx`, `GrupoAccordionItem`), duplicada aqui por convenção (motor
 *  de navegação do mapa fica independente do painel esquerdo, só reaproveita os construtores de
 *  destaque puros — ver `construirDestaqueEtapa`/`construirDestaqueRota`). */
function prefixoGrupo(cluster: ClusterManobra): string {
  return cluster.titulo.split('—')[0].trim();
}

/** Constrói o destaque de UMA etapa pra navegação compacta do mapa — RETIRADA/INCLUSÃO usam
 *  `rotas`, não o cartão inteiro (ver `construirDestaqueEtapa`), então cai pra Rota 1 por padrão
 *  (a mais simples/sempre presente das duas) e só tenta a Rota 2 se a 1 não tiver dados
 *  suficientes. Etapas sem `rotas` (Parada/Corte/Clear/Fechamento) usam `construirDestaqueEtapa`
 *  direto. `null` quando a etapa não tem dados suficientes pro mapa em NENHUMA das tentativas.
 */
function construirDestaqueEtapaNavegacao(cluster: ClusterManobra, etapa: EtapaManobra) {
  if (etapa.rotas && etapa.rotas.length > 0) {
    return construirDestaqueRota(cluster, etapa, 0) ?? construirDestaqueRota(cluster, etapa, 1);
  }
  return construirDestaqueEtapa(cluster, etapa);
}

/** Dropdown flutuante compacto — MESMO chrome de `SeletorTremMapa` (`PlanejamentoScreen.tsx`),
 *  duplicado aqui de propósito (esses controles flutuantes sobre o canvas vivem em componentes
 *  independentes um do outro). Usado pros seletores de Bloco/Grupo. */
function SeletorFlutuante({
  value,
  opcoes,
  onChange,
  ariaLabel,
}: {
  value: string;
  opcoes: { id: string; label: string }[];
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className="flex items-center shrink-0"
        style={{
          gap: '0.25rem',
          height: '1.25rem',
          padding: '0 0.375rem',
          border: `1px solid ${BORDER}`,
          borderRadius: '0.25rem',
          backgroundColor: PANEL_BG,
          color: TEXT_HI,
          cursor: 'pointer',
          outline: 'none',
          boxShadow: 'var(--vli-shadow)',
          whiteSpace: 'nowrap',
          // `SelectPrimitive.Value` (Radix) ignora `style` custom no próprio elemento (só aplica
          // `pointer-events: none` internamente, descartando qualquer `style` passado a ele) —
          // a fonte precisa ser definida aqui no Trigger, herdada pelo texto do Value (mesmo bug
          // de `SeletorTremMapa`, `PlanejamentoScreen.tsx`, 2026-08-26).
          fontSize: '0.59375rem',
          fontWeight: 600,
          fontFamily: FONT,
        }}
        // Hover — MESMO padrão de `BotaoZoom` (`PlanejamentoScreen.tsx`) — 2026-08-27, pedido
        // explícito do usuário: "quando passar o mouse em bloco A, bloco B, deve ter um estado de
        // hover". Sem isso o chip flutuante não dava nenhum feedback visual de que era clicável.
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = VLI_PRIMARY; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
      >
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
            borderRadius: '0.375rem',
            boxShadow: 'var(--vli-shadow), 0 0.5rem 1.5rem rgba(0,0,0,0.25)',
            fontFamily: FONT,
            minWidth: '7.5rem',
            overflow: 'hidden',
          }}
        >
          <SelectPrimitive.Viewport style={{ padding: '0.25rem' }}>
            {opcoes.map((opcao) => (
              <SelectPrimitive.Item
                key={opcao.id}
                value={opcao.id}
                className="flex items-center justify-between"
                style={{ padding: '0.5rem 0.625rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 400, color: TEXT_HI, cursor: 'pointer', outline: 'none' }}
                onPointerEnter={(e) => { e.currentTarget.style.backgroundColor = HOVER_TINT; }}
                onPointerLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <SelectPrimitive.ItemText>{opcao.label}</SelectPrimitive.ItemText>
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

/**
 * Stepper compacto da Sequência de Manobra (as 6 etapas do Grupo selecionado) — anterior/próxima
 * + "N/total · Tipo" no meio, tudo num único chip flutuante (mesma altura/chrome dos outros
 * controles flutuantes do mapa).
 */
function StepperEtapas({
  etapas,
  indiceAtivo,
  onSelecionar,
}: {
  etapas: EtapaManobra[];
  indiceAtivo: number;
  onSelecionar: (indice: number) => void;
}) {
  const podeVoltar = indiceAtivo > 0;
  const podeAvancar = indiceAtivo < etapas.length - 1;
  const etapaAtiva = indiceAtivo >= 0 ? etapas[indiceAtivo] : undefined;
  return (
    <div
      className="flex items-center shrink-0"
      style={{
        gap: '0.1875rem',
        height: '1.25rem',
        padding: '0 0.3125rem',
        border: `1px solid ${BORDER}`,
        borderRadius: '0.25rem',
        backgroundColor: PANEL_BG,
        boxShadow: 'var(--vli-shadow)',
        whiteSpace: 'nowrap',
      }}
    >
      <HeaderTooltip label={"Etapa anterior"}><button
        type="button"
        onClick={() => onSelecionar(indiceAtivo - 1)}
        disabled={!podeVoltar}
       
        aria-label="Etapa anterior"
        className="flex items-center justify-center"
        style={{ width: '0.8125rem', height: '0.8125rem', border: 'none', background: 'none', padding: 0, color: podeVoltar ? TEXT_MD : TEXT_LO, opacity: podeVoltar ? 1 : 0.4, cursor: podeVoltar ? 'pointer' : 'default' }}
        // Hover só quando clicável — 2026-08-27, pedido explícito do usuário: hover nos
        // componentes do mapa (aqui, o stepper "N/total").
        onMouseEnter={(e) => { if (podeVoltar) e.currentTarget.style.color = VLI_PRIMARY; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = podeVoltar ? TEXT_MD : TEXT_LO; }}
      >
        <ChevronLeft size="0.6875rem" />
      </button></HeaderTooltip>
      <span style={{ fontSize: '0.59375rem', fontWeight: 600, color: TEXT_HI, fontFamily: FONT }}>
        {indiceAtivo + 1}/{etapas.length}
        {etapaAtiva ? ` · ${TIPO_ETAPA_LABEL[etapaAtiva.tipo]}` : ''}
      </span>
      <HeaderTooltip label={"Próxima etapa"}><button
        type="button"
        onClick={() => onSelecionar(indiceAtivo + 1)}
        disabled={!podeAvancar}
       
        aria-label="Próxima etapa"
        className="flex items-center justify-center"
        style={{ width: '0.8125rem', height: '0.8125rem', border: 'none', background: 'none', padding: 0, color: podeAvancar ? TEXT_MD : TEXT_LO, opacity: podeAvancar ? 1 : 0.4, cursor: podeAvancar ? 'pointer' : 'default' }}
        onMouseEnter={(e) => { if (podeAvancar) e.currentTarget.style.color = VLI_PRIMARY; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = podeAvancar ? TEXT_MD : TEXT_LO; }}
      >
        <ChevronRight size="0.6875rem" />
      </button></HeaderTooltip>
    </div>
  );
}

/**
 * Controle de navegação Bloco → Grupo → Etapa, flutuando sobre o canvas do mapa — MESMO
 * tratamento visual/posição dos outros controles flutuantes (`SeletorTremMapa`, canto superior
 * esquerdo, ver `ZoomableMapa`), não um painel empilhado abaixo do mapa (pedido explícito do
 * usuário, 2026-08-26: "esse componente [precisa ser] dentro do mapa (tipo o componente de zoom,
 * ou de selecionar trem)... pode ser ali os botõezinhos do lado do select do trem"). Reaproveita o
 * MESMO estado (`DestaquePlano`, `destaque`/`onDestaqueChange`) já usado pelo painel esquerdo
 * (`PlanManobraX`) — selecionar aqui chama o MESMO `onDestaqueChange` do ancestral comum
 * (`PlanejamentoScreen`), e o painel esquerdo, quando visível, reflete a mudança automaticamente.
 * A construção do objeto de destaque de cada etapa reaproveita `construirDestaqueEtapa`/
 * `construirDestaqueRota` (`PlanManobraX.tsx`) — MESMA lógica que o clique no painel esquerdo usa.
 */
export function MapaNavegacaoPainel({
  plano,
  destaque,
  onDestaqueChange,
}: {
  plano: PlanoManobra;
  destaque: DestaquePlano | null;
  onDestaqueChange: (next: DestaquePlano | null) => void;
}) {
  if (plano.blocos.length === 0) return null;

  const blocoSelecionado = plano.blocos.find((b) => b.id === destaque?.blocoId) ?? plano.blocos[0];
  const clusterSelecionado = blocoSelecionado.clusters.find((c) => c.id === destaque?.clusterId) ?? blocoSelecionado.clusters[0];
  const etapaAtivaId = destaque?.etapa?.etapaId;
  const indiceEtapaAtiva = clusterSelecionado ? clusterSelecionado.etapas.findIndex((e) => e.id === etapaAtivaId) : -1;

  function selecionarBloco(blocoId: string) {
    // Compara com o `destaque` REAL, não com `blocoSelecionado` (que pode ser só o fallback
    // exibido quando nada foi selecionado ainda) — senão selecionar o Bloco já mostrado como
    // "ativo" por fallback não teria efeito nenhum na primeira vez.
    if (blocoId === destaque?.blocoId) return;
    onDestaqueChange({ blocoId });
  }

  function selecionarGrupo(clusterId: string) {
    if (blocoSelecionado.id === destaque?.blocoId && clusterId === destaque?.clusterId) return;
    onDestaqueChange({ blocoId: blocoSelecionado.id, clusterId });
  }

  function selecionarEtapaPorIndice(indice: number) {
    if (!clusterSelecionado) return;
    const alvo = clusterSelecionado.etapas[indice];
    if (!alvo) return;
    const highlightEtapa = construirDestaqueEtapaNavegacao(clusterSelecionado, alvo);
    onDestaqueChange(
      highlightEtapa
        ? { blocoId: blocoSelecionado.id, clusterId: clusterSelecionado.id, etapa: highlightEtapa }
        : { blocoId: blocoSelecionado.id, clusterId: clusterSelecionado.id },
    );
  }

  return (
    <>
      {plano.blocos.length > 1 && (
        <SeletorFlutuante
          ariaLabel="Selecionar Bloco no mapa"
          value={blocoSelecionado.id}
          opcoes={plano.blocos.map((b) => ({ id: b.id, label: b.nome }))}
          onChange={selecionarBloco}
        />
      )}
      {blocoSelecionado.clusters.length > 0 && (
        <SeletorFlutuante
          ariaLabel="Selecionar Grupo no mapa"
          value={clusterSelecionado?.id ?? ''}
          opcoes={blocoSelecionado.clusters.map((c) => ({ id: c.id, label: prefixoGrupo(c) }))}
          onChange={selecionarGrupo}
        />
      )}
      {clusterSelecionado && clusterSelecionado.etapas.length > 0 && (
        <StepperEtapas etapas={clusterSelecionado.etapas} indiceAtivo={indiceEtapaAtiva} onSelecionar={selecionarEtapaPorIndice} />
      )}
    </>
  );
}
