package main

import (
	"fmt"
	"net/http"
)

func main() {
	r := routeur.New()

	fmt.Println("serveur démare sur http://localhost:3000")
	http.ListenAndServe(":3000", r)
}
