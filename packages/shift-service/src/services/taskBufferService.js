import { models } from "../models/db.js";
import departmentBufferConfigService from "./departmentBufferConfigService.js";

class TaskBufferService {

  /**
   * Добавляет задачу в буфер
   */
  async addTaskToBuffer(issueData, assignmentGroupId) {
    try {
      console.log(`[TaskBuffer] 📥 Добавление задачи ${issueData.issueKey} в буфер`);

      // Находим департамент
      const department = await models.Department.findOne({ jiraId: assignmentGroupId });

      if (!department) {
        throw new Error(`Департамент с jiraId ${assignmentGroupId} не найден`);
      }

      // Получаем или создаём конфигурацию
      const bufferConfig = await departmentBufferConfigService.getConfig(department.jiraId);

      if (!bufferConfig.enabled) {
        console.log('[TaskBuffer] ⏭️ Буфер отключен');
        return null;
      }

      // Получаем настройки для типа задачи
      const typeSettings = this._getTypeSettings(bufferConfig, issueData.typeId);

      if (!typeSettings.enabled) {
        console.log(`[TaskBuffer] ⏭️ Буфер отключен для типа ${issueData.typeId}`);
        return null;
      }

      // Проверяем лимиты
      await this._checkBufferLimits(bufferConfig, issueData.typeId, typeSettings);

      // Извлекаем данные
      const summary = this._extractFromChangelog(issueData.changelog, 'summary') || 'Без названия';
      const description = this._extractFromChangelog(issueData.changelog, 'description') || '';
      const reporter = this._extractFromChangelog(issueData.changelog, 'reporter') || '';
      const priority = this._extractFromChangelog(issueData.changelog, 'priority') || 'Medium';

      // Получаем настройки статуса
      const statusSettings = this._getStatusSettings(typeSettings, issueData.issueStatusId);

      // Рассчитываем вес
      const calculatedWeight = this._calculateTaskWeight(issueData, typeSettings, statusSettings, priority);

      // Определяем интервал назначения
      let assignmentInterval = typeSettings.assignmentInterval;

      if (statusSettings?.fastTrackInterval !== undefined && statusSettings?.fastTrackInterval !== null) {
        assignmentInterval = statusSettings.fastTrackInterval;
        console.log(`[TaskBuffer] ⚡ Быстрое назначение: ${assignmentInterval} мин`);
      }

      const now = new Date();
      const scheduledAssignmentAt = new Date(now.getTime() + assignmentInterval * 60 * 1000);
      const expiresAt = new Date(now.getTime() + typeSettings.bufferTtl * 60 * 1000);

      // Создаём задачу для буфера
      const bufferTask = {
        issueKey: issueData.issueKey,
        issueId: issueData.issueId,
        typeId: issueData.typeId,
        typeName: typeSettings.typeName || 'Unknown Type',
        statusId: issueData.issueStatusId,
        status: 'pending',
        priority: priority,
        calculatedWeight,
        assigneeAccountId: issueData.assigneeAccountId || null,
        addedToBufferAt: now,
        scheduledAssignmentAt,
        expiresAt,
        assignmentAttempts: [],
        issueData: {
          summary,
          description,
          reporter,
          createdAt: new Date(issueData.timestamp) || now,
          updatedAt: now
        }
      };

      // Добавляем через метод модели
      await bufferConfig.addTask(bufferTask);

      console.log(`[TaskBuffer] ✅ Задача ${issueData.issueKey} добавлена`);
      console.log(`   Вес: ${calculatedWeight}, Приоритет: ${priority}`);
      console.log(`   Назначение: ${scheduledAssignmentAt.toISOString()}`);

      return bufferTask;

    } catch (error) {
      console.error('[TaskBuffer] ❌ Ошибка:', error);
      throw error;
    }
  }

