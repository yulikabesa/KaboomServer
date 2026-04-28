import { redisClient } from "../db/redis/redis";
import { redisKeys } from "../db/redis/redisKeys";
import { gameEngine } from "../engine/gameEngine";
import {
  GameMeta,
  GamePhase,
  GameState,
  GameFullState,
  GameQuestion,
  Player,
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
    await redisClient.sAdd(redisKeys.players(pin), userId);

    await redisClient.hSet(redisKeys.player(pin, userId), {
      nickname,
      oldRank: "",
      currentRank: "",
    });
  },

  async initLeaderboard(pin: string, userId: string) {
    await redisClient.zAdd(redisKeys.leaderboard(pin), [
      { score: 0, value: userId },
    ]);
  },

  async incrementScore(pin: string, userId: string, score: number) {
    await redisClient.zIncrBy(redisKeys.leaderboard(pin), score, userId);
  },

  async getLeaderboard(pin: string) {
    return await redisClient.zRangeWithScores(
      redisKeys.leaderboard(pin),
      0,
      -1,
      { REV: true },
    );
  },

  async saveQuestion(pin: string, index: number, q: GameQuestion) {
    await redisClient.hSet(redisKeys.question(pin, index), {
      questionImage: q.questionImage || "",
      questionText: q.questionText,
      answerOptions: JSON.stringify(q.answerOptions),
      correctIndexes: q.correctIndexes.join("-"),
      timeLimit: q.timeLimit || 10,
      scoringWeight: q.scoringWeight,
    });
  },

  async getQuestion(pin: string, index: number): Promise<GameQuestion | null> {
    const q = await redisClient.hGetAll(redisKeys.question(pin, index));
    return Object.keys(q).length === 0
      ? null
      : {
          questionImage: q.questionImage,
          questionText: q.questionText,
          answerOptions: JSON.parse(q.answerOptions) as string[],
          correctIndexes: q.correctIndexes.split("-").map(Number),
          timeLimit: Number(q.timeLimit),
          scoringWeight: Number(q.scoringWeight),
        };
  },

  async submitAnswer(
    pin: string,
    qIdx: number,
    userId: string,
    indexes: number[],
  ) {
    if (await redisClient.sIsMember(redisKeys.answered(pin, qIdx), userId))
      return;

    const answer = indexes.join("-");
    await redisClient.sAdd(redisKeys.answered(pin, qIdx), userId);
    await redisClient.hSet(redisKeys.answer(pin, qIdx, userId), {
      indexes: answer,
      answeredAt: Date.now(),
    });
  },

  async getAnswer(pin: string, qIdx: number, userId: string) {
    const answer = await redisClient.hGetAll(
      redisKeys.answer(pin, qIdx, userId),
    );

    const indexesArray = answer.indexes.split("-").map(Number);
    return {
      answeredAt: Number(answer.answeredAt),
      indexes: indexesArray,
    };
  },

  async getAnswers(pin: string, qIdx: number) {
    const answers: Record<string, UserAnswer> = {};
    const answered = await redisClient.sMembers(redisKeys.answered(pin, qIdx));
    for (const userId of answered) {
      const answer = await this.getAnswer(pin, qIdx, userId);
      if (answer) answers[userId] = answer;
    }
    return answers;
  },

  async getAnswerCount(pin: string, qIdx: number) {
    return await redisClient.sCard(redisKeys.answered(pin, qIdx));
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
    const player = await redisClient.hGetAll(redisKeys.player(pin, userId));
    if (!player) return null;

    return player;
  },

  async getPlayers(pin: string) {
    return await redisClient.sMembers(redisKeys.players(pin));
  },

  async updateRanks(pin: string) {
    const players = await this.getPlayers(pin);
    for (const userId of players) {
      const player = await redisClient.hGetAll(redisKeys.player(pin, userId));
      const currentRank = await this.getRank(pin, userId);
      await redisClient.hSet(redisKeys.player(pin, userId), {
        ...player,
        oldRank: player.currentRank,
        currentRank: currentRank || "",
      });
    }
  },

  async updateScores(pin: string, qIdx: number) {
    const question = await this.getQuestionOrThrow(pin, qIdx);

    const answers = await this.getAnswers(pin, qIdx);
    for (const [userId, answer] of Object.entries(answers)) {
      const score = gameEngine.calculateScore(
        question.correctIndexes,
        answer.indexes,
        question.scoringWeight,
      );
      if (score > 0) await this.incrementScore(pin, userId, score);
    }
  },

  async getRank(pin: string, playerId: string) {
    return await redisClient.zRevRank(redisKeys.leaderboard(pin), playerId);
  },

  // async getRankAbove(pin: string, rank: number | null) {
  //   if (!rank) return;
  //   return await redisClient.zRange(
  //     redisKeys.leaderboard(pin),
  //     rank + 1,
  //     rank + 1,
  //     { REV: true },
  //   );
  // },

  async getScore(pin: string, userId: string) {
    return await redisClient.zScore(redisKeys.leaderboard(pin), userId);
  },

  async getFullState(pin: string): Promise<GameFullState | null> {
    const meta = await this.getMeta(pin);
    if (!meta) return null;

    const players = await this.getPlayers(pin);
    const leaderboard = gameEngine.mapLeaderboard(
      await this.getLeaderboard(pin),
      players,
    );

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
      pin,
    };
  },
};
