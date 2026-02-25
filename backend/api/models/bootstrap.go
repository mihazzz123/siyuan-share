package models

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"os"
	"path/filepath"
	"time"
)

// BootstrapToken Одноразовый токен инициализации
type BootstrapToken struct {
	ID        string    `gorm:"primaryKey;size:64" json:"id"`
	Token     string    `gorm:"size:255;uniqueIndex" json:"-"`
	ExpiresAt time.Time `json:"expiresAt"`
	Used      bool      `gorm:"default:false" json:"used"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (BootstrapToken) TableName() string { return "bootstrap_tokens" }

// EnsureBootstrapToken Генерация при отсутствии пользователейОдноразовый токен инициализации
func EnsureBootstrapToken() (*BootstrapToken, error) {
	var count int64
	if err := DB.Model(&User{}).Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, nil
	}

	// Поиск неиспользованных и неистекших токенов
	var bt BootstrapToken
	err := DB.Where("used = ? AND expires_at > ?", false, time.Now()).First(&bt).Error
	if err == nil {
		return &bt, nil
	}

	// Генерация нового токена, срок действия 15 минут
	token := randomHex(32)
	bt = BootstrapToken{
		ID:        randomHex(16),
		Token:     token,
		ExpiresAt: time.Now().Add(15 * time.Minute),
		Used:      false,
	}
	if err := DB.Create(&bt).Error; err != nil {
		return nil, err
	}

	// Запись токена в файл данных для удобства администратора
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}
	_ = os.MkdirAll(dataDir, 0755)
	path := filepath.Join(dataDir, "bootstrap_token.txt")
	_ = os.WriteFile(path, []byte(token+"\n"), 0600)
	log.Printf("Bootstrap token generated. Expires in 15m. File: %s", path)
	return &bt, nil
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
