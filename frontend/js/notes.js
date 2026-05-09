/* ============================================================
   Notes Module — Handles interactive document notes & highlights
   ============================================================ */

const Notes = (() => {
  let _currentDocId = null;
  let _isModified = false;

  function init() {
    _initListeners();
  }

  function _initListeners() {
    const saveBtn = document.getElementById("btn-save-notes");
    const highlightBtn = document.getElementById("btn-gen-highlights");
    const editor = document.getElementById("notes-editor");

    if (saveBtn) {
      saveBtn.addEventListener("click", save);
    }

    if (highlightBtn) {
      highlightBtn.addEventListener("click", generateHighlights);
    }

    if (editor) {
      // Track modifications to enable save button
      editor.addEventListener("input", () => {
        if (!_isModified) {
          _isModified = true;
          saveBtn.disabled = false;
        }
      });
    }
  }

  async function onDocumentChange(docId) {
    _currentDocId = docId;
    _isModified = false;
    
    const editor = document.getElementById("notes-editor");
    const saveBtn = document.getElementById("btn-save-notes");
    const highlightBtn = document.getElementById("btn-gen-highlights");

    if (!docId) {
      editor.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📝</div>
          <div class="empty-state__title">No notes yet</div>
          <div class="empty-state__text">Upload a document to view its content here.</div>
        </div>`;
      saveBtn.disabled = true;
      highlightBtn.disabled = true;
      return;
    }

    saveBtn.disabled = true;
    highlightBtn.disabled = false;
    
    editor.innerHTML = `<div class="spinner spinner--sm"></div> Loading content...`;

    try {
      const data = await API.getNotes(docId);
      editor.innerHTML = data.content || "No content found.";
    } catch (err) {
      console.error("Failed to load notes:", err);
      editor.innerHTML = `<div class="error-state">Failed to load content: ${err.message}</div>`;
    }
  }

  async function generateHighlights() {
    if (!_currentDocId) return;

    const btn = document.getElementById("btn-gen-highlights");
    const editor = document.getElementById("notes-editor");
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `<div class="spinner spinner--sm"></div> Highlighting...`;

    try {
      const data = await API.generateHighlights(_currentDocId);
      const terms = data.terms || [];

      if (terms.length === 0) {
        App.toast("AI couldn't identify specific keywords to highlight.", "info");
        return;
      }

      _applyHighlights(terms);
      _isModified = true;
      document.getElementById("btn-save-notes").disabled = false;
      App.toast(`Successfully highlighted ${terms.length} key terms!`);
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  function _applyHighlights(terms) {
    const editor = document.getElementById("notes-editor");
    let content = editor.innerHTML;

    // To prevent messy nested highlights, we strip existing marks first
    content = content.replace(/<mark class="ai-highlight">|<\/mark>/g, "");

    // Sort terms by length (descending) to avoid partial matches interfering with longer terms
    const sortedTerms = [...terms].sort((a, b) => b.length - a.length);

    sortedTerms.forEach(term => {
      // Escape term for regex
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Case-insensitive replacement that preserves original casing
      const regex = new RegExp(`\\b(${escaped})\\b`, "gi");
      content = content.replace(regex, '<mark class="ai-highlight">$1</mark>');
    });

    editor.innerHTML = content;
  }

  async function save() {
    if (!_currentDocId || !_isModified) return;

    const btn = document.getElementById("btn-save-notes");
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `<div class="spinner spinner--sm"></div> Saving...`;

    try {
      const content = document.getElementById("notes-editor").innerHTML;
      await API.saveNotes(_currentDocId, content);
      _isModified = false;
      btn.disabled = true;
      App.toast("Notes saved successfully!");
    } catch (err) {
      App.toast(err.message, "error");
      btn.disabled = false;
    } finally {
      btn.innerHTML = originalText;
    }
  }

  return { init, onDocumentChange, save };
})();

document.addEventListener("DOMContentLoaded", Notes.init);
