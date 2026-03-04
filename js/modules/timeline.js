// ============================================
// МОДУЛЬ ЛЕНТЫ ВРЕМЕНИ
// ============================================

import { DateUtils } from '../data/dates.js';
import { escapeHtml, debounce, showLoading } from '../core/utils.js';
import { updateFilters, currentFilters } from '../core/app.js';

let currentView = 'cards';
let currentPage = 1;
let itemsPerPage = 20;
let filteredDates = [];
let autocompleteIndex = [];

/**
 * Инициализация ленты времени
 */
export function initTimeline(appData, initialFilters) {
    const container = document.getElementById('timelineContainer');
    if (!container) return;
    
    // Заполняем фильтры
    populateFilters(appData.filters);
    
    // Применяем начальные фильтры
    applyFiltersFromState(initialFilters);
    
    // Инициализируем поиск
    initSearch(appData.dates);
    
    // Инициализируем обработчики
    initEventListeners(appData.dates);
    
    // Загружаем данные
    loadTimeline(appData.dates);
}

/**
 * Заполнение фильтров
 */
function populateFilters(filters) {
    // Периоды
    const periodsContainer = document.getElementById('periodsFilter');
    if (periodsContainer) {
        periodsContainer.innerHTML = filters.periods.map(period => `
            <label class="checkbox-label">
                <input type="checkbox" value="${escapeHtml(period)}"> ${escapeHtml(period)}
            </label>
        `).join('');
    }
    
    // Регионы
    const regionsContainer = document.getElementById('regionsFilter');
    if (regionsContainer) {
        regionsContainer.innerHTML = filters.regions.map(region => `
            <label class="checkbox-label">
                <input type="checkbox" value="${escapeHtml(region)}"> ${escapeHtml(region)}
            </label>
        `).join('');
    }
    
    // Категории
    const categoriesContainer = document.getElementById('categoriesFilter');
    if (categoriesContainer) {
        categoriesContainer.innerHTML = filters.categories.map(category => `
            <label class="checkbox-label">
                <input type="checkbox" value="${escapeHtml(category)}"> ${escapeHtml(category)}
            </label>
        `).join('');
    }
}

/**
 * Инициализация поиска с автодополнением
 */
function initSearch(dates) {
    const searchInput = document.getElementById('searchInput');
    const autocompleteList = document.getElementById('searchAutocomplete');
    
    if (!searchInput || !autocompleteList) return;
    
    // Строим индекс для автодополнения
    autocompleteIndex = dates.map(d => ({
        id: d.id,
        text: `${d.event} (${d.year})`,
        event: d.event,
        year: d.year
    }));
    
    const debouncedSearch = debounce((query) => {
        if (query.length < 2) {
            autocompleteList.classList.remove('show');
            return;
        }
        
        const results = autocompleteIndex
            .filter(item => item.text.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 10);
        
        if (results.length > 0) {
            autocompleteList.innerHTML = results.map(item => `
                <div class="autocomplete-item" data-id="${item.id}">
                    <strong>${escapeHtml(item.event)}</strong>
                    <small>${escapeHtml(item.year)}</small>
                </div>
            `).join('');
            autocompleteList.classList.add('show');
        } else {
            autocompleteList.classList.remove('show');
        }
    }, 300);
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        updateFilters({ search: query });
        debouncedSearch(query);
        loadTimeline(dates);
    });
    
    // Обработка клика по автодополнению
    autocompleteList.addEventListener('click', (e) => {
        const item = e.target.closest('.autocomplete-item');
        if (item) {
            const id = parseInt(item.dataset.id);
            const date = dates.find(d => d.id === id);
            if (date) {
                showDateDetails(date);
                autocompleteList.classList.remove('show');
                searchInput.value = '';
                updateFilters({ search: '' });
            }
        }
    });
    
    // Закрытие автодополнения при клике вне
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !autocompleteList.contains(e.target)) {
            autocompleteList.classList.remove('show');
        }
    });
}

/**
 * Инициализация обработчиков событий
 */
function initEventListeners(dates) {
    // Переключение вида
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            renderTimeline(filteredDates);
        });
    });
    
    // Обработка чекбоксов
    document.querySelectorAll('.checkbox-group input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateFiltersFromCheckboxes();
            loadTimeline(dates);
        });
    });
    
    // Обработка радио
    document.querySelectorAll('input[name="era"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateFilters({ era: e.target.value });
            loadTimeline(dates);
        });
    });
    
    document.querySelectorAll('input[name="difficulty"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateFilters({ difficulty: e.target.value });
            loadTimeline(dates);
        });
    });
    
    // Сброс всех фильтров
    document.getElementById('resetAllFilters')?.addEventListener('click', () => {
        resetAllFilters();
        loadTimeline(dates);
    });
    
    // Пагинация
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTimeline(filteredDates);
        }
    });
    
    document.getElementById('nextPage')?.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredDates.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTimeline(filteredDates);
        }
    });
}

/**
 * Обновление фильтров из чекбоксов
 */
