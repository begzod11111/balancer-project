import { redisClient } from '../config/redis.js';
import { create, all } from 'mathjs';
import { models } from '../models/db.js';

const math = create(all);

export class AnalyticsService {
  /**
   * Обрабатывает событие создания смены
   * @param {Object} eventData - Данные события shift_created
   */
  async processShiftCreated(eventData) {
    try {
      console.log(`[Analytics] 🚀 Обработка события shift_created для ${eventData.assigneeEmail}`);

      const {
        accountId,
        assigneeEmail,
        departmentObjectId,
        taskTypeWeights,
        limits,
        loadCalculationFormula,
        defaultMaxLoad,
        priorityMultiplier,
        ttl
      } = eventData;

      // 1. Получаем задачи сотрудника
      const issues = await this.getEmployeeIssues(accountId);

      // 2. Фильтруем задачи
      const { todayIssues, completedIssues, activeIssues } = this.filterIssues(issues);

      console.log(`[Analytics] 📊 Найдено задач: сегодня=${todayIssues.length}, выполнено=${completedIssues.length}, активно=${activeIssues.length}`);

      // 3. Обновляем структуру taskTypeWeights
      const updatedTaskWeights = this.compactTaskTypeWeights(
        taskTypeWeights || [],
        [...todayIssues, ...activeIssues]
      );

      // 4. Проверяем и корректируем лимиты для нового сотрудника
      const adjustedLimits = this.adjustLimitsForNewEmployee(
        limits,
        completedIssues.length,
        eventData.completedTasksCount
      );

      // 5. Рассчитываем вес сотрудника
      const employeeWeight = this.calculateEmployeeWeight({
        taskTypeWeights: updatedTaskWeights,
        loadCalculationFormula,
        defaultMaxLoad,
        priorityMultiplier,
        limits: adjustedLimits,
        activeTasksCount: activeIssues.length,
        completedTasksCount: completedIssues.length
      });

      // 6. Подготавливаем данные для сохранения
      const enrichedData = {
        ...eventData,
        taskTypeWeights: updatedTaskWeights,
        limits: adjustedLimits,
        calculatedWeight: employeeWeight,
        metrics: {
          todayTasksCount: todayIssues.length,
          completedTasksCount: completedIssues.length,
          activeTasksCount: activeIssues.length,
          totalTasksProcessed: issues.length
        },
        processedAt: new Date().toISOString()
      };

      // 7. Сохраняем в Redis
      await this.saveToRedis(enrichedData, ttl);

      console.log(`[Analytics] ✅ Обработка завершена. Вес сотрудника: ${employeeWeight}`);

      return {
        success: true,
        employeeWeight,
        metrics: enrichedData.metrics
      };

    } catch (error) {
      console.error('[Analytics] ❌ Ошибка обработки события:', error);
      throw error;
    }
  }

  /**
   * Получает все задачи сотрудника из базы данных
   */
  async getEmployeeIssues(assigneeAccountId) {
    try {
      const issues = await models.Issue.find({
        assigneeAccountId
      })
      .select('issueKey typeId status issueStatusId createdAt updatedAt')
      .lean()
      .exec();

      return issues || [];
    } catch (error) {
      console.error('[Analytics] Ошибка получения задач:', error);
      return [];
    }
  }

  /**
   * Фильтрует задачи по критериям
   */
  filterIssues(issues) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayIssues = issues.filter(issue => {
      const createdAt = new Date(issue.createdAt);
      return createdAt >= today;
    });

    const completedStatuses = ['Done', 'Resolved', 'Closed', 'Завершено', 'Выполнено'];
    const completedIssues = issues.filter(issue =>
      completedStatuses.includes(issue.status) ||
      completedStatuses.includes(issue.issueStatusId)
    );

    const activeIssues = issues.filter(issue =>
      !completedStatuses.includes(issue.status) &&
      !completedStatuses.includes(issue.issueStatusId)
    );

