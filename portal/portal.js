// ── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_SIZE = 1080;
const SITE_URL = window.location.origin;

// Brand colors (must match CLAUDE.md design system)
const COLORS = {
  trexGreen:  "#2d5a27",
  gold:       "#c8a96e",
  white:      "#ffffff",
  whiteAlpha: "rgba(255,255,255,0.88)",
  overlay0:   "rgba(0,0,0,0)",
  overlay55:  "rgba(0,0,0,0.55)",
  overlay82:  "rgba(0,0,0,0.82)",
};

// ── State ─────────────────────────────────────────────────────────────────────

let pendingDraftId = null;
let pendingCanvas  = null;
let hasPublished   = false;

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// ── Canvas composition ────────────────────────────────────────────────────────

/**
 * Draw an image onto canvas using cover-fit (fill without distortion).
 */
function drawCover(ctx, img, x, y, w, h) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const canvasRatio = w / h;
  let sx, sy, sw, sh;

  if (imgRatio > canvasRatio) {
    sh = img.naturalHeight;
    sw = sh * canvasRatio;
    sy = 0;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sw = img.naturalWidth;
    sh = sw / canvasRatio;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/**
 * Word-wrap text onto canvas, returning final Y position after rendering.
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let curY = y;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, curY);
      line = word;
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, curY);
  return curY + lineHeight;
}

/**
 * Compose a 1080×1080 post image using the browser Canvas API.
 * Returns the canvas element (do NOT call toDataURL here — defer until needed).
 */
async function composePost(draft, imageEl) {
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width  = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");

  // 1. Background image
  drawCover(ctx, imageEl, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // 2. Dark gradient overlay (bottom-heavy)
  const grad = ctx.createLinearGradient(0, 300, 0, CANVAS_SIZE);
  grad.addColorStop(0,    COLORS.overlay0);
  grad.addColorStop(0.45, COLORS.overlay55);
  grad.addColorStop(1,    COLORS.overlay82);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const { headlineText, headlineFontSize, bodyText, bodyFontSize } = draft.overlayConfig;
  const pad = 60;
  const textWidth = CANVAS_SIZE - pad * 2;

  // 3. Headline — Playfair Display bold, gold
  ctx.fillStyle   = COLORS.gold;
  ctx.textAlign   = "left";
  ctx.textBaseline = "top";
  ctx.font = `bold ${headlineFontSize}px 'Playfair Display'`;
  const headlineY = wrapText(ctx, headlineText, pad, 700, textWidth, headlineFontSize + 10);

  // 4. Body copy — DM Sans light, white
  ctx.fillStyle = COLORS.whiteAlpha;
  ctx.font = `300 ${bodyFontSize}px 'DM Sans'`;
  // Clamp body to caption before hashtags (first paragraph only)
  const bodyOnly = bodyText.split("\n\n")[0].trim();
  wrapText(ctx, bodyOnly, pad, headlineY + 12, textWidth, bodyFontSize + 8);

  // 5. CTA strip at bottom
  const stripH = 88;
  ctx.fillStyle = COLORS.trexGreen;
  ctx.fillRect(0, CANVAS_SIZE - stripH, CANVAS_SIZE, stripH);

  ctx.fillStyle   = COLORS.white;
  ctx.textAlign   = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 26px 'DM Sans'";

  const ctaText = draft.ctaType === "website"
    ? "Lake Country Decking  ·  www.lakecountrydecking.com"
    : "Lake Country Decking  ·  Free Quote  ·  (920) 355-2174";
  ctx.fillText(ctaText, CANVAS_SIZE / 2, CANVAS_SIZE - stripH / 2);

  return canvas;
}

// ── Image loading ─────────────────────────────────────────────────────────────

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

// Resolve image path — routes external URLs through the image proxy so the
// canvas can draw them without CORS taint issues.
function resolveImagePath(imagePath) {
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return `${SITE_URL}/.netlify/functions/image-proxy?url=${encodeURIComponent(imagePath)}`;
  }
  return `${SITE_URL}/${imagePath}`;
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

function makeProductBadge(draft) {
  if (!draft.productLine) return "";
  const label = draft.productLine.charAt(0).toUpperCase() + draft.productLine.slice(1);
  return `<span class="badge badge-${draft.productLine}">Trex ${label}®</span>`;
}

function makeTypeBadge(draft) {
  if (draft.imageType === "before-after") {
    const role = draft.beforeAfterRole === "before" ? "Before" : "After";
    return `<span class="badge badge-ba">${role}</span>`;
  }
  if (draft.imageType === "lifestyle") return `<span class="badge badge-lifestyle">Lifestyle</span>`;
  return "";
}

function makeCtaBadge(draft) {
  return draft.ctaType === "website"
    ? `<span class="badge badge-website">Website CTA</span>`
    : `<span class="badge badge-phone">Phone CTA</span>`;
}

// ── Card rendering ────────────────────────────────────────────────────────────

function renderCard(draft, isPublished) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.draftId = draft.id;

  const isBa = draft.imageType === "before-after";
  const baBadgeHtml = isBa
    ? `<div class="ba-badge ${draft.beforeAfterRole}">${draft.beforeAfterRole?.toUpperCase() ?? ""}</div>`
    : "";

  // Caption text (strip trailing hashtags for display — shown separately)
  const captionOnly = draft.caption.split("\n\n")[0].trim();
  const hashtagStr = draft.hashtags.join(" ");

  card.innerHTML = `
    <div class="card-canvas-wrap">
      <div class="render-overlay"><div class="spinner"></div> Rendering…</div>
      ${baBadgeHtml}
    </div>
    <div class="card-body">
      <div class="card-meta">
        ${makeProductBadge(draft)}
        ${makeTypeBadge(draft)}
        ${makeCtaBadge(draft)}
        ${draft.colorName ? `<span style="font-size:0.72rem;color:#666">${draft.colorName}</span>` : ""}
      </div>
      <div class="card-caption">${captionOnly}</div>
      <div class="card-hashtags">${hashtagStr}</div>
    </div>
    <button class="select-btn" ${isPublished || hasPublished ? "disabled" : ""}
            data-draft-id="${draft.id}">
      ${isPublished ? "✓ Published" : "Select This Post"}
    </button>
  `;

  // Async canvas rendering
  const wrap = card.querySelector(".card-canvas-wrap");
  const overlay = wrap.querySelector(".render-overlay");

  loadImage(resolveImagePath(draft.imagePath))
    .then((img) => composePost(draft, img))
    .then((canvas) => {
      canvas.style.width  = "100%";
      canvas.style.height = "100%";
      overlay.remove();
      wrap.appendChild(canvas);
      // Cache canvas on draft for later toDataURL
      draft._canvas = canvas;
    })
    .catch(() => {
      overlay.textContent = "⚠ Image unavailable";
      overlay.style.background = "rgba(255,240,240,0.9)";
    });

  // Select button handler
  const btn = card.querySelector(".select-btn");
  btn.addEventListener("click", () => openModal(draft));

  return card;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(draft) {
  pendingDraftId = draft.id;
  pendingCanvas  = draft._canvas ?? null;

  const backdrop = document.getElementById("modal-backdrop");
  const confirmBtn = document.getElementById("modal-confirm");
  const bodyEl = document.getElementById("modal-body");

  bodyEl.textContent = pendingCanvas
    ? "This will post to both Facebook and Instagram. This action cannot be undone."
    : "Warning: The image is still loading. Please wait a moment and try again.";

  confirmBtn.disabled = !pendingCanvas;
  backdrop.classList.add("open");
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.remove("open");
  pendingDraftId = null;
  pendingCanvas  = null;
}

// ── Publishing ────────────────────────────────────────────────────────────────

async function publishPost() {
  if (!pendingDraftId || !pendingCanvas) return;

  const confirmBtn = document.getElementById("modal-confirm");
  confirmBtn.disabled = true;
  confirmBtn.textContent = "Posting…";

  const imageBase64 = pendingCanvas.toDataURL("image/jpeg", 0.92);

  try {
    const res = await fetch("/.netlify/functions/publish-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: pendingDraftId, imageBase64 }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }

    closeModal();
    showToast("Posted to Facebook + Instagram!", false);
    hasPublished = true;

    // Dim all other cards, highlight selected
    document.querySelectorAll(".card").forEach((c) => {
      if (c.dataset.draftId === pendingDraftId) {
        c.classList.add("selected");
      } else {
        c.classList.add("dimmed");
      }
      const btn = c.querySelector(".select-btn");
      if (btn) btn.disabled = true;
    });

    setStatus("success", "✓ Post published to Facebook and Instagram.");

  } catch (err) {
    showToast(`Error: ${err.message}`, true);
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Post to Facebook & Instagram";
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer;
function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `show${isError ? " error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = ""; }, 4500);
}

// ── Status bar ────────────────────────────────────────────────────────────────

function setStatus(type, message) {
  const bar = document.getElementById("status-bar");
  const text = document.getElementById("status-text");
  bar.className = type;
  if (type === "loading") {
    bar.innerHTML = `<div class="spinner"></div><span>${message}</span>`;
  } else {
    bar.textContent = message;
  }
}

// ── Main init ─────────────────────────────────────────────────────────────────

async function loadDrafts(dateStr) {
  setStatus("loading", "Loading post options…");
  document.getElementById("cards-grid").innerHTML = "";
  document.getElementById("empty-state").style.display = "none";
  document.getElementById("published-notice").style.display = "none";
  hasPublished = false;

  document.getElementById("header-date").textContent = formatDateDisplay(dateStr);

  try {
    const res = await fetch(`/.netlify/functions/get-drafts?date=${dateStr}`);
    const data = await res.json();

    if (!res.ok || !data.drafts) {
      setStatus("", "");
      document.getElementById("empty-state").style.display = "block";
      document.getElementById("empty-message").textContent =
        res.status === 404
          ? "No drafts found for this date. Drafts are generated every 3 days at 7 AM."
          : `Error: ${data.error ?? "Unknown error"}`;
      return;
    }

    const { drafts, published } = data;

    if (published) {
      hasPublished = true;
      const notice = document.getElementById("published-notice");
      notice.style.display = "block";
      notice.textContent = `✓ A post was already published on ${dateStr}. All options are shown below for reference.`;
    }

    setStatus("success", `${drafts.length} options ready — pick your favorite and hit Publish.`);

    const grid = document.getElementById("cards-grid");
    for (const draft of drafts) {
      const isPublished = published && published.draftId === draft.id;
      grid.appendChild(renderCard(draft, isPublished));
    }

  } catch (err) {
    setStatus("error", `Failed to load drafts: ${err.message}`);
  }
}

// ── Wiring ────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  const today = todayLocal();
  const dateInput = document.getElementById("date-input");
  dateInput.value = today;

  loadDrafts(today);

  document.getElementById("load-date-btn").addEventListener("click", () => {
    const dateVal = document.getElementById("date-input").value;
    if (dateVal) loadDrafts(dateVal);
  });

  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-confirm").addEventListener("click", publishPost);

  // Close modal on backdrop click
  document.getElementById("modal-backdrop").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-backdrop")) closeModal();
  });

  // Close modal on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
});
