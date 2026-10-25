const statusEl = document.getElementById("status");
const verBadgeEl = document.getElementById("version-badge");
const updateBoxEl = document.getElementById("update-box");
const updateTextEl = document.getElementById("update-text");
const reloadBtnEl = document.getElementById("reload-now");
const releaseNotesVerEl = document.getElementById("release-notes-ver");
const releaseNotesItemsEl = document.getElementById("release-notes-items");

const DEFAULT_RELEASE_NOTES = [
  "+ เคส (CASE) ไม่ต้องบวกค่าส่ง 50 บาท แม้ราคาต่ำกว่า 5,000 บาท",
  "+ อัปเดตอัตโนมัติเบื้องหลังเต็มรูปแบบ (Silent Background Auto-Update)",
  "+ ปิดกล่องแจ้งเตือนอัปเดตและ Badge บนหน้าเว็บ ไม่ต้องกดอัปเดตเอง",
  "+ แก้ไข Error Extension context invalidated บน Zaapi"
];

const NOTE_PALETTE = [
  { bg: "#fff7ed", text: "#c2410c", badge: "#ea580c" },
  { bg: "#eff6ff", text: "#1d4ed8", badge: "#2563eb" },
  { bg: "#f0fdf4", text: "#15803d", badge: "#16a34a" },
  { bg: "#faf5ff", text: "#6d28d9", badge: "#7c3aed" }
];

function renderReleaseNotes(versionStr, notes) {
  if (releaseNotesVerEl) {
    releaseNotesVerEl.textContent = String(versionStr || chrome.runtime.getManifest().version).replace(/^v/i, "");
  }
  if (!releaseNotesItemsEl) return;
  const list = Array.isArray(notes) && notes.length > 0 ? notes : DEFAULT_RELEASE_NOTES;
  releaseNotesItemsEl.innerHTML = "";
  list.forEach((item, idx) => {
    const cleanText = String(item || "").trim().replace(/^\+\s*(?:อัพเดท)?/i, "").trim();
    if (!cleanText) return;
    const palette = NOTE_PALETTE[idx % NOTE_PALETTE.length];
    const row = document.createElement("div");
    row.className = "release-note-row";
    row.style.background = palette.bg;
    row.style.color = palette.text;
    const plusBadge = document.createElement("span");
    plusBadge.className = "release-note-plus";
    plusBadge.style.background = palette.badge;
    plusBadge.textContent = "+";
    const textSpan = document.createElement("span");
    textSpan.textContent = cleanText;
    row.appendChild(plusBadge);
    row.appendChild(textSpan);
    releaseNotesItemsEl.appendChild(row);
  });
}

function renderUpdateStatus(status) {
  if (!status) return;
  const currentVer = status.loadedVersion || chrome.runtime.getManifest().version;
  verBadgeEl.textContent = `v${currentVer}`;
  const displayVer = status.remoteHasNewer
    ? status.remoteVersion
    : (status.diskNeedsReload ? status.diskVersion : currentVer);
  if (Array.isArray(status.releaseNotes) && status.releaseNotes.length > 0) {
    renderReleaseNotes(displayVer, status.releaseNotes);
  } else if (releaseNotesVerEl) {
    releaseNotesVerEl.textContent = String(displayVer || currentVer).replace(/^v/i, "");
  }

  if (status.diskNeedsReload) {
    updateBoxEl.classList.add("has-update");
    updateTextEl.textContent = `ดาวน์โหลดเวอร์ชันใหม่ (v${status.diskVersion}) ลงเครื่องแล้ว กดปุ่มด้านล่างเพื่อเริ่มใช้งานทันที`;
    reloadBtnEl.style.display = "block";
    return;
  }

  if (status.remoteHasNewer) {
    updateBoxEl.classList.add("has-update");
    updateTextEl.textContent = `พบเวอร์ชันใหม่บนระบบ (v${status.remoteVersion}) กำลังซิงก์ไฟล์ลงเครื่องอัตโนมัติ...`;
    reloadBtnEl.style.display = "block";
    return;
  }

  updateBoxEl.classList.remove("has-update");
  reloadBtnEl.style.display = "none";
  updateTextEl.textContent = `ส่วนขยายเป็นเวอร์ชันล่าสุดแล้ว (v${currentVer})`;
}

