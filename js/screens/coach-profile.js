/* GreyTraining — Coach tab, Profile (full screen) and Readiness check-in sheet.
   Port of design-reference/GreyTraining.dc.html: COACH, PROFILO and READINESS SHEET.
   Everything shown comes from the user's own profile, plan and logs (no sample data). */
(function () {
  'use strict';
  var GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  // Signed number with a real minus: 0.3 -> "+0,3", -0.3 -> "−0,3"
  const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + GT.fmt(Math.abs(n));

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

  // Has the user logged anything at all? (the onboarding weigh-in alone does not count)
  function hasAnyLog(st) {
    const L = st.logs || {};
    const foodDays = Object.keys(L.food || {}).filter(k => Object.keys(L.food[k] || {}).some(m => (L.food[k][m] || []).length));
    return (L.sessions || []).length > 0 || (L.cardio || []).length > 0 || foodDays.length > 0 || (L.weights || []).length > 1;
  }

  // Weight trend read against the goal (only when it clearly matches)
  function weightNote(goal, delta) {
    if (goal === 'massa' && delta > 0 && delta <= 1) return ', in linea con la massa';
    if (goal === 'definizione' && delta < 0 && delta >= -1.5) return ', in linea con la definizione';
    if (goal === 'ricomposizione' && Math.abs(delta) <= 0.5) return ', in linea con la ricomposizione';
    return '';
  }

  // Weekly analysis: { num, range, text } from GT.weekReview of the current week
  function weekSummary(st, d) {
    const mon = GT.mondayOf(d.today), sun = GT.addDays(mon, 6);
    const out = { num: d.cycle.num, range: GT.fmtRange(mon, sun) };
    if (!hasAnyLog(st)) {
      out.text = 'Prima settimana: registra allenamenti, pasti e peso; l’analisi si aggiorna da sola.';
      return out;
    }
    const r = GT.weekReview(st, mon), parts = [];
    if (d.cycle.deload) parts.push(`Settimana di scarico: ${GT.deloadText(st.plan, d.cycle.index)}`);
    if (r.done) parts.push((r.planned ? `${r.done}/${r.planned} sedute` : `${r.done} sedute`) + (r.gym ? `, ${r.hardSets} serie allenanti` : '') + '.');
    else parts.push(r.planned ? `Nessuna seduta registrata finora su ${r.planned} in programma.` : 'Nessuna seduta registrata questa settimana.');
    parts.push(r.dietDays ? `Calorie nel target (±10%) in ${r.dietInRange} giorni su ${r.dietDays} registrati.` : 'Nessun pasto registrato questa settimana.');
    if (r.weightDelta != null) {
      parts.push(Math.abs(r.weightDelta) < 0.05 ? 'Peso stabile sulle ultime pesate.' : `Peso ${signed(r.weightDelta)} kg sulle ultime pesate${weightNote((st.profile || {}).goal, r.weightDelta)}.`);
    } else parts.push('Pesati 2–3 volte a settimana per vedere il trend.');
    out.text = parts.join(' ');
    return out;
  }

  // "Ho un fastidio …" with the right preposition for each limitation area
  const LIMIT_PREP = { spalla: 'alla spalla', gomito: 'al gomito', polso: 'al polso', schiena: 'alla zona lombare', collo: 'al collo', anca: 'all’anca', ginocchio: 'al ginocchio', caviglia: 'alla caviglia' };

  // Three quick prompts that depend on the time of day, the profile and today's plan
  function quickPrompts(st, d) {
    const h = new Date().getHours();
    const meal = h < 10 ? 'colazione' : h < 15 ? 'pranzo' : 'cena';
    const out = [`Cosa mangio a ${meal}?`, 'Come va la settimana?'];
    const lim = ((st.profile || {}).limitations || [])[0];
    if (lim && LIMIT_PREP[lim.k]) out.push(`Ho un fastidio ${LIMIT_PREP[lim.k]}`);
    else if (d.cycle.deload) out.push('Perché lo scarico?');
    else out.push('Cambia un esercizio');
    return out;
  }

  GT.screens.coach = function (st, d) {
    const variantB = GT.v('vCoach') === 'B';
    const actions = GT.coachActions(st).map(a => Object.assign({}, a, {
      apply: () => A.coachAction(a, 'ok'),
      skip: () => A.coachAction(a, 'skip')
    }));
    const week = weekSummary(st, d);
    const chat = (st.chat || []).map((m, i) => ({
      key: 'm' + i + '-' + (m.at || 0), t: m.t, justify: m.who === 'u' ? 'flex-end' : 'flex-start',
      bg: m.who === 'u' ? 'var(--c-acc)' : 'var(--c-s1)', fg: m.who === 'u' ? 'var(--c-on-acc)' : 'var(--c-fg)',
      bd: m.who === 'u' ? 'var(--c-acc)' : 'var(--c-line)'
    }));
    const prompts = quickPrompts(st, d).map(t => ({ t, go: () => A.sendChat(t) }));
    const onChatInput = e => GT.set({ chatInput: e.target.value });
    const onChatKey = e => { if (e.key === 'Enter') A.sendChat(); };
    const sendChat = () => A.sendChat();
    const canSend = !!String(st.chatInput || '').trim() && !st.typing;
    // A running workout shows app.js's mini-bar (56 px at tabH + 8): the chat bar sits above it
    const mini = st.s ? 72 : 0;

    const noActions = html`<div style="display:flex;gap:10px;align-items:flex-start">
      <i class="ph-light ph-check-circle" style="font-size:20px;flex:none;margin-top:1px;color:var(--c-fg3)"></i>
      <div><div style="font-weight:800">Nessuna azione per ora</div><div style="font-size:.875rem;color:var(--c-fg2);line-height:1.45;margin-top:2px">Le proposte compaiono quando i tuoi registri indicano qualcosa da cambiare: carichi, volume, proteine, peso.</div></div>
    </div>`;

    const carousel = html`
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:0 4px"><span style="font-size:1rem;font-weight:900">${`Azioni proposte · S${week.num}`}</span><span style="font-size:.75rem;color:var(--c-fg3)">${`${actions.length} da decidere`}</span></div>
      ${actions.length ? html`<div style="flex:none;display:flex;gap:10px;overflow-x:auto;margin:0 -16px;padding:0 16px;scroll-snap-type:x mandatory">
        ${actions.map(a => html`
          <div key=${a.id} style="flex:none;width:280px;scroll-snap-align:start;background:var(--c-s1);border:1px solid var(--c-line);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px">
            <i class=${a.icon} style="font-size:26px"></i><div style="font-weight:900;font-size:1.0625rem">${a.title}</div><div style="font-size:.875rem;color:var(--c-fg2);line-height:1.45;flex:1">${a.body}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="press" onClick=${a.apply} style="height:48px;border-radius:10px;background:var(--c-acc);color:var(--c-on-acc);font-weight:900;font-size:.875rem">${a.cta}</button><button onClick=${a.skip} style="height:48px;border-radius:10px;background:var(--c-s2);font-weight:800;font-size:.875rem">Non ora</button></div>
          </div>`)}
      </div>` : html`<div style=${S.card + ';padding:16px'}>${noActions}</div>`}`;

    const analysis = html`
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><span style="font-size:1.125rem;font-weight:900">${`Analisi settimana ${week.num}`}</span><span style="font-size:.75rem;color:var(--c-fg3);white-space:nowrap">${week.range}</span></div>
        <div style="font-size:.9375rem;line-height:1.45;color:var(--c-fg2)">${week.text}</div>
        ${actions.length ? actions.map(a => html`
          <div key=${a.id} style="border-top:1px solid var(--c-line);padding-top:12px;display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;gap:10px"><i class=${a.icon} style="font-size:20px;flex:none;margin-top:1px"></i><div><div style="font-weight:800">${a.title}</div><div style="font-size:.875rem;color:var(--c-fg2);line-height:1.45;margin-top:2px">${a.body}</div></div></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="press" onClick=${a.apply} style="height:44px;border-radius:10px;background:var(--c-acc);color:var(--c-on-acc);font-weight:900;font-size:.875rem">${a.cta}</button><button onClick=${a.skip} style="height:44px;border-radius:10px;background:var(--c-s2);font-weight:800;font-size:.875rem">Non ora</button></div>
          </div>`) : html`<div style="border-top:1px solid var(--c-line);padding-top:12px">${noActions}</div>`}
      </div>`;

    return [
      html`<div key="coach-scroll" class="scroll" ref=${keepBottom(chat.length + '|' + !!st.typing)} style=${`position:absolute;inset:0;overflow-y:auto;padding:calc(var(--top) + 8px) 16px calc(var(--tabH) + ${150 + mini}px);display:flex;flex-direction:column;gap:12px`}>
        ${ui.header('Scienze motorie · nutrizione', 'Coach')}
        ${variantB ? carousel : analysis}
        ${chat.length ? null : html`<div style="font-size:.875rem;color:var(--c-fg3);line-height:1.45;padding:4px">Chiedi del piano, dei pasti o del recupero. Il coach risponde partendo dal tuo profilo e dai tuoi registri.</div>`}
        ${chat.map(m => html`
          <div key=${m.key} style=${`display:flex;justify-content:${m.justify}`}><div style=${`max-width:84%;padding:12px 14px;border-radius:16px;font-size:.9375rem;line-height:1.45;white-space:pre-line;background:${m.bg};color:${m.fg};border:1px solid ${m.bd};animation:gtFade .28s ease`}>${m.t}</div></div>`)}
        ${st.typing ? html`<div key="typing" role="status" aria-label="Il coach sta scrivendo" style="display:flex;gap:5px;padding:14px 16px;background:var(--c-s1);border:1px solid var(--c-line);border-radius:16px;width:fit-content"><span style="width:7px;height:7px;border-radius:50%;background:var(--c-fg2);animation:gtDot 1.2s infinite"></span><span style="width:7px;height:7px;border-radius:50%;background:var(--c-fg2);animation:gtDot 1.2s .2s infinite"></span><span style="width:7px;height:7px;border-radius:50%;background:var(--c-fg2);animation:gtDot 1.2s .4s infinite"></span></div>` : null}
      </div>`,
      html`<div key="coach-bar" style=${`position:absolute;left:0;right:0;bottom:calc(var(--tabH) + ${mini}px);padding:10px 16px;background:var(--c-bg);border-top:1px solid var(--c-line);display:flex;flex-direction:column;gap:8px;z-index:25`}>
        <div class="scroll" style="display:flex;gap:6px;overflow-x:auto;margin:0 -16px;padding:0 16px">${prompts.map(p => html`<button key=${p.t} onClick=${p.go} disabled=${st.typing} style="flex:none;height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--c-s3);font-size:.8125rem;font-weight:700">${p.t}</button>`)}</div>
        <div style="display:flex;gap:8px"><input value=${st.chatInput || ''} onInput=${onChatInput} onKeyDown=${onChatKey} placeholder="Chiedi al coach" aria-label="Chiedi al coach" enterkeyhint="send" style="flex:1;min-width:0;height:48px;border-radius:12px;border:0;outline:0;background:var(--c-s2);padding:0 14px;font-size:1rem" /><button class="press" onClick=${sendChat} disabled=${!canSend} aria-label="Invia" style=${`flex:none;width:48px;height:48px;border-radius:12px;background:var(--c-acc);color:var(--c-on-acc);display:grid;place-items:center;opacity:${canSend ? 1 : .5}`}><i class="ph-fill ph-paper-plane-right" style="font-size:20px"></i></button></div>
      </div>`
    ];
  };

  // ---------- Profile ----------

  const INTEGRATIONS = [
    ['garmin', 'Garmin Connect', 'ph-light ph-watch', 'Sonno, recupero, frequenza cardiaca', ['Sonno', 'HRV', 'FC a riposo', 'Readiness', 'Stress']],
    ['strava', 'Strava', 'ph-light ph-person-simple-run', 'Corsa, bici, carico complessivo', ['Corse', 'Uscite in bici', 'Carico settimanale', 'Zone FC']]
  ];
  // Profile opens over the current tab (Oggi, Nutrizione → Ricette, Progressi → Forza): back names it
  const TAB_NAME = { oggi: 'Oggi', allen: 'Allena', nutri: 'Nutrizione', prog: 'Progressi', coach: 'Coach' };
  const BG_HEX = { nero: '#000000', grafite: '#1A1B1E', caldo: '#191614' };
  const BG_KEYS = ['nero', 'grafite', 'caldo'];
  const eyebrowSec = S.eyebrow + ';margin-top:6px';

  // Swatches: ring + check on the active colour, check colour by perceived brightness
  const sw = (list, cur, key) => list.map(([c, name]) => {
    const a = String(cur || '').toUpperCase() === c.toUpperCase();
    const L = parseInt(c.slice(1, 3), 16) * 0.3 + parseInt(c.slice(3, 5), 16) * 0.59 + parseInt(c.slice(5, 7), 16) * 0.11;
    return { c, name, ring: a ? 'var(--c-fg)' : 'transparent', icon: a ? 'ph-bold ph-check' : '', on: L > 140 ? '#000' : '#FFFBF9', go: () => GT.set({ [key]: c }) };
  });

  // ---------- Account and sync card (not in the prototype; built from its card patterns) ----------
  const AI_NAME = { groq: 'Groq', gemini: 'Gemini', anthropic: 'Claude' };
  const hhmm = t => { const x = new Date(t); return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); };
  const fieldStyle = 'height:48px;border-radius:12px;border:0;outline:0;background:var(--c-s2);padding:0 14px;font-size:1rem;width:100%';
  const secBtn = 'height:48px;border-radius:10px;font-weight:800;font-size:.875rem;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--c-s2)';

  function accountCard(st) {
    const c = st.cloud || {}, cloud = GT.cloud;
    if (!c.configured) {
      return html`<div style="border:1px dashed var(--c-s3);border-radius:12px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start">
        <i class="ph-light ph-cloud-slash" style="font-size:22px;color:var(--c-fg3);flex:none"></i>
        <div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="font-weight:800">Sincronizzazione</span>${ui.soon('Non attiva')}</div>
        <div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.45;margin-top:4px">I dati restano su questo telefono. Login, backup e coach AI si attivano nella versione pubblicata su Vercel.</div></div>
      </div>`;
    }
    if (!c.ready) {
      return html`<div style=${S.card + ';height:72px;animation:gtShimmer 1.4s ease infinite'} aria-label="Caricamento account"></div>`;
    }
    const err = c.error ? html`<div role="alert" style="font-size:.8125rem;line-height:1.4;color:var(--c-acc-t);font-weight:700">${c.error}</div>` : null;
    if (!c.user) {
      const submit = e => { e.preventDefault(); const f = e.currentTarget; cloud.signIn(f.elements.email.value, f.elements.password.value).then(r => { if (r) f.elements.password.value = ''; }); };
      const signUp = e => { const f = e.currentTarget.form; if (!f.reportValidity()) return; cloud.signUp(f.elements.email.value, f.elements.password.value); };
      return html`<form onSubmit=${submit} style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:10px'}>
        <div style="display:flex;gap:12px;align-items:center"><span style="width:44px;height:44px;border-radius:10px;background:var(--c-s2);display:grid;place-items:center;flex:none"><i class="ph-light ph-cloud-arrow-up" style="font-size:24px"></i></span>
          <div><div style="font-weight:900;font-size:1.0625rem">Accedi per sincronizzare</div><div style="font-size:.8125rem;color:var(--c-fg3)">Backup dei dati e coach AI</div></div></div>
        <input name="email" type="email" autocomplete="email" inputmode="email" required placeholder="Email" aria-label="Email" style=${fieldStyle} />
        <input name="password" type="password" autocomplete="current-password" required minlength="8" placeholder="Password" aria-label="Password" style=${fieldStyle} />
        ${err}
        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:8px">
          <button type="submit" class="press" disabled=${c.busy} style=${'height:48px;border-radius:10px;background:var(--c-acc);color:var(--c-on-acc);font-weight:900;font-size:.875rem;opacity:' + (c.busy ? .6 : 1)}>${c.busy ? 'Attendi…' : 'Accedi'}</button>
          <button type="button" onClick=${signUp} disabled=${c.busy} style=${secBtn}>Crea account</button>
        </div>
        <div style="font-size:.75rem;color:var(--c-fg3);line-height:1.45">Senza accesso l’app funziona lo stesso: i dati restano solo su questo telefono.</div>
      </form>`;
    }
    const status = !st.online ? 'Offline · sincronizzo al ritorno della rete'
      : c.syncing ? 'Sincronizzazione…'
      : c.lastSync ? `Sincronizzato alle ${hhmm(c.lastSync)}` : 'In attesa della prima sincronizzazione';
    return html`<div style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:12px'}>
      <div style="display:flex;gap:12px;align-items:center"><span style="width:44px;height:44px;border-radius:10px;background:var(--c-s2);display:grid;place-items:center;flex:none"><i class=${c.syncing ? 'ph-light ph-arrows-clockwise' : 'ph-light ph-cloud-check'} style="font-size:24px"></i></span>
        <div style="min-width:0"><div style="font-weight:900;font-size:1.0625rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.user}</div><div style="font-size:.8125rem;color:var(--c-fg3)">${status}</div></div></div>
      ${err}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button onClick=${() => cloud.syncNow()} disabled=${c.syncing || !st.online} style=${secBtn}><i class="ph-light ph-arrows-clockwise" style="font-size:18px"></i>Sincronizza</button>
        <button onClick=${() => cloud.signOut()} disabled=${c.busy || !st.online} style=${secBtn}><i class="ph-light ph-sign-out" style="font-size:18px"></i>Esci</button>
      </div>
      <div style="font-size:.75rem;color:var(--c-fg3);line-height:1.45">${c.coach ? `Coach AI attivo · ${AI_NAME[c.ai] || 'Groq'}${c.aiFallback ? ` (riserva ${AI_NAME[c.aiFallback]})` : ''}.` : 'Coach AI non configurato: risposte offline.'} Uscendo, i dati restano su questo telefono.</div>
    </div>`;
  }

  // ---------- Profile summary helpers ----------
  const nameOf = (list, k) => ((list || []).filter(x => x.k === k)[0] || {}).n || null;
  const DIET_NAME = { onnivora: 'Onnivora', vegetariana: 'Vegetariana', vegana: 'Vegana', pescetariana: 'Pescetariana', flessibile: 'Flessibile', nessuna: 'Nessuna preferenza' };
  const cap = s => { s = String(s || '').replace(/_/g, ' '); return s ? s[0].toUpperCase() + s.slice(1) : ''; };
  const initialsOf = name => String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'GT';

  function profileRows(st) {
    const p = st.profile || {}, plan = st.plan, rows = [];
    const add = (l, v) => { if (v != null && v !== '') rows.push({ l, v }); };
    add('Sesso', p.sex === 'f' ? 'Donna' : p.sex === 'm' ? 'Uomo' : null);
    const goalName = GT.GOAL_NAME[p.goal] || cap(p.goal);
    add('Obiettivo', goalName ? goalName + (Number(p.targetWeight) ? ` · peso obiettivo ${GT.fmt(Number(p.targetWeight))} kg` : '') : null);
    add('Esperienza', nameOf(GT.EXPERIENCE, p.experience));
    const gymDays = Number(p.gymDays) || 0;
    let gym = 'Nessun giorno di palestra';
    if (gymDays) {
      const days = plan ? plan.week.filter(w => w.items.some(it => it.type === 'gym')).map(w => GT.DAYS_SHORT[w.wd]) : (p.days || []).map(x => GT.DAYS_SHORT[x]);
      gym = `${gymDays} × ${Number(p.sessionMin) || 60} min` + (days.length ? ` · ${days.join(', ')}` : '');
    }
    add('Palestra', gym);
    if (plan && plan.split) add('Piano', `${plan.split} · settimana ${GT.cycleWeek(plan, GT.todayISO()).num} di ${plan.cycleWeeks}`);
    add('Attrezzatura', (p.equipment || []).length ? p.equipment.join(', ') : 'Solo corpo libero');
    const lims = (p.limitations || []).map(l => (nameOf(GT.LIMITS, l.k) || cap(l.k)) + (l.note ? `: ${l.note}` : ''));
    add('Limitazioni', lims.length ? lims.join(' · ') : 'Nessuna');
    if (p.runs) {
      const r = p.run || {}, km = Number(r.kmWeek) || 0;
      const test = Number(r.testDist) > 0 && r.testTime ? ` · test ${r.testDist} km in ${r.testTime}` : '';
      const outings = plan && plan.run ? ` · ${plan.run.order.length} uscite` : '';
      add('Corsa', (km ? `${GT.fmt(km)} km a settimana` : 'Sì') + outings + test);
    } else add('Corsa', 'No');
    add('Nuoto', p.swims ? `${(p.swim && p.swim.perWeek) || 1} a settimana` : 'No');
    add('Attività', nameOf(GT.ACTIVITY, p.activity));
    add('Sonno', Number(p.sleepH) ? `${GT.fmt(Number(p.sleepH))} h a notte` : null);
    const allergies = Array.isArray(p.allergies) ? p.allergies.filter(Boolean).join(', ') : (p.allergies || '');
    const diet = p.diet ? (DIET_NAME[p.diet] || cap(p.diet)) : null;
    add('Dieta', diet || allergies ? [diet, allergies ? `allergie: ${allergies}` : null].filter(Boolean).join(' · ') : null);
    add('Pasti', `${(p.mealsPerDay) || GT.mealsFor(p).length} al giorno · ${GT.mealsFor(p).join(', ')}`);
    return rows;
  }

  // Goal adjustment as text: 1.1 -> "+10%", 0.8 -> "−20%", 1 -> "mantenimento"
  const adjLabel = adj => { const pct = Math.round((adj - 1) * 100); return pct ? `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%` : 'mantenimento'; };

  function targetsCard(st) {
    const T = st.targets, p = st.profile || {};
    if (!T) {
      return html`<div style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:10px'}>
        <div style="font-weight:800">Target non ancora calcolati</div>
        <div style="font-size:.875rem;color:var(--c-fg2);line-height:1.45">Servono peso, altezza, età e attività: completa il questionario.</div>
        ${ui.cta('Completa il questionario', A.editQuestionnaire, { h: 52 })}
      </div>`;
    }
    const goal = GT.GOAL_NAME[p.goal] || 'obiettivo';
    // Only the safety minimum of GT.computeTargets (1.400 / 1.600 kcal) raises the target
    const raw = Math.round(T.tdee * T.adj / 50) * 50, floored = T.k > raw && T.k === (p.sex === 'f' ? 1400 : 1600);
    const tiles = [['Proteine', `${T.p} g`, `${GT.fmt(T.protPerKg)} g/kg`], ['Carboidrati', `${T.c} g`, `${GT.fk(T.c * 4)} kcal`], ['Grassi', `${T.g} g`, `${GT.fk(T.g * 9)} kcal`], ['Acqua', `${GT.fmt(T.water)} L`, `${T.glasses} bicchieri`]];
    return html`<div style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:14px'}>
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
        <div><span class="num" style="font-size:2rem;font-weight:900;letter-spacing:-.02em;font-variant-numeric:tabular-nums">${GT.fk(T.k)}</span><span style="font-size:.9375rem;font-weight:700;color:var(--c-fg2);margin-left:6px">kcal al giorno</span></div>
        <span style="font-size:.75rem;color:var(--c-fg3);white-space:nowrap">${goal}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
        ${tiles.map(([l, v, s]) => html`<div key=${l} style="background:var(--c-s2);border-radius:10px;padding:10px 8px;display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:.6875rem;font-weight:700;color:var(--c-fg3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l}</span><span style="font-size:1rem;font-weight:900;font-variant-numeric:tabular-nums">${v}</span><span style="font-size:.6875rem;color:var(--c-fg3);font-variant-numeric:tabular-nums">${s}</span></div>`)}
      </div>
      ${(T.meals || []).length ? html`<div style="display:flex;flex-wrap:wrap;gap:6px">${T.meals.map(m => html`<span key=${m.n} style="font-size:.75rem;font-weight:700;padding:6px 10px;border-radius:6px;background:var(--c-s2);color:var(--c-fg2);font-variant-numeric:tabular-nums">${`${m.n} ${GT.fk(m.k)}`}</span>`)}</div>` : null}
      <div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.5">${`Metabolismo basale ${GT.fk(T.bmr)} kcal (Mifflin–St Jeor) × ${GT.fmtKg(T.factor)} attività e allenamento = ${GT.fk(T.tdee)} kcal; ${adjLabel(T.adj)} per ${goal.toLowerCase()}${floored ? `, alzato al minimo di ${GT.fk(T.k)} kcal` : ''}. Proteine ${GT.fmt(T.protPerKg)} g/kg, grassi almeno 0,9 g/kg, carboidrati il resto. Acqua ~35 ml/kg.`}</div>
    </div>`;
  }

  // Export: the link gets a fresh Blob URL at tap time, then the browser follows <a download>
  function exportClick(e) {
    const fname = `greytraining-${GT.todayISO()}.json`;
    try {
      const blob = new Blob([JSON.stringify(GT.persistedSnapshot(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      e.currentTarget.href = url;
      e.currentTarget.download = fname;
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (x) {} }, 60000);
      // after the browser has followed the link (a re-render must not race the download)
      setTimeout(() => A.toast('set', 'Dati esportati', fname), 0);
    } catch (err) {
      e.preventDefault();
      A.toast('info', 'Esportazione non riuscita', 'Riprova o usa un altro browser');
    }
  }

  GT.screens.profile = function (st, d) {
    const p = st.profile || {}, dark = st.theme !== 'light';
    const ws = GT.weightStats(st);
    const kg = ws.last ? ws.last.kg : Number(p.weight) || null;
    const meta = [Number(p.age) ? `${Number(p.age)} anni` : null, Number(p.height) ? `${Number(p.height)} cm` : null, kg ? `${GT.fmt(kg)} kg` : null].filter(Boolean).join(' · ');
    const rows = profileRows(st);
    const red = dark ? '#FF6961' : '#C8102E';

    const integrations = INTEGRATIONS.map(([id, name, icon, desc, data]) => {
      const on = !!(st.notify || {})[id];
      return {
        id, name, icon, desc, data, on, bg: on ? 'var(--c-s2)' : 'transparent', fg: 'var(--c-fg)',
        bIcon: on ? 'ph-bold ph-check' : 'ph-light ph-bell', bLabel: on ? 'Ti avviseremo al rilascio' : 'Avvisami quando è disponibile',
        toggle: () => GT.set(s => ({ notify: Object.assign({}, s.notify, { [id]: !(s.notify || {})[id] }) }))
      };
    });
    const colorRows = [
      { l: 'Colore primario', d: 'Azioni, selezioni, grafici', opts: sw(GT.PRIMARY_OPTS, st.primary, 'primary') },
      { l: 'Colore secondario', d: 'Completato, serie secondarie', opts: sw(GT.SECONDARY_OPTS, st.secondary, 'secondary') },
      { l: 'Tono sfondo', d: 'Solo tema scuro', opts: sw([['#000000', 'Nero'], ['#1A1B1E', 'Grafite'], ['#191614', 'Caldo']], BG_HEX[st.bgTone], '_bg').map((o, i) => Object.assign({}, o, { go: () => GT.set({ bgTone: BG_KEYS[i] }) })) }
    ];
    const prefs = [
      { l: 'Tema', opts: ui.seg([['dark', 'Scuro'], ['light', 'Chiaro']], st.theme, x => GT.set({ theme: x })) },
      { l: 'Sforzo', sub: st.effort === 'RIR' ? 'Ripetizioni in riserva' : 'Sforzo percepito 1–10', opts: ui.seg(['RPE', 'RIR'], st.effort, x => GT.set({ effort: x })) },
      { l: 'Testo', opts: ui.seg([[1, 'A'], [1.125, 'A+'], [1.25, 'A++']], st.scale, x => GT.set({ scale: x })) },
      // Only metric units for now
      { l: 'Unità', sub: 'lb · in non ancora disponibili', opts: ui.seg([['kg', 'kg · cm']], 'kg', () => {}) }
    ];
    const closeOverlay = () => GT.set({ overlay: null, profileReset: false });
    const askReset = () => GT.set({ profileReset: true });
    const cancelReset = () => GT.set({ profileReset: false });
    const doReset = () => { GT.set({ profileReset: false }); A.resetEverything(); };

    return html`<div class="scroll" style="position:absolute;inset:0;z-index:20;background:var(--c-bg);overflow-y:auto;padding:var(--top) 16px calc(var(--pb) + 14px);display:flex;flex-direction:column;gap:14px">
      ${ui.back(TAB_NAME[st.tab] || 'Indietro', closeOverlay)}
      <div style="display:flex;gap:14px;align-items:center">
        <span aria-hidden="true" style="flex:none;width:64px;height:64px;border-radius:50%;background:var(--c-s2);display:grid;place-items:center;font-weight:900;font-size:1.25rem">${initialsOf(p.name)}</span>
        <div style="min-width:0"><h1 style="margin:0;font-size:1.75rem;font-weight:900;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name || 'Profilo'}</h1>${meta ? html`<div style="font-size:.875rem;color:var(--c-fg3);font-variant-numeric:tabular-nums">${meta}</div>` : null}</div>
      </div>

      <div style=${eyebrowSec}>Account e sincronizzazione</div>
      ${accountCard(st)}

      <div style=${eyebrowSec}>Il tuo profilo</div>
      <div style=${S.card + ';padding:4px 16px 16px;display:flex;flex-direction:column'}>
        ${rows.map(r => html`<div key=${r.l} style="display:grid;grid-template-columns:104px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid var(--c-line);align-items:baseline"><span style="font-size:.8125rem;color:var(--c-fg3)">${r.l}</span><span style="font-size:.9375rem;font-weight:700;line-height:1.4;overflow-wrap:anywhere">${r.v}</span></div>`)}
        <div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.45;margin:12px 0">Il questionario si apre con le risposte attuali. Piano e target si ricalcolano; i registri restano.</div>
        ${ui.cta('Modifica le risposte', A.editQuestionnaire, { h: 52, icon: 'ph-light ph-pencil-simple' })}
      </div>

      <div style=${eyebrowSec}>Target giornalieri</div>
      ${targetsCard(st)}

      <div style=${eyebrowSec}>Preferenze</div>
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:4px 16px">
        ${prefs.map(pr => html`<div key=${pr.l} style="display:flex;justify-content:space-between;align-items:center;min-height:60px;border-bottom:1px solid var(--c-line);gap:10px"><div style="min-width:0"><div style="font-weight:700">${pr.l}</div>${pr.sub ? html`<div style="font-size:.75rem;color:var(--c-fg3);margin-top:2px">${pr.sub}</div>` : null}</div><div style="flex:none;display:flex;gap:2px;background:var(--c-s2);border-radius:9px;padding:3px">${pr.opts.map(o => html`<button key=${o.label} onClick=${o.go} aria-pressed=${o.active} style=${`height:36px;min-width:52px;padding:0 10px;border-radius:7px;font-size:.8125rem;font-weight:800;background:${o.bg};color:${o.fg}`}>${o.label}</button>`)}</div></div>`)}
      </div>

      <div style=${eyebrowSec}>Colori</div>
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:4px 16px">
        ${colorRows.map(cr => html`<div key=${cr.l} style="display:flex;flex-direction:column;gap:10px;padding:14px 0;border-bottom:1px solid var(--c-line)"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:700">${cr.l}</span><span style="font-size:.75rem;color:var(--c-fg3)">${cr.d}</span></div><div style="display:flex;gap:10px;flex-wrap:wrap">${cr.opts.map(o => html`<button key=${o.c} onClick=${o.go} aria-label=${o.name} aria-pressed=${!!o.icon} style=${`width:48px;height:48px;border-radius:50%;padding:4px;border:2px solid ${o.ring}`}><span style=${`display:grid;place-items:center;width:100%;height:100%;border-radius:50%;background:${o.c};border:1px solid var(--c-s3);color:${o.on}`}><i class=${o.icon} style="font-size:16px"></i></span></button>`)}</div></div>`)}
        <div style="display:flex;gap:8px;padding:14px 0;align-items:center"><span style="flex:1;height:44px;border-radius:10px;background:var(--c-acc);color:var(--c-on-acc);display:grid;place-items:center;font-weight:900;font-size:.875rem">Primario</span><span style="flex:1;height:44px;border-radius:10px;background:var(--c-sec);color:var(--c-on-sec);display:grid;place-items:center;font-weight:900;font-size:.875rem">Secondario</span><span style="flex:1;height:44px;border-radius:10px;background:var(--c-s2);display:grid;place-items:center;font-weight:800;font-size:.875rem">Superficie</span></div>
      </div>

      <div style=${eyebrowSec}>Integrazioni</div>
      ${integrations.map(ig => html`
        <div key=${ig.id} style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;align-items:center;gap:12px"><span style="flex:none;width:44px;height:44px;border-radius:10px;background:var(--c-s2);display:grid;place-items:center"><i class=${ig.icon} style="font-size:24px"></i></span><div style="flex:1;min-width:0"><div style="font-weight:900;font-size:1.0625rem">${ig.name}</div><div style="font-size:.8125rem;color:var(--c-fg3)">${ig.desc}</div></div><span style="flex:none;font-size:.6875rem;font-weight:800;padding:5px 9px;border-radius:999px;border:1px solid var(--c-s3);color:var(--c-fg2)">In arrivo</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${ig.data.map(x => html`<span key=${x} style="font-size:.75rem;font-weight:700;padding:6px 10px;border-radius:6px;background:var(--c-s2);color:var(--c-fg2)">${x}</span>`)}</div>
          <button onClick=${ig.toggle} aria-pressed=${ig.on} style=${`height:48px;border-radius:10px;font-weight:800;font-size:.875rem;display:flex;align-items:center;justify-content:center;gap:8px;background:${ig.bg};color:${ig.fg};border:1px solid var(--c-s3)`}><i class=${ig.bIcon} style="font-size:18px"></i>${ig.bLabel}</button>
        </div>`)}

      <div style=${eyebrowSec}>Dati</div>
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:4px 16px">
        <button onClick=${() => GT.set({ overlay: null, tab: 'allen', disc: 'palestra', allenSub: 'scheda', allenView: 'import', imp: null, impErr: null })} style="display:flex;align-items:center;gap:12px;min-height:64px;width:100%;text-align:left;border-bottom:1px solid var(--c-line)">
          <i class="ph-light ph-file-arrow-up" style="font-size:22px;flex:none"></i>
          <div style="flex:1"><div style="font-weight:800">Importa una scheda</div><div style="font-size:.8125rem;color:var(--c-fg3)">Programma in JSON fatto con un'AI o un coach</div></div>
          <i class="ph-light ph-caret-right" style="font-size:18px;color:var(--c-fg3)"></i>
        </button>
        <a href="#" onClick=${exportClick} style="display:flex;align-items:center;gap:12px;min-height:64px;border-bottom:1px solid var(--c-line);color:var(--c-fg);text-decoration:none">
          <i class="ph-light ph-download-simple" style="font-size:22px;flex:none"></i>
          <div style="flex:1"><div style="font-weight:800">Esporta i miei dati</div><div style="font-size:.8125rem;color:var(--c-fg3)">File JSON con profilo, piano e registri</div></div>
          <i class="ph-light ph-caret-right" style="font-size:18px;color:var(--c-fg3)"></i>
        </a>
        ${st.profileReset ? html`
          <div role="alert" style="display:flex;flex-direction:column;gap:10px;padding:14px 0">
            <div style=${`font-weight:900;color:${red}`}>Ricomincia da zero?</div>
            <div style="font-size:.875rem;color:var(--c-fg2);line-height:1.45">Cancella profilo, piano e tutti i registri. Resta una copia di backup sul telefono.</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <button class="press" onClick=${doReset} style="height:48px;border-radius:10px;background:#D93036;color:#fff;font-weight:900;font-size:.875rem">Cancella tutto</button>
              <button onClick=${cancelReset} style="height:48px;border-radius:10px;background:var(--c-s2);font-weight:800;font-size:.875rem">Annulla</button>
            </div>
          </div>` : html`
          <button onClick=${askReset} style="display:flex;align-items:center;gap:12px;min-height:64px;width:100%;text-align:left">
            <i class="ph-light ph-arrow-counter-clockwise" style=${`font-size:22px;flex:none;color:${red}`}></i>
            <div style="flex:1"><div style=${`font-weight:800;color:${red}`}>Ricomincia da zero</div><div style="font-size:.8125rem;color:var(--c-fg3)">Cancella profilo, piano e registri</div></div>
          </button>`}
      </div>

      <div style="font-size:.75rem;color:var(--c-fg3);line-height:1.5;padding:0 4px">Il coach dà indicazioni su allenamento e alimentazione, non valutazioni mediche. Per dolori persistenti rivolgiti a un professionista sanitario.</div>
    </div>`;
  };

  // ---------- Readiness check-in sheet ----------

  const READY_ROWS = [['sonno', 'Sonno percepito', 'Pessimo', 'Ottimo'], ['energia', 'Energia', 'Bassa', 'Alta'], ['dolori', 'Indolenzimento', 'Forte', 'Nessuno']];

  GT.screens.readiness = function (st, d) {
    const r = ((st.logs || {}).ready || {})[d.today] || {};
    const allSet = READY_ROWS.every(([k]) => typeof r[k] === 'number');
    const rd = allSet ? GT.readinessOf(st, d.today) : null;
    const rows = READY_ROWS.map(([k, label, lo, hi]) => ({
      k, label, lo, hi,
      opts: [1, 2, 3, 4, 5].map(n => {
        const on = r[k] === n;
        return { n, on, bg: on ? 'var(--c-acc)' : 'var(--c-s2)', fg: on ? 'var(--c-on-acc)' : 'var(--c-fg)', go: () => A.setReady(k, n) };
      })
    }));
    const closeOverlay = () => GT.set({ overlay: null });
    const save = () => { if (allSet) GT.set({ overlay: null }); };

    return [
      html`<button key="ready-scrim" onClick=${closeOverlay} aria-label="Chiudi" style="position:absolute;inset:0;background:rgba(0,0,0,.6);z-index:50;animation:gtFade .2s ease"></button>`,
      html`<div key="ready-sheet" role="dialog" aria-modal="true" aria-label="Check-in di oggi" style="position:absolute;left:0;right:0;bottom:0;z-index:51;background:var(--c-s1);border-radius:24px 24px 0 0;padding:12px 16px var(--pb);display:flex;flex-direction:column;gap:16px;max-height:92%;overflow-y:auto;animation:gtSheet .28s cubic-bezier(.2,0,0,1)">
        <span style="flex:none;width:40px;height:5px;border-radius:3px;background:var(--c-s3);align-self:center"></span>
        <div><div style="font-size:1.25rem;font-weight:900">Check-in di oggi</div><div style="font-size:.875rem;color:var(--c-fg3);margin-top:2px">${rd ? `${rd.label}. Il coach adatta volume e intensità di oggi.` : '30 secondi. Il coach adatta volume e intensità.'}</div></div>
        ${rows.map(row => html`
          <div key=${row.k} style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;font-size:.875rem"><span style="font-weight:800">${row.label}</span><span style="color:var(--c-fg3)">${row.lo} → ${row.hi}</span></div>
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">${row.opts.map(o => html`<button key=${o.n} onClick=${o.go} aria-label=${`${row.label} ${o.n}`} aria-pressed=${o.on} style=${`height:52px;border-radius:10px;font-size:1.125rem;font-weight:900;background:${o.bg};color:${o.fg}`}>${o.n}</button>`)}</div></div>`)}
        <button class="press" onClick=${save} disabled=${!allSet} style=${`flex:none;height:60px;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);font-size:1.0625rem;font-weight:900;opacity:${allSet ? 1 : .45}`}>${rd ? `Salva · readiness ${rd.score}` : 'Salva'}</button>
      </div>`
    ];
  };
})();