  /**
   * Обрабатывает готовые к назначению задачи
   */
  async processReadyTasks(departmentObjectId) {
    try {
      console.log('[TaskBuffer] 🔄 Обработка готовых задач...');

      const bufferConfig = await models.DepartmentBufferConfig.findOne({ departmentObjectId });

      if (!bufferConfig || !bufferConfig.enabled) {
        console.log('[TaskBuffer] ⏭️ Буфер не настроен или отключен');
        return;
      }

      const now = new Date();

      // Получаем готовые задачи через метод модели
      const readyTasks = bufferConfig.getTasksByStatus('pending').filter(
        task => task.scheduledAssignmentAt <= now
      );

      console.log(`[TaskBuffer] 📊 Готовых задач: ${readyTasks.length}`);

      if (readyTasks.length === 0) {
        await this._processExpiredTasks(departmentObjectId);
        await this._cleanupOldTasks(departmentObjectId);
        return;
      }

      // Сортируем задачи
      const sortedTasks = this._sortTasksByPriority(readyTasks, bufferConfig.defaultProcessingPriority);

      const department = await models.Department.findById({
          jiraId: departmentObjectId
      });

      for (const task of sortedTasks) {
        console.log(`[TaskBuffer] 🎯 Обработка задачи ${task.issueKey} (вес: ${task.calculatedWeight})`);

        const typeSettings = this._getTypeSettings(bufferConfig, task.typeId);

        if (!typeSettings.autoAssign) {
          console.log(`[TaskBuffer] ⏭️ Автоназначение отключено`);
          continue;
        }

        try {
          await this._assignTask(task, department, departmentObjectId);

          await bufferConfig.updateTaskStatus(task.issueKey, 'assigned', {
            assignedAt: new Date()
          });

        } catch (error) {
          console.error(`[TaskBuffer] ❌ Ошибка назначения ${task.issueKey}:`, error);

          task.assignmentAttempts.push({
            attemptedAt: new Date(),
            success: false,
            error: error.message
          });

          await bufferConfig.save();

          if (task.assignmentAttempts.length >= typeSettings.maxAssignmentAttempts) {
            console.log(`[TaskBuffer] 🚫 Превышено количество попыток для ${task.issueKey}`);

            await bufferConfig.updateTaskStatus(task.issueKey, 'cancelled', {
              cancellationReason: 'max_attempts_exceeded'
            });
          }
        }
      }

      await this._processExpiredTasks(departmentObjectId);
      await this._cleanupOldTasks(departmentObjectId);

    } catch (error) {
      console.error('[TaskBuffer] ❌ Ошибка обработки:', error);
      throw error;
    }
  }

  /**
   * Получает статистику буфера
   */
  async getBufferStats(departmentObjectId) {
    const bufferConfig = await models.DepartmentBufferConfig.findOne({ departmentObjectId });

    if (!bufferConfig) {
      return {
        totalTasks: 0,
        byStatus: {},
        byType: {},
        globalLimit: 0,
        currentSize: 0
      };
    }

    const byStatus = {};
    const byType = {};

    bufferConfig.bufferedTasks.forEach(task => {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
      byType[task.typeId] = (byType[task.typeId] || 0) + 1;
    });

    return {
      totalTasks: bufferConfig.bufferedTasks.length,
      byStatus,
      byType,
      globalLimit: bufferConfig.globalMaxBufferSize,
      currentSize: bufferConfig.bufferedTasks.filter(t =>
        ['pending', 'ready'].includes(t.status)
      ).length
    };
  }

  /**
   * Проверяет лимиты буфера
   * @private
   */
  async _checkBufferLimits(bufferConfig, typeId, typeSettings) {
    const currentTypeBufferSize = bufferConfig.getTasksByType(typeId).filter(
      t => ['pending', 'ready'].includes(t.status)
    ).length;

    if (currentTypeBufferSize >= typeSettings.maxBufferSize) {
      throw new Error(`Буфер для типа ${typeId} заполнен (${currentTypeBufferSize}/${typeSettings.maxBufferSize})`);
    }

    const currentGlobalBufferSize = bufferConfig.bufferedTasks.filter(t =>
      ['pending', 'ready'].includes(t.status)
    ).length;

    if (currentGlobalBufferSize >= bufferConfig.globalMaxBufferSize) {
      throw new Error(`Глобальный буфер департамента заполнен (${currentGlobalBufferSize}/${bufferConfig.globalMaxBufferSize})`);
    }
  }

  /**
   * Обрабатывает истёкшие задачи
   * @private
   */
  async _processExpiredTasks(departmentObjectId) {
    const bufferConfig = await models.DepartmentBufferConfig.findOne({ departmentObjectId });

    if (!bufferConfig) return;

    const now = new Date();
    const expiredTasks = bufferConfig.bufferedTasks.filter(task =>
      task.status === 'pending' && task.expiresAt <= now
    );

    console.log(`[TaskBuffer] ⏰ Истёкших задач: ${expiredTasks.length}`);

    for (const task of expiredTasks) {
      const typeSettings = this._getTypeSettings(bufferConfig, task.typeId);

      console.log(`[TaskBuffer] ⏰ Истёкла ${task.issueKey}, действие: ${typeSettings.onExpire}`);

      switch (typeSettings.onExpire) {
        case 'force_assign':
          try {
            const department = await models.Department.findById(departmentObjectId);
            await this._assignTask(task, department, departmentObjectId);
            await bufferConfig.updateTaskStatus(task.issueKey, 'assigned', {
              assignedAt: new Date()
            });
          } catch (error) {
            console.error(`[TaskBuffer] ❌ Не удалось назначить ${task.issueKey}:`, error);
          }
          break;

        case 'cancel':
          await bufferConfig.updateTaskStatus(task.issueKey, 'cancelled', {
            cancellationReason: 'expired'
          });
          console.log(`[TaskBuffer] ❌ Задача ${task.issueKey} отменена`);
          break;

        case 'notify':
          // TODO: Отправка уведомления
          await bufferConfig.updateTaskStatus(task.issueKey, 'expired');
          break;
      }
    }
  }

