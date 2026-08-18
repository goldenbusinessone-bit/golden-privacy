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
        setupSiteSearch();
        renderAccountWidget();
        updateCartBadge();
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
        setupBottomNav();
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

// Numéro WhatsApp Golden utilisé par défaut quand aucun contact spécifique
// n'est renseigné pour un service/produit — le bouton WhatsApp est donc
// toujours présent, sans que l'admin doive le remplir à chaque publication.
const GOLDEN_DEFAULT_WHATSAPP = "+243970632534";

document.addEventListener("DOMContentLoaded", loadGoldenPartials);
document.addEventListener("DOMContentLoaded", setupGoldenChatWidget);

// ============================================================
// 💬 CHATBOT GOLDEN — bulle flottante, appelle callGoldenAI("chat", ...)
// ============================================================
const GOLDEN_CHAT_WELCOME = "Bonjour 👋 Je suis l'assistant Golden. Pose-moi une question sur nos services, la boutique ou une commande.";

function setupGoldenChatWidget(){
  if (document.getElementById("golden-chat-bubble")) return; // déjà en place

  const bubble = document.createElement("button");
  bubble.id = "golden-chat-bubble";
  bubble.className = "golden-chat-bubble";
  bubble.setAttribute("aria-label", "Ouvrir le chat Golden");
  bubble.textContent = "💬";
  document.body.appendChild(bubble);

  const win = document.createElement("div");
  win.id = "golden-chat-window";
  win.className = "golden-chat-window";
  win.innerHTML =
    '<div class="golden-chat-head"><b>Assistant Golden</b><button class="golden-chat-close" id="golden-chat-close" aria-label="Fermer">✕</button></div>' +
    '<div class="golden-chat-body" id="golden-chat-body"></div>' +
    '<div class="golden-chat-foot">' +
      '<input type="text" id="golden-chat-input" placeholder="Écris ton message...">' +
      '<button id="golden-chat-send" aria-label="Envoyer">➤</button>' +
    '</div>';
  document.body.appendChild(win);

  const body = document.getElementById("golden-chat-body");
  const input = document.getElementById("golden-chat-input");

  function addMsg(text, who){
    const msg = document.createElement("div");
    msg.className = "golden-chat-msg " + who;
    msg.textContent = text;
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
    return msg;
  }

  bubble.addEventListener("click", function(){
    const isOpen = win.classList.toggle("open");
    if (isOpen && !body.dataset.greeted){
      body.dataset.greeted = "1";
      addMsg(GOLDEN_CHAT_WELCOME, "bot");
      input.focus();
    }
  });
  document.getElementById("golden-chat-close").addEventListener("click", function(){
    win.classList.remove("open");
  });

  function sendMessage(){
    const text = input.value.trim();
    if (!text) return;
    addMsg(text, "user");
    input.value = "";
    const typingMsg = addMsg("...en train d'écrire", "typing");

    callGoldenAI("chat", text)
      .then(function(reply){
        typingMsg.remove();
        addMsg(reply || "Désolé, je n'ai pas de réponse pour ça.", "bot");
      })
      .catch(function(err){
        console.error("Erreur chat Golden :", err);
        typingMsg.remove();
        addMsg("Une erreur est survenue. Réessaie, ou contacte-nous directement sur WhatsApp.", "bot");
      });
  }

  document.getElementById("golden-chat-send").addEventListener("click", sendMessage);
  input.addEventListener("keydown", function(e){
    if (e.key === "Enter") sendMessage();
  });
}

// ---- Compteur de visites du site (une fois par session navigateur) ----
document.addEventListener("DOMContentLoaded", function(){
  if (!sessionStorage.getItem("golden_visit_counted")){
    sessionStorage.setItem("golden_visit_counted", "1");
    fetch(SUPABASE_URL + "/rest/v1/rpc/increment_site_visit", {
      method: "POST",
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY, "Content-Type": "application/json" }
    }).catch(function(){});
  }
});

