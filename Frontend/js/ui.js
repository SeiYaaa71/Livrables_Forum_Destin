// ============================================================================
// ui.js — Helpers partagés (DOM, header, session, toasts, formats)
// ============================================================================

import { store } from "./store.js";

/* ---- Sélecteurs courts ---- */
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---- Échappement HTML (anti-XSS pour le contenu utilisateur) ---- */
export function esc(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

/* ---- Création d'élément ---- */
export function el(tag, attrs = {}, html = "") {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  if (html) node.innerHTML = html;
  return node;
}

/* ---- Initiales pour avatar ---- */
export const initials = (name = "?") =>
  name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/* ---- Dates relatives en français ---- */
export function fromNow(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - +new Date(iso)) / 1000);
  const u = [[31536000, "an"], [2592000, "mois"], [86400, "j"], [3600, "h"], [60, "min"], [1, "s"]];
  for (const [sec, label] of u) {
    const n = Math.floor(s / sec);
    if (n >= 1) return label === "mois" ? `il y a ${n} mois` : `il y a ${n} ${label}${n > 1 && !["mois", "min"].includes(label) ? "" : ""}`;
  }
  return "à l'instant";
}

/* ---- Toasts ---- */
export function toast(msg, kind = "ok") {
  let host = $("#toasts");
  if (!host) { host = el("div", { id: "toasts" }); document.body.appendChild(host); }
  const t = el("div", { class: `toast ${kind === "err" ? "toast--err" : ""}` }, esc(msg));
  host.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* ---- Paramètres d'URL ---- */
export const params = () => Object.fromEntries(new URLSearchParams(location.search));

/* ---- En-tête : monte la barre du haut + état de session ---- */
export async function mountHeader() {
  const me = await store.me();
  const mode = await store.mode();
  const q = params().q || "";

  const nav = me
    ? `<span class="meta">Connecté&nbsp;: <a href="#" data-noop>${esc(me.username)}</a></span>
       <a class="btn btn--coral btn--sm" href="new.html">Nouveau sujet</a>
       <button class="btn btn--ghost btn--sm" id="logoutBtn">Déconnexion</button>`
    : `<a class="btn btn--ghost btn--sm" href="login.html">Connexion</a>
       <a class="btn btn--sm" href="register.html">Inscription</a>`;

  const header = el("header", { class: "topbar" });
  header.innerHTML = `
    ${mode === "demo" ? `<div class="modebar">Mode <b>démo</b> — back-end hors ligne. Les données sont locales et non persistées.</div>` : ""}
    <div class="wrap topbar__inner">
      <a class="brand" href="index.html">Agora<b>.</b> <small>forum</small></a>
      <form class="topbar__search" role="search" id="searchForm">
        <input class="field" type="search" name="q" value="${esc(q)}" placeholder="Rechercher un sujet, un tag…" aria-label="Rechercher" />
      </form>
      <nav class="topbar__nav">${nav}</nav>
    </div>`;

  document.body.prepend(header);

  $("#searchForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = new FormData(e.target).get("q").trim();
    location.href = `index.html${v ? `?q=${encodeURIComponent(v)}` : ""}`;
  });

  $("#logoutBtn")?.addEventListener("click", async () => {
    await store.logout();
    toast("À bientôt.");
    setTimeout(() => (location.href = "index.html"), 400);
  });
}

/* ---- Pied de page ---- */
export function mountFooter() {
  const f = el("footer", { class: "site" });
  f.innerHTML = `<div class="wrap">Agora — projet Forum · front statique · API → <code>${store === store ? "http://localhost:3000" : ""}</code></div>`;
  document.body.appendChild(f);
}

/* ---- Garde : exige une session, sinon redirige ---- */
export async function requireAuth() {
  const me = await store.me();
  if (!me) {
    toast("Connecte-toi pour continuer.", "err");
    setTimeout(() => (location.href = `login.html?next=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}`), 500);
    return null;
  }
  return me;
}
