package functions

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"strings"
	"fmt"
	"github.com/gin-gonic/gin"
)

type RegisterInput struct {
	Name     string `json:"Name" binding:"required"`
	Email    string `json:"Mail" binding:"required,email"`
	Password string `json:"Passworde" binding:"required"`
	PP       string `json:"PP"`
}

type TopicINput struct {
	Title       string   `json:"Titre" binding:"required"`
	Description string   `json:"Description" binding:"required"`
	Tags        []string `json:"Tags"`
	IsPrivate   int      `json:"is_private"` // 0 = public, 1 = amis
}

type PostInput struct {
    TopicID int    `json:"topic_id" binding:"required"`
    Title   string `json:"title" binding:"required"`
    Text    string `json:"text" binding:"required"`
    UserID  int    `json:"user_id"` // <-- Correction appliquée
}

type CommentInput struct {
	PostID    int    `json:"ID_Post"`
	CommentID int    `json:"ID_Rep"`
	UserID    int    `json:"ID_User"`
	Text      string `json:"Texts" binding:"required"`
}

type LoginInput struct {
	Identifiers string `json:"identifiers" binding:"required"`
	Password    string `json:"password" binding:"required"`
}

type LikeInput struct {
    PostID    int `json:"post_id"`
    CommentID int `json:"comment_id"`
    State     int `json:"state"`
    UserID    int `json:"user_id"` // <-- SUPPRIMEZ le binding:"required" ici
}

// --- AJOUTEZ CE MIDDLEWARE EN HAUT DE HANDLERS.GO ---

func AuthMiddleware(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. On lit l'ID envoyé par le Frontend dans les headers
		userIDStr := c.GetHeader("X-User-Id")
		if userIDStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentification requise"})
			c.Abort() // Coupe la requête immédiatement
			return
		}

		// 2. On convertit en nombre
		userID, err := strconv.Atoi(userIDStr)
		if err != nil || userID <= 0 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "ID utilisateur invalide"})
			c.Abort()
			return
		}

		// 3. On vérifie que cet ID existe VRAIMENT dans la base de données
		var exists bool
		err = db.QueryRow("SELECT true FROM users WHERE ID = ?", userID).Scan(&exists)
		if err != nil || !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Ce compte n'existe pas ou plus"})
			c.Abort()
			return
		}

		// 4. VÉRIFICATION DU BANNISSEMENT (Nouveau)
		var isBanned bool
		// Si l'utilisateur n'est pas dans la table bans, err sera sql.ErrNoRows (donc isBanned reste false)
		_ = db.QueryRow("SELECT true FROM bans WHERE ID_User = ?", userID).Scan(&isBanned)
		if isBanned {
			c.JSON(http.StatusForbidden, gin.H{"error": "Ce compte a été banni de la plateforme."})
			c.Abort()
			return
		}

		// 5. C'est tout bon ! On stocke l'ID dans le contexte pour les autres fonctions
		c.Set("userID", userID)
		c.Next() // Autorise le passage vers le Handler
	}
}

func RegisterHandler(c *gin.Context, db *sql.DB) {
	var input RegisterInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Données invalides ou incomplètes"})
		return
	}

	newID, err := CreateUser(db, input.Name, input.Password, input.Email, input.PP)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Impossible de créer l'utilisateur"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Utilisateur créé avec succès",
		"userID":  newID,
	})
}

func TopicHandler(c *gin.Context, db *sql.DB) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Vous devez être connecté."})
		return
	}
	actualUserID := userID.(int)

	var input TopicINput // Utilisation de la structure mise à jour
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Données invalides."})
		return
	}

	// Insertion avec IsPrivate
	query := `INSERT INTO topics (Titre, Description, Tags, ID_User, IsPrivate) VALUES (?, ?, ?, ?, ?)`
	tagsStr := strings.Join(input.Tags, ",")
	
	result, err := db.Exec(query, input.Title, input.Description, tagsStr, actualUserID, input.IsPrivate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la création."})
		return
	}

	topicID, _ := result.LastInsertId()
	c.JSON(http.StatusCreated, gin.H{"message": "Sujet créé", "topicID": topicID})
}

