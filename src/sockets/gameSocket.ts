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

const emitGameState = async (io: Server, pin: string) => {
  const state = await gameRepository.getFullState(pin);
  if (!state) return;

  const connections = (await gameRepository.getConnections(pin)) || {};

  for (const [userId, socketId] of Object.entries(connections)) {
    if (!socketId) continue;

    const view =
      userId === state.meta.host
        ? gameEngine.buildHostView(state)
        : gameEngine.buildPlayerView(state, userId);

    io.to(socketId).emit("game-state", view);
  }
};

const handlers = {
  "create-game-session": async (payload: any, socket: Socket, io: Server) => {
    const userId = socket.data.userId;
    const game = await gameService.createGameSession(payload.quizId, userId);
    socket.join(game.pin);
    socket.data.pin = game.pin;

    // save connection
    await gameRepository.setConnection(game.pin, userId, socket.id);
    socket.emit("game-created", { pin: game.pin });
  },

  "join-game": async (payload: any, socket: Socket, io: Server) => {
    const userId = socket.data.userId;
    const player = await gameService.addPlayer(
      payload.pin,
      userId,
      payload.nickname,
    );

    // map user → socket
    await gameRepository.setConnection(payload.pin, userId, socket.id);

    socket.join(payload.pin);
    socket.data.pin = payload.pin;
    io.to(payload.pin).emit("player-joined", player);
  },

  "start-game": hostOnly(async (payload: any, socket: Socket, io: Server) => {
    // const question = await gameService.startGame(payload.pin);
    // io.to(payload.pin).emit("game-state", {
    //   phase: "question",
    //   data: question,
    // });

    // todo: fix startGame -> void
    await gameService.startGame(payload.pin);
    await emitGameState(io, payload.pin); // phase is "question"
  }),

  "submit-answer": async (payload: any, socket: Socket, io: Server) => {
    const userId = socket.data.userId;

    // todo: fix submitAnswer -> void
    await gameService.submitAnswer(payload.pin, userId, payload.answer);
    socket.emit("answer-received");

    const progress = await gameService.getAnswerProgress(payload.pin);
    const hostUserId = await gameService.getHost(payload.pin);
    const hostSocketId = await gameRepository.getConnection(
      payload.pin,
      hostUserId!,
    );

    if (hostSocketId) {
      io.to(hostSocketId).emit("answer-progress", progress.answered);
    }

    if (progress.answered === progress.totalPlayers) {
      // const results = await gameService.endQuestion(payload.pin);
      // io.to(payload.pin).emit("game-state", {
      //   phase: "results",
      //   data: results,
      // });

      // todo: fix endQuestion -> void
      await gameService.endQuestion(payload.pin);
      await emitGameState(io, payload.pin); // phase is "results"
    }
  },

  "next-question": hostOnly(
    async (payload: any, socket: Socket, io: Server) => {
      // const question = await gameService.nextQuestion(payload.pin);

      // if (!question) {
      //   const leaderboard = await gameService.showLeaderboard(payload.pin);
      //   io.to(payload.pin).emit("game-state", {
      //     phase: "leaderboard",
      //     data: leaderboard,
      //   });
      //   return;
      // }

      // io.to(payload.pin).emit("game-state", {
      //   phase: "question",
      //   data: question,
      // });

      // todo: fix nextQuestion -> void
      await gameService.nextQuestion(payload.pin);
      await emitGameState(io, payload.pin);
    },
  ),

  "end-question": hostOnly(async (payload: any, socket: Socket, io: Server) => {
    // const results = await gameService.endQuestion(payload.pin);
    // io.to(payload.pin).emit("game-state", {
    //   phase: "results",
    //   data: results,
    // });

    await gameService.endQuestion(payload.pin);
    await emitGameState(io, payload.pin); // phase is "results"
  }),

  "show-leaderboard": hostOnly(async (payload, socket, io) => {
    // const leaderboard = await gameService.showLeaderboard(payload.pin);

    // io.to(payload.pin).emit("game-state", {
    //   phase: "leaderboard",
    //   data: leaderboard,
    // });

    // todo: fix showLeaderboard -> void
    await gameService.showLeaderboard(payload.pin);
    await emitGameState(io, payload.pin); // phase is "leaderboard"
  }),

  "validate-pin": async (payload: any, socket: Socket) => {
    const data = await gameService.validatePin(payload.pin);
    socket.emit(data.success ? "pin-valid" : "pin-error", data.error);
  },

  "rejoin-game": async (payload: any, socket: Socket) => {
    const userId = socket.data.userId;
    const data = await gameService.reconnect(payload.pin, userId, socket.id);

    if (!data.success) {
      socket.emit("rejoin-error", data.error);
      return;
    }

    socket.join(payload.pin);
    socket.data.pin = payload.pin;
    socket.emit("game-state", data.state);
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

// later in order to send if player was right or wrong to the specific player
// will need to do:
// const socketId = await gameRepository.getConnection(pin, userId);
// io.to(socketId!).emit("answer-result", { correct: true });
