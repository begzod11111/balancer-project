

const publishIssueCreated = async (issueData) => {
  const { kafka } = await import('./kafka.js');

  const producer = kafka.producer();

  try {
    await producer.connect();

    const message = {
      issueKey: issueData.issue.key,
      issueId: issueData.issue.id,
      assignmentGroupId: issueData.issue.fields.customfield_18219?.[0]?.id || null,
      assigneeAccountId: issueData.issue.fields.assignee?.accountId || null,
      typeId: issueData.issue.fields.issuetype?.id || null,
      issueStatusId: issueData.issue.fields.status?.name || null,
        status: issueData.issue.fields.status?.id || null,
      webhookEvent: issueData.webhookEvent,
      timestamp: issueData.timestamp
    };

    await producer.send({
      topic: issueData.issue_event_type_name,
      messages: [
        {
          key: issueData.issue.key,
          value: JSON.stringify(message),
          partition: 0
        }
      ]
    });

    console.log('[Kafka Producer] ✅ Сообщение отправлено в топик:', issueData.issue_event_type_name);

    await producer.disconnect();
  } catch (error) {
    console.error('[Kafka Producer] ❌ Ошибка отправки сообщения:', error);
    throw error;
  }
};

export default publishIssueCreated;

