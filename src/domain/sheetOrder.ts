/**
 * Ordem das linhas da planilha. É só uma forma de VER a planilha: não muda pontos,
 * não aplica desempate e não substitui o ranking final.
 */
import type { ID, RoundResult } from "./types";

export type SheetOrder = "cadastro" | "rodada" | "total";

export const SHEET_ORDER_LABELS: Record<SheetOrder, string> = {
  cadastro: "Cadastro",
  rodada: "Rodada",
  total: "Total",
};

/**
 * - cadastro: a ordem em que os jogadores foram colocados na partida (padrão).
 * - rodada: colocação na rodada escolhida — quem saiu primeiro, depois quem ficou com
 *   menos pontos na mão. Sem rodada fechada, mantém a ordem de cadastro.
 * - total: somatório, do menor (melhor) para o maior.
 * Empates mantêm a ordem de cadastro.
 */
export function orderSheetRows(
  participantIds: ID[],
  order: SheetOrder,
  totals: Map<ID, number>,
  roundResults: RoundResult[] = [],
): ID[] {
  const index = (id: ID) => participantIds.indexOf(id);
  if (order === "total")
    return [...participantIds].sort((a, b) => (totals.get(a) ?? 0) - (totals.get(b) ?? 0) || index(a) - index(b));
  if (order === "rodada" && roundResults.length) {
    const res = (id: ID) => roundResults.find((r) => r.playerId === id);
    return [...participantIds].sort((a, b) => {
      const ra = res(a);
      const rb = res(b);
      const pa = ra?.exitPosition ?? Infinity;
      const pb = rb?.exitPosition ?? Infinity;
      if (pa !== pb) return pa - pb;
      return (ra?.countedPoints ?? Infinity) - (rb?.countedPoints ?? Infinity) || index(a) - index(b);
    });
  }
  return [...participantIds];
}
