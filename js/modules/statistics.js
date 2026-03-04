// ============================================
// МОДУЛЬ СТАТИСТИКИ
// ============================================

import { Storage } from '../core/storage.js';
import { escapeHtml, formatNumber } from '../core/utils.js';
import { DateUtils } from '../data/dates.js';

let progressChart = null;
let periodsChart = null;

/**
 * Инициализация статистики
 */
export function initStatistics(appData) {
    // Загружаем статистику при открытии раздела
    document.querySelector('[data-section="statistics"]').addEventListener('click', () => {
        setTimeout(() => {
            loadStatistics(appData);
        }, 100);
    });
    
    // Обработчик сброса прогресса
    document.getElementById('resetProgress').addEventListener('click', () => {
        if (confirm('Вы уверены, что хотите сбросить всю статистику?')) {
            Storage.resetAll();
            loadStatistics(appData);
        }
    });
    
    // Если раздел уже активен, загружаем сразу
    if (document.getElementById('statistics').classList.contains('active')) {
        setTimeout(() => {
            loadStatistics(appData);
        }, 100);
    }
}

/**
 * Загрузка статистики
 */
function loadStatistics(appData) {
    const stats = Storage.getStats();
    const history = Storage.getHistory();
    const achievements = Storage.getAchievements();
    
    // Обновляем карточки
    updateStatCards(stats);
    
    // Строим графики
    createProgressChart(history);
    createPeriodsChart(stats, appData);
    createHeatmap(stats, appData);
    
    // Загружаем сложные даты
    loadDifficultDates(appData);
    
    // Загружаем достижения
    loadAchievements(achievements);
}

/**
 * Обновление карточек статистики
 */
function updateStatCards(stats) {
    const total = stats.total.correct + stats.total.wrong;
    const accuracy = total > 0 ? Math.round((stats.total.correct / total) * 100) : 0;
    
    document.getElementById('statCorrect').textContent = formatNumber(stats.total.correct);
    document.getElementById('statWrong').textContent = formatNumber(stats.total.wrong);
    document.getElementById('statAccuracy').textContent = accuracy + '%';
    document.getElementById('statStreak').textContent = formatNumber(stats.total.streak || 0);
}

/**
 * Создание графика прогресса
 */
function createProgressChart(history) {
    const ctx = document.getElementById('progressChart');
    if (!ctx) return;
    
    // Уничтожаем предыдущий график
    if (progressChart) {
        progressChart.destroy();
    }
    
    // Получаем данные за последние 7 дней
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
    }).reverse();
    
    const dailyData = last7Days.map(day => {
        const dayStats = history.daily?.find(d => d.date === day);
        return dayStats?.correct || 0;
    });
    
    const labels = last7Days.map(day => {
        const d = new Date(day);
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    });
    
    progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Правильных ответов',
                data: dailyData,
                borderColor: '#c69c6d',
                backgroundColor: 'rgba(198, 156, 109, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

/**
 * Создание графика по периодам
 */
