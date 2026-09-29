// Plano de Manobra do trem J105 — ÚNICO trem cujo Plano de Manobra impresso/de origem (v3, 38
// etapas, `J105/plano-manobra-j105-v3.html` + imagens de referência `J105/passo-*.jpg`, fora do
// código-fonte) já vem como uma SEQUÊNCIA LINEAR de passos operacionais (Passo N — ação +
// Agentes + instrução completa), não como o formato Bloco → Grupo → 6 etapas (Parada/Corte/
// Clear/Retirada/Inclusão/Fechamento) dos demais trens. Por isso este arquivo é isolado dos
// outros trens do mock (`planoManobra.ts`): cada um dos 38 passos vira seu próprio Cluster de 1
// única Etapa `PARADA` (o único tipo de etapa com destaque no mapa autocontido, sem depender de
// outra etapa do mesmo Cluster — ver `construirDestaqueEtapa`, `PlanManobraX.tsx`), preservando o
// MESMO mecanismo de sincronização clique→Visão Topológica já usado pelos outros trens, sem
// nenhuma alteração nele. `EtapaManobra.agentes`/`instrucaoCompleta` (campos opcionais,
// adicionados em `planoManobra.ts`) carregam o conteúdo específico do card de passo do J105; os
// demais trens nunca os preenchem.
//
// Numeração dos passos pelo TEXTO renderizado nas imagens de referência (título "Passo N — ..."),
// cruzado com o plano v3 (HTML) quando o rótulo "Passo N" da própria imagem também estava
// desatualizado (arrastado da v2, 52 etapas) — nunca pelo nome do arquivo da imagem.
//
// linha/direção/AMV/posição (`apoio`) alimentam a MESMA Visão Topológica Atual que os outros
// trens — derivados dos diagramas de referência de cada imagem. `apoio.linha` usa o NOME da linha
// tal como `resolveLineIdByNome` (`train-yard/etapaParada.ts`) resolve contra o pátio EHT (mesma
// convenção "Desvio" já usada por todos os outros trens do mock, nunca um id curto como "L2"):
// "L Desvio" do plano → "Desvio"; "L3"/"LN3" (mesma linha; "LN3" é só a nomenclatura do plano de
// manobra para a Linha 3) → "Linha 3". Não há posição em metros nas fontes (só referências
// qualitativas como "marco do Travessão 2"/"posição 78") — os valores de `distanciaM` abaixo são
// estimativas plausíveis dentro do comprimento real de cada linha, o suficiente para o marcador
// aparecer no trecho correto; não representam medição de campo.

import type { ClusterManobra, EtapaManobra, ItemComposicao, PlanoManobra } from './planoManobra';

/** Vagões "de passagem" (sem problema, sem etapa própria) — mesma técnica de preenchimento já
 *  usada para os demais trens (`vagoesDePassagem`, `planoManobra.ts`), duplicada aqui em pequeno
 *  para não precisar exportar aquela função interna. */
function vagoesPassagemJ105(inicio: number, quantidade: number): ItemComposicao[] {
  return Array.from({ length: quantidade }, (_, i) => ({ id: `${inicio + i}-${i % 10}`, tipo: 'vagao' as const }));
}

interface PassoJ105 {
  numero: number;
  titulo: string;
  agentes: string[];
  procedimento: string;
  // Precisa bater com `resolveLineIdByNome` (`train-yard/etapaParada.ts`): o rótulo da linha no
  // pátio EHT, já sem prefixo "L "/sufixo "(NNN m)" — "Desvio" (L2) e "Linha 3" (L3), mesma
  // convenção "Desvio" já usada por todos os outros trens do mock (nenhum usa código curto tipo
  // "L2" — resolvido contra o NOME, nunca o id interno).
  linha: 'Desvio' | 'Linha 3';
  referencia?: string;
  direcao?: string;
  distanciaM: number;
}

