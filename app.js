/* Manna — daily readings, Catholic Bible, Rosary. No external dependencies. */
(() => {
'use strict';

/* ---------- small helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('manna.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('manna.' + k, JSON.stringify(v)); } catch {} }
};
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
function manilaDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function prettyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 4)).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
function manilaWeekday() {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short' }).format(new Date());
}

/* ---------- settings ---------- */
const settings = {
  theme: store.get('theme', 'modern'),
  trans: store.get('trans', 'cpdv'),
  size: store.get('size', 19)
};
const TRANS = { cpdv: 'CPDV', drc: 'Douay-Rheims' };
const THEME_BG = { modern: '#FBFAF7', classic: '#F5EEDC', dark: '#121110' };
function applySettings() {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.style.setProperty('--read-size', settings.size + 'px');
  const m = $('meta[name="theme-color"]'); if (m) m.content = THEME_BG[settings.theme];
}
function saveSetting(k, v) { settings[k] = v; store.set(k, v); applySettings(); }
applySettings();

/* ---------- Bible data ---------- */
let BOOKS = null;              // [{n, c}]
const bookCache = new Map();   // key "trans/idx" -> chapters (max 3 kept: keeps memory flat)
async function loadMeta() {
  if (BOOKS) return BOOKS;
  const r = await fetch('data/books.json'); BOOKS = await r.json(); return BOOKS;
}
async function loadBook(idx, trans = settings.trans) {
  const key = trans + '/' + idx;
  if (bookCache.has(key)) { const v = bookCache.get(key); bookCache.delete(key); bookCache.set(key, v); return v; }
  const r = await fetch(`data/${trans}/${idx}.json`);
  if (!r.ok) throw new Error('Book not available offline yet');
  const v = await r.json();
  bookCache.set(key, v);
  while (bookCache.size > 3) bookCache.delete(bookCache.keys().next().value);
  return v;
}
const bookIndex = name => BOOKS.findIndex(b => b.n === name);

/* Psalms: the lectionary uses Hebrew numbering; CPDV & Douay-Rheims use Greek/Vulgate numbering. */
function psalmToVulgate(h, v) {
  if (h <= 8 || h >= 148) return [h, v];
  if (h === 9) return [9, v];
  if (h === 10) return [9, v + 21];
  if (h <= 113) return [h - 1, v];
  if (h === 114) return [113, v];
  if (h === 115) return [113, v + 8];
  if (h === 116) return v <= 9 ? [114, v] : [115, v - 9];
  if (h <= 146) return [h - 1, v];
  if (h === 147) return v <= 11 ? [146, v] : [147, v - 11];
  return [h, v];
}
function psalmLabel(vc) { // Vulgate chapter -> "22 (23)"
  const map = { 9: '9–10', 113: '114–115', 114: '116:1–9', 115: '116:10–19', 146: '147:1–11', 147: '147:12–20' };
  if (vc <= 8 || vc >= 148) return String(vc);
  return `${vc} (${map[vc] || vc + 1})`;
}

/* Verse-number map: Mass-reading numbering -> numbering of these two Bibles.
   Runs of [fromChapter, fromVerse, toChapter, toVerse, count]; anything not listed is the same in both. */
let VMAP = null;
async function loadVmap() {
  if (VMAP) return VMAP;
  try { VMAP = await (await fetch('data/vmap.json')).json(); } catch { VMAP = {}; }
  return VMAP;
}
function lectToBible(book, c, v) {
  const runs = VMAP && VMAP[book];
  if (runs) for (const r of runs) if (r[0] === c && v >= r[1] && v < r[1] + r[4]) return [r[2], r[3] + (v - r[1])];
  if (book === 'Psalms' && !runs) return psalmToVulgate(c, v);
  return [c, v];
}

/* Resolve one part {b,c,v,ec,ev} into [{c, v, text}].
   bibleNumbers=true: part already uses this Bible's numbering (stored year data).
   bibleNumbers=false: part uses Mass-reading numbering (daily online data) and is mapped verse by verse. */
async function versesFor(part, bibleNumbers = false, trans = settings.trans) {
  await loadMeta();
  const idx = bookIndex(part.b); if (idx < 0) return [];
  const book = await loadBook(idx, trans);
  if (!bibleNumbers) await loadVmap();
  const out = [], seen = new Set();
  const ec = part.ec || part.c, ev = part.ev || part.v;
  for (let c = part.c; c <= ec; c++) {
    const vStart = c === part.c ? part.v : 1;
    const vEnd = c === ec ? ev : 999;
    for (let v = vStart; v <= vEnd; v++) {
      const [cc, vv] = bibleNumbers ? [c, v] : lectToBible(part.b, c, v);
      const t = book[cc - 1] && book[cc - 1][vv - 1];
      if (t === undefined) break;
      if (seen.has(cc + ':' + vv)) continue;   // two reading-verses can fall in one Bible verse
      seen.add(cc + ':' + vv);
      out.push({ c: cc, v: vv, text: t });
    }
  }
  return out;
}
function versesHTML(vs) {
  let html = '<div class="scripture"><p>', lastC = null;
  for (const x of vs) {
    if (lastC !== null && x.c !== lastC) html += '</p><p>';
    html += `<span class="vn">${x.c !== lastC && lastC !== null ? x.c + ':' : ''}${x.v}</span>${esc(x.text)} `;
    lastC = x.c;
  }
  return html + '</p></div>';
}

/* Reference parsing for search: "John 3:16", "1 cor 13:4-7", "ps 23" */
const ALIASES = { jn: 'John', jhn: 'John', mt: 'Matthew', mk: 'Mark', mr: 'Mark', lk: 'Luke', ps: 'Psalms', psa: 'Psalms', psalm: 'Psalms',
  gn: 'Genesis', ex: 'Exodus', lv: 'Leviticus', nm: 'Numbers', dt: 'Deuteronomy', jos: 'Joshua', jgs: 'Judges', jg: 'Judges',
  sir: 'Sirach', ecclesiasticus: 'Sirach', wis: 'Wisdom', qoheleth: 'Ecclesiastes', eccl: 'Ecclesiastes', ecc: 'Ecclesiastes',
  sg: 'Song of Songs', song: 'Song of Songs', canticles: 'Song of Songs', rv: 'Revelation', rev: 'Revelation', apocalypse: 'Revelation', apoc: 'Revelation',
  phil: 'Philippians', phlm: 'Philemon', phm: 'Philemon', jas: 'James', jdt: 'Judith', tb: 'Tobit', tob: 'Tobit', is: 'Isaiah', jer: 'Jeremiah',
  ez: 'Ezekiel', ezk: 'Ezekiel', dn: 'Daniel', hos: 'Hosea', jl: 'Joel', am: 'Amos', ob: 'Obadiah', jon: 'Jonah', mi: 'Micah', na: 'Nahum',
  hb: 'Habakkuk', zep: 'Zephaniah', hg: 'Haggai', zec: 'Zechariah', mal: 'Malachi', bar: 'Baruch', lam: 'Lamentations', prv: 'Proverbs', prov: 'Proverbs',
  jb: 'Job', est: 'Esther', neh: 'Nehemiah', ezr: 'Ezra', ru: 'Ruth', acts: 'Acts', rom: 'Romans', gal: 'Galatians', eph: 'Ephesians', col: 'Colossians', heb: 'Hebrews', ti: 'Titus', jud: 'Jude' };
function findBook(raw) {
  let s = raw.toLowerCase().replace(/\./g, '').replace(/^(i{1,3})\s+/, m => ({ 'i ': '1', 'ii ': '2', 'iii ': '3' }[m] || m)).replace(/\s+/g, '');
  const num = (s.match(/^[123]/) || [''])[0]; const rest = s.slice(num.length);
  if (!rest) return -1;
  if (ALIASES[rest] && !num) return bookIndex(ALIASES[rest]);
  const cands = BOOKS.map((b, i) => ({ i, k: b.n.toLowerCase().replace(/\s+/g, '') }))
    .filter(x => num ? x.k.startsWith(num) && x.k.slice(1).startsWith(rest) : !/^[123]/.test(x.k) && x.k.startsWith(rest));
  if (num) { // "1 cor", "2 kgs"
    const al = { cor: 'corinthians', kgs: 'kings', sm: 'samuel', sam: 'samuel', chr: 'chronicles', thes: 'thessalonians', thess: 'thessalonians', tm: 'timothy', tim: 'timothy', pt: 'peter', pet: 'peter', jn: 'john', mc: 'maccabees', mac: 'maccabees', macc: 'maccabees' }[rest];
    if (al) { const i = BOOKS.findIndex(b => b.n.toLowerCase().replace(/\s+/g, '') === num + al); if (i >= 0) return i; }
  }
  cands.sort((a, b) => a.k.length - b.k.length);
  return cands.length ? cands[0].i : -1;
}
function parseRef(q) {
  const m = q.trim().match(/^((?:[123]|i{1,3})?\s*[a-z.\s]+?)\s*(\d+)(?:\s*[:.,]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?$/i);
  if (!m) return null;
  const bi = findBook(m[1]); if (bi < 0) return null;
  let c = +m[2], v = m[3] ? +m[3] : null;
  const [vc, vv] = lectToBible(BOOKS[bi].n, c, v || 1);
  if (vc < 1 || vc > BOOKS[bi].c) return null;
  return { b: bi, c: vc, v: v ? vv : null, label: `${BOOKS[bi].n} ${c}${v ? ':' + v + (m[4] ? '–' + m[4] : '') : ''}` };
}

/* ---------- views ---------- */
const view = $('#view');
let current = 'today';
let wakeLock = null;

document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
$('#settingsBtn').addEventListener('click', openSettings);
window.addEventListener('scroll', () => $('#top').classList.toggle('scrolled', scrollY > 4), { passive: true });

function go(tab, opts, keepSheets) {
  current = tab;
  const tabFor = { search: 'bible' }[tab] || tab;
  document.querySelectorAll('nav.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tabFor));
  if (tab !== 'bible') { selection.clear(); hideSelBar(); }
  if (!keepSheets) document.querySelectorAll('.sheet').forEach(x => x.remove());
  view.innerHTML = '';
  scrollTo(0, 0);
  ({ today: renderToday, bible: renderBible, search: renderSearch, armory: renderArmory, saved: renderSaved })[tab](opts || {});
}

/* ===== TODAY ===== */
/* Readings for a whole Church year are stored in the app (works offline).
   When online, the morning's file (days/DATE.json) adds the reflection, saint and summaries, and
   double-checks the readings against the Philippine calendar; if present it takes priority. */
let YEAR = null, dayData = null;
async function loadYear() {
  if (YEAR) return YEAR;
  try { YEAR = await (await fetch('data/year.json')).json(); } catch { YEAR = { days: {} }; }
  return YEAR;
}
async function getDay(date, onBase) {
  const y = await loadYear();
  const base = y.days[date] ? JSON.parse(JSON.stringify(y.days[date])) : null;
  if (base) {
    base.readings.forEach(r => r.bible = true);
    (base.masses || []).forEach(m => m.readings.forEach(r => r.bible = true));
  }
  if (onBase) onBase(base);   // the readings stored on the phone can be shown right away
  let online = null;
  try {
    // Slow Wi-Fi shouldn't hold the page hostage: give up after 8 seconds and use the stored readings.
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`days/${date}.json`, { cache: 'no-cache', signal: ctl.signal }).finally(() => clearTimeout(timer));
    if (r.ok) { const j = await r.json(); if (j && j.date === date) online = j; }
  } catch {}
  if (!online) return base;
  const merged = Object.assign({}, base || {}, online);
  if (online.readings && online.readings.length) {
    merged.readings = online.readings.map(r => Object.assign({}, r, { bible: false }));
    if (!online.masses) delete merged.masses;
    delete merged.verify; delete merged.note;
  }
  merged.online = true;
  return merged;
}
const COLOR_HEX = { green: '#2F7D4A', white: '#F4F1E8', red: '#B3261E', violet: '#6B3FA0', purple: '#6B3FA0', rose: '#E58FB0', gold: '#C9A227', black: '#222' };
function readingCard(r, key) {
  return `<div class="card reading">
      <h3>${esc(r.label)}</h3><div class="ref">${esc(r.ref)}</div>
      ${r.response ? `<div class="response">R. ${esc(r.response)}</div>` : ''}
      ${r.summary ? `<p class="sum" style="margin-top:8px">${esc(r.summary)}</p>` : ''}
      ${r.approx ? `<p class="muted small" style="margin:8px 0 0">This Bible numbers ${esc(r.parts[0].b)} differently, so the passage may run a verse or two longer or shorter than the lector's.</p>` : ''}
      <div class="full" id="full${key}"></div>
      <button class="btn ghost block" style="margin-top:12px" data-read="${key}">Read full text</button>
    </div>`;
}
/* Today's page is kept on the phone for the rest of the day (only ONE day is ever kept — tomorrow replaces it),
   so reopening is instant. A quiet check in the background picks up anything newer. */
function todayCached(date) { const c = store.get('todayCache', null); return c && c.date === date ? c.data : null; }
let todayRun = 0;
async function renderToday() {
  $('#title').textContent = 'Today';
  const today = manilaDate(), run = ++todayRun;
  const cached = todayCached(today);
  let shown = null;
  if (cached) { shown = dayData = cached; drawToday(today); }
  else view.innerHTML = '<div class="spinner" aria-label="Loading"></div>';
  // First visit of the day: show the stored readings at once while the reflection & saint load.
  const fresh = await getDay(today, base => { if (!shown && base && run === todayRun) { shown = dayData = base; drawToday(today); } });
  if (run !== todayRun) return;
  if (fresh) {
    if (fresh.online || !cached) store.set('todayCache', { date: today, data: fresh });
    const changed = !shown || JSON.stringify(fresh) !== JSON.stringify(shown);
    // Redraw only if something changed and the person isn't in the middle of reading a passage.
    if (changed && !(fresh === shown) && !(shown && !fresh.online)) {
      dayData = fresh;
      if (current === 'today' && !(shown && view.querySelector('.full:not(:empty)'))) drawToday(today);
    }
  } else if (!shown) { dayData = null; if (current === 'today') drawToday(today); }
}
async function drawToday(today) {
  if (current !== 'today') return;
  if (!dayData) {
    const y = await loadYear();
    const ended = y.to && today > y.to;
    view.innerHTML = `<div class="card"><div class="eyebrow">${esc(prettyDate(today))}</div>
      <p>${ended ? "Manna's stored readings ended on " + esc(prettyDate(y.to)) + '. Ask Claude to add the next Church year.' : "Today's readings couldn't be found. Connect to the internet and try again."}</p>
      <p class="muted small">The Bible and Rosary still work as usual.</p></div>`;
    return;
  }
  const d = dayData;
  const colorHex = COLOR_HEX[(d.color || '').toLowerCase()] || '#999';
  let html = `<div class="card">
    <div class="eyebrow">${esc(prettyDate(d.date))}</div>
    <div class="daytitle">${esc(d.day)}</div>
    ${d.color ? `<span class="chip"><span class="dot" style="background:${colorHex}"></span>${esc(d.color[0].toUpperCase() + d.color.slice(1))}</span>` : ''}
    ${d.memorial ? `<div class="muted small" style="margin-top:8px">${esc(d.memorial)}</div>` : ''}
    ${d.note ? `<div class="note" style="margin-bottom:0">${esc(d.note)}</div>` : ''}
    <div style="margin-top:14px"><button class="btn primary block" id="massBtn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/></svg>
      Read all readings (Mass mode)</button></div>
  </div>`;
  const groups = d.masses ? d.masses : [{ title: null, readings: d.readings }];
  const all = [];
  groups.forEach((g, gi) => {
    if (g.title) html += `<h2 class="eyebrow" style="margin:22px 4px 0;font-size:13px">${esc(g.title)}</h2>`;
    g.readings.forEach((r, ri) => { const key = gi + '_' + ri; all[key] = r; html += readingCard(r, key); });
  });
  if (d.reflection) html += `<div class="card"><h3 class="eyebrow" style="margin:0">Reflection</h3>
    <p class="reflection">${esc(d.reflection)}</p>${d.prayer ? `<p class="prayer">${esc(d.prayer)}</p>` : ''}</div>`;
  if (d.saint) html += `<div class="card"><div class="eyebrow">Saint of the day</div>
    <div class="daytitle" style="font-size:18px">${esc(d.saint.name)}</div><p style="margin:4px 0 0">${esc(d.saint.story)}</p></div>`;
  if (!d.online) html += `<p class="muted small" style="text-align:center">The reflection and saint of the day appear when you're online.</p>`;
  html += `<p class="muted small" style="text-align:center">Scripture: ${esc(TRANS[settings.trans])} · Calendar: Philippines</p>`;
  view.innerHTML = html;
  $('#massBtn').addEventListener('click', openMass);
  view.querySelectorAll('[data-read]').forEach(b => b.addEventListener('click', async () => {
    const k = b.dataset.read, r = all[k], box = $('#full' + k);
    if (box.innerHTML) { box.innerHTML = ''; b.textContent = 'Read full text'; return; }
    box.innerHTML = '<div class="spinner"></div>';
    try {
      const vs = (await Promise.all(r.parts.map(p => versesFor(p, r.bible)))).flat();
      box.innerHTML = '<div style="margin-top:12px">' + versesHTML(vs) + '</div>';
      b.textContent = 'Hide full text';
    } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
  }));
}

async function openMass() {
  if (!dayData) return;
  const ov = document.createElement('div'); ov.className = 'massview';
  ov.innerHTML = `<div class="bar"><button class="iconbtn" id="mClose" aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    <div class="title">${esc(dayData.day)}</div>
    <button class="iconbtn" id="mSmaller" aria-label="Smaller text">A−</button><button class="iconbtn" id="mBigger" aria-label="Bigger text">A+</button></div>
    <div id="mBody"><div class="spinner"></div></div>`;
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
  const close = () => { ov.remove(); document.body.style.overflow = ''; releaseWake(); history.state && history.state.mass && history.back(); };
  $('#mClose', ov).addEventListener('click', close);
  $('#mBigger', ov).addEventListener('click', () => saveSetting('size', Math.min(30, settings.size + 1)));
  $('#mSmaller', ov).addEventListener('click', () => saveSetting('size', Math.max(14, settings.size - 1)));
  history.pushState({ mass: true }, '');
  const onPop = () => { window.removeEventListener('popstate', onPop); if (ov.isConnected) { ov.remove(); document.body.style.overflow = ''; releaseWake(); } };
  window.addEventListener('popstate', onPop);
  requestWake();
  let html = '';
  const groups = dayData.masses ? dayData.masses : [{ title: null, readings: dayData.readings }];
  for (const g of groups) {
    if (g.title) html += `<section><h2 style="font-size:17px;color:var(--ink)">${esc(g.title)}</h2></section>`;
    for (const r of g.readings) {
      let vs = [];
      try { vs = (await Promise.all(r.parts.map(p => versesFor(p, r.bible)))).flat(); } catch {}
      html += `<section><h2>${esc(r.label)}</h2><div class="ref">${esc(r.ref)}</div>
        ${r.response ? `<div class="response" style="margin-bottom:12px">R. ${esc(r.response)}</div>` : ''}
        ${vs.length ? versesHTML(vs) : '<p class="muted">Text not available offline yet.</p>'}</section>`;
    }
  }
  html += `<p class="muted small" style="text-align:center">${esc(TRANS[settings.trans])}. Wording, and sometimes verse numbers, differ slightly from the lector's.</p>`;
  const body = $('#mBody', ov); if (body) body.innerHTML = html;
}
async function requestWake() { try { wakeLock = await navigator.wakeLock.request('screen'); } catch {} }
function releaseWake() { try { wakeLock && wakeLock.release(); } catch {} wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && $('.massview')) requestWake(); });

/* ===== BIBLE ===== */
let pos = store.get('pos', { b: 49, c: 1 }); // John 1
async function renderBible(opts) {
  await loadMeta();
  if (opts.b !== undefined) pos = { b: opts.b, c: opts.c };
  store.set('pos', pos);
  const B = BOOKS[pos.b];
  const chLabel = B.n === 'Psalms' ? 'Psalm ' + psalmLabel(pos.c) : `${B.n} ${pos.c}`;
  $('#title').textContent = 'Bible';
  selection.clear(); hideSelBar();
  view.innerHTML = `<div class="pickrow">
      <button class="btn ghost" id="pickBook">${esc(B.n)} <span class="muted">▾</span></button>
      <button class="btn ghost" id="pickChap" style="flex:0 0 84px">${pos.c} <span class="muted">▾</span></button>
      <button class="btn ghost" id="openSearch" style="flex:0 0 52px;padding:0" aria-label="Search the Bible">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button>
    </div>
    <p class="muted small" style="margin:2px 2px 0">Tap a verse to highlight, save, or go deeper.</p>
    <h2 style="margin:12px 0 8px;font-size:22px">${esc(chLabel)}</h2>
    <div id="chap"><div class="spinner"></div></div>
    <div class="chapnav"><button class="btn ghost" id="prev">‹ Previous</button><button class="btn ghost" id="next">Next ›</button></div>
    <p class="muted small" style="text-align:center">${esc(TRANS[settings.trans])}${B.n === 'Psalms' ? ' · Psalms use Greek numbering; Hebrew number in brackets' : ''}</p>`;
  $('#pickBook').addEventListener('click', bookSheet);
  $('#pickChap').addEventListener('click', () => chapSheet(pos.b));
  $('#openSearch').addEventListener('click', () => go('search'));
  $('#prev').addEventListener('click', () => step(-1));
  $('#next').addEventListener('click', () => step(1));
  try {
    const book = await loadBook(pos.b);
    if (current !== 'bible') return;
    const hl = store.get('hl', {}), favSet = favVerseSet(), noteSet = noteVerseSet();
    let html = '<div class="scripture" id="chapText"><p>';
    (book[pos.c - 1] || []).forEach((t, i) => {
      const v = i + 1, key = `${pos.b}:${pos.c}:${v}`;
      html += `<span class="v${hl[key] ? ' hl' + hl[key] : ''}" data-v="${v}" id="v${v}"><span class="vn">${v}${favSet.has(key) ? '★' : ''}${noteSet.has(key) ? '✎' : ''}</span>${esc(t)} </span>`;
    });
    $('#chap').innerHTML = html + '</p></div>';
    $('#chapText').addEventListener('click', e => { const el = e.target.closest('.v'); if (el) toggleSelect(+el.dataset.v); });
    if (opts.v) {
      const el = $('#v' + opts.v);
      if (el) { el.scrollIntoView({ block: 'center' }); flash(el); }
    }
  } catch (e) { $('#chap').innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}
function flash(el) { el.style.background = 'var(--accent-soft)'; el.style.borderRadius = '4px'; setTimeout(() => { el.style.background = ''; }, 2500); }
function step(d) {
  let { b, c } = pos; c += d;
  if (c < 1) { if (b === 0) return; b--; c = BOOKS[b].c; }
  else if (c > BOOKS[b].c) { if (b === BOOKS.length - 1) return; b++; c = 1; }
  go('bible', { b, c });
}
const SHEET_TOP = `<div class="grabzone"><div class="grab"></div><button class="iconbtn sheetx" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>`;
function sheet(inner) {
  const s = document.createElement('div'); s.className = 'sheet';
  s.innerHTML = `<div class="panel">${SHEET_TOP}${inner}</div>`;
  const panel = s.firstChild;
  s.addEventListener('click', e => { if (e.target === s || e.target.closest('.sheetx')) s.remove(); });
  // Swipe down to close: drag from the handle area, or anywhere when the panel is scrolled to the top.
  let y0 = null, dy = 0;
  panel.addEventListener('touchstart', e => {
    const fromTop = e.target.closest('.grabzone');
    if (!fromTop && panel.scrollTop > 0) { y0 = null; return; }
    if (e.target.closest('textarea,input')) { y0 = null; return; }
    y0 = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  panel.addEventListener('touchmove', e => {
    if (y0 === null) return;
    dy = e.touches[0].clientY - y0;
    if (dy > 0 && panel.scrollTop <= 0) { panel.classList.add('dragging'); panel.style.transform = `translateY(${dy}px)`; if (e.cancelable) e.preventDefault(); }
    else if (dy < 0) { y0 = null; panel.style.transform = ''; panel.classList.remove('dragging'); }
  }, { passive: false });
  const end = () => {
    if (y0 === null) return; y0 = null;
    panel.classList.remove('dragging');
    if (dy > 90) { panel.style.transform = 'translateY(100%)'; setTimeout(() => s.remove(), 180); }
    else panel.style.transform = '';
  };
  panel.addEventListener('touchend', end); panel.addEventListener('touchcancel', end);
  document.body.appendChild(s); return s;
}
function bookSheet() {
  const btn = (b, i) => `<button data-b="${i}" class="${i === pos.b ? 'cur' : ''}">${esc(b.n)}</button>`;
  const s = sheet(`<h3>Choose a book</h3><div class="booklist">
    <h4>Old Testament</h4><div class="blist">${BOOKS.slice(0, 46).map((b, i) => btn(b, i)).join('')}</div>
    <h4>New Testament</h4><div class="blist">${BOOKS.slice(46).map((b, i) => btn(b, i + 46)).join('')}</div></div>`);
  s.querySelectorAll('[data-b]').forEach(x => x.addEventListener('click', () => { const b = +x.dataset.b; s.remove(); BOOKS[b].c === 1 ? go('bible', { b, c: 1 }) : chapSheet(b); }));
  const cur = s.querySelector('.cur'); cur && cur.scrollIntoView({ block: 'center' });
}
function chapSheet(b) {
  const n = BOOKS[b].c;
  const s = sheet(`<h3>${esc(BOOKS[b].n)}</h3><div class="grid">${Array.from({ length: n }, (_, i) =>
    `<button data-c="${i + 1}" class="${b === pos.b && i + 1 === pos.c ? 'cur' : ''}">${i + 1}</button>`).join('')}</div>`);
  s.querySelectorAll('[data-c]').forEach(x => x.addEventListener('click', () => { s.remove(); go('bible', { b, c: +x.dataset.c }); }));
}

/* ===== SEARCH ===== */
let worker = null, lastQuery = store.get('lastQuery', '');
function renderSearch() {
  $('#title').textContent = 'Search';
  view.innerHTML = `<button class="btn ghost" id="backBible" style="min-height:40px;margin:4px 0">‹ Back to Bible</button><form class="searchbox" id="sf" role="search">
      <input id="q" type="search" placeholder="Words or a reference, e.g. John 3:16" autocomplete="off" enterkeyhint="search" value="${esc(lastQuery)}">
      <button class="btn primary" style="min-height:40px">Search</button></form>
    <div class="progress hidden" id="prog"><i></i></div>
    <div id="sres"><p class="muted small">Search the whole Bible (${esc(TRANS[settings.trans])}) by words, like <i>fruit of the Spirit</i>, or jump to a passage, like <i>Psalm 23</i> or <i>1 Cor 13:4</i>.</p></div>`;
  $('#sf').addEventListener('submit', e => { e.preventDefault(); runSearch($('#q').value); $('#q').blur(); });
  $('#backBible').addEventListener('click', () => go('bible'));
}
async function runSearch(q) {
  q = q.trim(); if (!q) return;
  lastQuery = q; store.set('lastQuery', q);
  await loadMeta(); await loadVmap();
  const res = $('#sres'), prog = $('#prog');
  if (worker) { worker.terminate(); worker = null; }
  const ref = parseRef(q);
  res.innerHTML = '';
  if (ref) {
    const a = document.createElement('button'); a.className = 'result';
    a.innerHTML = `<b>Go to</b><span>${esc(ref.label)}</span>`;
    a.addEventListener('click', () => go('bible', { b: ref.b, c: ref.c, v: ref.v }));
    res.appendChild(a);
    if (/\d/.test(q)) return; // pure reference: no word search
  }
  const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  if (!words.length) return;
  prog.classList.remove('hidden'); $('i', prog).style.width = '0';
  const count = document.createElement('p'); count.className = 'muted small'; count.textContent = 'Searching…'; res.appendChild(count);
  let n = 0; const MAX = 300;
  const STOP = new Set(['the', 'of', 'and', 'a', 'an', 'to', 'in', 'is', 'on', 'for', 'be', 'by', 'it', 'as', 'at']);
  const hl = words.filter(w => !STOP.has(w)); if (!hl.length) hl.push(...words);
  const rx = new RegExp('\\b(' + hl.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(\\w*)', 'gi');
  worker = new Worker('search-worker.js');
  worker.onmessage = e => {
    const m = e.data;
    if (m.type === 'hits') {
      const frag = document.createDocumentFragment();
      for (const h of m.hits) {
        if (n >= MAX) break; n++;
        const B = BOOKS[h.b];
        const lab = B.n === 'Psalms' ? `Psalm ${psalmLabel(h.c)}:${h.v}` : `${B.n} ${h.c}:${h.v}`;
        const el = document.createElement('button'); el.className = 'result';
        el.innerHTML = `<b>${esc(lab)}</b><span>${esc(h.t).replace(rx, '<mark>$1$2</mark>')}</span>`;
        el.addEventListener('click', () => go('bible', { b: h.b, c: h.c, v: h.v }));
        frag.appendChild(el);
      }
      res.appendChild(frag);
    } else if (m.type === 'progress') { $('i', prog).style.width = (m.done / m.total * 100) + '%'; count.textContent = `Searching… ${n} found`; }
    else if (m.type === 'done' || m.type === 'error') {
      prog.classList.add('hidden');
      count.textContent = m.type === 'error' ? m.message : n ? `${n}${m.capped ? '+' : ''} verse${n === 1 ? '' : 's'} found` : 'No verses found.';
      worker.terminate(); worker = null;
    }
  };
  worker.postMessage({ words, trans: settings.trans, books: BOOKS.length, max: MAX });
}

/* ===== VERSE SELECTION · HIGHLIGHTS · FAVORITES · STUDY ===== */
/* Everything here is stored on the phone (localStorage). Keys use this Bible's own numbering:
   "bookIndex:chapter:verse", which is the same for CPDV and Douay-Rheims. */
const HL_COLORS = [['1', 'Gold'], ['2', 'Green'], ['3', 'Blue'], ['4', 'Pink']];
const DEFAULT_CATS = ['Hope', 'Strength', 'Peace', 'Love', 'Faith', 'Healing', 'Guidance', 'Gratitude', 'Forgiveness', 'Protection'];
const selection = new Set();
function getCats() { return store.get('cats', null) || DEFAULT_CATS.slice(); }
function getFavs() { return store.get('favs', []); }
function favVerseSet() {
  const s = new Set();
  for (const f of getFavs()) for (let v = f.v; v <= f.ev; v++) s.add(`${f.b}:${f.c}:${v}`);
  return s;
}
function refLabel(b, c, v, ev) {
  const B = BOOKS[b]; const ch = B.n === 'Psalms' ? 'Psalm ' + psalmLabel(c) : `${B.n} ${c}`;
  return `${ch}:${v}${ev && ev !== v ? '–' + ev : ''}`;
}
function toggleSelect(v) {
  if (selection.has(v)) selection.delete(v); else selection.add(v);
  const el = $('#v' + v); if (el) el.classList.toggle('sel', selection.has(v));
  selection.size ? showSelBar() : hideSelBar();
}
function selRange() { const a = [...selection].sort((x, y) => x - y); return { v: a[0], ev: a[a.length - 1], list: a }; }
function hideSelBar() { const b = $('#selbar'); if (b) b.remove(); document.body.classList.remove('selopen'); }
function showSelBar() {
  let bar = $('#selbar');
  const r = selRange();
  const label = refLabel(pos.b, pos.c, r.v, r.ev);
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'selbar'; bar.className = 'selbar';
    document.body.appendChild(bar); document.body.classList.add('selopen');
  }
  bar.innerHTML = `<div class="selhead"><b>${esc(label)}</b><span class="muted small">${selection.size} verse${selection.size > 1 ? 's' : ''}</span>
      <button class="iconbtn" data-act="close" aria-label="Clear selection"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
    <div class="selrow">${HL_COLORS.map(([k, n]) => `<button class="swatch hl${k}" data-hl="${k}" aria-label="Highlight ${n}"></button>`).join('')}
      <button class="swatch none" data-hl="0" aria-label="Remove highlight">⌫</button></div>
    <div class="selrow acts">
      <button class="act" data-act="save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/></svg>Save</button>
      <button class="act" data-act="note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>Notes</button>
      <button class="act" data-act="compare"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4"/><path d="M3 8h13"/><path d="m17 12 4 4-4 4"/><path d="M21 16H8"/></svg>Compare</button>
      <button class="act" data-act="copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>Copy</button>
      <button class="btn primary" data-act="deeper">Go deeper</button></div>`;
  bar.onclick = e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.hl !== undefined) return applyHighlight(t.dataset.hl);
    const a = t.dataset.act;
    if (a === 'close') return clearSelection();
    if (a === 'save') return saveFavSheet();
    if (a === 'note') return openNoteSheet();
    if (a === 'compare') return openCompare();
    if (a === 'copy') return copyVerses();
    if (a === 'deeper') return openStudy();
  };
}
/* "John 3:16–17, 20" — exact verses, even when the picked ones aren't side by side */
function selLabel(b, c, list) {
  const head = BOOKS[b].n === 'Psalms' ? 'Psalm ' + psalmLabel(c) : `${BOOKS[b].n} ${c}`;
  const parts = []; let i = 0;
  while (i < list.length) { let j = i; while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++; parts.push(i === j ? `${list[i]}` : `${list[i]}–${list[j]}`); i = j + 1; }
  return `${head}:${parts.join(', ')}`;
}
async function versesOf(b, c, list, trans = settings.trans) {
  const book = await loadBook(b, trans);
  return list.map(v => ({ v, t: (book[c - 1] || [])[v - 1] || '' }));
}
const joinVerses = vs => vs.length === 1 ? vs[0].t : vs.map(x => `${x.v} ${x.t}`).join(' ');

/* --- Copy: text plus the reference, ready to paste anywhere --- */
async function copyVerses() {
  const list = selRange().list, ref = selLabel(pos.b, pos.c, list);
  const vs = await versesOf(pos.b, pos.c, list);
  const out = `"${joinVerses(vs)}" — ${ref} (${TRANS[settings.trans]})`;
  let ok = false;
  try { await navigator.clipboard.writeText(out); ok = true; } catch {}
  if (!ok) {   // older fallback
    const ta = document.createElement('textarea'); ta.value = out; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0';
    document.body.appendChild(ta); ta.select(); try { ok = document.execCommand('copy'); } catch {} ta.remove();
  }
  toast(ok ? `Copied ${ref}` : 'Copying isn\'t allowed here');
  if (ok) clearSelection();
  return out;
}

/* --- Compare: CPDV and Douay-Rheims side by side, current version first --- */
async function openCompare() {
  const list = selRange().list, b = pos.b, c = pos.c, ref = selLabel(b, c, list);
  const order = settings.trans === 'cpdv' ? ['cpdv', 'drc'] : ['drc', 'cpdv'];
  const s = sheet(`<h3>Compare · ${esc(ref)}</h3><div id="cmpBody"><div class="spinner"></div></div>`);
  let a, z;
  try { [a, z] = await Promise.all(order.map(t => versesOf(b, c, list, t))); }
  catch { const body = $('#cmpBody', s); if (body) body.innerHTML = `<p class="muted">The ${TRANS[order[1]]} isn't saved on this phone yet. Connect to the internet once and try again.</p>`; return; }
  const body = $('#cmpBody', s); if (!body) return;
  body.innerHTML = list.map((v, i) => `<div class="cmp">${list.length > 1 ? `<div class="vnum">Verse ${v}</div>` : ''}
      <div class="tl">${esc(TRANS[order[0]])}</div><p class="scripture">${esc(a[i].t)}</p>
      <div class="tl">${esc(TRANS[order[1]])}</div><p class="scripture">${esc(z[i].t)}</p></div>`).join('') +
    `<p class="muted small">Both are complete Catholic Bibles with the same verse numbering. Change your main version in Settings.</p>`;
}

/* --- Personal notes: the verses quoted, with your reflection or prayer below --- */
function getNotes() { return store.get('notes', []); }
function noteVerseSet() {
  const s = new Set();
  for (const n of getNotes()) for (const v of n.list) s.add(`${n.b}:${n.c}:${v}`);
  return s;
}
let noteDraft = null;   // keeps unsaved writing if the sheet is closed by accident (memory only, one at a time)
async function openNoteSheet(existingId) {
  let n = existingId ? getNotes().find(x => x.id === existingId) : null;
  if (existingId && !n) return;
  if (!n) {
    const list = selRange().list;
    const vs = await versesOf(pos.b, pos.c, list);
    n = { b: pos.b, c: pos.c, list, ref: selLabel(pos.b, pos.c, list), text: joinVerses(vs), trans: settings.trans, note: '' };
  }
  const dkey = n.id || `${n.b}:${n.c}:${n.list.join(',')}`;
  const start = noteDraft && noteDraft.key === dkey ? noteDraft.text : n.note;
  const s = sheet(`<h3>${n.id ? 'Your note' : 'New note'}</h3>
    <div class="quote"><div class="qref">${esc(n.ref)} <span class="muted small">(${esc(TRANS[n.trans] || '')})</span></div><p class="scripture" style="margin:0">${esc(n.text)}</p></div>
    <textarea class="notebox" id="noteText" placeholder="Write a reflection, a prayer, or what this passage says to you…">${esc(start)}</textarea>
    <button class="btn primary block" id="noteSave" style="margin-top:12px">Save to Personal</button>
    ${n.id ? `<button class="btn ghost block" id="noteOpen" style="margin-top:8px">Open in Bible</button>
    <button class="btn ghost block danger" id="noteDel" style="margin-top:8px">Delete note</button>` : ''}`);
  s.querySelector('.panel').classList.add('tall');
  const ta = $('#noteText', s);
  ta.addEventListener('input', () => { noteDraft = { key: dkey, text: ta.value }; });
  $('#noteSave', s).onclick = () => {
    const text = ta.value.trim();
    if (!text) { toast('Write something first'); ta.focus(); return; }
    const notes = getNotes();
    if (n.id) { const x = notes.find(y => y.id === n.id); if (x) { x.note = text; x.u = Date.now(); } }
    else notes.unshift(Object.assign({}, n, { id: 'n' + Date.now().toString(36), note: text, t: Date.now(), u: Date.now() }));
    store.set('notes', notes); noteDraft = null; s.remove();
    toast('Saved in Saved → Personal ✎');
    if (!n.id) {
      for (const v of n.list) { const el = $('#v' + v + ' .vn'); if (el && !el.textContent.includes('✎')) el.textContent += '✎'; }
      clearSelection();
    }
    if (current === 'saved') renderSaved();
  };
  if (n.id) {
    $('#noteOpen', s).onclick = () => { s.remove(); go('bible', { b: n.b, c: n.c, v: n.list[0] }); };
    $('#noteDel', s).onclick = () => {
      if (!confirm('Delete this note?')) return;
      store.set('notes', getNotes().filter(y => y.id !== n.id)); noteDraft = null; s.remove(); toast('Note deleted');
      if (current === 'saved') renderSaved();
    };
  }
}
function clearSelection() {
  for (const v of selection) { const el = $('#v' + v); if (el) el.classList.remove('sel'); }
  selection.clear(); hideSelBar();
}
function applyHighlight(color) {
  const hl = store.get('hl', {});
  for (const v of selection) {
    const key = `${pos.b}:${pos.c}:${v}`, el = $('#v' + v);
    if (color === '0') delete hl[key]; else hl[key] = color;
    if (el) { el.classList.remove('hl1', 'hl2', 'hl3', 'hl4'); if (color !== '0') el.classList.add('hl' + color); }
  }
  store.set('hl', hl);
  toast(color === '0' ? 'Highlight removed' : 'Highlighted');
  clearSelection();
}
async function selectedText() {
  const book = await loadBook(pos.b);
  return selRange().list.map(v => `${v} ${book[pos.c - 1][v - 1]}`).join(' ');
}
function catPicker(selected) {
  return `<div class="chips" id="catChips">${getCats().map(c => `<button class="chip-btn" aria-pressed="${selected.includes(c)}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
    <button class="chip-btn add" id="newCat">+ New</button></div>`;
}
function wireCatPicker(root) {
  root.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'));
  const add = $('#newCat', root);
  if (add) add.onclick = () => {
    const name = (prompt('New category name') || '').trim(); if (!name) return;
    const cats = getCats(); if (!cats.includes(name)) { cats.push(name); store.set('cats', cats); }
    const b = document.createElement('button'); b.className = 'chip-btn'; b.dataset.cat = name; b.textContent = name;
    b.setAttribute('aria-pressed', 'true'); b.onclick = () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true');
    add.before(b);
  };
}
async function saveFavSheet() {
  const r = selRange(), label = refLabel(pos.b, pos.c, r.v, r.ev);
  const s = sheet(`<h3>Save to favorites</h3><p class="muted small" style="margin-top:0">${esc(label)} · choose one or more categories</p>
    ${catPicker([])}<button class="btn primary block" id="doSave" style="margin-top:16px">Save</button>`);
  wireCatPicker(s);
  $('#doSave', s).onclick = async () => {
    const cats = [...s.querySelectorAll('[data-cat][aria-pressed="true"]')].map(b => b.dataset.cat);
    const favs = getFavs();
    favs.unshift({ id: Date.now().toString(36), b: pos.b, c: pos.c, v: r.v, ev: r.ev, ref: label, text: await selectedText(), trans: settings.trans, cats, t: Date.now() });
    store.set('favs', favs);
    s.remove(); toast('Saved to favorites ★'); clearSelection();
    for (let v = r.v; v <= r.ev; v++) { const n = $('#v' + v + ' .vn'); if (n && !n.textContent.includes('★')) n.textContent += '★'; }
  };
}

/* --- Go deeper: Church Fathers (Catena Aurea, Gospels) + cross-references, loaded per book on demand --- */
const studyCache = new Map(); // "catena/49" -> data (max 2 kept)
async function loadStudy(kind, b) {
  const key = kind + '/' + b;
  if (studyCache.has(key)) return studyCache.get(key);
  let d = null;
  try { const r = await fetch(`data/${kind}/${b}.json`); if (r.ok) d = await r.json(); } catch {}
  studyCache.set(key, d);
  while (studyCache.size > 2) studyCache.delete(studyCache.keys().next().value);
  return d;
}
async function openStudy() {
  const r = selRange(), b = pos.b, c = pos.c, label = refLabel(b, c, r.v, r.ev);
  const s = sheet(`<h3>Go deeper · ${esc(label)}</h3><div id="studyBody"><div class="spinner"></div></div>`);
  s.querySelector('.panel').classList.add('tall');
  const text = await selectedText();
  const hasCatena = b >= 46 && b <= 49, hasXref = !['Tobit', 'Judith', 'Wisdom', 'Sirach', 'Baruch', '1 Maccabees', '2 Maccabees'].includes(BOOKS[b].n);
  const [catena, xref] = await Promise.all([hasCatena ? loadStudy('catena', b) : null, hasXref ? loadStudy('xref', b) : null]);
  let html = `<div class="card" style="margin-top:0"><p class="scripture" style="margin:0">${esc(text)}</p></div>`;
  // Church Fathers
  html += `<h4 class="eyebrow" style="margin:18px 0 6px">Church Fathers · Catena Aurea</h4>`;
  const notes = [];
  if (catena) for (const [start, list] of Object.entries(catena)) {
    const [sc, sv] = start.split(':').map(Number); if (sc !== c) continue;
    for (const [ev, author, t] of list) if (r.list.some(v => v >= sv && v <= ev)) notes.push({ sv, ev, author, t });
  }
  notes.sort((x, y) => x.sv - y.sv);
  if (!catena) html += `<p class="muted small">St. Thomas Aquinas's Catena Aurea covers the four Gospels (Matthew, Mark, Luke, John). For other books, see the cross-references below.</p>`;
  else if (!notes.length) html += `<p class="muted small">No Church Father notes on these exact verses. Try the verses just before or after.</p>`;
  else notes.forEach((n, i) => {
    const long = n.t.length > 420;
    html += `<div class="note-f"><div class="small"><b>${esc(n.author)}</b> <span class="muted">· on ${c}:${n.sv}${n.ev !== n.sv ? '–' + n.ev : ''}</span></div>
      <p class="ftext${long ? ' clamp' : ''}" id="ft${i}">${esc(n.t)}</p>${long ? `<button class="linkbtn" data-more="${i}">Read more</button>` : ''}</div>`;
  });
  // Cross-references
  html += `<h4 class="eyebrow" style="margin:18px 0 6px">Cross-references</h4>`;
  const refs = [], seen = new Set();
  if (xref) for (const v of r.list) for (const x of (xref[`${c}:${v}`] || [])) {
    const k = x.join(','); if (!seen.has(k)) { seen.add(k); refs.push(x); }
  }
  if (!refs.length) html += `<p class="muted small">No cross-references for these verses.${['Tobit', 'Judith', 'Wisdom', 'Sirach', 'Baruch', '1 Maccabees', '2 Maccabees'].includes(BOOKS[b].n) ? ' (The cross-reference collection does not cover this book.)' : ''}</p>`;
  else refs.slice(0, 16).forEach((x, i) => {
    html += `<div class="xref"><button class="xref-btn" data-x="${i}"><b>${esc(refLabel(x[0], x[1], x[2], x[1] === x[3] ? x[4] : null))}</b><span class="muted small">Show text ▾</span></button><div class="xtext" id="xt${i}"></div></div>`;
  });
  html += `<p class="muted small" style="margin-top:16px">Church Fathers: Catena Aurea of St. Thomas Aquinas (public domain). Cross-references: OpenBible.info (CC-BY).</p>`;
  const body = $('#studyBody', s); if (!body) return;
  body.innerHTML = html;
  body.querySelectorAll('[data-more]').forEach(btn => btn.onclick = () => { $('#ft' + btn.dataset.more, s).classList.remove('clamp'); btn.remove(); });
  body.querySelectorAll('[data-x]').forEach(btn => btn.onclick = async () => {
    const x = refs[+btn.dataset.x], box = $('#xt' + btn.dataset.x, s);
    if (box.innerHTML) { box.innerHTML = ''; return; }
    const ec = x[3], ev = x[4];
    const vs = await versesFor({ b: BOOKS[x[0]].n, c: x[1], v: x[2], ec, ev: ec === x[1] ? ev : ev }, true).catch(() => []);
    box.innerHTML = (vs.length ? versesHTML(vs.slice(0, 12)) : '<p class="muted small">Text not available.</p>') +
      `<button class="btn ghost" style="min-height:40px;margin:6px 0 10px" data-open="1">Open in Bible ›</button>`;
    $('[data-open]', box).onclick = () => { s.remove(); go('bible', { b: x[0], c: x[1], v: x[2] }); };
  });
}

/* ===== SAVED (favorites) ===== */
let savedFilter = 'All';
function renderSaved() {
  $('#title').textContent = 'Saved';
  const favs = getFavs(), notes = getNotes(), cats = getCats();
  if (savedFilter !== 'All' && savedFilter !== 'Personal' && !cats.includes(savedFilter)) savedFilter = 'All';
  const counts = {}; favs.forEach(f => f.cats.forEach(c => counts[c] = (counts[c] || 0) + 1));
  let list;
  if (savedFilter === 'All') list = [...favs, ...notes.map(n => Object.assign({ isNote: true }, n))].sort((a, b) => (b.u || b.t || 0) - (a.u || a.t || 0));
  else if (savedFilter === 'Personal') list = notes.map(n => Object.assign({ isNote: true }, n));
  else list = favs.filter(f => f.cats.includes(savedFilter));
  const favCard = f => `<div class="card fav" data-id="${f.id}">
        <div class="favhead"><b>${esc(f.ref)}</b><button class="iconbtn" data-menu="${f.id}" aria-label="Options">⋯</button></div>
        <p class="scripture favtext">${esc(f.text)}</p>
        ${f.cats.length ? `<div class="chips small-chips">${f.cats.map(c => `<span class="chip">${esc(c)}</span>`).join('')}</div>` : ''}
      </div>`;
  const noteCard = n => `<div class="card fav" data-note="${n.id}">
        <div class="favhead"><b>${esc(n.ref)}</b><span class="chip" style="margin:0">✎ Personal</span></div>
        <div class="quote" style="margin-bottom:0"><p class="scripture favtext" style="margin:0">${esc(n.text)}</p></div>
        <p class="notetext favtext">${esc(n.note)}</p>
      </div>`;
  const empty = savedFilter === 'Personal' ? 'No personal notes yet. In the Bible, tap a verse and choose ✎ Notes.'
    : favs.length || notes.length ? 'Nothing saved in this category yet.' : 'Nothing saved yet. In the Bible, tap a verse and choose ★ Save or ✎ Notes.';
  view.innerHTML = `<div class="chips scrollx">${['All', 'Personal', ...cats].map(c => `<button class="chip-btn" aria-pressed="${c === savedFilter}" data-f="${esc(c)}">${c === 'Personal' ? '✎ ' : ''}${esc(c)}${c === 'All' ? ` · ${favs.length + notes.length}` : c === 'Personal' ? (notes.length ? ` · ${notes.length}` : '') : counts[c] ? ` · ${counts[c]}` : ''}</button>`).join('')}</div>
    <button class="linkbtn" id="manageCats" style="margin:4px 2px 10px">Manage categories</button>
    <div id="favList">${list.length ? list.map(x => x.isNote ? noteCard(x) : favCard(x)).join('') : `<div class="card"><p style="margin:0">${empty}</p></div>`}</div>`;
  view.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { savedFilter = b.dataset.f; renderSaved(); });
  $('#manageCats').onclick = manageCats;
  view.querySelectorAll('.fav[data-id]').forEach(card => card.addEventListener('click', e => {
    if (e.target.closest('[data-menu]')) return;
    const f = getFavs().find(x => x.id === card.dataset.id); if (f) go('bible', { b: f.b, c: f.c, v: f.v });
  }));
  view.querySelectorAll('.fav[data-note]').forEach(card => card.addEventListener('click', () => openNoteSheet(card.dataset.note)));
  view.querySelectorAll('[data-menu]').forEach(b => b.onclick = () => favMenu(b.dataset.menu));
}
function favMenu(id) {
  const f = getFavs().find(x => x.id === id); if (!f) return;
  const s = sheet(`<h3>${esc(f.ref)}</h3><p class="muted small" style="margin-top:0">Categories</p>${catPicker(f.cats)}
    <button class="btn primary block" id="favUpd" style="margin-top:14px">Update categories</button>
    <button class="btn ghost block" id="favOpen" style="margin-top:8px">Open in Bible</button>
    <button class="btn ghost block danger" id="favDel" style="margin-top:8px">Remove from favorites</button>`);
  wireCatPicker(s);
  $('#favUpd', s).onclick = () => {
    const favs = getFavs(), x = favs.find(y => y.id === id);
    x.cats = [...s.querySelectorAll('[data-cat][aria-pressed="true"]')].map(b => b.dataset.cat);
    store.set('favs', favs); s.remove(); renderSaved(); toast('Updated');
  };
  $('#favOpen', s).onclick = () => { s.remove(); go('bible', { b: f.b, c: f.c, v: f.v }); };
  $('#favDel', s).onclick = () => {
    if (!confirm('Remove this favorite?')) return;
    store.set('favs', getFavs().filter(y => y.id !== id)); s.remove(); renderSaved(); toast('Removed');
  };
}
function manageCats() {
  const draw = () => `<h3>Manage categories</h3>${getCats().map((c, i) => `<div class="catrow"><span>${esc(c)}</span>
      <button class="linkbtn" data-ren="${i}">Rename</button><button class="linkbtn danger" data-del="${i}">Delete</button></div>`).join('')}
    <button class="btn primary block" id="catAdd" style="margin-top:14px">+ Add category</button>`;
  const s = sheet(draw());
  const wire = () => {
    $('#catAdd', s).onclick = () => { const n = (prompt('New category name') || '').trim(); if (!n) return; const c = getCats(); if (!c.includes(n)) { c.push(n); store.set('cats', c); } refresh(); };
    s.querySelectorAll('[data-ren]').forEach(b => b.onclick = () => {
      const cats = getCats(), old = cats[+b.dataset.ren], n = (prompt('Rename category', old) || '').trim();
      if (!n || n === old) return;
      cats[+b.dataset.ren] = n; store.set('cats', cats);
      const favs = getFavs(); favs.forEach(f => f.cats = f.cats.map(c => c === old ? n : c)); store.set('favs', favs);
      if (savedFilter === old) savedFilter = n; refresh();
    });
    s.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const cats = getCats(), old = cats[+b.dataset.del];
      if (!confirm(`Delete the category "${old}"? Your saved passages stay; they just lose this label.`)) return;
      store.set('cats', cats.filter(c => c !== old));
      const favs = getFavs(); favs.forEach(f => f.cats = f.cats.filter(c => c !== old)); store.set('favs', favs);
      if (savedFilter === old) savedFilter = 'All'; refresh();
    });
  };
  const refresh = () => { $('.panel', s).innerHTML = SHEET_TOP + draw(); wire(); renderSaved(); };
  wire();
}

