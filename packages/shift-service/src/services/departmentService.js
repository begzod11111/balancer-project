// packages/shift-service/src/services/departmentService.js
import {models} from '../models/db.js';
import mongoose from 'mongoose';

class DepartmentService {

    /**
     * Создание нового департамента
     */
    async createDepartment(departmentData) {
        try {
            const {
                name,
                ObjectId,
                description,
                active = true,
                taskTypeWeights = {},
                loadCalculationFormula
            } = departmentData;

            console.log('[createDepartment] Создание департамента:', {name, ObjectId});

            // Проверка обязательных полей
            if (!name || !name.trim()) {
                throw new Error('Название департамента обязательно');
            }

            if (!ObjectId || !ObjectId.trim()) {
                throw new Error('ObjectId обязателен');
            }

            // Проверка уникальности
            const existingByName = await models.Department.findOne({
                name: name.trim(),
                delete: false
            });

            if (existingByName) {
                throw new Error(`Департамент с названием "${name}" уже существует`);
            }

            const existingByObjectId = await models.Department.findOne({
                ObjectId: ObjectId.trim(),
                delete: false
            });

            if (existingByObjectId) {
                throw new Error(`Департамент с ObjectId "${ObjectId}" уже существует`);
            }

            // Создание департамента
            const department = new models.Department({
                name: name.trim(),
                ObjectId: ObjectId.trim(),
                description: description || '',
                active,
                taskTypeWeights: this.convertWeightsToArray(taskTypeWeights),
                loadCalculationFormula: loadCalculationFormula || 'activeIssues * 1.5 + dailyIssues'
            });

            await department.save();

            console.log('[createDepartment] Департамент создан:', department._id);

            return department;
        } catch (error) {
            console.error('[createDepartment] Ошибка:', error);
            throw error;
        }
    }

    /**
     * Получение департамента по ID
     */
    async getDepartmentById(departmentId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(departmentId)) {
                throw new Error('Некорректный ID департамента');
            }

            const department = await models.Department.findOne({
                _id: departmentId,
                delete: false
            });

            if (!department) {
                throw new Error('Департамент не найден');
            }

