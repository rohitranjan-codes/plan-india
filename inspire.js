/* ------------------------------------------------------------------
   Inspiration wall: pictures first, planning second.
   Photo tiles for every destination, mood chips, shuffle, a wishlist
   (hearts) and a "Plan these" bar that seeds the trip builder.
   ------------------------------------------------------------------ */
(function () {
  const A = window.APP, T = window.TRIP;
  const { $, $$, esc, store, t } = A;
  const wall = $('#wall'), chips = $('#wallChips'), bar = $('#wishBar');
  if (!wall) return;
  const wish = new Set(store.get('wish', []));
  let mood = 'all', seed = 0;

  const MOODS = { all: { en: 'Everything', de: 'Alles', icon: '✨' }, beach: { en: 'Sea & sand', de: 'Meer & Sand', icon: '🏖️' }, hills: { en: 'Mountains & tea', de: 'Berge & Tee', icon: '🏔️' }, culture: { en: 'Palaces & temples', de: 'Paläste & Tempel', icon: '🏛️' }, wildlife: { en: 'Tigers & wild', de: 'Tiger & Wildnis', icon: '🐯' }, city: { en: 'Cities & food', de: 'Städte & Essen', icon: '🍛' }, best: { en: 'Best this month', de: 'Beste diesen Monat', icon: '📅' } };
  const label = (m) => A.LANG.cur === 'de' ? m.de : m.en;

  // deterministic shuffle so the wall changes on "Surprise me" but stays stable otherwise
  const order = (list) => { const s = seed; return list.map((d, i) => ({ d, k: ((i + 1) * 9301 + s * 49297) % 233280 })).sort((a, b) => a.k - b.k).map((x) => x.d); };

  function renderChips() {
    chips.innerHTML = Object.entries(MOODS).map(([k, m]) => `<button class="filter ${mood === k ? 'active' : ''}" data-mood="${k}">${m.icon} ${esc(label(m))}</button>`).join('') + `<button class="filter shuffle" id="wallShuffle">🎲 ${A.LANG.cur === 'de' ? 'Überrasch mich' : 'Surprise me'}</button>`;
  }
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'wallShuffle') { seed++; render(); return; }
    mood = b.dataset.mood; render();
  });

  function render() {
    renderChips();
    const mr = A.monthRating || (() => 2);
    let list = T.destinations.filter((d) => mood === 'all' || (mood === 'best' ? mr(d) === 3 : d.type === mood));
    list = seed ? order(list) : list.slice().sort((a, b) => mr(b) - mr(a) || (b.comfort.score - a.comfort.score));
    wall.innerHTML = list.map((d, i) => {
      const p = window.photoOf && window.photoOf(d.id);
      const big = i % 7 === 0 || i % 7 === 4;
      return `<figure class="tile ${big ? 'big' : ''}" data-id="${d.id}" style="--i:${i % 12}">
        ${p ? `<img src="${p.src}" alt="${esc(d.name)}" loading="lazy">` : (window.sceneSVG ? window.sceneSVG(d.id, d.type, d.hue) : '')}
        <button class="heart ${wish.has(d.id) ? 'on' : ''}" data-wish="${d.id}" aria-label="Save ${esc(d.name)}">${wish.has(d.id) ? '♥' : '♡'}</button>
        <figcaption><span class="tile-region">${esc((T.regions || {})[d.region] || d.region)}</span><b>${d.emoji} ${esc(d.name)}</b><small>${esc(d.tag)}</small>${A.monthBadge ? A.monthBadge(d) : ''}</figcaption>
      </figure>`;
    }).join('');
    renderBar();
  }
  wall.addEventListener('click', (e) => {
    const h = e.target.closest('.heart');
    if (h) { e.stopPropagation(); toggle(h.dataset.wish); return; }
    const f = e.target.closest('.tile'); if (f) A.openDest(f.dataset.id);
  });
  function toggle(id) {
    wish.has(id) ? wish.delete(id) : wish.add(id);
    store.set('wish', [...wish]);
    $$(`.heart[data-wish="${id}"]`, wall).forEach((h) => { h.classList.toggle('on', wish.has(id)); h.textContent = wish.has(id) ? '♥' : '♡'; });
    renderBar();
  }
  function renderBar() {
    const n = wish.size;
    bar.hidden = n === 0;
    if (!n) return;
    const names = [...wish].map((id) => T.destinations.find((d) => d.id === id)).filter(Boolean);
    bar.innerHTML = `<div class="wish-thumbs">${names.slice(0, 6).map((d) => { const p = window.photoOf && window.photoOf(d.id); return p ? `<img src="${p.src}" alt="" title="${esc(d.name)}">` : `<span>${d.emoji}</span>`; }).join('')}${n > 6 ? `<i>+${n - 6}</i>` : ''}</div>
      <div class="wish-text"><b>${n} ${A.LANG.cur === 'de' ? (n === 1 ? 'Ort gemerkt' : 'Orte gemerkt') : (n === 1 ? 'place saved' : 'places saved')}</b><small>${esc(names.map((d) => d.name).join(' · '))}</small></div>
      <button class="btn btn-primary" id="wishPlan">${A.LANG.cur === 'de' ? 'Daraus einen Plan machen' : 'Plan these'} →</button>
      <button class="btn btn-ghost" id="wishClear">✕</button>`;
    $('#wishPlan').addEventListener('click', planFromWish);
    $('#wishClear').addEventListener('click', () => { wish.clear(); store.set('wish', []); render(); });
  }
  /* Order the saved places by nearest-neighbour from the gateway, give each its suggested nights, hand to the builder */
  function planFromWish() {
    const G = window.GEO, gd = A.gatewayDest && A.gatewayDest(); if (!G || !gd) return;
    let rest = [...wish].map((id) => T.destinations.find((d) => d.id === id)).filter((d) => d && d.id !== gd.id);
    const back = A.gateway2 ? A.gateway2() : null;
    const endD = back && back.code !== (A.gateway && A.gateway().code) ? T.destinations.find((d) => d.id === back.dest) : gd;
    // nearest-neighbour start, then 2-opt on the open path gateway → … → end
    const ordered = []; let cur = gd;
    while (rest.length) { rest.sort((a, b) => G.km(cur, a) - G.km(cur, b)); cur = rest.shift(); ordered.push(cur); }
    const path = [gd, ...ordered, endD];
    const len = (p) => p.reduce((a, x, i) => i ? a + G.km(p[i - 1], x) : 0, 0);
    let improved = true;
    while (improved) { improved = false; for (let i = 1; i < path.length - 2; i++) for (let j = i + 1; j < path.length - 1; j++) { const cand = path.slice(0, i).concat(path.slice(i, j + 1).reverse(), path.slice(j + 1)); if (len(cand) + 1 < len(path)) { path.splice(0, path.length, ...cand); improved = true; } } }
    ordered.splice(0, ordered.length, ...path.slice(1, -1));
    const plan = [{ id: gd.id, nights: 2 }, ...ordered.map((d) => ({ id: d.id, nights: parseInt(d.nights) || 2 }))];
    if (endD.id === gd.id) plan.push({ id: gd.id, nights: 1 }); else if (!ordered.some((d) => d.id === endD.id)) plan.push({ id: endD.id, nights: 1 });
    if (window.setPlan) window.setPlan(plan);
    $('#settings').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => $('#builder').scrollIntoView({ behavior: 'smooth' }), 900);
  }
  render();
  addEventListener('langchange', render); addEventListener('settingschange', render);
})();
