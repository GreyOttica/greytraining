/* GreyTraining — tab "Oggi" (variants A and B, chosen with ?vOggi=A|B).
   Layout from design-reference/GreyTraining.dc.html lines 62-158; every value comes from the
   user's profile, generated plan and logs (GT.derive, GT.dayPlan, GT.foodDay …). */
(function () {
  'use strict';
  const GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  // Recovery placeholders until Garmin is connected
  const RECOVERY_TILES = [
    { icon: 'ph-light ph-moon', label: 'Sonno', unit: 'h' },
    { icon: 'ph-light ph-wave-sine', label: 'HRV', unit: 'ms' },
    { icon: 'ph-light ph-heartbeat', label: 'FC riposo', unit: 'bpm' }
  ];
  const KIND_LABEL = { corsa: 'Corsa', piscina: 'Piscina' };

  const openProfile = () => GT.set({ overlay: 'profile' });
  const openReadiness = () => GT.set({ overlay: 'readiness' });
  const goNutri = () => GT.set({ tab: 'nutri', nutriDate: null });
  const openCardio = (kind, id) => GT.set({ tab: 'allen', disc: kind, allenView: 'cardio', cardioId: id });
  const openEditor = id => GT.set({ tab: 'allen', disc: 'palestra', allenSub: 'scheda', allenView: 'editor', editDay: id });
  const goScheda = () => GT.set({ tab: 'allen', disc: 'palestra', allenSub: 'scheda', allenView: null });

  // ---------- local helpers ----------
  // "Luca Rossi" -> "LR", "luca" -> "L"; '' when there is no name
  function initials(profile) {
    const parts = String((profile && profile.name) || '').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }
  function avatar(st, size) {
    const ini = initials(st.profile);
    const fs = size >= 48 ? '.9375rem' : '.875rem';
    return html`<button onClick=${openProfile} aria-label="Profilo" style=${`flex:none;width:${size}px;height:${size}px;border-radius:50%;background:var(--c-s2);display:grid;place-items:center;font-weight:900;font-size:${fs}`}>${ini || html`<i class="ph-light ph-user" style="font-size:22px"></i>`}</button>`;
  }
  const exName = id => (GT.EXI[id] || {}).n || id;
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const weekLabel = (st, d) => `Settimana ${d.cycle.num} di ${st.plan.cycleWeeks}${d.cycle.deload ? ' · scarico' : ''}`;

  // Everything the screen needs about a gym item of today
  function gymInfo(st, d, item) {
    const day = item.day, ex = day.ex || [];
    const rows = ex.map((x, i) => {
      const t = GT.targetFor(st.plan, x, d.today);
      return { key: x.id + '-' + i, n: String(i + 1).padStart(2, '0'), name: exName(x.id), target: `${t.sets} × ${x.reps}`, sets: t.sets, rpe: t.rpe };
    });
    const sets = rows.reduce((a, r) => a + r.sets, 0);
    const rpe = rows.length ? rows[0].rpe : null;
    const done = item.done;
    let doneLine = '';
    if (done) {
      const nSets = Object.keys(done.sets || {}).reduce((a, k) => a + (done.sets[k] || []).length, 0);
      doneLine = `${done.dur} min · ` + (done.vol > 0 ? `${GT.fk(done.vol)} kg` : plural(nSets, 'serie', 'serie'));
    }
    return { item, day, rows, sets, rpe, min: ex.length ? GT.dayMinutes(day) : 0, done, doneLine };
  }

  // Effort target in the user's scale: { label 'RPE'|'RIR', value '8' }
  function effTarget(st, rpe) {
    if (rpe == null) return null;
    return st.effort === 'RIR' ? { label: 'RIR', value: GT.fmt(10 - rpe) } : { label: 'RPE', value: GT.fmt(rpe) };
  }

  // Everything the screen needs about a corsa/piscina item of today
  function cardioInfo(item) {
    const c = item.cardio, run = c.kind === 'corsa', log = item.done;
    const fmtV = v => run ? `${GT.fmt(v)} km` : `${GT.fk(v)} m`;
    return {
      item, c, run, kind: c.kind, kindLabel: KIND_LABEL[c.kind] || 'Cardio',
      dist: fmtV(run ? c.km : c.m), dur: `~${c.min} min`, profile: GT.profileOf(c),
      tagColor: c.tag === 'Qualità' ? 'var(--c-acc-t)' : 'var(--c-fg3)',
      doneLine: log ? [log.v != null ? fmtV(log.v) : null, log.t ? `${log.t} min` : null, log.e ? `RPE ${log.e}` : null].filter(Boolean).join(' · ') : '',
      open: () => openCardio(c.kind, item.id)
    };
  }

  // Name of a plan item (gym day or cardio session)
  const itemName = it => it.type === 'gym' ? it.day.name : it.cardio.name;

  // First date after today (within 7 days) with something planned
  function nextPlanned(st, d) {
    for (let i = 1; i <= 7; i++) {
      const date = GT.addDays(d.today, i), p = GT.dayPlan(st, date);
      if (!p.rest) return { date, items: p.items, when: i === 1 ? 'Domani' : GT.fmtLong(date) };
    }
    return null;
  }
  // The gym day to do on a rest day: the next scheduled one, else the first of the plan
  function anywayDay(st, next) {
    const days = (st.plan.days || []).filter(x => x.ex && x.ex.length);
    if (!days.length) return null;
    const g = next && next.items.filter(it => it.type === 'gym' && it.day && it.day.ex.length)[0];
    return g ? g.day : days[0];
  }

  // Today's nutrition (always today, whatever date the Nutrizione tab is showing)
  function foodToday(st, d) {
    const T = d.targets, f = GT.foodDay(st, d.today), tot = f.tot;
    const macros = [['Proteine', 'P', 'p'], ['Carboidrati', 'C', 'c'], ['Grassi', 'G', 'g']].map(x => {
      const k = x[2];
      return { k, label: x[0], short: x[1], left: Math.max(0, Math.round(T[k] - tot[k])), pct: (T[k] ? Math.min(100, tot[k] / T[k] * 100) : 0).toFixed(0) + '%' };
    });
    const over = Math.max(0, tot.k - T.k);
    return {
      logged: f.logged, over, left: GT.fk(Math.max(0, T.k - tot.k)), overLabel: GT.fk(over),
      line: `${GT.fk(tot.k)} / ${GT.fk(T.k)} kcal`, pct: (T.k ? Math.min(100, tot.k / T.k * 100) : 0).toFixed(0) + '%', macros
    };
  }

  // ---------- shared pieces ----------
  const checkDot = (size) => html`<span style=${`flex:none;width:${size}px;height:${size}px;border-radius:50%;background:var(--c-acc);color:var(--c-on-acc);display:grid;place-items:center`}><i class="ph-bold ph-check" style=${`font-size:${Math.round(size * 0.57)}px`}></i></span>`;

  function doneRow(label, line, h) {
    return html`<div style=${`height:${h || 60}px;border-radius:12px;background:var(--c-s2);display:flex;align-items:center;gap:12px;padding:0 16px`}>
      ${checkDot(28)}<span style="font-weight:800">${label}</span><span class="num" style="margin-left:auto;color:var(--c-fg2);font-size:.875rem;text-align:right">${line}</span>
    </div>`;
  }

  function secondaryBtn(label, onClick, icon, h) {
    return html`<button class="press" onClick=${onClick} style=${`height:${h || 52}px;width:100%;border-radius:12px;background:var(--c-s2);color:var(--c-fg);font-size:.9375rem;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px`}>${icon ? html`<i class=${icon} style="font-size:18px"></i>` : null}${label}</button>`;
  }

  // ---------- variant A cards ----------
  function readinessCard(d) {
    const rd = d.readiness;
    return html`<button onClick=${openReadiness} style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:14px 16px;display:grid;grid-template-columns:64px 1fr auto;gap:14px;align-items:center;text-align:left">
      <div style="position:relative;width:64px;height:64px">
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="none" style="stroke:var(--c-s3)" stroke-width="6"></circle>${rd ? html`<circle cx="32" cy="32" r="28" fill="none" style="stroke:var(--c-acc)" stroke-width="6" stroke-linecap="round" stroke-dasharray="175.9" stroke-dashoffset=${d.readyOffset} transform="rotate(-90 32 32)"></circle>` : null}</svg>
        <div class="num" style=${`position:absolute;inset:0;display:grid;place-items:center;font-size:1.25rem;font-weight:900;color:${rd ? 'var(--c-fg)' : 'var(--c-fg3)'}`}>${rd ? d.score : '—'}</div>
      </div>
      ${rd
        ? html`<div><div style=${S.eyebrow}>Readiness</div><div style="font-size:1.125rem;font-weight:800;margin-top:2px">${rd.label}</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">Check-in manuale · Garmin in arrivo</div></div>`
        : html`<div><div style=${S.eyebrow}>Readiness</div><div style="font-size:1.125rem;font-weight:800;margin-top:2px">Check-in di oggi</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">30 secondi · sonno, energia, dolori</div></div>`}
      <i class="ph-light ph-caret-right" style="font-size:20px;color:var(--c-fg3)"></i>
    </button>`;
  }

  function gymCard(st, d, g) {
    const eff = effTarget(st, g.rpe), more = g.rows.length - 3;
    const runningOther = st.s && st.s.dayId !== g.item.id;
    return html`<div key=${'gym-' + g.item.id} style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:18px 16px 16px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div style=${S.eyebrow}>Allenamento · ${weekLabel(st, d)}</div>${eff ? html`<span class="num" style="flex:none;font-size:.75rem;font-weight:700;color:var(--c-fg2)">${eff.label} ${eff.value}</span>` : null}</div>
      <div><div style="font-size:1.75rem;font-weight:900;letter-spacing:-.02em;line-height:1.1">${g.day.name}</div>
        ${g.rows.length ? html`<div class="num" style="font-size:.9375rem;color:var(--c-fg2);margin-top:4px">${plural(g.rows.length, 'esercizio', 'esercizi')} · ${g.sets} serie · ~${g.min} min</div>` : null}</div>
      ${g.rows.length
        ? html`<div style="display:flex;flex-direction:column;border-top:1px solid var(--c-line)">
            ${g.rows.slice(0, 3).map(e => html`<div key=${e.key} style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--c-line);font-size:.9375rem"><span style="font-weight:600">${e.name}</span><span class="num" style="color:var(--c-fg3);white-space:nowrap">${e.target}</span></div>`)}
            ${more > 0 ? html`<div style="padding-top:10px;font-size:.8125rem;color:var(--c-fg3)">+ ${more === 1 ? 'altro 1 esercizio' : `altri ${more} esercizi`}</div>` : null}
          </div>`
        : html`<div style="font-size:.9375rem;color:var(--c-fg2);line-height:1.45">Nessun esercizio in questa giornata. Aggiungine almeno uno dalla Scheda per poter iniziare.</div>`}
      ${g.done
        ? doneRow('Completato', g.doneLine)
        : g.rows.length
          ? html`${ui.cta(d.startLabel, () => A.startSession(g.item.id), { icon: 'ph-fill ph-play' })}${runningOther ? html`<div style="font-size:.8125rem;color:var(--c-fg3);margin-top:-4px">In corso: ${st.s.dayName}. Chiudila prima di iniziare ${g.day.name}.</div>` : null}`
          : secondaryBtn('Modifica giornata', () => openEditor(g.item.id), 'ph-light ph-pencil-simple')}
    </div>`;
  }

  function cardioCard(c) {
    return html`<button key=${'cardio-' + c.item.id} onClick=${c.open} style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;text-align:left">
      <div style="display:flex;justify-content:space-between;width:100%;align-items:center"><span style=${`font-size:.75rem;font-weight:800;color:${c.tagColor}`}>${c.kindLabel} · ${c.c.tag}</span>${c.item.done ? null : html`<i class="ph-light ph-caret-right" style="font-size:18px;color:var(--c-fg3)"></i>`}</div>
      <div style="font-size:1.25rem;font-weight:900;letter-spacing:-.01em">${c.c.name}</div>
      ${c.profile.length ? html`<div aria-hidden="true" style="display:flex;align-items:flex-end;gap:2px;height:28px;width:100%">${c.profile.map((b, i) => html`<div key=${i} style=${`flex:${b.f};height:${b.h};background:${b.bg};border-radius:2px`}></div>`)}</div>` : null}
      <div class="num" style="display:flex;gap:14px;font-size:.8125rem;color:var(--c-fg2)"><span>${c.dist}</span><span>${c.dur}</span><span>RPE ${c.c.rpe}</span></div>
      ${c.item.done ? html`<div style="width:100%;border-radius:10px;background:var(--c-s2);display:flex;align-items:center;gap:10px;padding:10px 12px">${checkDot(22)}<span style="font-weight:800;font-size:.875rem">Fatto</span><span class="num" style="margin-left:auto;color:var(--c-fg2);font-size:.8125rem;text-align:right">${c.doneLine}</span></div>` : null}
    </button>`;
  }

  function restCard(st, d) {
    const next = nextPlanned(st, d), dayAnyway = anywayDay(st, next);
    const doneToday = GT.sessionsOn(st, d.today);
    const nextGo = next ? (() => {
      const it = next.items[0];
      return it.type === 'gym' ? goScheda() : openCardio(it.cardio.kind, it.id);
    }) : null;
    return html`<div key="rest" style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:18px 16px 16px;display:flex;flex-direction:column;gap:12px">
      <div style=${S.eyebrow}>Riposo · ${weekLabel(st, d)}</div>
      <div><div style="font-size:1.75rem;font-weight:900;letter-spacing:-.02em;line-height:1.1">Giorno di riposo</div>
        <div style="font-size:.9375rem;color:var(--c-fg2);margin-top:6px;line-height:1.45">Il muscolo cresce nel recupero. Oggi cammina, fai mobilità leggera e punta a 7–9 ore di sonno.</div></div>
      ${next
        ? html`<button onClick=${nextGo} style="display:flex;align-items:center;gap:12px;padding:12px 0 0;border-top:1px solid var(--c-line);text-align:left;width:100%">
            <div style="flex:1;min-width:0"><div style="font-size:.75rem;color:var(--c-fg3)">Prossimo · ${next.when}</div><div style="font-size:1rem;font-weight:800;margin-top:2px">${next.items.map(itemName).join(' + ')}</div></div>
            <i class="ph-light ph-caret-right" style="font-size:18px;color:var(--c-fg3)"></i>
          </button>`
        : html`<div style="padding-top:12px;border-top:1px solid var(--c-line);font-size:.875rem;color:var(--c-fg2);line-height:1.45">Nessuna seduta nei prossimi 7 giorni. Imposta i giorni di palestra, corsa o nuoto dal Profilo.</div>`}
      ${doneToday.map(s => html`<div key=${s.id}>${doneRow('Completato', `${s.dayName} · ${s.dur} min`, 52)}</div>`)}
      ${st.s
        ? ui.cta(d.startLabel, () => A.startSession(), { icon: 'ph-fill ph-play' })
        : dayAnyway && !doneToday.length ? secondaryBtn(`Allenati comunque · ${dayAnyway.name}`, () => A.startSession(dayAnyway.id), 'ph-light ph-barbell') : null}
      ${!next ? secondaryBtn('Apri il profilo', openProfile, 'ph-light ph-user') : null}
    </div>`;
  }

  function planCards(st, d, gyms, cardios) {
    if (d.todayPlan.rest) return restCard(st, d);
    const out = [];
    d.todayPlan.items.forEach(it => {
      if (it.type === 'gym') { const g = gyms.filter(x => x.item === it)[0]; if (g) out.push(gymCard(st, d, g)); }
      else { const c = cardios.filter(x => x.item === it)[0]; if (c) out.push(cardioCard(c)); }
    });
    return out;
  }

  function macroCard(f) {
    return html`<button onClick=${goNutri} style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:12px;text-align:left">
      <div style="display:flex;justify-content:space-between;width:100%;gap:8px"><span style=${S.eyebrow}>Macro rimanenti</span><span class="num" style="font-size:.8125rem;color:var(--c-fg3)">${f.line}</span></div>
      <div style="display:flex;align-items:baseline;gap:6px"><span class="num" style="font-size:2.5rem;font-weight:900;letter-spacing:-.02em;line-height:1">${f.over ? f.overLabel : f.left}</span><span style="font-size:.9375rem;color:var(--c-fg2);font-weight:600">${f.over ? 'kcal oltre il target' : 'kcal'}</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;width:100%">
        ${f.macros.map(m => html`<div key=${m.k} style="display:flex;flex-direction:column;gap:6px"><span style="font-size:.75rem;color:var(--c-fg3)">${m.label}</span><span class="num" style="font-size:1.0625rem;font-weight:800">${m.left} g</span><div style="height:4px;border-radius:2px;background:var(--c-s3);overflow:hidden"><div style=${`height:4px;background:var(--c-acc);width:${m.pct}`}></div></div></div>`)}
      </div>
      ${f.logged ? null : html`<div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.4">Nessun pasto registrato oggi. Tocca per aggiungere la colazione: i rimanenti si aggiornano a ogni voce.</div>`}
    </button>`;
  }

  function recoverySlot() {
    return html`<div style="border:1px dashed var(--c-s3);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;justify-content:space-between;align-items:center"><span style=${S.eyebrow}>Recupero</span>${ui.soon('Garmin · in arrivo')}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${RECOVERY_TILES.map(r => html`<div key=${r.label} style="display:flex;flex-direction:column;gap:4px"><i class=${r.icon} style="font-size:20px;color:var(--c-fg3)"></i><span style="font-size:.75rem;color:var(--c-fg3)">${r.label}</span><span style="font-size:1.125rem;font-weight:800;color:var(--c-fg3)">— <span style="font-size:.75rem;font-weight:600">${r.unit}</span></span></div>`)}
      </div>
      <button onClick=${openProfile} style="font-size:.8125rem;color:var(--c-fg2);text-align:left;line-height:1.4">Con Garmin il check-in manuale viene sostituito da sonno, HRV e FC a riposo. <span style="font-weight:800;color:var(--c-fg);text-decoration:underline">Integrazioni</span></button>
    </div>`;
  }

  function oggiA(st, d, m) {
    return html`<div class="scroll" style=${S.tabScroll}>
      <header style="display:flex;justify-content:space-between;align-items:flex-start;padding:4px 4px 6px">
        <div><div style=${S.eyebrow}>${GT.fmtLong(d.today)}</div><h1 style=${S.h1}>Oggi</h1></div>
        ${avatar(st, 48)}
      </header>
      ${readinessCard(d)}
      ${planCards(st, d, m.gyms, m.cardios)}
      ${d.coachTip ? ui.coachCard('Coach', d.coachTip) : null}
      ${macroCard(m.food)}
      ${recoverySlot()}
    </div>`;
  }

  // ---------- variant B ("Focus") ----------
  function focusNumbers(st, d, m) {
    const g = m.gyms[0], c = m.cardios[0];
    if (g && g.rows.length) {
      const eff = effTarget(st, g.rpe);
      return [[g.rows.length, 'esercizi'], [g.sets, 'serie'], [`${g.min}'`, 'stimati'], [eff ? eff.value : '—', `${eff ? eff.label : 'RPE'} target`]];
    }
    if (c) {
      const dist = c.run ? GT.fmt(c.c.km) : GT.fk(c.c.m);
      return [[dist, c.run ? 'km' : 'metri'], [`${c.c.min}'`, 'stimati'], [c.c.blocks.length, 'blocchi'], [c.c.rpe, 'RPE target']];
    }
    const wr = GT.weekReview(st, GT.mondayOf(d.today)), T = d.targets;
    return [[wr.done, 'fatte'], [wr.planned, 'in settimana'], [`${T.p} g`, 'proteine'], [GT.fmt(T.water) + ' L', 'acqua']];
  }

  function focusTitle(m) {
    if (m.gyms[0]) return m.gyms[0].day.name;
    if (m.cardios[0]) return m.cardios[0].c.name;
    return 'Riposo';
  }

  function focusList(st, d, m) {
    const g = m.gyms[0];
    if (g) {
      if (!g.rows.length) {
        return html`<div style="display:flex;flex-direction:column;gap:12px">
          <div style="font-size:.9375rem;color:var(--c-fg2);line-height:1.45">Nessun esercizio in ${g.day.name}. Aggiungine almeno uno per poter iniziare.</div>
          ${secondaryBtn('Modifica giornata', () => openEditor(g.item.id), 'ph-light ph-pencil-simple')}
        </div>`;
      }
      return g.rows.map(e => html`<div key=${e.key} style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;font-size:.9375rem"><span><span class="num" style="color:var(--c-fg3);margin-right:10px">${e.n}</span>${e.name}</span><span class="num" style="color:var(--c-fg3);white-space:nowrap">${e.target}</span></div>`);
    }
    const c = m.cardios[0];
    if (c) {
      return c.c.blocks.map((b, i) => html`<div key=${i} style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;font-size:.9375rem"><span><span class="num" style="color:var(--c-fg3);margin-right:10px">${String(i + 1).padStart(2, '0')}</span>${b[0]}<span style="display:block;margin-left:30px;font-size:.8125rem;color:var(--c-fg3)">${b[1]}</span></span><span class="num" style="color:var(--c-fg3);white-space:nowrap">${b[2]}</span></div>`);
    }
    const next = nextPlanned(st, d);
    return next
      ? next.items.map((it, i) => html`<div key=${it.type + it.id} style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;font-size:.9375rem"><span><span class="num" style="color:var(--c-fg3);margin-right:10px">${String(i + 1).padStart(2, '0')}</span>${itemName(it)}</span><span style="color:var(--c-fg3);white-space:nowrap">${next.when}</span></div>`)
      : html`<div style="font-size:.9375rem;color:var(--c-fg2);line-height:1.45">Nessuna seduta nei prossimi 7 giorni. Imposta i giorni di allenamento dal Profilo.</div>`;
  }

  // Other items of today beyond the main one (e.g. gym + run on the same day)
  function focusExtras(m) {
    const extra = m.gyms[0] ? m.cardios : m.cardios.slice(1);
    if (!extra.length) return null;
    return html`<div style="padding:16px 20px;border-top:1px solid var(--c-line);display:flex;flex-direction:column;gap:2px">
      <div style=${S.eyebrow + ';margin-bottom:6px'}>Anche oggi</div>
      ${extra.map(c => html`<button key=${c.item.id} onClick=${c.open} style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;font-size:.9375rem;text-align:left;width:100%"><span><span style=${`font-size:.75rem;font-weight:800;color:${c.tagColor};margin-right:8px`}>${c.kindLabel}</span>${c.c.name}</span><span class="num" style="color:var(--c-fg3);white-space:nowrap">${c.item.done ? '✓ Fatto' : `${c.dist} · ${c.dur}`}</span></button>`)}
    </div>`;
  }

  function focusBar(st, d, m) {
    const g = m.gyms[0], c = m.cardios[0];
    let body = null;
    if (st.s) body = ui.cta(d.startLabel, () => A.startSession(), { h: 64, icon: 'ph-fill ph-play' });
    else if (g && g.done) body = html`<div class="num" style="height:64px;border-radius:14px;background:var(--c-s2);display:flex;align-items:center;justify-content:center;gap:10px;font-weight:800"><i class="ph-bold ph-check" style="font-size:18px"></i>Completato · ${g.doneLine}</div>`;
    else if (g && g.rows.length) body = ui.cta(d.startLabel, () => A.startSession(g.item.id), { h: 64, icon: 'ph-fill ph-play' });
    else if (!g && c && c.item.done) body = html`<div class="num" style="height:64px;border-radius:14px;background:var(--c-s2);display:flex;align-items:center;justify-content:center;gap:10px;font-weight:800"><i class="ph-bold ph-check" style="font-size:18px"></i>Fatto · ${c.doneLine}</div>`;
    else if (!g && c) body = ui.cta('Apri la seduta', c.open, { h: 64, icon: c.run ? 'ph-light ph-person-simple-run' : 'ph-light ph-swimming-pool' });
    else if (d.todayPlan.rest) {
      const dayAnyway = anywayDay(st, nextPlanned(st, d));
      if (dayAnyway && !GT.sessionsOn(st, d.today).length) body = secondaryBtn(`Allenati comunque · ${dayAnyway.name}`, () => A.startSession(dayAnyway.id), 'ph-light ph-barbell', 64);
    }
    if (!body) return null;
    return html`<div key="oggiBBar" style="position:absolute;left:0;right:0;bottom:var(--tabH);padding:12px 16px;background:var(--c-bg);border-top:1px solid var(--c-line);z-index:25">${body}</div>`;
  }

  function oggiB(st, d, m) {
    const title = focusTitle(m), nums = focusNumbers(st, d, m), f = m.food, rd = d.readiness;
    const big = title.length > 12 ? '2.75rem' : '4rem';
    const listLabel = m.gyms[0] ? 'In programma' : m.cardios[0] ? 'Blocchi' : 'Prossima seduta';
    const bar = focusBar(st, d, m);
    return [
      html`<div key="oggiB" class="scroll" style=${`position:absolute;inset:0;overflow-y:auto;padding:calc(var(--top) + 8px) 0 calc(var(--tabH) + ${bar ? 100 : 24}px);display:flex;flex-direction:column`}>
        <header style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:4px 20px 12px"><div style=${S.eyebrow}>${GT.fmtShort(d.today)} · ${weekLabel(st, d)}</div>${avatar(st, 44)}</header>
        <div style="padding:4px 20px 24px;border-bottom:1px solid var(--c-line)">
          <div style=${`font-size:${big};font-weight:900;letter-spacing:-.04em;line-height:.92;text-wrap:balance`}>${title}</div>
          <div style="display:flex;gap:20px;margin-top:16px;flex-wrap:wrap">
            ${nums.map(n => html`<div key=${n[1]}><div class="num" style="font-size:1.75rem;font-weight:900">${n[0]}</div><div style="font-size:.75rem;color:var(--c-fg3)">${n[1]}</div></div>`)}
          </div>
          ${d.coachTip ? html`<p style="margin:16px 0 0;font-size:.9375rem;line-height:1.45;color:var(--c-fg2);text-wrap:pretty">${d.coachTip}</p>` : null}
        </div>
        <button onClick=${openReadiness} aria-label=${rd ? `Readiness ${d.score}, ${rd.label}` : 'Fai il check-in di oggi'} style="display:grid;grid-template-columns:repeat(4,1fr);padding:16px 20px;border-bottom:1px solid var(--c-line);text-align:left">
          <div><div style="font-size:.6875rem;color:var(--c-fg3)">Readiness</div>${rd
            ? html`<div class="num" style="font-size:1.375rem;font-weight:900">${d.score}</div>`
            : html`<div style="font-size:1.375rem;font-weight:900;color:var(--c-fg3)">—</div><div style="font-size:.6875rem;font-weight:800;color:var(--c-acc-t)">Check-in</div>`}</div>
          <div><div style="font-size:.6875rem;color:var(--c-fg3)">Sonno</div><div style="font-size:1.375rem;font-weight:900;color:var(--c-fg3)">—</div></div>
          <div><div style="font-size:.6875rem;color:var(--c-fg3)">HRV</div><div style="font-size:1.375rem;font-weight:900;color:var(--c-fg3)">—</div></div>
          <div><div style="font-size:.6875rem;color:var(--c-fg3)">FC riposo</div><div style="font-size:1.375rem;font-weight:900;color:var(--c-fg3)">—</div></div>
        </button>
        <button onClick=${goNutri} style="padding:16px 20px;border-bottom:1px solid var(--c-line);display:flex;flex-direction:column;gap:10px;text-align:left">
          <div style="display:flex;justify-content:space-between;width:100%;align-items:baseline"><span style=${S.eyebrow}>${f.over ? 'Oltre il target' : 'Rimanenti'}</span><span class="num" style="font-size:1.375rem;font-weight:900">${f.over ? f.overLabel : f.left} <span style="font-size:.8125rem;font-weight:600;color:var(--c-fg2)">kcal</span></span></div>
          <div style="display:flex;gap:2px;height:8px;width:100%;border-radius:4px;overflow:hidden;background:var(--c-s3)"><div style=${`background:var(--c-acc);width:${f.pct}`}></div></div>
          <div class="num" style="display:flex;gap:16px;font-size:.875rem;color:var(--c-fg2)">${f.macros.map(x => html`<span key=${x.short}><b style="color:var(--c-fg)">${x.left}</b> ${x.short}</span>`)}<span style="margin-left:auto;color:var(--c-fg3)">${f.logged ? f.line : 'Nessun pasto registrato'}</span></div>
        </button>
        <div style="padding:16px 20px;display:flex;flex-direction:column;gap:2px">
          <div style=${S.eyebrow + ';margin-bottom:6px'}>${listLabel}</div>
          ${focusList(st, d, m)}
        </div>
        ${focusExtras(m)}
      </div>`,
      bar
    ];
  }

  GT.screens.oggi = function (st, d) {
    if (!st.plan) return null; // app.js shows the onboarding instead
    const items = d.todayPlan.items;
    const m = {
      gyms: items.filter(it => it.type === 'gym' && it.day).map(it => gymInfo(st, d, it)),
      cardios: items.filter(it => it.type !== 'gym' && it.cardio).map(cardioInfo),
      food: foodToday(st, d)
    };
    return GT.v('vOggi') === 'B' ? oggiB(st, d, m) : oggiA(st, d, m);
  };
})();
