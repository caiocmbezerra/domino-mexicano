/**
 * Modelo de dados do aplicativo.
 *
 * Princípio: totais, rankings, estatísticas e a lista de carroções já utilizados são
 * SEMPRE derivados das rodadas e dos resultados gravados — nunca armazenados em
 * duplicidade — para que placar e histórico não possam divergir.
 */

export type ID = string;

export interface Player {
  id: ID;
  name: string;
  createdAt: string; // ISO
}

/** Critérios de desempate configuráveis pela turma (não são regras oficiais). */
export type TieBreaker = "zeroDoubles" | "wins" | "lowestMaxRound";

export interface MatchSettings {
  /** Regra da turma: quem termina com o 0-0 na mão recebe zero ponto na rodada. */
  zeroDoubleScoresZero: boolean;
  /** Critérios aplicados, em ordem, quando a pontuação acumulada empata. */
  tieBreakers: TieBreaker[];
  /** Maior carroção do conjunto (12 no duplo-12). */
  highestDouble: number;
}

export type MatchStatus = "in_progress" | "finished";

export interface Match {
  id: ID;
  startedAt: string;
  endedAt: string | null;
  status: MatchStatus;
  settings: MatchSettings;
  /** Participantes na ordem de exibição escolhida antes do início. */
  participantIds: ID[];
  /**
   * Posição atual da busca do carroção de abertura (apenas navegação de tela,
   * NÃO marca nada como utilizado). null = busca ainda não iniciada.
   */
  openingSearch: number | "exhausted" | null;
}

export type RoundStatus = "open" | "closed";

/** Rascunho da rodada em andamento (salvo a cada toque para sobreviver ao fechamento do app). */
export interface RoundDraft {
  /** IDs dos jogadores na ordem em que saíram (índice 0 = 1º a sair = vencedor). */
  exitOrder: ID[];
  /** Pontos das peças restantes informados pelo operador. */
  points: Record<ID, number | null>;
  /** Quem terminou com o 0-0 na mão. */
  zeroDouble: Record<ID, boolean>;
}

export interface Round {
  id: ID;
  matchId: ID;
  number: number;
  /** Valor do carroção de abertura (12 = 12-12). null apenas em exceção manual sem carroção. */
  openingDouble: number | null;
  openerId: ID | null;
  /** Rodada iniciada por exceção manual (sem carroção elegível encontrado). */
  manualException: boolean;
  exceptionNote: string | null;
  status: RoundStatus;
  draft: RoundDraft;
  createdAt: string;
  closedAt: string | null;
  /** Última edição após o fechamento, se houver. */
  editedAt: string | null;
}

export interface RoundResult {
  id: ID;
  roundId: ID;
  playerId: ID;
  /** 1 = primeiro a sair. null = permaneceu com peças. */
  exitPosition: number | null;
  /** Soma das peças restantes informada (null se não informada, ex.: regra do 0-0). */
  remainingPoints: number | null;
  /** Pontuação efetivamente contabilizada no placar. */
  countedPoints: number;
  isWinner: boolean;
  hadZeroDouble: boolean;
}

export interface AppSettings {
  appName: string;
  defaultMatchSettings: MatchSettings;
  theme: "dark" | "light";
  /**
   * Botão de contagem por foto na rodada. Opcional, à escolha do organizador:
   * desligado por padrão — digitar os pontos continua sendo o caminho normal.
   */
  photoCount: boolean;
}

export interface Database {
  schemaVersion: 1;
  players: Player[];
  matches: Match[];
  rounds: Round[];
  results: RoundResult[];
  settings: AppSettings;
}
