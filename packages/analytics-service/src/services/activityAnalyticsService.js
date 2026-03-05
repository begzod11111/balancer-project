import {models} from "../models/db.js";

class ActivityAnalyticsService {
    /**
     * Получает детальную аналитику активности сотрудников
     * @param {Array<string>} accountIds - массив ID сотрудников
     * @param {number} startTimestamp - начало периода (секунды, UTC+5 Ташкент)
     * @param {number} endTimestamp - конец периода (секунды, UTC+5 Ташкент)
     * @returns {Promise<Object>} полная статистика активности
     */
    async getEmployeeActivityStats(accountIds, startTimestamp, endTimestamp) {
        try {


            // Конвертируем Unix timestamp в Date (учитываем UTC+5)
            const startDate = new Date(startTimestamp * 1000);
            const endDate = new Date(endTimestamp * 1000);


            // Параллельно получаем данные по комментариям и истории
            const [commentsData, historyData] = await Promise.all([
                this._getCommentsActivity(accountIds, startDate, endDate),
                this._getHistoryActivity(accountIds, startDate, endDate)
            ]);

            // Агрегируем данные по каждому сотруднику
            const employeeStats = this._aggregateEmployeeData(accountIds, commentsData, historyData);

            // Рассчитываем почасовую активность
            const hourlyActivity = this._calculateHourlyActivity(commentsData, historyData);

            // Формируем рейтинги
            const rankings = this._calculateRankings(employeeStats);

            // Общая статистика
            const summary = this._calculateSummary(employeeStats);


            return {
                period: {
                    start: startDate,
                    end: endDate, durationHours: Math.round((endDate - startDate) / (1000 * 60 * 60))
                },
                summary,
                employeeStats,
                hourlyActivity,
                rankings,
                metadata: {
                    totalEmployees: accountIds.length,
                    totalComments: commentsData.length,
                    totalHistoryEvents: historyData.length,
                    generatedAt: new Date()
                }
            };

        } catch (error) {
            console.error('[ActivityAnalytics] ❌ Ошибка анализа:', error);
            throw error;
        }
    }

    /**
     * Получает данные по комментариям сотрудников
     * @private
     */
    async _getCommentsActivity(accountIds, startDate, endDate) {
        try {
            return await models.Comment.aggregate([
                {
                    $match: {
                        authorAccountId: {$in: accountIds},
                        createdAt: {$gte: startDate, $lte: endDate}
                    }
                },
                {
                    $project: {
                        authorAccountId: 1,
                        issueKey: 1,
                        createdAt: 1,
                        hour: {$hour: {date: '$createdAt', timezone: 'Asia/Tashkent'}}
                    }
                },
                {$sort: {createdAt: 1}}
            ]);

        } catch (error) {
            console.error('[ActivityAnalytics] ❌ Ошибка получения комментариев:', error);
            return [];
        }
    }

    /**
     * Получает данные по истории изменений
     * @private
     */
    async _getHistoryActivity(accountIds, startDate, endDate) {
        try {
            return await models.ChangelogEvent.aggregate([
                {
                    $match: {
                        authorAccountId: {$in: accountIds},
                        created: {$gte: startDate, $lte: endDate}
                    }
                },
                {
                    $project: {
                        authorAccountId: 1,
                        issueKey: 1,
                        eventType: 1,
                        field: 1,
                        created: 1,
                        hour: {$hour: {date: '$created', timezone: 'Asia/Tashkent'}}
                    }
                },
                {$sort: {created: 1}}
            ]);

        } catch (error) {
            console.error('[ActivityAnalytics] ❌ Ошибка получения истории:', error);
            return [];
        }
    }

