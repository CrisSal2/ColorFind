

(function () {
    let active = false;
    let canvas, ctx, tooltip;
    let animationId = null;


    const NAMED_COLORS = [
        [0, 0, 0, "Black"], [128, 0, 0, "Maroon"], [0, 128, 0, "Green"], [128, 128, 0, "Olive"],
        [0, 0, 128, "Navy"], [128, 0, 128, "Purple"], [0, 128, 128, "Teal"], [192, 192, 192, "Silver"],
        [128, 128, 128, "Gray"], [255, 0, 0, "Red"], [0, 255, 0, "Lime"], [255, 255, 0, "Yellow"],
        [0, 0, 255, "Blue"], [255, 0, 255, "Magenta"], [0, 255, 255, "Cyan"], [255, 255, 255, "White"],
        [238, 130, 238, "Violet"], [210, 105, 30, "Chocolate"], [255, 127, 80, "Coral"],
        [100, 149, 237, "Cornflower Blue"], [220, 20, 60, "Crimson"], [184, 134, 11, "Dark Goldenrod"],
        [139, 0, 0, "Dark Red"], [0, 100, 0, "Dark Green"], [139, 90, 43, "Saddle Brown"],
        [160, 82, 45, "Sienna"], [210, 180, 140, "Tan"], [255, 165, 0, "Orange"],
        [255, 140, 0, "Dark Orange"], [255, 215, 0, "Gold"], [218, 112, 214, "Orchid"],
        [205, 133, 63, "Peru"], [255, 192, 203, "Pink"], [176, 224, 230, "Powder Blue"],
        [173, 216, 230, "Light Blue"], [240, 230, 140, "Khaki"], [144, 238, 144, "Light Green"],
        [255, 182, 193, "Light Pink"], [255, 160, 122, "Light Salmon"], [32, 178, 170, "Light Sea Green"],
        [135, 206, 250, "Light Sky Blue"], [176, 196, 222, "Light Steel Blue"], [255, 255, 224, "Light Yellow"],
        [50, 205, 50, "Lime Green"], [250, 250, 210, "Lemon Chiffon"], [245, 245, 220, "Beige"],
        [255, 228, 196, "Bisque"], [255, 235, 205, "Blanched Almond"], [222, 184, 135, "BurlyWood"],
        [127, 255, 212, "Aquamarine"], [127, 255, 0, "Chartreuse"], [255, 250, 205, "Lemon Chiffon"],
        [139, 69, 19, "Saddle Brown"], [244, 164, 96, "Sandy Brown"], [250, 128, 114, "Salmon"],
        [46, 139, 87, "Sea Green"], [255, 245, 238, "Seashell"], [160, 82, 45, "Sienna"],
        [135, 206, 235, "Sky Blue"], [70, 130, 180, "Steel Blue"], [196, 226, 255, "Lavender Blue"],
        [230, 230, 250, "Lavender"], [255, 240, 245, "Lavender Blush"], [124, 252, 0, "Lawn Green"],
        [255, 253, 208, "Light Goldenrod Yellow"], [211, 211, 211, "Light Gray"],
        [112, 128, 144, "Slate Gray"], [47, 79, 79, "Dark Slate Gray"], [72, 61, 139, "Dark Slate Blue"],
        [106, 90, 205, "Slate Blue"], [187, 222, 187, "Mint Green"], [245, 222, 179, "Wheat"],
        [245, 245, 245, "White Smoke"], [255, 250, 240, "Floral White"], [255, 228, 225, "Misty Rose"],
        [253, 245, 230, "Old Lace"], [250, 235, 215, "Navajo White"], [253, 238, 230, "Peach Puff"],
        [221, 160, 221, "Plum"], [176, 224, 230, "Powder Blue"], [128, 0, 0, "Dark Red"],
        [0, 0, 139, "Dark Blue"], [0, 139, 139, "Dark Cyan"], [189, 183, 107, "Dark Khaki"],
        [47, 79, 79, "Dark Slate Gray"], [0, 100, 0, "Dark Green"], [139, 0, 139, "Dark Magenta"],
        [85, 107, 47, "Dark Olive Green"], [255, 140, 0, "Dark Orange"], [153, 50, 204, "Dark Orchid"],
        [139, 0, 0, "Dark Red"], [233, 150, 122, "Dark Salmon"], [143, 188, 143, "Dark Sea Green"],
        [48, 0, 48, "Dark Purple"], [148, 0, 211, "Dark Violet"], [255, 215, 0, "Gold"],
        [218, 165, 32, "Goldenrod"], [173, 255, 47, "Green Yellow"], [240, 248, 255, "Alice Blue"],
        [250, 235, 215, "Antique White"], [127, 255, 212, "Aquamarine"], [240, 255, 255, "Azure"],
        [245, 245, 220, "Beige"], [255, 228, 196, "Bisque"], [255, 235, 205, "Blanched Almond"],
        [138, 43, 226, "Blue Violet"], [165, 42, 42, "Brown"], [222, 184, 135, "Burlywood"],
        [95, 158, 160, "Cadet Blue"], [255, 127, 80, "Coral"], [100, 149, 237, "Cornflower Blue"],
        [255, 253, 208, "Corn Silk"], [220, 20, 60, "Crimson"], [191, 255, 0, "Chartreuse"],
        [153, 102, 0, "Dark Brown"]
    ];

    function colorDistance(r1, g1, b1, r2, g2, b2) {

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
        const hex = rgbToHex(r, g, b);
        const rgb = `rgb(${r}, ${g}, ${b})`;
        const closest = findClosestNamedColor(r, g, b);
        const txt = textColorFor(r, g, b);

        tooltip.style.left = (x + 20) + "px";
        tooltip.style.top = (y - 80) + "px";

        document.getElementById("colorfind-swatch").style.background = hex;
        document.getElementById("colorfind-name").textContent = closest.name;
        document.getElementById("colorfind-name").style.color = txt;
        document.getElementById("colorfind-name").style.background = hex;
        document.getElementById("colorfind-hex").textContent = hex;
        document.getElementById("colorfind-rgb").textContent = rgb;
        document.getElementById("colorfind-closest").textContent = `≈ ${closest.name} (${rgbToHex(closest.r, closest.g, closest.b)})`;
    }


    async function captureViewport() {


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
        canvas.width = w;
        canvas.height = h;
        ctx = canvas.getContext("2d");

        const img = new Image();
        img.src = "data:image/svg+xml," + encodeURIComponent(svg);

        await new Promise((resolve, reject) => {
            img.onload = resolve;
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


    async function activate() {
        if (active) return;
        active = true;
        document.body.style.cursor = "crosshair";
        createTooltip();


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
                const el = document.elementFromPoint(e.clientX, e.clientY);
                if (el) {
                    const bg = getComputedStyle(el).backgroundColor;
                    const m = bg.match(/[\d.]+/g);
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
            e.preventDefault();
            e.stopPropagation();

            let r, g, b;
            if (captureOk) {
                [r, g, b] = getPixel(e.clientX, e.clientY);
            } else {
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const bg = el ? getComputedStyle(el).backgroundColor : "rgb(0,0,0)";
                const m = bg.match(/[\d.]+/g) || [0, 0, 0];
                r = +m[0]; g = +m[1]; b = +m[2];
            }

            const hex = rgbToHex(r, g, b);
            const rgb = `rgb(${r}, ${g}, ${b})`;
            const closest = findClosestNamedColor(r, g, b);


            chrome.runtime.sendMessage({
                type: "COLOR_PICKED",
                payload: { hex, rgb, r, g, b, closest }
            });


            showFlash(e.clientX, e.clientY, hex, r, g, b);


            deactivate();
        }

        document.addEventListener("mousemove", onMouseMove, true);
        document.addEventListener("click", onClick, true);


        window.__colorfind_handlers = { onMouseMove, onClick };
    }

    function deactivate() {
        if (!active) return;
        active = false;
        document.body.style.cursor = "";
        if (tooltip) { tooltip.remove(); tooltip = null; }
        if (window.__colorfind_handlers) {
            document.removeEventListener("mousemove", window.__colorfind_handlers.onMouseMove, true);
            document.removeEventListener("click", window.__colorfind_handlers.onClick, true);
            delete window.__colorfind_handlers;
        }
        canvas = null;
        ctx = null;
    }


    function showFlash(x, y, hex, r, g, b) {
        const flash = document.createElement("div");
        flash.id = "colorfind-flash";
        flash.style.cssText = `
      position:fixed; left:${x - 50}px; top:${y - 50}px;
      width:100px; height:100px; border-radius:50%;
      background:${hex}; border:3px solid rgba(255,255,255,0.8);
      box-shadow:0 4px 24px rgba(0,0,0,0.4);
      pointer-events:none; z-index:2147483647;
      animation:colorfind-flash-anim 0.6s ease-out forwards;
    `;
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 650);
    }


    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "START_PICK") activate();
    });

})();
