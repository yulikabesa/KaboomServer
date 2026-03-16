// כל אירועי המשחק
// todo
import { Server, Socket } from "socket.io";
import { gameService } from "../services/gameService";

export const gameSocket = (io: Server, socket: Socket) => {
  // host creates game session
  socket.on("create-game-session", async ({ quizId }) => {
    try {
      const game = await gameService.createGameSession(quizId, socket.id);

      socket.join(game.pin); // זה יוצר room
      socket.emit("game-created", {
        pin: game.pin,
      });
    } catch (error) {
      socket.emit("error", "Failed to create game session");
    }
  });

  // players join
  socket.on("join-game", async ({ pin, nickname }) => {
    try {
      const isHost = await gameService.isHost(pin, socket.id);
      if (isHost) return;

      const player = await gameService.addPlayer(pin, nickname, socket.id);
      socket.join(pin);
      io.to(pin).emit("player-joined", player);
    } catch (error) {
      socket.emit("error", "Failed to join game");
    }
  });

  // host starts the game
  socket.on("start-game", async ({ pin }) => {
    try {
      const isHost = await gameService.isHost(pin, socket.id);
      if (!isHost) {
        socket.emit("error", "Only host can start the game");
        return;
      }

      const question = await gameService.startGame(pin);
      io.to(pin).emit("game-started", {
        question,
      });
    } catch (error) {
      socket.emit("error", "Failed to start game");
    }
  });

  // player answers a question
  socket.on("submit-answer", async ({ pin, answer }) => {
    try {
      const isHost = await gameService.isHost(pin, socket.id);
      if (isHost) {
        socket.emit("error", "Host cannot answer");
        return;
      }

      //   const score = await gameService.submitAnswer(pin, socket.id, answer);

      //   io.to(pin).emit("score-update", {
      //     playerId: socket.id,
      //     score,
      //   });

      await gameService.submitAnswer(pin, socket.id, answer);
      socket.emit("answer-received");

      const progress = await gameService.getAnswerProgress(pin);
      io.to(pin).emit("answer-progress", progress);
    } catch (error) {
      socket.emit("error", "Failed to submit answer");
    }
  });

  // host moves on to next question
  socket.on("next-question", async ({ pin }) => {
    try {
      const isHost = await gameService.isHost(pin, socket.id);
      if (!isHost) {
        socket.emit("error", "Only host can change question");
        return;
      }

      const question = await gameService.nextQuestion(pin);

      if (!question) {
        const leaderboard = await gameService.getLeaderboard(pin);

        io.to(pin).emit("game-finished", {
          leaderboard,
        });

        return;
      }

      io.to(pin).emit("question", question);
    } catch (error) {
      socket.emit("error", "Failed to load next question");
    }
  });

  socket.on("end-question", async ({ pin }) => {
    try {
      const isHost = await gameService.isHost(pin, socket.id);
      if (!isHost) {
        socket.emit("error", "Only host can end question");
        return;
      }

      const results = await gameService.endQuestion(pin);

      io.to(pin).emit("question-results", results);
    } catch (error) {
      socket.emit("error", "Failed to end question");
    }
  });
};
