// page-thread.js — l'affichage d'un fil de discussion : le message qui ouvre
// le sujet, les réponses (posts), les commentaires sous chaque post, et les
// votes. On reconstruit tout en JS à partir de ce que renvoie le store.

import { store } from "./store.js";
import { $, el, esc, initials, fromNow, params, mountHeader, mountFooter, toast } from "./ui.js";

const topicId = Number(params().id);

document.addEventListener("DOMContentLoaded", async () => {
  await mountHeader();
  mountFooter();
  if (!topicId) {
    fail("Aucun sujet demandé.");
    return;
  }
  load();
});

async function load() {
  const root = $("#thread");
  root.innerHTML = skeletonPost();

  let topic;
  try {
    topic = await store.topic(topicId);
  } catch (e) {
    fail(e.message);
    return;
  }
  if (!topic) {
    fail("Ce sujet n'existe pas (ou plus).");
    return;
  }

  fillHead(topic);

  const posts = topic.posts ?? (await store.posts(topicId));
  root.innerHTML = "";

  // Le message d'origine en premier. Son id est préfixé pour qu'on sache
  // qu'il vient du topic et pas de la table post.
  root.appendChild(renderCard({
    id: `op-${topic.id}`,
    title: topic.title,
    author: topic.author,
    text: topic.body || "(pas de description)",
    createdAt: topic.createdAt,
    votes: topic.votes ?? 0,
  }, true));

  if (posts.length === 0) {
    root.appendChild(el("div", { class: "empty" },
      "<p>Pas encore de réponse. Lancez la discussion plus bas.</p>"));
  } else {
    posts.forEach((p) => root.appendChild(renderCard(p, false)));
  }

  // On ne propose le formulaire que si le fil n'est pas verrouillé.
  if (topic.locked) {
    root.appendChild(el("div", { class: "empty card" },
      "<p>🔒 Ce fil est verrouillé : on ne peut plus y répondre.</p>"));
  } else {
    root.appendChild(replyForm());
  }
}

function fillHead(t) {
  const tagLinks = (t.tags || [])
    .map((x) => `<a href="index.html?tag=${encodeURIComponent(x)}">${esc(x)}</a>`)
    .join(" · ");
  $("#crumbs").innerHTML = `<a href="index.html">Forum</a> › ${tagLinks || "sujet"}`;
  $("#title").innerHTML = (t.locked ? `<span class="pill pill--locked">verrouillé</span>` : "") + esc(t.title);
  document.title = `${t.title} — Agora`;
}

// Construit une carte de message. isOp = true pour le message d'origine, qui
// a un style à part et pas de bouton "Répondre".
function renderCard(p, isOp) {
  const card = el("article", { class: "post card" + (isOp ? " post--op" : "") });
  card.innerHTML = `
    <div class="votecol">
      <button class="votebtn" data-v="1" title="J'aime">▲</button>
      <span class="score">${p.votes ?? 0}</span>
      <button class="votebtn" data-v="-1" title="Je n'aime pas">▼</button>
    </div>
    <div>
      <div class="post__head">
        <span class="ava">${initials(p.author || "?")}</span>
        <span class="who">${esc(p.author || "—")}</span>
        ${isOp ? `<span class="pill pill--demo">auteur du sujet</span>` : ""}
        <span class="meta">· ${fromNow(p.createdAt)}</span>
      </div>
      ${p.title ? `<h3 class="post__title">${esc(p.title)}</h3>` : ""}
      <div class="post__text">${esc(p.text || "")}</div>
      <div class="post__actions">
        ${isOp ? "" : `<button data-reply>Répondre</button>`}
        <button data-share>Partager</button>
      </div>
      <div class="responses"></div>
    </div>`;

  wireVotes(card, p, isOp);

  card.querySelector("[data-share]").addEventListener("click", () => {
    navigator.clipboard?.writeText(location.href).then(() => toast("Lien copié."));
  });

  // Les commentaires n'existent que pour les vrais posts (pas l'OP).
  const respHost = card.querySelector(".responses");
  if (!isOp && typeof p.id === "number") {
    loadResponses(p.id, respHost);
    card.querySelector("[data-reply]").addEventListener("click", () =>
      toggleReply(p.id, respHost)
    );
  }

  return card;
}

