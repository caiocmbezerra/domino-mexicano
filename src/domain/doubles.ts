import type { Round } from "./types";

/** Representação textual de um carroção: 10 → "10-10". */
export function doubleLabel(value: number | null): string {
  return value === null ? "sem carroção" : `${value}-${value}`;
}

/** Todos os carroções do conjunto, do maior para o menor (12, 11, …, 0). */
export function allDoubles(highest: number): number[] {
  return Array.from({ length: highest + 1 }, (_, i) => highest - i);
}

/**
 * Lista de carroções já consumidos na partida: os que abriram alguma rodada
 * (aberta ou fechada). Derivada das rodadas, por isso desfazer uma rodada
 * devolve automaticamente o carroção à lista de elegíveis.
 */
export function usedDoubles(matchRounds: Round[]): number[] {
  const used = new Set<number>();
  for (const r of matchRounds) if (r.openingDouble !== null) used.add(r.openingDouble);
  return [...used].sort((a, b) => b - a);
}

/** Carroções ainda elegíveis para abertura, do maior para o menor. */
export function eligibleDoubles(used: number[], highest: number): number[] {
  const usedSet = new Set(used);
  return allDoubles(highest).filter((d) => !usedSet.has(d));
}

/** Início da busca: o maior carroção elegível, ou null se não restar nenhum. */
export function startSearch(used: number[], highest: number): number | null {
  return eligibleDoubles(used, highest)[0] ?? null;
}

/** "Ninguém tem": próximo carroção elegível abaixo do atual, ou null se a busca se esgotou. */
export function searchNext(current: number, used: number[], highest: number): number | null {
  return eligibleDoubles(used, highest).find((d) => d < current) ?? null;
}

/**
 * "Voltar": carroção elegível imediatamente acima do atual. Com a busca esgotada
 * (current = null), volta para o menor elegível. Se já estiver no topo, permanece.
 */
export function searchPrevious(
  current: number | null,
  used: number[],
  highest: number,
): number | null {
  const eligible = eligibleDoubles(used, highest);
  if (eligible.length === 0) return null;
  if (current === null) return eligible[eligible.length - 1];
  const above = eligible.filter((d) => d > current);
  return above.length ? above[above.length - 1] : current;
}
