import { models } from '../models/db.js';

const { ChangelogEvent } = models;

class ChangelogService {
  /**
   * Сохранение новых логов изменений
   */
  async saveChangelog(issueId, issueKey, departmentId, eventType, user, changelogItem) {
  try {
    if (!changelogItem?.items?.length) {
      console.log(`[Changelog] ℹ️ Нет изменений для ${issueKey}`);
      return null;
    }

    console.log(`[Changelog] 📝 Обработка события "${eventType}" для ${issueKey}`);

    // Для issue_created сохраняем одно агрегированное событие
    if (eventType === 'issue_created') {
      const aggregatedEvent = {
        historyId: changelogItem.id,
        issueId,
        issueKey,
        departmentId,
        eventType,
        authorAccountId: user.accountId,
        authorDisplayName: user.displayName,
        authorEmail: user.emailAddress || null,
        authorActive: user.active !== false,
        authorTimeZone: user.timeZone,
        created: new Date(),
        field: 'issue_created_aggregate',
        fieldtype: 'aggregate',
        fieldId: 'issue_created',
        from: null,
        fromString: null,
        to: JSON.stringify(changelogItem.items.reduce((acc, item) => {
          acc[item.field] = {
            to: item.to,
            toString: item.toString,
            fieldtype: item.fieldtype
          };
          return acc;
        }, {})),
        toString: `Created with ${changelogItem.items.length} initial fields`,
        fromAccountId: null,
        toAccountId: null
      };

      try {
        await ChangelogEvent.create(aggregatedEvent);
        console.log(`[Changelog] ✅ Сохранено агрегированное событие создания для ${issueKey}`);
        return { added: 1, total: 1 };
      } catch (error) {
        if (error.code !== 11000) throw error;
        console.log(`[Changelog] ℹ️ Событие создания уже существует`);
        return { added: 0 };
      }
    }

    // Для остальных событий сохраняем отдельные записи
    const events = changelogItem.items.map(item => ({
      historyId: `${changelogItem.id}_${item.field}`,
      issueId,
      issueKey,
      departmentId,
      eventType,
      authorAccountId: user.accountId,
      authorDisplayName: user.displayName,
      authorEmail: user.emailAddress || null,
      authorActive: user.active !== false,
      authorTimeZone: user.timeZone,
      created: new Date(),
      field: item.field,
      fieldtype: item.fieldtype,
      fieldId: item.fieldId,
      from: item.from,
      fromString: item.fromString,
      to: item.to,
      toString: item.toString,
      fromAccountId: item.tmpFromAccountId || null,
      toAccountId: item.tmpToAccountId || null
    }));

    await ChangelogEvent.insertMany(events, { ordered: false });

    console.log(`[Changelog] ✅ Сохранено ${events.length} событий для ${issueKey}`);
    return { added: events.length, total: events.length };
  } catch (error) {
    if (error.code !== 11000) {
      console.error('[Changelog] ❌ Ошибка:', error);
      throw error;
    }
    console.log(`[Changelog] ℹ️ Некоторые события уже существуют`);
    return { added: 0 };
  }
}

  /**
   * Пакетное сохранение логов
   */
  async saveBulkChangelogs(issueId, issueKey, departmentId, histories) {
    try {
      if (!histories?.length) return null;

      let totalAdded = 0;

      for (const history of histories) {
        const result = await this.saveChangelog(
          issueId,
          issueKey,
          departmentId,
          history.eventType || 'unknown',
          history.author,
          { id: history.id, items: history.items }
        );

        if (result) totalAdded += result.added;
      }

      return { added: totalAdded, total: totalAdded };
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка пакетного сохранения:', error);
      throw error;
    }
  }

  /**
   * Получение истории изменений задачи
   */
  async getChangelog(issueId) {
    try {
      const events = await ChangelogEvent.find({ issueId })
        .sort({ created: 1 })
        .lean();

      return events;
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка получения changelog:', error);
      throw error;
    }
  }

  /**
   * Получение истории назначений
   */
  async getAssignmentHistory(issueId) {
    try {
      const events = await ChangelogEvent.find({
        issueId,
        field: 'assignee'
      })
        .sort({ created: 1 })
        .lean();

      return events.map(e => ({
        date: e.created,
        eventType: e.eventType,
        author: e.authorDisplayName,
        authorAccountId: e.authorAccountId,
        from: e.fromString,
        to: e.toString,
        fromAccountId: e.fromAccountId,
        toAccountId: e.toAccountId
      }));
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка получения истории назначений:', error);
      throw error;
    }
  }

