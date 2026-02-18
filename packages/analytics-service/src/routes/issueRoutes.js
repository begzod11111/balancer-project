import express from 'express';
import issueService from '../services/issueService.js';

const router = express.Router();

// Получить задачи с фильтрацией
router.get('/', async (req, res) => {
  try {
    const filters = {
      typeId: req.query.typeId,
      status: req.query.status,
      issueStatusId: req.query.issueStatusId,
      assigneeAccountId: req.query.assigneeAccountId,
      assignmentGroupId: req.query.assignmentGroupId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      limit: parseInt(req.query.limit) || 100
    };

    const issues = await issueService.getIssues(filters);
    res.json({ success: true, data: issues });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Создать задачу
router.post('/', async (req, res) => {
  try {
    const issue = await issueService.createIssue(req.body);
    res.status(201).json({ success: true, data: issue });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Поиск задач
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Query parameter required' });
    }

    const issues = await issueService.searchIssues(q);
    res.json({ success: true, data: issues });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Общая статистика
router.get('/stats/overall', async (req, res) => {
  try {
    const filters = { assignmentGroupId: req.query.assignmentGroupId };
    const stats = await issueService.getOverallStats(filters);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Статистика по типам
router.get('/stats/by-type', async (req, res) => {
  try {
    const filters = {
      assignmentGroupId: req.query.assignmentGroupId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };

    const stats = await issueService.getStatsByType(filters);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Статистика по статусам
router.get('/stats/by-status', async (req, res) => {
  try {
    const filters = {
      typeId: req.query.typeId,
      assignmentGroupId: req.query.assignmentGroupId
    };

    const stats = await issueService.getStatsByStatus(filters);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Статистика по исполнителям
router.get('/stats/by-assignee', async (req, res) => {
  try {
    const filters = {
      assignmentGroupId: req.query.assignmentGroupId,
      typeId: req.query.typeId
    };

    const stats = await issueService.getStatsByAssignee(filters);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Статистика по группам
router.get('/stats/by-group', async (req, res) => {
  try {
    const filters = {
      typeId: req.query.typeId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };

    const stats = await issueService.getStatsByGroup(filters);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Временная статистика
router.get('/stats/time-series', async (req, res) => {
  try {
    const groupBy = req.query.groupBy || 'day';
    const filters = {
      typeId: req.query.typeId,
      assignmentGroupId: req.query.assignmentGroupId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };

    const stats = await issueService.getTimeSeriesStats(groupBy, filters);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Нагрузка на исполнителей
router.get('/assignee-load/:groupId', async (req, res) => {
  try {
    const load = await issueService.getAssigneeLoad(req.params.groupId);
    res.json({ success: true, data: load });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Обновить статус задачи
router.patch('/:issueId/status', async (req, res) => {
  try {
    const { status, statusId } = req.body;
    const issue = await issueService.updateIssueStatus(req.params.issueId, status, statusId);
    res.json({ success: true, data: issue });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Обновить исполнителя
router.patch('/:issueId/assignee', async (req, res) => {
  try {
    const { assigneeAccountId } = req.body;
    const issue = await issueService.updateIssueAssignee(req.params.issueId, assigneeAccountId);
    res.json({ success: true, data: issue });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Массовое обновление статусов
router.patch('/bulk/status', async (req, res) => {
  try {
    const { issueIds, status, statusId } = req.body;
    const result = await issueService.bulkUpdateStatus(issueIds, status, statusId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Переназначить задачи
router.post('/reassign', async (req, res) => {
  try {
    const { fromAssigneeId, toAssigneeId, assignmentGroupId } = req.body;
    const result = await issueService.reassignIssues(fromAssigneeId, toAssigneeId, { assignmentGroupId });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