            return department;
        } catch (error) {
            console.error('[getDepartmentById] Ошибка:', error);
            throw error;
        }
    }

    /**
     * Получение департамента по ObjectId
     */
    async getDepartmentByObjectId(objectId) {
        try {
            if (!objectId || !objectId.trim()) {
                throw new Error('ObjectId не может быть пустым');
            }

            const department = await models.Department.findOne({
                ObjectId: objectId.trim(),
                delete: false
            });

            if (!department) {
                throw new Error('Департамент не найден');
            }

            return department;
        } catch (error) {
            console.error('[getDepartmentByObjectId] Ошибка:', error);
            throw error;
        }
    }

    /**
     * Получение департамента по названию
     */
    async getDepartmentByName(name) {
        try {
            if (!name || !name.trim()) {
                throw new Error('Название не может быть пустым');
            }

            const department = await models.Department.findOne({
                name: name.trim(),
                delete: false
            });

            if (!department) {
                throw new Error('Департамент не найден');
            }

            return department;
        } catch (error) {
            console.error('[getDepartmentByName] Ошибка:', error);
            throw error;
        }
    }

    /**
     * Получение всех департаментов с фильтрацией
     */
    async getAllDepartments(filters = {}) {
        try {
            const {
                active,
                deleted = false,
                search,
                limit = 100,
                skip = 0,
                sort = 'name'
            } = filters;

            const query = {delete: deleted === true || deleted === 'true'};

            if (active !== undefined) {
                query.active = active === true || active === 'true';
            }

            if (search && search.trim()) {
                query.$or = [
                    {name: {$regex: search.trim(), $options: 'i'}},
                    {ObjectId: {$regex: search.trim(), $options: 'i'}},
                    {description: {$regex: search.trim(), $options: 'i'}}
                ];
            }

            const sortOptions = {};
            sortOptions[sort] = 1;

            console.log('[getAllDepartments] Запрос:', query);

            const departments = await models.Department
                .find(query)
                .sort(sortOptions)
                .limit(parseInt(limit))
                .skip(parseInt(skip))
                .lean();

            console.log('[getAllDepartments] Найдено департаментов:', departments.length);

            return departments;
        } catch (error) {
            console.error('[getAllDepartments] Ошибка:', error);
            throw error;
        }
    }

    /**
     * Получение только активных департаментов
     */
    async getActiveDepartments() {
        try {
            const departments = await models.Department
                .find({
                    active: true,
                    delete: false
                })
                .sort({name: 1})
                .lean();

            console.log('[getActiveDepartments] Найдено активных департаментов:', departments.length);

            return departments;
        } catch (error) {
            console.error('[getActiveDepartments] Ошибка:', error);
            throw error;
        }
    }

    /**
     * Обновление департамента
     */
    async updateDepartment(departmentId, updateData) {
        try {
            console.log('[updateDepartment] Обновление департамента:', departmentId);
            console.log('[updateDepartment] Данные:', JSON.stringify(updateData, null, 2));

            if (!mongoose.Types.ObjectId.isValid(departmentId)) {
                throw new Error('Некорректный ID департамента');
            }


            const department = await models.Department.findOne({
                _id: departmentId,
                delete: false
            });
            if (updateData.taskTypeWeights !== undefined) {
                department.taskTypeWeights = this.convertWeightsToArray(updateData.taskTypeWeights);
            }

            if (!department) {
                throw new Error('Департамент не найден');
            }

            // Проверка уникальности при изменении name
            if (updateData.name && updateData.name !== department.name) {
                const existingByName = await models.Department.findOne({
                    name: updateData.name.trim(),
                    delete: false,
                    _id: {$ne: departmentId}
                });

                if (existingByName) {
                    throw new Error(`Департамент с названием "${updateData.name}" уже существует`);
                }
            }

            // Проверка уникальности при изменении ObjectId
            if (updateData.ObjectId && updateData.ObjectId !== department.ObjectId) {
                const existingByObjectId = await models.Department.findOne({
                    ObjectId: updateData.ObjectId.trim(),
                    delete: false,
                    _id: {$ne: departmentId}
                });

                if (existingByObjectId) {
                    throw new Error(`Департамент с ObjectId "${updateData.ObjectId}" уже существует`);
                }
            }

            // Обновление полей
            const allowedFields = ['name', 'ObjectId', 'description', 'active', 'taskTypeWeights', 'loadCalculationFormula'];

            allowedFields.forEach(field => {
                if (updateData[field] !== undefined) {
                    if (field === 'taskTypeWeights') {
                        department[field] = this.convertWeightsToArray(updateData[field]);
                    } else if (field === 'name' || field === 'ObjectId' || field === 'description') {
                        department[field] = updateData[field].trim();
                    } else {
                        department[field] = updateData[field];
                    }
                    console.log(`[updateDepartment] Обновлено поле "${field}":`, updateData[field]);
                }
            });

            department.updatedAt = new Date();

            console.log('[updateDepartment] Обновлённый департамент:', department);

            // Сохранение изменений
            const savedDepartment = await department.save();

            console.log('[updateDepartment] Департамент сохранён:', department);

            return savedDepartment;
        } catch (error) {
            console.error('[updateDepartment] Ошибка:', error);
            throw error;
        }
    }

    /**
     * Изменение статуса активности
     */
    async toggleDepartmentStatus(departmentId, active) {
        try {
            console.log('[toggleDepartmentStatus] Департамент:', departmentId, 'Статус:', active);

            if (!mongoose.Types.ObjectId.isValid(departmentId)) {
                throw new Error('Некорректный ID департамента');
            }

            if (typeof active !== 'boolean') {
                throw new Error('Параметр active должен быть boolean');
            }

            const department = await models.Department.findOne({
                _id: departmentId,
                delete: false
            });

            if (!department) {
                throw new Error('Департамент не найден');
            }

            department.active = active;
            department.updatedAt = new Date();

            const savedDepartment = await department.save();

            console.log('[toggleDepartmentStatus] Статус изменён:', savedDepartment.active);

            return savedDepartment;
        } catch (error) {
            console.error('[toggleDepartmentStatus] Ошибка:', error);
            throw error;
        }
    }

    /**
     * Мягкое удаление департамента
     */
    async deleteDepartment(departmentId) {
        try {
            console.log('[deleteDepartment] Удаление департамента:', departmentId);

            if (!mongoose.Types.ObjectId.isValid(departmentId)) {
                throw new Error('Некорректный ID департамента');
            }

            const department = await models.Department.findOne({
                _id: departmentId,
                delete: false
            });

            if (!department) {
                throw new Error('Департамент не найден');
            }

            department.delete = true;
            department.active = false;
            department.updatedAt = new Date();

            await department.save();

            console.log('[deleteDepartment] Департамент удалён:', department.name);

            return {success: true};
        } catch (error) {
            console.error('[deleteDepartment] Ошибка:', error);
            throw error;
        }
    }

    /**
     * Восстановление удалённого департамента
     */
    async restoreDepartment(departmentId) {
        try {
            console.log('[restoreDepartment] Восстановление департамента:', departmentId);

            if (!mongoose.Types.ObjectId.isValid(departmentId)) {
                throw new Error('Некорректный ID департамента');
            }

            const department = await models.Department.findOne({
                _id: departmentId,
                delete: true
            });

            if (!department) {
                throw new Error('Удалённый департамент не найден');
            }

            department.delete = false;
            department.updatedAt = new Date();

            const savedDepartment = await department.save();

            console.log('[restoreDepartment] Департамент восстановлен:', savedDepartment.name);

            return savedDepartment;
        } catch (error) {
            console.error('[restoreDepartment] Ошибка:', error);
            throw error;
        }
    }

    /**
     * Полное удаление департамента из базы
     */
    async permanentDeleteDepartment(departmentId) {
        try {
            console.log('[permanentDeleteDepartment] Полное удаление:', departmentId);

            if (!mongoose.Types.ObjectId.isValid(departmentId)) {
                throw new Error('Некорректный ID департамента');
            }

            const result = await models.Department.deleteOne({_id: departmentId});

            if (result.deletedCount === 0) {
                throw new Error('Департамент не найден');
            }

            console.log('[permanentDeleteDepartment] Департамент полностью удалён');

            return {success: true, deletedCount: result.deletedCount};
        } catch (error) {
            console.error('[permanentDeleteDepartment] Ошибка:', error);
            throw error;
        }
    }

    /**
     * Получение весов типов задач для департамента
     */
    async getTaskTypeWeights(departmentId) {
        try {
            const department = await this.getDepartmentById(departmentId);
            return department.taskTypeWeights || [];
        } catch (error) {
            console.error('[getTaskTypeWeights] Ошибка:', error);
            throw error;
        }
    }

    async setTypeWeight(departmentId, typeId, weight) {
        try {
            console.log('[setTypeWeight] Департамент:', departmentId, 'Тип:', typeId, 'Вес:', weight);

            if (!mongoose.Types.ObjectId.isValid(departmentId)) {
                throw new Error('Некорректный ID департамента');
            }

            if (!typeId || !typeId.trim()) {
                throw new Error('ID типа обязателен');
            }

            if (typeof weight !== 'number' || weight < 0.1 || weight > 10) {
                throw new Error('Вес должен быть числом от 0.1 до 10');
            }

            const department = await models.Department.findOne({
                _id: departmentId,
                delete: false
            });

            const existingIndex = department.taskTypeWeights.findIndex(
                item => item.typeId === typeId.trim()
            );

            if (existingIndex >= 0) {
                department.taskTypeWeights[existingIndex].weight = weight;
                if (typeName) {
                    department.taskTypeWeights[existingIndex].name = typeName;
                }
            } else {
                department.taskTypeWeights.push({
                    typeId: typeId.trim(),
                    name: typeName || typeId.trim(),
                    weight
                });
            }

            department.updatedAt = new Date();
            return await department.save();
        } catch (error) {
            console.error('[setTypeWeight] Ошибка:', error);
            throw error;
        }
    }


    /**
     * Удаление веса типа (возврат к дефолтному)
     */
    async removeTypeWeight(departmentId, typeId) {
        try {
            console.log('[removeTypeWeight] Департамент:', departmentId, 'Тип:', typeId);

            if (!mongoose.Types.ObjectId.isValid(departmentId)) {
                throw new Error('Неко��ректный ID департамента');
            }

            const department = await models.Department.findOne({
                _id: departmentId,
                delete: false
            });

            if (!department) {
                throw new Error('Департамент не найден');
            }

            department.taskTypeWeights = department.taskTypeWeights.filter(
                item => item.typeId !== typeId.trim()
            );
            department.updatedAt = new Date();
            return await department.save();
        } catch (error) {
            console.error('[removeTypeWeight] Ошибка:', error);
            throw error;
        }
    }

    /**
     * Получение статистики по департаментам
     */
    async getDepartmentStats() {
        try {
            const total = await models.Department.countDocuments({delete: false});
            const active = await models.Department.countDocuments({active: true, delete: false});
            const inactive = await models.Department.countDocuments({active: false, delete: false});
            const deleted = await models.Department.countDocuments({delete: true});

            return {
                total,
                active,
                inactive,
                deleted
            };
        } catch (error) {
            console.error('[getDepartmentStats] Ошибка:', error);
            throw error;
        }
    }

    /**
     * Проверка существования департамента
     */
    async checkDepartmentExists(identifier) {
        try {
            if (!identifier || !identifier.trim()) {
                return false;
            }

            const department = await models.Department.findOne({
                $or: [
                    {name: identifier.trim()},
                    {ObjectId: identifier.trim()},
                    ...(mongoose.Types.ObjectId.isValid(identifier) ? [{_id: identifier}] : [])
                ],
                delete: false
            });

            return !!department;
        } catch (error) {
            console.error('[checkDepartmentExists] Ошибка:', error);
            return false;
        }
    }

    /**
     * Вспомогательная функция: преобразование объекта весов в Map
     */
    convertWeightsToArray(weights) {
        if (!weights) return [];

        // Если уже массив — валидируем и возвращаем
        if (Array.isArray(weights)) {
            return weights.filter(item =>
                item.typeId && typeof item.weight === 'number'
            ).map(item => ({
                typeId: item.typeId,
                name: item.typeName || item.name || item.typeId,
                weight: item.weight
            }));
        }

        // Если объект — преобразуем
        if (typeof weights === 'object') {
            return Object.entries(weights).map(([typeId, value]) => {
                if (typeof value === 'number') {
                    return {typeId, name: typeId, weight: value};
                }
                if (typeof value === 'object' && value.weight !== undefined) {
                    return {
                        typeId: value.typeId || typeId,
                        name: value.typeName || value.name || typeId,
                        weight: value.weight
                    };
                }
                return null;
            }).filter(Boolean);
        }

        return [];
    }




    /**
     * Валидация весов типов задач
     */
    validateTaskTypeWeights(weights) {
        if (!weights || typeof weights !== 'object') {
            throw new Error('taskTypeWeights должен быть объектом');
        }

        for (const [typeId, weight] of Object.entries(weights)) {
            if (typeof weight !== 'number') {
                throw new Error(`Вес для типа "${typeId}" должен быть числом`);
            }
            if (weight < 0.1 || weight > 10) {
                throw new Error(`Вес для типа "${typeId}" должен быть от 0.1 до 10`);
            }
        }

        return true;
    }

    /**
     * Валидация формулы расчёта нагрузки
     */
    validateLoadFormula(formula) {
        if (!formula || typeof formula !== 'string' || !formula.trim()) {
            throw new Error('Формула расчёта нагрузки обязательна');
        }

        // Проверка на опасные символы
        const dangerousPatterns = [';', 'eval', 'Function', 'require', 'import', '__proto__'];
        const formulaLower = formula.toLowerCase();

        for (const pattern of dangerousPatterns) {
            if (formulaLower.includes(pattern.toLowerCase())) {
                throw new Error(`Формула содержит запрещённый элемент: ${pattern}`);
            }
        }

        return true;
    }
}

export default new DepartmentService();
