import { Kafka } from 'kafkajs';
import dotenv from "dotenv";

dotenv.config();

export const kafka = new Kafka({
  clientId: 'analytics-service',
  brokers: [process.env.KAFKA_BROKER],
  retry: {
    initialRetryTime: 300,
    retries: 10,
    multiplier: 2,
    maxRetryTime: 30000
  },
  connectionTimeout: 10000,
  requestTimeout: 30000
});
