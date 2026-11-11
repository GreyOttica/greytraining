/* GreyTraining — values computed from the user's own logs (no seed data).
   All functions are pure: they take the state (st) and return plain data for the screens.

   Logs (GT.state.logs):
   sessions [{ id, date, dayId, dayName, start, dur (min), sets { exId: [{ w, r, e, e1, pr }] }, vol, prs [exId], rate, notes {}, week }]
   cardio   [{ id, date, sessionId, kind 'corsa'|'piscina', name, v (km | m), t (min), e (RPE) }]
   weights  [{ date, kg }]               one per date, sorted by date
   measures [{ date, vita, petto, braccio, coscia }]
   food     { 'yyyy-mm-dd': { mealName: [{ n, q, grams, k, p, c, g }] } }
   water    { 'yyyy-mm-dd': glasses }
   ready    { 'yyyy-mm-dd': { sonno, energia, dolori } }                                     */
(function () {
  'use strict';
  var GT = (window.GT = window.GT || {});

  var logsOf = function (st) { return st.logs || {}; };
  var sum = function (a, f) { return a.reduce(function (s, x) { return s + f(x); }, 0); };

  // ---------- strength ----------
  GT.e1rm = function (w, r) { return w > 0 && r > 0 ? w * (1 + r / 30) : 0; };

  // Sets of an exercise in one saved session. History is shared across the exercise's family
  // (library lift + imported exercises linked to it, see GT.exFamily), so a new program keeps it.
  var famSets = function (s, fam) {
    if (!s.sets) return null;
    for (var i = 0; i < fam.length; i++) { var x = s.sets[fam[i]]; if (x && x.length) return x; }
    return null;
  };
  var famOf = function (id) { return GT.exFamily ? GT.exFamily(id) : [id]; };
  // Every set of the family in one session (for records and charts: a top set and its back-off
  // sets may sit under two ids)
  var famAll = function (s, fam) {
    if (!s.sets) return null;
    var out = fam.reduce(function (a, id) { return a.concat(s.sets[id] || []); }, []);
    return out.length ? out : null;
  };

  // Most recent saved session that contains this exercise
  GT.lastPerformance = function (st, exId) {
    var ss = logsOf(st).sessions || [], fam = famOf(exId);
    for (var i = ss.length - 1; i >= 0; i--) {
      var sets = famSets(ss[i], fam);
      if (sets) return { date: ss[i].date, sets: sets, week: ss[i].week };
    }
    return null;
  };
  // Best estimated 1RM ever (saved sessions), optionally plus sets of the running session
  GT.bestE1RM = function (st, exId, extra) {
    var best = 0, at = null, fam = famOf(exId);
    (logsOf(st).sessions || []).forEach(function (s) {
      (famAll(s, fam) || []).forEach(function (l) { var v = GT.e1rm(l.w, l.r); if (v > best) { best = v; at = { date: s.date, w: l.w, r: l.r }; } });
    });
    (extra || []).forEach(function (l) { var v = GT.e1rm(l.w, l.r); if (v > best) { best = v; at = { date: GT.todayISO(), w: l.w, r: l.r }; } });
    return { value: best, set: at };
  };
  // e1RM per session (best set) over time, for charts
  GT.e1rmSeries = function (st, exId) {
    var fam = famOf(exId);
    return (logsOf(st).sessions || []).map(function (s) {
      var sets = famAll(s, fam);
      if (!sets) return null;
      return { date: s.date, v: Math.max.apply(null, sets.map(function (l) { return GT.e1rm(l.w, l.r); })) };
    }).filter(Boolean);
  };
  // Exercises with at least one logged set, most-trained first
  // (one id per exercise family: the one in the current plan, else the most trained)
  GT.trainedExercises = function (st) {
    var count = {}, fam = {};
    (logsOf(st).sessions || []).forEach(function (s) { Object.keys(s.sets || {}).forEach(function (id) { count[id] = (count[id] || 0) + (s.sets[id] || []).length; }); });
    var inPlan = function (id) { return !!(st.plan && st.plan.days.some(function (d) { return d.ex.some(function (x) { return x.id === id; }); })); };
    Object.keys(count).forEach(function (id) {
      var root = famOf(id)[0], f = fam[root] || (fam[root] = { n: 0, id: id });
      f.n += count[id];
      if ((inPlan(id) && !inPlan(f.id)) || (inPlan(id) === inPlan(f.id) && count[id] > count[f.id])) f.id = id;
    });
    return Object.keys(fam).sort(function (a, b) { return fam[b].n - fam[a].n; }).map(function (k) {
      // a family member in the current plan (even with no sets yet) gives the name shown
      if (!inPlan(fam[k].id)) { var p = famOf(k).filter(inPlan)[0]; if (p) return p; }
      return fam[k].id;
    });
  };
  // Personal records: best e1RM per exercise
  // (one row per exercise family: the imported name wins when it is in the current plan)
  GT.personalRecords = function (st) {
    return GT.trainedExercises(st).map(function (id) {
      var b = GT.bestE1RM(st, id);
      return b.set ? { id: id, name: (GT.EXI[id] || {}).n || id, e1: b.value, w: b.set.w, r: b.set.r, date: b.set.date } : null;
    }).filter(Boolean);
  };

  // Load step for an exercise: dumbbells / kettlebells 2 kg, bodyweight 0 (add reps), else 2.5 kg
  GT.loadStep = function (exId) {
    var e = GT.EXI[exId];
    if (!e || !e.req.length) return 0;
    return e.req[0] === 'Manubri' || e.req[0] === 'Kettlebell' ? 2 : 2.5;
  };

  // The last n saved sessions that contain this exercise, newest first
  GT.lastPerformances = function (st, exId, n) {
    var ss = logsOf(st).sessions || [], out = [], fam = famOf(exId);
    for (var i = ss.length - 1; i >= 0 && out.length < n; i--) {
      var sets = famSets(ss[i], fam);
      if (sets) out.push({ date: ss[i].date, sets: sets, week: ss[i].week, deload: ss[i].deload });
    }
    return out;
  };

  // Suggested first set for today: { w (kg or null = choose), r, why }
  // Rule (handoff): +1 load step when the top of the rep range was reached on every planned set
  // at RPE ≤ target in the last TWO sessions with this exercise at the same load.
  GT.suggestion = function (st, planEx, targetRpe) {
    var plan = st.plan, today = GT.todayISO(), step = GT.loadStep(planEx.id);
    var eff = function (r) { return GT.effLabel ? GT.effLabel(r) : 'RPE ' + GT.fmt(r); };
    // Deload weeks do not count as a reference: fewer sets, easier on purpose
    var nW = plan ? plan.cycleWeeks || 1 : 1;
    var dlWeek = function (num) {
      if (!plan || !num) return false;
      var i = (num - 1) % nW;
      return plan.weeksSpec ? !!(plan.weeksSpec[i] || {}).deload : i === plan.deloadIndex;
    };
    var topOf = function (sets) { return sets.reduce(function (a, b) { return (b.w > a.w || (b.w === a.w && b.r > a.r)) ? b : a; }); };
    var anyPerf = GT.lastPerformance(st, planEx.id);
    if (!anyPerf) return { w: step === 0 ? 0 : null, r: planEx.hi, why: step === 0 ? 'Prima volta: fermati 2–3 ripetizioni prima del cedimento.' : 'Prima volta: scegli un carico che chiudi a ' + eff(targetRpe) + '.' };
    // This week is a deload: same loads as last time, no increase
    if (plan && GT.cycleWeek(plan, today).deload) return { w: topOf(anyPerf.sets).w, r: planEx.lo, why: 'Settimana di scarico: stesso carico, meno serie, lontano dal cedimento.' };
    var perf = GT.lastPerformances(st, planEx.id, 6).filter(function (p) { return !(p.deload != null ? p.deload : dlWeek(p.week)); }).slice(0, 2);
    var last = perf[0];
    if (!last) return { w: topOf(anyPerf.sets).w, r: planEx.hi, why: 'Riparti dal carico dello scarico e chiudi a ' + eff(targetRpe) + '.' };
    // Sets are judged against the target of the week they were done in (not today's)
    var full = null;
    if (plan) plan.days.forEach(function (d) { d.ex.forEach(function (x) { if (!full && x.id === planEx.id) full = x; }); });
    var targetAt = function (p) { return full && plan ? GT.targetFor(plan, full, p.date).rpe : targetRpe; };
    var setsNeeded = full ? full.sets : planEx.sets;
    // Imported programs give RIR as a range (e.g. 2–3, target = mean 2.5): any value inside the range counts
    var prog = plan && plan.progression, tol = prog ? 0.51 : 0.01;
    var closed = function (p) { var t = targetAt(p); return p.sets.length >= setsNeeded && p.sets.every(function (l) { return l.r >= planEx.hi && (l.e || 10) <= t + tol; }); };
    var top = topOf(last.sets);
    // An imported plan may bring its own rule, e.g. double progression after ONE session,
    // with a percentage increase rounded to the load step.
    if (prog && prog.type === 'double' && prog.sessions === 1) {
      if (closed(last) && step > 0) {
        var pct = ((prog.pct && (prog.pct[0] + prog.pct[1]) / 2) || 2.5) / 100;
        var inc = Math.max(step, Math.round(top.w * pct / step) * step);
        return { w: top.w + inc, r: planEx.lo, up: true, why: 'Tutte le serie al massimo del range: +' + GT.fmtKg(inc) + ' kg (doppia progressione della tua scheda).' };
      }
      if (closed(last)) return { w: top.w, r: Math.min(planEx.hi + 2, top.r + 1), up: true, why: 'Tutte le serie al massimo del range: +1 ripetizione.' };
      return { w: top.w, r: Math.min(planEx.hi, top.r + 1), why: 'Stesso carico finché chiudi tutte le serie a ' + planEx.hi + ' ripetizioni a ' + eff(targetRpe) + '.' };
    }
    var twice = perf.length === 2 && closed(perf[0]) && closed(perf[1]) && topOf(perf[1].sets).w === top.w;
    var tj = targetAt(perf[0]), effTj = GT.state && GT.state.effort === 'RIR' ? 'RIR ≥ ' + GT.fmt(10 - tj) : 'RPE ≤ ' + GT.fmt(tj);
    if (twice && step > 0) return { w: top.w + step, r: planEx.lo, up: true, why: 'Range chiuso in alto (' + effTj + ') per due sessioni: +' + GT.fmtKg(step) + ' kg.' };
    if (twice && step === 0) return { w: top.w, r: Math.min(planEx.hi + 2, top.r + 1), up: true, why: 'Range chiuso per due sessioni: +1 ripetizione.' };
    if (closed(last)) return { w: top.w, r: planEx.hi, why: 'Range chiuso in alto: conferma lo stesso carico, poi si sale.' };
    return { w: top.w, r: Math.min(planEx.hi, top.r + 1), why: 'Stesso carico, punta a una ripetizione in più.' };
  };

  // ---------- weekly volume ----------
  // Hard sets per muscle group in the week starting at mondayISO (RPE ≥ 7 or not recorded)
  GT.weeklySets = function (st, mondayISO) {
    var end = GT.addDays(mondayISO, 6), out = {};
    GT.MUSCLES.forEach(function (m) { out[m.k] = 0; });
    (logsOf(st).sessions || []).filter(function (s) { return s.date >= mondayISO && s.date <= end; }).forEach(function (s) {
      Object.keys(s.sets || {}).forEach(function (id) {
        var e = GT.EXI[id]; if (!e) return;
        var hard = (s.sets[id] || []).filter(function (l) { return !l.e || l.e >= 7; }).length;
        Object.keys(e.mg).forEach(function (k) { out[k] = (out[k] || 0) + hard * e.mg[k]; });
      });
    });
    Object.keys(out).forEach(function (k) { out[k] = Math.round(out[k] * 10) / 10; });
    return out;
  };
  // Sets per muscle group the plan schedules in one normal week
  GT.plannedSets = function (plan) {
    var out = {};
    GT.MUSCLES.forEach(function (m) { out[m.k] = 0; });
    if (!plan) return out;
    plan.week.forEach(function (d) {
      d.items.filter(function (it) { return it.type === 'gym'; }).forEach(function (it) {
        var day = GT.findDay(plan, it.id); if (!day) return;
        day.ex.forEach(function (x) { var e = GT.EXI[x.id]; if (!e) return; Object.keys(e.mg).forEach(function (k) { out[k] += x.sets * e.mg[k]; }); });
      });
    });
    Object.keys(out).forEach(function (k) { out[k] = Math.round(out[k] * 10) / 10; });
    return out;
  };

  // ---------- calendar ----------
  // What the plan schedules on a date, and whether each item is done
  GT.dayPlan = function (st, dateISO) {
    var plan = st.plan; if (!plan) return { items: [], rest: true };
    var wd = GT.weekday(dateISO), slot = plan.week[wd] || { items: [] };
    var items = slot.items.map(function (it) {
      if (it.type === 'gym') {
        var day = GT.findDay(plan, it.id);
        var done = (logsOf(st).sessions || []).filter(function (s) { return s.date === dateISO && s.dayId === it.id; })[0] || null;
        return { type: 'gym', id: it.id, day: day, done: done };
      }
      var c = GT.findCardio(plan, it.id);
      var log = (logsOf(st).cardio || []).filter(function (l) { return l.date === dateISO && l.sessionId === it.id; })[0] || null;
      return { type: it.type, id: it.id, cardio: c, done: log };
    }).filter(function (x) { return x.day || x.cardio; });
    return { items: items, rest: !items.length };
  };
  // Any gym session saved on a date (planned or not)
  GT.sessionsOn = function (st, dateISO) { return (logsOf(st).sessions || []).filter(function (s) { return s.date === dateISO; }); };

  // ---------- readiness ----------
  GT.readinessOf = function (st, dateISO) {
    var r = (logsOf(st).ready || {})[dateISO || GT.todayISO()];
    if (!r || !r.sonno || !r.energia || !r.dolori) return null;
    var score = Math.round((r.sonno + r.energia + r.dolori - 3) / 12 * 100);
    return { score: score, label: score >= 75 ? 'Pronto per spingere' : score >= 55 ? 'Nella media' : 'Recupero ridotto', values: r };
  };

  // ---------- nutrition ----------
  GT.foodDay = function (st, dateISO) {
    var meals = GT.mealsFor(st.profile), day = (logsOf(st).food || {})[dateISO] || {};
    var out = meals.map(function (m) { var it = day[m] || []; return { name: m, items: it, k: sum(it, function (f) { return f.k; }) }; });
    var all = [].concat.apply([], out.map(function (m) { return m.items; }));
    return { meals: out, tot: { k: sum(all, function (f) { return f.k; }), p: sum(all, function (f) { return f.p; }), c: sum(all, function (f) { return f.c; }), g: sum(all, function (f) { return f.g; }) }, logged: all.length > 0 };
  };
  // Recently logged foods (newest first, unique by name+quantity), for quick add
  GT.recentFoods = function (st, n) {
    var food = logsOf(st).food || {}, seen = {}, out = [];
    Object.keys(food).sort().reverse().forEach(function (d) {
      Object.keys(food[d]).forEach(function (m) { (food[d][m] || []).slice().reverse().forEach(function (f) { var key = f.n + '|' + f.q; if (!seen[key]) { seen[key] = 1; out.push(f); } }); });
    });
    return out.slice(0, n || 8);
  };
  // Last 7 days ending today: kcal as % of target, only for days with something logged
  GT.adherence = function (st, endISO) {
    var end = endISO || GT.todayISO(), t = st.targets;
    return [6, 5, 4, 3, 2, 1, 0].map(function (back) {
      var d = GT.addDays(end, -back), f = GT.foodDay(st, d);
      return { date: d, letter: GT.DAYS_LETTER[GT.weekday(d)], logged: f.logged, pct: t && f.logged ? Math.round(f.tot.k / t.k * 100) : null, prot: f.tot.p };
    });
  };

  // ---------- body ----------
  GT.weightStats = function (st, days) {
    var all = (logsOf(st).weights || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (!all.length) return { all: all, series: [], avg7: null, delta: null, last: null };
    var lastDate = all[all.length - 1].date;
    var from = days ? GT.addDays(GT.todayISO(), -days) : all[0].date;
    var series = all.filter(function (w) { return w.date >= from; });
    var last7 = all.filter(function (w) { return w.date > GT.addDays(lastDate, -7); });
    var avg7 = sum(last7, function (w) { return w.kg; }) / last7.length;
    return { all: all, series: series, avg7: avg7, last: all[all.length - 1], delta: series.length > 1 ? series[series.length - 1].kg - series[0].kg : null };
  };

  // ---------- weekly review and coach actions ----------
  GT.weekReview = function (st, mondayISO) {
    var end = GT.addDays(mondayISO, 6), plan = st.plan;
    var planned = 0;
    if (plan) plan.week.forEach(function (d) { planned += d.items.length; });
    var gym = (logsOf(st).sessions || []).filter(function (s) { return s.date >= mondayISO && s.date <= end; });
    var cardio = (logsOf(st).cardio || []).filter(function (s) { return s.date >= mondayISO && s.date <= end; });
    var sets = GT.weeklySets(st, mondayISO), hard = 0;
    Object.keys(sets).forEach(function (k) { hard += sets[k]; });
    var adh = GT.adherence(st, end).filter(function (a) { return a.logged; });
    var inRange = adh.filter(function (a) { return a.pct >= 90 && a.pct <= 110; }).length;
    var w = (logsOf(st).weights || []).filter(function (x) { return x.date >= GT.addDays(mondayISO, -7) && x.date <= end; });
    return {
      done: gym.length + cardio.length, planned: planned, gym: gym.length, cardio: cardio.length,
      hardSets: Math.round(hard), dietDays: adh.length, dietInRange: inRange,
      weightDelta: w.length > 1 ? w[w.length - 1].kg - w[0].kg : null
    };
  };

  // Actions the coach proposes, from real data only. Each: { id, icon, title, body, cta, kind, data }
  GT.coachActions = function (st) {
    var out = [], plan = st.plan, today = GT.todayISO();
    if (!plan || !st.profile) return out;
    var cw = GT.cycleWeek(plan, today);
    // 1. Lifts ready for more load
    plan.days.forEach(function (day) {
      day.ex.forEach(function (x) {
        var t = GT.targetFor(plan, x, today), s = GT.suggestion(st, x, t.rpe);
        if (s.up && s.w) {
          // id includes the load: each new increase is a new card, even after an earlier "Ok"
          out.push({ id: 'load-' + x.id + '-' + s.w + '-' + s.r, icon: 'ph-light ph-trend-up', title: 'Aumenta il carico · ' + GT.EXI[x.id].n, body: s.why + ' Prossima volta ' + GT.fmtKg(s.w) + ' kg × ' + s.r + '.', cta: 'Ok', kind: 'info' });
        }
      });
    });
    // 2. Muscles under the minimum effective volume in the plan
    // (at most the two furthest below their minimum, so the list stays short)
    var ps = GT.plannedSets(plan);
    GT.MUSCLES.filter(function (m) { return ps[m.k] > 0 && ps[m.k] < m.mev; })
      .sort(function (a, b) { return ps[a.k] / a.mev - ps[b.k] / b.mev; }).slice(0, 2)
      .forEach(function (m) {
        out.push({ id: 'vol-' + m.k, icon: 'ph-light ph-stack', title: 'Più volume: ' + m.n, body: 'Il piano prevede ' + GT.fmt(ps[m.k]) + ' serie a settimana, sotto il minimo efficace di ' + m.mev + '. Aggiungo 1 serie a un esercizio per ' + m.n.toLowerCase() + '.', cta: 'Aggiungi', kind: 'addSet', data: { muscle: m.k } });
      });
    // 3. Deload next week
    var nextIdx = (cw.index + 1) % plan.cycleWeeks;
    if (GT.isDeloadWeek(plan, nextIdx) && nextIdx !== cw.index) out.push({ id: 'deload-' + cw.cycle + '-' + nextIdx, icon: 'ph-light ph-battery-medium', title: 'Scarico la prossima settimana', body: 'Settimana ' + (nextIdx + 1) + ': ' + GT.deloadText(plan, nextIdx) + ' Consolida il lavoro delle ultime settimane.', cta: 'Ok', kind: 'info' });
    // 4. Protein under target on most logged days
    var adh = GT.adherence(st).filter(function (a) { return a.logged; });
    var lowP = adh.filter(function (a) { return st.targets && a.prot < st.targets.p * 0.9; }).length;
    if (adh.length >= 3 && lowP >= Math.ceil(adh.length / 2)) out.push({ id: 'prot-' + GT.mondayOf(today), icon: 'ph-light ph-egg', title: 'Proteine sotto target', body: lowP + ' giorni su ' + adh.length + ' sotto ' + st.targets.p + ' g. Aggiungi uno spuntino da 25–30 g (yogurt greco, whey, fiocchi di latte).', cta: 'Ok', kind: 'info' });
    // 5. No weigh-in for a week
    var ws = logsOf(st).weights || [];
    if (!ws.length || ws[ws.length - 1].date < GT.addDays(today, -7)) out.push({ id: 'weigh-' + GT.mondayOf(today), icon: 'ph-light ph-scales', title: 'Registra il peso', body: 'Pesati al mattino, a digiuno, 2–3 volte a settimana: la media guida le calorie del piano.', cta: 'Registra', kind: 'weigh' });
    return out.filter(function (a) { return !(st.coach && st.coach[a.id]); });
  };
})();
