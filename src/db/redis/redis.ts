import { createClient } from "redis";

export const redisClient = createClient({
    url: process.env.REDIS_URL
})

export const connectRedis = async () => {
    try {
        redisClient.on("error", (err) => {
            console.error("Redis error:", err);
        })

        await redisClient.connect();
        console.log("Redis connected");

    } catch (error) {
        console.error("Redis connection failed", error);
    }
}
