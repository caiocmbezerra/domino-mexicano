import { History, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useConfirm } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";
import { EmptyState, SectionTitle, TopBar } from "../components/ui";
import { formatDate, formatDateTime, joinNames } from "../domain/format";
import { deleteMatch } from "../domain/operations";
import { analyzeMatch } from "../domain/stats";
import type { Match } from "../domain/types";
import { useNameOf, useStore } from "../state/store";

export function HistoryScreen() {
  const { db, apply } = useStore();
  const confirm = useConfirm();
  const toast = useToast();
  const nameOf = useNameOf();
  const sorted = [...db.matches].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const inProgress = sorted.filter((m) => m.status === "in_progress");
  const finished = sorted.filter((m) => m.status === "finished");

  const onDelete = async (m: Match) => {
    const ok = await confirm({
      title: "Excluir partida?",
      message: `A partida de ${formatDate(m.startedAt)} (${joinNames(m.participantIds.map(nameOf))}) e todas as suas rodadas serão apagadas definitivamente.`,
      confirmLabel: "Excluir definitivamente",
      danger: true,
    });
    if (ok && apply((d) => deleteMatch(d, m.id))) toast.show("Partida excluída.", "success");
  };

  const row = (m: Match) => {
    const a = analyzeMatch(db, m.id)!;
    const champions = a.ranking.filter((e) => e.position === 1);
    return (
      <li key={m.id} className="card flex items-stretch">
        <Link to={`/partida/${m.id}`} className="min-w-0 flex-1 p-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold">{formatDateTime(m.startedAt)}</span>
            {m.status === "in_progress" && <span className="badge badge-good">em andamento</span>}
          </div>
          <div className="truncate text-sm text-muted">{joinNames(m.participantIds.map(nameOf))}</div>
          <div className="mt-1 text-sm">
            {a.data.closedRounds.length} rodadas
            {m.status === "finished" && champions.length > 0 && (
              <>
                {" · "}🏆 <b>{joinNames(champions.map((e) => nameOf(e.stats.playerId)))}</b> ({champions[0].stats.total} pts)
                {champions.length > 1 && " — empate"}
              </>
            )}
          </div>
        </Link>
        <button className="icon-btn m-2 self-center text-danger" aria-label="Excluir partida" onClick={() => onDelete(m)}>
          <Trash2 size={20} />
        </button>
      </li>
    );
  };

  return (
    <div className="screen">
      <TopBar title="Histórico de partidas" subtitle={`${finished.length} encerradas`} back="/" />
      {inProgress.length > 0 && (
        <>
          <SectionTitle>Em andamento</SectionTitle>
          <ul className="grid gap-2">{inProgress.map(row)}</ul>
        </>
      )}
      <SectionTitle>Encerradas</SectionTitle>
      {finished.length === 0 ? (
        <EmptyState icon={<History size={40} />} title="Nenhuma partida encerrada">
          Ao encerrar uma partida, o resultado aparece aqui para consulta.
        </EmptyState>
      ) : (
        <ul className="grid gap-2">{finished.map(row)}</ul>
      )}
    </div>
  );
}