/* --- Backup: one small file with highlights, favorites and categories --- */
function exportBackup() {
  const data = { app: 'manna', version: 2, exported: new Date().toISOString(), hl: store.get('hl', {}), favs: getFavs(), notes: getNotes(), cats: getCats() };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `manna-backup-${manilaDate()}.json`; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return data;
}
function importBackup(json) {
  const d = typeof json === 'string' ? JSON.parse(json) : json;
  if (!d || d.app !== 'manna') throw new Error('This is not a Manna backup file.');
  const hl = Object.assign(store.get('hl', {}), d.hl || {});
  const favs = getFavs(), ids = new Set(favs.map(f => f.id));
  for (const f of d.favs || []) if (!ids.has(f.id)) favs.push(f);
  favs.sort((a, b) => (b.t || 0) - (a.t || 0));
  const cats = getCats(); for (const c of d.cats || []) if (!cats.includes(c)) cats.push(c);
  const notes = getNotes(), byId = new Map(notes.map(n => [n.id, n]));
  for (const n of d.notes || []) { const have = byId.get(n.id); if (!have) notes.push(n); else if ((n.u || 0) > (have.u || 0)) Object.assign(have, n); }
  notes.sort((a, b) => (b.t || 0) - (a.t || 0));
  store.set('hl', hl); store.set('favs', favs); store.set('cats', cats); store.set('notes', notes);
  return { highlights: Object.keys(d.hl || {}).length, favorites: (d.favs || []).length, notes: (d.notes || []).length };
}

