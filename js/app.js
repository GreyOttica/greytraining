/* GreyTraining — app shell.
   Composes tab screens, full-screen views and sheets in the same z-order as the prototype,
   plus tab bar, session mini-bar, toast and offline banner. Re-renders every second while a
   session is running (timer, rest countdown). */
(function () {
  'use strict';
  var GT = window.GT, html = GT.html, S = GT.S;
  var render = window.htmPreact.render;
  var root = document.getElementById('app');

  // Call a screen defensively so one broken screen cannot blank the whole app.
  function screen(name, st, d) {
    var fn = GT.screens[name];
    if (!fn) return null;
    try { return fn(st, d); } catch (e) {
      console.error('[GreyTraining] screen "' + name + '" failed', e);
      return html`<div style=${S.full + ';padding:calc(var(--top) + 16px) 16px;display:flex;flex-direction:column;gap:12px'}>
        <i class="ph-light ph-warning-circle" style="font-size:32px"></i>
        <div style="font-size:1.25rem;font-weight:900">Qualcosa non ha funzionato</div>
        <div style="font-size:.9375rem;color:var(--c-fg2);line-height:1.45">I dati restano salvati sul telefono. Torna a Oggi e riprova.</div>
        <button onClick=${function () { GT.act.goTab('oggi'); }} style="height:52px;border-radius:12px;background:var(--c-s2);font-weight:800">Torna a Oggi</button>
      </div>`;
    }
  }

  var TABS = [['oggi', 'Oggi', 'house'], ['allen', 'Allena', 'barbell'], ['nutri', 'Nutrizione', 'fork-knife'], ['prog', 'Progressi', 'chart-line-up'], ['coach', 'Coach', 'chat-circle-dots']];
  var TAB_SCREEN = { oggi: 'oggi', allen: 'allena', nutri: 'nutri', prog: 'prog', coach: 'coach' };

  function tabBar(st) {
    return html`<nav aria-label="Sezioni" style="position:absolute;left:0;right:0;bottom:0;height:var(--tabH);padding:6px 4px calc(var(--sab) - 6px);display:grid;grid-template-columns:repeat(5,1fr);background:var(--c-bg);border-top:1px solid var(--c-line);z-index:30">
      ${TABS.map(function (t) {
        var a = st.tab === t[0] && !st.overlay;
        return html`<button key=${t[0]} onClick=${function () { GT.act.goTab(t[0]); }} aria-current=${a ? 'page' : null} style=${'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;position:relative;color:' + (a ? 'var(--c-fg)' : 'var(--c-fg3)')}>
          <span style=${'position:absolute;top:-7px;width:24px;height:3px;border-radius:2px;background:' + (a ? 'var(--c-acc)' : 'transparent')}></span>
          <i class=${(a ? 'ph-fill' : 'ph-light') + ' ph-' + t[2]} style="font-size:26px"></i>
          <span style="font-size:.6875rem;font-weight:800">${t[1]}</span>
        </button>`;
      })}
    </nav>`;
  }

  function miniBar(st) {
    return html`<button class="press" onClick=${function () { GT.act.startSession(); }} style="position:absolute;left:12px;right:12px;bottom:calc(var(--tabH) + 8px);z-index:31;height:56px;border-radius:14px;background:var(--c-acc);color:var(--c-on-acc);display:flex;align-items:center;gap:10px;padding:0 16px;font-weight:800;box-shadow:0 8px 24px rgba(0,0,0,.35)">
      <span style="width:8px;height:8px;border-radius:50%;background:var(--c-acc)"></span>${st.s.dayName} in corso<span class="num" style="margin-left:auto">${GT.elapsed(st.s)}</span><i class="ph-bold ph-caret-up" style="font-size:16px"></i>
    </button>`;
  }

  function toast(t) {
    var pr = t.kind === 'pr';
    var icon = pr ? 'ph-fill ph-trophy' : t.kind === 'info' ? 'ph-bold ph-bell-simple' : 'ph-bold ph-check';
    return html`<div key=${'toast' + t.id} role="status" aria-live="polite" style=${'position:absolute;top:calc(var(--top) + 2px);left:12px;right:12px;z-index:80;border-radius:16px;padding:12px 14px;display:flex;gap:12px;align-items:center;box-shadow:0 12px 32px rgba(0,0,0,.4);animation:gtToast .32s cubic-bezier(.2,0,0,1);background:' + (pr ? 'var(--c-acc)' : 'var(--c-fg)') + ';color:' + (pr ? 'var(--c-on-acc)' : 'var(--c-bg)')}>
      <span style=${'flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:' + (pr ? '#000' : 'var(--c-bg)') + ';color:' + (pr ? 'var(--c-acc)' : 'var(--c-fg)')}><i class=${icon} style="font-size:20px"></i></span>
      <div><div style="font-weight:900;font-size:.9375rem">${t.title}</div><div style="font-size:.8125rem;font-weight:600;opacity:.85">${t.sub}</div></div>
    </div>`;
  }

  var offlineHidden = false;
  window.addEventListener('online', function () { offlineHidden = false; });
  function offlineBanner() {
    return html`<button onClick=${function () { offlineHidden = true; GT.render(); }} aria-label="Nascondi avviso offline" style="position:absolute;top:calc(var(--top) + 4px);left:12px;right:12px;z-index:70;display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:10px;background:var(--c-s2);color:var(--c-fg);font-size:.8125rem;line-height:1.35;text-align:left;box-shadow:0 8px 24px rgba(0,0,0,.25)">
      <i class="ph-light ph-wifi-slash" style="font-size:20px;flex:none"></i><span>Offline. Le serie restano sul telefono e si sincronizzano al ritorno della rete.</span>
    </button>`;
  }

  function App() {
    var st = GT.state, d = GT.derive(st), ov = st.overlay;
    GT.applyColors();
    // First launch (or "Rifai il questionario"): the onboarding questionnaire takes the whole screen
    if (!d.onboarded || (st.ob && st.ob.edit)) {
      return html`<div class="gt-app">
        ${screen('onboarding', st, d)}
        ${!st.online && !offlineHidden ? offlineBanner() : null}
        ${st.toast ? toast(st.toast) : null}
      </div>`;
    }
    return html`<div class="gt-app">
      <div key="tab-layer" style="position:absolute;inset:0;z-index:0">${screen(TAB_SCREEN[st.tab] || 'oggi', st, d)}</div>

      ${st.allenView === 'cardio' ? screen('cardioDetail', st, d) : null}
      ${st.allenView === 'exercise' ? screen('exDetail', st, d) : null}
      ${st.allenView === 'editor' ? screen('editor', st, d) : null}
      ${st.allenView === 'pick' ? screen('exPicker', st, d) : null}
      ${st.allenView === 'import' ? screen('importPlan', st, d) : null}
      ${st.nutriView === 'scanner' ? screen('scanner', st, d) : null}
      ${st.nutriView === 'product' ? screen('product', st, d) : null}
      ${st.nutriView === 'manual' ? screen('manualFood', st, d) : null}
      ${ov === 'profile' ? screen('profile', st, d) : null}
      ${ov === 'session' && st.s ? screen('session', st, d) : null}
      ${ov === 'summary' && st.summary ? screen('summary', st, d) : null}

      ${ov === 'readiness' ? screen('readiness', st, d) : null}
      ${ov === 'cardioLog' && st.log && st.cardioId ? screen('cardioLog', st, d) : null}
      ${ov === 'quick' ? screen('quickAdd', st, d) : null}
      ${ov === 'weight' ? screen('weightSheet', st, d) : null}
      ${ov === 'measures' ? screen('measuresSheet', st, d) : null}

      ${!d.fullScreen ? tabBar(st) : null}
      ${st.s && ov !== 'session' && !d.fullScreen && !(st.tab === 'oggi' && GT.v('vOggi') === 'B') ? miniBar(st) : null}
      ${!st.online && !offlineHidden ? offlineBanner() : null}
      ${st.toast ? toast(st.toast) : null}
    </div>`;
  }

  GT.onRender = function () { render(App(), root); };
  root.innerHTML = '';
  window.GT_BOOTED = true;
  GT.onRender();

  // One clock for the whole app: session timer, rest countdown and its end-of-rest alert.
  setInterval(function () {
    if (!GT.state.s) return;
    GT.act.tick();
    GT.render();
  }, 1000);
  // Catch up immediately when the app comes back to the foreground.
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && GT.state.s) { GT.act.tick(); GT.render(); } });
})();
