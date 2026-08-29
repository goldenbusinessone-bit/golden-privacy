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
        setupServicesToggle();
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

// "Nos Services" — au clic, révèle la liste des 4 zones (repliée par défaut)
function setupServicesToggle(){
  const toggle = document.getElementById("services-toggle");
  const submenu = document.getElementById("services-submenu");
  if (toggle && submenu){
    toggle.addEventListener("click", function(){
      submenu.classList.toggle("open");
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

// Récupère un résumé du contenu réellement publié (services, produits,
// podcasts récents) pour que l'assistant réponde toujours à jour, sans
// inventer. Mis en cache après le premier appel (évite de re-solliciter
// la base à chaque message envoyé dans la même visite).
let goldenChatContextCache = null;
function buildGoldenChatContext(){
  if (goldenChatContextCache) return Promise.resolve(goldenChatContextCache);
  return Promise.all([
    supaRequest("services_golden?is_public=eq.true&select=zone,name,price&order=created_at.desc&limit=20"),
    supaRequest("produits_golden?select=name,price,category&order=created_at.desc&limit=20"),
    supaRequest("podcasts_golden?select=title&order=created_at.desc&limit=10")
  ]).then(function(results){
    const services = results[0] || [];
    const produits = results[1] || [];
    const podcasts = results[2] || [];
    let ctx = "Voici le contenu actuellement publié sur le site Golden — base-toi UNIQUEMENT sur ces informations réelles pour répondre sur les services, produits et podcasts (n'invente jamais un prix ou un article qui n'y figure pas) :\n\n";
    if (services.length){
      ctx += "Services disponibles :\n" + services.map(function(s){ return "- " + s.name + " (" + s.zone + ")" + (s.price ? " — " + s.price : ""); }).join("\n") + "\n\n";
    }
    if (produits.length){
      ctx += "Produits en boutique :\n" + produits.map(function(p){ return "- " + p.name + (p.category ? " (" + p.category + ")" : "") + (p.price ? " — " + (typeof p.price === "number" ? p.price.toFixed(2) + " $" : p.price) : ""); }).join("\n") + "\n\n";
    }
    if (podcasts.length){
      ctx += "Derniers podcasts publiés :\n" + podcasts.map(function(p){ return "- " + p.title; }).join("\n") + "\n\n";
    }
    goldenChatContextCache = ctx;
    return ctx;
  }).catch(function(){ return ""; });
}

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
    bubble.classList.toggle("open-state", isOpen);
    if (isOpen && !body.dataset.greeted){
      body.dataset.greeted = "1";
      addMsg(GOLDEN_CHAT_WELCOME, "bot");
      input.focus();
    }
  });
  document.getElementById("golden-chat-close").addEventListener("click", function(){
    win.classList.remove("open");
    bubble.classList.remove("open-state");
  });

  function sendMessage(){
    const text = input.value.trim();
    if (!text) return;
    addMsg(text, "user");
    input.value = "";
    const typingMsg = addMsg("...en train d'écrire", "typing");

    buildGoldenChatContext().then(function(context){
      return callGoldenAI("chat", context + "Question du visiteur : " + text);
    })
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

// ============================================================
// 🎨 GÉNÉRATION D'IMAGE PAR IA — Bibliothèque Golden
// Renvoie une data URL (image/png;base64,...) directement utilisable
// dans <img src="..."> ou fabric.Image.fromURL(...).
// ============================================================
function generateGoldenAIImage(prompt){
  return fetch(SUPABASE_URL + "/functions/v1/gemini-image-proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ prompt: prompt })
  })
    .then(function(res){ return res.json(); })
    .then(function(data){
      if (data.error) throw new Error(data.error);
      return "data:" + data.mime_type + ";base64," + data.image_base64;
    });
}

// Retouche/édite une image existante par IA (peau, qualité, effets...).
// imageDataUrl = "data:image/png;base64,...." (ce que fournit un <canvas> ou un fichier)
function retouchGoldenAIImage(imageDataUrl, prompt){
  const commaIndex = imageDataUrl.indexOf(",");
  const meta = imageDataUrl.slice(5, commaIndex); // ex: "image/png;base64"
  const mimeType = meta.split(";")[0];
  const base64 = imageDataUrl.slice(commaIndex + 1);

  return fetch(SUPABASE_URL + "/functions/v1/gemini-image-proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ prompt: prompt, image_base64: base64, image_mime_type: mimeType })
  })
    .then(function(res){ return res.json(); })
    .then(function(data){
      if (data.error) throw new Error(data.error);
      return "data:" + data.mime_type + ";base64," + data.image_base64;
    });
}

// ============================================================
// 🛡️ VÉRIFICATION VPN — avant commande / retrait Golden Pay
// Renvoie { is_vpn: true/false }. En cas d'erreur ou de doute,
// renvoie is_vpn:false pour ne jamais bloquer un client légitime
// par accident.
// ============================================================
function checkIsVpn(){
  return fetch(SUPABASE_URL + "/functions/v1/vpn-check", {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY
    }
  })
    .then(function(res){ return res.json(); })
    .catch(function(){ return { is_vpn: false }; });
}

