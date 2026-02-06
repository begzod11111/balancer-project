import { redisClient } from '../config/redis.js';
import { create, all } from 'mathjs';
import { models } from "../models/db.js";

const math = create(all);

export class ShiftAnalyticsService {
  async processShiftCreated(shiftData) {
    try {
      console.log(`[Analytics] 📊 Начало обработки смены для ${shiftData.assigneeEmail}`);

      const { departmentObjectId, assigneeAccountId, assigneeEmail } = shiftData;

      // ✅ Параллельные запросы
      const [assigneeTasks, departmentShifts] = await Promise.all([
        this.getAssigneeTasks(assigneeAccountId),
        this.getAllDepartmentShifts(departmentObjectId)
      ]);

      console.log(`[Analytics] 📋 Найдено задач у сотрудника: ${assigneeTasks.length}`);
      console.log(`[Analytics] 👥 Найдено смен в отделе: ${departmentShifts.length}`);

      // 1️⃣ Рассчитываем базовую статистику по задачам
      const taskStats = this.calculateTaskStats(assigneeTasks, shiftData.taskTypeWeights || []);

      // 2️⃣ Рассчитываем вес сотрудника с учётом лимитов
      const employeeBaseWeight = this.calculateEmployeeBaseWeight(taskStats, shiftData.limits || {});

      // 3️⃣ Рассчитываем статистику отдела
      const departmentStats = this.calculateDepartmentStats(departmentShifts);

      // 4️⃣ Рассчитываем относительный вес среди коллег
      const relativeWeight = this.calculateRelativeWeight(
        employeeBaseWeight,
        taskStats,
        departmentStats
      );

      const enrichedShift = {
        ...shiftData,
        assigneeTasks: assigneeTasks.map(t => t.issueKey),
        taskTypeWeights: taskStats.typeWeights,
        completedTasksCount: taskStats.completedCount,
        activeTasksCount: taskStats.activeCount,
        totalTasksCount: taskStats.totalCount,
        totalWeight: taskStats.totalWeight,
        employeeBaseWeight: math.round(employeeBaseWeight, 2),
        employeeWeight: math.round(relativeWeight, 2),
        departmentTotalLoad: departmentStats.totalLoad,
        departmentTotalWeight: departmentStats.totalWeight,
        departmentAverageWeight: math.round(departmentStats.averageWeight, 2),
        departmentEmployeeCount: departmentStats.employeeCount,
        loadPercent: this.calculateLoadPercent(taskStats, shiftData.limits || {}),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.saveToRedis(enrichedShift);

      console.log(`[Analytics] ✅ Смена обработана для ${assigneeEmail}`);
      console.log(`[Analytics] 📈 Задач: ${taskStats.totalCount}, базовый вес: ${employeeBaseWeight.toFixed(2)}, относительный: ${relativeWeight.toFixed(2)}%`);
      console.log(`[Analytics] 👥 Отдел: ${departmentStats.employeeCount} человек, средний вес: ${departmentStats.averageWeight.toFixed(2)}`);

      return enrichedShift;
    } catch (error) {
      console.error('[Analytics] ❌ Ошибка обработки смены:', error);
      throw error;
    }
  }

  /**
   * Получает все задачи сотрудника из MongoDB
   */
  async getAssigneeTasks(assigneeAccountId) {
    try {
      console.log(`[Analytics] 🔍 Поиск задач для accountId: ${assigneeAccountId}`);

      const tasks = await models.Issue.find({
        assigneeAccountId,
      })
        .select('issueKey typeId issueStatusId status createdAt updatedAt')
        .lean()
        .exec();

      console.log(`[Analytics] 📋 Найдено задач: ${tasks.length}`);

      if (tasks.length > 0) {
        console.log('[Analytics] 🔍 Пример задачи:', {
          issueKey: tasks[0].issueKey,
          typeId: tasks[0].typeId,
          status: tasks[0].status,
          issueStatusId: tasks[0].issueStatusId
        });
      }

      return tasks;
    } catch (error) {
      console.error('[Analytics] ❌ Ошибка получения задач:', error);
      return [];
    }
  }

  /**
   * ✅ ИСПРАВЛЕНО: Получает все смены отдела через SCAN
   */
  async getAllDepartmentShifts(departmentObjectId) {
    try {
      const pattern = `Department:${departmentObjectId}:*`;
      const shifts = [];
      let cursor = '0';

      console.log(`[Analytics] 🔍 Поиск смен по паттерну: ${pattern}`);

      do {
        const [nextCursor, keys] = await redisClient.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );

        cursor = nextCursor;

        console.log(`[Analytics] 🔑 Найдено ключей: ${keys.length}`, keys);

        if (keys.length > 0) {
          // ✅ ИСПРАВЛЕНИЕ: используем GET вместо SMEMBERS
          const pipeline = redisClient.pipeline();
          keys.forEach(key => pipeline.get(key));
          const results = await pipeline.exec();

          for (const [err, data] of results) {
            if (!err && data) {
              try {
                const shift = JSON.parse(data);
                shifts.push(shift);
              } catch (parseErr) {
                console.error('[Analytics] ❌ Ошибка парсинга смены:', parseErr);
              }
            }
          }
        }
      } while (cursor !== '0');

      console.log(`[Analytics] 📊 Загружено смен из отдела: ${shifts.length}`);

      return shifts;
    } catch (error) {
      console.error('[Analytics] ❌ Ошибка получения смен отдела:', error);
      return [];
    }
  }

