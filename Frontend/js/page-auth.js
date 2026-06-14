// page-auth.js — sert pour trois pages d'un coup : connexion, inscription et
// création de sujet. On regarde quel formulaire est présent dans la page et
// on branche le bon comportement. Ça évite trois petits fichiers quasi vides.

import { store } from "./store.js";
import { $, esc, params, mountHeader, mountFooter, toast } from "./ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  await mountHeader();
  mountFooter();

  if ($("#loginForm"))    setupLogin();
  if ($("#registerForm")) setupRegister();
  if ($("#newForm"))      setupNewTopic();
});

function setupLogin() {
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const email = data.get("email").trim();
    const password = data.get("password");

    if (!email || !password) {
      toast("Email et mot de passe requis.", "err");
      return;
    }

    try {
      await store.login(email, password);
      toast("Connecté.");
      // si on venait d'une page protégée, on y retourne
      const next = params().next || "index.html";
      setTimeout(() => (location.href = next), 400);
    } catch (err) {
      toast(err.message || "Connexion refusée.", "err");
    }
  });
}

function setupRegister() {
  $("#registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const username = data.get("username").trim();
    const email = data.get("email").trim();
    const password = data.get("password");
    const confirm = data.get("confirm");

    // validations basiques côté client (le back revalide de son côté)
    if (!username || !email || !password) {
      toast("Tous les champs sont requis.", "err");
      return;
    }
    if (password.length < 6) {
      toast("Le mot de passe doit faire au moins 6 caractères.", "err");
      return;
    }
    if (password !== confirm) {
      toast("Les deux mots de passe ne correspondent pas.", "err");
      return;
    }

    try {
      await store.register(username, email, password);
      toast("Compte créé, bienvenue !");
      setTimeout(() => (location.href = "index.html"), 500);
    } catch (err) {
      toast(err.message || "Inscription impossible.", "err");
    }
  });
}

async function setupNewTopic() {
  // page réservée aux membres
  const me = await store.me();
  if (!me) {
    toast("Connecte-toi pour ouvrir un sujet.", "err");
    setTimeout(() => (location.href = "login.html?next=new.html"), 600);
    return;
  }

  // Les tags qu'on peut cocher. On garde les choisis dans un Set.
  const picker = $("#tagPicker");
  const chosen = new Set();

  let tags = [];
  try { tags = await store.tags(); } catch { /* tant pis, pas de tags */ }

  picker.innerHTML = tags
    .map((t) => `<button type="button" class="tag" data-tag="${esc(t)}" aria-pressed="false">${esc(t)}</button>`)
    .join("");

  picker.querySelectorAll("[data-tag]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag;
      const on = chosen.has(tag);
      if (on) chosen.delete(tag);
      else chosen.add(tag);
      btn.setAttribute("aria-pressed", String(!on));
    });
  });

  $("#newForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const title = data.get("title").trim();
    const body = data.get("body").trim();

    if (title.length < 5) {
      toast("Le titre doit faire au moins 5 caractères.", "err");
      return;
    }
    if (!body) {
      toast("Le premier message ne peut pas être vide.", "err");
      return;
    }

    try {
      const topic = await store.createTopic(title, body, [...chosen]);
      toast("Sujet créé.");
      setTimeout(() => (location.href = `thread.html?id=${topic.id || ""}`), 400);
    } catch (err) {
      toast(err.message || "Création impossible.", "err");
    }
  });
}
