# Frontend — Forum « Agora »

Front-end statique (HTML / CSS / JS séparés), sans build ni dépendance npm.
Se branche sur le back-end Go fourni (serveur sur `http://localhost:3000`).

## Structure

```
Frontend/
├── index.html        Liste des sujets (filtres, tags, tri, pagination)
├── thread.html       Un fil : message d'origine + posts + réponses + votes
├── login.html        Connexion
├── register.html     Inscription
├── new.html          Création d'un sujet
├── css/
│   ├── base.css      Tokens de design + styles globaux (header, boutons, champs)
│   └── forum.css     Styles des pages (liste, fil, votes, formulaires)
├── js/
│   ├── api.js        ⚙️  Couche réseau — TOUTES les routes back sont ici
│   ├── store.js      Façade : API réelle, sinon bascule en mode démo local
│   ├── ui.js         Helpers partagés (header, toasts, dates, échappement XSS)
│   ├── page-index.js Logique de la liste
│   ├── page-thread.js Logique d'un fil
│   └── page-auth.js  Connexion / inscription / nouveau sujet
└── assets/           Images / statiques éventuels
```

## Lancer

Servez le dossier avec n'importe quel serveur statique (les modules ES exigent http, pas `file://`) :

```bash
cd Frontend
python3 -m http.server 5500
# puis ouvrir http://localhost:5500
```

Sans back-end actif, le front passe automatiquement en **mode démo**
(bannière en haut) avec des données locales, pour visualiser l'UI.

## Contrat d'API attendu par le front (à implémenter côté `routeur.go`)

Base : `http://localhost:3000`. Toutes les routes sont centralisées dans
`js/api.js` → objet `ROUTES`. Changer le back = changer ce seul fichier.

| Méthode | Route                               | Corps / params              | Entité back               |
|---------|-------------------------------------|-----------------------------|---------------------------|
| POST    | `/api/register`                     | `{username, email, password}` | `Users(Name, Mail, Passworde)` |
| POST    | `/api/login`                        | `{email, password}`         | `Users`                   |
| POST    | `/api/logout`                       | —                           | session                   |
| GET     | `/api/me`                           | —                           | utilisateur courant       |
| GET     | `/api/topics`                       | `?q&tag&sort`               | `topics`                  |
| POST    | `/api/topics`                       | `{title, body, tags}`       | `topics(Titre, ID_User)`  |
| GET     | `/api/topics/{id}`                  | —                           | `topics` + ses `post`     |
| DELETE  | `/api/topics/{id}`                  | —                           | modération                |
| POST    | `/api/topics/{id}/lock`             | —                           | modération                |
| GET     | `/api/topics/{id}/posts`            | —                           | `post`                    |
| POST    | `/api/topics/{id}/posts`            | `{title, text}`             | `post(Titre, Text, ID_User, ID_Topic)` |
| PUT     | `/api/posts/{id}`                   | `{title, text}`             | `post`                    |
| DELETE  | `/api/posts/{id}`                   | —                           | `post`                    |
| GET     | `/api/posts/{id}/responses`         | —                           | `response`                |
| POST    | `/api/posts/{id}/responses`         | `{text, parentId?}`         | `response(ID_User, ID_Post|ID_Rep, Text)` |
| POST    | `/api/posts/{id}/vote`              | `{value: 1 | -1}`           | like / dislike            |
| POST    | `/api/responses/{id}/vote`          | `{value: 1 | -1}`           | like / dislike            |
| GET     | `/api/tags`                         | —                           | tags                      |
| GET     | `/api/search`                       | `?q&tag`                    | recherche                 |

### Notes d'intégration
- Le front envoie/attend du **JSON** et inclut les cookies (`credentials: include`)
  pour la session — prévoir les en-têtes **CORS** côté Go si le front est servi
  sur un autre port :
  `Access-Control-Allow-Origin: http://localhost:5500`,
  `Access-Control-Allow-Credentials: true`.
- Les erreurs renvoient idéalement `{ "error": "message" }` avec un code HTTP ≠ 2xx ;
  `api.js` l'affiche tel quel.
- Le contenu utilisateur est échappé côté front (`ui.js → esc`), mais
  **validez et échappez aussi côté back**.
