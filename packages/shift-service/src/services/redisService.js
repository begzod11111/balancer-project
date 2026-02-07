// packages/shift-service/src/services/redisService.js
import redis from '../models/redisClient.js';
import {sendShiftCreatedEvent} from "../producers/index.js";

class RedisService {
    constructor() {
        this.KEY_PREFIX = 'Department';
        this.DEFAULT_TTL = 86400; // 24 часа
    }

    /**
     * Генерация ключа для смены
     * @param {string} departmentObjectId - ObjectId департамента
     * @param {string} accountId - ID аккаунта
     * @param {string} assigneeEmail - Email сотрудника
     * @returns {string}
     */
    generateKey(departmentObjectId, accountId, assigneeEmail) {
        return `${this.KEY_PREFIX}:${departmentObjectId}:${accountId}:${assigneeEmail}`;
    }

    /**
     * Добавление/обновление смены в Redis
     * @param {Object} params
     * @param {string} params.departmentObjectId - ObjectId департамента
     * @param {string} params.accountId - ID аккаунта
     * @param {string} params.assigneeEmail - Email сотрудника
     * @param {string} params.assigneeName - Имя сотрудника
     * @param {Array} params.taskTypeWeights - Веса типов задач
     * @param {string} params.loadCalculationFormula - Формула расчёта
     * @param {number} params.defaultMaxLoad - Максимальная нагрузка
     * @param {number} params.priorityMultiplier - Множитель приоритета
     * @param {number} params.completedTasksCount - Количество выполненных задач
     * @param {Date} params.shiftStartTime - Время начала смены
     * @param {Date} params.shiftEndTime - Время окончания смены
     * @param {number} [ttl] - TTL в секундах (по умолчанию 24 часа)
     */
    async setShift({
                       departmentId,
                       departmentObjectId,
                       accountId,
                       assigneeEmail,
                       assigneeName,
                       taskTypeWeights,
                       loadCalculationFormula,
                       defaultMaxLoad,
                       priorityMultiplier,
                       completedTasksCount = 0,
                       shiftStartTime,
                       shiftEndTime,
                       limits,
                   }, ttl = this.DEFAULT_TTL) {
        try {
            const key = this.generateKey(departmentObjectId, accountId, assigneeEmail);
            const exists = await redis.exists(key);

            if (exists) {
                console.log(`[Redis] Смена уже существует: ${key}`);
                throw new Error('Смена уже существует');
            }

            const data = {
                departmentId,
                departmentObjectId,
                accountId,
                assigneeEmail,
                assigneeName,
                taskTypeWeights: taskTypeWeights || [],
                loadCalculationFormula,
                defaultMaxLoad,
                priorityMultiplier,
                completedTasksCount,
                shiftStartTime: shiftStartTime ? shiftStartTime.toISOString() : null,
                shiftEndTime: shiftEndTime ? shiftEndTime.toISOString() : null,
                limits,
                ttl,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };



            await sendShiftCreatedEvent(data)

            console.log(`[Redis] Добавлена смена: ${key}`);
            return {success: true, key};
        } catch (error) {
            console.error('[Redis] Ошибка добавления смены:', error);
            throw error;
        }
    }


    /**
     * Получение смены по ключу
     * @param {string} departmentObjectId
     * @param {string} accountId
     * @param {string} assigneeEmail
     */
    async getShift(departmentObjectId, accountId, assigneeEmail) {
        try {
            const key = this.generateKey(departmentObjectId, accountId, assigneeEmail);
            const data = await redis.get(key);

            if (!data) {
                return null;
            }

            return JSON.parse(data);
        } catch (error) {
            console.error('[Redis] Ошибка получения смены:', error);
            throw error;
        }
    }

    /**
     * Получение всех смен по департаменту
     * @param {string} departmentObjectId
     */
    async getShiftsByDepartment(departmentObjectId) {
        try {
            const pattern = `${this.KEY_PREFIX}:${departmentObjectId}:*`;
            const keys = await redis.keys(pattern);

            if (keys.length === 0) {
                return [];
            }

            const pipeline = redis.pipeline();
            keys.forEach(key => pipeline.get(key));

            const results = await pipeline.exec();

            return results
                .filter(([err, data]) => !err && data)
                .map(([, data]) => JSON.parse(data));
        } catch (error) {
            console.error('[Redis] Ошибка получения смен по департаменту:', error);
            throw error;
        }
    }

