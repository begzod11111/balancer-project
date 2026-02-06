import { kafka } from '../config/kafka.js';

const producer = kafka.producer();
let isConnected = false;

async function connectProducer() {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
    console.log('[Shift Producer] ✅ Подключен к Kafka');
  }
}

export async function sendShiftCreatedEvent(shiftData) {
  try {
    await connectProducer();

    await producer.send({
      topic: 'shift_created',
      messages: [
        {
          key: shiftData.assigneeEmail,
          value: JSON.stringify({
            event: 'shift_created',
            timestamp: new Date().toISOString(),
            data: shiftData
          })
        }
      ]
    });

    console.log(`[Shift Producer] ✅ Событие shift_created отправлено для ${shiftData.assigneeEmail}`);
  } catch (error) {
    console.error('[Shift Producer] ❌ Ошибка отправки события:', error);
    // Не бросаем ошибку, чтобы не прерывать создание смены
  }
}

export async function disconnectProducer() {
  if (isConnected) {
    await producer.disconnect();
    isConnected = false;
    console.log('[Shift Producer] ❌ Отключен от Kafka');
  }
}
