import express from "express";
import cors from "cors";
import * as cron from "node-cron";
import shiftRouter from "./routes/workScheduleRoutes.js"
import {connectDB, models} from "./models/db.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import departmentService from "./services/departmentService.js";
import redisShiftRoutes from "./routes/redisShiftRoutes.js";



const app = express();
const PORT = 9002;


app.use(cors({
  origin: ['https://tamada.monitoring-jira.uz', 'http://0.0.0.0:9000'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true,
}));

app.use(express.json());



app.use('/api/shift', shiftRouter)
app.use('/api/department', departmentRoutes)
app.use('/api/pool', redisShiftRoutes)



// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});




async function startScheduler() {
  try {
    await connectDB();
  } catch (error) {
    console.error('Ошибка при запуске планировщика:', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}


startScheduler().catch((error) => console.log(error));