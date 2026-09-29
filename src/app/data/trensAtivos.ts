import { TREM_J105_V2 } from './animacaoJ105';

/**
 * Trens de exemplo que aparecem no app (2026-09-28, pedido explícito do usuário: "mantenha somente
 * o trem J105-V2, J105, J614 e R045"). Filtra as fichas (`fichasMock`) e os planos de manobra
 * (`planosManobraMock`); os dados dos demais trens continuam no código, só fora das telas —
 * pra voltar um trem, basta incluí-lo aqui.
 *
 * 2026-09-29: o J105 antigo saiu das telas e o J105-V2 passou a ser exibido como "J105" (ver
 * `rotuloTrem`). O código interno continua `TREM_J105_V2` — é a chave de fichas, planos e da
 * animação, e trocar por "J105" colidiria com os dados do J105 antigo.
 */
export const TRENS_ATIVOS: readonly string[] = [TREM_J105_V2, 'J614', 'R045'];

/** Aparecem nas listas, mas desabilitados — não dá pra abrir (pedido explícito do usuário). */
export const TRENS_DESABILITADOS: readonly string[] = ['J614', 'R045'];

export const tremDesabilitado = (trem: string) => TRENS_DESABILITADOS.includes(trem);

/** Nome do trem como o usuário vê — o J105-V2 aparece como "J105". */
export const rotuloTrem = (trem: string) => (trem === TREM_J105_V2 ? 'J105' : trem);
