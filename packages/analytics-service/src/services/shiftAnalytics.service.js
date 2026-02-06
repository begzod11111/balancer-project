import { redisClient } from '../config/redis.js';
import { create, all } from 'mathjs';
import { models } from "../models/db.js";
import Issue from '../models/issue.model.js'; // ✅ Добавьте модель Issue

const math = create(all);

export class ShiftAnalyticsService {
  /**
   * Обработка события создания смены
   */
  async processShiftCreated(shiftData) {
    try {
      console.log(`[Analytics] 📊 Начало обработки смены для ${shiftData.assigneeEmail}`);

      const { departmentObjectId, assigneeAccountId, assigneeEmail } = shiftData;

      // ✅ Параллельные запросы для ускорения
      const [assigneeTasks, departmentShifts] = await Promise.all([
        this.getAssigneeTasks(assigneeAccountId),
        this.getAllDepartmentShifts(departmentObjectId)
      ]);

      console.log(`[Analytics] 📋 Найдено задач у сотрудника: ${assigneeTasks.length}`);
      console.log(`[Analytics] 👥 Найдено смен в отделе: ${departmentShifts.length}`);

      // Рассчитываем статистику задач сотрудника
      const taskStats = this.calculateTaskStats(assigneeTasks, shiftData.taskTypeWeights || []);

      // Рассчитываем статистику по отделу
      const departmentStats = this.calculateDepartmentStats(departmentShifts);

      // Рассчитываем вес сотрудника относительно отдела
      const employeeWeight = this.calculateEmployeeWeight(taskStats, departmentStats);

      // Формируем обогащённые данные смены
      const enrichedShift = {
        ...shiftData,
        assigneeTasks: assigneeTasks.map(t => t.issueKey), // Сохраняем только ключи задач
        taskTypeWeights: taskStats.typeWeights,
        completedTasksCount: taskStats.completedCount,
        activeTasksCount: taskStats.activeCount,
        totalTasksCount: taskStats.totalCount,
        totalWeight: taskStats.totalWeight,
        employeeWeight: math.round(employeeWeight, 2), // ✅ Округление через mathjs
        departmentTotalLoad: departmentStats.totalLoad,
        departmentAverageLoad: math.round(departmentStats.averageLoad, 2),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Сохраняем в Redis
      await this.saveToRedis(enrichedShift);

      console.log(`[Analytics] ✅ Смена обработана для ${assigneeEmail}`);
      console.log(`[Analytics] 📈 Статистика: ${taskStats.totalCount} задач, вес: ${employeeWeight.toFixed(2)}%`);

      return enrichedShift;
    } catch (error) {
      console.error('[Analytics] ❌ Ошибка обработки смены:', error);
      throw error;
    }
  }

    /**
     * Получает все задачи сотрудника из MongoDB за последние 10 дней
     */
    async getAssigneeTasks(assigneeAccountId) {
        try {
            const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

            const tasks = await models.Issue.find({
                assigneeAccountId,
                // ✅ Все задачи, созданные или обновлённые за последние 10 дней
                $or: [
                    {createdAt: {$gte: tenDaysAgo}},
                    {updatedAt: {$gte: tenDaysAgo}}
                ]
            })
                .select('issueKey typeId issueStatusId status createdAt updatedAt')
                .lean()
                .exec();

            console.log(`[Analytics] 📋 Найдено задач за последние 10 дней: ${tasks.length}`);
            return tasks;
        } catch (error) {
            console.error('[Analytics] ❌ Ошибка получения задач:', error);
            return [];
        }
    }


  /**
   * Получает все смены отдела через SCAN (быстрее чем KEYS)
   */
  async getAllDepartmentShifts(departmentObjectId) {
    try {
      const pattern = `Department:${departmentObjectId}:*`;
      const shifts = [];
      let cursor = '0';

      // ✅ SCAN вместо KEYS для больших объёмов данных
      do {
        const [nextCursor, keys] = await redisClient.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );

        cursor = nextCursor;

        // Параллельно получаем данные по всем ключам
        if (keys.length > 0) {
          const pipeline = redisClient.pipeline();
          keys.forEach(key => pipeline.smembers(key));
          const results = await pipeline.exec();

          for (const [err, members] of results) {
            if (!err && members) {
              shifts.push(...members.map(m => JSON.parse(m)));
            }
          }
        }
      } while (cursor !== '0');

      return shifts;
    } catch (error) {
      console.error('[Analytics] ❌ Ошибка получения смен отдела:', error);
      return [];
    }
  }

