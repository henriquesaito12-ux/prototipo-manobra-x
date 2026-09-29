// Catálogo de rótulos PT-BR da legenda — única fonte de verdade compartilhada entre o painel
// visual (`LegendPanel.tsx`) e o filtro que esconde/mostra elementos no mapa
// (`train-yard/filterTopology.ts`). Só as variantes com significado de domínio confirmado (fora
// `default`, que é o fallback neutro pra tipos desconhecidos, sem entrada de legenda própria).

export const LINE_TYPE_LABELS: Record<string, string> = {
  'controle-patio': 'Linha controle do pátio',
  'controle-cco': 'Linha controle do CCO',
  'bitola-metrica': 'Bitola métrica',
  'bitola-larga': 'Bitola larga',
  carga: 'Carga',
  passagem: 'Passagem',
  recebimento: 'Recebimento',
  cco: 'CCO (divisória)',
}

export const STATUS_LABELS: Record<string, string> = {
  interditada: 'Interditada',
}

// Kinds de `YardElement` que o operador pode querer ocultar do mapa — hoje só `composition`
// (trem/vagões parados numa linha); `marker`/`divider`/`label` não entram aqui porque `marker`
// já tem sua própria categoria (`MARKER_VARIANT_LABELS`) e `divider`/`label` são estrutura de
// layout, não informação operacional que faça sentido esconder.
export const ELEMENT_KIND_LABELS: Record<string, string> = {
  composition: 'Composição (trem/vagões)',
}

export const MARKER_VARIANT_LABELS: Record<string, string> = {
  'amv-manual': 'AMV manual',
  'amv-mola': 'AMV de mola',
  'calco-metal': 'Calço de metal',
  'calco-madeira': 'Calço de madeira',
  'freio-manual': 'Uso de freio manual',
  'secao-bloqueio': 'Seção de bloqueio (SB)',
  'limite-manobra': 'Limite de manobra (LM)',
  declividade: 'Rampa (declividade)',
  batente: 'Batente',
  'passagem-nivel': 'Passagem em nível',
  km: 'Marco de quilometragem',
  interdicao: 'Trecho interditado',
  eta: 'ETA prevista',
  cco: 'Referência CCO',
  abastecimento: 'Abastecimento',
}

/**
 * Variantes de marcador de "detalhe fino" — em trechos curtos, todas aparecendo ao mesmo tempo
 * poluem visualmente o mapa (calço, freio manual, rampa, AMV, km etc. se sobrepondo). Só ficam
 * visíveis a partir do zoom semântico (`ZOOM_SEMANTICO_LIMIAR`, em `PlanejamentoScreen.tsx`) —
 * abaixo do limiar, desaparecem com fade (ver `Marker.tsx`), mesmo que a categoria esteja ATIVA
 * na legenda (legenda e zoom são filtros independentes, um elemento só desenha com os dois a
 * favor). Fora desta lista (hoje: 'interdicao', 'eta') são sempre essenciais — desenham em
 * qualquer zoom, controlados só pela legenda, junto com linhas/composições/status "interditada"
 * (que nem passam por este filtro, não são `marker`).
 */
export const DETAIL_MARKER_VARIANTS = new Set<string>([
  'amv-manual',
  'amv-mola',
  'calco-metal',
  'calco-madeira',
  'freio-manual',
  'secao-bloqueio',
  'limite-manobra',
  'declividade',
  'batente',
  'passagem-nivel',
  'km',
  'cco',
  'abastecimento',
])
