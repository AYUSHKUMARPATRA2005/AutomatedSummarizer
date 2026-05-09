/* ============================================================
   Mind Map Module — Handles generation and rendering of AI mind maps
   ============================================================ */

const MindMap = (() => {
  let _cache = {}; // docId -> mermaidCode

  function init() {
    _initMermaid();
    _initGenerateBtn();
    _initThemeListener();
  }

  function _initMermaid() {
    if (window.mermaid) {
      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "default",
        securityLevel: "loose",
        fontFamily: "Inter, sans-serif"
      });
    }
  }

  function _initGenerateBtn() {
    const btn = document.getElementById("btn-gen-mindmap");
    if (btn) {
      btn.addEventListener("click", () => generate(false));
    }
    const refreshBtn = document.getElementById("btn-gen-mindmap-refresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => generate(true));
    }
  }

  function _initThemeListener() {
    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        setTimeout(() => {
          const isDark = document.documentElement.getAttribute("data-theme") === "dark";
          if (window.mermaid) {
            mermaid.initialize({ theme: isDark ? "dark" : "default" });
            
            // Re-render if there's an active mind map
            const docId = App.getActiveDocId();
            if (docId && _cache[docId]) {
              _render(_cache[docId]);
            }
          }
        }, 50);
      });
    }
  }

  async function generate(force = false) {
    const docId = App.getActiveDocId();
    if (!docId) {
      App.toast("Select or upload a document first.", "error");
      return;
    }

    // Check cache
    if (!force && _cache[docId]) {
      _render(_cache[docId]);
      return;
    }

    const btn = document.getElementById("btn-gen-mindmap");
    const container = document.getElementById("mindmap-content");

    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<div class="spinner spinner--sm"></div>`;

    container.innerHTML = `
      <div class="loading-state" style="animation: pulse 1.5s infinite;">
        <div class="spinner"></div>
        <div class="loading-state__text">AI is analyzing document structure...</div>
      </div>
    `;

    try {
      const data = await API.generateMindmap(docId, force);
      const code = data.mermaid_code;
      if (code) {
        _cache[docId] = code;
        _render(code);
        if (force) App.toast("Mind map regenerated!");
      } else {
        throw new Error("No structure data returned");
      }
    } catch (err) {
      _showError(err.message);
      App.toast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  async function _render(code) {
    const container = document.getElementById("mindmap-content");
    if (!window.mermaid) {
      container.innerHTML = `<div class="empty-state">Mermaid.js library not loaded.</div>`;
      return;
    }

    try {
      container.innerHTML = `<div class="mermaid-render" id="mermaid-svg-container"></div>`;
      const svgContainer = document.getElementById("mermaid-svg-container");
      
      // Mermaid render returns an object with svg string
      const { svg } = await mermaid.render('mindmap-svg-' + Math.random().toString(36).substr(2, 9), code);
      svgContainer.innerHTML = svg;

      // Ensure SVG takes up available space nicely
      const svgEl = svgContainer.querySelector('svg');
      if (svgEl) {
        svgEl.style.maxWidth = "100%";
        svgEl.style.height = "auto";
      }
    } catch (error) {
      console.error("Mermaid Render Error:", error);
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon" style="color:var(--error);">⚠️</div>
          <div class="empty-state__title">Visualization Failed</div>
          <div class="empty-state__text">The AI generated a complex structure that couldn't be rendered. Try again.</div>
          <pre style="margin-top:var(--space-md); text-align:left; font-size:10px; background:var(--bg-tertiary); padding:10px; overflow:auto; max-width:100%; color:var(--text-muted);">${_escHtml(code)}</pre>
        </div>
      `;
    }
  }

  function _showError(msg) {
    const container = document.getElementById("mindmap-content");
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">Generation Failed</div>
        <div class="empty-state__text">${_escHtml(msg)}</div>
      </div>
    `;
  }

  function onDocumentChange(docId) {
    const container = document.getElementById("mindmap-content");
    if (_cache[docId]) {
      _render(_cache[docId]);
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🕸️</div>
          <div class="empty-state__title">No mind map yet</div>
          <div class="empty-state__text">Upload a document, then click Generate to visualize the concepts.</div>
        </div>`;
    }
  }

  return { init, generate, onDocumentChange };
})();

document.addEventListener("DOMContentLoaded", MindMap.init);