// ---- Journal détaillé des visiteurs — IP, ville, opérateur/FAI ----
// (une fois par session navigateur, connecté ou non)
document.addEventListener("DOMContentLoaded", function(){
  if (sessionStorage.getItem("golden_visit_logged")) return;
  sessionStorage.setItem("golden_visit_logged", "1");

  fetch("https://ipapi.co/json/")
    .then(function(r){ return r.json(); })
    .then(function(geo){
      const session = getClientSession();
      return supaRequest("visits_log_golden", {
        method: "POST",
        body: {
          user_id: session ? session.user.id : null,
          ip: geo.ip || null,
          city: geo.city || null,
          region: geo.region || null,
          country: geo.country_name || null,
          isp: geo.org || null,
          page: location.pathname.split("/").pop() || "index.html",
          user_agent: navigator.userAgent
        }
      });
    })
    .catch(function(err){ console.error("Erreur journal visiteur :", err); });
});

// ============================================================
// 📦 SUPABASE — base de données ET stockage des fichiers
// (remplace entièrement Firebase/Firestore)
// ============================================================
const SUPABASE_URL = "https://tmvkalnetmgcditrpenz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jLjHM7CX2J7vSbIzTO0uSg_VECOhgLP";
const SUPABASE_BUCKET = "Golden_media";

// ============================================================
// 🤖 GEMINI AI — appel sécurisé via l'Edge Function Supabase
// (la clé Gemini reste côté serveur, jamais visible dans ce fichier)
// ============================================================
const GEMINI_PROXY_URL = SUPABASE_URL + "/functions/v1/gemini-proxy";

// task: "chat" | "translate" | "describe"
// prompt: le texte envoyé
// targetLang (optionnel, pour "translate"): "en", "sw", etc.
function callGoldenAI(task, prompt, targetLang){
  return fetch(GEMINI_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ task: task, prompt: prompt, targetLang: targetLang })
  })
    .then(function(res){ return res.json(); })
    .then(function(data){
      if (data.error) throw new Error(data.error);
      return data.text;
    });
}

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
  supaRequest("realisations_golden?zone=eq." + encodeURIComponent(zone) + "&is_public=eq.true&order=created_at.desc")
    .then(function(rows){
      if (!rows || rows.length === 0){
        track.innerHTML = '<p class="cm-empty">Les premières réalisations de cette zone arrivent bientôt.</p>';
        return;
      }
      track.innerHTML = rows.map(function(d, i){
        const playIcon = (d.video_id || d.media_type === "video") ? '<div class="marquee-play">▶</div>' : '';
        let media;
        if (d.media_type === "video"){
          media = '<video src="' + esc(d.image_url) + '" muted loop playsinline preload="metadata"></video>';
        } else {
          media = '<img src="' + esc(d.image_url) + '" alt="' + esc(d.title || "Réalisation Golden") + '" loading="lazy">';
        }
        return '<div class="marquee-item" data-index="' + i + '">' + media + playIcon +
          '<div class="marquee-caption">' + esc(d.title || "") + '<span class="marquee-views">👁️ ' + (d.views_count || 0) + '</span></div></div>';
      }).join("");

      track.querySelectorAll(".marquee-item").forEach(function(el){
        el.addEventListener("click", function(){
          openPostModal(rows[parseInt(el.dataset.index, 10)]);
        });
      });
    })
    .catch(function(err){
      track.innerHTML = '<p class="cm-empty">Galerie momentanément indisponible.</p>';
      console.error("Erreur galerie (" + zone + ") :", err);
    });
}

