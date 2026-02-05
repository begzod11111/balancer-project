// packages/analytics-service/src/services/typeService.js
import { models } from '../models/db.js';

class TypeService {
    /**
     * Получение всех типов задач
     */
    async getAllTypes(filters = {}) {
        try {
            const {
                active,
                deleted = false, // По умолчанию НЕ удалённые
                category,
                search,
                limit = 100,
                skip = 0,
                sort = 'name'
            } = filters;

            const query = {deleted}; // Всегда фильтруем по deleted

            // Фильтр по активности
            if (active !== null && active !== undefined) {
                query.active = active;
            }

            // Фильтр по категории
            if (category) {
                query.category = category;
            }

            // Поиск
            if (search && search.trim()) {
                query.$or = [
                    {name: {$regex: search, $options: 'i'}},
                    {typeId: {$regex: search, $options: 'i'}},
                    {description: {$regex: search, $options: 'i'}}
                ];
            }

            console.log('[TypeService] Query:', JSON.stringify(query, null, 2));

            const types = await models.Type
                .find(query)
                .sort({[sort]: sort === 'name' ? 1 : -1})
                .limit(Number(limit))
                .skip(Number(skip))
                .lean();

            console.log(`[TypeService] Найдено: ${types.length}`);
            return types;
        } catch (error) {
            console.error('[TypeService] Ошибка getAllTypes:', error);
            throw error;
        }
    }


    /**
     * Получение активных типов
     */
    async getActiveTypes() {
        return await this.getAllTypes({active: true, deleted: false});
    }

    /**
     * Получение типа по ID
     */
    async getTypeById(id) {
        try {
            const type = await models.Type.findOne({
                _id: id,
                deleted: false
            });

            if (!type) {
                throw new Error('Тип не найден');
            }

            return type;
        } catch (error) {
            console.error(`Ошибка получения типа ${id}:`, error);
            throw error;
        }
    }

    /**
     * Получение типа по typeId (Jira ID)
     */
    async getTypeByTypeId(typeId) {
        try {
            const type = await models.Type.findOne({
                typeId,
                deleted: false
            });

            if (!type) {
                throw new Error(`Тип с typeId ${typeId} не найден`);
            }

            return type;
        } catch (error) {
            console.error(`Ошибка получения типа по typeId ${typeId}:`, error);
            throw error;
        }
    }

    /**
     * Получение типов по категории
     */
    async getTypesByCategory(category) {
        try {
            return await models.Type.find({
                category,
                active: true,
                deleted: false
            }).sort({name: 1});
        } catch (error) {
            console.error(`Ошибка получения типов категории ${category}:`, error);
            throw error;
        }
    }

    /**
     * Создание нового типа
     */
    async createType(typeData) {
        try {
            const {
                name,
                typeId,
                description,
                icon,
                color,
                defaultWeight = 1.0,
                category = 'task',
                active = true
            } = typeData;

            // Валидация обязательных полей
            if (!name || !typeId) {
                throw new Error('Поля name и typeId обязательны');
            }

            // Проверка уникальности
            const existingType = await models.Type.findOne({
                $or: [{name}, {typeId}],
                deleted: false
            });

            const isValidFromJira = await this.validateTypeIdWithJira(typeId);
            if (!isValidFromJira) {
                throw new Error(`typeId "${typeId}" не найден в Jira`);
            }

            if (existingType) {
                throw new Error(`Тип с именем "${name}" или typeId "${typeId}" уже существует`);
            }

            // Валидация веса
            if (defaultWeight < 0.1 || defaultWeight > 10) {
                throw new Error('Вес должен быть в диапазоне от 0.1 до 10');
            }

            const type = new models.Type({
                name,
                typeId,
                description,
                icon,
                color,
                defaultWeight,
                category,
                active,
                deleted: false
            });

            await type.save();
            console.log(`Тип "${name}" (${typeId}) создан`);
            return type;
        } catch (error) {
            console.error('Ошибка создания типа:', error);
            throw error;
        }
    }

