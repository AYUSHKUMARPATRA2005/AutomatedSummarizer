/* ============================================================
   Quiz — MCQ quiz engine with scoring
   ============================================================ */

const Quiz = (() => {
  let _questions = [];
  let _index = 0;
  let _score = 0;
  let _answered = []; // tracks per-question state
  let _cache = {};

  function init() {
    document.getElementById("btn-gen-quiz").addEventListener("click", () => generate(false));
    const refreshBtn = document.getElementById("btn-gen-quiz-refresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => generate(true));
    }
  }

  async function generate(force = false) {
    const docId = App.getActiveDocId();
    if (!docId) { App.toast("Upload a document first.", "error"); return; }

    if (!force && _cache[docId]) {
      _questions = _cache[docId];
      _reset();
      _render();
      return;
    }

    _showLoading();
    try {
      const data = await API.generateQuiz(docId, force);
      _questions = data.quiz || data;
      _cache[docId] = _questions;
      _reset();
      _render();
      App.toast(force ? "Quiz regenerated!" : `${_questions.length}-question quiz ready!`);
    } catch (err) {
      _showError(err.message);
      App.toast(err.message, "error");
    }
  }

  function _reset() {
    _index = 0;
    _score = 0;
    _answered = _questions.map(() => ({ chosen: -1, locked: false }));
  }

  function _render() {
    if (!_questions.length) { _showError("No questions generated."); return; }

    // Check if quiz is complete
    if (_index >= _questions.length) { _renderResults(); return; }

    const q = _questions[_index];
    const a = _answered[_index];
    const letters = ["A", "B", "C", "D"];
    const diffClass = q.difficulty ? `quiz-card__difficulty--${q.difficulty}` : "";
    const el = document.getElementById("quiz-content");

    el.innerHTML = `
      <div class="quiz-container fade-in-up">
        <div class="quiz-header">
          <span class="quiz-header__progress">Question ${_index + 1} of ${_questions.length}</span>
          <span class="quiz-header__score"><i data-lucide="trophy" style="width:14px;height:14px;"></i> ${_score} / ${_questions.length}</span>
        </div>
        <div class="progress-bar" style="margin-bottom:var(--space-md);">
          <div class="progress-bar__fill" style="width:${((_index) / _questions.length) * 100}%;"></div>
        </div>
        <div class="quiz-card">
          ${q.difficulty ? `<span class="quiz-card__difficulty ${diffClass}">${_esc(q.difficulty)}</span>` : ""}
          <div class="quiz-card__question">${_esc(q.question)}</div>
          <div class="quiz-options">
            ${(q.options || []).map((opt, i) => {
              let cls = "quiz-option";
              if (a.locked) {
                cls += " quiz-option--disabled";
                if (i === q.correctAnswer) cls += " quiz-option--correct";
                else if (i === a.chosen && i !== q.correctAnswer) cls += " quiz-option--wrong";
              }
              return `<div class="${cls}" data-opt="${i}">
                <span class="quiz-option__letter">${letters[i]}</span>
                <span>${_esc(opt)}</span>
              </div>`;
            }).join("")}
          </div>
          ${a.locked && q.explanation ? `
            <div class="quiz-explanation">
              <div class="quiz-explanation__label">Explanation</div>
              ${_esc(q.explanation)}
            </div>` : ""}
        </div>
        <div class="quiz-nav">
          <button class="btn btn--secondary" id="qz-prev" ${_index === 0 ? "disabled" : ""}>
            <i data-lucide="chevron-left" style="width:16px;height:16px;"></i> Previous
          </button>
          <button class="btn btn--primary" id="qz-next" ${!a.locked ? "disabled" : ""}>
            ${_index === _questions.length - 1 ? "See Results" : "Next"} <i data-lucide="chevron-right" style="width:16px;height:16px;"></i>
          </button>
        </div>
      </div>`;

    lucide.createIcons();
    _bindQuizEvents();
  }

  function _bindQuizEvents() {
    // Option clicks
    document.querySelectorAll(".quiz-option").forEach(opt => {
      opt.addEventListener("click", () => {
        const a = _answered[_index];
        if (a.locked) return;
        const chosen = parseInt(opt.dataset.opt);
        a.chosen = chosen;
        a.locked = true;
        if (chosen === _questions[_index].correctAnswer) _score++;
        _render();
      });
    });
    // Nav
    document.getElementById("qz-prev").addEventListener("click", () => { if (_index > 0) { _index--; _render(); } });
    document.getElementById("qz-next").addEventListener("click", () => { _index++; _render(); });
  }

  function _renderResults() {
    const pct = Math.round((_score / _questions.length) * 100);
    let cls, msg;
    if (pct >= 80) { cls = "quiz-results__score--great"; msg = "Excellent work! 🎉"; }
    else if (pct >= 50) { cls = "quiz-results__score--ok"; msg = "Good effort! Keep studying. 📖"; }
    else { cls = "quiz-results__score--poor"; msg = "Keep practicing — you'll get there! 💪"; }

    document.getElementById("quiz-content").innerHTML = `
      <div class="quiz-results card fade-in-up">
        <div class="quiz-results__score ${cls}">${_score} / ${_questions.length} (${pct}%)</div>
        <div class="quiz-results__message">${msg}</div>
        <div style="display:flex;gap:var(--space-md);justify-content:center;flex-wrap:wrap;">
          <button class="btn btn--secondary" id="qz-review">
            <i data-lucide="eye" style="width:16px;height:16px;"></i> Review Answers
          </button>
          <button class="btn btn--primary" id="qz-retry">
            <i data-lucide="rotate-ccw" style="width:16px;height:16px;"></i> Retry Quiz
          </button>
        </div>
      </div>`;
    lucide.createIcons();
    document.getElementById("qz-review").addEventListener("click", () => { _index = 0; _render(); });
    document.getElementById("qz-retry").addEventListener("click", () => { _reset(); _render(); });
  }

  function _showLoading() {
    document.getElementById("quiz-content").innerHTML = `
      <div class="loading-state"><div class="spinner"></div>
      <div class="loading-state__text">Generating quiz questions…</div></div>`;
  }
  function _showError(m) {
    document.getElementById("quiz-content").innerHTML = `
      <div class="empty-state"><div class="empty-state__icon">⚠️</div>
      <div class="empty-state__title">Error</div>
      <div class="empty-state__text">${_esc(m)}</div></div>`;
  }
  function _esc(s) { return s ? s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ""; }

  function onDocumentChange(docId) {
    const el = document.getElementById("quiz-content");
    if (_cache[docId]) {
      _questions = _cache[docId];
      _reset();
      _render();
    } else {
      _questions = [];
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">❓</div>
          <div class="empty-state__title">No Quiz Generated</div>
          <div class="empty-state__text">Test your knowledge with a custom quiz for this document.</div>
        </div>`;
    }
  }

  return { init, generate, onDocumentChange };
})();

document.addEventListener("DOMContentLoaded", Quiz.init);
