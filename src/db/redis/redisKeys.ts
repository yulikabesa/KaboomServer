export const redisKeys = {

  meta: (pin: string) =>
    `session:${pin}:meta`,

  question: (pin: string, i: number) =>
    `session:${pin}:question:${i}`,

  players: (pin: string) =>
    `session:${pin}:players`,

  answers: (pin: string, qIdx: number) =>
    `session:${pin}:answers:${qIdx}`,

  leaderboard: (pin: string) =>
    `session:${pin}:leaderboard`,

  answerCounts: (pin: string, qIdx: number) => 
    `session:${pin}:answerCounts:${qIdx}`
};
