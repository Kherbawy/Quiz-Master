

export default class Question {
  /**
   * @param {import('./quiz.js').default} quiz - Reference to the Quiz instance
   * @param {HTMLElement} container - DOM element to render into
   * @param {Function} onQuizEnd - Callback when Play Again is clicked on results screen
   */
  constructor(quiz, container, onQuizEnd) {
    this.quiz = quiz;
    this.container = container;
    this.onQuizEnd = onQuizEnd;

    this.questionData = this.quiz.getCurrentQuestion() || {};
    this.index = this.quiz.currentQuestionIndex;

    this.question = this.decodeHtml(this.questionData.question || '');
    this.correctAnswer = this.decodeHtml(this.questionData.correct_answer || '');
    this.category = this.decodeHtml(this.questionData.category || 'General');
    this.difficulty = (this.questionData.difficulty || this.quiz.difficulty || 'easy').toLowerCase();

    this.wrongAnswers = Array.isArray(this.questionData.incorrect_answers)
      ? this.questionData.incorrect_answers.map((answer) => this.decodeHtml(answer))
      : [];

    this.allAnswers = this.shuffleAnswers();

    this.answered = false;
    this.timerInterval = null;
    this.timeRemaining = 15;
    this.warningThreshold = 5;

    this.handleKeyDown = this.onKeyDown.bind(this);
  }

  /**
   * Decode HTML entities (such as &amp;, &quot;, &#039;) returned by the API
   * @param {string} html
   * @returns {string}
   */
  decodeHtml(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    return doc.documentElement.textContent || '';
  }

