// routes/auth.js
import express from 'express';
import authService from '../services/authService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Логин
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    console.log(login, password);
    if (!login || !password) {
      return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }
    const result = await authService.login(login, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message || 'Неверные учетные данные' });
  }
});

// Обновление токена
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token не предоставлен' });
    }
    const result = await authService.refresh(refreshToken);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message || 'Недействительный refresh token' });
  }
});

// проверка токена
router.post('/verify-token', authenticateToken, (req, res) => {
  if (req.user) {
    return res.json({ tokenValid: true });
  } else {
    return res.status(401).json({ tokenValid: false });
  }
});

// Выход
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: 'Пользователь не авторизован' });
    }
    await authService.logout(req.user.userId);
    res.json({ message: 'Выход выполнен успешно' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при выходе' });
  }
});

// Получить текущего пользователя
router.get('/me', authenticateToken, async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: 'Пользователь не авторизован' });
    }
    const user = await authService.getCurrentUser(req.user.userId);
    res.json(user);
  } catch (error) {
    res.status(404).json({ error: error.message || 'Пользователь не найден' });
  }
});

export default router;