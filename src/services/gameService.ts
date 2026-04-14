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
    await gameRepository.setMeta(pin, {
      state: "playing",
      currentQuestion: 0,
      phase: "question",
    });
  },

  async revealAnswers(pin: string) {
    const meta = await gameRepository.getMetaOrThrow(pin);
    if (meta.phase !== "question") return;

    await gameRepository.setMeta(pin, {
      phase: "answers",
    });
  },

  async submitAnswer(pin: string, playerId: string, answer: number[]) {
    const meta = await gameRepository.getMetaOrThrow(pin);
    if (meta.phase !== "answers") return;

    const qIdx = meta.currentQuestion;

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
  },

  async endQuestion(pin: string) {
    const meta = await gameRepository.getMetaOrThrow(pin);
    if (meta.phase !== "answers") return;

    // const qIdx = meta.currentQuestion;

    // const question = await gameRepository.getQuestionOrThrow(pin, qIdx);
    // const answers = (await gameRepository.getAnswers(pin, qIdx)) || {};

    await gameRepository.setMeta(pin, { phase: "results" });
  },

  async nextQuestion(pin: string) {
    const meta = await gameRepository.getMetaOrThrow(pin);

    const next = meta.currentQuestion + 1;

    if (next >= meta.questionCount) {
      await gameRepository.setMeta(pin, {
        state: "finished",
        phase: "leaderboard",
      });
      return null;
    }

    await gameRepository.setMeta(pin, {
      currentQuestion: next,
      phase: "question",
    });
  },

  async getAnswerProgress(pin: string) {
    const meta = await gameRepository.getMetaOrThrow(pin);
    const qIdx = meta.currentQuestion;

    const answered = await gameRepository.getAnswerCount(pin, qIdx);
    const players = (await gameRepository.getPlayers(pin)) || {};
    const totalPlayers = Object.keys(players).length;

    return { answered, totalPlayers };
  },

  async showLeaderboard(pin: string) {
    await gameRepository.setMeta(pin, {
      phase: "leaderboard",
    });
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
    } else if (meta.state === "finished") {
      return { success: false, error: "Game has ended" };
    } else {
      return { success: true, error: null };
    }
  },

  async handleReconnect(pin: string, userId: string) {
    const meta = await gameRepository.getMeta(pin);
    // todo: fix to a nice solution
    const player =
      userId === meta?.host
        ? meta.host
        : await gameRepository.getPlayer(pin, userId);
    if (!meta || !player)
      return { success: false, error: "Invalid game access" };

    const gameState = await gameRepository.getFullState(pin);
    if (!gameState) {
      return { success: false, error: "Failed to find game" };
    }

    // format full state for this player
    const gameView =
      meta.host === userId
        ? gameEngine.buildHostView(gameState)
        : gameEngine.buildSharedPlayerView(gameState);

    const playerView =
      meta.host === userId
        ? null
        : gameEngine.buildPersonalPlayerView(gameState, userId);

    return {
      success: true,
      gameState: gameView,
      playerState: playerView,
    };
  },
};
