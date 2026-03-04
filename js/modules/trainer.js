// ============================================
// МОДУЛЬ ТРЕНИРОВОК
// ============================================

import { DateUtils } from '../data/dates.js';
import { Storage } from '../core/storage.js';
import { escapeHtml, shuffleArray, showLoading, showSuccess, showAchievementNotification } from '../core/utils.js';

let currentMode = 'chronology';
let currentQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];
let timerInterval = null;

// Определение всех достижений
const ACHIEVEMENTS = [
    { id: 'first10', name: 'Первые шаги', description: 'Дать 10 правильных ответов', icon: 'fa-star', condition: (stats) => stats.total.correct >= 10 },
    { id: 'first50', name: 'Знаток истории', description: 'Дать 50 правильных ответов', icon: 'fa-crown', condition: (stats) => stats.total.correct >= 50 },
    { id: 'first100', name: 'Исторический гений', description: 'Дать 100 правильных ответов', icon: 'fa-brain', condition: (stats) => stats.total.correct >= 100 },
    { id: 'chronology_master', name: 'Хрономастер', description: 'Правильно расставить 20 событий', icon: 'fa-sort-amount-down', condition: (stats) => stats.byMode?.chronology?.correct >= 20 },
    { id: 'math_master', name: 'Математик', description: 'Правильно вычислить 15 разниц', icon: 'fa-calculator', condition: (stats) => stats.byMode?.timeMath?.correct >= 15 },
    { id: 'speed_demon', name: 'Спринтер', description: 'Правильно ответить на 10 вопросов в режиме "Секундомер"', icon: 'fa-stopwatch', condition: (stats) => stats.byMode?.speedRun?.correct >= 10 },
    { id: 'perfect_accuracy', name: 'Идеальная точность', description: 'Достичь точности 90%', icon: 'fa-bullseye', condition: (stats) => {
        const total = stats.total.correct + stats.total.wrong;
        return total >= 30 && (stats.total.correct / total) >= 0.9;
    }},
    { id: 'streak_10', name: 'Серия 10', description: 'Правильно ответить 10 раз подряд', icon: 'fa-fire', condition: (stats) => stats.total.streak >= 10 }
];

/**
 * Инициализация модуля тренировок
 */
export function initTrainer(appData) {
    const modeCards = document.querySelectorAll('.mode-card');
    
    modeCards.forEach(card => {
        card.addEventListener('click', () => {
            modeCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentMode = card.dataset.mode;
            
            // Обновляем информацию о тренировке
            updateTrainingInfo(appData.dates);
        });
    });
    
    // Инициализируем настройки
    initSettings(appData.dates);
    
    // Кнопка старта
    document.getElementById('startTraining').addEventListener('click', () => {
        startTraining(appData.dates);
    });
}

/**
 * Инициализация настроек
 */
function initSettings(dates) {
    // Обновляем информацию о доступных вопросах
    updateTrainingInfo(dates);
    
    // Обработчики изменения настроек
    document.getElementById('questionsCount').addEventListener('change', () => {
        updateTrainingInfo(dates);
    });
    
    document.getElementById('samplingMethod').addEventListener('change', () => {
        updateTrainingInfo(dates);
    });
}

/**
 * Обновление информации о тренировке
 */
function updateTrainingInfo(dates) {
    const container = document.getElementById('trainingFiltersSummary');
    if (!container) return;
    
    const questionsCount = parseInt(document.getElementById('questionsCount')?.value || '10');
    const samplingMethod = document.getElementById('samplingMethod')?.value || 'random';
    
    // Получаем активные фильтры из глобального состояния с проверкой
    const filters = window.currentFilters || {
        search: '',
        periods: [],
        regions: [],
        categories: [],
        era: 'all',
        difficulty: 'all'
    };
    
    // Подсчитываем доступные даты
    const availableDates = DateUtils.filterDates(dates, filters);
    
    container.innerHTML = `
        <p><strong>Доступно дат:</strong> ${availableDates.length}</p>
        <p><strong>Режим:</strong> ${getModeName(currentMode)}</p>
        <p><strong>Выборка:</strong> ${getSamplingMethodName(samplingMethod)}</p>
        <p><strong>Вопросов:</strong> ${Math.min(questionsCount, availableDates.length)}</p>
    `;
}

/**
 * Получение названия режима
 */
