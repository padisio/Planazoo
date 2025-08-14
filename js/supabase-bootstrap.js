// js/supabase-bootstrap.js
(function () {
  // === Usa las globales si ya las defines en otro sitio; si no, aplica estos valores por defecto ===
  const SB_URL = window.SUPABASE_URL || "https://ggxdzwjlkqqznpzrfayl.supabase.co";
  const SB_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdneGR6d2psa3Fxem5wenJmYXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MTY4NDksImV4cCI6MjA3MDQ5Mjg0OX0.wHb_QV4t_MHSQNyBXrU3k-MTUWXn4fwhwNOw4YscyWc";

  // === Crea el cliente sólo si la librería está cargada y tenemos credenciales ===
  const hasLib = !!window.supabase;
  if (hasLib && SB_URL && SB_KEY) {
    if (!window.SB) {
      window.SB = window.supabase.createClient(SB_URL, SB_KEY, {
        auth: { storageKey: "planazoo-auth" },
      });
    }
  } else {
    console.warn(
      "[Supabase] Librería o credenciales ausentes. Modo local (sin login/backend)."
    );
  }

  // Flag práctico para el wizard
  window.__pz_is_logged = false;

  async function getSessionUser() {
    if (!window.SB) return null;
    try {
      const { data } = await window.SB.auth.getUser();
      return data?.user || null;
    } catch {
      return null;
    }
  }

  function wireAuth() {
    if (!window.SB) return;
    try {
      window.SB.auth.onAuthStateChange(async (_event, session) => {
        window.__pz_is_logged = !!(session && session.user);

        if (window.__pz_is_logged) {
          try {
            // Refresca cabecera de cuenta
            window.setUser &&
              window.setUser({
                name: session.user.email?.split("@")[0] || "Usuario",
                email: session.user.email || "",
              });
            window.closeLogin && window.closeLogin();
          } catch (e) {
            console.warn("[Supabase] post-auth UI", e);
          }
        }
      });
    } catch (e) {
      console.warn("[Supabase] onAuthStateChange wiring failed", e);
    }
  }
  wireAuth();

  // Magic link (maneja #access_token en la URL)
  (function handleMagicLink() {
    if (!window.SB) return;
    try {
      const h = (window.location.hash || "").replace(/^#/, "");
      if (!h) return;
      const p = new URLSearchParams(h);
      const at = p.get("access_token");
      const rt = p.get("refresh_token");
      if (at && rt) {
        window.SB.auth
          .setSession({ access_token: at, refresh_token: rt })
          .then(() => {
            history.replaceState({}, document.title, location.pathname + location.search);
          });
      }
    } catch (e) {
      console.warn("[Supabase] handleMagicLink", e);
    }
  })();

  // Exponer doLogin (si no hay SB, avisa)
  window.doLogin = async function () {
    if (!window.SB) {
      alert("Login no disponible, Supabase no inicializado");
      return;
    }
    const email = document.querySelector("#le")?.value?.trim();
    if (!email) {
      alert("Escribe tu email");
      return;
    }
    try {
      await window.SB.auth.signInWithOtp({ email });
      alert("Te he enviado un enlace de acceso. Revisa tu correo.");
    } catch (err) {
      console.error("[Supabase] signInWithOtp", err);
      alert(err?.message || "No se pudo enviar el enlace de acceso");
    }
  };

  async function requireLogin() {
    const u = await getSessionUser();
    if (!u) {
      window.openLogin && window.openLogin();
      throw new Error("Inicia sesión para crear");
    }
    return u;
  }

// --- Implementación Supabase de createShare (con espejo a localStorage) ---
async function createShareSB() {
  if (!window.SB) throw new Error("Supabase no disponible");

  const $ = (s) => document.querySelector(s);
  const toISO = (v) => (v ? new Date(v).toISOString() : new Date().toISOString());

  // Utilidades locales por si U/SVE no existen en este archivo
  const getLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const setLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // 1) Validaciones previas
  if (typeof window.guardDetails === "function" && !window.guardDetails()) return;

  const user = await (async function requireLogin() {
    const { data } = await window.SB.auth.getUser();
    const u = data?.user || null;
    if (!u) {
      window.openLogin && window.openLogin();
      throw new Error("Inicia sesión para crear");
    }
    return u;
  })();

  if (!Array.isArray(window.opts) || window.opts.length < 1) {
    alert("Añade al menos 1 actividad");
    return;
  }

  const title = $("#pt")?.value?.trim();
  const city = $("#pc")?.value?.trim() || null;
  const whenInput = $("#pd")?.value;
  const dlMin = Math.max(10, Math.min(1440, parseInt($("#pl")?.value || "120", 10)));

  if (!title || !whenInput) {
    alert("Completa título y fecha/hora");
    return;
  }

  const when_ts = toISO(whenInput);
  const deadline_ts = new Date(Date.now() + dlMin * 60000).toISOString();

  // 2) Inserta plan
  const planIns = await window.SB.from("plans")
    .insert({
      owner_id: user.id,
      title,
      city,
      when_ts,
      deadline_ts,
      collab: true,
      closed: false,
      cancelled: false,
      is_public: true,
    })
    .select()
    .single();
  if (planIns.error) throw planIns.error;

  // 3) Inserta bloque
  const blockIns = await window.SB.from("plan_blocks")
    .insert({ plan_id: planIns.data.id, title: "Bloque 1", sort_order: 1 })
    .select()
    .single();
  if (blockIns.error) throw blockIns.error;

  // 4) Inserta opciones (desde window.opts)
  const rows = window.opts.map((o) => ({
    block_id: blockIns.data.id,
    text: o.t,
    cat: o.cat || null,
    place: null,
    price_num: null,
    created_by: user.id,
  }));
  const optIns = await window.SB.from("block_options").insert(rows);
  if (optIns.error) throw optIns.error;

  // 5) PATCH: espejo a localStorage para que renderVote() encuentre el plan
  //    (la UI legacy lee K.POLLS de localStorage)
  const K_POLLS = "pz_polls";
  const invitedRaw = ($("#chips")?.dataset.sel || "[]");
  let invited = [];
  try { invited = JSON.parse(invitedRaw || "[]"); } catch { invited = []; }

  const optionsLS = (Array.isArray(window.opts) ? window.opts : []).map((o, i) => ({
    id: i,
    text: o.t,
    votes: 0,
    meta: o.cat ? { cat: o.cat } : null,
  }));

  const polls = getLS(K_POLLS, {});
  polls[planIns.data.id] = {
    id: planIns.data.id,
    title,
    options: optionsLS,
    createdAt: Date.now(),
    deadline: new Date(deadline_ts).getTime(), // número (ms) para tu UI
    when: new Date(when_ts).getTime(),         // número (ms) para tu UI
    closed: false,
    collab: true,
    invited,
    owner: user.email || user.id,
    rating: 0,
    cancelled: false,
  };
  setLS(K_POLLS, polls);

  // 6) Navega a votar y reutiliza tu UI
  location.hash = "#/votar/" + planIns.data.id;
  if (typeof window.renderVote === "function") window.renderVote();
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("on"));
  document.getElementById("votar")?.classList.add("on");
}


  // Sólo sobrescribe createShare si SB está disponible; si no, deja la local
  if (window.SB) {
    window.createShare = createShareSB;
  } else if (!window.createShare && typeof window.createShareLocal === "function") {
    window.createShare = window.createShareLocal;
  }

  // Realtime (no crítico)
  try {
    if (window.SB && typeof window.SB.channel === "function") {
      window.SB.channel("plans-inserts")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "plans" },
          (payload) => console.log("📥 Nuevo plan en Supabase:", payload.new)
        )
        .subscribe((status) => console.log("[Realtime] status:", status));
    }
  } catch (e) {
    console.warn("[Realtime] desactivado:", e);
  }
})();
/* === Votación en tiempo real (Supabase) === */
(function () {
  if (!window.SB) return; // si no hay SB, dejamos que app.js use el modo local

  // Estado interno del modo SB
  const SB_STATE = {
    plan: null,         // { id, title, deadline_ts, closed, collab }
    options: [],        // [{ option_id, text, votes, cat, block_id, plan_id }]
    blocks: [],         // [{ id, sort_order }]
    channel: null       // suscripción realtime
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const now = () => Date.now();

  async function fetchPlan(planId) {
    const planQ = window.SB
      .from('plans')
      .select('id,title,deadline_ts,closed,collab')
      .eq('id', planId)
      .single();

    const blocksQ = window.SB
      .from('plan_blocks')
      .select('id,sort_order')
      .eq('plan_id', planId)
      .order('sort_order', { ascending: true });

    const optionsQ = window.SB
      .from('plan_options_with_counts')
      .select('*')
      .eq('plan_id', planId);

    const [{ data: plan, error: e1 },
           { data: blocks, error: e2 },
           { data: options, error: e3 }] = await Promise.all([planQ, blocksQ, optionsQ]);

    if (e1) throw e1;
    if (e2) throw e2;
    if (e3) throw e3;

    SB_STATE.plan    = plan;
    SB_STATE.blocks  = blocks || [];
    SB_STATE.options = (options || []).sort((a,b) => (b.votes - a.votes));
  }

  function paintVoteUI() {
    const p = SB_STATE.plan;
    const options = SB_STATE.options || [];

    if (!p) return;

    // Cabecera y chips
    const id = p.id;
    $('#vt').textContent = 'Vota: ' + (p.title || 'Plan');
    $('#collab').style.display = p.collab ? 'inline-block' : 'none';
    $('#link').textContent = location.origin + location.pathname + '#/votar/' + id;

    // Lista de opciones
    const w = $('#vlist');
    w.innerHTML = '';
    const isClosed = p.closed || (p.deadline_ts && now() >= Date.parse(p.deadline_ts));

    options.forEach(o => {
      const d = document.createElement('div');
      d.className = 'opt';
      d.innerHTML = `
        <div class='row' style='justify-content:space-between;align-items:center'>
          <div style='flex:1'>${o.text}</div>
          <div class='row' style='gap:10px;align-items:center'>
            <b>${o.votes || 0}</b>
            <button class='btn s p' data-opt='${o.option_id}'>Votar</button>
          </div>
        </div>`;
      const btn = d.querySelector('button');
      btn.disabled = !!isClosed;
      btn.onclick = () => castVoteSB(o.option_id);
      w.appendChild(d);
    });

    // Temporizador
    clearInterval(window.__pz_timer);
    window.__pz_timer = setInterval(() => {
      if (!p.deadline_ts) { $('#rem').textContent = '—'; return; }
      const r = Math.max(0, Date.parse(p.deadline_ts) - now());
      $('#rem').textContent = (p.closed ? 'Cerrada' : Math.floor(r/60000)+'m '+Math.floor((r%60000)/1000)+'s');
    }, 500);
  }

  async function refreshOptionsCounts() {
    if (!SB_STATE.plan) return;
    const { data, error } = await window.SB
      .from('plan_options_with_counts')
      .select('*')
      .eq('plan_id', SB_STATE.plan.id);
    if (error) return;
    SB_STATE.options = (data || []).sort((a,b)=> (b.votes - a.votes));
    paintVoteUI();
  }

  function wireRealtime(planId) {
    // Limpia suscripción previa
    try { SB_STATE.channel && window.SB.removeChannel(SB_STATE.channel); } catch (_) {}

    // Nota: filtramos por plan_id en votes; en block_options validamos en callback
    const ch = window.SB.channel(`plan-${planId}-realtime`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'votes',
        filter: `plan_id=eq.${planId}`
      }, async (_payload) => {
        // Alguien ha votado -> refresca contadores
        refreshOptionsCounts();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'block_options'
      }, async (payload) => {
        // Nueva opción: si pertenece a un bloque de este plan, refrescamos lista
        const belongs = (SB_STATE.blocks || []).some(b => b.id === payload.new.block_id);
        if (belongs) {
          await refreshOptionsCounts();
        }
      });

    ch.subscribe((status) => console.log('[Realtime]', status));
    SB_STATE.channel = ch;
  }

  async function castVoteSB(optionId) {
    try {
      // requiere login para votar (RLS)
      const { data: userData } = await window.SB.auth.getUser();
      if (!userData?.user) { window.openLogin && window.openLogin(); return; }

      const voter_name = $('#vn')?.value?.trim() || null;

      const { error } = await window.SB
        .from('votes')
        .insert({
          // plan_id: lo rellena el trigger
          option_id,
          user_id: userData.user.id,
          voter_name
        });
      if (error) throw error;

      await refreshOptionsCounts(); // si tienes esa función accesible aquí

      // Opcional: navegar a resultados inmediatamente, como hacía tu flujo
      location.hash = '#/res/' + SB_STATE.plan.id;
      typeof window.renderRes === 'function' && window.renderRes();
      $$('.view').forEach(v=>v.classList.remove('on'));
      $('#res')?.classList.add('on');
    } catch (e) {
      console.error('[PZ] castVoteSB', e);
      alert(e?.message || 'No se pudo votar');
    }
  }

  async function contribSB() {
    try {
      if (!SB_STATE.plan) return;
      // comprobar cierre
      const closed = SB_STATE.plan.closed || (SB_STATE.plan.deadline_ts && now() >= Date.parse(SB_STATE.plan.deadline_ts));
      if (closed) { alert('Cerrada'); return; }

      // login requerido para añadir opción
      const { data: userData } = await window.SB.auth.getUser();
      if (!userData?.user) { window.openLogin && window.openLogin(); return; }

      const t = prompt('Añade tu opción'); if (!t) return;

      // Primer bloque del plan (por defecto creamos uno al generar el plan)
      const blockId = (SB_STATE.blocks[0] && SB_STATE.blocks[0].id) || null;
      if (!blockId) { alert('No se encontró el bloque del plan'); return; }

      const { error } = await window.SB.from('block_options').insert({
        block_id: blockId,
        text: t,
        cat: null,
        place: null,
        price_num: null,
        created_by: userData.user.id
      });
      if (error) throw error;
      // Realtime añadirá la opción, pero forzamos refresh por si tarda
      refreshOptionsCounts();
    } catch (e) {
      console.error('[PZ] contribSB', e);
      alert(e?.message || 'No se pudo añadir la opción');
    }
  }

  async function renderVoteSB(planIdFromHash) {
    try {
      // coge el id del hash si no se pasó
      const planId =
        planIdFromHash ||
        (location.hash.split('/')[2] || '').trim();

      if (!planId) { alert('No existe'); window.tab && window.tab('home'); return; }

      await fetchPlan(planId);
      paintVoteUI();
      wireRealtime(planId);
    } catch (e) {
      console.error('[PZ] renderVoteSB', e);
      alert('No existe');
      window.tab && window.tab('home');
    }
  }

  async function renderResSB() {
    try {
      const planId = (location.hash.split('/')[2] || '').trim();
      if (!planId) { alert('No existe'); window.tab && window.tab('home'); return; }

      // reutilizamos la vista para obtener conteos
      const { data: plan, error: e1 } = await window.SB
        .from('plans')
        .select('id,title,deadline_ts,closed')
        .eq('id', planId).single();
      if (e1) throw e1;
      const { data: opts, error: e2 } = await window.SB
        .from('plan_options_with_counts')
        .select('*')
        .eq('plan_id', planId);
      if (e2) throw e2;

      const w = $('#rlist'); w.innerHTML = '';
      $('#rt').textContent = 'Resultado: ' + (plan.title || 'Plan');

      const isClosed = plan.closed || (plan.deadline_ts && now() >= Date.parse(plan.deadline_ts));
      $('#state').textContent = isClosed ? 'Cerrada' : 'Abierta';

      let sum = 0, max = -1, win = null;
      (opts || []).forEach(o => {
        sum += (o.votes || 0);
        if ((o.votes || 0) > max) { max = o.votes || 0; win = o; }
      });

      (opts || []).forEach(o => {
        const d = document.createElement('div');
        d.className = 'opt';
        d.innerHTML = `<div class='row' style='justify-content:space-between'><div>${o.text}</div><b>${o.votes || 0}</b></div>`;
        w.appendChild(d);
      });

      const leaders = (opts || []).filter(o => (o.votes || 0) === max);
      if (leaders.length > 1 && isClosed) {
        $('#tie').style.display = 'block';
        const tw = $('#tieopts'); tw.innerHTML = '';
        leaders.forEach(o => {
          const d = document.createElement('div');
          d.className = 'opt'; d.textContent = o.text; tw.appendChild(d);
        });
        $('#win').innerHTML = '<small class="pill">Empate detectado</small>';
        window.tie = leaders.map(o => o.option_id); // conserva API antigua
      } else {
        $('#tie').style.display = 'none';
        $('#win').innerHTML = win
          ? `<h3>🎉 Ganador: ${win.text}</h3><small class='pill'>Total votos: ${sum}</small>`
          : '<small class="pill">Aún no hay votos</small>';
      }
    } catch (e) {
      console.error('[PZ] renderResSB', e);
      alert('No existe');
      window.tab && window.tab('home');
    }
  }
  // ====== VOTING & RESULTS overrides (SB) ======
(function(){
  if (!window.SB) return; // si no hay Supabase, seguimos usando la versión local

  const $ = (s) => document.querySelector(s);

  async function fetchPlanAndOptions(planId){
    // plan
    const p = await window.SB.from('plans')
      .select('id,title,deadline_ts,collab,closed,cancelled')
      .eq('id', planId)
      .single();
    if (p.error) throw p.error;
    // opciones + votos (vista)
    const o = await window.SB.from('plan_options_with_counts')
      .select('option_id,text,cat,block_id,plan_id,votes')
      .eq('plan_id', planId)
      .order('option_id', { ascending: true });
    if (o.error) throw o.error;

    return { plan: p.data, options: o.data || [] };
  }

  async function castVoteSB(planId, optionId){
    const name = $('#vn')?.value?.trim();
    if (!name){ alert('Pon tu nombre'); return; }

    // guardamos el nombre localmente como hacía tu versión
    try { localStorage.setItem('pz_nombre', name); } catch(_){}

    // requerir login (como en createShare)
    const { data: userData } = await window.SB.auth.getUser();
    if (!userData?.user){ window.openLogin && window.openLogin(); return; }

    // Insertamos voto. El trigger set_vote_plan_id rellenará plan_id desde option_id
    const ins = await window.SB.from('votes').insert({
      option_id: optionId,
      user_id: userData.user.id,
      voter_name: name
    });
    if (ins.error) {
      console.error('[SB] insert vote', ins.error);
      alert(ins.error.message || 'No se pudo votar');
      return;
    }

    // Ir a resultados
    location.hash = '#/res/' + planId;
    await renderResSB(); // mostramos el resultado ya con conteos
    // mostrar vista
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('on'));
    $('#res')?.classList.add('on');
  }

  // Countdown helper
  function startDeadlineTimer(deadlineISO){
    const lbl = $('#rem');
    if (!lbl) return;
    const deadline = new Date(deadlineISO).getTime();
    if (isNaN(deadline)) { lbl.textContent = '—'; return; }
    // usa el tmr global si existe
    try { if (window.tmr) clearInterval(window.tmr); } catch(_){}
    window.tmr = setInterval(()=>{
      const r = Math.max(0, deadline - Date.now());
      const m = Math.floor(r/60000);
      const s = Math.floor((r%60000)/1000);
      lbl.textContent = m+'m '+s+'s';
    }, 500);
  }

  async function renderVoteSB(){
    const planId = (location.hash.split('/')[2] || '').trim();
    if (!planId) { alert('No existe'); window.tab && window.tab('home'); return; }

    let data;
    try { data = await fetchPlanAndOptions(planId); }
    catch(e){ console.error('[SB] renderVote fetch', e); alert('No existe'); window.tab && window.tab('home'); return; }

    const { plan, options } = data;

    // Header
    $('#vt') && ($('#vt').textContent = 'Vota: ' + (plan?.title || 'Plan'));
    $('#collab') && ($('#collab').style.display = (plan?.collab ? 'inline-block' : 'none'));
    const vn = $('#vn'); if (vn) vn.value = (localStorage.getItem('pz_nombre') || '');

    // Lista
    const w = $('#vlist'); if (w) w.innerHTML = '';
    const closed = !!(plan?.closed || plan?.cancelled);
    const expired = plan?.deadline_ts ? (Date.now() >= new Date(plan.deadline_ts).getTime()) : false;
    const isClosed = closed || expired;

    (options || []).forEach(o=>{
      const d = document.createElement('div');
      d.className = 'opt';
      d.innerHTML = `
        <div class='row'>
          <div style='flex:1'>${o.text}</div>
          <button class='btn s p'>Votar</button>
        </div>`;
      const b = d.querySelector('button');
      b.disabled = isClosed;
      b.onclick = ()=> castVoteSB(plan.id, o.option_id);
      w && w.appendChild(d);
    });

    // Enlace
    const link = $('#link');
    if (link) link.textContent = location.origin + location.pathname + '#/votar/' + planId;

    // Timer
    if (plan?.deadline_ts) startDeadlineTimer(plan.deadline_ts);
  }

  async function renderResSB(){
    const planId = (location.hash.split('/')[2] || '').trim();
    if (!planId) { alert('No existe'); window.tab && window.tab('home'); return; }

    let data;
    try { data = await fetchPlanAndOptions(planId); }
    catch(e){ console.error('[SB] renderRes fetch', e); alert('No existe'); window.tab && window.tab('home'); return; }

    const { plan, options } = data;

    $('#rt') && ($('#rt').textContent = 'Resultado: ' + (plan?.title || 'Plan'));
    $('#state') && ($('#state').textContent = (plan?.closed || plan?.cancelled || (plan?.deadline_ts && Date.now() >= new Date(plan.deadline_ts).getTime())) ? 'Cerrada' : 'Abierta');

    const w = $('#rlist'); if (w) w.innerHTML = '';

    let sum = 0, max = -1;
    (options || []).forEach(o => { sum += (o.votes || 0); if ((o.votes||0) > max) max = (o.votes||0); });

    (options || []).forEach(o=>{
      const d = document.createElement('div');
      d.className = 'opt';
      d.innerHTML = `
        <div class='row' style='justify-content:space-between'>
          <div>${o.text}</div><b>${o.votes || 0}</b>
        </div>`;
      w && w.appendChild(d);
    });

    const leaders = (options || []).filter(o => (o.votes||0) === max);
    const tieBox = $('#tie');
    const tieOpts = $('#tieopts');
    const winBox = $('#win');

    if (leaders.length > 1 && (plan?.closed || (plan?.deadline_ts && Date.now() >= new Date(plan.deadline_ts).getTime()))){
      if (tieBox) tieBox.style.display = 'block';
      if (tieOpts) {
        tieOpts.innerHTML = '';
        leaders.forEach(o=>{
          const d=document.createElement('div');
          d.className='opt';
          d.textContent=o.text;
          tieOpts.appendChild(d);
        });
      }
      if (winBox) winBox.innerHTML = '<small class="pill">Empate detectado</small>';
      // guardamos ids de opciones empatadas por si usas tRand/tManual
      window.tie = leaders.map(o=>o.option_id);
    } else {
      if (tieBox) tieBox.style.display = 'none';
      const win = (options || []).find(o => (o.votes||0) === max) || null;
      if (winBox) winBox.innerHTML = win
        ? `<h3>🎉 Ganador: ${win.text}</h3><small class='pill'>Total votos: ${sum}</small>`
        : '<small class="pill">Aún no hay votos</small>';
    }
  }

  // Activa los overrides SB (solo si hay cliente SB)
  window.renderVote = renderVoteSB;
  window.renderRes  = renderResSB;

  // Si tienes botones "Ver resultados" que navegan y luego llaman renderRes,
  // esto garantiza que usen la versión SB en cuanto exista SB.
})();


  // Exporta funciones SB al global
  Object.assign(window, {
    renderVoteSB,
    renderResSB,
    castVoteSB,
    contribSB
  });
})();
