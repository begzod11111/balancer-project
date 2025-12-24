import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import * as cron from "node-cron";

const app = express();
const PORT = 8080;



// Middleware
dotenv.config();

app.use(cors({
  origin: ["http://localhost:5000", "https://monitoring-jira.uz/", "http://localhost:3000", "http://192.168.200.77:3000"],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true,
}));

// Запуск сервера
app.listen(PORT, 'localhost', () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});