import {parser} from 'mathjs';
import {redisClient} from "../config/redis.js";
import {models} from "../models/db.js";

class ShiftAnalyticsService {
    /**
     * Обработка события создания смены
     */
    async processShiftCreated(shiftData) {
        try {
            console.log(`[Analytics] 📊 Начало обработки смены для ${shiftData.assigneeName}`);

            // Получаем задачи сотрудника
            const issues = await this.getAssigneeIssues(shiftData.accountId);
            console.log(`[Analytics] 📋 Найдено задач: ${issues.length}`);

            // Вычисляем нагрузку
            const loadData = await this.calculateLoad(shiftData, issues);

            // Сохраняем в Redis
            await this.saveToRedis(shiftData, loadData);

            // Обновляем статистику департамента
            await this.updateDepartmentStats(shiftData.departmentObjectId);

            console.log(`[Analytics] ✅ Смена обработана успешно`);
            return loadData;
        } catch (error) {
            console.error('[Analytics] ❌ Ошибка обработки смены:', error);
            throw error;
        }
    }

    /**
     * Получение задач сотрудника из MongoDB
     */
    async getAssigneeIssues(accountId) {
        try {
            return await models.Issue.find({
                assigneeAccountId: accountId,
                issueStatusId: {$ne: 'CANCELED'} // Исключаем отмененные
            }).lean();
        } catch (error) {
            console.error('[Analytics] ❌ Ошибка получения задач:', error);
            return [];
        }
    }