    /**
     * Валидация typeId с Jira
     */
    async validateTypeIdWithJira(typeId) {
        try {
            const axios = (await import('axios')).default;

            const auth = {
                username: process.env.JIRA_USERNAME,
                password: process.env.JIRA_API_TOKEN
            };

            const jiraUrl = process.env.JIRA_URL;

            // Получаем все статусы проекта
            const projectResponse = await axios.get(
                `https://${jiraUrl}/rest/api/3/issuetype/${typeId}`,
                {auth}
            );
            return projectResponse.status === 200

        } catch (error) {
            console.error('Ошибка валидации typeId с Jira:', error);
            return false; // В случае ошибки считаем typeId невалидным
        }
    }

    /**
     * Массовое создание типов (из Jira)
     */
    async createTypesFromJira(jiraTypes) {
        try {
            const results = {
                created: 0,
                updated: 0,
                skipped: 0,
                errors: []
            };

            for (const jiraType of jiraTypes) {
                try {
                    const existingType = await models.Type.findOne({
                        typeId: jiraType.id,
                        deleted: false
                    });

                    if (existingType) {
                        // Обновляем существующий
                        existingType.name = jiraType.name;
                        existingType.description = jiraType.description || existingType.description;
                        existingType.icon = jiraType.iconUrl || existingType.icon;
                        await existingType.save();
                        results.updated++;
                    } else {
                        // Создаем новый
                        await this.createType({
                            name: jiraType.name,
                            typeId: jiraType.id,
                            description: jiraType.description,
                            icon: jiraType.iconUrl,
                            category: this.mapJiraTypeToCategory(jiraType.name)
                        });
                        results.created++;
                    }
                } catch (error) {
                    results.errors.push({
                        typeId: jiraType.id,
                        error: error.message
                    });
                }
            }

            console.log(`Синхронизация типов: создано ${results.created}, обновлено ${results.updated}`);
            return results;
        } catch (error) {
            console.error('Ошибка массового создания типов:', error);
            throw error;
        }
    }

    /**
     * Маппинг типов Jira на категории
     */
    mapJiraTypeToCategory(typeName) {
        const lowerName = typeName.toLowerCase();

        if (lowerName.includes('bug')) return 'bug';
        if (lowerName.includes('story')) return 'story';
        if (lowerName.includes('epic')) return 'epic';
        if (lowerName.includes('subtask') || lowerName.includes('sub-task')) return 'subtask';

        return 'task';
    }

    /**
     * Обновление типа
     */
    async updateType(id, updateData) {
        try {
            const {
                name,
                description,
                icon,
                color,
                defaultWeight,
                category,
                active
            } = updateData;

            const type = await models.Type.findOne({_id: id, deleted: false});

            if (!type) {
                throw new Error('Тип не найден');
            }

            // Проверка уникальности имени
            if (name && name !== type.name) {
                const existingType = await models.Type.findOne({
                    name,
                    _id: {$ne: id},
                    deleted: false
                });

                if (existingType) {
                    throw new Error(`Тип с именем "${name}" уже существует`);
                }
            }

            // Валидация веса
            if (defaultWeight !== undefined && (defaultWeight < 0.1 || defaultWeight > 10)) {
                throw new Error('Вес должен быть в диапазоне от 0.1 до 10');
            }

            // Обновление полей
            if (name) type.name = name;
            if (description !== undefined) type.description = description;
            if (icon !== undefined) type.icon = icon;
            if (color !== undefined) type.color = color;
            if (defaultWeight !== undefined) type.defaultWeight = defaultWeight;
            if (category) type.category = category;
            if (active !== undefined) type.active = active;

            await type.save();
            console.log(`Тип "${type.name}" обновлен`);
            return type;
        } catch (error) {
            console.error(`Ошибка обновления типа ${id}:`, error);
            throw error;
        }
    }

    /**
     * Изменение статуса активности
     */
    async toggleTypeStatus(id, active) {
        try {
            const type = await models.Type.findOneAndUpdate(
                {_id: id, deleted: false},
                {$set: {active}},
                {new: true}
            );

            if (!type) {
                throw new Error('Тип не найден');
            }

            console.log(`Тип "${type.name}" ${active ? 'активирован' : 'деактивирован'}`);
            return type;
        } catch (error) {
            console.error(`Ошибка изменения статуса типа ${id}:`, error);
            throw error;
        }
    }