/* ===== ARMORY (prayers & chaplets) — code and texts load only when opened ===== */
let armoryLoading = null;
function renderArmory(opts) {
  $('#title').textContent = 'Armory';
  view.innerHTML = '<div class="spinner"></div>';
  if (!window.MannaArmory) armoryLoading = armoryLoading || new Promise((res, rej) => {
    const sc = document.createElement('script'); sc.src = 'armory.js'; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc);
  });
  Promise.resolve(armoryLoading).then(() => {
    if (current !== 'armory') return;
    window.MannaArmory.render(opts, { view, $, esc, store, toast, go, sheet, loadMeta, loadVmap, parseRef, versesFor, versesHTML, manilaWeekday });
  }).catch(() => { view.innerHTML = '<p class="muted">The Armory could not load. Connect to the internet once and try again.</p>'; });
}

/* ===== SETTINGS ===== */
function openSettings() {
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button aria-pressed="${settings[k] === v}" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const s = sheet(`<h3>Settings</h3>
    <div class="setrow"><label>Theme</label>${seg('theme', [['modern', 'Modern'], ['classic', 'Classic'], ['dark', 'Dark']])}</div>
    <div class="setrow"><label>Bible version</label>${seg('trans', [['cpdv', 'CPDV'], ['drc', 'Douay-Rheims']])}
      <p class="muted small">CPDV: modern English. Douay-Rheims: traditional English. Both are complete Catholic Bibles (73 books).</p></div>
    <div class="setrow"><label>Reading text size</label><div class="seg">
      <button data-size="-1">A−</button><button aria-pressed="true" id="sizeNow">Size ${settings.size}</button><button data-size="1">A+</button></div>
      <p class="scripture" id="sizePreview" style="margin-top:10px">Give us this day our daily bread.</p></div>
    <div class="setrow"><label>Offline</label><p class="small" id="offStat">Checking…</p><p class="small" id="studyStat"></p></div>
    <div class="setrow"><label>Backup</label><p class="small muted" style="margin-top:0">Your highlights, favorites, notes and categories are kept on this phone. Save a backup file now and then, to restore them if you change phones or clear Chrome's data.</p>
      <div class="pickrow"><button class="btn ghost" id="bkSave">Save backup</button><button class="btn ghost" id="bkLoad">Restore</button></div>
      <input type="file" id="bkFile" accept="application/json,.json" class="hidden"></div>
    <p class="muted small" style="margin-bottom:0">About the App</p>
    <p class="muted small about" style="margin-top:2px">For Kurtny, Drey, &amp; Rollo. A project by Tin Apple Solutions, all honor, praise, and glory belongs to our Lord and Savior Jesus Christ.</p>
    <p class="muted small">Manna · Scripture: Catholic Public Domain Version and Douay-Rheims (Challoner), both public domain. Church Fathers: Catena Aurea (public domain). Cross-references: OpenBible.info (CC-BY).</p>`);
  $('#bkSave', s).onclick = () => { exportBackup(); toast('Backup file saved to your Downloads'); };
  $('#bkLoad', s).onclick = () => $('#bkFile', s).click();
  $('#bkFile', s).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const r = importBackup(await f.text()); toast(`Restored ${r.favorites} favorites, ${r.notes} notes and ${r.highlights} highlights`); if (current === 'saved' || current === 'bible') go(current); }
    catch (err) { toast(err.message || 'That file could not be read'); }
  };
  s.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    saveSetting(b.dataset.k, b.dataset.v);
    s.querySelectorAll(`[data-k="${b.dataset.k}"]`).forEach(x => x.setAttribute('aria-pressed', x === b));
    if (b.dataset.k === 'trans') { ensureOffline(); updateOffStat(); go(current, undefined, true); }
  }));
  s.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => {
    saveSetting('size', Math.max(14, Math.min(30, settings.size + +b.dataset.size)));
    $('#sizeNow', s).textContent = 'Size ' + settings.size;
  }));
  updateOffStat();
}
async function updateOffStat() {
  const el = $('#offStat'); if (!el) return;
  const st = store.get('offline', {});
  const t = settings.trans;
  if (!('serviceWorker' in navigator)) { el.textContent = 'Offline reading isn\'t supported on this browser.'; return; }
  if (st[t] === 'done') el.textContent = `✓ ${TRANS[t]} is saved on this phone and works without internet.`;
  else el.textContent = `Saving ${TRANS[t]} to this phone for offline use… (${st[t + '_n'] || 0} of 73 books)`;
  const ss = $('#studyStat');
  if (ss) ss.textContent = st.study === 'done' ? '✓ Study notes (Church Fathers & cross-references) are saved for offline use.'
    : `Saving study notes for offline use… (${st.study_n || 0} of ${STUDY_FILES().length} files)`;
}

