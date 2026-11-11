/* GreyTraining — Nutrizione tab (Diario / Piano / Ricette), Scanner (codice o fotocamera),
   Prodotto (Open Food Facts), Inserimento manuale and the "Aggiungi a <pasto>" sheet.
   Layout from design-reference/GreyTraining.dc.html; every value comes from the user's
   profile, targets (GT.computeTargets) and food logs (GT.foodDay, GT.recentFoods, GT.adherence). */
(function () {
  'use strict';
  const GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  // ---------- Recipe ideas (static, filtered by diet and allergies) ----------
  // tags: what the recipe contains, matched against the profile's diet and allergies
  const RECIPES = [
    { n: 'Bowl di pollo, riso basmati e verdure', k: 620, p: 48, t: 20, tags: ['carne'] },
    { n: 'Overnight oats con yogurt greco e mirtilli', k: 450, p: 32, t: 5, tags: ['latticini', 'glutine'] },
    { n: 'Salmone al forno, patate e fagiolini', k: 640, p: 40, t: 30, tags: ['pesce'] },
    { n: 'Frittata di albumi e spinaci con pane integrale', k: 380, p: 34, t: 15, tags: ['uova', 'glutine'] },
    { n: 'Pasta integrale con ceci e pomodorini', k: 560, p: 24, t: 20, tags: ['glutine'] },
    { n: 'Tofu saltato con quinoa e broccoli', k: 520, p: 30, t: 20, tags: ['soia'] },
    { n: 'Insalata di lenticchie, feta e verdure', k: 480, p: 26, t: 15, tags: ['latticini'] },
    { n: 'Chili di fagioli con riso integrale', k: 550, p: 22, t: 30, tags: [] }
  ];
  const DIET_EXCLUDES = {
    vegetariana: ['carne', 'pesce', 'crostacei'],
    vegana: ['carne', 'pesce', 'crostacei', 'uova', 'latticini'],
    pescetariana: ['carne']
  };
  const ALLERGY_TAGS = [
    [/glut|celiac|grano|frumento/, 'glutine'], [/latt|caseina/, 'latticini'], [/uov/, 'uova'],
    [/pesce/, 'pesce'], [/crostac|gamber|mollusc/, 'crostacei'], [/secc|guscio|noc|mandorl|pistacch|nocciol/, 'frutta secca'],
    [/arachid/, 'arachidi'], [/soia/, 'soia'], [/sesam/, 'sesamo']
  ];

  // Usual start hour of each meal, to pick the meal that fits the time of day
  const MEAL_START = { 'Colazione': 5, 'Spuntino mattina': 10, 'Pranzo': 12, 'Spuntino': 15.5, 'Cena': 18.5 };

  // ---------- local helpers ----------
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const liters = x => (x % 1 === 0 ? x + ',0' : GT.fmtKg(x));
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const macroLine = f => `P ${GT.fmt(f.p || 0)} · C ${GT.fmt(f.c || 0)} · G ${GT.fmt(f.g || 0)}`;
  const mealTarget = (st, name) => ((st.targets && st.targets.meals) || []).filter(m => m.n === name)[0] || null;
  const allergyList = p => [].concat((p && p.allergies) || []).map(a => (a && typeof a === 'object' ? a.n || a.k || '' : String(a || ''))).map(s => s.trim()).filter(Boolean);
  const emptyScan = () => ({ code: '', loading: false, error: null, product: null });

  // Meal for "Cerca alimento": on today the meal of this time of day (or the next one not yet
  // logged), on other days the first meal with nothing logged.
  function defaultMeal(st, d) {
    const meals = GT.mealsFor(st.profile);
    const logged = name => ((d.food.meals || []).filter(m => m.name === name)[0] || { items: [] }).items.length > 0;
    let start = 0;
    if (d.nutriDate === d.today) {
      const now = new Date(), h = now.getHours() + now.getMinutes() / 60;
      meals.forEach((m, i) => { const s = MEAL_START[m]; if (s != null && s <= h) start = i; });
    }
    for (let i = start; i < meals.length; i++) if (!logged(meals[i])) return meals[i];
    return meals[start];
  }
  const validMeal = (st, name) => GT.mealsFor(st.profile).indexOf(name) >= 0;
  const mealOf = (st, d, name) => (validMeal(st, name) ? name : defaultMeal(st, d));

  // ---------- local actions ----------
  const closeOverlay = () => GT.set({ overlay: null, foodPick: null, foodQuery: '' });
  const openQuick = meal => GT.set({ overlay: 'quick', qaMeal: meal, foodQuery: '', foodPick: null });
  // From the "Aggiungi a <pasto>" sheet the chosen meal carries over to the product view
  const openScanner = () => GT.set(s => ({ overlay: null, nutriView: 'scanner', scanMode: camSupported() ? 'camera' : 'code', scanHint: null, scanNote: null, scan: emptyScan(), foodPick: null, prodMeal: s.overlay === 'quick' ? s.qaMeal : null }));
  const closeNutriView = () => GT.set({ nutriView: null, scan: emptyScan(), scanHint: null, scanNote: null });
  const openManual = (meal, back) => GT.set(s => ({ overlay: null, nutriView: 'manual', manual: { meal: meal, back: back || null, n: '', grams: '', k: '', p: '', c: '', g: '', tried: false }, scan: Object.assign({}, s.scan, { error: null, loading: false }), foodPick: null }));
  const shiftDay = n => GT.set(s => {
    const today = GT.todayISO(), cur = s.nutriDate || today, next = GT.addDays(cur, n);
    return { nutriDate: next >= today ? null : next, foodOpen: null };
  });
  const goToday = () => GT.set({ nutriDate: null, foodOpen: null });

  // ---------- camera barcode reader ----------
  // Two engines: the browser's own BarcodeDetector where it exists (Chrome on Android), otherwise
  // ZXing (open source, loaded from jsDelivr only when the camera opens) — this is the path on
  // iPhone, whose Safari has no BarcodeDetector.
  // Screens are plain functions, so the camera lives in this module and follows the <video>
  // element through a stable ref callback: mounted -> start, unmounted -> stop.
  const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  const cam = { el: null, stream: null, timer: null, det: null, reader: null, busy: false, status: 'idle', req: 0 };
  const hasMedia = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const hasNative = () => 'BarcodeDetector' in window;
  function camSupported() { return hasMedia(); }
  let zxingLoad = null;
  function loadZXing() {
    if (window.ZXing && window.ZXing.BrowserMultiFormatReader) return Promise.resolve(window.ZXing);
    if (!zxingLoad) {
      zxingLoad = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = ZXING_URL; s.async = true;
        s.onload = () => (window.ZXing ? resolve(window.ZXing) : reject(new Error('zxing')));
        s.onerror = () => { zxingLoad = null; reject(new Error('zxing')); };
        document.head.appendChild(s);
      });
    }
    return zxingLoad;
  }
  // A barcode was read: stop the camera and look the product up
  function onCode(raw) {
    const hit = String(raw || '').replace(/\D/g, '');
    if (hit.length < 8 || cam.status === 'found') return;
    stopCam(); camStatus('found');
    try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
    A.lookupBarcode(hit);
  }
  function stopCam() {
    cam.req++;
    clearInterval(cam.timer); cam.timer = null; cam.busy = false;
    if (cam.reader) { try { cam.reader.reset(); } catch (e) {} cam.reader = null; }
    if (cam.stream) cam.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
    cam.stream = null;
    if (cam.el) { try { cam.el.srcObject = null; } catch (e) {} }
  }
  function camStatus(s) { if (cam.status !== s) { cam.status = s; GT.render(); } }
  function pollCam() {
    const v = cam.el;
    if (!v || !cam.stream || !cam.det || cam.busy || v.readyState < 2) return;
    cam.busy = true;
    cam.det.detect(v).then(codes => {
      cam.busy = false;
      const hit = (codes || []).map(c => String(c.rawValue || '').replace(/\D/g, '')).filter(c => c.length >= 8)[0];
      if (hit && cam.stream) onCode(hit);
    }).catch(() => { cam.busy = false; });
  }
  const camError = err => camStatus(err && (err.name === 'NotAllowedError' || err.name === 'SecurityError') ? 'denied' : 'error');
  // ZXing engine: it opens the camera on the <video> element and decodes continuously
  function startZXing(token) {
    loadZXing().then(Z => {
      if (token !== cam.req || !cam.el) return;
      const hints = new Map();
      hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
      hints.set(Z.DecodeHintType.TRY_HARDER, true);
      const reader = new Z.BrowserMultiFormatReader(hints, 250);
      cam.reader = reader;
      const v = cam.el;
      v.muted = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
      return reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }, v, result => {
        if (result && token === cam.req) onCode(result.getText());
      }).then(() => {
        if (token !== cam.req) { try { reader.reset(); } catch (e) {} return; }
        camStatus('live');
      });
    }).catch(err => {
      if (token !== cam.req) return;
      if (err && err.message === 'zxing') { camStatus('noLib'); return; }
      camError(err);
    });
  }
  function startCam() {
    if (!cam.el || cam.stream || cam.reader || !camSupported()) return;
    const token = ++cam.req;
    camStatus('starting');
    if (!hasNative()) { startZXing(token); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(stream => {
      if (token !== cam.req || !cam.el) { stream.getTracks().forEach(t => t.stop()); return; }
      cam.stream = stream;
      const v = cam.el;
      v.muted = true; v.setAttribute('playsinline', ''); v.srcObject = stream;
      const p = v.play(); if (p && p.catch) p.catch(() => {});
      if (!cam.det) {
        try { cam.det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }); }
        catch (e) { try { cam.det = new window.BarcodeDetector(); } catch (e2) { cam.det = null; } }
      }
      if (!cam.det) { stopCam(); camStatus('error'); return; }
      cam.timer = setInterval(pollCam, 400);
      camStatus('live');
    }).catch(err => {
      if (token !== cam.req) return;
      camError(err);
    });
  }
  function camRef(el) {
    if (el) {
      cam.el = el;
      const sc = GT.state.scan || {};
      if (!sc.loading && !sc.error) startCam();
    } else {
      stopCam(); cam.el = null; cam.status = 'idle';
    }
  }
  // iOS and Android stop the camera in the background: release it and restart on return
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (cam.stream || cam.reader) { stopCam(); cam.status = 'idle'; } return; }
    const st = GT.state, sc = st.scan || {};
    if (cam.el && st.nutriView === 'scanner' && st.scanMode === 'camera' && !sc.loading && !sc.error) startCam();
  });
  const setScanMode = mode => {
    if (mode === 'camera' && !camSupported()) {
      GT.set({ scanMode: 'code', scanNote: 'La lettura con fotocamera non è disponibile su questo dispositivo: inserisci il codice a mano.' });
      return;
    }
    GT.set(s => ({ scanMode: mode, scanNote: null, scanHint: null, scan: Object.assign({}, s.scan, { error: null }) }));
  };
  const searchCode = e => {
    if (e && e.preventDefault) e.preventDefault();
    const c = String(GT.state.scan.code || '').replace(/\D/g, '');
    if (c.length < 8) { GT.set({ scanHint: 'Il codice deve avere almeno 8 cifre (EAN-8 o EAN-13).' }); return; }
    GT.set({ scanHint: null });
    A.lookupBarcode(c);
  };
  const retryScan = () => {
    const st = GT.state, sc = st.scan;
    if (sc.error && !/non trovato/.test(sc.error) && sc.code) { A.lookupBarcode(sc.code); return; }
    GT.set({ scan: Object.assign({}, sc, { error: null, loading: false }) });
    if (st.scanMode === 'camera' && cam.el) setTimeout(startCam, 0);
  };

  // ---------- small view pieces ----------
  const chipRow = (items, h) => html`<div style="display:flex;gap:6px;flex-wrap:wrap">${items.map(c => html`<button key=${c.label} onClick=${c.go} aria-pressed=${c.active} style=${`height:${h || 36}px;padding:0 ${h >= 40 ? 14 : 12}px;border-radius:999px;font-size:.8125rem;font-weight:800;background:${c.bg};color:${c.fg};border:1px solid var(--c-s3)`}>${c.label}</button>`)}</div>`;
  const spinner = (size, label) => html`<div style="display:flex;flex-direction:column;align-items:center;gap:12px"><span style=${`width:${size}px;height:${size}px;border-radius:50%;border:3px solid rgba(255,255,255,.25);border-top-color:#FFFBF9;animation:gtSpin .8s linear infinite`}></span><span style="font-size:.875rem;font-weight:700">${label}</span></div>`;
  const tile = (v, l, bg) => html`<div key=${l} style=${`padding:10px 4px;border-radius:10px;background:${bg || 'var(--c-s2)'}`}><div class="num" style="font-size:1.25rem;font-weight:900">${v}</div><div style="font-size:.6875rem;color:var(--c-fg3)">${l}</div></div>`;
  const stepper = (val, dec, inc, label) => html`<div style="display:flex;align-items:center;gap:4px;background:var(--c-s2);border-radius:12px">
    <button onClick=${dec} aria-label=${`Meno 10 g${label ? ' · ' + label : ''}`} style="width:48px;height:48px;display:grid;place-items:center"><i class="ph-light ph-minus" style="font-size:20px"></i></button>
    <span class="num" style="min-width:72px;text-align:center;font-size:1.25rem;font-weight:900">${GT.fk(val)} g</span>
    <button onClick=${inc} aria-label=${`Più 10 g${label ? ' · ' + label : ''}`} style="width:48px;height:48px;display:grid;place-items:center"><i class="ph-light ph-plus" style="font-size:20px"></i></button>
  </div>`;

  // ---------- Nutrizione tab ----------
  GT.screens.nutri = function (st, d) {
    const sub = st.nutriSub || 'diario';
    const isDiario = sub === 'diario', isPiano = sub === 'piano', isRicette = sub === 'ricette';
    const T = d.targets, tot = d.tot, macros = d.macros;
    const isToday = d.nutriDate >= d.today;

    const nutriSegs = ui.seg([['diario', 'Diario'], ['piano', 'Piano'], ['ricette', 'Ricette']], sub, x => GT.set({ nutriSub: x, foodOpen: null }));

    const header = html`<header style="padding:4px 4px">
      ${isDiario ? html`<div style="display:flex;align-items:center;gap:2px;height:32px;margin:-8px 0 -6px -12px">
        <button onClick=${() => shiftDay(-1)} aria-label="Giorno precedente" style="width:36px;height:36px;display:grid;place-items:center;color:var(--c-fg3)"><i class="ph-bold ph-caret-left" style="font-size:14px"></i></button>
        <span style=${S.eyebrow}>${GT.fmtLong(d.nutriDate)}</span>
        <button onClick=${() => shiftDay(1)} disabled=${isToday} aria-label="Giorno successivo" style=${`width:36px;height:36px;display:grid;place-items:center;color:var(--c-fg3);opacity:${isToday ? 0.3 : 1};cursor:${isToday ? 'default' : 'pointer'}`}><i class="ph-bold ph-caret-right" style="font-size:14px"></i></button>
        ${!isToday ? html`<button onClick=${goToday} style="margin-left:auto;height:28px;padding:0 12px;border-radius:999px;border:1px solid var(--c-s3);font-size:.75rem;font-weight:800">Oggi</button>` : null}
      </div>` : html`<div style=${S.eyebrow}>${GT.fmtLong(d.today)}</div>`}
      <h1 style=${S.h1}>Nutrizione</h1>
    </header>`;

    let body = null;

    // ----- Diario -----
    if (isDiario) {
      const nutriA = GT.v('vNutri') !== 'B';
      const over = tot.k > T.k && T.k > 0;
      const bigK = over ? GT.fk(tot.k - T.k) : d.kcalLeft;
      const bigLabel = over ? 'Sopra obiettivo' : 'Rimanenti';
      const emptyDay = !d.food.logged;
      const emptyLine = emptyDay ? html`<div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.4">${isToday ? 'Nessun alimento registrato oggi.' : 'Nessun alimento registrato in questo giorno.'} Aggiungi il primo con Cerca alimento o Codice a barre.</div>` : null;

      const summaryA = html`<div style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:14px'}>
        <div style="display:flex;justify-content:space-between;align-items:flex-end"><div><div style="font-size:.75rem;color:var(--c-fg3)">${bigLabel}</div><div class="num" style="font-size:2.75rem;font-weight:900;letter-spacing:-.03em;line-height:1">${bigK}</div></div><div class="num" style="text-align:right;font-size:.8125rem;color:var(--c-fg3);line-height:1.5">Assunte <b style="color:var(--c-fg)">${d.kcalEaten}</b><br />Obiettivo ${GT.fk(T.k)}</div></div>
        <div style="height:8px;border-radius:4px;background:var(--c-s3);overflow:hidden"><div style=${`height:8px;background:var(--c-acc);width:${d.kcalPct}`}></div></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          ${macros.map(m => html`<div key=${m.label} style="display:flex;flex-direction:column;gap:6px"><span style="font-size:.75rem;color:var(--c-fg3)">${m.label}</span><span class="num" style="font-size:1rem;font-weight:800">${GT.fk(m.eaten)}<span style="color:var(--c-fg3);font-weight:600"> / ${GT.fk(m.target)} g</span></span><div style="height:4px;border-radius:2px;background:var(--c-s3);overflow:hidden"><div style=${`height:4px;background:var(--c-acc);width:${m.pct}`}></div></div></div>`)}
        </div>
        ${emptyLine}
      </div>`;

      const summaryB = html`<div style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:14px'}>
        <div style="display:grid;grid-template-columns:132px 1fr;gap:16px;align-items:center">
          <div style="position:relative;width:132px;height:132px"><svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true"><circle cx="66" cy="66" r="58" fill="none" style="stroke:var(--c-s3)" stroke-width="10"></circle><circle cx="66" cy="66" r="58" fill="none" style="stroke:var(--c-acc)" stroke-width="10" stroke-linecap="round" stroke-dasharray="364.4" stroke-dashoffset=${d.kcalRingOffset} transform="rotate(-90 66 66)"></circle></svg><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><span class="num" style="font-size:1.75rem;font-weight:900;line-height:1">${bigK}</span><span style="font-size:.75rem;color:var(--c-fg3)">${over ? 'kcal in più' : 'kcal rimanenti'}</span></div></div>
          <div style="display:flex;flex-direction:column;gap:12px">${macros.map(m => html`<div key=${m.label}><div style="display:flex;justify-content:space-between;font-size:.8125rem"><span style="color:var(--c-fg3)">${m.label}</span><b class="num">${GT.fk(m.left)} g</b></div><div style="height:6px;border-radius:3px;background:var(--c-s3);overflow:hidden;margin-top:5px"><div style=${`height:6px;background:var(--c-acc);width:${m.pct}`}></div></div></div>`)}</div>
        </div>
        <div class="num" style="font-size:.8125rem;color:var(--c-fg3)">${d.kcalEatenLine}</div>
        ${emptyLine}
      </div>`;

      // Water: one button per 250 ml glass of the target; tap sets the level, tap on the last full one lowers it by one
      const nGlass = Math.max(1, (T && T.glasses) || 8), cols = nGlass <= 8 ? nGlass : Math.ceil(nGlass / Math.ceil(nGlass / 8));
      const glasses = Array.from({ length: nGlass }, (_, i) => {
        const f = i < d.water;
        return { i, f, go: () => A.setWater(d.water === i + 1 ? i : i + 1) };
      });
      const water = html`<div style=${S.card + ';padding:14px 16px;display:flex;flex-direction:column;gap:10px'}>
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span style=${S.eyebrow}>Acqua</span><span class="num" style="font-size:.875rem;font-weight:800">${liters(d.water * 0.25)} / ${liters(T.water || nGlass * 0.25)} L</span></div>
        <div style=${`display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px`}>
          ${glasses.map(w => html`<button key=${w.i} onClick=${w.go} aria-label=${`${w.i + 1} ${w.i ? 'bicchieri' : 'bicchiere'} · ${GT.fk((w.i + 1) * 250)} ml`} aria-pressed=${w.f} style=${`height:44px;border-radius:8px;background:${w.f ? 'var(--c-acc-soft)' : 'var(--c-s2)'};display:grid;place-items:center`}><i class=${w.f ? 'ph-fill ph-drop' : 'ph-light ph-drop'} style=${`font-size:20px;color:${w.f ? 'var(--c-acc-t)' : 'var(--c-fg3)'}`}></i></button>`)}
        </div>
      </div>`;

      const meals = (d.food.meals || []).map(m => {
        const tg = mealTarget(st, m.name);
        return html`<div key=${m.name} style=${S.card + ';padding:6px 16px'}>
          <div style="display:flex;justify-content:space-between;align-items:center;min-height:48px">
            <div><span style="font-weight:900;font-size:1rem">${m.name}</span><span class="num" style="font-size:.8125rem;color:var(--c-fg3);margin-left:8px">${GT.fk(m.k)}${tg ? ' / ' + GT.fk(tg.k) : ''} kcal</span></div>
            <button onClick=${() => openQuick(m.name)} aria-label=${'Aggiungi a ' + m.name} style="width:44px;height:44px;margin-right:-10px;display:grid;place-items:center"><i class="ph-light ph-plus-circle" style="font-size:26px"></i></button>
          </div>
          ${m.items.map((it, i) => {
            const key = d.nutriDate + '|' + m.name + '|' + i, open = st.foodOpen === key;
            return html`<div key=${it.n + '-' + i} style="border-top:1px solid var(--c-line)">
              <button onClick=${() => GT.set({ foodOpen: open ? null : key })} aria-expanded=${open} style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;font-size:.875rem;text-align:left">
                <div style="min-width:0"><div style="font-weight:600">${it.n}</div><div class="num" style="color:var(--c-fg3);font-size:.75rem;margin-top:2px">${it.q ? it.q + ' · ' : ''}${macroLine(it)}</div></div>
                <span class="num" style="flex:none;color:var(--c-fg2)">${GT.fk(it.k)}</span>
              </button>
              ${open ? html`<div style="display:flex;justify-content:flex-end;gap:8px;padding:0 0 10px">
                <button onClick=${() => GT.set({ foodOpen: null })} style="height:40px;padding:0 14px;border-radius:10px;background:var(--c-s2);font-weight:800;font-size:.8125rem">Annulla</button>
                <button onClick=${() => { A.removeFood(m.name, i); GT.set({ foodOpen: null }); }} style="height:40px;padding:0 14px;border-radius:10px;background:var(--c-acc-soft);color:var(--c-acc-t);font-weight:800;font-size:.8125rem;display:flex;align-items:center;gap:6px"><i class="ph-light ph-trash" style="font-size:16px"></i>Rimuovi</button>
              </div>` : null}
            </div>`;
          })}
          ${!m.items.length ? html`<div class="num" style="padding:6px 0 12px;font-size:.8125rem;color:var(--c-fg3)">${tg ? `Obiettivo: ${GT.fk(tg.k)} kcal · P ${tg.p} g` : 'Niente registrato.'}</div>` : null}
        </div>`;
      });

      body = [nutriA ? summaryA : summaryB, water].concat(meals);
    }

    // ----- Piano -----
    if (isPiano) {
      const goal = st.profile ? GT.GOAL_NAME[st.profile.goal] || 'Piano' : 'Piano';
      const pct = Math.round(((T.adj || 1) - 1) * 100);
      const adjLabel = pct === 0 ? 'obiettivo mantenimento' : `obiettivo ${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
      const raw = T.tdee && T.adj ? Math.round(T.tdee * T.adj / 50) * 50 : T.k;
      // Only the safety minimum of GT.computeTargets (1.400 / 1.600 kcal) raises the target
      const floored = raw < T.k && T.k === ((st.profile || {}).sex === 'f' ? 1400 : 1600);
      const adh = GT.adherence(st);
      const loggedDays = adh.filter(a => a.logged), inRange = loggedDays.filter(a => a.pct >= 90 && a.pct <= 110).length;
      const bars = adh.map(a => {
        const today = a.date === d.today;
        const bg = today ? 'var(--c-acc)' : a.pct >= 90 && a.pct <= 110 ? 'var(--c-sec)' : 'var(--c-fg3)';
        const ok = a.logged && a.pct != null;
        return { key: a.date, letter: a.letter, logged: ok, v: ok ? a.pct + '%' : '—', h: ok ? Math.max(4, Math.min(100, a.pct)) + '%' : '100%', bg, today };
      });
      body = [
        html`<div key="plan" style=${S.card + ';padding:16px'}>
          <div class="num" style="font-size:1.125rem;font-weight:900">${goal} · ${GT.fk(T.k)} kcal</div>
          <div class="num" style="font-size:.875rem;color:var(--c-fg2);margin-top:4px">P ${GT.fk(T.p)} g${T.protPerKg ? ` (${GT.fmt(T.protPerKg)} g/kg)` : ''} · C ${GT.fk(T.c)} g · G ${GT.fk(T.g)} g</div>
          ${T.bmr ? html`<div class="num" style="font-size:.8125rem;color:var(--c-fg3);margin-top:10px;line-height:1.45">Metabolismo basale ${GT.fk(T.bmr)} kcal × attività ${GT.fmtKg(T.factor)} = ${GT.fk(T.tdee)} kcal · ${adjLabel}${floored ? ` · alzato al minimo di ${GT.fk(T.k)} kcal` : ''}. Si ricalcola quando aggiorni peso, attività o obiettivo nel Profilo.</div>` : null}
          <div style=${S.eyebrow + ';margin:18px 0 10px'}>Aderenza ultimi 7 giorni</div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;align-items:end;height:96px">
            ${bars.map(a => html`<div key=${a.key} style="display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end">
              <span class="num" style=${`font-size:.6875rem;color:${a.today ? 'var(--c-fg)' : 'var(--c-fg3)'}`}>${a.v}</span>
              <div style="flex:1;width:100%;display:flex;align-items:flex-end">${a.logged
                ? html`<div style=${`width:100%;border-radius:4px;background:${a.bg};height:${a.h}`}></div>`
                : html`<div style="width:100%;height:100%;border-radius:4px;border:1px dashed var(--c-s3)"></div>`}</div>
              <span style=${`font-size:.6875rem;font-weight:700;color:${a.today ? 'var(--c-fg)' : 'var(--c-fg3)'}`}>${a.letter}</span>
            </div>`)}
          </div>
          ${loggedDays.length
            ? html`<div class="num" style="font-size:.8125rem;color:var(--c-fg3);margin-top:12px;line-height:1.45">${plural(loggedDays.length, 'giorno registrato', 'giorni registrati')} su 7 · ${inRange} nel range 90–110% delle kcal.</div>`
            : html`<div style="display:flex;flex-direction:column;gap:10px;margin-top:12px"><div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.45">Ancora nessun giorno registrato. L'aderenza compare quando registri i pasti nel Diario.</div><button onClick=${() => GT.set({ nutriSub: 'diario', nutriDate: null })} style="height:44px;border-radius:12px;background:var(--c-s2);font-weight:800">Apri il Diario</button></div>`}
        </div>`,
        ui.eyebrow('Target per pasto', 'margin:6px 4px 0'),
        ((T.meals || []).map(p => html`<div key=${p.n} style=${S.card + ';display:flex;justify-content:space-between;align-items:center;padding:14px 16px'}><div><div style="font-weight:800">${p.n}</div><div class="num" style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px">P ${p.p} · C ${p.c} · G ${p.g}</div></div><span class="num" style="font-weight:900">${GT.fk(p.k)} kcal</span></div>`))
      ];
    }

    // ----- Ricette -----
    if (isRicette) {
      const p = st.profile || {}, diet = norm(p.diet), alls = allergyList(p);
      const excl = (DIET_EXCLUDES[diet] || []).slice();
      alls.forEach(a => { const n = norm(a); ALLERGY_TAGS.forEach(([re, tag]) => { if (re.test(n)) excl.push(tag); }); });
      const list = RECIPES.filter(r => !r.tags.some(t => excl.indexOf(t) >= 0));
      const main = ((T.meals || []).slice().sort((a, b) => b.k - a.k)[0]) || null;
      const filters = [DIET_EXCLUDES[diet] ? 'dieta ' + diet : null, alls.length ? 'senza ' + alls.join(', ').toLowerCase() : null].filter(Boolean);
      body = [
        html`<div key="rintro" style="padding:0 4px;font-size:.875rem;color:var(--c-fg2);line-height:1.45">Idee in linea con il tuo piano${main ? html`: un pasto principale vale circa <b class="num">${GT.fk(main.k)} kcal</b> e <b class="num">${main.p} g</b> di proteine` : null}.${filters.length ? html`<br /><span style="color:var(--c-fg3);font-size:.8125rem">Filtrate per ${filters.join(' · ')}.</span>` : null}</div>`,
        list.length
          ? html`<div key="rgrid" style="flex:none;display:grid;grid-template-columns:1fr 1fr;gap:10px">
              ${list.map(r => html`<div key=${r.n} style=${S.card + ';overflow:hidden'}><div style="aspect-ratio:4/3;background:var(--c-s2);display:grid;place-items:center"><i class="ph-light ph-image" style="font-size:26px;color:var(--c-fg3)"></i></div><div style="padding:10px 12px 12px"><div style="font-weight:800;font-size:.875rem;line-height:1.3">${r.n}</div><div class="num" style="font-size:.75rem;color:var(--c-fg3);margin-top:4px">${GT.fk(r.k)} kcal · P ${r.p} g · ${r.t} min</div></div></div>`)}
            </div>`
          : html`<div key="rempty" style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:10px'}><div style="font-size:.9375rem;line-height:1.45">Nessuna idea compatibile con la dieta e le allergie indicate.</div><div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.45">Controlla dieta e allergie nel Profilo: le ricette si filtrano in base a quelle.</div><button onClick=${() => GT.set({ overlay: 'profile' })} style="height:44px;border-radius:12px;background:var(--c-s2);font-weight:800">Apri il Profilo</button></div>`
      ];
    }

    // A running workout shows app.js's mini-bar (56 px at tabH + 8): keep the fixed bar and the
    // end of the list above it
    const mini = st.s ? 72 : 0;
    const main = html`<div key="nutri" class="scroll" style=${S.tabScroll + (isDiario ? `;padding-bottom:calc(var(--tabH) + ${100 + mini}px)` : mini ? `;padding-bottom:calc(var(--tabH) + ${24 + mini}px)` : '')}>
      ${header}
      ${ui.Seg(nutriSegs)}
      ${body}
    </div>`;

    const bar = isDiario ? html`<div key="nutriBar" style=${`position:absolute;left:0;right:0;bottom:calc(var(--tabH) + ${mini}px);padding:10px 16px;background:var(--c-bg);border-top:1px solid var(--c-line);display:grid;grid-template-columns:1.4fr 1fr;gap:8px;z-index:25`}>
      <button class="press" onClick=${() => openQuick(defaultMeal(st, d))} style="height:56px;border-radius:12px;background:var(--c-acc);color:var(--c-on-acc);font-weight:900;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-bold ph-magnifying-glass" style="font-size:20px"></i>Cerca alimento</button>
      <button class="press" onClick=${openScanner} style="height:56px;border-radius:12px;background:var(--c-s2);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-light ph-barcode" style="font-size:20px"></i>Barcode</button>
    </div>` : null;

    return [main, bar];
  };

  // ---------- Aggiungi a <pasto> (bottom sheet, overlay === 'quick') ----------
  GT.screens.quickAdd = function (st, d) {
    const meal = mealOf(st, d, st.qaMeal);
    const chips = ui.chip(GT.mealsFor(st.profile), meal, x => GT.set({ qaMeal: x }));
    const q = st.foodQuery || '';
    const pick = st.foodPick, food = pick ? GT.FOODS.filter(f => f.id === pick.id)[0] : null;
    const dateNote = d.nutriDate !== d.today ? ' · ' + GT.fmtShort(d.nutriDate) : '';

    let content;
    if (food) {
      const grams = Math.max(5, pick.grams || food.portion || 100);
      const item = GT.foodItem(food, grams);
      const setG = g => GT.set({ foodPick: { id: food.id, grams: Math.max(5, Math.min(3000, Math.round(g))) } });
      const quick = [[food.unit + ' · ' + food.portion + ' g', food.portion], ['2 × ' + food.portion + ' g', food.portion * 2], ['100 g', 100]]
        .filter((x, i, arr) => arr.findIndex(y => y[1] === x[1]) === i);
      content = html`<div style="background:var(--c-s2);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:14px">
        <div><div style="font-weight:900;font-size:1rem;line-height:1.3">${food.n}</div><div class="num" style="font-size:.75rem;color:var(--c-fg3);margin-top:2px">${GT.fk(food.k)} kcal · ${macroLine(food)} per 100 g</div></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span style=${S.eyebrow}>Porzione</span>
          <div style="display:flex;align-items:center;gap:4px;background:var(--c-s3);border-radius:12px">
            <button onClick=${() => setG(grams - 10)} aria-label="Meno 10 g" style="width:48px;height:48px;display:grid;place-items:center"><i class="ph-light ph-minus" style="font-size:20px"></i></button>
            <span class="num" style="min-width:72px;text-align:center;font-size:1.25rem;font-weight:900">${GT.fk(grams)} g</span>
            <button onClick=${() => setG(grams + 10)} aria-label="Più 10 g" style="width:48px;height:48px;display:grid;place-items:center"><i class="ph-light ph-plus" style="font-size:20px"></i></button>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${quick.map(x => html`<button key=${x[0]} onClick=${() => setG(x[1])} aria-pressed=${grams === x[1]} style=${`height:36px;padding:0 12px;border-radius:999px;font-size:.8125rem;font-weight:800;border:1px solid var(--c-s3);background:${grams === x[1] ? 'var(--c-acc)' : 'transparent'};color:${grams === x[1] ? 'var(--c-on-acc)' : 'var(--c-fg)'}`}>${x[0]}</button>`)}</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center">
          ${tile(GT.fk(item.k), 'kcal', 'var(--c-s1)')}${tile(item.p, 'Prot. g', 'var(--c-s1)')}${tile(item.c, 'Carb. g', 'var(--c-s1)')}${tile(item.g, 'Grassi g', 'var(--c-s1)')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:8px">
          <button onClick=${() => GT.set({ foodPick: null })} style="height:52px;border-radius:12px;background:var(--c-s3);font-weight:800">Indietro</button>
          <button class="press" onClick=${() => { A.addFood(meal, item); GT.set({ foodPick: null, foodQuery: '' }); }} style="height:52px;border-radius:12px;background:var(--c-acc);color:var(--c-on-acc);font-weight:900">Aggiungi · ${GT.fk(item.k)} kcal</button>
        </div>
      </div>`;
    } else if (!q.trim()) {
      const recents = GT.recentFoods(st);
      content = html`<div style=${S.eyebrow + ';margin-top:4px'}>Recenti</div>
        ${recents.length ? html`<div style="display:flex;flex-direction:column">
          ${recents.map((r, i) => html`<div key=${r.n + '|' + r.q + '|' + i} style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--c-line)"><div style="min-width:0"><div style="font-weight:700;font-size:.9375rem">${r.n}</div><div class="num" style="font-size:.75rem;color:var(--c-fg3)">${r.q ? r.q + ' · ' : ''}${GT.fk(r.k)} kcal · P ${GT.fmt(r.p || 0)}</div></div><button onClick=${() => A.addFood(meal, Object.assign({}, r))} aria-label=${`Aggiungi ${r.n} a ${meal}`} style="flex:none;width:48px;height:48px;display:grid;place-items:center;margin-right:-8px"><i class="ph-light ph-plus-circle" style="font-size:28px"></i></button></div>`)}
        </div>` : html`<div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.45">Ancora nessun alimento recente. Cerca qui sopra fra ${GT.FOODS.length} alimenti comuni: quelli che aggiungi compaiono qui per l'aggiunta con un tocco.</div>`}`;
    } else {
      const res = GT.searchFoods(q), shown = res.slice(0, 30);
      content = shown.length ? html`<div style="display:flex;flex-direction:column">
          ${shown.map(f => html`<button key=${f.id} onClick=${() => GT.set({ foodPick: { id: f.id, grams: f.portion } })} style="display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:56px;padding:6px 0;border-bottom:1px solid var(--c-line);text-align:left;width:100%"><div style="min-width:0"><div style="font-weight:700;font-size:.9375rem">${f.n}</div><div class="num" style="font-size:.75rem;color:var(--c-fg3)">${GT.fk(f.k)} kcal per 100 g · ${f.unit} (${f.portion} g)</div></div><i class="ph-light ph-caret-right" style="flex:none;font-size:18px;color:var(--c-fg3)"></i></button>`)}
          ${res.length > shown.length ? html`<div class="num" style="font-size:.75rem;color:var(--c-fg3);padding:8px 0">Altri ${res.length - shown.length} risultati: aggiungi una parola per restringere.</div>` : null}
        </div>`
        : html`<div style="font-size:.8125rem;color:var(--c-fg3);line-height:1.45">Nessun alimento per “${q.trim()}”. Inseriscilo a mano con i valori dell'etichetta o leggi il codice a barre.</div>`;
    }

    return ui.sheet(closeOverlay, html`
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><div style="font-size:1.25rem;font-weight:900">Aggiungi a ${meal}</div><span class="num" style="font-size:.8125rem;color:var(--c-fg3)">${GT.fk(d.tot.k)} / ${GT.fk(d.targets.k)} kcal${dateNote}</span></div>
      ${chipRow(chips, 36)}
      ${food ? null : html`<label style="display:flex;align-items:center;gap:8px;height:48px;padding:0 14px;border-radius:12px;background:var(--c-s2)"><i class="ph-light ph-magnifying-glass" style="font-size:20px;color:var(--c-fg3)"></i><input type="search" value=${q} onInput=${e => GT.set({ foodQuery: e.target.value, foodPick: null })} placeholder="Cerca alimento (es. yogurt greco)" aria-label="Cerca alimento" enterkeyhint="search" autocomplete="off" style="flex:1;min-width:0;height:100%;background:transparent;border:0;outline:none;font-size:1rem" />${q ? html`<button onClick=${() => GT.set({ foodQuery: '' })} aria-label="Cancella ricerca" style="width:32px;height:32px;display:grid;place-items:center;color:var(--c-fg3)"><i class="ph-fill ph-x-circle" style="font-size:18px"></i></button>` : null}</label>`}
      ${content}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:2px">
        <button onClick=${() => openManual(meal, null)} style="height:52px;border-radius:12px;background:var(--c-s2);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-light ph-pencil-simple" style="font-size:20px"></i>Inserisci a mano</button>
        <button onClick=${openScanner} style="height:52px;border-radius:12px;background:var(--c-s2);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-light ph-barcode" style="font-size:20px"></i>Codice a barre</button>
      </div>
    `, { gap: 12 });
  };

  // ---------- Inserimento manuale (full screen, nutriView === 'manual') ----------
  const FIELDS = { n: 'Nome', grams: 'Quantità', k: 'Energia', p: 'Proteine', c: 'Carboidrati', g: 'Grassi' };
  function validateManual(m) {
    const e = {}, n = String(m.n || '').trim(), grams = GT.num(m.grams), k = GT.num(m.k);
    if (!n) e.n = 'Inserisci il nome.';
    if (!(grams > 0 && grams <= 5000)) e.grams = 'Grammi, più di 0.';
    if (k == null || k < 0 || k > 10000) e.k = 'Kcal (0 se assenti).';
    const mac = {};
    ['p', 'c', 'g'].forEach(x => {
      const s = String(m[x] == null ? '' : m[x]).trim();
      if (!s) { mac[x] = 0; return; }
      const v = GT.num(s);
      if (v == null || v < 0 || v > 1000) e[x] = 'Numero ≥ 0.'; else mac[x] = Math.round(v * 10) / 10;
    });
    return { e, ok: !Object.keys(e).length, item: { n, q: GT.fmt(grams || 0) + ' g', grams: grams || 0, k: Math.round(k || 0), p: mac.p || 0, c: mac.c || 0, g: mac.g || 0 } };
  }

  GT.screens.manualFood = function (st, d) {
    const m = st.manual || {};
    const meal = mealOf(st, d, m.meal);
    const setM = patch => GT.set(s => ({ manual: Object.assign({}, s.manual || {}, patch) }));
    const v = validateManual(m), err = m.tried ? v.e : {};
    const back = () => (m.back === 'scanner' ? GT.set({ nutriView: 'scanner', manual: null }) : GT.set({ nutriView: null, manual: null }));
    const submit = e => {
      if (e && e.preventDefault) e.preventDefault();
      const r = validateManual(GT.state.manual || {});
      if (!r.ok) { setM({ tried: true }); return; }
      A.addFood(meal, r.item);
      GT.set({ nutriView: null, manual: null, tab: 'nutri', nutriSub: 'diario', scan: emptyScan() });
    };
    // Energy implied by the macros, to flag typing mistakes (not blocking)
    const est = (v.item.p * 4) + (v.item.c * 4) + (v.item.g * 9), kk = GT.num(m.k);
    const mismatch = kk > 0 && est > 0 && Math.abs(est - kk) > Math.max(40, kk * 0.25);
    const field = (key, unit, mode, ph) => html`<label key=${key} style="display:flex;flex-direction:column;gap:6px;min-width:0">
      <span style=${S.eyebrow}>${FIELDS[key]}</span>
      <span style=${`display:flex;align-items:center;gap:6px;height:52px;padding:0 12px;border-radius:12px;background:var(--c-s2);border:1px solid ${err[key] ? 'var(--c-acc)' : 'transparent'}`}>
        <input type="text" inputmode=${mode} value=${m[key] == null ? '' : m[key]} onInput=${e => setM({ [key]: e.target.value })} placeholder=${ph} aria-label=${FIELDS[key] + (unit ? ' in ' + unit : '')} aria-invalid=${!!err[key]} autocomplete="off" enterkeyhint=${key === 'g' ? 'done' : 'next'} class=${mode === 'text' ? '' : 'num'} style="flex:1;min-width:0;height:100%;background:transparent;border:0;outline:none;font-size:1rem;font-weight:700" />
        ${unit ? html`<span style="flex:none;font-size:.8125rem;color:var(--c-fg3)">${unit}</span>` : null}
      </span>
      ${err[key] ? html`<span style="font-size:.75rem;color:var(--c-acc-t)">${err[key]}</span>` : null}
    </label>`;

    const main = html`<form key="manual" class="scroll" onSubmit=${submit} novalidate style=${S.full + ';padding:var(--top) 16px calc(var(--pb) + 96px);display:flex;flex-direction:column;gap:16px;margin:0'}>
      ${ui.back(m.back === 'scanner' ? 'Scanner' : 'Nutrizione', back)}
      <div><div style="font-size:1.75rem;font-weight:900;letter-spacing:-.02em;line-height:1.1">Inserisci a mano</div><div style="font-size:.875rem;color:var(--c-fg2);margin-top:6px;line-height:1.45">Valori per la quantità che hai mangiato. Li trovi sull'etichetta (per 100 g: moltiplica per i grammi / 100).</div></div>
      ${field('n', '', 'text', 'Es. Insalata di riso')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${field('grams', 'g', 'decimal', '0')}${field('k', 'kcal', 'decimal', '0')}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${field('p', 'g', 'decimal', '0')}${field('c', 'g', 'decimal', '0')}${field('g', 'g', 'decimal', '0')}</div>
      ${mismatch ? html`<div class="num" style="display:flex;gap:8px;align-items:flex-start;font-size:.8125rem;color:var(--c-fg2);line-height:1.4;padding:10px 12px;border-radius:10px;background:var(--c-s2)"><i class="ph-light ph-info" style="font-size:18px;flex:none"></i><span>Le macro valgono circa ${GT.fk(est)} kcal, contro le ${GT.fk(kk)} inserite: controlla i valori.</span></div>` : null}
      <div><div style=${S.eyebrow + ';margin-bottom:8px'}>Pasto${d.nutriDate !== d.today ? ' · ' + GT.fmtShort(d.nutriDate) : ''}</div>${chipRow(ui.chip(GT.mealsFor(st.profile), meal, x => setM({ meal: x })), 40)}</div>
      <button type="submit" style="display:none" aria-hidden="true" tabindex="-1"></button>
    </form>`;

    const bar = html`<div key="manualBar">${ui.bottomBar(ui.cta(v.ok ? `Aggiungi a ${meal} · ${GT.fk(v.item.k)} kcal` : `Aggiungi a ${meal}`, submit))}</div>`;
    return [main, bar];
  };

  // ---------- Scanner (full screen, always dark) ----------
  GT.screens.scanner = function (st, d) {
    const sc = st.scan || emptyScan();
    const mode = st.scanMode === 'camera' ? 'camera' : 'code';
    const isCam = mode === 'camera';
    const segs = [['code', 'Codice'], ['camera', 'Fotocamera']].map(([v, l]) => ({ v, l, a: v === mode }));
    const errNotFound = sc.error && /non trovato/.test(sc.error);
    const showSheet = !!sc.error && !sc.loading;
    const meal = mealOf(st, d, st.prodMeal);

    const camMsg = {
      starting: 'Avvio fotocamera…',
      denied: 'Accesso alla fotocamera negato. Consentilo nelle impostazioni del browser oppure inserisci il codice a mano.',
      error: 'Fotocamera non disponibile. Inserisci il codice a mano.',
      noLib: 'Il lettore di codici non si è scaricato: la prima volta serve la connessione. Inserisci il codice a mano.'
    }[cam.status];
    const camBlocked = cam.status === 'denied' || cam.status === 'error' || cam.status === 'noLib';

    const middle = isCam
      ? html`<div style="flex:1;position:relative;display:grid;place-items:center;overflow:hidden">
          <video ref=${camRef} playsinline muted autoplay aria-label="Anteprima fotocamera" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000"></video>
          <div style="position:relative;width:270px;height:150px;border-radius:16px;border:2px solid rgba(255,251,249,.9);box-shadow:0 0 0 2000px rgba(0,0,0,.35)">
            ${cam.status === 'live' && !sc.loading ? html`<div style="position:absolute;left:10px;right:10px;height:2px;background:#E95145;animation:gtScan 2.4s ease-in-out infinite"></div>` : null}
          </div>
          ${camMsg && !sc.loading ? html`<div style="position:absolute;top:16px;left:24px;right:24px;text-align:center;font-size:.8125rem;line-height:1.4;color:#E6E7E8">${camMsg}</div>` : null}
          ${camBlocked && !sc.loading ? html`<button onClick=${() => setScanMode('code')} style="position:absolute;bottom:64px;left:50%;transform:translateX(-50%);height:44px;padding:0 18px;border-radius:12px;background:#FFFBF9;color:#000;font-weight:800">Inserisci il codice</button>` : null}
          ${sc.loading ? html`<div style="position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.6)">${spinner(32, 'Ricerca prodotto…')}</div>` : null}
          <div style="position:absolute;bottom:20px;left:24px;right:24px;text-align:center;font-size:.9375rem;line-height:1.4;color:#E6E7E8">Allinea il codice a barre nel riquadro. La lettura è automatica.</div>
        </div>`
      : html`<form onSubmit=${searchCode} style="flex:1;position:relative;display:flex;flex-direction:column;justify-content:center;gap:16px;padding:0 24px;margin:0">
          <div style="display:grid;place-items:center"><i class="ph-light ph-barcode" style="font-size:56px;color:#A7A9AC"></i></div>
          <label style="display:flex;flex-direction:column;gap:8px">
            <span style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#A7A9AC;text-align:center">Numero sotto il codice a barre</span>
            <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="14" value=${sc.code} onInput=${e => GT.set({ scan: Object.assign({}, GT.state.scan, { code: e.target.value.replace(/\D/g, '').slice(0, 14), error: null }), scanHint: null })} placeholder="8001234567890" aria-label="Codice a barre" autocomplete="off" enterkeyhint="search" class="num" style="height:72px;border-radius:14px;background:#1F1F1F;border:1px solid #2B2B2B;outline:none;color:#FFFBF9;text-align:center;font-size:1.75rem;font-weight:900;letter-spacing:.06em;padding:0 12px;width:100%" />
          </label>
          ${st.scanHint ? html`<div style="text-align:center;font-size:.8125rem;color:#F06A5F">${st.scanHint}</div>` : null}
          ${st.scanNote ? html`<div style="display:flex;gap:8px;align-items:flex-start;font-size:.8125rem;line-height:1.4;color:#E6E7E8;padding:10px 12px;border-radius:10px;background:#1F1F1F"><i class="ph-light ph-info" style="font-size:18px;flex:none"></i><span>${st.scanNote}</span></div>` : null}
          <button type="submit" class="press" disabled=${sc.loading} style="height:56px;border-radius:12px;background:#E95145;color:#000;font-weight:900;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-bold ph-magnifying-glass" style="font-size:20px"></i>Cerca</button>
          <div style="text-align:center;font-size:.8125rem;line-height:1.4;color:#A7A9AC">EAN-8 o EAN-13. I valori arrivano da Open Food Facts, un database libero: verificali sull'etichetta.</div>
          ${sc.loading ? html`<div style="position:absolute;inset:0;display:grid;place-items:center;background:rgba(10,10,10,.8)">${spinner(32, 'Ricerca prodotto…')}</div>` : null}
        </form>`;

    return html`<div key="scanner" style="position:absolute;inset:0;z-index:20;background:#0A0A0A;color:#FFFBF9;display:flex;flex-direction:column;padding-top:var(--top)">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 12px">
        <button onClick=${closeNutriView} aria-label="Chiudi" style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.12);display:grid;place-items:center"><i class="ph-light ph-x" style="font-size:22px"></i></button>
        <span style="font-weight:800">${isCam ? 'Scansiona codice' : 'Codice a barre'}</span>
        <span style="width:48px;height:48px"></span>
      </div>
      ${middle}
      <div style="padding:16px 16px calc(var(--pb) + 6px);background:#0A0A0A">
        <div style="display:flex;gap:4px;padding:4px;background:#1F1F1F;border-radius:12px;width:100%">
          ${segs.map(s => html`<button key=${s.v} onClick=${() => setScanMode(s.v)} aria-pressed=${s.a} style=${`flex:1;height:40px;border-radius:9px;font-weight:800;font-size:.875rem;background:${s.a ? '#FFFBF9' : 'transparent'};color:${s.a ? '#000' : '#BCBEC0'}`}>${s.l}</button>`)}
        </div>
      </div>
      ${showSheet ? html`
        <div role="dialog" aria-modal="true" aria-labelledby="scanErrTitle" style="position:absolute;left:0;right:0;bottom:0;z-index:5;background:var(--c-s1);color:var(--c-fg);border-radius:24px 24px 0 0;padding:24px 20px calc(var(--pb) + 6px);display:flex;flex-direction:column;gap:12px;animation:gtSheet .28s cubic-bezier(.2,0,0,1)">
          <i class=${errNotFound ? 'ph-light ph-warning-circle' : 'ph-light ph-wifi-slash'} style="font-size:32px"></i>
          <div id="scanErrTitle" style="font-size:1.25rem;font-weight:900">${errNotFound ? 'Prodotto non trovato' : 'Ricerca non riuscita'}</div>
          <div class="num" style="font-size:.9375rem;color:var(--c-fg2);line-height:1.45">${errNotFound ? `Il codice ${sc.code} non è nel database Open Food Facts. Inserisci i valori dell'etichetta a mano o riprova con un altro codice.` : `${sc.error} Puoi riprovare o inserire i valori a mano.`}</div>
          <button class="press" onClick=${() => openManual(meal, 'scanner')} style="height:56px;border-radius:12px;background:var(--c-acc);color:var(--c-on-acc);font-weight:900;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-bold ph-pencil-simple" style="font-size:20px"></i>Inserisci a mano</button>
          <button onClick=${retryScan} style="height:52px;border-radius:12px;background:var(--c-s2);font-weight:800">Riprova</button>
        </div>` : null}
    </div>`;
  };

  // ---------- Prodotto (full screen, fixed CTA bar) ----------
  GT.screens.product = function (st, d) {
    const sc = st.scan || emptyScan(), pr = sc.product;
    const backToScanner = () => GT.set({ nutriView: 'scanner', scan: Object.assign({}, sc, { product: null, error: null, loading: false }) });
    if (!pr || !pr.per100) {
      return html`<div key="product" class="scroll" style=${S.full + ';padding:var(--top) 16px calc(var(--pb) + 24px);display:flex;flex-direction:column;gap:14px'}>
        ${ui.back('Scanner', backToScanner)}
        <div style=${S.card + ';padding:16px;display:flex;flex-direction:column;gap:10px'}><div style="font-size:1.125rem;font-weight:900">Nessun prodotto aperto</div><div style="font-size:.875rem;color:var(--c-fg2);line-height:1.45">Leggi o digita un codice a barre: i valori nutrizionali compaiono qui.</div><button onClick=${backToScanner} style="height:48px;border-radius:12px;background:var(--c-s2);font-weight:800">Apri lo scanner</button></div>
      </div>`;
    }
    const per = pr.per100, portion = Math.max(10, st.portion || 100);
    const meal = mealOf(st, d, st.prodMeal);
    const item = Object.assign(GT.foodItem({ n: pr.n, k: per.k, p: per.p, c: per.c, g: per.g }, portion), { code: pr.code, src: 'barcode' });
    const setPortion = g => GT.set({ portion: Math.max(10, Math.min(3000, Math.round(g))) });
    const serving = Math.round(pr.serving || 0);
    const quick = [serving && serving !== 100 ? ['1 porzione · ' + serving + ' g', serving] : null, ['100 g', 100]].filter(Boolean);
    const val = (v, unit) => (v == null || v === '' || isNaN(Number(v)) ? '—' : unit === 'kcal' ? GT.fk(Number(v)) + ' kcal' : GT.fmt(Number(v)) + ' g');
    const table = [['Energia', per.k, 'kcal'], ['Grassi', per.g], ['di cui saturi', per.sat, 'g', 1], ['Carboidrati', per.c], ['di cui zuccheri', per.sugars, 'g', 1], ['Fibre', per.fiber], ['Proteine', per.p], ['Sale', per.salt]];
    const add = () => {
      A.addFood(meal, item);
      GT.set({ nutriView: null, nutriSub: 'diario', tab: 'nutri', prodMeal: null, scan: emptyScan() });
    };

    const main = html`<div key="product" class="scroll" style=${S.full + ';padding:var(--top) 16px calc(var(--pb) + 96px);display:flex;flex-direction:column;gap:14px'}>
      ${ui.back('Scanner', backToScanner)}
      <div style="display:grid;grid-template-columns:72px 1fr;gap:14px;align-items:center"><div style="width:72px;height:72px;border-radius:12px;background:var(--c-s2);display:grid;place-items:center"><i class="ph-light ph-image" style="font-size:24px;color:var(--c-fg3)"></i></div><div style="min-width:0"><div style="font-size:1.375rem;font-weight:900;letter-spacing:-.01em;line-height:1.15">${pr.n}</div><div class="num" style="font-size:.8125rem;color:var(--c-fg3);margin-top:3px">${[pr.brand, pr.code ? 'EAN ' + pr.code : ''].filter(Boolean).join(' · ')}</div></div></div>
      <div style="display:flex;gap:8px;align-items:center;font-size:.75rem;font-weight:700;padding:8px 12px;border-radius:8px;background:var(--c-s2);color:var(--c-fg2)"><i class="ph-light ph-barcode" style="font-size:16px"></i>Open Food Facts · verifica i valori</div>
      <div style=${S.card + ';padding:14px 16px;display:flex;flex-direction:column;gap:14px'}>
        <div style="display:flex;justify-content:space-between;align-items:center"><span style=${S.eyebrow}>Porzione</span>${stepper(portion, () => setPortion(portion - 10), () => setPortion(portion + 10))}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${quick.map(x => html`<button key=${x[0]} onClick=${() => setPortion(x[1])} aria-pressed=${portion === x[1]} style=${`height:36px;padding:0 12px;border-radius:999px;font-size:.8125rem;font-weight:800;border:1px solid var(--c-s3);background:${portion === x[1] ? 'var(--c-acc)' : 'transparent'};color:${portion === x[1] ? 'var(--c-on-acc)' : 'var(--c-fg)'}`}>${x[0]}</button>`)}</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center">
          ${tile(GT.fk(item.k), 'kcal')}${tile(item.p, 'Prot. g')}${tile(item.c, 'Carb. g')}${tile(item.g, 'Grassi g')}
        </div>
      </div>
      <div style=${S.card + ';padding:6px 16px'}>
        <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3)"><span>Valori nutrizionali</span><span>per 100 g</span></div>
        ${table.map(r => html`<div key=${r[0]} class="num" style="display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid var(--c-line);font-size:.875rem"><span style=${`padding-left:${r[3] ? '14px' : '0'};color:${r[3] ? 'var(--c-fg3)' : 'var(--c-fg)'}`}>${r[0]}</span><span style="font-weight:700">${val(r[1], r[2] || 'g')}</span></div>`)}
      </div>
      <div><div style=${S.eyebrow + ';margin-bottom:8px'}>Pasto${d.nutriDate !== d.today ? ' · ' + GT.fmtShort(d.nutriDate) : ''}</div>${chipRow(ui.chip(GT.mealsFor(st.profile), meal, x => GT.set({ prodMeal: x })), 40)}</div>
    </div>`;

    const bar = html`<div key="productBar">${ui.bottomBar(ui.cta(`Aggiungi a ${meal} · ${GT.fk(item.k)} kcal`, add))}</div>`;
    return [main, bar];
  };
})();
