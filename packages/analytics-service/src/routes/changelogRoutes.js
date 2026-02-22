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
    const { issueId, issueKey, assigneeAccountId, eventType, user, changelogItem } = req.body;

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
      changelogItem
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

/**
 * GET /api/changelog/issue/:issueId
 * Получение истории изменений задачи
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
 * Получение истории назначений
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
 * Получение истории изменений статусов
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
 * GET /api/changelog/employee-stats/:accountId
 * Статистика по сотруднику
 */
router.get('/employee-stats/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны обязательные параметры: startDate, endDate'
      });
    }

    const stats = await changelogService.getEmployeeStats(accountId, startDate, endDate);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error(`[GET /changelog/employee-stats/${req.params.accountId}] Ошибка:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики сотрудника',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/department-activity/:departmentId
 * Получение активности по департаменту
 */
router.get('/department-activity/:departmentId', async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны обязательные параметры: startDate, endDate'
      });
    }

    const activity = await changelogService.getDepartmentActivity(departmentId, startDate, endDate);

    res.status(200).json({
      success: true,
      data: activity
    });
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
 * GET /api/changelog/event-type/:issueId/:eventType
 * Получение истории по типу события
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
 * GET /api/changelog/event-type-stats
 * Статистика по типам событий
 */
router.get('/event-type-stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны обязательные параметры: startDate, endDate'
      });
    }

    const stats = await changelogService.getEventTypeStats(startDate, endDate);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[GET /changelog/event-type-stats] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики по типам событий',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/author-actions/:authorAccountId
 * Действия автора за период
 */
router.get('/author-actions/:authorAccountId', async (req, res) => {
  try {
    const { authorAccountId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны обязательные параметры: startDate, endDate'
      });
    }

    const actions = await changelogService.getAuthorActions(authorAccountId, startDate, endDate);

    res.status(200).json({
      success: true,
      data: actions,
      count: actions.length
    });
  } catch (error) {
    console.error(`[GET /changelog/author-actions/${req.params.authorAccountId}] Ошибка:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении действий автора',
      error: error.message
    });
  }
});

/**
 * POST /api/changelog/group-actions
 * Действия группы людей
 */
