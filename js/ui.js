/* GreyTraining — shared UI helpers (Preact + htm, no build step).
   GT.html is the htm tagged template bound to Preact's h().
   Every helper returns a vnode (or plain data for seg/chip) and copies the exact
   markup used repeatedly in design-reference/GreyTraining.dc.html. */
(function () {
  'use strict';
  var GT = window.GT;
  var html = (GT.html = window.htmPreact.html);
  GT.screens = GT.screens || {};

  // Frequently repeated inline styles
  var S = (GT.S = {
    eyebrow: 'font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3)',
    card: 'background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px',
    h1: 'font-size:2rem;font-weight:900;letter-spacing:-.02em;margin:4px 0 0;line-height:1.05',
    // scroll container of a tab screen (top under the status bar, bottom above the tab bar)
    tabScroll: 'position:absolute;inset:0;overflow-y:auto;padding:calc(var(--top) + 8px) 16px calc(var(--tabH) + 24px);display:flex;flex-direction:column;gap:12px',
    // full-screen view container (covers the tab bar)
    full: 'position:absolute;inset:0;z-index:20;background:var(--c-bg);overflow-y:auto',
    badge: 'font-size:.6875rem;font-weight:700;padding:4px 8px;border-radius:999px;background:var(--c-s2);color:var(--c-fg2)'
  });

  var ui = (GT.ui = {});

  // Segmented-control items (single choice). opts: ['a','b'] or [[value,label],…]
  ui.seg = function (opts, cur, fn) {
    return opts.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o, a = v === cur;
      return { value: v, label: l, active: a, bg: a ? 'var(--c-acc)' : 'transparent', fg: a ? 'var(--c-on-acc)' : 'var(--c-fg2)', go: function () { fn(v); } };
    });
  };
  // Chip items. cur may be a value or an array of selected values (multi-select)
  ui.chip = function (opts, cur, fn) {
    return opts.map(function (o) {
      var a = Array.isArray(cur) ? cur.indexOf(o) >= 0 : o === cur;
      return { value: o, label: o, active: a, bg: a ? 'var(--c-acc)' : 'transparent', fg: a ? 'var(--c-on-acc)' : 'var(--c-fg)', go: function () { fn(o); } };
    });
  };

  // Segmented control: container s2 r12 padding 4, segments h40 r9
  ui.Seg = function (items) {
    return html`<div style="flex:none;display:flex;gap:4px;padding:4px;background:var(--c-s2);border-radius:12px">
      ${items.map(function (s) {
        return html`<button key=${s.label} onClick=${s.go} aria-pressed=${s.active} style=${'flex:1;height:40px;border-radius:9px;font-weight:800;font-size:.875rem;background:' + s.bg + ';color:' + s.fg}>${s.label}</button>`;
      })}
    </div>`;
  };

  ui.eyebrow = function (text, extra) { return html`<div style=${S.eyebrow + (extra ? ';' + extra : '')}>${text}</div>`; };

  // Screen header: eyebrow + H1
  ui.header = function (eyebrow, title) {
    return html`<header style="padding:4px 4px"><div style=${S.eyebrow}>${eyebrow}</div><h1 style=${S.h1}>${title}</h1></header>`;
  };

  // Back link used at the top of full-screen views
  ui.back = function (label, onClick) {
    return html`<div style="margin:0 -8px"><button onClick=${onClick} style="height:44px;padding:0 8px;display:flex;align-items:center;gap:4px;font-weight:700;color:var(--c-fg2)"><i class="ph-light ph-caret-left" style="font-size:22px"></i>${label}</button></div>`;
  };

  // Coach card: lightning in a 36 px primary circle + eyebrow + text
  ui.coachCard = function (eyebrow, text) {
    return html`<div style=${S.card + ';padding:14px 16px;display:flex;gap:12px;align-items:flex-start'}>
      <span style="flex:none;width:36px;height:36px;border-radius:50%;background:var(--c-acc);color:var(--c-on-acc);display:grid;place-items:center"><i class="ph-bold ph-lightning" style="font-size:18px"></i></span>
      <div><div style=${S.eyebrow}>${eyebrow}</div><p style="margin:4px 0 0;font-size:.9375rem;line-height:1.45;text-wrap:pretty">${text}</p></div>
    </div>`;
  };

  // "Garmin · in arrivo" style pill
  ui.soon = function (label) { return html`<span style=${S.badge}>${label}</span>`; };

  // Bottom sheet with scrim. z defaults to the app-level sheet layer (50/51).
  ui.sheet = function (onClose, children, opts) {
    var o = opts || {}, z = o.z || 50;
    return [
      html`<button key="scrim" onClick=${onClose} aria-label="Chiudi" style=${'position:absolute;inset:0;background:rgba(0,0,0,.6);z-index:' + z + ';animation:gtFade .2s ease'}></button>`,
      html`<div key="sheet" role="dialog" aria-modal="true" style=${'position:absolute;left:0;right:0;bottom:0;z-index:' + (z + 1) + ';background:var(--c-s1);border-radius:24px 24px 0 0;padding:12px 16px var(--pb);display:flex;flex-direction:column;gap:' + (o.gap || 14) + 'px;max-height:92%;overflow-y:auto;animation:gtSheet .28s cubic-bezier(.2,0,0,1)'}>
        ${o.grabber === false ? null : html`<span style="flex:none;width:40px;height:5px;border-radius:3px;background:var(--c-s3);align-self:center"></span>`}
        ${children}
      </div>`
    ];
  };

  // Fixed bar at the bottom of a full-screen view (CTA area)
  ui.bottomBar = function (children, z) {
    return html`<div style=${'position:absolute;left:0;right:0;bottom:0;z-index:' + (z || 21) + ';padding:12px 16px var(--pb);background:var(--c-bg);border-top:1px solid var(--c-line)'}>${children}</div>`;
  };

  // Primary CTA (60 px default, 64 in session/bottom bars)
  ui.cta = function (label, onClick, opts) {
    var o = opts || {}, h = o.h || 60, r = h >= 64 ? 14 : 12;
    return html`<button class="press" onClick=${onClick} style=${'height:' + h + 'px;width:100%;border-radius:' + r + 'px;background:var(--c-acc);color:var(--c-on-acc);font-size:' + (h >= 64 ? '1.125rem' : '1.0625rem') + ';font-weight:900;display:flex;align-items:center;justify-content:center;gap:10px'}>${o.icon ? html`<i class=${o.icon} style=${'font-size:' + (o.iconSize || 20) + 'px'}></i>` : null}${label}</button>`;
  };
})();
