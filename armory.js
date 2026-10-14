/* Manna · Armory: prayers by category and guided chaplets. Loaded only when the Armory tab is opened. */
(() => {
'use strict';
let A, DATA = null;
const P = {
  cross: 'In the name of the Father, and of the Son, and of the Holy Spirit. Amen.',
  creed: 'I believe in God, the Father almighty, Creator of heaven and earth; and in Jesus Christ, His only Son, our Lord, who was conceived by the Holy Spirit, born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died, and was buried. He descended into hell; on the third day He rose again from the dead; He ascended into heaven, and is seated at the right hand of God the Father almighty; from there He will come to judge the living and the dead.\nI believe in the Holy Spirit, the holy catholic Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and life everlasting. Amen.',
  our: 'Our Father, who art in heaven, hallowed be Thy name; Thy kingdom come; Thy will be done on earth as it is in heaven.\nGive us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.',
  hail: 'Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus.\nHoly Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.',
  glory: 'Glory be to the Father, and to the Son, and to the Holy Spirit. As it was in the beginning, is now, and ever shall be, world without end. Amen.',
  fatima: 'O my Jesus, forgive us our sins, save us from the fires of hell; lead all souls to heaven, especially those most in need of Thy mercy.',
  queen: 'Hail, holy Queen, Mother of mercy, our life, our sweetness and our hope. To thee do we cry, poor banished children of Eve; to thee do we send up our sighs, mourning and weeping in this valley of tears. Turn then, most gracious advocate, thine eyes of mercy toward us; and after this our exile, show unto us the blessed fruit of thy womb, Jesus. O clement, O loving, O sweet Virgin Mary.\nV. Pray for us, O holy Mother of God.\nR. That we may be made worthy of the promises of Christ.',
  rosaryClose: 'Let us pray. O God, whose only begotten Son, by His life, death, and resurrection, has purchased for us the rewards of eternal life; grant, we beseech Thee, that by meditating upon these mysteries of the Most Holy Rosary of the Blessed Virgin Mary, we may imitate what they contain and obtain what they promise, through the same Christ our Lord. Amen.',
  contrition: 'O my God, I am heartily sorry for having offended Thee, and I detest all my sins because of Thy just punishments, but most of all because they offend Thee, my God, who art all good and deserving of all my love. I firmly resolve, with the help of Thy grace, to sin no more and to avoid the near occasions of sin. Amen.',
  deus: 'O God, come to my assistance.\nO Lord, make haste to help me.'
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
    ['The Coronation of Mary', 'Revelation 12:1-6', "Trust in Mary's intercession"]] }
};
const DAY_MYST = { Sun: 'glorious', Mon: 'joyful', Tue: 'sorrowful', Wed: 'glorious', Thu: 'luminous', Fri: 'sorrowful', Sat: 'joyful' };
const ORD = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth'];
const SORROWS = [
  ['The Prophecy of Simeon', 'Luke 2:34-35'], ['The Flight into Egypt', 'Matthew 2:13-15'],
  ['The Loss of the Child Jesus in the Temple', 'Luke 2:43-45'], ['Mary Meets Jesus on the Way to Calvary', 'Luke 23:27-28'],
  ['The Crucifixion and Death of Jesus', 'John 19:25-30'], ['Jesus Is Taken Down from the Cross', 'John 19:38-40'],
  ['The Burial of Jesus', 'John 19:40-42']];
const CHOIRS = [
  ['Seraphim', 'may the Lord make us worthy to burn with the fire of perfect charity.'],
  ['Cherubim', 'may the Lord grant us the grace to leave the ways of sin and run in the paths of Christian perfection.'],
  ['Thrones', 'may the Lord infuse into our hearts a true and sincere spirit of humility.'],
  ['Dominations', 'may the Lord give us grace to govern our senses and overcome any unruly passions.'],
  ['Powers', 'may the Lord protect our souls against the snares and temptations of the devil.'],
  ['Virtues', 'may the Lord preserve us from evil and falling into temptation.'],
  ['Principalities', 'may God fill our souls with a true spirit of obedience.'],
  ['Archangels', 'may the Lord give us perseverance in faith and in all good works, in order that we may attain the glory of Heaven.'],
  ['Angels', 'may the Lord grant us to be protected by them in this mortal life and conducted in the life to come to Heaven.']];

