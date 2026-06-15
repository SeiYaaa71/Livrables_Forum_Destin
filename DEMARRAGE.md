# Lancer le forum (front + back reliés)

## 1. Base de données
Le back se connecte à MySQL avec : `root:root@tcp(127.0.0.1:3306)/forum`
(voir `Backend/main.go`). Assure-toi que :
- MySQL tourne sur le port 3306,
- une base `forum` existe,
- les tables existent (voir `schema_reference.sql` pour les noms de colonnes
  attendus par le code Go).

Si ton utilisateur/mot de passe MySQL diffère, modifie la ligne `sql.Open`
dans `Backend/main.go`.

## 2. Lancer le back (Go)
```bash
cd Backend
go mod tidy      # récupère les dépendances la première fois
go run .
```
Le serveur écoute sur http://localhost:3000
Routes principales : `/api/register`, `/api/login`, `/api/topics`, etc.

## 3. Lancer le front
Le front utilise des modules ES (`import/export`) : il DOIT être servi en HTTP,
pas ouvert en double-cliquant le fichier (sinon les imports sont bloqués).

Option simple, depuis le dossier `Frontend` :
```bash
cd Frontend
python3 -m http.server 5500
```
Puis ouvre http://localhost:5500/index.html
(En VS Code, l'extension "Live Server" fait la même chose.)

## 4. Comment ça marche
- `Frontend/js/api.js` : seul fichier qui connaît les URL et les noms de champs
  du back. Login/register/topics/posts/réponses/votes y sont traduits.
- `Frontend/js/store.js` : si le back répond, utilise l'API réelle ; sinon
  bascule sur des données de démo pour que l'interface reste cliquable.
- La session (utilisateur connecté + son IdUser) est gardée côté navigateur
  dans `localStorage` sous la clé `agora.session.v1`, car le back ne gère pas
  encore de cookie de session.

## 5. Points à vérifier côté back (incohérences repérées)
Le code Go mélange des noms de tables/colonnes selon les fichiers. À aligner
avec ta vraie base (voir `schema_reference.sql`) :
- `feed.go` lit `Topics(id, user_id, title)` et `Posts(... topic_id ...)`
- `api.go` écrit dans `topics(Titre, ID_User)` et `post(Titre, Text, ID_User, ID_Topic)`
- `GetPostDetails` lit la table `post` ET `response`, `GetTopicByID` lit `Posts`
Ces différences de casse/nom feront échouer certaines requêtes si ta base ne
contient pas exactement ces noms. Choisis UNE convention et rends le code Go
cohérent.

## Corrections déjà appliquées au back
- `routeur.go` : ajout de toutes les routes `/api/*` attendues par le front
  (les anciennes `/users/*` restent pour compat).
- `feed.go` : `INSERT INTO likes ... VALUES (? ? ?)` → `VALUES (?, ?, ?)`.
- `Handlers.go` : ordre des arguments de `AddLikes` corrigé, et `return`
  ajouté après l'erreur dans `AddLikesHandler`.
