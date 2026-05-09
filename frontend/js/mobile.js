/* ============================================================
   Mobile — Bottom nav sync, touch swipe on flashcards,
             pull-to-refresh hint, misc mobile UX
   ============================================================ */

const Mobile = (() => {

  // ---- Bottom Nav Sync ----
  // The bottom nav only shows 4 tabs (home, summary, cards, chat)
  // When any tab switches via App.switchTab, we sync the bottom nav
  const BNAV_TABS = ['home', 'summary', 'flashcards', 'chat'];

  function _syncBottomNav(tab) {
    document.querySelectorAll('.bottom-nav__item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tab);
    });
  }

  function _initBottomNav() {
    document.querySelectorAll('.bottom-nav__item').forEach(item => {
      item.addEventListener('click', () => {
        App.switchTab(item.dataset.tab);
      });
    });
  }

  // ---- Touch Swipe on Flashcards ----
  let _touchStartX = 0;
  let _touchStartY = 0;
  const SWIPE_THRESHOLD = 50;

  function _initFlashcardSwipe() {
    // We attach to the document and check if flashcards panel is active
    document.addEventListener('touchstart', (e) => {
      const fc = document.getElementById('fc-wrapper');
      if (!fc || !fc.contains(e.target)) return;
      _touchStartX = e.touches[0].clientX;
      _touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const fc = document.getElementById('fc-wrapper');
      if (!fc) return;
      const panel = document.getElementById('panel-flashcards');
      if (!panel || !panel.classList.contains('active')) return;

      const dx = e.changedTouches[0].clientX - _touchStartX;
      const dy = e.changedTouches[0].clientY - _touchStartY;

      // Only horizontal swipe (not vertical scroll)
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;

      if (dx < 0) {
        // Swipe left → next card
        document.getElementById('fc-next')?.click();
      } else {
        // Swipe right → prev card
        document.getElementById('fc-prev')?.click();
      }
    }, { passive: true });
  }

  // ---- Show copy buttons when content is available ----
  // Called externally via Mobile.showCopyBtn(id)
  function showCopyBtn(btnId) {
    const btn = document.getElementById(btnId);
    if (btn) btn.style.display = 'inline-flex';
  }

  // ---- More tabs sheet on mobile ----
  // A small sheet that opens to let user access Quiz, KeyPoints, MindMap
  function _initMoreSheet() {
    const moreBtn = document.getElementById('bnav-more');
    if (!moreBtn) return;
    moreBtn.addEventListener('click', () => {
      const sheet = document.getElementById('more-sheet');
      if (sheet) {
        sheet.classList.toggle('open');
      }
    });
    // Close sheet when a tab is picked
    document.querySelectorAll('.more-sheet__item').forEach(item => {
      item.addEventListener('click', () => {
        App.switchTab(item.dataset.tab);
        document.getElementById('more-sheet')?.classList.remove('open');
      });
    });
    // Close on outside tap
    document.addEventListener('touchstart', (e) => {
      const sheet = document.getElementById('more-sheet');
      const btn = document.getElementById('bnav-more');
      if (sheet && sheet.classList.contains('open') &&
          !sheet.contains(e.target) && !btn.contains(e.target)) {
        sheet.classList.remove('open');
      }
    }, { passive: true });
  }

  // ---- Patch App.switchTab to sync bottom nav ----
  function _patchSwitchTab() {
    const original = App.switchTab.bind(App);
    App.switchTab = function(tab) {
      original(tab);
      _syncBottomNav(tab);
    };
  }

  function init() {
    _initBottomNav();
    _initFlashcardSwipe();
    _initMoreSheet();
    _patchSwitchTab();
    // Sync on load with default tab
    _syncBottomNav('home');
  }

  return { init, showCopyBtn };
})();

document.addEventListener('DOMContentLoaded', Mobile.init);
