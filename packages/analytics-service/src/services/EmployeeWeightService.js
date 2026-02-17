import { redisClient } from '../config/redis.js';
import { create, all } from 'mathjs';
import {models} from "../models/db.js";

const math = create(all);

class EmployeeWeightService {
  /**
   * Получение задач сотрудника, созданных сегодня (по ташкентскому времени UTC+5)
   */
  async getTodayIssues(accountId) {
    try {
      // Получаем сегодняшнюю дату по ташкентскому времени
      const tashkentOffset = 5 * 60 * 60 * 1000; // +5 часов в миллисекундах
      const nowTashkent = new Date(Date.now() + tashkentOffset);

      // Устанавливаем время на 00:00:00 по Ташкенту
      const todayStartTashkent = new Date(
        nowTashkent.getFullYear(),
        nowTashkent.getMonth(),
        nowTashkent.getDate()
      );

      // Конвертируем обратно в UTC для запроса к БД
      const todayStartUTC = new Date(todayStartTashkent.getTime() - tashkentOffset);

      const issues = await models.Issue.find({
        assigneeAccountId: accountId,
        createdAt: { $gte: todayStartUTC }
      })
      .select('issueId issueKey typeId status issueStatusId createdAt updatedAt assigneeAccountId assignmentGroupId')
      .lean();

      console.log(`[EmployeeWeight] 📊 Найдено задач за сегодня (Ташкент): ${issues.length}`);

      return issues;
    } catch (error) {
      console.error('[EmployeeWeight] ❌ Ошибка получения задач:', error);
      return [];
    }
  }

  /**
   * Получение всех активных задач сотрудника
   */
  async getActiveIssues(departmentId, accountId) {
    try {
      const completedStatuses = ['Closed', 'Done', 'Resolved', 'CANCELED'];

      const issues = await models.Issue.find({
        departmentId,
        assigneeAccountId: accountId,
        status: { $nin: completedStatuses }
      })
      .select('issueId issueKey typeId status issueStatusId createdAt updatedAt assigneeAccountId assignmentGroupId')
      .lean();

      console.log(`[EmployeeWeight] 📋 Найдено активных задач: ${issues.length}`);

      return issues;
    } catch (error) {
      console.error('[EmployeeWeight] ❌ Ошибка получения активных задач:', error);
      return [];
    }
  }

  /**
   * Сохранение данных сотрудника в Redis
   */
  async saveToRedis(employeeData, ttl = 14400) {
    try {
      const { departmentObjectId, accountId, assigneeEmail } = employeeData;

      // Основной ключ
      const mainKey = `Department:${departmentObjectId}:${accountId}:${assigneeEmail}`;
      await redisClient.setex(mainKey, ttl, JSON.stringify(employeeData));

      // Дополнительный ключ для быстрого доступа к весу
      const weightKey = `employee:weight:${accountId}`;
      await redisClient.setex(
        weightKey,
        ttl,
        String(employeeData.calculatedWeight || 0)
      );

      // Индексный ключ для списка сотрудников отдела
      const deptKey = `department:${departmentObjectId}:employees`;
      await redisClient.sadd(deptKey, accountId);
      await redisClient.expire(deptKey, ttl);

      console.log(`[EmployeeWeight] 💾 Сохранено в Redis: ${mainKey}, TTL=${ttl}s`);

      return true;
    } catch (error) {
      console.error('[EmployeeWeight] ❌ Ошибка сохранения в Redis:', error);
      throw error;
    }
  }

  /**
   * Получение данных сотрудника из Redis
   */
  async getFromRedis(departmentObjectId, accountId, assigneeEmail) {
    try {
      const key = `Department:${departmentObjectId}:${accountId}:${assigneeEmail}`;
      const data = await redisClient.get(key);

      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[EmployeeWeight] ❌ Ошибка получения из Redis:', error);
      return null;
    }
  }

  /** Создания смены а редисе */
  async createShiftInRedis(shiftData) {
      try {
          const {departmentObjectId, accountId, assigneeEmail} = shiftData;
          const issues = await this.getTodayIssues(accountId);
            const processed = this.processEmployeeWeight(shiftData, issues);
            await this.saveToRedis(processed, shiftData.ttl || 14400);
      } catch (error) {
          console.error('[EmployeeWeight] ❌ Ошибка создания смены в Redis:', error);
          throw error;
      }
  }