async function load() {
  const manifestVer = chrome.runtime.getManifest().version;
  verBadgeEl.textContent = `v${manifestVer}`;
  renderReleaseNotes(manifestVer, DEFAULT_RELEASE_NOTES);

  try {
    const cfgRes = await fetch(chrome.runtime.getURL("update-config.json"), { cache: "no-store" });
    if (cfgRes.ok) {
      const cfg = await cfgRes.json();
      if (Array.isArray(cfg?.releaseNotes) && cfg.releaseNotes.length > 0) {
        renderReleaseNotes(manifestVer, cfg.releaseNotes);
      }
    }
  } catch {}
  const { mode = "both" } = await chrome.storage.sync.get({ mode: "both" });
  const radio = document.querySelector(`input[name="mode"][value="${mode}"]`);
  if (radio) radio.checked = true;

  const { updateStatus } = await chrome.storage.local.get({
    updateStatus: null
  });
  if (updateStatus) renderUpdateStatus(updateStatus);

  chrome.runtime.sendMessage({ type: "CHECK_EXTENSION_UPDATE", autoReload: false }, (res) => {
    if (res?.ok && res.status) renderUpdateStatus(res.status);
  });
}

document.getElementById("save").addEventListener("click", async () => {
  const selected = document.querySelector('input[name="mode"]:checked');
  const mode = selected?.value || "both";
  await chrome.storage.sync.set({ mode });
  statusEl.textContent = "บันทึกแล้ว หากหน้าเว็บเปิดค้างอยู่ ให้รีเฟรชหน้า iHAVECPU หนึ่งครั้ง";
});

document.getElementById("shortcuts").addEventListener("click", async () => {
  await chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

function triggerProtocolUpdater() {
  try {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = "ihavecpu-updater://update";
    document.body.appendChild(iframe);
    setTimeout(() => iframe.remove(), 3000);
  } catch {}
}

document.getElementById("check-update").addEventListener("click", () => {
  updateTextEl.textContent = "กำลังตรวจสอบเวอร์ชันล่าสุด...";
  chrome.runtime.sendMessage({ type: "CHECK_EXTENSION_UPDATE", autoReload: true }, (res) => {
    if (res?.ok && res.status) {
      renderUpdateStatus(res.status);
      if (res.status.remoteHasNewer && !res.status.diskNeedsReload) {
        triggerProtocolUpdater();
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: "CHECK_EXTENSION_UPDATE", autoReload: true }, (res2) => {
            if (res2?.ok && res2.status) renderUpdateStatus(res2.status);
          });
        }, 3000);
      }
    } else {
      updateTextEl.textContent = "ตรวจสอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
    }
  });
});

reloadBtnEl.addEventListener("click", () => {
  reloadBtnEl.textContent = "กำลังอัปเดตและรีโหลดส่วนขยาย...";
  reloadBtnEl.disabled = true;
  triggerProtocolUpdater();
  chrome.runtime.sendMessage({ type: "RELOAD_EXTENSION_NOW", waitForDiskSync: true });
});

const admetaSearchInput = document.getElementById("admeta-search-input");
const admetaSearchBtn = document.getElementById("admeta-search-btn");

function runPopupAdmetaSearch() {
  const raw = (admetaSearchInput?.value || "").trim();
  if (!raw) {
    statusEl.textContent = "กรุณาพิมพ์คำค้นหางบหรือสเป็คก่อนกด Enter";
    return;
  }
  const normalized = raw.replace(/^เซ็ตคอม(?:พิวเตอร์)?\s+(?=งบ|\d)/i, "").trim() || raw;
  statusEl.textContent = `กำลังเปิดและค้นหา "${normalized}" ใน AdMeta...`;
  chrome.runtime.sendMessage({ type: "SEARCH_ADMETA_SPEC", searchTerm: normalized }, (res) => {
    if (res?.ok) {
      statusEl.textContent = res.loadedFromHistory
        ? `เปิดประวัติและโหลดสเปก "${res.searchTerm || normalized}" ใน AdMeta แล้ว`
        : `ค้นหา "${normalized}" ใน AdMeta แล้ว`;
    } else {
      statusEl.textContent = res?.error || "ค้นหาใน AdMeta ไม่สำเร็จ";
    }
  });
}

if (admetaSearchInput) {
  admetaSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runPopupAdmetaSearch();
    }
  });
}
if (admetaSearchBtn) {
  admetaSearchBtn.addEventListener("click", runPopupAdmetaSearch);
}

