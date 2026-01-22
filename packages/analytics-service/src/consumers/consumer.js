// javascript
import { kafka } from '../config/kafka.js';

const consumer = kafka.consumer({ groupId: 'analytics-consumer' });

export async function runShiftCreatedConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'shift.created', fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const key = message.key ? message.key.toString() : null;
          const value = message.value ? message.value.toString() : null;
          console.log(`[Kafka Consumer] topic=${topic} partition=${partition} key=${key}`);
          console.log(`[Kafka Consumer] value=${value}`);
        } catch (err) {
          console.error('[Kafka Consumer] Ошибка обработки сообщения:', err);
        }
      }
    });

    // graceful shutdown
    const shutdown = async () => {
      try {
        await consumer.disconnect();
        process.exit(0);
      } catch (err) {
        process.exit(1);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[Kafka Consumer] Ошибка запуска consumer:', error);
    throw error;
  }
}

// Если нужно автозапускать при импорте, раскомментируйте следующую строку:
runShiftCreatedConsumer().catch(err => console.error(err));
