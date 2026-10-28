import { Flag } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useConfirm } from "../components/ConfirmDialog";
import { PointsRanking, RecordsList } from "../components/MatchViews";
import { Podium } from "../components/Podium";
import { useToast } from "../components/Toast";
import { BottomBar, SectionTitle, TopBar, haptic } from "../components/ui";
import { getMatch, getOpenRound } from "../domain/database";
import { formatDate } from "../domain/format";
import { deleteMatch, finishMatch } from "../domain/operations";
import { analyzeMatch } from "../domain/stats";
import { useStore } from "../state/store";

export function FinishScreen() {
  const { matchId = "" } = useParams();
  const { db, apply } = useStore();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();

  const match = getMatch(db, matchId);
  if (!match) return <Navigate to="/" replace />;
  if (match.status === "finished") return <Navigate to={`/partida/${matchId}`} replace />;
  const analysis = analyzeMatch(db, matchId)!;
  const open = getOpenRound(db, matchId);
  const closedCount = analysis.data.closedRounds.length;

  const onFinish = async () => {
    const ok = await confirm({
      title: "Encerrar a partida?",
      message: "O resultado vai para o histórico e não poderá mais ser alterado.",
      confirmLabel: "Encerrar partida",
    });
    if (ok && apply((d) => finishMatch(d, matchId))) {
      haptic(40);
      toast.show("Partida encerrada!", "success");
      navigate(`/partida/${matchId}`, { replace: true });
    }
  };

  const onDiscard = async () => {
    const ok = await confirm({
      title: "Excluir esta partida?",
      message: "Nenhuma rodada foi fechada. A partida será apagada definitivamente.",
      confirmLabel: "Excluir partida",
      danger: true,
    });
    if (ok && apply((d) => deleteMatch(d, matchId))) navigate("/", { replace: true });
  };

  return (
    <div className="screen">
      <TopBar title="Encerrar partida" subtitle={`${formatDate(match.startedAt)} · ${closedCount} rodadas`} back={`/partida/${matchId}`} />

      {open && (
        <div className="card mt-2 border-danger p-4">
          <p className="font-extrabold">A rodada {open.number} ainda está em andamento.</p>
          <p className="text-muted">Feche-a ou desfaça-a antes de encerrar a partida.</p>
          <button className="btn btn-secondary mt-3 w-full" onClick={() => navigate(`/partida/${matchId}/rodada/${open.id}`)}>
            Ir para a rodada {open.number}
          </button>
        </div>
      )}

      {closedCount === 0 ? (
        <div className="card mt-2 p-4">
          <p className="font-extrabold">Nenhuma rodada foi fechada.</p>
          <p className="text-muted">Não há resultado para salvar no histórico.</p>
          {!open && (
            <button className="btn btn-danger mt-3 w-full" onClick={onDiscard}>
              Excluir partida
            </button>
          )}
        </div>
      ) : (
        <>
          <h2 className="label mt-4">Ranking final (prévia)</h2>
          <Podium analysis={analysis} />
          <SectionTitle>Classificação completa</SectionTitle>
          <PointsRanking analysis={analysis} />
          <SectionTitle>Recordes</SectionTitle>
          <RecordsList analysis={analysis} />
          <BottomBar>
            <button className="btn btn-primary btn-lg w-full" disabled={Boolean(open)} onClick={onFinish}>
              <Flag size={22} /> Confirmar encerramento
            </button>
          </BottomBar>
        </>
      )}
    </div>
  );
}
