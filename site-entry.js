/* Start each visit at the cover; in-page navigation and saved drafts stay independent. */
(function () {
  'use strict';
  let interacted = false;
  function startAtCover() {
    try {
      history.scrollRestoration = 'manual';
      if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
    } catch (_) { /* Local file previews may restrict history updates. */ }
    window.scrollTo({top: 0, left: 0, behavior: 'instant'});
  }
  startAtCover();
  for (const type of ['pointerdown', 'touchstart', 'wheel', 'keydown', 'click']) {
    window.addEventListener(type, () => { interacted = true; }, {capture: true, passive: true});
  }
  window.addEventListener('pageshow', event => {
    // A slow first load must never pull someone back after they have started browsing.
    if (!event.persisted && interacted) return;
    if (event.persisted) {
      document.getElementById('siteQrDialog')?.close();
      document.activeElement?.blur();
    }
    startAtCover();
    interacted = false;
  });
  document.addEventListener('DOMContentLoaded', () => {
    const dialog = document.getElementById('siteQrDialog');
    document.getElementById('openSiteQr').addEventListener('click', () => dialog.showModal());
  }, {once: true});
})();