router.post('/group-actions', async (req, res) => {
  try {
    const { accountIds, startDate, endDate } = req.body;

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'accountIds должен быть массивом с элементами'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны обязательные параметры: startDate, endDate'
      });
    }

    const actions = await changelogService.getGroupActions(accountIds, startDate, endDate);

    res.status(200).json({
      success: true,
      data: actions,
      count: actions.length
    });
  } catch (error) {
    console.error('[POST /changelog/group-actions] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении действий группы',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/author-stats/:authorAccountId
 * Статистика активности автора
 */
router.get('/author-stats/:authorAccountId', async (req, res) => {
  try {
    const { authorAccountId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны обязательные параметры: startDate, endDate'
      });
    }

    const stats = await changelogService.getAuthorStats(authorAccountId, startDate, endDate);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error(`[GET /changelog/author-stats/${req.params.authorAccountId}] Ошибка:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики автора',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/assignment-matrix
 * Матрица назначений
 */
router.get('/assignment-matrix', async (req, res) => {
  try {
    const { startDate, endDate, departmentId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны обязательные параметры: startDate, endDate'
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

/**
 * GET /api/changelog/search
 * Универсальный поиск с фильтрами
 */
router.get('/search', async (req, res) => {
  try {
    const filters = {
      authorAccountId: req.query.authorAccountId,
      departmentId: req.query.departmentId,
      issueKey: req.query.issueKey,
      issueId: req.query.issueId,
      eventType: req.query.eventType,
      field: req.query.field,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit,
      skip: req.query.skip,
      sort: req.query.sort
    };

    // Удаляем undefined значения
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const result = await changelogService.findChangelogs(filters);

    res.status(200).json({
      success: true,
      data: result.events,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[GET /changelog/search] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка поиска событий',
      error: error.message
    });
  }
});

/**
 * POST /api/changelog/search-multiple-authors
 * Поиск по нескольким сотрудникам
 */
router.post('/search-multiple-authors', async (req, res) => {
  try {
    const { accountIds, filters } = req.body;

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'accountIds должен быть непустым массивом'
      });
    }

    const result = await changelogService.findByMultipleAuthors(accountIds, filters || {});

    res.status(200).json({
      success: true,
      data: result.events,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[POST /changelog/search-multiple-authors] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка поиска по нескольким авторам',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/by-author/:authorAccountId
 * Поиск по автору
 */
router.get('/by-author/:authorAccountId', async (req, res) => {
  try {
    const { authorAccountId } = req.params;
    const filters = {
      departmentId: req.query.departmentId,
      eventType: req.query.eventType,
      field: req.query.field,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit,
      skip: req.query.skip,
      sort: req.query.sort
    };

    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const result = await changelogService.findByAuthor(authorAccountId, filters);

    res.status(200).json({
      success: true,
      data: result.events,
      pagination: result.pagination
    });
  } catch (error) {
    console.error(`[GET /changelog/by-author/${req.params.authorAccountId}] Ошибка:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка поиска по автору',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/by-department/:departmentId
 * Поиск по департаменту
 */
router.get('/by-department/:departmentId', async (req, res) => {
  try {
    const { departmentId } = req.params;
    const filters = {
      authorAccountId: req.query.authorAccountId,
      eventType: req.query.eventType,
      field: req.query.field,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit,
      skip: req.query.skip,
      sort: req.query.sort
    };

    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const result = await changelogService.findByDepartment(departmentId, filters);

    res.status(200).json({
      success: true,
      data: result.events,
      pagination: result.pagination
    });
  } catch (error) {
    console.error(`[GET /changelog/by-department/${req.params.departmentId}] Ошибка:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка поиска по департаменту',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/by-issue-key/:issueKey
 * Поиск по ключу задачи
 */
router.get('/by-issue-key/:issueKey', async (req, res) => {
  try {
    const { issueKey } = req.params;
    const filters = {
      eventType: req.query.eventType,
      field: req.query.field,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit,
      skip: req.query.skip,
      sort: req.query.sort
    };

    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const result = await changelogService.findByIssueKey(issueKey, filters);

    res.status(200).json({
      success: true,
      data: result.events,
      pagination: result.pagination
    });
  } catch (error) {
    console.error(`[GET /changelog/by-issue-key/${req.params.issueKey}] Ошибка:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка поиска по ключу задачи',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/by-event-type/:eventType
 * Поиск по типу события
 */
router.get('/by-event-type/:eventType', async (req, res) => {
  try {
    const { eventType } = req.params;
    const filters = {
      authorAccountId: req.query.authorAccountId,
      departmentId: req.query.departmentId,
      issueKey: req.query.issueKey,
      field: req.query.field,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit,
      skip: req.query.skip,
      sort: req.query.sort
    };

    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const result = await changelogService.findByEventType(eventType, filters);

    res.status(200).json({
      success: true,
      data: result.events,
      pagination: result.pagination
    });
  } catch (error) {
    console.error(`[GET /changelog/by-event-type/${req.params.eventType}] Ошибка:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка поиска по типу события',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/by-date-range
 * Поиск по периоду времени
 */
router.get('/by-date-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны обязательные параметры: startDate, endDate'
      });
    }

    const filters = {
      authorAccountId: req.query.authorAccountId,
      departmentId: req.query.departmentId,
      eventType: req.query.eventType,
      field: req.query.field,
      limit: req.query.limit,
      skip: req.query.skip,
      sort: req.query.sort
    };

    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const result = await changelogService.findByDateRange(startDate, endDate, filters);

    res.status(200).json({
      success: true,
      data: result.events,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[GET /changelog/by-date-range] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка поиска по периоду',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/all
 * Получить все события (с пагинацией)
 */
router.get('/all', async (req, res) => {
  try {
    const filters = {
      limit: req.query.limit,
      skip: req.query.skip,
      sort: req.query.sort
    };

    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const result = await changelogService.getAllChangelogs(filters);

    res.status(200).json({
      success: true,
      data: result.events,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[GET /changelog/all] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения всех событий',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/count
 * Подсчет событий с фильтрами
 */
router.get('/count', async (req, res) => {
  try {
    const filters = {
      authorAccountId: req.query.authorAccountId,
      departmentId: req.query.departmentId,
      issueKey: req.query.issueKey,
      issueId: req.query.issueId,
      eventType: req.query.eventType,
      field: req.query.field,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const result = await changelogService.countChangelogs(filters);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[GET /changelog/count] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка подсчета событий',
      error: error.message
    });
  }
});

/**
 * GET /api/changelog/stats
 * Агрегированная статистика
 */
router.get('/stats', async (req, res) => {
  try {
    const filters = {
      authorAccountId: req.query.authorAccountId,
      departmentId: req.query.departmentId,
      eventType: req.query.eventType,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const stats = await changelogService.getAggregatedStats(filters);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[GET /changelog/stats] Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статистики',
      error: error.message
    });
  }
});

export default router;
