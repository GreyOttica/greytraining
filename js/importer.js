/* GreyTraining — import a training program made elsewhere (e.g. with an AI chat) as JSON.

   GT.parseProgramText(text)        -> object (throws Error with an Italian message)
   GT.importProgram(json, st)       -> { plan, report }   (nothing is applied; see GT.act.applyImportedPlan)

   Supported format (schemaVersion 1):
   { program { id, name, goal, durationWeeks, notes },
     progression { type 'double_progression', loadIncreasePercent { min, max }, rule },
     weeks [{ week, type, rir { compound [a,b], isolation [a,b] }, setsMultiplier?, notes? }],
     weeklySchedule [{ day 'lunedi'…, type 'gym'|'run'|'rest'|'active_recovery'|'swim', sessionId?, runId?, activity? }],
     sessions [{ id, name, notes?, exercises [{ order, name, category 'compound'|'isolation', muscles [],
                 sets, repMin, repMax, restSec, minRir?, notes?, supersetGroup? }], optionalExercises? }],
     runs [{ id, name, description }], rules [] }

   Every exercise keeps the name from the file. It is matched to the library (by name and
   synonyms) to borrow muscles, pattern, technique cues and alternatives; when nothing matches,
   a new exercise is created from the file's category and muscles. */
(function () {
  'use strict';
  var GT = window.GT;

  var norm = function (s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  };
  var slug = function (s) { return norm(s).replace(/ /g, '-').slice(0, 40) || 'ex'; };

  // Synonyms (Italian and English) -> library id. Checked as whole words on the normalized name.
  var ALIASES = [
    [/\b(panca piana|bench press|distensioni su panca)\b.*\b(manubri|dumbbell)/, 'dbbench'],
    [/\b(panca piana|bench press|flat bench)\b/, 'bench'],
    [/\b(panca inclinata|incline)\b.*\b(bilanciere|barbell)\b/, 'inclbb'],
    [/\b(panca inclinata|spinte inclinata|incline)\b/, 'incl'],
    [/\b(chest press)\b.*\b(inclinat|incline)/, 'inclmach'],
    [/\b(chest press)\b/, 'chestpress'],
    [/\b(piegamenti|push ?up|flessioni)\b.*\b(strett|diamond)/, 'diamond'],
    [/\b(piegamenti|push ?up|flessioni)\b/, 'pushup'],
    [/\b(croci|fly|flyes|pec deck|butterfly)\b.*\b(cavi|cable)/, 'cross'],
    [/\b(pec deck|butterfly)\b/, 'pecdeck'],
    [/\b(croci|fly)\b.*\b(manubri|dumbbell)/, 'dbfly'],
    [/\b(reverse fly|alzate posteriori|rear delt)\b/, 'revfly'],
    [/\b(face pull)\b/, 'facepull'],
    [/\b(rematore|row)\b.*\b(manubri|manubrio|dumbbell)/, 'dbrow'],
    [/\b(rematore|row|t bar)\b.*\b(macchin|machine)/, 'machrow'],
    [/\b(pulley|seated row|cable row|rematore ai cavi)\b/, 'cablerow'],
    [/\b(rematore inverso|inverted row)\b/, 'invrow'],
    [/\b(rematore|barbell row|bent over row|t bar)\b/, 'row'],
    [/\b(trazioni assistite|assisted pull)\b/, 'assistpull'],
    [/\b(trazioni|pull ?up|chin ?up)\b/, 'pull'],
    [/\b(lat machine|lat pulldown|pulldown)\b/, 'latm'],
    [/\b(military|overhead press|ohp|lento avanti|shoulder press|lento)\b.*\b(manubri|dumbbell)/, 'dbohp'],
    [/\b(shoulder press)\b.*\b(macchin|machine)/, 'machohp'],
    [/\b(military|overhead press|ohp|lento avanti)\b/, 'ohp'],
    [/\b(alzate laterali|lateral raise)\b.*\b(cavi|cable)/, 'lr'],
    [/\b(alzate laterali|lateral raise)\b/, 'lat'],
    [/\b(hack squat)\b/, 'hack'],
    [/\b(goblet)\b/, 'goblet'],
    [/\b(leg press|pressa)\b/, 'legpress'],
    [/\b(squat)\b.*\b(corpo libero|bodyweight|air)\b/, 'bwsquat'],
    [/\b(squat)\b/, 'squat'],
    [/\b(stacco rumeno|romanian|rdl)\b.*\b(manubri|dumbbell)/, 'dbrdl'],
    [/\b(stacco rumeno|romanian|rdl)\b.*\b(monopodalic|single leg)/, 'slrdl'],
    [/\b(stacco rumeno|romanian|rdl)\b/, 'rdl'],
    [/\b(stacco|deadlift)\b/, 'deadlift'],
    [/\b(hip thrust)\b/, 'hipthrust'],
    [/\b(ponte glutei|glute bridge)\b/, 'bridge'],
    [/\b(kettlebell swing|swing)\b/, 'kbswing'],
    [/\b(bulgar|split squat)\b/, 'bulgarian'],
    [/\b(affondi|lunge)\b.*\b(camminata|walking)/, 'walklunge'],
    [/\b(step ?up)\b/, 'stepup'],
    [/\b(affondi|lunge)\b/, 'bwlunge'],
    [/\b(nordic)\b/, 'nordic'],
    [/\b(leg curl|hamstring curl)\b/, 'legcurl'],
    [/\b(leg extension)\b/, 'legext'],
    [/\b(abduzion|abductor)\b/, 'abd'],
    [/\b(calf|polpacci)\b.*\b(manubri|dumbbell)/, 'dbcalf'],
    [/\b(calf|polpacci)\b/, 'calf'],
    [/\b(curl)\b.*\b(martello|hammer)/, 'hammer'],
    [/\b(curl)\b.*\b(cavi|cable)/, 'cablecurl'],
    [/\b(curl)\b.*\b(bilanciere|barbell|ez)\b/, 'bbcurl'],
    [/\b(curl)\b/, 'curl'],
    [/\b(push ?down|pushdown|spinte in basso)\b/, 'pd'],
    [/\b(french press|skull ?crusher)\b/, 'french'],
    [/\b(estensioni|overhead extension)\b.*\b(cavi|cable|testa)/, 'ohext'],
    [/\b(kickback)\b/, 'kickback'],
    [/\b(crunch)\b.*\b(cavi|cable)/, 'cablecrunch'],
    [/\b(leg raise|sollevamento gambe)\b/, 'hangleg'],
    [/\b(pallof)\b/, 'pallof'],
    [/\b(dead bug)\b/, 'deadbug'],
    [/\b(plank)\b/, 'plank']
  ];

  // Muscle words in the file -> muscle group keys used for weekly volume
  var MUSCLE_WORDS = [
    [/petto|pettoral|chest/, 'petto'], [/dorso|schiena|lat|dorsal|back/, 'dorso'], [/spall|deltoid|shoulder/, 'spalle'],
    [/quadricip|quad/, 'quadricipiti'], [/femoral|hamstring|ischio/, 'femorali'], [/glute/, 'glutei'],
    [/bicip/, 'bicipiti'], [/tricip/, 'tricipiti'], [/polpacc|calf|calves/, 'polpacci'], [/addom|core|abs/, 'addome']
  ];
  function muscleKeys(list) {
    var out = [];
    (list || []).forEach(function (m) {
      var t = norm(m);
      MUSCLE_WORDS.forEach(function (w) { if (w[0].test(t) && out.indexOf(w[1]) < 0) out.push(w[1]); });
    });
    return out;
  }

  // "Rematore bilanciere o T-bar" -> options ["rematore bilanciere", "t bar"]; parentheses are alternatives too
  function options(name) {
    var n = String(name || '');
    var paren = (n.match(/\(([^)]*)\)/g) || []).map(function (p) { return p.replace(/[()]/g, '').replace(/^o\s+/i, ''); });
    var base = n.replace(/\([^)]*\)/g, ' ');
    var parts = base.split(/\s+o\s+|\s*\/\s*|\s+oppure\s+|\s+or\s+/i).concat(paren).map(norm).filter(Boolean);
    // An option like "croci ai cavi" inherits nothing; but "Curl manubri inclinato" stays one option
    return parts.length ? parts : [norm(n)];
  }

  // Best library id for one normalized option, with a confidence ('alta' | 'media')
  function matchOption(opt) {
    var exact = GT.CATALOG.filter(function (e) { return norm(e.n) === opt; })[0];
    if (exact) return { id: exact.id, conf: 'alta' };
    for (var i = 0; i < ALIASES.length; i++) if (ALIASES[i][0].test(opt)) return { id: ALIASES[i][1], conf: 'alta' };
    // Word overlap with library names (≥ 2 shared meaningful words)
    var words = opt.split(' ').filter(function (w) { return w.length > 2; });
    var best = null, bestScore = 0;
    GT.CATALOG.forEach(function (e) {
      var ew = norm(e.n).split(' ');
      var score = words.filter(function (w) { return ew.indexOf(w) >= 0; }).length;
      if (score > bestScore) { bestScore = score; best = e; }
    });
    return best && bestScore >= 2 ? { id: best.id, conf: 'media' } : null;
  }

  function matchExercise(ex) {
    var opts = options(ex.name);
    for (var i = 0; i < opts.length; i++) {
      var m = matchOption(opts[i]);
      if (m && GT.EXI[m.id]) return Object.assign(m, { alternatives: opts.slice(1) });
    }
    return null;
  }

  var DAY_INDEX = { lunedi: 0, martedi: 1, mercoledi: 2, giovedi: 3, venerdi: 4, sabato: 5, domenica: 6,
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
    lun: 0, mar: 1, mer: 2, gio: 3, ven: 4, sab: 5, dom: 6 };
  var dayOf = function (s) { var k = norm(s); return DAY_INDEX[k] != null ? DAY_INDEX[k] : DAY_INDEX[k.slice(0, 3)]; };

  var rpeFromRir = function (r, fallback) {
    if (Array.isArray(r) && r.length) return Math.round((10 - (Number(r[0]) + Number(r[r.length - 1])) / 2) * 2) / 2;
    if (typeof r === 'number') return 10 - r;
    return fallback;
  };

  GT.parseProgramText = function (text) {
    var t = String(text || '').trim();
    if (!t) throw new Error('Il file è vuoto.');
    // Accept JSON wrapped in a ```json … ``` block, as AI chats often answer
    var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    var start = t.indexOf('{'), end = t.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('Non trovo un oggetto JSON nel testo.');
    try { return JSON.parse(t.slice(start, end + 1)); }
    catch (e) { throw new Error('Il JSON non è valido: ' + e.message); }
  };

  GT.importProgram = function (json, st) {
    if (!json || typeof json !== 'object' || !Array.isArray(json.sessions) || !json.sessions.length) {
      throw new Error('Formato non riconosciuto: mi aspetto un JSON con "sessions" (le sedute) e "weeklySchedule".');
    }
    var report = { matched: [], created: [], warnings: [] };
    var program = json.program || {}, custom = {}, today = GT.todayISO();

    // ---------- weeks ----------
    var weeks = Array.isArray(json.weeks) && json.weeks.length ? json.weeks : null;
    var weeksSpec = weeks ? weeks.map(function (w) {
      var rir = w.rir || {}, comp = rpeFromRir(rir.compound, 8), iso = rpeFromRir(rir.isolation, comp);
      var type = String(w.type || 'accumulo');
      var range = function (r) { return Array.isArray(r) && r.length ? r.map(Number).filter(function (n) { return isFinite(n); }) : null; };
      return { type: type, rpeComp: comp, rpeIso: iso, rirComp: range(rir.compound), rirIso: range(rir.isolation) || range(rir.compound), setsMult: Number(w.setsMultiplier) || 1, note: w.notes || '', deload: /scaric|deload/i.test(type) };
    }) : [{ type: 'accumulo', rpeComp: 7.5, rpeIso: 8, setsMult: 1, note: '' }, { type: 'accumulo', rpeComp: 8, rpeIso: 8.5, setsMult: 1 }, { type: 'intensificazione', rpeComp: 8.5, rpeIso: 9, setsMult: 1 }, { type: 'scarico', rpeComp: 6, rpeIso: 6, setsMult: 0.6, deload: true }];
    if (!weeks) report.warnings.push('Nel file non ci sono le settimane: uso un ciclo di 4 settimane con l\'ultima di scarico.');
    var deloadIndex = weeksSpec.map(function (w) { return !!w.deload; }).lastIndexOf(true);
    if (deloadIndex < 0) deloadIndex = weeksSpec.length; // no deload week in the file

    // ---------- sessions -> days ----------
    var days = json.sessions.map(function (s, si) {
      var dayId = 'i' + (si + 1);
      var exs = (s.exercises || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).map(function (ex) {
        var m = matchExercise(ex), base = m ? GT.EXI[m.id] : null;
        var comp = ex.category ? /compound|multi/i.test(ex.category) : base ? base.comp : false;
        var mk = muscleKeys(ex.muscles);
        var id = 'imp-' + slug(ex.name);
        var mg = {};
        if (base) mg = Object.assign({}, base.mg);
        else if (mk.length) { mk.forEach(function (k, i) { mg[k] = i === 0 ? 1 : 0.5; }); }
        var entry = {
          id: id, n: String(ex.name || 'Esercizio').trim(), m: base ? base.m : (mk[0] || 'addome'), mg: mg,
          req: base ? base.req.slice() : [], pat: base ? base.pat : (mk[0] || 'altro'), comp: comp, lvl: 1, avoid: base ? base.avoid.slice() : [],
          cues: base ? base.cues.slice() : ['Movimento controllato, 2–3 secondi in discesa.', 'Nessuno slancio.', 'Fermati quando la tecnica cambia.'],
          base: base ? base.id : null, custom: true
        };
        custom[id] = entry;
        if (base) report.matched.push({ from: entry.n, to: base.n, conf: m.conf, alternatives: m.alternatives });
        else report.created.push({ name: entry.n, muscles: mk.map(function (k) { return GT.MUSCLE_NAME[k]; }) });
        var lo = Number(ex.repMin) || Number(ex.reps) || 8, hi = Number(ex.repMax) || lo;
        var note = [ex.notes, ex.supersetGroup ? 'Superset ' + ex.supersetGroup : ''].filter(Boolean).join(' · ');
        return { id: id, sets: Math.max(1, Number(ex.sets) || 3), lo: lo, hi: hi, reps: lo === hi ? String(lo) : lo + '–' + hi,
          rest: Math.max(30, Number(ex.restSec) || (comp ? 120 : 75)), rpeOffset: 0, comp: comp,
          minRir: ex.minRir != null ? Number(ex.minRir) : null, note: note || null, superset: ex.supersetGroup || null };
      });
      var opt = (s.optionalExercises || []).map(function (o) { return o.name + ' ' + (o.sets || 3) + '×' + (o.repMin || '') + (o.repMax ? '–' + o.repMax : '') + (o.notes ? ' (' + o.notes + ')' : ''); });
      if (opt.length) report.warnings.push(s.name + ': esercizi facoltativi lasciati come nota (' + opt.join('; ') + ').');
      var muscles = [];
      exs.forEach(function (x) { var e = custom[x.id]; if (e && muscles.indexOf(e.m) < 0) muscles.push(e.m); });
      return { id: dayId, srcId: s.id, key: 'import', name: String(s.name || ('Seduta ' + (si + 1))).trim(),
        focus: muscles.slice(0, 4).map(function (k) { return GT.MUSCLE_NAME[k] || k; }).join(', '),
        notes: [s.notes].concat(opt.length ? ['Facoltativi: ' + opt.join('; ')] : []).filter(Boolean), ex: exs };
    });
    var daySrc = {}; days.forEach(function (d) { daySrc[d.srcId] = d.id; });

    // ---------- running: same paces as the user's zones, sessions named as in the file ----------
    var schedule = Array.isArray(json.weeklySchedule) ? json.weeklySchedule : [];
    var runIds = schedule.filter(function (x) { return /run|corsa/i.test(x.type || ''); }).map(function (x) { return x.runId || x.sessionId || 'run'; });
    var runDefs = {}; (json.runs || []).forEach(function (r) { runDefs[r.id] = r; });
    var p = st.profile || {}, run = null;
    if (runIds.length) {
      var rp = Object.assign({}, p, { runs: true, gymDays: 0, swims: false,
        run: Object.assign({ kmWeek: 20, perWeek: runIds.length, testDist: 0, testTime: '' }, p.run || {}, { perWeek: Math.max(runIds.length, 2) }) });
      var gen = GT.generatePlan(rp, today).run;
      var sessions = {}, order = [];
      runIds.forEach(function (rid, i) {
        if (sessions[rid]) return;
        var def = runDefs[rid] || {}, label = norm((def.name || '') + ' ' + rid + ' ' + (def.description || ''));
        var pick = /lung|long/.test(label) ? gen.sessions.l : /qualit|ripet|interval|tempo|soglia|fartlek/.test(label) ? (gen.sessions.q || gen.library.soglia) : (gen.sessions.e1 || gen.library.facile);
        var c = JSON.parse(JSON.stringify(pick));
        c.id = rid; c.name = def.name || c.name; c.tag = c.tag;
        c.note = [def.description, c.note].filter(Boolean).join('. ');
        sessions[rid] = c; order.push(rid);
      });
      run = { p10: GT.p10From(rp.run), zones: GT.paceZones(GT.p10From(rp.run)), sessions: sessions, order: order, library: gen.library,
        weeklyKm: order.reduce(function (a, id) { return a + (sessions[id].km || 0); }, 0) };
      if (!p.runs || !(p.run && p.run.testTime)) report.warnings.push('Corse: distanze e ritmi stimati dalle zone del tuo profilo' + (p.run && p.run.testTime ? '' : ' (nessun tempo di riferimento: inseriscilo nel questionario per ritmi più precisi)') + '.');
    }

    // ---------- swimming / active recovery ----------
    var swimS = {}, swimOrder = [];
    schedule.forEach(function (x, i) {
      var t = norm(x.type), act = String(x.activity || '');
      if (!(/swim|nuoto|piscina/.test(t) || (/recovery|recupero/.test(t) && /nuot|swim|piscin/i.test(act)))) return;
      var id = 'r' + (i + 1), name = act ? act.charAt(0).toUpperCase() + act.slice(1) : 'Nuoto leggero';
      swimS[id] = { kind: 'piscina', id: id, name: name, tag: 'Recupero attivo', m: 1000, min: 30, rpe: '2–3',
        blocks: [['Nuoto leggero', 'stile e dorso, molto facile', '20 min', 1, 20]].concat(/sauna/i.test(act) ? [['Sauna', 'facoltativa · bevi prima e dopo', '10–15 min', 1, 12]] : []),
        note: 'Recupero attivo: niente intensità, solo movimento.' };
      swimOrder.push(id);
    });

    // ---------- calendar ----------
    var week = [0, 1, 2, 3, 4, 5, 6].map(function (wd) { return { wd: wd, items: [] }; });
    schedule.forEach(function (x, i) {
      var wd = dayOf(x.day);
      if (wd == null) { report.warnings.push('Giorno non riconosciuto: "' + x.day + '".'); return; }
      var t = norm(x.type);
      if (/gym|palestra|pesi|weights/.test(t)) {
        var id = daySrc[x.sessionId];
        if (id) week[wd].items.push({ type: 'gym', id: id });
        else report.warnings.push(GT.DAYS_LONG[wd] + ': seduta "' + x.sessionId + '" non trovata nel file.');
      } else if (/run|corsa/.test(t)) {
        week[wd].items.push({ type: 'run', id: x.runId || x.sessionId || 'run' });
      } else if (swimS['r' + (i + 1)]) {
        week[wd].items.push({ type: 'swim', id: 'r' + (i + 1) });
      } else if (/recovery|recupero/.test(t) && x.activity) {
        report.warnings.push(GT.DAYS_LONG[wd] + ': "' + x.activity + '" resta come nota (non è un\'attività che l\'app registra).');
      }
    });
    var unscheduled = days.filter(function (d) { return !week.some(function (w) { return w.items.some(function (it) { return it.id === d.id; }); }); });
    if (unscheduled.length) report.warnings.push('Sedute non in calendario: ' + unscheduled.map(function (d) { return d.name; }).join(', ') + '. Puoi avviarle da Allena → Scheda.');

    // ---------- progression and notes ----------
    var pr = json.progression || {}, li = pr.loadIncreasePercent || {};
    var progression = /double|doppia/i.test(pr.type || '') ? { type: 'double', sessions: 1, pct: [Number(li.min) || 2.5, Number(li.max) || 5], rule: pr.rule || 'Doppia progressione' } : null;
    var notes = [program.notes].concat(json.rules || []).filter(Boolean);

    var plan = {
      version: 1, source: { type: 'import', id: program.id || null, name: program.name || null, goal: program.goal || null, importedAt: new Date().toISOString() },
      createdAt: new Date().toISOString(), startDate: GT.mondayOf(today),
      cycleWeeks: weeksSpec.length, weeksSpec: weeksSpec, rpeWeeks: weeksSpec.map(function (w) { return w.rpeComp; }), deloadIndex: deloadIndex,
      split: String(program.name || 'Scheda importata'), days: days, week: week,
      run: run, swim: swimOrder.length ? { sessions: swimS, order: swimOrder } : null,
      progression: progression, notes: notes, custom: custom
    };
    if (program.durationWeeks && Number(program.durationWeeks) !== weeksSpec.length) report.warnings.push('Il programma dice ' + program.durationWeeks + ' settimane ma ne descrive ' + weeksSpec.length + ': uso ' + weeksSpec.length + '.');
    return { plan: plan, report: report };
  };
})();
