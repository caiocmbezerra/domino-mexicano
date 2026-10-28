/**
 * Testes obrigatórios A–J da especificação, executados sobre a lógica real do app
 * (as mesmas funções usadas pelas telas).
 */
import { describe, expect, it } from "vitest";
import { LocalStorageAdapter, MemoryStorage } from "../storage/adapter";
import { emptyDatabase, getMatchRounds, getRoundResults } from "./database";
import { searchNext, searchPrevious, startSearch, usedDoubles } from "./doubles";
import { buildResultText } from "./format";
import {
  addPlayer,
  closeRound,
  createMatch,
  DomainError,
  editClosedRound,
  finishMatch,
  openRound,
  undoLastRound,
  updateDraft,
} from "./operations";
import { analyzeMatch } from "./stats";
import type { Database, ID, RoundDraft } from "./types";

const settings = (over: Partial<Database["settings"]["defaultMatchSettings"]> = {}) => ({
  zeroDoubleScoresZero: true,
  tieBreakers: ["zeroDoubles" as const],
  highestDouble: 12,
  ...over,
});

function setup(names: string[], matchSettings = settings()) {
  let db = emptyDatabase();
  const ids: Record<string, ID> = {};
  for (const n of names) {
    const r = addPlayer(db, n);
    db = r.db;
    ids[n] = r.id;
  }
  const m = createMatch(db, Object.values(ids), matchSettings);
  return { db: m.db, matchId: m.id, ids };
}

/** Simula o operador: busca a partir do 12-12, "ninguém tem" até achar `double`, confirma. */
function searchAndOpen(db: Database, matchId: ID, double: number, openerId: ID) {
  const used = usedDoubles(getMatchRounds(db, matchId));
  let current = startSearch(used, 12);
  const visited: number[] = [];
  while (current !== null && current !== double) {
    visited.push(current);
    current = searchNext(current, used, 12);
  }
  if (current === null) throw new Error(`carroção ${double} não encontrado na busca`);
  const r = openRound(db, matchId, { double: current, openerId });
  return { db: r.db, roundId: r.id, visited };
}

function draft(exitOrder: ID[], points: Record<ID, number | null>, zero: ID[] = []): RoundDraft {
  return { exitOrder, points, zeroDouble: Object.fromEntries(zero.map((id) => [id, true])) };
}

function playRound(
  db: Database,
  matchId: ID,
  double: number,
  openerId: ID,
  d: RoundDraft,
): { db: Database; roundId: ID } {
  const opened = searchAndOpen(db, matchId, double, openerId);
  let next = updateDraft(opened.db, opened.roundId, d);
  next = closeRound(next, opened.roundId);
  return { db: next, roundId: opened.roundId };
}

const totalOf = (db: Database, matchId: ID, playerId: ID) =>
  analyzeMatch(db, matchId)!.stats.find((s) => s.playerId === playerId)!.total;

describe("Teste A — Busca do carroção", () => {
  it("ninguém tem 12-12 nem 11-11; o 10-10 abre e o jogador fica registrado", () => {
    const { db, matchId, ids } = setup(["Ana", "Beto", "Caio"]);
    const used = usedDoubles(getMatchRounds(db, matchId));
    expect(startSearch(used, 12)).toBe(12);
    expect(searchNext(12, used, 12)).toBe(11); // ninguém tem 12-12
    expect(searchNext(11, used, 12)).toBe(10); // ninguém tem 11-11

    // Antes da confirmação nada é marcado como utilizado.
    expect(usedDoubles(getMatchRounds(db, matchId))).toEqual([]);

    const { db: after, visited } = searchAndOpen(db, matchId, 10, ids.Beto);
    expect(visited).toEqual([12, 11]);
    const [round] = getMatchRounds(after, matchId);
    expect(round.number).toBe(1);
    expect(round.openingDouble).toBe(10);
    expect(round.openerId).toBe(ids.Beto);
    expect(usedDoubles(getMatchRounds(after, matchId))).toEqual([10]);
  });

  it("permite voltar na busca e não deixa reutilizar um carroção já usado", () => {
    const { db, matchId, ids } = setup(["Ana", "Beto"]);
    expect(searchPrevious(10, [], 12)).toBe(11);
    expect(searchPrevious(12, [], 12)).toBe(12);
    const { db: after } = searchAndOpen(db, matchId, 10, ids.Ana);
    const closed = closeRound(updateDraft(after, getMatchRounds(after, matchId)[0].id, draft([ids.Ana], { [ids.Beto]: 5 })), getMatchRounds(after, matchId)[0].id);
    expect(() => openRound(closed, matchId, { double: 10, openerId: ids.Beto })).toThrow(DomainError);
  });
});

