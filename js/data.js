/* GreyTraining — seed data and pure helpers.
   Ported 1:1 from the mock constants in design-reference/GreyTraining.dc.html.
   Classic script: everything hangs off window.GT so the app also runs from file://. */
(function () {
  'use strict';
  var GT = (window.GT = window.GT || {});

  // ---------- Workout of the day (Upper A) ----------
  // last: [[kg, reps, rpe], ...] from the previous session (3 nov); sug: coach suggestion [kg, reps]
  GT.EX = [
    { id: 'bench', name: 'Panca piana bilanciere', muscle: 'Petto', sets: 3, reps: '6–8', eff: 8, rest: 150, last: [[80, 8, 7], [80, 8, 8], [80, 7, 9]], sug: [82.5, 8], eq: 'Bilanciere' },
    { id: 'row', name: 'Rematore bilanciere', muscle: 'Dorso', sets: 3, reps: '8–10', eff: 8, rest: 120, last: [[70, 10, 7], [70, 9, 8], [70, 9, 8]], sug: [72.5, 9], eq: 'Bilanciere' },
    { id: 'ohp', name: 'Military press', muscle: 'Spalle', sets: 3, reps: '6–8', eff: 8, rest: 120, last: [[47.5, 8, 8], [47.5, 7, 8], [47.5, 6, 9]], sug: [47.5, 8], eq: 'Bilanciere' },
    { id: 'pull', name: 'Trazioni zavorrate', muscle: 'Dorso', sets: 3, reps: '6–8', eff: 8, rest: 120, last: [[10, 7, 8], [10, 6, 9], [10, 6, 9]], sug: [10, 8], eq: 'Corpo libero' },
    { id: 'incl', name: 'Spinte inclinata manubri', muscle: 'Petto', sets: 3, reps: '10–12', eff: 8, rest: 90, last: [[30, 11, 8], [30, 10, 8], [30, 10, 9]], sug: [30, 12], eq: 'Manubri' },
    { id: 'curl', name: 'Curl manubri', muscle: 'Bicipiti', sets: 3, reps: '10–12', eff: 9, rest: 60, last: [[14, 12, 8], [14, 11, 9], [14, 10, 9]], sug: [16, 10], eq: 'Manubri' }
  ];

  // ---------- Exercise library ----------
  GT.LIB = [
    ['bench', 'Panca piana bilanciere', 'Petto', 'Bilanciere'], ['incl', 'Spinte inclinata manubri', 'Petto', 'Manubri'], ['cross', 'Croci ai cavi', 'Petto', 'Cavi'],
    ['row', 'Rematore bilanciere', 'Dorso', 'Bilanciere'], ['pull', 'Trazioni zavorrate', 'Dorso', 'Corpo libero'], ['latm', 'Lat machine presa larga', 'Dorso', 'Macchina'],
    ['ohp', 'Military press', 'Spalle', 'Bilanciere'], ['lr', 'Alzate laterali ai cavi', 'Spalle', 'Cavi'], ['squat', 'Squat bilanciere', 'Gambe', 'Bilanciere'],
    ['rdl', 'Stacco rumeno', 'Gambe', 'Bilanciere'], ['curl', 'Curl manubri', 'Braccia', 'Manubri'], ['pd', 'Push-down ai cavi', 'Braccia', 'Cavi']
  ].map(function (a) { return { id: a[0], n: a[1], m: a[2], eq: a[3] }; });

  GT.CUES = {
    bench: ['Scapole addotte e depresse, arco toracico stabile.', 'Bilanciere sul basso sterno, avambracci verticali.', 'Spingi i piedi a terra; risalita in linea leggermente obliqua verso le spalle.'],
    _: ['Imposta la posizione prima di staccare il carico.', 'Controlla la fase eccentrica, 2–3 secondi.', 'Interrompi la serie quando la tecnica cambia.']
  };

  // ---------- Body & strength series ----------
  GT.W12 = [80.6, 80.4, 80.1, 80.2, 79.8, 79.5, 79.4, 79.0, 78.9, 78.7, 78.6, 78.4];
  GT.W6M = [82.1, 81.9, 82.0, 81.6, 81.5, 81.6, 81.2, 81.0, 81.1, 80.8, 80.9, 80.6, 80.7, 80.6, 80.4, 80.1, 80.2, 79.8, 79.5, 79.4, 79.0, 78.9, 78.7, 78.6, 78.4, 78.4];
  GT.STR = { Panca: [96, 97.5, 98, 99.5, 100, 101.3, 101.3, 104.5], Squat: [120, 122, 124, 124, 126, 128, 129, 131], Stacco: [150, 152, 155, 155, 158, 160, 162, 165], Military: [57, 58, 58, 59, 60, 60, 60.2, 61] };

  // ---------- Cardio sessions (run + swim) ----------
  // blocks: [name, description/pace, value, intensity 1–5, duration weight]
  GT.CARDIO = {
    rip: { kind: 'corsa', name: 'Ripetute 6 × 800 m', day: 'Mer 11', tag: 'Qualità', km: 9.2, min: 52, rpe: '8', blocks: [['Riscaldamento', 'Z2 · 5:50/km', '15 min', 2, 15], ['Allunghi', '4 × 20 s progressivi', '2 min', 3, 2], ['6 × 800 m', '4:25–4:35/km · rec. 2 min trotto', '24 min', 5, 24], ['Defaticamento', 'Z1 · oltre 6:15/km', '10 min', 1, 10]], note: 'Lower A è giovedì: arrivi alle ripetute con le gambe fresche. Se la readiness è sotto 55, passa a 5 × 800 m.' },
    lungo: { kind: 'corsa', name: 'Lungo 14 km', day: 'Dom 15', tag: 'Aerobico', km: 14, min: 82, rpe: '5–6', blocks: [['Riscaldamento', 'Z1 · 6:15/km', '2 km', 1, 12], ['Fondo', 'Z2 · 5:45–6:00/km', '10 km', 2, 58], ['Finale progressivo', 'Z3 · 5:15/km', '2 km', 3, 11]], note: 'Arriva dopo il Lower B: tieni il fondo in Z2 anche se ti senti bene. Lunedì piscina defaticante.' },
    facile: { kind: 'corsa', name: 'Corsa facile 6 km', day: 'Libreria', tag: 'Recupero', km: 6, min: 36, rpe: '3–4', blocks: [['Corsa continua', 'Z1–Z2 · 5:55–6:20/km', '6 km', 2, 36]], note: 'Ritmo in cui riesci a parlare. Utile il giorno dopo la palestra gambe.' },
    prog: { kind: 'corsa', name: 'Progressivo 8 km', day: 'Libreria', tag: 'Aerobico', km: 8, min: 44, rpe: '6–7', blocks: [['Primi 3 km', 'Z2 · 5:50/km', '3 km', 2, 18], ['Km 4–6', 'Z3 · 5:20/km', '3 km', 3, 16], ['Ultimi 2 km', 'Z4 · 4:50/km', '2 km', 4, 10]], note: 'Ogni blocco 20–30 s/km più veloce del precedente. Mai il giorno prima delle ripetute.' },
    soglia: { kind: 'corsa', name: 'Soglia 3 × 10 min', day: 'Libreria', tag: 'Qualità', km: 10, min: 55, rpe: '7–8', blocks: [['Riscaldamento', 'Z2', '15 min', 2, 15], ['3 × 10 min', 'Z4 · 4:40–4:50/km · rec. 2 min', '34 min', 4, 34], ['Defaticamento', 'Z1', '8 min', 1, 8]], note: 'Ritmo "comodamente duro": frasi brevi, non conversazione.' },
    fartlek: { kind: 'corsa', name: 'Fartlek 10 × 1 min', day: 'Libreria', tag: 'Qualità', km: 8, min: 42, rpe: '7', blocks: [['Riscaldamento', 'Z2', '12 min', 2, 12], ['10 × 1 min veloce', 'Z4–Z5 · rec. 1 min facile', '20 min', 5, 20], ['Defaticamento', 'Z1', '10 min', 1, 10]], note: 'Variazioni libere a sensazione, senza guardare il passo.' },
    nuoto1: { kind: 'piscina', name: 'Defaticante 1.500 m', day: 'Lun 9', tag: 'Defaticamento', m: 1500, min: 35, rpe: '3–4', blocks: [['Riscaldamento', 'misti, molto facile', '300 m', 1, 6], ['4 × 100 m dorso', 'rec. 20 s · allunga la schiena', '400 m', 2, 9], ['4 × 50 m gambe', 'con tavoletta · rec. 15 s', '200 m', 2, 6], ['6 × 50 m stile', 'facile · respiro ogni 3', '300 m', 2, 8], ['Defaticamento', 'dorso e rana', '300 m', 1, 6]], note: 'Dopo il lungo: nuoto aerobico leggero, niente virate rapide né farfalla. Lo scopo è recuperare, non allenare.' },
    nuoto2: { kind: 'piscina', name: 'Recupero attivo 1.000 m', day: 'Lun 16', tag: 'Dopo il lungo', m: 1000, min: 25, rpe: '3', blocks: [['Stile facile', 'respiro ogni 3', '400 m', 2, 10], ['Dorso', 'scioltezza spalle', '300 m', 1, 8], ['Rana lenta', 'ampiezza, non velocità', '300 m', 1, 7]], note: 'Se la spalla sinistra dà fastidio, sostituisci lo stile con dorso e gambe.' },
    nuoto3: { kind: 'piscina', name: 'Mobilità in acqua 30 min', day: 'Libreria', tag: 'Mobilità', m: 600, min: 30, rpe: '2', blocks: [['Camminata in acqua', 'corsia bassa', '5 min', 1, 5], ['Mobilità anche e spalle', 'a bordo vasca', '15 min', 1, 15], ['Nuoto libero', 'qualsiasi stile, lento', '10 min', 1, 10]], note: 'Per le giornate con indolenzimento alto: zero carico, solo movimento.' }
  };

  // Week plan (Settimana 3 · 9–15 nov): [day letter, date, discipline, cardio id | null]
  GT.WEEK = [['L', 9, 'piscina', 'nuoto1'], ['M', 10, 'palestra', null], ['M', 11, 'corsa', 'rip'], ['G', 12, 'palestra', null], ['V', 13, 'palestra', null], ['S', 14, 'palestra', null], ['D', 15, 'corsa', 'lungo']];
  GT.TODAY_IDX = 1; // Tuesday 10 Nov is "today" in the seed data

  // ---------- Nutrition ----------
  GT.TARGET = { k: 2600, p: 180, c: 300, g: 75 };
  GT.MEALS = ['Colazione', 'Pranzo', 'Spuntino', 'Cena'];
  GT.RECENTS = [
    { n: 'Yogurt greco 0%', q: '170 g', k: 92, p: 17, c: 5, g: 0 }, { n: 'Whey isolate', q: '30 g', k: 112, p: 26, c: 1, g: 0 },
    { n: 'Mandorle', q: '30 g', k: 174, p: 6, c: 3, g: 15 }, { n: 'Pane integrale', q: '60 g', k: 150, p: 6, c: 27, g: 2 }, { n: 'Mela', q: '180 g', k: 94, p: 0, c: 25, g: 0 }
  ];
  GT.FOOD_SEED = {
    Colazione: [{ n: "Fiocchi d'avena", q: '80 g', k: 300, p: 11, c: 51, g: 6 }, { n: 'Latte parz. scremato', q: '250 ml', k: 115, p: 8, c: 12, g: 4 }, { n: 'Banana', q: '120 g', k: 107, p: 1, c: 27, g: 0 }],
    Pranzo: [{ n: 'Riso basmati', q: '100 g crudo', k: 350, p: 8, c: 78, g: 1 }, { n: 'Petto di pollo', q: '180 g', k: 198, p: 41, c: 0, g: 3 }, { n: 'Zucchine', q: '200 g', k: 34, p: 2, c: 6, g: 0 }, { n: 'Olio EVO', q: '10 g', k: 90, p: 0, c: 0, g: 10 }],
    Spuntino: [], Cena: []
  };
  // Scanned product (mock) — values per 100 g
  GT.PRODUCT = { n: 'Yogurt greco 0%', brand: 'Total · vasetto 170 g · 5 201054 017616', per100: { k: 54, p: 10, c: 3, g: 0 } };

  // ---------- Coach ----------
  GT.ACTIONS = [
    { id: 'load', icon: 'ph-light ph-trend-up', title: 'Aumenta il carico', body: 'Panca piana +2,5 kg (82,5 kg). 3 × 8 chiusi a RPE 7–8 per due sessioni consecutive.', cta: 'Applica', doneLabel: 'Applicato a Upper A' },
    { id: 'vol', icon: 'ph-light ph-stack', title: 'Più volume ai femorali', body: '6 serie/settimana, sotto il minimo efficace (8). +2 serie di stacco rumeno nel Lower B.', cta: 'Aggiungi', doneLabel: 'Aggiunto a Lower B' },
    { id: 'deload', icon: 'ph-light ph-battery-medium', title: 'Scarico in settimana 5', body: 'Volume −40%, RPE 6, stessi esercizi. Dopo 4 settimane di accumulo consolida la prestazione.', cta: 'Pianifica', doneLabel: 'Scarico pianificato · 24 nov' },
    { id: 'prot', icon: 'ph-light ph-egg', title: 'Proteine sotto target', body: '3 giorni su 7 sotto 180 g (media 152 g). Aggiungi uno spuntino serale da 30 g.', cta: 'Aggiorna piano', doneLabel: 'Spuntino aggiunto al piano' }
  ];
  GT.CHAT_SEED = [{ who: 'c', t: 'Settimana 3 chiusa: 4/4 sessioni. Panca e rematore in progressione lineare. Femorali a 6 serie, sotto il minimo efficace di 8: propongo 2 serie di stacco rumeno nel Lower B.' }];

  // ---------- Theme options (Profilo → Colori) ----------
  GT.TONES = { nero: ['#000', '#121212', '#1F1F1F', '#2B2B2B', '#2A2A2A'], grafite: ['#0F1012', '#1A1B1E', '#26272B', '#323338', '#2E2F33'], caldo: ['#0D0B0A', '#191614', '#24201D', '#302B27', '#2C2724'] };
  GT.PRIMARY_OPTS = [['#E95145', 'Arancio'], ['#F5A000', 'Ambra'], ['#EE312F', 'Rosso'], ['#6BA772', 'Verde'], ['#5C8DB8', 'Blu']];
  GT.SECONDARY_OPTS = [['#FFFBF9', 'Bianco'], ['#A7A9AC', 'Argento'], ['#90734E', 'Oro'], ['#ACD8AA', 'Verde chiaro'], ['#8EC5E2', 'Azzurro']];

  // ---------- Pure helpers ----------
  // Best estimated 1RM (Epley) of the previous session for an exercise
  GT.best = function (ex) { return Math.max.apply(null, ex.last.map(function (l) { return l[0] * (1 + l[1] / 30); })); };
  GT.epley = function (w, r) { return w * (1 + r / 30); };
  // Italian decimal: 82.5 -> "82,5"
  GT.fmt = function (n) { return (Math.round(n * 10) / 10).toString().replace('.', ','); };
  // Italian thousands: 2600 -> "2.600"
  // (toLocaleString('it-IT') leaves 4-digit numbers ungrouped — "1194" — so group by hand)
  GT.fk = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  // Weights keep up to two decimals so 1,25 kg steps are not rounded away: 83.75 -> "83,75"
  GT.fmtKg = function (n) { return (Math.round(n * 100) / 100).toString().replace('.', ','); };
  GT.mmss = function (s) { return Math.floor(s / 60) + ':' + String(Math.max(0, s) % 60).padStart(2, '0'); };
  GT.INT_H = { 1: '28%', 2: '45%', 3: '65%', 4: '82%', 5: '100%' };
  // Intensity profile bars for a cardio session
  GT.profileOf = function (c) {
    return c.blocks.map(function (b) {
      return { f: b[4], h: GT.INT_H[b[3]], bg: b[3] >= 4 ? 'var(--c-acc)' : b[3] === 3 ? 'var(--c-sec)' : 'var(--c-fg3)' };
    });
  };
  // SVG line chart path for a series inside a W×H box
  GT.chart = function (arr, W, H) {
    var mn = Math.min.apply(null, arr), mx = Math.max.apply(null, arr), pad = (mx - mn) * 0.18 || 1, lo = mn - pad, hi = mx + pad;
    var pts = arr.map(function (v, i) { return [i * (W / (arr.length - 1)), H - (v - lo) / (hi - lo) * H]; });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    return { line: line, area: line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z', lx: pts[pts.length - 1][0], ly: pts[pts.length - 1][1] };
  };
})();
