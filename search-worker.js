/* Searches one book at a time so memory stays small; the worker is closed after each search. */
self.onmessage = async e => {
  const { words, trans, books, max } = e.data;
  let found = 0;
  // match whole words (or word beginnings: "fruit" also finds "fruits"), not letters inside other words
  const rxs = words.map(w => new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  try {
    for (let b = 0; b < books; b++) {
      const r = await fetch(`data/${trans}/${b}.json`);
      if (!r.ok) throw new Error('Some books are not saved offline yet. Connect to the internet and try again.');
      const book = await r.json();
      const hits = [];
      for (let c = 0; c < book.length && found < max; c++) {
        const ch = book[c];
        for (let v = 0; v < ch.length; v++) {
          if (rxs.every(rx => rx.test(ch[v]))) {
            hits.push({ b, c: c + 1, v: v + 1, t: ch[v] });
            if (++found >= max) break;
          }
        }
      }
      if (hits.length) self.postMessage({ type: 'hits', hits });
      self.postMessage({ type: 'progress', done: b + 1, total: books });
      if (found >= max) { self.postMessage({ type: 'done', capped: true }); return; }
    }
    self.postMessage({ type: 'done', capped: false });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
