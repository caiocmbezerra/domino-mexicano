import { Crown } from "lucide-react";
import { joinNames, pointsLabel } from "../domain/format";
import type { MatchAnalysis } from "../domain/stats";
import { useNameOf } from "../state/store";

/** Pódio com campeão, 2º e 3º colocados (empates aparecem juntos na mesma posição). */
export function Podium({ analysis }: { analysis: MatchAnalysis }) {
  const nameOf = useNameOf();
  const groups = new Map<number, typeof analysis.ranking>();
  for (const e of analysis.ranking)
    if (e.position <= 3) groups.set(e.position, [...(groups.get(e.position) ?? []), e]);
  const [first, ...others] = [...groups.entries()].sort((a, b) => a[0] - b[0]);
  if (!first) return null;
  const [, champions] = first;

  return (
    <section className="mt-2 animate-rise">
      <div className="card border-accent bg-gradient-to-b from-accent-soft to-card p-5 text-center">
        <Crown className="mx-auto text-accent" size={36} />
        <div className="label mt-1">{champions.length > 1 ? "Campeões empatados" : "Campeão"}</div>
        <div className="text-3xl font-black">{joinNames(champions.map((e) => nameOf(e.stats.playerId)))}</div>
        <div className="num text-lg font-bold text-muted">{pointsLabel(champions[0].stats.total)}</div>
        {champions.length === 1 && champions[0].decidedBy && (
          <div className="badge badge-accent mt-2">Venceu no desempate</div>
        )}
      </div>
      {others.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {others.map(([position, entries]) => (
            <div key={position} className="card p-3 text-center">
              <div className="label">
                {position}º lugar{entries.length > 1 ? " (empate)" : ""}
              </div>
              <div className="truncate text-xl font-black">{joinNames(entries.map((e) => nameOf(e.stats.playerId)))}</div>
              <div className="num text-muted">{pointsLabel(entries[0].stats.total)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
