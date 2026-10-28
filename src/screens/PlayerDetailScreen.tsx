import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useConfirm } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";
import { EmptyState, SectionTitle, TopBar } from "../components/ui";
import { formatDate } from "../domain/format";
import { deletePlayer, playerHasHistory, renamePlayer } from "../domain/operations";
import { analyzeMatch, computeCareerStats } from "../domain/stats";
import { useStore } from "../state/store";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-3 text-center">
      <div className="num text-3xl font-black">{value}</div>
      <div className="text-xs font-semibold text-muted">{label}</div>
    </div>
  );
}

export function PlayerDetailScreen() {
  const { playerId = "" } = useParams();
  const { db, apply } = useStore();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const player = db.players.find((p) => p.id === playerId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player?.name ?? "");

  if (!player) {
    return (
      <div className="screen">
        <TopBar title="Jogador" back="/jogadores" />
        <EmptyState icon={null} title="Jogador não encontrado" />
      </div>
    );
  }

  const c = computeCareerStats(db).find((x) => x.playerId === player.id)!;
  const participations = db.matches
    .filter((m) => m.participantIds.includes(player.id))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const hasHistory = playerHasHistory(db, player.id);

  const onDelete = async () => {
    const ok = await confirm({
      title: `Excluir ${player.name}?`,
      message: "O jogador será removido da lista. Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      danger: true,
    });
    if (ok && apply((d) => deletePlayer(d, player.id))) {
      toast.show("Jogador excluído.", "success");
      navigate("/jogadores");
    }
  };

  return (
    <div className="screen">
      <TopBar title={player.name} subtitle={`Cadastrado em ${formatDate(player.createdAt)}`} back="/jogadores" />

      {editing ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (apply((d) => renamePlayer(d, player.id, name))) {
              setEditing(false);
              toast.show("Nome atualizado.", "success");
            }
          }}
        >
          <input className="input" value={name} maxLength={30} autoFocus onChange={(e) => setName(e.target.value)} aria-label="Novo nome" />
          <button className="btn btn-primary" type="submit">
            Salvar
          </button>
        </form>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="btn btn-secondary" onClick={() => { setName(player.name); setEditing(true); }}>
            <Pencil size={18} /> Renomear
          </button>
          <button className="btn btn-ghost" onClick={onDelete} disabled={hasHistory} title={hasHistory ? "Jogador com partidas registradas" : undefined}>
            <Trash2 size={18} /> Excluir
          </button>
        </div>
      )}
      {hasHistory && !editing && (
        <p className="mt-2 text-sm text-muted">Jogadores com partidas registradas não podem ser excluídos, para preservar o histórico.</p>
      )}

      <SectionTitle>Estatísticas acumuladas (partidas encerradas)</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="partidas" value={c.matchesPlayed} />
        <Stat label="títulos" value={c.matchesWon} />
        <Stat label="rodadas" value={c.roundsPlayed} />
        <Stat label="vitórias de rodada" value={c.roundWins} />
        <Stat label="média por rodada" value={c.averagePerRound.toFixed(1)} />
        <Stat label="maior rodada" value={c.highestRound} />
        <Stat label="pontos totais" value={c.totalPoints} />
        <Stat label="aberturas" value={c.opens} />
        <Stat label="com 0-0" value={c.zeroDoubles} />
      </div>

      <SectionTitle>Participações</SectionTitle>
      {participations.length === 0 ? (
        <EmptyState icon={null} title="Ainda não participou de partidas" />
      ) : (
        <ul className="card divide-y divide-line">
          {participations.map((m) => {
            const a = analyzeMatch(db, m.id)!;
            const entry = a.ranking.find((e) => e.stats.playerId === player.id)!;
            return (
              <li key={m.id}>
                <Link to={`/partida/${m.id}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold">{formatDate(m.startedAt)}</div>
                    <div className="text-sm text-muted">
                      {m.status === "in_progress" ? "Em andamento" : `${entry.position}º lugar${entry.tied ? " (empate)" : ""}`} ·{" "}
                      {a.data.closedRounds.length} rodadas
                    </div>
                  </div>
                  <div className="num text-2xl font-black">{entry.stats.total}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
