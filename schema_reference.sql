-- Schéma de référence DÉDUIT du code Go.
-- ⚠️ À adapter : le code mélange les casses (Topics/topics, Posts/post...).
-- Compare avec ta vraie base et harmonise le code Go OU ce schéma.

CREATE DATABASE IF NOT EXISTS forum CHARACTER SET utf8mb4;
USE forum;

-- Users : écrit par api.go CreateUser (Name, Mail, Passworde, PP)
--         lu par login.go (ID, Passworde) et GetUserProfileHandler (ID, Name, Mail, PP)
CREATE TABLE IF NOT EXISTS Users (
  ID        INT AUTO_INCREMENT PRIMARY KEY,
  Name      VARCHAR(50)  NOT NULL UNIQUE,
  Mail      VARCHAR(120) NOT NULL UNIQUE,
  Passworde VARCHAR(255) NOT NULL,   -- hash bcrypt
  PP        VARCHAR(255) DEFAULT ''
);

-- Topics : ATTENTION, deux écritures différentes dans le code !
--   api.go écrit   : topics(Titre, ID_User)
--   feed.go lit     : Topics(id, user_id, title)
-- Ci-dessous une version unifiée à privilégier (mets le code Go en accord) :
CREATE TABLE IF NOT EXISTS Topics (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title   VARCHAR(200) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES Users(ID)
);

-- Posts : api.go écrit post(Titre, Text, ID_User, ID_Topic)
--         feed.go lit Posts(id, user_id, title, text, topic_id)
CREATE TABLE IF NOT EXISTS Posts (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  user_id  INT NOT NULL,
  topic_id INT NOT NULL,
  title    VARCHAR(200) NOT NULL,
  text     TEXT NOT NULL,
  FOREIGN KEY (user_id)  REFERENCES Users(ID),
  FOREIGN KEY (topic_id) REFERENCES Topics(id)
);

-- Responses (commentaires) : api.go écrit response(ID_User, ID_Post|ID_Rep, Text)
--   ID_Rep = réponse à un autre commentaire (auto-référence)
CREATE TABLE IF NOT EXISTS response (
  ID      INT AUTO_INCREMENT PRIMARY KEY,
  ID_User INT NOT NULL,
  ID_Post INT NULL,
  ID_Rep  INT NULL,
  Text    TEXT NOT NULL,
  FOREIGN KEY (ID_User) REFERENCES Users(ID)
);

-- Likes : feed.go écrit likes(ID_Post|ID_Rep, ID_User, State)
--   State = 1 pour un like
CREATE TABLE IF NOT EXISTS likes (
  ID      INT AUTO_INCREMENT PRIMARY KEY,
  ID_Post INT NULL,
  ID_Rep  INT NULL,
  ID_User INT NOT NULL,
  State   TINYINT NOT NULL DEFAULT 1,
  FOREIGN KEY (ID_User) REFERENCES Users(ID)
);

-- NOTE IMPORTANTE sur la casse :
-- MySQL sous Linux est sensible à la casse des noms de tables.
-- Le code Go utilise tantôt "Topics"/"Posts", tantôt "topics"/"post".
-- Soit tu crées les tables avec ces deux noms (déconseillé), soit —
-- recommandé — tu choisis une casse unique et tu corriges les requêtes Go
-- dans api.go et feed.go pour qu'elles correspondent.