    /**
     * Вычисление нагрузки сотрудника
     */
    async calculateLoad(shiftData, issues) {
        const {
            taskTypeWeights = [],
            defaultMaxLoad = 100,
            priorityMultiplier = 1,
            loadCalculationFormula = 'sum(taskWeights) / maxLoad',
            limits = {}
        } = shiftData;

        // Группируем задачи по типу и статусу
        const taskGroups = this.groupIssues(issues);

        // Вычисляем веса задач
        const taskWeights = this.calculateTaskWeights(
            taskGroups,
            taskTypeWeights,
            priorityMultiplier
        );

        // Считаем общую нагрузку по формуле
        const currentLoad = this.evaluateFormula(
            loadCalculationFormula,
            taskWeights,
            defaultMaxLoad
        );

        // Проверяем лимиты
        const limitsStatus = this.checkLimits(issues, limits);

        return {
            currentLoad: Math.round(currentLoad * 100) / 100,
            maxLoad: defaultMaxLoad,
            loadPercentage: Math.round((currentLoad / defaultMaxLoad) * 100),
            totalTasks: issues.length,
            taskWeights,
            taskGroups,
            limitsStatus,
            priorityMultiplier,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Группировка задач по типу и статусу
     */
    groupIssues(issues) {
        const groups = {};

        issues.forEach(issue => {
            const typeId = issue.typeId;
            const statusId = issue.status;

            if (!groups[typeId]) {
                groups[typeId] = {
                    total: 0,
                    statuses: {}
                };
            }

            groups[typeId].total++;

            if (!groups[typeId].statuses[statusId]) {
                groups[typeId].statuses[statusId] = 0;
            }

            groups[typeId].statuses[statusId]++;
        });

        return groups;
    }

    /**
     * Вычисление весов задач
     */
    calculateTaskWeights(taskGroups, taskTypeWeights, priorityMultiplier) {
        const weights = [];
        let totalWeight = 0;

        Object.keys(taskGroups).forEach(typeId => {
            const typeGroup = taskGroups[typeId];

            // Находим конфигурацию типа
            const typeConfig = taskTypeWeights.find(t => t.typeId === typeId);
            const typeWeight = typeConfig?.weight || 1; // По умолчанию 1

            Object.keys(typeGroup.statuses).forEach(statusId => {
                const count = typeGroup.statuses[statusId];

                // Находим вес статуса
                let statusWeight = 1; // По умолчанию 1
                if (typeConfig?.statusWeights) {
                    const statusConfig = typeConfig.statusWeights.find(
                        s => s.statusId === statusId
                    );
                    if (statusConfig) {
                        statusWeight = statusConfig.weight;
                    }
                }

                // Итоговый вес: количество * вес_типа * вес_статуса * множитель_приоритета
                const weight = count * typeWeight * statusWeight * priorityMultiplier;
                totalWeight += weight;

                weights.push({
                    typeId,
                    typeName: typeConfig?.name || 'Unknown Type',
                    typeWeight,
                    statusId,
                    statusName: typeConfig?.statusWeights?.find(s => s.statusId === statusId)?.statusName || 'Unknown Status',
                    statusWeight,
                    count,
                    weight: Math.round(weight * 100) / 100
                });
            });
        });

        return {
            items: weights,
            total: Math.round(totalWeight * 100) / 100
        };
    }

    /**
     * Вычисление по формуле
     */
    evaluateFormula(formula, taskWeights, maxLoad) {
        try {
            const mathParser = parser();

            // Определяем переменные
            mathParser.set('sum', (weights) => weights.total);
            mathParser.set('taskWeights', taskWeights);
            mathParser.set('maxLoad', maxLoad);

            // Вычисляем
            const result = mathParser.evaluate(formula);
            return typeof result === 'number' ? result : 0;
        } catch (error) {
            console.error('[Analytics] ❌ Ошибка вычисления формулы:', error);
            // Fallback: простое деление
            return taskWeights.total / maxLoad;
        }
    }

    /**
     * Проверка лимитов
     */
    checkLimits(issues, limits) {
        const {
            maxDailyIssues = Infinity,
            maxActiveIssues = Infinity,
            preferredLoadPercent = 100
        } = limits;

        const activeIssues = issues.filter(
            issue => issue.issueStatusId !== 'DONE' && issue.issueStatusId !== 'CANCELED'
        );

        return {
            maxDailyIssues: {
                current: issues.length,
                max: maxDailyIssues,
                exceeded: issues.length > maxDailyIssues
            },
            maxActiveIssues: {
                current: activeIssues.length,
                max: maxActiveIssues,
                exceeded: activeIssues.length > maxActiveIssues
            },
            preferredLoadPercent: {
                value: preferredLoadPercent,
                isPreferred: true
            }
        };
    }

    /**
     * Сохранение в Redis
     */
    async saveToRedis(shiftData) {
        try {
            const key = `Department:${shiftData.department}:${shiftData.assigneeEmail}`;

            // ✅ Правильное название метода для ioredis
            await redisClient.sadd(key, JSON.stringify(shiftData));

            // Установите TTL на 30 дней
            await redisClient.expire(key, 30 * 24 * 60 * 60);

            console.log(`[Analytics] 💾 Сохранено в Redis: ${key}`);
        } catch (error) {
            console.error('[Analytics] ❌ Ошибка сохранения в Redis:', error);
            throw error;
        }
    }

    /**
     * Обновление статистики департамента
     */
    async updateDepartmentStats(departmentObjectId) {
        try {
            // Получаем все ключи департамента
            const memberKeys = await redisClient.smembers(
                `Department:${departmentObjectId}:members`
            );

            if (memberKeys.length === 0) {
                console.log(`[Analytics] ℹ️ Нет сотрудников в департаменте ${departmentObjectId}`);
                return;
            }

            // Получаем данные всех сотрудников
            const membersData = await Promise.all(
                memberKeys.map(async (key) => {
                    const data = await redisClient.get(key);
                    return data ? JSON.parse(data) : null;
                })
            );

            const validMembers = membersData.filter(Boolean);

            // Вычисляем статистику департамента
            const stats = {
                totalMembers: validMembers.length,
                totalLoad: validMembers.reduce((sum, m) => sum + (m.analytics?.currentLoad || 0), 0),
                averageLoad: 0,
                totalTasks: validMembers.reduce((sum, m) => sum + (m.analytics?.totalTasks || 0), 0),
                members: validMembers.map(m => ({
                    accountId: m.accountId,
                    assigneeName: m.assigneeName,
                    assigneeEmail: m.assigneeEmail,
                    currentLoad: m.analytics?.currentLoad || 0,
                    loadPercentage: m.analytics?.loadPercentage || 0,
                    totalTasks: m.analytics?.totalTasks || 0
                })),
                updatedAt: new Date().toISOString()
            };

            stats.averageLoad = stats.totalMembers > 0
                ? Math.round((stats.totalLoad / stats.totalMembers) * 100) / 100
                : 0;

            // Сохраняем статистику департамента
            const statsKey = `Department:${departmentObjectId}:stats`;
            await redisClient.set(statsKey, JSON.stringify(stats));

            console.log(`[Analytics] 📊 Статистика департамента ${departmentObjectId} обновлена`);
            console.log(`  └─ Сотрудников: ${stats.totalMembers}`);
            console.log(`  └─ Средняя нагрузка: ${stats.averageLoad}`);
            console.log(`  └─ Всего задач: ${stats.totalTasks}`);

            return stats;
        } catch (error) {
            console.error('[Analytics] ❌ Ошибка обновления статистики:', error);
            throw error;
        }
    }

    /**
     * Обновление существующей смены
     */
    async updateShift(departmentObjectId, accountId, assigneeEmail) {
        try {
            const key = `Department:${departmentObjectId}:${accountId}:${assigneeEmail}`;

            // Получаем текущие данные
            const currentData = await redisClient.get(key);
            if (!currentData) {
                console.log(`[Analytics] ℹ️ Смена не найдена: ${key}`);
                return null;
            }

            const shiftData = JSON.parse(currentData);

            // Пересчитываем нагрузку
            const issues = await this.getAssigneeIssues(accountId);
            const loadData = await this.calculateLoad(shiftData, issues);

            // Обновляем данные
            shiftData.analytics = loadData;
            shiftData.lastUpdated = new Date().toISOString();

            await redisClient.set(key, JSON.stringify(shiftData));

            console.log(`[Analytics] 🔄 Смена обновлена: ${key}`);
            return shiftData;
        } catch (error) {
            console.error('[Analytics] ❌ Ошибка обновления смены:', error);
            throw error;
        }
    }
}

export default new ShiftAnalyticsService();
