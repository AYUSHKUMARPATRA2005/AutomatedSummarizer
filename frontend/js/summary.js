/* ============================================================
   Summary — Generate & render summaries + key points
   ============================================================ */

const Summary = (() => {
  let _cache = {};   // docId -> { short, medium, long }
  let _keypointCache = {};

  function init() {
    _initLengthToggle();
    _initKeypointBtn();
    _initRegenerateBtn();
    _initKeypointRegenerateBtn();
    _initTTS();
  }

  // ---- Summary Length Toggle ----
  function _initLengthToggle() {
    document.querySelectorAll(".summary-toggle__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".summary-toggle__btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        generate(btn.dataset.length);
      });
    });
  }

  async function generate(length, force = false) {
    const docId = App.getActiveDocId();
    if (!docId) {
      App.toast("Upload a document first.", "error");
      return;
    }

    if (!length) {
      const activeBtn = document.querySelector(".summary-toggle__btn.active");
      length = activeBtn ? activeBtn.dataset.length : "medium";
    }

    _stopTTS(); // Stop any currently playing audio

    // Check cache (skip if force is true)
    if (!force && _cache[docId] && _cache[docId][length]) {
      _renderSummary(_cache[docId][length]);
      return;
    }

    _showLoading("summary-content", "Generating summary…");

    try {
      const data = await API.generateSummary(docId, length, force);
      if (!_cache[docId]) _cache[docId] = {};
      _cache[docId][length] = data;
      _renderSummary(data);
    } catch (err) {
      _showError("summary-content", err.message);
      App.toast(err.message, "error");
    }
  }

  function _initRegenerateBtn() {
    const btn = document.getElementById("btn-gen-summary-refresh");
    if (btn) {
      btn.addEventListener("click", () => {
        const activeBtn = document.querySelector(".summary-toggle__btn.active");
        const length = activeBtn ? activeBtn.dataset.length : "medium";
        generate(length, true); // force = true
      });
    }
  }

  function _renderSummary(data) {
    const el = document.getElementById("summary-content");
    el.innerHTML = `
      <div class="card fade-in-up">
        <h3 style="margin-bottom:var(--space-md);color:var(--text-primary);">${_escHtml(data.title || "Summary")}</h3>
        <div class="summary-body" style="font-size:var(--text-base);color:var(--text-secondary);line-height:1.75;">
          ${_md(data.summary || "")}
        </div>
      </div>
    `;
    
    // Enable the Listen button since we have content
    const listenBtn = document.getElementById("btn-listen-summary");
    if (listenBtn) listenBtn.disabled = false;
    // Show copy button
    const copyBtn = document.getElementById("btn-copy-summary");
    if (copyBtn) copyBtn.style.display = "inline-flex";
  }

  // ---- Text-to-Speech (TTS) ----
  let currentUtterance = null;
  
  function _initTTS() {
    const btnListen = document.getElementById("btn-listen-summary");
    const btnStop = document.getElementById("btn-stop-audio");

    if (!btnListen || !btnStop) return;

    btnListen.addEventListener("click", () => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        // Pause it
        window.speechSynthesis.pause();
        btnListen.innerHTML = `<i data-lucide="play" style="width:14px;height:14px;"></i> Resume`;
        lucide.createIcons();
      } else if (window.speechSynthesis.paused) {
        // Resume it
        window.speechSynthesis.resume();
        btnListen.innerHTML = `<i data-lucide="pause" style="width:14px;height:14px;"></i> Pause`;
        lucide.createIcons();
      } else {
        // Start it
        _playTTS();
      }
    });

    btnStop.addEventListener("click", () => {
      _stopTTS();
    });
  }

  function _playTTS() {
    const docId = App.getActiveDocId();
    const activeBtn = document.querySelector(".summary-toggle__btn.active");
    const length = activeBtn ? activeBtn.dataset.length : "medium";
    
    if (!_cache[docId] || !_cache[docId][length]) {
      App.toast("No summary available to read.", "error");
      return;
    }

    const data = _cache[docId][length];
    
    // Clean markdown characters for better reading
    let cleanText = data.summary
      .replace(/\*\*/g, "") // Remove bold
      .replace(/#/g, "")    // Remove headers
      .replace(/-/g, "")    // Remove bullets
      .replace(/_/g, "");   // Remove italics
      
    cleanText = `${data.title || "Summary"}. ${cleanText}`;

    currentUtterance = new SpeechSynthesisUtterance(cleanText);
    
    // Attempt to pick a decent English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith("en-") && (v.name.includes("Natural") || v.name.includes("Google")));
    if (preferredVoice) currentUtterance.voice = preferredVoice;

    currentUtterance.rate = 1.0;
    currentUtterance.pitch = 1.0;

    const btnListen = document.getElementById("btn-listen-summary");
    const btnStop = document.getElementById("btn-stop-audio");

    currentUtterance.onstart = () => {
      btnListen.innerHTML = `<i data-lucide="pause" style="width:14px;height:14px;"></i> Pause`;
      btnStop.style.display = "inline-flex";
      lucide.createIcons();
    };

    currentUtterance.onend = () => {
      _resetTTSUI();
    };

    currentUtterance.onerror = (e) => {
      console.error("TTS Error:", e);
      _resetTTSUI();
    };

    window.speechSynthesis.cancel(); // Stop anything else
    window.speechSynthesis.speak(currentUtterance);
  }

  function _stopTTS() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    _resetTTSUI();
  }

  function _resetTTSUI() {
    const btnListen = document.getElementById("btn-listen-summary");
    const btnStop = document.getElementById("btn-stop-audio");
    if (btnListen) {
      btnListen.innerHTML = `<i data-lucide="play" style="width:14px;height:14px;"></i> Listen`;
    }
    if (btnStop) {
      btnStop.style.display = "none";
    }
    if (window.lucide) window.lucide.createIcons();
  }

  // ---- Key Points ----
  function _initKeypointBtn() {
    document.getElementById("btn-gen-keypoints").addEventListener("click", () => generateKeyPoints(false));
  }

  function _initKeypointRegenerateBtn() {
    const btn = document.getElementById("btn-gen-keypoints-refresh");
    if (btn) {
      btn.addEventListener("click", () => generateKeyPoints(true));
    }
  }

  async function generateKeyPoints(force = false) {
    const docId = App.getActiveDocId();
    if (!docId) {
      App.toast("Upload a document first.", "error");
      return;
    }

    if (!force && _keypointCache[docId]) {
      _renderKeypoints(_keypointCache[docId]);
      return;
    }

    _showLoading("keypoints-content", "Extracting key points…");

    try {
      const data = await API.generateKeyPoints(docId, force);
      const points = data.keypoints || data;
      _keypointCache[docId] = points;
      _renderKeypoints(points);
      if (force) App.toast("Key points regenerated!");
    } catch (err) {
      _showError("keypoints-content", err.message);
      App.toast(err.message, "error");
    }
  }

  function _renderKeypoints(points) {
    const el = document.getElementById("keypoints-content");
    if (!points || points.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔍</div><div class="empty-state__title">No key points found</div></div>`;
      return;
    }
    el.innerHTML = `<div class="fade-in-up">${points
      .map(
        (kp, i) => `
      <div class="keypoint-item" onclick="this.classList.toggle('expanded')">
        <div class="keypoint-item__number">${i + 1}</div>
        <div class="keypoint-item__content">
          <div class="keypoint-item__text">${_escHtml(kp.point)}</div>
          <div class="keypoint-item__detail">${_escHtml(kp.detail)}</div>
        </div>
      </div>`
      )
      .join("")}</div>`;
    // Show copy button
    const copyBtn = document.getElementById("btn-copy-keypoints");
    if (copyBtn) copyBtn.style.display = "inline-flex";
  }

  // ---- Helpers ----
  function _showLoading(containerId, msg) {
    document.getElementById(containerId).innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <div class="loading-state__text">${msg}</div>
      </div>`;
  }

  function _showError(containerId, msg) {
    document.getElementById(containerId).innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">Something went wrong</div>
        <div class="empty-state__text">${_escHtml(msg)}</div>
      </div>`;
  }

  /** Very lightweight markdown-to-HTML (bold, bullets, line breaks) */
  function _md(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/^\s*[-•]\s+(.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
      .replace(/\n{2,}/g, "<br/><br/>")
      .replace(/\n/g, "<br/>");
  }

  function _escHtml(s) {
    if (!s) return "";
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function onDocumentChange(docId) {
    _stopTTS();
    const el = document.getElementById("summary-content");
    const activeBtn = document.querySelector(".summary-toggle__btn.active");
    const length = activeBtn ? activeBtn.dataset.length : "medium";

    if (_cache[docId] && _cache[docId][length]) {
      _renderSummary(_cache[docId][length]);
    } else {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📄</div>
          <div class="empty-state__title">Summary Not Generated</div>
          <div class="empty-state__text">Select a length and click the button to generate a summary for this document.</div>
        </div>`;
    }

    // Clear keypoints too
    document.getElementById("keypoints-content").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">✨</div>
        <div class="empty-state__title">Key Points</div>
        <div class="empty-state__text">Extract the most important takeaways from this text.</div>
      </div>`;
  }

  return { init, generate, generateKeyPoints, onDocumentChange };
})();

document.addEventListener("DOMContentLoaded", Summary.init);