    return { todayIssues, completedIssues, activeIssues };
  }

    /**
     * Компактифицирует taskTypeWeights: сохраняет weight, суммирует counts и statusCounts.
     * Неизвестные typeId (из issues), которых нет в existingWeights, добавляются в 'other' (count += 1).
     *
     * @param {Array} existingWeights - исходные taskTypeWeights из события
     * @param {Array} issues - список найденных issues для сотрудника
     * @returns {Array} компактный массив: [{ typeId, weight, count, statusCounts: { statusId: count } }, ...]
     */
    compactTaskTypeWeights(existingWeights = [], issues = []) {
        const map = new Map();

        // Инициализируем из существующих весов: берем weight и существующие count/statusWeights
        for (const tw of existingWeights) {
            const statusCounts = {};
            if (Array.isArray(tw.statusWeights)) {
                for (const sw of tw.statusWeights) {
                    if (sw.count) statusCounts[String(sw.statusId)] = (statusCounts[String(sw.statusId)] || 0) + sw.count;
                }
            }
            map.set(String(tw.typeId), {
                typeId: String(tw.typeId),
                weight: typeof tw.weight === 'number' ? tw.weight : 1,
                count: typeof tw.count === 'number' ? tw.count : 0,
                statusCounts
            });
        }

        // Убедимся, что есть запись 'other'
        if (!map.has('other')) {
            map.set('other', {typeId: 'other', weight: 1, count: 0, statusCounts: {}});
        }

        // Проходим по issues и аккумулируем
        for (const issue of issues || []) {
            const typeId = issue.typeId ? String(issue.typeId) : 'other';
            const statusId = issue.issueStatusId ? String(issue.issueStatusId) : (issue.status ? String(issue.status) : 'unknown');

            if (!map.has(typeId)) {
                // неизвестный тип — увеличиваем other вместо создания полного нового элемента
                const other = map.get('other');
                other.count += 1;
                other.statusCounts[statusId] = (other.statusCounts[statusId] || 0) + 1;
            } else {
                const entry = map.get(typeId);
                entry.count += 1;
                entry.statusCounts[statusId] = (entry.statusCounts[statusId] || 0) + 1;
            }
        }

        // Преобразуем в компактный массив и сортируем по count (необязательно)
        const compact = Array.from(map.values())
            .map(e => ({
                typeId: e.typeId,
                weight: e.weight,
                count: e.count,
                statusCounts: e.statusCounts
            }))
            .sort((a, b) => (b.count || 0) - (a.count || 0));

        return compact;
    }

  /**
   * Корректирует лимиты для нового сотрудника
   */
  adjustLimitsForNewEmployee(limits, completedCount, historicalCompletedCount) {
    const isNewEmployee = completedCount < 5 || historicalCompletedCount < 10;

    if (isNewEmployee) {
      console.log('[Analytics] 👶 Обнаружен новый сотрудник, корректируем лимиты');

      return {
        ...limits,
        maxDailyIssues: Math.floor((limits.maxDailyIssues || 30) * 0.6),
        maxActiveIssues: Math.floor((limits.maxActiveIssues || 30) * 0.5),
        preferredLoadPercent: (limits.preferredLoadPercent || 80) * 0.7
      };
    }

    return limits;
  }

  /**
   * Рассчитывает вес сотрудника по формуле
   */
  calculateEmployeeWeight(params) {
    const {
      taskTypeWeights,
      loadCalculationFormula,
      defaultMaxLoad,
      priorityMultiplier,
      limits,
      activeTasksCount
    } = params;

    try {
      // Рассчитываем сумму весов задач
      let taskWeightsSum = 0;

      taskTypeWeights.forEach(typeWeight => {
        const typeTotal = math.multiply(typeWeight.weight, typeWeight.count || 0);

        // Учитываем веса статусов
        if (typeWeight.statusWeights && typeWeight.statusWeights.length > 0) {
          typeWeight.statusWeights.forEach(statusWeight => {
            const statusTotal = math.multiply(
              statusWeight.weight,
              statusWeight.count || 0
            );
            taskWeightsSum = math.add(taskWeightsSum, statusTotal);
          });
        } else {
          taskWeightsSum = math.add(taskWeightsSum, typeTotal);
        }
      });

      // Базовый расчёт веса
      const maxLoad = defaultMaxLoad || 100;
      let baseWeight = math.divide(taskWeightsSum, maxLoad);

      // Применяем приоритетный множитель
      baseWeight = math.multiply(baseWeight, priorityMultiplier || 1);

      // Учитываем лимиты
      const loadPercent = math.divide(
        activeTasksCount,
        limits.maxActiveIssues || 30
      );

      // Корректируем вес на основе загрузки
      const loadMultiplier = math.min(
        2,
        math.max(0.5, math.divide(loadPercent, 0.8))
      );

      const finalWeight = math.multiply(baseWeight, loadMultiplier);

      console.log(`[Analytics] 🧮 Расчёт веса: taskSum=${taskWeightsSum}, base=${baseWeight}, load=${loadPercent}, final=${finalWeight}`);

      return math.round(finalWeight, 3);

    } catch (error) {
      console.error('[Analytics] Ошибка расчёта веса:', error);
      return 0;
    }
  }

  /**
   * Сохраняет данные в Redis
   */
  async saveToRedis(data, ttl = 14400) {

    try {
      const { departmentObjectId, accountId, assigneeEmail } = data;

      // Формируем ключ по указанному формату
      const key = `Department:${departmentObjectId}:${accountId}:${assigneeEmail}`;

      // Сохраняем с TTL
      await redisClient.setex(
        key,
        ttl,
        JSON.stringify(data)
      );

      // Дополнительно сохраняем вес сотрудника
      const weightKey = `employee:weight:${accountId}`;
      await redisClient.setex(
        weightKey,
        ttl,
        String(data.calculatedWeight)
      );

      console.log(`[Analytics] 💾 Сохранено в Redis: ${key}, TTL=${ttl}s`);

    } catch (error) {
      console.error('[Analytics] Ошибка сохранения в Redis:', error);
      throw error;
    }
  }

  /**
   * Получает вес сотрудника из Redis
   */
  async getEmployeeWeight(accountId) {
    try {
      const key = `employee:weight:${accountId}`;
      const weight = await redisClient.get(key);
      return weight ? parseFloat(weight) : null;
    } catch (error) {
      console.error('[Analytics] Ошибка получения веса:', error);
      return null;
    }
  }
}

export default new AnalyticsService();