function getModeName(mode) {
    const names = {
        chronology: 'Хронологический порядок',
        'dual-test': 'Тест на соответствие',
        'time-math': 'Историческая математика',
        neighbors: 'Соседи во времени',
        'speed-run': 'Секундомер истории'
    };
    return names[mode] || mode;
}

/**
 * Получение названия метода выборки
 */
function getSamplingMethodName(method) {
    const names = {
        random: 'Полностью случайно',
        balanced: 'Сбалансированно по периодам',
        weak: 'Только сложные даты'
    };
    return names[method] || method;
}

/**
 * Начало тренировки
 */
function startTraining(dates) {
    showLoading(true);
    
    setTimeout(() => {
        // Скрываем настройки, показываем упражнение
        document.querySelector('.training-setup').style.display = 'none';
        const exerciseContainer = document.getElementById('trainingExercise');
        exerciseContainer.style.display = 'block';
        
        // Генерируем вопросы
        generateQuestions(dates);
        
        // Показываем первый вопрос
        displayCurrentQuestion();
        
        showLoading(false);
    }, 100);
}

/**
 * Генерация вопросов
 */
function generateQuestions(dates) {
    const questionsCount = parseInt(document.getElementById('questionsCount').value);
    const samplingMethod = document.getElementById('samplingMethod').value;
    const filters = window.currentFilters;
    
    // Получаем отфильтрованные даты
    let pool = DateUtils.filterDates(dates, filters);
    
    // В зависимости от метода выборки
    if (samplingMethod === 'balanced') {
        // Сбалансированно по периодам
        const byPeriod = {};
        pool.forEach(d => {
            if (!byPeriod[d.period]) byPeriod[d.period] = [];
            byPeriod[d.period].push(d);
        });
        
        const periods = Object.keys(byPeriod);
        const perPeriod = Math.ceil(questionsCount / periods.length);
        
        currentQuestions = [];
        periods.forEach(period => {
            const periodDates = shuffleArray(byPeriod[period]);
            currentQuestions.push(...periodDates.slice(0, perPeriod));
        });
        
        currentQuestions = shuffleArray(currentQuestions).slice(0, questionsCount);
        
    } else if (samplingMethod === 'weak') {
        // Только сложные даты (с низкой точностью)
        const difficultIds = Storage.getDifficultDates(questionsCount * 2).map(d => d.id);
        const difficultDates = pool.filter(d => difficultIds.includes(d.id));
        
        if (difficultDates.length >= questionsCount) {
            currentQuestions = shuffleArray(difficultDates).slice(0, questionsCount);
        } else {
            // Добираем случайными
            const randomDates = shuffleArray(pool.filter(d => !difficultIds.includes(d.id)));
            currentQuestions = [
                ...difficultDates,
                ...randomDates.slice(0, questionsCount - difficultDates.length)
            ];
        }
        
    } else {
        // Полностью случайно
        currentQuestions = DateUtils.getRandomDates(pool, questionsCount);
    }
    
    // Инициализируем переменные
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
}

/**
 * Отображение текущего вопроса
 */
function displayCurrentQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    const container = document.getElementById('trainingExercise');
    
    let html = `
        <div class="exercise-header">
            <div class="question-counter">Вопрос ${currentQuestionIndex + 1} из ${currentQuestions.length}</div>
            <div class="score-display">Очки: ${score}</div>
        </div>
    `;
    
    // Добавляем таймер для режима "Секундомер"
    if (currentMode === 'speed-run') {
        html += `
            <div class="timer-display" id="timerDisplay">
                <i class="fas fa-stopwatch"></i>
                <span id="timerValue">5</span>с
            </div>
        `;
    }
    
    // Добавляем контент в зависимости от режима
    if (currentMode === 'chronology') {
        html += renderChronologyQuestion(question);
    } else if (currentMode === 'dual-test') {
        html += renderDualTestQuestion(question);
    } else if (currentMode === 'time-math') {
        html += renderTimeMathQuestion(question);
    } else if (currentMode === 'neighbors') {
        html += renderNeighborsQuestion(question);
    } else if (currentMode === 'speed-run') {
        html += renderSpeedRunQuestion(question);
    }
    
    // Добавляем кнопки управления
    html += `
        <div class="exercise-controls">
            <button class="btn-secondary" id="skipBtn">
                <i class="fas fa-forward"></i> Пропустить
            </button>
            <button class="btn-primary" id="nextBtn" style="display: none;">
                <i class="fas fa-arrow-right"></i> Далее
            </button>
        </div>
        
        <div class="feedback" id="feedback"></div>
    `;
    
    container.innerHTML = html;
    
    // Инициализируем логику для конкретного режима
    if (currentMode === 'chronology') {
        initChronologyMode(question);
    } else if (currentMode === 'dual-test') {
        initDualTestMode(question);
    } else if (currentMode === 'time-math') {
        initTimeMathMode(question);
    } else if (currentMode === 'neighbors') {
        initNeighborsMode(question);
    } else if (currentMode === 'speed-run') {
        initSpeedRunMode(question);
    }
    
    // Обработчик кнопки пропуска
    document.getElementById('skipBtn').addEventListener('click', () => {
        handleSkip();
    });
}