const PASSOS_J105: PassoJ105[] = [
  { numero: 1, titulo: 'Entrada do trem no pátio', agentes: ['Maquinista de viagem', 'CCO', 'Operador de manobra'], procedimento: 'Com licença de circulação vigente, o maquinista conduz o J105 pela Linha do Desvio em EHT. O operador de manobra acompanha a entrada e orienta, por rádio, o ponto de parada necessário para iniciar a manobra.', linha: 'Desvio', distanciaM: 560 },
  { numero: 2, titulo: 'Trem para no marco do Travessão 2', agentes: ['Maquinista de viagem', 'Operador de manobra'], procedimento: 'O operador controla a aproximação e solicita a parada no marco do Travessão 2. O maquinista imobiliza a composição no ponto indicado e mantém comunicação por rádio para receber a sequência da operação.', linha: 'Desvio', referencia: 'T2', distanciaM: 651 },
  { numero: 3, titulo: 'Corte da locomotiva líder do J105', agentes: ['Maquinista de viagem', 'Operador de manobra'], procedimento: 'O operador solicita autorização para realizar o corte da locomotiva líder. O maquinista centraliza a reversora, aplica o freio da composição e, devido ao corte ocorrer antes dos blocos distribuídos, coloca os blocos B e C em modo de espera. Após autorização, o operador fecha as torneiras do encanamento geral entre locomotiva e primeiro vagão, solicita o teste de resistência, acompanha o recuo com os freios aplicados, confirma o teste, aciona a haste de desengate e solicita que a locomotiva puxe sentido EDV para efetivar o corte.', linha: 'Desvio', referencia: 'T2', direcao: 'EDV', distanciaM: 651 },
  { numero: 4, titulo: 'Locomotiva circula até livrar o AMV do Travessão 2', agentes: ['Maquinista de viagem', 'Operador de manobra'], procedimento: 'O maquinista conduz a locomotiva sentido EDV até que o operador confirme visualmente que o engate ultrapassou em pelo menos 10 metros o AMV do Travessão 2. A locomotiva deve permanecer parada enquanto o AMV é manipulado.', linha: 'Desvio', referencia: 'T2', direcao: 'EDV', distanciaM: 690 },
  { numero: 5, titulo: 'Manipulação do AMV do Travessão 2 para acesso à LN3', agentes: ['Operador de manobra'], procedimento: 'O operador comunica a manipulação, caminha em segurança até o AMV, destranca o cadeado, aciona o macaquinho para liberar a maromba, posiciona o AMV para a rota LN3, trava a maromba e o macaquinho, recoloca o cadeado, executa a conferência visual da vedação da ponta da agulha e informa por rádio ao maquinista a condição e a rota do AMV.', linha: 'Desvio', referencia: 'T2', distanciaM: 651 },
  { numero: 6, titulo: 'Locomotiva recua da Linha do Desvio para a LN3 e engata no vagão bom', agentes: ['Maquinista de viagem', 'Operador de manobra'], procedimento: 'Com a rota confirmada, o operador autoriza e acompanha o recuo por rádio. O operador informa progressivamente a distância em referências de vagões e, na aproximação final, em metros. Após o contato dos engates, solicita uma puxada curta para confirmar o engate. Confirmado o engate, solicita autorização para passar o ar, conecta as mangueiras do encanamento geral e abre as torneiras.', linha: 'Linha 3', referencia: 'T2', distanciaM: 537 },
  { numero: 7, titulo: 'Corte do vagão bom estacionado na LN3', agentes: ['Maquinista de viagem', 'Operador de manobra'], procedimento: 'O vagão bom é o veículo liberado pela manutenção e identificado com quadro de estado AG Tração no Unilog. O operador solicita o posicionamento e a autorização para o corte na LN3. O maquinista centraliza a reversora e aplica o freio. O operador fecha as torneiras do encanamento geral no ponto definido, solicita e acompanha o teste de resistência, aciona a haste de desengate e confirma a separação do vagão bom dos demais veículos estacionados.', linha: 'Linha 3', distanciaM: 500 },
  { numero: 8, titulo: 'Locomotiva com o vagão bom puxa sentido EDV até livrar o AMV', agentes: ['Maquinista de viagem', 'Operador de manobra'], procedimento: 'O maquinista puxa a locomotiva e o vagão bom sentido EDV. O operador acompanha e confirma quando o engate do último veículo ultrapassar 10 metros além do AMV do Travessão 2.', linha: 'Linha 3', referencia: 'T2', direcao: 'EDV', distanciaM: 537 },
  { numero: 9, titulo: 'Manipulação do AMV do Travessão 2 da LN3 para a Linha do Desvio', agentes: ['Operador de manobra'], procedimento: 'Após confirmar o AMV livre, o operador executa a sequência completa de destravamento, mudança de rota, travamento, recolocação do cadeado e conferência da vedação da agulha. Em seguida, informa por rádio que a rota está estabelecida para a Linha do Desvio.', linha: 'Linha 3', referencia: 'T2', distanciaM: 537 },
  { numero: 10, titulo: 'Locomotiva com o vagão bom recua e engata no J105', agentes: ['Maquinista', 'Operador de manobra'], procedimento: 'Com o AMV confirmado para o Desvio, o operador acompanha o recuo da locomotiva e do vagão bom até a composição do J105, informando distâncias por rádio. Após o contato dos engates, solicita puxada para confirmação. Confirmado o engate, solicita autorização para passar o ar, conecta as mangueiras e abre as torneiras do encanamento geral.', linha: 'Desvio', referencia: 'T2', distanciaM: 651 },
  { numero: 11, titulo: 'J105 puxa 10 vagões para iniciar a retirada das posições 9 e 10', agentes: ['Maquinista do J105', 'Operador de manobra'], procedimento: 'O maquinista puxa a locomotiva líder, o vagão bom recém-anexado e os nove primeiros vagões da formação original. O objetivo é executar a volta de manobra destinada a retirar os vagões avariados das posições originais 9 e 10: HFE 705327-4 e HFE 705328-2.', linha: 'Desvio', referencia: 'Pos. 9/10', distanciaM: 500 },
  { numero: 12, titulo: 'Corte dos dois vagões avariados das posições 9 e 10', agentes: ['Maquinista do J105', 'Operador de manobra'], procedimento: 'O operador solicita o posicionamento no ponto de corte e pede autorização. O maquinista centraliza a reversora, aplica o freio e mantém os blocos B e C no estado requerido para um corte antes desses blocos. O operador fecha as torneiras do encanamento geral, solicita o teste de resistência, confirma o resultado, aciona a haste de desengate e orienta a separação dos dois vagões avariados.', linha: 'Desvio', referencia: 'Pos. 9/10', distanciaM: 500 },
  { numero: 13, titulo: 'Loco líder puxa 11 vagões sentido EDV até livrar o AMV', agentes: ['Maquinista do J105', 'Operador de manobra'], procedimento: 'O conjunto formado pela locomotiva líder, pelo vagão bom e pelos vagões posicionados à frente do ponto de corte puxa sentido EDV/Divinópolis. O operador confirma quando o engate do último veículo ultrapassar 10 metros além do AMV do Travessão 2.', linha: 'Desvio', referencia: 'T2', direcao: 'EDV', distanciaM: 651 },
  { numero: 14, titulo: 'Manipulação do AMV para acesso à LN3', agentes: ['Operador de manobra'], procedimento: 'O operador executa a manipulação completa do AMV do Travessão 2 para estabelecer a rota da Linha do Desvio para a LN3. Confere travamento, cadeado e vedação da agulha e comunica por rádio a rota estabelecida.', linha: 'Desvio', referencia: 'T2', distanciaM: 651 },
  { numero: 15, titulo: 'Recuo dos 11 vagões para a LN3 e engate nos veículos estacionados', agentes: ['Maquinista do J105', 'Operador de manobra'], procedimento: 'O operador acompanha o recuo para a LN3, informando distâncias por rádio até o engate com os veículos estacionados. Após o contato, solicita puxada para confirmar o engate. Confirmado, coordena a passagem do ar quando aplicável.', linha: 'Linha 3', referencia: 'T2', distanciaM: 537 },
  { numero: 16, titulo: 'Corte dos dois vagões avariados para permanência na LN3', agentes: ['Maquinista do J105', 'Operador de manobra'], procedimento: 'Após os vagões HFE 705327-4 e HFE 705328-2 serem levados à LN3, o operador solicita autorização para separá-los do conjunto que retornará ao J105. O maquinista imobiliza o conjunto. O operador fecha torneiras, solicita teste de resistência, aciona a haste de desengate e confirma que os dois vagões ficam estacionados na LN3 conforme as condições de segurança aplicáveis.', linha: 'Linha 3', distanciaM: 500 },
  { numero: 17, titulo: 'Loco líder puxa 9 vagões sentido EDV até livrar o AMV', agentes: ['Maquinista do J105', 'Operador de manobra'], procedimento: 'O maquinista puxa o conjunto remanescente sentido EDV. O operador confirma visualmente a passagem do engate do último veículo por pelo menos 10 metros além do AMV do Travessão 2.', linha: 'Linha 3', referencia: 'T2', direcao: 'EDV', distanciaM: 537 },
  { numero: 18, titulo: 'Manipulação do AMV da LN3 para a Linha do Desvio', agentes: ['Operador de manobra'], procedimento: 'Com o AMV livre, o operador altera a rota para a Linha do Desvio, conclui travamentos e conferências e comunica ao maquinista a condição do aparelho e a rota autorizada para o recuo.', linha: 'Linha 3', referencia: 'T2', distanciaM: 537 },
  { numero: 19, titulo: 'Recuo dos 9 vagões e recomposição com o restante do J105', agentes: ['Maquinista do J105', 'Operador de manobra'], procedimento: 'O operador acompanha por rádio o recuo até o restante do J105. Após o engate, solicita puxada para confirmação e, depois da autorização do maquinista, realiza a passagem do ar, conectando mangueiras e abrindo torneiras.', linha: 'Desvio', referencia: 'T2', distanciaM: 651 },
  { numero: 20, titulo: 'J105 puxa até a posição 78 e para no marco', agentes: ['Maquinista do J105', 'Operador de manobra'], procedimento: 'O maquinista movimenta a composição até alinhar o ponto de corte correspondente à posição original 78 com o marco operacional indicado pelo operador. O vagão avariado nessa posição é o HPD 342663-7.', linha: 'Desvio', referencia: 'Pos. 78', distanciaM: 651 },
  { numero: 21, titulo: 'Corte do vagão HPD 342663-7', agentes: ['Maquinista do J105', 'Operador de manobra'], procedimento: 'O operador solicita autorização. O maquinista centraliza a reversora e aplica o freio. O operador fecha as torneiras do encanamento geral nos dois lados necessários para isolar o vagão, solicita o teste de resistência, confirma o teste, aciona a haste de desengate e coordena a separação do vagão avariado.', linha: 'Desvio', referencia: 'Pos. 78', distanciaM: 651 },
  { numero: 22, titulo: 'J105 puxa sentido EDV até livrar o AMV do Travessão 2', agentes: ['Maquinista do J105', 'Operador de manobra'], procedimento: 'O maquinista puxa a parte da composição que será direcionada. O operador acompanha e confirma quando o engate do último veículo estiver pelo menos 10 metros além do AMV.', linha: 'Desvio', referencia: 'T2', direcao: 'EDV', distanciaM: 651 },
  { numero: 23, titulo: 'Manipulação do AMV para rota Desvio-LN3 e autorização do recuo', agentes: ['Operador de manobra'], procedimento: 'O operador manipula o AMV do Travessão 2 para LN3, conclui travamento e conferência da ponta da agulha, informa a rota por rádio e autoriza o início do recuo controlado.', linha: 'Desvio', referencia: 'T2', distanciaM: 651 },
  { numero: 24, titulo: 'Recuo para a LN3 e engate nos vagões estacionados', agentes: ['Maquinista do J105', 'Operador de manobra'], procedimento: 'O maquinista recua sob orientação contínua do operador. O operador informa distâncias em vagões e metros até o engate com os veículos estacionados na LN3, solicita puxada para confirmação e coordena a passagem do ar quando necessária.', linha: 'Linha 3', distanciaM: 500 },
  { numero: 25, titulo: 'Reposicionamento e nova autorização para recuo na LN3', agentes: ['Operador de manobra', 'Maquinista do J105'], procedimento: 'Esta é uma etapa real da sequência de desintercalação, não uma duplicação. O operador confirma a nova necessidade de rota e posicionamento, verifica o AMV e autoriza o movimento subsequente para colocar o vagão da posição 78 na posição adequada dentro do grupo de avariados na LN3.', linha: 'Linha 3', referencia: 'Pos. 78', distanciaM: 500 },
  { numero: 26, titulo: 'Novo recuo e engate nos veículos estacionados na LN3', agentes: ['Maquinista do J105', 'Operador de manobra'], procedimento: 'O maquinista executa o segundo recuo da volta de manobra sob orientação por rádio. O operador controla a aproximação, confirma o engate e executa as ações necessárias para consolidar o estacionamento do vagão avariado na LN3.', linha: 'Linha 3', distanciaM: 500 },
  { numero: 27, titulo: 'Manipulação do AMV para retorno à Linha do Desvio', agentes: ['Operador de manobra'], procedimento: 'Com os veículos posicionados e o AMV livre, o operador altera a rota para a Linha do Desvio, trava o conjunto, recoloca o cadeado, confere a vedação da agulha e comunica ao maquinista a condição do AMV.', linha: 'Linha 3', referencia: 'T2', distanciaM: 537 },
  { numero: 28, titulo: 'Recuo até engatar no restante do J105', agentes: ['Maquinista do J105', 'Operador de manobra'], procedimento: 'O operador acompanha o recuo do conjunto remanescente até o restante do trem. Após o contato, solicita puxada de confirmação e passagem do ar, restabelecendo a continuidade do encanamento geral da composição.', linha: 'Desvio', referencia: 'T2', distanciaM: 651 },
  { numero: 29, titulo: 'J105 puxa até a posição 84 e para no marco', agentes: ['Maquinista de viagem', 'Operador de manobra', 'CCO'], procedimento: 'Após a autorização de bloqueio ou da Macro 23, o maquinista puxa o trem até que o ponto de corte associado às posições originais 83 e 84 esteja no marco entre LN3 e Linha do Desvio no Travessão 2. Os vagões envolvidos são HFE 253578-5 e HFE 253577-7.', linha: 'Desvio', referencia: 'Pos. 83/84', distanciaM: 651 },
  { numero: 30, titulo: 'Autorização e corte dos vagões das posições 83 e 84', agentes: ['Maquinista de viagem', 'Operador de manobra'], procedimento: 'O operador solicita autorização para cortar os vagões HFE 253578-5 e HFE 253577-7. O maquinista centraliza a reversora e aplica o freio. Como as locomotivas distribuídas estão antes do local de corte informado, não é necessário colocar o bloco C em modo de espera nesta etapa. O operador fecha torneiras, solicita o teste de resistência, confirma o teste e aciona a haste de desengate.', linha: 'Desvio', referencia: 'Pos. 83/84', distanciaM: 651 },
  { numero: 31, titulo: 'J105 puxa sentido EDV até livrar o AMV', agentes: ['Maquinista de viagem', 'Operador de manobra'], procedimento: 'O maquinista puxa a composição sentido EDV. O operador confirma visualmente quando o engate do último veículo ultrapassar 10 metros além do AMV do Travessão 2.', linha: 'Desvio', referencia: 'T2', direcao: 'EDV', distanciaM: 651 },
  { numero: 32, titulo: 'Manipulação do AMV para rota Desvio-LN3 e autorização do recuo', agentes: ['Operador de manobra'], procedimento: 'O operador manipula o AMV para LN3, realiza travamento, cadeamento e conferência da vedação da agulha, comunica a rota por rádio e autoriza o recuo controlado.', linha: 'Desvio', referencia: 'T2', distanciaM: 651 },
  { numero: 33, titulo: 'J105 recua para a LN3 e engata nos vagões estacionados', agentes: ['Maquinista de viagem', 'Operador de manobra'], procedimento: 'O operador acompanha o recuo e informa distâncias progressivas até o engate na LN3. Após o contato, solicita puxada para confirmação e coordena a passagem do ar quando necessária.', linha: 'Linha 3', distanciaM: 500 },
  { numero: 34, titulo: 'Corte dos vagões HFE 253578-5 e HFE 253577-7 para permanência na LN3', agentes: ['Maquinista de viagem', 'Operador de manobra'], procedimento: 'Este segundo corte é necessário para deixar os dois vagões na LN3 após eles terem sido retirados da Linha do Desvio. O operador solicita autorização, o maquinista imobiliza o conjunto, e o operador fecha torneiras, solicita teste de resistência, aciona a haste de desengate e confirma o estacionamento dos vagões avariados.', linha: 'Linha 3', distanciaM: 500 },
  { numero: 35, titulo: 'Manipulação do AMV para retorno à Linha do Desvio', agentes: ['Operador de manobra'], procedimento: 'Após o corte e a liberação física do AMV, o operador altera a rota para a Linha do Desvio, conclui os travamentos, confere a ponta da agulha e informa por rádio a rota estabelecida.', linha: 'Linha 3', referencia: 'T2', distanciaM: 537 },
  { numero: 36, titulo: 'J105 recua e engata no restante da composição', agentes: ['Maquinista de viagem', 'Operador de manobra'], procedimento: 'O operador acompanha o recuo até a composição principal do J105, informando distâncias pelo rádio. Após o engate, solicita puxada para confirmação e passagem do ar para recompor o encanamento geral.', linha: 'Desvio', referencia: 'T2', distanciaM: 651 },
  { numero: 37, titulo: 'J105 puxa até o marco de saída do pátio sentido EDV', agentes: ['Maquinista de viagem', 'CCO', 'Operador de manobra'], procedimento: 'Com a manobra de vagões concluída, o maquinista conduz o trem até o marco de saída do pátio no sentido EDV, dentro da autorização vigente. O operador confirma que a rota e a composição estão livres para o movimento.', linha: 'Desvio', referencia: 'Saída', direcao: 'EDV', distanciaM: 1800 },
  { numero: 38, titulo: 'Saída do J105 sentido EDV com destino a EBJ', agentes: ['Maquinista de viagem', 'CCO'], procedimento: 'Após a autorização, o maquinista inicia a circulação do J105 sentido EDV, observando a licença e a VMA aplicável. A formação final possui 90 vagões: cinco avariados foram retirados e um vagão bom foi anexado.', linha: 'Desvio', direcao: 'EDV', distanciaM: 1944 },
];

