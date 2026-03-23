import { gameRepository } from "../repositories/gameRepository";
import { gameEngine } from "../engine/gameEngine";
import { QuizService } from "./quizService";

const generatePin = () =>
  Math.floor(1000000 + Math.random() * 9000000).toString();

export const gameService = {
  async createGameSession(quizId: string, userId: string) {
    const quiz = await QuizService.getQuizById(quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    let pin = generatePin();
    while (await gameRepository.getMeta(pin)) {
      pin = generatePin();
    }

    await gameRepository.createMeta(pin, quizId, userId, quiz.questions.length);

    for (let i = 0; i < quiz.questions.length; i++) {
      await gameRepository.saveQuestion(pin, i, quiz.questions[i]);
    }

    return { pin };
  },

  async addPlayer(pin: string, userId: string, nickname: string) {
    await gameRepository.addPlayer(pin, userId, nickname);
    await gameRepository.initLeaderboard(pin, userId);

    return { id: userId, nickname };
  },

  async startGame(pin: string) {
    await gameRepository.setState(pin, "playing");
    await gameRepository.setCurrentQuestion(pin, 0);

    const q = await gameRepository.getQuestion(pin, 0);
    return gameEngine.formatQuestion(q);
  },

  async submitAnswer(pin: string, playerId: string, answer: number) {
    const meta = await gameRepository.getMetaOrThrow(pin);
    const qIdx = Number(meta.currentQuestion);

    const isNew = await gameRepository.submitAnswer(
      pin,
      qIdx,
      playerId,
      answer,
    );

    if (!isNew) return;

    const question = await gameRepository.getQuestionOrThrow(pin, qIdx);
    const score = gameEngine.calculateScore(question.correctIndexes, answer);

    if (score > 0) {
      await gameRepository.incrementScore(pin, playerId, score);
    }

    return score;
  },

  async endQuestion(pin: string) {
    const meta = await gameRepository.getMetaOrThrow(pin);
    const qIdx = Number(meta.currentQuestion);

    const question = await gameRepository.getQuestionOrThrow(pin, qIdx);
    const answers = (await gameRepository.getAnswers(pin, qIdx)) || {};
    const leaderboardRaw = await gameRepository.getLeaderboard(pin);
    const players = (await gameRepository.getPlayers(pin)) || {};

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
    const meta = await gameRepository.getMetaOrThrow(pin);
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
    const meta = await gameRepository.getMetaOrThrow(pin);
    const qIdx = Number(meta.currentQuestion);

    const answered = await gameRepository.getAnswerCount(pin, qIdx);
    const players = (await gameRepository.getPlayers(pin)) || {};
    const totalPlayers = Object.keys(players).length;

    return { answered, totalPlayers };
  },

  async isHost(pin: string, userId: string) {
    const host = await gameRepository.getHost(pin);
    return host === userId;
  },

  async getHost(pin: string) {
    return await gameRepository.getHost(pin);
  },

  async validatePin(pin: string) {
    const meta = await gameRepository.getMeta(pin);
    if (!meta) {
      return { success: false, error: "Invalid pin" };
    } else if (meta.state !== "lobby") {
      return { success: false, error: "Game in progress" };
    } else {
      return { success: true, error: null };
    }
  },

  async reconnect(pin: string, userId: string, socketId: string) {
    const meta = await gameRepository.getMeta(pin);
    if (!meta) return { success: false, error: "Game not found" };

    const player = await gameRepository.getPlayer(pin, userId);
    if (!player) return { success: false, error: "Not in game" };

    await gameRepository.setConnection(pin, userId, socketId);

    // todo: Fetch game state
    const gameState = await gameRepository.getFullState(pin);

    // todo: Format state for this player
    let playerView = gameState;
      // meta.host === userId
      //   ? gameEngine.buildHostView(gameState, userId)
      //   : gameEngine.buildPlayerView(gameState, userId);

    return {
      success: true,
      state: playerView,
    };
  },
};