/**
 * Рендеринг вопроса хронологического порядка
 */
function renderChronologyQuestion(question) {
    // Берем 5 событий из того же периода
    const periodDates = window.appData.dates
        .filter(d => d.period === question.period)
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);
    
    // Перемешиваем
    const shuffled = shuffleArray(periodDates);
    
    return `
        <div class="question-text">Расставьте события в хронологическом порядке:</div>
        <div class="chronology-container" id="chronologyContainer">
            ${shuffled.map(d => `
                <div class="chronology-item" draggable="true" data-year="${d.year}" data-id="${d.id}">
                    <div class="drag-handle"><i class="fas fa-grip-vertical"></i></div>
                    <div class="chronology-content">${escapeHtml(d.event)}</div>
                </div>
            `).join('')}
        </div>
        <button class="btn-primary" id="checkChronology" style="margin-top: 20px;">
            <i class="fas fa-check"></i> Проверить порядок
        </button>
    `;
}

/**
 * Инициализация режима хронологии
 */
function initChronologyMode(question) {
    const container = document.getElementById('chronologyContainer');
    const items = container.querySelectorAll('.chronology-item');
    let draggedItem = null;
    
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.chronology-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    items.forEach(item => {
        item.addEventListener('dragstart', () => {
            draggedItem = item;
            setTimeout(() => item.classList.add('dragging'), 0);
        });
        
        item.addEventListener('dragend', () => {
            draggedItem = null;
            items.forEach(i => i.classList.remove('dragging'));
        });
        
        item.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(container, e.clientY);
            if (afterElement) {
                container.insertBefore(draggedItem, afterElement);
            } else {
                container.appendChild(draggedItem);
            }
        });
    });
    
    document.getElementById('checkChronology').addEventListener('click', () => {
        const sortedItems = Array.from(container.querySelectorAll('.chronology-item'));
        const sortedYears = sortedItems.map(item => DateUtils.yearToNumber(item.dataset.year));
        const correctYears = [...sortedYears].sort((a, b) => a - b);
        
        let isCorrect = true;
        
        sortedItems.forEach((item, index) => {
            const year = DateUtils.yearToNumber(item.dataset.year);
            if (year === correctYears[index]) {
                item.classList.add('correct');
                item.classList.remove('wrong');
            } else {
                item.classList.add('wrong');
                item.classList.remove('correct');
                isCorrect = false;
            }
        });
        
        if (isCorrect) {
            handleCorrect(15, {
                type: 'chronology',
                question: 'Хронологический порядок',
                correct: true
            });
        } else {
            const correctOrder = sortedItems
                .map(item => item.dataset.year)
                .sort((a, b) => DateUtils.yearToNumber(a) - DateUtils.yearToNumber(b))
                .join(' → ');
            
            showFeedback(false, `Неверный порядок. Правильный: ${correctOrder}`);
        }
    });
}

/**
 * Рендеринг вопроса теста на соответствие
 */
