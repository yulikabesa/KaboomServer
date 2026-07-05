import { redisClient } from "../db/redis/redis";
import { redisKeys } from "../db/redis/redisKeys";
import { gameEngine } from "../engine/gameEngine";
import {
  GameMeta,
  GamePhase,
  GameState,
  GameFullState,
  GameQuestion,
  UserAnswer,
  Player,
  GamePersonalState,
} from "../types/game";

let EXPIRE = 60 * 60 * 3;

export const gameRepository = {
  // Saves meta + all questions in a single pipeline (one round-trip)
  async createSession(
    pin: string,
    quizId: string,
    host: string,
    questions: GameQuestion[],
  ) {
    const pipeline = redisClient.multi();

    pipeline.hSet(redisKeys.meta(pin), {
      quizId,
      host,
      state: "created",
      phase: "lobby",
      currentQuestion: 0,
      questionCount: questions.length,
    });
    pipeline.expire(redisKeys.meta(pin), EXPIRE);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      pipeline.hSet(redisKeys.question(pin, i), {
        questionImage: q.questionImage ?? "",
        questionText: q.questionText,
        answerOptions: JSON.stringify(q.answerOptions),
        correctIndexes: JSON.stringify(q.correctIndexes),
        timeLimit: q.timeLimit || 10,
        scoringWeight: q.scoringWeight,
      });
      pipeline.expire(redisKeys.question(pin, i), EXPIRE);
    }

    await pipeline.exec();
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
      questionStartedAt:
        meta.questionStartedAt !== undefined
          ? Number(meta.questionStartedAt)
          : undefined,
    };
  },

  async getHost(pin: string) {
    return await redisClient.hGet(redisKeys.meta(pin), "host");
  },

  async addPlayer(pin: string, userId: string, nickname: string) {
    await Promise.all([
      redisClient.sAdd(redisKeys.players(pin), userId),
      redisClient.hSet(redisKeys.player(pin, userId), {
        nickname,
        oldRank: "",
        currentRank: "",
      }),
      redisClient.expire(redisKeys.player(pin, userId), EXPIRE),
    ]);
  },

  async initLeaderboard(pin: string, playerId: string) {
    await Promise.all([
      redisClient.zAdd(redisKeys.leaderboard(pin), [
        { score: 0, value: playerId },
      ]),
      redisClient.expire(redisKeys.leaderboard(pin), EXPIRE, "NX"),
    ]);
  },

  async getLeaderboard(pin: string) {
    return await redisClient.zRangeWithScores(
      redisKeys.leaderboard(pin),
      0,
      -1,
      { REV: true },
    );
  },

  async getQuestion(pin: string, index: number): Promise<GameQuestion | null> {
    const q = await redisClient.hGetAll(redisKeys.question(pin, index));
    return Object.keys(q).length === 0
      ? null
      : {
          questionImage: q.questionImage,
          questionText: q.questionText,
          answerOptions: JSON.parse(q.answerOptions) as string[],
          correctIndexes: JSON.parse(q.correctIndexes) as number[],
          timeLimit: Number(q.timeLimit),
          scoringWeight: Number(q.scoringWeight),
        };
  },

  async submitAnswer(
    pin: string,
    qIdx: number,
    playerId: string,
    indexes: number[],
  ) {
    if (await redisClient.sIsMember(redisKeys.answered(pin, qIdx), playerId))
      return;

    await Promise.all([
      redisClient.sAdd(redisKeys.answered(pin, qIdx), playerId),
      redisClient.hSet(redisKeys.answer(pin, qIdx, playerId), {
        indexes: indexes[0],
        answeredAt: Date.now(),
      }),
      redisClient.expire(redisKeys.answer(pin, qIdx, playerId), EXPIRE),
    ]);
  },

  async getAnswers(pin: string, qIdx: number) {
    const ids = await redisClient.sMembers(redisKeys.answered(pin, qIdx));

    const values = await Promise.all(
      ids.map((id) => redisClient.hGetAll(redisKeys.answer(pin, qIdx, id))),
    );

    return Object.fromEntries(
      values
        .map((answer, i) => [ids[i], answer])
        .filter(([, answer]) => Object.keys(answer).length > 0),
    ) as Record<string, UserAnswer>;
  },

  async getAnswer(pin: string, qIdx: number, userId: string) {
    const answer = await redisClient.hGetAll(
      redisKeys.answer(pin, qIdx, userId),
    );

    if (Object.keys(answer).length === 0) return null;

    const indexesArray = answer.indexes?.split("-").map(Number);
    return {
      answeredAt: Number(answer.answeredAt),
      indexes: indexesArray,
    };
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
    return {
      nickname: player.nickname,
      oldRank: Number(player.oldRank),
      currentRank: Number(player.currentRank),
    };
  },

  async getPlayers(pin: string) {
    const ids = await redisClient.sMembers(redisKeys.players(pin));

    const values = await Promise.all(
      ids.map((id) => redisClient.hGetAll(redisKeys.player(pin, id))),
    );

    return Object.fromEntries(
      values
        .map((player, i) => [ids[i], player])
        .filter(([, player]) => Object.keys(player).length > 0),
    ) as Record<string, Player>;
  },

  async updateRanks(pin: string) {
    const [leaderboard, players] = await Promise.all([
      this.getLeaderboard(pin),
      this.getPlayers(pin),
    ]);
    const playersMap = players;

    const pipeline = redisClient.multi();

    leaderboard.forEach((entry, index) => {
      const userId = entry.value;
      const player = playersMap[userId];
      if (!player) return;
      pipeline.hSet(redisKeys.player(pin, userId), {
        oldRank: player.currentRank,
        currentRank: index,
      });
    });

    await pipeline.exec();
  },

  async updateScores(pin: string, qIdx: number, startedAt: number) {
    const [question, answers] = await Promise.all([
      this.getQuestionOrThrow(pin, qIdx),
      this.getAnswers(pin, qIdx),
    ]);
    const pipeline = redisClient.multi();

    for (const [userId, answer] of Object.entries(answers)) {
      const timeTakenSec =
        startedAt > 0 ? Math.max(0, (answer.answeredAt - startedAt) / 1000) : 0;
      const score = gameEngine.calculateScore(
        question.correctIndexes,
        answer.indexes,
        question.scoringWeight,
        timeTakenSec,
        question.timeLimit,
      );
      if (score > 0)
        pipeline.zIncrBy(redisKeys.leaderboard(pin), score, userId);
    }
    await pipeline.exec();
  },

  async getRank(pin: string, playerId: string) {
    return await redisClient.zRevRank(redisKeys.leaderboard(pin), playerId);
  },

  async getRankAbove(pin: string, userId: string) {
    const rank = await this.getRank(pin, userId);
    if (!rank) return;
    const rankAbove = await redisClient.zRange(
      redisKeys.leaderboard(pin),
      rank + 1,
      rank + 1,
      { REV: true },
    );

    return rankAbove[0] ?? null;
  },

  async getScore(pin: string, userId: string) {
    return await redisClient.zScore(redisKeys.leaderboard(pin), userId);
  },

  async getFullState(pin: string): Promise<GameFullState | null> {
    const meta = await this.getMeta(pin);
    if (!meta) return null;

    const [players, rawLeaderboard, question, answers] = await Promise.all([
      this.getPlayers(pin),
      this.getLeaderboard(pin),
      meta.state === "active"
        ? this.getQuestion(pin, meta.currentQuestion)
        : Promise.resolve(null),
      meta.state === "active"
        ? this.getAnswers(pin, meta.currentQuestion)
        : Promise.resolve(null),
    ]);

    const playersMap = players || {};
    const leaderboard = gameEngine.mapLeaderboard(rawLeaderboard, playersMap);

    return {
      meta,
      players: playersMap,
      leaderboard,
      question,
      answers,
    };
  },

  async getPersonalState(
    pin: string,
    userId: string,
  ): Promise<GamePersonalState | null> {
    const meta = await this.getMeta(pin);
    if (!meta) return null;

    const [player, score, question, answer, rankAbove] = await Promise.all([
      this.getPlayer(pin, userId),
      this.getScore(pin, userId),
      meta.state === "active"
        ? this.getQuestion(pin, meta.currentQuestion)
        : Promise.resolve(null),
      meta.state === "active"
        ? this.getAnswer(pin, meta.currentQuestion, userId)
        : Promise.resolve(null),
      this.getRankAbove(pin, userId),
    ]);

    return {
      meta,
      player,
      score,
      question,
      answer,
      rankAbove: rankAbove ?? null,
    };
  },
};
