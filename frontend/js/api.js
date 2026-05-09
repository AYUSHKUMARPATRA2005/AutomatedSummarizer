/* ============================================================
   API Client — Handles all communication with the Flask backend
   ============================================================ */

const API = (() => {
  const BASE = "/api";

  async function _fetch(url, options = {}) {
    try {
      const res = await fetch(url, options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      return data;
    } catch (err) {
      if (err.message === "Failed to fetch") {
        throw new Error("Cannot reach the server. Make sure the backend is running on port 5000.");
      }
      throw err;
    }
  }

  return {
    /** Upload a PDF or TXT file */
    uploadFile(file) {
      const form = new FormData();
      form.append("file", file);
      return _fetch(`${BASE}/upload`, { method: "POST", body: form });
    },

    /** Submit pasted text */
    submitText(text, title = "Pasted Text") {
      return _fetch(`${BASE}/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, title }),
      });
    },

    /** Process YouTube URL */
    uploadYouTube(url) {
      return _fetch(`${BASE}/upload/youtube`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
    },

    /** List all documents */
    listDocuments() {
      return _fetch(`${BASE}/documents`);
    },

    /** Get single document info */
    getDocument(docId) {
      return _fetch(`${BASE}/documents/${docId}`);
    },

    /** Generate summary */
    generateSummary(docId, length = "medium", force = false) {
      return _fetch(`${BASE}/generate/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, length, force }),
      });
    },

    /** Generate key points */
    generateKeyPoints(docId, force = false) {
      return _fetch(`${BASE}/generate/keypoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, force }),
      });
    },

    /** Generate flashcards */
    generateFlashcards(docId, force = false) {
      return _fetch(`${BASE}/generate/flashcards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, force }),
      });
    },

    /** Generate quiz */
    generateQuiz(docId, force = false) {
      return _fetch(`${BASE}/generate/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, force }),
      });
    },

    /** Generate Q&A */
    generateQA(docId, force = false) {
      return _fetch(`${BASE}/generate/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, force }),
      });
    },

    /** Chat with document */
    chat(docId, message, history = []) {
      return _fetch(`${BASE}/generate/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, message, history }),
      });
    },

    /** Generate mind map */
    generateMindmap(docId, force = false) {
      return _fetch(`${BASE}/generate/mindmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, force }),
      });
    },

    /** Generate highlights */
    generateHighlights(docId) {
      return _fetch(`${BASE}/generate/highlights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId }),
      });
    },

    /** Get notes */
    getNotes(docId) {
      return _fetch(`${BASE}/notes/${docId}`);
    },

    /** Save notes */
    saveNotes(docId, content) {
      return _fetch(`${BASE}/notes/${docId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    },

    /** Export document data */
    exportData(docId) {
      return _fetch(`${BASE}/documents/${docId}/export`);
    },

    /** Delete document */
    deleteDocument(docId) {
      return _fetch(`${BASE}/documents/${docId}`, {
        method: "DELETE"
      });
    },

    /** Health check */
    health() {
      return _fetch(`${BASE}/health`);
    },
  };
})();
