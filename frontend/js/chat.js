/* ============================================================
   Chat — Real-time conversation with document
   ============================================================ */

const Chat = (() => {
  let _history = []; // { role: "user"|"assistant", content: "..." }
  let _isTyping = false;

  function init() {
    _initInput();
    _initClear();
  }

  function _initInput() {
    const input = document.getElementById("chat-input");
    const btn = document.getElementById("btn-send-chat");

    input.addEventListener("input", () => {
      btn.disabled = input.value.trim() === "" || _isTyping;
      // Auto-resize textarea
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 150) + "px";
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !btn.disabled) {
        e.preventDefault();
        _sendMessage();
      }
    });

    btn.addEventListener("click", _sendMessage);
  }

  function _initClear() {
    document.getElementById("btn-clear-chat").addEventListener("click", () => {
      _history = [];
      _renderMessages();
      App.toast("Chat history cleared.");
    });
  }

  async function _sendMessage() {
    const docId = App.getActiveDocId();
    if (!docId) {
      App.toast("Upload a document first.", "error");
      return;
    }

    const input = document.getElementById("chat-input");
    const message = input.value.trim();
    if (!message || _isTyping) return;

    // Add user message to UI & history
    _addMessage("user", message);
    input.value = "";
    input.style.height = "auto";
    document.getElementById("btn-send-chat").disabled = true;

    _isTyping = true;
    _showTyping();

    try {
      const data = await API.chat(docId, message, _history);
      _hideTyping();
      _addMessage("assistant", data.response);
    } catch (err) {
      _hideTyping();
      App.toast(err.message, "error");
    } finally {
      _isTyping = false;
      document.getElementById("btn-send-chat").disabled = input.value.trim() === "";
    }
  }

  function _addMessage(role, content) {
    _history.push({ role, content });
    _renderMessages();
  }

  function _renderMessages() {
    const el = document.getElementById("chat-messages");
    if (_history.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">💬</div>
          <div class="empty-state__title">Start a conversation</div>
          <div class="empty-state__text">Ask me anything about the document. I'll use the content to answer your questions.</div>
        </div>`;
      return;
    }

    el.innerHTML = _history
      .map(
        (msg) => `
      <div class="chat-bubble chat-bubble--${msg.role} animate-fade-in">
        <div class="chat-bubble__avatar">${msg.role === "user" ? "U" : "AI"}</div>
        <div class="chat-bubble__content">${_md(msg.content)}</div>
      </div>`
      )
      .join("");
    
    _scrollToBottom();
  }

  function _showTyping() {
    const el = document.getElementById("chat-messages");
    const typing = document.createElement("div");
    typing.id = "typing-indicator";
    typing.className = "chat-bubble chat-bubble--assistant";
    typing.innerHTML = `
      <div class="chat-bubble__avatar">AI</div>
      <div class="chat-bubble__content">
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>`;
    el.appendChild(typing);
    _scrollToBottom();
  }

  function _hideTyping() {
    const el = document.getElementById("typing-indicator");
    if (el) el.remove();
  }

  function _scrollToBottom() {
    const el = document.getElementById("chat-messages");
    el.scrollTop = el.scrollHeight;
  }

  /** Enhanced markdown helper for better structure */
  function _md(text) {
    if (!text) return "";
    
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // Headers
      .replace(/^### (.*$)/gm, "<h3>$1</h3>")
      .replace(/^## (.*$)/gm, "<h2>$1</h2>")
      .replace(/^# (.*$)/gm, "<h1>$1</h1>")
      // Bold & Italic
      .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      // Bullet points (handle multi-line lists better)
      .replace(/^\s*[-•*]\s+(.+)$/gm, "<li>$1</li>");
    
    // Wrap groups of <li> in <ul>
    html = html.replace(/(<li>.*<\/li>)/gs, (match) => `<ul>${match}</ul>`);
    // Fix multiple <ul> being created for adjacent items
    html = html.replace(/<\/ul>\s*<ul>/g, "");
    
    // Paragraphs and line breaks
    html = html.replace(/\n{2,}/g, "</p><p>");
    html = html.replace(/\n/g, "<br/>");
    
    return `<p>${html}</p>`;
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", Chat.init);
