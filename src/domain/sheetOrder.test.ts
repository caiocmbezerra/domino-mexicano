import { describe, expect, it } from "vitest";
import { orderSheetRows } from "./sheetOrder";
import type { RoundResult } from "./types";

const ids = ["ana", "beto", "caio", "davi"]; // ordem de cadastro
const totals = new Map([["ana", 40], ["beto", 12], ["caio", 40], ["davi", 5]]);
const r = (playerId: string, exitPosition: number | null, countedPoints: number): RoundResult => ({
  id: playerId, roundId: "r1", playerId, exitPosition, remainingPoints: countedPoints, countedPoints,
  isWinner: exitPosition === 1, hadZeroDouble: false,
});

describe("Ordem da planilha", () => {
  it("cadastro (principal): exatamente a ordem em que foram colocados", () => {
    expect(orderSheetRows(ids, "cadastro", totals)).toEqual(ids);
  });

  it("total: menor somatório primeiro; empate mantém a ordem de cadastro", () => {
    expect(orderSheetRows(ids, "total", totals)).toEqual(["davi", "beto", "ana", "caio"]);
  });

  it("rodada: quem saiu primeiro, depois quem ficou com menos pontos na mão", () => {
    const rodada = [r("ana", null, 30), r("beto", 2, 0), r("caio", null, 8), r("davi", 1, 0)];
    expect(orderSheetRows(ids, "rodada", totals, rodada)).toEqual(["davi", "beto", "caio", "ana"]);
  });

  it("rodada: empate em pontos na mão mantém a ordem de cadastro; sem rodada, ordem de cadastro", () => {
    const rodada = [r("ana", null, 10), r("beto", 1, 0), r("caio", null, 10), r("davi", null, 10)];
    expect(orderSheetRows(ids, "rodada", totals, rodada)).toEqual(["beto", "ana", "caio", "davi"]);
    expect(orderSheetRows(ids, "rodada", totals, [])).toEqual(ids);
  });

  it("não altera a lista original", () => {
    const copia = [...ids];
    orderSheetRows(ids, "total", totals);
    expect(ids).toEqual(copia);
  });
});
