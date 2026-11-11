/* GreyTraining — gym full-screen views: exercise detail, plan-day editor and exercise picker.
   Everything comes from the catalog (GT.EXI), the user's profile, the generated plan and the logs.
   Layout follows design-reference/GreyTraining.dc.html (exercise detail, editor scheda, libreria). */
(function () {
  'use strict';
  var GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  const fmt = GT.fmt, fmtKg = GT.fmtKg;
  const LVL_NAME = { 1: 'principiante', 2: 'intermedio', 3: 'avanzato' };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const effLabel = (st, rpe) => st.effort === 'RIR' ? `RIR ${fmt(10 - rpe)}` : `RPE ${fmt(rpe)}`;
  const muscleName = k => GT.MUSCLE_NAME[k] || k || '—';

  // ---------- shared helpers ----------
  const backBtn = (label, fn) => html`<button onClick=${fn} style="height:44px;padding:0 8px;display:flex;align-items:center;gap:4px;font-weight:700;color:var(--c-fg2)"><i class="ph-light ph-caret-left" style="font-size:22px"></i>${label}</button>`;
  const sectionTitle = text => html`<div style=${S.eyebrow + ';margin-bottom:8px'}>${text}</div>`;
  const pillBtn = 'height:36px;padding:0 12px;border-radius:999px;background:var(--c-s2);font-size:.8125rem;font-weight:800;display:flex;gap:6px;align-items:center';

  // Why an exercise is outside the user's profile (equipment, limitations, level)
  function whyNot(e, profile) {
    const p = profile || {}, eq = p.equipment || [];
    const lim = (p.limitations || []).map(l => l.k);
    const lvl = p.experience === 'avanzato' ? 3 : p.experience === 'intermedio' ? 2 : 1;
    const out = [];
    const missing = e.req.filter(q => eq.indexOf(q) < 0);
    if (missing.length) out.push(`manca ${missing.join(', ').toLowerCase()}`);
    const hits = e.avoid.filter(a => lim.indexOf(a) >= 0).map(a => ((GT.LIMITS.filter(l => l.k === a)[0] || {}).n || a).toLowerCase());
    if (hits.length) out.push(`sollecita ${hits.join(', ')} (limitazione nel profilo)`);
    if (e.lvl > lvl) out.push(`richiede livello ${LVL_NAME[e.lvl]}`);
    return out;
  }

  // Best logged set for an exercise (highest e1RM; bodyweight: most reps), saved sessions + running one
  function bestSetOf(st, id) {
    let best = null;
    const consider = (l, date) => {
      if (!l || !(l.r > 0)) return;
      const w = l.w || 0, v = GT.e1rm(w, l.r);
      if (!best || v > best.v || (v === best.v && (w > best.w || (w === best.w && l.r > best.r)))) best = { v, w, r: l.r, date };
    };
    (st.logs.sessions || []).forEach(s => ((s.sets && s.sets[id]) || []).forEach(l => consider(l, s.date)));
    if (st.s && st.s.logs && st.s.logs[id]) st.s.logs[id].forEach(l => consider(l, st.s.date));
    return best;
  }
  const setText = l => l.w > 0 ? `${fmtKg(l.w)} × ${l.r}` : `${l.r} rip`;

  // Where an exercise appears in the plan: [{ day, i }]
  function planHits(plan, id) {
    const out = [];
    if (!plan) return out;
    plan.days.forEach(day => day.ex.forEach((x, i) => { if (x.id === id) out.push({ day, i }); }));
    return out;
  }

  // ---------- Exercise detail ----------
  GT.screens.exDetail = function (st, d) {
    const id = st.exDetail, e = GT.EXI[id];
    if (!e) {
      return html`<div class="scroll" style=${S.full + ';padding:var(--top) 16px calc(var(--pb) + 24px);display:flex;flex-direction:column;gap:12px'}>
<div style="margin:0 -8px">${backBtn('Indietro', A.closeAllenView)}</div>
<div style=${S.card + ';padding:16px;font-size:.9375rem;line-height:1.45;color:var(--c-fg2)'}>Esercizio non trovato nella libreria. Torna indietro e scegline un altro.</div>
</div>`;
    }
    const s = st.s, profile = st.profile;
    const e1 = GT.bestE1RM(st, id, s && s.logs ? s.logs[id] : null).value;
    const best = bestSetOf(st, id);
    const last = GT.lastPerformance(st, id);
    const hits = planHits(st.plan, id);
    const allowed = GT.exAllowed(e, profile);
    const reasons = allowed ? [] : whyNot(e, profile);
    const cues = (e.cues || []).map((t, i) => ({ n: i + 1, t }));
    const mg = Object.keys(e.mg || {}).sort((a, b) => (b === e.m) - (a === e.m) || e.mg[b] - e.mg[a])
      .map(k => ({ k, n: muscleName(k), v: e.mg[k], primary: k === e.m }));

    // Alternatives and what their button does
    const sessionMode = st.exBack === 'session' && s && s.order && s.order[s.exIdx] === id && !((s.logs || {})[id] || []).length;
    const alts = GT.alternativesFor(id, profile, 3).map(x => {
      const base = { id: x.id, n: x.n, sub: `${muscleName(x.m)} · ${GT.eqLabel(x)}`, label: null, go: null, note: null };
      if (sessionMode) {
        if (s.order.indexOf(x.id) >= 0) return Object.assign(base, { note: 'Già in sessione' });
        return Object.assign(base, {
          label: 'Usa oggi',
          go: () => { A.sessionSwap(x.id); A.toast('set', 'Esercizio sostituito per oggi', `${x.n} al posto di ${e.n}`); }
        });
      }
      if (hits.length) {
        const targets = hits.filter(h => !h.day.ex.some(y => y.id === x.id));
        if (!targets.length) return Object.assign(base, { note: 'Già nel piano' });
        return Object.assign(base, {
          label: 'Sostituisci nel piano',
          go: () => {
            targets.forEach(h => A.planSwap(h.day.id, h.i, x.id));
            GT.set({ exDetail: x.id });
            A.toast('set', 'Piano aggiornato', `${x.n} al posto di ${e.n} · ${targets.map(h => h.day.name).join(', ')}`);
          }
        });
      }
      return base;
    });

    // Empty-state action: start the plan day that contains this exercise
    const startDay = !best && !s && hits.length ? hits[0].day : null;
    const startIt = () => { GT.set({ allenView: null, exBack: null }); A.startSession(startDay.id); };

    return html`<div class="scroll" style=${S.full + ';padding:var(--top) 0 calc(var(--pb) + 24px);display:flex;flex-direction:column'}>
<div style="display:flex;align-items:center;padding:4px 8px">${backBtn(st.exBack === 'session' && s ? 'Sessione' : 'Indietro', A.closeAllenView)}</div>
<div style="flex:none;aspect-ratio:16/9;background:var(--c-s2);display:grid;place-items:center;position:relative"><div style="display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--c-fg3)"><span style="width:64px;height:64px;border-radius:50%;background:var(--c-acc);color:var(--c-on-acc);display:grid;place-items:center"><i class="ph-fill ph-play" style="font-size:26px"></i></span><span style="font-size:.8125rem">Video esecuzione · in arrivo</span></div></div>
<div style="padding:16px;display:flex;flex-direction:column;gap:16px">
<div><div style=${S.eyebrow}>${muscleName(e.m)} · ${GT.eqLabel(e)}</div><h2 style="margin:4px 0 0;font-size:1.625rem;font-weight:900;letter-spacing:-.02em">${e.n}</h2>
${reasons.length ? html`<div style="display:flex;gap:6px;align-items:flex-start;margin-top:8px;font-size:.8125rem;line-height:1.4;color:var(--c-fg2)"><i class="ph-light ph-warning" style="font-size:16px;flex:none;margin-top:1px;color:var(--c-acc-t)"></i><span>Fuori dal tuo profilo: ${reasons.join(' · ')}.</span></div>` : null}</div>
<div style="display:flex;flex-direction:column;gap:8px">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style=${S.card + ';padding:12px'}><div style="font-size:.75rem;color:var(--c-fg3)">1RM stimato</div><div class="num" style="font-size:1.5rem;font-weight:900;font-variant-numeric:tabular-nums">${e1 > 0 ? `${fmt(e1)} kg` : '—'}</div></div><div style=${S.card + ';padding:12px'}><div style="font-size:.75rem;color:var(--c-fg3)">Miglior serie</div><div class="num" style="font-size:1.5rem;font-weight:900;font-variant-numeric:tabular-nums">${best ? setText(best) : '—'}</div></div></div>
${best ? html`<div style="font-size:.8125rem;line-height:1.4;color:var(--c-fg3)">${last ? `Ultima volta · ${GT.fmtDay(last.date)}: ${last.sets.map(setText).join(' · ')}` : 'Serie registrate nella sessione in corso.'}${best.w === 0 ? ' A corpo libero conta le ripetizioni: il 1RM non si stima.' : ''}</div>` : html`<div style="display:flex;flex-direction:column;gap:10px"><div style="font-size:.8125rem;line-height:1.45;color:var(--c-fg3)"><b style="color:var(--c-fg2)">Nessuna serie registrata.</b> 1RM stimato e miglior serie compaiono dopo il primo allenamento con questo esercizio.</div>
${startDay ? html`<button class="press" onClick=${startIt} style="align-self:flex-start;height:40px;padding:0 14px;border-radius:999px;background:var(--c-acc);color:var(--c-on-acc);font-size:.8125rem;font-weight:800;display:flex;gap:6px;align-items:center"><i class="ph-fill ph-play" style="font-size:14px"></i>Inizia ${startDay.name}</button>` : null}</div>`}
</div>
<div>${sectionTitle('Punti tecnici')}
${cues.length ? cues.map(c => html`<div key=${c.n} style="display:flex;gap:10px;padding:8px 0;font-size:.9375rem;line-height:1.4;border-bottom:1px solid var(--c-line)"><span style="font-weight:900;font-variant-numeric:tabular-nums;color:var(--c-fg3)">${c.n}</span><span>${c.t}</span></div>`) : html`<div style="font-size:.875rem;color:var(--c-fg3)">Nessun punto tecnico disponibile.</div>`}</div>
<div>${sectionTitle('Muscoli coinvolti')}
<div style="display:flex;flex-wrap:wrap;gap:6px">${mg.map(m => html`<span key=${m.k} style=${`height:32px;padding:0 12px;border-radius:999px;display:inline-flex;align-items:center;gap:6px;font-size:.8125rem;font-weight:700;border:1px solid ${m.primary ? 'var(--c-fg2)' : 'var(--c-s3)'};color:${m.primary ? 'var(--c-fg)' : 'var(--c-fg2)'}`}>${m.n}<span class="num" style="font-weight:600;color:var(--c-fg3)">${fmt(m.v)}</span></span>`)}</div>
<div style="font-size:.75rem;line-height:1.4;color:var(--c-fg3);margin-top:8px">Serie conteggiate nel volume settimanale per ogni serie di questo esercizio.</div></div>
<div>${sectionTitle('Alternative')}
${alts.length ? alts.map(a => html`<div key=${a.id} style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--c-line)"><div style="min-width:0"><div style="font-weight:700">${a.n}</div><div style="font-size:.8125rem;color:var(--c-fg3)">${a.sub}</div></div>
${a.go ? html`<button class="press" onClick=${a.go} style="flex:none;height:40px;padding:0 14px;border-radius:999px;background:var(--c-s2);font-size:.8125rem;font-weight:800;display:flex;gap:6px;align-items:center"><i class="ph-light ph-swap" style="font-size:16px"></i>${a.label}</button>` : a.note ? html`<span style="flex:none;font-size:.75rem;font-weight:700;color:var(--c-fg3)">${a.note}</span>` : null}</div>`) : html`<div style="display:flex;flex-direction:column;gap:10px"><div style="font-size:.875rem;line-height:1.45;color:var(--c-fg3)">Nessuna alternativa compatibile con attrezzatura, limitazioni e livello del tuo profilo. Aggiorna l'attrezzatura per vedere più opzioni.</div>
<button onClick=${() => GT.set({ overlay: 'profile' })} style=${pillBtn + ';align-self:flex-start;height:40px;padding:0 14px'}><i class="ph-light ph-pencil-simple" style="font-size:16px"></i>Apri il profilo</button></div>`}</div>
</div>
</div>`;
  };

  // ---------- Plan-day editor ----------
  let rmTimer = null;
  const askRemove = key => {
    clearTimeout(rmTimer);
    GT.set({ rmConfirm: key });
    rmTimer = setTimeout(() => { if (GT.state.rmConfirm === key) GT.set({ rmConfirm: null }); }, 4000);
  };

  GT.screens.editor = function (st, d) {
    const plan = st.plan;
    const day = GT.findDay(plan, st.editDay) || (plan && !st.editDay && plan.days.length ? plan.days[0] : null);
    const close = () => GT.set({ allenView: null, editDay: null, rmConfirm: null });

    if (!day) {
      return html`<div class="scroll" style=${S.full + ';padding:var(--top) 16px calc(var(--pb) + 24px);display:flex;flex-direction:column;gap:12px'}>
<div style="margin:0 -8px">${backBtn('Scheda', close)}</div>
<div style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:12px'}><div style="font-size:.9375rem;line-height:1.45;color:var(--c-fg2)">${plan && !plan.days.length ? 'Il tuo piano non ha giorni in palestra. Aumenta i giorni di palestra nel profilo per avere una scheda da modificare.' : 'Giorno non trovato nel piano. Torna alla scheda e scegli il giorno da modificare.'}</div>
<button onClick=${close} style="height:52px;border-radius:12px;background:var(--c-s2);font-weight:800">Torna alla scheda</button></div>
</div>`;
    }

    const today = GT.todayISO();
    const nSets = day.ex.reduce((a, x) => a + x.sets, 0);
    const total = `${plural(day.ex.length, 'esercizio', 'esercizi')} · ${nSets} serie · ~${GT.dayMinutes(day)} min`;
    const when = plan.week.filter(w => w.items.some(it => it.type === 'gym' && it.id === day.id)).map(w => GT.DAYS_SHORT[w.wd]);
    const seen = {};
    // A day must keep at least one exercise: an empty day cannot be started, and store.js
    // coachTip() reads day.ex[0] after a check-in (it would throw inside GT.derive).
    const only = day.ex.length === 1;
    const rows = day.ex.map((x, i) => {
      const e = GT.EXI[x.id] || { n: x.id, m: null, req: [], avoid: [], lvl: 1 };
      seen[x.id] = (seen[x.id] || 0) + 1;
      const t = GT.targetFor(plan, x, today), key = `${day.id}:${i}`;
      return {
        key: `${x.id}#${seen[x.id]}`, i, x, name: e.n,
        line: `${x.reps} rip · ${effLabel(st, t.rpe)} · rec. ${GT.mmss(x.rest)}`,
        off: GT.EXI[x.id] ? !GT.exAllowed(e, st.profile) : false,
        confirming: st.rmConfirm === key,
        dec: () => { A.planSets(day.id, i, -1); GT.set({ rmConfirm: null }); },
        inc: () => { A.planSets(day.id, i, 1); GT.set({ rmConfirm: null }); },
        up: () => { A.planMove(day.id, i, -1); GT.set({ rmConfirm: null }); },
        down: () => { A.planMove(day.id, i, 1); GT.set({ rmConfirm: null }); },
        swap: () => GT.set({ allenView: 'pick', addTo: day.id, editDay: day.id, pickMode: 'swap', pickIndex: i, pickQuery: '', pickMuscle: e.m || 'Tutti', pickAll: false, rmConfirm: null }),
        remove: () => {
          if (only) return;
          if (st.rmConfirm !== key) { askRemove(key); return; }
          clearTimeout(rmTimer);
          A.planRemove(day.id, i);
          GT.set({ rmConfirm: null });
          A.toast('info', 'Esercizio rimosso', `${e.n} · ${day.name}`);
        }
      };
    });
    const addEx = () => GT.set({ allenView: 'pick', addTo: day.id, editDay: day.id, pickMode: 'add', pickIndex: null, pickQuery: '', pickMuscle: 'Tutti', pickAll: false, rmConfirm: null });
    const last = rows.length - 1;

    return html`<div class="scroll" style=${S.full + ';padding:var(--top) 16px calc(var(--pb) + 24px);display:flex;flex-direction:column;gap:12px'}>
<div style="display:flex;align-items:center;justify-content:space-between;margin:0 -8px">${backBtn('Scheda', close)}<button onClick=${close} style="height:44px;padding:0 12px;font-weight:900;color:var(--c-acc-t)">Fatto</button></div>
<div><div style=${S.eyebrow}>Modifica giorno</div><h2 style="margin:4px 0 0;font-size:1.75rem;font-weight:900;letter-spacing:-.02em">${day.name}</h2><div class="num" style="font-size:.875rem;color:var(--c-fg3);margin-top:4px">${total}</div>
${when.length || day.focus ? html`<div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">${[day.focus, when.length ? `In calendario: ${when.join(' · ')}` : 'Non in calendario'].filter(Boolean).join(' · ')}</div>` : null}</div>
${!rows.length ? html`<div style=${S.card + ';padding:16px;font-size:.9375rem;line-height:1.45;color:var(--c-fg2)'}>Nessun esercizio in questo giorno. Aggiungine almeno uno dalla libreria: senza esercizi l'allenamento non si può iniziare.</div>` : null}
${rows.map(r => html`<div key=${r.key} style=${S.card + ';padding:12px 12px 10px 6px;display:flex;flex-direction:column;gap:10px'}>
<div style="display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:center">
<i class="ph-light ph-dots-six-vertical" aria-hidden="true" style="font-size:22px;color:var(--c-fg3)"></i>
<div style="min-width:0"><div style="font-weight:800;font-size:.9375rem">${r.name}</div><div class="num" style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">${r.line}</div>
${r.off ? html`<div style="display:flex;gap:4px;align-items:center;font-size:.75rem;color:var(--c-fg2);margin-top:2px"><i class="ph-light ph-warning" style="font-size:13px;color:var(--c-acc-t)"></i>Fuori dal tuo profilo</div>` : null}</div>
<div style="display:flex;align-items:center;gap:2px;background:var(--c-s2);border-radius:10px"><button onClick=${r.dec} disabled=${r.x.sets <= 1} aria-label=${`Meno serie: ${r.name}`} style=${`width:40px;height:44px;display:grid;place-items:center;opacity:${r.x.sets <= 1 ? '.35' : '1'}`}><i class="ph-light ph-minus" style="font-size:18px"></i></button><span class="num" style="min-width:34px;text-align:center;font-weight:900;font-variant-numeric:tabular-nums">${r.x.sets}×</span><button onClick=${r.inc} disabled=${r.x.sets >= 8} aria-label=${`Più serie: ${r.name}`} style=${`width:40px;height:44px;display:grid;place-items:center;opacity:${r.x.sets >= 8 ? '.35' : '1'}`}><i class="ph-light ph-plus" style="font-size:18px"></i></button></div>
</div>
<div style="display:flex;gap:6px;align-items:center;padding-left:6px;flex-wrap:wrap">
<button onClick=${r.up} disabled=${r.i === 0} aria-label=${`Sposta su: ${r.name}`} style=${`width:36px;height:36px;border-radius:999px;background:var(--c-s2);display:grid;place-items:center;opacity:${r.i === 0 ? '.35' : '1'}`}><i class="ph-bold ph-caret-up" style="font-size:15px"></i></button>
<button onClick=${r.down} disabled=${r.i === last} aria-label=${`Sposta giù: ${r.name}`} style=${`width:36px;height:36px;border-radius:999px;background:var(--c-s2);display:grid;place-items:center;opacity:${r.i === last ? '.35' : '1'}`}><i class="ph-bold ph-caret-down" style="font-size:15px"></i></button>
<button onClick=${r.swap} style=${pillBtn}><i class="ph-light ph-swap" style="font-size:16px"></i>Sostituisci</button>
<button onClick=${r.remove} disabled=${only} aria-label=${only ? `Rimuovi: ${r.name}, non disponibile per l'ultimo esercizio` : r.confirming ? `Conferma rimozione: ${r.name}` : `Rimuovi: ${r.name}`} style=${pillBtn + ';margin-left:auto;' + (r.confirming ? 'background:var(--c-acc);color:var(--c-on-acc)' : 'color:var(--c-fg2)') + (only ? ';opacity:.35' : '')}><i class=${r.confirming ? 'ph-bold ph-check' : 'ph-light ph-x'} style="font-size:15px"></i>${r.confirming ? 'Conferma' : 'Rimuovi'}</button>
</div>
</div>`)}
<button onClick=${addEx} style="flex:none;height:56px;border-radius:12px;border:1px dashed var(--c-s3);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-light ph-plus" style="font-size:18px"></i>Aggiungi esercizio</button>
<div style="font-size:.75rem;line-height:1.45;color:var(--c-fg3);padding:0 4px">Le modifiche si salvano subito e valgono dalla prossima sessione. Serie e ripetizioni restano quelle del piano anche quando sostituisci un esercizio.${only ? ' Ogni giorno tiene almeno un esercizio: per cambiare l’ultimo usa Sostituisci.' : ''}</div>
</div>`;
  };

  // ---------- Exercise picker (add / swap in a plan day) ----------
  GT.screens.exPicker = function (st, d) {
    const plan = st.plan, day = GT.findDay(plan, st.addTo);
    const back = () => GT.set({ allenView: 'editor', editDay: day ? day.id : st.editDay });
    if (!day) {
      return html`<div class="scroll" style=${S.full + ';padding:var(--top) 16px calc(var(--pb) + 24px);display:flex;flex-direction:column;gap:12px'}>
<div style="margin:0 -8px">${backBtn('Scheda', () => GT.set({ allenView: null, editDay: null }))}</div>
<div style=${S.card + ';padding:16px;font-size:.9375rem;line-height:1.45;color:var(--c-fg2)'}>Giorno non trovato nel piano. Torna alla scheda e riapri l'editor del giorno.</div>
</div>`;
    }

    const swapMode = st.pickMode === 'swap' && st.pickIndex != null && !!day.ex[st.pickIndex];
    const cur = swapMode ? day.ex[st.pickIndex] : null;
    const curE = cur ? GT.EXI[cur.id] : null;
    const q = String(st.pickQuery || '').trim().toLowerCase();
    const mus = st.pickMuscle || 'Tutti', showAll = !!st.pickAll;
    const inDay = {};
    day.ex.forEach(x => { inDay[x.id] = true; });

    let base = GT.CATALOG.filter(e => (mus === 'Tutti' || e.m === mus) &&
      (!q || e.n.toLowerCase().indexOf(q) >= 0 || muscleName(e.m).toLowerCase().indexOf(q) >= 0 || GT.eqLabel(e).toLowerCase().indexOf(q) >= 0));
    if (curE) {
      // Swap: same movement pattern first, then same muscle, then the rest
      const rank = e => e.pat === curE.pat ? 0 : e.m === curE.m ? 1 : 2;
      base = base.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i).map(x => x.e);
    }
    const allowed = base.filter(e => GT.exAllowed(e, st.profile));
    const hidden = base.length - allowed.length;
    // Exercises of the imported program (they are not in the library list): always offered first,
    // starting with the one this slot had before a swap
    const match = e => (mus === 'Tutti' || e.m === mus) && (!q || e.n.toLowerCase().indexOf(q) >= 0 || muscleName(e.m).toLowerCase().indexOf(q) >= 0);
    const ownIds = (cur && cur.orig ? [cur.orig.id] : []).concat(Object.keys(plan.custom || {}));
    const own = ownIds.filter((id, i) => ownIds.indexOf(id) === i && GT.EXI[id]).map(id => GT.EXI[id]).filter(match);
    const list = own.map(e => ({ e, ok: true, own: true, state: cur && e.id === cur.id ? 'Attuale' : inDay[e.id] ? 'Già nel giorno' : null, why: [] }))
      .concat((showAll ? base : allowed).map(e => {
        const ok = GT.exAllowed(e, st.profile);
        const state = cur && e.id === cur.id ? 'Attuale' : inDay[e.id] ? 'Già nel giorno' : null;
        return { e, ok, state, why: ok ? [] : whyNot(e, st.profile) };
      }));

    const select = e => {
      if (swapMode) A.planSwap(day.id, st.pickIndex, e.id);
      else A.planAdd(day.id, e.id);
      GT.set({ allenView: 'editor', editDay: day.id, pickQuery: '', pickAll: false });
      if (swapMode) A.toast('set', 'Esercizio sostituito', `${e.n} al posto di ${curE ? curE.n : cur.id} · serie invariate`);
      else A.toast('set', 'Esercizio aggiunto', `${e.n} · ${day.name}`);
    };
    const chips = [['Tutti', 'Tutti']].concat(GT.MUSCLES.map(m => [m.k, m.n]));

    return html`<div class="scroll" style=${S.full + ';padding:var(--top) 16px calc(var(--pb) + 24px);display:flex;flex-direction:column;gap:12px'}>
<div style="margin:0 -8px">${backBtn(day.name, back)}</div>
<div><div style=${S.eyebrow}>${swapMode ? `Sostituisci · ${curE ? curE.n : cur.id}` : `Aggiungi a ${day.name}`}</div><h2 style="margin:4px 0 0;font-size:1.75rem;font-weight:900;letter-spacing:-.02em">Scegli esercizio</h2>
<div style="font-size:.875rem;color:var(--c-fg3);margin-top:4px">${swapMode ? `Serie, ripetizioni e recupero restano ${cur.sets} × ${cur.reps}.` : 'Parte con 3 serie: le regoli poi nell’editor.'}</div></div>
<label style="flex:none;height:48px;border-radius:12px;background:var(--c-s2);display:flex;align-items:center;gap:10px;padding:0 6px 0 14px"><i class="ph-light ph-magnifying-glass" style="font-size:20px;color:var(--c-fg3)"></i><input value=${st.pickQuery || ''} onInput=${ev => GT.set({ pickQuery: ev.target.value })} placeholder="Cerca esercizio, muscolo o attrezzo" aria-label="Cerca esercizio" style="flex:1;min-width:0;border:0;outline:0;background:none;font-size:1rem;height:44px;color:var(--c-fg)" />
${q ? html`<button onClick=${() => GT.set({ pickQuery: '' })} aria-label="Cancella ricerca" style="flex:none;width:40px;height:40px;display:grid;place-items:center;color:var(--c-fg3)"><i class="ph-light ph-x" style="font-size:18px"></i></button>` : null}</label>
<div class="scroll" style="flex:none;display:flex;gap:6px;overflow-x:auto;margin:0 -16px;padding:0 16px">
${chips.map(c => { const a = c[0] === mus; return html`<button key=${c[0]} onClick=${() => GT.set({ pickMuscle: c[0] })} aria-pressed=${a} style=${`flex:none;height:36px;padding:0 14px;border-radius:999px;font-size:.8125rem;font-weight:700;background:${a ? 'var(--c-acc)' : 'transparent'};color:${a ? 'var(--c-on-acc)' : 'var(--c-fg)'};border:1px solid var(--c-s3)`}>${c[1]}</button>`; })}
</div>
<button onClick=${() => GT.set({ pickAll: !showAll })} aria-pressed=${showAll} style="flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 4px;text-align:left;min-height:44px">
<div><div style="font-weight:800;font-size:.9375rem">Mostra tutti</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">${showAll ? 'Inclusi gli esercizi fuori dal tuo profilo' : hidden ? `${plural(hidden, 'escluso', 'esclusi')} per attrezzatura, limitazioni o livello` : 'Solo esercizi adatti al tuo profilo'}</div></div>
<span aria-hidden="true" style=${`flex:none;width:48px;height:28px;border-radius:14px;position:relative;transition:background .2s;background:${showAll ? 'var(--c-acc)' : 'var(--c-s3)'}`}><span style=${`position:absolute;top:3px;left:${showAll ? '23px' : '3px'};width:22px;height:22px;border-radius:50%;background:var(--c-fg);transition:left .2s cubic-bezier(.2,0,0,1)`}></span></span>
</button>
<div style="display:flex;flex-direction:column">
${list.map(x => html`<button key=${x.e.id} onClick=${() => select(x.e)} disabled=${!!x.state} style=${`display:grid;grid-template-columns:56px 1fr auto;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--c-line);text-align:left;opacity:${x.state ? '.45' : '1'}`}>
<div style="width:56px;height:56px;border-radius:8px;background:var(--c-s2);display:grid;place-items:center"><i class="ph-fill ph-play" style="font-size:16px;color:var(--c-fg3)"></i></div>
<div style="min-width:0"><div style="font-weight:700;font-size:.9375rem">${x.e.n}</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">${x.own ? 'Dalla tua scheda · ' : ''}${muscleName(x.e.m)} · ${GT.eqLabel(x.e)}</div>
${x.why.length ? html`<div style="display:flex;gap:4px;align-items:flex-start;font-size:.75rem;line-height:1.35;color:var(--c-fg2);margin-top:2px"><i class="ph-light ph-warning" style="font-size:13px;flex:none;margin-top:1px;color:var(--c-acc-t)"></i><span>${x.why.join(' · ')}</span></div>` : null}</div>
${x.state ? html`<span style="font-size:.75rem;font-weight:700;color:var(--c-fg3)">${x.state}</span>` : html`<i class=${swapMode ? 'ph-light ph-swap' : 'ph-light ph-plus-circle'} aria-hidden="true" style="font-size:22px;color:var(--c-fg2)"></i>`}
</button>`)}
${!list.length ? html`<div style="padding:32px 8px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px">
<div style="color:var(--c-fg3);font-size:.9375rem;line-height:1.45">${hidden && !showAll ? `Nessun esercizio adatto al tuo profilo con questi filtri. ${plural(hidden, 'esercizio è escluso', 'esercizi sono esclusi')} per attrezzatura, limitazioni o livello.` : q ? `Nessun esercizio per “${st.pickQuery.trim()}”. Prova con il nome del muscolo o dell'attrezzo.` : 'Nessun esercizio per questo muscolo.'}</div>
${hidden && !showAll ? html`<button onClick=${() => GT.set({ pickAll: true })} style=${pillBtn + ';height:40px;padding:0 14px'}>Mostra tutti</button>` : html`<button onClick=${() => GT.set({ pickQuery: '', pickMuscle: 'Tutti' })} style=${pillBtn + ';height:40px;padding:0 14px'}>Azzera filtri</button>`}
</div>` : null}
</div>
</div>`;
  };
})();
