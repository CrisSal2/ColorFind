// content.js – Eyedropper content script

(function () {
  let active = false;
  let canvas, ctx;
  let scaleX = 1, scaleY = 1;
  let tooltip, indicator, overlay;
  let magCanvas, magCtx, nameEl, hexEl, rgbEl, closestEl;
  let teardown = null;

  // ──────────────────────────────────────────
  // Standard CSS extended color keywords (148 colors, no duplicates)
  // ──────────────────────────────────────────
  const NAMED_COLORS = [
    [240,248,255,"Alice Blue"],[250,235,215,"Antique White"],[0,255,255,"Aqua"],
    [127,255,212,"Aquamarine"],[240,255,255,"Azure"],[245,245,220,"Beige"],
    [255,228,196,"Bisque"],[0,0,0,"Black"],[255,235,205,"Blanched Almond"],
    [0,0,255,"Blue"],[138,43,226,"Blue Violet"],[165,42,42,"Brown"],
    [222,184,135,"Burlywood"],[95,158,160,"Cadet Blue"],[127,255,0,"Chartreuse"],
    [210,105,30,"Chocolate"],[255,127,80,"Coral"],[100,149,237,"Cornflower Blue"],
    [255,248,220,"Cornsilk"],[220,20,60,"Crimson"],[0,0,139,"Dark Blue"],
    [0,139,139,"Dark Cyan"],[184,134,11,"Dark Goldenrod"],[169,169,169,"Dark Gray"],
    [0,100,0,"Dark Green"],[189,183,107,"Dark Khaki"],[139,0,139,"Dark Magenta"],
    [85,107,47,"Dark Olive Green"],[255,140,0,"Dark Orange"],[153,50,204,"Dark Orchid"],
    [139,0,0,"Dark Red"],[233,150,122,"Dark Salmon"],[143,188,143,"Dark Sea Green"],
    [72,61,139,"Dark Slate Blue"],[47,79,79,"Dark Slate Gray"],[0,206,209,"Dark Turquoise"],
    [148,0,211,"Dark Violet"],[255,20,147,"Deep Pink"],[0,191,255,"Deep Sky Blue"],
    [105,105,105,"Dim Gray"],[30,144,255,"Dodger Blue"],[178,34,34,"Firebrick"],
    [255,250,240,"Floral White"],[34,139,34,"Forest Green"],[255,0,255,"Fuchsia"],
    [220,220,220,"Gainsboro"],[248,248,255,"Ghost White"],[255,215,0,"Gold"],
    [218,165,32,"Goldenrod"],[128,128,128,"Gray"],[0,128,0,"Green"],
    [173,255,47,"Green Yellow"],[240,255,240,"Honeydew"],[255,105,180,"Hot Pink"],
    [205,92,92,"Indian Red"],[75,0,130,"Indigo"],[255,255,240,"Ivory"],
    [240,230,140,"Khaki"],[230,230,250,"Lavender"],[255,240,245,"Lavender Blush"],
    [124,252,0,"Lawn Green"],[255,250,205,"Lemon Chiffon"],[173,216,230,"Light Blue"],
    [240,128,128,"Light Coral"],[224,255,255,"Light Cyan"],[250,250,210,"Light Goldenrod Yellow"],
    [211,211,211,"Light Gray"],[144,238,144,"Light Green"],[255,182,193,"Light Pink"],
    [255,160,122,"Light Salmon"],[32,178,170,"Light Sea Green"],[135,206,250,"Light Sky Blue"],
    [119,136,153,"Light Slate Gray"],[176,196,222,"Light Steel Blue"],[255,255,224,"Light Yellow"],
    [0,255,0,"Lime"],[50,205,50,"Lime Green"],[250,240,230,"Linen"],
    [128,0,0,"Maroon"],[102,205,170,"Medium Aquamarine"],[0,0,205,"Medium Blue"],
    [186,85,211,"Medium Orchid"],[147,112,219,"Medium Purple"],[60,179,113,"Medium Sea Green"],
    [123,104,238,"Medium Slate Blue"],[0,250,154,"Medium Spring Green"],[72,209,204,"Medium Turquoise"],
    [199,21,133,"Medium Violet Red"],[25,25,112,"Midnight Blue"],[245,255,250,"Mint Cream"],
    [255,228,225,"Misty Rose"],[255,228,181,"Moccasin"],[255,222,173,"Navajo White"],
    [0,0,128,"Navy"],[253,245,230,"Old Lace"],[128,128,0,"Olive"],
    [107,142,35,"Olive Drab"],[255,165,0,"Orange"],[255,69,0,"Orange Red"],
    [218,112,214,"Orchid"],[238,232,170,"Pale Goldenrod"],[152,251,152,"Pale Green"],
    [175,238,238,"Pale Turquoise"],[219,112,147,"Pale Violet Red"],[255,239,213,"Papaya Whip"],
    [255,218,185,"Peach Puff"],[205,133,63,"Peru"],[255,192,203,"Pink"],
    [221,160,221,"Plum"],[176,224,230,"Powder Blue"],[128,0,128,"Purple"],
    [102,51,153,"Rebecca Purple"],[255,0,0,"Red"],[188,143,143,"Rosy Brown"],
    [65,105,225,"Royal Blue"],[139,69,19,"Saddle Brown"],[250,128,114,"Salmon"],
    [244,164,96,"Sandy Brown"],[46,139,87,"Sea Green"],[255,245,238,"Seashell"],
    [160,82,45,"Sienna"],[192,192,192,"Silver"],[135,206,235,"Sky Blue"],
    [106,90,205,"Slate Blue"],[112,128,144,"Slate Gray"],[255,250,250,"Snow"],
    [0,255,127,"Spring Green"],[70,130,180,"Steel Blue"],[210,180,140,"Tan"],
    [0,128,128,"Teal"],[216,191,216,"Thistle"],[255,99,71,"Tomato"],
    [64,224,208,"Turquoise"],[238,130,238,"Violet"],[245,222,179,"Wheat"],
    [255,255,255,"White"],[245,245,245,"White Smoke"],[255,255,0,"Yellow"],
    [154,205,50,"Yellow Green"]
  ];

  function colorDistance(r1, g1, b1, r2, g2, b2) {
    // Weighted Euclidean (human-perceptual approximation)
    const rMean = (r1 + r2) / 2;
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return Math.sqrt(
      (2 + rMean / 256) * dr * dr +
      4 * dg * dg +
      (2 + (255 - rMean) / 256) * db * db
    );
  }

  function findClosestNamedColor(r, g, b) {
    let best = null, bestDist = Infinity;
    for (const [nr, ng, nb, name] of NAMED_COLORS) {
      const d = colorDistance(r, g, b, nr, ng, nb);
      if (d < bestDist) { bestDist = d; best = { name, r: nr, g: ng, b: nb }; }
    }
    return best;
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function luminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  function textColorFor(r, g, b) {
    return luminance(r, g, b) > 0.18 ? "#111111" : "#EEEEEE";
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  // ──────────────────────────────────────────
  // Tooltip element (magnifier + live color info)
  // ──────────────────────────────────────────
  const MAG_GRID = 15;   // screenshot pixels shown across (odd, so there's a center pixel)
  const MAG_SIZE = 120;  // on-screen size in CSS px

  function createTooltip() {
    tooltip = document.createElement("div");
    tooltip.id = "colorfind-tooltip";
    tooltip.innerHTML = `
      <canvas id="colorfind-magnifier"></canvas>
      <div id="colorfind-info">
        <span id="colorfind-name">—</span>
        <span id="colorfind-hex">—</span>
        <span id="colorfind-rgb">—</span>
        <span id="colorfind-closest">—</span>
      </div>
    `;
    tooltip.style.visibility = "hidden"; // shown on first mousemove
    document.body.appendChild(tooltip);

    // Back the magnifier at device resolution so the pixel grid stays crisp
    const dpr = window.devicePixelRatio || 1;
    magCanvas = tooltip.querySelector("#colorfind-magnifier");
    magCanvas.width = magCanvas.height = Math.round(MAG_SIZE * dpr);
    magCanvas.style.width = magCanvas.style.height = MAG_SIZE + "px";
    magCtx = magCanvas.getContext("2d");

    nameEl    = tooltip.querySelector("#colorfind-name");
    hexEl     = tooltip.querySelector("#colorfind-hex");
    rgbEl     = tooltip.querySelector("#colorfind-rgb");
    closestEl = tooltip.querySelector("#colorfind-closest");
  }

  function drawMagnifier(px, py) {
    const W = magCanvas.width;
    const cell = W / MAG_GRID;
    const half = (MAG_GRID - 1) / 2;

    magCtx.imageSmoothingEnabled = false;
    magCtx.fillStyle = "#0f0f1a"; // shows past the screenshot edges
    magCtx.fillRect(0, 0, W, W);
    magCtx.drawImage(canvas, px - half, py - half, MAG_GRID, MAG_GRID, 0, 0, W, W);

    // Pixel grid
    magCtx.lineWidth = 1;
    magCtx.strokeStyle = "rgba(0,0,0,0.18)";
    magCtx.beginPath();
    for (let i = 1; i < MAG_GRID; i++) {
      const p = Math.round(i * cell) + 0.5;
      magCtx.moveTo(p, 0); magCtx.lineTo(p, W);
      magCtx.moveTo(0, p); magCtx.lineTo(W, p);
    }
    magCtx.stroke();

    // Outline the sampled pixel: white ring inside a black ring, both outside the
    // pixel itself so its color stays fully visible on any background
    const c = half * cell;
    const lw = Math.max(1, Math.round(window.devicePixelRatio || 1));
    magCtx.lineWidth = lw;
    magCtx.strokeStyle = "#fff";
    magCtx.strokeRect(c - lw / 2, c - lw / 2, cell + lw, cell + lw);
    magCtx.strokeStyle = "#000";
    magCtx.strokeRect(c - 1.5 * lw, c - 1.5 * lw, cell + 3 * lw, cell + 3 * lw);
  }

  function positionTooltip(cursorX, cursorY) {
    const w = tooltip.offsetWidth, h = tooltip.offsetHeight;
    const gap = 24, margin = 8;

    // Right of the cursor, flipping to the left near the right edge
    let left = cursorX + gap;
    if (left + w > window.innerWidth - margin) left = cursorX - gap - w;
    left = Math.max(margin, left);

    // Vertically centered on the cursor, kept on screen
    const top = clamp(cursorY - h / 2, margin, window.innerHeight - h - margin);

    tooltip.style.left = left + "px";
    tooltip.style.top  = top + "px";
  }

  // px/py: screenshot pixel being sampled; cursorX/cursorY: mouse position in CSS px
  function updateTooltip(px, py, cursorX, cursorY) {
    const [r, g, b] = getPixel(px, py);
    const hex     = rgbToHex(r, g, b);
    const closest = findClosestNamedColor(r, g, b);

    drawMagnifier(px, py);
    nameEl.textContent      = closest.name;
    nameEl.style.color      = textColorFor(r, g, b);
    nameEl.style.background = hex;
    hexEl.textContent       = hex;
    rgbEl.textContent       = `rgb(${r}, ${g}, ${b})`;
    closestEl.textContent   = `≈ ${closest.name} (${rgbToHex(closest.r, closest.g, closest.b)})`;

    tooltip.style.visibility = "visible";
    positionTooltip(cursorX, cursorY);
  }

  // ──────────────────────────────────────────
  // Pixel sampling via a real screenshot of the tab
  // (background.js supplies a PNG data URL from chrome.tabs.captureVisibleTab,
  // which is same-origin and never taints the canvas)
  // ──────────────────────────────────────────
  function loadScreenshot(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        canvas = document.createElement("canvas");
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        // The screenshot is captured at device resolution; map CSS pixels to it.
        scaleX = img.naturalWidth  / window.innerWidth;
        scaleY = img.naturalHeight / window.innerHeight;
        resolve();
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  // Map a CSS-pixel cursor position to the screenshot pixel that contains it,
  // shifted by any keyboard nudge and clamped to the image.
  function toScreenshotPixel(clientX, clientY, nudgeX, nudgeY) {
    return [
      clamp(Math.floor(clientX * scaleX) + nudgeX, 0, canvas.width  - 1),
      clamp(Math.floor(clientY * scaleY) + nudgeY, 0, canvas.height - 1)
    ];
  }

  function getPixel(x, y) {
    const data = ctx.getImageData(x, y, 1, 1).data;
    return [data[0], data[1], data[2]];
  }

  // ──────────────────────────────────────────
  // Floating indicator badge
  // ──────────────────────────────────────────
  function createOverlay() {
    // Full-screen overlay to block all interactions
    overlay = document.createElement("div");
    overlay.id = "colorfind-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483645;
      cursor: crosshair;
      background: transparent;
    `;
    document.body.appendChild(overlay);
  }

  function createIndicator() {
    indicator = document.createElement("div");
    indicator.id = "colorfind-indicator";
    indicator.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#4ade80;animation:colorfind-pulse 1.5s infinite;"></div>
        <span style="font-weight:700;letter-spacing:0.5px;">ColorFind Active</span>
      </div>
      <div style="font-size:11px;opacity:0.7;margin-top:2px;">Click or Enter to pick • Arrows nudge 1px • Esc to exit</div>
    `;
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      background: #1a1a2e;
      color: #e2e8f0;
      padding: 12px 20px;
      border-radius: 12px;
      border: 2px solid rgba(74,222,128,0.3);
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      pointer-events: none;
      animation: colorfind-indicator-enter 0.3s ease-out;
    `;

    // Add animations to page if not already present
    if (!document.getElementById("colorfind-animations")) {
      const style = document.createElement("style");
      style.id = "colorfind-animations";
      style.textContent = `
        @keyframes colorfind-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        @keyframes colorfind-indicator-enter {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(indicator);
  }

  // ──────────────────────────────────────────
  // Activate / Deactivate the picker
  // ──────────────────────────────────────────
  const NUDGE_KEYS = new Map([
    ["ArrowLeft", [-1, 0]], ["ArrowRight", [1, 0]],
    ["ArrowUp",   [0, -1]], ["ArrowDown",  [0, 1]]
  ]);
  const SCROLL_KEYS = new Set([" ", "PageUp", "PageDown", "Home", "End"]);

  // Resolves once the picker is live; rejects if the screenshot can't be decoded.
  async function activate(screenshotDataUrl) {
    if (active) return;
    active = true;

    try {
      await loadScreenshot(screenshotDataUrl);
    } catch (e) {
      active = false;
      throw e;
    }
    if (!active) {
      // STOP_PICK arrived while the screenshot was loading
      canvas = ctx = null;
      return;
    }

    createOverlay();
    createTooltip();
    createIndicator();

    let cursorX = null, cursorY = null;  // last mouse position, CSS px
    let nudgeX = 0, nudgeY = 0;          // keyboard offset, screenshot px
    const lockedScrollX = window.scrollX, lockedScrollY = window.scrollY;

    function currentPixel() {
      const [x, y] = toScreenshotPixel(cursorX, cursorY, nudgeX, nudgeY);
      // Keep the nudge in step with clamping so it can't drift past the image edge
      nudgeX = x - Math.floor(cursorX * scaleX);
      nudgeY = y - Math.floor(cursorY * scaleY);
      return [x, y];
    }

    function refresh() {
      const [x, y] = currentPixel();
      updateTooltip(x, y, cursorX, cursorY);
    }

    function pick() {
      const [x, y] = currentPixel();
      const [r, g, b] = getPixel(x, y);
      const hex     = rgbToHex(r, g, b);
      const rgb     = `rgb(${r}, ${g}, ${b})`;
      const closest = findClosestNamedColor(r, g, b);

      // Send result to background / popup
      chrome.runtime.sendMessage({
        type: "COLOR_PICKED",
        payload: { hex, rgb, r, g, b, closest }
      });

      // Flash at the sampled pixel (which may be nudged away from the cursor).
      // Stay active afterwards so the user can pick multiple colors.
      showFlash((x + 0.5) / scaleX, (y + 0.5) / scaleY, hex);
    }

    function onMouseMove(e) {
      cursorX = e.clientX;
      cursorY = e.clientY;
      nudgeX = nudgeY = 0;
      refresh();
    }

    function onMouseDown(e) {
      // Swallow every button: no page clicks, focus changes or middle-click autoscroll
      e.preventDefault();
      e.stopPropagation();
      if (e.button !== 0) return;
      if (cursorX === null) { cursorX = e.clientX; cursorY = e.clientY; }
      pick();
    }

    function onRightClick(e) {
      e.preventDefault();
      e.stopPropagation();
      deactivate();
    }

    function onKeyDown(e) {
      const nudge = NUDGE_KEYS.get(e.key);
      if (!nudge && !SCROLL_KEYS.has(e.key) && e.key !== "Escape" && e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") { deactivate(); return; }
      if (cursorX === null) return; // nothing hovered yet
      if (e.key === "Enter") { pick(); return; }
      if (nudge) {
        const step = e.shiftKey ? 10 : 1;
        nudgeX += nudge[0] * step;
        nudgeY += nudge[1] * step;
        refresh();
      }
    }

    // Keep the frozen screenshot aligned with the page: block scroll input
    // rather than hiding overflow, which would remove the scrollbar and shift layout
    function preventDefault(e) { e.preventDefault(); }
    function stopPropagation(e) { e.stopPropagation(); }
    function onScroll() { window.scrollTo(lockedScrollX, lockedScrollY); }

    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mousedown", onMouseDown);
    overlay.addEventListener("contextmenu", onRightClick);
    overlay.addEventListener("wheel", preventDefault, { passive: false });
    overlay.addEventListener("touchmove", preventDefault, { passive: false });
    // Don't let the rest of the click sequence bubble to page handlers
    for (const type of ["pointerdown", "pointerup", "mouseup", "click", "dblclick", "auxclick"]) {
      overlay.addEventListener(type, stopPropagation);
    }
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll);

    // Overlay listeners go away with the overlay; only window listeners need removing
    teardown = () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll);
    };
  }

  function deactivate() {
    if (!active) return;
    active = false;
    if (teardown) { teardown(); teardown = null; }
    for (const el of [overlay, tooltip, indicator]) {
      if (el) el.remove();
    }
    overlay = tooltip = indicator = null;
    magCanvas = magCtx = nameEl = hexEl = rgbEl = closestEl = null;
    canvas = ctx = null;
  }

  // ──────────────────────────────────────────
  // Flash confirmation (brief overlay on click)
  // ──────────────────────────────────────────
  function showFlash(x, y, hex) {
    const flash = document.createElement("div");
    flash.id = "colorfind-flash";
    flash.style.cssText = `
      position:fixed; left:${x-50}px; top:${y-50}px;
      width:100px; height:100px; border-radius:50%;
      background:${hex}; border:3px solid rgba(255,255,255,0.8);
      box-shadow:0 4px 24px rgba(0,0,0,0.4);
      pointer-events:none; z-index:2147483647;
      animation:colorfind-flash-anim 0.6s ease-out forwards;
    `;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 650);
  }

  // ──────────────────────────────────────────
  // Listen for messages from popup / background
  // ──────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "START_PICK") {
      activate(msg.screenshot).then(
        () => sendResponse({ ok: true }),
        () => sendResponse({ ok: false, error: "Couldn't read the page screenshot." })
      );
      return true; // respond once the screenshot has loaded
    }
    if (msg.type === "STOP_PICK") {
      deactivate();
      sendResponse({ ok: true });
    }
  });

})();