    /**
     * Обновляет вес сотрудника при назначении новой задачи
     * @param {string} accountId - ID сотрудника
     * @param {Object} issue - Объект задачи
     * @returns {Object} Обновлённые данные сотрудника с новым весом
     */
    async updateWeightOnTaskAssigned(accountId, issue) {
        try {
            console.log(`[EmployeeWeight] 📥 Обновление веса для ${accountId} при назначении задачи ${issue.issueKey}`);

            // 1. Ищем все ключи сотрудника в Redis (формат: Department:*:accountId:*)
            const pattern = `Department:*:${accountId}:*`;
            const keys = await redisClient.keys(pattern);

            if (keys.length === 0) {
                console.warn(`[EmployeeWeight] ⚠️ Сотрудник ${accountId} не найден в Redis`);
                return null;
            }

            // Берём первый найденный ключ (обычно сотрудник в одном департаменте)
            const employeeKey = keys[0];
            const cachedData = await redisClient.get(employeeKey);

            if (!cachedData) {
                console.warn(`[EmployeeWeight] ⚠️ Данные сотрудника ${accountId} устарели`);
                return null;
            }

            const employeeData = JSON.parse(cachedData);

            // 2. Добавляем новую задачу к существующим
            const existingIssues = await this.getActiveIssues(
                employeeData.departmentId,
                accountId
            );

            // Проверяем, не дублируется ли задача
            const isDuplicate = existingIssues.some(i => i.issueId === issue.issueId);

            let allIssues = existingIssues;
            if (!isDuplicate) {
                allIssues = [...existingIssues, issue];
                console.log(`[EmployeeWeight] ➕ Добавлена задача ${issue.issueKey}, всего задач: ${allIssues.length}`);
            } else {
                console.log(`[EmployeeWeight] ♻️ Задача ${issue.issueKey} уже существует, только пересчитываем вес`);
            }

            const processed = this.processEmployeeWeight(employeeData, allIssues);


            await this.saveToRedis(processed, employeeData.ttl || 14400);


            console.log(`[EmployeeWeight] ✅ Вес обновлён: ${employeeData.calculatedWeight} → ${processed.calculatedWeight}`);

            return {
                success: true,
                accountId,
                previousWeight: employeeData.calculatedWeight,
                newWeight: processed.calculatedWeight,
                taskTypeWeights: processed.taskTypeWeights,
                metrics: processed.metrics
            };

        } catch (error) {
            console.error('[EmployeeWeight] ❌ Ошибка обновления веса при назначении задачи:', error);
            throw error;
        }
    }


  /**
   * Обновление веса сотрудника (пересчёт на основе текущих задач)
   */
  async updateEmployeeWeight(departmentId, departmentObjectId, accountId, assigneeEmail) {
    try {
      console.log(`[EmployeeWeight] 🔄 Обновление веса для ${assigneeEmail}`);

      // Получаем данные сотрудника из Redis
      let employeeData = await this.getFromRedis(departmentObjectId, accountId, assigneeEmail);

      if (!employeeData) {
          throw new Error('Employee weight record not found');
      }

      // Получаем задачи
      const todayIssues = await this.getTodayIssues(departmentId, accountId);
      const activeIssues = await this.getActiveIssues(departmentId, accountId);

      // Объединяем уникальные задачи
      const issueMap = new Map();
      [...todayIssues, ...activeIssues].forEach(issue => {
        issueMap.set(issue.issueId, issue);
      });
      const allIssues = Array.from(issueMap.values());

      // Обрабатываем вес
      const processed = this.processEmployeeWeight(employeeData, allIssues);

      // Сохраняем обновлённые данные в Redis
      await this.saveToRedis(processed, employeeData.ttl || 14400);


      console.log(`[EmployeeWeight] ✅ Вес обновлён: ${processed.calculatedWeight}`);

      return processed;
    } catch (error) {
      console.error('[EmployeeWeight] ❌ Ошибка обновления веса:', error);
      throw error;
    }
  }

  /**
   * Основной метод обработки веса сотрудника
   */
  processEmployeeWeight(employeeData, issues = []) {
    const normalized = this._normalizeTaskTypeWeights(employeeData.taskTypeWeights);
    const withCounts = this._updateCounts(normalized, issues);
    const weight = this._calculateWeight(withCounts, employeeData.limits, {
      defaultMaxLoad: employeeData.defaultMaxLoad,
      priorityMultiplier: employeeData.priorityMultiplier
    });
    const metrics = this._calculateMetrics(issues);

    return {
      ...employeeData,
      taskTypeWeights: withCounts,
      calculatedWeight: weight,
      metrics,
      processedAt: new Date().toISOString()
    };
  }

