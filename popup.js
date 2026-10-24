const statusEl = document.getElementById("status");
const verBadgeEl = document.getElementById("version-badge");
const updateBoxEl = document.getElementById("update-box");
const updateTextEl = document.getElementById("update-text");
const reloadBtnEl = document.getElementById("reload-now");
const releaseNotesVerEl = document.getElementById("release-notes-ver");
const releaseNotesItemsEl = document.getElementById("release-notes-items");

const DEFAULT_RELEASE_NOTES = [
  "+ โหมดแพทฟอม (สีส้ม) คำนวณราคา + รีเซ็ตรายการเก่า",
  "+ ปุ่มรีเซ็ตรายการใหม่ในหน้าคำนวณแพลตฟอร์ม",
  "+ ค้นหารหัส SB-xxxx-xxxxx โหลดประวัติทันที",
  "+ แก้บัครูป UPS & สินค้าลดราคา / ซ่อนปุ่มหน้าค้นหา"
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
const diagPanel = document.getElementById("hidden-admin-diag");
const diagSummary = document.getElementById("diag-summary");
const diagList = document.getElementById("diag-list");
const refreshDiagBtn = document.getElementById("refresh-diag-btn");

function timeAgo(ms) {
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 60) return "เมื่อสักครู่";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} นาทีก่อน`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ชม.ก่อน`;
  return `${Math.floor(diffSec / 86400)} วันก่อน`;
}

function loadAndRenderDiag() {
  if (!diagPanel || diagPanel.style.display === "none") return;
  diagSummary.textContent = "กำลังเชื่อมต่อเช็กข้อมูลเครื่อง...";
  chrome.runtime.sendMessage({ type: "FETCH_MACHINES_REGISTRY" }, (res) => {
    if (!res?.ok || !Array.isArray(res.machines)) {
      diagSummary.textContent = "ไม่สามารถดึงข้อมูลได้ (" + (res?.error || "network error") + ")";
      return;
    }
    const machines = res.machines;
    const now = Date.now();
    const activeDay = machines.filter(m => (now - (m.ts || 0)) < 24 * 3600 * 1000).length;
    diagSummary.innerHTML = `พบทั้งหมด <b>${machines.length} เครื่อง</b> (ใช้งานใน 24 ชม.: <b>${activeDay}</b> เครื่อง)`;
    diagList.innerHTML = "";
    if (machines.length === 0) {
      diagList.innerHTML = "<div style='color:#64748b'>ยังไม่มีข้อมูลเครื่องส่งเข้ามา</div>";
      return;
    }
    machines.forEach((m) => {
      const item = document.createElement("div");
      item.style.cssText = "background:#0f172a;padding:6px 8px;border-radius:6px;display:flex;justify-content:space-between;align-items:center";
      const name = m.staff ? `<b>${m.staff}</b> ${m.branch ? `(${m.branch})` : ""}` : (m.pc || m.id || "เครื่องแอดมิน");
      const sub = m.pc && m.staff ? `<div style='font-size:10px;color:#64748b'>${m.pc} • ${m.user || ""}</div>` : "";
      item.innerHTML = `
        <div>
          <div style="color:#f1f5f9">${name}</div>
          ${sub}
        </div>
        <div style="text-align:right">
          <span style="background:${m.ver === chrome.runtime.getManifest().version ? '#15803d' : '#b45309'};color:#fff;padding:1px 5px;border-radius:4px;font-size:10px">v${m.ver || "?"}</span>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px">${timeAgo(m.ts || 0)}</div>
        </div>
      `;
      diagList.appendChild(item);
    });
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
        if (isHidden) loadAndRenderDiag();
      }
    }
  });
}
if (refreshDiagBtn) refreshDiagBtn.addEventListener("click", loadAndRenderDiag);

load();
