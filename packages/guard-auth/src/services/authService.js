// services/authService.js
import jwt from 'jsonwebtoken';
import { models } from '../models/db.js';
import User from "../models/user.js";
import * as dotenv from "dotenv";

dotenv.config();


class AuthService {
    async login(login, password) {
        const user = await models.User.findByCredentials(login, password);
        user.lastLogin = new Date();
        await user.save();

        const accessToken = jwt.sign(
            {
                userId: user._id.toString(),
                role: user.role,
                email: user.email

            },
            process.env.JWT_SECRET || 'your-secret-key',
            {expiresIn: '24h'}
        );
        const refreshToken = jwt.sign(
            {
                userId: user._id.toString(),
                role: user.role,
                email: user.email
            },
            process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
            {expiresIn: '7d'}
        );
        user.refreshToken = refreshToken;
        await user.save();

        const userWithAssignee = await models.User.findById(user._id)
            .lean();

        return {
            user: {
                id: userWithAssignee._id,
                username: userWithAssignee.username,
                email: userWithAssignee.email,
                displayName: userWithAssignee.displayName,
                role: userWithAssignee.role,
                department: userWithAssignee.department,
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
            {
                userId: user._id.toString(),
                role: user.role,
                email: user.email

            },
            process.env.JWT_SECRET || 'your-secret-key',
            {expiresIn: '24h'}
        );
        return {accessToken};
    }

    async logout(userId) {
        await models.User.findByIdAndUpdate(userId, {$unset: {refreshToken: 1}});
        return {message: 'Выход выполнен успешно'};
    }

    async getCurrentUser(userId) {
        const user = await models.User.findById(userId)
            .lean();
        if (!user) throw new Error('Пользователь не найден');
        return {
            id: user._id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            department: user.department,
            permissions: user.permissions,
            settings: user.settings
        };
    }

    async verifyAccessToken(token, {resolveUser = false} = {}) {
        if (!token) throw new Error('Токен не передан');

        if (typeof token === 'string' && token.startsWith('Bearer ')) {
            token = token.split(' ')[1];
        }

        try {
            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET || 'your-secret-key'
            );

            if (resolveUser) {
                const user = await models.User.findById(decoded.userId).lean();
                if (!user) throw new Error('Пользователь не найден');
                return {valid: true, decoded, user};
            }

            return {valid: true, decoded};
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                throw new Error('Tокен истек');
            }
            throw new Error('Недействительный токен');
        }
    }

}

export default new AuthService();