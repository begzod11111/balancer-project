import { Kafka } from 'kafkajs';

export const kafka = new Kafka({
  clientId: 'shift-service',
  brokers: [process.env.KAFKA_BROKERS || 'kafka:29092'],
  retry: {
    initialRetryTime: 300,
    retries: 10,
    multiplier: 2,
    maxRetryTime: 30000
  },
  connectionTimeout: 10000,
  requestTimeout: 30000
});
