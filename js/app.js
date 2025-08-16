/* ====== Constantes y utilidades ====== */
const K = { POLLS:'pz_polls', PREFS:'pz_prefs', FAVS:'pz_favs', STATS:'pz_stats', FRI:'pz_friends_v2', COMM:'pz_comm', RATE:'pz_ratings', USER:'pz_user' };
const CATS = [
  {id:'gastronomia',l:'🍽 Gastronomía'},
  {id:'musica',l:'🎵 Música'},
  {id:'cine',l:'🎬 Cine/Series'},
  {id:'deporte',l:'⚽ Deporte'},
  {id:'naturaleza',l:'🌿 Naturaleza'},
  {id:'cultura',l:'🎨 Cultura/Arte'},
  {id:'juegos',l:'🎮 Juegos/Ocio'}
];
const S = [
  {t:'Cata de vinos',cat:'gastronomia',p:15,tod:'tarde',pl:'Bodega'},
  {t:'Tapeo casco',cat:'gastronomia',p:12,tod:'noche',pl:'Ruta gastro'},
  {t:'Concierto plaza',cat:'musica',p:0,tod:'noche',pl:'Plaza Mayor'},
  {t:'Jam en bar',cat:'musica',p:8,tod:'noche',pl:'Bar indie'},
  {t:'Estreno cine',cat:'cine',p:7,tod:'noche',pl:'Cines'},
  {t:'Series + pizza',cat:'cine',p:10,tod:'tarde',pl:'En casa'},
  {t:'Fútbol sala',cat:'deporte',p:5,tod:'tarde',pl:'Pabellón'},
  {t:'Bici río',cat:'naturaleza',p:0,tod:'mañana',pl:'Parque'},
  {t:'Miradores',cat:'naturaleza',p:0,tod:'tarde',pl:'Mirador'},
  {t:'Expo arte',cat:'cultura',p:6,tod:'tarde',pl:'Museo'},
  {t:'Teatro alt',cat:'cultura',p:18,tod:'noche',pl:'Sala'},
  {t:'Escape room',cat:'juegos',p:20,tod:'tarde',pl:'Escape'},
  {t:'Juegos mesa',cat:'juegos',p:5,tod:'noche',pl:'Café juegos'}
];
const COMM_DEF = [
  {id:'c1',title:'Tacos + karaoke',desc:'Cena y karaoke',rating:42,cat:'gastronomia'},
  {id:'c2',title:'Picnic atardecer',desc:'Parque y música',rating:35,cat:'naturaleza'},
  {id:'c3',title:'Cine al aire libre',desc:'Plaza + helados',rating:28,cat:'cine'}
];

