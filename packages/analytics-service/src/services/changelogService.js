import {models} from '../models/db.js';

const { ChangelogEvent } = models;

const AUTOMATION_ACCOUNTS = [
    '712020:d3c8eb70-f65d-4076-94b9-ce46cfca71c0',
    '557058:f58131cb-b67d-43c7-b30d-6b58d40bd077'
]

const AUTOMATION_EVENTS = [
    'issue_updated',
    'issue_created',
]

class ChangelogService {
    /**
     * Сохранение новых логов изменений
     */
    async saveChangelog(issueId, issueKey, assigneeAccountId, eventType, user, changelogItem, departmentId) {
      try {
        if (!changelogItem?.items?.length) {
          console.log(`[Changelog] ℹ️ Нет изменений для ${issueKey}`);
          return null;
        }

        console.log(`[Changelog] 📝 Обработка события "${eventType}" для ${issueKey}`);

        if (AUTOMATION_ACCOUNTS.includes(user.accountId) && AUTOMATION_EVENTS.includes(eventType)) {
          return await this._saveIssueCreated(issueId, issueKey, assigneeAccountId, eventType, user, changelogItem, departmentId);
        }


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
        field: eventType,
        fieldtype: 'aggregate',
        fieldId: eventType,
        from: null,
        fromString: null,
        to: JSON.stringify(createdFields),
        toString: `Created or updated with ${changelogItem.items.length} fields`,
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

    // ========== НОВАЯ СИСТЕМА ПОИСКА ==========

    /**
     * Построение MongoDB query из фильтров (поддержка миллисекунд)
     */
    _buildQuery(filters = {}) {
      const query = {};

      // Фильтры по ID и ключам
      if (filters.authorAccountId) query.authorAccountId = filters.authorAccountId;
      if (filters.toAccountId) query.toAccountId = filters.toAccountId;
      if (filters.fromAccountId) query.fromAccountId = filters.fromAccountId;
      if (filters.departmentId) query.departmentId = filters.departmentId;
      if (filters.issueKey) query.issueKey = filters.issueKey;
      if (filters.issueId) query.issueId = filters.issueId;

      // Фильтры по типам и полям
      if (filters.eventType) query.eventType = filters.eventType;
      if (filters.field) query.field = filters.field;
      if (filters.fieldtype) query.fieldtype = filters.fieldtype;

      // Фильтры по автору
      if (filters.authorDisplayName) {
        query.authorDisplayName = new RegExp(filters.authorDisplayName, 'i');
      }
      if (filters.authorEmail) query.authorEmail = filters.authorEmail;
      if (filters.authorActive !== undefined) query.authorActive = filters.authorActive;

      // Временные фильтры (миллисекунды)
      if (filters.startDate || filters.endDate) {
        query.created = {};
        if (filters.startDate) {
          query.created.$gte = new Date(parseInt(filters.startDate));
        }
        if (filters.endDate) {
          query.created.$lte = new Date(parseInt(filters.endDate));
        }
      }

      // Поиск по значениям изменений
      if (filters.toString) {
        query.toString = new RegExp(filters.toString, 'i');
      }
      if (filters.fromString) {
        query.fromString = new RegExp(filters.fromString, 'i');
      }

      return query;
    }

    /**
     * Универсальный поиск логов (миллисекунды)
     * @param {Object} filters - Фильтры поиска
     * @param {string} filters.authorAccountId - ID автора
     * @param {string} filters.departmentId - ID департамента
     * @param {string} filters.issueKey - Ключ задачи
     * @param {string} filters.issueId - ID задачи
     * @param {string} filters.eventType - Тип события
     * @param {string} filters.field - Поле изменения
     * @param {number} filters.startDate - Начало периода (миллисекунды)
     * @param {number} filters.endDate - Конец периода (миллисекунды)
     * @param {number} filters.limit - Лимит (по умолчанию 100)
     * @param {number} filters.skip - Пропустить записей
     * @param {string} filters.sort - Сортировка (по умолчанию '-created')
     */
    async search(filters = {}) {
      try {
        const query = this._buildQuery(filters);

        const limit = parseInt(filters.limit) || 100;
        const skip = parseInt(filters.skip) || 0;
        const sort = filters.sort || '-created';

        const [events, total] = await Promise.all([
          ChangelogEvent.find(query)
            .sort(sort)
            .limit(limit)
            .skip(skip)
            .lean(),
          ChangelogEvent.countDocuments(query)
        ]);

        return {
          success: true,
          data: events,
          pagination: {
            total,
            limit,
            skip,
            page: Math.floor(skip / limit) + 1,
            totalPages: Math.ceil(total / limit),
            hasMore: total > skip + limit
          }
        };
      } catch (error) {
        console.error('[Changelog] ❌ Ошибка поиска:', error);
        throw error;
      }
    }

    /**
     * Активность по сотруднику (миллисекунды)
     */
    async getEmployeeActivity(authorAccountId, startDate, endDate, options = {}) {
      try {
        const match = {
          authorAccountId,
          created: {
            $gte: new Date(parseInt(startDate)),
            $lte: new Date(parseInt(endDate))
          }
        };

        if (options.departmentId) match.departmentId = options.departmentId;
        if (options.eventType) match.eventType = options.eventType;

        const stats = await ChangelogEvent.aggregate([
          { $match: match },
          {
            $group: {
              _id: {
                date: { $dateToString: { format: '%Y-%m-%d', date: '$created' } },
                eventType: '$eventType',
                field: '$field'
              },
              count: { $sum: 1 },
              uniqueIssues: { $addToSet: '$issueKey' }
            }
          },
          {
            $group: {
              _id: '$_id.date',
              events: {
                $push: {
                  eventType: '$_id.eventType',
                  field: '$_id.field',
                  count: '$count',
                  uniqueIssuesCount: { $size: '$uniqueIssues' }
                }
              },
              totalEvents: { $sum: '$count' }
            }
          },
          {
            $project: {
              _id: 0,
              date: '$_id',
              events: 1,
              totalEvents: 1
            }
          },
          { $sort: { date: 1 } }
        ]);

        // Общая статистика
        const summary = await ChangelogEvent.aggregate([
          { $match: match },
          {
            $group: {
              _id: null,
              totalEvents: { $sum: 1 },
              uniqueIssues: { $addToSet: '$issueKey' },
              eventTypes: { $addToSet: '$eventType' },
              fields: { $addToSet: '$field' }
            }
          }
        ]);

        return {
          success: true,
          authorAccountId,
          period: {
            startDate: parseInt(startDate),
            endDate: parseInt(endDate)
          },
          dailyActivity: stats,
          summary: summary[0] ? {
            totalEvents: summary[0].totalEvents,
            uniqueIssuesCount: summary[0].uniqueIssues.length,
            eventTypesCount: summary[0].eventTypes.length,
            fieldsCount: summary[0].fields.length
          } : null
        };
      } catch (error) {
        console.error('[Changelog] ❌ Ошибка получения активности сотрудника:', error);
        throw error;
      }
    }

    /**
     * Активность по департаменту (миллисекунды)
     */
    async getDepartmentActivity(departmentId, startDate, endDate, options = {}) {
      try {
        const match = {
          departmentId,
          created: {
            $gte: new Date(parseInt(startDate)),
            $lte: new Date(parseInt(endDate))
          }
        };

        if (options.eventType) match.eventType = options.eventType;

        // Активность по дням
        const dailyStats = await ChangelogEvent.aggregate([
          { $match: match },
          {
            $group: {
              _id: {
                date: { $dateToString: { format: '%Y-%m-%d', date: '$created' } },
                author: '$authorAccountId'
              },
              count: { $sum: 1 },
              issues: { $addToSet: '$issueKey' }
            }
          },
          {
            $group: {
              _id: '$_id.date',
              totalEvents: { $sum: '$count' },
              uniqueAuthors: { $addToSet: '$_id.author' },
              uniqueIssues: { $addToSet: { $arrayElemAt: ['$issues', 0] } }
            }
          },
          {
            $project: {
              _id: 0,
              date: '$_id',
              totalEvents: 1,
              uniqueAuthorsCount: { $size: '$uniqueAuthors' },
              uniqueIssuesCount: { $size: '$uniqueIssues' }
            }
          },
          { $sort: { date: 1 } }
        ]);

        // Топ активных сотрудников
        const topEmployees = await ChangelogEvent.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$authorAccountId',
              displayName: { $first: '$authorDisplayName' },
              count: { $sum: 1 },
              uniqueIssues: { $addToSet: '$issueKey' }
            }
          },
          {
            $project: {
              _id: 0,
              authorAccountId: '$_id',
              displayName: 1,
              eventsCount: '$count',
              uniqueIssuesCount: { $size: '$uniqueIssues' }
            }
          },
          { $sort: { eventsCount: -1 } },
          { $limit: 10 }
        ]);

