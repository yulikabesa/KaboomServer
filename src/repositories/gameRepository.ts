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

const EXPIRE = 60 * 60 * 3;

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

  async isNicknameTaken(pin: string, nickname: string, userId: string) {
    const pipeline = redisClient.multi();
    const players = await redisClient.sMembers(redisKeys.players(pin));
    for (const playerId of players) {
      // to allow a player to reconnect with the same nickname
      if (playerId === userId) continue;
      pipeline.hGet(redisKeys.player(pin, playerId), "nickname");
    }
    const nicknames = (await pipeline.exec()) as unknown as Array<string>;
    return nicknames.includes(nickname);
  },

  async addPlayer(pin: string, userId: string, nickname: string) {
    const nicknameTaken = await this.isNicknameTaken(pin, nickname, userId);
    if (nicknameTaken)
      return { success: false, error: "השם שבחרת תפוס" };

    await redisClient
      .multi()
      .sAdd(redisKeys.players(pin), userId)
      .expire(redisKeys.players(pin), EXPIRE)
      .hSet(redisKeys.player(pin, userId), {
        nickname,
        rank: -1,
        rankChange: 0,
      })
      .expire(redisKeys.player(pin, userId), EXPIRE)
      .zAdd(redisKeys.leaderboard(pin), [{ score: 0, value: userId }])
      .expire(redisKeys.leaderboard(pin), EXPIRE)
      .exec();
    return { success: true, player: { id: userId, nickname } };
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

    await redisClient
      .multi()
      .sAdd(redisKeys.answered(pin, qIdx), playerId)
      .hSet(redisKeys.answer(pin, qIdx, playerId), {
        indexes: indexes[0],
        answeredAt: Date.now(),
      })
      .expire(redisKeys.answer(pin, qIdx, playerId), EXPIRE)
      .exec();
  },

  async getAnswers(
    pin: string,
    qIdx: number,
  ): Promise<Record<string, UserAnswer>> {
    const ids = await redisClient.sMembers(redisKeys.answered(pin, qIdx));
    if (ids.length === 0) return {};

    const pipeline = redisClient.multi();
    for (const id of ids) pipeline.hGetAll(redisKeys.answer(pin, qIdx, id));
    const rows = (await pipeline.exec()) as unknown as Array<
      Record<string, string>
    >;

    const out: Record<string, UserAnswer> = {};
    for (let i = 0; i < ids.length; i++) {
      const row = rows[i];
      if (!row || Object.keys(row).length === 0) continue;
      out[ids[i]] = {
        answeredAt: Number(row.answeredAt),
        indexes: row.indexes?.split("-").map(Number),
      };
    }
    return out;
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

  async getPlayerCount(pin: string) {
    return await redisClient.sCard(redisKeys.players(pin));
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
      rank: Number(player.rank),
      rankChange: Number(player.rankChange),
    };
  },

  async getPlayers(pin: string): Promise<Record<string, Player>> {
    const ids = await redisClient.sMembers(redisKeys.players(pin));
    if (ids.length === 0) return {};

    const pipeline = redisClient.multi();
    for (const id of ids) pipeline.hGetAll(redisKeys.player(pin, id));
    const rows = (await pipeline.exec()) as unknown as Array<
      Record<string, string>
    >;

    const out: Record<string, Player> = {};
    for (let i = 0; i < ids.length; i++) {
      const row = rows[i];
      if (!row || Object.keys(row).length === 0) continue;
      out[ids[i]] = {
        nickname: row.nickname,
        rank: Number(row.rank),
        rankChange: Number(row.rankChange),
      };
    }
    return out;
  },

  async updateRanks(pin: string) {
    const [leaderboard, players] = await Promise.all([
      this.getLeaderboard(pin),
      this.getPlayers(pin),
    ]);

    const pipeline = redisClient.multi();
    leaderboard.forEach((entry, index) => {
      const userId = entry.value;
      const player = players[userId];
      if (!player) return;
      const prevRank = player.rank;
      pipeline.hSet(redisKeys.player(pin, userId), {
        rankChange: prevRank < 0 ? 0 : Math.sign(prevRank - index),
        rank: index,
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

  // async updateRanksAndScores(pin: string, qIdx: number, startedAt: number) {
  //   const [players, question, answers] = await Promise.all([
  //     this.getPlayers(pin),
  //     this.getQuestionOrThrow(pin, qIdx),
  //     this.getAnswers(pin, qIdx),
  //   ]);

  //   const scoresPipeline = redisClient.multi();

  //   for (const [userId, answer] of Object.entries(answers)) {
  //     const timeTakenSec =
  //       startedAt > 0 ? Math.max(0, (answer.answeredAt - startedAt) / 1000) : 0;
  //     const score = gameEngine.calculateScore(
  //       question.correctIndexes,
  //       answer.indexes,
  //       question.scoringWeight,
  //       timeTakenSec,
  //       question.timeLimit,
  //     );
  //     if (score > 0)
  //       scoresPipeline.zIncrBy(redisKeys.leaderboard(pin), score, userId);
  //   }
  //   await scoresPipeline.exec();

  //   const leaderboard = await this.getLeaderboard(pin);

  //   const ranksPipeline = redisClient.multi();
  //   leaderboard.forEach((entry, index) => {
  //     const userId = entry.value;
  //     const player = players[userId];
  //     if (!player) return;
  //     const prevRank = player.rank;
  //     ranksPipeline.hSet(redisKeys.player(pin, userId), {
  //       rankChange: prevRank < 0 ? 0 : Math.sign(prevRank - index),
  //       rank: index,
  //     });
  //   });

  //   await ranksPipeline.exec();
  // },

  async getRank(pin: string, playerId: string) {
    return await redisClient.zRevRank(redisKeys.leaderboard(pin), playerId);
  },

  async getScore(pin: string, userId: string) {
    return await redisClient.zScore(redisKeys.leaderboard(pin), userId);
  },

  async getFullState(pin: string): Promise<GameFullState | null> {
    const meta = await this.getMeta(pin);
    if (!meta) return null;

    // What each phase actually consumes:
    //   lobby       -> players
    //   question    -> players, question, leaderboard (personal score)
    //   answers     -> players, question, leaderboard (personal score)
    //   results     -> players, question, leaderboard, answers (host distribution + personal isCorrect)
    //   leaderboard -> players, question, leaderboard, answers (personal isCorrect)
    //   podium      -> players, leaderboard
    const needsQuestion =
      meta.phase === "question" ||
      meta.phase === "answers" ||
      meta.phase === "results" ||
      meta.phase === "leaderboard";
    const needsAnswers =
      meta.phase === "answers" ||
      meta.phase === "results" ||
      meta.phase === "leaderboard";
    const needsLeaderboard = meta.phase !== "lobby";

    const [players, rawLeaderboard, question, answers] = await Promise.all([
      this.getPlayers(pin),
      needsLeaderboard ? this.getLeaderboard(pin) : Promise.resolve([]),
      needsQuestion
        ? this.getQuestion(pin, meta.currentQuestion)
        : Promise.resolve(null),
      needsAnswers
        ? this.getAnswers(pin, meta.currentQuestion)
        : Promise.resolve(null),
    ]);

    const leaderboard = gameEngine.mapLeaderboard(rawLeaderboard, players);

    return {
      meta,
      players,
      leaderboard,
      question,
      answers,
    };
  },
};
