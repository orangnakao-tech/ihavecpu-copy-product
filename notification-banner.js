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
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes ihc-admin-notice-scroll-loop {
        0% { transform: translateX(100vw); }
        100% { transform: translateX(-100%); }
      }
      #${BANNER_ID} {
        position: fixed !important;
        z-index: 2147483647 !important;
        top: 8px !important;
        left: 0 !important;
        width: 100vw !important;
        overflow: hidden !important;
        padding: 4px 0 !important;
        pointer-events: none !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
      }
      #${BANNER_ID} span {
        display: inline-block !important;
        width: max-content !important;
        white-space: nowrap !important;
        background: transparent !important;
        color: #ff1f1f !important;
        font: 800 28px/1.4 "Kanit", "Segoe UI", Tahoma, sans-serif !important;
        letter-spacing: 0.03em !important;
        text-shadow:
          -1.5px -1.5px 0 rgba(255, 255, 255, 0.92),
           1.5px -1.5px 0 rgba(255, 255, 255, 0.92),
          -1.5px  1.5px 0 rgba(255, 255, 255, 0.92),
           1.5px  1.5px 0 rgba(255, 255, 255, 0.92),
           0 3px 12px rgba(0, 0, 0, 0.45),
           0 0 18px rgba(255, 31, 31, 0.55) !important;
        will-change: transform;
        animation: ihc-admin-notice-scroll-loop 10s linear 3 forwards !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);

    const banner = document.createElement("div");
    banner.id = BANNER_ID;
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "assertive");
    const text = document.createElement("span");
    text.textContent = `📢 ${message.trim().slice(0, 240)}`;
    banner.appendChild(text);
    (document.body || document.documentElement).appendChild(banner);

    text.addEventListener("animationend", () => {
      banner.remove();
    });
    window.setTimeout(() => banner.remove(), 31_000);
  }

  const listener = (message, _sender, sendResponse) => {
    if (message?.type === "DISPLAY_ADMIN_UPDATE_NOTICE") {
      showUpdateNotice(message.message);
      if (typeof sendResponse === "function") {
        sendResponse({ ok: true });
      }
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  window.__ihcAdminNoticeListener = listener;
})();
