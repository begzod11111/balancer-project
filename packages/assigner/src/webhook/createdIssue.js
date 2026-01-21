import express from 'express';


const router = express.Router();

router.post('/created-issue', async (req, res) => {
    try {
        const issueData = req.body;
        console.log('[Assigner] Received created issue webhook:', issueData);

        // Здесь можно добавить логику обработки созданной задачи,
        // например, назначение исполнителя на основе определенных правил.q
        // Пример ответа
        res.status(200).json({success: true, message: 'Issue processed successfully'});
    } catch (error) {
        console.error('[Assigner] Error processing created issue webhook:', error);
        res.status(500).json({success: false, message: 'Internal server error'});
    }
});

export default router;
