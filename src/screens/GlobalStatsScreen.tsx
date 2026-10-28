import { BarChart3, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, PositionBadge, SectionTitle, TopBar } from "../components/ui";
import { computeCareerStats } from "../domain/stats";
import { useNameOf, useStore } from "../state/store";

export function GlobalStatsScreen() {
  const { db } = useStore();
  const nameOf = useNameOf();
  const finished = db.matches.filter((m) => m.status === "finished");
  const inProgress = db.matches.filter((m) => m.status === "in_progress");
  const finishedIds = new Set(finished.map((m) => m.id));
  const roundsPlayed = db.rounds.filter((r) => finishedIds.has(r.matchId) && r.status === "closed").length;

  const career = computeCareerStats(db)
    .filter((c) => c.matchesPlayed > 0)
    .sort((a, b) => b.matchesWon - a.matchesWon || a.averagePerRound - b.averagePerRound || b.roundWins - a.roundWins);

  return (
    <div className="screen">
      <TopBar title="Estatísticas" subtitle="Todas as partidas encerradas" back="/" />

      {inProgress.map((m) => (
        <Link key={m.id} to={`/partida/${m.id}`} className="card mt-2 flex items-center gap-3 p-4">
          <BarChart3 className="text-accent" />
          <div className="flex-1">
            <div className="font-extrabold">Estatísticas da partida em andamento</div>
            <div className="text-sm text-muted">Placar, saídas e recordes ao vivo</div>
          </div>
          <ChevronRight className="text-muted" />
        </Link>
      ))}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="card p-4 text-center">
          <div className="num text-4xl font-black">{finished.length}</div>
          <div className="text-sm text-muted">partidas encerradas</div>
        </div>
        <div className="card p-4 text-center">
          <div className="num text-4xl font-black">{roundsPlayed}</div>
          <div className="text-sm text-muted">rodadas disputadas</div>
        </div>
      </div>

      <SectionTitle>Ranking da turma</SectionTitle>
      {career.length === 0 ? (
        <EmptyState icon={<BarChart3 size={40} />} title="Sem dados ainda">
          Encerre uma partida para ver o desempenho acumulado da turma.
        </EmptyState>
      ) : (
        <ol className="grid gap-2">
          {career.map((c, i) => (
            <li key={c.playerId}>
              <Link to={`/jogadores/${c.playerId}`} className="card flex items-center gap-3 p-3">
                <PositionBadge position={i + 1} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-extrabold">{nameOf(c.playerId)}</div>
                  <div className="text-sm text-muted">
                    {c.matchesPlayed} partidas · {c.roundWins} vitórias de rodada · {c.zeroDoubles}× 0-0
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-2xl font-black">{c.matchesWon}</div>
                  <div className="text-xs text-muted">títulos</div>
                </div>
                <div className="text-right">
                  <div className="num text-2xl font-black">{c.averagePerRound.toFixed(1)}</div>
                  <div className="text-xs text-muted">pts/rodada</div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {career.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          Ordenado por títulos (1º lugar, inclusive empatado), depois pela menor média de pontos por rodada.
        </p>
      )}
    </div>
  );
}
