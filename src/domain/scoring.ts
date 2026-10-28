import type { ID, MatchSettings, RoundDraft, RoundResult } from "./types";

export type ComputedResult = Omit<RoundResult, "id" | "roundId">;

export interface ScoringOutcome {
  results: ComputedResult[];
  errors: string[];
}

export function emptyDraft(): RoundDraft {
  return { exitOrder: [], points: {}, zeroDouble: {} };
}

/** Converte o texto digitado em pontos válidos (inteiro ≥ 0) ou null. */
export function parsePoints(text: string): number | null {
  const t = text.trim();
  if (t === "") return null;
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

/**
 * Calcula os resultados de uma rodada a partir do rascunho.
 *
 * Regras:
 * - Vencedor (1º a sair): zero ponto.
 * - Jogador com o 0-0 (se a regra da turma estiver ativa): zero ponto, registrado à parte.
 * - Demais: a soma informada das peças restantes.
 * - Vencer e ter o 0-0 ao mesmo tempo continua valendo zero (sem benefício duplicado).
 * - Nunca há pontos negativos.
 */
export function computeRoundResults(
  draft: RoundDraft,
  participantIds: ID[],
  settings: MatchSettings,
  nameOf: (id: ID) => string = (id) => id,
): ScoringOutcome {
  const errors: string[] = [];
  const participants = new Set(participantIds);

  const seen = new Set<ID>();
  for (const id of draft.exitOrder) {
    if (!participants.has(id)) errors.push("A ordem de saída contém um jogador que não participa da partida.");
    if (seen.has(id)) errors.push(`${nameOf(id)} aparece mais de uma vez na ordem de saída.`);
    seen.add(id);
  }
  if (draft.exitOrder.length === 0) errors.push("Registre quem saiu em 1º lugar (vencedor da rodada).");
  if (draft.exitOrder.length >= participantIds.length)
    errors.push("Pelo menos um jogador precisa ter permanecido com peças.");

  const winnerId = draft.exitOrder[0] ?? null;

  const results: ComputedResult[] = participantIds.map((playerId) => {
    const index = draft.exitOrder.indexOf(playerId);
    const exitPosition = index >= 0 ? index + 1 : null;
    const isWinner = playerId === winnerId;
    const hadZeroDouble = Boolean(draft.zeroDouble[playerId]);
    const zeroRuleApplies = settings.zeroDoubleScoresZero && hadZeroDouble;
    const informed = draft.points[playerId] ?? null;

    if (informed !== null && (!Number.isInteger(informed) || informed < 0)) {
      errors.push(`Pontos inválidos para ${nameOf(playerId)}: use um número inteiro maior ou igual a zero.`);
    }

    let remainingPoints: number | null;
    let countedPoints: number;
    if (isWinner) {
      remainingPoints = 0;
      countedPoints = 0;
    } else if (zeroRuleApplies) {
      remainingPoints = informed;
      countedPoints = 0;
    } else {
      if (informed === null) errors.push(`Informe os pontos de ${nameOf(playerId)}.`);
      remainingPoints = informed;
      countedPoints = Math.max(0, informed ?? 0);
    }

    return { playerId, exitPosition, remainingPoints, countedPoints, isWinner, hadZeroDouble };
  });

  return { results, errors: [...new Set(errors)] };
}
