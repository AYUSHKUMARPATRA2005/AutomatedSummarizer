/* ============================================================
   App — Core application logic: tabs, theme, document state, toasts
   ============================================================ */

const App = (() => {
  // ---- State ----
  let activeTab = "home";
  let activeDocId = null;
  let documents = [];  // { id, filename, stats }

  // ---- DOM refs ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ---- Init ----
  async function init() {
    _initTabs();
    _initTheme();
    _initSidebarToggle();
    _initExport();
    
    // Load existing documents (silently — don't switch tabs)
    try {
      const docs = await API.listDocuments();
      docs.forEach(doc => addDocument(doc, true)); // silent=true keeps home tab
    } catch (err) {
      console.error("Failed to load documents:", err);
    }

    console.log("📚 SnapLearn app initialized");
  }

  // ---- Tab System ----
  function _initTabs() {
    $$(".tab-nav__item").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(tab) {
    activeTab = tab;
    // Update buttons
    $$(".tab-nav__item").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    // Update panels
    $$(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${tab}`));
  }

  // ---- Theme Toggle ----
  function _initTheme() {
    const saved = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", saved);

    $("#theme-toggle").addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }

  // ---- Sidebar Mobile Toggle ----
  function _initSidebarToggle() {
    const toggle = $("#sidebar-toggle");
    const sidebar = $("#sidebar");
    if (toggle && sidebar) {
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        sidebar.classList.toggle("open");
      });
      // Close on outside click
      document.addEventListener("click", (e) => {
        if (sidebar.classList.contains("open") && !sidebar.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
          sidebar.classList.remove("open");
        }
      });
    }
  }

  // ---- Document Management ----
  function setActiveDocument(docId, silent = false) {
    activeDocId = docId;
    // Highlight in sidebar
    $$(".sidebar__doc-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.docId === docId);
    });
    // Enable generate buttons & copy buttons
    $$("[id^='btn-gen-']").forEach((b) => (b.disabled = false));
    $("#btn-gen-summary-refresh") && ($("#btn-gen-summary-refresh").disabled = false);
    // Show export section
    const exportSec = $("#export-section");
    if (exportSec) exportSec.style.display = "block";
    // Update doc info bar
    const doc = documents.find((d) => d.id === docId);
    if (doc) {
      const info = $("#tab-doc-info");
      info.innerHTML = `
        <span class="stat-pill"><i data-lucide="file-text" style="width:11px;height:11px;"></i> ${_truncate(doc.filename, 24)}</span>
        <span class="stat-pill">${doc.stats?.word_count?.toLocaleString() || "—"} words</span>
        <span class="stat-pill">~${doc.stats?.estimated_read_time_minutes || "?"}m read</span>
      `;
      lucide.createIcons({ nameAttr: "data-lucide", attrs: {} });
    }

    // Notify modules to load/clear their content for the new doc
    if (typeof Summary !== "undefined" && Summary.onDocumentChange) Summary.onDocumentChange(docId);
    if (typeof Flashcards !== "undefined" && Flashcards.onDocumentChange) Flashcards.onDocumentChange(docId);
    if (typeof Quiz !== "undefined" && Quiz.onDocumentChange) Quiz.onDocumentChange(docId);
    if (typeof QA !== "undefined" && QA.onDocumentChange) QA.onDocumentChange(docId);
    if (typeof MindMap !== "undefined" && MindMap.onDocumentChange) MindMap.onDocumentChange(docId);
    // Chat could be added here too
  }

  // silent=true: just registers the doc without switching tabs (used on init)
  function addDocument(doc, silent = false) {
    documents.push(doc);
    _renderDocList();
    setActiveDocument(doc.id || doc.document_id, silent);
  }

  function _renderDocList() {
    const list = $("#doc-list");
    const hint = $("#no-docs-hint");
    if (documents.length === 0) {
      list.innerHTML = "";
      hint.style.display = "";
      return;
    }
    hint.style.display = "none";
    list.innerHTML = documents
      .map(
        (d) => `
      <li class="sidebar__doc-item" data-doc-id="${d.id}">
        <div class="sidebar__doc-item-main">
          <div class="sidebar__doc-icon">
            <i data-lucide="file-text" style="width:13px;height:13px;"></i>
          </div>
          <span class="sidebar__doc-name">${_truncate(d.filename, 22)}</span>
        </div>
        <button class="sidebar__doc-delete" data-doc-id="${d.id}" title="Delete document">
          <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
        </button>
      </li>`
      )
      .join("");
    lucide.createIcons();

    // click handlers
    $$(".sidebar__doc-item").forEach((el) => {
      el.addEventListener("click", (e) => {
        // Only trigger if not clicking the delete button
        if (e.target.closest(".sidebar__doc-delete")) return;
        setActiveDocument(el.dataset.docId);
      });
    });

    $$(".sidebar__doc-delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const docId = btn.dataset.docId;
        if (confirm("Are you sure you want to delete this document and all its study data?")) {
          try {
            await API.deleteDocument(docId);
            toast("Document deleted successfully");
            documents = documents.filter((d) => d.id !== docId);
            _renderDocList();
            if (activeDocId === docId) {
              activeDocId = null;
              $("#export-section").style.display = "none";
              $("#tab-doc-info").innerHTML = "<span>No document selected</span>";
              // Switch to upload tab
              $$(".nav__item")[0].click();
            }
          } catch (err) {
            toast(err.message, "error");
          }
        }
      });
    });
  }

  // ---- Toast System ----
  function toast(message, type = "success") {
    const container = $("#toast-container");
    const icon = type === "success" ? "check-circle" : "alert-circle";
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.innerHTML = `<i data-lucide="${icon}" style="width:16px;height:16px;flex-shrink:0;"></i> ${message}`;
    container.appendChild(el);
    lucide.createIcons();
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-10px)";
      el.style.transition = "all 0.3s ease";
      setTimeout(() => el.remove(), 350);
    }, 4000);
  }

  // ---- Export System ----
  function _initExport() {
    const btnPdf = $("#btn-export-pdf");
    const btnCsv = $("#btn-export-csv");
    if (!btnPdf || !btnCsv) return;

    btnPdf.addEventListener("click", () => _handleExport("pdf"));
    btnCsv.addEventListener("click", () => _handleExport("csv"));
  }

  async function _handleExport(type) {
    if (!activeDocId) {
      toast("Select a document to export.", "error");
      return;
    }

    try {
      toast("Preparing export...", "success");
      let data = await API.exportData(activeDocId);
      
      let content = "";
      let filename = "";
      let mimeType = "";

      const cleanFilename = (data.filename || "document").replace(/[^a-z0-9]/gi, '_').toLowerCase();

      if (type === "pdf") {
        filename = `${cleanFilename}_study_guide.pdf`;
        
        // Auto-generate missing contents
        let missing = [];
        if (!data.summary) missing.push("Summary");
        if (!data.keypoints || data.keypoints.length === 0) missing.push("Key Points");
        if (!data.qa || data.qa.length === 0) missing.push("Q&A");
        
        if (missing.length > 0) {
          toast(`Generating missing content for PDF: ${missing.join(', ')}... This might take a moment.`, "success");
          try {
            if (!data.summary) await API.generateSummary(activeDocId);
            if (!data.keypoints || data.keypoints.length === 0) await API.generateKeyPoints(activeDocId);
            if (!data.qa || data.qa.length === 0) await API.generateQA(activeDocId);
            // Re-fetch the complete data
            data = await API.exportData(activeDocId);
          } catch (e) {
            console.error("Auto-generate failed:", e);
            toast("Some content could not be generated.", "error");
          }
        }

        const esc = (s) => s ? s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') : "";
        
        content = `
<div id="pdf-content" style="padding: 20px; font-family: 'Inter', system-ui, sans-serif; color: #334155;">
  <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
    <h1 style="color: #0f172a; margin: 0;">${esc(data.filename)}</h1>
    <p style="color: #64748b; margin-top: 5px;">SnapLearn AI Study Guide</p>
  </div>`;
        
        if (data.summary) {
          content += `<h2 style="color: #6366f1; border-bottom: 1px solid #e2e8f0;">Summary</h2>
          <div style="margin-bottom: 20px;">${data.summary.content.split('\\n').map(p => p.trim() ? `<p>${esc(p)}</p>` : '').join('')}</div>`;
        }

        if (data.keypoints && data.keypoints.length > 0) {
          content += `<h2 style="color: #6366f1; border-bottom: 1px solid #e2e8f0; margin-top: 30px;">Key Points</h2>
          <div style="margin-bottom: 20px;">`;
          data.keypoints.forEach((kp, i) => {
            content += `<div style="margin-bottom: 10px; padding-left: 10px; border-left: 3px solid #6366f1;"><strong>${i + 1}. ${esc(kp.point)}</strong><p style="margin: 3px 0 0 0;">${esc(kp.detail)}</p></div>`;
          });
          content += `</div>`;
        }

        if (data.qa && data.qa.length > 0) {
          content += `<h2 style="color: #6366f1; border-bottom: 1px solid #e2e8f0; margin-top: 30px;">Study Q&A</h2>
          <div style="margin-bottom: 20px;">`;
          data.qa.forEach((q, i) => {
            content += `<div style="margin-bottom: 15px; background: #f1f5f9; padding: 10px; border-radius: 6px;"><div style="font-weight: bold; color: #0f172a; margin-bottom: 5px;">Q${i + 1}: ${esc(q.question)}</div><div>${esc(q.answer)}</div></div>`;
          });
          content += `</div>`;
        }
        
        content += `</div>`;
        
        // Hide a div in the DOM to render the PDF
        const container = document.createElement("div");
        container.innerHTML = content;
        
        // Use html2pdf
        const opt = {
          margin:       10,
          filename:     filename,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2 },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        toast("Building PDF document...", "success");
        html2pdf().set(opt).from(container.firstElementChild).save().then(() => {
          toast(`Downloaded ${filename} successfully!`);
        }).catch(err => {
          toast(`PDF generation failed: ${err.message}`, "error");
        });
        
        return; // Early return because html2pdf handles the download
      } else if (type === "csv") {
        filename = `${cleanFilename}_flashcards.csv`;
        mimeType = "text/csv";
        
        if (!data.flashcards || data.flashcards.length === 0) {
          toast("No flashcards to export. Generate them first!", "error");
          return;
        }

        // Standard CSV format for Anki: Front,Back
        content += `"Front","Back"\n`;
        data.flashcards.forEach(fc => {
          const front = fc.front.replace(/"/g, '""'); // Escape quotes
          const back = fc.back.replace(/"/g, '""');
          content += `"${front}","${back}"\n`;
        });
      }

      // Create blob and download for CSV
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast(`Exported ${filename} successfully!`);
    } catch (err) {
      toast(`Export failed: ${err.message}`, "error");
    }
  }

  // ---- Helpers ----
  function _truncate(str, max) {
    if (!str) return "";
    return str.length > max ? str.slice(0, max) + "…" : str;
  }

  function getActiveDocId() {
    return activeDocId;
  }

  return { init, switchTab, addDocument, setActiveDocument, getActiveDocId, toast };
})();

// Boot
document.addEventListener("DOMContentLoaded", App.init);
