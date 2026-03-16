import { runTaskBufferConsumer } from './issue.consumer.js';


export async function startConsumers() {
  try {
    await Promise.all([
      runTaskBufferConsumer(),
    ]);
  } catch (error) {
    console.error('Ошибка запуска consumers:', error);
    process.exit(1);
  }
}


