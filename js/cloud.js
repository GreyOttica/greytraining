/* GreyTraining — cloud: Supabase login + offline-first sync, and the real coach.

   How it works
   - The phone stays the primary copy (localStorage). Every change still saves locally first.
   - When signed in and online, the persisted fields are pushed to Supabase as one JSON
     document per user (table gt_state, see supabase/schema.sql). Last write wins, by the
     time of the change on the device that made it. The database refuses a write older than
     the row it holds (trigger gt_state_keep_newer), so a stale device can never overwrite
     newer data; it pulls instead.
   - The cloud copy is pulled on sign-in, on start-up, when the app comes back to the
     foreground and when the network returns.
   - The first time a device links to an account, the cloud copy wins if one exists. Before
     that happens, the local data is saved to a backup key (greytraining.backup.<time>).
     Signing out does not unlink the device, so signing back in merges normally.
   - A workout in progress on this device is never replaced by the cloud copy.
   - The Supabase URL and public (anon) key come from the Vercel function /api/config, which
     reads them from the Vercel environment. On a host without that function (GitHub Pages,
     the local serve.ps1) cloud features stay off and the app works as before.
   - The coach chat calls /api/coach with the Supabase access token; the function checks it,
     then calls the AI chosen on Vercel (Groq, with Google Gemini as fallback; Claude optional).
     No AI key ever reaches the phone.

   UI state lives in GT.state.cloud (not persisted):
     { configured, ready, user, busy, syncing, lastSync, error, coach } */
