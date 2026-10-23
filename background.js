const IMAGE_HOST = "ihcupload-bkk.s3.ap-southeast-7.amazonaws.com";
const MAX_IMAGE_SIZE = 16 * 1024 * 1024;
const ZAAPI_TAB_STORAGE_KEY = "lastZaapiTabId";
const AUTO_RELOAD_STORAGE_KEY = "lastAutoReloadAt";
const AUTO_RELOAD_INTERVAL_MS = 3 * 60 * 60 * 1000;
const RELOAD_TIMEOUT_MS = 20000;
const MATCHING_URL_PATTERNS = [
  "https://ihavecpu.com/*",
  "https://www.ihavecpu.com/*",
  "https://admeta.me/admin/spec-builder-v2*",
  "https://app.zaapi.com/*"
];

let lastZaapiTabId = null;
let zaapiInteractionSequence = 0;
let latestZaapiInteraction = 0;
let autoReloadPromise = null;

async function rememberZaapiTab(tabId, sequence) {
  if (!tabId) return;
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (error) {
    if (lastZaapiTabId === tabId) lastZaapiTabId = null;
    console.warn("Could not remember the active Zaapi tab:", error);
    return;
  }
  if (!/^https:\/\/app\.zaapi\.com\//i.test(tab.url || "") || sequence < latestZaapiInteraction) return;
  latestZaapiInteraction = sequence;
  lastZaapiTabId = tabId;
  try {
    await chrome.storage.session.set({ [ZAAPI_TAB_STORAGE_KEY]: tabId });
  } catch (error) {
    console.warn("Could not persist the active Zaapi tab; using the in-memory value:", error);
  }
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  rememberZaapiTab(tabId, ++zaapiInteractionSequence);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const sequence = ++zaapiInteractionSequence;
  chrome.tabs.query({ active: true, windowId }).then(([tab]) => {
    if (tab?.id) return rememberZaapiTab(tab.id, sequence);
    return undefined;
  }).catch((error) => console.warn("Could not inspect the focused window:", error));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (lastZaapiTabId !== tabId) return;
  lastZaapiTabId = null;
  chrome.storage.session.remove(ZAAPI_TAB_STORAGE_KEY).catch((error) =>
    console.warn("Could not clear the closed Zaapi tab:", error)
  );
});

async function fetchProductImage(url) {
  const imageUrl = new URL(url);
  if (imageUrl.protocol !== "https:" || imageUrl.hostname !== IMAGE_HOST) {
    throw new Error("โดเมนรูปภาพไม่ได้รับอนุญาต");
  }

  const response = await fetch(imageUrl.href, { credentials: "omit" });
  if (!response.ok) throw new Error(`ดาวน์โหลดรูปสินค้าไม่สำเร็จ (${response.status})`);

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("ไฟล์ที่พบไม่ใช่รูปภาพ");
  if (blob.size > MAX_IMAGE_SIZE) throw new Error("รูปสินค้ามีขนาดใหญ่เกินไป");

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

function reloadTabAndWait(tabId, timeoutMs = RELOAD_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let timer = null;
    let onUpdatedListener = null;
    let onRemovedListener = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (onUpdatedListener) chrome.tabs.onUpdated.removeListener(onUpdatedListener);
      if (onRemovedListener) chrome.tabs.onRemoved.removeListener(onRemovedListener);
    };

    timer = setTimeout(() => {
      cleanup();
      console.warn(`Tab ${tabId} reload timed out after ${timeoutMs}ms`);
      resolve({ tabId, status: "timeout" });
    }, timeoutMs);

    onUpdatedListener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        cleanup();
        resolve({ tabId, status: "complete" });
      }
    };

    onRemovedListener = (removedTabId) => {
      if (removedTabId === tabId) {
        cleanup();
        resolve({ tabId, status: "removed" });
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdatedListener);
    chrome.tabs.onRemoved.addListener(onRemovedListener);

    chrome.tabs.reload(tabId).catch((error) => {
      cleanup();
      console.warn(`Could not reload tab ${tabId}:`, error);
      resolve({ tabId, status: "error", error });
    });
  });
}

function navigateTabAndWait(tabId, url, timeoutMs = RELOAD_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let timer = null;
    let onUpdatedListener = null;
    let onRemovedListener = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (onUpdatedListener) chrome.tabs.onUpdated.removeListener(onUpdatedListener);
      if (onRemovedListener) chrome.tabs.onRemoved.removeListener(onRemovedListener);
    };

    timer = setTimeout(() => {
      cleanup();
      console.warn(`Tab ${tabId} navigation timed out after ${timeoutMs}ms`);
      resolve({ tabId, status: "timeout" });
    }, timeoutMs);

    onUpdatedListener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        cleanup();
        resolve({ tabId, status: "complete" });
      }
    };

    onRemovedListener = (removedTabId) => {
      if (removedTabId === tabId) {
        cleanup();
        resolve({ tabId, status: "removed" });
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdatedListener);
    chrome.tabs.onRemoved.addListener(onRemovedListener);

    chrome.tabs.update(tabId, { url }).catch((error) => {
      cleanup();
      console.warn(`Could not navigate tab ${tabId}:`, error);
      resolve({ tabId, status: "error", error });
    });
  });
}

async function checkTabUnsavedInput(tab) {
  try {
    const response = await Promise.race([
      chrome.tabs.sendMessage(tab.id, { type: "CHECK_UNSAVED_INPUT" }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 1500))
    ]);
    return {
      hasUnsaved: Boolean(response?.hasUnsaved),
      name: response?.title || tab.title || "หน้าเว็บ"
    };
  } catch {
    return { hasUnsaved: false, name: tab.title || "หน้าเว็บ" };
  }
}