    /**
     * Агрегирует данные по каждому сотруднику
     * @private
     */
    _aggregateEmployeeData(accountIds, commentsData, historyData) {
        const employeeMap = new Map();

        // Инициализация
        accountIds.forEach(accountId => {
            employeeMap.set(accountId, {
                accountId,
                totalActions: 0,
                comments: {
                    count: 0,
                    uniqueIssues: new Set()
                },
                historyEvents: {
                    count: 0,
                    uniqueIssues: new Set(),
                    byType: {}
                },
                hourlyDistribution: Array(24).fill(0),
                firstActivity: null,
                lastActivity: null,
                activeDays: new Set()
            });
        });

        // Обработка комментариев
        commentsData.forEach(comment => {
            const employee = employeeMap.get(comment.authorAccountId);
            if (employee) {
                employee.comments.count++;
                employee.comments.uniqueIssues.add(comment.issueKey);
                employee.hourlyDistribution[comment.hour]++;
                employee.totalActions++;

                const date = new Date(comment.createdAt);
                employee.activeDays.add(date.toISOString().split('T')[0]);

                if (!employee.firstActivity || date < employee.firstActivity) {
                    employee.firstActivity = date;
                }
                if (!employee.lastActivity || date > employee.lastActivity) {
                    employee.lastActivity = date;
                }
            }
        });

        // Обработка истории
        historyData.forEach(event => {
            const employee = employeeMap.get(event.authorAccountId);
            if (employee) {
                employee.historyEvents.count++;
                employee.historyEvents.uniqueIssues.add(event.issueKey);
                employee.hourlyDistribution[event.hour]++;
                employee.totalActions++;

                const eventType = event.field || 'unknown';
                employee.historyEvents.byType[eventType] = (employee.historyEvents.byType[eventType] || 0) + 1;

                const date = new Date(event.created);
                employee.activeDays.add(date.toISOString().split('T')[0]);

                if (!employee.firstActivity || date < employee.firstActivity) {
                    employee.firstActivity = date;
                }
                if (!employee.lastActivity || date > employee.lastActivity) {
                    employee.lastActivity = date;
                }
            }
        });

        // ИСПРАВЛЕНИЕ: сохраняем ссылку на Map для _calculateSummary
        this._employeeMapCache = employeeMap;

        // Конвертация для API ответа
        const result = [];
        employeeMap.forEach((employee) => {
            result.push({
                accountId: employee.accountId,
                totalActions: employee.totalActions,
                comments: {
                    count: employee.comments.count,
                    uniqueIssues: employee.comments.uniqueIssues.size
                },
                historyEvents: {
                    count: employee.historyEvents.count,
                    uniqueIssues: employee.historyEvents.uniqueIssues.size,
                    byType: employee.historyEvents.byType
                },
                hourlyDistribution: employee.hourlyDistribution,
                activeDays: employee.activeDays.size,
                firstActivity: employee.firstActivity,
                lastActivity: employee.lastActivity,
                averageActionsPerDay: employee.activeDays.size > 0
                    ? Math.round(employee.totalActions / employee.activeDays.size)
                    : 0,
                peakActivityHour: employee.hourlyDistribution.indexOf(Math.max(...employee.hourlyDistribution))
            });
        });

        return result.sort((a, b) => b.totalActions - a.totalActions);
    }

    /**
     * Рассчитывает почасовую активность всей команды
     * @private
     */
    _calculateHourlyActivity(commentsData, historyData) {
        const hourlyMap = {};

        // Инициализация
        for (let hour = 0; hour < 24; hour++) {
            hourlyMap[hour] = {
                hour,
                comments: 0,
                historyEvents: 0,
                total: 0,
                activeEmployees: new Set()
            };
        }

        // Подсчёт комментариев
        commentsData.forEach(comment => {
            hourlyMap[comment.hour].comments++;
            hourlyMap[comment.hour].total++;
            hourlyMap[comment.hour].activeEmployees.add(comment.authorAccountId);
        });

        // Подсчёт событий
        historyData.forEach(event => {
            hourlyMap[event.hour].historyEvents++;
            hourlyMap[event.hour].total++;
            hourlyMap[event.hour].activeEmployees.add(event.authorAccountId);
        });

        // Конвертация в массив
        return Object.values(hourlyMap).map(data => ({
            hour: data.hour,
            comments: data.comments,
            historyEvents: data.historyEvents,
            total: data.total,
            activeEmployees: data.activeEmployees.size
        }));
    }

