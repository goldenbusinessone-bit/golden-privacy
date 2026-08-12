// ============================================================
// 🌍 PARTIELS PARTAGÉS — charge header.html et footer.html
// automatiquement dans chaque page (une seule fois à modifier
// pour changer le menu ou le pied de page sur tout le site)
// ============================================================
function loadGoldenPartials(){
  const headerEl = document.getElementById("site-header");
  const footerEl = document.getElementById("site-footer");

  if (headerEl){
    fetch("header.html", { cache: "no-store" })
      .then(r => r.text())
      .then(html => {
        headerEl.innerHTML = html;
        markActiveNavLink();
        setupNavToggle();
        renderAccountWidget();
        if (typeof applyGoldenLanguage === "function" && localStorage.getItem("golden_lang")){
          applyGoldenLanguage(localStorage.getItem("golden_lang"));
        }
        if (typeof initGoldenLanguage === "function" && !localStorage.getItem("golden_lang")){
          initGoldenLanguage();
        }
      })
      .catch(err => console.error("Erreur de chargement du header :", err));
  }

  if (footerEl){
    fetch("footer.html", { cache: "no-store" })
      .then(r => r.text())
      .then(html => {
        footerEl.innerHTML = html;
        const yearEl = document.getElementById("footer-year");
        if (yearEl) yearEl.textContent = new Date().getFullYear();
        if (typeof applyGoldenLanguage === "function" && localStorage.getItem("golden_lang")){
          applyGoldenLanguage(localStorage.getItem("golden_lang"));
        }
      })
      .catch(err => console.error("Erreur de chargement du footer :", err));
  }
}

function markActiveNavLink(){
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".site-nav a").forEach(function(a){
    if (a.getAttribute("href") === current) a.classList.add("active");
  });
}

function setupNavToggle(){
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("site-nav");
  if (toggle && nav){
    toggle.addEventListener("click", function(){
      nav.classList.toggle("open");
    });
  }
}

// ============================================================
// 💳 MOBILE MONEY — numéros affichés sur la page Commande
// ============================================================
const GOLDEN_PAYMENT_METHODS = [
  { id: "airtel", name: "Airtel Money", number: "+243 970 632 534" },
  { id: "mpesa",  name: "M-Pesa",       number: "+243 836 812 954" }
  // La carte Visa sera ajoutée ici plus tard
];

document.addEventListener("DOMContentLoaded", loadGoldenPartials);

// ============================================================
// 📦 SUPABASE — base de données ET stockage des fichiers
// (remplace entièrement Firebase/Firestore)
// ============================================================
const SUPABASE_URL = "https://tmvkalnetmgcditrpenz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jLjHM7CX2J7vSbIzTO0uSg_VECOhgLP";
const SUPABASE_BUCKET = "Golden_media";

function uploadToSupabase(file, folder){
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = folder + "/" + Date.now() + "-" + safeName;
  return fetch(SUPABASE_URL + "/storage/v1/object/" + SUPABASE_BUCKET + "/" + path, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  }).then(function(res){
    if (!res.ok){
      return res.text().then(function(t){ throw new Error("Échec de l'envoi vers Supabase : " + t); });
    }
    return SUPABASE_URL + "/storage/v1/object/public/" + SUPABASE_BUCKET + "/" + path;
  });
}

// ---- Session admin (Supabase Auth) ----
const GOLDEN_ADMIN_UID = "f6d2cf22-73b7-431e-8549-0990a3c12f9a";

function getSupaToken(){
  return sessionStorage.getItem("golden_admin_token");
}
function setSupaToken(token){
  if (token) sessionStorage.setItem("golden_admin_token", token);
  else sessionStorage.removeItem("golden_admin_token");
}
function isSupaLoggedIn(){
  return !!getSupaToken();
}

// Récupère l'utilisateur associé au jeton admin actuellement en session (ou null)
function supaGetCurrentUser(){
  const token = getSupaToken();
  if (!token) return Promise.resolve(null);
  return fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + token }
  }).then(function(res){
    if (!res.ok) return null;
    return res.json();
  }).catch(function(){ return null; });
}

function supaSignIn(email, pass){
  return fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: pass })
  }).then(function(res){
    return res.json().then(function(data){
      if (!res.ok) throw new Error(data.error_description || data.msg || "Connexion refusée.");
      setSupaToken(data.access_token);
      return data;
    });
  });
}

function supaSignOut(){
  setSupaToken(null);
}

