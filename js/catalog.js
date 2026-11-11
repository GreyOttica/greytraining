/* GreyTraining — exercise library.
   Used by the plan generator (js/plan.js), the library tab, swaps and weekly volume.

   Each exercise: { id, n (name), m (primary muscle group), mg (sets credited per muscle group
   for weekly volume), req (equipment ALL required; [] = bodyweight), pat (movement pattern),
   comp (compound), lvl (1 beginner … 3 advanced), avoid (limitation tags it stresses),
   cues (technique points) }. */
(function () {
  'use strict';
  var GT = (window.GT = window.GT || {});

  // Muscle groups for weekly volume, with an effective range (sets/week): MEV → MRV
  GT.MUSCLES = [
    { k: 'petto', n: 'Petto', mev: 10, mrv: 20 },
    { k: 'dorso', n: 'Dorso', mev: 10, mrv: 20 },
    { k: 'spalle', n: 'Spalle', mev: 8, mrv: 18 },
    { k: 'quadricipiti', n: 'Quadricipiti', mev: 8, mrv: 16 },
    { k: 'femorali', n: 'Femorali', mev: 6, mrv: 16 },
    { k: 'glutei', n: 'Glutei', mev: 6, mrv: 16 },
    { k: 'bicipiti', n: 'Bicipiti', mev: 6, mrv: 14 },
    { k: 'tricipiti', n: 'Tricipiti', mev: 6, mrv: 14 },
    { k: 'polpacci', n: 'Polpacci', mev: 4, mrv: 12 },
    // Core work comes mostly from the big lifts: no minimum, only a ceiling
    { k: 'addome', n: 'Addome', mev: 0, mrv: 16 }
  ];
  GT.MUSCLE_NAME = {};
  GT.MUSCLES.forEach(function (m) { GT.MUSCLE_NAME[m.k] = m.n; });

  // Equipment a user can tick in onboarding / profile ("Corpo libero" is always available)
  GT.EQUIPMENT = ['Bilanciere', 'Rack', 'Panca', 'Manubri', 'Kettlebell', 'Cavi', 'Macchine', 'Sbarra', 'Elastici'];
  // Limitation areas the user can pick; exercises with the same tag are left out of the plan
  GT.LIMITS = [
    { k: 'spalla', n: 'Spalla' }, { k: 'gomito', n: 'Gomito' }, { k: 'polso', n: 'Polso' },
    { k: 'schiena', n: 'Zona lombare' }, { k: 'collo', n: 'Collo' }, { k: 'anca', n: 'Anca' },
    { k: 'ginocchio', n: 'Ginocchio' }, { k: 'caviglia', n: 'Caviglia' }
  ];

  var C = {
    bench: ['Scapole addotte e depresse, arco toracico stabile.', 'Bilanciere sul basso sterno, avambracci verticali.', 'Spingi i piedi a terra; risalita leggermente obliqua verso le spalle.'],
    squat: ['Piedi alla larghezza delle spalle, punte un po\' aperte.', 'Inspira e blocca il tronco prima di scendere.', 'Ginocchia in linea con le punte, scendi finché mantieni la schiena neutra.'],
    hinge: ['Spingi il bacino indietro, ginocchia appena flesse.', 'Carico vicino alle gambe, schiena neutra.', 'Risali stringendo i glutei, senza iperestendere la schiena.'],
    row: ['Busto stabile, collo in linea con la schiena.', 'Tira portando i gomiti verso i fianchi.', 'Controlla la discesa, senza slanci.'],
    vpull: ['Petto in fuori, spalle lontane dalle orecchie.', 'Tira portando i gomiti verso le costole.', 'Distendi le braccia completamente senza perdere tensione.'],
    vpush: ['Glutei e addome contratti, nessun arco lombare.', 'Spingi in verticale, testa che passa sotto il carico.', 'Scendi fino al mento con controllo.'],
    lunge: ['Busto alto, passo abbastanza lungo.', 'Ginocchio anteriore in linea con il piede.', 'Spingi sul tallone della gamba avanti.'],
    iso: ['Movimento controllato, 2–3 secondi in discesa.', 'Nessuno slancio con il busto.', 'Fermati quando la tecnica cambia.']
  };

  // [id, name, muscle, {volume}, [equipment], pattern, compound, level, [avoid], cues]
  var RAW = [
    // Horizontal push
    ['bench', 'Panca piana bilanciere', 'petto', { petto: 1, tricipiti: 0.5, spalle: 0.3 }, ['Bilanciere', 'Panca'], 'oriz-spinta', 1, 1, ['spalla'], C.bench],
    ['dbbench', 'Panca piana manubri', 'petto', { petto: 1, tricipiti: 0.5, spalle: 0.3 }, ['Manubri', 'Panca'], 'oriz-spinta', 1, 1, [], C.bench],
    ['chestpress', 'Chest press macchina', 'petto', { petto: 1, tricipiti: 0.5 }, ['Macchine'], 'oriz-spinta', 1, 1, [], C.iso],
    ['pushup', 'Piegamenti', 'petto', { petto: 1, tricipiti: 0.5, addome: 0.2 }, [], 'oriz-spinta', 1, 1, ['polso'], ['Corpo in linea dalla testa ai talloni.', 'Mani sotto le spalle, gomiti a 45°.', 'Petto vicino a terra, poi spingi.']],
    // Incline push
    ['incl', 'Spinte inclinata manubri', 'petto', { petto: 1, spalle: 0.5, tricipiti: 0.3 }, ['Manubri', 'Panca'], 'incl-spinta', 1, 1, [], C.bench],
    ['inclbb', 'Panca inclinata bilanciere', 'petto', { petto: 1, spalle: 0.5, tricipiti: 0.3 }, ['Bilanciere', 'Panca'], 'incl-spinta', 1, 2, ['spalla'], C.bench],
    ['inclmach', 'Chest press inclinata macchina', 'petto', { petto: 1, spalle: 0.5 }, ['Macchine'], 'incl-spinta', 1, 1, [], C.iso],
    ['declpush', 'Piegamenti piedi rialzati', 'petto', { petto: 1, spalle: 0.5, tricipiti: 0.3 }, [], 'incl-spinta', 1, 2, ['polso', 'spalla'], C.iso],
    // Horizontal pull
    ['row', 'Rematore bilanciere', 'dorso', { dorso: 1, bicipiti: 0.5 }, ['Bilanciere'], 'oriz-tirata', 1, 2, ['schiena'], C.row],
    ['dbrow', 'Rematore manubrio', 'dorso', { dorso: 1, bicipiti: 0.5 }, ['Manubri', 'Panca'], 'oriz-tirata', 1, 1, [], C.row],
    ['cablerow', 'Pulley basso ai cavi', 'dorso', { dorso: 1, bicipiti: 0.5 }, ['Cavi'], 'oriz-tirata', 1, 1, [], C.row],
    ['machrow', 'Rematore alla macchina', 'dorso', { dorso: 1, bicipiti: 0.5 }, ['Macchine'], 'oriz-tirata', 1, 1, [], C.row],
    ['invrow', 'Rematore inverso', 'dorso', { dorso: 1, bicipiti: 0.5 }, ['Rack'], 'oriz-tirata', 1, 1, [], C.row],
    ['bandrow', 'Rematore con elastico', 'dorso', { dorso: 1, bicipiti: 0.5 }, ['Elastici'], 'oriz-tirata', 1, 1, [], C.row],
    // Vertical push
    ['ohp', 'Military press', 'spalle', { spalle: 1, tricipiti: 0.5 }, ['Bilanciere', 'Rack'], 'vert-spinta', 1, 2, ['spalla', 'schiena'], C.vpush],
    ['dbohp', 'Lento manubri seduto', 'spalle', { spalle: 1, tricipiti: 0.5 }, ['Manubri', 'Panca'], 'vert-spinta', 1, 1, ['spalla'], C.vpush],
    ['machohp', 'Shoulder press macchina', 'spalle', { spalle: 1, tricipiti: 0.5 }, ['Macchine'], 'vert-spinta', 1, 1, ['spalla'], C.vpush],
    ['kbpress', 'Lento kettlebell in piedi', 'spalle', { spalle: 1, tricipiti: 0.5, addome: 0.2 }, ['Kettlebell'], 'vert-spinta', 1, 2, ['spalla'], C.vpush],
    ['pikepush', 'Pike push-up', 'spalle', { spalle: 1, tricipiti: 0.5 }, [], 'vert-spinta', 1, 2, ['spalla', 'polso'], C.vpush],
    // Vertical pull
    ['pull', 'Trazioni alla sbarra', 'dorso', { dorso: 1, bicipiti: 0.5 }, ['Sbarra'], 'vert-tirata', 1, 2, [], C.vpull],
    ['latm', 'Lat machine presa larga', 'dorso', { dorso: 1, bicipiti: 0.5 }, ['Cavi'], 'vert-tirata', 1, 1, [], C.vpull],
    ['assistpull', 'Trazioni assistite alla macchina', 'dorso', { dorso: 1, bicipiti: 0.5 }, ['Macchine'], 'vert-tirata', 1, 1, [], C.vpull],
    ['bandpull', 'Lat pulldown con elastico', 'dorso', { dorso: 1, bicipiti: 0.5 }, ['Elastici'], 'vert-tirata', 1, 1, [], C.vpull],
    // Squat
    ['squat', 'Squat bilanciere', 'quadricipiti', { quadricipiti: 1, glutei: 0.5, addome: 0.2 }, ['Bilanciere', 'Rack'], 'squat', 1, 2, ['ginocchio', 'schiena'], C.squat],
    ['legpress', 'Leg press', 'quadricipiti', { quadricipiti: 1, glutei: 0.5 }, ['Macchine'], 'squat', 1, 1, [], C.squat],
    ['goblet', 'Goblet squat', 'quadricipiti', { quadricipiti: 1, glutei: 0.5 }, ['Manubri'], 'squat', 1, 1, ['ginocchio'], C.squat],
    ['kbgoblet', 'Goblet squat kettlebell', 'quadricipiti', { quadricipiti: 1, glutei: 0.5 }, ['Kettlebell'], 'squat', 1, 1, ['ginocchio'], C.squat],
    ['hack', 'Hack squat', 'quadricipiti', { quadricipiti: 1, glutei: 0.4 }, ['Macchine'], 'squat', 1, 2, ['ginocchio'], C.squat],
    ['bwsquat', 'Squat a corpo libero', 'quadricipiti', { quadricipiti: 1, glutei: 0.5 }, [], 'squat', 1, 1, ['ginocchio'], C.squat],
    // Hinge
    ['rdl', 'Stacco rumeno bilanciere', 'femorali', { femorali: 1, glutei: 0.7, dorso: 0.2 }, ['Bilanciere'], 'hinge', 1, 2, ['schiena'], C.hinge],
    ['dbrdl', 'Stacco rumeno manubri', 'femorali', { femorali: 1, glutei: 0.7 }, ['Manubri'], 'hinge', 1, 1, ['schiena'], C.hinge],
    ['deadlift', 'Stacco da terra', 'femorali', { femorali: 0.7, glutei: 0.7, dorso: 0.5, quadricipiti: 0.3 }, ['Bilanciere'], 'hinge', 1, 3, ['schiena'], C.hinge],
    ['kbswing', 'Kettlebell swing', 'glutei', { glutei: 1, femorali: 0.7 }, ['Kettlebell'], 'hinge', 1, 2, ['schiena'], C.hinge],
    ['hipthrust', 'Hip thrust bilanciere', 'glutei', { glutei: 1, femorali: 0.4 }, ['Bilanciere', 'Panca'], 'hinge', 1, 1, [], ['Scapole sulla panca, piedi sotto le ginocchia.', 'Spingi con i talloni fino ad anche in linea con il busto.', 'Mento verso il petto, niente arco lombare.']],
    ['bridge', 'Ponte glutei', 'glutei', { glutei: 1, femorali: 0.4 }, [], 'hinge', 0, 1, [], C.iso],
    // Single leg
    ['bulgarian', 'Affondi bulgari manubri', 'quadricipiti', { quadricipiti: 1, glutei: 0.7 }, ['Manubri', 'Panca'], 'affondo', 1, 2, ['ginocchio'], C.lunge],
    ['walklunge', 'Affondi in camminata', 'quadricipiti', { quadricipiti: 1, glutei: 0.7 }, ['Manubri'], 'affondo', 1, 1, ['ginocchio'], C.lunge],
    ['stepup', 'Step-up su panca', 'quadricipiti', { quadricipiti: 1, glutei: 0.7 }, ['Panca'], 'affondo', 1, 1, [], C.lunge],
    ['bwlunge', 'Affondi a corpo libero', 'quadricipiti', { quadricipiti: 1, glutei: 0.7 }, [], 'affondo', 1, 1, ['ginocchio'], C.lunge],
    // Hamstrings
    ['legcurl', 'Leg curl', 'femorali', { femorali: 1 }, ['Macchine'], 'femorali', 0, 1, [], C.iso],
    ['slrdl', 'Stacco rumeno monopodalico', 'femorali', { femorali: 1, glutei: 0.5 }, ['Manubri'], 'femorali', 0, 2, ['schiena'], C.hinge],
    ['kbslrdl', 'Stacco monopodalico kettlebell', 'femorali', { femorali: 1, glutei: 0.5 }, ['Kettlebell'], 'femorali', 0, 2, ['schiena'], C.hinge],
    ['bandcurl', 'Leg curl con elastico', 'femorali', { femorali: 1 }, ['Elastici'], 'femorali', 0, 1, [], C.iso],
    ['nordic', 'Nordic curl', 'femorali', { femorali: 1 }, [], 'femorali', 0, 3, ['ginocchio'], C.iso],
    // Quads isolation
    ['legext', 'Leg extension', 'quadricipiti', { quadricipiti: 1 }, ['Macchine'], 'quad-iso', 0, 1, ['ginocchio'], C.iso],
    ['wallsit', 'Wall sit (secondi)', 'quadricipiti', { quadricipiti: 1 }, [], 'quad-iso', 0, 1, ['ginocchio'], C.iso],
    // Glutes isolation
    ['abd', 'Abduzioni alla macchina', 'glutei', { glutei: 1 }, ['Macchine'], 'glutei', 0, 1, [], C.iso],
    ['cableabd', 'Abduzioni ai cavi', 'glutei', { glutei: 1 }, ['Cavi'], 'glutei', 0, 1, [], C.iso],
    ['bandwalk', 'Camminata laterale con elastico', 'glutei', { glutei: 1 }, ['Elastici'], 'glutei', 0, 1, [], C.iso],
    // Calves
    ['calf', 'Calf raise in piedi', 'polpacci', { polpacci: 1 }, ['Macchine'], 'polpacci', 0, 1, ['caviglia'], C.iso],
    ['dbcalf', 'Calf raise con manubri', 'polpacci', { polpacci: 1 }, ['Manubri'], 'polpacci', 0, 1, ['caviglia'], C.iso],
    ['bwcalf', 'Calf raise monopodalico', 'polpacci', { polpacci: 1 }, [], 'polpacci', 0, 1, ['caviglia'], C.iso],
    // Lateral delts
    ['lat', 'Alzate laterali manubri', 'spalle', { spalle: 1 }, ['Manubri'], 'alzate-lat', 0, 1, [], C.iso],
    ['lr', 'Alzate laterali ai cavi', 'spalle', { spalle: 1 }, ['Cavi'], 'alzate-lat', 0, 1, [], C.iso],
    ['bandlat', 'Alzate laterali con elastico', 'spalle', { spalle: 1 }, ['Elastici'], 'alzate-lat', 0, 1, [], C.iso],
    // Rear delts
    ['facepull', 'Face pull ai cavi', 'spalle', { spalle: 1, dorso: 0.3 }, ['Cavi'], 'deltoide-post', 0, 1, [], C.iso],
    ['revfly', 'Alzate posteriori manubri', 'spalle', { spalle: 1, dorso: 0.3 }, ['Manubri'], 'deltoide-post', 0, 1, [], C.iso],
    ['bandpullapart', 'Pull-apart con elastico', 'spalle', { spalle: 1, dorso: 0.3 }, ['Elastici'], 'deltoide-post', 0, 1, [], C.iso],
    // Chest isolation
    ['cross', 'Croci ai cavi', 'petto', { petto: 1 }, ['Cavi'], 'croci', 0, 1, ['spalla'], C.iso],
    ['dbfly', 'Croci con manubri', 'petto', { petto: 1 }, ['Manubri', 'Panca'], 'croci', 0, 1, ['spalla'], C.iso],
    ['pecdeck', 'Pec deck', 'petto', { petto: 1 }, ['Macchine'], 'croci', 0, 1, ['spalla'], C.iso],
    // Biceps
    ['curl', 'Curl manubri', 'bicipiti', { bicipiti: 1 }, ['Manubri'], 'bicipiti', 0, 1, ['gomito'], C.iso],
    ['bbcurl', 'Curl bilanciere', 'bicipiti', { bicipiti: 1 }, ['Bilanciere'], 'bicipiti', 0, 1, ['gomito', 'polso'], C.iso],
    ['cablecurl', 'Curl ai cavi', 'bicipiti', { bicipiti: 1 }, ['Cavi'], 'bicipiti', 0, 1, ['gomito'], C.iso],
    ['hammer', 'Curl a martello', 'bicipiti', { bicipiti: 1 }, ['Manubri'], 'bicipiti', 0, 1, [], C.iso],
    ['bandcurlb', 'Curl con elastico', 'bicipiti', { bicipiti: 1 }, ['Elastici'], 'bicipiti', 0, 1, [], C.iso],
    // Triceps
    ['pd', 'Push-down ai cavi', 'tricipiti', { tricipiti: 1 }, ['Cavi'], 'tricipiti', 0, 1, ['gomito'], C.iso],
    ['ohext', 'Estensioni sopra la testa ai cavi', 'tricipiti', { tricipiti: 1 }, ['Cavi'], 'tricipiti', 0, 1, ['gomito', 'spalla'], C.iso],
    ['french', 'French press manubri', 'tricipiti', { tricipiti: 1 }, ['Manubri', 'Panca'], 'tricipiti', 0, 1, ['gomito'], C.iso],
    ['kickback', 'Kickback manubrio', 'tricipiti', { tricipiti: 1 }, ['Manubri'], 'tricipiti', 0, 1, [], C.iso],
    ['diamond', 'Piegamenti presa stretta', 'tricipiti', { tricipiti: 1, petto: 0.5 }, [], 'tricipiti', 0, 2, ['polso', 'gomito'], C.iso],
    ['bandpd', 'Push-down con elastico', 'tricipiti', { tricipiti: 1 }, ['Elastici'], 'tricipiti', 0, 1, [], C.iso],
    // Core
    ['plank', 'Plank (secondi)', 'addome', { addome: 1 }, [], 'addome', 0, 1, [], ['Gomiti sotto le spalle.', 'Glutei e addome contratti, bacino neutro.', 'Respira senza perdere la posizione.']],
    ['deadbug', 'Dead bug', 'addome', { addome: 1 }, [], 'addome', 0, 1, [], C.iso],
    ['cablecrunch', 'Crunch ai cavi', 'addome', { addome: 1 }, ['Cavi'], 'addome', 0, 1, ['schiena'], C.iso],
    ['hangleg', 'Leg raise alla sbarra', 'addome', { addome: 1 }, ['Sbarra'], 'addome', 0, 2, ['spalla'], C.iso],
    ['pallof', 'Pallof press', 'addome', { addome: 1 }, ['Cavi'], 'addome', 0, 1, [], C.iso]
  ];

  GT.CATALOG = RAW.map(function (r) {
    return { id: r[0], n: r[1], m: r[2], mg: r[3], req: r[4], pat: r[5], comp: !!r[6], lvl: r[7], avoid: r[8], cues: r[9] };
  });
  GT.EXI = {};
  GT.CATALOG.forEach(function (e) { GT.EXI[e.id] = e; });

  // Exercises that come with an imported plan (plan.custom: { id: entry }) are added to GT.EXI
  // so every screen can show them; they do not appear in the library list (GT.CATALOG).
  GT.registerCustom = function (plan) {
    var c = plan && plan.custom;
    if (!c) return;
    Object.keys(c).forEach(function (id) { GT.EXI[id] = c[id]; });
  };

  // Equipment label shown in lists: the first required item, or "Corpo libero"
  GT.eqLabel = function (e) { return e.req.length ? e.req[0] : 'Corpo libero'; };
  // Can this user do this exercise? (equipment owned, no limitation conflict, level)
  GT.exAllowed = function (e, profile) {
    var eq = (profile && profile.equipment) || [];
    var lim = ((profile && profile.limitations) || []).map(function (l) { return l.k; });
    var lvl = profile && profile.experience === 'avanzato' ? 3 : profile && profile.experience === 'intermedio' ? 2 : 1;
    return e.req.every(function (q) { return eq.indexOf(q) >= 0; }) && !e.avoid.some(function (a) { return lim.indexOf(a) >= 0; }) && e.lvl <= lvl;
  };
  // Alternatives for a swap: same pattern first, then same primary muscle
  GT.alternativesFor = function (id, profile, n) {
    var e = GT.EXI[id];
    if (!e) return [];
    var same = GT.CATALOG.filter(function (x) { return x.id !== id && x.pat === e.pat && GT.exAllowed(x, profile); });
    var muscle = GT.CATALOG.filter(function (x) { return x.id !== id && x.pat !== e.pat && x.m === e.m && GT.exAllowed(x, profile); });
    return same.concat(muscle).slice(0, n || 3);
  };
})();
