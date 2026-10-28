import { ArrowDown, ArrowUp, Camera, Check, LogOut, Trophy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useConfirm } from "../components/ConfirmDialog";
import { DominoTile } from "../components/DominoTile";
import { PhotoCountSheet } from "../components/PhotoCountSheet";
import { PHOTO_COUNT } from "../config";
import { useToast } from "../components/Toast";
import { BottomBar, SectionTitle, TopBar, haptic } from "../components/ui";
import { getMatch, getMatchRounds } from "../domain/database";
import { doubleLabel } from "../domain/doubles";
import { formatDateTime } from "../domain/format";
import { closeRound, editClosedRound, setRoundOpener, updateDraft } from "../domain/operations";
import { computeRoundResults, parsePoints } from "../domain/scoring";
import { collectMatchData } from "../domain/stats";
import type { ID, RoundDraft } from "../domain/types";
import { useNameOf, useStore } from "../state/store";

export function RoundScreen() {
  const { matchId = "", roundId = "" } = useParams();
  const { db, apply } = useStore();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const nameOf = useNameOf();

  const match = getMatch(db, matchId);
  const round = db.rounds.find((r) => r.id === roundId && r.matchId === matchId);
  const isOpen = round?.status === "open";
  const readOnly = match?.status !== "in_progress";

  // Rodada aberta: o rascunho vive no banco (salvo a cada toque).
  // Rodada fechada: a correção é local até ser confirmada.
  const [editDraft, setEditDraft] = useState<RoundDraft | null>(round && !isOpen ? round.draft : null);
  const [editOpener, setEditOpener] = useState<ID | null>(round?.openerId ?? null);
  const [changingOpener, setChangingOpener] = useState(false);
  const [photoFor, setPhotoFor] = useState<ID | null>(null);
  const inputs = useRef<Record<ID, HTMLInputElement | null>>({});

  useEffect(() => {
    if (round && !isOpen && editDraft === null) setEditDraft(round.draft);
  }, [round, isOpen, editDraft]);

  if (!match || !round) return <Navigate to={match ? `/partida/${matchId}` : "/"} replace />;

  const draft: RoundDraft = isOpen ? round.draft : (editDraft ?? round.draft);
  const opener = isOpen ? round.openerId : editOpener;
  const participants = match.participantIds;

  const setDraft = (next: RoundDraft) => {
    if (readOnly) return;
    if (isOpen) apply((d) => updateDraft(d, round.id, next));
    else setEditDraft(next);
  };

  const outcome = computeRoundResults(draft, participants, match.settings, nameOf);
  const resultOf = (id: ID) => outcome.results.find((r) => r.playerId === id)!;

  // Totais acumulados: rodadas fechadas, exceto esta, + o que está sendo lançado agora.
  const data = collectMatchData(db, matchId)!;
  const otherRoundIds = new Set(data.closedRounds.filter((r) => r.id !== round.id).map((r) => r.id));
  const baseTotal = (id: ID) =>
    data.results.filter((r) => r.playerId === id && otherRoundIds.has(r.roundId)).reduce((s, r) => s + r.countedPoints, 0);

  const remaining = participants.filter((id) => !draft.exitOrder.includes(id));
  const canExit = remaining.length > 1;

  const registerExit = (id: ID) => {
    if (!canExit) return;
    haptic(18);
    const points = { ...draft.points };
    // Quem sai depois do vencedor normalmente não tem peças: sugere 0 (editável).
    if (draft.exitOrder.length > 0 && points[id] == null) points[id] = 0;
    setDraft({ ...draft, exitOrder: [...draft.exitOrder, id], points });
  };
  const removeExit = (id: ID) => setDraft({ ...draft, exitOrder: draft.exitOrder.filter((x) => x !== id) });
  const moveExit = (index: number, delta: number) => {
    const order = [...draft.exitOrder];
    const [item] = order.splice(index, 1);
    order.splice(index + delta, 0, item);
    setDraft({ ...draft, exitOrder: order });
  };
  const setPoints = (id: ID, text: string) =>
    setDraft({ ...draft, points: { ...draft.points, [id]: parsePoints(text.replace(/\D/g, "").slice(0, 4)) } });
  const toggleZero = (id: ID) => {
    haptic();
    setDraft({ ...draft, zeroDouble: { ...draft.zeroDouble, [id]: !draft.zeroDouble[id] } });
  };

  const focusNext = (id: ID) => {
    const order = participants.filter((p) => p !== draft.exitOrder[0]);
    const next = order[order.indexOf(id) + 1];
    if (next) inputs.current[next]?.focus();
    else inputs.current[id]?.blur();
  };

  const summary = (
    <div className="mt-2 grid gap-3 text-fg">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-surface p-3">
          <div className="text-muted">Carroção</div>
          <div className="text-lg font-black">{doubleLabel(round.openingDouble)}</div>
        </div>
        <div className="rounded-xl bg-surface p-3">
          <div className="text-muted">Abriu</div>
          <div className="truncate text-lg font-black">{nameOf(opener)}</div>
        </div>
      </div>
      <div className="rounded-xl bg-surface p-3 text-sm">
        <div className="text-muted">Ordem de saída</div>
        <div className="font-bold">
          {draft.exitOrder.map((id, i) => `${i + 1}º ${nameOf(id)}`).join(" · ")}
          {remaining.length > 0 && ` · ficaram com peças: ${remaining.map(nameOf).join(", ")}`}
        </div>
      </div>
      <table className="w-full text-left">
        <thead className="text-xs uppercase text-muted">
          <tr>
            <th className="py-1">Jogador</th>
            <th className="py-1 text-right">Rodada</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="num">
          {participants.map((id) => {
            const r = resultOf(id);
            return (
              <tr key={id} className="border-t border-line">
                <td className="py-1.5 font-bold">
                  {nameOf(id)}
                  {r.isWinner && " 🏆"}
                  {r.hadZeroDouble && " · 0-0"}
                </td>
                <td className="py-1.5 text-right font-bold">{r.countedPoints}</td>
                <td className="py-1.5 text-right font-black">{baseTotal(id) + r.countedPoints}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const onClose = async () => {
    if (outcome.errors.length) {
      toast.show(outcome.errors[0], "error");
      return;
    }
    const ok = await confirm({
      title: isOpen ? `Fechar a rodada ${round.number}?` : `Salvar correção da rodada ${round.number}?`,
      message: (
        <>
          {!isOpen && (
            <p className="mb-2 text-sm">Totais, ranking e estatísticas de toda a partida serão recalculados.</p>
          )}
          {summary}
        </>
      ),
      confirmLabel: isOpen ? "Fechar rodada" : "Salvar correção",
    });
    if (!ok) return;
    const saved = isOpen
      ? apply((d) => closeRound(d, round.id))
      : apply((d) => editClosedRound(d, round.id, draft, opener));
    if (saved) {
      haptic(30);
      toast.show(isOpen ? `Rodada ${round.number} fechada!` : `Rodada ${round.number} corrigida.`, "success");
      navigate(`/partida/${matchId}`, { replace: true });
    }
  };

  const title = readOnly ? `Rodada ${round.number}` : isOpen ? `Rodada ${round.number}` : `Corrigir rodada ${round.number}`;
  const rounds = getMatchRounds(db, matchId);

  return (
    <div className="screen">
      <TopBar
        title={title}
        subtitle={isOpen ? "Em andamento" : `Fechada em ${round.closedAt ? formatDateTime(round.closedAt) : "—"}`}
        back={`/partida/${matchId}`}
      />

      <section className="card mt-2 flex items-center gap-4 p-4">
        {round.openingDouble !== null ? (
          <DominoTile value={round.openingDouble} size={40} />
        ) : (
          <div className="flex h-20 w-10 items-center justify-center rounded-lg border-2 border-dashed border-line text-muted">?</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="label">Carroção de abertura</div>
          <div className="text-2xl font-black">{doubleLabel(round.openingDouble)}</div>
          <div className="truncate text-muted">
            Abriu: <b className="text-fg">{nameOf(opener)}</b>
          </div>
          {round.manualException && <span className="badge badge-danger mt-1">Exceção manual · {round.exceptionNote}</span>}
        </div>
        {!readOnly && (
          <button className="btn btn-ghost !min-h-11 !px-3 text-sm" onClick={() => setChangingOpener((v) => !v)}>
            Alterar
          </button>
        )}
      </section>
      {changingOpener && !readOnly && (
        <div className="mt-2 grid grid-cols-2 gap-2 animate-rise">
          {participants.map((id) => (
            <button
              key={id}
              className="chip"
              aria-pressed={opener === id}
              onClick={() => {
                if (isOpen) apply((d) => setRoundOpener(d, round.id, id));
                else setEditOpener(id);
                setChangingOpener(false);
              }}
            >
              {nameOf(id)}
            </button>
          ))}
        </div>
      )}

      {/* ------------------------------------------------ Ordem de saída */}
      <SectionTitle right={<span className="text-sm text-muted">{draft.exitOrder.length} saíram</span>}>
        Ordem de saída
      </SectionTitle>
      {draft.exitOrder.length > 0 && (
        <ol className="card mb-3 divide-y divide-line">
          {draft.exitOrder.map((id, i) => (
            <li key={id} className="flex items-center gap-1 py-1.5 pl-3 pr-1.5 animate-pop">
              <span
                className={`num flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black ${
                  i === 0 ? "bg-accent text-accent-fg" : "bg-card-2"
                }`}
              >
                {i + 1}º
              </span>
              <span className="ml-2 min-w-0 flex-1 truncate text-lg font-extrabold">
                {nameOf(id)}
                {i === 0 && <span className="ml-2 text-sm font-bold text-accent">vencedor</span>}
              </span>
              {!readOnly && (
                <>
                  <button className="icon-btn" aria-label={`Subir ${nameOf(id)}`} disabled={i === 0} onClick={() => moveExit(i, -1)}>
                    <ArrowUp size={20} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Descer ${nameOf(id)}`}
                    disabled={i === draft.exitOrder.length - 1}
                    onClick={() => moveExit(i, 1)}
                  >
                    <ArrowDown size={20} />
                  </button>
                  <button className="icon-btn text-danger" aria-label={`Remover ${nameOf(id)} da ordem`} onClick={() => removeExit(id)}>
                    <X size={22} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      {!readOnly && (
        <>
          <p className="mb-2 font-bold">
            {canExit
              ? `Quem saiu em ${draft.exitOrder.length + 1}º lugar?`
              : "Os demais ficaram com peças."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {remaining.map((id) => (
              <button key={id} className="chip !min-h-16 text-lg" disabled={!canExit} onClick={() => registerExit(id)}>
                <LogOut size={18} className="text-muted" />
                <span className="truncate">{nameOf(id)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ------------------------------------------------ Pontos */}
      <SectionTitle>Pontos das peças na mão</SectionTitle>
      <ul className="grid gap-2">
        {participants.map((id) => {
          const r = resultOf(id);
          const zero = Boolean(draft.zeroDouble[id]);
          const zeroRule = match.settings.zeroDoubleScoresZero && zero;
          const value = draft.points[id];
          return (
            <li key={id} className={`card p-3 ${r.isWinner ? "border-accent" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {r.isWinner && <Trophy size={18} className="shrink-0 text-accent" />}
                    <span className="truncate text-lg font-extrabold">{nameOf(id)}</span>
                  </div>
                  <div className="text-sm text-muted">
                    {r.exitPosition ? `${r.exitPosition}º a sair` : "Ficou com peças"}
                    {" · "}total <span className="num font-bold text-fg">{baseTotal(id) + r.countedPoints}</span>
                  </div>
                </div>
                {r.isWinner ? (
                  <div className="points-input num flex items-center justify-center text-accent" aria-label={`${nameOf(id)}: zero pontos, vencedor`}>
                    0
                  </div>
                ) : (
                  <>
                  {PHOTO_COUNT.enabled && db.settings.photoCount && !readOnly && (
                    <button
                      className="icon-btn !h-14 !w-14 bg-card-2"
                      aria-label={`Contar pontos de ${nameOf(id)} por foto`}
                      onClick={() => setPhotoFor(id)}
                    >
                      <Camera size={24} />
                    </button>
                  )}
                  <input
                    ref={(el) => {
                      inputs.current[id] = el;
                    }}
                    className="points-input num"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint="next"
                    placeholder={zeroRule ? "0" : "—"}
                    aria-label={`Pontos de ${nameOf(id)}`}
                    disabled={readOnly}
                    value={value ?? ""}
                    onChange={(e) => setPoints(id, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && focusNext(id)}
                    onFocus={(e) => e.target.select()}
                  />
                  </>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  className="chip !min-h-11 text-sm"
                  aria-pressed={zero}
                  disabled={readOnly}
                  onClick={() => toggleZero(id)}
                >
                  {zero && <Check size={16} className="text-accent" />} Terminou com o 0-0
                </button>
                <span className="text-sm text-muted">
                  {r.isWinner
                    ? "Vencedor: 0"
                    : zeroRule
                      ? "Regra do 0-0: conta 0"
                      : value != null
                        ? `Conta ${r.countedPoints}`
                        : "Falta informar"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {!readOnly && outcome.errors.length > 0 && (
        <ul className="mt-4 grid gap-1 text-sm text-danger" aria-live="polite">
          {outcome.errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}
      {readOnly && rounds.length > 0 && <p className="mt-4 text-sm text-muted">Partida encerrada: consulta somente leitura.</p>}

      {photoFor && (
        <PhotoCountSheet
          playerName={nameOf(photoFor)}
          onClose={() => setPhotoFor(null)}
          onApply={(points, hadZero) => {
            setDraft({
              ...draft,
              points: { ...draft.points, [photoFor]: points },
              // A foto só MARCA o 0-0 quando o encontra; nunca desmarca uma marcação manual.
              zeroDouble: hadZero ? { ...draft.zeroDouble, [photoFor]: true } : draft.zeroDouble,
            });
            toast.show(`${nameOf(photoFor)}: ${points} pontos pela foto.`, "success");
            setPhotoFor(null);
          }}
        />
      )}

      {!readOnly && (
        <BottomBar>
          <button className="btn btn-primary btn-lg w-full" onClick={onClose} disabled={outcome.errors.length > 0}>
            <Check size={22} /> {isOpen ? "Revisar e fechar rodada" : "Revisar e salvar correção"}
          </button>
        </BottomBar>
      )}
    </div>
  );
}