    /**
     * Получение всех смен из Redis с TTL
     */
    async getAllShifts() {
        try {
            const pattern = `${this.KEY_PREFIX}:*`;
            const keys = await redis.keys(pattern);

            if (keys.length === 0) {
                return [];
            }

            const pipeline = redis.pipeline();
            keys.forEach(key => {
                pipeline.get(key);
                pipeline.ttl(key);
            });

            const results = await pipeline.exec();

            const shifts = [];
            for (let i = 0; i < results.length; i += 2) {
                const [dataErr, data] = results[i];
                const [ttlErr, ttl] = results[i + 1];

                if (!dataErr && data && !ttlErr) {
                    const shiftData = JSON.parse(data);
                    shifts.push({
                        ...shiftData,
                        ttl: ttl > 0 ? ttl : 0
                    });
                }
            }

            return shifts;
        } catch (error) {
            console.error('[Redis] Ошибка получения всех смен:', error);
            throw error;
        }
    }


    /**
     * Получение всех смен по accountId
     * @param {string} accountId
     */
    async getShiftsByAccount(accountId) {
        try {
            const pattern = `${this.KEY_PREFIX}:*:${accountId}:*`;
            const keys = await redis.keys(pattern);

            if (keys.length === 0) {
                return [];
            }

            const pipeline = redis.pipeline();
            keys.forEach(key => pipeline.get(key));

            const results = await pipeline.exec();

            return results
                .filter(([err, data]) => !err && data)
                .map(([, data]) => JSON.parse(data));
        } catch (error) {
            console.error('[Redis] Ошибка получения смен по аккаунту:', error);
            throw error;
        }
    }

    /**
     * Получение всех смен по email
     * @param {string} assigneeEmail
     */
    async getShiftsByEmail(assigneeEmail) {
        try {
            const pattern = `${this.KEY_PREFIX}:*:*:${assigneeEmail}`;
            const keys = await redis.keys(pattern);

            if (keys.length === 0) {
                return [];
            }

            const pipeline = redis.pipeline();
            keys.forEach(key => pipeline.get(key));

            const results = await pipeline.exec();

            return results
                .filter(([err, data]) => !err && data)
                .map(([, data]) => JSON.parse(data));
        } catch (error) {
            console.error('[Redis] Ошибка получения смен по email:', error);
            throw error;
        }
    }

    /**
     * Обновление количества выполненных задач
     * @param {string} departmentObjectId
     * @param {string} accountId
     * @param {string} assigneeEmail
     * @param {number} count
     */
    async incrementCompletedTasks(departmentObjectId, accountId, assigneeEmail, count = 1) {
        try {
            const shift = await this.getShift(departmentObjectId, accountId, assigneeEmail);

            if (!shift) {
                throw new Error('Смена не найдена');
            }

            shift.completedTasksCount += count;
            shift.updatedAt = new Date().toISOString();

            const key = this.generateKey(departmentObjectId, accountId, assigneeEmail);
            const ttl = await redis.ttl(key);

            await redis.setex(key, ttl > 0 ? ttl : this.DEFAULT_TTL, JSON.stringify(shift));

            console.log(`[Redis] Обновлён счётчик задач для ${assigneeEmail}: ${shift.completedTasksCount}`);
            return shift;
        } catch (error) {
            console.error('[Redis] Ошибка обновления счётчика:', error);
            throw error;
        }
    }

    /**
     * Удаление смены
     * @param {string} departmentObjectId
     * @param {string} accountId
     * @param {string} assigneeEmail
     */
    async deleteShift(departmentObjectId, accountId, assigneeEmail) {
        try {
            const key = this.generateKey(departmentObjectId, accountId, assigneeEmail);
            const result = await redis.del(key);

            console.log(`[Redis] Удалена смена: ${key}`);
            return result === 1;
        } catch (error) {
            console.error('[Redis] Ошибка удаления смены:', error);
            throw error;
        }
    }

    /**
     * Удаление всех смен по департаменту
     * @param {string} departmentObjectId
     */
    async deleteShiftsByDepartment(departmentObjectId) {
        try {
            const pattern = `${this.KEY_PREFIX}:${departmentObjectId}:*`;
            const keys = await redis.keys(pattern);

            if (keys.length === 0) {
                return 0;
            }

            const result = await redis.del(...keys);
            console.log(`[Redis] Удалено смен по департаменту ${departmentObjectId}: ${result}`);
            return result;
        } catch (error) {
            console.error('[Redis] Ошибка удаления смен по департаменту:', error);
            throw error;
        }
    }

    /**
     * Проверка существования смены
     * @param {string} departmentObjectId
     * @param {string} accountId
     * @param {string} assigneeEmail
     */
    async exists(departmentObjectId, accountId, assigneeEmail) {
        try {
            const key = this.generateKey(departmentObjectId, accountId, assigneeEmail);
            return await redis.exists(key) === 1;
        } catch (error) {
            console.error('[Redis] Ошибка проверки существования:', error);
            throw error;
        }
    }