describe("Teste B — Próxima rodada", () => {
  it("reinicia no 12-12, pula o 10-10 já usado e encontra o próximo elegível", () => {
    const { db: db0, matchId, ids } = setup(["Ana", "Beto", "Caio"]);
    const r1 = playRound(db0, matchId, 10, ids.Ana, draft([ids.Ana], { [ids.Beto]: 5, [ids.Caio]: 7 }));

    const used = usedDoubles(getMatchRounds(r1.db, matchId));
    expect(used).toEqual([10]);
    expect(startSearch(used, 12)).toBe(12); // reinicia no maior
    expect(searchNext(12, used, 12)).toBe(11);
    expect(searchNext(11, used, 12)).toBe(9); // 10-10 pulado
    expect(searchPrevious(9, used, 12)).toBe(11); // voltar também pula o 10-10

    const r2 = searchAndOpen(r1.db, matchId, 9, ids.Caio);
    expect(r2.visited).toEqual([12, 11]);
    const round2 = getMatchRounds(r2.db, matchId)[1];
    expect(round2.number).toBe(2);
    expect(round2.openingDouble).toBe(9);
    expect(round2.openerId).toBe(ids.Caio);
  });

  it("sem carroções elegíveis, não inventa o próximo e aceita exceção manual identificada", () => {
    const all = Array.from({ length: 13 }, (_, i) => i);
    expect(startSearch(all, 12)).toBeNull();
    expect(searchNext(0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 12)).toBeNull();

    const { db, matchId, ids } = setup(["Ana", "Beto"]);
    const r = openRound(db, matchId, {
      double: null,
      openerId: ids.Ana,
      manualException: true,
      exceptionNote: "Combinado pela turma",
    });
    const round = getMatchRounds(r.db, matchId)[0];
    expect(round.manualException).toBe(true);
    expect(round.exceptionNote).toBe("Combinado pela turma");
  });

  it("desfazer a última rodada devolve o carroção à lista de elegíveis", () => {
    const { db: db0, matchId, ids } = setup(["Ana", "Beto"]);
    const r1 = playRound(db0, matchId, 12, ids.Ana, draft([ids.Ana], { [ids.Beto]: 5 }));
    const undone = undoLastRound(r1.db, matchId);
    expect(getMatchRounds(undone, matchId)).toHaveLength(0);
    expect(undone.results).toHaveLength(0);
    expect(startSearch(usedDoubles(getMatchRounds(undone, matchId)), 12)).toBe(12);
  });
});

describe("Teste C — Pontuação", () => {
  it("vencedor recebe 0, demais recebem o informado, total acumulado correto", () => {
    const { db: db0, matchId, ids } = setup(["Ana", "Beto", "Caio"]);
    const r1 = playRound(db0, matchId, 12, ids.Ana, draft([ids.Ana], { [ids.Beto]: 18, [ids.Caio]: 27 }));
    const results = getRoundResults(r1.db, r1.roundId);
    const by = (id: ID) => results.find((r) => r.playerId === id)!;
    expect(by(ids.Ana)).toMatchObject({ countedPoints: 0, isWinner: true, exitPosition: 1 });
    expect(by(ids.Beto)).toMatchObject({ countedPoints: 18, remainingPoints: 18, isWinner: false, exitPosition: null });
    expect(by(ids.Caio).countedPoints).toBe(27);

    const r2 = playRound(r1.db, matchId, 11, ids.Beto, draft([ids.Beto, ids.Caio], { [ids.Ana]: 10, [ids.Caio]: 0 }));
    expect(totalOf(r2.db, matchId, ids.Ana)).toBe(10);
    expect(totalOf(r2.db, matchId, ids.Beto)).toBe(18);
    expect(totalOf(r2.db, matchId, ids.Caio)).toBe(27);
  });

  it("recusa pontos ausentes, negativos ou fracionados e ordem de saída inválida", () => {
    const { db: db0, matchId, ids } = setup(["Ana", "Beto", "Caio"]);
    const { db, roundId } = searchAndOpen(db0, matchId, 12, ids.Ana);
    const tryClose = (d: RoundDraft) => () => closeRound(updateDraft(db, roundId, d), roundId);
    expect(tryClose(draft([ids.Ana], { [ids.Beto]: 5 }))).toThrow(/Informe os pontos de Caio/);
    expect(tryClose(draft([ids.Ana], { [ids.Beto]: -3, [ids.Caio]: 4 }))).toThrow(/inválidos/);
    expect(tryClose(draft([ids.Ana], { [ids.Beto]: 2.5, [ids.Caio]: 4 }))).toThrow(/inválidos/);
    expect(tryClose(draft([], { [ids.Beto]: 2, [ids.Caio]: 4 }))).toThrow(/1º lugar/);
    expect(tryClose(draft([ids.Ana, ids.Ana], { [ids.Beto]: 2, [ids.Caio]: 4 }))).toThrow(/mais de uma vez/);
    expect(tryClose(draft([ids.Ana, ids.Beto, ids.Caio], {}))).toThrow(/permanecido com peças/);
  });
});

