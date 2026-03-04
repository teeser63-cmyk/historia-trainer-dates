// ============================================
// ГЛАВНЫЙ МОДУЛЬ ПРИЛОЖЕНИЯ
// ============================================

import { dates, DateUtils, filtersConfig } from '../data/dates.js';
import { Storage } from './storage.js';
import { showLoading, showError, debounce, setUrlParams, getUrlParams } from './utils.js';
import { initTimeline } from '../modules/timeline.js';
import { initTrainer } from '../modules/trainer.js';
import { initStatistics } from '../modules/statistics.js';

// Глобальные данные
window.appData = {
    dates,
    filters: {
        periods: DateUtils.getUniquePeriods(dates),
        regions: DateUtils.getUniqueRegions(dates),
        categories: DateUtils.getUniqueCategories(dates),
        eras: filtersConfig.eras,
        difficulties: filtersConfig.difficulties
    }
};

// Текущие фильтры
let currentFilters = {
    search: '',
    periods: [],
    regions: [],
    categories: [],
    era: 'all',
    difficulty: 'all'
};

/**
 * Инициализация приложения
 */
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    showLoading(true);
    
    try {
        // Загружаем настройки
        const settings = Storage.getSettings();
        
        // Инициализация темы
        initializeTheme(settings.theme);
        
        // Инициализация навигации
        initializeNavigation();
        
        // Загрузка фильтров из URL
        loadFiltersFromUrl();
        
        // Инициализация модулей
        initTimeline(window.appData, currentFilters);
        initTrainer(window.appData, currentFilters);
        initStatistics(window.appData);
        
        // Сохраняем настройки при закрытии
        window.addEventListener('beforeunload', () => {
            Storage.saveSettings(settings);
        });
        
        showLoading(false);
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showError('Ошибка загрузки приложения');
        showLoading(false);
    }
}

/**
 * Инициализация темы
 */
function initializeTheme(savedTheme) {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('i');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeIcon.className = 'fas fa-sun';
    }
    
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        
        const isDark = document.body.classList.contains('dark-theme');
        themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        
        // Сохраняем настройку
        const settings = Storage.getSettings();
        settings.theme = isDark ? 'dark' : 'light';
        Storage.saveSettings(settings);
    });
}

/**
 * Инициализация навигации
 */
function initializeNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.section');
    
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const sectionId = button.dataset.section;
            
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === sectionId) {
                    section.classList.add('active');
                    
                    // Обновляем URL
                    setUrlParams({ section: sectionId });
                }
            });
        });
    });
    
    // Проверяем URL при загрузке
    const params = getUrlParams();
    if (params.section) {
        const targetBtn = document.querySelector(`[data-section="${params.section}"]`);
        if (targetBtn) {
            targetBtn.click();
        }
    }
}

/**
 * Загрузка фильтров из URL
 */
function loadFiltersFromUrl() {
    const params = getUrlParams();
    
    if (params.search) currentFilters.search = params.search;
    if (params.periods) currentFilters.periods = Array.isArray(params.periods) ? params.periods : [params.periods];
    if (params.regions) currentFilters.regions = Array.isArray(params.regions) ? params.regions : [params.regions];
    if (params.categories) currentFilters.categories = Array.isArray(params.categories) ? params.categories : [params.categories];
    if (params.era) currentFilters.era = params.era;
    if (params.difficulty) currentFilters.difficulty = params.difficulty;
}

/**
 * Обновление фильтров и URL
 */
export function updateFilters(newFilters) {
    currentFilters = { ...currentFilters, ...newFilters };
    
    // Обновляем URL
    setUrlParams({
        search: currentFilters.search || null,
        periods: currentFilters.periods.length ? currentFilters.periods : null,
        regions: currentFilters.regions.length ? currentFilters.regions : null,
        categories: currentFilters.categories.length ? currentFilters.categories : null,
        era: currentFilters.era !== 'all' ? currentFilters.era : null,
        difficulty: currentFilters.difficulty !== 'all' ? currentFilters.difficulty : null
    });
}

// Экспорт для использования в модулях
export { currentFilters };
