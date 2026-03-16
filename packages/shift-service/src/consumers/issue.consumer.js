import { kafka } from '../config/kafka.js';

const TOPICS = {
    ISSUE_CREATED: 'issue_created',
    ISSUE_ASSIGNED: 'issue_assigned',
};

// ['issue_created', 'issue_generic', 'issue_assigned']

const issueConsumer = kafka.consumer({
  groupId: 'tackBuffer-issueConsumer',
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});

export async function runTaskBufferConsumer() {
  const maxRetries = 30;
  let retries = 0;

  // Подключение к Kafka
  while (retries < maxRetries) {
    try {
      console.log(`[Kafka Consumer] Попытка подключения ${retries + 1}/${maxRetries}...`);
      await issueConsumer.connect();
      console.log('[Kafka Consumer] ✅ Успешно подключен к Kafka');
      break;
    } catch (error) {
      retries++;
      console.error(`[Kafka Consumer] ❌ Ошибка подключения (попытка ${retries}):`, error.message);
      if (retries >= maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Подписка на топик (до запуска consumer!)
  try {
      for (const topic of Object.values(TOPICS)) {
          await issueConsumer.subscribe({
              topic,
              fromBeginning: true
          });
          console.log(`[Kafka Consumer] ✅ Успешно подписан на topic "${topic}"`);
      }
    console.log('[Kafka Consumer] ✅ Успешно подписан на topic "issue_created"');
  } catch (error) {
    console.error('[Kafka Consumer] ❌ Ошибка подписки на topic "issue_created":', error);
    throw error;
  }

  // Запуск consumer
  await issueConsumer.run({
    partitionsConsumedConcurrently: 5,
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const value = message.value ? message.value.toString() : null;
        const event = JSON.parse(value);

        console.log('\n[Kafka Consumer] 📨 Получено новое сообщение:');
        if (topic === TOPICS.ISSUE_CREATED) {
            console.log(`[Kafka Consumer] 📌 Topic: ${topic} in taskBuffer`);

        } else if (topic === TOPICS.ISSUE_ASSIGNED) {
            console.log(`[Kafka Consumer] 📌 Topic: ${topic} in taskBuffer`);
        }
        else {
            console.warn(`[Kafka Consumer] ⚠️ Неизвестный topic: ${topic}`);
        }

      } catch (err) {
        console.error('[Kafka Consumer] ❌ Ошибка обработки сообщения:', err);
      }
    }
  });


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

