package functions

import (
	"database/sql"
	"fmt"
	"log"
)

func CreateUser(Username string, Password string, Email string, db *sql.DB) {
	hashedPassword, err := HashPassword(Password)
	if err != nil {
		return
	}

	query := "INSERT INTO Users (Name, Mail, Passworde) VALUES (?, ?, ?)"
	_, err1 := db.Exec(query, Username, Email, hashedPassword)

	if err1 != nil {
		log.Printf("Erreur création compte : %v", err1)
	} else {
		fmt.Printf("Compte '%s' créé !\n", Username)
	}
}

func CreateTopic(Title string, UserID int, db*sql.DB) {
	query := "INSTERT INTO topics (Titre, ID_User) Values (?, ?)"

	_,err := db.Exec(query, Title, UserID,)

	if err != nil {
		log.Printf("Erreur création topic : %v", err)
	} else {
		fmt.Printf("Topic '%s' créé !\n", Title)
	}
}

func CreatePost(TopicID int, Title string, Text string, UserID int, db*sql.DB) {

	query := "INSERT INTO post (Titre, Text, ID_User, ID_Topic) Values (?, ?, ?, ?)"
	_,err := db.Exec(query, Title, Text, UserID, TopicID)

	if err != nil {
		log.Printf("Erreur création post : %v", err)
	} else {
		fmt.Printf("Post '%s' créé !\n", Title)
	}
}

func CreateComment(PostID int, commentID int, Text string, UserID int, db*sql.DB) {
	if commentID > 0 {
		query := "INSERT INTO response (ID_User, ID_Rep, Text) Values (?, ?, ?)"
			
		_,err := db.Exec(query, UserID, commentID, Text)

		if err != nil {
			log.Printf("Erreur création commentaire : %v", err)
		} else {
			fmt.Printf("Commentaire créé !\n")
		}

		return
	}

	if PostID > 0 {
		query := "INSERT INTO response (ID_User, ID_Post, Text) Values (?, ?, ?)"
		_,err := db.Exec(query, UserID, PostID, Text)

		if err != nil {
			log.Printf("Erreur création commentaire : %v", err)
		} else {
			fmt.Printf("Commentaire créé !\n")
		}
	}
}
