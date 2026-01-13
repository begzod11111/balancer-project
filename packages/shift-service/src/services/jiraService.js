import jiraAxios from '../../../../shared/jiraAxios.js';



const jira = {
    async findAssigneeByEmail(email, options = {}) {
        try {
            let url = `/user/search`;
            const params = {
                query: email
            };

            const response = await jiraAxios.get(url, {params});
            return response.data;
        } catch (error) {
            throw new Error(`Failed to fetch assignee by email ${email}: ${error.response?.data?.errorMessages?.join(', ') || error.message}`);
        }
    }
}

export default jira;