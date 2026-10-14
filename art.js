/* Manna · minimalist "zen" pictures drawn on the phone (no image files).
   MannaArt.draw(canvas, { theme, seed, text, ref, w, h }) — same seed = same picture. */
(function () {
'use strict';
function rng(seed) {   // small deterministic random generator
  let a = 0; for (const ch of String(seed)) a = (a * 31 + ch.charCodeAt(0)) | 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const P = {   // sky top, sky bottom, far, mid, near, light (sun/moon), text, dark?
  dawn:  ['#F6EFE6', '#EED8C3', '#D2C1B2', '#AE9C8F', '#7F7068', '#E9A97A', '#3B302A'],
  sage:  ['#EEF1EA', '#D9E2D3', '#BAC7B3', '#91A48D', '#64776A', '#E6C68C', '#2B382E'],
  mist:  ['#EEF1F4', '#D7DEE6', '#B9C3CE', '#909DAB', '#66727F', '#F1DAB6', '#26303B'],
  rose:  ['#F8EDEA', '#ECD0CA', '#D6B6B0', '#B3918D', '#8A6D6B', '#F2B497', '#3D2A29'],
  sand:  ['#F5ECDE', '#E7D4B5', '#CFBA96', '#AA936F', '#7E6A4E', '#DC8F58', '#382C1D'],
  dusk:  ['#2F3452', '#6E5C7C', '#55506F', '#423F5C', '#2C2B44', '#F3CBA2', '#F6EFE6', 1],
  night: ['#121D2A', '#2A3B4D', '#24323F', '#1B2733', '#121B25', '#EFE7D5', '#EFE7D5', 1]
};
// which palettes suit each motif
const PAL = {   // dusk & night appear often: Sire's favourites
  mountains: ['dawn', 'mist', 'sage', 'dusk', 'rose', 'night', 'dusk'], water: ['mist', 'night', 'dusk', 'sage', 'night'], enso: ['sand', 'dawn', 'mist', 'night', 'dusk'],
  tree: ['sage', 'dawn', 'mist', 'rose', 'dusk', 'night'], seedling: ['sage', 'sand', 'dawn', 'dusk'], rain: ['mist', 'sage', 'dusk', 'night'],
  sunrise: ['dawn', 'rose', 'sand'], path: ['sage', 'dawn', 'mist', 'sand', 'dusk'], birds: ['mist', 'rose', 'dawn', 'dusk', 'dusk'],
  candle: ['night', 'dusk'], waves: ['mist', 'dawn', 'night', 'sage', 'dusk']
};
// verse themes -> motifs that fit their meaning
const THEME = {
  perseverance: ['mountains', 'path'], strength: ['mountains', 'waves'], patience: ['tree', 'seedling', 'water'],
  humility: ['seedling', 'enso'], growth: ['seedling', 'tree'], faithfulness: ['tree', 'mountains'],
  forgiveness: ['rain', 'water'], mercy: ['rain', 'sunrise'], comfort: ['rain', 'candle', 'water'],
  peace: ['water', 'enso'], rest: ['water', 'enso', 'birds'], trust: ['birds', 'water', 'path'], worry: ['birds', 'water'],
  hope: ['sunrise', 'candle'], joy: ['sunrise', 'birds'], gratitude: ['sunrise', 'tree'], generosity: ['sunrise', 'tree'],
  kindness: ['seedling', 'sunrise'], love: ['candle', 'sunrise'], guidance: ['path', 'candle'], wisdom: ['enso', 'tree', 'path'],
  prayer: ['enso', 'candle'], courage: ['waves', 'mountains'], trials: ['waves', 'mountains'], work: ['path', 'seedling'],
  family: ['tree', 'candle'], speech: ['enso', 'water'], contentment: ['enso', 'water', 'seedling'], light: ['candle', 'sunrise'],
  faith: ['mountains', 'candle', 'enso'], newness: ['sunrise', 'seedling'], waiting: ['tree', 'water']
};

function draw(cv, o) {
  const w = o.w || cv.width, h = o.h || cv.height; cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), r = rng(o.seed || 'manna');
  const motifs = THEME[o.theme] || Object.keys(PAL);
  const motif = o.motif || motifs[Math.floor(r() * motifs.length)];
  const pals = PAL[motif]; const pal = P[o.palette || pals[Math.floor(r() * pals.length)]];
  const S = Math.min(w, h) / 1000;   // scale unit
  // sky
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, pal[0]); sky.addColorStop(1, pal[1]);
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  grain(g, w, h, rng((o.seed || 'manna') + '#grain'), pal[7] ? 0.035 : 0.03);   // own randomness: size doesn't change the picture
  const env = { g, w, h, r, pal, S };
  SAFE = o.text ? textLayout(env, o.text, motif).bottom + 18 * S : 0;   // sun/moon stay below the words
  if (!pal[7] && ['mountains', 'path', 'tree', 'seedling', 'waves'].includes(motif) && r() < 0.5) clouds(env);
  ({ mountains, water, enso, tree, seedling, rain, sunrise, path, birds, candle, waves })[motif](env);
  if (['mountains', 'path', 'tree', 'water', 'waves'].includes(motif) && r() < 0.3) farBirds(env);
  if (o.text) words(env, o.text, o.ref, motif);
  if (o.mark) {   // small "Manna" mark, bottom right; light or dark depending on what's behind it
    const px = g.getImageData(Math.round(w - 180 * S), Math.round(h - 70 * S), Math.round(150 * S), Math.round(50 * S)).data;
    let lum = 0; for (let i = 0; i < px.length; i += 4) lum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    lum /= px.length / 4;
    g.save(); g.globalAlpha = 0.6; g.fillStyle = lum < 140 ? '#FFFFFF' : '#2A241F'; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.font = `italic 600 ${30 * S}px "Noto Serif", Georgia, serif`; g.fillText('Manna', w - 34 * S, h - 30 * S); g.restore();
  }
  return { motif, palette: Object.keys(P).find(k => P[k] === pal) };
}
function clouds(e) {
  const { g, w, h, r, pal, S } = e; g.save(); g.fillStyle = '#FFFFFF';
  for (let i = 0, n = 2 + Math.floor(r() * 4); i < n; i++) { g.globalAlpha = 0.25 + r() * 0.25; g.beginPath(); g.ellipse(w * r(), h * (0.52 + r() * 0.14), w * (0.06 + r() * 0.16), (3 + r() * 5) * S, 0, 0, 7); g.fill(); }
  g.restore();
}
function farBirds(e) {
  const { g, w, h, r, pal, S } = e; g.save(); g.strokeStyle = pal[4]; g.globalAlpha = 0.6; g.lineWidth = 1.5 * S; g.lineCap = 'round';
  const bx = w * (0.15 + r() * 0.6), by = h * (0.54 + r() * 0.08);
  for (let i = 0, n = 2 + Math.floor(r() * 3); i < n; i++) { const x = bx + i * (18 + r() * 16) * S, y = by + (r() - .5) * 18 * S, s2 = (5 + r() * 3) * S;
    g.beginPath(); g.moveTo(x - s2, y - s2 * .3); g.quadraticCurveTo(x - s2 * .4, y - s2 * .6, x, y); g.quadraticCurveTo(x + s2 * .4, y - s2 * .6, x + s2, y - s2 * .3); g.stroke(); }
  g.restore();
}
function grain(g, w, h, r, a) {   // faint paper texture
  g.save(); g.globalAlpha = a; g.fillStyle = '#000';
  for (let i = 0; i < (w * h) / 900; i++) g.fillRect(r() * w, r() * h, 1.2, 1.2);
  g.restore();
}
let SAFE = 0;
function glow(g, x, y, rad, col, a = 1) {
  if (y - rad * 2.2 < SAFE) y = SAFE + rad * 2.2;   // never behind the verse
  g.save(); g.globalAlpha = a;
  const gr = g.createRadialGradient(x, y, rad * 0.2, x, y, rad * 2.6); gr.addColorStop(0, col + '55'); gr.addColorStop(1, col + '00');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad * 2.6, 0, 7); g.fill();
  g.globalAlpha = a * 0.92; g.fillStyle = col; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); g.restore();
}
function ridge(e, base, amp, col, rough = 0.55) {   // a mountain line by midpoint displacement
  const { g, w, h, r } = e; let pts = [base + (r() - .5) * amp, base + (r() - .5) * amp];
  let disp = amp;
  for (let k = 0; k < 7; k++) { const n = [pts[0]]; for (let i = 1; i < pts.length; i++) { n.push((pts[i - 1] + pts[i]) / 2 + (r() - .5) * disp, pts[i]); } pts = n; disp *= rough; }
  g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
  pts.forEach((y, i) => g.lineTo((i / (pts.length - 1)) * w, y)); g.lineTo(w, h); g.closePath(); g.fill();
}
function mountains(e) {
  const { g, w, h, r, pal } = e;
  glow(g, w * (0.25 + r() * 0.5), h * (0.5 + r() * 0.08), e.S * (40 + r() * 30), pal[5]);
  ridge(e, h * 0.66, h * 0.16, pal[2]);
  g.save(); g.globalAlpha = .35; g.fillStyle = pal[1]; g.fillRect(0, h * 0.68, w, h * 0.05); g.restore();   // mist
  ridge(e, h * 0.76, h * 0.12, pal[3]);
  ridge(e, h * 0.87, h * 0.08, pal[4], 0.5);
}
function water(e) {
  const { g, w, h, r, pal, S } = e; const hz = h * (0.7 + r() * 0.06), mx = w * (0.3 + r() * 0.4), my = h * (0.5 + r() * 0.06), mr = S * (34 + r() * 20);
  glow(g, mx, my, mr, pal[5]);
  ridge(e, hz - h * 0.02, h * 0.05, pal[2], 0.45);
  const wt = g.createLinearGradient(0, hz, 0, h); wt.addColorStop(0, pal[3]); wt.addColorStop(1, pal[4]);
  g.fillStyle = wt; g.fillRect(0, hz, w, h - hz);
  g.fillStyle = pal[5];   // broken reflection
  for (let y = hz + 6 * S, i = 0; y < h * 0.98; y += (7 + i * 1.3) * S, i++) {
    const len = mr * (1.6 - i * 0.07) * (0.6 + r() * 0.6); if (len <= 2) break;
    g.globalAlpha = Math.max(0.05, 0.55 - i * 0.035); g.fillRect(mx - len / 2 + (r() - .5) * 10 * S, y, len, 2.2 * S);
  }
  g.globalAlpha = 0.25; g.strokeStyle = pal[1]; g.lineWidth = 1.4 * S;
  for (let i = 0; i < 9; i++) { const y = hz + (h - hz) * r(), x = w * r(), l = w * (0.05 + r() * 0.12); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke(); }
  g.globalAlpha = 1;
}
function enso(e) {
  const { g, w, h, r, pal, S } = e; const cx = w * 0.5, cy = h * 0.72, R = Math.min(w, h) * (0.2 + r() * 0.04), ink = pal[7] ? pal[5] : pal[4];
  const start = r() * Math.PI * 2, sweep = Math.PI * (1.78 + r() * 0.12);
  g.save(); g.strokeStyle = ink; g.lineCap = 'round';
  for (let i = 0; i < 160; i++) {   // brush: thick then trailing off, with dry streaks
    const t = i / 160, a = start + sweep * t, wd = S * (26 * (1 - t * 0.75)) * (0.75 + r() * 0.35);
    g.globalAlpha = 0.85 - t * 0.35; g.lineWidth = wd;
    g.beginPath(); g.arc(cx + (r() - .5) * 2 * S, cy + (r() - .5) * 2 * S, R + (r() - .5) * 5 * S, a, a + sweep / 150); g.stroke();
  }
  g.restore();
  glow(g, cx + R * 0.95, cy - R * 1.25, S * 10, pal[5], 0.9);
}
function branch(e, x, y, ang, len, wd, d) {
  const { g, r } = e; const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (r() - .5) * len * .3, (y + y2) / 2, x2, y2); g.stroke();
  if (d <= 0 || len < 6) { g.save(); g.fillStyle = e.pal[3]; g.globalAlpha = .7; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x2 + (r() - .5) * 18 * e.S, y2 + (r() - .5) * 14 * e.S, (3 + r() * 5) * e.S, 0, 7); g.fill(); } g.restore(); return; }
  const n = 2 + (r() < .3 ? 1 : 0);
  for (let i = 0; i < n; i++) branch(e, x2, y2, ang + (r() - .5) * 1.2, len * (0.62 + r() * 0.16), wd * 0.66, d - 1);
}
function tree(e) {
  const { g, w, h, r, pal, S } = e; const gx = w * (0.28 + r() * 0.44), gy = h * 0.84;
  glow(g, w * (0.2 + r() * 0.6), h * (0.46 + r() * 0.08), S * (48 + r() * 24), pal[5], 0.85);
  g.fillStyle = pal[2]; g.beginPath(); g.ellipse(gx, h * 0.98, w * 0.75, h * 0.15, 0, Math.PI, 0); g.fill(); g.fillRect(0, h * 0.975, w, h * 0.03);
  g.strokeStyle = pal[7] ? pal[2] : pal[4]; g.lineCap = 'round';
  branch(e, gx, gy, -Math.PI / 2 + (r() - .5) * .25, h * 0.095, S * 16, 6);
}
function seedling(e) {
  const { g, w, h, r, pal, S } = e; const x = w * (0.4 + r() * 0.2), y = h * 0.86;
  glow(g, w * (0.65 + r() * 0.15), h * (0.5 + r() * 0.06), S * (22 + r() * 14), pal[5], 0.8);
  g.fillStyle = pal[2]; g.beginPath(); g.ellipse(w / 2, h * 1.02, w * 0.8, h * 0.17, 0, Math.PI, 0); g.fill();
  g.fillStyle = pal[3]; g.beginPath(); g.ellipse(x, y + 4 * S, 46 * S, 12 * S, 0, Math.PI, 0); g.fill();
  g.strokeStyle = pal[4]; g.lineWidth = 4 * S; g.lineCap = 'round';
  const top = y - h * (0.06 + r() * 0.025);
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 10 * S, (y + top) / 2, x, top); g.stroke();
  g.fillStyle = pal[4];
  const leaf = (dir, sc) => { g.save(); g.translate(x, top); g.rotate(dir * (0.6 + r() * 0.3)); g.beginPath(); g.ellipse(dir * 22 * S * sc, 0, 24 * S * sc, 9 * S * sc, 0, 0, 7); g.fill(); g.restore(); };
  leaf(-1, 1); leaf(1, 0.85 + r() * 0.3);
}
function rain(e) {
  const { g, w, h, r, pal, S } = e; const hz = h * 0.78;
  g.save(); g.strokeStyle = pal[4]; g.lineWidth = 1.3 * S; const sl = 0.12 + r() * 0.12;
  for (let i = 0; i < 110; i++) { const x = r() * w * 1.2, y = h * (0.04 + r() * 0.7), l = (16 + r() * 34) * S; g.globalAlpha = 0.1 + r() * 0.22; g.beginPath(); g.moveTo(x, y); g.lineTo(x - l * sl, y + l); g.stroke(); }
  g.restore();
  const wt = g.createLinearGradient(0, hz, 0, h); wt.addColorStop(0, pal[2]); wt.addColorStop(1, pal[3]); g.fillStyle = wt; g.fillRect(0, hz, w, h - hz);
  g.save(); g.strokeStyle = pal[0]; g.lineWidth = 1.6 * S;
  for (let k = 0; k < 7; k++) { const x = w * r(), y = hz + (h - hz) * (0.15 + r() * 0.75), rr = (16 + r() * 50) * S; for (let j = 0; j < 3; j++) { g.globalAlpha = 0.5 - j * 0.15; g.beginPath(); g.ellipse(x, y, rr * (1 + j * .6), rr * (1 + j * .6) * 0.22, 0, 0, 7); g.stroke(); } }
  g.restore();
}
function sunrise(e) {
  const { g, w, h, r, pal, S } = e; const hz = h * (0.8 + r() * 0.05), cx = w * (0.35 + r() * 0.3), R = S * (90 + r() * 50);
  g.save(); g.strokeStyle = pal[5]; g.lineWidth = 2 * S;
  for (let i = 0; i < 13; i++) { const a = Math.PI + (i + .5) * Math.PI / 13; g.globalAlpha = 0.18; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 1.3, hz + Math.sin(a) * R * 1.3); g.lineTo(cx + Math.cos(a) * R * 2.6, hz + Math.sin(a) * R * 2.6); g.stroke(); }
  g.restore();
  glow(g, cx, hz, R, pal[5]);
  g.fillStyle = pal[3]; g.fillRect(0, hz, w, h - hz);
  g.save(); g.fillStyle = pal[0];
  for (let i = 0; i < 5; i++) { g.globalAlpha = 0.5; g.beginPath(); g.ellipse(w * r(), h * (0.55 + r() * 0.18), w * (0.08 + r() * 0.14), 5 * S, 0, 0, 7); g.fill(); }
  g.fillStyle = pal[5]; for (let y = hz + 8 * S, i = 0; y < h; y += 9 * S, i++) { g.globalAlpha = 0.35 - i * 0.03; if (g.globalAlpha <= 0) break; const l = R * 1.8 * (1 - i * 0.08) * (0.7 + r() * 0.4); g.fillRect(cx - l / 2, y, l, 2.4 * S); }
  g.restore();
}
function path(e) {
  const { g, w, h, r, pal, S } = e;
  const hz = h * (0.66 + r() * 0.1);
  glow(g, w * (0.15 + r() * 0.7), h * (0.5 + r() * 0.12), S * (24 + r() * 30), pal[5], 0.85);
  if (r() < .6) ridge(e, hz - h * (0.02 + r() * 0.05), h * (0.03 + r() * 0.08), pal[2], 0.4 + r() * 0.2);
  const t1 = (r() - .5) * h * .08, t2 = (r() - .5) * h * .08;
  g.fillStyle = pal[3]; g.beginPath(); g.moveTo(0, h); g.lineTo(0, hz + t1); g.bezierCurveTo(w * .3, hz + t2, w * .7, hz - t1, w, hz + t2 * .5); g.lineTo(w, h); g.fill();
  const vx = w * (0.25 + r() * 0.5), vy = hz + h * 0.01, b1 = (r() - .5) * w * .7, b2 = (r() - .5) * w * .7, ex = w * (0.25 + r() * 0.35), wid = w * (0.22 + r() * 0.16);
  g.fillStyle = pal[0]; g.globalAlpha = 0.85; g.beginPath();
  g.moveTo(vx - 2 * S, vy); g.bezierCurveTo(vx + b1, vy + (h - vy) * .35, vx + b2, vy + (h - vy) * .7, ex, h); g.lineTo(ex + wid, h);
  g.bezierCurveTo(vx + b2 + wid * .6, vy + (h - vy) * .7, vx + b1 + wid * .25, vy + (h - vy) * .35, vx + 2 * S, vy); g.fill(); g.globalAlpha = 1;
  if (r() < .55) {   // a lone tree beside the path
    const tx = r() < .5 ? w * (0.08 + r() * 0.2) : w * (0.72 + r() * 0.2), ty = hz + (h - hz) * (0.25 + r() * 0.3);
    g.strokeStyle = pal[4]; g.lineCap = 'round'; branch(e, tx, ty, -Math.PI / 2, h * (0.035 + r() * 0.025), S * 6, 4);
  }
}
function birds(e) {
  const { g, w, h, r, pal, S } = e;
  glow(g, w * (0.2 + r() * 0.6), h * (0.55 + r() * 0.05), S * (26 + r() * 18), pal[5], 0.8);
  ridge(e, h * 0.8, h * 0.07, pal[2], 0.5); ridge(e, h * 0.9, h * 0.04, pal[3], 0.5);
  g.strokeStyle = pal[4]; g.lineCap = 'round'; const n = 3 + Math.floor(r() * 4), bx = w * (0.2 + r() * 0.4), by = h * (0.6 + r() * 0.08);
  for (let i = 0; i < n; i++) {
    const x = bx + i * (36 + r() * 30) * S + r() * 20 * S, y = by - i * (12 + r() * 16) * S + r() * 14 * S, s = (9 + r() * 7) * S;
    g.lineWidth = 2.2 * S; g.beginPath(); g.moveTo(x - s, y - s * .35); g.quadraticCurveTo(x - s * .4, y - s * .6, x, y); g.quadraticCurveTo(x + s * .4, y - s * .6, x + s, y - s * .35); g.stroke();
  }
}
function candle(e) {
  const { g, w, h, r, pal, S } = e; const x = w * 0.5, base = h * 0.92, ch = h * (0.13 + r() * 0.04), cw = 46 * S;
  const halo = g.createRadialGradient(x, base - ch - 30 * S, 10 * S, x, base - ch - 30 * S, h * 0.42);
  halo.addColorStop(0, pal[5] + '40'); halo.addColorStop(1, pal[5] + '00'); g.fillStyle = halo; g.fillRect(0, 0, w, h);
  g.fillStyle = pal[2]; g.fillRect(0, base, w, h - base);
  const body = g.createLinearGradient(x - cw / 2, 0, x + cw / 2, 0); body.addColorStop(0, pal[5] + 'CC'); body.addColorStop(1, pal[5] + '77');
  g.fillStyle = body; g.beginPath(); g.roundRect ? g.roundRect(x - cw / 2, base - ch, cw, ch, 6 * S) : g.rect(x - cw / 2, base - ch, cw, ch); g.fill();
  g.strokeStyle = pal[4]; g.lineWidth = 2.4 * S; g.beginPath(); g.moveTo(x, base - ch); g.lineTo(x, base - ch - 10 * S); g.stroke();
  const fy = base - ch - 12 * S, fh = (44 + r() * 10) * S, lean = (r() - .5) * 8 * S;
  g.fillStyle = '#FFE6B0'; g.beginPath(); g.moveTo(x, fy); g.bezierCurveTo(x - 15 * S, fy - fh * .3, x - 5 * S + lean, fy - fh * .8, x + lean, fy - fh); g.bezierCurveTo(x + 5 * S + lean, fy - fh * .8, x + 15 * S, fy - fh * .3, x, fy); g.fill();
}
function waves(e) {
  const { g, w, h, r, pal, S } = e;
  glow(g, w * (0.25 + r() * 0.5), h * (0.58 + r() * 0.04), S * (34 + r() * 20), pal[5], 0.85);
  const cols = [pal[2], pal[3], pal[4]];
  cols.forEach((c, k) => {
    const base = h * (0.7 + k * 0.08), amp = (10 + k * 8) * S * (0.8 + r() * 0.5), fq = (2 + r() * 2 + k) * Math.PI / w, ph = r() * 7;
    g.fillStyle = c; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) g.lineTo(x, base + Math.sin(x * fq + ph) * amp + Math.sin(x * fq * 2.3 + ph) * amp * .3);
    g.lineTo(w, h); g.fill();
    g.save(); g.strokeStyle = pal[0]; g.globalAlpha = 0.35; g.lineWidth = 1.6 * S; g.beginPath();
    for (let x = 0; x <= w; x += 4) { const y = base + Math.sin(x * fq + ph) * amp + Math.sin(x * fq * 2.3 + ph) * amp * .3; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke(); g.restore();
  });
}
/* the verse, set in the calm upper part of the picture */
function textLayout(e, text, motif) {
  const { g, w, h, S } = e;
  const maxW = w * 0.8, top = h * 0.1, bottom = h * (motif === 'enso' ? 0.46 : 0.5);
  let size = 70 * S, lines;
  for (; size > 26 * S; size -= 2 * S) {
    g.font = `400 ${size}px ${SERIF}`; lines = wrap(g, text, maxW);
    if (lines.length * size * 1.42 + size * 1.6 <= bottom - top) break;
  }
  g.font = `400 ${size}px ${SERIF}`; lines = wrap(g, text, maxW);
  const lh = size * 1.42, block = lines.length * lh + size * 1.5;
  const y0 = top + Math.max(0, (bottom - top - block) / 2) + size;
  return { size, lines, lh, y0, bottom: y0 - size + block + size * 0.4 };
}
const SERIF = '"Noto Serif", Georgia, "Times New Roman", serif', SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
function words(e, text, ref, motif) {
  const { g, w, pal, S } = e;
  const L = textLayout(e, text, motif); let y = L.y0;
  g.font = `400 ${L.size}px ${SERIF}`;
  g.fillStyle = pal[6]; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  if (pal[7]) { g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 8 * S; }
  for (const ln of L.lines) { g.fillText(ln, w / 2, y); y += L.lh; }
  g.shadowBlur = 0;
  if (ref) { g.font = `600 ${Math.max(22 * S, L.size * 0.5)}px ${SANS}`; g.globalAlpha = 0.75; if ('letterSpacing' in g) g.letterSpacing = `${2 * S}px`; g.fillText(ref.toUpperCase(), w / 2, y + L.size * 0.25); g.globalAlpha = 1; if ('letterSpacing' in g) g.letterSpacing = '0px'; }
}
function wrap(g, text, maxW) {
  const out = []; let line = '';
  for (const wd of text.split(/\s+/)) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > maxW && line) { out.push(line); line = wd; } else line = t; }
  if (line) out.push(line); return out;
}
window.MannaArt = { draw, THEMES: Object.keys(THEME), MOTIFS: Object.keys(PAL) };
})();
