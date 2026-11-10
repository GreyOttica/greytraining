/* GreyTraining — Allena tab (Palestra / Corsa / Piscina), cardio session detail and cardio log sheet.
   Port of design-reference/GreyTraining.dc.html lines 160-281 and 704-715 (template) and the
   matching renderVals() values (weekPlan, discs, runSessions, paceZones, runLib, swimStats,
   swimSessions, cd, logFields, logPace, logRpe, allenSegs, weeks, days, volume, lib*). */
(function () {
  'use strict';
  var GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  const EYEBROW_PAD = 'font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3);padding:4px 4px 0';
  const BADGE = 'font-size:.6875rem;font-weight:700;padding:3px 8px;border-radius:999px;background:var(--c-s2);color:var(--c-fg2)';
  const DISC_ICON = { palestra: 'barbell', corsa: 'person-simple-run', piscina: 'swimming-pool' };

  const openEditor = () => GT.set({ allenView: 'editor' });
  const openCardio = id => GT.set({ allenView: 'cardio', cardioId: id });

  // ---------- renderVals() port: Allena tab ----------
  function weekPlan(st) {
    return GT.WEEK.map(([d, n, k, cid], i) => {
      const today = i === GT.TODAY_IDX, done = cid ? !!st.cardioDone[cid] : (today && st.workoutDone);
      return {
        d, n,
        icon: done ? 'ph-bold ph-check' : `ph-light ph-${DISC_ICON[k]}`,
        ic: done ? 'var(--c-sec)' : 'var(--c-fg2)',
        bg: done ? 'var(--c-s2)' : 'var(--c-s1)',
        bd: today ? 'var(--c-acc)' : 'var(--c-line)',
        go: () => cid ? GT.set({ disc: k, allenView: 'cardio', cardioId: cid }) : GT.set({ disc: 'palestra', allenSub: 'scheda' })
      };
    });
  }

  function discs(st) {
    return [['palestra', 'Palestra', 'barbell'], ['corsa', 'Corsa', 'person-simple-run'], ['piscina', 'Piscina', 'swimming-pool']].map(([id, label, ic]) => {
      const a = st.disc === id;
      return {
        id, label,
        icon: `${a ? 'ph-fill' : 'ph-light'} ph-${ic}`,
        bg: a ? 'var(--c-acc)' : 'transparent',
        fg: a ? 'var(--c-on-acc)' : 'var(--c-fg)',
        bd: a ? 'var(--c-acc)' : 'var(--c-s3)',
        go: () => GT.set({ disc: id })
      };
    });
  }

  const WEEKS = [['S1', 'RPE 7'], ['S2', 'RPE 7,5'], ['S3', 'RPE 8'], ['S4', 'RPE 8,5'], ['S5', 'Scarico']].map(([w, t], i) => ({
    w, t,
    bg: i === 2 ? 'var(--c-acc)' : i < 2 ? 'var(--c-s3)' : 'transparent',
    fg: i === 2 ? 'var(--c-on-acc)' : i < 2 ? 'var(--c-fg)' : 'var(--c-fg2)',
    bs: i === 4 ? 'dashed' : 'solid',
    bc: i > 2 ? 'var(--c-s3)' : 'transparent'
  }));

  const DAYS = [['Upper A', 'Mar · oggi', 'Panca, rematore, military, trazioni +2', true], ['Lower A', 'Mer', 'Squat, stacco rumeno, affondi, polpacci +1'], ['Upper B', 'Ven', 'Panca inclinata, lat machine, alzate +3'], ['Lower B', 'Sab', 'Stacco, leg press, leg curl +2']]
    .map(([n, d, ex, t]) => ({ n, d, ex, dc: t ? 'var(--c-acc-t)' : 'var(--c-fg3)' }));

  const VOLUME = [['Petto', 12, 10, 20], ['Dorso', 14, 10, 20], ['Spalle', 10, 8, 18], ['Quadricipiti', 9, 8, 16], ['Femorali', 6, 8, 16], ['Glutei', 8, 6, 16], ['Bicipiti', 8, 6, 14], ['Tricipiti', 9, 6, 14], ['Polpacci', 4, 6, 12]]
    .map(([name, sets, mev, mrv]) => {
      const M = 22, low = sets < mev, hi = sets > mrv;
      return {
        name, sets, range: `${mev}–${mrv}`,
        bandL: (mev / M * 100) + '%', bandW: ((mrv - mev) / M * 100) + '%', fill: (sets / M * 100) + '%', fc: 'var(--c-acc)',
        status: low ? `Sotto il minimo · +${mev - sets} serie` : hi ? 'Oltre il recuperabile' : 'Nel range',
        sc: low ? 'var(--c-acc-t)' : 'var(--c-fg3)'
      };
    });

  const PACE_ZONES = [['Z1', 'Recupero', 'oltre 6:15'], ['Z2', 'Fondo', '5:35–6:15'], ['Z3', 'Medio', '5:00–5:35'], ['Z4', 'Soglia', '4:35–5:00'], ['Z5', 'VO2max', 'sotto 4:35']]
    .map(([z, n, p]) => ({ z, n, p: p + ' /km' }));

  const SWIM_STATS = [{ l: 'Questo mese', v: '4.500 m' }, { l: 'Sedute', v: '3' }, { l: 'RPE medio', v: '3' }];

  function runSessions(st) {
    return ['rip', 'lungo'].map(id => {
      const c = GT.CARDIO[id];
      return Object.assign({}, c, {
        id, dist: `${GT.fmt(c.km)} km`, dur: `~${c.min} min`, profile: GT.profileOf(c), done: !!st.cardioDone[id],
        dc: c.tag === 'Qualità' ? 'var(--c-acc-t)' : 'var(--c-fg3)', open: () => openCardio(id)
      });
    });
  }

  function runLib() {
    return ['facile', 'prog', 'soglia', 'fartlek'].map(id => ({ id, n: GT.CARDIO[id].name, d: `${GT.CARDIO[id].tag} · ~${GT.CARDIO[id].min} min`, open: () => openCardio(id) }));
  }

  function swimSessions(st) {
    return ['nuoto1', 'nuoto2', 'nuoto3'].map(id => {
      const c = GT.CARDIO[id];
      return Object.assign({}, c, { id, dist: `${GT.fk(c.m)} m`, dur: `~${c.min} min`, done: !!st.cardioDone[id], dc: 'var(--c-fg3)', open: () => openCardio(id) });
    });
  }

  function libList(st) {
    const q = st.libQuery.trim().toLowerCase();
    return GT.LIB.filter(x => (st.libMuscle === 'Tutti' || x.m === st.libMuscle) && (!q || x.n.toLowerCase().includes(q) || x.m.toLowerCase().includes(q)))
      .map(x => Object.assign({}, x, { open: () => GT.set({ allenView: 'exercise', exDetail: x.id, exBack: null }) }));
  }

  // ---------- Shared markup ----------
  function doneBadge() {
    return html`<span style="font-size:.75rem;font-weight:800;display:flex;gap:4px;align-items:center"><i class="ph-bold ph-check" style="font-size:13px"></i>Fatto</span>`;
  }

  function startButton(d) {
    return html`<button onClick=${A.startSession} style="height:60px;border-radius:12px;background:var(--c-acc);color:var(--c-on-acc);font-size:1.0625rem;font-weight:900;display:flex;align-items:center;justify-content:center;gap:10px"><i class="ph-fill ph-play" style="font-size:20px"></i>${d.startLabel}</button>`;
  }

  // ---------- Palestra ----------
  function palestra(st, d) {
    const isScheda = st.allenSub === 'scheda', isVolume = st.allenSub === 'volume', isLib = st.allenSub === 'libreria';
    const allenSegs = ui.seg([['scheda', 'Scheda'], ['volume', 'Volume'], ['libreria', 'Libreria']], st.allenSub, x => GT.set({ allenSub: x }));
    const list = isLib ? libList(st) : [];
    const libChips = ui.chip(['Tutti', 'Petto', 'Dorso', 'Spalle', 'Gambe', 'Braccia'], st.libMuscle, x => GT.set({ libMuscle: x }));

    return html`
      ${ui.Seg(allenSegs)}
      ${isScheda ? html`
        <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:14px">
          <div style="display:flex;justify-content:space-between;align-items:baseline"><div><div style="font-size:1.125rem;font-weight:900">Upper / Lower · 4 giorni</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">Inizio 20 ott · scarico tra 2 settimane</div></div></div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">
            ${WEEKS.map(w => html`<div key=${w.w} style=${`height:58px;border-radius:8px;padding:8px;display:flex;flex-direction:column;justify-content:space-between;background:${w.bg};color:${w.fg};border:1px ${w.bs} ${w.bc}`}><span style="font-size:.8125rem;font-weight:900">${w.w}</span><span style="font-size:.6875rem;font-weight:700">${w.t}</span></div>`)}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px">
          ${DAYS.map(x => html`
            <button key=${x.n} onClick=${openEditor} style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--c-line);text-align:left;min-height:64px">
              <div><div style="display:flex;gap:8px;align-items:center"><span style="font-size:1rem;font-weight:800">${x.n}</span><span style=${`font-size:.75rem;font-weight:700;color:${x.dc}`}>${x.d}</span></div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:3px">${x.ex}</div></div>
              <i class="ph-light ph-pencil-simple" style="font-size:20px;color:var(--c-fg3)"></i>
            </button>`)}
        </div>
        <button onClick=${openEditor} style="height:52px;border-radius:12px;border:1px solid var(--c-s3);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-light ph-plus" style="font-size:18px"></i>Nuova scheda</button>
        ${!st.workoutDone ? startButton(d) : null}
      ` : null}
      ${isVolume ? html`
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:4px 4px 0"><span style="font-size:1rem;font-weight:800">Settimana 3 · serie allenanti</span><span style="font-size:.75rem;color:var(--c-fg3)">RPE ≥ 7</span></div>
        <div style="display:flex;gap:16px;padding:0 4px;font-size:.75rem;color:var(--c-fg3);align-items:center"><span style="display:flex;gap:6px;align-items:center"><span style="width:18px;height:8px;border-radius:2px;background:var(--c-s3)"></span>Range efficace</span><span style="display:flex;gap:6px;align-items:center"><span style="width:18px;height:4px;border-radius:2px;background:var(--c-fg)"></span>Serie fatte</span></div>
        <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:6px 16px">
          ${VOLUME.map(v => html`
            <div key=${v.name} style="padding:10px 0;border-bottom:1px solid var(--c-line);display:flex;flex-direction:column;gap:7px">
              <div style="display:flex;justify-content:space-between;font-size:.9375rem"><span style="font-weight:700">${v.name}</span><span style="font-variant-numeric:tabular-nums"><b>${v.sets}</b> <span style="color:var(--c-fg3)">/ ${v.range}</span></span></div>
              <div style="position:relative;height:10px;border-radius:3px;background:var(--c-s2)"><div style=${`position:absolute;top:0;bottom:0;left:${v.bandL};width:${v.bandW};background:var(--c-s3);border-radius:2px`}></div><div style=${`position:absolute;top:3px;height:4px;left:0;width:${v.fill};background:${v.fc};border-radius:2px`}></div></div>
              <span style=${`font-size:.75rem;font-weight:700;color:${v.sc}`}>${v.status}</span>
            </div>`)}
        </div>
        <p style="margin:0;padding:0 4px;font-size:.8125rem;line-height:1.5;color:var(--c-fg3)">Range efficace: tra il volume minimo per progredire e il massimo recuperabile. Femorali e polpacci sono sotto: il coach propone 2 serie in più nel Lower B.</p>
      ` : null}
      ${isLib ? html`
        <label style="height:48px;border-radius:12px;background:var(--c-s2);display:flex;align-items:center;gap:10px;padding:0 14px"><i class="ph-light ph-magnifying-glass" style="font-size:20px;color:var(--c-fg3)"></i><input value=${st.libQuery} onInput=${e => GT.set({ libQuery: e.target.value })} placeholder="Cerca esercizio" style="flex:1;border:0;outline:0;background:none;font-size:1rem;height:44px" /></label>
        <div style="display:flex;gap:6px;overflow-x:auto;margin:0 -16px;padding:0 16px">
          ${libChips.map(c => html`<button key=${c.label} onClick=${c.go} style=${`flex:none;height:36px;padding:0 14px;border-radius:999px;font-size:.8125rem;font-weight:700;background:${c.bg};color:${c.fg};border:1px solid var(--c-s3)`}>${c.label}</button>`)}
        </div>
        <div style="display:flex;flex-direction:column">
          ${list.map(x => html`
            <button key=${x.id} onClick=${x.open} style="display:grid;grid-template-columns:56px 1fr auto;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--c-line);text-align:left">
              <div style="width:56px;height:56px;border-radius:8px;background:var(--c-s2);display:grid;place-items:center"><i class="ph-fill ph-play" style="font-size:16px;color:var(--c-fg3)"></i></div>
              <div><div style="font-weight:700;font-size:.9375rem">${x.n}</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">${x.m} · ${x.eq}</div></div>
              <i class="ph-light ph-caret-right" style="font-size:18px;color:var(--c-fg3)"></i>
            </button>`)}
          ${!list.length ? html`<div style="padding:32px 8px;text-align:center;color:var(--c-fg3);font-size:.9375rem">Nessun esercizio per “${st.libQuery}”.<br />Prova con il nome del muscolo.</div>` : null}
        </div>
      ` : null}
    `;
  }

  // ---------- Corsa ----------
  function corsa(st) {
    const runKmDone = GT.fmt(['rip', 'lungo'].reduce((a, id) => a + (st.cardioDone[id] ? st.cardioDone[id].v : 0), 0));
    return html`
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-end"><div><div style="font-size:.75rem;color:var(--c-fg3)">Volume corsa · settimana 3</div><div style="font-size:2.25rem;font-weight:900;letter-spacing:-.03em;line-height:1.05;font-variant-numeric:tabular-nums">${runKmDone} <span style="font-size:1rem;font-weight:700;color:var(--c-fg2)">/ 23,2 km</span></div></div><div style="text-align:right;font-size:.8125rem;color:var(--c-fg3);line-height:1.5">Sett. 2: 20,4 km<br />+14% · limite +15%</div></div>
        <div><div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--c-fg3);margin-bottom:6px"><span>Intensità pianificata</span><span>78% facile · 22% qualità</span></div><div style="display:flex;gap:2px;height:10px;border-radius:3px;overflow:hidden"><div style="width:78%;background:var(--c-sec)"></div><div style="width:22%;background:var(--c-acc)"></div></div></div>
      </div>
      <div style=${EYEBROW_PAD}>Programma corsa</div>
      ${runSessions(st).map(c => html`
        <button key=${c.id} onClick=${c.open} style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;text-align:left">
          <div style="display:flex;justify-content:space-between;width:100%;align-items:center"><span style=${`font-size:.75rem;font-weight:800;color:${c.dc}`}>${c.day} · ${c.tag}</span>${c.done ? doneBadge() : null}</div>
          <div style="font-size:1.25rem;font-weight:900;letter-spacing:-.01em">${c.name}</div>
          <div style="display:flex;align-items:flex-end;gap:2px;height:28px;width:100%">${c.profile.map((b, i) => html`<div key=${i} style=${`flex:${b.f};height:${b.h};background:${b.bg};border-radius:2px`}></div>`)}</div>
          <div style="display:flex;gap:14px;font-size:.8125rem;color:var(--c-fg2);font-variant-numeric:tabular-nums"><span>${c.dist}</span><span>${c.dur}</span><span>RPE ${c.rpe}</span></div>
        </button>`)}
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:6px 16px">
        <div style="display:flex;justify-content:space-between;padding:10px 0"><span style=${S.eyebrow}>Zone di passo</span><span style="font-size:.75rem;color:var(--c-fg3)">da 10 km in 47:30</span></div>
        ${PACE_ZONES.map(z => html`<div key=${z.z} style="display:grid;grid-template-columns:36px 1fr auto;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--c-line);font-size:.875rem"><span style="font-weight:900">${z.z}</span><span>${z.n}</span><span style="font-weight:800;font-variant-numeric:tabular-nums">${z.p}</span></div>`)}
      </div>
      <div style=${EYEBROW_PAD}>Libreria allenamenti</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${runLib().map(r => html`<button key=${r.id} onClick=${r.open} style="min-height:64px;padding:10px 12px;border-radius:12px;border:1px solid var(--c-s3);text-align:left;display:flex;flex-direction:column;justify-content:center;gap:2px"><span style="font-weight:800;font-size:.9375rem">${r.n}</span><span style="font-size:.75rem;color:var(--c-fg3)">${r.d}</span></button>`)}</div>
      <div style="border:1px dashed var(--c-s3);border-radius:12px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start"><i class="ph-light ph-person-simple-run" style="font-size:22px;color:var(--c-fg3);flex:none"></i><div><div style="display:flex;gap:8px;align-items:center"><span style="font-weight:800">Corse registrate</span><span style=${BADGE}>Strava · in arrivo</span></div><div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.45;margin-top:4px">Con Strava passo, FC e dislivello arrivano da soli. Ora registri a mano distanza, tempo e RPE.</div></div></div>
    `;
  }

  // ---------- Piscina ----------
  function piscina(st) {
    return html`
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:16px;display:flex;gap:12px;align-items:flex-start"><span style="flex:none;width:36px;height:36px;border-radius:50%;background:var(--c-acc);color:var(--c-on-acc);display:grid;place-items:center"><i class="ph-bold ph-lightning" style="font-size:18px"></i></span><div><div style=${S.eyebrow}>Ruolo della piscina</div><p style="margin:4px 0 0;font-size:.9375rem;line-height:1.45">Defaticamento: nuoto aerobico a RPE 3–4, il giorno dopo il lungo o dopo le gambe. Non conta nel volume di palestra.</p></div></div>
      <div style="flex:none;display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--c-line);border:1px solid var(--c-line);border-radius:12px;overflow:hidden">${SWIM_STATS.map(s => html`<div key=${s.l} style="background:var(--c-s1);padding:12px"><div style="font-size:.75rem;color:var(--c-fg3)">${s.l}</div><div style="font-size:1.375rem;font-weight:900;font-variant-numeric:tabular-nums">${s.v}</div></div>`)}</div>
      <div style=${EYEBROW_PAD}>Sedute di recupero</div>
      ${swimSessions(st).map(c => html`
        <button key=${c.id} onClick=${c.open} style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;text-align:left">
          <div style="display:flex;justify-content:space-between;width:100%;align-items:center"><span style=${`font-size:.75rem;font-weight:800;color:${c.dc}`}>${c.day} · ${c.tag}</span>${c.done ? doneBadge() : null}</div>
          <div style="font-size:1.25rem;font-weight:900;letter-spacing:-.01em">${c.name}</div>
          <div style="display:flex;gap:14px;font-size:.8125rem;color:var(--c-fg2);font-variant-numeric:tabular-nums"><span>${c.dist}</span><span>${c.dur}</span><span>RPE ${c.rpe}</span></div>
        </button>`)}
      <div style="border:1px dashed var(--c-s3);border-radius:12px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start"><i class="ph-light ph-watch" style="font-size:22px;color:var(--c-fg3);flex:none"></i><div><div style="display:flex;gap:8px;align-items:center"><span style="font-weight:800">Vasche e SWOLF</span><span style=${BADGE}>Garmin · in arrivo</span></div><div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.45;margin-top:4px">Dall'orologio arriveranno vasche, ritmo per 100 m e FC. Vasca impostata: 25 m.</div></div></div>
    `;
  }

  // ---------- Tab: Allena ----------
  GT.screens.allena = function (st, d) {
    return html`<div class="scroll" style=${S.tabScroll}>
      ${ui.header('Settimana 3 · 9–15 nov', 'Allenamento')}
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
        ${weekPlan(st).map(x => html`<button key=${x.n} onClick=${x.go} style=${`height:84px;border-radius:10px;background:${x.bg};border:1.5px solid ${x.bd};display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:8px 0 7px`}><span style="font-size:.6875rem;font-weight:700;color:var(--c-fg3)">${x.d}</span><span style="font-size:1rem;font-weight:900;font-variant-numeric:tabular-nums">${x.n}</span><i class=${x.icon} style=${`font-size:20px;color:${x.ic}`}></i></button>`)}
      </div>
      <div style="display:flex;gap:16px;padding:0 4px;font-size:.75rem;color:var(--c-fg3)"><span>4 palestra · 2 corsa · 1 piscina</span><span style="margin-left:auto;display:flex;gap:6px;align-items:center"><i class="ph-bold ph-check" style="font-size:12px;color:var(--c-fg)"></i>fatto</span><span style="display:flex;gap:6px;align-items:center"><span style="width:10px;height:10px;border-radius:3px;border:1.5px solid var(--c-acc)"></span>oggi</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
        ${discs(st).map(x => html`<button key=${x.id} onClick=${x.go} aria-pressed=${st.disc === x.id} style=${`height:64px;border-radius:12px;background:${x.bg};color:${x.fg};border:1px solid ${x.bd};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px`}><i class=${x.icon} style="font-size:24px"></i><span style="font-size:.8125rem;font-weight:900">${x.label}</span></button>`)}
      </div>
      ${st.disc === 'palestra' ? palestra(st, d) : null}
      ${st.disc === 'corsa' ? corsa(st) : null}
      ${st.disc === 'piscina' ? piscina(st) : null}
    </div>`;
  };

  // ---------- renderVals() port: cardio detail ----------
  function cardioVals(st) {
    const c = GT.CARDIO[st.cardioId] || GT.CARDIO.rip, run = c.kind === 'corsa', dn = st.cardioDone[st.cardioId];
    return {
      run, dn,
      cd: Object.assign({}, c, {
        back: run ? 'Corsa' : 'Piscina',
        dist: run ? `${GT.fmt(c.km)} km` : `${GT.fk(c.m)} m`,
        dur: `${c.min} min`,
        profile: GT.profileOf(c),
        blocks: c.blocks.map((b, i) => ({ i: i + 1, n: b[0], d: b[1], v: b[2], c: b[3] >= 4 ? 'var(--c-acc-t)' : 'var(--c-fg)' }))
      }),
      cdDoneLine: dn ? `Registrata · ${run ? GT.fmt(dn.v) + ' km' : GT.fk(dn.v) + ' m'} · ${dn.t} min · RPE ${dn.e}` : ''
    };
  }

  // ---------- Full screen: cardio session detail ----------
  GT.screens.cardioDetail = function (st) {
    const { cd, dn, cdDoneLine } = cardioVals(st);
    return [
      html`<div key="cd-scroll" class="scroll" style=${S.full + ';padding:var(--top) 16px calc(var(--pb) + 96px);display:flex;flex-direction:column;gap:14px'}>
        ${ui.back(cd.back, A.closeAllenView)}
        <div><div style=${S.eyebrow}>${cd.day} · ${cd.tag}</div><h2 style="margin:4px 0 0;font-size:1.75rem;font-weight:900;letter-spacing:-.02em;line-height:1.1">${cd.name}</h2></div>
        <div style="flex:none;display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--c-line);border:1px solid var(--c-line);border-radius:12px;overflow:hidden"><div style="background:var(--c-s1);padding:12px"><div style="font-size:.75rem;color:var(--c-fg3)">Distanza</div><div style="font-size:1.25rem;font-weight:900;font-variant-numeric:tabular-nums">${cd.dist}</div></div><div style="background:var(--c-s1);padding:12px"><div style="font-size:.75rem;color:var(--c-fg3)">Durata</div><div style="font-size:1.25rem;font-weight:900;font-variant-numeric:tabular-nums">${cd.dur}</div></div><div style="background:var(--c-s1);padding:12px"><div style="font-size:.75rem;color:var(--c-fg3)">RPE</div><div style="font-size:1.25rem;font-weight:900;font-variant-numeric:tabular-nums">${cd.rpe}</div></div></div>
        <div style="flex:none;display:flex;align-items:flex-end;gap:2px;height:56px">${cd.profile.map((b, i) => html`<div key=${i} style=${`flex:${b.f};height:${b.h};background:${b.bg};border-radius:3px`}></div>`)}</div>
        <div style="display:flex;flex-direction:column;background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:0 16px">
          ${cd.blocks.map(b => html`<div key=${b.i} style="display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--c-line)"><span style="font-weight:900;font-variant-numeric:tabular-nums;color:var(--c-fg3)">${b.i}</span><div><div style="font-weight:800">${b.n}</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">${b.d}</div></div><span style=${`font-weight:900;font-variant-numeric:tabular-nums;text-align:right;color:${b.c}`}>${b.v}</span></div>`)}
        </div>
        <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:14px 16px;display:flex;gap:12px"><span style="flex:none;width:36px;height:36px;border-radius:50%;background:var(--c-acc);color:var(--c-on-acc);display:grid;place-items:center"><i class="ph-bold ph-lightning" style="font-size:18px"></i></span><div><div style=${S.eyebrow}>Coach</div><p style="margin:4px 0 0;font-size:.9375rem;line-height:1.45">${cd.note}</p></div></div>
        <div style="display:flex;gap:10px;align-items:center;padding:12px 14px;border:1px dashed var(--c-s3);border-radius:12px;font-size:.8125rem;color:var(--c-fg3)"><i class="ph-light ph-watch" style="font-size:20px"></i><span style="flex:1">Invio all'orologio</span><span style=${BADGE}>Garmin · in arrivo</span></div>
      </div>`,
      html`<div key="cd-bar" style="position:absolute;left:0;right:0;bottom:0;z-index:21;padding:12px 16px var(--pb);background:var(--c-bg);border-top:1px solid var(--c-line)">
        ${!dn ? html`<button onClick=${A.openCardioLog} style="height:64px;width:100%;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);font-size:1.125rem;font-weight:900;display:flex;align-items:center;justify-content:center;gap:10px"><i class="ph-bold ph-check" style="font-size:22px"></i>Registra seduta</button>` : null}
        ${dn ? html`<div style="height:64px;border-radius:14px;background:var(--c-s2);display:flex;align-items:center;justify-content:center;gap:10px;font-weight:800"><i class="ph-bold ph-check" style="font-size:18px"></i>${cdDoneLine}</div>` : null}
      </div>`
    ];
  };

  // ---------- Sheet: cardio log ----------
  GT.screens.cardioLog = function (st) {
    const c = GT.CARDIO[st.cardioId] || GT.CARDIO.rip, run = c.kind === 'corsa', L = st.log;
    if (!L) return null;
    const stp = run ? 0.1 : 50;
    const setLog = fn => GT.set(s => ({ log: Object.assign({}, s.log, fn(s.log)) }));
    const logFields = [
      {
        l: run ? 'Distanza' : 'Metri', v: run ? `${GT.fmt(L.v)} km` : `${GT.fk(L.v)} m`,
        dec: () => setLog(l => ({ v: Math.max(stp, Math.round((l.v - stp) * 10) / 10) })),
        inc: () => setLog(l => ({ v: Math.round((l.v + stp) * 10) / 10 }))
      },
      {
        l: 'Tempo', v: `${L.t} min`,
        dec: () => setLog(l => ({ t: Math.max(1, l.t - 1) })),
        inc: () => setLog(l => ({ t: l.t + 1 }))
      }
    ];
    const pace = run ? L.t / L.v : L.t / (L.v / 100);
    const logPace = run ? `Passo medio ${GT.mmss(Math.round(pace * 60))} /km` : `Ritmo medio ${GT.mmss(Math.round(pace * 60))} /100 m`;
    const logRpe = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => ({
      n, bg: L.e === n ? 'var(--c-acc)' : 'var(--c-s2)', fg: L.e === n ? 'var(--c-on-acc)' : 'var(--c-fg)', go: () => setLog(() => ({ e: n }))
    }));

    return ui.sheet(() => GT.set({ overlay: null }), html`
      <div><div style="font-size:1.25rem;font-weight:900">Registra seduta</div><div style="font-size:.875rem;color:var(--c-fg3);margin-top:2px">${c.name} · valori pianificati, correggi se serve</div></div>
      ${logFields.map(f => html`<div key=${f.l} style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:800">${f.l}</span><div style="display:flex;align-items:center;gap:4px;background:var(--c-s2);border-radius:12px"><button onClick=${f.dec} aria-label="Meno" style="width:52px;height:52px;display:grid;place-items:center"><i class="ph-light ph-minus" style="font-size:20px"></i></button><span style="min-width:96px;text-align:center;font-size:1.375rem;font-weight:900;font-variant-numeric:tabular-nums">${f.v}</span><button onClick=${f.inc} aria-label="Più" style="width:52px;height:52px;display:grid;place-items:center"><i class="ph-light ph-plus" style="font-size:20px"></i></button></div></div>`)}
      <div style="font-size:.8125rem;color:var(--c-fg3);font-variant-numeric:tabular-nums">${logPace}</div>
      <div><div style="font-weight:800;margin-bottom:8px">RPE della seduta</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px">${logRpe.map(o => html`<button key=${o.n} onClick=${o.go} aria-pressed=${L.e === o.n} style=${`height:44px;border-radius:10px;font-weight:900;background:${o.bg};color:${o.fg}`}>${o.n}</button>`)}</div></div>
      <button onClick=${A.saveCardio} style="height:60px;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);font-size:1.0625rem;font-weight:900">Salva</button>
    `);
  };
})();
