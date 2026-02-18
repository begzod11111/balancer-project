import mongoose from 'mongoose';

const changelogItemSchema = new mongoose.Schema({
  field: { type: String, required: true, index: true },
  fieldtype: { type: String },
  fieldId: { type: String },
  from: { type: String },
  fromString: { type: String },
  to: { type: String },
  toString: { type: String },
  tmpFromAccountId: { type: String },
  tmpToAccountId: { type: String }
}, { _id: false });

const changelogHistorySchema = new mongoose.Schema({
  historyId: { type: String, required: true, index: true },
  eventType: { type: String, index: true }, // issue_assigned, issue_updated, etc.
  author: {
    accountId: { type: String, required: true, index: true },
    displayName: { type: String },
    email: { type: String },
    avatarUrl: { type: String },
    active: { type: Boolean, default: true },
    timeZone: { type: String },
    accountType: { type: String }
  },
  created: { type: Date, required: true, index: true },
  items: [changelogItemSchema]
}, { _id: false });

const issueChangelogSchema = new mongoose.Schema({
  issueId: { type: String, required: true, unique: true, index: true },
  issueKey: { type: String, required: true, index: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true },
  histories: [changelogHistorySchema],
  lastUpdated: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true,
  collection: 'issue_changelogs'
});

// Индексы для оптимизации запросов
issueChangelogSchema.index({ issueId: 1, 'histories.historyId': 1 });
issueChangelogSchema.index({ departmentId: 1, lastUpdated: -1 });
issueChangelogSchema.index({ 'histories.author.accountId': 1, 'histories.created': -1 });
issueChangelogSchema.index({ 'histories.items.field': 1, 'histories.created': -1 });
issueChangelogSchema.index({ 'histories.eventType': 1, 'histories.created': -1 });

// TTL индекс: удаление через 7 дней после создания
issueChangelogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

export default mongoose.models.IssueChangelog || mongoose.model('IssueChangelog', issueChangelogSchema);

