import mongoose, { Schema } from 'mongoose';

// Схема для хранения настроек статуса
const StatusSettingsSchema = new Schema({
  statusId: { type: String, required: true },
  statusName: { type: String },
  fastTrackInterval: { type: Number, min: 0 },
  priority: {
    type: String,
    enum: ['urgent', 'high', 'normal', 'low'],
    default: 'normal'
  }
}, { _id: false });

// Схема для настроек типа задачи
const TaskTypeSettingsSchema = new Schema({
  typeId: { type: String, required: true },
  typeName: { type: String },
  enabled: { type: Boolean, default: true },
  assignmentInterval: { type: Number, min: 1, max: 1440 },
  processingPriority: {
    type: String,
    enum: ['oldest_first', 'newest_first', 'highest_priority', 'highest_weight']
  },
  bufferTtl: { type: Number, min: 5, max: 10080 },
  autoAssign: { type: Boolean, default: true },
  maxAssignmentAttempts: { type: Number, min: 1, max: 10, default: 3 },
  onExpire: {
    type: String,
    enum: ['cancel', 'force_assign', 'notify'],
    default: 'force_assign'
  },
  maxBufferSize: { type: Number, min: 1, max: 1000, default: 100 },
  statusSettings: [StatusSettingsSchema]
}, { _id: false });

// Схема для попыток назначения
const AssignmentAttemptSchema = new Schema({
  attemptedAt: { type: Date, required: true },
  targetAccountId: String,
  reason: String,
  success: Boolean,
  error: String
}, { _id: false });

// Схема для данных задачи
const IssueDataSchema = new Schema({
  summary: String,
  description: String,
  reporter: String,
  createdAt: Date,
  updatedAt: Date
}, { _id: false });

// Схема для задачи в буфере
const BufferedTaskSchema = new Schema({
  issueKey: { type: String, required: true },
  issueId: { type: String, required: true },
  typeId: { type: String, required: true },
  typeName: String,
  statusId: String,
  status: {
    type: String,
    enum: ['pending', 'ready', 'assigned', 'expired', 'cancelled'],
    default: 'pending'
  },
  priority: String,
  calculatedWeight: Number,
  assigneeAccountId: String,
  addedToBufferAt: { type: Date, default: Date.now },
  scheduledAssignmentAt: Date,
  assignedAt: Date,
  expiresAt: Date,
  cancellationReason: String,
  assignmentAttempts: [AssignmentAttemptSchema],
  issueData: IssueDataSchema
}, { _id: false });

// Схема для уведомлений
const NotificationsSchema = new Schema({
  onBufferFull: { type: Boolean, default: true },
  onTaskExpired: { type: Boolean, default: true },
  onAssignmentFailed: { type: Boolean, default: true },
  webhookUrl: String,
  emailRecipients: [String]
}, { _id: false });

// 🆕 Основная схема конфигурации буфера
const DepartmentBufferConfigSchema = new Schema({
  departmentObjectId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  enabled: {
    type: Boolean,
    default: true
  },

  processingSchedule: {
    type: String,
    default: '*/15 * * * *'
  },

  defaultProcessingPriority: {
    type: String,
    enum: ['oldest_first', 'newest_first', 'highest_priority', 'highest_weight'],
    default: 'highest_weight'
  },

  defaultAssignmentInterval: {
    type: Number,
    default: 15,
    min: 1,
    max: 1440
  },

  defaultBufferTtl: {
    type: Number,
    default: 60,
    min: 5,
    max: 10080
  },

  globalMaxBufferSize: {
    type: Number,
    default: 500,
    min: 1,
    max: 5000
  },

  // Специфичные настройки для конкретных типов
  taskTypeSettings: [TaskTypeSettingsSchema],

  // 🔑 Список задач в буфере (теперь с четкой структурой)
  bufferedTasks: [BufferedTaskSchema],

  // Настройки уведомлений
  notifications: NotificationsSchema,

  enableMetrics: {
    type: Boolean,
    default: true
  },

  deleted: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true
});

// Индексы для производительности
DepartmentBufferConfigSchema.index({ departmentObjectId: 1 });
DepartmentBufferConfigSchema.index({ 'bufferedTasks.status': 1 });
DepartmentBufferConfigSchema.index({ 'bufferedTasks.scheduledAssignmentAt': 1 });
DepartmentBufferConfigSchema.index({ 'bufferedTasks.issueKey': 1 });
DepartmentBufferConfigSchema.index({ 'bufferedTasks.typeId': 1 });

// 🆕 Методы для удобной работы с задачами
DepartmentBufferConfigSchema.methods.addTask = function(taskData) {
  this.bufferedTasks.push(taskData);
  return this.save();
};

DepartmentBufferConfigSchema.methods.removeTask = function(issueKey) {
  this.bufferedTasks = this.bufferedTasks.filter(t => t.issueKey !== issueKey);
  return this.save();
};

DepartmentBufferConfigSchema.methods.updateTaskStatus = function(issueKey, status, additionalData = {}) {
  const task = this.bufferedTasks.find(t => t.issueKey === issueKey);
  if (task) {
    task.status = status;
    Object.assign(task, additionalData);
    return this.save();
  }
  return null;
};

DepartmentBufferConfigSchema.methods.getTasksByStatus = function(status) {
  return this.bufferedTasks.filter(t => t.status === status);
};

DepartmentBufferConfigSchema.methods.getTasksByType = function(typeId) {
  return this.bufferedTasks.filter(t => t.typeId === typeId);
};

export default mongoose.model('departmentBufferConfig', DepartmentBufferConfigSchema);


