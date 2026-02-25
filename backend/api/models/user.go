package models

import (
	"time"

	"gorm.io/gorm"
)

// User Модель пользователя
type User struct {
	ID           string         `gorm:"primaryKey;size:64" json:"id"`
	Username     string         `gorm:"size:100;uniqueIndex" json:"username"`
	Email        string         `gorm:"size:255;uniqueIndex" json:"email"`
	PasswordHash string         `gorm:"size:255" json:"-"` // Хэш пароля
	IsActive     bool           `gorm:"default:true" json:"isActive"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	Tokens       []UserToken    `json:"-"` // Связанные API токены
}

// TableName Указание имени таблицы
func (User) TableName() string {
	return "users"
}

// UserToken API токены пользователя (поддержка нескольких токенов)
type UserToken struct {
	ID         string         `gorm:"primaryKey;size:64" json:"id"`
	UserID     string         `gorm:"index;size:64" json:"userId"`
	Name       string         `gorm:"size:100" json:"name"`          // Псевдоним токена для идентификации
	TokenHash  string         `gorm:"size:255;uniqueIndex" json:"-"` // Хранение хэша во избежание утечки открытого текста
	PlainToken string         `gorm:"-" json:"token,omitempty"`      // Возвращается только при создании/обновлении, не сохраняется в БД
	Revoked    bool           `gorm:"default:false" json:"revoked"`  // Отозван ли
	LastUsedAt *time.Time     `json:"lastUsedAt,omitempty"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (UserToken) TableName() string { return "user_tokens" }
