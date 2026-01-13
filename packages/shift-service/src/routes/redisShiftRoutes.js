// packages/shift-service/src/routes/redisShiftRoutes.js
import express from 'express';
import redisService from '../services/redisService.js';

const router = express.Router();

/**
 * POST /api/redis-shifts
 * Создание/обновление смены в Redis
 */
router.post('/', async (req, res) => {

    try {
        if (!req.body) {
            return res.status(400).json({
                success: false,
                message: 'Тело запроса не должно быть пустым'
            });
        }
        const {
            departmentId,
            departmentObjectId,
            accountId,
            assigneeEmail,
            assigneeName,
            taskTypeWeights,
            loadCalculationFormula,
            defaultMaxLoad,
            priorityMultiplier,
            completedTasksCount,
            shiftStartTime,
            shiftEndTime,
            ttl
        } = req.body;

        if (!departmentObjectId || !accountId || !assigneeEmail) {
            return res.status(400).json({
                success: false,
                message: 'Обязательные поля: departmentObjectId, accountId, assigneeEmail'
            });
        }

        const result = await redisService.setShift({
            departmentId,
            departmentObjectId,
            accountId,
            assigneeEmail,
            assigneeName: assigneeName || 'Неизвестный сотрудник',
            taskTypeWeights: taskTypeWeights || [],
            loadCalculationFormula: loadCalculationFormula || 'sum(taskWeights) / maxLoad',
            defaultMaxLoad: defaultMaxLoad || 100,
            priorityMultiplier: priorityMultiplier || 1.0,
            completedTasksCount: completedTasksCount || 0,
            shiftStartTime: shiftStartTime ? new Date(shiftStartTime) : new Date(),
            shiftEndTime: shiftEndTime ? new Date(shiftEndTime) : null
        }, ttl);

        return res.status(201).json({
            success: true,
            message: 'Смена успешно сохранена в Redis',
            data: result
        });
    } catch (error) {
        console.error('[API] Ошибка создания смены в Redis:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Ошибка сохранения смены'
        });
    }
});

// packages/shift-service/src/routes/redisShiftRoutes.js
// Добавьте этот роут в начало файла, перед другими GET роутами

/**
 * GET /api/redis-shifts/all
 * Получение всех смен из Redis
 */
router.get('/all', async (req, res) => {
  try {
    const shifts = await redisService.getAllShifts();

    return res.status(200).json({
      success: true,
      count: shifts.length,
      data: shifts
    });
  } catch (error) {
    console.error('[API] Ошибка получения всех смен:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Ошибка получения всех смен'
    });
  }
});


/**
 * GET /api/redis-shifts/:departmentObjectId/:accountId/:assigneeEmail
 * Получение конкретной смены
 */
router.get('/:departmentObjectId/:accountId/:assigneeEmail', async (req, res) => {
  try {
    const { departmentObjectId, accountId, assigneeEmail } = req.params;

    const shift = await redisService.getShift(departmentObjectId, accountId, assigneeEmail);

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Смена не найдена'
      });
    }

    return res.status(200).json({
      success: true,
      data: shift
    });
  } catch (error) {
    console.error('[API] Ошибка получения смены:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Ошибка получения смены'
    });
  }
});

/**
 * GET /api/redis-shifts/department/:departmentObjectId
 * Получение всех смен по департаменту
 */
router.get('/department/:departmentObjectId', async (req, res) => {
  try {
    const { departmentObjectId } = req.params;
    console.log(departmentObjectId)

    const shifts = await redisService.getShiftsByDepartment(departmentObjectId);

    return res.status(200).json({
      success: true,
      count: shifts.length,
      data: shifts
    });
  } catch (error) {
    console.error('[API] Ошибка получения смен по департаменту:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Ошибка получения смен'
    });
  }
});

/**
 * GET /api/redis-shifts/account/:accountId
 * Получение всех смен по аккаунту
 */
router.get('/account/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;

    const shifts = await redisService.getShiftsByAccount(accountId);

    return res.status(200).json({
      success: true,
      count: shifts.length,
      data: shifts
    });
  } catch (error) {
    console.error('[API] Ошибка получения смен по аккаунту:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Ошибка получения смен'
    });
  }
});

/**
 * GET /api/redis-shifts/email/:assigneeEmail
 * Получение всех смен по email
 */
router.get('/email/:assigneeEmail', async (req, res) => {
  try {
    const { assigneeEmail } = req.params;

    const shifts = await redisService.getShiftsByEmail(assigneeEmail);

    return res.status(200).json({
      success: true,
      count: shifts.length,
      data: shifts
    });
  } catch (error) {
    console.error('[API] Ошибка получения смен по email:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Ошибка получения смен'
    });
  }
});