func PostHandler(c *gin.Context, db *sql.DB) {
	// A. Récupération de l'ID utilisateur depuis la session/token (sécurisé)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non autorisé. Veuillez vous connecter."})
		return
	}

	// B. Lecture des données envoyées par le JavaScript (Front-End)
	var input PostInput
	if err := c.ShouldBindJSON(&input); err != nil {
		fmt.Println("🚨 ERREUR DE LECTURE DU POST :", err) // Utile pour le débogage
		c.JSON(http.StatusBadRequest, gin.H{"error": "Données invalides."})
		return
	}

	// C. Insertion dans la base de données en utilisant l'ID de la session
	// Assurez-vous que les noms des colonnes correspondent exactement à votre base de données (ex: ID_Topics, ID_User, Titre, Text)
	res, err := db.Exec("INSERT INTO post (ID_Topics, ID_User, Titre, Text) VALUES (?, ?, ?, ?)",
		input.TopicID, userID, input.Title, input.Text)

	if err != nil {
		fmt.Println("🚨 ERREUR SQL INSERTION POST :", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la création du message."})
		return
	}

	// D. Confirmation de succès
	postID, _ := res.LastInsertId()
	c.JSON(http.StatusOK, gin.H{
		"message": "Message publié avec succès.",
		"post_id": postID,
	})
}

func CommentHandler(c *gin.Context, db *sql.DB) {
	// 1. Vérification de l'identité via le Middleware
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Vous devez être connecté pour commenter."})
		return
	}
	actualUserID := userID.(int)

	// 2. Récupération des données Front-End
	var input CommentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Printf("Erreur JSON (400) : %v\n", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Texte invalide ou manquant."})
		return
	}

	// 3. Insertion avec gestion stricte des Foreign Keys
	var err error
	
	if input.CommentID > 0 {
		// Réponse à un commentaire : on ignore totalement la colonne ID_Post
		query := `INSERT INTO response (ID_User, ID_Rep, Texts) VALUES (?, ?, ?)`
		_, err = db.Exec(query, actualUserID, input.CommentID, input.Text)
	} else {
		// Commentaire racine : on ignore totalement la colonne ID_Rep
		query := `INSERT INTO response (ID_User, ID_Post, Texts) VALUES (?, ?, ?)`
		_, err = db.Exec(query, actualUserID, input.PostID, input.Text)
	}

	if err != nil {
		log.Printf("Erreur SQL (500) : %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de l'enregistrement."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Commentaire ajouté avec succès."})
}

func LoginHandler(c *gin.Context, db *sql.DB) {
	var input LoginInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "donné invalide ou incomplète"})
		return
	}

    // On récupère désormais "role" en plus de "u" (l'ID)
	u, role, err := Login(db, input.Identifiers, input.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "impossible de login"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Connection effectuée",
		"IdUser":  u,
		"Role":    role, // Transmission du rôle au Front-End
	})
}

func AddLikesHandler(c *gin.Context, db *sql.DB) {
	// A. Vérification de l'identité
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Vous devez être connecté pour voter."})
		return
	}

	// B. Lecture des données
	var input LikeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		fmt.Println("🚨 ERREUR DE LECTURE DU VOTE :", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Données de vote invalides."})
		return
	}

	// C. Traitement du vote
	if input.PostID > 0 {
		// --- VOTE SUR UN POST ---
		_, err := db.Exec("DELETE FROM likes WHERE ID_Post = ? AND ID_User = ?", input.PostID, userID)
		if err != nil {
			fmt.Println("Erreur suppression ancien vote (Post):", err)
		}

		if input.State != 0 {
			// On utilise ID_Rep avec la valeur 0 pour indiquer que ce n'est pas une réponse
			_, err = db.Exec("INSERT INTO likes (ID_Post, ID_Rep, ID_User, State) VALUES (?, 0, ?, ?)", input.PostID, userID, input.State)
			if err != nil {
				fmt.Println("🚨 ERREUR INSERTION VOTE POST :", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de l'enregistrement du vote."})
				return
			}
		}

	} else if input.CommentID > 0 {
		// --- VOTE SUR UNE RÉPONSE (COMMENTAIRE) ---
		// On remplace CommentID par ID_Rep dans la requête SQL
		_, err := db.Exec("DELETE FROM likes WHERE ID_Rep = ? AND ID_User = ?", input.CommentID, userID)
		if err != nil {
			fmt.Println("Erreur suppression ancien vote (Comment):", err)
		}

		if input.State != 0 {
			// On utilise ID_Rep ici aussi
			_, err = db.Exec("INSERT INTO likes (ID_Post, ID_Rep, ID_User, State) VALUES (0, ?, ?, ?)", input.CommentID, userID, input.State)
			if err != nil {
				fmt.Println("🚨 ERREUR INSERTION VOTE COMMENT :", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de l'enregistrement du vote."})
				return
			}
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Aucun ID de message ou de commentaire fourni."})
		return
	}

	// D. Réponse de succès
	c.JSON(http.StatusOK, gin.H{"message": "Vote enregistré avec succès."})
}

func GetAllTopicsHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Récupération de l'identité du visiteur
		// Si l'utilisateur n'est pas connecté, GetHeader renvoie "" et Atoi renvoie 0.
		// Un viewerID de 0 indique à la base de données de ne renvoyer que les topics publics.
		viewerIDStr := c.GetHeader("X-User-Id")
		viewerID, _ := strconv.Atoi(viewerIDStr)

		// 2. Appel de la fonction de récupération avec l'identifiant
		Topics, err := GetAllTopics(db, viewerID)
		if err != nil {
			log.Printf("Erreur GetAllTopics : %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la récupération des topics"})
			return
		}

		// 3. Renvoi des données filtrées au client
		c.JSON(http.StatusOK, gin.H{
			"message": "Topics récupérés", 
			"Topics": Topics,
		})
	}
}

func GetTopicByIDHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idString := c.Param("id")

		topicID, err := strconv.Atoi(idString)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "L'ID du topic doit être un nombre valide"})
			return
		}

		// Récupération de l'ID du visiteur depuis le header (vaut 0 s'il n'est pas connecté)
		viewerIDStr := c.GetHeader("X-User-Id")
		viewerID, _ := strconv.Atoi(viewerIDStr)

		// On passe désormais le vrai viewerID à la fonction
		topicDetail, err := GetTopicByID(db, topicID, viewerID)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Topic introuvable ou accès restreint"})
				return
			}
			
			log.Printf("ERREUR SQL GetTopicByID : %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur SQL : " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, topicDetail)
	}
}

func GetPostByIDHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idString := c.Param("id")
		
		postID, err := strconv.Atoi(idString)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "L'ID du post doit être un nombre valide"})
			return
		}

		// SIMULATION : Utilisateur fixé à l'ID 1
		userID := 1

		// NOUVEAU : On passe userID à la fonction
		detail, err := GetPostDetails(db, postID, userID)
		if err != nil {
			log.Printf("ERREUR SQL GetPostDetails : %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		
		c.JSON(http.StatusOK, detail)
	}
}

func GetUserProfileHandler(c *gin.Context, db *sql.DB) {
	idParam := c.Param("id")
	
	// Lecture de l'identité du visiteur (0 s'il n'est pas connecté)
	viewerIDStr := c.GetHeader("X-User-Id")
	viewerID, _ := strconv.Atoi(viewerIDStr)

	var name, mail, pp string
	var profileID int

	query := "SELECT ID, Name, Mail, PP FROM users WHERE ID = ?"
	err := db.QueryRow(query, idParam).Scan(&profileID, &name, &mail, &pp)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Utilisateur introuvable"})
		return
	}

	// 1. Calcul du nombre d'amis (State = 1)
	var friendCount int
	db.QueryRow("SELECT COUNT(*) FROM friends WHERE (ID_User_1 = ? OR ID_User_2 = ?) AND State = 1", profileID, profileID).Scan(&friendCount)

	// 2. Détermination du statut de la relation
	relation := "none"
	if viewerID > 0 && viewerID != profileID {
		var u1, u2, state int
		err := db.QueryRow("SELECT ID_User_1, ID_User_2, State FROM friends WHERE (ID_User_1 = ? AND ID_User_2 = ?) OR (ID_User_1 = ? AND ID_User_2 = ?)", viewerID, profileID, profileID, viewerID).Scan(&u1, &u2, &state)
		if err == nil {
			if state == 1 {
				relation = "friends"
			} else if state == 0 {
				if u1 == viewerID {
					relation = "pending_sent"
				} else {
					relation = "pending_received"
				}
			}
		}
	} else if viewerID == profileID {
		relation = "self"
	}

	c.JSON(http.StatusOK, gin.H{
		"id":           profileID,
		"name":         name,
		"mail":         mail,
		"pp":           pp,
		"friend_count": friendCount,
		"relation":     relation,
	})
}

