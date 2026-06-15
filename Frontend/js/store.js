// store.js
// Le back fourni n'est pas fini (le routeur n'a que "/"). Du coup ce module
// fait l'intermédiaire : il essaie l'API réelle, et si le serveur ne répond
// pas il retombe sur un jeu de données en mémoire pour qu'on puisse quand
// même cliquer dans l'interface. Les méthodes ont la même tête que celles
// d'api.js, donc quand le back sera prêt il n'y aura quasi rien à changer.

import { api } from "./api.js";

// --- jeu de données de démo ---
// (quelques sujets bidons pour que la page ne soit pas vide en local)
const h = Date.now();
const ago = (heures) => new Date(h - heures * 3600_000).toISOString();

const demo = {
  user: null, // pas connecté au départ = visiteur, lecture seule
  tags: ["général", "go", "sql", "modération", "annonces", "entraide"],
  topics: [
    {
      id: 1, title: "Bienvenue sur le forum — à lire avant de poster",
      author: "destin", tags: ["annonces"], locked: true,
      createdAt: ago(72), replies: 14, votes: 41, views: 902,
      body: "Présentez-vous, restez courtois, et pensez à chercher avant d'ouvrir un sujet.",
    },
    {
      id: 2, title: "Structurer les routes du back Go proprement",
      author: "mara", tags: ["go", "entraide"], locked: false,
      createdAt: ago(6), replies: 8, votes: 23, views: 311,
      body: "Je galère à organiser routeur.go. Vous séparez par ressource ou par verbe ?",
    },
    {
      id: 3, title: "Schéma SQL : une table response auto-référencée, bonne idée ?",
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
  // posts indexés par topicId
  posts: {
    2: [
      { id: 21, topicId: 2, title: "Ma première approche", author: "mara",
        text: "Je groupe tout dans un seul ServeMux, mais ça devient vite illisible.", createdAt: ago(6), votes: 4 },
      { id: 22, topicId: 2, title: "Par ressource", author: "leo",
        text: "Un fichier par ressource (topics, posts, users) et tu montes tout dans New(). C'est beaucoup plus clair.", createdAt: ago(5), votes: 12 },
    ],
  },
  // réponses indexées par postId
  responses: {
    22: [
      { id: 221, postId: 22, author: "mara", text: "Merci, je teste ça ce soir.", createdAt: ago(4), votes: 2 },
    ],
  },
};

// On teste une seule fois si le back répond, puis on garde le résultat.
let backendStatus = null; // null tant qu'on n'a pas testé
async function backendAlive() {
  if (backendStatus === null) {
    try {
      await api.listTopics();
      backendStatus = true;
    } catch {
      backendStatus = false;
    }
  }
  return backendStatus;
}

// Évite de répéter "si le back est là appelle l'API, sinon fais X" dans chaque
// méthode. live() est l'appel réel, fallback() la version démo.
async function liveOrDemo(live, fallback) {
  if (await backendAlive()) {
    try { return await live(); }
    catch { /* on retombe sur la démo si l'appel plante */ }
  }
  return fallback();
}

// petit util pour générer un id au-dessus du max existant
const nextId = (arr, min = 0) => Math.max(min, ...arr.map((x) => x.id)) + 1;

// --- Session côté client ---
// Le back ne gère pas de cookie de session : il renvoie juste l'IdUser au
// login. On garde donc l'utilisateur connecté dans le navigateur. Ça permet
// au front de passer ID_User aux routes qui l'exigent (post, topic, vote…).
const SESSION_KEY = "agora.session.v1";

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}
function saveSession(u) {
  if (u) localStorage.setItem(SESSION_KEY, JSON.stringify(u));
  else localStorage.removeItem(SESSION_KEY);
}

let session = loadSession(); // { id, username } ou null

const store = {
  async mode() {
    return (await backendAlive()) ? "live" : "demo";
  },

  // L'utilisateur courant vient du localStorage en mode live, de demo sinon.
  async me() {
    if (await backendAlive()) return session;
    return demo.user;
  },

  // Renvoie l'id numérique de l'utilisateur connecté (0 si visiteur).
  currentUserId() {
    return session?.id || 0;
  },

  async login(identifier, password) {
    if (await backendAlive()) {
      const res = await api.login(identifier, password);
      // le back renvoie { message, IdUser }
      session = { id: res.IdUser, username: identifier };
      saveSession(session);
      return session;
    }
    demo.user = { username: identifier.split("@")[0] || "membre", role: "user" };
    return demo.user;
  },

  async register(username, email, password) {
    if (await backendAlive()) {
      const res = await api.register(username, email, password);
      // le back renvoie { message, userID } puis on connecte directement
      session = { id: res.userID, username };
      saveSession(session);
      return session;
    }
    demo.user = { username, role: "user" };
    return demo.user;
  },

  async logout() {
    session = null;
    saveSession(null);
    demo.user = null;
  },

  tags() {
    // Le back n'a pas (encore) de route tags : on garde la liste démo.
    return Promise.resolve(demo.tags);
  },

  topics({ q, tag, sort } = {}) {
    return liveOrDemo(
      () => api.listTopics({ q, tag, sort }),
      () => {
        let list = [...demo.topics];
        if (q) {
          const needle = q.toLowerCase();
          list = list.filter((t) => (t.title + (t.body || "")).toLowerCase().includes(needle));
        }
        if (tag) list = list.filter((t) => t.tags?.includes(tag));

        if (sort === "votes")       list.sort((a, b) => b.votes - a.votes);
        else if (sort === "active") list.sort((a, b) => b.replies - a.replies);
        else                        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return list;
      }
    );
  },

  topic(id) {
    id = Number(id);
    return liveOrDemo(
      () => api.getTopic(id),
      () => {
        const t = demo.topics.find((x) => x.id === id);
        if (!t) return null;
        return { ...t, posts: demo.posts[id] || [] };
      }
    );
  },

  async createTopic(title, body, tags) {
    if (await backendAlive()) return api.createTopic(title, body, tags, this.currentUserId());
    const t = {
      id: nextId(demo.topics),
      title, body, tags,
      author: demo.user?.username || "moi",
      locked: false, createdAt: new Date().toISOString(),
      replies: 0, votes: 0, views: 0,
    };
    demo.topics.unshift(t);
    demo.posts[t.id] = [];
    return t;
  },

  posts(topicId) {
    topicId = Number(topicId);
    // Le back ne liste pas les posts seuls : ils arrivent dans getTopic().
    return liveOrDemo(
      async () => {
        const t = await api.getTopic(topicId);
        return t.posts || [];
      },
      () => demo.posts[topicId] || []
    );
  },

  async createPost(topicId, title, text) {
    topicId = Number(topicId);
    if (await backendAlive()) return api.createPost(topicId, title, text, this.currentUserId());

    const arr = demo.posts[topicId] || (demo.posts[topicId] = []);
    const post = {
      id: nextId(arr, 20),
      topicId, title, text,
      author: demo.user?.username || "moi",
      createdAt: new Date().toISOString(), votes: 0,
    };
    arr.push(post);
    // on tient le compteur de réponses du topic à jour
    const topic = demo.topics.find((x) => x.id === topicId);
    if (topic) topic.replies++;
    return post;
  },

  responses(postId) {
    postId = Number(postId);
    // Le back renvoie les commentaires dans getPost(id).
    return liveOrDemo(
      async () => {
        const d = await api.getPost(postId);
        return d.comments || [];
      },
      () => demo.responses[postId] || []
    );
  },

  async createResponse(postId, text, parentId) {
    postId = Number(postId);
    if (await backendAlive()) return api.createResponse(postId, text, parentId, this.currentUserId());

    const arr = demo.responses[postId] || (demo.responses[postId] = []);
    const resp = {
      id: nextId(arr, 220),
      postId, text,
      author: demo.user?.username || "moi",
      createdAt: new Date().toISOString(), votes: 0,
    };
    arr.push(resp);
    return resp;
  },

  async vote(kind, id, value) {
    if (await backendAlive()) return api.vote(kind, id, value, this.currentUserId());

    // En démo on modifie juste le compteur en mémoire. On cherche l'élément
    // dans tous les posts (ou toutes les réponses) puisqu'ils sont indexés
    // par parent et pas par leur propre id.
    const pool = kind === "posts" ? demo.posts : demo.responses;
    for (const arr of Object.values(pool)) {
      const item = arr.find((x) => x.id === id);
      if (item) {
        item.votes = (item.votes || 0) + value;
        break;
      }
    }
    return { ok: true };
  },
};

export { store };
