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