function updateFiltersFromCheckboxes() {
    const periods = [];
    document.querySelectorAll('#periodsFilter input:checked').forEach(cb => {
        periods.push(cb.value);
    });
    
    const regions = [];
    document.querySelectorAll('#regionsFilter input:checked').forEach(cb => {
        regions.push(cb.value);
    });
    
    const categories = [];
    document.querySelectorAll('#categoriesFilter input:checked').forEach(cb => {
        categories.push(cb.value);
    });
    
    updateFilters({
        periods,
        regions,
        categories
    });
}

/**
 * Применение фильтров из состояния
 */
function applyFiltersFromState(filters) {
    // Устанавливаем чекбоксы
    if (filters.periods) {
        document.querySelectorAll('#periodsFilter input').forEach(cb => {
            cb.checked = filters.periods.includes(cb.value);
        });
    }
    
    if (filters.regions) {
        document.querySelectorAll('#regionsFilter input').forEach(cb => {
            cb.checked = filters.regions.includes(cb.value);
        });
    }
    
    if (filters.categories) {
        document.querySelectorAll('#categoriesFilter input').forEach(cb => {
            cb.checked = filters.categories.includes(cb.value);
        });
    }
    
    // Устанавливаем радио
    if (filters.era && filters.era !== 'all') {
        const eraRadio = document.querySelector(`input[name="era"][value="${filters.era}"]`);
        if (eraRadio) eraRadio.checked = true;
    }
    
    if (filters.difficulty && filters.difficulty !== 'all') {
        const diffRadio = document.querySelector(`input[name="difficulty"][value="${filters.difficulty}"]`);
        if (diffRadio) diffRadio.checked = true;
    }
    
    // Устанавливаем поиск
    if (filters.search) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = filters.search;
    }
}

/**
 * Сброс всех фильтров
 */
