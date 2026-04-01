// content.js – Eyedropper content script

(function () {
  let active = false;
  let canvas, ctx, tooltip;
  let animationId = null;

  // ──────────────────────────────────────────
  // Comprehensive named-color table (CSS named colors)
  // ──────────────────────────────────────────
  const NAMED_COLORS = [
    [0,0,0,"Black"],[128,0,0,"Maroon"],[0,128,0,"Green"],[128,128,0,"Olive"],
    [0,0,128,"Navy"],[128,0,128,"Purple"],[0,128,128,"Teal"],[192,192,192,"Silver"],
    [128,128,128,"Gray"],[255,0,0,"Red"],[0,255,0,"Lime"],[255,255,0,"Yellow"],
    [0,0,255,"Blue"],[255,0,255,"Magenta"],[0,255,255,"Cyan"],[255,255,255,"White"],
    [238,130,238,"Violet"],[210,105,30,"Chocolate"],[255,127,80,"Coral"],
    [100,149,237,"Cornflower Blue"],[220,20,60,"Crimson"],[184,134,11,"Dark Goldenrod"],
    [139,0,0,"Dark Red"],[0,100,0,"Dark Green"],[139,90,43,"Saddle Brown"],
    [160,82,45,"Sienna"],[210,180,140,"Tan"],[255,165,0,"Orange"],
    [255,140,0,"Dark Orange"],[255,215,0,"Gold"],[218,112,214,"Orchid"],
    [205,133,63,"Peru"],[255,192,203,"Pink"],[176,224,230,"Powder Blue"],
    [173,216,230,"Light Blue"],[240,230,140,"Khaki"],[144,238,144,"Light Green"],
    [255,182,193,"Light Pink"],[255,160,122,"Light Salmon"],[32,178,170,"Light Sea Green"],
    [135,206,250,"Light Sky Blue"],[176,196,222,"Light Steel Blue"],[255,255,224,"Light Yellow"],
    [50,205,50,"Lime Green"],[250,250,210,"Lemon Chiffon"],[245,245,220,"Beige"],
    [255,228,196,"Bisque"],[255,235,205,"Blanched Almond"],[222,184,135,"BurlyWood"],
    [127,255,212,"Aquamarine"],[127,255,0,"Chartreuse"],[255,250,205,"Lemon Chiffon"],
    [139,69,19,"Saddle Brown"],[244,164,96,"Sandy Brown"],[250,128,114,"Salmon"],
    [46,139,87,"Sea Green"],[255,245,238,"Seashell"],[160,82,45,"Sienna"],
    [135,206,235,"Sky Blue"],[70,130,180,"Steel Blue"],[196,226,255,"Lavender Blue"],
    [230,230,250,"Lavender"],[255,240,245,"Lavender Blush"],[124,252,0,"Lawn Green"],
    [255,253,208,"Light Goldenrod Yellow"],[211,211,211,"Light Gray"],
    [112,128,144,"Slate Gray"],[47,79,79,"Dark Slate Gray"],[72,61,139,"Dark Slate Blue"],
    [106,90,205,"Slate Blue"],[187,222,187,"Mint Green"],[245,222,179,"Wheat"],
    [245,245,245,"White Smoke"],[255,250,240,"Floral White"],[255,228,225,"Misty Rose"],
    [253,245,230,"Old Lace"],[250,235,215,"Navajo White"],[253,238,230,"Peach Puff"],
    [221,160,221,"Plum"],[176,224,230,"Powder Blue"],[128,0,0,"Dark Red"],
    [0,0,139,"Dark Blue"],[0,139,139,"Dark Cyan"],[189,183,107,"Dark Khaki"],
    [47,79,79,"Dark Slate Gray"],[0,100,0,"Dark Green"],[139,0,139,"Dark Magenta"],
    [85,107,47,"Dark Olive Green"],[255,140,0,"Dark Orange"],[153,50,204,"Dark Orchid"],
    [139,0,0,"Dark Red"],[233,150,122,"Dark Salmon"],[143,188,143,"Dark Sea Green"],
    [48,0,48,"Dark Purple"],[148,0,211,"Dark Violet"],[255,215,0,"Gold"],
    [218,165,32,"Goldenrod"],[173,255,47,"Green Yellow"],[240,248,255,"Alice Blue"],
    [250,235,215,"Antique White"],[127,255,212,"Aquamarine"],[240,255,255,"Azure"],
    [245,245,220,"Beige"],[255,228,196,"Bisque"],[255,235,205,"Blanched Almond"],
    [138,43,226,"Blue Violet"],[165,42,42,"Brown"],[222,184,135,"Burlywood"],
    [95,158,160,"Cadet Blue"],[255,127,80,"Coral"],[100,149,237,"Cornflower Blue"],
    [255,253,208,"Corn Silk"],[220,20,60,"Crimson"],[191,255,0,"Chartreuse"],
    [153,102,0,"Dark Brown"]
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
  // Screenshot + pixel sample via html2canvas-free method
  // We capture using a full-page canvas from the visible viewport
  // ──────────────────────────────────────────
  async function captureViewport() {
    // We use the CDP Page.captureScreenshot approach is not available in content scripts,
    // so we use a simpler approach: render a canvas over the page and use getImageData.
    // Modern approach: use the Screen Capture API (getUserMedia with tab capture) –
    // but the simplest cross-origin safe method for extensions is to use the
    // "tabs" API from the background. Instead, we'll use a well-known trick:
    // draw the page onto a canvas using SVG foreignObject (works for same-origin content).

    const w = window.innerWidth;
    const h = window.innerHeight;

    // Inline SVG foreignObject trick
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;overflow:hidden;">
          ${document.documentElement.outerHTML}
        </div>
      </foreignObject>
    </svg>`;

    canvas = document.createElement("canvas");
    canvas.width  = w;
    canvas.height = h;
    ctx = canvas.getContext("2d");

    const img = new Image();
    img.src = "data:image/svg+xml," + encodeURIComponent(svg);

    await new Promise((resolve, reject) => {
      img.onload  = resolve;
      img.onerror = reject;
    });

    ctx.drawImage(img, 0, 0);
    return true;
  }

  function getPixel(x, y) {
    if (!ctx) return [0, 0, 0];
    const data = ctx.getImageData(x, y, 1, 1).data;
    return [data[0], data[1], data[2]];
  }

  // ──────────────────────────────────────────
  // Floating indicator badge
  // ──────────────────────────────────────────
  let indicator = null;
  let overlay = null;
  
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
  // Activate / Deactivate the picker
  // ──────────────────────────────────────────
  async function activate() {
    if (active) return;
    active = true;
    createOverlay();
    createTooltip();
    createIndicator();

    // Attempt to capture; if it fails (e.g. cross-origin), we fall back
    // to reading computed background colors via elementFromPoint.
    let captureOk = false;
    try {
      await captureViewport();
      captureOk = true;
    } catch (e) {
      captureOk = false;
    }

    function onMouseMove(e) {
      if (!captureOk) {
        // Fallback: read computed style of element under cursor
        // Need to temporarily hide overlay to get element underneath
        overlay.style.pointerEvents = "none";
        const el = document.elementFromPoint(e.clientX, e.clientY);
        overlay.style.pointerEvents = "auto";
        if (el) {
          const bg = getComputedStyle(el).backgroundColor;
          const m  = bg.match(/[\d.]+/g);
          if (m && m.length >= 3) {
            updateTooltip(e.clientX, e.clientY, +m[0], +m[1], +m[2]);
            return;
          }
        }
        updateTooltip(e.clientX, e.clientY, 0, 0, 0);
        return;
      }
      const [r, g, b] = getPixel(e.clientX, e.clientY);
      updateTooltip(e.clientX, e.clientY, r, g, b);
    }

    function onClick(e) {
      // Only handle left clicks (button 0)
      if (e.button !== 0) return;
      
      e.preventDefault();
      e.stopPropagation();

      let r, g, b;
      if (captureOk) {
        [r, g, b] = getPixel(e.clientX, e.clientY);
      } else {
        overlay.style.pointerEvents = "none";
        const el = document.elementFromPoint(e.clientX, e.clientY);
        overlay.style.pointerEvents = "auto";
        const bg = el ? getComputedStyle(el).backgroundColor : "rgb(0,0,0)";
        const m  = bg.match(/[\d.]+/g) || [0, 0, 0];
        r = +m[0]; g = +m[1]; b = +m[2];
      }

      const hex     = rgbToHex(r, g, b);
      const rgb     = `rgb(${r}, ${g}, ${b})`;
      const closest = findClosestNamedColor(r, g, b);

      // Send result to background / popup
      chrome.runtime.sendMessage({
        type: "COLOR_PICKED",
        payload: { hex, rgb, r, g, b, closest }
      });

      // Show a flash confirmation on the page
      showFlash(e.clientX, e.clientY, hex, r, g, b);

      // Don't deactivate - let user pick multiple colors
      // They can right-click to exit
    }

    function onRightClick(e) {
      e.preventDefault();
      e.stopPropagation();
      deactivate();
    }

    // Attach all listeners to the overlay (blocks interaction with page)
    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mousedown", onClick);  // Use mousedown for better response
    overlay.addEventListener("contextmenu", onRightClick);

    // Store refs so we can remove them
    window.__colorfind_handlers = { onMouseMove, onClick, onRightClick };
  }

  function deactivate() {
    if (!active) return;
    active = false;
    if (tooltip) { tooltip.remove(); tooltip = null; }
    if (indicator) { indicator.remove(); indicator = null; }
    if (overlay && window.__colorfind_handlers) {
      overlay.removeEventListener("mousemove", window.__colorfind_handlers.onMouseMove);
      overlay.removeEventListener("mousedown", window.__colorfind_handlers.onClick);
      overlay.removeEventListener("contextmenu", window.__colorfind_handlers.onRightClick);
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
  function showFlash(x, y, hex, r, g, b) {
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
    if (msg.type === "START_PICK") activate();
    if (msg.type === "STOP_PICK") deactivate();
  });

})();
