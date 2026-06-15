package router

import (
	"database/sql"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"Backend/functions"
)

func SetupRouter(db *sql.DB) *gin.Engine {
	r := gin.Default()

	// --- CORS ---
	// AllowAllOrigins est incompatible avec AllowCredentials=true.
	// Le front n'utilise pas de cookie cross-site indispensable ici,
	// donc on autorise toutes les origines sans credentials.
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	r.Use(cors.New(config))

	// =========================================================
	//  API : préfixe /api pour coller au front (js/api.js)
	// =========================================================
	apiGroup := r.Group("/api")
	{
		// ---- Comptes ----
		apiGroup.POST("/register", func(c *gin.Context) { functions.RegisterHandler(c, db) })
		apiGroup.POST("/login", func(c *gin.Context) { functions.LoginHandler(c, db) })

		// ---- Topics ----
		apiGroup.GET("/topics", functions.GetAllTopicsHandler(db))
		apiGroup.GET("/topics/:id", functions.GetTopicByIDHandler(db))
		apiGroup.POST("/topics", func(c *gin.Context) { functions.TopicHandler(c, db) })

		// ---- Posts ----
		apiGroup.POST("/topics/:id/posts", func(c *gin.Context) { functions.PostHandler(c, db) })
		apiGroup.GET("/posts/:id", functions.GetPostByIDHandler(db))

		// ---- Réponses / commentaires ----
		apiGroup.POST("/posts/:id/responses", func(c *gin.Context) { functions.CommentHandler(c, db) })

		// ---- Votes / likes ----
		apiGroup.POST("/posts/:id/vote", func(c *gin.Context) { functions.AddLikesHandler(c, db) })
		apiGroup.POST("/responses/:id/vote", func(c *gin.Context) { functions.AddLikesHandler(c, db) })

		// ---- Profil ----
		apiGroup.GET("/users/:id", func(c *gin.Context) { functions.GetUserProfileHandler(c, db) })
	}

	// =========================================================
	//  Compat : anciennes routes /users/* conservées
	// =========================================================
	userRoutes := r.Group("/users")
	{
		userRoutes.POST("/register", func(c *gin.Context) { functions.RegisterHandler(c, db) })
		userRoutes.POST("/login", func(c *gin.Context) { functions.LoginHandler(c, db) })
	}

	return r
}