/** Vagões nomeados no enredo (avariados, retirados durante a manobra) — mesmos ids do plano v3
 *  (`J105/plano-manobra-j105-v3.html`), consistentes com o texto dos passos acima. */
const VAGOES_AVARIADOS = ['HFE 705327-4', 'HFE 705328-2', 'HPD 342663-7', 'HFE 253578-5', 'HFE 253577-7'];
const VAGAO_BOM = 'Vagão bom (AG Tração)';
const LOCOMOTIVAS_J105 = ['S7B 8442-6', 'S7B 8439-6', 'S7B 8443-6'];
const VAGOES_TOTAIS = 92;

function construirCluster(passo: PassoJ105, composicao?: { antes: ItemComposicao[]; depois: ItemComposicao[] }): ClusterManobra {
  const etapa: EtapaManobra = {
    id: `j105-e${passo.numero}`,
    tipo: 'PARADA',
    descricao: passo.titulo,
    tempoEstimado: `T+00:${String(passo.numero - 1).padStart(2, '0')}`,
    grupoVagoes: `Passo ${passo.numero}`,
    agentes: passo.agentes,
    instrucaoCompleta: passo.procedimento,
    apoio: {
      linha: passo.linha,
      referencia: passo.referencia,
      direcao: passo.direcao,
      distanciaLabel: 'Distância',
      distanciaM: passo.distanciaM,
    },
  };
  return {
    id: `j105-c${passo.numero}`,
    titulo: `Passo ${passo.numero} — ${passo.titulo}`,
    resumoProblema: passo.titulo,
    descricaoProblema: passo.titulo.toLowerCase(),
    criticidade: 'Baixa',
    composicao: composicao ?? { antes: [], depois: [] },
    etapas: [etapa],
  };
}

