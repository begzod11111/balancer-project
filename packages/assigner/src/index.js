import express from "express";
import cors from "cors";
import {connectDB} from "./models/db.js";




const app = express();
const PORT = 9003;


app.use(express.json());



// Запуск сервера
app.listen(PORT, 'localhost', () => {
  console.log(`Server listening on http://localhost:${PORT}`);
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
