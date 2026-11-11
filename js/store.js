/* GreyTraining — state store, persistence and actions (schema 2: real user data, no seed).

   API
     GT.state            current state object (treat as read-only)
     GT.set(patch|fn)    shallow-merge a patch (or fn(state) -> patch), re-render, persist
     GT.act.*            actions shared across screens
     GT.derive(st)       values computed from state that several screens need
     GT.v(key)           layout variant 'A' | 'B' (vOggi, vSessione, vNutri, vProg, vCoach)

   Persisted state (synced to Supabase when signed in):
     settings  primary, secondary, bgTone, theme, scale, effort ('RPE'|'RIR')
     profile   onboarding answers (see js/plan.js), null until onboarding is done
     targets   GT.computeTargets(profile)
     plan      GT.generatePlan(profile)
     logs      { sessions, cardio, weights, measures, food, water, ready } (see js/insights.js)
     coach     { actionId: 'ok' | 'skip' }   chat [{ who 'u'|'c', t, at }]
     ob        onboarding draft { step, a }   s / summary / rate: running workout
     notify    { garmin, strava }

   Running workout (st.s):
     { start, date, dayId, dayName, order [exId], tg { exId: { sets, lo, hi, reps, rpe, rest } },
       exIdx, logs { exId: [{ w, r, e, e1, pr }] }, w, r, e, justDone, rest { end, total } | null,
       notes { exId: text }, showNote, why }                                                    */