    /**
     * Формирует рейтинги сотрудников
     * @private
     */
    _calculateRankings(employeeStats) {
        if (employeeStats.length === 0) {
            return {
                mostActive: null,
                leastActive: null,
                topByComments: [],
                topByHistoryEvents: [],
                topByUniqueIssues: []
            };
        }

        return {
            mostActive: employeeStats[0],
            leastActive: employeeStats[employeeStats.length - 1],
            topByComments: [...employeeStats]
                .sort((a, b) => b.comments.count - a.comments.count)
                .slice(0, 5),
            topByHistoryEvents: [...employeeStats]
                .sort((a, b) => b.historyEvents.count - a.historyEvents.count)
                .slice(0, 5),
            topByUniqueIssues: [...employeeStats]
                .sort((a, b) => {
                    const aUnique = a.comments.uniqueIssues + a.historyEvents.uniqueIssues;
                    const bUnique = b.comments.uniqueIssues + b.historyEvents.uniqueIssues;
                    return bUnique - aUnique;
                })
                .slice(0, 5)
        };
    }

    /**
     * Рассчитывает общую статистику
     * @private
     */
    _calculateSummary(employeeStats) {
        const totalActions = employeeStats.reduce((sum, e) => sum + e.totalActions, 0);
        const totalComments = employeeStats.reduce((sum, e) => sum + e.comments.count, 0);
        const totalHistoryEvents = employeeStats.reduce((sum, e) => sum + e.historyEvents.count, 0);

        const avgActions = employeeStats.length > 0 ? Math.round(totalActions / employeeStats.length) : 0;

        // ИСПРАВЛЕНИЕ: используем кэшированные Set из employeeMap
        const allUniqueIssues = new Set();

        if (this._employeeMapCache) {
            this._employeeMapCache.forEach(employee => {
                employee.comments.uniqueIssues.forEach(issue => allUniqueIssues.add(issue));
                employee.historyEvents.uniqueIssues.forEach(issue => allUniqueIssues.add(issue));
            });
        }

        return {
            totalActions,
            totalComments,
            totalHistoryEvents,
            averageActionsPerEmployee: avgActions,
            totalUniqueIssues: allUniqueIssues.size,
            activeEmployees: employeeStats.filter(e => e.totalActions > 0).length,
            inactiveEmployees: employeeStats.filter(e => e.totalActions === 0).length
        };
    }

    /**
     * Экспортирует данные в CSV формат
     * @param {Object} stats - статистика из getEmployeeActivityStats
     * @returns {string} CSV строка
     */
    exportToCSV(stats) {
        const header = [
            'Account ID',
            'Total Actions',
            'Comments',
            'History Events',
            'Unique Issues',
            'Active Days',
            'Avg Actions/Day',
            'Peak Hour',
            'First Activity',
            'Last Activity'].join(',');

        const rows = stats.employeeStats.map(emp => [
            emp.accountId,
            emp.totalActions,
            emp.comments.count,
            emp.historyEvents.count,
            emp.comments.uniqueIssues + emp.historyEvents.uniqueIssues,
            emp.activeDays,
            emp.averageActionsPerDay,
            emp.peakActivityHour,
            emp.firstActivity?.toISOString() || 'N/A',
            emp.lastActivity?.toISOString() || 'N/A'
        ].join(','));

        return [header, ...rows].join('\n');
    }

    /**
     * Получает статистику закрываемости задач для сотрудников
     * @param {Array<string>} accountIds - массив ID сотрудников
     * @param {number} startTimestamp - начало периода (миллисекунды)
     * @param {number} endTimestamp - конец периода (миллисекунды)
     * @returns {Promise<Object>} статистика по закрытым и активным задачам
     */
    async getTaskCompletionStats(accountIds, startTimestamp, endTimestamp) {
        try {
            console.log(`[TaskCompletion] 📊 Анализ закрываемости для ${accountIds.length} сотрудников`);

            const startDate = new Date(startTimestamp);
            const endDate = new Date(endTimestamp);

            // Параллельно получаем данные из Issues, IssueTypes и статусы
            const [issues, issueTypes] = await Promise.all([
                this._getIssuesInPeriod(accountIds, startDate, endDate),
                this._getIssueTypes()
            ]);

            // Создаём карту статусов (закрытые vs активные)
            const statusMap = this._buildStatusMap(issueTypes);

            // Агрегируем данные по сотрудникам
            const employeeStats = this._aggregateTaskCompletionData(
                accountIds,
                issues,
                issueTypes,
                statusMap
            );

            // Статистика по группе
            const groupStats = this._calculateGroupStats(employeeStats);

            console.log(`[TaskCompletion] ✅ Анализ завершён`);

            return {
                period: {
                    start: startDate,
                    end: endDate, durationDays: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
                },
                groupStats,
                employeeStats,
                metadata: {
                    totalEmployees: accountIds.length,
                    totalIssues: issues.length,
                    generatedAt: new Date()
                }
            };

        } catch (error) {
            console.error('[TaskCompletion] ❌ Ошибка анализа:', error);
            throw error;
        }
    }

