import mongoose from "mongoose";

class WorkScheduleService {
    constructor(modelsRef, logger) {
        this.models = modelsRef;
    }

    /**
     * Создает новое расписание работы для сотрудника с валидацией
     * @param {Object} scheduleData - Данные расписания
     * @returns {Promise<Object>} - Созданное расписание
     */
    async createWorkSchedule(scheduleData) {
        try {
            const {
                assigneeName,
                assigneeEmail,
                department,
                accountId,
                userId,
                shifts = {},
                limits = {},
                isActive = true
            } = scheduleData;

            // Валидация обязательных полей
            if (!assigneeName || !assigneeEmail || !department || !accountId) {
                throw new Error('Обязательные поля: assigneeName, assigneeEmail, department, accountId');
            }

            // Проверка существования отдела
            const departmentExists = await this.models.Department.findOne({
                _id: department,
                delete: false,
                active: true
            });

            if (!departmentExists) {
                throw new Error(`Активный отдел с ID ${department} не найден`);
            }

            // Проверка уникальности email и accountId
            const existingSchedule = await this.models.Shift.findOne({
                $or: [
                    {assigneeEmail},
                    {accountId}
                ],
                deleted: false
            });

            if (existingSchedule) {
                throw new Error(
                    `Расписание для сотрудника с email ${assigneeEmail} или accountId ${accountId} уже существует`
                );
            }

            // Валидация формата email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(assigneeEmail)) {
                throw new Error('Некорректный формат email');
            }

            // Валидация и нормализация смен
            const validatedShifts = this.validateAndNormalizeShifts(shifts);

            // Валидация лимитов
            const validatedLimits = this.validateLimits(limits);

            // Создание расписания
            const newSchedule = new this.models.Shift({
                assigneeName: assigneeName.trim(),
                assigneeEmail: assigneeEmail.toLowerCase().trim(),
                department,
                accountId: accountId.trim(),
                userId: userId || null,
                shifts: validatedShifts,
                limits: validatedLimits,
                isActive,
                deleted: false,
                deletedAt: null
            });

            const savedSchedule = await newSchedule.save();

            console.log(`[WorkScheduleService] Расписание для ${assigneeName} создано успешно`);
            return savedSchedule;
        } catch (error) {
            console.error(`[WorkScheduleService] Ошибка при создании расписания: ${error.message}`);
            throw error;
        }
    }

    /**
     * Валидация и нормализация смен
     * @param {Object} shifts - Объект со сменами
     * @returns {Object} - Валидированные смены
     */
    validateAndNormalizeShifts(shifts) {
        const validatedShifts = {};
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

        Object.entries(shifts).forEach(([day, shift]) => {
            const dayNum = parseInt(day, 10);

            // Проверка дня недели (0-6)
            if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
                throw new Error(`Некорректный день недели: ${day}. Должно быть число от 0 до 6`);
            }

            // Проверка наличия времени начала и окончания
            if (!shift.startTime || !shift.endTime) {
                throw new Error(`Смена для дня ${dayNum} должна содержать startTime и endTime`);
            }

            // Проверка формата времени (HH:MM)
            if (!timeRegex.test(shift.startTime)) {
                throw new Error(`Некорректный формат startTime для дня ${dayNum}: ${shift.startTime}. Ожидается HH:MM`);
            }

            if (!timeRegex.test(shift.endTime)) {
                throw new Error(`Некорректный формат endTime для дня ${dayNum}: ${shift.endTime}. Ожидается HH:MM`);
            }

            // Преобразование времени в минуты для сравнения
            const startMinutes = this.timeToMinutes(shift.startTime);
            const endMinutes = this.timeToMinutes(shift.endTime);

            // Проверка логичности времени (начало < конца)
            if (startMinutes >= endMinutes) {
                throw new Error(
                    `Время начала смены (${shift.startTime}) должно быть меньше времени окончания (${shift.endTime}) для дня ${dayNum}`
                );
            }

            // Проверка минимальной длительности смены (например, 1 час)
            const durationMinutes = endMinutes - startMinutes;
            if (durationMinutes < 60) {
                throw new Error(`Минимальная длительность смены 1 час для дня ${dayNum}`);
            }

            // Проверка максимальной длительности смены (например, 12 часов)
            if (durationMinutes > 720) {
                throw new Error(`Максимальная длительность смены 12 часов для дня ${dayNum}`);
            }

            validatedShifts[dayNum] = {
                startTime: shift.startTime,
                endTime: shift.endTime
            };
        });

        // Проверка на наличие хотя бы одной смены
        if (Object.keys(validatedShifts).length === 0) {
            throw new Error('Необходимо указать хотя бы одну смену');
        }

        return validatedShifts;
    }

    /**
     * Валидация лимитов
     * @param {Object} limits - Объект с лимитами
     * @returns {Object} - Валидированные лимиты
     */
    validateLimits(limits) {
        const defaultLimits = {
            maxDailyIssues: 30,
            maxActiveIssues: 30,
            preferredLoadPercent: 80
        };

        const validatedLimits = {...defaultLimits, ...limits};

        // Валидация maxDailyIssues
        if (typeof validatedLimits.maxDailyIssues !== 'number' || validatedLimits.maxDailyIssues < 1) {
            throw new Error('maxDailyIssues должно быть положительным числом');
        }

        if (validatedLimits.maxDailyIssues > 100) {
            throw new Error('maxDailyIssues не может превышать 100');
        }

        // Валидация maxActiveIssues
        if (typeof validatedLimits.maxActiveIssues !== 'number' || validatedLimits.maxActiveIssues < 1) {
            throw new Error('maxActiveIssues должно быть положительным числом');
        }

        if (validatedLimits.maxActiveIssues > 100) {
            throw new Error('maxActiveIssues не может превышать 100');
        }

        // Валидация preferredLoadPercent
        if (typeof validatedLimits.preferredLoadPercent !== 'number' ||
            validatedLimits.preferredLoadPercent < 1 ||
            validatedLimits.preferredLoadPercent > 100) {
            throw new Error('preferredLoadPercent должен быть числом от 1 до 100');
        }

        return validatedLimits;
    }

    /**
     * Преобразование времени в минуты с начала дня
     * @param {String} time - Время в формате HH:MM
     * @returns {Number} - Количество минут
     */
    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
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
            const schedule = await this.models.Shift.findOne({assigneeId});
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
            const schedule = await this.models.Shift.findOne({accountId});
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
            const {sort = {updatedAt: -1}, limit = 0, skip = 0} = options;
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
                {new: true, runValidators: true}
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
                {new: true, runValidators: true}
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
                {limits: limitsData},
                {new: true, runValidators: true}
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
            const result = await this.models.Shift.findByIdAndUpdate(scheduleId, {
                isActive: false,
                deleted: true,
                deletedAt: new Date()
            });

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
                [`shifts.${dayOfWeek}`]: {$exists: true}
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
                {isActive},
                {new: true}
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

    // ** Поиск сотрудников по департаменту **
    /**
     * Получает список сотрудников по департаменту
     * @param {String} departmentId - ID департамента
     * @param {Object} options - Дополнительные параметры поиска
     * @returns {Promise<Array>} - Массив сотрудников в департаменте
     */
    async getWorkSchedulesByDepartmentId(departmentId, options = {}) {
        try {
            const {
                onlyActive = true,
                includeDetails = false,
                limit = 0,
                skip = 0
            } = options;
            // Базовый запрос
            const query = {
                department: new mongoose.Types.ObjectId(departmentId),
            };

            // Добавляем фильтр по активности если нужно
            if (onlyActive) {
                query.isActive = true;
            }

            // Получаем расписания сотрудников
            const workSchedules = await this.models.Shift.find(query)
                .skip(skip)
                .limit(limit);
            if (!workSchedules) {
                throw new Error(`Сотрудники для департамента с ID ${departmentId} не найдены`);
            }
            // Формируем результат
            return workSchedules.map(schedule => {
                const result = {
                    assigneeId: schedule.assigneeId,
                    accountId: schedule.accountId,
                    assigneeName: schedule.assigneeName || "Неизвестный сотрудник",
                    assigneeEmail: schedule.assigneeEmail,
                    shifts: schedule.shifts,
                };

                // Если нужны дополнительные данные
                if (includeDetails) {
                    result.limits = schedule.limits;
                    result.isActive = schedule.isActive;
                }

                return result;
            });
        } catch (error) {
            console.error(`[WorkScheduleService] Ошибка при получении сотрудников для департамента ${departmentId}: ${error.message}`);
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
