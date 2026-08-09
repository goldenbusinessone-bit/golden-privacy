/* =========================
   script.js - version corrigée
   Firebase (Auth + Firestore) + Supabase Storage
   ========================= */

/* ---------- PARTIELS (header/footer) ---------- */
function loadGoldenPartials(){
  const headerEl = document.getElementById("site-header");
  const footerEl = document.getElementById("site-footer");

  if (headerEl){
    fetch("header.html", { cache: "no-store" })
      .then(r => r.text())
      .then(html => {
        headerEl.innerHTML = html;
        if (typeof markActiveNavLink === "function") markActiveNavLink();
        if (typeof setupNavToggle === "function") setupNavToggle();
        if (typeof applyGoldenLanguage === "function" && localStorage.getItem("golden_lang")){
          applyGoldenLanguage(localStorage.getItem("golden_lang"));
        } else if (typeof initGoldenLanguage === "function" && !localStorage.getItem("golden_lang")){
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
    toggle.addEventListener("click", function(){ nav.classList.toggle("open"); });
  }
}

document.addEventListener("DOMContentLoaded", loadGoldenPartials);

/* ---------- CONFIG FIREBASE ---------- */
/* Remplace ces valeurs par celles de TON projet Firebase */
const firebaseConfig = {
  apiKey: "AlzaSyA8z6VK6M-IqQkfpGvAaQMzWRtgYQg6avQ",
  authDomain: "agence-golden-9ce4e.firebaseapp.com",
  projectId: "agence-golden-9ce4e",
  storageBucket: "agence-golden-9ce4e.firebasestorage.app",
  messagingSenderId: "991392422419",
  appId: "1:991392422419:web:9df9a891823b8ec43dbde6"
};

let db = null;
let auth = null;
/* UID admin (vérifie que c'est bien l'UID Firebase de ton compte admin) */
const GOLDEN_ADMIN_UID = "nfaBczkicphDl0UUryKmbD4dMyx2";

/* ---------- CONFIG SUPABASE STORAGE ---------- */
const SUPABASE_URL = "https://tmvkalnetmgcditrpenz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jLjHM7CX2J7vSblzTOOuSg_VECOhgLP";
const SUPABASE_BUCKET = "Golden_media";

/* ---------- INITIALISATION ---------- */
if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "VOTRE_API_KEY_ICI") {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  if (typeof firebase.auth === "function") auth = firebase.auth();
} else {
  console.warn("Configuration Firebase manquante : complétez firebaseConfig.");
}

/* ---------- UTILITAIRES ---------- */
function esc(s){
  return String(s || "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function timeAgo(ts){
  if (!ts || !ts.toDate) return "à l'instant";
  const diff = Math.floor((Date.now() - ts.toDate().getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return Math.floor(diff / 60) + " min";
  if (diff < 86400) return Math.floor(diff / 3600) + " h";
  return Math.floor(diff / 86400) + " j";
}

/* Extrait l'ID YouTube (gère youtu.be, watch?v=, embed, shorts) */
function extractYouTubeld(url){
  const s = String(url || "");
  const m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/* ---------- UPLOAD VERS SUPABASE (fetch) ---------- */
/* Retourne l'URL publique (le bucket doit être public) */
async function uploadToSupabase(file, folder){
  if (!file) throw new Error("Aucun fichier fourni");
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_ ]/g, "_");
  const path = `${folder}/${Date.now()}-${safeName}`;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error("Échec de l'envoi vers Supabase : " + t);
  }

  // URL publique (assure-toi que le bucket est public)
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
}

/* ---------- AUTH ADMIN ---------- */
function adminSignIn(){
  const email = document.getElementById("admin-email").value.trim();
  const pass = document.getElementById("admin-pass").value;
  const err = document.getElementById("auth-error");
  if (err) { err.style.display = "none"; err.textContent = ""; }

  if (!email || !pass){
    if (err){ err.textContent = "E-mail et mot de passe requis."; err.style.display = "block"; }
    return;
  }
  if (!auth){
    if (err){ err.textContent = "Firebase Authentication n'est pas encore activé sur ce projet."; err.style.display = "block"; }
    return;
  }

  document.getElementById("btn-signin").disabled = true;
  auth.signInWithEmailAndPassword(email, pass).catch(function(e){
    if (err){ err.textContent = "Connexion refusée : " + e.message; err.style.display = "block"; }
    document.getElementById("btn-signin").disabled = false;
  });
}

if (auth){
  auth.onAuthStateChanged(function(user){
    const isAdmin = user && user.uid === GOLDEN_ADMIN_UID;
    const authCard = document.getElementById("auth-card");
    const adminPanel = document.getElementById("admin-panel");
    if (authCard) authCard.style.display = isAdmin ? "none" : "block";
    if (adminPanel) adminPanel.style.display = isAdmin ? "block" : "none";
    if (isAdmin){ loadAdminList(); loadPodcastAdminList(); }
    else { const btn = document.getElementById("btn-signin"); if (btn) btn.disabled = false; }
  });
}

/* ---------- PUBLIER UNE RÉALISATION ---------- */
function showUploadStatus(text, isError){
  const status = document.getElementById("upload-status");
  if (!status) return;
  status.style.display = "block";
  status.style.color = isError ? "#c85a5a" : "var(--gold)";
  status.textContent = text;
}
function clearUploadStatus(){
  const status = document.getElementById("upload-status");
  if (!status) return;
  status.style.display = "none";
}

function publishRealisation(){
  const btn = document.getElementById("btn-publish");
  if (btn) btn.disabled = true;

  const zone = document.getElementById("ad-zone").value;
  const title = document.getElementById("ad-title").value.trim();
  const description = document.getElementById("ad-desc").value.trim();
  const link = document.getElementById("ad-link").value.trim();
  const fileInput = document.getElementById("ad-file");
  const file = fileInput ? fileInput.files[0] : null;
  const videoUrl = document.getElementById("ad-video").value.trim();
  const youtubeld = extractYouTubeld(videoUrl);

  if (!title || (!file && !youtubeld)){
    alert("Ajoute un titre, et soit une photo/vidéo, soit un lien YouTube valide.");
    if (btn) btn.disabled = false;
    return;
  }

  showUploadStatus("Préparation ...");

  // Cas 1 : vidéo YouTube
  if (youtubeld){
    showUploadStatus("Publication de la vidéo ... ");
    db.collection("realisations_golden").add({
      zone: zone,
      title: title,
      description: description,
      link: link || null,
      imageUrl: `https://img.youtube.com/vi/${youtubeld}/hqdefault.jpg`,
      videold: youtubeld,
      mediaType: "youtube",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(finishPublish).catch(function(err){
      showUploadStatus("X " + err.message, true);
      if (btn) btn.disabled = false;
    });
    return;
  }

  // Cas 2 : fichier (photo ou vidéo) -> Supabase
  const maxSize = 50 * 1024 * 1024;
  if (!file){
    showUploadStatus("Aucun fichier sélectionné.", true);
    if (btn) btn.disabled = false;
    return;
  }
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo){
    showUploadStatus("Le fichier doit être une image ou une vidéo.", true);
    if (btn) btn.disabled = false;
    return;
  }
  if (file.size > maxSize){
    showUploadStatus("Fichier trop lourd (max 50 Mo).", true);
    if (btn) btn.disabled = false;
    return;
  }

  showUploadStatus("Envoi du fichier en cours ... ");
  uploadToSupabase(file, "realisations")
    .then(function(url){
      showUploadStatus("Fichier envoyé / enregistrement en cours ... ");
      return db.collection("realisations_golden").add({
        zone: zone,
        title: title,
        description: description,
        link: link || null,
        imageUrl: url,
        mediaType: isVideo ? "video" : "image",
        videold: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(finishPublish)
    .catch(function(err){
      showUploadStatus("X " + err.message, true);
      if (btn) btn.disabled = false;
    });
}

function finishPublish(){
  showUploadStatus("Publié avec succès !");
  const fields = ["ad-title","ad-desc","ad-link","ad-video","ad-file"];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "file") el.value = "";
    else el.value = "";
  });
  const btn = document.getElementById("btn-publish");
  if (btn) btn.disabled = false;
  loadAdminList();
  setTimeout(clearUploadStatus, 2500);
}

/* ---------- PODCASTS ---------- */
function publishPodcast(){
  const btn = document.getElementById("btn-publish-podcast");
  const title = document.getElementById("pc-title").value.trim();
  const description = document.getElementById("pc-desc").value.trim();
  const link = document.getElementById("pc-link").value.trim();
  const audioFile = document.getElementById("pc-audio").files[0];
  const status = document.getElementById("podcast-status");

  if (!title || (!link && !audioFile)){
    alert("Ajoute au moins un titre, et soit un lien, soit un fichier audio.");
    return;
  }

  btn.disabled = true;
  if (status){ status.style.display = "block"; status.style.color = "var(--gold)"; }

  function savePodcast(audioUrl){
    return db.collection("podcasts_golden").add({
      title: title,
      description: description,
      link: link || null,
      audioUrl: audioUrl || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  let uploadPromise;
  if (audioFile){
    if (status) status.textContent = "Envoi du fichier audio en cours ... ";
    uploadPromise = uploadToSupabase(audioFile, "podcasts").then(savePodcast);
  } else {
    if (status) status.textContent = "Publication en cours ... ";
    uploadPromise = savePodcast(null);
  }

  uploadPromise.then(function(){
    if (status){ status.textContent = "Podcast publié !"; }
    ["pc-title","pc-desc","pc-link","pc-audio"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === "file") el.value = "";
      else el.value = "";
    });
    btn.disabled = false;
    loadPodcastAdminList();
    setTimeout(function(){ if (status) status.style.display = "none"; }, 2500);
  }).catch(function(err){
    if (status){ status.style.color = "#c85a5a"; status.textContent = "X " + err.message; }
    btn.disabled = false;
  });
}

function loadPodcastAdminList(){
  const list = document.getElementById("podcast-admin-list");
  if (!list || !db) return;
  db.collection("podcasts_golden").orderBy("createdAt","desc").onSnapshot(function(snapshot){
    if (snapshot.empty){
      list.innerHTML = '<p style="font-size:13px;color:var(--text-mute);">Aucun podcast publié pour le moment.</p>';
      return;
    }
    list.innerHTML = "";
    snapshot.docs.forEach(function(doc){
      const d = doc.data();
      const item = document.createElement("div");
      item.className = "admin-list-item";
      item.innerHTML = '<div class="info"><b>' + esc(d.title) + '</b>' + (d.link ? esc(d.link) : '') + '</div>';
      const btn = document.createElement("button");
      btn.textContent = "Supprimer";
      btn.onclick = function(){ deletePodcast(doc.id); };
      item.appendChild(btn);
      list.appendChild(item);
    });
  });
}

function deletePodcast(id){
  if (!confirm("Supprimer ce podcast ?")) return;
  db.collection("podcasts_golden").doc(id).delete();
}

/* ---------- LISTE + SUPPRESSION (réalisations) ---------- */
function loadAdminList(){
  const list = document.getElementById("admin-list");
  if (!list || !db) return;
  db.collection("realisations_golden").orderBy("createdAt","desc").onSnapshot(function(snapshot){
    if (snapshot.empty){
      list.innerHTML = '<p style="font-size:13px;color:var(--text-mute);">Aucune réalisation publiée pour le moment.</p>';
      return;
    }
    list.innerHTML = "";
    snapshot.docs.forEach(function(doc){
      const d = doc.data();
      const item = document.createElement("div");
      item.className = "admin-list-item";
      const imgHtml = '<img src="' + esc(d.imageUrl || '') + '" alt="' + esc(d.title || '') + '">';
      item.innerHTML = imgHtml + '<div class="info"><b>' + esc(d.title || '') + '</b>' + esc(d.zone || '') + '</div>';
      const btn = document.createElement("button");
      btn.textContent = "Supprimer";
      btn.onclick = function(){ deleteRealisation(doc.id); };
      item.appendChild(btn);
      list.appendChild(item);
    });
  });
}

function deleteRealisation(id){
  if (!confirm("Supprimer cette réalisation ?")) return;
  db.collection("realisations_golden").doc(id).delete();
}

/* ---------- AFFICHAGE PUBLIC (galerie, podcasts, commentaires) ---------- */
/* loadRealisationsMarquee : affiche une bande défilante pour une zone */
function loadRealisationsMarquee(zone, trackId){
  const track = document.getElementById(trackId);
  if (!track || !db) return;
  db.collection("realisations_golden").where("zone","==",zone).orderBy("createdAt","desc")
    .onSnapshot(function(snapshot){
      if (snapshot.empty){
        track.innerHTML = '<p class="cm-empty">Les premières réalisations de cette zone arrivent bientôt.</p>';
        return;
      }
      const items = snapshot.docs.map(function(doc){
        const d = doc.data();
        const playIcon = d.videold ? '<div class="marquee-play">▶</div>' : '';
        let media;
        if (d.mediaType === "video"){
          media = '<video src="' + esc(d.imageUrl || '') + '" muted loop playsinline controls preload="metadata"></video>';
        } else {
          media = '<img src="' + esc(d.imageUrl || '') + '" alt="' + esc(d.title || 'Réalisation Golden') + '">';
        }
        const img = '<div class="marquee-item">' + media + playIcon + '<div class="marquee-caption">' + esc(d.title || '') + '</div></div>';
        const openLink = d.videold ? ("https://www.youtube.com/watch?v=" + d.videold) : d.link;
        return openLink ? '<a href="' + esc(openLink) + '" target="_blank" rel="noopener">' + img + '</a>' : img;
      });
      track.innerHTML = items.join("") + items.join("");
    }, function(err){
      track.innerHTML = '<p class="cm-empty">Galerie momentanément indisponible.</p>';
      console.error("Erreur galerie (" + zone + ") :", err);
    });
}

/* loadRealisationsList : liste texte */
function loadRealisationsList(zone, listId){
  const list = document.getElementById(listId);
  if (!list || !db) return;
  db.collection("realisations_golden").where("zone","==",zone).orderBy("createdAt","desc")
    .onSnapshot(function(snapshot){
      if (snapshot.empty){ list.innerHTML = ""; return; }
      list.innerHTML = snapshot.docs.map(function(doc){
        const d = doc.data();
        return '<div class="realisation-card"><h4>' + esc(d.title || '') + '</h4><p>' + esc(d.description || '') + '</p>' +
          (d.link ? '<a href="' + esc(d.link) + '" target="_blank" rel="noopener" class="realisation-link">Voir le lien</a>' : '') +
          '</div>';
      }).join("");
    });
}

/* ---------- PODCASTS PUBLIC ---------- */
function loadPodcasts(containerId){
  const container = document.getElementById(containerId);
  if (!container || !db) return;
  db.collection("podcasts_golden").orderBy("createdAt","desc").onSnapshot(function(snapshot){
    if (snapshot.empty){
      container.innerHTML = '<p class="cm-empty">Le premier épisode arrive bientôt.</p>';
      return;
    }
    container.innerHTML = snapshot.docs.map(function(doc){
      const d = doc.data();
      if (d.audioUrl){
        return '<div class="podcast-card"><h4>' + esc(d.title) + '</h4><p>' + esc(d.description || '') + '</p>' +
          '<audio src="' + esc(d.audioUrl) + '" controls preload="none" style="width:100%;"></audio></div>';
      }
      const spotifyMatch = String(d.link || "").match(/open\.spotify\.com\/episode\/([A-Za-z0-9]+)/);
      const youtubeld = extractYouTubeld(d.link);
      if (spotifyMatch){
        return '<div class="podcast-card"><h4>' + esc(d.title) + '</h4><p>' + esc(d.description || '') + '</p>' +
          '<iframe src="https://open.spotify.com/embed/episode/' + spotifyMatch[1] + '" width="100%" height="152" frameborder="0" allow="encrypted-media" loading="lazy"></iframe></div>';
      }
      if (youtubeld){
        return '<div class="podcast-card"><h4>' + esc(d.title) + '</h4><p>' + esc(d.description || '') + '</p>' +
          '<a class="podcast-play" href="https://www.youtube.com/watch?v=' + youtubeld + '" target="_blank" rel="noopener">▶ Écouter sur YouTube</a></div>';
      }
      return '<div class="podcast-card"><h4>' + esc(d.title) + '</h4><p>' + esc(d.description || '') + '</p>' +
        '<a class="podcast-play" href="' + esc(d.link || '') + '" target="_blank" rel="noopener">▶ Écouter l\\'épisode</a></div>';
    }).join("");
  }, function(err){
    container.innerHTML = '<p class="cm-empty">Podcasts momentanément indisponibles.</p>';
    console.error(err);
  });
}

/* ---------- LIKES, COMMENTAIRES ---------- */
function setupZoneLike(zone, btnId, countId){
  const btn = document.getElementById(btnId);
  const countEl = document.getElementById(countId);
  if (!btn || !db || !countEl) return;
  const ref = db.collection("likes_golden").doc(zone);
  ref.onSnapshot(function(doc){
    countEl.textContent = doc.exists ? (doc.data().count || 0) : 0;
  });
  btn.addEventListener("click", function(){
    if (localStorage.getItem("liked_" + zone)) return;
    ref.set({ count: firebase.firestore.FieldValue.increment(1) }, { merge: true });
    localStorage.setItem("liked_" + zone, "1");
    btn.classList.add("liked");
  });
  if (localStorage.getItem("liked_" + zone)) btn.classList.add("liked");
}

/* Commentaires (écoute et envoi) */
document.querySelectorAll(".comments-list").forEach(function(container){
  const zone = container.dataset.zone;
  if (!db){ container.innerHTML = '<p class="cm-empty">Espace commentaires en cours d\\'activation ...</p>'; return; }
  db.collection("avis_golden").where("zone","==",zone).orderBy("createdAt","desc")
    .onSnapshot(function(snapshot){
      if (snapshot.empty){ container.innerHTML = '<p class="cm-empty">Soyez le premier à commenter cette zone</p>'; return; }
      container.innerHTML = snapshot.docs.map(doc => renderComment(doc.data())).join("");
    }, function(error){
      container.innerHTML = '<p class="cm-empty">Commentaires momentanément indisponibles.</p>';
      console.error("Erreur F