    /**
     * Получает задачи за период
     * @private
     */
    async _getIssuesInPeriod(accountIds, startDate, endDate) {
        try {
            const Issue = (await import('../models/issue.js')).default;

            const issues = await Issue.find({
                assigneeAccountId: {$in: accountIds},
                $or: [
                    {createdAt: {$gte: startDate, $lte: endDate}},
                    {updatedAt: {$gte: startDate, $lte: endDate}}
                ]
            }).lean();

            console.log(`[TaskCompletion] 📝 Найдено задач: ${issues.length}`);
            return issues;

        } catch (error) {
            console.error('[TaskCompletion] ❌ Ошибка получения задач:', error);
            return [];
        }
    }

    /**
     * Получает типы задач со статусами
     * @private
     */
    async _getIssueTypes() {
        try {


            const types = await models.Type.find({
                active: true,
                deleted: false
            }).lean();

            console.log(`[TaskCompletion] 📋 Найдено типов задач: ${types.length}`);
            return types;

        } catch (error) {
            console.error('[TaskCompletion] ❌ Ошибка получения типов:', error);
            return [];
        }
    }

    /**
     * Создаёт карту статусов (закрытые/активные)
     * @private
     */
    _buildStatusMap(issueTypes) {
        const statusMap = {
            closed: new Set(),
            active: new Set()
        };

        const closedKeywords = ['closed', 'resolved', 'done', 'закрыто', 'обработано'];

        issueTypes.forEach(type => {
            if (!type.statuses) return;

            type.statuses.forEach(status => {
                const statusName = status.untranslatedName.toLowerCase();
                const isClosed = closedKeywords.some(keyword => statusName.includes(keyword));

                if (isClosed) {
                    statusMap.closed.add(status.id);
                } else {
                    statusMap.active.add(status.id);
                }
            });
        });

        console.log(`[TaskCompletion] 🔍 Закрытых статусов: ${statusMap.closed.size}, Активных: ${statusMap.active.size}`);
        return statusMap;
    }

    /**
     * Агрегирует данные по сотрудникам
     * @private
     */
    _aggregateTaskCompletionData(accountIds, issues, issueTypes, statusMap) {
        const employeeMap = new Map();

        // Создаём карту типов для быстрого доступа
        const typeMap = new Map(issueTypes.map(t => [t.typeId, t]));

        // Инициализация
        accountIds.forEach(accountId => {
            employeeMap.set(accountId, {
                accountId,
                totalTasks: 0,
                closedTasks: 0,
                activeTasks: 0,
                byType: {},
                byStatus: {
                    closed: {},
                    active: {}
                },
                completionRate: 0,
                avgTimeToClose: 0,
                closedIssueKeys: [],
                activeIssueKeys: []
            });
        });

        // Обработка задач
        issues.forEach(issue => {
            const employee = employeeMap.get(issue.assigneeAccountId);
            if (!employee) return;

            employee.totalTasks++;

            const isClosed = statusMap.closed.has(issue.issueStatusId);
            const issueType = typeMap.get(issue.typeId);
            const typeName = issueType?.name || 'Unknown';

            if (isClosed) {
                employee.closedTasks++;
                employee.closedIssueKeys.push(issue.issueKey);

                // Подсчёт по статусам (закрытые)
                const statusName = issue.status || 'Unknown';
                employee.byStatus.closed[statusName] = (employee.byStatus.closed[statusName] || 0) + 1;

            } else {
                employee.activeTasks++;
                employee.activeIssueKeys.push(issue.issueKey);

                // Подсчёт по статусам (активные)
                const statusName = issue.status || 'Unknown';
                employee.byStatus.active[statusName] = (employee.byStatus.active[statusName] || 0) + 1;
            }

            // Подсчёт по типам
            if (!employee.byType[typeName]) {
                employee.byType[typeName] = {
                    total: 0,
                    closed: 0,
                    active: 0
                };
            }

            employee.byType[typeName].total++;
            if (isClosed) {
                employee.byType[typeName].closed++;
            } else {
                employee.byType[typeName].active++;
            }
        });

        // Рассчитываем процент завершения
        const result = [];
        employeeMap.forEach((employee) => {
            employee.completionRate = employee.totalTasks > 0
                ? Math.round((employee.closedTasks / employee.totalTasks) * 100)
                : 0;

            result.push(employee);
        });

        return result.sort((a, b) => b.completionRate - a.completionRate);
    }

