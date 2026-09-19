/* ------------------------------------------------------------------
   Festival & events ticker + per-stop warnings.
   Reads window.EVENTS, the trip dates and the plan.
   ------------------------------------------------------------------ */
(function () {
  const A = window.APP, T = window.TRIP, EV = window.EVENTS || [];
  const { $, $$, esc, store, t } = A;
  const KIND = { celebrate: { icon: '🎉', cls: 'celebrate', en: 'Celebrate', de: 'Feiern' }, caution: { icon: '⚠️', cls: 'caution', en: 'Caution', de: 'Achtung' }, closed: { icon: '⛔', cls: 'closed', en: 'Closed', de: 'Geschlossen' } };
  const day = (s) => new Date(s + 'T00:00:00');
  const fmt = (d) => d.toLocaleDateString(A.LANG.cur === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short' });
  const byId = (id) => T.destinations.find((d) => d.id === id);

  function tripWindow() {
    const d0 = store.get('tripDate', null); if (!d0) return null;
    const start = day(d0), end = new Date(start); end.setDate(end.getDate() + (window.PLAN_DAYS ? window.PLAN_DAYS() : 12));
    return { start, end };
  }
  const md = (x) => x.getMonth() * 100 + x.getDate();
  /* true if the event is active on any day of [start, end]; handles closures that wrap the year (e.g. Nov → Apr) */
  function activeIn(e, start, end) {
    if (e.weekly != null) { for (let x = new Date(start); x <= end; x.setDate(x.getDate() + 1)) if (x.getDay() === e.weekly) return true; return false; }
    const s = day(e.start), en = day(e.end);
    if (en >= s) return s <= end && en >= start;
    const sm = md(s), em = md(en);
    for (let x = new Date(start); x <= end; x.setDate(x.getDate() + 1)) { const xm = md(x); if (xm >= sm || xm <= em) return true; }
    return false;
  }
  const overlaps = (e, w) => activeIn(e, w.start, w.end);
  const inPlanRegions = (e, regions, places) => e.regions.includes('all') || e.regions.some((r) => regions.has(r)) || (e.places || []).some((p) => places.has(p));

  function planSets() {
    const plan = window.PLAN ? window.PLAN() : [];
    const places = new Set(plan.map((s) => s.id)); const gd = A.gatewayDest && A.gatewayDest(); if (gd) places.add(gd.id);
    const regions = new Set([...places].map((id) => byId(id)?.region).filter(Boolean));
    return { plan, places, regions };
  }

  /* ---------- Ticker ---------- */
  function renderTicker() {
    const w = tripWindow(), { places, regions } = planSets();
    const box = $('#ticker'); if (!box) return;
    let list = EV.filter((e) => e.weekly == null && (!w || overlaps(e, w)));
    // relevance: plan regions first, then national, then the rest of India (so the ticker is never empty)
    const score = (e) => ((e.places || []).some((p) => places.has(p)) ? 0 : e.regions.includes('all') ? 1 : e.regions.some((r) => regions.has(r)) ? 2 : 3) + (e.kind === 'closed' ? -0.5 : 0);
    list = list.sort((a, b) => score(a) - score(b) || day(a.start) - day(b.start)).slice(0, 14);
    if (!list.length) { box.hidden = true; return; }
    box.hidden = false;
    const items = list.map((e) => { const k = KIND[e.kind]; const rel = (e.places || []).some((p) => places.has(p)); return `<button class="tk ${k.cls} ${rel ? 'rel' : ''}" data-name="${esc(e.name)}"><span class="tk-icon">${k.icon}</span><b>${esc(e.name)}</b><span class="tk-date">${fmt(day(e.start))}${e.end !== e.start ? ' – ' + fmt(day(e.end)) : ''}${e.approx ? ' ~' : ''}</span></button>`; }).join('');
    $('#tickerTrack').innerHTML = items + items; // duplicated for a seamless loop
    $('#tickerLabel').textContent = w ? `${A.LANG.cur === 'de' ? 'Eure Reise' : 'Your trip'} · ${fmt(w.start)} – ${fmt(w.end)}` : (A.LANG.cur === 'de' ? 'Feste & Hinweise' : 'Festivals & notices');
  }
  $('#tickerTrack')?.addEventListener('click', (e) => { const b = e.target.closest('.tk'); if (!b) return; const ev = EV.find((x) => x.name === b.dataset.name); if (ev) showEvent(ev); });
  function showEvent(e) {
    const k = KIND[e.kind];
    const pop = $('#eventPop');
    pop.innerHTML = `<div class="ep-head ${k.cls}"><span>${k.icon} ${A.LANG.cur === 'de' ? k.de : k.en}</span><button class="close" aria-label="Close">✕</button></div>
      <h4>${esc(e.name)}</h4><div class="ep-date">${e.weekly != null ? (A.LANG.cur === 'de' ? 'Jede Woche' : 'Every week') : fmt(day(e.start)) + (e.end !== e.start ? ' – ' + fmt(day(e.end)) : '') + (e.approx ? (A.LANG.cur === 'de' ? ' · ca. Datum, prüfen' : ' · approximate date, verify') : '')}</div>
      <p>${esc(e.text)}</p>
      ${(e.places || []).length ? `<div class="chip-row">${e.places.filter(byId).map((id) => `<button class="chip" data-open="${id}">${byId(id).emoji} ${esc(byId(id).name)}</button>`).join('')}</div>` : ''}`;
    pop.hidden = false;
    pop.querySelector('.close').addEventListener('click', () => { pop.hidden = true; });
    $$('[data-open]', pop).forEach((b) => b.addEventListener('click', () => { pop.hidden = true; A.openDest(b.dataset.open); }));
  }

  /* ---------- Per-stop warnings (used by the builder) ---------- */
  window.stopEvents = (id, start, end) => {
    if (!start || !end) return [];
    const d = byId(id); if (!d) return [];
    return EV.filter((e) => {
      const concerns = (e.places || []).includes(id) || (!(e.places || []).length && (e.regions.includes('all') || e.regions.includes(d.region)));
      return concerns && activeIn(e, start, end);
    }).map((e) => ({ ...e, k: KIND[e.kind] }));
  };
  window.stopEventsHTML = (id, start, end) => {
    const list = window.stopEvents(id, start, end); if (!list.length) return '';
    return `<div class="stop-events">${list.slice(0, 3).map((e) => `<span class="se ${e.k.cls}" title="${esc(e.text)}">${e.k.icon} ${esc(e.name)}</span>`).join('')}</div>`;
  };

  renderTicker();
  dispatchEvent(new CustomEvent('eventsready'));
  addEventListener('planchange', renderTicker); addEventListener('settingschange', renderTicker); addEventListener('langchange', renderTicker);
  $('#tickerPause')?.addEventListener('click', (e) => { const tr = $('#tickerTrack'); tr.classList.toggle('paused'); e.currentTarget.textContent = tr.classList.contains('paused') ? '▶' : '⏸'; });
})();
