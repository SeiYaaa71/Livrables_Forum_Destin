// ============================================================================
// page-thread.js — Page d'un fil : message d'origine, posts, réponses, votes
// ============================================================================

import { store } from "./store.js";
import { $, el, esc, initials, fromNow, params, mountHeader, mountFooter, toast } from "./ui.js";

const id = Number(params().id);

document.addEventListener("DOMContentLoaded", async () => {
  await mountHeader();
  mountFooter();
  if (!id) { fail("Sujet introuvable."); return; }
  await load();
});

async function load() {
  const root = $("#thread");
  root.innerHTML = `<div class="post card skeleton"><div></div><div><div class="sk-line" style="width:60%"></div><div class="sk-line"></div><div class="sk-line" style="width:80%"></div></div></div>`;
  let topic;
  try { topic = await store.topic(id); }
  catch (e) { return fail(e.message); }
  if (!topic) return fail("Ce sujet n'existe pas (ou plus).");

  renderHead(topic);
  const posts = topic.posts ?? (await store.posts(id));
  root.innerHTML = "";

  // Message d'origine (premier message qui lance le topic)
  root.appendChild(postCard({
    id: `op-${topic.id}`, kind: "topic",
    title: topic.title, author: topic.author,
    text: topic.body || "(pas de description)", createdAt: topic.createdAt,
    votes: topic.votes ?? 0,
  }, true));

  if (!posts.length) {
    root.appendChild(el("div", { class: "empty" }, "<p>Aucune réponse pour l'instant. Lancez la discussion ci-dessous.</p>"));
  }
  for (const p of posts) root.appendChild(postCard(p, false));

  if (!topic.locked) root.appendChild(replyBox(id));
  else root.appendChild(el("div", { class: "empty card" }, "<p>🔒 Ce fil est verrouillé. Les nouvelles réponses sont désactivées.</p>"));
}

function renderHead(t) {
  $("#crumbs").innerHTML = `<a href="index.html">Forum</a> › ${(t.tags || []).map((x) => `<a href="index.html?tag=${encodeURIComponent(x)}">${esc(x)}</a>`).join(" · ") || "sujet"}`;
  $("#title").innerHTML = `${t.locked ? `<span class="pill pill--locked">verrouillé</span>` : ""}${esc(t.title)}`;
  document.title = `${t.title} — Agora`;
}

function postCard(p, isOp) {
  const card = el("article", { class: `post card ${isOp ? "post--op" : ""}` });
  const voteKind = isOp ? "posts" : "posts";
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
        ${isOp ? "" : `<button data-reply="${p.id}">Répondre</button>`}
        <button data-share>Partager</button>
      </div>
      <div class="responses" data-resp="${p.id}"></div>
    </div>`;

  // Votes
  const score = card.querySelector(".score");
  card.querySelectorAll(".votebtn").forEach((b) =>
    b.addEventListener("click", async () => {
      const v = Number(b.dataset.v);
      const pressed = b.getAttribute("aria-pressed") === "true";
      card.querySelectorAll(".votebtn").forEach((x) => x.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", String(!pressed));
      const numId = typeof p.id === "number" ? p.id : Number(String(p.id).replace(/\D/g, ""));
      try {
        await store.vote(voteKind, numId, pressed ? -v : v);
        score.textContent = Number(score.textContent) + (pressed ? -v : v);
      } catch (e) { toast(e.message, "err"); }
    })
  );

  // Partager
  card.querySelector("[data-share]").addEventListener("click", () => {
    navigator.clipboard?.writeText(location.href).then(() => toast("Lien copié."));
  });

  // Réponses imbriquées (uniquement pour les posts, pas l'OP)
  if (!isOp && typeof p.id === "number") loadResponses(p.id, card.querySelector(`[data-resp="${p.id}"]`));

  // Bouton répondre → ouvre une mini-zone
  const reply = card.querySelector("[data-reply]");
  reply?.addEventListener("click", () => toggleInlineReply(p.id, card.querySelector(`[data-resp="${p.id}"]`)));

  return card;
}

async function loadResponses(postId, host) {
  let list = [];
  try { list = await store.responses(postId); } catch {}
  host.innerHTML = list.map((r) => `
    <div class="response">
      <span class="ava">${initials(r.author || "?")}</span>
      <div>
        <div class="meta"><b>${esc(r.author || "—")}</b> · ${fromNow(r.createdAt)}</div>
        <div class="post__text">${esc(r.text)}</div>
      </div>
    </div>`).join("");
}

function toggleInlineReply(postId, host) {
  if (host.querySelector(".replybox")) { host.querySelector(".replybox").remove(); return; }
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
    } catch (e) { toast(e.message, "err"); }
  });
  host.appendChild(box);
}

function replyBox(topicId) {
  const box = el("section", { class: "post card" });
  box.innerHTML = `
    <div></div>
    <div class="replybox">
      <h3 style="margin:0">Répondre au sujet</h3>
      <input class="field" id="newTitle" placeholder="Titre de votre message" />
      <textarea class="field" id="newText" placeholder="Écrivez votre message… (les images / gif via URL sont supportés côté back)"></textarea>
      <div class="row"><button class="btn" id="sendPost">Publier le message</button></div>
    </div>`;
  box.querySelector("#sendPost").addEventListener("click", async () => {
    const title = box.querySelector("#newTitle").value.trim();
    const text = box.querySelector("#newText").value.trim();
    if (!text) { toast("Le message ne peut pas être vide.", "err"); return; }
    const me = await store.me();
    if (!me) { toast("Connecte-toi pour publier.", "err"); setTimeout(() => location.href = "login.html", 600); return; }
    try {
      await store.createPost(topicId, title || "(sans titre)", text);
      toast("Message publié.");
      load();
    } catch (e) { toast(e.message, "err"); }
  });
  return box;
}

function fail(msg) {
  $("#thread").innerHTML = `<div class="empty card"><h3>Oups</h3><p>${esc(msg)}</p><a class="btn" href="index.html">Retour au forum</a></div>`;
}
