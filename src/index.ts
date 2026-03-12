import express from "express";
import "dotenv/config";
import "./db/mongoose.ts";
import userRouter from "./routers/userRoutes.ts";
import quizRouter from "./routers/quizRoutes.ts";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { initSocket } from "./sockets/socketHandler.ts";
import { connectRedis } from "./db/redis/redis.ts";

const app = express();

// CORS
const corsOptions = {
  origin: "http://localhost:5173",
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use("/user", userRouter);
app.use("/quiz", quizRouter);

const port = process.env.PORT || 3000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
  },
});

// חיבור Redis
connectRedis();

// חיבור הסוקטים
initSocket(io);

// הפעלת השרת
server.listen(port, () => {
  console.log("Server is up on port " + port);
});