describe("Teste D — Carroção de zero", () => {
  it("quem termina com o 0-0 recebe zero e a ocorrência fica registrada para desempate", () => {
    const { db: db0, matchId, ids } = setup(["Ana", "Beto", "Caio"]);
    const r1 = playRound(
      db0,
      matchId,
      12,
      ids.Ana,
      draft([ids.Ana], { [ids.Beto]: 40, [ids.Caio]: 12 }, [ids.Beto]),
    );
    const beto = getRoundResults(r1.db, r1.roundId).find((r) => r.playerId === ids.Beto)!;
    expect(beto).toMatchObject({ countedPoints: 0, remainingPoints: 40, hadZeroDouble: true, isWinner: false });
    const stats = analyzeMatch(r1.db, matchId)!.stats.find((s) => s.playerId === ids.Beto)!;
    expect(stats.zeroDoubles).toBe(1);
    expect(stats.total).toBe(0);
  });

  it("o 0-0 dispensa digitar os pontos; vencedor com 0-0 continua com zero, sem benefício extra", () => {
    const { db: db0, matchId, ids } = setup(["Ana", "Beto"]);
    const r1 = playRound(db0, matchId, 12, ids.Ana, draft([ids.Ana], { [ids.Beto]: null }, [ids.Ana, ids.Beto]));
    const res = getRoundResults(r1.db, r1.roundId);
    expect(res.every((r) => r.countedPoints === 0)).toBe(true);
    expect(res.find((r) => r.playerId === ids.Ana)).toMatchObject({ isWinner: true, hadZeroDouble: true });
  });

  it("com a regra desativada, o jogador com 0-0 paga os pontos informados", () => {
    const { db: db0, matchId, ids } = setup(["Ana", "Beto"], settings({ zeroDoubleScoresZero: false }));
    const r1 = playRound(db0, matchId, 12, ids.Ana, draft([ids.Ana], { [ids.Beto]: 40 }, [ids.Beto]));
    const beto = getRoundResults(r1.db, r1.roundId).find((r) => r.playerId === ids.Beto)!;
    expect(beto).toMatchObject({ countedPoints: 40, hadZeroDouble: true });
  });
});

/** Monta uma partida que termina com João 45, Pedro 62 e Carlos 78 (Carlos faz 34 numa rodada). */
function matchJoaoPedroCarlos() {
  const { db: db0, matchId, ids } = setup(["João", "Pedro", "Carlos"]);
  const { João: j, Pedro: p, Carlos: c } = ids;
  let db = db0;
  db = playRound(db, matchId, 12, j, draft([j], { [p]: 20, [c]: 34 })).db;
  db = playRound(db, matchId, 11, p, draft([p], { [j]: 25, [c]: 24 })).db;
  db = playRound(db, matchId, 10, c, draft([c], { [j]: 20, [p]: 22 })).db;
  db = playRound(db, matchId, 9, j, draft([j], { [p]: 20, [c]: 20 })).db;
  return { db, matchId, ids };
}

describe("Teste E — Ranking", () => {
  it("45, 62 e 78 ficam em 1º, 2º e 3º", () => {
    const { db, matchId, ids } = matchJoaoPedroCarlos();
    const ranking = analyzeMatch(db, matchId)!.ranking;
    expect(ranking.map((e) => [e.position, e.stats.playerId, e.stats.total])).toEqual([
      [1, ids["João"], 45],
      [2, ids.Pedro, 62],
      [3, ids.Carlos, 78],
    ]);
    expect(ranking.some((e) => e.tied)).toBe(false);
  });
});

