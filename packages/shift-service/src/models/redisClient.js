import Redis from 'ioredis';
import dotenv from "dotenv";

dotenv.config()

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  username: process.env.REDIS_USERNAME,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
  connectTimeout: 10000,
  lazyConnect: true
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

redis.on('connect', () => {
  console.log('✅ Connected to Redis Cloud');
});

// Подключаемся к Redis
redis.connect().catch(err => {
  console.error('Failed to connect to Redis:', err.message);
});

export default redis;
