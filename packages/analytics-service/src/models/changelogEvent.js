import mongoose from 'mongoose';

const changelogEventSchema = new mongoose.Schema({
  historyId: { type: String, required: true, unique: true, index: true },
  issueId: { type: String, required: true, index: true },
  issueKey: { type: String, required: true, index: true },
  projectId: { type: String, index: true },
  projectKey: { type: String, index: true },
  departmentId: { type: String, index: true, default: null },
  eventType: { type: String, required: true, index: true },

  // Информация об авторе (денормализация)
  authorAccountId: { type: String, required: true, index: true },
  authorDisplayName: { type: String },
  authorEmail: { type: String },
  authorActive: { type: Boolean, default: true },
  authorTimeZone: { type: String },

  // Дата и время
  created: { type: Date, required: true, index: true },
  dayOfWeek: { type: Number, min: 0, max: 6, index: true }, // 0-6 (вс-сб)
  hourOfDay: { type: Number, min: 0, max: 23, index: true }, // 0-23

  // Изменение
  field: { type: String, required: true, index: true },
  fieldtype: { type: String },
  fieldId: { type: String },
  from: { type: String },
  fromString: { type: String },
  to: { type: String },
  toString: { type: String },
  fromAccountId: { type: String, index: true },
  toAccountId: { type: String, index: true },

  // Дополнительный контекст
  issueType: { type: String, index: true },
  issueStatus: { type: String, index: true },
  issuePriority: { type: String },
  assignmentGroupId: { type: String, index: true }
}, {
  timestamps: true,
  collection: 'changelog_events'
});

// Основные индексы
changelogEventSchema.index({ authorAccountId: 1, created: -1 });
changelogEventSchema.index({ departmentId: 1, created: -1 });
changelogEventSchema.index({ eventType: 1, created: -1 });
changelogEventSchema.index({ field: 1, created: -1 });
changelogEventSchema.index({ issueId: 1, created: 1 });

// Индексы для временной аналитики
changelogEventSchema.index({ dayOfWeek: 1, hourOfDay: 1 });
changelogEventSchema.index({ created: 1, dayOfWeek: 1 });

// Композитные индексы для сложной аналитики
changelogEventSchema.index({
  departmentId: 1,
  authorAccountId: 1,
  created: -1
});

changelogEventSchema.index({
  eventType: 1,
  field: 1,
  created: -1
});

changelogEventSchema.index({
  fromAccountId: 1,
  field: 1,
  created: -1
});

changelogEventSchema.index({
  toAccountId: 1,
  field: 1,
  created: -1
});

changelogEventSchema.index({
  issueType: 1,
  field: 1,
  created: -1
});

changelogEventSchema.index({
  assignmentGroupId: 1,
  authorAccountId: 1,
  created: -1
});

// TTL индекс
changelogEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

// Middleware для автозаполнения временных полей
changelogEventSchema.pre('save', function(next) {
  if (this.created) {
    const date = new Date(this.created);
    this.dayOfWeek = date.getDay();
    this.hourOfDay = date.getHours();
  }
  next();
});

export default mongoose.models.ChangelogEvent || mongoose.model('ChangelogEvent', changelogEventSchema);