  _normalizeTaskTypeWeights(taskTypeWeights) {
    if (!Array.isArray(taskTypeWeights)) {
      return this._getDefaultStructure();
    }

    const normalized = taskTypeWeights.map(taskType => {
      const normalizedType = {
        typeId: taskType.typeId,
        name: taskType.name,
        weight: taskType.weight || 1,
        count: 0,
        statusWeights: []
      };

      if (Array.isArray(taskType.statusWeights)) {
        normalizedType.statusWeights = taskType.statusWeights.map(status => ({
          statusId: status.statusId,
          statusName: status.statusName,
          count: 0,
          weight: status.weight || 1
        }));

        const hasOther = normalizedType.statusWeights.some(s => s.statusId === '-1');
        if (!hasOther) {
          normalizedType.statusWeights.push({
            statusId: '-1',
            statusName: 'All other statuses',
            count: 0,
            weight: 1
          });
        }
      }

      return normalizedType;
    });

    const hasOtherType = normalized.some(t => t.typeId === '-1');
    if (!hasOtherType) {
      normalized.push({
        typeId: '-1',
        name: 'All other types',
        weight: 1,
        count: 0
      });
    }

    return normalized;
  }

  _updateCounts(taskTypeWeights, issues) {
    if (!Array.isArray(issues) || issues.length === 0) {
      return taskTypeWeights;
    }

    const typeMap = new Map(taskTypeWeights.map(t => [t.typeId, t]));
    const otherType = typeMap.get('-1');

    issues.forEach(issue => {
      const { typeId, issueStatusId } = issue;
      let taskType = typeMap.get(typeId) || otherType;

      if (taskType) {
        taskType.count++;

        if (Array.isArray(taskType.statusWeights)) {
          const statusMap = new Map(taskType.statusWeights.map(s => [s.statusId, s]));
          const status = statusMap.get(issueStatusId) || statusMap.get('-1');

          if (status) {
            status.count++;
          }
        }
      }
    });

    return taskTypeWeights;
  }

  _calculateWeight(taskTypeWeights, limits, options) {
    const {
      defaultMaxLoad = 100,
      priorityMultiplier = 1,
      isNewbie = false,
      newbiePenalty = 0.7
    } = options;

    let currentLoad = 0;

    for (const taskType of taskTypeWeights) {
      const taskWeight = taskType.weight || 1;

      if (Array.isArray(taskType.statusWeights)) {
        for (const status of taskType.statusWeights) {
          const statusWeight = status.weight || 1;
          const statusCount = status.count || 0;

          if (statusCount > 0) {
            currentLoad = math.add(
              currentLoad,
              math.multiply(taskWeight, statusCount, statusWeight)
            );
          }
        }
      } else if (taskType.count > 0) {
        currentLoad = math.add(
          currentLoad,
          math.multiply(taskWeight, taskType.count)
        );
      }
    }

    currentLoad = math.multiply(currentLoad, priorityMultiplier);

    const { maxDailyIssues = 30, maxActiveIssues = 30, preferredLoadPercent = 80 } = limits;

    const loadFactorFromLimits = math.divide(
      math.add(
        math.divide(maxDailyIssues, 30),
        math.divide(maxActiveIssues, 30)
      ),
      2
    );

    const preferredLoadFactor = math.divide(preferredLoadPercent, 100);

    let adjustedMaxLoad = math.multiply(
      defaultMaxLoad,
      loadFactorFromLimits,
      preferredLoadFactor
    );

    if (isNewbie) {
      adjustedMaxLoad = math.multiply(adjustedMaxLoad, newbiePenalty);
    }

    adjustedMaxLoad = Math.max(adjustedMaxLoad, 1);

    const employeeWeight = math.multiply(
      math.divide(currentLoad, adjustedMaxLoad),
      100
    );

    return math.round(employeeWeight, 2);
  }

  _calculateMetrics(issues) {
    // Используем ташкентское время для определения "сегодня"
    const tashkentOffset = 5 * 60 * 60 * 1000;
    const nowTashkent = new Date(Date.now() + tashkentOffset);
    const todayStartTashkent = new Date(
      nowTashkent.getFullYear(),
      nowTashkent.getMonth(),
      nowTashkent.getDate()
    );
    const todayStartUTC = new Date(todayStartTashkent.getTime() - tashkentOffset);

    const todayTasksCount = issues.filter(
      issue => new Date(issue.createdAt) >= todayStartUTC
    ).length;

    const completedStatuses = ['Closed', 'Done', 'Resolved', 'CANCELED'];
    const completedTasksCount = issues.filter(
      issue => completedStatuses.includes(issue.status)
    ).length;

    const activeTasksCount = issues.filter(
      issue => !completedStatuses.includes(issue.status)
    ).length;

    return {
      todayTasksCount,
      completedTasksCount,
      activeTasksCount,
      totalTasksProcessed: issues.length
    };
  }

  _getDefaultStructure() {
    return [
      {
        typeId: '-1',
        name: 'All other types',
        weight: 1,
        count: 0
      }
    ];
  }
}

export default new EmployeeWeightService();
