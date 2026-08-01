// ============================================================
// 🌍 PARTIELS PARTAGÉS — charge header.html et footer.html
// automatiquement dans chaque page (une seule fois à modifier
// pour changer le menu ou le pied de page sur tout le site)
// ============================================================
function loadGoldenPartials(){
  const headerEl = document.getElementById("site-header");
  const footerEl = document.getElementById("site-footer");

  if (headerEl){
    fetch("header.html")
      .then(r => r.text())
      .then(html => {
        headerEl.innerHTML = html;
        markActiveNavLink();
        setupNavToggle();
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
    fetch("footer.html")
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
// 🔧 CONFIGURATION FIREBASE — remplace ces valeurs par celles
// de TON projet (Firebase Console → Paramètres du projet →
// Général → tes applications → objet firebaseConfig)
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyA8z6VK6M-lqQkfpGvAaQMzWRtgYQg6avQ",
  authDomain: "agence-golden-9ce4e.firebaseapp.com",
  projectId: "agence-golden-9ce4e",
  storageBucket: "agence-golden-9ce4e.firebasestorage.app",
  messagingSenderId: "991392422419",
  appId: "1:991392422419:web:9df9a891823b8ec43dbde6"
};

let db = null;
const GOLDEN_ADMIN_CODE = "GOLDEN2026"; // 🔧 change ce code secret quand tu veux, ici uniquement
const IMGBB_API_KEY = "e228d6ffaf60a7b3cb87c4cdafb148dd";

if (firebaseConfig.apiKey !== "VOTRE_API_KEY_ICI") {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
} else {
  console.warn("Configuration Firebase manquante : les commentaires ne fonctionneront pas tant que firebaseConfig n'est pas complété.");
}

// ============================================================
// 🖼️ RÉALISATIONS — galerie par zone (utilisé sur les pages
// de service ET sur le panneau admin)
// ============================================================

// Charge et affiche en continu les réalisations d'une zone dans une bande défilante
function loadRealisationsMarquee(zone, trackId){
  const track = document.getElementById(trackId);
  if (!track || !db) return;
  db.collection("realisations_golden")
    .where("zone", "==", zone)
    .orderBy("createdAt", "desc")
    .onSnapshot(function(snapshot){
      if (snapshot.empty){
        track.innerHTML = '<p class="cm-empty">Les premières réalisations de cette zone arrivent bientôt.</p>';
        return;
      }
      const items = snapshot.docs.map(function(doc){
        const d = doc.data();
        const playIcon = d.videoId ? '<div class="marquee-play">▶</div>' : '';
        const img = '<div class="marquee-item">' +
          '<img src="' + esc(d.imageUrl) + '" alt="' + esc(d.title || "Réalisation Golden") + '">' +
          playIcon +
          '<div class="marquee-caption">' + esc(d.title || "") + '</div>' +
          '</div>';
        const openLink = d.videoId ? ("https://www.youtube.com/watch?v=" + d.videoId) : d.link;
        return openLink ? '<a href="' + esc(openLink) + '" target="_blank" rel="noopener">' + img + '</a>' : img;
      });
      // dupliqué une fois pour un défilement continu sans coupure
      track.innerHTML = items.join("") + items.join("");
    }, function(err){
      track.innerHTML = '<p class="cm-empty">Galerie momentanément indisponible.</p>';
      console.error("Erreur galerie (" + zone + ") :", err);
    });
}

// Affiche la liste texte des réalisations (titre + description + lien) sous la bande
function loadRealisationsList(zone, listId){
  const list = document.getElementById(listId);
  if (!list || !db) return;
  db.collection("realisations_golden")
    .where("zone", "==", zone)
    .orderBy("createdAt", "desc")
    .onSnapshot(function(snapshot){
      if (snapshot.empty){
        list.innerHTML = "";
        return;
      }
      list.innerHTML = snapshot.docs.map(function(doc){
        const d = doc.data();
        return '<div class="realisation-card">' +
          '<h4>' + esc(d.title || "") + '</h4>' +
          '<p>' + esc(d.description || "") + '</p>' +
          (d.link ? '<a href="' + esc(d.link) + '" target="_blank" rel="noopener" class="realisation-link">Voir le lien →</a>' : '') +
          '</div>';
      }).join("");
    });
}

// Bouton "j'aime" par zone (compteur simple Firestore)
function setupZoneLike(zone, btnId, countId){
  const btn = document.getElementById(btnId);
  const countEl = document.getElementById(countId);
  if (!btn || !db) return;
  const ref = db.collection("likes_golden").doc(zone);

  ref.onSnapshot(function(doc){
    countEl.textContent = doc.exists ? (doc.data().count || 0) : 0;
  });

  btn.addEventListener("click", function(){
    if (localStorage.getItem("liked_" + zone)) return; // un like par visiteur/appareil
    ref.set({ count: firebase.firestore.FieldValue.increment(1) }, { merge: true });
    localStorage.setItem("liked_" + zone, "1");
    btn.classList.add("liked");
  });

  if (localStorage.getItem("liked_" + zone)) btn.classList.add("liked");
}

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

function renderComment(data){
  const initial = esc((data.name || "A").trim().charAt(0).toUpperCase() || "A");
  return `<div class="cm-item">
    <div class="cm-avatar">${initial}</div>
    <div class="cm-body">
      <div class="cm-meta">
        <span class="cm-name">${esc(data.name || "Anonyme")}</span>
        <span class="cm-time">${timeAgo(data.createdAt)}</span>
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

// Écoute en temps réel des commentaires, zone par zone
document.querySelectorAll(".comments-list").forEach(function(container){
  const zone = container.dataset.zone;
  if (!db){
    container.innerHTML = '<p class="cm-empty">Espace commentaires en cours d\'activation…</p>';
    return;
  }
  db.collection("avis_golden")
    .where("zone", "==", zone)
    .orderBy("createdAt", "desc")
    .onSnapshot(function(snapshot){
      if (snapshot.empty){
        container.innerHTML = '<p class="cm-empty">Soyez le premier à commenter cette zone ✨</p>';
        return;
      }
      container.innerHTML = snapshot.docs.map(doc => renderComment(doc.data())).join("");
    }, function(error){
      container.innerHTML = '<p class="cm-empty">Commentaires momentanément indisponibles.</p>';
      console.error("Erreur Firestore (" + zone + ") :", error);
    });
});

// Envoi d'un nouveau commentaire
document.querySelectorAll(".comment-form").forEach(function(form){
  form.addEventListener("submit", function(e){
    e.preventDefault();
    if (!db){
      alert("Les commentaires ne sont pas encore activés sur ce site.");
      return;
    }
    const zone = form.dataset.zone;
    const label = form.dataset.label;
    const name = form.querySelector(".cm-name").value.trim() || "Anonyme";
    const text = form.querySelector(".cm-text").value.trim();
    if (!text) return;

    db.collection("avis_golden").add({
      zone: zone,
      zoneLabel: label,
      name: name,
      text: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(){
      form.reset();
    }).catch(function(err){
      alert("Impossible de publier le commentaire pour le moment.");
      console.error(err);
    });
  });
});
