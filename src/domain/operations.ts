/**
 * Operações sobre o banco de dados. Todas são funções puras: recebem o estado atual
 * e devolvem um novo estado, lançando DomainError quando a ação viola uma regra.
 */
import { APP_CONFIG } from "../config";
import { getMatch, getMatchRounds, getOpenRound, playerName } from "./database";
import { eligibleDoubles, usedDoubles, doubleLabel } from "./doubles";
import { newId } from "./ids";
import { computeRoundResults, emptyDraft } from "./scoring";
import type { Database, ID, Match, MatchSettings, Round, RoundDraft, RoundResult } from "./types";

export class DomainError extends Error {}

function fail(message: string): never {
  throw new DomainError(message);
}

function requireMatch(db: Database, matchId: ID): Match {
  return getMatch(db, matchId) ?? fail("Partida não encontrada.");
}

function requireInProgress(db: Database, matchId: ID): Match {
  const match = requireMatch(db, matchId);
  if (match.status !== "in_progress") fail("Esta partida já foi encerrada e não pode ser alterada.");
  return match;
}

function replaceMatch(db: Database, match: Match): Database {
  return { ...db, matches: db.matches.map((m) => (m.id === match.id ? match : m)) };
}

function replaceRound(db: Database, round: Round): Database {
  return { ...db, rounds: db.rounds.map((r) => (r.id === round.id ? round : r)) };
}

const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ");

// ---------------------------------------------------------------- Jogadores

