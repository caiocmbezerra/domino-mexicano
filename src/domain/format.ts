import { doubleLabel } from "./doubles";
import { TIE_BREAKER_SHORT, type MatchAnalysis, type Record_ } from "./stats";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function pointsLabel(n: number): string {
  return `${n} ${n === 1 ? "ponto" : "pontos"}`;
}

export function ordinal(n: number): string {
  return `${n}º`;
}

/** "João", "João e Pedro", "João, Pedro e Ana". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

export function recordNames(rec: Record_ | null, nameOf: (id: string) => string): string | null {
  return rec ? joinNames(rec.playerIds.map(nameOf)) : null;
}

/** Resumo em texto puro, pronto para colar no WhatsApp. */
export function buildResultText(
  analysis: MatchAnalysis,
  nameOf: (id: string) => string,
  title = "DOMINÓ MEXICANO — RESULTADO FINAL",
): string {
  const { ranking, records, data } = analysis;
  const lines: string[] = [title.toUpperCase(), ""];
  const date = data.match.endedAt ?? data.match.startedAt;
  lines.push(`Data: ${formatDate(date)} · ${data.closedRounds.length} rodadas`, "");

  for (const e of ranking) {
    let suffix = "";
    if (e.tied) suffix = " (empate)";
    else if (e.decidedBy) suffix = ` (desempate: ${TIE_BREAKER_SHORT[e.decidedBy]})`;
    lines.push(`${ordinal(e.position)} — ${nameOf(e.stats.playerId)}: ${pointsLabel(e.stats.total)}${suffix}`);
  }

  const rec: string[] = [];
  const w = recordNames(records.mostWins, nameOf);
  if (w) rec.push(`* Mais vitórias: ${w} (${records.mostWins!.value}).`);
  if (records.highestRound) {
    const who = joinNames(
      records.highestRound.entries.map((e) => `${nameOf(e.playerId)} na rodada ${e.roundNumber}`),
    );
    rec.push(`* Maior pontuação em uma rodada: ${who}, ${pointsLabel(records.highestRound.value)}.`);
  }
  const h = recordNames(records.highestTotal, nameOf);
  if (h) rec.push(`* Maior pontuação acumulada: ${h}, ${pointsLabel(records.highestTotal!.value)}.`);
  const z = recordNames(records.mostZeroDoubles, nameOf);
  if (z) rec.push(`* Mais vezes com o 0-0: ${z} (${records.mostZeroDoubles!.value}).`);
  const o = recordNames(records.mostOpens, nameOf);
  if (o) rec.push(`* Mais aberturas: ${o} (${records.mostOpens!.value}).`);

  if (rec.length) lines.push("", "Recordes:", "", ...rec);

  const doubles = data.closedRounds.map((r) => doubleLabel(r.openingDouble));
  if (doubles.length) lines.push("", `Carroções: ${doubles.join(", ")}`);
  return lines.join("\n");
}
