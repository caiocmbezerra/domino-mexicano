import { Flag, Play, Undo2 } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useConfirm } from "../components/ConfirmDialog";
import { DominoTile } from "../components/DominoTile";
import { DoublesStrip, ExitRanking, PlayerStatsCards, PointsRanking, RecordsList } from "../components/MatchViews";
import { ShareButtons } from "../components/ShareButtons";
import { useToast } from "../components/Toast";
import { BottomBar, SectionTitle, TopBar } from "../components/ui";
import { getMatch, getMatchRounds, getOpenRound } from "../domain/database";
import { doubleLabel, usedDoubles } from "../domain/doubles";
import { buildResultText, formatDate, formatDateTime } from "../domain/format";
import { undoLastRound } from "../domain/operations";
import { analyzeMatch } from "../domain/stats";
import { useNameOf, useStore } from "../state/store";
import { Podium } from "../components/Podium";
import { ScoreSheet } from "../components/ScoreSheet";

type Tab = "ranking" | "planilha" | "saidas" | "estatisticas";
// Durante a partida não há classificação: só a planilha e os números de cada um.
// Ranking por pontos e por saídas aparecem apenas depois do encerramento.
const TABS_IN_PROGRESS: { id: Tab; label: string }[] = [
  { id: "planilha", label: "Planilha" },
  { id: "estatisticas", label: "Estatísticas" },
];
const TABS_FINISHED: { id: Tab; label: string }[] = [
  { id: "ranking", label: "Ranking" },
  { id: "planilha", label: "Planilha" },
  { id: "saidas", label: "Saídas" },
  { id: "estatisticas", label: "Estatísticas" },
];

export function MatchScreen() {
  const { matchId = "" } = useParams();
  const { db, apply } = useStore();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const nameOf = useNameOf();
  const [tab, setTab] = useState<Tab | null>(null);

  const match = getMatch(db, matchId);
  if (!match) return <Navigate to="/" replace />;
  const analysis = analyzeMatch(db, matchId)!;
  const rounds = getMatchRounds(db, matchId);
  const open = getOpenRound(db, matchId);
  const finished = match.status === "finished";
  const nextNumber = open ? open.number : (rounds[rounds.length - 1]?.number ?? 0) + 1;
  const lastRound = rounds[rounds.length - 1];
  const tabs = finished ? TABS_FINISHED : TABS_IN_PROGRESS;
  const activeTab: Tab = tab && tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  const onUndo = async () => {
    if (!lastRound) return;
    const ok = await confirm({
      title: `Desfazer a rodada ${lastRound.number}?`,
      message: (
        <>
          A rodada {lastRound.number} ({doubleLabel(lastRound.openingDouble)}, aberta por {nameOf(lastRound.openerId)})
          {lastRound.status === "closed" ? " e todos os seus pontos serão apagados" : " será descartada"}. O carroção volta
          a ficar disponível para abertura.
        </>
      ),
      confirmLabel: "Desfazer rodada",
      danger: true,
    });
    if (ok && apply((d) => undoLastRound(d, matchId))) toast.show(`Rodada ${lastRound.number} desfeita.`, "success");
  };

  return (
    <div className="screen">
      <TopBar
        title={finished ? "Resultado da partida" : `Rodada ${nextNumber}`}
        subtitle={
          finished
            ? `${formatDate(match.startedAt)} · ${analysis.data.closedRounds.length} rodadas`
            : `${match.participantIds.length} jogadores · iniciada ${formatDateTime(match.startedAt)}`
        }
        back="/"
      />

      {finished && (
        <>
          <Podium analysis={analysis} />
          <p className="mt-2 text-center text-sm text-muted">
            Encerrada em {match.endedAt ? formatDateTime(match.endedAt) : "—"} · somente consulta
          </p>
        </>
      )}

      {!finished && open && (
        <button
          className="card mt-2 flex w-full items-center gap-4 p-4 text-left"
          onClick={() => navigate(`/partida/${matchId}/rodada/${open.id}`)}
        >
          {open.openingDouble !== null && <DominoTile value={open.openingDouble} size={34} />}
          <div className="min-w-0 flex-1">
            <div className="label">Rodada {open.number} em andamento</div>
            <div className="text-xl font-black">{doubleLabel(open.openingDouble)}</div>
            <div className="truncate text-muted">Abriu: {nameOf(open.openerId)}</div>
          </div>
        </button>
      )}

      <div className="tabs mt-4" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={activeTab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4" role="tabpanel">
        {activeTab === "ranking" && <PointsRanking analysis={analysis} />}

        {activeTab === "planilha" && (
          <>
            <ScoreSheet analysis={analysis} />
            <SectionTitle>Carroções utilizados</SectionTitle>
            <DoublesStrip used={usedDoubles(rounds)} highest={match.settings.highestDouble} />
          </>
        )}

        {activeTab === "saidas" && <ExitRanking analysis={analysis} />}

        {activeTab === "estatisticas" && (
          <>
            {finished && (
              <>
                <h2 className="label mb-3">Recordes da partida</h2>
                <RecordsList analysis={analysis} />
              </>
            )}
            <SectionTitle>Desempenho por jogador</SectionTitle>
            <PlayerStatsCards analysis={analysis} ranked={finished} />
            {!finished && <p className="mt-3 text-sm text-muted">Recordes e classificação aparecem ao encerrar a partida.</p>}
          </>
        )}
      </div>

      {finished && (
        <>
          <SectionTitle>Compartilhar</SectionTitle>
          <ShareButtons title={db.settings.appName} text={buildResultText(analysis, nameOf)} />
        </>
      )}

      {!finished && (
        <>
          <SectionTitle>Partida</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost" onClick={onUndo} disabled={!lastRound}>
              <Undo2 size={20} /> Desfazer rodada
            </button>
            <button className="btn btn-ghost" onClick={() => navigate(`/partida/${matchId}/encerrar`)}>
              <Flag size={20} /> Encerrar
            </button>
          </div>
          <BottomBar>
            <button
              className="btn btn-primary btn-lg w-full"
              onClick={() =>
                navigate(open ? `/partida/${matchId}/rodada/${open.id}` : `/partida/${matchId}/abertura`)
              }
            >
              <Play size={22} /> {open ? `Registrar rodada ${open.number}` : `Abrir rodada ${nextNumber}`}
            </button>
          </BottomBar>
        </>
      )}
    </div>
  );
}
