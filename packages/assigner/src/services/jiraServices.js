import axios from "axios";
import dotenv from "dotenv";


dotenv.config();


const jiraAxios = axios.create({
    baseURL: `https://${process.env.JIRA_URL}/rest/api/3`,
    auth: {
        username: process.env.JIRA_USERNAME,
        password: process.env.JIRA_API_TOKEN,
    },
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});


const jira = {

    async assignIssue(issueKey, assigneeAccountId) {
        try {
            const response = await jiraAxios.put(`/issue/${issueKey}/assignee`, {
                accountId: assigneeAccountId
            });
            return response.data;
        } catch (error) {
            throw new Error(`Failed to assign issue ${issueKey} to ${assigneeAccountId}: ${error.response?.data?.errorMessages?.join(', ') || error.message}`);
        }
    },


    getAssignmentGroupIssues(assignmentGroup, options = {}) {
        const jql = `project = "${process.env.DEFAULT_PROJECT_KEY}" AND "${process.env.DEPARTMENT_FIELD_JIRA_NAME}" = "ari:cloud:cmdb::object/1be9e6ab-23d3-4044-be51-802c29c0229a/${assignmentGroup.objectId}" ORDER BY created DESC`;
        return this.searchIssues(jql, options);
    },



};


export default jira