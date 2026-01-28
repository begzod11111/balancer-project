import mongoose from "mongoose";


const CommentSchema = new mongoose.Schema(
  {
    commentId: { type: String, required: true, unique: true },
    issueId: { type: String, required: true },
    author: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

CommentSchema.index({ author: 1 });

const Comment = mongoose.model("Comment", CommentSchema);

export default Comment;