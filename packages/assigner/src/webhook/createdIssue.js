import express from 'express';
import publishIssueCreated from '../config/publishIssueCreated.js';

const router = express.Router();

router.post('/created-issue', async (req, res) => {
    try {
        const issueData = req.body;

        await publishIssueCreated(issueData);

        res.status(200).json({success: true, message: 'Issue processed successfully'});
    } catch (error) {
        console.error('[Assigner] Error processing created issue webhook:', error);
        res.status(500).json({success: false, message: 'Internal server error'});
    }
});

export default router;
