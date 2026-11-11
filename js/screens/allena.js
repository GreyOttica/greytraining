/* GreyTraining — Allena tab (Palestra / Corsa / Piscina), cardio session detail and cardio log sheet.
   Visual language from design-reference/GreyTraining.dc.html (Allena, 2a–2d of HANDOFF.md).
   Every value comes from the user's own plan (st.plan) and logs (st.logs): no sample data. */
(function () {
  'use strict';
  var GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  const EYEBROW_PAD = S.eyebrow + ';padding:4px 4px 0';
  const ICON = { gym: 'barbell', run: 'person-simple-run', swim: 'swimming-pool' };
  const DISC_TYPE = { corsa: 'run', piscina: 'swim' };
  const VOL_MAX = 22; // scale of the weekly volume bars (sets)
  const LIB_GROUPS = {
    Tutti: null, Petto: ['petto'], Dorso: ['dorso'], Spalle: ['spalle'],
    Gambe: ['quadricipiti', 'femorali', 'glutei', 'polpacci'], Braccia: ['bicipiti', 'tricipiti'], Addome: ['addome']
  };

  // ---------- small helpers ----------
  const pad2 = n => String(n).padStart(2, '0');
  // seconds -> "47:30" or "1:02:15"
  const hms = sec => {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
  };
  const dayNum = iso => Number(String(iso).slice(8, 10));
  const exName = id => (GT.EXI[id] || {}).n || id;
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const pct = v => Math.max(0, Math.min(100, v / VOL_MAX * 100)).toFixed(1) + '%';
  const joinIt = arr => arr.length > 1 ? arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1] : (arr[0] || '');

  // This week: today, Monday, Sunday and the mesocycle week
  function weekCtx(st, d) {
    const today = d.today || GT.todayISO(), monday = GT.mondayOf(today);
    return { today, monday, sunday: GT.addDays(monday, 6), cycle: d.cycle || GT.cycleWeek(st.plan, today) };
  }
  // Weekdays (0 = Mon) on which the plan schedules an item
  const schedOf = (plan, type, id) => plan.week.filter(w => w.items.some(it => it.type === type && it.id === id)).map(w => w.wd);
  // "Oggi" or "Mer 11" for a weekday of this week
  const dayLabel = (wd, w) => { const date = GT.addDays(w.monday, wd); return date === w.today ? 'Oggi' : `${GT.DAYS_SHORT[wd]} ${dayNum(date)}`; };
  const cardioBetween = (st, from, to, kind) => (st.logs.cardio || []).filter(l => l.date >= from && l.date <= to && (!kind || l.kind === kind));
  const openCardio = (id, kind) => GT.set({ allenView: 'cardio', cardioId: id, disc: kind || GT.state.disc });

  // ---------- shared markup ----------
  // Empty state: what is missing, how to get it, one action
  function emptyState(icon, title, body, action) {
    return html`<div style=${S.card + ';padding:20px 16px;display:flex;flex-direction:column;gap:8px;align-items:flex-start'}>
      <i class=${'ph-light ph-' + icon} style="font-size:28px;color:var(--c-fg3)"></i>
      <div style="font-size:1.0625rem;font-weight:900;line-height:1.25;margin-top:2px">${title}</div>
      <p style="margin:0;font-size:.875rem;line-height:1.45;color:var(--c-fg3);text-wrap:pretty">${body}</p>
      ${action ? html`<button class="press" onClick=${action.go} style="margin-top:6px;height:48px;padding:0 18px;border-radius:12px;border:1px solid var(--c-s3);font-weight:800;display:flex;align-items:center;gap:8px"><i class=${action.icon || 'ph-light ph-arrow-right'} style="font-size:18px"></i>${action.label}</button>` : null}
    </div>`;
  }
  const toQuestionnaire = { label: 'Aggiungi dal Profilo', go: () => A.editQuestionnaire(), icon: 'ph-light ph-user-circle' };
  // (on an imported plan the questionnaire adds runs or swims to it, on free days)
  const isImport = plan => !!(plan && plan.source && plan.source.type === 'import');

  function doneBadge() {
    return html`<span style="font-size:.75rem;font-weight:800;display:flex;gap:4px;align-items:center;color:var(--c-sec)"><i class="ph-bold ph-check" style="font-size:13px"></i>Fatto</span>`;
  }
  function profileBars(c, h, r) {
    return html`<div aria-hidden="true" style=${`flex:none;display:flex;align-items:flex-end;gap:2px;height:${h}px;width:100%`}>${GT.profileOf(c).map((b, i) => html`<div key=${i} style=${`flex:${b.f};height:${b.h};background:${b.bg};border-radius:${r}px`}></div>`)}</div>`;
  }
  function dashedSlot(icon, title, badge, text) {
    return html`<div style="border:1px dashed var(--c-s3);border-radius:12px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start"><i class=${'ph-light ph-' + icon} style="font-size:22px;color:var(--c-fg3);flex:none"></i><div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="font-weight:800">${title}</span>${ui.soon(badge)}</div><div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.45;margin-top:4px">${text}</div></div></div>`;
  }
  function statStrip(stats, size) {
    return html`<div style="flex:none;display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--c-line);border:1px solid var(--c-line);border-radius:12px;overflow:hidden">${stats.map(s => html`<div key=${s.l} style="background:var(--c-s1);padding:12px;min-width:0"><div style="font-size:.75rem;color:var(--c-fg3)">${s.l}</div><div style=${`font-size:${size};font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`}>${s.v}</div></div>`)}</div>`;
  }

  // ---------- week strip ----------
  function weekStrip(st, w) {
    const cardio = st.logs.cardio || [];
    return GT.weekDates(w.today).map((date, wd) => {
      const items = GT.dayPlan(st, date).items, first = items[0], isToday = date === w.today;
      // A rest day with an unplanned session logged still shows the check
      const extra = !items.length && (GT.sessionsOn(st, date).length > 0 || cardio.some(l => l.date === date));
      const done = items.length ? items.every(i => i.done) : extra;
      const names = items.map(i => i.day ? i.day.name : i.cardio.name);
      return {
        date, wd, isToday, done, multi: items.length > 1, someDone: items.some(i => i.done),
        letter: GT.DAYS_LETTER[wd], n: dayNum(date),
        icon: done ? 'ph-bold ph-check' : first ? `ph-light ph-${ICON[first.type]}` : null,
        label: `${GT.DAYS_LONG[wd]} ${dayNum(date)}${isToday ? ', oggi' : ''}: ${names.length ? names.join(' e ') : 'riposo'}${done ? ', fatto' : ''}`,
        go: !first ? null : first.type === 'gym'
          ? () => GT.set({ disc: 'palestra', allenSub: 'scheda' })
          : () => openCardio(first.id, first.type === 'run' ? 'corsa' : 'piscina')
      };
    });
  }

  // ---------- discipline selector ----------
  function discs(st) {
    const plan = st.plan;
    const has = { palestra: true, corsa: !!plan.run, piscina: !!plan.swim };
    return [['palestra', 'Palestra', 'barbell'], ['corsa', 'Corsa', 'person-simple-run'], ['piscina', 'Piscina', 'swimming-pool']].map(([id, label, ic]) => {
      const a = st.disc === id, on = has[id];
      return {
        id, label, active: a, on,
        icon: `${a && on ? 'ph-fill' : 'ph-light'} ph-${ic}`,
        bg: a && on ? 'var(--c-acc)' : 'transparent',
        fg: a && on ? 'var(--c-on-acc)' : on ? 'var(--c-fg)' : a ? 'var(--c-fg2)' : 'var(--c-fg3)',
        bd: on ? (a ? '1px solid var(--c-acc)' : '1px solid var(--c-s3)') : (a ? '1px dashed var(--c-acc)' : '1px dashed var(--c-s3)'),
        aria: on ? label : `${label}, non nel piano`,
        go: () => GT.set({ disc: id })
      };
    });
  }

  // ---------- Palestra · Scheda ----------
  function nextGym(st, w) {
    for (let i = 1; i <= 7; i++) {
      const date = GT.addDays(w.today, i), g = GT.dayPlan(st, date).items.filter(x => x.type === 'gym')[0];
      if (g) return { date, day: g.day };
    }
    return null;
  }

  function scheda(st, d, w) {
    const plan = st.plan, cw = w.cycle;
    if (!plan.days.length) {
      return html`${emptyState('barbell', 'Nessun giorno di palestra nel piano',
        'Nel questionario hai indicato 0 giorni di palestra. Aggiungili per avere una scheda con esercizi, serie e progressione dei carichi.', toQuestionnaire)}${importRow(st)}`;
    }
    // (weeks before week 1 starts count too, when the program starts next Monday)
    const pre = Math.max(0, Math.round(GT.daysBetween(GT.mondayOf(w.today), plan.startDate) / 7));
    const nd = GT.nextDeload(plan, cw.index + 1), left = nd < 0 ? -1 : nd - cw.index + pre;
    const sub = `${cw.cycle > 1 ? `Ciclo ${cw.cycle} · ` : ''}${GT.daysBetween(GT.todayISO(), plan.startDate) > 0 ? 'Settimana 1 da' : 'Inizio'} ${GT.fmtDay(plan.startDate)}${cw.deload ? ' · questa settimana è di scarico'
      : left === 1 ? ' · scarico la prossima settimana' : left > 1 ? ` · scarico tra ${left} settimane` : GT.nextDeload(plan, 0) < 0 ? ' · nessuna settimana di scarico' : ''}`;
    // Imported programs carry the file's RIR range per week (e.g. 2–3); show that instead of the mean
    const effOf = (rpe, i) => {
      const r = plan.weeksSpec && plan.weeksSpec[i] && plan.weeksSpec[i].rirComp;
      if (!r || !r.length) return GT.effLabel(rpe);
      const lo = Math.min(...r), hi = Math.max(...r), f = (a, b) => a === b ? GT.fmt(a) : `${GT.fmt(a)}–${GT.fmt(b)}`;
      return st.effort === 'RIR' ? `RIR ${f(lo, hi)}` : `RPE ${f(10 - hi, 10 - lo)}`;
    };
    const tiles = plan.rpeWeeks.map((rpe, i) => {
      const cur = i === cw.index, past = i < cw.index, dl = GT.isDeloadWeek(plan, i);
      return {
        w: 'S' + (i + 1), t: dl ? 'Scarico' : effOf(rpe, i),
        bg: cur ? 'var(--c-acc)' : past ? 'var(--c-s3)' : 'transparent',
        fg: cur ? 'var(--c-on-acc)' : past ? 'var(--c-fg)' : 'var(--c-fg2)',
        bd: `1px ${dl ? 'dashed' : 'solid'} ${cur ? 'var(--c-acc)' : past ? 'transparent' : 'var(--c-s3)'}`,
        aria: `Settimana ${i + 1}${cur ? ', attuale' : ''}: ${dl ? 'scarico' : GT.effLabel(rpe)}`
      };
    });
    const todayWd = GT.weekday(w.today);
    const todayGym = d.todayPlan.items.filter(x => x.type === 'gym');
    const days = plan.days.map(day => {
      const wds = schedOf(plan, 'gym', day.id), isToday = wds.indexOf(todayWd) >= 0;
      const doneToday = isToday && todayGym.some(x => x.id === day.id && x.done);
      const names = day.ex.slice(0, 3).map(x => exName(x.id));
      const more = day.ex.length - names.length;
      return {
        id: day.id, n: day.name,
        when: wds.length ? wds.map(wd => GT.DAYS_SHORT[wd]).join(' · ') + (isToday ? ' · oggi' : '') : 'non in calendario',
        dc: isToday && !doneToday ? 'var(--c-acc-t)' : 'var(--c-fg3)', doneToday,
        ex: day.ex.length ? names.join(', ') + (more > 0 ? ` +${more}` : '') : 'Nessun esercizio: tocca per aggiungerne',
        go: () => GT.set({ allenView: 'editor', editDay: day.id })
      };
    });
    const pending = todayGym.filter(x => !x.done)[0], doneRec = (todayGym.filter(x => x.done)[0] || {}).done;
    const nx = !todayGym.length ? nextGym(st, w) : null;

    return html`
      <div style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:14px'}>
        <div><div style="font-size:1.125rem;font-weight:900">${plan.split}</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">${sub}</div></div>
        <div style=${`display:grid;grid-template-columns:repeat(${tiles.length},1fr);gap:${tiles.length > 5 ? 4 : 6}px`}>
          ${tiles.map(t => html`<div key=${t.w} aria-label=${t.aria} style=${`height:58px;border-radius:8px;padding:8px 6px;display:flex;flex-direction:column;justify-content:space-between;background:${t.bg};color:${t.fg};border:${t.bd};min-width:0`}><span style="font-size:.8125rem;font-weight:900">${t.w}</span><span style="font-size:.625rem;font-weight:700;letter-spacing:-.01em;white-space:nowrap">${t.t}</span></div>`)}
        </div>
      </div>
      <div style=${S.card + ';display:flex;flex-direction:column;overflow:hidden'}>
        ${days.map((x, i) => html`
          <button key=${x.id} class="hov-s1" onClick=${x.go} aria-label=${`Modifica ${x.n}`} style=${`display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:14px 16px;${i < days.length - 1 ? 'border-bottom:1px solid var(--c-line);' : ''}text-align:left;min-height:64px`}>
            <div style="min-width:0"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="font-size:1rem;font-weight:800">${x.n}</span><span style=${`font-size:.75rem;font-weight:700;color:${x.dc}`}>${x.when}</span>${x.doneToday ? html`<i class="ph-bold ph-check" aria-label="fatto" style="font-size:13px;color:var(--c-sec)"></i>` : null}</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:3px">${x.ex}</div></div>
            <i class="ph-light ph-pencil-simple" style="font-size:20px;color:var(--c-fg3)"></i>
          </button>`)}
      </div>
      ${st.s ? ui.cta(`Riprendi ${st.s.dayName}`, () => A.startSession(), { icon: 'ph-fill ph-play' })
        : pending ? ui.cta(`Inizia ${pending.day.name}`, () => A.startSession(pending.id), { icon: 'ph-fill ph-play' })
        : doneRec ? html`<div style="height:52px;border-radius:12px;background:var(--c-s2);display:flex;align-items:center;justify-content:center;gap:8px;font-weight:800;font-variant-numeric:tabular-nums"><i class="ph-bold ph-check" style="font-size:16px;color:var(--c-sec)"></i>Completato · ${doneRec.dur} min · ${doneRec.vol > 0 ? `${GT.fk(doneRec.vol)} kg` : `${Object.keys(doneRec.sets || {}).reduce((a, k) => a + (doneRec.sets[k] || []).length, 0)} serie`}</div>`
        : nx ? html`<p style="margin:0;padding:0 4px;font-size:.8125rem;line-height:1.5;color:var(--c-fg3)">Oggi niente palestra. Prossima: ${GT.fmtShort(nx.date)} · ${nx.day.name}.</p>` : null}
      ${planNotes(plan)}
      ${importRow(st)}
    `;
  }

  // Notes and rules that came with an imported program
  function planNotes(plan) {
    if (!plan.notes || !plan.notes.length) return null;
    return html`<div style=${S.card + ';padding:14px 16px;display:flex;flex-direction:column;gap:8px'}>
      <div style=${S.eyebrow}>Note della scheda</div>
      ${plan.notes.map((n, i) => html`<div key=${'pn' + i} style="display:flex;gap:10px;font-size:.8125rem;line-height:1.45;color:var(--c-fg2)"><i class="ph-light ph-note" style="font-size:16px;flex:none;margin-top:1px"></i><span>${String(n)}</span></div>`)}
    </div>`;
  }

  // "Importa scheda" + "Ripristina piano precedente"
  function importRow(st) {
    const btn = 'flex:1;height:48px;border-radius:12px;border:1px solid var(--c-s3);font-weight:800;font-size:.875rem;display:flex;align-items:center;justify-content:center;gap:8px';
    if (st.restoreAsk && st.prevPlan) {
      return html`<div role="alert" style=${S.card + ';padding:14px 16px;display:flex;flex-direction:column;gap:10px'}>
        <div style="font-weight:800">Passare a «${String(st.prevPlan.split || 'Piano precedente')}»?</div>
        <div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.45">La scheda attuale diventa il piano precedente: puoi tornarci allo stesso modo. Registri e carichi restano.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button onClick=${() => GT.set({ restoreAsk: false })} style="height:44px;border-radius:10px;border:1px solid var(--c-s3);font-weight:800">Annulla</button>
          <button class="press" onClick=${() => A.restorePrevPlan()} style="height:44px;border-radius:10px;background:var(--c-acc);color:var(--c-on-acc);font-weight:900">Passa</button>
        </div>
      </div>`;
    }
    return html`<div style="display:flex;gap:8px">
      <button onClick=${() => GT.set({ allenView: 'import', imp: null, impErr: null })} style=${btn}><i class="ph-light ph-file-arrow-up" style="font-size:18px"></i>Importa scheda</button>
      ${st.prevPlan ? html`<button onClick=${() => GT.set({ restoreAsk: true })} style=${btn}><i class="ph-light ph-arrows-left-right" style="font-size:18px"></i>Piano precedente</button>` : null}
    </div>`;
  }

  // ---------- Palestra · Volume ----------
  function volume(st, d, w) {
    const plan = st.plan;
    const sessions = (st.logs.sessions || []).filter(s => s.date >= w.monday && s.date <= w.sunday);
    const hasLog = sessions.length > 0;
    if (!plan.days.length && !hasLog) {
      return emptyState('stack', 'Nessuna serie da contare',
        'Il volume per muscolo nasce dalle sessioni di palestra. Aggiungi almeno un giorno di palestra al piano.', toQuestionnaire);
    }
    const done = GT.weeklySets(st, w.monday), planned = GT.plannedSets(plan);
    const effTxt = st.effort === 'RIR' ? 'RIR ≤ 3' : 'RPE ≥ 7';
    const rows = GT.MUSCLES.map(m => {
      const p = planned[m.k] || 0, v = hasLog ? (done[m.k] || 0) : p;
      const low = v < m.mev, hi = v > m.mrv;
      const status = low ? `Sotto il minimo · +${Math.ceil(m.mev - v)} serie` : hi ? 'Oltre il recuperabile' : 'Nel range';
      return {
        k: m.k, name: m.n, v, p, range: `${m.mev}–${m.mrv}`,
        bandL: pct(m.mev), bandW: pct(m.mrv - m.mev), fill: pct(v), mark: pct(p),
        status: hasLog ? status : `Piano · ${status.charAt(0).toLowerCase() + status.slice(1)}`,
        sc: low ? 'var(--c-acc-t)' : 'var(--c-fg3)'
      };
    });
    const under = GT.MUSCLES.filter(m => m.mev > 0 && (planned[m.k] || 0) < m.mev).map(m => m.n.toLowerCase());
    const note = 'Range efficace: tra il volume minimo per progredire e il massimo recuperabile. La tacca indica le serie che il piano prevede in una settimana normale.'
      + (w.cycle.deload ? ' Questa è la settimana di scarico (' + GT.deloadText(plan, w.cycle.index).replace(/^stessi esercizi, /, '').replace(/\.$/, '') + '): stare sotto il minimo è previsto.' : '')
      + (under.length ? ` Nel piano sono sotto il minimo: ${joinIt(under)}. Aggiungi serie o esercizi dalla Scheda; il Coach propone le serie mancanti per i muscoli già allenati.` : '');
    const todayGym = d.todayPlan.items.filter(x => x.type === 'gym' && !x.done)[0];

    return html`
      ${!hasLog ? emptyState('stack', 'Le serie si contano quando registri un allenamento',
        `Questa settimana nessuna sessione salvata. Sotto vedi il volume che il piano prevede: ${GT.fmt(sum(GT.MUSCLES, m => planned[m.k] || 0))} serie a settimana.`,
        st.s ? { label: `Riprendi ${st.s.dayName}`, go: () => A.startSession(), icon: 'ph-fill ph-play' }
          : todayGym ? { label: `Inizia ${todayGym.day.name}`, go: () => A.startSession(todayGym.id), icon: 'ph-fill ph-play' }
          : { label: 'Vai alla scheda', go: () => GT.set({ allenSub: 'scheda' }) }) : null}
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:4px 4px 0;gap:8px"><span style="font-size:1rem;font-weight:800">Settimana ${w.cycle.num} · serie allenanti</span><span style="font-size:.75rem;color:var(--c-fg3);white-space:nowrap">${effTxt}</span></div>
      <div style="display:flex;gap:14px;padding:0 4px;font-size:.75rem;color:var(--c-fg3);align-items:center;flex-wrap:wrap">
        <span style="display:flex;gap:6px;align-items:center"><span style="width:18px;height:8px;border-radius:2px;background:var(--c-s3)"></span>Range efficace</span>
        ${hasLog ? html`<span style="display:flex;gap:6px;align-items:center"><span style="width:18px;height:4px;border-radius:2px;background:var(--c-acc)"></span>Serie fatte</span>` : null}
        <span style="display:flex;gap:6px;align-items:center"><span style="width:2px;height:12px;border-radius:1px;background:var(--c-fg2)"></span>Pianificate</span>
      </div>
      <div style=${S.card + ';padding:6px 16px'}>
        ${rows.map((v, i) => html`
          <div key=${v.k} style=${`padding:10px 0;${i < rows.length - 1 ? 'border-bottom:1px solid var(--c-line);' : ''}display:flex;flex-direction:column;gap:7px`}>
            <div style="display:flex;justify-content:space-between;font-size:.9375rem"><span style="font-weight:700">${v.name}</span><span style="font-variant-numeric:tabular-nums"><b>${GT.fmt(v.v)}</b> <span style="color:var(--c-fg3)">/ ${v.range}</span></span></div>
            <div role="img" aria-label=${`${v.name}: ${GT.fmt(v.v)} serie${hasLog ? `, pianificate ${GT.fmt(v.p)}` : ' pianificate'}, range ${v.range}`} style="position:relative;height:10px;border-radius:3px;background:var(--c-s2)">
              <div style=${`position:absolute;top:0;bottom:0;left:${v.bandL};width:${v.bandW};background:var(--c-s3);border-radius:2px`}></div>
              ${hasLog ? html`<div style=${`position:absolute;top:3px;height:4px;left:0;width:${v.fill};background:var(--c-acc);border-radius:2px`}></div>` : null}
              ${v.p > 0 ? html`<div style=${`position:absolute;top:-2px;height:14px;width:2px;margin-left:-1px;left:${v.mark};background:var(--c-fg2);border-radius:1px`}></div>` : null}
            </div>
            <span style=${`font-size:.75rem;font-weight:700;color:${v.sc}`}>${v.status}</span>
          </div>`)}
      </div>
      <p style="margin:0;padding:0 4px;font-size:.8125rem;line-height:1.5;color:var(--c-fg3)">${note}</p>
    `;
  }

  // ---------- Palestra · Libreria ----------
  function libreria(st) {
    const q = (st.libQuery || '').trim().toLowerCase();
    const group = LIB_GROUPS[st.libMuscle] || null;
    const all = GT.CATALOG.filter(e => (!group || group.indexOf(e.m) >= 0)
      && (!q || e.n.toLowerCase().indexOf(q) >= 0 || (GT.MUSCLE_NAME[e.m] || '').toLowerCase().indexOf(q) >= 0))
      .map(e => ({ e, ok: GT.exAllowed(e, st.profile) }));
    // Exercises the user can do first, catalog order otherwise
    const list = all.filter(x => x.ok).concat(all.filter(x => !x.ok));
    const okCount = all.filter(x => x.ok).length;
    const chips = ui.chip(Object.keys(LIB_GROUPS), LIB_GROUPS[st.libMuscle] !== undefined ? st.libMuscle : 'Tutti', x => GT.set({ libMuscle: x }));

    return html`
      <label style="height:48px;border-radius:12px;background:var(--c-s2);display:flex;align-items:center;gap:10px;padding:0 6px 0 14px">
        <i class="ph-light ph-magnifying-glass" style="font-size:20px;color:var(--c-fg3)"></i>
        <input value=${st.libQuery || ''} onInput=${e => GT.set({ libQuery: e.target.value })} placeholder="Cerca esercizio o muscolo" aria-label="Cerca esercizio" type="search" enterkeyhint="search" autocomplete="off" style="flex:1;min-width:0;border:0;outline:0;background:none;font-size:1rem;height:44px" />
        ${q ? html`<button onClick=${() => GT.set({ libQuery: '' })} aria-label="Cancella ricerca" style="width:40px;height:40px;display:grid;place-items:center;color:var(--c-fg3)"><i class="ph-fill ph-x-circle" style="font-size:20px"></i></button>` : null}
      </label>
      <div class="scroll" style="display:flex;gap:6px;overflow-x:auto;margin:0 -16px;padding:0 16px">
        ${chips.map(c => html`<button key=${c.label} onClick=${c.go} aria-pressed=${c.active} style=${`flex:none;height:36px;padding:0 14px;border-radius:999px;font-size:.8125rem;font-weight:700;background:${c.bg};color:${c.fg};border:1px solid ${c.active ? 'var(--c-acc)' : 'var(--c-s3)'}`}>${c.label}</button>`)}
      </div>
      ${list.length ? html`<div style="padding:0 4px;font-size:.75rem;color:var(--c-fg3)">${list.length} esercizi · ${okCount} adatti al tuo profilo</div>` : null}
      <div style="display:flex;flex-direction:column">
        ${list.map(({ e, ok }) => html`
          <button key=${e.id} onClick=${() => GT.set({ allenView: 'exercise', exDetail: e.id, exBack: null })} style="display:grid;grid-template-columns:56px 1fr auto;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--c-line);text-align:left">
            <div style="width:56px;height:56px;border-radius:8px;background:var(--c-s2);display:grid;place-items:center"><i class="ph-fill ph-play" style="font-size:16px;color:var(--c-fg3)"></i></div>
            <div style="min-width:0">
              <div style=${`font-weight:700;font-size:.9375rem;color:${ok ? 'var(--c-fg)' : 'var(--c-fg2)'}`}>${e.n}</div>
              <div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span>${GT.MUSCLE_NAME[e.m] || e.m} · ${GT.eqLabel(e)}</span>${!ok ? html`<span style="font-size:.6875rem;font-weight:700;padding:2px 7px;border-radius:999px;border:1px solid var(--c-s3);color:var(--c-fg3)">non disponibile</span>` : null}</div>
            </div>
            <i class="ph-light ph-caret-right" style="font-size:18px;color:var(--c-fg3)"></i>
          </button>`)}
        ${!list.length ? html`<div style="padding:32px 8px;text-align:center;color:var(--c-fg3);font-size:.9375rem;line-height:1.5">${q ? html`Nessun esercizio per “${st.libQuery.trim()}”${group ? ` in ${st.libMuscle}` : ''}.<br />Prova con il nome del muscolo.` : 'Nessun esercizio in questo gruppo.'}</div>` : null}
      </div>
    `;
  }

  function palestra(st, d, w) {
    const sub = ['scheda', 'volume', 'libreria'].indexOf(st.allenSub) >= 0 ? st.allenSub : 'scheda';
    const segs = ui.seg([['scheda', 'Scheda'], ['volume', 'Volume'], ['libreria', 'Libreria']], sub, x => GT.set({ allenSub: x }));
    return html`
      ${ui.Seg(segs)}
      ${sub === 'scheda' ? scheda(st, d, w) : null}
      ${sub === 'volume' ? volume(st, d, w) : null}
      ${sub === 'libreria' ? libreria(st) : null}
    `;
  }

  // ---------- Corsa ----------
  function cardioCard(c, label, done, open, withProfile) {
    return html`
      <button key=${c.id} class="press" onClick=${open} style=${S.card + ';padding:14px 16px;display:flex;flex-direction:column;gap:10px;text-align:left'}>
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center;gap:8px"><span style=${`font-size:.75rem;font-weight:800;color:${c.tag === 'Qualità' ? 'var(--c-acc-t)' : 'var(--c-fg3)'}`}>${label} · ${c.tag}</span>${done ? doneBadge() : null}</div>
        <div style="font-size:1.25rem;font-weight:900;letter-spacing:-.01em">${c.name}</div>
        ${withProfile ? profileBars(c, 28, 2) : null}
        <div style="display:flex;gap:14px;font-size:.8125rem;color:var(--c-fg2);font-variant-numeric:tabular-nums"><span>${c.kind === 'corsa' ? `${GT.fmt(c.km)} km` : `${GT.fk(c.m)} m`}</span><span>~${c.min} min</span><span>RPE ${c.rpe}</span></div>
      </button>`;
  }

  function corsa(st, w) {
    const plan = st.plan, run = plan.run;
    if (!run) {
      return emptyState('person-simple-run', isImport(plan) ? 'La scheda importata non ha corse' : 'Non hai inserito la corsa nel questionario',
        'Indica quante volte corri e quanti km fai a settimana (e, se ce l\'hai, un tempo sui 5 o 10 km): calcolo zone di passo e sedute adatte alla palestra.', toQuestionnaire);
    }
    const logs = cardioBetween(st, w.monday, w.sunday, 'corsa');
    const kmDone = sum(logs, l => Number(l.v) || 0);
    const prevKm = sum(cardioBetween(st, GT.addDays(w.monday, -7), GT.addDays(w.monday, -1), 'corsa'), l => Number(l.v) || 0);
    const growth = prevKm > 0 && kmDone > 0 ? Math.round((kmDone - prevKm) / prevKm * 100) : null;
    // Planned intensity: minutes of blocks at intensity >= 4 vs the rest
    let easy = 0, qual = 0;
    run.order.forEach(id => { const c = run.sessions[id]; if (c) c.blocks.forEach(b => { if (b[3] >= 4) qual += b[4]; else easy += b[4]; }); });
    const qPct = easy + qual ? Math.round(qual / (easy + qual) * 100) : 0, ePct = 100 - qPct;
    const r = (st.profile && st.profile.run) || {}, td = Number(r.testDist);
    const hasTest = GT.parseTime(r.testTime) > 0 && (td === 5 || td === 10);
    // The test the user actually ran (a 5 km time is converted to a 10 km pace by plan.js)
    const zoneSrc = hasTest ? `da ${td} km in ${hms(GT.parseTime(r.testTime))}` : 'stima dal volume';
    const lib = Object.keys(run.library).map(id => run.library[id]);

    return html`
      <div style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:12px'}>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:8px">
          <div><div style="font-size:.75rem;color:var(--c-fg3)">Volume corsa · settimana ${w.cycle.num}</div><div style="font-size:2.25rem;font-weight:900;letter-spacing:-.03em;line-height:1.05;font-variant-numeric:tabular-nums">${GT.fmt(kmDone)} <span style="font-size:1rem;font-weight:700;color:var(--c-fg2)">/ ${GT.fmt(run.weeklyKm)} km</span></div></div>
          <div style="text-align:right;font-size:.8125rem;color:var(--c-fg3);line-height:1.5;font-variant-numeric:tabular-nums">${prevKm > 0
            ? html`Sett. prec.: ${GT.fmt(prevKm)} km<br />${growth != null ? html`<span style=${growth > 15 ? 'color:var(--c-acc-t);font-weight:700' : ''}>${growth >= 0 ? '+' : ''}${growth}%</span> · limite +15%` : 'limite +15%'}`
            : html`Aumento massimo<br />+15% a settimana`}</div>
        </div>
        <div><div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--c-fg3);margin-bottom:6px;gap:8px"><span>Intensità pianificata</span><span>${ePct}% facile · ${qPct}% qualità</span></div><div style="display:flex;gap:2px;height:10px;border-radius:3px;overflow:hidden"><div style=${`width:${ePct}%;background:var(--c-sec)`}></div>${qPct ? html`<div style=${`width:${qPct}%;background:var(--c-acc)`}></div>` : null}</div></div>
        ${!logs.length ? html`<div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.45">Nessuna corsa registrata questa settimana. Apri una seduta e premi “Registra seduta”: i km si aggiornano qui.</div>` : null}
      </div>
      <div style=${EYEBROW_PAD}>Programma corsa</div>
      ${run.order.map(id => {
        const c = run.sessions[id]; if (!c) return null;
        const sched = schedOf(plan, 'run', id);
        return cardioCard(c, sched.length ? sched.map(wd => dayLabel(wd, w)).join(' · ') : 'Non in calendario', logs.some(l => l.sessionId === id), () => openCardio(id, 'corsa'), true);
      })}
      <div style=${S.card + ';padding:6px 16px'}>
        <div style="display:flex;justify-content:space-between;padding:10px 0;gap:8px"><span style=${S.eyebrow}>Zone di passo</span><span style="font-size:.75rem;color:var(--c-fg3);font-variant-numeric:tabular-nums">${zoneSrc}</span></div>
        ${run.zones.map(z => html`<div key=${z.z} style="display:grid;grid-template-columns:36px 1fr auto;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--c-line);font-size:.875rem"><span style="font-weight:900">${z.z}</span><span>${z.n}</span><span style="font-weight:800;font-variant-numeric:tabular-nums">${z.label} /km</span></div>`)}
      </div>
      ${!hasTest ? html`<p style="margin:-4px 0 0;padding:0 4px;font-size:.8125rem;line-height:1.5;color:var(--c-fg3)">Zone stimate dai km settimanali. Con un tempo recente sui 5 o 10 km (Profilo) diventano precise.</p>` : null}
      <div style=${EYEBROW_PAD}>Libreria allenamenti</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${lib.map(c => html`<button key=${c.id} class="press" onClick=${() => openCardio(c.id, 'corsa')} style="min-height:64px;padding:10px 12px;border-radius:12px;border:1px solid var(--c-s3);text-align:left;display:flex;flex-direction:column;justify-content:center;gap:2px"><span style="font-weight:800;font-size:.9375rem">${c.name}</span><span style="font-size:.75rem;color:var(--c-fg3)">${c.tag} · ~${c.min} min</span></button>`)}</div>
      ${dashedSlot('person-simple-run', 'Corse registrate', 'Strava · in arrivo', 'Con Strava passo, FC e dislivello arriveranno da soli. Ora registri a mano distanza, tempo e RPE.')}
    `;
  }

  // ---------- Piscina ----------
  function piscina(st, w) {
    const plan = st.plan, swim = plan.swim;
    if (!swim) {
      return emptyState('swimming-pool', isImport(plan) ? 'La scheda importata non ha il nuoto' : 'Non hai inserito il nuoto nel questionario',
        'Il nuoto qui serve da defaticamento: sedute aerobiche leggere tra palestra e corsa. Indica quante volte vai in piscina e lo inserisco nel calendario.', toQuestionnaire);
    }
    const monthStart = w.today.slice(0, 8) + '01';
    const month = cardioBetween(st, monthStart, w.today, 'piscina');
    const week = cardioBetween(st, w.monday, w.sunday, 'piscina');
    const stats = [
      { l: 'Questo mese', v: month.length ? `${GT.fk(sum(month, l => Number(l.v) || 0))} m` : '—' },
      { l: 'Sedute', v: month.length ? String(month.length) : '—' },
      { l: 'RPE medio', v: month.length ? GT.fmt(sum(month, l => Number(l.e) || 0) / month.length) : '—' }
    ];
    const wds = [];
    swim.order.forEach(id => schedOf(plan, 'swim', id).forEach(wd => { if (wds.indexOf(wd) < 0) wds.push(wd); }));
    wds.sort((a, b) => a - b);
    const after = [plan.run ? 'il giorno dopo il lungo' : null, plan.days.length ? 'dopo le gambe' : null].filter(Boolean);
    const coach = `Defaticamento: nuoto aerobico a RPE 2–4${after.length ? ', ' + after.join(' o ') : ''}.`
      + (wds.length ? ` Nel tuo piano: ${joinIt(wds.map(wd => GT.DAYS_LONG[wd].toLowerCase()))}.` : '')
      + ' Non conta nel volume di palestra.';

    return html`
      ${ui.coachCard('Ruolo della piscina', coach)}
      ${statStrip(stats, '1.375rem')}
      ${!month.length ? html`<div style="padding:0 4px;font-size:.8125rem;color:var(--c-fg3);line-height:1.45">Ancora nessuna seduta registrata questo mese. Apri una seduta e premi “Registra seduta”.</div>` : null}
      <div style=${EYEBROW_PAD}>Sedute di recupero</div>
      ${swim.order.map(id => {
        const c = swim.sessions[id]; if (!c) return null;
        const sched = schedOf(plan, 'swim', id);
        return cardioCard(c, sched.length ? sched.map(wd => dayLabel(wd, w)).join(' · ') : 'Non in calendario', week.some(l => l.sessionId === id), () => openCardio(id, 'piscina'), false);
      })}
      ${dashedSlot('watch', 'Vasche e SWOLF', 'Garmin · in arrivo', 'Dall\'orologio arriveranno vasche, ritmo per 100 m e FC. Ora registri a mano metri, tempo e RPE.')}
    `;
  }

  // ---------- Tab: Allena ----------
  GT.screens.allena = function (st, d) {
    const plan = st.plan;
    if (!plan) return null;
    const w = weekCtx(st, d);
    const eyebrow = `Settimana ${w.cycle.num} di ${plan.cycleWeeks} · ${GT.fmtRange(w.monday, w.sunday)}${w.cycle.deload ? ' · scarico' : ''}`;
    const strip = weekStrip(st, w);
    const cnt = { gym: 0, run: 0, swim: 0 };
    plan.week.forEach(x => x.items.forEach(it => { if (cnt[it.type] != null) cnt[it.type]++; }));
    const caption = [[cnt.gym, 'palestra'], [cnt.run, 'corsa'], [cnt.swim, 'piscina']].filter(x => x[0] > 0).map(x => `${x[0]} ${x[1]}`).join(' · ') || 'Nessuna seduta in calendario';
    const disc = ['palestra', 'corsa', 'piscina'].indexOf(st.disc) >= 0 ? st.disc : 'palestra';

    return html`<div class="scroll" style=${S.tabScroll}>
      ${ui.header(eyebrow, 'Allenamento')}
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
        ${strip.map(x => html`<button key=${x.date} onClick=${x.go || undefined} aria-disabled=${x.go ? null : 'true'} aria-label=${x.label} style=${`height:84px;border-radius:10px;background:${x.done ? 'var(--c-s2)' : 'var(--c-s1)'};border:1.5px solid ${x.isToday ? 'var(--c-acc)' : 'var(--c-line)'};display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:8px 0 7px;min-width:0;cursor:${x.go ? 'pointer' : 'default'}`}>
          <span style="font-size:.6875rem;font-weight:700;color:var(--c-fg3)">${x.letter}</span>
          <span style="font-size:1rem;font-weight:900;font-variant-numeric:tabular-nums">${x.n}</span>
          ${x.icon
            ? html`<span style="position:relative;display:inline-flex"><i class=${x.icon} style=${`font-size:20px;color:${x.done ? 'var(--c-sec)' : 'var(--c-fg2)'}`}></i>${x.multi && !x.done ? html`<span style=${`position:absolute;top:-1px;right:-7px;width:5px;height:5px;border-radius:50%;background:${x.someDone ? 'var(--c-sec)' : 'var(--c-fg3)'}`}></span>` : null}</span>`
            : html`<span style="height:20px;display:grid;place-items:center"><span style="width:10px;height:2px;border-radius:1px;background:var(--c-s3)"></span></span>`}
        </button>`)}
      </div>
      <div style="display:flex;gap:16px;padding:0 4px;font-size:.75rem;color:var(--c-fg3);flex-wrap:wrap"><span>${caption}</span><span style="margin-left:auto;display:flex;gap:6px;align-items:center"><i class="ph-bold ph-check" style="font-size:12px;color:var(--c-sec)"></i>fatto</span><span style="display:flex;gap:6px;align-items:center"><span style="width:10px;height:10px;border-radius:3px;border:1.5px solid var(--c-acc)"></span>oggi</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
        ${discs(Object.assign({}, st, { disc })).map(x => html`<button key=${x.id} class="press" onClick=${x.go} aria-pressed=${x.active} aria-label=${x.aria} style=${`height:64px;border-radius:12px;background:${x.bg};color:${x.fg};border:${x.bd};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px`}><i class=${x.icon} style="font-size:24px"></i><span style="font-size:.8125rem;font-weight:900">${x.label}</span></button>`)}
      </div>
      ${disc === 'palestra' ? palestra(st, d, w) : null}
      ${disc === 'corsa' ? corsa(st, w) : null}
      ${disc === 'piscina' ? piscina(st, w) : null}
    </div>`;
  };

  // ---------- Full screen: cardio session detail ----------
  GT.screens.cardioDetail = function (st, d) {
    const plan = st.plan, c = GT.findCardio(plan, st.cardioId);
    const run = c ? c.kind === 'corsa' : st.disc !== 'piscina';
    const back = () => GT.set({ allenView: null, exBack: null, disc: run ? 'corsa' : 'piscina' });
    if (!c) {
      return html`<div class="scroll" style=${S.full + ';padding:var(--top) 16px calc(var(--pb) + 24px);display:flex;flex-direction:column;gap:14px'}>
        ${ui.back('Allena', back)}
        ${emptyState('warning-circle', 'Seduta non trovata', 'Il piano è stato aggiornato e questa seduta non c\'è più. Scegline una dal programma.', { label: 'Torna ad Allena', go: back })}
      </div>`;
    }
    const w = weekCtx(st, d || {});
    const sched = schedOf(plan, DISC_TYPE[c.kind], c.id);
    const where = sched.length ? sched.map(wd => dayLabel(wd, w)).join(' · ') : 'Libreria';
    const dn = (st.logs.cardio || []).filter(l => l.date === w.today && l.sessionId === st.cardioId)[0] || null;
    const fmtV = v => run ? `${GT.fmt(v)} km` : `${GT.fk(v)} m`;
    const stats = [{ l: 'Distanza', v: fmtV(run ? c.km : c.m) }, { l: 'Durata', v: `${c.min} min` }, { l: 'RPE', v: c.rpe }];
    const blocks = c.blocks.map((b, i) => ({ i: i + 1, n: b[0], d: b[1], v: b[2], col: b[3] >= 4 ? 'var(--c-acc-t)' : 'var(--c-fg)' }));
    // Correct today's entry: reopen the sheet with the saved values
    const editLog = () => GT.set({ overlay: 'cardioLog', log: { v: dn.v, t: dn.t, e: dn.e } });

    return [
      html`<div key="cd-scroll" class="scroll" style=${S.full + ';padding:var(--top) 16px calc(var(--pb) + 96px);display:flex;flex-direction:column;gap:14px'}>
        ${ui.back(run ? 'Corsa' : 'Piscina', back)}
        <div><div style=${S.eyebrow}>${where} · ${c.tag}</div><h2 style="margin:4px 0 0;font-size:1.75rem;font-weight:900;letter-spacing:-.02em;line-height:1.1">${c.name}</h2></div>
        ${statStrip(stats, '1.25rem')}
        ${profileBars(c, 56, 3)}
        <div style=${S.card + ';display:flex;flex-direction:column;padding:0 16px'}>
          ${blocks.map((b, i) => html`<div key=${b.i} style=${`display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:12px 0;${i < blocks.length - 1 ? 'border-bottom:1px solid var(--c-line)' : ''}`}><span style="font-weight:900;font-variant-numeric:tabular-nums;color:var(--c-fg3)">${b.i}</span><div style="min-width:0"><div style="font-weight:800">${b.n}</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">${b.d}</div></div><span style=${`font-weight:900;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap;color:${b.col}`}>${b.v}</span></div>`)}
        </div>
        ${c.note ? ui.coachCard('Coach', c.note) : null}
        <div style="display:flex;gap:10px;align-items:center;padding:12px 14px;border:1px dashed var(--c-s3);border-radius:12px;font-size:.8125rem;color:var(--c-fg3)"><i class="ph-light ph-watch" style="font-size:20px"></i><span style="flex:1">Invio all'orologio</span>${ui.soon('Garmin · in arrivo')}</div>
      </div>`,
      html`<div key="cd-bar" style="position:absolute;left:0;right:0;bottom:0;z-index:21;padding:12px 16px var(--pb);background:var(--c-bg);border-top:1px solid var(--c-line)">
        ${dn
          ? html`<button class="press" onClick=${editLog} aria-label="Registrata oggi, tocca per correggere" style="height:64px;width:100%;border-radius:14px;background:var(--c-s2);display:flex;align-items:center;justify-content:center;gap:10px;font-weight:800;font-variant-numeric:tabular-nums;padding:0 12px"><i class="ph-bold ph-check" style="font-size:18px;color:var(--c-sec)"></i><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Registrata · ${fmtV(dn.v)} · ${dn.t} min · RPE ${dn.e}</span></button>`
          : ui.cta('Registra seduta', A.openCardioLog, { h: 64, icon: 'ph-bold ph-check', iconSize: 22 })}
      </div>`
    ];
  };

  // ---------- Sheet: cardio log ----------
  GT.screens.cardioLog = function (st) {
    const c = GT.findCardio(st.plan, st.cardioId), L = st.log;
    if (!c || !L) return null;
    const run = c.kind === 'corsa', today = GT.todayISO();
    const saved = (st.logs.cardio || []).some(l => l.date === today && l.sessionId === st.cardioId);
    const clampV = x => run ? Math.max(0.1, Math.round(x * 10) / 10) : Math.max(50, Math.round(x));
    const clampT = x => Math.max(1, Math.round(x));
    const setLog = fn => GT.set(s => ({ log: Object.assign({}, s.log, fn(s.log)) }));
    const bumpV = delta => setLog(l => ({ v: clampV((Number(l.v) || 0) + delta) }));
    const bumpT = delta => setLog(l => ({ t: clampT((Number(l.t) || 0) + delta) }));
    const v = Number(L.v) || 0, t = Number(L.t) || 0;
    const fields = [
      { l: run ? 'Distanza' : 'Metri', v: run ? `${GT.fmt(v)} km` : `${GT.fk(v)} m`, dec: () => bumpV(run ? -0.1 : -50), inc: () => bumpV(run ? 0.1 : 50),
        bigL: run ? '1 km' : '250 m', bigDec: () => bumpV(run ? -1 : -250), bigInc: () => bumpV(run ? 1 : 250) },
      { l: 'Tempo', v: `${t} min`, dec: () => bumpT(-1), inc: () => bumpT(1), bigL: '5 min', bigDec: () => bumpT(-5), bigInc: () => bumpT(5) }
    ];
    const pace = v > 0 && t > 0 ? (run ? `Passo medio ${GT.pace(t * 60 / v)} /km` : `Ritmo medio ${GT.pace(t * 60 / (v / 100))} /100 m`) : '';
    const rpe = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const small = 'height:36px;padding:0 10px;border-radius:8px;font-size:.75rem;font-weight:800;color:var(--c-fg2);background:var(--c-s2);font-variant-numeric:tabular-nums';

    return ui.sheet(() => GT.set({ overlay: null }), html`
      <div><div style="font-size:1.25rem;font-weight:900">Registra seduta</div><div style="font-size:.875rem;color:var(--c-fg3);margin-top:2px">${c.name} · oggi · ${saved ? 'valori registrati: correggili e salva' : 'valori pianificati, correggi se serve'}</div></div>
      ${fields.map(f => html`<div key=${f.l} style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="display:flex;flex-direction:column;gap:6px"><span style="font-weight:800">${f.l}</span><div style="display:flex;gap:4px"><button onClick=${f.bigDec} aria-label=${`${f.l}: meno ${f.bigL}`} style=${small}>−${f.bigL}</button><button onClick=${f.bigInc} aria-label=${`${f.l}: più ${f.bigL}`} style=${small}>+${f.bigL}</button></div></div>
        <div style="display:flex;align-items:center;gap:4px;background:var(--c-s2);border-radius:12px"><button class="key" onClick=${f.dec} aria-label=${`${f.l}: meno`} style="width:52px;height:52px;display:grid;place-items:center;border-radius:12px"><i class="ph-light ph-minus" style="font-size:20px"></i></button><span aria-live="polite" style="min-width:96px;text-align:center;font-size:1.375rem;font-weight:900;font-variant-numeric:tabular-nums">${f.v}</span><button class="key" onClick=${f.inc} aria-label=${`${f.l}: più`} style="width:52px;height:52px;display:grid;place-items:center;border-radius:12px"><i class="ph-light ph-plus" style="font-size:20px"></i></button></div>
      </div>`)}
      ${pace ? html`<div style="font-size:.8125rem;color:var(--c-fg3);font-variant-numeric:tabular-nums">${pace}</div>` : null}
      <div><div style="font-weight:800;margin-bottom:8px">RPE della seduta</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px">${rpe.map(n => html`<button key=${n} onClick=${() => setLog(() => ({ e: n }))} aria-pressed=${L.e === n} aria-label=${`RPE ${n}`} style=${`height:44px;border-radius:10px;font-weight:900;font-variant-numeric:tabular-nums;background:${L.e === n ? 'var(--c-acc)' : 'var(--c-s2)'};color:${L.e === n ? 'var(--c-on-acc)' : 'var(--c-fg)'}`}>${n}</button>`)}</div><div style="font-size:.75rem;color:var(--c-fg3);margin-top:6px">1–2 molto facile · 5–6 impegnativo ma sostenibile · 9–10 massimale</div></div>
      ${ui.cta('Salva', A.saveCardio)}
    `);
  };
})();
