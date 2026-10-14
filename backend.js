/* ====================================================================
   backend.js - adattatore dati su Supabase
   Espone window.claude.use('db' | 'user' | 'assets') con la stessa API
   che l'app usa, cosi' app.js funziona senza modifiche.
   Tutti i documenti stanno nella tabella public.docs (collection, id, data jsonb).
   ==================================================================== */
(function () {
  const cfg = window.NX_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || /INSERISCI/.test(cfg.SUPABASE_URL) || /INSERISCI/.test(cfg.SUPABASE_ANON_KEY || '')) {
    console.warn('[NEXUS] Configura js/config.js con URL e chiave Supabase.');
    return; // l'app mostrera' "Dati non raggiungibili"
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const BUCKET = cfg.STORAGE_BUCKET || 'media';

  const cache = {};      // collection -> Map(id -> data)
  const subs = {};       // collection -> Set(callback)
  const loaded = {};     // collection -> Promise
  let channel = null;

  const canon = (v) => Array.isArray(v) ? v.map(canon)
    : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => (o[k] = canon(v[k]), o), {}) : v;
  const sig = (m) => JSON.stringify([...m.keys()].sort().map((k) => [k, canon(m.get(k))]));
  const snap = (col) => ({ docs: [...cache[col]].map(([id, data]) => ({ id, data: () => data })) });
  const notify = (col) => (subs[col] || new Set()).forEach((cb) => { try { cb(snap(col)); } catch (e) { console.error(e); } });

  function ensureChannel() {
    if (channel) return;
    channel = sb.channel('nx-docs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, (p) => {
        const row = p.eventType === 'DELETE' ? p.old : p.new;
        if (!row || !row.collection || !cache[row.collection]) return;
        if (p.eventType === 'DELETE') cache[row.collection].delete(row.id);
        else cache[row.collection].set(row.id, row.data);
        notify(row.collection);
      })
      .subscribe();
  }

  function load(col) {
    if (loaded[col]) return loaded[col];
    cache[col] = new Map();
    loaded[col] = (async () => {
      const { data, error } = await sb.from('docs').select('id,data').eq('collection', col);
      if (error) { delete loaded[col]; throw error; }
      data.forEach((r) => cache[col].set(r.id, r.data));
    })();
    return loaded[col];
  }

  const local = (col, id, obj) => { if (cache[col]) { cache[col].set(id, obj); notify(col); } };

  const docRef = (col, id) => ({
    async get() {
      const { data, error } = await sb.from('docs').select('data').eq('collection', col).eq('id', id).maybeSingle();
      if (error) throw error;
      return { id, exists: !!data, data: () => (data ? data.data : undefined) };
    },
    async set(obj) {
      const { error } = await sb.from('docs').upsert({ collection: col, id, data: obj, updated_at: new Date().toISOString() });
      if (error) throw error;
      local(col, id, obj);
    },
    async update(patch) {
      const { error } = await sb.rpc('doc_merge', { p_col: col, p_id: id, p_patch: patch });
      if (error) throw error;
      local(col, id, { ...((cache[col] && cache[col].get(id)) || {}), ...patch });
    },
    async delete() {
      const { error } = await sb.from('docs').delete().eq('collection', col).eq('id', id);
      if (error) throw error;
      if (cache[col]) { cache[col].delete(id); notify(col); }
    }
  });

  const db = {
    collection(col) {
      return {
        doc: (id) => docRef(col, id),
        onSnapshot(cb, onErr) {
          (subs[col] = subs[col] || new Set()).add(cb);
          load(col).then(() => { ensureChannel(); cb(snap(col)); }).catch((e) => onErr && onErr(e));
          return () => subs[col].delete(cb);
        }
      };
    }
  };

  // Identita' "tecnica" del dispositivo (l'account del giocatore e' gestito dall'app con email e password)
  const deviceId = (() => {
    try {
      let d = localStorage.getItem('nx_device');
      if (!d) { d = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); localStorage.setItem('nx_device', d); }
      return d;
    } catch (e) { return 'dev-' + Math.random().toString(36).slice(2); }
  })();
  const user = { id: async () => deviceId, canEdit: () => false };

  const assets = {
    async upload(file) {
      const ext = ((file.name || 'img.jpg').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)) + '.' + ext;
      const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' });
      if (error) throw error;
      return { url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
    }
  };

  // Rete di sicurezza: se il realtime non e' attivo, aggiorna comunque ogni 6 secondi
  setInterval(async () => {
    if (document.hidden) return;
    for (const col of Object.keys(subs)) {
      if (!subs[col].size || !loaded[col]) continue;
      try {
        const { data } = await sb.from('docs').select('id,data').eq('collection', col);
        if (!data) continue;
        const m = new Map(data.map((r) => [r.id, r.data]));
        if (sig(m) !== sig(cache[col])) { cache[col] = m; notify(col); }
      } catch (e) { /* offline: riprova al giro dopo */ }
    }
  }, 6000);

  window.claude = { use: async (name) => ({ db, user, assets }[name] || null) };
})();
