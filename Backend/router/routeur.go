package router

import (
	"database/sql"
	"github.com/gin-gonic/gin"
	"github.com/gin-contrib/cors"
	"Backend/functions"
)

func SetupRouter(db *sql.DB) *gin.Engine {
	r := gin.Default()

	// Configuration CORS explicite
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true // Autorise toutes les origines (ex: port 5500)
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	
	r.Use(cors.New(config))

	// Groupe de routes pour les utilisateurs
	userRoutes := r.Group("/users")
	{
		userRoutes.POST("/register", func(c *gin.Context) { 
			functions.RegisterHandler(c, db) 
		})

		userRoutes.POST("/login", func(c *gin.Context) {
			functions.LoginHandler(c, db)
		})
	}

	// Exemple pour vos autres routes (à conserver si vous les aviez déjà)
	// r.GET("/topics", functions.GetAllTopicsHandler(db))
	// r.GET("/topics/:id", functions.GetTopicByIDHandler(db))
	// r.POST("/topics", func(c *gin.Context) { functions.TopicHandler(c, db) })
	// r.POST("/posts", func(c *gin.Context) { functions.PostHandler(c, db) })
	// r.GET("/posts/:id", functions.GetPostByIDHandler(db))

	return r
}