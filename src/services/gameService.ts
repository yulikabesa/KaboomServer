import { redisClient } from "../db/redis/redis";
import { redisKeys } from "../db/redis/redisKeys";
import { QuizService } from "./quizService";
// import { envServiceClient } from "./envServiceClient";

const formatQuestionForClient = (question: any) => ({
  question: question.question,
  timeLimit: question.timeLimit,
  answers: question.answers,
});

const generatePin = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const getQuestion = async (pin: string, index: number) => {
  const data = await redisClient.hGetAll(redisKeys.question(pin, index));

  if (!data || Object.keys(data).length === 0) {
    throw new Error("Question not found");
  }

  return {
    question: data.question,
    answers: JSON.parse(data.answers),
    timeLimit: Number(data.timeLimit),
  };
};

export const gameService = {
  async createGameSession(quizId: string, hostSocketId: string) {
    // const quiz = await envServiceClient.fetchQuiz(quizId);

    const quiz = await QuizService.getQuizById(quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    const pin = generatePin();

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

    await redisClient.zAdd(redisKeys.leaderboard(pin), {
      score: 0,
      value: socketId,
    });

    return player;
  },

  async startGame(pin: string) {
    await redisClient.hSet(redisKeys.meta(pin), "state", "playing");

    const question = await getQuestion(pin, 0);

    return formatQuestionForClient(question);
  },

  async submitAnswer(pin: string, playerId: string, answerIndex: number) {
    const qIdx = Number(
      await redisClient.hGet(redisKeys.meta(pin), "currentQuestion"),
    );

    const hasAnswered = await redisClient.hExists(
      redisKeys.answers(pin, qIdx),
      playerId,
    );
    if (hasAnswered) return;

    await redisClient.hSet(redisKeys.answers(pin, qIdx), playerId, answerIndex);

    const question = await getQuestion(pin, qIdx);

    await redisClient.hIncrBy(
      redisKeys.answerCounts(pin, qIdx),
      answerIndex.toString(),
      1,
    );

    const correctAnswers = question.answers;
    //   .map((a: any, i: number) => (a.isCorrect ? i : null))
    //   .filter((v: any) => v !== null);

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

  async getAnswerDistribution(pin: string) {
    const qIdx = Number(await redisClient.hGet(redisKeys.meta(pin), "currentQuestion"));

    const counts = await redisClient.hGetAll(redisKeys.answerCounts(pin, qIdx));
    return counts;
  },
};
