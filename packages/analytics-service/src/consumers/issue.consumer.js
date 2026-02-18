import { kafka } from '../config/kafka.js';
import IssueService from '../services/issueService.js';
import changelogService from "../services/changelogService.js";

const TOPICS = {
    ISSUE_CREATED: 'issue_created',
    ISSUE_GENERIC: 'issue_generic',
    ISSUE_ASSIGNED: 'issue_assigned'
};

// ['issue_created', 'issue_generic', 'issue_assigned']

const issueConsumer = kafka.consumer({
  groupId: 'assigner-issueConsumer',
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});

export async function runAssignerConsumer() {
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
        console.log(`  Topic: ${topic}`);
        console.log(`  Partition: ${partition}`);
        if (topic === TOPICS.ISSUE_CREATED) {
            await IssueService.createIssue(event)
        } else if (topic === TOPICS.ISSUE_ASSIGNED) {
            await IssueService.updateIssueAssignee(event.issueId, event.assigneeAccountId)
        } else if (topic === TOPICS.ISSUE_GENERIC) {
            await IssueService.updateIssueStatus(event.issueId, event.status, event.issueStatusId)
        } else {
            console.warn(`[Kafka Consumer] ⚠️ Неизвестный topic: ${topic}`);
        }
        changelogService.saveChangelog(
            event.issueId,
            event.issueKey,
            event.assigneeAccountId,
            topic,
            event.user,
            event.changelog
            ).catch(err => {
            console.error('[Kafka Consumer] ❌ Ошибка сохранения changelog:', err);
        })
      } catch (err) {
        console.error('[Kafka Consumer] ❌ Ошибка обработки сообщения:', err);
      }
    }
  });

  console.log('\n[Kafka Consumer] 🎧 Consumer запущен и слушает topic "issue_created"\n');

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

