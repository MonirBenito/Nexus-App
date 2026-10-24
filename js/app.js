/* NEXUS CONNECTION - logica dell'app */
const NX=window.NX_CONFIG||{};
const $=s=>document.querySelector(s), app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db,user,assets,uid,isMaster=false,masterOK=false,authed=false,cred=null,S={players:{},npcs:{},items:{},quests:{},party:{},msgs:{},maps:{},bestiary:{},events:{}},view={name:'splash'},tab='players';
const DROP=`<svg viewBox="0 0 100 130" width="100%" height="100%"><defs><radialGradient id="g" cx="35%" cy="40%"><stop offset="0" stop-color="#ff4d5a"/><stop offset="1" stop-color="#8a0c16"/></radialGradient></defs><path d="M50 4C50 4 8 58 8 84a42 42 0 0 0 84 0C92 58 50 4 50 4Z" fill="url(#g)"/><ellipse cx="34" cy="86" rx="7" ry="15" fill="#fff" opacity=".25" transform="rotate(20 34 86)"/></svg>`;
/* ===== suoni: sintetizzati con WebAudio (nessun file audio) ===== */
const SN={u:null,hp:0,nx:0,cur:0};
const SND=(()=>{
  let ctx=null,out=null,on=true,last=0,lastSp=0;
  try{on=localStorage.getItem('nx_snd')!=='0'}catch(e){}
  const AC=window.AudioContext||window.webkitAudioContext;
  function init(){
    if(!AC)return false;
    if(!ctx){try{ctx=new AC();out=ctx.createGain();out.gain.value=.55;const cmp=ctx.createDynamicsCompressor();out.connect(cmp);cmp.connect(ctx.destination)}catch(e){ctx=null;return false}}
    if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    return true;
  }
  function t(f,d,o){
    o=o||{};const T=ctx.currentTime+(o.at||0),g=ctx.createGain(),osc=ctx.createOscillator(),v=o.v==null?.2:o.v;
    osc.type=o.w||'square';osc.frequency.setValueAtTime(f,T);
    if(o.to)osc.frequency.exponentialRampToValueAtTime(Math.max(20,o.to),T+d);
    g.gain.setValueAtTime(.0001,T);g.gain.linearRampToValueAtTime(v,T+.005);g.gain.exponentialRampToValueAtTime(.0001,T+d);
    osc.connect(g);g.connect(out);osc.start(T);osc.stop(T+d+.03);
  }
  function n(d,o){
    o=o||{};const T=ctx.currentTime+(o.at||0),len=Math.max(1,Math.floor(ctx.sampleRate*d)),b=ctx.createBuffer(1,len,ctx.sampleRate),a=b.getChannelData(0);
    for(let i=0;i<len;i++)a[i]=Math.random()*2-1;
    const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
    s.buffer=b;f.type=o.ft||'bandpass';f.frequency.setValueAtTime(o.f||1500,T);if(o.to)f.frequency.exponentialRampToValueAtTime(o.to,T+d);
    g.gain.setValueAtTime(o.v==null?.25:o.v,T);g.gain.exponentialRampToValueAtTime(.0001,T+d);
    s.connect(f);f.connect(g);g.connect(out);s.start(T);s.stop(T+d+.03);
  }
  const arp=(fs,step,d,o)=>fs.forEach((f,i)=>t(f,d,{...(o||{}),at:((o&&o.at)||0)+i*step}));
  const P={
    click:()=>t(660,.05,{v:.12}),
    tile:()=>{t(520,.06,{v:.14});t(780,.08,{v:.12,at:.05})},
    back:()=>t(440,.07,{v:.13,to:300}),
    open:()=>{t(400,.07,{v:.12});t(600,.09,{v:.12,at:.06})},
    close:()=>t(500,.08,{v:.1,to:300}),
    toast:()=>t(880,.06,{v:.1,w:'triangle'}),
    error:()=>{t(180,.14,{v:.2,w:'sawtooth'});t(140,.2,{v:.2,w:'sawtooth',at:.12})},
    danger:()=>t(300,.1,{v:.14,to:160,w:'sawtooth'}),
    ok:()=>arp([660,880],.07,.1,{v:.14}),
    buy:()=>{arp([988,1319],.07,.12,{v:.16});n(.05,{f:6000,ft:'highpass',v:.1})},
    coin:()=>arp([1319,1760],.06,.14,{v:.16}),
    login:()=>arp([392,523,659,784],.08,.16,{v:.15,w:'triangle'}),
    enc:()=>arp([330,392,494],.1,.2,{v:.17,w:'triangle'}),
    alarm:()=>{for(let i=0;i<3;i++){t(220,.12,{v:.2,w:'sawtooth',at:i*.2});t(165,.12,{v:.2,w:'sawtooth',at:i*.2+.1})}},
    quest:()=>arp([523,659,784,1047],.09,.2,{v:.16}),
    fanfare:()=>{arp([523,659,784],.1,.18,{v:.17});t(1047,.5,{v:.18,at:.3});t(784,.5,{v:.12,at:.3,w:'triangle'})},
    msg:()=>{t(784,.09,{v:.14,w:'triangle'});t(1047,.14,{v:.14,w:'triangle',at:.09})},
    hurt:()=>{t(200,.25,{v:.25,w:'sawtooth',to:70});n(.18,{f:900,to:200,v:.3})},
    heal:()=>arp([523,659,784,1047],.07,.16,{v:.13,w:'sine'}),
    nx:()=>t(600,.2,{v:.12,w:'sine',to:900}),
    dice:()=>n(.06,{f:2500+Math.random()*1500,v:.18}),
    land:()=>{t(180,.12,{v:.22,w:'triangle',to:90});n(.08,{f:1200,v:.2})},
    crit:()=>arp([784,988,1175,1568],.06,.16,{v:.16}),
    fail:()=>t(300,.3,{v:.2,w:'sawtooth',to:100}),
    attack:()=>{n(.22,{f:500,to:4000,v:.3});t(300,.16,{v:.1,w:'sawtooth',to:600})},
    skill:()=>{t(400,.3,{v:.15,w:'sine',to:1200});t(800,.3,{v:.1,w:'triangle',to:1600,at:.05})},
    use:()=>{t(500,.1,{v:.14,w:'triangle',to:800});t(800,.1,{v:.12,w:'triangle',at:.08})},
    ko:()=>arp([330,262,196,147],.14,.25,{v:.2,w:'sawtooth'}),
    loot:()=>{arp([784,988,1175,1568,1976],.07,.16,{v:.15});n(.2,{f:7000,ft:'highpass',v:.08,at:.1})},
    paint:()=>n(.05,{f:700,v:.12}),
    slash:()=>{n(.2,{f:1500,to:7000,v:.3});t(900,.14,{w:'sawtooth',to:300,v:.1});n(.15,{f:2500,to:8000,v:.25,at:.14});n(.15,{f:2000,to:6000,v:.25,at:.28})},
    smash:()=>{t(130,.3,{w:'square',v:.3,to:40,at:.08});n(.25,{f:400,to:80,v:.4,at:.08});t(60,.4,{w:'sine',v:.3,to:30,at:.1})},
    stab:()=>{n(.1,{f:3500,to:900,v:.25});t(800,.08,{w:'triangle',v:.15,to:200,at:.12});n(.08,{f:1200,v:.25,at:.14})},
    shot:()=>{n(.14,{f:1800,to:5000,v:.2});t(320,.45,{w:'triangle',v:.1,to:900});t(180,.08,{v:.22,at:.45});n(.08,{f:1500,v:.2,at:.45})},
    gun:()=>{n(.25,{f:6000,to:300,v:.45});t(110,.2,{w:'sawtooth',v:.3,to:40});n(.15,{f:1800,to:300,v:.3,at:.28})},
    magic:()=>{arp([392,523,659,988],.07,.22,{v:.13,w:'sine'});t(200,.6,{w:'sine',v:.1,to:1100});n(.4,{f:800,to:5000,v:.18,at:.5});t(1568,.3,{v:.12,w:'triangle',at:.55})},
    place:()=>{t(300,.06,{v:.16,w:'triangle',to:200});n(.04,{f:900,v:.1})},
    erase:()=>n(.07,{f:2500,to:800,v:.12}),
    pin:()=>{t(880,.05,{v:.14});t(1320,.09,{v:.14,at:.05})},
    type:()=>t(1200+Math.random()*300,.018,{v:.06}),
    short:()=>{
      for(let i=0;i<8;i++){n(.12,{f:3000+Math.random()*3000,v:.32,at:i*.3+Math.random()*.1});t(90+Math.random()*80,.22,{w:'sawtooth',v:.2,to:40,at:i*.3})}
      t(900,1.1,{w:'sawtooth',v:.2,to:30,at:2.6});n(.5,{f:2000,to:100,v:.3,at:2.6});
      t(55,1.6,{w:'square',v:.2,at:3.6})
    }
  };
  const FREE={type:1,dice:1};
  function play(k,sp){
    if(!on||!P[k]||!init()||ctx.state!=='running')return;
    const now=performance.now();
    if(!sp&&!FREE[k]&&now-last<35)return;
    last=now;if(sp)lastSp=now;
    try{P[k]()}catch(e){}
  }
  const toggle=()=>{on=!on;try{localStorage.setItem('nx_snd',on?'1':'0')}catch(e){}if(on)play('ok',1);return on};
  ['pointerdown','touchstart','keydown'].forEach(ev=>addEventListener(ev,init,{capture:true,passive:true}));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ctx&&ctx.state==='suspended')ctx.resume().catch(()=>{})});
  /* suono automatico su ogni pulsante */
  document.addEventListener('click',e=>{
    const el=e.target.closest&&e.target.closest('button,.tile,.item,summary,.stb,.chipb');
    if(!el||el.matches('[data-atk],[data-su],[data-use],[data-nko],[data-nlt],#sndbtn'))return;
    const inModal=!!el.closest('.modal');
    play(el.id==='bk'||el.id==='tb-back'?'back'
      :inModal&&el.matches('[data-x],[data-c],[data-n]')?'close'
      :inModal&&el.matches('[data-ok]')?'ok'
      :el.matches('.tile,[data-go],[data-npc],#tb-start,.item')?'tile'
      :el.classList.contains('d')?'danger':'click');
  },true);
  /* apertura di ogni finestra di dialogo (se non ha già un suono suo) */
  new MutationObserver(ms=>{for(const m of ms)for(const x of m.addedNodes)if(x.nodeType===1&&x.classList.contains('modal')&&performance.now()-lastSp>150)play('open',true)}).observe(document.body,{childList:true});
  /* pulsante muto/audio nella barra in basso */
  const st=document.createElement('style');
  st.textContent='body.locked #sndbtn{opacity:.4;min-width:0;width:40px;height:36px;padding:0;background:transparent;border-color:transparent;box-shadow:none;font-size:16px}body.locked #sndbtn:hover{opacity:1;background:var(--ink)}#sndbtn{font-size:16px}';
  document.head.append(st);
  const tb=document.getElementById('taskbar'),mb=document.getElementById('mbtn');
  if(tb){
    const b=document.createElement('button');b.className='tb-btn';b.id='sndbtn';b.setAttribute('aria-label','Suoni');
    const sync=()=>{b.textContent=on?'🔊':'🔇';b.title=on?'Suoni attivi (tocca per silenziare)':'Suoni disattivati'};
    sync();b.onclick=()=>{toggle();sync()};
    tb.insertBefore(b,mb||null);
  }
  /* ---- musichette a 8 bit per gli eventi (si fermano da sole; rispettano il tasto muto) ---- */
  const TH={
    generico:{b:108,r:60,w:'square',l:[0,4,7,12,7,4,7,null,5,9,12,9,7,5,4,null],s:[0,0,5,5,7,7,0,0]},
    pericolo:{b:150,r:57,w:'sawtooth',l:[0,null,3,null,6,null,3,null,0,null,3,5,6,null,5,3],s:[0,0,0,0,-2,-2,1,1]},
    combattimento:{b:170,r:55,w:'square',l:[0,0,3,0,5,0,3,0,0,0,7,0,5,3,2,0],s:[0,0,0,0,3,3,-2,-2]},
    scoperta:{b:96,r:62,w:'triangle',l:[0,7,12,16,12,7,12,16,14,9,14,17,14,9,12,7],s:[0,0,5,5,9,9,7,7]},
    mistero:{b:78,r:50,w:'sine',l:[0,null,null,3,null,null,7,null,6,null,null,3,null,null,2,null],s:[0,null,0,null,-4,null,-2,null]},
    festa:{b:132,r:67,w:'square',l:[0,4,7,4,0,4,7,12,12,9,7,9,5,7,4,2],s:[0,7,0,7,5,12,7,12]}
  };
  let mi=0,mk='';
  function musicStop(){clearInterval(mi);mi=0;mk=''}
  function music(k){
    if(!on||!init())return;
    k=TH[k]?k:'generico';if(mk===k&&mi)return;
    musicStop();mk=k;const T=TH[k],sd=60/T.b/2,fr=m=>440*Math.pow(2,(T.r+m-69)/12);let step=0,nt=ctx.currentTime+.15;
    mi=setInterval(()=>{
      if(!on){musicStop();return}
      while(nt<ctx.currentTime+.4){
        const s=step%16,l=T.l[s],b=T.s[s>>1],at=nt-ctx.currentTime;
        if(l!=null)t(fr(l),sd*.9,{at,w:T.w,v:.05});
        if(!(s&1)&&b!=null)t(fr(b-12),sd*1.8,{at,w:'triangle',v:.09});
        nt+=sd;step++;
      }
    },120);
  }
  return {play,toggle,sp:()=>lastSp,music,stopMusic:musicStop};
})();
const SND_ERR=/insufficien|non consentit|errat|non valid|esaurit|troppo|già registrata|non esiste|non disponibile|oltre|Limite|Max |non riconosciuto|non leggibile|Scegli|Scrivi|Salva prima|Fuori dalla|Nessun /i;
function toast(t){
  SND.play(SND_ERR.test(String(t))?'error':'toast');
  const k=document.querySelectorAll('.toast:not(.out)').length; /* più avvisi insieme: si impilano invece di sovrapporsi */
  const e=document.createElement('div');e.className='toast'+(SND_ERR.test(String(t))?' err':'');e.style.setProperty('--k',k);
  e.textContent=t;document.body.append(e);
  setTimeout(()=>{e.classList.add('out');setTimeout(()=>e.remove(),REDM()?0:260)},2200);
}

/* ---- form modale generica ---- */

/* ---- dati ---- */
async function guard(p){try{return await p}catch(e){toast('Operazione non consentita'+(e.message?': '+e.message:''));console.warn(e)}}
const me=()=>S.players[uid];

async function hash(pw,salt){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+pw));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const credDoc=()=>db.collection('data/users/'+uid).doc('cred');
async function redeem(it){
  const p=me(); if(!p||p.currency<it.price)return toast('Fondi insufficienti');
  if(it.stock!=null&&it.stock<=0)return toast('Esaurito');
  const xp=(p.xp||0)+(it.rtype==='xp'?it.amount:0), cur=p.currency-it.price+(it.rtype==='currency'?it.amount:0);
  const history=[{n:it.name,p:it.price,t:Date.now()},...(p.history||[])].slice(0,30);
  await guard(db.collection('players').doc(uid).update({currency:cur,xp,level:1+Math.floor(xp/100),history,...(it.rtype==='currency'?{}:{inv:[...(p.inv||[]),{id:uid8(),it:it.id,name:it.name,cat:it.cat||'oggetto',photo:it.photo||'',desc:it.desc||'',uses:it.use==='utilizzabile'?it.uses:null,bonuses:bonusesOf(it),arm:it.arm||0,...dmgCopy(it)}]})}));
  if(it.stock!=null)try{await db.collection('items').doc(it.id).update({stock:it.stock-1})}catch(e){}
  SND.play('buy',1);toast('Riscattato: '+it.name);
}

/* ---- viste ---- */

/* ---- pannello Master ---- */
const uid8=()=>Math.random().toString(36).slice(2,10);
/* Tiro di un dado a «faccia» facce: casuale vero (generatore crittografico del dispositivo),
   senza distorsioni: ogni faccia da 1 a N ha esattamente la stessa probabilità. */
function rollD(faces){
  faces=Math.max(2,faces|0);
  const c=window.crypto||window.msCrypto;
  if(c&&c.getRandomValues){
    const lim=Math.floor(4294967296/faces)*faces,b=new Uint32Array(1); /* scarta i valori che favorirebbero le facce basse */
    do{c.getRandomValues(b)}while(b[0]>=lim);
    return 1+b[0]%faces;
  }
  return 1+Math.floor(Math.random()*faces);
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
    try{const s=await mvDoc().get();const d=s.exists&&s.data().v;if(d)for(const k in d)MV[k]=[...new Set([...(MV[k]||[]),...(d[k]||[])])]}catch(e){}
    for(const k of ['players','npcs','items','quests','party','msgs','maps','bestiary','events'])
      db.collection(k).onSnapshot(s=>{S[k]={};s.docs.forEach(d=>S[k][d.id]=d.data());LD[k]=1;render()},e=>console.warn(k,e));
    render();
  }catch(e){console.warn(e);render()}
}
/* ===== v2: bacheche ===== */
tab=null;
const TILES=[['profile','👤','Profilo'],['ego','⚡','EGO'],['npcs','🧙','Incontri'],['scanner','🔍','Scanner'],['quests','📜','Obiettivi'],['party','🏕️','Party'],['inv','🎒','Inventario'],['msgs','✉️','Messaggi'],['map','🗺️','Mappa'],['events','🎭','Eventi']];
const KIND={mercante:'🛒 Mercante',combattente:'⚔️ Combattente',civis:'🏛️ Civis (cittadino)'},kindOf=n=>n.kind||'mercante';
const tiles=()=>{const M=masterOK&&view.name==='master';return `<div class="tiles">${TILES.filter(t=>!(M&&t[0]==='inv')&&!(!M&&t[0]==='scanner'&&!(me()&&me().scanner))&&!(!M&&t[0]==='events')).map(([k,i,l])=>{if(M&&k==='profile'){i='👥';l='Player'}return `<button class="tile" data-go="${k}"><span>${i}</span>${l}${badge(k,M)}</button>`}).join('')}</div>`};
const BLOODS=['Non indicato','A+','A-','B+','B-','AB+','AB-','0+','0-'];
const TR=[['vigore','VIGORE'],['agilita','AGILITÀ'],['acume','ACUME'],['panache','PANACHE'],['nexus','NEXUS']];
const AB=[['mira','Mira'],['rissa','Rissa'],['mischia','Mischia'],['convincere','Convincere'],['intimidire','Intimidire'],['atletica','Atletica'],['velocita','Velocità'],['furtivita','Furtività'],['notare','Notare'],['istruzione','Istruzione'],['concentrazione','Concentrazione'],['empatia','Empatia'],['creativita','Creatività']];
const trOf=p=>({...Object.fromEntries(TR.map(([k])=>[k,2])),...(p.traits||{})});
const abOf=p=>({...Object.fromEntries(AB.map(([k])=>[k,0])),...(p.abilities||{})});
const egoOf=p=>p.ego&&typeof p.ego==='object'?p.ego:{t:'',e:p.ego||''};
const egoHtml=p=>{const g=egoOf(p);return g.t||g.e?`<b style="font-size:1.2em;display:block;margin-top:4px">${esc(g.t)}</b><div class="mut" style="margin-top:6px">Effetto</div><p style="white-space:pre-wrap;margin:2px 0">${esc(g.e)}</p>`:'<span class="mut">Scrivi qui il potere del tuo personaggio.</span>'};
const traitsHtml=p=>{const t=trOf(p),pts=p.points||0;return `<div class="card" style="border-color:var(--acc3)"><div class="row sp"><h3 style="color:var(--acc3)">🧬 TRATTI</h3><span class="tag">Punti: ${pts}</span></div>${TR.map(([k,l])=>`<div class="row sp" style="margin-top:8px"><b>${l}</b><div class="row"><span style="letter-spacing:2px;color:var(--acc2)">${'●'.repeat(t[k])}${'○'.repeat(Math.max(0,5-t[k]))}</span><button data-tr="${k}" ${pts<1||t[k]>=5?'disabled':''}>+</button></div></div>`).join('')}</div>`};
const abHtml=p=>{const a=abOf(p);return `<div class="card"><h3>🎯 ABILITÀ</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px">${AB.map(([k,l])=>`<div class="row sp"><span>${l}</span><b style="color:var(--acc)">${a[k]}</b></div>`).join('')}</div></div>`};
const statsCard=p=>`<div class="card stats" style="grid-template-columns:repeat(2,1fr)"><div><b style="color:var(--ok)">🪙 ${p.currency}</b><span class="mut">Nummus</span></div><div><b style="color:var(--red2)">${p.blood&&p.blood!=='Non indicato'?esc(p.blood):'—'}</b><span class="mut">Gruppo sanguigno</span></div></div>`;
const av=n=>`<div class="avatar">${n.photo?`<img class="avatar" src="${esc(n.photo)}">`:'🩸'}</div>`;
const hdr=(t,back)=>`<div class="bar"><div class="row">${back?'<button class="g" id="bk">‹</button>':''}<h2>${t}</h2></div><div class="row">${masterOK&&view.name==='master'?'':'<button class="g" id="thm" title="Tema colore">🎨</button>'}<button class="g" id="out">${masterOK&&view.name==='master'?'Esci':'⎋'}</button></div></div>`;
function ask(title,fields,init={},okL){return new Promise(res=>{
 const m=document.createElement('div');m.className='modal';
 const inp=f=>f.t==='select'?`<select name="${f.n}">${f.o.filter(o=>o!=='xp').map(o=>`<option ${init[f.n]==o?'selected':''}>${o}</option>`).join('')}</select>`:f.t==='area'?`<textarea name="${f.n}" rows="3">${esc(init[f.n])}</textarea>`:f.t==='file'?`<input name="${f.n}" type="file" accept="image/jpeg,image/png,image/webp">`:f.t==='multi'?(f.o.length?f.o.map(([v,l])=>`<label class="row" style="margin:6px 0"><input type="checkbox" name="${f.n}" value="${esc(v)}" style="width:auto;margin:0" ${(init[f.n]||[]).includes(v)?'checked':''}>${esc(l)}</label>`).join(''):'<p class="mut">'+(f.e||'Nessun player registrato.')+'</p>'):`<input name="${f.n}" type="${f.t||'text'}" value="${esc(init[f.n])}">`;
 m.innerHTML=`<div><h3>${esc(title)}</h3>${fields.map(f=>`<label class="mut">${esc(f.l.replace('(monete/xp)','(Nummus)'))}</label>`+inp(f)).join('')}<div class="row"><button class="g grow" data-x>Annulla</button><button class="grow" data-ok>${esc(okL||'Salva')}</button></div></div>`;
 document.body.append(m);
 m.onclick=e=>{if(e.target.dataset.x!==undefined||e.target===m){m.remove();res(null)}
  if(e.target.dataset.ok!==undefined){const o={};for(const f of fields){if(f.t==='file'){o[f.n]=m.querySelector(`[name=${f.n}]`).files[0]||null;continue}if(f.t==='multi'){o[f.n]=[...m.querySelectorAll(`[name=${f.n}]:checked`)].map(x=>x.value);continue}const v=m.querySelector(`[name=${f.n}]`).value;o[f.n]=f.t==='number'?Math.max(0,parseInt(v)||0):v.trim()}m.remove();res(o)}};
})}
function render(){
  syncTheme();updateStatus();
  const v=view.name,M=masterOK&&v==='master';
  $('#mbtn').style.display=M?'none':'block';
  if(!db){app.innerHTML=`<div class="splash"><h2>Dati non raggiungibili</h2><p class="mut">Connessione ai dati non disponibile. Controlla js/config.js e la connessione a internet.</p></div>`;return}
  autoLogin();if(M){checkShortAns();checkChatM();renderMaster();markViewedM(tab);rebindItems();rebindDel();rebindMP();rebindV9();rebindNI();rebindDlg();rebindMX();return}
  if(!authed||!me())return renderSplash();checkShort();
  if(v!=='npc'){npcAnim=null;if(npcTy){npcTy.stop();npcTy=null}app.classList.remove('npcfx')}
  if(v==='npc')return renderNpc();
  if(welcomeRun&&v==='home')return; /* animazione di benvenuto in corso: non ricostruire la home */
  (v==='home'?renderHome():renderBoard());checkEnc();checkQ();checkM();checkMap();rebindDel();rebindV9();
}
function bind(){
  const th=$('#thm');if(th)th.onclick=themePicker;
  app.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{if(masterOK&&view.name==='master')tab=b.dataset.go;else view={name:b.dataset.go};render()});
  const o=$('#out');if(o)o.onclick=()=>{if(masterOK&&view.name==='master'){masterOK=false;view={name:'home'}}else{authed=false;view={name:'home'};try{localStorage.removeItem('nx_pid')}catch(e){}}render()};
  const k=$('#bk');if(k)k.onclick=()=>{if(masterOK&&view.name==='master')tab=null;else view={name:view.name==='npc'?'npcs':'home'};render()};
}
/* ===== VIGORE → HP massimi =====
   O = 10 · OO = 20 (base) · OOO = 20 + 1d8 (min 4) · OOOO = +1d10 (min 5) · OOOOO = +1d12 (min 6)
   I tiri si fanno una volta sola quando il livello sale e restano salvati in vigRolls. */
const VIG_ROLL={3:[8,4],4:[10,5],5:[12,6]};
let vigBusy=false;
function vigFix(p,nv,hpMax,hp){
  const old=trOf(p).vigore;
  if(nv===old||hpMax!==vit(p).hm)return {hpMax,hp:Math.min(hp,hpMax),vigRolls:p.vigRolls||{},gain:0,dice:[]};
  const rolls={...(p.vigRolls||{})},dice=[];let gain=0;
  if(nv>old){for(let l=old+1;l<=nv;l++){
    if(l===2)gain+=10;
    else if(VIG_ROLL[l]){const [d,m]=VIG_ROLL[l],g=Math.max(m,rollD(d));rolls[l]=g;gain+=g;dice.push(l+'°: +'+g)}
  }}else{for(let l=old;l>nv;l--){
    if(l===2)gain-=10;
    else if(VIG_ROLL[l]){gain-=rolls[l]!=null?rolls[l]:VIG_ROLL[l][1];delete rolls[l]}
  }}
  const hm=Math.max(1,hpMax+gain);
  return {hpMax:hm,hp:Math.min(hm,gain>0?hp+gain:hp),vigRolls:rolls,gain:hm-hpMax,dice};
}
/* ===== TRATTI → NEXUS massimo =====
   NEXUS massimo = NEXUS·200 + VIGORE·150 + ACUME·100 + differenziale
   Differenziale: 1d4 centinaia + 1d10 decine (unità sempre 0, quindi da 110 a 500).
   Si tira UNA sola volta per player, quando clicca per la prima volta su PROFILO (con animazione), e resta salvato in nxDiff.
   Finché non è stato tirato, il NEXUS massimo vale solo i tratti. */
const NX_MUL={nexus:200,vigore:150,acume:100};
const nxBase=t=>Object.entries(NX_MUL).reduce((a,[k,m])=>a+Math.max(0,t[k]|0)*m,0);
const nxNew=()=>{const m=nxBase(trOf({}));return {nxMax:m,nx:m}};
function nxFix(p,t,curMax,cur){
  const diff=p.nxDiff==null?0:p.nxDiff,base=nxBase(t),nm=base+diff,g=nm-curMax;
  return {upd:{nxMax:nm,nx:Math.min(nm,g>0?cur+g:cur)},first:false,
    msg:'🔷 NEXUS massimo '+nm+' ('+base+' tratti'+(p.nxDiff==null?'':' + '+diff+' dado')+')'};
}
/* primo ingresso in PROFILO: tiro del differenziale (due dadi veri: d4 e d10) con animazione.
   Il risultato viene salvato PRIMA di mostrare l'animazione, così non si può ritirare chiudendo o ricaricando. */
const nxRolled=new Set();
async function nxFirstRoll(p){
  if(!p||!uid||p.nxDiff!=null||nxRolled.has(uid))return;
  nxRolled.add(uid);
  const a=rollD(4),b=rollD(10),diff=a*100+b*10,base=nxBase(trOf(p)),nm=base+diff,v=vit(p),g=nm-v.nm;
  const ok=await guard(db.collection('players').doc(uid).update({nxDiff:diff,nxMax:nm,nx:Math.min(nm,g>0?v.n+g:v.n)}).then(()=>1));
  if(!ok){nxRolled.delete(uid);return}
  const faces=[4,10],dice=[a,b],lbl=['d4 · centinaia','d10 · decine'];
  const m=document.createElement('div');m.className='modal';
  m.innerHTML=`<div class="rolldlg"><h3>🔷 DIFFERENZIALE NEXUS</h3><div class="mut">1d4 centinaia + 1d10 decine</div><div class="dice">${dice.map((_,i)=>`<div><div class="die rolling"><b>?</b></div><div class="mut" style="margin-top:6px;font-size:.8em">${lbl[i]}</div></div>`).join('')}</div><div class="rres" style="visibility:hidden"><div class="mut">DIFFERENZIALE</div><div class="rtot">+${diff}</div><div class="mut">${a}×100 + ${b}×10 → NEXUS massimo ${nm}</div></div><div class="row" style="margin-top:14px"><button class="grow" data-c>Chiudi</button></div></div>`;
  document.body.append(m);
  const els=[...m.querySelectorAll('.die')],res=m.querySelector('.rres');let done=false,iv=0,q=false;SND.play('dice',1);
  const land=(d,i)=>{d.className='die land'+(dice[i]===faces[i]?' max':dice[i]===1?' min':'');d.firstChild.textContent=dice[i];if(!q)SND.play('land',1)};
  const fin=()=>{if(done)return;done=true;clearInterval(iv);q=true;els.forEach(land);SND.play(dice.some((x,i)=>x===faces[i])?'crit':'ok',1);res.style.visibility='visible';res.classList.add('rpop');if(navigator.vibrate)try{navigator.vibrate(40)}catch(e){}};
  const t0=Date.now();
  iv=setInterval(()=>{const k=Math.floor((Date.now()-t0-900)/300)+1;els.forEach((d,i)=>{if(i<k){if(!d.classList.contains('land'))land(d,i)}else d.firstChild.textContent=1+Math.floor(Math.random()*faces[i])});if(k<dice.length)SND.play('dice');if(k>=dice.length)fin()},70);
  m.onclick=e=>{
    if(e.target.dataset.c!==undefined||(e.target===m&&done)){clearInterval(iv);m.remove()}
    else if(!done)fin();
  };
}
let welcomeNew=null,welcomeRun=null;
function renderHome(){
  const p=me();app.innerHTML=hdr('🏠 Home')+homeCard(p)+tiles();bind();
  const first=welcomeNew===uid;welcomeNew=null;
  if(first&&!REDM())welcomeFx();
}
/* ===== animazione "il menu si costruisce" (solo al primo ingresso di un account appena creato; tocca per saltarla) ===== */
function welcomeFx(){
  const A=app,W=welcomeRun={t:[],iv:[],ty:null,sk:null};
  const T=(f,ms)=>W.t.push(setTimeout(f,ms));
  const bar=A.querySelector('.bar'),hi=A.querySelector('.hero .hi'),nm=A.querySelector('.hero .hname'),
        vts=[...A.querySelectorAll('.vt')],tl=[...A.querySelectorAll('.tile')],pill=A.querySelector('.hero .pill.eu');
  A.classList.add('wl');
  /* tessere: una dopo l'altra, riga per riga */
  tl.forEach((e,i)=>e.style.setProperty('--d',(2.3+i*.13)+'s'));
  if(hi)hi.textContent='Benvenuto';
  const nameTxt=nm?nm.textContent:'';if(nm)nm.textContent='';
  /* contatori e barre */
  const cnt=(to,set,dur,at)=>T(()=>{const s=performance.now(),iv=setInterval(()=>{const k=Math.min(1,(performance.now()-s)/dur);set(Math.round(to*k));if(k>=1)clearInterval(iv)},40);W.iv.push(iv)},at);
  const fills=[];
  vts.forEach(v=>{
    const i=v.querySelector('.vbar i'),sp=v.querySelector('.vl span'),n=sp&&sp.firstChild;
    if(i){fills.push([i,i.style.width]);i.style.width='0%'}
    if(n&&n.nodeType===3){const to=parseInt(n.nodeValue)||0;n.nodeValue='0';cnt(to,x=>{n.nodeValue=String(x)},900,1700)}
  });
  if(pill){const to=parseInt(pill.textContent.replace(/\D/g,''))||0;pill.textContent='🪙 0';cnt(to,x=>{pill.textContent='🪙 '+x},700,1250)}
  /* sequenza: titolo → scheda eroe → nome scritto → barre → tessere → lampo finale */
  T(()=>SND.play('open',1),350);
  T(()=>{if(nm)W.ty=typeInto(nm,nameTxt)},950);
  T(()=>SND.play('pin',1),1300);T(()=>SND.play('pin',1),1450);
  T(()=>fills.forEach(([i,w])=>i.style.width=w),1700);
  tl.forEach((_,i)=>T(()=>SND.play(i%2?'tile':'place',1),2300+i*130+250));
  T(()=>{SND.play('fanfare',1);const sw=document.createElement('div');sw.className='wl-sweep';A.append(sw);if(navigator.vibrate)try{navigator.vibrate([30,40,60])}catch(e){}},3900);
  T(()=>finish(),4800);
  function finish(){
    if(welcomeRun!==W)return;
    W.t.forEach(clearTimeout);W.iv.forEach(clearInterval);if(W.ty)W.ty.stop();
    A.removeEventListener('click',W.sk,true);A.classList.remove('wl');
    const sw=A.querySelector('.wl-sweep');if(sw)sw.remove();
    welcomeRun=null;render();
  }
  /* tocca per saltare */
  W.sk=e=>{e.stopPropagation();e.preventDefault();finish()};
  A.addEventListener('click',W.sk,true);
}
function renderBoard(){
  const p=me(),v=view.name;let b='';
  if(v==='profile')b=profileHtml(p);else if(0)b=hdr('👤 Profilo',1)+`<div class="card"><div class="row sp"><b>${esc(p.username)}</b><button class="g" id="ren">✎</button></div></div>`+statsCard(p)+`<div class="card"><label class="mut">🩸 Gruppo sanguigno</label><select id="bld" style="margin-bottom:0">${BLOODS.map(o=>`<option ${p.blood===o?'selected':''}>${o}</option>`).join('')}</select></div><div class="card" style="border:2px solid var(--acc2)"><div class="row sp"><h3 style="color:var(--acc2)">⚡ EGO</h3><button class="g" id="egoE">✎</button></div>${egoHtml(p)}</div>${traitsHtml(p)}${abHtml(p)}<div class="card" style="border-color:var(--acc)"><div class="row sp"><h3 style="color:var(--acc)">🗡️ SKILL</h3><button id="skA">+ Mossa</button></div>${(p.skills||[]).map((s,i)=>`<div class="row sp" style="margin-top:10px"><div><b>${esc(s.n)}</b><div class="mut" style="white-space:pre-wrap">${esc(s.d)}</div></div><button class="d" data-sk="${i}">✕</button></div>`).join('')||'<p class="mut">Nessuna mossa per ora.</p>'}</div><h3>Ultimi riscatti</h3>`+((p.history||[]).slice(0,5).map(h=>`<div class="mut">${esc(h.n)} · −${h.p}</div>`).join('')||'<p class="mut">Nessun riscatto.</p>');
  if(v==='npcs')b=hdr('🧙 Incontri',1)+(Object.values(S.npcs).filter(visN).map(n=>`<div class="card row" data-npc="${n.id}" style="cursor:pointer">${av(n)}<div class="grow"><b>${esc(n.name)}</b> <span class="tag">${KIND[kindOf(n)]}</span> <span class="tag" style="color:${attOf(n).c}">${attOf(n).i} ${attOf(n).l}</span> ${koTag(n)}<div class="mut">${esc(n.desc)}</div></div>›</div>`).join('')||'<p class="mut">Nessun incontro disponibile.</p>');
  if(v==='ego')b=egoBoard(p);if(v==='map')b=mapBoard(false);if(v==='inv')b=invBoard(p);if(v==='msgs')b=msgBoard(p);if(v==='party')b=partyBoard2(p);if(v==='quests')b=questBoard();else if(0)b=hdr('📜 Obiettivi',1)+(Object.values(S.quests).filter(q=>!(q.to&&q.to.length)||q.to.includes(uid)).map(q=>`<div class="card"><b>${esc(q.title)}</b><div class="row" style="margin-top:6px"><span class="tag">+${q.coins||0} 🪙</span></div></div>`).join('')||'<p class="mut">Nessun obiettivo per te al momento.</p>');
  app.innerHTML=b;bind();
  if(v==='profile')nxFirstRoll(p);
  markViewed(v);app.querySelectorAll('[data-npc]').forEach(e=>e.onclick=()=>{view={name:'npc',id:e.dataset.npc};render()});
  const U=d=>guard(db.collection('players').doc(uid).update(d));
  if($('#bld'))$('#bld').onchange=e=>U({blood:e.target.value});
  if($('#egoE'))$('#egoE').onclick=async()=>{const g=egoOf(p),r=await ask('EGO',[{l:'Titolo',n:'t'},{l:'Effetto',n:'e',t:'area'}],g);if(r)U({ego:{t:r.t.slice(0,80),e:r.e.slice(0,1500)}})};
  app.querySelectorAll('[data-tr]').forEach(x=>x.onclick=()=>{
    const t=trOf(p),k=x.dataset.tr;if((p.points||0)<1||t[k]>=5||vigBusy)return;
    const upd={traits:{...t,[k]:t[k]+1},points:p.points-1};
    if(k==='vigore'){
      const nv=t[k]+1,v=vit(p),vr=VIG_ROLL[nv];let gain=0,raw=0;const rolls={...(p.vigRolls||{})};
      if(nv===2)gain=10;
      else if(vr){raw=rollD(vr[0]);gain=Math.max(vr[1],raw);rolls[nv]=gain}
      Object.assign(upd,{hpMax:v.hm+gain,hp:v.h+gain,vigRolls:rolls});
      vigBusy=true;setTimeout(()=>{vigBusy=false},1200);
      if(vr)rollDice({title:'💪 VIGORE '+nv+'/5',n:1,die:vr[0],fix:0,min:vr[1],pre:[raw],lab:'HP MASSIMI IN PIÙ'});
      else toast('💪 VIGORE '+nv+'/5 · HP massimi +'+gain);
    }
    if(NX_MUL[k]){const vn=vit(p),nf=nxFix(p,upd.traits,vn.nm,vn.n);Object.assign(upd,nf.upd);setTimeout(()=>toast(nf.msg),k==='vigore'?1700:0)}
    U(upd);
  });
  app.querySelectorAll('[data-ab]').forEach(x=>x.onclick=()=>{const a=abOf(p),k=x.dataset.ab;if((p.pointsAb||0)<1)return;U({abilities:{...a,[k]:a[k]+1},pointsAb:p.pointsAb-1})});
  app.querySelectorAll('[data-use]').forEach(x=>x.onclick=()=>useItem(x.dataset.use));
  app.querySelectorAll('[data-atk]').forEach(x=>x.onclick=()=>attack(x.dataset.atk));const vi=vit(p);
  const hit=d=>{const a=d<0?armorOf(p):0;if(a>0){const dm=Math.max(0,-d-a);toast('🛡️ Armatura: −'+Math.min(a,-d)+' danni (subisci '+dm+')');return -dm}return d};
  app.querySelectorAll('[data-hp]').forEach(x=>x.onclick=()=>U({hp:Math.max(0,Math.min(vi.hm,vi.h+hit(+x.dataset.hp)))}));
  app.querySelectorAll('[data-hpc]').forEach(x=>x.onclick=()=>{const v=Math.abs(parseInt($('#hpc').value)||0);if(v)U({hp:Math.max(0,Math.min(vi.hm,vi.h+hit(v*(+x.dataset.hpc))))})});
  app.querySelectorAll('[data-nx]').forEach(x=>x.onclick=()=>U({nx:Math.max(0,Math.min(vi.nm,vi.n+(+x.dataset.nx)))}));
  app.querySelectorAll('[data-nxc]').forEach(x=>x.onclick=()=>{const v=Math.abs(parseInt($('#nxc').value)||0);if(v)U({nx:Math.max(0,Math.min(vi.nm,vi.n+v*(+x.dataset.nxc)))})});
  if($('#pdE'))$('#pdE').onclick=async()=>{const r=await ask('La tua descrizione nel party',[{l:'Descrizione',n:'pdesc',t:'area'}],p);if(r)U({pdesc:r.pdesc.slice(0,600)})};
  app.querySelectorAll('[data-send]').forEach(x=>x.onclick=()=>sendMoney(x.dataset.send));
  app.querySelectorAll('[data-it]').forEach(x=>x.onclick=()=>{invTab=x.dataset.it;render()});
  const skD=r=>({n:r.n.slice(0,60),c:r.c,e:r.e.slice(0,600),dmg:r.dmg.slice(0,60),dur:r.dur.slice(0,60),...dmgClean({...r,dfix:0},true)});
  if($('#skA'))$('#skA').onclick=async()=>{const r=await ask('Nuova skill',SKF,{c:0,dt:'d6'});if(r&&r.n)U({skills:[...(p.skills||[]),skD(r)]})};
  app.querySelectorAll('[data-se]').forEach(x=>x.onclick=async()=>{const i=+x.dataset.se,s=(p.skills||[])[i];if(!s)return;const r=await ask('Modifica skill',SKF,{...s,dt:s.dt||'d6',e:s.e??s.d??''});if(r&&r.n){const l=[...p.skills];l[i]=skD(r);U({skills:l})}});
  app.querySelectorAll('[data-su]').forEach(x=>x.onclick=()=>{const s=(p.skills||[])[+x.dataset.su];if(!s)return;const v=vit(p),c=s.c||0;if(v.n<c)return toast('NEXUS insufficiente');U({nx:v.n-c});SND.play('skill',1);toast('⚡ '+s.n+' usata: −'+c+' NEXUS');if((s.dn|0)>0)rollDice({title:'⚡ '+s.n,n:s.dn,die:dieOf(s),fix:/^\d+$/.test(String(s.dmg||'').trim())?+s.dmg:0,min:s.dmin|0})});
  app.querySelectorAll('[data-sk]').forEach(x=>x.onclick=()=>{if(confirm('Rimuovere la skill?'))U({skills:(p.skills||[]).filter((_,i)=>i!==+x.dataset.sk)})});
  if($('#ren'))$('#ren').onclick=async()=>{const r=await ask('Il tuo nome',[{l:'Username',n:'username'}],p);if(r&&r.username.length>=3)guard(db.collection('players').doc(uid).update({username:r.username.slice(0,32)}))};
}
function renderMaster(){
  const C=n=>db.collection(n);let b='';
  if(!tab)b=hdr('Pannello Master')+tiles();
  if(tab==='profile')b=(editing&&selP&&S.players[selP])?editScreen():masterPlayers();else if(0)b=hdr('👥 Player',1)+(Object.entries(S.players).map(([id,p])=>`<div class="card"><div class="row sp"><b>${esc(p.username)}</b><span class="tag">🪙 ${p.currency} · ${esc(p.blood||'—')} · ${p.points||0} PT · ${p.pointsAb||0} PA · ❤️${vit(p).h}/${vit(p).hm} 🔷${vit(p).n}/${vit(p).nm}</span></div><div class="row" style="margin-top:8px"><button class="g grow" data-pe="${id}">Modifica</button><button class="g" data-pa="${id}">Abilità</button><button class="d" data-pd="${id}">Elimina</button></div></div>`).join('')||'<p class="mut">Nessun player registrato.</p>');
  if(tab==='npcs')b=hdr('🧙 Incontri',1)+`<button id="addN" style="width:100%">+ Nuovo incontro</button>`+Object.values(S.npcs).map(n=>`<div class="card"><div class="row">${av(n)}<div class="grow"><b>${esc(n.name)}</b> <span class="tag">${KIND[kindOf(n)]}</span> <span class="tag" style="color:${attOf(n).c}">${attOf(n).i} ${attOf(n).l}</span> ${n.active===false?'<span class="tag">nascosto</span>':''} ${koTag(n)}<div class="mut">${esc(n.desc)}</div><div class="mut">👁 ${n.to&&n.to.length?n.to.map(i=>esc(S.players[i]?.username||'?')).join(', '):'Tutti i player'}</div></div></div><div class="row" style="margin-top:8px"><button class="${n.active===false?'':'g'}" data-nv="${n.id}">${n.active===false?'👁 Rendi visibile':'🙈 Nascondi'}</button><button class="g grow" data-ne="${n.id}">Modifica</button><button class="g" data-np="${n.id}">📷</button><button class="d" data-nd="${n.id}">✕</button></div>${kindOf(n)==='mercante'?`<div class="row sp" style="margin-top:12px"><b>Shop</b><button data-ia="${n.id}">+ Oggetto</button></div>`+Object.values(S.items).filter(i=>i.npc===n.id).map(i=>`<div class="row sp" style="margin-top:8px"><div>${esc(i.name)} <span class="tag">🪙${i.price} · ${esc(i.rtype)}${i.rtype!=='item'?' +'+i.amount:''} · ${i.stock!=null?i.stock:'∞'}</span></div><div class="row"><button class="g" data-ie="${i.id}">✎</button><button class="d" data-id="${i.id}">✕</button></div></div>`).join(''):npcInvHtml(n)}${dlgMasterHtml(n)}</div>`).join('');
  if(tab==='quests')b=hdr('📜 Obiettivi',1)+`<button id="addQ" style="width:100%">+ Nuovo obiettivo</button>`+Object.values(S.quests).map(q=>`<div class="card">${questCard(q)}<div class="mut">Per: ${q.to&&q.to.length?q.to.map(i=>esc(S.players[i]?.username||'?')).join(', '):'tutti i player'}</div><div class="row" style="margin-top:8px;flex-wrap:wrap">${qAllDone(q)?'':`<button class="grow" data-qc="${q.id}">✅ Completato</button>`}${(q.doneBy||[]).length?`<button class="g grow" data-qo="${q.id}">↩ Riapri</button>`:''}<button class="g" data-qe="${q.id}">Modifica</button><button class="d" data-qd="${q.id}">✕</button></div></div>`).join('');
  if(tab==='party')b=masterParty();else if(0){const ids=(S.party.main&&S.party.main.members)||[];b=hdr('🏕️ Party',1)+`<button id="pmem" style="width:100%">Gestisci membri</button>`+(ids.filter(i=>S.players[i]).map(i=>memCard(S.players[i],false)).join('')||'<p class="mut">Nessun membro nel party.</p>')}
  if(tab==='msgs')b=masterMsgs();
  if(tab==='map')b=mapBoard(true);
  if(tab==='ego')b=hdr('⚡ EGO',1)+(Object.entries(S.players).map(([id,p])=>`<h3 style="margin-top:14px">${esc(p.username)}</h3>`+egoMasterCard(id,p)).join('')||'<p class="mut">Nessun player registrato.</p>');
  app.innerHTML=b;bind();
  const on=(a,fn)=>app.querySelectorAll(`[data-${a}]`).forEach(x=>x.onclick=()=>fn(x.dataset[a]));
  on('pe',async id=>{const p=S.players[id],t=trOf(p),r=await ask('Player',[{l:'Username',n:'username'},{l:'Nummus',n:'currency',t:'number'},{l:'Gruppo sanguigno',n:'blood',t:'select',o:BLOODS},{l:'Punti tratti',n:'points',t:'number'},{l:'Punti abilità',n:'pointsAb',t:'number'},{l:'HP massimi',n:'hpMax',t:'number'},{l:'HP attuali',n:'hp',t:'number'},{l:'NEXUS massimo',n:'nxMax',t:'number'},{l:'NEXUS attuale',n:'nx',t:'number'},...TR.map(([k,l])=>({l:l+' (valore)',n:k,t:'number'}))],{...p,points:p.points||0,pointsAb:p.pointsAb||0,...t,hpMax:vit(p).hm,hp:vit(p).h,nxMax:vit(p).nm,nx:vit(p).n});if(r){const vf=vigFix(p,Math.min(99,r.vigore),r.hpMax,r.hp);if(vf.gain)toast('💪 VIGORE: HP massimi '+(vf.gain>0?'+':'')+vf.gain+' → '+vf.hpMax);moneyNote(id,(r.currency||0)-(p.currency||0));guard(C('players').doc(id).update({vigRolls:vf.vigRolls,username:r.username||p.username,currency:r.currency,blood:r.blood,points:r.points,pointsAb:r.pointsAb,hpMax:vf.hpMax,hp:vf.hp,nxMax:r.nxMax,nx:Math.min(r.nx,r.nxMax),traits:Object.fromEntries(TR.map(([k])=>[k,Math.min(99,r[k])]))}))}});
  on('pa',async id=>{const p=S.players[id],r=await ask('Abilità',AB.map(([k,l])=>({l,n:k,t:'number'})),abOf(p));if(r)guard(C('players').doc(id).update({abilities:Object.fromEntries(AB.map(([k])=>[k,Math.min(99,r[k])]))}))});
  on('pd',id=>{if(confirm('Eliminare il player?'))guard(C('players').doc(id).delete())});
  const npcF=()=>[{l:'Nome',n:'name'},{l:'Descrizione',n:'desc',t:'area'},{l:'Frasi di approccio (una per riga: se ce ne sono più di una, ne esce una a caso)',n:'keys',t:'area'},{l:'Tipo',n:'kind',t:'select',o:['mercante','combattente','civis']},{l:'Atteggiamento',n:'att',t:'select',o:['neutrale','ostile','buono']},{l:'Visibile',n:'vis',t:'select',o:['sì','no']},{l:'Chi lo vede (nessuno selezionato = tutti i player)',n:'to',t:'multi',o:Object.entries(S.players).map(([i,p])=>[i,p.username])},{l:'Foto (max 2 MB)',n:'photo',t:'file'}];
  const upl=async f=>{if(!f)return '';if(!assets){toast('Upload non disponibile');return ''}if(f.size>2e6){toast('Foto oltre 2 MB');return ''}const a=await guard(assets.upload(f));return a?a.url:''};
  if($('#addN'))$('#addN').onclick=async()=>{const r=await ask('Nuovo incontro',npcF(),{kind:'mercante',vis:'sì',to:[]});if(r&&r.name){const id=uid8(),photo=await upl(r.photo);guard(C('npcs').doc(id).set({id,name:r.name,desc:r.desc,kind:r.kind,att:r.att,keys:splitL(r.keys),active:r.vis==='sì',photo,to:r.to}))}};
  on('ne',async id=>{const n=S.npcs[id],r=await ask('Modifica incontro',npcF(),{...n,keys:(n.keys||[]).join('\n'),kind:kindOf(n),vis:n.active===false?'no':'sì'});if(r&&r.name){const ph=r.photo?await upl(r.photo):'';guard(C('npcs').doc(id).update({name:r.name,desc:r.desc,kind:r.kind,att:r.att,keys:splitL(r.keys),active:r.vis==='sì',to:r.to,...(ph?{photo:ph}:{})}))}});
  /* tasto rapido: nasconde l'incontro; per renderlo visibile chiede chi lo vede (nessuno selezionato = tutti i player) */
  on('nv',async id=>{const n=S.npcs[id];if(!n)return;
    if(n.active!==false)return guard(C('npcs').doc(id).update({active:false}));
    const r=await ask('👁 Chi vede «'+n.name+'»?',[{l:'Chi lo vede (nessuno selezionato = tutti i player)',n:'to',t:'multi',o:Object.entries(S.players).map(([i,p])=>[i,p.username])}],{to:n.to||[]});
    if(r)guard(C('npcs').doc(id).update({active:true,to:r.to}))});
  on('nd',id=>{if(confirm('Eliminare questo incontro e il suo shop?')){Object.values(S.items).filter(i=>i.npc===id).forEach(i=>C('items').doc(i.id).delete());guard(C('npcs').doc(id).delete())}});
  on('np',id=>{const f=document.createElement('input');f.type='file';f.accept='image/jpeg,image/png,image/webp';f.onchange=async()=>{const file=f.files[0];if(!file)return;if(!assets)return toast('Upload non disponibile');if(file.size>2e6)return toast('Max 2 MB');const a=await guard(assets.upload(file));if(a)guard(C('npcs').doc(id).update({photo:a.url}))};f.click()});
  const itF=[{l:'Nome',n:'name'},{l:'Prezzo',n:'price',t:'number'},{l:'Ricompensa',n:'rtype',t:'select',o:['item','currency','xp']},{l:'Quantità ricompensa (monete/xp)',n:'amount',t:'number'},{l:'Scorte (0 = illimitato)',n:'stock',t:'number'}];
  const itSave=r=>({name:r.name,price:r.price,rtype:r.rtype,amount:r.amount,stock:r.stock>0?r.stock:null});
  on('ia',async nid=>{const r=await ask('Nuovo oggetto',itF,{rtype:'item'});if(r&&r.name){const id=uid8();guard(C('items').doc(id).set({id,npc:nid,active:true,...itSave(r)}))}});
  on('ie',async id=>{const i=S.items[id],r=await ask('Modifica oggetto',itF,{...i,stock:i.stock??0});if(r&&r.name)guard(C('items').doc(id).update(itSave(r)))});
  on('id',id=>{if(confirm('Eliminare l\'oggetto?'))guard(C('items').doc(id).delete())});
  const qF=()=>[{l:'Titolo',n:'title'},{l:'Tipo',n:'qt',t:'select',o:['principale','secondaria']},{l:'Compiti (uno per riga)',n:'objs',t:'area'},{l:'Tempo limite (scrivi quello che vuoi, vuoto se non cè)',n:'dl'},{l:'Ricompensa: Nummus',n:'coins',t:'number'},{l:'Ricompensa extra (testo, opzionale)',n:'rw'},{l:'Ricompensa: oggetti (scelti dai negozi degli incontri, opzionale)',n:'ri',t:'multi',e:'Nessun oggetto: creane prima nel negozio di un incontro.',o:Object.values(S.items).map(i=>[i.id,(CATI[i.cat||'oggetto']||'🎁')+' '+i.name])},{l:'Visibile a (nessuno selezionato = tutti)',n:'to',t:'multi',o:Object.entries(S.players).map(([i,p])=>[i,p.username])}];
  if($('#addQ'))$('#addQ').onclick=async()=>{const r=await ask('Nuovo obiettivo',qF(),{qt:'secondaria'});if(r&&r.title){const id=uid8();guard(C('quests').doc(id).set({id,...qData(r)}))}};
  on('qe',async id=>{const q=S.quests[id],r=await ask('Modifica obiettivo',qF(),{...q,qt:q.qt||'secondaria',objs:(q.objs||[]).join('\n'),dl:dlStr(q.dl)});if(r&&r.title)guard(C('quests').doc(id).update(qData(r)))});
  on('qd',id=>{if(confirm('Eliminare questo obiettivo?'))guard(C('quests').doc(id).delete())});
  on('qc',async id=>{
    const q=S.quests[id];if(!q)return;
    const done=q.doneBy||[],all=qRec(q),todo=all.filter(i=>!done.includes(i)),coins=Math.max(0,+q.coins||0);
    if(!todo.length)return toast('Nessun player a cui assegnarla');
    const r=await ask('✅ Obiettivo completato',[{l:'Chi l ha completato (riceve '+(coins?'🪙 '+coins:'la ricompensa')+')',n:'who',t:'multi',o:todo.map(i=>[i,S.players[i].username])}],{who:todo});
    if(!r)return;
    const who=(r.who||[]).filter(i=>S.players[i]&&!done.includes(i));
    if(!who.length)return toast('Nessun player selezionato');
    const ts=Date.now(),nd=[...done,...who],its=(q.ri||[]).map(i=>S.items[i]).filter(Boolean);
    await Promise.all(who.map(async pid=>{
      const pl=S.players[pid],upd={};
      if(coins>0)upd.currency=(pl.currency||0)+coins;
      if(its.length)upd.inv=[...(pl.inv||[]),...its.map(i=>({id:uid8(),it:i.id,name:i.name,cat:i.cat||'oggetto',photo:i.photo||'',desc:i.desc||'',uses:i.use==='utilizzabile'?i.uses:null,bonuses:bonusesOf(i),arm:i.arm||0,...dmgCopy(i)}))];
      if(Object.keys(upd).length)await guard(C('players').doc(pid).update(upd));
      const mid=uid8();
      await guard(C('msgs').doc(mid).set({id:mid,to:[pid],from:{t:'sys',name:'SISTEMA'},kind:'obiettivo',text:q.title,qid:q.id,v:coins,rw:q.rw||'',items:its.map(i=>({name:i.name,cat:i.cat||'oggetto',photo:i.photo||'',arm:i.arm||0,bonuses:bonusesOf(i)})),ts}));
    }));
    await guard(C('quests').doc(id).update({done:qAllDone({...q,doneBy:nd}),doneAt:ts,doneBy:nd}));
    toast('✅ Completato'+(coins?' · 🪙 '+coins+' a '+who.length+' player':'')+(its.length?' · '+its.length+' oggetti consegnati':'')+(q.rw?' · extra da consegnare: '+q.rw:''));
  });
  on('qo',id=>{if(confirm('Riaprire questo obiettivo? Le ricompense già date NON vengono tolte: completandola di nuovo verranno date ancora.'))guard(C('quests').doc(id).update({done:false,doneBy:[],doneAt:null}))});
  if($('#pmem'))$('#pmem').onclick=async()=>{const ids=(S.party.main&&S.party.main.members)||[],r=await ask('Membri del party',[{l:'Chi fa parte del party',n:'m',t:'multi',o:Object.entries(S.players).map(([i,p])=>[i,p.username])}],{m:ids});if(r)guard(C('party').doc('main').set({members:r.m}))};
}
/* ===== v3: profilo, incontri, shop ===== */
const LD={},visN=n=>n.active!==false&&(!(n.to&&n.to.length)||n.to.includes(uid));
const profileHtml=p=>{
  const t=trOf(p),a=abOf(p),pT=p.points||0,pA=p.pointsAb||0,g=egoOf(p),md=modOf(p),COL=Array(5).fill('var(--acc)');
  return hdr('👤 Profilo',1)+
  `<div class="hero"><div class="grow"><div class="row sp"><h2 style="margin:0">${esc(p.username)}</h2><button class="g" id="ren">✎</button></div><div class="row" style="margin-top:8px;flex-wrap:wrap"><span class="pill eu">🪙 ${p.currency}</span><span class="pill bl">🩸 ${p.blood&&p.blood!=='Non indicato'?esc(p.blood):'—'}</span></div></div></div>`+
  vitalsHtml(p)+woundCard(p,false)+`<div class="card"><label class="mut">Gruppo sanguigno</label><select id="bld" style="margin-bottom:0">${BLOODS.map(o=>`<option ${p.blood===o?'selected':''}>${o}</option>`).join('')}</select></div>`+
  (0?`<div class="ego"><div class="row sp"><span class="lab">⚡ EGO</span><button class="g" id="egoE">✎</button></div>${g.t||g.e?`<div class="et">${esc(g.t)}</div><div class="mut" style="margin-top:8px">EFFETTO</div><p style="white-space:pre-wrap;margin:2px 0">${esc(g.e)}</p>`:'<p class="mut">Scrivi qui il potere del tuo personaggio.</p>'}</div>`:'')+
  `<div class="card"><div class="row sp"><h3>🧬 TRATTI</h3><span class="pill">Punti tratti: ${pT}</span></div>${TR.map(([k,l],i)=>`<div style="margin-top:12px"><div class="row sp"><b>${l}</b><div class="row"><b style="color:${COL[i]}">${t[k]}${t[k]<=5?'/5':''}${md.tr[k]?` <span style="color:var(--ok)">+${md.tr[k]}</span>`:''}</b><button class="mini" data-tr="${k}" ${pT<1||t[k]>=5?'disabled':''}>+</button></div></div><div class="meter"><i style="width:${Math.min(100,t[k]*20)}%;background:${COL[i]}"></i></div></div>`).join('')}</div>`+
  `<div class="card"><div class="row sp"><h3>🎯 ABILITÀ</h3><span class="pill">Punti abilità: ${pA}</span></div><div class="abg">${AB.map(([k,l])=>`<div class="chip"><span>${l}</span><div class="row" style="gap:6px"><b>${a[k]}${md.ab[k]?`<span style="color:var(--ok)">+${md.ab[k]}</span>`:''}</b><button class="mini" data-ab="${k}" ${pA<1?'disabled':''}>+</button></div></div>`).join('')}</div></div>`+
  `<div class="card"><div class="row sp"><h3>🗡️ SKILL</h3><button id="skA">+ Mossa</button></div>${(p.skills||[]).map((s,i)=>skillCard(s,i,p)).join('')||'<p class="mut">Nessuna mossa per ora.</p>'}</div>`+
  `<h3>Ultimi acquisti</h3>`+((p.history||[]).slice(0,5).map(h=>`<div class="mut">${esc(h.n)} · −🪙 ${h.p}</div>`).join('')||'<p class="mut">Nessun acquisto.</p>');
};
let encOpen=false;
function renderNpc(){
  const n=S.npcs[view.id],p=me();if(!n||!visN(n)){view={name:'npcs'};return render()}
  const m=kindOf(n)==='mercante',its=Object.values(S.items).filter(i=>i.npc===n.id&&i.active!==false);
  app.innerHTML=hdr(esc(n.name),1)+`<div class="hero npc"><div class="portrait">${n.photo?`<img src="${esc(n.photo)}">`:'🩸'}</div><div><span class="pill">${KIND[kindOf(n)]}</span> <span class="pill" style="color:${attOf(n).c};border-color:${attOf(n).c}">${attOf(n).i} ${attOf(n).l}</span>${n.ko?' <span class="pill" style="color:var(--danger);border-color:var(--danger)">💀 K.O.</span>':''}<div class="npcdesc" style="margin-top:8px;white-space:pre-wrap">${esc(n.desc)}</div></div></div>`+phraseHtml(n)+dlgHtml(n)+(m?`<div class="wallet"><span>PORTAFOGLIO</span><b>🪙 ${p.currency}</b></div><h3>🛒 Bottega di ${esc(n.name)}</h3><div class="shopgrid">${its.map(i=>{const out=i.stock===0,poor=p.currency<i.price;return `<div class="item ${out?'out':''}" data-ii="${i.id}"><div class="ico">${i.photo?`${itImg(i.photo,72)}`:CATI[i.cat||'oggetto']}</div><b>${esc(i.name)}</b><span class="tag">${CATI[i.cat||'oggetto']} ${CATL[i.cat||'oggetto']}</span>${i.rtype==='currency'?`<div class="mut">Ricevi 🪙 ${i.amount}</div>`:''}${(i.cat==='armatura'&&i.arm)?`<div class="mut">🛡️ −${i.arm} danni</div>`:''}${(i.cat==='arma'&&hasDmg(i))?`<div class="mut">💥 ${dmgTxt(i)}</div>`:''}${costTxt(i)?`<div class="mut">${costTxt(i)} / uso</div>`:''}<div class="mut">${i.stock!=null?(out?'ESAURITO':'Scorte: '+i.stock):'Sempre disponibile'}</div><button data-r="${i.id}" ${out||poor?'disabled':''}>🪙 ${i.price}</button>${poor&&!out?'<div class="mut" style="font-size:.75em">Nummus insufficienti</div>':''}</div>`}).join('')||'<p class="mut">La bottega è vuota.</p>'}</div>`:(kindOf(n)==='civis'||dlgOf(n))?'':'<div class="card"><h3>⚔️ Combattente</h3><p class="mut">Nessuna azione disponibile per ora.</p></div>');
  markViewed('npcs',n.id);bind();dlgBind(n);app.querySelectorAll('[data-r]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();buy(S.items[b.dataset.r],n)});
  app.querySelectorAll('[data-ii]').forEach(c=>c.onclick=()=>buy(S.items[c.dataset.ii],n));
  npcFx(n);
}
/* animazione di apertura dell'Incontro: foto con pop, testi scritti piano piano, oggetti a cascata (solo alla prima apertura, non a ogni aggiornamento dati) */
let npcAnim=null,npcTy=null;
function npcFx(n){
  if(npcTy){npcTy.stop();npcTy=null}
  const first=npcAnim!==view.id;npcAnim=view.id;
  app.classList.toggle('npcfx',first);
  if(!first)return;
  const hero=app.querySelector('.hero.npc'),d=app.querySelector('.npcdesc'),b=app.querySelector('.bubble'),ph=b&&b.querySelector('.phr'),phTxt=ph?ph.textContent:'';
  app.querySelectorAll('.shopgrid .item').forEach((e,i)=>e.style.setProperty('--d',i));
  if(ph)ph.textContent='';
  const showPh=()=>{if(!b)return;b.classList.add('show');if(ph&&phTxt){SND.play('msg');npcTy=typeInto(ph,phTxt)}};
  if(d&&n.desc){const ty=typeInto(d,n.desc,false,showPh);if(!npcTy)npcTy=ty}else showPh();
  if(hero)hero.onclick=()=>{const s=npcTy;if(s)s.skip();if(npcTy&&npcTy!==s)npcTy.skip()};
}
/* ===== v4: oggetti, atteggiamenti, EGO ===== */
const ATT={buono:{i:'💚',c:'#1f8f5f',l:'Buono',s:'Sembra amichevole: puoi avvicinarti.'},neutrale:{i:'⚖️',c:'#b78103',l:'Neutrale',s:'Non sai ancora cosa aspettarti.'},ostile:{i:'💀',c:'#d02f3a',l:'Ostile',s:'Attenzione: è pericoloso!'}};
const attOf=n=>ATT[n.att]||ATT.neutrale;
const CATI={oggetto:'🎁',arma:'⚔️',armatura:'🛡️'},CATL={oggetto:'Oggetto',arma:'Arma',armatura:'Armatura'};
const BK={};TR.forEach(([k,l])=>BK[l]={t:'tr',k});AB.forEach(([k,l])=>BK[l]={t:'ab',k});
const armorOf=p=>(p.inv||[]).reduce((s,e)=>s+((e.cat||'oggetto')==='armatura'&&(e.uses==null||e.uses>0)?(+e.arm||0):0),0);
const armLine=p=>armorOf(p)>0?`<div class="mut" style="margin-top:10px">🛡️ Armatura: −${armorOf(p)} danni a ogni colpo</div>`:'';
const bonusLabel=b=>b?((b.t==='tr'?TR:AB).find(x=>x[0]===b.k)||[0,'?'])[1]:'nessuno';
const modOf=p=>{const m={tr:{},ab:{}};(p.inv||[]).forEach(e=>{if(e.uses==null||e.uses>0)bonusesOf(e).forEach(b=>{m[b.t][b.k]=(m[b.t][b.k]||0)+b.v})});return m};
const uploadPhoto=async f=>{if(!assets){toast('Upload non disponibile');return ''}if(f.size>2e6){toast('Foto oltre 2 MB');return ''}const a=await guard(assets.upload(f));return a?a.url:''};
const egoBoard=p=>{const g=egoOf(p),X=(p.egoX||[]).filter(x=>!x.h);return hdr('⚡ EGO',1)+`<div class="ego big"><div class="row sp"><span class="lab">IL POTERE DEL PERSONAGGIO</span><button class="g" id="egoE">✎</button></div>${g.t||g.e?`<div class="et" style="font-size:2em;text-align:center;margin:18px 0">${esc(g.t)}</div><div class="mut" style="letter-spacing:3px">EFFETTO</div><p style="white-space:pre-wrap;font-size:1.05em;margin:6px 0">${esc(g.e)}</p>`:'<p class="mut" style="margin:40px 0;text-align:center">Nessun EGO scritto.<br>Tocca ✎ per definire il tuo potere.</p>'}</div>`+X.map(x=>`<div class="ego"><span class="lab">${esc(String(x.t).toUpperCase())}</span><p style="white-space:pre-wrap;margin:8px 0 0">${esc(x.e)}</p></div>`).join('')};
const ITF=()=>[{l:'Nome',n:'name'},{l:'Prezzo (Nummus)',n:'price',t:'number'},{l:'Tipo',n:'cat',t:'select',o:['oggetto','arma','armatura']},{l:'Foto (max 2 MB)',n:'photo',t:'file'},{l:'Cosa dice il mercante (descrizione)',n:'desc',t:'area'},{l:'Utilizzo',n:'use',t:'select',o:['infinito','utilizzabile']},{l:'Numero di usi (solo se utilizzabile)',n:'uses',t:'number'},{l:'Bonus a tratti e abilità (uno per riga, es. "Mira +2" oppure "Vigore +1")',n:'bks',t:'area'},{l:'Riduzione danni (solo armature: punti di danno in meno a ogni colpo, 0 = nessuna)',n:'arm',t:'number'},...DMGF.map(f=>({...f,l:f.l+' (solo armi)'})),...COSTF,{l:'Scorte (0 = illimitate)',n:'stock',t:'number'}];
async function itData(r,old){const o={name:r.name,price:r.price,cat:r.cat,desc:r.desc,use:r.use,uses:r.use==='utilizzabile'?Math.max(1,r.uses):0,bonus:null,bonuses:bonusParse(r.bks),arm:r.cat==='armatura'?Math.min(999,Math.max(0,r.arm||0)):0,...dmgClean(r,r.cat==='arma'),...costClean(r),stock:r.stock>0?r.stock:null};if(r.photo){const u=await uploadPhoto(r.photo);if(u)o.photo=u}else if(!old)o.photo='';return o}
function rebindItems(){
  const IT=db.collection('items');
  app.querySelectorAll('[data-ia]').forEach(b=>b.onclick=async()=>{const r=await ask('Nuovo oggetto',ITF(),{cat:'oggetto',use:'infinito',bk:'nessuno',dt:'d6'});if(r&&r.name){const id=uid8();guard(IT.doc(id).set({id,npc:b.dataset.ia,active:true,rtype:'item',amount:0,...await itData(r)}))}});
  app.querySelectorAll('[data-ie]').forEach(b=>b.onclick=async()=>{const id=b.dataset.ie,i=S.items[id],r=await ask('Modifica oggetto',ITF(),{...i,use:i.use||'infinito',uses:i.uses||0,bks:bonusInit(i),stock:i.stock??0,...dmgInit(i)});if(r&&r.name)guard(IT.doc(id).update(await itData(r,i)))});
}
function checkEnc(){
  const p=me();if(!p||!authed||encOpen||!LD.npcs||!LD.players)return;
  const vis=Object.values(S.npcs).filter(visN),seen=p.seen;
  if(!Array.isArray(seen)){guard(db.collection('players').doc(uid).update({seen:vis.map(n=>n.id)}));return}
  const n=vis.find(x=>!seen.includes(x.id));if(!n)return;
  encOpen=true;const A=attOf(n),host=n.att==='ostile',good=n.att==='buono';SND.play(host?'alarm':'enc',1);
  const m=document.createElement('div');m.className='modal notif-m enc-m'+(host?' hurt':'');
  m.innerHTML=`<div class="notif encnotif ${host?'shake':''}" style="--nc:${A.c};text-align:center;border:2px solid ${A.c}"><h2 class="newenc" style="color:${A.c}">NUOVO INCONTRO</h2><div class="encav" style="border-color:${A.c}">${n.photo?`<img src="${esc(n.photo)}">`:'🩸'}</div><div class="encatt" style="color:${A.c};border-color:${A.c}">${A.i} ${A.l.toUpperCase()} ${A.i}</div><h3 class="encname">${esc(n.name)}</h3><div class="mut" style="animation-delay:.95s">${KIND[kindOf(n)]}</div><div class="mut" style="margin-top:4px;animation-delay:1.05s">${A.s}</div><div class="row" style="margin-top:14px;animation-delay:1.2s"><button class="g grow" data-c>Più tardi</button><button class="grow" data-i>Ispeziona</button></div></div>`;
  document.body.append(m);
  notifBurst(m.firstElementChild,host?'encostile':good?'encbuono':'enc');
  if(navigator.vibrate)try{navigator.vibrate(host?[200,100,200,100,320]:[40,40,90])}catch(e){}
  const done=async go=>{
    if(m.dataset.closing)return;m.dataset.closing=1;m.classList.add('notif-out');
    if(!REDM())await new Promise(r=>setTimeout(r,220));
    m.remove();encOpen=false;await guard(db.collection('players').doc(uid).update({seen:[...seen,n.id]}));if(go){view={name:'npc',id:n.id};render()}
  };
  m.onclick=e=>{if(e.target.dataset.c!==undefined)done(0);if(e.target.dataset.i!==undefined)done(1)};
}
const itImg=(u,sz)=>`<span class="iph" style="--s:${sz}px"><img src="${esc(u)}" alt="" loading="lazy"></span>`;
/* scrive il testo lettera per lettera (tocca per saltare) */
function typeInto(el,txt,slow,cb){
  const ch=Array.from(txt);let fin=false;const end=()=>{if(!fin){fin=true;if(cb)cb()}};
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){el.textContent=txt;end();return{skip(){},stop(){}}}
  let i=0;const step=slow?Math.max(45,Math.min(95,Math.floor(13000/Math.max(1,ch.length)))):Math.max(12,Math.min(32,Math.floor(4200/Math.max(1,ch.length))));
  el.classList.add('typing');el.textContent='';
  const t=setInterval(()=>{i++;if(i%2===0)SND.play('type');el.textContent=ch.slice(0,i).join('');if(i>=ch.length){clearInterval(t);el.classList.remove('typing');end()}},step);
  return{skip(){clearInterval(t);el.textContent=txt;el.classList.remove('typing');end()},stop(){clearInterval(t)}};
}
async function buy(it,n){
  if(!it)return;
  const p=me(),c=it.cat||'oggetto',b=it.bonus,cur=p.currency||0,out=it.stock===0,can=!out&&cur>=it.price;
  let ty=null;
  const ok=await new Promise(res=>{const m=document.createElement('div');m.className='modal';
    m.innerHTML=`<div class="itdlg"><div class="itph">${it.photo?`<img src="${esc(it.photo)}" alt="">`:`<span>${CATI[c]}</span>`}</div><h3 class="itn">${esc(it.name)}</h3><div class="row" style="flex-wrap:wrap;gap:6px;justify-content:center"><span class="pill">${CATI[c]} ${CATL[c]}</span><span class="pill">${it.use==='utilizzabile'?'Utilizzabile · '+it.uses+(it.uses===1?' uso':' usi'):'♾ Infinito'}</span>${bonusesOf(it).map(x=>`<span class="pill eu">+${x.v} ${esc(bonusLabel(x))}</span>`).join('')}${c==='armatura'&&it.arm?`<span class="pill eu">🛡️ −${it.arm} danni</span>`:''}${c==='arma'&&hasDmg(it)?`<span class="pill eu">💥 ${dmgTxt(it)}</span>`:''}${costTxt(it)?`<span class="pill">${costTxt(it)} / uso</span>`:''}</div>${it.desc?`<div class="bubble itsay" title="Tocca per leggere tutto subito"><div class="ittxt"></div></div>`:''}<div class="mut" style="text-align:center">Prezzo: 🪙 ${it.price} · ${can?'Ti resteranno: 🪙 '+(cur-it.price):out?'ESAURITO':'Nummus insufficienti'}</div><div class="row" style="margin-top:14px"><button class="g grow" data-n>${can?'Annulla':'Chiudi'}</button>${can?'<button class="grow" data-y>Acquista</button>':''}</div></div>`;
    document.body.append(m);
    const tx=m.querySelector('.ittxt');if(tx)ty=typeInto(tx,'“'+it.desc+'”');
    const sb=m.querySelector('.itsay');if(sb)sb.onclick=()=>{if(ty)ty.skip()};
    m.onclick=e=>{if(e.target.dataset.n!==undefined){if(ty)ty.stop();m.remove();res(0)}if(e.target.dataset.y!==undefined){if(ty)ty.stop();m.remove();res(1)}}});
  if(ok)redeem(it);
}
/* ===== v5: quest, party, HP/NEXUS, eliminazioni ===== */
const splitL=s=>(s||'').split('\n').map(x=>x.trim()).filter(Boolean);
const qData=r=>({title:r.title,qt:r.qt,objs:splitL(r.objs),dl:r.dl||'',coins:r.coins,rw:r.rw,ri:r.ri||[],to:r.to});
const dlStr=t=>typeof t==='number'?(t?new Date(t).toLocaleString('it-IT'):''):(t||'');
const visQ=q=>!(q.to&&q.to.length)||q.to.includes(uid);
const qBadge=q=>q.qt==='principale'?'<span class="pill" style="background:var(--gold);color:#fff;border-color:var(--gold)">★ PRINCIPALE</span>':'<span class="pill">Secondario</span>';
const qRec=q=>q.to&&q.to.length?q.to.filter(i=>S.players[i]):Object.keys(S.players);
const qAllDone=q=>{const r=qRec(q);return r.length>0&&r.every(i=>(q.doneBy||[]).includes(i))};
const questCard=q=>{const M=masterOK&&view.name==='master',dby=q.doneBy||[],dn=M?dby.length>0:dby.includes(uid),who=M?dby.map(i=>esc(S.players[i]?.username||'?')).join(', '):'',exp=false,dt=dlStr(q.dl);return `<div class="quest ${q.qt==='principale'?'main':''} ${exp?'exp':''} ${dn&&!M?'done':''}"><div class="row sp"><b style="font-size:1.1em">${esc(q.title)}</b>${qBadge(q)}</div>${(q.objs||[]).length?`<div class="mut" style="margin-top:8px;letter-spacing:2px">COMPITI</div>${q.objs.map(o=>`<div class="obj">◇ ${esc(o)}</div>`).join('')}`:''}<div class="row" style="margin-top:10px;flex-wrap:wrap;gap:6px">${dn?`<span class="pill eu">✔ Completato${who?' da '+who:''}</span>`:''}<span class="pill eu">🪙 +${q.coins||0}</span>${q.rw?`<span class="pill">🎁 ${esc(q.rw)}</span>`:''}${(q.ri||[]).map(id=>S.items[id]).filter(Boolean).map(i=>`<span class="pill">${CATI[i.cat||'oggetto']||'🎁'} ${esc(i.name)}</span>`).join('')}${dt?`<span class="pill" style="border-color:var(--gold);color:var(--gold)">⏳ ${esc(dt)}</span>`:'<span class="pill">∞ Nessun limite</span>'}</div></div>`};
const questBoard=()=>{const qs=Object.values(S.quests).filter(visQ),isD=q=>(q.doneBy||[]).includes(uid),act=qs.filter(q=>!isD(q)),sec=(t,l)=>l.length?`<h3>${t}</h3>`+l.map(q=>questCard(q)).join(''):'';return hdr('📜 Obiettivi',1)+(qs.length?sec('★ Principali',act.filter(q=>q.qt==='principale'))+sec('Secondari',act.filter(q=>q.qt!=='principale'))+sec('✔ Completati',qs.filter(isD)):'<p class="mut">Nessun obiettivo per te al momento.</p>')};
const vit=p=>{const hm=p.hpMax??20,nm=p.nxMax??1000;return {hm,nm,h:Math.min(hm,p.hp??hm),n:Math.min(nm,p.nx??nm)}};
const bar=(v,m,c)=>`<div class="vbar ${c}"><i style="width:${m?Math.max(0,Math.min(100,v/m*100)):0}%"></i><span>${v} / ${m}</span></div>`;
const vitalsHtml=p=>{const t=vit(p),st=(a,k)=>`<div class="steps">${a.map(d=>`<button class="mini ${d<0?'d':''}" data-${k}="${d}">${d>0?'+':''}${d}</button>`).join('')}</div>`,cu=k=>`<div class="row" style="margin-top:4px"><input id="${k}c" type="number" min="0" placeholder="Quantità personalizzata" style="margin:0"><button class="d mini" data-${k}c="-1">−</button><button class="mini" data-${k}c="1">+</button></div>`;return `<div class="card"><b style="color:var(--hp)">❤️ HP</b>${bar(t.h,t.hm,'hp')}${st([-10,-5,-1,1,5,10],'hp')}${cu('hp')}<div style="height:14px"></div><b style="color:var(--nx)">🔷 NEXUS</b>${bar(t.n,t.nm,'nx')}${st([-250,-100,-50,50,100,250],'nx')}${cu('nx')}${armLine(p)}</div>`};
const memCard=(m,mine)=>{const v=vit(m);return `<div class="pcard ${mine?'me':''}"><div class="row sp"><b style="font-size:1.15em">${esc(m.username)}</b>${mine?'<button class="g mini" id="pdE">✎ Descrizione</button>':(masterOK&&view.name==='master'?'':`<button class="mini" data-send="${Object.keys(S.players).find(k=>S.players[k]===m)}">💸 Invia Nummus</button>`)}</div><p class="mut" style="white-space:pre-wrap;margin:6px 0">${m.pdesc?esc(m.pdesc):'Nessuna descrizione.'}</p><div class="mut">❤️ HP</div>${bar(v.h,v.hm,'hp')}<div class="mut">🔷 NEXUS</div>${bar(v.n,v.nm,'nx')}</div>`};
const phraseHtml=n=>{const ks=n.keys||[];if(!ks.length)return '';if(view.ph===undefined)view.ph=ks[Math.floor(Math.random()*ks.length)];return `<div class="row" style="align-items:flex-start;margin:8px 0"><div class="bubble"><b>${esc(n.name)}</b><div class="phr">“${esc(view.ph)}”</div></div></div>`};
const askYes=msg=>new Promise(res=>{const m=document.createElement('div');m.className='modal';m.innerHTML=`<div style="text-align:center"><h3>${esc(msg)}</h3><div class="row" style="margin-top:14px"><button class="g grow" data-n>Annulla</button><button class="d grow" data-y>Elimina</button></div></div>`;document.body.append(m);m.onclick=e=>{if(e.target.dataset.n!==undefined){m.remove();res(0)}if(e.target.dataset.y!==undefined){m.remove();res(1)}}});
function rebindDel(){
  const on2=(a,msg,run)=>app.querySelectorAll(`[data-${a}]`).forEach(b=>b.onclick=async()=>{if(await askYes(msg))run(b.dataset[a])});
  on2('pd','Eliminare il player?',id=>guard(db.collection('players').doc(id).delete()));
  on2('nd','Eliminare questo incontro e tutto il suo shop?',id=>{Object.values(S.items).filter(i=>i.npc===id).forEach(i=>db.collection('items').doc(i.id).delete());guard(db.collection('npcs').doc(id).delete())});
  on2('qd','Eliminare questo obiettivo?',id=>guard(db.collection('quests').doc(id).delete()));
  on2('id','Eliminare questo oggetto?',id=>guard(db.collection('items').doc(id).delete()));
  on2('sk','Rimuovere la skill?',i=>{const p=me();guard(db.collection('players').doc(uid).update({skills:(p.skills||[]).filter((_,j)=>j!==+i)}))});
  app.querySelectorAll('[data-nd]').forEach(b=>b.textContent='🗑 Elimina');
}
function checkQ(){
  const p=me();if(!p||!authed||encOpen||!LD.quests||!LD.players)return;
  const vis=Object.values(S.quests).filter(visQ),seen=p.seenQ;
  if(!Array.isArray(seen)){guard(db.collection('players').doc(uid).update({seenQ:vis.map(q=>q.id)}));return}
  const q=vis.find(x=>!seen.includes(x.id));if(!q)return;
  encOpen=true;const main=q.qt==='principale',c=main?'var(--gold)':'var(--acc)',m=document.createElement('div');
  SND.play(main?'fanfare':'quest',1);
  m.className='modal notif-m quest-m'+(main?' qmain':'');
  const objs=q.objs||[],its=(q.ri||[]).map(i=>S.items[i]).filter(Boolean),dt=dlStr(q.dl),coins=Math.max(0,+q.coins||0);
  let k=0;const pill=(h,x)=>`<span class="pill qp ${x||''}" style="animation-delay:${(1.15+.12*k++).toFixed(2)}s">${h}</span>`;
  const objH=objs.length?`<div class="qobjs"><div class="mut" style="letter-spacing:3px;text-align:center">COMPITI</div>${objs.map((o,i)=>`<div class="qo" style="animation-delay:${(.95+.1*i).toFixed(2)}s">◇ ${esc(o)}</div>`).join('')}</div>`:'<div></div>';
  const rwH=pill('🪙 +<b class="qcn">'+coins+'</b>','eu')+(q.rw?pill('🎁 '+esc(q.rw)):'')+its.map(i=>pill((CATI[i.cat||'oggetto']||'🎁')+' '+esc(i.name))).join('')+(dt?pill('⏳ '+esc(dt),'qdl'):'');
  const bd=Math.max(1.2,1.2+.12*k,.95+.1*objs.length+.3).toFixed(2);
  m.innerHTML=`<div class="notif qnotif" style="--nc:${c};text-align:center;border:2px solid ${c}"><h2 class="newenc" style="color:${c}">NUOVO OBIETTIVO</h2><div class="encav" style="border-color:${c}">📜</div><div class="qtype" style="color:${c};border-color:${c}">${main?'★ PRINCIPALE':'SECONDARIO'}</div><h3>${esc(q.title)}</h3>${objH}<div class="row qrw" style="justify-content:center;gap:6px;flex-wrap:wrap;margin-top:12px">${rwH}</div><div class="row" style="margin-top:14px;animation-delay:${bd}s"><button class="g grow" data-c>Più tardi</button><button class="grow" data-i>Vedi obiettivo</button></div></div>`;
  document.body.append(m);
  notifBurst(m.firstElementChild,main?'questmain':'quest');
  if(navigator.vibrate)try{navigator.vibrate(main?[60,50,60,50,160]:[40])}catch(e){}
  /* le monete salgono da 0 al valore */
  const cn=m.querySelector('.qcn');
  if(cn&&coins>0&&!REDM()){
    cn.textContent='0';
    setTimeout(()=>{const t0=performance.now(),tick=n=>{const f=Math.min(1,(n-t0)/900);cn.textContent=Math.round(coins*(1-Math.pow(1-f,3)));if(f<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)},1200);
    setTimeout(()=>{cn.textContent=coins},2400);
  }
  const done=async go=>{
    if(m.dataset.closing)return;m.dataset.closing=1;m.classList.add('notif-out');
    if(!REDM())await new Promise(r=>setTimeout(r,220));
    m.remove();encOpen=false;await guard(db.collection('players').doc(uid).update({seenQ:[...seen,q.id]}));if(go){view={name:'quests'};render()}
  };
  m.onclick=e=>{if(e.target.dataset.c!==undefined)done(0);if(e.target.dataset.i!==undefined)done(1)};
}
/* nuova mappa mostrata dal Master: stessa notifica animata degli incontri.
   Il player salva per ogni mappa l'ultimo «shown» già visto (seenMp), così una mappa nascosta e poi rimostrata notifica di nuovo. */
function checkMap(){
  const p=me();if(!p||!authed||encOpen||!LD.maps||!LD.players)return;
  const vis=Object.values(S.maps||{}).filter(x=>x.pub!==false),seen=p.seenMp;
  if(!seen||typeof seen!=='object'||Array.isArray(seen)){guard(db.collection('players').doc(uid).update({seenMp:Object.fromEntries(vis.map(x=>[x.id,x.shown||0]))}));return}
  const m=vis.find(x=>(x.shown||0)>(seen[x.id]||0));if(!m)return;
  encOpen=true;SND.play('enc',1);
  const tp=(MAP_TYPES.find(t=>t[0]===(m.gt||(m.cfg&&m.cfg.type)))||[0,'🗺️ Mappa'])[1],sz=m.n||(m.cfg&&m.cfg.size)||'?';
  const el=document.createElement('div');el.className='modal notif-m enc-m map-m';
  el.innerHTML=`<div class="notif encnotif" style="--nc:var(--acc);text-align:center;border:2px solid var(--acc)"><h2 class="newenc" style="color:var(--acc)">NUOVA MAPPA</h2><div class="encav" style="border-color:var(--acc)">🗺️</div><div class="encatt" style="color:var(--acc);border-color:var(--acc)">📍 ESPLORA 📍</div><h3 class="encname">${esc(m.name)}</h3><div class="mut" style="animation-delay:.95s">${esc(tp)} · ${sz}×${sz}</div><div class="mut" style="margin-top:4px;animation-delay:1.05s">Il Master ti ha svelato un nuovo luogo.</div><div class="row" style="margin-top:14px;animation-delay:1.2s"><button class="g grow" data-c>Più tardi</button><button class="grow" data-i>Apri mappa</button></div></div>`;
  document.body.append(el);
  notifBurst(el.firstElementChild,'map');
  if(navigator.vibrate)try{navigator.vibrate([40,40,90])}catch(e){}
  const done=async go=>{
    if(el.dataset.closing)return;el.dataset.closing=1;el.classList.add('notif-out');
    if(!REDM())await new Promise(r=>setTimeout(r,220));
    el.remove();encOpen=false;await guard(db.collection('players').doc(uid).update({seenMp:{...seen,[m.id]:m.shown||0}}));
    if(go){view={name:'map'};mapSel=m.id;mpScroll=null;render()}
  };
  el.onclick=e=>{if(e.target.dataset.c!==undefined)done(0);if(e.target.dataset.i!==undefined)done(1)};
}
/* ===== v6: UI, vista Master sui player ===== */
let selP=null;
const bl=p=>p.blood&&p.blood!=='Non indicato'?esc(p.blood):'—';
/* notifiche rosse del player: contano solo ciò che non ha ancora visto in quella bacheca.
   Quando apre la bacheca, gli elementi correnti vengono segnati come visti (salvato sul suo profilo). */
const BIDS=k=>k==='npcs'?Object.values(S.npcs).filter(visN).map(x=>x.id):k==='quests'?Object.values(S.quests).filter(visQ).map(x=>x.id):k==='msgs'?myMsgs().map(x=>x.id):k==='map'?Object.values(S.maps||{}).filter(m=>m.pub!==false).map(x=>x.id):k==='scanner'?scList().map(x=>x.id):null;
const unread=k=>{const ids=BIDS(k);if(!ids)return 0;const p=me(),seen=(p&&p.viewed&&p.viewed[k])||[];return ids.filter(i=>!seen.includes(i)).length};
function markViewed(k,one){
  const p=me();if(!p||!authed||!LD.players)return;
  const need={npcs:'npcs',quests:'quests',msgs:'msgs',map:'maps',scanner:'bestiary'}[k];if(!need||!LD[need])return; /* dati non ancora caricati: non toccare nulla */
  const ids=BIDS(k);if(!ids)return;
  const seen=(p.viewed&&p.viewed[k])||[],add=one?[one]:ids;
  if(add.every(i=>seen.includes(i)))return;
  guard(db.collection('players').doc(uid).update({viewed:{...(p.viewed||{}),[k]:one?[...seen,one]:ids}}));
}
/* notifiche rosse del Master: come per i player, contano solo ciò che non ha ancora visto in quella bacheca.
   Salvate sul dispositivo e nel suo spazio privato. Messaggi: solo quelli scritti dai player agli incontri (NPC). */
let MV=(()=>{try{return JSON.parse(localStorage.getItem('nx_mview')||'{}')||{}}catch(e){return {}}})();
const mvDoc=()=>db.collection('data/users/'+uid).doc('mview');
const BIDM=k=>k==='profile'?Object.keys(S.players):k==='npcs'?Object.keys(S.npcs):k==='quests'?Object.keys(S.quests):k==='msgs'?Object.values(S.msgs).filter(m=>(m.to||[]).includes('@master')).map(x=>x.id):k==='map'?Object.keys(S.maps||{}):k==='scanner'?Object.entries(S.players).filter(([i,x])=>x.scan&&x.scan.t).map(([i,x])=>i+':'+x.scan.t):null;
const unreadM=k=>{const ids=BIDM(k);return ids?ids.filter(i=>!(MV[k]||[]).includes(i)).length:0};
function markViewedM(k){
  if(!k||!db)return;
  const need={profile:'players',npcs:'npcs',quests:'quests',msgs:'msgs',map:'maps',scanner:'players'}[k];if(!need||!LD[need])return;
  const ids=BIDM(k);if(!ids)return;
  const seen=MV[k]||[];if(ids.length===seen.length&&ids.every(i=>seen.includes(i)))return;
  MV={...MV,[k]:ids};
  try{localStorage.setItem('nx_mview',JSON.stringify(MV))}catch(e){}
  try{mvDoc().set({v:MV}).catch(()=>{})}catch(e){}
}
const badge=(k,M)=>{const u=M?unreadM(k):unread(k);return u?`<em class="bdg">${u}</em>`:''};
const homeCard=p=>{const v=vit(p),pc=(a,b)=>b?Math.max(0,Math.min(100,a/b*100)):0;return `<div class="hero"><div class="grow"><div class="hi">Bentornato</div><h2 class="hname">${esc(p.username)}</h2><div class="row" style="margin-top:10px;flex-wrap:wrap"><span class="pill eu">🪙 ${p.currency}</span><span class="pill bl">🩸 ${bl(p)}</span></div></div></div><div class="vitals"><div class="vt hp"><div class="vl"><b>❤️ HP</b><span>${v.h}<small> / ${v.hm}</small></span></div><div class="vbar hp"><i style="width:${pc(v.h,v.hm)}%"></i></div></div><div class="vt nx"><div class="vl"><b>🔷 NEXUS</b><span>${v.n}<small> / ${v.nm}</small></span></div><div class="vbar nx"><i style="width:${pc(v.n,v.nm)}%"></i></div></div></div>`};
const invRO=p=>`<div class="card"><h3>🎒 INVENTARIO</h3>${(p.inv||[]).map(e=>`<div class="move" style="border-left-color:var(--acc2)"><div style="font-size:1.6em">${e.photo?`${itImg(e.photo,44)}`:(CATI[e.cat]||'🎁')}</div><div class="grow"><b>${esc(e.name)}</b><div class="mut">${CATL[e.cat]||'Oggetto'} · ${e.uses==null?'♾ Infinito':e.uses+(e.uses===1?' uso':' usi')}${bonusesOf(e).length?` · <span style="color:var(--ok)">${bonusTxt(e)}</span>`:''}${e.cat==='armatura'&&e.arm?` · <span style="color:var(--ok)">🛡️ −${e.arm} danni</span>`:''}${dmgHtml(e)}</div></div></div>`).join('')||'<p class="mut">Inventario vuoto.</p>'}</div>`;
const masterPlayers=()=>{
  if(selP&&!S.players[selP])selP=null;
  if(!selP)return hdr('👥 Player',1)+(Object.entries(S.players).map(([id,p])=>{const v=vit(p);return `<div class="pcard"><div class="row sp"><b style="font-size:1.1em">${esc(p.username)}</b><div class="row" style="gap:6px"><span class="pill eu">🪙 ${p.currency}</span><span class="pill bl">🩸 ${bl(p)}</span></div></div><div class="mut" style="margin-top:8px">❤️ HP</div>${bar(v.h,v.hm,'hp')}<div class="mut">🔷 NEXUS</div>${bar(v.n,v.nm,'nx')}<div class="row" style="margin-top:10px"><button class="grow" data-open="${id}">👁 Apri profilo</button><button class="g" data-pe="${id}">✎</button><button class="d" data-pd="${id}">🗑</button></div></div>`}).join('')||'<p class="mut">Nessun player registrato.</p>');
  const p=S.players[selP],t=trOf(p),v=vit(p),md=modOf(p),COLS=Array(5).fill('var(--acc)');
  return hdr('👤 '+esc(p.username),1)+
  `<div class="hero"><div class="grow"><div class="row sp"><h2 style="margin:0">${esc(p.username)}</h2><div class="row"><button class="g" data-msg="${selP}">✉️</button><button class="g" data-pe="${selP}">✎ Modifica</button><button class="d" data-pd="${selP}">🗑</button></div></div><div class="row" style="margin-top:8px;flex-wrap:wrap"><span class="pill eu">🪙 ${p.currency}</span><span class="pill bl">🩸 ${bl(p)}</span><span class="pill">Punti tratti ${p.points||0}</span><span class="pill">Punti abilità ${p.pointsAb||0}</span></div></div></div>`+
  `<button class="d" style="width:100%;margin:6px 0 10px" data-short="${selP}">⚡ CORTOCIRCUITO</button>${p.shortAns?`<div class="card" style="border-color:var(--warn);margin:0 5px 10px 0">⚡ Risposta al cortocircuito: <b>${esc(p.shortAns.o)}</b><div class="mut">${new Date(p.shortAns.ts).toLocaleString('it-IT')}</div></div>`:''}<div class="card"><div class="mut">❤️ HP</div>${bar(v.h,v.hm,'hp')}<div class="mut">🔷 NEXUS</div>${bar(v.n,v.nm,'nx')}</div>`+
  woundCard(p,true)+`<div class="card"><h3>🧬 TRATTI</h3>${TR.map(([k,l],i)=>`<div style="margin-top:10px"><div class="row sp"><b>${l}</b><b style="color:${COLS[i]}">${t[k]}${md.tr[k]?` <span style="color:var(--ok)">+${md.tr[k]}</span>`:''}</b></div><div class="meter"><i style="width:${Math.min(100,t[k]*20)}%;background:${COLS[i]}"></i></div></div>`).join('')}</div>`+
  egoMasterCard(selP,p)+mxDesc(selP,p)+mxSkills(selP,p)+mxInv(selP,p);
};
/* ===== v7: inventario, messaggi, ferite, editor player ===== */
let invTab='arma',editing=false,draft={};
const PN={head:'Testa',neck:'Collo',torso:'Petto',abdomen:'Addome',armR:'Braccio destro',armL:'Braccio sinistro',foreR:'Avambraccio destro',foreL:'Avambraccio sinistro',handR:'Mano destra',handL:'Mano sinistra',legR:'Coscia destra',legL:'Coscia sinistra',shinR:'Gamba destra',shinL:'Gamba sinistra',footR:'Piede destro',footL:'Piede sinistro'};
const LV=['Sano','Lieve','Media','Grave'],WC=['#d3d9e6','#e0b100','#e07b1a','#d6334f'];
/* sagoma anatomica a curve: 16 zone. «R» = lato sinistro di chi guarda (destra del personaggio); le zone «L» sono lo specchio. */
const _M=m=>`<g transform="matrix(-1 0 0 1 240 0)">${m}</g>`;
const _PR={
 head:'<path d="M120 12C139 12 149 28 148 47C147 64 137 78 120 80C103 78 93 64 92 47C91 28 101 12 120 12Z"/><ellipse cx="91" cy="50" rx="4.5" ry="9"/><ellipse cx="149" cy="50" rx="4.5" ry="9"/>',
 neck:'<path d="M107 74C108 83 106 89 99 95L141 95C134 89 132 83 133 74Z"/>',
 torso:'<path d="M66 108C68 96 84 91 100 91L140 91C156 91 172 96 174 108C177 124 172 140 164 152C150 160 135 162 120 162C105 162 90 160 76 152C68 140 63 124 66 108Z"/>',
 abdomen:'<path d="M77 156C92 164 106 166 120 166C134 166 148 164 163 156C166 176 162 196 157 210C151 224 140 232 120 234C100 232 89 224 83 210C78 196 74 176 77 156Z"/>',
 arm:'<path d="M67 98C53 100 44 112 43 128C42 142 41 156 39 172L66 178C70 164 76 148 79 134C81 117 78 103 67 98Z"/>',
 fore:'<path d="M39 176L66 182C65 198 62 214 58 232L36 228C36 210 38 192 39 176Z"/>',
 hand:'<path d="M36 231L58 235C62 248 61 262 55 271C49 276 40 272 37 264C34 254 34 242 36 231Z"/>',
 leg:'<path d="M80 226C92 232 108 232 119 228L118 308C116 320 112 328 108 334L84 334C79 322 77 308 77 294C76 268 77 246 80 226Z"/>',
 shin:'<path d="M84 340L108 340C110 364 109 388 105 408L90 408C86 388 82 364 84 340Z"/>',
 foot:'<path d="M90 410L105 410C106 418 112 424 119 428C122 435 113 437 100 437L82 437C75 437 75 431 80 427C86 423 88 417 90 410Z"/>'
};
const PARTS=[['head',_PR.head],['neck',_PR.neck],['torso',_PR.torso],['abdomen',_PR.abdomen],['armR',_PR.arm],['armL',_M(_PR.arm),1],['foreR',_PR.fore],['foreL',_M(_PR.fore),1],['handR',_PR.hand],['handL',_M(_PR.hand),1],['legR',_PR.leg],['legL',_M(_PR.leg),1],['shinR',_PR.shin],['shinL',_M(_PR.shin),1],['footR',_PR.foot],['footL',_M(_PR.foot),1]];
const PCEN={head:[120,46],neck:[120,84],torso:[120,124],abdomen:[120,196],armR:[60,138],armL:[180,138],foreR:[52,204],foreL:[188,204],handR:[47,252],handL:[193,252],legR:[98,282],legL:[142,282],shinR:[96,376],shinL:[144,376],footR:[96,425],footL:[144,425]};
const WGROUP=[['Testa e collo',['head','neck']],['Busto',['torso','abdomen']],['Braccio dx',['armR','foreR','handR']],['Braccio sx',['armL','foreL','handL']],['Gamba dx',['legR','shinR','footR']],['Gamba sx',['legL','shinL','footL']],['Tutto',Object.keys(PN)]];
const _det='<g fill="none" stroke="rgba(20,18,36,.30)" stroke-width="1.3" stroke-linecap="round" pointer-events="none"><path d="M98 94C106 100 114 100 120 98C126 100 134 100 142 94"/><path d="M78 116C92 126 108 126 118 120M162 116C148 126 132 126 122 120"/><path d="M120 100V150"/><path d="M86 140C100 148 112 148 118 144M154 140C140 148 128 148 122 144"/><path d="M96 178C108 182 132 182 144 178M98 198C110 202 130 202 142 198"/><circle cx="120" cy="188" r="2"/><path d="M120 168V222"/><path d="M92 226C104 232 136 232 148 226"/><ellipse cx="96" cy="336" rx="8" ry="6"/><ellipse cx="144" cy="336" rx="8" ry="6"/><path d="M42 172C50 176 58 178 66 178"/><path d="M198 172C190 176 182 178 174 178"/><path d="M103 38q4 -2 8 0M129 38q4 -2 8 0" stroke-width="1.6"/><path d="M120 44v10q-3 2 0 3" /><path d="M112 66q8 4 16 0"/></g>';
const _wmark=(lv,x,y)=>lv===1?`<g stroke="#7a1f1f" stroke-width="2" stroke-linecap="round" pointer-events="none"><path d="M${x-6} ${y-4} l12 8"/><path d="M${x-6} ${y+2} l8 5" opacity=".6"/></g>`:lv===2?`<g pointer-events="none"><path d="M${x-8} ${y-7} l16 14" stroke="#5a0f14" stroke-width="3.2" stroke-linecap="round"/><path d="M${x-8} ${y-7} l16 14" stroke="#e8423f" stroke-width="1.6" stroke-linecap="round"/></g>`:lv>=3?`<g pointer-events="none"><path d="M${x-9} ${y-8} l18 16 M${x+9} ${y-8} l-18 16" stroke="#3b0a0f" stroke-width="3.6" stroke-linecap="round"/><path d="M${x-9} ${y-8} l18 16 M${x+9} ${y-8} l-18 16" stroke="#ff4a52" stroke-width="1.8" stroke-linecap="round"/><path d="M${x} ${y+9} q-4 5 0 8 q4 -3 0 -8z" fill="#d6334f"/></g>`:'';
const sil=(w,click,o)=>{o=o||{};const dm=o.dmg||{},hl=[].concat(o.hl||[]),sel=o.sel||[];
  return `<svg viewBox="0 0 240 446" style="width:100%;max-width:${o.w||240}px;margin:0 auto;display:block"><defs><linearGradient id="skl" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".42" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#0a0820" stop-opacity=".36"/></linearGradient><linearGradient id="skr" x1="1" x2="0" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".42" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#0a0820" stop-opacity=".36"/></linearGradient><radialGradient id="skg" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#7fe3ff" stop-opacity=".16"/><stop offset="1" stop-color="#7fe3ff" stop-opacity="0"/></radialGradient></defs>`+
  `<ellipse cx="120" cy="438" rx="62" ry="6" fill="rgba(0,0,0,.28)"/>`+
  PARTS.map(([k,s,mi])=>{const lv=w[k]||0,isH=hl.includes(k),isS=sel.includes(k),st=isH||isS?'#ffffff':lv?WC[lv]:'#4d566c',sw=isH||isS?3:1.8;
    return `<g data-part="${k}" data-st="${lv?WC[lv]:'#4d566c'}" fill="${WC[lv]}" stroke="${st}" stroke-width="${sw}" stroke-linejoin="round" style="${click?'cursor:pointer;':''}${lv>=3?'filter:drop-shadow(0 0 4px #d6334f);':''}${isS?'filter:drop-shadow(0 0 6px #7fe3ff);':''}">${s}</g><g fill="url(#${mi?'skr':'skl'})" stroke="none" pointer-events="none">${s}</g>`}).join('')+
  _det+PARTS.map(([k])=>(w[k]||0)>0?_wmark(w[k],PCEN[k][0],PCEN[k][1]):'').join('')+
  PARTS.map(([k])=>dm[k]>0?`<g pointer-events="none"><rect x="${PCEN[k][0]-15}" y="${PCEN[k][1]+(w[k]>0?9:-8)}" width="30" height="15" rx="7" fill="#14121a" stroke="${WC[w[k]||1]}" stroke-width="1.5"/><text x="${PCEN[k][0]}" y="${PCEN[k][1]+(w[k]>0?20:3)}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="sans-serif">−${dm[k]}</text></g>`:'').join('')+`</svg>`;
};
let woundSel=[],woundSelP=null;
const woundBar=()=>{const sel=woundSelP===selP?woundSel:[];return `<div class="row" style="flex-wrap:wrap;gap:6px;justify-content:center;margin:8px 0">${WGROUP.map(([l,ks],i)=>`<button class="chipb mini ${ks.every(k=>sel.includes(k))?'sel':''}" data-wgr="${i}">${l}</button>`).join('')}</div><div class="row" style="gap:8px"><button class="g" data-wclr ${sel.length?'':'disabled'}>✕ Azzera</button><button class="grow" data-wgo ${sel.length?'':'disabled'}>🩹 Segnala ferita${sel.length?' ('+sel.length+(sel.length===1?' zona':' zone')+')':''}</button></div>`};
const woundCard=(p,M)=>{const w=p.wounds||{},dm=p.woundDmg||{},ks=Object.keys(w).filter(k=>w[k]>0&&PN[k]),tot=ks.reduce((s,k)=>s+(dm[k]||0),0);if(!M&&!ks.length)return '';return `<div class="card"><h3>🩹 ${M?'SAGOMA':'FERITE'}</h3>${M?'<div class="mut" style="text-align:center">Tocca una o più zone (o usa i gruppi), poi «Segnala ferita»: scegli gravità e danni, che si sottraggono agli HP</div>':''}${sil(w,M,{dmg:dm,sel:M&&woundSelP===selP?woundSel:[]})}${M?woundBar():''}<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px;justify-content:center">${ks.map(k=>`<span class="pill" style="border-color:${WC[w[k]]};color:${WC[w[k]]}">${PN[k]} · ${LV[w[k]]}${dm[k]?` · −${dm[k]} HP`:''}</span>`).join('')||'<span class="pill eu">Nessuna ferita</span>'}</div>${tot?`<div class="mut" style="text-align:center;margin-top:6px">Danni totali da ferite: <b style="color:var(--red2)">−${tot} HP</b></div>`:''}</div>`};
const msgFrom=m=>m.from&&m.from.t==='npc'?'🧙 '+esc(m.from.name):m.from&&m.from.t==='pl'?(m.kind==='chat'?'👤 ':'💸 ')+esc(m.from.name):'⚙️ SISTEMA';
const msgText=m=>m.kind==='ego'?'⚡ '+esc(m.text):m.kind==='obiettivo'?'🏆 Obiettivo completato: «'+esc(m.text)+'»':m.kind==='invite'?'🏕️ Invito al party «'+esc(m.text)+'»':m.kind==='ferita'?(m.lv?`🩹 ${(m.parts||[m.part]).map(k=>PN[k]||'').join(', ')}: ferita ${LV[m.lv].toLowerCase()}${m.dmg?` · −${m.dmg} HP`:''}`:`💚 ${(m.parts||[m.part]).map(k=>PN[k]||'').join(', ')}: guarito${m.heal?` · +${m.heal} HP`:''}`)+(m.hm?` · ❤️ ${m.hp}/${m.hm}`:'')+(m.text?' — '+esc(m.text):''):m.kind==='money'?`🪙 +${m.v}`+(m.text?' — '+esc(m.text):''):esc(m.text);
const msgAv=m=>m.from&&m.from.photo?`<img class="avatar" src="${esc(m.from.photo)}">`:`<div class="avatar">${m.kind==='ferita'?'🩹':m.kind==='money'?'🪙':m.kind==='obiettivo'?'🏆':m.kind==='ego'?'⚡':m.from&&m.from.t==='npc'?'🧙':m.kind==='chat'?'👤':'⚙️'}</div>`;
const openMsgs=new Set();
const msgReward=(m,force)=>{
  if(!force&&!openMsgs.has(m.id))return `<button class="mini" style="margin-top:10px" data-mopen="${m.id}">🎁 Apri ricompense</button>`;
  const its=m.items||[],row=(ico,t,s)=>`<div class="move" style="border-left-color:var(--gold)"><div style="font-size:1.6em">${ico}</div><div class="grow"><b>${t}</b>${s?`<div class="mut">${s}</div>`:''}</div></div>`;
  const rows=(m.v>0?row('🪙','+'+m.v+' Nummus',''):'')+its.map(i=>row(i.photo?`${itImg(i.photo,44)}`:(CATI[i.cat]||'🎁'),esc(i.name),(CATL[i.cat]||'Oggetto')+(bonusesOf(i).length?' · '+bonusTxt(i):'')+(i.cat==='armatura'&&i.arm?' · 🛡️ −'+i.arm+' danni':''))).join('')+(m.rw?row('🎁',esc(m.rw),'Extra'):'');
  return `<div class="mut" style="letter-spacing:2px;margin-top:10px">RICOMPENSE</div>`+(rows||'<p class="mut">Nessuna ricompensa.</p>')+(force?'':`<button class="g mini" style="margin-top:6px" data-mopen="${m.id}">Chiudi</button>`);
};
const myMsgs=()=>Object.values(S.msgs).filter(m=>!(m.to&&m.to.length)||m.to.includes(uid));
const msgTo=m=>{const a=(m.to||[]).filter(i=>i!=='@master').map(i=>esc(S.players[i]?S.players[i].username:'?')),n=(m.toNpc||[]).map(i=>'🧙 '+esc(S.npcs[i]?S.npcs[i].name:'?')),l=[...a,...n];return l.length?l.join(', '):'tutti i player'};
const sentMsgs=()=>Object.values(S.msgs).filter(m=>m.kind==='chat'&&m.from&&m.from.id===uid);
const sentHtml=()=>{const l=sentMsgs().sort((a,b)=>b.ts-a.ts);return l.length?'<h3>📤 Inviati</h3>'+l.map(m=>`<div class="card" style="border-left:4px solid var(--acc2);opacity:.85"><div class="mut">A: ${msgTo(m)} · ${new Date(m.ts).toLocaleString('it-IT')}</div><p style="white-space:pre-wrap;margin:6px 0 0">${esc(m.text)}</p></div>`).join(''):''};
async function composePlMsg(){
  const p=me();if(!p)return;
  const ids=(pm().members||[]).filter(i=>i!==uid&&S.players[i]),nn=Object.values(S.npcs).filter(visN);
  const r=await ask('✉️ Nuovo messaggio',[
    {l:'Ai membri del party',n:'to',t:'multi',o:ids.map(i=>[i,S.players[i].username]),e:'Non ci sono altri membri nel tuo party.'},
    {l:'Agli incontri (NPC)',n:'npc',t:'multi',o:nn.map(n=>[n.id,n.name]),e:'Nessun incontro disponibile.'},
    {l:'Messaggio',n:'text',t:'area'}],{to:[],npc:[]},'Invia');
  if(!r)return;
  const text=(r.text||'').slice(0,600);
  if(!text)return toast('Scrivi un messaggio');
  if(!r.to.length&&!r.npc.length)return toast('Scegli almeno un destinatario');
  const id=uid8();
  await guard(db.collection('msgs').doc(id).set({id,to:[...r.to,...(r.npc.length?['@master']:[])],toNpc:r.npc,from:{t:'pl',id:uid,name:p.username,photo:p.photo||''},kind:'chat',text,ts:Date.now()}));
  toast('Messaggio inviato');
}
const msgBoard=p=>hdr('✉️ Messaggi',1)+'<button id="plMsg" style="width:100%">✉️ Nuovo messaggio</button>'+(myMsgs().sort((a,b)=>b.ts-a.ts).map(m=>{const c=m.kind==='ferita'?(m.lv?'var(--red2)':'var(--ok)'):m.kind==='money'?'var(--ok)':m.kind==='obiettivo'?'var(--gold)':'var(--acc)';return `<div class="card" style="border-left:4px solid ${c}"><div class="row" style="gap:10px">${msgAv(m)}<div class="grow"><b>${msgFrom(m)}</b><div class="mut">${new Date(m.ts).toLocaleString('it-IT')}</div></div></div><p style="white-space:pre-wrap;margin:8px 0 0">${msgText(m)}</p>${m.kind==='obiettivo'?msgReward(m):''}</div>`}).join('')||'<p class="mut">Nessun messaggio.</p>')+sentHtml();
const masterMsgs=()=>hdr('✉️ Messaggi',1)+'<button id="newMsg" style="width:100%">✉️ Nuovo messaggio</button>'+(Object.values(S.msgs).sort((a,b)=>b.ts-a.ts).map(m=>`<div class="card"><div class="row sp"><b>${msgFrom(m)}</b><div class="row" style="gap:4px">${m.kind==='chat'&&m.from&&m.from.id?`<button class="g mini" data-rep="${m.id}">↩</button>`:''}${m.kind==='msg'||m.kind==='ego'?`<button class="g mini" data-mxe="${m.id}">✎</button>`:''}<button class="d mini" data-md="${m.id}">🗑</button></div></div><div class="mut">A: ${msgTo(m)} · ${new Date(m.ts).toLocaleString('it-IT')}</div><p style="white-space:pre-wrap;margin:6px 0 0">${msgText(m)}</p>${m.kind==='obiettivo'?msgReward(m,true):''}</div>`).join('')||'<p class="mut">Nessun messaggio inviato.</p>');
const invBoard=p=>{
  const tabs=[['arma','⚔️ Armi'],['armatura','🛡️ Armature'],['oggetto','🎁 Item'],['soldi','🪙 Soldi']];
  const head=hdr('🎒 Inventario',1)+`<div class="tabs">${tabs.map(([k,l])=>`<button class="${invTab===k?'on':''}" data-it="${k}">${l}</button>`).join('')}</div>`;
  if(invTab==='soldi')return head+`<div class="wallet"><span>SALDO</span><b>🪙 ${p.currency}</b></div><h3>Movimenti</h3>`+((p.tx||[]).map(x=>`<div class="move" style="border-left-color:${x.t==='in'?'var(--ok)':'var(--danger)'}"><div class="grow"><b>${x.t==='in'?'Ricevuti da ':'Inviati a '}${esc(x.n)}</b><div class="mut">${new Date(x.ts).toLocaleString('it-IT')}</div></div><b style="color:${x.t==='in'?'var(--ok)':'var(--danger)'}">${x.t==='in'?'+':'−'}🪙 ${x.v}</b></div>`).join('')||'<p class="mut">Nessun movimento. Puoi inviare Nummus ai membri dalla bacheca Party.</p>');
  return head+`<button id="addItem" style="width:100%;margin:6px 0">+ Aggiungi ${CATL[invTab]}</button>`+((p.inv||[]).filter(e=>(e.cat||'oggetto')===invTab).map(invRow2).join('')||'<p class="mut">Nessun elemento in questa sezione.</p>');
};
/* notifica al player quando il Master gli aggiunge Nummus */
function moneyNote(pid,v){
  if(!(v>0))return;const id=uid8();
  guard(db.collection('msgs').doc(id).set({id,to:[pid],from:{t:'sys',name:'SISTEMA'},kind:'money',v,text:'',ts:Date.now()}));
}
async function sendMoney(toId){
  const p=me(),to=S.players[toId];if(!p||!to)return;
  const r=await ask('Invia Nummus a '+to.username,[{l:'Importo (Nummus)',n:'v',t:'number'},{l:'Messaggio (opzionale)',n:'note'}]);
  if(!r||r.v<1)return;if(r.v>p.currency)return toast('Nummus insufficienti');
  const ts=Date.now(),id=uid8();
  await guard(db.collection('players').doc(uid).update({currency:p.currency-r.v,tx:[{t:'out',n:to.username,v:r.v,ts},...(p.tx||[])].slice(0,30)}));
  await guard(db.collection('players').doc(toId).update({currency:(to.currency||0)+r.v,tx:[{t:'in',n:p.username,v:r.v,ts},...(to.tx||[])].slice(0,30)}));
  await guard(db.collection('msgs').doc(id).set({id,to:[toId],from:{t:'pl',name:p.username},kind:'money',v:r.v,text:r.note||'',ts}));
  SND.play('coin',1);toast('Inviati 🪙 '+r.v+' a '+to.username);
}
const stp=(f,l,a,b)=>`<div class="ed"><b>${l}</b><div class="row" style="gap:5px;margin-top:4px"><button class="g mini" data-f="${f}" data-d="${-b}">−${b}</button><button class="d mini" data-f="${f}" data-d="${-a}">−${a}</button><input type="number" data-n="${f}" value="${draft[f]}" style="margin:0;text-align:center;font-weight:800"><button class="mini" data-f="${f}" data-d="${a}">+${a}</button><button class="g mini" data-f="${f}" data-d="${b}">+${b}</button></div></div>`;
const st1=f=>`<div class="row" style="gap:4px"><button class="g mini" data-f="${f}" data-d="-1">−</button><input type="number" data-n="${f}" value="${draft[f]}" style="width:58px;margin:0;text-align:center;padding:4px"><button class="mini" data-f="${f}" data-d="1">+</button></div>`;
const editScreen=()=>{
  const d=draft,p=S.players[selP],COLS=Array(5).fill('var(--acc)');
  return hdr('✎ '+esc(p.username),1)+
  `<div class="hero"><div class="grow"><div style="opacity:.9">Username</div><input data-t="username" value="${esc(d.username)}" style="margin:4px 0 0;font-weight:700"></div></div>`+
  `<div class="card"><h3>🪙 NUMMUS</h3>${stp('currency','Saldo',10,100)}</div>`+
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
  const vf=vigFix(p,Math.min(99,d.t_vigore),d.hpMax,d.hp);
  const nt=Object.fromEntries(TR.map(([k])=>[k,Math.min(99,d['t_'+k])])),ot=trOf(p),vv=vit(p);
  /* se i tratti NEXUS/VIGORE/ACUME cambiano e il master non ha toccato a mano il massimo, la barra si ricalcola */
  const nf=Object.keys(NX_MUL).some(k=>nt[k]!==ot[k])&&d.nxMax===vv.nm?nxFix(p,nt,d.nxMax,d.nx):null;
  moneyNote(id,(d.currency||0)-(p.currency||0));
  guard(db.collection('players').doc(id).update({vigRolls:vf.vigRolls,username:(d.username||'').trim()||p.username,currency:d.currency,blood:d.blood,points:d.points,pointsAb:d.pointsAb,hpMax:vf.hpMax,hp:vf.hp,...(nf?nf.upd:{nxMax:d.nxMax,nx:Math.min(d.nx,d.nxMax)}),traits:nt,abilities:Object.fromEntries(AB.map(([k])=>[k,Math.min(99,d['a_'+k])]))}));
  editing=false;toast(vf.gain?'Salvato · VIGORE: HP massimi '+(vf.gain>0?'+':'')+vf.gain+' → '+vf.hpMax:(nf?nf.msg:'Modifiche salvate'));render();
}
async function composeMsg(pre,from){
  const nn=Object.values(S.npcs);
  const r=await ask('✉️ Nuovo messaggio',[{l:'Da parte di',n:'from',t:'select',o:['Sistema',...nn.map(n=>n.name)]},{l:'Destinatari (nessuno selezionato = tutti)',n:'to',t:'multi',o:Object.entries(S.players).map(([i,p])=>[i,p.username])},{l:'Messaggio',n:'text',t:'area'}],{from:from||'Sistema',to:pre?[pre]:[]});
  if(!r||!r.text)return;
  const n=nn.find(x=>x.name===r.from),id=uid8();
  guard(db.collection('msgs').doc(id).set({id,to:r.to,from:n?{t:'npc',name:n.name,photo:n.photo||''}:{t:'sys',name:'SISTEMA'},kind:'msg',text:r.text,ts:Date.now()}));
  toast('Messaggio inviato');
}
async function woundDlg(id,parts){
  parts=[].concat(parts).filter(k=>PN[k]);const p=S.players[id];if(!p||!parts.length)return;
  const N=parts.length,v=vit(p),arm=armorOf(p),w0=p.wounds||{},cur=Math.max(...parts.map(k=>w0[k]||0)),allH=parts.every(k=>!(w0[k]>0));
  const res=await new Promise(res=>{
    const m=document.createElement('div');m.className='modal';
    m.innerHTML=`<div style="max-height:92vh;overflow:auto"><h3>🩹 ${N===1?esc(PN[parts[0]]):N+' zone'} di ${esc(p.username)}</h3>${sil(Object.fromEntries(parts.map(k=>[k,cur||1])),false,{hl:parts,w:120})}
    <div class="mut" style="text-align:center;margin:4px 0">${parts.map(k=>esc(PN[k])).join(' · ')}<br>❤️ HP attuali: <b>${v.h}/${v.hm}</b></div>
    <label class="mut">Gravità${N>1?' (uguale per tutte le zone)':''}</label><select name="lv"><option>lieve</option><option>media</option><option>grave</option><option>guarito</option></select>
    <div data-w="hit"><label class="mut">Danni subiti (HP persi: si sottraggono subito agli HP)</label><input name="dmg" type="number" min="0" value="0" inputmode="numeric">
    ${N>1?`<label class="mut">Come applicare i danni</label><select name="mode"><option>a ogni zona</option><option>totali, divisi tra le zone</option></select>`:''}
    ${arm>0?`<label class="row" style="margin:6px 0"><input type="checkbox" name="arm" checked style="width:auto;margin:0">Applica armatura (🛡️ −${arm} danni${N>1?' per colpo/zona':''})</label>`:''}</div>
    <div data-w="heal" style="display:none"><label class="mut">HP recuperati con la guarigione (0 = nessuno)</label><input name="heal" type="number" min="0" value="0" inputmode="numeric"></div>
    <div name="pv" class="pill" style="display:block;text-align:center;margin:8px 0;white-space:normal"></div>
    <label class="mut">Nota per il player (opzionale)</label><textarea name="note" rows="2"></textarea>
    <div class="row"><button class="g grow" data-x>Annulla</button><button class="grow" data-ok>Segnala</button></div></div>`;
    document.body.append(m);
    const q=n=>m.querySelector(`[name=${n}]`),lvS=q('lv'),dI=q('dmg'),hI=q('heal'),aC=q('arm'),mS=q('mode'),pv=q('pv');let touched=false;
    lvS.value=allH?'lieve':['','lieve','media','grave'][cur];
    const calc=()=>{const heal=lvS.value==='guarito',raw=Math.max(0,parseInt(dI.value)||0),a=(aC&&aC.checked&&!heal)?arm:0,split=N>1&&mS&&mS.value.startsWith('totali');
      let effs;if(heal)effs=parts.map(()=>0);else if(split){const t=Math.max(0,raw-a),b=Math.floor(t/N),r=t-b*N;effs=parts.map((_,i)=>b+(i<r?1:0))}else effs=parts.map(()=>Math.max(0,raw-a));
      const eff=effs.reduce((x,y)=>x+y,0),hg=heal?Math.max(0,parseInt(hI.value)||0):0;return {heal,raw,a,effs,eff,hg,nh:Math.max(0,Math.min(v.hm,v.h-eff+hg)),split}};
    const upd=()=>{const c=calc();m.querySelector('[data-w=hit]').style.display=c.heal?'none':'';m.querySelector('[data-w=heal]').style.display=c.heal?'':'none';
      pv.textContent=c.heal?`💚 ${N>1?'Zone guarite':'Zona guarita'}${c.hg?` · +${c.hg} HP → ${c.nh}/${v.hm}`:''}`:`💥 ${c.split?c.raw+' totali':c.raw+(N>1?' × '+N+' zone':'')}${c.a?` − 🛡️${c.a}`:''} = −${c.eff} HP → ${c.nh}/${v.hm}${c.nh<=0?' · ☠️ HP a zero!':''}`;
      pv.style.color=c.heal?'var(--ok)':c.nh<=0?'var(--danger)':''};
    dI.oninput=()=>{if(!touched&&lvS.value!=='guarito'){const r=Math.max(0,parseInt(dI.value)||0)/Math.max(1,v.hm);lvS.value=r>.35?'grave':r>.15?'media':'lieve'}upd()};
    lvS.onchange=()=>{touched=true;upd()};if(aC)aC.onchange=upd;if(mS)mS.onchange=upd;hI.oninput=upd;upd();
    m.onclick=e=>{if(e.target.dataset.x!==undefined||e.target===m){m.remove();res(null)}
      if(e.target.dataset.ok!==undefined){const c=calc(),o={lv:['guarito','lieve','media','grave'].indexOf(lvS.value),note:q('note').value.trim(),...c};m.remove();res(o)}};
  });
  if(!res)return;
  const fresh=S.players[id]||p,wd={...(fresh.woundDmg||{})},w={...(fresh.wounds||{})},vf=vit(fresh),pd={};
  parts.forEach((k,i)=>{w[k]=res.lv;if(res.lv===0)delete wd[k];else{wd[k]=(wd[k]||0)+res.effs[i];pd[k]=res.effs[i]}});
  const hp=Math.max(0,Math.min(vf.hm,vf.h-res.eff+res.hg)),mid=uid8();
  await guard(db.collection('players').doc(id).update({wounds:w,woundDmg:wd,hp}));
  guard(db.collection('msgs').doc(mid).set({id:mid,to:[id],from:{t:'sys',name:'SISTEMA'},kind:'ferita',part:parts[0],parts,pd,lv:res.lv,text:res.note||'',dmg:res.eff,raw:res.raw,arm:res.a,heal:res.hg,hp,hm:vf.hm,ts:Date.now()}));
  woundSel=[];
  toast(res.lv===0?'💚 Guarigione segnalata'+(res.hg?' · +'+res.hg+' HP':''):'🩹 Segnalato ('+N+(N===1?' zona':' zone')+'): −'+res.eff+' HP ('+hp+'/'+vf.hm+')');
}
/* selezione multipla delle zone sulla sagoma (Master) */
function woundBind(){
  if(!selP)return;if(woundSelP!==selP){woundSelP=selP;woundSel=[]}
  const refresh=()=>{
    app.querySelectorAll('[data-part]').forEach(g=>{const on=woundSel.includes(g.dataset.part);g.setAttribute('stroke',on?'#ffffff':g.dataset.st);g.setAttribute('stroke-width',on?3:1.8);g.style.filter=on?'drop-shadow(0 0 6px #7fe3ff)':''});
    app.querySelectorAll('[data-wgr]').forEach(b=>b.classList.toggle('sel',WGROUP[+b.dataset.wgr][1].every(k=>woundSel.includes(k))));
    const go=app.querySelector('[data-wgo]'),cl=app.querySelector('[data-wclr]'),n=woundSel.length;
    if(go){go.disabled=!n;go.textContent='🩹 Segnala ferita'+(n?' ('+n+(n===1?' zona':' zone')+')':'')}if(cl)cl.disabled=!n;
  };
  app.querySelectorAll('[data-part]').forEach(g=>g.onclick=()=>{const k=g.dataset.part,i=woundSel.indexOf(k);if(i>=0)woundSel.splice(i,1);else woundSel.push(k);refresh()});
  app.querySelectorAll('[data-wgr]').forEach(b=>b.onclick=()=>{const ks=WGROUP[+b.dataset.wgr][1],all=ks.every(k=>woundSel.includes(k));woundSel=all?woundSel.filter(k=>!ks.includes(k)):[...new Set([...woundSel,...ks])];refresh()});
  const cl=app.querySelector('[data-wclr]');if(cl)cl.onclick=()=>{woundSel=[];refresh()};
  const go=app.querySelector('[data-wgo]');if(go)go.onclick=()=>{if(woundSel.length)woundDlg(selP,[...woundSel])};
}
function rebindMP(){
  if(!tab){selP=null;editing=false}
  const bk=$('#bk');if(bk&&tab==='profile'&&selP)bk.onclick=()=>{if(editing)editing=false;else selP=null;render()};
  app.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{selP=b.dataset.open;render()});
  app.querySelectorAll('[data-pe]').forEach(b=>b.onclick=()=>editPlayer(b.dataset.pe));
  app.querySelectorAll('[data-msg]').forEach(b=>b.onclick=()=>composeMsg(b.dataset.msg));
  app.querySelectorAll('[data-short]').forEach(b=>b.onclick=async()=>{const id=b.dataset.short,pl=S.players[id];if(!pl)return;const r=await ask('⚡ Cortocircuito: '+pl.username,[{l:'Scritta che vedrà '+pl.username+' (scritta e opzioni vengono ricordate per la prossima volta)',n:'t',t:'area'},{l:'Opzione 1 (primo pulsante)',n:'o1'},{l:'Opzione 2 (secondo pulsante)',n:'o2'},{l:'🧬 Nuova parte EGO da svelare DOPO il cortocircuito: nome categoria (vuoto = nessuna)',n:'xt'},{l:'Testo della nuova parte EGO',n:'xe',t:'area'},{l:'Si svela SOLO se il player sceglie…',n:'xo',t:'select',o:['Opzione 1','Opzione 2','Qualsiasi risposta']},{l:'Testo della notifica al player (vuoto = automatico)',n:'xn',t:'area'}],{t:pl.shortMsg||SHORT_DEF,o1:(pl.shortO||[])[0]||SHORT_O[0],o2:(pl.shortO||[])[1]||SHORT_O[1],xt:(pl.shortEgo&&pl.shortEgo.t)||'',xe:(pl.shortEgo&&pl.shortEgo.e)||'',xo:['Opzione 1','Opzione 2','Qualsiasi risposta'][pl.shortEgo&&pl.shortEgo.o!=null?pl.shortEgo.o:0]||'Opzione 1',xn:(pl.shortEgo&&pl.shortEgo.n)||''},'⚡ Lancia');if(!r)return;const msg=(r.t||'').slice(0,200)||SHORT_DEF,xoI=Math.max(0,['Opzione 1','Opzione 2','Qualsiasi risposta'].indexOf(r.xo));guard(db.collection('players').doc(id).update({short:Date.now(),shortMsg:msg,shortO:[(r.o1||'').slice(0,40)||SHORT_O[0],(r.o2||'').slice(0,40)||SHORT_O[1]],shortEgo:{t:(r.xt||'').slice(0,80),e:(r.xe||'').slice(0,1500),n:(r.xn||'').slice(0,600),o:xoI}}));toast('⚡ Cortocircuito inviato a '+pl.username+(r.xt?' · EGO «'+r.xt.slice(0,40)+'» '+(xoI<2?'solo se sceglie «'+((xoI?r.o2:r.o1)||SHORT_O[xoI]).slice(0,40)+'»':'dopo qualsiasi risposta'):''))});
  woundBind();
  if($('#newMsg'))$('#newMsg').onclick=()=>composeMsg();
  app.querySelectorAll('[data-rep]').forEach(b=>b.onclick=()=>{const m=S.msgs[b.dataset.rep];if(!m||!m.from)return;const n=(m.toNpc||[]).map(i=>S.npcs[i]).find(Boolean);composeMsg(m.from.id,n?n.name:undefined)});
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
/* ===== v25: animazione notifiche (scintille, ingresso e uscita) ===== */
const REDM=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
function notifBurst(card,kind){
  if(REDM())return;
  const E={quest:['📜','✨'],questmain:['⭐','📜','✨','🏆'],ego:['⚡','✨'],money:['🪙','✨'],obiettivo:['🏆','✨','⭐'],ferita:['🩸','💥'],cura:['💚','✨'],invite:['🏕️','✨'],msg:['✉️','✨'],enc:['🩸','✨','👁'],encostile:['💀','⚠️','💥','🩸'],encbuono:['💚','✨','⭐','🤝'],map:['🗺️','🧭','📍','✨'],evento:['🎭','⚡','✨','🔥'],evpericolo:['⚠️','💥','🔥','⚡'],evfesta:['🎉','✨','🎊','⭐']}[kind]||['✨'];
  const a=card.querySelector('.encav');if(!a)return;
  const box=document.createElement('div');box.className='nparts';
  const cx=a.offsetLeft+a.offsetWidth/2,cy=a.offsetTop+a.offsetHeight/2,fall=kind==='money'?70:0;
  for(let i=0;i<18;i++){
    const ang=Math.PI*2*i/18+Math.random()*.35,dist=70+Math.random()*95,p=document.createElement('i');
    p.textContent=E[i%E.length];
    p.style.cssText=`left:${cx}px;top:${cy}px;--dx:${Math.cos(ang)*dist|0}px;--dy:${(Math.sin(ang)*dist+fall)|0}px;--r:${(Math.random()*360-180)|0}deg;--s:${12+(Math.random()*14|0)}px;--d:${(.38+Math.random()*.18).toFixed(2)}s;--t:${(.9+Math.random()*.6).toFixed(2)}s`;
    box.append(p);
  }
  card.append(box);
  setTimeout(()=>box.remove(),2300);
}
function checkM(){
  const p=me();if(!p||!authed||encOpen||!LD.msgs||!LD.players)return;
  const mine=myMsgs().sort((a,b)=>a.ts-b.ts),seen=p.seenM;
  if(!Array.isArray(seen)){guard(db.collection('players').doc(uid).update({seenM:mine.filter(m=>!(m.kind==='ego'&&Date.now()-m.ts<6048e5)).map(m=>m.id)}));return}
  const m=mine.find(x=>!seen.includes(x.id));if(!m)return;
  encOpen=true;SND.play(m.kind==='ferita'?(m.lv?'hurt':'heal'):m.kind==='money'?'coin':m.kind==='obiettivo'?'fanfare':m.kind==='invite'?'enc':m.kind==='ego'?'skill':'msg',1);const w=m.kind==='ferita',h=w&&m.lv>0,c=w?(m.lv?WC[m.lv]:'var(--ok)'):m.kind==='money'?'var(--ok)':m.kind==='obiettivo'?'var(--gold)':'var(--acc)';
  const title=w?(m.lv?'SEI STATO FERITO':'FERITA GUARITA'):m.kind==='money'?'HAI RICEVUTO NUMMUS':m.kind==='invite'?'INVITO AL PARTY':m.kind==='obiettivo'?'OBIETTIVO COMPLETATO':m.kind==='ego'?'EGO SVELATO':'NUOVO MESSAGGIO';
  const av=m.from&&m.from.photo?`<img src="${esc(m.from.photo)}">`:(w?'🩹':m.kind==='money'?'🪙':m.kind==='invite'?'🏕️':m.kind==='obiettivo'?'🏆':m.kind==='ego'?'⚡':m.from&&m.from.t==='npc'?'🧙':'⚙️');
  const el=document.createElement('div');el.className='modal notif-m'+(h?' hurt':'');
  el.innerHTML=`<div class="notif ${h&&m.lv>=3?'shake':''}" style="--nc:${c};text-align:center;border:2px solid ${c}"><h2 class="newenc" style="color:${c};font-size:1.6em">${title}</h2><div class="encav" style="border-color:${c}">${av}</div><h3>${msgFrom(m)}</h3>${w&&PN[m.part]?`<div style="max-width:150px;margin:6px auto">${sil(Object.fromEntries((m.parts||[m.part]).map(k=>[k,m.lv])),false,{hl:m.parts||[m.part],w:150,dmg:m.pd||{}})}</div>`:''}${w&&m.dmg?`<div style="font-size:2.4em;font-weight:700;color:${c};line-height:1.1">−${m.dmg} HP</div>${m.arm?`<div class="mut">🛡️ Armatura: −${Math.min(m.arm,m.raw||m.arm)} danni</div>`:''}`:''}${w&&!m.lv&&m.heal?`<div style="font-size:2.2em;font-weight:700;color:var(--ok)">+${m.heal} HP</div>`:''}${w&&m.hm?`<div class="mut" style="margin:4px 0">❤️ HP rimasti: <b>${m.hp}/${m.hm}</b>${m.hp<=0?' · ☠️':''}</div>`:''}<p style="white-space:pre-wrap">${m.kind==='obiettivo'?'«'+esc(m.text)+'»<br><span class="mut">Apri il messaggio per leggere le ricompense.</span>':msgText(m)}</p><div class="row" style="margin-top:14px">${m.kind==='invite'?'<button class="g grow" data-c>Dopo</button><button class="d grow" data-no>Rifiuta</button><button class="grow" data-yes>Accetta</button>':'<button class="g grow" data-c>Chiudi</button><button class="grow" data-i>'+(m.kind==='obiettivo'?'Apri messaggio':m.kind==='ego'?'Vedi EGO':'Apri messaggi')+'</button>'}</div></div>`;
  document.body.append(el);
  notifBurst(el.firstElementChild,w?(m.lv?'ferita':'cura'):m.kind);
  if(navigator.vibrate)try{navigator.vibrate(h?(m.lv>=3?[300,100,300]:[150]):[40])}catch(e){}
  const done=async go=>{if(el.dataset.closing)return;el.dataset.closing=1;el.classList.add('notif-out');if(!REDM())await new Promise(r=>setTimeout(r,220));el.remove();encOpen=false;await guard(db.collection('players').doc(uid).update({seenM:[...seen,m.id]}));if(go){if(m.kind==='obiettivo')openMsgs.add(m.id);view={name:m.kind==='ego'?'ego':'msgs'};render()}};
  el.onclick=e=>{if(e.target.dataset.c!==undefined)done(0);if(e.target.dataset.i!==undefined)done(1);if(e.target.dataset.yes!==undefined){done(0);respondInvite(true)}if(e.target.dataset.no!==undefined){done(0);respondInvite(false)}};
}
/* ===== v8: schermata iniziale, accesso, skill ===== */
let cuid=null;
const SKF=[{l:'Nome',n:'n'},{l:'Costo NEXUS',n:'c',t:'number'},{l:'Effetto',n:'e',t:'area'},{l:'Danno fisso (numero o testo libero)',n:'dmg'},{l:'Dadi di danno (0 = nessun dado)',n:'dn',t:'number'},{l:'Tipo di dado',n:'dt',t:'select',o:['d4','d6','d8','d10','d12','d20','d100']},{l:'Minimo del dado (ogni dado vale almeno questo numero, es. 2: un 1 conta 2; 0 = nessun minimo)',n:'dmin',t:'number'},{l:'Durata',n:'dur'}];
const skillCard=(s,i,p)=>{const c=s.c||0,eff=s.e??s.d??'',ok=p&&vit(p).n>=c;return `<div class="move" style="border-left-color:var(--nx);flex-direction:column;align-items:stretch"><div class="row sp"><b style="font-size:1.05em">${esc(s.n)}</b><span class="pill" style="border-color:var(--nx);color:var(--nx)">🔷 ${c}</span></div>${eff?`<div class="mut" style="white-space:pre-wrap">${esc(eff)}</div>`:''}<div class="row" style="flex-wrap:wrap;gap:6px">${s.dmg?`<span class="pill" style="border-color:var(--danger);color:var(--danger)">💥 ${esc(s.dmg)}</span>`:''}${(s.dn|0)>0?`<span class="pill" style="border-color:var(--danger);color:var(--danger)">🎲 ${dmgTxt(s)}</span>`:''}${s.dur?`<span class="pill" style="border-color:var(--gold);color:var(--gold)">⏳ ${esc(s.dur)}</span>`:''}</div>${p?`<div class="row" style="gap:6px"><button class="grow" data-su="${i}" ${ok?'':'disabled'}>⚡ Usa</button><button class="g mini" data-se="${i}">✎</button><button class="d mini" data-sk="${i}">✕</button></div>`:''}</div>`};
function authSheet(){
  const m=document.createElement('div');m.className='modal';
  m.innerHTML=`<div style="text-align:center"><div style="font-size:2.6em">🩸</div><h3>Entra in Nexus Connection</h3><button style="width:100%;margin:6px 0;padding:14px" data-n>🩸 Nuovo player<br><small style="font-weight:400">Crea un nuovo personaggio</small></button><button class="g" style="width:100%;margin:6px 0;padding:14px" data-a>🔑 Accedi<br><small style="font-weight:400">Ho già un account</small></button><button class="g mini" data-x style="margin-top:6px">Annulla</button></div>`;
  document.body.append(m);
  m.onclick=e=>{const b=e.target.closest('[data-n],[data-a],[data-x]');if(b){m.remove();if(b.dataset.n!==undefined)register();else if(b.dataset.a!==undefined)loginPlayer()}else if(e.target===m)m.remove()};
}
function enter(pid){
  if(LD.players&&!S.players[pid])return toast('Questo account non esiste più');
  uid=pid;authed=true;view={name:'home'};SND.play('login',1);
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
  if(ex&&LD.players&&!S.players[ex.pid])ex=null; /* player eliminato dal master: l'email torna libera */
  const legacy=cred&&cred.email===email&&!(LD.players&&cuid&&!S.players[cuid]);
  if(ex||legacy)return toast('Email già registrata: usa Accedi');
  const pid=uid8()+uid8(),salt=uid8()+uid8(),h=await hash(r.pw,salt);
  if(!(await guard(ad.set({pid,salt,hash:h}).then(()=>1))))return;
  if(!(await guard(db.collection('players').doc(pid).set({username:r.username.slice(0,32),currency:100,blood:'Non indicato',ego:'',skills:[],history:[],hpMax:20,hp:20,points:3,pointsAb:18,...nxNew(),created:Date.now()}).then(()=>1))))return;
  uid=pid;authed=true;view={name:'home'};welcomeNew=pid;SND.play('login',1);
  try{localStorage.setItem('nx_pid',pid)}catch(e){}
  render();
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
const IF=()=>[{l:'Nome',n:'name'},{l:'Tipo',n:'cat',t:'select',o:['oggetto','arma','armatura']},{l:'Foto (max 2 MB)',n:'photo',t:'file'},{l:'Descrizione',n:'desc',t:'area'},{l:'Utilizzo',n:'use',t:'select',o:['infinito','utilizzabile']},{l:'Numero di usi (solo se utilizzabile)',n:'uses',t:'number'},{l:'Bonus a tratti e abilità (uno per riga, es. "Mira +2" oppure "Vigore +1")',n:'bks',t:'area'},{l:'Riduzione danni (solo armature: punti di danno in meno a ogni colpo, 0 = nessuna)',n:'arm',t:'number'},...DMGF.map(f=>({...f,l:f.l+' (solo armi)'})),...COSTF];
async function invSave(r,old){const o={name:r.name.slice(0,60),cat:r.cat,desc:(r.desc||'').slice(0,400),uses:r.use==='utilizzabile'?Math.max(1,r.uses):null,bonus:null,bonuses:bonusParse(r.bks),arm:r.cat==='armatura'?Math.min(999,Math.max(0,r.arm||0)):0,...dmgClean(r,r.cat==='arma'),...costClean(r)};if(r.photo){const u=await uploadPhoto(r.photo);if(u)o.photo=u}else o.photo=old?(old.photo||''):'';return o}
const invRow2=e=>`<div class="move" style="border-left-color:var(--acc2)"><div style="font-size:1.6em">${e.photo?`${itImg(e.photo,48)}`:(CATI[e.cat]||'🎁')}</div><div class="grow"><b>${esc(e.name)}</b><div class="mut">${e.uses==null?'♾ Infinito':e.uses+(e.uses===1?' uso':' usi')}${bonusesOf(e).length?` · <span style="color:var(--ok)">${bonusTxt(e)}</span>`:''}${e.cat==='armatura'&&e.arm?` · <span style="color:var(--ok)">🛡️ −${e.arm} danni</span>`:''}${dmgHtml(e)}</div>${e.desc?`<div class="mut" style="white-space:pre-wrap;margin-top:4px">${esc(e.desc)}</div>`:''}</div><div class="row" style="gap:4px;flex-direction:column">${e.cat==='arma'&&hasDmg(e)?`<button class="mini" data-atk="${e.id}">⚔️ Attacca</button>`:((e.uses!=null||costTxt(e))?`<button class="mini" data-use="${e.id}">Usa</button>`:'')}<button class="g mini" data-ei="${e.id}">✎</button><button class="d mini" data-di="${e.id}">🗑</button></div></div>`;
function rebindV9(){
  mapInit();
  if($('#plMsg'))$('#plMsg').onclick=composePlMsg;
  app.querySelectorAll('[data-mopen]').forEach(b=>b.onclick=()=>{const id=b.dataset.mopen;if(openMsgs.has(id))openMsgs.delete(id);else openMsgs.add(id);render()});
  const pe=$('#pedit');if(pe)pe.onclick=editParty;
  const y=$('[data-pyes]'),n=$('[data-pno]');if(y)y.onclick=()=>respondInvite(true);if(n)n.onclick=()=>respondInvite(false);
  const U=d=>guard(db.collection('players').doc(uid).update(d));
  if($('#addItem'))$('#addItem').onclick=async()=>{const p=me();if(!p)return;const r=await ask('Nuovo oggetto',IF(),{cat:invTab==='soldi'?'oggetto':invTab,use:'infinito',bk:'nessuno',dt:'d6'});if(r&&r.name){const o=await invSave(r);U({inv:[...(p.inv||[]),{id:uid8(),it:'',...o}]})}};
  app.querySelectorAll('[data-ei]').forEach(b=>b.onclick=async()=>{const p=me(),e=p&&(p.inv||[]).find(x=>x.id===b.dataset.ei);if(!e)return;const r=await ask('Modifica oggetto',IF(),{...e,use:e.uses==null?'infinito':'utilizzabile',uses:e.uses||0,bks:bonusInit(e),...dmgInit(e)});if(r&&r.name){const o=await invSave(r,e);U({inv:p.inv.map(x=>x.id===e.id?{...x,...o}:x)})}});
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
const gclock=()=>{const c=S.party&&S.party.clock;if(c&&c.mode&&c.mode!=='real'&&c.base){return new Date(c.mode==='run'?c.base+(Date.now()-c.real):c.base)}return new Date()};
function tick(){
  const d=gclock(),t=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  const full=DAYS[d.getDay()]+' '+d.getDate()+' '+MONTHS[d.getMonth()],short=d.toLocaleDateString('it-IT');
  const c=document.getElementById('tb-clock');if(c&&c.textContent!==t)c.textContent=t;
  const dt=document.getElementById('tb-date');if(dt&&dt.textContent!==short)dt.textContent=short;
  document.querySelectorAll('.gtime').forEach(e=>e.textContent=t);
  document.querySelectorAll('.gdate').forEach(e=>e.textContent=full);
  const n=document.getElementById('tb-net');if(n){const on=navigator.onLine!==false;n.textContent=on?'Online':'Offline';n.classList.toggle('off',!on)}
  const w=document.getElementById('tb-clockw');if(w){w.style.cursor=masterOK?'pointer':'';w.title=masterOK?'Modifica data e ora (Master)':''}
}
function screenName(){
  if(masterOK&&view.name==='master'){const T={profile:'Player',ego:'EGO',npcs:'Incontri',quests:'Obiettivi',party:'Party',msgs:'Messaggi',map:'Mappa',events:'Eventi'};return 'Pannello Master'+(tab&&T[tab]?' — '+T[tab]:'')+' · build ego-notify 2'}
  if(!authed||!me())return 'Nexus Connection';
  if(view.name==='npc'){const n=S.npcs[view.id];return 'Incontro'+(n?' — '+n.name:'')}
  const N={home:'Home',profile:'Profilo',ego:'EGO',npcs:'Incontri',quests:'Obiettivi',party:'Party',inv:'Inventario',msgs:'Messaggi',map:'Mappa'};
  return 'Nexus Connection'+(N[view.name]?' — '+N[view.name]:'');
}
function updateStatus(){
  const inM=masterOK&&view.name==='master',p=!inM&&authed&&me();
  if(p){const v=vit(p),cu=p.currency||0;if(SN.u===uid){if(v.h<SN.hp)SND.play('hurt',1);else if(v.h>SN.hp)SND.play('heal',1);if(v.n!==SN.nx)SND.play('nx');if(cu>SN.cur)SND.play('coin',1)}SN.u=uid;SN.hp=v.h;SN.nx=v.n;SN.cur=cu}else SN.u=null;
  document.body.classList.toggle('locked',!p&&!inM);
  const t=screenName(),w=document.getElementById('win-title'),tt=document.getElementById('tb-title');
  if(w&&w.textContent!==t)w.textContent=t;if(tt&&tt.textContent!==t)tt.textContent=t;
  const tr=document.getElementById('tb-tray');
  if(tr){
    if(tr.dataset.h!==''){tr.dataset.h='';tr.innerHTML=''}
  }
  const hd=document.getElementById('hud');
  if(hd){
    let h='';
    if(p){const v=vit(p),pc=(a,b)=>b?Math.max(0,Math.min(100,a/b*100)):0;
      h=`<div class="hud-i hp"><div class="hl"><b>❤ HP</b><span>${v.h}/${v.hm}</span></div><div class="hb"><i style="width:${pc(v.h,v.hm)}%"></i></div></div><div class="hud-i nx"><div class="hl"><b>◆ NEXUS</b><span>${v.n}/${v.nm}</span></div><div class="hb"><i style="width:${pc(v.n,v.nm)}%"></i></div></div>`}
    if(hd.dataset.h!==h){hd.dataset.h=h;hd.innerHTML=h}
    hd.classList.toggle('on',!!h);
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
  app.classList.toggle('enter',key!==lastKey); /* animazione d'ingresso solo al cambio di schermata */
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
const pad2=n=>String(n).padStart(2,'0');
async function editClock(){
  const d=gclock(),c=(S.party&&S.party.clock)||{};
  const r=await ask('🕒 Data e ora',[{l:'Data',n:'d',t:'date'},{l:'Ora',n:'h',t:'time'},{l:'Modalità',n:'mode',t:'select',o:['scorre da questo momento','fermo','orario reale del dispositivo']}],
    {d:d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()),h:pad2(d.getHours())+':'+pad2(d.getMinutes()),mode:c.mode==='stop'?'fermo':c.mode==='run'?'scorre da questo momento':'orario reale del dispositivo'});
  if(!r)return;
  if(r.mode.startsWith('orario reale')){await guard(db.collection('party').doc('clock').set({mode:'real'}));toast('Orologio: orario reale');tick();return}
  const base=new Date(r.d+'T'+(r.h||'00:00')).getTime();
  if(isNaN(base))return toast('Data o ora non valide');
  await guard(db.collection('party').doc('clock').set({mode:r.mode==='fermo'?'stop':'run',base,real:Date.now()}));
  toast('Orologio aggiornato');tick();
}
tbOn('tb-clockw',()=>{if(masterOK)editClock()});

//#MAPCORE-START
const MAP_TYPES=[['terra','🌍 Terre e mari'],['isola','🏝️ Isola'],['dungeon','🏰 Dungeon'],['caverna','🕳️ Caverna'],['villaggio','🏘️ Villaggio'],['citta','🏙️ Città']];
const MAP_DEF={terra:{water:45,mount:35,forest:50,detail:4,rich:60},isola:{water:50,mount:35,forest:50,detail:4,rich:60},dungeon:{rooms:14,rsize:9,corr:1,treasure:4,rich:60},caverna:{dens:46,smooth:5,treasure:4,rich:60},villaggio:{houses:16,trees:45,pond:50,rich:70},citta:{cs:65,walls:70,river:55,trees:45,dens:75,rich:80}};
const MAP_SL={
  terra:[['water','Acqua',0,90],['mount','Montagne',0,100],['forest','Foreste',0,100],['detail','Dettaglio',1,10],['rich','Ricchezza di oggetti',0,100]],
  dungeon:[['rooms','Stanze',3,80],['rsize','Dimensione stanze',4,16],['corr','Larghezza corridoi',1,2],['treasure','Tesori',0,12],['rich','Ricchezza di oggetti',0,100]],
  caverna:[['dens','Densità roccia',35,60],['smooth','Smussatura',0,8],['treasure','Tesori',0,12],['rich','Ricchezza di oggetti',0,100]],
  villaggio:[['houses','Dimensione del villaggio',2,80],['trees','Alberi',0,100],['pond','Laghetto',0,100],['rich','Ricchezza di dettagli',15,100]],
  citta:[['cs','Estensione della città',20,100],['dens','Densità di edifici',20,100],['walls','Mura e torri',0,100],['river','Fiume',0,100],['trees','Alberi e orti',0,100],['rich','Ricchezza di dettagli',15,100]]};
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
const LANDS=[
 ['libera','🌍 Libera','Terre e mari sparsi, forma casuale'],
 ['isola','🏝️ Isola','Un\'unica isola al centro, circondata dal mare'],
 ['arcipelago','🌴 Arcipelago','Tante isole di varie dimensioni'],
 ['penisola','🦶 Penisola','Una grande terra che si allunga nel mare'],
 ['continente','🗺️ Continente','Un\'enorme massa di terra con coste frastagliate'],
 ['atollo','🪸 Atollo','Un anello di terra con una laguna al centro'],
 ['golfo','🌊 Golfo / baia','Una terra con una grande baia che entra dal mare'],
 ['istmo','🌉 Istmo','Due terre unite da una stretta lingua di terra'],
 ['lago','🏞️ Lago interno','Una terra con un grande lago al centro']];
const LAND_W={libera:45,isola:55,arcipelago:62,penisola:45,continente:28,atollo:65,golfo:28,istmo:55,lago:20};
const SIZES=[[16,'Minuscola'],[24,'Piccola'],[32,'Piccola+'],[40,'Medio-piccola'],[48,'Media'],[64,'Grande'],[80,'Molto grande'],[96,'Enorme'],[128,'Gigante'],[160,'Colossale'],[192,'Immensa']];
const sizeLbl=s=>{const e=SIZES.find(x=>x[0]===s);return s+' — '+(e?e[1]:'personalizzata')};
const sizeOpts=sel=>SIZES.map(([s])=>`<option value="${s}" ${+sel===s?'selected':''}>${s}×${s} · ${SIZES.find(x=>x[0]===s)[1]}</option>`).join('');
function landMask(land,seed){
  const r=mulberry32(hashSeed(seed+'#L')),th=r()*6.2832,ux=Math.cos(th),uy=Math.sin(th),asp=.85+r()*.3;
  const sm=t=>t<=0?0:t>=1?1:t*t*(3-2*t),q=t=>1-Math.min(1,t*t);
  const seg=(px,py,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(px-ax-dx*t,py-ay-dy*t)};
  if(land==='isola')return (u,v)=>q(Math.hypot(u*asp,v/asp));
  if(land==='continente')return (u,v)=>{const d=Math.hypot(u*asp,v/asp);return 1-Math.pow(Math.min(1,d/1.05),3)};
  if(land==='arcipelago'){const B=[],k=6+Math.floor(r()*4);for(let i=0;i<k;i++)B.push([(r()*2-1)*.72,(r()*2-1)*.72,.2+r()*.3]);return (u,v)=>{let m=0;for(const [x,y,rad] of B)m=Math.max(m,q(Math.hypot(u-x,v-y)/rad));return m}}
  if(land==='penisola'){const w=.17+r()*.1;return (u,v)=>{const t=u*ux+v*uy,s=-u*uy+v*ux,main=(1-sm((t+.1)/.45))*(1-sm((Math.abs(s)-.75)/.3)),pen=q(seg(u,v,-.1*ux,-.1*uy,.8*ux,.8*uy)/w);return Math.max(main*.95,pen)}}
  if(land==='atollo')return (u,v)=>Math.pow(Math.max(0,1-Math.abs(Math.hypot(u,v)-.62)/.22),.8);
  if(land==='golfo'){const rad=.28+r()*.1;return (u,v)=>{const d=Math.hypot(u,v),bay=q(seg(u,v,1.4*ux,1.4*uy,-.05*ux,-.05*uy)/rad);return .9*(1-bay)*(1-sm((d-1)/.35))}}
  if(land==='istmo')return (u,v)=>{const a=q(Math.hypot(u-.52*ux,v-.52*uy)/.46),b=q(Math.hypot(u+.52*ux,v+.52*uy)/.46),neck=q(seg(u,v,-.45*ux,-.45*uy,.45*ux,.45*uy)/.13);return Math.max(a,b,neck*.9)};
  if(land==='lago'){const cx=(r()*2-1)*.2,cy=(r()*2-1)*.2;return (u,v)=>{const d=Math.hypot(u,v),lake=q(Math.hypot(u-cx,v-cy)/.42);return Math.max(0,(1-Math.pow(Math.min(1,d/1.05),3))*.95-lake*.9)}}
  return null;
}
function inShape(s,x,y,n){
  const dx=(x+.5)/n*2-1,dy=(y+.5)/n*2-1;
  if(s==='tonda')return dx*dx+dy*dy<=1;
  if(s==='ovale')return dx*dx+dy*dy/.36<=1;
  if(s==='diamante')return Math.abs(dx)+Math.abs(dy)<=1;
  return true;
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
  if(m.npc){
    ctx.save();if(m.hid)ctx.globalAlpha=.75;
    ctx.beginPath();ctx.moveTo(cx,cy-r*1.25);ctx.lineTo(cx+r*1.25,cy);ctx.lineTo(cx,cy+r*1.25);ctx.lineTo(cx-r*1.25,cy);ctx.closePath();
    ctx.fillStyle=m.color;ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=m.hid?'#ffcb3d':'#fff';if(m.hid)ctx.setLineDash([4,3]);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#fff';ctx.font='bold '+Math.round(r*1.05)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(m.label,cx,cy+1);ctx.textAlign='start';
    ctx.restore();return;
  }
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=m.color;ctx.fill();
  ctx.lineWidth=m.me?3:2;ctx.strokeStyle='#fff';ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='bold '+Math.round(r*1.1)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(m.label,cx,cy+1);ctx.textAlign='start';
}
function mapNorm(c){
  c=c||{};const type=MAP_DEF[c.type]?c.type:'terra';
  const size=Math.min(192,Math.max(16,parseInt(c.size)||48));
  const o={...MAP_DEF[type],type,seed:String(c.seed==null?'nexus':c.seed).slice(0,40)||'nexus',size,pal:PAL[c.pal]?c.pal:'classica',grid:!!c.grid,shade:c.shade!==false,
    shape:SHAPES.some(s=>s[0]===c.shape)?c.shape:'quadrata',
    land:LANDS.some(l=>l[0]===c.land)?c.land:(type==='isola'?'isola':'libera'),
    scale:Math.min(1000,Math.max(0,+c.scale||0)),
    unit:UNITS.includes(c.unit)?c.unit:'m',
    addons:(Array.isArray(c.addons)?c.addons:[]).filter(a=>a&&ADDON_T.includes(a.t)&&Number.isInteger(a.x)&&Number.isInteger(a.y)&&a.x>=0&&a.y>=0&&a.x<size&&a.y<size).slice(0,500).map(a=>({t:a.t,x:a.x,y:a.y,s:Math.min(4,Math.max(1,parseInt(a.s)||1))}))};
  for(const [k,,a,b] of MAP_SL[type])if(c[k]!=null&&!isNaN(+c[k]))o[k]=Math.min(b,Math.max(a,+c[k]));
  return o;
}
function genTerra(c){
  const n=c.size,ns=mkNoise(hashSeed(c.seed+'#e')),nf=mkNoise(hashSeed(c.seed+'#f')),sc=1.5+c.detail*.55,land=c.land||(c.type==='isola'?'isola':'libera'),mk=land==='libera'?null:landMask(land,c.seed);
  const el=new Float32Array(n*n),codes=new Uint8Array(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    let e=fbm(ns,x/n*sc,y/n*sc,5);
    if(mk)e=e*.6+mk((x+.5)/n*2-1,(y+.5)/n*2-1)*.7;
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
function genFlat(c){
  const n=c.size,nz=mkNoise(hashSeed(c.seed+'#fl')),codes=new Uint8Array(n*n).fill(3),th=1-(c.trees==null?45:c.trees)/100*.5;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const f=fbm(nz,x/n*3.2,y/n*3.2,3);if(f>th+.05)codes[y*n+x]=4;else if(f<.2)codes[y*n+x]=5}
  return {codes,el:null};
}
function genMap(c){
  const d=(c.type==='terra'||c.type==='isola')?genTerra(c):c.type==='dungeon'?genDungeon(c):c.type==='caverna'?genCave(c):genFlat(c);
  if(c.shape!=='quadrata'){const n=c.size;for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(!inShape(c.shape,x,y,n))d.codes[y*n+x]=255}
  return d;
}
//#MAPCORE-END

/* ===== v13: editor mappe stile Inkarnate =====
   Terreno a pennello (19 terreni), oggetti/stamp liberi (scala, rotazione, specchio),
   testi, nebbia di guerra, segnalini, undo/redo, zoom. Il generatore casuale resta
   come punto di partenza. Formato salvato: v:2 (terreno e nebbia in RLE, oggetti in elenco).
   Le vecchie mappe (solo "cfg") vengono convertite automaticamente all'apertura. */
const TER=[ // [codice, etichetta, gruppo, priorità di sovrapposizione sui bordi]
 [0,'Acqua profonda','Acqua',0],[1,'Acqua bassa','Acqua',1],
 [2,'Sabbia','Terra',3],[3,'Erba','Terra',4],[4,'Foresta','Terra',5],[5,'Colline','Terra',6],[6,'Montagna','Terra',7],[7,'Neve','Terra',8],[17,'Ghiaccio','Terra',8.5],[8,'Sentiero','Terra',2],[13,'Palude','Terra',3.5],
 [9,'Pavimento','Dungeon',9],[15,'Ciottoli','Dungeon',9],[14,'Legno','Dungeon',9.5],[10,'Muro','Dungeon',11],[11,'Roccia scura','Dungeon',10],[12,'Lava','Dungeon',2.5],[16,'Tetto','Dungeon',10.5],[18,'Vuoto','Dungeon',20],[19,'Muratura','Dungeon',10.8],[20,'Campo arato','Terra',4.6],[21,'Campo di grano','Terra',4.7]];
const MGROUPS=['Acqua','Terra','Dungeon'],TPRI=[];TER.forEach(t=>TPRI[t[0]]=t[3]);
const mixC=(a,b,t)=>{const A=hexRGB(a),B=hexRGB(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('')};
const terCols=P=>[P.deep,P.shallow,P.sand,P.grass,P.forest,P.hill,P.mount,P.snow,P.road,P.floor,P.wall,P.rock,'#e8531f',mixC(P.forest,P.deep,.45),mixC(P.house,'#5a3b22',.55),P.corr,P.roof,'#c4e6f3','#0b0912',mixC(P.wall,'#ffffff',.42),mixC(P.sand,'#4a2f1c',.66),mixC(P.sand,'#e0aa32',.62)];
const COLC={};
function colsFor(pal){
  if(COLC[pal])return COLC[pal];
  const P=PAL[pal]||PAL.classica;
  return COLC[pal]=terCols(P).map(h=>({hex:h,sh:Array.from({length:9},(_,i)=>shadeC(h,.9+i*.025)),dk:shadeC(h,.72),lt:shadeC(h,1.28)}));
}
const mpZ=n=>Math.max(6,Math.min(32,Math.floor(1024/n)));
const _fr=(c,x,y,w,h)=>c.fillRect(x,y,Math.max(1,w),Math.max(1,h));
const TDET={
 0:(c,X,Y,Z,C,h)=>{if(h<.16){c.fillStyle=C.lt;_fr(c,X+Z*.2,Y+Z*.5,Z*.5,Z*.08)}},
 1:(c,X,Y,Z,C,h)=>{if(h<.2){c.fillStyle=C.lt;_fr(c,X+Z*.25,Y+Z*.55,Z*.5,Z*.08)}},
 2:(c,X,Y,Z,C,h)=>{if(h<.3){c.fillStyle=C.dk;_fr(c,X+Z*(.2+h*2),Y+Z*.6,Z*.1,Z*.1)}},
 3:(c,X,Y,Z,C,h)=>{if(h<.22){c.fillStyle=C.dk;_fr(c,X+Z*.35,Y+Z*.42,Z*.08,Z*.26);_fr(c,X+Z*.52,Y+Z*.52,Z*.08,Z*.2)}},
 4:(c,X,Y,Z,C)=>{c.fillStyle=C.dk;c.beginPath();c.ellipse(X+Z*.5,Y+Z*.58,Z*.4,Z*.34,0,0,6.2832);c.fill();c.fillStyle=C.lt;c.beginPath();c.ellipse(X+Z*.4,Y+Z*.45,Z*.2,Z*.15,0,0,6.2832);c.fill()},
 5:(c,X,Y,Z,C)=>{c.fillStyle=C.dk;_fr(c,X+Z*.15,Y+Z*.62,Z*.7,Z*.14);c.fillStyle=C.lt;_fr(c,X+Z*.2,Y+Z*.35,Z*.45,Z*.16)},
 6:(c,X,Y,Z,C)=>{c.fillStyle=C.dk;c.beginPath();c.moveTo(X+Z*.08,Y+Z*.92);c.lineTo(X+Z*.5,Y+Z*.1);c.lineTo(X+Z*.92,Y+Z*.92);c.fill();c.fillStyle=C.lt;c.beginPath();c.moveTo(X+Z*.08,Y+Z*.92);c.lineTo(X+Z*.5,Y+Z*.1);c.lineTo(X+Z*.5,Y+Z*.92);c.fill();c.fillStyle='#fff';c.beginPath();c.moveTo(X+Z*.5,Y+Z*.1);c.lineTo(X+Z*.37,Y+Z*.36);c.lineTo(X+Z*.5,Y+Z*.3);c.lineTo(X+Z*.62,Y+Z*.36);c.fill()},
 7:(c,X,Y,Z,C,h)=>{if(h<.14){c.fillStyle=C.dk;_fr(c,X+Z*.4,Y+Z*.4,Z*.12,Z*.12)}},
 8:(c,X,Y,Z,C,h)=>{if(h<.35){c.fillStyle=C.dk;_fr(c,X+Z*(.15+h),Y+Z*.55,Z*.1,Z*.1)}},
 9:(c,X,Y,Z,C)=>{c.fillStyle='rgba(0,0,0,.16)';_fr(c,X+Z-1,Y,1,Z);_fr(c,X,Y+Z-1,Z,1)},
 10:(c,X,Y,Z,C)=>{c.fillStyle='rgba(0,0,0,.28)';_fr(c,X,Y+Z*.5,Z,1);_fr(c,X+Z*.5,Y,1,Z*.5);_fr(c,X+Z*.25,Y+Z*.5,1,Z*.5);c.fillStyle='rgba(255,255,255,.12)';_fr(c,X,Y,Z,1)},
 11:(c,X,Y,Z,C,h)=>{if(h<.2){c.fillStyle=C.lt;_fr(c,X+Z*.3,Y+Z*.3,Z*.2,Z*.14)}},
 12:(c,X,Y,Z,C,h)=>{if(h<.25){c.fillStyle='#ffd36a';_fr(c,X+Z*.2,Y+Z*.45,Z*.45,Z*.1)}else if(h>.8){c.fillStyle='#a8300e';_fr(c,X+Z*.4,Y+Z*.2,Z*.3,Z*.1)}},
 13:(c,X,Y,Z,C,h)=>{if(h<.3){c.fillStyle=C.dk;_fr(c,X+Z*.4,Y+Z*.3,Z*.08,Z*.35);_fr(c,X+Z*.55,Y+Z*.4,Z*.08,Z*.25)}},
 14:(c,X,Y,Z,C)=>{c.fillStyle='rgba(0,0,0,.25)';_fr(c,X,Y+Z*.33,Z,1);_fr(c,X,Y+Z*.66,Z,1)},
 15:(c,X,Y,Z,C)=>{c.fillStyle='rgba(0,0,0,.22)';_fr(c,X+Z*.5,Y,1,Z);_fr(c,X,Y+Z*.5,Z,1)},
 16:(c,X,Y,Z,C)=>{c.fillStyle='rgba(0,0,0,.25)';_fr(c,X,Y+Z*.33,Z,1);_fr(c,X,Y+Z*.66,Z,1);c.fillStyle='rgba(255,255,255,.12)';_fr(c,X,Y,Z,1)},
 17:(c,X,Y,Z,C,h)=>{if(h<.2){c.fillStyle='#fff';_fr(c,X+Z*.3,Y+Z*.3,Z*.3,Z*.08)}},
 19:(c,X,Y,Z,C,h)=>{c.fillStyle='rgba(0,0,0,.26)';_fr(c,X,Y+Z*.5,Z,1);_fr(c,X,Y+Z-1,Z,1);_fr(c,X+Z*(h<.5?.33:.66),Y,1,Z*.5);_fr(c,X+Z*(h<.5?.7:.28),Y+Z*.5,1,Z*.5);c.fillStyle='rgba(255,255,255,.2)';_fr(c,X,Y,Z,1);_fr(c,X,Y+Z*.5+1,Z,1)},
 20:(c,X,Y,Z,C,h)=>{c.fillStyle=C.dk;for(let i=0;i<3;i++)_fr(c,X+Z*.06,Y+Z*(.12+i*.3),Z*.88,Math.max(1,Z*.09));c.fillStyle=C.lt;for(let i=0;i<3;i++)_fr(c,X+Z*.06,Y+Z*(.22+i*.3),Z*.88,Math.max(1,Z*.04))},
 21:(c,X,Y,Z,C,h)=>{c.fillStyle=C.dk;for(let i=0;i<4;i++)_fr(c,X+Z*(.1+i*.24),Y+Z*.1,Math.max(1,Z*.06),Z*.8);c.fillStyle=C.lt;for(let i=0;i<4;i++)_fr(c,X+Z*(.16+i*.24),Y+Z*.16,Math.max(1,Z*.04),Z*.5)}
};
function paintTile(ctx,mp,x,y,Z){
  if(mp.ter[y*mp.n+x]===255){const X=x*Z,Y=y*Z;ctx.clearRect(X,Y,Z,Z);if(mp.bgc)ctx.drawImage(mp.bgc,X,Y,Z,Z,X,Y,Z,Z);else{ctx.fillStyle='#1a1626';ctx.fillRect(X,Y,Z,Z)}return}
  const n=mp.n,t=mp.ter,cols=colsFor(mp.pal),k=cols[t[y*n+x]]?t[y*n+x]:3,C=cols[k],X=x*Z,Y=y*Z,s=mp.hs|0;
  const h=(((Math.imul(x,73856093)^Math.imul(y,19349663)^s)>>>0)%997)/997,h2=(((Math.imul(x,2654435761)^Math.imul(y,40503)^(s+7))>>>0)%991)/991;
  ctx.fillStyle=C.sh[Math.min(8,Math.floor(h*9))];ctx.fillRect(X,Y,Z,Z);
  if(Z>=5&&TDET[k])TDET[k](ctx,X,Y,Z,C,h2);
  const b=Math.max(1,Math.round(Z*.2)),pk=TPRI[k],nb=(dx,dy)=>{const xx=x+dx,yy=y+dy;return xx<0||yy<0||xx>=n||yy>=n?k:t[yy*n+xx]};
  let q=nb(0,-1);if(q!==k&&TPRI[q]>pk&&cols[q]){ctx.fillStyle=cols[q].sh[4];ctx.fillRect(X,Y,Z,b)}
  q=nb(0,1);if(q!==k&&TPRI[q]>pk&&cols[q]){ctx.fillStyle=cols[q].sh[4];ctx.fillRect(X,Y+Z-b,Z,b)}
  q=nb(-1,0);if(q!==k&&TPRI[q]>pk&&cols[q]){ctx.fillStyle=cols[q].sh[4];ctx.fillRect(X,Y,b,Z)}
  q=nb(1,0);if(q!==k&&TPRI[q]>pk&&cols[q]){ctx.fillStyle=cols[q].sh[4];ctx.fillRect(X+Z-b,Y,b,Z)}
}
function mpBuild(mp){
  const Z=mpZ(mp.n),cv=mp.tc||(mp.tc=document.createElement('canvas'));
  cv.width=cv.height=mp.n*Z;const c=cv.getContext('2d');
  const bi=mp.bg&&mpBgImg(mp.bg);
  if(bi){const bc=document.createElement('canvas');bc.width=bc.height=mp.n*Z;const g=bc.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(bi,0,0,mp.n*Z,mp.n*Z);mp.bgc=bc}else mp.bgc=null;
  for(let y=0;y<mp.n;y++)for(let x=0;x<mp.n;x++)paintTile(c,mp,x,y,Z);
  mp.tcZ=Z;mp.tcPal=mp.pal;mp.tcDirty=false;
}
function mpTiles(mp,x0,y0,x1,y1){
  const c=mp.tc.getContext('2d');x0=Math.max(0,x0-1);y0=Math.max(0,y0-1);x1=Math.min(mp.n-1,x1+1);y1=Math.min(mp.n-1,y1+1);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)paintTile(c,mp,x,y,mp.tcZ);
}
const mpEnsure=mp=>{const Z=mpZ(mp.n);if(!mp.tc||mp.tcDirty||mp.tcPal!==mp.pal||mp.tcZ!==Z||mp.tc.width!==mp.n*Z)mpBuild(mp)};

/* ---- stamp (oggetti) disegnati in coordinate unitarie [-.5,.5] ---- */
const _R=(c,x,y,w,h,f)=>{c.fillStyle=f;c.fillRect(x,y,w,h)};
const _E=(c,x,y,rx,ry,f)=>{c.fillStyle=f;c.beginPath();c.ellipse(x,y,rx,ry,0,0,6.2832);c.fill()};
const _P=(c,p,f)=>{c.fillStyle=f;c.beginPath();c.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)c.lineTo(p[i],p[i+1]);c.closePath();c.fill()};
const sh=shadeC,stoneC=P=>mixC(P.wall,'#ffffff',.5);
const _house=(c,P,x,y,s)=>{c.save();c.translate(x,y);c.scale(s,s);_R(c,-.38,-.05,.76,.45,P.house);_P(c,[-.46,-.02,-.3,-.4,.3,-.4,.46,-.02],P.roof);_R(c,-.08,.14,.16,.26,sh(P.roof,.5));c.restore()};
const STAMPS=[
['pino','Pino','Natura',1.2,(c,P)=>{_R(c,-.05,.26,.1,.22,'#5a3d22');_P(c,[-.36,.32,0,-.02,.36,.32],sh(P.tree,.78));_P(c,[-.3,.12,0,-.3,.3,.12],sh(P.tree,.94));_P(c,[-.22,-.08,0,-.5,.22,-.08],sh(P.tree,1.14))}],
['quercia','Albero','Natura',1.4,(c,P)=>{_R(c,-.06,.2,.12,.28,'#6b4a2b');_E(c,0,-.04,.4,.34,sh(P.tree,.8));_E(c,-.08,-.12,.28,.22,P.tree);_E(c,-.14,-.2,.12,.09,sh(P.tree,1.3))}],
['palma','Palma','Natura',1.4,(c,P)=>{_P(c,[-.05,.48,.05,.48,.09,-.1,-.01,-.1],'#8a6538');for(let i=0;i<6;i++){c.save();c.translate(.04,-.12);c.rotate(i*1.047+.3);_P(c,[0,-.03,.2,-.1,.42,0,.2,.07],i%2?sh(P.tree,1.1):P.tree);c.restore()}_E(c,.04,-.12,.05,.05,'#5a3d22')}],
['morto','Albero secco','Natura',1.3,(c,P)=>{_P(c,[-.06,.48,.06,.48,.04,-.12,-.04,-.12],'#5a4a3a');c.save();c.translate(0,-.05);c.rotate(-.7);_R(c,-.025,-.35,.05,.35,'#5a4a3a');c.restore();c.save();c.translate(0,.1);c.rotate(.8);_R(c,-.025,-.3,.05,.3,'#5a4a3a');c.restore()}],
['cespuglio','Cespuglio','Natura',.8,(c,P)=>{_E(c,-.2,.1,.22,.18,sh(P.tree,.85));_E(c,.2,.1,.22,.18,sh(P.tree,.9));_E(c,0,-.02,.26,.22,P.tree);_E(c,-.05,-.08,.1,.07,sh(P.tree,1.25))}],
['fiori','Fiori','Natura',.8,(c,P)=>{[[-.25,-.1,'#ff6b8a'],[.05,-.2,'#ffd34a'],[.25,.05,'#ffffff'],[-.05,.15,'#b57bff'],[-.28,.22,'#ffd34a'],[.2,.25,'#ff6b8a']].forEach(([x,y,f])=>{_R(c,x-.015,y,.03,.12,'#3b7a3a');_E(c,x,y,.07,.07,f)})}],
['cactus','Cactus','Natura',1,(c,P)=>{const g='#3f8a4a';_R(c,-.07,-.32,.14,.78,g);_R(c,-.27,-.1,.2,.09,g);_R(c,-.27,-.22,.09,.2,g);_R(c,.07,.05,.2,.09,g);_R(c,.19,-.1,.09,.2,g)}],
['roccia','Roccia','Natura',1,(c,P)=>{_P(c,[-.38,.25,-.3,-.05,-.08,-.3,.2,-.22,.38,.08,.3,.28],P.mount);_P(c,[-.3,-.05,-.08,-.3,.05,-.1,-.12,.05],sh(P.mount,1.25));_P(c,[.05,-.1,.2,-.22,.38,.08,.3,.28,.1,.28],sh(P.mount,.78))}],
['collina','Collina','Natura',3,(c,P)=>{_E(c,0,.12,.48,.34,sh(P.hill,.85));_E(c,-.04,.02,.4,.26,P.hill);_E(c,-.14,-.04,.18,.1,sh(P.hill,1.2))}],
['montagna','Montagna','Natura',3,(c,P)=>{_P(c,[-.5,.42,-.12,-.38,.12,-.05,.22,-.22,.5,.42],P.mount);_P(c,[-.12,-.38,.12,-.05,.22,-.22,.5,.42,.05,.42],sh(P.mount,.78));_P(c,[-.12,-.38,-.2,-.22,-.14,-.25,-.09,-.19,-.04,-.26,-.025,-.25],P.snow)}],
['vulcano','Vulcano','Natura',3.4,(c,P)=>{_P(c,[-.5,.42,-.14,-.3,.14,-.3,.5,.42],'#5b4640');_P(c,[-.14,-.3,.14,-.3,.5,.42,.1,.42],'#3f2e2a');_P(c,[-.14,-.3,-.08,-.38,.08,-.38,.14,-.3],'#e8531f');_P(c,[-.03,-.38,0,-.48,.04,-.38],'#ffd36a')}],
['casa','Casa','Edifici',2,(c,P)=>{_R(c,-.38,-.05,.76,.45,P.house);_P(c,[-.46,-.02,-.3,-.4,.3,-.4,.46,-.02],P.roof);_R(c,-.08,.14,.16,.26,sh(P.roof,.5));_R(c,-.28,.06,.12,.12,'#9ad4f0');_R(c,.16,.06,.12,.12,'#9ad4f0')}],
['capanna','Capanna','Edifici',1.6,(c,P)=>{_R(c,-.3,0,.6,.38,'#a07a4d');_P(c,[-.4,.02,0,-.42,.4,.02],'#d9b85c');_R(c,-.06,.16,.12,.22,'#3a2a1a')}],
['castello','Castello','Edifici',4,(c,P)=>{const s=stoneC(P),d=sh(s,.8);_R(c,-.44,-.05,.88,.45,s);_R(c,-.5,-.32,.2,.72,d);_R(c,.3,-.32,.2,.72,d);_R(c,-.16,-.34,.32,.74,s);for(let i=0;i<3;i++){_R(c,-.5+i*.09,-.38,.06,.08,d);_R(c,.3+i*.09,-.38,.06,.08,d);_R(c,-.16+i*.12,-.4,.08,.08,s)}_P(c,[-.5,-.32,-.4,-.5,-.3,-.32],P.roof);_P(c,[.3,-.32,.4,-.5,.5,-.32],P.roof);_R(c,-.08,.12,.16,.28,'#14121a');_R(c,-.4,.05,.06,.1,'#14121a');_R(c,.34,.05,.06,.1,'#14121a')}],
['torre','Torre','Edifici',2,(c,P)=>{const s=stoneC(P);_R(c,-.2,-.3,.4,.72,s);_P(c,[-.28,-.3,0,-.5,.28,-.3],P.roof);_R(c,-.05,-.1,.1,.16,'#14121a');_R(c,-.2,.2,.4,.04,sh(s,.8))}],
['tenda','Tenda','Edifici',1.6,(c,P)=>{_P(c,[-.45,.4,0,-.38,.45,.4],P.roof);_P(c,[0,-.38,.45,.4,.1,.4],sh(P.roof,.8));_P(c,[-.1,.4,0,0,.1,.4],'#14121a')}],
['mulino','Mulino','Edifici',2.4,(c,P)=>{_R(c,-.2,-.1,.4,.5,P.house);_P(c,[-.26,-.08,0,-.3,.26,-.08],P.roof);c.save();c.translate(0,-.2);c.rotate(.4);_R(c,-.03,-.45,.06,.9,'#c8b48a');_R(c,-.45,-.03,.9,.06,'#c8b48a');_R(c,-.03,-.45,.2,.16,'#e8dcc0');_R(c,-.45,-.03,.16,.2,'#e8dcc0');c.restore();_R(c,-.05,.22,.1,.18,'#3a2a1a')}],
['tempio','Tempio','Edifici',3,(c,P)=>{const s=stoneC(P);_P(c,[-.45,-.18,0,-.42,.45,-.18],s);_R(c,-.42,-.18,.84,.08,sh(s,.8));for(let i=0;i<4;i++)_R(c,-.36+i*.24,-.1,.1,.46,'#e6e2ee');_R(c,-.46,.36,.92,.1,s)}],
['citta','Città','Edifici',4,(c,P)=>{_house(c,P,-.22,-.12,.55);_house(c,P,.24,-.1,.5);_house(c,P,-.02,.22,.6)}],
['ponte','Ponte','Edifici',3,(c,P)=>{_R(c,-.5,-.2,1,.4,'#8a5e34');for(let i=0;i<8;i++)_R(c,-.5+i*.125,-.2,.02,.4,'#5a3b1e');_R(c,-.5,-.25,1,.06,'#5a3b1e');_R(c,-.5,.19,1,.06,'#5a3b1e')}],
['recinto','Recinto','Edifici',2,(c,P)=>{_R(c,-.5,-.04,1,.07,'#8a5e34');_R(c,-.5,.14,1,.07,'#8a5e34');for(let i=0;i<5;i++)_R(c,-.48+i*.24,-.14,.06,.4,'#6b4528')}],
['nave','Nave','Edifici',3,(c,P)=>{_P(c,[-.45,.1,.45,.1,.3,.35,-.3,.35],'#6b4528');_R(c,-.02,-.42,.04,.55,'#3a2a1a');_P(c,[.03,-.4,.32,.02,.03,.02],'#f2ead6');_P(c,[-.03,-.34,-.3,.02,-.03,.02],'#e3d8bd')}],
['porta','Porta','Dungeon',1.2,(c,P)=>{_R(c,-.45,-.25,.9,.5,'#3a2a1a');_R(c,-.38,-.18,.76,.36,'#8a5e34');_R(c,0,-.18,.02,.36,'#5a3b1e');_E(c,.28,0,.04,.04,'#f0c419');_E(c,-.28,0,.04,.04,'#f0c419')}],
['baule','Baule','Dungeon',.9,(c,P)=>{_R(c,-.35,-.15,.7,.45,'#7a4e2a');_R(c,-.35,-.28,.7,.18,'#966034');_R(c,-.35,-.02,.7,.06,P.treasure);_R(c,-.05,-.06,.1,.14,P.treasure)}],
['scala','Scala','Dungeon',1.5,(c,P)=>{for(let i=0;i<6;i++)_R(c,-.35,-.42+i*.14,.7,.11,sh(P.stairs,1-i*.09));_R(c,-.37,-.44,.04,.86,'#14121a');_R(c,.33,-.44,.04,.86,'#14121a')}],
['colonna','Colonna','Dungeon',1,(c,P)=>{_E(c,0,0,.3,.3,'#8d8a99');_E(c,-.06,-.06,.16,.16,'#bdbacb');_E(c,.08,.08,.1,.1,'#6a6578')}],
['torcia','Torcia','Dungeon',.8,(c,P)=>{_E(c,0,-.15,.42,.42,'rgba(255,170,60,.2)');_R(c,-.04,-.05,.08,.4,'#5a3d22');_P(c,[-.14,-.05,0,-.45,.14,-.05],'#ff8a2a');_P(c,[-.07,-.05,0,-.28,.07,-.05],'#ffd34a')}],
['falo','Falò','Dungeon',1,(c,P)=>{c.save();c.rotate(.5);_R(c,-.35,.15,.7,.09,'#5a3d22');c.restore();c.save();c.rotate(-.5);_R(c,-.35,.15,.7,.09,'#6b4a2b');c.restore();_P(c,[-.2,.2,0,-.42,.2,.2],'#ff6a2a');_P(c,[-.12,.2,0,-.2,.12,.2],'#ffb02a');_P(c,[-.05,.2,0,-.02,.05,.2],'#fff0a0')}],
['altare','Altare','Dungeon',1.6,(c,P)=>{_R(c,-.4,-.25,.8,.5,'#6a6578');_R(c,-.34,-.19,.68,.38,'#8d8a99');_E(c,0,0,.12,.12,'#c04cff');_E(c,0,0,.06,.06,'#f1e3ff')}],
['trappola','Trappola','Dungeon',1,(c,P)=>{_R(c,-.4,-.4,.8,.8,'#4b4559');for(let i=0;i<3;i++)for(let j=0;j<3;j++)_P(c,[-.3+i*.25,-.18+j*.25,-.2+i*.25,-.38+j*.25,-.1+i*.25,-.18+j*.25],'#d6d6e0')}],
['botola','Botola','Dungeon',1,(c,P)=>{_R(c,-.4,-.4,.8,.8,'#6b4528');for(let i=1;i<4;i++)_R(c,-.4,-.4+i*.2,.8,.02,'#3a2a1a');_E(c,0,0,.12,.12,'#d9b85c');_E(c,0,0,.07,.07,'#6b4528')}],
['statua','Statua','Dungeon',1,(c,P)=>{_R(c,-.28,.2,.56,.22,'#6a6578');_P(c,[-.15,.2,-.12,-.2,.12,-.2,.15,.2],'#a5a2b4');_E(c,0,-.3,.12,.12,'#bcb9ca')}],
['barile','Barile','Dungeon',.8,(c,P)=>{_E(c,0,0,.32,.4,'#8a5e34');_R(c,-.31,-.14,.62,.05,'#4a3320');_R(c,-.31,.1,.62,.05,'#4a3320');_E(c,-.1,-.15,.1,.2,'rgba(255,255,255,.12)')}],
['tavolo','Tavolo','Dungeon',2,(c,P)=>{_E(c,-.28,.38,.1,.1,'#6b4528');_E(c,.28,.38,.1,.1,'#6b4528');_R(c,-.45,-.25,.9,.5,'#8a5e34');_R(c,-.45,-.25,.9,.07,'#a67a48')}],
['letto','Letto','Dungeon',1.4,(c,P)=>{_R(c,-.3,-.45,.6,.9,'#6b4528');_R(c,-.26,-.4,.52,.8,'#d9d4e8');_R(c,-.22,-.38,.44,.22,'#ffffff');_R(c,-.26,0,.52,.4,P.roof)}],
['teschio','Teschio','Dungeon',.6,(c,P)=>{_E(c,0,-.05,.28,.26,'#eee8d6');_R(c,-.14,.12,.28,.16,'#eee8d6');_E(c,-.1,-.05,.07,.08,'#14121a');_E(c,.1,-.05,.07,.08,'#14121a')}],
['bandiera','Bandiera','Segni',1.2,(c,P)=>{_R(c,-.2,-.45,.05,.9,'#3a3340');_P(c,[-.15,-.42,.35,-.28,-.15,-.12],'#d02f3a')}],
['croce','Segno X','Segni',1.4,(c,P)=>{c.save();c.rotate(.785);_R(c,-.07,-.42,.14,.84,'#14121a');_R(c,-.42,-.07,.84,.14,'#14121a');_R(c,-.045,-.38,.09,.76,'#d02f3a');_R(c,-.38,-.045,.76,.09,'#d02f3a');c.restore()}],
['pin','Segnaposto','Segni',1.2,(c,P)=>{_P(c,[-.19,-.04,0,.46,.19,-.04],'#d02f3a');_E(c,0,-.14,.22,.22,'#d02f3a');_E(c,0,-.14,.08,.08,'#ffffff')}],
['stella','Punto d\'interesse','Segni',1.6,(c,P)=>{const p=[];for(let i=0;i<10;i++){const a=-1.5708+i*.6283,r=i%2?.2:.46;p.push(Math.cos(a)*r,Math.sin(a)*r)}_P(c,p,'#14121a');const q=[];for(let i=0;i<10;i++){const a=-1.5708+i*.6283,r=i%2?.15:.38;q.push(Math.cos(a)*r,Math.sin(a)*r)}_P(c,q,'#ffcb3d')}],
['cartello','Cartello','Segni',1,(c,P)=>{_R(c,-.04,-.1,.08,.55,'#5a3d22');_R(c,-.34,-.4,.68,.34,'#a67a48');_R(c,-.34,-.4,.68,.05,'#c79a62');_R(c,-.22,-.28,.44,.04,'#5a3d22');_R(c,-.22,-.19,.3,.04,'#5a3d22')}],
['pozzo','Pozzo','Segni',1.4,(c,P)=>{_E(c,0,0,.38,.38,'#8d8a99');_E(c,0,0,.26,.26,'#2d6cb0');_E(c,-.06,-.06,.1,.08,'#6fb2ee')}],
['rovine','Rovine','Segni',2,(c,P)=>{const s=stoneC(P);_R(c,-.42,-.1,.16,.5,s);_R(c,-.18,.1,.16,.3,sh(s,.85));_R(c,.06,-.2,.16,.6,s);_R(c,.3,.15,.16,.25,sh(s,.8));_R(c,-.5,.4,1,.06,sh(s,.7))}],
['portale','Portale','Segni',1.6,(c,P)=>{_E(c,0,0,.44,.44,'#3a1a7a');_E(c,0,0,.36,.36,'#6a2fbf');_E(c,0,0,.26,.26,'#b57bff');_E(c,0,0,.14,.14,'#f1e3ff')}],
['cristallo','Cristallo','Segni',1,(c,P)=>{_P(c,[-.18,.4,-.24,-.05,0,-.45,.24,-.05,.18,.4],'#38c8e8');_P(c,[0,-.45,.24,-.05,.18,.4,0,.4],'#1f8fb0');_P(c,[-.14,.0,-.1,-.15,-.02,-.25,-.04,0],'#bdf0ff')}],
['tomba','Tomba','Segni',1,(c,P)=>{_R(c,-.2,-.25,.4,.65,'#9a97a8');_E(c,0,-.25,.2,.15,'#9a97a8');_R(c,-.03,-.28,.06,.3,'#5b5870');_R(c,-.11,-.18,.22,.06,'#5b5870')}]
];
/* ---- v14: oggetti da città (categoria «Città») ---- */
const _sd=(h,f)=>f<1?mixC(h,'#000000',1-f):mixC(h,'#ffffff',Math.min(1,f-1));
const _W=(c,x,y,w,h)=>{_R(c,x,y,w,h,'#2b2f45');_R(c,x+w*.12,y+h*.12,w*.76,h*.76,'#a6d8f2');_R(c,x+w*.12,y+h*.12,w*.76,h*.22,'#d6f0fb');_R(c,x+w*.46,y,w*.08,h,'#2b2f45')};
const _A=(c,x,y,w,h,f)=>{_R(c,x,y+w/2,w,h-w/2,f);_E(c,x+w/2,y+w/2,w/2,w/2,f)};
const _L=(c,x1,y1,x2,y2,w,f)=>{c.strokeStyle=f;c.lineWidth=w;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke()};
const _smoke=(c,x,y)=>{_E(c,x,y,.05,.04,'rgba(235,235,240,.7)');_E(c,x+.04,y-.08,.07,.055,'rgba(235,235,240,.55)');_E(c,x+.1,y-.17,.09,.07,'rgba(235,235,240,.38)')};
const _stall=(c,a,b,goods)=>{
  _R(c,-.42,-.12,.04,.54,'#5a3d22');_R(c,.38,-.12,.04,.54,'#5a3d22');
  _R(c,-.4,.2,.8,.2,'#7a5230');_R(c,-.4,.2,.8,.05,'#b08550');
  goods(c);
  for(let i=0;i<8;i++){const x=-.46+i*.115,f=i%2?b:a;_R(c,x,-.34,.115,.24,f);_E(c,x+.0575,-.1,.0575,.055,f)}
  _R(c,-.46,-.38,.92,.06,_sd(a,.72));_R(c,-.46,-.34,.92,.02,'rgba(255,255,255,.28)');
};
STAMPS.push(
['casa_t','Casa a graticcio','Città',2.1,(c,P)=>{const w=_sd(P.house,1.06),tb='#5b3d24';
  _R(c,-.37,-.06,.74,.48,w);_R(c,-.37,-.06,.74,.035,tb);_R(c,-.37,.2,.74,.03,tb);_R(c,-.37,.39,.74,.04,tb);
  for(const x of [-.37,-.13,.11,.34])_R(c,x,-.06,.03,.45,tb);
  _L(c,-.34,-.04,-.15,.2,.022,tb);_L(c,.34,-.04,.13,.2,.022,tb);
  _R(c,.18,-.52,.1,.22,'#7d756c');_R(c,.16,-.54,.14,.04,'#5d564f');
  _P(c,[-.48,-.03,-.34,-.46,.34,-.46,.48,-.03],P.roof);_P(c,[-.34,-.46,.34,-.46,.39,-.34,-.39,-.34],_sd(P.roof,1.2));
  for(let i=0;i<4;i++)_R(c,-.42+i*.025,-.3+i*.07,.84-i*.05,.012,_sd(P.roof,.66));
  _A(c,-.065,.2,.13,.22,'#3d2514');_W(c,-.3,.04,.14,.12);_W(c,.16,.04,.14,.12);_W(c,-.3,.26,.12,.1);_W(c,.18,.26,.12,.1)}],
['casetta','Casetta di paglia','Città',1.5,(c,P)=>{
  _R(c,-.3,0,.6,.4,'#d3bd94');_R(c,-.3,.34,.6,.06,'#9a8660');
  _R(c,.12,-.4,.08,.2,'#7d756c');_smoke(c,.16,-.42);
  _P(c,[-.46,.05,-.36,-.38,.36,-.38,.46,.05],'#c9a345');_P(c,[-.36,-.38,.36,-.38,.4,-.28,-.4,-.28],'#e3c56c');
  for(let i=0;i<5;i++)_R(c,-.42+i*.02,-.3+i*.065,.84-i*.04,.012,'#9a7b2e');
  _A(c,-.18,.14,.12,.26,'#4a2f1a');_W(c,.06,.1,.14,.13)}],
['casagrande','Casa signorile','Città',2.6,(c,P)=>{const s=_sd(P.house,1.04),d=_sd(s,.8);
  _R(c,-.42,-.16,.84,.58,s);_R(c,-.42,.12,.84,.03,d);_R(c,-.42,-.16,.04,.58,d);_R(c,.38,-.16,.04,.58,d);
  _R(c,-.34,-.52,.1,.26,'#7d756c');_R(c,.24,-.52,.1,.26,'#7d756c');_R(c,-.36,-.54,.14,.04,'#5d564f');_R(c,.22,-.54,.14,.04,'#5d564f');
  _P(c,[-.5,-.12,-.36,-.46,.36,-.46,.5,-.12],_sd(P.roof,.92));_P(c,[-.36,-.46,.36,-.46,.42,-.34,-.42,-.34],_sd(P.roof,1.18));
  for(let i=0;i<4;i++)_R(c,-.44+i*.025,-.32+i*.07,.88-i*.05,.012,_sd(P.roof,.62));
  for(let i=0;i<4;i++)_W(c,-.34+i*.18,-.06,.1,.15);
  for(let i=0;i<2;i++){_W(c,-.34+i*.18,.2,.1,.15);_W(c,.2+i*.14,.2,.1,.15)}
  _A(c,-.075,.2,.15,.22,'#3d2514');_R(c,-.12,.17,.24,.03,d)}],
['taverna','Taverna','Città',2.8,(c,P)=>{const s=_sd(P.house,1.02),tb='#5b3d24';
  _R(c,-.44,.1,.88,.32,mixC(P.wall,'#ffffff',.5));_R(c,-.44,-.14,.88,.26,s);
  _R(c,-.44,-.14,.88,.03,tb);_R(c,-.44,.1,.88,.03,tb);for(const x of [-.44,-.15,.15,.41])_R(c,x,-.14,.03,.26,tb);
  _R(c,.2,-.54,.12,.28,'#7d756c');_R(c,.18,-.56,.16,.04,'#5d564f');_smoke(c,.26,-.58);
  _P(c,[-.52,-.1,-.38,-.46,.38,-.46,.52,-.1],_sd(P.roof,.82));_P(c,[-.38,-.46,.38,-.46,.44,-.34,-.44,-.34],_sd(P.roof,1.05));
  for(let i=0;i<4;i++)_R(c,-.46+i*.025,-.32+i*.07,.92-i*.05,.012,_sd(P.roof,.55));
  _W(c,-.36,-.08,.12,.14);_W(c,-.08,-.08,.12,.14);_W(c,.2,-.08,.12,.14);_W(c,-.38,.18,.12,.12);_W(c,.24,.18,.12,.12);
  _A(c,-.08,.16,.16,.26,'#3d2514');_E(c,.0,.2,.04,.04,'#d9b85c');
  _R(c,.4,-.02,.16,.03,'#2a1c10');_R(c,.44,.01,.11,.14,'#c79a3a');_R(c,.455,.035,.08,.03,'#7a1f1f');_E(c,.495,.1,.025,.025,'#f2e6c0');
  _E(c,-.5,.36,.07,.09,'#8a5e34');_R(c,-.57,.32,.14,.025,'#4a3320')}],
['bottega','Bottega','Città',2,(c,P)=>{const s=_sd(P.house,1.05);
  _R(c,-.38,-.06,.76,.48,s);_R(c,.18,-.5,.1,.22,'#7d756c');
  _P(c,[-.46,-.02,-.34,-.4,.34,-.4,.46,-.02],_sd(P.roof,.95));_P(c,[-.34,-.4,.34,-.4,.38,-.3,-.38,-.3],_sd(P.roof,1.2));
  _W(c,-.3,-.02,.14,.12);_W(c,.16,-.02,.14,.12);
  for(let i=0;i<8;i++){_R(c,-.4+i*.1,.12,.1,.12,i%2?'#f2ead6':'#c83e3e');_E(c,-.35+i*.1,.24,.05,.04,i%2?'#f2ead6':'#c83e3e')}
  _R(c,-.4,.1,.8,.03,'#7a2222');_R(c,-.3,.3,.6,.12,'#7a5230');_R(c,-.3,.3,.6,.03,'#b08550');
  _E(c,-.18,.27,.05,.04,'#e9a53a');_E(c,-.04,.27,.05,.04,'#7ab86a');_E(c,.1,.27,.05,.04,'#d86a6a');_E(c,.22,.27,.04,.04,'#e9a53a')}],
['fabbro','Fucina','Città',2.2,(c,P)=>{const s=mixC(P.wall,'#ffffff',.38);
  _R(c,-.4,-.04,.8,.46,s);_R(c,-.4,.3,.8,.12,_sd(s,.8));
  _R(c,.12,-.55,.14,.34,'#6a645e');_R(c,.1,-.57,.18,.05,'#4e4944');_E(c,.19,-.6,.05,.03,'#ff8a2a');_smoke(c,.19,-.64);
  _P(c,[-.48,0,-.34,-.32,.34,-.32,.48,0],_sd(P.roof,.78));_P(c,[-.34,-.32,.34,-.32,.38,-.22,-.38,-.22],_sd(P.roof,.98));
  _R(c,-.22,.04,.44,.38,'#1d1612');_R(c,-.22,.04,.44,.05,'#3a2a1a');_E(c,.1,.3,.1,.07,'#ff6a2a');_E(c,.1,.31,.06,.04,'#ffd36a');
  _R(c,-.36,.28,.14,.07,'#44434d');_R(c,-.4,.35,.22,.05,'#44434d');_R(c,-.3,.35,.05,.07,'#33323a');
  _E(c,-.42,.14,.025,.025,'#ffcb3d');_E(c,.43,.3,.02,.02,'#ffcb3d')}],
['forno','Forno','Città',1.9,(c,P)=>{const s=_sd(P.house,.98);
  _R(c,-.36,-.04,.72,.46,s);_R(c,.14,-.54,.12,.32,'#7d756c');_smoke(c,.2,-.56);
  _P(c,[-.44,-.02,-.32,-.38,.32,-.38,.44,-.02],_sd(P.roof,1.05));_P(c,[-.32,-.38,.32,-.38,.36,-.28,-.36,-.28],_sd(P.roof,1.28));
  _W(c,-.28,-.0,.14,.12);_A(c,-.06,.16,.15,.26,'#3d2514');
  _E(c,.25,.2,.1,.06,'#d3a14c');_E(c,.25,.18,.08,.04,'#e8c27a');_R(c,.14,.24,.22,.1,'#7a5230');
  _E(c,-.26,.33,.07,.05,'#e0b060');_E(c,-.18,.35,.05,.04,'#c9954a')}],
['magazzino','Magazzino','Città',2.6,(c,P)=>{
  _R(c,-.46,-.1,.92,.52,'#9a7a52');for(let i=0;i<9;i++)_R(c,-.46+i*.102,-.1,.012,.52,'#6b4a2b');
  _P(c,[-.52,-.06,-.4,-.4,.4,-.4,.52,-.06],mixC(P.roof,'#555566',.55));_P(c,[-.4,-.4,.4,-.4,.44,-.3,-.44,-.3],mixC(P.roof,'#8a8a99',.5));
  _R(c,-.2,.04,.4,.38,'#5a3d22');_R(c,-.2,.04,.4,.04,'#3a2a1a');_R(c,0,.04,.012,.38,'#3a2a1a');_L(c,-.2,.08,-.01,.4,.02,'#3a2a1a');_L(c,.2,.08,.01,.4,.02,'#3a2a1a');
  _R(c,-.44,.26,.2,.16,'#b08550');_R(c,-.42,.2,.14,.1,'#c79a62');_R(c,.28,.28,.16,.14,'#b08550');_R(c,-.14,-.2,.28,.1,'#3a2a1a')}],
['stalla','Stalla','Città',2.2,(c,P)=>{
  _R(c,-.42,-.04,.84,.46,'#8c4a38');for(let i=0;i<9;i++)_R(c,-.42+i*.0933,-.04,.012,.46,'#5e2f22');
  _P(c,[-.5,0,-.36,-.3,-.18,-.46,.18,-.46,.36,-.3,.5,0],'#6b4a2b');_P(c,[-.18,-.46,.18,-.46,.36,-.3,-.36,-.3],'#8a6538');
  _R(c,-.16,.02,.32,.4,'#4a2f1a');_L(c,-.16,.04,.16,.4,.025,'#c79a62');_L(c,.16,.04,-.16,.4,.025,'#c79a62');_R(c,-.16,.02,.32,.03,'#c79a62');
  _R(c,-.3,-.18,.12,.1,'#2a1c10');_R(c,.18,-.18,.12,.1,'#2a1c10');_R(c,-.4,.32,.2,.1,'#d9b85c')}],
['chiesa','Chiesa','Città',3.4,(c,P)=>{const s=mixC(P.house,'#ffffff',.35),d=_sd(s,.8);
  _R(c,-.5,-.04,.62,.48,s);_P(c,[-.54,-.02,-.42,-.26,.04,-.26,.16,-.02],_sd(P.roof,.9));_P(c,[-.42,-.26,.04,-.26,.06,-.2,-.44,-.2],_sd(P.roof,1.2));
  _R(c,.1,-.34,.34,.78,d);_R(c,.12,-.34,.28,.78,s);
  _R(c,.1,-.34,.34,.05,d);_P(c,[.08,-.34,.27,-.78,.46,-.34],_sd(P.roof,.82));_P(c,[.27,-.78,.46,-.34,.27,-.34],_sd(P.roof,.62));
  _R(c,.265,-.9,.012,.14,'#2a2630');_R(c,.235,-.86,.07,.012,'#2a2630');
  _A(c,.2,-.26,.14,.26,'#1a1620');_E(c,.27,-.14,.03,.03,'#d9b85c');_R(c,.12,.0,.3,.025,d);_W(c,.2,.1,.14,.1);
  _E(c,-.2,-.02,.1,.1,'#2b2f45');_E(c,-.2,-.02,.08,.08,'#c04cff');_E(c,-.2,-.02,.04,.04,'#ffd36a');
  _A(c,-.3,.1,.12,.2,'#6a4a2a');_A(c,-.42,.2,.07,.12,'#2b2f45');_A(c,-.06,.2,.07,.12,'#2b2f45');_A(c,-.14,.14,.14,.3,'#3a2415');_R(c,-.5,.4,.62,.04,d);
  for(let i=0;i<4;i++)_R(c,-.54+i*.17,-.2,.012,.18,_sd(P.roof,.6))}],
['cattedrale','Cattedrale','Città',4.6,(c,P)=>{const s=mixC(P.house,'#ffffff',.42),d=_sd(s,.78);
  _R(c,-.42,-.12,.84,.56,s);_P(c,[-.46,-.1,-.34,-.34,.34,-.34,.46,-.1],_sd(P.roof,.86));_P(c,[-.34,-.34,.34,-.34,.37,-.28,-.37,-.28],_sd(P.roof,1.18));
  _P(c,[-.1,-.34,0,-.56,.1,-.34],_sd(P.roof,.8));_R(c,-.01,-.66,.02,.12,'#2a2630');
  for(const sx of [-1,1]){const x=sx*.34-.11;_R(c,x,-.4,.22,.84,d);_R(c,x+.02,-.4,.18,.84,s);_R(c,x,-.4,.22,.04,d);_P(c,[x-.02,-.4,x+.11,-.82,x+.24,-.4],_sd(P.roof,.8));_R(c,x+.1,-.94,.02,.14,'#2a2630');_A(c,x+.05,-.3,.12,.22,'#1a1620');_A(c,x+.05,-.04,.1,.18,'#2b2f45')}
  _E(c,0,.0,.12,.12,'#2b2f45');_E(c,0,.0,.1,.1,'#c04cff');_E(c,0,.0,.06,.06,'#ff9ad4');_E(c,0,.0,.025,.025,'#ffd36a');
  _A(c,-.1,.18,.2,.26,'#3a2415');_A(c,-.2,.2,.08,.12,'#2b2f45');_A(c,.12,.2,.08,.12,'#2b2f45');_A(c,-.3,.2,.07,.12,'#2b2f45');_A(c,.24,.2,.07,.12,'#2b2f45');_R(c,-.42,.42,.84,.04,d)}],
['municipio','Municipio','Città',3.2,(c,P)=>{const s=_sd(P.house,1.06),d=_sd(s,.78);
  _R(c,-.46,-.08,.92,.5,s);_P(c,[-.52,-.06,-.4,-.32,.4,-.32,.52,-.06],_sd(P.roof,.9));_P(c,[-.4,-.32,.4,-.32,.43,-.25,-.43,-.25],_sd(P.roof,1.15));
  _R(c,-.14,-.58,.28,.54,d);_R(c,-.12,-.58,.24,.54,s);_P(c,[-.16,-.58,0,-.8,.16,-.58],_sd(P.roof,.8));
  _E(c,0,-.42,.085,.085,'#f4efe0');_E(c,0,-.42,.07,.07,'#2b2f45');_L(c,0,-.42,0,-.48,.012,'#f4efe0');_L(c,0,-.42,.04,-.4,.012,'#f4efe0');
  for(let i=0;i<5;i++){_R(c,-.4+i*.2,.1,.05,.32,'#e6e2ee')}
  _R(c,-.44,.06,.88,.04,d);_R(c,-.44,.4,.88,.04,d);
  for(const x of [-.3,-.14,.1,.26])_W(c,x,.14,.1,.14);_A(c,-.06,.2,.12,.22,'#3d2514');
  _R(c,.5,-.1,.02,.5,'#3a3340');_P(c,[.51,-.08,.66,-.02,.51,.04],'#d02f3a')}],
['bancarella','Bancarella frutta','Città',1.3,(c,P)=>_stall(c,'#c83e3e','#f2ead6',c=>{[[-.3,'#d83a3a'],[-.18,'#f08a2a'],[-.06,'#7ab83a'],[.06,'#d83a3a'],[.18,'#f0c02a'],[.3,'#7ab83a']].forEach(([x,f])=>{_E(c,x,.16,.055,.05,f);_E(c,x-.015,.145,.015,.012,'rgba(255,255,255,.5)')})})],
['bancarella2','Bancarella stoffe','Città',1.3,(c,P)=>_stall(c,'#2f6fb3','#f0d890',c=>{[[-.34,'#c04cff'],[-.2,'#e8532f'],[-.06,'#38c8a8'],[.08,'#f0c419'],[.22,'#d02f7a']].forEach(([x,f])=>{_R(c,x-.06,.12,.13,.1,f);_R(c,x-.06,.12,.13,.025,_sd(f,1.3))})})],
['bancarella3','Bancarella pentole','Città',1.3,(c,P)=>_stall(c,'#3a8a4a','#f2ead6',c=>{_E(c,-.28,.15,.07,.06,'#a8a8b4');_E(c,-.1,.14,.06,.07,'#b87a3a');_R(c,-.02,.08,.1,.1,'#8a8a96');_E(c,.2,.15,.07,.06,'#c8a04a');_E(c,.34,.14,.04,.07,'#a8a8b4')})],
['bancarella4','Bancarella pane e pesce','Città',1.3,(c,P)=>_stall(c,'#8a4ab3','#f2ead6',c=>{[-.3,-.18,-.06].forEach(x=>{_E(c,x,.16,.06,.04,'#d3a14c');_E(c,x,.15,.045,.025,'#e8c27a')});[.08,.2,.32].forEach(x=>{_E(c,x,.16,.06,.032,'#8fb4c8');_P(c,[x+.05,.16,x+.1,.12,x+.1,.2],'#8fb4c8')})})],
['fontana','Fontana','Città',2.2,(c,P)=>{
  _E(c,0,.12,.46,.34,'#7f7c8c');_E(c,0,.1,.44,.31,'#a5a2b4');_E(c,0,.12,.38,.26,'#4a90d0');_E(c,-.1,.1,.2,.08,'#7fc0ee');
  _R(c,-.07,-.2,.14,.32,'#b5b2c4');_R(c,-.07,-.2,.04,.32,'#c8c5d6');_E(c,0,-.2,.22,.09,'#9a97a8');_E(c,0,-.22,.17,.06,'#5aa8e6');
  _P(c,[-.018,-.22,0,-.46,.018,-.22],'#e0f4ff');_P(c,[-.1,-.2,-.2,-.06,-.14,-.2],'rgba(224,244,255,.8)');_P(c,[.1,-.2,.2,-.06,.14,-.2],'rgba(224,244,255,.8)');
  c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=.012;c.beginPath();c.ellipse(0,.12,.3,.17,0,0,6.2832);c.stroke();c.beginPath();c.ellipse(0,.12,.2,.1,0,0,6.2832);c.stroke()}],
['lampione','Lampione','Città',.8,(c,P)=>{
  _E(c,0,-.3,.34,.34,'rgba(255,200,90,.16)');_E(c,0,-.3,.2,.2,'rgba(255,200,90,.2)');
  _R(c,-.025,-.2,.05,.64,'#2a2630');_R(c,-.08,.4,.16,.07,'#2a2630');_R(c,-.1,-.34,.2,.06,'#2a2630');_P(c,[-.1,-.34,0,-.44,.1,-.34],'#2a2630');_R(c,-.07,-.28,.14,.1,'#ffd36a');_R(c,-.07,-.28,.14,.03,'#fff0a8')}],
['carretto','Carretto','Città',1.2,(c,P)=>{
  _R(c,-.4,-.02,.7,.26,'#8a5e34');_R(c,-.4,-.02,.7,.05,'#a67a48');for(let i=0;i<6;i++)_R(c,-.4+i*.12,-.02,.01,.26,'#5a3b1e');
  _P(c,[-.36,-.02,-.3,-.16,.0,-.2,.26,-.02],'#d9b85c');_R(c,.3,.1,.2,.03,'#5a3d22');
  _E(c,-.12,.28,.17,.17,'#4a3320');_E(c,-.12,.28,.13,.13,'#7a5230');_E(c,-.12,.28,.04,.04,'#3a2a1a');_L(c,-.12,.15,-.12,.41,.012,'#4a3320');_L(c,-.25,.28,.01,.28,.012,'#4a3320')}],
['pagliaio','Pagliaio','Città',1.1,(c,P)=>{
  _E(c,0,.22,.4,.2,'#b88f32');_P(c,[-.38,.24,-.28,-.12,-.1,-.34,.1,-.34,.28,-.12,.38,.24],'#d9b04a');_P(c,[-.1,-.34,.1,-.34,.28,-.12,.38,.24,.1,.24],'#b88f32');
  for(let i=0;i<5;i++)_R(c,-.3+i*.03,-.12+i*.08,.6-i*.06,.012,'#a07a28');_R(c,-.01,-.46,.02,.18,'#6b4a2b')}],
['frutteto','Albero da frutto','Città',1.3,(c,P)=>{
  _R(c,-.05,.18,.1,.3,'#6b4a2b');_E(c,0,-.04,.4,.34,_sd(P.tree,.82));_E(c,-.06,-.1,.3,.24,P.tree);_E(c,-.12,-.18,.12,.08,_sd(P.tree,1.3));
  [[-.2,.0],[.12,-.12],[.22,.08],[-.06,.1],[.02,-.22],[-.28,-.14]].forEach(([x,y],i)=>_E(c,x,y,.04,.04,i%2?'#e84a3a':'#f0a22a'))}],
['spaventapasseri','Spaventapasseri','Città',1.2,(c,P)=>{
  _R(c,-.02,-.2,.04,.66,'#6b4a2b');_R(c,-.34,-.06,.68,.04,'#6b4a2b');_P(c,[-.1,-.04,0,.06,.1,-.04,.14,.2,-.14,.2],'#9a5a3a');
  _E(c,0,-.22,.08,.08,'#e8cf94');_R(c,-.14,-.3,.28,.03,'#4a3320');_P(c,[-.08,-.3,0,-.46,.08,-.3],'#4a3320');_P(c,[-.34,-.06,-.42,.06,-.26,.04],'#d9b04a');_P(c,[.34,-.06,.42,.06,.26,.04],'#d9b04a')}],
['parapetto','Parapetto / balaustra','Città',1,(c,P)=>{
  _R(c,-.5,-.07,1,.045,'#7a5230');_R(c,-.5,.0,1,.03,'#5a3b1e');for(let i=0;i<=10;i++)_R(c,-.5+i*.1-.012,-.08,.026,.16,'#5a3b1e')}],
['barchetta','Barchetta','Città',1.3,(c,P)=>{
  _P(c,[-.46,-.04,.46,-.04,.3,.2,-.3,.2],'#7a4a28');_P(c,[-.46,-.04,.46,-.04,.44,.0,-.44,.0],'#a67a48');_R(c,-.3,.06,.6,.02,'#5a3b1e');_R(c,-.04,-.2,.08,.2,'#5a3d22');_L(c,-.1,-.1,.34,.3,.025,'#c79a62')}],
['molo','Molo di legno','Città',2,(c,P)=>{
  _R(c,-.5,-.18,1,.36,'#8a5e34');for(let i=0;i<10;i++)_R(c,-.5+i*.1,-.18,.012,.36,'#5a3b1e');_R(c,-.5,-.18,1,.04,'#a67a48');
  for(let i=0;i<5;i++){_R(c,-.48+i*.24,.14,.06,.18,'#4a3320');_R(c,-.48+i*.24,-.3,.06,.14,'#4a3320')}}],
['torrione','Torre di cinta','Città',2,(c,P)=>{const s=mixC(P.wall,'#ffffff',.5),d=_sd(s,.78);
  _R(c,-.3,-.22,.6,.66,d);_R(c,-.3,-.22,.44,.66,s);for(let i=0;i<4;i++)_R(c,-.3,-.1+i*.14,.6,.012,_sd(s,.7));
  for(let i=0;i<4;i++)_R(c,-.34+i*.2,-.36,.12,.16,i%2?d:s);_R(c,-.34,-.24,.68,.04,d);
  _R(c,-.04,-.04,.07,.16,'#14121a');_A(c,-.05,.24,.1,.2,'#3a2415');_R(c,-.3,.4,.6,.05,_sd(s,.65))}],
['portone','Portone cittadino','Città',2.6,(c,P)=>{const s=mixC(P.wall,'#ffffff',.5),d=_sd(s,.78);
  _R(c,-.5,-.2,.34,.64,d);_R(c,-.5,-.2,.24,.64,s);_R(c,.16,-.2,.34,.64,d);_R(c,.16,-.2,.24,.64,s);
  for(const x of [-.52,.14])for(let i=0;i<3;i++)_R(c,x+i*.12,-.34,.1,.14,i%2?d:s);
  _R(c,-.18,-.12,.36,.14,s);_R(c,-.18,-.14,.36,.03,d);_A(c,-.16,.0,.32,.44,'#14121a');
  _R(c,-.38,-.04,.06,.14,'#14121a');_R(c,.32,-.04,.06,.14,'#14121a');_R(c,-.01,-.5,.02,.3,'#3a3340');_P(c,[0,-.5,.18,-.44,0,-.38],'#d02f3a')}]
);
const _cot=(c,P,w,r,st)=>{
  const d=_sd(w,.8);
  _R(c,-.37,-.06,.74,.48,w);_R(c,-.37,-.06,.05,.48,d);_R(c,.32,-.06,.05,.48,d);_R(c,-.37,.38,.74,.045,_sd(w,.7));
  if(st==='stone')for(let i=0;i<5;i++)_R(c,-.37,.02+i*.08,.74,.01,_sd(w,.72));
  if(st==='wood')for(let i=0;i<9;i++)_R(c,-.37+i*.082,-.06,.01,.46,_sd(w,.7));
  _R(c,.16,-.52,.1,.22,'#7d756c');_R(c,.14,-.54,.14,.04,'#5d564f');
  _P(c,[-.47,-.03,-.34,-.44,.34,-.44,.47,-.03],r);_P(c,[-.34,-.44,.34,-.44,.39,-.33,-.39,-.33],_sd(r,1.22));
  for(let i=0;i<4;i++)_R(c,-.42+i*.025,-.3+i*.07,.84-i*.05,.012,_sd(r,.64));
  _A(c,-.065,.2,.13,.22,'#3d2514');_W(c,-.3,.06,.14,.14);_W(c,.16,.06,.14,.14);
};
STAMPS.push(
['casa_g','Casa di pietra','Città',2,(c,P)=>_cot(c,P,mixC(P.wall,'#ffffff',.55),mixC('#5f6b7d',P.roof,.12),'stone')],
['casa_o','Casa ocra','Città',2,(c,P)=>_cot(c,P,mixC(P.house,'#e0a040',.38),mixC(P.roof,'#e0803a',.45),'')],
['casa_b','Casa bianca','Città',2,(c,P)=>_cot(c,P,'#f0ece2',mixC('#3f7f95',P.roof,.1),'')],
['casa_w','Casa di legno','Città',2,(c,P)=>_cot(c,P,'#a87b4c','#6b4a2b','wood')],
['casa_v','Casa col tetto verde','Città',2,(c,P)=>_cot(c,P,mixC(P.house,'#ffffff',.25),mixC('#5f8a4a',P.tree,.15),'')]
);
const STM=Object.fromEntries(STAMPS.map(s=>[s[0],s])),MCATS=['Natura','Edifici','Città','Dungeon','Segni'];
const SHADOW=new Set(['pino','quercia','palma','morto','cespuglio','roccia','montagna','vulcano','cactus','casa','capanna','castello','torre','tenda','mulino','tempio','citta','nave','statua','barile','cartello','pozzo','colonna','rovine','cristallo','tomba','bandiera','casa_t','casetta','casagrande','taverna','bottega','fabbro','forno','magazzino','stalla','chiesa','cattedrale','municipio','bancarella','bancarella2','bancarella3','bancarella4','fontana','lampione','carretto','pagliaio','frutteto','spaventapasseri','torrione','portone','barchetta','casa_g','casa_o','casa_b','casa_w','casa_v']);
const MLEG={casa:'casa',montagna:'montagna',albero:'quercia',torre:'torre',tenda:'tenda',tesoro:'baule',bandiera:'bandiera'};
function drawObj(c,P,o,Z,al){
  c.save();c.globalAlpha=al==null?1:al;
  if(o.k==='testo'){
    c.translate(o.x*Z,o.y*Z);c.rotate((o.r||0)*Math.PI/180);
    c.font='bold '+Math.max(8,Math.round(o.s*Z))+'px "Pixelify Sans",sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
    c.lineWidth=Math.max(2,o.s*Z*.18);c.strokeStyle='#14121a';c.strokeText(o.t||'',0,0);c.fillStyle='#fff6d8';c.fillText(o.t||'',0,0);
    c.restore();return;
  }
  const st=STM[o.k];if(!st){c.restore();return}
  const S=o.s*Z;c.translate(o.x*Z,o.y*Z);
  if(SHADOW.has(o.k)){c.fillStyle='rgba(0,0,0,.26)';c.beginPath();c.ellipse(S*.04,S*.38,S*.38,S*.09,0,0,6.2832);c.fill()}
  c.rotate((o.r||0)*Math.PI/180);c.scale((o.f?-1:1)*S,S);st[4](c,P);c.restore();
}
const THUMB={};
function stThumb(k,pal){
  const key=k+'|'+pal;if(THUMB[key])return THUMB[key];
  const cv=document.createElement('canvas');cv.width=cv.height=64;const c=cv.getContext('2d');
  c.fillStyle=colsFor(pal)[3].sh[3];c.fillRect(0,0,64,64);
  drawObj(c,PAL[pal]||PAL.classica,{k,x:.5,y:.5,s:.92,r:0,f:0},64,1);
  return THUMB[key]=cv.toDataURL();
}

/* ---- modello mappa, (de)serializzazione ---- */
const rleEnc=a=>{const o=[];let p=a[0],c=0;for(let i=0;i<a.length;i++){if(a[i]===p)c++;else{o.push(p+'.'+c);p=a[i];c=1}}o.push(p+'.'+c);return o.join(' ')};
const rleDec=(s,len,def)=>{const a=new Uint8Array(len);if(def)a.fill(def);let i=0;for(const t of String(s||'').split(' ')){const [v,c]=t.split('.').map(Number);if(isNaN(v)||isNaN(c))continue;for(let j=0;j<c&&i<len;j++)a[i++]=v}return a};
function mpGenerate(c){
  const n=c.size,d=genMap(c),ter=new Uint8Array(n*n),objs=[],t=c.type,dn=t==='dungeon'||t==='caverna';
  const put=(k,i)=>objs.push({id:uid8(),k,x:i%n+.5,y:Math.floor(i/n)+.5,s:STM[k][3],r:0,f:0});
  for(let i=0;i<n*n;i++){
    const v=d.codes[i];let k;
    if(v===255)k=18;
    else if(t==='terra'||t==='isola'||t==='citta'||t==='villaggio')k=v;
    else if(dn){const fl=t==='caverna'?8:9;k=v===0?11:v===1?fl:v===2?15:v===7?10:fl;if(v===6)put('baule',i);if(v===8||v===9)put('scala',i)}
    else k=[3,3,8,1,4,14,16,14][v]??3;
    ter[i]=k;
  }
  const mp={n,ter,fog:new Uint8Array(n*n),fogOn:false,objs,pal:c.pal,grid:!!c.grid,scale:c.scale||0,unit:c.unit||'m',gt:t,hs:hashSeed(c.seed),pub:true};
  try{mpPopulate(mp,c,d,mulberry32(hashSeed(c.seed+'#pop')))}catch(e){console.warn('populate',e)}
  return mp;
}
/* ---- generatore casuale COMPLETO: terreni speciali, strade, ponti, edifici, natura, tesori, scritte ----
   Usa TUTTI gli oggetti dell'editor (STAMPS) e tutti i terreni. "Ricchezza di oggetti" (0-100) regola la quantità. */
const NM_A=['Al','Bel','Cor','Dra','El','Fal','Gor','Hel','Is','Kar','Lor','Mar','Nor','Or','Per','Ras','Sel','Tor','Ul','Val','Zan','Ber','Cal','Dun','Eri','Fen','Gal','Mor'],NM_B=['a','e','i','o','an','en','or','el','ar','um','ad','iv'],NM_C=['dor','mar','ia','nia','gard','wen','ton','ris','vik','na','sa','th','lan','dea','nor','ven','dar','mor','bia','la'];
function mpPopulate(mp,c,d,rnd){
  const n=mp.n,t=mp.ter,objs=mp.objs,R=Math.max(0,Math.min(1,(c.rich==null?60:c.rich)/100));
  if(R<=0)return;
  const A=Math.sqrt(n*n/2304),pal=mp.pal,gt=c.type==='isola'?'terra':c.type,MAXO=c.type==='citta'?2600:c.type==='villaggio'?1900:1800;
  const cold=pal==='neve',dry=pal==='deserto',hot=pal==='vulcano',D4=[[1,0],[-1,0],[0,1],[0,-1]];
  const inb=(x,y)=>x>=0&&y>=0&&x<n&&y<n,ix=(x,y)=>y*n+x,xy=i=>[i%n,(i-i%n)/n],W=v=>v===0||v===1;
  const pk=a=>a[Math.floor(rnd()*a.length)],rb=(a,b)=>a+rnd()*(b-a),ri=(a,b)=>a+Math.floor(rnd()*(b-a+1));
  const name=()=>pk(NM_A)+(rnd()<.45?pk(NM_B):'')+pk(NM_C);
  /* occupazione (griglia spaziale a cerchi: nessuna sovrapposizione) */
  const G=Math.ceil(n/2)+2,bk=[];
  const bi=(x,y)=>Math.floor(y/2)*G+Math.floor(x/2);
  const mark=(x,y,r)=>{const k=bi(x,y);(bk[k]||(bk[k]=[])).push([x,y,r])};
  const isFree=(x,y,r)=>{
    const cx=Math.floor(x),cy=Math.floor(y);if(!inb(cx,cy)||t[ix(cx,cy)]===18)return false;
    const m=r+2.4;
    for(let j=Math.floor((y-m)/2);j<=Math.floor((y+m)/2);j++)for(let i=Math.floor((x-m)/2);i<=Math.floor((x+m)/2);i++){
      if(i<0||j<0||i>=G||j>=G)continue;const b=bk[j*G+i];
      if(b)for(const o of b)if(Math.hypot(o[0]-x,o[1]-y)<o[2]+r)return false;
    }
    return true;
  };
  objs.forEach(o=>mark(o.x,o.y,o.s*.4));
  const put=(k,x,y,o)=>{
    o=o||{};if(objs.length>=MAXO||!STM[k])return null;
    const cx=Math.floor(x),cy=Math.floor(y);if(!inb(cx,cy))return null;
    const tv=t[ix(cx,cy)];
    if(o.on?o.on.indexOf(tv)<0:(tv===0||tv===1||tv===18||tv===12||tv===10||tv===11||tv===19))return null;
    const s=+(STM[k][3]*(o.s||1)*(o.v===false?1:.88+rnd()*.24)).toFixed(2),rr=s*.4;
    if(!o.force&&!isFree(x,y,o.fr!=null?o.fr:rr))return null;
    const ob={id:uid8(),k,x:+x.toFixed(2),y:+y.toFixed(2),s,r:o.r!=null?normA(Math.round(o.r)):(o.rot?Math.round((rnd()-.5)*18):0),f:o.f!=null?o.f:(rnd()<.5?1:0)};
    if(o.h)ob.h=1;
    mark(x,y,o.or!=null?o.or:rr);objs.push(ob);return ob;
  };
  const cells=f=>{const a=[];for(let i=0;i<n*n;i++)if(f(t[i],i%n,(i-i%n)/n))a.push(i);return a};
  const shuf=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1)),v=a[i];a[i]=a[j];a[j]=v}return a};
  const scatter=(list,p,cap,fn)=>{
    cap=Math.floor(cap);if(cap<=0||!list.length)return 0;let k=0;
    for(const i of shuf(list.slice())){if(k>=cap||objs.length>=MAXO)break;if(rnd()>p)continue;const x=i%n,y=(i-x)/n;if(fn(x+.15+rnd()*.7,y+.15+rnd()*.7,x,y))k++}
    return k;
  };
  const comps=pred=>{
    const lab=new Uint8Array(n*n),res=[];
    for(let i=0;i<n*n;i++){
      if(lab[i]||!pred(t[i]))continue;const st=[i],cl=[];lab[i]=1;
      while(st.length){
        const j=st.pop();cl.push(j);const x=j%n,y=(j-x)/n;
        if(x>0&&!lab[j-1]&&pred(t[j-1])){lab[j-1]=1;st.push(j-1)}
        if(x<n-1&&!lab[j+1]&&pred(t[j+1])){lab[j+1]=1;st.push(j+1)}
        if(y>0&&!lab[j-n]&&pred(t[j-n])){lab[j-n]=1;st.push(j-n)}
        if(y<n-1&&!lab[j+n]&&pred(t[j+n])){lab[j+n]=1;st.push(j+n)}
      }
      res.push(cl);
    }
    return res.sort((a,b)=>b.length-a.length);
  };
  const mid=cl=>{let sx=0,sy=0;cl.forEach(i=>{sx+=i%n;sy+=(i-i%n)/n});sx/=cl.length;sy/=cl.length;let b=cl[0],bd=1e9;cl.forEach(i=>{const dd=Math.hypot(i%n-sx,(i-i%n)/n-sy);if(dd<bd){bd=dd;b=i}});return xy(b)};
  const nearW=(x,y,r)=>{for(let j=Math.floor(y-r);j<=Math.floor(y+r);j++)for(let i=Math.floor(x-r);i<=Math.floor(x+r);i++)if(inb(i,j)&&W(t[ix(i,j)]))return true;return false};
  const disc=(cx,cy,r,code,only)=>{for(let j=Math.floor(cy-r);j<=Math.ceil(cy+r);j++)for(let i=Math.floor(cx-r);i<=Math.ceil(cx+r);i++)if(inb(i,j)&&Math.hypot(i+.5-cx,j+.5-cy)<=r&&(!only||only(t[ix(i,j)])))t[ix(i,j)]=code};
  const addTxt=(str,x,y,s)=>{const hw=str.length*s*.3;x=Math.min(n-hw-.3,Math.max(hw+.3,x));y=Math.min(n-s*.6,Math.max(s*.6,y));objs.push({id:uid8(),k:'testo',x:+x.toFixed(2),y:+y.toFixed(2),s:+s.toFixed(2),r:0,f:0,t:str})};
  /* ponticelli sui laghetti / fiumi stretti */
  const foot=cnt=>{
    const sh=cells(v=>v===1);if(!sh.length)return;let k=0;
    for(let tr=0;tr<cnt*60&&k<cnt;tr++){
      const i=pk(sh),x=i%n,y=(i-x)/n,hz=rnd()<.5,dx=hz?1:0,dy=hz?0:1;
      let ax=x,ay=y,bx=x,by=y;
      while(inb(ax-dx,ay-dy)&&t[ix(ax-dx,ay-dy)]===1){ax-=dx;ay-=dy}
      while(inb(bx+dx,by+dy)&&t[ix(bx+dx,by+dy)]===1){bx+=dx;by+=dy}
      const e1=[ax-dx,ay-dy],e2=[bx+dx,by+dy],len=hz?bx-ax+1:by-ay+1;
      if(len<2||len>7||!inb(e1[0],e1[1])||!inb(e2[0],e2[1]))continue;
      const v1=t[ix(e1[0],e1[1])],v2=t[ix(e2[0],e2[1])];
      if(W(v1)||W(v2)||v1===18||v2===18)continue;
      if(put('ponte',(ax+bx)/2+.5,(ay+by)/2+.5,{s:(len+1.4)/3,v:false,on:[1],r:hz?0:90,f:0,fr:.4,or:.5}))k++;
    }
  };

  /* =============== MOTORE CITTÀ =============== */
  /* Costruisce un insediamento vero: piazza con fontana e mercato, vie principali acciottolate fino alle porte,
     anelli e viuzze, sentieri dalle porte di casa alla strada, quartieri (centro signorile, botteghe, periferia povera),
     chiesa con cimitero, municipio, taverne, fucine, pozzi, lampioni, orti, mura con torri, ponti, moli e campi. */
  const NZ=mkNoise(hashSeed(c.seed+'#cy')),GR=v=>v===3||v===2||v===5,TAV=['Il Cinghiale','Il Grifone','La Quercia','Il Corvo','La Lanterna','L\'Orso','Il Calderone','La Pigna'];
  const CK=['casa','casa_g','casa_o','casa_b','casa_w','casa_v'],casa=()=>CK[Math.floor(rnd()*CK.length)];
  const RECT=new Map(),rkey=(i,j)=>i*8192+j;
  const rAdd=(x,y,hw,hh)=>{for(let j=Math.floor((y-hh-.4)/4);j<=Math.floor((y+hh+.4)/4);j++)for(let i=Math.floor((x-hw-.4)/4);i<=Math.floor((x+hw+.4)/4);i++){const k=rkey(i,j);let b=RECT.get(k);if(!b){b=[];RECT.set(k,b)}b.push([x,y,hw,hh])}};
  const rFree=(x,y,hw,hh,mg)=>{mg=mg==null?.1:mg;for(let j=Math.floor((y-hh-mg)/4);j<=Math.floor((y+hh+mg)/4);j++)for(let i=Math.floor((x-hw-mg)/4);i<=Math.floor((x+hw+mg)/4);i++){const b=RECT.get(rkey(i,j));if(b)for(const r of b)if(Math.abs(r[0]-x)<r[2]+hw+mg&&Math.abs(r[1]-y)<r[3]+hh+mg)return false}return true};
  const okG=(x,y,hw,hh)=>{hw*=.86;hh*=.86;for(let j=Math.floor(y-hh);j<=Math.floor(y+hh);j++)for(let i=Math.floor(x-hw);i<=Math.floor(x+hw);i++)if(!inb(i,j)||!GR(t[ix(i,j)]))return false;return true};
  const putB=(k,x,y,sc,o)=>{
    o=o||{};const S=STM[k][3]*sc,hw=(o.hw||.46)*S,hh=(o.hh||.4)*S;
    if(!okG(x,y,hw,hh)||!rFree(x,y,hw,hh,o.mg))return null;
    const b=put(k,x,y,{s:sc,v:false,f:o.f!=null?o.f:(rnd()<.5?1:0),fr:.05,or:S*.36,force:true,r:o.r});
    if(!b)return null;rAdd(x,y,hw,hh);return b;
  };
  const putP=(k,x,y,sc,o)=>{
    o=o||{};const S=STM[k][3]*sc,hw=(o.hw||.46)*S,hh=(o.hh||.4)*S,fx=Math.floor(x),fy=Math.floor(y);
    if(!inb(fx,fy))return null;const tv=t[ix(fx,fy)];if(!(tv===15||GR(tv)))return null;if(!rFree(x,y,hw,hh,o.mg))return null;
    const b=put(k,x,y,{s:sc,v:false,f:o.f!=null?o.f:(rnd()<.5?1:0),fr:.05,or:S*.36,force:true,on:[15,3,2,5,8]});
    if(!b)return null;rAdd(x,y,hw,hh);return b;
  };
  let wat=new Uint8Array(n*n),sd=new Uint8Array(n*n);
  const setRoad=(x,y,code)=>{if(!inb(x,y))return;const i=ix(x,y),cur=t[i];if(cur===0||cur===1||cur===10||cur===11||cur===12||cur===18||cur===19||cur===14)return;if(code===8&&cur===15)return;t[i]=code};
  const SM=[];
  const lay=(pts,w,code,o)=>{
    o=o||{};const rr=Math.max(.72,w/2+.1);let run=null,acc=0,skip=false;
    const bridge=r=>{
      if(!r||r.len<1||o.g!==0)return;const L=r.len+1.8,mx=(r.a[0]+r.b[0])/2,my=(r.a[1]+r.b[1])/2,ang=Math.atan2(r.dy,r.dx)*180/Math.PI,nx=-r.dy,ny=r.dx,off=w/2+.14;
      const ns=Math.max(1,Math.ceil(L/2.4)),sl=L/ns;
      for(let q=0;q<ns;q++){const f=(q+.5)/ns-.5,qx=mx+r.dx*L*f,qy=my+r.dy*L*f;for(const sg of [1,-1])put('parapetto',qx+nx*off*sg,qy+ny*off*sg,{s:sl+.06,r:ang,f:0,v:false,force:true,on:[14,8,15,3,2,5],fr:.1,or:.2})}
    };
    for(let k=0;k<pts.length-1;k++){
      const x0=pts[k][0],y0=pts[k][1],L=Math.hypot(pts[k+1][0]-x0,pts[k+1][1]-y0)||1,ux=(pts[k+1][0]-x0)/L,uy=(pts[k+1][1]-y0)/L,st=Math.ceil(L/.35);
      for(let s=0;s<=st;s++){
        const px=x0+ux*L*s/st,py=y0+uy*L*s/st,fx=Math.floor(px),fy=Math.floor(py),inW=inb(fx,fy)&&wat[ix(fx,fy)]===1;
        if(inW&&o.stop){bridge(run);return}
        if(inW&&o.br&&!run){let far=false;for(let d=.5;d<=10;d+=.5){const qx=Math.floor(px+ux*d),qy=Math.floor(py+uy*d);if(!inb(qx,qy)||wat[ix(qx,qy)]!==1)break;if(d>=9.5)far=true}if(far)skip=true}
        if(skip){if(inW)continue;skip=false}
        if(inW&&o.br){if(!run)run={a:[px,py],dx:ux,dy:uy,len:0};run.b=[px,py];run.len=Math.hypot(run.b[0]-run.a[0],run.b[1]-run.a[1])}
        else if(run){bridge(run);run=null}
        for(let j=Math.floor(py-rr);j<=Math.floor(py+rr);j++)for(let i=Math.floor(px-rr);i<=Math.floor(px+rr);i++){
          if(!inb(i,j)||Math.hypot(i+.5-px,j+.5-py)>rr)continue;
          const q=ix(i,j);
          if(wat[q]===1){if(o.br&&inW)t[q]=14;continue}
          setRoad(i,j,code);
        }
        acc+=L/st;
        if(acc>=1.05&&!inW){acc=0;SM.push({x:px,y:py,nx:-uy,ny:ux,w,rh:rr+.5,g:o.g||0})}
      }
    }
    if(run)bridge(run);
  };
  const distField=()=>{
    sd=new Uint8Array(n*n).fill(255);const q=[];
    for(let i=0;i<n*n;i++){const v=t[i];if(v===8||v===15||v===14){sd[i]=0;q.push(i)}}
    for(let h=0;h<q.length;h++){const i=q[h],x=i%n,y=(i-x)/n,dv=sd[i];if(dv>=12)continue;for(const [dx,dy] of D4){const xx=x+dx,yy=y+dy;if(!inb(xx,yy))continue;const j=ix(xx,yy);if(sd[j]===255){sd[j]=dv+1;q.push(j)}}}
  };
  const footpath=(x,y)=>{
    let px=Math.floor(x),py=Math.floor(y);
    for(let st=0;st<16;st++){
      if(!inb(px,py))break;const dv=sd[ix(px,py)];if(dv===0||dv===255)break;
      let best=null,bv=dv;for(const [dx,dy] of D4){const xx=px+dx,yy=py+dy;if(!inb(xx,yy))continue;const v=sd[ix(xx,yy)];if(v<bv){bv=v;best=[xx,yy]}}
      if(!best)break;px=best[0];py=best[1];const q=ix(px,py);if(GR(t[q]))t[q]=8;
    }
  };
  const blob=(cx,cy,r,code,only,seed)=>{for(let j=Math.floor(cy-r-1);j<=Math.ceil(cy+r+1);j++)for(let i=Math.floor(cx-r-1);i<=Math.ceil(cx+r+1);i++){if(!inb(i,j))continue;const dd=Math.hypot(i+.5-cx,j+.5-cy),rr=r*(1+.3*(NZ(i*.45+seed,j*.45+seed*.7)-.5)*2);if(dd<=rr&&only(t[ix(i,j)]))t[ix(i,j)]=code}};
  const ringR=(a,RR)=>RR*(1+.07*(NZ(Math.cos(a)*1.4+11,Math.sin(a)*1.4+11)-.5)*2);
  const findGates=(cx,cy,rf)=>{
    const out=[];
    for(let a=0;a<6.283;a+=.03){
      let hit=false;const R0=rf(a);
      for(let r=R0-.8;r<=R0+.8;r+=.5){const x=Math.floor(cx+Math.cos(a)*r),y=Math.floor(cy+Math.sin(a)*r);if(inb(x,y)&&t[ix(x,y)]===8){hit=true;break}}
      if(hit){const l=out[out.length-1];if(l&&a-l.e<.2)l.e=a;else out.push({s:a,e:a})}
    }
    return out.map(g=>(g.s+g.e)/2);
  };
  /* fiume che attraversa la mappa (rive di sabbia, riva bassa, centro profondo) */
  const makeRiver=(cx,cy,RR,wd)=>{
    const th=rnd()*6.283,ux=Math.cos(th),uy=Math.sin(th),px=-uy,py=ux,off=(rnd()<.5?-1:1)*RR*rb(.42,.62),L=n*1.7,steps=Math.ceil(L/.45),p1=rnd()*6.28,p2=rnd()*6.28,pts=[];
    for(let k=0;k<=steps;k++){const s=(k/steps-.5)*L,m=Math.sin(s*.12+p1)*RR*.1+Math.sin(s*.05+p2)*RR*.13+(NZ(s*.09+40,5)-.5)*1.4;pts.push([cx+ux*s+px*(off+m),cy+uy*s+py*(off+m)])}
    const pass=(rad,code,only)=>{for(const [x,y] of pts){if(x<-6||y<-6||x>n+6||y>n+6)continue;for(let j=Math.floor(y-rad);j<=Math.ceil(y+rad);j++)for(let i=Math.floor(x-rad);i<=Math.ceil(x+rad);i++)if(inb(i,j)&&Math.hypot(i+.5-x,j+.5-y)<=rad&&only(t[ix(i,j)]))t[ix(i,j)]=code}};
    pass(wd/2+1.3,2,v=>v===3||v===4||v===5||v===13);pass(wd/2,1,v=>v!==18);if(wd>=3.2)pass(wd/2*.5,0,v=>v!==18);
  };
  const markWat=()=>{for(let i=0;i<n*n;i++)wat[i]=(t[i]===0||t[i]===1)?1:0};
  const waterDist=(x,y,r)=>{for(let j=Math.floor(y-r);j<=Math.ceil(y+r);j++)for(let i=Math.floor(x-r);i<=Math.ceil(x+r);i++)if(inb(i,j)&&(t[ix(i,j)]===0||t[ix(i,j)]===1)&&Math.hypot(i+.5-x,j+.5-y)<=r)return true;return false};
  const clearSpot=(cx,cy,r,maxd)=>{if(!waterDist(cx,cy,r))return [cx,cy];for(let d=1;d<=maxd;d+=1)for(let a=0;a<6.283;a+=.4){const x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d;if(x>r&&y>r&&x<n-r&&y<n-r&&!waterDist(x,y,r))return [x,y]}return [cx,cy]};

  const settle=(cx,cy,RR,o)=>{
    o=o||{};const big=RR>=8,dens=o.dens==null?.7:o.dens,walls=!!o.walls,rf=a=>walls?ringR(a,RR):RR;
    markWat();
    const inside=(x,y)=>Math.hypot(x-cx,y-cy)<(walls?rf(Math.atan2(y-cy,x-cx))-2.5:RR-.3);
    disc(cx,cy,RR+1.8,3,v=>v===4||v===13);
    const pr=Math.max(1.8,Math.min(6,RR*(big?.2:.26)));
    /* porte: dove arrivano già strade, altrimenti sparse */
    let ga=findGates(cx,cy,rf);const want=big?(RR>=16?5:4):2;
    for(let tr=0;ga.length<want&&tr<60;tr++){const a=rnd()*6.283;if(ga.every(g=>Math.abs(Math.atan2(Math.sin(a-g),Math.cos(a-g)))>6.283/(want+1)*.7))ga.push(a)}
    ga=ga.slice(0,Math.max(want,3)+1);
    /* piazza acciottolata */
    for(let j=Math.floor(cy-pr-2);j<=Math.ceil(cy+pr+2);j++)for(let i=Math.floor(cx-pr-2);i<=Math.ceil(cx+pr+2);i++){
      if(!inb(i,j))continue;const dd=Math.hypot(i+.5-cx,j+.5-cy);
      if(dd<pr*(1+.16*(NZ(i*.5+3,j*.5+3)-.5)*2))setRoad(i,j,15);
    }
    /* vie principali */
    ga.forEach((g,gi)=>{
      const ex=cx+Math.cos(g)*rf(g),ey=cy+Math.sin(g)*rf(g),sx=cx+Math.cos(g)*pr*.7,sy=cy+Math.sin(g)*pr*.7,dl=Math.hypot(ex-sx,ey-sy),m=Math.max(2,Math.ceil(dl/2.2)),amp=Math.min(2.2,RR*.13),pts=[];
      for(let k=0;k<=m;k++){const f=k/m,w=(NZ(k*.6+gi*5,gi*9+3)-.5)*2*amp*Math.sin(Math.PI*f);pts.push([sx+(ex-sx)*f-Math.sin(g)*w,sy+(ey-sy)*f+Math.cos(g)*w])}
      lay(pts,1.7,big?15:8,{br:true,g:0});
      if(o.lead){
        const out=[],m2=Math.ceil(n*1.1/2.5);for(let k=0;k<=m2;k++){const d=k*2.5,w=(NZ(k*.5+gi*3+60,gi*7)-.5)*2*3;out.push([ex+Math.cos(g)*d-Math.sin(g)*w,ey+Math.sin(g)*d+Math.cos(g)*w])}
        lay(out,2,8,{br:true,g:3});
      }
    });
    /* anelli viari */
    const rings=RR>=15?[RR*.5,RR*.76]:RR>=10?[RR*.45,RR*.72]:RR>=8?[RR*.55]:[];
    rings.forEach((r,ri_)=>{
      const pts=[],stp=Math.ceil(6.283*r/2);for(let k=0;k<=stp;k++){const a=k/stp*6.283,rr=r*(1+.07*(NZ(Math.cos(a)*1.7+r,Math.sin(a)*1.7+ri_*9)-.5)*2);pts.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr])}
      lay(pts,1,8,{br:true,g:1});
    });
    /* viuzze radiali */
    const nl=Math.round(RR/(big?1.7:3));
    for(let q=0;q<nl;q++){
      const a=q/nl*6.283+rnd()*.4;if(ga.some(g=>Math.abs(Math.atan2(Math.sin(a-g),Math.cos(a-g)))<.3))continue;
      const rl=[pr+.6].concat(rings.map(z=>z)),r0=rl[Math.floor(rnd()*rl.length)],r1=Math.min(rf(a)-2.6,r0+RR*rb(.22,.42)),pts=[],m=Math.max(2,Math.ceil((r1-r0)/2));if(r1-r0<2)continue;
      for(let k=0;k<=m;k++){const d=r0+(r1-r0)*k/m,w=(NZ(k*.7+q*4+20,q*3)-.5)*2*1.3;pts.push([cx+Math.cos(a)*d-Math.sin(a)*w,cy+Math.sin(a)*d+Math.cos(a)*w])}
      lay(pts,1,8,{stop:true,g:2});
    }
    /* vicoli: dove un blocco è troppo lontano da una strada ne scava uno */
    const carve=(x0,y0,mk)=>{
      let px=Math.floor(x0),py=Math.floor(y0),pdx=0,pdy=0,acc=0;
      for(let st=0;st<40;st++){
        if(!inb(px,py))break;const dv=sd[ix(px,py)];if(dv===0||dv===255)break;
        const cand=[];for(const [dx,dy] of D4){const xx=px+dx,yy=py+dy;if(inb(xx,yy)&&sd[ix(xx,yy)]<dv)cand.push([dx,dy])}
        if(!cand.length)break;
        let ch=cand.find(z=>z[0]===pdx&&z[1]===pdy);if(!ch||rnd()<.12)ch=cand[Math.floor(rnd()*cand.length)];
        pdx=ch[0];pdy=ch[1];px+=pdx;py+=pdy;const q=ix(px,py);if(GR(t[q]))t[q]=8;sd[q]=0;
        acc++;if(mk&&acc>=1)SM.push({x:px+.5,y:py+.5,nx:-pdy,ny:pdx,w:1,rh:1,g:2});
      }
    };
    distField();
    if(big)for(let it=0;it<90;it++){
      let bi=-1,bv=5;for(let j=0;j<n*n;j++){const v=sd[j];if(v>bv&&GR(t[j])&&inside(j%n+.5,((j-j%n)/n)+.5)){bv=v;bi=j}}
      if(bi<0)break;carve(bi%n,(bi-bi%n)/n,true);distField();
    }
    /* mura con torri e porte */
    if(walls){
      const th=RR>=13?2:1,rr=Math.max(.72,th/2+.1),stp=Math.ceil(6.283*RR/.35);
      for(let k=0;k<stp;k++){
        const a=k/stp*6.283,r=ringR(a,RR),px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;
        for(let j=Math.floor(py-rr);j<=Math.floor(py+rr);j++)for(let i=Math.floor(px-rr);i<=Math.floor(px+rr);i++){
          if(!inb(i,j)||Math.hypot(i+.5-px,j+.5-py)>rr)continue;const q=ix(i,j),v=t[q];
          if(wat[q]===1||v===8||v===15||v===14||v===18)continue;t[q]=19;
        }
      }
      const gts=findGates(cx,cy,rf),tw=Math.max(6,Math.round(6.283*RR/8)),ts=RR>=13?1:.82,tOpt=a=>({s:a,v:false,force:true,on:[19,3,2,5,8,15],f:0,fr:.1,or:.7});
      for(let k=0;k<tw;k++){
        const a=(k+.5)/tw*6.283;if(gts.some(g=>Math.abs(Math.atan2(Math.sin(a-g),Math.cos(a-g)))<.2))continue;
        const r=ringR(a,RR),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;if(inb(Math.floor(x),Math.floor(y))&&t[ix(Math.floor(x),Math.floor(y))]===19)put('torrione',x,y-.1,tOpt(ts));
      }
      gts.forEach(g=>{
        const r=ringR(g,RR),x=cx+Math.cos(g)*r,y=cy+Math.sin(g)*r,tx=-Math.sin(g),ty=Math.cos(g),ix_=Math.cos(g),iy_=Math.sin(g);
        for(const sg of [1,-1]){put('torrione',x+tx*2.5*sg,y+ty*2.5*sg-.1,tOpt(ts*1.1));put('lampione',x+tx*1.7*sg-ix_*1.6,y+ty*1.7*sg-iy_*1.6,{s:.9,v:false,f:0,force:true,fr:.1,or:.2})}
      });
    }
    distField();
    /* piazza: fontana, mercato, lampioni */
    if(pr>=3){putP('fontana',cx,cy,pr>=4?1.1:.95,{hw:.5,hh:.4,mg:0})}
    else putP('pozzo',cx,cy,1.1,{hw:.4,hh:.4,mg:0});
    if(R>.2){
      const rads=pr>=4.2?[pr*.58,pr*.86]:pr>=3?[pr*.66]:[],kinds=['bancarella','bancarella2','bancarella3','bancarella4'];let ci=Math.floor(rnd()*4);
      rads.forEach((rd,ri_)=>{
        const cnt=Math.floor(6.283*rd/2.25),ph=rnd()*6.283;
        for(let k=0;k<cnt;k++){
          const a=ph+k/cnt*6.283;if(ga.some(g=>Math.abs(Math.atan2(Math.sin(a-g),Math.cos(a-g)))<.42))continue;
          putP(kinds[ci++%4],cx+Math.cos(a)*rd*(ri_?1:.96),cy+Math.sin(a)*rd*.9,.85+rnd()*.15,{hw:.5,hh:.42,mg:.05,f:rnd()<.5?1:0});
        }
      });
      for(let q=0;q<(pr>=3?3:0);q++){const a=rnd()*6.283,rd=rb(pr*.25,pr*.5);if(rnd()<.5)putP('carretto',cx+Math.cos(a)*rd,cy+Math.sin(a)*rd,.9,{hw:.5,hh:.3,mg:.05});else putP('barile',cx+Math.cos(a)*rd,cy+Math.sin(a)*rd,.8,{hw:.3,hh:.38,mg:.05})}
    }
    /* edifici maggiori attorno alla piazza */
    const slotA=[],sc0=rnd()*6.283;
    for(let k=0;k<12;k++){const a=sc0+k/12*6.283;if(ga.every(g=>Math.abs(Math.atan2(Math.sin(a-g),Math.cos(a-g)))>.5))slotA.push(a)}
    const lm=(k,sc,idx)=>{
      if(!slotA.length)return null;const ang=slotA[idx%slotA.length],S=STM[k][3]*sc;
      for(let dd=0;dd<8;dd+=.6){const rr=pr+S*.42+.9+dd,b=putB(k,cx+Math.cos(ang)*rr,cy+Math.sin(ang)*rr*(Math.sin(ang)>0?1:1.0),sc);if(b){b.__S=S;return b}}
      return null;
    };
    const HS=[],cnt={},lbl=[];
    const reg=(b,k)=>{if(b){const S=STM[k][3]*b.s/STM[k][3];HS.push({k,x:b.x,y:b.y,S:b.s,hw:.46*b.s,hh:.4*b.s});cnt[k]=(cnt[k]||0)+1}return b};
    const sizeK=big?1:.8;
    const ch=reg(lm(big&&RR>=14?'cattedrale':'chiesa',(big?1:.85)*(RR>=14?.9:1),0),big&&RR>=14?'cattedrale':'chiesa');
    if(ch){
      lbl.push([RR>=14?'Cattedrale':'Chiesa',ch.x,ch.y+ch.s*.5+.6]);
      /* cimitero accanto alla chiesa */
      if(R>.25){const sd_=rnd()<.5?-1:1;for(const sg of [sd_,-sd_]){
        const yx=ch.x+sg*(ch.s*.5+1.7),yy=ch.y+.1*ch.s;let ok=rFree(yx,yy,1.5,1.2,.05)&&okG(yx,yy,1.5,1.2);
        if(ok){rAdd(yx,yy,1.5,1.2);for(let a=0;a<3;a++)for(let b=0;b<2;b++)put('tomba',yx-1+a*1,yy-.45+b*1,{s:.85,v:false,force:true,fr:.1,f:rnd()<.5?1:0});
          put('recinto',yx,yy-1.3,{s:.85,v:false,r:0,f:0,force:true,fr:.1});put('recinto',yx,yy+1.25,{s:.85,v:false,r:0,f:0,force:true,fr:.1});break}
      }}
    }
    if(o.castle){const cs=reg(lm('castello',big?1:.8,1),'castello');if(cs)lbl.push(['Castello',cs.x,cs.y+cs.s*.5+.6])}
    else if(big){const mh=reg(lm('municipio',1,1),'municipio');if(mh)lbl.push(['Municipio',mh.x,mh.y+mh.s*.5+.6])}
    const tv=reg(lm('taverna',big?1:.9,2),'taverna');if(tv)lbl.push([pk(TAV),tv.x,tv.y+tv.s*.5+.6]);
    if(big){reg(lm('casagrande',1,3),'casagrande');reg(lm('casagrande',1,4),'casagrande');reg(lm('bottega',1,5),'bottega');reg(lm('bottega',1,6),'bottega')}
    else{reg(lm('bottega',.95,3),'bottega')}
    /* lampioni lungo le vie principali */
    if(R>.3){let la=0,side=1;SM.filter(s=>s.g===0&&inside(s.x,s.y)).forEach(s=>{la+=1;if(la%5)return;side=-side;putB('lampione',s.x+s.nx*side*(s.rh+.3),s.y+s.ny*side*(s.rh+.3),.85,{hw:.15,hh:.2,mg:.05,f:0})})}
    /* edifici lungo le vie, per quartiere */
    const caps={taverna:Math.max(1,Math.round(RR/9)),fabbro:RR>=9?2:1,forno:RR>=9?2:1,magazzino:RR>=12?3:1,stalla:big?4:2};
    const okc=k=>(cnt[k]||0)<(caps[k]==null?1e9:caps[k]);
    const pickB=(d,second)=>{
      const r=rnd();
      if(d<.34&&!second){return r<.36?'casagrande':r<.62?'bottega':r<.8?'casa_t':r<.88&&okc('taverna')?'taverna':r<.93&&okc('forno')?'forno':casa()}
      if(d<.7){return r<.3?casa():r<.55?'casa_t':r<.66?'bottega':r<.72?'casagrande':r<.76&&okc('fabbro')?'fabbro':r<.8&&okc('forno')?'forno':r<.84&&okc('magazzino')?'magazzino':r<.87&&okc('taverna')?'taverna':'casetta'}
      return r<.36?'casetta':r<.6?casa():r<.7?'casa_t':r<.78&&okc('stalla')?'stalla':r<.82&&okc('magazzino')?'magazzino':r<.85&&okc('fabbro')?'fabbro':'casetta';
    };
    const baseSc={casa:1,casa_t:1,casetta:1,casagrande:1,bottega:1,taverna:1,fabbro:1,forno:1,magazzino:.95,stalla:.95};
    const bud=()=>MAXO-objs.length-70;
    const place=(k,x,y,d,f)=>{
      const sc=(baseSc[k]||1)*(.9+rnd()*.2)*(d>.7?.9:1)*sizeK,b=putB(k,x,y,sc,{f});
      if(b){reg(b,k);if(k==='fabbro'&&!lbl.some(l=>l[0]==='Fucina'))lbl.push(['Fucina',b.x,b.y+b.s*.5+.55]);if(k==='bottega'||k==='taverna'||k==='forno'){if(rnd()<.5)put('barile',b.x+b.s*.46+.35,b.y+b.s*.35,{s:.7,v:false,fr:.1,force:true})}}
      return b;
    };
    const ord=SM.filter(s=>inside(s.x,s.y)&&Math.hypot(s.x-cx,s.y-cy)>pr+1.5);shuf(ord);ord.sort((a,b)=>a.g-b.g);
    for(const s of ord.concat(shuf(ord.slice()))){
      if(bud()<=0)break;
      const d=Math.hypot(s.x-cx,s.y-cy)/RR,sides=rnd()<.5?[1,-1]:[-1,1];
      for(const sg of sides){
        if(rnd()>dens)continue;
        const k=pickB(d,false),sc=(baseSc[k]||1)*sizeK,S=STM[k][3]*sc,hw=.46*S,hh=.4*S,set=d<.34?.3:.6,off=s.rh+set+hw*Math.abs(s.nx)+hh*Math.abs(s.ny);
        const x=s.x+s.nx*sg*off,y=s.y+s.ny*sg*off;if(!inside(x,y))continue;
        const b=place(k,x,y,d,sg>0?0:1);if(b&&d>=.34)footpath(x,y+hh*.6);
      }
    }
    /* seconda fila, nei blocchi tra le vie */
    const gp=[];for(let ps=0;ps<9;ps++)for(let gy=cy-RR;gy<=cy+RR;gy+=1.9)for(let gx=cx-RR;gx<=cx+RR;gx+=1.9)gp.push([gx+rb(-.95,.95),gy+rb(-.95,.95)]);shuf(gp);
    for(const [x,y] of gp){
      if(bud()<=0)break;if(!inside(x,y)||Math.hypot(x-cx,y-cy)<pr+1.8||rnd()>Math.min(.97,dens*1.2))continue;
      const fx=Math.floor(x),fy=Math.floor(y);if(!inb(fx,fy))continue;const dv=sd[ix(fx,fy)];if(dv<1||dv>6)continue;
      const d=Math.hypot(x-cx,y-cy)/RR,k=pickB(d,true),b=place(k,x,y,d,rnd()<.5?0:1);if(b)footpath(x,y+b.s*.3);
    }
    /* pozzi nei quartieri */
    for(let q=0,m=Math.max(1,Math.round(RR/5));q<m&&SM.length;q++){const s=pk(SM.filter(z=>z.g>=1&&inside(z.x,z.y)));if(!s)break;putB('pozzo',s.x+s.nx*(s.rh+.5),s.y+s.ny*(s.rh+.5),.85,{hw:.35,hh:.35,mg:.1})}
    /* orti, frutteti e dettagli dietro le case */
    HS.forEach(h=>{
      if(bud()<=0)return;
      const d=Math.hypot(h.x-cx,h.y-cy)/RR;
      if(d>.3&&(h.k.indexOf('casa')===0&&h.k!=='casagrande'||h.k==='casetta'||h.k==='stalla')&&rnd()<.5*dens+.1*R){
        const pw=rnd()<.5?2:3,ph=rnd()<.5?1:2,px=h.x+rb(-.6,.6),py=h.y-h.hh-ph/2-.55;
        if(okG(px,py,pw/2,ph/2)&&rFree(px,py,pw/2,ph/2,.05)){for(let j=Math.floor(py-ph/2);j<Math.floor(py+ph/2);j++)for(let i=Math.floor(px-pw/2);i<Math.floor(px+pw/2);i++)if(inb(i,j)&&GR(t[ix(i,j)])&&sd[ix(i,j)]>0)t[ix(i,j)]=20;rAdd(px,py,pw/2,ph/2)}
      }
      if(d>.45&&rnd()<.3*R)put('frutteto',h.x+(rnd()<.5?-1:1)*(h.hw+.9),h.y-h.hh*.2,{s:.85});
      if(d>.55&&h.k==='stalla'&&rnd()<.8)put('pagliaio',h.x-h.hw-.7,h.y+h.hh*.3,{s:.9});
      if(d>.35&&rnd()<.14*R)put('carretto',h.x+h.hw+.9,h.y+h.hh*.5,{s:.8});
      if(rnd()<.22*R)put(rnd()<.5?'cespuglio':'fiori',h.x+rb(-h.hw,h.hw),h.y+h.hh+.55,{s:.7});
    });
    /* moli e barche lungo le rive */
    if(R>.25){
      const banks=[];for(let q=0;q<n*n;q++){if(t[q]!==1)continue;const x=q%n,y=(q-x)/n;if(!inside(x+.5,y+.5)&&Math.hypot(x-cx,y-cy)>RR+1)continue;for(const [dx,dy] of D4){const xx=x+dx,yy=y+dy;if(inb(xx,yy)&&GR(t[ix(xx,yy)])&&sd[ix(xx,yy)]>1){banks.push([x,y,dx,dy]);break}}}
      shuf(banks);let pm=0;
      for(const [x,y,dx,dy] of banks){if(pm>=Math.max(1,Math.round(RR/8)))break;
        const mx=x+.5-dx*.9,my=y+.5-dy*.9;
        if(put('molo',x+.5-dx*.5,y+.5-dy*.5,{s:1.1,v:false,r:Math.abs(dx)?0:90,f:0,on:[1,2,3,5],fr:1.2,or:.8})){pm++;put('barchetta',x+.5-dx*2.4+dy*1.4,y+.5-dy*2.4+dx*1.4,{s:.9,v:false,on:[1],r:rb(-12,12),fr:.5,or:.5})}
      }
    }
    /* insegne dei luoghi */
    if(R>.35&&big)lbl.forEach(l=>addTxt(l[0],l[1],l[2],Math.max(.62,n/95)));
    return {pr,HS,ga,inside};
  };

  /* =============== TERRA E MARI =============== */
  if(gt==='terra'){
    const nz=mkNoise(hashSeed(c.seed+'#pz'));
    /* fiumi dalle montagne al mare */
    if(d&&d.el&&!dry){
      const hi=cells(v=>v===6||v===5),nr=Math.min(5,1+Math.floor(R*1.5*A));
      for(let q=0;q<nr&&hi.length;q++){
        let bi_=pk(hi);for(let z=0;z<10;z++){const j=pk(hi);if(d.el[j]>d.el[bi_])bi_=j}
        let [x,y]=xy(bi_);const vis=new Uint8Array(n*n),path=[];
        for(let s=0;s<n*3;s++){
          const i=ix(x,y);vis[i]=1;path.push(i);if(W(t[i])||t[i]===18)break;
          let best=-1,be=1e9;
          for(const [dx,dy] of D4){const xx=x+dx,yy=y+dy;if(!inb(xx,yy))continue;const j=ix(xx,yy);if(vis[j])continue;const e=d.el[j]+rnd()*.015;if(e<be){be=e;best=j}}
          if(best<0)break;[x,y]=xy(best);
        }
        path.forEach(i=>{if(!W(t[i])&&t[i]!==18)t[i]=1});
      }
    }
    /* terreni speciali secondo la palette */
    if(dry){
      const g=cells(v=>v===3||v===2);
      for(let q=0;q<Math.max(1,Math.round(A*1.5))&&g.length;q++)for(let tr=0;tr<100;tr++){
        const [x,y]=xy(pk(g));let ok=x>3&&y>3&&x<n-4&&y<n-4;
        for(let j=y-3;ok&&j<=y+3;j++)for(let i=x-3;i<=x+3;i++){const v=t[ix(i,j)];if(W(v)||v===6||v===7||v===18){ok=false;break}}
        if(ok){disc(x+.5,y+.5,1.8,1,v=>v!==18);break}
      }
    }else if(cold){
      cells(v=>v===1).forEach(i=>{const [x,y]=xy(i);if(rnd()<.75&&D4.some(([dx,dy])=>inb(x+dx,y+dy)&&!W(t[ix(x+dx,y+dy)])&&t[ix(x+dx,y+dy)]!==18))t[i]=17});
    }else if(hot){
      cells(v=>v===6).forEach(i=>{const [x,y]=xy(i);if(nz(x*.22+3,y*.22+3)>.64)t[i]=12});
    }else{
      cells(v=>v===3).forEach(i=>{const [x,y]=xy(i);if(nz(x*.3,y*.3)>.56&&nearW(x+.5,y+.5,2)&&rnd()<.85)t[i]=13});
    }
    /* insediamenti */
    const towns=[],want=Math.max(1,Math.round(n/20*(.4+R))),gl=cells(v=>v===3);
    const flat=(cx,cy,r)=>{for(let j=cy-r;j<=cy+r;j++)for(let i=cx-r;i<=cx+r;i++){if(!inb(i,j))return false;const v=t[ix(i,j)];if(v!==3&&v!==4&&v!==5&&v!==2)return false}return true};
    const sp=Math.max(7,n/(want+1)*.85);
    for(let q=0;q<want&&gl.length;q++){
      const typ=q===0?0:rnd()<.55?1:2,rr=typ===0?Math.max(5,Math.min(12,Math.round(n/11))):typ===1?Math.max(3,Math.min(6,Math.round(n/22))):2;let ok=false;
      for(let rad=rr;rad>=1&&!ok;rad--)for(let tr=0;tr<250&&!ok;tr++){
        const [x,y]=xy(pk(gl));
        if(t[ix(x,y)]!==3||!flat(x,y,rad)||!towns.every(s=>Math.hypot(s.x-x,s.y-y)>=Math.max(sp*(rad<rr?.6:1),s.rad+rad+2)))continue;
        towns.push({x,y,typ,rad,name:name()});ok=true;
      }
    }
    /* strade (Dijkstra sul terreno) con ponti, cartelli e porta cittadina */
    const cost=v=>v===0||v===12||v===18?1e9:v===1?6:v===4?2.4:v===5?2.2:v===6?9:v===7?11:v===13?4:v===17?3:(v===8||v===15)?.6:1;
    const roadPath=(a,b)=>{
      const N=n*n,dist=new Float64Array(N).fill(1e9),prev=new Int32Array(N).fill(-1),h=[];
      const push=(dd,i)=>{h.push([dd,i]);let k=h.length-1;while(k>0){const p=(k-1)>>1;if(h[p][0]<=h[k][0])break;const tmp=h[p];h[p]=h[k];h[k]=tmp;k=p}};
      const pop=()=>{const top=h[0],last=h.pop();if(h.length){h[0]=last;let k=0;for(;;){const l=2*k+1,r=l+1;let m=k;if(l<h.length&&h[l][0]<h[m][0])m=l;if(r<h.length&&h[r][0]<h[m][0])m=r;if(m===k)break;const tmp=h[m];h[m]=h[k];h[k]=tmp;k=m}}return top};
      const s0=ix(a.x,a.y),e0=ix(b.x,b.y);dist[s0]=0;push(0,s0);
      while(h.length){
        const [dd,i]=pop();if(dd>dist[i])continue;if(i===e0)break;const x=i%n,y=(i-x)/n;
        for(const [dx,dy] of D4){const xx=x+dx,yy=y+dy;if(!inb(xx,yy))continue;const j=ix(xx,yy),cj=cost(t[j]);if(cj>=1e9)continue;const nd=dd+cj;if(nd<dist[j]){dist[j]=nd;prev[j]=i;push(nd,j)}}
      }
      if(prev[e0]<0&&s0!==e0)return [];
      const path=[];for(let i=e0;i>=0;i=prev[i])path.push(i);
      return path.reverse();
    };
    const layRoad=(path,cap)=>{
      if(path.length<2)return;
      for(let k=0;k<path.length;k++){const i=path[k],v=t[i];if(v===1||v===6||v===7||v===12||v===17||v===15||v===18)continue;if(v!==8)t[i]=8}
      for(let k=0;k<path.length;k++){
        if(t[path[k]]!==1)continue;let e=k;while(e+1<path.length&&t[path[e+1]]===1)e++;
        if(e-k+1<=8&&k>0&&e<path.length-1){
          const [x0,y0]=xy(path[k-1]),[x1,y1]=xy(path[e+1]);
          put('ponte',(x0+x1)/2+.5,(y0+y1)/2+.5,{s:(e-k+2.4)/3,v:false,on:[1,8],r:Math.atan2(y1-y0,x1-x0)*180/Math.PI,f:0,force:true,or:.5});
        }
        k=e;
      }
      if(path.length>10){const [x,y]=xy(path[Math.floor(path.length*.4)]);put('cartello',x+1.4,y-.2,{s:.9})}
      if(cap){
        const [fx,fy]=xy(path[0]),[lx,ly]=xy(path[path.length-1]),fw=Math.hypot(fx-cap.x,fy-cap.y)<Math.hypot(lx-cap.x,ly-cap.y);
        for(let q=0;q<path.length;q++){
          const k=fw?q:path.length-1-q,[x,y]=xy(path[k]);
          if(Math.hypot(x-cap.x,y-cap.y)>cap.rad+2.2){
            const k2=Math.max(0,Math.min(path.length-1,k+(fw?1:-1))),[x2,y2]=xy(path[k2]),vert=Math.abs(x2-x)>Math.abs(y2-y);
            put('porta',x+.5,y+.5,{s:1,v:false,force:true,f:0,r:vert?90:0,on:[8]});
            put('recinto',x+.5+(vert?0:-1.7),y+.5+(vert?-1.7:0),{s:.7,v:false,r:vert?90:0,f:0});
            put('recinto',x+.5+(vert?0:1.7),y+.5+(vert?1.7:0),{s:.7,v:false,r:vert?90:0,f:0});
            break;
          }
        }
      }
    };
    for(let i=1;i<towns.length;i++){
      let bj=0,bd=1e9;for(let j=0;j<i;j++){const dd=Math.hypot(towns[j].x-towns[i].x,towns[j].y-towns[i].y);if(dd<bd){bd=dd;bj=j}}
      layRoad(roadPath(towns[i],towns[bj]),null);
    }
    if(towns.length>2&&R>.4)layRoad(roadPath(towns[towns.length-1],towns[0]),null);
    foot(Math.round(R*3*A));
    /* gli insediamenti veri e propri, sopra le strade già tracciate */
    towns.forEach(s=>{
      const cx=s.x+.5,cy=s.y+.5;disc(cx,cy,s.rad+.8,3,v=>v===4||v===13);
      if(s.typ===0)settle(cx,cy,s.rad,{walls:s.rad>=6&&R>.3,castle:true,dens:.5+R*.4,lead:false});
      else if(s.typ===1)settle(cx,cy,s.rad,{walls:false,dens:.45+R*.3,lead:false});
      else{
        put('falo',cx,cy,{s:1});
        for(let a=0;a<3;a++){const an=a/3*6.283+rnd(),rr=rb(1.7,2.2);put('tenda',cx+Math.cos(an)*rr,cy+Math.sin(an)*rr,{rot:true})}
        put('bandiera',cx+.2,cy-2.2,{s:.9});put('barile',cx+1.2,cy+1.0,{s:.9});put('tavolo',cx-1.3,cy+1.0,{s:.8});
        put('letto',cx-2.1,cy-.3,{s:.8,r:90});put('torcia',cx+1.6,cy-1,{s:.8});
        if(rnd()<.4)put('torre',cx+2.6,cy+1.5,{s:.8});
      }
    });
    /* luoghi remoti */
    const land=cells(v=>v===3||v===5||v===2||v===4),spots=[];
    const spot=(r,minD)=>{
      for(let tr=0;tr<200;tr++){
        const [x,y]=xy(pk(land));
        if(r>0&&!flat(x,y,Math.ceil(r)))continue;if(r===0&&t[ix(x,y)]===4)continue;
        if(!towns.every(s=>Math.hypot(s.x-x,s.y-y)>=minD)||!spots.every(s=>Math.hypot(s[0]-x,s[1]-y)>=r*2+3))continue;
        spots.push([x,y]);return [x+.5,y+.5];
      }
      return null;
    };
    const treasure=(x,y,hid)=>{
      const b=put('baule',x,y,{s:1,h:hid?1:0});if(!b)return;if(!b.h)delete b.h;
      if(hid){put('croce',x,y,{s:.9,h:1,force:true,f:0});if(rnd()<.5)put('trappola',x+rb(-1.4,1.4),y+rb(1.1,1.6),{s:.7,h:1})}
    };
    for(let q=0;q<Math.max(1,Math.round(R*2*A));q++){
      const p=spot(2,n/12);if(!p)break;const [x,y]=p;
      put('rovine',x,y,{s:1.1});put('colonna',x-1.6,y+1.2,{s:.7});put('colonna',x+1.7,y-1.1,{s:.7});
      if(rnd()<.5)put('statua',x+1.4,y+1.5,{s:.8});
      if(rnd()<.4)for(let z=0;z<ri(2,4);z++)put('tomba',x+rb(-3,3),y+rb(2.2,3.4),{s:.9});
      put('teschio',x-1.2,y-1.6,{s:.8});
      if(rnd()<.45){put('scala',x,y+1.8,{s:.9});put('pin',x+1.5,y+1.9,{s:.8,h:1,force:true})}
      if(rnd()<.3)put('botola',x-1.9,y-.4,{s:.8,h:1});
    }
    if(R>.25)for(let q=0;q<(n>=96?2:1);q++){
      const p=spot(3,n/8);if(!p)break;const [x,y]=p;
      put('altare',x,y,{s:1});
      for(let a=0;a<6;a++){const an=a/6*6.283;put('colonna',x+Math.cos(an)*2.3,y+Math.sin(an)*2.3,{s:.8})}
      put('teschio',x+.9,y+.8,{s:.7});put('teschio',x-1.0,y-.7,{s:.7});
      if(rnd()<.5)put('portale',x,y-3.4,{s:1});
      put('stella',x,y+3.5,{s:.9,h:1,force:true,f:0});
    }
    for(let q=0;q<2+Math.round(R*4*A);q++){const p=spot(0,n/12);if(p)treasure(p[0],p[1],rnd()<.5)}
    if(R>.2){const p=spot(1,n/10);if(p)put('torre',p[0],p[1],{s:1.1})}
    if(R>.4){const p=spot(2,n/10);if(p)put('tempio',p[0],p[1],{s:1})}
    for(let q=0;q<Math.round((.5+R)*A);q++){
      const p=spot(2,n/10);if(!p)break;const [x,y]=p;
      put('falo',x,y,{s:.9});put('tenda',x-1.8,y-.6);put('tenda',x+1.8,y-.4);put('barile',x+.6,y+1.4,{s:.8});put('tavolo',x-1.2,y+1.3,{s:.7});put('letto',x+.4,y-1.7,{s:.7,r:90});put('bandiera',x+2.4,y+1.3,{s:.8});
    }
    for(let q=0;q<Math.max(1,Math.round(R*2*A));q++){const p=spot(0,n/14);if(p){put('pozzo',p[0],p[1],{s:.9});put('cartello',p[0]+1.4,p[1]-.2,{s:.9})}}
    const mt=cells(v=>v===6),snow=cells(v=>v===7),hills=cells(v=>v===5),forest=cells(v=>v===4),grass=cells(v=>v===3),sand=cells(v=>v===2);
    if(mt.length&&d&&d.el){let bj=mt[0];mt.forEach(j=>{if(d.el[j]>d.el[bj])bj=j});const [x,y]=xy(bj);put('bandiera',x+.5,y+.2,{s:.9,force:true})}
    if(mt.length>20&&(hot||rnd()<.25+.3*R)){const [x,y]=xy(pk(mt));put('vulcano',x+.5,y+.5,{s:1,fr:1.1})}
    scatter(mt,.04,Math.max(1,Math.round(R*3*A)),(x,y)=>put('cristallo',x,y,{s:1}));
    /* mare: navi e scogli */
    scatter(cells((v,x,y)=>v===0&&D4.every(([dx,dy])=>inb(x+dx,y+dy)&&t[ix(x+dx,y+dy)]===0)),.08,Math.max(1,Math.round((1+R*3)*A)),(x,y)=>put('nave',x,y,{on:[0],s:rb(.8,1.1),v:false,r:rb(-180,180),fr:1.3}));
    scatter(cells(v=>v===1),.03,Math.round(R*5*A),(x,y)=>put('roccia',x,y,{on:[1],s:.7,rot:true}));
    /* natura */
    const bud=Math.max(0,MAXO-objs.length-90),treeK=()=>dry?'palma':hot?'morto':cold?'pino':(rnd()<.55?'pino':'quercia');
    scatter(forest,.5+.4*R,bud*.4,(x,y)=>put(treeK(),x,y,{rot:true}));
    scatter(grass,.12+.1*R,bud*.07,(x,y,cx,cy)=>nz(cx*.25+7,cy*.25+7)>.52&&put(treeK(),x,y,{rot:true}));
    scatter(hills,.18,bud*.06,(x,y)=>put('collina',x,y,{s:.8,fr:1.1}));
    scatter(mt,.2,bud*.08,(x,y)=>put('montagna',x,y,{s:.75,fr:1}));
    scatter(snow,.12,bud*.03,(x,y)=>put('montagna',x,y,{s:.7,fr:1}));
    scatter(hills.concat(mt),.07,bud*.04,(x,y)=>put('roccia',x,y,{rot:true}));
    scatter(sand,.09,bud*.04,(x,y)=>dry?put('cactus',x,y,{rot:true}):nearW(x,y,3)?put('palma',x,y,{rot:true}):put('roccia',x,y,{s:.7,rot:true}));
    scatter(grass,.07+.05*R,bud*.12,(x,y)=>dry?put(rnd()<.7?'cactus':'morto',x,y,{rot:true}):hot?put(rnd()<.5?'morto':'roccia',x,y,{rot:true}):put('cespuglio',x,y,{rot:true}));
    if(!dry&&!hot&&!cold)scatter(grass,.08+.08*R,bud*.1,(x,y,cx,cy)=>nz(cx*.4+5,cy*.4+5)>.45&&put('fiori',x,y));
    scatter(cells(v=>v===13),.14,bud*.04,(x,y)=>rnd()<.6?put('morto',x,y,{rot:true}):put('cespuglio',x,y,{rot:true}));
    scatter(cells(v=>v===13),.02,6,(x,y)=>put('teschio',x,y,{s:.8}));
    scatter(cells(v=>v===17),.07,bud*.03,(x,y)=>rnd()<.6?put('roccia',x,y,{s:.7,rot:true}):put('cristallo',x,y,{s:.8}));
    scatter(cells(v=>v===12),.06,bud*.02,(x,y)=>rnd()<.8?put('roccia',x,y,{s:.7,on:[12],rot:true}):put('teschio',x,y,{s:.8,on:[12]}));
    /* scritte */
    towns.forEach(s=>addTxt(s.name,s.x+.5,s.y+.5-s.rad-1.2,Math.max(.9,n/55)*(s.typ===0?1.5:s.typ===1?1.1:.9)));
    const seas=comps(v=>v===0);if(seas.length&&seas[0].length>n*n*.04){const [x,y]=mid(seas[0]);addTxt('Mare di '+name(),x+.5,y+.5,Math.max(1.3,n/26))}
    const lands=comps(v=>!W(v)&&v!==18&&v!==12);
    if(lands.length&&lands[0].length>n*n*.05){const [x,y]=mid(lands[0]);addTxt('Terre di '+name(),x+.5,y+.5+2,Math.max(1.3,n/26))}
    lands.slice(1,5).forEach(l=>{if(l.length>n*n*.012){const [x,y]=mid(l);addTxt('Isola di '+name(),x+.5,y+.5,Math.max(1,n/42))}});
    const mc=comps(v=>v===6||v===7);if(mc.length&&mc[0].length>12){const [x,y]=mid(mc[0]);addTxt('Monti '+name(),x+.5,y+.5,Math.max(1.1,n/34))}
    const fc=comps(v=>v===4);if(fc.length&&fc[0].length>25){const [x,y]=mid(fc[0]);addTxt('Foresta di '+name(),x+.5,y+.5,Math.max(1.1,n/34))}
    return;
  }

  /* =============== DUNGEON =============== */
  if(gt==='dungeon'){
    const rooms=comps(v=>v===9).filter(r=>r.length>=6),nrm=rooms.length,bud=Math.max(0,MAXO-objs.length-60);
    const stairs=objs.filter(o=>o.k==='scala');
    rooms.forEach((rm,ri_)=>{
      const set=new Set(rm),E=[],I=[];let x0=n,y0=n,x1=0,y1=0;
      rm.forEach(i=>{
        const [x,y]=xy(i);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
        (D4.some(([dx,dy])=>!(inb(x+dx,y+dy)&&set.has(ix(x+dx,y+dy))))?E:I).push([x,y]);
      });
      const w=x1-x0+1,h=y1-y0+1,area=rm.length,big=area>=30,cx=(x0+x1+1)/2,cy=(y0+y1+1)/2;
      const pl=(list,k,o)=>{if(!list.length)return null;for(let tr=0;tr<16;tr++){const [x,y]=pk(list),r=put(k,x+.5,y+.5,o);if(r)return r}return null};
      const rep=(m,fn)=>{for(let i=0;i<m;i++)fn()};
      const rall=E.concat(I),special=stairs.some(o=>set.has(ix(Math.floor(o.x),Math.floor(o.y))));
      rep(Math.round((big?3:1)*(.4+R)),()=>pl(E,'torcia',{s:.8}));
      if(special){if(rnd()<.7)pl(E,'cartello',{s:.8});return}
      const kinds=big?['sala','sala','cripta','rituale','tesoro','caserma','allagata','forgia','ghiaccio']:['deposito','deposito','tesoro','cella','guardia','altare','tesoro'];
      let kind=pk(kinds);
      if(kind==='forgia'&&(w<7||h<7))kind='sala';
      if(kind==='ghiaccio'&&!cold)kind=hot?'forgia':'allagata';
      if(kind==='forgia'&&(w<7||h<7))kind='sala';
      if(kind==='sala'){
        rm.forEach(i=>{const [x,y]=xy(i);if((x-x0)%3===1&&(y-y0)%3===1&&set.has(ix(x,y))&&I.some(a=>a[0]===x&&a[1]===y))put('colonna',x+.5,y+.5,{s:.8})});
        rep(ri(1,2),()=>pl(E,'bandiera',{s:.8}));pl(I,'statua',{s:.8});if(rnd()<.5)pl(I,'tavolo',{s:.8});
      }else if(kind==='cripta'){
        rep(ri(3,6),()=>pl(rall,'tomba',{s:.9}));rep(3,()=>pl(rall,'teschio',{s:.8}));rep(2,()=>pl(I,'colonna',{s:.8}));
        pl(I,'altare',{s:.9});pl(E,'statua',{s:.8});if(rnd()<.5)pl(rall,'rovine',{s:.8});
      }else if(kind==='rituale'){
        const a=put('altare',cx,cy,{s:1,force:true,f:0});
        if(a)[[-2,-2],[2,-2],[-2,2],[2,2]].forEach(([dx,dy])=>put('colonna',cx+dx,cy+dy,{s:.8,on:[9]}));
        rep(3,()=>pl(rall,'teschio',{s:.7}));if(rnd()<.5)pl(I,'portale',{s:.9});pl(I,'falo',{s:.7});
        put('stella',cx,cy+1.6,{s:.8,h:1,force:true,f:0,on:[9]});
      }else if(kind==='tesoro'){
        rep(ri(1,2)+(big?1:0),()=>{const b=pl(E,'baule',{s:.9});if(b&&rnd()<.35){b.h=1;put('croce',b.x,b.y,{s:.7,h:1,force:true,f:0})}});
        rep(2,()=>pl(E,'statua',{s:.8}));rep(2,()=>pl(I,'trappola',{s:.7,h:1}));rep(2,()=>pl(rall,'teschio',{s:.7}));
      }else if(kind==='caserma'||kind==='guardia'){
        rm.forEach(i=>{if(t[i]===9)t[i]=14});
        if(kind==='caserma')rep(ri(3,6),()=>pl(E,'letto',{s:.8}));
        pl(I,'tavolo',{s:.9});rep(2,()=>pl(E,'barile',{s:.7}));pl(E,'bandiera',{s:.8});if(kind==='guardia')pl(I,'falo',{s:.8});
      }else if(kind==='deposito'){
        rep(ri(4,8),()=>pl(E,'barile',{s:.7}));const b=pl(E,'baule',{s:.8});if(b&&rnd()<.3)b.h=1;
        if(rnd()<.3)pl(rall,'tavolo',{s:.8});if(rnd()<.4)pl(I.length?I:E,'botola',{s:.8,h:1});
      }else if(kind==='cella'){
        rm.forEach(i=>{if(t[i]===9&&rnd()<.25)t[i]=13});
        pl(E,'letto',{s:.8});rep(2,()=>pl(rall,'teschio',{s:.7}));pl(E,'barile',{s:.7});
      }else if(kind==='altare'){
        pl(I.length?I:E,'altare',{s:.9});rep(2,()=>pl(E,'colonna',{s:.7}));pl(E,'statua',{s:.8});pl(E,'tomba',{s:.8});
      }else if(kind==='allagata'){
        I.forEach(([x,y])=>{if(rnd()<.8)t[ix(x,y)]=1});
        rep(3,()=>pl(E,'teschio',{s:.7}));rep(2,()=>pl(E,'barile',{s:.7}));pl(E,'rovine',{s:.8});pl(E,'pozzo',{s:.7});
      }else if(kind==='forgia'){
        for(let y=y0+2;y<=y1-2;y++)for(let x=x0+2;x<=x1-2;x++)if(set.has(ix(x,y))&&t[ix(x,y)]===9)t[ix(x,y)]=12;
        put('ponte',cx,cy,{s:w/3,v:false,on:[12,9],r:0,f:0,force:true,or:.4});
        rep(2,()=>pl(E,'statua',{s:.8}));rep(2,()=>pl(E,'torcia',{s:.8}));
      }else if(kind==='ghiaccio'){
        rm.forEach(i=>{if(t[i]===9)t[i]=17});rep(3,()=>pl(rall,'cristallo',{s:.9}));pl(E,'statua',{s:.8});rep(2,()=>pl(rall,'teschio',{s:.7}));
      }
      if(nrm<=60&&w>=3&&h>=3)addTxt(String(ri_+1),x0+.9,y0+.8,Math.max(.8,n/50));
    });
    /* porte tra stanze e corridoi */
    cells(v=>v===9||v===14||v===17||v===13||v===1).forEach(i=>{
      const [x,y]=xy(i);
      for(const [dx,dy] of D4){const xx=x+dx,yy=y+dy;if(inb(xx,yy)&&t[ix(xx,yy)]===15)put('porta',x+.5+dx*.5,y+.5+dy*.5,{s:.9,v:false,r:dx?90:0,f:0,fr:.2,or:.35,on:[9,14,15,17,13,1]})}
    });
    const cc=cells(v=>v===15);
    scatter(cc,.04+.03*R,Math.max(2,Math.round(cc.length*.05)),(x,y)=>{const q=rnd();return q<.4?put('teschio',x,y,{s:.8}):q<.7?put('torcia',x,y,{s:.8}):put('barile',x,y,{s:.65})});
    scatter(cc,.02+.02*R,Math.max(1,Math.round(R*5*A)),(x,y)=>put('trappola',x,y,{s:.7,h:1}));
    scatter(cc,.01,Math.max(1,Math.round(R*2)),(x,y)=>put('botola',x,y,{s:.8,h:1}));
    scatter(cc,.01,2,(x,y)=>put('pin',x,y,{s:.7,h:1}));
    return;
  }

  /* =============== CAVERNA =============== */
  if(gt==='caverna'){
    const fl=cells(v=>v===8),bud=Math.max(0,MAXO-objs.length-60);
    const isF=(x,y)=>inb(x,y)&&t[ix(x,y)]===8;
    const opn=fl.filter(i=>{const [x,y]=xy(i);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(!isF(x+dx,y+dy))return false;return true});
    const edg=fl.filter(i=>{const [x,y]=xy(i);return D4.some(([dx,dy])=>!isF(x+dx,y+dy))});
    /* laghi sotterranei (o lava/ghiaccio secondo la palette) */
    const liq=hot?12:cold?17:1;
    for(let q=0;q<Math.max(1,Math.round(R*2*A))&&opn.length;q++){
      const [x,y]=xy(pk(opn)),r=rb(2,3.6);
      disc(x+.5,y+.5,r,liq,v=>v===8);if(liq===1)disc(x+.5,y+.5,r-1.4,0,v=>v===1);
    }
    const opn2=opn.filter(i=>t[i]===8);
    const ptl=(list,k,o)=>{if(!list.length)return null;for(let tr=0;tr<20;tr++){const [x,y]=xy(pk(list)),r=put(k,x+rb(.2,.8),y+rb(.2,.8),o);if(r)return r}return null};
    const rep=(m,fn)=>{for(let i=0;i<m;i++)fn()};
    /* accampamento di esploratori */
    if(opn2.length){
      const [x,y]=xy(pk(opn2)),cx=x+.5,cy=y+.5;
      put('falo',cx,cy,{s:.9});put('tenda',cx-1.7,cy-.4);put('tenda',cx+1.7,cy-.2);put('barile',cx+.6,cy+1.4,{s:.7});put('letto',cx-.4,cy-1.7,{s:.7,r:90});put('torcia',cx+1.2,cy+1.2,{s:.8});put('bandiera',cx+2.4,cy+1.2,{s:.8});
      put('tavolo',cx-1.3,cy+1.4,{s:.7});
    }
    /* sito rituale */
    if(R>.3&&opn2.length){
      const [x,y]=xy(pk(opn2)),cx=x+.5,cy=y+.5;
      if(put('altare',cx,cy,{s:.9})){for(let a=0;a<4;a++){const an=a/4*6.283+.78;put('colonna',cx+Math.cos(an)*2.1,cy+Math.sin(an)*2.1,{s:.75})}
        if(rnd()<.5)put('portale',cx,cy-3,{s:.9});put('stella',cx,cy+3,{s:.8,h:1,force:true,f:0})}
    }
    /* cristalli, stalagmiti, reperti */
    for(let q=0;q<2+Math.round(R*4*A);q++){const b=ptl(edg,'cristallo',{s:1});if(b)rep(ri(1,2),()=>put('cristallo',b.x+rb(-1.1,1.1),b.y+rb(-1.1,1.1),{s:.8}))}
    scatter(edg,.07+.1*R,bud*.35,(x,y)=>put('roccia',x,y,{s:.8,rot:true}));
    scatter(opn,.012+.01*R,bud*.1,(x,y)=>rnd()<.5?put('roccia',x,y,{s:.9,rot:true}):put('colonna',x,y,{s:.8}));
    scatter(edg,.03*R+.01,bud*.08,(x,y)=>put('cespuglio',x,y,{s:.7,rot:true}));
    scatter(opn,.02*R+.005,bud*.06,(x,y)=>put('fiori',x,y,{s:.7}));
    scatter(fl,.015+.015*R,Math.max(2,Math.round(R*10*A)),(x,y)=>put('teschio',x,y,{s:.7}));
    scatter(edg,.01,Math.max(1,Math.round(R*3*A)),(x,y)=>put('statua',x,y,{s:.8}));
    rep(Math.round(R*2*A),()=>{const q=ptl(edg,'rovine',{s:.9});if(q&&rnd()<.6)put('tomba',q.x+rb(-1.5,1.5),q.y+rb(1.4,2.2),{s:.8})});
    scatter(edg,.02,Math.max(2,Math.round(R*4*A)),(x,y)=>{const b=put('baule',x,y,{s:.9});if(b&&rnd()<.4){b.h=1;put('croce',b.x,b.y,{s:.7,h:1,force:true,f:0})}return b});
    scatter(opn,.01,Math.max(1,Math.round(R*4*A)),(x,y)=>put('trappola',x,y,{s:.7,h:1}));
    scatter(fl,.006,Math.max(1,Math.round(R*2*A)),(x,y)=>put('botola',x,y,{s:.8,h:1}));
    scatter(fl,.006,2,(x,y)=>put('pin',x,y,{s:.7,h:1}));
    scatter(edg,.01,Math.max(1,Math.round(R*4*A)),(x,y)=>put('torcia',x,y,{s:.8}));
    scatter(fl,.01,Math.max(1,Math.round(R*2)),(x,y)=>put('barile',x,y,{s:.7}));
    scatter(fl,.005,1,(x,y)=>put('pozzo',x,y,{s:.8}));
    scatter(fl,.005,1,(x,y)=>put('cartello',x,y,{s:.8}));
    /* porte nei passaggi stretti */
    scatter(fl,.15,Math.max(1,Math.round(R*3)),(x,y,cx,cy)=>{
      const vert=isF(cx,cy-1)&&isF(cx,cy+1)&&!isF(cx-1,cy)&&!isF(cx+1,cy),hor=isF(cx-1,cy)&&isF(cx+1,cy)&&!isF(cx,cy-1)&&!isF(cx,cy+1);
      return (vert||hor)&&put('porta',cx+.5,cy+.5,{s:.9,v:false,r:hor?90:0,f:0,on:[8]});
    });
    return;
  }

  /* =============== VILLAGGIO e CITTÀ =============== */
  if(gt==='villaggio'||gt==='citta'){
    const isC=gt==='citta',nz=mkNoise(hashSeed(c.seed+'#pv'));
    const RR=isC?Math.max(6,n*(.17+c.cs/100*.24)):Math.max(3.4,Math.min(n*.33,3+c.houses*.11));
    let cx=n/2+rb(-.04,.04)*n,cy=n/2+rb(-.04,.04)*n;
    const need=Math.max(1.7,RR*(RR>=8?.17:.24))+2.6;
    if(isC&&c.river>12){makeRiver(cx,cy,RR,2+c.river/100*3.2);markWat();[cx,cy]=clearSpot(cx,cy,need,RR)}
    if(!isC&&c.pond>8){
      const a=rnd()*6.283,pr_=1.4+c.pond/100*Math.min(5,n*.1),px=cx+Math.cos(a)*(RR*rb(.7,1.05)+pr_*.4),py=cy+Math.sin(a)*(RR*rb(.7,1.05)+pr_*.4),sdp=rnd()*50;
      blob(px,py,pr_+1.1,2,v=>v===3||v===4||v===5||v===13,sdp);blob(px,py,pr_,1,v=>v!==18,sdp);if(pr_>2.6)blob(px,py,pr_*.5,0,v=>v!==18,sdp);
      markWat();[cx,cy]=clearSpot(cx,cy,need,RR);
    }
    settle(cx,cy,RR,{walls:isC&&c.walls>10,lead:true,dens:isC?.42+c.dens/100*.5:.62,castle:false});
    const treeK=()=>dry?'palma':hot?'morto':cold?'pino':(rnd()<.5?'pino':'quercia');
    const dOut=(x,y)=>Math.hypot(x-cx,y-cy)>RR+2.2;
    const grass=cells(v=>v===3),forest=cells(v=>v===4),T=(isC?c.trees:c.trees)/100;
    /* fattorie con campi, pagliai, spaventapasseri e frutteti */
    const farms=Math.round((isC?3:2)+n/13*(T+.5)*(isC?1:.8));
    for(let q=0;q<farms&&grass.length;q++){
      for(let tr=0;tr<120;tr++){
        const [x,y]=xy(pk(grass)),px=x+.5,py=y+.5;
        if(!dOut(px,py)||px<6||py<6||px>n-6||py>n-6||sd[ix(x,y)]>9)continue;
        if(!okG(px,py,3,3)||!rFree(px,py,3.2,3.2,.3))continue;
        const hb=putB(rnd()<.5?casa():'casa_t',px,py,.9);if(!hb)continue;
        rAdd(px,py,3,3);
        putB('stalla',px+2.5,py+.4,.75,{mg:.05});put('pozzo',px-1.7,py+1.5,{s:.75,v:false,fr:.1});
        for(const sg of [-1,1]){put('recinto',px+sg*.95,py-2.5,{s:.85,v:false,r:0,f:0,force:true,fr:.1});put('recinto',px+sg*.95,py+2.5,{s:.85,v:false,r:0,f:0,force:true,fr:.1})}
        put('recinto',px-3,py,{s:.85,v:false,r:90,f:0,force:true,fr:.1});put('recinto',px+3.4,py,{s:.85,v:false,r:90,f:0,force:true,fr:.1});
        footpath(px,py+1);
        const nf=ri(2,3);
        for(let z=0;z<nf;z++){
          const an=rnd()*6.283,dd=rb(4.6,6.4),fx=px+Math.cos(an)*dd,fy=py+Math.sin(an)*dd,wheat=rnd()<.5;
          blob(fx,fy,rb(2.1,3.4),wheat?21:20,v=>v===3,rnd()*80);
          if(R>.3&&inb(Math.floor(fx),Math.floor(fy))){if(wheat)put('spaventapasseri',fx,fy,{s:.9,v:false,fr:.2});else put('pagliaio',fx,fy,{s:.9});}
        }
        if(R>.4&&rnd()<.55){const ox=px+(rnd()<.5?-1:1)*rb(5,7),oy=py+rb(-3,3);for(let a=0;a<3;a++)for(let b=0;b<2;b++)put('frutteto',ox+a*1.7,oy+b*1.7,{s:.8,v:false,fr:.5})}
        break;
      }
    }
    /* campi isolati lungo le strade e mulini */
    for(let q=0,m=Math.round(n/9*T+1);q<m&&grass.length;q++)for(let tr=0;tr<60;tr++){
      const [x,y]=xy(pk(grass));if(!dOut(x,y)||sd[ix(x,y)]>8||x<3||y<3||x>n-3||y>n-3)continue;
      const r=rb(1.8,3.2);blob(x+.5,y+.5,r,rnd()<.5?21:20,v=>v===3,rnd()*90);break;
    }
    for(let q=0,m=1+(n>=64?1:0);q<m;q++)for(let tr=0;tr<80;tr++){
      const [x,y]=xy(pk(grass));if(!dOut(x,y)||x<4||y<4||x>n-4||y>n-4)continue;
      if(putB('mulino',x+.5,y+.5,.9)){footpath(x+.5,y+1.5);break}
    }
    const endRoad=SM.filter(z=>z.g===3&&(z.x<3||z.y<3||z.x>n-3||z.y>n-3));
    for(let q=0;q<2&&endRoad.length;q++){const z=pk(endRoad);put('cartello',z.x+z.nx*1.8,z.y+z.ny*1.8,{s:.9})}
    /* natura */
    const bud2=Math.max(0,MAXO-objs.length-60);
    scatter(forest,.75,bud2*.5,(x,y)=>dOut(x,y)&&put(treeK(),x,y,{rot:true}));
    scatter(grass,.1+.1*T,bud2*.2,(x,y,gx,gy)=>nz(gx*.3+4,gy*.3+4)>.5&&dOut(x,y)&&put(treeK(),x,y,{rot:true}));
    scatter(grass,.03+.04*T,bud2*.1,(x,y)=>!dOut(x,y)&&put(rnd()<.6?treeK():'cespuglio',x,y,{s:.9,rot:true}));
    scatter(grass,.06+.06*R,bud2*.12,(x,y)=>put(dry?'cactus':'cespuglio',x,y,{rot:true}));
    if(!dry&&!hot&&!cold)scatter(grass,.08+.08*R,bud2*.1,(x,y,gx,gy)=>nz(gx*.4+9,gy*.4+9)>.4&&put('fiori',x,y));
    scatter(grass,.02,bud2*.04,(x,y)=>dOut(x,y)&&put('roccia',x,y,{s:.8,rot:true}));
    if(R>.5){scatter(grass,.01,1,(x,y)=>dOut(x,y)&&put('collina',x,y,{s:.7,fr:1}));scatter(grass,.004,1,(x,y)=>dOut(x,y)&&put('montagna',x,y,{s:.6,fr:1}))}
    scatter(grass,.003,1,(x,y)=>dOut(x,y)&&put('cristallo',x,y,{s:.8}));
    scatter(grass,.003,1,(x,y)=>dOut(x,y)&&put('baule',x,y,{s:.8,h:1}));
    addTxt((isC?'Città di ':'Villaggio di ')+name(),n/2,Math.max(1.3,n/26),Math.max(1,n/26));
  }
}

function mpBlank(n,base){const k={mare:0,erba:3,neve:7,pavimento:9}[base]??3,ter=new Uint8Array(n*n).fill(k);return {n,ter,fog:new Uint8Array(n*n),fogOn:false,objs:[],pal:'classica',grid:false,scale:0,unit:'m',gt:'terra',hs:hashSeed('b'+n+base),pub:true}}
function mpToDoc(mp){
  return JSON.parse(JSON.stringify({v:2,n:mp.n,ter:rleEnc(mp.ter),fog:rleEnc(mp.fog),fogOn:!!mp.fogOn,objs:mp.objs,pal:mp.pal,grid:!!mp.grid,scale:mp.scale||0,unit:mp.unit,gt:mp.gt,hs:mp.hs|0,pub:mp.pub!==false,bg:mp.bg||'',cfg:{type:mp.gt,size:mp.n}}));
}
function mpFromDoc(m){
  if(m&&m.v===2){
    const n=Math.min(192,Math.max(8,parseInt(m.n)||48));
    return {n,ter:rleDec(m.ter,n*n,3),fog:rleDec(m.fog,n*n,0),fogOn:!!m.fogOn,objs:(m.objs||[]).filter(o=>o&&(o.k==='testo'||STM[o.k])).map(o=>({...o,id:o.id||uid8()})),pal:PAL[m.pal]?m.pal:'classica',grid:!!m.grid,scale:+m.scale||0,unit:UNITS.includes(m.unit)?m.unit:'m',gt:m.gt||'terra',hs:m.hs||1,pub:m.pub!==false,bg:typeof m.bg==='string'?m.bg.slice(0,800):''};
  }
  const c=mapNorm((m&&m.cfg)||{}),mp=mpGenerate(c);
  (c.addons||[]).forEach(a=>mp.objs.push({id:uid8(),k:MLEG[a.t]||'quercia',x:a.x+a.s/2,y:a.y+a.s/2,s:a.s,r:0,f:0}));
  return mp;
}

/* ---- disegno completo (terreno in cache + oggetti + nebbia + segnalini) ---- */
function mpDab(n,cx,cy,s,shape,fn){
  const c0=(s-1)/2,x0=cx-Math.floor(c0),y0=cy-Math.floor(c0),r2=c0*c0+c0*.5+.25;
  for(let j=0;j<s;j++)for(let i=0;i<s;i++){const x=x0+i,y=y0+j;if(x<0||y<0||x>=n||y>=n)continue;if(shape==='round'){const dx=i-c0,dy=j-c0;if(dx*dx+dy*dy>r2)continue}fn(x,y)}
}
function mpStep(x0,y0,x1,y1,fn){const dx=x1-x0,dy=y1-y0,st=Math.max(Math.abs(dx),Math.abs(dy))||1;for(let i=0;i<=st;i++)fn(Math.round(x0+dx*i/st),Math.round(y0+dy*i/st))}
function mpDraw(cv,mp,M,ov,marks){
  mpEnsure(mp);ov=ov||{};
  const n=mp.n,Z=mp.tcZ,P=PAL[mp.pal]||PAL.classica;
  if(cv.width!==n*Z){cv.width=n*Z;cv.height=n*Z}
  const c=cv.getContext('2d');c.setLineDash([]);c.globalAlpha=1;c.imageSmoothingEnabled=false;
  c.drawImage(mp.tc,0,0);
  if(mp.grid&&Z>=5){c.fillStyle='rgba(0,0,0,.2)';for(let i=1;i<n;i++){c.fillRect(i*Z,0,1,n*Z);c.fillRect(0,i*Z,n*Z,1)}}
  const cl=v=>Math.min(n-1,Math.max(0,Math.floor(v))),vis=o=>M||(!o.h&&!(mp.fogOn&&mp.fog[cl(o.y)*n+cl(o.x)]));
  mp.objs.filter(vis).sort((a,b)=>((a.k==='testo')-(b.k==='testo'))||a.y-b.y).forEach(o=>drawObj(c,P,o,Z,M&&o.h?.5:1));
  if(mp.fogOn||(M&&ov.fog)){c.fillStyle=M?'rgba(14,4,30,.6)':'#05030a';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(mp.fog[y*n+x])c.fillRect(x*Z,y*Z,Z,Z)}
  if(mp.scale>0)drawScale(c,{size:n,scale:mp.scale,unit:mp.unit},Z);
  (marks||[]).forEach(m=>drawToken(c,m,Z));
  if(!M)return;
  c.save();c.lineWidth=2;c.strokeStyle='#ffffff';c.setLineDash([5,4]);
  const so=ov.sel&&mp.objs.find(o=>o.id===ov.sel);
  if(so){
    const w=so.k==='testo'?Math.max(1,(so.t||'').length*so.s*.6):so.s,h=so.s,hr=ov.hr||.5,hd=rotHandle(so,hr);
    c.save();c.translate(so.x*Z,so.y*Z);c.rotate((so.r||0)*Math.PI/180);c.strokeRect(-w/2*Z,-h/2*Z,w*Z,h*Z);
    c.setLineDash([]);c.beginPath();c.moveTo(0,-h/2*Z);c.lineTo(0,-(h/2+hr*1.9)*Z);c.stroke();c.restore();
    c.beginPath();c.arc(hd.x*Z,hd.y*Z,hr*Z,0,6.2832);c.fillStyle='#ffcb3d';c.fill();c.lineWidth=2;c.strokeStyle='#14121a';c.stroke();
    c.fillStyle='#14121a';c.font='bold '+Math.max(8,Math.round(hr*Z*1.4))+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('↻',hd.x*Z,hd.y*Z+1);c.textAlign='start';
    c.lineWidth=2;c.strokeStyle='#ffffff';c.setLineDash([5,4]);
  }
  c.setLineDash([]);
  const hv=ov.hover;
  if(hv&&hv.obj){c.globalAlpha=.55;drawObj(c,P,hv.obj,Z,.55);c.globalAlpha=1}
  else if(hv&&hv.s){c.fillStyle='rgba(255,255,255,.3)';c.beginPath();mpDab(n,hv.x,hv.y,hv.s,hv.sh,(x,y)=>c.rect(x*Z,y*Z,Z,Z));c.fill()}
  const s=ov.shape;
  if(s){
    const x0=Math.min(s.sx,s.ex),x1=Math.max(s.sx,s.ex),y0=Math.min(s.sy,s.ey),y1=Math.max(s.sy,s.ey);
    c.setLineDash([6,4]);c.strokeStyle='#ffcb3d';
    if(s.m==='rect')c.strokeRect(x0*Z,y0*Z,(x1-x0+1)*Z,(y1-y0+1)*Z);
    else if(s.m==='ellipse'){c.beginPath();c.ellipse((x0+x1+1)/2*Z,(y0+y1+1)/2*Z,(x1-x0+1)/2*Z,(y1-y0+1)/2*Z,0,0,6.2832);c.stroke()}
    else{c.beginPath();c.moveTo((s.sx+.5)*Z,(s.sy+.5)*Z);c.lineTo((s.ex+.5)*Z,(s.ey+.5)*Z);c.stroke()}
  }
  c.restore();
}
function mpFill(mp,x,y,k){
  const n=mp.n,t=mp.ter,src=t[y*n+x];if(src===k)return false;
  const st=[y*n+x];t[y*n+x]=k;
  while(st.length){const i=st.pop(),cx=i%n,cy=(i-cx)/n;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=cx+dx,yy=cy+dy;if(xx<0||yy<0||xx>=n||yy>=n)continue;const j=yy*n+xx;if(t[j]===src){t[j]=k;st.push(j)}}}
  return true;
}
function mpHit(mp,x,y){
  const l=[...mp.objs].sort((a,b)=>((a.k==='testo')-(b.k==='testo'))||a.y-b.y);
  for(let i=l.length-1;i>=0;i--){const o=l[i],w=o.k==='testo'?Math.max(.6,(o.t||'').length*o.s*.3):o.s/2,h=o.k==='testo'?o.s/2:o.s/2;if(Math.abs(x-o.x)<=w&&Math.abs(y-o.y)<=h)return o}
  return null;
}
const normA=a=>((a+180)%360+360)%360-180;
function rotHandle(o,hr){const d=o.s/2+hr*1.9,a=(o.r||0)*Math.PI/180;return {x:o.x+Math.sin(a)*d,y:o.y-Math.cos(a)*d}}
//#MAPCORE-END2

/* ---- stato dell'editor ---- */
const mapMarks=M=>{
  if(!mapSel)return [];
  const out=[],add=(id,p)=>{const q=p.mpos&&p.mpos[mapSel];if(q)out.push({x:q.x,y:q.y,label:String(p.username||'?')[0].toUpperCase(),color:'hsl('+(hashSeed(id)%360)+' 75% 42%)',me:id===uid})};
  if(M)Object.entries(S.players).forEach(([id,p])=>add(id,p));else{const p=me();if(p)add(uid,p)}
  const KC={ostile:'#d02f3a',buono:'#2fa86a',neutrale:'#7d84a6'};
  Object.entries(S.npcs).forEach(([id,n])=>{const q=n.mpos&&n.mpos[mapSel];if(!q)return;if(!M&&!(q.v&&visN(n)))return;out.push({x:q.x,y:q.y,label:String(n.name||'?')[0].toUpperCase(),color:KC[n.att]||KC.neutrale,npc:true,hid:!q.v})});
  return out;
};
let MAPCFG=mapNorm({type:'terra',seed:'nexus',size:48}),mapSel=null,MP=null,PMP=null,mpPKey='';
let mpTool='brush',mpTer=3,mpBr=3,mpBrShape='round',mpKind='pino',mpCat='Natura',mpSize=null,mpScatter=true,mpVar=true,mpAgg=false,mpHid=false,mpTxt='',mpTxtS=1.2,mpRot=0,mpTokN=null,mpTokVis=false;
let mpFogMode='hide',mpTokPl=null,mpSelId=null,mpZoom=1,mpScroll=null,mpFocus=null,mpDirty=false,mpHist=[],mpRedo=[],mpHover=null,mpOpenD={gen:true,set:false};
let mpBusy=false,mpPend=false,mpFull=false,mpFullTools=false;
const _render0=render;
function mpSyncFull(){
  const f=document.getElementById('mpfs'),on=!!(f&&f.classList.contains('mpfull'));
  document.body.classList.toggle('mapfull',on);
  if(!on&&mpFull){mpFull=false;try{if(document.fullscreenElement)document.exitFullscreen()}catch(e){}}
}
render=function(){if(mpBusy){mpPend=true;return}_render0();mpSyncFull()};
function mpFullSet(on){
  mpFull=!!on;mpFullTools=false;mpScroll=null;
  try{
    if(on&&!document.fullscreenElement&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{});
    else if(!on&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  }catch(e){}
  render();
}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&mpFull){mpFull=false;render()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mpFull&&!document.querySelector('.modal'))mpFullSet(false)});
const mpSnapshot=()=>({n:MP.n,ter:MP.ter.slice(),fog:MP.fog.slice(),objs:JSON.parse(JSON.stringify(MP.objs)),fogOn:MP.fogOn,bg:MP.bg||''});
function mpPush(){mpHist.push(mpSnapshot());if(mpHist.length>40)mpHist.shift();mpRedo=[];mpDirty=true}
function mpRestore(s){Object.assign(MP,{n:s.n,ter:s.ter,fog:s.fog,objs:s.objs,fogOn:s.fogOn,bg:s.bg||''});MP.tcDirty=true;if(mpSelId&&!MP.objs.some(o=>o.id===mpSelId))mpSelId=null;mpDirty=true}
function mpUndo(){if(!mpHist.length)return;mpRedo.push(mpSnapshot());mpRestore(mpHist.pop());render()}
function mpRedoA(){if(!mpRedo.length)return;mpHist.push(mpSnapshot());mpRestore(mpRedo.pop());render()}
function mpOpen(id){const m=S.maps[id];if(!m)return;MP=mpFromDoc(m);mapSel=id;mpHist=[];mpRedo=[];mpDirty=false;mpSelId=null;mpScroll=null;render()}
function mpNewBlank(){ask('🆕 Nuova mappa vuota',[{l:'Terreno di base',n:'base',t:'select',o:['erba','mare','neve','pavimento']},{l:'Dimensione (quadretti)',n:'sz',t:'select',o:SIZES.map(x=>sizeLbl(x[0]))}],{base:'erba',sz:sizeLbl(48)}).then(r=>{if(!r)return;MP=mpBlank(parseInt(r.sz)||48,r.base);mapSel=null;mpHist=[];mpRedo=[];mpDirty=true;mpSelId=null;mpScroll=null;render()})}
/* ---- mappa da foto: la foto resta come sfondo, ci si disegna sopra (terreni, oggetti, testi, nebbia, segnalini) ---- */
const mpImgs={};
function mpBgImg(url){
  if(!url)return null;
  let e=mpImgs[url];
  if(!e){
    e=mpImgs[url]={img:new Image(),ok:false,cors:true};
    const done=()=>{e.ok=true;[MP,PMP].forEach(m=>{if(m&&m.bg===url)m.tcDirty=true});render()};
    const im=e.img;im.onload=done;
    im.onerror=()=>{if(!e.cors)return;e.cors=false;const i2=new Image();e.img=i2;i2.onload=done;i2.src=url};
    im.crossOrigin='anonymous';im.src=url;
  }
  return e.ok?e.img:null;
}
async function mpPhotoPrep(file,fit){
  const u=URL.createObjectURL(file);
  try{
    const im=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=u});
    const Z=1024,cv=document.createElement('canvas');cv.width=cv.height=Z;const c=cv.getContext('2d');
    c.fillStyle='#0b0912';c.fillRect(0,0,Z,Z);c.imageSmoothingQuality='high';
    const w=im.naturalWidth,h=im.naturalHeight,k=fit==='riempi'?Math.max(Z/w,Z/h):Math.min(Z/w,Z/h),dw=w*k,dh=h*k;
    c.drawImage(im,(Z-dw)/2,(Z-dh)/2,dw,dh);
    let blob=null;
    for(const q of [.88,.75,.6]){blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',q));if(blob&&blob.size<1.9e6)break}
    return new File([blob],'mappa.jpg',{type:'image/jpeg'});
  }finally{URL.revokeObjectURL(u)}
}
async function mpPhotoMap(){
  if(!assets)return toast('Upload non disponibile');
  const r=await ask('📷 Mappa da foto',[{l:'Foto (JPG, PNG o WebP)',n:'photo',t:'file'},{l:'Adattamento al quadrato',n:'fit',t:'select',o:['intera (bordi scuri)','riempi (ritaglia)']},{l:'Dimensione (quadretti)',n:'sz',t:'select',o:SIZES.map(x=>sizeLbl(x[0]))}],{fit:'intera (bordi scuri)',sz:sizeLbl(48)});
  if(!r)return;if(!r.photo)return toast('Scegli prima una foto');
  toast('Carico la foto…');
  let f;try{f=await mpPhotoPrep(r.photo,r.fit.startsWith('riempi')?'riempi':'intera')}catch(e){return toast('Foto non leggibile')}
  const url=await uploadPhoto(f);if(!url)return;
  const n=parseInt(r.sz)||48;
  MP={n,ter:new Uint8Array(n*n).fill(255),fog:new Uint8Array(n*n),fogOn:false,objs:[],pal:'classica',grid:false,scale:0,unit:'m',gt:'terra',hs:hashSeed('p'+Date.now()),pub:true,bg:url};
  mapSel=null;mpHist=[];mpRedo=[];mpDirty=true;mpSelId=null;mpScroll=null;render();
  toast('Foto caricata: ora modificala e salvala');
}
function mpGenAct(){
  if(MP.objs.length&&!confirm('Il generatore sostituisce terreno e oggetti della mappa aperta (puoi annullare con ↶). Continuare?'))return;
  mpPush();const g=mpGenerate({...mapNorm(MAPCFG),pal:MP.pal,grid:MP.grid,scale:MP.scale,unit:MP.unit});
  Object.assign(MP,{n:g.n,ter:g.ter,fog:g.fog,fogOn:false,objs:g.objs,gt:g.gt,hs:g.hs,bg:''});MP.tcDirty=true;mpSelId=null;render();
}
async function mpSave(asNew){
  let id=mapSel,name=(S.maps[id]&&S.maps[id].name)||'';
  if(asNew||!id){const r=await ask('Salva mappa',[{l:'Nome della mappa',n:'name'}],{name});if(!r||!r.name)return;name=r.name.slice(0,60);id=uid8()}
  const prevM=S.maps[id],shown=MP.pub!==false?((prevM&&prevM.pub!==false)?(prevM.shown||0):Date.now()):((prevM&&prevM.shown)||0); /* shown = quando è diventata visibile: serve a far scattare la notifica ai player */
  const ok=await guard(db.collection('maps').doc(id).set({id,name,ts:Date.now(),shown,...mpToDoc(MP)}).then(()=>1));
  if(!ok)return;mapSel=id;mpDirty=false;toast('Mappa salvata'+(MP.pub?': i player la vedono nella bacheca Mappa':' (nascosta ai player)'));render();
}
function mpResize(nn){
  if(nn===MP.n)return;mpPush();
  const o=MP.n,ter=new Uint8Array(nn*nn).fill(MP.bg?255:3),fog=new Uint8Array(nn*nn),m=Math.min(o,nn);
  for(let y=0;y<m;y++)for(let x=0;x<m;x++){ter[y*nn+x]=MP.ter[y*o+x];fog[y*nn+x]=MP.fog[y*o+x]}
  MP.objs=MP.objs.filter(b=>b.x<nn&&b.y<nn);Object.assign(MP,{n:nn,ter,fog});MP.tcDirty=true;render();
}
function mpPlace(mp,x,y){
  if(mp.objs.length>=1500){toast('Limite di 1500 oggetti');return null}
  const st=STM[mpKind],base=mpSize??st[3],n=mp.n,px=mpAgg?Math.floor(x)+.5:x,py=mpAgg?Math.floor(y)+.5:y;
  const o={id:uid8(),k:mpKind,x:+Math.min(n,Math.max(0,px)).toFixed(2),y:+Math.min(n,Math.max(0,py)).toFixed(2),s:+(base*(mpVar?0.85+Math.random()*0.3:1)).toFixed(2),r:normA(Math.round(mpRot+(mpVar&&st[2]!=='Edifici'?(Math.random()-.5)*16:0))),f:mpVar&&Math.random()<.5?1:0};
  if(mpHid)o.h=1;mp.objs.push(o);SND.play('place');return o;
}
const mpStat=()=>mpDirty?'● Modifiche non salvate':(mapSel?'✔ Salvata':'Mappa non salvata');
const MTOOLS=[['pan','✋','Muovi'],['brush','🖌️','Pennello'],['fill','🪣','Riempi'],['line','📏','Linea'],['rect','▭','Rettangolo'],['ellipse','⬭','Ellisse'],['stamp','🌲','Oggetti'],['sel','🔎','Seleziona'],['text','🔤','Testo'],['erase','🧽','Gomma'],['fog','🌫️','Nebbia'],['token','🧍','Segnalini']];
const zoomBar=()=>`<div class="row zbar" style="gap:6px;margin-bottom:8px;flex:none"><button class="g mini" id="mpzo">−</button><span class="pill">🔍 ${Math.round(mpZoom*100)}%</span><button class="g mini" id="mpzi">+</button><span class="grow"></span>${mpFull&&masterOK&&view.name==='master'?`<button class="g mini" id="mpfst">🛠 ${mpFullTools?'Nascondi':'Strumenti'}</button>`:''}<button class="g mini" id="mpfsb">${mpFull?'✕ Esci':'⛶ Schermo intero'}</button></div>`;
const mpCvW=()=>mpFull?`calc(${mpZoom} * min(100cqw,100cqh))`:(mpZoom*100)+'%';
const mapList=(M,saved)=>{const l=M?saved:saved.filter(m=>m.pub!==false);return `<div class="card"><h3>${M?'Mappe salvate':'Mappe del Master'}</h3>${l.map(m=>`<div class="move"${m.id===mapSel?' style="border-left-color:var(--ok)"':''}><div class="grow"><b>${esc(m.name)}</b>${m.pub===false?' <span class="tag">nascosta</span>':''}<div class="mut">${esc(m.bg?'📷 Foto':(MAP_TYPES.find(t=>t[0]===(m.gt||(m.cfg&&m.cfg.type)))||[0,'🗺️ Mappa'])[1])} · ${m.n||(m.cfg&&m.cfg.size)||'?'}×${m.n||(m.cfg&&m.cfg.size)||'?'}</div></div><button class="mini" data-mo="${m.id}">${m.id===mapSel?'Aperta':'Apri'}</button>${M?`<button class="${m.pub===false?'':'g '}mini" data-mvis="${m.id}">${m.pub===false?'👁 Mostra':'🙈 Nascondi'}</button><button class="d mini" data-mdel="${m.id}">🗑</button>`:''}</div>`).join('')||'<p class="mut">Nessuna mappa salvata.</p>'}</div>`};
const terPal=()=>{const cl=terCols(PAL[MP.pal]||PAL.classica);return MGROUPS.map(g=>`<div class="mut" style="margin-top:8px">${g}</div><div class="chips">${TER.filter(t=>t[2]===g).map(t=>`<button class="chipb ${mpTer===t[0]?'sel':''}" data-ter="${t[0]}"><i class="sw" style="background:${cl[t[0]]}"></i>${t[1]}</button>`).join('')}</div>`).join('')+(MP.bg?`<div class="mut" style="margin-top:8px">Foto</div><div class="chips"><button class="chipb ${mpTer===255?'sel':''}" data-ter="255"><i class="sw" style="background:linear-gradient(135deg,#e8c36a,#4a7fb8)"></i>📷 Ripristina foto</button></div>`:'')};
const slider=(id,l,v,a,b,st)=>`<div style="margin-top:8px"><div class="row sp"><span>${l}</span><b id="${id}v">${v}</b></div><input type="range" id="${id}" min="${a}" max="${b}" step="${st||1}" value="${v}"></div>`;
const chk=(id,l,v)=>`<label class="row" style="gap:6px;margin-top:6px"><input type="checkbox" id="${id}" ${v?'checked':''}> ${l}</label>`;
function mpOptions(){
  const T=mpTool;
  if(['brush','line'].includes(T))return `<div class="card"><h3>${T==='brush'?'Pennello terreno':'Linea'}</h3>${terPal()}${slider('mpbr','Dimensione',mpBr,1,20)}<label class="mut">Forma pennello</label><select id="mpbs"><option value="round" ${mpBrShape==='round'?'selected':''}>Tonda</option><option value="square" ${mpBrShape==='square'?'selected':''}>Quadrata</option></select>${T==='line'?'<p class="mut">Trascina da un punto all\'altro: ottima per strade e fiumi.</p>':''}</div>`;
  if(['fill','rect','ellipse'].includes(T))return `<div class="card"><h3>${T==='fill'?'Riempi':T==='rect'?'Rettangolo':'Ellisse'}</h3>${terPal()}<p class="mut">${T==='fill'?'Tocca un\'area: tutto il terreno uguale collegato diventa quello scelto.':'Trascina per disegnare la forma piena.'}</p></div>`;
  if(T==='stamp'){
    const cat=STAMPS.filter(s=>s[2]===mpCat),defS=STM[mpKind][3];
    return `<div class="card"><h3>Oggetti</h3><div class="chips">${MCATS.map(c=>`<button class="chipb ${mpCat===c?'sel':''}" data-cat="${c}">${c}</button>`).join('')}</div><div class="stgrid">${cat.map(s=>`<button class="stb ${mpKind===s[0]?'sel':''}" data-st="${s[0]}"><img src="${stThumb(s[0],MP.pal)}" alt=""><span>${esc(s[1])}</span></button>`).join('')}</div>${slider('mpsz','Grandezza (quadretti)',mpSize??defS,.3,10,.1)}${slider('mprot','Rotazione degli oggetti che piazzi (°)',mpRot,-180,180,5)}<div class="chips" style="margin-top:6px">${[[-90,'⟲ 90°'],[-45,'⟲ 45°'],[0,'Azzera'],[45,'⟳ 45°'],[90,'⟳ 90°']].map(([a,l])=>`<button class="chipb mini" data-rn="${a}">${l}</button>`).join('')}</div>${chk('mpsc','Spargi trascinando (foreste, folle…)',mpScatter)}${chk('mpvar','Variazione casuale (dimensione, specchio, inclinazione)',mpVar)}${chk('mpagg','Aggancia al centro dei quadretti',mpAgg)}${chk('mphid','Nascosto ai player (trappole, segreti)',mpHid)}<p class="mut">Tocca la mappa per piazzare. Per spostare/ruotare/ridimensionare usa 🔎 Seleziona.</p></div>`;
  }
  if(T==='sel'){
    const o=MP.objs.find(x=>x.id===mpSelId);
    if(!o)return `<div class="card"><h3>Seleziona</h3><p class="mut">Tocca un oggetto sulla mappa per selezionarlo, poi trascinalo per spostarlo. Per ruotarlo trascina il pallino giallo ↻ che compare sopra di lui.</p></div>`;
    return `<div class="card"><h3>${o.k==='testo'?'Testo':esc(STM[o.k][1])}</h3>${slider('szo','Grandezza',o.s,.3,12,.1)}${slider('rot','Rotazione (°)',o.r||0,-180,180,1)}<div class="chips" style="margin-top:6px">${[[-90,'⟲ 90°'],[-15,'⟲ 15°'],[15,'⟳ 15°'],[90,'⟳ 90°'],[0,'Azzera']].map(([a,l])=>`<button class="chipb mini" data-ro="${a}">${l}</button>`).join('')}</div><div class="row" style="flex-wrap:wrap;gap:8px;margin-top:10px">${o.k==='testo'?'<button class="g" id="stxt">✎ Testo</button>':'<button class="g" id="sflip">↔ Specchia</button>'}<button class="g" id="sdup">⧉ Duplica</button><button class="g" id="shid">${o.h?'👁 Mostra ai player':'🙈 Nascondi ai player'}</button><button class="d" id="sdel">🗑 Elimina</button></div><p class="mut">Trascina il pallino giallo ↻ sulla mappa per ruotare a mano (Maiusc = a scatti di 15°).</p></div>`;
  }
  if(T==='text')return `<div class="card"><h3>Testo</h3><label class="mut">Scritta (nomi di regni, città, luoghi)</label><input id="mptxt" value="${esc(mpTxt)}" maxlength="40">${slider('mpts','Grandezza',mpTxtS,.5,6,.1)}<p class="mut">Tocca la mappa per piazzare la scritta; poi 🔎 per spostarla.</p></div>`;
  if(T==='erase')return `<div class="card"><h3>Gomma oggetti</h3><p class="mut">Tocca o trascina sugli oggetti per cancellarli (il terreno non viene toccato).</p></div>`;
  if(T==='fog')return `<div class="card"><h3>Nebbia di guerra</h3><div class="chips"><button class="chipb ${mpFogMode==='hide'?'sel':''}" data-fm="hide">🌫️ Nascondi</button><button class="chipb ${mpFogMode==='show'?'sel':''}" data-fm="show">☀️ Rivela</button></div>${slider('mpbr','Dimensione',mpBr,1,20)}<div class="row" style="flex-wrap:wrap;gap:8px;margin-top:10px"><button class="g" id="mpfall">Nascondi tutto</button><button class="g" id="mpfnone">Rivela tutto</button></div>${chk('mpfon','Nebbia attiva per i player',MP.fogOn)}<p class="mut">Con la nebbia attiva i player vedono nero dove hai nascosto (oggetti compresi). Salva per aggiornare la loro vista.</p></div>`;
  if(T==='token'){
    const pl=Object.entries(S.players),np=Object.entries(S.npcs);
    return `<div class="card"><h3>Segnalini</h3>${mapSel?'':'<p class="mut">Salva prima la mappa per usare i segnalini.</p>'}<div class="mut">Player (cerchio)</div><div class="chips">${pl.map(([i,p])=>`<button class="chipb ${mpTokPl===i?'sel':''}" data-tp="${i}">${esc(p.username)}</button>`).join('')||'<p class="mut">Nessun player.</p>'}</div><div class="mut" style="margin-top:12px">Incontro (rombo: rosso ostile, verde buono, grigio neutrale)</div><div class="chips">${np.map(([i,n])=>`<button class="chipb ${mpTokN===i?'sel':''}" data-tn="${i}">◆ ${esc(n.name)}</button>`).join('')||'<p class="mut">Nessun incontro.</p>'}</div>${chk('mptv','Mostra il segnalino dell\'incontro ai player (spento = lo vedi solo tu, con il bordo tratteggiato)',mpTokVis)}<div class="row" style="margin-top:10px;gap:8px"><button class="g" id="mptokclr">Rimuovi segnalino selezionato</button></div><p class="mut">Scegli un player o un incontro e tocca la mappa per posizionarlo (toccando di nuovo lo sposti). I player possono anche muoversi da soli.</p></div>`;
  }
  return `<div class="card"><h3>Muovi</h3><p class="mut">Con questo strumento scorri/trascini la mappa (utile con lo zoom, soprattutto da telefono). Gli altri strumenti disegnano.</p></div>`;
}
const mapBoard=M=>{
  if(mapSel&&!S.maps[mapSel])mapSel=null;
  const saved=Object.values(S.maps||{}).sort((a,b)=>b.ts-a.ts),list=mapList(M,saved);
  if(!M){
    const m=S.maps[mapSel],p=me();
    if(!m||m.pub===false)return hdr('🗺️ Mappa',1)+list;
    const key=mapSel+'|'+m.ts;if(mpPKey!==key||!PMP){PMP=mpFromDoc(m);mpPKey=key}
    const mine=p&&p.mpos&&p.mpos[mapSel];
    return hdr('🗺️ '+esc(m.name),1)+`<div id="mpfs" class="${mpFull?'mpfull'+(mpFullTools?' tools':''):''}"><div class="card cvcard">${zoomBar()}<div class="mapwrap" id="mapwrap"><canvas id="mapcv" class="mapcv" style="width:${mpCvW()};cursor:crosshair"></canvas></div><p class="mut" style="margin:8px 0">Tocca la mappa per segnare dove si trova il tuo personaggio.</p><div class="row" style="flex-wrap:wrap;gap:8px">${mine?'<button class="g" id="mapunpin">Rimuovi il mio segnalino</button>':''}<button class="g" id="mapclose">‹ Altre mappe</button></div></div></div>`+list;
  }
  if(!MP)MP=mpGenerate({...mapNorm(MAPCFG),pal:'classica'});
  const c=mapNorm(MAPCFG),sl=MAP_SL[c.type]||[],cur=mapSel&&S.maps[mapSel],
  landUI=(c.type==='terra'||c.type==='isola')?`<label class="mut" style="margin-top:10px">Forma della terra</label><div class="chips">${LANDS.map(([k,l])=>`<button class="chipb ${c.land===k?'sel':''}" data-ld="${k}">${l}</button>`).join('')}</div><p class="mut" style="margin:6px 0 0">${esc((LANDS.find(l=>l[0]===c.land)||LANDS[0])[2])}. Regola poi la quantità di acqua qui sotto.</p>`:'';
  return hdr('🗺️ '+(cur?esc(cur.name):'Editor mappe'),1)+
  `<div id="mpfs" class="${mpFull?'mpfull'+(mpFullTools?' tools':''):''}"><div class="card toolcard"><div class="chips">${MTOOLS.map(([k,i,l])=>`<button class="chipb ${mpTool===k?'sel':''}" data-mtl="${k}">${i} ${l}</button>`).join('')}</div><div class="row" style="flex-wrap:wrap;gap:6px;margin-top:10px"><button class="g mini" id="mpu" ${mpHist.length?'':'disabled'}>↶ Annulla</button><button class="g mini" id="mpr" ${mpRedo.length?'':'disabled'}>↷ Ripeti</button><button class="mini" id="mpquick">🎲 Mappa casuale</button><span class="grow"></span><span class="mut" id="mpstat">${mpStat()}</span></div></div>`+
  `<div class="card cvcard">${zoomBar()}<div class="mapwrap" id="mapwrap"><canvas id="mapcv" class="mapcv" style="width:${mpCvW()};touch-action:${mpTool==='pan'?'auto':'none'};cursor:${mpTool==='pan'?'grab':'crosshair'}"></canvas></div></div>`+
  '<div class="mpopts">'+mpOptions()+'</div></div>'+
  `<details class="card" id="dset" ${mpOpenD.set?'open':''}><summary>⚙️ Impostazioni mappa</summary><label class="mut">Palette</label><select id="mppal">${Object.keys(PAL).map(k=>`<option value="${k}" ${MP.pal===k?'selected':''}>${k[0].toUpperCase()+k.slice(1)}</option>`).join('')}</select><label class="mut">Dimensione (quadretti)</label><select id="mpsize">${sizeOpts(MP.n)}</select><div class="row"><div class="grow"><label class="mut">Scala: 1 quadretto = (0 = nascosta)</label><input id="mpscale" type="number" min="0" step="any" value="${MP.scale}" style="margin:0"></div><div><label class="mut">Unità</label><select id="mpunit" style="margin:0">${UNITS.map(u=>`<option ${MP.unit===u?'selected':''}>${u}</option>`).join('')}</select></div></div>${chk('mpgrid','Griglia',MP.grid)}${chk('mppub','Visibile ai player',MP.pub!==false)}</details>`+
  `<details class="card" id="dgen" ${mpOpenD.gen?'open':''}><summary>🎲 Generatore casuale</summary><p class="mut">Crea una base da cui partire: poi ritoccala con pennello e oggetti.</p><div class="chips">${MAP_TYPES.filter(t=>t[0]!=='isola').map(([k,l])=>`<button class="chipb ${(c.type===k||(k==='terra'&&c.type==='isola'))?'sel':''}" data-mt="${k}">${l}</button>`).join('')}</div><label class="mut" style="margin-top:8px">Seme (stesso seme = stessa mappa)</label><div class="row"><input id="mapseed" value="${esc(c.seed)}" style="margin:0"><button class="g" id="mapdice" title="Seme casuale">🎲</button></div>${landUI}<div class="row" style="margin-top:10px"><div class="grow"><label class="mut">Dimensione</label><select id="mapgsize">${sizeOpts(c.size)}</select></div><div class="grow"><label class="mut">Forma del riquadro</label><select id="mapgshape">${SHAPES.map(([k,l])=>`<option value="${k}" ${c.shape===k?'selected':''}>${l}</option>`).join('')}</select></div></div>${sl.map(([k,l,a,b])=>`<div style="margin-top:6px"><div class="row sp"><span>${l}</span><b id="mv-${k}">${c[k]}</b></div><input type="range" data-mk="${k}" min="${a}" max="${b}" value="${c[k]}"></div>`).join('')}<div class="row" style="margin-top:12px;flex-wrap:wrap;gap:8px"><button id="mapgen">⚡ Genera</button><button class="g" id="mapnew">🎲 Nuova casuale</button></div></details>`+
  `<div class="card"><h3>Salvataggio</h3><div class="row" style="flex-wrap:wrap;gap:8px"><button id="mapsave">💾 ${cur?'Aggiorna «'+esc(cur.name)+'»':'Salva'}</button>${cur?'<button class="g" id="mapsaveas">💾 Salva come nuova</button>':''}<button class="g" id="mapblank">🆕 Nuova vuota</button><button class="g" id="mapdl">⬇ PNG</button><button class="g" id="mapcopy">📋 Codice</button><button class="g" id="mapload">📥 Carica</button><button class="g" id="mapphoto">📷 Da foto</button>${MP.bg?'<button class="g" id="mapphotorm">🗑 Togli foto</button>':''}</div></div>`+list;
};
function mapInit(){
  const M=masterOK&&view.name==='master',q=id=>document.getElementById(id);
  /* lista mappe: sempre collegata (prima, senza canvas, la funzione usciva e i player non potevano aprire nulla) */
  document.querySelectorAll('[data-mo]').forEach(b=>b.onclick=()=>{if(M){if(mpDirty&&b.dataset.mo!==mapSel&&!confirm('Hai modifiche non salvate: aprire un\'altra mappa le perde. Continuare?'))return;mpOpen(b.dataset.mo)}else{mapSel=b.dataset.mo;mpScroll=null;render()}});
  /* nascondi / mostra una mappa ai player (quando la mostri, ai player arriva la notifica) */
  document.querySelectorAll('[data-mvis]').forEach(b=>b.onclick=()=>{const id=b.dataset.mvis,m=S.maps[id];if(!m)return;const show=m.pub===false;if(MP&&mapSel===id)MP.pub=show;guard(db.collection('maps').doc(id).update(show?{pub:true,shown:Date.now()}:{pub:false}));toast(show?'🗺️ Mappa mostrata ai player':'🙈 Mappa nascosta ai player')});
  const cv=document.getElementById('mapcv');if(!cv)return;
  const w=q('mapwrap'),mp=M?MP:PMP;
  if(!mp)return;
  /* zoom + scroll */
  const zs=[1,1.5,2,3,4,6];
  const zoomBy=d=>{const i=Math.max(0,Math.min(zs.length-1,zs.indexOf(mpZoom)+d));if(zs[i]===mpZoom)return;mpFocus={fx:(w.scrollLeft+w.clientWidth/2)/w.scrollWidth,fy:(w.scrollTop+w.clientHeight/2)/w.scrollHeight};mpZoom=zs[i];render()};
  if(q('mpzo'))q('mpzo').onclick=()=>zoomBy(-1);if(q('mpzi'))q('mpzi').onclick=()=>zoomBy(1);
  if(q('mpfsb'))q('mpfsb').onclick=()=>mpFullSet(!mpFull);
  if(q('mpfst'))q('mpfst').onclick=()=>{mpFullTools=!mpFullTools;mpScroll=null;render()};
  if(!zs.includes(mpZoom))mpZoom=1;
  mpEnsure(mp);
  if(mpFocus){w.scrollLeft=mpFocus.fx*w.scrollWidth-w.clientWidth/2;w.scrollTop=mpFocus.fy*w.scrollHeight-w.clientHeight/2;mpFocus=null;mpScroll={l:w.scrollLeft,t:w.scrollTop}}
  else if(mpScroll){w.scrollLeft=mpScroll.l;w.scrollTop=mpScroll.t}
  w.onscroll=()=>{mpScroll={l:w.scrollLeft,t:w.scrollTop}};
  const pt=e=>{const r=cv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*mp.n,y=(e.clientY-r.top)/r.height*mp.n,t=v=>Math.min(mp.n-1,Math.max(0,Math.floor(v)));return {x,y,tx:t(x),ty:t(y)}};
  if(!M){
    mpDraw(cv,mp,false,null,mapMarks(false));
    cv.onclick=e=>{const p=pt(e);if(mp.ter[p.ty*mp.n+p.tx]===18)return toast('Fuori dalla mappa');const me_=me();if(me_){SND.play('pin',1);guard(db.collection('players').doc(uid).update({mpos:{...(me_.mpos||{}),[mapSel]:{x:p.tx,y:p.ty}}}))}};
    const up=q('mapunpin');if(up)up.onclick=()=>{const p=me(),o={...((p&&p.mpos)||{})};delete o[mapSel];guard(db.collection('players').doc(uid).update({mpos:o}))};
    const cl=q('mapclose');if(cl)cl.onclick=()=>{mapSel=null;mpScroll=null;render()};
    return;
  }
  /* ===== Master ===== */
  let drag=null,raf=0;
  const ov=()=>{
    const hv=mpHover,o={sel:mpSelId,fog:mpTool==='fog',hr:Math.max(.3,13/(cv.getBoundingClientRect().width/mp.n))};
    if(hv&&!drag){
      if(['brush','line','fog'].includes(mpTool))o.hover={x:hv.tx,y:hv.ty,s:mpBr,sh:mpBrShape};
      else if(mpTool==='stamp')o.hover={obj:{k:mpKind,x:mpAgg?hv.tx+.5:hv.x,y:mpAgg?hv.ty+.5:hv.y,s:mpSize??STM[mpKind][3],r:mpRot,f:0}};
    }
    if(drag&&['line','rect','ellipse'].includes(drag.m))o.shape=drag;
    return o;
  };
  const redraw=()=>mpDraw(cv,mp,true,ov(),mapMarks(true));
  const rd=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;redraw()})};
  const stat=()=>{const s=q('mpstat');if(s)s.textContent=mpStat()};
  redraw();
  const paint=(x,y,sz)=>{
    let a=1e9,b=1e9,c2=-1,d2=-1;
    mpDab(mp.n,x,y,sz||mpBr,mpBrShape,(i,j)=>{const k=j*mp.n+i;if(mpTool==='fog')mp.fog[k]=mpFogMode==='hide'?1:0;else mp.ter[k]=mpTer;if(i<a)a=i;if(i>c2)c2=i;if(j<b)b=j;if(j>d2)d2=j});
    if(mpTool!=='fog'&&c2>=0)mpTiles(mp,a,b,c2,d2);
  };
  const eraseAt=p=>{const o=mpHit(mp,p.x,p.y);if(o){mp.objs=mp.objs.filter(x=>x.id!==o.id);if(mpSelId===o.id)mpSelId=null}};
  cv.onpointerdown=e=>{
    if(e.button>0)return;
    const p=pt(e),T=mpTool;
    if(T==='pan'){if(e.pointerType==='mouse'){drag={m:'pan',x:e.clientX,y:e.clientY,l:w.scrollLeft,t:w.scrollTop};cv.setPointerCapture(e.pointerId);cv.style.cursor='grabbing'}return}
    e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(x){}
    mpBusy=true;if(T!=='sel'&&T!=='stamp')SND.play(T==='erase'?'erase':T==='text'?'place':T==='token'?'pin':'paint');
    if(T==='brush'||T==='fog'){mpPush();drag={m:'b',lx:p.tx,ly:p.ty};paint(p.tx,p.ty)}
    else if(T==='fill'){mpPush();if(mpFill(mp,p.tx,p.ty,mpTer)){mp.tcDirty=true}drag={m:'x'}}
    else if(['line','rect','ellipse'].includes(T))drag={m:T,sx:p.tx,sy:p.ty,ex:p.tx,ey:p.ty};
    else if(T==='stamp'){mpPush();const o=mpPlace(mp,p.x,p.y);drag={m:'st',lx:p.x,ly:p.y,n:o?1:0}}
    else if(T==='text'){if(!mpTxt.trim()){toast('Scrivi prima il testo');drag={m:'x'}}else{mpPush();mp.objs.push({id:uid8(),k:'testo',x:+p.x.toFixed(2),y:+p.y.toFixed(2),s:mpTxtS,r:0,f:0,t:mpTxt.trim().slice(0,40)});drag={m:'x'}}}
    else if(T==='sel'){
      const cur=so(),hr=Math.max(.3,13/(cv.getBoundingClientRect().width/mp.n)),hd=cur&&rotHandle(cur,hr);
      if(cur&&Math.hypot(p.x-hd.x,p.y-hd.y)<=hr*1.4)drag={m:'rot',id:cur.id,pushed:false,ch:false};
      else{const o=mpHit(mp,p.x,p.y),old=mpSelId;mpSelId=o?o.id:null;drag=o?{m:'mv',id:o.id,dx:p.x-o.x,dy:p.y-o.y,pushed:false,ch:old!==o.id}:{m:'x',ch:old!==null}}
    }
    else if(T==='erase'){mpPush();drag={m:'er'};eraseAt(p)}
    else if(T==='token'){
      drag={m:'x'};
      if(!mapSel)toast('Salva prima la mappa');else if(!mpTokPl&&!mpTokN)toast('Scegli un player o un incontro');else if(mp.ter[p.ty*mp.n+p.tx]===18)toast('Fuori dalla mappa');
      else if(mpTokN){const nn=S.npcs[mpTokN];guard(db.collection('npcs').doc(mpTokN).update({mpos:{...((nn&&nn.mpos)||{}),[mapSel]:{x:p.tx,y:p.ty,v:mpTokVis?1:0}}}))}
      else{const pl=S.players[mpTokPl];guard(db.collection('players').doc(mpTokPl).update({mpos:{...((pl&&pl.mpos)||{}),[mapSel]:{x:p.tx,y:p.ty}}}))}
    }
    stat();rd();
  };
  cv.onpointermove=e=>{
    const p=pt(e);mpHover=p;
    if(!drag){if(['brush','line','fog','stamp'].includes(mpTool))rd();return}
    if(drag.m==='pan'){w.scrollLeft=drag.l-(e.clientX-drag.x);w.scrollTop=drag.t-(e.clientY-drag.y);return}
    if(drag.m==='b'){mpStep(drag.lx,drag.ly,p.tx,p.ty,(x,y)=>paint(x,y));drag.lx=p.tx;drag.ly=p.ty}
    else if(['line','rect','ellipse'].includes(drag.m)){drag.ex=p.tx;drag.ey=p.ty}
    else if(drag.m==='st'&&mpScatter){const sp=Math.max(.35,(mpSize??STM[mpKind][3])*.7);if(Math.hypot(p.x-drag.lx,p.y-drag.ly)>=sp){if(mpPlace(mp,p.x,p.y)){drag.lx=p.x;drag.ly=p.y}}}
    else if(drag.m==='mv'){const o=mp.objs.find(x=>x.id===drag.id);if(o){if(!drag.pushed){mpPush();drag.pushed=true;stat()}const nx=p.x-drag.dx,ny=p.y-drag.dy;o.x=+Math.min(mp.n,Math.max(0,mpAgg?Math.floor(nx)+.5:nx)).toFixed(2);o.y=+Math.min(mp.n,Math.max(0,mpAgg?Math.floor(ny)+.5:ny)).toFixed(2)}}
    else if(drag.m==='rot'){const o=mp.objs.find(x=>x.id===drag.id);if(o){if(!drag.pushed){mpPush();drag.pushed=true;stat()}const st=e.shiftKey?15:5;let a=Math.atan2(p.x-o.x,-(p.y-o.y))*180/Math.PI;a=Math.round(a/st)*st;o.r=normA(a);const rr=q('rot');if(rr){rr.value=o.r;const l=q('rotv');if(l)l.textContent=o.r}}}
    else if(drag.m==='er')eraseAt(p);
    rd();
  };
  const end=()=>{
    if(!drag){return}
    const d=drag;drag=null;let rerender=false;
    if(d.m==='pan'){cv.style.cursor='grab';return}
    if(['line','rect','ellipse'].includes(d.m)){
      mpPush();const x0=Math.min(d.sx,d.ex),x1=Math.max(d.sx,d.ex),y0=Math.min(d.sy,d.ey),y1=Math.max(d.sy,d.ey);
      if(d.m==='rect'){for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)mp.ter[y*mp.n+x]=mpTer}
      else if(d.m==='ellipse'){const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=(x1-x0+1)/2,ry=(y1-y0+1)/2;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const a=(x-cx)/rx,b=(y-cy)/ry;if(a*a+b*b<=1)mp.ter[y*mp.n+x]=mpTer}}
      else mpStep(d.sx,d.sy,d.ex,d.ey,(x,y)=>mpDab(mp.n,x,y,mpBr,mpBrShape,(i,j)=>{mp.ter[j*mp.n+i]=mpTer}));
      mp.tcDirty=true;
    }
    if(d.m==='mv'||d.m==='x'){if(d.ch)rerender=true}
    if(d.m==='er')rerender=false;
    mpBusy=false;mpPend=false;stat();redraw();
    if(rerender||((d.m==='mv'||d.m==='rot')&&d.pushed)){render()}
    else if(d.m==='b'||d.m==='fill'||d.m==='st'||d.m==='er'||d.m==='text'||['line','rect','ellipse'].includes(d.m)){render()}
  };
  cv.onpointerup=end;cv.onpointercancel=end;
  cv.onpointerleave=()=>{mpHover=null;if(!drag)rd()};
  /* undo/redo, strumenti */
  if(q('mpu'))q('mpu').onclick=mpUndo;if(q('mpr'))q('mpr').onclick=mpRedoA;
  document.querySelectorAll('[data-mtl]').forEach(b=>b.onclick=()=>{mpTool=b.dataset.mtl;render()});
  document.querySelectorAll('[data-ter]').forEach(b=>b.onclick=()=>{mpTer=+b.dataset.ter;render()});
  const bindR=(id,fn,vid)=>{const i=q(id);if(i)i.oninput=()=>{fn(+i.value);const l=q((vid||id)+'v');if(l)l.textContent=i.value}};
  bindR('mpbr',v=>mpBr=v);
  const bs=q('mpbs');if(bs)bs.onchange=()=>mpBrShape=bs.value;
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{mpCat=b.dataset.cat;mpKind=(STAMPS.find(s=>s[2]===mpCat)||STAMPS[0])[0];mpSize=null;render()});
  document.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{mpKind=b.dataset.st;mpSize=null;render()});
  bindR('mpsz',v=>mpSize=v);bindR('mpts',v=>mpTxtS=v);bindR('mprot',v=>mpRot=v);
  document.querySelectorAll('[data-rn]').forEach(b=>b.onclick=()=>{const a=+b.dataset.rn;mpRot=a===0?0:normA(mpRot+a);render()});
  [['mpsc',v=>mpScatter=v],['mpvar',v=>mpVar=v],['mpagg',v=>mpAgg=v],['mphid',v=>mpHid=v]].forEach(([id,fn])=>{const c=q(id);if(c)c.onchange=()=>fn(c.checked)});
  const tx=q('mptxt');if(tx)tx.oninput=()=>mpTxt=tx.value;
  /* selezione */
  const so=()=>mp.objs.find(o=>o.id===mpSelId);
  const sz=q('szo');if(sz){sz.onpointerdown=()=>{mpPush();stat()};sz.oninput=()=>{const o=so();if(o){o.s=+sz.value;q('szov').textContent=sz.value;rd()}}}
  const rt=q('rot');if(rt){rt.onpointerdown=()=>{mpPush();stat()};rt.oninput=()=>{const o=so();if(o){o.r=+rt.value;q('rotv').textContent=rt.value;rd()}}}
  document.querySelectorAll('[data-ro]').forEach(b=>b.onclick=()=>{const o=so();if(!o)return;mpPush();const a=+b.dataset.ro;o.r=a===0?0:normA((o.r||0)+a);render()});
  if(q('sflip'))q('sflip').onclick=()=>{const o=so();if(o){mpPush();o.f=o.f?0:1;render()}};
  if(q('shid'))q('shid').onclick=()=>{const o=so();if(o){mpPush();if(o.h)delete o.h;else o.h=1;render()}};
  if(q('sdup'))q('sdup').onclick=()=>{const o=so();if(o&&mp.objs.length<1500){mpPush();const c=JSON.parse(JSON.stringify(o));c.id=uid8();c.x=+Math.min(mp.n,c.x+.6).toFixed(2);c.y=+Math.min(mp.n,c.y+.6).toFixed(2);mp.objs.push(c);mpSelId=c.id;render()}};
  if(q('sdel'))q('sdel').onclick=()=>{const o=so();if(o){mpPush();mp.objs=mp.objs.filter(x=>x.id!==o.id);mpSelId=null;render()}};
  if(q('stxt'))q('stxt').onclick=async()=>{const o=so();if(!o)return;const r=await ask('Testo',[{l:'Testo',n:'t'}],{t:o.t});if(r&&r.t){mpPush();o.t=r.t.slice(0,40);render()}};
  /* nebbia e segnalini */
  document.querySelectorAll('[data-fm]').forEach(b=>b.onclick=()=>{mpFogMode=b.dataset.fm;render()});
  if(q('mpfall'))q('mpfall').onclick=()=>{mpPush();mp.fog.fill(1);render()};
  if(q('mpfnone'))q('mpfnone').onclick=()=>{mpPush();mp.fog.fill(0);render()};
  if(q('mpfon'))q('mpfon').onchange=()=>{mpPush();mp.fogOn=q('mpfon').checked;render()};
  document.querySelectorAll('[data-tp]').forEach(b=>b.onclick=()=>{mpTokPl=b.dataset.tp;mpTokN=null;render()});
  document.querySelectorAll('[data-tn]').forEach(b=>b.onclick=()=>{mpTokN=b.dataset.tn;mpTokPl=null;const n=S.npcs[mpTokN],t=n&&n.mpos&&mapSel&&n.mpos[mapSel];mpTokVis=!!(t&&t.v);render()});
  const tv=q('mptv');if(tv)tv.onchange=()=>{mpTokVis=tv.checked;const n=S.npcs[mpTokN];if(mapSel&&n&&n.mpos&&n.mpos[mapSel])guard(db.collection('npcs').doc(mpTokN).update({mpos:{...n.mpos,[mapSel]:{...n.mpos[mapSel],v:mpTokVis?1:0}}}))};
  if(q('mptokclr'))q('mptokclr').onclick=()=>{
    if(!mapSel||(!mpTokPl&&!mpTokN))return toast('Scegli un player o un incontro');
    if(mpTokN){const n=S.npcs[mpTokN],o={...((n&&n.mpos)||{})};delete o[mapSel];guard(db.collection('npcs').doc(mpTokN).update({mpos:o}))}
    else{const pl=S.players[mpTokPl],o={...((pl&&pl.mpos)||{})};delete o[mapSel];guard(db.collection('players').doc(mpTokPl).update({mpos:o}))}
  };
  /* impostazioni */
  const setd=(id,fn)=>{const e=q(id);if(e)e.onchange=()=>{mpPush();fn(e);mp.tcDirty=true;render()}};
  setd('mppal',e=>mp.pal=e.value);setd('mpunit',e=>mp.unit=e.value);setd('mpgrid',e=>mp.grid=e.checked);setd('mppub',e=>mp.pub=e.checked);
  const ms=q('mpscale');if(ms)ms.onchange=()=>{mpPush();mp.scale=Math.min(1000,Math.max(0,+ms.value||0));render()};
  const mz=q('mpsize');if(mz)mz.onchange=()=>mpResize(+mz.value);
  ['dset','dgen'].forEach(id=>{const d=q(id);if(d)d.ontoggle=()=>{mpOpenD[id==='dset'?'set':'gen']=d.open}});
  /* generatore */
  document.querySelectorAll('[data-mt]').forEach(b=>b.onclick=()=>{const c=MAPCFG;MAPCFG=mapNorm({type:b.dataset.mt,seed:c.seed,size:c.size,shape:c.shape,land:c.land});mpOpenD.gen=true;render()});
  document.querySelectorAll('[data-ld]').forEach(b=>b.onclick=()=>{const c=mapNorm(MAPCFG),k=b.dataset.ld;MAPCFG=mapNorm({...c,type:'terra',land:k,water:LAND_W[k]});mpOpenD.gen=true;render()});
  document.querySelectorAll('[data-mk]').forEach(i=>i.oninput=()=>{MAPCFG[i.dataset.mk]=+i.value;const l=q('mv-'+i.dataset.mk);if(l)l.textContent=i.value});
  const sd=q('mapseed');if(sd)sd.oninput=()=>{MAPCFG.seed=sd.value||'0'};
  const dice=()=>{MAPCFG.seed=Math.random().toString(36).slice(2,8);if(sd)sd.value=MAPCFG.seed};
  if(q('mapdice'))q('mapdice').onclick=dice;
  if(q('mapnew'))q('mapnew').onclick=()=>{dice();mpGenAct()};
  if(q('mpquick'))q('mpquick').onclick=()=>{dice();mpGenAct()};
  if(q('mapgen'))q('mapgen').onclick=mpGenAct;
  const gz=q('mapgsize');if(gz)gz.onchange=()=>{MAPCFG.size=+gz.value};
  const gs=q('mapgshape');if(gs)gs.onchange=()=>{MAPCFG.shape=gs.value};
  /* salvataggio, PNG, codice */
  if(q('mapsave'))q('mapsave').onclick=()=>mpSave(false);
  if(q('mapsaveas'))q('mapsaveas').onclick=()=>mpSave(true);
  if(q('mapblank'))q('mapblank').onclick=mpNewBlank;
  if(q('mapphoto'))q('mapphoto').onclick=mpPhotoMap;
  if(q('mapphotorm'))q('mapphotorm').onclick=async()=>{if(!await askYes('Togliere la foto? Le zone non dipinte diventeranno erba.'))return;mpPush();for(let i=0;i<mp.ter.length;i++)if(mp.ter[i]===255)mp.ter[i]=3;mp.bg='';mp.tcDirty=true;render()};
  const dl=q('mapdl');if(dl)dl.onclick=()=>{try{const big=document.createElement('canvas');mpDraw(big,mp,true,{},null);big.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='mappa-'+(mapSel&&S.maps[mapSel]?S.maps[mapSel].name.replace(/[^\w-]+/g,'_'):mp.gt)+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)})}catch(e){toast('PNG non disponibile per questa mappa')}};
  const cp=q('mapcopy');if(cp)cp.onclick=()=>{const code='NXMAP2:'+JSON.stringify(mpToDoc(mp)),show=()=>ask('Codice mappa',[{l:'Copia questo codice',n:'c',t:'area'}],{c:code});if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(code).then(()=>toast('Codice copiato'),show);else show()};
  const ld=q('mapload');if(ld)ld.onclick=async()=>{const r=await ask('Carica mappa',[{l:'Incolla il codice (NXMAP2:… oppure NXMAP:…)',n:'c',t:'area'}]);if(!r)return;try{const s=r.c.trim(),v2=s.startsWith('NXMAP2:'),j=JSON.parse(s.replace(/^NXMAP2?:/,''));mpPush();const g=mpFromDoc(v2?j:{cfg:j});Object.assign(MP,g);MP.tcDirty=true;mpSelId=null;render()}catch(e){toast('Codice non valido')}};
  document.querySelectorAll('[data-mdel]').forEach(b=>b.onclick=async()=>{if(await askYes('Eliminare questa mappa salvata?'))guard(db.collection('maps').doc(b.dataset.mdel).delete())});
}
/* ===== v16: dadi di danno, tiro animato, uso dell'arma ===== */
const DICE=['d4','d6','d8','d10','d12','d20','d100'];
const ATK_KEYS=['taglio','contundente','perforante','distanza','sparo','magia'];
const DMGF=[{l:'Tipo di attacco: taglio (spade, asce) · contundente (mazze, pugni) · perforante (lance, pugnali) · distanza (archi, lanci) · sparo (armi da fuoco) · magia — cambia l\'animazione',n:'atk',t:'select',o:ATK_KEYS},{l:'Danno fisso (si somma al tiro)',n:'dfix',t:'number'},{l:'Numero di dadi di danno (0 = nessun dado)',n:'dn',t:'number'},{l:'Tipo di dado',n:'dt',t:'select',o:DICE},{l:'Minimo del dado (ogni dado vale almeno questo numero, es. 2: un 1 conta 2; 0 = nessun minimo)',n:'dmin',t:'number'}];
const dmgClean=(r,on)=>on?{dfix:Math.min(9999,r.dfix||0),dn:Math.min(20,r.dn||0),dt:DICE.includes(r.dt)?r.dt:'d6',dmin:Math.min(9999,r.dmin||0),atk:ATK_KEYS.includes(r.atk)?r.atk:''}:{dfix:0,dn:0,dt:'d6',dmin:0,atk:''};
const dmgCopy=o=>({dfix:o.dfix||0,dn:o.dn||0,dt:o.dt||'d6',dmin:o.dmin||0,atk:o.atk||'',cnx:o.cnx||0,chp:o.chp||0});
const dmgInit=o=>({dfix:o.dfix||0,dn:o.dn||0,dt:o.dt||'d6',dmin:o.dmin||0,atk:atkOf(o)});
const dieOf=o=>parseInt(String(o.dt||'d6').slice(1))||6;
const hasDmg=o=>(o.dn|0)>0||(o.dfix|0)>0;
const dmgTxt=o=>{const n=o.dn|0,f=o.dfix|0,m=o.dmin|0;let t=n>0?n+(o.dt||'d6'):'';if(f>0)t+=(t?'+':'')+f;if(m>0)t+=' (min '+m+')';return esc(t)};
const costTxt=e=>[(e.cnx|0)>0?'🔷 −'+e.cnx+' NEXUS':'',(e.chp|0)>0?'❤️ −'+e.chp+' HP':''].filter(Boolean).join(' ');
const costHtml=e=>costTxt(e)?` · <span style="color:var(--nx)">${costTxt(e)} / uso</span>`:'';
const dmgHtml=e=>(e.cat==='arma'&&hasDmg(e)?` · <span style="color:var(--danger)">💥 ${dmgTxt(e)}</span>`:'')+costHtml(e);
/* tiro di dadi con animazione: tocca per saltarla. Il minimo vale sul danno totale (dadi + fisso). */
function rollDice(o){
  const n=Math.max(0,o.n|0),die=Math.max(2,o.die|0)||6,fix=o.fix|0,min=o.min|0;
  const dice=Array.isArray(o.pre)?o.pre.slice(0,n):Array.from({length:n},()=>rollD(die));
  const eff=dice.map(d=>Math.max(min,d)),raw=eff.reduce((a,b)=>a+b,0)+fix,tot=n?raw:Math.max(min,raw); /* il minimo vale per ogni dado: un 1 con minimo 2 conta 2 */
  const sub=(n?n+'d'+die:'')+(fix?(n?' + ':'')+fix:'')+(min?' · minimo '+min+(n>1?' per dado':''):'');
  const brk=(n?dice.map(d=>d<min?d+'→'+min:d).join(' + '):'')+(fix?(n?' + ':'')+fix:'')+(!n&&raw<min?' → minimo '+min:'');
  const m=document.createElement('div');m.className='modal';
  m.innerHTML=`<div class="rolldlg"><h3>${esc(o.title)}</h3><div class="mut">${esc(sub)}</div><div class="dice">${dice.map(()=>'<div class="die rolling"><b>?</b></div>').join('')}</div><div class="rres" style="visibility:hidden"><div class="mut">${esc(o.lab||'DANNO')}</div><div class="rtot">${tot}</div><div class="mut">${esc(brk)}</div></div><div class="row" style="margin-top:14px"><button class="grow" data-c>Chiudi</button></div></div>`;
  document.body.append(m);
  const els=[...m.querySelectorAll('.die')],res=m.querySelector('.rres');let done=false,iv=0,q=false;SND.play('dice',1);
  const land=(d,i)=>{d.className='die land'+(dice[i]===die?' max':dice[i]===1?' min':'');d.firstChild.textContent=dice[i];if(!q)SND.play('land',1)};
  const fin=()=>{if(done)return;done=true;clearInterval(iv);q=true;els.forEach(land);SND.play(dice.length&&dice.every(x=>x===1)?'fail':dice.some(x=>x===die)?'crit':'ok',1);res.style.visibility='visible';res.classList.add('rpop');if(navigator.vibrate)try{navigator.vibrate(40)}catch(e){}};
  if(!n)fin();
  else{const t0=Date.now();iv=setInterval(()=>{const k=Math.floor((Date.now()-t0-900)/300)+1;els.forEach((d,i)=>{if(i<k){if(!d.classList.contains('land'))land(d,i)}else d.firstChild.textContent=1+Math.floor(Math.random()*die)});if(k<n)SND.play('dice');if(k>=n)fin()},70)}
  m.onclick=e=>{
    if(e.target.dataset.c!==undefined||(e.target===m&&done)){clearInterval(iv);m.remove()}
    else if(!done)fin();
  };
}
/* ===== animazioni di attacco (cambiano in base al tipo di arma) ===== */
const ATK_SND={taglio:'slash',contundente:'smash',perforante:'stab',distanza:'shot',sparo:'gun',magia:'magic'};
const ATK_WAIT={taglio:900,contundente:950,perforante:800,distanza:1050,sparo:900,magia:1200};
/* se l'arma non ha un tipo scelto (armi create prima), lo deduco dal nome */
function atkOf(e){
  if(ATK_KEYS.includes(e.atk))return e.atk;
  const n=String(e.name||'').toLowerCase();
  if(/bastone magico|scettro|grimorio|tomo|bacchetta|incantes|stregon|magic/.test(n))return 'magia';
  if(/pistola|fucile|revolver|mitra|carabina|moschetto|doppietta|shotgun|cannone|arma da fuoco/.test(n))return 'sparo';
  if(/\barco\b|balestra|freccia|fionda|giavellott|shuriken|lancio|boomerang/.test(n))return 'distanza';
  if(/lancia|pugnale|stocco|daga|stiletto|fioretto|tridente|picca|punteruolo|spillone/.test(n))return 'perforante';
  if(/mazza|martello|clava|pugn|tirapugni|bastone|randello|maglio|manganello|mazzafrusto/.test(n))return 'contundente';
  return 'taglio';
}
function atkFx(e){
  const k=atkOf(e),el=document.createElement('div');el.className='atkfx '+k;
  const spk=(x,y,n,d)=>Array.from({length:n},(_,i)=>`<i class="spk" style="--x:${x}%;--y:${y}%;--a:${Math.round(360/n*i+Math.random()*24)}deg;--r:${50+Math.floor(Math.random()*70)}px;animation-delay:${d}s"></i>`).join('');
  const rg=d=>`<b class="rg" style="animation-delay:${d}s"></b>`;
  const fl=d=>`<u class="fl" style="--fd:${d}s"></u>`;
  const P={
    taglio:()=>`<b class="sl" style="--r:-32deg;--y:-14vh"></b><b class="sl" style="--r:-48deg;--y:6vh;animation-delay:.14s"></b><b class="sl" style="--r:-20deg;--y:22vh;animation-delay:.28s"></b>`+fl(.3)+spk(50,50,12,.34),
    contundente:()=>fl(.1)+`<b class="bm">💥</b>`+rg(.1)+rg(.22)+rg(.34)+spk(50,50,16,.12),
    perforante:()=>`<b class="tp"></b>`+fl(.2)+spk(64,50,10,.2),
    distanza:()=>`<b class="pr"></b>`+fl(.48)+spk(80,64,12,.48),
    sparo:()=>`<b class="mz"></b><b class="bl"></b>`+fl(.3)+spk(90,80,14,.3),
    magia:()=>`<b class="mr" style="--s:230px"></b><b class="mr" style="--s:160px;animation-delay:.1s"></b><b class="mr" style="--s:95px;animation-delay:.2s"></b><b class="ob"></b>`+fl(.55)+spk(50,50,18,.55)
  };
  const ph=e.photo?`<img src="${esc(e.photo)}" alt="">`:'⚔️';
  el.innerHTML=`<div class="wpn">${ph} ${esc(e.name)}</div>`+P[k]();
  document.body.append(el);
  SND.play(ATK_SND[k],1);
  const win=document.getElementById('win'),sh=k==='contundente'?100:k==='sparo'?300:k==='magia'?550:0;
  if(sh&&win)setTimeout(()=>{win.classList.remove('atk-shake');void win.offsetWidth;win.classList.add('atk-shake');setTimeout(()=>win.classList.remove('atk-shake'),420)},sh);
  if(navigator.vibrate)try{navigator.vibrate(k==='contundente'||k==='sparo'?[20,30,60]:[30])}catch(x){}
  setTimeout(()=>el.remove(),1600);
  return ATK_WAIT[k];
}
function attack(id){
  const p=me();if(!p)return;
  const inv=[...(p.inv||[])],i=inv.findIndex(e=>e.id===id);if(i<0)return;
  const e=inv[i];
  if(!hasDmg(e))return toast('Questa arma non ha un danno impostato');
  if(e.uses!=null&&e.uses<1)return toast('Arma esaurita');
  const d=payCost(p,e);if(!d)return;
  const wait=REDM()?0:atkFx(e);if(REDM())SND.play('attack',1);
  setTimeout(()=>rollDice({title:'⚔️ '+e.name,n:e.dn,die:dieOf(e),fix:e.dfix,min:e.dmin}),wait);
  if(e.uses!=null){if(e.uses<=1)inv.splice(i,1);else inv[i]={...e,uses:e.uses-1};d.inv=inv}
  if(Object.keys(d).length)guard(db.collection('players').doc(uid).update(d));
}

/* ===== v17: combattenti: inventario nascosto, K.O., bottino ===== */
const koTag=n=>n.ko?'<span class="tag" style="color:var(--danger)">💀 K.O.</span>':'';
const npcInvHtml=n=>{
  if(kindOf(n)!=='combattente')return '';
  const inv=n.inv||[];
  return `<div class="row sp" style="margin-top:12px"><b>🎒 Inventario <span class="tag">nascosto ai player</span></b><button data-nia="${n.id}">+ Oggetto</button></div>`+
  (inv.map(e=>`<div class="move" style="border-left-color:var(--acc2)"><div style="font-size:1.6em">${e.photo?itImg(e.photo,44):(CATI[e.cat]||'🎁')}</div><div class="grow"><b>${esc(e.name)}</b><div class="mut">${CATL[e.cat]||'Oggetto'} · ${e.uses==null?'♾ Infinito':e.uses+(e.uses===1?' uso':' usi')}${bonusesOf(e).length?` · <span style="color:var(--ok)">${bonusTxt(e)}</span>`:''}${e.cat==='armatura'&&e.arm?` · <span style="color:var(--ok)">🛡️ −${e.arm} danni</span>`:''}${dmgHtml(e)}</div>${e.desc?`<div class="mut" style="white-space:pre-wrap">${esc(e.desc)}</div>`:''}</div><div class="row" style="gap:4px;flex-direction:column"><button class="g mini" data-nie="${n.id}|${e.id}">✎</button><button class="d mini" data-nid="${n.id}|${e.id}">🗑</button></div></div>`).join('')||'<p class="mut">Inventario vuoto.</p>')+
  `<div class="row" style="margin-top:12px;flex-wrap:wrap"><button class="${n.ko?'g':'d'} grow" data-nko="${n.id}">${n.ko?'♻️ Rimuovi K.O.':'💀 Segna K.O.'}</button><button class="grow" data-nlt="${n.id}" ${n.ko&&inv.length?'':'disabled'}>🎁 Assegna bottino</button></div>`+
  (n.ko?'':'<div class="mut">Segna il combattente come K.O. per assegnare il suo bottino ai player.</div>');
};
function rebindNI(){
  const U=(id,d)=>guard(db.collection('npcs').doc(id).update(d));
  app.querySelectorAll('[data-nia]').forEach(b=>b.onclick=async()=>{
    const id=b.dataset.nia,n=S.npcs[id];if(!n)return;
    const r=await ask('Nuovo oggetto di '+n.name,IF(),{cat:'oggetto',use:'infinito',bk:'nessuno',dt:'d6'});
    if(r&&r.name){const o=await invSave(r);U(id,{inv:[...(n.inv||[]),{id:uid8(),it:'',...o}]})}
  });
  app.querySelectorAll('[data-nie]').forEach(b=>b.onclick=async()=>{
    const [id,iid]=b.dataset.nie.split('|'),n=S.npcs[id],e=n&&(n.inv||[]).find(x=>x.id===iid);if(!e)return;
    const r=await ask('Modifica oggetto',IF(),{...e,use:e.uses==null?'infinito':'utilizzabile',uses:e.uses||0,bks:bonusInit(e),...dmgInit(e)});
    if(r&&r.name){const o=await invSave(r,e);U(id,{inv:n.inv.map(x=>x.id===iid?{...x,...o}:x)})}
  });
  app.querySelectorAll('[data-nid]').forEach(b=>b.onclick=async()=>{
    const [id,iid]=b.dataset.nid.split('|'),n=S.npcs[id];if(!n)return;
    if(await askYes('Rimuovere questo oggetto dall\'inventario?'))U(id,{inv:(n.inv||[]).filter(x=>x.id!==iid)});
  });
  app.querySelectorAll('[data-nko]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.nko,n=S.npcs[id];if(!n)return;
    U(id,{ko:!n.ko});SND.play(n.ko?'ok':'ko',1);toast(n.ko?n.name+': K.O. rimosso':'💀 '+n.name+' è K.O.');
  });
  app.querySelectorAll('[data-nlt]').forEach(b=>b.onclick=()=>npcLoot(b.dataset.nlt));
}
async function npcLoot(id){
  const n=S.npcs[id],inv=(n&&n.inv)||[];
  if(!n||!inv.length)return toast('Inventario vuoto');
  const r=await ask('🎁 Bottino di '+n.name,[
    {l:'Oggetti da assegnare',n:'its',t:'multi',o:inv.map(e=>[e.id,(CATI[e.cat||'oggetto']||'🎁')+' '+e.name])},
    {l:'Player che lo hanno sconfitto',n:'who',t:'multi',o:Object.entries(S.players).map(([i,p])=>[i,p.username])},
    {l:'Distribuzione',n:'mode',t:'select',o:['Ogni player riceve tutto','Dividi a rotazione']}
  ],{its:inv.map(e=>e.id),who:[],mode:'Ogni player riceve tutto'});
  if(!r)return;
  const its=inv.filter(e=>r.its.includes(e.id)),who=r.who.filter(i=>S.players[i]);
  if(!its.length)return toast('Nessun oggetto selezionato');
  if(!who.length)return toast('Nessun player selezionato');
  const share=r.mode.startsWith('Dividi'),give={};
  who.forEach(i=>give[i]=[]);
  its.forEach((e,k)=>{if(share)give[who[k%who.length]].push(e);else who.forEach(i=>give[i].push(e))});
  await Promise.all(who.filter(i=>give[i].length).map(async pid=>{
    const pl=S.players[pid],gift=give[pid].map(e=>({...e,id:uid8()}));
    await guard(db.collection('players').doc(pid).update({inv:[...(pl.inv||[]),...gift]}));
    const mid=uid8();
    await guard(db.collection('msgs').doc(mid).set({id:mid,to:[pid],from:{t:'npc',name:n.name,photo:n.photo||''},kind:'msg',text:'Hai sconfitto '+n.name+'!\nBottino: '+gift.map(e=>e.name).join(', '),ts:Date.now()}));
  }));
  await guard(db.collection('npcs').doc(id).update({inv:inv.filter(e=>!r.its.includes(e.id))}));
  SND.play('loot',1);toast('🎁 Bottino assegnato a '+who.length+' player');
}

/* ===== v20: incontri «Civis» e dialoghi con ricompense =====
   Ogni incontro può avere un albero di dialogo: battute dell'NPC (nodi) e risposte del player.
   Una risposta può portare a un'altra battuta o chiudere il dialogo, e può dare Nummus e/o oggetti
   (una sola volta per player, se il Master lo vuole). Dati: npc.dlg={start,nodes:[{id,text,opts:[{id,text,next,nm,items,once,pv}]}]};
   le ricompense già prese stanno nel player: dlgDone['npc|nodo|risposta']=true. */
const dlgOf=n=>n&&n.dlg&&Array.isArray(n.dlg.nodes)&&n.dlg.nodes.length?n.dlg:null;
const dlgRwTxt=o=>{const a=[];if((o.nm|0)>0)a.push('🪙 '+o.nm+' Nummus');(o.items||[]).forEach(e=>a.push((CATI[e.cat||'oggetto']||'🎁')+' '+esc(e.name)));return a.join(' · ')};
/* ---- lato player ---- */
function dlgHtml(n){
  const d=dlgOf(n);if(!d)return '';
  const p=me(),st=view.dl;
  const box=inner=>`<div class="card" id="dlgbox"><div class="row sp"><h3>💬 Dialogo</h3>${st&&st.started?'<button class="g mini" data-dgr>↺ Ricomincia</button>':''}</div>${inner}</div>`;
  if(!st||!st.started)return box(`<button style="width:100%" data-dgo>💬 Parla con ${esc(n.name)}</button>`);
  const node=d.nodes.find(x=>x.id===st.node);
  const bub=(who,t)=>who==='n'?`<div style="display:flex;margin:6px 0"><div style="max-width:88%;padding:8px 12px;border-radius:14px 14px 14px 4px;background:rgba(255,255,255,.07);border:1px solid var(--acc2,#888)"><b>${esc(n.name)}</b><div style="white-space:pre-wrap">${esc(t)}</div></div></div>`:who==='p'?`<div style="display:flex;justify-content:flex-end;margin:6px 0"><div style="max-width:88%;padding:8px 12px;border-radius:14px 14px 4px 14px;background:var(--acc,#6a5acd);color:#fff"><div style="white-space:pre-wrap">${esc(t)}</div></div></div>`:`<div style="text-align:center;margin:8px 0"><span class="pill eu" style="white-space:normal">🎁 ${t}</span></div>`;
  const log=st.log.map(l=>bub(l.w,l.w==='r'?l.t:l.t)).join('');
  let opts='';
  if(node){
    opts=(node.opts||[]).map(o=>{
      const done=(p.dlgDone||{})[n.id+'|'+node.id+'|'+o.id],rw=dlgRwTxt(o);
      return `<button class="g" data-dop="${o.id}" style="width:100%;text-align:left;margin:4px 0;white-space:normal">${esc(o.text)}${o.pv&&rw&&!(o.once&&done)?` <span class="tag">${rw}</span>`:''}${o.once&&done&&rw?' <span class="tag">✓ già ottenuto</span>':''}</button>`;
    }).join('')||'<p class="mut">Il personaggio non ha altro da dire.</p>';
  }else opts='<p class="mut" style="text-align:center">— Fine della conversazione —</p>';
  return box(log+`<div style="margin-top:10px">${opts}</div>`);
}
function dlgBind(n){
  const d=dlgOf(n);if(!d)return;
  const go=app.querySelector('[data-dgo]'),rs=app.querySelector('[data-dgr]');
  const start=()=>{const f=d.nodes.find(x=>x.id===d.start)||d.nodes[0];view.dl={started:true,node:f.id,log:[{w:'n',t:f.text}]};render()};
  if(go)go.onclick=start;if(rs)rs.onclick=start;
  app.querySelectorAll('[data-dop]').forEach(b=>b.onclick=()=>dlgPick(n,b.dataset.dop));
  if(view.dl&&view.dl.scroll){view.dl.scroll=false;const el=document.getElementById('dlgbox');if(el)el.scrollIntoView({block:'end',behavior:'smooth'})}
}
async function dlgPick(n,oid){
  const d=dlgOf(n),st=view.dl,p=me();if(!d||!st||!p)return;
  const node=d.nodes.find(x=>x.id===st.node),op=node&&(node.opts||[]).find(o=>o.id===oid);if(!op)return;
  st.log.push({w:'p',t:op.text});
  const key=n.id+'|'+node.id+'|'+op.id,done=(p.dlgDone||{})[key],nm=Math.max(0,op.nm|0),its=op.items||[];
  if((nm||its.length)&&!(op.once&&done)){
    const gift=its.map(e=>({...e,id:uid8()}));
    const upd={currency:(p.currency||0)+nm,dlgDone:{...(p.dlgDone||{}),[key]:true}};
    if(gift.length)upd.inv=[...(p.inv||[]),...gift];
    try{await guard(db.collection('players').doc(uid).update(JSON.parse(JSON.stringify(upd))))}catch(e){}
    st.log.push({w:'r',t:'Hai ricevuto: '+dlgRwTxt(op)});
    SND.play('loot',1);toast('🎁 '+n.name+': ricompensa ricevuta');
  }
  const nx=op.next&&d.nodes.find(x=>x.id===op.next);
  if(nx){st.node=nx.id;st.log.push({w:'n',t:nx.text})}else st.node=null;
  st.scroll=true;render();
}
/* ---- lato Master ---- */
const dlgNodeLbl=(d,i)=>(i+1)+'. '+String(d.nodes[i].text||'').replace(/\s+/g,' ').slice(0,34);
const dlgMasterHtml=n=>{
  const d=dlgOf(n)||{start:'',nodes:[]};
  return `<div class="row sp" style="margin-top:14px"><b>💬 Dialogo <span class="tag">${d.nodes.length} battute</span></b><button data-dna="${n.id}">+ Battuta</button></div>`+
  (d.nodes.map((nd,i)=>`<div class="move" style="border-left-color:var(--acc);display:block"><div class="row sp"><div class="grow"><b>${i+1}.</b> ${(nd.id===d.start||(!d.start&&i===0))?'<span class="tag">▶ inizio</span> ':''}<span style="white-space:pre-wrap">${esc(nd.text)}</span></div><div class="row"><button class="g mini" data-dne="${n.id}|${nd.id}">✎</button><button class="g mini" data-dns="${n.id}|${nd.id}" title="Imposta come inizio">▶</button><button class="d mini" data-dnd="${n.id}|${nd.id}">✕</button></div></div>`+
    (nd.opts||[]).map(o=>{const ti=d.nodes.findIndex(x=>x.id===o.next),rw=dlgRwTxt(o);return `<div style="margin:8px 0 0 12px;padding-left:8px;border-left:2px solid var(--acc2)"><div class="row sp"><div class="grow">↳ “${esc(o.text)}” <span class="tag">${ti>=0?'→ '+(ti+1):'fine'}</span>${rw?` <span class="tag" style="color:var(--ok)">${rw}</span>`:''}${o.once?' <span class="tag">1 volta</span>':''}</div><div class="row"><button class="g mini" data-doe="${n.id}|${nd.id}|${o.id}">✎</button><button class="d mini" data-dod="${n.id}|${nd.id}|${o.id}">✕</button></div></div>${(o.items||[]).map(e=>`<div class="row sp" style="margin:4px 0 0 10px"><span class="mut">${CATI[e.cat||'oggetto']||'🎁'} ${esc(e.name)}</span><div class="row"><button class="g mini" data-doie="${n.id}|${nd.id}|${o.id}|${e.id}">✎</button><button class="d mini" data-doid="${n.id}|${nd.id}|${o.id}|${e.id}">✕</button></div></div>`).join('')}<button class="g mini" style="margin-top:4px" data-doi="${n.id}|${nd.id}|${o.id}">+ Oggetto in ricompensa</button></div>`}).join('')+
    `<button class="g mini" style="margin-top:8px" data-doa="${n.id}|${nd.id}">+ Risposta del player</button></div>`).join('')||'<p class="mut">Nessuna battuta: aggiungine una per creare il dialogo.</p>');
};
function rebindDlg(){
  const clone=id=>{const n=S.npcs[id];return {n,d:JSON.parse(JSON.stringify(dlgOf(n)||{start:'',nodes:[]}))}};
  const save=(id,d)=>guard(db.collection('npcs').doc(id).update({dlg:JSON.parse(JSON.stringify(d))}));
  const onn=(a,fn)=>app.querySelectorAll(`[data-${a}]`).forEach(b=>b.onclick=()=>fn(b.dataset[a].split('|')));
  const optF=(d,nodeId)=>[{l:'Risposta del player (il testo che può scegliere)',n:'text',t:'area'},{l:'Dove porta',n:'next',t:'select',o:['Fine del dialogo',...d.nodes.map((x,i)=>dlgNodeLbl(d,i))]},{l:'Ricompensa: Nummus (0 = nessuna)',n:'nm',t:'number'},{l:'Ricompensa data una sola volta per player?',n:'once',t:'select',o:['sì','no']},{l:'Mostra la ricompensa al player prima che scelga?',n:'pv',t:'select',o:['no','sì']}];
  const nextId=(d,lbl)=>{const i=parseInt(lbl);return lbl&&i>0&&d.nodes[i-1]?d.nodes[i-1].id:''};
  const nextLbl=(d,id)=>{const i=d.nodes.findIndex(x=>x.id===id);return i>=0?dlgNodeLbl(d,i):'Fine del dialogo'};
  const itemSave=async(r,old)=>{const o=await invSave(r,old);return o};
  onn('dna',async([id])=>{const {n,d}=clone(id);if(!n)return;const r=await ask('Nuova battuta di '+n.name,[{l:'Cosa dice il personaggio',n:'text',t:'area'}],{});if(!r||!r.text)return;const nd={id:uid8(),text:r.text,opts:[]};d.nodes.push(nd);if(!d.start)d.start=nd.id;save(id,d)});
  onn('dne',async([id,nid])=>{const {n,d}=clone(id),nd=d.nodes.find(x=>x.id===nid);if(!nd)return;const r=await ask('Modifica battuta',[{l:'Cosa dice il personaggio',n:'text',t:'area'}],{text:nd.text});if(!r||!r.text)return;nd.text=r.text;save(id,d)});
  onn('dns',([id,nid])=>{const {d}=clone(id);d.start=nid;save(id,d);toast('▶ Battuta iniziale impostata')});
  onn('dnd',async([id,nid])=>{const {d}=clone(id);if(!await askYes('Eliminare questa battuta e le sue risposte?'))return;d.nodes=d.nodes.filter(x=>x.id!==nid);d.nodes.forEach(x=>(x.opts||[]).forEach(o=>{if(o.next===nid)o.next=''}));if(d.start===nid)d.start=d.nodes[0]?d.nodes[0].id:'';save(id,d)});
  onn('doa',async([id,nid])=>{const {d}=clone(id),nd=d.nodes.find(x=>x.id===nid);if(!nd)return;const r=await ask('Nuova risposta del player',optF(d,nid),{once:'sì',pv:'no',next:'Fine del dialogo',nm:0});if(!r||!r.text)return;(nd.opts=nd.opts||[]).push({id:uid8(),text:r.text,next:nextId(d,r.next),nm:Math.min(999999,r.nm),once:r.once==='sì',pv:r.pv==='sì',items:[]});save(id,d)});
  onn('doe',async([id,nid,oid])=>{const {d}=clone(id),nd=d.nodes.find(x=>x.id===nid),o=nd&&(nd.opts||[]).find(x=>x.id===oid);if(!o)return;const r=await ask('Modifica risposta',optF(d,nid),{text:o.text,next:nextLbl(d,o.next),nm:o.nm||0,once:o.once?'sì':'no',pv:o.pv?'sì':'no'});if(!r||!r.text)return;Object.assign(o,{text:r.text,next:nextId(d,r.next),nm:Math.min(999999,r.nm),once:r.once==='sì',pv:r.pv==='sì'});save(id,d)});
  onn('dod',async([id,nid,oid])=>{const {d}=clone(id),nd=d.nodes.find(x=>x.id===nid);if(!nd||!await askYes('Eliminare questa risposta?'))return;nd.opts=(nd.opts||[]).filter(x=>x.id!==oid);save(id,d)});
  onn('doi',async([id,nid,oid])=>{const {d}=clone(id),nd=d.nodes.find(x=>x.id===nid),o=nd&&(nd.opts||[]).find(x=>x.id===oid);if(!o)return;const r=await ask('Oggetto in ricompensa',IF(),{cat:'oggetto',use:'infinito',bk:'nessuno',dt:'d6'});if(!r||!r.name)return;const it=await itemSave(r);(o.items=o.items||[]).push({id:uid8(),it:'',...it});save(id,d)});
  onn('doie',async([id,nid,oid,iid])=>{const {d}=clone(id),nd=d.nodes.find(x=>x.id===nid),o=nd&&(nd.opts||[]).find(x=>x.id===oid),e=o&&(o.items||[]).find(x=>x.id===iid);if(!e)return;const r=await ask('Modifica oggetto',IF(),{...e,use:e.uses==null?'infinito':'utilizzabile',uses:e.uses||0,bks:bonusInit(e),...dmgInit(e)});if(!r||!r.name)return;Object.assign(e,await itemSave(r,e));save(id,d)});
  onn('doid',async([id,nid,oid,iid])=>{const {d}=clone(id),nd=d.nodes.find(x=>x.id===nid),o=nd&&(nd.opts||[]).find(x=>x.id===oid);if(!o||!await askYes('Rimuovere questo oggetto dalla ricompensa?'))return;o.items=(o.items||[]).filter(x=>x.id!==iid);save(id,d)});
}

/* ===== v18: più bonus per oggetto (tratti e abilità) ===== */
const bonusesOf=e=>Array.isArray(e.bonuses)?e.bonuses:(e.bonus?[e.bonus]:[]);
const bonusTxt=e=>bonusesOf(e).map(b=>'+'+b.v+' '+esc(bonusLabel(b))).join(', ');
const bonusInit=e=>bonusesOf(e).map(b=>bonusLabel(b)+' +'+b.v).join('\n');
const nzs=t=>String(t).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
function bonusParse(txt){
  const map={};Object.entries(BK).forEach(([l,v])=>map[nzs(l)]=v);
  const out=[],bad=[];
  for(const ln of splitL(txt)){
    const m=ln.match(/^(.+?)\s*[:=+]?\s*\+?(\d+)\s*$/),b=m&&map[nzs(m[1])],v=m?parseInt(m[2]):0;
    if(b&&v>0)out.push({t:b.t,k:b.k,v:Math.min(99,v)});else bad.push(ln);
  }
  if(bad.length)toast('Bonus non riconosciuto: '+bad.slice(0,3).join(' | '));
  return out.slice(0,20);
}

/* ===== v19: oggetti utilizzabili con costo in NEXUS / HP (anche infiniti) ===== */
const COSTF=[{l:'Costo in NEXUS a ogni uso (0 = nessuno; con un costo l\'oggetto è utilizzabile anche se infinito)',n:'cnx',t:'number'},{l:'Costo in HP a ogni uso (0 = nessuno)',n:'chp',t:'number'}];
const costClean=r=>({cnx:Math.min(9999,r.cnx||0),chp:Math.min(9999,r.chp||0)});
/* verifica che il player possa pagare il costo: restituisce l'aggiornamento (nx/hp) oppure null */
function payCost(p,e){
  const v=vit(p),cn=e.cnx|0,ch=e.chp|0;
  if(cn>v.n){toast('NEXUS insufficiente');return null}
  if(ch>v.h){toast('HP insufficienti');return null}
  const d={};if(cn>0)d.nx=v.n-cn;if(ch>0)d.hp=v.h-ch;return d;
}
function useItem(id){
  const p=me();if(!p)return;
  const inv=[...(p.inv||[])],i=inv.findIndex(e=>e.id===id);if(i<0)return;
  const e=inv[i];
  if(e.uses!=null&&e.uses<1)return;
  const d=payCost(p,e);if(!d)return;
  if(e.uses!=null){if(e.uses<=1)inv.splice(i,1);else inv[i]={...e,uses:e.uses-1};d.inv=inv}
  if(Object.keys(d).length)guard(db.collection('players').doc(uid).update(d));
  SND.play('use',1);toast('Usato: '+e.name+(costTxt(e)?' ('+costTxt(e)+')':''));
}

/* ===== v21: adattamento al dispositivo =====
   Riconosce telefono / tablet / desktop, orientamento, schermo stretto o basso, touch,
   e mette le classi dv-* su <html> (usate da styles.css). Usa la visualViewport reale
   (barra del browser, tastiera). In più "fitApp" misura i contenuti: se qualcosa sfora
   in larghezza su uno schermo piccolo, rimpicciolisce l'interfaccia fino a farla stare. */
const DEV={base:1,k:1};
function adaptDevice(){
  const de=document.documentElement,vv=window.visualViewport,w=Math.round(vv?vv.width:innerWidth),h=Math.round(vv?vv.height:innerHeight);
  const land=w>h,low=h<520,phone=w<600||(land&&low),set=(c,on)=>de.classList.toggle(c,!!on);
  set('dv-phone',phone);set('dv-tablet',!phone&&w<1024);set('dv-desk',!phone&&w>=1024);
  set('dv-land',land&&low);set('dv-narrow',w<360);set('dv-short',h<700);
  try{set('dv-touch',matchMedia('(pointer:coarse)').matches)}catch(e){}
  de.style.setProperty('--vh',h+'px');
  /* il disegno è pensato per ~390px di larghezza: sotto, scala in proporzione */
  DEV.base=(phone&&!(land&&low))?Math.max(.8,Math.min(1,w/390)):1;
  fitApp();
}
function fitApp(){
  if(!(window.CSS&&CSS.supports&&CSS.supports('zoom','1')))return;
  const hd=document.getElementById('hud'),zs=[app,hd],ap=v=>zs.forEach(e=>{if(e)e.style.zoom=v===1?'':String(v)});
  if(document.getElementById('mapcv')){ap(1);DEV.k=1;return} /* le mappe misurano il puntatore: niente zoom */
  let k=DEV.base;ap(k);let n=0;
  while(n++<12&&k>.7&&app.scrollWidth>app.clientWidth+1){k=+(k-.03).toFixed(3);ap(k)}
  DEV.k=k;
}
(()=>{
  let r=0;const go=()=>{if(!r)r=requestAnimationFrame(()=>{r=0;adaptDevice()})};
  addEventListener('resize',go);addEventListener('orientationchange',go);
  if(window.visualViewport)visualViewport.addEventListener('resize',go);
  let f=0;new MutationObserver(()=>{if(!f)f=requestAnimationFrame(()=>{f=0;fitApp()})}).observe(app,{childList:true});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(go);
  adaptDevice();
})();

/* ===== v20: cortocircuito del dispositivo (lo lancia il Master) ===== */
let shortDone=null,shortOpen=false;const SHORT_DEF='IL NEXUS STA INONDANDO IL CIRCUITO',SHORT_O=['Riavvia il sistema','Resisti'];
let ansSeen=null;
function checkShortAns(){
  if(!LD.players)return;
  if(!ansSeen){ansSeen={};Object.entries(S.players).forEach(([id,p])=>ansSeen[id]=(p.shortAns&&p.shortAns.ts)||0);return}
  Object.entries(S.players).forEach(([id,p])=>{const t=(p.shortAns&&p.shortAns.ts)||0;if(t>(ansSeen[id]||0)){ansSeen[id]=t;SND.play('msg',1);toast('⚡ '+p.username+' ha scelto: '+p.shortAns.o)}});
}
let chatSeen=null;
function checkChatM(){
  if(!LD.msgs)return;
  const l=Object.values(S.msgs).filter(m=>(m.to||[]).includes('@master'));
  if(!chatSeen){chatSeen=new Set(l.map(m=>m.id));return}
  l.forEach(m=>{if(chatSeen.has(m.id))return;chatSeen.add(m.id);SND.play('msg',1);toast('✉️ '+((m.from&&m.from.name)||'?')+' ha scritto a '+((m.toNpc||[]).map(i=>S.npcs[i]?S.npcs[i].name:'?').join(', ')||'?'))});
}
function checkShort(){
  const p=me();if(!p||!authed||!LD.players)return;
  const t=+p.short||0;
  if(!shortDone||shortDone.u!==uid){shortDone={u:uid,t};return} /* al primo accesso non rigioca i vecchi */
  if(shortOpen||t<=shortDone.t)return;
  shortDone.t=t;runShort(p.shortMsg,p.shortO);
}
function runShort(msg,os){
  shortOpen=true;const msgT=String(msg||'').trim().slice(0,200)||SHORT_DEF,opts=[0,1].map(i=>String((os&&os[i])||SHORT_O[i]).trim().slice(0,40)||SHORT_O[i]);
  if(!document.getElementById('scstyle')){
    const st=document.createElement('style');st.id='scstyle';
    st.textContent=`.shortc{position:fixed;inset:0;z-index:200;overflow:hidden;background:transparent}
.shortc canvas{position:absolute;inset:0;width:100%;height:100%}
.scflash{position:absolute;inset:0;background:#fff;opacity:0}
.shortc.p1 .scflash{animation:scfl .2s steps(2) infinite}
@keyframes scfl{0%{opacity:0}30%{opacity:.8}60%{opacity:.05}100%{opacity:.45}}
html.sc-shake #win,html.sc-shake #taskbar{animation:scshake .1s steps(2) infinite!important}
@keyframes scshake{0%{transform:translate(-6px,3px) skewX(2deg)}50%{transform:translate(7px,-4px) skewX(-3deg)}100%{transform:translate(-3px,-5px)}}
html.sc-shake #desk{filter:hue-rotate(160deg) saturate(2.4) contrast(1.3);animation:scflick .14s steps(2) infinite}
@keyframes scflick{50%{filter:invert(1) hue-rotate(90deg) brightness(1.4)}}
.shortc.p2,.shortc.p3{background:#000}
.shortc.p2 .scflash,.shortc.p3 .scflash{display:none}
.scline{position:absolute;left:0;right:0;top:0;height:100%;background:#fff;box-shadow:0 0 30px 8px #4db3ff;transform-origin:50% 50%;opacity:0}
.shortc.p2 .scline{animation:scoff .7s steps(8) forwards}
@keyframes scoff{0%{opacity:1;transform:scale(1,1)}60%{opacity:1;transform:scale(1,.01)}100%{opacity:0;transform:scale(0,.01)}}
.scmsg{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;gap:30px}
.shortc.p3 .scmsg{display:flex}
.sct{font:400 clamp(13px,4.2vw,26px)/1.7 var(--f-px);color:var(--acc-2);text-shadow:3px 0 #ff2a55,-3px 0 #2affea,0 0 24px var(--acc);letter-spacing:2px;max-width:92%;min-height:3.4em;white-space:pre-wrap;overflow-wrap:anywhere}
.shortc.p3 .sct{animation:scgl 1.4s steps(1) infinite}
@keyframes scgl{0%{transform:translate(0)}10%{transform:translate(-4px,2px) skewX(6deg)}20%{transform:none}55%{transform:translate(5px,-2px);opacity:.7}60%{transform:none;opacity:1}}
.scopts{display:none;gap:16px;flex-wrap:wrap;justify-content:center;width:100%;max-width:520px}
.shortc.p4 .scopts{display:flex;animation:itpop .3s steps(5) both}
.scopts button{min-width:150px;font-size:1.05em;padding:12px 20px 13px}
.shortc.out{opacity:0;transition:opacity .5s}`;
    document.head.append(st);
  }
  const ov=document.createElement('div');ov.className='shortc p1';
  ov.innerHTML='<canvas></canvas><div class="scflash"></div><div class="scline"></div><div class="scmsg"><div class="sct"></div><div class="scopts"></div></div>';
  document.body.append(ov);
  document.documentElement.classList.add('sc-shake');
  SND.play('short',1);
  if(navigator.vibrate)try{navigator.vibrate([120,60,120,60,400,100,900])}catch(e){}
  /* fulmini */
  const cv=ov.querySelector('canvas'),c=cv.getContext('2d');cv.width=innerWidth;cv.height=innerHeight;
  const bolt=()=>{
    c.clearRect(0,0,cv.width,cv.height);
    const k=1+Math.floor(Math.random()*3);
    for(let i=0;i<k;i++){
      let x=Math.random()*cv.width,y=0;c.beginPath();c.moveTo(x,y);
      while(y<cv.height){y+=15+Math.random()*40;x+=(Math.random()-.5)*110;c.lineTo(x,y)}
      c.lineWidth=2+Math.random()*3;c.strokeStyle='#fff';c.shadowColor='#4db3ff';c.shadowBlur=18;c.stroke();
    }
    for(let i=0;i<14;i++){c.fillStyle=Math.random()<.5?'#ffcb3d':'#fff';c.fillRect(Math.random()*cv.width,Math.random()*cv.height,2+Math.random()*4,2+Math.random()*4)}
  };
  const bi=setInterval(bolt,90);bolt();
  let ty=null,ph=1,closed=false;const nch=Array.from(msgT).length,tdur=nch*Math.max(45,Math.min(95,Math.floor(13000/nch)));
  const T=[];
  T.push(setTimeout(()=>{ /* lo schermo si spegne come un vecchio CRT */
    clearInterval(bi);c.clearRect(0,0,cv.width,cv.height);
    document.documentElement.classList.remove('sc-shake');
    ov.classList.remove('p1');ov.classList.add('p2');ph=2;
  },2600));
  T.push(setTimeout(()=>{ /* messaggio */
    ov.classList.remove('p2');ov.classList.add('p3');ph=3;
    ty=typeInto(ov.querySelector('.sct'),msgT,true);
  },3500));
  T.push(setTimeout(()=>{ov.classList.add('p4');ph=4},3500+tdur+900));
  const close=ch=>{
    if(closed)return;closed=true;T.forEach(clearTimeout);clearInterval(bi);
    if(ty)ty.stop();
    document.documentElement.classList.remove('sc-shake');
    SND.play('login',1);ov.classList.add('out');
    setTimeout(()=>{ov.remove();shortOpen=false;setTimeout(()=>applyShortEgo(ch),500)},520);
  };
  const op=ov.querySelector('.scopts');
  opts.forEach((lab,i)=>{const b=document.createElement('button');if(i)b.className='g';b.textContent=lab;b.onclick=e=>{e.stopPropagation();if(ph<4)return;const pl=me();if(pl&&authed)guard(db.collection('players').doc(uid).update({shortAns:{i,o:lab,ts:Date.now()}}));close(i)};op.append(b)});
  T.push(setTimeout(close,180000));
}

/* ===== v26: nuova parte EGO svelata in automatico dopo un cortocircuito (la prepara il Master) ===== */
async function applyShortEgo(ch){
  const p=me();if(!p||!authed||!db)return;
  const g=p.shortEgo;if(!g||!g.t)return;
  const want=g.o==null?2:+g.o; /* 0 = prima risposta, 1 = seconda, 2 = qualsiasi */
  if(want<2&&ch!==want){ /* ha scelto l'altra risposta: la parte EGO non arriva. Se non ha risposto, resta in attesa */
    if(ch===0||ch===1)guard(db.collection('players').doc(uid).update({shortEgo:{t:'',e:'',n:'',o:2}}));
    return;
  }
  const t=String(g.t).slice(0,80);
  const ok=await guard(db.collection('players').doc(uid).update({egoX:[...(p.egoX||[]),{id:uid8(),t,e:String(g.e||'').slice(0,1500)}],shortEgo:{t:'',e:'',n:'',o:2}}).then(()=>1));
  if(!ok)return;
  const id=uid8(),def='Una nuova parte del tuo EGO è stata svelata: «'+t+'»';
  await guard(db.collection('msgs').doc(id).set({id,to:[uid],from:{t:'sys',name:'SISTEMA'},kind:'ego',text:String(g.n||'').trim().slice(0,600)||def,ts:Date.now()}));
}
/* ===== v24: il Master modifica tutto del player (EGO e categorie, descrizione, skill, inventario) ===== */
const egoMasterCard=(id,p)=>{const g=egoOf(p),X=p.egoX||[];return `<div class="ego" style="animation:none"><div class="row sp"><span class="lab">⚡ EGO</span><div class="row"><button class="g mini" data-xego="${id}">✎ EGO</button><button class="mini" data-xxa="${id}">+ Categoria</button></div></div>${p.shortEgo&&p.shortEgo.t?`<div class="move" style="border-left-color:var(--warn)"><div class="grow">⚡ Si svelerà ${(p.shortEgo.o===0||p.shortEgo.o===1)?'se sceglie «'+esc((p.shortO||[])[p.shortEgo.o]||SHORT_O[p.shortEgo.o])+'»':'dopo il prossimo cortocircuito'}: <b>${esc(p.shortEgo.t)}</b></div><button class="d mini" data-xsc="${id}" title="Annulla">✕</button></div>`:''}${g.t||g.e?`<div class="et">${esc(g.t)}</div><p style="white-space:pre-wrap;margin:4px 0">${esc(g.e)}</p>`:'<p class="mut">Nessun EGO scritto.</p>'}${X.map(x=>`<div class="move" style="border-left-color:var(--acc2)"><div class="grow"><b>${esc(x.t)}</b> ${x.h?'<span class="tag">🙈 nascosta al player</span>':'<span class="tag">👁 visibile</span>'}<p style="white-space:pre-wrap;margin:4px 0 0">${esc(x.e)}</p></div><div class="row" style="gap:4px;flex-direction:column"><button class="g mini" data-xxh="${id}|${x.id}" title="${x.h?'Mostra al player':'Nascondi al player'}">${x.h?'👁':'🙈'}</button><button class="g mini" data-xxe="${id}|${x.id}">✎</button><button class="d mini" data-xxd="${id}|${x.id}">🗑</button></div></div>`).join('')}</div>`};
const mxDesc=(id,p)=>`<div class="card"><div class="row sp"><h3>🏕️ DESCRIZIONE PARTY</h3><button class="g mini" data-xpd="${id}">✎</button></div><p class="mut" style="white-space:pre-wrap;margin:6px 0 0">${p.pdesc?esc(p.pdesc):'Nessuna descrizione.'}</p></div>`;
const mxSkills=(id,p)=>`<div class="card"><div class="row sp"><h3>🗡️ SKILL</h3><button class="mini" data-xsa="${id}">+ Mossa</button></div>${(p.skills||[]).map((s,i)=>`<div>${skillCard(s,-1,null)}<div class="row" style="gap:6px;margin-top:6px"><button class="g mini grow" data-xse="${id}|${i}">✎ Modifica</button><button class="d mini" data-xsd="${id}|${i}">🗑</button></div></div>`).join('')||'<p class="mut">Nessuna skill per ora.</p>'}</div>`;
const mxInv=(id,p)=>`<div class="card"><div class="row sp"><h3>🎒 INVENTARIO</h3><button class="mini" data-xia="${id}">+ Oggetto</button></div>${(p.inv||[]).map(e=>`<div class="move" style="border-left-color:var(--acc2)"><div style="font-size:1.6em">${e.photo?itImg(e.photo,44):(CATI[e.cat]||'🎁')}</div><div class="grow"><b>${esc(e.name)}</b><div class="mut">${CATL[e.cat]||'Oggetto'} · ${e.uses==null?'♾ Infinito':e.uses+(e.uses===1?' uso':' usi')}${bonusesOf(e).length?` · <span style="color:var(--ok)">${bonusTxt(e)}</span>`:''}${e.cat==='armatura'&&e.arm?` · <span style="color:var(--ok)">🛡️ −${e.arm} danni</span>`:''}${dmgHtml(e)}</div>${e.desc?`<div class="mut" style="white-space:pre-wrap">${esc(e.desc)}</div>`:''}</div><div class="row" style="gap:4px;flex-direction:column"><button class="g mini" data-xie="${id}|${e.id}">✎</button><button class="d mini" data-xid="${id}|${e.id}">🗑</button></div></div>`).join('')||'<p class="mut">Inventario vuoto.</p>'}</div>`;
function rebindMX(){
  const U=(id,d)=>guard(db.collection('players').doc(id).update(d));
  const on=(a,fn)=>app.querySelectorAll(`[data-${a}]`).forEach(b=>b.onclick=()=>fn(b.dataset[a]));
  const skD=r=>({n:r.n.slice(0,60),c:r.c,e:r.e.slice(0,600),dmg:r.dmg.slice(0,60),dur:r.dur.slice(0,60),...dmgClean({...r,dfix:0},true)});
  on('xego',async id=>{const p=S.players[id];if(!p)return;const r=await ask('EGO di '+p.username,[{l:'Titolo',n:'t'},{l:'Effetto',n:'e',t:'area'}],egoOf(p));if(r)U(id,{ego:{t:r.t.slice(0,80),e:r.e.slice(0,1500)}})});
  const XF=[{l:'Nome categoria',n:'t'},{l:'Testo',n:'e',t:'area'},{l:'Visibile al player',n:'vis',t:'select',o:['sì','no']}],hv=r=>r.vis==='no'?{h:1}:{};
  /* quando una parte dell'EGO diventa visibile: notifica al player, con testo modificabile dal Master (o niente notifica) */
  const egoNotify=async(pid,name)=>{
    const p=S.players[pid];if(!p)return;
    const def='Una nuova parte del tuo EGO è stata svelata: «'+name+'»';
    const r=await ask('🔔 Notifica a '+p.username,[{l:'Invia una notifica al player',n:'send',t:'select',o:['sì','no']},{l:'Testo della notifica (modificabile)',n:'text',t:'area'}],{send:'sì',text:def},'Conferma');
    if(!r||r.send==='no')return;
    const id=uid8();
    const ok=await guard(db.collection('msgs').doc(id).set({id,to:[pid],from:{t:'sys',name:'SISTEMA'},kind:'ego',text:(r.text||'').slice(0,600)||def,ts:Date.now()}).then(()=>1));
    if(ok)toast('🔔 Notifica inviata a '+p.username);else toast('Notifica NON inviata a '+p.username);
  };
  on('xsc',id=>U(id,{shortEgo:{t:'',e:'',n:'',o:2}}));
  on('xxa',async id=>{const p=S.players[id];if(!p)return;const r=await ask('Nuova categoria EGO',XF,{vis:'sì'});if(!r||!r.t)return;const t=r.t.slice(0,80);await U(id,{egoX:[...(p.egoX||[]),{id:uid8(),t,e:r.e.slice(0,1500),...hv(r)}]});if(r.vis!=='no')egoNotify(id,t)});
  on('xxe',async k=>{const [id,xid]=k.split('|'),p=S.players[id],x=p&&(p.egoX||[]).find(z=>z.id===xid);if(!x)return;const r=await ask('Modifica categoria EGO',XF,{...x,vis:x.h?'no':'sì'});if(!r||!r.t)return;const t=r.t.slice(0,80);await U(id,{egoX:p.egoX.map(z=>z.id===xid?{id:z.id,t,e:r.e.slice(0,1500),...hv(r)}:z)});if(x.h&&r.vis!=='no')egoNotify(id,t)});
  on('xxh',async k=>{const [id,xid]=k.split('|'),p=S.players[id],x=p&&(p.egoX||[]).find(z=>z.id===xid);if(!x)return;await U(id,{egoX:p.egoX.map(z=>{if(z.id!==xid)return z;const {h,...rest}=z;return z.h?rest:{...rest,h:1}})});if(x.h)egoNotify(id,x.t)});
  on('mxe',async id=>{const m=S.msgs[id];if(!m)return;const r=await ask('Modifica messaggio',[{l:'Testo',n:'text',t:'area'}],{text:m.text});if(r&&r.text)guard(db.collection('msgs').doc(id).update({text:r.text.slice(0,600)}))});
  on('xxd',async k=>{const [id,xid]=k.split('|'),p=S.players[id];if(p&&await askYes('Eliminare questa categoria EGO?'))U(id,{egoX:(p.egoX||[]).filter(z=>z.id!==xid)})});
  on('xpd',async id=>{const p=S.players[id];if(!p)return;const r=await ask('Descrizione di '+p.username,[{l:'Descrizione',n:'pdesc',t:'area'}],p);if(r)U(id,{pdesc:r.pdesc.slice(0,600)})});
  on('xsa',async id=>{const p=S.players[id];if(!p)return;const r=await ask('Nuova skill per '+p.username,SKF,{c:0,dt:'d6'});if(r&&r.n)U(id,{skills:[...(p.skills||[]),skD(r)]})});
  on('xse',async k=>{const [id,i]=k.split('|'),p=S.players[id],s=p&&(p.skills||[])[+i];if(!s)return;const r=await ask('Modifica skill',SKF,{...s,dt:s.dt||'d6',e:s.e??s.d??''});if(r&&r.n){const l=[...p.skills];l[+i]=skD(r);U(id,{skills:l})}});
  on('xsd',async k=>{const [id,i]=k.split('|'),p=S.players[id];if(p&&await askYes('Rimuovere questa skill?'))U(id,{skills:(p.skills||[]).filter((_,j)=>j!==+i)})});
  on('xia',async id=>{const p=S.players[id];if(!p)return;const r=await ask('Nuovo oggetto per '+p.username,IF(),{cat:'oggetto',use:'infinito',bk:'nessuno',dt:'d6'});if(r&&r.name){const o=await invSave(r);U(id,{inv:[...(p.inv||[]),{id:uid8(),it:'',...o}]})}});
  on('xie',async k=>{const [id,iid]=k.split('|'),p=S.players[id],e=p&&(p.inv||[]).find(x=>x.id===iid);if(!e)return;const r=await ask('Modifica oggetto',IF(),{...e,use:e.uses==null?'infinito':'utilizzabile',uses:e.uses||0,bks:bonusInit(e),...dmgInit(e)});if(r&&r.name){const o=await invSave(r,e);U(id,{inv:p.inv.map(x=>x.id===iid?{...x,...o}:x)})}});
  on('xid',async k=>{const [id,iid]=k.split('|'),p=S.players[id];if(p&&await askYes('Rimuovere questo oggetto dall\'inventario?'))U(id,{inv:(p.inv||[]).filter(x=>x.id!==iid)})});
}
/* ===== SCANNER: bestiario + animazione di scansione =====
   Dati: collezione 'bestiary' (una creatura per documento, inserita dal Master).
   Il player preme «Usa scanner» → scrive sul proprio profilo  scan:{t, known:[creature già note]}.
   L'animazione resta finché il Master segna una creatura come «scannerizzata» (scanned:true):
   a quel punto parte l'aggancio e poi la rivelazione progressiva delle informazioni. */
const SC={mode:null,W:null,iv:null,t0:0,sel:null,fresh:null,req:new Set(),reqInit:false};
const SC_SEC=[['tipo','🧬','TIPOLOGIA','t'],['bioma','🌍','BIOMA','t'],['carattere','🧠','CARATTERE / COMPORTAMENTO','p'],['forza','💪','PUNTI DI FORZA','l'],['deboli','🎯','PUNTI DEBOLI','w'],['drop','💎','MATERIALI / DROP','l'],['lore','📖','LORE','p']];
const SC_COR='<i class="sc-cor a"></i><i class="sc-cor b"></i><i class="sc-cor c"></i><i class="sc-cor d"></i>';
const scWeak=s=>splitL(s).map(l=>{const i=l.indexOf(':');return i>0?{z:l.slice(0,i).trim().slice(0,60),d:l.slice(i+1).trim().slice(0,200)}:{z:l.slice(0,60),d:''}});
const scWeakTxt=a=>(a||[]).map(w=>w.d?w.z+': '+w.d:w.z).join('\n');
const scSecs=c=>SC_SEC.map(([k,i,l,t])=>({k,i,l,t,v:c[k]})).filter(s=>Array.isArray(s.v)?s.v.length:s.v);
const scU=d=>guard(db.collection('players').doc(uid).update(d));
/* creature che il player può vedere (già scannerizzate dal Master), le più recenti per prime */
function scList(){return Object.values(S.bestiary||{}).filter(c=>c.scanned&&(!(c.to&&c.to.length)||c.to.includes(uid))).sort((a,b)=>(b.scanAt||0)-(a.scanAt||0))}
function scanList(){return scList()}
const scBody=s=>s.t==='l'?`<ul class="scl">${s.v.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`
  :s.t==='w'?`<ul class="scl scw">${s.v.map(w=>`<li><b>${esc(w.z)}</b>${w.d?`<span>${esc(w.d)}</span>`:''}</li>`).join('')}</ul>`
  :`<p class="scv">${esc(s.v)}</p>`;
const scSecHtml=(s,anim)=>`<div class="card scsec ${s.t}"${anim?'':' style="animation:none"'}><h3>${s.i} ${s.l}</h3>${scBody(s)}</div>`;
const scPhoto=c=>`<div class="sc-ph st">${c.photo?`<img src="${esc(c.photo)}" alt="">`:'👾'}</div>`;
const scDossier=c=>`<div class="card" style="text-align:center">${scPhoto(c)}<h2 style="margin:0">${esc(c.name)}</h2></div>`+(scSecs(c).map(s=>scSecHtml(s,0)).join('')||'<p class="mut">Nessun dato disponibile.</p>');

/* macchina da scrivere veloce (max ~2 secondi a testo) */
function scType(el,txt,cb){
  const ch=Array.from(txt),per=Math.max(1,Math.ceil(ch.length/110));let i=0,k=0;
  if(REDM()){el.textContent=txt;if(cb)cb();return{stop(){}}}
  el.classList.add('typing');
  const t=setInterval(()=>{i=Math.min(ch.length,i+per);el.textContent=ch.slice(0,i).join('');if(++k%3===0)SND.play('type');if(i>=ch.length){clearInterval(t);el.classList.remove('typing');if(cb)cb()}},22);
  return{stop(){clearInterval(t);el.classList.remove('typing')}};
}
/* overlay a schermo intero (sopra l'app, sotto le finestre di dialogo) */
function scOv(cls){const o0=document.getElementById('scov');if(o0)o0.remove();const o=document.createElement('div');o.id='scov';o.className=cls;document.body.append(o);return o}
function scKill(){
  const W=SC.W;if(W){W.t.forEach(clearTimeout);W.iv.forEach(clearInterval);if(W.ty)W.ty.stop()}
  SC.W=null;if(SC.iv){clearInterval(SC.iv);SC.iv=null}SC.mode=null;
  const o=document.getElementById('scov');if(o)o.remove();
}

/* ---- 1) animazione di scansione (finché il Master non risponde) ---- */
function scScan(){
  scKill();SC.mode='scan';SC.t0=Date.now();
  const o=scOv('scov sc');
  o.innerHTML=`${SC_COR}<div class="sc-in"><div class="sc-radar"><i class="sc-ring"></i><b class="sc-beam"></b><s class="sc-blip b1"></s><s class="sc-blip b2"></s><s class="sc-blip b3"></s><span class="sc-q">?</span></div><div class="sc-title">SCANSIONE IN CORSO</div><div class="sc-sig"><i></i></div><div class="sc-log" id="scLg"></div><p class="mut sc-wait">In attesa dei risultati<span class="dots"></span></p><button class="g sc-cancel" id="scX">✕ Annulla scansione</button></div>`;
  const L=['Calibrazione sensori NEXUS','Campionamento spettro biologico','Triangolazione del bersaglio','Mappatura della struttura corporea','Lettura della firma energetica','Interrogazione degli archivi','Decodifica del segnale','Analisi comportamentale','Ricerca punti di debolezza'];
  const lg=o.querySelector('#scLg');let n=0;
  const step=()=>{const d=document.createElement('div');lg.append(d);while(lg.children.length>4)lg.firstChild.remove();scType(d,'> '+L[n++%L.length]+'…');if(n%3===1)SND.play('nx',1)};
  step();SC.iv=setInterval(step,1500);
  o.querySelector('#scX').onclick=()=>{scKill();scU({scan:null})};
  SND.play('open',1);
}
/* ---- 2) aggancio: il Master ha risposto ---- */
function scLock(c){
  SC.mode='lock';
  const o=document.getElementById('scov');
  if(o){o.classList.add('lock');const t=o.querySelector('.sc-title');if(t)t.textContent='▣ BERSAGLIO AGGANCIATO';const w=o.querySelector('.sc-wait');if(w)w.textContent='Segnale ricevuto';if(navigator.vibrate)try{navigator.vibrate([40,30,40])}catch(e){}}
  SND.play('alarm',1);
  setTimeout(()=>{if(SC.mode==='lock')scReveal(c)},1400);
}
/* ---- 3) rivelazione progressiva delle informazioni ---- */
function scReveal(c,kind){
  scKill();
  const W=SC.W={t:[],iv:[],ty:null};SC.mode=kind==='preview'?'preview':'reveal';
  const o=scOv('scov rv'),secs=scSecs(c),T=(f,ms)=>W.t.push(setTimeout(f,ms));
  o.innerHTML=`${SC_COR}<div class="sc-flash"></div><div class="sc-in"><div class="sc-ok">✔ SCANSIONE COMPLETATA</div><div class="sc-ph">${c.photo?`<img src="${esc(c.photo)}" alt="">`:'👾'}</div><h2 class="sc-name" id="scNm"></h2><div id="scSecs"></div><div class="sc-act"><button class="g grow" id="scSk">⏭ Salta</button><button class="grow" id="scDn" style="display:none">${kind==='preview'||kind==='replay'?'✔ Chiudi':'📚 Apri nel Bestiario'}</button></div></div>`;
  const box=o.querySelector('#scSecs'),nm=o.querySelector('#scNm'),sk=o.querySelector('#scSk'),dn=o.querySelector('#scDn');
  const stop=()=>{W.t.forEach(clearTimeout);W.iv.forEach(clearInterval);if(W.ty)W.ty.stop()};
  const stick=()=>{if(o.scrollHeight-o.scrollTop-o.clientHeight<240)o.scrollTop=o.scrollHeight};
  W.iv.push(setInterval(stick,250));
  const fin=()=>{stop();sk.style.display='none';dn.style.display='';SND.play('fanfare',1);if(navigator.vibrate)try{navigator.vibrate([30,40,60])}catch(e){}setTimeout(()=>{o.scrollTop=o.scrollHeight},60)};
  let i=0;
  const next=()=>{
    if(i>=secs.length)return fin();
    const s=secs[i++],card=document.createElement('div');
    card.className='card scsec '+s.t;
    card.innerHTML=`<h3>${s.i} ${s.l}</h3><div class="scdec"><span>DECIFRAZIONE</span><i></i></div>`;
    box.append(card);SND.play('pin',1);
    T(()=>{
      const body=document.createElement('div');card.querySelector('.scdec').replaceWith(body);
      if(s.t==='l'||s.t==='w'){
        const ul=document.createElement('ul');ul.className='scl'+(s.t==='w'?' scw':'');body.append(ul);
        s.v.forEach((x,j)=>T(()=>{const li=document.createElement('li');li.innerHTML=s.t==='w'?`<b>${esc(x.z)}</b>${x.d?`<span>${esc(x.d)}</span>`:''}`:esc(x);ul.append(li);SND.play(s.t==='w'?'alarm':'pin',1)},j*280));
        T(next,s.v.length*280+550);
      }else{
        const p=document.createElement('p');p.className='scv';body.append(p);
        W.ty=scType(p,s.v,()=>T(next,500));
      }
    },850);
  };
  SND.play('enc',1);T(()=>SND.play('nx',1),500);
  T(()=>{W.ty=scType(nm,c.name)},1500);
  T(next,2700+Math.min(900,c.name.length*30));
  sk.onclick=()=>{stop();nm.textContent=c.name;box.innerHTML=secs.map(s=>scSecHtml(s,0)).join('');sk.style.display='none';dn.style.display=''};
  dn.onclick=()=>{scKill();if(kind==='preview')return;SC.sel=c.id;view={name:'scanner'};render()};
}

/* ---- animazione «dispositivo migliorato» (quando il Master abilita lo scanner) ---- */
function scUpgrade(){
  scKill();SC.mode='upgrade';
  const W=SC.W={t:[],iv:[],ty:null},T=(f,ms)=>W.t.push(setTimeout(f,ms)),o=scOv('scov sc up');
  o.innerHTML=`${SC_COR}<div class="sc-flash"></div><div class="sc-in"><div class="sc-title" id="upT">AGGIORNAMENTO DISPOSITIVO</div><div class="up-chip" id="upC">📟</div><div id="upW"><div class="up-bar"><i id="upB"></i></div><div class="up-pct" id="upP">0%</div><div class="sc-log" id="upL"></div></div><div id="upR" style="display:none"><div class="sc-radar sm"><b class="sc-beam"></b><span class="sc-q">?</span></div><div class="sc-ok" style="margin-top:16px">NUOVO MODULO SBLOCCATO</div><h2 class="sc-name" style="margin-bottom:6px">🔍 SCANNER</h2><p class="mut" style="text-align:center;margin:0 0 16px">Il tuo dispositivo è stato migliorato: ora puoi analizzare le creature sconosciute dalla tessera Scanner.</p></div><div class="sc-act"><button class="g grow" id="upS">⏭ Salta</button><button class="grow" id="upD" style="display:none">✔ Continua</button></div></div>`;
  const B=o.querySelector('#upB'),P=o.querySelector('#upP'),L=o.querySelector('#upL'),S=o.querySelector('#upS'),D=o.querySelector('#upD');
  const msgs=[[0,'Rilevato nuovo hardware'],[18,'Download modulo SCANNER'],[40,'Installazione driver'],[62,'Calibrazione sensori NEXUS'],[82,'Test del raggio di scansione'],[95,'Sincronizzazione dispositivo']];
  let k=0,pc=0;
  const done=()=>{
    W.iv.forEach(clearInterval);W.t.forEach(clearTimeout);
    B.style.width='100%';
    o.querySelector('#upW').style.display='none';o.querySelector('#upR').style.display='';
    o.querySelector('#upT').textContent='✔ DISPOSITIVO MIGLIORATO';o.querySelector('#upC').style.display='none';
    S.style.display='none';D.style.display='';
    const f=document.createElement('div');f.className='sc-flash';o.append(f);
    SND.play('fanfare',1);if(navigator.vibrate)try{navigator.vibrate([30,40,60])}catch(e){}
  };
  SND.play('open',1);
  const t0=performance.now(),DUR=4200;
  W.iv.push(setInterval(()=>{
    pc=Math.min(100,Math.round((performance.now()-t0)/DUR*100));B.style.width=pc+'%';P.textContent=pc+'%';
    while(k<msgs.length&&pc>=msgs[k][0]){const d=document.createElement('div');L.append(d);while(L.children.length>4)L.firstChild.remove();scType(d,'> '+msgs[k][1]+'…');if(k%2===0)SND.play('pin',1);k++}
    if(pc>=100){clearInterval(W.iv[0]);T(done,350)}
  },60));
  S.onclick=done;
  D.onclick=()=>{scKill();render()};
}
/* ---- sincronizzazione: parte/si ferma l'animazione in base ai dati ---- */
function scanSync(){
  const M=masterOK&&view.name==='master';
  if(M){
    if(SC.mode&&SC.mode!=='preview')scKill();
    const k=Object.entries(S.players).filter(([i,p])=>p.scan&&p.scan.t).map(([i,p])=>i+':'+p.scan.t);
    const fresh=k.filter(x=>!SC.req.has(x));SC.req=new Set(k);
    if(fresh.length&&SC.reqInit){toast('🔍 '+fresh.map(x=>(S.players[x.split(':')[0]]||{}).username||'?').join(', ')+' sta usando lo scanner');SND.play('msg',1)}
    SC.reqInit=true;return;
  }
  SC.reqInit=false;SC.req=new Set();
  if(SC.mode==='preview')scKill();
  if(!db||!authed||!me()){if(SC.mode)scKill();return}
  const pp=me();
  if(!pp.scanner){if(SC.mode)scKill();return}
  if(SC.mode==='upgrade')return;
  if(!pp.scanUp){scUpgrade();scU({scanUp:true});return} /* prima volta con lo scanner: animazione di aggiornamento */
  if(SC.mode==='lock'||SC.mode==='reveal')return;
  const p=me(),s=p.scan;
  if(s&&s.t){
    const kn=s.known||[],c=scList().find(x=>!kn.includes(x.id));
    if(c){
      if(SC.mode!=='scan')scScan();
      const seen=new Set([...((p.viewed&&p.viewed.scanner)||[]),...scList().map(x=>x.id)]);
      scU({scan:null,viewed:{...(p.viewed||{}),scanner:[...seen]}});
      scLock(c);return;
    }
    if(SC.mode!=='scan')scScan();
  }else if(SC.mode==='scan'&&Date.now()-SC.t0>6000)scKill(); /* annullata altrove */
}
{const _r2=render;render=function(){_r2();scanSync()}}

/* ---- schermata del player: bestiario + pulsante scanner ---- */
function scanPlayer(){
  const p=me(),L=scList(),sel=SC.sel&&L.find(c=>c.id===SC.sel);
  if(sel){
    app.innerHTML=hdr('🔍 '+esc(sel.name),1)+scDossier(sel)+`<button class="g" id="scRe" style="width:100%;margin-top:10px">▶ Rivedi la scansione</button>`;
    bind();$('#bk').onclick=()=>{SC.sel=null;render()};$('#scRe').onclick=()=>scReveal(sel,'replay');return;
  }
  const seen=(p.viewed&&p.viewed.scanner)||[];SC.fresh=SC.fresh||new Set();L.forEach(c=>{if(!seen.includes(c.id))SC.fresh.add(c.id)});
  app.innerHTML=hdr('🔍 Scanner',1)+`<div class="card scdev"><div class="sc-radar sm"><b class="sc-beam"></b><span class="sc-q">?</span></div><p class="mut" style="margin:12px 0">Davanti a una creatura sconosciuta? Attiva lo scanner e attendi i risultati dell'analisi.</p><button id="scGo" style="width:100%">📡 USA SCANNER</button></div><h3>📚 Bestiario · ${L.length}</h3>`+
    (L.map(c=>`<div class="card row" data-bsc="${c.id}">${av(c)}<div class="grow"><b>${esc(c.name)}</b> ${SC.fresh.has(c.id)?'<span class="tag" style="color:var(--ok)">NUOVO</span>':''}<div class="mut">${esc(c.tipo||'—')} · ${esc(c.bioma||'—')}</div></div>›</div>`).join('')||'<p class="mut">Nessuna creatura scansionata finora.</p>');
  bind();
  app.querySelectorAll('[data-bsc]').forEach(x=>x.onclick=()=>{SC.sel=x.dataset.bsc;render()});
  $('#scGo').onclick=()=>{if(SC.mode)return;scScan();scU({scan:{t:Date.now(),known:scList().map(x=>x.id)}})};
  markViewed('scanner');
}
{const _rb=renderBoard;renderBoard=function(){if(view.name==='scanner'&&!(me()&&me().scanner)){view={name:'home'};return render()}if(view.name!=='scanner'){SC.sel=null;SC.fresh=null;return _rb()}return scanPlayer()}}

/* ---- pannello Master: gestione creature ---- */
const scF=()=>[{l:'Nome',n:'name'},{l:'Foto (max 2 MB)',n:'photo',t:'file'},{l:'Tipologia (es. Bestia, Non-morto, Costrutto…)',n:'tipo'},{l:'Bioma / habitat',n:'bioma'},{l:'Carattere e comportamento',n:'carattere',t:'area'},{l:'Punti di forza (uno per riga)',n:'forza',t:'area'},{l:'Punti deboli per zona del corpo (uno per riga, formato «Zona: dettaglio», es. «Zampa sinistra: fragile al fuoco»)',n:'deboli',t:'area'},{l:'Materiali / Drop (uno per riga)',n:'drop',t:'area'},{l:'Lore',n:'lore',t:'area'},{l:'Chi la vede una volta scannerizzata (nessuno selezionato = tutti i player)',n:'to',t:'multi',o:Object.entries(S.players).map(([i,p])=>[i,p.username])}];
const scData=r=>({name:r.name.slice(0,80),tipo:r.tipo.slice(0,60),bioma:r.bioma.slice(0,60),carattere:r.carattere.slice(0,800),forza:splitL(r.forza).slice(0,12).map(x=>x.slice(0,160)),deboli:scWeak(r.deboli).slice(0,12),drop:splitL(r.drop).slice(0,15).map(x=>x.slice(0,160)),lore:r.lore.slice(0,1500),to:r.to||[]});
function scanMaster(){
  const C=db.collection('bestiary'),pend=Object.entries(S.players).filter(([i,p])=>p.scan&&p.scan.t),L=Object.values(S.bestiary||{}).sort((a,b)=>(b.scanAt||0)-(a.scanAt||0)||String(a.name).localeCompare(String(b.name)));
  app.innerHTML=hdr('🔍 Scanner',1)+
    (pend.length?`<div class="card sc-alert"><h3>📡 Scansione in corso</h3><div class="row" style="flex-wrap:wrap;gap:6px">${pend.map(([i,p])=>`<span class="pill">${esc(p.username)}</span>`).join('')}</div><p class="mut" style="margin:8px 0">Premi «Scannerizzata» su una creatura: ai player in attesa partirà la rivelazione.</p><button class="g mini" id="bsClr">✕ Annulla tutte le scansioni</button></div>`:'<p class="mut">Nessun player sta usando lo scanner.</p>')+
    `<div class="card"><h3>👥 Chi ha lo Scanner</h3><p class="mut" style="margin:0 0 6px">I player non lo hanno all'inizio: abilitalo tu quando vuoi.</p>${Object.entries(S.players).map(([i,p])=>`<div class="row sp" style="margin-top:8px"><b>${esc(p.username)}</b><button class="${p.scanner?'d':''} mini" data-bsg="${i}">${p.scanner?'Togli':'Dai lo scanner'}</button></div>`).join('')||'<p class="mut">Nessun player registrato.</p>'}</div>`+
    `<button id="bsAdd" style="width:100%">+ Nuova creatura</button>`+
    (L.map(c=>`<div class="card"><div class="row">${av(c)}<div class="grow"><b>${esc(c.name)}</b> ${c.scanned?'<span class="tag" style="color:var(--ok)">✔ scannerizzata</span>':'<span class="tag">🔒 nascosta ai player</span>'}<div class="mut">${esc(c.tipo||'—')} · ${esc(c.bioma||'—')}</div><div class="mut">👁 ${c.to&&c.to.length?c.to.map(i=>esc(S.players[i]?.username||'?')).join(', '):'Tutti i player'}</div></div></div><div class="row" style="margin-top:8px;flex-wrap:wrap">${c.scanned?`<button class="g grow" data-bsh="${c.id}">↩ Nascondi</button>`:`<button class="grow" data-bsr="${c.id}">✅ Scannerizzata${pend.length?' ('+pend.length+' in attesa)':''}</button>`}<button class="g" data-bsp="${c.id}" title="Anteprima animazione">▶</button><button class="g" data-bse="${c.id}">Modifica</button><button class="d" data-bsd="${c.id}">✕</button></div></div>`).join('')||'<p class="mut">Nessuna creatura nel bestiario: creane una.</p>');
  bind();
  const on=(a,fn)=>app.querySelectorAll(`[data-${a}]`).forEach(x=>x.onclick=()=>fn(x.dataset[a]));
  const clr=$('#bsClr');if(clr)clr.onclick=()=>pend.forEach(([i])=>guard(db.collection('players').doc(i).update({scan:null})));
  $('#bsAdd').onclick=async()=>{const r=await ask('Nuova creatura',scF(),{to:[]});if(!r||!r.name)return;const id=uid8(),photo=r.photo?await uploadPhoto(r.photo):'';guard(C.doc(id).set({id,...scData(r),photo,scanned:false,scanAt:0}))};
  on('bsg',id=>{const p=S.players[id];if(!p)return;guard(db.collection('players').doc(id).update(p.scanner?{scanner:false,scanUp:false,scan:null}:{scanner:true}));toast(p.scanner?'🔍 Scanner tolto a '+p.username:'🔍 Scanner dato a '+p.username)});
  on('bse',async id=>{const c=S.bestiary[id];if(!c)return;const r=await ask('Modifica creatura',scF(),{...c,forza:(c.forza||[]).join('\n'),deboli:scWeakTxt(c.deboli),drop:(c.drop||[]).join('\n'),to:c.to||[]});if(!r||!r.name)return;const ph=r.photo?await uploadPhoto(r.photo):'';guard(C.doc(id).update({...scData(r),...(ph?{photo:ph}:{})}))});
  on('bsr',id=>{const n=pend.length;guard(C.doc(id).update({scanned:true,scanAt:Date.now()}));toast('✅ Scannerizzata'+(n?' · rivelazione in partenza per '+n+' player':''))});
  on('bsh',id=>guard(C.doc(id).update({scanned:false})));
  on('bsp',id=>{const c=S.bestiary[id];if(c)scReveal(c,'preview')});
  on('bsd',async id=>{if(await askYes('Eliminare questa creatura dal bestiario?'))guard(C.doc(id).delete())});
}
{const _rm=renderMaster;renderMaster=function(){if(tab==='scanner')return scanMaster();return _rm()}}

/* ===== EVENTI =====
   Bacheca SOLO Master (collezione 'events'). Il Master avvia un evento → ai player visibili arriva una notifica animata
   → «Partecipa» apre la schermata dell'evento in corso (titolo e testo scritti, timer opzionale) finché il Master lo termina.
   Con «Più tardi» resta un chip in basso a sinistra per rientrare nell'evento. */
const EVK={
  generico:{i:'🎭',c:'var(--acc)',l:'EVENTO',s:'enc',h:0,p:'evento'},
  pericolo:{i:'⚠️',c:'#ff4d5e',l:'PERICOLO',s:'alarm',h:1,p:'evpericolo'},
  combattimento:{i:'⚔️',c:'#ff9a3d',l:'COMBATTIMENTO',s:'alarm',h:1,p:'evpericolo'},
  scoperta:{i:'🔎',c:'#ffcb3d',l:'SCOPERTA',s:'quest',h:0,p:'evento'},
  mistero:{i:'🔮',c:'#b57bff',l:'MISTERO',s:'magic',h:0,p:'evento'},
  festa:{i:'🎉',c:'#3dffa0',l:'FESTA',s:'fanfare',h:0,p:'evfesta'},
  minigioco:{i:'🎮',c:'#ffcb3d',l:'MINIGIOCO',s:'quest',h:0,p:'evento'}
};
const evK=e=>EVK[e.ek]||EVK.generico,evIco=e=>String(e.icon||'').trim()||evK(e).i;
const evVis=e=>!(e.to&&e.to.length)||e.to.includes(uid);
const evDur=e=>Math.max(0,+e.dur||0);
const evTop=()=>Object.values(S.events||{}).filter(e=>e.active&&e.at&&evVis(e)).sort((a,b)=>b.at-a.at)[0];
const evFmt=s=>{const h=Math.floor(s/3600),m=Math.floor(s%3600/60),c=s%60;return (h?h+':':'')+pad2(m)+':'+pad2(c)};
const EV={ov:null,id:null,at:0,e:null,ended:false,iv:0,ty:null,shown:new Set()};

function evClose(){
  SND.stopMusic();clearInterval(EV.iv);EV.iv=0;
  if(EV.ty){EV.ty.stop();EV.ty=null}
  if(EV.ov){EV.ov.remove();EV.ov=null}
  EV.id=null;EV.at=0;EV.e=null;EV.ended=false;
}
function evKill(){evClose();const c=document.getElementById('evchip');if(c)c.remove()}

/* schermata dell'evento in corso */
function evOpen(id){
  const e=S.events[id];if(!e)return;
  evClose();
  const K=evK(e),d=evDur(e)*60000;
  EV.id=id;EV.at=e.at;EV.e=e;EV.ended=false;
  const o=document.createElement('div');o.id='evov';o.className='evov';o.style.setProperty('--ec',K.c);EV.ov=o;
  o.innerHTML=`${SC_COR}<div class="ev-flash"></div><div class="ev-in"><div class="ev-badge"><i></i><span id="evBt">EVENTO IN CORSO</span></div><div class="ev-ico"><b>${esc(evIco(e))}</b><s></s><s></s></div><div class="ev-kind">${K.i} ${K.l}</div><h2 class="ev-title" id="evT"></h2><div class="ev-desc" id="evD"></div><div id="evMg"></div><div class="ev-tm" id="evTm" style="display:none"><div class="ev-clk" id="evC">--:--</div><div class="ev-tb"><i id="evB"></i></div></div><p class="ev-endmsg">Il Master ha concluso l'evento.</p><div class="ev-act"><button class="g grow" id="evX">Chiudi</button></div></div>`;
  document.body.append(o);
  const q=s=>o.querySelector(s);
  SND.play(K.s,1);SND.music(evMus(e));
  if(navigator.vibrate)try{navigator.vibrate(K.h?[120,60,200]:[40,40,60])}catch(x){}
  const tt=q('#evT'),dd=q('#evD');
  if(e.mg)mgMount(q('#evMg'),e);
  if(REDM()){tt.textContent=e.title;dd.textContent=e.desc||''}
  else EV.ty=typeInto(tt,e.title,false,()=>{EV.ty=e.desc?typeInto(dd,e.desc):null});
  if(d>0){
    const tm=q('#evTm'),ck=q('#evC'),bar=q('#evB');tm.style.display='';let was=null;
    const tick=()=>{
      const left=Math.max(0,e.at+d-Date.now());
      ck.textContent=left>0?evFmt(Math.ceil(left/1000)):'⌛ TEMPO SCADUTO';
      bar.style.width=Math.max(0,Math.min(100,left/d*100))+'%';
      tm.classList.toggle('low',left>0&&left<=60000);tm.classList.toggle('zero',left<=0);
      if(was===true&&left<=0){SND.stopMusic();SND.play('alarm',1);if(navigator.vibrate)try{navigator.vibrate([200,100,200])}catch(x){}}
      was=left>0;
    };
    EV.iv=setInterval(tick,500);tick();
  }
  q('#evX').onclick=()=>{evClose();evSync()};
}
/* il Master ha terminato (o cancellato) l'evento mentre il player lo guardava */
function evEnd(){
  const o=EV.ov;if(!o||EV.ended)return;
  EV.ended=true;clearInterval(EV.iv);EV.iv=0;
  if(EV.ty){EV.ty.stop();EV.ty=null}
  const e=EV.e,q=s=>o.querySelector(s),tt=q('#evT'),dd=q('#evD');
  tt.textContent=e.title;tt.classList.remove('typing');dd.textContent=e.desc||'';dd.classList.remove('typing');
  o.classList.add('ended');q('#evBt').textContent='EVENTO CONCLUSO';
  const b=q('#evX');b.className='grow';
  SND.stopMusic();o.querySelectorAll('.mg-ctl button').forEach(x=>x.disabled=true);
  SND.play('close',1);
}
/* notifica animata di nuovo evento */
function evNotify(e,seen){
  encOpen=true;
  const K=evK(e),c=K.c;
  SND.play(K.s,1);
  const m=document.createElement('div');m.className='modal notif-m enc-m evn-m'+(K.h?' hurt':'');
  m.innerHTML=`<div class="notif encnotif evnotif ${K.h?'shake':''}" style="--nc:${c};text-align:center;border:2px solid ${c}"><h2 class="newenc" style="color:${c}">EVENTO IN ARRIVO</h2><div class="encav" style="border-color:${c}">${esc(evIco(e))}</div><div class="encatt" style="color:${c};border-color:${c}">${K.i} ${K.l} ${K.i}</div><h3 class="encname">${esc(e.title)}</h3><div class="mut" style="animation-delay:.95s">Il Master ha dato inizio a un evento.</div>${evDur(e)?`<div class="mut" style="margin-top:4px;animation-delay:1.05s">⏳ Durata: ${evDur(e)} min</div>`:''}<div class="row" style="margin-top:14px;animation-delay:1.2s"><button class="g grow" data-c>Più tardi</button><button class="grow" data-i>▶ Partecipa</button></div></div>`;
  document.body.append(m);
  notifBurst(m.firstElementChild,K.p);
  if(navigator.vibrate)try{navigator.vibrate(K.h?[200,100,200,100,320]:[40,40,90])}catch(x){}
  const done=async go=>{
    if(m.dataset.closing)return;m.dataset.closing=1;m.classList.add('notif-out');
    if(!REDM())await new Promise(r=>setTimeout(r,220));
    m.remove();encOpen=false;
    await guard(db.collection('players').doc(uid).update({seenEv:{...seen,[e.id]:e.at}}));
    if(go)evOpen(e.id);else evSync();
  };
  m.onclick=ev=>{if(ev.target.dataset.c!==undefined)done(0);if(ev.target.dataset.i!==undefined)done(1)};
}
function evSync(){
  const M=masterOK&&view.name==='master',p=me();
  if(M||!db||!authed||!p||!LD.events||!LD.players){evKill();return}
  if(EV.ov&&!EV.ended){const c=S.events[EV.id];if(!c||!c.active||c.at!==EV.at)evEnd()}
  const e=evTop(),seenEv=p.seenEv||{},key=e?e.id+':'+e.at:'',seen=e&&(seenEv[e.id]===e.at||EV.shown.has(key));
  if(e&&!seen&&!encOpen&&(!EV.ov||EV.ended)){EV.shown.add(key);evNotify(e,seenEv);return}
  let chip=document.getElementById('evchip');
  if(e&&seen&&!EV.ov&&!encOpen){
    if(!chip){chip=document.createElement('button');chip.id='evchip';chip.className='evchip';document.body.append(chip);chip.onclick=()=>{const a=evTop();if(a)evOpen(a.id)}}
    chip.style.setProperty('--ec',evK(e).c);
    const t='<span>'+esc(evIco(e))+'</span> EVENTO IN CORSO · '+esc(e.title);
    if(chip.dataset.h!==t){chip.dataset.h=t;chip.innerHTML=t}
  }else if(chip)chip.remove();
}
{const _r3=render;render=function(){_r3();evSync()}}

/* ---- pannello Master: gestione eventi ---- */
const evFields=()=>[
  {l:'Titolo dell\'evento',n:'title'},
  {l:'Tipo (cambia colore, icona e suono della notifica)',n:'ek',t:'select',o:Object.keys(EVK).filter(k=>k!=='minigioco')},
  {l:'Icona personalizzata (un emoji, opzionale)',n:'icon'},
  {l:'Descrizione (cosa succede: la leggono i player)',n:'desc',t:'area'},
  {l:'Durata in minuti (0 = nessun limite di tempo)',n:'dur',t:'number'},
  {l:'Chi lo vede (nessuno selezionato = tutti i player)',n:'to',t:'multi',o:Object.entries(S.players).map(([i,p])=>[i,p.username])}];
const evData=r=>({title:r.title.slice(0,80),ek:EVK[r.ek]?r.ek:'generico',icon:Array.from(r.icon||'').slice(0,2).join(''),desc:(r.desc||'').slice(0,1500),dur:Math.min(1440,r.dur||0),to:r.to||[]});
function masterEvents(){
  const C=db.collection('events'),
    L=Object.values(S.events||{}).sort((a,b)=>(b.active?1:0)-(a.active?1:0)||(b.at||0)-(a.at||0)||String(a.title).localeCompare(String(b.title))),
    live=L.filter(e=>e.active).length;
  app.innerHTML=hdr('🎭 Eventi',1)+
    (live?`<div class="card sc-alert"><h3>🔴 ${live} in corso</h3><p class="mut" style="margin:0">I player vedono la schermata dell'evento finché non lo termini.</p></div>`:'')+
    `<button id="evAdd" style="width:100%">+ Nuovo evento</button>`+
    (L.map(e=>{
      const K=evK(e),seen=e.at?Object.values(S.players).filter(p=>(p.seenEv||{})[e.id]===e.at).map(p=>esc(p.username)):[];
      return `<div class="card evcard ${e.active?'live':''}" style="--ec:${K.c}"><div class="row"><div class="avatar" style="font-size:24px;border-color:${K.c}">${esc(evIco(e))}</div><div class="grow"><b>${esc(e.title)}</b> <span class="tag" style="color:${K.c}">${K.l}</span> ${e.active?'<span class="tag" style="color:var(--danger)">🔴 IN CORSO</span>':e.at?'<span class="tag">✔ concluso</span>':'<span class="tag">pronto</span>'}<div class="mut">👁 ${e.to&&e.to.length?e.to.map(i=>esc(S.players[i]?.username||'?')).join(', '):'Tutti i player'}${evDur(e)?' · ⏳ '+evDur(e)+' min':''}</div>${e.at?`<div class="mut">Avviato: ${new Date(e.at).toLocaleString('it-IT')}${seen.length?' · ✔ visto da '+seen.join(', '):''}</div>`:''}</div></div>${e.desc?`<p class="mut" style="white-space:pre-wrap;margin:8px 0 0">${esc(e.desc)}</p>`:''}${e.mg?mgMasterHtml(e):''}<div class="row" style="margin-top:10px;flex-wrap:wrap">${e.active?`<button class="d grow" data-evs="${e.id}">⏹ Termina evento</button>`:`<button class="grow" data-evl="${e.id}">▶ ${e.at?'Rilancia':'Avvia'} evento</button>`}<button class="g" data-eve="${e.id}">Modifica</button><button class="g" data-mge="${e.id}">🎮 ${e.mg?'Minigioco':'+ Minigioco'}</button><button class="d" data-evd="${e.id}">✕</button></div></div>`;
    }).join('')||'<p class="mut">Nessun evento: creane uno e avvialo quando vuoi.</p>');
  bind();
  const on=(a,fn)=>app.querySelectorAll(`[data-${a}]`).forEach(x=>x.onclick=()=>fn(x.dataset[a]));
  $('#evAdd').onclick=async()=>{const r=await ask('Nuovo evento',[...evFields(),...MG_IDEA],{ek:'generico',dur:0,to:[]});if(!r||!r.title)return;const m=await mgBuild(r);if(m===0)return;const id=uid8(),d=evData(r);guard(C.doc(id).set({id,...d,...(m?{mg:m.mg,icon:d.icon||m.icon||''}:{}),active:false,at:0,created:Date.now()}))};
  on('mge',async id=>{const e=S.events[id];if(!e)return;
    if(!e.mg){const r=await ask('🎮 Aggiungi un minigioco a «'+e.title+'»',MG_IDEA,{},'Genera');if(!r)return;const m=await mgBuild({...r,title:e.title});if(!m)return;return guard(C.doc(id).update({mg:m.mg,...(e.icon?{}:{icon:m.icon||''})}))}
    const x=await ask('Modifica minigioco',mgFields(),mgForm(e.mg,e.icon),'Salva');if(!x)return;
    guard(C.doc(id).update({mg:mgObj({...x,title:e.title,id:e.mg.minigame_id}),icon:x.icon||e.icon||''}))});
  on('eve',async id=>{const e=S.events[id];if(!e)return;const r=await ask('Modifica evento',evFields(),{...e,icon:e.icon||'',dur:e.dur||0,to:e.to||[]});if(!r||!r.title)return;guard(C.doc(id).update(evData(r)))});
  on('evl',async id=>{
    const e=S.events[id];if(!e)return;
    const who=e.to&&e.to.length?e.to.map(i=>S.players[i]?.username||'?').join(', '):'tutti i player';
    const r=await ask('▶ Avviare «'+e.title+'»? La notifica arriverà a: '+who,[],{},'▶ Avvia');
    if(!r)return;
    guard(C.doc(id).update({active:true,at:Date.now()}));SND.play('alarm',1);toast('🎭 Evento avviato: '+e.title);
  });
  on('evs',id=>{const e=S.events[id];if(!e)return;guard(C.doc(id).update({active:false,ended:Date.now()}));toast('⏹ Evento terminato: '+e.title)});
  on('evd',async id=>{if(await askYes('Eliminare questo evento?'))guard(C.doc(id).delete())});
}
/* ===== MINIGIOCHI (dentro la bacheca Eventi) =====
   Il Master scrive un'idea creativa → l'app la trasforma in un JSON standard (titolo, tema visivo in prima persona, meccanica, esiti).
   Il Master può rivedere e correggere ogni campo, oppure incollare un JSON già pronto.
   Il player apre l'evento, vede la scena fissa in pixel art e tira (Tratto + Abilità) d10: ogni incremento = un gruppo di dadi che arriva a 10+. */
const MG_RULES=[
 {r:/scass|serratur|lucchett|grimaldell|forzar|chiave/,t:'acume',s:'furtivita',m:'🔒',k:'lock',spr:'Una grossa serratura di ferro con il buco della chiave, illuminata da una luce fioca',env:'Sei chino davanti a una porta chiusa a chiave, in prima persona, con il corridoio buio alle spalle.',act:'Infili i grimaldelli nel meccanismo e senti i perni scattare uno a uno.',ok:'Click! La serratura cede e la porta si apre senza fare rumore.',ko:'Il grimaldello si spezza nel buco e il rumore rimbomba nel corridoio.'},
 {r:/pesc|canna|lenza|\bamo\b|pesce/,t:'acume',s:'concentrazione',m:'🎣',k:'fish',spr:'Un pesce sotto il pelo dell\'acqua, vicino al galleggiante',env:'Sei seduto sul molo, in prima persona, con la canna in mano e il galleggiante che dondola.',act:'Senti la lenza tirare: tieni la tensione giusta e stanca il pesce.',ok:'Il pesce abbocca e finisce sul molo: una cattura da raccontare.',ko:'La lenza si spezza e il pesce sparisce nelle profondità.'},
 {r:/lancia|lancio|freccett|giavellott|bowling|\bsasso|\bpalla/,t:'agilita',s:'mira',m:'🎯',k:'throw',spr:'Un bersaglio concentrico appeso a una parete di legno',env:'Sei in una taverna, in prima persona, con il braccio teso e il bersaglio davanti.',act:'Prendi la mira, respiri e lanci.',ok:'Centro perfetto: la sala esplode in un applauso.',ko:'Il lancio va lungo: il bersaglio resta intatto.'},
 {r:/uccell|bersagli|spara|tiro a segno|bancarell|pistol|fucil|freccia|\barco\b|\bmira\b/,t:'agilita',s:'mira',m:'🐦',k:'shoot',spr:'Sagome di uccelli di latta che scorrono in fila su una bancarella da luna park',env:'Sei davanti a una bancarella del luna park, in prima persona, con il fucile ad aria compressa tra le mani.',act:'Prendi la mira e sparisci gli uccelli di latta che scorrono davanti a te.',ok:'Colpo dopo colpo gli uccelli cadono: il banchista ti consegna il premio.',ko:'I colpi vanno a vuoto e gli uccelli sfilano indisturbati. Nessun premio.'},
 {r:/guid|macchin|automobil|\bmoto\b|inseguiment|pilot|volante|\bauto\b|cavalc/,t:'agilita',s:'velocita',m:'🚗',k:'drive',spr:'Una strada che corre verso l\'orizzonte, con auto che arrivano di fronte',env:'Sei al volante, in prima persona, con la strada che scorre sotto le ruote.',act:'Stringi il volante e cambi corsia schivando il traffico.',ok:'Lasci tutti indietro: il traguardo è tuo.',ko:'Un impatto violento: perdi il controllo e devi fermarti.'},
 {r:/scapp|fugg|inseguit|evad|scampa|via di qua/,t:'agilita',s:'velocita',m:'🏃',k:'run',spr:'Un corridoio che si allunga davanti a te, con la porta d\'uscita in fondo e le ombre che ti inseguono',env:'Corri in prima persona lungo un passaggio stretto: i passi dell\'inseguitore sono sempre più vicini.',act:'Scatti in avanti, schivi gli ostacoli e punti dritto verso l\'uscita.',ok:'Sbatti la porta alle tue spalle: sei salvo, per ora.',ko:'Una mano ti afferra il braccio: la fuga è finita.'},
 {r:/duell|schermagl|scherma|\bspada|\blama\b|parat|sfida/,t:'vigore',s:'mischia',m:'🤺',k:'duel',spr:'Un cavaliere in armatura che alza la spada contro di te',env:'Sei in un cortile, in prima persona, di fronte a un avversario armato.',act:'Leggi i suoi movimenti e pari il colpo all\'altezza giusta.',ok:'Disarmi l\'avversario con una parata perfetta.',ko:'Il colpo ti raggiunge e ti manda a terra.'},
 {r:/pungiball|sacco|pugn|rissa|colpisc|picchi|boxe/,t:'vigore',s:'rissa',m:'🥊',k:'punch',spr:'Un pesante sacco da boxe appeso a una catena',env:'Sei in una palestra polverosa, in prima persona, con le nocche fasciate e il sacco davanti.',act:'Carichi il braccio e scarichi una serie di pugni sul sacco.',ok:'L\'ultimo colpo fa oscillare il sacco con un tonfo: tutti si voltano a guardarti.',ko:'I pugni sono goffi e deboli: il sacco quasi non si muove.'},
 {r:/mischia|ascia|martello|clava|bastone/,t:'vigore',s:'mischia',m:'⚔️',k:'punch',spr:'Un manichino da addestramento con un\'armatura ammaccata',env:'Sei in un cortile d\'addestramento, in prima persona, con l\'arma salda in pugno.',act:'Avanzi di un passo e concateni fendenti contro il manichino.',ok:'L\'armatura si spacca con un clangore: la tua tecnica è impeccabile.',ko:'L\'arma rimbalza sul metallo e ti sfugge di mano.'},
 {r:/equilibr|funamb|\btrave\b|passerell|\bponte\b|cornice|sul filo|sulla fune|fune tesa/,t:'agilita',s:'atletica',m:'🤹',k:'balance',spr:'Una fune tesa sopra un canyon profondo',env:'Sei in bilico su una fune, in prima persona, con il vento che soffia forte.',act:'Ti muovi piano e compensi ogni spinta del vento.',ok:'Raggiungi l\'altro lato senza cadere.',ko:'Perdi l\'equilibrio e precipiti nel vuoto.'},
 {r:/scal|arrampic|salta|\bmuro\b|parete|\bfune\b|corda|ostacol|sollev|spingi/,t:'vigore',s:'atletica',m:'🧗',k:'climb',spr:'Una parete di roccia con appigli sporgenti',env:'Sei aggrappato a una parete, in prima persona, con il vuoto sotto di te.',act:'Cerchi l\'appiglio successivo e ti tiri su con tutta la forza delle braccia.',ok:'Raggiungi la cima e ti issi oltre il bordo, senza fiato.',ko:'La presa cede e scivoli giù lungo la parete.'},
 {r:/nascond|furtiv|sgattaiol|pedin|borseggi|\bruba|scivol|silenzio/,t:'agilita',s:'furtivita',m:'🕵️',k:'stealth',spr:'Un angolo buio dietro una pila di casse, con una guardia che passa sullo sfondo',env:'Sei acquattato nell\'ombra, in prima persona, e trattieni il respiro.',act:'Ti muovi piano, da un nascondiglio all\'altro, senza fare rumore.',ok:'Nessuno si accorge di te: sei passato come un fantasma.',ko:'Una tavola scricchiola: la guardia si volta di scatto.'},
 {r:/convinc|persuad|negozi|trattat|mercanteggi|bluff|seduc|discors|parlament/,t:'panache',s:'convincere',m:'💬',k:'talk',spr:'Il volto dell\'interlocutore, serio e diffidente, davanti a te',env:'Sei faccia a faccia con qualcuno che non vuole cedere, in prima persona.',act:'Scegli le parole giuste e cerchi di far pendere l\'ago dalla tua parte.',ok:'L\'interlocutore sospira e annuisce: hai vinto la discussione.',ko:'Il tuo discorso cade nel vuoto: l\'altro scuote la testa e volta le spalle.'},
 {r:/intimid|minacc|spavent|terroriz/,t:'vigore',s:'intimidire',m:'💀',k:'talk',spr:'Un avversario che indietreggia, con gli occhi sbarrati',env:'Sei a pochi passi da un avversario, in prima persona, e lo fissi senza battere ciglio.',act:'Ti avvicini, abbassi la voce e fai pesare ogni parola.',ok:'L\'avversario trema e cede di fronte alla tua presenza.',ko:'L\'avversario ride: la tua minaccia non lo smuove.'},
 {r:/scav|seppell|tesoro|\bpala\b|\bbuca|dissotterr/,t:'acume',s:'notare',m:'⛏️',k:'dig',spr:'Una distesa di terra smossa dove potrebbe esserci un tesoro nascosto',env:'Sei in un campo aperto, in prima persona, con una pala in mano.',act:'Scegli dove scavare seguendo gli indizi della terra.',ok:'La pala urta qualcosa di duro: hai trovato il tesoro!',ko:'Hai scavato ovunque e non c\'è niente: hai perso tempo.'},
 {r:/hack|terminal|computer|password|circuit|cablagg|disinnesc|bomba|\bfili\b|pannello/,t:'acume',s:'istruzione',m:'💻',k:'hack',spr:'Un pannello di comando con numeri che lampeggiano',env:'Sei davanti a un terminale acceso, in prima persona, con il tempo che scorre.',act:'Inserisci la sequenza giusta, un numero dopo l\'altro, senza sbagliare.',ok:'L\'accesso viene concesso: il sistema è tuo.',ko:'Sistema bloccato: scatta l\'allarme.'},
 {r:/labirint|caverna|grotta|cunicol|catacomb|miniera|al buio|nel buio/,t:'acume',s:'concentrazione',m:'🕯️',k:'maze',spr:'Un dedalo di corridoi di pietra, illuminato solo da poche torce',env:'Sei nel buio, in prima persona, con una torcia che tremola.',act:'Segui i corridoi e le torce cercando l\'uscita.',ok:'Vedi la luce in fondo al tunnel: sei fuori.',ko:'Il tempo finisce e la torcia si spegne: resti intrappolato.'},
 {r:/cerca|osserva|indizi|scrut|notare|trova|ricerc|ispezion|perquisi/,t:'acume',s:'notare',m:'🔎',k:'search',spr:'Una stanza disordinata con un dettaglio fuori posto che quasi non si nota',env:'Sei al centro di una stanza silenziosa, in prima persona, con gli occhi che scandagliano ogni angolo.',act:'Passi in rassegna ogni oggetto, cercando ciò che gli altri non vedono.',ok:'Lo trovi: un dettaglio nascosto che cambia tutto.',ko:'Hai guardato ovunque, ma l\'indizio ti sfugge.'},
 {r:/enigm|indovinell|decifr|codice|\brune\b|puzzle|cifra|studia|libro/,t:'acume',s:'istruzione',m:'🧩',k:'puzzle',spr:'Una tavola di simboli antichi incisi nella pietra',env:'Sei davanti a una parete coperta di simboli, in prima persona, con una lanterna in mano.',act:'Confronti i simboli, ricordi ciò che hai studiato e provi a comporre la soluzione.',ok:'I simboli si illuminano uno dopo l\'altro: l\'enigma è risolto.',ko:'La combinazione è sbagliata e i simboli si spengono di colpo.'},
 {r:/medit|concentr|nexus|rituale|incantes|magia|potere|sigillo/,t:'nexus',s:'concentrazione',m:'🔮',k:'puzzle',spr:'Un\'orbita di luce che pulsa davanti ai tuoi occhi',env:'Sei in silenzio, in prima persona, e senti il NEXUS vibrare sotto la pelle.',act:'Chiudi gli occhi, respiri piano e guidi l\'energia verso il centro della luce.',ok:'La luce si stabilizza e obbedisce al tuo volere.',ko:'La concentrazione si spezza e l\'energia si disperde in scintille.'},
 {r:/calm|consol|ascolta|empati|confort|supporto|lacrim/,t:'panache',s:'empatia',m:'💞',k:'talk',spr:'Una persona abbattuta, seduta con lo sguardo basso',env:'Sei seduto accanto a qualcuno che soffre, in prima persona.',act:'Ascolti senza fretta e scegli con cura il gesto e la parola giusti.',ok:'Le spalle si rilassano: ti sei guadagnato la sua fiducia.',ko:'Le tue parole suonano vuote: l\'altro si chiude in sé stesso.'},
 {r:/ritmo|danz|\bballo|music|suona|canta|strument|chitarr|batteri|concert|karaoke/,t:'panache',s:'creativita',m:'🎵',k:'rhythm',spr:'Un palco illuminato con le note che scendono verso la linea del ritmo',env:'Sei sul palco, in prima persona, con il pubblico che ti guarda nel buio.',act:'Segui il ritmo e colpisci ogni nota al momento giusto.',ok:'Il pubblico esplode in applausi: è un trionfo.',ko:'Perdi il tempo e la musica si spegne tra i fischi.'},
 {r:/pozion|mescol|cucin|alchim|versa|miscela|cocktail|bevand|ricetta|cuoc|dosa/,t:'acume',s:'creativita',m:'⚗️',k:'pour',spr:'Una fiala vuota con un segno sul vetro e un liquido da versare',env:'Sei in un laboratorio, in prima persona, con la boccetta in una mano e la fiala nell\'altra.',act:'Versi con mano ferma fino al segno preciso.',ok:'La dose è perfetta: la miscela brilla.',ko:'La dose è sbagliata e la miscela sfrigola.'},
 {r:/dipin|crea|invent|compon|costruisc|\barte\b|scolpi|improvvis/,t:'panache',s:'creativita',m:'🎨',k:'puzzle',spr:'Una tela bianca, un cavalletto e una tavolozza di colori accesi',env:'Sei davanti a una tela vuota, in prima persona, con il pennello in mano.',act:'Lasci correre l\'ispirazione e dai forma a ciò che hai in mente.',ok:'L\'opera prende vita: tutti restano a bocca aperta.',ko:'Il risultato è confuso e privo di slancio. Nessuno è colpito.'},
 {r:/veloc|gara|sprint|schiva|evita|riflessi/,t:'agilita',s:'velocita',m:'⚡',k:'dodge',spr:'Un ostacolo che ti viene incontro a tutta velocità',env:'Sei fermo in posizione, in prima persona, con i muscoli tesi.',act:'Al momento giusto scatti di lato e anticipi il colpo.',ok:'Lo schivi per un soffio: nemmeno ti ha sfiorato.',ko:'Troppo lento: l\'impatto ti coglie in pieno.'}
];
const MG_ALIAS={prontezza:'agilita',intelletto:'acume',intelligenza:'acume',forza:'vigore',carisma:'panache',riflessi:'velocita',mischia:'mischia',furtivita:'furtivita'};
const mgCap=s=>s?s[0]+s.slice(1).toLowerCase():s;
const MG_TRL=()=>TR.map(x=>mgCap(x[1])),MG_ABL=()=>AB.map(x=>x[1]);
const mgFind=(list,txt)=>{const k=nzs(txt||''),a=MG_ALIAS[k]||k;return list.find(x=>x[0]===a||nzs(x[1])===a)};
const mgKey=e=>e.id+':'+e.at;
const mgRes=(e,p)=>p&&p.evRes&&p.evRes[mgKey(e)];
const mgClamp=n=>Math.max(1,Math.min(8,parseInt(n)||3));

/* idea creativa → JSON standard */
const MG_NAMES={lock:'Scasso (lucchetto)',shoot:'Tiro al bersaglio (uccelli)',run:'Corsa e salti (platform)',stealth:'Furtività (guardia, stile Pokémon)',search:'Ricerca gemme (esplorazione)',punch:'Colpo a tempo (sacco)',talk:'Dialogo a tempo (convincere)',puzzle:'Memoria (rune)',climb:'Scalata',dodge:'Schivata di massi',fish:'Pesca',drive:'Guida',rhythm:'Ritmo (musica)',duel:'Duello (parate)',pour:'Versare (pozione)',balance:'Equilibrio sul filo',throw:'Lancio (dardi)',dig:'Scavo del tesoro',hack:'Hacking (numeri)',maze:'Labirinto al buio'};
function mgGen(idea,fk){
  const z=nzs(idea||''),R=fk?MG_RULES.find(x=>x.k===fk):MG_RULES.find(x=>x.r.test(z));
  const diff=/impossibil|epic|leggendari/.test(z)?5:/difficil|duro|ostico|complicat/.test(z)?4:/facile|semplice|banale/.test(z)?2:3;
  const ttl=(idea||(R&&MG_NAMES[R.k])||'Prova').replace(/^\s*[«"']|[»"']\s*$/g,'').trim();
  const title=(ttl[0]||'M').toUpperCase()+ttl.slice(1,60);
  const T=R?TR.find(x=>x[0]===R.t):TR.find(x=>x[0]==='acume'),S=R?AB.find(x=>x[0]===R.s):AB.find(x=>x[0]==='notare');
  return {mg:{
    minigame_id:R?R.k+'_'+mgSlug(ttl):'',title,
    visual_theme:{background_type:'first_person_view',target_sprite:R?R.spr:'Il bersaglio della prova, al centro della scena, in pixel art',environment_description:R?R.env:'Sei dentro la scena, in prima persona: «'+ttl+'».'},
    mechanic:{action_prompt:R?R.act:'Ti concentri e affronti la prova: «'+ttl+'».',suggested_trait:mgCap(T[1]),suggested_skill:S[1],difficulty_increments:diff},
    outcomes:{success_text:R?R.ok:'Ce l\'hai fatta: la prova è superata.',failure_text:R?R.ko:'La prova va male: non riesci a superarla.'}},
    icon:R?R.m:'🎯',known:!!R};
}
const mgSlug=t=>(nzs(t).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,32)||'minigame')+'_'+uid8().slice(0,4);
function mgForm(mg,icon,e){
  const v=mg.visual_theme||{},m=mg.mechanic||{},o=mg.outcomes||{},T=mgFind(TR,m.suggested_trait),S=mgFind(AB,m.suggested_skill);
  return {title:mg.title||'',spr:v.target_sprite||'',env:v.environment_description||'',act:m.action_prompt||'',
    tr:T?mgCap(T[1]):'Acume',sk:S?S[1]:'Notare',diff:mgClamp(m.difficulty_increments),ok:o.success_text||'',ko:o.failure_text||'',
    icon:icon||'',dur:(e&&e.dur)||0,to:(e&&e.to)||[],id:mg.minigame_id||'',gk:((String(mg.minigame_id||'').match(/^([a-z]+)_/)||[])[1]||'auto')};
}

const mgId=r=>(r.gk&&r.gk!=='auto'?r.gk+'_':'')+String(r.id||mgSlug(r.title)).replace(/^(lock|shoot|run|stealth|search|punch|talk|puzzle|climb|dodge|fish|drive|rhythm|duel|pour|balance|throw|dig|hack|maze)_/,'');
const mgObj=r=>({minigame_id:mgId(r),title:r.title.slice(0,80),
  visual_theme:{background_type:'first_person_view',target_sprite:(r.spr||'').slice(0,250),environment_description:(r.env||'').slice(0,500)},
  mechanic:{action_prompt:(r.act||'').slice(0,400),suggested_trait:r.tr,suggested_skill:r.sk,difficulty_increments:mgClamp(r.diff)},
  outcomes:{success_text:(r.ok||'').slice(0,400),failure_text:(r.ko||'').slice(0,400)}});
function mgParseJson(txt){
  try{
    const j=JSON.parse(String(txt).replace(/^\s*```(?:json)?/i,'').replace(/```\s*$/,'').trim());
    if(!j||!j.title||!j.mechanic||!j.outcomes)throw 0;
    return j;
  }catch(x){toast('JSON non valido: controlla di averlo incollato per intero');return null}
}

/* incrementi: un d10 che fa 10 vale 1; gli altri dadi si sommano in gruppi che arrivano a 10 o più (anche 11, 12, 13… = 1 solo incremento) */
function mgInc(dice){
  const r=[...dice].sort((a,b)=>b-a),g=[];let left=[];
  while(r.length){
    const x=r.shift();
    if(x>=10){g.push([x]);continue}
    let j=-1;for(let i=r.length-1;i>=0;i--)if(r[i]>=10-x){j=i;break}
    if(j>=0){g.push([x,r.splice(j,1)[0]]);continue}
    const grp=[x];let s=x;
    while(r.length&&s<10){const y=r.shift();s+=y;grp.push(y)}
    if(s>=10)g.push(grp);else{left=grp;break}
  }
  return {g,left};
}
function mgPool(p,mg){
  const T=mgFind(TR,mg.mechanic.suggested_trait),S=mgFind(AB,mg.mechanic.suggested_skill),md=modOf(p);
  if(!T||!S)return {T,S,t:0,a:0,tb:0,sb:0,n:0};
  const tb=md.tr[T[0]]||0,sb=md.ab[S[0]]||0,t=(trOf(p)[T[0]]||0)+tb,a=(abOf(p)[S[0]]||0)+sb;
  return {T,S,t,a,tb,sb,n:Math.min(30,t+a)};
}

const MG_IDEA=[
  {l:'🎮 Scegli un minigioco dalla lista (se scrivi anche un\'idea, la scena segue l\'idea ma il gioco è quello scelto)',n:'pick',t:'select',o:['— nessuno —',...Object.values(MG_NAMES)]},
  {l:'Oppure scrivi un\'idea creativa, es. «scassina la serratura»',n:'idea',t:'area'},
  {l:'Oppure incolla qui un JSON già pronto (opzionale, ha la precedenza sull\'idea)',n:'json',t:'area'}];
const mgFields=()=>[
  {l:'Emoji del bersaglio (una sola, opzionale)',n:'icon'},
  {l:'Bersaglio / sprite (cosa si vede a schermo)',n:'spr',t:'area'},
  {l:'Scena in prima persona',n:'env',t:'area'},
  {l:'Azione che il giocatore compie',n:'act',t:'area'},
  {l:'Tratto associato',n:'tr',t:'select',o:MG_TRL()},
  {l:'Abilità associata',n:'sk',t:'select',o:MG_ABL()},
  {l:'Tipo di gioco: auto, lock=scasso, shoot=tiro a bersaglio, run=corsa e salti, stealth=furtività alla Pokémon, search=ricerca gemme, punch=colpo a tempo, talk=dialogo a tempo, puzzle=memoria, climb=scalata, dodge=schivata massi, fish=pesca, drive=guida, rhythm=ritmo, duel=duello, pour=versare, balance=equilibrio, throw=lancio, dig=scavo, hack=hacking, maze=labirinto',n:'gk',t:'select',o:['auto','lock','shoot','run','stealth','search','punch','talk','puzzle','climb','dodge','fish','drive','rhythm','duel','pour','balance','throw','dig','hack','maze']},
  {l:'Difficoltà (incrementi richiesti, di solito 2, 3 o 4)',n:'diff',t:'number'},
  {l:'Se riesce (testo)',n:'ok',t:'area'},
  {l:'Se fallisce (testo)',n:'ko',t:'area'}];
/* idea/JSON → minigioco rivisto dal Master. null = evento normale, 0 = annullato */
async function mgBuild(r){
  const pk=Object.keys(MG_NAMES).find(q=>MG_NAMES[q]===r.pick);
  if(!r.idea&&!r.json&&!pk)return null;
  let mg,icon='🎯';
  if(r.json){mg=mgParseJson(r.json);if(!mg)return 0}
  else if(r.idea){const g=mgGen(r.idea);mg=g.mg;icon=g.icon;if(pk)mg.minigame_id=pk+'_'+mgSlug(r.idea);else if(!g.known)toast('Idea non riconosciuta: controlla tratto e abilità')}
  else{const g=mgGen('',pk);mg=g.mg;icon=g.icon}
  mg.title=r.title;
  const x=await ask('🎮 Rivedi il minigioco',mgFields(),mgForm(mg,icon),'Salva');
  return x?{mg:mgObj({...x,title:r.title,id:mg.minigame_id}),icon:x.icon}:0;
}
const MG_TIER=(i,n)=>i>=n+2?'crit':i>=n?'ok':i>=1?'ko':'fiasco';
const MG_T={crit:{h:'🌟 SUCCESSO STRAORDINARIO',x:'Hai fatto molto più del necessario: un colpo da maestro.'},ok:{h:'✔ SUCCESSO',x:'Ce l\'hai fatta.'},ko:{h:'✘ FALLIMENTO',x:''},fiasco:{h:'💀 FIASCO TOTALE',x:'Non poteva andare peggio: nemmeno un incremento.'}};
function mgMasterHtml(e){
  const mc=e.mg.mechanic||{},need=mgClamp(mc.difficulty_increments);
  const rs=e.at?Object.values(S.players).map(p=>{const r=mgRes(e,p);return r?`<div class="mut">${r.ok?'✔':'✘'} ${esc(p.username)}: ${r.inc}/${r.need} incrementi · dadi ${r.d.join(', ')||'—'}</div>`:''}).join(''):'';
  return `<div class="mut" style="margin-top:8px">🎮 ${esc(mc.suggested_trait)} + ${esc(mc.suggested_skill)} · difficoltà ${need} incrementi</div>${rs}`;
}


/* animazione dei dadi (a metà prova) */
function mgDice(ctl,res,anim,cb){
  const R=mgInc(res.d);
  ctl.innerHTML='<div class="dice">'+res.d.map(()=>'<div class="die rolling"><b>?</b></div>').join('')+'</div><div class="mg-chips"></div>';
  const els=[...ctl.querySelectorAll('.die')],ch=ctl.querySelector('.mg-chips');let done=0,iv=0,q=!anim;
  const land=(d,i)=>{d.className='die land'+(res.d[i]===10?' max':res.d[i]===1?' min':'');d.firstChild.textContent=res.d[i];if(!q)SND.play('land',1)};
  const fin=()=>{if(done)return;done=1;clearInterval(iv);q=true;els.forEach(land);
    ch.innerHTML=R.g.map(g=>`<span class="mg-g">${g.join('+')}${g.length>1?'='+g.reduce((a,b)=>a+b,0):''}</span>`).join('')+(R.left.length?`<span class="mg-g x">scarto ${R.left.join('+')}</span>`:'');if(cb)cb()};
  if(!anim||!res.d.length||REDM()){fin();return}
  SND.play('dice',1);const step=res.d.length>10?90:240,t0=Date.now();
  iv=setInterval(()=>{const k=Math.floor((Date.now()-t0-700)/step)+1;els.forEach((d,i)=>{if(i<k){if(!d.classList.contains('land'))land(d,i)}else d.firstChild.textContent=1+Math.floor(Math.random()*10)});if(k<res.d.length)SND.play('dice');else fin()},70);
}

/* ---- motore grafico a pixel: canvas 160x128, sprite disegnati in codice ---- */
const MG_W=160,MG_H=128,MG_KEYS=['lock','shoot','run','stealth','search','punch','talk','puzzle','climb','dodge','fish','drive','rhythm','duel','pour','balance','throw','dig','hack','maze'];
const MGP={k:'#0f0820',w:'#ffffff',r:'#e53950',R:'#8a1d38',y:'#ffd23d',Y:'#c98a14',g:'#42d884',G:'#1f8a55',b:'#4aa8ff',B:'#2757b5',p:'#b07bff',n:'#9a6238',N:'#5c3820',s:'#f2c9a0',e:'#aab0c4',E:'#5d647c',o:'#ff9440',c:'#6fe8ff'};
const MGS={
 hero:['..RRRR..','.RRRRRR.','.ssksks.','.ssssss.','..BBBB..','.sBBBBs.','..BBBB..','..N..N..'],
 hero2:['..RRRR..','.RRRRRR.','.ssksks.','.ssssss.','..BBBB..','.sBBBBs.','..BBBB..','...NN...'],
 heroup:['..RRRR..','.RRRRRR.','.ssksks.','s.ssss.s','sBBBBBBs','..BBBB..','..BBBB..','..N..N..'],
 guard:['..pppp..','.pppppp.','.ssksks.','.ssssss.','..pBBp..','.spBBps.','..pppp..','..k..k..'],
 bird:['.y.....y.','yyy...yyy','.yyyyyyy.','..yyyyyko','...ooyy..'],
 bird2:['.........','.........','yyyyyyyyy','..yyyyyko','...ooyy..'],
 lock:['..eeeeee..','.ee....ee.','.e......e.','.e......e.','yyyyyyyyyy','yYYYYYYYYy','yYYYkkYYYy','yYYYkkYYYy','yYYYYkYYYy','yYYYYkYYYy','yYYYYYYYYy','yyyyyyyyyy'],
 bag:['...ee...','...ee...','.RRRRRR.','RrrrrrrR','RrwwwwrR','RrrrrrrR','RrrrrrrR','RrrrrrrR','RrrrrrrR','RrrrrrrR','RrrrrrrR','.RrrrrR.','..RRRR..'],
 face:['..NNNNNNNN..','.NNNNNNNNNN.','.NssssssssN.','.NswkssswkN.','.NssssssssN.','.NssssnsssN.','.NssssssssN.','.NsRRRRRRsN.','..ssssssss..','...ssssss...','..BBBBBBBB..','.BBBBBBBBBB.'],
 tree:['.....gggggg.....','...gggGgggggg...','..ggggggGgggggg.','.gggGgggggggGggg','.ggggggggGgggggg','gggggGggggggggGg','ggGggggggGggggGg','.gggggggggggggG.','..GGggggggggGG..','....GGGGGGGG....','......NNNN......','......NnNN......','......NNNN......','.....NNNNNN.....'],
 gem:['..cc..','.cwcc.','cwcccc','cccccB','.cccB.','..BB..'],
 rock:['..EEEE..','.EeeeeE.','EeeeeeeE','EeeEeeeE','EeeeeEeE','EEEEEEEE'],
 trophy:['y.yyyyyy.y','y.yyyyyy.y','.yyyyyyyy.','..yyyyyy..','...yyyy...','....yy....','....yy....','...YYYY...','..YYYYYY..'],
 skull:['..wwwwww..','.wwwwwwww.','wwkkwwkkww','wwkkwwkkww','wwwwkkwwww','.wwwwwwww.','..wkwkwk..','...wwwww..'],
 heart:['.r.r.','rrrrr','rrrrr','.rrr.','..r..'],
 hold:['.nnnn.','nNnnnN','NNNNNN']
};
const mgSC={};
function mgSpr(n){
  if(mgSC[n])return mgSC[n];
  const a=MGS[n],c=document.createElement('canvas');c.width=a[0].length;c.height=a.length;
  const x=c.getContext('2d');a.forEach((r,j)=>[...r].forEach((ch,i)=>{if(MGP[ch]){x.fillStyle=MGP[ch];x.fillRect(i,j,1,1)}}));
  return mgSC[n]=c;
}
function mgD(g,n,x,y,s,fl){
  const c=mgSpr(n);s=s||1;g.save();g.translate(Math.round(x),Math.round(y));
  if(fl){g.translate(c.width*s,0);g.scale(-1,1)}
  g.imageSmoothingEnabled=false;g.drawImage(c,0,0,c.width*s,c.height*s);g.restore();
}
const MG_TH={dusk:['#241552','#32207a','#4a2c8a','#6c3c92','#9a5290','#c8708a'],day:['#2a6ad0','#3b82e2','#58a0f0','#7ebcf6','#a8d6fa','#cdeafb'],fire:['#2a0814','#4a1020','#74182c','#a02a32','#d4503a','#f08a48'],night:['#04060f','#080c26','#0e1642','#16225e','#20317e','#2c4296']};
function mgSky(g,th,h,t){
  const c=MG_TH[th]||MG_TH.dusk,b=Math.ceil(h/c.length);
  c.forEach((x,i)=>{g.fillStyle=x;g.fillRect(0,i*b,MG_W,b)});
  if(th==='night'||th==='dusk'){g.fillStyle='#fff';for(let i=0;i<22;i++)if(((t||0)+i*7)%40<30)g.fillRect((i*37)%MG_W,(i*53)%Math.floor(h*.6),1,1)}
}
function mgTxt(g,s,x,y,col,sz){g.font='bold '+(sz||8)+'px monospace';g.textAlign='center';g.fillStyle='#0f0820';g.fillText(s,x+1,y+1);g.fillStyle=col||'#fff';g.fillText(s,x,y)}
function mgLoop(c,fn){
  let last=performance.now(),acc=0;
  const f=t=>{if(!c.box.isConnected||c.off)return;acc=Math.min(100,acc+t-last);last=t;while(acc>=16.7&&!c.off){acc-=16.7;fn();if(c.ft>0){c.g.fillStyle='rgba(8,4,20,'+c.ft/22+')';c.g.fillRect(0,0,160,128);c.ft--}}requestAnimationFrame(f)};
  requestAnimationFrame(f);
}
function mgIn(c){
  const K={},m={ArrowLeft:'l',a:'l',ArrowRight:'r',d:'r',ArrowUp:'u',w:'u',ArrowDown:'d',s:'d',' ':'j'};
  const kd=e=>{const k=m[e.key];if(k){K[k]=1;if(e.key[0]==='A'||e.key===' ')e.preventDefault()}},ku=e=>{const k=m[e.key];if(k)K[k]=0};
  addEventListener('keydown',kd);addEventListener('keyup',ku);
  c.ctl.querySelectorAll('[data-k]').forEach(b=>{const k=b.dataset.k;b.onpointerdown=e=>{e.preventDefault();K[k]=1};b.onpointerup=b.onpointerleave=b.onpointercancel=()=>{K[k]=0}});
  c.cleanup=()=>{removeEventListener('keydown',kd);removeEventListener('keyup',ku)};
  return K;
}
const mgPt=(c,e)=>{const r=c.cv.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*MG_W,y:(e.clientY-r.top)/r.height*MG_H}};
function mgParts(g,P){for(let i=P.length-1;i>=0;i--){const p=P[i];p.x+=p.vx;p.y+=p.vy;p.vy+=p.gr||0;if(--p.l<=0){P.splice(i,1);continue}g.fillStyle=p.c;g.fillRect(Math.round(p.x),Math.round(p.y),p.sz||2,p.sz||2)}}
const mgBurstP=(P,x,y,n,cols,sp)=>{for(let i=0;i<n;i++){const a=Math.random()*6.28,v=Math.random()*(sp||2.5)+.5;P.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,c:cols[i%cols.length],l:40+Math.random()*30,gr:.04})}};
const mgHearts=(g,n,m)=>{for(let i=0;i<m;i++){g.globalAlpha=i<n?1:.25;mgD(g,'heart',3+i*7,3,1)}g.globalAlpha=1};
const PADS={
 pd:'<div class="pd"><button data-k="l">◀</button><button data-k="r">▶</button><button data-k="j" class="jb">SALTA</button></div>',
 lr:'<div class="pd"><button data-k="l">◀</button><button data-k="r">▶</button></div>',
 dp:'<div class="dp"><i></i><button data-k="u">▲</button><i></i><button data-k="l">◀</button><button data-k="d">▼</button><button data-k="r">▶</button></div>'
};

Object.assign(MGS,{
 fish:['..oooo..o','.oooooooo','oowkooooo','.oooooooo','..oooo..o'],
 knight:['...eeee...','..eEEEEe..','..eEkkEe..','..eEEEEe..','...eEEe...','.reeEEeer.','rrreEEeerr','.r.eEEe.r.','...eEEe...','...eE.Ee..','...kk..kk.'],
 chest:['..yyyyyy..','.yYYYYYYy.','yYYYYYYYYy','yyyyyyyyyy','yYYYyyYYYy','yYYYyyYYYy','yYYYYYYYYy','yyyyyyyyyy'],
 cloud:['....wwww........','..wwwwwwww..ww..','.wwwwwwwwwwwwww.','wwwwwwwwwwwwwwww','.wwwwwwwwwwwwww.','..wwwwwwwwwwww..'],
 torch:['.o..','oyo.','oyo.','.o..','.N..','.N..','.N..'],
 bottle:['..ee..','..nn..','..ee..','.eeee.','eeeeee','eggggE','eggggE','eggggE','EggggE','EEEEEE'],
 dart:['rrr.....','.kwwwwww','rrr.....'],
 car:['..kkkkkkkk..','.kRRRRRRRRk.','kRcccccccRRk','kRRRRRRRRRRk','kRRyRRRRyRRk','kRRRRRRRRRRk','kkkkkkkkkkkk','.kk......kk.'],
 chip:['kkkkkk','kggggk','kgkkgk','kgkkgk','kggggk','kkkkkk']
});
const mgShadow=(g,x,y,w)=>{g.fillStyle='rgba(0,0,0,.3)';g.fillRect(Math.round(x),Math.round(y),w,2);g.fillRect(Math.round(x)+1,Math.round(y)+2,w-2,1)};
function mgClouds(g,t,cam,y0){[[10,y0],[70,y0+14],[120,y0-4],[170,y0+10]].forEach((q,i)=>{const x=((q[0]-t*.08*(1+i%2)-cam*.2)%220+220)%220-30;g.globalAlpha=.85;mgD(g,'cloud',x,q[1],i%2?1:2);g.globalAlpha=1})}
function mgBtns(c,labs,fn,keys){
  c.ctl.innerHTML='<div class="pd">'+labs.map((l,i)=>`<button data-i="${i}">${l}</button>`).join('')+'</div>';
  c.ctl.querySelectorAll('button').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();fn(+b.dataset.i)}});
  const kd=e=>{const i=(keys||{})[e.key];if(i!=null&&!e.repeat){e.preventDefault();fn(i)}};addEventListener('keydown',kd);
  c.cleanup=()=>{removeEventListener('keydown',kd);c.cv.onpointerdown=null};
}
function mgHold(c,lab){
  c.ctl.innerHTML=`<button style="width:100%;height:60px;touch-action:none">${lab}</button>`;
  const S={on:0},b=c.ctl.firstChild,on=e=>{e.preventDefault();S.on=1},off=()=>{S.on=0};
  b.onpointerdown=on;b.onpointerup=b.onpointerleave=b.onpointercancel=off;c.cv.onpointerdown=on;c.cv.onpointerup=c.cv.onpointerleave=off;
  const kd=e=>{if(e.key===' '){S.on=1;e.preventDefault()}},ku=e=>{if(e.key===' ')S.on=0};addEventListener('keydown',kd);addEventListener('keyup',ku);
  c.cleanup=()=>{removeEventListener('keydown',kd);removeEventListener('keyup',ku);c.cv.onpointerdown=c.cv.onpointerup=c.cv.onpointerleave=null};
  return S;
}

const mgG={};
/* CORSA E SALTI: platform a scorrimento, come Super Mario. Dirupi, massi, bandiera. */
mgG.run=c=>{
  const g=c.g,SOL=[[0,88,150,60],[182,88,86,60],[304,88,88,60],[424,88,124,60],[216,76,16,12],[348,64,16,24]],P={x:8,y:60,vx:0,vy:0,w:10,h:14,on:0};
  let falls=0,safe=8,cam=0,t=0,msg=0;
  c.ctl.innerHTML=PADS.pd;const K=mgIn(c);
  const hit=(a,s)=>a.x<s[0]+s[2]&&a.x+a.w>s[0]&&a.y<s[1]+s[3]&&a.y+a.h>s[1],gr=x=>SOL.slice(0,4).some(s=>x+3>=s[0]&&x+3<s[0]+s[2]);
  c.H('Raggiungi la bandiera! Non cadere nei dirupi.');
  mgLoop(c,()=>{
    t++;
    const ax=(K.r?1:0)-(K.l?1:0);P.vx=Math.max(-1.6,Math.min(1.6,P.vx+ax*.25));if(!ax)P.vx*=.8;
    if((K.u||K.j)&&P.on){P.vy=-5.3;P.on=0;SND.play('click',1)}
    P.vy=Math.min(6,P.vy+.34);
    P.x+=P.vx;for(const s of SOL)if(hit(P,s)){P.x=P.vx>0?s[0]-P.w:s[0]+s[2];P.vx=0}
    P.y+=P.vy;P.on=0;for(const s of SOL)if(hit(P,s)){if(P.vy>0){P.y=s[1]-P.h;P.on=1;if(P.y+P.h>=88)safe=P.x}else P.y=s[1]+s[3];P.vy=0}
    if(P.y>150){falls++;msg=40;SND.play('danger',1);if(falls>=3){c.fin(0,500);return}let rx=safe-12;while(rx>8&&!gr(rx))rx-=4;P.x=rx;P.y=60;P.vx=P.vy=0}
    cam+=(Math.max(0,Math.min(384,P.x-70))-cam)*.15;
    if(P.x>=494){c.fin(Math.max(0,1-falls*.34),900);msg=-1}
    /* disegno */
    mgSky(g,'day',88,t);
    mgClouds(g,t,cam,12);
    g.fillStyle='#4a6ab8';for(let x=0;x<160;x+=4){const h=22+14*Math.sin((x+cam*.3)/24)+7*Math.sin((x+cam*.3)/9);g.fillRect(x,88-h,4,h)}
    g.fillStyle='#2f9a5a';for(let x=0;x<160;x+=4){const h=8+6*Math.sin((x+cam*.6)/13);g.fillRect(x,88-h,4,h)}
    SOL.slice(0,4).forEach(s=>{const x=s[0]-cam;g.fillStyle='#5c3820';g.fillRect(x,88,s[2],40);g.fillStyle='#9a6238';for(let i=0;i<s[2];i+=8)g.fillRect(x+i+((i/8)%2)*3,96+((i/8)%3)*9,4,3);g.fillStyle='#42d884';g.fillRect(x,88,s[2],3);g.fillStyle='#1f8a55';g.fillRect(x,91,s[2],1)});
    mgD(g,'rock',216-cam,76,2);mgD(g,'rock',348-cam,64,2);mgD(g,'rock',348-cam,76,2);
    g.fillStyle='#aab0c4';g.fillRect(500-cam,52,2,36);g.fillStyle='#ffd23d';g.fillRect(499-cam,50,4,3);
    g.fillStyle='#e53950';for(let i=0;i<11;i++)g.fillRect(502-cam+i,53+Math.round(Math.sin(t/8+i/2)*1.5),1,7);
    if(P.on)mgShadow(g,P.x-cam,P.y+14,10);mgD(g,(P.on&&Math.abs(P.vx)>.3&&(t>>3)&1)||!P.on?'hero2':'hero',P.x-3-cam,P.y-2,2,P.vx<0);
    mgHearts(g,3-falls,3);
    if(msg>0){msg--;mgTxt(g,'AHIA!',80,44,'#ff5a72',10)}
    if(msg<0)mgTxt(g,'TRAGUARDO!',80,44,'#ffd23d',10);
  });
};
/* ZONA TOP-DOWN alla Pokémon: griglia a passi con telecamera. stealth = guardia e cono di luce; search = gemme; maze = labirinto al buio con torce. */
function mgTop(c,mode){
  const g=c.g,st=mode==='stealth',mz=mode==='maze';let M;
  if(mz){
    const cw=10,ch=7,W=cw*2+1,Hh=ch*2+1,A=Array.from({length:Hh},()=>Array(W).fill('#')),seen={'1,1':1},stk=[[1,1]];A[1][1]='.';
    while(stk.length){const[x,y]=stk[stk.length-1],nb=[[2,0],[-2,0],[0,2],[0,-2]].filter(d=>{const a=x+d[0],b=y+d[1];return a>0&&b>0&&a<W-1&&b<Hh-1&&!seen[a+','+b]});
      if(!nb.length){stk.pop();continue}const d=nb[Math.random()*nb.length|0],a=x+d[0],b=y+d[1];A[y+d[1]/2][x+d[0]/2]='.';A[b][a]='.';seen[a+','+b]=1;stk.push([a,b])}
    for(let i=0;i<12;i++){const x=2+(Math.random()*(W-4)|0),y=2+(Math.random()*(Hh-4)|0);if(A[y][x]==='#'&&((A[y][x-1]==='.'&&A[y][x+1]==='.')||(A[y-1][x]==='.'&&A[y+1][x]==='.')))A[y][x]='.'}
    A[Hh-2][W-2]='D';M=A.map(r=>r.join(''));
  }else M=st?['##########','#S...#...#','#....#...#','#........D','#....#...#','#....#...#','#....#...#','##########']:['##########','#S.......#','#.##..##.#','#........#','#.#..#...#','#...##.#.#','#........#','##########'];
  const MW=M[0].length,MH=M.length,TL=[];
  if(st)TL.push([3,0],[7,0]);
  if(mz)for(let n=0;n<14;n++){const x=1+(Math.random()*(MW-2)|0),y=1+(Math.random()*(MH-3)|0);if(M[y][x]==='#'&&M[y+1][x]==='.')TL.push([x,y])}
  c.ctl.innerHTML=PADS.dp;const K=mgIn(c),P={tx:1,ty:1,x:16,y:16,dx:0,dy:0,mv:0,f:1,w:0},G=[],gd={y:1,d:1},FX=[];
  let bad=0,t=0,frz=0,got=0,cx=0,cy=0;const LIM=mz?2700:1500;let left=LIM;
  if(!st&&!mz)while(G.length<3){const x=1+Math.floor(Math.random()*8),y=1+Math.floor(Math.random()*6);if(M[y][x]==='.'&&Math.abs(x-1)+Math.abs(y-1)>3&&!G.some(q=>q[0]===x&&q[1]===y))G.push([x,y])}
  c.H(st?'Raggiungi la porta senza entrare nel cono di luce della guardia.':mz?'Trova l\'uscita nel labirinto buio! Le torce illuminano la strada.':'Esplora e trova le 3 gemme nascoste!');
  const arrive=()=>{
    if(M[P.ty][P.tx]==='D'){SND.play('ok',1);c.fin(mz?Math.max(.4,1-(LIM-left)/LIM*.6):Math.max(0,1-bad*.34),700);return}
    const i=G.findIndex(q=>q[0]===P.tx&&q[1]===P.ty);
    if(i>=0){G.splice(i,1);got++;SND.play('ok',1);mgBurstP(FX,P.x+8,P.y+8,14,['#6fe8ff','#fff'],2);if(got===3)c.fin(1,700)}
  };
  mgLoop(c,()=>{
    t++;
    if(frz>0){if(--frz===0)Object.assign(P,{tx:1,ty:1,x:16,y:16,mv:0})}
    else{
      if(!P.mv){const d=K.u?[0,-1]:K.d?[0,1]:K.l?[-1,0]:K.r?[1,0]:0;
        if(d){if(d[0])P.f=d[0];const nx=P.tx+d[0],ny=P.ty+d[1];if(M[ny][nx]!=='#'){P.dx=d[0];P.dy=d[1];P.mv=8;P.tx=nx;P.ty=ny}}}
      if(P.mv){P.x+=P.dx*2;P.y+=P.dy*2;P.w++;if(--P.mv===0)arrive()}
    }
    if(st){
      gd.y+=gd.d*.05;if(gd.y>=6){gd.y=6;gd.d=-1}if(gd.y<=1){gd.y=1;gd.d=1}
      const px=P.x+8,py=P.y+8,gx=56,gy=gd.y*16+8;
      if(!frz&&px>gx+10&&px<gx+72&&Math.abs(py-gy)<=16){bad++;frz=50;SND.play('alarm',1);if(bad>=3){c.fin(0,900);return}}
    }else if(--left<=0){c.fin(mz?0:got/3,300);return}
    cx=Math.max(0,Math.min(MW*16-160,Math.round(P.x+8-80)));cy=Math.max(0,Math.min(MH*16-128,Math.round(P.y+8-64)));
    g.fillStyle='#0f0820';g.fillRect(0,0,160,128);g.save();g.translate(-cx,-cy);
    for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){
      const ch=M[j][i],x=i*16,y=j*16;if(x+16<cx||x>cx+160||y+16<cy||y>cy+128)continue;
      if(st||mz){g.fillStyle=(i+j)%2?'#3b3552':'#443d5e';g.fillRect(x,y,16,16);g.fillStyle='#2e2942';g.fillRect(x+3,y+5,2,1);g.fillRect(x+10,y+11,2,1)}
      else{g.fillStyle=(i+j)%2?'#3f9a4b':'#46a653';g.fillRect(x,y,16,16);g.fillStyle='#2f7f3d';g.fillRect(x+3,y+4,1,2);g.fillRect(x+11,y+10,1,2);g.fillRect(x+7,y+13,1,2);if((i*7+j*3+(t>>5))%11===0)g.fillRect(x+5,y+2,1,2)}
      if(ch==='#'){if(st||mz){g.fillStyle='#6a6483';g.fillRect(x,y,16,16);g.fillStyle='#4b4663';g.fillRect(x,y+5,16,1);g.fillRect(x,y+11,16,1);g.fillRect(x+(j%2?4:10),y,1,5);g.fillRect(x+(j%2?11:3),y+5,1,6);g.fillRect(x+8,y+11,1,5);g.fillStyle='#8a84a8';g.fillRect(x,y,16,1);g.fillStyle='#2a2540';g.fillRect(x,y+15,16,1)}else mgD(g,'tree',x,y+1,1)}
      if(ch==='D'){g.fillStyle='#5c3820';g.fillRect(x,y,16,16);g.fillStyle='#9a6238';for(let k=2;k<16;k+=4)g.fillRect(x+k,y+1,2,14);g.fillStyle='#ffd23d';g.fillRect(x+3,y+8,2,2);if(mz){g.fillStyle='rgba(255,210,61,.25)';g.fillRect(x-2,y-2,20,20)}}
    }
    TL.forEach(q=>{const x=q[0]*16,y=q[1]*16,f=(t>>2)%3;g.fillStyle='rgba(255,170,60,'+(.18+f*.04)+')';g.fillRect(x-4,y-2,24,20);mgD(g,'torch',x+4,y+3,2)});
    G.forEach(q=>{if((t>>4)%3){mgD(g,'gem',q[0]*16+5,q[1]*16+5,1);if(t%20<8){g.fillStyle='#fff';g.fillRect(q[0]*16+3,q[1]*16+7,2,1);g.fillRect(q[0]*16+12,q[1]*16+4,1,2)}}});
    if(st){
      g.globalAlpha=.3;g.fillStyle='#ffe35a';for(let k=0;k<4;k++){const h=16+k*8;g.fillRect(66+k*16,gd.y*16+8-h/2,16,h)}g.globalAlpha=1;
      mgShadow(g,50,gd.y*16+14,12);mgD(g,'guard',48,gd.y*16,2);if(frz>0){g.fillStyle='#e53950';g.fillRect(62,gd.y*16-8,3,6);g.fillRect(62,gd.y*16,3,2)}
    }
    mgShadow(g,P.x+3,P.y+14,10);mgD(g,P.mv&&(P.w>>2)&1?'hero2':'hero',P.x,P.y,2,P.f<0);
    mgParts(g,FX);
    if(mz){const fr=(t>>3)%2?4:0;for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){const x=i*16,y=j*16;if(x+16<cx||x>cx+160||y+16<cy||y>cy+128)continue;
      let d=Math.hypot(x+8-P.x-8,y+8-P.y-8)-fr;TL.forEach(q=>{d=Math.min(d,Math.hypot(x+8-q[0]*16-8,y+8-q[1]*16-8)*1.5)});
      const a=d<26?0:d<42?.35:d<58?.65:.93;if(a){g.fillStyle='rgba(4,2,16,'+a+')';g.fillRect(x,y,16,16)}}}
    g.restore();
    if(st)mgHearts(g,3-bad,3);else{g.fillStyle='#0f0820';g.fillRect(0,124,160,4);g.fillStyle=mz&&left<LIM*.2?'#e53950':'#ffd23d';g.fillRect(0,124,160*left/LIM,4);if(!mz){mgD(g,'gem',3,3,1);mgTxt(g,got+'/3',22,10,'#fff')}}
    if(frz>0){g.fillStyle='rgba(229,57,80,.28)';g.fillRect(0,0,160,128);mgTxt(g,'VISTO!',80,66,'#fff',12)}
  });
}
mgG.stealth=c=>mgTop(c,'stealth');mgG.search=c=>mgTop(c,'search');mgG.maze=c=>mgTop(c,'maze');
/* TIRO AL BERSAGLIO: uccelli di latta che volano sulla bancarella. */
mgG.shoot=c=>{
  const g=c.g,N=9,B=[],F=[];let n=0,hit=0,t=0,cur={x:80,y:60},fl=0,endT=0;
  c.ctl.innerHTML='<div class="mut" style="text-align:center">Tocca la scena per sparare</div>';
  c.cv.onpointermove=e=>{cur=mgPt(c,e)};
  c.cv.onpointerdown=e=>{e.preventDefault();if(c.off)return;cur=mgPt(c,e);fl=4;SND.play('shot',1);
    const b=B.find(b=>!b.d&&Math.abs(cur.x-(b.x+9))<12&&Math.abs(cur.y-(b.y+5))<10);
    if(b){b.d=1;b.vy=-2;hit++;mgBurstP(F,b.x+9,b.y+5,10,['#ffd23d','#fff'],2)}else mgBurstP(F,cur.x,cur.y,4,['#aab0c4'],1)};
  c.cleanup=()=>{c.cv.onpointerdown=c.cv.onpointermove=null};
  mgLoop(c,()=>{
    t++;
    if(n<N&&t%58===1){n++;const l=Math.random()<.5;B.push({x:l?-12:168,y:26+Math.random()*44,vx:(l?1:-1)*(1+n*.12+Math.random()*.4),ph:Math.random()*6,d:0,vy:0})}
    B.forEach(b=>{if(b.d){b.vy+=.25;b.y+=b.vy;b.x+=b.vx*.3}else{b.x+=b.vx;b.y+=Math.sin(t/9+b.ph)*.5}});
    for(let i=B.length-1;i>=0;i--)if(B[i].x<-14||B[i].x>172||B[i].y>140)B.splice(i,1);
    if(n>=N&&!B.length&&!endT)endT=t;if(endT&&t-endT>20){c.fin(hit/N,200);return}
    mgSky(g,'day',104,t);mgClouds(g,t,0,30);
    g.fillStyle='#3a8a4a';for(let x=0;x<160;x+=4)g.fillRect(x,78-8*Math.sin(x/17)-4*Math.sin(x/7),4,40);
    for(let i=0;i<20;i++){g.fillStyle=i%2?'#e53950':'#fff';g.fillRect(i*8,0,8,18);g.fillRect(i*8+2,18,4,3)}
    g.fillStyle='#5c3820';g.fillRect(0,0,5,128);g.fillRect(155,0,5,128);
    B.forEach(b=>mgD(g,b.d||(t>>2)%2?'bird2':'bird',b.x,b.y,2,b.vx<0));
    g.fillStyle='#c98a14';g.fillRect(0,104,160,4);g.fillStyle='#9a6238';g.fillRect(0,108,160,20);g.fillStyle='#5c3820';for(let y=114;y<128;y+=6)g.fillRect(0,y,160,1);
    g.fillStyle='#5d647c';for(let k=0;k<18;k++){const q=k/18;g.fillRect(Math.round(80+(cur.x-80)*q),Math.round(124+(cur.y-124)*q*.86),2,2)}
    mgParts(g,F);
    g.fillStyle='#fff';g.fillRect(cur.x-6,cur.y,5,1);g.fillRect(cur.x+2,cur.y,5,1);g.fillRect(cur.x,cur.y-6,1,5);g.fillRect(cur.x,cur.y+2,1,5);g.fillStyle='#e53950';g.fillRect(cur.x,cur.y,1,1);
    if(fl>0){fl--;g.fillStyle='#fff8c0';g.fillRect(cur.x-2,cur.y-2,5,5)}
    mgTxt(g,'COLPITI '+hit+'/'+N,80,32,'#fff');
  });
};
/* COLPO A TEMPO (scasso, sacco, dialogo): ferma il segno nella zona verde. */
mgG.timing=c=>{
  const g=c.g,N=3,A=c.art,SC={lock:6,bag:5,face:6}[A]||5,F=[];let r=0,hits=0,pos=0,dir=1,zc=0,zw=0,sp=0,t=0,sh=0,msg='',mt=0,live=1;
  c.ctl.innerHTML=`<button style="width:100%;height:56px">${c.lbl}</button>`;
  const setup=()=>{zw=26-r*5;zc=24+Math.random()*52;sp=1.4+r*.7;c.H('Tentativo '+(r+1)+' di '+N)};
  const act=e=>{if(e)e.preventDefault();if(!live||c.off)return;const d=Math.abs(pos-zc),k=d<=zw/2?1:d<=zw/2+8?.5:0;hits+=k;msg=k===1?'PERFETTO!':k?'QUASI…':'MANCATO';mt=30;sh=10;SND.play(k===1?'ok':k?'click':'danger',1);mgBurstP(F,80,50,12,k?['#ffd23d','#fff']:['#e53950','#8a1d38'],2.5);if(++r>=N){live=0;c.fin(hits/N,900)}else setup()};
  c.ctl.firstChild.onpointerdown=act;c.cv.onpointerdown=act;c.cleanup=()=>{c.cv.onpointerdown=null};setup();
  mgLoop(c,()=>{
    t++;pos+=dir*sp;if(pos>=100){pos=100;dir=-1}if(pos<=0){pos=0;dir=1}if(sh>0)sh--;
    mgSky(g,'dusk',92,t);g.fillStyle='#2a1c18';g.fillRect(0,92,160,36);g.fillStyle='#3d2a22';for(let y=94;y<128;y+=8)g.fillRect(0,y,160,1);
    const s=mgSC[A]||mgSpr(A),w=s.width*SC,h=s.height*SC,ox=sh%2?2:0,oy=A==='bag'?Math.sin(t/14)*2+(sh>0?-3:0):0;
    mgD(g,A,80-w/2+ox,46-h/2+oy,SC);
    if(A==='lock')for(let i=0;i<N;i++){g.fillStyle=i<r?'#42d884':'#3a2a4a';g.fillRect(56+i*18,4,14,6)}
    g.fillStyle='#0f0820';g.fillRect(17,100,126,16);g.fillStyle='#1c1238';g.fillRect(19,102,122,12);
    g.fillStyle='#42d884';g.fillRect(20+(zc-zw/2)*1.2,102,zw*1.2,12);
    g.fillStyle='#fff';g.fillRect(20+pos*1.2-1,98,3,20);
    mgParts(g,F);if(mt>0){mt--;mgTxt(g,msg,80,28,msg==='MANCATO'?'#ff5a72':'#ffd23d',10)}
  });
};
/* MEMORIA: quattro rune luminose da ripetere. */
mgG.puzzle=c=>{
  const g=c.g,L=5,seq=Array.from({length:L},()=>Math.random()*4|0),PD=[[16,18],[84,18],[16,68],[84,68]],CO=[['#8a1d38','#ff5a72'],['#1f4a9a','#5ab4ff'],['#a77a10','#ffe04d'],['#176a40','#52f09a']];
  let lit=-1,k=0,ph=0,t=0,live=1;c.ctl.innerHTML='<div class="mut" style="text-align:center">Tocca le rune</div>';c.H('Osserva la sequenza…');
  seq.forEach((s,i)=>setTimeout(()=>{if(c.off||!c.box.isConnected)return;lit=s;SND.play('click',1);setTimeout(()=>lit=-1,380)},900+i*650));
  setTimeout(()=>{ph=1;c.H('Ripeti la sequenza')},900+L*650);
  c.cv.onpointerdown=e=>{e.preventDefault();if(ph!==1||!live)return;const q=mgPt(c,e),i=PD.findIndex(p=>q.x>=p[0]&&q.x<p[0]+60&&q.y>=p[1]&&q.y<p[1]+46);if(i<0)return;lit=i;setTimeout(()=>lit=-1,180);SND.play('click',1);
    if(i===seq[k]){if(++k>=L){live=0;c.fin(1,700)}}else{live=0;SND.play('danger',1);c.fin(k/L,700)}};
  c.cleanup=()=>{c.cv.onpointerdown=null};
  mgLoop(c,()=>{
    t++;mgSky(g,'night',128,t);g.fillStyle='#16225e';g.fillRect(2,2,156,124);g.fillStyle='#04060f';g.fillRect(4,4,152,120);mgSky(g,'night',120,t);
    PD.forEach((p,i)=>{const on=lit===i,x=p[0],y=p[1],cx=x+30,cy=y+23;
      g.fillStyle='#0f0820';g.fillRect(x-2,y-2,64,50);g.fillStyle=CO[i][on?1:0];g.fillRect(x,y,60,46);if(on){g.fillStyle='#fff';g.fillRect(x,y,60,3);g.fillRect(x,y+43,60,3)}
      g.fillStyle=on?'#fff':CO[i][1];
      if(i===0)for(let r=0;r<10;r++)g.fillRect(cx-r,cy-5+r,2*r+1,1);
      if(i===1)for(let y2=-6;y2<=6;y2++){const w=Math.round(Math.sqrt(36-y2*y2));g.fillRect(cx-w,cy+y2,2*w,1)}
      if(i===2)g.fillRect(cx-6,cy-6,12,12);
      if(i===3)for(let y2=-7;y2<=7;y2++){const w=7-Math.abs(y2);g.fillRect(cx-w,cy+y2,2*w+1,1)}});
    for(let i=0;i<L;i++){g.fillStyle=ph===1&&i<k?'#52f09a':'#2c4296';g.fillRect(56+i*10,118,6,4)}
  });
};
/* SCALATA: tocca il lato giusto per afferrare l'appiglio prima che scada il tempo. */
mgG.climb=c=>{
  const g=c.g,S=12,H=[];for(let i=0;i<S;i++)H.push(Math.random()<.5?-1:1);
  let st=0,slip=0,tm=100,t=0,cam=0,sh=0,F=[];c.ctl.innerHTML=PADS.lr;
  c.H('Afferra l\'appiglio evidenziato: ◀ o ▶ (o tocca la scena).');
  const go=side=>{if(c.off)return;if(side===H[st]){st++;tm=100;SND.play('ok',1);mgBurstP(F,80+side*30,70,6,['#c98a14','#9a6238'],1.5);if(st>=S)c.fin(1,700)}else{slip++;sh=14;tm=100;SND.play('danger',1);if(slip>=3)c.fin(st/S,700)}};
  c.ctl.querySelectorAll('[data-k]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();go(b.dataset.k==='l'?-1:1)}});
  c.cv.onpointerdown=e=>{e.preventDefault();go(mgPt(c,e).x<80?-1:1)};c.cleanup=()=>{c.cv.onpointerdown=null};
  mgLoop(c,()=>{
    t++;tm-=.75+st*.05;if(tm<=0)go(0);if(sh>0)sh--;cam+=(st*22-cam)*.12;
    g.fillStyle='#2c2a3a';g.fillRect(0,0,160,128);
    for(let y=-24;y<150;y+=12){const yy=((y+cam)%24+24)%24+y-(y%24);for(let x=0;x<160;x+=20){const o=(Math.floor((y+cam)/12)%2)*10;g.fillStyle='#3a374a';g.fillRect(x+o,((y+cam)%12+12)%12+y-((y)%12)-0,18,10)}}
    g.fillStyle='#4b4663';for(let y=0;y<128;y+=12)g.fillRect(0,(y+cam%12),160,1);
    for(let i=0;i<S;i++){const y=96-(i-st)*22-4;if(y<-10||y>128)continue;mgD(g,'hold',80+H[i]*30-6,y,2);if(i===st&&(t>>3)%2){g.fillStyle='#ffd23d';g.fillRect(80+H[i]*30-8,y-4,20,2)}}
    g.fillStyle='#c98a14';g.fillRect(78,0,4,128);
    mgD(g,'heroup',70+(sh%2?2:0),80,3);
    mgParts(g,F);mgHearts(g,3-slip,3);g.fillStyle='#0f0820';g.fillRect(0,124,160,4);g.fillStyle=tm<30?'#e53950':'#42d884';g.fillRect(0,124,160*tm/100,4);
    mgTxt(g,st+'/'+S,142,10,'#fff');
  });
};
/* SCHIVATA: massi che cadono, muoviti a destra e sinistra per evitarli. */
mgG.dodge=c=>{
  const g=c.g,R=[],F=[],P={x:76};let t=0,hits=0,inv=0;const T=720;
  c.ctl.innerHTML=PADS.lr;const K=mgIn(c);
  c.cv.onpointermove=e=>{if(e.buttons||e.pointerType==='touch')P.x=mgPt(c,e).x-8};c.cv.onpointerdown=e=>{P.x=mgPt(c,e).x-8};c.cleanup2=c.cleanup;
  const cl=c.cleanup;c.cleanup=()=>{cl();c.cv.onpointermove=c.cv.onpointerdown=null};
  c.H('Schiva i massi per 12 secondi!');
  mgLoop(c,()=>{
    t++;P.x=Math.max(4,Math.min(140,P.x+((K.r?1:0)-(K.l?1:0))*2.4));if(inv>0)inv--;
    if(t%Math.max(10,28-Math.floor(t/60))===0&&t<T-30)R.push({x:Math.random()*144+4,y:-10,v:1.6+t/400});
    R.forEach(r=>{r.y+=r.v});
    for(let i=R.length-1;i>=0;i--){const r=R[i];
      if(!inv&&r.y+12>104&&r.y<122&&r.x+12>P.x+2&&r.x<P.x+14){hits++;inv=45;SND.play('danger',1);mgBurstP(F,P.x+8,110,12,['#e53950','#ffd23d'],2.5);R.splice(i,1);if(hits>=3){c.fin(0,700);return}continue}
      if(r.y>132)R.splice(i,1)}
    if(t>=T){c.fin(Math.max(0,1-hits*.34),500);return}
    mgSky(g,'fire',110,t);g.fillStyle='#2a1612';g.fillRect(0,122,160,6);g.fillStyle='#4a2a1c';g.fillRect(0,118,160,4);
    R.forEach(r=>{mgD(g,'rock',r.x,r.y,2);g.fillStyle='rgba(0,0,0,.25)';g.fillRect(r.x,121,16,2)});
    if(!(inv%6>3))mgD(g,(t>>3)&1?'hero':'hero2',P.x,106,2);
    mgParts(g,F);mgHearts(g,3-hits,3);g.fillStyle='#0f0820';g.fillRect(0,0,160,2);g.fillStyle='#ffd23d';g.fillRect(0,0,160*t/T,2);
  });
};

/* PESCA: tieni la barra sul pesce, come nei giochi di pesca a pixel. */
mgG.fish=c=>{
  const g=c.g,S=mgHold(c,'TIRA LA LENZA (tieni premuto)'),BH=28,F=[];let bar=60,vb=0,fish=50,ft=50,prog=30,t=0;const T=900;
  c.H('Tieni la barra verde sul pesce!');
  mgLoop(c,()=>{
    t++;vb+=S.on?-.22:.16;vb=Math.max(-3.2,Math.min(3.2,vb));bar+=vb;if(bar<0){bar=0;vb=0}if(bar>100-BH){bar=100-BH;vb=-vb*.3}
    if(t%55===1)ft=8+Math.random()*84;fish+=(ft-fish)*.045;
    const on=fish>=bar&&fish<=bar+BH;prog=Math.max(0,Math.min(100,prog+(on?.36:-.22)));
    if(prog>=100){c.fin(1,600);mgBurstP(F,60,76,24,['#fff','#6fe8ff'],2.5)}
    if(t>=T){c.fin(prog/100,500);return}
    mgSky(g,'day',70,t);mgClouds(g,t,0,8);
    for(let y=70;y<128;y+=3){g.fillStyle=(y/3|0)%2?'#2a6ad0':'#245fc0';g.fillRect(0,y,160,3)}
    g.fillStyle='#8ec8ff';for(let y=74;y<128;y+=7)for(let x=(y*5)%23;x<160;x+=23)g.fillRect(x+Math.round(Math.sin(t/20+y)*3),y,6,1);
    g.fillStyle='#9a6238';g.fillRect(0,68,46,5);g.fillStyle='#5c3820';g.fillRect(0,73,46,2);for(let x=4;x<46;x+=10)g.fillRect(x,75,3,22);
    const bob=Math.sin(t/12)*1.5,bx=96,by=72+bob;
    if(on){g.fillStyle='rgba(15,8,32,.35)';g.fillRect(bx-9+Math.sin(t/9)*3,by+8,18,4)}
    for(let k=0;k<30;k++){const q=k/29;g.fillStyle='#e8e8f0';g.fillRect(Math.round(30+(bx-30)*q),Math.round(52+(by-52)*q+Math.sin(q*3.14)*-8),1,1)}
    g.fillStyle='#5c3820';g.fillRect(28,50,2,2);g.fillRect(22,54,8,1);
    g.fillStyle='#fff';g.fillRect(bx-1,by-3,3,3);g.fillStyle='#e53950';g.fillRect(bx-1,by,3,2);
    mgD(g,'hero',12,54,2);mgShadow(g,12,70,16);
    g.fillStyle='#0f0820';g.fillRect(126,8,28,112);g.fillStyle='#1f56b0';g.fillRect(128,10,16,108);g.fillStyle=on?'rgba(66,216,132,.75)':'rgba(66,216,132,.4)';g.fillRect(128,10+bar,16,BH);
    mgD(g,'fish',132,10+fish-2,1);
    g.fillStyle='#2c4296';g.fillRect(146,10,6,108);g.fillStyle=prog>60?'#42d884':prog>30?'#ffd23d':'#e53950';const hh=prog*1.08;g.fillRect(146,118-hh,6,hh);
    mgParts(g,F);
  });
};
/* GUIDA: strada in prospettiva, schiva le auto cambiando corsia. */
mgG.drive=c=>{
  const g=c.g,R=[],F=[];let t=0,hits=0,inv=0,tl=0,off=0;const T=840,hw=tt=>8+tt*72;
  c.ctl.innerHTML=PADS.lr;const K=mgIn(c);c.H('Sterza tra le corsie ed evita le auto!');
  mgLoop(c,()=>{
    t++;if(inv>0)inv--;tl=Math.max(-1.1,Math.min(1.1,tl+((K.r?1:0)-(K.l?1:0))*.07));off+=3+t/260;
    if(t%Math.max(26,55-(t/25|0))===0&&t<T-60)R.push({l:Math.floor(Math.random()*3)-1,p:0,c:['#3d8bff','#42d884','#ffd23d','#b07bff'][Math.random()*4|0]});
    R.forEach(r=>r.p+=.0105+t/120000);
    for(let i=R.length-1;i>=0;i--){const r=R[i];
      if(!inv&&r.p>.86&&r.p<1.02&&Math.abs(r.l-tl)<.75){hits++;inv=50;SND.play('danger',1);mgBurstP(F,80+tl*42,112,16,['#ff9440','#ffd23d','#fff'],3);R.splice(i,1);if(hits>=3){c.fin(0,700);return}continue}
      if(r.p>1.15)R.splice(i,1)}
    if(t>=T){c.fin(Math.max(0,1-hits*.34),500);return}
    mgSky(g,'dusk',52,t);g.fillStyle='#ffd23d';g.fillRect(104,20,12,12);g.fillStyle='#4a2c8a';for(let x=0;x<160;x+=4)g.fillRect(x,50-12-9*Math.sin(x/15)-4*Math.sin(x/6),4,14);
    for(let y=50;y<128;y++){const tt=(y-50)/78,w=hw(tt),b=Math.floor(8/(tt+.08)+off/10)%2;
      g.fillStyle=b?'#2f9a5a':'#3dac66';g.fillRect(0,y,160,1);g.fillStyle=b?'#4a4a5c':'#54546a';g.fillRect(80-w,y,w*2,1);
      g.fillStyle=b?'#e53950':'#fff';g.fillRect(80-w-Math.max(1,tt*5),y,Math.max(1,tt*5),1);g.fillRect(80+w,y,Math.max(1,tt*5),1);
      if(b){g.fillStyle='#e8e8f0';const d=Math.max(1,tt*2);g.fillRect(80-w*.33,y,d,1);g.fillRect(80+w*.33,y,d,1)}}
    R.slice().sort((a,b)=>a.p-b.p).forEach(r=>{const tt=Math.min(1.1,r.p),y=50+tt*78,s=.12+tt*1,x=80+r.l*hw(tt)*.55,w=26*s,h=15*s;
      g.fillStyle='rgba(0,0,0,.3)';g.fillRect(x-w/2,y,w,Math.max(1,2*s));g.fillStyle=r.c;g.fillRect(x-w/2,y-h,w,h);g.fillStyle='#9ad8ff';g.fillRect(x-w*.38,y-h*.9,w*.76,h*.35);g.fillStyle='#ff5a72';g.fillRect(x-w/2,y-h*.4,w*.2,h*.2);g.fillRect(x+w*.3,y-h*.4,w*.2,h*.2);g.fillStyle='#0f0820';g.fillRect(x-w/2,y-h*.12,w*.2,h*.14);g.fillRect(x+w*.3,y-h*.12,w*.2,h*.14)});
    if(!(inv%6>3)){mgShadow(g,80+tl*42-12,121,24);mgD(g,'car',80+tl*42-12,104,2)}
    mgParts(g,F);mgHearts(g,3-hits,3);g.fillStyle='#0f0820';g.fillRect(0,0,160,2);g.fillStyle='#ffd23d';g.fillRect(0,0,160*t/T,2);
  });
};
/* RITMO: le note scendono sulle tre corsie, premi quando toccano la linea. */
mgG.rhythm=c=>{
  const g=c.g,N=14,notes=[],F=[],CO=['#ff5a72','#ffe04d','#52f09a'],fl=[0,0,0];let t=0,sc=0,msg='',mt=0,s=40;
  for(let i=0;i<N;i++){notes.push({l:Math.random()*3|0,s,h:0,m:0});s+=30+Math.random()*14|0}
  const ny=n=>(t-n.s)*2.2-8;
  const press=l=>{if(c.off)return;let b=null,bd=99;notes.forEach(n=>{const d=Math.abs(ny(n)-104);if(n.l===l&&!n.h&&!n.m&&d<bd){b=n;bd=d}});
    if(b&&bd<20){b.h=1;const k=bd<=8?1:.5;sc+=k;msg=k===1?'PERFETTO!':'OK';mt=24;fl[l]=8;SND.play(k===1?'ok':'click',1);mgBurstP(F,40+l*40,104,10,[CO[l],'#fff'],2.5)}else{msg='MANCATO';mt=24;fl[l]=-8;SND.play('danger',1)}};
  mgBtns(c,['◀','▲','▶'],press,{ArrowLeft:0,a:0,ArrowUp:1,w:1,ArrowDown:1,s:1,ArrowRight:2,d:2});
  c.cv.onpointerdown=e=>{e.preventDefault();press(Math.min(2,Math.floor(mgPt(c,e).x/53.4)))};
  const cl=c.cleanup;c.cleanup=()=>{cl();c.cv.onpointerdown=null};c.H('Premi quando la nota tocca la linea!');
  mgLoop(c,()=>{
    t++;notes.forEach(n=>{if(!n.h&&!n.m&&ny(n)>124)n.m=1});
    if(t>notes[N-1].s+75){c.fin(sc/N,300);return}
    mgSky(g,'night',128,t);
    for(let i=0;i<3;i++){g.globalAlpha=.13;g.fillStyle=CO[i];g.beginPath();g.moveTo(40+i*40-4,0);g.lineTo(40+i*40+4,0);g.lineTo(40+i*40+26,104);g.lineTo(40+i*40-26,104);g.fill();g.globalAlpha=1}
    for(let i=0;i<3;i++){const x=40+i*40;g.fillStyle='#0b0820';g.fillRect(x-17,0,34,128);g.fillStyle=fl[i]>0?CO[i]:'#2c4296';g.fillRect(x-17,0,1,128);g.fillRect(x+16,0,1,128);if(fl[i]>0){fl[i]--;g.globalAlpha=.3;g.fillStyle=CO[i];g.fillRect(x-16,60,32,44);g.globalAlpha=1}else if(fl[i]<0){fl[i]++;g.fillStyle='rgba(229,57,80,.3)';g.fillRect(x-16,0,32,128)}}
    g.fillStyle='#fff';g.fillRect(20,104,120,2);g.fillStyle='rgba(255,255,255,.25)';g.fillRect(20,98,120,14);
    notes.forEach(n=>{if(n.h)return;const y=ny(n);if(y<-10||y>130)return;const x=40+n.l*40;g.fillStyle=n.m?'#555a70':CO[n.l];g.fillRect(x-11,y-5,22,10);g.fillStyle='rgba(255,255,255,.6)';g.fillRect(x-9,y-4,18,2);g.fillStyle='#0f0820';g.fillRect(x-11,y+4,22,1)});
    mgD(g,'hero',72,4+Math.sin(t/6)*2,2);for(let x=4;x<160;x+=12){g.fillStyle='#04060f';g.fillRect(x,120+Math.sin(x)*2,9,8)}
    mgParts(g,F);if(mt>0){mt--;mgTxt(g,msg,80,62,msg==='MANCATO'?'#ff5a72':'#ffd23d',10)}
  });
};
/* DUELLO: leggi dove colpisce l'avversario e para all'altezza giusta. */
mgG.duel=c=>{
  const g=c.g,N=6,F=[],Y=[48,64,80];let k=0,ok=0,t=0,wait=50,at=-1,tm=0,sh=0,msg='',mt=0,pr=-1,pt=0;
  const next=()=>{k++;at=-1;if(k>=N){c.off=1;c.fin(ok/N,500);return}wait=45+Math.random()*40|0};
  const press=i=>{if(c.off||at<0)return;pr=i;pt=10;if(i===at){ok++;msg='PARATA!';SND.play('ok',1);mgBurstP(F,70,Y[i]+1,12,['#ffd23d','#fff'],2.5)}else{msg='COLPITO!';sh=12;SND.play('danger',1)}mt=30;next()};
  mgBtns(c,['▲ ALTO','● CENTRO','▼ BASSO'],press,{ArrowUp:0,ArrowRight:1,ArrowLeft:1,ArrowDown:2});c.H('Para dove colpisce il nemico!');
  mgLoop(c,()=>{
    t++;if(sh>0)sh--;if(pt>0)pt--;
    if(at<0){if(--wait<=0){at=Math.random()*3|0;tm=Math.max(30,56-k*4)}}
    else if(--tm<=0){msg='COLPITO!';mt=30;sh=12;SND.play('danger',1);next()}
    mgSky(g,'dusk',84,t);g.fillStyle='#3a2a1c';g.fillRect(0,92,160,36);g.fillStyle='#53403a';for(let x=0;x<160;x+=16)g.fillRect(x,100+(x/16%2)*8,14,1);
    g.fillStyle='#e53950';g.fillRect(8,10,10,30);g.fillRect(142,10,10,30);g.fillStyle='#ffd23d';g.fillRect(8,40,10,2);g.fillRect(142,40,10,2);
    const ox=sh%2?2:0;mgShadow(g,18+ox,90,26);mgShadow(g,112,90,30);
    mgD(g,'hero',18+ox,66,3);mgD(g,'knight',112,56,3,0);
    if(at>=0){g.fillStyle=(t>>2)&1?'#ff5a72':'#e53950';g.fillRect(70,Y[at]-1,40,4);g.fillStyle='#fff';g.fillRect(70,Y[at],40,1);mgTxt(g,'!',130,48,'#ff5a72',12)}else{g.fillStyle='#aab0c4';g.fillRect(108,50,3,22)}
    g.fillStyle='#aab0c4';const hy=pr>=0&&pt>0?Y[pr]:70;g.fillRect(40,hy-1,28,3);g.fillStyle='#ffd23d';g.fillRect(40,hy-3,3,7);
    mgParts(g,F);if(mt>0){mt--;mgTxt(g,msg,80,32,msg==='PARATA!'?'#ffd23d':'#ff5a72',10)}
    g.fillStyle='#0f0820';g.fillRect(0,0,160,3);g.fillStyle='#ffd23d';g.fillRect(0,0,160*k/N,3);
  });
};
/* VERSARE: tieni premuto per versare, rilascia sul segno. */
mgG.pour=c=>{
  const g=c.g,N=3,CL=['#42d884','#ff5a72','#6fe8ff'],S=mgHold(c,'VERSA (tieni premuto, rilascia sul segno)'),B=[];
  let r=0,lv=0,tg=0,v=0,pouring=0,t=0,pts=0,wait=0,msg='',mt=0;
  const setup=()=>{lv=0;tg=40+Math.random()*45;v=0;wait=0;c.H('Fiala '+(r+1)+' di '+N+': riempi fino al segno giallo')};setup();
  const res=()=>{const d=Math.abs(lv-tg),k=d<=3?1:d<=9?.5:0;pts+=k;msg=k===1?'PERFETTO!':k?'QUASI…':'TROPPO!';mt=50;wait=60;pouring=0;SND.play(k===1?'ok':k?'click':'danger',1)};
  mgLoop(c,()=>{
    t++;
    if(wait>0){if(--wait===0){if(++r>=N){c.fin(pts/N,300);return}setup()}}
    else if(S.on){v=Math.min(.9,v+.03);lv+=v;pouring=1;if(t%3===0)B.push({x:68+Math.random()*24,y:108,vy:-.6-Math.random()*.4});if(lv>=100){lv=100;res()}}
    else{if(pouring)res();v=0}
    g.fillStyle='#3a2a1c';g.fillRect(0,0,160,128);g.fillStyle='#53403a';for(let y=0;y<128;y+=8)g.fillRect(0,y,160,1);
    g.fillStyle='#5c3820';g.fillRect(0,40,36,3);g.fillRect(124,40,36,3);g.fillRect(0,84,36,3);g.fillRect(124,84,36,3);
    [[4,22],[18,22],[130,22],[144,22],[10,66],[136,66]].forEach((q,i)=>{mgSC.bottle&&0;mgD(g,'bottle',q[0],q[1]+ (i%2?2:0),2)});
    g.fillStyle='#0b0820';g.fillRect(62,18,36,98);g.fillStyle='rgba(180,220,255,.18)';g.fillRect(64,20,32,94);
    const top=112-lv*.92;g.fillStyle=CL[r%3];g.fillRect(64,top,32,112-top);g.fillStyle='rgba(255,255,255,.35)';g.fillRect(64,top,32,2);
    B.forEach(b=>{b.y+=b.vy;g.fillStyle='rgba(255,255,255,.5)';g.fillRect(b.x,b.y,2,2)});for(let i=B.length-1;i>=0;i--)if(B[i].y<top)B.splice(i,1);
    g.fillStyle='#ffd23d';g.fillRect(58,112-tg*.92,44,2);g.fillRect(54,112-tg*.92-2,4,6);g.fillRect(102,112-tg*.92-2,4,6);
    g.fillStyle='#fff';g.fillRect(62,18,2,98);g.fillRect(96,18,2,98);g.fillRect(62,114,36,2);
    g.save();g.translate(84,-10);g.rotate(pouring?2.7:3.4);mgD(g,'bottle',-9,-30,3);g.restore();
    if(pouring){g.fillStyle=CL[r%3];g.fillRect(78+Math.round(Math.sin(t/3)),22,3,top-22)}
    if(mt>0){mt--;mgTxt(g,msg,80,12,msg==='TROPPO!'?'#ff5a72':'#ffd23d',10)}
    for(let i=0;i<N;i++){g.fillStyle=i<r?'#42d884':'#2c4296';g.fillRect(4+i*10,120,8,4)}
  });
};
/* EQUILIBRIO: filo sospeso sul canyon, contrasta il vento. */
mgG.balance=c=>{
  const g=c.g,F=[];c.ctl.innerHTML=PADS.lr;const K=mgIn(c);let tilt=0,tv=0,t=0,falls=0,fa=0;const T=660;
  c.H('Tieni l\'equilibrio: ◀ ▶ contro il vento!');
  mgLoop(c,()=>{
    t++;const wind=Math.sin(t/37)*.0016+Math.sin(t/11)*.0009;
    if(fa>0){if(--fa===0){tilt=0;tv=0}}
    else{tv=(tv+wind+tilt*.0012+((K.r?1:0)-(K.l?1:0))*.003)*.985;tilt+=tv;if(Math.abs(tilt)>=1){falls++;fa=60;SND.play('danger',1);if(falls>=3){c.fin(0,900)}}}
    if(t>=T){c.fin(Math.max(0,1-falls*.34),500);return}
    mgSky(g,'fire',70,t);g.fillStyle='#a0402a';for(let x=0;x<160;x+=4)g.fillRect(x,66-10-8*Math.sin(x/21+1)-4*Math.sin(x/8),4,40);
    g.fillStyle='#5a1a22';g.fillRect(0,96,160,32);g.fillStyle='#74182c';for(let x=0;x<160;x+=4)g.fillRect(x,96+Math.sin(x/9)*3,4,10);
    g.fillStyle='#7a3a22';g.fillRect(0,88,28,40);g.fillRect(132,88,28,40);g.fillStyle='#9a5a32';g.fillRect(0,88,28,3);g.fillRect(132,88,28,3);
    g.fillStyle='#e8e8f0';for(let x=28;x<132;x++)g.fillRect(x,92+Math.round(Math.sin((x-28)/104*3.14)*3),1,1);
    g.fillStyle='rgba(255,255,255,.4)';for(let i=0;i<8;i++)g.fillRect((i*41+t*(2+i%3))%160,20+i*7,10,1);
    const sag=3,y0=92+sag;
    if(fa>0){const f=60-fa;g.save();g.translate(80+tilt*30,y0-24+f*f*.07);g.rotate(f/5*Math.sign(tilt||1));mgD(g,'hero',-12,-12,3);g.restore()}
    else{g.save();g.translate(80,y0);g.rotate(tilt*.6);mgD(g,'hero',-12,-24,3);g.fillStyle='#5c3820';g.save();g.rotate(tilt*.4);g.fillRect(-28,-14,56,2);g.fillStyle='#ffd23d';g.fillRect(-28,-15,3,4);g.fillRect(25,-15,3,4);g.restore();g.restore()}
    g.fillStyle='#0f0820';g.fillRect(30,4,100,6);g.fillStyle='#2c4296';g.fillRect(31,5,98,4);g.fillStyle=Math.abs(tilt)>.7?'#e53950':'#42d884';g.fillRect(80+tilt*48-2,3,5,8);
    mgHearts(g,3-falls,3);g.fillStyle='#0f0820';g.fillRect(0,124,160,4);g.fillStyle='#ffd23d';g.fillRect(0,124,160*t/T,4);
  });
};
/* LANCIO: blocca prima la posizione orizzontale, poi quella verticale. */
mgG.throw=c=>{
  const g=c.g,N=3,F=[],D=[];let r=0,ph=0,x=80,y=56,lx=80,t=0,pts=0,fly=0,fx=0,fy=0,msg='',mt=0;
  c.ctl.innerHTML='<button style="width:100%;height:56px">LANCIA</button>';c.H('Premi per fissare prima la mira orizzontale, poi quella verticale.');
  const act=e=>{if(e)e.preventDefault();if(c.off||fly)return;SND.play('click',1);if(ph===0){lx=x;ph=1}else{fx=lx;fy=y;fly=1;ph=2;SND.play('shot',1)}};
  c.ctl.firstChild.onpointerdown=act;c.cv.onpointerdown=act;c.cleanup=()=>{c.cv.onpointerdown=null};
  mgLoop(c,()=>{
    t++;
    if(ph===0)x=80+Math.sin(t/(14-r*2))*52;if(ph===1)y=56+Math.sin(t/(11-r*2))*40;
    if(fly&&++fly>22){const d=Math.hypot(fx-80,fy-56),k=d<=6?1:d<=16?.7:d<=28?.4:d<=38?.15:0;pts+=k;D.push([fx,fy]);msg=k>=1?'CENTRO!':k>=.7?'OTTIMO':k>=.4?'BUONO':k?'RASENTE':'FUORI';mt=40;mgBurstP(F,fx,fy,8,['#fff','#ffd23d'],1.6);SND.play(k>=.7?'ok':'click',1);fly=0;ph=0;if(++r>=N){c.fin(pts/N,700);return}}
    g.fillStyle='#4a3020';g.fillRect(0,0,160,128);g.fillStyle='#5c3a26';for(let i=0;i<128;i+=16)g.fillRect(0,i,160,1);for(let i=0;i<160;i+=40)g.fillRect(i,0,1,128);
    g.fillStyle='#0f0820';g.fillRect(80-42,56-42,84,84);for(let rr=38;rr>0;rr-=7){g.fillStyle=((38-rr)/7|0)%2?'#fff':'#e53950';for(let yy=-rr;yy<=rr;yy++){const w=Math.round(Math.sqrt(rr*rr-yy*yy));g.fillRect(80-w,56+yy,w*2,1)}}
    g.fillStyle='#42d884';g.fillRect(78,54,5,5);
    D.forEach(d=>mgD(g,'dart',d[0]-2,d[1]-1,1));
    if(ph>=0&&!fly){g.globalAlpha=.8;g.fillStyle='#ffd23d';if(ph===0)g.fillRect(Math.round(x),8,1,96);else{g.fillRect(Math.round(lx),8,1,96);g.fillRect(20,Math.round(y),120,1)}g.globalAlpha=1}
    if(fly){const q=fly/22,sc=3-q*2;g.save();g.translate(80+(fx-80)*q,128-(128-fy)*q);g.scale(sc/2,sc/2);mgD(g,'dart',-4,-2,2);g.restore()}
    mgParts(g,F);mgD(g,'hero',6,98,3);for(let i=0;i<N;i++)mgD(g,'dart',130+(i<N-r?0:100),104+i*7,1);
    if(mt>0){mt--;mgTxt(g,msg,80,16,'#ffd23d',10)}
  });
};
/* SCAVO: tocca le zolle; il colore dice quanto sei vicino al tesoro. */
mgG.dig=c=>{
  const g=c.g,CW=8,CH=5,TX=Math.random()*CW|0,TY=Math.random()*CH|0,D={},F=[];let used=0,t=0,found=0;const MAXD=8;
  c.ctl.innerHTML='<div class="mut" style="text-align:center">Tocca una zolla per scavare</div>';c.H('Rosso = vicinissimo · arancio = vicino · blu = lontano');
  c.cv.onpointerdown=e=>{e.preventDefault();if(c.off||found)return;const p=mgPt(c,e),cx=Math.floor(p.x/20),cy=Math.floor((p.y-24)/20),k=cx+','+cy;if(cx<0||cx>=CW||cy<0||cy>=CH||D[k])return;
    used++;SND.play('click',1);const d=Math.abs(cx-TX)+Math.abs(cy-TY);D[k]=d;mgBurstP(F,cx*20+10,24+cy*20+10,10,['#9a6238','#5c3820'],2);
    if(d===0){found=1;SND.play('fanfare',1);mgBurstP(F,cx*20+10,24+cy*20+10,26,['#ffd23d','#fff'],3);c.fin(Math.max(.3,1-(used-1)*.1),1200)}else if(used>=MAXD)c.fin(0,900)};
  c.cleanup=()=>{c.cv.onpointerdown=null};
  mgLoop(c,()=>{
    t++;mgSky(g,'day',24,t);g.fillStyle='#ffd23d';g.fillRect(140,4,10,10);g.fillStyle='#3f9a4b';g.fillRect(0,20,160,4);
    for(let j=0;j<CH;j++)for(let i=0;i<CW;i++){const x=i*20,y=24+j*20,d=D[i+','+j];
      g.fillStyle=(i+j)%2?'#9a6238':'#8a5530';g.fillRect(x,y,20,20);g.fillStyle='#5c3820';g.fillRect(x+4,y+6,2,2);g.fillRect(x+13,y+13,2,2);g.fillRect(x+9,y+3,1,1);
      if(d!==undefined){g.fillStyle='#2a160c';g.fillRect(x+2,y+2,16,16);g.fillStyle=d===0?'#ffd23d':d<=1?'rgba(229,57,80,.7)':d<=3?'rgba(255,148,64,.6)':'rgba(74,168,255,.5)';g.fillRect(x+2,y+2,16,16);if(d===0)mgD(g,'chest',x+5,y+6,1)}}
    mgD(g,'hero',4,12,1);for(let i=0;i<MAXD;i++){g.fillStyle=i<MAXD-used?'#ffd23d':'#2c4296';g.fillRect(40+i*8,8,6,6)}
    mgParts(g,F);
  });
};
/* HACKING: tocca i numeri in ordine crescente il più in fretta possibile. */
mgG.hack=c=>{
  const g=c.g,N=9,cells=[],F=[];for(let i=0;i<20;i++)cells.push(i);cells.sort(()=>Math.random()-.5);
  const chips=cells.slice(0,N).map((q,i)=>({n:i+1,x:8+(q%5)*30,y:18+((q/5)|0)*26,d:0}));let nx=1,t=0,fl=0;const T=720;
  c.ctl.innerHTML='<div class="mut" style="text-align:center">Tocca i numeri da 1 a 9 in ordine</div>';c.H('Più sei veloce, meglio è!');
  c.cv.onpointerdown=e=>{e.preventDefault();if(c.off)return;const p=mgPt(c,e),h=chips.find(q=>!q.d&&p.x>=q.x&&p.x<q.x+24&&p.y>=q.y&&p.y<q.y+18);if(!h)return;
    if(h.n===nx){h.d=1;nx++;SND.play('ok',1);mgBurstP(F,h.x+12,h.y+9,8,['#52f09a','#fff'],2);if(nx>N)c.fin(Math.max(.5,1-t/T*.5),700)}else{t+=45;fl=8;SND.play('danger',1)}};
  c.cleanup=()=>{c.cv.onpointerdown=null};
  mgLoop(c,()=>{
    t++;if(t>=T){c.fin((nx-1)/N*.5,500);return}
    g.fillStyle=fl>0?'#2a0a14':'#04140c';g.fillRect(0,0,160,128);if(fl>0)fl--;
    g.fillStyle='#0b3a22';g.font='7px monospace';g.textAlign='left';for(let i=0;i<14;i++){g.fillText(String((i*7+(t>>3))%2),i*12+2,(t*.9+i*23)%128)}
    for(let y=0;y<128;y+=3){g.fillStyle='rgba(0,0,0,.25)';g.fillRect(0,y,160,1)}
    chips.forEach(q=>{g.fillStyle=q.d?'#0b3a22':'#0f2a1c';g.fillRect(q.x,q.y,24,18);g.fillStyle=q.d?'#1f8a55':'#52f09a';g.fillRect(q.x,q.y,24,1);g.fillRect(q.x,q.y+17,24,1);g.fillRect(q.x,q.y,1,18);g.fillRect(q.x+23,q.y,1,18);if(!q.d)mgTxt(g,String(q.n),q.x+12,q.y+13,'#a8ffd0',10);else mgTxt(g,'OK',q.x+12,q.y+12,'#1f8a55',7)});
    mgParts(g,F);g.fillStyle='#0f0820';g.fillRect(0,122,160,6);g.fillStyle=t>T*.75?'#e53950':'#52f09a';g.fillRect(0,123,160*(1-t/T),4);
  });
};

const MG_ART={lock:'lock',punch:'bag',talk:'face',shoot:'bird',run:'rock',stealth:'guard',search:'gem',puzzle:'gem',climb:'hold',dodge:'rock',fish:'fish',drive:'car',rhythm:'gem',duel:'knight',pour:'bottle',balance:'hero',throw:'dart',dig:'chest',hack:'chip',maze:'torch'};
const MG_FN={lock:'timing',punch:'timing',talk:'timing',shoot:'shoot',run:'run',stealth:'stealth',search:'search',puzzle:'puzzle',climb:'climb',dodge:'dodge',fish:'fish',drive:'drive',rhythm:'rhythm',duel:'duel',pour:'pour',balance:'balance',throw:'throw',dig:'dig',hack:'hack',maze:'maze'};
const MG_THEME={lock:'dusk',punch:'dusk',talk:'dusk',shoot:'day',run:'day',stealth:'night',search:'day',puzzle:'night',climb:'dusk',dodge:'fire',fish:'day',drive:'dusk',rhythm:'night',duel:'dusk',pour:'dusk',balance:'fire',throw:'dusk',dig:'day',hack:'night',maze:'night'};
const MG_BYSK={furtivita:'stealth',mira:'shoot',notare:'search',rissa:'punch',mischia:'punch',velocita:'dodge',atletica:'climb',convincere:'talk',intimidire:'talk',empatia:'talk',istruzione:'puzzle',concentrazione:'puzzle',creativita:'puzzle'};
const MG_MUS={lock:'mistero',shoot:'festa',run:'combattimento',stealth:'pericolo',search:'scoperta',punch:'combattimento',talk:'generico',puzzle:'mistero',climb:'scoperta',dodge:'pericolo',fish:'scoperta',drive:'combattimento',rhythm:'festa',duel:'combattimento',pour:'mistero',balance:'pericolo',throw:'festa',dig:'scoperta',hack:'pericolo',maze:'mistero'};
const MG_LBL={lock:'SCATTA',punch:'COLPISCI',talk:'ARGOMENTA'};
const MG_HOW={
 lock:'Ferma il segno nella zona verde per far scattare i perni: 3 tentativi.',
 shoot:'Spara agli uccelli: tocca la scena per fare fuoco. Ne passano 9.',
 run:'Corri e salta i dirupi fino alla bandiera: ◀ ▶ per muoverti, SALTA per saltare. Tre cadute e sei fuori.',
 stealth:'Muoviti come in un vecchio gioco di ruolo: raggiungi la porta senza entrare nel cono di luce della guardia.',
 search:'Esplora la zona e trova le 3 gemme nascoste prima che scada il tempo.',
 punch:'Colpisci quando il segno è nella zona verde: 3 colpi.',
 talk:'Scegli il momento giusto per ogni argomento: ferma il segno nella zona verde.',
 puzzle:'Guarda la sequenza di rune e ripetila a memoria.',
 climb:'Scala la parete: afferra l\'appiglio evidenziato prima che scada il tempo. Tre scivoloni e cadi.',
 dodge:'Schiva i massi che cadono per 12 secondi: ◀ ▶ oppure trascina il dito sulla scena.',
 fish:'Tieni premuto per alzare la barra verde e seguire il pesce: riempi la barra di cattura.',
 drive:'Sterza con ◀ ▶ tra le tre corsie ed evita le auto per 14 secondi. Tre botte e sei fuori.',
 rhythm:'Premi la corsia giusta quando la nota tocca la linea: 14 note.',
 duel:'Il nemico colpisce alto, al centro o in basso: para all\'altezza giusta prima che sia tardi.',
 pour:'Tieni premuto per versare e rilascia quando il liquido arriva al segno giallo: 3 fiale.',
 balance:'Contrasta il vento con ◀ ▶ per restare in equilibrio sul filo. Tre cadute e sei fuori.',
 throw:'Fissa prima la mira orizzontale e poi quella verticale: 3 lanci al bersaglio.',
 dig:'Hai 8 colpi di pala: il colore della buca dice quanto sei vicino al tesoro.',
 hack:'Tocca i numeri da 1 a 9 in ordine crescente. Ogni errore costa tempo.',
 maze:'Esplora un labirinto al buio: ti vedi solo vicino a te e alle torce. Trova la porta!'
};
const mgGame=mg=>{const m=String(mg.minigame_id||'').match(/^([a-z]+)_/);if(m&&MG_KEYS.includes(m[1]))return m[1];const S=mgFind(AB,mg.mechanic.suggested_skill);return(S&&MG_BYSK[S[0]])||'talk'};
const evMus=e=>e.mg?MG_MUS[mgGame(e.mg)]:(e.ek||'generico');
/* anteprima statica nella schermata iniziale */
function mgIntro(c,key){
  const g=c.g,A=MG_ART[key];mgSky(g,MG_THEME[key],92,5);g.fillStyle='#3a2a1c';g.fillRect(0,92,160,36);g.fillStyle='#42d884';g.fillRect(0,92,160,3);
  const s=mgSpr(A),k={lock:6,bag:5,face:5,bird:4,rock:4,guard:3,gem:5,hold:6,fish:6,car:5,knight:4,bottle:5,dart:6,chest:6,chip:8,torch:7,hero:5}[A]||4;
  mgD(g,A,110-s.width*k/2,92-s.height*k+ (A==='bird'?-24:0),k,A==='guard');mgD(g,'hero',30,68,3);
}
/* finali: un'animazione diversa per ogni esito */
function mgEnd(c,tier,anim){
  const g=c.g,P=[];let t=anim?0:200;c.off=0;const wrap=c.cv.parentNode,th={crit:'dusk',ok:'day',ko:'night',fiasco:'fire'}[tier];
  const col=['#ffd23d','#ff5a72','#6fe8ff','#fff','#42d884'];
  mgLoop(c,()=>{
    t++;mgSky(g,th,92,t);g.fillStyle=tier==='ko'?'#2a2a36':'#3a2a1c';g.fillRect(0,92,160,36);g.fillStyle=tier==='ko'?'#444458':'#42d884';g.fillRect(0,92,160,3);
    if(tier==='crit'){
      if(t%18===1)mgBurstP(P,30+Math.random()*100,18+Math.random()*34,28,col,2.6);
      mgD(g,'trophy',65,Math.max(12,52-t*.9),3);mgD(g,'heroup',68,66-Math.abs(Math.sin(t/8))*18,3);
      if(t<20){g.fillStyle='rgba(255,220,80,'+.5*(1-t/20)+')';g.fillRect(0,0,160,128)}
    }else if(tier==='ok'){
      if(t===1)mgBurstP(P,80,50,16,['#ffd23d','#fff'],2);
      if(t<90&&t%2===0)P.push({x:Math.random()*160,y:-4,vx:Math.random()-.5,vy:.8+Math.random(),c:col[t%5],l:200,sz:3});
      mgD(g,'gem',68,24+Math.sin(t/12)*3,4);mgD(g,'hero',68,68-Math.abs(Math.sin(t/10))*8,3);
    }else if(tier==='ko'){
      g.fillStyle='#555a70';g.fillRect(40,10,70,10);g.fillRect(52,4,46,8);g.fillRect(100,14,30,8);
      g.fillStyle='#6fb0ff';for(let i=0;i<26;i++)g.fillRect((i*29+t*.5)%160,(t*3+i*17)%92,1,4);
      g.save();g.translate(80,94);g.rotate(Math.min(.7,t/40));mgD(g,'hero',-12,-24,3);g.restore();
      g.fillStyle='rgba(0,0,0,.3)';g.fillRect(0,0,160,128);
    }else{
      if(t===1){mgBurstP(P,80,70,54,['#ff9440','#ffd23d','#e53950','#fff'],4);if(anim)wrap.classList.add('shk')}
      if(t<24){g.fillStyle='rgba(255,40,60,'+.5*(1-t/24)+')';g.fillRect(0,0,160,128)}
      const hx=68+t*1.4,hy=68-t*1.2+t*t*.03;g.save();g.translate(hx+12,hy+12);g.rotate(t/6);mgD(g,'hero',-12,-12,3);g.restore();
      if(t>30)mgD(g,'skull',65,18+Math.sin(t/10)*3,3);
    }
    mgParts(g,P);
  });
}
function mgCss(){
  if(document.getElementById('mgcss'))return;
  const s=document.createElement('style');s.id='mgcss';
  s.textContent=`.mg{width:100%;margin-top:14px;text-align:center}
.mg-cv{position:relative;line-height:0;border:4px solid var(--ink);box-shadow:4px 4px 0 var(--ink),0 0 0 3px var(--ec,var(--acc))}
.mg-cv:after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.1) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 62%,rgba(0,0,0,.35))}
.mg-cv.shk{animation:shake .4s steps(4) 3}
.mg-cv canvas{width:100%;height:auto;display:block;image-rendering:pixelated;touch-action:none;user-select:none;-webkit-user-select:none}
.mg-env{margin:14px 0 4px;font-style:italic}.mg-act{font-weight:700;margin:0 0 8px}
.mg-hud{min-height:30px;margin:10px 0 4px}
.mg-pool{border:2px dashed var(--ec,var(--acc));padding:8px 10px;margin:8px 0;font-size:.92em}
.mg .dice{margin:12px 0 6px}.mg .die{width:42px;height:42px;font-size:13px;border-width:3px}
.mg-g{display:inline-block;margin:3px;padding:4px 8px;border:2px solid var(--ok);color:var(--ok);font:400 10px/1.4 var(--f-px)}.mg-g.x{border-color:#888;color:#888}
.mg-big{font:400 14px/1.6 var(--f-px);margin:8px 0 4px;text-shadow:2px 2px 0 var(--ink)}.mg-big.ok{color:var(--ok)}.mg-big.ko{color:var(--danger)}
.dp{display:grid;grid-template-columns:repeat(3,64px);gap:6px;justify-content:center;margin-top:10px}.dp i{display:block}
.pd{display:flex;gap:8px;margin-top:10px}.pd button{flex:1;height:58px;font-size:18px}.pd .jb{flex:2}
.dp button,.pd button{height:54px;font-size:20px;touch-action:none;user-select:none;-webkit-user-select:none}`;
  document.head.append(s);
}
function mgMount(box,e){
  mgCss();
  const p=me(),mg=e.mg,mc=mg.mechanic||{},vt=mg.visual_theme||{},o=mg.outcomes||{},key=mgGame(mg),old=mgRes(e,p),sk=mgFind(AB,mc.suggested_skill);
  box.innerHTML='<div class="mg"><div class="mg-cv"><canvas width="160" height="128"></canvas></div><div class="mg-hud"></div><div class="mg-ctl"></div></div>';
  const Q=s=>box.querySelector(s),cv=Q('canvas'),hud=Q('.mg-hud'),ctl=Q('.mg-ctl'),g=cv.getContext('2d'),H=h=>{hud.innerHTML=h};
  g.imageSmoothingEnabled=false;
  const c={box,cv,g,ctl,H,art:MG_ART[key],lbl:MG_LBL[key]||'AGISCI',off:0};
  c.fin=(s,d)=>{c.off=1;if(c.cleanup){c.cleanup();c.cleanup=null}setTimeout(()=>mid(s),d||700)};
  let busy=0;const star=s=>s>=.75?'⭐⭐⭐':s>=.4?'⭐⭐':'⭐';
  const btn=(l,fn)=>{ctl.innerHTML=`<button style="width:100%">${l}</button>`;ctl.firstChild.onclick=fn};
  const end=(res,anim)=>{
    const tier=MG_TIER(res.inc,res.need),X=MG_T[tier],base=(res.ok?o.success_text:o.failure_text)||'';
    const x=tier==='ko'?(res.need-res.inc===1?'Per un soffio…':'Non è bastato.'):X.x;
    mgEnd(c,tier,anim);
    if(anim){SND.stopMusic();({crit:()=>{SND.play('fanfare',1);setTimeout(()=>SND.play('crit',1),600)},ok:()=>SND.play('quest',1),ko:()=>SND.play('danger',1),fiasco:()=>SND.play('alarm',1)})[tier]();if(navigator.vibrate)try{navigator.vibrate(res.ok?[40,40,90]:[200,80,200])}catch(z){}}
    setTimeout(()=>H(`<div class="mg-big ${res.ok?'ok':'ko'}">${X.h}</div><div class="mg-big" style="font-size:11px">${res.inc}/${res.need} INCREMENTI · PROVA ${star(res.sc||0)}</div><p style="margin:6px 0">${esc(base)}</p><p class="mut" style="margin:0">${esc(x)}</p>`),anim?1700:0);
  };
  const roll=async s=>{
    if(busy||mgRes(e,p))return;busy=1;
    const pl=mgPool(p,mg),need=mgClamp(mc.difficulty_increments),d=Array.from({length:pl.n},()=>rollD(10)),R=mgInc(d);
    const res={d,inc:R.g.length,ok:R.g.length>=need,need,t:pl.t,a:pl.a,sc:Math.round(s*100)/100,ts:Date.now()};
    /* salvato PRIMA dell'animazione: chiudere o ricaricare non permette di ritirare */
    const ev=Object.entries({...(p.evRes||{}),[mgKey(e)]:res}).sort((x,y)=>(y[1].ts||0)-(x[1].ts||0)).slice(0,20);
    if(!(await guard(db.collection('players').doc(uid).update({evRes:Object.fromEntries(ev)}).then(()=>1)))){busy=0;return}
    H('<div class="mg-big">I DADI DECIDONO…</div>');
    mgDice(ctl,res,true,()=>setTimeout(()=>end(res,true),1300));
  };
  const mid=s=>{
    ctl.innerHTML='';
    g.fillStyle='rgba(8,4,20,.55)';g.fillRect(0,0,160,128);mgTxt(g,star(s).length>2?'PROVA SUPERATA':'PROVA FINITA',80,64,'#ffd23d',10);
    const pl=mgPool(p,mg),need=mgClamp(mc.difficulty_increments),tl=pl.T?pl.T[1]:mc.suggested_trait,sl=pl.S?pl.S[1]:mc.suggested_skill;
    H(`<div class="mg-big ok">${star(s)}</div><div class="mut">${s>=.75?'Esecuzione impeccabile.':s>=.4?'Una prova discreta.':'Una prova incerta.'}</div><div class="mg-pool"><b>${esc(String(tl).toUpperCase())}</b> ${pl.t||0}${pl.tb?' (+'+pl.tb+')':''} + <b>${esc(String(sl).toUpperCase())}</b> ${pl.a||0}${pl.sb?' (+'+pl.sb+')':''} = <b>${pl.n}d10</b><br><span class="mut">Servono ${need} incrementi: a metà prova sono i dadi a decidere come va a finire.</span></div>`);
    btn(`TIRA ${pl.n} d10`,()=>roll(s));
  };
  const play=()=>{c.off=0;c.cleanup=null;c.ft=22;H('');mgG[MG_FN[key]](c)};
  if(old){end(old,false);mgDice(ctl,old,false);return}
  mgIntro(c,key);
  H(`<div class="mg-env">${esc(vt.environment_description||'')}</div><div class="mg-act">${esc(mc.action_prompt||'')}</div><div class="mut">${MG_HOW[key]}</div>`);
  btn('▶ INIZIA LA PROVA',play);
}


{const _re=renderMaster;renderMaster=function(){if(tab==='events')return masterEvents();return _re()}}

$('#mbtn').onclick=async()=>{
  if(masterOK){view={name:'master'};return render()}
  const r=await ask('Login Master',[{l:'Email',n:'email',t:'email'},{l:'Password',n:'pw',t:'password'}]);
  if(!r)return;
  if(r.email.toLowerCase()===String(NX.MASTER_EMAIL||'').toLowerCase()&&r.pw===NX.MASTER_PASSWORD){masterOK=true;tab=null;view={name:'master'};SND.play('login',1);render()}else toast('Credenziali Master errate');
};
boot();