// ---- Requête générique vers l'API Supabase (table REST) ----
function supaRequest(path, options){
  options = options || {};
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": "Bearer " + (getSupaToken() || SUPABASE_ANON_KEY),
    "Content-Type": "application/json"
  };
  if (options.method === "POST") headers["Prefer"] = "return=representation";
  if (options.headers) Object.assign(headers, options.headers);

  return fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method: options.method || "GET",
    headers: headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  }).then(function(res){
    if (!res.ok){
      return res.text().then(function(t){ throw new Error(t || ("Erreur " + res.status)); });
    }
    if (res.status === 204) return null;
    return res.json();
  });
}

// ============================================================
// 🖼️ RÉALISATIONS — galerie par zone (utilisé sur les pages
// de service ET sur le panneau admin)
// ============================================================

// Charge et affiche la bande défilante des réalisations d'une zone
function loadRealisationsMarquee(zone, trackId){
  const track = document.getElementById(trackId);
  if (!track) return;
  supaRequest("realisations_golden?zone=eq." + encodeURIComponent(zone) + "&order=created_at.desc")
    .then(function(rows){
      if (!rows || rows.length === 0){
        track.innerHTML = '<p class="cm-empty">Les premières réalisations de cette zone arrivent bientôt.</p>';
        return;
      }
      const items = rows.map(function(d){
        const playIcon = d.video_id ? '<div class="marquee-play">▶</div>' : '';
        let media;
        if (d.media_type === "video"){
          media = '<video src="' + esc(d.image_url) + '" muted loop playsinline controls preload="metadata"></video>';
        } else {
          media = '<img src="' + esc(d.image_url) + '" alt="' + esc(d.title || "Réalisation Golden") + '">';
        }
        const img = '<div class="marquee-item">' +
          media +
          playIcon +
          '<div class="marquee-caption">' + esc(d.title || "") + '</div>' +
          '</div>';
        if (d.video_id){
          // Vidéo YouTube : s'ouvre dans un lecteur intégré, sans quitter le site
          return '<a href="javascript:void(0)" onclick="openVideoModal(\'' + esc(d.video_id) + '\')">' + img + '</a>';
        }
        return d.link ? '<a href="' + esc(d.link) + '" target="_blank" rel="noopener">' + img + '</a>' : img;
      });
      track.innerHTML = items.join("");
    })
    .catch(function(err){
      track.innerHTML = '<p class="cm-empty">Galerie momentanément indisponible.</p>';
      console.error("Erreur galerie (" + zone + ") :", err);
    });
}

// ---- Lecteur vidéo en incrustation (YouTube) : on reste sur le site ----
function openVideoModal(youtubeId){
  closeVideoModal(); // évite d'empiler plusieurs lecteurs
  const overlay = document.createElement("div");
  overlay.className = "video-modal-overlay";
  overlay.id = "video-modal-overlay";
  overlay.onclick = function(e){ if (e.target === overlay) closeVideoModal(); };
  overlay.innerHTML =
    '<div class="video-modal-box">' +
      '<button class="video-modal-close" onclick="closeVideoModal()" aria-label="Fermer">✕</button>' +
      '<iframe src="https://www.youtube.com/embed/' + youtubeId + '?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>' +
      '<a class="video-modal-yt-link" href="https://www.youtube.com/watch?v=' + youtubeId + '" target="_blank" rel="noopener">Voir sur YouTube →</a>' +
    '</div>';
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
}
function closeVideoModal(){
  const existing = document.getElementById("video-modal-overlay");
  if (existing) existing.remove();
  document.body.style.overflow = "";
}

// Affiche la liste texte des réalisations (titre + description + lien) sous la bande
function loadRealisationsList(zone, listId){
  const list = document.getElementById(listId);
  if (!list) return;
  supaRequest("realisations_golden?zone=eq." + encodeURIComponent(zone) + "&order=created_at.desc")
    .then(function(rows){
      if (!rows || rows.length === 0){
        list.innerHTML = "";
        return;
      }
      list.innerHTML = rows.map(function(d){
        return '<div class="realisation-card">' +
          '<h4>' + esc(d.title || "") + '</h4>' +
          '<p>' + esc(d.description || "") + '</p>' +
          (d.link ? '<a href="' + esc(d.link) + '" target="_blank" rel="noopener" class="realisation-link">Voir le lien →</a>' : '') +
          '</div>';
      }).join("");
    })
    .catch(function(err){ console.error("Erreur liste réalisations (" + zone + ") :", err); });
}

