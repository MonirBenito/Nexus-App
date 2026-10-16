/* NEXUS CONNECTION - logica dell'app */
const NX=window.NX_CONFIG||{};
const $=s=>document.querySelector(s), app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db,user,assets,uid,isMaster=false,masterOK=false,authed=false,cred=null,S={players:{},npcs:{},items:{},quests:{},party:{},msgs:{},maps:{}},view={name:'splash'},tab='players';
const DROP=`<svg viewBox="0 0 100 130" width="100%" height="100%"><defs><radialGradient id="g" cx="35%" cy="40%"><stop offset="0" stop-color="#ff4d5a"/><stop offset="1" stop-color="#8a0c16"/></radialGradient></defs><path d="M50 4C50 4 8 58 8 84a42 42 0 0 0 84 0C92 58 50 4 50 4Z" fill="url(#g)"/><ellipse cx="34" cy="86" rx="7" ry="15" fill="#fff" opacity=".25" transform="rotate(20 34 86)"/></svg>`;
const lvl=p=>1+Math.floor((p.xp||0)/100);
function toast(t){const e=document.createElement('div');e.className='toast';e.textContent=t;document.body.append(e);setTimeout(()=>e.remove(),2200)}

/* ---- form modale generica ---- */
function ask(title,fields,init={}){return new Promise(res=>{
  const m=document.createElement('div');m.className='modal';
  m.innerHTML=`<div><h3>${esc(title)}</h3>${fields.map(f=>`<label class="mut">${esc(f.l)}</label>`+(f.t==='select'?`<select name="${f.n}">${f.o.map(o=>`<option ${init[f.n]==o?'selected':''}>${o}</option>`).join('')}</select>`:f.t==='area'?`<textarea name="${f.n}" rows="3">${esc(init[f.n])}</textarea>`:`<input name="${f.n}" type="${f.t||'text'}" value="${esc(init[f.n])}">`)).join('')}
  <div class="row"><button class="g grow" data-x>Annulla</button><button class="grow" data-ok>Salva</button></div></div>`;
  document.body.append(m);
  m.onclick=e=>{if(e.target.dataset.x!==undefined||e.target===m){m.remove();res(null)}
    if(e.target.dataset.ok!==undefined){const o={};for(const f of fields){const v=m.querySelector(`[name=${f.n}]`).value;o[f.n]=f.t==='number'?Math.max(0,parseInt(v)||0):v.trim()}m.remove();res(o)}};
})}

/* ---- dati ---- */
async function guard(p){try{return await p}catch(e){toast('Operazione non consentita'+(e.message?': '+e.message:''));console.warn(e)}}
const me=()=>S.players[uid];

async function hash(pw,salt){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+pw));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const credDoc=()=>db.collection('data/users/'+uid).doc('cred');
async function register(){ // tap sulla goccia = registrazione con credenziali
  const r=await ask('Registrati',[{l:'Username',n:'username'},{l:'Email',n:'email',t:'email'},{l:'Password (min. 8 caratteri)',n:'pw',t:'password'}]);
  if(!r)return;
  if(r.username.length<3)return toast('Username troppo corto');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email))return toast('Email non valida');
  if(r.pw.length<8)return toast('Password troppo corta');
  const salt=uid8()+uid8(),h=await hash(r.pw,salt),c={email:r.email.toLowerCase(),salt,hash:h};
  if(!(await guard(credDoc().set(c).then(()=>1))))return;
  cred=c;
  const d=db.collection('players').doc(uid);
  await guard(me()?d.update({username:r.username.slice(0,32)}):d.set({username:r.username.slice(0,32),currency:100,blood:'Non indicato',ego:'',skills:[],history:[],created:Date.now()}));
  authed=true;toast('Benvenuto!');render();
}
async function loginPlayer(){
  const r=await ask('Accedi',[{l:'Email',n:'email',t:'email'},{l:'Password',n:'pw',t:'password'}]);
  if(!r)return;
  if(r.email.toLowerCase()===cred.email&&await hash(r.pw,cred.salt)===cred.hash){authed=true;render()}else toast('Credenziali errate');
}
async function redeem(it){
  const p=me(); if(!p||p.currency<it.price)return toast('Fondi insufficienti');
  if(it.stock!=null&&it.stock<=0)return toast('Esaurito');
  const xp=(p.xp||0)+(it.rtype==='xp'?it.amount:0), cur=p.currency-it.price+(it.rtype==='currency'?it.amount:0);
  const history=[{n:it.name,p:it.price,t:Date.now()},...(p.history||[])].slice(0,30);
  await guard(db.collection('players').doc(uid).update({currency:cur,xp,level:1+Math.floor(xp/100),history,...(it.rtype==='currency'?{}:{inv:[...(p.inv||[]),{id:uid8(),it:it.id,name:it.name,cat:it.cat||'oggetto',photo:it.photo||'',desc:it.desc||'',uses:it.use==='utilizzabile'?it.uses:null,bonus:it.bonus||null}]})}));
  if(it.stock!=null)try{await db.collection('items').doc(it.id).update({stock:it.stock-1})}catch(e){}
  toast('Riscattato: '+it.name);
}

/* ---- viste ---- */
function render(){
  const v=view.name;
  $('#mbtn').style.display=(v==='master'&&masterOK)?'none':'block';
  if(!db){app.innerHTML=`<div class="splash"><h2>Dati non raggiungibili</h2><p class="mut">Connessione ai dati non disponibile. Controlla js/config.js e la connessione a internet.</p></div>`;return}
  if(v==='master'&&masterOK)return renderMaster();
  if(!authed||!me())return renderSplash();
  if(v==='npc')return renderNpc();
  renderHome();
}
function renderSplash(){
  const reg=!cred;
  app.innerHTML=`<div class="splash"><h1 style="letter-spacing:2px">NEXUS CONNECTION</h1><button class="drop" id="drop" aria-label="Entra">${DROP}</button><div style="color:var(--acc2);font-weight:700">${reg?'Tocca la goccia per registrarti':'Tocca la goccia per accedere'}</div></div>`;
  $('#drop').onclick=()=>reg?register():loginPlayer();
}
function renderHome(){
  const p=me(), npcs=Object.values(S.npcs).filter(n=>n.active!==false);
  app.innerHTML=`<div class="bar"><h2>${esc(p.username)}</h2><div class="row"><button class="g" id="ren">✎</button><button class="g" id="out">⎋</button></div></div>
  <div class="card stats"><div><b>${lvl(p)}</b><span class="mut">Livello</span></div><div><b>${p.xp||0}</b><span class="mut">XP</span></div><div><b>${p.currency}</b><span class="mut">Monete</span></div></div>
  <h3>NPC</h3>${npcs.map(n=>`<div class="card row" data-npc="${n.id}" style="cursor:pointer"><div class="avatar">${n.photo?`<img class="avatar" src="${esc(n.photo)}">`:'🩸'}</div><div class="grow"><b>${esc(n.name)}</b><div class="mut">${esc(n.desc)}</div></div>›</div>`).join('')||'<p class="mut">Nessun NPC disponibile.</p>'}
  <h3>Ultimi riscatti</h3>${(p.history||[]).slice(0,5).map(h=>`<div class="mut">${esc(h.n)} · −${h.p}</div>`).join('')||'<p class="mut">Nessun riscatto.</p>'}`;
  app.querySelectorAll('[data-npc]').forEach(e=>e.onclick=()=>{view={name:'npc',id:e.dataset.npc};render()});
  $('#ren').onclick=async()=>{const r=await ask('Il tuo nome',[{l:'Username',n:'username'}],p);if(r&&r.username.length>=3)guard(db.collection('players').doc(uid).update({username:r.username.slice(0,32)}))};
  $('#out').onclick=()=>{authed=false;render()};
}
function renderNpc(){
  const n=S.npcs[view.id],p=me(); if(!n){view={name:'home'};return render()}
  const its=Object.values(S.items).filter(i=>i.npc===n.id&&i.active!==false);
  app.innerHTML=`<button class="g" id="bk">‹ Indietro</button><div class="card row"><div class="avatar">${n.photo?`<img class="avatar" src="${esc(n.photo)}">`:'🩸'}</div><div><h2>${esc(n.name)}</h2><div class="mut">${esc(n.desc)}</div></div></div>
  <div class="mut">Le tue monete: <b>${p.currency}</b></div><h3>Shop</h3>
  ${its.map(i=>`<div class="card row sp"><div><b>${esc(i.name)}</b> <span class="tag">${esc(i.rtype)}${i.rtype!=='item'?' +'+i.amount:''}</span><div class="mut">${i.stock!=null?'Scorte: '+i.stock:'Illimitato'}</div></div><button data-r="${i.id}" ${p.currency<i.price||i.stock===0?'disabled':''}>${i.price} 🩸</button></div>`).join('')||'<p class="mut">Questo NPC non vende nulla.</p>'}`;
  $('#bk').onclick=()=>{view={name:'home'};render()};
  app.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>redeem(S.items[b.dataset.r]));
}

/* ---- pannello Master ---- */
const uid8=()=>Math.random().toString(36).slice(2,10);
function renderMaster(){
  let body='';
  if(tab==='players')body=Object.entries(S.players).map(([id,p])=>`<div class="card"><div class="row sp"><b>${esc(p.username)}</b><span class="tag">Lv ${lvl(p)} · ${p.xp||0}xp · ${p.currency}🩸</span></div><div class="row" style="margin-top:8px"><button class="g grow" data-pe="${id}">Modifica</button><button class="d" data-pd="${id}">Elimina</button></div></div>`).join('')||'<p class="mut">Nessun player registrato.</p>';
  if(tab==='npcs')body=`<button id="addN" style="width:100%">+ Nuovo NPC</button>`+Object.values(S.npcs).map(n=>`<div class="card"><div class="row"><div class="avatar">${n.photo?`<img class="avatar" src="${esc(n.photo)}">`:'🩸'}</div><div class="grow"><b>${esc(n.name)}</b> ${n.active===false?'<span class="tag">nascosto</span>':''}<div class="mut">${esc(n.desc)}</div></div></div><div class="row" style="margin-top:8px"><button class="g grow" data-ne="${n.id}">Modifica</button><button class="g" data-np="${n.id}">📷</button><button class="d" data-nd="${n.id}">✕</button></div></div>`).join('');
  if(tab==='shop')body=Object.values(S.npcs).map(n=>`<div class="card"><div class="row sp"><b>${esc(n.name)}</b><button data-ia="${n.id}">+ Oggetto</button></div>${Object.values(S.items).filter(i=>i.npc===n.id).map(i=>`<div class="row sp" style="margin-top:8px"><div>${esc(i.name)} <span class="tag">${i.price}🩸 · ${esc(i.rtype)}${i.rtype!=='item'?' +'+i.amount:''} · ${i.stock!=null?i.stock:'∞'}</span></div><div class="row"><button class="g" data-ie="${i.id}">✎</button><button class="d" data-id="${i.id}">✕</button></div></div>`).join('')}</div>`).join('')||'<p class="mut">Crea prima un NPC.</p>';
  app.innerHTML=`<div class="bar"><h2>Pannello Master</h2><button class="g" id="ex">Esci</button></div><div class="tabs">${['players','npcs','shop'].map(t=>`<button class="${tab===t?'on':''}" data-t="${t}">${{players:'Player',npcs:'NPC',shop:'Shop'}[t]}</button>`).join('')}</div>${body}`;
  $('#ex').onclick=()=>{masterOK=false;view={name:'home'};render()};
  app.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{tab=b.dataset.t;render()});
  const on=(a,fn)=>app.querySelectorAll(`[data-${a}]`).forEach(b=>b.onclick=()=>fn(b.dataset[a]));
  const C=n=>db.collection(n);
  on('pe',async id=>{const p=S.players[id],r=await ask('Player',[{l:'Username',n:'username'},{l:'XP',n:'xp',t:'number'},{l:'Monete',n:'currency',t:'number'}],p);if(r)guard(C('players').doc(id).update({username:r.username||p.username,xp:r.xp,currency:r.currency,level:1+Math.floor(r.xp/100)}))});
  on('pd',id=>{if(confirm('Eliminare il player?'))guard(C('players').doc(id).delete())});
  const npcF=[{l:'Nome',n:'name'},{l:'Descrizione',n:'desc',t:'area'},{l:'Visibile',n:'vis',t:'select',o:['sì','no']}];
  if($('#addN'))$('#addN').onclick=async()=>{const r=await ask('Nuovo NPC',npcF,{vis:'sì'});if(r&&r.name){const id=uid8();guard(C('npcs').doc(id).set({id,name:r.name,desc:r.desc,active:r.vis==='sì',photo:''}))}};
  on('ne',async id=>{const n=S.npcs[id],r=await ask('Modifica NPC',npcF,{...n,vis:n.active===false?'no':'sì'});if(r&&r.name)guard(C('npcs').doc(id).update({name:r.name,desc:r.desc,active:r.vis==='sì'}))});
  on('nd',id=>{if(confirm('Eliminare NPC e il suo shop?')){Object.values(S.items).filter(i=>i.npc===id).forEach(i=>C('items').doc(i.id).delete());guard(C('npcs').doc(id).delete())}});
  on('np',id=>{const f=document.createElement('input');f.type='file';f.accept='image/jpeg,image/png,image/webp';f.onchange=async()=>{const file=f.files[0];if(!file)return;if(!assets)return toast('Upload non disponibile');if(file.size>2e6)return toast('Max 2 MB');const a=await guard(assets.upload(file));if(a)guard(C('npcs').doc(id).update({photo:a.url}))};f.click()});
  const itF=[{l:'Nome',n:'name'},{l:'Prezzo',n:'price',t:'number'},{l:'Ricompensa',n:'rtype',t:'select',o:['item','currency','xp']},{l:'Quantità ricompensa (monete/xp)',n:'amount',t:'number'},{l:'Scorte (0 = illimitato)',n:'stock',t:'number'}];
  const itSave=r=>({name:r.name,price:r.price,rtype:r.rtype,amount:r.amount,stock:r.stock>0?r.stock:null});
  on('ia',async nid=>{const r=await ask('Nuovo oggetto',itF,{rtype:'item'});if(r&&r.name){const id=uid8();guard(C('items').doc(id).set({id,npc:nid,active:true,...itSave(r)}))}});
  on('ie',async id=>{const i=S.items[id],r=await ask('Modifica oggetto',itF,{...i,stock:i.stock??0});if(r&&r.name)guard(C('items').doc(id).update(itSave(r)))});
  on('id',id=>{if(confirm('Eliminare l\'oggetto?'))guard(C('items').doc(id).delete())});
}

