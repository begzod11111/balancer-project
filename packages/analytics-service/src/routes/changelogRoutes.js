// packages/analytics-service/src/routes/changelogRoutes.js
import express from 'express';
import changelogService from '../services/changelogService.js';

const router = express.Router();

/**
 * POST /api/changelog/save
 * Сохранение нового changelog события
 */
router.post('/save', async (req, res) => {
  try {
    const { issueId, issueKey, assigneeAccountId, eventType, user, changelogItem, departmentId } = req.body;

    if (!issueId || !issueKey || !eventType || !user || !changelogItem) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны обязательные поля: issueId, issueKey, eventType, user, changelogItem'
      });
    }

    const result = await changelogService.saveChangelog(
      issueId,
      issueKey,
      assigneeAccountId,
      eventType,
      user,
      changelogItem,
      departmentId
    );

    res.status(201).json({
      success: true,
      message: 'Changelog событие сохранено',
      data: result
    });
  } catch (error) {
    console.error('[POST /changelog/save] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при сохранении события',
      error: error.message
    });
  }
});

/**
 * POST /api/changelog/bulk
 * Пакетное сохранение логов
 */
router.post('/bulk', async (req, res) => {
  try {
    const { issueId, issueKey, departmentId, histories } = req.body;

    if (!issueId || !issueKey || !Array.isArray(histories) || histories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны обязательные поля: issueId, issueKey, histories (массив)'
      });
    }

    const result = await changelogService.saveBulkChangelogs(issueId, issueKey, departmentId, histories);

    res.status(201).json({
      success: true,
      message: `Сохранено событий: ${result.added}`,
      data: result
    });
  } catch (error) {
    console.error('[POST /changelog/bulk] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при пакетном сохранении событий',
      error: error.message
    });
  }
});

// ========== НОВАЯ СИСТЕМА ПОИСКА ==========

/**
 * GET /api/changelog/search
 * Универсальный поиск с фильтрами (миллисекунды)
 * Query params: authorAccountId, departmentId, issueKey, eventType, field, startDate, endDate, limit, skip, sort
 */
router.get('/search', async (req, res) => {
  try {
    const filters = {};

    // Основные фильтры
    if (req.query.authorAccountId) filters.authorAccountId = req.query.authorAccountId;
    if (req.query.toAccountId) filters.toAccountId = req.query.toAccountId;
    if (req.query.fromAccountId) filters.fromAccountId = req.query.fromAccountId;
    if (req.query.departmentId) filters.departmentId = req.query.departmentId;
    if (req.query.issueKey) filters.issueKey = req.query.issueKey;
    if (req.query.issueId) filters.issueId = req.query.issueId;
    if (req.query.eventType) filters.eventType = req.query.eventType;
    if (req.query.field) filters.field = req.query.field;

    // Временные фильтры (миллисекунды)
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;

    // Пагинация и сортировка
    if (req.query.limit) filters.limit = req.query.limit;
    if (req.query.skip) filters.skip = req.query.skip;
    if (req.query.sort) filters.sort = req.query.sort;

    const result = await changelogService.search(filters);

    res.status(200).json(result);
  } catch (error) {
    console.error('[GET /changelog/search] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при поиске',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/employee-activity/:accountId
 * Детальная активность сотрудника (миллисекунды)
 * Query params: startDate, endDate (обязательны, в миллисекундах)
 */
router.get('/employee-activity/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { startDate, endDate, departmentId, eventType } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Параметры startDate и endDate обязательны (в миллисекундах)'
      });
    }

    const result = await changelogService.getEmployeeActivity(
      accountId,
      startDate,
      endDate,
      { departmentId, eventType }
    );

    res.status(200).json(result);
  } catch (error) {
    console.error(`[GET /changelog/employee-activity/${req.params.accountId}] Ошибка:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении активности сотрудника',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/department-activity/:departmentId
 * Детальная активность департамента (миллисекунды)
 * Query params: startDate, endDate (обязательны, в миллисекундах)
 */
router.get('/department-activity/:departmentId', async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { startDate, endDate, eventType } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Параметры startDate и endDate обязательны (в миллисекундах)'
      });
    }

    const result = await changelogService.getDepartmentActivity(
      departmentId,
      startDate,
      endDate,
      { eventType }
    );

    res.status(200).json(result);
  } catch (error) {
    console.error(`[GET /changelog/department-activity/${req.params.departmentId}] Ошибка:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении активности департамента',
      error: error.message
    });
  }
});

