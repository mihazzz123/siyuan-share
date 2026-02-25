package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"log"

	"github.com/mihazzz123/siyuan-share/models"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	username := flag.String("username", "", "Имя пользователя")
	email := flag.String("email", "", "Email")
	password := flag.String("password", "", "Пароль (минимум 6 символов)")
	tokenName := flag.String("token-name", "", "Опционально: создать API токен с тем же именем")
	flag.Parse()

	if *username == "" || *email == "" || *password == "" {
		log.Fatal("Укажите имя пользователя, email и пароль: -username <имя> -email <почта> -password <пароль>")
	}

	if len(*password) < 6 {
		log.Fatal("Длина пароля минимум 6 символов")
	}

	if err := models.InitDB(); err != nil {
		log.Fatalf("Ошибка инициализации базы данных: %v", err)
	}

	// Хэш пароля
	hash, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Хэш пароляОшибка: %v", err)
	}

	userID := generateUserID()
	user := &models.User{
		ID:           userID,
		Username:     *username,
		Email:        *email,
		PasswordHash: string(hash),
		IsActive:     true,
	}
	if err := models.DB.Create(user).Error; err != nil {
		log.Fatalf("Ошибка создания пользователя: %v", err)
	}

	fmt.Println("✅ Пользователь успешно создан!")
	fmt.Println("====================")
	fmt.Printf("ID пользователя: %s\n", userID)
	fmt.Printf("Имя пользователя: %s\n", *username)
	fmt.Printf("Email: %s\n", *email)

	if *tokenName != "" {
		raw := generateAPIToken()
		hash := sha256.Sum256([]byte(raw))
		ut := &models.UserToken{ID: "tok_" + generateShortID(), UserID: userID, Name: *tokenName, TokenHash: hex.EncodeToString(hash[:])}
		if err := models.DB.Create(ut).Error; err != nil {
			log.Fatalf("Ошибка создания API токена: %v", err)
		}
		fmt.Printf("Начальный API Token（%s）: %s\n", *tokenName, raw)
	}
	fmt.Println("====================")
	fmt.Println("Совет: дополнительные API токены можно создавать/обновлять/отзывать в веб-интерфейсе.")
}

func generateAPIToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func generateUserID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return "user_" + hex.EncodeToString(b)
}

func generateShortID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