// ============================================================
// 🎙️ PODCASTS — affichage public (page Média & Digital)
// ============================================================
function loadPodcasts(containerId){
  const container = document.getElementById(containerId);
  if (!container) return;

  supaRequest("podcasts_golden?order=created_at.desc").then(function(rows){
    if (!rows || rows.length === 0){
      container.innerHTML = '<p class="cm-empty">Le premier épisode arrive bientôt 🎙️</p>';
      return;
    }
    container.innerHTML = rows.map(function(d){
      if (d.audio_url){
        return '<div class="podcast-card">' +
          '<h4>' + esc(d.title) + '</h4>' +
          '<p>' + esc(d.description || "") + '</p>' +
          '<audio src="' + esc(d.audio_url) + '" controls preload="none" style="width:100%;"></audio>' +
          '</div>';
      }

      const spotifyMatch = String(d.link || "").match(/open\.spotify\.com\/episode\/([A-Za-z0-9]+)/);
      const youtubeId = extractYouTubeId ? extractYouTubeId(d.link) : null;

      if (spotifyMatch){
        return '<div class="podcast-card">' +
          '<h4>' + esc(d.title) + '</h4>' +
          '<p>' + esc(d.description || "") + '</p>' +
          '<iframe src="https://open.spotify.com/embed/episode/' + spotifyMatch[1] + '" width="100%" height="152" frameborder="0" allow="encrypted-media" loading="lazy"></iframe>' +
          '</div>';
      }
      if (youtubeId){
        return '<div class="podcast-card">' +
          '<h4>' + esc(d.title) + '</h4>' +
          '<p>' + esc(d.description || "") + '</p>' +
          '<iframe src="https://www.youtube.com/embed/' + youtubeId + '" width="100%" height="200" style="border-radius:8px;border:none;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>' +
          '<a class="podcast-play" href="https://www.youtube.com/watch?v=' + youtubeId + '" target="_blank" rel="noopener" style="display:block;margin-top:8px;font-size:12px;">Voir sur YouTube →</a>' +
          '</div>';
      }
      return '<div class="podcast-card">' +
        '<h4>' + esc(d.title) + '</h4>' +
        '<p>' + esc(d.description || "") + '</p>' +
        '<a class="podcast-play" href="' + esc(d.link) + '" target="_blank" rel="noopener">▶ Écouter l\'épisode</a>' +
        '</div>';
    }).join("");
  }).catch(function(err){
    container.innerHTML = '<p class="cm-empty">Podcasts momentanément indisponibles.</p>';
    console.error(err);
  });
}

// ============================================================
// ❤️ LIKES — un compteur par zone
// ============================================================
function setupZoneLike(zone, btnId, countId){
  const btn = document.getElementById(btnId);
  const countEl = document.getElementById(countId);
  if (!btn) return;

  supaRequest("likes_golden?zone=eq." + encodeURIComponent(zone) + "&select=count")
    .then(function(rows){
      countEl.textContent = (rows && rows[0]) ? rows[0].count : 0;
    })
    .catch(function(err){ console.error("Erreur likes (" + zone + ") :", err); });

  btn.addEventListener("click", function(){
    if (localStorage.getItem("liked_" + zone)) return; // un like par visiteur/appareil
    supaRequest("rpc/increment_like", { method: "POST", body: { zone_id: zone } })
      .then(function(newCount){
        countEl.textContent = (typeof newCount === "number") ? newCount : (parseInt(countEl.textContent || "0", 10) + 1);
        localStorage.setItem("liked_" + zone, "1");
        btn.classList.add("liked");
      })
      .catch(function(err){ console.error("Erreur like :", err); });
  });

  if (localStorage.getItem("liked_" + zone)) btn.classList.add("liked");
}

