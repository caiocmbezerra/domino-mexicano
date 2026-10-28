import { Pencil, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMatchRounds } from "../domain/database";
import { doubleLabel } from "../domain/doubles";
import { cumulativeTotalsUpTo, type MatchAnalysis } from "../domain/stats";
import type { Round } from "../domain/types";
import { useNameOf, useStore } from "../state/store";
import { DominoTile } from "./DominoTile";

/**
 * Planilha da partida: jogadores em linhas (na ordem de exibição), rodadas em colunas
 * e o somatório fixo à direita. Tocar numa rodada abre o detalhe dela.
 * Não ordena nem classifica ninguém — o ranking só aparece no encerramento.
 */
export function ScoreSheet({ analysis }: { analysis: MatchAnalysis }) {
  const { db } = useStore();
  const nameOf = useNameOf();
  const navigate = useNavigate();
  const { match } = analysis.data;
  const rounds = getMatchRounds(db, match.id);
  const [selected, setSelected] = useState<Round | null>(null);
  const totalOf = (id: string) => analysis.stats.find((s) => s.playerId === id)?.total ?? 0;
  const resultOf = (roundId: string, playerId: string) =>
    db.results.find((r) => r.roundId === roundId && r.playerId === playerId);

  const openColumn = (r: Round) => {
    if (r.status === "open") {
      if (match.status === "in_progress") navigate(`/partida/${match.id}/rodada/${r.id}`);
      return;
    }
    setSelected(r);
  };

  const sticky = "sticky z-10 bg-card";
  return (
    <>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="num w-full border-separate border-spacing-0 text-center" aria-label="Planilha de pontos da partida">
            <thead>
              <tr>
                <th scope="col" className={`${sticky} left-0 min-w-24 border-b border-r border-line px-3 py-2 text-left text-xs font-extrabold uppercase text-muted`}>
                  Jogador
                </th>
                {rounds.map((r) => (
                  <th key={r.id} scope="col" className="border-b border-line p-0">
                    <button
                      className={`flex min-h-14 w-full min-w-13 flex-col items-center justify-center px-1 ${
                        selected?.id === r.id ? "bg-accent-soft" : ""
                      } ${r.status === "open" ? "text-accent" : ""}`}
                      aria-label={`Rodada ${r.number}, ${doubleLabel(r.openingDouble)}${r.status === "open" ? ", em andamento" : ""}`}
                      onClick={() => openColumn(r)}
                    >
                      <span className="text-base font-black">R{r.number}</span>
                      <span className="text-[11px] font-semibold text-muted">
                        {r.status === "open" ? "agora" : r.openingDouble === null ? "exc." : `${r.openingDouble}-${r.openingDouble}`}
                      </span>
                    </button>
                  </th>
                ))}
                <th scope="col" className={`${sticky} right-0 min-w-16 border-b border-l border-line bg-card-2 px-2 text-xs font-extrabold uppercase text-muted`}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {match.participantIds.map((pid, i) => {
                const last = i === match.participantIds.length - 1;
                const border = last ? "" : "border-b border-line";
                return (
                  <tr key={pid}>
                    <th scope="row" className={`${sticky} left-0 max-w-32 truncate border-r border-line px-3 py-2 text-left text-base font-extrabold ${border}`}>
                      {nameOf(pid)}
                    </th>
                    {rounds.map((r) => {
                      const res = r.status === "closed" ? resultOf(r.id, pid) : undefined;
                      return (
                        <td key={r.id} className={`p-0 ${border} ${selected?.id === r.id ? "bg-accent-soft" : ""}`}>
                          <button className="flex min-h-14 w-full flex-col items-center justify-center" tabIndex={-1} aria-hidden="true" onClick={() => openColumn(r)}>
                            {res ? (
                              <>
                                <span className={`text-lg font-extrabold ${res.isWinner ? "text-accent" : ""}`}>{res.countedPoints}</span>
                                <span className="h-3 text-[10px] font-bold leading-3 text-muted">
                                  {res.isWinner ? "1º" : res.hadZeroDouble ? "0-0" : res.exitPosition ? `${res.exitPosition}º` : ""}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted">·</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className={`${sticky} right-0 border-l border-line bg-card-2 px-2 text-2xl font-black ${border}`} aria-label={`Total de ${nameOf(pid)}: ${totalOf(pid)}`}>
                      {totalOf(pid)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">
        {rounds.length ? "Toque numa rodada para ver o detalhe. " : "As rodadas aparecem aqui como colunas. "}
        Em destaque: quem saiu em 1º. "0-0": terminou com o carroção de zero.
      </p>
      {selected && <RoundDetailSheet analysis={analysis} round={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

/** Detalhe de uma rodada fechada: abertura, ordem de saída, pontos e total acumulado. */
function RoundDetailSheet({ analysis, round, onClose }: { analysis: MatchAnalysis; round: Round; onClose: () => void }) {
  const { db } = useStore();
  const nameOf = useNameOf();
  const navigate = useNavigate();
  const { match } = analysis.data;
  const results = db.results.filter((r) => r.roundId === round.id);
  const totals = cumulativeTotalsUpTo(analysis.data, round.number);
  // Ordem: quem saiu (1º, 2º…), depois quem ficou com peças na ordem de exibição.
  const ordered = [...results].sort(
    (a, b) =>
      (a.exitPosition ?? Infinity) - (b.exitPosition ?? Infinity) ||
      match.participantIds.indexOf(a.playerId) - match.participantIds.indexOf(b.playerId),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="round-title" className="modal animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4">
          {round.openingDouble !== null && <DominoTile value={round.openingDouble} size={30} />}
          <div className="min-w-0 flex-1">
            <h2 id="round-title" className="text-2xl font-black">
              Rodada {round.number}
            </h2>
            <div className="text-muted">
              {doubleLabel(round.openingDouble)} · abriu <b className="text-fg">{nameOf(round.openerId)}</b>
            </div>
            {round.manualException && <span className="badge badge-danger mt-1">Exceção manual · {round.exceptionNote}</span>}
            {round.editedAt && <span className="badge mt-1">corrigida</span>}
          </div>
          <button className="icon-btn -mr-2 -mt-2" aria-label="Fechar detalhe" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <table className="num mt-4 w-full text-left">
          <thead className="text-xs uppercase text-muted">
            <tr>
              <th className="py-1 font-extrabold">Saída</th>
              <th className="py-1 font-extrabold">Jogador</th>
              <th className="py-1 text-right font-extrabold">Pontos</th>
              <th className="py-1 text-right font-extrabold">Acum.</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((r) => (
              <tr key={r.playerId} className="border-t border-line">
                <td className="py-2 font-bold text-muted">{r.exitPosition ? `${r.exitPosition}º` : "com peças"}</td>
                <td className="py-2 text-lg font-extrabold">
                  {nameOf(r.playerId)}
                  {r.isWinner && <Trophy size={16} className="ml-1 inline text-accent" />}
                  {r.hadZeroDouble && <span className="badge badge-accent ml-1">0-0</span>}
                </td>
                <td className="py-2 text-right text-xl font-black">
                  {r.countedPoints}
                  {r.remainingPoints !== null && r.remainingPoints !== r.countedPoints && (
                    <div className="text-[11px] font-semibold text-muted">peças: {r.remainingPoints}</div>
                  )}
                </td>
                <td className="py-2 text-right font-bold text-muted">{totals.get(r.playerId) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 grid gap-2">
          {match.status === "in_progress" && (
            <button className="btn btn-secondary w-full" onClick={() => navigate(`/partida/${match.id}/rodada/${round.id}`)}>
              <Pencil size={18} /> Corrigir rodada {round.number}
            </button>
          )}
          <button className="btn btn-ghost w-full" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
