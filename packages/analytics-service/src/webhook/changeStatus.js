import express from 'express';


const router = express.Router();


router.post('/change-status', async (req, res) => {
    try {
        const statusData = req.body;
        console.log('[Analytics Service] Received change status webhook:', statusData);

        // Здесь можно добавить логику обработки изменения статуса задачи,
        // например, обновление аналитических данных или отправка уведомлений.
        // Пример ответа
        res.status(200).json({success: true, message: 'Status change processed successfully'});
    } catch (error) {
        console.error('[Analytics Service] Error processing change status webhook:', error);
        res.status(500).json({success: false, message: 'Internal server error'});
    }
});

export default router;