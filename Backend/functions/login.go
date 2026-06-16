package functions

import (
	"database/sql"
	"fmt"
)

func Login(db *sql.DB, identifiers string, password string) (int64, int, error) {
	var usersID int
	var hachedPassword string
	var role sql.NullInt64 // Gère le fait que le rôle puisse être NULL en base

	query := `
		SELECT ID, Passworde, Role 
		FROM users 
		WHERE Name = ? OR Mail = ?`

	err := db.QueryRow(query, identifiers, identifiers).Scan(
		&usersID, &hachedPassword, &role,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return 0, 0, fmt.Errorf("identifiants incorrects")
		}
		return 0, 0, err
	}

	if !CheckPasswordHash(password, hachedPassword) {
		return 0, 0, fmt.Errorf("identifiants incorrects")
	}

	return int64(usersID), int(role.Int64), nil
}