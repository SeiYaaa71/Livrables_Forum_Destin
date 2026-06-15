package functions

import (
	"database/sql"
	"fmt"
)

func Login(db *sql.DB, identifiers string, password string) (int64, error) {
	var usersID int
	var hachedPassword string

	query := `
		SELECT ID, Passworde 
		FROM users 
		WHERE Name = ? OR Mail = ?`

	err := db.QueryRow(query, identifiers, identifiers).Scan(
		&usersID, &hachedPassword,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return 0, fmt.Errorf("identifiants incorrects")
		}
		return 0, err
	}

	if !CheckPasswordHash(password, hachedPassword) {
		return 0, fmt.Errorf("identifiants incorrects")
	}

	return int64(usersID), nil
}