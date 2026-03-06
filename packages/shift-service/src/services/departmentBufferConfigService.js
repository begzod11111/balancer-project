import { models } from "../models/db.js";

class DepartmentBufferConfigService {

  /**
   * Создаёт конфигурацию буфера для департамента
   */
  async createConfig(departmentObjectId, configData = {}) {
    try {
      const existingConfig = await models.DepartmentBufferConfig.findOne({ departmentObjectId });

      if (existingConfig) {
        console.log(`[BufferConfig] ℹ️ Конфигурация уже существует`);
        return existingConfig;
      }

      const config = await models.DepartmentBufferConfig.create({
        departmentObjectId,
        enabled: configData.enabled ?? true,
        processingSchedule: configData.processingSchedule || '*/15 * * * *',
        defaultProcessingPriority: configData.defaultProcessingPriority || 'highest_weight',
        defaultAssignmentInterval: configData.defaultAssignmentInterval || 15,
        defaultBufferTtl: configData.defaultBufferTtl || 60,
        globalMaxBufferSize: configData.globalMaxBufferSize || 500,
        taskTypeSettings: configData.taskTypeSettings || [],
        bufferedTasks: [],
        notifications: {
          onBufferFull: configData.notifications?.onBufferFull ?? true,
          onTaskExpired: configData.notifications?.onTaskExpired ?? true,
          onAssignmentFailed: configData.notifications?.onAssignmentFailed ?? true,
          webhookUrl: configData.notifications?.webhookUrl || null,
          emailRecipients: configData.notifications?.emailRecipients || []
        },
        enableMetrics: configData.enableMetrics ?? true,
        deleted: false
      });

      console.log(`[BufferConfig] ✅ Создана конфигурация для ${departmentObjectId}`);

      return config;

    } catch (error) {
      console.error('[BufferConfig] ❌ Ошибка создания:', error);
      throw error;
    }
  }

  /**
   * Обновляет конфигурацию
   */
  async updateConfig(departmentObjectId, updates) {
    try {
      this._validateUpdates(updates);

      const config = await models.DepartmentBufferConfig.findOneAndUpdate(
        { departmentObjectId },
        { $set: updates },
        { new: true }
      );

      if (!config) {
        throw new Error(`Конфигурация для ${departmentObjectId} не найдена`);
      }

      console.log(`[BufferConfig] ✅ Конфигурация обновлена`);

      return config;

    } catch (error) {
      console.error('[BufferConfig] ❌ Ошибка обновления:', error);
      throw error;
    }
  }

  /**
   * Добавляет/обновляет настройки типа задачи
   */
  async setTaskTypeSettings(departmentObjectId, typeSettings) {
    try {
      this._validateTaskTypeSettings(typeSettings);

      const config = await models.DepartmentBufferConfig.findOneAndUpdate(
        {
          departmentObjectId,
          'taskTypeSettings.typeId': typeSettings.typeId
        },
        {
          $set: { 'taskTypeSettings.$': typeSettings }
        },
        { new: true }
      );

      if (!config) {
        const newConfig = await models.DepartmentBufferConfig.findOneAndUpdate(
          { departmentObjectId },
          {
            $push: { taskTypeSettings: typeSettings }
          },
          { new: true }
        );

        console.log(`[BufferConfig] ✅ Добавлены настройки для типа ${typeSettings.typeId}`);
        return newConfig;
      }

      console.log(`[BufferConfig] ✅ Обновлены настройки для типа ${typeSettings.typeId}`);

      return config;

    } catch (error) {
      console.error('[BufferConfig] ❌ Ошибка настройки типа:', error);
      throw error;
    }
  }

  /**
   * Получает конфигурацию
   */
  async getConfig(departmentObjectId) {
    const config = await models.DepartmentBufferConfig.findOne({ departmentObjectId });

    if (!config) {
      console.log(`[BufferConfig] ℹ️ Создаём дефолтную конфигурацию`);
      return await this.createConfig(departmentObjectId);
    }

    return config;
  }

  /**
   * Валидация обновлений
   * @private
   */
  _validateUpdates(updates) {
    if (updates.defaultAssignmentInterval !== undefined) {
      if (updates.defaultAssignmentInterval < 1 || updates.defaultAssignmentInterval > 1440) {
        throw new Error('defaultAssignmentInterval должен быть от 1 до 1440 минут');
      }
    }

    if (updates.defaultBufferTtl !== undefined) {
      if (updates.defaultBufferTtl < 5 || updates.defaultBufferTtl > 10080) {
        throw new Error('defaultBufferTtl должен быть от 5 до 10080 минут');
      }
    }

    if (updates.globalMaxBufferSize !== undefined) {
      if (updates.globalMaxBufferSize < 1 || updates.globalMaxBufferSize > 5000) {
        throw new Error('globalMaxBufferSize должен быть от 1 до 5000');
      }
    }
  }

  /**
   * Валидация настроек типа
   * @private
   */
  _validateTaskTypeSettings(typeSettings) {
    if (!typeSettings.typeId) {
      throw new Error('typeId обязателен');
    }

    if (typeSettings.assignmentInterval !== undefined) {
      if (typeSettings.assignmentInterval < 1 || typeSettings.assignmentInterval > 1440) {
        throw new Error('assignmentInterval должен быть от 1 до 1440 минут');
      }
    }

    if (typeSettings.bufferTtl !== undefined) {
      if (typeSettings.bufferTtl < 5 || typeSettings.bufferTtl > 10080) {
        throw new Error('bufferTtl должен быть от 5 до 10080 минут');
      }
    }

    if (typeSettings.maxBufferSize !== undefined) {
      if (typeSettings.maxBufferSize < 1 || typeSettings.maxBufferSize > 1000) {
        throw new Error('maxBufferSize должен быть от 1 до 1000');
      }
    }
  }
}

export default new DepartmentBufferConfigService();
