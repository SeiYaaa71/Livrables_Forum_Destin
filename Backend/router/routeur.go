package router

import (
	"database/sql"
	"Backend/functions"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(db *sql.DB) *gin.Engine {
	r := gin.Default()

	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	// On ajoute X-User-Id dans les headers autorisés
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization", "X-User-Id"}
	
	r.Use(cors.New(config))

	userRoutes := r.Group("/users")
	{
		userRoutes.POST("/register", func(c *gin.Context) { functions.RegisterHandler(c, db) })
		userRoutes.POST("/login", func(c *gin.Context) { functions.LoginHandler(c, db) })
		userRoutes.GET("/:id", func(c *gin.Context) { functions.GetUserProfileHandler(c, db) })
	}

	// 1. Routes Publiques (Tout le monde peut voir)
	r.GET("/topics", functions.GetAllTopicsHandler(db))
	r.GET("/topics/:id", functions.GetTopicByIDHandler(db))
	r.GET("/posts/:id", functions.GetPostByIDHandler(db))

	// 2. Routes Protégées (Nécessitent le Middleware d'authentification)
	protected := r.Group("/")
	protected.Use(functions.AuthMiddleware(db)) // <-- Le vigile est ici
	{
		protected.POST("/topics", func(c *gin.Context) { functions.TopicHandler(c, db) })
		protected.POST("/posts", func(c *gin.Context) { functions.PostHandler(c, db) })
		protected.POST("/comments", func(c *gin.Context) { functions.CommentHandler(c, db) })
		protected.POST("/likes", func(c *gin.Context) { functions.AddLikesHandler(c, db) })
		protected.POST("/friends", func(c *gin.Context) { functions.FriendActionHandler(c, db) })
		protected.GET("/friends/pending", func(c *gin.Context) { functions.GetPendingRequestsHandler(c, db) })
		protected.POST("/admin/ban", func(c *gin.Context) { functions.BanUserHandler(c, db) })
		protected.POST("/moderate/archive", func(c *gin.Context) { functions.ArchiveTopicHandler(c, db) })
		protected.POST("/moderate/delete", func(c *gin.Context) { functions.DeleteContentHandler(c, db) })
		protected.POST("/polls", func(c *gin.Context) { functions.CreatePollHandler(c, db) })
		protected.POST("/polls/vote", func(c *gin.Context) { functions.VotePollHandler(c, db) })
	}

	return r
}