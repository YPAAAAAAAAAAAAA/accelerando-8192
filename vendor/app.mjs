import { VB_W, VB_H, glyphDefs, glyphMarkup } from "./glyphs.mjs";

/*<boot>*/
const BOOT = {"text":"the mint kites lean forward under a quiet sky","ids":[256,505,506,507,508,509,510,511,512],"gloss":["the","mint","kites","lean","forward","under","quiet","sky","moon","river","stone","cedar","orbit","frost","lantern","glass","north","amber","moss","dusk","dawn","tide","fern","coral","birch","storm","cloud","rain","wind","leaf","root","salt","honey","pearl","shadow","light","green","gold","night","garden","bridge","window","silver","paper","star","ink","glyph","atlas","violet","ember","harbor","thistle","copper","willow","canyon","velvet","spark","drift","meadow","comet","quartz","and","of","to","in","is","it","you","that","was","for","on","are","with","as","his","they","at","be","this"]};
/*</boot>*/

const stage = document.getElementById("stage");
const hero = document.getElementById("hero");
const gloss = document.getElementById("gloss");
const atlas = document.getElementById("atlas");
const readout = document.getElementById("readout");
const find = document.getElementById("find");
const note = document.getElementById("note");
const panel = document.getElementById("panel");
const opener = document.getElementById("opener");

let tokens = null;
let trie = null;
let cols = 4;
let rows = 4;
let pageSize = 16;
let cursor = 256;
let matches = null;
let picked = -1;
let shift = false;

function pretty(s, id) {
  let o = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 32) o += "·";
    else if (c === 10) o += "↵";
    else if (c < 32 || c > 126) return "#" + id.toString(16);
    else o += s[i];
  }
  if (!o) return "#" + id.toString(16);
  return o.length > 8 ? o.slice(0, 7) + "…" : o;
}

