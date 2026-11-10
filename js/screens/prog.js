/* GreyTraining — tab "Progressi" (Corpo / Forza / Review).
   Port of design-reference/GreyTraining.dc.html lines 428-486 and the progress part of renderVals(). */
(function () {
  'use strict';
  var GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  const fmt = GT.fmt;
  const RANGE_LABEL = { '4S': '4 settimane', '12S': '12 settimane', '6M': '6 mesi' };

  const MEASURES = [['Vita', '82,0', '−1,5'], ['Petto', '104,5', '+0,5'], ['Braccio', '38,0', '+0,5'], ['Coscia', '59,5', '±0']].map(([n, v, d]) => ({ n, v, d }));
  const PHOTO_SLOTS = ['Fronte', 'Lato', 'Retro'];
  const REVIEW_STATS = [{ l: 'Sessioni', v: '4 / 4', s: 'aderenza 100%' }, { l: 'Serie allenanti', v: '68', s: '+8% vs S2' }, { l: 'Aderenza dieta', v: '86%', s: 'kcal ±10%' }, { l: 'Peso', v: '−0,3 kg', s: 'media settimanale' }];
  const REVIEW_NOTES = [{ icon: 'ph-light ph-trend-up', t: 'Panca e rematore: +2,5 kg a parità di RPE.' }, { icon: 'ph-light ph-warning', t: 'Femorali e polpacci sotto il volume minimo.' }, { icon: 'ph-light ph-egg', t: 'Proteine sotto target in 3 giorni su 7.' }];
  const FUTURE_CARDS = [
    { t: 'Carico di allenamento complessivo', src: 'Strava · in arrivo', d: 'Palestra + corsa e bici in un unico carico settimanale, per dosare volume e intensità.', bars: ['30%', '45%', '38%', '60%', '52%', '70%', '40%'] },
    { t: 'Trend di recupero', src: 'Garmin · in arrivo', d: 'HRV, sonno e FC a riposo su 4 settimane. Oggi la readiness usa solo il check-in manuale.', bars: ['55%', '50%', '62%', '58%', '66%', '60%', '64%'] }
  ];

  // Three horizontal guide lines of the 326×140 charts
  const guides = () => html`<line x1="0" y1="35" x2="326" y2="35" style="stroke:var(--c-line)"></line><line x1="0" y1="70" x2="326" y2="70" style="stroke:var(--c-line)"></line><line x1="0" y1="105" x2="326" y2="105" style="stroke:var(--c-line)"></line>`;

  function corpo(st) {
    const wArr = st.range === '4S' ? GT.W12.slice(-4) : st.range === '6M' ? GT.W6M : GT.W12;
    const wc = GT.chart(wArr, 326, 140);
    const rangeChips = ui.seg(['4S', '12S', '6M'], st.range, x => GT.set({ range: x }));
    const weightDelta = `${fmt(wArr[wArr.length - 1] - wArr[0])} kg in ${RANGE_LABEL[st.range] || '12 settimane'} · −0,3 kg/sett.`;
    const weightBtn = st.weightLogged ? 'Peso di oggi registrato · 78,3 kg' : 'Registra peso di oggi';
    return html`
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div style="font-size:.75rem;color:var(--c-fg3)">Peso · media 7 gg</div><div style="font-size:2.5rem;font-weight:900;letter-spacing:-.03em;line-height:1.05;font-variant-numeric:tabular-nums">78,4 <span style="font-size:1rem;font-weight:700;color:var(--c-fg2)">kg</span></div><div style="font-size:.8125rem;color:var(--c-fg2);font-variant-numeric:tabular-nums">${weightDelta}</div></div>
          <div style="display:flex;gap:2px;background:var(--c-s2);border-radius:8px;padding:3px">${rangeChips.map(c => html`<button key=${c.label} onClick=${c.go} aria-pressed=${c.active} style=${`height:32px;padding:0 10px;border-radius:6px;font-size:.75rem;font-weight:800;background:${c.bg};color:${c.fg}`}>${c.label}</button>`)}</div></div>
        <svg viewBox="0 0 326 140" width="100%" height="140" preserveAspectRatio="none" style="overflow:visible">${guides()}<path d=${wc.area} style="fill:var(--c-s2)"></path><path d=${wc.line} fill="none" style="stroke:var(--c-acc)" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path><circle cx=${wc.lx} cy=${wc.ly} r="5" style="fill:var(--c-acc)"></circle></svg>
        <button onClick=${A.logWeight} style="height:52px;border-radius:12px;background:var(--c-s2);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-light ph-plus" style="font-size:18px"></i>${weightBtn}</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${MEASURES.map(m => html`<div key=${m.n} style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:12px 14px"><div style="font-size:.75rem;color:var(--c-fg3)">${m.n}</div><div style="font-size:1.375rem;font-weight:900;font-variant-numeric:tabular-nums">${m.v} <span style="font-size:.75rem;font-weight:600;color:var(--c-fg3)">cm</span></div><div style="font-size:.75rem;font-weight:700;color:var(--c-fg2);font-variant-numeric:tabular-nums">${m.d} in 4 sett.</div></div>`)}
      </div>
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3)">Foto di progresso</span><span style="font-size:.75rem;color:var(--c-fg3)">Ultime: 13 ott</span></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${PHOTO_SLOTS.map(p => html`<div key=${p} style="aspect-ratio:3/4;border-radius:10px;border:1px dashed var(--c-s3);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--c-fg3)"><i class="ph-light ph-camera" style="font-size:22px"></i><span style="font-size:.75rem;font-weight:700">${p}</span></div>`)}</div>
        <div style="font-size:.8125rem;color:var(--c-fg3)">Stessa luce, stessa posa, ogni 4 settimane. Le foto restano sul dispositivo.</div>
      </div>`;
  }

  function forzaB() {
    const liftTiles = Object.entries(GT.STR).map(([n, a]) => ({ n, v: fmt(a[a.length - 1]), d: `+${fmt(a[a.length - 1] - a[0])}`, p: GT.chart(a, 140, 40).line }));
    return html`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${liftTiles.map(l => html`<div key=${l.n} style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:6px"><span style="font-size:.8125rem;font-weight:800">${l.n}</span><span style="font-size:1.75rem;font-weight:900;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1">${l.v}<span style="font-size:.75rem;font-weight:700;color:var(--c-fg3)"> kg</span></span><span style="font-size:.75rem;font-weight:800;color:var(--c-acc-t);font-variant-numeric:tabular-nums">${l.d} · 8 sett.</span><svg viewBox="0 0 140 40" width="100%" height="40" preserveAspectRatio="none"><path d=${l.p} fill="none" style="stroke:var(--c-acc)" stroke-width="2" vector-effect="non-scaling-stroke"></path></svg></div>`)}
      </div>
      <div style="font-size:.75rem;color:var(--c-fg3);padding:0 4px">1RM stimato con formula di Epley dalla miglior serie di ogni sessione.</div>`;
  }

  function forzaA(st) {
    const sArr = GT.STR[st.strEx] || GT.STR.Panca, sc = GT.chart(sArr, 326, 140);
    const strChips = ui.chip(Object.keys(GT.STR), st.strEx, x => GT.set({ strEx: x }));
    const strNow = fmt(sArr[sArr.length - 1]);
    const strDelta = `+${fmt(sArr[sArr.length - 1] - sArr[0])} kg in 8 settimane`;
    const prList = [['Panca piana', st.workoutDone ? '82,5 × 8' : '80 × 8', st.workoutDone ? 'Oggi' : '3 nov'], ['Squat', '130 × 5', '2 nov'], ['Stacco da terra', '160 × 5', '28 ott'], ['Trazioni zavorrate', '+12,5 × 5', '20 ott']]
      .map(([ex, v, d], i) => ({ ex, v, d, ic: (i === 0 && st.workoutDone) ? 'var(--c-acc-t)' : 'var(--c-fg2)' }));
    return html`
      <div style="flex:none;display:flex;gap:6px;overflow-x:auto;margin:0 -16px;padding:0 16px">${strChips.map(c => html`<button key=${c.label} onClick=${c.go} aria-pressed=${c.active} style=${`flex:none;height:40px;padding:0 14px;border-radius:999px;font-size:.8125rem;font-weight:800;background:${c.bg};color:${c.fg};border:1px solid var(--c-s3)`}>${c.label}</button>`)}</div>
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
        <div><div style="font-size:.75rem;color:var(--c-fg3)">1RM stimato (Epley)</div><div style="font-size:2.5rem;font-weight:900;letter-spacing:-.03em;line-height:1.05;font-variant-numeric:tabular-nums">${strNow} <span style="font-size:1rem;font-weight:700;color:var(--c-fg2)">kg</span></div><div style="font-size:.8125rem;color:var(--c-fg2)">${strDelta}</div></div>
        <svg viewBox="0 0 326 140" width="100%" height="140" preserveAspectRatio="none" style="overflow:visible">${guides()}<path d=${sc.line} fill="none" style="stroke:var(--c-acc)" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path><circle cx=${sc.lx} cy=${sc.ly} r="5" style="fill:var(--c-acc)"></circle></svg>
        <div style="display:flex;justify-content:space-between;font-size:.6875rem;color:var(--c-fg3)"><span>8 sett. fa</span><span>oggi</span></div>
      </div>
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:6px 16px">
        <div style="padding:10px 0;font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3)">Record personali</div>
        ${prList.map(p => html`<div key=${p.ex} style="display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--c-line)"><i class="ph-light ph-trophy" style=${`font-size:20px;color:${p.ic}`}></i><div><div style="font-weight:700;font-size:.9375rem">${p.ex}</div><div style="font-size:.75rem;color:var(--c-fg3)">${p.d}</div></div><span style="font-weight:900;font-variant-numeric:tabular-nums">${p.v}</span></div>`)}
      </div>`;
  }

  function review() {
    return html`
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:14px">
        <div><div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3)">Review settimanale</div><div style="font-size:1.25rem;font-weight:900;margin-top:2px">Settimana 3 · 3–9 nov</div></div>
        <div style="flex:none;display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--c-line);border-radius:10px;overflow:hidden">
          ${REVIEW_STATS.map(r => html`<div key=${r.l} style="background:var(--c-s1);padding:12px"><div style="font-size:.75rem;color:var(--c-fg3)">${r.l}</div><div style="font-size:1.5rem;font-weight:900;font-variant-numeric:tabular-nums">${r.v}</div><div style="font-size:.75rem;color:var(--c-fg2)">${r.s}</div></div>`)}
        </div>
        ${REVIEW_NOTES.map(n => html`<div key=${n.t} style="display:flex;gap:10px;font-size:.9375rem;line-height:1.45"><i class=${n.icon} style="font-size:18px;margin-top:2px;flex:none"></i><span>${n.t}</span></div>`)}
      </div>
      ${FUTURE_CARDS.map(f => html`
        <div key=${f.t} style="border:1px dashed var(--c-s3);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:800">${f.t}</span><span style="font-size:.6875rem;font-weight:700;padding:4px 8px;border-radius:999px;background:var(--c-s2);color:var(--c-fg2)">${f.src}</span></div>
          <div style="height:56px;display:flex;align-items:flex-end;gap:4px">${f.bars.map((b, i) => html`<div key=${i} style=${`flex:1;border-radius:3px;background:var(--c-s2);height:${b}`}></div>`)}</div>
          <div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.4">${f.d}</div>
        </div>`)}`;
  }

  GT.screens.prog = function (st, d) {
    const vB = GT.v('vProg') === 'B';
    const progSegs = ui.seg([['corpo', 'Corpo'], ['forza', 'Forza'], ['review', 'Review']], st.progSub, x => GT.set({ progSub: x }));
    const isCorpo = st.progSub === 'corpo', isForza = st.progSub === 'forza' && !vB, isForzaB = st.progSub === 'forza' && vB, isReview = st.progSub === 'review';
    return html`<div class="scroll" style=${S.tabScroll}>
      ${ui.header('12 settimane', 'Progressi')}
      <div style="display:flex;gap:4px;padding:4px;background:var(--c-s2);border-radius:12px">
        ${progSegs.map(s => html`<button key=${s.label} onClick=${s.go} aria-pressed=${s.active} style=${`flex:1;height:40px;border-radius:9px;font-weight:800;font-size:.875rem;background:${s.bg};color:${s.fg}`}>${s.label}</button>`)}
      </div>
      ${isCorpo ? corpo(st) : null}
      ${isForzaB ? forzaB() : null}
      ${isForza ? forzaA(st) : null}
      ${isReview ? review() : null}
    </div>`;
  };
})();
