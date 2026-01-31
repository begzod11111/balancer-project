import { kafka } from '../config/kafka.js';

const issueConsumer = kafka.consumer({
  groupId: 'assigner-issueConsumer',
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});

export async function runAssignerConsumer() {
  const maxRetries = 30;
  let retries = 0;

  // Retry подключения
  while (retries < maxRetries) {
    try {
      await issueConsumer.connect();
      console.log('[Kafka Consumer] ✅ Успешно подключен к Kafka');
      break;
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  retries = 0;
  while (retries < maxRetries) {
    try {

      await issueConsumer.subscribe({
        topic: 'issue.created',
        fromBeginning: true
      });
      break;
    } catch (error) {
      retries++;
      console.error(`[Kafka Consumer] ❌ Ошибка подписки (попытка ${retries}):`, error.message);
      if (retries >= maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  await issueConsumer.run({
    partitionsConsumedConcurrently: 5, // Обработка 5 партиций одновременно
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const key = message.key ? message.key.toString() : null;
        const value = message.value ? message.value.toString() : null;

        console.log('\n[Kafka Consumer] 📨 Получено новое сообщение:');
        console.log(`  Topic: ${topic}`);
        console.log(`  Partition: ${partition}`);
        console.log(`  Key: ${key}`);
        console.log(`  Value: ${value}`);

        const event = JSON.parse(value);
        console.log(`\n[Kafka Consumer] 🎯 Событие: ${event.event || event.webhookEvent}`);
        console.log(`[Kafka Consumer] 📊 Данные:`, JSON.stringify(event, null, 2));
      } catch (err) {
        console.error('[Kafka Consumer] ❌ Ошибка обработки сообщения:', err);
      }
    }
  });

  console.log('\n[Kafka Consumer] 🎧 Consumer запущен и слушает topic "issue.created"\n');

  const shutdown = async () => {
    console.log('\n[Kafka Consumer] 🛑 Получен сигнал завершения...');
    try {
      await issueConsumer.disconnect();
      console.log('[Kafka Consumer] ✅ Consumer отключен');
      process.exit(0);
    } catch (err) {
      console.error('[Kafka Consumer] ❌ Ошибка при отключении:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}