async function performAutoReload(feedbackTabId, options = {}) {
  const { resetAdmetaUrl = false, customStatusMessage = "", excludeTabId = null } = options;
  let matchingTabs = [];
  try {
    matchingTabs = await chrome.tabs.query({ url: MATCHING_URL_PATTERNS });
  } catch (error) {
    console.warn("Could not query matching tabs for auto-reload:", error);
    return;
  }

  matchingTabs = matchingTabs.filter((tab) => {
    if (excludeTabId && tab.id === excludeTabId) return false;
    const url = tab.url || "";
    return (
      /^https:\/\/(www\.)?ihavecpu\.com\//i.test(url) ||
      /^https:\/\/admeta\.me\/admin\/spec-builder-v2/i.test(url) ||
      /^https:\/\/app\.zaapi\.com\//i.test(url)
    );
  });

  if (!matchingTabs.length) {
    try {
      await chrome.storage.local.set({ [AUTO_RELOAD_STORAGE_KEY]: Date.now() });
    } catch (error) {
      console.warn("Could not record lastAutoReloadAt:", error);
    }
    return;
  }

  const skippedNames = [];
  const tabsToReload = [];

  for (const tab of matchingTabs) {
    const check = await checkTabUnsavedInput(tab);
    if (check.hasUnsaved) {
      skippedNames.push(check.name);
    } else {
      tabsToReload.push(tab);
    }
  }

  if (tabsToReload.length > 0) {
    await Promise.all(
      tabsToReload.map((tab) => {
        const url = tab.url || "";
        if (
          resetAdmetaUrl &&
          /^https:\/\/admeta\.me\/admin\/spec-builder-v2/i.test(url) &&
          !/^https:\/\/admeta\.me\/admin\/spec-builder-v2\/?$/i.test(url)
        ) {
          return navigateTabAndWait(tab.id, "https://admeta.me/admin/spec-builder-v2", RELOAD_TIMEOUT_MS);
        }
        return reloadTabAndWait(tab.id, RELOAD_TIMEOUT_MS);
      })
    );
    await delay(900);
  }

  try {
    await chrome.storage.local.set({ [AUTO_RELOAD_STORAGE_KEY]: Date.now() });
  } catch (error) {
    console.warn("Could not record lastAutoReloadAt:", error);
  }

  const targetTabId = feedbackTabId || (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id;
  if (targetTabId) {
    if (skippedNames.length > 0) {
      await showTabStatus(
        targetTabId,
        `ข้ามการรีโหลดบางหน้าเพราะมีข้อความที่ยังไม่ได้ส่ง: ${skippedNames.join(", ")} กรุณาส่งหรือลบข้อความก่อน แล้วรีโหลดเอง`,
        true
      );
    } else if (tabsToReload.length > 0) {
      await showTabStatus(
        targetTabId,
        customStatusMessage || "รีโหลดหน้าที่เกี่ยวข้องแล้ว เนื่องจากเป็นการใช้งานครั้งแรกในรอบ 3 ชั่วโมง",
        false
      );
    }
  }
}

async function ensureFreshPagesBeforeAction(feedbackTabId) {
  if (autoReloadPromise) {
    try {
      await autoReloadPromise;
    } catch (error) {
      console.warn("Waiting for auto-reload cycle failed:", error);
    }
    return;
  }

  try {
    const stored = await chrome.storage.local.get({ [AUTO_RELOAD_STORAGE_KEY]: 0 });
    const lastAt = Number(stored[AUTO_RELOAD_STORAGE_KEY]) || 0;
    const now = Date.now();
    if (lastAt > 0 && now - lastAt < AUTO_RELOAD_INTERVAL_MS) {
      return;
    }

    autoReloadPromise = performAutoReload(feedbackTabId, { resetAdmetaUrl: true });
    await autoReloadPromise;
  } catch (error) {
    console.warn("Auto-reload check encountered an error:", error);
  } finally {
    autoReloadPromise = null;
  }
}

async function resetAllRelatedPages(feedbackTabId, excludeTabId = null) {
  if (autoReloadPromise) {
    try {
      await autoReloadPromise;
    } catch (error) {
      console.warn("Waiting for existing reload cycle failed:", error);
    }
    return;
  }

  try {
    autoReloadPromise = performAutoReload(feedbackTabId, {
      resetAdmetaUrl: true,
      excludeTabId,
      customStatusMessage: "รีเซ็ตหน้าเว็บทั้ง 3 อัตโนมัติแล้ว กำลังทำงานต่อ..."
    });
    await autoReloadPromise;
  } catch (error) {
    console.warn("Auto-reset on error encountered an issue:", error);
  } finally {
    autoReloadPromise = null;
  }
}

async function runWithAutoResetRetry(feedbackTabId, actionFn) {
  activeOperationsCount++;
  try {
    return await _runWithAutoResetRetryImpl(feedbackTabId, actionFn);
  } finally {
    activeOperationsCount = Math.max(0, activeOperationsCount - 1);
  }
}

async function _runWithAutoResetRetryImpl(feedbackTabId, actionFn) {
  await ensureFreshPagesBeforeAction(feedbackTabId);
  try {
    return await actionFn(false);
  } catch (firstError) {
    const msg = firstError?.message || "";
    if (/เปิดหน้า Zaapi ให้แล้ว|ยังไม่มีสินค้าให้เตรียม/.test(msg)) {
      throw firstError;
    }
    console.warn("Action encountered an issue; auto-resetting all 3 websites and continuing:", firstError);
    if (feedbackTabId) {
      await showTabStatus(
        feedbackTabId,
        "พบข้อขัดข้อง กำลังรีเซ็ตหน้าเว็บทั้ง 3 อัตโนมัติแล้วทำต่อจนได้ผลลัพธ์...",
        false
      );
    }
    await resetAllRelatedPages(feedbackTabId);
    return await actionFn(true);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  resetAllRelatedPages(null).catch((error) =>
    console.warn("Initial auto-reload on install/update failed:", error)
  );
});

chrome.runtime.onStartup.addListener(() => {
  resetAllRelatedPages(null).catch((error) =>
    console.warn("Initial auto-reload on browser startup failed:", error)
  );
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ZAAPI_TAB_INTERACTED") {
    if (sender.tab?.id) {
      rememberZaapiTab(sender.tab.id, ++zaapiInteractionSequence);
    }
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "RESET_ALL_PAGES_ONLY") {
    resetAllRelatedPages(sender.tab?.id, message.excludeSender ? sender.tab?.id : null)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "PREPARE_ADMETA_ZAAPI") {
    if (!/^https:\/\/(www\.)?ihavecpu\.com\/diy\/share\/[^/]+/i.test(sender.url || "")) {
      sendResponse({ error: "คำขอคำนวณสเป็ค DIY มาจากหน้าที่ไม่ได้รับอนุญาต" });
      return;
    }
    runWithAutoResetRetry(sender.tab?.id, () => prepareAdmetaZaapi(sender.tab?.id))
      .then((result) => {
        sendResponse(result);
        const specNumber = result.specNumber ? ` (${result.specNumber})` : "";
        const resetStatus = result.resetError ? ` แต่รีเซ็ต AdMeta ไม่สำเร็จ: ${result.resetError}` : " และรีเซ็ต AdMeta แล้ว";
        const statusText = `คำนวณสเป็คใน AdMeta${specNumber} ใส่ข้อความใน Zaapi${resetStatus} — ยังไม่ส่ง`;
        if (result.zaapiTabId) {
          showTabStatus(result.zaapiTabId, statusText);
        }
        if (sender.tab?.id && sender.tab.id !== result.zaapiTabId) {
          showTabStatus(sender.tab.id, statusText);
        }
      })
      .catch((error) => {
        sendResponse({ error: error.message || "คำนวณใน AdMeta แล้วใส่ข้อความใน Zaapi ไม่สำเร็จ" });
        showTabStatus(sender.tab?.id, error.message || "คำนวณใน AdMeta แล้วใส่ข้อความใน Zaapi ไม่สำเร็จ", true);
      });
    return true;
  }

  if (message?.type === "OPEN_PROMO_SET_FOR_UPGRADE") {
    if (!/^https:\/\/(www\.)?ihavecpu\.com\/product\/[^/]+/i.test(sender.url || "")) {
      sendResponse({ error: "คำขอเปิดเซ็ตโปรมาจากหน้าที่ไม่ได้รับอนุญาต" });
      return;
    }
    runWithAutoResetRetry(sender.tab?.id, () => openPromoSetForUpgrade(message.searchTerm))
      .then((result) => {
        sendResponse(result);
        if (sender.tab?.id) {
          showTabStatus(sender.tab.id, `ค้นหาและเลือกเซ็ต ${message.searchTerm} ใน AdMeta แล้ว — เลือกชิ้นส่วนเพื่ออัปเกรดและคำนวณราคาได้เลย`);
        }
      })
      .catch((error) => {
        sendResponse({ error: error.message || "เปิดเซ็ตโปรใน AdMeta เพื่ออัปเกรดไม่สำเร็จ" });
        showTabStatus(sender.tab?.id, error.message || "เปิดเซ็ตโปรใน AdMeta เพื่ออัปเกรดไม่สำเร็จ", true);
      });
    return true;
  }

  if (message?.type === "PREPARE_ZAAPI_TEXT") {
    if (!/^https:\/\/(www\.)?ihavecpu\.com\/diy\/share\/[^/]+/i.test(sender.url || "")) {
      sendResponse({ error: "คำขอส่งข้อความสเป็ค DIY มาจากหน้าที่ไม่ได้รับอนุญาต" });
      return;
    }
    runWithAutoResetRetry(sender.tab?.id, () => prepareZaapiText(message.text))
      .then((result) => {
        sendResponse(result);
        if (sender.tab?.id) {
          showTabStatus(sender.tab.id, "ใส่ราคาและลิงก์สเป็ค DIY ในช่องแชตแล้ว — ไม่ได้แนบรูปและยังไม่ส่ง");
        }
      })
      .catch((error) => {
        sendResponse({ error: error.message || "ใส่ราคาและลิงก์ใน Zaapi ไม่สำเร็จ" });
        showTabStatus(sender.tab?.id, error.message || "ใส่ราคาและลิงก์ใน Zaapi ไม่สำเร็จ", true);
      });
    return true;
  }

  if (message?.type === "FETCH_PRODUCT_IMAGE") {
    if (!/^https:\/\/(www\.)?ihavecpu\.com\//i.test(sender.url || "")) {
      sendResponse({ error: "คำขอรูปภาพมาจากเว็บไซต์ที่ไม่ได้รับอนุญาต" });
      return;
    }

    fetchProductImage(message.url)
      .then((dataUrl) => sendResponse({ dataUrl }))
      .catch((error) => sendResponse({ error: error.message || "ดึงรูปสินค้าไม่สำเร็จ" }));
    return true;
  }

  if (message?.type !== "PREPARE_ZAAPI_PRODUCT") return;
  if (!/^https:\/\/(www\.)?ihavecpu\.com\//i.test(sender.url || "")) {
    sendResponse({ error: "คำขอทำงานกับ Zaapi มาจากเว็บไซต์ที่ไม่ได้รับอนุญาต" });
    return;
  }

  runWithAutoResetRetry(sender.tab?.id, async (isRetry) => {
    const payload = isRetry && sender.tab?.id ? await getProductData(sender.tab.id).catch(() => message) : message;
    return prepareZaapiProduct(payload);
  })
    .then((result) => {
      sendResponse(result);
      if (sender.tab?.id) {
        showTabStatus(sender.tab.id, "ใส่ข้อความและแนบรูปในแชตแล้ว ตรวจสอบแล้วกดส่งเองได้เลย (ยังไม่ส่ง)");
      }
    })
    .catch((error) => {
      sendResponse({ error: error.message || "เตรียมข้อความและรูปใน Zaapi ไม่สำเร็จ" });
      showTabStatus(sender.tab?.id, error.message || "เตรียมข้อความและรูปใน Zaapi ไม่สำเร็จ", true);
    });
  return true;
});