/* A chaplet is a list of groups; each group is a list of steps. Groups power "skip to next" and "jump to". */
function hailBeads(n, title, sub) { return Array.from({ length: n }, (_, i) => ({ t: title || 'Hail Mary', sub: `${sub ? sub + ' · ' : ''}${i + 1} of ${n}`, p: P.hail, beads: [n, i + 1] })); }
function build(id, set) {
  const G = [];
  if (id === 'rosary') {
    const M = MYST[set];
    G.push({ title: 'Opening prayers', steps: [{ t: 'Sign of the Cross', p: P.cross }, { t: "Apostles' Creed", p: P.creed }, { t: 'Our Father', p: P.our },
      ...['for an increase of faith', 'for an increase of hope', 'for an increase of charity'].map((x, i) => ({ t: 'Hail Mary', sub: `${i + 1} of 3 · ${x}`, p: P.hail, beads: [3, i + 1] })),
      { t: 'Glory Be', p: P.glory }] });
    M.list.forEach((m, d) => G.push({ title: `${ORD[d]} Mystery: ${m[0]}`, steps: [
      { t: `${ORD[d]} ${M.name.replace('Mysteries', 'Mystery')}`, mystery: m },
      { t: 'Our Father', sub: m[0], p: P.our, beads: [10, 0] },
      ...hailBeads(10, 'Hail Mary', m[0]),
      { t: 'Glory Be', sub: m[0], p: P.glory }, { t: 'O My Jesus', sub: m[0], p: P.fatima }] }));
    G.push({ title: 'Closing prayers', steps: [{ t: 'Hail, Holy Queen', p: P.queen }, { t: 'Closing Prayer', p: P.rosaryClose }, { t: 'Sign of the Cross', p: P.cross }] });
  } else if (id === 'sorrows') {
    G.push({ title: 'Opening prayers', steps: [{ t: 'Sign of the Cross', p: P.cross }, { t: 'Act of Contrition', p: P.contrition }, { t: 'Opening Verse', p: P.deus + '\n\n' + P.glory }] });
    SORROWS.forEach((m, d) => G.push({ title: `${ORD[d]} Sorrow: ${m[0]}`, steps: [
      { t: `${ORD[d]} Sorrow`, mystery: [m[0], m[1], null] },
      { t: 'Our Father', sub: m[0], p: P.our, beads: [7, 0] },
      ...hailBeads(7, 'Hail Mary', m[0])] }));
    G.push({ title: "Closing: Mary's tears", steps: [
      ...hailBeads(3, 'Hail Mary', "in honor of Our Lady's tears"),
      { t: 'Closing Prayer', p: 'V. Pray for us, O most sorrowful Virgin.\nR. That we may be made worthy of the promises of Christ.\n\nLet us pray. Lord Jesus, we now implore, both for the present and for the hour of our death, the intercession of the most Blessed Virgin Mary, Your Mother, whose holy soul was pierced at the time of Your passion by a sword of grief. Grant us this favor, O Savior of the world, who lives and reigns with the Father and the Holy Spirit, forever and ever. Amen.' },
      { t: 'Sign of the Cross', p: P.cross }] });
  } else if (id === 'michael') {
    G.push({ title: 'Opening', steps: [{ t: 'Sign of the Cross', p: P.cross }, { t: 'Opening Verse', p: P.deus + '\n\n' + P.glory }] });
    CHOIRS.forEach((c, d) => G.push({ title: `${ORD[d]} Salutation: ${c[0]}`, steps: [
      { t: `${ORD[d]} Salutation`, sub: `Choir of ${c[0]}`, p: `By the intercession of St. Michael and the celestial Choir of ${c[0]}, ${c[1]} Amen.` },
      { t: 'Our Father', sub: `Choir of ${c[0]}`, p: P.our, beads: [3, 0] },
      ...hailBeads(3, 'Hail Mary', `Choir of ${c[0]}`)] }));
    G.push({ title: 'Four Our Fathers', steps: ['St. Michael', 'St. Gabriel', 'St. Raphael', 'our Guardian Angel'].map((n, i) => ({ t: 'Our Father', sub: `In honor of ${n}`, p: P.our, beads: [4, i + 1] })) });
    G.push({ title: 'Closing prayers', steps: [
      { t: 'Prayer to St. Michael', p: 'O glorious prince St. Michael, chief and commander of the heavenly hosts, guardian of souls, vanquisher of rebel spirits, servant in the house of the Divine King and our admirable conductor, you who shine with excellence and superhuman virtue, deliver us from all evil, who turn to you with confidence, and enable us by your gracious protection to serve God more and more faithfully every day.\n\nV. Pray for us, O glorious St. Michael, Prince of the Church of Jesus Christ.\nR. That we may be made worthy of His promises.' },
      { t: 'Closing Prayer', p: 'Almighty and Everlasting God, who, by a prodigy of goodness and a merciful desire for the salvation of all men, has appointed the most glorious Archangel St. Michael Prince of Your Church, make us worthy, we ask You, to be delivered from all our enemies, that none of them may harass us at the hour of death, but that we may be conducted by him into Your Presence. This we ask through the merits of Jesus Christ our Lord. Amen.' },
      { t: 'Sign of the Cross', p: P.cross }] });
  } else if (id === 'mercy') {
    const EF = 'Eternal Father, I offer You the Body and Blood, Soul and Divinity of Your dearly beloved Son, our Lord Jesus Christ, in atonement for our sins and those of the whole world.';
    const SP = 'For the sake of His sorrowful Passion, have mercy on us and on the whole world.';
    G.push({ title: 'Opening prayers', steps: [{ t: 'Sign of the Cross', p: P.cross }, { t: 'Our Father', p: P.our }, { t: 'Hail Mary', p: P.hail }, { t: "Apostles' Creed", p: P.creed }] });
    for (let d = 0; d < 5; d++) G.push({ title: `${ORD[d]} Decade`, steps: [
      { t: 'Eternal Father', sub: `${ORD[d]} decade`, p: EF, beads: [10, 0] },
      ...Array.from({ length: 10 }, (_, i) => ({ t: 'For the sake of His sorrowful Passion', sub: `${ORD[d]} decade · ${i + 1} of 10`, p: SP, beads: [10, i + 1] }))] });
    G.push({ title: 'Closing', steps: [1, 2, 3].map(i => ({ t: 'Holy God', sub: `${i} of 3`, p: 'Holy God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world.', beads: [3, i] })).concat([{ t: 'Sign of the Cross', p: P.cross }]) });
  }
  const steps = []; G.forEach((g, gi) => g.steps.forEach(s => { s.g = gi; steps.push(s); }));
  return { groups: G, steps };
}
const CH_NAMES = { rosary: 'The Holy Rosary', sorrows: 'Seven Sorrows Rosary', michael: 'Chaplet of St. Michael', mercy: 'Divine Mercy Chaplet' };

