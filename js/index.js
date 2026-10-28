
import Quiz from './quiz.js';
import Question from './question.js';

const quizOptionsForm = document.getElementById('quizOptions');
const playerNameInput = document.getElementById('playerName');
const categoryInput = document.getElementById('categoryMenu');
const difficultyOptions = document.getElementById('difficultyOptions');
const questionsNumber = document.getElementById('questionsNumber');
const startQuizBtn = document.getElementById('startQuiz');
const questionsContainer =document.getElementById('questionsContainer')


let currentQuiz = null;


function showLoading() {
  if (!questionsContainer) return;
  questionsContainer.innerHTML = `
    <div class="loading-overlay">
      <div class="loading-spinner"></div>
      <p class="loading-text">Loading Questions...</p>
    </div>
  `;
}


function hideLoading() {
  if (!questionsContainer) return;
  const overlay = questionsContainer.querySelector('.loading-overlay');
  if (overlay) {
    overlay.remove();
  }
}

/**
 * Display an error card inside questionsContainer and wire the retry button
 * @param {string} message
 */
function showError(message) {
  if (!questionsContainer) return;
  questionsContainer.innerHTML = `
    <div class="game-card error-card">
      <div class="error-icon">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <h3 class="error-title">Oops! Something went wrong</h3>
      <p class="error-message">${message || 'Failed to load questions. Please try again.'}</p>
      <button type="button" class="btn-play retry-btn">
        <i class="fa-solid fa-rotate-right"></i> Try Again
      </button>
    </div>
  `;

  const retryBtn = questionsContainer.querySelector('.retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', resetToStart);
  }
}

/**
 * Validate the quiz setup form inputs
 * @returns {{ isValid: boolean, error: string | null }}
 */
function validateForm() {
  const rawValue = questionsNumber ? questionsNumber.value.trim() : '';

  if (rawValue === '') {
    return {
      isValid: false,
      error: 'Please enter the number of questions.'
    };
  }

  const num = Number(rawValue);

  if (Number.isNaN(num) || !Number.isInteger(num)) {
    return {
      isValid: false,
      error: 'Please enter a valid whole number of questions.'
    };
  }

  if (num < 1) {
    return {
      isValid: false,
      error: 'Minimum number of questions is 1.'
    };
  }

  if (num > 50) {
    return {
      isValid: false,
      error: 'Maximum number of questions is 50.'
    };
  }

  return {
    isValid: true,
    error: null
  };
}

/**
 * Show a temporary validation error alert on the setup form
 * @param {string} message
 */
function showFormError(message) {
  if (!quizOptionsForm || !startQuizBtn) return;

  const existingError = quizOptionsForm.querySelector('.form-error');
  if (existingError) {
    existingError.remove();
  }

  const errorDiv = document.createElement('div');
  errorDiv.className = 'form-error';
  errorDiv.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${message}`;

  quizOptionsForm.insertBefore(errorDiv, startQuizBtn);

  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.style.transition = 'opacity 0.3s ease';
      errorDiv.style.opacity = '0';
      setTimeout(() => errorDiv.remove(), 300);
    }
  }, 3000);
}


function resetToStart() {
  if (questionsContainer) {
    questionsContainer.innerHTML = '';
  }

  if (playerNameInput) {
    playerNameInput.value = '';
  }

  if (questionsNumber) {
    questionsNumber.value = '10';
  }

  if (categoryInput) {
    categoryInput.value = '';
  }

  if (difficultyOptions) {
    difficultyOptions.value = 'easy';
  }

  const categorySelect = document.getElementById('categorySelect');
  if (categorySelect) {
    categorySelect.dataset.value = '';
    const textEl = categorySelect.querySelector('.custom-select-text');
    const iconEl = categorySelect.querySelector('.custom-select-icon');
    if (textEl) textEl.textContent = 'Random Category';
    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-shuffle"></i>';
    categorySelect.querySelectorAll('.custom-select-option').forEach((opt, idx) => {
      opt.classList.toggle('selected', idx === 0);
    });
  }

  const difficultySelect = document.getElementById('difficultySelect');
  if (difficultySelect) {
    difficultySelect.dataset.value = 'easy';
    const textEl = difficultySelect.querySelector('.custom-select-text');
    const iconEl = difficultySelect.querySelector('.custom-select-icon');
    if (textEl) textEl.textContent = 'Easy Mode';
    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-face-smile"></i>';
    difficultySelect.querySelectorAll('.custom-select-option').forEach((opt) => {
      opt.classList.toggle('selected', opt.dataset.value === 'easy');
    });
  }

  if (quizOptionsForm) {
    const existingError = quizOptionsForm.querySelector('.form-error');
    if (existingError) existingError.remove();
    quizOptionsForm.classList.remove('hidden');
  }

  currentQuiz = null;
}


async function startQuiz() {
  const validation = validateForm();
  if (!validation.isValid) {
    showFormError(validation.error);
    return;
  }

  const playerName =
    playerNameInput && playerNameInput.value.trim()
      ? playerNameInput.value.trim()
      : 'Player';
  const category = categoryInput ? categoryInput.value : '';
  const difficulty =
    difficultyOptions && difficultyOptions.value ? difficultyOptions.value : 'easy';
  const numberOfQuestions = parseInt(questionsNumber.value, 10);

  currentQuiz = new Quiz(category, difficulty, numberOfQuestions, playerName);

  if (quizOptionsForm) {
    quizOptionsForm.classList.add('hidden');
  }

  showLoading();

  try {
    const questions = await currentQuiz.getQuestions();
    hideLoading();

    if (!questions || questions.length === 0) {
      throw new Error('No questions were returned for this selection. Please try again.');
    }

    const firstQuestion = new Question(currentQuiz, questionsContainer, resetToStart);
    firstQuestion.displayQuestion();
  } catch (error) {
    hideLoading();
    showError(error.message || 'Failed to load questions. Please try again.');
  }
}

if (startQuizBtn) {
  startQuizBtn.addEventListener('click', startQuiz);
}

if (questionsNumber) {
  questionsNumber.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      startQuiz();
    }
  });
}

if (quizOptionsForm) {
  quizOptionsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    startQuiz();
  });
}