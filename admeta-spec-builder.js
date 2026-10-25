(() => {
  if (window.__ihavecpuAdmetaInstalled) return;
  window.__ihavecpuAdmetaInstalled = true;
  document.getElementById("ihavecpu-platform-calc-reset-btn")?.remove();
  document.getElementById("ihavecpu-platform-calc-reset-inline")?.remove();
  document.getElementById("ihavecpu-update-notice")?.remove();

  function detectSidebarStaffInfo() {
    try {
      const aside = document.querySelector("aside, nav, [class*='sidebar'], header");
      if (!aside) return;
      const textNodes = [...aside.querySelectorAll("span, p, div, strong, h4, h5, h6")]
        .map(el => (el.textContent || "").trim())
        .filter(t => t.length >= 3 && t.length <= 40 && !/(หน้าหลัก|การขาย|จัดสเปค|ใบเสนอราคา|คำนวณ|ตั้งค่า|ออกจากระบบ)/.test(t));
      const staffLine = textNodes.find(t => /^[ก-๙a-zA-Z\s.]+$/.test(t) && t.includes(" "));
      const branchLine = textNodes.find(t => /(สาขา|สำนักงานใหญ่|นครนายก|กทม|รามอินทรา|บางนา|รังสิต)/i.test(t));
      if (staffLine) {
        chrome.runtime.sendMessage({
          type: "SYNC_STAFF_INFO",
          staff: staffLine,
          branch: branchLine || ""
        }).catch(() => {});
      }
    } catch {}
  }
  setTimeout(detectSidebarStaffInfo, 2000);
  setTimeout(detectSidebarStaffInfo, 8000);
  setInterval(detectSidebarStaffInfo, 30000);

  const ADMETA_SELECTORS = {
    customerMessage: [
      '.card[title="คลิกเพื่อก๊อบปี้ข้อความ"] textarea[readonly]',
      '[title="คลิกเพื่อก๊อบปี้ข้อความ"] textarea[readonly]',
      'textarea[readonly]'
    ],
    mainSearch: [
      'input[placeholder*="พิมพ์ชื่อเซ็ต"]',
      'input[placeholder*="วางลิงก์ DIY"]',
      'input[placeholder*="งบประมาณ"]',
      'input[placeholder*="ชื่อเซ็ต"]',
      'input[placeholder*="30000"]',
      'input[placeholder*="SKU" i]',
      'input[placeholder*="ค้นหาเซ็ต"]',
      'input[aria-label*="ค้นหา" i]',
      'input[aria-label*="DIY" i]',
      'input[aria-label*="เซ็ต" i]'
    ],
    loginPassword: 'input[type="password"]',
    diyParts: "tbody tr",
    resetButton: "button.bs-btn-reset",
    calculateButton: "button.bs-btn-calc",
    setResults: ["button.list-group-item-action", "[role='button']", "button", "a"]
  };

  function waitFor(predicate, timeoutMs, errorMessage) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        try {
          const value = predicate();
          if (value) {
            clearInterval(timer);
            resolve(value);
          } else if (Date.now() - startedAt >= timeoutMs) {
            clearInterval(timer);
            reject(new Error(errorMessage));
          }
        } catch (error) {
          clearInterval(timer);
          reject(error);
        }
      }, 250);
    });
  }

  function isVisibleInput(el) {
    if (!el || el.disabled) return false;
    const type = (el.type || "text").toLowerCase();
    if (["hidden", "password", "checkbox", "radio", "button", "submit", "reset", "file"].includes(type)) {
      return false;
    }
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    return true;
  }

  function findCustomerMessage() {
    const messageArea = document.querySelector(ADMETA_SELECTORS.customerMessage[0]) ||
      document.querySelector(ADMETA_SELECTORS.customerMessage[1]);
    if (messageArea?.value.trim()) return messageArea.value.trim();

    return [...document.querySelectorAll(ADMETA_SELECTORS.customerMessage[2])]
      .map((textarea) => textarea.value.trim())
      .find((value) => value && value.includes("เลขที่จัดสเปก:")) || "";
  }

  function findMainBuilderSearchInput() {
    // 1. Check primary declared selectors
    for (const selector of ADMETA_SELECTORS.mainSearch) {
      const match = [...document.querySelectorAll(selector)].find(isVisibleInput);
      if (match) return match;
    }

    // 2. Scan all visible inputs for keywords from the placeholder: "ชื่อเซ็ต", "DIY", "งบประมาณ", "30000", "SKU"
    const allInputs = [...document.querySelectorAll("input")].filter(isVisibleInput);
    const matched = allInputs.find((input) => {
      const text = `${input.placeholder || ""} ${input.getAttribute("aria-label") || ""} ${input.title || ""}`.toLowerCase();
      return text.includes("ชื่อเซ็ต") ||
        text.includes("diy") ||
        text.includes("งบประมาณ") ||
        text.includes("30000") ||
        text.includes("sku") ||
        text.includes("เซ็ต");
    });
    if (matched) return matched;

    // 3. Fallback: First text input on the page excluding accessories input ("พัดลม, เมาส์, หูฟัง") and history modal input
    const firstBuilderInput = allInputs.find((input) => {
      const ph = input.placeholder || "";
      return !/พัดลม|เมาส์|หูฟัง|สต็อก|เลขที่สเปก|โทเค็นแชร์/i.test(ph);
    });
    if (firstBuilderInput) return firstBuilderInput;

    return null;
  }

  function findHistoryButton() {
    const candidates = [...document.querySelectorAll("button, [role='button'], a")].filter((el) => {
      if (!el || el.disabled) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      return text === "ประวัติ" || /^ประวัติ(?:\s|$)/.test(text);
    });
    return candidates[0] || null;
  }

  function findHistorySearchInput() {
    const selectors = [
      'input[placeholder*="เลขที่สเปก"]',
      'input[placeholder*="โทเค็นแชร์"]',
      'input[placeholder*="ชื่อลูกค้า"]'
    ];
    for (const sel of selectors) {
      const match = [...document.querySelectorAll(sel)].find(isVisibleInput);
      if (match) return match;
    }
    const modals = [...document.querySelectorAll(".modal, [role='dialog'], [class*='modal'], div")]
      .filter((el) => {
        if (!el || el.children.length === 0) return false;
        const style = window.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden" && (el.innerText || "").includes("ประวัติการจัดสเปก");
      });
    for (const modal of modals) {
      const inp = [...modal.querySelectorAll("input")].find(isVisibleInput);
      if (inp) return inp;
    }
    return null;
  }

  function findHistorySearchSubmitButton(historyInput) {
    let container = historyInput?.parentElement;
    while (container && container !== document.body) {
      const buttons = [...container.querySelectorAll("button, [role='button']")].filter((btn) => {
        if (!btn || btn.disabled) return false;
        const style = window.getComputedStyle(btn);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
        const text = (btn.innerText || btn.textContent || "").replace(/\s+/g, " ").trim();
        return text === "ค้นหา";
      });
      if (buttons.length > 0) return buttons[0];
      container = container.parentElement;
    }
    return null;
  }

  function findHistoryLoadButton(specCode) {
    const upperCode = specCode.trim().toUpperCase();
    const rows = [...document.querySelectorAll("tr")].filter((row) => {
      const style = window.getComputedStyle(row);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return (row.innerText || "").toUpperCase().includes(upperCode);
    });
    for (const row of rows) {
      const loadBtn = [...row.querySelectorAll("button, [role='button'], a")].find((btn) => {
        if (!btn || btn.disabled) return false;
        const style = window.getComputedStyle(btn);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
        const text = (btn.innerText || btn.textContent || "").replace(/\s+/g, " ").trim();
        return text === "โหลด" || /โหลด/.test(text);
      });
      if (loadBtn) return loadBtn;
    }
    return null;
  }

  function findSearchInput() {
    return findMainBuilderSearchInput();
  }

  function findPromoSearchInput() {
    return findMainBuilderSearchInput();
  }

  function findPromoSetCardOrButton(searchTerm) {
    const term = searchTerm.trim().toLowerCase();
    const setCode = term.split(/\s+/)[0];
    const normTerm = term.replace(/[\s-_]+/g, "");

    // 1. Look for cards/containers containing the promo set code/title
    const containers = [
      ...document.querySelectorAll(".card, [class*='card'], [class*='promo'], [class*='set'], .list-group-item, [role='listitem'], div")
    ].filter((el) => {
      if (!el || el.children.length === 0) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return el.offsetWidth > 40 && el.offsetHeight > 40;
    });

    for (const container of containers) {
      const text = (container.innerText || "").toLowerCase();
      const normText = text.replace(/[\s-_]+/g, "");
      const matchesCode = text.includes(term) ||
        (setCode && text.includes(setCode)) ||
        (normTerm.length >= 3 && normText.includes(normTerm));

      if (matchesCode) {
        // Find "+ เลือกเซ็ตนี้" button inside this container
        const buttons = [...container.querySelectorAll("button, [role='button'], a")]
          .filter((btn) => {
            const style = window.getComputedStyle(btn);
            return style.display !== "none" && style.visibility !== "hidden" && !btn.disabled;
          });
        const selectBtn = buttons.find((btn) => /(?:เลือกเซ็ต|เลือก)/i.test(btn.innerText || btn.textContent || ""));
        if (selectBtn) return selectBtn;

        if (buttons.length === 1) return buttons[0];
        if (container.tagName === "BUTTON" || container.getAttribute("role") === "button") return container;
      }
    }

    // 2. Direct search in all buttons and clickable elements
    const allButtons = [...document.querySelectorAll("button, [role='button'], a, .list-group-item-action")]
      .filter((el) => {
        if (!el || el.disabled) return false;
        const style = window.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden";
      });

    for (const btn of allButtons) {
      const text = (btn.innerText || btn.textContent || "").toLowerCase();
      const normText = text.replace(/[\s-_]+/g, "");
      if (text.includes(term) || (setCode && text.includes(setCode)) || (normTerm.length >= 3 && normText.includes(normTerm))) {
        return btn;
      }
      if (/(?:เลือกเซ็ต|เลือก)/i.test(text)) {
        const parentCard = btn.closest(".card, [class*='card'], div");
        if (parentCard) {
          const cardText = (parentCard.innerText || "").toLowerCase();
          const normCardText = cardText.replace(/[\s-_]+/g, "");
          if (cardText.includes(term) || (setCode && cardText.includes(setCode)) || (normTerm.length >= 3 && normCardText.includes(normTerm))) {
            return btn;
          }
        }
      }
    }

    return null;
  }

  function isLoginPage() {
    return /\/(?:login|signin|sign-in|auth)(?:\/|$)/i.test(location.pathname) ||
      [...document.querySelectorAll(ADMETA_SELECTORS.loginPassword)]
        .some((input) => input.getClientRects().length > 0 || isVisibleInput(input));
  }

  function findResetButton() {
    const primary = document.querySelector(ADMETA_SELECTORS.resetButton);
    if (primary) return primary;
    const buttons = [...document.querySelectorAll("button, [role='button']")];
    return buttons.find((btn) => {
      if (!btn || btn.disabled) return false;
      const style = window.getComputedStyle(btn);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const text = (btn.innerText || btn.textContent || "").trim();
      return /^(?:รีเซ็ต|ล้างสเปก|ล้างข้อมูล|เริ่มใหม่|เปลี่ยนสเปก)/i.test(text);
    }) || null;
  }

  function hasSelectedSpec() {
    return Boolean(
      findResetButton() ||
      document.querySelector(ADMETA_SELECTORS.calculateButton) ||
      (document.body.innerText || "").includes("ปรับแต่งและอัปเกรดชิ้นส่วน")
    );
  }

  async function resetBuilder() {
    let resetButton;
    try {
      resetButton = await waitFor(
        findResetButton,
        3000,
        ""
      );
    } catch {
      resetButton = null;
    }

    if (!resetButton) {
      return false;
    }

    resetButton.click();
    setTimeout(() => {
      const confirmBtn = [...document.querySelectorAll(".swal2-confirm, .modal button, [role='dialog'] button")]
        .find((btn) => /(?:ยืนยัน|ตกลง|ใช่|รีเซ็ต|ok|confirm)/i.test(btn.innerText || btn.textContent || ""));
      if (confirmBtn) confirmBtn.click();
    }, 300);

    await waitFor(
      () => /^\/admin\/spec-builder-v2\/?$/.test(location.pathname) &&
        findMainBuilderSearchInput() &&
        !findResetButton() &&
        !document.querySelector(ADMETA_SELECTORS.calculateButton),
      10000,
      "กดรีเซ็ตแล้วแต่ AdMeta ยังล้างสเป็คเดิมไม่เสร็จ"
    );
    return true;
  }

  function setReactInputValue(input, value) {
    if (!input) return;
    input.focus();
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set ||
      function (v) { this.value = v; };
    valueSetter.call(input, "");
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward", data: null }));
    valueSetter.call(input, value);
    input.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: value
    }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 }));
    input.dispatchEvent(new KeyboardEvent("keypress", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 }));
  }

  async function calculateDIYMessage(diyUrl) {
    if (isLoginPage()) throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองคำนวณสเป็คอีกครั้ง");
    if (location.hostname !== "admeta.me" ||
        !/^\/admin\/spec-builder-v2(?:\/[^/]+)?\/?$/.test(location.pathname)) {
      throw new Error("กรุณาเปิดหน้า Spec Builder V2 ก่อน");
    }
    if (typeof diyUrl !== "string") throw new Error("ไม่พบลิงก์ DIY");

    const parsedUrl = new URL(diyUrl);
    if (parsedUrl.protocol !== "https:" || !/^(?:www\.)?ihavecpu\.com$/i.test(parsedUrl.hostname) ||
        !/^\/diy\/share\/[^/]+\/?$/.test(parsedUrl.pathname)) {
      throw new Error("ลิงก์ DIY ไม่ถูกต้อง");
    }
    parsedUrl.hostname = "ihavecpu.com";

    const hadExistingSet = !/^\/admin\/spec-builder-v2\/?$/.test(location.pathname) || hasSelectedSpec();
    if (hadExistingSet && !(await resetBuilder())) {
      throw new Error("พบสเป็คค้างอยู่ใน AdMeta แต่ไม่พบปุ่มรีเซ็ต");
    }

    const searchInput = await waitFor(() => {
      if (isLoginPage()) {
        throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองคำนวณสเป็คอีกครั้ง");
      }
      return findSearchInput();
    }, 20000, "ไม่พบช่องค้นหาลิงก์ DIY ใน AdMeta กรุณาเปิดหน้า Spec Builder V2");

    setReactInputValue(searchInput, parsedUrl.href);
    const inputStartedAt = Date.now();
    let retriedInput = false;

    await waitFor(() => {
      if (isLoginPage()) {
        throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองคำนวณสเป็คอีกครั้ง");
      }
      const calculateButton = document.querySelector(ADMETA_SELECTORS.calculateButton);
      const text = document.body.innerText || "";
      const hasParts = [...document.querySelectorAll(ADMETA_SELECTORS.diyParts)].length > 0;
      const isReady = calculateButton && !calculateButton.disabled && hasParts &&
        (text.includes("ราคาสเปกตั้งต้น") || text.includes("รายการชิ้นส่วนคอมพิวเตอร์") || text.includes("ปรับแต่งและอัปเกรด"));
      if (isReady) {
        return calculateButton;
      }
      if (!retriedInput && Date.now() - inputStartedAt >= 3500 && !hasSelectedSpec()) {
        const currentInput = findSearchInput();
        if (currentInput) {
          retriedInput = true;
          setReactInputValue(currentInput, parsedUrl.href);
        }
      }
      return null;
    }, 25000, "AdMeta ไม่โหลดสเป็คจากลิงก์ DIY ภายในเวลาที่กำหนด");

    const calculateButton = document.querySelector(ADMETA_SELECTORS.calculateButton);
    calculateButton.click();

    const message = await waitFor(
      findCustomerMessage,
      30000,
      "คำนวณแล้วแต่ไม่พบข้อความสำเร็จรูปสำหรับส่งลูกค้าใน AdMeta"
    );
    let resetError = "";
    let needsUrlReset = false;
    try {
      const didReset = await resetBuilder();
      if (!didReset && (!/^\/admin\/spec-builder-v2\/?$/.test(location.pathname) || hasSelectedSpec())) {
        needsUrlReset = true;
      }
    } catch {
      needsUrlReset = true;
    }

    return {
      ok: true,
      text: message,
      specNumber: message.match(/เลขที่จัดสเปก:\s*([^\s]+)/)?.[1] || "",
      resetError,
      needsUrlReset
    };
  }

  async function openPromoSetForUpgrade(searchTerm) {
    if (isLoginPage()) throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองเปิดเซ็ตโปรอีกครั้ง");
    if (location.hostname !== "admeta.me" ||
        !/^\/admin\/spec-builder-v2(?:\/[^/]+)?\/?$/.test(location.pathname)) {
      throw new Error("กรุณาเปิดหน้า Spec Builder V2 ก่อน");
    }
    if (typeof searchTerm !== "string" || !searchTerm.trim() || searchTerm.length > 160) {
      throw new Error("ไม่พบรหัสเซ็ตโปรสำหรับค้นหาใน AdMeta");
    }

    const hadExistingSet = !/^\/admin\/spec-builder-v2\/?$/.test(location.pathname) ||
      hasSelectedSpec();
    if (hadExistingSet && !(await resetBuilder())) {
      throw new Error("พบสเป็คค้างอยู่ใน AdMeta แต่ไม่พบปุ่มรีเซ็ต");
    }

    const searchInput = await waitFor(() => {
      if (isLoginPage()) {
        throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองเปิดเซ็ตโปรอีกครั้ง");
      }
      return findPromoSearchInput();
    }, 20000, "ไม่พบช่องค้นหาเซ็ตโปรใน AdMeta กรุณาเปิดหน้า Spec Builder V2");

    if (hadExistingSet && hasSelectedSpec()) {
      throw new Error("AdMeta ยังมีสเป็คเดิมอยู่ กรุณากดรีเซ็ตก่อนลองใหม่");
    }

    const cleanTerm = searchTerm.trim();
    setReactInputValue(searchInput, cleanTerm);
    const searchStartedAt = Date.now();
    let retriedSearch = false;

    const setResult = await waitFor(() => {
      if (isLoginPage()) {
        throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองเปิดเซ็ตโปรอีกครั้ง");
      }
      const match = findPromoSetCardOrButton(cleanTerm);
      if (match) return match;
      if (!retriedSearch && Date.now() - searchStartedAt >= 3000) {
        const currentInput = findPromoSearchInput();
        if (currentInput) {
          retriedSearch = true;
          setReactInputValue(currentInput, cleanTerm);
        }
      }
      return null;
    }, 20000, `ไม่พบรายการเซ็ตโปรที่ตรงกับรหัส "${cleanTerm}" ใน AdMeta`);
    setResult.click();

    const selectedSet = await waitFor(() => {
      const text = document.body.innerText || "";
      const hasReset = findResetButton() || document.querySelector(ADMETA_SELECTORS.calculateButton);
      const isLoaded = hasReset && (
        text.includes("ราคาสเปกตั้งต้น") ||
        text.includes("ปรับแต่งและอัปเกรด") ||
        text.includes("รายการสเปกคอมพิวเตอร์") ||
        text.includes("สเปกคอมพิวเตอร์ตั้งต้น")
      );
      if (isLoaded) {
        return text.match(/(?:สเปกคอมพิวเตอร์ตั้งต้น|รายการสเปกคอมพิวเตอร์ตั้งต้น)\s*([\s\S]*?)(?:\n2\n|ปรับแต่งและอัปเกรด)/)?.[1]?.trim() || searchTerm.trim();
      }
      return null;
    }, 20000, "AdMeta ยังโหลดรายการเซ็ตโปรไม่เสร็จ");

    return { ok: true, setName: selectedSet };
  }

  const SB_HISTORY_CODE_REGEX = /^SB-\d{4}-\d{3,8}$/i;

  async function loadSpecFromHistory(specCode) {
    const code = specCode.trim().toUpperCase();

    if (!findHistorySearchInput()) {
      const historyBtn = await waitFor(() => {
        if (isLoginPage()) {
          throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองค้นหาสเป็คอีกครั้ง");
        }
        return findHistoryButton();
      }, 15000, "ไม่พบปุ่ม 'ประวัติ' บนหน้า AdMeta Spec Builder V2");
      historyBtn.click();
    }

    const historyInput = await waitFor(
      findHistorySearchInput,
      10000,
      "เปิดหน้าต่างประวัติการจัดสเปกแล้วแต่ไม่พบช่องค้นหาเลขที่สเปก"
    );

    setReactInputValue(historyInput, code);
    const submitBtn = findHistorySearchSubmitButton(historyInput);
    if (submitBtn) {
      setTimeout(() => submitBtn.click(), 80);
    }

    const searchStartedAt = Date.now();
    let retriedHistorySearch = false;

    const loadBtn = await waitFor(() => {
      const foundBtn = findHistoryLoadButton(code);
      if (foundBtn) return foundBtn;
      if (!retriedHistorySearch && Date.now() - searchStartedAt >= 2500) {
        const currentInput = findHistorySearchInput();
        if (currentInput) {
          retriedHistorySearch = true;
          setReactInputValue(currentInput, code);
          const btn = findHistorySearchSubmitButton(currentInput);
          if (btn) btn.click();
        }
      }
      return null;
    }, 15000, `ไม่พบเลขที่สเปก "${code}" ในประวัติการจัดสเปก`);

    loadBtn.click();

    setTimeout(() => {
      const confirmBtn = [...document.querySelectorAll(".swal2-confirm, .modal button, [role='dialog'] button")]
        .find((btn) => /(?:ยืนยัน|ตกลง|ใช่|โหลด|ok|confirm)/i.test(btn.innerText || btn.textContent || ""));
      if (confirmBtn && confirmBtn !== loadBtn) confirmBtn.click();
    }, 300);

    return { ok: true, searchTerm: code, loadedFromHistory: true };
  }

  async function searchSpecInBuilder(searchTerm) {
    if (isLoginPage()) throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองค้นหาสเป็คอีกครั้ง");
    if (location.hostname !== "admeta.me" ||
        !/^\/admin\/spec-builder-v2(?:\/[^/]+)?\/?$/.test(location.pathname)) {
      throw new Error("กรุณาเปิดหน้า Spec Builder V2 ก่อน");
    }
    if (typeof searchTerm !== "string" || !searchTerm.trim() || searchTerm.length > 300) {
      throw new Error("ไม่พบคำค้นหาสำหรับค้นหาใน AdMeta");
    }

    const cleanTerm = searchTerm.trim();
    if (SB_HISTORY_CODE_REGEX.test(cleanTerm)) {
      return await loadSpecFromHistory(cleanTerm);
    }

    const hadExistingSet = !/^\/admin\/spec-builder-v2\/?$/.test(location.pathname) ||
      hasSelectedSpec();
    if (hadExistingSet && !(await resetBuilder())) {
      throw new Error("พบสเป็คค้างอยู่ใน AdMeta แต่ไม่พบปุ่มรีเซ็ต");
    }

    const searchInput = await waitFor(() => {
      if (isLoginPage()) {
        throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองค้นหาสเป็คอีกครั้ง");
      }
      return findMainBuilderSearchInput();
    }, 20000, "ไม่พบช่องค้นหาสเป็คใน AdMeta กรุณาเปิดหน้า Spec Builder V2");

    try {
      searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {}
    setReactInputValue(searchInput, cleanTerm);

    return { ok: true, searchTerm: cleanTerm };
  }

  function findPlatformButton(labelRegex) {
    const buttons = [...document.querySelectorAll("button, [role='button'], a")].filter((btn) => {
      if (!btn || btn.disabled) return false;
      const style = window.getComputedStyle(btn);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      const text = (btn.innerText || btn.textContent || "").replace(/\s+/g, " ").trim();
      return labelRegex.test(text);
    });
    return buttons[0] || null;
  }

  function isPlatformSearchRowInput(el) {
    if (!isVisibleInput(el)) return false;
    const ph = (el.placeholder || "").toLowerCase();
    if (/ลิงก์\s*diy|วางลิงก์|ihavecpu\.com/i.test(ph)) return false;
    if (/พิมพ์ค้นหา|ค้นหาชื่อสินค้า|ชื่อสินค้า|ค้นหา/i.test(ph)) return true;
    const rect = el.getBoundingClientRect();
    return rect.width >= 180;
  }

  function rowHasPcSetBadge(inp) {
    let curr = inp?.parentElement;
    for (let depth = 0; depth < 3 && curr; depth++) {
      const rect = curr.getBoundingClientRect();
      if (rect.height > 100) break;
      if ((curr.innerText || "").toUpperCase().includes("PC SET")) {
        return true;
      }
      curr = curr.parentElement;
    }
    return false;
  }

  function findPlatformSearchRowInputs() {
    return [...document.querySelectorAll("input")].filter(isPlatformSearchRowInput);
  }

  function findPlatformDeleteButtons() {
    const rowInputs = findPlatformSearchRowInputs();
    const deleteTargets = [];
    const seen = new Set();

    for (const inp of rowInputs) {
      const inpRect = inp.getBoundingClientRect();
      let rowEl = inp.closest("tr");
      if (!rowEl) {
        let curr = inp.parentElement;
        while (curr && curr !== document.body) {
          const r = curr.getBoundingClientRect();
          if (r.height > 115) break;
          if (r.width > inpRect.width + 150) rowEl = curr;
          curr = curr.parentElement;
        }
      }
      const scope = rowEl || document.body;
      const candidates = [...scope.querySelectorAll("button, [role='button'], a, i[class*='trash' i], i[class*='delete' i], svg")]
        .filter((el) => {
          if (!el || el.disabled) return false;
          if (el.id === "ihc-platform-reset-header-btn" || el.id === "ihc-platform-reset-row-btn") return false;
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || r.width > 90 || r.height > 60) return false;
          return r.left > inpRect.right + 40 && Math.abs((r.top + r.height / 2) - (inpRect.top + inpRect.height / 2)) < 40;
        });
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left);
        const rawTarget = candidates[0];
        const clickable = rawTarget.closest("button, [role='button'], a") || rawTarget;
        if (!seen.has(clickable)) {
          seen.add(clickable);
          deleteTargets.push(clickable);
        }
      }
    }

    if (deleteTargets.length === 0) {
      const trashEls = [...document.querySelectorAll("button, [role='button'], i[class*='trash' i], svg[class*='trash' i]")]
        .filter((el) => {
          if (!el || el.id === "ihc-platform-reset-header-btn" || el.id === "ihc-platform-reset-row-btn") return false;
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") return false;
          const cls = `${el.className || ""} ${el.getAttribute("title") || ""} ${el.getAttribute("aria-label") || ""}`;
          return /trash|delete|remove|ลบรายการ|ลบสินค้า/i.test(cls);
        });
      for (const el of trashEls) {
        const clickable = el.closest("button, [role='button'], a") || el;
        if (!seen.has(clickable)) {
          seen.add(clickable);
          deleteTargets.push(clickable);
        }
      }
    }

    return deleteTargets;
  }

  async function clearPlatformCalculatorItems() {
    const initialInputs = findPlatformSearchRowInputs();
    const hadItems = initialInputs.length > 0;

    for (let pass = 0; pass < 4; pass++) {
      const delBtns = findPlatformDeleteButtons();
      if (delBtns.length === 0) break;
      for (const btn of [...delBtns].reverse()) {
        try {
          btn.click();
        } catch {}
      }
      await new Promise((r) => setTimeout(r, 70));
    }

    const remainingInputs = findPlatformSearchRowInputs();
    const hasFilledInputs = remainingInputs.some((inp) => (inp.value || "").trim().length > 0);
    if (!hasFilledInputs && remainingInputs.length === 1) {
      setPlatformInputValue(remainingInputs[0], "", false);
    }
    const cleared = !hasFilledInputs && remainingInputs.length <= 1;
    return { cleared, hadItems };
  }

  function ensurePlatformCalculatorResetButton() {
    if (location.hostname !== "admeta.me" || !/^\/admin\/platform\/calculator/i.test(location.pathname)) {
      document.getElementById("ihc-platform-reset-header-btn")?.remove();
      document.getElementById("ihc-platform-reset-row-btn")?.remove();
      return;
    }

    const handleResetClick = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const res = await clearPlatformCalculatorItems();
      if (res.hadItems && res.cleared) {
        showStatus("รีเซ็ตรายการคำนวณทั้งหมดเรียบร้อยแล้ว", false);
      } else {
        showStatus("กำลังรีเซ็ตหน้าคำนวณราคาแพลตฟอร์มใหม่...", false);
        location.reload();
      }
    };

    const feeBtn = findPlatformButton(/ตั้งค่าค่าธรรมเนียม/);
    if (feeBtn && feeBtn.parentElement && !document.getElementById("ihc-platform-reset-header-btn")) {
      const headerResetBtn = document.createElement("button");
      headerResetBtn.id = "ihc-platform-reset-header-btn";
      headerResetBtn.type = "button";
      headerResetBtn.textContent = "🔄 รีเซ็ตรายการใหม่";
      Object.assign(headerResetBtn.style, {
        marginRight: "8px",
        padding: "7px 14px",
        borderRadius: "8px",
        border: "1px solid #dc2626",
        background: "#fef2f2",
        color: "#dc2626",
        font: "700 13px Arial,Tahoma,sans-serif",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "5px"
      });
      headerResetBtn.addEventListener("click", handleResetClick);
      feeBtn.parentElement.insertBefore(headerResetBtn, feeBtn);
    }

    const comsetBtn = findPlatformButton(/เพิ่มคอมเซ็ต/);
    const hasRows = findPlatformSearchRowInputs().length > 0;
    const existingRowBtn = document.getElementById("ihc-platform-reset-row-btn");
    if (comsetBtn && comsetBtn.parentElement && hasRows) {
      if (!existingRowBtn) {
        const rowResetBtn = document.createElement("button");
        rowResetBtn.id = "ihc-platform-reset-row-btn";
        rowResetBtn.type = "button";
        rowResetBtn.textContent = "🔄 รีเซ็ตรายการใหม่";
        Object.assign(rowResetBtn.style, {
          marginLeft: "6px",
          padding: "8px 14px",
          borderRadius: "8px",
          border: "1px solid #dc2626",
          background: "#fff",
          color: "#dc2626",
          font: "700 13px Arial,Tahoma,sans-serif",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "5px"
        });
        rowResetBtn.addEventListener("click", handleResetClick);
        comsetBtn.parentElement.appendChild(rowResetBtn);
      }
    } else if (existingRowBtn && !hasRows) {
      existingRowBtn.remove();
    }
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("คัดลอกข้อความไม่สำเร็จ");
    return true;
  }

  function extractPriceDigits(priceStr) {
    if (!priceStr) return "";
    const clean = String(priceStr).replace(/[^\d.,]/g, "").replace(/\.00$/, "").trim();
    return clean;
  }

  function isSubSpecDetail(text) {
    const t = String(text || "").trim();
    if (!t) return false;
    if (/^[+＋]/.test(t)) return false;
    return /^(?:CPU|Mainboard|Graphic\s*card|VGA|Memory|RAM|Storage|SSD|M\.2|Power\s*Supply|PSU|Case|Cooler|Liquid\s*Cooling|Cooling|Fan|ซีพียู|เมนบอร์ด|การ์ดจอ|แรม|เอสเอสดี|พาวเวอร์|เคส)\s*:/i.test(t);
  }

  function cleanProductTitleLine(text) {
    let t = String(text || "").trim();
    const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
    let chosen = "";
    for (const line of lines) {
      const clean = line.replace(/^\[?\s*PC\s*SET\s*\]?\s*/i, "").trim();
      if (!clean) continue;
      if (isSubSpecDetail(clean)) continue;
      chosen = clean;
      break;
    }
    return chosen || (lines[0] ? lines[0].replace(/^\[?\s*PC\s*SET\s*\]?\s*/i, "").trim() : "");
  }

  function buildPlatformCopyText(platformName, baseTitle, additionalItems, netPriceStr) {
    const cleanPrice = extractPriceDigits(netPriceStr);
    const formattedPrice = cleanPrice ? `= ${cleanPrice}.-` : "";

    const lines = [];
    const cleanBase = cleanProductTitleLine(baseTitle);
    if (cleanBase) {
      lines.push(`${platformName} | ${cleanBase}`);
    } else {
      lines.push(platformName);
    }

    const validAdditionals = (additionalItems || [])
      .map((item) => cleanProductTitleLine(item))
      .filter((item) => item.length > 0 && !isSubSpecDetail(item));

    if (validAdditionals.length > 0) {
      lines.push("");
      validAdditionals.forEach((item) => lines.push(item));
    }

    if (formattedPrice) {
      lines.push("");
      lines.push(formattedPrice);
    }

    return lines.join("\n");
  }

  function extractPlatformCalculatorItems() {
    const netPrices = findPlatformNetPrices();
    const summaryTable = netPrices?.netRow ? netPrices.netRow.closest("table") : null;

    if (summaryTable) {
      const rows = [...summaryTable.querySelectorAll("tbody tr, tr")].filter((r) => {
        const txt = (r.innerText || "").trim();
        return !txt.includes("ราคาลงขายสุทธิ") && !/Shopee|Lazada|TikTok/i.test(txt);
      });

      if (rows.length > 0) {
        let baseTitle = "";
        const additionalItems = [];

        rows.forEach((r, idx) => {
          const firstCell = r.querySelector("td, th");
          if (!firstCell) return;
          const cleanLine = cleanProductTitleLine(firstCell.innerText);
          if (!cleanLine || isSubSpecDetail(cleanLine)) return;

          if (idx === 0 && !baseTitle) {
            baseTitle = cleanLine;
          } else {
            additionalItems.push(cleanLine);
          }
        });

        if (baseTitle) {
          return {
            baseTitle,
            additionalItems: additionalItems.filter((item) => !isSubSpecDetail(item))
          };
        }
      }
    }

    const rowInputs = findPlatformSearchRowInputs();
    if (rowInputs.length > 0) {
      let pcSetTitle = "";
      const additionalItems = [];

      rowInputs.forEach((inp) => {
        const val = cleanProductTitleLine(inp.value);
        if (!val || isSubSpecDetail(val)) return;

        const isComset = rowHasPcSetBadge(inp) || /^\[?\s*PC\s*SET/i.test(inp.value || "");
        if (isComset && !pcSetTitle) {
          pcSetTitle = val;
        } else {
          additionalItems.push(val);
        }
      });

      if (!pcSetTitle && rowInputs[0]) {
        pcSetTitle = cleanProductTitleLine(rowInputs[0].value);
        additionalItems.shift();
      }

      return {
        baseTitle: pcSetTitle,
        additionalItems: additionalItems.filter((item) => !isSubSpecDetail(item))
      };
    }

    return { baseTitle: "", additionalItems: [] };
  }

  function findPlatformNetPrices() {
    const netLabelEl = [...document.querySelectorAll("*")].find((el) => {
      const txt = (el.innerText || "").trim();
      return (txt.startsWith("ราคาลงขายสุทธิ") || txt.includes("ราคาลงขายสุทธิ")) && txt.length < 150 && el.children.length <= 2;
    }) || [...document.querySelectorAll("*")].find((el) => {
      const txt = (el.innerText || "").trim();
      return txt.includes("ราคาลงขายสุทธิ") && txt.length < 150;
    });

    if (!netLabelEl) return null;

    const netRow = netLabelEl.closest("tr, [class*='row'], div");
    if (!netRow) return null;

    let shopeeCell = null;
    let lazadaCell = null;
    let tiktokCell = null;

    const tr = netLabelEl.closest("tr");
    if (tr) {
      const allCells = [...tr.querySelectorAll("td, th")];
      if (allCells.length >= 4) {
        shopeeCell = allCells[allCells.length - 3];
        lazadaCell = allCells[allCells.length - 2];
        tiktokCell = allCells[allCells.length - 1];
      }
    }

    if (!shopeeCell || !lazadaCell || !tiktokCell) {
      const candidatePriceEls = [...netRow.querySelectorAll("*")].filter((el) => {
        if (netLabelEl.contains(el)) return false;
        if (el.children.length > 0) return false;
        const txt = (el.innerText || "").trim();
        if (!/\d{1,3}(?:,\d{3})+/.test(txt)) return false;
        const num = parseFloat(txt.replace(/[^\d.]/g, ""));
        return !isNaN(num) && num > 500;
      });

      if (candidatePriceEls.length >= 3) {
        shopeeCell = candidatePriceEls[0];
        lazadaCell = candidatePriceEls[1];
        tiktokCell = candidatePriceEls[2];
      }
    }

    const shopeePrice = shopeeCell ? extractPriceDigits(shopeeCell.innerText) : "";
    const lazadaPrice = lazadaCell ? extractPriceDigits(lazadaCell.innerText) : "";
    const tiktokPrice = tiktokCell ? extractPriceDigits(tiktokCell.innerText) : "";

    return {
      shopeePrice,
      lazadaPrice,
      tiktokPrice,
      shopeeCell,
      lazadaCell,
      tiktokCell,
      netRow
    };
  }

  function findPlatformHeaders() {
    const candidateHeaders = [...document.querySelectorAll("th, [role='columnheader'], [class*='header'], span, div")].filter((el) => {
      const txt = (el.innerText || "").trim();
      return (/Shopee/i.test(txt) || /Lazada/i.test(txt) || /TikTok/i.test(txt)) && txt.length < 60 && el.children.length <= 3;
    });

    const shopeeHeader = candidateHeaders.find((el) => /Shopee/i.test(el.innerText || ""));
    const lazadaHeader = candidateHeaders.find((el) => /Lazada/i.test(el.innerText || ""));
    const tiktokHeader = candidateHeaders.find((el) => /TikTok/i.test(el.innerText || ""));

    return { shopeeHeader, lazadaHeader, tiktokHeader };
  }

  function attachPlatformClick(el, platformName, getPriceFn) {
    if (!el || el.dataset.ihcCopyAttached === platformName) return;
    el.dataset.ihcCopyAttached = platformName;
    el.style.cursor = "pointer";
    el.setAttribute("title", `📋 คลิกเพื่อก๊อบปี้ข้อความสำหรับ ${platformName}`);
    el.addEventListener("click", async (e) => {
      e.stopPropagation();
      const price = getPriceFn();
      await copyPlatformSpecText(platformName, price, el);
    });
  }

  async function copyPlatformSpecText(platformName, priceStr, triggerEl) {
    try {
      const { baseTitle, additionalItems } = extractPlatformCalculatorItems();
      const textToCopy = buildPlatformCopyText(platformName, baseTitle, additionalItems, priceStr);
      await copyText(textToCopy);
      const cleanPrice = extractPriceDigits(priceStr);
      showStatus(`✓ คัดลอกข้อความสำหรับ ${platformName}${cleanPrice ? ' (' + cleanPrice + '.-)' : ''} เรียบร้อยแล้ว!`, false);

      if (triggerEl) {
        triggerEl.classList.add("ihc-copied-flash");
        setTimeout(() => {
          triggerEl.classList.remove("ihc-copied-flash");
        }, 800);
      }
    } catch (error) {
      showStatus(error.message || `คัดลอกข้อความ ${platformName} ไม่สำเร็จ`, true);
    }
  }

  function ensurePlatformCopyStyles() {
    if (document.getElementById("ihc-platform-copy-styles")) return;
    const style = document.createElement("style");
    style.id = "ihc-platform-copy-styles";
    style.textContent = `
      [data-ihc-copy-attached] {
        cursor: pointer !important;
        transition: transform 0.12s ease, filter 0.12s ease, background 0.15s ease;
      }
      [data-ihc-copy-attached]:hover {
        filter: brightness(0.96) !important;
        transform: scale(1.015);
      }
      .ihc-copied-flash {
        animation: ihcCopyPulse 0.8s ease;
      }
      @keyframes ihcCopyPulse {
        0% { transform: scale(1); outline: 3px solid #22c55e; }
        50% { transform: scale(1.05); outline: 3px solid #22c55e; }
        100% { transform: scale(1); outline: 3px solid transparent; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePlatformCalculatorCopyFeatures() {
    if (location.hostname !== "admeta.me" || !/^\/admin\/platform\/calculator/i.test(location.pathname)) {
      document.getElementById("ihc-platform-copy-toolbar")?.remove();
      return;
    }

    const netData = findPlatformNetPrices();
    if (!netData || !netData.shopeePrice) {
      document.getElementById("ihc-platform-copy-toolbar")?.remove();
      return;
    }

    ensurePlatformCopyStyles();

    const { shopeePrice, lazadaPrice, tiktokPrice, shopeeCell, lazadaCell, tiktokCell, netRow } = netData;

    const headers = findPlatformHeaders();
    attachPlatformClick(headers.shopeeHeader, "Shopee", () => findPlatformNetPrices()?.shopeePrice || shopeePrice);
    attachPlatformClick(headers.lazadaHeader, "Lazada", () => findPlatformNetPrices()?.lazadaPrice || lazadaPrice);
    attachPlatformClick(headers.tiktokHeader, "TikTok", () => findPlatformNetPrices()?.tiktokPrice || tiktokPrice);

    attachPlatformClick(shopeeCell, "Shopee", () => findPlatformNetPrices()?.shopeePrice || shopeePrice);
    attachPlatformClick(lazadaCell, "Lazada", () => findPlatformNetPrices()?.lazadaPrice || lazadaPrice);
    attachPlatformClick(tiktokCell, "TikTok", () => findPlatformNetPrices()?.tiktokPrice || tiktokPrice);

    const table = document.querySelector("table");
    if (table) {
      const ths = [...table.querySelectorAll("th")];
      const sIdx = ths.findIndex((th) => /Shopee/i.test(th.innerText || ""));
      const lIdx = ths.findIndex((th) => /Lazada/i.test(th.innerText || ""));
      const tIdx = ths.findIndex((th) => /TikTok/i.test(th.innerText || ""));

      if (sIdx >= 0 && lIdx >= 0 && tIdx >= 0) {
        const bodyRows = [...table.querySelectorAll("tbody tr")];
        bodyRows.forEach((r) => {
          const cells = [...r.querySelectorAll("td, th")];
          if (cells[sIdx]) attachPlatformClick(cells[sIdx], "Shopee", () => findPlatformNetPrices()?.shopeePrice || shopeePrice);
          if (cells[lIdx]) attachPlatformClick(cells[lIdx], "Lazada", () => findPlatformNetPrices()?.lazadaPrice || lazadaPrice);
          if (cells[tIdx]) attachPlatformClick(cells[tIdx], "TikTok", () => findPlatformNetPrices()?.tiktokPrice || tiktokPrice);
        });
      }
    }

    let toolbar = document.getElementById("ihc-platform-copy-toolbar");
    const targetParent = (netRow && netRow.closest("table")?.parentElement) ||
                         document.querySelector("table")?.parentElement ||
                         (netRow && netRow.parentElement);

    if (!targetParent) return;

    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = "ihc-platform-copy-toolbar";
      Object.assign(toolbar.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "10px",
        margin: "12px 0",
        padding: "10px 14px",
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        border: "1.5px solid #e2e8f0",
        borderRadius: "10px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
      });
      toolbar.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13.5px;color:#1e293b;">
          <span style="font-size:16px;">📋</span>
          <span>ก๊อบปี้สเปก + ราคาขายสุทธิ:</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button type="button" data-copy-platform="Shopee" title="คลิกเพื่อก๊อบปี้ข้อความ Shopee" style="background:#ee4d2d;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-weight:700;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(238,77,45,0.25);transition:all 0.15s ease;">
            <span>🟠 ก๊อบปี้ Shopee</span>
            <span class="ihc-price-badge" style="background:rgba(255,255,255,0.25);padding:1px 6px;border-radius:6px;font-size:12px;"></span>
          </button>
          <button type="button" data-copy-platform="Lazada" title="คลิกเพื่อก๊อบปี้ข้อความ Lazada" style="background:#0f146d;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-weight:700;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(15,20,109,0.25);transition:all 0.15s ease;">
            <span>🔵 ก๊อบปี้ Lazada</span>
            <span class="ihc-price-badge" style="background:rgba(255,255,255,0.25);padding:1px 6px;border-radius:6px;font-size:12px;"></span>
          </button>
          <button type="button" data-copy-platform="TikTok" title="คลิกเพื่อก๊อบปี้ข้อความ TikTok" style="background:#000000;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-weight:700;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(0,0,0,0.25);transition:all 0.15s ease;">
            <span>⚫ ก๊อบปี้ TikTok</span>
            <span class="ihc-price-badge" style="background:rgba(255,255,255,0.25);padding:1px 6px;border-radius:6px;font-size:12px;"></span>
          </button>
        </div>
      `;

      toolbar.addEventListener("click", async (event) => {
        const btn = event.target.closest("button[data-copy-platform]");
        if (!btn) return;
        event.preventDefault();
        const platform = btn.dataset.copyPlatform;
        const latestNet = findPlatformNetPrices();
        const price = platform === "Shopee" ? latestNet?.shopeePrice
                    : platform === "Lazada" ? latestNet?.lazadaPrice
                    : latestNet?.tiktokPrice;
        await copyPlatformSpecText(platform, price, btn);
      });

      const tableEl = targetParent.querySelector("table") || targetParent;
      if (tableEl && tableEl !== targetParent) {
        targetParent.insertBefore(toolbar, tableEl);
      } else {
        targetParent.prepend(toolbar);
      }
    }

    const shopeeBtnBadge = toolbar.querySelector('button[data-copy-platform="Shopee"] .ihc-price-badge');
    const lazadaBtnBadge = toolbar.querySelector('button[data-copy-platform="Lazada"] .ihc-price-badge');
    const tiktokBtnBadge = toolbar.querySelector('button[data-copy-platform="TikTok"] .ihc-price-badge');
    if (shopeeBtnBadge) shopeeBtnBadge.textContent = shopeePrice ? `${shopeePrice}.-` : "";
    if (lazadaBtnBadge) lazadaBtnBadge.textContent = lazadaPrice ? `${lazadaPrice}.-` : "";
    if (tiktokBtnBadge) tiktokBtnBadge.textContent = tiktokPrice ? `${tiktokPrice}.-` : "";
  }

  function setPlatformInputValue(input, value, pressEnter = false) {
    if (!input) return;
    input.focus();
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set ||
      function (v) { this.value = v; };
    valueSetter.call(input, "");
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward", data: null }));
    valueSetter.call(input, value);
    input.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: value
    }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "End", code: "End" }));
    if (pressEnter) {
      input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 }));
      input.dispatchEvent(new KeyboardEvent("keypress", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 }));
      input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 }));
    }
  }

  function getPlatformRowElement(inputEl) {
    let rowEl = inputEl.closest("tr");
    if (!rowEl) {
      let curr = inputEl.parentElement;
      while (curr && curr !== document.body) {
        const r = curr.getBoundingClientRect();
        if (r.height > 120) break;
        if (r.width > inputEl.getBoundingClientRect().width + 150) rowEl = curr;
        curr = curr.parentElement;
      }
    }
    return rowEl || inputEl.closest("div") || inputEl.parentElement?.parentElement;
  }

  function findPlatformRowInputs(targetInput) {
    const rowEl = getPlatformRowElement(targetInput);
    if (!rowEl) return { titleInput: targetInput, qtyInput: null, priceInput: null };

    const allVisible = [...rowEl.querySelectorAll("input")].filter(isVisibleInput);
    const otherInputs = allVisible.filter((inp) => inp !== targetInput);

    let qtyInput = null;
    let priceInput = null;

    for (const inp of otherInputs) {
      const ph = (inp.placeholder || "").toLowerCase();
      const type = (inp.type || "").toLowerCase();
      const val = (inp.value || "").trim();
      const rect = inp.getBoundingClientRect();

      if (ph.includes("จำนวน") || ph.includes("qty") || (val === "1" && rect.width < 90) || (type === "number" && rect.width < 90)) {
        if (!qtyInput) qtyInput = inp;
      } else if (ph.includes("ราคา") || ph.includes("price") || ph.includes("บาท") || rect.width >= 80) {
        if (!priceInput) priceInput = inp;
      }
    }

    if (!qtyInput && otherInputs.length >= 1) qtyInput = otherInputs[0];
    if (!priceInput && otherInputs.length >= 2) priceInput = otherInputs[1];

    return { titleInput: targetInput, qtyInput, priceInput };
  }

  function extractSpecBuilderSummaryPrices() {
    const text = document.body.innerText || "";
    const baseMatch = text.match(/ราคาสเปกตั้งต้น\s*(?:[:\n\r\t ]*)[฿B]?\s*([\d,]+)/i);
    const diffMatch = text.match(/ส่วนต่างอัปเกรด\s*(?:[:\n\r\t ]*)[+฿B]?\s*([\d,]+)/i);
    const totalMatch = text.match(/ยอดสุทธิชำระ\s*(?:[:\n\r\t ]*)[฿B]?\s*([\d,]+)/i);
    return {
      basePrice: baseMatch ? baseMatch[1].replace(/,/g, "") : "",
      diffPrice: diffMatch ? diffMatch[1].replace(/,/g, "") : "",
      totalPrice: totalMatch ? totalMatch[1].replace(/,/g, "") : ""
    };
  }

  function extractBaseSpecTitle() {
    const badges = [...document.querySelectorAll("*")].filter((el) => {
      if (!el || el.children.length > 2) return false;
      const t = (el.innerText || el.textContent || "").trim();
      return t === "สเปกคอมพิวเตอร์ตั้งต้น" || t === "รายการสเปกคอมพิวเตอร์ตั้งต้น";
    });

    for (const badge of badges) {
      let container = badge.closest(".card, [class*='card'], [class*='box'], div");
      while (container && container !== document.body) {
        const r = container.getBoundingClientRect();
        if (r.height >= 50 && r.width >= 350) break;
        container = container.parentElement;
      }
      if (container) {
        const lines = (container.innerText || "").split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !/^(สเปกคอมพิวเตอร์ตั้งต้น|รายการสเปกคอมพิวเตอร์ตั้งต้น|ค้นหาและเลือก|เลือกสเปกใหม่|1)$/i.test(l));

        const titleLine = lines.find((l) => l.length >= 15 && (/^[A-Z0-9]+-[A-Z0-9]+/i.test(l) || l.includes("AMD") || l.includes("INTEL") || l.includes("RTX") || l.includes("GTX")));
        if (titleLine) return titleLine;
        if (lines[0] && lines[0].length >= 10) return lines[0];
      }
    }

    const fullText = document.body.innerText || "";
    const match = fullText.match(/(?:สเปกคอมพิวเตอร์ตั้งต้น|รายการสเปกคอมพิวเตอร์ตั้งต้น)\s*[\n\r]+([^\n\r]+)/i);
    if (match && match[1].trim()) {
      return match[1].trim();
    }

    return "";
  }

  function getSingleComponentRow(el) {
    let curr = el;
    while (curr && curr !== document.body) {
      const changeBtns = [...curr.querySelectorAll("button, [role='button']")].filter((b) =>
        /เปลี่ยน|เพิ่มสินค้า/.test((b.innerText || b.textContent || "").trim())
      );
      if (changeBtns.length === 1) {
        const r = curr.getBoundingClientRect();
        if (r.height >= 35 && r.height <= 130 && r.width >= 300) {
          return curr;
        }
      }
      curr = curr.parentElement;
    }
    return el.closest("tr, [class*='row'], div") || el;
  }

  function parseComponentRow(rowEl) {
    const fullText = (rowEl.innerText || "").trim();
    if (!fullText) return null;

    const isReplacement = /ทดแทน/i.test(fullText) || [...rowEl.querySelectorAll("i, svg, span")].some((icon) =>
      /replace|refresh|sync|reload/i.test(icon.className || "")
    );

    const priceMatch = fullText.match(/\+\s*([\d,]+)/);
    if (!isReplacement && !priceMatch) return null;

    const upgradePrice = isReplacement ? 0 : (priceMatch ? priceMatch[1].replace(/,/g, "") : 0);

    const hasOldPart = /เดิม\s*:/i.test(fullText);
    const hasUndoBtn = [...rowEl.querySelectorAll("button, [role='button'], a, i, svg")].some((b) => {
      const cls = `${b.className || ""} ${b.getAttribute("title") || ""} ${b.getAttribute("aria-label") || ""}`.toLowerCase();
      const txt = (b.innerText || b.textContent || "").trim();
      return /↺|undo|reset|คืนค่า|ย้อนกลับ/.test(cls) || /↺|คืนค่า|ย้อนกลับ/.test(txt);
    });

    if (!hasOldPart && !hasUndoBtn && !isReplacement && !priceMatch) return null;

    let newTitle = "";
    const lines = fullText.split("\n").map((l) => l.trim()).filter(Boolean);
    const oldLineIndex = lines.findIndex((l) => /^เดิม\s*:/i.test(l));

    if (oldLineIndex !== -1 && lines[oldLineIndex + 1]) {
      const nextLine = lines[oldLineIndex + 1];
      if (!/^\+\s*[\d,]+/.test(nextLine) && !/^(เปลี่ยน|เพิ่มสินค้า|↺|ทดแทน)$/i.test(nextLine)) {
        newTitle = nextLine;
      }
    }

    if (!newTitle) {
      const candidates = lines.filter((l) => {
        if (/^เดิม\s*:/i.test(l)) return false;
        if (/^\+\s*[\d,]+/.test(l)) return false;
        if (/^(เปลี่ยน|เพิ่มสินค้า|รีเซ็ต|ลบ|คืนค่า|↺|แนะนำอัปเกรด|ลดงบ|ทดแทน)$/i.test(l)) return false;
        if (/^(CPU|Mainboard|VGA|RAM|SSD|PSU|CASE|CS|Monitor|อุปกรณ์เสริม)\s*:?$/i.test(l)) return false;
        return l.length > 5;
      });
      if (candidates.length > 0) {
        newTitle = candidates[0];
      }
    }

    newTitle = newTitle
      .replace(/^(?:CPU|Mainboard|VGA|RAM|SSD|PSU|CASE|CS|Monitor)\s*:\s*/i, "")
      .replace(/^\+\s*[\d,]+\s*/, "")
      .trim();

    if (!newTitle || newTitle.length < 3) return null;

    const cleanTitle = newTitle.replace(/^\+?\s*(?:อั[พฟ]เกรด|ทดแทน)\s*/i, "").trim();
    const prefix = isReplacement ? "+ทดแทน " : "+อัพเกรด ";
    const formattedTitle = `${prefix}${cleanTitle}`;

    return {
      title: formattedTitle,
      rawTitle: cleanTitle,
      price: upgradePrice,
      qty: 1,
      isReplacement
    };
  }

  function extractStandaloneAccessories() {
    const items = [];

    const headerEls = [...document.querySelectorAll("*")].filter((el) => {
      if (!el || el.children.length > 3) return false;
      const t = (el.innerText || el.textContent || "").trim();
      return t.includes("อุปกรณ์เสริม และ สินค้าอิสระ") || t.includes("อุปกรณ์เสริมและสินค้าอิสระ");
    });

    if (headerEls.length === 0) return items;

    let sectionContainer = headerEls[0].closest(".card, [class*='card'], [class*='section'], div");
    while (sectionContainer && sectionContainer !== document.body) {
      if (sectionContainer.querySelectorAll("input, button").length >= 5) break;
      sectionContainer = sectionContainer.parentElement;
    }
    if (!sectionContainer) sectionContainer = document.body;

    const candidateRows = [...sectionContainer.querySelectorAll("tr, [class*='row'], div")].filter((el) => {
      if (!el || el === sectionContainer) return false;
      const r = el.getBoundingClientRect();
      if (r.height < 30 || r.height > 120 || r.width < 350) return false;
      const t = (el.innerText || "");
      const hasPrice = /[฿B]\s*[\d,]+/.test(t) || /[\d,]+\s*[฿B]/.test(t);
      const hasDeleteOrQty = el.querySelector("button, [role='button'], i, svg") &&
        [...el.querySelectorAll("button, i, svg")].some((b) => /trash|delete|remove|ลบ/.test((b.className || "") + (b.title || "")));
      return hasPrice && hasDeleteOrQty && !t.includes("อุปกรณ์เสริม และ สินค้าอิสระ");
    });

    const seenRows = new Set();
    for (const row of candidateRows) {
      let isNested = false;
      for (const other of seenRows) {
        if (other.contains(row) || row.contains(other)) {
          isNested = true;
          break;
        }
      }
      if (isNested) continue;
      seenRows.add(row);

      const fullText = (row.innerText || "").trim();
      const lines = fullText.split("\n").map((l) => l.trim()).filter(Boolean);

      const priceMatches = [...fullText.matchAll(/[฿B]\s*([\d,]+)/g)];
      let unitPrice = 0;
      if (priceMatches.length > 0) {
        unitPrice = parseInt(priceMatches[0][1].replace(/,/g, ""), 10) || 0;
      }

      let qty = 1;
      const qtyInput = row.querySelector("input[type='number'], input");
      if (qtyInput && qtyInput.value) {
        qty = parseInt(qtyInput.value, 10) || 1;
      } else {
        const qtyMatch = fullText.match(/(?:[-–]\s*)(\d+)(?:\s*[+＋])/);
        if (qtyMatch) qty = parseInt(qtyMatch[1], 10) || 1;
      }

      const titleCandidates = lines.filter((l) => {
        if (/^[฿B]\s*[\d,]+/.test(l)) return false;
        if (/^[\d,]+\s*[฿B]/.test(l)) return false;
        if (/^[-+–+1-9]$/.test(l)) return false;
        if (/^(ลบ|แก้ไข|เพิ่ม|ราคา|จำนวน|ราคารวม)$/i.test(l)) return false;
        if (l.includes("นครนายก") || l.includes("สินค้าเหลือน้อย")) return false;
        return l.length > 8;
      });

      if (titleCandidates.length > 0 && unitPrice > 0) {
        const cleanTitle = titleCandidates[0].replace(/^[฿B\d,\s]+/, "").trim();
        items.push({
          title: cleanTitle,
          rawTitle: cleanTitle,
          price: unitPrice,
          qty: qty,
          isAccessory: true
        });
      }
    }

    return items;
  }

  function extractSpecBuilderUpgradedItems() {
    const rawItems = [];
    const processedRows = new Set();

    const changeBtns = [...document.querySelectorAll("button, [role='button']")].filter((b) => {
      const t = (b.innerText || b.textContent || "").trim();
      return t === "เปลี่ยน" || t === "เพิ่มสินค้า";
    });

    for (const btn of changeBtns) {
      const rowEl = getSingleComponentRow(btn);
      if (rowEl && !processedRows.has(rowEl)) {
        processedRows.add(rowEl);
        const item = parseComponentRow(rowEl);
        if (item) rawItems.push(item);
      }
    }

    const oldPartElements = [...document.querySelectorAll("*")].filter((el) => {
      if (!el || el.children.length > 3) return false;
      const t = el.innerText || el.textContent || "";
      return /เดิม\s*:/i.test(t);
    });

    for (const el of oldPartElements) {
      const rowEl = getSingleComponentRow(el);
      if (rowEl && !processedRows.has(rowEl)) {
        processedRows.add(rowEl);
        const item = parseComponentRow(rowEl);
        if (item) rawItems.push(item);
      }
    }

    const seenTitles = new Set();
    const finalItems = [];
    for (const it of rawItems) {
      if (!it || !it.title) continue;
      const key = (it.rawTitle || it.title).toLowerCase().replace(/\s+/g, " ").trim();
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        it.qty = 1;
        finalItems.push(it);
      }
    }

    const accessories = extractStandaloneAccessories();
    for (const acc of accessories) {
      finalItems.push(acc);
    }

    return finalItems;
  }

  function extractSpecBuilderData() {
    const prices = extractSpecBuilderSummaryPrices();
    const baseSpecTitle = extractBaseSpecTitle();
    const upgradedItems = extractSpecBuilderUpgradedItems();
    return {
      baseSpecTitle,
      basePrice: prices.basePrice,
      diffPrice: prices.diffPrice,
      totalPrice: prices.totalPrice,
      upgradedItems
    };
  }

  function ensureSpecBuilderToPlatformButton() {
    if (location.hostname !== "admeta.me" || !/^\/admin\/spec-builder-v2(?:\/[^/]+)?\/?$/i.test(location.pathname)) {
      document.getElementById("ihc-spec-to-platform-calc-btn")?.remove();
      return;
    }

    if (document.getElementById("ihc-spec-to-platform-calc-btn")) return;

    const targetActionBtn = findPlatformButton(/คำนวณบิล/) || findPlatformButton(/พิมพ์\s*A6/);
    if (!targetActionBtn || !targetActionBtn.parentElement) return;

    const btn = document.createElement("button");
    btn.id = "ihc-spec-to-platform-calc-btn";
    btn.type = "button";
    btn.innerHTML = `<span style="font-size:15px;">🛒</span> <span>คำนวณราคาแพลตฟอร์ม</span>`;
    Object.assign(btn.style, {
      marginLeft: "8px",
      padding: "8px 16px",
      borderRadius: "8px",
      border: "none",
      background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
      color: "#ffffff",
      font: "700 14px Arial,Tahoma,sans-serif",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      boxShadow: "0 2px 8px rgba(234, 88, 12, 0.35)",
      transition: "all 0.15s ease"
    });

    btn.addEventListener("mouseenter", () => {
      btn.style.filter = "brightness(1.08)";
      btn.style.transform = "translateY(-1px)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.filter = "none";
      btn.style.transform = "none";
    });

    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const specData = extractSpecBuilderData();
      if (!specData.baseSpecTitle && (!specData.upgradedItems || specData.upgradedItems.length === 0)) {
        showStatus("ไม่พบข้อมูลสเปกคอมพิวเตอร์ กรุณาเลือกสเปกตั้งต้นก่อน", true);
        return;
      }

      btn.disabled = true;
      const oldHtml = btn.innerHTML;
      btn.innerHTML = `<span>⏳</span> <span>กำลังส่งไปหน้าคำนวณราคา...</span>`;

      try {
        const response = await chrome.runtime.sendMessage({
          type: "OPEN_PLATFORM_CALC_WITH_SPEC_DATA",
          data: specData
        });
        if (!response?.ok) {
          showStatus(response?.error || "ส่งข้อมูลไปยังหน้าคำนวณราคาแพลตฟอร์มไม่สำเร็จ", true);
        } else {
          showStatus("ส่งสเปกและรายการอัปเกรดไปยังหน้าคำนวณราคาแพลตฟอร์มแล้ว", false);
        }
      } catch (err) {
        showStatus(err.message || "ส่งข้อมูลไปยังหน้าคำนวณราคาแพลตฟอร์มไม่สำเร็จ", true);
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = oldHtml;
        }, 1200);
      }
    });

    targetActionBtn.parentElement.appendChild(btn);
  }

  function findPlatformComsetPopupCard(targetInput, specCode) {
    const inputRect = targetInput.getBoundingClientRect();
    const code = (specCode || "").trim().toLowerCase();

    const allCandidates = [...document.querySelectorAll("*")].filter((el) => {
      if (!el || el === targetInput || el.contains(targetInput) || targetInput.contains(el)) return false;
      if (["INPUT", "HTML", "BODY", "TABLE", "TBODY", "TR", "THEAD"].includes(el.tagName)) return false;
      if (el.id?.startsWith("ihc-")) return false;

      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;

      const r = el.getBoundingClientRect();
      if (r.top < inputRect.top + 5) return false;
      if (r.top > inputRect.bottom + 120) return false;
      if (r.right < inputRect.left - 20 || r.left > inputRect.right + 50) return false;
      if (r.width < 120 || r.height < 25 || r.height > 200) return false;

      const text = (el.innerText || el.textContent || "").trim().toLowerCase();
      const hasCode = code && text.includes(code);
      const hasBranchOrPrice = text.includes("นครนายก") || text.includes("สาขา") || text.includes("สต็อก") || /฿\s*[\d,]+/.test(text);

      return hasCode || hasBranchOrPrice;
    });

    if (allCandidates.length === 0) return null;

    const cardWithImg = allCandidates.find((el) => el.querySelector("img") && el.children.length >= 2);
    if (cardWithImg) return cardWithImg;

    allCandidates.sort((a, b) => (b.querySelector("img") ? 1 : 0) - (a.querySelector("img") ? 1 : 0));
    return allCandidates[0];
  }

  function clickPopupCardDeep(el) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, view: window };

    const innerTarget = el.querySelector("img") || el.querySelector("span, p, div") || el;
    innerTarget.dispatchEvent(new PointerEvent("pointerdown", opts));
    innerTarget.dispatchEvent(new MouseEvent("mousedown", opts));
    innerTarget.dispatchEvent(new PointerEvent("pointerup", opts));
    innerTarget.dispatchEvent(new MouseEvent("mouseup", opts));
    innerTarget.click();

    if (innerTarget !== el) {
      el.dispatchEvent(new PointerEvent("pointerdown", opts));
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new PointerEvent("pointerup", opts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.click();
    }
  }

  async function selectPlatformComsetFromDropdown(targetInput, specCode) {
    const code = (specCode || "").trim().toLowerCase();
    const startedAt = Date.now();

    while (Date.now() - startedAt < 5000) {
      const card = findPlatformComsetPopupCard(targetInput, code);
      if (card) {
        clickPopupCardDeep(card);
        await new Promise((r) => setTimeout(r, 250));
        const rowEl = getPlatformRowElement(targetInput);
        const rowText = (rowEl?.innerText || "");
        if (/CPU\s*:|Mainboard\s*:|Graphic\s*card\s*:/i.test(rowText)) {
          return true;
        }
        clickPopupCardDeep(card);
        return true;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    targetInput.focus();
    targetInput.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40 }));
    targetInput.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40 }));
    await new Promise((r) => setTimeout(r, 150));
    targetInput.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 }));
    targetInput.dispatchEvent(new KeyboardEvent("keypress", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 }));
    targetInput.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 }));
    return false;
  }

  async function populatePlatformCalculatorFromSpec({ baseSpecTitle, basePrice, upgradedItems, resetFirst = true }) {
    if (isLoginPage()) {
      throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองคำนวณราคาสินค้าแพลตฟอร์มอีกครั้ง");
    }
    if (location.hostname !== "admeta.me" || !/^\/admin\/platform\/calculator/i.test(location.pathname)) {
      throw new Error("กรุณาเปิดหน้าคำนวณราคาแพลตฟอร์มก่อน");
    }

    await waitFor(() => {
      if (isLoginPage()) {
        throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองคำนวณราคาสินค้าแพลตฟอร์มอีกครั้ง");
      }
      return findPlatformButton(/เพิ่มสินค้าปกติ|เพิ่มสินค้า\s*DIY|เพิ่มคอมเซ็ต/i);
    }, 15000, "ไม่พบปุ่มเพิ่มสินค้าบนหน้าคำนวณราคาแพลตฟอร์ม");

    if (resetFirst) {
      showStatus("กำลังรีเซ็ตรายการเก่าในหน้าคำนวณราคา...", false);
      await clearPlatformCalculatorItems();
      await new Promise((r) => setTimeout(r, 200));
    }

    if (baseSpecTitle && baseSpecTitle.trim()) {
      const cleanBaseTitle = baseSpecTitle.trim();
      const specCode = cleanBaseTitle.split(/\s+/)[0];
      showStatus(`กำลังเพิ่มคอมเซ็ต "${specCode}"...`, false);

      const beforeSet = new Set(findPlatformSearchRowInputs());
      const comsetBtn = findPlatformButton(/เพิ่มคอมเซ็ต/);
      if (!comsetBtn) throw new Error("ไม่พบปุ่ม 'เพิ่มคอมเซ็ต'");
      comsetBtn.click();

      const targetInput = await waitFor(() => {
        const currentRowInputs = findPlatformSearchRowInputs();
        const newRowInput = currentRowInputs.find((inp) => !beforeSet.has(inp));
        if (newRowInput) return newRowInput;
        const emptyRowInput = currentRowInputs[currentRowInputs.length - 1];
        if (emptyRowInput && (emptyRowInput.value || "").trim() === "") return emptyRowInput;
        return null;
      }, 10000, "กดเพิ่มคอมเซ็ตแล้วแต่ไม่พบช่องค้นหาชื่อสินค้า");

      try {
        targetInput.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {}

      setPlatformInputValue(targetInput, specCode, false);
      await new Promise((r) => setTimeout(r, 300));

      await selectPlatformComsetFromDropdown(targetInput, specCode);

      await new Promise((r) => setTimeout(r, 400));
      const { priceInput } = findPlatformRowInputs(targetInput);
      if (priceInput && (!priceInput.value || priceInput.value.trim() === "" || priceInput.value.trim() === "0") && basePrice) {
        setPlatformInputValue(priceInput, String(basePrice), false);
      }
    }

    if (Array.isArray(upgradedItems) && upgradedItems.length > 0) {
      for (let i = 0; i < upgradedItems.length; i++) {
        const item = upgradedItems[i];
        showStatus(`กำลังเพิ่มรายการสินค้า (${i + 1}/${upgradedItems.length}): ${item.title.substring(0, 32)}...`, false);

        const beforeSet = new Set(findPlatformSearchRowInputs());
        const normalBtn = findPlatformButton(/เพิ่มสินค้าปกติ/);
        if (!normalBtn) throw new Error("ไม่พบปุ่ม 'เพิ่มสินค้าปกติ'");
        normalBtn.click();

        const normalInput = await waitFor(() => {
          const currentRowInputs = findPlatformSearchRowInputs();
          const newRowInput = currentRowInputs.find((inp) => !beforeSet.has(inp));
          if (newRowInput) return newRowInput;
          const emptyRowInput = currentRowInputs[currentRowInputs.length - 1];
          if (emptyRowInput && (emptyRowInput.value || "").trim() === "") return emptyRowInput;
          return null;
        }, 10000, "กดเพิ่มสินค้าปกติแล้วแต่ไม่พบช่องค้นหาชื่อสินค้า");

        try {
          normalInput.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {}

        setPlatformInputValue(normalInput, item.title, false);
        await new Promise((r) => setTimeout(r, 200));

        const { priceInput, qtyInput } = findPlatformRowInputs(normalInput);
        if (priceInput && item.price !== undefined && item.price !== null) {
          setPlatformInputValue(priceInput, String(item.price), false);
        }
        if (qtyInput && item.qty) {
          setPlatformInputValue(qtyInput, String(item.qty), false);
        }

        await new Promise((r) => setTimeout(r, 200));
      }
    }

    await new Promise((r) => setTimeout(r, 450));
    const startCalcBtn = findPlatformButton(/เริ่มคำนวณราคาขายสุทธิ|เริ่มคำนวณราคา/i);
    if (startCalcBtn) {
      try {
        startCalcBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {}
      startCalcBtn.click();
    }

    showStatus(`นำเข้าสเป็คหลักและรายการอัปเกรด ${upgradedItems?.length || 0} รายการพร้อมคำนวณราคาขายสุทธิแล้ว!`, false);
    return { ok: true, upgradedCount: upgradedItems?.length || 0 };
  }

  function findPlatformDIYModalInput(beforeInputs = null) {
    const allVisible = [...document.querySelectorAll("input")].filter(isVisibleInput);
    if (beforeInputs) {
      const newlyAdded = allVisible.find((inp) => !beforeInputs.has(inp));
      if (newlyAdded) return newlyAdded;
    }
    for (const inp of allVisible) {
      const ph = `${inp.placeholder || ""} ${inp.getAttribute("aria-label") || ""}`;
      if (/วางลิงก์\s*DIY|ลิงก์\s*DIY|ihavecpu\.com\/diy/i.test(ph)) return inp;
    }
    const dialogs = [...document.querySelectorAll(".modal, [role='dialog'], [class*='modal'], div")]
      .filter((el) => {
        if (!el || el.children.length === 0) return false;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const txt = el.innerText || "";
        return txt.includes("ดึงสเปคจัดคอมพิวเตอร์ DIY") || txt.includes("วางลิงก์ DIY");
      });
    for (const d of dialogs) {
      const inp = [...d.querySelectorAll("input")].find(isVisibleInput);
      if (inp) return inp;
    }
    return null;
  }

  async function addPlatformCalculatorItem({ kind, title, diyUrl, resetFirst = false }) {
    if (isLoginPage()) {
      throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองคำนวณราคาสินค้าแพลตฟอร์มอีกครั้ง");
    }
    if (location.hostname !== "admeta.me" || !/^\/admin\/platform\/calculator/i.test(location.pathname)) {
      throw new Error("กรุณาเปิดหน้าคำนวณราคาแพลตฟอร์มก่อน");
    }

    await waitFor(() => {
      if (isLoginPage()) {
        throw new Error("กรุณาเข้าสู่ระบบ AdMeta ก่อน แล้วลองคำนวณราคาสินค้าแพลตฟอร์มอีกครั้ง");
      }
      return findPlatformButton(/เพิ่มสินค้าปกติ|เพิ่มสินค้า\s*DIY|เพิ่มคอมเซ็ต/i);
    }, 15000, "ไม่พบปุ่มเพิ่มสินค้าบนหน้าคำนวณราคาแพลตฟอร์ม");

    if (resetFirst) {
      const clearRes = await clearPlatformCalculatorItems();
      if (!clearRes.cleared) {
        return { ok: false, needsPageReload: true };
      }
    }

    if (kind === "diy") {
      if (!diyUrl) throw new Error("ไม่พบลิงก์สเป็ค DIY");
      let modalInput = findPlatformDIYModalInput();
      if (!modalInput) {
        const beforeInputs = new Set([...document.querySelectorAll("input")].filter(isVisibleInput));
        const diyBtn = findPlatformButton(/เพิ่มสินค้า\s*DIY/i);
        if (!diyBtn) throw new Error("ไม่พบปุ่ม 'เพิ่มสินค้า DIY'");
        diyBtn.click();
        modalInput = await waitFor(
          () => findPlatformDIYModalInput(beforeInputs),
          10000,
          "เปิดหน้าต่างดึงสเปค DIY แล้วแต่ไม่พบช่องวางลิงก์ DIY"
        );
      }
      setPlatformInputValue(modalInput, diyUrl, false);
      setTimeout(() => {
        const confirmBtn = findPlatformButton(/ยืนยันดึงข้อมูล/);
        if (confirmBtn) confirmBtn.click();
      }, 250);
      return { ok: true, kind: "diy", diyUrl };
    }

    const cleanTitle = (title || "").trim();
    if (!cleanTitle) throw new Error("ไม่พบชื่อรายการสินค้า");

    const isComset = kind === "comset";
    const buttonRegex = isComset ? /เพิ่มคอมเซ็ต/ : /เพิ่มสินค้าปกติ/;

    const existingRowInputs = findPlatformSearchRowInputs();
    let targetInput = existingRowInputs.find((inp) => {
      if ((inp.value || "").trim() !== "") return false;
      const hasPcSetBadge = rowHasPcSetBadge(inp);
      return isComset ? hasPcSetBadge : !hasPcSetBadge;
    });

    if (!targetInput) {
      const beforeSet = new Set(existingRowInputs);
      const beforeAllVisible = new Set([...document.querySelectorAll("input")].filter(isVisibleInput));
      const addBtn = findPlatformButton(buttonRegex);
      if (!addBtn) {
        throw new Error(isComset ? "ไม่พบปุ่ม 'เพิ่มคอมเซ็ต'" : "ไม่พบปุ่ม 'เพิ่มสินค้าปกติ'");
      }
      addBtn.click();
      targetInput = await waitFor(() => {
        const currentRowInputs = findPlatformSearchRowInputs();
        const newRowInput = currentRowInputs.find((inp) => !beforeSet.has(inp));
        if (newRowInput) return newRowInput;
        const emptyRowInput = currentRowInputs[currentRowInputs.length - 1];
        if (emptyRowInput && (emptyRowInput.value || "").trim() === "") return emptyRowInput;
        const allVis = [...document.querySelectorAll("input")].filter(isVisibleInput);
        const anyNew = allVis.find((inp) => !beforeAllVisible.has(inp));
        return anyNew || null;
      }, 10000, "กดเพิ่มรายการแล้วแต่ไม่พบช่องค้นหาชื่อสินค้า");
    }

    try {
      targetInput.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {}
    setPlatformInputValue(targetInput, cleanTitle, false);

    return { ok: true, kind: isComset ? "comset" : "normal", title: cleanTitle };
  }

  function showStatus(message, isError) {
    let status = document.getElementById("ihavecpu-admeta-status");
    if (!status) {
      status = document.createElement("div");
      status.id = "ihavecpu-admeta-status";
      Object.assign(status.style, {
        position: "fixed",
        right: "18px",
        bottom: "18px",
        zIndex: "2147483647",
        maxWidth: "420px",
        padding: "12px 16px",
        borderRadius: "10px",
        boxShadow: "0 4px 18px rgba(0,0,0,.22)",
        font: "14px/1.5 Arial,Tahoma,sans-serif",
        color: "#fff"
      });
      document.body.appendChild(status);
    }
    status.style.background = isError ? "#a61b1b" : "#176b3a";
    status.textContent = message;
    status.style.display = "block";
    clearTimeout(status.__hideTimer);
    status.__hideTimer = setTimeout(() => { status.style.display = "none"; }, 7000);
  }

  let dismissedUpdateVersion = "";

  function showUpdateNotice(status) {
    if (!status || status.silentUpdate || (!status.diskNeedsReload && !status.remoteHasNewer)) {
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
      "+ เซ็ตโปรตัดรายละเอียดสเปกย่อย (CPU, MB ฯลฯ) ออก เหลือเฉพาะชื่อเซ็ตและราคา",
      "+ ปุ่มก๊อบปี้สเปก + ราคาขายสุทธิ Shopee / Lazada / TikTok",
      "+ คลิกที่หัวตารางหรือช่องราคาแพลตฟอร์มเพื่อคัดลอกได้ทันที",
      "+ แก้ไขคำว่า 'แพลตฟอร์ม' ให้ถูกต้องทั่วทั้งระบบ"
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
          กดปุ่มด้านล่างเพื่อซิงก์และรีเซ็ตใช้เวอร์ชันใหม่ทันที
        </div>
        <button type="button" data-reload-extension-now="1" style="display:block;width:100%;border:0;text-align:center;background:#d71920;color:#fff;font-weight:700;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px;">
          🔄 กดอัปเดตและรีเซ็ตทันที
        </button>
        <a href="chrome://extensions/" data-open-extensions="1" style="display:block;text-align:center;color:#666;text-decoration:underline;font-size:11px;margin-top:6px;cursor:pointer;">
          หรือเปิดหน้าส่วนขยาย (chrome://extensions/)
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
        const reloadNowBtn = event.target.closest("[data-reload-extension-now]");
        if (reloadNowBtn) {
          event.preventDefault();
          reloadNowBtn.textContent = "กำลังอัปเดตและรีเซ็ตส่วนขยาย...";
          reloadNowBtn.disabled = true;
          try {
            const iframe = document.createElement("iframe");
            iframe.style.display = "none";
            iframe.src = "ihavecpu-updater://update";
            document.body.appendChild(iframe);
            setTimeout(() => iframe.remove(), 3000);
          } catch {}
          chrome.runtime.sendMessage({ type: "RELOAD_EXTENSION_NOW", waitForDiskSync: true }).catch(() => {});
          setTimeout(() => location.reload(), 1500);
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

  chrome.storage.local.get({ updateStatus: null }).then(({ updateStatus }) => {
    if (updateStatus && (updateStatus.diskNeedsReload || updateStatus.remoteHasNewer)) {
      showUpdateNotice(updateStatus);
    }
  }).catch(() => {});

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.updateStatus) {
      showUpdateNotice(changes.updateStatus.newValue);
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "SHOW_UPDATE_NOTICE") {
      showUpdateNotice(message.status);
      return;
    }
    if (message?.type === "CHECK_UNSAVED_INPUT") {
      if (/^\/admin\/platform\/calculator/i.test(location.pathname)) {
        const hasRows = findPlatformSearchRowInputs().some((inp) => (inp.value || "").trim().length > 0);
        sendResponse({
          hasUnsaved: hasRows,
          title: document.title?.trim() || "AdMeta Platform Calculator"
        });
        return;
      }
      sendResponse({
        hasUnsaved: false,
        title: document.title?.trim() || "AdMeta Spec Builder V2"
      });
      return;
    }
    if (message?.type === "ADD_PLATFORM_CALC_ITEM") {
      addPlatformCalculatorItem(message)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: error.message || "เพิ่มรายการในหน้าคำนวณราคาแพลตฟอร์มไม่สำเร็จ" }));
      return true;
    }
    if (message?.type === "POPULATE_PLATFORM_CALC_FROM_SPEC") {
      populatePlatformCalculatorFromSpec(message)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: error.message || "นำเข้าสเปกและรายการอัปเกรดไม่สำเร็จ" }));
      return true;
    }
    if (message?.type === "SHOW_STATUS") {
      showStatus(message.message || "", message.isError === true);
      return;
    }
    if (message?.type !== "CALCULATE_ADMETA_DIY_MESSAGE") return;
    calculateDIYMessage(message.diyUrl)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message || "คำนวณสเป็ค DIY ใน AdMeta ไม่สำเร็จ" }));
    return true;
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "SEARCH_ADMETA_SPEC") {
      searchSpecInBuilder(message.searchTerm)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: error.message || "ค้นหาสเป็คใน AdMeta ไม่สำเร็จ" }));
      return true;
    }
    if (message?.type !== "OPEN_PROMO_SET_FOR_UPGRADE") return;
    openPromoSetForUpgrade(message.searchTerm)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message || "เปิดเซ็ตโปรใน AdMeta ไม่สำเร็จ" }));
    return true;
  });

  document.addEventListener("keydown", (event) => {
    if (!chrome?.runtime?.id) return;
    if (event.key !== "Enter") return;
    const target = event.target;
    if (!target || target.tagName !== "INPUT") return;
    const historyInput = findHistorySearchInput();
    if (historyInput && target === historyInput) return;
    const mainInput = findMainBuilderSearchInput();
    if (!mainInput || target !== mainInput) return;
    const val = (target.value || "").trim();
    if (!SB_HISTORY_CODE_REGEX.test(val)) return;

    event.preventDefault();
    event.stopPropagation();
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (valueSetter) {
      valueSetter.call(target, "");
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward", data: null }));
    }
    showStatus(`กำลังเปิดประวัติและโหลดสเปก "${val.toUpperCase()}"...`, false);
    loadSpecFromHistory(val)
      .then(() => showStatus(`โหลดสเปก "${val.toUpperCase()}" จากประวัติเรียบร้อยแล้ว`, false))
      .catch((error) => showStatus(error.message || "โหลดสเปกจากประวัติไม่สำเร็จ", true));
  }, true);

  ensurePlatformCalculatorResetButton();
  ensurePlatformCalculatorCopyFeatures();
  ensureSpecBuilderToPlatformButton();
  const calcResetIntervalId = window.setInterval(() => {
    if (!chrome?.runtime?.id) {
      clearInterval(calcResetIntervalId);
      return;
    }
    ensurePlatformCalculatorResetButton();
    ensurePlatformCalculatorCopyFeatures();
    ensureSpecBuilderToPlatformButton();
  }, 700);
})();
