// api.js
// Tout ce qui parle au serveur Go passe par ici. Le but c'est de ne jamais
// écrire une URL ou un fetch ailleurs dans le front : si le back bouge, on
// touche que ce fichier.
//
// Rappel du schéma côté back (functions/api.go) :
//   Users(Name, Mail, Passworde)
//   topics(Titre, ID_User)
//   post(Titre, Text, ID_User, ID_Topic)
//   response(ID_User, ID_Post|ID_Rep, Text)

const API_BASE = "http://localhost:3000";

// Les chemins. Pour l'instant le routeur Go n'a que "/", donc tout le reste
// est encore à brancher côté serveur — mais on garde une convention REST
// propre pour pas avoir à revenir ici après.
const ROUTES = {
  register: "/api/register",
  login:    "/api/login",
  logout:   "/api/logout",
  me:       "/api/me",

  topics:       "/api/topics",
  topic:       (id) => `/api/topics/${id}`,
  topicLock:   (id) => `/api/topics/${id}/lock`,   // réservé modos

  posts:       (topicId) => `/api/topics/${topicId}/posts`,
  post:        (id) => `/api/posts/${id}`,

  responses:   (postId) => `/api/posts/${postId}/responses`,
  response:    (id) => `/api/responses/${id}`,

  // kind vaut "posts" ou "responses" — on vote sur les deux
  vote:        (kind, id) => `/api/${kind}/${id}/vote`,

  tags:   "/api/tags",
  search: "/api/search",
};

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Petit wrapper autour de fetch. Gère le JSON dans les deux sens, les cookies
// de session, et renvoie une ApiError lisible plutôt qu'un truc cryptique.
async function request(path, { method = "GET", body, query } = {}) {
  let url = API_BASE + path;

  // on filtre les params vides sinon on se retrouve avec ?q=&tag=
  if (query) {
    const entries = Object.entries(query).filter(([, v]) => v !== undefined && v !== "");
    const qs = new URLSearchParams(entries).toString();
    if (qs) url += "?" + qs;
  }

  const opts = {
    method,
    headers: { Accept: "application/json" },
    credentials: "include", // pour que le cookie de session suive
  };

  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch {
    // ici c'est presque toujours "serveur pas lancé" ou CORS
    throw new ApiError("Serveur injoignable. Le back tourne bien sur :3000 ?", 0);
  }

  if (res.status === 204) return null;

  // On lit en texte d'abord : certaines erreurs du back ne sont pas du JSON.
  const raw = await res.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); }
    catch { data = raw; }
  }

  if (!res.ok) {
    const msg = (data && data.error) || `Erreur ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data;
}

// L'objet que le reste du front utilise. Chaque méthode est juste une façon
// lisible d'appeler request() — pas de logique métier ici.
const api = {
  ApiError,
  base: API_BASE,

  // -- comptes --
  register: (username, email, password) =>
    request(ROUTES.register, { method: "POST", body: { username, email, password } }),
  login: (email, password) =>
    request(ROUTES.login, { method: "POST", body: { email, password } }),
  logout: () => request(ROUTES.logout, { method: "POST" }),
  me:     () => request(ROUTES.me),

  // -- topics --
  listTopics:  (query) => request(ROUTES.topics, { query }),
  getTopic:    (id) => request(ROUTES.topic(id)),
  createTopic: (title, body, tags) =>
    request(ROUTES.topics, { method: "POST", body: { title, body, tags } }),
  deleteTopic: (id) => request(ROUTES.topic(id), { method: "DELETE" }),
  lockTopic:   (id) => request(ROUTES.topicLock(id), { method: "POST" }),

  // -- posts --
  listPosts:  (topicId, query) => request(ROUTES.posts(topicId), { query }),
  createPost: (topicId, title, text) =>
    request(ROUTES.posts(topicId), { method: "POST", body: { title, text } }),
  editPost:   (id, title, text) =>
    request(ROUTES.post(id), { method: "PUT", body: { title, text } }),
  deletePost: (id) => request(ROUTES.post(id), { method: "DELETE" }),

  // -- réponses --
  listResponses:  (postId) => request(ROUTES.responses(postId)),
  createResponse: (postId, text, parentId) =>
    request(ROUTES.responses(postId), { method: "POST", body: { text, parentId } }),
  deleteResponse: (id) => request(ROUTES.response(id), { method: "DELETE" }),

  // -- votes -- value = 1 (like) ou -1 (dislike)
  vote: (kind, id, value) =>
    request(ROUTES.vote(kind, id), { method: "POST", body: { value } }),

  // -- tags / recherche --
  listTags: () => request(ROUTES.tags),
  search:   (q, tag) => request(ROUTES.search, { query: { q, tag } }),
};

export { api, ROUTES, API_BASE };
