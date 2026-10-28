import { BarChart3, History, Play, Plus, Settings, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { DominoTile } from "../components/DominoTile";
import { getMatchRounds, getOpenRound } from "../domain/database";
import { doubleLabel } from "../domain/doubles";
import { formatDateTime } from "../domain/format";
import { analyzeMatch } from "../domain/stats";
import { useNameOf, useStore } from "../state/store";

export function HomeScreen() {
  const { db } = useStore();
  const navigate = useNavigate();
  const nameOf = useNameOf();
  const inProgress = db.matches
    .filter((m) => m.status === "in_progress")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const finishedCount = db.matches.length - inProgress.length;

  return (
    <div className="screen">
      <header className="flex items-center gap-4 pb-2 pt-[calc(24px+env(safe-area-inset-top))]">
        <div className="flex -rotate-12 gap-1">
          <DominoTile value={12} size={26} />
          <DominoTile value={0} size={26} className="translate-y-2" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black leading-tight">{db.settings.appName}</h1>
          <p className="text-sm text-muted">Placar e ranking da turma · duplo-12</p>
        </div>
        <Link to="/ajustes" className="icon-btn" aria-label="Ajustes">
          <Settings size={24} />
        </Link>
      </header>

      {inProgress.map((match) => {
        const analysis = analyzeMatch(db, match.id)!;
        const rounds = getMatchRounds(db, match.id);
        const open = getOpenRound(db, match.id);
        const roundNumber = open ? open.number : rounds.length + 1;
        return (
          <section key={match.id} className="card mt-5 p-4 animate-rise">
            <div className="flex items-center justify-between gap-2">
              <span className="badge badge-good">● Em andamento</span>
              <span className="text-sm text-muted">{formatDateTime(match.startedAt)}</span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <div className="label">Rodada atual</div>
                <div className="num text-4xl font-black">{roundNumber}</div>
                <div className="text-sm text-muted">
                  {open
                    ? `${doubleLabel(open.openingDouble)} aberto por ${nameOf(open.openerId)}`
                    : "Aguardando abertura"}
                </div>
              </div>
              <div className="text-right text-sm text-muted">
                {match.participantIds.length} jogadores
                <br />
                {analysis.data.closedRounds.length} rodadas fechadas
              </div>
            </div>
            {/* Somatório na ordem de exibição — sem classificação até o encerramento. */}
            <ul className="mt-4 divide-y divide-line rounded-2xl bg-surface">
              {analysis.stats.map((s) => (
                <li key={s.playerId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="truncate text-lg font-extrabold">{nameOf(s.playerId)}</span>
                  <span className="num text-2xl font-black">{s.total}</span>
                </li>
              ))}
            </ul>
            <button
              className="btn btn-primary btn-lg mt-4 w-full"
              onClick={() => navigate(`/partida/${match.id}`)}
            >
              <Play size={22} /> Continuar partida
            </button>
          </section>
        );
      })}

      <nav className="mt-5 grid gap-3">
        <button className="btn btn-primary btn-lg w-full" onClick={() => navigate("/nova")}>
          <Plus size={24} /> Nova partida
        </button>
        {inProgress.length === 0 && (
          <button className="btn btn-secondary btn-lg w-full" disabled aria-describedby="sem-partida">
            <Play size={22} /> Continuar partida
          </button>
        )}
        {inProgress.length === 0 && (
          <p id="sem-partida" className="-mt-1 text-center text-sm text-muted">
            Nenhuma partida em andamento.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/historico" className="btn btn-secondary flex-col !gap-1 py-4 !min-h-24">
            <History size={26} />
            Histórico
            <span className="text-xs font-semibold text-muted">
              {finishedCount} {finishedCount === 1 ? "partida" : "partidas"}
            </span>
          </Link>
          <Link to="/jogadores" className="btn btn-secondary flex-col !gap-1 py-4 !min-h-24">
            <Users size={26} />
            Jogadores
            <span className="text-xs font-semibold text-muted">{db.players.length} cadastrados</span>
          </Link>
        </div>
        <Link to="/estatisticas" className="btn btn-secondary w-full">
          <BarChart3 size={22} /> Estatísticas
        </Link>
      </nav>
    </div>
  );
}