// ---- Vue "publication" façon réseau social : média + titre + réactions + commentaires ----
function openPostModal(d){
  closePostModal();

  // Compte une vue une seule fois par compte connecté (ou par appareil si non connecté)
  const session = getClientSession();
  const viewKey = "viewed_realisation_" + d.id;
  if (session || !localStorage.getItem(viewKey)){
    if (!session) localStorage.setItem(viewKey, "1");
    supaRequest("rpc/increment_realisation_view_v2", { method: "POST", body: { r_id: d.id, u_id: session ? session.user.id : null } })
      .then(function(newCount){
        const el = document.getElementById("post-views-count");
        if (el && typeof newCount === "number") el.textContent = newCount;
      })
      .catch(function(){});
  }

  const overlay = document.createElement("div");
  overlay.className = "video-modal-overlay";
  overlay.id = "post-modal-overlay";
  overlay.onclick = function(e){ if (e.target === overlay) closePostModal(); };

  let mediaHtml, downloadHtml = "";
  if (d.video_id){
    mediaHtml = '<iframe src="https://www.youtube.com/embed/' + d.video_id + '?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
  } else if (d.media_type === "video"){
    mediaHtml = '<video src="' + esc(d.image_url) + '" controls autoplay playsinline></video>';
    downloadHtml = '<a class="post-action" href="' + esc(d.image_url) + '" download target="_blank" rel="noopener">⬇ Télécharger</a>';
  } else {
    mediaHtml = '<img src="' + esc(d.image_url) + '" alt="' + esc(d.title || "") + '">';
    downloadHtml = '<a class="post-action" href="' + esc(d.image_url) + '" download target="_blank" rel="noopener">⬇ Télécharger</a>';
  }

  overlay.innerHTML =
    '<div class="post-modal-box">' +
      '<button class="video-modal-close" onclick="closePostModal()" aria-label="Fermer">✕</button>' +
      '<div class="post-media">' + mediaHtml + '</div>' +
      '<div class="post-body">' +
        '<h3 class="post-title">' + esc(d.title || "") + '</h3>' +
        '<div class="post-views">👁️ <span id="post-views-count">' + (d.views_count || 0) + '</span> vues</div>' +
        (d.description ? '<p class="post-desc">' + esc(d.description) + '</p>' : '') +
        ((d.images && d.images.length) ? '<div class="post-gallery">' + d.images.map(function(url){
          return isVideoUrl(url)
            ? '<video src="' + url + '" controls playsinline preload="metadata"></video>'
            : '<img src="' + url + '" alt="">';
        }).join("") + '</div>' : '') +
        '<div class="post-actions">' +
          '<button class="post-action" id="post-like-btn">👍 <span id="post-like-count">' + (d.likes_count || 0) + '</span></button>' +
          '<button class="post-action" id="post-dislike-btn">👎 <span id="post-dislike-count">' + (d.dislikes_count || 0) + '</span></button>' +
          '<button class="post-action" id="post-share-btn">↗ Partager</button>' +
          (d.link ? '<a class="post-action" href="' + esc(d.link) + '" target="_blank" rel="noopener">🔗 Voir le site</a>' : '') +
          (d.video_id ? '<a class="post-action" href="https://www.youtube.com/watch?v=' + d.video_id + '" target="_blank" rel="noopener">▶ Voir sur YouTube</a>' : '') +
          downloadHtml +
        '</div>' +
        '<div class="post-comments">' +
          '<div id="post-comments-list"></div>' +
          '<form class="post-comment-form" id="post-comment-form">' +
            '<input type="text" class="cm-name" placeholder="Ton nom">' +
            '<textarea class="cm-text" placeholder="Écrire un commentaire..." required></textarea>' +
            '<button type="submit" class="btn btn-onlight">Envoyer</button>' +
          '</form>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const reacted = localStorage.getItem("reaction_" + d.id);
  if (reacted === "like") document.getElementById("post-like-btn").classList.add("reacted");
  if (reacted === "dislike") document.getElementById("post-dislike-btn").classList.add("reacted");

  document.getElementById("post-like-btn").addEventListener("click", function(){ reactToPost(d.id, "like"); });
  document.getElementById("post-dislike-btn").addEventListener("click", function(){ reactToPost(d.id, "dislike"); });
  document.getElementById("post-share-btn").addEventListener("click", function(){ sharePost(d.title || "Réalisation Golden"); });

  loadPostComments(d.id);

  document.getElementById("post-comment-form").addEventListener("submit", function(e){
    e.preventDefault();
    const form = e.target;
    const name = form.querySelector(".cm-name").value.trim() || "Anonyme";
    const text = form.querySelector(".cm-text").value.trim();
    if (!text) return;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    supaRequest("avis_golden", {
      method: "POST",
      body: { realisation_id: d.id, zone: d.zone, name: name, text: text }
    }).then(function(){
      form.reset();
      loadPostComments(d.id);
    }).catch(function(err){
      alert("Impossible d'envoyer le commentaire.");
      console.error(err);
    }).finally(function(){
      if (submitBtn) submitBtn.disabled = false;
    });
  });
}

