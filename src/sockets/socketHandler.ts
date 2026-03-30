import { Server, Socket } from "socket.io";
import { gameSocket } from "./gameSocket";
import { gameRepository } from "../repositories/gameRepository";
import jwt from "jsonwebtoken";

function verifyToken(token: string): string {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
  return decoded._id;
}

export const initSocket = (io: Server) => {
  // MIDDLEWARE
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));

      const userId = verifyToken(token);
      socket.data.userId = userId;
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  // connection handler
  io.on("connection", async (socket: Socket) => {
    const userId = socket.data.userId;

    // If client sent pin in auth (reconnecting), store it
    // const authPin = socket.handshake.auth?.pin ?? null;
    // if (authPin) socket.data.pin = authPin;

    console.log(`User connected: ${userId} (socket: ${socket.id})`);

    // AUTO REJOIN
    // try {
    //   const pin = await gameRepository.getUserGame(userId);

    //   if (pin) {
    //     socket.join(pin);
    //     await gameRepository.setConnection(pin, userId, socket.id);
    //     console.log(`${userId} auto-rejoined game ${pin}`);
    //   }
    // } catch (err) {
    //   console.error("Auto rejoin failed:", err);
    // }

    gameSocket(io, socket);

    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${userId} (socket: ${socket.id})`);
      const pin = socket.data.pin;
      if (pin) {
        await gameRepository.removeConnection(pin, userId);
      }
    });
  });
};