async function loadData() {
  if (DATA) return DATA;
  DATA = await (await fetch('data/prayers.json')).json();
  return DATA;
}

/* ---------- screens ---------- */
async function home() {
  const d = await loadData();
  const { view, esc } = A;
  const today = DAY_MYST[A.manilaWeekday()];
  let html = `<div class="card arm-hero"><div class="eyebrow">Today's Rosary</div><div class="mystery">${esc(MYST[today].name)}</div>
      <button class="btn primary block" data-chap="rosary" data-set="${today}">Pray the Rosary</button></div>`;
  html += `<h3 class="eyebrow" style="margin:20px 2px 8px">⚔️ Chaplets & Rosaries</h3><div class="armgrid">
    <button class="armtile" data-chap="rosary-pick"><b>The Holy Rosary</b><span>Choose the mysteries</span></button>
    ${['sorrows', 'michael', 'mercy'].map(id => `<button class="armtile" data-chap="${id}"><b>${esc(CH_NAMES[id])}</b><span>${{ sorrows: '7 sorrows of Our Lady', michael: '9 choirs of angels', mercy: 'Five decades of mercy' }[id]}</span></button>`).join('')}</div>`;
  for (const c of d.categories) {
    if (c.id === 'chaplets') continue;
    const items = d.prayers.filter(p => p.cat === c.id);
    html += `<details class="armcat"><summary><span>${c.icon} ${esc(c.name)}</span><span class="muted small">${items.length}</span></summary>
      ${items.map(p => `<button class="armitem" data-pr="${p.id}">${esc(p.name)}</button>`).join('')}</details>`;
  }
  view.innerHTML = html;
  view.querySelectorAll('[data-chap]').forEach(b => b.onclick = () => {
    const id = b.dataset.chap;
    if (id === 'rosary-pick') return A.go('armory', { pick: true });
    A.go('armory', { chap: id, set: b.dataset.set, step: 0 });
  });
  view.querySelectorAll('[data-pr]').forEach(b => b.onclick = () => A.go('armory', { prayer: b.dataset.pr }));
}
function pickRosary() {
  const { view, esc } = A;
  const today = DAY_MYST[A.manilaWeekday()];
  view.innerHTML = `<button class="btn ghost" id="armBack" style="min-height:40px;margin:4px 0">‹ Armory</button>
    ${Object.entries(MYST).map(([k, M]) => `<div class="card"><div class="eyebrow">${k === today ? "Today's mysteries" : '&nbsp;'}</div>
      <div class="mystery">${esc(M.name)}</div><ol class="mlist">${M.list.map(m => `<li>${esc(m[0])}</li>`).join('')}</ol>
      <button class="btn ${k === today ? 'primary' : 'ghost'} block" data-set="${k}">Pray the ${esc(M.name)}</button></div>`).join('')}
    <p class="muted small">Traditional days: Joyful (Mon, Sat) · Sorrowful (Tue, Fri) · Glorious (Wed, Sun) · Luminous (Thu).</p>`;
  A.$('#armBack').onclick = () => A.go('armory');
  view.querySelectorAll('[data-set]').forEach(b => b.onclick = () => A.go('armory', { chap: 'rosary', set: b.dataset.set, step: 0 }));
}
async function prayer(id) {
  const d = await loadData(); const p = d.prayers.find(x => x.id === id); const { view, esc } = A;
  if (!p) return home();
  const cat = d.categories.find(c => c.id === p.cat);
  view.innerHTML = `<button class="btn ghost" id="armBack" style="min-height:40px;margin:4px 0">‹ Armory</button>
    <div class="card"><div class="eyebrow">${cat ? cat.icon + ' ' + esc(cat.name) : ''}</div><div class="daytitle">${esc(p.name)}</div>
    <p class="prayertext">${esc(p.text)}</p></div>`;
  A.$('#armBack').onclick = () => A.go('armory');
}
function chaplet(id, set, i) {
  const { view, esc, $ } = A;
  const { groups, steps } = build(id, set);
  i = Math.max(0, Math.min(i || 0, steps.length - 1));
  const s = steps[i], g = s.g, title = id === 'rosary' ? MYST[set].name : CH_NAMES[id];
  const pct = Math.round((i + 1) / steps.length * 100);
  const nextGroupStart = g < groups.length - 1 ? steps.findIndex(x => x.g === g + 1) : -1;
  let body;
  if (s.mystery) body = `<div class="mystery">${esc(s.mystery[0])}</div>
      ${s.mystery[2] ? `<p class="muted">Fruit of the mystery: <b>${esc(s.mystery[2])}</b></p>` : ''}
      <div id="mtext"><div class="spinner"></div></div>`;
  else body = `<p class="prayertext">${esc(s.p)}</p>`;
  const beads = s.beads ? `<button class="beads tapbeads" id="beadTap" aria-label="Tap to count the next bead">${Array.from({ length: s.beads[0] }, (_, k) => `<i class="${k < s.beads[1] ? 'on' : ''}"></i>`).join('')}<span class="muted small">tap to count</span></button>` : '';
  view.innerHTML = `<div class="progress"><i style="width:${pct}%"></i></div>
    <div class="chaphead"><span class="eyebrow">${esc(title)} · ${i + 1} of ${steps.length}</span><button class="linkbtn" id="jump">Jump to ▾</button></div>
    <div class="card"><div class="muted small">${esc(groups[g].title)}</div>
      <div class="daytitle">${esc(s.t)}</div>${s.sub ? `<div class="muted small">${esc(s.sub)}</div>` : ''}
      ${beads}${body}</div>
    ${nextGroupStart > 0 ? `<button class="btn ghost block" id="skipNext" style="margin-top:4px">Skip to ${esc(groups[g + 1].title.split(':')[0])} ⏭</button>` : ''}
    <div class="stepnav"><button class="btn ghost" id="rBack">${i ? '‹ Back' : 'Exit'}</button>
      <button class="btn primary" id="rNext">${i === steps.length - 1 ? 'Finish' : 'Next ›'}</button></div>`;
  const goto = n => { chaplet(id, set, n); scrollTo(0, 0); };
  const next = () => {
    if (i === steps.length - 1) { A.toast(`${title} complete. God bless you. 🙏`); A.go('armory'); }
    else goto(i + 1);
  };
  $('#rBack').onclick = () => i ? goto(i - 1) : A.go('armory');
  $('#rNext').onclick = next;
  if ($('#beadTap')) $('#beadTap').onclick = next;
  if ($('#skipNext')) $('#skipNext').onclick = () => goto(nextGroupStart);
  $('#jump').onclick = () => {
    const sh = A.sheet(`<h3>Jump to</h3>${groups.map((gr, gi) => `<button class="armitem${gi === g ? ' cur' : ''}" data-g="${gi}">${esc(gr.title)}</button>`).join('')}`);
    sh.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { sh.remove(); goto(steps.findIndex(x => x.g === +b.dataset.g)); });
  };
  if (s.mystery) (async () => {
    await A.loadMeta(); await A.loadVmap();
    const r = s.mystery[1].match(/^(.+?) (\d+):(\d+)(?:-(\d+))?$/);
    const vs = await A.versesFor({ b: r[1], c: +r[2], v: +r[3], ev: +(r[4] || r[3]) }).catch(() => []);
    const box = $('#mtext'); if (box) box.innerHTML = `<div class="ref" style="font-weight:700;margin:8px 0">${esc(s.mystery[1])}</div>` + (vs.length ? A.versesHTML(vs) : '');
  })();
}

window.MannaArmory = {
  render(opts, api) {
    A = api; opts = opts || {};
    if (opts.chap) return chaplet(opts.chap, opts.set || DAY_MYST[A.manilaWeekday()], opts.step || 0);
    if (opts.pick) return pickRosary();
    if (opts.prayer) return prayer(opts.prayer);
    return home();
  },
  _build: build   // used by tests
};
})();
