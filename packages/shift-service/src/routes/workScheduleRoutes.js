// routes/workScheduleRoutes.js
import express from 'express';
import WorkScheduleService from '../services/workScheduleService.js';
import {connectDB, models} from "../models/db.js";
import mongoose from 'mongoose';
import jira from "../services/jiraService.js";


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
            deleted,
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
        if (deleted !== undefined) {
            filter.deleted = deleted === 'true';
        }
        if (assigneeId) {
            filter.assigneeId = assigneeId;
        }
        if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
            filter.department = new mongoose.Types.ObjectId(departmentId);
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

/** GET /api/work-schedules/department/:departmentId
 * @desc Получить расписания по ID отдела
 * @access Private
 */
router.get('/department/:departmentId', async (req, res) => {
  try {
    const { departmentId } = req.params;
    const schedules = await workScheduleService.getWorkSchedulesByDepartmentId(departmentId);
    return res.json(schedules);
  } catch (error) {
    console.error(`Ошибка при получении расписаний для отдела ${req.params.departmentId}:`, error);

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
    const { email, departmentId, shifts, limits, isActive } = req.body;

    // Валидация обязательных полей
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email сотрудника обязателен'
      });
    }

    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: 'ID отдела обязателен'
      });
    }

    if (!shifts || Object.keys(shifts).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо указать хотя бы одну смену'
      });
    }

    // Валидация формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный формат email'
      });
    }

    // Валидация департамента
    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID отдела'
      });
    }

    // Проверка существования отдела
    const department = await models.Department.findOne({
      _id: departmentId,
      delete: false,
      active: true
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Активный отдел не найден'
      });
    }

    // Проверка существования расписания для этого email
    const existingSchedule = await models.Shift.findOne({
      assigneeEmail: email.toLowerCase().trim(),
      deleted: false
    });

    if (existingSchedule) {
      return res.status(409).json({
        success: false,
        message: `Расписание для сотрудника с email ${email} уже существует`
      });
    }

    // Получение данных из Jira
    console.log(`[POST /work-schedules] Поиск сотрудника в Jira: ${email}`);
    const jiraData = await jira.findAssigneeByEmail(email);

    if (!jiraData || jiraData.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Сотрудник с email ${email} не найден в Jira`
      });
    }

    const jiraUser = jiraData[0];

    // Проверка существования расписания для accountId
    const existingByAccountId = await models.Shift.findOne({
      accountId: jiraUser.accountId,
      deleted: false
    });

    if (existingByAccountId) {
      return res.status(409).json({
        success: false,
        message: `Расписание для сотрудника с accountId ${jiraUser.accountId} уже существует`
      });
    }

    // Формирование данных для создания
    const scheduleData = {
      accountId: jiraUser.accountId,
      assigneeEmail: email.toLowerCase().trim(),
      assigneeName: jiraUser.displayName || 'Неизвестный сотрудник',
      department: departmentId,
      shifts,
      limits: limits || {},
      isActive: isActive !== undefined ? isActive : true
    };

    console.log(`[POST /work-schedules] Создание расписания для ${scheduleData.assigneeName}`);
    const newSchedule = await workScheduleService.createWorkSchedule(scheduleData);

    return res.status(201).json({
      success: true,
      message: 'Расписание успешно создано',
      data: newSchedule
    });

  } catch (error) {
    console.error('[POST /work-schedules] Ошибка при создании расписания:', error);

    // Обработка специфичных ошибок
    if (error.message.includes('уже существует')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Некорректный') ||
        error.message.includes('должен') ||
        error.message.includes('Обязательные')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Ошибка при создании расписания',
      error: error.message
    });
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