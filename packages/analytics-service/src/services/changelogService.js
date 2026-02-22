import {models} from '../models/db.js';

const { ChangelogEvent } = models;


class ChangelogService {
    /**
     * Сохранение новых логов изменений
     */
    async saveChangelog(issueId, issueKey, assigneeAccountId,  eventType, user, changelogItem, departmentId) {
      try {
        if (!changelogItem?.items?.length) {
          console.log(`[Changelog] ℹ️ Нет изменений для ${issueKey}`);
          return null;
        }

        console.log(`[Changelog] 📝 Обработка события "${eventType}" для ${issueKey}`);

        // Для issue_created используем отдельный метод
        if (eventType === 'issue_created') {
          return await this._saveIssueCreated(issueId, issueKey, assigneeAccountId, eventType, user, changelogItem, departmentId);
        }

        // Для всех остальных событий сохраняем каждое изменение отдельно
        return await this._saveRegularChangelog(issueId, issueKey, assigneeAccountId, eventType, user, changelogItem, departmentId);

      } catch (error) {
        console.error('[Changelog] ❌ Ошибка сохранения:', error);
        throw error;
      }
    }

    /**
     * Приватный метод: сохранение события создания задачи (агрегация)
     */
    async _saveIssueCreated(issueId, issueKey, assigneeAccountId, eventType, user, changelogItem, departmentId) {
      const createdFields = {};

      for (const item of changelogItem.items) {
        createdFields[item.field] = {
          value: item.toString || item.to,
          id: item.to,
          fieldtype: item.fieldtype,
          fieldId: item.fieldId
        };
      }

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
        field: 'issue_created',
        fieldtype: 'aggregate',
        fieldId: 'issue_created',
        from: null,
        fromString: null,
        to: JSON.stringify(createdFields),
        toString: `Created with ${changelogItem.items.length} fields`,
        fromAccountId: null,
        toAccountId: null
      };