function renderDualTestQuestion(question) {
    // Случайно выбираем тип вопроса
    const questionType = Math.random() > 0.5 ? 'year-to-event' : 'event-to-year';
    
    if (questionType === 'year-to-event') {
        // Показан год - выбрать событие
        const otherEvents = window.appData.dates
            .filter(d => d.id !== question.id)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(d => d.event);
        
        const options = shuffleArray([question.event, ...otherEvents]);
        
        return `
            <div class="dual-test-container">
                <div class="question-type-badge">Какому событию соответствует год?</div>
                <div class="question-main">${escapeHtml(question.year)}</div>
                <div class="options-grid-dual">
                    ${options.map(opt => `
                        <div class="option-card" data-value="${escapeHtml(opt)}">${escapeHtml(opt)}</div>
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        // Показано событие - выбрать год
        const otherYears = window.appData.dates
            .filter(d => d.id !== question.id)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(d => d.year);
        
        const options = shuffleArray([question.year, ...otherYears]);
        
        return `
            <div class="dual-test-container">
                <div class="question-type-badge">Какой год соответствует событию?</div>
                <div class="question-main">${escapeHtml(question.event)}</div>
                <div class="options-grid-dual">
                    ${options.map(opt => `
                        <div class="option-card" data-value="${escapeHtml(opt)}">${escapeHtml(opt)}</div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

/**
 * Инициализация режима теста на соответствие
 */
function initDualTestMode(question) {
    const options = document.querySelectorAll('.option-card');
    let answered = false;
    
    options.forEach(opt => {
        opt.addEventListener('click', () => {
            if (answered) return;
            answered = true;
            
            const selectedValue = opt.dataset.value;
            const isCorrect = selectedValue === question.event || selectedValue === question.year;
            
            options.forEach(o => o.classList.add('disabled'));
            
            if (isCorrect) {
                opt.classList.add('correct');
                handleCorrect(10, {
                    type: 'dual-test',
                    question: `${question.year} - ${question.event}`,
                    correct: true,
                    details: question
                });
            } else {
                opt.classList.add('wrong');
                
                // Подсвечиваем правильный ответ
                options.forEach(o => {
                    if (o.dataset.value === question.event || o.dataset.value === question.year) {
                        o.classList.add('correct');
                    }
                });
                
                handleWrong({
                    type: 'dual-test',
                    question: `${question.year} - ${question.event}`,
                    correct: false,
                    userAnswer: selectedValue,
                    correctAnswer: question.event || question.year,
                    details: question
                });
            }
        });
    });
}

/**
 * Рендеринг вопроса исторической математики
 */
function renderTimeMathQuestion(question) {
    // Берем еще одно случайное событие
    const otherDate = window.appData.dates
        .filter(d => d.id !== question.id && d.period === question.period)
        .sort(() => Math.random() - 0.5)[0] || window.appData.dates.find(d => d.id !== question.id);
    
    const year1 = DateUtils.yearToNumber(question.year);
    const year2 = DateUtils.yearToNumber(otherDate.year);
    const diff = Math.abs(year1 - year2);
    
    // Генерируем варианты ответов
    const variations = [-2, -1, 1, 2];
    const wrongDiffs = variations.map(v => diff + v * 10).filter(v => v > 0);
    while (wrongDiffs.length < 3) {
        wrongDiffs.push(diff + Math.floor(Math.random() * 20) - 10);
    }
    
    const options = shuffleArray([diff, ...wrongDiffs.map(d => Math.max(1, d))]);
    
    return `
        <div class="time-math-container">
            <div class="math-events">
                <div class="math-event">
                    <div class="event-name" style="font-size: 1.2rem; font-weight: 500;">${escapeHtml(question.event)}</div>
                </div>
                <div class="math-operator">→</div>
                <div class="math-event">
                    <div class="event-name" style="font-size: 1.2rem; font-weight: 500;">${escapeHtml(otherDate.event)}</div>
                </div>
            </div>
            
            <div class="math-question" style="font-size: 1.3rem; margin: 30px 0;">Сколько лет прошло между этими событиями?</div>
            
            <div class="math-options">
                ${options.map(opt => `
                    <div class="math-option" data-value="${opt}" style="font-size: 1.2rem;">${opt} лет</div>
                `).join('')}
            </div>
        </div>
    `;
}


/**
 * Инициализация режима исторической математики
 */
function initTimeMathMode(question) {
    const options = document.querySelectorAll('.math-option');
    let answered = false;
    
    // Получаем второе событие (оно отображается на странице)
    const eventElements = document.querySelectorAll('.math-event');
    if (eventElements.length < 2) return;
    
    const year2Str = eventElements[1].querySelector('.event-year').textContent.trim();
    const year1 = DateUtils.yearToNumber(question.year);
    const year2 = DateUtils.yearToNumber(year2Str);
    const correctDiff = Math.abs(year1 - year2);
    
    options.forEach(opt => {
        opt.addEventListener('click', () => {
            if (answered) return;
            answered = true;
            
            const selectedDiff = parseInt(opt.dataset.value);
            const isCorrect = selectedDiff === correctDiff;
            
            options.forEach(o => o.classList.add('disabled'));
            
            if (isCorrect) {
                opt.classList.add('correct');
                handleCorrect(20, {
                    type: 'time-math',
                    question: `Разница между ${question.year} и ${year2Str}`,
                    correct: true,
                    details: { event1: question, event2: year2Str }
                });
            } else {
                opt.classList.add('wrong');
                
                // Подсвечиваем правильный ответ
                options.forEach(o => {
                    if (parseInt(o.dataset.value) === correctDiff) {
                        o.classList.add('correct');
                    }
                });
                
                handleWrong({
                    type: 'time-math',
                    question: `Разница между ${question.year} и ${year2Str}`,
                    correct: false,
                    userAnswer: selectedDiff,
                    correctAnswer: correctDiff,
                    details: { event1: question, event2: year2Str }
                });
            }
        });
    });
}

//**
 * Рендеринг вопроса "Соседи во времени"
 */
function renderNeighborsQuestion(question) {
    // Получаем год центрального события для логики
    const currentYear = DateUtils.yearToNumber(question.year);
    
    // Находим все даты из того же периода
    const periodDates = window.appData.dates.filter(d => d.period === question.period && d.id !== question.id);
    
    // Разделяем на те, что ДО и ПОСЛЕ (по году, но годы не показываем пользователю)
    const beforeDates = periodDates.filter(d => DateUtils.yearToNumber(d.year) < currentYear);
    const afterDates = periodDates.filter(d => DateUtils.yearToNumber(d.year) > currentYear);
    
    // Берем по 4 случайных для выбора
    const beforeOptions = shuffleArray(beforeDates).slice(0, 4);
    const afterOptions = shuffleArray(afterDates).slice(0, 4);
    
    return `
        <div class="neighbors-container">
            <div class="center-event" style="padding: 20px; background: rgba(198, 156, 109, 0.1); border-radius: 16px; margin-bottom: 30px;">
                <div class="event-name" style="font-size: 1.5rem; font-weight: 600; color: var(--accent-primary);">${escapeHtml(question.event)}</div>
            </div>
            
            <div class="neighbors-question" style="text-align: center; font-size: 1.2rem; margin-bottom: 30px;">
                Какие события произошли <strong style="color: var(--accent-secondary);">ДО</strong> и <strong style="color: var(--accent-secondary);">ПОСЛЕ</strong> этого?
            </div>
            
            <div class="neighbors-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div class="neighbor-column" style="background: rgba(198, 156, 109, 0.05); border-radius: 16px; padding: 20px;">
                    <h3 style="text-align: center; margin-bottom: 20px; color: var(--accent-secondary);">БЫЛО ДО</h3>
                    <div class="neighbor-options" id="beforeOptions" style="display: flex; flex-direction: column; gap: 10px;">
                        ${beforeOptions.map(d => `
                            <div class="neighbor-option" data-id="${d.id}" style="padding: 15px; background: var(--bg-light); border: 2px solid rgba(198, 156, 109, 0.2); border-radius: 12px; cursor: pointer; transition: all 0.3s; text-align: center; font-size: 1rem;">
                                ${escapeHtml(d.event)}
                            </div>
                        `).join('')}
                        ${beforeOptions.length === 0 ? '<p style="text-align: center; color: var(--text-light);">Нет событий до</p>' : ''}
                    </div>
                </div>
                
                <div class="neighbor-column" style="background: rgba(198, 156, 109, 0.05); border-radius: 16px; padding: 20px;">
                    <h3 style="text-align: center; margin-bottom: 20px; color: var(--accent-secondary);">БЫЛО ПОСЛЕ</h3>
                    <div class="neighbor-options" id="afterOptions" style="display: flex; flex-direction: column; gap: 10px;">
                        ${afterOptions.map(d => `
                            <div class="neighbor-option" data-id="${d.id}" style="padding: 15px; background: var(--bg-light); border: 2px solid rgba(198, 156, 109, 0.2); border-radius: 12px; cursor: pointer; transition: all 0.3s; text-align: center; font-size: 1rem;">
                                ${escapeHtml(d.event)}
                            </div>
                        `).join('')}
                        ${afterOptions.length === 0 ? '<p style="text-align: center; color: var(--text-light);">Нет событий после</p>' : ''}
                    </div>
                </div>
            </div>
            
            <button class="btn-primary" id="checkNeighbors" style="margin-top: 30px; width: 100%; padding: 15px;">
                <i class="fas fa-check"></i> Проверить
            </button>
        </div>
    `;
}

/**
 * Инициализация режима "Соседи во времени"
 */
function initNeighborsMode(question) {
    let selectedBefore = null;
    let selectedAfter = null;
    
    const beforeOptions = document.querySelectorAll('#beforeOptions .neighbor-option');
    const afterOptions = document.querySelectorAll('#afterOptions .neighbor-option');
    
    beforeOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            beforeOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedBefore = opt.dataset.id;
        });
    });
    
    afterOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            afterOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedAfter = opt.dataset.id;
        });
    });
    
    document.getElementById('checkNeighbors').addEventListener('click', () => {
        if (!selectedBefore || !selectedAfter) {
            showFeedback(false, 'Выберите оба события');
            return;
        }
        
        // Находим правильные ответы
        const periodDates = DateUtils.sortByYear(
            window.appData.dates.filter(d => d.period === question.period)
        );
        
        const currentIndex = periodDates.findIndex(d => d.id === question.id);
        const correctBefore = periodDates[currentIndex - 1]?.id;
        const correctAfter = periodDates[currentIndex + 1]?.id;
        
        const isBeforeCorrect = parseInt(selectedBefore) === correctBefore;
        const isAfterCorrect = parseInt(selectedAfter) === correctAfter;
        const isCorrect = isBeforeCorrect && isAfterCorrect;
        
        // Подсвечиваем ответы
        beforeOptions.forEach(o => {
            if (o.dataset.id == correctBefore) {
                o.classList.add('correct');
            } else if (o.dataset.id == selectedBefore) {
                o.classList.add('wrong');
            }
        });
        
        afterOptions.forEach(o => {
            if (o.dataset.id == correctAfter) {
                o.classList.add('correct');
            } else if (o.dataset.id == selectedAfter) {
                o.classList.add('wrong');
            }
        });
        
        if (isCorrect) {
            handleCorrect(25, {
                type: 'neighbors',
                question: `Соседи для ${question.event}`,
                correct: true,
                details: question
            });
        } else {
            const correctBeforeEvent = periodDates.find(d => d.id === correctBefore);
            const correctAfterEvent = periodDates.find(d => d.id === correctAfter);
            
            let message = 'Неверно. ';
            if (!isBeforeCorrect) {
                message += `До: ${correctBeforeEvent?.year} - ${correctBeforeEvent?.event}. `;
            }
            if (!isAfterCorrect) {
                message += `После: ${correctAfterEvent?.year} - ${correctAfterEvent?.event}`;
            }
            
            handleWrong({
                type: 'neighbors',
                question: `Соседи для ${question.event}`,
                correct: false,
                details: question,
                feedback: message
            });
        }
    });
}

