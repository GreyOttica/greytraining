/* GreyTraining — tab "Oggi" (variants A and B, chosen with ?vOggi=A|B).
   Port of design-reference/GreyTraining.dc.html lines 62-158 and the matching renderVals(). */
(function () {
  'use strict';
  const GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  // Static recovery placeholders until Garmin is connected (renderVals: recoveryTiles)
  const RECOVERY_TILES = [
    { icon: 'ph-light ph-moon', label: 'Sonno', unit: 'h' },
    { icon: 'ph-light ph-wave-sine', label: 'HRV', unit: 'ms' },
    { icon: 'ph-light ph-heartbeat', label: 'FC riposo', unit: 'bpm' }
  ];

  const openProfile = () => GT.set({ overlay: 'profile' });
  const openReadiness = () => GT.set({ overlay: 'readiness' });
  const goNutri = () => GT.set({ tab: 'nutri' });

  function oggiA(st, d, v) {
    return html`<div class="scroll" style=${S.tabScroll}>
      <header style="display:flex;justify-content:space-between;align-items:flex-start;padding:4px 4px 6px">
        <div><div style=${S.eyebrow}>Martedì 10 novembre</div><h1 style=${S.h1}>Oggi</h1></div>
        <button onClick=${openProfile} aria-label="Profilo" style="width:48px;height:48px;border-radius:50%;background:var(--c-s2);display:grid;place-items:center;font-weight:900;font-size:.9375rem">GT</button>
      </header>
      <button onClick=${openReadiness} style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:14px 16px;display:grid;grid-template-columns:64px 1fr auto;gap:14px;align-items:center;text-align:left">
        <div style="position:relative;width:64px;height:64px">
          <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="none" style="stroke:var(--c-s3)" stroke-width="6"></circle><circle cx="32" cy="32" r="28" fill="none" style="stroke:var(--c-acc)" stroke-width="6" stroke-linecap="round" stroke-dasharray="175.9" stroke-dashoffset=${d.readyOffset} transform="rotate(-90 32 32)"></circle></svg>
          <div style="position:absolute;inset:0;display:grid;place-items:center;font-size:1.25rem;font-weight:900;font-variant-numeric:tabular-nums">${d.score}</div>
        </div>
        <div><div style=${S.eyebrow}>Readiness</div><div style="font-size:1.125rem;font-weight:800;margin-top:2px">${d.readyLabel}</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">Check-in manuale · Garmin in arrivo</div></div>
        <i class="ph-light ph-caret-right" style="font-size:20px;color:var(--c-fg3)"></i>
      </button>
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:18px 16px 16px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:center"><div style=${S.eyebrow}>Allenamento · Settimana 3 di 5</div><span style="font-size:.75rem;font-weight:700;color:var(--c-fg2)">RPE 8</span></div>
        <div><div style="font-size:1.75rem;font-weight:900;letter-spacing:-.02em;line-height:1.1">Upper A</div><div style="font-size:.9375rem;color:var(--c-fg2);margin-top:4px">6 esercizi · 18 serie · ~65 min</div></div>
        <div style="display:flex;flex-direction:column;border-top:1px solid var(--c-line)">
          ${v.todayEx.map(e => html`<div key=${e.name} style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--c-line);font-size:.9375rem"><span style="font-weight:600">${e.name}</span><span style="color:var(--c-fg3);font-variant-numeric:tabular-nums;white-space:nowrap">${e.target}</span></div>`)}
          <div style="padding-top:10px;font-size:.8125rem;color:var(--c-fg3)">+ altri 3 esercizi</div>
        </div>
        ${v.notDone ? ui.cta(d.startLabel, A.startSession, { icon: 'ph-fill ph-play' }) : null}
        ${v.workoutDone ? html`<div style="height:60px;border-radius:12px;background:var(--c-s2);display:flex;align-items:center;gap:12px;padding:0 16px"><span style="width:28px;height:28px;border-radius:50%;background:var(--c-acc);color:var(--c-on-acc);display:grid;place-items:center"><i class="ph-bold ph-check" style="font-size:16px"></i></span><span style="font-weight:800">Completato</span><span style="margin-left:auto;color:var(--c-fg2);font-size:.875rem;font-variant-numeric:tabular-nums">${v.doneLine}</span></div>` : null}
      </div>
      ${ui.coachCard('Coach', d.coachTip)}
      <button onClick=${goNutri} style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:12px;text-align:left">
        <div style="display:flex;justify-content:space-between;width:100%"><span style=${S.eyebrow}>Macro rimanenti</span><span style="font-size:.8125rem;color:var(--c-fg3);font-variant-numeric:tabular-nums">${d.kcalEatenLine}</span></div>
        <div style="display:flex;align-items:baseline;gap:6px"><span style="font-size:2.5rem;font-weight:900;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums">${d.kcalLeft}</span><span style="font-size:.9375rem;color:var(--c-fg2);font-weight:600">kcal</span></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;width:100%">
          ${d.macros.map(m => html`<div key=${m.label} style="display:flex;flex-direction:column;gap:6px"><span style="font-size:.75rem;color:var(--c-fg3)">${m.label}</span><span style="font-size:1.0625rem;font-weight:800;font-variant-numeric:tabular-nums">${m.left} g</span><div style="height:4px;border-radius:2px;background:var(--c-s3);overflow:hidden"><div style=${`height:4px;background:var(--c-acc);width:${m.pct}`}></div></div></div>`)}
        </div>
      </button>
      <div style="border:1px dashed var(--c-s3);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:center"><span style=${S.eyebrow}>Recupero</span>${ui.soon('Garmin · in arrivo')}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          ${RECOVERY_TILES.map(r => html`<div key=${r.label} style="display:flex;flex-direction:column;gap:4px"><i class=${r.icon} style="font-size:20px;color:var(--c-fg3)"></i><span style="font-size:.75rem;color:var(--c-fg3)">${r.label}</span><span style="font-size:1.125rem;font-weight:800;color:var(--c-fg3)">— <span style="font-size:.75rem;font-weight:600">${r.unit}</span></span></div>`)}
        </div>
        <button onClick=${openProfile} style="font-size:.8125rem;color:var(--c-fg2);text-align:left;line-height:1.4">Con Garmin il check-in manuale viene sostituito da sonno, HRV e FC a riposo. <span style="font-weight:800;color:var(--c-fg);text-decoration:underline">Integrazioni</span></button>
      </div>
    </div>`;
  }

  function oggiB(st, d, v) {
    return [
      html`<div key="oggiB" class="scroll" style="position:absolute;inset:0;overflow-y:auto;padding:calc(var(--top) + 8px) 0 calc(var(--tabH) + 100px);display:flex;flex-direction:column">
        <header style="display:flex;justify-content:space-between;align-items:center;padding:4px 20px 12px"><div style=${S.eyebrow}>Mar 10 nov · Settimana 3 di 5</div><button onClick=${openProfile} aria-label="Profilo" style="width:44px;height:44px;border-radius:50%;background:var(--c-s2);display:grid;place-items:center;font-weight:900;font-size:.875rem">GT</button></header>
        <div style="padding:4px 20px 24px;border-bottom:1px solid var(--c-line)">
          <div style="font-size:4rem;font-weight:900;letter-spacing:-.04em;line-height:.92">Upper A</div>
          <div style="display:flex;gap:20px;margin-top:16px">
            <div><div style="font-size:1.75rem;font-weight:900;font-variant-numeric:tabular-nums">6</div><div style="font-size:.75rem;color:var(--c-fg3)">esercizi</div></div>
            <div><div style="font-size:1.75rem;font-weight:900;font-variant-numeric:tabular-nums">18</div><div style="font-size:.75rem;color:var(--c-fg3)">serie</div></div>
            <div><div style="font-size:1.75rem;font-weight:900;font-variant-numeric:tabular-nums">65'</div><div style="font-size:.75rem;color:var(--c-fg3)">stimati</div></div>
            <div><div style="font-size:1.75rem;font-weight:900;font-variant-numeric:tabular-nums">8</div><div style="font-size:.75rem;color:var(--c-fg3)">RPE target</div></div>
          </div>
          <p style="margin:16px 0 0;font-size:.9375rem;line-height:1.45;color:var(--c-fg2);text-wrap:pretty">${d.coachTip}</p>
        </div>
        <button onClick=${openReadiness} style="display:grid;grid-template-columns:repeat(4,1fr);padding:16px 20px;border-bottom:1px solid var(--c-line);text-align:left">
          <div><div style="font-size:.6875rem;color:var(--c-fg3)">Readiness</div><div style="font-size:1.375rem;font-weight:900;font-variant-numeric:tabular-nums">${d.score}</div></div>
          <div><div style="font-size:.6875rem;color:var(--c-fg3)">Sonno</div><div style="font-size:1.375rem;font-weight:900;color:var(--c-fg3)">—</div></div>
          <div><div style="font-size:.6875rem;color:var(--c-fg3)">HRV</div><div style="font-size:1.375rem;font-weight:900;color:var(--c-fg3)">—</div></div>
          <div><div style="font-size:.6875rem;color:var(--c-fg3)">FC riposo</div><div style="font-size:1.375rem;font-weight:900;color:var(--c-fg3)">—</div></div>
        </button>
        <button onClick=${goNutri} style="padding:16px 20px;border-bottom:1px solid var(--c-line);display:flex;flex-direction:column;gap:10px;text-align:left">
          <div style="display:flex;justify-content:space-between;width:100%;align-items:baseline"><span style=${S.eyebrow}>Rimanenti</span><span style="font-size:1.375rem;font-weight:900;font-variant-numeric:tabular-nums">${d.kcalLeft} <span style="font-size:.8125rem;font-weight:600;color:var(--c-fg2)">kcal</span></span></div>
          <div style="display:flex;gap:2px;height:8px;width:100%;border-radius:4px;overflow:hidden;background:var(--c-s3)"><div style=${`background:var(--c-acc);width:${d.kcalPct}`}></div></div>
          <div style="display:flex;gap:16px;font-size:.875rem;color:var(--c-fg2);font-variant-numeric:tabular-nums">${d.macros.map(m => html`<span key=${m.short}><b style="color:var(--c-fg)">${m.left}</b> ${m.short}</span>`)}</div>
        </button>
        <div style="padding:16px 20px;display:flex;flex-direction:column;gap:2px">
          <div style=${S.eyebrow + ';margin-bottom:6px'}>In programma</div>
          ${v.todayExAll.map(e => html`<div key=${e.n} style="display:flex;justify-content:space-between;padding:8px 0;font-size:.9375rem"><span><span style="color:var(--c-fg3);font-variant-numeric:tabular-nums;margin-right:10px">${e.n}</span>${e.name}</span><span style="color:var(--c-fg3);font-variant-numeric:tabular-nums">${e.target}</span></div>`)}
        </div>
      </div>`,
      html`<div key="oggiBBar" style="position:absolute;left:0;right:0;bottom:var(--tabH);padding:12px 16px;background:var(--c-bg);border-top:1px solid var(--c-line);z-index:25">
        ${v.notDone ? ui.cta(d.startLabel, A.startSession, { h: 64, icon: 'ph-fill ph-play' }) : null}
        ${v.workoutDone ? html`<div style="height:64px;border-radius:14px;background:var(--c-s2);display:flex;align-items:center;justify-content:center;gap:10px;font-weight:800"><i class="ph-bold ph-check" style="font-size:18px"></i>Completato · ${v.doneLine}</div>` : null}
      </div>`
    ];
  }

  GT.screens.oggi = function (st, d) {
    const v = {
      notDone: !st.workoutDone,
      workoutDone: st.workoutDone,
      doneLine: st.doneLine,
      todayEx: GT.EX.slice(0, 3).map(e => ({ name: e.name, target: `${e.sets} × ${e.reps}` })),
      todayExAll: GT.EX.map((e, i) => ({ n: String(i + 1).padStart(2, '0'), name: e.name, target: `${e.sets} × ${e.reps}` }))
    };
    return GT.v('vOggi') === 'B' ? oggiB(st, d, v) : oggiA(st, d, v);
  };
})();
