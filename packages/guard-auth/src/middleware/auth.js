// middleware/auth.js
import jwt from 'jsonwebtoken';
import { models } from '../models/db.js';

// Основной middleware аутентификации
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        error: 'Токен не предоставлен',
        code: 'NO_TOKEN'
      });
    }

    // Проверяем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Получаем актуальные данные пользователя из БД
    const user = await models.User.findById(decoded.userId)
      .populate('assigneeData')
      .lean();

    if (!user) {
      return res.status(401).json({
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.active) {
      return res.status(403).json({
        error: 'Аккаунт деактивирован',
        code: 'ACCOUNT_DISABLED'
      });
    }
    // Добавляем данные пользователя в запрос
    req.user = {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      department: user.department,
      assigneeId: user.assigneeId,
      assigneeData: user.assigneeData,
      permissions: user.permissions || []
    };

    // Обновляем время последнего входа
    await models.User.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Недействительный токен',
        code: 'INVALID_TOKEN'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Токен истек',
        code: 'TOKEN_EXPIRED'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Ошибка аутентификации',
      code: 'AUTH_ERROR'
    });
  }
};

// Middleware для проверки ролей
export const requireRole = (...allowedRoles) => {

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Не аутентифицирован',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!allowedRoles[0].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Недостаточно прав',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

// Middleware для проверки конкретных разрешений
export const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Не аутентифицирован',
        code: 'NOT_AUTHENTICATED'
      });
    }

    const permissions = getRolePermissions(req.user.role);

    if (!permissions.includes(permission) && !permissions.includes('*')) {
      return res.status(403).json({
        error: 'Отсутствует разрешение',
        code: 'PERMISSION_DENIED',
        permission: permission
      });
    }

    next();
  };
};

// Проверка доступа к собственным данным или роли
export const requireSelfOrRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Не аутентифицирован',
        code: 'NOT_AUTHENTICATED'
      });
    }

    const targetId = req.params.id || req.body.userId;
    const isSelf = targetId === req.user.userId;
    const hasRole = allowedRoles.includes(req.user.role);

    if (!isSelf && !hasRole) {
      return res.status(403).json({
        error: 'Доступ запрещен',
        code: 'ACCESS_DENIED',
        message: 'Вы можете управлять только своими данными'
      });
    }

    req.isSelf = isSelf;
    next();
  };
};

// Определение разрешений для ролей
function getRolePermissions(role) {
  const permissions = {
    customer: [
      'view_own_profile',
      'update_own_profile',
      'view_own_schedule',
      'update_own_schedule',
      'view_own_issues',
      'view_own_stats'
    ],
    senior: [
      'view_own_profile',
      'update_own_profile',
      'view_own_schedule',
      'update_own_schedule',
      'view_own_issues',
      'view_own_stats',
      // Дополнительные разрешения
      'view_all_schedules',
      'update_all_schedules',
      'create_schedule',
      'delete_schedule',
      'view_all_employees',
      'view_employee_stats',
      'view_all_issues',
      'assign_issues',
      'update_issues',
      'view_reports'
    ],
    lead: [
      'view_own_profile',
      'update_own_profile',
      'view_own_schedule',
      'update_own_schedule',
      'view_own_issues',
      'view_own_stats',
      'view_all_schedules',
      'update_all_schedules',
      'create_schedule',
      'delete_schedule',
      'view_all_employees',
      'view_employee_stats',
      'view_all_issues',
      'assign_issues',
      'update_issues',
      'view_reports',
      // Дополнительные разрешения
      'create_employee',
      'update_employee',
      'deactivate_employee',
      'view_system_logs',
      'export_data',
      'manage_departments'
    ],
    moderator: [
      'view_own_profile',
      'update_own_profile',
      'view_own_schedule',
      'update_own_schedule',
      'view_own_issues',
      'view_own_stats',
      'view_all_schedules',
      'update_all_schedules',
      'create_schedule',
      'delete_schedule',
      'view_all_employees',
      'view_employee_stats',
      'view_all_issues',
      'assign_issues',
      'update_issues',
      'view_reports',
      'create_employee',
      'update_employee',
      'deactivate_employee',
      'view_system_logs',
      'export_data',
      'manage_departments',
      // Дополнительные разрешения
      'delete_employee',
      'change_employee_role',
      'manage_settings',
      'manage_integrations'
    ],
    owner: [
      '*' // Полный доступ
    ]
  };

  return permissions[role] || [];
}

// Проверка, есть ли у пользователя конкретное разрешение
export function hasPermission(userRole, permission) {
  const permissions = getRolePermissions(userRole);
  return permissions.includes('*') || permissions.includes(permission);
}

// Rate limiting middleware для защиты от брутфорса
const rateLimitMap = new Map();

export const rateLimit = (maxRequests = 100, windowMs = 60000) => {
  return (req, res, next) => {
    const key = `${req.ip}:${req.user?.userId || 'anonymous'}`;
    const now = Date.now();

    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const limit = rateLimitMap.get(key);

    if (now > limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + windowMs;
      return next();
    }

    if (limit.count >= maxRequests) {
      const retryAfter = Math.ceil((limit.resetTime - now) / 1000);
      return res.status(429).json({
        error: 'Слишком много запросов',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter
      });
    }

    limit.count++;
    next();
  };
};

// Очистка rate limit map каждые 10 минут
setInterval(() => {
  const now = Date.now();
  for (const [key, limit] of rateLimitMap.entries()) {
    if (now > limit.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 600000);

export default authenticateToken;