async function getZaapiTab() {
  const tabs = await chrome.tabs.query({ url: "https://app.zaapi.com/*" });
  if (!tabs.length) return null;

  const inMemoryRecent = tabs.find((tab) => tab.id === lastZaapiTabId);
  if (inMemoryRecent) return inMemoryRecent;

  let storedTabId = null;
  try {
    const stored = await chrome.storage.session.get({ [ZAAPI_TAB_STORAGE_KEY]: null });
    storedTabId = stored[ZAAPI_TAB_STORAGE_KEY];
    lastZaapiTabId = storedTabId;
  } catch (error) {
    console.warn("Could not read the last-used Zaapi tab:", error);
  }

  const recentlyUsed = tabs.find((tab) => tab.id === storedTabId);
  if (recentlyUsed) return recentlyUsed;

  const [focusedTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const activeZaapiTab = tabs.find((tab) => tab.id === focusedTab?.id);
  if (activeZaapiTab) return activeZaapiTab;

  const sortedByAccess = [...tabs].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return sortedByAccess[0];
}

async function verifyZaapiTab(tab) {
  if (!tab?.id) throw new Error("ไม่พบแท็บ Zaapi กรุณาเปิดห้องแชตไว้ก่อน");
  const currentTab = await chrome.tabs.get(tab.id);
  if (!/^https:\/\/app\.zaapi\.com\//i.test(currentTab.url || "")) {
    throw new Error("แท็บ Zaapi เปลี่ยนหน้าแล้ว กรุณาเลือกห้องแชตใน Zaapi แล้วลองอีกครั้ง");
  }
  if (/\/device-limit-logout(?:\/|$)|\/login(?:\/|$)/i.test(new URL(currentTab.url).pathname)) {
    throw new Error("แท็บ Zaapi ยังไม่พร้อมใช้งาน กรุณาเข้าสู่ระบบหรือแก้ปัญหาจำนวนอุปกรณ์ แล้วเปิดห้องแชตก่อนลองอีกครั้ง");
  }
  return currentTab;
}

async function showTabStatus(tabId, message, isError = false) {
  if (!tabId) return;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "SHOW_STATUS", message, isError });
      return;
    } catch (error) {
      if (attempt === 4) {
        console.warn("Could not display extension status in tab:", error);
      }
      await delay(200);
    }
  }
}

