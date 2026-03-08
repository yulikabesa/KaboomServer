// לוגיקה (ניקוד, leaderboard וכו') todo

import { redisClient } from "../db/redis";
import Quiz from "../models/quiz";
export const gameService = {

    async createGameSession(quizId: string, hostId: string) {
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            throw new Error("Quiz not found")
        };

        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        const game = {
            quizId: quiz._id, // the id of the quiz in db
            hostId,
            status: "waiting",
            currentQuestion: -1,
            questions: quiz.questions,
            players: {}
        };
        await redisClient.set(
            `game:${pin}`,
            JSON.stringify(game)
        );
        return { pin };
    },

    async addPlayer(pin: string, nickname: string, socketId: string) {
        const key = `game:${pin}`;
        const game = await redisClient.get(key);
        if (!game) {
            throw new Error("Game not found");
        }
        const parsedGame = JSON.parse(game);
        parsedGame.players[socketId] = {
            nickname,
            score: 0
        };

        await redisClient.set(key, JSON.stringify(parsedGame));

        return {
            id: socketId,
            nickname
        };
    },

    async startGame(pin: string) {
        const game = await redisClient.get(`game:${pin}`);
        if (!game) throw new Error("Game not found");
        const parsedGame = JSON.parse(game);
        parsedGame.status = "playing";
        parsedGame.currentQuestion = 0;
        await redisClient.set(`game:${pin}`, JSON.stringify(parsedGame));
        return parsedGame.currentQuestion;
    },

    async submitAnswer(pin: string, socketId: string, answer: string) {
        const key = `game:${pin}`;
        const game = await redisClient.get(key);
        if (!game) return;
        const parsedGame = JSON.parse(game);
        const currentQuestion =
            parsedGame.questions[parsedGame.currentQuestion];
        const player = parsedGame.players[socketId];
        if (!player) return;
        // answer is the index the player clicked
        if (answer === currentQuestion.correctAnswerIndex) {
            player.score += 100; // to change later based on time it took to answer
        }

        await redisClient.set(key, JSON.stringify(parsedGame))
        return player.score;
    },

    async nextQuestion(pin: string) {
        const key = `game:${pin}`;
        const game = await redisClient.get(key);
        if (!game) throw new Error("Game not found");
        const parsedGame = JSON.parse(game);
        parsedGame.currentQuestion++;
        const question =
            parsedGame.questions[parsedGame.currentQuestion];
        await redisClient.set(key, JSON.stringify(parsedGame));
        return question;
    },

    async isHost(pin: string, socketId: string) {
        const game = await redisClient.get(`game:${pin}`);
        if (!game) return false;
        const parsed = JSON.parse(game);
        return parsed.hostId === socketId;
    }
}