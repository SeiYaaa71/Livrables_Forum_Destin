package functions

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
)

func CreateUser( db *sql.DB, Username string, Password string, Email string, PP string) (int64, error) {
	hashedPassword, err := HashPassword(Password)
	if err != nil {
		return 0, err
	}

	query := "INSERT INTO Users (Name, Mail, Passworde, PP) VALUES (?, ?, ?, ?)"
	result, err1 := db.Exec(query, Username, Email, hashedPassword, PP)

	if err1 != nil {
		log.Printf("Erreur création compte : %v", err1)
		// Il est impératif de retourner l'erreur ici pour arrêter l'exécution
		return 0, err1 
	} 
    
    fmt.Printf("Compte '%s' créé !\n", Username)
	return result.LastInsertId()
}

func CreateTopic(Title string, Description string, Tags []string, UserID int, db *sql.DB) error {
	// Convertit le tableau ["go", "sql"] en chaîne "go,sql"
	tagsStr := strings.Join(Tags, ",")
	
	query := "INSERT INTO topics (Titre, Description, Tags, ID_User) VALUES (?, ?, ?, ?)"
	_, err := db.Exec(query, Title, Description, tagsStr, UserID)

	if err != nil {
		log.Printf("Erreur création topic : %v", err)
		return err
	} else {
		fmt.Printf("Topic '%s' créé !\n", Title)
	}
	return nil
}

func CreatePost(db *sql.DB, TopicID int, Title string, Text string, UserID int) error {
	// CORRECTION : ID_Topic devient ID_Topics
	query := "INSERT INTO post (Titre, Text, ID_User, ID_Topics) VALUES (?, ?, ?, ?)"
	
	_, err := db.Exec(query, Title, Text, UserID, TopicID)

	if err != nil {
		log.Printf("Erreur création post : %v", err)
		return err
	} else {
		fmt.Printf("Post '%s' créé !\n", Title)
	}

	return nil
}

func CreateComment( db*sql.DB, PostID int, commentID int, Text string, UserID int) (error) {
	if commentID > 0 {
		// Remplacer 'Text' par le nom exact (ex: 'Texts' ou 'Texte')
		query := "INSERT INTO response (ID_User, ID_Rep, Texts) Values (?, ?, ?)"
			
		_,err := db.Exec(query, UserID, commentID, Text)

		if err != nil {
			log.Printf("Erreur création commentaire : %v", err)
			return err
		}
		fmt.Printf("Commentaire créé !\n")
		return nil
	}

	if PostID > 0 {
		// Remplacer 'Text' par le nom exact ici aussi
		query := "INSERT INTO response (ID_User, ID_Post, Texts) Values (?, ?, ?)"
		_,err := db.Exec(query, UserID, PostID, Text)

		if err != nil {
			log.Printf("Erreur création commentaire : %v", err)
			return err
		}
		fmt.Printf("Commentaire créé !\n")
		return nil
	}

	return nil
}