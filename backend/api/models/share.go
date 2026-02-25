package models

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

// Share Модель записи публикации
type Share struct {
	ID string `gorm:"primaryKey;size:64" json:"id"`
	// Составной индекс для ускорения запросов и пагинации user+doc с поддержкой сортировки по времени
	UserID          string         `gorm:"size:64;index:idx_user_doc,priority:1;index:idx_user_created,priority:1" json:"userId"`
	DocID           string         `gorm:"size:64;index:idx_user_doc,priority:2" json:"docId"`
	DocTitle        string         `gorm:"size:255" json:"docTitle"`
	Content         string         `gorm:"type:text" json:"content"`
	References      string         `gorm:"type:text" json:"references"`        // JSON строка для хранения информации о ссылаемых блоках
	ParentShareID   string         `gorm:"size:64;index" json:"parentShareId"` // ID родительской публикации (используется для ссылаемых блоков)
	RequirePassword bool           `gorm:"default:false" json:"requirePassword"`
	PasswordHash    string         `gorm:"size:255" json:"-"` // Не отображать в JSON
	ExpireAt        time.Time      `gorm:"index" json:"expireAt"`
	IsPublic        bool           `gorm:"default:true" json:"isPublic"`
	ViewCount       int            `gorm:"default:0" json:"viewCount"`
	CreatedAt       time.Time      `gorm:"index:idx_user_created,priority:2" json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

// BlockReference Информация о ссылаемом блоке
type BlockReference struct {
	BlockID     string `json:"blockId"`
	Content     string `json:"content"`
	DisplayText string `json:"displayText,omitempty"`
	RefCount    int    `json:"refCount,omitempty"`
}

// TableName Указание имени таблицы
func (Share) TableName() string {
	return "shares"
}

// IsExpired Проверка срока действия публикации
func (s *Share) IsExpired() bool {
	return time.Now().After(s.ExpireAt)
}

// FindActiveShareByDoc Поиск последней активной публикации документа пользователя
func FindActiveShareByDoc(userID, docID string) (*Share, error) {
	var share Share
	err := DB.Where("user_id = ? AND doc_id = ?", userID, docID).
		Order("created_at DESC").
		First(&share).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &share, nil
}

// DeleteSharesByUser Удаление всех публикаций пользователя
func DeleteSharesByUser(userID string) (int64, error) {
	res := DB.Where("user_id = ?", userID).Delete(&Share{})
	return res.RowsAffected, res.Error
}
