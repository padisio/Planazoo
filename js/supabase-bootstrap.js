// js/supabase-bootstrap.js
(function () {
  // === Config ===
  const SB_URL = window.SUPABASE_URL || "https://ggxdzwjlkqqznpzrfayl.supabase.co";
  const SB_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdneGR6d2psa3Fxem5wenJmYXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MTY4NDksImV4cCI6MjA3MDQ5Mjg0OX0.wHb_QV4t_MHSQNyBXrU3k-MTUWXn4fwhwNOw4YscyWc";

  // === Client ===
  const hasLib = !!window.supabase;
  if (hasLib && SB_URL && SB_KEY) {
    if (!window.SB) {
      window.SB = window.supabase.createClient(SB_URL, SB_KEY, {
        auth: { storageKey: "planazoo-auth" },
      });
    }
  } else {
    console.warn("[Supabase] Librería/credenciales ausentes. Modo local.");
  }

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
            window.setUser && window.setUser({
              name: session.user.email?.split("@")[0] || "Usuario",
              email: session.user.email || "",
            });
            window.closeLogin && window.closeLogin();
          } catch (e) { console.warn("[Supabase] post-auth UI", e); }
        }
      });
    } catch (e) {
      console.warn("[Supabase] onAuthStateChange wiring failed", e);
    }
  }
  wireAuth();

  // Magic link
  (function handleMagicLink() {
    if (!window.SB) return;
    try {
      const h = (window.location.hash || "").replace(/^#/, "");
      if (!h) return;
      const p = new URLSearchParams(h);
      const at = p.get("access_token");
      const rt = p.get("refresh_token");
      if (at && rt) {
        window.SB.auth.setSession({ access_token: at, refresh_token: rt })
          .then(() => history.replaceState({}, document.title, location.pathname + location.search));
      }
    } catch (e) { console.warn("[Supabase] handleMagicLink", e); }
  })();

  // doLogin
  window.doLogin = async function () {
    if (!window.SB) { alert("Login no disponible, Supabase no inicializado"); return; }
    const email = document.querySelector("#le")?.value?.trim();
    if (!email) { alert("Escribe tu email"); return; }
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
      throw new Error("Inicia sesión para crear o votar");
    }
    return u;
  }

  // === createShare (Supabase) ===
  async function createShareSB() {
    if (!window.SB) throw new Error("Supabase no disponible");

    const $ = (s) => document.querySelector(s);
    const toISO = (v) => (v ? new Date(v).toISOString() : new Date().toISOString());

    if (typeof window.guardDetails === "function" && !window.guardDetails()) return;

    const user = await requireLogin();

    if (!Array.isArray(window.opts) || window.opts.length < 1) {
      alert("Añade al menos 1 actividad");
      return;
    }

    const title = $("#pt")?.value?.trim();
    const city = $("#pc")?.value?.trim() || null;
    const whenInput = $("#pd")?.value;
    const dlMin = Math.max(10, Math.min(1440, parseInt($("#pl")?.value || "120", 10)));

    if (!title || !whenInput) { alert("Completa título y fecha/hora"); return; }

    const when_ts = toISO(whenInput);
    const deadline_ts = new Date(Date.now() + dlMin * 60000).toISOString();

    // 1) plan
    const planIns = await window.SB.from("plans")
      .insert({
        owner_id: user.id,
        title, city, when_ts, deadline_ts,
        collab: true, closed: false, cancelled: false, is_public: true,
      })
      .select().single();
    if (planIns.error) throw planIns.error;

    // 2) bloque
    const blockIns = await window.SB.from("plan_blocks")
      .insert({ plan_id: planIns.data.id, title: "Bloque 1", sort_order: 1 })
      .select().single();
    if (blockIns.error) throw blockIns.error;

    // 3) opciones
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

    // 4) navegar a votar
    location.hash = "#/votar/" + planIns.data.id;
    typeof window.renderVote === "function" && window.renderVote();
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("on"));
    document.getElementById("votar")?.classList.add("on");
  }

  if (window.SB) {
    window.createShare = createShareSB;
  } else if (!window.createShare && typeof window.createShareLocal === "function") {
    window.createShare = window.createShareLocal;
  }

  // === VOTES helper (para UI elegante + cambio de voto) ===
  window.SB_VOTES = window.SB ? {
    async fetchPlan(plan_id){
      return await window.SB.from('plans').select('id,title,deadline_ts,closed').eq('id', plan_id).single();
    },
    async fetchOptionsWithCounts(plan_id){
      // Vista que expone option_id, plan_id, text, votes (y otros campos)
      return await window.SB
        .from('plan_options_with_counts')
        .select('*')
        .eq('plan_id', plan_id)
        .order('created_at', { ascending: true });
    },
    async getMyVote(plan_id){
      const u = await requireLogin();
      const { data, error } = await window.SB
        .from('votes').select('option_id')
        .eq('plan_id', plan_id).eq('user_id', u.id);
      if (error) return null;
      return (data && data[0] && data[0].option_id) || null;
    },
    async castVote(plan_id, option_id){
      const u = await requireLogin();
      // Upsert (permite cambiar voto)
      const { error } = await window.SB
        .from('votes')
        .upsert({ plan_id, option_id, user_id: u.id }, { onConflict: 'plan_id,user_id' });
      if (error) throw error;
      return true;
    },
    async closePlan(plan_id){
      return await window.SB.from('plans').update({ closed: true }).eq('id', plan_id);
    }
  } : null;

  // Realtime log (opcional)
  try {
    if (window.SB && typeof window.SB.channel === "function") {
      window.SB.channel("plans-inserts")
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "plans" },
          (payload) => console.log("📥 Nuevo plan en Supabase:", payload.new)
        )
        .subscribe((status) => console.log("[Realtime] status:", status));
    }
  } catch (e) { console.warn("[Realtime] desactivado:", e); }
})();
