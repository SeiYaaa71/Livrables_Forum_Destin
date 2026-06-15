package functions

import (
	"database/sql"
	"net/http"
	"github.com/gin-gonic/gin"
	"strconv"
)

type RegisterInput struct {
	Name     string `json:"Name" binding:"required"`
	Email    string `json:"Mail" binding:"required,email"`
	Password string `json:"Passworde" binding:"required"`
	PP		 string `json:"PP"`
}

type TopicINput struct {
	UserID int		`json:"ID_User" binding:"required"`
	Title string	`json:"Nom" binding:"required"`
}

type PosteInput struct {
	TopicID 	int		`json:"ID_Topics" binding:"required"`
	UserID 		int		`json:"ID_User" binding:"required"`
	Title 		string	`json:"Titre" binding:"required"`
	Text 		string	`json:"Text" binding:"required"`
}

type CommentInput struct {
	PostID		int		`json:"ID_Post"`
	CommentID	int		`json:"ID_Rep"`
	UserID		int		`json:"ID_User"`
	Text		string	`json:"Texts" binding:"required"`
}

type LoginInput struct {
	Identifiers 	string  `json:"identifiers" binding:"required"`
	Password		string	`json:"password" binding:"required"`
}

type LikeInput struct {
	UserID 		int		`json:"UserId" binding:"required"`
	PostId		int		`json:"PostID"`
	CommentID	int		`json:"CommentID"`
	State		int 	`json:"State"`
}

func RegisterHandler(c *gin.Context, db *sql.DB) {
	var input RegisterInput

	// Étape 1 : Lire et valider le JSON
	// ShouldBindJSON vérifie si les données reçues correspondent à RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Données invalides ou incomplètes"})
		return // On arrête tout si les données sont mauvaises
	}

	// Étape 2 : Appeler ta base de données
	// On utilise la fonction CreateUser que tu as déjà codée
	newID, err := CreateUser(db, input.Name, input.Password, input.Email, input.PP)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Impossible de créer l'utilisateur"})
		return
	}

	// Étape 3 : Renvoyer la réponse de succès
	c.JSON(http.StatusCreated, gin.H{
		"message": "Utilisateur créé avec succès",
		"userID":  newID,
	})
}

func TopicHandler(c *gin.Context, db *sql.DB) {
	var input TopicINput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Donné invalide ou incomplètes"})
		return
	}

	err := CreateTopic(input.Title, input.UserID, db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de créer le topic"})
		return
	}

	c.JSON(http.StatusCreated, gin.H {
		"message": "Topic créer avec succès",
	})
}


func PostHandler(c *gin.Context, db *sql.DB) {
	var input PosteInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "donné invalide ou incomplètes"})
		return
	}


	err := CreatePost(db, input.TopicID, input.Title, input.Text, input.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Impossible de créer le Post"})
		return
	}

	c.JSON(http.StatusCreated, gin.H {
		"message": "Poste créer avec succès",
	})
}

func CommentHandler(c *gin.Context, db *sql.DB) {
	var input CommentInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "donné incomplète ou invalide"})
		return
	}

	err := CreateComment(db, input.PostID, input.CommentID, input.Text, input.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Impossible de créer le comentaire"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "commentaire créer avec succès",
	})
}

func LoginHandler(c *gin.Context, db *sql.DB) {
	var input LoginInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "donné invalide ou incomplète"})
		return // Arrête l'exécution si les données sont mauvaises
	}

	u, err := Login(db, input.Identifiers, input.Password) 
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "impossible de login",
		})
		return // Arrête l'exécution si la connexion échoue
	}

	c.JSON(http.StatusOK, gin.H {
		"message" : "Conection effectué",
		"IdUser"  :  u,
	})
}



func AddLikesHandler(c *gin.Context, db *sql.DB) {
	var input LikeInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "donnés invalide ou incomplète"})
		return
	}

	err := AddLikes(input.CommentID, input.PostId, input.UserID, input.State, db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "impossible d'ajouter un like",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H {
		"message" : "Like Ajouté",  
	})
}

func GetAllTopicsHandler(db *sql.DB) gin.HandlerFunc {
    
    // Elle retourne le vrai handler que Gin va exécuter
    return func(c *gin.Context) {
        Topics, err := GetAllTopics(db)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la récupération des topics"})
            return
        }

        c.JSON(http.StatusOK, gin.H{
            "message" : "Topics récupérés",
            "Topics"  : Topics,
        })
    }
}

func GetTopicByIDHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idString := c.Param("id")

		topicID, err := strconv.Atoi(idString)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "L'ID du topic doit être un nombre valide",
			})
			return
		}

		topicDetail, err := GetTopicByID(db, topicID)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{
					"error": "Topic introuvable",
				})
				return
			}
			
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Erreur lors de la récupération des données",
			})
			return
		}
		c.JSON(http.StatusOK, topicDetail)
	}
}

func GetUserProfileHandler(c *gin.Context, db *sql.DB) {
	idParam := c.Param("id")

	var name, mail, pp string
	var id int

	query := "SELECT ID, Name, Mail, PP FROM Users WHERE ID = ?"
	err := db.QueryRow(query, idParam).Scan(&id, &name, &mail, &pp)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Utilisateur introuvable"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":   id,
		"name": name,
		"mail": mail,
		"pp":   pp,
	})
}

func GetPostByIDHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idString := c.Param("id")
		
		postID, err := strconv.Atoi(idString)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "L'ID du post doit être un nombre valide"})
			return
		}

		postDetail, err := GetPostDetails(db, postID)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Post introuvable"})
				return
			}
			
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la récupération des données"})
			return
		}
		
		c.JSON(http.StatusOK, postDetail)
	}
}