// Branche les deux flèches de vote d'une carte.
function wireVotes(card, p, isOp) {
  const score = card.querySelector(".score");
  const buttons = card.querySelectorAll(".votebtn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = Number(btn.dataset.v);
      const alreadyOn = btn.getAttribute("aria-pressed") === "true";

      // un seul des deux boutons actif à la fois
      buttons.forEach((b) => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", String(!alreadyOn));

      // l'OP n'a pas d'id numérique propre (il vient du topic), on l'extrait
      const numId = typeof p.id === "number" ? p.id : Number(String(p.id).replace(/\D/g, ""));
      const delta = alreadyOn ? -value : value;

      try {
        await store.vote(isOp ? "posts" : "posts", numId, delta);
        score.textContent = Number(score.textContent) + delta;
      } catch (e) {
        toast(e.message, "err");
      }
    });
  });
}

async function loadResponses(postId, host) {
  let list = [];
  try { list = await store.responses(postId); } catch { /* on laisse vide */ }

  host.innerHTML = list.map((r) => `
    <div class="response">
      <span class="ava">${initials(r.author || "?")}</span>
      <div>
        <div class="meta"><b>${esc(r.author || "—")}</b> · ${fromNow(r.createdAt)}</div>
        <div class="post__text">${esc(r.text)}</div>
      </div>
    </div>`).join("");
}

// Affiche/masque le petit champ de réponse sous un post.
function toggleReply(postId, host) {
  const existing = host.querySelector(".replybox");
  if (existing) {
    existing.remove();
    return;
  }

  const box = el("div", { class: "replybox" });
  box.innerHTML = `
    <textarea class="field" placeholder="Votre réponse…" rows="3"></textarea>
    <div class="row"><button class="btn btn--sm">Publier la réponse</button></div>`;

  box.querySelector("button").addEventListener("click", async () => {
    const text = box.querySelector("textarea").value.trim();
    if (!text) return;
    try {
      await store.createResponse(postId, text);
      box.remove();
      loadResponses(postId, host);
      toast("Réponse publiée.");
    } catch (e) {
      toast(e.message, "err");
    }
  });

  host.appendChild(box);
}

// Le gros formulaire en bas du fil pour répondre au sujet lui-même.
function replyForm() {
  const box = el("section", { class: "post card" });
  box.innerHTML = `
    <div></div>
    <div class="replybox">
      <h3 style="margin:0">Répondre au sujet</h3>
      <input class="field" id="newTitle" placeholder="Titre de votre message" />
      <textarea class="field" id="newText" placeholder="Écrivez votre message…"></textarea>
      <div class="row"><button class="btn" id="sendPost">Publier le message</button></div>
    </div>`;

  box.querySelector("#sendPost").addEventListener("click", async () => {
    const title = box.querySelector("#newTitle").value.trim();
    const text = box.querySelector("#newText").value.trim();

    if (!text) {
      toast("Le message ne peut pas être vide.", "err");
      return;
    }

    // faut être connecté pour poster
    const me = await store.me();
    if (!me) {
      toast("Connecte-toi pour publier.", "err");
      setTimeout(() => (location.href = "login.html"), 600);
      return;
    }

    try {
      await store.createPost(topicId, title || "(sans titre)", text);
      toast("Message publié.");
      load(); // on recharge le fil pour voir le nouveau message
    } catch (e) {
      toast(e.message, "err");
    }
  });

  return box;
}

function skeletonPost() {
  return `
    <div class="post card skeleton">
      <div></div>
      <div>
        <div class="sk-line" style="width:60%"></div>
        <div class="sk-line"></div>
        <div class="sk-line" style="width:80%"></div>
      </div>
    </div>`;
}

function fail(msg) {
  $("#thread").innerHTML = `
    <div class="empty card">
      <h3>Oups</h3>
      <p>${esc(msg)}</p>
      <a class="btn" href="index.html">Retour au forum</a>
    </div>`;
}
