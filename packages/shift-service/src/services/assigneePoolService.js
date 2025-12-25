// services/assigneePoolService.js
import redis from '../models/redisClient.js';
import moment from "moment-timezone";
import WorkScheduleService from "./workScheduleService.js";
import {models} from "../models/db.js";




class AssigneePoolService {
  constructor() {
    this.keyPrefix = 'department:';
    this.DEFAULT_TTL = 9 * 60 * 60; // 9 часа по умолчанию
  }

  /**
   * Добавление сотрудника в пул с автоматическим TTL
   * @param {String} department - Название отдела
   * @param {String} accountId - ID сотрудника
   * @param {Number} ttlSeconds - Время жизни в секундах
   * @param {Object} metadata - Дополнительные метаданные
   * @returns {Promise<Boolean>} - Результат операции
   */
  async addAssignee(department, accountId, ttlSeconds = this.DEFAULT_TTL, metadata = {}) {
    const key = `${this.keyPrefix}${department}:${accountId}`;
    const now = Date.now();

    try {
      // Проверяем существование
      const exists = await this.hasAssignee(department, accountId);
      if (exists) {
        return await this.updateAssigneeTTL(department, accountId, ttlSeconds, metadata);
      }

      const value = JSON.stringify({
        addedAt: now,
        department,
        accountId,
        ttlSeconds,
        expiresAt: now + (ttlSeconds * 1000),
        ...metadata
      });

      // Используем обычный set
      await redis.set(key, value);
      await redis.expire(key, ttlSeconds);

      console.log(`Сотрудник ${accountId} добавлен в пул ${department} на ${ttlSeconds} секунд`);
      return true;
    } catch (error) {
      console.error(`Ошибка при добавлении в пул: ${error.message}`);
      return false;
    }
  }

  /**
   * Удаление сотрудника из пула
   */
  async removeAssignee(department, accountId) {
    const key = `${this.keyPrefix}${department}:${accountId}`;
    try {
      await redis.del(key);

      console.log(`Сотрудник ${accountId} удален из пула ${department}`);
      return true;
    } catch (error) {
      console.error(`Ошибка при удалении из пула: ${error.message}`);
      return false;
    }
  }

  /**
   * Проверка наличия сотрудника в пуле
   */
  async hasAssignee(department, accountId) {
    const key = `${this.keyPrefix}${department}:${accountId}`;
    try {
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.error(`Ошибка при проверке сотрудника в пуле: ${error.message}`);
      return false;
    }
  }

  /**
   * Массовое добавление сотрудников в пул
   * @param {String} department - Название отдела
   * @param {Array} assignees - Массив объектов {accountId, ttl, metadata}
   * @returns {Promise<Object>} - Статистика операции
   */
  async bulkAddAssignees(department, assignees) {
    const stats = {
      total: assignees.length,
      added: 0,
      failed: 0
    };

    const pipeline = redis.pipeline();

    try {
      for (const item of assignees) {
        const { accountId, ttl = this.DEFAULT_TTL, metadata = {} } = item;
        const key = `${this.keyPrefix}${department}:${accountId}`;
        const now = Date.now();

        const value = JSON.stringify({
          addedAt: now,
          department,
          accountId,
          ttlSeconds: ttl,
          expiresAt: now + (ttl * 1000),
          ...metadata
        });

        pipeline.set(key, value);
        pipeline.expire(key, ttl);
      }

      await pipeline.exec();
      stats.added = assignees.length;

      console.log(`Массово добавлено ${stats.added} сотрудников в пул ${department}`);

      return stats;
    } catch (error) {
      console.error(`Ошибка при массовом добавлении в пул: ${error.message}`);
      stats.failed = assignees.length;
      stats.added = 0;

      return stats;
    }
  }

