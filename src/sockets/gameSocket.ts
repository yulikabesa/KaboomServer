import { Server, Socket } from "socket.io";
import { gameRepository } from "../repositories/gameRepository";
import { gameService } from "../services/gameService";
import { gameEngine } from "../engine/gameEngine";
import { questionTimer } from "../timers/questionTimer";
import { GameFullState, GamePersonalState } from "../types/game";

// todo: decide -> payload.pin / socket.data.pin
const hostOnly =
  (handler: (payload: any, socket: Socket, io: Server) => Promise<void>) =>
  async (payload: any, socket: Socket, io: Server) => {
    const userId = socket.data.userId;
    const isHost = await gameService.isHost(socket.data.pin, userId);
    if (!isHost) {
      socket.emit("error", "Only host can perform this action");
      return;
    }
    await handler(payload, socket, io);
  };

export const emitGameState = async (io: Server, pin: string) => {
  const state = await gameRepository.getFullState(pin);
  if (!state) return;

  const hostId = state.meta.host;

  const sharedView = gameEngine.buildSharedPlayerView(state);
  if (sharedView.data) {
    io.to(`game:${pin}`).emit("game-state", sharedView);
  } else {
    for (const userId of Object.keys(state.players)) {
      const personalState = await gameRepository.getPersonalState(pin, userId);
      if (!personalState) return;

      const personalView = gameEngine.buildPersonalPlayerView(
        personalState,
        userId,
      );
      io.to(`user:${userId}:game:${pin}`).emit("game-state", personalView);
    }
  }

  // Host view
  const hostView = gameEngine.buildHostView(state);
  io.to(`user:${hostId}:game:${pin}`).emit("game-state", hostView);
};

const handlers = {
  "create-game-session": async (payload: any, socket: Socket, io: Server) => {
    const userId = socket.data.userId;
    const game = await gameService.createGameSession(payload.quizId, userId);
    socket.join(`game:${game.pin}`);
    socket.join(`user:${userId}:game:${game.pin}`);
    socket.data.pin = game.pin;

    // save connection
    socket.emit("game-created", { pin: game.pin });
  },

  "join-game": async (payload: any, socket: Socket, io: Server) => {
    const userId = socket.data.userId;
    const player = await gameService.addPlayer(
      payload.pin,
      userId,
      payload.nickname,
    );

    socket.join(`game:${payload.pin}`);
    socket.join(`user:${userId}:game:${payload.pin}`);
    socket.data.pin = payload.pin;

    const hostId = await gameRepository.getHost(payload.pin);
    io.to(`user:${hostId}:game:${payload.pin}`).emit("player-joined", player);

    // todo: change game state emission and decide if joining game should always be allowed
    const state = await gameRepository.getPersonalState(
      socket.data.pin,
      userId,
    );
    if (state) {
      const personalView = gameEngine.buildPersonalPlayerView(state, userId);
      io.to(`user:${userId}:game:${socket.data.pin}`).emit(
        "game-state",
        personalView,
      );
    }
  },

  "start-game": hostOnly(async (payload: any, socket: Socket, io: Server) => {
    await gameService.startGame(socket.data.pin);
    io.to(`user:${socket.data.userId}:game:${socket.data.pin}`).emit(
      "game-started",
    );
    await emitGameState(io, socket.data.pin); // phase is "question"
  }),

  "get-game-state": async (payload: any, socket: Socket) => {
    const pin = socket.data.pin;
    const userId = socket.data.userId;
    const isHost = userId === (await gameRepository.getHost(pin));
    const state = isHost
      ? await gameRepository.getFullState(pin)
      : await gameRepository.getPersonalState(pin, userId);
    if (!state) return;

    if (isHost) {
      socket.emit(
        "game-state",
        gameEngine.buildHostView(state as GameFullState),
      );
    } else {
      socket.emit(
        "game-state",
        gameEngine.buildPersonalPlayerView(state as GamePersonalState, userId),
      );
    }
  },

  "reveal-answers": async (payload: any, socket: Socket, io: Server) => {
    const pin = socket.data.pin;
    const timeLimit = await gameService.revealAnswers(pin);

    if (timeLimit !== null) {
      questionTimer.set(pin, timeLimit * 1000, async () => {
        try {
          await gameService.endQuestion(pin);
          await emitGameState(io, pin);
        } catch {
          // question was already ended manually
        }
      });
    }

    await emitGameState(io, pin); // phase is "answers"
  },

  "submit-answer": async (payload: any, socket: Socket, io: Server) => {
    const userId = socket.data.userId;
    const pin = socket.data.pin;

    await gameService.submitAnswer(pin, userId, payload.answer);

    const [progress, hostUserId] = await Promise.all([
      gameService.getAnswerProgress(pin),
      gameService.getHost(pin),
    ]);
    io.to(`user:${hostUserId}:game:${pin}`).emit(
      "answer-progress",
      progress.answered,
    );

    const allAnswered = progress.answered === progress.totalPlayers;

    if (allAnswered) {
      questionTimer.clear(pin); // all players answered, server timer no longer needed
      await gameService.endQuestion(pin);
      await emitGameState(io, pin);
    } else {
      const state = await gameRepository.getPersonalState(pin, userId);
      if (state) {
        const personalView = gameEngine.buildPersonalPlayerView(state, userId);
        io.to(`user:${userId}:game:${pin}`).emit("game-state", personalView);
      }
    }
  },

  "next-question": hostOnly(
    async (payload: any, socket: Socket, io: Server) => {
      await gameService.nextQuestion(socket.data.pin);
      await emitGameState(io, socket.data.pin);
    },
  ),

  "end-question": hostOnly(async (payload: any, socket: Socket, io: Server) => {
    questionTimer.clear(socket.data.pin); // cancel server timer if host ends early
    await gameService.endQuestion(socket.data.pin);
    await emitGameState(io, socket.data.pin); // phase is "results"
  }),

  "show-leaderboard": hostOnly(async (payload, socket, io) => {
    await gameService.showLeaderboard(socket.data.pin);
    await emitGameState(io, socket.data.pin); // phase is "leaderboard"
  }),

  "validate-pin": async (payload: any, socket: Socket) => {
    const data = await gameService.validatePin(payload.pin);
    socket.emit(data.success ? "pin-valid" : "pin-error", data.error);
  },

  "check-game-role": async (payload: any, socket: Socket) => {
    const userId = socket.data.userId;
    const pin = payload?.pin;
    if (!pin) return;

    const meta = await gameRepository.getMeta(pin);
    if (!meta) {
      socket.emit("game-role", { pin, role: null });
      return;
    }
    if (meta.host === userId) {
      socket.emit("game-role", { pin, role: "host" });
      return;
    }
    const player = await gameRepository.getPlayer(pin, userId);
    socket.emit("game-role", { pin, role: player ? "player" : null });
  },
};

type HandlerKeys = keyof typeof handlers;

export const gameSocket = (io: Server, socket: Socket) => {
  socket.on("game-event", async ({ type, payload }) => {
    try {
      const handler = handlers[type as HandlerKeys];
      if (!handler) {
        socket.emit("error", `Unknown event type: ${type}`);
        return;
      }
      await handler(payload, socket, io);
    } catch (err: any) {
      socket.emit("error", err.message || "An error occurred");
    }
  });
};
