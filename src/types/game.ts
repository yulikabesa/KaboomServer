export type GameState = "created" | "active" | "ended";

export type GamePhase =
  | "lobby"
  | "question"
  | "answers"
  | "results"
  | "leaderboard"
  | "podium";

//TODO: CHANGE INDEXES TYPE
export interface UserAnswer {
  indexes: number[] | null;
  answeredAt: number | null; // Unix timestamp in ms
  correct: boolean | null;
}

export interface Player {
  nickname: string;
  rank: number;
  rankChange: number;
}

export interface LeaderboardEntry {
  id: string;
  nickname: string;
  score: number;
  rankChange: number;
}

export interface RawLeaderboardEntry {
  value: string; // userId
  score: number;
}

export interface GameMeta {
  quizId: string;
  host: string;
  state: GameState;
  phase: GamePhase;
  currentQuestion: number;
  questionCount: number;
  questionStartedAt?: number;
}

export interface GameQuestion {
  questionText: string;
  answerOptions: string[];
  correctIndexes: number[];
  timeLimit: number;
  scoringWeight: number;
  questionImage?: string;
}

export interface GameFullState {
  meta: GameMeta;
  players: Record<string, Player>;
  leaderboard: LeaderboardEntry[];
  question: GameQuestion | null;
  answers: Record<string, UserAnswer> | null;
}

export interface GamePersonalState {
  meta: GameMeta;
  player: Player | null;
  score: number | null;
  question: GameQuestion | null;
  answer: UserAnswer | null;
  rankAbove: string | null;
}