/**
 * Рендеринг вопроса "Секундомер истории"
 */
function renderSpeedRunQuestion(question) {
    // Случайно выбираем тип вопроса
    const questionType = Math.random() > 0.5 ? 'year' : 'event';
    
    if (questionType === 'year') {
        // Показан год - выбрать событие
        const otherEvents = window.appData.dates
            .filter(d => d.id !== question.id)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(d => d.event);
        
        const options = shuffleArray([question.event, ...otherEvents]);
        
        return `
            <div class="speed-run-container">
                <div class="speed-question">
                    <div class="event-year">${escapeHtml(question.year)}</div>
                </div>
                <div class="speed-options">
                    ${options.map(opt => `
                        <div class="speed-option" data-value="${escapeHtml(opt)}">${escapeHtml(opt)}</div>
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        // Показано событие - выбрать год
        const otherYears = window.appData.dates
            .filter(d => d.id !== question.id)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(d => d.year);
        
        const options = shuffleArray([question.year, ...otherYears]);
        
        return `
            <div class="speed-run-container">
                <div class="speed-question">
                    <div class="event-name">${escapeHtml(question.event)}</div>
                </div>
                <div class="speed-options">
                    ${options.map(opt => `
                        <div class="speed-option" data-value="${escapeHtml(opt)}">${escapeHtml(opt)}</div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

/**
 * Инициализация режима "Секундомер истории"
 */
function initSpeedRunMode(question) {
    const options = document.querySelectorAll('.speed-option');
    const timerDisplay = document.getElementById('timerDisplay');
    const timerValue = document.getElementById('timerValue');
    
    let timeLeft = 5;
    let answered = false;
    
    // Запускаем таймер
    timerInterval = setInterval(() => {
        timeLeft--;
        timerValue.textContent = timeLeft;
        
        if (timeLeft <= 2) {
            timerDisplay.classList.add('warning');
        }
        if (timeLeft <= 1) {
            timerDisplay.classList.remove('warning');
            timerDisplay.classList.add('danger');
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (!answered) {
                answered = true;
                options.forEach(o => o.classList.add('disabled'));
                
                showFeedback(false, 'Время вышло!');
                
                handleWrong({
                    type: 'speed-run',
                    question: question.event || question.year,
                    correct: false,
                    userAnswer: 'timeout',
                    correctAnswer: question.event || question.year,
                    details: question
                }, true); // true = без штрафа
            }
        }
    }, 1000);
    
    options.forEach(opt => {
        opt.addEventListener('click', () => {
            if (answered) return;
            answered = true;
            clearInterval(timerInterval);
            
            const selectedValue = opt.dataset.value;
            const isCorrect = selectedValue === question.event || selectedValue === question.year;
            
            options.forEach(o => o.classList.add('disabled'));
            
            if (isCorrect) {
                opt.classList.add('correct');
                handleCorrect(10, {
                    type: 'speed-run',
                    question: question.event || question.year,
                    correct: true,
                    details: question
                });
            } else {
                opt.classList.add('wrong');
                
                // Подсвечиваем правильный ответ
                options.forEach(o => {
                    if (o.dataset.value === question.event || o.dataset.value === question.year) {
                        o.classList.add('correct');
                    }
                });
                
                handleWrong({
                    type: 'speed-run',
                    question: question.event || question.year,
                    correct: false,
                    userAnswer: selectedValue,
                    correctAnswer: question.event || question.year,
                    details: question
                });
            }
        });
    });
}

/**
 * Обработка правильного ответа
 */
function handleCorrect(points, answerData) {
    score += points;
    
    // Обновляем отображение очков
    document.querySelector('.score-display').innerHTML = `Очки: ${score}`;
    
    // Сохраняем ответ
    userAnswers.push({
        ...answerData,
        isCorrect: true,
        points
    });
    
    // Обновляем статистику
    const date = currentQuestions[currentQuestionIndex];
    Storage.addCorrectAnswer(points);
    Storage.updateDateStats(date.id, true);
    Storage.updateModeStats(currentMode, true);
    Storage.updatePeriodStats(date.period, true);
    Storage.updateDifficultyStats(date.difficulty, true);
    
    // Показываем обратную связь
    showFeedback(true, 'Правильно! +' + points);
    
    // Показываем кнопку "Далее"
    document.getElementById('skipBtn').style.display = 'none';
    document.getElementById('nextBtn').style.display = 'flex';
    
    // Настраиваем кнопку "Далее"
    document.getElementById('nextBtn').onclick = () => {
        moveToNextQuestion();
    };
}

/**
 * Обработка неправильного ответа
 */
function handleWrong(answerData, noPenalty = false) {
    if (!noPenalty) {
        score = Math.max(0, score - 5);
        document.querySelector('.score-display').innerHTML = `Очки: ${score}`;
    }
    
    // Сохраняем ответ
    userAnswers.push({
        ...answerData,
        isCorrect: false,
        points: noPenalty ? 0 : -5
    });
    
    // Обновляем статистику
    const date = currentQuestions[currentQuestionIndex];
    Storage.addWrongAnswer();
    Storage.updateDateStats(date.id, false);
    Storage.updateModeStats(currentMode, false);
    Storage.updatePeriodStats(date.period, false);
    Storage.updateDifficultyStats(date.difficulty, false);
    
    // Показываем обратную связь
    showFeedback(false, answerData.feedback || 'Неправильно!');
    
    // Показываем кнопку "Далее"
    document.getElementById('skipBtn').style.display = 'none';
    document.getElementById('nextBtn').style.display = 'flex';
    
    // Настраиваем кнопку "Далее"
    document.getElementById('nextBtn').onclick = () => {
        moveToNextQuestion();
    };
}

/**
 * Обработка пропуска вопроса
 */
function handleSkip() {
    const date = currentQuestions[currentQuestionIndex];
    
    userAnswers.push({
        type: 'skip',
        question: date.event,
        isCorrect: false,
        points: 0
    });
    
    Storage.addSkipped();
    
    moveToNextQuestion();
}

/**
 * Переход к следующему вопросу
 */
function moveToNextQuestion() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    currentQuestionIndex++;
    
    if (currentQuestionIndex < currentQuestions.length) {
        displayCurrentQuestion();
    } else {
        finishTraining();
    }
}

/**
 * Показ обратной связи
 */
function showFeedback(isCorrect, message) {
    const feedback = document.getElementById('feedback');
    
    feedback.className = `feedback ${isCorrect ? 'correct' : 'wrong'} show`;
    feedback.innerHTML = `
        <div class="feedback-header">
            <i class="fas fa-${isCorrect ? 'check-circle' : 'times-circle'}"></i>
            <strong>${isCorrect ? 'Правильно!' : 'Неправильно!'}</strong>
        </div>
        <div class="feedback-message">${escapeHtml(message)}</div>
    `;
}

/**
 * Завершение тренировки
 */
function finishTraining() {
    const container = document.getElementById('trainingExercise');
    
    // Сохраняем сессию
    Storage.addTrainingSession({
        mode: currentMode,
        questionsCount: currentQuestions.length,
        correct: userAnswers.filter(a => a.isCorrect).length,
        wrong: userAnswers.filter(a => !a.isCorrect && a.type !== 'skip').length,
        skipped: userAnswers.filter(a => a.type === 'skip').length,
        score: score
    });
    
    // Проверяем достижения
    checkAchievements();
    
    // Показываем результаты
    container.innerHTML = `
        <div class="training-results">
            <h2><i class="fas fa-trophy"></i> Тренировка завершена!</h2>
            
            <div class="results-summary">
                <div class="result-card">
                    <div class="result-icon" style="color: var(--accent-primary);">
                        <i class="fas fa-star"></i>
                    </div>
                    <h3>${score}</h3>
                    <p>Очков</p>
                </div>
                
                <div class="result-card">
                    <div class="result-icon" style="color: var(--success);">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h3>${userAnswers.filter(a => a.isCorrect).length}</h3>
                    <p>Правильных</p>
                </div>
                
                <div class="result-card">
                    <div class="result-icon" style="color: var(--danger);">
                        <i class="fas fa-times-circle"></i>
                    </div>
                    <h3>${userAnswers.filter(a => !a.isCorrect && a.type !== 'skip').length}</h3>
                    <p>Неправильных</p>
                </div>
                
                <div class="result-card">
                    <div class="result-icon" style="color: var(--warning);">
                        <i class="fas fa-forward"></i>
                    </div>
                    <h3>${userAnswers.filter(a => a.type === 'skip').length}</h3>
                    <p>Пропущено</p>
                </div>
            </div>
            
            <div class="results-details">
                <h3>Детализация:</h3>
                <div class="answers-list">
                    ${userAnswers.map((answer, index) => `
                        <div class="answer-item ${answer.isCorrect ? 'correct' : 'wrong'}">
                            <div class="answer-number">${index + 1}</div>
                            <div class="answer-content">
                                <div><strong>${escapeHtml(answer.question || 'Вопрос')}</strong></div>
                                ${answer.userAnswer ? `<div>Ваш ответ: ${escapeHtml(answer.userAnswer)}</div>` : ''}
                                ${answer.correctAnswer && !answer.isCorrect ? 
                                    `<div>Правильный: ${escapeHtml(answer.correctAnswer)}</div>` : ''}
                            </div>
                            <div class="answer-status ${answer.isCorrect ? 'correct' : 'wrong'}">
                                <i class="fas fa-${answer.isCorrect ? 'check' : 'times'}"></i>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="results-actions">
                <button class="btn-primary" id="restartTraining">
                    <i class="fas fa-redo"></i> Еще раз
                </button>
                <button class="btn-secondary" id="backToSetup">
                    <i class="fas fa-cog"></i> Настройки
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('restartTraining').addEventListener('click', () => {
        startTraining(window.appData.dates);
    });
    
    document.getElementById('backToSetup').addEventListener('click', () => {
        container.style.display = 'none';
        document.querySelector('.training-setup').style.display = 'block';
    });
}

/**
 * Проверка достижений
 */
function checkAchievements() {
    const stats = Storage.getStats();
    const achievements = Storage.getAchievements();
    const newAchievements = [];
    
    ACHIEVEMENTS.forEach(ach => {
        if (!achievements[ach.id] && ach.condition(stats)) {
            achievements[ach.id] = true;
            newAchievements.push(ach);
        }
    });
    
    if (newAchievements.length > 0) {
        Storage.saveAchievements(achievements);
        newAchievements.forEach(ach => {
            showAchievementNotification(ach);
        });
    }
}