    /**
     * Рассчитывает групповую статистику
     * @private
     */
    _calculateGroupStats(employeeStats) {
        const totalTasks = employeeStats.reduce((sum, e) => sum + e.totalTasks, 0);
        const totalClosed = employeeStats.reduce((sum, e) => sum + e.closedTasks, 0);
        const totalActive = employeeStats.reduce((sum, e) => sum + e.activeTasks, 0);

        const avgCompletionRate = employeeStats.length > 0
            ? Math.round(employeeStats.reduce((sum, e) => sum + e.completionRate, 0) / employeeStats.length)
            : 0;

        // Агрегация по типам
        const groupByType = {};
        employeeStats.forEach(emp => {
            Object.entries(emp.byType).forEach(([typeName, stats]) => {
                if (!groupByType[typeName]) {
                    groupByType[typeName] = {total: 0, closed: 0, active: 0};
                }
                groupByType[typeName].total += stats.total;
                groupByType[typeName].closed += stats.closed;
                groupByType[typeName].active += stats.active;
            });
        });

        // Топ исполнителей
        const topPerformers = [...employeeStats]
            .filter(e => e.closedTasks > 0)
            .sort((a, b) => b.closedTasks - a.closedTasks)
            .slice(0, 5);

        // Наименее активные
        const leastActive = [...employeeStats]
            .filter(e => e.totalTasks > 0)
            .sort((a, b) => a.completionRate - b.completionRate)
            .slice(0, 5);

        return {
            totalTasks,
            totalClosed,
            totalActive,
            groupCompletionRate: totalTasks > 0 ? Math.round((totalClosed / totalTasks) * 100) : 0,
            avgCompletionRate,
            byType: groupByType,
            topPerformers,
            leastActive,
            employeesWithNoTasks: employeeStats.filter(e => e.totalTasks === 0).length
        };
    }

    /**
     * Получает статистику частоты заявок по отделам
     * @param {Array<string>} assignmentGroupIds - массив ID отделов
     * @param {number} days - количество дней для анализа (1, 3, 7, 30)
     * @returns {Promise<Object>} статистика по отделам
     */
    async getDepartmentFrequencyStats(assignmentGroupIds, days = 7) {
        try {
            console.log(`[DepartmentFrequency] 📊 Анализ ${assignmentGroupIds.length} отделов за ${days} дней`);

            // Вычисляем временной диапазон
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

            console.log(`[DepartmentFrequency] 📅 Период: ${startDate.toISOString()} - ${endDate.toISOString()}`);

            // Получаем данные по отделам
            const [issuesData, departmentInfo] = await Promise.all([
                this._getIssuesByDepartments(assignmentGroupIds, startDate, endDate),
                this._getDepartmentInfo(assignmentGroupIds)
            ]);

            // Агрегируем данные по отделам
            const departmentStats = this._aggregateDepartmentFrequency(
                assignmentGroupIds,
                issuesData,
                departmentInfo,
                days
            );

            // Рассчитываем рейтинг отделов
            const rankings = this._calculateDepartmentRankings(departmentStats);

            // Общая статистика
            const summary = this._calculateDepartmentSummary(departmentStats, days);

            console.log(`[DepartmentFrequency] ✅ Анализ завершён`);

            return {
                period: {
                    start: startDate,
                    end: endDate,
                    days
                },
                summary,
                departmentStats,
                rankings,
                metadata: {
                    totalDepartments: assignmentGroupIds.length,
                    totalIssues: issuesData.length,
                    generatedAt: new Date()
                }
            };

        } catch (error) {
            console.error('[DepartmentFrequency] ❌ Ошибка анализа:', error);
            throw error;
        }
    }