const U  = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d }catch(_){ return d } };
const SVE= (k,v)=> localStorage.setItem(k, JSON.stringify(v));
const q   = s=>document.querySelector(s);
const qq  = s=>Array.from(document.querySelectorAll(s));
const uid = ()=>Math.random().toString(36).slice(2,10);
const now = ()=>Date.now();
const fmt = ts=>new Date(ts).toLocaleString();
const toLocal = ts=>new Date(ts - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
const icon=c=>({gastronomia:'🍽',musica:'🎵',cine:'🎬',deporte:'⚽',naturaleza:'🌿',cultura:'🎨',juegos:'🎮'}[c]||'✨');
const useSB = ()=> !!window.SB && !!window.SB_VOTES;

/* ====== Estado global ====== */
let step = 1;
if (!Array.isArray(window.opts)) window.opts = [];
const opts = window.opts;

/* ====== Tema ====== */
(function(){
  const th = document.getElementById('th');
  if (th) th.onclick = ()=>{
    document.documentElement.classList.toggle('dark');
    SVE('pz_theme', document.documentElement.classList.contains('dark') ? 'dark':'light');
  };
  const s = U('pz_theme', null) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (s==='dark') document.documentElement.classList.add('dark');
})();

/* ====== Cuenta / Login local ====== */
function openMenu(){ q('#amenu')?.classList.add('open'); }
function closeMenu(){ q('#amenu')?.classList.remove('open'); }
(function(){
  const abtn = q('#abtn'), amenu = q('#amenu');
  if (abtn && amenu){
    abtn.addEventListener('click',()=>amenu.classList.toggle('open'));
    document.addEventListener('click',e=>{
      if(!amenu.contains(e.target) && !abtn.contains(e.target)) closeMenu();
    });
  }
})();
function user(){ return U(K.USER,null); }
function setUser(u){ SVE(K.USER,u); hydrateAccount(); }
function hydrateAccount(){
  const u=user();
  const aico=q('#aico'), aname=q('#aname'), amenu=q('#amenu');
  if(aico) aico.textContent = u ? (u.name?.[0]||'?').toUpperCase() : '?';
  if(aname) aname.textContent = u ? u.name : 'Invitado';
  if(amenu) amenu.querySelector('a').textContent = u ? '👤 Mi cuenta' : '👤 Iniciar sesión';
}
function openLogin(){ q('#ml').style.display='flex'; }
function closeLogin(){ q('#ml').style.display='none'; }
function doLogin(){
  const n=q('#ln')?.value?.trim();
  const e=q('#le')?.value?.trim();
  if(!n){ alert('Escribe tu nombre'); return; }
  setUser({name:n,email:e}); closeLogin(); alert('Sesión iniciada');
}
function demoLogin(){ setUser({name:'Demo',email:'demo@planazoo.app'}); closeLogin(); }
function logout(){ localStorage.removeItem(K.USER); hydrateAccount(); closeMenu(); alert('Sesión cerrada'); }

/* ====== NAV ====== */
function tab(name){
  qq('.tab').forEach(t=>t.classList.toggle('on',t.dataset.t===name));
  qq('.view').forEach(v=>v.classList.remove('on'));
  q('#'+name)?.classList.add('on');
  if(name==='crear') renderCrear();
  if(name==='hist') renderHist();
  if(name==='favs') renderFavs();
  if(name==='stats') renderStats();
  if(name==='comm') renderComm();
  if(name==='home') renderHomeC();
}
qq('.tab').forEach(t=>t.onclick=()=>tab(t.dataset.t));

/* ====== PREFS ====== */
function openPrefs(){
  tab('prefs');
  const p=U(K.PREFS,{city:'',budget:'medio',ints:[]});
  q('#pcity').value=p.city||'';
  q('#pbud').value=p.budget||'medio';
  const wrap=q('#pints');
  wrap.innerHTML='';
  CATS.forEach(c=>{
    const l=document.createElement('label');
    l.className='pill';
    l.innerHTML=`<input type="checkbox" value="${c.id}"> ${c.l}`;
    wrap.appendChild(l);
  });
  const set=new Set(p.ints||[]);
  wrap.querySelectorAll('input').forEach(i=>i.checked=set.has(i.value));
}
function savePrefs(){
  const city=q('#pcity').value.trim();
  const budget=q('#pbud').value;
  const ints=[...q('#pints').querySelectorAll('input:checked')].map(i=>i.value);
  SVE(K.PREFS,{city,budget,ints});
  alert('Preferencias guardadas');
  tab('crear');
}

/* ====== Amigos ====== */
function defaultFriends(){ return [
  {id:'u1',name:'Verónica',handle:'@vero',avatar:'V'},
  {id:'u2',name:'Marcos',handle:'@marcos',avatar:'M'},
  {id:'u3',name:'Lucía',handle:'@luci',avatar:'L'}
];}
function friends(){
  const raw=U(K.FRI,null);
  if(!raw){ SVE(K.FRI,defaultFriends()); return defaultFriends(); }
  return raw.map(x=> typeof x==='string'
    ? {id:uid(),name:x,handle:'@'+x.toLowerCase().replace(/\s+/g,''),avatar:(x[0]||'?').toUpperCase()}
    : x);
}
function saveFriends(a){ SVE(K.FRI,a); }

function renderChips(sel=new Set()){
  const w=q('#chips'); if (!w) return;
  w.innerHTML='';
  friends().forEach(u=>{
    const s=document.createElement('span');
    s.className='chip';
    s.style.cursor='pointer';
    s.innerHTML=`<span class="avatar" style="width:22px;height:22px;font-size:12px">${u.avatar}</span> ${u.name}`;
    if(sel.has(u.id)) s.style.background='color-mix(in oklab,var(--b) 18%, var(--chip))';
    s.onclick=()=>{ sel.has(u.id)?sel.delete(u.id):sel.add(u.id); renderChips(sel); };
    w.appendChild(s);
  });
  w.dataset.sel = JSON.stringify([...sel]);
}
function addFriendInput(){
  const v=q('#fnew').value.trim(); if(!v) return;
  const u={id:uid(),name:v.replace(/^@/,''),handle:v.startsWith('@')?v:'@'+v.toLowerCase().replace(/\s+/g,''),avatar:(v.replace(/^@/,'')[0]||'?').toUpperCase()};
  saveFriends([...friends(),u]);
  q('#fnew').value='';
  renderChips(new Set(JSON.parse(q('#chips').dataset.sel||'[]')));
  renderMF();
}
function manageFriends(){ q('#mf').style.display='flex'; renderMF(); }
function closeMF(){ q('#mf').style.display='none'; }
function renderMF(){
  const w=q('#mfl'); if (!w) return; w.innerHTML='';
  friends().forEach(u=>{
    const d=document.createElement('div');
    d.className='opt';
    d.innerHTML=`<div class='row'>
      <div style='display:flex;align-items:center;gap:8px'>
        <span class='avatar'>${u.avatar}</span>
        <div><b>${u.name}</b><br><small class='pill'>${u.handle}</small></div>
      </div>
      <div style='flex:1'></div>
      <button class='btn s'>Eliminar</button>
    </div>`;
    d.querySelector('button').onclick=()=>{
      saveFriends(friends().filter(x=>x.id!==u.id));
      renderMF(); renderChips(new Set());
    };
    w.appendChild(d);
  });
}
function addFriendModal(){
  const v=q('#mfnew').value.trim(); if(!v) return;
  const u={id:uid(),name:v.replace(/^@/,''),handle:v.startsWith('@')?v:'@'+v.toLowerCase().replace(/\s+/g,''),avatar:(v.replace(/^@/,'')[0]||'?').toUpperCase()};
  saveFriends([...friends(),u]);
  q('#mfnew').value='';
  renderMF(); renderChips(new Set());
}

/* ====== Crear (wizard) ====== */
function setStep(n){
  step = n;
  qq('.step').forEach(s=>{
    const i=parseInt(s.dataset.s,10);
    s.classList.toggle('on',i===step);
    s.classList.toggle('done',i<step);
  });
  qq('.substep').forEach(x=>x.classList.remove('on'));
  q('#s'+step)?.classList.add('on');
  q('#pb').disabled = (step===1);
  q('#pn').textContent = step===4 ? 'Finalizar' : 'Continuar →';
  if (step===4) renderSummary();
  wireUI();
}
function prevStep(){ if(step>1) setStep(step-1); }

// nextStep robusto (mantener)
window.nextStep = async function () {
  try {
    const cur = typeof step === 'number' ? step : 1;

    if (cur === 1) {
      if (typeof guardDetails === 'function' && !guardDetails()) return;
      const isLogged = (window.__pz_is_logged === true) || (typeof user === 'function' && !!user());
      if (!isLogged) { window.openLogin?.(); return; }
      setStep(2);
      return;
    }
    if (cur === 2) { setStep(3); return; }
    if (cur === 3) {
      const hasOpts = Array.isArray(window.opts) && window.opts.length > 0;
      if (!hasOpts) { alert('Añade al menos 1 actividad'); return; }
      setStep(4);
      return; // <- crucial
    }
    if (cur === 4) {
      const fn =
        (typeof window.createShare === 'function' && window.createShare) ||
        (typeof window.createShareLocal === 'function' && window.createShareLocal) ||
        (typeof createShare === 'function' && createShare);
      if (!fn) { alert('No encuentro la función para crear el plan.'); return; }
      await fn();
      return;
    }
  } catch (e) {
    console.error('[PZ] nextStep error:', e);
    alert(e?.message || 'No se pudo continuar. Revisa la consola.');
  }
};


function guardDetails(){
  const title=q('#pt').value.trim();
  const dt=q('#pd').value;
  if(!title || !dt){ alert('Completa título y fecha/hora'); return false; }
  return true;
}
function renderSummary(){
  const sum=q('#sum'); if (!sum) return; sum.innerHTML='';
  const invited=(JSON.parse(q('#chips').dataset.sel||'[]')).map(id=>friends().find(f=>f.id===id));
  const card1=document.createElement('div');
  card1.className='opt';
  card1.innerHTML=`<b>📛 ${q('#pt').value.trim()}</b><br>
    <small class='pill'>${q('#pd').value}</small><br>
    <small class='pill'>${invited.length} invitado(s)</small>`;
  sum.appendChild(card1);
  const card2=document.createElement('div');
  card2.className='opt';
  if(!opts.length){
    card2.innerHTML='<small class="pill">Sin actividades</small>';
  } else {
    card2.innerHTML='<b>🗂 Actividades</b>';
    const ul=document.createElement('ul'); ul.style.marginTop='6px';
    opts.forEach(o=>{ const li=document.createElement('li'); li.textContent=o.t; ul.appendChild(li); });
    card2.appendChild(ul);
  }
  sum.appendChild(card2);
}
function sharePreview(){ alert('El enlace se generará al crear el plan.'); }

function renderCrear(){
  const p=U(K.PREFS,{city:'',budget:'medio',ints:[]});
  q('#pc').value=p.city||'';
  const d=new Date(Date.now()+2*3600*1000); d.setMinutes(0,0,0);
  q('#pd').value=toLocal(d.getTime());
  opts.length = 0;
  ropts();
  q('#sugs').innerHTML='';
  rfavpick();
  renderChips(new Set());
  setStep(1);
}
function ropts(){
  const w=q('#opts'); if (!w) return; w.innerHTML='';
  if(!Array.isArray(opts)) { window.opts=[]; }
  if(!opts.length){ w.innerHTML='<small class="pill">No hay actividades aún</small>'; return; }
  opts.forEach((o,i)=>{
    const r=document.createElement('div');
    r.className='opt';
    r.innerHTML=`<div class='row'><div style='flex:1'>${o.t}</div><button class='btn s'>Eliminar</button></div>`;
    r.querySelector('button').onclick=()=>{ opts.splice(i,1); ropts(); };
    w.appendChild(r);
  });
}
function genSugUI(){
  const p=U(K.PREFS,{budget:'medio',ints:[]});
  const max = p.budget==='bajo'?10:(p.budget==='medio'?30:999);
  const ints=new Set((p.ints||[]).length?p.ints:CATS.map(c=>c.id));
  const tod=(d=>{const h=d.getHours();return h<12?'mañana':(h<20?'tarde':'noche')})(new Date(q('#pd').value||Date.now()+2*3600*1000));
  const list=S.filter(s=>ints.has(s.cat)&&s.p<=max&&(s.tod===tod||Math.random()<.35)).sort(()=>Math.random()-.5).slice(0,5);
  const w=q('#sugs'); w.innerHTML='';
  list.forEach(s=>{
    const d=document.createElement('div');
    d.className='opt';
    d.innerHTML=`<b>${icon(s.cat)} ${s.t}</b><br>
      <small class='pill'>~ ${s.p}€ · ${s.tod}</small>
      <div class='row' style='margin-top:6px'>
        <button class='btn s p'>Añadir</button>
        <button class='btn s'>Fav</button>
      </div>`;
    d.querySelectorAll('button')[0].onclick=()=>{
      if(!Array.isArray(opts)) window.opts=[];
      opts.push({t:`${s.t} — ${s.pl} (~${s.p}€)`,cat:s.cat});
      ropts();
    };
    d.querySelectorAll('button')[1].onclick=()=>addFavText(`${s.t} — ${s.pl}`);
    w.appendChild(d);
  });
}
function addManual(){
  const t=prompt('Escribe la actividad/plan'); if(!t) return;
  if(!Array.isArray(opts)) window.opts=[];
  opts.push({t});
  ropts();
}
function ol(){return parseInt(localStorage.getItem('pz_limit_options')||'5',10)}
function al(){return parseInt(localStorage.getItem('pz_limit_active')||'3',10)}

/* ====== createShare local (fallback) ====== */
function createShare(){
  if(!guardDetails()) return;
  const title=q('#pt').value.trim();
  const dl=Math.max(10,Math.min(1440,parseInt(q('#pl').value||'120',10)));
  const dt=q('#pd').value ? new Date(q('#pd').value).getTime() : Date.now()+2*3600*1000;
  if(!Array.isArray(opts) || opts.length<1){ alert('Añade al menos 1 actividad'); return; }
  const polls=U(K.POLLS,{});
  const active=Object.values(polls).filter(p=>!p.closed && p.when>now()).length;
  if(active>=al()){ alert('Límite de planes activos (freemium)'); return; }
  const id=uid();
  const invited=(JSON.parse(q('#chips').dataset.sel||'[]'));
  polls[id]={
    id, title,
    options: opts.map((o,i)=>({id:i,text:o.t,votes:0,meta:o.cat?{cat:o.cat}:null})),
    createdAt:now(),
    deadline:now()+dl*60000,
    when:dt,
    closed:false, collab:true, invited,
    owner:user()?.email||'demo', rating:0, cancelled:false
  };
  SVE(K.POLLS,polls);
  location.hash='#/votar/'+id;
  renderVote();
  qq('.view').forEach(v=>v.classList.remove('on'));
  q('#votar')?.classList.add('on');
}

/* ====== Votar (SB elegante) ====== */
async function renderVoteSB(){
  const id = location.hash.split('/')[2];
  if (!id) { alert('No existe'); tab('home'); return; }

  // Plan (deadline/closed)
  const planRes = await window.SB_VOTES.fetchPlan(id);
  const p = planRes.data;
  if (!p) { alert('No existe'); tab('home'); return; }

  q('#vt').textContent = 'Vota: ' + (p.title || 'Plan');
  q('#collab').style.display = 'inline-block';
  q('#vn').value = ''; // no usamos nombre con SB

  const listRes = await window.SB_VOTES.fetchOptionsWithCounts(id);
  // Ordena en cliente por texto (o quita esta línea si prefieres sin ordenar)
  const rows = (listRes.data || []).slice().sort((a,b)=> String(a.text).localeCompare(String(b.text)));

  let myOpt = null;
  try { myOpt = await window.SB_VOTES.getMyVote(id); } catch(_){}

  const w = q('#vlist'); w.innerHTML='';
  rows.forEach(r=>{
    const el = document.createElement('div');
    el.className = 'vote-card' + (myOpt && myOpt===r.option_id ? ' selected' : '');
    el.dataset.option = r.option_id;
    el.innerHTML = `
      <div class="check">✓</div>
      <div style="flex:1">
        <div class="vote-title">${r.text}</div>
        ${typeof r.votes==='number' ? `<div class="vote-meta">Votos: ${r.votes}</div>` : ``}
      </div>
    `;
    el.addEventListener('click', async ()=>{
      try{
        await window.SB_VOTES.castVote(id, r.option_id);
        // refrescar selección y contadores
        const [me, latest] = await Promise.all([
          window.SB_VOTES.getMyVote(id),
          window.SB_VOTES.fetchOptionsWithCounts(id),
        ]);
        myOpt = me;
        // re-render rápido
        const data = latest.data || [];
        w.querySelectorAll('.vote-card').forEach(card=>{
          const isMine = (card.dataset.option === String(myOpt));
          card.classList.toggle('selected', isMine);
        });
        // actualizar contadores
        data.forEach(dr=>{
          const card = w.querySelector(`.vote-card[data-option="${dr.option_id}"]`);
          if(card){
            const meta = card.querySelector('.vote-meta');
            if (meta) meta.textContent = 'Votos: '+(dr.votes ?? 0);
          }
        });
      }catch(err){
        console.error('[vote] error', err);
        alert(err?.message || 'No se pudo registrar el voto');
      }
    });
    w.appendChild(el);
  });

  // contador de cierre
  const closed = !!p.closed;
  function tick(){
    const dl = new Date(p.deadline_ts).getTime();
    const r = Math.max(0, dl - Date.now());
    q('#rem').textContent = (closed ? 'Cerrada' : (Math.floor(r/60000)+'m '+Math.floor((r%60000)/1000)+'s'));
  }
  tick();
  clearInterval(window.__pz_timer);
  window.__pz_timer = setInterval(tick, 500);
}

/* ====== Resultado (SB) ====== */
async function renderResSB(){
  const id = location.hash.split('/')[2];
  if (!id) { alert('No existe'); tab('home'); return; }

  const planRes = await window.SB_VOTES.fetchPlan(id);
  const p = planRes.data;
  if (!p) { alert('No existe'); tab('home'); return; }

  q('#rt').textContent = 'Resultado: ' + (p.title || 'Plan');
  q('#state').textContent = (p.closed ? 'Cerrada' : 'Abierta');

  const listRes = await window.SB_VOTES.fetchOptionsWithCounts(id);
  const rows = listRes.data || [];
  let max = -1, win = null, sum = 0;
  rows.forEach(r => { const v = r.votes||0; sum += v; if (v>max){max=v; win=r;} });

  const w=q('#rlist'); w.innerHTML='';
  rows.forEach(r=>{
    const d=document.createElement('div');
    d.className='opt'+(win && win.option_id===r.option_id ? ' winner':'');
    const pct = sum ? Math.round( ( (r.votes||0) / sum ) * 100 ) : 0;
    d.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:center">
        <div>${r.text}</div>
        <b>${r.votes||0}</b>
      </div>
      <div class="vbar" style="margin-top:8px"><span style="width:${pct}%"></span></div>
    `;
    w.appendChild(d);
  });

  if (win){
    q('#win').innerHTML = `<h3>🎉 Ganador: ${win.text}</h3><small class='pill'>Total votos: ${sum}</small>`;
    if (p.closed || new Date(p.deadline_ts).getTime() <= Date.now()){
      // confeti una sola vez por plan
      const flag = 'pz_fx_'+id;
      if (!localStorage.getItem(flag)){
        burstConfetti(180);
        localStorage.setItem(flag, '1');
      }
    }
  } else {
    q('#win').innerHTML = '<small class="pill">Aún no hay votos</small>';
  }
}

/* ====== Votar / Resultado / Compartir (local) ====== */
let tmr=null, tie=[];
function renderVote(){
  if (useSB()) return renderVoteSB();

  const id=location.hash.split('/')[2];
  const polls=U(K.POLLS,{});
  const p=polls[id];
  if(!p){ alert('No existe'); tab('home'); return; }
  q('#vt').textContent='Vota: '+p.title;
  q('#collab').style.display=p.collab?'inline-block':'none';
  q('#vn').value=localStorage.getItem('pz_nombre')||'';
  q('#link').textContent=location.origin+location.pathname+'#/votar/'+id;

  const w=q('#vlist'); w.innerHTML='';
  const closed=p.closed||now()>=p.deadline;

  p.options.forEach(o=>{
    const d=document.createElement('div');
    d.className='opt';
    d.innerHTML=`<div class='row'><div style='flex:1'>${o.text}</div><button class='btn s p'>Votar</button></div>`;
    const b=d.querySelector('button'); b.disabled=closed;
    b.onclick=()=>{
      const n=q('#vn').value.trim();
      if(!n){ alert('Pon tu nombre'); return; }
      localStorage.setItem('pz_nombre',n);
      o.votes=(o.votes||0)+1;
      const polls=U(K.POLLS,{});
      polls[id]=p; SVE(K.POLLS,polls);
      location.hash='#/res/'+id;
      renderRes();
      qq('.view').forEach(v=>v.classList.remove('on'));
      q('#res').classList.add('on');
    };
    w.appendChild(d);
  });

  clearInterval(tmr);
  tmr=setInterval(()=>{
    const r=Math.max(0,p.deadline-now());
    q('#rem').textContent = (p.closed?'Cerrada':Math.floor(r/60000)+'m '+Math.floor((r%60000)/1000)+'s');
  },500);
}
function contrib(){
  if (useSB()) { alert('Añadir opciones desde app (SB) no implementado aún.'); return; }
  const id=location.hash.split('/')[2], polls=U(K.POLLS,{}), p=polls[id];
  if(!p || p.closed || now()>=p.deadline){ alert('Cerrada'); return; }
  const t=prompt('Añade tu opción'); if(!t) return;
  p.options.push({id:p.options.length,text:t,votes:0});
  polls[id]=p; SVE(K.POLLS,polls);
  renderVote();
}
function goRes(){ renderRes(); qq('.view').forEach(v=>v.classList.remove('on')); q('#res').classList.add('on'); }

function renderRes(){
  if (useSB()) return renderResSB();

  const id=location.hash.split('/')[2], polls=U(K.POLLS,{}), p=polls[id];
  if(!p){ alert('No existe'); tab('home'); return; }
  q('#rt').textContent='Resultado: '+p.title;
  q('#state').textContent=(p.closed||now()>=p.deadline)?'Cerrada':'Abierta';
  const w=q('#rlist'); w.innerHTML='';
  let sum=0,max=-1,win=null;
  p.options.forEach(o=>{ sum+=(o.votes||0); if((o.votes||0)>max){ max=o.votes||0; win=o; }});
  p.options.forEach(o=>{
    const d=document.createElement('div');
    d.className='opt'+(win && win.id===o.id ? ' winner':'');
    const pct = sum ? Math.round(((o.votes||0)/sum)*100) : 0;
    d.innerHTML=`<div class='row' style='justify-content:space-between;align-items:center'>
      <div>${o.text}</div><b>${o.votes||0}</b></div>
      <div class="vbar" style="margin-top:8px"><span style="width:${pct}%"></span></div>`;
    w.appendChild(d);
  });
  if (win){
    q('#win').innerHTML=`<h3>🎉 Ganador: ${win.text}</h3><small class='pill'>Total votos: ${sum}</small>`;
    burstConfetti(150);
  } else {
    q('#win').innerHTML='<small class="pill">Aún no hay votos</small>';
  }
}
async function closeNow(){
  const id = (location.hash.split('/')[2] || '').trim();
  if (!id) return;

  // === Ruta Supabase ===
  if (useSB()){
    try{
      // 1) Marca el plan como cerrado
      if (window.SB_VOTES && typeof window.SB_VOTES.closePlan === 'function'){
        const res = await window.SB_VOTES.closePlan(id);
        if (res?.error) throw res.error;
      } else if (window.SB) {
        const { error } = await window.SB
          .from('plans')
          .update({ closed: true })
          .eq('id', id);
        if (error) throw error;
      } else {
        throw new Error('Supabase no disponible');
      }

      // 2) Muestra modal ganador (lee opciones desde la vista con counts)
      await showWinnerModalSB(id);

    }catch(err){
      console.error('[closeNow SB]', err);
      alert(err?.message || 'No se pudo cerrar la votación.');
    }
    return;
  }

  // === Ruta LOCAL (fallback con localStorage) ===
  const polls=U(K.POLLS,{}), p=polls[id];
  if(!p) return;

  p.closed=true;
  polls[id]=p;
  SVE(K.POLLS,polls);

  try { renderRes(); } catch(_) {}

  // Modal con ganador (local)
  try { showWinnerModal(p); } catch(e){ console.warn('[WinnerModal]', e); }
}


function tRand(){
  const id=location.hash.split('/')[2], polls=U(K.POLLS,{}), p=polls[id];
  if(!p || !tie.length) return;
  const chosen=tie[Math.floor(Math.random()*tie.length)];
  const opt=p.options.find(o=>o.id===chosen);
  q('#tie').style.display='none';
  q('#win').innerHTML=`<h3>🎉 Ganador (aleatorio): ${opt.text}</h3>`;
}
function tManual(){
  const id=location.hash.split('/')[2], polls=U(K.POLLS,{}), p=polls[id];
  const names=p.options.filter(o=>tie.includes(o.id)).map(o=>o.text).join(' | ');
  const pick=prompt('Elige una: '+names);
  const opt=p.options.find(o=>o.text===pick);
  if(opt){ q('#tie').style.display='none'; q('#win').innerHTML=`<h3>🎉 Ganador (manual): ${opt.text}</h3>`; }
}
function share(){
  const url=location.href, txt='Únete a decidir el plan en Planazoo';
  if(navigator.share){ navigator.share({title:'Planazoo',text:txt,url}).catch(()=>{}); }
  else { navigator.clipboard.writeText(url); alert('Enlace copiado'); }
  window.open('https://wa.me/?text='+encodeURIComponent(txt+' '+url),'_blank');
}
function publish(){
  const id=location.hash.split('/')[2], polls=U(K.POLLS,{}), p=polls[id]; if(!p){ alert('No encontrado'); return; }
  const c=U(K.COMM,COMM_DEF);
  c.push({id:'u'+id,title:p.title,desc:(p.options[0]?.text||'Plan'),rating:10,cat:(p.options[0]?.meta?.cat||'cultura')});
  SVE(K.COMM,c); alert('Publicado en comunidad'); renderComm(); renderHomeC();
}
function publishPlan(id){
  const polls=U(K.POLLS,{}), p=polls[id]; if(!p){ alert('No encontrado'); return; }
  const c=U(K.COMM,COMM_DEF);
  c.push({id:'u'+id,title:p.title,desc:(p.options[0]?.text||'Plan'),rating:10,cat:(p.options[0]?.meta?.cat||'cultura')});
  SVE(K.COMM,c); alert('Publicado en comunidad'); renderComm(); renderHomeC();
}

/* ====== Historial / valorar ====== */
let rateId=null, stars=0;
function renderHist(){
  const polls=U(K.POLLS,{}), ratings=U(K.RATE,{}), w=q('#hlist'); if (!w) return; w.innerHTML='';
  const arr=Object.values(polls).sort((a,b)=>b.when-a.when);
  if(!arr.length){ w.innerHTML='<div class="pill">No hay planes</div>'; return; }
  arr.forEach(p=>{
    const st=p.cancelled?'Cancelado':(p.closed?'Cerrado':(now()>=p.deadline?'Cerrando':'Activo'));
    const rated=ratings[p.id]?.stars;
    const d=document.createElement('div'); d.className='opt';
    d.innerHTML=`<div class='row' style='justify-content:space-between;align-items:flex-start'>
      <div><b>${p.title}</b><br><small class='pill'>${fmt(p.when)} · ${st}</small>${rated?`<br><small>★ ${rated}/5</small>`:''}</div>
      <div class='row'>
        <button class='btn s' onclick='openVote("${p.id}")'>Abrir</button>
        <button class='btn s' onclick='cancelPlan("${p.id}")'>Cancelar</button>
        <button class='btn s' onclick='delPlan("${p.id}")'>Borrar</button>
        ${(p.closed||p.cancelled||p.when<now())?`<button class='btn s' onclick='openMR("${p.id}")'>Valorar</button>`:''}
      </div>
    </div>`;
    w.appendChild(d);
  });
}
function openVote(id){
  location.hash='#/votar/'+id;
  qq('.view').forEach(v=>v.classList.remove('on'));
  q('#votar').classList.add('on');
  renderVote();
}
function delPlan(id){
  if(!confirm('¿Seguro?')) return;
  const polls=U(K.POLLS,{});
  delete polls[id]; SVE(K.POLLS,polls); renderHist();
}
function cancelPlan(id){
  const polls=U(K.POLLS,{}), p=polls[id]; if(!p) return;
  p.cancelled=true; p.closed=true; polls[id]=p; SVE(K.POLLS,polls); renderHist();
}
function openMR(id){ rateId=id; stars=0; rst(); q('#rc').value=''; q('#mr').style.display='flex'; }
function closeMR(){ q('#mr').style.display='none'; rateId=null; }
function rst(){
  const w=q('#rst'); if (!w) return; w.innerHTML='';
  for(let i=1;i<=5;i++){
    const s=document.createElement('span');
    s.className='star'+(i<=stars?' on':'');
    s.textContent='★';
    s.onclick=()=>{ stars=i; rst(); };
    w.appendChild(s);
  }
}
function saveRate(){
  if(stars<1){ alert('Selecciona estrellas'); return; }
  const r=U(K.RATE,{});
  r[rateId]={stars,comment:q('#rc').value.trim(),at:now()};
  SVE(K.RATE,r); closeMR(); alert('¡Gracias!'); renderHist();
}

/* ====== Favoritos ====== */
function gFav(){ return U(K.FAVS,[]); }
function sFav(a){ SVE(K.FAVS,a); }
function addFav(){
  const v=q('#fvi').value.trim(); if(!v) return;
  if(gFav().includes(v)){ alert('Ya existe'); return; }
  sFav([...gFav(),v]); q('#fvi').value=''; renderFavs(); rfavpick();
}
function addFavText(t){
  if(gFav().includes(t)) return;
  sFav([...gFav(),t]); renderFavs(); rfavpick();
}
function renderFavs(){
  const w=q('#fv'); if (!w) return; w.innerHTML='';
  const a=gFav();
  if(!a.length){ w.innerHTML='<div class="pill">Sin favoritos</div>'; return; }
  a.forEach(t=>{
    const d=document.createElement('div');
    d.className='opt';
    d.innerHTML=`<div class='row'>
      <div style='flex:1'>${t}</div>
      <button class='btn s p'>Añadir al plan</button>
      <button class='btn s'>Eliminar</button>
    </div>`;
    d.querySelectorAll('button')[0].onclick=()=>{ if(!Array.isArray(opts)) window.opts=[]; opts.push({t}); ropts(); };
    d.querySelectorAll('button')[1].onclick=()=>{ sFav(gFav().filter(x=>x!==t)); renderFavs(); rfavpick(); };
    w.appendChild(d);
  });
}
function rfavpick(){
  const w=q('#favpick'); if (!w) return; w.innerHTML='';
  const a=gFav();
  if(!a.length){ w.innerHTML='<div class="pill">Sin favoritos</div>'; return; }
  a.forEach(t=>{
    const d=document.createElement('div');
    d.className='opt';
    d.innerHTML=`<div class='row'><div style='flex:1'>${t}</div><button class='btn s p'>Añadir</button></div>`;
    d.querySelector('button').onclick=()=>{ if(!Array.isArray(opts)) window.opts=[]; opts.push({t}); ropts(); };
    w.appendChild(d);
  });
}

/* ====== Comunidad / Home ====== */
function gComm(){ return U(K.COMM,COMM_DEF); }
function sComm(a){ SVE(K.COMM,a); }
function renderComm(){
  const w=q('#clist'); if (!w) return; w.innerHTML='';
  gComm().sort((a,b)=>b.rating-a.rating).forEach(i=>{
    const d=document.createElement('div'); d.className='opt';
    d.innerHTML=`<b>${icon(i.cat)} ${i.title}</b><br>
      <small class='pill'>★ ${i.rating}</small>
      <div class='row' style='margin-top:6px'>
        <button class='btn s'>Me gusta</button>
        <button class='btn s p'>Añadir a mi plan</button>
        <button class='btn s'>Fav</button>
      </div>`;
    const bs=d.querySelectorAll('button');
    bs[0].onclick=()=>{ const c=gComm(); c.find(x=>x.id===i.id).rating++; sComm(c); renderComm(); renderHomeC(); };
    bs[1].onclick=()=>{ if(!Array.isArray(opts)) window.opts=[]; opts.push({t:i.title+' — '+i.desc,cat:i.cat}); ropts(); };
    bs[2].onclick=()=>addFavText(i.title+' — '+i.desc);
    w.appendChild(d);
  });
}
function renderHomeC(){
  const w=q('#homec'); if (!w) return; w.innerHTML='';
  gComm().sort((a,b)=>b.rating-a.rating).slice(0,3).forEach(i=>{
    const d=document.createElement('div'); d.className='opt';
    d.innerHTML=`<div class='row' style='justify-content:space-between'>
      <div><b>${i.title}</b><br><small class='pill'>${i.desc||''}</small></div>
      <span class='pill'>★ ${i.rating}</span>
    </div>`;
    w.appendChild(d);
  });
}

/* ====== Stats ====== */
function renderStats(){
  const st=U(K.STATS,{cats:{},tod:{},count:0}), w=q('#sw'); if (!w) return; w.innerHTML='';
  const favCat=Object.entries(st.cats).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';
  const favTod=Object.entries(st.tod).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';
  [['Categoría top',favCat],['Franja favorita',favTod],['Votos totales',st.count]].forEach(([k,v])=>{
    const d=document.createElement('div'); d.className='opt';
    d.innerHTML=`<div class='row' style='justify-content:space-between'><div>${k}</div><b>${v}</b></div>`;
    w.appendChild(d);
  });
}
function track(o){
  const st=U(K.STATS,{cats:{},tod:{},count:0});
  const cat=(o.meta&&o.meta.cat)||'otros';
  st.cats[cat]=(st.cats[cat]||0)+1;
  st.tod['tarde']=(st.tod['tarde']||0)+1;
  st.count++;
  SVE(K.STATS,st);
}

/* ====== UI wiring ====== */
function wireUI(){
  const nextBtn = q('#pn');
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.addEventListener('click', nextStep);
    nextBtn.dataset.bound = '1';
  }

  const prevBtn = q('#pb');
  if (prevBtn && !prevBtn.dataset.bound) {
    prevBtn.addEventListener('click', prevStep);
    prevBtn.dataset.bound = '1';
  }

  const s4 = q('#s4');
  if (s4) {
    const shareBtn = s4.querySelector('button.btn.p');
    if (shareBtn && !shareBtn.dataset.bound) {
      shareBtn.addEventListener('click', () => (window.createShare || createShare)());
      shareBtn.dataset.bound = '1';
    }
    const previewBtn = s4.querySelector('button.btn:not(.p)');
    if (previewBtn && !previewBtn.dataset.bound) {
      previewBtn.addEventListener('click', sharePreview);
      previewBtn.dataset.bound = '1';
    }
  }
}

/* ====== Confetti ====== */
function burstConfetti(count=120){
  const colors = ['#6C4CF5','#7D5CF8','#FFC400','#3dd68c','#ff7aa2','#65d4ff'];
  for (let i=0;i<count;i++){
    const d = document.createElement('div');
    d.className='confetti-piece';
    d.style.left = (Math.random()*100)+'vw';
    d.style.background = colors[i % colors.length];
    d.style.animationDuration = (1.6 + Math.random()*1.4)+'s';
    d.style.animationDelay = (Math.random()*0.2)+'s';
    d.style.transform = `rotate(${Math.random()*360}deg)`;
    document.body.appendChild(d);
    setTimeout(()=>{ d.remove(); }, 3500);
  }
}

/* ====== Init ====== */
function renderHome(){ renderHomeC(); tab('home'); hydrateAccount(); }
document.addEventListener('DOMContentLoaded', () => {
  renderHome();
  wireUI();
});

/* === Modal de sugerencias (compat) === */
let _sugs_parent=null, _sugs_next=null;
function _ensureSugAnchors(){
  const node=document.getElementById('sugs');
  if(node && !_sugs_parent){
    _sugs_parent=node.parentElement;
    _sugs_next=node.nextSibling;
  }
}
function openSug(){
  _ensureSugAnchors();
  const node=document.getElementById('sugs');
  const wrap=document.getElementById('sugwrap');
  if(!node || !wrap) return;
  wrap.innerHTML='';
  wrap.appendChild(node);
  genSugUI();
  const m=document.getElementById('msug');
  if(m) m.style.display='flex';
}
function closeMSug(){
  const node=document.getElementById('sugs');
  if(node && _sugs_parent){
    if(_sugs_next){ _sugs_parent.insertBefore(node,_sugs_next); }
    else { _sugs_parent.appendChild(node); }
  }
  const m=document.getElementById('msug');
  if(m) m.style.display='none';
}
document.addEventListener('click',e=>{
  const m=document.getElementById('msug');
  if(m && m.style.display==='flex' && e.target===m){ closeMSug(); }
});
if(!window.openMSug){ window.openMSug = function(){ openSug(); }; }

/* ====== Export global ====== */
Object.assign(window, {
  tab, openPrefs, savePrefs,
  openLogin, closeLogin, doLogin, demoLogin, logout,
  addFriendInput, manageFriends, closeMF, addFriendModal,
  prevStep, nextStep, addManual, sharePreview,
  createShare: window.createShare || createShare,
  contrib, goRes, closeNow, tRand, tManual, share, publish,
  openVote, delPlan, cancelPlan,
  openMR, closeMR, saveRate,
  addFav,
  renderComm, renderHomeC,
  renderStats,
  openMSug: window.openMSug || openSug,
  closeMSug,
  openSug,
  opts
});
/* === Winner Modal + Confetti (overlay) === */
/* === Winner Modal + Confetti + Share === */
function ensureWinnerModal(){
  let m = document.getElementById('mw');
  if (!m){
    m = document.createElement('div');
    m.id = 'mw';
    m.className = 'modal';
    m.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" style="max-width:520px">
        <div class="row">
          <h3 id="mw-title">Resultado</h3>
          <div style="flex:1"></div>
          <button class="btn s" id="mw-close">Cerrar</button>
        </div>
        <div id="mw-body" class="col" style="gap:12px; margin-top:6px"></div>
        <div class="row" style="margin-top:12px; gap:8px">
          <button class="btn" id="mw-share">Compartir</button>
          <div style="flex:1"></div>
          <button class="btn p" id="mw-exit">Volver al inicio</button>
        </div>
      </div>`;
    document.body.appendChild(m);

    // cerrar al pulsar fuera
    m.addEventListener('click', e=>{ if(e.target===m) hideWinnerModal(); });
    // botones hoja
    m.querySelector('#mw-close').onclick = hideWinnerModal;
    m.querySelector('#mw-exit').onclick  = ()=>{ hideWinnerModal(); tab('home'); };
    m.querySelector('#mw-share').onclick = shareWinnerFromModal;
  }
  return m;
}

// === Winner Modal (Supabase) ===
async function showWinnerModalSB(planId){
  const m = ensureWinnerModal();
  const body = m.querySelector('#mw-body');
  const titleEl = m.querySelector('#mw-title');

  // Carga plan + opciones con conteo
  let plan = null, rows = [];
  try{
    const pr = await window.SB_VOTES.fetchPlan(planId);
    plan = pr?.data || null;
  }catch(_){}
  try{
    const lr = await window.SB_VOTES.fetchOptionsWithCounts(planId);
    rows = lr?.data || [];
  }catch(_){}

  // Calcula ganadores
  let max = -1, winners = [], total = 0;
  rows.forEach(r => {
    const v = r.votes || 0;
    total += v;
    if (v > max){ max = v; winners = [r]; }
    else if (v === max){ winners.push(r); }
  });

  m.dataset.planId = planId;

  if (!rows.length){
    titleEl.textContent = 'Resultado';
    body.innerHTML = `<div class="opt"><small class="pill">No hay opciones</small></div>`;
    m.dataset.shareText = 'Consulta el resultado del plan en Planazoo';
  } else if (winners.length === 0){
    titleEl.textContent = 'Resultado';
    body.innerHTML = `<div class="opt"><small class="pill">Aún no hay votos</small></div>`;
    m.dataset.shareText = 'Consulta el resultado del plan en Planazoo';
  } else if (winners.length === 1){
    titleEl.textContent = '🎉 Ganador';
    body.innerHTML = `
      <div class="opt" style="text-align:center">
        <div class="vote-card winner" style="margin:8px auto">
          <div class="vote-title">${winners[0].text}</div>
        </div>
        <small class="pill">Total votos: ${total}</small>
      </div>`;
    m.dataset.shareText = `Ganó: ${winners[0].text}.`;
    triggerConfetti();
  } else {
    titleEl.textContent = '⚖️ Empate';
    body.innerHTML = `
      <div class="opt">
        <b>Empate detectado</b>
        <ul style="margin-top:6px">${winners.map(w=>`<li>${w.text}</li>`).join('')}</ul>
        <div class="row" style="margin-top:8px">
          <button class="btn" onclick="tRand()">Desempate aleatorio</button>
          <button class="btn" onclick="tManual()">Elegir manual</button>
        </div>
      </div>`;
    m.dataset.shareText = `Hay empate entre: ${winners.map(w=>w.text).join(' · ')}.`;
  }

  // Abre modal y bloquea scroll de fondo
  m.style.display='flex';
  document.body.classList.add('modal-open');

  // Opcional: manda al tab de resultados detrás del modal
  try {
    location.hash = '#/res/' + planId;
    typeof renderRes === 'function' && renderRes();
  } catch(_){}
}

function hideWinnerModal(){
  const m=document.getElementById('mw');
  if(m){ m.style.display='none'; document.body.classList.remove('modal-open'); }
}

/* Comparte el ganador leyendo datos del modal */
function shareWinnerFromModal(){
  const m=document.getElementById('mw');
  if(!m) return;
  const planId = m.dataset.planId || '';
  const text   = m.dataset.shareText || '¡Mira el plan ganador en Planazoo!';
  const url    = location.origin + location.pathname + '#/res/' + planId;

  if (navigator.share){
    navigator.share({ title:'Planazoo', text, url }).catch(()=>{});
  } else {
    const msg = `${text} ${url}`;
    navigator.clipboard?.writeText(msg).then(()=> alert('Enlace copiado'));
    // plus WhatsApp por comodidad
    window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
  }
}

/* Pinta el modal y prepara el texto para compartir; dispara confeti si hay ganador único */
function showWinnerModal(plan){
  const m = ensureWinnerModal();
  const body = m.querySelector('#mw-body');
  const titleEl = m.querySelector('#mw-title');

  const opts = Array.isArray(plan?.options) ? plan.options : [];
  let max = -1, winners=[];
  opts.forEach(o=>{
    const v=o.votes||0;
    if (v>max){ max=v; winners=[o]; }
    else if (v===max){ winners.push(o); }
  });
  const total = opts.reduce((s,o)=>s+(o.votes||0),0);

  // metadata para compartir
  m.dataset.planId = plan?.id || '';
  if (!winners.length){
    titleEl.textContent = 'Resultado';
    body.innerHTML = `<div class="opt"><small class="pill">Aún no hay votos</small></div>`;
    m.dataset.shareText = 'Consulta el resultado del plan en Planazoo';
  } else if (winners.length===1){
    titleEl.textContent = '🎉 Ganador';
    body.innerHTML = `
      <div class="opt" style="text-align:center">
        <div class="vote-card winner" style="margin:8px auto">
          <div class="vote-title">${winners[0].text}</div>
        </div>
        <small class="pill">Total votos: ${total}</small>
      </div>`;
    m.dataset.shareText = `Ganó: ${winners[0].text}.`;
    triggerConfetti();
  } else {
    titleEl.textContent = '⚖️ Empate';
    body.innerHTML = `
      <div class="opt">
        <b>Empate detectado</b>
        <ul style="margin-top:6px">${winners.map(w=>`<li>${w.text}</li>`).join('')}</ul>
        <div class="row" style="margin-top:8px">
          <button class="btn" onclick="tRand()">Desempate aleatorio</button>
          <button class="btn" onclick="tManual()">Elegir manual</button>
        </div>
      </div>`;
    m.dataset.shareText = `Hay empate entre: ${winners.map(w=>w.text).join(' · ')}.`;
  }

  m.style.display='flex';
  document.body.classList.add('modal-open');
}

/* Confeti (usa tu CSS existente #fx-confetti / .confetti-piece / @keyframes confetti-fall) */
function triggerConfetti(){
  let wrap = document.getElementById('fx-confetti');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.id = 'fx-confetti';
    document.body.appendChild(wrap);
  }
  wrap.innerHTML = '';
  const N = 80;
  for (let i=0;i<N;i++){
    const s = document.createElement('span');
    s.className = 'confetti-piece';
    s.style.left = (Math.random()*100)+'%';
    s.style.animationDelay = (Math.random()*0.8)+'s';
    s.style.animationDuration = (1.8 + Math.random()*1.2)+'s';
    wrap.appendChild(s);
  }
  setTimeout(()=>{ wrap.innerHTML=''; }, 2400);
}


/* === Planazoo: arnés mínimo (sin capturar clicks globales) === */
(() => {
  window.__PZ_DEBUG = true;

  // Asegura fallback local si SB no lo sobreescribe
  if (typeof window.createShareLocal !== 'function' && typeof createShare === 'function') {
    window.createShareLocal = createShare;
  }

  // Log de nextStep (no duplicamos listeners)
  if (typeof window.nextStep === 'function') {
    const _next = window.nextStep;
    window.nextStep = function () {
      if (window.__PZ_DEBUG) {
        const len = (Array.isArray(window.opts) && window.opts.length) || 0;
        console.debug('[PZ] nextStep()', { step, optsLen: len });
      }
      return _next.apply(this, arguments);
    };
  }
})();
