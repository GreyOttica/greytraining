/* GreyTraining — import a training program made elsewhere (e.g. with an AI chat) as JSON.

   GT.parseProgramText(text)        -> object (throws Error with an Italian message)
   GT.importProgram(json, st)       -> { plan, report }   (nothing is applied; see GT.act.applyImportedPlan)
   GT.importStartOptions(plan, st)  -> [{ k, label, date }] when week 1 can start, plus the default k

   Supported format (schemaVersion 1):
   { program { id, name, goal, durationWeeks, notes },
     progression { type 'double_progression', loadIncreasePercent { min, max }, rule },
     weeks [{ week, type, rir { compound [a,b], isolation [a,b] }, setsMultiplier?, notes? }],
     weeklySchedule [{ day 'lunedi'…, type 'gym'|'run'|'rest'|'active_recovery'|'swim', sessionId?, runId?, activity? }],
     sessions [{ id, name, notes?, exercises [{ order, name, category 'compound'|'isolation', muscles [],
                 sets, repMin, repMax, restSec, minRir?, notes?, supersetGroup? }], optionalExercises? }],
     runs [{ id, name, description, distanceKm? }], rules [] }

   Tolerated variations (AI answers differ): Italian or English keys and day names ("lunedì",
   "Monday", "mon", 1–7), reps as "8-10" / 8 / [8, 10], rest as 90 / "90s" / "1:30" / "2 min",
   RIR as [2, 3] / "2-3" / 2 / RPE fields, numbers as strings, schedule entries that name the
   session instead of its id, notes and rules as objects, JSON wrapped in prose or ``` fences.

   Every exercise keeps the name from the file. It is matched to the library (synonyms, then
   word overlap, checked against the file's muscles) to borrow muscles, pattern, technique cues
   and alternatives; when nothing fits, a new exercise is created from the file's muscles and
   the equipment named in it. */
