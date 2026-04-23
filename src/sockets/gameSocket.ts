import { Server, Socket } from "socket.io";
import { gameRepository } from "../repositories/gameRepository";
import { gameService } from "../services/gameService";
import { gameEngine } from "../engine/gameEngine";

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
    io.to(`game:${pin}`)
      .except(`user:${hostId}`)
      .emit("game-state", sharedView);
  } else {
    for (const userId of Object.keys(state.players)) {
      // if (userId === hostId) continue;

      const personalView = gameEngine.buildPersonalPlayerView(state, userId);
      io.to(`user:${userId}`).emit("game-state", personalView);
    }
  }

  // Host view
  const hostView = gameEngine.buildHostView(state);
  io.to(`user:${hostId}`).emit("game-state", hostView);
};

const handlers = {
  "create-game-session": async (payload: any, socket: Socket, io: Server) => {
    const userId = socket.data.userId;
    const game = await gameService.createGameSession(payload.quizId, userId);
    socket.join(`game:${game.pin}`);
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
    socket.data.pin = payload.pin;

    const hostId = await gameRepository.getHost(payload.pin);
    io.to(`user:${hostId}`).emit("player-joined", player);
    socket.emit("game-state", { phase: "lobby", data: {} });
  },

  "start-game": hostOnly(async (payload: any, socket: Socket, io: Server) => {
    await gameService.startGame(socket.data.pin);
    await emitGameState(io, socket.data.pin); // phase is "question"
  }),

  "reveal-answers": async (payload: any, socket: Socket, io: Server) => {
    await gameService.revealAnswers(socket.data.pin);
    await emitGameState(io, socket.data.pin); // phase is "answers"
  },

  "submit-answer": async (payload: any, socket: Socket, io: Server) => {
    const userId = socket.data.userId;

    await gameService.submitAnswer(socket.data.pin, userId, payload.answer);
    // socket.emit("answer-received");

    const progress = await gameService.getAnswerProgress(socket.data.pin);
    const hostUserId = await gameService.getHost(socket.data.pin);
    io.to(`user:${hostUserId}`).emit("answer-progress", progress.answered);

    const state = await gameRepository.getFullState(socket.data.pin);
    if (state) {
      const personalView = gameEngine.buildPersonalPlayerView(state, userId);
      io.to(`user:${userId}`).emit("game-state", personalView);
    }

    if (progress.answered === progress.totalPlayers) {
      await gameService.endQuestion(socket.data.pin);
      await emitGameState(io, socket.data.pin); // phase is "results"
    }
  },

  "next-question": hostOnly(
    async (payload: any, socket: Socket, io: Server) => {
      await gameService.nextQuestion(socket.data.pin);
      await emitGameState(io, socket.data.pin);
    },
  ),

  "end-question": hostOnly(async (payload: any, socket: Socket, io: Server) => {
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
