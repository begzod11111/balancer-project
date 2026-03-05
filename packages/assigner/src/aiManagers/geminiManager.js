import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

class GeminiManager {
    constructor(apiKey = process.env.GEMINI_API_KEY) {
        if (!apiKey) {
            throw new Error('Google API key не найден в .env');
        }

        this.client = new GoogleGenerativeAI(apiKey);

        // Используем стабильную модель
        this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        this.temperature = parseFloat(process.env.AI_TEMPERATURE) || 0.3;
        this.maxTokens = parseInt(process.env.AI_MAX_TOKENS) || 1000;

        // Настройки retry
        this.maxRetries = 3;
        this.retryDelay = 2000; // 2 секунды

        this.model = this.client.getGenerativeModel({
            model: this.modelName,
            generationConfig: {
                temperature: this.temperature,
                maxOutputTokens: this.maxTokens,
            }
        });

        console.log(`[Gemini] ✅ Инициализирован с моделью ${this.modelName}`);
    }

    /**
     * Генерирует ответ с retry-логикой
     */
    async generateResponse(prompt, options = {}) {
        let lastError;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`[Gemini] Попытка ${attempt}/${this.maxRetries}`);

                const fullPrompt = options.systemPrompt
                    ? `${options.systemPrompt}\n\n${prompt}`
                    : prompt;

                const result = await this.model.generateContent(fullPrompt);
                const response = result.response.text();

                console.log('[Gemini] ✅ Ответ получен');
                return response;

            } catch (error) {
                lastError = error;
                console.error(`[Gemini] ❌ Попытка ${attempt} неудачна:`, error.message);

                // Если 503 (перегрузка) - пробуем ещё раз
                if (error.status === 503 && attempt < this.maxRetries) {
                    const delay = this.retryDelay * attempt; // экспоненциальная задержка
                    console.log(`[Gemini] ⏳ Ожидание ${delay}мс перед повтором...`);
                    await this._sleep(delay);
                    continue;
                }

                // Если 404 (модель не найдена) - сразу выходим
                if (error.status === 404) {
                    throw new Error(`Модель ${this.modelName} не найдена. Используйте: gemini-1.5-flash или gemini-1.5-pro`);
                }

                // Если другая ошибка - выходим
                if (attempt === this.maxRetries) {
                    break;
                }
            }
        }

        throw new Error(`Gemini недоступен после ${this.maxRetries} попыток: ${lastError?.message}`);
    }

    /**
     * Генерирует JSON с retry
     */
    async generateJSONResponse(prompt, options = {}) {
        let lastError;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`[Gemini] JSON попытка ${attempt}/${this.maxRetries}`);

                const systemPrompt = options.systemPrompt || 'Ты полезный AI-ассистент. Отвечай ТОЛЬКО в формате JSON.';
                const fullPrompt = `${systemPrompt}\n\n${prompt}\n\nОТВЕЧАЙ СТРОГО В ФОРМАТЕ JSON БЕЗ MARKDOWN.`;

                const result = await this.model.generateContent(fullPrompt);
                let response = result.response.text();

                // Очистка от markdown
                response = response
                    .replace(/```json\n?/g, '')
                    .replace(/```\n?/g, '')
                    .replace(/^\s+|\s+$/g, '');

                const parsed = JSON.parse(response);

                console.log('[Gemini] ✅ JSON ответ получен');
                return parsed;

            } catch (error) {
                lastError = error;
                console.error(`[Gemini] ❌ JSON попытка ${attempt} неудачна:`, error.message);

                if (error.status === 503 && attempt < this.maxRetries) {
                    await this._sleep(this.retryDelay * attempt);
                    continue;
                }

                if (attempt === this.maxRetries) {
                    break;
                }
            }
        }

        throw new Error(`Gemini JSON недоступен: ${lastError?.message}`);
    }

    /**
     * Health check без retry (быстрая проверка)
     */
    async healthCheck() {
        try {
            await this.model.generateContent('ping');
            console.log('[Gemini] ✅ Сервис доступен');
            return true;
        } catch (error) {
            console.error('[Gemini] ❌ Сервис недоступен:', error.message);
            return false;
        }
    }

    /**
     * Вспомогательная функция для задержки
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Получает список доступных моделей
     */
    async listAvailableModels() {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
            );
            const data = await response.json();

            console.log('[Gemini] Доступные модели:');
            data.models?.forEach(model => {
                if (model.name.includes('gemini')) {
                    console.log(`  - ${model.name.split('/').pop()}`);
                }
            });

            return data.models || [];
        } catch (error) {
            console.error('[Gemini] ❌ Ошибка получения списка моделей:', error);
            return [];
        }
    }
}

export default GeminiManager;