// ============================================================
// 🌍 pickLang — choisit le texte traduit (EN/SW) déjà enregistré
// en base, ou retombe sur le texte français si absent/vide.
// ============================================================
// pickLang(row, "name", "name") -> le 2e argument est le champ FR de repli,
// le 3e le préfixe de colonne ("name", "desc", "title"...). Cherche
// row[prefix + "_" + langue_active], retombe sur le français si absent.
function pickLang(row, frField, colPrefix){
  const lang = localStorage.getItem("golden_lang") || "fr";
  if (lang !== "fr"){
    const val = row[colPrefix + "_" + lang];
    if (val) return val;
  }
  return row[frField] || "";
}

// ============================================================
// 🌍 autoTranslateFields — utilisé par le panel admin au moment
// de publier un service/produit/podcast : traduit automatiquement
// en anglais, espagnol, italien et swahili avant l'enregistrement.
// field1/field2 = ex. "name"/"desc" ou "title"/"desc"
// Renvoie { [field1+"_en"]:.., [field2+"_en"]:.., [field1+"_es"]:.., ... }
// ============================================================
const GOLDEN_TRANSLATE_LANGS = [
  { code: "en", name: "anglais" },
  { code: "es", name: "espagnol" },
  { code: "it", name: "italien" },
  { code: "sw", name: "swahili" }
];
function autoTranslateFields(field1, value1, field2, value2){
  const jobs = [];
  const keys = [];
  GOLDEN_TRANSLATE_LANGS.forEach(function(l){
    if (value1){ jobs.push(callGoldenAI("translate", value1, l.name)); keys.push(field1 + "_" + l.code); }
    if (value2){ jobs.push(callGoldenAI("translate", value2, l.name)); keys.push(field2 + "_" + l.code); }
  });
  return Promise.all(jobs.map(function(p){ return p.catch(function(){ return null; }); }))
    .then(function(results){
      const out = {};
      results.forEach(function(val, i){ out[keys[i]] = val; });
      return out;
    });
}

// ============================================================
// ⭐ AVIS CLIENTS — étoiles, moyenne, publication d'un avis
// ============================================================

// Récupère { [target_id]: { avg, count } } pour tous les avis d'un type donné.
// Utilisé pour afficher les étoiles sur les grilles de fiches (services/produits).
function loadRatingsSummary(targetType){
  return supaRequest("avis_summary_golden?target_type=eq." + targetType + "&select=target_id,avg_rating,review_count")
    .then(function(rows){
      const map = {};
      (rows || []).forEach(function(r){ map[r.target_id] = { avg: r.avg_rating, count: r.review_count }; });
      return map;
    })
    .catch(function(){ return {}; });
}

// Génère le HTML des étoiles (pleines/vides) + le texte "4.7 (12 avis)"
function renderStarsHtml(avg, count){
  if (!avg || !count) return '<span class="stars-empty">Pas encore d\'avis</span>';
  let stars = "";
  for (let i = 1; i <= 5; i++){
    stars += (i <= Math.round(avg)) ? "★" : "☆";
  }
  return '<span class="stars-filled">' + stars + '</span> <span class="stars-count">' + avg + ' (' + count + ' avis)</span>';
}

// Publie ou met à jour l'avis du client connecté sur un service/produit.
function submitReview(targetType, targetId, rating, comment){
  const session = getClientSession();
  if (!session) return Promise.reject(new Error("Connecte-toi pour laisser un avis."));
  return clientRequest("avis_golden", {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
    body: { user_id: session.user.id, target_type: targetType, target_id: targetId, rating: rating, comment: comment || null }
  });
}