(function () {
  'use strict';
  var GT = window.GT;
  var CFG_KEY = 'greytraining.cloudcfg';
  var META_KEY = 'greytraining.sync';
  var BACKUP_PREFIX = 'greytraining.backup.';
  var PUSH_DELAY = 1500;
  var NET_TIMEOUT = 15000;

  var C = (GT.cloud = {});
  var client = null, session = null, pushTimer = null, pulling = null, pushing = null, halted = false;

  // ---------- small helpers ----------
  function readJSON(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v || fallback; } catch (e) { return fallback; } }
  function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  // Sync bookkeeping, cached in memory so a blocked localStorage cannot make it flip-flop
  var metaCache = null;
  function meta() { return metaCache || (metaCache = readJSON(META_KEY, { localUpdatedAt: 0, remoteSeen: 0, dirty: false, linkedUser: null })); }
  function setMeta(patch) { if (halted) return meta(); metaCache = Object.assign({}, meta(), patch); writeJSON(META_KEY, metaCache); return metaCache; }
  function setCloud(patch) { GT.set({ cloud: Object.assign({}, GT.state.cloud, patch) }); }
  function online() { return navigator.onLine !== false; }

  // Keep the three most recent backups of this device's data
  function backupLocal() {
    try {
      localStorage.setItem(BACKUP_PREFIX + Date.now(), JSON.stringify(GT.persistedSnapshot()));
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(BACKUP_PREFIX) === 0) keys.push(k); }
      keys.sort().slice(0, Math.max(0, keys.length - 3)).forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  }

  // Italian messages for the errors people actually hit
  function friendly(err) {
    var m = String((err && (err.message || err.error_description)) || err || '');
    if (/invalid login credentials/i.test(m)) return 'Email o password non corretti.';
    if (/email not confirmed/i.test(m)) return 'Conferma prima l’indirizzo email: apri il link che ti abbiamo inviato.';
    if (/already registered|already been registered/i.test(m)) return 'Esiste già un account con questa email. Usa Accedi.';
    if (/signups? not allowed|signup is disabled/i.test(m)) return 'La registrazione di nuovi account è disattivata.';
    if (/password should be at least|weak password/i.test(m)) return 'Password troppo corta: usa almeno 8 caratteri.';
    if (/rate limit|too many/i.test(m)) return 'Troppi tentativi. Riprova tra qualche minuto.';
    if (/fetch|network|abort|timeout/i.test(m)) return 'Connessione assente o lenta. Riprova quando sei online.';
    return m ? 'Errore: ' + m : 'Qualcosa non ha funzionato.';
  }

  // Every Supabase request gives up after NET_TIMEOUT, so "syncing" can never hang.
  function timedFetch(url, opts) {
    opts = opts || {};
    if (!opts.signal && typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      opts = Object.assign({}, opts, { signal: AbortSignal.timeout(NET_TIMEOUT) });
    }
    return fetch(url, opts);
  }

  GT.state = Object.assign({}, GT.state, { cloud: { configured: false, ready: false, user: null, busy: false, syncing: false, lastSync: null, error: null, coach: false } });

  // ---------- configuration ----------
  function loadConfig() {
    var cached = readJSON(CFG_KEY, null);
    // Only a Vercel deployment has /api/config. Relative URL so it works under any path.
    var fresh = timedFetch('api/config', { cache: 'no-store', headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (cfg && cfg.configured && cfg.supabaseUrl && cfg.supabaseAnonKey) { writeJSON(CFG_KEY, cfg); return cfg; }
        if (cfg && cfg.configured === false) { try { localStorage.removeItem(CFG_KEY); } catch (e) {} return null; }
        return cached; // 404 or HTML from a static host: keep whatever we had
      })
      .catch(function () { return cached; }); // offline: use the cached config
    if (!cached) return fresh;
    fresh.then(function (f) { if (f && client) setCloud({ coach: !!f.coach, ai: f.aiProvider || 'groq', aiFallback: f.aiFallback || null }); });
    return Promise.resolve(cached);
  }

  // ---------- sync ----------
  function takeRemote(row, uid, firstLink) {
    var remoteAt = Number(row.client_updated_at) || 0, m = meta();
    if (firstLink && (m.dirty || m.localUpdatedAt > 0)) backupLocal();
    var keptLocal = GT.applyRemote(row.data);
    setMeta({ linkedUser: uid, localUpdatedAt: remoteAt, remoteSeen: remoteAt, dirty: false });
    // The live workout on this device was kept: send it back up.
    if (keptLocal) GT.onPersistChange();
    setCloud({ lastSync: Date.now(), error: null });
  }

  function pull() {
    if (halted || !client || !session || !online()) return Promise.resolve();
    if (pulling) return pulling;
    setCloud({ syncing: true });
    var uid = session.user.id;
    pulling = client.from('gt_state').select('data, client_updated_at').eq('user_id', uid).maybeSingle()
      .then(function (res) {
        if (res.error) throw res.error;
        var row = res.data, m = meta(), firstLink = m.linkedUser !== uid;
        if (!row) {
          // Nothing in the cloud yet: this device's data becomes the first copy.
          setMeta({ linkedUser: uid, dirty: true, localUpdatedAt: Math.max(m.localUpdatedAt, 1) });
          return 'push';
        }
        var remoteAt = Number(row.client_updated_at) || 0;
        if (firstLink) return takeRemote(row, uid, true);
        if (remoteAt === m.remoteSeen) return m.dirty ? 'push' : setCloud({ lastSync: Date.now(), error: null });
        // The cloud changed since this device last saw it
        if (!m.dirty || remoteAt > m.localUpdatedAt) return takeRemote(row, uid, false);
        setMeta({ remoteSeen: remoteAt });
        return 'push'; // local edits are newer
      })
      .catch(function (err) { setCloud({ error: friendly(err) }); })
      .then(function (next) {
        pulling = null;
        setCloud({ syncing: false });
        if (next === 'push') return push(true);
      });
    return pulling;
  }

  function push(force) {
    clearTimeout(pushTimer); pushTimer = null;
    if (halted || !client || !session || !online()) return Promise.resolve();
    var m = meta();
    if (!force && !m.dirty) return Promise.resolve();
    // Never push before this device has pulled once for this account
    if (m.linkedUser !== session.user.id) return pulling ? Promise.resolve() : pull();
    if (pushing) { pushing.then(function () { schedulePush(); }); return pushing; }
    setCloud({ syncing: true });
    var sentAt = m.localUpdatedAt || Date.now();
    var row = { user_id: session.user.id, data: GT.persistedSnapshot(), client_updated_at: sentAt };
    var needPull = false;
    pushing = client.from('gt_state').upsert(row, { onConflict: 'user_id' }).select('client_updated_at').maybeSingle()
      .then(function (res) {
        if (res.error) throw res.error;
        // No row back: the database kept a newer copy (trigger gt_state_keep_newer). Pull it.
        if (!res.data || Number(res.data.client_updated_at) !== sentAt) { needPull = true; setMeta({ remoteSeen: -1 }); return; }
        var now = meta();
        setMeta({ remoteSeen: sentAt, dirty: now.localUpdatedAt > sentAt });
        setCloud({ lastSync: Date.now(), error: null });
        if (now.localUpdatedAt > sentAt) schedulePush();
      })
      .catch(function (err) { setCloud({ error: friendly(err) }); })
      .then(function () {
        pushing = null;
        setCloud({ syncing: false });
        if (needPull) return pull();
      });
    return pushing;
  }

  function schedulePush() {
    if (!session || halted) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { push(false); }, PUSH_DELAY);
  }

  // Called by store.js whenever a persisted field changes on this device.
  // The timestamp always moves past anything seen, even if this device's clock is behind.
  GT.onPersistChange = function () {
    var m = meta();
    setMeta({ localUpdatedAt: Math.max(Date.now(), m.localUpdatedAt + 1, m.remoteSeen + 1), dirty: true });
    schedulePush();
  };

  // Stop all sync work (used by GT.resetAll before it reloads the page)
  C.halt = function () { halted = true; clearTimeout(pushTimer); };

  // ---------- auth ----------
  function onSession(s) {
    var had = session && session.user && session.user.id;
    session = s || null;
    setCloud({ user: session ? session.user.email : null });
    if (session && session.user.id !== had) { setCloud({ error: null }); pull(); }
  }

  function guard(promise) {
    setCloud({ busy: true, error: null });
    return promise
      .then(function (res) { if (res && res.error) throw res.error; return res; })
      .catch(function (err) { setCloud({ error: friendly(err) }); return null; })
      .then(function (res) { setCloud({ busy: false }); return res; });
  }

  C.signIn = function (email, password) {
    if (!client) return Promise.resolve(null);
    return guard(client.auth.signInWithPassword({ email: email.trim(), password: password }));
  };
  C.signUp = function (email, password) {
    if (!client) return Promise.resolve(null);
    var redirect = location.origin + location.pathname;
    return guard(client.auth.signUp({ email: email.trim(), password: password, options: { emailRedirectTo: redirect } }))
      .then(function (res) {
        var u = res && res.data && res.data.user;
        // Supabase answers an already-registered email with a user that has no identities
        if (u && Array.isArray(u.identities) && u.identities.length === 0) setCloud({ error: 'Esiste già un account con questa email. Usa Accedi.' });
        else if (res && res.data && !res.data.session) setCloud({ error: 'Account creato. Apri il link di conferma nell’email, poi torna qui e accedi.' });
        return res;
      });
  };
  // Signing out keeps the data on this phone and keeps the device linked to the account,
  // so signing back in merges normally instead of taking the cloud copy over local edits.
  C.signOut = function () {
    if (!client) return Promise.resolve();
    return push(false).then(function () { return guard(client.auth.signOut()); });
  };
  C.syncNow = function () { return session ? pull() : Promise.resolve(); };

  // ---------- coach ----------
  C.coachReady = function () { return !!(client && session && online() && GT.state.cloud.coach); };

  // history: GT.state.chat ({who:'u'|'c', t}). Returns the reply text, or rejects with {userMessage}.
  C.askCoach = function (history, context) {
    var msgs = history.map(function (m) { return { role: m.who === 'u' ? 'user' : 'assistant', content: String(m.t || '') }; })
      .filter(function (m) { return m.content; })
      .slice(-20);
    while (msgs.length && msgs[0].role !== 'user') msgs.shift(); // the API wants a user turn first
    return client.auth.getSession().then(function (res) {
      var token = res && res.data && res.data.session && res.data.session.access_token;
      if (!token) throw { userMessage: 'Accedi dal Profilo per usare il coach.' };
      return fetch('api/coach', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({ messages: msgs, context: context })
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok || !body.reply) throw { userMessage: body.error || ('Coach non raggiungibile (' + r.status + ').') };
        return body.reply;
      });
    }, function (err) { throw err && err.userMessage ? err : { userMessage: 'Nessuna connessione con il coach.' }; });
  };

  // ---------- start-up ----------
  loadConfig().then(function (cfg) {
    if (!cfg || !window.supabase || !window.supabase.createClient) return;
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'greytraining.auth' },
      global: { fetch: timedFetch }
    });
    setCloud({ configured: true, coach: !!cfg.coach, ai: cfg.aiProvider || 'groq', aiFallback: cfg.aiFallback || null });
    client.auth.onAuthStateChange(function (event, s) { onSession(s); });
    client.auth.getSession().then(function (res) {
      onSession(res && res.data ? res.data.session : null);
      setCloud({ ready: true });
    }, function () { setCloud({ ready: true }); });
  });

  window.addEventListener('online', function () { if (session) pull(); });
  document.addEventListener('visibilitychange', function () {
    if (!session) return;
    if (document.visibilityState === 'visible') pull();
    else push(false); // flush before iOS suspends the app
  });
})();