  /**
 * Очистка пула определенного отдела
 * @param {String} department - Название отдела
 * @returns {Promise<Number>} - Количество удаленных записей
 */
  async clearDepartmentPool(department) {
    const pattern = `${this.keyPrefix}${department}:*`;

    try {
      const keys = await redis.keys(pattern);
      if (!keys.length) return 0;

      const result = await redis.del(keys);

      console.log(`Очищен пул отдела ${department}, удалено ${result} записей`);

      return result;
    } catch (error) {
      console.error(`Ошибка при очистке пула отдела: ${error.message}`);
      return 0;
    }
  }

  /**
   * Получение всех сотрудников в пуле отдела
   */
  async getPoolAssignees() {
    // Получаем все ключи для отдела
    const keys = await redis.keys(`*`);
    // Извлекаем только accountId из ключа
    return keys.map(key => key.split(':').slice(-2).join(':'));
  }

  /**
   * Получение всех сотрудников в пуле отдела с их данными
   * @param {String} department - Название отдела
   * @returns {Promise<Array>} - Массив сотрудников с данными
   */
  async getAllAssigneesInDepartment(department) {
    const pattern = `${this.keyPrefix}${department}:*`;

    try {
      const keys = await redis.keys(pattern);
      if (!keys.length) return [];

      const result = [];

      for (const key of keys) {
        const data = await redis.get(key);
        if (!data) continue;

        const ttl = await redis.ttl(key);
        const accountId = key.split(':').slice(-2).join(':');

        try {
          const parsedData = JSON.parse(data);
          result.push({
            ...parsedData,
            accountId,
            remainingTTL: ttl
          });
        } catch (e) {
          console.warn(`Невозможно распарсить данные для ключа ${key}`);
        }
      }

      return result;
    } catch (error) {
      console.error(`Ошибка при получении сотрудников отдела: ${error.message}`);
      return [];
    }
  }

  /**
  * Получение данных сотрудника из пула
  * @param {String} department - Название отдела
  * @param {String} accountId - ID сотрудника
  * @returns {Promise<Object|null>} - Данные сотрудника или null
  */
  async getAssignee(department, accountId) {
    const key = `${this.keyPrefix}${department}:${accountId}`;

    try {
      const data = await redis.get(key);
      if (!data) return null;

      const ttl = await redis.ttl(key);
      const parsedData = JSON.parse(data);

      return {
        ...parsedData,
        remainingTTL: ttl
      };
    } catch (error) {
      console.error(`Ошибка при получении данных сотрудника: ${error.message}`);
      return null;
    }
  }

  /**
 * Обновляет TTL и метаданные для существующего ключа
 * @param {String} department - Название отдела
 * @param {String} accountId - ID сотрудника
 * @param {Number} ttlSeconds - Новое время жизни ключа в секундах
 * @param {Object} metadata - Новые метаданные (будут объединены с существующими)
 * @returns {Promise<Boolean>} - Результат операции
 */
  async updateAssigneeTTL(department, accountId, ttlSeconds, metadata = {}) {
    const key = `${this.keyPrefix}${department}:${accountId}`;

    try {
      // Проверяем существование ключа
      const exists = await redis.exists(key);
      if (!exists) {
        console.warn(`Ключ ${key} не найден для обновления`);
        return false;
      }

      // Получаем текущие метаданные
      const currentValue = await redis.get(key);
      let currentData = {};

      try {
        currentData = JSON.parse(currentValue);
      } catch (e) {
        console.warn(`Невозможно распарсить данные для ключа ${key}: ${e.message}`);
      }

      // Объединяем существующие метаданные с новыми
      const updatedData = {
        ...currentData,
        ...metadata,
        updatedAt: Date.now()
      };

      // Обновляем значение
      await redis.set(key, JSON.stringify(updatedData));

      // Обновляем TTL
      await redis.expire(key, ttlSeconds);

      console.log(`Обновлен TTL для сотрудника ${accountId} в пуле ${department} на ${ttlSeconds} секунд`);

      return true;
    } catch (error) {
      console.error(`Ошибка при обновлении TTL: ${error.message}`);
      return false;
    }
  }

