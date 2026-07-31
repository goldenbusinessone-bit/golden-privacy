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
if (firebaseConfig.apiKey !== "VOTRE_API_KEY_ICI") {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
} else {
  console.warn("Configuration Firebase manquante : les commentaires ne fonctionneront pas tant que firebaseConfig n'est pas complété.");
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
