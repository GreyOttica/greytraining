/* GreyTraining — "Importa scheda" (full screen, st.allenView === 'import').
   Pick a .json file or paste the text an AI gave you, see a full preview of what will be imported
   (cycle, calendar, every exercise and how it was matched to the library), then apply.
   Transient state: st.imp = { plan, report, effort, name } | null, st.impErr = text | null. */
(function () {
  'use strict';
  var GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  // Prompt to ask an AI for a program the app can import
  var PROMPT = 'Scrivimi una scheda di allenamento in JSON, solo il JSON, con questo formato:\n'
    + '{ "schemaVersion": 1,\n  "program": { "name": "...", "goal": "...", "durationWeeks": 6, "notes": "..." },\n'
    + '  "progression": { "type": "double_progression", "loadIncreasePercent": { "min": 2.5, "max": 5 }, "rule": "..." },\n'
    + '  "weeks": [ { "week": 1, "type": "accumulo", "rir": { "compound": [2, 3], "isolation": [2, 3] } }, … , { "week": 6, "type": "scarico", "rir": { "compound": [3, 4], "isolation": [3, 4] }, "setsMultiplier": 0.5 } ],\n'
    + '  "weeklySchedule": [ { "day": "lunedi", "type": "gym", "sessionId": "upper-a" }, { "day": "martedi", "type": "run", "runId": "facile" }, { "day": "mercoledi", "type": "rest" } … ],\n'
    + '  "sessions": [ { "id": "upper-a", "name": "Upper A", "exercises": [ { "order": 1, "name": "Panca piana bilanciere", "category": "compound", "muscles": ["petto"], "sets": 4, "repMin": 6, "repMax": 8, "restSec": 150 } ] } ],\n'
    + '  "runs": [ { "id": "facile", "name": "Corsa facile", "description": "..." } ],\n  "rules": [ "..." ] }';

  var pasteEl = null;
  var setErr = function (msg) { GT.set({ impErr: msg, imp: null }); };

  function analyze(text, name) {
    try {
      var json = GT.parseProgramText(text);
      var res = GT.importProgram(json, GT.state);
      var usesRir = Array.isArray(json.weeks) && json.weeks.some(function (w) { return w && w.rir; });
      GT.set({ imp: { plan: res.plan, report: res.report, effort: usesRir ? 'RIR' : GT.state.effort, name: name || null }, impErr: null });
    } catch (e) { setErr(e && e.message ? e.message : 'Non riesco a leggere il file.'); }
  }
  function onFile(e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 1024 * 1024) { setErr('Il file è troppo grande (massimo 1 MB).'); return; }
    var r = new FileReader();
    r.onload = function () { analyze(String(r.result || ''), f.name); };
    r.onerror = function () { setErr('Non riesco ad aprire il file.'); };
    r.readAsText(f);
    e.target.value = '';
  }
  function copyPrompt() {
    var done = function () { A.toast('set', 'Richiesta copiata', 'Incollala nella chat della tua AI'); };
    try { navigator.clipboard.writeText(PROMPT).then(done, function () { A.toast('info', 'Copia non riuscita', 'Seleziona il testo a mano'); }); }
    catch (e) { A.toast('info', 'Copia non riuscita', 'Seleziona il testo a mano'); }
  }
  var close = function () { GT.set({ allenView: null, imp: null, impErr: null }); };
  // Effort for a week: the file's own RIR range when there is one (e.g. "RIR 2–3"), else the mean
  var eff = function (rpe, mode, rir) {
    var r = rir && rir.length ? rir.slice().sort(function (a, b) { return a - b; }) : null;
    var lo = r ? r[0] : 10 - rpe, hi = r ? r[r.length - 1] : 10 - rpe;
    var txt = function (a, b) { return a === b ? GT.fmt(a) : GT.fmt(a) + '–' + GT.fmt(b); };
    return mode === 'RIR' ? 'RIR ' + txt(lo, hi) : 'RPE ' + txt(10 - hi, 10 - lo);
  };

  // ---------- pick / paste ----------
  function pickView(st) {
    return html`
      <div>
        <div style=${S.eyebrow}>Importa scheda</div>
        <h1 style=${S.h1}>Da un file o da un testo</h1>
        <p style="margin:6px 0 0;font-size:.9375rem;line-height:1.45;color:var(--c-fg2)">Usa la scheda che ti ha preparato un'AI o un coach, in formato JSON. Prima di applicarla vedi l'anteprima completa: il piano attuale resta salvato e puoi ripristinarlo.</p>
      </div>
      <label class="press" style="height:60px;border-radius:12px;background:var(--c-acc);color:var(--c-on-acc);font-size:1.0625rem;font-weight:900;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer">
        <i class="ph-bold ph-file-arrow-up" style="font-size:22px"></i>Scegli file .json
        <input type="file" accept=".json,.txt,application/json,text/plain" onChange=${onFile} style="display:none" />
      </label>
      <div style=${S.card + ';padding:14px 16px;display:flex;flex-direction:column;gap:10px'}>
        <div style=${S.eyebrow}>Oppure incolla il testo</div>
        <textarea ref=${function (el) { pasteEl = el; }} rows="6" placeholder='{ "schemaVersion": 1, "program": { … } }' aria-label="Testo della scheda" style="border-radius:12px;border:1px solid var(--c-s3);background:var(--c-s2);padding:12px;font-size:.875rem;line-height:1.4;outline:0;resize:vertical;font-family:ui-monospace,Menlo,Consolas,monospace;min-height:120px"></textarea>
        <button onClick=${function () { analyze(pasteEl ? pasteEl.value : ''); }} style="height:48px;border-radius:10px;background:var(--c-s2);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-light ph-magnifying-glass" style="font-size:18px"></i>Analizza</button>
      </div>
      ${st.impErr ? html`<div role="alert" style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:12px;background:var(--c-s2);font-size:.875rem;line-height:1.45"><i class="ph-light ph-warning-circle" style="font-size:20px;flex:none;color:var(--c-acc-t)"></i><span>${st.impErr}</span></div>` : null}
      <div style="border:1px dashed var(--c-s3);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:10px;align-items:flex-start"><i class="ph-light ph-chat-circle-dots" style="font-size:22px;color:var(--c-fg3);flex:none"></i>
          <div><div style="font-weight:800">Non hai ancora un JSON?</div><div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.45;margin-top:4px">Copia questa richiesta, incollala in ChatGPT, Gemini o Claude insieme alle tue indicazioni, poi salva la risposta come file .json o incollala qui sopra.</div></div></div>
        <button onClick=${copyPrompt} style="height:44px;border-radius:10px;border:1px solid var(--c-s3);font-weight:800;font-size:.875rem;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-light ph-copy" style="font-size:18px"></i>Copia la richiesta per l'AI</button>
      </div>`;
  }

  // ---------- preview ----------
  function preview(st) {
    var imp = st.imp, plan = imp.plan, rep = imp.report, mode = imp.effort;
    var matchOf = {};
    rep.matched.forEach(function (m) { matchOf[m.from] = m; });
    var nameOf = function (id) { return (plan.custom[id] || GT.EXI[id] || {}).n || id; };
    var cal = plan.week.map(function (w) {
      var items = w.items.map(function (it) {
        if (it.type === 'gym') { var d = plan.days.filter(function (x) { return x.id === it.id; })[0]; return { icon: 'ph-light ph-barbell', t: d ? d.name : it.id }; }
        var c = (plan.run && plan.run.sessions[it.id]) || (plan.swim && plan.swim.sessions[it.id]);
        return { icon: it.type === 'run' ? 'ph-light ph-person-simple-run' : 'ph-light ph-swimming-pool', t: c ? c.name + (c.km ? ' · ~' + GT.fmt(c.km) + ' km' : '') : it.id };
      });
      return { wd: w.wd, items: items };
    });
    var totalSets = plan.days.reduce(function (a, d) { return a + d.ex.reduce(function (b, x) { return b + x.sets; }, 0); }, 0);

    return html`
      <div>
        <div style=${S.eyebrow}>Anteprima${imp.name ? ' · ' + imp.name : ''}</div>
        <h1 style=${S.h1 + ';font-size:1.75rem'}>${plan.split}</h1>
        <div style="font-size:.875rem;color:var(--c-fg3);margin-top:4px">${plan.days.length} sedute · ${totalSets} serie a settimana · ciclo di ${plan.cycleWeeks} settimane${plan.deloadIndex < plan.cycleWeeks ? ' · scarico S' + (plan.deloadIndex + 1) : ''}</div>
      </div>
      ${plan.notes.length ? html`<div style=${S.card + ';padding:14px 16px;display:flex;flex-direction:column;gap:8px'}>${plan.notes.map(function (n, i) { return html`<div key=${'n' + i} style="display:flex;gap:10px;font-size:.875rem;line-height:1.45"><i class="ph-light ph-note" style="font-size:18px;flex:none;color:var(--c-fg3);margin-top:1px"></i><span>${n}</span></div>`; })}</div>` : null}

      <div style=${S.card + ';padding:14px 16px;display:flex;flex-direction:column;gap:12px'}>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style=${S.eyebrow}>Settimane</span>
          <div style="display:flex;gap:2px;background:var(--c-s2);border-radius:8px;padding:3px">${['RIR', 'RPE'].map(function (m) { return html`<button key=${m} onClick=${function () { GT.set({ imp: Object.assign({}, imp, { effort: m }) }); }} aria-pressed=${mode === m} style=${'height:30px;padding:0 10px;border-radius:6px;font-size:.75rem;font-weight:800;background:' + (mode === m ? 'var(--c-acc)' : 'transparent') + ';color:' + (mode === m ? 'var(--c-on-acc)' : 'var(--c-fg2)')}>${m}</button>`; })}</div></div>
        <div style="display:flex;flex-direction:column">${plan.weeksSpec.map(function (w, i) {
          return html`<div key=${'w' + i} style=${'display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;padding:8px 0;font-size:.8125rem;' + (i ? 'border-top:1px solid var(--c-line)' : '')}>
            <span style="font-weight:900">S${i + 1}</span><span style="text-transform:capitalize;color:var(--c-fg2)">${w.type}${w.setsMult !== 1 ? ' · serie ×' + GT.fmt(w.setsMult) : ''}</span>
            <span class="num" style="font-weight:800;white-space:nowrap">multi ${eff(w.rpeComp, mode, w.rirComp)} · iso ${eff(w.rpeIso, mode, w.rirIso)}</span></div>`;
        })}</div>
        ${plan.progression ? html`<div style="font-size:.8125rem;color:var(--c-fg2);line-height:1.45">Progressione: ${plan.progression.rule} (+${GT.fmt(plan.progression.pct[0])}–${GT.fmt(plan.progression.pct[1])}% arrotondato al disco disponibile).</div>` : null}
      </div>

      <div style=${S.card + ';padding:6px 16px'}>
        <div style=${S.eyebrow + ';padding:10px 0'}>Calendario</div>
        ${cal.map(function (c) { return html`<div key=${'c' + c.wd} style="display:grid;grid-template-columns:40px 1fr;gap:10px;padding:9px 0;border-top:1px solid var(--c-line);font-size:.875rem;align-items:center">
          <span style="font-weight:800;color:var(--c-fg3)">${GT.DAYS_SHORT[c.wd]}</span>
          <div style="display:flex;flex-direction:column;gap:3px">${c.items.length ? c.items.map(function (it, j) { return html`<span key=${j} style="display:flex;gap:6px;align-items:center"><i class=${it.icon} style="font-size:16px;color:var(--c-fg3)"></i>${it.t}</span>`; }) : html`<span style="color:var(--c-fg3)">Riposo</span>`}</div></div>`; })}
      </div>

      ${plan.days.map(function (d) {
        return html`<div key=${d.id} style=${S.card + ';padding:6px 16px'}>
          <div style="padding:10px 0"><div style="font-weight:900;font-size:1.0625rem">${d.name}</div>${d.notes.map(function (n, i) { return html`<div key=${i} style="font-size:.8125rem;color:var(--c-fg3);line-height:1.4;margin-top:4px">${n}</div>`; })}</div>
          ${d.ex.map(function (x, i) {
            var n = nameOf(x.id), m = matchOf[n], e = plan.custom[x.id];
            var tags = [x.minRir != null ? 'RIR min ' + x.minRir : '', x.superset ? 'Superset ' + x.superset : ''].filter(Boolean);
            return html`<div key=${x.id + i} style="padding:9px 0;border-top:1px solid var(--c-line);display:flex;flex-direction:column;gap:2px">
              <div style="display:flex;justify-content:space-between;gap:10px"><span style="font-weight:700;font-size:.9375rem">${n}</span><span class="num" style="font-size:.8125rem;color:var(--c-fg2);white-space:nowrap">${x.sets} × ${x.reps} · ${GT.mmss(x.rest)}</span></div>
              <div style="font-size:.75rem;color:${m && m.conf === 'media' ? 'var(--c-acc-t)' : 'var(--c-fg3)'}">${m ? '→ libreria: ' + m.to + (m.conf === 'media' ? ' · controlla l\'abbinamento' : '') : 'Nuovo esercizio · ' + (GT.MUSCLE_NAME[e && e.m] || 'muscolo non indicato')}${tags.length ? ' · ' + tags.join(' · ') : ''}</div>
            </div>`;
          })}
        </div>`;
      })}

      ${rep.warnings.length ? html`<div style="border:1px dashed var(--c-s3);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:8px">
        <div style=${S.eyebrow}>Da sapere</div>
        ${rep.warnings.map(function (w, i) { return html`<div key=${'x' + i} style="display:flex;gap:8px;font-size:.8125rem;line-height:1.45;color:var(--c-fg2)"><i class="ph-light ph-info" style="font-size:16px;flex:none;margin-top:1px"></i><span>${w}</span></div>`; })}
      </div>` : null}
      <div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.5;padding:0 4px">La settimana 1 parte da lunedì ${GT.fmtDay(plan.startDate)}. Restano i tuoi registri, il peso, la nutrizione e i target. Il piano attuale resta salvato: lo ripristini da Allena → Scheda.</div>
      <button onClick=${function () { GT.set({ imp: null, impErr: null }); }} style="height:48px;border-radius:12px;border:1px solid var(--c-s3);font-weight:800">Scegli un altro file</button>`;
  }

  GT.screens.importPlan = function (st) {
    var hasPrev = !!st.imp;
    return [
      html`<div key="imp-scroll" class="scroll" style=${S.full + ';padding:var(--top) 16px ' + (hasPrev ? 'calc(var(--pb) + 96px)' : 'calc(var(--pb) + 24px)') + ';display:flex;flex-direction:column;gap:14px'}>
        ${ui.back('Scheda', close)}
        ${hasPrev ? preview(st) : pickView(st)}
      </div>`,
      hasPrev ? html`<div key="imp-bar">${ui.bottomBar(ui.cta('Usa questa scheda', function () { A.applyImportedPlan(st.imp.plan, { effort: st.imp.effort }); GT.set({ imp: null, impErr: null }); }, { h: 64, icon: 'ph-bold ph-check', iconSize: 22 }))}</div>` : null
    ];
  };
})();
