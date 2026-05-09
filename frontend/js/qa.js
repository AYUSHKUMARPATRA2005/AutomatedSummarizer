/* ============================================================
   Q&A — Interactive Study Questions & Answers
   ============================================================ */

const QA = (() => {
  let _qaData = [];
  let _cache = {};

  function init() {
    document.getElementById("btn-gen-qa").addEventListener("click", () => generate(false));
    const refreshBtn = document.getElementById("btn-gen-qa-refresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => generate(true));
    }
  }

  async function generate(force = false) {
    const docId = App.getActiveDocId();
    if (!docId) { App.toast("Upload a document first.", "error"); return; }

    if (!force && _cache[docId]) {
      _qaData = _cache[docId]; _render(); return;
    }

    _showLoading();
    try {
      const data = await API.generateQA(docId, force);
      _qaData = data.qa || data;
      _cache[docId] = _qaData;
      _render();
      App.toast(force ? "Q&A regenerated!" : `${_qaData.length} Q&A pairs generated!`);
    } catch (err) {
      _showError(err.message);
      App.toast(err.message, "error");
    }
  }

  function _render() {
    const el = document.getElementById("qa-content");
    if (!_qaData || _qaData.length === 0) {
      _showError("No Q&A pairs generated.");
      return;
    }

    // Group by category
    const grouped = _qaData.reduce((acc, item) => {
      const cat = item.category || "General";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});

    let html = `<div class="qa-container fade-in-up">`;
    
    for (const [category, items] of Object.entries(grouped)) {
      html += `<div class="qa-category">
        <h3 class="qa-category__title"><i data-lucide="tag" style="width:16px;height:16px;"></i> ${category}</h3>
        <div class="qa-list">`;
      
      items.forEach((item, index) => {
        html += `
          <div class="qa-item">
            <div class="qa-item__question">
              <span class="qa-item__icon"><i data-lucide="help-circle" style="width:18px;height:18px;"></i></span>
              <span class="qa-item__text">${_esc(item.question)}</span>
              <span class="qa-item__chevron"><i data-lucide="chevron-down" style="width:18px;height:18px;"></i></span>
            </div>
            <div class="qa-item__answer">
              <div class="qa-item__answer-inner">
                ${_esc(item.answer)}
              </div>
            </div>
          </div>`;
      });
      
      html += `</div></div>`;
    }
    
    html += `</div>`;
    el.innerHTML = html;
    lucide.createIcons();
    _bindAccordions();
  }

  function _bindAccordions() {
    document.querySelectorAll(".qa-item__question").forEach(q => {
      q.addEventListener("click", () => {
        const item = q.closest(".qa-item");
        const wasActive = item.classList.contains("active");
        
        // Optional: Close others
        // document.querySelectorAll(".qa-item").forEach(i => i.classList.remove("active"));
        
        if (!wasActive) {
          item.classList.add("active");
        } else {
          item.classList.remove("active");
        }
      });
    });
  }

  function _showLoading() {
    document.getElementById("qa-content").innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <div class="loading-state__text">Generating study questions…</div>
      </div>`;
  }

  function _showError(msg) {
    document.getElementById("qa-content").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">Error</div>
        <div class="empty-state__text">${_esc(msg)}</div>
      </div>`;
  }

  function _esc(s) {
    return s ? s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
  }

  function onDocumentChange(docId) {
    const el = document.getElementById("qa-content");
    if (_cache[docId]) {
      _qaData = _cache[docId];
      _render();
    } else {
      _qaData = [];
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">❓</div>
          <div class="empty-state__title">No Q&A Yet</div>
          <div class="empty-state__text">Convert this document into an interactive Q&A study guide.</div>
        </div>`;
    }
  }

  return { init, generate, onDocumentChange };
})();

document.addEventListener("DOMContentLoaded", QA.init);
