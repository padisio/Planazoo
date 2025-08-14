// js/supabase-bootstrap.js
(function () {
  // =========================
  // 1) Cliente Supabase
  // =========================
  const SB_URL = window.SUPABASE_URL || "https://ggxdzwjlkqqznpzrfayl.supabase.co";
  const SB_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdneGR6d2psa3Fxem5wenJmYXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MTY4NDksImV4cCI6MjA3MDQ5Mjg0OX0.wHb_QV4t_MHSQNyBXrU3k-MTUWXn4fwhwNOw4YscyWc";

  const hasLib = !!window.supabase;
  if (hasLib && SB_URL && SB_KEY) {
    if (!window.SB) {
      window.SB = window.supabase.createClient(SB_URL, SB_KEY, {
        auth: { storageKey: "planazoo-auth" },
      });
    }
  } else {
    console.warn("[Supabase] Librería o credenciales ausentes. Modo local (sin backend).");
  }

  // Pequeñas utilidades
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const now = () => Date.now();
  const toISO = (v) => (v ? new Date(v).toISOString() : new Date().toISOString());

  // Helpers localStorage (para mantener compat con UI legacy)
  const getLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const setLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // =========================
  // 2) Auth & Magic Link
  // =========================
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
            // refresca cabecera de cuenta
            window.setUser && window.setUser({
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

  (function handleMagicLink() {
    if (!window.SB) return;
    try {
      const h = (window.location.hash || "").replace(/^#/, "");
      if (!h) return;
      const p = new URLSearchParams(h);
      const at = p.get("access_token");
      const rt = p.get("refresh_token");
      if (at && rt) {
        window.SB.auth.setSession({ access_token: at, refresh_token: rt }).then(() => {
          history.replaceState({}, document.title, location.pathname + location.search);
        });
      }
    } catch (e) {
      console.warn("[Supabase] handleMagicLink", e);
    }
  })();

  // Login por Magic Link (expuesto a la UI)
  window.doLogin = async function () {
    if (!window.SB) { alert("Login no disponible, Supabase no inicializado"); return; }
    const email = $("#le")?.value?.trim();
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
    if (!u) { window.openLogin && window.openLogin(); throw new Error("Inicia sesión para crear"); }
    return u;
  }

  // =========================
  // 3) Crear plan (SB) + espejo a LS
  // =========================
  async function createShareSB() {
    if (!window.SB) { // fallback
      if (typeof window.createShareLocal === "function") return window.createShareLocal();
      if (typeof window.createShare === "function") return window.createShare();
      return;
    }

    // Validaciones UI
    if (typeof window.guardDetails === "function" && !window.guardDetails()) return;
    const user = await requireLogin();

    if (!Array.isArray(window.opts) || window.opts.length < 1) {
      alert("Añade al menos 1 actividad");
      return;
    }

    const title = $("#pt")?.value?.trim();
    const city  = $("#pc")?.value?.trim() || null;
    const whenInput = $("#pd")?.value;
    const dlMin = Math.max(10, Math.min(1440, parseInt($("#pl")?.value || "120", 10)));
    if (!title || !whenInput) { alert("Completa título y fecha/hora"); return; }

    const when_ts = toISO(whenInput);
    const deadline_ts = new Date(Date.now() + dlMin * 60000).toISOString();

    // 1) plan
    const planIns = await window.SB.from("plans").insert({
      owner_id: user.id,
      title, city, when_ts, deadline_ts,
      collab: true, closed: false, cancelled: false, is_public: true
    }).select().single();
    if (planIns.error) throw planIns.error;

    // 2) bloque
    const blockIns = await window.SB.from("plan_blocks").insert({
      plan_id: planIns.data.id, title: "Bloque 1", sort_order: 1
    }).select().single();
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

    // 4) Espejo a localStorage (para compat con otras pantallas legacy)
    try {
      const invitedRaw = ($("#chips")?.dataset.sel || "[]");
      let invited = [];
      try { invited = JSON.parse(invitedRaw || "[]"); } catch { invited = []; }

      const optionsLS = (Array.isArray(window.opts) ? window.opts : []).map((o, i) => ({
        id: i,
        text: o.t,
        votes: 0,
        meta: o.cat ? { cat: o.cat } : null,
      }));

      const K_POLLS = "pz_polls";
      const polls = getLS(K_POLLS, {});
      polls[planIns.data.id] = {
        id: planIns.data.id,
        title,
        options: optionsLS,
        createdAt: Date.now(),
        deadline: new Date(deadline_ts).getTime(),
        when: new Date(when_ts).getTime(),
        closed: false,
        collab: true,
        invited,
        owner: user.email || user.id,
        rating: 0,
        cancelled: false,
      };
      setLS(K_POLLS, polls);
    } catch { /* noop */ }

    // 5) Ir a votar (usando los overrides SB que definimos abajo)
    location.hash = "#/votar/" + planIns.data.id;
    if (typeof window.renderVote === "function") window.renderVote();
    $$(".view").forEach(v => v.classList.remove("on"));
    $("#votar")?.classList.add("on");
  }

  // Sobrescribe createShare para usar SB
  if (window.SB) {
    window.createShare = createShareSB;
  } else if (!window.createShare && typeof window.createShareLocal === "function") {
    window.createShare = window.createShareLocal;
  }

  // =========================
  // 4) Votar (SB) y Resultados (SB)
  // =========================
  async function fetchPlanAndOptions(planId) {
    // plan
    const p = await window.SB.from("plans")
      .select("id,title,deadline_ts,collab,closed,cancelled")
      .eq("id", planId).single();
    if (p.error) throw p.error;

    // opciones + conteo (vista)
    const o = await window.SB.from("plan_options_with_counts")
      .select("option_id,text,cat,block_id,plan_id,votes")
      .eq("plan_id", planId)
      .order("option_id", { ascending: true });
    if (o.error) throw o.error;

    return { plan: p.data, options: o.data || [] };
  }

  function startDeadlineTimer(deadlineISO) {
    const lbl = $("#rem");
    if (!lbl) return;
    const deadline = new Date(deadlineISO).getTime();
    if (isNaN(deadline)) { lbl.textContent = "—"; return; }
    try { if (window.tmr) clearInterval(window.tmr); } catch (_) {}
    window.tmr = setInterval(() => {
      const r = Math.max(0, deadline - Date.now());
      lbl.textContent = Math.floor(r / 60000) + "m " + Math.floor((r % 60000) / 1000) + "s";
    }, 500);
  }

  async function castVoteSB(planId, optionId) {
    try {
      const name = $("#vn")?.value?.trim();
      if (!name) { alert("Pon tu nombre"); return; }
      try { localStorage.setItem("pz_nombre", name); } catch (_) {}

      const { data: userData } = await window.SB.auth.getUser();
      if (!userData?.user) { window.openLogin && window.openLogin(); return; }

      // Insertar voto (sin triggers: enviamos plan_id y option_id)
      const ins = await window.SB.from("votes").insert({
        plan_id: planId,
        option_id: optionId,
        user_id: userData.user.id,
        voter_name: name
      });
      if (ins.error) {
        console.error("[SB] insert vote", ins.error);
        alert(ins.error.message || "No se pudo votar");
        return;
      }

      // Ir a resultados
      location.hash = "#/res/" + planId;
      await renderResSB();
      $$(".view").forEach(v => v.classList.remove("on"));
      $("#res")?.classList.add("on");
    } catch (e) {
      console.error("[PZ] castVoteSB", e);
      alert(e?.message || "No se pudo votar");
    }
  }

  async function renderVoteSB() {
    if (!window.SB) { // si no hay SB, usa versión local
      if (typeof window.renderVoteLocal === "function") return window.renderVoteLocal();
      return;
    }
    const planId = (location.hash.split("/")[2] || "").trim();
    if (!planId) { alert("No existe"); window.tab && window.tab("home"); return; }

    let data;
    try { data = await fetchPlanAndOptions(planId); }
    catch (e) { console.error("[SB] renderVote fetch", e); alert("No existe"); window.tab && window.tab("home"); return; }

    const { plan, options } = data;

    // Header
    $("#vt") && ($("#vt").textContent = "Vota: " + (plan?.title || "Plan"));
    $("#collab") && ($("#collab").style.display = (plan?.collab ? "inline-block" : "none"));
    const vn = $("#vn"); if (vn) vn.value = (localStorage.getItem("pz_nombre") || "");

    // Lista
    const w = $("#vlist"); if (w) w.innerHTML = "";
    const closed   = !!(plan?.closed || plan?.cancelled);
    const expired  = plan?.deadline_ts ? (Date.now() >= new Date(plan.deadline_ts).getTime()) : false;
    const isClosed = closed || expired;

    (options || []).forEach(o => {
      const d = document.createElement("div");
      d.className = "opt";
      d.innerHTML = `
        <div class='row' style='justify-content:space-between;align-items:center'>
          <div style='flex:1'>${o.text}</div>
          <div class='row' style='gap:10px;align-items:center'>
            <b>${o.votes || 0}</b>
            <button class='btn s p'>Votar</button>
          </div>
        </div>`;
      const b = d.querySelector("button");
      b.disabled = isClosed;
      b.onclick  = () => castVoteSB(plan.id, o.option_id);
      w && w.appendChild(d);
    });

    // Enlace y timer
    const link = $("#link");
    if (link) link.textContent = location.origin + location.pathname + "#/votar/" + planId;
    if (plan?.deadline_ts) startDeadlineTimer(plan.deadline_ts);
  }

  async function renderResSB() {
    if (!window.SB) { // si no hay SB, usa versión local
      if (typeof window.renderResLocal === "function") return window.renderResLocal();
      return;
    }
    const planId = (location.hash.split("/")[2] || "").trim();
    if (!planId) { alert("No existe"); window.tab && window.tab("home"); return; }

    let data;
    try { data = await fetchPlanAndOptions(planId); }
    catch (e) { console.error("[SB] renderRes fetch", e); alert("No existe"); window.tab && window.tab("home"); return; }

    const { plan, options } = data;

    $("#rt") && ($("#rt").textContent = "Resultado: " + (plan?.title || "Plan"));
    $("#state") && ($("#state").textContent =
      (plan?.closed || plan?.cancelled || (plan?.deadline_ts && Date.now() >= new Date(plan.deadline_ts).getTime()))
        ? "Cerrada" : "Abierta");

    const w = $("#rlist"); if (w) w.innerHTML = "";
    let sum = 0, max = -1;
    (options || []).forEach(o => { sum += (o.votes || 0); if ((o.votes || 0) > max) max = (o.votes || 0); });

    (options || []).forEach(o => {
      const d = document.createElement("div");
      d.className = "opt";
      d.innerHTML = `<div class='row' style='justify-content:space-between'><div>${o.text}</div><b>${o.votes || 0}</b></div>`;
      w && w.appendChild(d);
    });

    const leaders = (options || []).filter(o => (o.votes || 0) === max);
    const tieBox  = $("#tie");
    const tieOpts = $("#tieopts");
    const winBox  = $("#win");

    const isClosed = (plan?.closed || plan?.cancelled || (plan?.deadline_ts && Date.now() >= new Date(plan.deadline_ts).getTime()));
    if (leaders.length > 1 && isClosed) {
      if (tieBox) tieBox.style.display = "block";
      if (tieOpts) {
        tieOpts.innerHTML = "";
        leaders.forEach(o => {
          const d = document.createElement("div");
          d.className = "opt"; d.textContent = o.text; tieOpts.appendChild(d);
        });
      }
      if (winBox) winBox.innerHTML = '<small class="pill">Empate detectado</small>';
      window.tie = leaders.map(o => o.option_id); // compat con tRand/tManual
    } else {
      if (tieBox) tieBox.style.display = "none";
      const win = (options || []).find(o => (o.votes || 0) === max) || null;
      if (winBox) winBox.innerHTML = win
        ? `<h3>🎉 Ganador: ${win.text}</h3><small class='pill'>Total votos: ${sum}</small>`
        : '<small class="pill">Aún no hay votos</small>';
    }
  }

  // Publica overrides SB (solo si hay cliente)
  if (window.SB) {
    // guarda las locales por si hiciera falta usarlas en modo offline
    if (!window.renderVoteLocal && typeof window.renderVote === "function") window.renderVoteLocal = window.renderVote;
    if (!window.renderResLocal  && typeof window.renderRes  === "function") window.renderResLocal  = window.renderRes;

    window.renderVote = renderVoteSB;
    window.renderRes  = renderResSB;
    Object.assign(window, { castVoteSB }); // por si lo necesitas en otros archivos
  }

  // =========================
  // 5) Realtime (opcional)
  // =========================
  try {
    if (window.SB && typeof window.SB.channel === "function") {
      window.SB
        .channel("plans-inserts")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "plans" },
          (payload) => console.log("📥 Nuevo plan en Supabase:", payload.new))
        .subscribe((status) => console.log("[Realtime] status:", status));
    }
  } catch (e) {
    console.warn("[Realtime] desactivado:", e);
  }
})();
