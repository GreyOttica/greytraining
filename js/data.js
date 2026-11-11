/* GreyTraining — shared formatting helpers and theme options.
   No seed data: everything the app shows comes from the user's profile, plan and logs
   (see js/plan.js and js/insights.js). Classic script: everything hangs off window.GT. */
(function () {
  'use strict';
  var GT = (window.GT = window.GT || {});

  // ---------- Theme options (Profilo → Colori) ----------
  GT.TONES = { nero: ['#000', '#121212', '#1F1F1F', '#2B2B2B', '#2A2A2A'], grafite: ['#0F1012', '#1A1B1E', '#26272B', '#323338', '#2E2F33'], caldo: ['#0D0B0A', '#191614', '#24201D', '#302B27', '#2C2724'] };
  GT.PRIMARY_OPTS = [['#E95145', 'Arancio'], ['#F5A000', 'Ambra'], ['#EE312F', 'Rosso'], ['#6BA772', 'Verde'], ['#5C8DB8', 'Blu']];
  GT.SECONDARY_OPTS = [['#FFFBF9', 'Bianco'], ['#A7A9AC', 'Argento'], ['#90734E', 'Oro'], ['#ACD8AA', 'Verde chiaro'], ['#8EC5E2', 'Azzurro']];

  // ---------- Formatting (Italian) ----------
  // 82.5 -> "82,5" (one decimal)
  GT.fmt = function (n) { return (Math.round(n * 10) / 10).toString().replace('.', ','); };
  // 2600 -> "2.600" (toLocaleString('it-IT') leaves 4-digit numbers ungrouped, so group by hand)
  GT.fk = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  // Weights keep up to two decimals so 1,25 kg steps are not rounded away: 83.75 -> "83,75"
  GT.fmtKg = function (n) { return (Math.round(n * 100) / 100).toString().replace('.', ','); };
  GT.mmss = function (s) { return Math.floor(s / 60) + ':' + String(Math.max(0, s) % 60).padStart(2, '0'); };
  GT.epley = function (w, r) { return w * (1 + r / 30); };
  // Parse "82,5" or "82.5"
  GT.num = function (s) { var n = parseFloat(String(s == null ? '' : s).replace(',', '.')); return isNaN(n) ? null : n; };

  // Intensity profile bars for a cardio session (blocks: [name, desc, value, intensity 1-5, weight])
  GT.INT_H = { 1: '28%', 2: '45%', 3: '65%', 4: '82%', 5: '100%' };
  GT.profileOf = function (c) {
    return c.blocks.map(function (b) {
      return { f: b[4], h: GT.INT_H[b[3]], bg: b[3] >= 4 ? 'var(--c-acc)' : b[3] === 3 ? 'var(--c-sec)' : 'var(--c-fg3)' };
    });
  };
  // SVG line chart path for a series inside a W×H box (needs at least 1 point)
  GT.chart = function (arr, W, H) {
    if (!arr.length) return { line: '', area: '', lx: 0, ly: H };
    if (arr.length === 1) arr = [arr[0], arr[0]];
    var mn = Math.min.apply(null, arr), mx = Math.max.apply(null, arr), pad = (mx - mn) * 0.18 || 1, lo = mn - pad, hi = mx + pad;
    var pts = arr.map(function (v, i) { return [i * (W / (arr.length - 1)), H - (v - lo) / (hi - lo) * H]; });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    return { line: line, area: line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z', lx: pts[pts.length - 1][0], ly: pts[pts.length - 1][1] };
  };
})();