    /**
     * Мягкое удаление типа
     */
    async deleteType(id) {
        try {
            const type = await models.Type.findOneAndUpdate(
                {_id: id, deleted: false},
                {
                    $set: {
                        deleted: true,
                        active: false,
                        deletedAt: new Date()
                    }
                },
                {new: true}
            );

            if (!type) {
                throw new Error('Тип не найден');
            }

            console.log(`Тип "${type.name}" удален`);
            return type;
        } catch (error) {
            console.error(`Ошибка удаления типа ${id}:`, error);
            throw error;
        }
    }

    /**
     * Восстановление типа
     */
    async restoreType(id) {
        try {
            const type = await models.Type.findOneAndUpdate(
                {_id: id, deleted: true},
                {
                    $set: {
                        deleted: false,
                        active: true
                    },
                    $unset: {deletedAt: 1}
                },
                {new: true}
            );

            if (!type) {
                throw new Error('Удаленный тип не найден');
            }

            console.log(`Тип "${type.name}" восстановлен`);
            return type;
        } catch (error) {
            console.error(`Ошибка восстановления типа ${id}:`, error);
            throw error;
        }
    }

    /**
     * Полное удаление типа
     */
    async permanentDeleteType(id) {
        try {
            const result = await models.Type.findByIdAndDelete(id);

            if (!result) {
                throw new Error('Тип не найден');
            }

            console.log(`Тип "${result.name}" полностью удален из базы`);
            return result;
        } catch (error) {
            console.error(`Ошибка полного удаления типа ${id}:`, error);
            throw error;
        }
    }

    async getTypeStats() {
        try {
            const [total, active, deleted, byCategory] = await Promise.all([
                models.Type.countDocuments({deleted: false}),
                models.Type.countDocuments({active: true, deleted: false}),
                models.Type.countDocuments({deleted: true}),
                models.Type.aggregate([
                    {$match: {deleted: false}},
                    {
                        $group: {
                            _id: '$category',
                            count: {$sum: 1},
                            avgWeight: {$avg: '$defaultWeight'}
                        }
                    }
                ])
            ]);

            const categoriesMap = {};
            byCategory.forEach(cat => {
                categoriesMap[cat._id] = {
                    count: cat.count,
                    avgWeight: Math.round(cat.avgWeight * 10) / 10
                };
            });

            return {
                total,
                active,
                deleted,
                inactive: total - active,
                byCategory: categoriesMap
            };
        } catch (error) {
            console.error('[TypeService] Ошибка getTypeStats:', error);
            throw error;
        }
    }


    /**
     * Проверка существования типа
     */
    async typeExists(identifier) {
        try {
            const type = await models.Type.findOne({
                $or: [
                    {_id: identifier},
                    {typeId: identifier},
                    {name: identifier}
                ],
                deleted: false
            });

            return !!type;
        } catch (error) {
            return false;
        }
    }

    /**
     * Обновление статусов типа с проверкой из Jira
     * @param {string} id - ID типа
     * @param {Array} statuses - Массив статусов
     * @param {boolean} validateFromJira - Проверять ли статусы в Jira
     * @returns {Promise<Object>} - Обновленный тип
     */
    async updateTypeStatuses(id, statuses, validateFromJira = false) {
        try {
            // Валидация входных данных
            if (!Array.isArray(statuses)) {
                throw new Error('Статусы должны быть массивом');
            }

            // Валидация каждого статуса
            for (const status of statuses) {
                if (!status.id || !status.name) {
                    throw new Error('Каждый статус должен содержать поля id и name');
                }
            }

            // Проверка наличия типа
            const type = await models.Type.findOne({_id: id, deleted: false});

            if (!type) {
                throw new Error('Тип не найден');
            }

            // Проверка статусов из Jira (если требуется)
            if (validateFromJira) {
                const validStatuses = await this.validateStatusesFromJira(type.typeId, statuses);
                if (validStatuses.invalid.length > 0) {
                    throw new Error(
                        `Недействительные статусы: ${validStatuses.invalid.map(s => s.name).join(', ')}`
                    );
                }
            }

            // Обновление статусов
            type.statuses = statuses.map(status => ({
                id: status.id,
                name: status.name,
                untranslatedName: status.untranslatedName || status.name,
                self: status.self || ''
            }));

            await type.save();

            console.log(`Статусы типа "${type.name}" обновлены (${statuses.length} статусов)`);
            return type;
        } catch (error) {
            console.error(`Ошибка обновления статусов типа ${id}:`, error);
            throw error;
        }
    }

