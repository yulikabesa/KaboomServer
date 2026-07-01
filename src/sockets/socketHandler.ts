import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { gameSocket } from "./gameSocket";
import { gameService } from "../services/gameService";

function verifyToken(token: string): string {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

  if (!decoded?._id) {
    throw new Error("Invalid token payload");
  }

  return decoded._id;
}
const authMiddleware = (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Missing auth token"));
    }

    const userId = verifyToken(token);
    socket.data.userId = userId;

    next();
  } catch (error) {
    next(new Error("Unauthorized"));
  }
};

const handleJoinGame = async (socket: Socket, userId: string, pin: string) => {
  const { error, role } = await gameService.handleReconnect(
    pin,
    userId,
  );

  if (error) {
    socket.emit("error", error);
    socket.disconnect();
    return;
  }

  socket.data.pin = pin;
  if (role === "player") socket.join(`game:${pin}`);
  socket.join(`user:${userId}:game:${pin}`);

  socket.emit("game-role", { pin, role });
};

function handleDisconnect(io: Server, socket: Socket) {
  const userId: string = socket.data.userId;

  if (!userId) return;

  console.log(`User disconnected: ${userId}`);
}

export const initSocket = (io: Server) => {
  io.use(authMiddleware);

  io.on("connection", async (socket: Socket) => {
    const userId: string = socket.data.userId;
    const pin: string | null = socket.handshake.auth?.pin ?? null;

    console.log(`User connected: ${userId} (${socket.id})`);
    socket.join(`user:${userId}`);

    gameSocket(io, socket);

    if (pin) {
      await handleJoinGame(socket, userId, pin);
    }

    socket.on("disconnect", () => {
      handleDisconnect(io, socket);
    });
  });
};