// Widget complet d'avis pour une page de détail (service ou produit) :
// affiche la note moyenne, les derniers commentaires, et le formulaire
// pour laisser son propre avis si le client est connecté.
function loadReviewWidget(targetType, targetId, containerId){
  const box = document.getElementById(containerId);
  if (!box) return;

  supaRequest("avis_golden?target_type=eq." + targetType + "&target_id=eq." + targetId + "&select=rating,comment,created_at&order=created_at.desc&limit=10")
    .then(function(reviews){
      const count = reviews.length;
      const avg = count ? (reviews.reduce(function(s, r){ return s + r.rating; }, 0) / count).toFixed(1) : null;

      const loggedIn = isClientLoggedIn();
      box.innerHTML =
        '<div class="review-summary">' + renderStarsHtml(avg, count) + '</div>' +
        (loggedIn ?
          '<div class="review-form">' +
            '<div class="star-picker" id="star-picker-' + targetId + '">' +
              [1,2,3,4,5].map(function(n){ return '<span class="star-pick" data-val="' + n + '">☆</span>'; }).join("") +
            '</div>' +
            '<textarea id="review-comment-' + targetId + '" placeholder="Ton avis (facultatif)..." style="width:100%;margin-top:8px;min-height:60px;border:1px solid var(--stone-line);border-radius:6px;padding:8px;font-family:inherit;font-size:13px;"></textarea>' +
            '<button type="button" class="btn btn-onlight" id="review-submit-' + targetId + '" style="margin-top:8px;">Publier mon avis</button>' +
            '<p id="review-status-' + targetId + '" style="font-size:12.5px;color:var(--gold);margin-top:6px;display:none;"></p>' +
          '</div>'
          : '<p style="font-size:12.5px;color:var(--text-mute);margin-top:8px;"><a href="compte.html">Connecte-toi</a> pour laisser un avis.</p>'
        ) +
        (count ? '<div class="review-list">' + reviews.filter(function(r){ return r.comment; }).map(function(r){
            return '<div class="review-item"><span class="stars-filled">' + "★".repeat(r.rating) + "☆".repeat(5 - r.rating) + '</span><p>' + esc(r.comment) + '</p></div>';
          }).join("") + '</div>' : '');

      if (loggedIn){
        let selectedRating = 0;
        const picker = document.getElementById("star-picker-" + targetId);
        picker.querySelectorAll(".star-pick").forEach(function(star){
          star.addEventListener("click", function(){
            selectedRating = parseInt(star.dataset.val, 10);
            picker.querySelectorAll(".star-pick").forEach(function(s){
              s.textContent = (parseInt(s.dataset.val, 10) <= selectedRating) ? "★" : "☆";
            });
          });
        });
        document.getElementById("review-submit-" + targetId).addEventListener("click", function(){
          const status = document.getElementById("review-status-" + targetId);
          if (!selectedRating){ alert("Choisis une note en étoiles avant de publier."); return; }
          const comment = document.getElementById("review-comment-" + targetId).value.trim();
          status.style.display = "block";
          status.style.color = "var(--gold)";
          status.textContent = "Envoi...";
          submitReview(targetType, targetId, selectedRating, comment).then(function(){
            status.textContent = "✅ Merci pour ton avis !";
            setTimeout(function(){ loadReviewWidget(targetType, targetId, containerId); }, 1200);
          }).catch(function(err){
            status.style.color = "#c85a5a";
            status.textContent = "❌ " + err.message;
          });
        });
      }
    })
    .catch(function(err){ console.error("Erreur chargement avis :", err); });
}

