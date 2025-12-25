// routes/workScheduleRoutes.js
import express from 'express';
import WorkScheduleService from '../services/workScheduleService.js';
import {models} from "../models/db.js";
import {Types} from "mongoose";
const router = express.Router();

// Применяем аутентификацию ко всем маршрутам
const workScheduleService = new WorkScheduleService(models);

/**
 * @route GET /api/work-schedules
 * @desc Получить список всех расписаний
 * @access Private
 */
router.get('/', async (req, res) => {
    try {
        const {
            isActive,
            assigneeId,
            accountId,
            departmentId,
            assigneeEmail,
            limit = 0,
            skip = 0,
            sort = 'updatedAt'
        } = req.query;

        // Формируем фильтр
        const filter = {};

        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        if (assigneeId) {
            filter.assigneeId = assigneeId;
        }
        if (departmentId && Types.ObjectId.isValid(departmentId)) {
            filter.department = new Types.ObjectId(departmentId);
        }
        if (accountId) {
            filter.accountId = accountId;
        }
        if (assigneeEmail) {
            filter.assigneeEmail = assigneeEmail;
        }

        // Формируем параметры запроса
        const options = {
            limit: parseInt(limit, 10),
            skip: parseInt(skip, 10),
            sort: {[sort]: -1}
        };
        const schedules = await workScheduleService.getAllWorkSchedules(filter, options);
        return res.json(schedules);
    } catch (error) {
        console.error('Ошибка при получении расписаний:', error);
        return res.status(500).json({message: 'Ошибка сервера', error: error.message});
    }
});

/**
 * @route GET /api/work-schedules/:id
 * @desc Получить расписание по ID
 * @access Private
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await workScheduleService.getWorkScheduleById(id);
    return res.json(schedule);
  } catch (error) {
    console.error(`Ошибка при получении расписания ${req.params.id}:`, error);

    if (error.message.includes('не найдено')) {
      return res.status(404).json({ message: error.message });
    }

    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

/**
 * @route GET /api/work-schedules/assignee/:assigneeId
 * @desc Получить расписание по ID сотрудника
 * @access Private
 */
router.get('/assignee/:assigneeId', async (req, res) => {
  try {
    const { assigneeId } = req.params;
    const schedule = await workScheduleService.getWorkScheduleByAssigneeId(assigneeId);
    return res.json(schedule);
  } catch (error) {
    console.error(`Ошибка при получении расписания для сотрудника ${req.params.assigneeId}:`, error);

    if (error.message.includes('не найдено')) {
      return res.status(404).json({ message: error.message });
    }

    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

/**
 * @route GET /api/work-schedules/account/:accountId
 * @desc Получить расписание по accountId сотрудника
 * @access Private
 */
router.get('/account/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const schedule = await workScheduleService.getWorkScheduleByAccountId(accountId);
    return res.json(schedule);
  } catch (error) {
    console.error(`Ошибка при получении расписания для accountId ${req.params.accountId}:`, error);

    if (error.message.includes('не найдено')) {
      return res.status(404).json({ message: error.message });
    }

    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

/**
 * @route GET /api/work-schedules/day/:dayOfWeek
 * @desc Получить сотрудников, работающих в указанный день недели
 * @access Private
 */
router.get('/day/:dayOfWeek', async (req, res) => {
  try {
    const dayOfWeek = parseInt(req.params.dayOfWeek, 10);
    const { onlyActive = 'true', includeDetails = 'false', startTime, endTime } = req.query;

    const options = {
      onlyActive: onlyActive === 'true',
      includeDetails: includeDetails === 'true',
      startTime,
      endTime
    };

    const assignees = await workScheduleService.getWorkingAssigneesForDay(dayOfWeek, options);
    return res.json(assignees);
  } catch (error) {
    console.error(`Ошибка при получении сотрудников для дня ${req.params.dayOfWeek}:`, error);
    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

/**
 * @route POST /api/work-schedules
 * @desc Создать новое расписание
 * @access Private
 */
router.post('/', async (req, res) => {
  try {
    const scheduleData = req.body;
    const newSchedule = await workScheduleService.createWorkSchedule(scheduleData);
    return res.status(201).json(newSchedule);
  } catch (error) {
    console.error('Ошибка при создании расписания:', error);
    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

/**
 * @route PUT /api/work-schedules/:id
 * @desc Обновить расписание по ID
 * @access Private
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const updatedSchedule = await workScheduleService.updateWorkSchedule(id, updateData);
    return res.json(updatedSchedule);
  } catch (error) {
    console.error(`Ошибка при обновлении расписания ${req.params.id}:`, error);

    if (error.message.includes('не найдено')) {
      return res.status(404).json({ message: error.message });
    }

    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

/**
 * @route PATCH /api/work-schedules/:id/shift/:dayOfWeek
 * @desc Обновить смену на конкретный день недели
 * @access Private
 */
router.patch('/:id/shift/:dayOfWeek', async (req, res) => {
  try {
    const { id, dayOfWeek } = req.params;
    const shiftData = req.body;

    const updatedSchedule = await workScheduleService.updateShiftForDay(
      id,
      parseInt(dayOfWeek, 10),
      shiftData
    );

    return res.json(updatedSchedule);
  } catch (error) {
    console.error(`Ошибка при обновлении смены для расписания ${req.params.id}:`, error);

    if (error.message.includes('не найдено')) {
      return res.status(404).json({ message: error.message });
    }

    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

/**
 * @route PATCH /api/work-schedules/:id/limits
 * @desc Обновить лимиты для сотрудника
 * @access Private
 */
router.patch('/:id/limits', async (req, res) => {
  try {
    const { id } = req.params;
    const limitsData = req.body;

    const updatedSchedule = await workScheduleService.updateLimits(id, limitsData);
    return res.json(updatedSchedule);
  } catch (error) {
    console.error(`Ошибка при обновлении лимитов для расписания ${req.params.id}:`, error);

    if (error.message.includes('не найдено')) {
      return res.status(404).json({ message: error.message });
    }

    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

/**
 * @route PATCH /api/work-schedules/:id/active
 * @desc Изменить статус активности расписания
 * @access Private
 */
router.patch('/:id/active', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (isActive === undefined) {
      return res.status(400).json({ message: 'Не указан параметр isActive' });
    }

    const updatedSchedule = await workScheduleService.setActiveStatus(id, isActive);
    return res.json(updatedSchedule);
  } catch (error) {
    console.error(`Ошибка при изменении статуса активности для расписания ${req.params.id}:`, error);

    if (error.message.includes('не найдено')) {
      return res.status(404).json({ message: error.message });
    }

    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

/**
 * @route DELETE /api/work-schedules/:id
 * @desc Удалить расписание по ID
 * @access Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await workScheduleService.deleteWorkSchedule(id);
    return res.status(200).json({ message: 'Расписание успешно удалено' });
  } catch (error) {
    console.error(`Ошибка при удалении расписания ${req.params.id}:`, error);

    if (error.message.includes('не найдено')) {
      return res.status(404).json({ message: error.message });
    }

    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

export default router;