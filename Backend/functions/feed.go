package functions

import (
	"database/sql"
	"log"
	"strings"
	"errors"
	"math"
)

type Topics struct {
	ID          int      `json:"id"`
	UserID      int      `json:"user_id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
}

type PollInput struct {
	TopicID     int      `json:"topic_id" binding:"required"`
	Title       string   `json:"title" binding:"required"`
	Description string   `json:"description"`
	Options     []string `json:"options" binding:"required"`
}

type PollVoteInput struct {
	PollID   int `json:"poll_id" binding:"required"`
	OptionID int `json:"option_id" binding:"required"`
}

type Posts struct {
    ID     int    `json:"id"`
    UserID int    `json:"user_id"`
    Title  string `json:"title"`
    Text   string `json:"text"`
    Likes  int    `json:"likes"` // Nouveau champ pour stocker le total des likes
	UserVote int    `json:"user_vote"`
	AuthorName string `json:"author_name"`
}

type Poll struct {
	ID          int          `json:"id"`
	AuthorID    int          `json:"author_id"`
	Title       string       `json:"title"`
	Description string       `json:"description"`
	Options     []PollOption `json:"options"`
	TotalVotes  int          `json:"total_votes"`
	UserVoted   bool         `json:"user_voted"`
}

type PollOption struct {
	ID         int     `json:"id"`
	Text       string  `json:"text"`
	Votes      int     `json:"votes"`
	Percentage float64 `json:"percentage"`
	IsChoice   bool    `json:"is_choice"`
}

type Topic struct {
	ID          int      `json:"id"`
	UserID      int      `json:"user_id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
	Posts 		[]Posts  `json:"posts"`
	Polls 		[]Poll 	 `json:"polls"`
	AuthorName string `json:"author_name"`
	
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
	UserVote int    `json:"user_vote"`
	AuthorName string `json:"author_name"`
}

func AddLikes(CommentID int, PostID int, UserID int, State int, db *sql.DB) error {
	var existingState int
	var err error

	// --- GESTION DES VOTES POUR LES POSTS ---
	if PostID > 0 {
		// 1. Vérifier si un vote existe déjà
		err = db.QueryRow("SELECT State FROM likes WHERE ID_Post = ? AND ID_User = ?", PostID, UserID).Scan(&existingState)

		if err == sql.ErrNoRows {
			// Cas A : Aucun vote existant, on l'ajoute
			query := "INSERT INTO likes (ID_Post, ID_User, State) VALUES (?, ?, ?)"
			_, err = db.Exec(query, PostID, UserID, State)
			if err != nil {
				log.Printf("Erreur lors de l'ajout du like (Post) : %v", err)
				return err
			}
		} else if err == nil {
			// Cas B : Un vote existe déjà
			if existingState == State {
				// B1 : Le vote est identique, on bloque
				return errors.New("vote déjà enregistré avec cet état")
			}
			// B2 : Le vote est différent, on met à jour
			query := "UPDATE likes SET State = ? WHERE ID_Post = ? AND ID_User = ?"
			_, err = db.Exec(query, State, PostID, UserID)
			if err != nil {
				log.Printf("Erreur lors de la mise à jour du like (Post) : %v", err)
				return err
			}
		} else {
			// Erreur inattendue de la base de données
			log.Printf("Erreur lors de la vérification du like (Post) : %v", err)
			return err
		}

	// --- GESTION DES VOTES POUR LES COMMENTAIRES ---
	} else if CommentID > 0 {
		// 1. Vérifier si un vote existe déjà
		err = db.QueryRow("SELECT State FROM likes WHERE ID_Rep = ? AND ID_User = ?", CommentID, UserID).Scan(&existingState)

		if err == sql.ErrNoRows {
			// Cas A : Aucun vote existant, on l'ajoute
			query := "INSERT INTO likes (ID_Rep, ID_User, State) VALUES (?, ?, ?)"
			_, err = db.Exec(query, CommentID, UserID, State)
			if err != nil {
				log.Printf("Erreur lors de l'ajout du like (Commentaire) : %v", err)
				return err
			}
		} else if err == nil {
			// Cas B : Un vote existe déjà
			if existingState == State {
				// B1 : Le vote est identique, on bloque
				return errors.New("vote déjà enregistré avec cet état")
			}
			// B2 : Le vote est différent, on met à jour
			query := "UPDATE likes SET State = ? WHERE ID_Rep = ? AND ID_User = ?"
			_, err = db.Exec(query, State, CommentID, UserID)
			if err != nil {
				log.Printf("Erreur lors de la mise à jour du like (Commentaire) : %v", err)
				return err
			}
		} else {
			// Erreur inattendue de la base de données
			log.Printf("Erreur lors de la vérification du like (Commentaire) : %v", err)
			return err
		}
	}

	return nil
}

