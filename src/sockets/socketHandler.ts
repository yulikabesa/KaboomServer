// הקובץ הזה מטפל בחיבור של כל משתמש חדש

import { Server, Socket } from "socket.io";
import { gameSocket } from "./gameSocket";

export const initSocket = (io: Server) => {

    io.on("connection", (socket: Socket) => {

        console.log("User connected:", socket.id);

        gameSocket(io, socket);

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
        });
    });
}