// packages/shift-service/src/routes/departmentRoutes.js
import express from 'express';
import departmentService from '../services/departmentService.js';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * GET /api/departments
 * Получение всех департаментов с фильтрацией
 */
router.get('/', async (req, res) => {
  try {
    const departments = await departmentService.getAllDepartments(req.query);

    res.status(200).json({
      success: true,
      data: departments,
      count: departments.length
    });
  } catch (error) {
    console.error('[GET /departments] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении департаментов',
      error: error.message
    });
  }
});

/**
 * GET /api/departments/active
 * Получение только активных департаментов
 */
router.get('/active', async (req, res) => {
  try {
    const departments = await departmentService.getActiveDepartments();

    res.status(200).json({
      success: true,
      data: departments,
      count: departments.length
    });
  } catch (error) {
    console.error('[GET /departments/active] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении активных департаментов',
      error: error.message
    });
  }
});

/**
 * GET /api/departments/stats
 * Получение статистики по департаментам
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await departmentService.getDepartmentStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[GET /departments/stats] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики',
      error: error.message
    });
  }
});

/**
 * GET /api/departments/check/:identifier
 * Проверка существования департамента
 */
router.get('/check/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const exists = await departmentService.checkDepartmentExists(identifier);

    res.status(200).json({
      success: true,
      exists
    });
  } catch (error) {
    console.error('[GET /departments/check] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при проверке существования',
      error: error.message
    });
  }
});

/**
 * GET /api/departments/object-id/:objectId
 * Получение департамента по ObjectId
 */
router.get('/object-id/:objectId', async (req, res) => {
  try {
    const { objectId } = req.params;
    const department = await departmentService.getDepartmentByObjectId(objectId);

    res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    console.error('[GET /departments/object-id] Ошибка:', error);

    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при получении департамента',
      error: error.message
    });
  }
});

/**
 * GET /api/departments/name/:name
 * Получение департамента по названию
 */
router.get('/name/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const department = await departmentService.getDepartmentByName(decodeURIComponent(name));

    res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    console.error('[GET /departments/name] Ошибка:', error);

    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при получении департамента',
      error: error.message
    });
  }
});

/**
 * GET /api/departments/:id
 * Получение департамента по ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID департамента'
      });
    }

    const department = await departmentService.getDepartmentById(id);

    res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    console.error(`[GET /departments/${req.params.id}] Ошибка:`, error);

    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при получении департамента',
      error: error.message
    });
  }
});

/**
 * GET /api/departments/:id/weights
 * Получение весов типов задач для департамента
 */
router.get('/:id/weights', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID департамента'
      });
    }

    const weights = await departmentService.getTaskTypeWeights(id);

    res.status(200).json({
      success: true,
      data: weights
    });
  } catch (error) {
    console.error(`[GET /departments/${req.params.id}/weights] Ошибка:`, error);

    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при получении весов',
      error: error.message
    });
  }
});

/**
 * POST /api/departments
 * Создание нового департамента
 */
router.post('/', async (req, res) => {
  try {
    const { name, ObjectId, description, active, taskTypeWeights, loadCalculationFormula } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Название департамента обязательно'
      });
    }

    if (!ObjectId || !ObjectId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'ObjectId обязателен'
      });
    }

    const departmentData = {
      name,
      ObjectId,
      description,
      active,
      taskTypeWeights,
      loadCalculationFormula
    };

    const newDepartment = await departmentService.createDepartment(departmentData);

    res.status(201).json({
      success: true,
      message: 'Департамент успешно создан',
      data: newDepartment
    });
  } catch (error) {
    console.error('[POST /departments] Ошибка:', error);

    if (error.message.includes('уже существует')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при создании департамента',
      error: error.message
    });
  }
});

/**
 * PUT /api/departments/:id
 * Полное обновление департамента
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID департамента'
      });
    }

    console.log(`[PUT /departments/${id}] Данные для обновления:`, req.body);
    console.log(req.body);

    const updatedDepartment = await departmentService.updateDepartment(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Департамент успешно обновлён',
      data: updatedDepartment
    });
  } catch (error) {
    console.error(`[PUT /departments/${req.params.id}] Ошибка:`, error);

    if (error.message.includes('не найден')) {
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
      message: 'Ошибка при обновлении департамента',
      error: error.message
    });
  }
});

/**
 * PATCH /api/departments/:id/active
 * Изменение статуса активности
 */
