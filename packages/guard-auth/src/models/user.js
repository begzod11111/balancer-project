// models/user.js
import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // По умолчанию не возвращаем пароль
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    required: true,
    enum: ['customer', 'senior', 'lead', 'moderator', 'owner'],
    default: 'customer'
  },
  assigneeId: {
    type: Schema.Types.ObjectId,
    ref: 'Assignee',
    default: null // Может быть null если это не сотрудник поддержки
  },
  department: {
    type: String,
    default: 'Support'
  },
  avatar: {
    type: String,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  },
  deleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  refreshToken: {
    type: String,
    default: null,
    select: false
  },
  permissions: [{
    type: String
  }], // Дополнительные разрешения помимо роли
  settings: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    language: {
      type: String,
      default: 'ru'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Виртуальное поле для получения данных assignee
// userSchema.virtual('assigneeData', {
//   ref: 'Assignee',
//   localField: 'assigneeId',
//   foreignField: '_id',
//   justOne: true
// });

// Индексы для производительности
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ role: 1, active: 1 });
userSchema.index({ assigneeId: 1 });

/**
 * Hash password before saving
 */
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

/**
 * Compare provided password with stored hash
 */
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

/**
 * Получить все разрешения пользователя (роль + дополнительные)
 */
userSchema.methods.getAllPermissions = function() {
  const rolePermissions = getRolePermissions(this.role);
  const additionalPermissions = this.permissions || [];

  // Объединяем и удаляем дубликаты
  return [...new Set([...rolePermissions, ...additionalPermissions])];
};

/**
 * Проверить наличие разрешения
 */
userSchema.methods.hasPermission = function(permission) {
  const permissions = this.getAllPermissions();
  return permissions.includes('*') || permissions.includes(permission);
};

/**
 * Проверить, может ли пользователь управлять другим пользователем
 */
userSchema.methods.canManageUser = function(targetUser) {
  const roleHierarchy = {
    'customer': 1,
    'senior': 2,
    'lead': 3,
    'moderator': 4,
    'owner': 5
  };

  return roleHierarchy[this.role] > roleHierarchy[targetUser.role];
};

/**
 * Создать или обновить связь с Assignee
 */
userSchema.methods.linkToAssignee = async function() {
  const Assignee = mongoose.model('Assignee');

  if (!this.assigneeId) {
    // Создаем новую запись в Assignee
    const assignee = await Assignee.create({
      accountId: this._id.toString(),
      accountType: this.role,
      emailAddress: this.email,
      displayName: this.displayName,
      active: this.active,
      timeZone: 'Asia/Tashkent', // По умолчанию
      locale: 'ru',
      shiftSchedule: [false, true, true, true, true, true, false] // ПН-ПТ по умолчанию
    });

    this.assigneeId = assignee._id;
    await this.save();
  } else {
    // Обновляем существующую запись
    await Assignee.findByIdAndUpdate(this.assigneeId, {
      accountType: this.role,
      emailAddress: this.email,
      displayName: this.displayName,
      active: this.active
    });
  }

  return this.assigneeId;
};

/**
 * Найти пользователя по email или username
 */
userSchema.statics.findByCredentials = async function(login, password) {
  const user = await this.findOne({
    $or: [
      { email: login.toLowerCase() },
      { username: login.toLowerCase() }
    ]
  }).select('+password');

  if (!user) {
    throw new Error('Invalid login credentials');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid login credentials');
  }

  return user;
};

/**
 * Получить активных пользователей по роли
 */
userSchema.statics.getActiveByRole = async function(role) {
  return await this.find({
    role,
    active: true,
    deleted: false
  }).populate('assigneeData');
};

/**
 * Софт-удаление пользователя
 */
userSchema.methods.softDelete = async function() {
  this.deleted = true;
  this.deletedAt = new Date();
  this.active = false;

  // Деактивируем связанного assignee
  if (this.assigneeId) {
    const Assignee = mongoose.model('Assignee');
    await Assignee.findByIdAndUpdate(this.assigneeId, { active: false });
  }

  return await this.save();
};

// Функция получения разрешений по роли
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
      // Все разрешения senior
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
      // Все разрешения lead
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
      'view_audit_logs',
      'manage_integrations'
    ],
    owner: [
      '*' // Полный доступ
    ]
  };

  return permissions[role] || [];
}

export default mongoose.model('User', userSchema);