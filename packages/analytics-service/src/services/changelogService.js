import IssueChangelog from '../models/changelog.js';

class ChangelogService {
  /**
   * Сохранение новых логов изменений
   * @param {string} issueId - ID задачи
   * @param {string} issueKey - Ключ задачи
   * @param {string} departmentId - ID департамента
   * @param {Array} histories - Массив истории изменений
   */
  async saveChangelogs(issueId, issueKey, departmentId, histories) {
    try {
      if (!histories || histories.length === 0) {
        console.log(`[Changelog] ℹ️ Нет новых логов для ${issueKey}`);
        return null;
      }

      console.log(`[Changelog] 📝 Обработка ${histories.length} записей для ${issueKey}`);

      // Проверяем существующую запись
      let changelog = await IssueChangelog.findOne({ issueId });

      // Формируем новые записи
      const formattedHistories = histories.map(h => ({
        historyId: h.id,
        author: {
          accountId: h.author.accountId,
          displayName: h.author.displayName,
          email: h.author.emailAddress || null,
          avatarUrl: h.author.avatarUrls?.['48x48'] || null,
          active: h.author.active,
          timeZone: h.author.timeZone
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
        // Находим существующие ID для избежания дубликатов
        const existingIds = new Set(changelog.histories.map(h => h.historyId));
        const newHistories = formattedHistories.filter(h => !existingIds.has(h.historyId));

        if (newHistories.length > 0) {
          changelog.histories.push(...newHistories);
          changelog.lastUpdated = new Date();
          await changelog.save();
          console.log(`[Changelog] ✅ Добавлено ${newHistories.length} новых записей для ${issueKey}`);
          return { added: newHistories.length, total: changelog.histories.length };
        } else {
          console.log(`[Changelog] ℹ️ Нет новых логов для ${issueKey} (все уже существуют)`);
          return { added: 0, total: changelog.histories.length };
        }
      } else {
        // Создаём новую запись
        changelog = await IssueChangelog.create({
          issueId,
          issueKey,
          departmentId,
          histories: formattedHistories,
          lastUpdated: new Date()
        });

        console.log(`[Changelog] ✅ Создан changelog для ${issueKey} с ${formattedHistories.length} записями`);
        return { added: formattedHistories.length, total: formattedHistories.length };
      }
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка сохранения:', error);
      throw error;
    }
  }

  /**
   * Получение истории изменений задачи
   */
  async getChangelog(issueId) {
    try {
      const changelog = await IssueChangelog.findOne({ issueId }).lean();
      return changelog;
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
   * Получение истории изменений статусов
   */
  async getStatusHistory(issueId) {
    try {
      const changelog = await IssueChangelog.findOne({ issueId })
        .select('issueKey histories')
        .lean();

      if (!changelog) return [];

      return changelog.histories
        .filter(h => h.items.some(i => i.field === 'status'))
        .map(h => {
          const statusItem = h.items.find(i => i.field === 'status');
          return {
            date: h.created,
            author: h.author.displayName,
            from: statusItem.fromString,
            to: statusItem.toString,
            fromId: statusItem.from,
            toId: statusItem.to
          };
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));
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
      const result = await IssueChangelog.aggregate([
        {
          $match: {
            'histories.created': {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            },
            $or: [
              { 'histories.author.accountId': accountId },
              { 'histories.items.tmpFromAccountId': accountId },
              { 'histories.items.tmpToAccountId': accountId }
            ]
          }
        },
        { $unwind: '$histories' },
        { $unwind: '$histories.items' },
        {
          $match: {
            'histories.created': {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            },
            $or: [
              { 'histories.author.accountId': accountId },
              { 'histories.items.tmpFromAccountId': accountId },
              { 'histories.items.tmpToAccountId': accountId }
            ]
          }
        },
        {
          $group: {
            _id: '$histories.items.field',
            count: { $sum: 1 },
            lastChange: { $max: '$histories.created' }
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
      const result = await IssueChangelog.aggregate([
        {
          $match: {
            departmentId: departmentId,
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
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$histories.created' } },
              author: '$histories.author.accountId'
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
}

export default new ChangelogService();
