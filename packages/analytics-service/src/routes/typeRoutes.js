// packages/analytics-service/src/routes/typeRoutes.js
import express from 'express';
import typeService from '../services/typeService.js';

const router = express.Router();

/**
 * GET /api/types
 * Получение всех типов с фильтрацией
 */
router.get('/', async (req, res) => {
    try {

        const filters = {
            active: req.query.active === 'true' ? true
                  : req.query.active === 'false' ? false
                  : undefined,
            deleted: req.query.deleted === 'true',
            category: req.query.category || null,
            search: req.query.search || '',
            limit: parseInt(req.query.limit, 10) || 100,
            skip: parseInt(req.query.skip, 10) || 0,
            sort: req.query.sort || 'name'
        };

        const types = await typeService.getAllTypes(filters);

        res.status(200).json({
            success: true,
            count: types.length,
            data: types
        });
    } catch (error) {
        console.error('Ошибка получения типов:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось получить типы',
            error: error.message
        });
    }
});

/**
 * GET /api/types/active
 * Получение только активных типов
 */
router.get('/active', async (req, res) => {
    try {
        const types = await typeService.getActiveTypes();

        res.status(200).json({
            success: true,
            count: types.length,
            data: types
        });
    } catch (error) {
        console.error('Ошибка получения активных типов:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось получить активные типы',
            error: error.message
        });
    }
});

/**
 * GET /api/types/stats
 * Получение статистики по типам
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await typeService.getTypeStats();

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось получить статистику',
            error: error.message
        });
    }
});

/**
 * GET /api/types/category/:category
 * Получение типов по категории
 */
router.get('/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const types = await typeService.getTypesByCategory(category);

        res.status(200).json({
            success: true,
            count: types.length,
            data: types
        });
    } catch (error) {
        console.error('Ошибка получения типов по категории:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось получить типы',
            error: error.message
        });
    }
});

/**
 * GET /api/types/:id
 * Получение типа по ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const type = await typeService.getTypeById(id);

        res.status(200).json({
            success: true,
            data: type
        });
    } catch (error) {
        console.error('Ошибка получения типа:', error);

        if (error.message === 'Тип не найден') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Не удалось получить тип',
            error: error.message
        });
    }
});

/**
 * GET /api/types/type-id/:typeId
 * Получение типа по typeId (Jira ID)
 */
router.get('/type-id/:typeId', async (req, res) => {
    try {
        const { typeId } = req.params;
        const type = await typeService.getTypeByTypeId(typeId);

        res.status(200).json({
            success: true,
            data: type
        });
    } catch (error) {
        console.error('Ошибка получения типа:', error);

        if (error.message.includes('не найден')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Не удалось получить тип',
            error: error.message
        });
    }
});

/**
 * POST /api/types
 * Создание нового типа
 */
router.post('/', async (req, res) => {
    try {
        const {
            name,
            typeId,
            description,
            icon,
            color,
            defaultWeight,
            category,
            active
        } = req.body;

        if (!name || !typeId) {
            return res.status(400).json({
                success: false,
                message: 'Поля name и typeId обязательны'
            });
        }

        const type = await typeService.createType({
            name,
            typeId,
            description,
            icon,
            color,
            defaultWeight,
            category,
            active
        });

        res.status(201).json({
            success: true,
            message: 'Тип успешно создан',
            data: type
        });
    } catch (error) {
        console.error('Ошибка создания типа:', error);

        if (error.message.includes('уже существует')) {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Не удалось создать тип',
            error: error.message
        });
    }
});

/**
 * POST /api/types/sync-jira
 * Синхронизация типов из Jira
 */
router.post('/sync-jira', async (req, res) => {
    try {
        const { types } = req.body;

        if (!types || !Array.isArray(types)) {
            return res.status(400).json({
                success: false,
                message: 'Поле types должно быть массивом'
            });
        }

        const results = await typeService.createTypesFromJira(types);

        res.status(200).json({
            success: true,
            message: 'Синхронизация завершена',
            data: results
        });
    } catch (error) {
        console.error('Ошибка синхронизации типов:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось синхронизировать типы',
            error: error.message
        });
    }
});

/**
 * PUT /api/types/:id
 * Обновление типа
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const type = await typeService.updateType(id, updateData);

        res.status(200).json({
            success: true,
            message: 'Тип успешно обновлен',
            data: type
        });
    } catch (error) {
        console.error('Ошибка обновления типа:', error);

        if (error.message === 'Тип не найден') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        if (error.message.includes('уже существует')) {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Не удалось обновить тип',
            error: error.message
        });
    }
});

/**
 * PATCH /api/types/:id/active
 * Изменение статуса активности
 */
router.patch('/:id/active', async (req, res) => {
    try {
        const { id } = req.params;
        const { active } = req.body;

        if (typeof active !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Поле active должно быть boolean'
            });
        }

        const type = await typeService.toggleTypeStatus(id, active);

        res.status(200).json({
            success: true,
            message: `Тип ${active ? 'активирован' : 'деактивирован'}`,
            data: type
        });
    } catch (error) {
        console.error('Ошибка изменения статуса:', error);

        if (error.message === 'Тип не найден') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Не удалось изменить статус',
            error: error.message
        });
    }
});

/**
 * DELETE /api/types/:id
 * Мягкое удаление типа
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const type = await typeService.deleteType(id);

        res.status(200).json({
            success: true,
            message: 'Тип успешно удален',
            data: type
        });
    } catch (error) {
        console.error('Ошибка удаления типа:', error);

        if (error.message === 'Тип не найден') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Не удалось удалить тип',
            error: error.message
        });
    }
});

/**
 * POST /api/types/:id/restore
 * Восстановление типа
 */
router.post('/:id/restore', async (req, res) => {
    try {
        const { id } = req.params;
        const type = await typeService.restoreType(id);

        res.status(200).json({
            success: true,
            message: 'Тип успешно восстановлен',
            data: type
        });
    } catch (error) {
        console.error('Ошибка восстановления типа:', error);

        if (error.message.includes('не найден')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Не удалось восстановить тип',
            error: error.message
        });
    }
});

/**
 * DELETE /api/types/:id/permanent
 * Полное удаление типа
 */
router.delete('/:id/permanent', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await typeService.permanentDeleteType(id);

        res.status(200).json({
            success: true,
            message: 'Тип полностью удален',
            data: result
        });
    } catch (error) {
        console.error('Ошибка полного удаления:', error);

        if (error.message === 'Тип не найден') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Не удалось полностью удалить тип',
            error: error.message
        });
    }
});

/**
 * GET /api/types/check/:identifier
 * Проверка существования типа
 */
router.get('/check/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        const exists = await typeService.typeExists(identifier);

        res.status(200).json({
            success: true,
            exists
        });
    } catch (error) {
        console.error('Ошибка проверки существования:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось проверить существование типа',
            error: error.message
        });
    }
});

export default router;