function esc(s){
  return String(s || "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function extractYouTubeId(url){
  const m = String(url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function timeAgo(isoString){
  if (!isoString) return "à l'instant";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return Math.floor(diff / 60) + " min";
  if (diff < 86400) return Math.floor(diff / 3600) + " h";
  return Math.floor(diff / 86400) + " j";
}

function renderComment(data){
  const initial = esc((data.name || "A").trim().charAt(0).toUpperCase() || "A");
  return `<div class="cm-item">
    <div class="cm-avatar">${initial}</div>
    <div class="cm-body">
      <div class="cm-meta">
        <span class="cm-name">${esc(data.name || "Anonyme")}</span>
        <span class="cm-time">${timeAgo(data.created_at)}</span>
      </div>
      <div class="cm-text">${esc(data.text || "")}</div>
    </div>
  </div>`;
}

function insertEmoji(el){
  const form = el.closest("form");
  const textarea = form.querySelector(".cm-text");
  textarea.value += el.textContent;
  textarea.focus();
}

// ============================================================
// 💬 COMMENTAIRES — chargement + envoi, zone par zone
// ============================================================
function loadComments(zone, container){
  supaRequest("avis_golden?zone=eq." + encodeURIComponent(zone) + "&order=created_at.desc")
    .then(function(rows){
      if (!rows || rows.length === 0){
        container.innerHTML = '<p class="cm-empty">Soyez le premier à commenter cette zone ✨</p>';
        return;
      }
      container.innerHTML = rows.map(renderComment).join("");
    })
    .catch(function(error){
      container.innerHTML = '<p class="cm-empty">Commentaires momentanément indisponibles.</p>';
      console.error("Erreur commentaires (" + zone + ") :", error);
    });
}

document.querySelectorAll(".comments-list").forEach(function(container){
  const zone = container.dataset.zone;
  loadComments(zone, container);
});

document.querySelectorAll(".comment-form").forEach(function(form){
  form.addEventListener("submit", function(e){
    e.preventDefault();
    const zone = form.dataset.zone;
    const label = form.dataset.label;
    const name = form.querySelector(".cm-name").value.trim() || "Anonyme";
    const text = form.querySelector(".cm-text").value.trim();
    if (!text) return;

    supaRequest("avis_golden", {
      method: "POST",
      body: { zone: zone, zone_label: label, name: name, text: text }
    }).then(function(){
      form.reset();
      const container = document.querySelector('.comments-list[data-zone="' + zone + '"]');
      if (container) loadComments(zone, container);
    }).catch(function(err){
      alert("Impossible de publier le commentaire pour le moment.");
      console.error(err);
    });
  });
});

// ============================================================
// 👤 COMPTE CLIENT — connexion/inscription publique, distincte
// du compte admin (utilise sa propre session, stockée à part)
// ============================================================
function getClientSession(){
  const raw = localStorage.getItem("golden_client_session");
  return raw ? JSON.parse(raw) : null;
}
function setClientSession(session){
  if (session) localStorage.setItem("golden_client_session", JSON.stringify(session));
  else localStorage.removeItem("golden_client_session");
}
function isClientLoggedIn(){
  return !!getClientSession();
}

function clientSignUp(email, pass, fullName){
  return fetch(SUPABASE_URL + "/auth/v1/signup", {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: pass, data: { full_name: fullName } })
  }).then(function(res){
    return res.json().then(function(data){
      if (!res.ok) throw new Error(data.error_description || data.msg || data.error || "Inscription refusée.");
      if (data.access_token){
        setClientSession({ access_token: data.access_token, user: data.user });
        return saveOwnProfile(fullName, null).then(function(){ return data; });
      }
      // Confirmation par e-mail requise avant connexion possible
      return data;
    });
  });
}

function clientSignIn(email, pass){
  return fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: pass })
  }).then(function(res){
    return res.json().then(function(data){
      if (!res.ok) throw new Error(data.error_description || data.msg || "Connexion refusée.");
      setClientSession({ access_token: data.access_token, user: data.user });
      return data;
    });
  });
}

function clientSignOut(){
  setClientSession(null);
}

// Crée ou met à jour la ligne de profil du client actuellement connecté
function saveOwnProfile(fullName, avatarUrl){
  const session = getClientSession();
  if (!session) return Promise.reject(new Error("Non connecté."));
  const body = { id: session.user.id };
  if (fullName !== undefined && fullName !== null) body.full_name = fullName;
  if (avatarUrl !== undefined && avatarUrl !== null) body.avatar_url = avatarUrl;
  return fetch(SUPABASE_URL + "/rest/v1/profiles_golden?on_conflict=id", {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + session.access_token,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(body)
  }).then(function(res){
    if (!res.ok) return res.text().then(function(t){ throw new Error(t); });
    return res.json();
  });
}

function loadOwnProfile(){
  const session = getClientSession();
  if (!session) return Promise.resolve(null);
  return fetch(SUPABASE_URL + "/rest/v1/profiles_golden?id=eq." + session.user.id + "&select=*", {
    headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + session.access_token }
  }).then(function(res){ return res.json(); })
    .then(function(rows){ return (rows && rows[0]) ? rows[0] : null; });
}

// ---- Widget compte affiché dans l'en-tête (photo/nom ou lien connexion) ----
function renderAccountWidget(){
  const zone = document.getElementById("account-widget");
  if (!zone) return;
  const session = getClientSession();
  if (!session){
    zone.innerHTML = '<a href="compte.html" class="account-link">Se connecter</a>';
    return;
  }
  loadOwnProfile().then(function(profile){
    const name = (profile && profile.full_name) ? profile.full_name : (session.user.email || "Mon compte");
    const avatar = (profile && profile.avatar_url) ? profile.avatar_url : null;
    const initial = esc(name.trim().charAt(0).toUpperCase() || "U");
    const avatarHtml = avatar
      ? '<img src="' + esc(avatar) + '" class="account-avatar" alt="">'
      : '<span class="account-avatar account-avatar-fallback">' + initial + '</span>';
    zone.innerHTML = '<a href="compte.html" class="account-chip">' + avatarHtml + '<span class="account-name">' + esc(name) + '</span></a>';
  }).catch(function(){
    zone.innerHTML = '<a href="compte.html" class="account-chip">Mon compte</a>';
  });
}
