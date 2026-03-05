import express from 'express';
import activityAnalyticsService from '../services/activityAnalyticsService.js';

const router = express.Router();

/**
 * POST /api/activity-analytics/stats
 * Получить детальную аналитику активности
 *
 * Body:
 * {
 *   "accountIds": ["712020:e66f0be6-e47a-45bf-97c9-e4171c160676", ...],
 *   "startTimestamp": 1709251200,  // секунды UTC+5
 *   "endTimestamp": 1709337600
 * }
 */
router.post('/stats', async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        error: 'Тело запроса должно быть в формате JSON'
      });
    }

    let { accountIds, startTimestamp, endTimestamp } = req.body;

    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({
        error: 'accountIds должен быть непустым массивом'
      });
    }

    if (!startTimestamp || !endTimestamp) {
      return res.status(400).json({
        error: 'Требуются startTimestamp и endTimestamp (миллисекунды)'
      });
    }

    // Конвертация миллисекунд в секунды для внутренней логики
    startTimestamp = Math.floor(startTimestamp / 1000);
    endTimestamp = Math.floor(endTimestamp / 1000);

    if (endTimestamp <= startTimestamp) {
      return res.status(400).json({
        error: 'endTimestamp должен быть больше startTimestamp'
      });
    }

    const stats = await activityAnalyticsService.getEmployeeActivityStats(
      accountIds,
      startTimestamp,
      endTimestamp
    );

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('[API] Ошибка получения статистики:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      message: error.message
    });
  }
});

/**
 * POST /api/activity-analytics/export-csv
 * Экспортировать статистику в CSV
 */
router.post('/export-csv', async (req, res) => {
  try {
    const { accountIds, startTimestamp, endTimestamp } = req.body;

    const stats = await activityAnalyticsService.getEmployeeActivityStats(
      accountIds,
      startTimestamp,
      endTimestamp
    );

    const csv = activityAnalyticsService.exportToCSV(stats);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=activity-stats.csv');
    res.send(csv);

  } catch (error) {
    console.error('[API] Ошибка экспорта CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/activity-analytics/task-completion
 * Получить статистику закрываемости задач
 *
 * Body:
 * {
 *   "accountIds": ["712020:367395e7-544e-4d4a-aa95-2bb16f7df41b"],
 *   "startTimestamp": 1772622000000,
 *   "endTimestamp": 1772641387409
 * }
 */
router.post('/task-completion', async (req, res) => {
  try {
    const { accountIds, startTimestamp, endTimestamp } = req.body;

    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({
        error: 'accountIds должен быть непустым массивом'
      });
    }

    if (!startTimestamp || !endTimestamp) {
      return res.status(400).json({
        error: 'Требуются startTimestamp и endTimestamp (миллисекунды)'
      });
    }

    if (endTimestamp <= startTimestamp) {
      return res.status(400).json({
        error: 'endTimestamp должен быть больше startTimestamp'
      });
    }

    const stats = await activityAnalyticsService.getTaskCompletionStats(
      accountIds,
      startTimestamp,
      endTimestamp
    );

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('[API] Ошибка получения статистики закрываемости:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      message: error.message
    });
  }
});

/**
 * POST /api/activity-analytics/department-frequency
 * Получить статистику частоты заявок по отделам
 *
 * Body:
 * {
 *   "assignmentGroupIds": ["1be9e6ab-23d3-4044-be51-802c29c0229a:58053", ...],
 *   "days": 7  // 1, 3, 7, 30 дней
 * }
 */
router.post('/department-frequency', async (req, res) => {
  try {
    const { assignmentGroupIds, days = 7 } = req.body;

    if (!assignmentGroupIds || !Array.isArray(assignmentGroupIds) || assignmentGroupIds.length === 0) {
      return res.status(400).json({
        error: 'assignmentGroupIds должен быть непустым массивом'
      });
    }

    const validDays = [1, 3, 7, 30];
    if (!validDays.includes(days)) {
      return res.status(400).json({
        error: 'days должен быть одним из: 1, 3, 7, 30'
      });
    }

    const stats = await activityAnalyticsService.getDepartmentFrequencyStats(
      assignmentGroupIds,
      days
    );

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('[API] Ошибка получения статистики отделов:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      message: error.message
    });
  }
});



export default router;
