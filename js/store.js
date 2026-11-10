/* GreyTraining — state store, persistence and actions.
   The logic is a port of the Component class in design-reference/GreyTraining.dc.html.
   State field names are kept identical to the prototype so screens map 1:1.

   API
     GT.state            current state object (treat as read-only)
     GT.set(patch|fn)    shallow-merge a patch (or fn(state) -> patch), re-render, persist
     GT.act.*            actions shared across screens (session, nutrition, chat, toast…)
     GT.derive(st)       values computed from state that several screens need
     GT.v(key)           layout variant 'A' | 'B' (vOggi, vSessione, vNutri, vProg, vCoach)
*/
(function () {
  'use strict';
  var GT = window.GT;
  var STORAGE_KEY = 'greytraining.v1';

  // Keys written to localStorage. UI navigation state is deliberately not persisted,
  // except an open session/summary so a reload (iOS may kill the PWA) lands back there.
  var PERSIST = ['primary', 'secondary', 'bgTone', 'theme', 'scale', 'effort',
    'cardioDone', 'weightLogged', 'ready', 'workoutDone', 'doneLine', 's', 'summary', 'rate',
    'water', 'food', 'coach', 'chat', 'editor', 'notify', 'goal', 'equip', 'history'];

  function initialState() {
    return {
      // appearance
      primary: '#E95145', secondary: '#FFFBF9', bgTone: 'nero', theme: 'dark', scale: 1, effort: 'RPE',
      // navigation
      tab: 'oggi', overlay: null, allenSub: 'scheda', allenView: null, disc: 'palestra',
      cardioId: 'rip', cardioDone: { nuoto1: { v: 1500, t: 36, e: 3 } }, log: null,
      libQuery: '', libMuscle: 'Tutti', exDetail: 'bench', exBack: null,
      nutriSub: 'diario', nutriView: null, scanMode: 'barcode', scanLoading: false, scanErr: false,
      portion: 170, prodMeal: 'Spuntino', prodSrc: 'barcode',
      progSub: 'corpo', strEx: 'Panca', range: '12S', weightLogged: false,
      // readiness check-in (1–5 each)
      ready: { sonno: 4, energia: 4, dolori: 4 },
      // gym session
      workoutDone: false, doneLine: '', s: null, summary: null, rate: 3, pad: null,
      // nutrition
      water: 5, qaMeal: 'Spuntino', food: JSON.parse(JSON.stringify(GT.FOOD_SEED)),
      // coach
      coach: {}, chat: GT.CHAT_SEED.slice(), chatInput: '', typing: false,
      // plan editor (Upper A)
      editor: GT.EX.map(function (e) { return { id: e.id, name: e.name, sets: e.sets, reps: e.reps, eff: e.eff, rest: e.rest }; }),
      // profile
      notify: { garmin: false, strava: false }, goal: 'Ricomposizione',
      equip: { Bilanciere: true, Manubri: true, Cavi: true, Macchine: true, Rack: true, Kettlebell: false, Elastici: false },
      // saved gym sessions (summaries), newest last
      history: [],
      toast: null, online: navigator.onLine !== false
    };
  }

  function load() {
    var st = initialState();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        PERSIST.forEach(function (k) { if (saved[k] !== undefined) st[k] = saved[k]; });
        if (saved.overlay === 'session' && st.s) st.overlay = 'session';
        if (saved.overlay === 'summary' && st.summary) st.overlay = 'summary';
      }
    } catch (e) { /* private mode or corrupt data: start from the seed */ }
    // Sessions saved by an older shape without a rest end timestamp
    if (st.s && st.s.rest && !st.s.rest.end) st.s.rest = null;
    return st;
  }

  var saveTimer = null, resetting = false;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (resetting) return;
    try {
      var out = {};
      PERSIST.forEach(function (k) { out[k] = GT.state[k]; });
      out.overlay = GT.state.overlay === 'session' || GT.state.overlay === 'summary' ? GT.state.overlay : null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch (e) { /* storage full or blocked: the app keeps working in memory */ }
  }
  function scheduleSave() { if (!saveTimer) saveTimer = setTimeout(save, 250); }
  GT.saveNow = save;
  // Clear saved data and restart from the seed (no save on the way out)
  GT.resetAll = function () { resetting = true; try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} location.reload(); };

  GT.state = load();
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
    GT.state = Object.assign({}, GT.state, p);
    GT.render();
    scheduleSave();
  };
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') save(); });
  window.addEventListener('pagehide', save);
  window.addEventListener('online', function () { GT.set({ online: true }); });
  window.addEventListener('offline', function () { GT.set({ online: false }); });

  // ---------- Layout variants (design exploration A/B) ----------
  // Default A. Override with ?vOggi=B&vSessione=B… (remembered on this device).
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
  // Black or warm white, whichever has the higher WCAG contrast on the colour
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
  GT.totals = function (st) {
    var all = [];
    GT.MEALS.forEach(function (m) { all = all.concat(st.food[m] || []); });
    return all.reduce(function (a, f) { return { k: a.k + f.k, p: a.p + f.p, c: a.c + f.c, g: a.g + f.g }; }, { k: 0, p: 0, c: 0, g: 0 });
  };
  GT.restLeft = function (s) { return s && s.rest ? Math.max(0, Math.ceil((s.rest.end - Date.now()) / 1000)) : 0; };
  GT.elapsed = function (s) {
    if (!s) return '';
    var e = Math.floor((Date.now() - s.start) / 1000);
    return e >= 3600 ? Math.floor(e / 3600) + ':' + GT.mmss(e % 3600).padStart(5, '0') : GT.mmss(e);
  };
  GT.effLabel = function (e) { return GT.state.effort === 'RIR' ? 'RIR ' + (10 - e) : 'RPE ' + GT.fmt(e); };
  GT.derive = function (st) {
    var r = st.ready, score = Math.round((r.sonno + r.energia + r.dolori - 3) / 12 * 100);
    var tot = GT.totals(st), T = GT.TARGET;
    var readyLabel = score >= 75 ? 'Pronto per spingere' : score >= 55 ? 'Nella media' : 'Recupero ridotto';
    var coachTip = st.workoutDone ? 'Sessione registrata. Ti mancano ' + Math.max(0, T.p - tot.p) + ' g di proteine: distribuiscile tra spuntino e cena.'
      : score >= 75 ? 'Panca: la scorsa volta 3 × 8 a 80 kg, RPE 7–8. Oggi 82,5 kg × 8, fermati a RPE 8.'
      : score >= 55 ? 'Readiness nella media. Mantieni i carichi della scorsa sessione e chiudi le serie a RPE 7–8.'
      : 'Readiness bassa. Oggi una serie in meno per esercizio, RPE massimo 7. Il volume perso si recupera in settimana.';
    var kLeft = Math.max(0, T.k - tot.k);
    var macros = [['Proteine', 'P', 'p'], ['Carboidrati', 'C', 'c'], ['Grassi', 'G', 'g']].map(function (x) {
      var k = x[2];
      return { label: x[0], short: x[1], eaten: tot[k], target: T[k], left: Math.max(0, T[k] - tot[k]), pct: Math.min(100, tot[k] / T[k] * 100).toFixed(0) + '%' };
    });
    return {
      score: score, readyLabel: readyLabel, readyOffset: (175.9 * (1 - score / 100)).toFixed(1), coachTip: coachTip,
      tot: tot, kLeft: kLeft, kcalLeft: GT.fk(kLeft), kcalEaten: GT.fk(tot.k), kcalEatenLine: GT.fk(tot.k) + ' / 2.600 kcal',
      kcalPct: Math.min(100, tot.k / T.k * 100).toFixed(0) + '%', kcalRingOffset: (364.4 * Math.min(1, tot.k / T.k)).toFixed(1), macros: macros,
      startLabel: st.s ? 'Riprendi allenamento' : 'Inizia allenamento',
      fullScreen: st.overlay === 'session' || st.overlay === 'summary' || st.overlay === 'profile' || !!st.allenView || !!st.nutriView
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

  // Tab navigation closes full-screen views; a running session stays (mini-bar)
  A.goTab = function (id) { GT.set({ tab: id, overlay: null, allenView: null, nutriView: null, pad: null }); };

  // Prefill a set: first set = coach suggestion, then the last logged values. Effort = target.
  A.prefill = function (s, i) {
    var ex = GT.EX[i], logs = s.logs[ex.id] || [], l = logs[logs.length - 1];
    return Object.assign({}, s, { exIdx: i, w: l ? l.w : ex.sug[0], r: l ? l.r : ex.sug[1], e: ex.eff, justDone: -1 });
  };
  A.startSession = function () {
    var st = GT.state;
    if (st.s) { GT.set({ overlay: 'session' }); return; }
    GT.set({ s: A.prefill({ start: Date.now(), logs: {}, plan: {}, rest: null, notes: {}, showNote: false }, 0), overlay: 'session', summary: null });
  };
  A.minimizeSession = function () { GT.set({ overlay: null, pad: null }); };
  A.jumpToExercise = function (i) { var s = GT.state.s; GT.set({ s: A.prefill(Object.assign({}, s), i) }); };
  A.nextExercise = function () { var s = GT.state.s; GT.set({ s: Object.assign(A.prefill(s, s.exIdx + 1), { rest: s.rest }) }); };
  A.setEffort = function (e) { GT.set({ s: Object.assign({}, GT.state.s, { e: e }) }); };

  A.completeSet = function () {
    var s = GT.state.s, ex = GT.EX[s.exIdx], logs = s.logs[ex.id] || [];
    var e1 = GT.epley(s.w, s.r);
    var prev = Math.max.apply(null, [GT.best(ex), 0].concat(logs.map(function (l) { return l.e1; })));
    var pr = e1 > prev + 0.05;
    var nl = logs.concat([{ w: s.w, r: s.r, e: s.e, e1: e1, pr: pr }]), plan = s.plan[ex.id] || ex.sets;
    var lastAll = s.exIdx === GT.EX.length - 1 && nl.length >= plan;
    var logsNext = Object.assign({}, s.logs); logsNext[ex.id] = nl;
    GT.set({ s: Object.assign({}, s, { logs: logsNext, justDone: nl.length - 1, rest: lastAll ? null : { end: Date.now() + ex.rest * 1000, total: ex.rest } }) });
    if (pr) A.toast('pr', 'Nuovo record personale', ex.name.split(' ')[0] + ' · 1RM stimato ' + GT.fmt(e1) + ' kg');
    else A.toast('set', 'Serie ' + nl.length + ' registrata', GT.fmtKg(s.w) + ' kg × ' + s.r + ' · ' + GT.effLabel(s.e));
  };
  A.addSet = function () {
    var s = GT.state.s, ex = GT.EX[s.exIdx], plan = Object.assign({}, s.plan);
    plan[ex.id] = (s.plan[ex.id] || ex.sets) + 1;
    GT.set({ s: Object.assign({}, s, { plan: plan, rest: null }) });
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
  // Called every second by app.js
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
    var s = GT.state.s, notes = Object.assign({}, s.notes); notes[GT.EX[s.exIdx].id] = txt;
    GT.set({ s: Object.assign({}, s, { notes: notes }) });
  };

  // Number pad (bottom sheet) for kg / reps
  A.openPad = function (field) { var s = GT.state.s; GT.set({ pad: { field: field, v: field === 'w' ? GT.fmtKg(s.w) : String(s.r), fresh: true } }); };
  A.closePad = function () { GT.set({ pad: null }); };
  A.padPress = function (k) {
    // The first key pressed replaces the prefilled value; the comma is allowed only for kg.
    var p = GT.state.pad, base = p.fresh ? '' : p.v, v;
    if (k === '⌫') v = p.v.slice(0, -1);
    else if (k === ',') { if (p.field !== 'w' || base.indexOf(',') >= 0) return; v = (base || '0') + ','; }
    else v = base + k;
    if (v.length > 5) return;
    GT.set({ pad: Object.assign({}, p, { v: v, fresh: false }) });
  };
  A.padQuick = function (d) {
    var p = GT.state.pad, cur = parseFloat((p.v || '0').replace(',', '.')) || 0, nv = Math.max(0, cur + d);
    GT.set({ pad: Object.assign({}, p, { v: p.field === 'w' ? GT.fmtKg(nv) : String(Math.round(nv)), fresh: false }) });
  };
  A.padCommit = function () {
    var p = GT.state.pad, s = GT.state.s, n = parseFloat((p.v || '0').replace(',', '.'));
    var patch = { pad: null };
    if (!isNaN(n) && n > 0) { var ns = Object.assign({}, s); ns[p.field] = p.field === 'r' ? Math.round(n) : n; patch.s = ns; }
    GT.set(patch);
  };

  A.finishSession = function () {
    var s = GT.state.s;
    var per = GT.EX.map(function (ex) { return { ex: ex, logs: s.logs[ex.id] || [] }; }).filter(function (x) { return x.logs.length; });
    var all = []; per.forEach(function (x) { all = all.concat(x.logs); });
    var vol = all.reduce(function (a, l) { return a + l.w * l.r; }, 0);
    var prs = per.filter(function (x) { return x.logs.some(function (l) { return l.pr; }); });
    var mus = {}; per.forEach(function (x) { mus[x.ex.muscle] = (mus[x.ex.muscle] || 0) + x.logs.length; });
    var dur = Math.max(1, Math.round((Date.now() - s.start) / 60000));
    var ex = per.map(function (x) {
      var top = x.logs.reduce(function (a, b) { return (b.w > a.w || (b.w === a.w && b.r > a.r)) ? b : a; });
      var lt = x.ex.last.reduce(function (a, b) { return (b[0] > a[0] || (b[0] === a[0] && b[1] > a[1])) ? b : a; });
      var dw = top.w - lt[0], dr = top.r - lt[1];
      return {
        name: x.ex.name, line: x.logs.length + ' serie · top ' + GT.fmtKg(top.w) + ' kg × ' + top.r,
        delta: dw > 0 ? '+' + GT.fmtKg(dw) + ' kg' : dw < 0 ? GT.fmtKg(dw) + ' kg' : dr > 0 ? '+' + dr + ' rip' : dr < 0 ? dr + ' rip' : '=',
        dc: (dw > 0 || (dw === 0 && dr > 0)) ? 'var(--c-acc-t)' : 'var(--c-fg3)'
      };
    });
    var avgE = all.length ? all.reduce(function (a, l) { return a + l.e; }, 0) / all.length : 0;
    GT.set({
      overlay: 'summary', pad: null,
      summary: { dur: dur, sets: all.length, vol: vol, prs: prs.map(function (x) { return x.ex.name; }), ex: ex, mus: Object.keys(mus).map(function (m) { return m + ' · ' + mus[m] + ' serie'; }), avgE: avgE, empty: !all.length }
    });
  };
  A.saveSession = function () {
    var st = GT.state, sm = st.summary;
    var rec = { date: new Date().toISOString(), day: 'Upper A', rate: st.rate, summary: sm, logs: st.s ? st.s.logs : {}, notes: st.s ? st.s.notes : {} };
    GT.set({ workoutDone: true, doneLine: sm.dur + ' min · ' + GT.fk(sm.vol) + ' kg', s: null, summary: null, overlay: null, tab: 'oggi', history: (st.history || []).concat([rec]) });
    A.toast('info', 'Sessione salvata', 'Analisi aggiornata nella tab Coach');
  };

  // Exercise detail opened from the session: back returns to the session
  A.openExFromSession = function () { GT.set({ overlay: null, pad: null, allenView: 'exercise', exDetail: GT.EX[GT.state.s.exIdx].id, exBack: 'session' }); };
  A.closeAllenView = function () {
    if (GT.state.exBack === 'session' && GT.state.s) GT.set({ allenView: null, exBack: null, overlay: 'session' });
    else GT.set({ allenView: null, exBack: null });
  };

  // Cardio log sheet
  A.openCardioLog = function () {
    var c = GT.CARDIO[GT.state.cardioId], run = c.kind === 'corsa';
    GT.set({ overlay: 'cardioLog', log: { v: run ? c.km : c.m, t: c.min, e: parseInt(c.rpe, 10) || 5 } });
  };
  A.saveCardio = function () {
    var st = GT.state, c = GT.CARDIO[st.cardioId], run = c.kind === 'corsa', done = Object.assign({}, st.cardioDone);
    done[st.cardioId] = st.log;
    GT.set({ cardioDone: done, overlay: null });
    A.toast('set', run ? 'Corsa registrata' : 'Nuoto registrato', c.name + ' · RPE ' + st.log.e);
  };

  // Nutrition
  A.addFood = function (meal, item) {
    var food = Object.assign({}, GT.state.food); food[meal] = (food[meal] || []).concat([item]);
    GT.set({ food: food });
    A.toast('set', 'Aggiunto a ' + meal, item.n + ' · ' + item.k + ' kcal');
  };
  A.productItem = function (st) {
    var pr = GT.PRODUCT.per100, pf = st.portion / 100;
    return { n: GT.PRODUCT.n, q: st.portion + ' g', k: Math.round(pr.k * pf), p: Math.round(pr.p * pf), c: Math.round(pr.c * pf), g: Math.round(pr.g * pf) };
  };
  A.openScanner = function () { GT.set({ nutriView: 'scanner', overlay: null, scanErr: false, scanLoading: false }); };
  // The camera and barcode lookup are placeholders: barcode goes straight to the product,
  // label photo shows ~1.4 s of "reading" first.
  A.doScan = function () {
    if (GT.state.scanMode === 'label') {
      GT.set({ scanLoading: true });
      setTimeout(function () { if (GT.state.nutriView === 'scanner') GT.set({ scanLoading: false, nutriView: 'product', prodSrc: 'label' }); }, 1400);
    } else GT.set({ nutriView: 'product', prodSrc: 'barcode' });
  };
  A.addProduct = function () {
    var st = GT.state;
    A.addFood(st.prodMeal, A.productItem(st));
    GT.set({ nutriView: null, nutriSub: 'diario', tab: 'nutri' });
  };

  A.logWeight = function () {
    if (GT.state.weightLogged) return;
    GT.set({ weightLogged: true });
    A.toast('set', 'Peso registrato', '78,3 kg · media 7 gg 78,4 kg');
  };

  // Coach chat — canned keyword replies, as in the prototype (production: LLM with context)
  A.sendChat = function (txt) {
    var t = (typeof txt === 'string' ? txt : GT.state.chatInput).trim();
    if (!t) return;
    GT.set(function (st) { return { chat: st.chat.concat([{ who: 'u', t: t }]), chatInput: '', typing: true }; });
    var tot = GT.totals(GT.state), pLeft = Math.max(0, GT.TARGET.p - tot.p), low = t.toLowerCase();
    var reply = /scaric|deload/.test(low) ? 'Scarico in settimana 5: stessi esercizi, circa 40% di serie in meno, RPE 6. Serve a smaltire la fatica accumulata in 4 settimane di accumulo. Se in settimana 4 la readiness resta sotto 55 per 3 giorni, lo anticipo.'
      : /protein|mangi|cena|dieta|pasto/.test(low) ? 'Ti mancano ' + pLeft + ' g di proteine. Cena: 200 g di salmone + 150 g di yogurt greco ≈ 60 g di proteine, 520 kcal. Carboidrati liberi nei ' + GT.fk(Math.max(0, GT.TARGET.k - tot.k - 520)) + ' kcal restanti.'
      : /spalla|dolor|fastidio|male/.test(low) ? 'Limitazione spalla sinistra attiva: niente dip, military sotto RPE 8. Oggi sostituisco la military con alzate laterali ai cavi 3 × 12–15. Se il fastidio dura più di una settimana, fatti valutare da un fisioterapista.'
      : "Ultime 3 settimane: volume petto +12%, dorso +9%, peso −0,3 kg/sett. Progressione in linea con l'obiettivo. Mantieni i carichi suggeriti e chiudi ogni serie a RPE 8.";
    clearTimeout(chatTimer);
    chatTimer = setTimeout(function () { GT.set(function (st) { return { chat: st.chat.concat([{ who: 'c', t: reply }]), typing: false }; }); }, 1300);
  };
  A.coachAction = function (id, verdict, a) {
    var coach = Object.assign({}, GT.state.coach); coach[id] = verdict;
    GT.set({ coach: coach });
    if (verdict === 'ok' && a) A.toast('set', a.doneLabel, a.title);
  };

  // Clear transient state that must not survive a reload
  GT.state = Object.assign({}, GT.state, { typing: false, toast: null, pad: null, scanLoading: false });
})();
