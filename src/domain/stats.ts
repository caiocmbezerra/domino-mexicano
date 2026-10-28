/**
 * Ranking, estatísticas e recordes — tudo calculado a partir das rodadas FECHADAS
 * e de seus resultados. Nada aqui é armazenado.
 */
import { getMatchRounds } from "./database";
import type { Database, ID, Match, Round, RoundResult, TieBreaker } from "./types";

export interface PlayerStats {
  playerId: ID;
  total: number;
  roundsPlayed: number;
  average: number;
  wins: number;
  winRate: number; // 0..1
  firsts: number;
  seconds: number;
  thirds: number;
  /** Maior pontuação contabilizada em uma única rodada (não confundir com o total). */
  maxRound: number;
  /** Números das rodadas em que ocorreu a maior pontuação individual do jogador. */
  maxRoundNumbers: number[];
  zeroDoubles: number;
  opens: number;
  /** Posição média de saída (quem ficou com peças conta como logo após o último que saiu). */
  averageExitPosition: number | null;
}

export interface MatchData {
  match: Match;
  closedRounds: Round[];
  results: RoundResult[];
}

export function collectMatchData(db: Database, matchId: ID): MatchData | null {
  const match = db.matches.find((m) => m.id === matchId);
  if (!match) return null;
  const closedRounds = getMatchRounds(db, matchId).filter((r) => r.status === "closed");
  const ids = new Set(closedRounds.map((r) => r.id));
  return { match, closedRounds, results: db.results.filter((r) => ids.has(r.roundId)) };
}

export function computePlayerStats(data: MatchData): PlayerStats[] {
  const roundNumber = new Map(data.closedRounds.map((r) => [r.id, r.number]));
  const exitsInRound = new Map<ID, number>();
  for (const r of data.results)
    if (r.exitPosition !== null) exitsInRound.set(r.roundId, (exitsInRound.get(r.roundId) ?? 0) + 1);

  return data.match.participantIds.map((playerId) => {
    const mine = data.results.filter((r) => r.playerId === playerId);
    const total = mine.reduce((sum, r) => sum + r.countedPoints, 0);
    const maxRound = mine.reduce((max, r) => Math.max(max, r.countedPoints), 0);
    const positions = mine.map((r) => r.exitPosition ?? (exitsInRound.get(r.roundId) ?? 0) + 1);
    const wins = mine.filter((r) => r.isWinner).length;
    return {
      playerId,
      total,
      roundsPlayed: mine.length,
      average: mine.length ? total / mine.length : 0,
      wins,
      winRate: mine.length ? wins / mine.length : 0,
      firsts: mine.filter((r) => r.exitPosition === 1).length,
      seconds: mine.filter((r) => r.exitPosition === 2).length,
      thirds: mine.filter((r) => r.exitPosition === 3).length,
      maxRound,
      maxRoundNumbers:
        maxRound > 0
          ? mine
              .filter((r) => r.countedPoints === maxRound)
              .map((r) => roundNumber.get(r.roundId) ?? 0)
              .sort((a, b) => a - b)
          : [],
      zeroDoubles: mine.filter((r) => r.hadZeroDouble).length,
      opens: data.closedRounds.filter((r) => r.openerId === playerId).length,
      averageExitPosition: positions.length
        ? positions.reduce((a, b) => a + b, 0) / positions.length
        : null,
    };
  });
}

// ---------------------------------------------------------------- Ranking por pontos

export const TIE_BREAKER_LABELS: Record<TieBreaker, string> = {
  zeroDoubles: "Mais vezes com o 0-0",
  wins: "Mais vitórias de rodada",
  lowestMaxRound: "Menor pontuação máxima em uma rodada",
};

export const TIE_BREAKER_SHORT: Record<TieBreaker, string> = {
  zeroDoubles: "0-0",
  wins: "vitórias",
  lowestMaxRound: "menor pior rodada",
};

/** Negativo se `a` fica à frente de `b` pelo critério. */
function compareBy(criterion: TieBreaker, a: PlayerStats, b: PlayerStats): number {
  switch (criterion) {
    case "zeroDoubles":
      return b.zeroDoubles - a.zeroDoubles;
    case "wins":
      return b.wins - a.wins;
    case "lowestMaxRound":
      return a.maxRound - b.maxRound;
  }
}

