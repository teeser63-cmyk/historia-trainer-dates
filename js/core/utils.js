// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Экранирование HTML для безопасности
 * @param {string} text - Текст для экранирования
 * @returns {string} - Экранированный текст
 */
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Показ индикатора загрузки
 * @param {boolean} show - Показать/скрыть
 */
export function showLoading(show) {
    let loader = document.getElementById('loadingIndicator');
    
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'loadingIndicator';
        loader.className = 'loading-indicator';
        loader.innerHTML = `
            <div class="loading-spinner glass">
                <i class="fas fa-scroll fa-spin"></i>
                <p>Загрузка...</p>
            </div>
        `;
        document.body.appendChild(loader);
    }
    
    loader.style.display = show ? 'flex' : 'none';
}

/**
 * Показ уведомления об ошибке
 * @param {string} message - Текст ошибки
 * @param {number} timeout - Время показа в мс
 */
export function showError(message, timeout = 5000) {
    const notification = document.createElement('div');
    notification.className = 'error-notification glass';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-exclamation-triangle"></i>
            <span>${escapeHtml(message)}</span>
            <button class="close-notification">&times;</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Закрытие по кнопке
    notification.querySelector('.close-notification').addEventListener('click', () => {
        notification.remove();
    });
    
    // Автоматическое закрытие
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, timeout);
}

/**
 * Показ уведомления об успехе
 * @param {string} message - Текст уведомления
 * @param {number} timeout - Время показа в мс
 */
export function showSuccess(message, timeout = 3000) {
    const notification = document.createElement('div');
    notification.className = 'error-notification glass';
    notification.style.backgroundColor = 'rgba(46, 204, 113, 0.9)';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-check-circle"></i>
            <span>${escapeHtml(message)}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, timeout);
}

/**
 * Форматирование даты для отображения
 * @param {string} dateString - Строка с датой
 * @returns {string} - Отформатированная дата
 */
export function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'short',
            year: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}

/**
 * Дебаунс для поиска
 * @param {Function} func - Функция
 * @param {number} wait - Время ожидания в мс
 * @returns {Function} - Функция с дебаунсом
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Генерация уникального ID
 * @returns {string} - Уникальный ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Копирование текста в буфер обмена
 * @param {string} text - Текст для копирования
 */
export function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showSuccess('Скопировано в буфер обмена');
    }).catch(() => {
        showError('Не удалось скопировать');
    });
}

/**
 * Получение параметров из URL
 * @returns {Object} - Объект с параметрами
 */
export function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    
    for (const [key, value] of params) {
        if (value.includes(',')) {
            result[key] = value.split(',');
        } else {
            result[key] = value;
        }
    }
    
    return result;
}

/**
 * Установка параметров URL
 * @param {Object} params - Объект с параметрами
 */
export function setUrlParams(params) {
    const url = new URL(window.location);
    
    Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            url.searchParams.set(key, value.join(','));
        } else if (value !== null && value !== undefined && value !== '') {
            url.searchParams.set(key, value);
        } else {
            url.searchParams.delete(key);
        }
    });
    
    window.history.pushState({}, '', url);
}

/**
 * Показ уведомления о достижении
 * @param {Object} achievement - Достижение
 */
export function showAchievementNotification(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification glass';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-trophy"></i>
            <div>
                <h4>Новое достижение!</h4>
                <p>${escapeHtml(achievement.name)}</p>
                <small>${escapeHtml(achievement.description)}</small>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.5s ease';
        setTimeout(() => notification.remove(), 500);
    }, 5000);
}

/**
 * Форматирование числа с разделителями
 * @param {number} num - Число
 * @returns {string} - Отформатированное число
 */
export function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Перемешивание массива (алгоритм Фишера-Йетса)
 * @param {Array} array - Исходный массив
 * @returns {Array} - Перемешанный массив
 */
export function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Группировка массива по ключу
 * @param {Array} array - Массив
 * @param {Function} keyFn - Функция получения ключа
 * @returns {Object} - Сгруппированный объект
 */
export function groupBy(array, keyFn) {
    return array.reduce((result, item) => {
        const key = keyFn(item);
        if (!result[key]) {
            result[key] = [];
        }
        result[key].push(item);
        return result;
    }, {});
}

/**
 * Сохранение данных в localStorage с проверкой
 * @param {string} key - Ключ
 * @param {any} data - Данные
 * @returns {boolean} - Успешно ли сохранено
 */
export function safeLocalStorageSet(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error('Ошибка сохранения в localStorage:', e);
        return false;
    }
}

/**
 * Загрузка данных из localStorage с проверкой
 * @param {string} key - Ключ
 * @param {any} defaultValue - Значение по умолчанию
 * @returns {any} - Загруженные данные
 */
export function safeLocalStorageGet(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.error('Ошибка загрузки из localStorage:', e);
        return defaultValue;
    }
}