/* ---- avvio ---- */
async function boot(){
  render();
  try{
    const c=window.claude; if(!c)return;
    [db,user,assets]=await Promise.all([c.use('db'),c.use('user'),c.use('assets')]);
    if(!db||!user)return render();
    uid=await user.id();cuid=uid; isMaster=!!user.canEdit?.();
    try{const s=await credDoc().get();cred=s.exists?s.data():null}catch(e){cred=null}
    for(const k of ['players','npcs','items','quests','party','msgs','maps'])
      db.collection(k).onSnapshot(s=>{S[k]={};s.docs.forEach(d=>S[k][d.id]=d.data());LD[k]=1;render()},e=>console.warn(k,e));
    render();
  }catch(e){console.warn(e);render()}
}
/* ===== v2: bacheche ===== */
tab=null;
const TILES=[['profile','👤','Profilo'],['ego','⚡','EGO'],['npcs','🧙','NPC'],['quests','📜','Quest'],['party','🏕️','Party'],['inv','🎒','Inventario'],['msgs','✉️','Messaggi'],['map','🗺️','Mappa']];
const KIND={mercante:'🛒 Mercante',combattente:'⚔️ Combattente'},kindOf=n=>n.kind||'mercante';
const tiles=()=>{const M=masterOK&&view.name==='master';return `<div class="tiles">${TILES.filter(t=>!(M&&t[0]==='inv')).map(([k,i,l])=>{if(M&&k==='profile'){i='👥';l='Player'}return `<button class="tile" data-go="${k}"><span>${i}</span>${l}${badge(k,M)}</button>`}).join('')}</div>`};
const BLOODS=['Non indicato','A+','A-','B+','B-','AB+','AB-','0+','0-'];
const TR=[['vigore','VIGORE'],['agilita','AGILITÀ'],['acume','ACUME'],['panache','PANACHE'],['nexus','NEXUS']];
const AB=[['mira','Mira'],['rissa','Rissa'],['mischia','Mischia'],['convincere','Convincere'],['intimidire','Intimidire'],['atletica','Atletica'],['velocita','Velocità'],['furtivita','Furtività'],['notare','Notare'],['istruzione','Istruzione'],['concentrazione','Concentrazione'],['empatia','Empatia'],['creativita','Creatività']];
const trOf=p=>({...Object.fromEntries(TR.map(([k])=>[k,2])),...(p.traits||{})});
const abOf=p=>({...Object.fromEntries(AB.map(([k])=>[k,0])),...(p.abilities||{})});
const egoOf=p=>p.ego&&typeof p.ego==='object'?p.ego:{t:'',e:p.ego||''};
const egoHtml=p=>{const g=egoOf(p);return g.t||g.e?`<b style="font-size:1.2em;display:block;margin-top:4px">${esc(g.t)}</b><div class="mut" style="margin-top:6px">Effetto</div><p style="white-space:pre-wrap;margin:2px 0">${esc(g.e)}</p>`:'<span class="mut">Scrivi qui il potere del tuo personaggio.</span>'};
const traitsHtml=p=>{const t=trOf(p),pts=p.points||0;return `<div class="card" style="border-color:var(--acc3)"><div class="row sp"><h3 style="color:var(--acc3)">🧬 TRATTI</h3><span class="tag">Punti: ${pts}</span></div>${TR.map(([k,l])=>`<div class="row sp" style="margin-top:8px"><b>${l}</b><div class="row"><span style="letter-spacing:2px;color:var(--acc2)">${'●'.repeat(t[k])}${'○'.repeat(Math.max(0,5-t[k]))}</span><button data-tr="${k}" ${pts<1||t[k]>=5?'disabled':''}>+</button></div></div>`).join('')}</div>`};
const abHtml=p=>{const a=abOf(p);return `<div class="card"><h3>🎯 ABILITÀ</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px">${AB.map(([k,l])=>`<div class="row sp"><span>${l}</span><b style="color:var(--acc)">${a[k]}</b></div>`).join('')}</div></div>`};
const statsCard=p=>`<div class="card stats" style="grid-template-columns:repeat(2,1fr)"><div><b style="color:var(--ok)">💶 ${p.currency}</b><span class="mut">Euro</span></div><div><b style="color:var(--red2)">${p.blood&&p.blood!=='Non indicato'?esc(p.blood):'—'}</b><span class="mut">Gruppo sanguigno</span></div></div>`;
const av=n=>`<div class="avatar">${n.photo?`<img class="avatar" src="${esc(n.photo)}">`:'🩸'}</div>`;
const hdr=(t,back)=>`<div class="bar"><div class="row">${back?'<button class="g" id="bk">‹</button>':''}<h2>${t}</h2></div><div class="row">${masterOK&&view.name==='master'?'':'<button class="g" id="thm" title="Tema colore">🎨</button>'}<button class="g" id="out">${masterOK&&view.name==='master'?'Esci':'⎋'}</button></div></div>`;
function ask(title,fields,init={}){return new Promise(res=>{
 const m=document.createElement('div');m.className='modal';
 const inp=f=>f.t==='select'?`<select name="${f.n}">${f.o.filter(o=>o!=='xp').map(o=>`<option ${init[f.n]==o?'selected':''}>${o}</option>`).join('')}</select>`:f.t==='area'?`<textarea name="${f.n}" rows="3">${esc(init[f.n])}</textarea>`:f.t==='file'?`<input name="${f.n}" type="file" accept="image/jpeg,image/png,image/webp">`:f.t==='multi'?(f.o.length?f.o.map(([v,l])=>`<label class="row" style="margin:6px 0"><input type="checkbox" name="${f.n}" value="${esc(v)}" style="width:auto;margin:0" ${(init[f.n]||[]).includes(v)?'checked':''}>${esc(l)}</label>`).join(''):'<p class="mut">Nessun player registrato.</p>'):`<input name="${f.n}" type="${f.t||'text'}" value="${esc(init[f.n])}">`;
 m.innerHTML=`<div><h3>${esc(title)}</h3>${fields.map(f=>`<label class="mut">${esc(f.l.replace('(monete/xp)','(Euro)'))}</label>`+inp(f)).join('')}<div class="row"><button class="g grow" data-x>Annulla</button><button class="grow" data-ok>Salva</button></div></div>`;
 document.body.append(m);
 m.onclick=e=>{if(e.target.dataset.x!==undefined||e.target===m){m.remove();res(null)}
  if(e.target.dataset.ok!==undefined){const o={};for(const f of fields){if(f.t==='file'){o[f.n]=m.querySelector(`[name=${f.n}]`).files[0]||null;continue}if(f.t==='multi'){o[f.n]=[...m.querySelectorAll(`[name=${f.n}]:checked`)].map(x=>x.value);continue}const v=m.querySelector(`[name=${f.n}]`).value;o[f.n]=f.t==='number'?Math.max(0,parseInt(v)||0):v.trim()}m.remove();res(o)}};
})}
function render(){
  syncTheme();updateStatus();
  const v=view.name,M=masterOK&&v==='master';
  $('#mbtn').style.display=M?'none':'block';
  if(!db){app.innerHTML=`<div class="splash"><h2>Dati non raggiungibili</h2><p class="mut">Connessione ai dati non disponibile. Controlla js/config.js e la connessione a internet.</p></div>`;return}
  autoLogin();if(M){renderMaster();rebindItems();rebindDel();rebindMP();rebindV9();return}
  if(!authed||!me())return renderSplash();
  if(v==='npc')return renderNpc();
  (v==='home'?renderHome():renderBoard());checkEnc();checkQ();checkM();rebindDel();rebindV9();
}
function bind(){
  const th=$('#thm');if(th)th.onclick=themePicker;
  app.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{if(masterOK&&view.name==='master')tab=b.dataset.go;else view={name:b.dataset.go};render()});
  const o=$('#out');if(o)o.onclick=()=>{if(masterOK&&view.name==='master'){masterOK=false;view={name:'home'}}else{authed=false;view={name:'home'};try{localStorage.removeItem('nx_pid')}catch(e){}}render()};
  const k=$('#bk');if(k)k.onclick=()=>{if(masterOK&&view.name==='master')tab=null;else view={name:view.name==='npc'?'npcs':'home'};render()};
}
function renderHome(){const p=me();app.innerHTML=hdr('🏠 Home')+homeCard(p)+tiles();bind()}
function renderBoard(){
  const p=me(),v=view.name;let b='';
  if(v==='profile')b=profileHtml(p);else if(0)b=hdr('👤 Profilo',1)+`<div class="card"><div class="row sp"><b>${esc(p.username)}</b><button class="g" id="ren">✎</button></div></div>`+statsCard(p)+`<div class="card"><label class="mut">🩸 Gruppo sanguigno</label><select id="bld" style="margin-bottom:0">${BLOODS.map(o=>`<option ${p.blood===o?'selected':''}>${o}</option>`).join('')}</select></div><div class="card" style="border:2px solid var(--acc2)"><div class="row sp"><h3 style="color:var(--acc2)">⚡ EGO</h3><button class="g" id="egoE">✎</button></div>${egoHtml(p)}</div>${traitsHtml(p)}${abHtml(p)}<div class="card" style="border-color:var(--acc)"><div class="row sp"><h3 style="color:var(--acc)">🗡️ SKILL</h3><button id="skA">+ Mossa</button></div>${(p.skills||[]).map((s,i)=>`<div class="row sp" style="margin-top:10px"><div><b>${esc(s.n)}</b><div class="mut" style="white-space:pre-wrap">${esc(s.d)}</div></div><button class="d" data-sk="${i}">✕</button></div>`).join('')||'<p class="mut">Nessuna mossa per ora.</p>'}</div><h3>Ultimi riscatti</h3>`+((p.history||[]).slice(0,5).map(h=>`<div class="mut">${esc(h.n)} · −${h.p}</div>`).join('')||'<p class="mut">Nessun riscatto.</p>');
  if(v==='npcs')b=hdr('🧙 NPC',1)+(Object.values(S.npcs).filter(visN).map(n=>`<div class="card row" data-npc="${n.id}" style="cursor:pointer">${av(n)}<div class="grow"><b>${esc(n.name)}</b> <span class="tag">${KIND[kindOf(n)]}</span> <span class="tag" style="color:${attOf(n).c}">${attOf(n).i} ${attOf(n).l}</span><div class="mut">${esc(n.desc)}</div></div>›</div>`).join('')||'<p class="mut">Nessun NPC disponibile.</p>');
  if(v==='ego')b=egoBoard(p);if(v==='map')b=mapBoard(false);if(v==='inv')b=invBoard(p);if(v==='msgs')b=msgBoard(p);if(v==='party')b=partyBoard2(p);if(v==='quests')b=questBoard();else if(0)b=hdr('📜 Quest',1)+(Object.values(S.quests).filter(q=>!(q.to&&q.to.length)||q.to.includes(uid)).map(q=>`<div class="card"><b>${esc(q.title)}</b><div class="row" style="margin-top:6px"><span class="tag">+${q.coins||0} 💶</span></div></div>`).join('')||'<p class="mut">Nessuna quest per te al momento.</p>');
  app.innerHTML=b;bind();
  app.querySelectorAll('[data-npc]').forEach(e=>e.onclick=()=>{view={name:'npc',id:e.dataset.npc};render()});
  const U=d=>guard(db.collection('players').doc(uid).update(d));
  if($('#bld'))$('#bld').onchange=e=>U({blood:e.target.value});
  if($('#egoE'))$('#egoE').onclick=async()=>{const g=egoOf(p),r=await ask('EGO',[{l:'Titolo',n:'t'},{l:'Effetto',n:'e',t:'area'}],g);if(r)U({ego:{t:r.t.slice(0,80),e:r.e.slice(0,1500)}})};
  app.querySelectorAll('[data-tr]').forEach(x=>x.onclick=()=>{const t=trOf(p),k=x.dataset.tr;if((p.points||0)<1||t[k]>=5)return;U({traits:{...t,[k]:t[k]+1},points:p.points-1})});
  app.querySelectorAll('[data-ab]').forEach(x=>x.onclick=()=>{const a=abOf(p),k=x.dataset.ab;if((p.pointsAb||0)<1)return;U({abilities:{...a,[k]:a[k]+1},pointsAb:p.pointsAb-1})});
  app.querySelectorAll('[data-use]').forEach(x=>x.onclick=()=>{const inv=[...(p.inv||[])],i=inv.findIndex(e=>e.id===x.dataset.use);if(i<0||inv[i].uses==null)return;const e=inv[i];if(e.uses<=1)inv.splice(i,1);else inv[i]={...e,uses:e.uses-1};U({inv});toast('Usato: '+e.name)});
  const vi=vit(p);
  app.querySelectorAll('[data-hp]').forEach(x=>x.onclick=()=>U({hp:Math.max(0,Math.min(vi.hm,vi.h+(+x.dataset.hp)))}));
  app.querySelectorAll('[data-hpc]').forEach(x=>x.onclick=()=>{const v=Math.abs(parseInt($('#hpc').value)||0);if(v)U({hp:Math.max(0,Math.min(vi.hm,vi.h+v*(+x.dataset.hpc)))})});
  app.querySelectorAll('[data-nx]').forEach(x=>x.onclick=()=>U({nx:Math.max(0,Math.min(vi.nm,vi.n+(+x.dataset.nx)))}));
  app.querySelectorAll('[data-nxc]').forEach(x=>x.onclick=()=>{const v=Math.abs(parseInt($('#nxc').value)||0);if(v)U({nx:Math.max(0,Math.min(vi.nm,vi.n+v*(+x.dataset.nxc)))})});
  if($('#pdE'))$('#pdE').onclick=async()=>{const r=await ask('La tua descrizione nel party',[{l:'Descrizione',n:'pdesc',t:'area'}],p);if(r)U({pdesc:r.pdesc.slice(0,600)})};
  app.querySelectorAll('[data-send]').forEach(x=>x.onclick=()=>sendMoney(x.dataset.send));
  app.querySelectorAll('[data-it]').forEach(x=>x.onclick=()=>{invTab=x.dataset.it;render()});
  const skD=r=>({n:r.n.slice(0,60),c:r.c,e:r.e.slice(0,600),dmg:r.dmg.slice(0,60),dur:r.dur.slice(0,60)});
  if($('#skA'))$('#skA').onclick=async()=>{const r=await ask('Nuova skill',SKF,{c:0});if(r&&r.n)U({skills:[...(p.skills||[]),skD(r)]})};
  app.querySelectorAll('[data-se]').forEach(x=>x.onclick=async()=>{const i=+x.dataset.se,s=(p.skills||[])[i];if(!s)return;const r=await ask('Modifica skill',SKF,{...s,e:s.e??s.d??''});if(r&&r.n){const l=[...p.skills];l[i]=skD(r);U({skills:l})}});
  app.querySelectorAll('[data-su]').forEach(x=>x.onclick=()=>{const s=(p.skills||[])[+x.dataset.su];if(!s)return;const v=vit(p),c=s.c||0;if(v.n<c)return toast('NEXUS insufficiente');U({nx:v.n-c});toast('⚡ '+s.n+' usata: −'+c+' NEXUS')});
  app.querySelectorAll('[data-sk]').forEach(x=>x.onclick=()=>{if(confirm('Rimuovere la skill?'))U({skills:(p.skills||[]).filter((_,i)=>i!==+x.dataset.sk)})});
  if($('#ren'))$('#ren').onclick=async()=>{const r=await ask('Il tuo nome',[{l:'Username',n:'username'}],p);if(r&&r.username.length>=3)guard(db.collection('players').doc(uid).update({username:r.username.slice(0,32)}))};
}
function renderNpc(){
  const n=S.npcs[view.id],p=me();if(!n){view={name:'npcs'};return render()}
  const its=Object.values(S.items).filter(i=>i.npc===n.id&&i.active!==false),m=kindOf(n)==='mercante';
  app.innerHTML=hdr(esc(n.name),1)+`<div class="card row">${av(n)}<div><span class="tag">${KIND[kindOf(n)]}</span><div class="mut">${esc(n.desc)}</div></div></div>`+(m?`<div class="mut">I tuoi Euro: <b>💶 ${p.currency}</b></div><h3>Shop</h3>`+(its.map(i=>`<div class="card row sp"><div><b>${esc(i.name)}</b> <span class="tag">${esc(i.rtype)}${i.rtype!=='item'?' +'+i.amount:''}</span><div class="mut">${i.stock!=null?'Scorte: '+i.stock:'Illimitato'}</div></div><button data-r="${i.id}" ${p.currency<i.price||i.stock===0?'disabled':''}>💶 ${i.price}</button></div>`).join('')||'<p class="mut">Questo mercante non vende nulla.</p>'):'<p class="mut">Nessuna azione disponibile per ora.</p>');
  bind();app.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>redeem(S.items[b.dataset.r]));
}
function renderMaster(){
  const C=n=>db.collection(n);let b='';
  if(!tab)b=hdr('Pannello Master')+tiles();
  if(tab==='profile')b=(editing&&selP&&S.players[selP])?editScreen():masterPlayers();else if(0)b=hdr('👥 Player',1)+(Object.entries(S.players).map(([id,p])=>`<div class="card"><div class="row sp"><b>${esc(p.username)}</b><span class="tag">💶 ${p.currency} · ${esc(p.blood||'—')} · ${p.points||0} PT · ${p.pointsAb||0} PA · ❤️${vit(p).h}/${vit(p).hm} 🔷${vit(p).n}/${vit(p).nm}</span></div><div class="row" style="margin-top:8px"><button class="g grow" data-pe="${id}">Modifica</button><button class="g" data-pa="${id}">Abilità</button><button class="d" data-pd="${id}">Elimina</button></div></div>`).join('')||'<p class="mut">Nessun player registrato.</p>');
  if(tab==='npcs')b=hdr('🧙 NPC',1)+`<button id="addN" style="width:100%">+ Nuovo NPC</button>`+Object.values(S.npcs).map(n=>`<div class="card"><div class="row">${av(n)}<div class="grow"><b>${esc(n.name)}</b> <span class="tag">${KIND[kindOf(n)]}</span> <span class="tag" style="color:${attOf(n).c}">${attOf(n).i} ${attOf(n).l}</span> ${n.active===false?'<span class="tag">nascosto</span>':''}<div class="mut">${esc(n.desc)}</div><div class="mut">👁 ${n.to&&n.to.length?n.to.map(i=>esc(S.players[i]?.username||'?')).join(', '):'Tutti i player'}</div></div></div><div class="row" style="margin-top:8px"><button class="g grow" data-ne="${n.id}">Modifica</button><button class="g" data-np="${n.id}">📷</button><button class="d" data-nd="${n.id}">✕</button></div>${kindOf(n)==='mercante'?`<div class="row sp" style="margin-top:12px"><b>Shop</b><button data-ia="${n.id}">+ Oggetto</button></div>`+Object.values(S.items).filter(i=>i.npc===n.id).map(i=>`<div class="row sp" style="margin-top:8px"><div>${esc(i.name)} <span class="tag">💶${i.price} · ${esc(i.rtype)}${i.rtype!=='item'?' +'+i.amount:''} · ${i.stock!=null?i.stock:'∞'}</span></div><div class="row"><button class="g" data-ie="${i.id}">✎</button><button class="d" data-id="${i.id}">✕</button></div></div>`).join(''):''}</div>`).join('');
  if(tab==='quests')b=hdr('📜 Quest',1)+`<button id="addQ" style="width:100%">+ Nuova quest</button>`+Object.values(S.quests).map(q=>`<div class="card">${questCard(q)}<div class="mut">Per: ${q.to&&q.to.length?q.to.map(i=>esc(S.players[i]?.username||'?')).join(', '):'tutti i player'}</div><div class="row" style="margin-top:8px;flex-wrap:wrap">${qAllDone(q)?'':`<button class="grow" data-qc="${q.id}">✅ Completata</button>`}${(q.doneBy||[]).length?`<button class="g grow" data-qo="${q.id}">↩ Riapri</button>`:''}<button class="g" data-qe="${q.id}">Modifica</button><button class="d" data-qd="${q.id}">✕</button></div></div>`).join('');
  if(tab==='party')b=masterParty();else if(0){const ids=(S.party.main&&S.party.main.members)||[];b=hdr('🏕️ Party',1)+`<button id="pmem" style="width:100%">Gestisci membri</button>`+(ids.filter(i=>S.players[i]).map(i=>memCard(S.players[i],false)).join('')||'<p class="mut">Nessun membro nel party.</p>')}
  if(tab==='msgs')b=masterMsgs();
  if(tab==='map')b=mapBoard(true);
  if(tab==='ego')b=hdr('⚡ EGO',1)+(Object.values(S.players).map(p=>{const g=egoOf(p);return `<div class="ego" style="animation:none"><b>${esc(p.username)}</b>${g.t||g.e?`<div class="et">${esc(g.t)}</div><p style="white-space:pre-wrap;margin:4px 0">${esc(g.e)}</p>`:'<p class="mut">Nessun EGO scritto.</p>'}</div>`}).join('')||'<p class="mut">Nessun player registrato.</p>');
  app.innerHTML=b;bind();
  const on=(a,fn)=>app.querySelectorAll(`[data-${a}]`).forEach(x=>x.onclick=()=>fn(x.dataset[a]));
  on('pe',async id=>{const p=S.players[id],t=trOf(p),r=await ask('Player',[{l:'Username',n:'username'},{l:'Euro',n:'currency',t:'number'},{l:'Gruppo sanguigno',n:'blood',t:'select',o:BLOODS},{l:'Punti tratti',n:'points',t:'number'},{l:'Punti abilità',n:'pointsAb',t:'number'},{l:'HP massimi',n:'hpMax',t:'number'},{l:'HP attuali',n:'hp',t:'number'},{l:'NEXUS massimo',n:'nxMax',t:'number'},{l:'NEXUS attuale',n:'nx',t:'number'},...TR.map(([k,l])=>({l:l+' (valore)',n:k,t:'number'}))],{...p,points:p.points||0,pointsAb:p.pointsAb||0,...t,hpMax:vit(p).hm,hp:vit(p).h,nxMax:vit(p).nm,nx:vit(p).n});if(r)guard(C('players').doc(id).update({username:r.username||p.username,currency:r.currency,blood:r.blood,points:r.points,pointsAb:r.pointsAb,hpMax:r.hpMax,hp:Math.min(r.hp,r.hpMax),nxMax:r.nxMax,nx:Math.min(r.nx,r.nxMax),traits:Object.fromEntries(TR.map(([k])=>[k,Math.min(99,r[k])]))}))});
  on('pa',async id=>{const p=S.players[id],r=await ask('Abilità',AB.map(([k,l])=>({l,n:k,t:'number'})),abOf(p));if(r)guard(C('players').doc(id).update({abilities:Object.fromEntries(AB.map(([k])=>[k,Math.min(99,r[k])]))}))});
  on('pd',id=>{if(confirm('Eliminare il player?'))guard(C('players').doc(id).delete())});
  const npcF=()=>[{l:'Nome',n:'name'},{l:'Descrizione',n:'desc',t:'area'},{l:'Frasi di approccio (una per riga: se ce ne sono più di una, ne esce una a caso)',n:'keys',t:'area'},{l:'Tipo',n:'kind',t:'select',o:['mercante','combattente']},{l:'Atteggiamento',n:'att',t:'select',o:['neutrale','ostile','buono']},{l:'Visibile',n:'vis',t:'select',o:['sì','no']},{l:'Chi lo vede (nessuno selezionato = tutti i player)',n:'to',t:'multi',o:Object.entries(S.players).map(([i,p])=>[i,p.username])},{l:'Foto (max 2 MB)',n:'photo',t:'file'}];
  const upl=async f=>{if(!f)return '';if(!assets){toast('Upload non disponibile');return ''}if(f.size>2e6){toast('Foto oltre 2 MB');return ''}const a=await guard(assets.upload(f));return a?a.url:''};
  if($('#addN'))$('#addN').onclick=async()=>{const r=await ask('Nuovo NPC',npcF(),{kind:'mercante',vis:'sì',to:[]});if(r&&r.name){const id=uid8(),photo=await upl(r.photo);guard(C('npcs').doc(id).set({id,name:r.name,desc:r.desc,kind:r.kind,att:r.att,keys:splitL(r.keys),active:r.vis==='sì',photo,to:r.to}))}};
  on('ne',async id=>{const n=S.npcs[id],r=await ask('Modifica NPC',npcF(),{...n,keys:(n.keys||[]).join('\n'),kind:kindOf(n),vis:n.active===false?'no':'sì'});if(r&&r.name){const ph=r.photo?await upl(r.photo):'';guard(C('npcs').doc(id).update({name:r.name,desc:r.desc,kind:r.kind,att:r.att,keys:splitL(r.keys),active:r.vis==='sì',to:r.to,...(ph?{photo:ph}:{})}))}});
  on('nd',id=>{if(confirm('Eliminare NPC e il suo shop?')){Object.values(S.items).filter(i=>i.npc===id).forEach(i=>C('items').doc(i.id).delete());guard(C('npcs').doc(id).delete())}});
  on('np',id=>{const f=document.createElement('input');f.type='file';f.accept='image/jpeg,image/png,image/webp';f.onchange=async()=>{const file=f.files[0];if(!file)return;if(!assets)return toast('Upload non disponibile');if(file.size>2e6)return toast('Max 2 MB');const a=await guard(assets.upload(file));if(a)guard(C('npcs').doc(id).update({photo:a.url}))};f.click()});
  const itF=[{l:'Nome',n:'name'},{l:'Prezzo',n:'price',t:'number'},{l:'Ricompensa',n:'rtype',t:'select',o:['item','currency','xp']},{l:'Quantità ricompensa (monete/xp)',n:'amount',t:'number'},{l:'Scorte (0 = illimitato)',n:'stock',t:'number'}];
  const itSave=r=>({name:r.name,price:r.price,rtype:r.rtype,amount:r.amount,stock:r.stock>0?r.stock:null});
  on('ia',async nid=>{const r=await ask('Nuovo oggetto',itF,{rtype:'item'});if(r&&r.name){const id=uid8();guard(C('items').doc(id).set({id,npc:nid,active:true,...itSave(r)}))}});
  on('ie',async id=>{const i=S.items[id],r=await ask('Modifica oggetto',itF,{...i,stock:i.stock??0});if(r&&r.name)guard(C('items').doc(id).update(itSave(r)))});
  on('id',id=>{if(confirm('Eliminare l\'oggetto?'))guard(C('items').doc(id).delete())});
  const qF=()=>[{l:'Titolo',n:'title'},{l:'Tipo',n:'qt',t:'select',o:['principale','secondaria']},{l:'Obiettivi (uno per riga)',n:'objs',t:'area'},{l:'Tempo limite (scrivi quello che vuoi, vuoto se non cè)',n:'dl'},{l:'Ricompensa: Euro',n:'coins',t:'number'},{l:'Ricompensa extra (testo, opzionale)',n:'rw'},{l:'Visibile a (nessuno selezionato = tutti)',n:'to',t:'multi',o:Object.entries(S.players).map(([i,p])=>[i,p.username])}];
  if($('#addQ'))$('#addQ').onclick=async()=>{const r=await ask('Nuova quest',qF(),{qt:'secondaria'});if(r&&r.title){const id=uid8();guard(C('quests').doc(id).set({id,...qData(r)}))}};
  on('qe',async id=>{const q=S.quests[id],r=await ask('Modifica quest',qF(),{...q,qt:q.qt||'secondaria',objs:(q.objs||[]).join('\n'),dl:dlStr(q.dl)});if(r&&r.title)guard(C('quests').doc(id).update(qData(r)))});
  on('qd',id=>{if(confirm('Eliminare la quest?'))guard(C('quests').doc(id).delete())});
  on('qc',async id=>{
    const q=S.quests[id];if(!q)return;
    const done=q.doneBy||[],all=qRec(q),todo=all.filter(i=>!done.includes(i)),coins=Math.max(0,+q.coins||0);
    if(!todo.length)return toast('Nessun player a cui assegnarla');
    const r=await ask('✅ Quest completata',[{l:'Chi l ha completata (riceve '+(coins?'💶 '+coins:'la ricompensa')+')',n:'who',t:'multi',o:todo.map(i=>[i,S.players[i].username])}],{who:todo});
    if(!r)return;
    const who=(r.who||[]).filter(i=>S.players[i]&&!done.includes(i));
    if(!who.length)return toast('Nessun player selezionato');
    const ts=Date.now(),extra=q.rw?' — Extra: '+q.rw:'',txt='Quest completata: «'+q.title+'»'+extra,nd=[...done,...who];
    await Promise.all(who.map(async pid=>{
      if(coins>0)await guard(C('players').doc(pid).update({currency:(S.players[pid].currency||0)+coins}));
      const mid=uid8(),base={id:mid,to:[pid],from:{t:'sys',name:'SISTEMA'},text:txt,ts};
      await guard(C('msgs').doc(mid).set(coins>0?{...base,kind:'money',v:coins}:{...base,kind:'msg'}));
    }));
    await guard(C('quests').doc(id).update({done:qAllDone({...q,doneBy:nd}),doneAt:ts,doneBy:nd}));
    toast('✅ Completata'+(coins?' · 💶 '+coins+' a '+who.length+' player':'')+(q.rw?' · extra da consegnare: '+q.rw:''));
  });
  on('qo',id=>{if(confirm('Riaprire la quest? Le ricompense già date NON vengono tolte: completandola di nuovo verranno date ancora.'))guard(C('quests').doc(id).update({done:false,doneBy:[],doneAt:null}))});
  if($('#pmem'))$('#pmem').onclick=async()=>{const ids=(S.party.main&&S.party.main.members)||[],r=await ask('Membri del party',[{l:'Chi fa parte del party',n:'m',t:'multi',o:Object.entries(S.players).map(([i,p])=>[i,p.username])}],{m:ids});if(r)guard(C('party').doc('main').set({members:r.m}))};
}
/* ===== v3: profilo, incontri, shop ===== */
const LD={},visN=n=>n.active!==false&&(!(n.to&&n.to.length)||n.to.includes(uid));
const profileHtml=p=>{
  const t=trOf(p),a=abOf(p),pT=p.points||0,pA=p.pointsAb||0,g=egoOf(p),md=modOf(p),COL=Array(5).fill('var(--acc)');
  return hdr('👤 Profilo',1)+
  `<div class="hero"><div class="grow"><div class="row sp"><h2 style="margin:0">${esc(p.username)}</h2><button class="g" id="ren">✎</button></div><div class="row" style="margin-top:8px;flex-wrap:wrap"><span class="pill eu">💶 ${p.currency}</span><span class="pill bl">🩸 ${p.blood&&p.blood!=='Non indicato'?esc(p.blood):'—'}</span></div></div></div>`+
  vitalsHtml(p)+woundCard(p,false)+`<div class="card"><label class="mut">Gruppo sanguigno</label><select id="bld" style="margin-bottom:0">${BLOODS.map(o=>`<option ${p.blood===o?'selected':''}>${o}</option>`).join('')}</select></div>`+
  (0?`<div class="ego"><div class="row sp"><span class="lab">⚡ EGO</span><button class="g" id="egoE">✎</button></div>${g.t||g.e?`<div class="et">${esc(g.t)}</div><div class="mut" style="margin-top:8px">EFFETTO</div><p style="white-space:pre-wrap;margin:2px 0">${esc(g.e)}</p>`:'<p class="mut">Scrivi qui il potere del tuo personaggio.</p>'}</div>`:'')+
  `<div class="card"><div class="row sp"><h3>🧬 TRATTI</h3><span class="pill">Punti tratti: ${pT}</span></div>${TR.map(([k,l],i)=>`<div style="margin-top:12px"><div class="row sp"><b>${l}</b><div class="row"><b style="color:${COL[i]}">${t[k]}${t[k]<=5?'/5':''}${md.tr[k]?` <span style="color:var(--ok)">+${md.tr[k]}</span>`:''}</b><button class="mini" data-tr="${k}" ${pT<1||t[k]>=5?'disabled':''}>+</button></div></div><div class="meter"><i style="width:${Math.min(100,t[k]*20)}%;background:${COL[i]}"></i></div></div>`).join('')}</div>`+
  `<div class="card"><div class="row sp"><h3>🎯 ABILITÀ</h3><span class="pill">Punti abilità: ${pA}</span></div><div class="abg">${AB.map(([k,l])=>`<div class="chip"><span>${l}</span><div class="row" style="gap:6px"><b>${a[k]}${md.ab[k]?`<span style="color:var(--ok)">+${md.ab[k]}</span>`:''}</b><button class="mini" data-ab="${k}" ${pA<1?'disabled':''}>+</button></div></div>`).join('')}</div></div>`+
  `<div class="card"><div class="row sp"><h3>🗡️ SKILL</h3><button id="skA">+ Mossa</button></div>${(p.skills||[]).map((s,i)=>skillCard(s,i,p)).join('')||'<p class="mut">Nessuna mossa per ora.</p>'}</div>`+
  `<h3>Ultimi acquisti</h3>`+((p.history||[]).slice(0,5).map(h=>`<div class="mut">${esc(h.n)} · −💶 ${h.p}</div>`).join('')||'<p class="mut">Nessun acquisto.</p>');
};
let encOpen=false;
function checkEnc(){
  const p=me();if(!p||!authed||encOpen||!LD.npcs||!LD.players)return;
  const vis=Object.values(S.npcs).filter(visN),seen=p.seen;
  if(!Array.isArray(seen)){guard(db.collection('players').doc(uid).update({seen:vis.map(n=>n.id)}));return}
  const n=vis.find(x=>!seen.includes(x.id));if(!n)return;
  encOpen=true;
  const m=document.createElement('div');m.className='modal';
  m.innerHTML=`<div style="text-align:center"><div class="mut" style="letter-spacing:4px">⚠ ⚠ ⚠</div><h2 class="newenc">NUOVO INCONTRO</h2><div class="encav">${n.photo?`<img src="${esc(n.photo)}">`:'🩸'}</div><h3>${esc(n.name)}</h3><div class="mut">${KIND[kindOf(n)]}</div><div class="row" style="margin-top:14px"><button class="g grow" data-c>Più tardi</button><button class="grow" data-i>Ispeziona</button></div></div>`;
  document.body.append(m);
  const done=async go=>{m.remove();encOpen=false;await guard(db.collection('players').doc(uid).update({seen:[...seen,n.id]}));if(go){view={name:'npc',id:n.id};render()}};
  m.onclick=e=>{if(e.target.dataset.c!==undefined)done(0);if(e.target.dataset.i!==undefined)done(1)};
}
async function buy(it,n){
  const p=me(),ok=await new Promise(res=>{const m=document.createElement('div');m.className='modal';m.innerHTML=`<div style="text-align:center"><div style="font-size:3em">${it.rtype==='currency'?'💶':'🎁'}</div><h3>${esc(it.name)}</h3><div class="mut">Prezzo: 💶 ${it.price} · Ti resteranno: 💶 ${p.currency-it.price}</div><div class="row" style="margin-top:14px"><button class="g grow" data-n>Annulla</button><button class="grow" data-y>Acquista</button></div></div>`;document.body.append(m);m.onclick=e=>{if(e.target.dataset.n!==undefined){m.remove();res(0)}if(e.target.dataset.y!==undefined){m.remove();res(1)}}});
  if(ok)redeem(it);
}
function renderNpc(){
  const n=S.npcs[view.id],p=me();if(!n||!visN(n)){view={name:'npcs'};return render()}
  const m=kindOf(n)==='mercante',its=Object.values(S.items).filter(i=>i.npc===n.id&&i.active!==false);
  app.innerHTML=hdr(esc(n.name),1)+`<div class="hero npc"><div class="portrait">${n.photo?`<img src="${esc(n.photo)}">`:'🩸'}</div><div><span class="pill">${KIND[kindOf(n)]}</span> <span class="pill" style="color:${attOf(n).c};border-color:${attOf(n).c}">${attOf(n).i} ${attOf(n).l}</span><div style="margin-top:8px;white-space:pre-wrap">${esc(n.desc)}</div></div></div>`+phraseHtml(n)+(m?`<div class="wallet"><span>PORTAFOGLIO</span><b>💶 ${p.currency}</b></div><h3>🛒 Bottega di ${esc(n.name)}</h3><div class="shopgrid">${its.map(i=>{const out=i.stock===0,poor=p.currency<i.price;return `<div class="item ${out?'out':''}"><div class="ico">${i.photo?`<img src="${esc(i.photo)}" style="width:72px;height:72px;object-fit:cover;border-radius:12px">`:CATI[i.cat||'oggetto']}</div><b>${esc(i.name)}</b><span class="tag">${CATI[i.cat||'oggetto']} ${CATL[i.cat||'oggetto']}</span>${i.rtype==='currency'?`<div class="mut">Ricevi 💶 ${i.amount}</div>`:''}<div class="mut">${i.stock!=null?(out?'ESAURITO':'Scorte: '+i.stock):'Sempre disponibile'}</div><button data-r="${i.id}" ${out||poor?'disabled':''}>💶 ${i.price}</button>${poor&&!out?'<div class="mut" style="font-size:.75em">Euro insufficienti</div>':''}</div>`}).join('')||'<p class="mut">La bottega è vuota.</p>'}</div>`:'<div class="card"><h3>⚔️ Combattente</h3><p class="mut">Nessuna azione disponibile per ora.</p></div>');
  bind();app.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>buy(S.items[b.dataset.r],n));
}
/* ===== v4: oggetti, atteggiamenti, EGO ===== */
const ATT={buono:{i:'💚',c:'#1f8f5f',l:'Buono',s:'Sembra amichevole: puoi avvicinarti.'},neutrale:{i:'⚖️',c:'#b78103',l:'Neutrale',s:'Non sai ancora cosa aspettarti.'},ostile:{i:'💀',c:'#d02f3a',l:'Ostile',s:'Attenzione: è pericoloso!'}};
const attOf=n=>ATT[n.att]||ATT.neutrale;
const CATI={oggetto:'🎁',arma:'⚔️',armatura:'🛡️'},CATL={oggetto:'Oggetto',arma:'Arma',armatura:'Armatura'};
const BK={};TR.forEach(([k,l])=>BK[l]={t:'tr',k});AB.forEach(([k,l])=>BK[l]={t:'ab',k});
const bonusLabel=b=>b?((b.t==='tr'?TR:AB).find(x=>x[0]===b.k)||[0,'?'])[1]:'nessuno';
const modOf=p=>{const m={tr:{},ab:{}};(p.inv||[]).forEach(e=>{if(e.bonus&&(e.uses==null||e.uses>0))m[e.bonus.t][e.bonus.k]=(m[e.bonus.t][e.bonus.k]||0)+e.bonus.v});return m};
const uploadPhoto=async f=>{if(!assets){toast('Upload non disponibile');return ''}if(f.size>2e6){toast('Foto oltre 2 MB');return ''}const a=await guard(assets.upload(f));return a?a.url:''};
const invHtml=p=>`<div class="card"><h3>🎒 INVENTARIO</h3>${(p.inv||[]).map(e=>`<div class="move" style="border-left-color:var(--acc2)"><div style="font-size:1.6em">${e.photo?`<img src="${esc(e.photo)}" style="width:44px;height:44px;object-fit:cover;border-radius:8px">`:(CATI[e.cat]||'🎁')}</div><div class="grow"><b>${esc(e.name)}</b><div class="mut">${CATL[e.cat]||'Oggetto'} · ${e.uses==null?'♾ Infinito':e.uses+(e.uses===1?' uso':' usi')}${e.bonus?` · <span style="color:var(--ok)">+${e.bonus.v} ${esc(bonusLabel(e.bonus))}</span>`:''}</div></div>${e.uses!=null?`<button class="mini" data-use="${e.id}">Usa</button>`:''}</div>`).join('')||'<p class="mut">Inventario vuoto.</p>'}</div>`;
const egoBoard=p=>{const g=egoOf(p);return hdr('⚡ EGO',1)+`<div class="ego big"><div class="row sp"><span class="lab">IL POTERE DEL PERSONAGGIO</span><button class="g" id="egoE">✎</button></div>${g.t||g.e?`<div class="et" style="font-size:2em;text-align:center;margin:18px 0">${esc(g.t)}</div><div class="mut" style="letter-spacing:3px">EFFETTO</div><p style="white-space:pre-wrap;font-size:1.05em;margin:6px 0">${esc(g.e)}</p>`:'<p class="mut" style="margin:40px 0;text-align:center">Nessun EGO scritto.<br>Tocca ✎ per definire il tuo potere.</p>'}</div>`};
const ITF=()=>[{l:'Nome',n:'name'},{l:'Prezzo (Euro)',n:'price',t:'number'},{l:'Tipo',n:'cat',t:'select',o:['oggetto','arma','armatura']},{l:'Foto (max 2 MB)',n:'photo',t:'file'},{l:'Cosa dice il mercante (descrizione)',n:'desc',t:'area'},{l:'Utilizzo',n:'use',t:'select',o:['infinito','utilizzabile']},{l:'Numero di usi (solo se utilizzabile)',n:'uses',t:'number'},{l:'Bonus alle statistiche',n:'bk',t:'select',o:['nessuno',...TR.map(t=>t[1]),...AB.map(a=>a[1])]},{l:'Valore del bonus',n:'bv',t:'number'},{l:'Scorte (0 = illimitate)',n:'stock',t:'number'}];
async function itData(r,old){const b=BK[r.bk],o={name:r.name,price:r.price,cat:r.cat,desc:r.desc,use:r.use,uses:r.use==='utilizzabile'?Math.max(1,r.uses):0,bonus:b&&r.bv>0?{t:b.t,k:b.k,v:r.bv}:null,stock:r.stock>0?r.stock:null};if(r.photo){const u=await uploadPhoto(r.photo);if(u)o.photo=u}else if(!old)o.photo='';return o}
function rebindItems(){
  const IT=db.collection('items');
  app.querySelectorAll('[data-ia]').forEach(b=>b.onclick=async()=>{const r=await ask('Nuovo oggetto',ITF(),{cat:'oggetto',use:'infinito',bk:'nessuno'});if(r&&r.name){const id=uid8();guard(IT.doc(id).set({id,npc:b.dataset.ia,active:true,rtype:'item',amount:0,...await itData(r)}))}});
  app.querySelectorAll('[data-ie]').forEach(b=>b.onclick=async()=>{const id=b.dataset.ie,i=S.items[id],r=await ask('Modifica oggetto',ITF(),{...i,use:i.use||'infinito',uses:i.uses||0,bk:bonusLabel(i.bonus),bv:i.bonus?i.bonus.v:0,stock:i.stock??0});if(r&&r.name)guard(IT.doc(id).update(await itData(r,i)))});
}
function checkEnc(){
  const p=me();if(!p||!authed||encOpen||!LD.npcs||!LD.players)return;
  const vis=Object.values(S.npcs).filter(visN),seen=p.seen;
  if(!Array.isArray(seen)){guard(db.collection('players').doc(uid).update({seen:vis.map(n=>n.id)}));return}
  const n=vis.find(x=>!seen.includes(x.id));if(!n)return;
  encOpen=true;const A=attOf(n);
  const m=document.createElement('div');m.className='modal';
  m.innerHTML=`<div class="${n.att==='ostile'?'shake':''}" style="text-align:center;border:2px solid ${A.c}"><div style="letter-spacing:4px">${A.i} ${A.i} ${A.i}</div><h2 class="newenc" style="color:${A.c}">NUOVO INCONTRO</h2><div style="color:${A.c};font-weight:800;letter-spacing:3px">${A.l.toUpperCase()}</div><div class="encav" style="border-color:${A.c}">${n.photo?`<img src="${esc(n.photo)}">`:'🩸'}</div><h3>${esc(n.name)}</h3><div class="mut">${KIND[kindOf(n)]}</div><div class="mut" style="margin-top:4px">${A.s}</div><div class="row" style="margin-top:14px"><button class="g grow" data-c>Più tardi</button><button class="grow" data-i>Ispeziona</button></div></div>`;
  document.body.append(m);
  if(n.att==='ostile'&&navigator.vibrate)try{navigator.vibrate([200,100,200])}catch(e){}
  const done=async go=>{m.remove();encOpen=false;await guard(db.collection('players').doc(uid).update({seen:[...seen,n.id]}));if(go){view={name:'npc',id:n.id};render()}};
  m.onclick=e=>{if(e.target.dataset.c!==undefined)done(0);if(e.target.dataset.i!==undefined)done(1)};
}
async function buy(it,n){
  const p=me(),c=it.cat||'oggetto',b=it.bonus;
  const ok=await new Promise(res=>{const m=document.createElement('div');m.className='modal';
    m.innerHTML=`<div>${it.photo?`<img src="${esc(it.photo)}" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px">`:`<div style="font-size:3.5em;text-align:center">${CATI[c]}</div>`}<h3 style="margin-top:10px">${esc(it.name)}</h3><div class="row" style="flex-wrap:wrap;gap:6px"><span class="pill">${CATI[c]} ${CATL[c]}</span><span class="pill">${it.use==='utilizzabile'?'Utilizzabile · '+it.uses+(it.uses===1?' uso':' usi'):'♾ Infinito'}</span>${b?`<span class="pill eu">+${b.v} ${esc(bonusLabel(b))}</span>`:''}</div>${it.desc?`<div class="row" style="align-items:flex-start;margin:12px 0"><div class="portrait" style="width:56px;height:56px;border-radius:50%;font-size:1.4em">${n.photo?`<img src="${esc(n.photo)}">`:'🩸'}</div><div class="bubble"><b>${esc(n.name)}</b><div>“${esc(it.desc)}”</div></div></div>`:''}<div class="mut">Prezzo: 💶 ${it.price} · Ti resteranno: 💶 ${p.currency-it.price}</div><div class="row" style="margin-top:14px"><button class="g grow" data-n>Annulla</button><button class="grow" data-y>Acquista</button></div></div>`;
    document.body.append(m);m.onclick=e=>{if(e.target.dataset.n!==undefined){m.remove();res(0)}if(e.target.dataset.y!==undefined){m.remove();res(1)}}});
  if(ok)redeem(it);
}
/* ===== v5: quest, party, HP/NEXUS, eliminazioni ===== */
const splitL=s=>(s||'').split('\n').map(x=>x.trim()).filter(Boolean);
const qData=r=>({title:r.title,qt:r.qt,objs:splitL(r.objs),dl:r.dl||'',coins:r.coins,rw:r.rw,to:r.to});
const dlStr=t=>typeof t==='number'?(t?new Date(t).toLocaleString('it-IT'):''):(t||'');
const visQ=q=>!(q.to&&q.to.length)||q.to.includes(uid);
const remain=t=>{const d=t-Date.now();if(d<=0)return null;const m=Math.floor(d/6e4),g=Math.floor(m/1440),h=Math.floor(m%1440/60);return g?`${g}g ${h}h`:h?`${h}h ${m%60}m`:`${m}m`};
const qBadge=q=>q.qt==='principale'?'<span class="pill" style="background:var(--gold);color:#fff;border-color:var(--gold)">★ PRINCIPALE</span>':'<span class="pill">Secondaria</span>';
const qRec=q=>q.to&&q.to.length?q.to.filter(i=>S.players[i]):Object.keys(S.players);
const qAllDone=q=>{const r=qRec(q);return r.length>0&&r.every(i=>(q.doneBy||[]).includes(i))};
const questCard=q=>{const M=masterOK&&view.name==='master',dby=q.doneBy||[],dn=M?dby.length>0:dby.includes(uid),who=M?dby.map(i=>esc(S.players[i]?.username||'?')).join(', '):'',exp=false,dt=dlStr(q.dl);return `<div class="quest ${q.qt==='principale'?'main':''} ${exp?'exp':''} ${dn&&!M?'done':''}"><div class="row sp"><b style="font-size:1.1em">${esc(q.title)}</b>${qBadge(q)}</div>${(q.objs||[]).length?`<div class="mut" style="margin-top:8px;letter-spacing:2px">OBIETTIVI</div>${q.objs.map(o=>`<div class="obj">◇ ${esc(o)}</div>`).join('')}`:''}<div class="row" style="margin-top:10px;flex-wrap:wrap;gap:6px">${dn?`<span class="pill eu">✔ Completata${who?' da '+who:''}</span>`:''}<span class="pill eu">💶 +${q.coins||0}</span>${q.rw?`<span class="pill">🎁 ${esc(q.rw)}</span>`:''}${dt?`<span class="pill" style="border-color:var(--gold);color:var(--gold)">⏳ ${esc(dt)}</span>`:'<span class="pill">∞ Nessun limite</span>'}</div></div>`};
const questBoard=()=>{const qs=Object.values(S.quests).filter(visQ),isD=q=>(q.doneBy||[]).includes(uid),act=qs.filter(q=>!isD(q)),sec=(t,l)=>l.length?`<h3>${t}</h3>`+l.map(q=>questCard(q)).join(''):'';return hdr('📜 Quest',1)+(qs.length?sec('★ Principali',act.filter(q=>q.qt==='principale'))+sec('Secondarie',act.filter(q=>q.qt!=='principale'))+sec('✔ Completate',qs.filter(isD)):'<p class="mut">Nessuna quest per te al momento.</p>')};
const vit=p=>{const hm=p.hpMax??50,nm=p.nxMax??1000;return {hm,nm,h:Math.min(hm,p.hp??hm),n:Math.min(nm,p.nx??nm)}};
const bar=(v,m,c)=>`<div class="vbar ${c}"><i style="width:${m?Math.max(0,Math.min(100,v/m*100)):0}%"></i><span>${v} / ${m}</span></div>`;
const vitalsHtml=p=>{const t=vit(p),st=(a,k)=>`<div class="steps">${a.map(d=>`<button class="mini ${d<0?'d':''}" data-${k}="${d}">${d>0?'+':''}${d}</button>`).join('')}</div>`,cu=k=>`<div class="row" style="margin-top:4px"><input id="${k}c" type="number" min="0" placeholder="Quantità personalizzata" style="margin:0"><button class="d mini" data-${k}c="-1">−</button><button class="mini" data-${k}c="1">+</button></div>`;return `<div class="card"><b style="color:var(--hp)">❤️ HP</b>${bar(t.h,t.hm,'hp')}${st([-10,-5,-1,1,5,10],'hp')}${cu('hp')}<div style="height:14px"></div><b style="color:var(--nx)">🔷 NEXUS</b>${bar(t.n,t.nm,'nx')}${st([-250,-100,-50,50,100,250],'nx')}${cu('nx')}</div>`};
const memCard=(m,mine)=>{const v=vit(m);return `<div class="pcard ${mine?'me':''}"><div class="row sp"><b style="font-size:1.15em">${esc(m.username)}</b>${mine?'<button class="g mini" id="pdE">✎ Descrizione</button>':(masterOK&&view.name==='master'?'':`<button class="mini" data-send="${Object.keys(S.players).find(k=>S.players[k]===m)}">💸 Invia Euro</button>`)}</div><p class="mut" style="white-space:pre-wrap;margin:6px 0">${m.pdesc?esc(m.pdesc):'Nessuna descrizione.'}</p><div class="mut">❤️ HP</div>${bar(v.h,v.hm,'hp')}<div class="mut">🔷 NEXUS</div>${bar(v.n,v.nm,'nx')}</div>`};
const partyBoard=p=>{const ids=(S.party.main&&S.party.main.members)||[];if(!ids.includes(uid))return hdr('🏕️ Party',1)+'<div class="card"><p class="mut">Non fai ancora parte di un party.</p></div>';return hdr('🏕️ Party',1)+ids.filter(i=>S.players[i]).map(i=>memCard(S.players[i],i===uid)).join('')};
const phraseHtml=n=>{const ks=n.keys||[];if(!ks.length)return '';if(view.ph===undefined)view.ph=ks[Math.floor(Math.random()*ks.length)];return `<div class="row" style="align-items:flex-start;margin:8px 0"><div class="bubble"><b>${esc(n.name)}</b><div>“${esc(view.ph)}”</div></div></div>`};
const askYes=msg=>new Promise(res=>{const m=document.createElement('div');m.className='modal';m.innerHTML=`<div style="text-align:center"><h3>${esc(msg)}</h3><div class="row" style="margin-top:14px"><button class="g grow" data-n>Annulla</button><button class="d grow" data-y>Elimina</button></div></div>`;document.body.append(m);m.onclick=e=>{if(e.target.dataset.n!==undefined){m.remove();res(0)}if(e.target.dataset.y!==undefined){m.remove();res(1)}}});
function rebindDel(){
  const on2=(a,msg,run)=>app.querySelectorAll(`[data-${a}]`).forEach(b=>b.onclick=async()=>{if(await askYes(msg))run(b.dataset[a])});
  on2('pd','Eliminare il player?',id=>guard(db.collection('players').doc(id).delete()));
  on2('nd','Eliminare questo NPC e tutto il suo shop?',id=>{Object.values(S.items).filter(i=>i.npc===id).forEach(i=>db.collection('items').doc(i.id).delete());guard(db.collection('npcs').doc(id).delete())});
  on2('qd','Eliminare la quest?',id=>guard(db.collection('quests').doc(id).delete()));
  on2('id','Eliminare questo oggetto?',id=>guard(db.collection('items').doc(id).delete()));
  on2('sk','Rimuovere la skill?',i=>{const p=me();guard(db.collection('players').doc(uid).update({skills:(p.skills||[]).filter((_,j)=>j!==+i)}))});
  app.querySelectorAll('[data-nd]').forEach(b=>b.textContent='🗑 Elimina');
}
function checkQ(){
  const p=me();if(!p||!authed||encOpen||!LD.quests||!LD.players)return;
  const vis=Object.values(S.quests).filter(visQ),seen=p.seenQ;
  if(!Array.isArray(seen)){guard(db.collection('players').doc(uid).update({seenQ:vis.map(q=>q.id)}));return}
  const q=vis.find(x=>!seen.includes(x.id));if(!q)return;
  encOpen=true;const main=q.qt==='principale',c=main?'var(--gold)':'var(--acc)',m=document.createElement('div');m.className='modal';
  m.innerHTML=`<div style="text-align:center;border:2px solid ${c}"><div style="font-size:2.6em">📜</div><h2 class="newenc" style="color:${c}">NUOVA QUEST</h2><div style="color:${c};font-weight:800;letter-spacing:3px">${main?'★ PRINCIPALE':'SECONDARIA'}</div><h3>${esc(q.title)}</h3><div class="row" style="justify-content:center;gap:6px;flex-wrap:wrap"><span class="pill eu">💶 +${q.coins||0}</span>${dlStr(q.dl)?`<span class="pill">⏳ ${esc(dlStr(q.dl))}</span>`:''}</div><div class="row" style="margin-top:14px"><button class="g grow" data-c>Più tardi</button><button class="grow" data-i>Vedi quest</button></div></div>`;
  document.body.append(m);
  const done=async go=>{m.remove();encOpen=false;await guard(db.collection('players').doc(uid).update({seenQ:[...seen,q.id]}));if(go){view={name:'quests'};render()}};
  m.onclick=e=>{if(e.target.dataset.c!==undefined)done(0);if(e.target.dataset.i!==undefined)done(1)};
}
/* ===== v6: UI, vista Master sui player ===== */
let selP=null;
const bl=p=>p.blood&&p.blood!=='Non indicato'?esc(p.blood):'—';
const badge=(k,M)=>{let n=0;if(k==='npcs')n=Object.values(S.npcs).filter(x=>M||visN(x)).length;if(k==='quests')n=Object.values(S.quests).filter(x=>M||visQ(x)).length;if(k==='profile'&&M)n=Object.keys(S.players).length;if(k==='msgs')n=Object.values(S.msgs).filter(m=>M||!(m.to&&m.to.length)||m.to.includes(uid)).length;if(k==='map')n=Object.keys(S.maps||{}).length;return n?`<em class="bdg">${n}</em>`:''};
const homeCard=p=>{const v=vit(p);return `<div class="hero"><div class="grow"><div style="opacity:.85">Bentornato</div><h2 style="margin:0">${esc(p.username)}</h2><div class="row" style="margin-top:8px;flex-wrap:wrap"><span class="pill eu">💶 ${p.currency}</span><span class="pill bl">🩸 ${bl(p)}</span></div></div></div><div class="card"><div class="mut">❤️ HP</div>${bar(v.h,v.hm,'hp')}<div class="mut">🔷 NEXUS</div>${bar(v.n,v.nm,'nx')}</div>`};
const invRO=p=>`<div class="card"><h3>🎒 INVENTARIO</h3>${(p.inv||[]).map(e=>`<div class="move" style="border-left-color:var(--acc2)"><div style="font-size:1.6em">${e.photo?`<img src="${esc(e.photo)}" style="width:44px;height:44px;object-fit:cover;border-radius:8px">`:(CATI[e.cat]||'🎁')}</div><div class="grow"><b>${esc(e.name)}</b><div class="mut">${CATL[e.cat]||'Oggetto'} · ${e.uses==null?'♾ Infinito':e.uses+(e.uses===1?' uso':' usi')}${e.bonus?` · <span style="color:var(--ok)">+${e.bonus.v} ${esc(bonusLabel(e.bonus))}</span>`:''}</div></div></div>`).join('')||'<p class="mut">Inventario vuoto.</p>'}</div>`;
const masterPlayers=()=>{
  if(selP&&!S.players[selP])selP=null;
  if(!selP)return hdr('👥 Player',1)+(Object.entries(S.players).map(([id,p])=>{const v=vit(p);return `<div class="pcard"><div class="row sp"><b style="font-size:1.1em">${esc(p.username)}</b><div class="row" style="gap:6px"><span class="pill eu">💶 ${p.currency}</span><span class="pill bl">🩸 ${bl(p)}</span></div></div><div class="mut" style="margin-top:8px">❤️ HP</div>${bar(v.h,v.hm,'hp')}<div class="mut">🔷 NEXUS</div>${bar(v.n,v.nm,'nx')}<div class="row" style="margin-top:10px"><button class="grow" data-open="${id}">👁 Apri profilo</button><button class="g" data-pe="${id}">✎</button><button class="d" data-pd="${id}">🗑</button></div></div>`}).join('')||'<p class="mut">Nessun player registrato.</p>');
  const p=S.players[selP],t=trOf(p),v=vit(p),md=modOf(p),COLS=Array(5).fill('var(--acc)');
  return hdr('👤 '+esc(p.username),1)+
  `<div class="hero"><div class="grow"><div class="row sp"><h2 style="margin:0">${esc(p.username)}</h2><div class="row"><button class="g" data-msg="${selP}">✉️</button><button class="g" data-pe="${selP}">✎ Modifica</button><button class="d" data-pd="${selP}">🗑</button></div></div><div class="row" style="margin-top:8px;flex-wrap:wrap"><span class="pill eu">💶 ${p.currency}</span><span class="pill bl">🩸 ${bl(p)}</span><span class="pill">Punti tratti ${p.points||0}</span><span class="pill">Punti abilità ${p.pointsAb||0}</span></div></div></div>`+
  `<div class="card"><div class="mut">❤️ HP</div>${bar(v.h,v.hm,'hp')}<div class="mut">🔷 NEXUS</div>${bar(v.n,v.nm,'nx')}</div>`+
  woundCard(p,true)+`<div class="card"><h3>🧬 TRATTI</h3>${TR.map(([k,l],i)=>`<div style="margin-top:10px"><div class="row sp"><b>${l}</b><b style="color:${COLS[i]}">${t[k]}${md.tr[k]?` <span style="color:var(--ok)">+${md.tr[k]}</span>`:''}</b></div><div class="meter"><i style="width:${Math.min(100,t[k]*20)}%;background:${COLS[i]}"></i></div></div>`).join('')}</div>`+
  `<div class="card"><h3>🗡️ SKILL</h3>${(p.skills||[]).map(s=>skillCard(s,-1,null)).join('')||'<p class="mut">Nessuna skill per ora.</p>'}</div>`+invRO(p);
};
async function editPlayer(id){
  const p=S.players[id],t=trOf(p),a=abOf(p),v=vit(p);
  const r=await ask('Modifica '+p.username,[{l:'Username',n:'username'},{l:'Euro',n:'currency',t:'number'},{l:'Gruppo sanguigno',n:'blood',t:'select',o:BLOODS},{l:'Punti tratti',n:'points',t:'number'},{l:'Punti abilità',n:'pointsAb',t:'number'},{l:'HP massimi',n:'hpMax',t:'number'},{l:'HP attuali',n:'hp',t:'number'},{l:'NEXUS massimo',n:'nxMax',t:'number'},{l:'NEXUS attuale',n:'nx',t:'number'},...TR.map(([k,l])=>({l:'Tratto '+l,n:'t_'+k,t:'number'})),...AB.map(([k,l])=>({l:'Abilità '+l,n:'a_'+k,t:'number'}))],{...p,points:p.points||0,pointsAb:p.pointsAb||0,hpMax:v.hm,hp:v.h,nxMax:v.nm,nx:v.n,...Object.fromEntries(TR.map(([k])=>['t_'+k,t[k]])),...Object.fromEntries(AB.map(([k])=>['a_'+k,a[k]]))});
  if(r)guard(db.collection('players').doc(id).update({username:r.username||p.username,currency:r.currency,blood:r.blood,points:r.points,pointsAb:r.pointsAb,hpMax:r.hpMax,hp:Math.min(r.hp,r.hpMax),nxMax:r.nxMax,nx:Math.min(r.nx,r.nxMax),traits:Object.fromEntries(TR.map(([k])=>[k,Math.min(99,r['t_'+k])])),abilities:Object.fromEntries(AB.map(([k])=>[k,Math.min(99,r['a_'+k])]))}));
}
function rebindMP(){
  if(!tab)selP=null;
  const bk=$('#bk');if(bk&&tab==='profile'&&selP)bk.onclick=()=>{selP=null;render()};
  app.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{selP=b.dataset.open;render()});
  app.querySelectorAll('[data-pe]').forEach(b=>b.onclick=()=>editPlayer(b.dataset.pe));
}
/* ===== v7: inventario, messaggi, ferite, editor player ===== */
let invTab='arma',editing=false,draft={};
const PN={head:'Testa',torso:'Torso',armR:'Braccio destro',armL:'Braccio sinistro',legR:'Gamba destra',legL:'Gamba sinistra'};
const LV=['Sano','Lieve','Media','Grave'],WC=['#d3d9e6','#e0b100','#e07b1a','#d6334f'];
const PARTS=[['head','<circle cx="100" cy="38" r="26"/>'],['torso','<rect x="62" y="70" width="76" height="112" rx="20"/>'],['armR','<rect x="24" y="74" width="32" height="124" rx="16"/>'],['armL','<rect x="144" y="74" width="32" height="124" rx="16"/>'],['legR','<rect x="64" y="188" width="34" height="140" rx="17"/>'],['legL','<rect x="102" y="188" width="34" height="140" rx="17"/>']];
const sil=(w,click)=>`<svg viewBox="0 0 200 340" style="width:100%;max-width:210px;margin:0 auto;display:block">${PARTS.map(([k,s])=>`<g data-part="${k}" fill="${WC[w[k]||0]}" stroke="#5b6478" stroke-width="2" style="${click?'cursor:pointer':''}">${s}</g>`).join('')}</svg>`;
const woundCard=(p,M)=>{const w=p.wounds||{},ks=Object.keys(w).filter(k=>w[k]>0);if(!M&&!ks.length)return '';return `<div class="card"><h3>🩹 ${M?'SAGOMA':'FERITE'}</h3>${M?'<div class="mut" style="text-align:center">Tocca un arto per segnalare una ferita al player</div>':''}${sil(w,M)}<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px;justify-content:center">${ks.map(k=>`<span class="pill" style="border-color:${WC[w[k]]};color:${WC[w[k]]}">${PN[k]} · ${LV[w[k]]}</span>`).join('')||'<span class="pill eu">Nessuna ferita</span>'}</div></div>`};
const msgFrom=m=>m.from&&m.from.t==='npc'?'🧙 '+esc(m.from.name):m.from&&m.from.t==='pl'?'💸 '+esc(m.from.name):'⚙️ SISTEMA';
const msgText=m=>m.kind==='invite'?'🏕️ Invito al party «'+esc(m.text)+'»':m.kind==='ferita'?(m.lv?`🩹 ${PN[m.part]}: ferita ${LV[m.lv].toLowerCase()}`:`💚 ${PN[m.part]}: guarito`)+(m.text?' — '+esc(m.text):''):m.kind==='money'?`💶 +${m.v}`+(m.text?' — '+esc(m.text):''):esc(m.text);
const msgAv=m=>m.from&&m.from.photo?`<img class="avatar" src="${esc(m.from.photo)}">`:`<div class="avatar">${m.kind==='ferita'?'🩹':m.kind==='money'?'💶':m.from&&m.from.t==='npc'?'🧙':'⚙️'}</div>`;
const myMsgs=()=>Object.values(S.msgs).filter(m=>!(m.to&&m.to.length)||m.to.includes(uid));
const msgBoard=p=>hdr('✉️ Messaggi',1)+(myMsgs().sort((a,b)=>b.ts-a.ts).map(m=>{const c=m.kind==='ferita'?(m.lv?'var(--red2)':'var(--ok)'):m.kind==='money'?'var(--ok)':'var(--acc)';return `<div class="card" style="border-left:4px solid ${c}"><div class="row" style="gap:10px">${msgAv(m)}<div class="grow"><b>${msgFrom(m)}</b><div class="mut">${new Date(m.ts).toLocaleString('it-IT')}</div></div></div><p style="white-space:pre-wrap;margin:8px 0 0">${msgText(m)}</p></div>`}).join('')||'<p class="mut">Nessun messaggio.</p>');
const masterMsgs=()=>hdr('✉️ Messaggi',1)+'<button id="newMsg" style="width:100%">✉️ Nuovo messaggio</button>'+(Object.values(S.msgs).sort((a,b)=>b.ts-a.ts).map(m=>`<div class="card"><div class="row sp"><b>${msgFrom(m)}</b><button class="d mini" data-md="${m.id}">🗑</button></div><div class="mut">A: ${m.to&&m.to.length?m.to.map(i=>esc(S.players[i]?S.players[i].username:'?')).join(', '):'tutti i player'} · ${new Date(m.ts).toLocaleString('it-IT')}</div><p style="white-space:pre-wrap;margin:6px 0 0">${msgText(m)}</p></div>`).join('')||'<p class="mut">Nessun messaggio inviato.</p>');
const invRow=e=>`<div class="move" style="border-left-color:var(--acc2)"><div style="font-size:1.6em">${e.photo?`<img src="${esc(e.photo)}" style="width:44px;height:44px;object-fit:cover;border-radius:8px">`:(CATI[e.cat]||'🎁')}</div><div class="grow"><b>${esc(e.name)}</b><div class="mut">${e.uses==null?'♾ Infinito':e.uses+(e.uses===1?' uso':' usi')}${e.bonus?` · <span style="color:var(--ok)">+${e.bonus.v} ${esc(bonusLabel(e.bonus))}</span>`:''}</div></div>${e.uses!=null?`<button class="mini" data-use="${e.id}">Usa</button>`:''}</div>`;
const invBoard=p=>{
  const tabs=[['arma','⚔️ Armi'],['armatura','🛡️ Armature'],['oggetto','🎁 Item'],['soldi','💶 Soldi']];
  const head=hdr('🎒 Inventario',1)+`<div class="tabs">${tabs.map(([k,l])=>`<button class="${invTab===k?'on':''}" data-it="${k}">${l}</button>`).join('')}</div>`;
  if(invTab==='soldi')return head+`<div class="wallet"><span>SALDO</span><b>💶 ${p.currency}</b></div><h3>Movimenti</h3>`+((p.tx||[]).map(x=>`<div class="move" style="border-left-color:${x.t==='in'?'var(--ok)':'var(--danger)'}"><div class="grow"><b>${x.t==='in'?'Ricevuti da ':'Inviati a '}${esc(x.n)}</b><div class="mut">${new Date(x.ts).toLocaleString('it-IT')}</div></div><b style="color:${x.t==='in'?'var(--ok)':'var(--danger)'}">${x.t==='in'?'+':'−'}💶 ${x.v}</b></div>`).join('')||'<p class="mut">Nessun movimento. Puoi inviare Euro ai membri dalla bacheca Party.</p>');
  return head+`<button id="addItem" style="width:100%;margin:6px 0">+ Aggiungi ${CATL[invTab]}</button>`+((p.inv||[]).filter(e=>(e.cat||'oggetto')===invTab).map(invRow2).join('')||'<p class="mut">Nessun elemento in questa sezione.</p>');
};
async function sendMoney(toId){
  const p=me(),to=S.players[toId];if(!p||!to)return;
  const r=await ask('Invia Euro a '+to.username,[{l:'Importo (Euro)',n:'v',t:'number'},{l:'Messaggio (opzionale)',n:'note'}]);
  if(!r||r.v<1)return;if(r.v>p.currency)return toast('Euro insufficienti');
  const ts=Date.now(),id=uid8();
  await guard(db.collection('players').doc(uid).update({currency:p.currency-r.v,tx:[{t:'out',n:to.username,v:r.v,ts},...(p.tx||[])].slice(0,30)}));
  await guard(db.collection('players').doc(toId).update({currency:(to.currency||0)+r.v,tx:[{t:'in',n:p.username,v:r.v,ts},...(to.tx||[])].slice(0,30)}));
  await guard(db.collection('msgs').doc(id).set({id,to:[toId],from:{t:'pl',name:p.username},kind:'money',v:r.v,text:r.note||'',ts}));
  toast('Inviati 💶 '+r.v+' a '+to.username);
}
const stp=(f,l,a,b)=>`<div class="ed"><b>${l}</b><div class="row" style="gap:5px;margin-top:4px"><button class="g mini" data-f="${f}" data-d="${-b}">−${b}</button><button class="d mini" data-f="${f}" data-d="${-a}">−${a}</button><input type="number" data-n="${f}" value="${draft[f]}" style="margin:0;text-align:center;font-weight:800"><button class="mini" data-f="${f}" data-d="${a}">+${a}</button><button class="g mini" data-f="${f}" data-d="${b}">+${b}</button></div></div>`;
const st1=f=>`<div class="row" style="gap:4px"><button class="g mini" data-f="${f}" data-d="-1">−</button><input type="number" data-n="${f}" value="${draft[f]}" style="width:58px;margin:0;text-align:center;padding:4px"><button class="mini" data-f="${f}" data-d="1">+</button></div>`;
const editScreen=()=>{
  const d=draft,p=S.players[selP],COLS=Array(5).fill('var(--acc)');
  return hdr('✎ '+esc(p.username),1)+
  `<div class="hero"><div class="grow"><div style="opacity:.9">Username</div><input data-t="username" value="${esc(d.username)}" style="margin:4px 0 0;font-weight:700"></div></div>`+
  `<div class="card"><h3>💶 EURO</h3>${stp('currency','Saldo',10,100)}</div>`+
  `<div class="card"><h3>🩸 GRUPPO SANGUIGNO</h3><div class="chips">${BLOODS.map(o=>`<button class="chipb ${d.blood===o?'sel':''}" data-bl="${o}">${o}</button>`).join('')}</div></div>`+
  `<div class="card"><h3>❤️ HP</h3>${bar(Math.min(d.hp,d.hpMax),d.hpMax,'hp')}${stp('hp','Attuali',1,10)}${stp('hpMax','Massimi',10,50)}<div style="height:12px"></div><h3>🔷 NEXUS</h3>${bar(Math.min(d.nx,d.nxMax),d.nxMax,'nx')}${stp('nx','Attuale',50,250)}${stp('nxMax','Massimo',100,500)}</div>`+
  `<div class="card"><h3>🎟 PUNTI DA SPENDERE</h3>${stp('points','Punti tratti',1,5)}${stp('pointsAb','Punti abilità',1,5)}</div>`+
  `<div class="card"><h3>🧬 TRATTI</h3>${TR.map(([k,l],i)=>`<div class="row sp" style="margin-top:12px"><b style="color:${COLS[i]}">${l}</b>${st1('t_'+k)}</div><div class="meter"><i style="width:${Math.min(100,d['t_'+k]*20)}%;background:${COLS[i]}"></i></div>`).join('')}</div>`+
  `<div class="card"><h3>🎯 ABILITÀ</h3>${AB.map(([k,l])=>`<div class="row sp" style="margin-top:8px"><span>${l}</span>${st1('a_'+k)}</div>`).join('')}</div>`+
  `<div class="row" style="position:sticky;bottom:12px;gap:10px"><button class="g grow" data-ecancel style="background:var(--card-2)">Annulla</button><button class="grow" data-esave>💾 Salva modifiche</button></div>`;
};
function editPlayer(id){
  selP=id;const p=S.players[id],t=trOf(p),a=abOf(p),v=vit(p);
  draft={username:p.username,currency:p.currency,blood:p.blood||'Non indicato',points:p.points||0,pointsAb:p.pointsAb||0,hpMax:v.hm,hp:v.h,nxMax:v.nm,nx:v.n,...Object.fromEntries(TR.map(([k])=>['t_'+k,t[k]])),...Object.fromEntries(AB.map(([k])=>['a_'+k,a[k]]))};
  editing=true;render();
}
function saveDraft(){
  const d=draft,id=selP,p=S.players[id];
  guard(db.collection('players').doc(id).update({username:(d.username||'').trim()||p.username,currency:d.currency,blood:d.blood,points:d.points,pointsAb:d.pointsAb,hpMax:d.hpMax,hp:Math.min(d.hp,d.hpMax),nxMax:d.nxMax,nx:Math.min(d.nx,d.nxMax),traits:Object.fromEntries(TR.map(([k])=>[k,Math.min(99,d['t_'+k])])),abilities:Object.fromEntries(AB.map(([k])=>[k,Math.min(99,d['a_'+k])]))}));
  editing=false;toast('Modifiche salvate');render();
}
async function composeMsg(pre){
  const nn=Object.values(S.npcs);
  const r=await ask('✉️ Nuovo messaggio',[{l:'Da parte di',n:'from',t:'select',o:['Sistema',...nn.map(n=>n.name)]},{l:'Destinatari (nessuno selezionato = tutti)',n:'to',t:'multi',o:Object.entries(S.players).map(([i,p])=>[i,p.username])},{l:'Messaggio',n:'text',t:'area'}],{from:'Sistema',to:pre?[pre]:[]});
  if(!r||!r.text)return;
  const n=nn.find(x=>x.name===r.from),id=uid8();
  guard(db.collection('msgs').doc(id).set({id,to:r.to,from:n?{t:'npc',name:n.name,photo:n.photo||''}:{t:'sys',name:'SISTEMA'},kind:'msg',text:r.text,ts:Date.now()}));
  toast('Messaggio inviato');
}
async function woundDlg(id,part){
  const p=S.players[id],cur=(p.wounds||{})[part]||0;
  const r=await ask('🩹 '+PN[part]+' di '+p.username,[{l:'Gravità',n:'lv',t:'select',o:['lieve','media','grave','guarito']},{l:'Nota per il player (opzionale)',n:'note',t:'area'}],{lv:cur?['','lieve','media','grave'][cur]:'lieve'});
  if(!r)return;
  const lv=['guarito','lieve','media','grave'].indexOf(r.lv),mid=uid8();
  await guard(db.collection('players').doc(id).update({wounds:{...(p.wounds||{}),[part]:lv}}));
  guard(db.collection('msgs').doc(mid).set({id:mid,to:[id],from:{t:'sys',name:'SISTEMA'},kind:'ferita',part,lv,text:r.note||'',ts:Date.now()}));
  toast('Segnalato al player');
}
function rebindMP(){
  if(!tab){selP=null;editing=false}
  const bk=$('#bk');if(bk&&tab==='profile'&&selP)bk.onclick=()=>{if(editing)editing=false;else selP=null;render()};
  app.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{selP=b.dataset.open;render()});
  app.querySelectorAll('[data-pe]').forEach(b=>b.onclick=()=>editPlayer(b.dataset.pe));
  app.querySelectorAll('[data-msg]').forEach(b=>b.onclick=()=>composeMsg(b.dataset.msg));
  app.querySelectorAll('[data-part]').forEach(g=>g.onclick=()=>{if(selP)woundDlg(selP,g.dataset.part)});
  if($('#newMsg'))$('#newMsg').onclick=()=>composeMsg();
  app.querySelectorAll('[data-md]').forEach(b=>b.onclick=async()=>{if(await askYes('Eliminare il messaggio?'))guard(db.collection('msgs').doc(b.dataset.md).delete())});
  if(editing){
    const keep=fn=>()=>{const sc=document.getElementById('scr'),y=sc?sc.scrollTop:0;fn();render();if(sc)sc.scrollTop=y};
    app.querySelectorAll('[data-f]').forEach(b=>b.onclick=keep(()=>{const f=b.dataset.f;draft[f]=Math.max(0,(+draft[f]||0)+(+b.dataset.d))}));
    app.querySelectorAll('[data-n]').forEach(i=>i.onchange=keep(()=>{draft[i.dataset.n]=Math.max(0,parseInt(i.value)||0)}));
    app.querySelectorAll('[data-t]').forEach(i=>i.oninput=()=>{draft.username=i.value});
    app.querySelectorAll('[data-bl]').forEach(b=>b.onclick=keep(()=>{draft.blood=b.dataset.bl}));
    const c=$('[data-ecancel]'),s=$('[data-esave]');if(c)c.onclick=()=>{editing=false;render()};if(s)s.onclick=saveDraft;
  }
}
function checkM(){
  const p=me();if(!p||!authed||encOpen||!LD.msgs||!LD.players)return;
  const mine=myMsgs().sort((a,b)=>a.ts-b.ts),seen=p.seenM;
  if(!Array.isArray(seen)){guard(db.collection('players').doc(uid).update({seenM:mine.map(m=>m.id)}));return}
  const m=mine.find(x=>!seen.includes(x.id));if(!m)return;
  encOpen=true;const w=m.kind==='ferita',h=w&&m.lv>0,c=w?(m.lv?WC[m.lv]:'var(--ok)'):m.kind==='money'?'var(--ok)':'var(--acc)';
  const title=w?(m.lv?'SEI STATO FERITO':'FERITA GUARITA'):m.kind==='money'?'HAI RICEVUTO EURO':m.kind==='invite'?'INVITO AL PARTY':'NUOVO MESSAGGIO';
  const av=m.from&&m.from.photo?`<img src="${esc(m.from.photo)}">`:(w?'🩹':m.kind==='money'?'💶':m.kind==='invite'?'🏕️':m.from&&m.from.t==='npc'?'🧙':'⚙️');
  const el=document.createElement('div');el.className='modal';
  el.innerHTML=`<div class="${h&&m.lv>=3?'shake':''}" style="text-align:center;border:2px solid ${c}"><h2 class="newenc" style="color:${c};font-size:1.6em">${title}</h2><div class="encav" style="border-color:${c}">${av}</div><h3>${msgFrom(m)}</h3><p style="white-space:pre-wrap">${msgText(m)}</p><div class="row" style="margin-top:14px">${m.kind==='invite'?'<button class="g grow" data-c>Dopo</button><button class="d grow" data-no>Rifiuta</button><button class="grow" data-yes>Accetta</button>':'<button class="g grow" data-c>Chiudi</button><button class="grow" data-i>Apri messaggi</button>'}</div></div>`;
  document.body.append(el);
  if(h&&navigator.vibrate)try{navigator.vibrate(m.lv>=3?[300,100,300]:[150])}catch(e){}
  const done=async go=>{el.remove();encOpen=false;await guard(db.collection('players').doc(uid).update({seenM:[...seen,m.id]}));if(go){view={name:'msgs'};render()}};
  el.onclick=e=>{if(e.target.dataset.c!==undefined)done(0);if(e.target.dataset.i!==undefined)done(1);if(e.target.dataset.yes!==undefined){done(0);respondInvite(true)}if(e.target.dataset.no!==undefined){done(0);respondInvite(false)}};
}
/* ===== v8: schermata iniziale, accesso, skill ===== */
let cuid=null;
const SKF=[{l:'Nome',n:'n'},{l:'Costo NEXUS',n:'c',t:'number'},{l:'Effetto',n:'e',t:'area'},{l:'Danno',n:'dmg'},{l:'Durata',n:'dur'}];
const skillCard=(s,i,p)=>{const c=s.c||0,eff=s.e??s.d??'',ok=p&&vit(p).n>=c;return `<div class="move" style="border-left-color:var(--nx);flex-direction:column;align-items:stretch"><div class="row sp"><b style="font-size:1.05em">${esc(s.n)}</b><span class="pill" style="border-color:var(--nx);color:var(--nx)">🔷 ${c}</span></div>${eff?`<div class="mut" style="white-space:pre-wrap">${esc(eff)}</div>`:''}<div class="row" style="flex-wrap:wrap;gap:6px">${s.dmg?`<span class="pill" style="border-color:var(--danger);color:var(--danger)">💥 ${esc(s.dmg)}</span>`:''}${s.dur?`<span class="pill" style="border-color:var(--gold);color:var(--gold)">⏳ ${esc(s.dur)}</span>`:''}</div>${p?`<div class="row" style="gap:6px"><button class="grow" data-su="${i}" ${ok?'':'disabled'}>⚡ Usa</button><button class="g mini" data-se="${i}">✎</button><button class="d mini" data-sk="${i}">✕</button></div>`:''}</div>`};
function renderSplash(){
  app.innerHTML=`<div class="splash"><div style="letter-spacing:6px;opacity:.8">BENVENUTO IN</div><h1 style="letter-spacing:2px;margin:6px 0 0">NEXUS CONNECTION</h1><div class="dropwrap"><button class="drop" id="drop" aria-label="Entra">${DROP}</button></div><div style="color:var(--acc2);font-weight:700;letter-spacing:1px">Tocca la goccia per entrare</div></div>`;
  $('#drop').onclick=authSheet;
}
function authSheet(){
  const m=document.createElement('div');m.className='modal';
  m.innerHTML=`<div style="text-align:center"><div style="font-size:2.6em">🩸</div><h3>Entra in Nexus Connection</h3><button style="width:100%;margin:6px 0;padding:14px" data-n>🩸 Nuovo player<br><small style="font-weight:400">Crea un nuovo personaggio</small></button><button class="g" style="width:100%;margin:6px 0;padding:14px" data-a>🔑 Accedi<br><small style="font-weight:400">Ho già un account</small></button><button class="g mini" data-x style="margin-top:6px">Annulla</button></div>`;
  document.body.append(m);
  m.onclick=e=>{const b=e.target.closest('[data-n],[data-a],[data-x]');if(b){m.remove();if(b.dataset.n!==undefined)register();else if(b.dataset.a!==undefined)loginPlayer()}else if(e.target===m)m.remove()};
}
function enter(pid){
  if(LD.players&&!S.players[pid])return toast('Questo account non esiste più');
  uid=pid;authed=true;view={name:'home'};
  try{localStorage.setItem('nx_pid',pid)}catch(e){}
  render();
}
function autoLogin(){
  if(authed||!LD.players)return;let s=null;try{s=localStorage.getItem('nx_pid')}catch(e){}
  if(s&&S.players[s]){uid=s;authed=true;view={name:'home'}}
}
async function register(){
  const r=await ask('🩸 Nuovo player',[{l:'Username',n:'username'},{l:'Email',n:'email',t:'email'},{l:'Password',n:'pw',t:'password'}]);
  if(!r)return;
  const email=r.email.toLowerCase();
  if(r.username.length<3)return toast('Username troppo corto');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return toast('Email non valida');
  if(!r.pw)return toast('Inserisci una password');
  const key=await hash(email,'nx-email'),ad=db.collection('accounts').doc(key);
  let ex=null;try{const s=await ad.get();ex=s.exists?s.data():null}catch(e){}
  if(ex||(cred&&cred.email===email))return toast('Email già registrata: usa Accedi');
  const pid=uid8()+uid8(),salt=uid8()+uid8(),h=await hash(r.pw,salt);
  if(!(await guard(ad.set({pid,salt,hash:h}).then(()=>1))))return;
  if(!(await guard(db.collection('players').doc(pid).set({username:r.username.slice(0,32),currency:100,blood:'Non indicato',ego:'',skills:[],history:[],created:Date.now()}).then(()=>1))))return;
  uid=pid;authed=true;view={name:'home'};
  try{localStorage.setItem('nx_pid',pid)}catch(e){}
  toast('Benvenuto, '+r.username+'!');render();
}
async function loginPlayer(){
  const r=await ask('🔑 Accedi',[{l:'Email',n:'email',t:'email'},{l:'Password',n:'pw',t:'password'}]);
  if(!r)return;
  const email=r.email.toLowerCase(),key=await hash(email,'nx-email');
  let ac=null;try{const s=await db.collection('accounts').doc(key).get();ac=s.exists?s.data():null}catch(e){}
  if(ac){if(await hash(r.pw,ac.salt)===ac.hash)return enter(ac.pid);return toast('Credenziali errate')}
  if(cred&&cred.email===email&&await hash(r.pw,cred.salt)===cred.hash){
    await guard(db.collection('accounts').doc(key).set({pid:cuid,salt:cred.salt,hash:cred.hash}));
    return enter(cuid);
  }
  toast('Credenziali errate');
}
/* ===== v9: party con inviti, item personalizzati ===== */
const pm=()=>S.party.main||{};
const masterParty=()=>{const m=pm(),ids=m.members||[],inv=m.invited||[];return hdr('🏕️ '+esc(m.name||'Party'),1)+`<button id="pedit" style="width:100%">✎ Nome e membri del party</button>`+(inv.length?`<div class="card"><h3>📨 Inviti in attesa</h3><div class="row" style="flex-wrap:wrap;gap:6px">${inv.map(i=>`<span class="pill">${esc(S.players[i]?S.players[i].username:'?')}</span>`).join('')}</div></div>`:'')+(ids.filter(i=>S.players[i]).map(i=>memCard(S.players[i],false)).join('')||'<p class="mut">Nessun membro nel party.</p>')};
const partyBoard2=p=>{const m=pm(),ids=m.members||[],inv=(m.invited||[]).includes(uid);let h=hdr('🏕️ '+esc(m.name||'Party'),1);if(inv)h+=`<div class="card" style="border:2px solid var(--acc2)"><h3>📨 Invito al party</h3><p>Sei stato invitato a unirti a <b>${esc(m.name||'Party')}</b>.</p><div class="row"><button class="d grow" data-pno>Rifiuta</button><button class="grow" data-pyes>Accetta</button></div></div>`;if(!ids.includes(uid))return h+(inv?'':'<div class="card"><p class="mut">Non fai ancora parte di un party.</p></div>');return h+ids.filter(i=>S.players[i]).map(i=>memCard(S.players[i],i===uid)).join('')};
async function editParty(){
  const m=pm(),cur=[...(m.members||[]),...(m.invited||[])];
  const r=await ask('🏕️ Party',[{l:'Nome del party',n:'name'},{l:'Membri e inviti (i nuovi selezionati ricevono un invito)',n:'to',t:'multi',o:Object.entries(S.players).map(([i,p])=>[i,p.username])}],{name:m.name||'',to:cur});
  if(!r)return;
  const mem=(m.members||[]).filter(i=>r.to.includes(i)),old=m.invited||[],newInv=r.to.filter(i=>!mem.includes(i)),fresh=newInv.filter(i=>!old.includes(i));
  await guard(db.collection('party').doc('main').set({name:r.name||'Party',members:mem,invited:newInv}));
  fresh.forEach(i=>{const id=uid8();guard(db.collection('msgs').doc(id).set({id,to:[i],from:{t:'sys',name:'SISTEMA'},kind:'invite',text:r.name||'Party',ts:Date.now()}))});
  toast(fresh.length?'Inviti inviati':'Party aggiornato');
}
async function respondInvite(yes){
  const m=pm(),mem=(m.members||[]).filter(x=>x!==uid);
  await guard(db.collection('party').doc('main').set({...m,members:yes?[...mem,uid]:mem,invited:(m.invited||[]).filter(x=>x!==uid)}));
  toast(yes?'Sei entrato nel party!':'Invito rifiutato');
  if(yes){view={name:'party'};render()}
}
const IF=()=>[{l:'Nome',n:'name'},{l:'Tipo',n:'cat',t:'select',o:['oggetto','arma','armatura']},{l:'Foto (max 2 MB)',n:'photo',t:'file'},{l:'Descrizione',n:'desc',t:'area'},{l:'Utilizzo',n:'use',t:'select',o:['infinito','utilizzabile']},{l:'Numero di usi (solo se utilizzabile)',n:'uses',t:'number'},{l:'Bonus alle statistiche',n:'bk',t:'select',o:['nessuno',...TR.map(t=>t[1]),...AB.map(a=>a[1])]},{l:'Valore del bonus',n:'bv',t:'number'}];
async function invSave(r,old){const b=BK[r.bk],o={name:r.name.slice(0,60),cat:r.cat,desc:(r.desc||'').slice(0,400),uses:r.use==='utilizzabile'?Math.max(1,r.uses):null,bonus:b&&r.bv>0?{t:b.t,k:b.k,v:r.bv}:null};if(r.photo){const u=await uploadPhoto(r.photo);if(u)o.photo=u}else o.photo=old?(old.photo||''):'';return o}
const invRow2=e=>`<div class="move" style="border-left-color:var(--acc2)"><div style="font-size:1.6em">${e.photo?`<img src="${esc(e.photo)}" style="width:48px;height:48px;object-fit:cover;border-radius:8px">`:(CATI[e.cat]||'🎁')}</div><div class="grow"><b>${esc(e.name)}</b><div class="mut">${e.uses==null?'♾ Infinito':e.uses+(e.uses===1?' uso':' usi')}${e.bonus?` · <span style="color:var(--ok)">+${e.bonus.v} ${esc(bonusLabel(e.bonus))}</span>`:''}</div>${e.desc?`<div class="mut" style="white-space:pre-wrap;margin-top:4px">${esc(e.desc)}</div>`:''}</div><div class="row" style="gap:4px;flex-direction:column">${e.uses!=null?`<button class="mini" data-use="${e.id}">Usa</button>`:''}<button class="g mini" data-ei="${e.id}">✎</button><button class="d mini" data-di="${e.id}">🗑</button></div></div>`;
function rebindV9(){
  mapInit();
  const pe=$('#pedit');if(pe)pe.onclick=editParty;
  const y=$('[data-pyes]'),n=$('[data-pno]');if(y)y.onclick=()=>respondInvite(true);if(n)n.onclick=()=>respondInvite(false);
  const U=d=>guard(db.collection('players').doc(uid).update(d));
  if($('#addItem'))$('#addItem').onclick=async()=>{const p=me();if(!p)return;const r=await ask('Nuovo oggetto',IF(),{cat:invTab==='soldi'?'oggetto':invTab,use:'infinito',bk:'nessuno'});if(r&&r.name){const o=await invSave(r);U({inv:[...(p.inv||[]),{id:uid8(),it:'',...o}]})}};
  app.querySelectorAll('[data-ei]').forEach(b=>b.onclick=async()=>{const p=me(),e=p&&(p.inv||[]).find(x=>x.id===b.dataset.ei);if(!e)return;const r=await ask('Modifica oggetto',IF(),{...e,use:e.uses==null?'infinito':'utilizzabile',uses:e.uses||0,bk:bonusLabel(e.bonus),bv:e.bonus?e.bonus.v:0});if(r&&r.name){const o=await invSave(r,e);U({inv:p.inv.map(x=>x.id===e.id?{...x,...o}:x)})}});
  app.querySelectorAll('[data-di]').forEach(b=>b.onclick=async()=>{const p=me();if(p&&await askYes('Rimuovere questo oggetto dall inventario?'))U({inv:(p.inv||[]).filter(x=>x.id!==b.dataset.di)})});
}
/* ===== v10: temi colore ===== */
const THEMES=[['viola','Viola','hsl(262 70% 62%)'],['rosso','Rosso','hsl(355 70% 58%)'],['arancione','Arancione','hsl(24 85% 56%)'],['giallo','Giallo','hsl(46 85% 54%)'],['verde','Verde','hsl(145 50% 46%)'],['blu','Blu','hsl(222 75% 62%)'],['azzurro','Azzurro','hsl(195 80% 52%)'],['rosa','Rosa','hsl(325 70% 62%)'],['grafite','Grafite','hsl(220 8% 60%)']];
let pendingTheme=null;
function applyTheme(t){
  if(!THEMES.some(x=>x[0]===t))t='viola';
  document.documentElement.dataset.theme=t;
  const m=document.querySelector('meta[name=theme-color]');
  if(m){const bg=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();if(bg)m.setAttribute('content',bg)}
}
function wantTheme(){
  let ls=null;try{ls=localStorage.getItem('nx_theme')}catch(e){}
  const inM=masterOK&&view.name==='master',p=!inM&&authed&&me(),own=p&&p.theme;
  if(pendingTheme){if(own===pendingTheme)pendingTheme=null;else return pendingTheme}
  return own||ls||'viola';
}
function syncTheme(){const t=wantTheme();if(document.documentElement.dataset.theme!==t)applyTheme(t)}
function themePicker(){
  const cur=document.documentElement.dataset.theme||'viola',m=document.createElement('div');m.className='modal';
  m.innerHTML=`<div><h3>🎨 Tema colore</h3><div class="themes">${THEMES.map(([k,l,c])=>`<button class="theme-opt ${k===cur?'sel':''}" data-th="${k}"><i style="background:${c}"></i>${l}</button>`).join('')}</div><button class="g" style="width:100%" data-x>Chiudi</button></div>`;
  document.body.append(m);
  m.onclick=e=>{
    const b=e.target.closest('[data-th],[data-x]');
    if(b&&b.dataset.th){
      const t=b.dataset.th;pendingTheme=t;applyTheme(t);
      try{localStorage.setItem('nx_theme',t)}catch(x){}
      if(me()&&authed)guard(db.collection('players').doc(uid).update({theme:t}));
      m.querySelectorAll('.theme-opt').forEach(o=>o.classList.toggle('sel',o.dataset.th===t));
    }else if((b&&b.dataset.x!==undefined)||e.target===m)m.remove();
  };
}
/* ===== v12: desktop (finestra, barra applicazioni) e mappe a pixel ===== */
const DAYS=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'],MONTHS=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
function tick(){
  const d=new Date(),t=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  const full=DAYS[d.getDay()]+' '+d.getDate()+' '+MONTHS[d.getMonth()],short=d.toLocaleDateString('it-IT');
  const c=document.getElementById('tb-clock');if(c&&c.textContent!==t)c.textContent=t;
  const dt=document.getElementById('tb-date');if(dt&&dt.textContent!==short)dt.textContent=short;
  document.querySelectorAll('.gtime').forEach(e=>e.textContent=t);
  document.querySelectorAll('.gdate').forEach(e=>e.textContent=full);
  const n=document.getElementById('tb-net');if(n){const on=navigator.onLine!==false;n.textContent=on?'Online':'Offline';n.classList.toggle('off',!on)}
}
function screenName(){
  if(masterOK&&view.name==='master'){const T={profile:'Player',ego:'EGO',npcs:'NPC',quests:'Quest',party:'Party',msgs:'Messaggi',map:'Mappa'};return 'Pannello Master'+(tab&&T[tab]?' — '+T[tab]:'')}
  if(!authed||!me())return 'Nexus Connection';
  if(view.name==='npc'){const n=S.npcs[view.id];return 'NPC'+(n?' — '+n.name:'')}
  const N={home:'Home',profile:'Profilo',ego:'EGO',npcs:'NPC',quests:'Quest',party:'Party',inv:'Inventario',msgs:'Messaggi',map:'Mappa'};
  return 'Nexus Connection'+(N[view.name]?' — '+N[view.name]:'');
}
function updateStatus(){
  const inM=masterOK&&view.name==='master',p=!inM&&authed&&me();
  document.body.classList.toggle('locked',!p&&!inM);
  const t=screenName(),w=document.getElementById('win-title'),tt=document.getElementById('tb-title');
  if(w&&w.textContent!==t)w.textContent=t;if(tt&&tt.textContent!==t)tt.textContent=t;
  const tr=document.getElementById('tb-tray');
  if(tr){
    let h='';if(p){const v=vit(p);h=`<span class="tchip hp">❤ ${v.h}/${v.hm}</span><span class="tchip nx">◆ ${v.n}/${v.nm}</span>`}
    if(tr.dataset.h!==h){tr.dataset.h=h;tr.innerHTML=h}
  }
}
function renderSplash(){
  app.innerHTML=`<div class="lock"><div class="lk-clock"><b class="gtime"></b><span class="gdate"></span></div><div class="lk-center"><div class="lk-avatar"><button class="drop" id="drop" aria-label="Entra">${DROP}</button></div><h1>NEXUS CONNECTION</h1><div class="lk-hint">Tocca la goccia per accedere</div></div><div class="lk-foot">BENVENUTO</div></div>`;
  $('#drop').onclick=authSheet;
}
let lastKey='';
new MutationObserver(()=>{
  tick();updateStatus();
  const key=[view.name,tab,selP,editing,invTab,view.id].join('|');
  if(key!==lastKey){lastKey=key;const s=document.getElementById('scr');if(s)s.scrollTop=0}
}).observe(app,{childList:true});
setInterval(tick,15000);tick();
const topModal=()=>document.querySelector('.modal');
const tbOn=(id,fn)=>{const b=document.getElementById(id);if(b)b.onclick=fn};
tbOn('tb-back',()=>{
  const m=topModal();
  if(m){const c=m.querySelector('[data-x]')||m.querySelector('[data-c]')||m.querySelector('[data-n]');if(c)c.click();return}
  const bk=$('#bk');if(bk){bk.click();return}
  if(masterOK&&view.name==='master'){tab=null;render()}
});
tbOn('tb-start',()=>{
  if(topModal())return;
  if(masterOK&&view.name==='master'){tab=null;selP=null;editing=false;render()}
  else if(authed&&me()){view={name:'home'};render()}
  else authSheet();
});

