// redisClient.js
import Redis from 'ioredis';
import dotenv from 'dotenv';


dotenv.config()


const redis = new Redis({
  host: process.env.REDIS_HOST, // или ваш хост Redis
  port: process.env.REDIS_PORT,        // стандартный порт
  password: process.env.REDIS_PASSWORD,
  username: process.env.REDIS_USERNAME,
});

export const connectRedis = async () => {
  try {
    await redis.ping();
    console.log('Connected to Redis');
  } catch (error) {
    console.error('Error connecting to Redis:', error);
    throw error;
  }
};

export default redis;