function label(id) {
  if (tokens) return pretty(tokens[id], id);
  if (id >= 256 && BOOT.gloss[id - 256]) return BOOT.gloss[id - 256];
  if (id >= 32 && id <= 126) return String.fromCharCode(id);
  return id.toString(16);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function xmlEscape(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function unpack(b64) {
  const bin = atob(b64);
  const out = new Array(8192);
  let p = 0;
  for (let id = 0; id < 8192; id++) {
    const n = bin.charCodeAt(p++);
    out[id] = bin.slice(p, p + n);
    p += n;
  }
  return out;
}

function buildTrie(list) {
  const root = { id: -1, n: Object.create(null) };
  for (let id = 0; id < list.length; id++) {
    const s = list[id];
    let node = root;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      let nxt = node.n[c];
      if (!nxt) {
        nxt = { id: -1, n: Object.create(null) };
        node.n[c] = nxt;
      }
      node = nxt;
    }
    node.id = id;
  }
  return root;
}

function encodeText(text, tree) {
  const bytes = new TextEncoder().encode(text);
  const ids = [];
  let i = 0;
  while (i < bytes.length) {
    let node = tree;
    let last = -1;
    let lastI = i;
    let j = i;
    while (j < bytes.length) {
      const nxt = node.n[bytes[j]];
      if (!nxt) break;
      node = nxt;
      j += 1;
      if (node.id >= 0) {
        last = node.id;
        lastI = j;
      }
    }
    if (last < 0) {
      ids.push(bytes[i]);
      i += 1;
    } else {
      ids.push(last);
      i = lastI;
    }
  }
  return ids;
}

function currentIds() {
  const text = readout.value;
  if (trie) return encodeText(text, trie);
  if (text === BOOT.text && BOOT.ids && BOOT.ids.length) return BOOT.ids.slice();
  const bytes = new TextEncoder().encode(text);
  const ids = [];
  const n = Math.min(bytes.length, 48);
  for (let i = 0; i < n; i++) ids.push(bytes[i]);
  return ids;
}

function fitGlyphs(count, w, h) {
  const availW = Math.max(40, w - 8);
  const availH = Math.max(36, h - 4);
  if (count < 1) return { n: 0, gw: 0, gh: 0 };
  let gh = Math.min(118, availH);
  let gw = Math.round((gh * VB_W) / VB_H);
  let c = Math.max(1, Math.floor(availW / (gw + 6)));
  let r = Math.max(1, Math.floor(availH / (gh + 4)));
  let guard = 0;
  while (c * r < count && gh > 56 && guard < 40) {
    gh -= 4;
    gw = Math.round((gh * VB_W) / VB_H);
    c = Math.max(1, Math.floor(availW / (gw + 6)));
    r = Math.max(1, Math.floor(availH / (gh + 4)));
    guard += 1;
  }
  return { n: Math.min(count, c * r), gw, gh };
}

function paintHero() {
  const text = readout.value;
  const ids = currentIds();
  const fit = fitGlyphs(ids.length, hero.clientWidth, hero.clientHeight);
  let html = "";
  for (let i = 0; i < fit.n; i++) {
    html += glyphMarkup(ids[i]).replace(
      "<svg ",
      `<svg style="width:${fit.gw}px;height:${fit.gh}px" `,
    );
  }
  hero.innerHTML = html;
  const clip = text.replace(/\s+/g, " ").trim();
  const shown = clip.length > 64 ? clip.slice(0, 63) + "…" : clip;
  gloss.textContent = (ids.length ? ids.length + " glyphs" : "empty line") + (shown ? "  ·  " + shown : "");
}

function listLength() {
  return matches ? matches.length : 8192;
}

function clampCursor() {
  const limit = Math.max(0, listLength() - pageSize);
  if (cursor > limit) cursor = limit;
  if (cursor < 0) cursor = 0;
}

function layout() {
  const h = atlas.clientHeight || 200;
  const w = atlas.clientWidth || stage.clientWidth || 320;
  cols = w >= 700 ? 6 : 4;
  rows = Math.max(1, Math.floor(h / 68));
  pageSize = Math.max(1, cols * rows);
  atlas.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  atlas.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  clampCursor();
}

function paintAtlas() {
  const n = listLength();
  if (matches && n === 0) {
    atlas.style.gridTemplateColumns = "1fr";
    atlas.style.gridTemplateRows = "1fr";
    atlas.innerHTML = '<p class="none">no token</p>';
    return;
  }
  atlas.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  atlas.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  const frag = document.createDocumentFragment();
  for (let s = 0; s < pageSize; s++) {
    const index = cursor + s;
    if (index >= n) break;
    const id = matches ? matches[index] : index;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cell" + (id === picked ? " pick" : "");
    b.dataset.id = String(id);
    b.setAttribute("aria-label", "glyph " + id + " " + label(id));
    b.innerHTML = glyphMarkup(id) + `<span class="glosslet">${escapeHtml(label(id))}</span>`;
    frag.appendChild(b);
  }
  atlas.replaceChildren(frag);
}

function paint() {
  paintHero();
  paintAtlas();
}

function printable(s) {
  if (!s) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (!(c === 10 || c === 9 || (c >= 32 && c <= 126))) return false;
  }
  return true;
}

function insert(str) {
  const a = readout.selectionStart ?? readout.value.length;
  const b = readout.selectionEnd ?? readout.value.length;
  const next = readout.value.slice(0, a) + str + readout.value.slice(b);
  readout.value = next.slice(0, 240);
  const p = Math.min(a + str.length, readout.value.length);
  try { readout.setSelectionRange(p, p); } catch (e) { /* hidden field */ }
  paintHero();
}

function backspace() {
  const a = readout.selectionStart ?? readout.value.length;
  const b = readout.selectionEnd ?? readout.value.length;
  if (a !== b) {
    readout.value = readout.value.slice(0, a) + readout.value.slice(b);
    try { readout.setSelectionRange(a, a); } catch (e) { /* hidden */ }
  } else if (a > 0) {
    readout.value = readout.value.slice(0, a - 1) + readout.value.slice(a);
    try { readout.setSelectionRange(a - 1, a - 1); } catch (e) { /* hidden */ }
  }
  paintHero();
}

