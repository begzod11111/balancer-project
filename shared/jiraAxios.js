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

export default jiraAxios;