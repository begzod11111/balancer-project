import express from 'express';
import issueProducer from "../producers/issue.producer.js";
import commentService from "../services/commentService.js";


const router = express.Router();


router.post('/change-status', async (req, res) => {
    try {
        const statusData = req.body;
        issueProducer(statusData).then(
            () => console.log('[Analytics Service] Status change published to Kafka successfully'),
        ).catch(
            (error) => console.error('[Analytics Service] Error publishing status change to Kafka:', error)
        );

        res.status(200).json({success: true, message: 'Status change processed successfully'});
    } catch (error) {
        console.error('[Analytics Service] Error processing change status webhook:', error);
        res.status(500).json({success: false, message: 'Internal server error'});
    }
});

router.post('/comment-created', async (req, res) => {
    try {
        const webhookData = req.body;

        // Валидация данных
        if (!webhookData?.comment?.id || !webhookData?.issue?.key || !webhookData?.comment?.author?.accountId) {
            console.warn('[Analytics Service] Неполные данные комментария:', webhookData);
            return res.status(400).json({success: false, message: 'Missing required comment data'});
        }

        // Подготовка данных для сохранения
        const commentData = {
            commentId: webhookData.comment.id,
            issueKey: webhookData.issue.key,
            authorAccountId: webhookData.comment.author.accountId,
            createdAt: new Date(webhookData.comment.created),
            updatedAt: new Date(webhookData.comment.updated)
        };


        // Сохранение через сервис
        await commentService.upsertComment(commentData);

        res.status(200).json({
            success: true,
            message: 'Comment saved successfully',
            data: {
                commentId: commentData.commentId,
                issueKey: commentData.issueKey
            }
        });

    } catch (error) {
        console.error('[Analytics Service] Error processing comment created webhook:', error);
        res.status(500).json({success: false, message: 'Internal server error'});
    }
});

export default router;