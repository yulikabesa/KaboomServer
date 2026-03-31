export type GameState = "lobby" | "playing" | "finished";

export type GamePhase =
  | "lobby"
  | "question"
  | "answers"
  | "results"
  | "leaderboard";

export interface UserAnswer {
  indexes: number[];
  answeredAt: number; // Unix timestamp in ms
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
  question: string;
  answers: string[];
  correctIndexes: number[];
  timeLimit: number;
}

export interface GameFullState {
  meta: GameMeta;
  players: Record<string, string>;
  leaderboard: { value: string; score: number }[];
  question: GameQuestion | null;
  answers: Record<string, UserAnswer> | null;
}
