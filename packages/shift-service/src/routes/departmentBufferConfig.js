import express from 'express';
import departmentBufferConfigService from '../services/departmentBufferConfigService.js';

const router = express.Router();

/**
 * POST /api/buffer-config
 * Создать конфигурацию буфера для департамента
 */
router.post('/', async (req, res) => {
  try {
    const { departmentObjectId, ...configData } = req.body;

    if (!departmentObjectId) {
      return res.status(400).json({
        success: false,
        error: 'departmentObjectId обязателен'
      });
    }

    const config = await departmentBufferConfigService.createConfig(
      departmentObjectId,
      configData
    );

    res.status(201).json({
      success: true,
      data: config,
      message: 'Конфигурация буфера создана'
    });

  } catch (error) {
    console.error('[API BufferConfig] ❌ Ошибка создания:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/buffer-config/:departmentObjectId
 * Получить конфигурацию буфера департамента
 */
router.get('/:departmentObjectId', async (req, res) => {
  try {
    const { departmentObjectId } = req.params;

    const config = await departmentBufferConfigService.getConfig(departmentObjectId);

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    console.error('[API BufferConfig] ❌ Ошибка получения:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/buffer-config
 * Получить все конфигурации буфера
 * Query params: ?enabled=true
 */
router.get('/', async (req, res) => {
  try {
    const filters = {};

    if (req.query.enabled !== undefined) {
      filters.enabled = req.query.enabled === 'true';
    }

    const configs = await departmentBufferConfigService.getAllConfigs(filters);

    res.json({
      success: true,
      data: configs,
      count: configs.length
    });

  } catch (error) {
    console.error('[API BufferConfig] ❌ Ошибка получения списка:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /api/buffer-config/:departmentObjectId
 * Обновить общие настройки конфигурации
 */
router.patch('/:departmentObjectId', async (req, res) => {
  try {
    const { departmentObjectId } = req.params;
    const updates = req.body;

    const config = await departmentBufferConfigService.updateConfig(
      departmentObjectId,
      updates
    );

    res.json({
      success: true,
      data: config,
      message: 'Конфигурация обновлена'
    });

  } catch (error) {
    console.error('[API BufferConfig] ❌ Ошибка обновления:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/buffer-config/:departmentObjectId
 * Удалить конфигурацию буфера (мягкое удаление)
 */
router.delete('/:departmentObjectId', async (req, res) => {
  try {
    const { departmentObjectId } = req.params;

    const config = await departmentBufferConfigService.deleteConfig(departmentObjectId);

    res.json({
      success: true,
      data: config,
      message: 'Конфигурация удалена'
    });

  } catch (error) {
    console.error('[API BufferConfig] ❌ Ошибка удаления:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/buffer-config/:departmentObjectId/task-types
 * Добавить настройки для типа задачи
 */
router.post('/:departmentObjectId/task-types', async (req, res) => {
  try {
    const { departmentObjectId } = req.params;
    const typeSettings = req.body;

    const config = await departmentBufferConfigService.addTaskTypeSettings(
      departmentObjectId,
      typeSettings
    );

    res.status(201).json({
      success: true,
      data: config,
      message: `Настройки для типа ${typeSettings.typeId} добавлены`
    });

  } catch (error) {
    console.error('[API BufferConfig] ❌ Ошибка добавления типа:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /api/buffer-config/:departmentObjectId/task-types/:typeId
 * Обновить настройки типа задачи
 */
router.patch('/:departmentObjectId/task-types/:typeId', async (req, res) => {
  try {
    const { departmentObjectId, typeId } = req.params;
    const updates = req.body;

    const config = await departmentBufferConfigService.updateTaskTypeSettings(
      departmentObjectId,
      typeId,
      updates
    );

    res.json({
      success: true,
      data: config,
      message: `Настройки типа ${typeId} обновлены`
    });

  } catch (error) {
    console.error('[API BufferConfig] ❌ Ошибка обновления типа:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/buffer-config/:departmentObjectId/task-types/:typeId
 * Удалить настройки типа задачи
 */
router.delete('/:departmentObjectId/task-types/:typeId', async (req, res) => {
  try {
    const { departmentObjectId, typeId } = req.params;

    const config = await departmentBufferConfigService.removeTaskTypeSettings(
      departmentObjectId,
      typeId
    );

    res.json({
      success: true,
      data: config,
      message: `Настройки типа ${typeId} удалены`
    });

  } catch (error) {
    console.error('[API BufferConfig] ❌ Ошибка удаления типа:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/buffer-config/:departmentObjectId/task-types/:typeId/statuses
 * Добавить настройки для статуса задачи
 */
router.post('/:departmentObjectId/task-types/:typeId/statuses', async (req, res) => {
  try {
    const { departmentObjectId, typeId } = req.params;
    const statusSettings = req.body;

    const config = await departmentBufferConfigService.addStatusSettings(
      departmentObjectId,
      typeId,
      statusSettings
    );

    res.status(201).json({
      success: true,
      data: config,
      message: `Настройки для статуса ${statusSettings.statusId} добавлены`
    });

  } catch (error) {
    console.error('[API BufferConfig] ❌ Ошибка добавления статуса:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /api/buffer-config/:departmentObjectId/task-types/:typeId/statuses/:statusId
 * Обновить настройки статуса задачи
 */
router.patch('/:departmentObjectId/task-types/:typeId/statuses/:statusId', async (req, res) => {
  try {
    const { departmentObjectId, typeId, statusId } = req.params;
    const updates = req.body;

    const config = await departmentBufferConfigService.updateStatusSettings(
      departmentObjectId,
      typeId,
      statusId,
      updates
    );

    res.json({
      success: true,
      data: config,
      message: `Настройки статуса ${statusId} обновлены`
    });

  } catch (error) {
    console.error('[API BufferConfig] ❌ Ошибка обновления статуса:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/buffer-config/:departmentObjectId/task-types/:typeId/statuses/:statusId
 * Удалить настройки статуса задачи
 */
router.delete('/:departmentObjectId/task-types/:typeId/statuses/:statusId', async (req, res) => {
  try {
    const { departmentObjectId, typeId, statusId } = req.params;

    const config = await departmentBufferConfigService.removeStatusSettings(
      departmentObjectId,
      typeId,
      statusId
    );

    res.json({
      success: true,
      data: config,
      message: `Настройки статуса ${statusId} удалены`
    });

  } catch (error) {
    console.error('[API BufferConfig] ❌ Ошибка удаления статуса:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
