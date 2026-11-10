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

  // Real-time direct push listener via SSE:
  // Active browser tab listens directly to ntfy (< 300ms latency)
  const NTFY_STREAM_TOPIC = "ihc_ext_stat_9f4b2c8e1d7a6053";
  const NTFY_STREAM_URLS = [
    `https://ntfy.envs.net/${NTFY_STREAM_TOPIC}/sse`,
    `https://ntfy.sh/${NTFY_STREAM_TOPIC}/sse`
  ];
  let ntfySource = null;
  let currentServerIndex = 0;
  const seenNoticeIds = new Set();

  function startLiveNoticeStream() {
    if (ntfySource || document.hidden) return;
    try {
      const streamUrl = NTFY_STREAM_URLS[currentServerIndex % NTFY_STREAM_URLS.length];
      ntfySource = new EventSource(streamUrl);
      ntfySource.onmessage = (event) => {
        try {
          if (!event.data) return;
          const ev = JSON.parse(event.data);
          if (ev.event === "message" && typeof ev.message === "string") {
            const notice = JSON.parse(ev.message);
            if (notice && (notice.type === "admin-update-notice" || notice.type === "admin-force-update")) {
              const dedupKey = `${notice.sentAt || ev.id}_${notice.targetMachineId}_${notice.forceUpdate || false}`;
              if (seenNoticeIds.has(dedupKey)) return;
              seenNoticeIds.add(dedupKey);

              // Ask background.js to verify target machine and trigger background update immediately
              chrome.runtime.sendMessage(
                { type: "CHECK_TARGET_AND_DISPLAY_NOTICE", notice },
                (response) => {
                  if (chrome.runtime?.lastError) return;
                  // Only display banner if NOT a silent update and has visible message
                  if (response?.shouldShow && response?.message && !notice.silent && !notice.forceUpdate) {
                    showUpdateNotice(response.message);
                  }
                }
              );
            }
          }
        } catch {}
      };
      ntfySource.onerror = () => {
        if (ntfySource) {
          ntfySource.close();
          ntfySource = null;
        }
        currentServerIndex = (currentServerIndex + 1) % NTFY_STREAM_URLS.length;
        setTimeout(startLiveNoticeStream, 8000);
      };
    } catch {}
  }

  function stopLiveNoticeStream() {
    if (ntfySource) {
      ntfySource.close();
      ntfySource = null;
    }
  }

  // Continuous keep-alive heartbeat:
  // While any supported tab (Zaapi, AdMeta, IHC) is open, send heartbeat to background every 40s
  // so the machine NEVER shows offline on the monitoring dashboard
  let lastPingTime = 0;
  function sendKeepAlivePing(force = false) {
    const now = Date.now();
    if (!force && now - lastPingTime < 35000) return;
    lastPingTime = now;
    try {
      chrome.runtime.sendMessage({ type: "KEEP_ALIVE_HEARTBEAT" }, () => {
        if (chrome.runtime?.lastError) { /* ignore */ }
      });
    } catch {}
  }

  sendKeepAlivePing(true);
  setInterval(() => sendKeepAlivePing(false), 40000);

  window.addEventListener("focus", () => sendKeepAlivePing(false), { passive: true });
  window.addEventListener("click", () => sendKeepAlivePing(false), { passive: true });

  startLiveNoticeStream();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopLiveNoticeStream();
    } else {
      startLiveNoticeStream();
      sendKeepAlivePing(true);
    }
  });

  const listener = (message, _sender, sendResponse) => {
    if (message?.type === "DISPLAY_ADMIN_UPDATE_NOTICE") {
      if (message.silent !== true && !message.forceUpdate && message.message) {
        showUpdateNotice(message.message);
      }
      if (typeof sendResponse === "function") {
        sendResponse({ ok: true });
      }
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  window.__ihcAdminNoticeListener = listener;
})();
