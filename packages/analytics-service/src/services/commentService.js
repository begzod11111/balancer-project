import Comment from '../models/comment.js';

class CommentService {
  /**
   * Создает новый комментарий или обновляет существующий
   * @param {Object} commentData - данные комментария
   * @returns {Promise<Object>} созданный/обновленный комментарий
   */
  async upsertComment(commentData) {
    const { commentId, issueKey, authorAccountId, createdAt, updatedAt } = commentData;

    try {
      const comment = await Comment.findOneAndUpdate(
        { commentId },
        {
          $set: {
            issueKey,
            authorAccountId,
            createdAt: createdAt || new Date(),
            updatedAt: updatedAt || new Date()
          }
        },
        { upsert: true, new: true }
      );

      console.log(`[CommentService] ✅ Комментарий ${commentId} сохранен`);
      return comment;
    } catch (error) {
      console.error(`[CommentService] ❌ Ошибка сохранения комментария ${commentId}:`, error.message);
      throw error;
    }
  }

  /**
   * Пакетное сохранение комментариев
   * @param {Array} comments - массив комментариев
   * @returns {Promise<Object>} статистика сохранения
   */
  async bulkUpsert(comments) {
    if (!comments || comments.length === 0) {
      return { added: 0, updated: 0, total: 0 };
    }

    const operations = comments.map(comment => ({
      updateOne: {
        filter: { commentId: comment.commentId },
        update: {
          $set: {
            issueKey: comment.issueKey,
            authorAccountId: comment.authorAccountId,
            createdAt: comment.createdAt || new Date(),
            updatedAt: comment.updatedAt || new Date()
          }
        },
        upsert: true
      }
    }));

    try {
      const result = await Comment.bulkWrite(operations, { ordered: false });

      console.log(`[CommentService] ✅ Сохранено комментариев: ${result.upsertedCount + result.modifiedCount}/${comments.length}`);

      return {
        added: result.upsertedCount,
        updated: result.modifiedCount,
        total: comments.length
      };
    } catch (error) {
      console.error('[CommentService] ❌ Ошибка пакетного сохранения:', error.message);
      throw error;
    }
  }

  /**
   * Получает комментарии по задаче
   * @param {string} issueKey - ключ задачи
   * @param {Object} options - опции сортировки и лимита
   * @returns {Promise<Array>} массив комментариев
   */
  async getCommentsByIssue(issueKey, options = {}) {
    const { limit = 100, sortOrder = -1 } = options;

    try {
      const comments = await Comment
        .find({ issueKey })
        .sort({ createdAt: sortOrder })
        .limit(limit)
        .lean();

      return comments;
    } catch (error) {
      console.error(`[CommentService] ❌ Ошибка получения комментариев для ${issueKey}:`, error.message);
      throw error;
    }
  }

  /**
   * Получает комментарии автора
   * @param {string} authorAccountId - ID автора
   * @param {Object} options - опции фильтрации
   * @returns {Promise<Array>} массив комментариев
   */
  async getCommentsByAuthor(authorAccountId, options = {}) {
    const { limit = 100, startDate, endDate } = options;

    const query = { authorAccountId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    try {
      const comments = await Comment
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return comments;
    } catch (error) {
      console.error(`[CommentService] ❌ Ошибка получения комментариев автора ${authorAccountId}:`, error.message);
      throw error;
    }
  }

  /**
   * Подсчитывает комментарии автора за период
   * @param {string} authorAccountId - ID автора
   * @param {Date} startDate - начало периода
   * @param {Date} endDate - конец периода
   * @returns {Promise<number>} количество комментариев
   */
  async countAuthorComments(authorAccountId, startDate, endDate) {
    const query = { authorAccountId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    try {
      return await Comment.countDocuments(query);
    } catch (error) {
      console.error(`[CommentService] ❌ Ошибка подсчета комментариев:`, error.message);
      throw error;
    }
  }

  /**
   * Удаляет комментарий по ID
   * @param {string} commentId - ID комментария
   * @returns {Promise<boolean>} успешность удаления
   */
  async deleteComment(commentId) {
    try {
      const result = await Comment.deleteOne({ commentId });

      if (result.deletedCount > 0) {
        console.log(`[CommentService] ✅ Комментарий ${commentId} удален`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`[CommentService] ❌ Ошибка удаления комментария ${commentId}:`, error.message);
      throw error;
    }
  }

  /**
   * Получает статистику комментариев по задаче
   * @param {string} issueKey - ключ задачи
   * @returns {Promise<Object>} статистика
   */
  async getIssueCommentStats(issueKey) {
    try {
      const stats = await Comment.aggregate([
        { $match: { issueKey } },
        {
          $group: {
            _id: '$issueKey',
            totalComments: { $sum: 1 },
            uniqueAuthors: { $addToSet: '$authorAccountId' },
            firstComment: { $min: '$createdAt' },
            lastComment: { $max: '$createdAt' }
          }
        },
        {
          $project: {
            _id: 0,
            issueKey: '$_id',
            totalComments: 1,
            uniqueAuthorsCount: { $size: '$uniqueAuthors' },
            firstComment: 1,
            lastComment: 1
          }
        }
      ]);

      return stats[0] || null;
    } catch (error) {
      console.error(`[CommentService] ❌ Ошибка получения статистики для ${issueKey}:`, error.message);
      throw error;
    }
  }
}

export default new CommentService();
