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
      state: "lobby",
      phase: "lobby",
      currentQuestion: 0,
      questionCount: questions.length,
    });

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
    };
  },

  async getHost(pin: string) {
    return await redisClient.hGet(redisKeys.meta(pin), "host");
  },

  async addPlayer(pin: string, userId: string, nickname: string) {
    const player = {
      nickname,
      oldRank: null,
      currentRank: null,
    };

    await redisClient.hSet(
      redisKeys.players(pin),
      userId,
      JSON.stringify(player),
    );
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

  async saveQuestion(pin: string, index: number, q: GameQuestion) {
    await redisClient.hSet(redisKeys.question(pin, index), {
      questionImage: q.questionImage ?? "",
      questionText: q.questionText,
      answerOptions: JSON.stringify(q.answerOptions),
      correctIndexes: JSON.stringify(q.correctIndexes),
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
    const answer: UserAnswer = {
      indexes,
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
    const player = await redisClient.hGet(redisKeys.players(pin), userId);
    if (!player) return null;
    return JSON.parse(player);
  },

  async getPlayers(pin: string) {
    const players = await redisClient.hGetAll(redisKeys.players(pin));
    if (Object.keys(players).length === 0) return null;

    const playersFormat: Record<string, Player> = {};
    for (const [userId, val] of Object.entries(players)) {
      playersFormat[userId] = JSON.parse(val);
    }

    return playersFormat;
  },

  async updateRanks(pin: string) {
    // Fetch both in parallel - leaderboard is already sorted by score descending
    const [leaderboard, players] = await Promise.all([
      this.getLeaderboard(pin),
      this.getPlayers(pin),
    ]);
    const playersMap = players || {};

    // Build rank map from sorted leaderboard (index = rank, 0-based)
    const pipeline = redisClient.multi();
    leaderboard.forEach((entry, index) => {
      const userId = entry.value;
      const player = playersMap[userId];
      if (!player) return;
      player.oldRank = player.currentRank;
      player.currentRank = index;
      pipeline.hSet(redisKeys.players(pin), userId, JSON.stringify(player));
    });
    await pipeline.exec();
  },

  async updateScores(pin: string, qIdx: number) {
    const [question, answers] = await Promise.all([
      this.getQuestionOrThrow(pin, qIdx),
      this.getAnswers(pin, qIdx),
    ]);

    const pipeline = redisClient.multi();
    for (const [userId, answer] of Object.entries(answers || {})) {
      const score = gameEngine.calculateScore(
        question.correctIndexes,
        answer.indexes,
        question.scoringWeight,
      );
      if (score > 0) {
        pipeline.zIncrBy(redisKeys.leaderboard(pin), score, userId);
      }
    }
    await pipeline.exec();
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

    const [players, rawLeaderboard, question, answers] = await Promise.all([
      this.getPlayers(pin),
      this.getLeaderboard(pin),
      meta.state === "playing"
        ? this.getQuestion(pin, meta.currentQuestion)
        : Promise.resolve(null),
      meta.state === "playing"
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
};