  /**
   * Очищает старые задачи
   * @private
   */
  async _cleanupOldTasks(departmentObjectId) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    await models.DepartmentBufferConfig.findOneAndUpdate(
      { departmentObjectId },
      {
        $pull: {
          bufferedTasks: {
            addedToBufferAt: { $lt: sevenDaysAgo }
          }
        }
      }
    );

    console.log(`[TaskBuffer] 🗑️ Старые задачи очищены`);
  }

  /**
   * Извлекает значение из changelog
   * @private
   */
  _extractFromChangelog(changelog, field) {
    if (!changelog?.items) return null;

    const item = changelog.items.find(i => i.field === field);
    return item?.toString || null;
  }

  /**
   * Получает настройки типа
   * @private
   */
  _getTypeSettings(bufferConfig, typeId) {
    const specificSettings = bufferConfig.taskTypeSettings?.find(t => t.typeId === typeId);

    if (specificSettings) {
      return {
        typeName: specificSettings.typeName,
        enabled: specificSettings.enabled ?? true,
        assignmentInterval: specificSettings.assignmentInterval ?? bufferConfig.defaultAssignmentInterval,
        bufferTtl: specificSettings.bufferTtl ?? bufferConfig.defaultBufferTtl,
        autoAssign: specificSettings.autoAssign ?? true,
        maxAssignmentAttempts: specificSettings.maxAssignmentAttempts ?? 3,
        onExpire: specificSettings.onExpire ?? 'force_assign',
        maxBufferSize: specificSettings.maxBufferSize ?? 100,
        processingPriority: specificSettings.processingPriority ?? bufferConfig.defaultProcessingPriority,
        statusSettings: specificSettings.statusSettings || []
      };
    }

    return {
      typeName: `Type ${typeId}`,
      enabled: true,
      assignmentInterval: bufferConfig.defaultAssignmentInterval || 15,
      bufferTtl: bufferConfig.defaultBufferTtl || 60,
      autoAssign: true,
      maxAssignmentAttempts: 3,
      onExpire: 'force_assign',
      maxBufferSize: 100,
      processingPriority: bufferConfig.defaultProcessingPriority || 'highest_weight',
      statusSettings: []
    };
  }

  /**
   * Получает настройки статуса
   * @private
   */
  _getStatusSettings(typeSettings, statusId) {
    if (!statusId) return null;

    return typeSettings.statusSettings?.find(s => s.statusId === statusId) || null;
  }

  /**
   * Рассчитывает вес задачи
   * @private
   */
  _calculateTaskWeight(issueData, typeSettings, statusSettings, priority) {
    let weight = 1.0;

    if (statusSettings?.priority) {
      const priorityWeights = {
        'urgent': 2.5,
        'high': 1.8,
        'normal': 1.0,
        'low': 0.6
      };
      weight *= priorityWeights[statusSettings.priority] || 1.0;
    }

    const priorityMultipliers = {
      'Highest': 2.0,
      'High': 1.5,
      'Medium': 1.0,
      'Low': 0.7,
      'Lowest': 0.5
    };

    weight *= priorityMultipliers[priority] || 1.0;

    if (!issueData.assigneeAccountId) {
      weight *= 1.3;
    }

    if (issueData.timestamp) {
      const ageInHours = (Date.now() - issueData.timestamp) / (1000 * 60 * 60);
      if (ageInHours > 24) {
        const ageMultiplier = 1 + Math.min(ageInHours / 24 * 0.1, 0.5);
        weight *= ageMultiplier;
      }
    }

    return Math.round(weight * 100) / 100;
  }

  /**
   * Сортирует задачи
   * @private
   */
  _sortTasksByPriority(tasks, priorityType) {
    const sortFunctions = {
      oldest_first: (a, b) => new Date(a.addedToBufferAt) - new Date(b.addedToBufferAt),
      newest_first: (a, b) => new Date(b.addedToBufferAt) - new Date(a.addedToBufferAt),
      highest_priority: (a, b) => {
        const priorityOrder = { 'Highest': 0, 'High': 1, 'Medium': 2, 'Low': 3, 'Lowest': 4 };
        return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      },
      highest_weight: (a, b) => (b.calculatedWeight || 0) - (a.calculatedWeight || 0)
    };

    const sortFn = sortFunctions[priorityType] || sortFunctions.oldest_first;
    return [...tasks].sort(sortFn);
  }

  /**
   * Назначает задачу исполнителю
   * @private
   */
  async _assignTask(task, department, departmentObjectId) {
    console.log(`[TaskBuffer] 🎯 Назначение задачи ${task.issueKey}...`);

    // TODO: Интеграция с балансировщиком
    // const assignee = await assigneePoolService.getNextAssignee(department, task);
    // await jiraService.assignTask(task.issueKey, assignee.accountId);

    console.log(`[TaskBuffer] ✅ Задача ${task.issueKey} успешно назначена`);
  }
}

export default new TaskBufferService();
