import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema(
  {
    commentId: { type: String, required: true },
    issueKey: { type: String, required: true },
    authorAccountId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Индексы для поиска
CommentSchema.index({ commentId: 1 }, { unique: true });
CommentSchema.index({ issueKey: 1 });
CommentSchema.index({ authorAccountId: 1 });
CommentSchema.index({ issueKey: 1, createdAt: -1 }); // Для поиска комментариев по задаче с сортировкой
CommentSchema.index({ authorAccountId: 1, createdAt: -1 }); // Для поиска комментариев автора с сортировкой
CommentSchema.index({ createdAt: -1 }); // Для временных запросов

// TTL индекс
CommentSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

const Comment = mongoose.model("Comment", CommentSchema);

export default Comment;
