/* GreyTraining — gym session (full screen) and session summary.
   Port of design-reference/GreyTraining.dc.html: template lines 563-688,
   renderVals() "if (s)" block + sumV, and the session action handlers. */
(function () {
  'use strict';
  var GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  const fmt = GT.fmt, kg = GT.fmtKg, mmss = GT.mmss;
  const EFF_VALS = [6, 7, 8, 9, 10];
  const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'];

  // Values of the running session (renderVals "if (s)" block)
  function sessionVals(st) {
    const s = st.s, EX = GT.EX, rir = st.effort === 'RIR';
    const ex = EX[s.exIdx], logs = s.logs[ex.id] || [], plan = s.plan[ex.id] || ex.sets, allDone = logs.length >= plan, isLast = s.exIdx === EX.length - 1;
    const rows = [];
    for (let i = 0; i < Math.max(plan, logs.length); i++) {
      const d = logs[i], cur = i === logs.length, lp = ex.last[i];
      rows.push({
        n: i + 1, prev: lp ? `${fmt(lp[0])}×${lp[1]}` : '—',
        w: d ? kg(d.w) : cur ? kg(s.w) : '–',
        r: d ? d.r : cur ? s.r : '–',
        e: d ? (rir ? 10 - d.e : fmt(d.e)) : cur ? (rir ? 10 - s.e : fmt(s.e)) : '–',
        pr: !!(d && d.pr),
        bg: cur ? 'var(--c-s1)' : 'transparent', bd: cur ? 'var(--c-acc)' : 'transparent', op: (!d && !cur) ? 0.45 : 1,
        anim: (i === s.justDone) ? 'gtFlash 1s ease' : 'none',
        cbg: d ? 'var(--c-sec)' : 'transparent', cfg: d ? 'var(--c-on-sec)' : 'transparent', cbd: d ? 'var(--c-sec)' : 'var(--c-s3)'
      });
    }
    const lt = ex.last[Math.min(logs.length, ex.last.length - 1)];
    const dw = s.w - lt[0], dr = s.r - lt[1];
    const nextEx = allDone ? EX[s.exIdx + 1] : ex;
    const effTarget = rir ? `RIR ${10 - ex.eff}` : `RPE ${ex.eff}`;
    const pad = st.pad;
    const left = GT.restLeft(s);
    return {
      ex, logs, plan, allDone, isLast,
      elapsed: GT.elapsed(s),
      exNum: s.exIdx + 1, exMuscle: ex.muscle, exName: ex.name,
      exTargetLine: `${plan} × ${ex.reps} · ${effTarget} · recupero ${mmss(ex.rest)}`,
      exLastDate: '3 nov', exLast: ex.last.map(l => `${fmt(l[0])}×${l[1]}`).join('  ·  '), exSuggest: `${fmt(ex.sug[0])} kg × ${ex.sug[1]}`,
      exLastSet: `${fmt(lt[0])} × ${lt[1]}`,
      deltaVsLast: dw > 0 ? `+${kg(dw)} kg` : dw < 0 ? `${kg(dw)} kg` : dr > 0 ? `+${dr} rip` : dr < 0 ? `${dr} rip` : 'stesso carico',
      setRows: rows, showNote: s.showNote, noteVal: s.notes[ex.id] || '',
      setDots: rows.map((rw, i) => ({
        n: i + 1,
        bg: i < logs.length ? 'var(--c-sec)' : 'transparent',
        fg: i < logs.length ? 'var(--c-on-sec)' : (i === logs.length ? 'var(--c-fg)' : 'var(--c-fg3)'),
        bd: i === logs.length ? 'var(--c-acc)' : (i < logs.length ? 'var(--c-sec)' : 'var(--c-s3)')
      })),
      setLabel: allDone ? `${logs.length} serie completate` : `Serie ${logs.length + 1} di ${plan} · ${ex.reps} rip · ${effTarget}`,
      curW: kg(s.w), curR: s.r,
      exSegs: EX.map((e, i) => {
        const n = (s.logs[e.id] || []).length, done = n >= (s.plan[e.id] || e.sets);
        return { bg: i === s.exIdx ? 'var(--c-acc)' : done ? 'var(--c-sec)' : n ? 'var(--c-fg3)' : 'var(--c-s3)', go: () => A.jumpToExercise(i) };
      }),
      effortChips: EFF_VALS.map(e => ({
        e, label: rir ? 10 - e : e,
        bg: s.e === e ? 'var(--c-acc)' : 'var(--c-s2)', fg: s.e === e ? 'var(--c-on-acc)' : 'var(--c-fg)',
        go: () => A.setEffort(e)
      })),
      mainLabel: !allDone ? `Conferma serie ${logs.length + 1}` : isLast ? 'Termina sessione' : 'Prossimo esercizio',
      mainIcon: !allDone ? 'ph-bold ph-check' : isLast ? 'ph-bold ph-flag-checkered' : 'ph-bold ph-arrow-right',
      mainAction: !allDone ? A.completeSet : isLast ? A.finishSession : A.nextExercise,
      resting: !!s.rest, notResting: !s.rest, inputsOn: !allDone, inputsA: !allDone && GT.v('vSessione') === 'A',
      restLeft: s.rest ? mmss(left) : '',
      restOffset: s.rest ? (314.16 * (1 - left / s.rest.total)).toFixed(1) : 0,
      nextUp: allDone ? (nextEx ? `Prossimo: ${nextEx.name}` : 'Ultimo esercizio completato') : `Serie ${logs.length + 1} · ${kg(s.w)} kg × ${s.r}`,
      padOpen: !!pad,
      padTitle: pad ? (pad.field === 'w' ? 'Carico (kg)' : 'Ripetizioni') : '',
      padHint: pad ? (pad.field === 'w' ? `Ultima volta ${fmt(lt[0])} kg` : `Obiettivo ${ex.reps}`) : '',
      padVal: pad ? (pad.v || '0') : '',
      padQuick: pad ? (pad.field === 'w' ? [-2.5, -1.25, 1.25, 2.5] : [-2, -1, 1, 2]).map(dd => ({ label: (dd > 0 ? '+' : '') + String(dd).replace('.', ','), go: () => A.padQuick(dd) })) : [],
      padKeys: PAD_KEYS.map(k => ({ label: k, go: () => A.padPress(k) }))
    };
  }

  GT.screens.session = function (st, d) {
    const s = st.s;
    if (!s) return null;
    const v = sessionVals(st);
    const sessA = GT.v('vSessione') === 'A', sessB = GT.v('vSessione') === 'B';
    const effortName = st.effort;
    const openPadW = () => A.openPad('w'), openPadR = () => A.openPad('r');

    return html`<div style="position:absolute;inset:0;z-index:20;background:var(--c-bg);display:flex;flex-direction:column;padding-top:var(--top)">
<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 10px 8px">
<button onClick=${A.minimizeSession} style="height:44px;padding:0 8px;display:flex;align-items:center;gap:4px;color:var(--c-fg2);font-weight:700"><i class="ph-light ph-caret-down" style="font-size:22px"></i>Upper A</button>
<div style="display:flex;align-items:center;gap:7px;font-weight:900;font-variant-numeric:tabular-nums;font-size:1.0625rem"><span style="width:8px;height:8px;border-radius:50%;background:var(--c-acc)"></span>${v.elapsed}</div>
<button onClick=${A.finishSession} style="height:44px;padding:0 16px;border-radius:22px;background:var(--c-s2);font-weight:800;font-size:.875rem">Termina</button>
</div>
<div style="display:flex;gap:4px;padding:0 16px">
${v.exSegs.map((g, i) => html`<button key=${i} onClick=${g.go} aria-label="Esercizio" style="flex:1;height:20px;display:flex;align-items:center"><span style=${`display:block;width:100%;height:4px;border-radius:2px;background:${g.bg}`}></span></button>`)}
</div>

${sessA ? html`<div class="scroll" style="flex:1;overflow-y:auto;padding:12px 16px 12px;display:flex;flex-direction:column;gap:14px">
<div>
<div style=${S.eyebrow}>Esercizio ${v.exNum} di 6 · ${v.exMuscle}</div>
<h2 style="margin:4px 0 4px;font-size:1.625rem;font-weight:900;letter-spacing:-.02em;line-height:1.1">${v.exName}</h2>
<div style="font-size:.875rem;color:var(--c-fg2);font-variant-numeric:tabular-nums">${v.exTargetLine}</div>
<div style="display:flex;gap:8px;margin-top:12px">
<button onClick=${A.openExFromSession} style="height:40px;padding:0 14px;border-radius:999px;background:var(--c-s2);font-size:.8125rem;font-weight:800;display:flex;gap:6px;align-items:center"><i class="ph-light ph-play-circle" style="font-size:18px"></i>Video</button>
<button onClick=${A.openExFromSession} style="height:40px;padding:0 14px;border-radius:999px;background:var(--c-s2);font-size:.8125rem;font-weight:800;display:flex;gap:6px;align-items:center"><i class="ph-light ph-swap" style="font-size:18px"></i>Alternative</button>
<button onClick=${A.toggleNote} style="height:40px;padding:0 14px;border-radius:999px;background:var(--c-s2);font-size:.8125rem;font-weight:800;display:flex;gap:6px;align-items:center"><i class="ph-light ph-note-pencil" style="font-size:18px"></i>Nota</button>
</div>
</div>
<div style="display:grid;grid-template-columns:1fr auto;gap:12px;padding:12px 14px;border-radius:12px;background:var(--c-s1);border:1px solid var(--c-line)">
<div><div style=${S.eyebrow}>Ultima volta · ${v.exLastDate}</div><div style="font-weight:800;font-variant-numeric:tabular-nums;margin-top:3px">${v.exLast}</div></div>
<div style="text-align:right"><div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-acc-t)">Coach · oggi</div><div style="font-weight:800;font-variant-numeric:tabular-nums;margin-top:3px">${v.exSuggest}</div></div>
</div>
${v.showNote ? html`<textarea value=${v.noteVal} onInput=${e => A.setNote(e.target.value)} placeholder="Es. presa più stretta, spalla ok" style="min-height:72px;border-radius:12px;border:1px solid var(--c-s3);background:var(--c-s1);padding:12px;font-size:.9375rem;outline:0;resize:none"></textarea>` : null}
<div style="display:grid;grid-template-columns:36px 1fr 64px 48px 44px 36px;gap:6px;padding:0 8px;font-size:.6875rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--c-fg3)"><span>Serie</span><span>Prec.</span><span style="text-align:right">kg</span><span style="text-align:right">Rip</span><span style="text-align:right">${effortName}</span><span></span></div>
<div style="display:flex;flex-direction:column;gap:4px;margin-top:-8px">
${v.setRows.map(r => html`<div key=${r.n} style=${`display:grid;grid-template-columns:36px 1fr 64px 48px 44px 36px;gap:6px;align-items:center;height:52px;padding:0 8px;border-radius:10px;background:${r.bg};border:1px solid ${r.bd};opacity:${r.op};animation:${r.anim};font-variant-numeric:tabular-nums`}>
<span style="font-weight:900;display:flex;align-items:center;gap:3px">${r.n}${r.pr ? html`<i class="ph-fill ph-trophy" style="font-size:13px;color:var(--c-acc-t)"></i>` : null}</span>
<span style="font-size:.8125rem;color:var(--c-fg3)">${r.prev}</span>
<span style="text-align:right;font-weight:900;font-size:1.0625rem">${r.w}</span>
<span style="text-align:right;font-weight:900;font-size:1.0625rem">${r.r}</span>
<span style="text-align:right;font-weight:700;color:var(--c-fg2)">${r.e}</span>
<span style=${`width:28px;height:28px;border-radius:50%;display:grid;place-items:center;justify-self:end;background:${r.cbg};color:${r.cfg};border:1.5px solid ${r.cbd}`}><i class="ph-bold ph-check" style="font-size:14px"></i></span>
</div>`)}
</div>
</div>` : null}

${sessB ? html`<div class="scroll" style="flex:1;overflow-y:auto;padding:16px 20px 8px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px">
<div style=${S.eyebrow}>${v.exMuscle} · ${v.exNum}/6</div>
<button onClick=${A.openExFromSession} style="font-size:1.375rem;font-weight:900;letter-spacing:-.01em;line-height:1.15;display:flex;align-items:center;gap:6px;text-align:center">${v.exName}<i class="ph-light ph-info" style="font-size:18px;color:var(--c-fg3)"></i></button>
<div style="display:flex;gap:8px;margin:14px 0 4px">${v.setDots.map(dt => html`<span key=${dt.n} style=${`width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:.875rem;font-weight:900;background:${dt.bg};color:${dt.fg};border:1.5px solid ${dt.bd}`}>${dt.n}</span>`)}</div>
<div style="font-size:.8125rem;color:var(--c-fg3)">${v.setLabel}</div>
<div style="display:flex;align-items:flex-end;gap:12px;margin-top:10px">
<button class="hov-s1" onClick=${openPadW} style="display:flex;flex-direction:column;align-items:center;padding:6px 10px;border-radius:14px"><span style="font-size:5rem;font-weight:900;letter-spacing:-.04em;line-height:.95;font-variant-numeric:tabular-nums">${v.curW}</span><span style="font-size:.75rem;font-weight:700;color:var(--c-fg3);letter-spacing:.08em;text-transform:uppercase">kg</span></button>
<span style="font-size:2.5rem;font-weight:300;color:var(--c-fg3);padding-bottom:28px">×</span>
<button class="hov-s1" onClick=${openPadR} style="display:flex;flex-direction:column;align-items:center;padding:6px 10px;border-radius:14px"><span style="font-size:5rem;font-weight:900;letter-spacing:-.04em;line-height:.95;font-variant-numeric:tabular-nums">${v.curR}</span><span style="font-size:.75rem;font-weight:700;color:var(--c-fg3);letter-spacing:.08em;text-transform:uppercase">rip</span></button>
</div>
<div style="margin-top:10px;font-size:.875rem;color:var(--c-fg2);font-variant-numeric:tabular-nums">Ultima volta ${v.exLastSet} · <span style="color:var(--c-acc-t);font-weight:800">${v.deltaVsLast}</span></div>
</div>` : null}

${v.notResting ? html`<div style="padding:12px 16px var(--pb);border-top:1px solid var(--c-line);background:var(--c-bg);display:flex;flex-direction:column;gap:12px">
${v.inputsA ? html`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
<button onClick=${openPadW} style="height:72px;border-radius:14px;background:var(--c-s1);border:1px solid var(--c-s3);display:flex;flex-direction:column;align-items:center;justify-content:center"><span style=${S.eyebrow}>Carico kg</span><span style="font-size:2rem;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.1">${v.curW}</span></button>
<button onClick=${openPadR} style="height:72px;border-radius:14px;background:var(--c-s1);border:1px solid var(--c-s3);display:flex;flex-direction:column;align-items:center;justify-content:center"><span style=${S.eyebrow}>Ripetizioni</span><span style="font-size:2rem;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.1">${v.curR}</span></button>
</div>` : null}
${v.inputsOn ? html`<div style="display:flex;align-items:center;gap:8px"><span style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3);width:34px">${effortName}</span>
<div style="flex:1;display:grid;grid-template-columns:repeat(5,1fr);gap:4px">${v.effortChips.map(c => html`<button key=${c.e} onClick=${c.go} aria-pressed=${s.e === c.e} style=${`height:48px;border-radius:10px;font-size:1.0625rem;font-weight:900;background:${c.bg};color:${c.fg};font-variant-numeric:tabular-nums`}>${c.label}</button>`)}</div></div>` : null}
<div style="display:flex;gap:8px">
${v.allDone ? html`<button onClick=${A.addSet} aria-label="Aggiungi serie" style="width:64px;height:64px;border-radius:14px;background:var(--c-s2);display:grid;place-items:center;flex:none"><i class="ph-light ph-plus" style="font-size:24px"></i></button>` : null}
<button class="press" onClick=${v.mainAction} style="flex:1;height:64px;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);font-size:1.125rem;font-weight:900;display:flex;align-items:center;justify-content:center;gap:10px"><i class=${v.mainIcon} style="font-size:22px"></i>${v.mainLabel}</button>
</div>
</div>` : null}

${v.resting ? html`<div style="padding:14px 16px var(--pb);border-top:1px solid var(--c-line);background:var(--c-bg);display:flex;flex-direction:column;align-items:center;gap:12px;animation:gtFade .28s ease">
<div style="display:flex;align-items:center;gap:18px;width:100%">
<div style="position:relative;width:112px;height:112px;flex:none"><svg width="112" height="112" viewBox="0 0 112 112"><circle cx="56" cy="56" r="50" fill="none" style="stroke:var(--c-s3)" stroke-width="8"></circle><circle cx="56" cy="56" r="50" fill="none" style="stroke:var(--c-acc)" stroke-width="8" stroke-linecap="round" stroke-dasharray="314.16" stroke-dashoffset=${v.restOffset} transform="rotate(-90 56 56)"></circle></svg><div role="timer" aria-label="Recupero rimanente" style="position:absolute;inset:0;display:grid;place-items:center;font-size:1.75rem;font-weight:900;font-variant-numeric:tabular-nums">${v.restLeft}</div></div>
<div style="flex:1"><div style=${S.eyebrow}>Recupero</div><div style="font-size:1.0625rem;font-weight:800;margin-top:4px;line-height:1.3">${v.nextUp}</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:4px">Ti avviso con una vibrazione</div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:8px;width:100%">
<button onClick=${A.restMinus} style="height:64px;border-radius:14px;background:var(--c-s2);font-weight:900;font-size:1rem">−15 s</button>
<button onClick=${A.restPlus} style="height:64px;border-radius:14px;background:var(--c-s2);font-weight:900;font-size:1rem">+15 s</button>
<button onClick=${A.restSkip} style="height:64px;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);font-weight:900;font-size:1rem">Salta</button>
</div>
</div>` : null}

${v.padOpen ? html`<button key="padScrim" onClick=${A.closePad} aria-label="Chiudi" style="position:absolute;inset:0;background:rgba(0,0,0,.55);z-index:4;animation:gtFade .2s ease"></button>
<div key="padSheet" role="dialog" aria-modal="true" aria-label=${v.padTitle} style="position:absolute;left:0;right:0;bottom:0;z-index:5;background:var(--c-s1);border-radius:24px 24px 0 0;padding:16px 16px var(--pb);display:flex;flex-direction:column;gap:12px;animation:gtSheet .26s cubic-bezier(.2,0,0,1)">
<div style="display:flex;justify-content:space-between;align-items:center"><span style=${S.eyebrow}>${v.padTitle}</span><span style="font-size:.8125rem;color:var(--c-fg3)">${v.padHint}</span></div>
<div style="font-size:3.5rem;font-weight:900;letter-spacing:-.03em;text-align:center;font-variant-numeric:tabular-nums;line-height:1.1;min-height:62px">${v.padVal}<span style="display:inline-block;width:3px;height:44px;background:var(--c-acc);margin-left:4px;vertical-align:-4px;animation:gtDot 1s infinite"></span></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${v.padQuick.map(q => html`<button key=${q.label} onClick=${q.go} style="height:44px;border-radius:10px;border:1px solid var(--c-s3);font-weight:800;font-variant-numeric:tabular-nums">${q.label}</button>`)}</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${v.padKeys.map(k => html`<button key=${k.label} class="key" onClick=${k.go} aria-label=${k.label === '⌫' ? 'Cancella' : null} style="height:56px;border-radius:12px;background:var(--c-s2);font-size:1.5rem;font-weight:800;display:grid;place-items:center">${k.label}</button>`)}</div>
<button onClick=${A.padCommit} style="height:60px;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);font-size:1.0625rem;font-weight:900">Fatto</button>
</div>` : null}
</div>`;
  };

  GT.screens.summary = function (st, d) {
    const sm = st.summary;
    if (!sm) return null;
    const rir = st.effort === 'RIR';
    const sumStats = [
      { l: 'Durata', v: `${sm.dur} min`, s: 'stimati 65 min' },
      { l: 'Volume', v: `${GT.fk(sm.vol)} kg`, s: 'carico × ripetizioni' },
      { l: 'Serie', v: `${sm.sets} / 18`, s: 'pianificate 18' },
      { l: rir ? 'RIR medio' : 'RPE medio', v: sm.sets ? (rir ? fmt(10 - sm.avgE) : fmt(sm.avgE)) : '—', s: 'target 8' }
    ];
    const sumHasPr = sm.prs.length > 0;
    const sumPrTitle = sm.prs.length === 1 ? '1 nuovo record personale' : `${sm.prs.length} nuovi record personali`;
    const sumPrSub = sm.prs.join(' · ');
    const sumCoach = sm.prs.length
      ? 'Progressione confermata. Prossima sessione: stessi carichi sulla panca finché non chiudi 3 × 8 pieni a RPE ≤ 8, poi +2,5 kg.'
      : 'Carichi in linea con la scorsa sessione. Se chiudi il primo esercizio a RPE ≤ 7, la prossima volta +2,5 kg.';
    const rateOpts = [[1, 'Facile'], [2, ''], [3, 'Giusta'], [4, ''], [5, 'Al limite']].map(([n, l]) => ({
      n, l, bg: st.rate === n ? 'var(--c-acc)' : 'var(--c-s2)', fg: st.rate === n ? 'var(--c-on-acc)' : 'var(--c-fg)', go: () => GT.set({ rate: n })
    }));

    return html`<div key="summary" class="scroll" style="position:absolute;inset:0;z-index:20;background:var(--c-bg);overflow-y:auto;padding:calc(var(--top) + 16px) 16px calc(var(--pb) + 96px);display:flex;flex-direction:column;gap:14px;animation:gtFade .4s ease">
<span style="width:56px;height:56px;border-radius:50%;background:var(--c-acc);color:var(--c-on-acc);display:grid;place-items:center"><i class="ph-bold ph-check" style="font-size:28px"></i></span>
<div><div style=${S.eyebrow}>Upper A · Settimana 3</div><h1 style="margin:6px 0 0;font-size:2.25rem;font-weight:900;letter-spacing:-.02em;line-height:1.05">Sessione <span style="background-image:linear-gradient(var(--c-acc),var(--c-acc));background-repeat:no-repeat;background-position:0 90%;background-size:100% .14em">completata</span></h1></div>
<div style="flex:none;display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--c-line);border:1px solid var(--c-line);border-radius:12px;overflow:hidden">
${sumStats.map(x => html`<div key=${x.l} style="background:var(--c-s1);padding:14px"><div style="font-size:.75rem;color:var(--c-fg3)">${x.l}</div><div style="font-size:1.75rem;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:-.02em">${x.v}</div><div style="font-size:.75rem;color:var(--c-fg2)">${x.s}</div></div>`)}
</div>
${sumHasPr ? html`<div style="border-radius:12px;padding:14px 16px;background:var(--c-acc);color:var(--c-on-acc);display:flex;gap:12px;align-items:center"><i class="ph-fill ph-trophy" style="font-size:28px"></i><div><div style="font-weight:900">${sumPrTitle}</div><div style="font-size:.875rem;font-weight:600">${sumPrSub}</div></div></div>` : null}
<div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:6px 16px">
<div style=${'padding:10px 0;' + S.eyebrow}>Rispetto all'ultima sessione</div>
${sm.ex.map(e => html`<div key=${e.name} style="display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--c-line)"><div><div style="font-weight:700;font-size:.9375rem">${e.name}</div><div style="font-size:.8125rem;color:var(--c-fg3);font-variant-numeric:tabular-nums">${e.line}</div></div><span style=${`font-weight:900;font-variant-numeric:tabular-nums;color:${e.dc};white-space:nowrap`}>${e.delta}</span></div>`)}
${sm.empty ? html`<div style="padding:12px 0 14px;border-top:1px solid var(--c-line);font-size:.875rem;color:var(--c-fg3)">Nessuna serie registrata in questa sessione.</div>` : null}
</div>
<div style="display:flex;flex-wrap:wrap;gap:6px">${sm.mus.map(m => html`<span key=${m} style="font-size:.8125rem;font-weight:700;padding:8px 12px;border-radius:999px;background:var(--c-s2)">${m}</span>`)}</div>
<div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:14px 16px;display:flex;gap:12px"><span style="flex:none;width:36px;height:36px;border-radius:50%;background:var(--c-acc);color:var(--c-on-acc);display:grid;place-items:center"><i class="ph-bold ph-lightning" style="font-size:18px"></i></span><div><div style=${S.eyebrow}>Coach</div><p style="margin:4px 0 0;font-size:.9375rem;line-height:1.45">${sumCoach}</p></div></div>
<div><div style=${S.eyebrow + ';margin-bottom:8px'}>Fatica percepita della sessione</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">${rateOpts.map(o => html`<button key=${o.n} onClick=${o.go} aria-pressed=${st.rate === o.n} style=${`height:52px;border-radius:10px;font-weight:900;background:${o.bg};color:${o.fg};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px`}><span>${o.n}</span><span style="font-size:.625rem;font-weight:700">${o.l}</span></button>`)}</div></div>
</div>
<div key="summaryBar" style="position:absolute;left:0;right:0;bottom:0;z-index:21;padding:12px 16px var(--pb);background:var(--c-bg);border-top:1px solid var(--c-line)"><button onClick=${A.saveSession} style="height:64px;width:100%;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);font-size:1.125rem;font-weight:900">Salva sessione</button></div>`;
  };
})();
