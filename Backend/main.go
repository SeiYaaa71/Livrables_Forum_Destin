package main

import (
	"database/sql"
	"fmt"
	"log"
	"Backend/router"

	// Import du driver MySQL obligatoire (le "_" permet d'exécuter l'init du package)
	_ "github.com/go-sql-driver/mysql"
)

func main() {
	// Connexion DB
	db, err := sql.Open("mysql", "root:root@tcp(127.0.0.1:3306)/forum")
	if err != nil {
		log.Fatal("Erreur de connexion à la base de données: ", err)
	}
	defer db.Close()

	// Initialisation du routeur via notre fichier router.go
	r := router.SetupRouter(db)

	// Affichage du log avant le blocage
	fmt.Println("Serveur lancé sur http://localhost:3000")

	// Lancement et gestion d'une éventuelle erreur
	if err := r.Run(":3000"); err != nil {
		log.Fatal("Erreur au lancement du serveur: ", err)
	}
}