export function addPlayer(db: Database, rawName: string, now = new Date()): { db: Database; id: ID } {
  const name = normalizeName(rawName);
  if (!name) fail("Digite um nome ou apelido.");
  if (name.length > 30) fail("Use no máximo 30 caracteres.");
  if (db.players.some((p) => p.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR")))
    fail(`Já existe um jogador chamado "${name}".`);
  const id = newId();
  return { db: { ...db, players: [...db.players, { id, name, createdAt: now.toISOString() }] }, id };
}

export function renamePlayer(db: Database, playerId: ID, rawName: string): Database {
  const name = normalizeName(rawName);
  if (!name) fail("Digite um nome ou apelido.");
  if (name.length > 30) fail("Use no máximo 30 caracteres.");
  if (
    db.players.some(
      (p) => p.id !== playerId && p.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
    )
  )
    fail(`Já existe um jogador chamado "${name}".`);
  return { ...db, players: db.players.map((p) => (p.id === playerId ? { ...p, name } : p)) };
}

export function playerHasHistory(db: Database, playerId: ID): boolean {
  return db.matches.some((m) => m.participantIds.includes(playerId));
}

export function deletePlayer(db: Database, playerId: ID): Database {
  if (playerHasHistory(db, playerId))
    fail("Este jogador participa de partidas registradas e não pode ser excluído.");
  return { ...db, players: db.players.filter((p) => p.id !== playerId) };
}

// ---------------------------------------------------------------- Partidas

export function createMatch(
  db: Database,
  participantIds: ID[],
  settings: MatchSettings,
  now = new Date(),
): { db: Database; id: ID } {
  const unique = new Set(participantIds);
  if (unique.size !== participantIds.length) fail("Há jogadores repetidos na lista.");
  if (participantIds.length < APP_CONFIG.minPlayers)
    fail(`Selecione pelo menos ${APP_CONFIG.minPlayers} jogadores.`);
  if (participantIds.length > APP_CONFIG.maxPlayers)
    fail(`O limite é de ${APP_CONFIG.maxPlayers} jogadores por partida.`);
  for (const id of participantIds)
    if (!db.players.some((p) => p.id === id)) fail("Jogador selecionado não encontrado.");

  const match: Match = {
    id: newId(),
    startedAt: now.toISOString(),
    endedAt: null,
    status: "in_progress",
    settings: { ...settings, tieBreakers: [...settings.tieBreakers] },
    participantIds: [...participantIds],
    openingSearch: null,
  };
  return { db: { ...db, matches: [...db.matches, match] }, id: match.id };
}

/** Guarda a posição da busca do carroção (navegação apenas; nada é marcado como utilizado). */
export function setOpeningSearch(db: Database, matchId: ID, value: Match["openingSearch"]): Database {
  const match = requireInProgress(db, matchId);
  return replaceMatch(db, { ...match, openingSearch: value });
}

export function finishMatch(db: Database, matchId: ID, now = new Date()): Database {
  const match = requireInProgress(db, matchId);
  if (getOpenRound(db, matchId))
    fail("Há uma rodada em andamento. Feche-a ou desfaça-a antes de encerrar a partida.");
  if (!getMatchRounds(db, matchId).some((r) => r.status === "closed"))
    fail("Nenhuma rodada foi fechada. Registre ao menos uma rodada ou exclua a partida.");
  return replaceMatch(db, { ...match, status: "finished", endedAt: now.toISOString(), openingSearch: null });
}

export function deleteMatch(db: Database, matchId: ID): Database {
  requireMatch(db, matchId);
  const roundIds = new Set(db.rounds.filter((r) => r.matchId === matchId).map((r) => r.id));
  return {
    ...db,
    matches: db.matches.filter((m) => m.id !== matchId),
    rounds: db.rounds.filter((r) => r.matchId !== matchId),
    results: db.results.filter((r) => !roundIds.has(r.roundId)),
  };
}

// ---------------------------------------------------------------- Rodadas

export interface OpenRoundInput {
  double: number | null;
  openerId: ID;
  manualException?: boolean;
  exceptionNote?: string;
}

/**
 * Confirma a abertura de uma rodada. Só aqui o carroção passa a constar como utilizado.
 * Fora da exceção manual, o carroção precisa ser elegível (ainda não usado na partida).
 */
export function openRound(
  db: Database,
  matchId: ID,
  input: OpenRoundInput,
  now = new Date(),
): { db: Database; id: ID } {
  const match = requireInProgress(db, matchId);
  if (getOpenRound(db, matchId)) fail("Já existe uma rodada em andamento nesta partida.");
  if (!match.participantIds.includes(input.openerId)) fail("Selecione quem abriu a rodada.");

  const rounds = getMatchRounds(db, matchId);
  const used = usedDoubles(rounds);
  const manual = Boolean(input.manualException);

  if (!manual) {
    if (input.double === null) fail("Informe o carroção de abertura.");
    if (!eligibleDoubles(used, match.settings.highestDouble).includes(input.double))
      fail(`O carroção ${doubleLabel(input.double)} já foi utilizado nesta partida.`);
  } else if (input.double !== null && (input.double < 0 || input.double > match.settings.highestDouble)) {
    fail("Carroção inválido.");
  }

  const round: Round = {
    id: newId(),
    matchId,
    number: rounds.length ? rounds[rounds.length - 1].number + 1 : 1,
    openingDouble: input.double,
    openerId: input.openerId,
    manualException: manual,
    exceptionNote: manual ? input.exceptionNote?.trim() || "Exceção manual" : null,
    status: "open",
    draft: emptyDraft(),
    createdAt: now.toISOString(),
    closedAt: null,
    editedAt: null,
  };
  const next = { ...db, rounds: [...db.rounds, round] };
  return { db: replaceMatch(next, { ...match, openingSearch: null }), id: round.id };
}

/** Salva o rascunho da rodada em andamento (ordem de saída, pontos, 0-0). */
export function updateDraft(db: Database, roundId: ID, draft: RoundDraft): Database {
  const round = db.rounds.find((r) => r.id === roundId) ?? fail("Rodada não encontrada.");
  requireInProgress(db, round.matchId);
  if (round.status !== "open") fail("Esta rodada já foi fechada. Use a edição de rodada.");
  return replaceRound(db, { ...round, draft });
}

function writeResults(db: Database, round: Round, draft: RoundDraft): Database {
  const match = requireMatch(db, round.matchId);
  const outcome = computeRoundResults(draft, match.participantIds, match.settings, (id) =>
    playerName(db, id),
  );
  if (outcome.errors.length) fail(outcome.errors[0]);
  const results: RoundResult[] = outcome.results.map((r) => ({ ...r, id: newId(), roundId: round.id }));
  return {
    ...db,
    // Substitui (nunca acumula) os resultados da rodada: editar não duplica pontos.
    results: [...db.results.filter((r) => r.roundId !== round.id), ...results],
  };
}

/** Corrige quem abriu a rodada em andamento (o carroção permanece o mesmo). */
export function setRoundOpener(db: Database, roundId: ID, openerId: ID): Database {
  const round = db.rounds.find((r) => r.id === roundId) ?? fail("Rodada não encontrada.");
  const match = requireInProgress(db, round.matchId);
  if (round.status !== "open") fail("Esta rodada já foi fechada. Use a edição de rodada.");
  if (!match.participantIds.includes(openerId)) fail("Jogador de abertura inválido.");
  return replaceRound(db, { ...round, openerId });
}

/** Fecha a rodada em andamento, gravando os resultados por jogador. */
export function closeRound(db: Database, roundId: ID, now = new Date()): Database {
  const round = db.rounds.find((r) => r.id === roundId) ?? fail("Rodada não encontrada.");
  requireInProgress(db, round.matchId);
  if (round.status !== "open") fail("Esta rodada já está fechada.");
  const next = writeResults(db, round, round.draft);
  return replaceRound(next, { ...round, status: "closed", closedAt: now.toISOString() });
}

/**
 * Corrige uma rodada já fechada. Os resultados são substituídos e, como totais,
 * rankings e estatísticas são derivados, tudo que vem depois é recalculado.
 */
export function editClosedRound(
  db: Database,
  roundId: ID,
  draft: RoundDraft,
  openerId: ID | null,
  now = new Date(),
): Database {
  const round = db.rounds.find((r) => r.id === roundId) ?? fail("Rodada não encontrada.");
  const match = requireInProgress(db, round.matchId);
  if (round.status !== "closed") fail("Só é possível corrigir rodadas fechadas.");
  if (openerId !== null && !match.participantIds.includes(openerId)) fail("Jogador de abertura inválido.");
  const next = writeResults(db, round, draft);
  return replaceRound(next, { ...round, draft, openerId, editedAt: now.toISOString() });
}

/**
 * Desfaz a última rodada da partida (aberta ou fechada), apagando seus resultados.
 * O carroção dela volta a ser elegível porque a lista de utilizados é derivada.
 */
export function undoLastRound(db: Database, matchId: ID): Database {
  const match = requireInProgress(db, matchId);
  const rounds = getMatchRounds(db, matchId);
  const last = rounds[rounds.length - 1] ?? fail("Não há rodada para desfazer.");
  return replaceMatch(
    {
      ...db,
      rounds: db.rounds.filter((r) => r.id !== last.id),
      results: db.results.filter((r) => r.roundId !== last.id),
    },
    { ...match, openingSearch: null },
  );
}

// ---------------------------------------------------------------- Ajustes

export function updateSettings(db: Database, patch: Partial<Database["settings"]>): Database {
  const appName = patch.appName !== undefined ? patch.appName.trim() : db.settings.appName;
  if (!appName) fail("O nome do aplicativo não pode ficar vazio.");
  return { ...db, settings: { ...db.settings, ...patch, appName } };
}
