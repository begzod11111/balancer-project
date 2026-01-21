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
    async findIssue(issueKey, options = {}) {
        try {
            const {fields, expand} = options;
            let url = `/issue/${issueKey}`;
            const params = {};
            if (fields) params.fields = fields;
            if (expand) params.expand = expand;

            const response = await jiraAxios.get(url, {params});
            return response.data;
        } catch (error) {
            throw new Error(`Failed to fetch issue ${issueKey}: ${error.response?.data?.errorMessages?.join(', ') || error.message}`);
        }
    },

    // getJQLForIssues({
    //     projectKey = 'UAS',
    //     department = null,
    //                 }) {
    //     const jqlParts = issueKeys.map(key => `key = "${key}"`);
    //     return jqlParts.join(' OR ');
    // }

    async searchAssignee(assigneeKey, options = {}) {
        try {
            const {fields, expand} = options;
            let url = `/user/search`;
            const params = {
                query: assigneeKey
            };
            if (fields) params.fields = fields ? fields.join(',') : undefined;
            if (expand) params.expand = options.expand ? options.expand.join(',') : undefined;

            const response = await jiraAxios.get(url, {params});
            return response.data;
        } catch (error) {
            throw new Error(`Failed to fetch assignee ${assigneeKey}: ${error.response?.data?.errorMessages?.join(', ') || error.message}`);
        }
    },

    async searchIssues(jql, options = {}) {
        try {
            const {fields, nextPageToken = null, maxResults = 50} = options;
            const params = {
                jql,
                maxResults,
                nextPageToken,
                fields: fields ? fields.join(',') : undefined,
                expand: options.expand ? options.expand.join(',') : undefined,
            };

            const response = await jiraAxios.get('/search/jql', {params});
            return response.data;
        } catch (error) {
            throw new Error(`Failed to search issues: ${error.response?.data?.errorMessages?.join(', ') || error.message}`);
        }
    },

    async getComment(issueKey, commentId) {
        return jiraAxios.get(`/issue/${issueKey}/comment/${commentId}`)
            .then(response => response.data)
            .catch(error => {
                throw new Error(`Failed to fetch comment ${commentId} for issue ${issueKey}:   ${error.response?.data?.errorMessages?.join(', ') || error.message}`);
            });
    },

    async updateIssue(issueKey, payload) {
        try {
            const response = await jiraAxios.put(`/issue/${issueKey}`, payload);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to update issue ${issueKey}: ${error.response?.data?.errorMessages?.join(', ') || error.message}`);
        }
    },

    async transitionIssue(issueKey, payload) {
        try {
            const response = await jiraAxios.post(`/issue/${issueKey}/transitions`, payload);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to transition issue ${issueKey}: ${error.response?.data?.errorMessages?.join(', ') || error.message}`);
        }
    },
    async getIssueComments(issueKey) {
        try {
            const response = await jiraAxios.get(`/issue/${issueKey}/comment`);
            return response.data.comments;
        } catch (error) {
            throw new Error(`Failed to fetch comments for issue ${issueKey}: ${error.response?.data?.errorMessages?.join(', ') || error.message}`);
        }
    },
    async getIssue() {
        try {
            const response = await jiraAxios.get(`/issue/${config.project}`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to fetch issue: ${error.response?.data?.errorMessages?.join(', ') || error.message}`);
        }
    }
};


export default jira