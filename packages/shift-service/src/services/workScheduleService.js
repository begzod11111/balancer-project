class WorkScheduleService {
  constructor(modelsRef, logger) {
    this.models = modelsRef;
  }

  /**
   * Создает новое расписание работы для сотрудника
   * @param {Object} scheduleData - Данные расписания
   * @returns {Promise<Object>} - Созданное расписание
   */
  async createWorkSchedule(scheduleData) {
    try {
      const newSchedule = new this.models.Shift(scheduleData);
        return await newSchedule.save();
    } catch (error) {
      console.error(`[WorkScheduleService] Ошибка при создании расписания: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получает расписание работы по ID
   * @param {String} scheduleId - ID расписания
   * @returns {Promise<Object>} - Найденное расписание
   */
  async getWorkScheduleById(scheduleId) {
    try {
      const schedule = await this.models.Shift.findById(scheduleId);
      if (!schedule) {
        throw new Error(`Расписание с ID ${scheduleId} не найдено`);
      }
      return schedule;
    } catch (error) {
      console.error(`[WorkScheduleService] Ошибка при получении расписания: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получает расписание работы по ID сотрудника
   * @param {String} assigneeId - ID сотрудника
   * @returns {Promise<Object>} - Найденное расписание
   */
  async getWorkScheduleByAssigneeId(assigneeId) {
    try {
      const schedule = await this.models.Shift.findOne({ assigneeId });
      if (!schedule) {
        throw new Error(`Расписание для сотрудника с ID ${assigneeId} не найдено`);
      }
      return schedule;
    } catch (error) {
      console.error(`[WorkScheduleService] Ошибка при получении расписания: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получает расписание работы по Jira accountId
   * @param {String} accountId - Jira accountId сотрудника
   * @returns {Promise<Object>} - Найденное расписание
   */
  async getWorkScheduleByAccountId(accountId) {
    try {
      const schedule = await this.models.Shift.findOne({ accountId });
      if (!schedule) {
        throw new Error(`Расписание для сотрудника с accountId ${accountId} не найдено`);
      }
      return schedule;
    } catch (error) {
      console.error(`[WorkScheduleService] Ошибка при получении расписания: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получает список всех расписаний с возможностью фильтрации
   * @param {Object} filter - Параметры фильтрации
   * @param {Object} options - Дополнительные параметры (сортировка, пагинация)
   * @returns {Promise<Array>} - Массив расписаний
   */
  async getAllWorkSchedules(filter = {}, options = {}) {
    try {
      const { sort = { updatedAt: -1 }, limit = 0, skip = 0 } = options;
      return await this.models.Shift.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);
    } catch (error) {
      console.error(`[WorkScheduleService] Ошибка при получении списка расписаний: ${error.message}`);
      throw error;
    }
  }

  /**
   * Обновляет расписание работы по ID
   * @param {String} scheduleId - ID расписания
   * @param {Object} updateData - Данные для обновления
   * @returns {Promise<Object>} - Обновленное расписание
   */
  async updateWorkSchedule(scheduleId, updateData) {
    try {
      const updatedSchedule = await this.models.Shift.findByIdAndUpdate(
        scheduleId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedSchedule) {
        throw new Error(`Расписание с ID ${scheduleId} не найдено`);
      }
      return updatedSchedule;
    } catch (error) {
      console.error(`[WorkScheduleService] Ошибка при обновлении расписания: ${error.message}`);
      throw error;
    }
  }

  /**
   * Обновляет смены для конкретного дня недели
   * @param {String} scheduleId - ID расписания
   * @param {Number} dayOfWeek - День недели (0-6)
   * @param {Object} shiftData - Данные смены (startTime, endTime)
   * @returns {Promise<Object>} - Обновленное расписание
   */
  async updateShiftForDay(scheduleId, dayOfWeek, shiftData) {
    try {
      if (dayOfWeek < 0 || dayOfWeek > 6) {
        throw new Error('День недели должен быть числом от 0 до 6');
      }

      const updateData = {
        [`shifts.${dayOfWeek}`]: shiftData
      };

      const updatedSchedule = await this.models.Shift.findByIdAndUpdate(
        scheduleId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedSchedule) {
        throw new Error(`Расписание с ID ${scheduleId} не найдено`);
      }
      return updatedSchedule;
    } catch (error) {
      console.error(`[WorkScheduleService] Ошибка при обновлении смены: ${error.message}`);
      throw error;
    }
  }

  /**
   * Обновляет лимиты для сотрудника
   * @param {String} scheduleId - ID расписания
   * @param {Object} limitsData - Новые значения лимитов
   * @returns {Promise<Object>} - Обновленное расписание
   */
  async updateLimits(scheduleId, limitsData) {
    try {
      const updatedSchedule = await this.models.Shift.findByIdAndUpdate(
        scheduleId,
        { limits: limitsData },
        { new: true, runValidators: true }
      );

      if (!updatedSchedule) {
        throw new Error(`Расписание с ID ${scheduleId} не найдено`);
      }

      return updatedSchedule;
    } catch (error) {
      console.error(`[WorkScheduleService] Ошибка при обновлении лимитов: ${error.message}`);
      throw error;
    }
  }

  /**
   * Удаляет расписание работы по ID
   * @param {String} scheduleId - ID расписания
   * @returns {Promise<Boolean>} - Результат операции
   */
  async deleteWorkSchedule(scheduleId) {
    try {
      const result = await this.models.Shift.findByIdAndDelete(scheduleId);

      if (!result) {
        throw new Error(`Расписание с ID ${scheduleId} не найдено`);
      }

      return true;
    } catch (error) {
      console.error(`[WorkScheduleService] Ошибка при удалении расписания: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получает список сотрудников, работающих в указанный день недели
   * @param {Number} dayOfWeek - День недели (0-воскресенье, 1-понедельник, ..., 6-суббота)
   * @param {Object} options - Дополнительные параметры поиска
   * @returns {Promise<Array>} - Массив сотрудников со сменами
   */
  async getWorkingAssigneesForDay(dayOfWeek, options = {}) {
    try {
      const {
        onlyActive = true,
        includeDetails = false,
        startTime = null,
        endTime = null
      } = options;

      // Проверяем корректность ввода
      if (dayOfWeek < 0 || dayOfWeek > 6) {
        throw new Error('День недели должен быть числом от 0 до 6');
      }

      // Базовый запрос
      const query = {
        [`shifts.${dayOfWeek}`]: { $exists: true }
      };

      // Добавляем фильтр по активности если нужно
      if (onlyActive) {
        query.isActive = true;
      }

      // Добавляем фильтры по времени если указаны
      if (startTime) {
        query[`shifts.${dayOfWeek}.startTime`] = startTime;
      }

      if (endTime) {
        query[`shifts.${dayOfWeek}.endTime`] = endTime;
      }

      // Получаем расписания сотрудников
      const workSchedules = await this.models.Shift.find(query);

      // Формируем результат
        return workSchedules.map(schedule => {
          const result = {
              assigneeId: schedule.assigneeId,
              accountId: schedule.accountId,
              assigneeName: schedule.assigneeName || "Неизвестный сотрудник",
              shift: schedule.shifts[dayOfWeek],
          };

          // Если нужны дополнительные данные
          if (includeDetails) {
              result.limits = schedule.limits;
              result.isActive = schedule.isActive;
          }

          return result;
      });
    } catch (error) {
      console.error(`[WorkScheduleService] Ошибка при получении сотрудников для дня ${dayOfWeek}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Устанавливает активность расписания
   * @param {String} scheduleId - ID расписания
   * @param {Boolean} isActive - Флаг активности
   * @returns {Promise<Object>} - Обновленное расписание
   */
  async setActiveStatus(scheduleId, isActive) {
    try {
      const updatedSchedule = await this.models.Shift.findByIdAndUpdate(
        scheduleId,
        { isActive },
        { new: true }
      );

      if (!updatedSchedule) {
        throw new Error(`Расписание с ID ${scheduleId} не найдено`);
      }

      return updatedSchedule;
    } catch (error) {
      console.error(`[WorkScheduleService] Ошибка при изменении статуса активности: ${error.message}`);
      throw error;
    }
  }
}




export default WorkScheduleService;

let _instance = null;
export function getWorkScheduleService() {
  if (!_instance) {
    // Импортируем models только при первом обращении к функции
    const {models} = import('../models/db.js');
    _instance = new WorkScheduleService(models);
  }
  return _instance;
}
