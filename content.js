// content.js – Eyedropper content script

(function () {
  let active = false;
  let canvas, ctx;
  let scaleX = 1, scaleY = 1;
  let tooltip, indicator, overlay;
  let prevHtmlOverflow = "", prevBodyOverflow = "";

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

  // ──────────────────────────────────────────
  // Tooltip element (live preview bubble)
  // ──────────────────────────────────────────
  function createTooltip() {
    tooltip = document.createElement("div");
    tooltip.id = "colorfind-tooltip";
    tooltip.innerHTML = `
      <div id="colorfind-swatch"></div>
      <div id="colorfind-info">
        <span id="colorfind-name">—</span>
        <span id="colorfind-hex">—</span>
        <span id="colorfind-rgb">—</span>
        <span id="colorfind-closest">—</span>
      </div>
    `;
    document.body.appendChild(tooltip);
  }

  function updateTooltip(x, y, r, g, b) {
    const hex   = rgbToHex(r, g, b);
    const rgb   = `rgb(${r}, ${g}, ${b})`;
    const closest = findClosestNamedColor(r, g, b);
    const txt   = textColorFor(r, g, b);

    // Smart positioning - avoid screen edges
    const tooltipWidth = 260;  // max-width from CSS
    const tooltipHeight = 90;
    const padding = 20;

    let left = x + padding;
    let top = y - tooltipHeight;

    // If tooltip would go off right edge, flip to left side of cursor
    if (left + tooltipWidth > window.innerWidth) {
      left = x - tooltipWidth - padding;
    }

    // If tooltip would go off bottom edge, show above cursor
    if (top + tooltipHeight > window.innerHeight) {
      top = y - tooltipHeight - padding;
    }

    // If tooltip would go off top edge, show below cursor
    if (top < 0) {
      top = y + padding;
    }

    // If tooltip would go off left edge (after flipping), keep it on screen
    if (left < 0) {
      left = padding;
    }

    tooltip.style.left = left + "px";
    tooltip.style.top  = top + "px";

    document.getElementById("colorfind-swatch").style.background = hex;
    document.getElementById("colorfind-name").textContent   = closest.name;
    document.getElementById("colorfind-name").style.color   = txt;
    document.getElementById("colorfind-name").style.background = hex;
    document.getElementById("colorfind-hex").textContent    = hex;
    document.getElementById("colorfind-rgb").textContent    = rgb;
    document.getElementById("colorfind-closest").textContent = `≈ ${closest.name} (${rgbToHex(closest.r, closest.g, closest.b)})`;
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
        ctx = canvas.getContext("2d");
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

  function getPixel(clientX, clientY) {
    if (!ctx) return [0, 0, 0];
    const x = Math.min(canvas.width  - 1, Math.max(0, Math.round(clientX * scaleX)));
    const y = Math.min(canvas.height - 1, Math.max(0, Math.round(clientY * scaleY)));
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
      <div style="font-size:11px;opacity:0.7;margin-top:2px;">Left-click to pick • Right-click to exit</div>
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
  // Lock page scroll while picking, so the frozen screenshot
  // stays aligned with the cursor position
  // ──────────────────────────────────────────
  function lockScroll() {
    prevHtmlOverflow = document.documentElement.style.overflow;
    prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function unlockScroll() {
    document.documentElement.style.overflow = prevHtmlOverflow;
    document.body.style.overflow = prevBodyOverflow;
  }

  // ──────────────────────────────────────────
  // Activate / Deactivate the picker
  // ──────────────────────────────────────────
  async function activate(screenshotDataUrl) {
    if (active) return;
    active = true;
    createOverlay();
    createTooltip();
    createIndicator();
    lockScroll();

    try {
      await loadScreenshot(screenshotDataUrl);
    } catch (e) {
      // If the screenshot fails to decode, sampling will just report (0,0,0).
    }

    function onMouseMove(e) {
      const [r, g, b] = getPixel(e.clientX, e.clientY);
      updateTooltip(e.clientX, e.clientY, r, g, b);
    }

    function onClick(e) {
      // Only handle left clicks (button 0)
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      const [r, g, b] = getPixel(e.clientX, e.clientY);
      const hex     = rgbToHex(r, g, b);
      const rgb     = `rgb(${r}, ${g}, ${b})`;
      const closest = findClosestNamedColor(r, g, b);

      // Send result to background / popup
      chrome.runtime.sendMessage({
        type: "COLOR_PICKED",
        payload: { hex, rgb, r, g, b, closest }
      });

      // Show a flash confirmation on the page
      showFlash(e.clientX, e.clientY, hex);

      // Don't deactivate - let user pick multiple colors
      // They can right-click to exit
    }

    function onRightClick(e) {
      e.preventDefault();
      e.stopPropagation();
      deactivate();
    }

    function onWheel(e) {
      // Keep the frozen screenshot aligned with the cursor
      e.preventDefault();
    }

    // Attach all listeners to the overlay (blocks interaction with page)
    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mousedown", onClick);  // Use mousedown for better response
    overlay.addEventListener("contextmenu", onRightClick);
    overlay.addEventListener("wheel", onWheel, { passive: false });

    // Store refs so we can remove them
    window.__colorfind_handlers = { onMouseMove, onClick, onRightClick, onWheel };
  }

  function deactivate() {
    if (!active) return;
    active = false;
    unlockScroll();
    if (tooltip) { tooltip.remove(); tooltip = null; }
    if (indicator) { indicator.remove(); indicator = null; }
    if (overlay && window.__colorfind_handlers) {
      overlay.removeEventListener("mousemove", window.__colorfind_handlers.onMouseMove);
      overlay.removeEventListener("mousedown", window.__colorfind_handlers.onClick);
      overlay.removeEventListener("contextmenu", window.__colorfind_handlers.onRightClick);
      overlay.removeEventListener("wheel", window.__colorfind_handlers.onWheel);
      overlay.remove();
      overlay = null;
      delete window.__colorfind_handlers;
    }
    canvas = null;
    ctx    = null;
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
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "START_PICK") activate(msg.screenshot);
    if (msg.type === "STOP_PICK") deactivate();
  });

})();
