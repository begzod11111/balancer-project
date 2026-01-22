import { Kafka } from 'kafkajs';

export const kafka = new Kafka({
  clientId: 'shift-service',
  brokers: [process.env.KAFKA_BROKERS || 'kafka:29092']
});
