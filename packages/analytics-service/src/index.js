import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import * as cron from "node-cron";
import typeRoutes from './routes/typeRoutes.js';
import {connectDB} from "./models/db.js";


const app = express();
const PORT = 9001;



// Middleware
dotenv.config();

app.use(cors({
  origin: ['https://tamada.monitoring-jira.uz', 'http://localhost:8000'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/type', typeRoutes);

async function startScheduler() {
  try {
    await connectDB()
  } catch (error) {
    console.error('Ошибка при запуске планировщика:', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}



// Запуск сервера
app.listen(PORT, 'localhost', () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


startScheduler().catch((error) => console.log(error));