  /**
   * Escape a string for safe insertion into HTML attributes and text nodes
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Combine wrongAnswers and correctAnswer and shuffle using Fisher-Yates algorithm
   * @returns {string[]}
   */
  shuffleAnswers() {
    const array = [...this.wrongAnswers, this.correctAnswer];
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Calculate question progress percentage (0-100)
   * @returns {number}
   */
  getProgress() {
    if (!this.quiz.numberOfQuestions || this.quiz.numberOfQuestions <= 0) {
      return 0;
    }
    return Math.round(((this.index + 1) / this.quiz.numberOfQuestions) * 100);
  }

  /**
   * Map difficulty level to its corresponding Font Awesome icon class
   * @returns {string}
   */
  getDifficultyIcon() {
    const icons = {
      easy: 'fa-face-smile',
      medium: 'fa-face-meh',
      hard: 'fa-skull'
    };
    return icons[this.difficulty] || 'fa-face-smile';
  }

  /**
   * Synthesize lightweight arcade sound effects using the Web Audio API
   * @param {'correct' | 'wrong' | 'warning' | 'timeout' | 'complete'} type
   */
  playSound(type) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!Question.audioCtx) {
        Question.audioCtx = new AudioCtx();
      }
      const ctx = Question.audioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const playTone = (freq, startTime, duration, waveType = 'sine', gainValue = 0.08) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = waveType;
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(gainValue, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      if (type === 'correct') {
        playTone(523.25, now, 0.12, 'sine', 0.1);
        playTone(659.25, now + 0.1, 0.2, 'sine', 0.1);
      } else if (type === 'wrong') {
        playTone(220, now, 0.15, 'sawtooth', 0.08);
        playTone(164.81, now + 0.12, 0.22, 'sawtooth', 0.08);
      } else if (type === 'warning') {
        playTone(880, now, 0.07, 'square', 0.04);
      } else if (type === 'timeout') {
        playTone(196, now, 0.3, 'sawtooth', 0.09);
      } else if (type === 'complete') {
        playTone(523.25, now, 0.12, 'triangle', 0.1);
        playTone(659.25, now + 0.12, 0.12, 'triangle', 0.1);
        playTone(783.99, now + 0.24, 0.25, 'triangle', 0.12);
      }
    } catch (error) {
      // Ignore audio errors if blocked by browser autoplay policies
    }
  }

  /**
   * Render the question card HTML and initialize listeners and timer
   */
  displayQuestion() {
    const progress = this.getProgress();
    const currentNumber = this.index + 1;
    const totalQuestions = this.quiz.numberOfQuestions;
    const difficultyIcon = this.getDifficultyIcon();

    const answersMarkup = this.allAnswers
      .map((answer, idx) => {
        const escapedAnswer = this.escapeHtml(answer);
        return `
        <button class="answer-btn" data-answer="${escapedAnswer}">
          <span class="answer-key">${idx + 1}</span>
          <span class="answer-text">${escapedAnswer}</span>
        </button>
      `;
      })
      .join('');

    const html = `
      <div class="game-card question-card">
        <div class="xp-bar-container">
          <div class="xp-bar-header">
            <span class="xp-label"><i class="fa-solid fa-bolt"></i> Progress</span>
            <span class="xp-value">Question ${currentNumber}/${totalQuestions}</span>
          </div>
          <div class="xp-bar">
            <div class="xp-bar-fill" style="width: ${progress}%"></div>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat-badge category">
            <i class="fa-solid fa-bookmark"></i>
            <span>${this.escapeHtml(this.category)}</span>
          </div>
          <div class="stat-badge difficulty ${this.escapeHtml(this.difficulty)}">
            <i class="fa-solid ${difficultyIcon}"></i>
            <span>${this.escapeHtml(this.difficulty)}</span>
          </div>
          <div class="stat-badge timer">
            <i class="fa-solid fa-stopwatch"></i>
            <span class="timer-value">${this.timeRemaining}</span>s
          </div>
          <div class="stat-badge counter">
            <i class="fa-solid fa-gamepad"></i>
            <span>${currentNumber}/${totalQuestions}</span>
          </div>
        </div>

        <h2 class="question-text">${this.escapeHtml(this.question)}</h2>

        <div class="answers-grid">
          ${answersMarkup}
        </div>

        <p class="keyboard-hint">
          <i class="fa-regular fa-keyboard"></i> Press 1-${this.allAnswers.length} to select
        </p>

        <div class="score-panel">
          <div class="score-item">
            <div class="score-item-label">Score</div>
            <div class="score-item-value">${this.quiz.score}</div>
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.addEventListeners();
    this.startTimer();
  }

  /**
   * Handle keyboard shortcut selection for keys 1-4
   * @param {KeyboardEvent} event
   */
  onKeyDown(event) {
    if (this.answered) return;

    const validKeys = ['1', '2', '3', '4'];
    if (!validKeys.includes(event.key)) return;

    const index = parseInt(event.key, 10) - 1;
    const buttons = this.container.querySelectorAll('.answer-btn');

    if (index >= 0 && index < buttons.length) {
      event.preventDefault();
      this.checkAnswer(buttons[index]);
    }
  }


  addEventListeners() {
    this.removeEventListeners();

    const buttons = this.container.querySelectorAll('.answer-btn');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        this.checkAnswer(button);
      });
    });

    document.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * Clean up document-level keyboard event listeners
   */
  removeEventListeners() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }


  startTimer() {
    this.stopTimer();

    const timerBadge = this.container.querySelector('.stat-badge.timer');
    const timerValueEl = this.container.querySelector('.timer-value');

    this.timerInterval = setInterval(() => {
      this.timeRemaining -= 1;

      if (timerValueEl) {
        timerValueEl.textContent = Math.max(0, this.timeRemaining);
      }

      if (this.timeRemaining <= this.warningThreshold && this.timeRemaining > 0) {
        if (timerBadge) {
          timerBadge.classList.add('warning');
        }
        this.playSound('warning');
      }

      if (this.timeRemaining <= 0) {
        this.stopTimer();
        this.handleTimeUp();
      }
    }, 1000);
  }

 
  stopTimer() {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }


  handleTimeUp() {
    if (this.answered) return;

    this.answered = true;
    this.stopTimer();
    this.removeEventListeners();
    this.playSound('timeout');

    this.highlightCorrectAnswer();

    const buttons = this.container.querySelectorAll('.answer-btn');
    buttons.forEach((button) => {
      if (!button.classList.contains('correct-reveal') && !button.classList.contains('correct')) {
        button.classList.add('disabled');
      }
    });

    const questionCard = this.container.querySelector('.question-card');
    const scorePanel = this.container.querySelector('.score-panel');
    if (questionCard && !this.container.querySelector('.time-up-message')) {
      const timeUpEl = document.createElement('div');
      timeUpEl.className = 'time-up-message';
      timeUpEl.innerHTML = '<i class="fa-solid fa-clock"></i> TIME\'S UP!';
      if (scorePanel) {
        questionCard.insertBefore(timeUpEl, scorePanel);
      } else {
        questionCard.appendChild(timeUpEl);
      }
    }

    this.animateQuestion();
  }

  /**
   * Evaluate the user's selected answer button
   * @param {HTMLElement} choiceElement
   */
  checkAnswer(choiceElement) {
    if (this.answered || !choiceElement) return;

    this.answered = true;
    this.stopTimer();
    this.removeEventListeners();

    const selectedAnswer = choiceElement.dataset.answer || '';
    const isCorrect =
      selectedAnswer.trim().toLowerCase() === this.correctAnswer.trim().toLowerCase();

    if (isCorrect) {
      choiceElement.classList.add('correct');
      this.quiz.incrementScore();
      this.playSound('correct');

      const scoreValueEl = this.container.querySelector('.score-item-value');
      if (scoreValueEl) {
        scoreValueEl.textContent = this.quiz.score;
      }
    } else {
      choiceElement.classList.add('wrong');
      this.highlightCorrectAnswer();
      this.playSound('wrong');
    }

    const buttons = this.container.querySelectorAll('.answer-btn');
    buttons.forEach((button) => {
      if (
        button !== choiceElement &&
        !button.classList.contains('correct-reveal') &&
        !button.classList.contains('correct')
      ) {
        button.classList.add('disabled');
      }
    });

    this.animateQuestion();
  }

  
  highlightCorrectAnswer() {
    const buttons = this.container.querySelectorAll('.answer-btn');
    buttons.forEach((button) => {
      const answerText = button.dataset.answer || '';
      if (answerText.trim().toLowerCase() === this.correctAnswer.trim().toLowerCase()) {
        button.classList.add('correct-reveal');
      }
    });
  }

  /**
   * Animate the current question card out and load the next question or results
   * @param {number} [duration=400]
   */
  animateQuestion(duration = 400) {
    setTimeout(() => {
      const questionCard = this.container.querySelector('.question-card');
      if (questionCard) {
        questionCard.classList.add('exit');
      }

      setTimeout(() => {
        this.getNextQuestion();
      }, duration);
    }, 1500);
  }

 
  getNextQuestion() {
    if (this.quiz.nextQuestion()) {
      const nextQuestion = new Question(this.quiz, this.container, this.onQuizEnd);
      nextQuestion.displayQuestion();
    } else {
      this.playSound('complete');
      this.container.innerHTML = this.quiz.endQuiz();

      const restartBtn = this.container.querySelector('.btn-restart');
      if (restartBtn) {
        restartBtn.addEventListener('click', () => {
          if (typeof this.onQuizEnd === 'function') {
            this.onQuizEnd();
          }
        });
      }
    }
  }
}