    /**
     * Получение TTL смены
     * @param {string} departmentObjectId
     * @param {string} accountId
     * @param {string} assigneeEmail
     */
    async getTTL(departmentObjectId, accountId, assigneeEmail) {
        try {
            const key = this.generateKey(departmentObjectId, accountId, assigneeEmail);
            return await redis.ttl(key);
        } catch (error) {
            console.error('[Redis] Ошибка получения TTL:', error);
            throw error;
        }
    }

    /**
     * Обновление TTL смены
     * @param {string} departmentObjectId
     * @param {string} accountId
     * @param {string} assigneeEmail
     * @param {number} ttl - TTL в секундах
     */
    async updateTTL(departmentObjectId, accountId, assigneeEmail, ttl) {
        try {
            const key = this.generateKey(departmentObjectId, accountId, assigneeEmail);
            return await redis.expire(key, ttl) === 1;
        } catch (error) {
            console.error('[Redis] Ошибка обновления TTL:', error);
            throw error;
        }
    }

    /**
     * Получение статистики по всем сменам
     */
    async getStats() {
        try {
            const pattern = `${this.KEY_PREFIX}:*`;
            const keys = await redis.keys(pattern);

            const stats = {
                totalShifts: keys.length, departments: new Set(), accounts: new Set(), assignees: new Set()
            };

            keys.forEach(key => {
                const [, dept, acc, email] = key.split(':');
                stats.departments.add(dept);
                stats.accounts.add(acc);
                stats.assignees.add(email);
            });

            return {
                totalShifts: stats.totalShifts,
                uniqueDepartments: stats.departments.size,
                uniqueAccounts: stats.accounts.size,
                uniqueAssignees: stats.assignees.size
            };
        } catch (error) {
            console.error('[Redis] Ошибка получения статистики:', error);
            throw error;
        }
    }

    /**
     * Обновление лимитов смены
     * @param {string} departmentObjectId
     * @param {string} accountId
     * @param {string} assigneeEmail
     * @param {Object} limits
     * @param {number} limits.maxDailyIssues - Максимум задач в день
     * @param {number} limits.maxActiveIssues - Максимум активных задач
     * @param {number} limits.preferredLoadPercent - Предпочтительная загрузка (%)
     */
    async updateLimits(departmentObjectId, accountId, assigneeEmail, limits) {
        try {
            const key = this.generateKey(departmentObjectId, accountId, assigneeEmail);

            // Проверяем существование смены
            const exists = await redis.exists(key);
            if (!exists) {
                throw new Error('Смена не найдена');
            }

            // Получаем текущие данные
            const currentData = await redis.get(key);
            const shiftData = JSON.parse(currentData);

            // Обновляем только лимиты
            shiftData.limits = {
                maxDailyIssues: limits.maxDailyIssues ?? shiftData.limits?.maxDailyIssues ?? 30,
                maxActiveIssues: limits.maxActiveIssues ?? shiftData.limits?.maxActiveIssues ?? 30,
                preferredLoadPercent: limits.preferredLoadPercent ?? shiftData.limits?.preferredLoadPercent ?? 80
            };

            shiftData.updatedAt = new Date().toISOString();

            // Получаем оставшийся TTL
            const ttl = await redis.ttl(key);

            // Сохраняем обновленные данные с тем же TTL
            await redis.setex(key, ttl > 0 ? ttl : this.DEFAULT_TTL, JSON.stringify(shiftData));

            console.log(`✅ Лимиты обновлены для смены: ${key}`);
            return shiftData;
        } catch (error) {
            console.error('❌ Ошибка обновления лимитов смены:', error);
            throw error;
        }
    }

    /**
     * Частичное обновление смены
     * @param {string} departmentObjectId
     * @param {string} accountId
     * @param {string} assigneeEmail
     * @param {Object} updates - Объект с полями для обновления
     */
    async updateShift(departmentObjectId, accountId, assigneeEmail, updates) {
        try {
            const key = this.generateKey(departmentObjectId, accountId, assigneeEmail);

            // Проверяем существование смены
            const exists = await redis.exists(key);
            if (!exists) {
                throw new Error('Смена не найдена');
            }

            // Получаем текущие данные
            const currentData = await redis.get(key);
            const shiftData = JSON.parse(currentData);

            // Обновляем поля
            const updatedData = {
                ...shiftData, ...updates, updatedAt: new Date().toISOString()
            };

            // Получаем оставшийся TTL
            const ttl = await redis.ttl(key);

            // Сохраняем обновленные данные с тем же TTL
            await redis.setex(key, ttl > 0 ? ttl : this.DEFAULT_TTL, JSON.stringify(updatedData));

            console.log(`✅ Смена обновлена: ${key}`);
            return updatedData;
        } catch (error) {
            console.error('❌ Ошибка обновления смены:', error);
            throw error;
        }
    }

}

export default new RedisService();