function closePostModal(){
  const existing = document.getElementById("post-modal-overlay");
  if (existing) existing.remove();
  document.body.style.overflow = "";
}

function reactToPost(realisationId, type){
  const key = "reaction_" + realisationId;
  if (localStorage.getItem(key)) return; // une seule réaction par appareil
  supaRequest("rpc/react_realisation", { method: "POST", body: { r_id: realisationId, reaction: type } })
    .then(function(result){
      const row = Array.isArray(result) ? result[0] : result;
      if (row){
        document.getElementById("post-like-count").textContent = row.likes;
        document.getElementById("post-dislike-count").textContent = row.dislikes;
      }
      localStorage.setItem(key, type);
      document.getElementById(type === "like" ? "post-like-btn" : "post-dislike-btn").classList.add("reacted");
    })
    .catch(function(err){ console.error("Erreur réaction :", err); });
}

function sharePost(title){
  const url = window.location.href;
  if (navigator.share){
    navigator.share({ title: title, url: url }).catch(function(){});
  } else {
    navigator.clipboard.writeText(url).then(function(){
      alert("Lien copié !");
    }).catch(function(){});
  }
}

function loadPostComments(realisationId){
  const list = document.getElementById("post-comments-list");
  supaRequest("avis_golden?realisation_id=eq." + realisationId + "&order=created_at.desc")
    .then(function(rows){
      if (!rows || rows.length === 0){
        list.innerHTML = '<p class="cm-empty">Sois le premier à commenter ✨</p>';
        return;
      }
      list.innerHTML = rows.map(renderComment).join("");
    })
    .catch(function(err){ console.error("Erreur commentaires publication :", err); });
}

// Affiche la liste texte des réalisations (titre + description + lien) sous la bande
function loadRealisationsList(zone, listId){
  const list = document.getElementById(listId);
  if (!list) return;
  supaRequest("realisations_golden?zone=eq." + encodeURIComponent(zone) + "&is_public=eq.true&order=created_at.desc")
    .then(function(rows){
      if (!rows || rows.length === 0){
        list.innerHTML = "";
        return;
      }
      list.innerHTML = rows.map(function(d){
        const fullDesc = d.description || "";
        const isLong = fullDesc.length > 140;
        const shortDesc = isLong ? fullDesc.slice(0, 140).trim() + "…" : fullDesc;
        return '<div class="realisation-card">' +
          '<h4>' + esc(d.title || "") + '</h4>' +
          '<p class="realisation-desc-short">' + esc(shortDesc) + '</p>' +
          (isLong ? '<p class="realisation-desc-full" style="display:none;">' + esc(fullDesc) + '</p><span class="read-more-toggle" onclick="toggleReadMore(this)">Lire la suite</span>' : '') +
          (d.link ? '<a href="' + esc(d.link) + '" target="_blank" rel="noopener" class="realisation-link">Voir le lien →</a>' : '') +
          '</div>';
      }).join("");
    })
    .catch(function(err){ console.error("Erreur liste réalisations (" + zone + ") :", err); });
}

function toggleReadMore(el){
  const card = el.closest(".realisation-card");
  const shortP = card.querySelector(".realisation-desc-short");
  const fullP = card.querySelector(".realisation-desc-full");
  const expanded = fullP.style.display !== "none";
  fullP.style.display = expanded ? "none" : "block";
  shortP.style.display = expanded ? "block" : "none";
  el.textContent = expanded ? "Lire la suite" : "Réduire";
}