  /**
   * Рассчитывает статистику по задачам с использованием весов из конфигурации
   */
  calculateTaskStats(tasks, taskTypeWeights) {
    const typeMap = new Map();
    let completedCount = 0;
    let activeCount = 0;
    let totalWeight = 0;

    // Создаём индекс весов для быстрого поиска
    const weightIndex = new Map();
    for (const typeWeight of taskTypeWeights) {
      weightIndex.set(typeWeight.typeId, {
        weight: typeWeight.weight || 1.0,
        statusWeights: new Map(
          (typeWeight.statusWeights || []).map(sw => [sw.statusId, sw.weight || 1.0])
        )
      });
    }

    for (const task of tasks) {
      const isCompleted = ['Closed', 'Done', 'Resolved'].includes(task.issueStatusId);

      if (isCompleted) {
        completedCount++;
      } else {
        activeCount++;
      }

      // Получаем веса из конфигурации
      const typeConfig = weightIndex.get(task.typeId) || { weight: 1.0, statusWeights: new Map() };
      const statusWeight = typeConfig.statusWeights.get(task.status) || 1.0;

      // ✅ Расчёт веса через mathjs
      const taskWeight = math.multiply(typeConfig.weight, statusWeight);
      totalWeight = math.add(totalWeight, taskWeight);

      // Группировка по типам
      const typeId = task.typeId || 'unknown';

      if (!typeMap.has(typeId)) {
        typeMap.set(typeId, {
          typeId,
          name: task.typeName || 'Unknown Type',
          count: 0,
          weight: typeConfig.weight,
          statusWeights: []
        });
      }

      const typeData = typeMap.get(typeId);
      typeData.count++;

      // Добавляем статус
      const existingStatus = typeData.statusWeights.find(s => s.statusId === task.status);
      if (!existingStatus) {
        typeData.statusWeights.push({
          statusId: task.status,
          statusName: task.issueStatusId,
          weight: statusWeight,
          count: 1
        });
      } else {
        existingStatus.count++;}
    }

    return {
      typeWeights: Array.from(typeMap.values()),
      completedCount,
      activeCount,
      totalCount: tasks.length,
      totalWeight: math.round(totalWeight, 2)
    };
  }

  /**
   * Рассчитывает статистику по отделу
   */
  calculateDepartmentStats(departmentShifts) {
    let totalLoad = 0;
    let totalWeight = 0;

    for (const shift of departmentShifts) {
      totalLoad = math.add(totalLoad, shift.totalTasksCount || 0);
      totalWeight = math.add(totalWeight, shift.totalWeight || 0);
    }

    return {
      totalLoad,
      totalWeight,
      employeeCount: departmentShifts.length,
      averageLoad: departmentShifts.length > 0 ? math.divide(totalLoad, departmentShifts.length) : 0
    };
  }

  /**
   * Рассчитывает вес сотрудника относительно отдела
   */
  calculateEmployeeWeight(taskStats, departmentStats) {
    if (departmentStats.totalWeight === 0) return 0;

    // ✅ Расчёт через mathjs: (вес сотрудника / общий вес отдела) * 100
    return math.multiply(
      math.divide(taskStats.totalWeight, departmentStats.totalWeight),
      100
    );
  }

  /**
   * Сохраняет смену в Redis
   */
  async saveToRedis(shiftData) {
    try {
      const key = `Department:${shiftData.departmentObjectId}:${shiftData.assigneeEmail}`;

      await redisClient.sadd(key, JSON.stringify(shiftData));
      await redisClient.expire(key, 30 * 24 * 60 * 60);

      console.log(`[Analytics] 💾 Добавлено в Redis: ${key}`);
    } catch (error) {
      console.error('[Analytics] ❌ Ошибка сохранения в Redis:', error);
      throw error;
    }
  }

  /**
   * Получает все смены сотрудника
   */
  async getShiftsByEmail(email) {
    try {
      const pattern = `Department:*:${email}`;
      const shifts = [];
      let cursor = '0';

      do {
        const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          const pipeline = redisClient.pipeline();
          keys.forEach(key => pipeline.smembers(key));
          const results = await pipeline.exec();

          for (const [err, members] of results) {
            if (!err && members) {
              shifts.push(...members.map(m => JSON.parse(m)));
            }
          }
        }
      } while (cursor !== '0');

      shifts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return shifts;
    } catch (error) {
      console.error('[Analytics] ❌ Ошибка получения смен:', error);
      return [];
    }
  }

  async getShiftsByDepartment(departmentObjectId) {
    return this.getAllDepartmentShifts(departmentObjectId);
  }

  async deleteShift(email, shiftId) {
    try {
      const pattern = `Department:*:${email}`;
      let cursor = '0';

      do {
        const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        for (const key of keys) {
          const members = await redisClient.smembers(key);
          const toRemove = members.find(item => {
            const shift = JSON.parse(item);
            return shift.shiftStartTime === shiftId || shift.createdAt === shiftId;
          });

          if (toRemove) {
            await redisClient.srem(key, toRemove);
            console.log(`[Analytics] 🗑️ Удалена смена из ${key}`);
            return true;
          }
        }
      } while (cursor !== '0');

      return false;
    } catch (error) {
      console.error('[Analytics] ❌ Ошибка удаления смены:', error);
      throw error;
    }
  }

  async getEmployeeStats(email, startDate, endDate) {
    try {
      const shifts = await this.getShiftsByEmail(email);

      const filtered = shifts.filter(shift => {
        const shiftDate = new Date(shift.createdAt);
        return shiftDate >= new Date(startDate) && shiftDate <= new Date(endDate);
      });

      const totalTasks = filtered.reduce((sum, shift) => math.add(sum, shift.totalTasksCount || 0), 0);
      const completedTasks = filtered.reduce((sum, shift) => math.add(sum, shift.completedTasksCount || 0), 0);
      const averageWeight = math.divide(
        filtered.reduce((sum, shift) => math.add(sum, shift.employeeWeight || 0), 0),
        filtered.length || 1
      );

      return {
        shiftsCount: filtered.length,
        totalTasks,
        completedTasks,
        activeTasksCount: math.subtract(totalTasks, completedTasks),
        averageWeight: math.round(averageWeight, 2)
      };
    } catch (error) {
      console.error('[Analytics] ❌ Ошибка получения статистики сотрудника:', error);
      throw error;
    }
  }
}

export default new ShiftAnalyticsService();