function getDIYShareKey(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return "";
  }

  if (url.protocol !== "https:" || url.hostname.replace(/^www\./i, "").toLowerCase() !== "ihavecpu.com") {
    return "";
  }
  return url.pathname.match(/^\/diy\/share\/([^/]+)\/?$/i)?.[1] || "";
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function getReadyDIYTab(sourceTabId) {
  if (!sourceTabId) throw new Error("ไม่พบแท็บหน้า DIY ที่เริ่มการทำงาน");
  const deadline = Date.now() + 10000;
  let currentTab;
  while (Date.now() < deadline) {
    currentTab = await chrome.tabs.get(sourceTabId);
    const shareKey = getDIYShareKey(currentTab.url || "");
    if (currentTab.status === "complete" && shareKey) {
      return { tab: currentTab, shareKey };
    }
    await delay(500);
  }
  throw new Error("หน้าแชร์สเป็ค DIY ยังไม่พร้อมใช้งานภายในเวลาที่กำหนด กรุณารอให้หน้าโหลดเสร็จแล้วลองอีกครั้ง");
}

async function sendAdmetaMessage(tabId, message) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt++) {
    const tab = await chrome.tabs.get(tabId);
    const rawUrl = tab.url || tab.pendingUrl || "";
    if (rawUrl) {
      let url;
      try {
        url = new URL(rawUrl);
      } catch {
        url = null;
      }
      if (url && url.hostname !== "admeta.me") {
        throw new Error("กรุณาเข้าสู่ระบบ AdMeta แล้วเปิดหน้า Spec Builder V2 ก่อนลองอีกครั้ง");
      }
      if (url && /\/(?:login|signin|sign-in|auth)(?:\/|$)/i.test(url.pathname)) {
        throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองอีกครั้ง");
      }
    }
    if (tab.status === "complete" && /^https:\/\/admeta\.me\/admin\/spec-builder-v2/i.test(tab.url || "")) {
      try {
        return await chrome.tabs.sendMessage(tabId, message);
      } catch (error) {
        lastError = error;
      }
    }
    await delay(500);
  }
  throw new Error(`หน้า AdMeta ยังไม่พร้อมรับคำสั่ง กรุณาตรวจสอบการเข้าสู่ระบบและลองอีกครั้ง (${lastError?.message || "หน้าเว็บยังโหลดไม่เสร็จ"})`);
}

