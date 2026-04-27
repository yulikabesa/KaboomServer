export const redisKeys = {
  // Hash { quizId, host, state, phase, currentQuestion, questionCount }
  meta: (pin: string) =>
    `session:${pin}:meta`,

  // Hash { question, answers, correctIndexes, timeLimit, scoringWeight }
  question: (pin: string, qIdx: number) =>
    `session:${pin}:question:${qIdx}`,

  // Set
  players: (pin: string) =>
    `session:${pin}:players`,

  // Hash 
  player: (pin: string, userId: string) =>
    `session:${pin}:player:${userId}`,

  // Hash { userId: JSON -> { indexes, answeredAt } }
  answers: (pin: string, qIdx: number) =>
    `session:${pin}:answers:${qIdx}`,

  // Sorted Set
  leaderboard: (pin: string) =>
    `session:${pin}:leaderboard`,
};
