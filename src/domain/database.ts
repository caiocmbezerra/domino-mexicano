import { APP_CONFIG } from "../config";
import type { Database, MatchSettings } from "./types";

export function defaultMatchSettings(): MatchSettings {
  return {
    zeroDoubleScoresZero: true,
    tieBreakers: ["zeroDoubles"],
    highestDouble: APP_CONFIG.highestDouble,
  };
}

export function emptyDatabase(): Database {
  return {
    schemaVersion: 1,
    players: [],
    matches: [],
    rounds: [],
    results: [],
    settings: {
      appName: APP_CONFIG.defaultAppName,
      defaultMatchSettings: defaultMatchSettings(),
      theme: "dark",
      photoCount: false,
    },
  };
}

/** Consultas básicas usadas por toda a aplicação. */
export function getMatch(db: Database, matchId: string) {
  return db.matches.find((m) => m.id === matchId) ?? null;
}

/** Rodadas da partida, ordenadas pelo número. */
export function getMatchRounds(db: Database, matchId: string) {
  return db.rounds.filter((r) => r.matchId === matchId).sort((a, b) => a.number - b.number);
}

export function getRoundResults(db: Database, roundId: string) {
  return db.results.filter((r) => r.roundId === roundId);
}

export function getOpenRound(db: Database, matchId: string) {
  return db.rounds.find((r) => r.matchId === matchId && r.status === "open") ?? null;
}

export function playerName(db: Database, playerId: string | null): string {
  if (!playerId) return "—";
  return db.players.find((p) => p.id === playerId)?.name ?? "Jogador removido";
}
