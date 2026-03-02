import redis from '../config/redis.js';


class RedisServices {

    constructor() {
        this.KEY_PREFIX = 'Department';
        this.DEFAULT_TTL = 86400; // 24 часа
    }

    /**
     * Получение всех смен по департаменту
     * @param {string} departmentObjectId
     */
    async getShiftsByDepartment(departmentObjectId) {
        try {
            const pattern = `${this.KEY_PREFIX}:${departmentObjectId}:*`;
            const keys = await redis.keys(pattern);

            if (keys.length === 0) {
                return [];
            }

            const pipeline = redis.pipeline();
            keys.forEach(key => pipeline.get(key));

            const results = await pipeline.exec();

            return results
                .filter(([err, data]) => !err && data)
                .map(([, data]) => JSON.parse(data));
        } catch (error) {
            console.error('[Redis] Ошибка получения смен по департаменту:', error);
            throw error;
        }
    }

}


export default new RedisServices();