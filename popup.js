

(function () {
    const pickBtn = document.getElementById("pickBtn");
    const resultCard = document.getElementById("resultCard");
    const swatchRow = document.getElementById("swatchRow");
    const colorNameEl = document.getElementById("colorName");
    const hexVal = document.getElementById("hexVal");
    const rgbVal = document.getElementById("rgbVal");
    const closestSwatch = document.getElementById("closestSwatch");
    const closestName = document.getElementById("closestName");
    const closestHex = document.getElementById("closestHex");
    const historySection = document.getElementById("historySection");
    const historySwatches = document.getElementById("historySwatches");
    const toast = document.getElementById("toast");

    let picking = false;


    const MAX_HISTORY = 16;

    function loadHistory(cb) {
        chrome.storage.local.get({ colorHistory: [] }, (res) => cb(res.colorHistory));
    }
    function saveHistory(history) {
        chrome.storage.local.set({ colorHistory: history });
    }

    function renderHistory(history) {
        if (!history.length) { historySection.style.display = "none"; return; }
        historySection.style.display = "block";
        historySwatches.innerHTML = "";
        history.forEach((item) => {
            const chip = document.createElement("div");
            chip.className = "history-chip";
            chip.style.background = item.hex;
            chip.innerHTML = `<div class="chip-tooltip">${item.hex}<br>${item.closest.name}</div>`;
            chip.addEventListener("click", () => displayResult(item));
            historySwatches.appendChild(chip);
        });
    }


    function displayResult(data) {
        resultCard.classList.add("visible");
        swatchRow.style.background = data.hex;


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
        closestHex.textContent = closestHexVal;
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


    function showToast() {
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


    pickBtn.addEventListener("click", () => {
        if (picking) {
            picking = false;
            pickBtn.classList.remove("active");
            pickBtn.textContent = "⬛ Pick a Color";

            window.close();
            return;
        }
        picking = true;
        pickBtn.classList.add("active");
        pickBtn.textContent = "✕ Cancel";


        chrome.runtime.sendMessage({ type: "ACTIVATE_PICKER" }, () => {

            setTimeout(() => window.close(), 120);
        });
    });


    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "COLOR_PICKED") {
            const data = msg.payload;
            displayResult(data);

            // Update history
            loadHistory((history) => {
                // Remove duplicates
                history = history.filter(h => h.hex !== data.hex);
                history.unshift(data);
                if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
                saveHistory(history);
                renderHistory(history);
            });
        }
    });


    loadHistory((history) => {
        renderHistory(history);
        if (history.length > 0) displayResult(history[0]);
    });

})();