export interface RankEntry {
  stats: PlayerStats;
  position: number;
  /** Empate que persiste após todos os critérios de desempate. */
  tied: boolean;
  /** Mesma pontuação acumulada de outro jogador (antes do desempate). */
  tiedOnPoints: boolean;
  /** Critério que resolveu o empate em pontos, se algum resolveu. */
  decidedBy: TieBreaker | null;
}

/**
 * Ordena pela menor pontuação acumulada e aplica os critérios de desempate da turma,
 * em ordem. Se o empate persistir, os jogadores dividem a posição (sem desempate arbitrário).
 */
export function rankByPoints(stats: PlayerStats[], tieBreakers: TieBreaker[]): RankEntry[] {
  const fullCompare = (a: PlayerStats, b: PlayerStats) => {
    if (a.total !== b.total) return a.total - b.total;
    for (const c of tieBreakers) {
      const d = compareBy(c, a, b);
      if (d !== 0) return d;
    }
    return 0;
  };
  // A ordem original (exibição) só desempata a ordem visual dentro de um empate real.
  const sorted = [...stats].sort(fullCompare);

  return sorted.map((s, i) => {
    const firstEqual = sorted.findIndex((o) => fullCompare(o, s) === 0);
    const samePoints = sorted.filter((o) => o.total === s.total);
    const tied = sorted.some((o) => o !== s && fullCompare(o, s) === 0);
    let decidedBy: TieBreaker | null = null;
    if (samePoints.length > 1) {
      decidedBy =
        tieBreakers.find((c) => samePoints.some((o) => o !== s && compareBy(c, o, s) !== 0)) ?? null;
    }
    return {
      stats: s,
      position: firstEqual >= 0 ? firstEqual + 1 : i + 1,
      tied,
      tiedOnPoints: samePoints.length > 1,
      decidedBy,
    };
  });
}

// ---------------------------------------------------------------- Ranking por ordem de saída

export interface ExitRankEntry {
  stats: PlayerStats;
  position: number;
  tied: boolean;
}

/** Quadro de "medalhas" de saída: mais 1º lugares, depois 2º, 3º e menor posição média. */
export function rankByExitOrder(stats: PlayerStats[]): ExitRankEntry[] {
  const cmp = (a: PlayerStats, b: PlayerStats) =>
    b.firsts - a.firsts ||
    b.seconds - a.seconds ||
    b.thirds - a.thirds ||
    (a.averageExitPosition ?? Infinity) - (b.averageExitPosition ?? Infinity);
  const sorted = [...stats].sort(cmp);
  return sorted.map((s) => ({
    stats: s,
    position: sorted.findIndex((o) => cmp(o, s) === 0) + 1,
    tied: sorted.some((o) => o !== s && cmp(o, s) === 0),
  }));
}

// ---------------------------------------------------------------- Recordes

export interface Record_ {
  playerIds: ID[];
  value: number;
}

export interface HighestRoundRecord {
  value: number;
  entries: { playerId: ID; roundNumber: number }[];
}

export interface MatchRecords {
  lowestTotal: Record_ | null;
  highestTotal: Record_ | null;
  highestRound: HighestRoundRecord | null;
  mostWins: Record_ | null;
  mostFirsts: Record_ | null;
  mostOpens: Record_ | null;
  mostZeroDoubles: Record_ | null;
}

/** Todos os jogadores que empatam no valor extremo. `requirePositive` evita "recorde" de zero. */
function extreme(
  stats: PlayerStats[],
  pick: (s: PlayerStats) => number,
  mode: "max" | "min",
  requirePositive: boolean,
): Record_ | null {
  if (stats.length === 0) return null;
  const values = stats.map(pick);
  const value = mode === "max" ? Math.max(...values) : Math.min(...values);
  if (requirePositive && value <= 0) return null;
  return { value, playerIds: stats.filter((s) => pick(s) === value).map((s) => s.playerId) };
}