    /**
     * Проверка статусов из Jira
     * @param {string} typeId - ID типа в Jira
     * @param {Array} statuses - Массив статусов для проверки
     * @returns {Promise<Object>} - Результат проверки
     */
    async validateStatusesFromJira(typeId, statuses) {
        try {
            const axios = (await import('axios')).default;

            const auth = {
                username: process.env.JIRA_USERNAME,
                password: process.env.JIRA_API_TOKEN
            };

            const jiraUrl = process.env.JIRA_URL;

            // Получаем все статусы проекта
            const projectKey = process.env.DEFAULT_PROJECT_KEY || 'UAS';
            const projectResponse = await axios.get(
                `https://${jiraUrl}/rest/api/3/project/${projectKey}/statuses`,
                {auth}
            );

            console.log(projectResponse)

            if (!projectResponse.data || !Array.isArray(projectResponse.data)) {
                throw new Error('Не удалось получить статусы из Jira');
            }

            // Находим статусы для конкретного типа
            const typeStatuses = projectResponse.data.find(item => item.id === typeId);

            if (!typeStatuses || !typeStatuses.statuses) {
                throw new Error(`Статусы для типа ${typeId} не найдены`);
            }

            const jiraStatuses = typeStatuses.statuses;
            const jiraStatusIds = new Set(jiraStatuses.map(s => s.id));

            // Проверяем каждый статус
            const valid = [];
            const invalid = [];

            for (const status of statuses) {
                if (jiraStatusIds.has(status.id)) {
                    valid.push(status);
                } else {
                    invalid.push(status);
                }
            }

            return {valid, invalid, jiraStatuses};
        } catch (error) {
            console.error('Ошибка проверки статусов из Jira:', error);
            return {
                valid: statuses,
                invalid: [],
                jiraStatuses: [],
                error: error.message
            };
        }
    }

    /**
     * Синхронизация статусов с Jira
     * @param {string} id - ID типа
     * @returns {Promise<Object>} - Обновленный тип
     */
    async syncStatusesFromJira(id) {
        try {
            const type = await models.Type.findOne({_id: id, deleted: false});
            console.log(type);
            if (!type) {
                throw new Error('Тип не найден');
            }

            const axios = (await import('axios')).default;

            const auth = {
                username: process.env.JIRA_USERNAME,
                password: process.env.JIRA_API_TOKEN
            };

            const jiraUrl = process.env.JIRA_URL;
            const projectKey = process.env.DEFAULT_PROJECT_KEY || 'UAS';

            // Получаем все статусы проекта
            const projectResponse = await axios.get(
                `https://${jiraUrl}/rest/api/3/project/${projectKey}/statuses`,
                {auth}
            );

            console.log(projectResponse)

            if (!projectResponse.data || !Array.isArray(projectResponse.data)) {
                throw new Error('Не удалось получить статусы из Jira');
            }

            // Находим статусы для конкретного типа
            const typeStatuses = projectResponse.data.find(item => item.id === type.typeId);

            if (!typeStatuses || !typeStatuses.statuses) {
                throw new Error(`Статусы для типа ${type.typeId} не найдены в проекте`);
            }

            // Маппим статусы
            const jiraStatuses = typeStatuses.statuses.map(status => ({
                id: status.id,
                name: status.name,
                untranslatedName: status.untranslatedName || status.name,
                self: status.self,
                statusCategory: status.statusCategory ? {
                    id: status.statusCategory.id,
                    key: status.statusCategory.key,
                    name: status.statusCategory.name,
                    colorName: status.statusCategory.colorName
                } : undefined
            }));

            // Обновляем статусы
            type.statuses = jiraStatuses;
            await type.save();

            console.log(`Статусы типа "${type.name}" синхронизированы с Jira (${jiraStatuses.length} статусов)`);
            return type;
        } catch (error) {
            console.error(`Ошибка синхронизации статусов типа ${id}:`, error);
            throw error;
        }
    }



}

export default new TypeService();