func GetAllTopics(db *sql.DB, viewerID int) ([]Topics, error) {
	// Requête SQL avec filtrage de confidentialité :
	// - Le sujet est public (IsPrivate = 0)
	// - OU le visiteur est l'auteur du sujet
	// - OU le visiteur est un ami confirmé de l'auteur (State = 1)
	query := `
		SELECT t.ID, t.ID_User, t.Titre, t.Description, t.Tags 
		FROM topics t
		LEFT JOIN friends f ON 
			((f.ID_User_1 = t.ID_User AND f.ID_User_2 = ?) OR 
			 (f.ID_User_2 = t.ID_User AND f.ID_User_1 = ?)) 
			AND f.State = 1
		WHERE t.IsPrivate = 0 
		   OR t.ID_User = ? 
		   OR f.ID IS NOT NULL
		ORDER BY t.ID DESC`

	// On passe trois fois viewerID pour les trois '?' de la requête
	rows, err := db.Query(query, viewerID, viewerID, viewerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var topics []Topics
	for rows.Next() {
		var t Topics
		var desc, tagsStr sql.NullString // Gestion sécurisée des champs NULL en base de données

		// Lecture des colonnes
		if err := rows.Scan(&t.ID, &t.UserID, &t.Title, &desc, &tagsStr); err != nil {
			return nil, err
		}

		// Traitement de la description
		t.Description = desc.String

		// Traitement des tags (découpage de la chaîne "go,sql" en tableau)
		if tagsStr.Valid && tagsStr.String != "" {
			t.Tags = strings.Split(tagsStr.String, ",")
		} else {
			t.Tags = []string{}
		}

		topics = append(topics, t)
	}

	// Vérification finale des erreurs après la boucle d'itération
	if err = rows.Err(); err != nil {
		return nil, err
	}

	return topics, nil
}

func GetTopicByID(db *sql.DB, topicID int, viewerID int) (Topic, error) {
	var topic Topic
	var desc, tagsStr sql.NullString
	topic.Posts = []Posts{} // Initialisation obligatoire du tableau de posts

	// 1. Récupération des détails du Topic principal avec filtrage de confidentialité
	topicQuery := `
		SELECT t.ID, t.ID_User, t.Titre, t.Description, t.Tags 
		FROM topics t
		LEFT JOIN friends f ON 
			((f.ID_User_1 = t.ID_User AND f.ID_User_2 = ?) OR 
			 (f.ID_User_2 = t.ID_User AND f.ID_User_1 = ?)) 
			AND f.State = 1
		WHERE t.ID = ? AND (t.IsPrivate = 0 OR t.ID_User = ? OR f.ID IS NOT NULL)`

	err := db.QueryRow(topicQuery, viewerID, viewerID, topicID, viewerID).Scan(
		&topic.ID, 
		&topic.UserID, 
		&topic.Title, 
		&desc, 
		&tagsStr,
	)
	
	if err != nil {
		return topic, err // Retourne sql.ErrNoRows si le topic est privé et le visiteur non autorisé
	}

	// Traitement des données potentiellement NULL
	topic.Description = desc.String
	if tagsStr.Valid && tagsStr.String != "" {
		topic.Tags = strings.Split(tagsStr.String, ",")
	} else {
		topic.Tags = []string{} 
	}

	// 2. Récupération des posts associés au topic (avec le calcul des likes et le vote utilisateur)
	postsQuery := `
		SELECT ID, ID_User, Titre, Text,
			   (SELECT COUNT(*) FROM likes WHERE likes.ID_Post = post.ID AND likes.State = 1) - 
			   (SELECT COUNT(*) FROM likes WHERE likes.ID_Post = post.ID AND likes.State = -1) as likes_count,
			   IFNULL((SELECT State FROM likes WHERE ID_Post = post.ID AND ID_User = ?), 0) as user_vote
		FROM post 
		WHERE ID_Topics = ? 
		ORDER BY likes_count DESC`

	// On passe viewerID d'abord (pour la sous-requête de vote), puis topicID
	rows, err := db.Query(postsQuery, viewerID, topicID)
	if err != nil {
		return topic, err
	}
	defer rows.Close()

	// 3. Extraction et assignation des messages récoltés
	for rows.Next() {
		var p Posts
		err := rows.Scan(
			&p.ID, 
			&p.UserID, 
			&p.Title, 
			&p.Text, 
			&p.Likes,
			&p.UserVote,
		)
		if err != nil {
			return topic, err
		}
		topic.Posts = append(topic.Posts, p)
	}

	if err = rows.Err(); err != nil {
		return topic, err
	}

	topic.Polls = []Poll{}
	pollRows, err := db.Query("SELECT ID, ID_User, Title, Description FROM polls WHERE ID_Topics = ?", topicID)
	if err == nil {
		defer pollRows.Close()
		for pollRows.Next() {
			var poll Poll
			var desc sql.NullString
			pollRows.Scan(&poll.ID, &poll.AuthorID, &poll.Title, &desc)
			poll.Description = desc.String

			// Vérifier si l'utilisateur a voté
			var userChoice int
			err := db.QueryRow("SELECT ID_Option FROM poll_votes WHERE ID_Poll = ? AND ID_User = ?", poll.ID, viewerID).Scan(&userChoice)
			poll.UserVoted = (err == nil)

			// Récupérer les options et calculer les votes
			optRows, _ := db.Query("SELECT ID, OptionText, (SELECT COUNT(*) FROM poll_votes WHERE ID_Option = poll_options.ID) as votes FROM poll_options WHERE ID_Poll = ?", poll.ID)
			defer optRows.Close()
			
			poll.TotalVotes = 0
			for optRows.Next() {
				var opt PollOption
				optRows.Scan(&opt.ID, &opt.Text, &opt.Votes)
				poll.TotalVotes += opt.Votes
				opt.IsChoice = (opt.ID == userChoice)
				poll.Options = append(poll.Options, opt)
			}

			// Calcul des pourcentages si l'utilisateur a voté
			if poll.UserVoted && poll.TotalVotes > 0 {
				for i := range poll.Options {
					poll.Options[i].Percentage = math.Round((float64(poll.Options[i].Votes)/float64(poll.TotalVotes))*100*10) / 10
				}
			} else {
				// Cacher les votes si non voté
				for i := range poll.Options {
					poll.Options[i].Votes = 0
					poll.Options[i].Percentage = 0
				}
			}
			topic.Polls = append(topic.Polls, poll)
		}
	}

	return topic, nil
	
}

func GetPostDetails(db *sql.DB, postID int, userID int) (PostDetail, error) {
	var detail PostDetail
	detail.Comments = []CommentResponse{}

	// 1. Récupération du message d'origine avec le vote utilisateur
	postQuery := `
		SELECT ID, ID_User, Titre, Text,
			   (SELECT COUNT(*) FROM likes WHERE ID_Post = post.ID AND State = 1) -
			   (SELECT COUNT(*) FROM likes WHERE ID_Post = post.ID AND State = -1) as likes_count,
			   IFNULL((SELECT State FROM likes WHERE ID_Post = post.ID AND ID_User = ?), 0) as user_vote
		FROM post WHERE ID = ?`
		
	err := db.QueryRow(postQuery, userID, postID).Scan(
		&detail.Post.ID, 
		&detail.Post.UserID, 
		&detail.Post.Title, 
		&detail.Post.Text, 
		&detail.Post.Likes,
		&detail.Post.UserVote,
	)
	if err != nil {
		return detail, err
	}

	// 2. Récupération des commentaires avec le vote utilisateur
	commentsQuery := `
		SELECT ID, ID_User, IFNULL(ID_Rep, 0), Texts,
			   (SELECT COUNT(*) FROM likes WHERE likes.ID_Rep = response.ID AND likes.State = 1) -
			   (SELECT COUNT(*) FROM likes WHERE likes.ID_Rep = response.ID AND likes.State = -1) as likes_count,
			   IFNULL((SELECT State FROM likes WHERE ID_Rep = response.ID AND ID_User = ?), 0) as user_vote
		FROM response 
		WHERE ID_Post = ? OR ID_Rep IN (SELECT ID FROM response WHERE ID_Post = ?)`
		
	// userID en premier, puis postID deux fois
	rows, err := db.Query(commentsQuery, userID, postID, postID)
	if err != nil {
		return detail, err
	}
	defer rows.Close()

	// 3. Extraction
	for rows.Next() {
		var c CommentResponse
		if err := rows.Scan(&c.ID, &c.UserID, &c.IDRep, &c.Text, &c.Likes, &c.UserVote); err != nil {
			return detail, err
		}
		detail.Comments = append(detail.Comments, c)
	}

	if err = rows.Err(); err != nil {
		return detail, err
	}

	return detail, nil
}
