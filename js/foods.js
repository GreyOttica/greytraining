/* GreyTraining — common foods, values per 100 g (approximate, from standard food tables).
   Each: [name, category, kcal, protein g, carbs g, fat g, default portion g, portion label].
   Search: GT.searchFoods(query). Portion math: GT.foodItem(food, grams). */
(function () {
  'use strict';
  var GT = (window.GT = window.GT || {});

  var RAW = [
    // Cereali e carboidrati
    ['Pasta di semola (cruda)', 'Cereali', 353, 12, 72, 1.5, 80, 'porzione'],
    ['Pasta integrale (cruda)', 'Cereali', 340, 13, 64, 2.5, 80, 'porzione'],
    ['Riso basmati (crudo)', 'Cereali', 350, 8, 78, 1, 80, 'porzione'],
    ['Riso integrale (crudo)', 'Cereali', 357, 7.5, 76, 2.7, 80, 'porzione'],
    ['Pane comune', 'Cereali', 265, 9, 51, 3, 60, 'fetta grande'],
    ['Pane integrale', 'Cereali', 245, 10, 45, 3, 60, 'fetta grande'],
    ['Fiocchi d\'avena', 'Cereali', 370, 13, 60, 7, 50, 'porzione'],
    ['Fette biscottate', 'Cereali', 410, 11, 72, 7, 20, '2 fette'],
    ['Gallette di riso', 'Cereali', 380, 8, 81, 3, 18, '2 gallette'],
    ['Farro (crudo)', 'Cereali', 340, 15, 67, 2.5, 70, 'porzione'],
    ['Quinoa (cruda)', 'Cereali', 368, 14, 64, 6, 70, 'porzione'],
    ['Couscous (crudo)', 'Cereali', 360, 12, 73, 1.5, 70, 'porzione'],
    ['Corn flakes', 'Cereali', 380, 7, 84, 0.9, 30, 'porzione'],
    ['Granola', 'Cereali', 470, 10, 64, 20, 40, 'porzione'],
    ['Patate', 'Cereali', 77, 2, 17, 0.1, 200, 'porzione'],
    ['Patate dolci', 'Cereali', 86, 1.6, 20, 0.1, 200, 'porzione'],
    ['Piadina', 'Cereali', 300, 8, 50, 8, 100, '1 piadina'],
    // Carne e pesce
    ['Petto di pollo', 'Carne e pesce', 110, 23, 0, 1.5, 150, 'porzione'],
    ['Fesa di tacchino', 'Carne e pesce', 107, 24, 0, 1, 150, 'porzione'],
    ['Manzo magro', 'Carne e pesce', 130, 21, 0, 5, 150, 'porzione'],
    ['Macinato di manzo magro', 'Carne e pesce', 150, 20, 0, 8, 120, 'porzione'],
    ['Lonza di maiale', 'Carne e pesce', 145, 21, 0, 6, 150, 'porzione'],
    ['Salmone', 'Carne e pesce', 208, 20, 0, 13, 150, 'porzione'],
    ['Tonno al naturale (sgocciolato)', 'Carne e pesce', 103, 24, 0, 0.8, 80, '1 scatoletta'],
    ['Tonno sott\'olio (sgocciolato)', 'Carne e pesce', 190, 25, 0, 10, 80, '1 scatoletta'],
    ['Merluzzo', 'Carne e pesce', 82, 18, 0, 0.7, 200, 'porzione'],
    ['Orata', 'Carne e pesce', 121, 20, 0, 4.5, 200, 'porzione'],
    ['Gamberi', 'Carne e pesce', 85, 18, 1, 1, 150, 'porzione'],
    ['Prosciutto crudo', 'Carne e pesce', 250, 26, 0, 16, 50, 'porzione'],
    ['Prosciutto cotto', 'Carne e pesce', 135, 19, 1, 6, 50, 'porzione'],
    ['Bresaola', 'Carne e pesce', 151, 32, 0, 2.6, 50, 'porzione'],
    ['Uova', 'Uova e latticini', 143, 12.6, 0.7, 9.5, 60, '1 uovo'],
    ['Albume d\'uovo', 'Uova e latticini', 52, 11, 0.7, 0.2, 100, 'porzione'],
    // Latticini
    ['Latte parzialmente scremato', 'Uova e latticini', 46, 3.3, 5, 1.6, 250, '1 tazza'],
    ['Latte intero', 'Uova e latticini', 64, 3.3, 4.9, 3.6, 250, '1 tazza'],
    ['Yogurt greco 0%', 'Uova e latticini', 57, 10, 4, 0, 170, '1 vasetto'],
    ['Yogurt greco 2%', 'Uova e latticini', 73, 9.5, 4, 2, 170, '1 vasetto'],
    ['Yogurt bianco intero', 'Uova e latticini', 66, 3.8, 4.7, 3.6, 125, '1 vasetto'],
    ['Skyr', 'Uova e latticini', 63, 11, 4, 0.2, 150, '1 vasetto'],
    ['Fiocchi di latte', 'Uova e latticini', 98, 11, 3.4, 4.3, 150, '1 confezione'],
    ['Ricotta vaccina', 'Uova e latticini', 146, 8.8, 3.5, 10.9, 100, 'porzione'],
    ['Mozzarella', 'Uova e latticini', 253, 18.7, 0.7, 19.5, 125, '1 mozzarella'],
    ['Mozzarella light', 'Uova e latticini', 165, 20, 1, 9, 125, '1 mozzarella'],
    ['Parmigiano Reggiano', 'Uova e latticini', 392, 33, 0, 28, 20, 'porzione'],
    ['Bevanda di soia', 'Uova e latticini', 33, 3.3, 0.7, 1.8, 250, '1 tazza'],
    // Legumi e proteine vegetali
    ['Ceci in scatola (sgocciolati)', 'Legumi', 120, 7, 16, 2.6, 150, 'porzione'],
    ['Lenticchie in scatola (sgocciolate)', 'Legumi', 92, 7, 13, 0.5, 150, 'porzione'],
    ['Fagioli in scatola (sgocciolati)', 'Legumi', 90, 6, 13, 0.5, 150, 'porzione'],
    ['Lenticchie secche', 'Legumi', 325, 23, 51, 1.5, 60, 'porzione'],
    ['Piselli surgelati', 'Legumi', 70, 5.5, 9, 0.4, 150, 'porzione'],
    ['Edamame', 'Legumi', 121, 12, 9, 5, 100, 'porzione'],
    ['Tofu', 'Legumi', 120, 13, 2, 7, 125, 'porzione'],
    ['Tempeh', 'Legumi', 192, 19, 9, 11, 100, 'porzione'],
    ['Hummus', 'Legumi', 166, 8, 14, 10, 50, 'porzione'],
    // Verdura
    ['Zucchine', 'Verdura', 17, 1.3, 3, 0.3, 200, 'porzione'],
    ['Insalata mista', 'Verdura', 18, 1.5, 2.5, 0.2, 100, 'porzione'],
    ['Pomodori', 'Verdura', 18, 0.9, 3.9, 0.2, 150, 'porzione'],
    ['Broccoli', 'Verdura', 34, 2.8, 7, 0.4, 200, 'porzione'],
    ['Spinaci', 'Verdura', 23, 2.9, 3.6, 0.4, 200, 'porzione'],
    ['Carote', 'Verdura', 41, 0.9, 10, 0.2, 100, 'porzione'],
    ['Peperoni', 'Verdura', 26, 1, 6, 0.3, 150, 'porzione'],
    ['Melanzane', 'Verdura', 25, 1, 6, 0.2, 200, 'porzione'],
    ['Funghi', 'Verdura', 22, 3, 3, 0.3, 150, 'porzione'],
    ['Fagiolini', 'Verdura', 31, 1.8, 7, 0.2, 200, 'porzione'],
    ['Cavolfiore', 'Verdura', 25, 1.9, 5, 0.3, 200, 'porzione'],
    // Frutta
    ['Banana', 'Frutta', 89, 1.1, 23, 0.3, 120, '1 banana'],
    ['Mela', 'Frutta', 52, 0.3, 14, 0.2, 180, '1 mela'],
    ['Arancia', 'Frutta', 47, 0.9, 12, 0.1, 200, '1 arancia'],
    ['Pera', 'Frutta', 57, 0.4, 15, 0.1, 170, '1 pera'],
    ['Kiwi', 'Frutta', 61, 1.1, 15, 0.5, 80, '1 kiwi'],
    ['Fragole', 'Frutta', 32, 0.7, 8, 0.3, 150, 'porzione'],
    ['Mirtilli', 'Frutta', 57, 0.7, 14, 0.3, 125, '1 vaschetta'],
    ['Uva', 'Frutta', 69, 0.7, 18, 0.2, 150, 'porzione'],
    ['Ananas', 'Frutta', 50, 0.5, 13, 0.1, 150, 'porzione'],
    ['Datteri', 'Frutta', 282, 2.5, 75, 0.4, 30, '4 datteri'],
    // Grassi e frutta secca
    ['Olio extravergine d\'oliva', 'Grassi', 884, 0, 0, 100, 10, '1 cucchiaio'],
    ['Burro', 'Grassi', 717, 0.9, 0.1, 81, 10, 'porzione'],
    ['Burro d\'arachidi', 'Grassi', 588, 25, 20, 50, 20, '1 cucchiaio'],
    ['Mandorle', 'Grassi', 579, 21, 22, 50, 30, 'porzione'],
    ['Noci', 'Grassi', 654, 15, 14, 65, 30, 'porzione'],
    ['Avocado', 'Grassi', 160, 2, 9, 15, 100, 'mezzo avocado'],
    ['Semi di chia', 'Grassi', 486, 17, 42, 31, 15, 'porzione'],
    ['Cioccolato fondente 70%', 'Grassi', 598, 7.8, 46, 43, 20, '2 quadretti'],
    // Altro
    ['Whey protein isolate', 'Altro', 370, 88, 3, 1, 30, '1 misurino'],
    ['Barretta proteica', 'Altro', 350, 33, 35, 12, 60, '1 barretta'],
    ['Miele', 'Altro', 304, 0.3, 82, 0, 10, '1 cucchiaino'],
    ['Marmellata', 'Altro', 250, 0.4, 60, 0.1, 20, 'porzione'],
    ['Zucchero', 'Altro', 400, 0, 100, 0, 5, '1 cucchiaino'],
    ['Biscotti secchi', 'Altro', 440, 7, 72, 14, 30, 'porzione'],
    ['Cornetto', 'Altro', 410, 7, 45, 22, 60, '1 cornetto'],
    ['Pizza margherita', 'Altro', 270, 11, 33, 10, 300, '1 pizza (metà)'],
    ['Gelato alla crema', 'Altro', 218, 3.7, 24, 12, 100, 'porzione'],
    ['Birra', 'Altro', 43, 0.5, 3.6, 0, 330, '1 bottiglia'],
    ['Vino rosso', 'Altro', 85, 0.1, 2.6, 0, 125, '1 bicchiere']
  ];

  GT.FOODS = RAW.map(function (r, i) {
    return { id: 'f' + i, n: r[0], cat: r[1], k: r[2], p: r[3], c: r[4], g: r[5], portion: r[6], unit: r[7] };
  });

  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  // Search by words in the name or category; every word must match
  GT.searchFoods = function (q, list) {
    var words = norm(q).split(/\s+/).filter(Boolean);
    var src = list || GT.FOODS;
    if (!words.length) return src.slice();
    return src.filter(function (f) { var h = norm(f.n + ' ' + (f.cat || '')); return words.every(function (w) { return h.indexOf(w) >= 0; }); });
  };
  // A diary entry for a given amount of a food (values per 100 g)
  GT.foodItem = function (f, grams) {
    var x = grams / 100;
    return { n: f.n, q: Math.round(grams) + ' g', grams: Math.round(grams), k: Math.round(f.k * x), p: Math.round(f.p * x), c: Math.round(f.c * x), g: Math.round(f.g * x), per100: { k: f.k, p: f.p, c: f.c, g: f.g } };
  };
})();