/* ---------- offline / install ---------- */
const XREF_BOOKS = () => BOOKS ? BOOKS.map((b, i) => i).filter(i => !['Tobit', 'Judith', 'Wisdom', 'Sirach', 'Baruch', '1 Maccabees', '2 Maccabees'].includes(BOOKS[i].n)) : [];
const STUDY_FILES = () => [...XREF_BOOKS().map(i => `data/xref/${i}.json`), ...[46, 47, 48, 49].map(i => `data/catena/${i}.json`)];
async function ensureOffline() {
  if (!('serviceWorker' in navigator)) return;
  await loadMeta();
  const st = store.get('offline', {});
  const reg = await navigator.serviceWorker.ready; if (!reg.active) return;
  if (st[settings.trans] !== 'done') reg.active.postMessage({ type: 'download', key: settings.trans, cache: 'manna-bible-v1', urls: BOOKS.map((b, i) => `data/${settings.trans}/${i}.json`) });
  else if (st.study !== 'done') reg.active.postMessage({ type: 'download', key: 'study', cache: 'manna-study-v1', urls: STUDY_FILES() });
}
/* ---------- updates: banner when a new version is ready; "What's new" after updating ---------- */
const APP_VERSION = 'v6';
const WHATS_NEW = {
  v6: { title: "What's new in Manna", items: [
    'About the App now sits quietly at the bottom of Settings, in the same small print as the credits.',
    'Update messages now appear in the middle of the screen.',
    'Also new lately: ✎ Notes, Compare and Copy when you tap a verse; your notes live in Saved → ✎ Personal.'],
    next: ['Nothing to do. Your highlights, favorites and notes are kept.'] },
  v5: { title: "What's new in Manna", items: [
    'Tap a verse for new tools: ✎ Notes (write a reflection or prayer under the verse), Compare (CPDV and Douay-Rheims side by side), and Copy (pastes anywhere, with the book, chapter and verse).',
    'Your notes live in Saved → ✎ Personal. Tap one to read, edit or delete it.',
    'The Today page now opens instantly after the first time each day.',
    'Pop-up panels can be closed with the X, or by swiping them down.',
    'Settings now has "About the App".'],
    next: ['Nothing to do. Your highlights and favorites are kept.', 'Try it: open the Bible, tap a verse, then tap ✎ Notes.'] },
  v4: { title: "What's new in Manna", items: [
    'Updates now come with this card. When a new version is ready, a banner appears: tap it to update.',
    'Highlights in 4 colors, favorites with categories, and the Saved tab.',
    'Go deeper: Church Fathers on the Gospels and cross-references, all offline.',
    'The Armory: 4 chaplets and 51 prayers, with skip, jump and tap-the-beads.'],
    next: ['Nothing to do. Your highlights and favorites are kept.', 'Tip: Settings → Save backup once in a while.'] }
};
function showUpdateBanner(reg) {
  if ($('#updBanner')) return;
  const b = document.createElement('button'); b.id = 'updBanner'; b.className = 'updbanner';
  b.innerHTML = '<b>A new version of Manna is ready.</b><span>Tap to update</span>';
  b.onclick = () => {
    b.innerHTML = '<b>Updating…</b>';
    store.set('updating', true);
    const w = reg.waiting; if (w) w.postMessage({ type: 'skip-waiting' }); else location.reload();
  };
  document.body.appendChild(b);
}
function showWhatsNew() {
  const seen = store.get('seenVersion', null);
  if (seen === APP_VERSION) return;
  store.set('seenVersion', APP_VERSION);
  const wn = WHATS_NEW[APP_VERSION];
  if (!seen && !EXISTING_USER && !store.get('updating', false)) return;   // brand-new install: no "what's new"
  store.set('updating', false);
  if (!wn) return;
  const s = sheet(`<h3>${esc(wn.title)}</h3><ul class="wn">${wn.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    ${wn.next && wn.next.length ? `<div class="note"><b>What to do next</b><ul class="wn">${wn.next.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    <button class="btn primary block" id="wnOk">Got it</button>`);
  $('#wnOk', s).onclick = () => s.remove();
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    setTimeout(ensureOffline, 3000);
    const watch = w => w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(reg); });
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg);
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    const check = () => reg.update().catch(() => {});
    check();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (store.get('updating', false) && !reloading) { reloading = true; location.reload(); }
  });
  navigator.serviceWorker.addEventListener('message', e => {
    const m = e.data || {};
    if (m.type === 'dl-progress' || m.type === 'dl-done') {
      const st = store.get('offline', {});
      st[m.key + '_n'] = m.done;
      if (m.type === 'dl-done' && m.ok) st[m.key] = 'done';
      store.set('offline', st); updateOffStat();
      if (m.type === 'dl-done' && m.ok && m.key !== 'study') ensureOffline();  // Bible done -> study notes next
    }
  });
}

/* ---------- start ---------- */
window.addEventListener('popstate', () => {});
const EXISTING_USER = !!(store.get('offline', null) || store.get('favs', null) || store.get('pos', null));  // decided before anything runs
go('today');
setTimeout(showWhatsNew, 400);
window.__manna = { parseRef, lectToBible, loadVmap, versesFor, loadMeta, loadYear, getDay, bookCache, go, exportBackup, importBackup, studyCache }; // used by tests
})();
