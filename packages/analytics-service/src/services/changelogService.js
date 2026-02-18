import IssueChangelog from '../models/changelog.js';

class ChangelogService {
  /**
   * Сохранение новых логов изменений
   * @param {string} issueId - ID задачи
   * @param {string} issueKey - Ключ задачи
   * @param {string} departmentId - ID департамента
   * @param {string} eventType - Тип события (issue_assigned, issue_updated, etc.)
   * @param {Object} user - Объект пользователя из webhook
   * @param {Object} changelogItem - Объект изменения с id и items
   */
  async saveChangelog(issueId, issueKey, departmentId, eventType, user, changelogItem) {
    try {
      if (!changelogItem || !changelogItem.items || changelogItem.items.length === 0) {
        console.log(`[Changelog] ℹ️ Нет изменений для ${issueKey}`);
        return null;
      }

      console.log(`[Changelog] 📝 Обработка события "${eventType}" для ${issueKey}`);

      // Проверяем существующую запись
      let changelog = await IssueChangelog.findOne({ issueId });

      // Формируем новую запись
      const formattedHistory = {
        historyId: changelogItem.id,
        eventType: eventType,
        author: {
          accountId: user.accountId,
          displayName: user.displayName,
          email: user.emailAddress || null,
          avatarUrl: user.avatarUrls?.['48x48'] || null,
          active: user.active,
          timeZone: user.timeZone,
          accountType: user.accountType
        },
        created: new Date(),
        items: changelogItem.items.map(item => ({
          field: item.field,
          fieldtype: item.fieldtype,
          fieldId: item.fieldId,
          from: item.from,
          fromString: item.fromString,
          to: item.to,
          toString: item.toString,
          tmpFromAccountId: item.tmpFromAccountId || null,
          tmpToAccountId: item.tmpToAccountId || null
        }))
      };

      if (changelog) {
        // Проверяем, существует ли уже такая запись
        const exists = changelog.histories.some(h => h.historyId === changelogItem.id);

        if (!exists) {
          changelog.histories.push(formattedHistory);
          changelog.lastUpdated = new Date();
          await changelog.save();
          console.log(`[Changelog] ✅ Добавлена запись для ${issueKey} (${eventType})`);
          return { added: 1, total: changelog.histories.length };
        } else {
          console.log(`[Changelog] ℹ️ Запись уже существует для ${issueKey}`);
          return { added: 0, total: changelog.histories.length };
        }
      } else {
        // Создаём новую запись
        changelog = await IssueChangelog.create({
          issueId,
          issueKey,
          departmentId,
          histories: [formattedHistory],
          lastUpdated: new Date()
        });

        console.log(`[Changelog] ✅ Создан changelog для ${issueKey}`);
        return { added: 1, total: 1 };
      }
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка сохранения:', error);
      throw error;
    }
  }

  /**
   * Пакетное сохранение логов (для массовой загрузки)
   */
  async saveBulkChangelogs(issueId, issueKey, departmentId, histories) {
    try {
      if (!histories || histories.length === 0) {
        return null;
      }

      let changelog = await IssueChangelog.findOne({ issueId });

      const formattedHistories = histories.map(h => ({
        historyId: h.id,
        eventType: h.eventType || 'unknown',
        author: {
          accountId: h.author.accountId,
          displayName: h.author.displayName,
          email: h.author.emailAddress || null,
          avatarUrl: h.author.avatarUrls?.['48x48'] || null,
          active: h.author.active,
          timeZone: h.author.timeZone,
          accountType: h.author.accountType
        },
        created: new Date(h.created),
        items: h.items.map(item => ({
          field: item.field,
          fieldtype: item.fieldtype,
          fieldId: item.fieldId,
          from: item.from,
          fromString: item.fromString,
          to: item.to,
          toString: item.toString,
          tmpFromAccountId: item.tmpFromAccountId || null,
          tmpToAccountId: item.tmpToAccountId || null
        }))
      }));

      if (changelog) {
        const existingIds = new Set(changelog.histories.map(h => h.historyId));
        const newHistories = formattedHistories.filter(h => !existingIds.has(h.historyId));

        if (newHistories.length > 0) {
          changelog.histories.push(...newHistories);
          changelog.lastUpdated = new Date();
          await changelog.save();
          return { added: newHistories.length, total: changelog.histories.length };
        }
        return { added: 0, total: changelog.histories.length };
      } else {
        changelog = await IssueChangelog.create({
          issueId,
          issueKey,
          departmentId,
          histories: formattedHistories,
          lastUpdated: new Date()
        });
        return { added: formattedHistories.length, total: formattedHistories.length };
      }
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка пакетного сохранения:', error);
      throw error;
    }
  }

  /**
   * Получение истории по типу события
   */
  async getHistoryByEventType(issueId, eventType) {
    try {
      const changelog = await IssueChangelog.findOne({ issueId })
        .select('issueKey histories')
        .lean();

      if (!changelog) return [];

      return changelog.histories
        .filter(h => h.eventType === eventType)
        .sort((a, b) => new Date(a.created) - new Date(b.created));
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка получения истории по типу события:', error);
      throw error;
    }
  }

  /**
   * Получение истории назначений
   */
  async getAssignmentHistory(issueId) {
    try {
      const changelog = await IssueChangelog.findOne({ issueId })
        .select('issueKey histories')
        .lean();

      if (!changelog) return [];

      return changelog.histories
        .filter(h => h.items.some(i => i.field === 'assignee'))
        .map(h => {
          const assigneeItem = h.items.find(i => i.field === 'assignee');
          return {
            date: h.created,
            eventType: h.eventType,
            author: h.author.displayName,
            authorAccountId: h.author.accountId,
            from: assigneeItem.fromString,
            to: assigneeItem.toString,
            fromAccountId: assigneeItem.tmpFromAccountId,
            toAccountId: assigneeItem.tmpToAccountId
          };
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка получения истории назначений:', error);
      throw error;
    }
  }

  /**
   * Статистика по типам событий
   */
  async getEventTypeStats(startDate, endDate) {
    try {
      const result = await IssueChangelog.aggregate([
        {
          $match: {
            'histories.created': {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        { $unwind: '$histories' },
        {
          $match: {
            'histories.created': {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: '$histories.eventType',
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
}

export default new ChangelogService();
