// הקובץ הזה מטפל בחיבור של כל משתמש חדש

import { Server, Socket } from "socket.io";
import { gameSocket } from "./gameSocket";
import jwt from "jsonwebtoken";
import { gameRepository } from "../repositories/gameRepository";

function verifyToken(token: string): string {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return decoded.userId;
}

export const initSocket = (io: Server) => {

    // MIDDLEWARE 
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error("Unauthorized"));
        }

        try {
            const userId = verifyToken(token); // implement this
            socket.data.userId = userId;       // ✅ attach identity
            next();
        } catch (err) {
            next(new Error("Unauthorized"));
        }
    });

    // connection handler
    io.on("connection", async (socket: Socket) => {
        console.log("User connected:", socket.id);
        const userId = socket.data.userId;
        console.log("UserId:", userId);

        // AUTO REJOIN ROOM
        try {
            const game = await gameRepository.getGameByUserId(userId);

            if (game) {
                socket.join(game.pin);

                await gameRepository.setConnection(game.pin, userId, socket.id);

                console.log(`${userId} auto-rejoined game ${game.pin}`);
            }
        } catch (err) {
            console.error("Auto rejoin failed:", err);
        }

        gameSocket(io, socket);

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
        });
    });
};