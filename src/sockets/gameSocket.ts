// כל אירועי המשחק
// todo
import { Server, Socket } from "socket.io";
import { gameService } from "../services/gameService";

export const gameSocket = (io: Server, socket: Socket) => {

    // host creates game session
    socket.on("create-game-sessiom", async ({ quizId }) => {
        const game = await gameService.createGameSession(
            quizId,
            socket.id
        );
        socket.join(game.pin); // זה יוצר room  
        socket.emit("game-created", {
            pin: game.pin
        });
    });


    // players join
    socket.on("join-game", async ({ pin, nickname }) => {
        const isHost = await gameService.isHost(pin, socket.id);
        if (isHost) return;
        const player = await gameService.addPlayer(
            pin,
            nickname,
            socket.id
        );
        socket.join(pin);
        io.to(pin).emit("player-joined", player);
    });


    // host starts the game 
    socket.on("start-game", async ({ pin }) => {
        const isHost = await gameService.isHost(pin, socket.id);
        if (!isHost) {
            socket.emit("error", "Only host can start the game");
            return;
        }
        const question = await gameService.startGame(pin);
        io.to(pin).emit("game-started", {
            question
        });
    });


    // player answers a question
    socket.on("submit-answer", async ({ pin, answer }) => {
        const isHost = await gameService.isHost(pin, socket.id);
        if (isHost) {
            socket.emit("error", "Host cannot answer");
            return;
        }
        const score = await gameService.submitAnswer(
            pin,
            socket.id,
            answer
        );
        io.to(pin).emit("score-update", {
            playerId: socket.id,
            score
        });
    });


    // host moves on to next question
    socket.on("next-question", async ({ pin }) => {
        const isHost = await gameService.isHost(pin, socket.id)
        if (!isHost) {
            socket.emit("error", "Only host can change question");
            return
        }
        const question = await gameService.nextQuestion(pin);
        io.to(pin).emit("question", {
            question: question.question,
            answers: question.answers,
            timeLimit: question.timeLimit
        });
    });

}