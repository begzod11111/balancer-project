import mongoose from 'mongoose'


const IssueSchema = new mongoose.Schema(
  {
    issueId: { type: String, required: true, unique: true },
    issueKey: { type: String, required: true, unique: true },
    typeId: { type: String, required: true },
    status: { type: String, default: 'open' },
    issueStatusId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    assigneeAccountId: { type: String, required: false },
    assignmentGroupId: { type: String, required: false },

  },
  { timestamps: true }
)

IssueSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });
IssueSchema.index({ typeId: 1 })
IssueSchema.index({ assignmentGroupId: 1 })
IssueSchema.index({ assigneeAccountId: 1, issueStatusId: 1 });

const Issue = mongoose.model('Issue', IssueSchema)

export default Issue;