import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import * as cron from "node-cron";
import typeRoutes from './routes/typeRoutes.js';
import {connectDB} from "./models/db.js";
import {connectRedis} from "./services/redisService.js";
import webhookRoutes from "./webhook/webhook.js";
import {runShiftCreatedConsumer} from "./consumers/shift.consumer.js";
import jira from "./services/jiraService.js";
import {startConsumers} from "./consumers/index.js";


const app = express();
const PORT = 9001;



// Middleware
dotenv.config();

app.use(cors({
  origin: ['https://tamada.monitoring-jira.uz', 'http://0.0.0.0:9000'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/type', typeRoutes);
app.use('/api/webhook', webhookRoutes);

async function startScheduler() {
  try {
      await runShiftCreatedConsumer()
      await connectRedis()
      await connectDB()
      await startConsumers()
  } catch (error) {
    console.error('Ошибка при запуске планировщика:', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}



// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});


startScheduler().catch((error) => console.log(error));