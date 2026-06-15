package functions

import (
	"database/sql"
	"log"
)

type Topics struct {
	ID 		int 	`json:"id"`
    UserID 	int    	`json:"user_id"`
    Title  	string 	`json:"title"`
}

type Posts struct {
    ID     int    `json:"id"`
    UserID int    `json:"user_id"`
    Title  string `json:"title"`
    Text   string `json:"text"`
    Likes  int    `json:"likes"` // Nouveau champ pour stocker le total des likes
}

type Topic struct {
	ID 		int 	`json:"id"`
    UserID 	int    	`json:"user_id"`
    Title  	string 	`json:"title"`
	Posts	[]Posts	`json:"posts"`

}

type PostDetail struct {
	Post     Posts             `json:"post"`
	Comments []CommentResponse `json:"comments"`
}

type CommentResponse struct {
	ID     int    `json:"id"`
	IDRep  int    `json:"id_rep"`
	UserID int    `json:"user_id"`
	Text   string `json:"text"`
	Likes  int    `json:"likes"`
}

func AddLikes(CommentID int, PostID int, UserID int, State int, db *sql.DB) (error) {
	if PostID > 0 {
		query := "INSERT INTO likes (ID_Post, ID_User, State) VALUES (?, ?, ?)"

		_, err := db.Exec(query, PostID, UserID, State)
		if err != nil {
			log.Printf("Erreur lors de l'ajout du like : %v", err)
			return err
		}
	} else if CommentID > 0 {
		query := "INSERT INTO likes (ID_Rep, ID_User, State) VALUES (?, ?, ?)"

		_, err := db.Exec(query, CommentID, UserID, State)
		if err != nil {
			log.Printf("Erreur lors de l'ajout du like : %v", err)
			return err
		}
	}

	return nil
	
}

func GetAllTopics(db *sql.DB) ([]Topics, error) {
    // 1. Exécuter la requête (Ajuste les noms de colonnes selon ta BDD)
    rows, err := db.Query("SELECT id, user_id, title FROM Topics")
    if err != nil {
        return nil, err
    }

    defer rows.Close()

    var topics []Topics

    for rows.Next() {
        var t Topics
        if err := rows.Scan(&t.ID, &t.UserID, &t.Title); err != nil {
            return nil, err
        }

        topics = append(topics, t)
    }

    if err = rows.Err(); err != nil {
        return nil, err
    }

    if topics == nil {
        topics = []Topics{}
    }

    return topics, nil
}

func GetTopicByID(db *sql.DB, topicID int) (Topic, error) {
    var topic Topic
    topic.Posts = []Posts{} 

    err := db.QueryRow("SELECT id, user_id, title FROM Topics WHERE id = ?", topicID).
        Scan(&topic.ID, &topic.UserID, &topic.Title)
    
    if err != nil {
        return topic, err
    }

    // Sélection avec jointure ou sous-requête pour compter les likes et trier par ce compte décroissant
    rows, err := db.Query(`
        SELECT id, user_id, title, text,
               (SELECT COUNT(*) FROM likes WHERE likes.ID_Post = Posts.id AND likes.State = 1) as likes_count
        FROM Posts 
        WHERE topic_id = ?
        ORDER BY likes_count DESC`, topicID)
    if err != nil {
        return topic, err
    }
    defer rows.Close()

    for rows.Next() {
        var p Posts
        // Ajout du scan de la variable p.Likes
        if err := rows.Scan(&p.ID, &p.UserID, &p.Title, &p.Text, &p.Likes); err != nil {
            return topic, err
        }
        topic.Posts = append(topic.Posts, p)
    }

    if err = rows.Err(); err != nil {
        return topic, err
    }

    return topic, nil
}

func GetPostDetails(db *sql.DB, postID int) (PostDetail, error) {
	var detail PostDetail
	detail.Comments = []CommentResponse{} // Initialisation du tableau

	// 1. Récupération du Post et de ses likes
	postQuery := `
		SELECT ID, ID_User, Titre, Text,
			   (SELECT COUNT(*) FROM likes WHERE ID_Post = post.ID AND State = 1) as likes_count
		FROM post WHERE ID = ?`
		
	err := db.QueryRow(postQuery, postID).Scan(
		&detail.Post.ID, &detail.Post.UserID, &detail.Post.Title, &detail.Post.Text, &detail.Post.Likes,
	)
	if err != nil {
		return detail, err
	}

	// 2. Récupération des commentaires via CTE récursive
	commentsQuery := `
		WITH RECURSIVE CommentTree AS (
			-- Étape de base : les commentaires liés directement au post
			SELECT ID, ID_User, 0 AS ID_Rep, Text
			FROM response WHERE ID_Post = ?
			
			UNION ALL
			
			-- Étape récursive : les réponses liées aux commentaires de l'arbre
			SELECT r.ID, r.ID_User, r.ID_Rep, r.Text
			FROM response r
			INNER JOIN CommentTree ct ON r.ID_Rep = ct.ID
		)
		-- Sélection finale avec le compte des likes pour chaque commentaire
		SELECT ID, ID_User, ID_Rep, Text,
			   (SELECT COUNT(*) FROM likes WHERE likes.ID_Rep = CommentTree.ID AND likes.State = 1) as likes_count
		FROM CommentTree`
		
	rows, err := db.Query(commentsQuery, postID)
	if err != nil {
		return detail, err
	}
	defer rows.Close()

	// Lecture des résultats
	for rows.Next() {
		var c CommentResponse
		if err := rows.Scan(&c.ID, &c.UserID, &c.IDRep, &c.Text, &c.Likes); err != nil {
			return detail, err
		}
		detail.Comments = append(detail.Comments, c)
	}

	return detail, nil
}

