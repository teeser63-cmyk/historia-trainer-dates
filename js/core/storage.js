// ============================================
// РАБОТА С ХРАНИЛИЩЕМ (localStorage)
// ============================================

import { safeLocalStorageGet, safeLocalStorageSet } from './utils.js';

// Ключи для localStorage
const STORAGE_KEYS = {
    STATS: 'historia_stats',
    ACHIEVEMENTS: 'historia_achievements',
    SETTINGS: 'historia_settings',
    HISTORY: 'historia_history'
};

// Структура статистики по умолчанию
const DEFAULT_STATS = {
    total: {
        correct: 0,
        wrong: 0,
        skipped: 0,
        score: 0
    },
    byPeriod: {},
    byDifficulty: {
        легкая: { correct: 0, total: 0 },
        средняя: { correct: 0, total: 0 },
        высокая: { correct: 0, total: 0 }
    },
    byMode: {},
    difficultDates: {},
    lastUpdated: new Date().toISOString()
};

// Структура истории по умолчанию
const DEFAULT_HISTORY = {
    daily: [],
    sessions: []
};

// Структура достижений по умолчанию
const DEFAULT_ACHIEVEMENTS = {};

// Структура настроек по умолчанию
const DEFAULT_SETTINGS = {
    theme: 'light',
    cardsPerPage: 20,
    defaultView: 'cards',
    soundEnabled: true,
    animationsEnabled: true
};

/**
 * Класс для работы с хранилищем
 */
export class Storage {
    /**
     * Получение статистики
     * @returns {Object} - Статистика
     */
    static getStats() {
        return safeLocalStorageGet(STORAGE_KEYS.STATS, DEFAULT_STATS);
    }
    
    /**
     * Сохранение статистики
     * @param {Object} stats - Статистика
     * @returns {boolean} - Успешно ли сохранено
     */
    static saveStats(stats) {
        stats.lastUpdated = new Date().toISOString();
        return safeLocalStorageSet(STORAGE_KEYS.STATS, stats);
    }
    
    /**
     * Получение истории
     * @returns {Object} - История
     */
    static getHistory() {
        return safeLocalStorageGet(STORAGE_KEYS.HISTORY, DEFAULT_HISTORY);
    }
    
    /**
     * Сохранение истории
     * @param {Object} history - История
     * @returns {boolean} - Успешно ли сохранено
     */
    static saveHistory(history) {
        return safeLocalStorageSet(STORAGE_KEYS.HISTORY, history);
    }
    
    /**
     * Получение достижений
     * @returns {Object} - Достижения
     */
    static getAchievements() {
        return safeLocalStorageGet(STORAGE_KEYS.ACHIEVEMENTS, DEFAULT_ACHIEVEMENTS);
    }
    
    /**
     * Сохранение достижений
     * @param {Object} achievements - Достижения
     * @returns {boolean} - Успешно ли сохранено
     */
    static saveAchievements(achievements) {
        return safeLocalStorageSet(STORAGE_KEYS.ACHIEVEMENTS, achievements);
    }
    