/**
 * POST /api/changelog/team-activity
 * Активность команды (миллисекунды)
 * Body: { accountIds: string[], startDate: number, endDate: number, departmentId?, eventType? }
 */
router.post('/team-activity', async (req, res) => {
  try {
    const { accountIds, startDate, endDate, departmentId, eventType } = req.body;

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'accountIds должен быть непустым массивом'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Параметры startDate и endDate обязательны (в миллисекундах)'
      });
    }

    const result = await changelogService.getTeamActivity(
      accountIds,
      startDate,
      endDate,
      { departmentId, eventType }
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('[POST /changelog/team-activity] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении активности команды',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/all
 * Все логи с пагинацией (миллисекунды)
 * Query params: startDate, endDate, departmentId, eventType, limit, skip, sort
 */
router.get('/all', async (req, res) => {
  try {
    const result = await changelogService.getAllLogs(req.query);
    res.status(200).json(result);
  } catch (error) {
    console.error('[GET /changelog/all] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении всех логов',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/stats
 * Статистика по периоду (миллисекунды)
 * Query params: startDate, endDate (обязательны), departmentId, eventType, authorAccountId
 */
router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate, departmentId, eventType, authorAccountId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Параметры startDate и endDate обязательны (в миллисекундах)'
      });
    }

    const result = await changelogService.getTimeRangeStats(
      startDate,
      endDate,
      { departmentId, eventType, authorAccountId }
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('[GET /changelog/stats] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/count
 * Подсчет событий
 * Query params: любые фильтры (authorAccountId, departmentId, issueKey, eventType, startDate, endDate)
 */
router.get('/count', async (req, res) => {
  try {
    const result = await changelogService.count(req.query);
    res.status(200).json(result);
  } catch (error) {
    console.error('[GET /changelog/count] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при подсчете событий',
      error: error.message
    });
  }
});

// ========== СТАРЫЕ МЕТОДЫ (для обратной совместимости) ==========

/**
 * GET /api/changelog/issue/:issueId
 * История изменений задачи
 */
router.get('/issue/:issueId', async (req, res) => {
  try {
    const { issueId } = req.params;
    const events = await changelogService.getChangelog(issueId);

    res.status(200).json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error(`[GET /changelog/issue/${req.params.issueId}] Ошибка:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении истории задачи',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/assignment-history/:issueId
 * История назначений
 */
router.get('/assignment-history/:issueId', async (req, res) => {
  try {
    const { issueId } = req.params;
    const history = await changelogService.getAssignmentHistory(issueId);

    res.status(200).json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error(`[GET /changelog/assignment-history/${req.params.issueId}] Ошибка:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении истории назначений',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/status-history/:issueId
 * История статусов
 */
router.get('/status-history/:issueId', async (req, res) => {
  try {
    const { issueId } = req.params;
    const history = await changelogService.getStatusHistory(issueId);

    res.status(200).json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error(`[GET /changelog/status-history/${req.params.issueId}] Ошибка:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении истории статусов',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/event-type/:issueId/:eventType
 * История по типу события
 */
router.get('/event-type/:issueId/:eventType', async (req, res) => {
  try {
    const { issueId, eventType } = req.params;
    const events = await changelogService.getHistoryByEventType(issueId, eventType);

    res.status(200).json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error(`[GET /changelog/event-type/${req.params.issueId}/${req.params.eventType}] Ошибка:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении истории по типу события',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/assignment-matrix
 * Матрица назначений (миллисекунды)
 */
router.get('/assignment-matrix', async (req, res) => {
  try {
    const { startDate, endDate, departmentId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Параметры startDate и endDate обязательны (в миллисекундах)'
      });
    }

    const matrix = await changelogService.getAssignmentMatrix(startDate, endDate, departmentId || null);

    res.status(200).json({
      success: true,
      data: matrix
    });
  } catch (error) {
    console.error('[GET /changelog/assignment-matrix] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении матрицы назначений',
      error: error.message
    });
  }
});

export default router;
