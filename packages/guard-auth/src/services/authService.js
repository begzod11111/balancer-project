// services/authService.js
import jwt from 'jsonwebtoken';
import { models } from '../models/db.js';

class AuthService {
  async login(login, password) {
    const user = await models.User.findByCredentials(login, password);
    user.lastLogin = new Date();
    await user.save();

    const accessToken = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    const refreshToken = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
      { expiresIn: '7d' }
    );
    user.refreshToken = refreshToken;
    await user.save();

    const userWithAssignee = await models.User.findById(user._id)
      .populate('assigneeData')
      .lean();

    return {
      user: {
        id: userWithAssignee._id,
        username: userWithAssignee.username,
        email: userWithAssignee.email,
        displayName: userWithAssignee.displayName,
        role: userWithAssignee.role,
        department: userWithAssignee.department,
        assigneeData: userWithAssignee.assigneeData,
        permissions: userWithAssignee.permissions
      },
      accessToken,
      refreshToken
    };
  }

  async refresh(refreshToken) {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret'
    );
    const user = await models.User.findById(decoded.userId).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      throw new Error('Недействительный refresh token');
    }
    const accessToken = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    return { accessToken };
  }

  async logout(userId) {
    await models.User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
    return { message: 'Выход выполнен успешно' };
  }

  async getCurrentUser(userId) {
    const user = await models.User.findById(userId)
      .populate('assigneeData')
      .lean();
    if (!user) throw new Error('Пользователь не найден');
    return {
      id: user._id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      department: user.department,
      assigneeData: user.assigneeData,
      permissions: user.permissions,
      settings: user.settings
    };
  }
}

export default new AuthService();