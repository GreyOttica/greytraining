/* GreyTraining — Nutrizione tab (Diario / Piano / Ricette), Scanner, Prodotto and the
   Aggiunta rapida sheet. Ported from design-reference/GreyTraining.dc.html
   (template lines 315-426 and 717-730, renderVals() nutrition block). */
(function () {
  'use strict';
  const GT = window.GT, html = GT.html, S = GT.S, ui = GT.ui, A = GT.act;

  // ---------- Static data from renderVals() ----------
  const ADHERENCE = [['M', 92], ['G', 88], ['V', 95], ['S', 71], ['D', 84], ['L', 90], ['M', null]];
  const PLAN_MEALS = [['Colazione', '600', 'P 40 · C 75 · G 15'], ['Pranzo', '800', 'P 55 · C 100 · G 20'], ['Spuntino', '350', 'P 30 · C 35 · G 10'], ['Cena', '850', 'P 55 · C 90 · G 30']]
    .map(([n, k, m]) => ({ n, k: k + ' kcal', m }));
  const RECIPES = [['Bowl pollo, riso e verdure', 620, 48, '20 min'], ['Overnight oats proteici', 450, 35, '5 min'], ['Salmone, patate e fagiolini', 680, 42, '30 min'], ['Frittata di albumi e spinaci', 310, 38, '10 min']]
    .map(([n, k, p, t]) => ({ n, k, p, t }));
  const NUTRI_TABLE = [['Energia', '54 kcal'], ['Grassi', '0 g'], ['di cui saturi', '0 g', 1], ['Carboidrati', '3,0 g'], ['di cui zuccheri', '3,0 g', 1], ['Fibre', '0 g'], ['Proteine', '10 g'], ['Sale', '0,1 g']]
    .map(([l, v, sub]) => ({ l, v, pad: sub ? '14px' : '0', c: sub ? 'var(--c-fg3)' : 'var(--c-fg)' }));

  // ---------- Local actions (prototype logic not in the core) ----------
  const openQuick = () => GT.set({ overlay: 'quick' });
  const closeOverlay = () => GT.set({ overlay: null });
  const closeNutriView = () => GT.set({ nutriView: null });
  const scanNotFound = () => GT.set({ scanErr: true });
  const toLabelMode = () => GT.set({ scanErr: false, scanMode: 'label' });
  const openQuickFromScan = () => GT.set({ scanErr: false, nutriView: null, overlay: 'quick' });
  const portionDec = () => GT.set(s => ({ portion: Math.max(10, s.portion - 10) }));
  const portionInc = () => GT.set(s => ({ portion: s.portion + 10 }));

  // ---------- Nutrizione tab ----------
  GT.screens.nutri = function (st, d) {
    const isDiario = st.nutriSub === 'diario', isPiano = st.nutriSub === 'piano', isRicette = st.nutriSub === 'ricette';
    const nutriA = GT.v('vNutri') === 'A', nutriB = GT.v('vNutri') === 'B';
    const tot = d.tot, macros = d.macros;

    const nutriSegs = ui.seg([['diario', 'Diario'], ['piano', 'Piano'], ['ricette', 'Ricette']], st.nutriSub, x => GT.set({ nutriSub: x }));

    const waterLine = `${GT.fmtKg(st.water * 0.25)} / 2,0 L`;
    const waterDrops = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
      const f = i < st.water;
      return {
        i, icon: f ? 'ph-fill ph-drop' : 'ph-light ph-drop', bg: f ? 'var(--c-acc-soft)' : 'var(--c-s2)', fg: f ? 'var(--c-acc-t)' : 'var(--c-fg3)',
        go: () => GT.set(s => ({ water: s.water === i + 1 ? i : i + 1 }))
      };
    });

    const meals = GT.MEALS.map(name => {
      const it = st.food[name] || [];
      return {
        name, kcal: it.reduce((a, f) => a + f.k, 0),
        items: it.map(f => Object.assign({}, f, { macro: `P ${f.p} · C ${f.c} · G ${f.g}` })),
        empty: !it.length,
        hint: name === 'Spuntino' ? 'Suggerito: yogurt greco + frutta secca, ~30 g di proteine.' : 'Pianificata: 850 kcal · P 55 g',
        add: () => GT.set({ overlay: 'quick', qaMeal: name })
      };
    });

    const adherence = ADHERENCE.map(([dd, val], i) => ({
      key: i, d: dd, v: val == null ? 'oggi' : val + '%',
      h: val == null ? Math.round(tot.k / GT.TARGET.k * 100) + '%' : val + '%',
      bg: val == null ? 'var(--c-acc)' : val < 80 ? 'var(--c-fg3)' : 'var(--c-sec)'
    }));

    const main = html`<div key="nutri" class="scroll" style="position:absolute;inset:0;overflow-y:auto;padding:calc(var(--top) + 8px) 16px calc(var(--tabH) + 100px);display:flex;flex-direction:column;gap:12px">
      <header style="padding:4px 4px"><div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3)">Martedì 10 novembre</div><h1 style="font-size:2rem;font-weight:900;letter-spacing:-.02em;margin:4px 0 0;line-height:1.05">Nutrizione</h1></header>
      ${ui.Seg(nutriSegs)}
      ${isDiario ? html`
        ${nutriA ? html`
          <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-end"><div><div style="font-size:.75rem;color:var(--c-fg3)">Rimanenti</div><div style="font-size:2.75rem;font-weight:900;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums">${d.kcalLeft}</div></div><div style="text-align:right;font-size:.8125rem;color:var(--c-fg3);font-variant-numeric:tabular-nums;line-height:1.5">Assunte <b style="color:var(--c-fg)">${d.kcalEaten}</b><br />Obiettivo 2.600</div></div>
            <div style="height:8px;border-radius:4px;background:var(--c-s3);overflow:hidden"><div style=${`height:8px;background:var(--c-acc);width:${d.kcalPct}`}></div></div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
              ${macros.map(m => html`<div key=${m.label} style="display:flex;flex-direction:column;gap:6px"><span style="font-size:.75rem;color:var(--c-fg3)">${m.label}</span><span style="font-size:1rem;font-weight:800;font-variant-numeric:tabular-nums">${m.eaten}<span style="color:var(--c-fg3);font-weight:600"> / ${m.target} g</span></span><div style="height:4px;border-radius:2px;background:var(--c-s3);overflow:hidden"><div style=${`height:4px;background:var(--c-acc);width:${m.pct}`}></div></div></div>`)}
            </div>
          </div>` : null}
        ${nutriB ? html`
          <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:16px;display:grid;grid-template-columns:132px 1fr;gap:16px;align-items:center">
            <div style="position:relative;width:132px;height:132px"><svg width="132" height="132" viewBox="0 0 132 132"><circle cx="66" cy="66" r="58" fill="none" style="stroke:var(--c-s3)" stroke-width="10"></circle><circle cx="66" cy="66" r="58" fill="none" style="stroke:var(--c-acc)" stroke-width="10" stroke-linecap="round" stroke-dasharray="364.4" stroke-dashoffset=${d.kcalRingOffset} transform="rotate(-90 66 66)"></circle></svg><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><span style="font-size:1.75rem;font-weight:900;font-variant-numeric:tabular-nums;line-height:1">${d.kcalLeft}</span><span style="font-size:.75rem;color:var(--c-fg3)">kcal rimanenti</span></div></div>
            <div style="display:flex;flex-direction:column;gap:12px">${macros.map(m => html`<div key=${m.label}><div style="display:flex;justify-content:space-between;font-size:.8125rem"><span style="color:var(--c-fg3)">${m.label}</span><b style="font-variant-numeric:tabular-nums">${m.left} g</b></div><div style="height:6px;border-radius:3px;background:var(--c-s3);overflow:hidden;margin-top:5px"><div style=${`height:6px;background:var(--c-acc);width:${m.pct}`}></div></div></div>`)}</div>
          </div>` : null}
        <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between"><span style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3)">Acqua</span><span style="font-size:.875rem;font-weight:800;font-variant-numeric:tabular-nums">${waterLine}</span></div>
          <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:4px">
            ${waterDrops.map(w => html`<button key=${w.i} onClick=${w.go} aria-label="Bicchiere" style=${`height:44px;border-radius:8px;background:${w.bg};display:grid;place-items:center`}><i class=${w.icon} style=${`font-size:20px;color:${w.fg}`}></i></button>`)}
          </div>
        </div>
        ${meals.map(meal => html`
          <div key=${meal.name} style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:6px 16px 6px">
            <div style="display:flex;justify-content:space-between;align-items:center;min-height:48px"><div><span style="font-weight:900;font-size:1rem">${meal.name}</span><span style="font-size:.8125rem;color:var(--c-fg3);margin-left:8px;font-variant-numeric:tabular-nums">${meal.kcal} kcal</span></div><button onClick=${meal.add} aria-label="Aggiungi" style="width:44px;height:44px;margin-right:-10px;display:grid;place-items:center"><i class="ph-light ph-plus-circle" style="font-size:26px"></i></button></div>
            ${meal.items.map((it, i) => html`<div key=${it.n + '-' + i} style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--c-line);font-size:.875rem"><div><div style="font-weight:600">${it.n}</div><div style="color:var(--c-fg3);font-size:.75rem;margin-top:2px;font-variant-numeric:tabular-nums">${it.q} · ${it.macro}</div></div><span style="font-variant-numeric:tabular-nums;color:var(--c-fg2)">${it.k}</span></div>`)}
            ${meal.empty ? html`<div style="padding:6px 0 12px;font-size:.8125rem;color:var(--c-fg3)">${meal.hint}</div>` : null}
          </div>`)}
      ` : null}
      ${isPiano ? html`
        <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:16px"><div style="font-size:1.125rem;font-weight:900">Ricomposizione · 2.600 kcal</div><div style="font-size:.875rem;color:var(--c-fg2);margin-top:4px;font-variant-numeric:tabular-nums">P 180 g (2,3 g/kg) · C 300 g · G 75 g</div>
          <div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3);margin:18px 0 10px">Aderenza ultimi 7 giorni</div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;align-items:end;height:96px">
            ${adherence.map(a => html`<div key=${a.key} style="display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end"><span style="font-size:.6875rem;color:var(--c-fg3);font-variant-numeric:tabular-nums">${a.v}</span><div style=${`width:100%;border-radius:4px;background:${a.bg};height:${a.h}`}></div><span style="font-size:.6875rem;font-weight:700;color:var(--c-fg3)">${a.d}</span></div>`)}
          </div></div>
        ${PLAN_MEALS.map(p => html`<div key=${p.n} style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px"><div><div style="font-weight:800">${p.n}</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:2px;font-variant-numeric:tabular-nums">${p.m}</div></div><span style="font-weight:900;font-variant-numeric:tabular-nums">${p.k}</span></div>`)}
      ` : null}
      ${isRicette ? html`
        <div style="flex:none;display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${RECIPES.map(r => html`<div key=${r.n} style="flex:none;background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;overflow:hidden"><div style="aspect-ratio:4/3;background:var(--c-s2);display:grid;place-items:center"><i class="ph-light ph-image" style="font-size:26px;color:var(--c-fg3)"></i></div><div style="padding:10px 12px 12px"><div style="font-weight:800;font-size:.875rem;line-height:1.3">${r.n}</div><div style="font-size:.75rem;color:var(--c-fg3);margin-top:4px;font-variant-numeric:tabular-nums">${r.k} kcal · P ${r.p} g · ${r.t}</div></div></div>`)}
        </div>
      ` : null}
    </div>`;

    const bar = isDiario ? html`<div key="nutriBar" style="position:absolute;left:0;right:0;bottom:var(--tabH);padding:10px 16px;background:var(--c-bg);border-top:1px solid var(--c-line);display:grid;grid-template-columns:1.4fr 1fr;gap:8px;z-index:25">
      <button onClick=${A.openScanner} style="height:56px;border-radius:12px;background:var(--c-acc);color:var(--c-on-acc);font-weight:900;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-bold ph-barcode" style="font-size:22px"></i>Scansiona</button>
      <button onClick=${openQuick} style="height:56px;border-radius:12px;background:var(--c-s2);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-light ph-lightning" style="font-size:20px"></i>Rapida</button>
    </div>` : null;

    return [main, bar];
  };

  // ---------- Scanner (full screen, always dark) ----------
  GT.screens.scanner = function (st) {
    const scanIsLabel = st.scanMode === 'label';
    const scanSegs = ui.seg([['barcode', 'Barcode'], ['label', 'Foto etichetta']], st.scanMode, x => GT.set({ scanMode: x, scanErr: false }))
      .map(o => Object.assign({}, o, { bg: o.bg === 'transparent' ? 'transparent' : '#FFFBF9', fg: o.bg === 'transparent' ? '#BCBEC0' : '#000' }));
    const scanTitle = scanIsLabel ? 'Foto etichetta' : 'Scansiona barcode';
    const scanW = scanIsLabel ? '280px' : '270px', scanH = scanIsLabel ? '360px' : '150px';
    const scanHint = scanIsLabel ? 'Inquadra la tabella nutrizionale per intero, senza riflessi.' : 'Allinea il codice a barre nel riquadro. La lettura è automatica.';
    const scanIcon = scanIsLabel ? 'ph-bold ph-camera' : 'ph-bold ph-barcode';
    const scanning = !st.scanLoading && !st.scanErr;

    return html`<div key="scanner" style="position:absolute;inset:0;z-index:20;background:#0A0A0A;color:#FFFBF9;display:flex;flex-direction:column;padding-top:var(--top)">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 12px"><button onClick=${closeNutriView} aria-label="Chiudi" style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.12);display:grid;place-items:center"><i class="ph-light ph-x" style="font-size:22px"></i></button><span style="font-weight:800">${scanTitle}</span><button aria-label="Flash" style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.12);display:grid;place-items:center"><i class="ph-light ph-lightning" style="font-size:22px"></i></button></div>
      <div style="flex:1;position:relative;display:grid;place-items:center">
        <div style="position:absolute;top:16px;left:0;right:0;text-align:center;font-size:.8125rem;color:#A7A9AC">Anteprima fotocamera</div>
        <div style=${`position:relative;width:${scanW};height:${scanH};border-radius:16px;border:2px solid rgba(255,251,249,.9);box-shadow:0 0 0 2000px rgba(0,0,0,.35)`}>
          ${scanning ? html`<div style="position:absolute;left:10px;right:10px;height:2px;background:#E95145;animation:gtScan 2.4s ease-in-out infinite"></div>` : null}
          ${st.scanLoading ? html`<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(0,0,0,.6);border-radius:14px"><span style="width:32px;height:32px;border-radius:50%;border:3px solid rgba(255,255,255,.25);border-top-color:#FFFBF9;animation:gtSpin .8s linear infinite"></span><span style="font-size:.875rem;font-weight:700">Lettura etichetta…</span></div>` : null}
        </div>
        <div style="position:absolute;bottom:20px;left:24px;right:24px;text-align:center;font-size:.9375rem;line-height:1.4;color:#E6E7E8">${scanHint}</div>
      </div>
      <div style="padding:16px 16px calc(var(--pb) + 6px);display:flex;flex-direction:column;gap:16px;align-items:center;background:#0A0A0A">
        <div style="display:flex;gap:4px;padding:4px;background:#1F1F1F;border-radius:12px;width:100%">
          ${scanSegs.map(s => html`<button key=${s.value} onClick=${s.go} aria-pressed=${s.active} style=${`flex:1;height:40px;border-radius:9px;font-weight:800;font-size:.875rem;background:${s.bg};color:${s.fg}`}>${s.label}</button>`)}
        </div>
        <button onClick=${A.doScan} aria-label="Scatta" style="width:76px;height:76px;border-radius:50%;border:4px solid #FFFBF9;display:grid;place-items:center"><span style="width:60px;height:60px;border-radius:50%;background:#FFFBF9;display:grid;place-items:center;color:#000"><i class=${scanIcon} style="font-size:26px"></i></span></button>
        <button onClick=${scanNotFound} style="font-size:.8125rem;color:#A7A9AC;text-decoration:underline;height:32px">Simula prodotto non trovato</button>
      </div>
      ${st.scanErr ? html`
        <div role="dialog" aria-modal="true" style="position:absolute;left:0;right:0;bottom:0;z-index:5;background:var(--c-s1);color:var(--c-fg);border-radius:24px 24px 0 0;padding:24px 20px calc(var(--pb) + 6px);display:flex;flex-direction:column;gap:12px;animation:gtSheet .28s cubic-bezier(.2,0,0,1)">
          <i class="ph-light ph-warning-circle" style="font-size:32px"></i>
          <div style="font-size:1.25rem;font-weight:900">Prodotto non trovato</div>
          <div style="font-size:.9375rem;color:var(--c-fg2);line-height:1.45">Il codice 8 001505 310427 non è nel database. Fotografa la tabella nutrizionale o inserisci i valori a mano.</div>
          <button onClick=${toLabelMode} style="height:56px;border-radius:12px;background:var(--c-acc);color:var(--c-on-acc);font-weight:900;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-bold ph-camera" style="font-size:20px"></i>Foto etichetta</button>
          <button onClick=${openQuickFromScan} style="height:52px;border-radius:12px;background:var(--c-s2);font-weight:800">Inserisci a mano</button>
        </div>` : null}
    </div>`;
  };

  // ---------- Prodotto (full screen, fixed CTA bar) ----------
  GT.screens.product = function (st) {
    const isLabel = st.prodSrc === 'label';
    const prodSrc = isLabel ? 'Letto dalla foto etichetta · verifica i valori prima di salvare' : 'Da barcode · database prodotti';
    const prodSrcIcon = isLabel ? 'ph-light ph-camera' : 'ph-light ph-barcode';
    const prodItem = A.productItem(st);
    const prodMacros = [{ v: prodItem.k, l: 'kcal' }, { v: prodItem.p, l: 'Prot. g' }, { v: prodItem.c, l: 'Carb. g' }, { v: prodItem.g, l: 'Grassi g' }];
    const prodMealChips = ui.chip(GT.MEALS, st.prodMeal, x => GT.set({ prodMeal: x }));

    const main = html`<div key="product" class="scroll" style="position:absolute;inset:0;z-index:20;background:var(--c-bg);overflow-y:auto;padding:var(--top) 16px calc(var(--pb) + 86px);display:flex;flex-direction:column;gap:14px">
      ${ui.back('Scanner', A.openScanner)}
      <div style="display:grid;grid-template-columns:72px 1fr;gap:14px;align-items:center"><div style="width:72px;height:72px;border-radius:12px;background:var(--c-s2);display:grid;place-items:center"><i class="ph-light ph-image" style="font-size:24px;color:var(--c-fg3)"></i></div><div><div style="font-size:1.375rem;font-weight:900;letter-spacing:-.01em;line-height:1.15">${GT.PRODUCT.n}</div><div style="font-size:.8125rem;color:var(--c-fg3);margin-top:3px">${GT.PRODUCT.brand}</div></div></div>
      <div style="display:flex;gap:8px;align-items:center;font-size:.75rem;font-weight:700;padding:8px 12px;border-radius:8px;background:var(--c-s2);color:var(--c-fg2)"><i class=${prodSrcIcon} style="font-size:16px"></i>${prodSrc}</div>
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3)">Porzione</span>
          <div style="display:flex;align-items:center;gap:4px;background:var(--c-s2);border-radius:12px"><button onClick=${portionDec} aria-label="Meno" style="width:48px;height:48px;display:grid;place-items:center"><i class="ph-light ph-minus" style="font-size:20px"></i></button><span style="min-width:72px;text-align:center;font-size:1.25rem;font-weight:900;font-variant-numeric:tabular-nums">${st.portion} g</span><button onClick=${portionInc} aria-label="Più" style="width:48px;height:48px;display:grid;place-items:center"><i class="ph-light ph-plus" style="font-size:20px"></i></button></div></div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center">
          ${prodMacros.map(m => html`<div key=${m.l} style="padding:10px 4px;border-radius:10px;background:var(--c-s2)"><div style="font-size:1.25rem;font-weight:900;font-variant-numeric:tabular-nums">${m.v}</div><div style="font-size:.6875rem;color:var(--c-fg3)">${m.l}</div></div>`)}
        </div>
      </div>
      <div style="background:var(--c-s1);border:1px solid var(--c-line);border-radius:12px;padding:6px 16px">
        <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3)"><span>Valori nutrizionali</span><span>per 100 g</span></div>
        ${NUTRI_TABLE.map(r => html`<div key=${r.l} style="display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid var(--c-line);font-size:.875rem;font-variant-numeric:tabular-nums"><span style=${`padding-left:${r.pad};color:${r.c}`}>${r.l}</span><span style="font-weight:700">${r.v}</span></div>`)}
      </div>
      <div><div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3);margin-bottom:8px">Pasto</div><div style="display:flex;gap:6px;flex-wrap:wrap">${prodMealChips.map(c => html`<button key=${c.label} onClick=${c.go} aria-pressed=${c.active} style=${`height:40px;padding:0 14px;border-radius:999px;font-size:.8125rem;font-weight:800;background:${c.bg};color:${c.fg};border:1px solid var(--c-s3)`}>${c.label}</button>`)}</div></div>
    </div>`;

    const bar = html`<div key="productBar" style="position:absolute;left:0;right:0;bottom:0;z-index:21;padding:12px 16px var(--pb);background:var(--c-bg);border-top:1px solid var(--c-line)"><button onClick=${A.addProduct} style="height:60px;width:100%;border-radius:12px;background:var(--c-acc);color:var(--c-on-acc);font-size:1.0625rem;font-weight:900">Aggiungi a ${st.prodMeal} · ${prodItem.k} kcal</button></div>`;

    return [main, bar];
  };

  // ---------- Aggiunta rapida (bottom sheet, overlay === 'quick') ----------
  GT.screens.quickAdd = function (st) {
    const qaMealChips = ui.chip(GT.MEALS, st.qaMeal, x => GT.set({ qaMeal: x }));
    const recents = GT.RECENTS.map(f => Object.assign({}, f, { add: () => A.addFood(GT.state.qaMeal, f) }));

    return ui.sheet(closeOverlay, html`
      <div style="display:flex;justify-content:space-between;align-items:baseline"><div style="font-size:1.25rem;font-weight:900">Aggiunta rapida</div><span style="font-size:.875rem;color:var(--c-fg3)">a ${st.qaMeal}</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${qaMealChips.map(c => html`<button key=${c.label} onClick=${c.go} aria-pressed=${c.active} style=${`height:36px;padding:0 12px;border-radius:999px;font-size:.8125rem;font-weight:800;background:${c.bg};color:${c.fg};border:1px solid var(--c-s3)`}>${c.label}</button>`)}</div>
      <div style="font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-fg3);margin-top:4px">Recenti</div>
      <div style="display:flex;flex-direction:column">
        ${recents.map(r => html`<div key=${r.n} style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--c-line)"><div><div style="font-weight:700;font-size:.9375rem">${r.n}</div><div style="font-size:.75rem;color:var(--c-fg3);font-variant-numeric:tabular-nums">${r.q} · ${r.k} kcal · P ${r.p}</div></div><button onClick=${r.add} aria-label="Aggiungi" style="width:48px;height:48px;display:grid;place-items:center;margin-right:-8px"><i class="ph-light ph-plus-circle" style="font-size:28px"></i></button></div>`)}
      </div>
      <button onClick=${A.openScanner} style="height:52px;border-radius:12px;background:var(--c-s2);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-light ph-barcode" style="font-size:20px"></i>Scansiona o fotografa etichetta</button>
    `, { gap: 12 });
  };
})();