    /**
     * Получает задачи по отделам за период
     * @private
     */
    async _getIssuesByDepartments(assignmentGroupIds, startDate, endDate) {
        try {
            const Issue = (await import('../models/issue.js')).default;

            const issues = await Issue.find({
                assignmentGroupId: {$in: assignmentGroupIds},
                $or: [
                    {createdAt: {$gte: startDate, $lte: endDate}},
                    {updatedAt: {$gte: startDate, $lte: endDate}}
                ]
            }).lean();

            console.log(`[DepartmentFrequency] 📝 Найдено задач: ${issues.length}`);
            return issues;

        } catch (error) {
            console.error('[DepartmentFrequency] ❌ Ошибка получения задач:', error);
            return [];
        }
    }

    /**
     * Получает информацию об отделах
     * @private
     */
    async _getDepartmentInfo() {
        try {
            // Просто возвращаем пустую Map, т.к. модель на другом сервисе
            console.log(`[DepartmentFrequency] ℹ️ Информация об отделах недоступна (внешний сервис)`);
            return new Map();

        } catch (error) {
            console.error('[DepartmentFrequency] ❌ Ошибка получения отделов:', error);
            return new Map();
        }
    }

    /**
     * Агрегирует данные частоты по отделам
     * @private
     */
    _aggregateDepartmentFrequency(assignmentGroupIds, issuesData, departmentInfo, days) {
        const departmentMap = new Map();

        // Инициализация отделов
        assignmentGroupIds.forEach(groupId => {
            const deptInfo = departmentInfo.get(groupId);

            departmentMap.set(groupId, {
                groupId,
                name: deptInfo?.name || groupId, // Используем ID как имя, если нет данных
                totalIssues: 0,
                openedIssues: 0,
                closedIssues: 0,
                activeIssues: 0,
                dailyFrequency: {
                    opened: Array(days).fill(0),
                    closed: Array(days).fill(0)
                },
                byType: {},
                byStatus: {
                    closed: {},
                    active: {}
                },
                avgIssuesPerDay: 0,
                closureRate: 0,
                peakDayIndex: 0,
                issueKeys: {
                    opened: [],
                    closed: [],
                    active: []
                }
            });
        });

        // Определяем закрытые статусы
        const closedStatuses = ['6', '5']; // Closed, Resolved

        const now = new Date();

        // Обработка задач
        issuesData.forEach(issue => {
            const department = departmentMap.get(issue.assignmentGroupId);
            if (!department) return;

            department.totalIssues++;

            const isClosed = closedStatuses.includes(issue.issueStatusId);
            const createdDate = new Date(issue.createdAt);
            const updatedDate = new Date(issue.updatedAt);

            // Вычисляем день создания (0 = сегодня, 1 = вчера, ...)
            const createdDayIndex = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
            if (createdDayIndex >= 0 && createdDayIndex < days) {
                department.dailyFrequency.opened[days - 1 - createdDayIndex]++;
                department.openedIssues++;
                department.issueKeys.opened.push(issue.issueKey);
            }

            // Вычисляем день закрытия
            if (isClosed) {
                const closedDayIndex = Math.floor((now - updatedDate) / (1000 * 60 * 60 * 24));
                if (closedDayIndex >= 0 && closedDayIndex < days) {
                    department.dailyFrequency.closed[days - 1 - closedDayIndex]++;
                }
                department.closedIssues++;
                department.issueKeys.closed.push(issue.issueKey);

                // Статистика по статусам (закрытые)
                const statusName = issue.status || 'Unknown';
                department.byStatus.closed[statusName] = (department.byStatus.closed[statusName] || 0) + 1;

            } else {
                department.activeIssues++;
                department.issueKeys.active.push(issue.issueKey);

                // Статистика по статусам (активные)
                const statusName = issue.status || 'Unknown';
                department.byStatus.active[statusName] = (department.byStatus.active[statusName] || 0) + 1;
            }

            // Подсчёт по типам
            const typeId = issue.typeId || 'unknown';
            department.byType[typeId] = (department.byType[typeId] || 0) + 1;
        });

        // Рассчитываем метрики
        const result = [];
        departmentMap.forEach((department) => {
            department.avgIssuesPerDay = department.totalIssues > 0
                ? Math.round((department.totalIssues / days) * 10) / 10
                : 0;

            department.closureRate = department.totalIssues > 0
                ? Math.round((department.closedIssues / department.totalIssues) * 100)
                : 0;

            // Находим день с максимальной активностью
            const maxOpened = Math.max(...department.dailyFrequency.opened);
            department.peakDayIndex = department.dailyFrequency.opened.indexOf(maxOpened);

            result.push(department);
        });

        return result.sort((a, b) => b.totalIssues - a.totalIssues);
    }