(function () {
  'use strict';
  var GT = window.GT;
  var STORAGE_KEY = 'greytraining.v2';
  var SCHEMA = 2;

  var PERSIST = ['primary', 'secondary', 'bgTone', 'theme', 'scale', 'effort',
    'profile', 'targets', 'plan', 'prevPlan', 'exLib', 'logs', 'coach', 'chat', 'ob', 's', 'summary', 'rate', 'notify'];

  var emptyLogs = function () { return { sessions: [], cardio: [], weights: [], measures: [], food: {}, water: {}, ready: {} }; };

  function initialState() {
    return {
      // appearance
      primary: '#E95145', secondary: '#FFFBF9', bgTone: 'nero', theme: 'dark', scale: 1, effort: 'RPE',
      // user
      profile: null, targets: null, plan: null, logs: emptyLogs(), ob: { step: 0, a: {} },
      // navigation
      tab: 'oggi', overlay: null, allenSub: 'scheda', allenView: null, disc: 'palestra',
      cardioId: null, log: null, libQuery: '', libMuscle: 'Tutti', exDetail: null, exBack: null, editDay: null, addTo: null,
      nutriSub: 'diario', nutriView: null, nutriDate: null, qaMeal: null, foodQuery: '', foodPick: null, manual: null,
      scan: { code: '', loading: false, error: null, product: null }, portion: 100, prodMeal: null,
      progSub: 'corpo', strEx: null, range: '12S', weightPad: null,
      // workout
      s: null, summary: null, rate: 3, pad: null,
      // coach
      coach: {}, chat: [], chatInput: '', typing: false,
      notify: { garmin: false, strava: false },
      toast: null, online: navigator.onLine !== false
    };
  }

  function load() {
    var st = initialState();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        PERSIST.forEach(function (k) { if (saved[k] !== undefined && saved[k] !== null) st[k] = saved[k]; });
        if (saved.overlay === 'session' && st.s) st.overlay = 'session';
        if (saved.overlay === 'summary' && st.summary) st.overlay = 'summary';
      }
    } catch (e) { /* private mode or corrupt data: start empty */ }
    st.logs = Object.assign(emptyLogs(), st.logs || {});
    if (st.s && st.s.rest && !st.s.rest.end) st.s.rest = null;
    return st;
  }

  var saveTimer = null, resetting = false;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (resetting) return;
    try {
      var out = { schema: SCHEMA };
      PERSIST.forEach(function (k) { out[k] = GT.state[k]; });
      out.overlay = GT.state.overlay === 'session' || GT.state.overlay === 'summary' ? GT.state.overlay : null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch (e) { /* storage full or blocked: the app keeps working in memory */ }
  }
  function scheduleSave() { if (!saveTimer) saveTimer = setTimeout(save, 250); }
  GT.saveNow = save;

  // A local copy of everything, kept under greytraining.backup.<time> (last three)
  GT.backupNow = function () {
    try {
      localStorage.setItem('greytraining.backup.' + Date.now(), JSON.stringify(GT.persistedSnapshot()));
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('greytraining.backup.') === 0) keys.push(k); }
      keys.sort().slice(0, Math.max(0, keys.length - 3)).forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  };
  // Developer reset of this device only (console). Users use "Ricomincia da zero" in Profile.
  GT.resetAll = function () {
    resetting = true;
    if (GT.cloud && GT.cloud.halt) GT.cloud.halt();
    try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem('greytraining.sync'); } catch (e) {}
    location.reload();
  };

  // ---------- Cloud sync hooks (used by js/cloud.js) ----------
  var PERSIST_SET = {};
  PERSIST.forEach(function (k) { PERSIST_SET[k] = true; });
  var applyingRemote = false;
  GT.onPersistChange = null; // set by cloud.js
  GT.persistedSnapshot = function () {
    var out = { schema: SCHEMA };
    PERSIST.forEach(function (k) { out[k] = GT.state[k]; });
    return JSON.parse(JSON.stringify(out));
  };
  // Apply a cloud copy. Returns { ignored } for a copy from an older app version (it is never
  // applied: this device's data wins and is pushed), or { kept } when a workout running here
  // was preserved and must be pushed back.
  GT.applyRemote = function (data) {
    if (!data || typeof data !== 'object' || data.schema !== SCHEMA) return { ignored: true, kept: false };
    var patch = {}, kept = false, cur = GT.state.s;
    PERSIST.forEach(function (k) { if (data[k] !== undefined) patch[k] = data[k]; });
    patch.logs = Object.assign(emptyLogs(), patch.logs || {});
    if (cur) {
      var savedElsewhere = (patch.logs.sessions || []).some(function (h) { return h && h.start === cur.start; });
      if (!savedElsewhere && (!patch.s || patch.s.start !== cur.start)) { patch.s = cur; kept = true; }
    }
    if (patch.s && patch.s.rest && !patch.s.rest.end) patch.s.rest = null;
    if (!patch.s && GT.state.overlay === 'session') patch.overlay = null;
    if (!patch.summary && GT.state.overlay === 'summary') patch.overlay = null;
    applyingRemote = true;
    try { GT.set(patch); } finally { applyingRemote = false; }
    save();
    return { ignored: false, kept: kept };
  };

  // Every exercise that ever came with an imported plan, so logs keep their names, muscles and
  // load step after the plan is replaced (st.exLib: { id: entry }, persisted and synced).
  var withLib = function (lib, plans) {
    var out = null;
    plans.forEach(function (pl) {
      var c = pl && pl.custom; if (!c) return;
      Object.keys(c).forEach(function (id) { if (!(lib && lib[id]) || JSON.stringify(lib[id]) !== JSON.stringify(c[id])) { out = out || Object.assign({}, lib || {}); out[id] = c[id]; } });
    });
    return out; // null when nothing new
  };
  GT.state = load();
  (function () {
    var lib = withLib(GT.state.exLib, [GT.state.prevPlan, GT.state.plan]);
    if (lib) GT.state.exLib = lib;
    // the active plan last, so its entries win
    GT.registerCustom(GT.state.exLib);
    GT.registerCustom(GT.state.prevPlan);
    GT.registerCustom(GT.state.plan);
  })();
  var renderQueued = false;
  GT.onRender = null; // set by app.js
  GT.render = function () {
    if (renderQueued) return;
    renderQueued = true;
    Promise.resolve().then(function () { renderQueued = false; if (GT.onRender) GT.onRender(); });
  };
  GT.set = function (patch) {
    var p = typeof patch === 'function' ? patch(GT.state) : patch;
    if (!p) return;
    // exercises that came with an imported plan: register them and keep them in exLib
    if (p.plan || p.prevPlan || p.exLib) {
      var lib = withLib(p.exLib || GT.state.exLib, [p.prevPlan, p.plan]);
      if (lib) p = Object.assign({}, p, { exLib: lib });
      if (p.exLib) GT.registerCustom(p.exLib);
      if (p.prevPlan) GT.registerCustom(p.prevPlan);
      if (p.plan) GT.registerCustom(p.plan);
    }
    GT.state = Object.assign({}, GT.state, p);
    GT.render();
    scheduleSave();
    if (!applyingRemote && GT.onPersistChange) {
      for (var k in p) { if (PERSIST_SET[k]) { GT.onPersistChange(); break; } }
    }
  };
  // Immutable update of one part of the logs
  GT.setLogs = function (fn) { GT.set(function (st) { var l = Object.assign({}, st.logs); fn(l, st); return { logs: l }; }); };
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') save(); });
  window.addEventListener('pagehide', save);
  window.addEventListener('online', function () { GT.set({ online: true }); });
  window.addEventListener('offline', function () { GT.set({ online: false }); });

  // ---------- Layout variants (design exploration A/B) ----------
  var VKEYS = ['vOggi', 'vSessione', 'vNutri', 'vProg', 'vCoach'];
  var variants = {};
  try { variants = JSON.parse(localStorage.getItem('greytraining.variants') || '{}'); } catch (e) {}
  try {
    var qs = new URLSearchParams(location.search);
    VKEYS.forEach(function (k) { var x = qs.get(k); if (x === 'A' || x === 'B') variants[k] = x; });
    localStorage.setItem('greytraining.variants', JSON.stringify(variants));
  } catch (e) {}
  GT.v = function (k) { return variants[k] === 'B' ? 'B' : 'A'; };

  // ---------- Theme ----------
  function lum(hex) {
    var n = parseInt(hex.slice(1), 16);
    var c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function onColor(hex) { var L = lum(hex); return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#000' : '#FFFBF9'; }
  GT.onColor = onColor;
  var lastApplied = '';
  GT.applyColors = function () {
    var st = GT.state, dark = st.theme !== 'light', el = document.documentElement;
    var sig = [st.theme, st.primary, st.secondary, st.bgTone, st.scale].join('|');
    if (sig === lastApplied) return;
    lastApplied = sig;
    el.setAttribute('data-theme', dark ? 'dark' : 'light');
    var sec = st.secondary;
    if (!dark && sec.toUpperCase() === '#FFFBF9') sec = '#000000';
    var vars = {
      '--c-acc': st.primary, '--c-on-acc': onColor(st.primary),
      '--c-acc-t': dark ? st.primary : 'color-mix(in oklab, ' + st.primary + ' 70%, #000)',
      '--c-acc-soft': 'color-mix(in srgb, ' + st.primary + ' 18%, transparent)',
      '--c-sec': sec, '--c-on-sec': onColor(sec)
    };
    var t = GT.TONES[st.bgTone] || GT.TONES.nero;
    ['--c-bg', '--c-s1', '--c-s2', '--c-s3', '--c-line'].forEach(function (k, i) { if (dark) el.style.setProperty(k, t[i]); else el.style.removeProperty(k); });
    Object.keys(vars).forEach(function (k) { el.style.setProperty(k, vars[k]); });
    el.style.fontSize = (16 * st.scale) + 'px';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? t[0] : '#FFFBF9');
  };

  // ---------- Derived values ----------
  GT.restLeft = function (s) { return s && s.rest ? Math.max(0, Math.ceil((s.rest.end - Date.now()) / 1000)) : 0; };
  GT.elapsed = function (s) {
    if (!s) return '';
    var e = Math.floor((Date.now() - s.start) / 1000);
    return e >= 3600 ? Math.floor(e / 3600) + ':' + GT.mmss(e % 3600).padStart(5, '0') : GT.mmss(e);
  };
  GT.effLabel = function (e) { return GT.state.effort === 'RIR' ? 'RIR ' + GT.fmt(10 - e) : 'RPE ' + GT.fmt(e); };

  // Coach tip for the Oggi screen, from today's plan, readiness and nutrition
  function coachTip(st, today, plan, rd, food) {
    var T = st.targets;
    var gym = plan.items.filter(function (i) { return i.type === 'gym'; })[0];
    var cardio = plan.items.filter(function (i) { return i.type !== 'gym'; })[0];
    if (gym && gym.done || (cardio && cardio.done && !gym)) {
      return T ? 'Allenamento registrato. Ti mancano ' + Math.max(0, T.p - food.tot.p) + ' g di proteine: distribuiscile tra i prossimi pasti.' : 'Allenamento registrato.';
    }
    if (gym) {
      if (!gym.day || !gym.day.ex.length) return gym.day ? gym.day.name + ' non ha esercizi: aggiungine dalla scheda in Allena.' : '';
      if (!rd) return 'Fai il check-in di 30 secondi: adatto volume e intensità di ' + gym.day.name + ' a come stai oggi.';
      if (rd.score < 55) return 'Readiness bassa. Oggi una serie in meno per esercizio, ' + (GT.state.effort === 'RIR' ? 'almeno RIR 3' : 'RPE massimo 7') + '. Il volume perso si recupera in settimana.';
      var first = gym.day.ex[0], t = GT.targetFor(st.plan, first, today), sg = GT.suggestion(st, first, t.rpe), name = GT.EXI[first.id].n;
      if (t.deload) return 'Settimana di scarico: ' + GT.deloadText(st.plan, GT.cycleWeek(st.plan, today).index) + ' Lascia sempre margine prima del cedimento.';
      if (sg.w == null) return name + ': prima volta. Scegli un carico che chiudi a ' + GT.effLabel(t.rpe) + ' e registra ogni serie: dalla prossima ti suggerisco i carichi.';
      if (rd.score < 75) return 'Readiness nella media. Mantieni i carichi della scorsa volta e chiudi le serie a ' + (GT.state.effort === 'RIR' ? 'RIR ' + GT.fmt(10 - t.rpe) + '–' + GT.fmt(10.5 - t.rpe) : 'RPE ' + GT.fmt(t.rpe - 0.5) + '–' + GT.fmt(t.rpe)) + '.';
      return name + ': ' + sg.why + ' Oggi ' + (sg.w ? GT.fmtKg(sg.w) + ' kg × ' : '') + sg.r + ', fermati a ' + GT.effLabel(t.rpe) + '.';
    }
    if (cardio) return 'Oggi ' + cardio.cardio.name + '. ' + String(cardio.cardio.note || '').split('. ')[0].replace(/\.$/, '') + '.';
    return T ? 'Giorno di riposo: cammina, dormi 7–9 ore e porta le proteine a ' + T.p + ' g.' : 'Giorno di riposo.';
  }

  GT.derive = function (st) {
    var today = GT.todayISO(), T = st.targets || { k: 0, p: 0, c: 0, g: 0, glasses: 8, water: 2 };
    var plan = GT.dayPlan(st, today), rd = GT.readinessOf(st, today);
    var nDate = st.nutriDate || today, food = GT.foodDay(st, nDate), foodToday = nDate === today ? food : GT.foodDay(st, today);
    var tot = food.tot, kLeft = Math.max(0, T.k - tot.k);
    var macros = [['Proteine', 'P', 'p'], ['Carboidrati', 'C', 'c'], ['Grassi', 'G', 'g']].map(function (x) {
      var k = x[2];
      return { k: k, label: x[0], short: x[1], eaten: tot[k], target: T[k], left: Math.max(0, T[k] - tot[k]), pct: (T[k] ? Math.min(100, tot[k] / T[k] * 100) : 0).toFixed(0) + '%' };
    });
    var score = rd ? rd.score : null;
    return {
      today: today, todayPlan: plan, cycle: GT.cycleWeek(st.plan, today), onboarded: !!(st.profile && st.plan),
      readiness: rd, score: score, readyLabel: rd ? rd.label : 'Check-in di oggi', readyOffset: (175.9 * (1 - (score || 0) / 100)).toFixed(1),
      coachTip: st.plan ? coachTip(st, today, plan, rd, foodToday) : '',
      nutriDate: nDate, food: food, tot: tot, targets: T, kLeft: kLeft, kcalLeft: GT.fk(kLeft), kcalEaten: GT.fk(tot.k),
      kcalEatenLine: GT.fk(tot.k) + ' / ' + GT.fk(T.k) + ' kcal', kcalPct: (T.k ? Math.min(100, tot.k / T.k * 100) : 0).toFixed(0) + '%',
      kcalRingOffset: (364.4 * (T.k ? Math.min(1, tot.k / T.k) : 0)).toFixed(1), macros: macros,
      water: (st.logs.water || {})[nDate] || 0,
      startLabel: st.s ? 'Riprendi allenamento' : 'Inizia allenamento',
      fullScreen: !(st.profile && st.plan) || st.overlay === 'session' || st.overlay === 'summary' || st.overlay === 'profile' || !!st.allenView || !!st.nutriView
    };
  };

  // ---------- Actions ----------
  var A = (GT.act = {});
  var toastTimer = null, chatTimer = null, toastSeq = 0;

  // kind: 'set' (neutral, check icon) | 'info' (neutral, bell) | 'pr' (primary, trophy)
  A.toast = function (kind, title, sub) {
    clearTimeout(toastTimer);
    GT.set({ toast: { kind: kind, title: title, sub: sub, id: ++toastSeq } });
    toastTimer = setTimeout(function () { GT.set({ toast: null }); }, 2600);
  };
  A.goTab = function (id) { GT.set({ tab: id, overlay: null, allenView: null, nutriView: null, pad: null }); };

  // ---------- onboarding and profile ----------
  // (keep the other ob fields, e.g. edit, so "Rifai il questionario" stays in edit mode)
  A.obSet = function (patch) { GT.set(function (st) { return { ob: Object.assign({}, st.ob, { a: Object.assign({}, st.ob.a, patch) }) }; }); };
  A.obStep = function (step) { GT.set(function (st) { return { ob: Object.assign({}, st.ob, { step: Math.max(0, step) }) }; }); };

  function welcome(p, plan, t) {
    var gymDays = plan.days.length, parts = [];
    if (gymDays) parts.push(plan.split);
    if (plan.run) parts.push(plan.run.order.length + ' uscite di corsa (~' + GT.fmt(plan.run.weeklyKm) + ' km)');
    if (plan.swim) parts.push(plan.swim.order.length + ' nuoto');
    return 'Ciao ' + (p.name || '') + '. Il tuo piano è pronto: ' + (parts.join(', ') || 'nessun allenamento fisso') + '. Target: ' + GT.fk(t.k) + ' kcal, ' + t.p + ' g di proteine, ' + GT.fmt(t.water) + ' L d\'acqua. '
      + 'Le prime due settimane servono a calibrare i carichi: scegli pesi che chiudi a RPE 7 e registra ogni serie. Chiedimi pure di cambiare esercizi o giorni.';
  }

  // Build targets and plan from the onboarding answers and open the app
  A.finishOnboarding = function (profile) {
    var p = Object.assign({}, profile, { createdAt: new Date().toISOString() });
    var t = GT.computeTargets(p), plan = GT.generatePlan(p, GT.todayISO()), today = GT.todayISO();
    GT.set(function (st) {
      var logs = Object.assign({}, st.logs);
      if (p.weight) logs.weights = (logs.weights || []).filter(function (w) { return w.date !== today; }).concat([{ date: today, kg: Number(p.weight) }]);
      return {
        profile: p, targets: t, plan: plan, logs: logs, effort: p.effort || st.effort, ob: { step: 0, a: {} },
        chat: [{ who: 'c', t: welcome(p, plan, t), at: Date.now() }], coach: {}, tab: 'oggi', overlay: null
      };
    });
    A.toast('set', 'Piano pronto', (plan.split || 'Piano') + ' · ' + GT.fk(t.k) + ' kcal');
  };
  // Change profile fields. regenerate: rebuild the plan too (keeps its start date and the logs).
  A.updateProfile = function (patch, regenerate) {
    var st = GT.state, p = Object.assign({}, st.profile, patch), t = GT.computeTargets(p);
    var out = { profile: p, targets: t }, kept = null;
    if (regenerate) {
      var plan = GT.generatePlan(p, st.plan ? st.plan.startDate : GT.todayISO());
      var isImport = !!(st.plan && st.plan.source && st.plan.source.type === 'import');
      if (st.plan && !isImport) plan.startDate = st.plan.startDate;
      if (isImport) {
        // The imported program stays active. Only what comes from the profile is refreshed:
        // run paces (from the new 5/10 km time) and runs or swims the program does not have.
        var imp = JSON.parse(JSON.stringify(st.plan)), added = [];
        if (imp.run && imp.run.src && GT.importRuns) imp.run = GT.importRuns(p, imp.run.src, GT.todayISO());
        var freeDay = function (wd) { return !imp.week[wd].items.length; };
        ['run', 'swim'].forEach(function (k) {
          if (imp[k] || !plan[k]) return;
          imp[k] = plan[k];
          plan.week.forEach(function (w) { w.items.forEach(function (it) { if ((k === 'run' ? it.type === 'run' : it.type === 'swim') && freeDay(w.wd)) imp.week[w.wd].items.push(it); }); });
          added.push(k === 'run' ? 'corse' : 'nuoto');
        });
        out.plan = imp;
        // the regenerated plan becomes "Piano precedente", unless that slot holds another import
        var keepPrev = st.prevPlan && st.prevPlan.source && st.prevPlan.source.type === 'import';
        if (!keepPrev) out.prevPlan = plan;
        kept = { added: added, prevStored: !keepPrev };
      } else out.plan = plan;
    }
    GT.set(out);
    if (kept) A.toast('set', 'Profilo aggiornato · scheda importata attiva', (kept.added.length ? 'Aggiunte ' + kept.added.join(' e ') + ' dal profilo. ' : '') + (kept.prevStored ? 'Il piano rigenerato è in "Piano precedente".' : 'Il piano precedente resta quello importato.'));
    else A.toast('set', regenerate ? 'Piano aggiornato' : 'Profilo aggiornato', GT.fk(t.k) + ' kcal · P ' + t.p + ' g');
  };
  // Start the questionnaire again with the current answers prefilled (logs are kept)
  A.editQuestionnaire = function () { GT.set(function (st) { return { ob: { step: 1, a: Object.assign({}, st.profile || {}), edit: true }, overlay: null }; }); };
  // Wipe profile, plan and every log (a local backup is kept), back to the questionnaire
  A.resetEverything = function () {
    GT.backupNow();
    GT.set({ profile: null, targets: null, plan: null, prevPlan: null, exLib: null, restoreAsk: false, logs: emptyLogs(), coach: {}, chat: [], s: null, summary: null, ob: { step: 0, a: {} }, overlay: null, tab: 'oggi', allenView: null, nutriView: null });
  };

  // ---------- imported plan ----------
  // Replace the plan with one built by GT.importProgram. The current plan becomes prevPlan
  // (one-step undo); logs, targets and profile are untouched; its exercises join exLib.
  // opts.effort: 'RIR' | 'RPE' to switch how effort is shown (imported plans are often in RIR).
  A.applyImportedPlan = function (plan, opts) {
    var o = opts || {};
    GT.set(function (st) {
      var out = { plan: plan, prevPlan: st.plan || null, restoreAsk: false, allenView: null, tab: 'allen', disc: 'palestra', allenSub: 'scheda' };
      // the profile keeps the scale too, so a later questionnaire edit does not switch it back
      if (o.effort === 'RIR' || o.effort === 'RPE') { out.effort = o.effort; if (st.profile) out.profile = Object.assign({}, st.profile, { effort: o.effort }); }
      return out;
    });
    A.toast('set', 'Scheda importata', plan.split + ' · ' + plan.days.length + ' sedute');
  };
  // Switch with the previous plan (a swap: tapping again goes back)
  A.restorePrevPlan = function () {
    var st = GT.state; if (!st.prevPlan) return;
    GT.set({ plan: st.prevPlan, prevPlan: st.plan, restoreAsk: false });
    A.toast('set', 'Piano attivo: ' + (st.prevPlan.split || 'piano precedente'), 'L\'altro resta in "Piano precedente"');
  };

  // ---------- readiness ----------
  A.setReady = function (k, n) {
    var today = GT.todayISO();
    // Only the answered value is stored; the score exists once all three are answered
    GT.setLogs(function (l) { var r = Object.assign({}, l.ready); r[today] = Object.assign({}, r[today] || {}); r[today][k] = n; l.ready = r; });
  };

  // ---------- plan editing ----------
  function editDay(dayId, fn) {
    GT.set(function (st) {
      var plan = JSON.parse(JSON.stringify(st.plan)), day = GT.findDay(plan, dayId);
      if (!day) return null;
      fn(day, plan, st);
      return { plan: plan };
    });
  }
  A.planSets = function (dayId, i, delta) { editDay(dayId, function (d) { d.ex[i].sets = Math.max(1, Math.min(8, d.ex[i].sets + delta)); }); };
  A.planRemove = function (dayId, i) { editDay(dayId, function (d) { d.ex.splice(i, 1); }); };
  A.planMove = function (dayId, i, dir) { editDay(dayId, function (d) { var j = i + dir; if (j < 0 || j >= d.ex.length) return; var x = d.ex[i]; d.ex[i] = d.ex[j]; d.ex[j] = x; }); };
  // Replace an exercise, keeping sets and reps
  // (rules that belonged to an imported exercise - RIR floor, note, superset - stay with it;
  // orig remembers it so the picker can offer it back)
  A.planSwap = function (dayId, i, exId) {
    editDay(dayId, function (d) {
      var old = d.ex[i], e = GT.EXI[exId] || {};
      var orig = old.orig || (GT.EXI[old.id] && GT.EXI[old.id].custom ? { id: old.id, comp: old.comp, minRir: old.minRir, note: old.note, superset: old.superset } : null);
      var back = orig && orig.id === exId;
      d.ex[i] = Object.assign({}, old, { id: exId, comp: back ? orig.comp : !!e.comp, minRir: back ? orig.minRir : null, note: back ? orig.note : null, superset: back ? orig.superset : null, orig: back ? null : orig });
    });
  };
  A.planAdd = function (dayId, exId) {
    editDay(dayId, function (d, plan, st) {
      var e = GT.EXI[exId], iso = !e.comp;
      var reps = iso ? [10, 12] : [8, 10];
      d.ex.push({ id: exId, sets: 3, lo: reps[0], hi: reps[1], reps: reps[0] + '–' + reps[1], rest: iso ? 75 : 120, rpeOffset: iso ? 0.5 : 0 });
    });
  };

  // ---------- workout session ----------
  // Prefill a set: first set = suggestion from history, then the last logged values of today
  A.prefill = function (s, i) {
    var id = s.order[i], tg = s.tg[id], logs = s.logs[id] || [], l = logs[logs.length - 1];
    var planEx = { id: id, sets: tg.sets, lo: tg.lo, hi: tg.hi };
    var sg = l ? null : GT.suggestion(GT.state, planEx, tg.rpe);
    return Object.assign({}, s, { exIdx: i, w: l ? l.w : sg.w, r: l ? l.r : sg.r, e: tg.rpe, justDone: -1, why: sg ? sg.why : '' });
  };
  // Start (or resume) a workout. dayId: a plan day; default = today's gym day, else the first day.
  A.startSession = function (dayId) {
    var st = GT.state;
    if (st.s) { GT.set({ overlay: 'session' }); return; }
    if (!st.plan || !st.plan.days.length) return;
    var today = GT.todayISO(), plan = st.plan;
    if (!dayId) { var tp = GT.dayPlan(st, today).items.filter(function (x) { return x.type === 'gym'; })[0]; dayId = tp ? tp.id : plan.days[0].id; }
    var day = GT.findDay(plan, dayId);
    if (!day || !day.ex.length) return;
    var tg = {};
    day.ex.forEach(function (x) { var t = GT.targetFor(plan, x, today); tg[x.id] = { sets: t.sets, lo: x.lo, hi: x.hi, reps: x.reps, rpe: t.rpe, rest: x.rest, note: x.note || '', minRir: x.minRir != null ? x.minRir : null, superset: x.superset || null }; });
    var s = { start: Date.now(), date: today, dayId: day.id, dayName: day.name, order: day.ex.map(function (x) { return x.id; }), tg: tg, logs: {}, rest: null, notes: {}, showNote: false };
    GT.set({ s: A.prefill(s, 0), overlay: 'session', summary: null, pad: null });
  };
  A.minimizeSession = function () { GT.set({ overlay: null, pad: null }); };
  A.jumpToExercise = function (i) { var s = GT.state.s; GT.set({ s: A.prefill(Object.assign({}, s), i) }); };
  // Next exercise with sets still to do: after the current one first, then from the start
  // (supersets and jumps can leave an earlier exercise unfinished). -1 when all are done.
  GT.nextOpenIndex = function (s, from, logsMap) {
    var L = logsMap || s.logs, open = function (i) { var x = s.order[i]; return (L[x] || []).length < ((s.tg[x] || {}).sets || 1); };
    for (var i = from + 1; i < s.order.length; i++) if (open(i)) return i;
    for (var j = 0; j <= Math.min(from, s.order.length - 1); j++) if (open(j) && j !== from) return j;
    return -1;
  };
  A.nextExercise = function () {
    var s = GT.state.s, n = GT.nextOpenIndex(s, s.exIdx);
    if (n < 0) n = Math.min(s.order.length - 1, s.exIdx + 1);
    GT.set({ s: Object.assign(A.prefill(s, n), { rest: s.rest }) });
  };
  A.setEffort = function (e) { GT.set({ s: Object.assign({}, GT.state.s, { e: e }) }); };
  A.discardSession = function () { GT.set({ s: null, summary: null, overlay: null, pad: null }); A.toast('info', 'Allenamento annullato', 'Nessuna serie salvata'); };

  A.completeSet = function () {
    var s = GT.state.s, id = s.order[s.exIdx], tg = s.tg[id], logs = s.logs[id] || [];
    if (s.w == null) { A.openPad('w'); return; } // first time: choose a load first
    var e1 = GT.e1rm(s.w, s.r);
    // best so far includes today's sets of the whole family (a back-off set is not a record)
    var famLogs = (GT.exFamily ? GT.exFamily(id) : [id]).reduce(function (a, x) { return a.concat(s.logs[x] || []); }, []);
    var prev = GT.bestE1RM(GT.state, id, famLogs).value;
    var pr = prev > 0 && e1 > prev + 0.05;
    var nl = logs.concat([{ w: s.w, r: s.r, e: s.e, e1: e1, pr: pr }]);
    var logsNext = Object.assign({}, s.logs); logsNext[id] = nl;
    // no rest after the very last set of the workout (whatever the order the exercises were done in)
    var lastAll = nl.length >= tg.sets && GT.nextOpenIndex(s, s.exIdx, logsNext) < 0;
    var restObj = lastAll ? null : { end: Date.now() + tg.rest * 1000, total: tg.rest };
    var prToast = function () { if (pr) A.toast('pr', 'Nuovo record personale', (GT.EXI[id] ? GT.EXI[id].n : id) + ' · 1RM stimato ' + GT.fmt(e1) + ' kg'); return pr; };
    // Superset: alternate the exercises of the group; rest only after the last one of each round
    if (tg.superset) {
      var group = s.order.map(function (x, i) { return i; }).filter(function (i) { return (s.tg[s.order[i]] || {}).superset === tg.superset; });
      var left = function (i) { var x = s.order[i]; return ((x === id ? nl : s.logs[x]) || []).length < s.tg[x].sets; };
      var after = group.filter(function (i) { return i > s.exIdx && left(i); })[0];
      var again = group.filter(function (i) { return left(i); })[0];
      if (after != null) {
        // next exercise of the round, no rest in between
        var ns = A.prefill(Object.assign({}, s, { logs: logsNext }), after);
        GT.set({ s: Object.assign(ns, { rest: null, justDone: -1 }) });
        if (!prToast()) A.toast('set', 'Serie ' + nl.length + ' registrata', 'Superset: ora ' + (GT.EXI[s.order[after]] || {}).n);
        return;
      }
      if (again != null && again !== s.exIdx) {
        // round done: rest, then back to the first exercise of the group
        var nb = A.prefill(Object.assign({}, s, { logs: logsNext }), again);
        GT.set({ s: Object.assign(nb, { rest: { end: Date.now() + tg.rest * 1000, total: tg.rest }, justDone: -1 }) });
        if (!prToast()) A.toast('set', 'Giro di superset completato', 'Recupero, poi ' + (GT.EXI[s.order[again]] || {}).n);
        return;
      }
    }
    GT.set({ s: Object.assign({}, s, { logs: logsNext, justDone: nl.length - 1, rest: restObj }) });
    var name = GT.EXI[id] ? GT.EXI[id].n : id;
    if (pr) A.toast('pr', 'Nuovo record personale', name + ' · 1RM stimato ' + GT.fmt(e1) + ' kg');
    else A.toast('set', 'Serie ' + nl.length + ' registrata', (s.w ? GT.fmtKg(s.w) + ' kg × ' : '') + s.r + ' · ' + GT.effLabel(s.e));
  };
  A.addSet = function () {
    var s = GT.state.s, id = s.order[s.exIdx], tg = Object.assign({}, s.tg);
    tg[id] = Object.assign({}, tg[id], { sets: tg[id].sets + 1 });
    GT.set({ s: Object.assign({}, s, { tg: tg, rest: null }) });
  };
  // Swap the current exercise for an alternative for this workout only
  A.sessionSwap = function (newId) {
    var s = GT.state.s, i = s.exIdx, old = s.order[i];
    if ((s.logs[old] || []).length) return;
    if (s.order.indexOf(newId) >= 0) return; // already in this workout
    var order = s.order.slice(); order[i] = newId;
    var tg = Object.assign({}, s.tg), e = GT.EXI[newId] || {}, plan = GT.state.plan;
    // Same sets and reps; effort recomputed for the new exercise; the old one's rules do not carry over
    var rpe = tg[old].rpe;
    if (plan && plan.weeksSpec) rpe = GT.targetFor(plan, { id: newId, sets: tg[old].sets, comp: !!e.comp }, s.date).rpe;
    tg[newId] = Object.assign({}, tg[old], { rpe: rpe, note: '', minRir: null, superset: null }); delete tg[old];
    GT.set({ s: A.prefill(Object.assign({}, s, { order: order, tg: tg }), i), overlay: 'session', allenView: null, exBack: null });
  };
  A.restMinus = function () {
    var s = GT.state.s; if (!s || !s.rest) return;
    var left = Math.max(1, GT.restLeft(s) - 15);
    GT.set({ s: Object.assign({}, s, { rest: { end: Date.now() + left * 1000, total: s.rest.total } }) });
  };
  A.restPlus = function () {
    var s = GT.state.s; if (!s || !s.rest) return;
    var left = GT.restLeft(s) + 15;
    GT.set({ s: Object.assign({}, s, { rest: { end: Date.now() + left * 1000, total: Math.max(s.rest.total, left) } }) });
  };
  A.restSkip = function () { GT.set({ s: Object.assign({}, GT.state.s, { rest: null }) }); };
  A.tick = function () {
    var s = GT.state.s;
    if (s && s.rest && GT.restLeft(s) <= 0) {
      GT.set({ s: Object.assign({}, s, { rest: null }) });
      A.toast('info', 'Recupero terminato', 'Pronto per la serie successiva');
      try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
    }
  };
  A.toggleNote = function () { var s = GT.state.s; GT.set({ s: Object.assign({}, s, { showNote: !s.showNote }) }); };
  A.setNote = function (txt) {
    var s = GT.state.s, notes = Object.assign({}, s.notes); notes[s.order[s.exIdx]] = txt;
    GT.set({ s: Object.assign({}, s, { notes: notes }) });
  };

  // Number pad (bottom sheet) for kg / reps of the running set
  A.openPad = function (field) { var s = GT.state.s; GT.set({ pad: { field: field, v: field === 'w' ? (s.w == null ? '' : GT.fmtKg(s.w)) : String(s.r), fresh: true } }); };
  A.closePad = function () { GT.set({ pad: null }); };
  A.padPress = function (k) {
    var p = GT.state.pad, base = p.fresh ? '' : p.v, v;
    if (k === '⌫') v = p.v.slice(0, -1);
    else if (k === ',') { if (p.field === 'r' || base.indexOf(',') >= 0) return; v = (base || '0') + ','; }
    else v = base + k;
    if (v.length > 5) return;
    GT.set({ pad: Object.assign({}, p, { v: v, fresh: false }) });
  };
  A.padQuick = function (d) {
    var p = GT.state.pad, cur = GT.num(p.v) || 0, nv = Math.max(0, cur + d);
    GT.set({ pad: Object.assign({}, p, { v: p.field === 'r' ? String(Math.round(nv)) : GT.fmtKg(nv), fresh: false }) });
  };
  A.padCommit = function () {
    var p = GT.state.pad, s = GT.state.s, n = GT.num(p.v);
    var patch = { pad: null };
    if (n != null && (n > 0 || (p.field === 'w' && n === 0))) { var ns = Object.assign({}, s); ns[p.field] = p.field === 'r' ? Math.round(n) : n; patch.s = ns; }
    GT.set(patch);
  };

  A.finishSession = function () {
    var s = GT.state.s, st = GT.state;
    var per = s.order.map(function (id) { return { id: id, ex: GT.EXI[id], logs: s.logs[id] || [] }; }).filter(function (x) { return x.logs.length; });
    var all = []; per.forEach(function (x) { all = all.concat(x.logs); });
    var vol = all.reduce(function (a, l) { return a + l.w * l.r; }, 0);
    var prs = per.filter(function (x) { return x.logs.some(function (l) { return l.pr; }); });
    var mus = {}; per.forEach(function (x) { var m = x.ex ? GT.MUSCLE_NAME[x.ex.m] : '—'; mus[m] = (mus[m] || 0) + x.logs.length; });
    var dur = Math.max(1, Math.round((Date.now() - s.start) / 60000));
    var planned = s.order.reduce(function (a, id) { return a + s.tg[id].sets; }, 0);
    var ex = per.map(function (x) {
      var top = x.logs.reduce(function (a, b) { return (b.w > a.w || (b.w === a.w && b.r > a.r)) ? b : a; });
      var last = GT.lastPerformance(st, x.id);
      var line = x.logs.length + ' serie · top ' + (top.w ? GT.fmtKg(top.w) + ' kg × ' : '') + top.r;
      if (!last) return { name: x.ex ? x.ex.n : x.id, line: line, delta: 'prima volta', dc: 'var(--c-fg3)' };
      var lt = last.sets.reduce(function (a, b) { return (b.w > a.w || (b.w === a.w && b.r > a.r)) ? b : a; });
      var dw = top.w - lt.w, dr = top.r - lt.r;
      return {
        name: x.ex ? x.ex.n : x.id, line: line,
        delta: dw > 0 ? '+' + GT.fmtKg(dw) + ' kg' : dw < 0 ? GT.fmtKg(dw) + ' kg' : dr > 0 ? '+' + dr + ' rip' : dr < 0 ? dr + ' rip' : '=',
        dc: (dw > 0 || (dw === 0 && dr > 0)) ? 'var(--c-acc-t)' : 'var(--c-fg3)'
      };
    });
    var avgE = all.length ? all.reduce(function (a, l) { return a + (l.e || 0); }, 0) / all.length : 0;
    var avgT = s.order.length ? s.order.reduce(function (a, id) { return a + s.tg[id].rpe; }, 0) / s.order.length : 0;
    GT.set({
      overlay: 'summary', pad: null,
      summary: { dur: dur, est: GT.findDay(st.plan, s.dayId) ? GT.dayMinutes(GT.findDay(st.plan, s.dayId)) : null, sets: all.length, planned: planned, vol: vol,
        prs: prs.map(function (x) { return x.ex ? x.ex.n : x.id; }), ex: ex, mus: Object.keys(mus).map(function (m) { return m + ' · ' + mus[m] + ' serie'; }), avgE: avgE, avgTarget: avgT, empty: !all.length }
    });
  };
  A.saveSession = function () {
    var st = GT.state, sm = st.summary, s = st.s;
    if (!s) { GT.set({ summary: null, overlay: null }); return; }
    var rec = { id: 's' + s.start, date: s.date, dayId: s.dayId, dayName: s.dayName, start: s.start, dur: sm.dur, sets: s.logs, vol: sm.vol,
      prs: s.order.filter(function (id) { return (s.logs[id] || []).some(function (l) { return l.pr; }); }), rate: st.rate, notes: s.notes, week: GT.cycleWeek(st.plan, s.date).num,
      // whether it was a deload week under the plan active then (a later plan may number weeks differently)
      deload: !!GT.cycleWeek(st.plan, s.date).deload };
    GT.set(function (x) {
      var logs = Object.assign({}, x.logs); logs.sessions = (logs.sessions || []).concat([rec]);
      return { logs: logs, s: null, summary: null, overlay: null, tab: 'oggi', rate: 3 };
    });
    A.toast('info', 'Sessione salvata', sm.dur + ' min · ' + GT.fk(sm.vol) + ' kg di volume');
  };

  A.openExFromSession = function () { var s = GT.state.s; GT.set({ overlay: null, pad: null, allenView: 'exercise', exDetail: s.order[s.exIdx], exBack: 'session' }); };
  A.closeAllenView = function () {
    if (GT.state.exBack === 'session' && GT.state.s) GT.set({ allenView: null, exBack: null, overlay: 'session' });
    else GT.set({ allenView: null, exBack: null });
  };

  // ---------- cardio ----------
  A.openCardioLog = function () {
    var c = GT.findCardio(GT.state.plan, GT.state.cardioId); if (!c) return;
    var run = c.kind === 'corsa';
    GT.set({ overlay: 'cardioLog', log: { v: run ? c.km : c.m, t: c.min, e: parseInt(c.rpe, 10) || 5 } });
  };
  A.saveCardio = function () {
    var st = GT.state, c = GT.findCardio(st.plan, st.cardioId); if (!c) return;
    var run = c.kind === 'corsa', today = GT.todayISO();
    var rec = { id: 'c' + Date.now(), date: today, sessionId: st.cardioId, kind: c.kind, name: c.name, v: st.log.v, t: st.log.t, e: st.log.e };
    GT.set(function (x) { var logs = Object.assign({}, x.logs); logs.cardio = (logs.cardio || []).filter(function (l) { return !(l.date === today && l.sessionId === rec.sessionId); }).concat([rec]); return { logs: logs, overlay: null }; });
    A.toast('set', run ? 'Corsa registrata' : 'Nuoto registrato', c.name + ' · RPE ' + st.log.e);
  };

  // ---------- body ----------
  A.logWeight = function (kg, dateISO) {
    var d = dateISO || GT.todayISO(), v = Math.round(Number(kg) * 10) / 10;
    if (!(v > 20 && v < 400)) return;
    GT.setLogs(function (l) { l.weights = (l.weights || []).filter(function (w) { return w.date !== d; }).concat([{ date: d, kg: v }]).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); });
    var ws = GT.weightStats(GT.state);
    A.toast('set', 'Peso registrato', GT.fmt(v) + ' kg' + (ws.avg7 ? ' · media 7 gg ' + GT.fmt(ws.avg7) + ' kg' : ''));
  };
  A.logMeasures = function (m) {
    var d = GT.todayISO();
    GT.setLogs(function (l) { l.measures = (l.measures || []).filter(function (x) { return x.date !== d; }).concat([Object.assign({ date: d }, m)]); });
    A.toast('set', 'Misure salvate', GT.fmtShort(d));
  };

  // ---------- nutrition ----------
  A.addFood = function (meal, item, dateISO) {
    var d = dateISO || GT.state.nutriDate || GT.todayISO();
    GT.setLogs(function (l) {
      var food = Object.assign({}, l.food), day = Object.assign({}, food[d] || {});
      day[meal] = (day[meal] || []).concat([item]); food[d] = day; l.food = food;
    });
    A.toast('set', 'Aggiunto a ' + meal, item.n + ' · ' + item.k + ' kcal');
  };
  A.removeFood = function (meal, index, dateISO) {
    var d = dateISO || GT.state.nutriDate || GT.todayISO();
    GT.setLogs(function (l) {
      var food = Object.assign({}, l.food), day = Object.assign({}, food[d] || {});
      day[meal] = (day[meal] || []).filter(function (_, i) { return i !== index; }); food[d] = day; l.food = food;
    });
  };
  A.setWater = function (glasses, dateISO) {
    var d = dateISO || GT.state.nutriDate || GT.todayISO();
    GT.setLogs(function (l) { var w = Object.assign({}, l.water); w[d] = Math.max(0, glasses); l.water = w; });
  };
  // Barcode lookup on Open Food Facts (free, no key). Result in st.scan.product (values per 100 g).
  A.lookupBarcode = function (code) {
    var c = String(code || '').replace(/\D/g, '');
    if (c.length < 8) { GT.set({ scan: Object.assign({}, GT.state.scan, { error: 'Il codice deve avere almeno 8 cifre.' }) }); return; }
    GT.set({ scan: { code: c, loading: true, error: null, product: null } });
    fetch('https://world.openfoodfacts.org/api/v2/product/' + c + '.json?fields=product_name,product_name_it,brands,nutriments,serving_quantity,quantity', { headers: { accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var p = j && j.product, n = p && p.nutriments;
        if (!p || !n || (n['energy-kcal_100g'] == null && n.energy_100g == null)) throw new Error('notfound');
        var kcal = n['energy-kcal_100g'] != null ? n['energy-kcal_100g'] : n.energy_100g / 4.184;
        var product = { code: c, n: p.product_name_it || p.product_name || 'Prodotto ' + c, brand: [p.brands, p.quantity].filter(Boolean).join(' · '),
          per100: { k: Math.round(kcal), p: Math.round((n.proteins_100g || 0) * 10) / 10, c: Math.round((n.carbohydrates_100g || 0) * 10) / 10, g: Math.round((n.fat_100g || 0) * 10) / 10,
            sugars: n.sugars_100g, sat: n['saturated-fat_100g'], fiber: n.fiber_100g, salt: n.salt_100g },
          serving: Number(p.serving_quantity) || 100, src: 'barcode' };
        GT.set({ scan: { code: c, loading: false, error: null, product: product }, portion: Math.round(product.serving) || 100, nutriView: 'product' });
      })
      .catch(function (e) {
        GT.set({ scan: { code: c, loading: false, product: null, error: e && e.message === 'notfound' ? 'Prodotto non trovato nel database Open Food Facts.' : 'Ricerca non riuscita. Controlla la connessione.' } });
      });
  };

  // ---------- coach ----------
  A.coachAction = function (a, verdict) {
    var remember = function () { var coach = Object.assign({}, GT.state.coach); coach[a.id] = verdict; GT.set({ coach: coach }); };
    if (verdict !== 'ok') { remember(); return; }
    if (a.kind === 'addSet' && a.data && GT.state.plan) {
      // +1 set on the plan exercise that trains this muscle most directly: primary muscle first
      // (fewest sets), else the one that credits it most (e.g. glutes from Romanian deadlift)
      var best = null, mk = a.data.muscle, sched = {};
      // only sessions in the calendar count for the planned volume
      GT.state.plan.week.forEach(function (w) { w.items.forEach(function (it) { if (it.type === 'gym') sched[it.id] = true; }); });
      GT.state.plan.days.forEach(function (d) { if (!sched[d.id]) return; d.ex.forEach(function (x, i) {
        var e = GT.EXI[x.id]; if (!e || !e.mg || !e.mg[mk] || x.sets >= 8) return;
        var score = (e.m === mk ? 10 : 0) + e.mg[mk] - x.sets / 100;
        if (!best || score > best.score) best = { day: d.id, i: i, sets: x.sets, n: e.n, score: score };
      }); });
      if (best) { remember(); A.planSets(best.day, best.i, 1); A.toast('set', 'Serie aggiunta', best.n + ' · ' + (best.sets + 1) + ' serie'); return; }
      A.toast('info', 'Nessun esercizio adatto', 'Nella scheda nessun esercizio allena ' + (GT.MUSCLE_NAME[mk] || mk).toLowerCase() + ': aggiungine uno dalla scheda.');
      return;
    }
    remember();
    if (a.kind === 'weigh') { GT.set({ tab: 'prog', progSub: 'corpo', overlay: 'weight', weightPad: null }); return; }
    A.toast('set', 'Fatto', a.title);
  };

  // Offline replies when the AI coach is not reachable
  function cannedReply(t) {
    var st = GT.state, T = st.targets, f = GT.foodDay(st, GT.todayISO()), low = t.toLowerCase();
    if (/protein|mangi|cena|pranzo|dieta|pasto|kcal|calori/.test(low) && T) {
      return 'Oggi hai ' + GT.fk(f.tot.k) + ' kcal su ' + GT.fk(T.k) + ' e ' + f.tot.p + ' g di proteine su ' + T.p + '. Ti mancano ' + Math.max(0, T.p - f.tot.p) + ' g di proteine e ' + GT.fk(Math.max(0, T.k - f.tot.k)) + ' kcal.';
    }
    if (/spalla|dolor|fastidio|male|infortun/.test(low)) return 'Se c\'è dolore, fermati e non caricare la zona. Nel Profilo puoi segnare la limitazione: il piano escluderà gli esercizi che la stressano. Se il fastidio dura più di una settimana, fatti valutare da un medico o un fisioterapista.';
    if (/scaric|deload/.test(low)) {
      // this week's deload, else the next one, else the first of the next cycle
      var cwk = st.plan ? GT.cycleWeek(st.plan, GT.todayISO()) : null;
      var dl = !cwk ? -1 : cwk.deload ? cwk.index : GT.nextDeload(st.plan, cwk.index);
      if (cwk && dl < 0) dl = GT.nextDeload(st.plan, 0);
      if (dl < 0) return 'La tua scheda non prevede settimane di scarico. Se la fatica si accumula, fai una settimana con metà delle serie e più margine dal cedimento.';
      return 'La settimana ' + (dl + 1) + ' del ciclo è di scarico: ' + GT.deloadText(st.plan, dl) + ' Serve a smaltire la fatica accumulata.';
    }
    return 'Il coach AI non è raggiungibile in questo momento. Accedi dal Profilo e riprova quando sei online.';
  }

  // What the AI coach sees: profile, targets, plan, today, recent logs
  GT.coachContext = function (st) {
    var today = GT.todayISO(), p = st.profile || {}, plan = st.plan, d = GT.derive(st);
    var exName = function (id) { return (GT.EXI[id] || {}).n || id; };
    var setsOf = function (sets) { var o = {}; Object.keys(sets || {}).forEach(function (id) { o[exName(id)] = (sets[id] || []).map(function (l) { return { kg: l.w, rip: l.r, rpe: l.e }; }); }); return o; };
    var ws = GT.weightStats(st, 30);
    return {
      oggi: today + ' (' + GT.fmtLong(today) + ')',
      profilo: { nome: p.name, sesso: p.sex, eta: p.age, altezza_cm: p.height, peso_iniziale_kg: p.weight, obiettivo: GT.GOAL_NAME[p.goal] || p.goal, peso_obiettivo: p.targetWeight || null,
        esperienza: p.experience, giorni_palestra: p.gymDays, durata_seduta_min: p.sessionMin, attrezzatura: p.equipment, limitazioni: (p.limitations || []).map(function (l) { return l.k + (l.note ? ': ' + l.note : ''); }),
        corsa: p.runs ? p.run : null, nuoto: p.swims ? p.swim : null, attivita_quotidiana: p.activity, sonno_ore: p.sleepH, dieta: p.diet, allergie: p.allergies, pasti_al_giorno: p.mealsPerDay, scala_sforzo: st.effort },
      target_nutrizione: st.targets,
      piano: plan ? { split: plan.split, origine: plan.source ? 'scheda importata dall\'utente' : 'generato dall\'app', note_e_regole: plan.notes || null,
        progressione: plan.progression ? plan.progression.rule : '+2,5 kg dopo due sedute con il range chiuso a RPE ≤ target',
        settimane: plan.weeksSpec ? plan.weeksSpec.map(function (w, i) { return 'S' + (i + 1) + ' ' + w.type + (w.rirComp ? ' RIR multi ' + w.rirComp.join('-') + ' / iso ' + (w.rirIso || w.rirComp).join('-') : '') + ' (RPE multi ' + w.rpeComp + ' / iso ' + w.rpeIso + ')' + (w.setsMult !== 1 ? ' serie x' + w.setsMult : '') + (w.deload ? ' scarico' : ''); }) : null,
        settimana_ciclo: d.cycle.num + ' di ' + plan.cycleWeeks + (d.cycle.deload ? ' (scarico)' : ''),
        giorni: plan.days.map(function (x) { return { nome: x.name, note: (x.notes || []).join(' · ') || null, esercizi: x.ex.map(function (e) { return exName(e.id) + ' ' + e.sets + 'x' + e.reps + (e.minRir != null ? ' RIR min ' + e.minRir : '') + (e.superset ? ' superset ' + e.superset : '') + (e.note ? ' (' + e.note + ')' : ''); }) }; }),
        calendario: plan.week.map(function (w) { return GT.DAYS_SHORT[w.wd] + ': ' + (w.items.map(function (it) { return it.type === 'gym' ? (GT.findDay(plan, it.id) || {}).name : (GT.findCardio(plan, it.id) || {}).name; }).join(' + ') || 'riposo'); }),
        zone_corsa: plan.run ? plan.run.zones.map(function (z) { return z.z + ' ' + z.n + ' ' + z.label + '/km'; }) : null } : null,
      oggi_in_programma: d.todayPlan.items.map(function (i) { return (i.day ? i.day.name : i.cardio.name) + (i.done ? ' (fatto)' : ''); }),
      readiness_oggi: d.readiness ? { punteggio: d.readiness.score, valori_1_5: d.readiness.values } : 'nessun check-in',
      sessione_in_corso: st.s ? { giorno: st.s.dayName, esercizio_attuale: exName(st.s.order[st.s.exIdx]), serie: setsOf(st.s.logs) } : null,
      ultime_sessioni: (st.logs.sessions || []).slice(-5).map(function (x) { return { data: x.date, giorno: x.dayName, durata_min: x.dur, volume_kg: x.vol, fatica_1_5: x.rate, serie: setsOf(x.sets) }; }),
      record: GT.personalRecords(st).slice(0, 8).map(function (r) { return r.name + ' ' + r.w + 'x' + r.r + ' (1RM ~' + Math.round(r.e1) + ' kg, ' + r.date + ')'; }),
      cardio_recente: (st.logs.cardio || []).slice(-5).map(function (c) { return { data: c.date, nome: c.name, distanza: c.v, minuti: c.t, rpe: c.e }; }),
      peso: { media_7gg: ws.avg7 ? Math.round(ws.avg7 * 10) / 10 : null, ultime_misure: ws.series.slice(-10).map(function (w) { return w.date + ' ' + w.kg; }) },
      nutrizione_oggi: { assunti: d.tot, acqua_bicchieri: d.water, pasti: GT.foodDay(st, today).meals.map(function (m) { return { pasto: m.name, voci: m.items.map(function (f) { return f.n + ' ' + f.q + ' (' + f.k + ' kcal, P' + f.p + ')'; }) }; }) },
      aderenza_7gg: GT.adherence(st).filter(function (a) { return a.logged; }).map(function (a) { return a.date + ' ' + a.pct + '%'; }),
      settimana: GT.weekReview(st, GT.mondayOf(today))
    };
  };

  function pushCoach(text) {
    clearTimeout(chatTimer);
    GT.set(function (st) { return { chat: st.chat.concat([{ who: 'c', t: text, at: Date.now() }]), typing: false }; });
  }
  A.sendChat = function (txt) {
    var t = (typeof txt === 'string' ? txt : GT.state.chatInput).trim();
    if (!t || GT.state.typing) return;
    GT.set(function (st) { return { chat: st.chat.concat([{ who: 'u', t: t, at: Date.now() }]), chatInput: '', typing: true }; });
    var cloud = GT.cloud;
    if (cloud && cloud.coachReady && cloud.coachReady()) {
      cloud.askCoach(GT.state.chat, GT.coachContext(GT.state)).then(pushCoach, function (err) {
        pushCoach((err && err.userMessage ? err.userMessage : 'Coach non raggiungibile.') + ' ' + cannedReply(t));
      });
      return;
    }
    clearTimeout(chatTimer);
    chatTimer = setTimeout(function () { pushCoach(cannedReply(t)); }, 900);
  };

  // Clear transient state that must not survive a reload
  GT.state = Object.assign({}, GT.state, { typing: false, toast: null, pad: null, weightPad: null, foodPick: null, scan: { code: '', loading: false, error: null, product: null } });
})();