    /**
     * Получение настроек
     * @returns {Object} - Настройки
     */
    static getSettings() {
        return safeLocalStorageGet(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    }
    
    /**
     * Сохранение настроек
     * @param {Object} settings - Настройки
     * @returns {boolean} - Успешно ли сохранено
     */
    static saveSettings(settings) {
        return safeLocalStorageSet(STORAGE_KEYS.SETTINGS, settings);
    }
    
    /**
     * Добавление сессии тренировки в историю
     * @param {Object} session - Данные сессии
     */
    static addTrainingSession(session) {
        const history = this.getHistory();
        
        // Добавляем сессию
        history.sessions.push({
            ...session,
            timestamp: new Date().toISOString()
        });
        
        // Ограничиваем количество сессий
        if (history.sessions.length > 100) {
            history.sessions = history.sessions.slice(-100);
        }
        
        // Обновляем дневную статистику
        const today = new Date().toISOString().split('T')[0];
        const dailyIndex = history.daily.findIndex(d => d.date === today);
        
        const dailyData = {
            date: today,
            correct: session.correct,
            wrong: session.wrong,
            skipped: session.skipped,
            score: session.score
        };
        
        if (dailyIndex >= 0) {
            history.daily[dailyIndex].correct += session.correct;
            history.daily[dailyIndex].wrong += session.wrong;
            history.daily[dailyIndex].skipped += session.skipped;
            history.daily[dailyIndex].score += session.score;
        } else {
            history.daily.push(dailyData);
        }
        
        // Ограничиваем дневную историю 30 днями
        if (history.daily.length > 30) {
            history.daily = history.daily.slice(-30);
        }
        
        this.saveHistory(history);
    }
    
    /**
     * Обновление статистики по датам
     * @param {number} dateId - ID даты
     * @param {boolean} isCorrect - Правильный ли ответ
     */
    static updateDateStats(dateId, isCorrect) {
        const stats = this.getStats();
        
        if (!stats.difficultDates[dateId]) {
            stats.difficultDates[dateId] = { correct: 0, total: 0 };
        }
        
        stats.difficultDates[dateId].total++;
        if (isCorrect) {
            stats.difficultDates[dateId].correct++;
        }
        
        this.saveStats(stats);
    }
    
    /**
     * Обновление статистики по режимам
     * @param {string} mode - Режим тренировки
     * @param {boolean} isCorrect - Правильный ли ответ
     */
    static updateModeStats(mode, isCorrect) {
        const stats = this.getStats();
        
        if (!stats.byMode[mode]) {
            stats.byMode[mode] = { correct: 0, total: 0 };
        }
        
        stats.byMode[mode].total++;
        if (isCorrect) {
            stats.byMode[mode].correct++;
        }
        
        this.saveStats(stats);
    }
    
    /**
     * Обновление статистики по периодам
     * @param {string} period - Период
     * @param {boolean} isCorrect - Правильный ли ответ
     */
    static updatePeriodStats(period, isCorrect) {
        const stats = this.getStats();
        
        if (!stats.byPeriod[period]) {
            stats.byPeriod[period] = { correct: 0, total: 0 };
        }
        
        stats.byPeriod[period].total++;
        if (isCorrect) {
            stats.byPeriod[period].correct++;
        }
        
        this.saveStats(stats);
    }
    
    /**
     * Обновление статистики по сложности
     * @param {string} difficulty - Уровень сложности
     * @param {boolean} isCorrect - Правильный ли ответ
     */
    static updateDifficultyStats(difficulty, isCorrect) {
        const stats = this.getStats();
        
        if (!stats.byDifficulty[difficulty]) {
            stats.byDifficulty[difficulty] = { correct: 0, total: 0 };
        }
        
        stats.byDifficulty[difficulty].total++;
        if (isCorrect) {
            stats.byDifficulty[difficulty].correct++;
        }
        
        this.saveStats(stats);
    }
    
    /**
     * Добавление правильного ответа
     * @param {number} score - Набранные очки
     */
    static addCorrectAnswer(score = 10) {
        const stats = this.getStats();
        stats.total.correct++;
        stats.total.score += score;
        this.saveStats(stats);
    }
    
    /**
     * Добавление неправильного ответа
     */
    static addWrongAnswer() {
        const stats = this.getStats();
        stats.total.wrong++;
        this.saveStats(stats);
    }
    
    /**
     * Добавление пропущенного вопроса
     */
    static addSkipped() {
        const stats = this.getStats();
        stats.total.skipped++;
        this.saveStats(stats);
    }
    
    /**
     * Получение процента правильных ответов
     * @returns {number} - Процент
     */
    static getAccuracy() {
        const stats = this.getStats();
        const total = stats.total.correct + stats.total.wrong;
        return total > 0 ? Math.round((stats.total.correct / total) * 100) : 0;
    }
    
    /**
     * Получение сложных дат (с низкой точностью)
     * @param {number} limit - Количество дат
     * @returns {Array} - Массив сложных дат
     */
    static getDifficultDates(limit = 5) {
        const stats = this.getStats();
        
        return Object.entries(stats.difficultDates)
            .map(([id, data]) => ({
                id: parseInt(id),
                correct: data.correct,
                total: data.total,
                accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
            }))
            .filter(item => item.total >= 3) // Минимум 3 попытки
            .sort((a, b) => a.accuracy - b.accuracy)
            .slice(0, limit);
    }
    
    /**
     * Сброс всей статистики
     */
    static resetAll() {
        localStorage.removeItem(STORAGE_KEYS.STATS);
        localStorage.removeItem(STORAGE_KEYS.HISTORY);
        localStorage.removeItem(STORAGE_KEYS.ACHIEVEMENTS);
    }
    
    /**
     * Проверка доступности хранилища
     * @returns {boolean} - Доступно ли
     */
    static isAvailable() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Получение размера хранилища
     * @returns {string} - Размер в удобном формате
     */
    static getStorageSize() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length * 2; // Примерно 2 байта на символ
            }
        }
        
        if (total < 1024) return `${total} B`;
        if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`;
        return `${(total / (1024 * 1024)).toFixed(1)} MB`;
    }
}