describe("Teste F — Maior pontuação", () => {
  it("34 é a maior pontuação em uma rodada e 78 é o acumulado", () => {
    const { db, matchId, ids } = matchJoaoPedroCarlos();
    const a = analyzeMatch(db, matchId)!;
    const carlos = a.stats.find((s) => s.playerId === ids.Carlos)!;
    expect(carlos.maxRound).toBe(34);
    expect(carlos.maxRoundNumbers).toEqual([1]);
    expect(carlos.total).toBe(78);
    expect(a.records.highestRound).toEqual({ value: 34, entries: [{ playerId: ids.Carlos, roundNumber: 1 }] });
    expect(a.records.highestTotal).toEqual({ value: 78, playerIds: [ids.Carlos] });
    expect(a.records.lowestTotal).toEqual({ value: 45, playerIds: [ids["João"]] });
    expect(a.records.mostWins).toEqual({ value: 2, playerIds: [ids["João"]] });
  });

  it("gera o resumo em texto com os dados reais", () => {
    const { db, matchId } = matchJoaoPedroCarlos();
    const finished = finishMatch(db, matchId);
    const nameOf = (id: ID) => finished.players.find((p) => p.id === id)!.name;
    const text = buildResultText(analyzeMatch(finished, matchId)!, nameOf);
    expect(text).toContain("DOMINÓ MEXICANO — RESULTADO FINAL");
    expect(text).toContain("1º — João: 45 pontos");
    expect(text).toContain("2º — Pedro: 62 pontos");
    expect(text).toContain("3º — Carlos: 78 pontos");
    expect(text).toContain("* Mais vitórias: João (2).");
    expect(text).toContain("* Maior pontuação em uma rodada: Carlos na rodada 1, 34 pontos.");
    expect(text).toContain("* Maior pontuação acumulada: Carlos, 78 pontos.");
  });
});

describe("Teste G — Correção", () => {
  it("editar uma rodada anterior recalcula totais, ranking e estatísticas sem duplicar", () => {
    const { db, matchId, ids } = matchJoaoPedroCarlos();
    const round1 = getMatchRounds(db, matchId)[0];
    const resultsBefore = db.results.length;

    // Corrige a rodada 1: Carlos tinha 14 (não 34) e Pedro foi quem venceu.
    const { João: j, Pedro: p, Carlos: c } = ids;
    const edited = editClosedRound(db, round1.id, draft([p], { [j]: 5, [c]: 14 }), j);

    expect(edited.results.length).toBe(resultsBefore); // substituiu, não duplicou
    const a = analyzeMatch(edited, matchId)!;
    const s = (id: ID) => a.stats.find((x) => x.playerId === id)!;
    expect(s(j).total).toBe(50);
    expect(s(p).total).toBe(42);
    expect(s(c).total).toBe(58);
    expect(s(c).maxRound).toBe(24);
    expect(s(j).wins).toBe(1);
    expect(s(p).wins).toBe(2);
    expect(a.ranking.map((e) => e.stats.playerId)).toEqual([p, j, c]);
    expect(a.records.highestRound!.value).toBe(25);

    // Editar de novo com os mesmos dados mantém os mesmos totais (idempotente).
    const again = editClosedRound(edited, round1.id, draft([p], { [j]: 5, [c]: 14 }), j);
    expect(analyzeMatch(again, matchId)!.stats.map((x) => x.total)).toEqual(a.stats.map((x) => x.total));
  });
});

describe("Teste H — Persistência", () => {
  it("fechar e reabrir no meio da partida mantém dados, rascunho e sequência de carroções", () => {
    const storage = new MemoryStorage();
    const adapter = new LocalStorageAdapter(storage);
    const { db: db0, matchId, ids } = setup(["Ana", "Beto", "Caio"]);
    let db = playRound(db0, matchId, 10, ids.Ana, draft([ids.Ana], { [ids.Beto]: 5, [ids.Caio]: 9 })).db;
    const r2 = searchAndOpen(db, matchId, 12, ids.Beto);
    db = updateDraft(r2.db, r2.roundId, draft([ids.Caio], { [ids.Ana]: 7 }));
    adapter.save(db);

    // "Reabre" o app: novo adaptador lendo o mesmo armazenamento.
    const reopened = new LocalStorageAdapter(storage).load();
    expect(reopened).toEqual(db);
    const rounds = getMatchRounds(reopened, matchId);
    expect(rounds.map((r) => [r.number, r.openingDouble, r.status])).toEqual([
      [1, 10, "closed"],
      [2, 12, "open"],
    ]);
    expect(rounds[1].draft.exitOrder).toEqual([ids.Caio]);
    expect(usedDoubles(rounds)).toEqual([12, 10]);

    // Termina a rodada 2 e a 3ª busca continua de onde deveria (11-11), sem reiniciar a sequência.
    let cont = updateDraft(reopened, r2.roundId, draft([ids.Caio], { [ids.Ana]: 7, [ids.Beto]: 3 }));
    cont = closeRound(cont, r2.roundId);
    const used = usedDoubles(getMatchRounds(cont, matchId));
    expect(startSearch(used, 12)).toBe(11);
    expect(searchNext(11, used, 12)).toBe(9);
    expect(totalOf(cont, matchId, ids.Ana)).toBe(7);
  });

  it("dados corrompidos não derrubam o app e são preservados à parte", () => {
    const storage = new MemoryStorage();
    storage.setItem("domino-mexicano-placar:v1", "{quebrado");
    const db = new LocalStorageAdapter(storage).load();
    expect(db.players).toEqual([]);
  });
});

