/* GreyTraining — onboarding: the personal-trainer intake questionnaire (full screen).
   app.js shows it when there is no profile/plan yet, or when st.ob.edit is true
   ("Rifai il questionario" from Profile, answers prefilled from the profile).
   Draft: st.ob = { step, a, edit? }. The answers end up exactly in the profile shape documented
   at the top of js/plan.js (see full() below); empty fields take the documented defaults.
   Steps: 0 Benvenuto · 1 Chi sei · 2 Obiettivo · 3 Esperienza · 4 Disponibilità ·
   5 Attrezzatura (skipped with 0 gym days) · 6 Limitazioni · 7 Corsa · 8 Nuoto ·
   9 Stile di vita · 10 Alimentazione · 11 Riepilogo. */
(function () {
  'use strict';
  var GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  // ---------- defaults, ranges, options ----------
  const DEF = {
    gymDays: 3, sessionMin: 60, days: [], equipment: [], limitations: [],
    runs: false, run: { kmWeek: 10, perWeek: 2, testDist: 0, testTime: '' },
    swims: false, swim: { perWeek: 1 },
    activity: 'sedentario', sleepH: 7, diet: 'onnivora', allergies: [], mealsPerDay: 4, effort: 'RPE'
  };
  const WEIGHT_GOALS = ['massa', 'definizione', 'ricomposizione'];
  const RANGE = {
    age: { min: 14, max: 90, label: 'Età', unit: 'anni', dec: false },
    height: { min: 120, max: 230, label: 'Altezza', unit: 'cm', dec: false },
    weight: { min: 35, max: 250, label: 'Peso', unit: 'kg', dec: true },
    targetWeight: { min: 35, max: 250, label: 'Peso obiettivo', unit: 'kg', dec: true }
  };
  // Plausible test times (seconds): 5 km 12:00–60:00, 10 km 25:00–2:00:00
  const TIME_RANGE = { 5: [720, 3600], 10: [1500, 7200] };
  const GOAL_ICON = { massa: 'ph-barbell', definizione: 'ph-flame', ricomposizione: 'ph-scales', forza: 'ph-lightning', resistenza: 'ph-person-simple-run', salute: 'ph-heartbeat' };
  const ACT_ICON = { sedentario: 'ph-desktop', in_piedi: 'ph-person', attivo: 'ph-person-simple-walk', molto_attivo: 'ph-hammer' };
  const PRESETS = [
    { k: 'full', n: 'Palestra completa', d: 'Bilanciere, macchine, cavi e tutto il resto', icon: 'ph-buildings', eq: GT.EQUIPMENT.slice() },
    { k: 'home', n: 'Home gym', d: 'Bilanciere, rack, panca, manubri, sbarra', icon: 'ph-house-line', eq: ['Bilanciere', 'Rack', 'Panca', 'Manubri', 'Sbarra'] },
    { k: 'db', n: 'Casa con manubri', d: 'Manubri ed elastici', icon: 'ph-house', eq: ['Manubri', 'Elastici'] },
    { k: 'bw', n: 'Solo corpo libero', d: 'Nessun attrezzo', icon: 'ph-person-arms-spread', eq: [] }
  ];
  const DIETS = [['onnivora', 'Onnivora'], ['vegetariana', 'Vegetariana'], ['vegana', 'Vegana'], ['pescetariana', 'Pescetariana']];
  const ALLERGIES = ['Lattosio', 'Glutine', 'Frutta secca', 'Uova', 'Pesce', 'Crostacei', 'Soia'];
  const STEP_NAME = ['Benvenuto', 'Chi sei', 'Obiettivo', 'Esperienza', 'Disponibilità', 'Attrezzatura', 'Limitazioni', 'Corsa', 'Nuoto', 'Stile di vita', 'Alimentazione', 'Riepilogo'];
  const LAST = 11;

  // ---------- screen-local UI state (not persisted) ----------
  // raw: text typed in numeric fields (so "82," is not reformatted while typing)
  // tried: steps where Continua was pressed while incomplete (field errors become visible)
  // toSummary: the user jumped here from "Modifica" in the summary
  const L = { raw: {}, tried: {}, login: false, toSummary: false, mode: null };
  const resetLocal = () => { L.raw = {}; L.tried = {}; L.toSummary = false; };

  // ---------- helpers ----------
  const has = v => v !== undefined && v !== null && v !== '';
  const curA = () => (GT.state.ob && GT.state.ob.a) || {};
  const nameOf = (list, k) => (list.filter(x => x.k === k)[0] || {}).n || '—';
  const sameSet = (x, y) => x.length === y.length && x.every(v => y.indexOf(v) >= 0);
  const blur = () => { try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {} };

  // A.obSet / A.obStep rebuild st.ob without the `edit` flag; in edit mode keep it.
  const setA = patch => {
    if (GT.state.ob && GT.state.ob.edit) GT.set(s => ({ ob: Object.assign({}, s.ob, { a: Object.assign({}, s.ob.a, patch) }) }));
    else A.obSet(patch);
  };
  const goStep = n => {
    blur();
    if (GT.state.ob && GT.state.ob.edit) GT.set(s => ({ ob: Object.assign({}, s.ob, { step: Math.max(0, n) }) }));
    else A.obStep(n);
  };
  const setRun = patch => setA({ run: Object.assign({}, DEF.run, curA().run || {}, patch) });
  const setSwim = patch => setA({ swim: Object.assign({}, DEF.swim, curA().swim || {}, patch) });

  // Answers -> profile (exact shape of js/plan.js), defaults for empty fields
  function full(a) {
    const pick = k => (has(a[k]) ? a[k] : DEF[k]);
    const gymDays = Math.max(0, Math.min(6, Math.round(Number(pick('gymDays')) || 0)));
    const days = (Array.isArray(a.days) ? a.days : []).filter(x => x >= 0 && x <= 6).slice().sort((x, y) => x - y);
    const run = Object.assign({}, DEF.run, a.run || {});
    run.kmWeek = Number(run.kmWeek) || DEF.run.kmWeek;
    run.perWeek = Number(run.perWeek) || DEF.run.perWeek;
    run.testDist = Number(run.testDist) === 5 || Number(run.testDist) === 10 ? Number(run.testDist) : 0;
    run.testTime = run.testDist ? String(run.testTime || '') : '';
    const swim = { perWeek: Math.max(1, Math.min(3, Number((a.swim || {}).perWeek) || DEF.swim.perWeek)) };
    return {
      name: String(a.name || '').trim(),
      sex: a.sex,
      age: has(a.age) ? Number(a.age) : null,
      height: has(a.height) ? Number(a.height) : null,
      weight: has(a.weight) ? Number(a.weight) : null,
      goal: a.goal,
      targetWeight: WEIGHT_GOALS.indexOf(a.goal) >= 0 && has(a.targetWeight) ? Number(a.targetWeight) : null,
      experience: a.experience,
      gymDays: gymDays,
      sessionMin: Number(pick('sessionMin')) || DEF.sessionMin,
      days: gymDays && days.length === gymDays ? days : [],
      equipment: (pick('equipment') || []).slice(),
      limitations: (pick('limitations') || []).map(l => ({ k: l.k, note: String(l.note || '').trim() })),
      runs: !!pick('runs'), run: run,
      swims: !!pick('swims'), swim: swim,
      activity: pick('activity'),
      sleepH: Number(pick('sleepH')) || DEF.sleepH,
      diet: pick('diet'),
      allergies: (pick('allergies') || []).slice(),
      mealsPerDay: Number(pick('mealsPerDay')) || DEF.mealsPerDay,
      effort: pick('effort') === 'RIR' ? 'RIR' : 'RPE'
    };
  }

  // Steps that apply to these answers (equipment is skipped without gym days)
  const flowOf = p => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter(s => !(s === 5 && !p.gymDays));
  const nextOf = (s, p) => { let n = s + 1; if (n === 5 && !p.gymDays) n = 6; return Math.min(LAST, n); };
  const prevOf = (s, p, edit) => { let n = s - 1; if (n === 5 && !p.gymDays) n = 4; return Math.max(edit ? 1 : 0, n); };

  // ---------- validation ----------
  const inRange = (k, v) => has(v) && !isNaN(Number(v)) && Number(v) >= RANGE[k].min && Number(v) <= RANGE[k].max;
  const typed = k => has(L.raw[k]) && String(L.raw[k]).trim() !== '';
  const rangeMsg = k => `${RANGE[k].label}: tra ${RANGE[k].min} e ${RANGE[k].max} ${RANGE[k].unit}`;
  const timeOk = run => {
    const d = Number(run.testDist);
    if (!d) return true;
    const t = String(run.testTime || '');
    if (!/^\d{1,3}:[0-5]\d$/.test(t)) return false;
    const s = GT.parseTime(t), r = TIME_RANGE[d];
    return s >= r[0] && s <= r[1];
  };

  // First thing missing on a step ('' = complete)
  function issue(step, a, p) {
    if (step === 1) {
      if (!String(a.name || '').trim()) return 'Scrivi il tuo nome';
      if (a.sex !== 'm' && a.sex !== 'f') return 'Scegli Uomo o Donna';
      for (const k of ['age', 'height', 'weight']) if (!inRange(k, a[k])) return rangeMsg(k);
      return '';
    }
    if (step === 2) {
      if (!a.goal) return 'Scegli un obiettivo';
      if (WEIGHT_GOALS.indexOf(a.goal) >= 0 && (has(a.targetWeight) || typed('targetWeight')) && !inRange('targetWeight', a.targetWeight)) return rangeMsg('targetWeight') + ', oppure lascia vuoto';
      return '';
    }
    if (step === 3) return a.experience ? '' : 'Scegli il tuo livello';
    if (step === 4) {
      const sel = Array.isArray(a.days) ? a.days : [];
      if (p.gymDays && sel.length && sel.length !== p.gymDays) return `Scegli ${p.gymDays} giorni, oppure nessuno`;
      return '';
    }
    if (step === 7) {
      if (p.runs && p.run.testDist && !timeOk(p.run)) return 'Scrivi il tempo in mm:ss, oppure scegli Non lo so';
      return '';
    }
    return '';
  }

  // ---------- building blocks ----------
  const errLine = msg => (msg ? html`<div role="alert" style="font-size:.8125rem;line-height:1.4;color:var(--c-acc-t);font-weight:700">${msg}</div>` : null);
  const note = text => html`<div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.45">${text}</div>`;
  const label = (text, extra) => ui.eyebrow(text, 'margin-top:14px' + (extra ? ';' + extra : ''));

  const radio = on => html`<span aria-hidden="true" style=${`flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;${on ? 'background:var(--c-acc);color:var(--c-on-acc)' : 'border:2px solid var(--c-s3)'}`}>${on ? html`<i class="ph-bold ph-check" style="font-size:14px"></i>` : null}</span>`;

  // Single-choice card: title + one-line description
  const card = o => html`<button key=${o.k} type="button" class="press" onClick=${o.go} aria-pressed=${!!o.on} style=${`width:100%;min-height:68px;padding:14px 16px;border-radius:12px;background:var(--c-s1);border:1px solid ${o.on ? 'var(--c-acc)' : 'var(--c-line)'};box-shadow:${o.on ? 'inset 0 0 0 1px var(--c-acc)' : 'none'};display:flex;align-items:center;gap:14px;text-align:left`}>
    ${o.icon ? html`<i class=${'ph-light ' + o.icon} style="font-size:26px;flex:none"></i>` : null}
    <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><span style="font-weight:900;font-size:1.0625rem">${o.n}</span>${o.d ? html`<span style="font-size:.8125rem;color:var(--c-fg3);line-height:1.35">${o.d}</span>` : null}</span>
    ${radio(o.on)}
  </button>`;
  const cards = list => html`<div style="display:flex;flex-direction:column;gap:8px">${list.map(card)}</div>`;

  // Row of equal single-choice buttons. opts: [[value, label], …]
  const options = (opts, cur, fn, aria, cols) => html`<div role="group" aria-label=${aria} style=${`display:grid;grid-template-columns:repeat(${cols || opts.length},minmax(0,1fr));gap:8px`}>
    ${opts.map(o => {
      const on = o[0] === cur;
      return html`<button key=${String(o[0])} type="button" class="press" onClick=${() => fn(o[0])} aria-pressed=${on} style=${`height:56px;border-radius:12px;font-weight:800;font-size:.9375rem;background:${on ? 'var(--c-acc)' : 'var(--c-s1)'};color:${on ? 'var(--c-on-acc)' : 'var(--c-fg)'};border:1px solid ${on ? 'var(--c-acc)' : 'var(--c-s3)'}`}>${o[1]}</button>`;
    })}
  </div>`;

  // Multi-choice chips. items: [{ k, l, on, go }]
  const chips = (items, aria) => html`<div role="group" aria-label=${aria} style="display:flex;flex-wrap:wrap;gap:8px">
    ${items.map(c => html`<button key=${c.k} type="button" onClick=${c.go} aria-pressed=${!!c.on} style=${`height:52px;padding:0 18px;border-radius:999px;font-size:.9375rem;font-weight:800;display:flex;align-items:center;gap:6px;background:${c.on ? 'var(--c-acc)' : 'transparent'};color:${c.on ? 'var(--c-on-acc)' : 'var(--c-fg)'};border:1px solid ${c.on ? 'var(--c-acc)' : 'var(--c-s3)'}`}>${c.on ? html`<i class="ph-bold ph-check" style="font-size:14px"></i>` : null}${c.l}</button>`)}
  </div>`;

  // − value + for small numbers. o: { label, value, min, max, step, fmt, sub, set }
  const stepper = o => {
    const round = v => Math.round(v * 10) / 10;
    const btn = (icon, aria, go, off) => html`<button type="button" class="press" onClick=${go} disabled=${off} aria-label=${aria} style=${`flex:none;width:56px;height:56px;border-radius:12px;background:var(--c-s2);display:grid;place-items:center;opacity:${off ? 0.35 : 1}`}><i class=${'ph-bold ' + icon} style="font-size:20px"></i></button>`;
    return html`<div style=${S.card + ';padding:10px;display:flex;align-items:center;gap:10px'}>
      ${btn('ph-minus', 'Diminuisci ' + o.label, () => o.set(Math.max(o.min, round(o.value - o.step))), o.value <= o.min)}
      <div style="flex:1;min-width:0;text-align:center" aria-live="polite">
        <div class="num" style="font-size:1.75rem;font-weight:900;line-height:1.1;letter-spacing:-.01em">${o.fmt(o.value)}</div>
        ${o.sub ? html`<div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">${o.sub}</div>` : null}
      </div>
      ${btn('ph-plus', 'Aumenta ' + o.label, () => o.set(Math.min(o.max, round(o.value + o.step))), o.value >= o.max)}
    </div>`;
  };

  const inputBox = err => `display:flex;align-items:center;gap:6px;height:56px;padding:0 14px;border-radius:12px;background:var(--c-s1);border:1px solid ${err ? 'var(--c-acc)' : 'var(--c-s3)'}`;
  const inputInner = 'flex:1;min-width:0;width:100%;height:100%;border:0;outline:0;background:transparent;padding:0;font-size:1.375rem;font-weight:900;font-variant-numeric:tabular-nums';
  const textField = (err, extra) => `height:56px;width:100%;border-radius:12px;background:var(--c-s1);border:1px solid ${err ? 'var(--c-acc)' : 'var(--c-s3)'};padding:0 16px;font-size:1.0625rem;font-weight:700;outline:0${extra ? ';' + extra : ''}`;

  // Numeric field with unit suffix (inputmode decimal, comma decimals)
  const fieldErr = (k, a, tried) => !inRange(k, a[k]) && (typed(k) || tried);
  function numField(k, a, tried) {
    const R = RANGE[k], err = fieldErr(k, a, tried);
    const val = L.raw[k] != null ? L.raw[k] : has(a[k]) ? GT.fmt(a[k]) : '';
    const onInput = e => {
      const t = e.target.value, n = GT.num(t);
      L.raw[k] = t;
      setA({ [k]: n == null ? null : R.dec ? Math.round(n * 10) / 10 : Math.round(n) });
    };
    return html`<label key=${k} style="display:flex;flex-direction:column;gap:6px;min-width:0">
      <span style=${S.eyebrow}>${R.label}</span>
      <span style=${inputBox(err)}>
        <input type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next" value=${val} onInput=${onInput} aria-invalid=${err} style=${inputInner} />
        <span aria-hidden="true" style="flex:none;font-size:.8125rem;font-weight:700;color:var(--c-fg3)">${R.unit}</span>
      </span>
    </label>`;
  }

  // Exercises of the library that need only this equipment
  const exCount = eq => GT.CATALOG.filter(e => e.req.every(q => eq.indexOf(q) >= 0)).length;
  // Weekdays the generator picks when the user leaves the choice to the app
  function defaultGymDays(p) {
    try {
      const plan = GT.generatePlan(Object.assign({}, p, { days: [] }), GT.todayISO());
      return plan.week.filter(w => w.items.some(it => it.type === 'gym')).map(w => GT.DAYS_SHORT[w.wd]);
    } catch (e) { return []; }
  }
  // Gym days the generator would leave without exercises (equipment, limitations and level
  // leave no option for any pattern). Such a day cannot be started, so the plan is not created.
  function emptyDays(p) {
    if (!p.gymDays) return [];
    try { return GT.generatePlan(p, GT.todayISO()).days.filter(x => !x.ex.length).map(x => x.name); } catch (e) { return []; }
  }
  const joinNames = arr => arr.length > 1 ? arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1] : (arr[0] || '');

  // ---------- steps: each returns { eyebrow, title, why, body } ----------
  function stepWho(a) {
    const tried = !!L.tried[1], nameErr = tried && !String(a.name || '').trim();
    const sexErr = tried && a.sex !== 'm' && a.sex !== 'f';
    const errs = ['age', 'height', 'weight'].filter(k => fieldErr(k, a, tried)).map(rangeMsg);
    return {
      eyebrow: 'Chi sei', title: 'Partiamo da te',
      why: 'Età, altezza e peso servono a calcolare metabolismo e calorie di partenza.',
      body: html`
        <label style="display:flex;flex-direction:column;gap:6px">
          <span style=${S.eyebrow}>Nome</span>
          <input type="text" value=${a.name || ''} onInput=${e => setA({ name: e.target.value })} autocomplete="given-name" autocapitalize="words" enterkeyhint="next" aria-invalid=${nameErr} style=${textField(nameErr)} />
        </label>
        ${label('Sesso')}
        ${options([['m', 'Uomo'], ['f', 'Donna']], a.sex, v => setA({ sex: v }), 'Sesso')}
        ${sexErr ? errLine('Scegli Uomo o Donna') : note('Serve per stimare il metabolismo.')}
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px">
          ${['age', 'height', 'weight'].map(k => numField(k, a, tried))}
        </div>
        ${errLine(errs.join(' · '))}`
    };
  }

  function stepGoal(a) {
    const weightGoal = WEIGHT_GOALS.indexOf(a.goal) >= 0;
    let delta = null;
    if (weightGoal && inRange('targetWeight', a.targetWeight) && inRange('weight', a.weight)) {
      const dkg = Math.round((Number(a.targetWeight) - Number(a.weight)) * 10) / 10;
      delta = dkg === 0 ? 'Uguale al peso di oggi.' : `${dkg > 0 ? '+' : '−'}${GT.fmt(Math.abs(dkg))} kg rispetto a oggi (${GT.fmt(a.weight)} kg).`;
    }
    const tw = fieldErr('targetWeight', a, false);
    return {
      eyebrow: 'Obiettivo', title: 'Cosa vuoi ottenere?',
      why: 'Decide calorie, proteine e come imposto ripetizioni e recuperi.',
      body: html`
        ${cards(GT.GOALS.map(g => ({ k: g.k, n: g.n, d: g.d, icon: GOAL_ICON[g.k], on: a.goal === g.k, go: () => setA({ goal: g.k }) })))}
        ${weightGoal ? html`
          <div style="height:6px"></div>
          ${numField('targetWeight', a, false)}
          ${tw ? errLine(rangeMsg('targetWeight')) : note(delta ? 'Facoltativo. ' + delta : 'Facoltativo: lascia vuoto se non hai un numero in mente, seguo l’andamento del peso settimana per settimana.')}` : null}`
    };
  }

  function stepExperience(a, p) {
    return {
      eyebrow: 'Esperienza', title: 'Da quanto ti alleni?',
      why: 'Scelgo esercizi, numero di serie e intensità adatti al tuo livello.',
      body: html`
        ${cards(GT.EXPERIENCE.map(x => ({ k: x.k, n: x.n, d: x.d, on: a.experience === x.k, go: () => setA({ experience: x.k }) })))}
        ${label('Come vuoi misurare lo sforzo?')}
        ${cards([
          { k: 'RPE', n: 'RPE · quanto è dura', d: 'Voto da 1 a 10 alla fatica della serie. RPE 10 = cedimento, nessuna ripetizione in più.', on: p.effort === 'RPE', go: () => setA({ effort: 'RPE' }) },
          { k: 'RIR', n: 'RIR · quante ne restano', d: 'Ripetizioni che avresti ancora potuto fare. RIR 2 = ti fermi a due dal cedimento (RPE 8).', on: p.effort === 'RIR', go: () => setA({ effort: 'RIR' }) }
        ])}
        ${note('Puoi cambiarlo quando vuoi dal Profilo.')}`
    };
  }

  function stepAvailability(a, p) {
    const n = p.gymDays, sel = Array.isArray(a.days) ? a.days : [];
    const toggleDay = i => {
      const cur = (curA().days || []).slice(), j = cur.indexOf(i);
      if (j >= 0) cur.splice(j, 1); else cur.push(i);
      setA({ days: cur.sort((x, y) => x - y) });
    };
    const auto = n && !sel.length ? defaultGymDays(p) : [];
    const daysLine = !sel.length ? `Scegline ${n}, oppure lascia decidere a me${auto.length ? ': ' + auto.join(', ') : ''}.`
      : sel.length === n ? `${sel.length} di ${n} · ${sel.map(i => GT.DAYS_SHORT[i]).join(', ')}.`
      : `${sel.length} di ${n}: scegline esattamente ${n}, oppure toglili tutti e decido io.`;
    return {
      eyebrow: 'Disponibilità', title: 'Quanto tempo hai?',
      why: 'Con giorni e durata scelgo come dividere la settimana e quanti esercizi entrano in una seduta.',
      body: html`
        ${ui.eyebrow('Giorni di palestra a settimana')}
        ${stepper({ label: 'giorni di palestra', value: n, min: 0, max: 6, step: 1, fmt: v => String(v), sub: n === 0 ? 'niente palestra' : n === 1 ? 'giorno a settimana' : 'giorni a settimana', set: v => setA({ gymDays: v }) })}
        ${n ? html`
          ${label('Durata della seduta')}
          ${options([[45, '45 min'], [60, '60 min'], [75, '75 min'], [90, '90 min']], p.sessionMin, v => setA({ sessionMin: v }), 'Durata della seduta')}
          ${label('Giorni preferiti · facoltativo')}
          <div role="group" aria-label="Giorni preferiti" style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px">
            ${GT.DAYS_LETTER.map((l, i) => {
              const on = sel.indexOf(i) >= 0;
              return html`<button key=${'d' + i} type="button" onClick=${() => toggleDay(i)} aria-pressed=${on} aria-label=${GT.DAYS_LONG[i]} style=${`height:52px;border-radius:10px;font-weight:900;font-size:1rem;background:${on ? 'var(--c-acc)' : 'var(--c-s1)'};color:${on ? 'var(--c-on-acc)' : 'var(--c-fg)'};border:1px solid ${on ? 'var(--c-acc)' : 'var(--c-s3)'}`}>${l}</button>`;
            })}
          </div>
          ${sel.length && sel.length !== n && L.tried[4] ? errLine(daysLine) : note(daysLine)}`
        : note('Nessuna palestra: il piano si concentra su corsa, nuoto e alimentazione. La domanda sull’attrezzatura la salto.')}`
    };
  }

  function stepEquipment(a, p) {
    const eq = p.equipment, empty = emptyDays(p);
    const toggle = x => {
      const cur = (curA().equipment || []).slice(), j = cur.indexOf(x);
      if (j >= 0) cur.splice(j, 1); else cur.push(x);
      setA({ equipment: GT.EQUIPMENT.filter(e => cur.indexOf(e) >= 0) });
    };
    return {
      eyebrow: 'Attrezzatura', title: 'Dove ti alleni?',
      why: 'Metto nel piano solo esercizi che puoi fare davvero con quello che hai.',
      body: html`
        ${cards(PRESETS.map(x => ({ k: x.k, n: x.n, d: `${x.d} · ${exCount(x.eq)} esercizi`, icon: x.icon, on: sameSet(eq, x.eq), go: () => setA({ equipment: x.eq.slice() }) })))}
        ${label('Rifinisci')}
        ${chips(GT.EQUIPMENT.map(x => ({ k: x, l: x, on: eq.indexOf(x) >= 0, go: () => toggle(x) })), 'Attrezzatura disponibile')}
        ${note(`Il corpo libero è sempre incluso. Con questa attrezzatura: ${exCount(eq)} esercizi su ${GT.CATALOG.length} della libreria.`)}
        ${empty.length ? errLine(`${joinNames(empty)}: nessun esercizio possibile con questa attrezzatura. Aggiungi un attrezzo (anche solo gli elastici) oppure scegli meno giorni.`) : null}`
    };
  }

  function stepLimits(a, p) {
    const lims = p.limitations, keys = lims.map(l => l.k);
    // The details field shows the untrimmed draft, so spaces typed between words survive
    const draftNote = Array.isArray(a.limitations) && a.limitations[0] ? String(a.limitations[0].note || '') : '';
    const toggle = k => {
      const cur = (curA().limitations || []).slice(), j = cur.map(l => l.k).indexOf(k);
      const noteTxt = cur.length ? cur[0].note || '' : '';
      if (j >= 0) cur.splice(j, 1); else cur.push({ k: k, note: noteTxt });
      setA({ limitations: GT.LIMITS.map(x => cur.filter(l => l.k === x.k)[0]).filter(Boolean) });
    };
    const setNote = v => setA({ limitations: (curA().limitations || []).map(l => Object.assign({}, l, { note: v })) });
    const excluded = GT.CATALOG.filter(e => e.avoid.some(x => keys.indexOf(x) >= 0)).length;
    const items = [{ k: 'none', l: 'Nessuna', on: !lims.length, go: () => setA({ limitations: [] }) }]
      .concat(GT.LIMITS.map(x => ({ k: x.k, l: x.n, on: keys.indexOf(x.k) >= 0, go: () => toggle(x.k) })));
    return {
      eyebrow: 'Infortuni e limitazioni', title: 'Qualcosa da proteggere?',
      why: 'Tolgo dal piano gli esercizi che caricano le zone che segnali.',
      body: html`
        ${chips(items, 'Zone da proteggere')}
        ${lims.length ? html`
          ${label('Dettagli · facoltativo')}
          <input type="text" value=${draftNote} onInput=${e => setNote(e.target.value)} placeholder="Cosa dà fastidio, da quando, in quali movimenti" aria-label="Dettagli sulla limitazione" enterkeyhint="done" style=${textField(false, 'font-size:1rem;font-weight:600')} />
          ${note(`Escludo ${excluded} esercizi su ${GT.CATALOG.length} della libreria: ${lims.map(l => nameOf(GT.LIMITS, l.k).toLowerCase()).join(', ')}.`)}` : null}
        <div style="margin-top:14px;border:1px dashed var(--c-s3);border-radius:12px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start">
          <i class="ph-light ph-first-aid-kit" style="font-size:22px;color:var(--c-fg3);flex:none"></i>
          <div style="font-size:.8125rem;color:var(--c-fg2);line-height:1.45">Dolore acuto o persistente: fatti valutare da un medico o da un fisioterapista prima di allenare la zona. Il piano lascia fuori gli esercizi che la stressano, ma non sostituisce una valutazione.</div>
        </div>`
    };
  }

  function stepRun(a, p) {
    const run = p.run, tried = !!L.tried[7];
    const onTime = e => {
      const dg = String(e.target.value).replace(/\D/g, '').slice(0, 5);
      setRun({ testTime: dg.length > 2 ? dg.slice(0, -2) + ':' + dg.slice(-2) : dg });
    };
    const ok = timeOk(run), secs = ok && run.testDist ? GT.parseTime(run.testTime) : 0;
    const timeErr = run.testDist && !ok && (tried || String(run.testTime).length >= 4);
    return {
      eyebrow: 'Corsa', title: 'Corri?',
      why: 'Con volume e un tempo recente calcolo uscite, ritmi e zone di passo.',
      body: html`
        ${options([[true, 'Sì'], [false, 'No']], p.runs, v => setA({ runs: v }), 'Corri?')}
        ${p.runs ? html`
          ${label('Chilometri a settimana')}
          ${stepper({ label: 'chilometri a settimana', value: run.kmWeek, min: 5, max: 80, step: 5, fmt: v => GT.fmt(v) + ' km', sub: 'a settimana, in media', set: v => setRun({ kmWeek: v }) })}
          ${label('Uscite a settimana')}
          ${stepper({ label: 'uscite a settimana', value: run.perWeek, min: 1, max: 5, step: 1, fmt: v => String(v), sub: run.perWeek === 1 ? 'uscita' : 'uscite', set: v => setRun({ perWeek: v }) })}
          ${label('Un tempo recente')}
          ${options([[5, '5 km'], [10, '10 km'], [0, 'Non lo so']], run.testDist, v => setRun({ testDist: v, testTime: v === run.testDist ? run.testTime : '' }), 'Distanza del tempo recente')}
          ${run.testDist ? html`
            <label style="display:flex;flex-direction:column;gap:6px;margin-top:6px">
              <span style=${S.eyebrow}>${`Tempo sui ${run.testDist} km`}</span>
              <span style=${inputBox(timeErr)}>
                <input type="text" inputmode="numeric" autocomplete="off" placeholder="mm:ss" value=${run.testTime} onInput=${onTime} aria-invalid=${!!timeErr} style=${inputInner} />
                <span aria-hidden="true" style="flex:none;font-size:.8125rem;font-weight:700;color:var(--c-fg3)">min:s</span>
              </span>
            </label>
            ${timeErr ? errLine(`Tempo non valido: scrivi minuti e secondi, tra ${GT.mmss(TIME_RANGE[run.testDist][0])} e ${GT.mmss(TIME_RANGE[run.testDist][1])}.`)
              : secs ? note(`Passo medio ${GT.pace(secs / run.testDist)}/km: da qui calcolo le zone di corsa.`) : note('Scrivi solo le cifre: i due punti li metto io.')}`
          : note('Senza un tempo stimo le zone dal volume settimanale. Dopo una prova su 5 km le aggiorni rifacendo il questionario dal Profilo.')}` : null}`
    };
  }

  function stepSwim(a, p) {
    return {
      eyebrow: 'Nuoto', title: 'Nuoti?',
      why: 'In piscina il piano usa il nuoto come defaticamento e recupero attivo.',
      body: html`
        ${options([[true, 'Sì'], [false, 'No']], p.swims, v => setA({ swims: v }), 'Nuoti?')}
        ${p.swims ? html`
          ${label('Sedute a settimana')}
          ${stepper({ label: 'sedute di nuoto', value: p.swim.perWeek, min: 1, max: 3, step: 1, fmt: v => String(v), sub: p.swim.perWeek === 1 ? 'seduta a settimana' : 'sedute a settimana', set: v => setSwim({ perWeek: v }) })}
          ${note('Sedute brevi e facili, di preferenza nei giorni senza palestra.')}` : null}`
    };
  }

  function stepLife(a, p) {
    return {
      eyebrow: 'Stile di vita', title: 'Quanto ti muovi fuori dalla palestra?',
      why: 'Il movimento di ogni giorno pesa molto sul consumo calorico.',
      body: html`
        ${cards(GT.ACTIVITY.map(x => ({ k: x.k, n: x.n, d: x.d, icon: ACT_ICON[x.k], on: p.activity === x.k, go: () => setA({ activity: x.k }) })))}
        ${label('Ore di sonno')}
        ${stepper({ label: 'ore di sonno', value: p.sleepH, min: 4, max: 10, step: 0.5, fmt: v => GT.fmt(v) + ' h', sub: 'a notte, in media', set: v => setA({ sleepH: v }) })}
        ${p.sleepH < 7 ? note('Sotto le 7 ore recupero e progressione dei carichi rallentano: punta a 7–9.') : null}`
    };
  }

  function stepFood(a, p) {
    const chipSel = p.allergies.filter(x => ALLERGIES.indexOf(x) >= 0);
    const extras = p.allergies.filter(x => ALLERGIES.indexOf(x) < 0);
    const toggle = x => {
      const cur = (curA().allergies || []).slice(), j = cur.indexOf(x);
      if (j >= 0) cur.splice(j, 1); else cur.push(x);
      setA({ allergies: cur });
    };
    const onOther = e => {
      const t = e.target.value;
      L.raw.allergyText = t;
      const sel = (curA().allergies || []).filter(x => ALLERGIES.indexOf(x) >= 0);
      const more = t.split(/[,;]/).map(s => s.trim()).filter(Boolean).filter(x => sel.indexOf(x) < 0);
      setA({ allergies: sel.concat(more) });
    };
    const other = L.raw.allergyText != null ? L.raw.allergyText : extras.join(', ');
    return {
      eyebrow: 'Alimentazione', title: 'Come mangi?',
      why: 'Distribuisco calorie e proteine sui tuoi pasti. Allergie e intolleranze le tiene presenti il coach quando suggerisce cosa mangiare.',
      body: html`
        ${ui.eyebrow('Dieta')}
        ${options(DIETS, p.diet, v => setA({ diet: v }), 'Dieta', 2)}
        ${p.diet === 'vegana' ? note('Con dieta vegana alzo le proteine di 0,2 g per kg di peso.') : null}
        ${label('Allergie e intolleranze · facoltativo')}
        ${chips(ALLERGIES.map(x => ({ k: x, l: x, on: chipSel.indexOf(x) >= 0, go: () => toggle(x) })), 'Allergie e intolleranze')}
        <input type="text" value=${other} onInput=${onOther} placeholder="Altro, separato da virgole" aria-label="Altre allergie o intolleranze" enterkeyhint="done" style=${textField(false, 'font-size:1rem;font-weight:600')} />
        ${label('Pasti al giorno')}
        ${options([[3, '3'], [4, '4'], [5, '5']], p.mealsPerDay, v => setA({ mealsPerDay: v }), 'Pasti al giorno')}
        ${note(GT.mealsFor({ mealsPerDay: p.mealsPerDay }).join(' · '))}`
    };
  }

  // ---------- summary ----------
  const modBtn = (step, what) => html`<button type="button" onClick=${() => { L.toSummary = true; goStep(step); }} aria-label=${'Modifica ' + what} style="flex:none;height:44px;margin:-6px -4px -6px 0;padding:0 4px;font-weight:800;font-size:.875rem;color:var(--c-fg);text-decoration:underline;text-underline-offset:3px">Modifica</button>`;
  const secHead = (text, step) => html`<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:32px"><span style=${S.eyebrow}>${text}</span>${modBtn(step, text.toLowerCase())}</div>`;

  function answerRows(p) {
    const preset = PRESETS.filter(x => sameSet(p.equipment, x.eq))[0];
    const limNote = p.limitations.length && p.limitations[0].note ? ` · “${p.limitations[0].note}”` : '';
    return [
      [1, 'Chi sei', `${p.name} · ${p.sex === 'f' ? 'Donna' : 'Uomo'} · ${GT.fmt(p.age)} anni · ${GT.fmt(p.height)} cm · ${GT.fmt(p.weight)} kg`],
      [2, 'Obiettivo', nameOf(GT.GOALS, p.goal) + (p.targetWeight ? ` · peso obiettivo ${GT.fmt(p.targetWeight)} kg` : '')],
      [3, 'Esperienza', `${nameOf(GT.EXPERIENCE, p.experience)} · sforzo in ${p.effort}`],
      [4, 'Disponibilità', p.gymDays ? `${p.gymDays} ${p.gymDays === 1 ? 'giorno' : 'giorni'} da ${p.sessionMin} min · ${p.days.length ? p.days.map(i => GT.DAYS_SHORT[i]).join(', ') : 'giorni scelti da me'}` : 'Niente palestra'],
      p.gymDays ? [5, 'Attrezzatura', preset ? preset.n : p.equipment.join(', ')] : null,
      [6, 'Limitazioni', p.limitations.length ? p.limitations.map(l => nameOf(GT.LIMITS, l.k)).join(', ') + limNote : 'Nessuna'],
      [7, 'Corsa', p.runs ? `${GT.fmt(p.run.kmWeek)} km in ${p.run.perWeek} ${p.run.perWeek === 1 ? 'uscita' : 'uscite'} a settimana${p.run.testDist ? ` · ${p.run.testDist} km in ${p.run.testTime}` : ''}` : 'No'],
      [8, 'Nuoto', p.swims ? `${p.swim.perWeek} ${p.swim.perWeek === 1 ? 'seduta' : 'sedute'} a settimana` : 'No'],
      [9, 'Stile di vita', `${nameOf(GT.ACTIVITY, p.activity)} · ${GT.fmt(p.sleepH)} h di sonno`],
      [10, 'Alimentazione', `${(DIETS.filter(x => x[0] === p.diet)[0] || ['', '—'])[1]} · ${p.mealsPerDay} pasti${p.allergies.length ? ' · senza ' + p.allergies.join(', ').toLowerCase() : ''}`]
    ].filter(Boolean);
  }

  function weekRows(plan) {
    return plan.week.map(w => {
      const items = w.items.map(it => {
        if (it.type === 'gym') {
          const day = GT.findDay(plan, it.id);
          return day ? { k: it.id, icon: 'ph-barbell', acc: true, t: day.name, sub: day.focus, min: GT.dayMinutes(day) } : null;
        }
        const c = GT.findCardio(plan, it.id);
        return c ? { k: it.type + it.id, icon: it.type === 'run' ? 'ph-person-simple-run' : 'ph-swimming-pool', acc: false, t: c.name, sub: it.type === 'run' ? c.tag : 'Nuoto · ' + c.tag, min: c.min } : null;
      }).filter(Boolean);
      return html`<div key=${'w' + w.wd} style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--c-line)">
        <span style="flex:none;width:36px;font-size:.8125rem;font-weight:800;color:var(--c-fg3);line-height:1.5">${GT.DAYS_SHORT[w.wd]}</span>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px">
          ${items.length ? items.map(x => html`<div key=${x.k} style="display:flex;gap:10px;align-items:flex-start">
              <i class=${'ph-light ' + x.icon} style=${`font-size:20px;flex:none;color:${x.acc ? 'var(--c-acc-t)' : 'var(--c-fg2)'}`}></i>
              <div style="flex:1;min-width:0"><div style="font-weight:800;font-size:.9375rem;line-height:1.3">${x.t}</div><div style="font-size:.75rem;color:var(--c-fg3);line-height:1.35;margin-top:1px">${x.sub}</div></div>
              <span class="num" style="flex:none;font-size:.8125rem;font-weight:700;color:var(--c-fg3)">${x.min ? `${x.min} min` : ''}</span>
            </div>`)
            : html`<span style="font-size:.875rem;color:var(--c-fg3);line-height:1.5">Riposo</span>`}
        </div>
      </div>`;
    });
  }

  function stepSummary(a, p, edit, missing, emptyPlan) {
    if (missing) {
      return {
        eyebrow: 'Riepilogo', title: emptyPlan ? 'Una seduta resta vuota' : 'Manca ancora qualcosa',
        why: emptyPlan ? 'Con attrezzatura, limitazioni e livello indicati non trovo esercizi per ogni giorno di palestra. Una seduta senza esercizi non si può iniziare.'
          : 'Calorie e piano li calcolo solo sulle tue risposte, senza valori inventati.',
        body: html`<div style=${S.card + ';padding:6px 16px'}>
          ${missing.map(m => html`<div key=${'m' + m.step} style="display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--c-line)">
            <div style="flex:1;min-width:0"><div style=${S.eyebrow}>${STEP_NAME[m.step]}</div><div style="font-size:.9375rem;font-weight:700;margin-top:3px">${m.msg}</div></div>
            ${modBtn(m.step, STEP_NAME[m.step].toLowerCase())}
          </div>`)}
        </div>`
      };
    }
    const t = GT.computeTargets(p), plan = GT.generatePlan(p, GT.todayISO());
    const pct = Math.round((t.adj - 1) * 100), goalN = nameOf(GT.GOALS, p.goal);
    const floorK = p.sex === 'f' ? 1400 : 1600, floored = t.tdee * t.adj < floorK && t.k === floorK;
    const explain = `Metabolismo basale ${GT.fk(t.bmr)} kcal × fattore attività ${String(t.factor).replace('.', ',')} (lavoro, passi e allenamenti) = ${GT.fk(t.tdee)} kcal di consumo. `
      + (pct === 0 ? `${goalN}: mantenimento, ${GT.fk(t.k)} kcal. ` : `${goalN}: ${pct > 0 ? '+' : '−'}${Math.abs(pct)}% → ${GT.fk(t.k)} kcal. `)
      + (floored ? `Non scendo sotto ${GT.fk(floorK)} kcal: è il minimo che uso per sostenere allenamento e recupero. ` : '')
      + `Proteine ${GT.fmt(t.protPerKg)} g per kg, grassi almeno 0,9 g per kg e almeno il 22% delle calorie, il resto carboidrati.`;
    const tiles = [['Proteine', t.p + ' g'], ['Carboidrati', t.c + ' g'], ['Grassi', t.g + ' g'], ['Acqua', GT.fmt(t.water) + ' L']];
    const run = plan.run, cardioOnly = [p.runs ? 'corsa' : null, p.swims ? 'nuoto' : null].filter(Boolean);
    const trainTitle = plan.split || (cardioOnly.length ? 'Senza palestra' : 'Nessun allenamento fisso');
    const trainSub = p.gymDays
      ? `${p.gymDays} ${p.gymDays === 1 ? 'seduta' : 'sedute'} da circa ${p.sessionMin} min · ciclo di ${plan.cycleWeeks} settimane, la ${plan.deloadIndex + 1}ª di scarico`
      : cardioOnly.length ? `Il piano si concentra su ${cardioOnly.join(' e ')}.` : 'Aggiungi giorni di palestra, corsa o nuoto per avere un calendario.';
    const zoneBg = i => (i >= 3 ? 'var(--c-acc)' : i === 2 ? 'var(--c-sec)' : 'var(--c-fg3)');
    const runSource = p.run.testDist && timeOk(p.run)
      ? `Dal tuo ${p.run.testDist} km in ${p.run.testTime} (passo 10 km stimato ${GT.pace(run ? run.p10 : 0)}/km).`
      : `Stimate dal volume (${GT.fmt(p.run.kmWeek)} km a settimana): con un tempo su 5 km diventano precise.`;
    return {
      eyebrow: 'Riepilogo', title: edit ? 'Il piano aggiornato' : `Ecco il tuo piano${p.name ? ', ' + p.name : ''}`,
      why: edit ? 'Aggiornando rigenero la scheda dalle nuove risposte: le modifiche fatte a mano agli esercizi vengono sostituite. Storico e registrazioni restano.'
        : 'Calcolato dalle tue risposte. Puoi cambiare tutto anche dopo, dal Profilo.',
      body: html`
        <div style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:12px'}>
          ${secHead('Target giornaliero', 2)}
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span class="num" style="font-size:3rem;font-weight:900;letter-spacing:-.02em;line-height:1">${GT.fk(t.k)}</span><span style="font-size:1rem;font-weight:800;color:var(--c-fg2)">kcal al giorno</span></div>
          <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">
            ${tiles.map(x => html`<div key=${x[0]} style="background:var(--c-s2);border-radius:10px;padding:10px 8px;min-width:0"><div style="font-size:.6875rem;font-weight:700;color:var(--c-fg3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x[0]}</div><div class="num" style="font-size:1.0625rem;font-weight:900;margin-top:2px;white-space:nowrap">${x[1]}</div></div>`)}
          </div>
          <p style="margin:0;font-size:.875rem;line-height:1.5;color:var(--c-fg2);text-wrap:pretty">${explain}</p>
        </div>

        <div style=${S.card + ';padding:16px 16px 6px;display:flex;flex-direction:column;gap:4px'}>
          ${secHead('Allenamento', 4)}
          <div style="font-size:1.25rem;font-weight:900;letter-spacing:-.01em;margin-top:4px">${trainTitle}</div>
          <div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.45;margin-bottom:8px">${trainSub}</div>
          ${weekRows(plan)}
        </div>

        ${run ? html`<div style=${S.card + ';padding:16px 16px 6px;display:flex;flex-direction:column;gap:4px'}>
          ${secHead('Zone di corsa', 7)}
          <div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.45;margin:4px 0 8px">${runSource} Piano: ${run.order.length} ${run.order.length === 1 ? 'uscita' : 'uscite'}, circa ${GT.fmt(run.weeklyKm)} km a settimana.</div>
          ${run.zones.map((z, i) => html`<div key=${z.z} style="display:flex;align-items:center;gap:12px;min-height:44px;border-top:1px solid var(--c-line)">
            <span aria-hidden="true" style=${`flex:none;width:4px;height:20px;border-radius:2px;background:${zoneBg(i)}`}></span>
            <span style="flex:none;width:28px;font-weight:900">${z.z}</span>
            <span style="flex:1;font-size:.9375rem;color:var(--c-fg2)">${z.n}</span>
            <span class="num" style="font-weight:800;font-size:.9375rem">${z.label}/km</span>
          </div>`)}
        </div>` : null}

        <div style=${S.card + ';padding:12px 16px 6px'}>
          ${ui.eyebrow('Le tue risposte', 'margin-bottom:6px')}
          ${answerRows(p).map(r => html`<div key=${'r' + r[0]} style="display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--c-line)">
            <div style="flex:1;min-width:0"><div style=${S.eyebrow}>${r[1]}</div><div style="font-size:.9375rem;font-weight:700;margin-top:3px;line-height:1.35;overflow-wrap:anywhere">${r[2]}</div></div>
            ${modBtn(r[0], r[1].toLowerCase())}
          </div>`)}
        </div>`
    };
  }

  // ---------- welcome ----------
  const fieldStyle = 'height:52px;border-radius:12px;border:1px solid var(--c-s3);outline:0;background:var(--c-s2);padding:0 14px;font-size:1rem;width:100%';

  function loginBlock(st) {
    const c = st.cloud || {};
    if (!c.configured || !c.ready || !GT.cloud) return null;
    if (c.user) {
      const status = c.syncing ? 'Carico i tuoi dati dal cloud…'
        : c.error ? c.error
        : c.lastSync ? 'Su questo account non c’è ancora un piano: rispondi alle domande e lo salvo qui.'
        : 'In attesa della sincronizzazione.';
      return html`<div style=${S.card + ';padding:14px 16px;display:flex;gap:12px;align-items:center'}>
        <i class=${c.syncing ? 'ph-light ph-arrows-clockwise' : 'ph-light ph-cloud-check'} style="font-size:24px;flex:none"></i>
        <div style="min-width:0"><div style="font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${'Accesso come ' + c.user}</div><div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.4;margin-top:2px">${status}</div></div>
      </div>`;
    }
    if (!L.login) {
      return html`<button type="button" onClick=${() => { L.login = true; GT.render(); }} aria-expanded="false" style="align-self:flex-start;height:52px;font-weight:700;font-size:.9375rem;color:var(--c-fg2)">Hai già un account? <span style="font-weight:900;color:var(--c-fg);text-decoration:underline;text-underline-offset:3px">Accedi</span></button>`;
    }
    const submit = e => {
      e.preventDefault();
      const f = e.currentTarget;
      GT.cloud.signIn(f.elements.email.value, f.elements.password.value).then(r => { if (r && f.elements.password) f.elements.password.value = ''; });
    };
    return html`<form onSubmit=${submit} style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:10px;animation:gtFade .2s ease'}>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:900;font-size:1.0625rem">Accedi</span>
        <button type="button" onClick=${() => { L.login = false; GT.render(); }} aria-label="Chiudi accesso" style="width:44px;height:44px;margin-right:-10px;display:grid;place-items:center;color:var(--c-fg2)"><i class="ph-light ph-x" style="font-size:20px"></i></button>
      </div>
      <input name="email" type="email" autocomplete="email" inputmode="email" required placeholder="Email" aria-label="Email" style=${fieldStyle} />
      <input name="password" type="password" autocomplete="current-password" required placeholder="Password" aria-label="Password" style=${fieldStyle} />
      ${errLine(c.error)}
      <button type="submit" class="press" disabled=${c.busy} style=${`height:52px;border-radius:12px;background:var(--c-s2);color:var(--c-fg);font-weight:900;opacity:${c.busy ? 0.6 : 1}`}>${c.busy ? 'Attendi…' : 'Accedi'}</button>
      <div style="font-size:.75rem;color:var(--c-fg3);line-height:1.45">Se l’account ha già un piano lo ritrovi subito; altrimenti continui con le domande.</div>
    </form>`;
  }

  function welcome(st) {
    const rows = [
      ['ph-user', 'Tu e il tuo obiettivo', 'Corpo, esperienza, infortuni'],
      ['ph-barbell', 'Allenamento', 'Giorni, attrezzatura, corsa e nuoto'],
      ['ph-fork-knife', 'Alimentazione', 'Movimento, sonno, dieta e pasti']
    ];
    return html`<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:22px;padding:24px 0 8px">
      <h1 style="margin:0;font-size:2.75rem;line-height:1.02;font-weight:900;letter-spacing:-.02em">Grey<span style="background-image:linear-gradient(var(--c-acc),var(--c-acc));background-repeat:no-repeat;background-position:0 88%;background-size:100% .14em">Training</span></h1>
      <p style="margin:0;font-size:1.0625rem;line-height:1.5;color:var(--c-fg2);text-wrap:pretty">Il tuo coach per palestra, corsa e nutrizione. Qualche domanda, circa 3 minuti: costruisco piano, calorie e progressione su di te.</p>
      <div style=${S.card + ';padding:4px 16px'}>
        ${rows.map((r, i) => html`<div key=${r[0]} style=${`display:flex;gap:14px;align-items:center;min-height:60px;${i ? 'border-top:1px solid var(--c-line)' : ''}`}>
          <span style="flex:none;width:40px;height:40px;border-radius:10px;background:var(--c-s2);display:grid;place-items:center"><i class=${'ph-light ' + r[0]} style="font-size:22px"></i></span>
          <div><div style="font-weight:800">${r[1]}</div><div style="font-size:.8125rem;color:var(--c-fg3)">${r[2]}</div></div>
        </div>`)}
      </div>
      ${loginBlock(st)}
    </div>`;
  }

  // ---------- screen ----------
  GT.screens.onboarding = function (st, d) {
    const ob = st.ob || { step: 0, a: {} }, a = ob.a || {}, edit = !!ob.edit;
    // New questionnaire vs "Rifai il questionario", or a draft that was reset: drop stale local text
    const mode = edit ? 'edit' : 'new';
    if (L.mode !== mode) { resetLocal(); L.mode = mode; }
    if (!Object.keys(a).length) { L.raw = {}; L.toSummary = false; }

    const p = full(a), flow = flowOf(p);
    let step = Math.max(edit ? 1 : 0, Math.min(LAST, Number(ob.step) || 0));
    if (step === 5 && !p.gymDays) step = 6;
    if (step === LAST) L.toSummary = false;
    const idx = flow.indexOf(step);

    // On the summary: every earlier step must be complete, or nothing is computed
    let missing = step === LAST ? flow.filter(s => s < LAST && issue(s, a, p)).map(s => ({ step: s, msg: issue(s, a, p) })) : [];
    // ... and every gym day must get at least one exercise
    const empty = step === LAST && !missing.length ? emptyDays(p) : [];
    if (empty.length) {
      missing = [
        { step: 5, msg: `${joinNames(empty)} resta senza esercizi: aggiungi attrezzatura` },
        { step: 4, msg: 'Oppure scegli meno giorni di palestra' }
      ];
    }

    const view = step === 1 ? stepWho(a)
      : step === 2 ? stepGoal(a)
      : step === 3 ? stepExperience(a, p)
      : step === 4 ? stepAvailability(a, p)
      : step === 5 ? stepEquipment(a, p)
      : step === 6 ? stepLimits(a, p)
      : step === 7 ? stepRun(a, p)
      : step === 8 ? stepSwim(a, p)
      : step === 9 ? stepLife(a, p)
      : step === 10 ? stepFood(a, p)
      : step === LAST ? stepSummary(a, p, edit, missing.length ? missing : null, empty.length > 0)
      : null;

    const hint = step > 0 && step < LAST ? issue(step, a, p) : '';
    const finish = () => {
      const prof = full(GT.state.ob.a || {});
      resetLocal();
      if (edit) {
        A.updateProfile(prof, true);
        GT.set({ ob: { step: 0, a: {}, edit: false }, effort: prof.effort });
      } else {
        A.finishOnboarding(prof);
      }
    };
    const cancel = () => { resetLocal(); blur(); GT.set({ ob: { step: 0, a: {}, edit: false } }); };
    const back = () => goStep(prevOf(step, p, edit));
    const next = () => {
      if (step === 0) { goStep(1); return; }
      if (step === LAST) {
        if (missing.length) { L.tried[missing[0].step] = true; L.toSummary = true; goStep(missing[0].step); return; }
        finish();
        return;
      }
      if (hint) { L.tried[step] = true; GT.render(); return; }
      goStep(L.toSummary ? LAST : nextOf(step, p));
    };
    const ctaLabel = step === 0 ? 'Iniziamo'
      : step === LAST ? (missing.length ? 'Completa: ' + STEP_NAME[missing[0].step] : edit ? 'Aggiorna il piano' : 'Crea il mio piano')
      : L.toSummary ? 'Torna al riepilogo' : 'Continua';
    const off = !!hint;

    return html`<div style="position:absolute;inset:0;z-index:20;background:var(--c-bg);display:flex;flex-direction:column">
      <div style="flex:none;padding:var(--top) 16px 0;background:var(--c-bg)">
        <div style="display:grid;grid-template-columns:80px 1fr 80px;align-items:center;height:52px">
          ${step > (edit ? 1 : 0)
            ? html`<button type="button" onClick=${back} aria-label="Indietro" style="width:52px;height:52px;margin-left:-14px;display:grid;place-items:center;color:var(--c-fg2)"><i class="ph-light ph-caret-left" style="font-size:24px"></i></button>`
            : html`<span></span>`}
          <span class="num" style="text-align:center;font-size:.8125rem;font-weight:800;color:var(--c-fg3)">${step ? `${idx + 1} di ${flow.length}` : ''}</span>
          ${edit
            ? html`<button type="button" onClick=${cancel} style="justify-self:end;height:52px;padding:0 2px;font-weight:800;color:var(--c-fg2)">Annulla</button>`
            : html`<span></span>`}
        </div>
        ${step ? html`<div role="progressbar" aria-label="Avanzamento del questionario" aria-valuemin="1" aria-valuemax=${flow.length} aria-valuenow=${idx + 1} style="display:flex;gap:4px;padding:2px 0 10px">
          ${flow.map((s, i) => html`<span key=${'g' + s} style=${`flex:1;height:4px;border-radius:2px;transition:background .2s ease;background:${i < idx ? 'var(--c-sec)' : i === idx ? 'var(--c-acc)' : 'var(--c-s3)'}`}></span>`)}
        </div>` : null}
      </div>

      <div key=${'step' + step} class="scroll" style="flex:1;min-height:0;overflow-y:auto;padding:8px 16px 32px;display:flex;flex-direction:column;animation:gtFade .28s ease">
        ${step === 0 ? welcome(st) : html`
          <header style="padding:4px 4px 0">
            <div style=${S.eyebrow}>${view.eyebrow}</div>
            <h1 style=${S.h1}>${view.title}</h1>
            <p style="margin:8px 0 0;font-size:.9375rem;line-height:1.45;color:var(--c-fg2);text-wrap:pretty">${view.why}</p>
          </header>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:20px">${view.body}</div>`}
      </div>

      <div style="flex:none;padding:12px 16px var(--pb);background:var(--c-bg);border-top:1px solid var(--c-line);display:flex;flex-direction:column;gap:8px">
        ${hint ? html`<div role="status" style="text-align:center;font-size:.8125rem;font-weight:700;color:var(--c-fg3);line-height:1.35">${hint}</div>` : null}
        <button type="button" class="press" onClick=${next} aria-disabled=${off} style=${`height:60px;width:100%;border-radius:12px;font-size:1.0625rem;font-weight:900;display:flex;align-items:center;justify-content:center;gap:10px;background:${off ? 'var(--c-s2)' : 'var(--c-acc)'};color:${off ? 'var(--c-fg3)' : 'var(--c-on-acc)'}`}>${ctaLabel}</button>
      </div>
    </div>`;
  };
})();