//#MAPCORE-START
const MAP_TYPES=[['terra','🌍 Terre'],['isola','🏝️ Isola'],['dungeon','🏰 Dungeon'],['caverna','🕳️ Caverna'],['villaggio','🏘️ Villaggio']];
const MAP_DEF={terra:{water:45,mount:35,forest:50,detail:4},isola:{water:50,mount:35,forest:50,detail:4},dungeon:{rooms:14,rsize:9,corr:1,treasure:4},caverna:{dens:46,smooth:5,treasure:4},villaggio:{houses:16,trees:45,pond:50}};
const MAP_SL={
  terra:[['water','Acqua',0,90],['mount','Montagne',0,100],['forest','Foreste',0,100],['detail','Dettaglio',1,10]],
  dungeon:[['rooms','Stanze',3,40],['rsize','Dimensione stanze',4,16],['corr','Larghezza corridoi',1,2],['treasure','Tesori',0,12]],
  caverna:[['dens','Densità roccia',35,60],['smooth','Smussatura',0,8],['treasure','Tesori',0,12]],
  villaggio:[['houses','Case',2,40],['trees','Alberi',0,100],['pond','Laghetto',0,100]]};
MAP_SL.isola=MAP_SL.terra;
const PAL={
  classica:{deep:'#27598f',shallow:'#3d82c4',sand:'#e2d39a',grass:'#5aa84a',forest:'#2e7438',hill:'#8d9157',mount:'#8a847e',snow:'#f1f4f7',rock:'#25222c',floor:'#c2b08c',corr:'#a89a7b',wall:'#4b4559',road:'#cdb27a',house:'#dbc7a3',roof:'#b3473a',tree:'#2e7438',water:'#3d82c4',treasure:'#f0c419',stairs:'#e8e8f0'},
  autunno:{deep:'#2f5a7a',shallow:'#4b86a3',sand:'#d9bf84',grass:'#a89b3d',forest:'#9a4a22',hill:'#a77a45',mount:'#7b6a60',snow:'#f4ede4',rock:'#2a211d',floor:'#c4a982',corr:'#a98f6a',wall:'#5a4535',road:'#cfa86c',house:'#e0c9a0',roof:'#a8472a',tree:'#b4561f',water:'#4b86a3',treasure:'#f0c419',stairs:'#efe3d0'},
  neve:{deep:'#3b6aa6',shallow:'#6aa0d6',sand:'#dfe8f0',grass:'#cfe0e8',forest:'#7fa6a4',hill:'#aab8c4',mount:'#8d9aa8',snow:'#ffffff',rock:'#1f2733',floor:'#d7e1ea',corr:'#bccad6',wall:'#55657a',road:'#b7c5d1',house:'#e9eef3',roof:'#6b87a8',tree:'#6f9a98',water:'#6aa0d6',treasure:'#f0c419',stairs:'#ffffff'},
  deserto:{deep:'#2a6d8c',shallow:'#4aa0b4',sand:'#ead29a',grass:'#d7b868',forest:'#8a9a4a',hill:'#c49a5a',mount:'#a5754a',snow:'#f2e7d0',rock:'#2b1f17',floor:'#dcc08a',corr:'#c2a470',wall:'#6a4a30',road:'#e8cf94',house:'#e8d6ac',roof:'#b8643a',tree:'#7e9140',water:'#4aa0b4',treasure:'#f0c419',stairs:'#fff0cc'},
  vulcano:{deep:'#3a1c2a',shallow:'#e0521e',sand:'#4a3a38',grass:'#5a4a44',forest:'#3a2a28',hill:'#6a4a40',mount:'#3d3335',snow:'#a8a0a0',rock:'#150f10',floor:'#6b5550',corr:'#574541',wall:'#2e2224',road:'#7a6258',house:'#8a6c60',roof:'#5a2a22',tree:'#3a2a28',water:'#e0521e',treasure:'#f0c419',stairs:'#ffcf99'}};
