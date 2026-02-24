import { kafka } from '../config/kafka.js';
import employeeWeightService from "../services/EmployeeWeightService.js";

const shiftConsumer = kafka.consumer({ groupId: 'analytics-shiftConsumer' });

export async function runShiftCreatedConsumer() {
  const maxRetries = 30;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      console.log(`[Kafka Consumer] Попытка подключения ${retries + 1}/${maxRetries}...`);
      await shiftConsumer.connect();
      console.log('[Kafka Consumer] ✅ Успешно подключен к Kafka');
      break;
    } catch (error) {
      retries++;
      console.error(`[Kafka Consumer] ❌ Ошибка подключения (попытка ${retries}):`, error.message);

      if (retries >= maxRetries) {
        console.error('[Kafka Consumer] Превышено максимальное количество попыток подключения');
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  try {
    await shiftConsumer.subscribe({
      topic: 'shift_created',
      fromBeginning: true
    });
    await shiftConsumer.subscribe({
        topic: 'shift_expired',
        fromBeginning: true
    })
    console.log('[Kafka Consumer] ✅ Успешно подписан на topic "shift_created"');
  } catch (error) {
    console.error('[Kafka Consumer] ❌ Ошибка подписки на topic "shift_created":', error);
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

        const event = JSON.parse(value);
        console.log(`\n[Kafka Consumer] 🎯 Событие: ${event.event}`);
        console.log(`[Kafka Consumer] ⏰ Время: ${event.timestamp}`);

        // Обработка события создания смены
        if (event.event === 'shift_created' && event.data) {
            console.log('[Kafka Consumer] ✅ Смена создана, добавляем в Redis', event.data);
          employeeWeightService.createShiftInRedis(event.data).then(
            () => console.log('[Kafka Consumer] ✅ Смена обработана успешно'),
          );
        } else if (event.event === 'shift_expired' && event.data) {
            console.log('[Kafka Consumer] 🔥 Смена истекла, удаляем из Redis', event.data);
        }

        console.log('────────────────────────────────────────\n');
      } catch (err) {
        console.error('[Kafka Consumer] ❌ Ошибка обработки сообщения:', err);
      }
    }
  });

  console.log('\n[Kafka Consumer] 🎧 Consumer запущен и слушает topic "shift_created"\n');

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


