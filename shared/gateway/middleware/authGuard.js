import jwt from 'jsonwebtoken';
import axios from 'axios';
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const AUTH_SERVICE_URL = 'http://crm_auth:9000';

const authGuard = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token not provided'
      });
    }

    const token = authHeader.split(' ')[1];

    // Проверяем токен через auth service
    try {
      const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/verify-token`, {
        token
      }, {
        timeout: 5000 // 5 секунд таймаут
      });
      console.log('[AuthGuard] Auth service response:', response.data);

      if (!response.data.tokenValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      // Декодируем токен для получения user данных
      const decoded = jwt.decode(token);
      console.log(decoded)
      // Добавляем данные пользователя в req объект
      req.user = {
        userId: decoded.userId || decoded.id,
        role: decoded.role,
        email: decoded.email,
      };

      console.log(`[AuthGuard] ✓ Authorized: ${decoded.email}`);
      next();

    } catch (verifyError) {
      console.error('[AuthGuard] Auth service error:', verifyError.message);

      // Если auth service недоступен, проверяем локально
      try {
        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = {
          userId: decoded.userId || decoded.id,
          role: decoded.role,
          email: decoded.email,
          accountId: decoded.accountId
        };

        console.log(`[AuthGuard] ✓ Authorized locally: ${decoded.email}`);
        next();

      } catch (jwtError) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
    }

  } catch (error) {
    console.error('[AuthGuard] Error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

export default authGuard;
