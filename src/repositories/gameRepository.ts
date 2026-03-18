import { redisClient } from "../db/redis/redis";
import { redisKeys } from "../db/redis/redisKeys";

export const gameRepository = {
  async createMeta(
    pin: string,
    quizId: string,
    host: string,
    questionCount: number,
  ) {
    await redisClient.hSet(redisKeys.meta(pin), {
      quizId,
      host,
      state: "lobby",
      currentQuestion: 0,
      questionCount,
    });
  },

  async setState(pin: string, state: string) {
    await redisClient.hSet(redisKeys.meta(pin), "state", state);
  },

  async setCurrentQuestion(pin: string, index: number) {
    await redisClient.hSet(redisKeys.meta(pin), "currentQuestion", index);
  },

  async getMeta(pin: string) {
    const meta = await redisClient.hGetAll(redisKeys.meta(pin));

    // Check if the returned object is empty
    if (Object.keys(meta).length === 0) {
      return null;
    }

    return meta;
    // return await redisClient.hGetAll(redisKeys.meta(pin));
  },

  async getHost(pin: string) {
    return await redisClient.hGet(redisKeys.meta(pin), "host");
  },

  async addPlayer(pin: string, socketId: string, nickname: string) {
    await redisClient.hSet(redisKeys.players(pin), socketId, nickname);
  },

  async getPlayers(pin: string) {
    return await redisClient.hGetAll(redisKeys.players(pin));
  },

  async initLeaderboard(pin: string, playerId: string) {
    await redisClient.zAdd(redisKeys.leaderboard(pin), [
      { score: 0, value: playerId },
    ]);
  },

  async incrementScore(pin: string, playerId: string, score: number) {
    await redisClient.zIncrBy(redisKeys.leaderboard(pin), score, playerId);
  },

  async getLeaderboard(pin: string) {
    return await redisClient.zRangeWithScores(
      redisKeys.leaderboard(pin),
      0,
      -1,
      { REV: true },
    );
  },

  async saveQuestion(pin: string, index: number, q: any) {
    await redisClient.hSet(redisKeys.question(pin, index), {
      question: q.question,
      answers: JSON.stringify(q.answers),
      correctIndexes: JSON.stringify(q.correctIndexes),
      timeLimit: q.timeLimit || 10,
    });
  },

  async getQuestion(pin: string, index: number) {
    const data = await redisClient.hGetAll(redisKeys.question(pin, index));

    return {
      question: data.question,
      answers: JSON.parse(data.answers),
      correctIndexes: JSON.parse(data.correctIndexes),
      timeLimit: Number(data.timeLimit),
    };
  },

  async submitAnswer(
    pin: string,
    qIdx: number,
    playerId: string,
    answer: number,
  ) {
    return await redisClient.hSetNX(
      redisKeys.answers(pin, qIdx),
      playerId,
      answer.toString(),
    );
  },

  async getAnswers(pin: string, qIdx: number) {
    return await redisClient.hGetAll(redisKeys.answers(pin, qIdx));
  },

  async getAnswerCount(pin: string, qIdx: number) {
    return await redisClient.hLen(redisKeys.answers(pin, qIdx));
  },
};
