"use strict";

// ---------- Config (persisted in localStorage) ----------
const STORAGE_KEYS = {
  base: "downloader.apiBase",
  key: "downloader.apiKey",
};

function getBase() {
  return (localStorage.getItem(STORAGE_KEYS.base) || "").replace(/\/+$/, "");
}
function getKey() {
  return localStorage.getItem(STORAGE_KEYS.key) || "";
}
function setConfig(base, key) {
  if (base) localStorage.setItem(STORAGE_KEYS.base, base.trim().replace(/\/+$/, ""));
  else localStorage.removeItem(STORAGE_KEYS.base);
  if (key) localStorage.setItem(STORAGE_KEYS.key, key.trim());
  else localStorage.removeItem(STORAGE_KEYS.key);
}

function apiUrl(path) {
  const base = getBase();
  if (!base) return path;
  return base + path;
}

async function apiFetch(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const key = getKey();
  if (key) headers.set("x-api-key", key);
  const res = await fetch(apiUrl(path), { ...init, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error?.message || res.statusText || "Request gagal");
    err.code = data?.error?.code;
    err.status = res.status;
    err.details = data?.error?.details;
    throw err;
  }
  return data;
}

// ---------- DOM helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function showToast(message, ms = 2500) {
  const inner = $("#toast-inner");
  inner.textContent = message;
  inner.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => inner.classList.remove("show"), ms);
}

function setError(msg) {
  const el = $("#error");
  if (!msg) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = msg;
  el.classList.remove("hidden");
}

function setLoading(on, text = "Memproses...") {
  const btn = $("#submit-btn");
  $("#submit-label").classList.toggle("hidden", on);
  $("#submit-loading").classList.toggle("hidden", !on);
  $("#submit-loading").classList.toggle("inline-flex", on);
  $("#loading-text").textContent = text;
  btn.disabled = !!on;
}

function fmtBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function fmtDuration(s) {
  if (!Number.isFinite(s) || s <= 0) return "";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

// ---------- Settings dialog ----------
function openSettings() {
  $("#api-base").value = getBase();
  $("#api-key").value = getKey();
  $("#health-status").classList.add("hidden");
  $("#settings-dialog").classList.remove("hidden");
  $("#settings-dialog").classList.add("flex");
}
function closeSettings() {
  $("#settings-dialog").classList.add("hidden");
  $("#settings-dialog").classList.remove("flex");
}

$("#settings-btn").addEventListener("click", openSettings);
$("#settings-close").addEventListener("click", closeSettings);
$("#settings-dialog").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeSettings();
});
$("#settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  setConfig($("#api-base").value, $("#api-key").value);
  closeSettings();
  showToast("Pengaturan tersimpan");
});

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
}

function renderBinaryRow(parent, label, probe) {
  const row = el("div");
  row.append(el("span", "text-slate-500", `${label}: `));
  if (probe.ok) {
    const v = String(probe.version || "ok").slice(0, 40);
    row.append(el("span", "text-slate-200", v));
  } else {
    row.append(el("span", "text-red-300", probe.error || "tidak ditemukan"));
  }
  parent.append(row);
}

$("#health-btn").addEventListener("click", async () => {
  const status = $("#health-status");
  status.classList.remove("hidden");
  status.replaceChildren(document.createTextNode("Memeriksa..."));
  try {
    // Temporarily apply form values so we can probe before saving.
    const prevBase = localStorage.getItem(STORAGE_KEYS.base);
    const prevKey = localStorage.getItem(STORAGE_KEYS.key);
    setConfig($("#api-base").value, $("#api-key").value);
    let result;
    try {
      result = await apiFetch("/health/deps");
    } finally {
      // Restore — user must explicitly Save to persist.
      if (prevBase === null) localStorage.removeItem(STORAGE_KEYS.base);
      else localStorage.setItem(STORAGE_KEYS.base, prevBase);
      if (prevKey === null) localStorage.removeItem(STORAGE_KEYS.key);
      else localStorage.setItem(STORAGE_KEYS.key, prevKey);
    }
    const ok = !!result.ok;
    const yt = result.ytdlp || {};
    const ff = result.ffmpeg || {};

    // Build the status block via DOM APIs to avoid HTML injection from
    // a remote (potentially compromised) API server's response.
    const root = document.createDocumentFragment();
    const header = el("div", `flex items-center gap-2 ${ok ? "text-emerald-300" : "text-amber-300"}`);
    header.append(el("span", `h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`));
    header.append(el("span", "font-medium", ok ? "Server siap" : "Server menjawab tapi ada masalah"));
    root.append(header);
    const grid = el("div", "mt-2 grid grid-cols-2 gap-2 text-slate-300");
    renderBinaryRow(grid, "yt-dlp", yt);
    renderBinaryRow(grid, "ffmpeg", ff);
    root.append(grid);
    status.replaceChildren(root);
  } catch (err) {
    status.replaceChildren(el("span", "text-red-300", `Gagal: ${err?.message || err}`));
  }
});