/** Monta o `PlanoManobra` do J105 — 1 único Bloco (a composição inteira, sem divisão A/B/C: essa
 *  divisão só importa pro algoritmo de manobra dos demais trens) com 38 Clusters, um por passo.
 *  `trem`/`os` são parâmetros (com o J105 V1 como padrão) só para o J105 V2 reaproveitar ESTA
 *  MESMA sequência de 38 passos em vez de duplicá-la — ver `TREM_J105_V2`/`animacaoJ105.ts`. As
 *  duas versões compartilham o plano inteiro (títulos, agentes, instruções e ids de etapa
 *  `j105-eN`, que é o que `passoDoEtapaId` lê); a única diferença entre elas é como a Visão
 *  Topológica desenha esses passos. Chamar sem argumentos devolve o V1 exatamente como antes.
 *  A composição física completa (3 locomotivas + vagões) só precisa ser declarada UMA vez (no
 *  1º Cluster) — `derivarVeiculosDoBloco` (`planoTopologiaAdapter.ts`) une as listas "antes" de
 *  TODOS os Clusters do Bloco por id, então repeti-la nos outros 37 seria redundante. */
export function construirPlanoJ105(trem = 'J105', os = '50092901'): PlanoManobra {
  const passagem = vagoesPassagemJ105(705100, VAGOES_TOTAIS - VAGOES_AVARIADOS.length);
  const composicaoInicial = {
    antes: [
      ...LOCOMOTIVAS_J105.map((id): ItemComposicao => ({ id, tipo: 'locomotiva' })),
      ...passagem,
      ...VAGOES_AVARIADOS.map((id): ItemComposicao => ({ id, tipo: 'retirado' })),
    ],
    depois: [
      ...LOCOMOTIVAS_J105.map((id): ItemComposicao => ({ id, tipo: 'locomotiva' })),
      ...passagem,
      { id: VAGAO_BOM, tipo: 'incluido' as const },
    ],
  };

  const clusters = PASSOS_J105.map((passo, i) => construirCluster(passo, i === 0 ? composicaoInicial : undefined));

  return {
    trem,
    os,
    blocos: [
      {
        id: 'j105-composicao',
        nome: 'Composição J105',
        locomotivas: LOCOMOTIVAS_J105.length,
        vagoes: VAGOES_TOTAIS,
        clusters,
      },
    ],
  };
}
