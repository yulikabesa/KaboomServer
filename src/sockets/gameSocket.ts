import { Server, Socket } from "socket.io";
import { gameService } from "../services/gameService";
import { gameRepository } from "../repositories/gameRepository";

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

const handlers = {
  "create-game-session": async (payload: any, socket: Socket, io: Server) => {
    const userId = socket.data.userId;
    const game = await gameService.createGameSession(payload.quizId, userId);
    socket.join(game.pin);

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

    // ✅ map user → socket
    await gameRepository.setConnection(payload.pin, userId, socket.id);

    socket.join(payload.pin);
    io.to(payload.pin).emit("player-joined", player);
  },

  "start-game": hostOnly(async (payload: any, socket: Socket, io: Server) => {
    const question = await gameService.startGame(payload.pin);
    io.to(payload.pin).emit("game-started", { question });
  }),

  "submit-answer": async (payload: any, socket: Socket, io: Server) => {
    const userId = socket.data.userId;
    const score = await gameService.submitAnswer(
      payload.pin,
      userId,
      payload.answer,
    );
    socket.emit("answer-received");

    const progress = await gameService.getAnswerProgress(payload.pin);
    const hostUserId = await gameService.getHost(payload.pin);
    const hostSocketId = await gameRepository.getConnection(payload.pin, hostUserId!);

    if (hostSocketId) {
      io.to(hostSocketId).emit("answer-progress", progress.answered);
    }

    if (progress.answered === progress.totalPlayers) {
      const results = await gameService.endQuestion(payload.pin);
      io.to(payload.pin).emit("question-results", results);
    }
  },

  "next-question": hostOnly(
    async (payload: any, socket: Socket, io: Server) => {
      const question = await gameService.nextQuestion(payload.pin);

      if (!question) {
        const results = await gameService.endQuestion(payload.pin);
        io.to(payload.pin).emit("game-finished", results);
        return;
      }

      io.to(payload.pin).emit("question", question);
    },
  ),

  "end-question": hostOnly(async (payload: any, socket: Socket, io: Server) => {
    const results = await gameService.endQuestion(payload.pin);
    io.to(payload.pin).emit("question-results", results);
  }),

  "validate-pin": async (payload: any, socket: Socket) => {
    const meta = await gameRepository.getMeta(payload.pin);
    if (!meta) {
      socket.emit("pin-error", "Invalid pin");
    } else if (meta.state !== "lobby") {
      socket.emit("pin-error", "Game in progress");
    } else {
      socket.emit("pin-valid");
    }
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