func FriendActionHandler(c *gin.Context, db *sql.DB) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentification requise"})
		return
	}
	actualUserID := userID.(int)

	var input struct {
		TargetID int    `json:"target_id" binding:"required"`
		Action   string `json:"action" binding:"required"` // "request", "accept", "remove"
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Données invalides"})
		return
	}

	if actualUserID == input.TargetID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Opération impossible sur vous-même"})
		return
	}

	if input.Action == "request" {
		_, err := db.Exec("INSERT INTO friends (ID_User_1, ID_User_2, State) VALUES (?, ?, 0)", actualUserID, input.TargetID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la demande"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Demande envoyée"})
		
	} else if input.Action == "accept" {
		_, err := db.Exec("UPDATE friends SET State = 1 WHERE ID_User_1 = ? AND ID_User_2 = ? AND State = 0", input.TargetID, actualUserID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de l'acceptation"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Demande acceptée"})
		
	} else if input.Action == "remove" {
		_, err := db.Exec("DELETE FROM friends WHERE (ID_User_1 = ? AND ID_User_2 = ?) OR (ID_User_1 = ? AND ID_User_2 = ?)", actualUserID, input.TargetID, input.TargetID, actualUserID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la suppression"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Ami retiré / Demande annulée"})
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Action inconnue"})
	}
}

func GetPendingRequestsHandler(c *gin.Context, db *sql.DB) {
	userID, _ := c.Get("userID")
	actualUserID := userID.(int)

	rows, err := db.Query(`
		SELECT u.ID, u.Name
		FROM friends f
		JOIN users u ON f.ID_User_1 = u.ID
		WHERE f.ID_User_2 = ? AND f.State = 0
	`, actualUserID)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur de base de données"})
		return
	}
	defer rows.Close()

	type PendingRequest struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}
	var requests []PendingRequest

	for rows.Next() {
		var req PendingRequest
		if err := rows.Scan(&req.ID, &req.Name); err == nil {
			requests = append(requests, req)
		}
	}

	c.JSON(http.StatusOK, requests)
}

// --- FONCTIONS DE MODÉRATION ET D'ADMINISTRATION ---

// BanUserHandler : Bannit un utilisateur et archive tous ses sujets
func BanUserHandler(c *gin.Context, db *sql.DB) {
	adminID, _ := c.Get("userID")
	
	// Vérification des droits d'administration
	var role sql.NullInt64
	db.QueryRow("SELECT Role FROM users WHERE ID = ?", adminID).Scan(&role)
	if !role.Valid || role.Int64 != 1 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Accès refusé. Réservé aux administrateurs."})
		return
	}

	var input struct { TargetID int `json:"target_id" binding:"required"` }
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID cible requis."})
		return
	}

	// 1. Ajouter à la table des bannis
	_, err := db.Exec("INSERT INTO bans (ID_User) VALUES (?)", input.TargetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors du bannissement."})
		return
	}

	// 2. Archiver automatiquement tous les topics de cet utilisateur
	db.Exec("UPDATE topics SET locked = 1 WHERE ID_User = ?", input.TargetID)

	c.JSON(http.StatusOK, gin.H{"message": "Utilisateur banni et sujets archivés."})
}

// ArchiveTopicHandler : Permet à l'Admin ou au Créateur de verrouiller un sujet
func ArchiveTopicHandler(c *gin.Context, db *sql.DB) {
	userID, _ := c.Get("userID")
	
	var input struct { TopicID int `json:"topic_id" binding:"required"` }
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID du sujet requis."})
		return
	}

	// Vérifier si l'utilisateur est Admin ou le créateur du sujet
	var role sql.NullInt64
	var creatorID int
	db.QueryRow("SELECT Role FROM users WHERE ID = ?", userID).Scan(&role)
	db.QueryRow("SELECT ID_User FROM topics WHERE ID = ?", input.TopicID).Scan(&creatorID)

	isAdmin := role.Valid && role.Int64 == 1
	isCreator := creatorID == userID.(int)

	if !isAdmin && !isCreator {
		c.JSON(http.StatusForbidden, gin.H{"error": "Vous n'avez pas l'autorisation d'archiver ce sujet."})
		return
	}

	_, err := db.Exec("UPDATE topics SET locked = 1 WHERE ID = ?", input.TopicID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de l'archivage."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Sujet archivé avec succès."})
}

