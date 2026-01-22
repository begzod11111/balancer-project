import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'shift-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

export { kafka };
