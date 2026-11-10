/* GreyTraining — Coach tab, Profile (full screen) and Readiness check-in sheet.
   Port of design-reference/GreyTraining.dc.html: COACH (lines 488-526), PROFILO (528-561),
   READINESS SHEET (690-702) and the matching part of renderVals(). */
(function () {
  'use strict';
  var GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  // ---------- Coach ----------

  // Keep the newest chat message visible: scroll the coach container to the bottom whenever
  // the chat length or the typing indicator changes (also if it changed while on another tab).
  let lastSig = null;
  const keepBottom = sig => el => {
    if (!el) return;
    if (lastSig !== null && sig !== lastSig) {
      requestAnimationFrame(() => { try { el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); } catch (e) { el.scrollTop = el.scrollHeight; } });
    }
    lastSig = sig;
  };

  const coachActionsOf = st => GT.ACTIONS.filter(a => st.coach[a.id] !== 'skip').map(a => Object.assign({}, a, {
    pending: !st.coach[a.id], done: st.coach[a.id] === 'ok',
    apply: () => A.coachAction(a.id, 'ok', a),
    skip: () => A.coachAction(a.id, 'skip', a)
  }));

  const PROMPTS = ['Perché lo scarico?', 'Cosa mangio a cena?', 'Fastidio alla spalla'];

  GT.screens.coach = function (st, d) {
    const coachA = GT.v('vCoach') === 'A', coachB = GT.v('vCoach') === 'B';
    const coachActions = coachActionsOf(st);
    const coachPending = `${GT.ACTIONS.filter(a => !st.coach[a.id]).length} da decidere`;
    const chat = st.chat.map(m => ({
      t: m.t, justify: m.who === 'u' ? 'flex-end' : 'flex-start',
      bg: m.who === 'u' ? 'var(--c-acc)' : 'var(--c-s1)', fg: m.who === 'u' ? 'var(--c-on-acc)' : 'var(--c-fg)',
      bd: m.who === 'u' ? 'var(--c-acc)' : 'var(--c-line)'
    }));
    const prompts = PROMPTS.map(t => ({ t, go: () => A.sendChat(t) }));
    const onChatInput = e => GT.set({ chatInput: e.target.value });
    const onChatKey = e => { if (e.key === 'Enter') A.sendChat(); };
    const sendChat = () => A.sendChat();

    return [
      html`<div key="coach-scroll" class="scroll" ref=${keepBottom(st.chat.length + '|' + !!st.typing)} style="position:absolute;inset:0;overflow-y:auto;padding:calc(var(--top) + 8px) 16px calc(var(--tabH) + 150px);display:flex;flex-direction:column;gap:12px">
        ${ui.header('Scienze motorie · nutrizione', 'Coach')}
        ${coachB ? html`
          <div style="display:flex;justify-content:space-between;align-items:baseline;padding:0 4px"><span style="font-size:1rem;font-weight:900">Azioni proposte · S3</span><span style="font-size:.75rem;color:var(--c-fg3)">${coachPending}</span></div>
          <div style="flex:none;display:flex;gap:10px;overflow-x:auto;margin:0 -16px;padding:0 16px;scroll-snap-type:x mandatory">
            ${coachActions.map(a => html`
              <div key=${a.id} style="flex:none;width:280px;scroll-snap-align:start;background:var(--c-s1);border:1px solid var(--c-line);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px">
                <i class=${a.icon} style="font-size:26px"></i><div style="font-weight:900;font-size:1.0625rem">${a.title}</div><div style="font-size:.875rem;color:var(--c-fg2);line-height:1.45;flex:1">${a.body}</div>
                ${a.pending ? html`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button onClick=${a.apply} style="height:48px;border-radius:10px;background:var(--c-acc);color:var(--c-on-acc);font-weight:900;font-size:.875rem">${a.cta}</button><button onClick=${a.skip} style="height:48px;border-radius:10px;background:var(--c-s2);font-weight:800;font-size:.875rem">Non ora</button></div>` : null}
                ${a.done ? html`<div style="height:48px;display:flex;gap:8px;align-items:center;font-size:.875rem;font-weight:800;color:var(--c-fg2)"><i class="ph-bold ph-check" style="font-size:16px"></i>${a.doneLabel}</div>` : null}
              </div>`)}
          </div>` : null}
        ${coachA ? html`
          <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:1.125rem;font-weight:900">Analisi settimana 3</span><span style="font-size:.75rem;color:var(--c-fg3)">lun 10 nov</span></div>
            <div style="font-size:.9375rem;line-height:1.45;color:var(--c-fg2)">4/4 sessioni, volume +8% su settimana 2. RPE medio 7,9 sul target 8. Peso −0,3 kg: in linea con la ricomposizione.</div>
            ${coachActions.map(a => html`
              <div key=${a.id} style="border-top:1px solid var(--c-line);padding-top:12px;display:flex;flex-direction:column;gap:10px">
                <div style="display:flex;gap:10px"><i class=${a.icon} style="font-size:20px;flex:none;margin-top:1px"></i><div><div style="font-weight:800">${a.title}</div><div style="font-size:.875rem;color:var(--c-fg2);line-height:1.45;margin-top:2px">${a.body}</div></div></div>
                ${a.pending ? html`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button onClick=${a.apply} style="height:44px;border-radius:10px;background:var(--c-acc);color:var(--c-on-acc);font-weight:900;font-size:.875rem">${a.cta}</button><button onClick=${a.skip} style="height:44px;border-radius:10px;background:var(--c-s2);font-weight:800;font-size:.875rem">Non ora</button></div>` : null}
                ${a.done ? html`<div style="display:flex;gap:8px;align-items:center;font-size:.875rem;font-weight:800;color:var(--c-fg2)"><i class="ph-bold ph-check" style="font-size:16px"></i>${a.doneLabel}</div>` : null}
              </div>`)}
          </div>` : null}
        ${chat.map((m, i) => html`
          <div key=${'m' + i} style=${`display:flex;justify-content:${m.justify}`}><div style=${`max-width:84%;padding:12px 14px;border-radius:16px;font-size:.9375rem;line-height:1.45;background:${m.bg};color:${m.fg};border:1px solid ${m.bd};animation:gtFade .28s ease`}>${m.t}</div></div>`)}
        ${st.typing ? html`<div key="typing" role="status" aria-label="Il coach sta scrivendo" style="display:flex;gap:5px;padding:14px 16px;background:var(--c-s1);border:1px solid var(--c-line);border-radius:16px;width:fit-content"><span style="width:7px;height:7px;border-radius:50%;background:var(--c-fg2);animation:gtDot 1.2s infinite"></span><span style="width:7px;height:7px;border-radius:50%;background:var(--c-fg2);animation:gtDot 1.2s .2s infinite"></span><span style="width:7px;height:7px;border-radius:50%;background:var(--c-fg2);animation:gtDot 1.2s .4s infinite"></span></div>` : null}
      </div>`,
      html`<div key="coach-bar" style="position:absolute;left:0;right:0;bottom:var(--tabH);padding:10px 16px;background:var(--c-bg);border-top:1px solid var(--c-line);display:flex;flex-direction:column;gap:8px;z-index:25">
        <div style="display:flex;gap:6px;overflow-x:auto;margin:0 -16px;padding:0 16px">${prompts.map(p => html`<button key=${p.t} onClick=${p.go} style="flex:none;height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--c-s3);font-size:.8125rem;font-weight:700">${p.t}</button>`)}</div>
        <div style="display:flex;gap:8px"><input value=${st.chatInput} onInput=${onChatInput} onKeyDown=${onChatKey} placeholder="Chiedi al coach" aria-label="Chiedi al coach" enterkeyhint="send" style="flex:1;height:48px;border-radius:12px;border:0;outline:0;background:var(--c-s2);padding:0 14px;font-size:1rem" /><button onClick=${sendChat} aria-label="Invia" style="width:48px;height:48px;border-radius:12px;background:var(--c-acc);color:var(--c-on-acc);display:grid;place-items:center"><i class="ph-fill ph-paper-plane-right" style="font-size:20px"></i></button></div>
      </div>`
    ];
  };

  // ---------- Profile ----------

  const GOALS = ['Massa', 'Definizione', 'Forza', 'Ricomposizione'];
  const INTEGRATIONS = [
    ['garmin', 'Garmin Connect', 'ph-light ph-watch', 'Sonno, recupero, frequenza cardiaca', ['Sonno', 'HRV', 'FC a riposo', 'Readiness', 'Stress']],
    ['strava', 'Strava', 'ph-light ph-person-simple-run', 'Corsa, bici, carico complessivo', ['Corse', 'Uscite in bici', 'Carico settimanale', 'Zone FC']]
  ];
  const BG_HEX = { nero: '#000000', grafite: '#1A1B1E', caldo: '#191614' };
  const BG_KEYS = ['nero', 'grafite', 'caldo'];

  // Swatches: ring + check on the active colour, check colour by perceived brightness
  const sw = (list, cur, key) => list.map(([c, name]) => {
    const a = String(cur || '').toUpperCase() === c.toUpperCase();
    const L = parseInt(c.slice(1, 3), 16) * 0.3 + parseInt(c.slice(3, 5), 16) * 0.59 + parseInt(c.slice(5, 7), 16) * 0.11;
    return { c, name, ring: a ? 'var(--c-fg)' : 'transparent', icon: a ? 'ph-bold ph-check' : '', on: L > 140 ? '#000' : '#FFFBF9', go: () => GT.set({ [key]: c }) };
  });

  GT.screens.profile = function (st, d) {
    const goals = ui.chip(GOALS, st.goal, x => GT.set({ goal: x }));
    const eqKeys = Object.keys(st.equip);
    const equip = ui.chip(eqKeys, eqKeys.filter(k => st.equip[k]), x => GT.set(s => ({ equip: Object.assign({}, s.equip, { [x]: !s.equip[x] }) })));
    const integrations = INTEGRATIONS.map(([id, name, icon, desc, data]) => {
      const on = st.notify[id];
      return {
        id, name, icon, desc, data, bg: on ? 'var(--c-s2)' : 'transparent', fg: 'var(--c-fg)',
        bIcon: on ? 'ph-bold ph-check' : 'ph-light ph-bell', bLabel: on ? 'Ti avviseremo al rilascio' : 'Avvisami quando è disponibile',
        toggle: () => GT.set(s => ({ notify: Object.assign({}, s.notify, { [id]: !s.notify[id] }) }))
      };
    });
    const colorRows = [
      { l: 'Colore primario', d: 'Azioni, selezioni, grafici', opts: sw(GT.PRIMARY_OPTS, st.primary, 'primary') },
      { l: 'Colore secondario', d: 'Completato, serie secondarie', opts: sw(GT.SECONDARY_OPTS, st.secondary, 'secondary') },
      { l: 'Tono sfondo', d: 'Solo tema scuro', opts: sw([['#000000', 'Nero'], ['#1A1B1E', 'Grafite'], ['#191614', 'Caldo']], BG_HEX[st.bgTone], '_bg').map((o, i) => Object.assign({}, o, { go: () => GT.set({ bgTone: BG_KEYS[i] }) })) }
    ];
    const prefs = [
      { l: 'Tema', opts: ui.seg([['dark', 'Scuro'], ['light', 'Chiaro']], st.theme, x => GT.set({ theme: x })) },
      { l: 'Sforzo', opts: ui.seg(['RPE', 'RIR'], st.effort, x => GT.set({ effort: x })) },
      { l: 'Testo', opts: ui.seg([[1, 'A'], [1.125, 'A+'], [1.25, 'A++']], st.scale, x => GT.set({ scale: x })) },
      // Units are not switchable yet (no-op, as in the prototype)
      { l: 'Unità', opts: ui.seg([['kg', 'kg · cm'], ['lb', 'lb · in']], 'kg', () => {}) }
    ];
    const closeOverlay = () => GT.set({ overlay: null });

    return html`<div class="scroll" style="position:absolute;inset:0;z-index:20;background:var(--c-bg);overflow-y:auto;padding:var(--top) 16px calc(var(--pb) + 14px);display:flex;flex-direction:column;gap:14px">
      ${ui.back('Oggi', closeOverlay)}
      <div style="display:flex;gap:14px;align-items:center"><span style="width:64px;height:64px;border-radius:50%;background:var(--c-s2);display:grid;place-items:center;font-weight:900;font-size:1.25rem">GT</span><div><h1 style="margin:0;font-size:1.75rem;font-weight:900;letter-spacing:-.02em">Profilo</h1><div style="font-size:.875rem;color:var(--c-fg3);font-variant-numeric:tabular-nums">34 anni · 180 cm · 78,4 kg</div></div></div>
      <div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3);margin-top:6px">Obiettivo</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${goals.map(g => html`<button key=${g.label} onClick=${g.go} aria-pressed=${g.active} style=${`height:52px;border-radius:12px;font-weight:800;background:${g.bg};color:${g.fg};border:1px solid var(--c-s3)`}>${g.label}</button>`)}</div>
      <div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3);margin-top:6px">Infortuni e limitazioni</div>
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:6px 16px">
        <div style="padding:12px 0;border-bottom:1px solid var(--c-line)"><div style="font-weight:800">Spalla sinistra</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">Evita dip e military sopra RPE 8. Il coach propone alternative.</div></div>
        <button style="height:48px;display:flex;align-items:center;gap:8px;font-weight:800;font-size:.875rem;width:100%"><i class="ph-light ph-plus" style="font-size:18px"></i>Aggiungi limitazione</button>
      </div>
      <div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3);margin-top:6px">Attrezzatura disponibile</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${equip.map(e => html`<button key=${e.label} onClick=${e.go} aria-pressed=${e.active} style=${`height:40px;padding:0 14px;border-radius:999px;font-size:.8125rem;font-weight:800;background:${e.bg};color:${e.fg};border:1px solid var(--c-s3)`}>${e.label}</button>`)}</div>
      <div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3);margin-top:6px">Integrazioni</div>
      ${integrations.map(ig => html`
        <div key=${ig.id} style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;align-items:center;gap:12px"><span style="width:44px;height:44px;border-radius:10px;background:var(--c-s2);display:grid;place-items:center"><i class=${ig.icon} style="font-size:24px"></i></span><div style="flex:1"><div style="font-weight:900;font-size:1.0625rem">${ig.name}</div><div style="font-size:.8125rem;color:var(--c-fg3)">${ig.desc}</div></div><span style="font-size:.6875rem;font-weight:800;padding:5px 9px;border-radius:999px;border:1px solid var(--c-s3);color:var(--c-fg2)">In arrivo</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${ig.data.map(x => html`<span key=${x} style="font-size:.75rem;font-weight:700;padding:6px 10px;border-radius:6px;background:var(--c-s2);color:var(--c-fg2)">${x}</span>`)}</div>
          <button onClick=${ig.toggle} style=${`height:48px;border-radius:10px;font-weight:800;font-size:.875rem;display:flex;align-items:center;justify-content:center;gap:8px;background:${ig.bg};color:${ig.fg};border:1px solid var(--c-s3)`}><i class=${ig.bIcon} style="font-size:18px"></i>${ig.bLabel}</button>
        </div>`)}
      <div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3);margin-top:6px">Preferenze</div>
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:4px 16px">
        ${prefs.map(p => html`<div key=${p.l} style="display:flex;justify-content:space-between;align-items:center;min-height:60px;border-bottom:1px solid var(--c-line);gap:10px"><span style="font-weight:700">${p.l}</span><div style="display:flex;gap:2px;background:var(--c-s2);border-radius:9px;padding:3px">${p.opts.map(o => html`<button key=${o.label} onClick=${o.go} aria-pressed=${o.active} style=${`height:36px;min-width:52px;padding:0 10px;border-radius:7px;font-size:.8125rem;font-weight:800;background:${o.bg};color:${o.fg}`}>${o.label}</button>`)}</div></div>`)}
      </div>
      <div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3);margin-top:6px">Colori</div>
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:4px 16px">
        ${colorRows.map(cr => html`<div key=${cr.l} style="display:flex;flex-direction:column;gap:10px;padding:14px 0;border-bottom:1px solid var(--c-line)"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:700">${cr.l}</span><span style="font-size:.75rem;color:var(--c-fg3)">${cr.d}</span></div><div style="display:flex;gap:10px;flex-wrap:wrap">${cr.opts.map(o => html`<button key=${o.c} onClick=${o.go} aria-label=${o.name} aria-pressed=${!!o.icon} style=${`width:48px;height:48px;border-radius:50%;padding:4px;border:2px solid ${o.ring}`}><span style=${`display:grid;place-items:center;width:100%;height:100%;border-radius:50%;background:${o.c};border:1px solid var(--c-s3);color:${o.on}`}><i class=${o.icon} style="font-size:16px"></i></span></button>`)}</div></div>`)}
        <div style="display:flex;gap:8px;padding:14px 0;align-items:center"><span style="flex:1;height:44px;border-radius:10px;background:var(--c-acc);color:var(--c-on-acc);display:grid;place-items:center;font-weight:900;font-size:.875rem">Primario</span><span style="flex:1;height:44px;border-radius:10px;background:var(--c-sec);color:var(--c-on-sec);display:grid;place-items:center;font-weight:900;font-size:.875rem">Secondario</span><span style="flex:1;height:44px;border-radius:10px;background:var(--c-s2);display:grid;place-items:center;font-weight:800;font-size:.875rem">Superficie</span></div>
      </div>
      <div style="font-size:.75rem;color:var(--c-fg3);line-height:1.5;padding:0 4px">Il coach dà indicazioni su allenamento e alimentazione, non valutazioni mediche. Per dolori persistenti rivolgiti a un professionista sanitario.</div>
    </div>`;
  };

  // ---------- Readiness check-in sheet ----------

  const READY_ROWS = [['sonno', 'Sonno percepito', 'Pessimo', 'Ottimo'], ['energia', 'Energia', 'Bassa', 'Alta'], ['dolori', 'Indolenzimento', 'Forte', 'Nessuno']];

  GT.screens.readiness = function (st, d) {
    const r = st.ready;
    const readinessRows = READY_ROWS.map(([k, label, lo, hi]) => ({
      k, label, lo, hi,
      opts: [1, 2, 3, 4, 5].map(n => ({
        n, bg: r[k] === n ? 'var(--c-acc)' : 'var(--c-s2)', fg: r[k] === n ? 'var(--c-on-acc)' : 'var(--c-fg)',
        go: () => GT.set(s => ({ ready: Object.assign({}, s.ready, { [k]: n }) }))
      }))
    }));
    const closeOverlay = () => GT.set({ overlay: null });

    return [
      html`<button key="ready-scrim" onClick=${closeOverlay} aria-label="Chiudi" style="position:absolute;inset:0;background:rgba(0,0,0,.6);z-index:50;animation:gtFade .2s ease"></button>`,
      html`<div key="ready-sheet" role="dialog" aria-modal="true" aria-label="Check-in di oggi" style="position:absolute;left:0;right:0;bottom:0;z-index:51;background:var(--c-s1);border-radius:24px 24px 0 0;padding:12px 16px var(--pb);display:flex;flex-direction:column;gap:16px;animation:gtSheet .28s cubic-bezier(.2,0,0,1)">
        <span style="width:40px;height:5px;border-radius:3px;background:var(--c-s3);align-self:center"></span>
        <div><div style="font-size:1.25rem;font-weight:900">Check-in di oggi</div><div style="font-size:.875rem;color:var(--c-fg3);margin-top:2px">30 secondi. Il coach adatta volume e intensità.</div></div>
        ${readinessRows.map(row => html`
          <div key=${row.k} style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;font-size:.875rem"><span style="font-weight:800">${row.label}</span><span style="color:var(--c-fg3)">${row.lo} → ${row.hi}</span></div>
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">${row.opts.map(o => html`<button key=${o.n} onClick=${o.go} aria-label=${`${row.label} ${o.n}`} aria-pressed=${r[row.k] === o.n} style=${`height:52px;border-radius:10px;font-size:1.125rem;font-weight:900;background:${o.bg};color:${o.fg}`}>${o.n}</button>`)}</div></div>`)}
        <button onClick=${closeOverlay} style="height:60px;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);font-size:1.0625rem;font-weight:900">Salva · readiness ${d.score}</button>
      </div>`
    ];
  };
})();
