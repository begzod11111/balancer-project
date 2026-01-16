import express from "express";
import cors from "cors";
import {connectDB, models} from "./models/db.js";
// import {connectRedis} from "./models/redisClient.js";
import authRoutes from "./routes/authRoute.js";


const app = express();
const PORT = 9000;


app.use(cors({
  origin: ['https://tamada.monitoring-jira.uz', 'http://localhost:8000'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true,
}));

app.use(express.json());
app.use('/api/auth', authRoutes)



// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});


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


startScheduler().catch((error) => console.log(error));
