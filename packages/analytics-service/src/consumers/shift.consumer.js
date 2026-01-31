import { kafka } from '../config/kafka.js';

const shiftConsumer = kafka.consumer({ groupId: 'analytics-shiftConsumer' });

export async function runShiftCreatedConsumer() {
  const maxRetries = 30;
  let retries = 0;

  // Retry подключения
  while (retries < maxRetries) {
    try {
      console.log(`[Kafka Consumer] Попытка подключения ${retries + 1}/${maxRetries}...`);
      await shiftConsumer.connect();
      console.log('[Kafka Consumer] ✅ Успешно подключен к Kafka');
      break;
    } catch (error) {
      retries++;
      console.error(`[Kafka Consumer] ❌ Ошибка подключения (п��пытка ${retries}):`, error.message);

      if (retries >= maxRetries) {
        console.error('[Kafka Consumer] Превышено максимальное количество попыток подключения');
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Retry подписки на топик
  retries = 0;
  while (retries < maxRetries) {
    try {
      console.log(`[Kafka Consumer] Попытка подписки на топик ${retries + 1}/${maxRetries}...`);
      await shiftConsumer.subscribe({ topic: 'shift.created', fromBeginning: true });
      console.log('[Kafka Consumer] ✅ Подписка на топик "shift.created" успешна');
      break;
    } catch (error) {
      retries++;
      console.error(`[Kafka Consumer] ❌ Ошибка подписки (попытка ${retries}):`, error.message);

      if (retries >= maxRetries) {
        console.error('[Kafka Consumer] Превышено максимальное количество попыток подписки');
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  await shiftConsumer.run({
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
        console.log(`\n[Kafka Consumer] 🎯 Событие: ${event.event}`);
        console.log(`[Kafka Consumer] ⏰ Время: ${event.timestamp}`);
        console.log(`[Kafka Consumer] 📊 Данные:`, JSON.stringify(event.data, null, 2));
        console.log('────────��────────────────────────────────\n');
      } catch (err) {
        console.error('[Kafka Consumer] ❌ Ошибка обработки сообщения:', err);
      }
    }
  });

  console.log('\n[Kafka Consumer] 🎧 Consumer запущен и слушает topic "shift.created"\n');

  const shutdown = async () => {
    console.log('\n[Kafka Consumer] 🛑 Получен сигнал завершения...');
    try {
      await shiftConsumer.disconnect();
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



