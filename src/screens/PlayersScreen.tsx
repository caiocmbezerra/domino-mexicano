import { ChevronRight, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { AddPlayerForm } from "../components/AddPlayerForm";
import { EmptyState, SectionTitle, TopBar } from "../components/ui";
import { computeCareerStats } from "../domain/stats";
import { useStore } from "../state/store";

export function PlayersScreen() {
  const { db } = useStore();
  const career = new Map(computeCareerStats(db).map((c) => [c.playerId, c]));
  const players = [...db.players].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <div className="screen">
      <TopBar title="Jogadores" subtitle={`${players.length} cadastrados`} back="/" />
      <SectionTitle>Cadastrar jogador</SectionTitle>
      <AddPlayerForm />

      <SectionTitle>Turma</SectionTitle>
      {players.length === 0 ? (
        <EmptyState icon={<Users size={40} />} title="Nenhum jogador cadastrado">
          Cadastre os nomes acima ou direto ao criar uma nova partida.
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-line">
          {players.map((p) => {
            const c = career.get(p.id)!;
            return (
              <li key={p.id}>
                <Link to={`/jogadores/${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card-2 text-lg font-black">
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-extrabold">{p.name}</div>
                    <div className="text-sm text-muted">
                      {c.matchesPlayed} {c.matchesPlayed === 1 ? "partida" : "partidas"} · {c.matchesWon}{" "}
                      {c.matchesWon === 1 ? "título" : "títulos"} · {c.roundWins} vitórias de rodada
                    </div>
                  </div>
                  <ChevronRight className="text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