async function sendZaapiMessage(tabId, message) {
  let lastError;
  for (let attempt = 0; attempt < 15; attempt++) {
    const tab = await chrome.tabs.get(tabId);
    if (!/^https:\/\/app\.zaapi\.com\//i.test(tab.url || "")) {
      throw new Error("แท็บ Zaapi เปลี่ยนหน้าแล้ว กรุณาเลือกห้องแชตใน Zaapi แล้วลองอีกครั้ง");
    }
    if (tab.status === "complete") {
      try {
        return await chrome.tabs.sendMessage(tabId, message);
      } catch (error) {
        lastError = error;
      }
    }
    await delay(400);
  }
  throw new Error(`หน้า Zaapi ยังไม่พร้อมรับคำสั่ง กรุณารอให้หน้าโหลดเสร็จแล้วลองอีกครั้ง (${lastError?.message || "หน้าเว็บยังโหลดไม่เสร็จ"})`);
}

async function prepareZaapiProduct(product) {
  if (typeof product.text !== "string" || !product.text.trim() || product.text.length > 10000) {
    throw new Error("ไม่พบข้อความสินค้า กรุณาเปิดหน้าสินค้าแล้วลองอีกครั้ง");
  }
  if (typeof product.imageUrl !== "string") throw new Error("ไม่พบรูปสินค้า");

  const imageDataUrl = await fetchProductImage(product.imageUrl);
  await chrome.storage.local.set({
    lastZaapiProduct: {
      text: product.text,
      imageUrl: product.imageUrl,
      fileName: product.fileName || "ihavecpu-product.png"
    }
  });

  const zaapiTab = await verifyZaapiTab(await getZaapiTab());

  await chrome.tabs.update(zaapiTab.id, { active: true });
  if (zaapiTab.windowId) {
    await chrome.windows.update(zaapiTab.windowId, { focused: true }).catch(() => {});
  }
  try {
    await verifyZaapiTab(zaapiTab);
    const result = await sendZaapiMessage(zaapiTab.id, {
      type: "PREPARE_ZAAPI_PRODUCT",
      text: product.text,
      imageDataUrl,
      fileName: product.fileName || "ihavecpu-product.png"
    });
    if (!result?.ok) throw new Error(result?.error || "ใส่ข้อความและแนบรูปใน Zaapi ไม่สำเร็จ");
    return result;
  } catch (error) {
    await showTabStatus(zaapiTab.id, error.message || "ใส่ข้อความและแนบรูปใน Zaapi ไม่สำเร็จ", true);
    throw error;
  }
}

async function prepareZaapiText(text) {
  if (typeof text !== "string" || !text.trim() || text.length > 2000) {
    throw new Error("ไม่พบราคาและลิงก์สเป็ค DIY");
  }

  const zaapiTab = await verifyZaapiTab(await getZaapiTab());

  await chrome.tabs.update(zaapiTab.id, { active: true });
  if (zaapiTab.windowId) {
    await chrome.windows.update(zaapiTab.windowId, { focused: true }).catch(() => {});
  }
  try {
    await verifyZaapiTab(zaapiTab);
    const result = await sendZaapiMessage(zaapiTab.id, {
      type: "INSERT_ZAAPI_MESSAGE",
      text
    });
    if (!result?.ok) throw new Error(result?.error || "ใส่ราคาและลิงก์ใน Zaapi ไม่สำเร็จ");
    return result;
  } catch (error) {
    await showTabStatus(zaapiTab.id, error.message || "ใส่ข้อความสเป็ค DIY ใน Zaapi ไม่สำเร็จ", true);
    throw error;
  }
}

