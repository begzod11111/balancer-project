import {redisClient} from '../config/redis.js';
import {all, create} from 'mathjs';
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
                createdAt: {$gte: todayStartUTC}
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
                status: {$nin: completedStatuses}
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
            const {departmentObjectId, accountId, assigneeEmail} = employeeData;

            // Основной ключ
            const mainKey = `Department:${departmentObjectId}:${accountId}:${assigneeEmail}`;
            await redisClient.setex(mainKey, ttl, JSON.stringify(employeeData));


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

    /**
     * Создание смены в Redis
     * @param {Object} shiftData - Данные смены
     * @returns {Object} Обработанные данные с весом
     */
    async createShiftInRedis(shiftData) {
        try {
            const {departmentObjectId, accountId, assigneeEmail, ttl = 14400} = shiftData;

            console.log(`[EmployeeWeight] 🚀 Создание смены в Redis для ${assigneeEmail} (${accountId})`);

            // Параллельная загрузка задач и формирование ключа
            const [issues, redisKey] = await Promise.all([
                this.getTodayIssues(accountId),
                Promise.resolve(`Department:${departmentObjectId}:${accountId}:${assigneeEmail}`)
            ]);


            // Обработка веса
            const processed = this.processEmployeeWeight(shiftData, issues);

            // Сохранение в Redis
            await redisClient.setex(redisKey, ttl, JSON.stringify(processed));

            console.log(`[EmployeeWeight] ✅ Смена создана, вес: ${processed.calculatedWeight}`);

            return processed;
        } catch (error) {
            console.error('[EmployeeWeight] ❌ Ошибка создания смены в Redis:', error);
            throw error;
        }
    }

    /* *
     * Получение данных смены из Redis по accountId
     * @param {string} accountId - ID сотрудника
     * @returns {Object|null} Данные смены или null, если не найдено
     */
    async getShiftDataByAccountId(accountId) {
        try {
            const pattern = `Department:*:${accountId}:*`;
            const keys = await redisClient.keys(pattern);

            if (keys.length === 0) {
                console.warn(`[EmployeeWeight] ⚠️ Смена для ${accountId} не найдена в Redis`);
                return null;
            }

            const shiftData = await redisClient.get(keys.pop());
            return shiftData ? JSON.parse(shiftData) : null;
        } catch (error) {
            console.error('[EmployeeWeight] ❌ Ошибка получения данных смены из Redis:', error);
            return null;
        }
    }

    async updateShiftDataInRedis(accountId, updatedData) {
        try {
            const pattern = `Department:*:${accountId}:*`;
            const keys = await redisClient.keys(pattern);

            if (keys.length === 0) {
                console.warn(`[EmployeeWeight] ⚠️ Смена для ${accountId} не найдена в Redis, не могу обновить`);
                return null;
            }

            const key = keys.pop();
            const existingData = await redisClient.get(key);

            if (!existingData) {
                console.warn(`[EmployeeWeight] ⚠️ Данные для ${accountId} устарели, не могу обновить`);
                return null;
            }
            const ttl = await redisClient.ttl(key) || 14400;
            const mergedData = {
                ...JSON.parse(existingData),
                ...updatedData,
                processedAt: new Date().toISOString()
            };

            await redisClient.setex(key, ttl, JSON.stringify(mergedData));

            console.log(`[EmployeeWeight] ✅ Данные смены обновлены в Redis для ${accountId}`);

            return mergedData;
        } catch (error) {
            console.error('[EmployeeWeight] ❌ Ошибка обновления данных смены в Redis:', error);
            return null;
        }
    }

    /**
     * Обновляет веса при изменении статуса задачи
     * @param {Array} taskTypeWeights - текущие веса
     * @param {Object} oldIssue - старые данные задачи
     * @param {Object} newIssue - новые данные задачи
     * @returns {Array} обновленные веса
     */
    updateTaskTypeWeightsOnStatusChange(taskTypeWeights, oldIssue, newIssue) {
        if (!taskTypeWeights || !oldIssue || !newIssue) {
            console.warn('[AnalyticsService] Недостаточно данных для обновления весов');
            return taskTypeWeights;
        }

        const oldTypeId = oldIssue.typeId || '-1';
        const newTypeId = newIssue.typeId || '-1';
        const oldStatusId = oldIssue.issueStatusId || '-1';
        const newStatusId = newIssue.issueStatusId || '-1';

        if (String(oldStatusId) === String(newStatusId) && String(oldTypeId) === String(newTypeId)) {
            console.log('[AnalyticsService] Статус и тип не изменились');
            return taskTypeWeights;
        }

        console.log(`[AnalyticsService] 🔄 Изменение: oldType=${oldTypeId}, newType=${newTypeId}, ${oldStatusId} → ${newStatusId}`);

        const updated = JSON.parse(JSON.stringify(taskTypeWeights));

        // --- УМЕНЬШЕНИЕ для старого статуса ---
        let oldTypeEntry = updated.find(t => String(t.typeId) === String(oldTypeId));

        if (!oldTypeEntry) {
            let allOtherTypes = updated.find(t => String(t.typeId) === '-1');
            if (allOtherTypes) {
                allOtherTypes.count = Math.max(0, (allOtherTypes.count || 0) - 1);
                console.log(`[AnalyticsService] ➖ All other types: count=${allOtherTypes.count}`);
            }
        } else if (String(oldTypeEntry.typeId) !== '-1' && oldTypeEntry.statusWeights) {
            let oldStatusEntry = oldTypeEntry.statusWeights.find(s => String(s.statusId) === String(oldStatusId));

            if (!oldStatusEntry) {
                let allOtherStatuses = oldTypeEntry.statusWeights.find(s => String(s.statusId) === '-1');
                if (allOtherStatuses) {
                    allOtherStatuses.count = Math.max(0, (allOtherStatuses.count || 0) - 1);
                    console.log(`[AnalyticsService] ➖ All other statuses: count=${allOtherStatuses.count}`);
                }
            } else {
                oldStatusEntry.count = Math.max(0, (oldStatusEntry.count || 0) - 1);
                console.log(`[AnalyticsService] ➖ Старый статус ${oldStatusId}: count=${oldStatusEntry.count}`);
            }
        }

        // --- УВЕЛИЧЕНИЕ для нового статуса ---
        let newTypeEntry = updated.find(t => String(t.typeId) === String(newTypeId));

        if (!newTypeEntry) {
            let allOtherTypes = updated.find(t => String(t.typeId) === '-1');
            if (!allOtherTypes) {
                allOtherTypes = {
                    typeId: '-1',
                    name: 'All other types',
                    weight: 1,
                    count: 0
                };
                updated.push(allOtherTypes);
            }
            allOtherTypes.count = (allOtherTypes.count || 0) + 1;
            console.log(`[AnalyticsService] ➕ All other types: count=${allOtherTypes.count}`);
        } else if (String(newTypeEntry.typeId) !== '-1') {
            if (!newTypeEntry.statusWeights) {
                newTypeEntry.statusWeights = [];
            }

            let newStatusEntry = newTypeEntry.statusWeights.find(s => String(s.statusId) === String(newStatusId));

            if (!newStatusEntry) {
                let allOtherStatuses = newTypeEntry.statusWeights.find(s => String(s.statusId) === '-1');
                if (!allOtherStatuses) {
                    allOtherStatuses = {
                        statusId: '-1',
                        statusName: 'All other statuses',
                        count: 0,
                        weight: 1
                    };
                    newTypeEntry.statusWeights.push(allOtherStatuses);
                }
                allOtherStatuses.count = (allOtherStatuses.count || 0) + 1;
                console.log(`[AnalyticsService] ➕ All other statuses: count=${allOtherStatuses.count}`);
            } else {
                newStatusEntry.count = (newStatusEntry.count || 0) + 1;
                console.log(`[AnalyticsService] ➕ Новый статус ${newStatusId}: count=${newStatusEntry.count}`);
            }
        }

        console.log(`[AnalyticsService] ✅ Обновление завершено`);

        return updated;
    }

    /**
     * Обновляет счетчики типов задач и статусов
     * @param {Array} taskTypeWeights - массив весов типов задач
     * @param {Object} issue - данные задачи
     * @param {string} operation - 'add' или 'remove'
     * @returns {Array} обновленный массив taskTypeWeights
     */
    updateTaskTypeWeights(taskTypeWeights, issue, operation = 'add') {
    if (!taskTypeWeights || !issue) {
        console.warn('[AnalyticsService] Недостаточно данных для обновления весов');
        return taskTypeWeights;
    }

    const typeId = issue.typeId || '-1';
    const statusId = issue.issueStatusId || '-1';
    const delta = operation === 'add' ? 1 : -1;

    // Создаём копию для иммутабельности
    const updated = JSON.parse(JSON.stringify(taskTypeWeights));

    // Ищем тип задачи
    let typeEntry = updated.find(t => String(t.typeId) === String(typeId));

    // Если тип не найден, ищем "All other types"
    if (!typeEntry) {
        typeEntry = updated.find(t => String(t.typeId) === '-1');

        // Если и "All other types" нет, создаём его
        if (!typeEntry) {
            typeEntry = {
                typeId: '-1',
                name: 'All other types',
                weight: 1,
                count: 0
            };
            updated.push(typeEntry);
        }

        // Для "All other types" только обновляем count
        typeEntry.count = Math.max(0, (typeEntry.count || 0) + delta);

        console.log(`[AnalyticsService] 📊 Обновлен All other types: count=${typeEntry.count}`);
        return updated;
    }

    // Для конкретных типов обновляем count и statusWeights
    typeEntry.count = Math.max(0, (typeEntry.count || 0) + delta);

    // Обрабатываем statusWeights только для конкретных типов
    if (!typeEntry.statusWeights) {
        typeEntry.statusWeights = [];
    }

    let statusEntry = typeEntry.statusWeights.find(s => String(s.statusId) === String(statusId));

    // Если статус не найден, ищем "All other statuses"
    if (!statusEntry) {
        statusEntry = typeEntry.statusWeights.find(s => String(s.statusId) === '-1');

        // Если и "All other statuses" нет, создаём его
        if (!statusEntry) {
            statusEntry = {
                statusId: '-1',
                statusName: 'All other statuses',
                count: 0,
                weight: 1
            };
            typeEntry.statusWeights.push(statusEntry);
        }
    }

    // Обновляем счётчик статуса
    statusEntry.count = Math.max(0, (statusEntry.count || 0) + delta);

    // НЕ удаляем статусы с нулевым count (оставляем как есть)
    // typeEntry.statusWeights = typeEntry.statusWeights.filter(s => s.count > 0);

    console.log(`[AnalyticsService] 📊 Обновлены веса: type=${typeId}, status=${statusId}, operation=${operation}, count=${statusEntry.count}`);

    return updated;
}


    /**
     * Обрабатывает переназначение задачи
     * @param {string} issueId - ID задачи
     * @param {string} newAccountId - ID нового исполнителя
     * @returns {Promise<Object|null>}
     */
    async processIssueAssignmentChange(issueId, newAccountId) {
        try {
            const issue = await models.Issue.findOne({issueId}).lean();

            if (!issue) {
                console.warn(`[AnalyticsService] ⚠️ Задача с issueId=${issueId} не найдена`);
                return null;
            }

            const oldAccountId = issue.assigneeAccountId || null;

            // Ранний выход: исполнитель не изменился
            if (newAccountId === oldAccountId) {
                console.log(`[AnalyticsService] 🔄 Исполнитель не изменился для ${issue.issueKey}, обновление не требуется`);
                return null;
            }

            console.log(`[AnalyticsService] 🔀 Переназначение ${issue.issueKey}: ${oldAccountId || 'null'} → ${newAccountId}`);

            return await this.updateWeightsOnAssignmentChange(issue, oldAccountId, newAccountId);

        } catch (error) {
            console.error('[AnalyticsService] ❌ Ошибка получения данных задачи для переназначения:', error);
            return null;
        }
    }

    /**
     * Обрабатывает переназначение задачи между сотрудниками
     * @param {Object} issue - данные задачи
     * @param {string|null} oldAccountId - ID предыдущего исполнителя
     * @param {string} newAccountId - ID нового исполнителя
     * @returns {Promise<Object|null>}
     */
    async updateWeightsOnAssignmentChange(issue, oldAccountId, newAccountId) {
        try {
            // Параллельная загрузка данных обоих исполнителей
            const [oldShiftData, newShiftData] = await Promise.all([
                oldAccountId ? this.getShiftDataByAccountId(oldAccountId) : Promise.resolve(null),
                this.getShiftDataByAccountId(newAccountId)
            ]);

            const results = {
                oldAssignee: null,
                newAssignee: null
            };

            if (oldAccountId) {
                if (!oldShiftData) {
                    console.warn(`[AnalyticsService] ⚠️ Старый исполнитель ${oldAccountId} не найден в Redis`);
                } else {
                    results.oldAssignee = await this._updateAssigneeWeight(
                        oldAccountId,
                        oldShiftData,
                        issue,
                        'remove'
                    );
                    console.log(`[AnalyticsService] ➖ Старый исполнитель ${oldAccountId}: вес ${results.oldAssignee.calculatedWeight}`);
                }
            } else {
                console.log(`[AnalyticsService] 📝 Новая задача, старого исполнителя нет`);
            }

            // --- ОБРАБОТКА НОВОГО ИСПОЛНИТЕЛЯ ---
            if (!newShiftData) {
                console.warn(`[AnalyticsService] ⚠️ Новый исполнитель ${newAccountId} не найден в Redis`);
                return results;
            }

            results.newAssignee = await this._updateAssigneeWeight(
                newAccountId,
                newShiftData,
                issue,
                'add'
            );

            console.log(`[AnalyticsService] ➕ Новый исполнитель ${newAccountId}: вес ${results.newAssignee.calculatedWeight}`);
            console.log(`[AnalyticsService] ✅ Переназначение ${issue.issueKey} обработано`);

            return results;

        } catch (error) {
            console.error('[AnalyticsService] ❌ Ошибка при обработке переназначения:', error);
            return null;
        }
    }

    /**
     * Внутренний метод для обновления веса исполнителя
     * @param {string} accountId - ID исполнителя
     * @param {Object} shiftData - данные смены
     * @param {Object} issue - данные задачи
     * @param {string} operation - 'add' или 'remove'
     * @returns {Promise<Object>}
     * @private
     */
    async _updateAssigneeWeight(accountId, shiftData, issue, operation) {
        const updatedWeights = this.updateTaskTypeWeights(
            shiftData.taskTypeWeights,
            issue,
            operation
        );

        const newWeight = this._calculateWeight(updatedWeights, shiftData.limits, {
            defaultMaxLoad: shiftData.defaultMaxLoad,
            priorityMultiplier: shiftData.priorityMultiplier
        });

        return await this.updateShiftDataInRedis(accountId, {
            taskTypeWeights: updatedWeights,
            calculatedWeight: newWeight,
            processedAt: new Date().toISOString()
        });
    }





    /**
     * Главный метод для обработки изменения статуса задачи
     * @param {string} accountId - ID сотрудника
     * @param {Object} newIssue - новые данные задачи
     */
    async processIssueStatusChange(accountId, newIssue) {
        try {
            // Параллельное получение старых данных задачи и данных смены
            const [oldIssue, shiftData] = await Promise.all([
                models.Issue.findOne({issueId: newIssue.issueId}).lean(),
                this.getShiftDataByAccountId(accountId)
            ]);

            if (!oldIssue) {
                console.log(`[AnalyticsService] Старые данные задачи не найдены для issueId=${newIssue.issueId}`);
                return null;
            }

            if (!shiftData) {
                console.warn(`[AnalyticsService] Данные смены не найдены для accountId=${accountId}`);
                return null;
            }

            // Проверка изменений до вызова updateWeightsOnIssueChange
            if (String(oldIssue.issueKey) !== String(newIssue.issueKey)) {
                console.warn('[AnalyticsService] Ключ задачи не совпадает, пропускаем обновление весов');
                return null;
            }

            const oldStatusId = oldIssue.issueStatusId || '-1';
            const newStatusId = newIssue.issueStatusId || '-1';

            if (String(oldStatusId) === String(newStatusId)) {
                console.log('[AnalyticsService] Статус не изменился, обновление не требуется');
                return null;
            }

            // Синхронное обновление весов
            return this.updateWeightsOnIssueChange(shiftData, oldIssue, newIssue, accountId);

        } catch (error) {
            console.error('[AnalyticsService] Ошибка при обработке изменения статуса задачи:', error);
            return null;
        }
    }

    /**
     * Обновляет веса в Redis при изменении статуса задачи
     * @param {Object} shiftData - данные смены из Redis
     * @param {Object} oldIssue - старые данные задачи
     * @param {Object} newIssue - новые данные задачи
     * @param {string} accountId - ID сотрудника
     * @returns {Promise<Object|null>}
     */
    async updateWeightsOnIssueChange(shiftData, oldIssue, newIssue, accountId) {
        try {
            // Обновление весов и расчет нового веса
            const newTaskTypeWeights = this.updateTaskTypeWeightsOnStatusChange(
                shiftData.taskTypeWeights,
                oldIssue,
                newIssue
            );

            const weight = this._calculateWeight(newTaskTypeWeights, shiftData.limits, {
                defaultMaxLoad: shiftData.defaultMaxLoad,
                priorityMultiplier: shiftData.priorityMultiplier
            });

            // Обновление данных в Redis
            return await this.updateShiftDataInRedis(accountId, {
                taskTypeWeights: newTaskTypeWeights,
                calculatedWeight: weight,
                processedAt: new Date().toISOString()
            });

        } catch (error) {
            console.error('[AnalyticsService] Ошибка при обновлении весов в Redis:', error);
            return null;
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
            const {typeId, issueStatusId} = issue;
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

        const {maxDailyIssues = 30, maxActiveIssues = 30, preferredLoadPercent = 80} = limits;

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