function take(id) {
  picked = id;
  const prev = atlas.querySelector(".pick");
  if (prev) prev.classList.remove("pick");
  const el = atlas.querySelector(`[data-id="${id}"]`);
  if (el) el.classList.add("pick");
  if (!tokens) {
    note.textContent = "alphabet loading";
    return;
  }
  let raw = tokens[id];
  if (!printable(raw)) {
    note.textContent = "token #" + id;
    return;
  }
  const cur = readout.value;
  const at = readout.selectionStart ?? cur.length;
  const before = at > 0 ? cur.charAt(at - 1) : "";
  if (/^[A-Za-z0-9]/.test(raw) && before && !/\s/.test(before)) raw = " " + raw;
  insert(raw);
  note.textContent = pretty(raw, id);
}

function turn(dir) {
  const limit = Math.max(0, listLength() - pageSize);
  const next = Math.min(limit, Math.max(0, cursor + dir * pageSize));
  if (next === cursor) return;
  cursor = next;
  paintAtlas();
}

function lineSvg(ids, text) {
  const scale = 1.6;
  const gap = 14;
  const gw = Math.round(VB_W * scale);
  const gh = Math.round(VB_H * scale);
  const across = Math.min(6, Math.max(1, ids.length));
  const down = Math.ceil(ids.length / across);
  const W = across * gw + (across + 1) * gap;
  const H = down * gh + (down + 1) * gap + 28;
  let body = "";
  for (let i = 0; i < ids.length; i++) {
    const c = i % across;
    const r = Math.floor(i / across);
    const x = gap + c * (gw + gap);
    const y = gap + r * (gh + gap);
    const g = glyphDefs(ids[i]);
    body +=
      `<g transform="translate(${x} ${y}) scale(${scale})">` +
      `<path d="${g.stem}" fill="none" stroke="#1c6b4c" stroke-width="3.2" stroke-linecap="square"/>` +
      `<path d="${g.body}" fill="none" stroke="#063226" stroke-width="5" stroke-linejoin="miter" stroke-miterlimit="2.2" stroke-linecap="square"/>` +
      `<path d="${g.body}" fill="none" stroke="#c9ffe6" stroke-width="2.25" stroke-linejoin="miter" stroke-miterlimit="2.2" stroke-linecap="square"/>` +
      `<path d="${g.crown}" fill="none" stroke="#3d3820" stroke-width="4.4" stroke-linejoin="miter" stroke-linecap="square"/>` +
      `<path d="${g.crown}" fill="none" stroke="#f4e3a8" stroke-width="2.2" stroke-linejoin="miter" stroke-linecap="square"/>` +
      `</g>`;
  }
  const safe = xmlEscape(text).slice(0, 90);
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="100%" height="100%" fill="#071510"/>` +
    `<desc>${safe}</desc>` +
    body +
    `<text x="${gap}" y="${H - 10}" fill="#7fad98" font-family="sans-serif" font-size="14">${safe}</text>` +
    `</svg>`
  );
}

async function copyGlyphs() {
  const ids = currentIds();
  if (!ids.length) {
    note.textContent = "nothing to copy";
    return;
  }
  const svg = lineSvg(ids, readout.value);
  let ok = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(svg);
      ok = true;
    }
  } catch (e) { ok = false; }
  if (!ok) {
    const ta = document.createElement("textarea");
    ta.value = svg;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "0";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
  }
  note.textContent = ok ? "copied glyphs" : "copy failed";
}

function saveGlyphs() {
  const ids = currentIds();
  if (!ids.length) {
    note.textContent = "nothing to save";
    return;
  }
  const svg = lineSvg(ids, readout.value);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "accelerando-8192.svg";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  note.textContent = "saved on this device";
}

function applyFilter() {
  const q = find.value.trim().toLowerCase();
  if (!q) {
    matches = null;
    cursor = 256;
  } else if (!tokens) {
    matches = [];
    cursor = 0;
  } else {
    const found = [];
    for (let i = 0; i < 8192; i++) {
      const lab = pretty(tokens[i], i).toLowerCase();
      if (lab.includes(q) || String(i) === q) found.push(i);
    }
    matches = found;
    cursor = 0;
  }
  clampCursor();
  paintAtlas();
}

function loadAlphabet() {
  const url = new URL("alphabet.json", import.meta.url);
  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error("load");
      return r.json();
    })
    .then((data) => {
      tokens = unpack(data.pack);
      if (!tokens || tokens.length !== 8192) throw new Error("alphabet");
      trie = buildTrie(tokens);
      paintHero();
      if (find.value.trim()) applyFilter();
      else paintAtlas();
    })
    .catch(() => {
      note.textContent = "encoder list missing";
    });
}

function armReady() {
  let frames = 0;
  const step = () => {
    frames += 1;
    const drawn = hero.querySelector("svg");
    const box = drawn && drawn.getBoundingClientRect();
    const painted = !!(box && box.width > 2 && box.height > 2);
    if (frames >= 2 && painted && window.__gbSandbox && window.__gbSandbox.ready) {
      if (!armReady.sent) {
        armReady.sent = true;
        window.__gbSandbox.ready();
      }
      return;
    }
    if (!window.__gbSandbox && painted && frames > 8) return;
    if (frames < 180) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function swallow(el) {
  const names = ["pointerdown", "pointerup", "pointermove", "click", "touchstart", "touchend", "touchmove", "wheel"];
  for (let i = 0; i < names.length; i++) {
    el.addEventListener(names[i], (e) => e.stopPropagation());
  }
}

function wire() {
  swallow(panel);
  swallow(opener);
  opener.addEventListener("click", () => {
    const on = document.documentElement.classList.toggle("gb-ui-open");
    opener.setAttribute("aria-expanded", on ? "true" : "false");
    opener.setAttribute("aria-label", on ? "Hide encoder" : "Show encoder");
  });
  readout.addEventListener("input", () => paintHero());
  find.addEventListener("input", () => applyFilter());
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const k = b.getAttribute("data-k");
    if (!k) return;
    if (k === "bksp") backspace();
    else if (k === "shift") {
      shift = !shift;
      b.classList.toggle("on", shift);
    } else if (k === "space") insert(" ");
    else if (k === "copy") copyGlyphs();
    else if (k === "save") saveGlyphs();
    else if (k === "clear") {
      readout.value = "";
      picked = -1;
      paintHero();
      note.textContent = "cleared";
    } else insert(shift ? k.toUpperCase() : k);
  });
  let drag = null;
  atlas.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    drag = {
      id: e.pointerId,
      y: e.clientY,
      x: e.clientX,
      moved: false,
      cell: e.target.closest ? e.target.closest(".cell") : null,
    };
  });
  atlas.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (dx * dx + dy * dy > 196) drag.moved = true;
  });
  atlas.addEventListener("pointerup", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y;
    if (drag.moved) {
      if (dy < -28) turn(1);
      else if (dy > 28) turn(-1);
    } else if (drag.cell) {
      take(Number(drag.cell.dataset.id));
    }
    drag = null;
  });
  atlas.addEventListener("pointercancel", () => { drag = null; });
  window.addEventListener("resize", () => {
    layout();
    paint();
  });
}

function boot() {
  const step = () => {
    if (!stage || stage.clientWidth < 20) {
      requestAnimationFrame(step);
      return;
    }
    readout.value = BOOT.text;
    layout();
    paint();
    armReady();
    loadAlphabet();
  };
  wire();
  step();
}

boot();
