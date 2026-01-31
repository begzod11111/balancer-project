import { runAssignerConsumer } from './issue.consumer.js';
import { runShiftCreatedConsumer } from './shift.consumer.js';

export async function startConsumers() {
  try {
    await Promise.all([
      runAssignerConsumer(),
      runShiftCreatedConsumer()
    ]);
  } catch (error) {
    console.error('Ошибка запуска consumers:', error);
    process.exit(1);
  }
}