export function computeRecords(data: MatchData, stats: PlayerStats[]): MatchRecords {
  const hasRounds = data.closedRounds.length > 0;
  let highestRound: HighestRoundRecord | null = null;
  const roundNumber = new Map(data.closedRounds.map((r) => [r.id, r.number]));
  const maxValue = data.results.reduce((m, r) => Math.max(m, r.countedPoints), 0);
  if (maxValue > 0) {
    highestRound = {
      value: maxValue,
      entries: data.results
        .filter((r) => r.countedPoints === maxValue)
        .map((r) => ({ playerId: r.playerId, roundNumber: roundNumber.get(r.roundId) ?? 0 }))
        .sort((a, b) => a.roundNumber - b.roundNumber),
    };
  }
  return {
    lowestTotal: hasRounds ? extreme(stats, (s) => s.total, "min", false) : null,
    highestTotal: hasRounds ? extreme(stats, (s) => s.total, "max", false) : null,
    highestRound,
    mostWins: extreme(stats, (s) => s.wins, "max", true),
    mostFirsts: extreme(stats, (s) => s.firsts, "max", true),
    mostOpens: extreme(stats, (s) => s.opens, "max", true),
    mostZeroDoubles: extreme(stats, (s) => s.zeroDoubles, "max", true),
  };
}

/** Pacote completo usado pelas telas. */
export function analyzeMatch(db: Database, matchId: ID) {
  const data = collectMatchData(db, matchId);
  if (!data) return null;
  const stats = computePlayerStats(data);
  return {
    data,
    stats,
    ranking: rankByPoints(stats, data.match.settings.tieBreakers),
    exitRanking: rankByExitOrder(stats),
    records: computeRecords(data, stats),
  };
}

export type MatchAnalysis = NonNullable<ReturnType<typeof analyzeMatch>>;

/** Total acumulado de cada jogador até (e incluindo) uma rodada — usado no resumo e no histórico. */
export function cumulativeTotalsUpTo(data: MatchData, roundNumber: number): Map<ID, number> {
  const ids = new Set(data.closedRounds.filter((r) => r.number <= roundNumber).map((r) => r.id));
  const totals = new Map<ID, number>(data.match.participantIds.map((id) => [id, 0]));
  for (const r of data.results)
    if (ids.has(r.roundId)) totals.set(r.playerId, (totals.get(r.playerId) ?? 0) + r.countedPoints);
  return totals;
}

// ---------------------------------------------------------------- Estatísticas de carreira

export interface CareerStats {
  playerId: ID;
  matchesPlayed: number;
  matchesWon: number;
  roundsPlayed: number;
  roundWins: number;
  totalPoints: number;
  averagePerRound: number;
  zeroDoubles: number;
  opens: number;
  highestRound: number;
}

/** Acumulado do jogador em todas as partidas ENCERRADAS. */
export function computeCareerStats(db: Database): CareerStats[] {
  const map = new Map<ID, CareerStats>(
    db.players.map((p) => [
      p.id,
      {
        playerId: p.id,
        matchesPlayed: 0,
        matchesWon: 0,
        roundsPlayed: 0,
        roundWins: 0,
        totalPoints: 0,
        averagePerRound: 0,
        zeroDoubles: 0,
        opens: 0,
        highestRound: 0,
      },
    ]),
  );
  for (const match of db.matches.filter((m) => m.status === "finished")) {
    const analysis = analyzeMatch(db, match.id);
    if (!analysis) continue;
    for (const entry of analysis.ranking) {
      const c = map.get(entry.stats.playerId);
      if (!c) continue;
      const s = entry.stats;
      c.matchesPlayed += 1;
      if (entry.position === 1) c.matchesWon += 1;
      c.roundsPlayed += s.roundsPlayed;
      c.roundWins += s.wins;
      c.totalPoints += s.total;
      c.zeroDoubles += s.zeroDoubles;
      c.opens += s.opens;
      c.highestRound = Math.max(c.highestRound, s.maxRound);
    }
  }
  for (const c of map.values()) c.averagePerRound = c.roundsPlayed ? c.totalPoints / c.roundsPlayed : 0;
  return [...map.values()];
}