  /**
   * Получение истории изменений статусов
   */
  async getStatusHistory(issueId) {
    try {
      const events = await ChangelogEvent.find({
        issueId,
        field: 'status'
      })
        .sort({ created: 1 })
        .lean();

      return events.map(e => ({
        date: e.created,
        author: e.authorDisplayName,
        from: e.fromString,
        to: e.toString,
        fromId: e.from,
        toId: e.to
      }));
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка получения истории статусов:', error);
      throw error;
    }
  }

  /**
   * Статистика по сотруднику
   */
  async getEmployeeStats(accountId, startDate, endDate) {
    try {
      const result = await ChangelogEvent.aggregate([
        {
          $match: {
            authorAccountId: accountId,
            created: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: '$field',
            count: { $sum: 1 },
            lastChange: { $max: '$created' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      return result;
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка получения статистики:', error);
      throw error;
    }
  }

  /**
   * Получение активности по департаменту
   */
  async getDepartmentActivity(departmentId, startDate, endDate) {
    try {
      const result = await ChangelogEvent.aggregate([
        {
          $match: {
            departmentId: departmentId,
            created: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$created' } },
              author: '$authorAccountId'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            totalChanges: { $sum: '$count' },
            uniqueAuthors: { $addToSet: '$_id.author' }
          }
        },
        {
          $project: {
            _id: 0,
            date: '$_id',
            totalChanges: 1,
            uniqueAuthorsCount: { $size: '$uniqueAuthors' }
          }
        },
        { $sort: { date: 1 } }
      ]);

      return result;
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка получения активности департамента:', error);
      throw error;
    }
  }

  /**
   * Получение истории по типу события
   */
  async getHistoryByEventType(issueId, eventType) {
    try {
      const events = await ChangelogEvent.find({
        issueId,
        eventType
      })
        .sort({ created: 1 })
        .lean();

      return events;
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка получения истории по типу события:', error);
      throw error;
    }
  }

  /**
   * Статистика по типам событий
   */
  async getEventTypeStats(startDate, endDate) {
    try {
      const result = await ChangelogEvent.aggregate([
        {
          $match: {
            created: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 },
            uniqueIssues: { $addToSet: '$issueKey' }
          }
        },
        {
          $project: {
            _id: 0,
            eventType: '$_id',
            count: 1,
            uniqueIssuesCount: { $size: '$uniqueIssues' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      return result;
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка получения статистики по типам событий:', error);
      throw error;
    }
  }

  /**
   * Действия автора за период
   */
  async getAuthorActions(authorAccountId, startDate, endDate) {
    try {
      return await ChangelogEvent.find({
        authorAccountId,
        created: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      })
        .sort({ created: -1 })
        .lean();
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка получения действий автора:', error);
      throw error;
    }
  }

  /**
   * Действия группы людей
   */
  async getGroupActions(accountIds, startDate, endDate) {
    try {
      return await ChangelogEvent.find({
        authorAccountId: { $in: accountIds },
        created: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      })
        .sort({ created: -1 })
        .lean();
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка получения действий группы:', error);
      throw error;
    }
  }

  /**
   * Статистика активности автора
   */
  async getAuthorStats(authorAccountId, startDate, endDate) {
    try {
      return await ChangelogEvent.aggregate([
        {
          $match: {
            authorAccountId,
            created: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$created' } },
              eventType: '$eventType'
            },
            count: { $sum: 1 },
            uniqueIssues: { $addToSet: '$issueKey' }
          }
        },
        {
          $project: {
            _id: 0,
            date: '$_id.date',
            eventType: '$_id.eventType',
            count: 1,
            uniqueIssuesCount: { $size: '$uniqueIssues' }
          }
        },
        { $sort: { date: 1 } }
      ]);
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка получения статистики автора:', error);
      throw error;
    }
  }

  /**
   * Матрица назначений
   */
  async getAssignmentMatrix(startDate, endDate, departmentId = null) {
    try {
      const match = {
        field: 'assignee',
        toAccountId: { $ne: null },
        created: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };

      if (departmentId) match.departmentId = departmentId;

      return await ChangelogEvent.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              from: '$authorAccountId',
              to: '$toAccountId'
            },
            count: { $sum: 1 },
            issues: { $addToSet: '$issueKey' }
          }
        },
        {
          $project: {
            _id: 0,
            assignerAccountId: '$_id.from',
            assigneeAccountId: '$_id.to',
            count: 1,
            issueKeys: '$issues'
          }
        },
        { $sort: { count: -1 } }
      ]);
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка получения матрицы назначений:', error);
      throw error;
    }
  }
}

export default new ChangelogService();
