const statusEl = document.getElementById("status");
const verBadgeEl = document.getElementById("version-badge");
const updateBoxEl = document.getElementById("update-box");
const updateTextEl = document.getElementById("update-text");
const reloadBtnEl = document.getElementById("reload-now");
const ghOwnerInput = document.getElementById("gh-owner");
const ghRepoInput = document.getElementById("gh-repo");

function renderUpdateStatus(status) {
  if (!status) return;
  verBadgeEl.textContent = `v${status.loadedVersion || chrome.runtime.getManifest().version}`;

  if (status.ghOwner && status.githubOwner !== "YOUR_GITHUB_USERNAME") {
    ghOwnerInput.value = status.githubOwner;
  } else if (status.githubOwner && status.githubOwner !== "YOUR_GITHUB_USERNAME") {
    ghOwnerInput.value = status.githubOwner;
  }
  if (status.githubRepo) {
    ghRepoInput.value = status.githubRepo;
  }

  if (status.diskNeedsReload) {
    updateBoxEl.classList.add("has-update");
    updateTextEl.textContent = `ดาวน์โหลดเวอร์ชันใหม่ (v${status.diskVersion}) ลงเครื่องแล้ว กดปุ่มด้านล่างเพื่อเริ่มใช้งานทันที`;
    reloadBtnEl.style.display = "block";
    return;
  }

  if (status.remoteHasNewer) {
    updateBoxEl.classList.add("has-update");
    updateTextEl.textContent = `พบเวอร์ชันใหม่บน GitHub (v${status.remoteVersion}) ระบบกำลังซิงก์ไฟล์ลงเครื่อง หรือกดรันไฟล์ "อัปเดตส่วนขยาย.bat" ได้เลย`;
    reloadBtnEl.style.display = "block";
    return;
  }

  updateBoxEl.classList.remove("has-update");
  reloadBtnEl.style.display = "none";
  if (!status.githubOwner || status.githubOwner === "YOUR_GITHUB_USERNAME") {
    updateTextEl.textContent = `เวอร์ชันปัจจุบัน v${status.loadedVersion} (ตั้งค่าชื่อบัญชี GitHub ด้านล่างหรือใน update-config.json เพื่อเปิดเช็กออนไลน์)`;
  } else {
    updateTextEl.textContent = `ส่วนขยายเป็นเวอร์ชันล่าสุดแล้ว (v${status.loadedVersion})`;
  }
}

async function load() {
  verBadgeEl.textContent = `v${chrome.runtime.getManifest().version}`;
  const { mode = "both" } = await chrome.storage.sync.get({ mode: "both" });
  const radio = document.querySelector(`input[name="mode"][value="${mode}"]`);
  if (radio) radio.checked = true;

  const { updateStatus, customUpdateConfig } = await chrome.storage.local.get({
    updateStatus: null,
    customUpdateConfig: null
  });
  ghOwnerInput.value = customUpdateConfig?.githubOwner || "orangnakao-tech";
  ghRepoInput.value = customUpdateConfig?.githubRepo || "ihavecpu-copy-product";
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

document.getElementById("save-gh").addEventListener("click", async () => {
  const githubOwner = ghOwnerInput.value.trim();
  const githubRepo = ghRepoInput.value.trim() || "ihavecpu-copy-product";
  await chrome.storage.local.set({
    customUpdateConfig: { githubOwner, githubRepo, branch: "main" }
  });
  statusEl.textContent = "บันทึกค่า GitHub แล้ว กำลังตรวจสอบเวอร์ชัน...";
  chrome.runtime.sendMessage({ type: "CHECK_EXTENSION_UPDATE", autoReload: false }, (res) => {
    if (res?.ok && res.status) renderUpdateStatus(res.status);
  });
});

load();