// ============================================================
// 🆕 CARROUSEL D'ACCUEIL — mélange services + produits récents,
// affichés par groupes de 4, défilement automatique.
// ============================================================
function loadHomeCarousel(trackId, dotsId){
  const track = document.getElementById(trackId);
  const dots = document.getElementById(dotsId);
  if (!track) return;

  Promise.all([
    supaRequest("services_golden?is_public=eq.true&order=created_at.desc&limit=12&select=id,name,name_en,name_sw,price,images,created_at"),
    supaRequest("produits_golden?order=created_at.desc&limit=12&select=id,name,name_en,name_sw,price,images,created_at"),
    loadRatingsSummary("service"),
    loadRatingsSummary("produit")
  ]).then(function(results){
    const services = (results[0] || []).map(function(d){ return Object.assign({}, d, { _type: "service" }); });
    const produits = (results[1] || []).map(function(d){ return Object.assign({}, d, { _type: "produit" }); });
    const ratingsService = results[2] || {};
    const ratingsProduit = results[3] || {};

    const merged = services.concat(produits)
      .sort(function(a, b){ return new Date(b.created_at) - new Date(a.created_at); })
      .slice(0, 12);

    if (merged.length === 0){
      track.innerHTML = '<p class="cm-empty">Rien de nouveau pour le moment.</p>';
      return;
    }

    // Découpe en pages de 4 articles
    const pages = [];
    for (let i = 0; i < merged.length; i += 4) pages.push(merged.slice(i, i + 4));

    track.innerHTML = pages.map(function(page){
      return '<div class="home-carousel-page">' +
        page.map(function(d){
          const thumb = (d.images && d.images[0]) ? d.images[0] : "";
          const displayName = pickLang(d, "name", "name");
          const link = (d._type === "service" ? "service-detail.html?id=" : "product-detail.html?id=") + d.id;
          const r = (d._type === "service" ? ratingsService : ratingsProduit)[d.id];
          return '<a class="home-carousel-card" href="' + link + '">' +
            (thumb ? (isVideoUrl(thumb) ? '<video src="' + esc(thumb) + '" muted></video>' : '<img src="' + esc(thumb) + '" alt="' + esc(displayName) + '" loading="lazy">') : '<span class="service-card-noimg"></span>') +
            '<div class="home-carousel-card-body">' +
              '<div class="home-carousel-card-name">' + esc(displayName) + '</div>' +
              '<div class="home-carousel-card-rating">' + renderStarsHtml(r && r.avg, r && r.count) + '</div>' +
              (d.price ? '<div class="home-carousel-card-price">' + esc(d.price) + '</div>' : '') +
            '</div>' +
          '</a>';
        }).join("") +
      '</div>';
    }).join("");

    if (pages.length <= 1) return; // pas besoin de défilement pour une seule page

    dots.innerHTML = pages.map(function(_, i){
      return '<span class="carousel-dot' + (i === 0 ? ' active' : '') + '" data-page="' + i + '"></span>';
    }).join("");

    let current = 0;
    function goToPage(i){
      current = i;
      track.style.transform = "translateX(-" + (i * 100) + "%)";
      dots.querySelectorAll(".carousel-dot").forEach(function(d, di){
        d.classList.toggle("active", di === i);
      });
    }
    dots.querySelectorAll(".carousel-dot").forEach(function(dot){
      dot.addEventListener("click", function(){ goToPage(parseInt(dot.dataset.page, 10)); });
    });

    let autoTimer = setInterval(function(){
      goToPage((current + 1) % pages.length);
    }, 4500);

    // Pause le défilement pendant que le visiteur interagit avec le carrousel
    const section = track.closest(".home-carousel-section") || track.parentElement;
    track.addEventListener("touchstart", function(){ clearInterval(autoTimer); });
    track.addEventListener("mouseenter", function(){ clearInterval(autoTimer); });
    track.addEventListener("mouseleave", function(){
      autoTimer = setInterval(function(){ goToPage((current + 1) % pages.length); }, 4500);
    });
  }).catch(function(err){
    console.error("Erreur carrousel d'accueil :", err);
    track.innerHTML = '<p class="cm-empty">Nouveautés momentanément indisponibles.</p>';
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
  return localStorage.getItem("golden_admin_token");
}
function setSupaToken(token){
  if (token) localStorage.setItem("golden_admin_token", token);
  else localStorage.removeItem("golden_admin_token");
}
function getSupaRefreshToken(){
  return localStorage.getItem("golden_admin_refresh_token");
}
function setSupaRefreshToken(token){
  if (token) localStorage.setItem("golden_admin_refresh_token", token);
  else localStorage.removeItem("golden_admin_refresh_token");
}
function isSupaLoggedIn(){
  return !!getSupaToken();
}

// Renouvelle le jeton admin avant qu'il n'expire (silencieux, en arrière-plan)
function scheduleSupaRefresh(){
  setTimeout(function(){
    const refreshToken = getSupaRefreshToken();
    if (!refreshToken) return;
    fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    }).then(function(res){ return res.json(); }).then(function(data){
      if (data.access_token){
        setSupaToken(data.access_token);
        setSupaRefreshToken(data.refresh_token);
        scheduleSupaRefresh(); // reprogramme le prochain renouvellement
      }
    }).catch(function(){});
  }, 50 * 60 * 1000); // renouvelle toutes les 50 minutes (avant l'expiration à 60 min)
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

function supaSignIn(email, pass, captchaToken){
  return fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email, password: pass,
      gotrue_meta_security: { captcha_token: captchaToken }
    })
  }).then(function(res){
    return res.json().then(function(data){
      if (!res.ok) throw new Error(data.error_description || data.msg || "Connexion refusée.");
      setSupaToken(data.access_token);
      setSupaRefreshToken(data.refresh_token);
      scheduleSupaRefresh();
      return data;
    });
  });
}