  /**
 * Обновляет пул сотрудников на основе расписания на следующий день
 * @param {String} department - Название отдела для обновления пула
 * @param {Object} options - Дополнительные параметры
 * @returns {Promise<Object>} - Статистика обновления
 */
  async updatePoolBasedOnSchedule(department, options = {}) {
    try {
      const {
        date = new Date(), // По умолчанию сегодня
        daysInFuture = 1,  // По умолчанию на следующий день
        onlyActive = true  // По умолчанию только активные сотрудники
      } = options;
      // Получаем текущую дату и время в Ташкентской временной зоне
      const currentDate = moment(date).tz("Asia/Tashkent");

      // Вычисляем целевую дату (следующий день)
      const targetDate = moment(date).tz("Asia/Tashkent").add(daysInFuture, 'days');

      // Получаем день недели для целевой даты (0-воскресенье, ..., 6-суббота)
      const targetDayOfWeek = targetDate.day();

      console.log(`[WorkScheduleService] Обновление пула ${department} для ${targetDate.format('DD.MM.YYYY')} (день недели: ${targetDayOfWeek})`);

      // Получаем всех сотрудников, которые работают в этот день недели
      const workScheduleService = new WorkScheduleService(models);
      const assignees = await workScheduleService.getWorkingAssigneesForDay(targetDayOfWeek, { onlyActive });

      if (!assignees.length) {
        console.log(`[WorkScheduleService] Нет сотрудников, работающих в ${targetDate.format('DD.MM.YYYY')}`);
        return { added: 0, updated: 0, total: 0 };
      }

      console.log(`[WorkScheduleService] Найдено ${assignees.length} сотрудников для обновления пула`);

      let stats = { added: 0, updated: 0, total: assignees.length };

      // Для каждого сотрудника рассчитываем TTL и обновляем/добавляем в пул
      for (const assignee of assignees) {
        // Парсим время начала и окончания смены
        const [startHour, startMinute] = assignee.shift.startTime.split(':').map(Number);
        const [endHour, endMinute] = assignee.shift.endTime.split(':').map(Number);

        // Устанавливаем время окончания смены для целевой даты
        const shiftEndTime = moment(targetDate)
          .hour(endHour)
          .minute(endMinute)
          .second(0);

        // Рассчитываем TTL в секундах от текущего момента до окончания смены
        const ttlSeconds = Math.max(
          0,
          Math.floor((shiftEndTime - currentDate) / 1000)
        );

        // Проверяем, что TTL положительный (смена ещё не закончилась)
        if (ttlSeconds <= 0) {
          console.log(`[WorkScheduleService] Пропускаем ${assignee.assigneeName} - смена уже завершилась`);
          continue;
        }

        // Подготавливаем метаданные
        const metadata = {
          assigneeName: assignee.assigneeName,
          shiftStart: assignee.shift.startTime,
          shiftEnd: assignee.shift.endTime,
          dayOfWeek: targetDayOfWeek,
          targetDate: targetDate.format('YYYY-MM-DD')
        };

        // Проверяем, есть ли сотрудник уже в пуле
        const isInPool = await this.hasAssignee(department, assignee.accountId);

        if (isInPool) {
          // Обновляем TTL и метаданные
          await this.updateAssigneeTTL(
            department,
            assignee.accountId,
            ttlSeconds,
            metadata
          );
          stats.updated++;
          console.log(`[WorkScheduleService] Обновлен TTL для ${assignee.assigneeName} на ${ttlSeconds} секунд`);
        } else {
          // Добавляем сотрудника в пул
          await this.addAssignee(
            department,
            assignee.accountId,
            ttlSeconds,
            metadata
          );
          stats.added++;
          console.log(`[WorkScheduleService] Добавлен ${assignee.assigneeName} в пул на ${ttlSeconds} секунд`);
        }
      }

      console.log(`[WorkScheduleService] Завершено обновление пула: добавлено ${stats.added}, обновлено ${stats.updated}`);

      return stats;
    } catch (error) {
      console.error(`[WorkScheduleService] Ошибка при обновлении пула: ${error.message}`);
      throw error;
    }
  }
}

export default new AssigneePoolService();