(function () {
  'use strict';
  var GT = window.GT;

  // ---------- small parsers ----------
  var norm = function (s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  };
  var hash = function (s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  var slug = function (s) {
    var n = norm(s).replace(/ /g, '-') || 'ex';
    return n.length <= 48 ? n : n.slice(0, 40) + '-' + hash(n).slice(0, 6);
  };
  // Any value -> display text (objects and arrays included: never store raw objects as text)
  var txt = function (v) {
    if (v == null || v === false) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return v.map(txt).filter(Boolean).join(' · ');
    if (typeof v === 'object') return Object.keys(v).map(function (k) { return txt(v[k]); }).filter(Boolean).join(': ');
    return String(v);
  };
  // Any value -> array (objects become their values, "a, b" becomes ["a", "b"])
  var arr = function (v) {
    if (Array.isArray(v)) return v.filter(function (x) { return x != null; });
    if (v && typeof v === 'object') return Object.keys(v).map(function (k) { return v[k]; }).filter(function (x) { return x != null; });
    if (typeof v === 'string' && v.trim()) return v.split(/\s*[,;]\s*/).filter(Boolean);
    return [];
  };
  // "2,5" / "2.5" / 2.5 -> 2.5 ; anything else -> NaN
  var num = function (v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') { var m = v.replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; }
    return NaN;
  };
  var first = function () { for (var i = 0; i < arguments.length; i++) { if (arguments[i] != null && arguments[i] !== '') return arguments[i]; } return undefined; };
  // [2,3] / "2-3" / "2–3" / "2 a 3" / 2 / {min,max} -> [lo, hi] (numbers) or null
  var range = function (v) {
    if (v == null || v === '') return null;
    var out;
    if (Array.isArray(v)) out = v.map(num);
    else if (typeof v === 'number') out = [v, v];
    else if (typeof v === 'object') out = [num(first(v.min, v.from, v.lo)), num(first(v.max, v.to, v.hi, v.min))];
    else { var ms = String(v).replace(/,/g, '.').match(/\d+(\.\d+)?/g); out = ms ? ms.slice(0, 2).map(Number) : []; }
    out = out.filter(function (n) { return isFinite(n); });
    if (!out.length) return null;
    var lo = Math.min.apply(null, out), hi = Math.max.apply(null, out);
    return [lo, hi];
  };
  // Rest: 90 / "90" / "90s" / "1:30" / "2 min" / "2m" / "2'" / "2'30\"" -> seconds, or NaN.
  // A bare number of 10 or less is read as minutes (nobody rests 2 seconds between sets).
  // hint: true = the field is in minutes, 'sec' = the field is in seconds (no guessing)
  var seconds = function (v, hint) {
    var minutesHint = hint === true, secHint = hint === 'sec';
    if (typeof v === 'number') return minutesHint || (!secHint && v <= 10) ? Math.round(v * 60) : v;
    if (typeof v !== 'string' || !v.trim()) return NaN;
    var s = v.toLowerCase().replace(',', '.').trim();
    var mm = s.match(/(\d+)\s*:\s*(\d{1,2})/);
    if (mm) return Number(mm[1]) * 60 + Number(mm[2]);
    var ms = s.match(/(\d+(?:\.\d+)?)\s*(?:m|min\w*|'|′)(?![a-z])\s*(?:(\d{1,2})\s*(?:s|sec\w*|"|″)?)?/);
    if (ms) return Math.round(Number(ms[1]) * 60) + (Number(ms[2]) || 0);
    var n = num(s);
    if (!isFinite(n)) return NaN;
    if (minutesHint || (!secHint && n <= 10 && !/\d\s*(s|sec)/.test(s))) return Math.round(n * 60);
    return n;
  };
  // English plurals -> singular, word by word ("hammer curls" -> "hammer curl", "flies" -> "fly")
  var singular = function (s) {
    return s.split(' ').map(function (w) {
      if (w.length <= 3 || !/s$/.test(w) || /ss$/.test(w) || /^(press|abs|biceps|triceps|glutes|quads|lats|delts|calves|bulgaris?)$/.test(w)) return w;
      if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
      if (/(ches|shes|xes)$/.test(w)) return w.slice(0, -2);
      return w.slice(0, -1);
    }).join(' ');
  };

  // ---------- exercise matching ----------
  // Rule: regex on the normalized option -> library id. Specific rules come before generic ones.
  // An id of null means "known exercise that is not in the library": it is created, with the
  // muscles and equipment given here when the file does not say.
  var both = function (a, b) { return new RegExp('^(?=.*\\b(?:' + a + ')\\b)(?=.*\\b(?:' + b + ')\\b)'); };
  var DB = 'manubri|manubrio|dumbbell|dumbbells|db', BB = 'bilanciere|barbell|bb', CABLE = 'cavi|cavo|cable|cables|corda|rope', MACH = 'macchina|macchin\\w*|machine';
  // [regex, id] or, for exercises that are not in the library, [regex, null, mg, pattern, compound, req?]
  // (req omitted = from the equipment named in the exercise)
  var NOT_ISO = '(?!.*\\b(curl|croci|fly|flyes|flie|rematore|row|alzate|raise|kickback)\\b)';
  var ALIASES = [
    // not in the library: create them
    [/\b(upright row|tirate al mento|tirata al mento)\b/, null, { spalle: 1, dorso: 0.3 }, 'alzate-lat', false],
    [/\b(shrugs?|scrollate)\b/, null, { dorso: 1 }, 'oriz-tirata', false],
    [/\b(pullover)\b/, null, { dorso: 1, petto: 0.3 }, 'vert-tirata', false],
    [/\b(dips?|parallele)\b/, null, { tricipiti: 1, petto: 0.5, spalle: 0.3 }, 'tricipiti', true],
    [/\b(adduzion\w*|adductors?|adduttor\w*)\b/, null, { glutei: 0.5 }, 'glutei', false],
    [/\b(glute\w*|gluteo|glutei) kickbacks?\b|\bkickbacks? (ai cavi |al cavo |cable )?(glute\w*|gluteo|glutei)\b|\b(cable|cavi|cavo) kickbacks?\b(?!.*\b(tricip\w*|triceps?)\b)/, null, { glutei: 1 }, 'glutei', false],
    [/\b(wrist curls?|curl (dei |per )?polsi|curl inverso|reverse curls?|curl presa inversa)\b/, null, { bicipiti: 0.5 }, 'bicipiti', false],
    [/\b(pistol squat|pistol|sissy squat|sissy|cossack squat|cossack)\b/, null, { quadricipiti: 1, glutei: 0.5 }, 'affondo', true, []],
    [/\b(front squat|squat frontale|box squat|smith squat|squat al multipower|zercher squat|squat con fermo|pause squat)\b/, null, { quadricipiti: 1, glutei: 0.5, addome: 0.2 }, 'squat', true],
    [/\b(jump squats?|squat jump|squat con salto)\b/, 'bwsquat'],
    [/\bdeclin\w*\b.*\b(panca|bench|press|distensioni|spinte)\b|\b(panca|bench|press|distensioni|spinte)\b.*\bdeclin\w*\b/, null, { petto: 1, tricipiti: 0.5, spalle: 0.3 }, 'oriz-spinta', true],
    // hamstrings and other "curl" that are not biceps
    [/\b(nordic)\b/, 'nordic'],
    [/\bleg curl\b|\bhamstring curl\b|\bcurl (femoral\w*|gambe|hamstring\w*)\b|\bfemoral\w* (sdraiat\w*|sedut\w*|in piedi)\b/, 'legcurl'],
    // calves on the leg press are calf raises, not leg press
    [both('calf|calves|polpacci', 'leg press|pressa'), 'calf'],
    // incline push before flat (an "incline bench press" is not a flat bench)
    [both('chest press', 'inclinat\\w*|incline'), 'inclmach'],
    [new RegExp('^' + NOT_ISO + '(?=.*\\b(panca inclinata|inclinat\\w*|incline)\\b)(?=.*\\b(bilanciere|barbell|bb)\\b)'), 'inclbb'],
    [new RegExp('^' + NOT_ISO + '.*\\b(panca inclinata|spinte inclinata|spinte su panca inclinata|incline press|incline bench|incline dumbbell press|incline)\\b'), 'incl'],
    // horizontal push
    [both('panca piana|bench press|flat bench|distensioni su panca', DB), 'dbbench'],
    [/\b(panca piana|bench press|flat bench)\b/, 'bench'],
    [/\b(chest press)\b/, 'chestpress'],
    [both('piegamenti|push ?ups?|flessioni', 'strett\\w*|diamond|close grip'), 'diamond'],
    [/\b(piegamenti|push ?ups?|flessioni)\b/, 'pushup'],
    // rear delts before chest flyes ("reverse pec deck" is a rear-delt move)
    [/\b(reverse fly|reverse flyes|reverse pec deck|reverse butterfly|pec deck invers\w*|butterfly invers\w*|alzate posteriori|rear delts?|croci invers\w*|deltoidi posteriori)\b/, 'revfly'],
    [/\b(pec deck|butterfly)\b/, 'pecdeck'],
    [/^(?!.*\b(reverse|posterior\w*|invers\w*)\b)(?=.*\b(croci|fly|flyes|crossover)\b)(?=.*\b(cavi|cavo|cable|cables|crossover)\b)/, 'cross'],
    [/\b(croci|fly|flyes)\b/, 'dbfly'],
    [/\b(face pull)\b/, 'facepull'],
    // pulls
    [/\b(rematore inverso|inverted row|australian pull ?ups?)\b/, 'invrow'],
    [/\b(pulley|seated row|cable row|seated cable row|rematore ai cavi|low row)\b/, 'cablerow'],
    [both('rematore|row', DB), 'dbrow'],
    [both('rematore|row|t bar', MACH), 'machrow'],
    [/\b(rematore|barbell row|bent over row|pendlay|t bar row|t bar)\b/, 'row'],
    [/\b(trazioni assistite|assisted pull ?ups?|assisted chin ?ups?)\b/, 'assistpull'],
    [/\b(lat machine|lat pulldown|pulldown|pull down)\b/, 'latm'],
    [/\b(trazioni|pull ?ups?|chin ?ups?)\b/, 'pull'],
    // vertical push
    [both('military|overhead press|ohp|lento avanti|shoulder press|lento|arnold', DB), 'dbohp'],
    [both('shoulder press|overhead press|lento', MACH), 'machohp'],
    [/\b(military|overhead press|ohp|lento avanti|shoulder press)\b/, 'ohp'],
    [both('alzate laterali|lateral raises?|side raises?', CABLE), 'lr'],
    [/\b(alzate laterali|lateral raises?|side raises?)\b/, 'lat'],
    // legs
    [/\b(bulgar\w*|split squat)\b/, 'bulgarian'],
    [/\b(hack squat)\b/, 'hack'],
    [/\b(goblet)\b/, 'goblet'],
    [/\b(leg press|pressa)\b/, 'legpress'],
    [both('squat', 'corpo libero|bodyweight|air'), 'bwsquat'],
    [/\b(squat|back squat)\b/, 'squat'],
    [both('stacco rumeno|romanian|rdl', 'monopodalic\\w*|single leg|una gamba'), 'slrdl'],
    [both('stacco rumeno|romanian|rdl', DB), 'dbrdl'],
    [/\b(stacco rumeno|romanian deadlift|romanian|rdl|stiff leg)\b/, 'rdl'],
    [/\b(stacco|deadlift)\b/, 'deadlift'],
    [/\b(hip thrust)\b/, 'hipthrust'],
    [/\b(ponte glutei|glute bridge)\b/, 'bridge'],
    [/\b(kettlebell swing|swing)\b/, 'kbswing'],
    [both('affondi|lunges?', 'camminata|walking'), 'walklunge'],
    [/\b(step ?ups?)\b/, 'stepup'],
    [/\b(affondi|lunges?)\b/, 'bwlunge'],
    [/\b(leg extension|leg extensions)\b/, 'legext'],
    [both('abduzion\\w*|abductors?|abduction', CABLE), 'cableabd'],
    [/\b(abduzion\w*|abductors?|abduction)\b/, 'abd'],
    [both('calf|calves|polpacci', DB), 'dbcalf'],
    [/\b(calf|calves|polpacci)\b/, 'calf'],
    // arms
    [both('curl', 'martello|hammer'), 'hammer'],
    [both('curl', CABLE), 'cablecurl'],
    [both('curl', BB + '|ez'), 'bbcurl'],
    [/\b(curl|biceps curl|bicep curl)\b/, 'curl'],
    [/\b(push ?down|pushdown|spinte in basso|triceps pushdown)\b/, 'pd'],
    [/\b(french press|skull ?crushers?|lying triceps extension)\b/, 'french'],
    [/\b(estensioni|overhead extension|overhead triceps extension|triceps extension|tricep extension)\b/, 'ohext'],
    [/\b(kickbacks?)\b/, 'kickback'],
    // core
    [both('crunch', CABLE), 'cablecrunch'],
    [/\b(leg raises?|sollevamento gambe|hanging leg raises?)\b/, 'hangleg'],
    [/\b(pallof)\b/, 'pallof'],
    [/\b(dead bug)\b/, 'deadbug'],
    [/\b(plank)\b/, 'plank']
  ];

  // Muscle words in the file -> muscle group keys used for weekly volume. Order matters:
  // "deltoide laterale" is a shoulder (spalle before dorso), "bicipite femorale" / "biceps femoris"
  // are hamstrings and "retto femorale" is a quad head (handled before femorali and bicipiti).
  var MUSCLE_WORDS = [
    [/\b(petto|pettoral\w*|chest|pecs?)\b/, 'petto'],
    [/\b(spall\w*|deltoid\w*|delts?|shoulders?)\b/, 'spalle'],
    [/\b(dorso|dorsal\w*|schiena|lats?|latissim\w*|back|trapezi\w*|traps?|romboid\w*)\b/, 'dorso'],
    [/\b(quadricip\w*|quads?|quadriceps|rett\w* femor\w*|rectus femoris|vast\w* (laterale|mediale|intermedio))\b/, 'quadricipiti'],
    [/\b(hamstrings?|ischio\w*|bicip\w* femor\w*|biceps femoris|semitendin\w*|semimembran\w*)\b|^(?!.*\b(rett\w*|rectus)\b).*\bfemor\w*\b/, 'femorali'],
    [/\b(glute\w*|gluteo|glutei)\b/, 'glutei'],
    [/\b(bicipit\w*|biceps?)\b(?! femor)/, 'bicipiti'],
    [/\b(tricipit\w*|triceps?)\b/, 'tricipiti'],
    [/\b(polpacc\w*|calf|calves|gastrocnem\w*|soleo)\b/, 'polpacci'],
    [/\b(addom\w*|core|abs|abdominal\w*|obliqu\w*)\b/, 'addome']
  ];
  function muscleKeys(list) {
    var out = [];
    arr(list).forEach(function (m) {
      var t = norm(txt(m));
      MUSCLE_WORDS.forEach(function (w) { if (w[0].test(t) && out.indexOf(w[1]) < 0) out.push(w[1]); });
    });
    return out;
  }
  // Equipment explicitly named in an exercise ("con manubri", "barbell"...), or null
  function namedLoad(n) {
    var t = norm(n);
    if (/\b(zavorr\w*|weighted)\b/.test(t)) return ['Bilanciere']; // plates on a belt: 2,5 kg steps
    if (/\b(bilanciere|barbell|bb|ez|smith|multipower)\b/.test(t)) return ['Bilanciere'];
    if (/\b(manubri|manubrio|dumbbells?|db)\b/.test(t)) return ['Manubri'];
    if (/\b(kettlebell|kb)\b/.test(t)) return ['Kettlebell'];
    if (/\b(cavi|cavo|cables?|corda|rope)\b/.test(t)) return ['Cavi'];
    if (/\b(macchin\w*|machine|pressa|leg press)\b/.test(t)) return ['Macchine'];
    if (/\b(elastic\w*|bands?)\b/.test(t)) return ['Elastici'];
    return null;
  }
  // Equipment of an exercise that is not in the library (drives the load step)
  function reqFromName(n, mk) {
    var t = norm(n);
    if (/\b(corpo libero|bodyweight|a terra|plank|isometric\w*)\b/.test(t)) return [];
    var named = namedLoad(n);
    if (named) return named;
    // bodyweight core and conditioning moves
    if (/\b(crunch\w*|sit ?ups?|burpees?|mountain climbers?|hollow\w*|russian twists?|clamshells?|bird dogs?|superman|ab wheel|ab rollout|jumping jacks?|v ups?|toes to bar|flutter kicks?)\b/.test(t)) return [];
    if (/\b(dips?|parallele|trazioni|pull ?ups?|chin ?ups?)\b/.test(t)) return [];
    if (mk && mk.length && mk.every(function (k) { return k === 'addome'; })) return [];
    return ['Macchine'];
  }

  // "Rematore bilanciere o T-bar" -> options ["rematore bilanciere", "t bar"]; parentheses are alternatives too
  function options(name) {
    var n = String(name || '');
    var paren = (n.match(/\(([^)]*)\)/g) || []).map(function (p) { return p.replace(/[()]/g, '').replace(/^\s*(o|or|oppure)\s+/i, ''); });
    var base = n.replace(/\([^)]*\)/g, ' ');
    var parts = base.split(/\s+o\s+|\s*\/\s*|\s+oppure\s+|\s+or\s+/i).concat(paren).map(norm).filter(Boolean);
    return parts.length ? parts : [norm(n)];
  }
  // Words that say nothing about the movement: never enough for a match on their own
  var STOP = ' con alla alle allo agli al ai su in di da del della dei per la il lo le gli una uno un the and with on at of a presa seduto seduta sedute piedi in piedi manubri manubrio cavi cavo bilanciere macchina machine cable cables dumbbell dumbbells barbell elastico elastici kettlebell panca bench singolo singola alternato alternati ';
  var meaningful = function (s) { return s.split(' ').filter(function (w) { return w.length > 2 && STOP.indexOf(' ' + w + ' ') < 0; }); };
  // Does a library exercise train at least one of the muscles the file lists?
  var fits = function (e, mk) { return !mk.length || mk.some(function (k) { return e.mg && e.mg[k]; }); };

  // Best library id for one normalized option: { id, conf, same } | { create: rule } | null.
  // English plurals are retried in the singular. same = the option names the library lift itself
  // (no extra movement words, e.g. "Stacco rumeno" vs "Curl manubri inclinato"): only then does
  // the logged history of the library lift count for it (GT.exFamily).
  function matchOption(opt, mk) {
    var m = matchOne(opt, mk), sg = singular(opt);
    if ((!m || m.create) && sg !== opt) {
      var m2 = matchOne(sg, mk);
      if (m2 && !m2.create) { m = m2; opt = sg; } else if (!m && m2) m = m2;
    }
    if (m && m.id) {
      var bw = meaningful(norm(GT.EXI[m.id].n));
      m.same = m.conf === 'alta' && meaningful(opt).every(function (w) { return bw.indexOf(w) >= 0 || /^\d+$/.test(w); });
    }
    return m;
  }
  function matchOne(opt, mk) {
    var exact = GT.CATALOG.filter(function (e) { return norm(e.n) === opt; })[0];
    if (exact) return { id: exact.id, conf: 'alta' };
    for (var i = 0; i < ALIASES.length; i++) {
      if (!ALIASES[i][0].test(opt)) continue;
      if (ALIASES[i][1] == null) return { create: ALIASES[i] };
      var e = GT.EXI[ALIASES[i][1]];
      if (e && fits(e, mk)) return { id: e.id, conf: 'alta' };
      return null; // the name says one thing, the file's muscles another: do not guess
    }
    // Word overlap with library names, movement words only (≥ 2 shared, or the only word)
    var words = meaningful(opt);
    if (!words.length) return null;
    var best = null, bestScore = 0;
    GT.CATALOG.forEach(function (e) {
      if (!fits(e, mk)) return;
      var ew = meaningful(norm(e.n));
      var score = words.filter(function (w) { return ew.indexOf(w) >= 0; }).length;
      if (score > bestScore) { bestScore = score; best = e; }
    });
    // Two shared movement words, or the single word of a one-word name when the muscles agree
    if (best && (bestScore >= 2 || (bestScore === 1 && words.length === 1 && mk.length))) return { id: best.id, conf: 'media' };
    return null;
  }

  function matchExercise(name, mk) {
    var opts = options(name), create = null;
    for (var i = 0; i < opts.length; i++) {
      var m = matchOption(opts[i], mk);
      if (m && m.create) { if (!create) create = m.create; continue; }
      if (m && GT.EXI[m.id]) return { id: m.id, conf: m.conf, same: !!m.same, alternatives: opts.filter(function (_, j) { return j !== i; }) };
    }
    return create ? { create: create } : null;
  }

  // ---------- days of the week ----------
  var DAY_INDEX = { lunedi: 0, martedi: 1, mercoledi: 2, giovedi: 3, venerdi: 4, sabato: 5, domenica: 6,
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
    lun: 0, mar: 1, mer: 2, gio: 3, ven: 4, sab: 5, dom: 6,
    mon: 0, tue: 1, tues: 1, wed: 2, thu: 3, thur: 3, thurs: 3, fri: 4, sat: 5, sun: 6 };
  var dayOf = function (s) {
    if (typeof s === 'number' || /^\s*\d+\s*$/.test(String(s))) { var n = Number(s); return n >= 1 && n <= 7 ? n - 1 : n === 0 ? 6 : null; }
    var k = norm(s);
    if (DAY_INDEX[k] != null) return DAY_INDEX[k];
    var w = k.split(' ')[0];
    if (DAY_INDEX[w] != null) return DAY_INDEX[w];
    // a prefix of a real day name ("merc", "thurs"), never "giorno 1" (≠ giovedì) or "marzo"
    var hit = w.length >= 3 ? Object.keys(DAY_INDEX).filter(function (d) { return d.length > 3 && d.indexOf(w) === 0; })[0] : null;
    return hit ? DAY_INDEX[hit] : null;
  };
  // Default weekdays when the file has no schedule
  var SPREAD = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };

  // ---------- weeks ----------
  // Effort of a week as an RIR range for compound and isolation, from the many shapes AIs use
  function weekRir(w) {
    var rir = w.rir != null ? w.rir : w.RIR, rpe = w.rpe != null ? w.rpe : w.RPE, comp = null, iso = null;
    var fromRpe = function (r) { var x = range(r); return x ? [Math.max(0, 10 - x[1]), Math.max(0, 10 - x[0])] : null; };
    if (rir != null && typeof rir === 'object' && !Array.isArray(rir)) {
      comp = range(first(rir.compound, rir.multi, rir.multiarticolari, rir.main, rir.compounds));
      iso = range(first(rir.isolation, rir.iso, rir.complementari, rir.accessory, rir.accessories, rir.isolations));
      if (!comp && !iso && (rir.min != null || rir.max != null)) comp = range(rir);
    } else if (rir != null) comp = range(rir);
    if (!comp) comp = range(first(w.rirCompound, w.rirMulti));
    if (!iso) iso = range(first(w.rirIsolation, w.rirIso));
    if (!comp && rpe != null) {
      if (typeof rpe === 'object' && !Array.isArray(rpe)) { comp = fromRpe(first(rpe.compound, rpe.multi)); iso = iso || fromRpe(first(rpe.isolation, rpe.iso)); if (!comp) comp = fromRpe(rpe); }
      else comp = fromRpe(rpe);
    }
    return { comp: comp, iso: iso || comp };
  }
  var rpeOf = function (r) { return Math.round((10 - (r[0] + r[1]) / 2) * 2) / 2; };

  // ---------- running ----------
  // Kind of a run from its name ('l' long, 'q' quality, 'e' easy); descriptions are read only when
  // the name says nothing, and without the ambiguous Italian words "tempo" (time) and "velocità".
  function runKind(label, fromDesc) {
    if (/\b(lungo|lunga|long run|long|lunghissimo|lungolento)\b/.test(label)) return 'l';
    if (/\b(qualita|ripetut\w*|interval\w*|tempo run|corsa a tempo|soglia|fartlek|progressiv\w*|vo2\w*|threshold|ripetizioni)\b/.test(label)) return 'q';
    if (!fromDesc && /\b(tempo|veloc\w*)\b/.test(label)) return 'q';
    if (/\b(facile|easy|recupero|rigenerante|lenta|lento|z2|aerobic\w*|base)\b/.test(label)) return 'e';
    return null;
  }
  // Run sessions with the paces of the user's zones and the names, notes and distances of the file.
  // items: [{ rid, kind, name, desc, km }] (kept in run.src, so a new profile time rebuilds the paces)
  GT.importRuns = function (profile, items, today) {
    var p = profile || {};
    var rp = Object.assign({}, p, { runs: true, gymDays: 0, swims: false,
      run: Object.assign({ kmWeek: 20, testDist: 0, testTime: '' }, p.run || {}, { perWeek: Math.max(items.length, 2) }) });
    var gen = GT.generatePlan(rp, today || GT.todayISO()).run;
    var sessions = {}, order = [];
    items.forEach(function (it) {
      var pick = it.kind === 'q' ? (gen.sessions.q || gen.library.soglia) : it.kind === 'l' ? gen.sessions.l : (gen.sessions.e1 || gen.library.facile);
      var c = JSON.parse(JSON.stringify(pick));
      c.id = it.rid; c.name = it.name || c.name;
      var km = Number(it.km);
      if (isFinite(km) && km > 0 && km < 60 && it.kind !== 'q' && c.km) {
        var perKm = c.min / c.km;
        c.km = km; c.min = Math.round(km * perKm);
        if (c.blocks && c.blocks.length === 1) { c.blocks[0][2] = GT.fmt(km) + ' km'; c.blocks[0][4] = c.min; }
      } else if (isFinite(km) && km > 0) c.note = 'Distanza nel file: ' + GT.fmt(km) + ' km. ' + (c.note || '');
      c.note = [it.desc, c.note].filter(Boolean).join('. ');
      sessions[it.rid] = c; order.push(it.rid);
    });
    var p10 = GT.p10From(rp.run);
    return { p10: p10, zones: GT.paceZones(p10), sessions: sessions, order: order, library: gen.library, src: items,
      weeklyKm: order.reduce(function (a, id) { return a + (sessions[id].km || 0); }, 0) };
  };

  // ---------- text -> JSON ----------
  GT.parseProgramText = function (text) {
    var t = String(text || '').replace(/^﻿/, '').trim();
    if (!t) throw new Error('Il file è vuoto.');
    // Accept JSON wrapped in a ```json … ``` block, as AI chats often answer
    var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence && fence[1].indexOf('{') >= 0) t = fence[1].trim();
    var start = t.indexOf('{'), end = t.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('Non trovo un oggetto JSON nel testo.');
    var body = t.slice(start, end + 1);
    try { return JSON.parse(body); }
    catch (e) {
      // Common AI slips: smart quotes and trailing commas
      try { return JSON.parse(body.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, '$1')); }
      catch (e2) { throw new Error('Il JSON non è valido (' + e.message + '). Chiedi all\'AI di rispondere solo con il JSON, senza commenti.'); }
    }
  };

  // Find the program inside the JSON: top level, under "program"/"plan"/"scheda", or an array of one
  function unwrap(json) {
    if (Array.isArray(json)) json = json.filter(function (x) { return x && typeof x === 'object'; })[0];
    if (!json || typeof json !== 'object') return null;
    var sess = function (o) { return o && arr(first(o.sessions, o.workouts, o.sedute, o.allenamenti, o.days, o.giorni)).filter(function (s) { return s && typeof s === 'object' && first(s.exercises, s.esercizi); }); };
    if (sess(json).length) return json;
    var keys = ['program', 'programma', 'plan', 'piano', 'scheda', 'data'];
    for (var i = 0; i < keys.length; i++) {
      var inner = json[keys[i]];
      if (inner && typeof inner === 'object' && sess(inner).length) {
        var out = Object.assign({}, json, inner);
        out.program = Object.assign({}, typeof json.program === 'object' ? json.program : {}, inner.program || {});
        if (!out.program.name && inner.name) out.program.name = inner.name;
        return out;
      }
    }
    return json;
  }

  // ---------- JSON -> plan ----------
  GT.importProgram = function (raw, st) {
    var json = unwrap(raw);
    var sessionsIn = json ? arr(first(json.sessions, json.workouts, json.sedute, json.allenamenti, json.days, json.giorni)).filter(function (s) { return s && typeof s === 'object'; }) : [];
    if (!sessionsIn.length) {
      throw new Error('Formato non riconosciuto: mi aspetto un JSON con "sessions" (le sedute, ognuna con "exercises") e "weeklySchedule". Usa "Copia la richiesta per l\'AI" per avere il formato giusto.');
    }
    var report = { matched: [], created: [], warnings: [] };
    var program = json.program && typeof json.program === 'object' ? json.program : { name: txt(json.program) || txt(json.name) };
    var progName = txt(first(program.name, program.nome, program.title, json.name)) || 'Scheda importata';
    // Fingerprint of the content: two different unnamed programs are not "the same program"
    var fp = hash(sessionsIn.map(function (s) {
      return norm(txt(first(s.name, s.nome, s.id))) + ':' + arr(first(s.exercises, s.esercizi)).map(function (e) { return norm(txt(typeof e === 'string' ? e : first(e && e.name, e && e.nome))); }).join(',');
    }).join('|'));
    var custom = {}, today = GT.todayISO(), tag = hash(progName + fp).slice(0, 4);

    // ---------- weeks ----------
    var weeksIn = arr(first(json.weeks, json.settimane, json.mesocycle)).filter(function (w) { return w && typeof w === 'object'; });
    // "week": "1-3" stands for weeks 1, 2 and 3
    var wnum = function (w) { return range(first(w.week, w.settimana, w.weeks, w.settimane)); };
    if (weeksIn.length && weeksIn.every(function (w) { return wnum(w); })) weeksIn = weeksIn.slice().sort(function (a, b) { return wnum(a)[0] - wnum(b)[0]; });
    weeksIn = weeksIn.reduce(function (a, w) {
      var r = wnum(w), n = r && r[1] > r[0] && r[1] - r[0] < 16 ? Math.round(r[1] - r[0]) + 1 : 1;
      for (var j = 0; j < n; j++) a.push(w);
      return a;
    }, []);
    var noRir = [];
    var weeksSpec = weeksIn.map(function (w, i) {
      var typeRaw = txt(first(w.type, w.tipo, w.phase, w.fase, w.name)), type = typeRaw || 'accumulo';
      var r = weekRir(w), mult = num(first(w.setsMultiplier, w.volumeMultiplier, w.moltiplicatoreSerie));
      // A deload is named as such; a lower multiplier alone counts only without a progressive label and with easy effort
      var deload = /scaric|deload|recover|recupero|taper/i.test(type) ||
        (isFinite(mult) && mult <= 0.7 && !/accum|intens|intro|adatt|picco|peak|realiz|test|forza|strength|ipertrof|hypertroph|volume/i.test(typeRaw) && (!r.comp || r.comp[0] >= 3));
      if (!r.comp) { noRir.push(i + 1); r = deload ? { comp: [3, 4], iso: [3, 4] } : { comp: [2, 2], iso: [2, 2] }; }
      if (!isFinite(mult) || mult <= 0) mult = deload ? 0.6 : 1;
      return { type: type, rpeComp: rpeOf(r.comp), rpeIso: rpeOf(r.iso), rirComp: r.comp, rirIso: r.iso,
        setsMult: Math.min(2, mult), note: txt(first(w.notes, w.note)), deload: deload };
    });
    if (noRir.length && weeksSpec.length) report.warnings.push('Settimane senza RIR (' + noRir.map(function (n) { return 'S' + n; }).join(', ') + '): uso RIR 2' + (weeksSpec.some(function (w, i) { return w.deload && noRir.indexOf(i + 1) >= 0; }) ? ' (RIR 3–4 nello scarico)' : '') + '.');
    if (!weeksSpec.length) {
      var dw = Math.round(num(program.durationWeeks));
      var n = dw >= 2 && dw <= 16 ? dw : 4;
      for (var wi = 0; wi < n; wi++) {
        var dl = wi === n - 1, rr = dl ? [3, 4] : wi < (n - 1) / 2 ? [2, 3] : [1, 2];
        weeksSpec.push({ type: dl ? 'scarico' : wi < (n - 1) / 2 ? 'accumulo' : 'intensificazione', rpeComp: rpeOf(rr), rpeIso: rpeOf(rr), rirComp: rr, rirIso: rr, setsMult: dl ? 0.6 : 1, note: '', deload: dl });
      }
      report.warnings.push('Nel file non ci sono le settimane: uso un ciclo di ' + n + ' settimane (RIR 2–3, poi 1–2) con l\'ultima di scarico.');
    }
    // Index of the last deload week, -1 when the program has none (each week also carries .deload)
    var deloadIndex = weeksSpec.map(function (w) { return !!w.deload; }).lastIndexOf(true);

    // ---------- sessions -> days ----------
    var bySrc = {}, byName = {};
    var days = sessionsIn.map(function (s, si) {
      var srcId = txt(first(s.id, s.sessionId, s.code)), name = txt(first(s.name, s.nome, s.title, s.titolo)) || ('Seduta ' + (si + 1));
      var dayId = 'i' + tag + hash(srcId || name || si).slice(0, 4) + '-' + (si + 1);
      var used = {};
      var exIn = arr(first(s.exercises, s.esercizi)).filter(function (e) { return e && (typeof e === 'object' || typeof e === 'string'); })
        .map(function (e) { return typeof e === 'string' ? { name: e } : e; });
      var exs = exIn.map(function (ex, k) { return { ex: ex, k: k }; })
        .sort(function (a, b) { var oa = num(a.ex.order), ob = num(b.ex.order); return (isFinite(oa) ? oa : a.k + 1000) - (isFinite(ob) ? ob : b.k + 1000) || a.k - b.k; })
        .map(function (o) {
          var ex = o.ex, exName = txt(first(ex.name, ex.nome, ex.exercise, ex.esercizio)) || 'Esercizio';
          var mk = muscleKeys(first(ex.muscles, ex.muscoli, ex.muscle, ex.muscolo, ex.target));
          var m = matchExercise(exName, mk), base = m && m.id ? GT.EXI[m.id] : null, rule = m && m.create;
          var cat = norm(txt(first(ex.category, ex.categoria, ex.type, ex.tipo)));
          var comp = /compound|multi|fondamental|main|principal/.test(cat) ? true : /isolat|iso|complementar|accessor|monoartic/.test(cat) ? false : base ? base.comp : !!(rule && rule[4]);
          var mg = {};
          if (base) mg = Object.assign({}, base.mg);
          else if (mk.length) mk.forEach(function (key, i) { mg[key] = i === 0 ? 1 : 0.5; });
          else if (rule && rule[2]) mg = Object.assign({}, rule[2]);
          var primary = base ? base.m : mk[0] || Object.keys(mg)[0] || null;
          var id = 'imp-' + slug(exName);
          if (used[id]) { used[id]++; id = id + '-' + used[id]; } else used[id] = 1;
          // Equipment: the library's, unless the library lift is bodyweight and the file names a load
          // ("Affondi con manubri" -> loaded lunges); created exercises: from the name, or the rule
          var req = base ? (base.req.length ? base.req.slice() : namedLoad(exName) || []) : rule && rule[5] ? rule[5].slice() : reqFromName(exName, mk);
          var entry = custom[id] || {
            id: id, n: exName, m: primary, mg: mg,
            req: req, pat: base ? base.pat : (rule && rule[3]) || primary || 'altro', comp: comp, lvl: 1,
            avoid: base ? base.avoid.slice() : [],
            cues: base ? base.cues.slice() : ['Movimento controllato, 2–3 secondi in discesa.', 'Nessuno slancio.', 'Fermati quando la tecnica cambia.'],
            base: base ? base.id : null, conf: base ? m.conf : null, same: !!(base && m.same), custom: true
          };
          if (!custom[id]) {
            custom[id] = entry;
            if (base) report.matched.push({ from: entry.n, to: base.n, conf: m.conf, alternatives: m.alternatives });
            else report.created.push({ name: entry.n, muscles: Object.keys(mg).map(function (key) { return GT.MUSCLE_NAME[key]; }) });
          }
          // reps: repMin/repMax, or reps as 8 / "8-10" / [8, 10] / {min, max}; "3x10" / "4×8-10" carry the sets too
          var repsRaw = first(ex.reps, ex.ripetizioni, ex.repRange, ex.rep), setsRaw = first(ex.sets, ex.serie);
          var sx = String(repsRaw == null ? '' : repsRaw).match(/^\s*(\d+)\s*[x×*]\s*(.+)$/i) || String(setsRaw == null ? '' : setsRaw).match(/^\s*(\d+)\s*[x×*]\s*(.+)$/i);
          if (sx) { repsRaw = sx[2]; setsRaw = sx[1]; }
          var rr = range(repsRaw);
          var lo = Math.round(num(first(ex.repMin, ex.minReps, ex.repsMin))), hi = Math.round(num(first(ex.repMax, ex.maxReps, ex.repsMax)));
          if (!isFinite(lo)) lo = rr ? Math.round(rr[0]) : NaN;
          if (!isFinite(hi)) hi = rr ? Math.round(rr[1]) : lo;
          if (!isFinite(lo) || lo < 1) { lo = comp ? 8 : 10; hi = comp ? 10 : 12; report.warnings.push(exName + ': ripetizioni non indicate o non numeriche ("' + txt(first(ex.reps, ex.repMin)) + '"), uso ' + lo + '–' + hi + '.'); }
          if (!isFinite(hi) || hi < lo) hi = lo;
          var setsR = range(setsRaw), sets = setsR ? Math.round(setsR[1]) : 3;
          var rest = seconds(first(ex.restSec, ex.restSeconds, ex.rest_s, ex.recuperoSec), 'sec');
          if (!isFinite(rest)) rest = seconds(first(ex.rest, ex.recupero, ex.restTime, ex.pausa));
          if (!isFinite(rest)) rest = seconds(first(ex.restMin, ex.recuperoMin), true);
          if (!isFinite(rest) || rest <= 0) rest = comp ? 120 : 75;
          var minRir = num(first(ex.minRir, ex.rirMin, ex.minimumRir));
          var ss = txt(first(ex.supersetGroup, ex.superset, ex.supersetWith));
          return { id: id, sets: Math.max(1, Math.min(10, sets)), lo: lo, hi: hi, reps: lo === hi ? String(lo) : lo + '–' + hi,
            rest: Math.max(15, Math.min(600, Math.round(rest))), rpeOffset: 0, comp: comp,
            minRir: isFinite(minRir) ? Math.max(0, Math.min(5, minRir)) : null, note: txt(first(ex.notes, ex.note, ex.cues)) || null,
            superset: ss && ss !== 'false' ? ss : null };
        });
      var opt = arr(first(s.optionalExercises, s.facoltativi, s.optional)).map(function (o) {
        if (typeof o !== 'object') return txt(o);
        var r = range(first(o.reps)) || [num(o.repMin), num(o.repMax)];
        return txt(o.name || o.nome) + (o.sets ? ' ' + txt(o.sets) + '×' : '') + (isFinite(r[0]) ? (o.sets ? '' : ' ') + r[0] + (isFinite(r[1]) && r[1] !== r[0] ? '–' + r[1] : '') : '') + (o.notes ? ' (' + txt(o.notes) + ')' : '');
      }).filter(Boolean);
      if (opt.length) report.warnings.push(name + ': esercizi facoltativi lasciati come nota (' + opt.join('; ') + ').');
      var muscles = [];
      exs.forEach(function (x) { var e = custom[x.id]; if (e && e.m && muscles.indexOf(e.m) < 0) muscles.push(e.m); });
      var day = { id: dayId, srcId: srcId || null, key: 'import', name: name,
        focus: muscles.slice(0, 4).map(function (k) { return GT.MUSCLE_NAME[k] || k; }).join(', '),
        notes: [txt(first(s.notes, s.note))].concat(opt.length ? ['Facoltativi: ' + opt.join('; ')] : []).filter(Boolean), ex: exs };
      if (srcId && !bySrc[norm(srcId)]) bySrc[norm(srcId)] = day.id;
      if (!byName[norm(name)]) byName[norm(name)] = day.id;
      return day;
    });
    var findSession = function (ref) { var k = norm(txt(ref)); return k ? bySrc[k] || byName[k] || null : null; };

    // ---------- schedule (normalized) ----------
    var scheduleIn = arr(first(json.weeklySchedule, json.schedule, json.calendario, json.calendar, json.week, json.settimanaTipo));
    var schedule = [];
    scheduleIn.forEach(function (x, i) {
      if (typeof x !== 'object') return;
      var dayRaw = first(x.day, x.giorno, x.weekday, x.dayOfWeek);
      var ref = first(x.sessionId, x.session, x.sessionName, x.seduta, x.workout, x.workoutId, x.name, x.nome, x.title, x.allenamento, x.label);
      var type = norm(txt(first(x.type, x.tipo, x.activityType, x.kind)));
      var act = txt(first(x.activity, x.attivita, x.description, x.descrizione, x.note, x.notes));
      var cardioOrRest = /run|corsa|running|jog|swim|nuoto|piscina|rest|riposo|off|recover|recupero/.test(type);
      // the session may also be named in the activity text ({ day, activity: "Lower A" })
      var gymId = cardioOrRest && !/gym|palestra|pesi/.test(type) ? null : findSession(ref) || findSession(act);
      schedule.push({ i: i, day: dayRaw, wd: dayOf(dayRaw), gymId: gymId, ref: ref, runId: txt(first(x.runId, x.run, x.corsa)) || (/run|corsa|running/.test(type) ? txt(ref) : ''), type: type, act: act });
    });

    // ---------- running: the user's zones, sessions named as in the file ----------
    var runsIn = arr(first(json.runs, json.corse, json.running, json.cardio)).filter(function (r) { return r && typeof r === 'object'; });
    var runDefs = {};
    runsIn.forEach(function (r) { var id = txt(first(r.id, r.runId)); if (id) runDefs[norm(id)] = r; var nm = txt(first(r.name, r.nome)); if (nm && !runDefs[norm(nm)]) runDefs[norm(nm)] = r; });
    var runSlots = schedule.filter(function (x) { return !x.gymId && (/run|corsa|running|jog/.test(x.type) || (x.runId && runDefs[norm(x.runId)])); });
    var p = st.profile || {}, run = null;
    if (runSlots.length) {
      var items = [];
      runSlots.forEach(function (x, k) {
        var def = runDefs[norm(x.runId)] || {};
        var rid = 'run-' + (norm(x.runId).replace(/ /g, '-') || String(k + 1));
        x.cardioId = rid;
        if (items.some(function (it) { return it.rid === rid; })) return;
        var nameLabel = norm(txt(first(def.name, def.nome)) + ' ' + x.runId), descLabel = norm(txt(first(def.description, def.descrizione, def.notes)) + ' ' + x.act);
        items.push({ rid: rid, kind: runKind(nameLabel) || runKind(descLabel, true) || 'e',
          name: txt(first(def.name, def.nome)) || txt(x.act), desc: txt(first(def.description, def.descrizione, def.notes)),
          km: num(first(def.distanceKm, def.km, def.distanza, def.distance)) });
      });
      run = GT.importRuns(p, items, today);
      if (!(p.run && p.run.testTime)) report.warnings.push('Corse: ritmi stimati dalle zone del tuo profilo. Se aggiungi un tempo sui 5 o 10 km in Profilo → Modifica le risposte, i ritmi della scheda importata si aggiornano.');
      else report.warnings.push('Corse: ritmi dalle tue zone, nomi e descrizioni dal file.');
    }

    // ---------- swimming / active recovery ----------
    var swimS = {}, swimOrder = [];
    schedule.forEach(function (x) {
      if (x.gymId || x.cardioId) return;
      var isSwim = /swim|nuoto|piscina/.test(x.type) || (/recover|recupero|attiv/.test(x.type) && /nuot|swim|piscin/i.test(x.act));
      if (!isSwim) return;
      var id = 'sw-' + (x.i + 1), name = x.act ? x.act.charAt(0).toUpperCase() + x.act.slice(1) : 'Nuoto leggero';
      swimS[id] = { kind: 'piscina', id: id, name: name, tag: 'Recupero attivo', m: 1000, min: 30, rpe: '2–3',
        blocks: [['Nuoto leggero', 'stile e dorso, molto facile', '20 min', 1, 20]].concat(/sauna/i.test(x.act) ? [['Sauna', 'facoltativa · bevi prima e dopo', '10–15 min', 1, 12]] : []),
        note: 'Recupero attivo: niente intensità, solo movimento.' };
      swimOrder.push(id); x.cardioId = id;
    });

    // ---------- calendar ----------
    var week = [0, 1, 2, 3, 4, 5, 6].map(function (wd) { return { wd: wd, items: [] }; });
    schedule.forEach(function (x) {
      if (x.wd == null) { report.warnings.push('Giorno non riconosciuto: "' + txt(x.day) + '" (voce ' + (x.i + 1) + ' del calendario).'); return; }
      var dname = GT.DAYS_LONG[x.wd];
      if (x.gymId) { week[x.wd].items.push({ type: 'gym', id: x.gymId }); return; }
      if (x.cardioId) { week[x.wd].items.push({ type: x.cardioId.indexOf('sw-') === 0 ? 'swim' : 'run', id: x.cardioId }); return; }
      if (/gym|palestra|pesi|weights|strength|forza|workout|allenamento|lift/.test(x.type) || x.ref) { report.warnings.push(dname + ': seduta "' + txt(x.ref) + '" non trovata nel file.'); return; }
      if (/rest|riposo|off|libero/.test(x.type) || !x.type) return;
      if (x.act || x.type) report.warnings.push(dname + ': "' + (x.act || x.type) + '" resta come nota (non è un\'attività che l\'app registra).');
    });
    if (!schedule.length) {
      var spread = SPREAD[Math.min(7, days.length)] || [];
      days.slice(0, 7).forEach(function (d, i) { week[spread[i]].items.push({ type: 'gym', id: d.id }); });
      report.warnings.push('Nel file non c\'è il calendario: metto le sedute di ' + spread.map(function (wd) { return GT.DAYS_LONG[wd]; }).join(', ') + '.');
    }
    var unscheduled = days.filter(function (d) { return !week.some(function (w) { return w.items.some(function (it) { return it.id === d.id; }); }); });
    if (unscheduled.length) report.warnings.push('Sedute non in calendario: ' + unscheduled.map(function (d) { return d.name; }).join(', ') + '. Puoi avviarle da Allena → Scheda.');

    // ---------- progression and notes ----------
    var pr = json.progression && typeof json.progression === 'object' ? json.progression : { type: txt(json.progression) };
    var li = range(first(pr.loadIncreasePercent, pr.incrementoPercentuale, pr.increasePercent, pr.loadIncrease));
    var ptype = norm(txt(first(pr.type, pr.tipo, pr.method, pr.rule)));
    var progression = /double|doppia/.test(ptype)
      ? { type: 'double', sessions: 1, pct: li && li[1] > 0 && li[1] <= 20 ? li : [2.5, 5], rule: txt(first(pr.rule, pr.regola, pr.description)) || 'Doppia progressione: quando chiudi tutte le serie al massimo del range, aumenta il carico' }
      : null;
    if (!progression && (pr.type || pr.rule)) report.warnings.push('Progressione "' + txt(first(pr.type, pr.rule)) + '": la tengo come nota e uso la regola dell\'app (+1 step di carico dopo due sedute con il range chiuso).');
    var notes = [txt(first(program.notes, program.note, program.description, program.descrizione))]
      .concat(arr(first(json.rules, json.regole, json.guidelines)).map(txt))
      .concat(!progression && (pr.type || pr.rule) ? ['Progressione della scheda: ' + txt(first(pr.rule, pr.type))] : [])
      .filter(Boolean);

    var plan = {
      version: 1, source: { type: 'import', id: txt(program.id) || null, name: progName, fp: fp, goal: txt(first(program.goal, program.obiettivo)) || null, importedAt: new Date().toISOString() },
      createdAt: new Date().toISOString(), startDate: GT.mondayOf(today),
      cycleWeeks: weeksSpec.length, weeksSpec: weeksSpec, rpeWeeks: weeksSpec.map(function (w) { return w.rpeComp; }), deloadIndex: deloadIndex,
      split: progName, days: days, week: week,
      run: run, swim: swimOrder.length ? { sessions: swimS, order: swimOrder } : null,
      progression: progression, notes: notes, custom: custom
    };
    var dur = Math.round(num(program.durationWeeks));
    if (isFinite(dur) && weeksIn.length && dur !== weeksSpec.length) report.warnings.push('Il programma dice ' + dur + ' settimane ma ne descrive ' + weeksSpec.length + ': uso ' + weeksSpec.length + '.');
    if (report.matched.some(function (m) { return m.conf === 'media'; })) report.warnings.push('Alcuni esercizi sono abbinati per somiglianza del nome (segnati "controlla"): dopo l\'import puoi sostituirli dalla scheda.');
    return { plan: plan, report: report };
  };

  // When week 1 starts: this Monday, next Monday, or (same program already active) keep its dates
  GT.importStartOptions = function (plan, st) {
    var today = GT.todayISO(), thisMon = GT.mondayOf(today), nextMon = GT.addDays(thisMon, 7), out = [];
    // A program with the same name (and id) can continue where it is; it is the default only when the
    // content is identical too. Unnamed programs must match by content (older imports: no fingerprint).
    var cs = st.plan && st.plan.source, ps = plan.source, cur = st.plan;
    var sameFp = !!(cs && (!cs.fp || cs.fp === ps.fp));
    var same = !!(cs && cs.type === 'import' && cs.name === ps.name && (!(cs.id && ps.id) || cs.id === ps.id) && (ps.name !== 'Scheda importata' || sameFp));
    if (same) {
      var cw = GT.cycleWeek(cur, today);
      out.push({ k: 'keep', label: 'Continua dalla settimana ' + cw.num, date: cur.startDate });
    }
    out.push({ k: 'this', label: 'Settimana 1 da lunedì ' + GT.fmtDay(thisMon), date: thisMon });
    out.push({ k: 'next', label: 'Settimana 1 da lunedì ' + GT.fmtDay(nextMon), date: nextMon });
    var def = same && sameFp ? 'keep' : GT.weekday(today) <= 2 ? 'this' : 'next';
    return { options: out, def: def };
  };
})();