    /**
     * Рассчитывает рейтинг отделов
     * @private
     */
    _calculateDepartmentRankings(departmentStats) {
        if (departmentStats.length === 0) {
            return {
                mostActive: null,
                leastActive: null,
                highestClosureRate: null,
                lowestClosureRate: null,
                topByVolume: [],
                topByClosureRate: []
            };
        }

        return {
            mostActive: departmentStats[0],
            leastActive: departmentStats[departmentStats.length - 1],
            highestClosureRate: [...departmentStats]
                .sort((a, b) => b.closureRate - a.closureRate)[0],
            lowestClosureRate: [...departmentStats]
                .filter(d => d.totalIssues > 0)
                .sort((a, b) => a.closureRate - b.closureRate)[0],
            topByVolume: departmentStats.slice(0, 5),
            topByClosureRate: [...departmentStats]
                .filter(d => d.totalIssues >= 5) // Минимум 5 задач для корректной статистики
                .sort((a, b) => b.closureRate - a.closureRate)
                .slice(0, 5)
        };
    }

    /**
     * Рассчитывает общую статистику по всем отделам
     * @private
     */
    _calculateDepartmentSummary(departmentStats, days) {
        const totalIssues = departmentStats.reduce((sum, d) => sum + d.totalIssues, 0);
        const totalOpened = departmentStats.reduce((sum, d) => sum + d.openedIssues, 0);
        const totalClosed = departmentStats.reduce((sum, d) => sum + d.closedIssues, 0);
        const totalActive = departmentStats.reduce((sum, d) => sum + d.activeIssues, 0);

        const avgClosureRate = departmentStats.length > 0
            ? Math.round(departmentStats.reduce((sum, d) => sum + d.closureRate, 0) / departmentStats.length)
            : 0;

        const avgIssuesPerDept = departmentStats.length > 0
            ? Math.round((totalIssues / departmentStats.length) * 10) / 10
            : 0;

        // Агрегированная дневная частота
        const aggregatedDaily = {
            opened: Array(days).fill(0),
            closed: Array(days).fill(0)
        };

        departmentStats.forEach(dept => {
            dept.dailyFrequency.opened.forEach((count, i) => {
                aggregatedDaily.opened[i] += count;
            });
            dept.dailyFrequency.closed.forEach((count, i) => {
                aggregatedDaily.closed[i] += count;
            });
        });

        return {
            totalIssues,
            totalOpened,
            totalClosed,
            totalActive,
            overallClosureRate: totalIssues > 0 ? Math.round((totalClosed / totalIssues) * 100) : 0,
            avgClosureRate,
            avgIssuesPerDept,
            avgIssuesPerDay: totalIssues > 0 ? Math.round((totalIssues / days) * 10) / 10 : 0,
            aggregatedDailyFrequency: aggregatedDaily,
            activeDepartments: departmentStats.filter(d => d.totalIssues > 0).length,
            inactiveDepartments: departmentStats.filter(d => d.totalIssues === 0).length
        };
    }


}

export default new ActivityAnalyticsService();
