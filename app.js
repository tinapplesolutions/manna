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

function go(tab, opts) {
  current = tab;
  document.querySelectorAll('nav.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  view.innerHTML = '';
  scrollTo(0, 0);
  ({ today: renderToday, bible: renderBible, search: renderSearch, rosary: renderRosary })[tab](opts || {});
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
async function getDay(date) {
  const y = await loadYear();
  const base = y.days[date] ? JSON.parse(JSON.stringify(y.days[date])) : null;
  if (base) {
    base.readings.forEach(r => r.bible = true);
    (base.masses || []).forEach(m => m.readings.forEach(r => r.bible = true));
  }
  let online = null;
  try {
    const r = await fetch(`days/${date}.json`, { cache: 'no-cache' });
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
async function renderToday() {
  $('#title').textContent = 'Today';
  view.innerHTML = '<div class="spinner" aria-label="Loading"></div>';
  await loadMeta();
  const today = manilaDate();
  dayData = await getDay(today);
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
  view.innerHTML = `<div class="pickrow">
      <button class="btn ghost" id="pickBook">${esc(B.n)} <span class="muted">▾</span></button>
      <button class="btn ghost" id="pickChap" style="flex:0 0 96px">${pos.c} <span class="muted">▾</span></button>
    </div>
    <h2 style="margin:12px 0 8px;font-size:22px">${esc(chLabel)}</h2>
    <div id="chap"><div class="spinner"></div></div>
    <div class="chapnav"><button class="btn ghost" id="prev">‹ Previous</button><button class="btn ghost" id="next">Next ›</button></div>
    <p class="muted small" style="text-align:center">${esc(TRANS[settings.trans])}${B.n === 'Psalms' ? ' · Psalms use Greek numbering; Hebrew number in brackets' : ''}</p>`;
  $('#pickBook').addEventListener('click', bookSheet);
  $('#pickChap').addEventListener('click', () => chapSheet(pos.b));
  $('#prev').addEventListener('click', () => step(-1));
  $('#next').addEventListener('click', () => step(1));
  try {
    const book = await loadBook(pos.b);
    if (current !== 'bible') return;
    const vs = (book[pos.c - 1] || []).map((t, i) => ({ c: pos.c, v: i + 1, text: t }));
    $('#chap').innerHTML = versesHTML(vs).replace(/<span class="vn">(\d+)<\/span>/g, '<span class="vn" id="v$1">$1</span>');
    if (opts.v) {
      const el = $('#v' + opts.v);
      if (el) { el.scrollIntoView({ block: 'center' }); el.parentNode && flash(el); }
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
function sheet(inner) {
  const s = document.createElement('div'); s.className = 'sheet';
  s.innerHTML = `<div class="panel"><div class="grab"></div>${inner}</div>`;
  s.addEventListener('click', e => { if (e.target === s) s.remove(); });
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
  view.innerHTML = `<form class="searchbox" id="sf" role="search">
      <input id="q" type="search" placeholder="Words or a reference, e.g. John 3:16" autocomplete="off" enterkeyhint="search" value="${esc(lastQuery)}">
      <button class="btn primary" style="min-height:40px">Search</button></form>
    <div class="progress hidden" id="prog"><i></i></div>
    <div id="sres"><p class="muted small">Search the whole Bible (${esc(TRANS[settings.trans])}) by words, like <i>fruit of the Spirit</i>, or jump to a passage, like <i>Psalm 23</i> or <i>1 Cor 13:4</i>.</p></div>`;
  $('#sf').addEventListener('submit', e => { e.preventDefault(); runSearch($('#q').value); $('#q').blur(); });
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

/* ===== ROSARY ===== */
const P = {
  cross: 'In the name of the Father, and of the Son, and of the Holy Spirit. Amen.',
  creed: 'I believe in God, the Father almighty, Creator of heaven and earth; and in Jesus Christ, His only Son, our Lord, who was conceived by the Holy Spirit, born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died, and was buried. He descended into hell; on the third day He rose again from the dead; He ascended into heaven, and is seated at the right hand of God the Father almighty; from there He will come to judge the living and the dead.\nI believe in the Holy Spirit, the holy catholic Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and life everlasting. Amen.',
  our: 'Our Father, who art in heaven, hallowed be Thy name; Thy kingdom come; Thy will be done on earth as it is in heaven.\nGive us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.',
  hail: 'Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus.\nHoly Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.',
  glory: 'Glory be to the Father, and to the Son, and to the Holy Spirit. As it was in the beginning, is now, and ever shall be, world without end. Amen.',
  fatima: 'O my Jesus, forgive us our sins, save us from the fires of hell; lead all souls to heaven, especially those most in need of Thy mercy.',
  queen: 'Hail, holy Queen, Mother of mercy, our life, our sweetness and our hope. To thee do we cry, poor banished children of Eve; to thee do we send up our sighs, mourning and weeping in this valley of tears. Turn then, most gracious advocate, thine eyes of mercy toward us; and after this our exile, show unto us the blessed fruit of thy womb, Jesus. O clement, O loving, O sweet Virgin Mary.\nV. Pray for us, O holy Mother of God.\nR. That we may be made worthy of the promises of Christ.',
  close: 'Let us pray. O God, whose only begotten Son, by His life, death, and resurrection, has purchased for us the rewards of eternal life; grant, we beseech Thee, that by meditating upon these mysteries of the Most Holy Rosary of the Blessed Virgin Mary, we may imitate what they contain and obtain what they promise, through the same Christ our Lord. Amen.'
};
const MYST = {
  joyful: { name: 'Joyful Mysteries', list: [
    ['The Annunciation', 'Luke 1:26-38', 'Humility'], ['The Visitation', 'Luke 1:39-56', 'Love of neighbour'],
    ['The Nativity', 'Luke 2:1-20', 'Poverty of spirit'], ['The Presentation in the Temple', 'Luke 2:22-38', 'Obedience'],
    ['The Finding of Jesus in the Temple', 'Luke 2:41-52', 'Joy in finding Jesus']] },
  luminous: { name: 'Luminous Mysteries', list: [
    ['The Baptism of the Lord', 'Matthew 3:13-17', 'Openness to the Holy Spirit'], ['The Wedding at Cana', 'John 2:1-11', 'To Jesus through Mary'],
    ['The Proclamation of the Kingdom', 'Mark 1:14-15', 'Repentance and trust in God'], ['The Transfiguration', 'Matthew 17:1-8', 'Desire for holiness'],
    ['The Institution of the Eucharist', 'Matthew 26:26-28', 'Adoration']] },
  sorrowful: { name: 'Sorrowful Mysteries', list: [
    ['The Agony in the Garden', 'Matthew 26:36-46', 'Sorrow for sin'], ['The Scourging at the Pillar', 'Matthew 27:26', 'Purity'],
    ['The Crowning with Thorns', 'Matthew 27:27-31', 'Courage'], ['The Carrying of the Cross', 'Luke 23:26-32', 'Patience'],
    ['The Crucifixion', 'Luke 23:33-46', 'Perseverance']] },
  glorious: { name: 'Glorious Mysteries', list: [
    ['The Resurrection', 'Matthew 28:1-10', 'Faith'], ['The Ascension', 'Acts 1:6-11', 'Hope'],
    ['The Descent of the Holy Spirit', 'Acts 2:1-4', 'Love of God'], ['The Assumption of Mary', 'Revelation 12:1', 'Grace of a holy death'],
    ['The Coronation of Mary', 'Revelation 12:1-6', 'Trust in Mary\'s intercession']] }
};
const DAY_MYST = { Sun: 'glorious', Mon: 'joyful', Tue: 'sorrowful', Wed: 'glorious', Thu: 'luminous', Fri: 'sorrowful', Sat: 'joyful' };
const ORD = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
function rosarySteps(set) {
  const s = [];
  s.push({ t: 'Sign of the Cross', p: P.cross }, { t: "Apostles' Creed", p: P.creed }, { t: 'Our Father', p: P.our });
  ['for an increase of faith', 'for an increase of hope', 'for an increase of charity'].forEach((x, i) => s.push({ t: 'Hail Mary', sub: `${i + 1} of 3 · ${x}`, p: P.hail, beads: [3, i + 1] }));
  s.push({ t: 'Glory Be', p: P.glory });
  MYST[set].list.forEach((m, d) => {
    s.push({ t: `${ORD[d]} ${MYST[set].name.replace('Mysteries', 'Mystery')}`, mystery: m });
    s.push({ t: 'Our Father', sub: m[0], p: P.our });
    for (let i = 1; i <= 10; i++) s.push({ t: 'Hail Mary', sub: `${m[0]} · ${i} of 10`, p: P.hail, beads: [10, i] });
    s.push({ t: 'Glory Be', sub: m[0], p: P.glory }, { t: 'O My Jesus', sub: m[0], p: P.fatima });
  });
  s.push({ t: 'Hail, Holy Queen', p: P.queen }, { t: 'Closing Prayer', p: P.close }, { t: 'Sign of the Cross', p: P.cross });
  return s;
}
function renderRosary(opts) {
  $('#title').textContent = 'Rosary';
  const set = opts.set || DAY_MYST[manilaWeekday()];
  const M = MYST[set];
  if (opts.pray) return prayRosary(set, opts.step || 0);
  view.innerHTML = `<div class="card"><div class="eyebrow">${opts.set ? 'Chosen' : "Today's"} mysteries</div>
      <div class="mystery">${esc(M.name)}</div>
      <ol class="mlist">${M.list.map(m => `<li>${esc(m[0])} <button class="muted small" data-ref="${esc(m[1])}" style="text-decoration:underline">${esc(m[1])}</button></li>`).join('')}</ol>
      <button class="btn primary block" id="startR">Start praying</button></div>
    <div class="setrow"><label>Pray a different set</label><div class="seg">${Object.keys(MYST).map(k =>
      `<button aria-pressed="${k === set}" data-set="${k}">${MYST[k].name.split(' ')[0]}</button>`).join('')}</div></div>
    <p class="muted small">Traditional days: Joyful (Mon, Sat) · Sorrowful (Tue, Fri) · Glorious (Wed, Sun) · Luminous (Thu).</p>`;
  $('#startR').addEventListener('click', () => go('rosary', { set, pray: true }));
  view.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => go('rosary', { set: b.dataset.set })));
  view.querySelectorAll('[data-ref]').forEach(b => b.addEventListener('click', async () => { await loadVmap(); const r = parseRef(b.dataset.ref); r && go('bible', { b: r.b, c: r.c, v: r.v }); }));
}
function prayRosary(set, i) {
  const steps = rosarySteps(set), s = steps[i];
  const pct = Math.round((i + 1) / steps.length * 100);
  let body;
  if (s.mystery) body = `<div class="mystery">${esc(s.mystery[0])}</div>
      <p class="muted">Fruit of the mystery: <b>${esc(s.mystery[2])}</b></p>
      <div id="mtext"><div class="spinner"></div></div>`;
  else body = `<p class="prayertext">${esc(s.p)}</p>`;
  view.innerHTML = `<div class="progress"><i style="width:${pct}%"></i></div>
    <div class="card"><div class="eyebrow">${esc(MYST[set].name)} · ${i + 1} of ${steps.length}</div>
      <div class="daytitle">${esc(s.t)}</div>${s.sub ? `<div class="muted small">${esc(s.sub)}</div>` : ''}
      ${s.beads ? `<div class="beads">${Array.from({ length: s.beads[0] }, (_, k) => `<i class="${k < s.beads[1] ? 'on' : ''}"></i>`).join('')}</div>` : ''}
      ${body}</div>
    <div class="stepnav"><button class="btn ghost" id="rBack">${i ? '‹ Back' : 'Exit'}</button>
      <button class="btn primary" id="rNext">${i === steps.length - 1 ? 'Finish' : 'Next ›'}</button></div>`;
  store.set('rosary', { set, i });
  $('#rBack').addEventListener('click', () => i ? prayRosary(set, i - 1) : go('rosary', { set }));
  $('#rNext').addEventListener('click', () => {
    if (i === steps.length - 1) { store.set('rosary', null); toast('Rosary complete. God bless you. 🙏'); go('rosary', { set }); }
    else { prayRosary(set, i + 1); scrollTo(0, 0); }
  });
  if (s.mystery) (async () => {
    await loadMeta();
    const r = s.mystery[1].match(/^(.+?) (\d+):(\d+)(?:-(\d+))?$/);
    const part = { b: r[1], c: +r[2], v: +r[3], ev: +(r[4] || r[3]) };
    await loadVmap();
    const vs = await versesFor(part).catch(() => []);
    const box = $('#mtext'); if (box) box.innerHTML = `<div class="ref" style="font-weight:700;margin:8px 0">${esc(s.mystery[1])}</div>` + (vs.length ? versesHTML(vs) : '');
  })();
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
    <div class="setrow"><label>Offline</label><p class="small" id="offStat">Checking…</p></div>
    <div class="setrow"><label>Daily readings</label><p class="small muted">Delivered every morning, before 6:15 AM, following the Philippine liturgical calendar. To change the time, ask Claude.</p></div>
    <p class="muted small">Manna · Scripture: Catholic Public Domain Version and Douay-Rheims (Challoner), both public domain.</p>`);
  s.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    saveSetting(b.dataset.k, b.dataset.v);
    s.querySelectorAll(`[data-k="${b.dataset.k}"]`).forEach(x => x.setAttribute('aria-pressed', x === b));
    if (b.dataset.k === 'trans') { ensureOffline(); updateOffStat(); }
    go(current);
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
}

/* ---------- offline / install ---------- */
function ensureOffline() {
  if (!('serviceWorker' in navigator)) return;
  const st = store.get('offline', {});
  if (st[settings.trans] === 'done') return;
  navigator.serviceWorker.ready.then(reg => reg.active && reg.active.postMessage({ type: 'download', trans: settings.trans, total: 73 }));
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => {
    setTimeout(ensureOffline, 3000);
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => {
    const m = e.data || {};
    if (m.type === 'dl-progress' || m.type === 'dl-done') {
      const st = store.get('offline', {});
      st[m.trans + '_n'] = m.done;
      if (m.type === 'dl-done' && m.ok) st[m.trans] = 'done';
      store.set('offline', st); updateOffStat();
    }
  });
}

/* ---------- start ---------- */
window.addEventListener('popstate', () => {});
go('today');
window.__manna = { parseRef, lectToBible, loadVmap, versesFor, loadMeta, loadYear, getDay, bookCache, go }; // used by tests
})();
