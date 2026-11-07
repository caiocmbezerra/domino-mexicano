/**
 * Conferência entre jogadores: no duplo-12 cada peça existe uma única vez, então a mesma
 * peça não pode estar na mão de dois jogadores — nem o 0-0 pode ser de duas pessoas.
 * Os avisos não bloqueiam o fechamento da rodada; o operador decide depois de conferir.
 */
import type { ID, RoundDraft, Tile } from "./types";

/** "10|6": maior metade primeiro, para 6|10 e 10|6 serem a mesma peça. */
export function tileLabel(t: Tile): string {
  return `${Math.max(t.a, t.b)}|${Math.min(t.a, t.b)}`;
}

export function tilesSum(tiles: Tile[]): number {
  return tiles.reduce((s, t) => s + t.a + t.b, 0);
}

export interface TileConflict {
  kind: "repetida" | "zeroDouble";
  /** Peça envolvida, ex.: "10|6" ou "0|0". */
  label: string;
  playerIds: ID[];
  message: string;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

export function findTileConflicts(
  draft: RoundDraft,
  participantIds: ID[],
  nameOf: (id: ID) => string,
): TileConflict[] {
  const conflicts: TileConflict[] = [];

  // Onde cada peça apareceu: rótulo → lista de jogadores (com repetição, na ordem de exibição).
  const where = new Map<string, ID[]>();
  for (const pid of participantIds)
    for (const t of draft.tiles?.[pid] ?? []) {
      const label = tileLabel(t);
      where.set(label, [...(where.get(label) ?? []), pid]);
    }

  for (const [label, owners] of where) {
    if (owners.length < 2) continue;
    const distinct = [...new Set(owners)];
    conflicts.push({
      kind: "repetida",
      label,
      playerIds: distinct,
      message:
        distinct.length === 1
          ? `A peça ${label} aparece ${owners.length} vezes na foto de ${nameOf(distinct[0])}. Confira: no duplo-12 cada peça existe uma vez só.`
          : `A peça ${label} apareceu para ${joinNames(distinct.map(nameOf))}. Confira: no duplo-12 cada peça existe uma vez só.`,
    });
  }

  // O 0-0 só pode estar com uma pessoa: marcado para mais de um, ou marcado para um e visto na foto de outro.
  const marked = participantIds.filter((id) => draft.zeroDouble[id]);
  const seen = (where.get("0|0") ?? []).filter((id) => !marked.includes(id));
  const withZero = [...new Set([...marked, ...seen])];
  if (withZero.length > 1) {
    const partes: string[] = [];
    if (marked.length) partes.push(`marcado para ${joinNames(marked.map(nameOf))}`);
    if (seen.length) partes.push(`visto na foto de ${joinNames([...new Set(seen)].map(nameOf))}`);
    conflicts.push({
      kind: "zeroDouble",
      label: "0|0",
      playerIds: withZero,
      message: `O 0-0 está ${partes.join(" e ")}. Só uma pessoa pode ter terminado com ele.`,
    });
  }
  return conflicts;
}
