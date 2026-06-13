// ============================================================================
// api.js — Couche d'accès au back-end (serveur Go sur :3000)
// ----------------------------------------------------------------------------
// Toutes les routes réseau du front passent par ce fichier. Si le back-end
// change d'adresse ou de chemin, on ne modifie QUE ce fichier.
//
// Entités côté back (cf. Backend/functions/api.go) :
//   Users(Name, Mail, Passworde) · topics(Titre, ID_User)
//   post(Titre, Text, ID_User, ID_Topic) · response(ID_User, ID_Post|ID_Rep, Text)
// ============================================================================

const API_BASE = "http://localhost:3000";

// Map central des chemins. Le back actuel n'expose que "/" ; les autres
// chemins suivent une convention REST cohérente avec les entités ci-dessus
// et sont prêts à être branchés côté Go (routeur.go).
const ROUTES = {
  // Auth
  register:      "/api/register",          // POST {username, email, password}
  login:         "/api/login",             // POST {email, password}
  logout:        "/api/logout",            // POST
  me:            "/api/me",                // GET  -> utilisateur courant

  // Topics (catégories / fils)
  topics:        "/api/topics",            // GET liste · POST création {title}
  topic:        (id) => `/api/topics/${id}`,        // GET un topic + ses posts
  topicDelete:  (id) => `/api/topics/${id}`,        // DELETE
  topicLock:    (id) => `/api/topics/${id}/lock`,   // POST (modération)

  // Posts (messages d'un fil)
  posts:        (topicId) => `/api/topics/${topicId}/posts`, // GET · POST {title, text}
  post:         (id) => `/api/posts/${id}`,         // GET · DELETE
  postEdit:     (id) => `/api/posts/${id}`,         // PUT {title, text}

  // Réponses / commentaires
  responses:    (postId) => `/api/posts/${postId}/responses`, // GET · POST {text, parentId?}
  response:     (id) => `/api/responses/${id}`,     // DELETE

  // Votes (like / dislike)
  vote:         (kind, id) => `/api/${kind}/${id}/vote`, // POST {value:1|-1} · kind = posts|responses

  // Tags / recherche
  tags:          "/api/tags",              // GET
  search:        "/api/search",            // GET ?q=...&tag=...
};

// ---------------------------------------------------------------------------
// Helper bas niveau : fetch JSON, gestion d'erreur uniforme, cookies de session.
// ---------------------------------------------------------------------------
async function request(path, { method = "GET", body, query } = {}) {
  let url = API_BASE + path;
  if (query) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== "")
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const opts = {
    method,
    headers: { "Accept": "application/json" },
    credentials: "include", // envoie le cookie de session au back Go
  };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (networkErr) {
    throw new ApiError("Serveur injoignable. Le back-end tourne-t-il sur :3000 ?", 0);
  }

  // 204 No Content
  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const msg = (data && data.error) || `Erreur ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data;
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// API publique consommée par le reste du front.
// ---------------------------------------------------------------------------
const api = {
  ApiError,
  base: API_BASE,

  // --- Auth ---
  register: (username, email, password) =>
    request(ROUTES.register, { method: "POST", body: { username, email, password } }),
  login: (email, password) =>
    request(ROUTES.login, { method: "POST", body: { email, password } }),
  logout: () => request(ROUTES.logout, { method: "POST" }),
  me: () => request(ROUTES.me),

  // --- Topics ---
  listTopics: (query) => request(ROUTES.topics, { query }),
  getTopic: (id) => request(ROUTES.topic(id)),
  createTopic: (title, body, tags) =>
    request(ROUTES.topics, { method: "POST", body: { title, body, tags } }),
  deleteTopic: (id) => request(ROUTES.topicDelete(id), { method: "DELETE" }),
  lockTopic: (id) => request(ROUTES.topicLock(id), { method: "POST" }),

  // --- Posts ---
  listPosts: (topicId, query) => request(ROUTES.posts(topicId), { query }),
  createPost: (topicId, title, text) =>
    request(ROUTES.posts(topicId), { method: "POST", body: { title, text } }),
  editPost: (id, title, text) =>
    request(ROUTES.postEdit(id), { method: "PUT", body: { title, text } }),
  deletePost: (id) => request(ROUTES.post(id), { method: "DELETE" }),

  // --- Réponses ---
  listResponses: (postId) => request(ROUTES.responses(postId)),
  createResponse: (postId, text, parentId) =>
    request(ROUTES.responses(postId), { method: "POST", body: { text, parentId } }),
  deleteResponse: (id) => request(ROUTES.response(id), { method: "DELETE" }),

  // --- Votes ---
  vote: (kind, id, value) =>
    request(ROUTES.vote(kind, id), { method: "POST", body: { value } }),

  // --- Tags / recherche ---
  listTags: () => request(ROUTES.tags),
  search: (q, tag) => request(ROUTES.search, { query: { q, tag } }),
};

export { api, ROUTES, API_BASE };
