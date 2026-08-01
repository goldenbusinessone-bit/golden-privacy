/* ============================================================
   TRADUCTIONS — Agence Golden
   FR = source principale (fiable)
   EN = traduction fiable
   SW = swahili, meilleur effort
   Le lingala n'est pas inclus par défaut : le niveau de fiabilité
   de cette IA en lingala est insuffisant pour un site public.
   Si vous l'ajoutez, faites relire par un locuteur natif avant publication.
   ============================================================ */

const GOLDEN_I18N = {
  fr: {
    nav_home: "Accueil",
    nav_services: "Nos Services",
    nav_order: "Commande",
    nav_privacy: "Confidentialité",
    nav_terms: "Conditions",
    nav_zone_a: "Événementiel",
    nav_zone_b: "Promotion Commerciale",
    nav_zone_c: "Média & Digital",
    nav_zone_d: "Services Techniques",
    footer_tagline: "Confiance · Professionnalisme · Opportunités",
    footer_rights: "Tous droits réservés",
    btn_quote: "Demander un devis",
    btn_comments: "💬 Commentaires sur cette zone",
    btn_send: "Publier",
    btn_order: "Commander",
    btn_add_cart: "Ajouter au panier",
    cart_title: "Votre panier",
    cart_empty: "Votre panier est vide.",
    cart_total: "Total",
    coming_soon_title: "Contenu à venir",
    coming_soon_text: "Cette page est en cours de construction. Revenez bientôt pour découvrir cet espace.",
  },
  en: {
    nav_home: "Home",
    nav_services: "Our Services",
    nav_order: "Order",
    nav_privacy: "Privacy",
    nav_terms: "Terms",
    nav_zone_a: "Events",
    nav_zone_b: "Business Promotion",
    nav_zone_c: "Media & Digital",
    nav_zone_d: "Technical Services",
    footer_tagline: "Trust · Professionalism · Opportunities",
    footer_rights: "All rights reserved",
    btn_quote: "Request a quote",
    btn_comments: "💬 Comments on this zone",
    btn_send: "Post",
    btn_order: "Order",
    btn_add_cart: "Add to cart",
    cart_title: "Your cart",
    cart_empty: "Your cart is empty.",
    cart_total: "Total",
    coming_soon_title: "Coming soon",
    coming_soon_text: "This page is under construction. Check back soon to explore this space.",
  },
  sw: {
    nav_home: "Nyumbani",
    nav_services: "Huduma Zetu",
    nav_order: "Agiza",
    nav_privacy: "Faragha",
    nav_terms: "Masharti",
    nav_zone_a: "Matukio",
    nav_zone_b: "Uendelezaji wa Biashara",
    nav_zone_c: "Vyombo vya Habari na Dijitali",
    nav_zone_d: "Huduma za Kiufundi",
    footer_tagline: "Uaminifu · Utaalamu · Fursa",
    footer_rights: "Haki zote zimehifadhiwa",
    btn_quote: "Omba bei",
    btn_comments: "💬 Maoni kuhusu eneo hili",
    btn_send: "Tuma",
    btn_order: "Agiza",
    btn_add_cart: "Ongeza kwenye kikapu",
    cart_title: "Kikapu chako",
    cart_empty: "Kikapu chako hakina kitu.",
    cart_total: "Jumla",
    coming_soon_title: "Inakuja hivi karibuni",
    coming_soon_text: "Ukurasa huu bado unajengwa. Rudi hivi karibuni kuona nafasi hii.",
  }
};

/* Applique la langue courante à tous les éléments [data-i18n] de la page */
function applyGoldenLanguage(lang){
  const dict = GOLDEN_I18N[lang] || GOLDEN_I18N.fr;
  document.querySelectorAll("[data-i18n]").forEach(function(el){
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });
  document.documentElement.setAttribute("lang", lang);
  document.querySelectorAll(".lang-btn").forEach(function(btn){
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });
  localStorage.setItem("golden_lang", lang);
}

/* Détermine la langue par défaut : choix manuel sauvegardé > pays détecté par IP > français */
async function initGoldenLanguage(){
  const saved = localStorage.getItem("golden_lang");
  if (saved){
    applyGoldenLanguage(saved);
    return;
  }
  let lang = "fr";
  try{
    const res = await fetch("https://ipwho.is/");
    const data = await res.json();
    const country = (data && data.country_code) || "";
    const englishCountries = ["US","GB","CA","AU","NG","GH","KE","UG","ZA","IE","NZ","ZM","TZ"];
    if (englishCountries.includes(country)) lang = "en";
    else lang = "fr";
  } catch(e){
    lang = "fr"; // repli silencieux si la détection échoue
  }
  applyGoldenLanguage(lang);
}

document.addEventListener("DOMContentLoaded", function(){
  initGoldenLanguage();
  document.addEventListener("click", function(e){
    if (e.target.classList && e.target.classList.contains("lang-btn")){
      applyGoldenLanguage(e.target.dataset.lang);
    }
  });
});