const hexRGB=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const shadeC=(h,f)=>'rgb('+hexRGB(h).map(v=>Math.max(0,Math.min(255,Math.round(v*f)))).join(',')+')';
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hashSeed(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function mkNoise(seed){
  const hh=(x,y)=>{let n=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(seed,1274126177);n=Math.imul(n^n>>>13,1274126177);return((n^n>>>16)>>>0)/4294967296};
  const sm=t=>t*t*(3-2*t);
  return (x,y)=>{const x0=Math.floor(x),y0=Math.floor(y),fx=sm(x-x0),fy=sm(y-y0),a=hh(x0,y0),b=hh(x0+1,y0),c=hh(x0,y0+1),d=hh(x0+1,y0+1);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy}
}
function fbm(nz,x,y,oct){let v=0,a=.5,f=1,t=0;for(let i=0;i<oct;i++){v+=a*nz(x*f,y*f);t+=a;a/=2;f*=2}return v/t}
const ADDONS=[['casa','🏠 Casa'],['montagna','⛰️ Montagna'],['albero','🌲 Albero'],['torre','🗼 Torre'],['tenda','⛺ Tenda'],['tesoro','💰 Tesoro'],['bandiera','🚩 Bandiera']];
const ADDON_T=ADDONS.map(a=>a[0]);
const SHAPES=[['quadrata','⬜ Quadrata'],['tonda','⚪ Tonda'],['ovale','🥚 Ovale'],['diamante','🔶 Diamante']];
const UNITS=['m','km','mi','passi'];
function inShape(s,x,y,n){
  const dx=(x+.5)/n*2-1,dy=(y+.5)/n*2-1;
  if(s==='tonda')return dx*dx+dy*dy<=1;
  if(s==='ovale')return dx*dx+dy*dy/.36<=1;
  if(s==='diamante')return Math.abs(dx)+Math.abs(dy)<=1;
  return true;
}
function drawAddon(ctx,P,a,Z){
  const X=a.x*Z,Y=a.y*Z,W=a.s*Z,r=(fx,fy,fw,fh,col)=>{ctx.fillStyle=col;ctx.fillRect(X+fx*W,Y+fy*W,fw*W,fh*W)};
  if(a.t==='casa'){r(.1,.45,.8,.5,P.house);r(.05,.2,.9,.28,P.roof);r(.42,.65,.16,.3,shadeC(P.roof,.55))}
  else if(a.t==='montagna'){r(.05,.7,.9,.25,P.mount);r(.2,.45,.6,.27,P.mount);r(.35,.2,.3,.27,P.mount);r(.4,.2,.2,.14,P.snow)}
  else if(a.t==='albero'){r(.43,.65,.14,.3,'#6b4a2b');r(.2,.4,.6,.3,P.tree);r(.3,.15,.4,.3,shadeC(P.tree,1.15))}
  else if(a.t==='torre'){r(.3,.25,.4,.7,P.wall);r(.25,.12,.5,.15,shadeC(P.wall,.8));r(.43,.5,.14,.2,'#14121a')}
  else if(a.t==='tenda'){r(.1,.7,.8,.25,P.roof);r(.25,.45,.5,.27,P.roof);r(.4,.2,.2,.27,P.roof);r(.44,.72,.12,.23,'#14121a')}
  else if(a.t==='tesoro'){r(.2,.4,.6,.5,P.treasure);r(.2,.4,.6,.12,shadeC(P.treasure,.75));r(.45,.55,.1,.15,'#14121a')}
  else if(a.t==='bandiera'){r(.28,.1,.07,.85,'#3a3340');r(.35,.12,.4,.28,'#d02f3a')}
}
function drawScale(ctx,c,Z){
  const n=c.size,L=Math.max(1,Math.round(n/8)),W=L*Z,fs=Math.max(10,Math.round(Z*1.3)),pad=Math.round(fs*.5);
  const label=(+(L*c.scale).toFixed(2))+' '+c.unit;
  ctx.font='bold '+fs+'px sans-serif';
  const bw=Math.max(W,ctx.measureText(label).width)+pad*2,bh=fs+pad*2+6,x0=Z,y0=n*Z-bh-Z;
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(x0,y0,bw,bh);
  ctx.fillStyle='#fff';ctx.fillRect(x0+pad,y0+bh-pad-3,W,3);ctx.fillRect(x0+pad,y0+bh-pad-7,2,8);ctx.fillRect(x0+pad+W-2,y0+bh-pad-7,2,8);
  ctx.textAlign='start';ctx.textBaseline='top';ctx.fillText(label,x0+pad,y0+pad-2);
}
function drawToken(ctx,m,Z){
  const r=Math.max(7,Z*.8),cx=m.x*Z+Z/2,cy=m.y*Z+Z/2;
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=m.color;ctx.fill();
  ctx.lineWidth=m.me?3:2;ctx.strokeStyle='#fff';ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='bold '+Math.round(r*1.1)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(m.label,cx,cy+1);ctx.textAlign='start';
}
function mapNorm(c){
  c=c||{};const type=MAP_DEF[c.type]?c.type:'terra';
  const size=Math.min(128,Math.max(16,parseInt(c.size)||48));
  const o={...MAP_DEF[type],type,seed:String(c.seed==null?'nexus':c.seed).slice(0,40)||'nexus',size,pal:PAL[c.pal]?c.pal:'classica',grid:!!c.grid,shade:c.shade!==false,
    shape:SHAPES.some(s=>s[0]===c.shape)?c.shape:'quadrata',
    scale:Math.min(1000,Math.max(0,+c.scale||0)),
    unit:UNITS.includes(c.unit)?c.unit:'m',
    addons:(Array.isArray(c.addons)?c.addons:[]).filter(a=>a&&ADDON_T.includes(a.t)&&Number.isInteger(a.x)&&Number.isInteger(a.y)&&a.x>=0&&a.y>=0&&a.x<size&&a.y<size).slice(0,500).map(a=>({t:a.t,x:a.x,y:a.y,s:Math.min(4,Math.max(1,parseInt(a.s)||1))}))};
  for(const [k,,a,b] of MAP_SL[type])if(c[k]!=null&&!isNaN(+c[k]))o[k]=Math.min(b,Math.max(a,+c[k]));
  return o;
}
function genTerra(c,island){
  const n=c.size,ns=mkNoise(hashSeed(c.seed+'#e')),nf=mkNoise(hashSeed(c.seed+'#f')),sc=1.5+c.detail*.55;
  const el=new Float32Array(n*n),codes=new Uint8Array(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    let e=fbm(ns,x/n*sc,y/n*sc,5);
    if(island){const dx=x/n-.5,dy=y/n-.5,d=Math.sqrt(dx*dx+dy*dy)*2;e=e*.7+(1-Math.min(1,d*d))*.4-.05}
    el[y*n+x]=e;
  }
  const sorted=Float32Array.from(el).sort(),seaT=sorted[Math.min(n*n-1,Math.floor(n*n*c.water/100))];
  const mT=1-c.mount/100*.5,hT=mT-.13,snT=mT+(1-mT)*.55,ft=1-c.forest/100*.7;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=y*n+x,e=el[i];let k;
    if(e<=seaT)k=e<seaT-.07?0:1;
    else{
      const l=(e-seaT)/(1-seaT+1e-6);
      if(l<.045)k=2;
      else if(c.mount>0&&l>=snT)k=7;
      else if(c.mount>0&&l>=mT)k=6;
      else if(c.mount>0&&l>=hT)k=5;
      else k=fbm(nf,x/n*sc*2.2,y/n*sc*2.2,3)>ft?4:3;
    }
    codes[i]=k;
  }
  return {codes,el};
}
function edgeWalls(codes,n){
  const out=Uint8Array.from(codes);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    if(codes[y*n+x]!==0)continue;let near=false;
    for(let dy=-1;dy<=1&&!near;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=n||yy>=n)continue;const v=codes[yy*n+xx];if(v!==0&&v!==7){near=true;break}}
    if(near)out[y*n+x]=7;
  }
  return out;
}
function genDungeon(c){
  const n=c.size,rnd=mulberry32(hashSeed(c.seed)),g=new Uint8Array(n*n),rooms=[];let tries=0;
  while(rooms.length<c.rooms&&tries++<c.rooms*50){
    const w=3+Math.floor(rnd()*(c.rsize-2)),h=3+Math.floor(rnd()*(c.rsize-2));
    if(n-w-4<1||n-h-4<1)continue;
    const x=2+Math.floor(rnd()*(n-w-4)),y=2+Math.floor(rnd()*(n-h-4));
    if(rooms.some(r=>x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y))continue;
    rooms.push({x,y,w,h});
  }
  if(!rooms.length)rooms.push({x:Math.floor(n/2)-2,y:Math.floor(n/2)-2,w:4,h:4});
  for(const r of rooms)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)g[y*n+x]=1;
  const ctr=r=>[r.x+Math.floor(r.w/2),r.y+Math.floor(r.h/2)],carve=(x,y)=>{for(let a=0;a<c.corr;a++)for(let b=0;b<c.corr;b++){const xx=x+a,yy=y+b;if(xx>0&&yy>0&&xx<n-1&&yy<n-1&&g[yy*n+xx]===0)g[yy*n+xx]=2}};
  for(let i=1;i<rooms.length;i++){
    let [x1,y1]=ctr(rooms[i-1]);const [x2,y2]=ctr(rooms[i]);
    if(rnd()<.5){while(x1!==x2){carve(x1,y1);x1+=x1<x2?1:-1}while(y1!==y2){carve(x1,y1);y1+=y1<y2?1:-1}}
    else{while(y1!==y2){carve(x1,y1);y1+=y1<y2?1:-1}while(x1!==x2){carve(x1,y1);x1+=x1<x2?1:-1}}
    carve(x2,y2);
  }
  const [sx,sy]=ctr(rooms[0]),[ex,ey]=ctr(rooms[rooms.length-1]);
  const floors=[];for(const r of rooms)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)floors.push(y*n+x);
  for(let t=0;t<c.treasure&&floors.length;t++){const i=floors[Math.floor(rnd()*floors.length)];if(g[i]===1)g[i]=6}
  g[sy*n+sx]=8;if(rooms.length>1)g[ey*n+ex]=9;
  return {codes:edgeWalls(g,n),el:null};
}
function genCave(c){
  const n=c.size,rnd=mulberry32(hashSeed(c.seed));let g=new Uint8Array(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)g[y*n+x]=(x===0||y===0||x===n-1||y===n-1||rnd()*100<c.dens)?1:0;
  for(let s=0;s<c.smooth;s++){
    const g2=new Uint8Array(n*n);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){let k=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=n||yy>=n||g[yy*n+xx])k++}g2[y*n+x]=k>=5?1:0}
    g=g2;
  }
  const lab=new Int32Array(n*n),sizes=[0];let cnt=0;
  for(let i=0;i<n*n;i++){
    if(g[i]||lab[i])continue;cnt++;let sz=0;const st=[i];lab[i]=cnt;
    while(st.length){const j=st.pop();sz++;const x=j%n,y=(j-x)/n;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=n||yy>=n)continue;const k=yy*n+xx;if(!g[k]&&!lab[k]){lab[k]=cnt;st.push(k)}}}
    sizes[cnt]=sz;
  }
  let best=0;for(let i=1;i<=cnt;i++)if(!best||sizes[i]>sizes[best])best=i;
  const codes=new Uint8Array(n*n),floors=[];
  for(let i=0;i<n*n;i++)if(best&&lab[i]===best){codes[i]=1;floors.push(i)}
  if(floors.length<20){const m=Math.floor(n/2);for(let y=m-3;y<=m+3;y++)for(let x=m-3;x<=m+3;x++){codes[y*n+x]=1;floors.push(y*n+x)}}
  for(let t=0;t<c.treasure;t++){const i=floors[Math.floor(rnd()*floors.length)];if(codes[i]===1)codes[i]=6}
  return {codes:edgeWalls(codes,n),el:null};
}
function genVillage(c){
  const n=c.size,rnd=mulberry32(hashSeed(c.seed)),ns=mkNoise(hashSeed(c.seed+'#v')),codes=new Uint8Array(n*n),at=(x,y)=>y*n+x,inb=(x,y)=>x>=0&&y>=0&&x<n&&y<n;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(ns(x*.35,y*.35)>.62)codes[at(x,y)]=1;
  if(c.pond>0){const cx=Math.floor(n*.25+rnd()*n*.5),cy=Math.floor(n*.25+rnd()*n*.5),r=2+c.pond/100*Math.min(10,n*.18);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){const dx=x-cx,dy=y-cy;if(Math.sqrt(dx*dx+dy*dy)+(ns(x*.5,y*.5)-.5)*3<r)codes[at(x,y)]=3}}
  const road=(x,y,w)=>{for(let a=0;a<w;a++)for(let b=0;b<w;b++)if(inb(x+a,y+b))codes[at(x+a,y+b)]=2};
  let ry=Math.floor(n*(.4+rnd()*.2));
  for(let x=0;x<n;x++){if(rnd()<.2)ry+=rnd()<.5?-1:1;ry=Math.max(3,Math.min(n-5,ry));road(x,ry,2)}
  const br=2+Math.floor(rnd()*2);
  for(let b=0;b<br;b++){
    let bx=Math.floor(n*((b+1)/(br+1)))+Math.floor(rnd()*5)-2,by=ry;const dir=rnd()<.5?-1:1;
    while(by>0&&by<n-1){by+=dir;if(rnd()<.2)bx+=rnd()<.5?-1:1;bx=Math.max(1,Math.min(n-3,bx));road(bx,by,1+(rnd()<.3?1:0))}
  }
  const nearRoad=(x,y,w,h)=>{for(let yy=y-3;yy<y+h+3;yy++)for(let xx=x-3;xx<x+w+3;xx++)if(inb(xx,yy)&&codes[at(xx,yy)]===2)return true;return false};
  let placed=0,tries=0;
  while(placed<c.houses&&tries++<c.houses*40){
    const w=3+Math.floor(rnd()*3),h=3+Math.floor(rnd()*2),x=1+Math.floor(rnd()*(n-w-2)),y=1+Math.floor(rnd()*(n-h-2));
    let ok=n-w-2>0&&n-h-2>0&&nearRoad(x,y,w,h);
    for(let yy=y-1;ok&&yy<=y+h;yy++)for(let xx=x-1;xx<=x+w;xx++){if(!inb(xx,yy))continue;const v=codes[at(xx,yy)];if(v!==0&&v!==1){ok=false;break}}
    if(!ok)continue;
    for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)codes[at(xx,yy)]=yy-y<(h>3?2:1)?6:5;
    codes[at(x+Math.floor(w/2),y+h-1)]=7;placed++;
  }
  const nt=mkNoise(hashSeed(c.seed+'#t'));
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=at(x,y);if(codes[i]<=1&&nt(x*.2+9,y*.2+9)>.4&&rnd()<c.trees/100*.3)codes[i]=4}
  return {codes,el:null};
}
function genMap(c){
  const d=c.type==='terra'?genTerra(c,false):c.type==='isola'?genTerra(c,true):c.type==='dungeon'?genDungeon(c):c.type==='caverna'?genCave(c):genVillage(c);
  if(c.shape!=='quadrata'){const n=c.size;for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(!inShape(c.shape,x,y,n))d.codes[y*n+x]=255}
  return d;
}
let mapCache={key:'',data:null};
function mapData(c){const key=JSON.stringify([c.type,c.size,c.seed,c.water,c.mount,c.forest,c.detail,c.rooms,c.rsize,c.corr,c.treasure,c.dens,c.smooth,c.houses,c.trees,c.pond,c.shape]);if(mapCache.key!==key)mapCache={key,data:genMap(c)};return mapCache.data}
function tileColor(c,P,k,x,y,data,sh){
  const n=c.size,t=c.type;
  if(t==='terra'||t==='isola'){
    const col=[P.deep,P.shallow,P.sand,P.grass,P.forest,P.hill,P.mount,P.snow][k];let f=1;
    if(c.shade&&k>=2){const e=data.el,X=(v)=>Math.max(0,Math.min(n-1,v));f+=Math.max(-.2,Math.min(.2,(e[X(y-1)*n+X(x-1)]-e[X(y+1)*n+X(x+1)])*(k>=5?5:2.5)))}
    return shadeC(col,f+(sh-.5)*(k<2?.05:.09));
  }
  if(t==='villaggio'){
    const col=[P.grass,shadeC(P.grass,.9),P.road,P.water,P.tree,P.house,P.roof,shadeC(P.roof,.6)][k];
    return k<=1||k===4||k===2?(k===0||k===1||k===2||k===4?shadeC(typeof col==='string'&&col[0]==='#'?col:P.grass,1):col):col;
  }
  return [P.rock,P.floor,P.corr,P.floor,P.floor,P.floor,P.floor,P.wall,P.stairs,shadeC(P.stairs,.75)][k];
}
function paintMap(cv,c,Z,data,marks){
  const n=c.size,P=PAL[c.pal]||PAL.classica,ctx=cv.getContext('2d'),seed=hashSeed(c.seed);
  cv.width=cv.height=n*Z;ctx.imageSmoothingEnabled=false;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const k=data.codes[y*n+x];
    if(k===255){ctx.fillStyle='#14121a';ctx.fillRect(x*Z,y*Z,Z,Z);continue}
    const sh=(((Math.imul(x,73856093)^Math.imul(y,19349663)^seed)>>>0)%1000)/1000;
    let col;
    if(c.type==='villaggio'){
      const base={0:P.grass,1:shadeC(P.grass,.92),2:P.road,3:P.water,4:P.tree,5:P.house,6:P.roof,7:shadeC(P.roof,.55)}[k];
      col=base[0]==='#'?shadeC(base,.96+sh*.08):base;
    }else if(c.type==='dungeon'||c.type==='caverna'){
      const base=[P.rock,P.floor,P.corr,P.floor,P.floor,P.floor,P.floor,P.wall,P.stairs,shadeC(P.stairs,.75)][k];
      col=shadeC(base,k===0?1:.94+sh*.1);
    }else col=tileColor(c,P,k,x,y,data,sh);
    ctx.fillStyle=col;ctx.fillRect(x*Z,y*Z,Z,Z);
    if(k===6&&(c.type==='dungeon'||c.type==='caverna')){ctx.fillStyle=P.treasure;ctx.fillRect(x*Z+Z*.25,y*Z+Z*.25,Z*.5,Z*.5)}
    if(k===4&&c.type==='villaggio'){ctx.fillStyle=shadeC(P.tree,.75);ctx.fillRect(x*Z+Z*.2,y*Z+Z*.2,Z*.6,Z*.6)}
  }
  if(c.grid&&Z>=5){ctx.fillStyle='rgba(0,0,0,.16)';for(let i=1;i<n;i++){ctx.fillRect(i*Z,0,1,n*Z);ctx.fillRect(0,i*Z,n*Z,1)}}
  (c.addons||[]).forEach(a=>drawAddon(ctx,P,a,Z));
  if(c.scale>0)drawScale(ctx,c,Z);
  (marks||[]).forEach(m=>drawToken(ctx,m,Z));
}
//#MAPCORE-END
let MAPCFG=mapNorm({type:'terra',seed:'nexus'}),mapSel=null,mapTool=null,mapSz=1;
const tileAt=(cv,n,e)=>{const r=cv.getBoundingClientRect(),f=v=>Math.min(n-1,Math.max(0,Math.floor(v*n)));return {x:f((e.clientX-r.left)/r.width),y:f((e.clientY-r.top)/r.height)}};
/* segnalini sulla mappa aperta: il Master li vede tutti, il player solo il proprio */
const mapMarks=M=>{
  if(!mapSel)return [];
  const out=[],add=(id,p)=>{const q=p.mpos&&p.mpos[mapSel];if(q)out.push({x:q.x,y:q.y,label:String(p.username||'?')[0].toUpperCase(),color:'hsl('+(hashSeed(id)%360)+' 75% 42%)',me:id===uid})};
  if(M)Object.entries(S.players).forEach(([id,p])=>add(id,p));else{const p=me();if(p)add(uid,p)}
  return out;
};
const mapList=(M,saved)=>`<div class="card"><h3>${M?'Mappe salvate':'Mappe del Master'}</h3>${saved.map(m=>`<div class="move"${m.id===mapSel?' style="border-left-color:var(--ok)"':''}><div class="grow"><b>${esc(m.name)}</b><div class="mut">${esc((MAP_TYPES.find(t=>t[0]===m.cfg.type)||[0,String(m.cfg.type)])[1])} · ${m.cfg.size}×${m.cfg.size}</div></div><button class="mini" data-mo="${m.id}">${m.id===mapSel?'Aperta':'Apri'}</button>${M?`<button class="d mini" data-mdel="${m.id}">🗑</button>`:''}</div>`).join('')||'<p class="mut">Nessuna mappa salvata.</p>'}</div>`;
const mapBoard=M=>{
  if(mapSel&&!S.maps[mapSel])mapSel=null;
  const saved=Object.values(S.maps||{}).sort((a,b)=>b.ts-a.ts),list=mapList(M,saved);
  if(!M){ /* vista player: solo lista + segnalino */
    const m=S.maps[mapSel],p=me();
    if(!m)return hdr('🗺️ Mappa',1)+list;
    const mine=p&&p.mpos&&p.mpos[mapSel];
    return hdr('🗺️ '+esc(m.name),1)+`<div class="card"><canvas id="mapcv" class="mapcv" style="cursor:crosshair"></canvas><p class="mut" style="margin:8px 0">Tocca la mappa per segnare dove si trova il tuo personaggio.</p><div class="row" style="flex-wrap:wrap;gap:8px">${mine?'<button class="g" id="mapunpin">Rimuovi il mio segnalino</button>':''}<button class="g" id="mapclose">‹ Altre mappe</button></div></div>`+list;
  }
  const c=mapNorm(MAPCFG),sl=MAP_SL[c.type]||[],cur=mapSel&&S.maps[mapSel];
  return hdr('🗺️ Mappa',1)+
  `<div class="card"><h3>Tipo di mappa</h3><div class="chips">${MAP_TYPES.map(([k,l])=>`<button class="chipb ${c.type===k?'sel':''}" data-mt="${k}">${l}</button>`).join('')}</div></div>`+
  `<div class="card"><canvas id="mapcv" class="mapcv"${mapTool?' style="cursor:crosshair"':''}></canvas>${mapTool?`<p class="mut" style="margin:8px 0 0">${mapTool==='gomma'?'Tocca un add-on per cancellarlo.':'Tocca la mappa per piazzare: '+esc(ADDONS.find(a=>a[0]===mapTool)[1])}</p>`:''}<div class="row" style="flex-wrap:wrap;gap:8px;margin-top:10px"><button id="mapnew">🎲 Nuova mappa casuale</button><button class="g" id="mapdl">⬇ PNG</button><button class="g" id="mapcopy">📋 Codice</button><button class="g" id="mapload">📥 Carica</button><button class="g" id="mapsave">💾 Salva come nuova</button>${cur?`<button class="g" id="mapupd">💾 Aggiorna «${esc(cur.name)}»</button>`:''}</div></div>`+
  `<div class="card"><h3>Personalizza</h3><label class="mut">Seme (stesso seme = stessa mappa)</label><div class="row"><input id="mapseed" value="${esc(c.seed)}" style="margin:0"><button class="g" id="mapdice" title="Seme casuale">🎲</button></div><div class="row" style="margin-top:10px"><div class="grow"><label class="mut">Dimensione</label><select id="mapsize">${[24,32,48,64,96,128].map(s=>`<option value="${s}" ${c.size===s?'selected':''}>${s}×${s}</option>`).join('')}</select></div><div class="grow"><label class="mut">Palette</label><select id="mappal">${Object.keys(PAL).map(k=>`<option value="${k}" ${c.pal===k?'selected':''}>${k[0].toUpperCase()+k.slice(1)}</option>`).join('')}</select></div></div><div class="row"><div class="grow"><label class="mut">Forma</label><select id="mapshape">${SHAPES.map(([k,l])=>`<option value="${k}" ${c.shape===k?'selected':''}>${l}</option>`).join('')}</select></div></div><div class="row" style="margin-top:6px"><div class="grow"><label class="mut">Scala: 1 quadretto = (0 = nascosta)</label><input id="mapscale" type="number" min="0" step="any" value="${c.scale}" style="margin:0"></div><div><label class="mut">Unità</label><select id="mapunit" style="margin:0">${UNITS.map(u=>`<option ${c.unit===u?'selected':''}>${u}</option>`).join('')}</select></div></div>${sl.map(([k,l,a,b])=>`<div style="margin-top:6px"><div class="row sp"><span>${l}</span><b id="mv-${k}">${c[k]}</b></div><input type="range" data-mk="${k}" min="${a}" max="${b}" value="${c[k]}"></div>`).join('')}<div class="row" style="margin-top:10px;gap:18px"><label class="row" style="gap:6px"><input type="checkbox" id="mapgrid" ${c.grid?'checked':''}> Griglia</label><label class="row" style="gap:6px"><input type="checkbox" id="mapshade" ${c.shade?'checked':''}> Rilievo</label></div></div>`+
  `<div class="card"><h3>Add-on</h3><div class="chips">${ADDONS.map(([k,l])=>`<button class="chipb ${mapTool===k?'sel':''}" data-at="${k}">${l}</button>`).join('')}<button class="chipb ${mapTool==='gomma'?'sel':''}" data-at="gomma">🧽 Gomma</button></div><div class="row" style="margin-top:10px"><div class="grow"><label class="mut">Grandezza add-on</label><select id="mapaddsz" style="margin:0">${[1,2,3,4].map(s=>`<option value="${s}" ${mapSz===s?'selected':''}>${s}×${s} quadretti</option>`).join('')}</select></div><button class="g" id="mapaddclr">Svuota</button></div><p class="mut" style="margin:8px 0 0">Add-on piazzati: <b id="mapaddn">${c.addons.length}</b></p></div>`+list;
};
function mapInit(){
  const cv=document.getElementById('mapcv');if(!cv)return;
  const M=masterOK&&view.name==='master',q=id=>document.getElementById(id);
  if(!M){ /* player: sola lettura + segnalino */
    const m=S.maps[mapSel];
    document.querySelectorAll('[data-mo]').forEach(b=>b.onclick=()=>{mapSel=b.dataset.mo;render()});
    if(!m)return;
    const cfg=mapNorm(m.cfg),n=cfg.size,data=mapData(cfg);
    paintMap(cv,cfg,Math.max(4,Math.floor(520/n)),data,mapMarks(false));
    cv.onclick=e=>{const t=tileAt(cv,n,e);if(data.codes[t.y*n+t.x]===255)return toast('Fuori dalla mappa');const p=me();if(p)guard(db.collection('players').doc(uid).update({mpos:{...(p.mpos||{}),[mapSel]:t}}))};
    const up=q('mapunpin');if(up)up.onclick=()=>{const p=me(),o={...((p&&p.mpos)||{})};delete o[mapSel];guard(db.collection('players').doc(uid).update({mpos:o}))};
    const cl=q('mapclose');if(cl)cl.onclick=()=>{mapSel=null;render()};
    return;
  }
  /* Master: editor completo */
  const draw=()=>{MAPCFG=mapNorm(MAPCFG);paintMap(cv,MAPCFG,Math.max(4,Math.floor(520/MAPCFG.size)),mapData(MAPCFG),mapMarks(true));const an=q('mapaddn');if(an)an.textContent=MAPCFG.addons.length};
  draw();
  document.querySelectorAll('[data-mt]').forEach(b=>b.onclick=()=>{const c=MAPCFG;MAPCFG=mapNorm({type:b.dataset.mt,seed:c.seed,size:c.size,pal:c.pal,grid:c.grid,shade:c.shade,shape:c.shape,scale:c.scale,unit:c.unit});render()});
  document.querySelectorAll('[data-mk]').forEach(i=>i.oninput=()=>{MAPCFG[i.dataset.mk]=+i.value;const l=q('mv-'+i.dataset.mk);if(l)l.textContent=i.value;draw()});
  const sd=q('mapseed');if(sd)sd.oninput=()=>{MAPCFG.seed=sd.value||'0';draw()};
  const dice=()=>{MAPCFG.seed=Math.random().toString(36).slice(2,8);if(sd)sd.value=MAPCFG.seed;draw()};
  ['mapnew','mapdice'].forEach(id=>{const b=q(id);if(b)b.onclick=dice});
  const sz=q('mapsize');if(sz)sz.onchange=()=>{MAPCFG.size=+sz.value;draw()};
  const pl=q('mappal');if(pl)pl.onchange=()=>{MAPCFG.pal=pl.value;draw()};
  const sp=q('mapshape');if(sp)sp.onchange=()=>{MAPCFG.shape=sp.value;draw()};
  const sc=q('mapscale');if(sc)sc.oninput=()=>{MAPCFG.scale=+sc.value||0;draw()};
  const un=q('mapunit');if(un)un.onchange=()=>{MAPCFG.unit=un.value;draw()};
  const gr=q('mapgrid');if(gr)gr.onchange=()=>{MAPCFG.grid=gr.checked;draw()};
  const sh=q('mapshade');if(sh)sh.onchange=()=>{MAPCFG.shade=sh.checked;draw()};
  /* add-on */
  document.querySelectorAll('[data-at]').forEach(b=>b.onclick=()=>{mapTool=mapTool===b.dataset.at?null:b.dataset.at;render()});
  const as=q('mapaddsz');if(as)as.onchange=()=>{mapSz=+as.value};
  const ac=q('mapaddclr');if(ac)ac.onclick=()=>{MAPCFG.addons=[];draw()};
  cv.onclick=e=>{
    if(!mapTool)return;
    const t=tileAt(cv,MAPCFG.size,e);
    if(mapTool==='gomma')MAPCFG.addons=MAPCFG.addons.filter(a=>!(t.x>=a.x&&t.x<a.x+a.s&&t.y>=a.y&&t.y<a.y+a.s));
    else MAPCFG.addons=[...MAPCFG.addons,{t:mapTool,x:t.x,y:t.y,s:mapSz}];
    draw();
  };
  /* PNG, codice, salvataggio */
  const dl=q('mapdl');if(dl)dl.onclick=()=>{const c=mapNorm(MAPCFG),big=document.createElement('canvas');paintMap(big,c,Math.max(8,Math.floor(1024/c.size)),mapData(c));big.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='mappa-'+c.type+'-'+c.seed+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)})};
  const cp=q('mapcopy');if(cp)cp.onclick=()=>{const code='NXMAP:'+JSON.stringify(mapNorm(MAPCFG)),show=()=>ask('Codice mappa',[{l:'Copia questo codice',n:'c',t:'area'}],{c:code});if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(code).then(()=>toast('Codice copiato'),show);else show()};
  const ld=q('mapload');if(ld)ld.onclick=async()=>{const r=await ask('Carica mappa',[{l:'Incolla il codice (NXMAP:…)',n:'c',t:'area'}]);if(r){try{MAPCFG=mapNorm(JSON.parse(r.c.trim().replace(/^NXMAP:/,'')));render()}catch(e){toast('Codice non valido')}}};
  const sv=q('mapsave');if(sv)sv.onclick=async()=>{const r=await ask('Salva mappa',[{l:'Nome della mappa',n:'name'}],{name:''});if(r&&r.name){const id=uid8();await guard(db.collection('maps').doc(id).set({id,name:r.name.slice(0,60),cfg:mapNorm(MAPCFG),ts:Date.now()}));mapSel=id;toast('Mappa salvata: i player la vedono nella bacheca Mappa')}};
  const up=q('mapupd');if(up)up.onclick=async()=>{if(!mapSel)return;await guard(db.collection('maps').doc(mapSel).update({cfg:mapNorm(MAPCFG)}));toast('Mappa aggiornata')};
  document.querySelectorAll('[data-mo]').forEach(b=>b.onclick=()=>{const m=S.maps[b.dataset.mo];if(m){MAPCFG=mapNorm(m.cfg);mapSel=m.id;render()}});
  document.querySelectorAll('[data-mdel]').forEach(b=>b.onclick=async()=>{if(await askYes('Eliminare questa mappa salvata?'))guard(db.collection('maps').doc(b.dataset.mdel).delete())});
}
$('#mbtn').onclick=async()=>{
  if(masterOK){view={name:'master'};return render()}
  const r=await ask('Login Master',[{l:'Email',n:'email',t:'email'},{l:'Password',n:'pw',t:'password'}]);
  if(!r)return;
  if(r.email.toLowerCase()===String(NX.MASTER_EMAIL||'').toLowerCase()&&r.pw===NX.MASTER_PASSWORD){masterOK=true;tab=null;view={name:'master'};render()}else toast('Credenziali Master errate');
};
boot();
