import { Crown, Medal, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { doubleLabel } from "../domain/doubles";
import { joinNames } from "../domain/format";
import { TIE_BREAKER_LABELS, TIE_BREAKER_SHORT, type MatchAnalysis, type Record_ } from "../domain/stats";
import { useNameOf } from "../state/store";
import { PositionBadge } from "./ui";

function Mini({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface px-2 py-1.5 text-center">
      <div className="num text-base font-extrabold">{value}</div>
      <div className="text-[11px] font-semibold leading-tight text-muted">{label}</div>
    </div>
  );
}

/** Classificação geral por menor pontuação acumulada. */
export function PointsRanking({ analysis, compact = false }: { analysis: MatchAnalysis; compact?: boolean }) {
  const nameOf = useNameOf();
  const { ranking, data } = analysis;
  const anyTie = ranking.some((e) => e.tied);
  const anyDecided = ranking.some((e) => e.decidedBy);
  const tieBreakers = data.match.settings.tieBreakers;

  return (
    <div>
      <ol className="flex flex-col gap-2">
        {ranking.map((e) => (
          <li
            key={e.stats.playerId}
            className={`card p-3 ${e.position === 1 && data.closedRounds.length ? "border-accent" : ""}`}
          >
            <div className="flex items-center gap-3">
              <PositionBadge position={e.position} tied={e.tied} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xl font-extrabold">{nameOf(e.stats.playerId)}</div>
                {e.tied && <span className="badge badge-danger">Empate</span>}
                {!e.tied && e.decidedBy && (
                  <span className="badge badge-accent">Desempate: {TIE_BREAKER_SHORT[e.decidedBy]}</span>
                )}
              </div>
              <div className="text-right">
                <div className="num text-4xl font-black leading-none">{e.stats.total}</div>
                <div className="text-xs text-muted">pontos</div>
              </div>
            </div>
            {!compact && (
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                <Mini label="rodadas" value={e.stats.roundsPlayed} />
                <Mini label="vitórias" value={e.stats.wins} />
                <Mini label="maior rodada" value={e.stats.maxRound} />
                <Mini label="com 0-0" value={e.stats.zeroDoubles} />
                <Mini label="1º a sair" value={e.stats.firsts} />
                <Mini label="2º a sair" value={e.stats.seconds} />
                <Mini label="3º a sair" value={e.stats.thirds} />
                <Mini label="aberturas" value={e.stats.opens} />
              </div>
            )}
          </li>
        ))}
      </ol>
      {!compact && (
        <p className="mt-3 text-sm text-muted">
          Menos pontos é melhor.{" "}
          {tieBreakers.length
            ? `Desempate da turma: ${tieBreakers.map((t) => TIE_BREAKER_LABELS[t].toLowerCase()).join("; depois ")}.`
            : "Sem critério de desempate: pontuações iguais ficam empatadas."}{" "}
          {anyTie && "Empates que persistem dividem a mesma posição."}
          {!anyTie && anyDecided && "Empates em pontos foram resolvidos pelo critério indicado."}
        </p>
      )}
    </div>
  );
}

/** Ranking de desempenho por ordem de saída, independente da pontuação. */
export function ExitRanking({ analysis }: { analysis: MatchAnalysis }) {
  const nameOf = useNameOf();
  return (
    <div>
      <ol className="card divide-y divide-line">
        {analysis.exitRanking.map((e) => (
          <li key={e.stats.playerId} className="flex items-center gap-3 p-3">
            <PositionBadge position={e.position} tied={e.tied} />
            <div className="min-w-0 flex-1 truncate text-lg font-extrabold">{nameOf(e.stats.playerId)}</div>
            <div className="num flex gap-3 text-center text-sm">
              <div>
                <div className="text-lg font-black">{e.stats.firsts}</div>
                <div className="text-muted">1º</div>
              </div>
              <div>
                <div className="text-lg font-black">{e.stats.seconds}</div>
                <div className="text-muted">2º</div>
              </div>
              <div>
                <div className="text-lg font-black">{e.stats.thirds}</div>
                <div className="text-muted">3º</div>
              </div>
              <div>
                <div className="text-lg font-black">
                  {e.stats.averageExitPosition === null ? "—" : e.stats.averageExitPosition.toFixed(1)}
                </div>
                <div className="text-muted">média</div>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-muted">
        Ordenado por quantidade de 1º, 2º e 3º lugares de saída; depois pela posição média (quem
        ficou com peças conta como logo após o último que saiu).
      </p>
    </div>
  );
}

function RecordCard({ icon, title, who, value }: { icon: ReactNode; title: string; who: string | null; value?: string }) {
  return (
    <div className="card flex items-start gap-3 p-4">
      <div className="mt-0.5 text-accent">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-muted">{title}</div>
        <div className="text-lg font-extrabold leading-snug">{who ?? "Ninguém ainda"}</div>
      </div>
      {value && who && <div className="num shrink-0 text-2xl font-black">{value}</div>}
    </div>
  );
}

export function RecordsList({ analysis }: { analysis: MatchAnalysis }) {
  const nameOf = useNameOf();
  const r = analysis.records;
  const names = (rec: Record_ | null) => (rec ? joinNames(rec.playerIds.map(nameOf)) : null);
  const highestRoundWho = r.highestRound
    ? joinNames(r.highestRound.entries.map((e) => `${nameOf(e.playerId)} (rodada ${e.roundNumber})`))
    : null;
  return (
    <div className="grid gap-2">
      <RecordCard icon={<Crown />} title="Menor pontuação acumulada" who={names(r.lowestTotal)} value={r.lowestTotal ? String(r.lowestTotal.value) : undefined} />
      <RecordCard icon={<Trophy />} title="Maior pontuação acumulada" who={names(r.highestTotal)} value={r.highestTotal ? String(r.highestTotal.value) : undefined} />
      <RecordCard icon={<Medal />} title="Maior pontuação em uma única rodada" who={highestRoundWho} value={r.highestRound ? String(r.highestRound.value) : undefined} />
      <RecordCard icon={<Medal />} title="Mais vitórias de rodada" who={names(r.mostWins)} value={r.mostWins ? `${r.mostWins.value}×` : undefined} />
      <RecordCard icon={<Medal />} title="Mais vezes o 1º a sair" who={names(r.mostFirsts)} value={r.mostFirsts ? `${r.mostFirsts.value}×` : undefined} />
      <RecordCard icon={<Medal />} title="Mais aberturas de rodada" who={names(r.mostOpens)} value={r.mostOpens ? `${r.mostOpens.value}×` : undefined} />
      <RecordCard icon={<Medal />} title="Mais vezes com o 0-0" who={names(r.mostZeroDoubles)} value={r.mostZeroDoubles ? `${r.mostZeroDoubles.value}×` : undefined} />
    </div>
  );
}

/** `ranked`: ordena pela classificação (só após o encerramento); senão, ordem de exibição. */
export function PlayerStatsCards({ analysis, ranked = true }: { analysis: MatchAnalysis; ranked?: boolean }) {
  const nameOf = useNameOf();
  const list = ranked ? analysis.ranking.map((e) => e.stats) : analysis.stats;
  return (
    <div className="grid gap-2">
      {list.map((s) => (
        <div key={s.playerId} className="card p-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="truncate text-lg font-extrabold">{nameOf(s.playerId)}</div>
            <div className="num text-2xl font-black">{s.total}</div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <Mini label="média/rodada" value={s.average.toFixed(1)} />
            <Mini label="vitórias" value={s.wins} />
            <Mini label="% vitórias" value={`${Math.round(s.winRate * 100)}%`} />
            <Mini label="1º / 2º / 3º" value={`${s.firsts}/${s.seconds}/${s.thirds}`} />
            <Mini
              label={s.maxRoundNumbers.length ? `maior (rod. ${s.maxRoundNumbers.join(", ")})` : "maior rodada"}
              value={s.maxRound}
            />
            <Mini label="aberturas" value={s.opens} />
            <Mini label="com 0-0" value={s.zeroDoubles} />
            <Mini label="rodadas" value={s.roundsPlayed} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Linha do tempo dos carroções 12 → 0, destacando os já utilizados. */
export function DoublesStrip({ used, highest, current }: { used: number[]; highest: number; current?: number | null }) {
  const values = Array.from({ length: highest + 1 }, (_, i) => highest - i);
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Carroções da partida">
      {values.map((v) => {
        const isUsed = used.includes(v);
        const isCurrent = current === v;
        return (
          <span
            key={v}
            title={`${doubleLabel(v)}${isUsed ? " — já utilizado" : ""}`}
            className={`num inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-1.5 text-sm font-extrabold ${
              isCurrent
                ? "bg-accent text-accent-fg"
                : isUsed
                  ? "bg-surface text-muted line-through opacity-60"
                  : "bg-card-2 text-fg"
            }`}
          >
            {v}
          </span>
        );
      })}
    </div>
  );
}
