import { describe, expect, it } from "vitest";
import { findTileConflicts, tileLabel, tilesSum } from "./tiles";
import type { RoundDraft } from "./types";

const nomes: Record<string, string> = { j1: "João", j2: "Pedro", j3: "Carlos" };
const nameOf = (id: string) => nomes[id];
const ids = ["j1", "j2", "j3"];
const draft = (over: Partial<RoundDraft>): RoundDraft => ({ exitOrder: [], points: {}, zeroDouble: {}, ...over });

describe("Peça repetida entre jogadores (conferência pela foto)", () => {
  it("as fotos de teste: 10|6 e 4|12 nas mãos dos dois jogadores", () => {
    const c = findTileConflicts(
      draft({
        tiles: {
          j1: [{ a: 10, b: 6 }, { a: 4, b: 12 }, { a: 10, b: 5 }, { a: 3, b: 12 }],
          j2: [
            { a: 12, b: 12 }, { a: 12, b: 11 }, { a: 12, b: 10 }, { a: 12, b: 9 },
            { a: 10, b: 6 }, { a: 4, b: 12 },
          ],
        },
      }),
      ids,
      nameOf,
    );
    expect(c.map((x) => x.label).sort()).toEqual(["10|6", "12|4"]);
    expect(c[0].message).toContain("apareceu para João e Pedro");
    expect(c.every((x) => x.kind === "repetida" && x.playerIds.join() === "j1,j2")).toBe(true);
  });

  it("6|10 e 10|6 são a mesma peça; peça repetida na mesma foto também avisa", () => {
    expect(tileLabel({ a: 6, b: 10 })).toBe(tileLabel({ a: 10, b: 6 }));
    const c = findTileConflicts(draft({ tiles: { j3: [{ a: 6, b: 10 }, { a: 10, b: 6 }] } }), ids, nameOf);
    expect(c).toHaveLength(1);
    expect(c[0].message).toContain("aparece 2 vezes na foto de Carlos");
  });

  it("sem repetição, nenhum aviso", () => {
    const c = findTileConflicts(
      draft({ tiles: { j1: [{ a: 10, b: 6 }], j2: [{ a: 12, b: 12 }] }, zeroDouble: { j3: true } }),
      ids,
      nameOf,
    );
    expect(c).toEqual([]);
    expect(tilesSum([{ a: 10, b: 6 }, { a: 4, b: 12 }])).toBe(32);
  });

  it("0-0 marcado para dois jogadores (vale também para quem digitou os pontos)", () => {
    const c = findTileConflicts(draft({ zeroDouble: { j1: true, j3: true } }), ids, nameOf);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ kind: "zeroDouble", playerIds: ["j1", "j3"] });
    expect(c[0].message).toContain("marcado para João e Carlos");
  });

  it("0-0 marcado para um e visto na foto de outro", () => {
    const c = findTileConflicts(
      draft({ zeroDouble: { j1: true }, tiles: { j2: [{ a: 0, b: 0 }, { a: 5, b: 3 }] } }),
      ids,
      nameOf,
    );
    expect(c).toHaveLength(1);
    expect(c[0].message).toBe("O 0-0 está marcado para João e visto na foto de Pedro. Só uma pessoa pode ter terminado com ele.");
  });

  it("0-0 na foto do próprio jogador que o marcou não é conflito", () => {
    const c = findTileConflicts(draft({ zeroDouble: { j2: true }, tiles: { j2: [{ a: 0, b: 0 }] } }), ids, nameOf);
    expect(c).toEqual([]);
  });
});