router.patch('/:id/active', async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID департамента'
      });
    }

    if (typeof active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Параметр active должен быть boolean'
      });
    }

    const updatedDepartment = await departmentService.toggleDepartmentStatus(id, active);

    res.status(200).json({
      success: true,
      message: `Департамент ${active ? 'активирован' : 'деактив��рован'}`,
      data: updatedDepartment
    });
  } catch (error) {
    console.error(`[PATCH /departments/${req.params.id}/active] Ошибка:`, error);

    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при изменении статуса',
      error: error.message
    });
  }
});

/**
 * PUT /api/departments/:id/weights/:typeId
 * Установка/обновление веса для типа задачи
 */
router.put('/:id/weights/:typeId', async (req, res) => {
  try {
    const { id, typeId } = req.params;
    const { weight } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID департамента'
      });
    }

    if (typeof weight !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Параметр weight должен быть числом'
      });
    }

    const updatedDepartment = await departmentService.setTypeWeight(id, typeId, weight);

    res.status(200).json({
      success: true,
      message: 'Вес типа успешно установлен',
      data: updatedDepartment
    });
  } catch (error) {
    console.error(`[PUT /departments/${req.params.id}/weights/${req.params.typeId}] Ошибка:`, error);

    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при установке веса',
      error: error.message
    });
  }
});

/**
 * DELETE /api/departments/:id/weights/:typeId
 * Удаление веса типа (возврат к дефолтному)
 */
router.delete('/:id/weights/:typeId', async (req, res) => {
  try {
    const { id, typeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID департамента'
      });
    }

    const updatedDepartment = await departmentService.removeTypeWeight(id, typeId);

    res.status(200).json({
      success: true,
      message: 'Вес типа удалён (возврат к дефолтному)',
      data: updatedDepartment
    });
  } catch (error) {
    console.error(`[DELETE /departments/${req.params.id}/weights/${req.params.typeId}] Ошибка:`, error);

    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении веса',
      error: error.message
    });
  }
});

/**
 * PUT /api/departments/:id/formula
 * Обновление формулы расчёта нагрузки
 */
router.put('/:id/formula', async (req, res) => {
  try {
    const { id } = req.params;
    const { loadCalculationFormula } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID департамента'
      });
    }

    if (!loadCalculationFormula || !loadCalculationFormula.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Формула расчёта обязательна'
      });
    }

    const updatedDepartment = await departmentService.updateDepartment(id, { loadCalculationFormula });

    res.status(200).json({
      success: true,
      message: 'Формула расчёта успешно обновлена',
      data: updatedDepartment
    });
  } catch (error) {
    console.error(`[PUT /departments/${req.params.id}/formula] Ошибка:`, error);

    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении формулы',
      error: error.message
    });
  }
});

/**
 * DELETE /api/departments/:id
 * Мягкое удаление департамента
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID департамента'
      });
    }

    await departmentService.deleteDepartment(id);

    res.status(200).json({
      success: true,
      message: 'Департамент успешно удалён'
    });
  } catch (error) {
    console.error(`[DELETE /departments/${req.params.id}] Ошибка:`, error);

    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении департамента',
      error: error.message
    });
  }
});

/**
 * POST /api/departments/:id/restore
 * Восстановление удалённого департамента
 */
router.post('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID департамента'
      });
    }

    const restoredDepartment = await departmentService.restoreDepartment(id);

    res.status(200).json({
      success: true,
      message: 'Департамент успешно восстановлён',
      data: restoredDepartment
    });
  } catch (error) {
    console.error(`[POST /departments/${req.params.id}/restore] Ошибка:`, error);

    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при восстановлении департамента',
      error: error.message
    });
  }
});

/**
 * DELETE /api/departments/:id/permanent
 * Полное удаление департамента из базы
 */
router.delete('/:id/permanent', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID департамента'
      });
    }

    await departmentService.permanentDeleteDepartment(id);

    res.status(200).json({
      success: true,
      message: 'Департамент полностью удалён из базы'
    });
  } catch (error) {
    console.error(`[DELETE /departments/${req.params.id}/permanent] Ошибка:`, error);

    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при полном удалении департамента',
      error: error.message
    });
  }
});

export default router;
