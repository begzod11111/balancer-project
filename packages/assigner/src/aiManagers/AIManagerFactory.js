import OpenAIManager from './openAIManager.js';
import GeminiManager from './geminiManager.js';
import dotenv from 'dotenv';

dotenv.config();

class AIManagerFactory {
    /**
     * Создаёт менеджер с автоматическим fallback
     */
    static createWithFallback() {
        const primaryProvider = process.env.AI_PROVIDER || 'openai';

        let primary, fallback;

        if (primaryProvider === 'openai') {
            primary = new OpenAIManager();
            fallback = new GeminiManager();
        } else {
            primary = new GeminiManager();
            fallback = new OpenAIManager();
        }

        console.log(`[AIFactory] Primary: ${primaryProvider}, Fallback: ${primaryProvider === 'openai' ? 'gemini' : 'openai'}`);

        return {
            primary,
            fallback,

            /**
             * Генерация с автоматическим переключением
             */
            async generateResponse(prompt, options = {}) {
                try {
                    return await primary.generateResponse(prompt, options);
                } catch (error) {
                    console.warn('[AIFactory] ⚠️ Primary провайдер недоступен, переключаемся на fallback');
                    console.warn(`[AIFactory] Ошибка: ${error.message}`);

                    try {
                        return await fallback.generateResponse(prompt, options);
                    } catch (fallbackError) {
                        console.error('[AIFactory] ❌ Fallback тоже недоступен!');
                        throw new Error(`Все AI-провайдеры недоступны. Primary: ${error.message}, Fallback: ${fallbackError.message}`);
                    }
                }
            },

            /**
             * JSON генерация с fallback
             */
            async generateJSONResponse(prompt, options = {}) {
                try {
                    return await primary.generateJSONResponse(prompt, options);
                } catch (error) {
                    console.warn('[AIFactory] ⚠️ Primary провайдер недоступен для JSON, переключаемся на fallback');

                    try {
                        return await fallback.generateJSONResponse(prompt, options);
                    } catch (fallbackError) {
                        throw new Error(`Все AI-провайдеры недоступны для JSON`);
                    }
                }
            },

            /**
             * Health check обоих провайдеров
             */
            async checkHealth() {
                const [primaryHealth, fallbackHealth] = await Promise.all([
                    primary.healthCheck().catch(() => false),
                    fallback.healthCheck().catch(() => false)
                ]);

                console.log(`[AIFactory] Health: Primary=${primaryHealth}, Fallback=${fallbackHealth}`);

                return {
                    primary: primaryHealth,
                    fallback: fallbackHealth,
                    anyAvailable: primaryHealth || fallbackHealth
                };
            }
        };
    }

    /**
     * Простое создание без fallback
     */
    static create(provider = process.env.AI_PROVIDER) {
        switch (provider?.toLowerCase()) {
            case 'openai':
                return new OpenAIManager();
            case 'gemini':
                return new GeminiManager();
            default:
                console.warn(`[AIFactory] Неизвестный провайдер "${provider}", используем OpenAI`);
                return new OpenAIManager();
        }
    }
}

export default AIManagerFactory;