// ============================================================
// 🎙️ PODCASTS — affichage public (page Média & Digital)
// ============================================================
// ============================================================
// 🛍️ SERVICES — grille catalogue par zone (pages de zone)
// ============================================================
function loadServicesGrid(zone, containerId){
  const grid = document.getElementById(containerId);
  if (!grid) return;
  supaRequest("services_golden?zone=eq." + encodeURIComponent(zone) + "&is_public=eq.true&order=created_at.desc")
    .then(function(rows){
      if (!rows || rows.length === 0){
        grid.innerHTML = '<p class="cm-empty">Aucun service publié pour cette zone pour le moment.</p>';
        return;
      }
      grid.innerHTML = rows.map(function(d){
        const thumb = (d.images && d.images[0]) ? d.images[0] : "";
        const shortDesc = (d.description || "").slice(0, 70);
        return '<a class="service-card" href="service-detail.html?id=' + d.id + '">' +
          (thumb ? (isVideoUrl(thumb) ? '<video src="' + esc(thumb) + '" muted></video>' : '<img src="' + esc(thumb) + '" alt="' + esc(d.name) + '" loading="lazy">') : '<span class="service-card-noimg"></span>') +
          '<div class="service-card-body">' +
            '<div class="service-card-name">' + esc(d.name) + '</div>' +
            (shortDesc ? '<div class="service-card-desc">' + esc(shortDesc) + (d.description.length > 70 ? '…' : '') + '</div>' : '') +
            (d.price ? '<div class="service-card-price">' + esc(d.price) + '</div>' : '') +
          '</div>' +
        '</a>';
      }).join("");
    })
    .catch(function(err){
      grid.innerHTML = '<p class="cm-empty">Services momentanément indisponibles.</p>';
      console.error("Erreur services (" + zone + ") :", err);
    });
}

