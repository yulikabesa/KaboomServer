import { Server, Socket } from "socket.io";
import { gameRepository } from "../repositories/gameRepository";
import { gameService } from "../services/gameService";
import { gameEngine } from "../engine/gameEngine";

const hostOnly =
  (handler: (payload: any, socket: Socket, io: Server) => Promise<void>) =>
  async (payload: any, socket: Socket, io: Server) => {
    const userId = socket.data.userId;
    const isHost = await gameService.isHost(payload.pin, userId);
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
  io.to(`game:${pin}`).emit("game-state", sharedView);

  for (const userId of Object.keys(state.players)) {
    if (userId === hostId) continue;

    const personalView = gameEngine.buildPersonalPlayerView(state, userId);
    io.to(`user:${userId}`).emit("player-state", personalView);
  }

  // Host view
  const hostView = gameEngine.buildHostView(state);
  io.to(`user:${hostId}`).emit("game-state", hostView);
};

const handlers = {
  "create-game-session": async (payload: any, socket: Socket, io: Server) => {
    const userId = socket.data.userId;
    const game = await gameService.createGameSession(payload.quizId, userId);
    // socket.join(`game:${game.pin}`);
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

    const host = await gameRepository.getHost(payload.pin);
    io.to(`user:${host}`).emit("player-joined", player);
  },

  "start-game": hostOnly(async (payload: any, socket: Socket, io: Server) => {
    await gameService.startGame(payload.pin);
    await emitGameState(io, payload.pin); // phase is "question"
  }),

  "submit-answer": async (payload: any, socket: Socket, io: Server) => {
    const userId = socket.data.userId;

    await gameService.submitAnswer(payload.pin, userId, payload.answer);
    socket.emit("answer-received");

    const progress = await gameService.getAnswerProgress(payload.pin);
    const hostUserId = await gameService.getHost(payload.pin);
    io.to(`user:${hostUserId}`).emit("answer-progress", progress.answered);

    if (progress.answered === progress.totalPlayers) {
      await gameService.endQuestion(payload.pin);
      await emitGameState(io, payload.pin); // phase is "results"
    }
  },

  "next-question": hostOnly(
    async (payload: any, socket: Socket, io: Server) => {
      await gameService.nextQuestion(payload.pin);
      await emitGameState(io, payload.pin);
    },
  ),

  "end-question": hostOnly(async (payload: any, socket: Socket, io: Server) => {
    await gameService.endQuestion(payload.pin);
    await emitGameState(io, payload.pin); // phase is "results"
  }),

  "show-leaderboard": hostOnly(async (payload, socket, io) => {
    await gameService.showLeaderboard(payload.pin);
    await emitGameState(io, payload.pin); // phase is "leaderboard"
  }),

  "validate-pin": async (payload: any, socket: Socket) => {
    const data = await gameService.validatePin(payload.pin);
    socket.emit(data.success ? "pin-valid" : "pin-error", data.error);
  },

  // "rejoin-game": async (payload: any, socket: Socket) => {
  //   const userId = socket.data.userId;
  //   const data = await gameService.handleReconnect(payload.pin, userId, socket.id);

  //   if (!data.success) {
  //     socket.emit("rejoin-error", data.error);
  //     return;
  //   }

  //   socket.join(`game:${payload.pin}`);
  //   socket.data.pin = payload.pin;
  //   socket.emit("game-state", data.state);
  // },
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