function createPeriodsChart(stats, appData) {
    const ctx = document.getElementById('periodsChart');
    if (!ctx) return;
    
    // Уничтожаем предыдущий график
    if (periodsChart) {
        periodsChart.destroy();
    }
    
    // Получаем данные по периодам
    const periods = DateUtils.getUniquePeriods(appData.dates);
    const data = periods.map(period => {
        const periodStats = stats.byPeriod[period] || { correct: 0, total: 0 };
        const accuracy = periodStats.total > 0 
            ? Math.round((periodStats.correct / periodStats.total) * 100) 
            : 0;
        return accuracy;
    });
    
    periodsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: periods.map(p => p.split(' ')[0]), // Короткие названия
            datasets: [{
                label: 'Точность (%)',
                data,
                backgroundColor: 'rgba(198, 156, 109, 0.7)',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: value => value + '%'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

/**
 * Создание тепловой карты по векам
 */
function createHeatmap(stats, appData) {
    const container = document.getElementById('heatmapContainer');
    if (!container) return;
    
    // Группируем даты по векам
    const centuries = {};
    
    appData.dates.forEach(date => {
        const yearNum = DateUtils.yearToNumber(date.year);
        let century;
        
        if (yearNum < 0) {
            // До н.э.
            century = Math.floor(Math.abs(yearNum) / 100) + 1;
            century = `${century} в. до н.э.`;
        } else {
            // н.э.
            century = Math.floor(yearNum / 100) + 1;
            century = `${century} в.`;
        }
        
        if (!centuries[century]) {
            centuries[century] = { total: 0, correct: 0, dates: [] };
        }
        centuries[century].total++;
        centuries[century].dates.push(date.id);
    });
    
    // Добавляем статистику
    Object.keys(centuries).forEach(century => {
        let correct = 0;
        let total = 0;
        
        centuries[century].dates.forEach(dateId => {
            const dateStats = stats.difficultDates[dateId];
            if (dateStats) {
                correct += dateStats.correct;
                total += dateStats.total;
            }
        });
        
        centuries[century].accuracy = total > 0 ? (correct / total) * 100 : 0;
    });
    
    // Сортируем века
    const sortedCenturies = Object.keys(centuries).sort((a, b) => {
        const aNum = a.includes('до') ? -parseInt(a) : parseInt(a);
        const bNum = b.includes('до') ? -parseInt(b) : parseInt(b);
        return aNum - bNum;
    });
    
    // Строим тепловую карту
    container.innerHTML = sortedCenturies.map(century => {
        const accuracy = centuries[century].accuracy;
        const level = Math.floor(accuracy / 20); // 0-5
        
        return `
            <div class="heatmap-row">
                <div class="heatmap-century">${escapeHtml(century)}</div>
                <div class="heatmap-cells">
                    <div class="heatmap-cell level-${level}" 
                         title="${century}: ${Math.round(accuracy)}% точности">
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Загрузка сложных дат
 */
function loadDifficultDates(appData) {
    const container = document.getElementById('difficultDates');
    if (!container) return;
    
    const difficultDates = Storage.getDifficultDates(10);
    
    if (difficultDates.length === 0) {
        container.innerHTML = '<p class="no-data">Нет данных. Начните тренировки!</p>';
        return;
    }
    
    container.innerHTML = difficultDates.map(item => {
        const date = appData.dates.find(d => d.id === item.id);
        if (!date) return '';
        
        const mistakeRate = 100 - item.accuracy;
        
        return `
            <div class="difficult-item">
                <div class="date-info">
                    <div class="date-name">${escapeHtml(date.event)} (${escapeHtml(date.year)})</div>
                    <div class="mistake-rate">Ошибок: ${item.total - item.correct}/${item.total}</div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${mistakeRate}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Загрузка достижений
 */
function loadAchievements(achievements) {
    const container = document.getElementById('achievementsGrid');
    if (!container) return;
    
    const ACHIEVEMENTS = [
        { id: 'first10', name: 'Первые шаги', description: '10 правильных ответов', icon: 'fa-star' },
        { id: 'first50', name: 'Знаток истории', description: '50 правильных ответов', icon: 'fa-crown' },
        { id: 'first100', name: 'Исторический гений', description: '100 правильных ответов', icon: 'fa-brain' },
        { id: 'chronology_master', name: 'Хрономастер', description: '20 событий в хронологии', icon: 'fa-sort-amount-down' },
        { id: 'math_master', name: 'Математик', description: '15 вычислений разниц', icon: 'fa-calculator' },
        { id: 'speed_demon', name: 'Спринтер', description: '10 быстрых ответов', icon: 'fa-stopwatch' },
        { id: 'perfect_accuracy', name: 'Идеальная точность', description: '90% точности', icon: 'fa-bullseye' },
        { id: 'streak_10', name: 'Серия 10', description: '10 подряд правильных', icon: 'fa-fire' }
    ];
    
    container.innerHTML = ACHIEVEMENTS.map(ach => {
        const isUnlocked = achievements[ach.id];
        
        return `
            <div class="achievement-card ${isUnlocked ? '' : 'locked'}">
                <div class="achievement-icon">
                    <i class="fas ${ach.icon}"></i>
                </div>
                <h4>${escapeHtml(ach.name)}</h4>
                <p>${escapeHtml(ach.description)}</p>
                <div class="achievement-badge ${isUnlocked ? '' : 'locked'}">
                    ${isUnlocked ? 'Получено' : 'Заблокировано'}
                </div>
            </div>
        `;
    }).join('');
}