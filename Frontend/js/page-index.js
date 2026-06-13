// ============================================================================
// page-index.js — Liste des sujets : filtres, tags, tri, pagination
// ============================================================================

import { store } from "./store.js";
import { $, el, esc, initials, fromNow, params, mountHeader, mountFooter, toast } from "./ui.js";

const PER_PAGE = 8;
let state = { q: params().q || "", tag: params().tag || "", sort: "recent", page: 1, all: [] };

document.addEventListener("DOMContentLoaded", async () => {
  await mountHeader();
  mountFooter();
  await renderTags();
  bindFilters();
  await load();
});

async function load() {
  const list = $("#topics");
  list.innerHTML = skeleton(4);
  try {
    state.all = await store.topics({ q: state.q, tag: state.tag, sort: state.sort });
  } catch (e) {
    toast(e.message || "Échec du chargement.", "err");
    state.all = [];
  }
  render();
}

function render() {
  const total = state.all.length;
  $("#count").textContent = total;
  const start = (state.page - 1) * PER_PAGE;
  const page = state.all.slice(start, start + PER_PAGE);
  const list = $("#topics");
  list.innerHTML = "";

  if (!page.length) {
    list.innerHTML = `<li class="empty card"><h3>Aucun sujet</h3>
      <p>${state.q || state.tag ? "Aucun résultat pour ce filtre." : "Soyez le premier à lancer une discussion."}</p>
      <a class="btn" href="new.html">Ouvrir un sujet</a></li>`;
    renderPager(total);
    return;
  }

  for (const t of page) list.appendChild(topicRow(t));
  renderPager(total);
}

function topicRow(t) {
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
      <div class="topic__tags">${(t.tags || []).map((tg) => `<a class="tag" href="index.html?tag=${encodeURIComponent(tg)}">${esc(tg)}</a>`).join("")}</div>
    </div>
    <div class="topic__stats">
      <span><b>${t.replies ?? 0}</b> réponses</span>
      <span>${t.views ?? 0} vues</span>
    </div>`;
  return li;
}

async function renderTags() {
  const host = $("#tagFilters");
  if (!host) return;
  let tags = [];
  try { tags = await store.tags(); } catch {}
  host.innerHTML = tags
    .map((tg) => `<button class="tag" data-tag="${esc(tg)}" aria-pressed="${state.tag === tg}">${esc(tg)}</button>`)
    .join("");
  host.querySelectorAll("[data-tag]").forEach((b) =>
    b.addEventListener("click", () => {
      state.tag = state.tag === b.dataset.tag ? "" : b.dataset.tag;
      state.page = 1;
      host.querySelectorAll("[data-tag]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.tag === state.tag));
      load();
    })
  );
}

function bindFilters() {
  $("#sortSeg")?.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      state.sort = b.dataset.sort;
      state.page = 1;
      $("#sortSeg").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      load();
    })
  );
}

function renderPager(total) {
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const host = $("#pager");
  if (pages <= 1) { host.innerHTML = ""; return; }
  let html = `<button ${state.page === 1 ? "disabled" : ""} data-go="${state.page - 1}">‹</button>`;
  for (let i = 1; i <= pages; i++)
    html += `<button aria-current="${i === state.page}" data-go="${i}">${i}</button>`;
  html += `<button ${state.page === pages ? "disabled" : ""} data-go="${state.page + 1}">›</button>`;
  host.innerHTML = html;
  host.querySelectorAll("[data-go]").forEach((b) =>
    b.addEventListener("click", () => {
      state.page = Number(b.dataset.go);
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    })
  );
}

function skeleton(n) {
  return Array.from({ length: n }).map(() =>
    `<li class="topic card skeleton"><div class="spine"><div class="sk-line" style="width:30px"></div></div>
     <div class="topic__body"><div class="sk-line" style="width:70%"></div><div class="sk-line" style="width:40%"></div></div>
     <div></div></li>`
  ).join("");
}
