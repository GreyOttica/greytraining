/* GreyTraining — tab "Progressi" (Corpo / Forza / Review) and the body sheets
   (overlay 'weight' → GT.screens.weightSheet, overlay 'measures' → GT.screens.measuresSheet).
   Everything comes from the user's own logs (GT.state.logs) and plan: no sample data.
   Look and layout follow design-reference/GreyTraining.dc.html (Progressi) and HANDOFF.md §6. */
(function () {
  'use strict';
  var GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  const fmt = GT.fmt;
  const RANGE_DAYS = { '4S': 28, '12S': 84, '6M': 182 };
  const PHOTO_SLOTS = ['Fronte', 'Lato', 'Retro'];
  const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'];
  const MFIELDS = [
    { k: 'vita', n: 'Vita', tip: 'all\'altezza dell\'ombelico, a fine espirazione' },
    { k: 'petto', n: 'Petto', tip: 'sulla linea dei capezzoli, braccia lungo i fianchi' },
    { k: 'braccio', n: 'Braccio', tip: 'a metà tra spalla e gomito, braccio rilassato' },
    { k: 'coscia', n: 'Coscia', tip: 'a metà tra anca e ginocchio, in piedi' }
  ];
  const FUTURE_CARDS = [
    { t: 'Carico di allenamento complessivo', src: 'Strava · in arrivo', d: 'Palestra + corsa e bici in un unico carico settimanale, per dosare volume e intensità.', bars: ['30%', '45%', '38%', '60%', '52%', '70%', '40%'] },
    { t: 'Trend di recupero', src: 'Garmin · in arrivo', d: 'HRV, sonno e FC a riposo su 4 settimane. Oggi la readiness usa solo il check-in manuale.', bars: ['55%', '50%', '62%', '58%', '66%', '60%', '64%'] }
  ];

  // ---------- small helpers ----------
  // Signed one-decimal number with a true minus sign: +1,2 / −0,4 / ±0
  const sgn = n => { const r = Math.round(n * 10) / 10; return r > 0 ? '+' + fmt(r) : r < 0 ? '−' + fmt(-r) : '±0'; };
  const sgnInt = n => { const r = Math.round(n); return r > 0 ? '+' + r : r < 0 ? '−' + (-r) : '±0'; };
  const numOr = v => { const n = typeof v === 'number' ? v : GT.num(v); return n != null && n > 0 ? n : null; };
  const dayLabel = iso => iso === GT.todayISO() ? 'oggi' : GT.fmtDay(iso);
  const exName = id => (GT.EXI[id] || {}).n || id;
  // "12 giorni" / "3 settimane" for a span between two dates
  const spanLabel = (a, b) => { const n = GT.daysBetween(a, b); return n < 14 ? n + (n === 1 ? ' giorno' : ' giorni') : Math.round(n / 7) + ' settimane'; };

  // Three horizontal guide lines of the 326×140 charts
  const guides = () => html`<line x1="0" y1="35" x2="326" y2="35" style="stroke:var(--c-line)"></line><line x1="0" y1="70" x2="326" y2="70" style="stroke:var(--c-line)"></line><line x1="0" y1="105" x2="326" y2="105" style="stroke:var(--c-line)"></line>`;

  // Empty state: what is missing + how to get it + one action
  function emptyCard(icon, text, label, go) {
    return html`<div style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:14px'}>
      <div style="display:flex;gap:12px;align-items:flex-start"><i class=${icon} style="font-size:24px;color:var(--c-fg3);flex:none;margin-top:1px"></i><p style="margin:0;font-size:.9375rem;line-height:1.45;color:var(--c-fg2);text-wrap:pretty">${text}</p></div>
      ${label ? html`<button class="press" onClick=${go} style="height:52px;border-radius:12px;background:var(--c-acc);color:var(--c-on-acc);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px">${label}</button>` : null}
    </div>`;
  }

  // First date with anything logged (weights, sessions, cardio, measures, food, water, check-in)
  function firstLogDate(st) {
    const l = st.logs || {};
    let ds = [];
    ['weights', 'sessions', 'cardio', 'measures'].forEach(k => (l[k] || []).forEach(x => { if (x && x.date) ds.push(x.date); }));
    ['water', 'ready'].forEach(k => { ds = ds.concat(Object.keys(l[k] || {})); });
    Object.keys(l.food || {}).forEach(dt => { const day = l.food[dt] || {}; if (Object.keys(day).some(m => (day[m] || []).length)) ds.push(dt); });
    ds.sort();
    return ds[0] || null;
  }

  const openWeight = last => GT.set({ overlay: 'weight', weightPad: { v: last ? GT.fmt(last.kg) : '', fresh: true } });
  const openMeasures = () => GT.set({ overlay: 'measures' });

  // ---------- Corpo ----------
  // Latest value per measure and the delta vs the entry closest to ~4 weeks earlier (at least 2 weeks back)
  function measureInfo(st) {
    const list = (st.logs.measures || []).filter(m => m && m.date).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    let lastDate = null;
    const tiles = MFIELDS.map(f => {
      const has = list.filter(m => numOr(m[f.k]) != null);
      const cur = has[has.length - 1];
      if (!cur) return { k: f.k, n: f.n, v: '—', d: 'nessuna misura', unit: false };
      if (!lastDate || cur.date > lastDate) lastDate = cur.date;
      const want = GT.addDays(cur.date, -28), cv = numOr(cur[f.k]);
      const prev = has.filter(m => m.date <= GT.addDays(cur.date, -14))
        .sort((a, b) => Math.abs(GT.daysBetween(a.date, want)) - Math.abs(GT.daysBetween(b.date, want)))[0];
      const d = prev ? `${sgn(cv - numOr(prev[f.k]))} in ${Math.max(1, Math.round(GT.daysBetween(prev.date, cur.date) / 7))} sett.` : `prima misura · ${GT.fmtDay(cur.date)}`;
      return { k: f.k, n: f.n, v: fmt(cv), d: d, unit: true };
    });
    return { tiles: tiles, lastDate: lastDate, any: !!lastDate };
  }

  function weightCard(st) {
    const ws = GT.weightStats(st, RANGE_DAYS[st.range] || 84), today = GT.todayISO();
    const last = ws.last, todayW = ws.all.filter(w => w.date === today)[0] || null;
    const rangeChips = ui.seg(['4S', '12S', '6M'], st.range, x => GT.set({ range: x }));
    const p = st.profile || {}, target = numOr(p.targetWeight);
    const btnLabel = todayW ? `Aggiorna il peso di oggi · ${fmt(todayW.kg)} kg` : 'Registra peso di oggi';
    const btn = html`<button class="press" onClick=${() => openWeight(last)} style="height:52px;border-radius:12px;background:var(--c-s2);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px"><i class=${todayW ? 'ph-light ph-pencil-simple' : 'ph-light ph-plus'} style="font-size:18px"></i>${btnLabel}</button>`;

    if (!ws.all.length) {
      return html`<div style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:12px'}>
        <div style="font-size:.75rem;color:var(--c-fg3)">Peso · media 7 gg</div>
        <div style="font-size:2.5rem;font-weight:900;letter-spacing:-.03em;line-height:1.05;color:var(--c-fg3)">—</div>
        <p style="margin:0;font-size:.9375rem;line-height:1.45;color:var(--c-fg2)">Ancora nessun peso registrato. Pesati al mattino, a digiuno, 2–3 volte a settimana: la media di 7 giorni guida le calorie del piano.</p>
        ${target ? html`<div style="font-size:.8125rem;color:var(--c-fg2)">Obiettivo ${fmt(target)} kg</div>` : null}
        <button class="press" onClick=${() => openWeight(null)} style="height:52px;border-radius:12px;background:var(--c-acc);color:var(--c-on-acc);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-light ph-plus" style="font-size:18px"></i>Registra peso di oggi</button>
      </div>`;
    }

    const series = ws.series, cur = ws.avg7 != null ? ws.avg7 : last.kg;
    let deltaLine;
    if (series.length >= 2) {
      const a = series[0].date, b = series[series.length - 1].date, span = GT.daysBetween(a, b);
      deltaLine = `${sgn(ws.delta)} kg in ${spanLabel(a, b)}` + (span >= 7 ? ` · ${sgn(ws.delta / (span / 7))} kg/sett.` : '');
    } else if (series.length === 1) deltaLine = `Una pesata nel periodo (${dayLabel(series[0].date)}): il trend compare dalla seconda.`;
    else deltaLine = `Nessuna pesata nel periodo. Ultima: ${fmt(last.kg)} kg il ${GT.fmtDay(last.date)}.`;
    const n7 = ws.all.filter(w => w.date > GT.addDays(last.date, -7)).length;
    const subAvg = last.date === today ? `${n7} ${n7 === 1 ? 'pesata' : 'pesate'} in 7 gg` : `ultima pesata ${GT.fmtDay(last.date)}`;

    let targetLine = null;
    if (target) {
      const diff = Math.abs(target - cur);
      targetLine = diff < 0.3 ? `Obiettivo ${fmt(target)} kg · raggiunto` : `Obiettivo ${fmt(target)} kg · mancano ${fmt(diff)} kg`;
    }

    const wc = series.length >= 2 ? GT.chart(series.map(w => w.kg), 326, 140) : null;
    return html`<div style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:12px'}>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="min-width:0"><div style="font-size:.75rem;color:var(--c-fg3)">Peso · media 7 gg</div><div class="num" style="font-size:2.5rem;font-weight:900;letter-spacing:-.03em;line-height:1.05">${fmt(cur)} <span style="font-size:1rem;font-weight:700;color:var(--c-fg2)">kg</span></div><div class="num" style="font-size:.8125rem;color:var(--c-fg2);line-height:1.4">${deltaLine}</div></div>
        <div style="flex:none;display:flex;gap:2px;background:var(--c-s2);border-radius:8px;padding:3px">${rangeChips.map(c => html`<button key=${c.label} onClick=${c.go} aria-pressed=${c.active} style=${`height:32px;padding:0 10px;border-radius:6px;font-size:.75rem;font-weight:800;background:${c.bg};color:${c.fg}`}>${c.label}</button>`)}</div>
      </div>
      ${wc ? html`<svg viewBox="0 0 326 140" width="100%" height="140" preserveAspectRatio="none" style="overflow:visible" role="img" aria-label=${`Andamento del peso: ${deltaLine}`}>${guides()}<path d=${wc.area} style="fill:var(--c-s2)"></path><path d=${wc.line} fill="none" style="stroke:var(--c-acc)" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path><circle cx=${wc.lx} cy=${wc.ly} r="5" style="fill:var(--c-acc)"></circle></svg>
        <div style="display:flex;justify-content:space-between;font-size:.6875rem;color:var(--c-fg3)"><span>${GT.fmtDay(series[0].date)}</span><span>${dayLabel(series[series.length - 1].date)}</span></div>` : null}
      <div style="display:flex;justify-content:space-between;gap:8px;font-size:.75rem;color:var(--c-fg3)"><span>${subAvg}</span>${targetLine ? html`<span style="font-weight:700;color:var(--c-fg2);text-align:right">${targetLine}</span>` : null}</div>
      ${btn}
    </div>`;
  }

  function corpo(st) {
    const mi = measureInfo(st);
    return html`
      ${weightCard(st)}
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:4px 4px 0"><span style=${S.eyebrow}>Misure · cm</span><span style="font-size:.75rem;color:var(--c-fg3)">${mi.lastDate ? 'Ultime: ' + dayLabel(mi.lastDate) : 'Nessuna misura'}</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${mi.tiles.map(m => html`<div key=${m.k} style=${S.card + ';padding:12px 14px'}><div style="font-size:.75rem;color:var(--c-fg3)">${m.n}</div><div class="num" style=${`font-size:1.375rem;font-weight:900;color:${m.unit ? 'var(--c-fg)' : 'var(--c-fg3)'}`}>${m.v}${m.unit ? html` <span style="font-size:.75rem;font-weight:600;color:var(--c-fg3)">cm</span>` : null}</div><div class="num" style="font-size:.75rem;font-weight:700;color:var(--c-fg2)">${m.d}</div></div>`)}
      </div>
      ${mi.any ? null : html`<div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.4;padding:0 4px">Ancora nessuna misura. Prendile ogni 4 settimane, al mattino: insieme al peso mostrano se cambia la composizione corporea.</div>`}
      <button class="press" onClick=${openMeasures} style="height:52px;border-radius:12px;background:var(--c-s2);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-light ph-ruler" style="font-size:18px"></i>${mi.any ? 'Aggiorna misure' : 'Registra misure'}</button>
      <div style=${S.card + ';padding:14px 16px;display:flex;flex-direction:column;gap:12px'}>
        <div style="display:flex;justify-content:space-between;align-items:center"><span style=${S.eyebrow}>Foto di progresso</span>${ui.soon('In arrivo')}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${PHOTO_SLOTS.map(p => html`<div key=${p} style="aspect-ratio:3/4;border-radius:10px;border:1px dashed var(--c-s3);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--c-fg3)"><i class="ph-light ph-camera" style="font-size:22px"></i><span style="font-size:.75rem;font-weight:700">${p}</span></div>`)}</div>
        <div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.4">Stessa luce, stessa posa, ogni 4 settimane. Le foto restano sul dispositivo · in arrivo</div>
      </div>`;
  }

  // ---------- Forza ----------
  // Exercises with a loaded set (e1RM > 0), most-trained first
  const weightedExercises = st => GT.trainedExercises(st).filter(id => GT.bestE1RM(st, id).value > 0);
  // Fallback before any data: the first compound of each plan day (unique)
  function planCompounds(st) {
    const out = [];
    ((st.plan && st.plan.days) || []).forEach(day => {
      const x = day.ex.filter(e => GT.EXI[e.id] && GT.EXI[e.id].comp)[0] || day.ex[0];
      if (x && out.indexOf(x.id) < 0) out.push(x.id);
    });
    return out;
  }
  function strengthOf(st, id) {
    const series = GT.e1rmSeries(st, id).filter(s => s.v > 0), best = GT.bestE1RM(st, id).value;
    const delta = series.length >= 2 ? best - series[0].v : null;
    return { id: id, name: exName(id), series: series, best: best, delta: delta };
  }

  function forzaEmpty(st, trainedAny) {
    const hasGym = !!(st.plan && st.plan.days && st.plan.days.length);
    if (!hasGym) {
      return emptyCard('ph-light ph-barbell', 'Il tuo piano non prevede sedute in palestra, quindi non ci sono stime di forza. Se vuoi allenarti con i pesi, aggiorna i giorni di palestra nel profilo.', 'Apri il profilo', () => GT.set({ overlay: 'profile' }));
    }
    const text = trainedAny
      ? 'Le serie registrate finora sono a corpo libero. Le stime di forza compaiono dopo la prima serie con un carico in kg.'
      : 'Ancora nessuna sessione registrata. Le stime di forza compaiono dopo il primo allenamento: registra ogni serie con carico e ripetizioni.';
    return emptyCard('ph-light ph-chart-line-up', text, 'Vai all\'allenamento di oggi', () => A.goTab('oggi'));
  }

  function fallbackList(st) {
    const ids = planCompounds(st);
    if (!ids.length) return null;
    return html`<div style=${S.card + ';padding:6px 16px'}>
      <div style=${S.eyebrow + ';padding:10px 0'}>Fondamentali del piano</div>
      ${ids.map(id => html`<div key=${id} style="display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--c-line)"><i class="ph-light ph-barbell" style="font-size:20px;color:var(--c-fg3)"></i><div style="font-weight:700;font-size:.9375rem">${exName(id)}</div><span style="font-size:.75rem;font-weight:700;color:var(--c-fg3)">nessun dato</span></div>`)}
    </div>`;
  }

  function forzaA(st) {
    const exs = weightedExercises(st);
    if (!exs.length) return html`${forzaEmpty(st, GT.trainedExercises(st).length > 0)}${fallbackList(st)}`;
    const cur = exs.indexOf(st.strEx) >= 0 ? st.strEx : exs[0];
    const chips = exs.slice(0, 12).map(id => ({ id: id, label: exName(id), active: id === cur }));
    const s = strengthOf(st, cur), n = s.series.length;
    const deltaLine = n >= 2 ? `${sgn(s.delta)} kg dalla prima sessione · ${GT.fmtDay(s.series[0].date)}` : `Prima sessione · ${dayLabel(s.series[0].date)}`;
    const sc = n >= 2 ? GT.chart(s.series.map(x => x.v), 326, 140) : null;
    const today = GT.todayISO();
    const prs = GT.personalRecords(st).filter(p => p.e1 > 0).slice(0, 8);
    return html`
      <div class="scroll" style="flex:none;display:flex;gap:6px;overflow-x:auto;margin:0 -16px;padding:0 16px">${chips.map(c => html`<button key=${c.id} onClick=${() => GT.set({ strEx: c.id })} aria-pressed=${c.active} style=${`flex:none;height:40px;padding:0 14px;border-radius:999px;font-size:.8125rem;font-weight:800;white-space:nowrap;background:${c.active ? 'var(--c-acc)' : 'transparent'};color:${c.active ? 'var(--c-on-acc)' : 'var(--c-fg)'};border:1px solid var(--c-s3)`}>${c.label}</button>`)}</div>
      <div style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:12px'}>
        <div><div style="font-size:.75rem;color:var(--c-fg3)">1RM stimato (Epley) · ${s.name}</div><div class="num" style="font-size:2.5rem;font-weight:900;letter-spacing:-.03em;line-height:1.05">${fmt(s.best)} <span style="font-size:1rem;font-weight:700;color:var(--c-fg2)">kg</span></div><div class="num" style=${`font-size:.8125rem;color:${s.delta > 0 ? 'var(--c-acc-t)' : 'var(--c-fg2)'};font-weight:${s.delta > 0 ? 700 : 400}`}>${deltaLine}</div></div>
        ${sc ? html`<svg viewBox="0 0 326 140" width="100%" height="140" preserveAspectRatio="none" style="overflow:visible" role="img" aria-label=${`1RM stimato di ${s.name}: ${deltaLine}`}>${guides()}<path d=${sc.line} fill="none" style="stroke:var(--c-acc)" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path><circle cx=${sc.lx} cy=${sc.ly} r="5" style="fill:var(--c-acc)"></circle></svg>
          <div style="display:flex;justify-content:space-between;font-size:.6875rem;color:var(--c-fg3)"><span>${GT.fmtDay(s.series[0].date)}</span><span>${dayLabel(s.series[n - 1].date)}</span></div>`
        : html`<div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.4">Il grafico compare dalla seconda sessione con questo esercizio.</div>`}
        <div style="font-size:.75rem;color:var(--c-fg3)">${n} ${n === 1 ? 'sessione' : 'sessioni'} · miglior serie di ogni sessione</div>
      </div>
      ${prs.length ? html`<div style=${S.card + ';padding:6px 16px'}>
        <div style=${S.eyebrow + ';padding:10px 0'}>Record personali</div>
        ${prs.map(p => html`<div key=${p.id} style="display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--c-line)"><i class="ph-light ph-trophy" style=${`font-size:20px;color:${p.date === today ? 'var(--c-acc-t)' : 'var(--c-fg2)'}`}></i><div style="min-width:0"><div style="font-weight:700;font-size:.9375rem">${p.name}</div><div style="font-size:.75rem;color:var(--c-fg3)">${p.date === today ? 'Oggi' : GT.fmtDay(p.date)} · 1RM ~${fmt(p.e1)} kg</div></div><span class="num" style="font-weight:900">${GT.fmtKg(p.w)} × ${p.r}</span></div>`)}
      </div>` : null}`;
  }

  function forzaB(st) {
    const exs = weightedExercises(st);
    const ids = exs.slice(0, 4);
    planCompounds(st).forEach(id => { if (ids.length < 4 && ids.indexOf(id) < 0) ids.push(id); });
    const tiles = ids.map(id => {
      const s = strengthOf(st, id), n = s.series.length;
      return {
        id: id, n: s.name, has: n > 0, v: n ? fmt(s.best) : '—',
        d: n >= 2 ? `${sgn(s.delta)} · ${n} sess.` : n === 1 ? '1 sessione' : 'nessun dato',
        dc: n >= 2 && s.delta > 0 ? 'var(--c-acc-t)' : 'var(--c-fg3)',
        p: n >= 2 ? GT.chart(s.series.map(x => x.v), 140, 40).line : null
      };
    });
    return html`
      ${exs.length ? null : forzaEmpty(st, GT.trainedExercises(st).length > 0)}
      ${tiles.length ? html`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${tiles.map(l => html`<div key=${l.id} style=${S.card + ';padding:12px 14px;display:flex;flex-direction:column;gap:6px;min-width:0'}><span style="font-size:.8125rem;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.n}</span><span class="num" style=${`font-size:1.75rem;font-weight:900;letter-spacing:-.02em;line-height:1;color:${l.has ? 'var(--c-fg)' : 'var(--c-fg3)'}`}>${l.v}${l.has ? html`<span style="font-size:.75rem;font-weight:700;color:var(--c-fg3)"> kg</span>` : null}</span><span class="num" style=${`font-size:.75rem;font-weight:800;color:${l.dc}`}>${l.d}</span>${l.p ? html`<svg viewBox="0 0 140 40" width="100%" height="40" preserveAspectRatio="none" aria-hidden="true"><path d=${l.p} fill="none" style="stroke:var(--c-acc)" stroke-width="2" vector-effect="non-scaling-stroke"></path></svg>` : html`<div style="height:40px;border-bottom:1px dashed var(--c-s3)"></div>`}</div>`)}
      </div>` : null}
      ${exs.length ? html`<div style="font-size:.75rem;color:var(--c-fg3);padding:0 4px">1RM stimato con formula di Epley dalla miglior serie di ogni sessione.</div>` : null}`;
  }

  // ---------- Review ----------
  function weekNotes(st, monday, r, isCurrent) {
    const end = GT.addDays(monday, 6), notes = [], T = st.targets;
    const sessions = (st.logs.sessions || []).filter(s => s.date >= monday && s.date <= end);
    // 1. Records set this week
    const prIds = [];
    sessions.forEach(s => (s.prs || []).forEach(id => { if (prIds.indexOf(id) < 0) prIds.push(id); }));
    if (prIds.length) notes.push({ icon: 'ph-light ph-trophy', t: `Nuovi record: ${prIds.slice(0, 3).map(exName).join(', ')}${prIds.length > 3 ? ` e altri ${prIds.length - 3}` : ''}.` });
    // 2. Muscles the plan trains that stayed under the minimum effective volume
    if (sessions.length && st.plan) {
      const done = GT.weeklySets(st, monday), planned = GT.plannedSets(st.plan);
      const under = GT.MUSCLES.filter(m => m.mev > 0 && planned[m.k] > 0 && done[m.k] < m.mev)
        .sort((a, b) => done[a.k] / a.mev - done[b.k] / b.mev).slice(0, 3);
      if (under.length) notes.push({ icon: 'ph-light ph-warning', t: `${isCurrent ? 'Finora sotto' : 'Sotto'} il volume minimo efficace: ${under.map(m => `${m.n} ${fmt(done[m.k])}/${m.mev}`).join(', ')} serie.` });
      else notes.push({ icon: 'ph-light ph-stack', t: 'Tutti i gruppi muscolari del piano sopra il volume minimo efficace.' });
    } else if (!sessions.length) {
      notes.push({ icon: 'ph-light ph-barbell', t: isCurrent ? 'Ancora nessuna sessione in palestra registrata questa settimana.' : 'Nessuna sessione in palestra registrata in questa settimana.' });
    }
    // 3. Protein on logged days
    const days = GT.adherence(st, end).filter(a => a.logged);
    if (days.length && T && T.p) {
      const ok = days.filter(a => a.prot >= T.p * 0.9).length;
      notes.push({ icon: 'ph-light ph-egg', t: `Proteine a target (≥ ${Math.round(T.p * 0.9)} g) in ${ok} ${ok === 1 ? 'giorno' : 'giorni'} su ${days.length} registrati.` });
    } else if (notes.length < 3) {
      notes.push({ icon: 'ph-light ph-fork-knife', t: 'Nessun pasto registrato: con almeno 3 giorni di diario valuto calorie e proteine.' });
    }
    return notes.slice(0, 3);
  }

  function review(st) {
    const today = GT.todayISO(), prevWeek = !!st.progPrevWeek;
    const thisMonday = GT.mondayOf(today), monday = prevWeek ? GT.addDays(thisMonday, -7) : thisMonday, end = GT.addDays(monday, 6);
    const r = GT.weekReview(st, monday), before = GT.weekReview(st, GT.addDays(monday, -7));
    const plan = st.plan, preStart = plan && monday < plan.startDate;
    const cw = GT.cycleWeek(plan, monday);
    const title = (preStart ? 'Prima del piano' : `Settimana ${cw.num}${cw.deload ? ' · scarico' : ''}`) + ' · ' + GT.fmtRange(monday, end);
    const effortCut = st.effort === 'RIR' ? 'RIR ≤ 3' : 'RPE ≥ 7';
    const toggle = ui.seg([[false, 'Questa settimana'], [true, 'Settimana scorsa']], prevWeek, x => GT.set({ progPrevWeek: x }));
    const stats = [
      { l: 'Sessioni', v: `${r.done} / ${r.planned}`, s: r.planned ? `aderenza ${Math.round(Math.min(r.done, r.planned) / r.planned * 100)}%` : 'nessuna in programma' },
      { l: 'Serie allenanti', v: String(r.hardSets), s: before.hardSets > 0 ? (prevWeek ? `${sgnInt((r.hardSets - before.hardSets) / before.hardSets * 100)}% vs sett. prec.` : `${effortCut} · sett. prec. ${before.hardSets}`) : effortCut },
      { l: 'Aderenza dieta', v: r.dietDays ? `${r.dietInRange} / ${r.dietDays}` : '—', s: r.dietDays ? 'giorni con kcal ±10%' : 'nessun pasto registrato' },
      { l: 'Peso', v: r.weightDelta != null ? `${sgn(r.weightDelta)} kg` : '—', s: r.weightDelta != null ? 'da inizio sett. prec.' : 'servono 2 pesate' }
    ];
    const notes = weekNotes(st, monday, r, !prevWeek);
    return html`
      <div style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:14px'}>
        <div><div style=${S.eyebrow}>Review settimanale${prevWeek ? '' : ' · in corso'}</div><div style="font-size:1.25rem;font-weight:900;margin-top:2px">${title}</div></div>
        <div style="flex:none;display:flex;gap:2px;background:var(--c-s2);border-radius:8px;padding:3px">${toggle.map(c => html`<button key=${c.label} onClick=${c.go} aria-pressed=${c.active} style=${`flex:1;height:32px;padding:0 10px;border-radius:6px;font-size:.75rem;font-weight:800;background:${c.bg};color:${c.fg}`}>${c.label}</button>`)}</div>
        <div style="flex:none;display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--c-line);border-radius:10px;overflow:hidden">
          ${stats.map(x => html`<div key=${x.l} style="background:var(--c-s1);padding:12px"><div style="font-size:.75rem;color:var(--c-fg3)">${x.l}</div><div class="num" style=${`font-size:1.5rem;font-weight:900;color:${x.v === '—' ? 'var(--c-fg3)' : 'var(--c-fg)'}`}>${x.v}</div><div style="font-size:.75rem;color:var(--c-fg2)">${x.s}</div></div>`)}
        </div>
        ${notes.map(n => html`<div key=${n.t} style="display:flex;gap:10px;font-size:.9375rem;line-height:1.45"><i class=${n.icon} style="font-size:18px;margin-top:2px;flex:none"></i><span>${n.t}</span></div>`)}
        ${!prevWeek && r.done === 0 && plan && plan.week.some(w => w.items.length) ? html`<button class="press" onClick=${() => A.goTab('oggi')} style="height:52px;border-radius:12px;background:var(--c-s2);font-weight:800">Vai all'allenamento di oggi</button>` : null}
      </div>
      ${FUTURE_CARDS.map(f => html`
        <div key=${f.t} style="border:1px dashed var(--c-s3);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-weight:800">${f.t}</span><span style=${S.badge + ';flex:none'}>${f.src}</span></div>
          <div style="height:56px;display:flex;align-items:flex-end;gap:4px" aria-hidden="true">${f.bars.map((b, i) => html`<div key=${i} style=${`flex:1;border-radius:3px;background:var(--c-s2);height:${b}`}></div>`)}</div>
          <div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.4">${f.d}</div>
        </div>`)}`;
  }

  // ---------- tab ----------
  GT.screens.prog = function (st, d) {
    const vB = GT.v('vProg') === 'B';
    const sub = ['corpo', 'forza', 'review'].indexOf(st.progSub) >= 0 ? st.progSub : 'corpo';
    const progSegs = ui.seg([['corpo', 'Corpo'], ['forza', 'Forza'], ['review', 'Review']], sub, x => GT.set({ progSub: x }));
    const first = firstLogDate(st);
    const eyebrow = first ? 'Da ' + GT.fmtDay(first) + (first.slice(0, 4) !== GT.todayISO().slice(0, 4) ? ' ' + first.slice(0, 4) : '') : 'Inizia a registrare';
    // A running workout shows app.js's mini-bar above the tab bar: keep the last card clear of it
    return html`<div class="scroll" style=${S.tabScroll + (st.s ? ';padding-bottom:calc(var(--tabH) + 96px)' : '')}>
      ${ui.header(eyebrow, 'Progressi')}
      ${ui.Seg(progSegs)}
      ${sub === 'corpo' ? corpo(st) : null}
      ${sub === 'forza' ? (vB ? forzaB(st) : forzaA(st)) : null}
      ${sub === 'review' ? review(st) : null}
    </div>`;
  };

  // ---------- weight sheet (overlay 'weight') ----------
  GT.screens.weightSheet = function (st) {
    const ws = GT.weightStats(st), last = ws.last;
    const lastStr = last ? fmt(last.kg) : '';
    const wp = st.weightPad;
    const p = wp && !(wp.fresh && wp.v === '') ? wp : { v: lastStr, fresh: true };
    const close = () => GT.set({ overlay: null, weightPad: null });
    const put = v => GT.set({ weightPad: { v: v, fresh: false } });
    const press = k => {
      const base = p.fresh ? '' : p.v;
      if (k === '⌫') { put(p.fresh ? '' : p.v.slice(0, -1)); return; }
      if (k === ',') { if (base.indexOf(',') >= 0) return; put((base || '0') + ','); return; }
      const ci = base.indexOf(',');
      if (ci >= 0 && base.length - ci > 1) return; // one decimal is enough (100 g)
      const v = base === '0' ? k : base + k;
      if (v.length > 5) return;
      put(v);
    };
    const quick = dlt => {
      const cur = GT.num(p.v) != null ? GT.num(p.v) : (last ? last.kg : 0);
      put(fmt(Math.max(0, Math.round((cur + dlt) * 10) / 10)));
    };
    const n = GT.num(p.v), valid = n != null && n > 20 && n < 400;
    const save = () => { if (!valid) return; A.logWeight(n); GT.set({ overlay: null, weightPad: null }); };
    const today = GT.todayISO(), todayW = ws.all.filter(w => w.date === today)[0];
    const hint = todayW ? `Oggi: ${fmt(todayW.kg)} kg` : last ? `Ultimo: ${fmt(last.kg)} kg · ${GT.fmtDay(last.date)}` : 'Al mattino, a digiuno';
    const quickBtns = [-0.5, -0.1, 0.1, 0.5].map(q => ({ label: (q > 0 ? '+' : '−') + fmt(Math.abs(q)), go: () => quick(q) }));
    return ui.sheet(close, html`
      <div style="display:flex;justify-content:space-between;align-items:center"><span style=${S.eyebrow}>${todayW ? 'Aggiorna il peso di oggi' : 'Peso di oggi'}</span><span style="font-size:.8125rem;color:var(--c-fg3)">${hint}</span></div>
      <div class="num" aria-live="polite" style=${`font-size:3.5rem;font-weight:900;letter-spacing:-.03em;text-align:center;line-height:1.1;min-height:62px;color:${p.fresh ? 'var(--c-fg2)' : 'var(--c-fg)'}`}>${p.v || '—'}<span style="display:inline-block;width:3px;height:44px;background:var(--c-acc);margin-left:4px;vertical-align:-4px;animation:gtDot 1s infinite"></span><span style="font-size:1.25rem;font-weight:700;color:var(--c-fg2);margin-left:6px">kg</span></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${quickBtns.map(q => html`<button key=${q.label} onClick=${q.go} aria-label=${`${q.label} kg`} style="height:44px;border-radius:10px;border:1px solid var(--c-s3);font-weight:800;font-variant-numeric:tabular-nums">${q.label}</button>`)}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${PAD_KEYS.map(k => html`<button key=${k} class="key" onClick=${() => press(k)} aria-label=${k === '⌫' ? 'Cancella' : k === ',' ? 'Virgola' : null} style="height:56px;border-radius:12px;background:var(--c-s2);font-size:1.5rem;font-weight:800;display:grid;place-items:center">${k}</button>`)}</div>
      <div style="font-size:.75rem;color:var(--c-fg3);text-align:center">${valid || !p.v ? 'Pesati al mattino, a digiuno, dopo il bagno: conta la media di 7 giorni.' : 'Inserisci un valore tra 20 e 400 kg.'}</div>
      <button class="press" onClick=${save} disabled=${!valid} aria-disabled=${!valid} style=${`height:60px;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);font-size:1.0625rem;font-weight:900;opacity:${valid ? 1 : 0.4}`}>Salva</button>
    `, { gap: 12 });
  };

  // ---------- measures sheet (overlay 'measures') ----------
  GT.screens.measuresSheet = function (st) {
    const list = (st.logs.measures || []).filter(m => m && m.date).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const lastOf = k => { for (let i = list.length - 1; i >= 0; i--) { const v = numOr(list[i][k]); if (v != null) return v; } return null; };
    const close = () => GT.set({ overlay: null });
    const submit = e => {
      e.preventDefault();
      const form = e.currentTarget, out = {};
      let bad = false;
      MFIELDS.forEach(f => {
        const raw = String(form.elements[f.k].value || '').trim();
        if (!raw) return;
        const n = GT.num(raw);
        if (n == null || n < 10 || n > 300) { bad = true; return; }
        out[f.k] = Math.round(n * 10) / 10;
      });
      if (bad) { A.toast('info', 'Controlla i valori', 'Misure in cm tra 10 e 300, es. 82,5'); return; }
      if (!Object.keys(out).length) { A.toast('info', 'Nessuna misura', 'Inserisci almeno un valore in cm'); return; }
      A.logMeasures(out);
      GT.set({ overlay: null });
    };
    const fieldStyle = 'width:100%;height:48px;border-radius:12px;background:var(--c-s2);border:0;outline:0;padding:0 44px 0 14px;font-size:1.125rem;font-weight:800;font-variant-numeric:tabular-nums;text-align:right';
    return ui.sheet(close, html`
      <div><div style="font-size:1.25rem;font-weight:900">Misure corporee</div><div style="font-size:.875rem;color:var(--c-fg3);margin-top:2px;line-height:1.4">Metro morbido, al mattino, stesso punto ogni volta. Lascia vuoto ciò che non misuri.</div></div>
      <form onSubmit=${submit} style="display:flex;flex-direction:column;gap:12px" novalidate>
        ${MFIELDS.map(f => {
          const v = lastOf(f.k);
          return html`<label key=${f.k} style="display:grid;grid-template-columns:1fr 132px;gap:12px;align-items:center">
            <span><span style="display:block;font-weight:800">${f.n}</span><span style="display:block;font-size:.75rem;color:var(--c-fg3);line-height:1.35">${f.tip}</span></span>
            <span style="position:relative;display:block"><input name=${f.k} type="text" inputmode="decimal" autocomplete="off" defaultValue=${v != null ? fmt(v) : ''} placeholder="—" aria-label=${`${f.n} in centimetri`} style=${fieldStyle} /><span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:.8125rem;font-weight:700;color:var(--c-fg3);pointer-events:none">cm</span></span>
          </label>`;
        })}
        <button type="submit" class="press" style="height:60px;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);font-size:1.0625rem;font-weight:900;margin-top:4px">Salva</button>
      </form>
    `, { gap: 14 });
  };
})();
