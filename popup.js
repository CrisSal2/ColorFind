// popup.js

document.addEventListener('DOMContentLoaded', function() {
  const pickBtn         = document.getElementById("pickBtn");
  const resultCard      = document.getElementById("resultCard");
  const swatchRow       = document.getElementById("swatchRow");
  const colorNameEl     = document.getElementById("colorName");
  const hexVal          = document.getElementById("hexVal");
  const rgbVal          = document.getElementById("rgbVal");
  const closestSwatch   = document.getElementById("closestSwatch");
  const closestName     = document.getElementById("closestName");
  const closestHex      = document.getElementById("closestHex");
  const historySection  = document.getElementById("historySection");
  const historySwatches = document.getElementById("historySwatches");
  const toast           = document.getElementById("toast");

  let picking = false;

  // ──────────────────────────────────────────
  // History (owned by background.js; stored in chrome.storage.local)
  // ──────────────────────────────────────────
  function loadHistory(cb) {
    chrome.storage.local.get({ colorHistory: [] }, (res) => cb(res.colorHistory));
  }

  function renderHistory(history) {
    if (!history.length) { historySection.style.display = "none"; return; }
    historySection.style.display = "block";
    historySwatches.innerHTML = "";
    history.forEach((item) => {
      const chip = document.createElement("div");
      chip.className = "history-chip";
      chip.style.background = item.hex;

      const tooltipEl = document.createElement("div");
      tooltipEl.className = "chip-tooltip";
      tooltipEl.textContent = `${item.hex} · ${item.closest.name}`;
      chip.appendChild(tooltipEl);

      chip.addEventListener("click", () => displayResult(item));
      historySwatches.appendChild(chip);
    });
  }

  // React to history changes regardless of which context (this popup,
  // or the background worker after a pick made elsewhere) wrote them.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.colorHistory) {
      renderHistory(changes.colorHistory.newValue || []);
    }
  });

  // ──────────────────────────────────────────
  // Display a picked color result
  // ──────────────────────────────────────────
  function displayResult(data) {
    resultCard.classList.add("visible");
    swatchRow.style.background = data.hex;

    // Determine contrast for badge
    const lum = luminance(data.r, data.g, data.b);
    colorNameEl.style.color = lum > 0.18 ? "#111" : "#eee";
    colorNameEl.textContent = data.closest.name;

    hexVal.textContent = data.hex;
    hexVal.dataset.copy = data.hex;
    rgbVal.textContent = data.rgb;
    rgbVal.dataset.copy = data.rgb;

    const closestHexVal = rgbToHex(data.closest.r, data.closest.g, data.closest.b);
    closestSwatch.style.background = closestHexVal;
    closestName.textContent = data.closest.name;
    closestHex.textContent  = closestHexVal;
  }

  function luminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  // ──────────────────────────────────────────
  // Toast (copy confirmation + error messages)
  // ──────────────────────────────────────────
  function showToast(message, isError) {
    toast.textContent = message || "Copied!";
    toast.style.background = isError ? "#ef4444" : "#22c55e";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1200);
  }

  document.querySelectorAll(".detail-value").forEach((el) => {
    el.addEventListener("click", () => {
      const val = el.dataset.copy;
      if (!val) return;
      navigator.clipboard.writeText(val).then(() => {
        el.classList.add("copied");
        showToast();
        setTimeout(() => el.classList.remove("copied"), 1200);
      });
    });
  });

  // ──────────────────────────────────────────
  // Pick button
  // ──────────────────────────────────────────
  function setPickingUI(isPicking) {
    picking = isPicking;
    pickBtn.classList.toggle("active", isPicking);
    pickBtn.textContent = isPicking ? "✕ Cancel" : "⬛ Pick a Color";
  }

  pickBtn.addEventListener("click", () => {
    if (picking) {
      setPickingUI(false);
      chrome.runtime.sendMessage({ type: "DEACTIVATE_PICKER" });
      return;
    }
    setPickingUI(true);
    chrome.runtime.sendMessage({ type: "ACTIVATE_PICKER" }, (response) => {
      if (!response || !response.ok) {
        setPickingUI(false);
        showToast(response && response.error ? response.error : "Can't pick colors on this page.", true);
        return;
      }
      // Get the popup out of the way so the whole page can be picked from.
      // Picks are saved to history and shown the next time the popup opens.
      window.close();
    });
  });

  // ──────────────────────────────────────────
  // Listen for color picked from content script
  // ──────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "COLOR_PICKED") {
      displayResult(msg.payload);
      setPickingUI(false);
      // History itself is persisted by background.js; the storage.onChanged
      // listener above re-renders it once that write lands.
    }
  });

  // ──────────────────────────────────────────
  // On popup open: load history and show the most recent color
  // ──────────────────────────────────────────
  loadHistory((history) => {
    renderHistory(history);
    if (history.length > 0) displayResult(history[0]);
  });

});
