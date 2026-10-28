import { AlertTriangle, ChevronUp, Check, SkipForward } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useConfirm } from "../components/ConfirmDialog";
import { DominoTile } from "../components/DominoTile";
import { DoublesStrip } from "../components/MatchViews";
import { BottomBar, SectionTitle, TopBar, haptic } from "../components/ui";
import { getMatch, getMatchRounds, getOpenRound } from "../domain/database";
import { allDoubles, doubleLabel, eligibleDoubles, searchNext, searchPrevious, startSearch, usedDoubles } from "../domain/doubles";
import { openRound, setOpeningSearch } from "../domain/operations";
import type { ID } from "../domain/types";
import { useNameOf, useStore } from "../state/store";

export function OpeningScreen() {
  const { matchId = "" } = useParams();
  const { db, apply, run } = useStore();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const nameOf = useNameOf();
  const [opener, setOpener] = useState<ID | null>(null);
  const [exceptionMode, setExceptionMode] = useState(false);
  const [exceptionDouble, setExceptionDouble] = useState<number | null>(null);
  const [exceptionNote, setExceptionNote] = useState("");

  const match = getMatch(db, matchId);
  if (!match) return <Navigate to="/" replace />;
  if (match.status !== "in_progress") return <Navigate to={`/partida/${matchId}`} replace />;
  const open = getOpenRound(db, matchId);
  if (open) return <Navigate to={`/partida/${matchId}/rodada/${open.id}`} replace />;

  const highest = match.settings.highestDouble;
  const rounds = getMatchRounds(db, matchId);
  const used = usedDoubles(rounds);
  const eligible = eligibleDoubles(used, highest);
  const roundNumber = (rounds[rounds.length - 1]?.number ?? 0) + 1;

  // Posição da busca (persistida para sobreviver ao fechamento do app).
  let current: number | null;
  if (match.openingSearch === "exhausted") current = null;
  else if (typeof match.openingSearch === "number" && eligible.includes(match.openingSearch)) current = match.openingSearch;
  else current = startSearch(used, highest);
  const exhausted = current === null;
  const noneLeft = eligible.length === 0;

  const go = (value: number | null) => {
    haptic();
    setOpener(null);
    apply((d) => setOpeningSearch(d, matchId, value === null ? "exhausted" : value));
  };

  const confirmOpening = () => {
    if (current === null || !opener) return;
    const roundId = run((d) => {
      const r = openRound(d, matchId, { double: current, openerId: opener });
      return { db: r.db, value: r.id };
    });
    if (roundId) {
      haptic(25);
      navigate(`/partida/${matchId}/rodada/${roundId}`, { replace: true });
    }
  };

  const confirmException = async () => {
    if (!opener) return;
    const ok = await confirm({
      title: "Abrir rodada por exceção?",
      message: (
        <>
          A rodada {roundNumber} será aberta por <b>{nameOf(opener)}</b>{" "}
          {exceptionDouble === null ? "sem carroção" : `com o ${doubleLabel(exceptionDouble)}`} e ficará marcada como
          exceção manual no histórico.
        </>
      ),
      confirmLabel: "Abrir por exceção",
    });
    if (!ok) return;
    const roundId = run((d) => {
      const r = openRound(d, matchId, {
        double: exceptionDouble,
        openerId: opener,
        manualException: true,
        exceptionNote,
      });
      return { db: r.db, value: r.id };
    });
    if (roundId) navigate(`/partida/${matchId}/rodada/${roundId}`, { replace: true });
  };

  const playerPicker = (
    <div className="grid grid-cols-2 gap-2">
      {match.participantIds.map((id) => (
        <button
          key={id}
          className="chip !min-h-16 text-lg"
          aria-pressed={opener === id}
          onClick={() => {
            haptic();
            setOpener(opener === id ? null : id);
          }}
        >
          {opener === id && <Check size={20} className="text-accent" />}
          <span className="truncate">{nameOf(id)}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="screen">
      <TopBar title={`Abertura da rodada ${roundNumber}`} subtitle="Busca do maior carroção elegível" back={`/partida/${matchId}`} />

      {!exhausted && current !== null && (
        <>
          <section className="card mt-2 flex items-center gap-5 p-5">
            <div key={current} className="animate-flip">
              <DominoTile value={current} size={64} />
            </div>
            <div className="min-w-0">
              <div className="label">Carroção de abertura</div>
              <div className="num text-5xl font-black">{doubleLabel(current)}</div>
              <div className="mt-1 text-muted">Alguém tem o {doubleLabel(current)}?</div>
            </div>
          </section>

          <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
            <button
              className="btn btn-ghost"
              aria-label="Voltar para o carroção anterior"
              disabled={eligible[0] === current}
              onClick={() => go(searchPrevious(current, used, highest))}
            >
              <ChevronUp size={22} /> Voltar
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => go(searchNext(current, used, highest))}>
              <SkipForward size={22} /> Ninguém tem
            </button>
          </div>

          <SectionTitle>Quem tem o {doubleLabel(current)}?</SectionTitle>
          {playerPicker}
        </>
      )}

      {exhausted && (
        <section className="card mt-2 border-danger p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 shrink-0 text-danger" />
            <div>
              <div className="text-lg font-extrabold">
                {noneLeft ? "Todos os carroções já foram utilizados" : "Nenhum carroção elegível encontrado"}
              </div>
              <p className="mt-1 text-muted">
                {noneLeft
                  ? "Os 13 carroções (12-12 a 0-0) já abriram rodadas nesta partida. Não há próximo carroção."
                  : `Ninguém tem os carroções restantes (${eligible.map(doubleLabel).join(", ")}).`}{" "}
                Você pode encerrar a partida ou, se a turma combinar, abrir a rodada por exceção manual.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {!noneLeft && (
              <button className="btn btn-secondary" onClick={() => go(searchPrevious(null, used, highest))}>
                <ChevronUp size={20} /> Voltar à busca
              </button>
            )}
            {rounds.length > 0 && (
              <button className="btn btn-secondary" onClick={() => navigate(`/partida/${matchId}/encerrar`)}>
                Encerrar partida
              </button>
            )}
            {!exceptionMode && (
              <button className="btn btn-ghost" onClick={() => setExceptionMode(true)}>
                Abrir por exceção manual
              </button>
            )}
          </div>
        </section>
      )}

      {exhausted && exceptionMode && (
        <section className="mt-2 animate-rise">
          <SectionTitle>Exceção manual — carroção usado</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <button className="chip" aria-pressed={exceptionDouble === null} onClick={() => setExceptionDouble(null)}>
              Sem carroção
            </button>
            {allDoubles(highest).map((d) => (
              <button key={d} className="chip num !min-w-14" aria-pressed={exceptionDouble === d} onClick={() => setExceptionDouble(d)}>
                {d}-{d}
              </button>
            ))}
          </div>
          <SectionTitle>Quem abriu?</SectionTitle>
          {playerPicker}
          <SectionTitle>Observação (opcional)</SectionTitle>
          <input
            className="input"
            placeholder="Ex.: combinado pela turma"
            value={exceptionNote}
            maxLength={80}
            onChange={(e) => setExceptionNote(e.target.value)}
          />
        </section>
      )}

      <SectionTitle>Carroções da partida</SectionTitle>
      <DoublesStrip used={used} highest={highest} current={current} />
      <p className="mt-2 text-sm text-muted">Riscados: já abriram uma rodada e não podem abrir de novo.</p>

      {(!exhausted || exceptionMode) && (
        <BottomBar>
          <button
            className="btn btn-primary btn-lg w-full"
            disabled={!opener}
            onClick={exhausted ? confirmException : confirmOpening}
          >
            <Check size={22} />
            {opener
              ? exhausted
                ? `Abrir por exceção · ${nameOf(opener)}`
                : <span>
                    Confirmar: {nameOf(opener)} abre com{" "}
                    <span className="whitespace-nowrap">{doubleLabel(current)}</span>
                  </span>
              : "Selecione quem abriu"}
          </button>
        </BottomBar>
      )}
    </div>
  );
}
