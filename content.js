(() => {
  if (window.__ihavecpuCopyInstalled) return;
  window.__ihavecpuCopyInstalled = true;

  const STYLE_ID = "ihavecpu-copy-style";
  const BUTTON_ID = "ihavecpu-copy-floating-button";
  const ZAAPI_SELECTORS = {
    editors: ['[contenteditable="true"]', "textarea", '[role="textbox"]'],
    textarea: "textarea",
    contentEditable: '[contenteditable="true"]',
    imageComposer: "#conversation-input-toolbox-panel, [data-testid='conversation-input-toolbox-panel'], .cs-input-toolbox",
    imageInputs: 'input[type="file"]'
  };

  function clean(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function visible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function extract() {
    const titleSelectors = [
      "main h1", "h1", "[class*='product'] [class*='title']",
      "[class*='Product'] [class*='Title']", "meta[property='og:title']"
    ];
    let title = "";
    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      title = selector.startsWith("meta[") ? clean(el.content) :
        (visible(el) ? clean(el.innerText || el.textContent) : "");
      if (title && title.length > 4) break;
    }
    title = title.replace(/\s*[|–-]\s*iHAVECPU\s*$/i, "").trim();

    let price = "";
    const priceMetadataSelectors = [
      "meta[property='product:price:amount']",
      "meta[itemprop='price']",
      "[itemprop='price']"
    ];
    const priceSelectors = [
      "[class*='price']", "[id*='price']", "[class*='Price']", "[id*='Price']"
    ];
    const candidates = [];
    const isExcludedPrice = (el) => {
      const excluded = /old|original|regular|installment|monthly|strike|cross|compare|was-price|list-price|line.?through|is-old/i;
      if (el.matches("del, s, strike, [aria-label*='installment' i]")) return true;
      for (let parent = el; parent && parent !== document.body; parent = parent.parentElement) {
        if (excluded.test(`${parent.className || ""} ${parent.id || ""}`)) return true;
        if (parent.matches("del, s, strike")) return true;
        if (getComputedStyle(parent).textDecorationLine.includes("line-through")) return true;
      }
      return false;
    };
    const addPriceCandidate = (el, metadataPriority) => {
      if (isExcludedPrice(el) || (!visible(el) && !el.matches("meta"))) return;
      const raw = el.matches("meta")
        ? (el.content || "")
        : (el.getAttribute("content") || el.getAttribute("value") || el.innerText || el.textContent || "");
      const txt = clean(raw);
      if (/ราคาปกติ|ราคาเดิม|ราคาก่อนลด|ผ่อน|ต่อเดือน|รายเดือน|original price|regular price|installment|monthly/i.test(txt)) return;
      const match = txt.match(/฿\s*[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s*บาท|^[\d,]+(?:\.\d{1,2})?$/);
      if (!match) return;
      const value = clean(match[0]).replace(/\s+/g, "");
      const rect = el.getBoundingClientRect();
      const description = `${el.className || ""} ${el.id || ""} ${el.getAttribute("itemprop") || ""}`;
      candidates.push({
        value: /^฿/.test(value) ? value : `฿${value.replace(/\s*บาท$/, "")}`,
        score: metadataPriority +
          (/(current|sale|product).*price|price.*(current|sale|product)/i.test(description) ? 10 : 0) +
          (rect.width < 500 && rect.height < 100 ? 2 : 0) - (txt.length > 100 ? 3 : 0)
      });
    };
    for (const selector of priceMetadataSelectors) {
      for (const el of document.querySelectorAll(selector)) {
        addPriceCandidate(el, 100);
      }
    }
    for (const selector of priceSelectors) {
      for (const el of document.querySelectorAll(selector)) {
        addPriceCandidate(el, 0);
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    if (candidates.length) price = candidates[0].value;
    if (!price) {
      const fallback = [...document.querySelectorAll("body *")]
        .filter((el) => el.children.length === 0 && visible(el) && !isExcludedPrice(el))
        .map((el) => clean(el.innerText || el.textContent || ""))
        .find((text) => !/ราคาปกติ|ราคาเดิม|ราคาก่อนลด|ผ่อน|ต่อเดือน|รายเดือน|installment|monthly/i.test(text) &&
          /฿\s*[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s*บาท/.test(text));
      const match = fallback?.match(/฿\s*[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s*บาท/);
      if (match) price = clean(match[0]).replace(/\s+/g, "").replace(/\s*บาท$/, "");
    }

    // Prefer the main product image; fall back to Open Graph image.
    const imageSelectors = [
      "main img", "[class*='product'] img", "[class*='Product'] img",
      "meta[property='og:image']"
    ];
    let imageUrl = "";
    for (const selector of imageSelectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const candidate = el.matches("meta") ? el.content : (el.currentSrc || el.src || el.getAttribute("data-src") || "");
      if (candidate && /^https?:/i.test(candidate) && (el.matches("meta") || visible(el))) {
        imageUrl = candidate;
        if (selector === "main img" || selector === "meta[property='og:image']") break;
      }
    }
    if (!imageUrl) {
      const meta = document.querySelector("meta[property='og:image']");
      if (meta?.content) imageUrl = meta.content;
    }

    return { title, price, url: location.href.split("#")[0], imageUrl };
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      if (!ok) throw new Error("คัดลอกข้อความไม่สำเร็จ");
    }
  }

  async function fetchImageBlob(url) {
    if (!url) throw new Error("ไม่พบรูปสินค้าหลัก");
    const result = await chrome.runtime.sendMessage({ type: "FETCH_PRODUCT_IMAGE", url });
    if (!result?.dataUrl) throw new Error(result?.error || "ดึงรูปสินค้าไม่สำเร็จ");
    const blob = await (await fetch(result.dataUrl)).blob();
    if (!blob.type.startsWith("image/")) throw new Error("ไฟล์ที่พบไม่ใช่รูปภาพ");
    if (blob.type === "image/png") return blob;
    // Convert formats such as WebP/JPEG to PNG for clipboard compatibility.
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("แปลงรูปไม่สำเร็จ")), "image/png"));
  }

  function formatProductText(product) {
    return `${product.title}\n${product.price}\n\nลิงก์สินค้า: ${product.url}`;
  }

  function extractDIYPrice() {
    const labels = [...document.querySelectorAll("body *")]
      .filter((el) => el.children.length === 0 && /ยอดรวมสุทธิ\s*:?\s*/.test(el.innerText || ""));
    for (const label of labels) {
      const row = label.parentElement;
      const match = (row?.innerText || "").match(/ยอดรวมสุทธิ\s*:?\s*฿?\s*([\d,]+(?:\.\d{1,2})?)/);
      if (match) return `฿${match[1]}`;
    }
    return "";
  }

  function formatDIYText(price) {
    return `ลิงก์สินค้า: ${location.href.split("#")[0]}\n${price}`;
  }

  async function sendDIYTextToZaapi(text) {
    const result = await chrome.runtime.sendMessage({ type: "PREPARE_ZAAPI_TEXT", text });
    if (!result?.ok) throw new Error(result?.error || "ใส่ราคาและลิงก์ใน Zaapi ไม่สำเร็จ");
    showToast("ใส่ราคาและลิงก์สเป็ค DIY ในช่องแชตแล้ว — ไม่ได้แนบรูปและยังไม่ส่ง");
  }

  async function calculateAdmetaAndSendToZaapi() {
    let result;
    try {
      result = await chrome.runtime.sendMessage({
        type: "PREPARE_ADMETA_ZAAPI"
      });
    } catch (error) {
      if (/extension context invalidated/i.test(error.message || "")) {
        throw new Error("ส่วนขยายเพิ่งอัปเดต กรุณาลองคำนวณอีกครั้ง");
      }
      throw error;
    }
    if (!result?.ok) throw new Error(result?.error || "คำนวณสเป็คใน AdMeta แล้วใส่ข้อความใน Zaapi ไม่สำเร็จ");
    const specNumber = result.specNumber ? ` (${result.specNumber})` : "";
    const resetStatus = result.resetError ? ` แต่รีเซ็ต AdMeta ไม่สำเร็จ: ${result.resetError}` : " และรีเซ็ต AdMeta แล้ว";
    showToast(`คำนวณสเป็คใน AdMeta${specNumber} ใส่ข้อความใน Zaapi${resetStatus} — ยังไม่ส่ง`);
  }

  async function openPromoSetInAdmeta(product) {
    const setName = product.title.trim();
    const promoMatch = setName.match(/(?:^|[\s_(\[])(OCT[A-Z0-9]*-[A-Z0-9-]+)/i)?.[1] ||
      setName.match(/^[A-Z0-9]+(?:-[A-Z0-9]+)+/i)?.[0];
    const promoCode = promoMatch ? promoMatch.trim() : "";
    if (!promoCode) {
      throw new Error("หาไม่พบรหัสเซ็ตโปรบนหน้าสินค้า");
    }
    const result = await chrome.runtime.sendMessage({
      type: "OPEN_PROMO_SET_FOR_UPGRADE",
      searchTerm: promoCode
    });
    if (!result?.ok) throw new Error(result?.error || "เปิดเซ็ตโปรใน AdMeta ไม่สำเร็จ");
    showToast(`ค้นหาและเลือกเซ็ต ${promoCode} ใน AdMeta แล้ว — เลือกชิ้นส่วนเพื่ออัปเกรดและคำนวณราคาได้เลย`);
  }

  async function fillZaapi(product) {
    const result = await chrome.runtime.sendMessage({
      type: "PREPARE_ZAAPI_PRODUCT",
      text: formatProductText(product),
      imageUrl: product.imageUrl,
      fileName: `${(product.title || "ihavecpu-product").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80)}.png`
    });
    if (!result?.ok) throw new Error(result?.error || "ใส่ข้อความใน Zaapi ไม่สำเร็จ");
    showToast("ใส่ข้อความและแนบรูปในแชตแล้ว ตรวจสอบแล้วกดส่งเองได้เลย (ยังไม่ส่ง)");
  }

  async function downloadImage(product) {
    const blob = await fetchImageBlob(product.imageUrl);
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = (product.title || "ihavecpu-product").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) + ".png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
  }

  function showToast(message, isError = false) {
    let toast = document.getElementById("ihavecpu-copy-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "ihavecpu-copy-toast";
      Object.assign(toast.style, {
        position: "fixed", right: "18px", bottom: "82px", zIndex: "2147483647",
        maxWidth: "360px", padding: "12px 16px", borderRadius: "10px",
        boxShadow: "0 4px 18px rgba(0,0,0,.22)", font: "14px/1.5 Arial,Tahoma,sans-serif",
        color: "#fff"
      });
      document.body.appendChild(toast);
    }
    toast.style.background = isError ? "#a61b1b" : "#176b3a";
    toast.textContent = message;
    toast.style.display = "block";
    clearTimeout(toast.__hideTimer);
    toast.__hideTimer = setTimeout(() => { toast.style.display = "none"; }, 4200);
  }

  const PENDING_ACTION_STORAGE_KEY = "ihavecpu_pending_action";

  function waitForProductExtract(timeoutMs = 5000) {
    const immediate = extract();
    if (immediate.title && immediate.price) return Promise.resolve(immediate);
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        const current = extract();
        if (current.title && current.price) {
          clearInterval(timer);
          resolve(current);
        } else if (Date.now() - startedAt >= timeoutMs) {
          clearInterval(timer);
          resolve(current);
        }
      }, 250);
    });
  }

  function waitForDIYPrice(timeoutMs = 5000) {
    const immediate = extractDIYPrice();
    if (immediate) return Promise.resolve(immediate);
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        const current = extractDIYPrice();
        if (current) {
          clearInterval(timer);
          resolve(current);
        } else if (Date.now() - startedAt >= timeoutMs) {
          clearInterval(timer);
          resolve("");
        }
      }, 250);
    });
  }

  async function triggerPageResetAndContinue(kind) {
    try {
      sessionStorage.setItem(
        PENDING_ACTION_STORAGE_KEY,
        JSON.stringify({ kind, timestamp: Date.now() })
      );
    } catch {
      // Ignore storage error
    }
    showToast("พบข้อขัดข้อง กำลังรีเซ็ตหน้าเว็บทั้ง 3 อัตโนมัติแล้วทำต่อจนได้ผลลัพธ์...", false);
    try {
      await chrome.runtime.sendMessage({ type: "RESET_ALL_PAGES_ONLY", excludeSender: true });
    } catch {
      // Extension context may be invalidated; reloading this page will restore it
    }
    setTimeout(() => {
      location.reload();
    }, 300);
  }

  async function doCopy(kind = "both", isAutoRetry = false) {
    try {
      if (kind === "diy-admeta-zaapi") {
        await calculateAdmetaAndSendToZaapi();
        return;
      }

      if (kind === "promo-admeta-upgrade") {
        const product = await waitForProductExtract(isAutoRetry ? 8000 : 4000);
        await openPromoSetInAdmeta(product);
        return;
      }

      if (kind === "diy-zaapi") {
        const price = await waitForDIYPrice(isAutoRetry ? 8000 : 4000);
        if (!price || !/^https:\/\/(www\.)?ihavecpu\.com\/diy\/share\/[^/]+/i.test(location.href)) {
          throw new Error("หาไม่พบยอดรวมของสเป็ค DIY กรุณาเปิดหน้าสเป็คที่แชร์แล้วลองอีกครั้ง");
        }
        await sendDIYTextToZaapi(formatDIYText(price));
        return;
      }

      const product = await waitForProductExtract(isAutoRetry ? 8000 : 4000);
      if (!product.title || !product.price) {
        throw new Error("หาไม่พบชื่อสินค้าหรือราคา กรุณาเปิดหน้ารายละเอียดสินค้าแล้วลองอีกครั้ง");
      }

      if (kind === "text") {
        await copyText(formatProductText(product));
        showToast("คัดลอกข้อความสินค้าแล้ว");
      } else if (kind === "zaapi") {
        await fillZaapi(product);
      } else if (kind === "download") {
        await downloadImage(product);
        showToast("กำลังดาวน์โหลดรูปสินค้า");
      } else {
        await copyText(formatProductText(product));
        showToast("คัดลอกข้อความสินค้าแล้ว");
      }
    } catch (error) {
      const msg = error?.message || "";
      const isContextInvalidated = /extension context invalidated|ส่วนขยายเพิ่งอัปเดต/i.test(msg);
      const isDomMissing = /หาไม่พบชื่อสินค้า|หาไม่พบยอดรวม|หาไม่พบรหัสเซ็ตโปร|ไม่พบรูปสินค้า/i.test(msg);
      if (!isAutoRetry && (isContextInvalidated || isDomMissing)) {
        await triggerPageResetAndContinue(kind);
        return;
      }
      showToast(msg || "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง", true);
    }
  }

  function addButton() {
    const isDIYShare = /^https:\/\/(www\.)?ihavecpu\.com\/diy\/share\/[^/]+/i.test(location.href);
    const isProductPage = /^https:\/\/(www\.)?ihavecpu\.com\//i.test(location.href) && !isDIYShare;
    const existingWrap = document.getElementById(BUTTON_ID);
    const existingLauncher = document.getElementById(`${BUTTON_ID}-launcher`);
    if (!isDIYShare && !isProductPage) {
      existingWrap?.remove();
      existingLauncher?.remove();
      return;
    }

    const productTitle = isProductPage ? extract().title : "";
    const isPromoSet = /(?:^|[\s_(\[])OCT[A-Z0-9]*-[A-Z0-9-]+/i.test(productTitle);
    const actions = isDIYShare
      ? '<button data-action="diy-admeta-zaapi">คำนวณใน AdMeta แล้วใส่ข้อความใน Zaapi</button><button class="secondary" data-action="diy-zaapi">ใส่เฉพาะลิงก์ + ราคาใน Zaapi (ไม่ส่ง)</button>'
      : `${isPromoSet ? '<button data-action="promo-admeta-upgrade">เปิดเซ็ตโปรใน AdMeta เพื่ออัปเกรด/คำนวณราคา</button>' : ""}<button data-action="zaapi">เตรียมข้อความ + รูปใน Zaapi (ไม่ส่ง)</button><button class="secondary" data-action="text">คัดลอกข้อความอย่างเดียว</button><button class="secondary" data-action="download">ดาวน์โหลดรูปสินค้า</button>`;

    if (existingWrap) {
      const body = existingWrap.querySelector(".ihc-panel-body");
      if (body && body.innerHTML !== actions) body.innerHTML = actions;
      return;
    }

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        #${BUTTON_ID} { position:fixed; right:18px; bottom:18px; z-index:2147483646;
          width:max-content; max-width:calc(100vw - 24px); border-radius:13px;
          background:#fff; box-shadow:0 3px 18px rgba(0,0,0,.22); border:1px solid #e3e3e3;
          font:13px Arial,Tahoma,sans-serif; }
        #${BUTTON_ID} .ihc-panel-header { display:flex; align-items:center; justify-content:space-between;
          gap:10px; padding:8px 10px; border-bottom:1px solid #eee; cursor:move; user-select:none;
          font-weight:700; color:#333; }
        #${BUTTON_ID} .ihc-panel-controls { display:flex; gap:5px; }
        #${BUTTON_ID} .ihc-panel-controls button { padding:3px 8px; color:#333; background:#f0f1f3; }
        #${BUTTON_ID} .ihc-panel-body { display:flex; flex-direction:column; gap:7px; padding:10px; }
        #${BUTTON_ID}[data-collapsed="true"] .ihc-panel-body { display:none; }
        #${BUTTON_ID} button { border:0; border-radius:7px; padding:9px 12px; cursor:pointer;
          font-weight:700; color:#fff; background:#d71920; white-space:nowrap; }
        #${BUTTON_ID} button.secondary { color:#333; background:#f0f1f3; }
        #${BUTTON_ID} button:hover { filter:brightness(.95); }
        #${BUTTON_ID}-launcher { position:fixed; right:18px; bottom:18px; z-index:2147483646;
          border:0; border-radius:20px; padding:10px 14px; background:#d71920; color:#fff;
          box-shadow:0 3px 18px rgba(0,0,0,.22); font:700 13px Arial,Tahoma,sans-serif; cursor:pointer; }
      `;
      document.documentElement.appendChild(style);
    }
    const wrap = document.createElement("div");
    wrap.id = BUTTON_ID;
    wrap.innerHTML = `<div class="ihc-panel-header"><span>iHAVECPU • เครื่องมือสินค้า</span><span class="ihc-panel-controls"><button type="button" data-panel-action="collapse" aria-label="ย่อหน้าต่าง">−</button><button type="button" data-panel-action="hide" aria-label="ซ่อนหน้าต่าง">×</button></span></div><div class="ihc-panel-body">${actions}</div>`;
    wrap.addEventListener("click", async (event) => {
      const panelAction = event.target.closest("button[data-panel-action]");
      if (panelAction) {
        if (panelAction.dataset.panelAction === "collapse") {
          const collapsed = wrap.dataset.collapsed !== "true";
          wrap.dataset.collapsed = String(collapsed);
          panelAction.textContent = collapsed ? "+" : "−";
          panelAction.setAttribute("aria-label", collapsed ? "ขยายหน้าต่าง" : "ย่อหน้าต่าง");
          chrome.storage.local.set({ panelCollapsed: collapsed }).catch((error) =>
            showToast(`บันทึกสถานะหน้าต่างไม่สำเร็จ: ${error.message}`, true)
          );
        } else {
          wrap.style.display = "none";
          launcher.style.display = "block";
          chrome.storage.local.set({ panelHidden: true }).catch((error) =>
            showToast(`บันทึกสถานะหน้าต่างไม่สำเร็จ: ${error.message}`, true)
          );
        }
        return;
      }
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      await doCopy(button.dataset.action);
    });
    document.body.appendChild(wrap);
    const launcher = document.createElement("button");
    launcher.id = `${BUTTON_ID}-launcher`;
    launcher.type = "button";
    launcher.textContent = "เปิด iHAVECPU";
    launcher.style.display = "none";
    launcher.addEventListener("click", () => {
      wrap.style.display = "block";
      launcher.style.display = "none";
      chrome.storage.local.set({ panelHidden: false }).catch((error) =>
        showToast(`บันทึกสถานะหน้าต่างไม่สำเร็จ: ${error.message}`, true)
      );
    });
    document.body.appendChild(launcher);

    let drag = null;
    const header = wrap.querySelector(".ihc-panel-header");
    header.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      const rect = wrap.getBoundingClientRect();
      drag = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
      wrap.style.left = `${rect.left}px`;
      wrap.style.top = `${rect.top}px`;
      wrap.style.right = "auto";
      wrap.style.bottom = "auto";
      header.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    header.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const left = Math.max(0, Math.min(innerWidth - wrap.offsetWidth, event.clientX - drag.offsetX));
      const top = Math.max(0, Math.min(innerHeight - wrap.offsetHeight, event.clientY - drag.offsetY));
      wrap.style.left = `${left}px`;
      wrap.style.top = `${top}px`;
    });
    const finishDrag = async (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag = null;
      const rect = wrap.getBoundingClientRect();
      try {
        await chrome.storage.local.set({ panelPosition: { left: rect.left, top: rect.top } });
      } catch (error) {
        showToast(`บันทึกตำแหน่งหน้าต่างไม่สำเร็จ: ${error.message}`, true);
      }
    };
    header.addEventListener("pointerup", finishDrag);
    header.addEventListener("pointercancel", finishDrag);
    window.addEventListener("resize", () => {
      if (!wrap.style.left || !wrap.style.top) return;
      const rect = wrap.getBoundingClientRect();
      wrap.style.left = `${Math.max(0, Math.min(innerWidth - wrap.offsetWidth, rect.left))}px`;
      wrap.style.top = `${Math.max(0, Math.min(innerHeight - wrap.offsetHeight, rect.top))}px`;
    });

    Promise.all([
      chrome.storage.sync.get({ mode: "both" }),
      chrome.storage.local.get({ panelPosition: null, panelHidden: false, panelCollapsed: false })
    ]).then(([{ mode }, settings]) => {
      const enabled = mode !== "shortcut";
      wrap.dataset.modeHidden = String(!enabled);
      if (settings.panelPosition && Number.isFinite(settings.panelPosition.left) &&
          Number.isFinite(settings.panelPosition.top)) {
        wrap.style.left = `${Math.max(0, Math.min(innerWidth - wrap.offsetWidth, settings.panelPosition.left))}px`;
        wrap.style.top = `${Math.max(0, Math.min(innerHeight - wrap.offsetHeight, settings.panelPosition.top))}px`;
        wrap.style.right = "auto";
        wrap.style.bottom = "auto";
      }
      if (settings.panelCollapsed) {
        wrap.dataset.collapsed = "true";
        wrap.querySelector('[data-panel-action="collapse"]').textContent = "+";
      }
      wrap.style.display = enabled && !settings.panelHidden ? "block" : "none";
      launcher.style.display = enabled && settings.panelHidden ? "block" : "none";
    }).catch((error) => showToast(`โหลดการตั้งค่าหน้าต่างไม่สำเร็จ: ${error.message}`, true));
  }

  let lastPageKey = "";
  function syncPageControls() {
    const pageKey = `${location.href}\n${document.title}\n${document.querySelector("main h1, h1")?.textContent || ""}`;
    if (pageKey === lastPageKey) return;
    lastPageKey = pageKey;
    addButton();
  }

  syncPageControls();
  window.addEventListener("popstate", syncPageControls);
  window.addEventListener("hashchange", syncPageControls);
  window.setInterval(syncPageControls, 500);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.mode) return;
    const wrap = document.getElementById(BUTTON_ID);
    const launcher = document.getElementById(`${BUTTON_ID}-launcher`);
    const enabled = changes.mode.newValue !== "shortcut";
    if (wrap) {
      wrap.dataset.modeHidden = String(!enabled);
      chrome.storage.local.get({ panelHidden: false }).then(({ panelHidden }) => {
        wrap.style.display = enabled && !panelHidden ? "block" : "none";
        if (launcher) launcher.style.display = enabled && panelHidden ? "block" : "none";
      }).catch((error) => showToast(`โหลดการตั้งค่าหน้าต่างไม่สำเร็จ: ${error.message}`, true));
    }
  });

  function isFormFieldChanged(el) {
    if (!el || el.disabled || el.readOnly) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === "input") {
      const type = (el.type || "text").toLowerCase();
      if (["hidden", "button", "submit", "reset", "image"].includes(type)) return false;
      if (type === "checkbox" || type === "radio") {
        return el.checked !== el.defaultChecked;
      }
      return el.value !== el.defaultValue && el.value.trim().length > 0;
    }
    if (tag === "textarea") {
      return el.value !== el.defaultValue && el.value.trim().length > 0;
    }
    if (tag === "select") {
      return [...el.options].some((opt) => opt.selected !== opt.defaultSelected);
    }
    return false;
  }

  function checkDIYUnsavedInput() {
    if (!/\/diy(?:\/|$)/i.test(location.pathname)) return false;
    for (const form of document.forms) {
      for (const el of form.elements) {
        if (isFormFieldChanged(el)) return true;
      }
    }
    const controls = document.querySelectorAll("input, select, textarea");
    for (const el of controls) {
      if (isFormFieldChanged(el)) return true;
    }
    return false;
  }

  function checkZaapiUnsavedInput() {
    if (location.hostname !== "app.zaapi.com") return false;
    const textareas = document.querySelectorAll("textarea");
    for (const ta of textareas) {
      if (!ta.disabled && !ta.readOnly && (ta.value || "").trim().length > 0) return true;
    }
    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const ce of editables) {
      if (ce.getAttribute("aria-disabled") === "true") continue;
      const text = (ce.innerText || ce.textContent || "").replace(/[\u200B\u00A0\s]+/g, "").trim();
      if (text.length > 0) return true;
    }
    const fileInputs = document.querySelectorAll('input[type="file"]');
    for (const fi of fileInputs) {
      if (fi.files && fi.files.length > 0) return true;
    }
    return false;
  }

  if (location.hostname === "app.zaapi.com") {
    let lastInteractionSentAt = 0;
    const notifyZaapiInteraction = () => {
      const now = Date.now();
      if (now - lastInteractionSentAt < 300) return;
      lastInteractionSentAt = now;
      chrome.runtime.sendMessage({ type: "ZAAPI_TAB_INTERACTED" }).catch(() => {});
    };
    window.addEventListener("pointerdown", notifyZaapiInteraction, true);
    window.addEventListener("keydown", notifyZaapiInteraction, true);
    window.addEventListener("focus", notifyZaapiInteraction, true);
    if (document.hasFocus()) {
      notifyZaapiInteraction();
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "CHECK_UNSAVED_INPUT") {
      if (location.hostname === "app.zaapi.com") {
        sendResponse({
          hasUnsaved: checkZaapiUnsavedInput(),
          title: document.title?.trim() || "Zaapi"
        });
        return;
      }
      if (/^https:\/\/(www\.)?ihavecpu\.com\//i.test(location.href)) {
        sendResponse({
          hasUnsaved: checkDIYUnsavedInput(),
          title: document.title?.trim() || "iHAVECPU DIY"
        });
        return;
      }
      sendResponse({ hasUnsaved: false, title: document.title?.trim() || "" });
      return;
    }
    if (message?.type === "GET_PRODUCT_DATA") {
      const product = extract();
      sendResponse(product.title && product.price && product.imageUrl
        ? {
          text: formatProductText(product),
          imageUrl: product.imageUrl,
          fileName: `${(product.title || "ihavecpu-product").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80)}.png`
        }
        : { error: "หาไม่พบชื่อสินค้า ราคา หรือรูป" });
      return;
    }
    if (message?.type === "PREPARE_ZAAPI_PRODUCT" && location.hostname === "app.zaapi.com") {
      prepareZaapiProduct(message)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: error.message || "แนบรูปใน Zaapi ไม่สำเร็จ" }));
      return true;
    }
    if (message?.type === "INSERT_ZAAPI_MESSAGE") {
      insertZaapiMessage(message.text)
        .then((result) => {
          if (result.ok) showToast("ใส่ข้อความในแชตแล้ว — ยังไม่ได้ส่ง");
          sendResponse(result);
        })
        .catch((error) => sendResponse({ ok: false, error: error.message || "ใส่ข้อความใน Zaapi ไม่สำเร็จ" }));
      return true;
    }
    if (message?.type === "SHOW_STATUS") {
      showToast(message.message || "", message.isError === true);
    }
  });

  function isVisibleEditor(el) {
    return visible(el) && !el.disabled && !el.readOnly && el.getAttribute("aria-disabled") !== "true";
  }

  function findZaapiComposer() {
    const candidates = [...new Set(ZAAPI_SELECTORS.editors.flatMap((selector) => [...document.querySelectorAll(selector)]))]
      .filter(isVisibleEditor);
    const messageHint = /(message|chat|reply|ข้อความ|ตอบกลับ)/i;
    const hinted = candidates.find((el) => {
      const hint = [
        el.getAttribute("placeholder"),
        el.getAttribute("aria-label"),
        el.getAttribute("data-placeholder"),
        el.getAttribute("title")
      ].filter(Boolean).join(" ");
      return messageHint.test(hint);
    });
    if (hinted) return hinted;

    const focused = candidates.find((el) =>
      el === document.activeElement &&
      (el.matches(ZAAPI_SELECTORS.textarea) || el.matches(ZAAPI_SELECTORS.contentEditable))
    );
    if (focused) return focused;

    const textEditors = candidates.filter((el) =>
      el.matches(ZAAPI_SELECTORS.textarea) || el.matches(ZAAPI_SELECTORS.contentEditable)
    );
    return textEditors.length === 1 ? textEditors[0] : null;
  }

  function waitForZaapiComposer(timeoutMs = 8000) {
    const immediate = findZaapiComposer();
    if (immediate) return Promise.resolve(immediate);
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        const found = findZaapiComposer();
        if (found) {
          clearInterval(timer);
          resolve(found);
        } else if (Date.now() - startedAt >= timeoutMs) {
          clearInterval(timer);
          resolve(null);
        }
      }, 250);
    });
  }

  async function insertZaapiMessage(text) {
    if (location.hostname !== "app.zaapi.com" || typeof text !== "string" || !text.trim()) {
      return { ok: false, error: "คำขอใส่ข้อความไม่ถูกต้อง" };
    }
    const editor = await waitForZaapiComposer(8000);
    if (!editor) {
      return { ok: false, error: "ไม่พบช่องพิมพ์ข้อความในแชต Zaapi กรุณาเปิดห้องแชตก่อน" };
    }

    editor.focus();
    if (editor.matches(ZAAPI_SELECTORS.textarea)) {
      const current = editor.value || "";
      if (current.includes(text)) return { ok: true, alreadyPresent: true };
      const next = current ? `${current}\n\n${text}` : text;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(editor, next);
      editor.setSelectionRange(next.length, next.length);
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      return { ok: true };
    }
    const current = editor.innerText || editor.textContent || "";
    if (current.includes(text)) return { ok: true, alreadyPresent: true };
    const insertion = current.trim() ? `\n\n${text}` : text;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const fragment = document.createDocumentFragment();
    insertion.split("\n").forEach((line, index) => {
      if (index) fragment.append(document.createElement("br"));
      if (line) fragment.append(document.createTextNode(line));
    });
    const lastNode = fragment.lastChild;
    range.insertNode(fragment);
    if (lastNode) {
      range.setStartAfter(lastNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: insertion }));
    return { ok: true };
  }

  function findZaapiImageInput(editor) {
    const composer = editor.closest(ZAAPI_SELECTORS.imageComposer);
    if (!composer) return null;

    const inputs = [...composer.querySelectorAll(ZAAPI_SELECTORS.imageInputs)]
      .filter((input) => {
        const accept = (input.accept || "").trim();
        return !accept || accept === "*/*" || /(image|\.png|\.jpe?g|\.webp|\.gif)/i.test(accept);
      });
    return inputs.length === 1 ? inputs[0] : null;
  }

  async function prepareZaapiProduct({ text, imageDataUrl, fileName }) {
    if (location.hostname !== "app.zaapi.com" || typeof text !== "string" || !text.trim()) {
      throw new Error("ข้อมูลสินค้าไม่ถูกต้อง");
    }
    if (typeof imageDataUrl !== "string" || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(imageDataUrl)) {
      throw new Error("ข้อมูลรูปสินค้าไม่ถูกต้อง");
    }
    const editor = await waitForZaapiComposer(8000);
    if (!editor) throw new Error("ไม่พบช่องพิมพ์ข้อความใน Zaapi (ช่องพิมพ์แชต) กรุณาเปิดห้องแชตก่อน");
    const imageInput = findZaapiImageInput(editor);
    if (!imageInput) throw new Error("ไม่พบช่องแนบรูปของช่องพิมพ์แชต Zaapi");

    const imageBlob = await (await fetch(imageDataUrl)).blob();
    if (!imageBlob.type.startsWith("image/") || imageBlob.size > 16 * 1024 * 1024) {
      throw new Error("ไฟล์รูปไม่ถูกต้องหรือมีขนาดใหญ่เกินไป");
    }
    const extension = imageBlob.type === "image/jpeg" ? "jpg" : imageBlob.type.split("/")[1];
    const baseName = (fileName || "ihavecpu-product").replace(/\.[^.]+$/, "");
    const imageFile = new File([imageBlob], `${baseName}.${extension}`, { type: imageBlob.type });
    const transfer = new DataTransfer();
    [...imageInput.files].forEach((file) => {
      if (file.name !== imageFile.name || file.size !== imageFile.size) transfer.items.add(file);
    });
    transfer.items.add(imageFile);

    const inserted = await insertZaapiMessage(text);
    if (!inserted.ok) throw new Error(inserted.error || "ใส่ข้อความใน Zaapi ไม่สำเร็จ");
    imageInput.files = transfer.files;
    if (![...imageInput.files].some((file) => file.name === imageFile.name && file.size === imageFile.size)) {
      throw new Error("Zaapi ไม่รับไฟล์รูปในช่องพิมพ์แชต กรุณาแนบรูปด้วยตนเอง");
    }
    imageInput.dispatchEvent(new Event("input", { bubbles: true }));
    imageInput.dispatchEvent(new Event("change", { bubbles: true }));
    showToast("ใส่ข้อความและแนบรูปในแชตแล้ว ยังไม่ได้ส่ง — ตรวจสอบแล้วกดส่งเอง");
    return { ok: true, textInserted: true, imageAttached: true, sent: false };
  }

  function resumePendingActionIfAny() {
    if (!/^https:\/\/(www\.)?ihavecpu\.com\//i.test(location.href)) return;
    let raw = null;
    try {
      raw = sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY);
      if (raw) sessionStorage.removeItem(PENDING_ACTION_STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let pending;
    try {
      pending = JSON.parse(raw);
    } catch {
      return;
    }
    if (!pending?.kind || typeof pending.timestamp !== "number" || Date.now() - pending.timestamp > 45000) {
      return;
    }

    setTimeout(() => {
      showToast("รีเซ็ตหน้าเว็บแล้ว กำลังทำรายการต่อให้อัตโนมัติ...", false);
      doCopy(pending.kind, true);
    }, 1000);
  }

  addButton();
  resumePendingActionIfAny();
})();