// ---------- Segmented control wiring ----------
$$('input[name="type"]').forEach((input) => {
  input.addEventListener("change", () => {
    // Visual update is handled by CSS :has() selector. No JS needed.
  });
});

// ---------- Paste button ----------
$("#paste-btn").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      $("#url").value = text.trim();
      $("#url").focus();
    }
  } catch {
    showToast("Browser memblokir akses clipboard. Tempel manual dengan Ctrl+V.");
  }
});

// ---------- Form submit ----------
$("#dl-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("");
  $("#result").classList.add("hidden");

  const url = $("#url").value.trim();
  const type = $$('input[name="type"]:checked')[0]?.value || "video";
  if (!url) {
    setError("URL tidak boleh kosong.");
    return;
  }

  setLoading(true, "Mengambil metadata...");
  let info = null;
  try {
    info = await apiFetch(`/api/info?url=${encodeURIComponent(url)}`);
  } catch (err) {
    // Non-fatal — we can still try to download even if info fails.
    console.warn("info failed", err);
  }

  setLoading(true, type === "audio" ? "Mengekstrak audio..." : "Mengunduh & merge video...");
  try {
    const result = await apiFetch("/api/download", {
      method: "POST",
      body: JSON.stringify({ url, type }),
    });
    renderResult({ info, result, type });
  } catch (err) {
    setError(prettyError(err));
  } finally {
    setLoading(false);
  }
});

function prettyError(err) {
  const code = err.code || "";
  const msg = err.message || "Terjadi kesalahan.";
  if (code === "ffmpeg_missing") {
    return `${msg} (Tip: install ffmpeg di server, atau set FFMPEG_PATH ke absolute path di .env.)`;
  }
  if (code === "validation_error") return `Input tidak valid: ${msg}`;
  if (code === "unsupported_url") return `URL tidak didukung: ${msg}`;
  if (code === "unauthorized") return `API key salah/kosong. Set di Pengaturan.`;
  if (err.status === 429) return `Terlalu banyak permintaan. Coba lagi sebentar.`;
  return msg;
}

function renderResult({ info, result, type }) {
  const card = $("#result");
  const thumb = $("#r-thumb");
  if (info?.thumbnail) {
    thumb.src = info.thumbnail;
    thumb.classList.remove("hidden");
  } else {
    thumb.removeAttribute("src");
    thumb.classList.add("hidden");
  }
  $("#r-title").textContent = info?.title || result.filename;
  const metaParts = [];
  if (info?.uploader) metaParts.push(info.uploader);
  if (Number.isFinite(info?.duration)) metaParts.push(fmtDuration(info.duration));
  metaParts.push(type === "audio" ? "MP3" : "MP4");
  if (Number.isFinite(result.size) && result.size > 0) metaParts.push(fmtBytes(result.size));
  $("#r-meta").textContent = metaParts.join(" · ");
  if (result.expiresAt) {
    const d = new Date(result.expiresAt);
    if (!Number.isNaN(d.getTime())) {
      $("#r-expires").textContent = `Link aktif sampai ${d.toLocaleString()}`;
    }
  }
  $("#r-download").href = result.downloadUrl;
  $("#r-download").setAttribute("download", result.filename || "");
  $("#r-copy").onclick = () => {
    navigator.clipboard.writeText(result.downloadUrl).then(
      () => showToast("Link disalin"),
      () => showToast("Gagal menyalin"),
    );
  };
  card.classList.remove("hidden");
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Close settings on Esc
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSettings();
});
