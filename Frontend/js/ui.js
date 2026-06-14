// ui.js — les petits outils dont toutes les pages se servent :
// raccourcis DOM, échappement, header/footer, toasts, formatage des dates.

import { store } from "./store.js";
import { API_BASE } from "./api.js";

// raccourcis qsa/qs, parce que document.querySelector partout c'est lourd
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Échappe le HTML avant de l'injecter. Indispensable : tout ce qui vient de
// l'utilisateur (titres, messages…) passe par là sinon on est ouvert au XSS.
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function esc(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// Crée un élément avec ses attributs en un appel. Si une "valeur" est une
// fonction et que la clé commence par "on", on la branche en listener.
export function el(tag, attrs = {}, html = "") {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === "class") {
      node.className = val;
    } else if (key.startsWith("on") && typeof val === "function") {
      node.addEventListener(key.slice(2), val);
    } else if (val != null && val !== false) {
      node.setAttribute(key, val);
    }
  }
  if (html) node.innerHTML = html;
  return node;
}

// "Jean Dupont" -> "JD", pour les avatars
export const initials = (name = "?") =>
  name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

// Date relative, version FR simplifiée. On s'arrête au premier palier atteint.
export function fromNow(iso) {
  if (!iso) return "";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "à l'instant";

  const paliers = [
    [31536000, "an", "ans"],
    [2592000,  "mois", "mois"],
    [86400,    "jour", "jours"],
    [3600,     "h", "h"],
    [60,       "min", "min"],
  ];
  for (const [sec, singulier, pluriel] of paliers) {
    const n = Math.floor(seconds / sec);
    if (n >= 1) return `il y a ${n} ${n > 1 ? pluriel : singulier}`;
  }
  return "à l'instant";
}

// Petite notif en bas à droite. kind "err" = rouge.
export function toast(msg, kind = "ok") {
  let host = $("#toasts");
  if (!host) {
    host = el("div", { id: "toasts" });
    document.body.appendChild(host);
  }
  const t = el("div", { class: "toast" + (kind === "err" ? " toast--err" : "") }, esc(msg));
  host.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// Les query params de l'URL courante, en objet
export const params = () => Object.fromEntries(new URLSearchParams(location.search));

// Construit la barre du haut et la colle en haut du body. Le contenu de la nav
// dépend de si on est connecté ou pas.
export async function mountHeader() {
  const me = await store.me();
  const mode = await store.mode();
  const q = params().q || "";

  let nav;
  if (me) {
    nav = `
      <span class="meta">Connecté&nbsp;: <a href="#" data-noop>${esc(me.username)}</a></span>
      <a class="btn btn--coral btn--sm" href="new.html">Nouveau sujet</a>
      <button class="btn btn--ghost btn--sm" id="logoutBtn">Déconnexion</button>`;
  } else {
    nav = `
      <a class="btn btn--ghost btn--sm" href="login.html">Connexion</a>
      <a class="btn btn--sm" href="register.html">Inscription</a>`;
  }

  // bandeau démo seulement quand le back ne répond pas
  const banner = mode === "demo"
    ? `<div class="modebar">Mode <b>démo</b> — back-end hors ligne, les données sont locales et non sauvegardées.</div>`
    : "";

  const header = el("header", { class: "topbar" });
  header.innerHTML = `
    ${banner}
    <div class="wrap topbar__inner">
      <a class="brand" href="index.html">Agora<b>.</b> <small>forum</small></a>
      <form class="topbar__search" role="search" id="searchForm">
        <input class="field" type="search" name="q" value="${esc(q)}"
               placeholder="Rechercher un sujet, un tag…" aria-label="Rechercher" />
      </form>
      <nav class="topbar__nav">${nav}</nav>
    </div>`;
  document.body.prepend(header);

  // recherche -> on renvoie vers l'index avec ?q=
  $("#searchForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = new FormData(e.target).get("q").trim();
    location.href = "index.html" + (v ? `?q=${encodeURIComponent(v)}` : "");
  });

  $("#logoutBtn")?.addEventListener("click", async () => {
    await store.logout();
    toast("À bientôt.");
    setTimeout(() => (location.href = "index.html"), 400);
  });
}

export function mountFooter() {
  const f = el("footer", { class: "site" });
  f.innerHTML = `<div class="wrap">Agora — projet Forum · front statique · API → <code>${API_BASE}</code></div>`;
  document.body.appendChild(f);
}

// À appeler en haut d'une page réservée aux membres. Redirige vers le login
// en gardant la page demandée dans ?next pour y revenir après connexion.
export async function requireAuth() {
  const me = await store.me();
  if (me) return me;

  toast("Connecte-toi pour continuer.", "err");
  const target = location.pathname.split("/").pop() + location.search;
  setTimeout(() => (location.href = `login.html?next=${encodeURIComponent(target)}`), 500);
  return null;
}
