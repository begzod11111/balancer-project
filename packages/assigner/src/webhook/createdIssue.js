import express from 'express';
import publishIssueCreated from '../config/publishIssueCreated.js';
import redisServices from "../services/redisServices.js";
import assignedServices from "../services/assignedServices.js";

const router = express.Router();

router.post('/created-issue', async (req, res) => {
    try {
        const issueData = req.body;
        const assignmentGroupId =  issueData.issue.fields.customfield_18219?.[0]?.objectId || null
        await publishIssueCreated(issueData);

        await new Promise(resolve => setTimeout(resolve, 30000));

        await assignedServices.assignedIssue(issueData.issue.key, assignmentGroupId);
        res.status(200).json({success: true, message: 'Issue processed successfully'});
    } catch (error) {
        console.error('[Assigner] Error processing created issue webhook:', error);
        res.status(500).json({success: false, message: 'Internal server error'});
    }
});

export default router;