function resetAllFilters() {
    // Сбрасываем чекбоксы
    document.querySelectorAll('.checkbox-group input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    
    // Сбрасываем радио
    document.querySelectorAll('input[name="era"]').forEach(radio => {
        if (radio.value === 'all') radio.checked = true;
    });
    
    document.querySelectorAll('input[name="difficulty"]').forEach(radio => {
        if (radio.value === 'all') radio.checked = true;
    });
    
    // Сбрасываем поиск
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    // Обновляем состояние
    updateFilters({
        search: '',
        periods: [],
        regions: [],
        categories: [],
        era: 'all',
        difficulty: 'all'
    });
}

/**
 * Загрузка данных в ленту
 */
function loadTimeline(dates) {
    showLoading(true);
    
    setTimeout(() => {
        // Фильтруем даты
        filteredDates = DateUtils.filterDates(dates, currentFilters);
        
        // Сортируем по году
        filteredDates = DateUtils.sortByYear(filteredDates);
        
        // Обновляем счетчик результатов
        document.getElementById('resultsCount').textContent = `Найдено: ${filteredDates.length}`;
        
        // Отображаем активные фильтры
        displayActiveFilters();
        
        // Рендерим
        currentPage = 1;
        renderTimeline(filteredDates);
        
        showLoading(false);
    }, 100);
}

/**
 * Отображение активных фильтров
 */
function displayActiveFilters() {
    const container = document.getElementById('activeFilters');
    if (!container) return;
    
    const filters = [];
    
    if (currentFilters.periods.length) {
        filters.push(...currentFilters.periods.map(p => ({ type: 'period', value: p })));
    }
    
    if (currentFilters.regions.length) {
        filters.push(...currentFilters.regions.map(r => ({ type: 'region', value: r })));
    }
    
    if (currentFilters.categories.length) {
        filters.push(...currentFilters.categories.map(c => ({ type: 'category', value: c })));
    }
    
    if (currentFilters.era && currentFilters.era !== 'all') {
        filters.push({ type: 'era', value: currentFilters.era });
    }
    
    if (currentFilters.difficulty && currentFilters.difficulty !== 'all') {
        filters.push({ type: 'difficulty', value: currentFilters.difficulty });
    }
    
    if (currentFilters.search) {
        filters.push({ type: 'search', value: `"${currentFilters.search}"` });
    }
    
    if (filters.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = filters.map(filter => `
        <div class="filter-tag">
            <span>${escapeHtml(filter.value)}</span>
            <button onclick="removeFilter('${filter.type}', '${filter.value}')">&times;</button>
        </div>
    `).join('');
}

/**
 * Удаление фильтра
 */
window.removeFilter = function(type, value) {
    if (type === 'period') {
        const newPeriods = currentFilters.periods.filter(p => p !== value);
        updateFilters({ periods: newPeriods });
        document.querySelectorAll('#periodsFilter input').forEach(cb => {
            if (cb.value === value) cb.checked = false;
        });
    } else if (type === 'region') {
        const newRegions = currentFilters.regions.filter(r => r !== value);
        updateFilters({ regions: newRegions });
        document.querySelectorAll('#regionsFilter input').forEach(cb => {
            if (cb.value === value) cb.checked = false;
        });
    } else if (type === 'category') {
        const newCategories = currentFilters.categories.filter(c => c !== value);
        updateFilters({ categories: newCategories });
        document.querySelectorAll('#categoriesFilter input').forEach(cb => {
            if (cb.value === value) cb.checked = false;
        });
    } else if (type === 'era') {
        updateFilters({ era: 'all' });
        document.querySelector('input[name="era"][value="all"]').checked = true;
    } else if (type === 'difficulty') {
        updateFilters({ difficulty: 'all' });
        document.querySelector('input[name="difficulty"][value="all"]').checked = true;
    } else if (type === 'search') {
        updateFilters({ search: '' });
        document.getElementById('searchInput').value = '';
    }
    
    loadTimeline(window.appData.dates);
};

/**
 * Рендеринг ленты времени
 */
function renderTimeline(dates) {
    const container = document.getElementById('timelineContainer');
    if (!container) return;
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageDates = dates.slice(start, end);
    
    if (pageDates.length === 0) {
        container.innerHTML = `
            <div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 60px;">
                <i class="fas fa-search" style="font-size: 3rem; color: var(--accent-primary); margin-bottom: 20px;"></i>
                <h3>Ничего не найдено</h3>
                <p>Попробуйте изменить параметры фильтрации</p>
            </div>
        `;
        updatePagination(dates.length);
        return;
    }
    
    container.className = `timeline-container ${currentView}-view`;
    
    if (currentView === 'cards') {
        container.innerHTML = pageDates.map(date => renderCard(date)).join('');
    } else if (currentView === 'list') {
        container.innerHTML = pageDates.map(date => renderListItem(date)).join('');
    } else if (currentView === 'compact') {
        container.innerHTML = pageDates.map(date => renderCompactItem(date)).join('');
    }
    
    // Добавляем обработчики клика
    container.querySelectorAll('.date-card, .list-item, .compact-item').forEach(el => {
        const id = parseInt(el.dataset.id);
        const date = window.appData.dates.find(d => d.id === id);
        if (date) {
            el.addEventListener('click', () => showDateDetails(date));
        }
    });
    
    updatePagination(dates.length);
}

/**
 * Рендеринг карточки
 */
function renderCard(date) {
    return `
        <div class="date-card" data-id="${date.id}">
            <div class="era-badge">${escapeHtml(date.era)}</div>
            <div class="year">${escapeHtml(date.year)}</div>
            <div class="event">${escapeHtml(date.event)}</div>
            <div class="description">${escapeHtml(date.description)}</div>
            <div class="tags">
                ${(date.category || []).slice(0, 3).map(c => `
                    <span class="tag">${escapeHtml(c)}</span>
                `).join('')}
                <span class="tag difficulty-${date.difficulty}">${escapeHtml(date.difficulty)}</span>
            </div>
        </div>
    `;
}

/**
 * Рендеринг элемента списка
 */
function renderListItem(date) {
    return `
        <div class="list-item" data-id="${date.id}">
            <div class="year">${escapeHtml(date.year)}</div>
            <div class="event">${escapeHtml(date.event)}</div>
            <div class="category-badge">${escapeHtml(date.category[0] || '')}</div>
            <span class="difficulty-dot ${date.difficulty}"></span>
        </div>
    `;
}

/**
 * Рендеринг компактного элемента
 */
function renderCompactItem(date) {
    return `
        <div class="compact-item" data-id="${date.id}">
            <span class="difficulty-dot ${date.difficulty}"></span>
            <span class="year">${escapeHtml(date.year)}</span>
            <span class="event">${escapeHtml(date.event)}</span>
        </div>
    `;
}

/**
 * Обновление пагинации
 */
function updatePagination(total) {
    const totalPages = Math.ceil(total / itemsPerPage);
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    
    if (totalPages <= 1) {
        document.getElementById('pagination').style.display = 'none';
        return;
    }
    
    document.getElementById('pagination').style.display = 'flex';
    
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    pageInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
}

/**
 * Показ деталей даты в модальном окне
 */
function showDateDetails(date) {
    const modal = document.getElementById('detailModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = `${date.year} - ${date.event}`;
    
    modalBody.innerHTML = `
        <div class="modal-info">
            <p><strong>Год:</strong> ${escapeHtml(date.year)}</p>
            <p><strong>Событие:</strong> ${escapeHtml(date.event)}</p>
            <p><strong>Описание:</strong> ${escapeHtml(date.description)}</p>
            <p><strong>Полное описание:</strong> ${escapeHtml(date.fullDescription)}</p>
            <p><strong>Период:</strong> ${escapeHtml(date.period)}</p>
            <p><strong>Категории:</strong> ${(date.category || []).map(c => escapeHtml(c)).join(', ')}</p>
            <p><strong>Регионы:</strong> ${(date.region || []).map(r => escapeHtml(r)).join(', ')}</p>
            <p><strong>Сложность:</strong> <span class="difficulty-${date.difficulty}">${escapeHtml(date.difficulty)}</span></p>
            <p><strong>Теги:</strong> ${(date.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')}</p>
        </div>
    `;
    
    modal.classList.add('show');
}

// Закрытие модального окна
document.querySelector('.close-modal')?.addEventListener('click', () => {
    document.getElementById('detailModal').classList.remove('show');
});