let badgeClickCount = 0;
let badgeClickTimer = null;
let diagAutoRefreshTimer = null;
const diagPanel = document.getElementById("hidden-admin-diag");
const diagSummary = document.getElementById("diag-summary");
const diagList = document.getElementById("diag-list");
const refreshDiagBtn = document.getElementById("refresh-diag-btn");
const autoRefreshDiagCheck = document.getElementById("auto-refresh-diag");

function timeAgo(ms) {
  if (!ms) return "ไม่ระบุ";
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 60) return "เมื่อสักครู่";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} นาทีก่อน`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ชม.ก่อน`;
  return `${Math.floor(diffSec / 86400)} วันก่อน`;
}

function getUsageIntensity(totalClicks, todayClicks, lastTs) {
  const now = Date.now();
  const diffMinutes = (now - (lastTs || 0)) / (60 * 1000);
  if (todayClicks >= 25 || totalClicks >= 100 || (diffMinutes <= 15 && totalClicks > 0)) {
    return { label: "🔥 ใช้หนักมาก", color: "#ef4444", bg: "#450a0a" };
  }
  if (todayClicks >= 5 || totalClicks >= 20 || (diffMinutes <= 120 && totalClicks > 0)) {
    return { label: "⚡ สม่ำเสมอ", color: "#f59e0b", bg: "#451a03" };
  }
  if (totalClicks > 0) {
    return { label: "💤 ใช้น้อย", color: "#93c5fd", bg: "#1e3a8a" };
  }
  return { label: "⚪ ยังไม่ใช้", color: "#94a3b8", bg: "#334155" };
}

function deduplicateMachines(machines) {
  const staffMap = new Map();
  const pcList = [];
  machines.forEach((m) => {
    const key = (m.staff || "").trim();
    if (key) {
      const existing = staffMap.get(key);
      if (!existing || (m.ts || 0) > (existing.ts || 0)) {
        const combinedClicks = Math.max(existing?.totalClicks || 0, m.totalClicks || 0);
        const combinedToday = Math.max(existing?.todayClicks || 0, m.todayClicks || 0);
        staffMap.set(key, { ...existing, ...m, totalClicks: combinedClicks, todayClicks: combinedToday });
      }
    } else {
      pcList.push(m);
    }
  });
  return [...staffMap.values(), ...pcList];
}

