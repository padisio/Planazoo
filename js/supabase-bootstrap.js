// js/supabase-bootstrap.js
// Bootstrap robusto de Supabase + override fiable de createShare()

(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  function log()  { try { console.log('[Supabase]', ...arguments); } catch(_){} }
  function warn() { try { console.warn('[Supabase]', ...arguments); } catch(_){} }
  function err()  { try { console.error('[Supabase]', ...arguments); } catch(_){} }

  // Crear cliente (una sola vez)
  if (!window.SB && window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    window.SB = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
      auth: { storageKey: 'planazoo-auth' }
    });
  }

  function sbReady() {
    return !!(window.SB && window.SB.auth && window.SB.from);
  }

  async function refreshAuthFlag() {
    try {
      if (!sbReady()) { window.__pz_is_logged = !!(window.user && window.user()); return; }
      const { data: { user } } = await window.SB.auth.getUser();
      window.__pz_is_logged = !!user;
    } catch (_) {
      window.__pz_is_logged = !!(window.user && window.user());
    }
  }

  // Wire auth state changes
  (async function wireAuth() {
    if (!sbReady()) { await refreshAuthFlag(); return; }
    await refreshAuthFlag();
    try {
      window.SB.auth.onAuthStateChange(async (_event, session) => {
        window.__pz_is_logged = !!(session && session.user);
        if (session && session.user && typeof window.setUser === 'function') {
          try {
            window.setUser({ name: session.user.email?.split('@')[0] || 'Usuario', email: session.user.email || '' });
          } catch(_) {}
        }
      });
    } catch (e) {
      warn('onAuthStateChange wiring failed', e);
    }
  })();

  // Login por Magic Link (sobrescribe si ya existía una versión local)
  window.doLogin = async function () {
    try {
      const email = $('#le')?.value?.trim();
      if (!email) { alert('Escribe tu email'); return; }
      if (!sbReady()) { alert('Login no disponible (Supabase no inicializado)'); return; }
      await window.SB.auth.signInWithOtp({ email });
      alert('Te envié un enlace por email. Ábrelo para entrar.');
    } catch (e) {
      alert('Error enviando enlace: ' + (e?.message || e));
    }
  };

  // Helper para ISO
  const toISO = (v) => (v ? new Date(v).toISOString() : new Date().toISOString());

  // Override único y visible en window
  window.createShare = async function () {
    // SB no disponible: usa la versión local si existe
    if (!sbReady()) {
      if (typeof window.createShareLocal === 'function') {
        return window.createShareLocal();
      }
      throw new Error('Supabase no disponible y no hay createShareLocal');
    }

    // Validación de UI
    const title = $('#pt')?.value?.trim();
    const city  = $('#pc')?.value?.trim() || null;
    const dlMin = Math.max(10, Math.min(1440, parseInt($('#pl')?.value || '120', 10)));
    const whenInput = $('#pd')?.value;

    if (!title || !whenInput) throw new Error('Completa título y fecha/hora');

    const list = Array.isArray(window.opts) ? window.opts : [];
    if (!list.length) throw new Error('Añade al menos 1 actividad');

    // Requiere usuario
    const { data: { user } } = await window.SB.auth.getUser();
    if (!user) { window.openLogin?.(); throw new Error('Inicia sesión para crear'); }

    // Inserta plan + bloque + opciones
    const when_ts = toISO(whenInput);
    const deadline_ts = new Date(Date.now() + dlMin * 60000).toISOString();

    const planIns = await window.SB.from('plans').insert({
      owner_id: user.id,
      title, city, when_ts, deadline_ts,
      collab: true, closed: false, cancelled: false, is_public: true
    }).select().single();
    if (planIns.error) throw planIns.error;

    const blockIns = await window.SB.from('plan_blocks').insert({
      plan_id: planIns.data.id, title: 'Bloque 1', sort_order: 1
    }).select().single();
    if (blockIns.error) throw blockIns.error;

    const rows = list.map(o => ({
      block_id: blockIns.data.id,
      text: o.t,
      cat: o.cat || null,
      place: null,
      price_num: null,
      created_by: user.id
    }));
    const optsIns = await window.SB.from('block_options').insert(rows);
    if (optsIns.error) throw optsIns.error;

    // Navega a votar con tu UI
    location.hash = '#/votar/' + planIns.data.id;
    if (typeof window.renderVote === 'function') { await window.renderVote(); }
    $$('.view').forEach(v => v.classList.remove('on'));
    $('#votar')?.classList.add('on');
  };

  // Realtime (no obligatorio)
  try {
    if (sbReady() && typeof window.SB.channel === 'function') {
      const ch = window.SB.channel('plans-inserts')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'plans' }, (payload) => {
          log('📥 Nuevo plan:', payload.new);
        });

      ch.subscribe((status) => log('[Realtime] status:', status));
    } else {
      log('[Realtime] SB no disponible o API channel no encontrada');
    }
  } catch (e) {
    warn('[Realtime] desactivado:', e);
  }
})();
