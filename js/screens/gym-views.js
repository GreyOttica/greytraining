/* GreyTraining — gym full-screen views: exercise detail and plan editor (Upper A).
   Port of design-reference/GreyTraining.dc.html lines 283-313 and the matching renderVals()
   (exL / exE / exD, exCues, exAlts, editorRows, editorTotal, goLibFromEditor). */
(function () {
  'use strict';
  var GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  const fmt = GT.fmt, mmss = GT.mmss;

  // ---------- Exercise detail ----------
  GT.screens.exDetail = function (st, d) {
    const exL = GT.LIB.find(x => x.id === st.exDetail) || GT.LIB[0];
    const exE = GT.EX.find(e => e.id === st.exDetail);
    const exD = Object.assign({}, exL, {
      e1: exE ? `${fmt(GT.best(exE))} kg` : '—',
      best: exE ? `${fmt(exE.last[0][0])} × ${exE.last[0][1]}` : '—'
    });
    const exCues = (GT.CUES[exL.id] || GT.CUES._).map((t, i) => ({ n: i + 1, t }));
    const exAlts = GT.LIB.filter(x => x.m === exL.m && x.id !== exL.id).slice(0, 3).map(x => ({
      id: x.id, n: x.n, eq: x.eq, label: 'Sostituisci',
      swap: () => A.toast('info', 'Esercizio sostituito', `${x.n} al posto di ${exL.n}`)
    }));

    return html`<div class="scroll" style="position:absolute;inset:0;z-index:20;background:var(--c-bg);overflow-y:auto;padding:var(--top) 0 calc(var(--pb) + 6px);display:flex;flex-direction:column">
<div style="display:flex;align-items:center;padding:4px 8px"><button onClick=${A.closeAllenView} style="height:44px;padding:0 8px;display:flex;align-items:center;gap:4px;font-weight:700;color:var(--c-fg2)"><i class="ph-light ph-caret-left" style="font-size:22px"></i>Indietro</button></div>
<div style="aspect-ratio:16/9;background:var(--c-s2);display:grid;place-items:center;position:relative"><div style="display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--c-fg3)"><span style="width:64px;height:64px;border-radius:50%;background:var(--c-acc);color:var(--c-on-acc);display:grid;place-items:center"><i class="ph-fill ph-play" style="font-size:26px"></i></span><span style="font-size:.8125rem">Video esecuzione · 0:42</span></div></div>
<div style="padding:16px;display:flex;flex-direction:column;gap:16px">
<div><div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3)">${exD.m} · ${exD.eq}</div><h2 style="margin:4px 0 0;font-size:1.625rem;font-weight:900;letter-spacing:-.02em">${exD.n}</h2></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:12px"><div style="font-size:.75rem;color:var(--c-fg3)">1RM stimato</div><div style="font-size:1.5rem;font-weight:900;font-variant-numeric:tabular-nums">${exD.e1}</div></div><div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:12px"><div style="font-size:.75rem;color:var(--c-fg3)">Miglior serie</div><div style="font-size:1.5rem;font-weight:900;font-variant-numeric:tabular-nums">${exD.best}</div></div></div>
<div><div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3);margin-bottom:8px">Punti tecnici</div>
${exCues.map(c => html`<div key=${c.n} style="display:flex;gap:10px;padding:8px 0;font-size:.9375rem;line-height:1.4;border-bottom:1px solid var(--c-line)"><span style="font-weight:900;font-variant-numeric:tabular-nums;color:var(--c-fg3)">${c.n}</span>${c.t}</div>`)}</div>
<div><div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3);margin-bottom:8px">Alternative</div>
${exAlts.map(a => html`<div key=${a.id} style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--c-line)"><div><div style="font-weight:700">${a.n}</div><div style="font-size:.8125rem;color:var(--c-fg3)">${a.eq}</div></div><button onClick=${a.swap} style="height:40px;padding:0 14px;border-radius:999px;background:var(--c-s2);font-size:.8125rem;font-weight:800;display:flex;gap:6px;align-items:center"><i class="ph-light ph-swap" style="font-size:16px"></i>${a.label}</button></div>`)}</div>
</div>
</div>`;
  };

  // ---------- Plan editor (Upper A) ----------
  // Set stepper: 1-8 sets per exercise, as in the prototype
  const stepSets = (i, delta) => GT.set(x => ({
    editor: x.editor.map((y, j) => j === i ? Object.assign({}, y, { sets: Math.min(8, Math.max(1, y.sets + delta)) }) : y)
  }));
  const goLibFromEditor = () => GT.set({ allenView: null, allenSub: 'libreria', tab: 'allen' });

  GT.screens.editor = function (st, d) {
    const editorRows = st.editor.map((e, i) => Object.assign({}, e, {
      rest: mmss(e.rest),
      dec: () => stepSets(i, -1),
      inc: () => stepSets(i, 1)
    }));
    const editorTotal = `${st.editor.length} esercizi · ${st.editor.reduce((a, e) => a + e.sets, 0)} serie · ~${Math.round(st.editor.reduce((a, e) => a + e.sets * (e.rest + 45), 0) / 60)} min`;

    return html`<div class="scroll" style="position:absolute;inset:0;z-index:20;background:var(--c-bg);overflow-y:auto;padding:var(--top) 16px calc(var(--pb) + 86px);display:flex;flex-direction:column;gap:12px">
<div style="display:flex;align-items:center;justify-content:space-between;margin:0 -8px"><button onClick=${A.closeAllenView} style="height:44px;padding:0 8px;display:flex;align-items:center;gap:4px;font-weight:700;color:var(--c-fg2)"><i class="ph-light ph-caret-left" style="font-size:22px"></i>Scheda</button><button onClick=${A.closeAllenView} style="height:44px;padding:0 12px;font-weight:900;color:var(--c-acc-t)">Salva</button></div>
<div><div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3)">Modifica giorno</div><h2 style="margin:4px 0 0;font-size:1.75rem;font-weight:900;letter-spacing:-.02em">Upper A</h2><div style="font-size:.875rem;color:var(--c-fg3);margin-top:4px">${editorTotal}</div></div>
${editorRows.map(e => html`<div key=${e.id} style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:12px 12px 12px 6px;display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:center">
<i class="ph-light ph-dots-six-vertical" style="font-size:22px;color:var(--c-fg3);cursor:grab"></i>
<div style="min-width:0"><div style="font-weight:800;font-size:.9375rem">${e.name}</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">${e.reps} rip · RPE ${e.eff} · rec. ${e.rest}</div></div>
<div style="display:flex;align-items:center;gap:2px;background:var(--c-s2);border-radius:10px"><button onClick=${e.dec} aria-label="Meno serie" style="width:40px;height:44px;display:grid;place-items:center"><i class="ph-light ph-minus" style="font-size:18px"></i></button><span style="min-width:34px;text-align:center;font-weight:900;font-variant-numeric:tabular-nums">${e.sets}×</span><button onClick=${e.inc} aria-label="Più serie" style="width:40px;height:44px;display:grid;place-items:center"><i class="ph-light ph-plus" style="font-size:18px"></i></button></div>
</div>`)}
<button onClick=${goLibFromEditor} style="height:56px;border-radius:12px;border:1px dashed var(--c-s3);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-light ph-plus" style="font-size:18px"></i>Aggiungi esercizio</button>
</div>`;
  };
})();
