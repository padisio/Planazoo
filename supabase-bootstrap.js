// === Supabase bootstrap (idempotente) ===
window.SUPABASE_URL = window.SUPABASE_URL || "https://ggxdzwjlkqqznpzrfayl.supabase.co";
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdneGR6d2psa3Fxem5wenJmYXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MTY4NDksImV4cCI6MjA3MDQ5Mjg0OX0.wHb_QV4t_MHSQNyBXrU3k-MTUWXn4fwhwNOw4YscyWc";

if (!window.SB && window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
  window.SB = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { storageKey: 'planazoo-auth' }
  });
}

// === Auth wiring + Magic Link handler (idempotente) ===
(function(){
  function wireAuth(){
    if (!window.SB || window.__pz_auth_wired) return;
    window.__pz_auth_wired = true;
    try{
      window.SB.auth.onAuthStateChange(async (_event, session) => {
        if (session && session.user){
          try{
            if (typeof setUser === 'function'){
              setUser({ name: session.user.email?.split('@')[0] || 'Usuario', email: session.user.email || '' });
            }
            try{
              await window.SB.from('users').upsert({
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.name || null
              });
            }catch(_){}
            if (typeof closeLogin === 'function') closeLogin();
            try { alert('Sesión iniciada'); } catch(_){}
          }catch(e){ console.warn('[Planazoo] post-auth actions', e); }
        }
      });
    }catch(e){ console.warn('[Planazoo] onAuthStateChange wiring failed', e); }
  }

  async function handleMagicReturn(){
    try{
      const h = window.location.hash && window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
      if (!h) { wireAuth(); return; }
      const p = new URLSearchParams(h);
      const at = p.get('access_token');
      const rt = p.get('refresh_token');
      if (at && rt && window.SB){
        await window.SB.auth.setSession({ access_token: at, refresh_token: rt });
        history.replaceState({}, document.title, location.pathname + location.search);
      }
    }catch(e){ console.warn('[Planazoo] handleMagicReturn', e); }
    wireAuth();
  }

  // Reemplazamos doLogin por Magic Link si SB está disponible
  window.doLogin = async function(){
    const e = document.querySelector('#le')?.value?.trim();
    if(!e){ alert('Escribe tu email'); return; }
    if(!window.SB){ alert('Auth no disponible.'); return; }
    try{
      await window.SB.auth.signInWithOtp({ email: e });
      alert('Te he enviado un enlace de acceso. Abre tu correo y pulsa el botón para entrar.');
    }catch(err){
      alert('Error enviando enlace: '+(err?.message||err));
    }
  };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', handleMagicReturn);
  } else {
    handleMagicReturn();
  }
})();

// === Override createShare para usar Supabase si está disponible ===
(function(){
  const toISO=v=>v?new Date(v).toISOString():new Date().toISOString();
  async function requireLogin(){
    const u=(await SB.auth.getUser()).data.user;
    if(!u){ openLogin?.(); alert('Inicia sesión para crear'); throw new Error('No logueado'); }
    return u;
  }

  if (window.SB){
    const localCreate = window.createShare;
    window.createShare = async function(){
      try{
        if(typeof guardDetails==='function' && !guardDetails()) return;
        const user = await requireLogin();

        const title = document.querySelector('#pt')?.value?.trim();
        const city  = document.querySelector('#pc')?.value?.trim() || null;
        const dlMin = Math.max(10, Math.min(1440, parseInt(document.querySelector('#pl')?.value || '120',10)));
        const whenInput = document.querySelector('#pd')?.value;
        if(!title || !whenInput){ alert('Completa título y fecha/hora'); return; }
        if(!window.opts || !window.opts.length){ alert('Añade al menos 1 actividad'); return; }

        const when_ts = toISO(whenInput);
        const deadline_ts = new Date(Date.now()+dlMin*60000).toISOString();

        const planIns = await SB.from('plans').insert({
          owner_id: user.id,
          title, city, when_ts, deadline_ts,
          collab: true, closed: false, cancelled: false, is_public: true
        }).select().single();
        if(planIns.error){ console.error(planIns.error); alert('Error plan: '+planIns.error.message); return; }

        const blockIns = await SB.from('plan_blocks').insert({
          plan_id: planIns.data.id, title:'Bloque 1', sort_order:1
        }).select().single();
        if(blockIns.error){ console.error(blockIns.error); alert('Error bloque: '+blockIns.error.message); return; }

        const rows = window.opts.map(o=>({
          block_id: blockIns.data.id,
          text: o.t,
          cat: o.cat || null,
          place: null,
          price_num: null,
          created_by: user.id
        }));
        const optsIns = await SB.from('block_options').insert(rows);
        if(optsIns.error){ console.error(optsIns.error); alert('Error opciones: '+optsIns.error.message); return; }

        location.hash = '#/votar/'+planIns.data.id;
        if(typeof window.renderVote === 'function'){ await window.renderVote(); }
        document.querySelectorAll('.view').forEach(v=>v.classList.remove('on'));
        document.querySelector('#votar')?.classList.add('on');
      }catch(e){
        console.error('[Planazoo] createShare', e);
        alert('No se pudo crear el plan (ver consola).');
        try{ if (typeof localCreate==='function') localCreate(); }catch(_){}
      }
    };
  }

  // Realtime example (best-effort)
  try{
    if (window.SB && typeof SB.channel === 'function') {
      const ch = SB.channel('plans-inserts')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'plans' }, (payload) => {
          console.log('📥 Nuevo plan en Supabase:', payload.new);
        });
      ch.subscribe((status) => console.log('[Realtime] status:', status));
    } else {
      console.log('[Realtime] SB no disponible o API channel no encontrada');
    }
  } catch (e) {
    console.warn('[Realtime] desactivado:', e);
  }
})();
