export type TournamentStatus = 'SETUP' | 'REGULAR' | 'PLAYOFF' | 'FINISHED';

/** Regla del catálogo modular (definido en el backend, src/rules/registry.ts). */
export interface Rule {
  id: string;
  label: string;
  emoji: string;
  description: string;
  needsDeclarations: boolean;
  appliesAtDraw: boolean;
  goldenGoal: boolean;
}

export type RoundStatus =
  | 'PENDING'
  | 'PAIRED'
  | 'EVENT_OPEN'
  | 'ACTIVE'
  | 'COMPLETED';
export type MatchStatus = 'SCHEDULED' | 'PLAYED';

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  currentRound: number;
  numGroups: number;
  regularComplete: boolean;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  classifyPerGroup: number;
  wildcards: number;
  /** Ids de reglas activas para la ruleta de jornada. */
  rulePool: string[];
  groups: Group[];
  players: Player[];
  totalClassified?: number;
}

export interface Group {
  id: string;
  name: string;
  order: number;
}

export interface Player {
  id: string;
  name: string;
  seed: number;
  active: boolean;
  groupId: string | null;
  group?: Group | null;
}

export interface Standing {
  playerId: string;
  name: string;
  seed: number;
  groupId: string | null;
  groupName: string | null;
  active: boolean;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  byes: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  rank: number;
  groupRank: number;
}

export interface GroupTable {
  groupId: string;
  name: string;
  order: number;
  players: Standing[];
}

export interface Match {
  id: string;
  roundId: string;
  homePlayerId: string;
  awayPlayerId: string;
  homeScore: number | null;
  awayScore: number | null;
  goldenGoal: boolean;
  status: MatchStatus;
  homePlayer: Player;
  awayPlayer: Player;
}

export interface Bet {
  id: string;
  playerId: string;
  pointsBet: number;
  player: Player;
}
export interface Alliance {
  id: string;
  playerId: string;
  allyId: string;
  player: Player;
  ally: Player;
}
export interface DiceRoll {
  id: string;
  playerId: string;
  value: number;
  player: Player;
}

export interface Round {
  id: string;
  number: number;
  status: RoundStatus;
  /** Regla de la jornada (id del catálogo). null = jornada tranquila. */
  ruleId: string | null;
  eventDrawn: boolean;
  eventResolved: boolean;
  byePlayerId: string | null;
  byePlayer: Player | null;
  matches: Match[];
  bets?: Bet[];
  alliances?: Alliance[];
  diceRolls?: DiceRoll[];
}

export interface Classified {
  playoffSeed: number;
  playerId: string;
  name: string;
  rank: number;
  groupName: string | null;
  via: string;
  points: number;
}

export interface PlayoffMatch {
  id: string;
  bracket: 'WINNERS' | 'LOSERS' | 'GRAND_FINAL';
  roundIndex: number;
  slotIndex: number;
  label: string | null;
  homePlayerId: string | null;
  awayPlayerId: string | null;
  homeSeed: number | null;
  awaySeed: number | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerId: string | null;
  status: MatchStatus;
  homeName: string | null;
  awayName: string | null;
  winnerName: string | null;
}

/** Texto para una jornada tranquila (sin regla). */
export const QUIET_RULE = {
  label: 'Jornada tranquila',
  emoji: '😌',
  description: 'No cayó ninguna regla esta jornada.',
};