  /**
   * ✅ Рассчитывает статистику по задачам (fallback = 1.0)
   */
  calculateTaskStats(tasks, taskTypeWeights) {
    const typeMap = new Map();
    let completedCount = 0;
    let activeCount = 0;
    let totalWeight = 0;

    // Создаём индекс весов
    const weightIndex = new Map();
    for (const typeWeight of taskTypeWeights) {
      const statusWeightsMap = new Map();

      for (const sw of (typeWeight.statusWeights || [])) {
        statusWeightsMap.set(sw.statusId, sw.weight || 1.0);
      }

      weightIndex.set(typeWeight.typeId, {
        weight: typeWeight.weight || 1.0,
        name: typeWeight.name || 'Unknown Type',
        statusWeights: statusWeightsMap
      });
    }

    for (const task of tasks) {
      const isCompleted = ['Closed', 'Done', 'Resolved'].includes(task.issueStatusId);

      if (isCompleted) {
        completedCount++;
      } else {
        activeCount++;
      }

      // ✅ Получаем веса из конфигурации с fallback = 1.0
      const typeConfig = weightIndex.get(task.typeId);

      let typeWeight = 1.0;
      let typeName = 'Unknown Type';
      let statusWeight = 1.0;

      if (typeConfig) {
        typeWeight = typeConfig.weight;
        typeName = typeConfig.name;
        statusWeight = typeConfig.statusWeights.get(task.status) || 1.0;
      }

      // ✅ Расчёт веса через mathjs
      const taskWeight = math.multiply(typeWeight, statusWeight);
      totalWeight = math.add(totalWeight, taskWeight);

      // Группировка по типам
      const typeId = task.typeId || 'unknown';

      if (!typeMap.has(typeId)) {
        typeMap.set(typeId, {
          typeId,
          name: typeName,
          count: 0,
          weight: typeWeight,
          statusWeights: []
        });
      }

      const typeData = typeMap.get(typeId);
      typeData.count++;

      const existingStatus = typeData.statusWeights.find(s => s.statusId === task.status);
      if (!existingStatus) {
        typeData.statusWeights.push({
          statusId: task.status,
          statusName: task.issueStatusId,
          weight: statusWeight,
          count: 1
        });
      } else {
        existingStatus.count++;
      }
    }

    console.log(`[Analytics] 🎯 Итоговый вес задач: ${totalWeight}`);

    return {
      typeWeights: Array.from(typeMap.values()),
      completedCount,
      activeCount,
      totalCount: tasks.length,
      totalWeight: math.round(totalWeight, 2)
    };
  }

  /**
   * ✅ Рассчитывает базовый вес сотрудника с учётом лимитов
   */
  calculateEmployeeBaseWeight(taskStats, limits) {
    const { maxDailyIssues = 30, maxActiveIssues = 30, preferredLoadPercent = 80 } = limits;

    try {
      // 1. Базовый вес по задачам (вес всех задач)
      const taskWeightScore = taskStats.totalWeight;

      // 2. Коэффициент загрузки по активным задачам (0-100)
      const activeLoadFactor = math.multiply(
        math.divide(taskStats.activeCount, maxActiveIssues),
        100
      );

      // 3. Коэффициент выполнения задач (0-100)
      const completionFactor = math.multiply(
        math.divide(taskStats.completedCount, maxDailyIssues),
        100
      );

      // 4. Текущая загрузка относительно предпочтительной
      const currentLoad = math.multiply(
        math.divide(taskStats.totalCount, math.add(maxDailyIssues, maxActiveIssues)),
        100
      );

      const loadMultiplier = math.divide(currentLoad, preferredLoadPercent);

      // ✅ Финальная формула базового веса:
      // BaseWeight = (taskWeight × 0.4 + activeLoad × 0.3 + completion × 0.2 + currentLoad × 0.1) × loadMultiplier
      const baseWeight = math.multiply(
        math.add(
          math.multiply(taskWeightScore, 0.4),
          math.multiply(activeLoadFactor, 0.3),
          math.multiply(completionFactor, 0.2),
          math.multiply(currentLoad, 0.1)
        ),
        loadMultiplier
      );

      console.log(`[Analytics] 📊 Расчёт базового веса:`);
      console.log(`  - Вес задач: ${math.round(taskWeightScore, 2)}`);
      console.log(`  - Загрузка по активным: ${math.round(activeLoadFactor, 2)}%`);
      console.log(`  - Выполнение задач: ${math.round(completionFactor, 2)}%`);
      console.log(`  - Текущая загрузка: ${math.round(currentLoad, 2)}%`);
      console.log(`  - Множитель загрузки: ${math.round(loadMultiplier, 2)}`);
      console.log(`  - Базовый вес: ${math.round(baseWeight, 2)}`);

      return baseWeight;
    } catch (error) {
      console.error('[Analytics] ❌ Ошибка расчёта базового веса:', error);
      return 0;
    }
  }

