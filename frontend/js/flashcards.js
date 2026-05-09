/* ============================================================
   Flashcards — 3D flip cards with navigation
   ============================================================ */

const Flashcards = (() => {
  let _cards = [];
  let _index = 0;
  let _flipped = false;
  let _cache = {};

  function init() {
    document.getElementById("btn-gen-flashcards").addEventListener("click", () => generate(false));
    const refreshBtn = document.getElementById("btn-gen-flashcards-refresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => generate(true));
    }
  }

  async function generate(force = false) {
    const docId = App.getActiveDocId();
    if (!docId) { App.toast("Upload a document first.", "error"); return; }

    if (!force && _cache[docId]) {
      _cards = _cache[docId]; _index = 0; _flipped = false; _render(); return;
    }

    _showLoading();
    try {
      const data = await API.generateFlashcards(docId, force);
      _cards = data.flashcards || data;
      _cache[docId] = _cards;
      _index = 0; _flipped = false;
      _render();
      App.toast(force ? "Flashcards regenerated!" : `${_cards.length} flashcards generated!`);
    } catch (err) {
      _showError(err.message); App.toast(err.message, "error");
    }
  }

  function _render() {
    if (!_cards.length) { _showError("No flashcards generated."); return; }
    const c = _cards[_index];
    const el = document.getElementById("flashcards-content");
    el.innerHTML = `
      <div class="flashcard-container fade-in-up">
        <div class="flashcard-controls">
          <button class="btn btn--ghost" id="fc-prev" ${_index===0?"disabled":""}><i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Prev</button>
          <span class="flashcard-progress">${_index+1} / ${_cards.length}</span>
          <button class="btn btn--ghost" id="fc-next" ${_index===_cards.length-1?"disabled":""}> Next <i data-lucide="chevron-right" style="width:18px;height:18px;"></i></button>
        </div>
        <div class="flashcard-wrapper" id="fc-wrapper">
          <div class="flashcard" id="fc-card">
            <div class="flashcard__face flashcard__front">
              <div class="flashcard__label">Question</div>
              <div class="flashcard__text">${_esc(c.front)}</div>
              <div class="flashcard__hint">Click to flip</div>
            </div>
            <div class="flashcard__face flashcard__back">
              <div class="flashcard__label">Answer</div>
              <div class="flashcard__text">${_esc(c.back)}</div>
              <div class="flashcard__hint">Click to flip back</div>
            </div>
          </div>
        </div>
        <div class="flashcard-dots">${_cards.map((_,i)=>`<button class="flashcard-dot${i===_index?" active":""}" data-i="${i}"></button>`).join("")}</div>
        <div class="swipe-hint">
          <i data-lucide="chevron-left" style="width:14px;height:14px;opacity:0.5;"></i>
          Swipe to navigate
          <i data-lucide="chevron-right" style="width:14px;height:14px;opacity:0.5;"></i>
        </div>
      </div>`;
    lucide.createIcons();
    document.getElementById("fc-wrapper").addEventListener("click", _flip);
    document.getElementById("fc-prev").addEventListener("click", ()=>_go(_index-1));
    document.getElementById("fc-next").addEventListener("click", ()=>_go(_index+1));
    document.querySelectorAll(".flashcard-dot").forEach(d=>d.addEventListener("click",()=>_go(+d.dataset.i)));
  }

  function _flip() { _flipped=!_flipped; const c=document.getElementById("fc-card"); if(c) c.classList.toggle("flipped",_flipped); }
  function _go(i) { if(i<0||i>=_cards.length) return; _index=i; _flipped=false; _render(); }

  function _showLoading() { document.getElementById("flashcards-content").innerHTML=`<div class="loading-state"><div class="spinner"></div><div class="loading-state__text">Generating flashcards…</div></div>`; }
  function _showError(m) { document.getElementById("flashcards-content").innerHTML=`<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">Error</div><div class="empty-state__text">${_esc(m)}</div></div>`; }
  function _esc(s) { return s?s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"):""; }

  // Keyboard nav
  document.addEventListener("keydown", e => {
    if (!document.getElementById("panel-flashcards").classList.contains("active")) return;
    if (e.key==="ArrowLeft") _go(_index-1);
    else if (e.key==="ArrowRight") _go(_index+1);
    else if (e.key===" ") { e.preventDefault(); _flip(); }
  });

  function onDocumentChange(docId) {
    const el = document.getElementById("flashcards-content");
    if (_cache[docId]) {
      _cards = _cache[docId]; _index = 0; _flipped = false; _render();
    } else {
      _cards = [];
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🗂️</div>
          <div class="empty-state__title">No Flashcards Yet</div>
          <div class="empty-state__text">Convert this document into a set of study flashcards.</div>
        </div>`;
    }
  }

  return { init, generate, onDocumentChange };
})();

document.addEventListener("DOMContentLoaded", Flashcards.init);
