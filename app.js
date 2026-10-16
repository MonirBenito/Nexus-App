/* NEXUS CONNECTION - Pokégear Core Logic */
const NX = window.NX_CONFIG || {};
const $= s => document.querySelector(s), app =$('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let db, user, assets, uid, isMaster = false, masterOK = false, authed = false, cred = null;
let S = { players: {}, npcs: {}, items: {}, quests: {}, party: {}, msgs: {}, maps: {} };
let view = { name: 'splash' }, tab = 'players';

const DROP = `<svg viewBox="0 0 100 130" width="100%" height="100%"><defs><radialGradient id="g" cx="35%" cy="40%"><stop offset="0" stop-color="#ff4d5a"/><stop offset="1" stop-color="#8a0c16"/></radialGradient></defs><path d="M50 4C50 4 8 58 8 84a42 42 0 0 0 84 0C92 58 50 4 50 4Z" fill="url(#g)"/><ellipse cx="34" cy="86" rx="7" ry="15" fill="#fff" opacity=".35" transform="rotate(20 34 86)"/></svg>`;

function toast(t) {
  const e = document.createElement('div'); e.className = 'toast'; e.textContent = t;
  document.body.append(e); setTimeout(() => e.remove(), 2200);
}

function ask(title, fields, init = {}) {
  return new Promise(res => {
    const m = document.createElement('div'); m.className = 'modal';
    const inp = f => f.t === 'select' ? `<select name="${f.n}">${f.o.map(o => `<option ${init[f.n] == o ? 'selected' : ''}>${o}</option>`).join('')}</select>`
      : f.t === 'area' ? `<textarea name="${f.n}" rows="3">${esc(init[f.n])}</textarea>`
      : f.t === 'multi' ? (f.o.length ? f.o.map(([v, l]) => `<label class="row" style="margin:6px 0"><input type="checkbox" name="${f.n}" value="${esc(v)}" style="width:auto;margin:0" ${(init[f.n] || []).includes(v) ? 'checked' : ''}> ${esc(l)}</label>`).join('') : '<p class="mut">Nessun elemento.</p>')
      : `<input name="${f.n}" type="${f.t || 'text'}" value="${esc(init[f.n])}">`;

    m.innerHTML = `<div><h3>${esc(title)}</h3>${fields.map(f => `<label class="mut">${esc(f.l)}</label>` + inp(f)).join('')}<div class="row" style="margin-top:14px"><button class="g grow" data-x>Annulla</button><button class="grow" data-ok>Salva</button></div></div>`;
    document.body.append(m);
    m.onclick = e => {
      if (e.target.dataset.x !== undefined || e.target === m) { m.remove(); res(null); }
      if (e.target.dataset.ok !== undefined) {
        const o = {};
        for (const f of fields) {
          if (f.t === 'multi') { o[f.n] = [...m.querySelectorAll(`[name=${f.n}]:checked`)].map(x => x.value); continue; }
          const v = m.querySelector(`[name=${f.n}]`).value;
          o[f.n] = f.t === 'number' ? Math.max(0, parseInt(v) || 0) : v.trim();
        }
        m.remove(); res(o);
      }
    };
  });
}

async function guard(p) { try { return await p; } catch (e) { toast('Operazione non consentita: ' + (e.message || '')); } }
const me = () => S.players[uid];
const vit = p => ({ hm: p.hpMax ?? 50, nm: p.nxMax ?? 1000, h: Math.min(p.hpMax ?? 50, p.hp ?? 50), n: Math.min(p.nxMax ?? 1000, p.nx ?? 1000) });
const bar = (v, m, c) => `<div class="vbar ${c}"><i style="width:${m ? Math.max(0, Math.min(100, v / m * 100)) : 0}%"></i><span>${v} / ${m}</span></div>`;

/* MAP SYSTEM WITH MASTER CUSTOMIZATION & DRAWING */
const MAP_TYPES = [['terra', '🌍 Terre'], ['isola', '🏝️ Isola'], ['dungeon', '🏰 Dungeon'], ['caverna', '🕳️ Caverna'], ['villaggio', '🏘️ Villaggio']];
const MAP_DEF = { terra: { water: 45, mount: 35, forest: 50 }, isola: { water: 55, mount: 30, forest: 45 }, dungeon: { rooms: 12, rsize: 8 }, caverna: { dens: 45 }, villaggio: { houses: 14, trees: 40 } };
let MAPCFG = { type: 'terra', seed: 'nexus', size: 48, grid: true, customTiles: {} };
let activeTool = 'tree';

const TOOL_MAP = {
  clear: 0, tree: 4, house: 5, mount: 6, water: 3, road: 2, treasure: 8
};

function render() {
  syncTheme(); updateStatus();
  const v = view.name, M = masterOK && v === 'master';
  $('#mbtn').style.display = M ? 'none' : 'block';
  if (!db) { app.innerHTML = `<div class="card"><h2>Dati non raggiungibili</h2><p class="mut">Controlla js/config.js e la connessione.</p></div>`; return; }
  autoLogin();
  if (M) { renderMaster(); return; }
  if (!authed || !me()) return renderSplash();
  if (v === 'npc') return renderNpc();
  if (v === 'home') renderHome(); else renderBoard();
}

function renderSplash() {
  app.innerHTML = `<div class="lock">
    <div class="lk-clock"><b class="gtime"></b><span class="gdate"></span></div>
    <div class="lk-center">
      <div class="lk-avatar"><div class="dropwrap"><button class="drop" id="drop">${DROP}</button></div></div>
      <h1>NEXUS CONNECTION</h1>
      <div class="lk-hint">Tocca la goccia per entrare</div>
    </div>
    <div class="lk-foot">POKÉGEAR OS v3.5</div>
  </div>`;
  $('#drop').onclick = authSheet;
}

function authSheet() {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div style="text-align:center"><div style="font-size:2.8em">🩸</div><h3>Accedi a Nexus Connection</h3><button style="width:100%;margin:6px 0" data-n>🩸 Nuovo Player</button><button class="g" style="width:100%;margin:6px 0" data-a>🔑 Accedi</button></div>`;
  document.body.append(m);
  m.onclick = e => {
    if (e.target.dataset.n !== undefined) { m.remove(); register(); }
    else if (e.target.dataset.a !== undefined) { m.remove(); loginPlayer(); }
    else if (e.target === m) m.remove();
  };
}

const TILES = [['profile', '👤', 'Profilo'], ['ego', '⚡', 'EGO'], ['npcs', '🧙', 'NPC'], ['quests', '📜', 'Quest'], ['party', '🏕️', 'Party'], ['inv', '🎒', 'Borsa'], ['msgs', '✉️', 'Messaggi'], ['map', '🗺️', 'Mappe']];
const tilesHtml = () => `<div class="tiles">${TILES.map(([k, i, l]) => `<button class="tile" data-go="${k}"><span>${i}</span>${l}</button>`).join('')}</div>`;

function renderHome() {
  const p = me(), v = vit(p);
  app.innerHTML = `<div class="bar"><h2>🏠 Home</h2><button class="g" id="out">⎋ Esci</button></div>
  <div class="card">
    <h2>${esc(p.username)}</h2>
    <div class="row" style="margin-top:6px"><span class="pill">💶 Euro: ${p.currency}</span><span class="pill">🩸 Gruppo: ${p.blood || '—'}</span></div>
    <div class="mut" style="margin-top:10px">❤️ HP</div>${bar(v.h, v.hm, 'hp')}
    <div class="mut">🔷 NEXUS</div>${bar(v.n, v.nm, 'nx')}
  </div>${tilesHtml()}`;
  bindEvents();
}

function renderBoard() {
  const p = me(), v = view.name; let body = '';
  if (v === 'map') body = mapBoard(false);
  else body = `<div class="bar"><button class="g" id="bk">‹ Indietro</button><h2>${v.toUpperCase()}</h2></div><div class="card"><p class="mut">Sezione in aggiornamento per Pokégear OS.</p></div>`;
  app.innerHTML = body; bindEvents();
  if (v === 'map') mapInit();
}

function mapBoard(isMasterView) {
  const maps = Object.values(S.maps || {}).filter(m => isMasterView || !(m.to && m.to.length) || m.to.includes(uid));
  return `<div class="bar"><button class="g" id="bk">‹ Indietro</button>2<h2>🗺️ Mappe Pokégear</h2></div>
  <div class="card">
    <canvas id="mapcv" class="mapcv"></canvas>
    ${isMasterView ? `
    <div class="mut" style="margin-top:8px"><b>Pannello Strumenti Master Add-On:</b> Seleziona e clicca sulla mappa per modificare</div>
    <div class="map-tools">
      <button class="map-tool-btn sel" data-tool="tree">🌲 Albero</button>
      <button class="map-tool-btn" data-tool="house">🏠 Casa</button>
      <button class="map-tool-btn" data-tool="mount">⛰️ Montagna</button>
      <button class="map-tool-btn" data-tool="water">🌊 Acqua</button>
      <button class="map-tool-btn" data-tool="road">🛤️ Strada</button>
      <button class="map-tool-btn" data-tool="treasure">👑 Tesoro</button>
      <button class="map-tool-btn" data-tool="clear">🧹 Cancella</button>
    </div>` : ''}
    <div class="row" style="margin-top:10px;flex-wrap:wrap">
      ${isMasterView ? `<button id="mapsave">💾 Salva / Assegna Mappa</button>` : ''}
      <button class="g" id="mapnew">🎲 Rigenera</button>
    </div>
  </div>
  ${isMasterView ? `
  <div class="card">
    <h3>Impostazioni Forma e Dettagli</h3>
    <div class="chips">${MAP_TYPES.map(([k, l]) => `<button class="chipb ${MAPCFG.type === k ? 'sel' : ''}" data-mt="${k}">${l}</button>`).join('')}</div>
    <div class="row" style="margin-top:10px">
      <div class="grow"><label class="mut">Dimensione</label>
        <select id="mapsize">${[24, 32, 48, 64].map(s => `<option value="${s}" ${MAPCFG.size === s ? 'selected' : ''}>${s}x${s}</option>`).join('')}</select>
      </div>
    </div>
  </div>` : ''}
  <div class="card">
    <h3>Mappe Disponibili</h3>
    ${maps.map(m => `<div class="row sp" style="margin:6px 0"><b>${esc(m.name)}</b><button class="mini" data-openmap="${m.id}">Carica</button></div>`).join('') || '<p class="mut">Nessuna mappa salvata.</p>'}
  </div>`;
}

function mapInit() {
  const cv = document.getElementById('mapcv'); if (!cv) return;
  const ctx = cv.getContext('2d'), n = MAPCFG.size, Z = Math.max(4, Math.floor(480 / n));
  cv.width = cv.height = n * Z;

  function draw() {
    ctx.fillStyle = '#2d6a4f'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const key = `${x},${y}`; const tile = MAPCFG.customTiles[key];
        if (tile !== undefined) {
          ctx.fillStyle = tile === 4 ? '#1b4332' : tile === 5 ? '#dda15e' : tile === 6 ? '#6c757d' : tile === 3 ? '#0077b6' : tile === 2 ? '#bc6c25' : tile === 8 ? '#ffb703' : '#2d6a4f';
          ctx.fillRect(x * Z, y * Z, Z, Z);
        } else if (MAPCFG.grid) {
          ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.strokeRect(x * Z, y * Z, Z, Z);
        }
      }
    }
  }
  draw();

  cv.onclick = e => {
    const rect = cv.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (rect.width / n));
    const y = Math.floor((e.clientY - rect.top) / (rect.height / n));
    MAPCFG.customTiles[`${x},${y}`] = TOOL_MAP[activeTool];
    draw();
  };

  document.querySelectorAll('.map-tool-btn').forEach(b => b.onclick = () => {
    document.querySelectorAll('.map-tool-btn').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel'); activeTool = b.dataset.tool;
  });

  const sv = $('#mapsave');
  if (sv) sv.onclick = async () => {
    const r = await ask('Salva Mappa', [
      { l: 'Nome Mappa', n: 'name' },
      { l: 'Assegna a Player (Vuoto = Tutti)', n: 'to', t: 'multi', o: Object.entries(S.players).map(([i, p]) => [i, p.username]) }
    ]);
    if (r && r.name) {
      const id = Math.random().toString(36).slice(2, 10);
      await guard(db.collection('maps').doc(id).set({ id, name: r.name, cfg: MAPCFG, to: r.to, ts: Date.now() }));
      toast('Mappa salvata con successo!');
    }
  };

  document.querySelectorAll('[data-openmap]').forEach(b => b.onclick = () => {
    const m = S.maps[b.dataset.openmap];
    if (m) { MAPCFG = m.cfg; mapInit(); toast('Mappa ' + m.name + ' caricata'); }
  });
}

function bindEvents() {
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { view = { name: b.dataset.go }; render(); });
  const bk = $('#bk'); if (bk) bk.onclick = () => { view = { name: 'home' }; render(); };
  const out = $('#out'); if (out) out.onclick = () => { authed = false; view = { name: 'splash' }; render(); };
}

function renderMaster() {
  app.innerHTML = `<div class="bar"><h2>🔑 Master Panel Pokégear</h2><button class="g" id="exM">Esci</button></div>
  <div class="card">${mapBoard(true)}</div>`;
  $('#exM').onclick = () => { masterOK = false; view = { name: 'home' }; render(); };
  mapInit();
}

function updateStatus() {
  const w = $('#win-title'); if (w) w.textContent = masterOK ? 'NEXUS MASTER OS' : (me() ? me().username + ' - GEAR' : 'NEXUS CONNECTION');
}
function syncTheme() {}
function autoLogin() {}

function tick() {
  const d = new Date(), t = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const c = $('#tb-clock'); if (c) c.textContent = t;
}
setInterval(tick, 10000); tick();

$('#mbtn').onclick = async () => {
  if (masterOK) { view = { name: 'master' }; return render(); }
  const r = await ask('Login Master', [{ l: 'Email', n: 'email' }, { l: 'Password', n: 'pw', t: 'password' }]);
  if (r && r.email.toLowerCase() === String(NX.MASTER_EMAIL || '').toLowerCase() && r.pw === NX.MASTER_PASSWORD) {
    masterOK = true; view = { name: 'master' }; render();
  } else toast('Credenziali Master Errate');
};

async function boot() {
  render();
  try {
    const c = window.claude; if (!c) return;
    [db, user, assets] = await Promise.all([c.use('db'), c.use('user'), c.use('assets')]);
    if (!db || !user) return;
    uid = await user.id(); isMaster = !!user.canEdit?.();
    for (const k of ['players', 'npcs', 'items', 'quests', 'party', 'msgs', 'maps'])
      db.collection(k).onSnapshot(s => { S[k] = {}; s.docs.forEach(d => S[k][d.id] = d.data()); render(); });
  } catch (e) { console.warn(e); }
}
boot();