        // Общая статистика
        const summary = await ChangelogEvent.aggregate([
          { $match: match },
          {
            $group: {
              _id: null,
              totalEvents: { $sum: 1 },
              uniqueAuthors: { $addToSet: '$authorAccountId' },
              uniqueIssues: { $addToSet: '$issueKey' },
              eventTypes: { $addToSet: '$eventType' }
            }
          }
        ]);

        return {
          success: true,
          departmentId,
          period: {
            startDate: parseInt(startDate),
            endDate: parseInt(endDate)
          },
          dailyActivity: dailyStats,
          topEmployees,
          summary: summary[0] ? {
            totalEvents: summary[0].totalEvents,
            uniqueAuthorsCount: summary[0].uniqueAuthors.length,
            uniqueIssuesCount: summary[0].uniqueIssues.length,
            eventTypesCount: summary[0].eventTypes.length
          } : null
        };
      } catch (error) {
        console.error('[Changelog] ❌ Ошибка получения активности департамента:', error);
        throw error;
      }
    }

    /**
     * Активность группы сотрудников (миллисекунды)
     */
    async getTeamActivity(accountIds, startDate, endDate, options = {}) {
      try {
        if (!Array.isArray(accountIds) || accountIds.length === 0) {
          throw new Error('accountIds должен быть непустым массивом');
        }

        const match = {
          authorAccountId: { $in: accountIds },
          created: {
            $gte: new Date(parseInt(startDate)),
            $lte: new Date(parseInt(endDate))
          }
        };

        if (options.departmentId) match.departmentId = options.departmentId;
        if (options.eventType) match.eventType = options.eventType;

        // Активность по сотрудникам
        const employeeStats = await ChangelogEvent.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$authorAccountId',
              displayName: { $first: '$authorDisplayName' },
              totalEvents: { $sum: 1 },
              uniqueIssues: { $addToSet: '$issueKey' },
              eventTypes: { $push: '$eventType' }
            }
          },
          {
            $project: {
              _id: 0,
              authorAccountId: '$_id',
              displayName: 1,
              totalEvents: 1,
              uniqueIssuesCount: { $size: '$uniqueIssues' },
              eventTypesCount: { $size: { $setUnion: ['$eventTypes'] } }
            }
          },
          { $sort: { totalEvents: -1 } }
        ]);

        // Сравнительная активность по дням
        const dailyComparison = await ChangelogEvent.aggregate([
          { $match: match },
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
              employees: {
                $push: {
                  authorAccountId: '$_id.author',
                  count: '$count'
                }
              },
              totalEvents: { $sum: '$count' }
            }
          },
          {
            $project: {
              _id: 0,
              date: '$_id',
              employees: 1,
              totalEvents: 1
            }
          },
          { $sort: { date: 1 } }
        ]);

        return {
          success: true,
          teamSize: accountIds.length,
          period: {
            startDate: parseInt(startDate),
            endDate: parseInt(endDate)
          },
          employeeStats,
          dailyComparison
        };
      } catch (error) {
        console.error('[Changelog] ❌ Ошибка получения активности команды:', error);
        throw error;
      }
    }

    /**
     * Получить все логи с пагинацией (миллисекунды)
     */
    async getAllLogs(filters = {}) {
      try {
        return await this.search(filters);
      } catch (error) {
        console.error('[Changelog] ❌ Ошибка получения всех логов:', error);
        throw error;
      }
    }

    /**
     * Статистика по временному периоду (миллисекунды)
     */
    async getTimeRangeStats(startDate, endDate, filters = {}) {
      try {
        const match = {
          created: {
            $gte: new Date(parseInt(startDate)),
            $lte: new Date(parseInt(endDate))
          }
        };

        if (filters.departmentId) match.departmentId = filters.departmentId;
        if (filters.eventType) match.eventType = filters.eventType;
        if (filters.authorAccountId) match.authorAccountId = filters.authorAccountId;

        const stats = await ChangelogEvent.aggregate([
          { $match: match },
          {
            $group: {
              _id: null,
              totalEvents: { $sum: 1 },
              uniqueAuthors: { $addToSet: '$authorAccountId' },
              uniqueIssues: { $addToSet: '$issueKey' },
              uniqueDepartments: { $addToSet: '$departmentId' },
              eventTypes: { $push: '$eventType' },
              fields: { $push: '$field' },
              firstEvent: { $min: '$created' },
              lastEvent: { $max: '$created' }
            }
          },
          {
            $project: {
              _id: 0,
              totalEvents: 1,
              uniqueAuthorsCount: { $size: '$uniqueAuthors' },
              uniqueIssuesCount: { $size: '$uniqueIssues' },
              uniqueDepartmentsCount: { $size: '$uniqueDepartments' },
              eventTypesDistribution: {
                $arrayToObject: {
                  $map: {
                    input: { $setUnion: ['$eventTypes'] },
                    as: 'type',
                    in: {
                      k: '$$type',
                      v: {
                        $size: {
                          $filter: {
                            input: '$eventTypes',
                            cond: { $eq: ['$$this', '$$type'] }
                          }
                        }
                      }
                    }
                  }
                }
              },
              fieldsDistribution: {
                $arrayToObject: {
                  $map: {
                    input: { $setUnion: ['$fields'] },
                    as: 'field',
                    in: {
                      k: '$$field',
                      v: {
                        $size: {
                          $filter: {
                            input: '$fields',
                            cond: { $eq: ['$$this', '$$field'] }
                          }
                        }
                      }
                    }
                  }
                }
              },
              firstEvent: 1,
              lastEvent: 1
            }
          }
        ]);

        return {
          success: true,
          period: {
            startDate: parseInt(startDate),
            endDate: parseInt(endDate)
          },
          stats: stats[0] || {
            totalEvents: 0,
            uniqueAuthorsCount: 0,
            uniqueIssuesCount: 0,
            uniqueDepartmentsCount: 0
          }
        };
      } catch (error) {
        console.error('[Changelog] ❌ Ошибка получения статистики по периоду:', error);
        throw error;
      }
    }

    /**
     * Подсчет событий
     */
    async count(filters = {}) {
      try {
        const query = this._buildQuery(filters);
        const count = await ChangelogEvent.countDocuments(query);
        return { success: true, count };
      } catch (error) {
        console.error('[Changelog] ❌ Ошибка подсчета:', error);
        throw error;
      }
    }

    // ========== СТАРЫЕ МЕТОДЫ (совместимость) ==========

    async getChangelog(issueId) {
      return (await this.search({ issueId, limit: 1000 })).data;
    }

    async getAssignmentHistory(issueId) {
      const result = await this.search({ issueId, field: 'assignee', limit: 1000 });
      return result.data.map(e => ({
        date: e.created,
        eventType: e.eventType,
        author: e.authorDisplayName,
        authorAccountId: e.authorAccountId,
        from: e.fromString,
        to: e.toString,
        fromAccountId: e.fromAccountId,
        toAccountId: e.toAccountId
      }));
    }

    async getStatusHistory(issueId) {
      const result = await this.search({ issueId, field: 'status', limit: 1000 });
      return result.data.map(e => ({
        date: e.created,
        author: e.authorDisplayName,
        from: e.fromString,
        to: e.toString,
        fromId: e.from,
        toId: e.to
      }));
    }

    async getEmployeeStats(accountId, startDate, endDate) {
      const activity = await this.getEmployeeActivity(accountId, startDate, endDate);
      return activity.dailyActivity;
    }

    async getHistoryByEventType(issueId, eventType) {
      return (await this.search({ issueId, eventType, limit: 1000 })).data;
    }

    async getEventTypeStats(startDate, endDate) {
      const stats = await this.getTimeRangeStats(startDate, endDate);
      return stats.stats.eventTypesDistribution || {};
    }

    async getAuthorActions(authorAccountId, startDate, endDate) {
      return (await this.search({ authorAccountId, startDate, endDate, limit: 1000 })).data;
    }

    async getGroupActions(accountIds, startDate, endDate) {
      return (await this.getTeamActivity(accountIds, startDate, endDate)).employeeStats;
    }

    async getAuthorStats(authorAccountId, startDate, endDate) {
      const activity = await this.getEmployeeActivity(authorAccountId, startDate, endDate);
      return activity.dailyActivity;
    }

    async getAssignmentMatrix(startDate, endDate, departmentId = null) {
      const match = {
        field: 'assignee',
        toAccountId: { $ne: null },
        created: {
          $gte: new Date(parseInt(startDate)),
          $lte: new Date(parseInt(endDate))
        }
      };

      if (departmentId) match.departmentId = departmentId;

      return ChangelogEvent.aggregate([
          {$match: match},
          {
              $group: {
                  _id: {
                      from: '$authorAccountId',
                      to: '$toAccountId'
                  },
                  count: {$sum: 1},
                  issues: {$addToSet: '$issueKey'}
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
          {$sort: {count: -1}}
      ]);
    }
}

export default new ChangelogService();
