
export default class Quiz {
  /**
   * @param {string} category - The selected category ID
   * @param {string} difficulty - easy, medium, or hard
   * @param {number|string} numberOfQuestions - How many questions
   * @param {string} playerName - The player's name
   */
  constructor(category, difficulty, numberOfQuestions, playerName) {
    this.category = category || '';
    this.difficulty = difficulty || 'easy';
    this.numberOfQuestions = parseInt(numberOfQuestions, 10) || 10;
    this.playerName = playerName && playerName.trim() ? playerName.trim() : 'Player';
    this.score = 0;
    this.questions = [];
    this.currentQuestionIndex = 0;
  }

  /**
   * Build the Open Trivia Database API URL with query parameters
   * @returns {string}
   */
  buildApiUrl() {
    const baseUrl = 'https://opentdb.com/api.php';
    const params = new URLSearchParams();

    params.append('amount', this.numberOfQuestions);

    if (this.category) {
      params.append('category', this.category);
    }

    if (this.difficulty) {
      params.append('difficulty', this.difficulty);
    }

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Fetch questions from the Open Trivia Database API
   * @returns {Promise<Array>}
   */
  async getQuestions() {
    const url = this.buildApiUrl();
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Network error: Failed to fetch questions (HTTP ${response.status}).`);
    }

    const data = await response.json();

    if (data.response_code !== 0 || !Array.isArray(data.results) || data.results.length === 0) {
      const errorMessages = {
        1: 'Not enough questions available for this category and difficulty. Try fewer questions or another category.',
        2: 'Invalid quiz configuration parameters. Please check your selections and try again.',
        3: 'Session token not found. Please try again.',
        4: 'All questions for this selection have been exhausted. Please try another category.',
        5: 'Too many requests. Please wait a few seconds and try again.'
      };
      throw new Error(
        errorMessages[data.response_code] || 'Failed to load questions. Please try again.'
      );
    }

    this.questions = data.results;
    this.numberOfQuestions = this.questions.length;
    return this.questions;
  }

 
  incrementScore() {
    this.score += 1;
  }

  /**
   * Get the current question object
   * @returns {object|null}
   */
  getCurrentQuestion() {
    if (this.currentQuestionIndex >= 0 && this.currentQuestionIndex < this.questions.length) {
      return this.questions[this.currentQuestionIndex];
    }
    return null;
  }

  /**
   * Advance to the next question
   * @returns {boolean} True if more questions remain, false if the quiz is complete
   */
  nextQuestion() {
    this.currentQuestionIndex += 1;
    return !this.isComplete();
  }

  /**
   * Check whether all questions have been answered
   * @returns {boolean}
   */
  isComplete() {
    return this.currentQuestionIndex >= this.questions.length;
  }

  /**
   * Calculate accuracy percentage (0-100)
   * @returns {number}
   */
  getScorePercentage() {
    if (!this.numberOfQuestions || this.numberOfQuestions <= 0) {
      return 0;
    }
    return Math.round((this.score / this.numberOfQuestions) * 100);
  }

  /**
   * Retrieve saved high scores from localStorage safely
   * @returns {Array<{name: string, score: number, total: number, percentage: number, difficulty: string, date: string}>}
   */
  getHighScores() {
    try {
      const stored = localStorage.getItem('quizHighScores');
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];

      return parsed.filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.name === 'string' &&
          typeof item.percentage === 'number' &&
          !Number.isNaN(item.percentage)
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if the current score qualifies as a top-10 high score
   * @returns {boolean}
   */
  isHighScore() {
    const highScores = this.getHighScores();
    const currentPercentage = this.getScorePercentage();

    if (highScores.length < 10) {
      return true;
    }

    const lowestSavedPercentage = highScores[highScores.length - 1]?.percentage ?? 0;
    return currentPercentage > lowestSavedPercentage;
  }

  
  saveHighScore() {
    try {
      const highScores = this.getHighScores();
      const newEntry = {
        name: this.playerName || 'Player',
        score: this.score,
        total: this.numberOfQuestions,
        percentage: this.getScorePercentage(),
        difficulty: this.difficulty,
        date: new Date().toISOString()
      };

      highScores.push(newEntry);
      highScores.sort((a, b) => {
        if (b.percentage !== a.percentage) {
          return b.percentage - a.percentage;
        }
        return (b.score || 0) - (a.score || 0);
      });

      const topTen = highScores.slice(0, 10);
      localStorage.setItem('quizHighScores', JSON.stringify(topTen));
    } catch (error) {
      // Ignore storage quota or private-mode errors gracefully
    }
  }

  /**
   * Escape HTML special characters to prevent XSS in player names
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  /**
   * Complete the quiz, persist high score when applicable, and return results HTML
   * @returns {string}
   */
  endQuiz() {
    const percentage = this.getScorePercentage();
    const qualifiesForHighScore = this.isHighScore();

    if (qualifiesForHighScore) {
      this.saveHighScore();
    }

    const highScores = this.getHighScores();
    const rankClasses = ['gold', 'silver', 'bronze'];

    const leaderboardItemsMarkup = highScores
      .map((entry, index) => {
        const rankClass = rankClasses[index] || '';
        const safeName = this.escapeHtml(entry.name || 'Player');
        return `
          <li class="leaderboard-item ${rankClass}">
            <span class="leaderboard-rank">#${index + 1}</span>
            <span class="leaderboard-name">${safeName}</span>
            <span class="leaderboard-score">${entry.percentage}%</span>
          </li>
        `;
      })
      .join('');

    return `
      <div class="game-card results-card">
        <h2 class="results-title">Quiz Complete!</h2>
        <p class="results-score-display">${this.score}/${this.numberOfQuestions}</p>
        <p class="results-percentage">${percentage}% Accuracy</p>
        ${
          qualifiesForHighScore
            ? `
        <div class="new-record-badge">
          <i class="fa-solid fa-star"></i> New High Score!
        </div>
        `
            : ''
        }
        <div class="leaderboard">
          <h4 class="leaderboard-title">
            <i class="fa-solid fa-trophy"></i> Leaderboard
          </h4>
          <ul class="leaderboard-list">
            ${leaderboardItemsMarkup}
          </ul>
        </div>
        <div class="action-buttons">
          <button class="btn-restart">
            <i class="fa-solid fa-rotate-right"></i> Play Again
          </button>
        </div>
      </div>
    `;
  }
}