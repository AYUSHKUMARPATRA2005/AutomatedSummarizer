/* ============================================================
   Upload — File drag-drop & text paste handling
   ============================================================ */

const Upload = (() => {
  function init() {
    _initFileDrop();
    _initTextPaste();
  }

  // ---- File Upload / Drag & Drop ----
  function _initFileDrop() {
    const zone = document.getElementById("upload-zone");
    const input = document.getElementById("file-input");

    // Drag events
    ["dragenter", "dragover"].forEach((evt) =>
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.add("drag-over");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.remove("drag-over");
      })
    );

    zone.addEventListener("drop", (e) => {
      const file = e.dataTransfer.files[0];
      if (file) _handleFile(file);
    });

    input.addEventListener("change", () => {
      if (input.files[0]) _handleFile(input.files[0]);
      input.value = "";
    });
  }

  async function _handleFile(file) {
    const validExts = ["pdf", "txt"];
    const ext = file.name.split(".").pop().toLowerCase();
    if (!validExts.includes(ext)) {
      App.toast("Please upload a PDF or TXT file.", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      App.toast("File is too large. Maximum 10 MB.", "error");
      return;
    }

    _showProgress("Uploading file…");
    _animateBar(30);
    try {
      const result = await API.uploadFile(file);
      _animateBar(100);
      setTimeout(() => {
        _hideProgress();
        App.addDocument({
          id: result.document_id,
          filename: result.filename,
          stats: result.stats,
        });
        App.toast(`"${result.filename}" uploaded successfully!`);
        App.switchTab("summary");
        // Auto-generate summary
        Summary.generate();
      }, 400);
    } catch (err) {
      _hideProgress();
      App.toast(err.message, "error");
    }
  }

  // ---- Text Paste ----
  function _initTextPaste() {
    const textarea = document.getElementById("paste-text");
    const btn = document.getElementById("btn-process-text");
    const counter = document.getElementById("char-count");

    textarea.addEventListener("input", () => {
      const len = textarea.value.trim().length;
      counter.textContent = `${len.toLocaleString()} characters`;
      btn.disabled = len < 50;
    });

    btn.addEventListener("click", () => _handlePaste());
  }

  async function _handlePaste() {
    const textarea = document.getElementById("paste-text");
    const text = textarea.value.trim();
    if (text.length < 50) {
      App.toast("Please enter at least 50 characters.", "error");
      return;
    }

    _showProgress("Processing text…");
    _animateBar(40);
    try {
      const result = await API.submitText(text);
      _animateBar(100);
      setTimeout(() => {
        _hideProgress();
        textarea.value = "";
        document.getElementById("char-count").textContent = "0 characters";
        document.getElementById("btn-process-text").disabled = true;
        App.addDocument({
          id: result.document_id,
          filename: result.filename,
          stats: result.stats,
        });
        App.toast("Text processed successfully!");
        App.switchTab("summary");
        Summary.generate();
      }, 400);
    } catch (err) {
      _hideProgress();
      App.toast(err.message, "error");
    }
  }



  // ---- Progress UI ----
  function _showProgress(msg) {
    const el = document.getElementById("upload-progress");
    document.getElementById("upload-status").textContent = msg;
    el.style.display = "block";
    document.getElementById("upload-bar").style.width = "0%";
  }
  function _hideProgress() {
    document.getElementById("upload-progress").style.display = "none";
  }
  function _animateBar(pct) {
    requestAnimationFrame(() => {
      document.getElementById("upload-bar").style.width = pct + "%";
    });
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", Upload.init);
