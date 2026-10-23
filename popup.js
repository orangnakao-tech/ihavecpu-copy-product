const statusEl = document.getElementById("status");
const verBadgeEl = document.getElementById("version-badge");
const updateBoxEl = document.getElementById("update-box");
const updateTextEl = document.getElementById("update-text");
const reloadBtnEl = document.getElementById("reload-now");

function renderUpdateStatus(status) {
  if (!status) return;
  verBadgeEl.textContent = `v${status.loadedVersion || chrome.runtime.getManifest().version}`;

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
  updateTextEl.textContent = `ส่วนขยายเป็นเวอร์ชันล่าสุดแล้ว (v${status.loadedVersion})`;
}

async function load() {
  verBadgeEl.textContent = `v${chrome.runtime.getManifest().version}`;
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

document.getElementById("check-update").addEventListener("click", () => {
  updateTextEl.textContent = "กำลังตรวจสอบเวอร์ชันล่าสุด...";
  chrome.runtime.sendMessage({ type: "CHECK_EXTENSION_UPDATE", autoReload: true }, (res) => {
    if (res?.ok && res.status) {
      renderUpdateStatus(res.status);
    } else {
      updateTextEl.textContent = "ตรวจสอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
    }
  });
});

reloadBtnEl.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "RELOAD_EXTENSION_NOW" });
});

load();