async function prepareAdmetaZaapi(sourceTabId) {
  const { tab: sourceTab, shareKey: sourceShareKey } = await getReadyDIYTab(sourceTabId);
  const productUrl = new URL(sourceTab.url);
  productUrl.hash = "";
  const productShareKey = getDIYShareKey(productUrl.href);
  if (!productShareKey || productShareKey !== sourceShareKey) {
    throw new Error("ไม่พบลิงก์แชร์สเป็ค DIY ในแท็บปัจจุบัน กรุณารอให้หน้าสเป็คพร้อมแล้วลองอีกครั้ง");
  }

  const selectedZaapiTab = await getZaapiTab();
  const zaapiTab = selectedZaapiTab ? await verifyZaapiTab(selectedZaapiTab) : null;
  if (!zaapiTab?.id) {
    await chrome.tabs.create({ url: "https://app.zaapi.com/", active: true });
    throw new Error("เปิดหน้า Zaapi ให้แล้ว กรุณาเข้าสู่ระบบและเปิดห้องแชต Zaapi ที่ต้องการ จากนั้นกดปุ่มคำนวณอีกครั้ง");
  }

  const admetaTabs = await chrome.tabs.query({ url: "https://admeta.me/*" });
  let readyAdmetaTab = admetaTabs
    .filter((tab) => /^https:\/\/admeta\.me\/admin\/spec-builder-v2(?:\/[^/]+)?\/?$/i.test(tab.url || ""))
    .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];

  if (!readyAdmetaTab?.id) {
    const loginTab = admetaTabs.find((tab) =>
      /\/(?:login|signin|sign-in|auth)(?:\/|$)/i.test(new URL(tab.url || "https://admeta.me/").pathname)
    );
    if (loginTab?.id) {
      await chrome.tabs.update(loginTab.id, { active: true });
      if (loginTab.windowId) {
        await chrome.windows.update(loginTab.windowId, { focused: true }).catch(() => {});
      }
      throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองคำนวณสเป็คอีกครั้ง");
    }
    readyAdmetaTab = await chrome.tabs.create({
      url: "https://admeta.me/admin/spec-builder-v2",
      active: true
    });
  }

  await chrome.tabs.update(readyAdmetaTab.id, { active: true });
  if (readyAdmetaTab.windowId) {
    await chrome.windows.update(readyAdmetaTab.windowId, { focused: true }).catch(() => {});
  }
  if (
    readyAdmetaTab.url &&
    /^https:\/\/admeta\.me\/admin\/spec-builder-v2\/[^/]+/i.test(readyAdmetaTab.url)
  ) {
    await navigateTabAndWait(readyAdmetaTab.id, "https://admeta.me/admin/spec-builder-v2", RELOAD_TIMEOUT_MS);
    await delay(500);
  }

  let calculated;
  try {
    calculated = await sendAdmetaMessage(readyAdmetaTab.id, {
      type: "CALCULATE_ADMETA_DIY_MESSAGE",
      diyUrl: productUrl.href
    });
  } catch (error) {
    const errMsg = /กรุณาเข้าสู่ระบบ AdMeta/.test(error.message || "")
      ? error.message
      : `ติดต่อหน้า AdMeta ไม่สำเร็จ กรุณาเข้าสู่ระบบและเปิดหน้า Spec Builder V2 แล้วลองใหม่ (${error.message})`;
    await showTabStatus(readyAdmetaTab.id, errMsg, true);
    throw new Error(errMsg);
  }

  if (!calculated?.ok || typeof calculated.text !== "string" || !calculated.text.trim()) {
    const errMsg = calculated?.error || "AdMeta ไม่ได้สร้างข้อความสำหรับส่งลูกค้า";
    await showTabStatus(readyAdmetaTab.id, errMsg, true);
    throw new Error(errMsg);
  }

  if (calculated.needsUrlReset) {
    chrome.tabs.update(readyAdmetaTab.id, { url: "https://admeta.me/admin/spec-builder-v2" }).catch(() => {});
  }

  const targetZaapiTab = await verifyZaapiTab(zaapiTab);
  await chrome.tabs.update(targetZaapiTab.id, { active: true });
  if (targetZaapiTab.windowId) {
    await chrome.windows.update(targetZaapiTab.windowId, { focused: true }).catch(() => {});
  }

  try {
    await verifyZaapiTab(targetZaapiTab);
    const inserted = await sendZaapiMessage(targetZaapiTab.id, {
      type: "INSERT_ZAAPI_MESSAGE",
      text: calculated.text
    });
    if (!inserted?.ok) throw new Error(inserted?.error || "ใส่ข้อความใน Zaapi ไม่สำเร็จ");

    return {
      ok: true,
      zaapiTabId: targetZaapiTab.id,
      specNumber: calculated.specNumber || "",
      resetError: calculated.resetError || ""
    };
  } catch (error) {
    await showTabStatus(targetZaapiTab.id, error.message || "ใส่ข้อความใน Zaapi ไม่สำเร็จ", true);
    throw error;
  }
}

async function openPromoSetForUpgrade(searchTerm) {
  if (typeof searchTerm !== "string" || !searchTerm.trim() || searchTerm.length > 160) {
    throw new Error("ไม่พบรหัสเซ็ตโปรสำหรับค้นหาใน AdMeta");
  }

  const admetaTabs = await chrome.tabs.query({ url: "https://admeta.me/*" });
  const admetaTab = admetaTabs
    .filter((tab) => /^https:\/\/admeta\.me\/admin\/spec-builder-v2(?:\/[^/]+)?\/?$/i.test(tab.url || ""))
    .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
  let readyAdmetaTab = admetaTab;

  if (!readyAdmetaTab?.id) {
    const loginTab = admetaTabs.find((tab) =>
      /\/(?:login|signin|sign-in|auth)(?:\/|$)/i.test(new URL(tab.url || "https://admeta.me/").pathname)
    );
    if (loginTab?.id) {
      await chrome.tabs.update(loginTab.id, { active: true });
      if (loginTab.windowId) {
        await chrome.windows.update(loginTab.windowId, { focused: true }).catch(() => {});
      }
      throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองเปิดเซ็ตโปรอีกครั้ง");
    }
    readyAdmetaTab = await chrome.tabs.create({
      url: "https://admeta.me/admin/spec-builder-v2",
      active: true
    });
  }

  await chrome.tabs.update(readyAdmetaTab.id, { active: true });
  if (readyAdmetaTab.windowId) {
    await chrome.windows.update(readyAdmetaTab.windowId, { focused: true }).catch(() => {});
  }
  if (
    readyAdmetaTab.url &&
    /^https:\/\/admeta\.me\/admin\/spec-builder-v2\/[^/]+/i.test(readyAdmetaTab.url)
  ) {
    await navigateTabAndWait(readyAdmetaTab.id, "https://admeta.me/admin/spec-builder-v2", RELOAD_TIMEOUT_MS);
    await delay(500);
  }
  let result;
  try {
    result = await sendAdmetaMessage(readyAdmetaTab.id, {
      type: "OPEN_PROMO_SET_FOR_UPGRADE",
      searchTerm: searchTerm.trim()
    });
  } catch (error) {
    if (/กรุณาเข้าสู่ระบบ AdMeta/.test(error.message || "")) throw error;
    const errorMessage = `ติดต่อหน้า AdMeta ไม่สำเร็จ กรุณาเข้าสู่ระบบและเปิดหน้า Spec Builder V2 แล้วลองอีกครั้ง (${error.message})`;
    await showTabStatus(readyAdmetaTab.id, errorMessage, true);
    throw new Error(errorMessage);
  }
  if (!result?.ok) {
    const errorMessage = result?.error || "เปิดเซ็ตโปรใน AdMeta ไม่สำเร็จ";
    await showTabStatus(readyAdmetaTab.id, errorMessage, true);
    throw new Error(errorMessage);
  }

  await showTabStatus(readyAdmetaTab.id, `เปิดเซ็ตโปร ${searchTerm.trim()} ใน AdMeta แล้ว เลือกชิ้นส่วนเพื่ออัปเกรดและคำนวณราคาได้เลย`);
  return { ok: true, setName: result.setName || searchTerm.trim() };
}

