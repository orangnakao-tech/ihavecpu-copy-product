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
    const h1El = document.querySelector("main h1, h1");
    const h1Rect = h1El && visible(h1El) ? h1El.getBoundingClientRect() : null;
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
      if (!el || !(el instanceof Element)) return false;
      const excluded = /old|original|regular|installment|monthly|strike|cross|compare|was-price|list-price|line.?through|is-old|discount-percent|badge/i;
      if (el.matches("del, s, strike, [aria-label*='installment' i]")) return true;
      for (let parent = el; parent && parent !== document.body; parent = parent.parentElement) {
        if (excluded.test(`${parent.className || ""} ${parent.id || ""}`)) return true;
        if (parent.matches("del, s, strike")) return true;
        const tdLine = getComputedStyle(parent).textDecorationLine || getComputedStyle(parent).textDecoration || "";
        if (tdLine.includes("line-through")) return true;
      }
      return false;
    };
    const getCleanPriceText = (el) => {
      if (el.matches("meta")) return clean(el.content || "");
      const attrVal = el.getAttribute("content") || el.getAttribute("value");
      if (attrVal) return clean(attrVal);
      if (el.children.length === 0) return clean(el.innerText || el.textContent || "");
      let parts = [];
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const t = clean(node.nodeValue || "");
          if (t) parts.push(t);
        } else if (node.nodeType === Node.ELEMENT_NODE && !isExcludedPrice(node) && node.children.length === 0) {
          const t = clean(node.innerText || node.textContent || "");
          if (t) parts.push(t);
        }
      }
      return clean(parts.join(" "));
    };
    const addPriceCandidate = (el, metadataPriority) => {
      if (isExcludedPrice(el) || (!visible(el) && !el.matches("meta"))) return;
      const txt = getCleanPriceText(el);
      if (!txt || /ราคาปกติ|ราคาเดิม|ราคาก่อนลด|ผ่อน|ต่อเดือน|รายเดือน|ประหยัด|original price|regular price|installment|monthly/i.test(txt)) return;
      const match = txt.match(/฿\s*[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s*บาท|^[\d,]+(?:\.\d{1,2})?$/);
      if (!match) return;
      const value = clean(match[0]).replace(/\s+/g, "");
      const rect = el.getBoundingClientRect();
      const description = `${el.className || ""} ${el.id || ""} ${el.getAttribute("itemprop") || ""}`;
      const fontSize = el.matches("meta") ? 16 : (parseFloat(getComputedStyle(el).fontSize) || 14);
      const nearH1Bonus = h1Rect && rect.top >= h1Rect.top - 40 && rect.top <= h1Rect.bottom + 360 ? 45 : 0;
      const fontSizeBonus = fontSize >= 20 ? 25 : (fontSize >= 17 ? 10 : 0);
      candidates.push({
        value: /^฿/.test(value) ? value : `฿${value.replace(/\s*บาท$/, "")}`,
        score: metadataPriority +
          nearH1Bonus +
          fontSizeBonus +
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
        addPriceCandidate(el, 15);
      }
    }
    for (const el of document.querySelectorAll("main *, [class*='product'] *, [class*='Product'] *")) {
      if (el.children.length <= 3) {
        addPriceCandidate(el, 0);
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    if (candidates.length) price = candidates[0].value;
    if (!price) {
      const fallback = [...document.querySelectorAll("body *")]
        .filter((el) => el.children.length <= 2 && visible(el) && !isExcludedPrice(el))
        .map((el) => getCleanPriceText(el))
        .find((text) => text && !/ราคาปกติ|ราคาเดิม|ราคาก่อนลด|ผ่อน|ต่อเดือน|รายเดือน|installment|monthly/i.test(text) &&
          /฿\s*[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s*บาท/.test(text));
      const match = fallback?.match(/฿\s*[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s*บาท/);
      if (match) price = clean(match[0]).replace(/\s+/g, "").replace(/\s*บาท$/, "");
    }

    // Prefer the main product image (largest visible product image on S3); keep fallback URLs.
    const scoredImages = [];
    const seenUrls = new Set();
    const imgElements = document.querySelectorAll("main img, [class*='product'] img, [class*='Product'] img");
    for (const img of imgElements) {
      if (!visible(img)) continue;
      const candidate = clean(img.currentSrc || img.src || img.getAttribute("data-src") || "");
      if (!candidate || !/^https?:/i.test(candidate) || seenUrls.has(candidate)) continue;
      const rect = img.getBoundingClientRect();
      if (rect.width < 55 || rect.height < 55) continue;
      seenUrls.add(candidate);
      const isS3 = /ihcupload-bkk\.s3\.ap-southeast-7\.amazonaws\.com/i.test(candidate);
      const isLarge = rect.width >= 160 && rect.height >= 160;
      const nearTopBonus = rect.top >= 0 && rect.top <= 750 ? 200 : 0;
      const score = (isS3 ? 1000 : 0) + (isLarge ? 500 : 0) + nearTopBonus + Math.min(rect.width, 600);
      scoredImages.push({ url: candidate, score });
    }
    scoredImages.sort((a, b) => b.score - a.score);
    const ogMeta = document.querySelector("meta[property='og:image']");
    const ogUrl = clean(ogMeta?.content || "");
    if (ogUrl && /^https?:/i.test(ogUrl) && !seenUrls.has(ogUrl)) {
      scoredImages.push({ url: ogUrl, score: 100 });
    }
    const imageUrls = scoredImages.map((item) => item.url);
    const imageUrl = imageUrls[0] || "";

    let sku = "";
    const skuSelectors = [
      "[itemprop='sku']",
      "meta[property*='sku' i]",
      "meta[name*='sku' i]"
    ];
    for (const sel of skuSelectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const val = clean(el.content || el.getAttribute("content") || el.innerText || el.textContent || "");
      if (val) {
        sku = val.replace(/^รหัสสินค้า\s*:?\s*/i, "").trim();
        if (sku) break;
      }
    }
    if (!sku) {
      const textElements = [...document.querySelectorAll("main *, [class*='product'] *, [class*='Product'] *, body *")]
        .filter((el) => el.children.length === 0 && visible(el));
      for (const el of textElements) {
        const txt = clean(el.innerText || el.textContent || "");
        const m1 = txt.match(/รหัสสินค้า\s*:?\s*([A-Za-z0-9_./-]+)/i);
        if (m1?.[1]) {
          sku = m1[1].trim();
          break;
        }
        const m2 = txt.match(/\b(SKU-[A-Za-z0-9_-]+)\b/i);
        if (m2?.[1]) {
          sku = m2[1].trim();
          break;
        }
      }
    }
    if (!sku) {
      const fullBodyText = document.body?.innerText || "";
      const bodyMatch = fullBodyText.match(/รหัสสินค้า\s*:?\s*([A-Za-z0-9_./-]+)/i) ||
        fullBodyText.match(/\b(SKU-[A-Za-z0-9_-]+)\b/i);
      if (bodyMatch?.[1]) {
        sku = bodyMatch[1].trim();
      }
    }

    return { title, sku, price, url: location.href.split("#")[0], imageUrl, imageUrls };
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

  function parsePriceNumber(priceStr) {
    const cleaned = String(priceStr || "").replace(/[^0-9.]/g, "");
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : NaN;
  }

  function formatProductText(product) {
    const lines = [product.title];
    if (product.sku) {
      lines.push(`รหัสสินค้า: ${product.sku.replace(/^รหัสสินค้า\s*:?\s*/i, "")}`);
    }
    lines.push(product.price);
    const base = lines.filter(Boolean).join("\n");

    const numericPrice = parsePriceNumber(product.price);
    let result = base;
    if (Number.isFinite(numericPrice) && numericPrice > 0 && numericPrice < 5000) {
      const total = numericPrice + 50;
      const hasComma = String(product.price || "").includes(",");
      const totalStr = Number.isInteger(total)
        ? (hasComma ? total.toLocaleString("en-US") : String(total))
        : (hasComma ? total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : total.toFixed(2));
      result = `${base}\n\n+50.- ค่าส่ง\n\n= ${totalStr}.-`;
    }

    const linkUrl = product.url || location.href.split("#")[0];
    return linkUrl ? `${result}\n\nลิงก์สินค้า: ${linkUrl}` : result;
  }

  function formatAddProductText(product) {
    const numericPrice = parsePriceNumber(product.price);
    let pricePart = String(product.price || "").replace(/^[฿+\s]+/, "").replace(/\s*บาท$/, "").trim();
    if (Number.isFinite(numericPrice) && numericPrice > 0) {
      pricePart = Number.isInteger(numericPrice)
        ? numericPrice.toLocaleString("en-US")
        : numericPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return `+${pricePart} ${(product.title || "").trim()}`;
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
    const promoMatch = setName.match(/(?:^|[\s_(\[])((?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z0-9]*-[A-Z0-9-]+)/i)?.[1] ||
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

  async function searchSpecInAdmeta(rawQuery) {
    const cleaned = clean(rawQuery);
    if (!cleaned) {
      showToast("กรุณาพิมพ์คำค้นหางบหรือสเป็คก่อนกด Enter", true);
      return;
    }
    const normalizedQuery = cleaned.replace(/^เซ็ตคอม(?:พิวเตอร์)?\s+(?=งบ|\d)/i, "").trim() || cleaned;
    const result = await chrome.runtime.sendMessage({
      type: "SEARCH_ADMETA_SPEC",
      searchTerm: normalizedQuery
    });
    if (!result?.ok) throw new Error(result?.error || "ค้นหาสเป็คใน AdMeta ไม่สำเร็จ");
    showToast(
      result.loadedFromHistory
        ? `เปิดประวัติและโหลดสเปก "${result.searchTerm || normalizedQuery}" ในหน้า AdMeta แล้ว`
        : `ค้นหา "${normalizedQuery}" ในหน้า AdMeta แล้ว`
    );
  }

  async function fillZaapi(product) {
    const formattedText = formatProductText(product);
    const numericPrice = parsePriceNumber(product.price);
    const hasShipping50 = Number.isFinite(numericPrice) && numericPrice > 0 && numericPrice < 5000;
    const result = await chrome.runtime.sendMessage({
      type: "PREPARE_ZAAPI_PRODUCT",
      text: formattedText,
      imageUrl: product.imageUrl,
      imageUrls: product.imageUrls || (product.imageUrl ? [product.imageUrl] : []),
      allowTextOnlyFallback: true,
      fileName: `${(product.title || "ihavecpu-product").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80)}.png`
    });
    if (!result?.ok) throw new Error(result?.error || "ใส่ข้อความใน Zaapi ไม่สำเร็จ");
    showToast(
      hasShipping50
        ? "ใส่ข้อความ (+50.- ค่าส่ง) และแนบรูปในแชตแล้ว ตรวจสอบแล้วกดส่งเองได้เลย (ยังไม่ส่ง)"
        : "ใส่ข้อความและแนบรูปในแชตแล้ว ตรวจสอบแล้วกดส่งเองได้เลย (ยังไม่ส่ง)"
    );
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
    if (location.hostname === "app.zaapi.com") {
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "ihavecpu-copy-toast";
        document.body.appendChild(toast);
      }
      Object.assign(toast.style, {
        position: "fixed",
        right: "18px",
        bottom: "82px",
        zIndex: "2147483647",
        width: "14px",
        height: "14px",
        padding: "0",
        borderRadius: "50%",
        background: isError ? "#ef4444" : "#22c55e",
        boxShadow: isError
          ? "0 0 0 4px rgba(239, 68, 68, 0.28), 0 2px 8px rgba(0,0,0,.3)"
          : "0 0 0 4px rgba(34, 197, 94, 0.28), 0 2px 8px rgba(0,0,0,.3)",
        pointerEvents: "none",
        transition: "transform 0.18s ease, opacity 0.18s ease",
        transform: "scale(1)",
        opacity: "1",
        display: "block"
      });
      toast.textContent = "";
      toast.title = message || "";
      clearTimeout(toast.__hideTimer);
      clearTimeout(toast.__fadeTimer);
      toast.__hideTimer = setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "scale(0.6)";
        toast.__fadeTimer = setTimeout(() => { toast.style.display = "none"; }, 180);
      }, 1500);
      return;
    }

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

  let currentPlatformMode = "zaapi";

  function isComputerSetProduct(title) {
    const t = (title || "").trim();
    if (/(?:^|[\s_(\[])(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z0-9]*-[A-Z0-9-]+/i.test(t)) {
      return true;
    }
    if (/^[A-Z]{2,8}\d{2}-[A-Z0-9]+-\d+/i.test(t)) {
      return true;
    }
    if (/(?:เซ็ตคอม|คอมเซ็ต|ชุดคอมประกอบ|คอมประกอบ|PC\s*SET|COMPUTER\s*SET)/i.test(t)) {
      return true;
    }
    const breadcrumbText = (document.querySelector("nav, [class*='breadcrumb']")?.innerText || "").trim();
    if (/(?:จัดสเปคคอม|คอมพิวเตอร์เซ็ต|เซ็ตคอม|คอมเซ็ต|computer\s*set)/i.test(breadcrumbText)) {
      return true;
    }
    return false;
  }

  async function openPlatformCalculator(payload) {
    let result;
    try {
      result = await chrome.runtime.sendMessage({
        type: "OPEN_PLATFORM_CALCULATOR",
        ...payload
      });
    } catch (error) {
      if (/extension context invalidated/i.test(error.message || "")) {
        throw new Error("ส่วนขยายเพิ่งอัปเดต กรุณาลองคำนวณราคาสินค้าแพทฟอมอีกครั้ง");
      }
      throw error;
    }
    if (!result?.ok) {
      throw new Error(result?.error || "เปิดหน้าคำนวณราคาสินค้าแพทฟอมไม่สำเร็จ");
    }
    return result;
  }

  async function calculateAdmetaAndCopyOnly() {
    let result;
    try {
      result = await chrome.runtime.sendMessage({
        type: "PREPARE_ADMETA_COPY_ONLY"
      });
    } catch (error) {
      if (/extension context invalidated/i.test(error.message || "")) {
        throw new Error("ส่วนขยายเพิ่งอัปเดต กรุณาลองคำนวณอีกครั้ง");
      }
      throw error;
    }
    if (!result?.ok || !result.text) {
      throw new Error(result?.error || "คำนวณสเป็คใน AdMeta ไม่สำเร็จ");
    }
    await copyText(result.text);
    const specNumber = result.specNumber ? ` (${result.specNumber})` : "";
    showToast(`คำนวณสเป็คใน AdMeta${specNumber} และคัดลอกข้อความแล้ว (โหมดแพทฟอม)`);
  }

  async function doCopy(kind = "both", isAutoRetry = false) {
    try {
      if (kind === "diy-admeta-zaapi") {
        await calculateAdmetaAndSendToZaapi();
        return;
      }

      if (kind === "platform-diy-admeta") {
        await calculateAdmetaAndCopyOnly();
        return;
      }

      if (kind === "platform-calc-diy" || kind === "platform-calc-diy-reset") {
        if (!/^https:\/\/(www\.)?ihavecpu\.com\/diy\/share\/[^/]+/i.test(location.href)) {
          throw new Error("กรุณาเปิดหน้าแชร์สเป็ค DIY ก่อนคำนวณราคาสินค้าแพทฟอม");
        }
        const diyUrl = location.href.split("#")[0];
        const resetFirst = kind === "platform-calc-diy-reset";
        await copyText(diyUrl);
        await openPlatformCalculator({ kind: "diy", diyUrl, resetFirst });
        showToast(
          resetFirst
            ? "รีเซ็ตรายการเก่าและวางลิงก์ DIY ในหน้าคำนวณราคาแพทฟอมแล้ว"
            : "คัดลอกลิงก์ DIY และเปิดหน้าคำนวณราคาแพทฟอมแล้ว"
        );
        return;
      }

      if (kind === "promo-admeta-upgrade") {
        const product = await waitForProductExtract(isAutoRetry ? 8000 : 4000);
        await openPromoSetInAdmeta(product);
        return;
      }

      if (kind === "diy-zaapi" || kind === "platform-diy-text") {
        const price = await waitForDIYPrice(isAutoRetry ? 8000 : 4000);
        if (!price || !/^https:\/\/(www\.)?ihavecpu\.com\/diy\/share\/[^/]+/i.test(location.href)) {
          throw new Error("หาไม่พบยอดรวมของสเป็ค DIY กรุณาเปิดหน้าสเป็คที่แชร์แล้วลองอีกครั้ง");
        }
        if (kind === "platform-diy-text") {
          await copyText(formatDIYText(price));
          showToast("คัดลอกลิงก์และราคาสเป็ค DIY แล้ว (โหมดแพทฟอม)");
        } else {
          await sendDIYTextToZaapi(formatDIYText(price));
        }
        return;
      }

      const product = await waitForProductExtract(isAutoRetry ? 8000 : 4000);
      if (!product.title || !product.price) {
        throw new Error("หาไม่พบชื่อสินค้าหรือราคา กรุณาเปิดหน้ารายละเอียดสินค้าแล้วลองอีกครั้ง");
      }

      if (kind === "text") {
        await copyText(formatAddProductText(product));
        showToast("คัดลอกข้อความเพื่อเพิ่มสินค้าแล้ว");
      } else if (kind === "platform-calc-product" || kind === "platform-calc-product-reset" || kind === "platform-product") {
        const resetFirst = kind === "platform-calc-product-reset";
        await copyText(product.title);
        const itemKind = isComputerSetProduct(product.title) ? "comset" : "normal";
        await openPlatformCalculator({ kind: itemKind, title: product.title, resetFirst });
        if (resetFirst) {
          showToast(
            itemKind === "comset"
              ? "รีเซ็ตรายการเก่าและเพิ่มคอมเซ็ตในหน้าคำนวณราคาแพทฟอมแล้ว"
              : "รีเซ็ตรายการเก่าและเพิ่มสินค้าปกติในหน้าคำนวณราคาแพทฟอมแล้ว"
          );
        } else {
          showToast(
            itemKind === "comset"
              ? "คัดลอกชื่อเซ็ตคอมและเพิ่มคอมเซ็ตในหน้าคำนวณราคาแพทฟอมแล้ว"
              : "คัดลอกชื่อสินค้าและเพิ่มสินค้าปกติในหน้าคำนวณราคาแพทฟอมแล้ว"
          );
        }
      } else if (kind === "zaapi") {
        await fillZaapi(product);
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

  let dismissedUpdateVersion = "";

  function showUpdateNotice(status) {
    if (!status || (!status.diskNeedsReload && !status.remoteHasNewer)) {
      document.getElementById("ihavecpu-update-notice")?.remove();
      return;
    }
    const targetVersion = status.remoteVersion || status.diskVersion || "ใหม่";
    try {
      if (dismissedUpdateVersion === targetVersion || sessionStorage.getItem("ihavecpu_dismissed_update") === targetVersion) {
        return;
      }
    } catch {}

    const defaultNotes = [
      "+ โหมดแพทฟอม (สีส้ม) คำนวณราคา + รีเซ็ตรายการเก่า",
      "+ ปุ่มรีเซ็ตรายการใหม่ในหน้าคำนวณแพลตฟอร์ม",
      "+ ค้นหารหัส SB-xxxx-xxxxx โหลดประวัติทันที",
      "+ แก้บัครูป UPS & สินค้าลดราคา / ซ่อนปุ่มหน้าค้นหา"
    ];
    const notesList = Array.isArray(status.releaseNotes) && status.releaseNotes.length > 0
      ? status.releaseNotes
      : defaultNotes;

    let box = document.getElementById("ihavecpu-update-notice");
    if (!box) {
      box = document.createElement("div");
      box.id = "ihavecpu-update-notice";
      Object.assign(box.style, {
        position: "fixed",
        right: "18px",
        top: "18px",
        zIndex: "2147483647",
        width: "340px",
        maxWidth: "calc(100vw - 28px)",
        background: "linear-gradient(135deg, #fff8f6 0%, #ffffff 100%)",
        border: "2px solid #d71920",
        borderRadius: "12px",
        boxShadow: "0 6px 24px rgba(0,0,0,.25)",
        padding: "12px 14px",
        font: "13px/1.45 Arial,Tahoma,sans-serif",
        color: "#222"
      });
      box.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;">
          <strong style="color:#202124;font-size:13.5px;display:flex;align-items:center;gap:5px;">
            <span style="background:#d71920;color:#fff;padding:1px 8px;border-radius:10px;font-size:12px;">ver.<span class="ihc-update-ver"></span></span>
            <span>อัพเดทใหม่<span style="color:#d71920;font-weight:900;margin-left:1px;">!!!</span></span>
          </strong>
          <button type="button" data-update-close="1" aria-label="ปิดข้อความ" title="ปิดข้อความ" style="border:0;background:#f2f4f7;color:#333;width:26px;height:26px;border-radius:6px;cursor:pointer;font:700 16px/1 Arial,sans-serif;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
        <div class="ihc-update-notes" style="margin-bottom:8px;display:flex;flex-direction:column;gap:4px;font-size:12px;"></div>
        <div class="ihc-update-msg" style="margin-bottom:9px;color:#555;font-size:11.5px;">
          กดรีเซ็ต (ปุ่มลูกศรหมุน 🔄) ที่หน้าส่วนขยาย Chrome เพื่อใช้เวอร์ชันใหม่
        </div>
        <a href="chrome://extensions/" data-open-extensions="1" style="display:block;text-align:center;background:#d71920;color:#fff;text-decoration:none;font-weight:700;padding:8px 12px;border-radius:8px;cursor:pointer;">
          ไปที่หน้าส่วนขยาย (chrome://extensions/)
        </a>
      `;
      box.addEventListener("click", (event) => {
        if (event.target.closest("[data-update-close]")) {
          dismissedUpdateVersion = box.dataset.version || targetVersion;
          try {
            sessionStorage.setItem("ihavecpu_dismissed_update", dismissedUpdateVersion);
          } catch {}
          box.remove();
          return;
        }
        const openLink = event.target.closest("[data-open-extensions]");
        if (openLink) {
          event.preventDefault();
          chrome.runtime.sendMessage({ type: "OPEN_CHROME_EXTENSIONS_PAGE" }).catch(() => {});
        }
      });
      document.body.appendChild(box);
    }
    box.dataset.version = targetVersion;
    const verSpan = box.querySelector(".ihc-update-ver");
    if (verSpan) verSpan.textContent = String(targetVersion).replace(/^v/i, "");
    const notesContainer = box.querySelector(".ihc-update-notes");
    if (notesContainer) {
      const palette = [
        { bg: "#fff7ed", text: "#c2410c", badge: "#ea580c" },
        { bg: "#eff6ff", text: "#1d4ed8", badge: "#2563eb" },
        { bg: "#f0fdf4", text: "#15803d", badge: "#16a34a" },
        { bg: "#faf5ff", text: "#6d28d9", badge: "#7c3aed" }
      ];
      notesContainer.innerHTML = "";
      notesList.forEach((note, idx) => {
        const cleanText = String(note || "").trim().replace(/^\+\s*(?:อัพเดท)?/i, "").trim();
        if (!cleanText) return;
        const p = palette[idx % palette.length];
        const row = document.createElement("div");
        Object.assign(row.style, {
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 8px",
          borderRadius: "6px",
          background: p.bg,
          color: p.text,
          fontWeight: "700"
        });
        const badge = document.createElement("span");
        Object.assign(badge.style, {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          background: p.badge,
          color: "#fff",
          fontWeight: "900",
          fontSize: "11px",
          flexShrink: "0"
        });
        badge.textContent = "+";
        const span = document.createElement("span");
        span.textContent = cleanText;
        row.appendChild(badge);
        row.appendChild(span);
        notesContainer.appendChild(row);
      });
    }
  }

  function buildActionsHtml(isDIYShare, hasProduct, isPromoSet, platformMode) {
    const isPlatform = platformMode === "platform";
    if (isDIYShare) {
      return isPlatform
        ? '<button data-action="platform-calc-diy">คำนวณราคาสินค้าแพทฟอม</button><button class="secondary" data-action="platform-calc-diy-reset">คำนวณพร้อมรีเซ็ตรายการเก่าออก</button>'
        : '<button data-action="diy-admeta-zaapi">คำนวณใน AdMeta แล้วใส่ข้อความใน Zaapi</button><button class="secondary" data-action="diy-zaapi">ใส่เฉพาะลิงก์ + ราคาใน Zaapi (ไม่ส่ง)</button>';
    }
    if (!hasProduct) return "";
    const promoBtn = isPromoSet ? '<button data-action="promo-admeta-upgrade">เปิดเซ็ตโปรใน AdMeta เพื่ออัปเกรด/คำนวณราคา</button>' : "";
    return isPlatform
      ? `${promoBtn}<button data-action="platform-calc-product">คำนวณราคาสินค้าแพทฟอม</button><button class="secondary" data-action="platform-calc-product-reset">คำนวณพร้อมรีเซ็ตรายการเก่าออก</button>`
      : `${promoBtn}<button data-action="zaapi">เตรียมข้อความ + รูปใน Zaapi (ไม่ส่ง)</button><button class="secondary" data-action="text">คัดลอกเพื่อเพิ่มสินค้า</button>`;
  }

  function isSingleProductDetailPage(extracted) {
    if (!/^\/product\/[^/?#]+/i.test(location.pathname)) return false;
    if (/^\/product\/(?:search|category|categories|brand|brands|tag|tags|list|all|promotion|promotions|compare)(?:\/|$)/i.test(location.pathname)) {
      return false;
    }
    if (/[?&](?:search|q|keyword|page|sort)=/i.test(location.search || "")) {
      return false;
    }
    const bodyText = document.body?.innerText || "";
    if (/การค้นหา\s*["“].*?["”][\s\S]{0,120}จำนวน\s*[\d,]+\s*รายการ/.test(bodyText)) {
      return false;
    }
    const hasSkuLabel = /รหัสสินค้า\s*:?\s*[A-Za-z0-9_./-]+/i.test(bodyText);
    const hasBuyAction = /เพิ่มในตะกร้า|ซื้อเลย|สินค้าหมด|หยิบใส่ตะกร้า/.test(bodyText);
    return Boolean(extracted.title && extracted.price && (hasSkuLabel || hasBuyAction));
  }

  function applyPlatformThemeToWrap(wrap, launcher, platformMode) {
    const isPlatform = platformMode === "platform";
    if (wrap) {
      wrap.dataset.platformMode = isPlatform ? "platform" : "zaapi";
      const titleEl = wrap.querySelector(".ihc-panel-title");
      if (titleEl) {
        titleEl.textContent = isPlatform ? "iHAVECPU • โหมดแพทฟอม" : "iHAVECPU • เครื่องมือสินค้า";
      }
      const switchBtn = wrap.querySelector('button[data-panel-action="switch-platform"]');
      if (switchBtn) {
        switchBtn.title = isPlatform
          ? "สลับกลับเป็น โหมด Zaapi (สีแดง)"
          : "สลับเป็น โหมดแพทฟอม (ธีมสีส้ม — คัดลอกอย่างเดียว)";
      }
    }
    if (launcher) {
      launcher.dataset.platformMode = isPlatform ? "platform" : "zaapi";
      launcher.textContent = isPlatform ? "เปิด iHAVECPU (แพทฟอม)" : "เปิด iHAVECPU";
    }
  }

  function addButton() {
    const isDIYShare = /^https:\/\/(www\.)?ihavecpu\.com\/diy\/share\/[^/]+/i.test(location.href);
    const isIhavecpuSite = /^https:\/\/(www\.)?ihavecpu\.com\//i.test(location.href) && !isDIYShare;
    const existingWrap = document.getElementById(BUTTON_ID);
    const existingLauncher = document.getElementById(`${BUTTON_ID}-launcher`);
    if (!isDIYShare && !isIhavecpuSite) {
      existingWrap?.remove();
      existingLauncher?.remove();
      return;
    }

    const extracted = isIhavecpuSite ? extract() : { title: "", price: "", sku: "" };
    const hasProduct = isIhavecpuSite && isSingleProductDetailPage(extracted);
    const productTitle = extracted.title;
    const isPromoSet = /(?:^|[\s_(\[])(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z0-9]*-[A-Z0-9-]+/i.test(productTitle);
    const actions = buildActionsHtml(isDIYShare, hasProduct, isPromoSet, currentPlatformMode);

    if (existingWrap) {
      applyPlatformThemeToWrap(existingWrap, existingLauncher, currentPlatformMode);
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
          font:13px Arial,Tahoma,sans-serif; overflow:hidden; transition:border-color .18s ease; }
        #${BUTTON_ID} .ihc-panel-header { display:flex; align-items:center; justify-content:space-between;
          gap:10px; padding:8px 10px; border-bottom:1px solid #eee; cursor:move; user-select:none;
          font-weight:700; color:#333; transition:background .18s ease, color .18s ease; }
        #${BUTTON_ID} .ihc-panel-controls { display:flex; align-items:center; gap:5px; }
        #${BUTTON_ID} .ihc-panel-controls button { padding:4px 8px; color:#333; background:#f0f1f3;
          display:inline-flex; align-items:center; justify-content:center; min-height:24px; }
        #${BUTTON_ID} .ihc-panel-controls button[data-panel-action="switch-platform"] {
          padding:4px 7px; color:#c2410c; background:#ffedd5; border:1px solid #fed7aa; }
        #${BUTTON_ID} .ihc-panel-search { display:flex; gap:6px; padding:10px; }
        #${BUTTON_ID} .ihc-admeta-search-input { flex:1; min-width:210px; padding:8px 10px;
          border:1px solid #d0d5dd; border-radius:7px; font:13px Arial,Tahoma,sans-serif; color:#222; outline:none; }
        #${BUTTON_ID} .ihc-admeta-search-input:focus { border-color:#d71920; box-shadow:0 0 0 2px rgba(215,25,32,.15); }
        #${BUTTON_ID} .ihc-panel-body { display:flex; flex-direction:column; gap:7px; padding:0 10px 10px 10px; }
        #${BUTTON_ID} .ihc-panel-body:empty { display:none; }
        #${BUTTON_ID}[data-collapsed="true"] .ihc-panel-search,
        #${BUTTON_ID}[data-collapsed="true"] .ihc-panel-body { display:none; }
        #${BUTTON_ID} button { border:0; border-radius:7px; padding:9px 12px; cursor:pointer;
          font-weight:700; color:#fff; background:#d71920; white-space:nowrap; transition:background .18s ease; }
        #${BUTTON_ID} button.secondary { color:#333; background:#f0f1f3; }
        #${BUTTON_ID} button:hover { filter:brightness(.95); }
        #${BUTTON_ID}[data-platform-mode="platform"] { border-color:#fdba74; box-shadow:0 4px 20px rgba(234,88,12,.22); }
        #${BUTTON_ID}[data-platform-mode="platform"] .ihc-panel-header { background:#fff7ed; border-bottom-color:#fed7aa; color:#c2410c; }
        #${BUTTON_ID}[data-platform-mode="platform"] button { background:#ea580c; color:#fff; }
        #${BUTTON_ID}[data-platform-mode="platform"] button.secondary { background:#ffedd5; color:#9a3412; }
        #${BUTTON_ID}[data-platform-mode="platform"] .ihc-panel-controls button { background:#ffedd5; color:#9a3412; }
        #${BUTTON_ID}[data-platform-mode="platform"] .ihc-panel-controls button[data-panel-action="switch-platform"] {
          background:#ea580c; color:#fff; border-color:#ea580c; }
        #${BUTTON_ID}[data-platform-mode="platform"] .ihc-admeta-search-input:focus {
          border-color:#ea580c; box-shadow:0 0 0 2px rgba(234,88,12,.18); }
        #${BUTTON_ID}-launcher { position:fixed; right:18px; bottom:18px; z-index:2147483646;
          border:0; border-radius:20px; padding:10px 14px; background:#d71920; color:#fff;
          box-shadow:0 3px 18px rgba(0,0,0,.22); font:700 13px Arial,Tahoma,sans-serif; cursor:pointer; }
        #${BUTTON_ID}-launcher[data-platform-mode="platform"] { background:#ea580c; }
      `;
      document.documentElement.appendChild(style);
    }
    const wrap = document.createElement("div");
    wrap.id = BUTTON_ID;
    wrap.innerHTML = `<div class="ihc-panel-header"><span class="ihc-panel-title">iHAVECPU • เครื่องมือสินค้า</span><span class="ihc-panel-controls"><button type="button" data-panel-action="switch-platform" aria-label="สลับโหมด Zaapi / แพทฟอม" title="สลับเป็น โหมดแพทฟอม (ธีมสีส้ม — คัดลอกอย่างเดียว)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block;pointer-events:none;"><path d="M21 12a9 9 0 0 0-15.36-6.36L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15.36 6.36L21 16"/><path d="M16 16h5v5"/></svg></button><button type="button" data-panel-action="collapse" aria-label="ย่อหน้าต่าง">−</button><button type="button" data-panel-action="hide" aria-label="ซ่อนหน้าต่าง">×</button></span></div><div class="ihc-panel-search"><input type="text" class="ihc-admeta-search-input" placeholder="ค้นหางบ/สเป็คใน AdMeta (เช่น งบ 20000 รวมจอ)" aria-label="ค้นหางบหรือสเป็คใน AdMeta" /><button type="button" data-panel-search="submit">ค้นหา</button></div><div class="ihc-panel-body">${actions}</div>`;
    const searchInputEl = wrap.querySelector(".ihc-admeta-search-input");
    if (searchInputEl) {
      searchInputEl.addEventListener("keydown", async (event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          try {
            await searchSpecInAdmeta(searchInputEl.value);
          } catch (error) {
            showToast(error.message || "ค้นหาสเป็คใน AdMeta ไม่สำเร็จ", true);
          }
        }
      });
    }
    wrap.addEventListener("click", async (event) => {
      const searchBtn = event.target.closest("button[data-panel-search]");
      if (searchBtn) {
        try {
          await searchSpecInAdmeta(searchInputEl?.value || "");
        } catch (error) {
          showToast(error.message || "ค้นหาสเป็คใน AdMeta ไม่สำเร็จ", true);
        }
        return;
      }
      const panelAction = event.target.closest("button[data-panel-action]");
      if (panelAction) {
        if (panelAction.dataset.panelAction === "switch-platform") {
          currentPlatformMode = currentPlatformMode === "platform" ? "zaapi" : "platform";
          lastPageKey = "";
          addButton();
          chrome.storage.local.set({ platformMode: currentPlatformMode }).catch(() => {});
          showToast(
            currentPlatformMode === "platform"
              ? "เปลี่ยนเป็น โหมดแพทฟอม (ธีมสีส้ม — คัดลอกอย่างเดียว)"
              : "เปลี่ยนเป็น โหมด Zaapi (ธีมสีแดง)"
          );
          return;
        }
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
    applyPlatformThemeToWrap(wrap, launcher, currentPlatformMode);

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
      chrome.storage.local.get({ panelPosition: null, panelHidden: false, panelCollapsed: false, platformMode: "zaapi" })
    ]).then(([{ mode }, settings]) => {
      currentPlatformMode = settings.platformMode === "platform" ? "platform" : "zaapi";
      applyPlatformThemeToWrap(wrap, launcher, currentPlatformMode);
      lastPageKey = "";
      addButton();
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
    const isIhc = /^https:\/\/(www\.)?ihavecpu\.com\//i.test(location.href);
    const snap = isIhc ? extract() : { title: "", price: "", sku: "" };
    const singleProduct = isIhc ? isSingleProductDetailPage(snap) : false;
    const pageKey = `${location.href}\n${document.title}\n${document.querySelector("main h1, h1")?.textContent || ""}\n${snap.title}\n${snap.price}\n${snap.sku}\n${singleProduct}\n${currentPlatformMode}`;
    if (pageKey === lastPageKey) return;
    lastPageKey = pageKey;
    addButton();
  }

  syncPageControls();
  window.addEventListener("popstate", syncPageControls);
  window.addEventListener("hashchange", syncPageControls);
  window.setInterval(syncPageControls, 500);

  chrome.storage.local.get({ updateStatus: null }).then(({ updateStatus }) => {
    if (updateStatus && (updateStatus.diskNeedsReload || updateStatus.remoteHasNewer)) {
      showUpdateNotice(updateStatus);
    }
  }).catch(() => {});

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.updateStatus) {
      showUpdateNotice(changes.updateStatus.newValue);
    }
    if (area === "local" && changes.platformMode) {
      currentPlatformMode = changes.platformMode.newValue === "platform" ? "platform" : "zaapi";
      lastPageKey = "";
      addButton();
    }
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
      sendResponse(product.title && product.price
        ? {
          text: formatProductText(product),
          imageUrl: product.imageUrl || "",
          imageUrls: product.imageUrls || (product.imageUrl ? [product.imageUrl] : []),
          allowTextOnlyFallback: true,
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
    if (message?.type === "SHOW_UPDATE_NOTICE") {
      showUpdateNotice(message.status);
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
    if (typeof imageDataUrl !== "string" || !/^data:image\/[a-z0-9.+-]+;base64,/i.test(imageDataUrl)) {
      throw new Error("ข้อมูลรูปสินค้าไม่ถูกต้อง");
    }
    const editor = await waitForZaapiComposer(8000);
    if (!editor) throw new Error("ไม่พบช่องพิมพ์ข้อความใน Zaapi (ช่องพิมพ์แชต) กรุณาเปิดห้องแชตก่อน");
    const imageInput = findZaapiImageInput(editor);
    if (!imageInput) throw new Error("ไม่พบช่องแนบรูปของช่องพิมพ์แชต Zaapi");

    let imageBlob = await (await fetch(imageDataUrl)).blob();
    if (!imageBlob.type.startsWith("image/") || imageBlob.size > 16 * 1024 * 1024) {
      throw new Error("ไฟล์รูปไม่ถูกต้องหรือมีขนาดใหญ่เกินไป");
    }
    if (!/^image\/(?:png|jpeg|webp)$/i.test(imageBlob.type)) {
      try {
        const bitmap = await createImageBitmap(imageBlob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        const converted = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (converted) imageBlob = converted;
      } catch {}
    }
    const rawExt = (imageBlob.type.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");
    const extension = imageBlob.type === "image/jpeg" ? "jpg" : (rawExt || "png");
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