/**
 * PATCH /api/redis-shifts/:departmentObjectId/:accountId/:assigneeEmail/increment
 * Увеличение счётчика выполненных задач
 */
router.patch('/:departmentObjectId/:accountId/:assigneeEmail/increment', async (req, res) => {
  try {
    const { departmentObjectId, accountId, assigneeEmail } = req.params;
    const { count = 1 } = req.body;

    const shift = await redisService.incrementCompletedTasks(
      departmentObjectId,
      accountId,
      assigneeEmail,
      count
    );

    return res.status(200).json({
      success: true,
      message: 'Счётчик обновлён',
      data: shift
    });
  } catch (error) {
    console.error('[API] Ошибка обновления счётчика:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Ошибка обновления счётчика'
    });
  }
});

/**
 * DELETE /api/redis-shifts/:departmentObjectId/:accountId/:assigneeEmail
 * Удаление конкретной смены
 */
router.delete('/:departmentObjectId/:accountId/:assigneeEmail', async (req, res) => {
  try {
    const { departmentObjectId, accountId, assigneeEmail } = req.params;

    const deleted = await redisService.deleteShift(departmentObjectId, accountId, assigneeEmail);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Смена не найдена'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Смена успешно удалена'
    });
  } catch (error) {
    console.error('[API] Ошибка удаления смены:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Ошибка удаления смены'
    });
  }
});

/**
 * DELETE /api/redis-shifts/department/:departmentObjectId
 * Удаление всех смен по департаменту
 */
router.delete('/department/:departmentObjectId', async (req, res) => {
  try {
    const { departmentObjectId } = req.params;

    const count = await redisService.deleteShiftsByDepartment(departmentObjectId);

    return res.status(200).json({
      success: true,
      message: `Удалено смен: ${count}`,
      deletedCount: count
    });
  } catch (error) {
    console.error('[API] Ошибка удаления смен по департаменту:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Ошибка удаления смен'
    });
  }
});

/**
 * GET /api/redis-shifts/:departmentObjectId/:accountId/:assigneeEmail/ttl
 * Получение TTL смены
 */
router.get('/:departmentObjectId/:accountId/:assigneeEmail/ttl', async (req, res) => {
  try {
    const { departmentObjectId, accountId, assigneeEmail } = req.params;

    const ttl = await redisService.getTTL(departmentObjectId, accountId, assigneeEmail);

    if (ttl === -2) {
      return res.status(404).json({
        success: false,
        message: 'Смена не найдена'
      });
    }

    return res.status(200).json({
      success: true,
      ttl: ttl === -1 ? null : ttl,
      message: ttl === -1 ? 'TTL не установлен' : `TTL: ${ttl} секунд`
    });
  } catch (error) {
    console.error('[API] Ошибка получения TTL:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Ошибка получения TTL'
    });
  }
});

/**
 * PATCH /api/redis-shifts/:departmentObjectId/:accountId/:assigneeEmail/ttl
 * Обновление TTL смены
 */
router.patch('/:departmentObjectId/:accountId/:assigneeEmail/ttl', async (req, res) => {
  try {
    const { departmentObjectId, accountId, assigneeEmail } = req.params;
    const { ttl } = req.body;

    if (!ttl || ttl < 1) {
      return res.status(400).json({
        success: false,
        message: 'TTL должен быть больше 0'
      });
    }

    const updated = await redisService.updateTTL(departmentObjectId, accountId, assigneeEmail, ttl);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Смена не найдена'
      });
    }

    return res.status(200).json({
      success: true,
      message: `TTL обновлён: ${ttl} секунд`
    });
  } catch (error) {
    console.error('[API] Ошибка обновления TTL:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Ошибка обновления TTL'
    });
  }
});

/**
 * GET /api/redis-shifts/:departmentObjectId/:accountId/:assigneeEmail/exists
 * Проверка существования смены
 */
router.get('/:departmentObjectId/:accountId/:assigneeEmail/exists', async (req, res) => {
  try {
    const { departmentObjectId, accountId, assigneeEmail } = req.params;

    const exists = await redisService.exists(departmentObjectId, accountId, assigneeEmail);

    return res.status(200).json({
      success: true,
      exists
    });
  } catch (error) {
    console.error('[API] Ошибка проверки существования:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Ошибка проверки'
    });
  }
});

/**
 * GET /api/redis-shifts/stats
 * Получение статистики по всем сменам
 */
router.get('/stats/all', async (req, res) => {
  try {
    const stats = await redisService.getStats();

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[API] Ошибка получения статистики:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Ошибка получения статистики'
    });
  }
});

export default router;
