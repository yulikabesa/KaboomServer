import { gameRepository } from "../repositories/gameRepository";
import { gameEngine } from "../engine/gameEngine";
import { QuizService } from "./quizService";

const generatePin = () =>
  Math.floor(1000000 + Math.random() * 9000000).toString();

export const gameService = {
  async createGameSession(quizId: string, hostSocketId: string) {
    const quiz = await QuizService.getQuizById(quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    let pin = generatePin();
    while (await gameRepository.getMeta(pin)) {
      pin = generatePin();
    }

    await gameRepository.createMeta(
      pin,
      quizId,
      hostSocketId,
      quiz.questions.length,
    );

    for (let i = 0; i < quiz.questions.length; i++) {
      await gameRepository.saveQuestion(pin, i, quiz.questions[i]);
    }

    return { pin };
  },

  async addPlayer(pin: string, socketId: string, nickname: string) {
    await gameRepository.addPlayer(pin, socketId, nickname);
    await gameRepository.initLeaderboard(pin, socketId);

    return { id: socketId, nickname };
  },

  async startGame(pin: string) {
    await gameRepository.setState(pin, "playing");
    await gameRepository.setCurrentQuestion(pin, 0);

    const q = await gameRepository.getQuestion(pin, 0);
    return gameEngine.formatQuestion(q);
  },

  async submitAnswer(pin: string, playerId: string, answer: number) {
    const meta = await gameRepository.getMeta(pin);
    const qIdx = Number(meta.currentQuestion);

    const isNew = await gameRepository.submitAnswer(
      pin,
      qIdx,
      playerId,
      answer,
    );

    if (!isNew) return;

    const question = await gameRepository.getQuestion(pin, qIdx);

    const score = gameEngine.calculateScore(question.correctIndexes, answer);

    if (score > 0) {
      await gameRepository.incrementScore(pin, playerId, score);
    }

    return score;
  },

  async endQuestion(pin: string) {
    const meta = await gameRepository.getMeta(pin);
    const qIdx = Number(meta.currentQuestion);

    const question = await gameRepository.getQuestion(pin, qIdx);
    const answers = await gameRepository.getAnswers(pin, qIdx);
    const leaderboardRaw = await gameRepository.getLeaderboard(pin);
    const players = await gameRepository.getPlayers(pin);

    return {
      correctAnswers: question.correctIndexes,
      distribution: gameEngine.buildDistribution(
        answers,
        question.answers.length,
      ),
      leaderboard: leaderboardRaw.map((p) => ({
        playerId: p.value,
        nickname: players[p.value],
        score: p.score,
      })),
    };
  },

  async nextQuestion(pin: string) {
    const meta = await gameRepository.getMeta(pin);

    const next = Number(meta.currentQuestion) + 1;

    if (next >= Number(meta.questionCount)) {
      await gameRepository.setState(pin, "finished");
      return null;
    }

    await gameRepository.setCurrentQuestion(pin, next);

    const q = await gameRepository.getQuestion(pin, next);
    return gameEngine.formatQuestion(q);
  },

  async getAnswerProgress(pin: string) {
    const meta = await gameRepository.getMeta(pin);
    const qIdx = Number(meta.currentQuestion);

    const answered = await gameRepository.getAnswerCount(pin, qIdx);
    const totalPlayers = Object.keys(
      await gameRepository.getPlayers(pin),
    ).length;

    return { answered, totalPlayers };
  },

  async isHost(pin: string, socketId: string) {
    const host = await gameRepository.getHost(pin);
    return host === socketId;
  },

  async getHost(pin: string) {
    return await gameRepository.getHost(pin);
  },
};
