/* GreyTraining — dates, nutrition targets, pace zones and the plan generator.
   Everything here is deterministic and runs on the phone (offline). The coach AI receives the
   result as context and can suggest changes, but the plan never depends on the network.

   Profile (from onboarding, GT.state.profile):
   { name, sex 'm'|'f', age, height (cm), weight (kg), goal, targetWeight?, experience,
     gymDays 0-6, sessionMin, days [weekday 0=Mon … 6=Sun], equipment [], limitations [{k, note}],
     runs, run { kmWeek, testDist 5|10|0, testTime 'mm:ss' }, swims, swim { perWeek },
     activity, sleepH, diet, allergies [], mealsPerDay 3|4|5 }
   goal:       'massa' | 'definizione' | 'ricomposizione' | 'forza' | 'resistenza' | 'salute'
   experience: 'principiante' | 'intermedio' | 'avanzato'
   activity:   'sedentario' | 'in_piedi' | 'attivo' | 'molto_attivo'                          */
(function () {
  'use strict';
  var GT = (window.GT = window.GT || {});

  // ---------- dates (local time, ISO yyyy-mm-dd) ----------
  var DAYS_LONG = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  var DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  var DAYS_LETTER = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
  var MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  GT.DAYS_LONG = DAYS_LONG; GT.DAYS_SHORT = DAYS_SHORT; GT.DAYS_LETTER = DAYS_LETTER;

  var pad = function (n) { return String(n).padStart(2, '0'); };
  GT.iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  GT.parseISO = function (s) { var p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  GT.todayISO = function () { return GT.iso(new Date()); };
  GT.addDays = function (s, n) { var d = GT.parseISO(s); d.setDate(d.getDate() + n); return GT.iso(d); };
  GT.weekday = function (s) { return (GT.parseISO(s).getDay() + 6) % 7; }; // 0 = Monday
  GT.mondayOf = function (s) { return GT.addDays(s, -GT.weekday(s)); };
  GT.daysBetween = function (a, b) { return Math.round((GT.parseISO(b) - GT.parseISO(a)) / 86400000); };
  GT.weekDates = function (s) { var m = GT.mondayOf(s); return [0, 1, 2, 3, 4, 5, 6].map(function (i) { return GT.addDays(m, i); }); };
  GT.fmtLong = function (s) { var d = GT.parseISO(s); return DAYS_LONG[GT.weekday(s)] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
  GT.fmtShort = function (s) { var d = GT.parseISO(s); return DAYS_SHORT[GT.weekday(s)] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); };
  GT.fmtDay = function (s) { var d = GT.parseISO(s); return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); };
  // "9–15 nov" for a week
  GT.fmtRange = function (a, b) {
    var da = GT.parseISO(a), db = GT.parseISO(b);
    return da.getMonth() === db.getMonth() ? da.getDate() + '–' + db.getDate() + ' ' + MONTHS[db.getMonth()].slice(0, 3)
      : GT.fmtDay(a) + ' – ' + GT.fmtDay(b);
  };
  // Seconds per km -> "5:35"
  GT.pace = function (sec) { sec = Math.round(sec); return Math.floor(sec / 60) + ':' + pad(sec % 60); };
  GT.parseTime = function (t) {
    var p = String(t || '').trim().split(':').map(Number);
    if (p.some(isNaN) || !p.length) return 0;
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60;
  };

  // ---------- labels ----------
  GT.GOALS = [
    { k: 'massa', n: 'Massa muscolare', d: 'Più muscoli, leggero surplus calorico' },
    { k: 'definizione', n: 'Definizione', d: 'Meno grasso, mantenendo i muscoli' },
    { k: 'ricomposizione', n: 'Ricomposizione', d: 'Meno grasso e più muscoli, insieme' },
    { k: 'forza', n: 'Forza', d: 'Carichi più alti sui fondamentali' },
    { k: 'resistenza', n: 'Resistenza', d: 'Corsa e condizione, con la palestra a supporto' },
    { k: 'salute', n: 'Salute e forma', d: 'Allenarsi con costanza, stare bene' }
  ];
  GT.GOAL_NAME = {}; GT.GOALS.forEach(function (g) { GT.GOAL_NAME[g.k] = g.n; });
  GT.EXPERIENCE = [
    { k: 'principiante', n: 'Principiante', d: 'Meno di 6 mesi di palestra costante' },
    { k: 'intermedio', n: 'Intermedio', d: 'Da 6 mesi a 2-3 anni' },
    { k: 'avanzato', n: 'Avanzato', d: 'Più di 3 anni, tecnica solida sui fondamentali' }
  ];
  GT.ACTIVITY = [
    { k: 'sedentario', n: 'Sedentario', d: 'Lavoro alla scrivania, meno di 5.000 passi', f: 1.2 },
    { k: 'in_piedi', n: 'Poco attivo', d: 'Spesso in piedi o 5.000–8.000 passi', f: 1.3 },
    { k: 'attivo', n: 'Attivo', d: 'Lavoro in movimento o 8.000–12.000 passi', f: 1.4 },
    { k: 'molto_attivo', n: 'Molto attivo', d: 'Lavoro fisico o più di 12.000 passi', f: 1.55 }
  ];

  // ---------- nutrition ----------
  var MEAL_SETS = {
    3: [['Colazione', 0.3], ['Pranzo', 0.4], ['Cena', 0.3]],
    4: [['Colazione', 0.25], ['Pranzo', 0.35], ['Spuntino', 0.1], ['Cena', 0.3]],
    5: [['Colazione', 0.2], ['Spuntino mattina', 0.1], ['Pranzo', 0.3], ['Spuntino', 0.1], ['Cena', 0.3]]
  };
  GT.mealsFor = function (profile) { return (MEAL_SETS[(profile && profile.mealsPerDay) || 4] || MEAL_SETS[4]).map(function (m) { return m[0]; }); };

  // Mifflin–St Jeor BMR, activity factor plus training, goal adjustment, macros by body weight.
  GT.computeTargets = function (p) {
    var w = Number(p.weight) || 75, h = Number(p.height) || 175, a = Number(p.age) || 30;
    var bmr = 10 * w + 6.25 * h - 5 * a + (p.sex === 'f' ? -161 : 5);
    var act = GT.ACTIVITY.filter(function (x) { return x.k === p.activity; })[0] || GT.ACTIVITY[0];
    var runKm = p.runs ? Number(p.run && p.run.kmWeek) || 0 : 0;
    var factor = Math.min(1.95, act.f + 0.035 * (Number(p.gymDays) || 0) + 0.004 * runKm + (p.swims ? 0.02 * ((p.swim && p.swim.perWeek) || 1) : 0));
    var tdee = bmr * factor;
    var adj = { massa: 1.1, forza: 1.05, ricomposizione: 0.93, definizione: 0.8, resistenza: 1, salute: 1 }[p.goal] || 1;
    var floor = p.sex === 'f' ? 1400 : 1600;
    var k = Math.max(floor, Math.round(tdee * adj / 50) * 50);
    var protPerKg = { massa: 1.8, forza: 2, ricomposizione: 2.2, definizione: 2.2, resistenza: 1.6, salute: 1.6 }[p.goal] || 1.8;
    if (p.diet === 'vegana') protPerKg += 0.2;
    var prot = Math.round(w * protPerKg / 5) * 5;
    var fat = Math.max(Math.round(w * 0.9 / 5) * 5, Math.round(k * 0.22 / 9 / 5) * 5);
    var carbs = Math.max(0, Math.round((k - prot * 4 - fat * 9) / 4 / 5) * 5);
    // ~35 ml/kg, +250 ml with 4+ training days, in 250 ml glasses
    var water = Math.max(1.5, Math.round((w * 0.035 + ((Number(p.gymDays) || 0) >= 4 ? 0.25 : 0)) * 4) / 4);
    var meals = (MEAL_SETS[p.mealsPerDay || 4] || MEAL_SETS[4]).map(function (m) {
      return { n: m[0], k: Math.round(k * m[1] / 10) * 10, p: Math.round(prot * m[1]), c: Math.round(carbs * m[1]), g: Math.round(fat * m[1]) };
    });
    return {
      k: k, p: prot, c: carbs, g: fat, water: water, glasses: Math.round(water / 0.25),
      bmr: Math.round(bmr), tdee: Math.round(tdee), factor: Math.round(factor * 100) / 100, adj: adj,
      protPerKg: Math.round(prot / w * 10) / 10, meals: meals
    };
  };

  // ---------- running ----------
  // Pace for 10 km (s/km) from a test, or an estimate from the weekly volume
  GT.p10From = function (run) {
    var dist = Number(run && run.testDist), t = GT.parseTime(run && run.testTime);
    if (t > 0 && dist === 10) return t / 10;
    if (t > 0 && dist === 5) return t / 5 * Math.pow(2, 0.06); // Riegel: T10 = T5 × 2^1.06
    var km = Number(run && run.kmWeek) || 0;
    return km >= 30 ? 300 : km >= 15 ? 340 : 390; // 5:00, 5:40, 6:30 /km
  };
  // Zones from the 10 km pace (same offsets as the prototype: 10 km in 47:30 -> Z2 5:35–6:15).
  // fast/slow are s/km; label is "fast–slow /km", or "oltre"/"sotto" at the ends.
  GT.paceZones = function (p10) {
    var z = [
      { z: 'Z1', n: 'Recupero', fast: p10 + 90, slow: null },
      { z: 'Z2', n: 'Fondo', fast: p10 + 50, slow: p10 + 90 },
      { z: 'Z3', n: 'Medio', fast: p10 + 15, slow: p10 + 50 },
      { z: 'Z4', n: 'Soglia', fast: p10 - 10, slow: p10 + 15 },
      { z: 'Z5', n: 'VO2max', fast: null, slow: p10 - 10 }
    ];
    z.forEach(function (x) {
      x.label = x.slow == null ? 'oltre ' + GT.pace(x.fast) : x.fast == null ? 'sotto ' + GT.pace(x.slow) : GT.pace(x.fast) + '–' + GT.pace(x.slow);
    });
    return z;
  };
  var r1 = function (x) { return Math.round(x * 2) / 2; }; // half km

  function runSessions(p, p10, runs) {
    var km = Math.max(6, Number(p.run && p.run.kmWeek) || 10);
    var easyPace = p10 + 70, longPace = p10 + 65;
    var out = {}, ids = [];
    var longKm = r1(Math.max(6, km * (runs >= 3 ? 0.35 : 0.5)));
    var quality = runs >= 3 || km >= 20;
    var qualityKm = quality ? r1(Math.max(6, km * 0.25)) : 0;
    var easyCount = runs - 1 - (quality ? 1 : 0);
    var easyKm = easyCount > 0 ? r1(Math.max(4, (km - longKm - qualityKm) / easyCount)) : 0;
    var minutes = function (kmv, pace) { return Math.round(kmv * pace / 60); };
    if (quality) {
      var reps = km >= 35 ? 6 : km >= 25 ? 5 : 4;
      var wu = 2, cd = 1.5, work = reps * 0.8, rec = reps * 0.3;
      var qk = r1(wu + cd + work + rec);
      out.q = { kind: 'corsa', id: 'q', name: 'Ripetute ' + reps + ' × 800 m', tag: 'Qualità', km: qk, min: minutes(wu + cd, easyPace) + Math.round(work * (p10 - 15) / 60) + reps * 2, rpe: '8',
        blocks: [['Riscaldamento', 'Z2 · ' + GT.pace(p10 + 60) + '/km', wu + ' km', 2, minutes(wu, p10 + 60)], ['Allunghi', '4 × 20 s progressivi', '2 min', 3, 2],
          [reps + ' × 800 m', GT.pace(p10 - 20) + '–' + GT.pace(p10 - 10) + '/km · rec. 2 min trotto', Math.round(work * (p10 - 15) / 60 + reps * 2) + ' min', 5, Math.round(work * (p10 - 15) / 60 + reps * 2)],
          ['Defaticamento', 'Z1 · oltre ' + GT.pace(p10 + 90) + '/km', cd + ' km', 1, minutes(cd, p10 + 95)]],
        note: 'Arrivaci con le gambe fresche: non il giorno dopo l\'allenamento gambe. Se la readiness è sotto 55, togli una ripetuta.' };
      ids.push('q');
    }
    for (var i = 0; i < easyCount; i++) {
      var id = 'e' + (i + 1);
      out[id] = { kind: 'corsa', id: id, name: 'Corsa facile ' + GT.fmt(easyKm) + ' km', tag: 'Recupero', km: easyKm, min: minutes(easyKm, easyPace), rpe: '3–4',
        blocks: [['Corsa continua', 'Z2 · ' + GT.pace(p10 + 50) + '–' + GT.pace(p10 + 90) + '/km', GT.fmt(easyKm) + ' km', 2, minutes(easyKm, easyPace)]],
        note: 'Ritmo in cui riesci a parlare. Se le gambe sono pesanti, accorcia invece di accelerare.' };
      ids.push(id);
    }
    var lastKm = longKm >= 10 && p.experience !== 'principiante' ? 2 : 0;
    out.l = { kind: 'corsa', id: 'l', name: 'Lungo ' + GT.fmt(longKm) + ' km', tag: 'Aerobico', km: longKm, min: minutes(longKm, longPace), rpe: '5–6',
      blocks: [['Riscaldamento', 'Z1 · ' + GT.pace(p10 + 90) + '/km', '1 km', 1, minutes(1, p10 + 90)], ['Fondo', 'Z2 · ' + GT.pace(p10 + 55) + '–' + GT.pace(p10 + 75) + '/km', GT.fmt(longKm - 1 - lastKm) + ' km', 2, minutes(longKm - 1 - lastKm, longPace)]]
        .concat(lastKm ? [['Finale progressivo', 'Z3 · ' + GT.pace(p10 + 25) + '/km', lastKm + ' km', 3, minutes(lastKm, p10 + 25)]] : []),
      note: 'Tieni il fondo in Z2 anche se ti senti bene: costruisce la base aerobica senza togliere energia alla palestra.' };
    ids.push('l');
    // Library sessions, always available from the Corsa tab
    var lib = {
      facile: { kind: 'corsa', id: 'facile', name: 'Corsa facile 5 km', tag: 'Recupero', km: 5, min: minutes(5, easyPace), rpe: '3–4', blocks: [['Corsa continua', 'Z1–Z2', '5 km', 2, minutes(5, easyPace)]], note: 'Ritmo di conversazione.' },
      prog: { kind: 'corsa', id: 'prog', name: 'Progressivo 6 km', tag: 'Aerobico', km: 6, min: minutes(6, p10 + 40), rpe: '6–7', blocks: [['Primi 3 km', 'Z2 · ' + GT.pace(p10 + 60) + '/km', '3 km', 2, minutes(3, p10 + 60)], ['Km 4–5', 'Z3 · ' + GT.pace(p10 + 30) + '/km', '2 km', 3, minutes(2, p10 + 30)], ['Ultimo km', 'Z4 · ' + GT.pace(p10 + 5) + '/km', '1 km', 4, minutes(1, p10 + 5)]], note: 'Ogni blocco un po\' più veloce del precedente.' },
      soglia: { kind: 'corsa', id: 'soglia', name: 'Soglia 3 × 8 min', tag: 'Qualità', km: 8, min: 50, rpe: '7–8', blocks: [['Riscaldamento', 'Z2', '15 min', 2, 15], ['3 × 8 min', 'Z4 · ' + GT.pace(p10) + '–' + GT.pace(p10 + 10) + '/km · rec. 2 min', '30 min', 4, 30], ['Defaticamento', 'Z1', '8 min', 1, 8]], note: 'Ritmo "comodamente duro": frasi brevi, non conversazione.' },
      fartlek: { kind: 'corsa', id: 'fartlek', name: 'Fartlek 8 × 1 min', tag: 'Qualità', km: 7, min: 40, rpe: '7', blocks: [['Riscaldamento', 'Z2', '12 min', 2, 12], ['8 × 1 min veloce', 'Z4–Z5 · rec. 1 min facile', '16 min', 5, 16], ['Defaticamento', 'Z1', '10 min', 1, 10]], note: 'Variazioni a sensazione, senza guardare il passo.' }
    };
    return { sessions: out, order: ids, library: lib, weeklyKm: r1(longKm + qualityKm + easyKm * Math.max(0, easyCount)) };
  }

  function swimSessions(n) {
    var all = [
      { kind: 'piscina', id: 's1', name: 'Nuoto aerobico 1.200 m', tag: 'Defaticamento', m: 1200, min: 30, rpe: '3–4', blocks: [['Riscaldamento', 'misti, molto facile', '200 m', 1, 5], ['4 × 100 m stile', 'rec. 20 s · respiro ogni 3', '400 m', 2, 9], ['4 × 50 m gambe', 'con tavoletta · rec. 15 s', '200 m', 2, 6], ['Dorso e rana', 'scioltezza', '400 m', 1, 10]], note: 'Lo scopo è recuperare, non allenare: niente virate rapide né farfalla.' },
      { kind: 'piscina', id: 's2', name: 'Recupero attivo 1.000 m', tag: 'Recupero', m: 1000, min: 25, rpe: '3', blocks: [['Stile facile', 'respiro ogni 3', '400 m', 2, 10], ['Dorso', 'scioltezza spalle', '300 m', 1, 8], ['Rana lenta', 'ampiezza, non velocità', '300 m', 1, 7]], note: 'Se una spalla dà fastidio, sostituisci lo stile con dorso e gambe.' },
      { kind: 'piscina', id: 's3', name: 'Mobilità in acqua 30 min', tag: 'Mobilità', m: 600, min: 30, rpe: '2', blocks: [['Camminata in acqua', 'corsia bassa', '5 min', 1, 5], ['Mobilità anche e spalle', 'a bordo vasca', '15 min', 1, 15], ['Nuoto libero', 'qualsiasi stile, lento', '10 min', 1, 10]], note: 'Per i giorni con indolenzimento alto: zero carico, solo movimento.' }
    ];
    var out = {}; all.forEach(function (s) { out[s.id] = s; });
    return { sessions: out, order: all.slice(0, Math.max(1, Math.min(3, n))).map(function (s) { return s.id; }) };
  }

  // ---------- gym program ----------
  var TEMPLATES = {
    fullA: ['Full body A', 'Gambe, spinta orizzontale, tirata verticale', ['squat', 'oriz-spinta', 'vert-tirata', 'hinge', 'alzate-lat', 'tricipiti', 'addome']],
    fullB: ['Full body B', 'Stacco, spinta verticale, tirata orizzontale', ['hinge', 'vert-spinta', 'oriz-tirata', 'affondo', 'incl-spinta', 'bicipiti', 'polpacci']],
    fullC: ['Full body C', 'Gambe, petto alto, dorso', ['squat', 'incl-spinta', 'oriz-tirata', 'femorali', 'deltoide-post', 'bicipiti', 'addome']],
    upperA: ['Upper A', 'Petto, dorso, spalle, braccia', ['oriz-spinta', 'oriz-tirata', 'vert-spinta', 'vert-tirata', 'incl-spinta', 'bicipiti', 'tricipiti']],
    upperB: ['Upper B', 'Petto alto, dorso, deltoidi, braccia', ['incl-spinta', 'vert-tirata', 'oriz-tirata', 'alzate-lat', 'croci', 'tricipiti', 'bicipiti']],
    lowerA: ['Lower A', 'Quadricipiti, femorali, polpacci', ['squat', 'hinge', 'affondo', 'femorali', 'polpacci', 'addome']],
    lowerB: ['Lower B', 'Femorali, glutei, quadricipiti', ['hinge', 'squat', 'femorali', 'glutei', 'quad-iso', 'polpacci']],
    push: ['Push', 'Petto, spalle, tricipiti', ['oriz-spinta', 'vert-spinta', 'incl-spinta', 'alzate-lat', 'croci', 'tricipiti']],
    pull: ['Pull', 'Dorso, deltoidi posteriori, bicipiti', ['vert-tirata', 'oriz-tirata', 'deltoide-post', 'bicipiti', 'oriz-tirata', 'addome']],
    legs: ['Legs', 'Quadricipiti, femorali, glutei, polpacci', ['squat', 'hinge', 'affondo', 'femorali', 'quad-iso', 'polpacci']]
  };
  var SPLITS = {
    1: ['Full body · 1 giorno', ['fullA']],
    2: ['Full body · 2 giorni', ['fullA', 'fullB']],
    3: ['Full body · 3 giorni', ['fullA', 'fullB', 'fullC']],
    4: ['Upper / Lower · 4 giorni', ['upperA', 'lowerA', 'upperB', 'lowerB']],
    5: ['Upper / Lower + PPL · 5 giorni', ['upperA', 'lowerA', 'push', 'pull', 'legs']],
    6: ['Push / Pull / Legs · 6 giorni', ['push', 'pull', 'legs', 'push', 'pull', 'legs']]
  };
  var DEFAULT_DAYS = { 1: [2], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

  function prescription(p, e, slotIndex) {
    var goal = p.goal, exp = p.experience;
    var heavy = e.comp && slotIndex < 2;
    var reps;
    if (goal === 'forza') reps = heavy ? [4, 6] : e.comp ? [6, 8] : [8, 12];
    else if (goal === 'resistenza' || goal === 'salute') reps = e.comp ? [8, 12] : [12, 15];
    else if (goal === 'definizione') reps = e.comp ? [8, 10] : [10, 15];
    else reps = heavy ? [6, 8] : e.comp ? [8, 10] : [10, 12]; // massa, ricomposizione
    if (e.id === 'plank' || e.id === 'wallsit') reps = [30, 45];
    var sets = exp === 'principiante' ? (e.comp ? 3 : 2) : exp === 'avanzato' ? (e.comp ? 4 : 3) : 3;
    var rest = heavy ? (goal === 'forza' ? 180 : 150) : e.comp ? 120 : 75;
    var rpeOffset = e.comp ? 0 : 0.5; // isolation can go a little closer to failure
    return { id: e.id, sets: sets, lo: reps[0], hi: reps[1], reps: reps[0] + '–' + reps[1], rest: rest, rpeOffset: rpeOffset };
  }

  // The variant-th allowed exercise for a pattern, staying in the same class (compound or not)
  // as the first choice, so a "B" day never swaps a deadlift for a glute bridge.
  function pickExercise(pattern, p, used, variant) {
    var pool = GT.CATALOG.filter(function (e) { return e.pat === pattern && used.indexOf(e.id) < 0 && GT.exAllowed(e, p); });
    if (!pool.length) return null;
    var same = pool.filter(function (e) { return e.comp === pool[0].comp; });
    return same[variant % same.length];
  }
  var exMinutes = function (x) { return x.sets * (45 + x.rest) / 60; };

  function buildDays(p) {
    var n = Math.max(0, Math.min(6, Number(p.gymDays) || 0));
    if (!n) return { split: null, days: [] };
    var split = SPLITS[n];
    var budget = (Number(p.sessionMin) || 60) - 5; // 5 min warm-up
    var seen = {}; // template key -> times used, to vary repeated days (PPL ×2)
    var days = split[1].map(function (key, i) {
      var t = TEMPLATES[key], variant = seen[key] || 0;
      seen[key] = variant + 1;
      var used = [], ex = [], minutes = 0;
      // B days and repeated days use the next option of each pattern when there is one
      var v = variant + (/B$/.test(t[0]) ? 1 : 0);
      t[2].forEach(function (pat, si) {
        var e = pickExercise(pat, p, used, v);
        if (!e) return;
        var x = prescription(p, e, si);
        // Fill the session up to the time available (at least 4 exercises)
        if (ex.length >= 4 && minutes + exMinutes(x) > budget) return;
        used.push(e.id);
        ex.push(x);
        minutes += exMinutes(x);
      });
      var name = t[0] + (variant ? ' 2' : '');
      return { id: 'd' + (i + 1), key: key, name: name, focus: t[1], ex: ex };
    });
    return { split: split[0], days: days };
  }

  function buildWeek(p, days, run, swim) {
    var week = [0, 1, 2, 3, 4, 5, 6].map(function (wd) { return { wd: wd, items: [] }; });
    var gymDays = days.length;
    var chosen = (p.days || []).filter(function (d) { return d >= 0 && d <= 6; }).sort();
    if (chosen.length !== gymDays) chosen = DEFAULT_DAYS[gymDays] || [];
    chosen.forEach(function (wd, i) { if (days[i]) week[wd].items.push({ type: 'gym', id: days[i].id }); });
    var free = function () { return week.filter(function (d) { return !d.items.length; }).map(function (d) { return d.wd; }); };
    var isLegs = function (wd) { return week[wd].items.some(function (it) { if (it.type !== 'gym') return false; var d = days.filter(function (x) { return x.id === it.id; })[0]; return d && /lower|legs|full/.test(d.key); }); };
    if (run) {
      var order = run.order.slice();
      // Long run first: Sunday if free, otherwise Saturday, otherwise the last free day
      var place = function (id, prefs) {
        var f = free(), wd = prefs.filter(function (x) { return f.indexOf(x) >= 0; })[0];
        if (wd == null) wd = f.length ? f[f.length - 1] : prefs[0];
        week[wd].items.push({ type: 'run', id: id });
      };
      if (order.indexOf('l') >= 0) place('l', [6, 5, 3]);
      if (order.indexOf('q') >= 0) {
        // Quality on a free mid-week day that is not right after a legs day
        var f = free().filter(function (wd) { return wd >= 1 && wd <= 4 && !isLegs((wd + 6) % 7); });
        place('q', f.length ? f : [2, 3, 1]);
      }
      order.filter(function (id) { return id[0] === 'e'; }).forEach(function (id) { place(id, [1, 3, 4, 0, 2, 5]); });
    }
    if (swim) {
      swim.order.forEach(function (id, i) {
        var f = free(), pref = [0, 4, 2, 5, 3, 1, 6];
        var wd = pref.filter(function (x) { return f.indexOf(x) >= 0; })[0];
        if (wd == null) wd = pref[i % pref.length];
        week[wd].items.push({ type: 'swim', id: id });
      });
    }
    return week;
  }

  // Build the whole plan from a profile. startISO: the day the plan starts (default today).
  GT.generatePlan = function (p, startISO) {
    var start = GT.mondayOf(startISO || GT.todayISO());
    var g = buildDays(p);
    var runCount = p.runs ? Math.max(1, Math.min(5, Number(p.run && p.run.perWeek) || ((Number(p.run && p.run.kmWeek) || 0) <= 15 ? 2 : (Number(p.run && p.run.kmWeek) || 0) <= 30 ? 3 : 4))) : 0;
    var p10 = GT.p10From(p.run);
    var run = p.runs ? runSessions(p, p10, runCount) : null;
    var swim = p.swims ? swimSessions((p.swim && p.swim.perWeek) || 1) : null;
    var beginner = p.experience === 'principiante';
    return {
      version: 1,
      createdAt: new Date().toISOString(),
      startDate: start,
      cycleWeeks: 5,
      rpeWeeks: beginner ? [7, 7, 7.5, 8, 6] : [7, 7.5, 8, 8.5, 6],
      deloadIndex: 4,
      split: g.split,
      days: g.days,
      week: buildWeek(p, g.days, run, swim),
      run: run ? { p10: p10, zones: GT.paceZones(p10), sessions: run.sessions, order: run.order, library: run.library, weeklyKm: run.weeklyKm } : null,
      swim: swim
    };
  };

  // Which week of the mesocycle a date falls in: { index 0-4, num 1-5, cycle 1…, deload }
  GT.cycleWeek = function (plan, dateISO) {
    if (!plan) return { index: 0, num: 1, cycle: 1, deload: false };
    var w = Math.max(0, Math.floor(GT.daysBetween(plan.startDate, GT.mondayOf(dateISO || GT.todayISO())) / 7));
    var idx = w % plan.cycleWeeks;
    return { index: idx, num: idx + 1, cycle: Math.floor(w / plan.cycleWeeks) + 1, deload: GT.isDeloadWeek(plan, idx) };
  };
  // Is week index i (0-based) a deload? Imported plans mark each week; generated ones have one deloadIndex.
  GT.isDeloadWeek = function (plan, i) {
    if (!plan) return false;
    return plan.weeksSpec ? !!(plan.weeksSpec[i] || {}).deload : i === plan.deloadIndex;
  };
  // Index of the next deload week from index i (i itself included), or -1
  GT.nextDeload = function (plan, i) {
    if (!plan) return -1;
    for (var k = i; k < plan.cycleWeeks; k++) if (GT.isDeloadWeek(plan, k)) return k;
    return -1;
  };
  // "50% di serie in meno, RIR 3–4" for a deload week, from the plan's own numbers
  GT.deloadText = function (plan, i) {
    var spec = plan && plan.weeksSpec && plan.weeksSpec[i];
    var eff = function (rpe) { return GT.effLabel ? GT.effLabel(rpe) : 'RPE ' + GT.fmt(rpe); };
    if (!spec) return 'stessi esercizi, circa 40% di serie in meno, ' + eff(6) + '.';
    var less = Math.round((1 - (spec.setsMult || 1)) * 100), r = spec.rirComp;
    var effTxt = r && GT.state && GT.state.effort === 'RIR' ? 'RIR ' + (r[0] === r[1] ? GT.fmt(r[0]) : GT.fmt(r[0]) + '–' + GT.fmt(r[1]))
      : r ? 'RPE ' + (r[0] === r[1] ? GT.fmt(10 - r[0]) : GT.fmt(10 - r[1]) + '–' + GT.fmt(10 - r[0])) : eff(spec.rpeComp);
    return 'stessi esercizi, ' + (less > 0 ? less + '% di serie in meno, ' : '') + effTxt + '.';
  };
  // Target RPE and sets for a planned exercise on a date.
  // Generated plans: rpeWeeks + rpeOffset, deload = RPE 6 and ~60% of the sets.
  // Imported plans may carry weeksSpec [{ rpeComp, rpeIso, setsMult }] per week (RPE = 10 − RIR)
  // and per-exercise minRir (never closer to failure than that).
  GT.targetFor = function (plan, ex, dateISO) {
    var cw = GT.cycleWeek(plan, dateISO), rpe, sets;
    var spec = plan.weeksSpec && plan.weeksSpec[cw.index];
    if (spec) {
      var comp = ex.comp != null ? ex.comp : !!(GT.EXI[ex.id] && GT.EXI[ex.id].comp);
      rpe = comp ? spec.rpeComp : spec.rpeIso;
      sets = Math.max(1, Math.round(ex.sets * (spec.setsMult || 1)));
    } else {
      rpe = Math.min(9.5, plan.rpeWeeks[cw.index] + (cw.deload ? 0 : ex.rpeOffset || 0));
      sets = cw.deload ? Math.max(1, Math.round(ex.sets * 0.6)) : ex.sets;
    }
    if (ex.minRir != null) rpe = Math.min(rpe, 10 - ex.minRir);
    return { rpe: rpe, sets: sets, deload: cw.deload };
  };
  GT.findDay = function (plan, id) { return plan ? plan.days.filter(function (d) { return d.id === id; })[0] || null : null; };
  GT.findCardio = function (plan, id) {
    if (!plan) return null;
    return (plan.run && (plan.run.sessions[id] || plan.run.library[id])) || (plan.swim && plan.swim.sessions[id]) || null;
  };
  // Estimated session length in minutes: sets × (~45 s work + rest)
  GT.dayMinutes = function (day) { return Math.round(day.ex.reduce(function (a, e) { return a + e.sets * (45 + e.rest); }, 0) / 60) + 5; };
})();
