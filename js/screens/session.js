/* GreyTraining — gym session (full screen) and session summary.
   Driven by st.s (running workout, see js/store.js) and st.summary (built by A.finishSession).
   Exercise data from GT.EXI, targets from s.tg, history from GT.lastPerformance / GT.suggestion.
   Visual language: design-reference/GreyTraining.dc.html (session + summary templates). */
(function () {
  'use strict';
  var GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  const fmt = GT.fmt, kg = GT.fmtKg, mmss = GT.mmss;
  const EFF_VALS = [6, 7, 8, 9, 10];
  const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'];

  // Two-tap confirm for "Annulla allenamento" (local UI state, re-rendered with GT.render)
  let armedAt = 0, armTimer = null;
  const isArmed = () => Date.now() - armedAt < 4000;
  function discardTap() {
    if (isArmed()) { armedAt = 0; clearTimeout(armTimer); A.discardSession(); return; }
    armedAt = Date.now();
    clearTimeout(armTimer);
    armTimer = setTimeout(() => { armedAt = 0; GT.render(); }, 4000);
    GT.render();
  }

  // Effort label for a target or logged value (RIR = 10 - RPE)
  const effTxt = (rir, rpe) => rir ? `RIR ${fmt(10 - rpe)}` : `RPE ${fmt(rpe)}`;
  // "82,5×8" for a set, "12 rip" for a bodyweight set without ballast
  const setTxt = l => l.w > 0 ? `${kg(l.w)}×${l.r}` : `${l.r} rip`;
  const topSet = sets => sets.reduce((a, b) => (b.w > a.w || (b.w === a.w && b.r > a.r)) ? b : a);
  const exOf = id => GT.EXI[id] || { id, n: id, m: '', req: [] };

  // Values of the running session
  function sessionVals(st) {
    const s = st.s, rir = st.effort === 'RIR';
    const exIdx = Math.max(0, Math.min(s.exIdx || 0, s.order.length - 1));
    const id = s.order[exIdx], ex = exOf(id);
    const tg = s.tg[id] || { sets: 3, lo: 8, hi: 10, reps: '8–10', rpe: 8, rest: 120 };
    const logs = s.logs[id] || [], allDone = logs.length >= tg.sets, isLast = exIdx === s.order.length - 1;
    const step = GT.loadStep(id), bw = step === 0;
    const last = GT.lastPerformance(st, id);
    const sg = GT.suggestion(st, { id, sets: tg.sets, lo: tg.lo, hi: tg.hi }, tg.rpe);
    const why = s.why || sg.why || '';
    const muscle = GT.MUSCLE_NAME[ex.m] || '';

    // weight shown for a value (null = not chosen yet)
    const wCell = w => w == null ? '—' : kg(w);
    const wWord = w => w == null ? 'carico da scegliere' : bw ? (w > 0 ? `corpo libero +${kg(w)} kg` : 'corpo libero') : `${kg(w)} kg`;

    const rows = [];
    for (let i = 0; i < Math.max(tg.sets, logs.length); i++) {
      const dn = logs[i], cur = i === logs.length, lp = last && last.sets[i];
      rows.push({
        n: i + 1, prev: lp ? setTxt(lp) : '—',
        w: dn ? wCell(dn.w) : cur ? wCell(s.w) : '–',
        r: dn ? dn.r : cur ? s.r : '–',
        e: dn ? (dn.e != null ? (rir ? fmt(10 - dn.e) : fmt(dn.e)) : '—') : cur ? (rir ? fmt(10 - s.e) : fmt(s.e)) : '–',
        pr: !!(dn && dn.pr),
        bg: cur ? 'var(--c-s1)' : 'transparent', bd: cur ? 'var(--c-acc)' : 'transparent', op: (!dn && !cur) ? 0.45 : 1,
        anim: (i === s.justDone) ? 'gtFlash 1s ease' : 'none',
        cbg: dn ? 'var(--c-sec)' : 'transparent', cfg: dn ? 'var(--c-on-sec)' : 'transparent', cbd: dn ? 'var(--c-sec)' : 'var(--c-s3)'
      });
    }

    // last-time set at the same index (or the last one) for the comparison line
    const lt = last ? last.sets[Math.min(logs.length, last.sets.length - 1)] : null;
    let deltaVsLast = '';
    if (lt && s.w != null) {
      const dw = s.w - lt.w, dr = s.r - lt.r;
      deltaVsLast = Math.abs(dw) > 0.001 ? `${dw > 0 ? '+' : '−'}${kg(Math.abs(dw))} kg` : dr > 0 ? `+${dr} rip` : dr < 0 ? `−${-dr} rip` : 'stesso carico';
    }

    const nextId = s.order[exIdx + 1], nextEx = nextId ? exOf(nextId) : null;
    const effTarget = effTxt(rir, tg.rpe);
    const pad = st.pad;
    const left = GT.restLeft(s);
    const wNull = s.w == null;

    // Coach suggestion for today
    const sugTxt = sg.w == null ? 'Scegli il carico' : sg.w === 0 ? `corpo libero × ${sg.r}` : `${kg(sg.w)} kg × ${sg.r}`;
    const whyTxt = last ? why : why.replace(/^Prima volta:\s*/, '').replace(/^./, c => c.toUpperCase());

    // Big weight value (variant B / input panel)
    const wBig = wNull ? { t: '—', small: false } : bw ? (s.w > 0 ? { t: `+${kg(s.w)}`, small: false } : { t: 'corpo libero', small: true }) : { t: kg(s.w), small: false };

    const quickW = bw ? [-2, -1, 1, 2] : [-2 * step, -step, step, 2 * step];
    const quickVals = pad ? (pad.field === 'w' ? quickW : [-2, -1, 1, 2]) : [];

    return {
      id, ex, tg, logs, allDone, isLast, bw, rir, last, lt,
      elapsed: GT.elapsed(s),
      exNum: exIdx + 1, exCount: s.order.length, exMuscle: muscle, exName: ex.n,
      exTargetLine: `${tg.sets} × ${tg.reps} · ${effTarget} · recupero ${mmss(tg.rest)}`,
      // Notes that came with an imported program: superset, RIR floor, coach note
      exPlanNote: [tg.superset ? `Superset ${tg.superset}` : '', tg.minRir != null ? `Mai sotto RIR ${tg.minRir}` : '', tg.note || ''].filter(Boolean).join(' · '),
      exLastDate: last ? GT.fmtDay(last.date) : '',
      exLast: last ? last.sets.map(setTxt).join('  ·  ') : 'Prima volta',
      exSuggest: sugTxt, exWhy: whyTxt,
      lastLine: lt ? `Ultima volta ${lt.w > 0 ? `${kg(lt.w)} × ${lt.r}` : `${lt.r} rip`}` : `Prima volta · ${whyTxt}`,
      deltaVsLast,
      setRows: rows, showNote: !!s.showNote, noteVal: (s.notes || {})[id] || '',
      setDots: rows.map((rw, i) => ({
        n: i + 1,
        bg: i < logs.length ? 'var(--c-sec)' : 'transparent',
        fg: i < logs.length ? 'var(--c-on-sec)' : (i === logs.length ? 'var(--c-fg)' : 'var(--c-fg3)'),
        bd: i === logs.length ? 'var(--c-acc)' : (i < logs.length ? 'var(--c-sec)' : 'var(--c-s3)')
      })),
      setLabel: allDone ? `${logs.length} serie completate` : `Serie ${logs.length + 1} di ${tg.sets} · ${tg.reps} rip · ${effTarget}`,
      wBig, curR: s.r, wNull,
      wColLabel: bw ? '+kg' : 'kg',
      exSegs: s.order.map((eid, i) => {
        const n = (s.logs[eid] || []).length, done = n >= ((s.tg[eid] || {}).sets || 1);
        return {
          key: eid, label: `Esercizio ${i + 1}: ${exOf(eid).n}${done ? ', completato' : ''}`, cur: i === exIdx,
          bg: i === exIdx ? 'var(--c-acc)' : done ? 'var(--c-sec)' : n ? 'var(--c-fg3)' : 'var(--c-s3)', go: () => A.jumpToExercise(i)
        };
      }),
      effortChips: EFF_VALS.map(e => ({
        e, label: rir ? 10 - e : e, on: s.e === e,
        bg: s.e === e ? 'var(--c-acc)' : 'var(--c-s2)', fg: s.e === e ? 'var(--c-on-acc)' : 'var(--c-fg)',
        go: () => A.setEffort(e)
      })),
      effHalf: s.e != null && EFF_VALS.indexOf(s.e) < 0 ? (rir ? fmt(10 - s.e) : fmt(s.e)) : '',
      mainLabel: !allDone ? (wNull ? 'Imposta il carico' : `Conferma serie ${logs.length + 1}`) : isLast ? 'Termina sessione' : 'Prossimo esercizio',
      mainIcon: !allDone ? (wNull ? 'ph-bold ph-barbell' : 'ph-bold ph-check') : isLast ? 'ph-bold ph-flag-checkered' : 'ph-bold ph-arrow-right',
      mainAction: !allDone ? A.completeSet : isLast ? A.finishSession : A.nextExercise,
      resting: !!s.rest, notResting: !s.rest, inputsOn: !allDone, inputsA: !allDone && GT.v('vSessione') === 'A',
      restLeft: s.rest ? mmss(left) : '',
      restOffset: s.rest ? (314.16 * (1 - left / Math.max(1, s.rest.total))).toFixed(1) : 0,
      nextUp: allDone ? (nextEx ? `Prossimo: ${nextEx.n}` : 'Ultimo esercizio completato') : `Serie ${logs.length + 1} · ${wWord(s.w)} × ${s.r}`,
      padOpen: !!pad,
      padTitle: pad ? (pad.field === 'w' ? (bw ? 'Zavorra (kg)' : 'Carico (kg)') : 'Ripetizioni') : '',
      padHint: pad ? (pad.field === 'w'
        ? (bw ? 'Opzionale: 0 = corpo libero' : lt ? `Ultima volta ${kg(lt.w)} kg` : `Prima volta · chiudi a ${effTarget}`)
        : `Obiettivo ${tg.reps}`) : '',
      padVal: pad ? (pad.v || '0') : '',
      padQuick: quickVals.map(dd => ({ key: String(dd), label: `${dd > 0 ? '+' : '−'}${kg(Math.abs(dd))}`, go: () => A.padQuick(dd) })),
      padKeys: PAD_KEYS.map(k => ({ label: k, go: () => A.padPress(k) }))
    };
  }

  GT.screens.session = function (st, d) {
    const s = st.s;
    if (!s || !s.order || !s.order.length) return null;
    const v = sessionVals(st);
    const sessA = GT.v('vSessione') === 'A', sessB = GT.v('vSessione') === 'B';
    const effortName = st.effort === 'RIR' ? 'RIR' : 'RPE';
    const openPadW = () => A.openPad('w'), openPadR = () => A.openPad('r');
    const armed = isArmed();

    const discardBtn = html`<button onClick=${discardTap} style=${`align-self:center;height:44px;padding:0 14px;font-size:.8125rem;font-weight:700;color:${armed ? 'var(--c-acc-t)' : 'var(--c-fg3)'}`}>${armed ? 'Tocca di nuovo per annullare: nessuna serie verrà salvata' : 'Annulla allenamento'}</button>`;

    return html`<div style="position:absolute;inset:0;z-index:20;background:var(--c-bg);display:flex;flex-direction:column;padding-top:var(--top)">
<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 10px 8px">
<button onClick=${A.minimizeSession} aria-label=${`Riduci allenamento ${s.dayName || ''}`} style="height:44px;padding:0 8px;display:flex;align-items:center;gap:4px;color:var(--c-fg2);font-weight:700;max-width:40%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"><i class="ph-light ph-caret-down" style="font-size:22px"></i>${s.dayName || 'Allenamento'}</button>
<div role="timer" aria-label="Tempo trascorso" style="display:flex;align-items:center;gap:7px;font-weight:900;font-variant-numeric:tabular-nums;font-size:1.0625rem"><span style="width:8px;height:8px;border-radius:50%;background:var(--c-acc)"></span>${v.elapsed}</div>
<button onClick=${A.finishSession} style="height:44px;padding:0 16px;border-radius:22px;background:var(--c-s2);font-weight:800;font-size:.875rem">Termina</button>
</div>
<div style="display:flex;gap:4px;padding:0 16px">
${v.exSegs.map(g => html`<button key=${g.key} onClick=${g.go} aria-label=${g.label} aria-current=${g.cur ? 'step' : null} style="flex:1;height:20px;display:flex;align-items:center"><span style=${`display:block;width:100%;height:4px;border-radius:2px;background:${g.bg}`}></span></button>`)}
</div>

${sessA ? html`<div class="scroll" style="flex:1;overflow-y:auto;padding:12px 16px 12px;display:flex;flex-direction:column;gap:14px">
<div>
<div style=${S.eyebrow}>Esercizio ${v.exNum} di ${v.exCount}${v.exMuscle ? ` · ${v.exMuscle}` : ''}</div>
<h2 style="margin:4px 0 4px;font-size:1.625rem;font-weight:900;letter-spacing:-.02em;line-height:1.1">${v.exName}</h2>
<div style="font-size:.875rem;color:var(--c-fg2);font-variant-numeric:tabular-nums">${v.exTargetLine}</div>
${v.exPlanNote ? html`<div style="font-size:.8125rem;color:var(--c-acc-t);line-height:1.4;margin-top:4px">${v.exPlanNote}</div>` : null}
<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
<button onClick=${A.openExFromSession} style="height:40px;padding:0 14px;border-radius:999px;background:var(--c-s2);font-size:.8125rem;font-weight:800;display:flex;gap:6px;align-items:center"><i class="ph-light ph-play-circle" style="font-size:18px"></i>Video</button>
<button onClick=${A.openExFromSession} style="height:40px;padding:0 14px;border-radius:999px;background:var(--c-s2);font-size:.8125rem;font-weight:800;display:flex;gap:6px;align-items:center"><i class="ph-light ph-swap" style="font-size:18px"></i>Alternative</button>
<button onClick=${A.toggleNote} aria-pressed=${v.showNote} style=${`height:40px;padding:0 14px;border-radius:999px;background:${v.showNote ? 'var(--c-s3)' : 'var(--c-s2)'};font-size:.8125rem;font-weight:800;display:flex;gap:6px;align-items:center`}><i class="ph-light ph-note-pencil" style="font-size:18px"></i>Nota</button>
</div>
</div>
<div style="padding:12px 14px;border-radius:12px;background:var(--c-s1);border:1px solid var(--c-line);display:flex;flex-direction:column;gap:8px">
<div style="display:grid;grid-template-columns:1fr auto;gap:12px">
<div style="min-width:0"><div style=${S.eyebrow}>${v.last ? `Ultima volta · ${v.exLastDate}` : 'Ultima volta'}</div><div style="font-weight:800;font-variant-numeric:tabular-nums;margin-top:3px">${v.exLast}</div></div>
<div style="text-align:right"><div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-acc-t)">Coach · oggi</div><div style="font-weight:800;font-variant-numeric:tabular-nums;margin-top:3px;white-space:nowrap">${v.exSuggest}</div></div>
</div>
${v.exWhy ? html`<div style="font-size:.8125rem;line-height:1.4;color:var(--c-fg2);border-top:1px solid var(--c-line);padding-top:8px">${v.exWhy}</div>` : null}
</div>
${v.showNote ? html`<textarea value=${v.noteVal} onInput=${e => A.setNote(e.target.value)} aria-label="Nota sull'esercizio" placeholder="Es. presa più stretta, spalla ok" style="min-height:72px;border-radius:12px;border:1px solid var(--c-s3);background:var(--c-s1);padding:12px;font-size:.9375rem;outline:0;resize:none"></textarea>` : null}
<div style="display:grid;grid-template-columns:36px 1fr 64px 48px 44px 36px;gap:6px;padding:0 8px;font-size:.6875rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--c-fg3)"><span>Serie</span><span>Prec.</span><span style="text-align:right">${v.wColLabel}</span><span style="text-align:right">Rip</span><span style="text-align:right">${effortName}</span><span></span></div>
<div style="display:flex;flex-direction:column;gap:4px;margin-top:-8px">
${v.setRows.map(r => html`<div key=${r.n} style=${`display:grid;grid-template-columns:36px 1fr 64px 48px 44px 36px;gap:6px;align-items:center;height:52px;padding:0 8px;border-radius:10px;background:${r.bg};border:1px solid ${r.bd};opacity:${r.op};animation:${r.anim};font-variant-numeric:tabular-nums`}>
<span style="font-weight:900;display:flex;align-items:center;gap:3px">${r.n}${r.pr ? html`<i class="ph-fill ph-trophy" aria-label="Record personale" style="font-size:13px;color:var(--c-acc-t)"></i>` : null}</span>
<span style="font-size:.8125rem;color:var(--c-fg3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.prev}</span>
<span style="text-align:right;font-weight:900;font-size:1.0625rem">${r.w}</span>
<span style="text-align:right;font-weight:900;font-size:1.0625rem">${r.r}</span>
<span style="text-align:right;font-weight:700;color:var(--c-fg2)">${r.e}</span>
<span style=${`width:28px;height:28px;border-radius:50%;display:grid;place-items:center;justify-self:end;background:${r.cbg};color:${r.cfg};border:1.5px solid ${r.cbd}`}><i class="ph-bold ph-check" style="font-size:14px"></i></span>
</div>`)}
</div>
<div style="margin-top:auto;display:flex;justify-content:center;padding-top:8px">${discardBtn}</div>
</div>` : null}

${sessB ? html`<div class="scroll" style="flex:1;overflow-y:auto;padding:16px 20px 8px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px">
<div style=${S.eyebrow}>${v.exMuscle ? `${v.exMuscle} · ` : ''}${v.exNum}/${v.exCount}</div>
<button onClick=${A.openExFromSession} aria-label=${`${v.exName}: tecnica, video e alternative`} style="font-size:1.375rem;font-weight:900;letter-spacing:-.01em;line-height:1.15;display:flex;align-items:center;gap:6px;text-align:center">${v.exName}<i class="ph-light ph-info" style="font-size:18px;color:var(--c-fg3)"></i></button>
<div style="font-size:.8125rem;color:var(--c-fg2);font-variant-numeric:tabular-nums">${v.exTargetLine}</div>
${v.exPlanNote ? html`<div style="font-size:.75rem;color:var(--c-acc-t);line-height:1.4;max-width:320px">${v.exPlanNote}</div>` : null}
<div style="display:flex;gap:8px;margin:14px 0 4px;flex-wrap:wrap;justify-content:center">${v.setDots.map(dt => html`<span key=${dt.n} style=${`width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:.875rem;font-weight:900;background:${dt.bg};color:${dt.fg};border:1.5px solid ${dt.bd}`}>${dt.n}</span>`)}</div>
<div style="font-size:.8125rem;color:var(--c-fg3)">${v.setLabel}</div>
<div style="display:flex;align-items:flex-end;gap:12px;margin-top:10px">
<button class="hov-s1" onClick=${openPadW} aria-label=${v.bw ? 'Imposta zavorra' : 'Imposta carico'} style="display:flex;flex-direction:column;align-items:center;padding:6px 10px;border-radius:14px"><span style=${`font-size:${v.wBig.small ? '2rem' : '5rem'};font-weight:900;letter-spacing:-.04em;line-height:.95;font-variant-numeric:tabular-nums;${v.wBig.small ? 'padding:22px 0 14px' : ''}`}>${v.wBig.t}</span><span style="font-size:.75rem;font-weight:700;color:var(--c-fg3);letter-spacing:.08em;text-transform:uppercase">${v.bw ? 'zavorra kg' : 'kg'}</span></button>
<span style="font-size:2.5rem;font-weight:300;color:var(--c-fg3);padding-bottom:28px">×</span>
<button class="hov-s1" onClick=${openPadR} aria-label="Imposta ripetizioni" style="display:flex;flex-direction:column;align-items:center;padding:6px 10px;border-radius:14px"><span style="font-size:5rem;font-weight:900;letter-spacing:-.04em;line-height:.95;font-variant-numeric:tabular-nums">${v.curR}</span><span style="font-size:.75rem;font-weight:700;color:var(--c-fg3);letter-spacing:.08em;text-transform:uppercase">rip</span></button>
</div>
<div style="margin-top:10px;font-size:.875rem;line-height:1.4;color:var(--c-fg2);font-variant-numeric:tabular-nums;max-width:320px">${v.lastLine}${v.deltaVsLast ? html` · <span style="color:var(--c-acc-t);font-weight:800">${v.deltaVsLast}</span>` : null}</div>
${v.last ? html`<div style="font-size:.8125rem;color:var(--c-fg3);max-width:320px"><span style="color:var(--c-acc-t);font-weight:800">Coach · ${v.exSuggest}</span>${v.exWhy ? ` · ${v.exWhy}` : ''}</div>` : null}
<button onClick=${A.toggleNote} aria-pressed=${v.showNote} style="height:40px;padding:0 14px;margin-top:6px;border-radius:999px;background:var(--c-s2);font-size:.8125rem;font-weight:800;display:flex;gap:6px;align-items:center"><i class="ph-light ph-note-pencil" style="font-size:18px"></i>Nota</button>
${v.showNote ? html`<textarea value=${v.noteVal} onInput=${e => A.setNote(e.target.value)} aria-label="Nota sull'esercizio" placeholder="Es. presa più stretta, spalla ok" style="width:100%;min-height:72px;border-radius:12px;border:1px solid var(--c-s3);background:var(--c-s1);padding:12px;font-size:.9375rem;outline:0;resize:none;text-align:left"></textarea>` : null}
<div style="margin-top:auto;padding-top:12px">${discardBtn}</div>
</div>` : null}

${v.notResting ? html`<div style="padding:12px 16px var(--pb);border-top:1px solid var(--c-line);background:var(--c-bg);display:flex;flex-direction:column;gap:12px">
${v.inputsA ? html`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
<button onClick=${openPadW} style="height:72px;border-radius:14px;background:var(--c-s1);border:1px solid var(--c-s3);display:flex;flex-direction:column;align-items:center;justify-content:center"><span style=${S.eyebrow}>${v.bw ? 'Zavorra kg' : 'Carico kg'}</span><span style=${`font-size:${v.wBig.small ? '1.25rem' : '2rem'};font-weight:900;font-variant-numeric:tabular-nums;line-height:1.1;${v.wBig.small ? 'padding:4px 0' : ''}`}>${v.wBig.t}</span></button>
<button onClick=${openPadR} style="height:72px;border-radius:14px;background:var(--c-s1);border:1px solid var(--c-s3);display:flex;flex-direction:column;align-items:center;justify-content:center"><span style=${S.eyebrow}>Ripetizioni</span><span style="font-size:2rem;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.1">${v.curR}</span></button>
</div>` : null}
${v.inputsOn ? html`<div style="display:flex;align-items:center;gap:8px"><span style="width:34px;display:flex;flex-direction:column;gap:2px"><span style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3)">${effortName}</span>${v.effHalf ? html`<span style="font-size:.75rem;font-weight:900;color:var(--c-fg2);font-variant-numeric:tabular-nums">${v.effHalf}</span>` : null}</span>
<div style="flex:1;display:grid;grid-template-columns:repeat(5,1fr);gap:4px">${v.effortChips.map(c => html`<button key=${c.e} onClick=${c.go} aria-pressed=${c.on} aria-label=${`${effortName} ${c.label}`} style=${`height:48px;border-radius:10px;font-size:1.0625rem;font-weight:900;background:${c.bg};color:${c.fg};font-variant-numeric:tabular-nums`}>${c.label}</button>`)}</div></div>` : null}
<div style="display:flex;gap:8px">
${v.allDone ? html`<button onClick=${A.addSet} aria-label="Aggiungi serie" style="width:64px;height:64px;border-radius:14px;background:var(--c-s2);display:grid;place-items:center;flex:none"><i class="ph-light ph-plus" style="font-size:24px"></i></button>` : null}
<button class="press" onClick=${v.mainAction} style="flex:1;height:64px;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);font-size:1.125rem;font-weight:900;display:flex;align-items:center;justify-content:center;gap:10px"><i class=${v.mainIcon} style="font-size:22px"></i>${v.mainLabel}</button>
</div>
</div>` : null}

${v.resting ? html`<div style="padding:14px 16px var(--pb);border-top:1px solid var(--c-line);background:var(--c-bg);display:flex;flex-direction:column;align-items:center;gap:12px;animation:gtFade .28s ease">
<div style="display:flex;align-items:center;gap:18px;width:100%">
<div style="position:relative;width:112px;height:112px;flex:none"><svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true"><circle cx="56" cy="56" r="50" fill="none" style="stroke:var(--c-s3)" stroke-width="8"></circle><circle cx="56" cy="56" r="50" fill="none" style="stroke:var(--c-acc)" stroke-width="8" stroke-linecap="round" stroke-dasharray="314.16" stroke-dashoffset=${v.restOffset} transform="rotate(-90 56 56)"></circle></svg><div role="timer" aria-label="Recupero rimanente" style="position:absolute;inset:0;display:grid;place-items:center;font-size:1.75rem;font-weight:900;font-variant-numeric:tabular-nums">${v.restLeft}</div></div>
<div style="flex:1;min-width:0"><div style=${S.eyebrow}>Recupero</div><div style="font-size:1.0625rem;font-weight:800;margin-top:4px;line-height:1.3">${v.nextUp}</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:4px">Ti avviso con una vibrazione</div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:8px;width:100%">
<button onClick=${A.restMinus} aria-label="Togli 15 secondi" style="height:64px;border-radius:14px;background:var(--c-s2);font-weight:900;font-size:1rem">−15 s</button>
<button onClick=${A.restPlus} aria-label="Aggiungi 15 secondi" style="height:64px;border-radius:14px;background:var(--c-s2);font-weight:900;font-size:1rem">+15 s</button>
<button class="press" onClick=${A.restSkip} style="height:64px;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);font-weight:900;font-size:1rem">Salta</button>
</div>
</div>` : null}

${v.padOpen ? html`<button key="padScrim" onClick=${A.closePad} aria-label="Chiudi" style="position:absolute;inset:0;background:rgba(0,0,0,.55);z-index:4;animation:gtFade .2s ease"></button>
<div key="padSheet" role="dialog" aria-modal="true" aria-label=${v.padTitle} style="position:absolute;left:0;right:0;bottom:0;z-index:5;background:var(--c-s1);border-radius:24px 24px 0 0;padding:16px 16px var(--pb);display:flex;flex-direction:column;gap:12px;animation:gtSheet .26s cubic-bezier(.2,0,0,1)">
<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span style=${S.eyebrow}>${v.padTitle}</span><span style="font-size:.8125rem;color:var(--c-fg3);text-align:right">${v.padHint}</span></div>
<div style="font-size:3.5rem;font-weight:900;letter-spacing:-.03em;text-align:center;font-variant-numeric:tabular-nums;line-height:1.1;min-height:62px">${v.padVal}<span style="display:inline-block;width:3px;height:44px;background:var(--c-acc);margin-left:4px;vertical-align:-4px;animation:gtDot 1s infinite"></span></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${v.padQuick.map(q => html`<button key=${q.key} onClick=${q.go} style="height:44px;border-radius:10px;border:1px solid var(--c-s3);font-weight:800;font-variant-numeric:tabular-nums">${q.label}</button>`)}</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${v.padKeys.map(k => html`<button key=${k.label} class="key" onClick=${k.go} aria-label=${k.label === '⌫' ? 'Cancella' : null} style="height:56px;border-radius:12px;background:var(--c-s2);font-size:1.5rem;font-weight:800;display:grid;place-items:center">${k.label}</button>`)}</div>
<button class="press" onClick=${A.padCommit} style="height:60px;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);font-size:1.0625rem;font-weight:900">Fatto</button>
</div>` : null}
</div>`;
  };

  // Coach note for the summary, computed from the session just finished
  function summaryCoach(st, sm) {
    const rir = st.effort === 'RIR';
    if (sm.empty) return '';
    const firstEver = !((st.logs && st.logs.sessions) || []).length;
    if (firstEver) return 'Prima sessione registrata: da ora ti suggerisco i carichi.';
    const tgt = sm.avgTarget || 8;
    const cond = rir ? `a RIR ≥ ${fmt(10 - tgt)}` : `a RPE ≤ ${fmt(tgt)}`;
    const rule = `stessi carichi finché non chiudi tutte le serie in cima al range ${cond}, poi un incremento (+2,5 kg bilanciere, macchine e cavi; +2 kg manubri e kettlebell; +1 ripetizione a corpo libero).`;
    let note = sm.prs.length
      ? `Progressione confermata: ${sm.prs.length === 1 ? 'nuovo record' : `${sm.prs.length} nuovi record`}. Prossima sessione: ${rule}`
      : `Carichi in linea con l'ultima sessione. Prossima sessione: ${rule}`;
    if (sm.sets && sm.avgE > tgt + 0.75) {
      note += ` ${rir ? `RIR medio ${fmt(10 - sm.avgE)}` : `RPE medio ${fmt(sm.avgE)}`} oltre il target: la prossima volta fermati prima del cedimento invece di aumentare.`;
    }
    return note;
  }

  GT.screens.summary = function (st, d) {
    const sm = st.summary;
    if (!sm) return null;
    const s = st.s, rir = st.effort === 'RIR';
    const week = s && st.plan ? GT.cycleWeek(st.plan, s.date).num : null;
    const eyebrow = [s && s.dayName, week ? `Settimana ${week}` : ''].filter(Boolean).join(' · ') || 'Allenamento';
    const avgTxt = v => fmt(rir ? 10 - v : v);
    const sumStats = [
      { l: 'Durata', v: `${sm.dur} min`, s: sm.est ? `stimati ${sm.est} min` : 'tempo effettivo' },
      { l: 'Volume', v: `${GT.fk(sm.vol)} kg`, s: 'carico × ripetizioni' },
      { l: 'Serie', v: `${sm.sets} / ${sm.planned}`, s: `pianificate ${sm.planned}` },
      { l: rir ? 'RIR medio' : 'RPE medio', v: sm.sets ? avgTxt(sm.avgE) : '—', s: sm.avgTarget ? `target ${avgTxt(sm.avgTarget)}` : 'nessun target' }
    ];
    const prs = sm.prs || [];
    const sumHasPr = prs.length > 0;
    const sumPrTitle = prs.length === 1 ? '1 nuovo record personale' : `${prs.length} nuovi record personali`;
    const sumPrSub = prs.join(' · ');
    const sumCoach = summaryCoach(st, sm);
    const rateOpts = [[1, 'Facile'], [2, ''], [3, 'Giusta'], [4, ''], [5, 'Al limite']].map(([n, l]) => ({
      n, l, bg: st.rate === n ? 'var(--c-acc)' : 'var(--c-s2)', fg: st.rate === n ? 'var(--c-on-acc)' : 'var(--c-fg)', go: () => GT.set({ rate: n })
    }));
    const backToSession = () => GT.set({ summary: null, overlay: 'session', pad: null });

    return html`<div key="summary" class="scroll" style="position:absolute;inset:0;z-index:20;background:var(--c-bg);overflow-y:auto;padding:calc(var(--top) + 16px) 16px calc(var(--pb) + 96px);display:flex;flex-direction:column;gap:14px;animation:gtFade .4s ease">
<span style=${`width:56px;height:56px;border-radius:50%;background:${sm.empty ? 'var(--c-s2)' : 'var(--c-acc)'};color:${sm.empty ? 'var(--c-fg2)' : 'var(--c-on-acc)'};display:grid;place-items:center`}><i class=${sm.empty ? 'ph-bold ph-minus' : 'ph-bold ph-check'} style="font-size:28px"></i></span>
<div><div style=${S.eyebrow}>${eyebrow}</div>${sm.empty
      ? html`<h1 style="margin:6px 0 0;font-size:2.25rem;font-weight:900;letter-spacing:-.02em;line-height:1.05">Nessuna serie <span style="background-image:linear-gradient(var(--c-acc),var(--c-acc));background-repeat:no-repeat;background-position:0 90%;background-size:100% .14em">registrata</span></h1>`
      : html`<h1 style="margin:6px 0 0;font-size:2.25rem;font-weight:900;letter-spacing:-.02em;line-height:1.05">Sessione <span style="background-image:linear-gradient(var(--c-acc),var(--c-acc));background-repeat:no-repeat;background-position:0 90%;background-size:100% .14em">completata</span></h1>`}</div>

${sm.empty ? html`<div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px">
<p style="margin:0;font-size:.9375rem;line-height:1.45">${sm.dur} min, 0 serie confermate. Senza serie non posso aggiornare carichi, record né volume settimanale.</p>
<p style="margin:0;font-size:.875rem;line-height:1.45;color:var(--c-fg2)">Torna all'allenamento e conferma ogni serie con il pulsante in basso, oppure salva comunque per tenere traccia della presenza.</p>
${s ? html`<button class="press" onClick=${backToSession} style="align-self:flex-start;height:44px;padding:0 16px;border-radius:999px;background:var(--c-s2);font-weight:800;font-size:.875rem;display:flex;align-items:center;gap:6px"><i class="ph-light ph-arrow-u-up-left" style="font-size:18px"></i>Torna all'allenamento</button>` : null}
</div>` : html`
<div style="flex:none;display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--c-line);border:1px solid var(--c-line);border-radius:12px;overflow:hidden">
${sumStats.map(x => html`<div key=${x.l} style="background:var(--c-s1);padding:14px"><div style="font-size:.75rem;color:var(--c-fg3)">${x.l}</div><div style="font-size:1.75rem;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:-.02em">${x.v}</div><div style="font-size:.75rem;color:var(--c-fg2)">${x.s}</div></div>`)}
</div>
${sumHasPr ? html`<div style="border-radius:12px;padding:14px 16px;background:var(--c-acc);color:var(--c-on-acc);display:flex;gap:12px;align-items:center"><i class="ph-fill ph-trophy" style="font-size:28px"></i><div><div style="font-weight:900">${sumPrTitle}</div><div style="font-size:.875rem;font-weight:600">${sumPrSub}</div></div></div>` : null}
<div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:6px 16px">
<div style=${'padding:10px 0;' + S.eyebrow}>Rispetto all'ultima sessione</div>
${(sm.ex || []).map((e, i) => html`<div key=${`${i}-${e.name}`} style="display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--c-line)"><div style="min-width:0"><div style="font-weight:700;font-size:.9375rem">${e.name}</div><div style="font-size:.8125rem;color:var(--c-fg3);font-variant-numeric:tabular-nums">${e.line}</div></div><span style=${`font-weight:900;font-variant-numeric:tabular-nums;color:${e.dc};white-space:nowrap`}>${e.delta}</span></div>`)}
</div>
${(sm.mus || []).length ? html`<div style="display:flex;flex-wrap:wrap;gap:6px">${sm.mus.map(m => html`<span key=${m} style="font-size:.8125rem;font-weight:700;padding:8px 12px;border-radius:999px;background:var(--c-s2)">${m}</span>`)}</div>` : null}
<div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:14px 16px;display:flex;gap:12px"><span style="flex:none;width:36px;height:36px;border-radius:50%;background:var(--c-acc);color:var(--c-on-acc);display:grid;place-items:center"><i class="ph-bold ph-lightning" style="font-size:18px"></i></span><div><div style=${S.eyebrow}>Coach</div><p style="margin:4px 0 0;font-size:.9375rem;line-height:1.45">${sumCoach}</p></div></div>
<div><div style=${S.eyebrow + ';margin-bottom:8px'}>Fatica percepita della sessione</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">${rateOpts.map(o => html`<button key=${o.n} onClick=${o.go} aria-pressed=${st.rate === o.n} aria-label=${`Fatica ${o.n} di 5${o.l ? ` (${o.l})` : ''}`} style=${`height:52px;border-radius:10px;font-weight:900;background:${o.bg};color:${o.fg};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px`}><span>${o.n}</span><span style="font-size:.625rem;font-weight:700">${o.l}</span></button>`)}</div></div>
${s ? html`<button onClick=${backToSession} style="align-self:center;height:44px;padding:0 14px;font-size:.8125rem;font-weight:700;color:var(--c-fg3)">Torna all'allenamento</button>` : null}`}
</div>
${sm.empty
      ? html`<div key="summaryBar" style="position:absolute;left:0;right:0;bottom:0;z-index:21;padding:12px 16px var(--pb);background:var(--c-bg);border-top:1px solid var(--c-line);display:grid;grid-template-columns:1fr 1fr;gap:8px"><button onClick=${A.discardSession} style="height:64px;border-radius:14px;background:var(--c-s2);font-size:1rem;font-weight:900">Annulla allenamento</button><button class="press" onClick=${A.saveSession} style="height:64px;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);font-size:1rem;font-weight:900">Salva comunque</button></div>`
      : html`<div key="summaryBar" style="position:absolute;left:0;right:0;bottom:0;z-index:21;padding:12px 16px var(--pb);background:var(--c-bg);border-top:1px solid var(--c-line)"><button class="press" onClick=${A.saveSession} style="height:64px;width:100%;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);font-size:1.125rem;font-weight:900">Salva sessione</button></div>`}`;
  };
})();
