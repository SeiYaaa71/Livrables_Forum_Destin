// ============================================================================
// store.js — État local + données de démo
// ----------------------------------------------------------------------------
// Le back-end fourni est encore partiel (seule la route "/" existe). Pour que
// le front soit utilisable immédiatement, ce module tente l'API réelle et,
// si le serveur est injoignable, bascule sur un jeu de données de démo en
// mémoire. Tout est conçu pour qu'un simple échange (api réel <-> demo) suffise
// une fois le back terminé : les signatures sont identiques à celles d'api.js.
// ============================================================================

import { api } from "./api.js";

const now = Date.now();
const ago = (h) => new Date(now - h * 3600_000).toISOString();

// ---- Données de démonstration (miroir du schéma back) ----------------------
const demo = {
  user: null, // null = visiteur (lecture seule)
  tags: ["général", "go", "sql", "modération", "annonces", "entraide"],
  topics: [
    {
      id: 1, title: "Bienvenue sur le forum — lisez avant de poster",
      author: "destin", tags: ["annonces"], locked: true,
      createdAt: ago(72), replies: 14, votes: 41, views: 902,
      body: "Présentez-vous, restez courtois, et utilisez la recherche avant d'ouvrir un sujet.",
    },
    {
      id: 2, title: "Structurer les routes du back Go proprement",
      author: "mara", tags: ["go", "entraide"], locked: false,
      createdAt: ago(6), replies: 8, votes: 23, views: 311,
      body: "Je galère à organiser routeur.go. Vous séparez par ressource ou par verbe ?",
    },
    {
      id: 3, title: "Schéma SQL : faut-il une table response auto-référencée ?",
      author: "kenji", tags: ["sql"], locked: false,
      createdAt: ago(20), replies: 5, votes: 17, views: 188,
      body: "Pour les réponses imbriquées, ID_Rep qui pointe vers response.id, ça vous semble sain ?",
    },
    {
      id: 4, title: "Règles de modération : flood, troll, hors-sujet",
      author: "destin", tags: ["modération"], locked: false,
      createdAt: ago(40), replies: 11, votes: 30, views: 540,
    },
  ],
  posts: {
    2: [
      { id: 21, topicId: 2, title: "Ma première approche", author: "mara", text: "Je groupe tout dans un seul ServeMux, ça devient vite illisible.", createdAt: ago(6), votes: 4 },
      { id: 22, topicId: 2, title: "Par ressource", author: "leo", text: "Un fichier par ressource (topics, posts, users) et tu montes tout dans New(). Beaucoup plus clair.", createdAt: ago(5), votes: 12 },
    ],
  },
  responses: {
    22: [
      { id: 221, postId: 22, author: "mara", text: "Merci, je teste ça ce soir.", createdAt: ago(4), votes: 2 },
    ],
  },
};

// ---- Détection de disponibilité du back ------------------------------------
let liveBackend = null; // null = inconnu, true/false ensuite
async function backendAlive() {
  if (liveBackend !== null) return liveBackend;
  try {
    await api.listTopics();
    liveBackend = true;
  } catch {
    liveBackend = false;
  }
  return liveBackend;
}

// ---- Façade : essaie l'API, sinon démo -------------------------------------
const store = {
  async mode() {
    return (await backendAlive()) ? "live" : "demo";
  },

  async me() {
    if (await backendAlive()) { try { return await api.me(); } catch { return null; } }
    return demo.user;
  },

  async login(email, password) {
    if (await backendAlive()) return api.login(email, password);
    demo.user = { username: email.split("@")[0] || "membre", role: "user" };
    return demo.user;
  },

  async register(u, e, p) {
    if (await backendAlive()) return api.register(u, e, p);
    demo.user = { username: u, role: "user" };
    return demo.user;
  },

  async logout() {
    if (await backendAlive()) { try { await api.logout(); } catch {} }
    demo.user = null;
  },

  async tags() {
    if (await backendAlive()) { try { return await api.listTags(); } catch {} }
    return demo.tags;
  },

  async topics({ q, tag, sort } = {}) {
    if (await backendAlive()) { try { return await api.listTopics({ q, tag, sort }); } catch {} }
    let list = [...demo.topics];
    if (q) list = list.filter((t) => (t.title + (t.body || "")).toLowerCase().includes(q.toLowerCase()));
    if (tag) list = list.filter((t) => t.tags?.includes(tag));
    if (sort === "votes") list.sort((a, b) => b.votes - a.votes);
    else if (sort === "active") list.sort((a, b) => b.replies - a.replies);
    else list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return list;
  },

  async topic(id) {
    id = Number(id);
    if (await backendAlive()) { try { return await api.getTopic(id); } catch {} }
    const t = demo.topics.find((x) => x.id === id);
    return t ? { ...t, posts: demo.posts[id] || [] } : null;
  },

  async createTopic(title, body, tags) {
    if (await backendAlive()) return api.createTopic(title, body, tags);
    const id = Math.max(0, ...demo.topics.map((t) => t.id)) + 1;
    const t = { id, title, body, tags, author: demo.user?.username || "moi", locked: false, createdAt: new Date().toISOString(), replies: 0, votes: 0, views: 0 };
    demo.topics.unshift(t);
    demo.posts[id] = [];
    return t;
  },

  async posts(topicId) {
    topicId = Number(topicId);
    if (await backendAlive()) { try { return await api.listPosts(topicId); } catch {} }
    return demo.posts[topicId] || [];
  },

  async createPost(topicId, title, text) {
    topicId = Number(topicId);
    if (await backendAlive()) return api.createPost(topicId, title, text);
    const arr = (demo.posts[topicId] = demo.posts[topicId] || []);
    const id = Math.max(20, ...arr.map((p) => p.id), 20) + 1;
    const p = { id, topicId, title, text, author: demo.user?.username || "moi", createdAt: new Date().toISOString(), votes: 0 };
    arr.push(p);
    const t = demo.topics.find((x) => x.id === topicId);
    if (t) t.replies++;
    return p;
  },

  async responses(postId) {
    postId = Number(postId);
    if (await backendAlive()) { try { return await api.listResponses(postId); } catch {} }
    return demo.responses[postId] || [];
  },

  async createResponse(postId, text, parentId) {
    postId = Number(postId);
    if (await backendAlive()) return api.createResponse(postId, text, parentId);
    const arr = (demo.responses[postId] = demo.responses[postId] || []);
    const id = Math.max(220, ...arr.map((r) => r.id), 220) + 1;
    const r = { id, postId, text, author: demo.user?.username || "moi", createdAt: new Date().toISOString(), votes: 0 };
    arr.push(r);
    return r;
  },

  async vote(kind, id, value) {
    if (await backendAlive()) return api.vote(kind, id, value);
    // démo : applique localement
    const bump = (obj) => { if (obj) obj.votes = (obj.votes || 0) + value; };
    if (kind === "posts") for (const arr of Object.values(demo.posts)) bump(arr.find((p) => p.id === id));
    if (kind === "responses") for (const arr of Object.values(demo.responses)) bump(arr.find((r) => r.id === id));
    return { ok: true };
  },
};

export { store };