      try {
        await ChangelogEvent.create(aggregatedEvent);
        console.log(`[Changelog] ✅ Сохранено агрегированное событие создания для ${issueKey} (${changelogItem.items.length} полей)`);
        return { added: 1, total: 1 };
      } catch (error) {
        if (error.code === 11000) {
          console.log(`[Changelog] ℹ️ Событие создания уже существует для ${issueKey}`);
          return { added: 0, total: 0 };
        }
        throw error;
      }
    }

    /**
     * Приватный метод: сохранение обычных событий (отдельные записи)
     */
    async _saveRegularChangelog(issueId, issueKey, assigneeAccountId, eventType, user, changelogItem, departmentId) {
        const events = changelogItem.items.map(item => ({
            historyId: `${changelogItem.id}_${item.field}`,
            issueId,
            issueKey,
            eventType,
            departmentId,
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

      try {
        const result = await ChangelogEvent.insertMany(events, { ordered: false });
        console.log(`[Changelog] ✅ Сохранено событий для ${issueKey}`);
        return { added: result.length, total: events.length };
      } catch (error) {
        if (error.code === 11000 && error.writeErrors) {
          // Подсчитываем успешно добавленные записи
          const addedCount = events.length - error.writeErrors.length;
          console.log(`[Changelog] ⚠️ Некоторые события уже существуют для ${issueKey}. Добавлено: ${addedCount}/${events.length}`);
          return { added: addedCount, total: events.length };
        }
        throw error;
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
        return await ChangelogEvent.aggregate([
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
                  count: {$sum: 1},
                  lastChange: {$max: '$created'}
              }
          },
          {$sort: {count: -1}}
      ]);
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
        return await ChangelogEvent.aggregate([
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
                      date: {$dateToString: {format: '%Y-%m-%d', date: '$created'}},
                      author: '$authorAccountId'
                  },
                  count: {$sum: 1}
              }
          },
          {
              $group: {
                  _id: '$_id.date',
                  totalChanges: {$sum: '$count'},
                  uniqueAuthors: {$addToSet: '$_id.author'}
              }
          },
          {
              $project: {
                  _id: 0,
                  date: '$_id',
                  totalChanges: 1,
                  uniqueAuthorsCount: {$size: '$uniqueAuthors'}
              }
          },
          {$sort: {date: 1}}
      ]);
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

  /**
   * Универсальный поиск с гибкими фильтрами
   * @param {Object} filters - Объект с фильтрами
   * @param {string} filters.authorAccountId - ID автора
   * @param {string} filters.departmentId - ID департамента
   * @param {string} filters.issueKey - Ключ задачи
   * @param {string} filters.issueId - ID задачи
   * @param {string} filters.eventType - Тип события
   * @param {string} filters.field - Поле изменения
   * @param {Date|string} filters.startDate - Начало периода
   * @param {Date|string} filters.endDate - Конец периода
   * @param {number} filters.limit - Лимит результатов (по умолчанию 100)
   * @param {number} filters.skip - Пропустить записей (пагинация)
   * @param {string} filters.sort - Сортировка (по умолчанию '-created')
   */
  async findChangelogs(filters = {}) {
    try {
      const query = {};

      // Фильтр по автору
      if (filters.authorAccountId) {
        query.authorAccountId = filters.authorAccountId;
      }

      // Фильтр по департаменту
      if (filters.departmentId) {
        query.departmentId = filters.departmentId;
      }

      // Фильтр по ключу задачи
      if (filters.issueKey) {
        query.issueKey = filters.issueKey;
      }

      // Фильтр по ID задачи
      if (filters.issueId) {
        query.issueId = filters.issueId;
      }

      // Фильтр по типу события
      if (filters.eventType) {
        query.eventType = filters.eventType;
      }

      // Фильтр по полю
      if (filters.field) {
        query.field = filters.field;
      }

      // Фильтр по времени
      if (filters.startDate || filters.endDate) {
        query.created = {};
        if (filters.startDate) {
          query.created.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.created.$lte = new Date(filters.endDate);
        }
      }

      const limit = parseInt(filters.limit) || 100;
      const skip = parseInt(filters.skip) || 0;
      const sort = filters.sort || '-created';

      const events = await ChangelogEvent.find(query)
        .sort(sort)
        .limit(limit)
        .skip(skip)
        .lean();

      const total = await ChangelogEvent.countDocuments(query);

      return {
        events,
        pagination: {
          total,
          limit,
          skip,
          hasMore: total > skip + limit
        }
      };
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка поиска:', error);
      throw error;
    }
  }

  /**
   * Поиск по нескольким сотрудникам
   * @param {string[]} accountIds - Массив ID сотрудников
   * @param {Object} filters - Дополнительные фильтры
   */
  async findByMultipleAuthors(accountIds, filters = {}) {
    try {
      if (!Array.isArray(accountIds) || accountIds.length === 0) {
        throw new Error('accountIds должен быть непустым массивом');
      }

      const query = {
        authorAccountId: { $in: accountIds }
      };

      // Добавляем дополнительные фильтры
      if (filters.departmentId) {
        query.departmentId = filters.departmentId;
      }

      if (filters.eventType) {
        query.eventType = filters.eventType;
      }

      if (filters.field) {
        query.field = filters.field;
      }

      if (filters.startDate || filters.endDate) {
        query.created = {};
        if (filters.startDate) {
          query.created.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.created.$lte = new Date(filters.endDate);
        }
      }

      const limit = parseInt(filters.limit) || 100;
      const skip = parseInt(filters.skip) || 0;
      const sort = filters.sort || '-created';

      const events = await ChangelogEvent.find(query)
        .sort(sort)
        .limit(limit)
        .skip(skip)
        .lean();

      const total = await ChangelogEvent.countDocuments(query);

      return {
        events,
        pagination: {
          total,
          limit,
          skip,
          hasMore: total > skip + limit
        }
      };
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка поиска по нескольким авторам:', error);
      throw error;
    }
  }

  /**
   * Поиск по автору
   */
  async findByAuthor(authorAccountId, filters = {}) {
    try {
      return await this.findChangelogs({
        authorAccountId,
        ...filters
      });
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка поиска по автору:', error);
      throw error;
    }
  }

  /**
   * Поиск по департаменту
   */
  async findByDepartment(departmentId, filters = {}) {
    try {
      return await this.findChangelogs({
        departmentId,
        ...filters
      });
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка поиска по департаменту:', error);
      throw error;
    }
  }

  /**
   * Поиск по ключу задачи
   */
  async findByIssueKey(issueKey, filters = {}) {
    try {
      return await this.findChangelogs({
        issueKey,
        ...filters
      });
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка поиска по ключу задачи:', error);
      throw error;
    }
  }

  /**
   * Поиск по типу события
   */
  async findByEventType(eventType, filters = {}) {
    try {
      return await this.findChangelogs({
        eventType,
        ...filters
      });
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка поиска по типу события:', error);
      throw error;
    }
  }

  /**
   * Поиск по периоду времени
   */
  async findByDateRange(startDate, endDate, filters = {}) {
    try {
      return await this.findChangelogs({
        startDate,
        endDate,
        ...filters
      });
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка поиска по периоду:', error);
      throw error;
    }
  }

  /**
   * Получить все события (с пагинацией)
   */
  async getAllChangelogs(filters = {}) {
    try {
      return await this.findChangelogs(filters);
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка получения всех событий:', error);
      throw error;
    }
  }

  /**
   * Подсчет событий с фильтрами
   */
  async countChangelogs(filters = {}) {
    try {
      const query = {};

      if (filters.authorAccountId) query.authorAccountId = filters.authorAccountId;
      if (filters.departmentId) query.departmentId = filters.departmentId;
      if (filters.issueKey) query.issueKey = filters.issueKey;
      if (filters.issueId) query.issueId = filters.issueId;
      if (filters.eventType) query.eventType = filters.eventType;
      if (filters.field) query.field = filters.field;

      if (filters.startDate || filters.endDate) {
        query.created = {};
        if (filters.startDate) query.created.$gte = new Date(filters.startDate);
        if (filters.endDate) query.created.$lte = new Date(filters.endDate);
      }

      const count = await ChangelogEvent.countDocuments(query);
      return { count };
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка подсчета событий:', error);
      throw error;
    }
  }

  /**
   * Агрегированная статистика по фильтрам
   */
  async getAggregatedStats(filters = {}) {
    try {
      const match = {};

      if (filters.authorAccountId) match.authorAccountId = filters.authorAccountId;
      if (filters.departmentId) match.departmentId = filters.departmentId;
      if (filters.eventType) match.eventType = filters.eventType;

      if (filters.startDate || filters.endDate) {
        match.created = {};
        if (filters.startDate) match.created.$gte = new Date(filters.startDate);
        if (filters.endDate) match.created.$lte = new Date(filters.endDate);
      }

      const stats = await ChangelogEvent.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalEvents: { $sum: 1 },
            uniqueIssues: { $addToSet: '$issueKey' },
            uniqueAuthors: { $addToSet: '$authorAccountId' },
            uniqueDepartments: { $addToSet: '$departmentId' },
            eventTypes: { $addToSet: '$eventType' },
            fields: { $addToSet: '$field' },
            firstEvent: { $min: '$created' },
            lastEvent: { $max: '$created' }
          }
        },
        {
          $project: {
            _id: 0,
            totalEvents: 1,
            uniqueIssuesCount: { $size: '$uniqueIssues' },
            uniqueAuthorsCount: { $size: '$uniqueAuthors' },
            uniqueDepartmentsCount: { $size: '$uniqueDepartments' },
            eventTypesCount: { $size: '$eventTypes' },
            fieldsCount: { $size: '$fields' },
            firstEvent: 1,
            lastEvent: 1,
            eventTypes: 1,
            fields: 1
          }
        }
      ]);

      return stats[0] || {
        totalEvents: 0,
        uniqueIssuesCount: 0,
        uniqueAuthorsCount: 0,
        uniqueDepartmentsCount: 0,
        eventTypesCount: 0,
        fieldsCount: 0
      };
    } catch (error) {
      console.error('[Changelog] ❌ Ошибка получения агрегированной статистики:', error);
      throw error;
    }
  }
}

export default new ChangelogService();
