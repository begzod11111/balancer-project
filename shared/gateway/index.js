import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import bodyParser from 'body-parser';
import authGuard from './middleware/authGuard.js';

const app = express();

// Конфигурация сервисов
const SERVICES = {
  shift: {
    url: 'http://0.0.0.0:9002',
    prefix: '/api/shift'
  },
  auth: {
    url: 'http://0.0.0.0:9000',
    prefix: '/api/auth'
  },
  analytics: {
    url: 'http://0.0.0.0:9001',
    prefix: '/api/analytics'
  }
};

// ВАЖНО: Middleware для парсинга body ПЕРЕД прокси
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Логирование запросов
app.use((req, res, next) => {
  console.log(`[Gateway] ${req.method} ${req.path}`, {
    body: req.body,
    headers: req.headers['content-type']
  });
  next();
});

// Общая функция для передачи body в прокси
const rewriteBody = (proxyReq, req) => {
  if (req.body && Object.keys(req.body).length > 0) {
    const bodyData = JSON.stringify(req.body);
    proxyReq.setHeader('Content-Type', 'application/json');
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  }
};

// ========== AUTH SERVICE ==========
app.use('/api/guard-auth/auth', createProxyMiddleware({
  target: SERVICES.auth.url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/guard-auth/auth': '/api/auth'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Gateway -> Auth] ${req.method} ${req.path}`);
    rewriteBody(proxyReq, req);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[Gateway <- Auth] Status: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error(`[Gateway] Auth service error:`, err.message);
    res.status(502).json({
      success: false,
      message: 'Auth service unavailable'
    });
  }
}));

// ========== SHIFT SERVICE - SCHEDULES ==========
app.use('/api/shift-service/shift', authGuard, createProxyMiddleware({
  target: SERVICES.shift.url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/shift-service/shift': '/api/shift'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Gateway -> Shift] ${req.method} ${req.path}`);

    // Передаем данные пользователя
    if (req.user) {
      proxyReq.setHeader('x-user-id', req.user.userId);
      proxyReq.setHeader('x-user-role', req.user.role);
      proxyReq.setHeader('x-user-email', req.user.email);
    }

    // Передаем body
    rewriteBody(proxyReq, req);
  },
  onError: (err, req, res) => {
    console.error(`[Gateway] Shift service error:`, err.message);
    res.status(502).json({
      success: false,
      message: 'Shift service unavailable'
    });
  }
}));

// ========== SHIFT SERVICE - DEPARTMENTS ==========
app.use('/api/shift-service/department', authGuard, createProxyMiddleware({
  target: SERVICES.shift.url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/shift-service/department': '/api/department'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Gateway -> Department] ${req.method} ${req.path}`);

    if (req.user) {
      proxyReq.setHeader('x-user-id', req.user.userId);
      proxyReq.setHeader('x-user-role', req.user.role);
      proxyReq.setHeader('x-user-email', req.user.email);
    }

    rewriteBody(proxyReq, req);
  },
  onError: (err, req, res) => {
    console.error(`[Gateway] Department service error:`, err.message);
    res.status(502).json({
      success: false,
      message: 'Department service unavailable'
    });
  }
}));

// ========== REDIS SHIFT SERVICE ==========
app.use('/api/shift-service/pool', authGuard, createProxyMiddleware({
  target: SERVICES.shift.url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/shift-service/pool': '/api/pool'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Gateway -> Redis Shift] ${req.method} ${req.path}`);

    if (req.user) {
      proxyReq.setHeader('x-user-id', req.user.userId);
      proxyReq.setHeader('x-user-role', req.user.role);
      proxyReq.setHeader('x-user-email', req.user.email);
    }

    rewriteBody(proxyReq, req);
  },
  onError: (err, req, res) => {
    console.error(`[Gateway] Redis Shift service error:`, err.message);
    res.status(502).json({
      success: false,
      message: 'Redis Shift service unavailable'
    });
  }
}));

// ========== ANALYTICS SERVICE - TYPES ==========
app.use('/api/analytics/type', authGuard, createProxyMiddleware({
  target: SERVICES.analytics.url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/analytics/type': '/api/type'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Gateway -> Analytics] ${req.method} ${req.path}`);

    if (req.user) {
      proxyReq.setHeader('x-user-id', req.user.userId);
      proxyReq.setHeader('x-user-role', req.user.role);
      proxyReq.setHeader('x-user-email', req.user.email);
    }

    rewriteBody(proxyReq, req);
  },
  onError: (err, req, res) => {
    console.error(`[Gateway] Analytics service error:`, err.message);
    res.status(502).json({
      success: false,
      message: 'Analytics service unavailable'
    });
  }
}));

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'gateway',
    timestamp: new Date().toISOString()
  });
});

// 404 для неизвес��ных маршрутов
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Обработчик ошибок
app.use((err, req, res, next) => {
  console.error('[Gateway] Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🚀 Gateway запущен на http://localhost:${PORT}`);
  console.log('Подключенные сервисы:');
  Object.entries(SERVICES).forEach(([name, config]) => {
    console.log(`  - ${name}: ${config.url} -> ${config.prefix}`);
  });
});