// Tente de renouveler la session admin dès l'arrivée sur la page (silencieux).
// Renvoie true si la session a pu être restaurée/renouvelée, sinon false.
function supaTryRestoreSession(){
  const refreshToken = getSupaRefreshToken();
  if (!refreshToken) return Promise.resolve(isSupaLoggedIn());
  return fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken })
  }).then(function(res){ return res.json(); }).then(function(data){
    if (data.access_token){
      setSupaToken(data.access_token);
      setSupaRefreshToken(data.refresh_token);
      scheduleSupaRefresh();
      return true;
    }
    return isSupaLoggedIn();
  }).catch(function(){ return isSupaLoggedIn(); });
}

function supaSignOut(){
  setSupaToken(null);
  setSupaRefreshToken(null);
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
  Promise.all([
    supaRequest("services_golden?zone=eq." + encodeURIComponent(zone) + "&is_public=eq.true&order=created_at.desc"),
    loadRatingsSummary("service")
  ])
    .then(function(results){
      const rows = results[0];
      const ratings = results[1];
      if (!rows || rows.length === 0){
        grid.innerHTML = '<p class="cm-empty">Aucun service publié pour cette zone pour le moment.</p>';
        return;
      }
      grid.innerHTML = rows.map(function(d){
        const thumb = (d.images && d.images[0]) ? d.images[0] : "";
        const displayName = pickLang(d, "name", "name");
        const displayDesc = pickLang(d, "description", "desc");
        const shortDesc = (displayDesc || "").slice(0, 70);
        const r = ratings[d.id];
        return '<a class="service-card" href="service-detail.html?id=' + d.id + '">' +
          (thumb ? (isVideoUrl(thumb) ? '<video src="' + esc(thumb) + '" muted></video>' : '<img src="' + esc(thumb) + '" alt="' + esc(displayName) + '" loading="lazy">') : '<span class="service-card-noimg"></span>') +
          '<div class="service-card-body">' +
            '<div class="service-card-name">' + esc(displayName) + '</div>' +
            '<div class="service-card-rating">' + renderStarsHtml(r && r.avg, r && r.count) + '</div>' +
            (shortDesc ? '<div class="service-card-desc">' + esc(shortDesc) + (displayDesc.length > 70 ? '…' : '') + '</div>' : '') +
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
      const pTitle = pickLang(d, "title", "title");
      const pDesc = pickLang(d, "description", "desc");
      if (d.audio_url){
        return '<div class="podcast-card">' +
          '<h4>' + esc(pTitle) + '</h4>' +
          viewsBadge +
          '<p>' + esc(pDesc) + '</p>' +
          '<audio src="' + esc(d.audio_url) + '" controls preload="none" style="width:100%;"></audio>' +
          '</div>';
      }

      const spotifyMatch = String(d.link || "").match(/open\.spotify\.com\/episode\/([A-Za-z0-9]+)/);
      const youtubeId = extractYouTubeId ? extractYouTubeId(d.link) : null;

      if (spotifyMatch){
        return '<div class="podcast-card">' +
          '<h4>' + esc(pTitle) + '</h4>' +
          viewsBadge +
          '<p>' + esc(pDesc) + '</p>' +
          '<iframe src="https://open.spotify.com/embed/episode/' + spotifyMatch[1] + '" width="100%" height="152" frameborder="0" allow="encrypted-media" loading="lazy"></iframe>' +
          '</div>';
      }
      if (youtubeId){
        return '<div class="podcast-card">' +
          '<h4>' + esc(pTitle) + '</h4>' +
          viewsBadge +
          '<p>' + esc(pDesc) + '</p>' +
          '<iframe src="https://www.youtube.com/embed/' + youtubeId + '" width="100%" height="200" style="border-radius:8px;border:none;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>' +
          '<a class="podcast-play" href="https://www.youtube.com/watch?v=' + youtubeId + '" target="_blank" rel="noopener" style="display:block;margin-top:8px;font-size:12px;">Voir sur YouTube →</a>' +
          '</div>';
      }
      return '<div class="podcast-card">' +
        '<h4>' + esc(pTitle) + '</h4>' +
        viewsBadge +
        '<p>' + esc(pDesc) + '</p>' +
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

function clientSignUp(email, pass, fullName, captchaToken){
  return fetch(SUPABASE_URL + "/auth/v1/signup", {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email, password: pass, data: { full_name: fullName },
      gotrue_meta_security: { captcha_token: captchaToken }
    })
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

function clientSignIn(email, pass, captchaToken){
  return fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email, password: pass,
      gotrue_meta_security: { captcha_token: captchaToken }
    })
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
