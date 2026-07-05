import { gameRepository } from "../repositories/gameRepository";
import { QuizService } from "./quizService";

const generatePin = () =>
  Math.floor(1000000 + Math.random() * 9000000).toString();

export const gameService = {
  async createGameSession(quizId: string, userId: string) {
    const findFreePin = async () => {
      let pin = generatePin();
      while (await gameRepository.getMeta(pin)) {
        pin = generatePin();
      }
      return pin;
    };

    // Fetch quiz from MongoDB and find a free PIN at the same time
    const [quiz, pin] = await Promise.all([
      QuizService.getQuizById(quizId),
      findFreePin(),
    ]);

    if (!quiz) throw new Error("Quiz not found");

    // Save meta + all questions in one pipeline (single round-trip)
    await gameRepository.createSession(pin, quizId, userId, quiz.questions);

    return { pin };
  },

  async addPlayer(pin: string, userId: string, nickname: string) {
    // const MAX_PLAYERS = 75;
    // const players = await gameRepository.getPlayers(pin);
    // const playerCount = players ? Object.keys(players).length : 0;
    // if (playerCount >= MAX_PLAYERS) {
    //   throw new Error("Game is full");
    // }

    await gameRepository.addPlayer(pin, userId, nickname);
    await gameRepository.initLeaderboard(pin, userId);

    return { id: userId, nickname };
  },

  async startGame(pin: string) {
    await gameRepository.setMeta(pin, {
      state: "active",
      currentQuestion: 0,
      phase: "question",
    });
  },

  async revealAnswers(pin: string): Promise<number | null> {
    const meta = await gameRepository.getMetaOrThrow(pin);
    if (meta.phase !== "question") return null;

    const [, question] = await Promise.all([
      gameRepository.setMeta(pin, {
        phase: "answers",
        questionStartedAt: Date.now(),
      }),
      gameRepository.getQuestion(pin, meta.currentQuestion),
    ]);

    return question?.timeLimit ?? null;
  },

  async submitAnswer(pin: string, playerId: string, answer: number[]) {
    const meta = await gameRepository.getMetaOrThrow(pin);
    if (meta.phase !== "answers") return;

    const qIdx = meta.currentQuestion;
    await gameRepository.submitAnswer(pin, qIdx, playerId, answer);
  },

  async endQuestion(pin: string) {
    const meta = await gameRepository.getMetaOrThrow(pin);
    if (meta.phase !== "answers") return;

    const qIdx = meta.currentQuestion;

    await gameRepository.updateScores(pin, qIdx, meta.questionStartedAt ?? 0);
    await gameRepository.updateRanks(pin);
    await gameRepository.setMeta(pin, { phase: "results" });
  },

  async nextQuestion(pin: string) {
    const meta = await gameRepository.getMetaOrThrow(pin);
    const next = meta.currentQuestion + 1;

    await gameRepository.setMeta(pin, {
      currentQuestion: next,
      phase: "question",
    });
  },

  async getAnswerProgress(pin: string) {
    const meta = await gameRepository.getMetaOrThrow(pin);
    const qIdx = meta.currentQuestion;

    const [answered, totalPlayers] = await Promise.all([
      gameRepository.getAnswerCount(pin, qIdx),
      gameRepository.getPlayerCount(pin),
    ]);

    return { answered, totalPlayers };
  },

  async showLeaderboard(pin: string) {
    const meta = await gameRepository.getMetaOrThrow(pin);
    const next = meta.currentQuestion + 1;

    if (next >= meta.questionCount) {
      await gameRepository.setMeta(pin, {
        state: "ended",
        phase: "podium",
      });
    } else {
      await gameRepository.setMeta(pin, {
        phase: "leaderboard",
      });
    }
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
    } else if (meta.state === "ended") {
      return { success: false, error: "Game has ended" };
    } else {
      return { success: true, error: null };
    }
  },

  async handleReconnect(pin: string, userId: string) {
    const meta = await gameRepository.getMeta(pin);
    const player =
      userId === meta?.host
        ? meta.host
        : await gameRepository.getPlayer(pin, userId);

    // only allow if game exists and user is a player
    if (!meta || !player)
      return { success: false, error: "Invalid game access" };

    const role: "host" | "player" = meta.host === userId ? "host" : "player";

    return {
      success: true,
      role,
    };
  },
};