async function getProductData(tabId) {
  let lastError;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, { type: "GET_PRODUCT_DATA" });
      if (result?.text && result?.imageUrl) {
        return result;
      }
      if (result?.error) {
        lastError = new Error(result.error);
      }
    } catch (error) {
      lastError = error;
    }
    await delay(300);
  }
  throw lastError || new Error("หาไม่พบชื่อสินค้า ราคา หรือรูป");
}

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;
  const { mode = "both" } = await chrome.storage.sync.get({ mode: "both" });
  if (mode === "button") return;

  if (command === "copy-product") {
    if (!/^https:\/\/(www\.)?ihavecpu\.com\//i.test(tab.url || "")) return;
    try {
      await runWithAutoResetRetry(tab.id, async () => {
        await prepareZaapiProduct(await getProductData(tab.id));
      });
    } catch (error) {
      await showTabStatus(tab.id, error.message || "เตรียมข้อความและรูปใน Zaapi ไม่สำเร็จ", true);
    }
    return;
  }

  if (command !== "fill-zaapi-message") return;
  try {
    if (/^https:\/\/(www\.)?ihavecpu\.com\//i.test(tab.url || "")) {
      await runWithAutoResetRetry(tab.id, async () => {
        await prepareZaapiProduct(await getProductData(tab.id));
      });
      return;
    }
    if (/^https:\/\/app\.zaapi\.com\//i.test(tab.url || "")) {
      await runWithAutoResetRetry(tab.id, async () => {
        const zaapiTab = await verifyZaapiTab(tab);
        const { lastZaapiProduct } = await chrome.storage.local.get({ lastZaapiProduct: null });
        if (!lastZaapiProduct) throw new Error("ยังไม่มีสินค้าให้เตรียม กรุณาเริ่มจากหน้าสินค้าบน iHAVECPU");
        const imageDataUrl = await fetchProductImage(lastZaapiProduct.imageUrl);
        const result = await sendZaapiMessage(zaapiTab.id, {
          type: "PREPARE_ZAAPI_PRODUCT",
          text: lastZaapiProduct.text,
          imageDataUrl,
          fileName: lastZaapiProduct.fileName
        });
        if (!result?.ok) throw new Error(result?.error || "ใส่ข้อความและแนบรูปใน Zaapi ไม่สำเร็จ");
      });
      return;
    }
  } catch (error) {
    await showTabStatus(tab.id, error.message || "ใส่ข้อความใน Zaapi ไม่สำเร็จ", true);
  }
});


// ============================================================================
// ระบบตรวจสอบเวอร์ชันและรีโหลดส่วนขยายอัตโนมัติ (GitHub + Local Disk Watcher สำหรับ V4)
// ============================================================================
const UPDATE_ALARM_NAME = "ihavecpu-auto-update-check";
const DEFAULT_GITHUB_OWNER = "orangnakao-tech";
const DEFAULT_GITHUB_REPO = "ihavecpu-copy-product";
let activeOperationsCount = 0;
let lastQuickDiskCheckAt = 0;

function compareVersions(v1, v2) {
  const p1 = String(v1 || "0").replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const p2 = String(v2 || "0").replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

async function getUpdateConfig() {
  try {
    const res = await fetch(chrome.runtime.getURL("update-config.json"), { cache: "no-store" });
    if (res.ok) {
      const fileConfig = await res.json();
      const { customUpdateConfig } = await chrome.storage.local.get({ customUpdateConfig: null });
      const rawOwner = customUpdateConfig?.githubOwner || fileConfig.githubOwner || DEFAULT_GITHUB_OWNER;
      return {
        githubOwner: rawOwner === "YOUR_GITHUB_USERNAME" ? DEFAULT_GITHUB_OWNER : rawOwner,
        githubRepo: customUpdateConfig?.githubRepo || fileConfig.githubRepo || DEFAULT_GITHUB_REPO,
        branch: customUpdateConfig?.branch || fileConfig.branch || "main",
        checkIntervalMinutes: Number(fileConfig.checkIntervalMinutes) || 2
      };
    }
  } catch (err) {
    console.warn("Could not read update-config.json:", err);
  }
  return {
    githubOwner: DEFAULT_GITHUB_OWNER,
    githubRepo: DEFAULT_GITHUB_REPO,
    branch: "main",
    checkIntervalMinutes: 2
  };
}

async function fetchRemoteManifestVersion(owner, repo, branch) {
  const ts = Date.now();
  const encOwner = encodeURIComponent(owner);
  const encRepo = encodeURIComponent(repo);
  const encBranch = encodeURIComponent(branch || "main");

  // 1. เช็กผ่าน GitHub Contents API ก่อน (ไม่ติด Cache 5 นาทีของ raw.githubusercontent.com)
  const apiUrls = [
    `https://api.github.com/repos/${encOwner}/${encRepo}/contents/manifest.json?ref=${encBranch}&t=${ts}`,
    `https://api.github.com/repos/${encOwner}/${encRepo}/contents/ihavecpu-copy-product-v4/manifest.json?ref=${encBranch}&t=${ts}`
  ];
  for (const apiUrl of apiUrls) {
    try {
      const res = await fetch(apiUrl, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data?.content) {
          const decoded = new TextDecoder("utf-8").decode(
            Uint8Array.from(atob(data.content.replace(/\s+/g, "")), (c) => c.charCodeAt(0))
          ).replace(/^\uFEFF/, "").trim();
          const parsed = JSON.parse(decoded);
          if (parsed?.version) return String(parsed.version);
        }
      }
    } catch {}
  }

  // 2. Fallback เช็กจาก raw.githubusercontent.com
  const rawUrls = [
    `https://raw.githubusercontent.com/${encOwner}/${encRepo}/${encBranch}/manifest.json?t=${ts}`,
    `https://raw.githubusercontent.com/${encOwner}/${encRepo}/${encBranch}/ihavecpu-copy-product-v4/manifest.json?t=${ts}`
  ];
  for (const rawUrl of rawUrls) {
    try {
      const res = await fetch(rawUrl, { cache: "no-store" });
      if (res.ok) {
        const text = (await res.text()).replace(/^\uFEFF/, "").trim();
        const parsed = JSON.parse(text);
        if (parsed?.version) return String(parsed.version);
      }
    } catch {}
  }
  return null;
}

