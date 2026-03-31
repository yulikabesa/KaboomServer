import { redisClient } from "../db/redis/redis";
import { redisKeys } from "../db/redis/redisKeys";
import {
  GameMeta,
  GamePhase,
  GameState,
  GameFullState,
  GameQuestion,
  UserAnswer,
} from "../types/game";

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
      phase: "lobby",
      currentQuestion: 0,
      questionCount,
    });
  },

  async setMeta(pin: string, updates: Partial<GameMeta>) {
    await redisClient.hSet(redisKeys.meta(pin), updates);
  },

  async getMeta(pin: string): Promise<GameMeta | null> {
    const meta = await redisClient.hGetAll(redisKeys.meta(pin));
    if (Object.keys(meta).length === 0) return null;

    return {
      quizId: meta.quizId,
      host: meta.host,
      state: meta.state as GameState,
      phase: meta.phase as GamePhase,
      currentQuestion: Number(meta.currentQuestion),
      questionCount: Number(meta.questionCount),
    };
  },

  async getHost(pin: string) {
    return await redisClient.hGet(redisKeys.meta(pin), "host");
  },

  async addPlayer(pin: string, userId: string, nickname: string) {
    await redisClient.hSet(redisKeys.players(pin), userId, nickname);
  },

  async getPlayers(pin: string) {
    const players = await redisClient.hGetAll(redisKeys.players(pin));
    return Object.keys(players).length === 0 ? null : players;
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
      5,
      { REV: true },
    );
  },

  async saveQuestion(pin: string, index: number, q: GameQuestion) {
    await redisClient.hSet(redisKeys.question(pin, index), {
      question: q.question,
      answers: JSON.stringify(q.answers),
      correctIndexes: JSON.stringify(q.correctIndexes),
      timeLimit: q.timeLimit || 10,
    });
  },

  async getQuestion(pin: string, index: number): Promise<GameQuestion | null> {
    const data = await redisClient.hGetAll(redisKeys.question(pin, index));
    return Object.keys(data).length === 0
      ? null
      : {
          question: data.question,
          answers: JSON.parse(data.answers) as string[],
          correctIndexes: JSON.parse(data.correctIndexes) as number[],
          timeLimit: Number(data.timeLimit),
        };
  },

  async submitAnswer(
    pin: string,
    qIdx: number,
    playerId: string,
    indexes: number[],
  ) {
    const answer: UserAnswer = {
      indexes: [0, 2, 3],
      answeredAt: Date.now(),
    };

    return await redisClient.hSetNX(
      redisKeys.answers(pin, qIdx),
      playerId,
      JSON.stringify(answer),
    );
  },

  async getAnswers(pin: string, qIdx: number) {
    const answers = await redisClient.hGetAll(redisKeys.answers(pin, qIdx));
    if (Object.keys(answers).length === 0) return null;

    const answersFormat: Record<string, UserAnswer> = {};
    for (const [userId, val] of Object.entries(answers)) {
      answersFormat[userId] = JSON.parse(val);
    }

    return answersFormat;
  },

  async getAnswerCount(pin: string, qIdx: number) {
    return await redisClient.hLen(redisKeys.answers(pin, qIdx));
  },

  async getMetaOrThrow(pin: string) {
    const meta = await this.getMeta(pin);
    if (!meta) throw new Error("Game not found");
    return meta;
  },

  async getQuestionOrThrow(pin: string, index: number) {
    const question = await this.getQuestion(pin, index);
    if (!question) throw new Error("Question not found");
    return question;
  },

  async getPlayer(pin: string, userId: string) {
    return await redisClient.hGet(redisKeys.players(pin), userId);
  },

  async getFullState(pin: string): Promise<GameFullState | null> {
    const meta = await this.getMeta(pin);
    if (!meta) return null;

    const players = (await this.getPlayers(pin)) || {};
    const leaderboard = await this.getLeaderboard(pin);

    let question = null;
    let answers = null;

    if (meta.state === "playing") {
      question = await this.getQuestion(pin, meta.currentQuestion);
      answers = await this.getAnswers(pin, meta.currentQuestion);
    }

    return {
      meta,
      players,
      leaderboard,
      question,
      answers,
    };
  },

  // async setUserGame(userId: string, pin: string) {
  //   await redisClient.set(redisKeys.userGame(userId), pin);
  // },

  // async getUserGame(userId: string) {
  //   return await redisClient.get(redisKeys.userGame(userId));
  // },

  // async clearUserGame(userId: string) {
  //   // when game finishes/ host leaves or something idkkk
  //   await redisClient.del(redisKeys.userGame(userId));
  // },
};
