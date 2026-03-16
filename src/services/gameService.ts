import { redisClient } from "../db/redis/redis";
import { redisKeys } from "../db/redis/redisKeys";
import { QuizService } from "./quizService";

const formatQuestionForClient = (question: {
  question: string;
  answers: string[];
  correctIndexes: number[];
  timeLimit: number;
}) => ({
  question: question.question,
  timeLimit: question.timeLimit,
  answers: question.answers,
});

const generatePin = () =>
  Math.floor(1000000 + Math.random() * 9000000).toString();

const getQuestion = async (pin: string, index: number) => {
  const data = await redisClient.hGetAll(redisKeys.question(pin, index));

  if (!data || Object.keys(data).length === 0) {
    throw new Error("Question not found");
  }

  return {
    question: data.question,
    answers: JSON.parse(data.answers) as string[],
    correctIndexes: JSON.parse(data.correctIndexes) as number[],
    timeLimit: Number(data.timeLimit),
  };
};

export const gameService = {
  async createGameSession(quizId: string, hostSocketId: string) {
    const quiz = await QuizService.getQuizById(quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    let pin = generatePin();
    while (await redisClient.exists(redisKeys.meta(pin))) {
      pin = generatePin();
    }

    await redisClient.hSet(redisKeys.meta(pin), {
      quizId,
      host: hostSocketId,
      state: "lobby",
      currentQuestion: 0,
      questionCount: quiz.questions.length,
    });

    for (let i = 0; i < quiz.questions.length; i++) {
      const q = quiz.questions[i];

      await redisClient.hSet(redisKeys.question(pin, i), {
        question: q.question,
        answers: JSON.stringify(q.answers),
        correctIndexes: JSON.stringify(q.correctIndexes),
        timeLimit: q.timeLimit || 10,
      });
    }

    return { pin };
  },

  async isHost(pin: string, socketId: string) {
    const host = await redisClient.hGet(redisKeys.meta(pin), "host");

    return host === socketId;
  },

  async addPlayer(pin: string, nickname: string, socketId: string) {
    const player = {
      id: socketId,
      nickname,
    };

    await redisClient.hSet(redisKeys.players(pin), socketId, nickname);

    await redisClient.zAdd(redisKeys.leaderboard(pin), [
      {
        score: 0,
        value: socketId,
      },
    ]);

    return player;
  },

  async startGame(pin: string) {
    await redisClient.hSet(redisKeys.meta(pin), {
      state: "playing",
      currentQuestion: 0,
    });

    const question = await getQuestion(pin, 0);
    return formatQuestionForClient(question);
  },

  async submitAnswer(pin: string, playerId: string, answerIndex: number) {
    const state = await redisClient.hGet(redisKeys.meta(pin), "state");
    if (state !== "playing") return;

    const qIdx = Number(
      await redisClient.hGet(redisKeys.meta(pin), "currentQuestion"),
    );
    const question = await getQuestion(pin, qIdx);

    const setAnswer = await redisClient.hSetNX(
      redisKeys.answers(pin, qIdx),
      playerId,
      answerIndex.toString(),
    );

    if (!setAnswer) return;

    // await redisClient.hIncrBy(
    //   redisKeys.answerCounts(pin, qIdx),
    //   answerIndex.toString(),
    //   1,
    // );

    const correctAnswers = question.correctIndexes;
    let score = 0;
    if (correctAnswers.includes(answerIndex)) {
      score = 1000;
      await redisClient.zIncrBy(redisKeys.leaderboard(pin), score, playerId);
    }

    return score;
  },

  async nextQuestion(pin: string) {
    const meta = await redisClient.hGetAll(redisKeys.meta(pin));
    const current = Number(meta.currentQuestion) + 1;

    const total = Number(meta.questionCount);
    if (current >= total) {
      await redisClient.hSet(redisKeys.meta(pin), "state", "finished");
      return null;
    }

    await redisClient.hSet(redisKeys.meta(pin), "currentQuestion", current);

    const question = await getQuestion(pin, current);
    return formatQuestionForClient(question);
  },

  async endQuestion(pin: string) {
    const meta = await redisClient.hGetAll(redisKeys.meta(pin));
    const qIdx = Number(meta.currentQuestion);

    const question = await getQuestion(pin, qIdx);
    const correctIndexes = question.correctIndexes;

    const distribution = await gameService.getAnswerDistribution(pin, qIdx);
    const leaderboard = await gameService.getLeaderboard(pin);

    return {
      correctAnswers: correctIndexes,
      distribution,
      leaderboard,
    };
  },

  async getPlayers(pin: string) {
    return await redisClient.hGetAll(redisKeys.players(pin));
  },

  async getLeaderboard(pin: string) {
    const data = await redisClient.zRangeWithScores(
      redisKeys.leaderboard(pin),
      0,
      -1,
      { REV: true },
    );

    const players = await redisClient.hGetAll(redisKeys.players(pin));

    return data.map((p) => ({
      playerId: p.value,
      nickname: players[p.value],
      score: p.score,
    }));
  },

  async getAnswerDistribution(pin: string, qIdx: number) {
    // return await redisClient.hGetAll(redisKeys.answerCounts(pin, qIdx));

    const answers = await redisClient.hGetAll(redisKeys.answers(pin, qIdx));
    const question = await getQuestion(pin, qIdx);

    const counts = new Array(question.answers.length).fill(0);
    for (const answer of Object.values(answers)) {
      counts[Number(answer)]++;
    }

    return counts;
  },

  async getAnswerProgress(pin: string) {
    const qIdx = Number(
      await redisClient.hGet(redisKeys.meta(pin), "currentQuestion"),
    );

    const answered = await redisClient.hLen(redisKeys.answers(pin, qIdx));
    const totalPlayers = await redisClient.hLen(redisKeys.players(pin));

    return {
      answered,
      totalPlayers,
    };
  },
};
