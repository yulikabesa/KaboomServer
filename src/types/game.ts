export type GameState = "lobby" | "playing" | "finished";

export type GamePhase =
  | "lobby"
  | "question"
  | "answers"
  | "results"
  | "leaderboard"
  | "podium";

export interface UserAnswer {
  indexes: number[];
  answeredAt: number; // Unix timestamp in ms
}

export interface Player {
  nickname: string;
  oldRank: number | null;
  currentRank: number | null;
}

export interface GameMeta {
  quizId: string;
  host: string;
  state: GameState;
  phase: GamePhase;
  currentQuestion: number;
  questionCount: number;
}

export interface GameQuestion {
  questionText: string;
  answerOptions: string[];
  correctIndexes: number[];
  timeLimit: number;
  scoringWeight: number;
  questionImage?: string | null;
}

export interface GameFullState {
  meta: GameMeta;
  players: string[];
  leaderboard: { nickname: string; score: number }[];
  question: GameQuestion | null;
  answers: Record<string, UserAnswer> | null;
  pin: string;
}
