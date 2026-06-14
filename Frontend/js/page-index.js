// page-index.js — la page d'accueil : liste des sujets avec tri, filtre par
// tag, recherche et pagination. L'état de la page tient dans un seul objet.

import { store } from "./store.js";
import { $, el, esc, fromNow, params, mountHeader, mountFooter, toast } from "./ui.js";

const PER_PAGE = 8;

const state = {
  q: params().q || "",      // texte recherché (vient de l'URL)
  tag: params().tag || "",  // tag actif
  sort: "recent",
  page: 1,
  all: [],                  // tous les topics chargés, avant pagination
};

document.addEventListener("DOMContentLoaded", async () => {
  await mountHeader();
  mountFooter();
  await renderTags();
  bindFilters();
  load();
});

// Va chercher les topics selon les filtres courants puis réaffiche.
async function load() {
  $("#topics").innerHTML = skeleton(4);
  try {
    state.all = await store.topics({ q: state.q, tag: state.tag, sort: state.sort });
  } catch (e) {
    toast(e.message || "Impossible de charger les sujets.", "err");
    state.all = [];
  }
  render();
}

function render() {
  $("#count").textContent = state.all.length;

  const start = (state.page - 1) * PER_PAGE;
  const visibles = state.all.slice(start, start + PER_PAGE);
  const list = $("#topics");

  if (visibles.length === 0) {
    const msg = state.q || state.tag
      ? "Aucun résultat pour ce filtre."
      : "Personne n'a encore lancé de discussion.";
    list.innerHTML = `
      <li class="empty card">
        <h3>Aucun sujet</h3>
        <p>${msg}</p>
        <a class="btn" href="new.html">Ouvrir un sujet</a>
      </li>`;
    renderPager();
    return;
  }

  list.innerHTML = "";
  visibles.forEach((t) => list.appendChild(topicRow(t)));
  renderPager();
}

// Une ligne de la liste. Le compteur de votes à gauche, c'est la "colonne
// vertébrale" qui donne le rythme visuel de la page.
function topicRow(t) {
  const tags = (t.tags || [])
    .map((tg) => `<a class="tag" href="index.html?tag=${encodeURIComponent(tg)}">${esc(tg)}</a>`)
    .join("");

  const li = el("li", { class: "topic card" });
  li.innerHTML = `
    <div class="spine">
      <span class="n">${t.votes ?? 0}</span>
      <span class="l">votes</span>
    </div>
    <div class="topic__body">
      <h3>
        ${t.locked ? `<span class="pill pill--locked">verrouillé</span> ` : ""}
        <a href="thread.html?id=${t.id}">${esc(t.title)}</a>
      </h3>
      <div class="meta">par <a href="#">${esc(t.author || "—")}</a> · ${fromNow(t.createdAt)}</div>
      <div class="topic__tags">${tags}</div>
    </div>
    <div class="topic__stats">
      <span><b>${t.replies ?? 0}</b> réponses</span>
      <span>${t.views ?? 0} vues</span>
    </div>`;
  return li;
}

// Boutons de tags cliquables. Re-cliquer sur un tag actif le désactive.
async function renderTags() {
  const host = $("#tagFilters");
  if (!host) return;

  let tags = [];
  try { tags = await store.tags(); } catch { /* pas grave, on n'affiche rien */ }

  host.innerHTML = tags
    .map((tg) => `<button class="tag" data-tag="${esc(tg)}" aria-pressed="${state.tag === tg}">${esc(tg)}</button>`)
    .join("");

  host.querySelectorAll("[data-tag]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tag = state.tag === btn.dataset.tag ? "" : btn.dataset.tag;
      state.page = 1;
      host.querySelectorAll("[data-tag]").forEach((b) =>
        b.setAttribute("aria-pressed", b.dataset.tag === state.tag)
      );
      load();
    });
  });
}

// Les trois boutons de tri (récents / actifs / votés)
function bindFilters() {
  const seg = $("#sortSeg");
  if (!seg) return;

  seg.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.sort = btn.dataset.sort;
      state.page = 1;
      seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === btn));
      load();
    });
  });
}

function renderPager() {
  const pages = Math.max(1, Math.ceil(state.all.length / PER_PAGE));
  const host = $("#pager");

  if (pages <= 1) { host.innerHTML = ""; return; }

  let html = `<button ${state.page === 1 ? "disabled" : ""} data-go="${state.page - 1}">‹</button>`;
  for (let i = 1; i <= pages; i++) {
    html += `<button aria-current="${i === state.page}" data-go="${i}">${i}</button>`;
  }
  html += `<button ${state.page === pages ? "disabled" : ""} data-go="${state.page + 1}">›</button>`;
  host.innerHTML = html;

  host.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.page = Number(btn.dataset.go);
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

// Faux contenu gris le temps que les données arrivent
function skeleton(n) {
  const row = `
    <li class="topic card skeleton">
      <div class="spine"><div class="sk-line" style="width:30px"></div></div>
      <div class="topic__body">
        <div class="sk-line" style="width:70%"></div>
        <div class="sk-line" style="width:40%"></div>
      </div>
      <div></div>
    </li>`;
  return row.repeat(n);
}
