export const redisKeys = {
  // Hash { quizId, host, state, phase, currentQuestion, questionCount }
  meta: (pin: string) =>
    `session:${pin}:meta`,

  // Hash { questionText, answerOptions, correctIndexes, timeLimit, scoringWeight }
  question: (pin: string, qIdx: number) =>
    `session:${pin}:question:${qIdx}`,

  // Set of userId (all players)
  players: (pin: string) =>
    `session:${pin}:players`,

  // Hash { nickname, oldRank, currentRank }
  player: (pin: string, userId: string) =>
    `session:${pin}:player:${userId}`,

  // Set of userId
  answered: (pin: string, qIdx: number) =>
    `session:${pin}:answers:${qIdx}`,

  // Hash { indexes, answeredAt }
  answer: (pin: string, qIdx: number, userId: string) => 
    `session:${pin}:answer:${qIdx}:player:${userId}`,

  // Sorted Set
  leaderboard: (pin: string) =>
    `session:${pin}:leaderboard`,
};