  /**
   * ✅ Рассчитывает статистику отдела (включая веса коллег)
   */
  calculateDepartmentStats(departmentShifts) {
    let totalLoad = 0;
    let totalWeight = 0;
    let totalEmployeeWeights = 0;
    let employeeCount = 0;

    for (const shift of departmentShifts) {
      totalLoad = math.add(totalLoad, shift.totalTasksCount || 0);
      totalWeight = math.add(totalWeight, shift.totalWeight || 0);

      // ✅ Считаем базовый вес каждого сотрудника
      if (shift.employeeBaseWeight) {
        totalEmployeeWeights = math.add(totalEmployeeWeights, shift.employeeBaseWeight);
        employeeCount++;
      }
    }

    const averageWeight = employeeCount > 0
      ? math.divide(totalEmployeeWeights, employeeCount)
      : 0;

    console.log(`[Analytics] 🏢 Статистика отдела:`);
    console.log(`  - Сотрудников: ${employeeCount}`);
    console.log(`  - Общий вес задач: ${totalWeight}`);
    console.log(`  - Средний вес сотрудника: ${math.round(averageWeight, 2)}`);
    console.log(`  - Общая нагрузка: ${totalLoad} задач`);

    return {
      totalLoad,
      totalWeight,
      totalEmployeeWeights,
      averageWeight,
      employeeCount,
      averageLoad: employeeCount > 0 ? math.divide(totalLoad, employeeCount) : 0
    };
  }

  /**
   * ✅ Рассчитывает относительный вес сотрудника среди коллег
   */
  calculateRelativeWeight(employeeBaseWeight, taskStats, departmentStats) {
    if (departmentStats.employeeCount === 0) {
      console.log('[Analytics] ⚠️ Нет коллег в отделе, относительный вес = базовый вес');
      return employeeBaseWeight;
    }

    if (departmentStats.totalEmployeeWeights === 0) {
      console.log('[Analytics] ⚠️ Общий вес отдела = 0, относительный вес = 0');
      return 0;
    }

    try {
      // ✅ Относительный вес = (вес сотрудника / общий вес отдела) × 100
      const relativeWeight = math.multiply(
        math.divide(employeeBaseWeight, departmentStats.totalEmployeeWeights),
        100
      );

      // ✅ Бонус за перегрузку (если вес > среднего)
      const overloadBonus = employeeBaseWeight > departmentStats.averageWeight
        ? math.multiply(
            math.divide(
              math.subtract(employeeBaseWeight, departmentStats.averageWeight),
              departmentStats.averageWeight
            ),
            10
          )
        : 0;

      const finalWeight = math.add(relativeWeight, overloadBonus);

      console.log(`[Analytics] 📊 Расчёт относительного веса:`);
      console.log(`  - Базовый вес сотрудника: ${math.round(employeeBaseWeight, 2)}`);
      console.log(`  - Общий вес отдела: ${math.round(departmentStats.totalEmployeeWeights, 2)}`);
      console.log(`  - Средний вес коллег: ${math.round(departmentStats.averageWeight, 2)}`);
      console.log(`  - Относительный вес: ${math.round(relativeWeight, 2)}%`);
      console.log(`  - Бонус за перегрузку: ${math.round(overloadBonus, 2)}%`);
      console.log(`  - Итоговый вес: ${math.round(finalWeight, 2)}%`);

      return finalWeight;
    } catch (error) {
      console.error('[Analytics] ❌ Ошибка расчёта относительного веса:', error);
      return employeeBaseWeight;
    }
  }

  /**
   * ✅ Рассчитывает процент загрузки относительно лимитов
   */
  calculateLoadPercent(taskStats, limits) {
    const { maxDailyIssues = 30, maxActiveIssues = 30 } = limits;

    try {
      const totalCapacity = math.add(maxDailyIssues, maxActiveIssues);
      return math.round(
        math.multiply(
          math.divide(taskStats.totalCount, totalCapacity),
          100
        ),
        2
      );
    } catch (error) {
      console.error('[Analytics] ❌ Ошибка расчёта загрузки:', error);
      return 0;
    }
  }

  async saveToRedis(shiftData) {
    try {
      const key = `Department:${shiftData.departmentObjectId}:${shiftData.assigneeAccountId}:${shiftData.assigneeEmail}`;
      const ttl = await redisClient.ttl(key);

      await redisClient.setex(key, ttl, JSON.stringify(shiftData));

      console.log(`[Analytics] 💾 Добавлено в Redis: ${key}`);
    } catch (error) {
      console.error('[Analytics] ❌ Ошибка сохранения в Redis:', error);
      throw error;
    }
  }

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
              for (const member of members) {
                try {
                  shifts.push(JSON.parse(member));
                } catch (parseErr) {
                  console.error('[Analytics] ❌ Ошибка парсинга:', parseErr);
                }
              }
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
