
import { OpenAI } from 'openai';
import dotenv from "dotenv";


dotenv.config()

class OpenAIManager {
    constructor(apiKey = process.env.OPENAI_API_KEY) {
        if (!apiKey) {
            throw new Error('OpenAI API key не найден в .env');
        }

        this.client = new OpenAI({
            apiKey: apiKey
        });

        this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        this.temperature = parseFloat(process.env.AI_TEMPERATURE) || 0.3;
        this.maxTokens = parseInt(process.env.AI_MAX_TOKENS) || 1000;

        console.log(`[OpenAI] Инициализирован с моделью ${this.model}`);
    }

    /**
     * Генерирует ответ от OpenAI
     * @param {string} prompt - текст запроса
     * @param {Object} options - дополнительные параметры
     * @returns {Promise<string>} ответ от AI
     */
    async generateResponse(prompt, options = {}) {
        try {
            const completion = await this.client.chat.completions.create({
                model: options.model || this.model,
                messages: [
                    {
                        role: 'system',
                        content: options.systemPrompt || 'Ты полезный AI-ассистент.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: options.temperature ?? this.temperature,
                max_tokens: options.maxTokens || this.maxTokens,
                response_format: options.responseFormat || { type: "text" }
            });

            const response = completion.choices[0].message.content;
            console.log('[OpenAI] ✅ Ответ получен');

            return response;

        } catch (error) {
            console.error('[OpenAI] ❌ Ошибка генерации:', error);
            throw new Error(`OpenAI error: ${error.message}`);
        }
    }

    /**
     * Генерирует JSON-ответ от OpenAI
     * @param {string} prompt - текст запроса
     * @param {Object} options - дополнительные параметры
     * @returns {Promise<Object>} JSON объект
     */
    async generateJSONResponse(prompt, options = {}) {
        try {
            const completion = await this.client.chat.completions.create({
                model: options.model || this.model,
                messages: [
                    {
                        role: 'system',
                        content: options.systemPrompt || 'Ты полезный AI-ассистент. Отвечай ТОЛЬКО в формате JSON.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: options.temperature ?? this.temperature,
                max_tokens: options.maxTokens || this.maxTokens,
                response_format: { type: "json_object" }
            });

            const response = completion.choices[0].message.content;
            const parsed = JSON.parse(response);

            console.log('[OpenAI] ✅ JSON ответ получен');

            return parsed;

        } catch (error) {
            console.error('[OpenAI] ❌ Ошибка генерации JSON:', error);
            throw new Error(`OpenAI JSON error: ${error.message}`);
        }
    }

    /**
     * Потоковая генерация ответа (для чат-интерфейсов)
     * @param {string} prompt - текст запроса
     * @param {Function} onChunk - callback для каждого фрагмента
     * @param {Object} options - дополнительные параметры
     */
    async streamResponse(prompt, onChunk, options = {}) {
        try {
            const stream = await this.client.chat.completions.create({
                model: options.model || this.model,
                messages: [
                    {
                        role: 'system',
                        content: options.systemPrompt || 'Ты полезный AI-ассистент.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: options.temperature ?? this.temperature,
                max_tokens: options.maxTokens || this.maxTokens,
                stream: true
            });

            let fullResponse = '';

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                fullResponse += content;

                if (onChunk) {
                    onChunk(content);
                }
            }

            console.log('[OpenAI] ✅ Поток завершён');

            return fullResponse;

        } catch (error) {
            console.error('[OpenAI] ❌ Ошибка потоковой генерации:', error);
            throw new Error(`OpenAI stream error: ${error.message}`);
        }
    }

    /**
     * Проверяет доступность API
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        try {
            await this.client.models.list();
            console.log('[OpenAI] ✅ Сервис доступен');
            return true;
        } catch (error) {
            console.error('[OpenAI] ❌ Сервис недоступен:', error.message);
            return false;
        }
    }
}

export default OpenAIManager;