// DeleteContentHandler : Supprime un Topic, un Post ou une Réponse
func DeleteContentHandler(c *gin.Context, db *sql.DB) {
	userID, _ := c.Get("userID")
	
	var input struct {
		Type string `json:"type" binding:"required"` // "topic", "post", "comment"
		ID   int    `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Données de suppression invalides."})
		return
	}

	// Vérification du rôle Admin
	var role sql.NullInt64
	db.QueryRow("SELECT Role FROM users WHERE ID = ?", userID).Scan(&role)
	isAdmin := role.Valid && role.Int64 == 1

	// Vérification du statut de créateur selon le type de contenu
	isAuthorized := isAdmin
	if !isAdmin {
		if input.Type == "topic" {
			var creatorID int
			db.QueryRow("SELECT ID_User FROM topics WHERE ID = ?", input.ID).Scan(&creatorID)
			isAuthorized = (creatorID == userID.(int))
		} else if input.Type == "post" {
			// Le créateur du sujet qui contient le post peut le supprimer
			var topicCreatorID int
			db.QueryRow("SELECT t.ID_User FROM post p JOIN topics t ON p.ID_Topics = t.ID WHERE p.ID = ?", input.ID).Scan(&topicCreatorID)
			isAuthorized = (topicCreatorID == userID.(int))
		} else if input.Type == "comment" {
			// Le créateur du sujet qui contient la réponse peut la supprimer
			var topicCreatorID int
			query := `
				SELECT t.ID_User FROM response r 
				LEFT JOIN post p ON r.ID_Post = p.ID 
				LEFT JOIN response parent ON r.ID_Rep = parent.ID 
				LEFT JOIN post p2 ON parent.ID_Post = p2.ID
				LEFT JOIN topics t ON (p.ID_Topics = t.ID OR p2.ID_Topics = t.ID)
				WHERE r.ID = ? LIMIT 1`
			db.QueryRow(query, input.ID).Scan(&topicCreatorID)
			isAuthorized = (topicCreatorID == userID.(int))
		} else if input.Type == "poll" {
			var topicCreatorID int
			db.QueryRow("SELECT t.ID_User FROM polls p JOIN topics t ON p.ID_Topics = t.ID WHERE p.ID = ?", input.ID).Scan(&topicCreatorID)
			isAuthorized = (topicCreatorID == userID.(int))
		}
	}

	if !isAuthorized {
		c.JSON(http.StatusForbidden, gin.H{"error": "Accès refusé."})
		return
	}

	// Exécution de la suppression
	var err error
	if input.Type == "topic" {
		_, err = db.Exec("DELETE FROM topics WHERE ID = ?", input.ID)
	} else if input.Type == "post" {
		_, err = db.Exec("DELETE FROM post WHERE ID = ?", input.ID)
	} else if input.Type == "comment" {
		_, err = db.Exec("DELETE FROM response WHERE ID = ?", input.ID)
	} else if input.Type == "poll" { // NOUVEAU
		_, err = db.Exec("DELETE FROM polls WHERE ID = ?", input.ID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur SQL lors de la suppression."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Contenu supprimé."})
}

func CreatePollHandler(c *gin.Context, db *sql.DB) {
	userID, _ := c.Get("userID")

	var input PollInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Données invalides."})
		return
	}

	if len(input.Options) < 2 || len(input.Options) > 4 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Un sondage doit avoir entre 2 et 4 options."})
		return
	}

	// 1. Création du sondage
	res, err := db.Exec("INSERT INTO polls (ID_Topics, ID_User, Title, Description) VALUES (?, ?, ?, ?)", input.TopicID, userID, input.Title, input.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la création du sondage."})
		return
	}
	pollID, _ := res.LastInsertId()

	// 2. Insertion des options
	for _, opt := range input.Options {
		if strings.TrimSpace(opt) != "" {
			db.Exec("INSERT INTO poll_options (ID_Poll, OptionText) VALUES (?, ?)", pollID, strings.TrimSpace(opt))
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Sondage créé."})
}

func VotePollHandler(c *gin.Context, db *sql.DB) {
	userID, _ := c.Get("userID")

	var input PollVoteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Données invalides."})
		return
	}

	// La contrainte PRIMARY KEY (ID_Poll, ID_User) bloquera automatiquement les doubles votes
	_, err := db.Exec("INSERT INTO poll_votes (ID_Poll, ID_Option, ID_User) VALUES (?, ?, ?)", input.PollID, input.OptionID, userID)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Vous avez déjà voté à ce sondage."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vote enregistré."})
}