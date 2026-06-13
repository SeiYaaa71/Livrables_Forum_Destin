// ============================================================================
// page-auth.js — Connexion, inscription, et création de sujet
// Un seul fichier, le comportement dépend de l'élément présent dans la page.
// ============================================================================

import { store } from "./store.js";
import { $, esc, params, mountHeader, mountFooter, toast } from "./ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  await mountHeader();
  mountFooter();
  if ($("#loginForm")) bindLogin();
  if ($("#registerForm")) bindRegister();
  if ($("#newForm")) await bindNew();
});

/* ---------- Connexion ---------- */
function bindLogin() {
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const email = f.get("email").trim();
    const password = f.get("password");
    if (!email || !password) return toast("Email et mot de passe requis.", "err");
    try {
      await store.login(email, password);
      toast("Connecté.");
      const next = params().next || "index.html";
      setTimeout(() => (location.href = next), 400);
    } catch (err) { toast(err.message || "Connexion refusée.", "err"); }
  });
}

/* ---------- Inscription ---------- */
function bindRegister() {
  $("#registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const username = f.get("username").trim();
    const email = f.get("email").trim();
    const password = f.get("password");
    const confirm = f.get("confirm");
    if (!username || !email || !password) return toast("Tous les champs sont requis.", "err");
    if (password.length < 6) return toast("Mot de passe : 6 caractères minimum.", "err");
    if (password !== confirm) return toast("Les mots de passe ne correspondent pas.", "err");
    try {
      await store.register(username, email, password);
      toast("Compte créé. Bienvenue !");
      setTimeout(() => (location.href = "index.html"), 500);
    } catch (err) { toast(err.message || "Inscription impossible.", "err"); }
  });
}

/* ---------- Nouveau sujet ---------- */
async function bindNew() {
  const me = await store.me();
  if (!me) {
    toast("Connecte-toi pour ouvrir un sujet.", "err");
    setTimeout(() => (location.href = "login.html?next=new.html"), 600);
    return;
  }

  // tags cliquables
  const picker = $("#tagPicker");
  const chosen = new Set();
  let tags = [];
  try { tags = await store.tags(); } catch {}
  picker.innerHTML = tags.map((t) => `<button type="button" class="tag" data-tag="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join("");
  picker.querySelectorAll("[data-tag]").forEach((b) =>
    b.addEventListener("click", () => {
      const t = b.dataset.tag;
      if (chosen.has(t)) { chosen.delete(t); b.setAttribute("aria-pressed", "false"); }
      else { chosen.add(t); b.setAttribute("aria-pressed", "true"); }
    })
  );

  $("#newForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const title = f.get("title").trim();
    const body = f.get("body").trim();
    if (title.length < 5) return toast("Le titre doit faire au moins 5 caractères.", "err");
    if (!body) return toast("Le premier message ne peut pas être vide.", "err");
    try {
      const t = await store.createTopic(title, body, [...chosen]);
      toast("Sujet créé.");
      setTimeout(() => (location.href = `thread.html?id=${t.id || ""}`), 400);
    } catch (err) { toast(err.message || "Création impossible.", "err"); }
  });
}