async function quickCheckDiskUpdate() {
  const now = Date.now();
  if (now - lastQuickDiskCheckAt < 15000 || activeOperationsCount > 0 || autoReloadPromise) return;
  lastQuickDiskCheckAt = now;
  try {
    const loadedVersion = chrome.runtime.getManifest().version;
    const diskRes = await fetch(chrome.runtime.getURL("manifest.json"), { cache: "no-store" });
    if (diskRes.ok) {
      const diskText = (await diskRes.text()).replace(/^\uFEFF/, "").trim();
      const diskManifest = JSON.parse(diskText);
      if (diskManifest?.version && diskManifest.version !== loadedVersion && activeOperationsCount === 0 && !autoReloadPromise) {
        await chrome.storage.local.set({
          lastAutoUpdateReload: {
            fromVersion: loadedVersion,
            toVersion: diskManifest.version,
            timestamp: Date.now()
          }
        });
        chrome.runtime.reload();
      }
    }
  } catch {}
}

chrome.tabs.onActivated.addListener(() => {
  quickCheckDiskUpdate();
});

async function checkDiskAndRemoteUpdate({ autoReloadIfDiskUpdated = true } = {}) {
  const loadedVersion = chrome.runtime.getManifest().version;
  let diskVersion = loadedVersion;
  let remoteVersion = null;
  let diskNeedsReload = false;
  let remoteHasNewer = false;

  // 1. ตรวจสอบไฟล์ manifest.json ในโฟลเดอร์เครื่องแอดมิน (กรณีสคริปต์ Windows ดึงไฟล์ใหม่ลงเครื่องแล้ว)
  try {
    const diskRes = await fetch(chrome.runtime.getURL("manifest.json"), { cache: "no-store" });
    if (diskRes.ok) {
      const diskText = (await diskRes.text()).replace(/^\uFEFF/, "").trim();
      const diskManifest = JSON.parse(diskText);
      if (diskManifest?.version) {
        diskVersion = diskManifest.version;
        if (diskVersion !== loadedVersion) {
          diskNeedsReload = true;
        }
      }
    }
  } catch (err) {
    console.warn("Disk manifest check error:", err);
  }

  if (diskNeedsReload && autoReloadIfDiskUpdated && activeOperationsCount === 0 && !autoReloadPromise) {
    await chrome.storage.local.set({
      lastAutoUpdateReload: {
        fromVersion: loadedVersion,
        toVersion: diskVersion,
        timestamp: Date.now()
      }
    });
    chrome.runtime.reload();
    return { loadedVersion, diskVersion, remoteVersion, diskNeedsReload: true, reloaded: true };
  }

  // 2. ตรวจสอบเวอร์ชันล่าสุดบน GitHub
  const config = await getUpdateConfig();
  if (config.githubOwner && config.githubOwner !== "YOUR_GITHUB_USERNAME" && config.githubRepo) {
    try {
      remoteVersion = await fetchRemoteManifestVersion(config.githubOwner, config.githubRepo, config.branch);
      if (remoteVersion && compareVersions(remoteVersion, loadedVersion) > 0) {
        remoteHasNewer = true;
      }
    } catch (err) {
      console.warn("Remote GitHub version check failed:", err);
    }
  }

  if (diskNeedsReload || remoteHasNewer) {
    await chrome.action.setBadgeText({ text: "NEW" });
    await chrome.action.setBadgeBackgroundColor({ color: "#d71920" });
  } else {
    await chrome.action.setBadgeText({ text: "" });
  }

  const statusObj = {
    loadedVersion,
    diskVersion,
    remoteVersion,
    diskNeedsReload,
    remoteHasNewer,
    checkedAt: Date.now(),
    githubOwner: config.githubOwner,
    githubRepo: config.githubRepo,
    branch: config.branch
  };
  await chrome.storage.local.set({ updateStatus: statusObj });
  return statusObj;
}

async function setupUpdateAlarm() {
  const config = await getUpdateConfig();
  const period = Math.max(1, Number(config.checkIntervalMinutes) || 2);
  await chrome.alarms.create(UPDATE_ALARM_NAME, { periodInMinutes: period });
}

chrome.runtime.onInstalled.addListener(() => {
  setupUpdateAlarm();
  checkDiskAndRemoteUpdate({ autoReloadIfDiskUpdated: false });
});

chrome.runtime.onStartup.addListener(() => {
  setupUpdateAlarm();
  checkDiskAndRemoteUpdate({ autoReloadIfDiskUpdated: true });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM_NAME) {
    checkDiskAndRemoteUpdate({ autoReloadIfDiskUpdated: true });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CHECK_EXTENSION_UPDATE") {
    checkDiskAndRemoteUpdate({ autoReloadIfDiskUpdated: Boolean(message.autoReload) })
      .then((status) => sendResponse({ ok: true, status }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "RELOAD_EXTENSION_NOW") {
    chrome.runtime.reload();
    sendResponse({ ok: true });
    return true;
  }
});