function loadAndRenderDiag() {
  if (!diagPanel || diagPanel.style.display === "none") return;
  chrome.runtime.sendMessage({ type: "FETCH_MACHINES_REGISTRY" }, (res) => {
    if (!res?.ok || !Array.isArray(res.machines)) {
      diagSummary.textContent = "ไม่สามารถดึงข้อมูลได้ (" + (res?.error || "network error") + ")";
      return;
    }
    const cleanList = deduplicateMachines(res.machines);
    const now = Date.now();
    const manifestVer = chrome.runtime.getManifest().version;
    const activeDay = cleanList.filter(m => (now - (m.ts || 0)) < 24 * 3600 * 1000).length;
    const updatedCount = cleanList.filter(m => (m.ver || "") === manifestVer).length;
    const totalTeamClicks = cleanList.reduce((acc, cur) => acc + (cur.totalClicks || 0), 0);
    const totalTodayClicks = cleanList.reduce((acc, cur) => acc + (cur.todayClicks || 0), 0);

    diagSummary.innerHTML = `
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid #334155;padding-bottom:5px;margin-bottom:6px">
        <span>ติดตั้ง: <b style="color:#f8fafc">${cleanList.length} เครื่อง</b> (Active 24ชม: <b style="color:#38bdf8">${activeDay}</b>)</span>
        <span>อัปเดตแล้ว: <b style="color:#4ade80">${updatedCount}/${cleanList.length}</b></span>
      </div>
      <div style="display:flex;justify-content:space-between;color:#cbd5e1;font-size:11px">
        <span>ยอดคลิกทั้งทีม: <b style="color:#fbbf24">${totalTeamClicks} ครั้ง</b></span>
        <span>วันนี้: <b style="color:#f472b6">${totalTodayClicks} ครั้ง</b></span>
      </div>
    `;

    diagList.innerHTML = "";
    if (cleanList.length === 0) {
      diagList.innerHTML = "<div style='color:#64748b;text-align:center;padding:10px'>ยังไม่มีข้อมูลเครื่องส่งเข้ามา</div>";
      return;
    }

    cleanList.sort((a, b) => (b.totalClicks || 0) - (a.totalClicks || 0) || (b.ts || 0) - (a.ts || 0));

    cleanList.forEach((m) => {
      const item = document.createElement("div");
      item.style.cssText = "background:#1e293b;padding:8px 10px;border-radius:8px;border:1px solid #334155;display:flex;flex-direction:column;gap:5px";
      const name = m.staff ? `<b>${m.staff}</b> ${m.branch ? `<span style='color:#94a3b8;font-size:10.5px'>(${m.branch})</span>` : ""}` : (m.pc || m.id || "เครื่องแอดมิน");
      const isUpToDate = (m.ver || "") === manifestVer;
      const clicks = Number(m.totalClicks) || 0;
      const todayClicks = Number(m.todayClicks) || 0;
      const sharePct = totalTeamClicks > 0 ? Math.round((clicks / totalTeamClicks) * 100) : 0;
      const intensity = getUsageIntensity(clicks, todayClicks, m.ts);
      let actionName = m.lastAction || "";
      if (actionName === "First-time Install") actionName = "ติดตั้งส่วนขยายครั้งแรก";
      else if (actionName.startsWith("Auto-Update")) actionName = "อัปเดตไฟล์เวอร์ชันใหม่";
      const lastActionText = actionName ? `<div style='font-size:10px;color:#94a3b8;margin-top:2px'>ล่าสุด: ${actionName}</div>` : "";

      item.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="color:#f1f5f9;font-size:12px">${name}</div>
            <div style="font-size:10px;color:#64748b">${m.pc || ""} ${m.user ? `• ${m.user}` : ""}</div>
          </div>
          <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:3px">
            <span style="background:${isUpToDate ? '#15803d' : '#c2410c'};color:#fff;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700">
              v${m.ver || "?"} ${isUpToDate ? "✓" : "⚠️"}
            </span>
            <span style="background:${intensity.bg};color:${intensity.color};padding:1px 5px;border-radius:4px;font-size:9.5px;font-weight:600">
              ${intensity.label}
            </span>
          </div>
        </div>
        <div style="background:#0f172a;border-radius:4px;padding:4px 6px;display:flex;justify-content:space-between;align-items:center;font-size:10.5px">
          <span style="color:#e2e8f0">คลิก: <b>${clicks}</b> ครั้ง (วันนี้ <b>${todayClicks}</b>)</span>
          <span style="color:#38bdf8;font-weight:700">${sharePct}% การใช้งาน</span>
        </div>
        <div style="width:100%;background:#334155;height:4px;border-radius:2px;overflow:hidden">
          <div style="width:${sharePct}%;background:#38bdf8;height:100%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#64748b">
          <span>${timeAgo(m.ts || 0)}</span>
          ${lastActionText}
        </div>
      `;
      diagList.appendChild(item);
    });
  });
}

function startDiagAutoRefresh() {
  stopDiagAutoRefresh();
  if (autoRefreshDiagCheck && autoRefreshDiagCheck.checked) {
    diagAutoRefreshTimer = setInterval(() => {
      if (diagPanel && diagPanel.style.display !== "none") {
        loadAndRenderDiag();
      }
    }, 5000);
  }
}

function stopDiagAutoRefresh() {
  if (diagAutoRefreshTimer) {
    clearInterval(diagAutoRefreshTimer);
    diagAutoRefreshTimer = null;
  }
}

if (autoRefreshDiagCheck) {
  autoRefreshDiagCheck.addEventListener("change", () => {
    if (autoRefreshDiagCheck.checked) startDiagAutoRefresh();
    else stopDiagAutoRefresh();
  });
}

if (verBadgeEl) {
  verBadgeEl.addEventListener("click", () => {
    badgeClickCount++;
    clearTimeout(badgeClickTimer);
    badgeClickTimer = setTimeout(() => { badgeClickCount = 0; }, 2500);
    if (badgeClickCount >= 5) {
      badgeClickCount = 0;
      if (diagPanel) {
        const isHidden = diagPanel.style.display === "none";
        diagPanel.style.display = isHidden ? "block" : "none";
        if (isHidden) {
          loadAndRenderDiag();
          startDiagAutoRefresh();
        } else {
          stopDiagAutoRefresh();
        }
      }
    }
  });
}
if (refreshDiagBtn) refreshDiagBtn.addEventListener("click", loadAndRenderDiag);

load();
