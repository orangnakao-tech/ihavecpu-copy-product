(() => {
  const BANNER_ID = "ihc-admin-update-notice";
  const STYLE_ID = "ihc-admin-update-notice-style";
  const previousListener = window.__ihcAdminNoticeListener;
  if (previousListener) {
    try {
      chrome.runtime.onMessage.removeListener(previousListener);
    } catch (error) {
      console.warn("Could not remove the previous admin-notice listener:", error);
    }
  }

  function showUpdateNotice(message) {
    if (typeof message !== "string" || !message.trim()) return;

    document.getElementById(BANNER_ID)?.remove();
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        @keyframes ihc-admin-notice-move-right {
          from { transform: translateX(-100%); }
          to { transform: translateX(100vw); }
        }
        #${BANNER_ID} {
          position: fixed;
          z-index: 2147483647;
          top: 0;
          left: 0;
          width: 100%;
          overflow: hidden;
          padding: 8px 0;
          pointer-events: none;
          background: rgba(36, 0, 0, .28);
          border-bottom: 1px solid rgba(255, 40, 40, .18);
        }
        #${BANNER_ID} span {
          display: block;
          width: max-content;
          white-space: nowrap;
          color: rgba(255, 68, 68, .78);
          font: 600 15px/1.35 "Segoe UI", sans-serif;
          letter-spacing: .04em;
          text-shadow: 0 0 10px rgba(255, 0, 0, .28);
          animation: ihc-admin-notice-move-right 24s linear forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          #${BANNER_ID} span { animation-duration: 8s; }
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    const banner = document.createElement("div");
    banner.id = BANNER_ID;
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "assertive");
    const text = document.createElement("span");
    text.textContent = message.trim().slice(0, 240);
    banner.appendChild(text);
    (document.body || document.documentElement).appendChild(banner);
    window.setTimeout(() => banner.remove(), 25_000);
  }

  const listener = (message) => {
    if (message?.type === "DISPLAY_ADMIN_UPDATE_NOTICE") {
      showUpdateNotice(message.message);
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  window.__ihcAdminNoticeListener = listener;
})();