function loadPodcasts(containerId){
  const container = document.getElementById(containerId);
  if (!container) return;

  supaRequest("podcasts_golden?order=created_at.desc").then(function(rows){
    if (!rows || rows.length === 0){
      container.innerHTML = '<p class="cm-empty">Le premier épisode arrive bientôt 🎙️</p>';
      return;
    }
    container.innerHTML = rows.map(function(d){
      const viewsBadge = '<div class="podcast-views">👁️ <span id="podcast-views-' + d.id + '">' + (d.views_count || 0) + '</span> vues</div>';
      if (d.audio_url){
        return '<div class="podcast-card">' +
          '<h4>' + esc(d.title) + '</h4>' +
          viewsBadge +
          '<p>' + esc(d.description || "") + '</p>' +
          '<audio src="' + esc(d.audio_url) + '" controls preload="none" style="width:100%;"></audio>' +
          '</div>';
      }

      const spotifyMatch = String(d.link || "").match(/open\.spotify\.com\/episode\/([A-Za-z0-9]+)/);
      const youtubeId = extractYouTubeId ? extractYouTubeId(d.link) : null;

      if (spotifyMatch){
        return '<div class="podcast-card">' +
          '<h4>' + esc(d.title) + '</h4>' +
          viewsBadge +
          '<p>' + esc(d.description || "") + '</p>' +
          '<iframe src="https://open.spotify.com/embed/episode/' + spotifyMatch[1] + '" width="100%" height="152" frameborder="0" allow="encrypted-media" loading="lazy"></iframe>' +
          '</div>';
      }
      if (youtubeId){
        return '<div class="podcast-card">' +
          '<h4>' + esc(d.title) + '</h4>' +
          viewsBadge +
          '<p>' + esc(d.description || "") + '</p>' +
          '<iframe src="https://www.youtube.com/embed/' + youtubeId + '" width="100%" height="200" style="border-radius:8px;border:none;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>' +
          '<a class="podcast-play" href="https://www.youtube.com/watch?v=' + youtubeId + '" target="_blank" rel="noopener" style="display:block;margin-top:8px;font-size:12px;">Voir sur YouTube →</a>' +
          '</div>';
      }
      return '<div class="podcast-card">' +
        '<h4>' + esc(d.title) + '</h4>' +
        viewsBadge +
        '<p>' + esc(d.description || "") + '</p>' +
        '<a class="podcast-play" href="' + esc(d.link) + '" target="_blank" rel="noopener">▶ Écouter l\'épisode</a>' +
        '</div>';
    }).join("");

    // Compte une vue une seule fois par compte connecté (ou par appareil si non connecté)
    const session = getClientSession();
    rows.forEach(function(d){
      const viewKey = "viewed_podcast_" + d.id;
      if (session || !localStorage.getItem(viewKey)){
        if (!session) localStorage.setItem(viewKey, "1");
        supaRequest("rpc/increment_podcast_view_v2", { method: "POST", body: { p_id: d.id, u_id: session ? session.user.id : null } })
          .then(function(newCount){
            const el = document.getElementById("podcast-views-" + d.id);
            if (el && typeof newCount === "number") el.textContent = newCount;
          })
          .catch(function(){});
      }
    });
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

// ---- Détecte si une URL de fichier est une vidéo (par son extension) ----
function isVideoUrl(url){
  return /\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(url || "");
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
  // Champ piège invisible : les robots de spam le remplissent, les humains ne le voient jamais
  const honeypot = document.createElement("input");
  honeypot.type = "text";
  honeypot.name = "website";
  honeypot.autocomplete = "off";
  honeypot.tabIndex = -1;
  honeypot.setAttribute("aria-hidden", "true");
  honeypot.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;opacity:0;";
  form.appendChild(honeypot);

  form.addEventListener("submit", function(e){
    e.preventDefault();
    if (honeypot.value) return; // rempli par un robot : on ignore silencieusement

    const zone = form.dataset.zone;
    const label = form.dataset.label;
    const name = form.querySelector(".cm-name").value.trim() || "Anonyme";
    const text = form.querySelector(".cm-text").value.trim();
    if (!text) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

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
    }).finally(function(){
      if (submitBtn) submitBtn.disabled = false;
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
// ============================================================
// 🔎 RECHERCHE — dans le catalogue de services, avec repli Google
// ============================================================
// ---- Requête générique authentifiée en tant que CLIENT connecté (pas l'admin) ----
function clientRequest(path, options){
  options = options || {};
  const session = getClientSession();
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": "Bearer " + (session ? session.access_token : SUPABASE_ANON_KEY),
    "Content-Type": "application/json"
  };
  if (options.method === "POST") headers["Prefer"] = "return=representation";
  if (options.headers) Object.assign(headers, options.headers);
  return fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method: options.method || "GET",
    headers: headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  }).then(function(res){
    if (!res.ok) return res.text().then(function(t){ throw new Error(t || ("Erreur " + res.status)); });
    if (res.status === 204) return null;
    return res.json();
  });
}

// ============================================================
// 🛍️ BOUTIQUE — panier client (stocké sur l'appareil)
// ============================================================
function getCart(){
  try { return JSON.parse(localStorage.getItem("golden_cart") || "[]"); }
  catch (e) { return []; }
}
function setCart(cart){
  localStorage.setItem("golden_cart", JSON.stringify(cart));
  updateCartBadge();
}
function cartCount(){
  return getCart().reduce(function(sum, item){ return sum + item.qty; }, 0);
}
function addToCart(product, qty){
  qty = qty || 1;
  const cart = getCart();
  const existing = cart.find(function(i){ return i.id === product.id; });
  if (existing) existing.qty += qty;
  else cart.push({ id: product.id, name: product.name, price: product.price, image: product.image, qty: qty });
  setCart(cart);
}
function removeFromCart(productId){
  setCart(getCart().filter(function(i){ return i.id !== productId; }));
}
function updateCartQty(productId, qty){
  const cart = getCart();
  const item = cart.find(function(i){ return i.id === productId; });
  if (!item) return;
  item.qty = Math.max(1, qty);
  setCart(cart);
}
function updateCartBadge(){
  const badge = document.getElementById("bn-cart-count");
  if (!badge) return;
  const count = cartCount();
  badge.textContent = count;
  badge.style.display = count > 0 ? "flex" : "none";
}

// ---- Barre de navigation en bas (page active + badge panier) ----
function setupBottomNav(){
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".bottom-nav-item").forEach(function(a){
    if (a.dataset.page === current) a.classList.add("active");
  });
  updateCartBadge();
}

// ---- Répertoire des pages du site, pour que "podcast", "boutique" etc. proposent la bonne page ----
const GOLDEN_PAGE_DIRECTORY = [
  { keywords: ["podcast", "podcasts", "épisode", "audio"], title: "Podcasts Golden", subtitle: "Écouter nos épisodes", url: "service-media.html" },
  { keywords: ["boutique", "shop", "produit", "acheter"], title: "Boutique Golden", subtitle: "Voir les produits en vente", url: "boutique.html" },
  { keywords: ["panier", "cart"], title: "Mon panier", subtitle: "Voir mon panier", url: "panier.html" },
  { keywords: ["compte", "profil", "mon golden", "connexion", "connecter"], title: "Mon Golden", subtitle: "Mon compte", url: "compte.html" },
  { keywords: ["commande", "commander", "devis"], title: "Commande", subtitle: "Passer une commande de service", url: "commande.html" },
  { keywords: ["événementiel", "evenementiel", "mariage", "fête", "traiteur"], title: "Événementiel", subtitle: "Zone A — Voir la page", url: "service-evenementiel.html" },
  { keywords: ["promotion", "commerciale", "boutiques", "hôtel"], title: "Promotion Commerciale", subtitle: "Zone B — Voir la page", url: "service-promotion.html" },
  { keywords: ["média", "media", "digital", "design", "réseaux sociaux", "marketing"], title: "Média & Digital", subtitle: "Zone C — Voir la page", url: "service-media.html" },
  { keywords: ["technique", "électricité", "construction", "mécanique"], title: "Services Techniques", subtitle: "Zone D — Voir la page", url: "service-technique.html" },
  { keywords: ["condition", "cgu"], title: "Conditions d'utilisation", subtitle: "Voir la page", url: "conditions.html" },
  { keywords: ["confidentialité", "confidentialite", "vie privée"], title: "Politique de confidentialité", subtitle: "Voir la page", url: "confidentialite.html" },
];

function matchPageDirectory(query){
  const q = query.toLowerCase();
  return GOLDEN_PAGE_DIRECTORY.filter(function(p){
    return p.keywords.some(function(k){ return k.indexOf(q) === 0 || q.indexOf(k) === 0; });
  });
}

// ---- Recherche unifiée : services, produits, podcasts, pages du site ----
function fetchSearchResults(query){
  const pageMatches = matchPageDirectory(query).map(function(p){
    return { thumb: "", label: "📄 " + p.title, sub: p.subtitle, url: p.url };
  });

  return Promise.all([
    supaRequest("services_golden?name=ilike." + encodeURIComponent(query) + "*&is_public=eq.true&select=id,name,zone,price,images&order=name.asc&limit=8"),
    supaRequest("produits_golden?name=ilike." + encodeURIComponent(query) + "*&is_public=eq.true&select=id,name,category,price,images&order=name.asc&limit=8"),
    supaRequest("podcasts_golden?title=ilike." + encodeURIComponent(query) + "*&order=title.asc&limit=8")
  ]).then(function(results){
    const services = (results[0] || []).map(function(d){
      const thumb = (d.images && d.images[0]) ? d.images[0] : "";
      return { thumb: thumb, label: d.name, sub: "🛍️ " + d.zone + (d.price ? " — " + d.price : ""), url: "service-detail.html?id=" + d.id };
    });
    const produits = (results[1] || []).map(function(d){
      const thumb = (d.images && d.images[0]) ? d.images[0] : "";
      return { thumb: thumb, label: d.name, sub: "🛒 " + (d.category || "Boutique") + " — " + d.price + " $", url: "product-detail.html?id=" + d.id };
    });
    const podcasts = (results[2] || []).map(function(d){
      return { thumb: "", label: d.title, sub: "🎙️ Podcast — Média & Digital", url: "service-media.html" };
    });
    return pageMatches.concat(services, produits, podcasts);
  });
}

function renderSearchResultItems(items){
  if (!items || items.length === 0) return '<p class="cm-empty">Aucun résultat sur le site pour cette recherche.</p>';
  return items.map(function(r){
    return '<a class="search-result-item" href="' + r.url + '">' +
      (r.thumb ? '<img src="' + esc(r.thumb) + '">' : '<span class="search-result-noimg"></span>') +
      '<span class="search-result-info"><b>' + esc(r.label) + '</b><span>' + esc(r.sub) + '</span></span>' +
    '</a>';
  }).join("");
}

function setupSiteSearch(){
  const btn = document.getElementById("search-toggle");
  if (!btn) return;
  btn.addEventListener("click", openSearchModal);
}

function openSearchModal(){
  closeSearchModal();
  const overlay = document.createElement("div");
  overlay.className = "video-modal-overlay search-modal-overlay";
  overlay.id = "search-modal-overlay";
  overlay.onclick = function(e){ if (e.target === overlay) closeSearchModal(); };
  overlay.innerHTML =
    '<div class="search-modal-box">' +
      '<div class="search-modal-head">' +
        '<input type="search" id="search-input" placeholder="Rechercher sur Golden...">' +
        '<button class="video-modal-close" id="search-close-btn" aria-label="Fermer" style="position:static;">✕</button>' +
      '</div>' +
      '<div id="search-results" class="search-results"><p class="cm-empty">Commence à taper pour chercher sur le site.</p></div>' +
    '</div>';
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  document.getElementById("search-close-btn").addEventListener("click", closeSearchModal);

  const input = document.getElementById("search-input");
  input.focus();
  let debounceTimer;
  input.addEventListener("input", function(){
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function(){ runSiteSearch(input.value.trim()); }, 350);
  });
}

function closeSearchModal(){
  const existing = document.getElementById("search-modal-overlay");
  if (existing) existing.remove();
  document.body.style.overflow = "";
}

function runSiteSearch(query){
  const results = document.getElementById("search-results");
  if (!results) return;
  if (!query){
    results.innerHTML = '<p class="cm-empty">Commence à taper pour chercher sur le site.</p>';
    return;
  }
  results.innerHTML = '<p class="cm-empty">Recherche...</p>';

  fetchSearchResults(query)
    .then(function(items){ results.innerHTML = renderSearchResultItems(items); })
    .catch(function(err){
      console.error("Erreur recherche :", err);
      results.innerHTML = '<p class="cm-empty">Recherche momentanément indisponible.</p>';
    });
}

// ---- Barre de recherche intégrée sur l'accueil (menu déroulant sous le champ) ----
function setupInlineSearch(inputId, resultsId){
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  if (!input || !results) return;
  let debounceTimer;

  input.addEventListener("input", function(){
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (!query){ results.innerHTML = ""; results.classList.remove("open"); return; }
    debounceTimer = setTimeout(function(){
      fetchSearchResults(query)
        .then(function(items){
          results.classList.add("open");
          results.innerHTML = renderSearchResultItems(items);
        })
        .catch(function(err){ console.error("Erreur recherche :", err); });
    }, 300);
  });

  document.addEventListener("click", function(e){
    if (!input.contains(e.target) && !results.contains(e.target)){
      results.classList.remove("open");
    }
  });
}

function renderAccountWidget(){
  const zone = document.getElementById("account-widget");
  if (!zone) return;
  const session = getClientSession();
  if (!session){
    zone.innerHTML = '<a href="compte.html" class="account-link">Se connecter</a>';
    return;
  }
  loadOwnProfile().then(function(profile){
    const name = (profile && profile.full_name) ? profile.full_name : "Mon compte";
    const avatar = (profile && profile.avatar_url) ? profile.avatar_url : null;
    const initial = esc(name.trim().charAt(0).toUpperCase() || "U");
    const avatarHtml = avatar
      ? '<img src="' + esc(avatar) + '" class="account-avatar" alt="">'
      : '<span class="account-avatar account-avatar-fallback">' + initial + '</span>';
    // Seule la photo/initiale s'affiche dans l'en-tête (le nom complet reste sur "Mon compte" — pas de place limitée là-bas)
    zone.innerHTML = '<a href="compte.html" class="account-chip" aria-label="' + esc(name) + '" title="' + esc(name) + '">' + avatarHtml + '</a>';
  }).catch(function(){
    zone.innerHTML = '<a href="compte.html" class="account-chip">👤</a>';
  });
}