describe("Teste I — Empate", () => {
  it("mesmo total sem critério de desempate: empate explícito, mesma posição", () => {
    const { db: db0, matchId, ids } = setup(["Ana", "Beto", "Caio"], settings({ tieBreakers: [] }));
    const db = playRound(db0, matchId, 12, ids.Caio, draft([ids.Caio], { [ids.Ana]: 10, [ids.Beto]: 10 })).db;
    const ranking = analyzeMatch(db, matchId)!.ranking;
    expect(ranking[0]).toMatchObject({ position: 1, tied: false });
    expect(ranking[1]).toMatchObject({ position: 2, tied: true });
    expect(ranking[2]).toMatchObject({ position: 2, tied: true });
  });

  it("critério do 0-0 desempata; se persistir, continua empatado", () => {
    const { db: db0, matchId, ids } = setup(["Ana", "Beto", "Caio", "Davi"]);
    let db = playRound(
      db0,
      matchId,
      12,
      ids.Davi,
      draft([ids.Davi], { [ids.Ana]: 10, [ids.Beto]: 0, [ids.Caio]: 10 }, [ids.Beto]),
    ).db;
    db = playRound(db, matchId, 11, ids.Davi, draft([ids.Davi], { [ids.Ana]: 5, [ids.Beto]: 15, [ids.Caio]: 5 })).db;
    // Ana 15, Beto 15 (com um 0-0), Caio 15
    const ranking = analyzeMatch(db, matchId)!.ranking;
    const pos = (id: ID) => ranking.find((e) => e.stats.playerId === id)!;
    expect(pos(ids.Davi).position).toBe(1);
    expect(pos(ids.Beto)).toMatchObject({ position: 2, tied: false, tiedOnPoints: true, decidedBy: "zeroDoubles" });
    expect(pos(ids.Ana)).toMatchObject({ position: 3, tied: true, tiedOnPoints: true });
    expect(pos(ids.Caio)).toMatchObject({ position: 3, tied: true, tiedOnPoints: true });
  });
});

describe("Teste J — Histórico", () => {
  it("encerrar uma partida e iniciar outra não mistura resultados", () => {
    const first = matchJoaoPedroCarlos();
    let db = finishMatch(first.db, first.matchId);
    const snapshot = JSON.stringify(analyzeMatch(db, first.matchId));

    // Segunda partida com parte dos mesmos jogadores.
    const { João: j, Pedro: p } = first.ids;
    const second = createMatch(db, [p, j], settings());
    db = second.db;
    // Na nova partida o 12-12 volta a ser elegível.
    expect(startSearch(usedDoubles(getMatchRounds(db, second.id)), 12)).toBe(12);
    db = playRound(db, second.id, 12, p, draft([p], { [j]: 99 })).db;

    expect(JSON.stringify(analyzeMatch(db, first.matchId))).toBe(snapshot);
    const a2 = analyzeMatch(db, second.id)!;
    expect(a2.stats.map((s) => [s.playerId, s.total])).toEqual([
      [p, 0],
      [j, 99],
    ]);
    expect(a2.data.closedRounds).toHaveLength(1);

    // A partida encerrada fica protegida contra alterações.
    const round1 = getMatchRounds(db, first.matchId)[0];
    expect(() => editClosedRound(db, round1.id, draft([j], {}), j)).toThrow(/encerrada/);
    expect(() => undoLastRound(db, first.matchId)).toThrow(/encerrada/);
  });
});
