// api.js
// Couche unique qui parle au back Go (Gin + MySQL). Toutes les URL et tous les
// noms de champs JSON attendus par le serveur sont centralisés ici : si le back
// bouge, on ne touche qu'à ce fichier.
//
// Le back attend des noms de champs précis (voir functions/Handlers.go) :
//   register -> { Name, Mail, Passworde, PP }
//   login    -> { identifiers, password }   (identifiers = nom OU email)
//   topic    -> { Nom, ID_User }
//   post     -> { ID_Topics, ID_User, Titre, Text }
//   comment  -> { ID_Post|ID_Rep, ID_User, Texts }
//   like     -> { UserId, PostID|CommentID, State }
//
// Côté lecture, le back renvoie des structures (feed.go) qu'on normalise pour
// que le reste du front reçoive toujours la même forme d'objet.

const API_BASE = "http://localhost:3000";

const ROUTES = {
  register: "/api/register",
  login:    "/api/login",

  topics:        "/api/topics",
  topic:        (id) => `/api/topics/${id}`,
  posts:        (topicId) => `/api/topics/${topicId}/posts`,
  post:         (id) => `/api/posts/${id}`,
  responses:    (postId) => `/api/posts/${postId}/responses`,
  postVote:     (id) => `/api/posts/${id}/vote`,
  responseVote: (id) => `/api/responses/${id}/vote`,
  user:         (id) => `/api/users/${id}`,
};

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, { method = "GET", body, query } = {}) {
  let url = API_BASE + path;

  if (query) {
    const entries = Object.entries(query).filter(([, v]) => v !== undefined && v !== "");
    const qs = new URLSearchParams(entries).toString();
    if (qs) url += "?" + qs;
  }

  const opts = { method, headers: { Accept: "application/json" } };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch {
    throw new ApiError("Serveur injoignable. Le back tourne bien sur :3000 ?", 0);
  }

  if (res.status === 204) return null;

  const raw = await res.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = raw; }
  }

  if (!res.ok) {
    const msg = (data && data.error) || `Erreur ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data;
}

// --- Normalisation lecture ---
// Le back renvoie des topics { id, user_id, title } et des posts
// { id, user_id, title, text, likes }. Le front attend { author, votes,
// replies, createdAt, body/text... }. On comble ce qui manque proprement
// plutôt que de réécrire tout le front.

function normalizeTopic(t = {}) {
  return {
    id: t.id,
    title: t.title ?? t.Titre ?? "",
    body: t.body ?? "",
    author: t.author ?? (t.user_id != null ? `#${t.user_id}` : "—"),
    authorId: t.user_id,
    tags: t.tags ?? [],
    locked: t.locked ?? false,
    createdAt: t.createdAt ?? t.created_at ?? null,
    replies: t.replies ?? (Array.isArray(t.posts) ? t.posts.length : 0),
    votes: t.votes ?? 0,
    views: t.views ?? 0,
    posts: Array.isArray(t.posts) ? t.posts.map(normalizePost) : undefined,
  };
}

function normalizePost(p = {}) {
  return {
    id: p.id,
    topicId: p.topic_id ?? p.topicId,
    title: p.title ?? p.Titre ?? "",
    text: p.text ?? p.Text ?? "",
    author: p.author ?? (p.user_id != null ? `#${p.user_id}` : "—"),
    authorId: p.user_id,
    createdAt: p.createdAt ?? null,
    votes: p.likes ?? p.votes ?? 0,
  };
}

function normalizeResponse(r = {}) {
  return {
    id: r.id,
    postId: r.post_id ?? r.postId,
    parentId: r.id_rep ?? r.parentId ?? 0,
    text: r.text ?? r.Text ?? "",
    author: r.author ?? (r.user_id != null ? `#${r.user_id}` : "—"),
    authorId: r.user_id,
    createdAt: r.createdAt ?? null,
    votes: r.likes ?? r.votes ?? 0,
  };
}

// L'objet utilisé par store.js. On garde EXACTEMENT les mêmes signatures
// qu'avant pour ne rien casser ; seule la mécanique interne change.
const api = {
  ApiError,
  base: API_BASE,

  // -- comptes --
  // Le front passe (username, email, password). Le back veut Name/Mail/Passworde.
  register: (username, email, password) =>
    request(ROUTES.register, {
      method: "POST",
      body: { Name: username, Mail: email, Passworde: password, PP: "" },
    }),

  // Le back accepte un identifiant unique (nom OU email) -> "identifiers".
  login: (identifier, password) =>
    request(ROUTES.login, {
      method: "POST",
      body: { identifiers: identifier, password },
    }),

  // Le back actuel n'a pas de session ni de /me ni de /logout : ces notions
  // sont gérées côté client (voir store.js). On expose quand même les méthodes
  // pour garder l'interface stable.
  me:     () => Promise.resolve(null),
  logout: () => Promise.resolve(null),

  // -- topics --
  async listTopics() {
    const data = await request(ROUTES.topics);
    const arr = data?.Topics ?? data?.topics ?? [];
    return arr.map(normalizeTopic);
  },
  async getTopic(id) {
    const data = await request(ROUTES.topic(id));
    return normalizeTopic(data);
  },
  createTopic: (title, _body, _tags, userId) =>
    request(ROUTES.topics, {
      method: "POST",
      body: { Nom: title, ID_User: Number(userId) || 0 },
    }),

  // -- posts --
  async getPost(id) {
    const data = await request(ROUTES.post(id));
    return {
      post: normalizePost(data?.post),
      comments: (data?.comments ?? []).map(normalizeResponse),
    };
  },
  createPost: (topicId, title, text, userId) =>
    request(ROUTES.posts(topicId), {
      method: "POST",
      body: {
        ID_Topics: Number(topicId),
        ID_User: Number(userId) || 0,
        Titre: title,
        Text: text,
      },
    }),

  // -- réponses --
  createResponse: (postId, text, parentId, userId) =>
    request(ROUTES.responses(postId), {
      method: "POST",
      body: {
        ID_Post: parentId ? 0 : Number(postId),
        ID_Rep: parentId ? Number(parentId) : 0,
        ID_User: Number(userId) || 0,
        Texts: text,
      },
    }),

  // -- votes -- value = 1 (like) ou -1. Le back stocke State (1 = like).
  vote: (kind, id, value, userId) => {
    const state = value >= 0 ? 1 : 0;
    if (kind === "responses") {
      return request(ROUTES.responseVote(id), {
        method: "POST",
        body: { UserId: Number(userId) || 0, CommentID: Number(id), State: state },
      });
    }
    return request(ROUTES.postVote(id), {
      method: "POST",
      body: { UserId: Number(userId) || 0, PostID: Number(id), State: state },
    });
  },

  // -- profil --
  getUser: (id) => request(ROUTES.user(id)),
};

export { api, ROUTES, API_BASE };
