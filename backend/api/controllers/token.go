package controllers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"

	"com/mihazzz123/siyuan-share-api/models"
	"github.com/gin-gonic/gin"
)

type CreateTokenRequest struct {
	Name string `json:"name" binding:"required,min=1,max=100"`
}

// ListTokens Список активных токенов текущего пользователя (без открытого текста)
func ListTokens(c *gin.Context) {
	userID := c.GetString("userID")
	var tokens []models.UserToken
	if err := models.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&tokens).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "msg": "Failed to list tokens: " + err.Error()})
		return
	}
	// Глубокое копирование с удалением чувствительных полей
	list := make([]gin.H, 0, len(tokens))
	for _, t := range tokens {
		list = append(list, gin.H{
			"id": t.ID, "name": t.Name, "revoked": t.Revoked, "lastUsedAt": t.LastUsedAt, "createdAt": t.CreatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": gin.H{"items": list}})
}

// CreateToken Создание нового API токена (возвращается один раз в открытом виде)
func CreateToken(c *gin.Context) {
	userID := c.GetString("userID")
	var req CreateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "msg": "Invalid request: " + err.Error()})
		return
	}
	raw := randomToken(32)
	hash := hashToken(raw)
	ut := &models.UserToken{
		ID:        "tok_" + randomToken(12),
		UserID:    userID,
		Name:      req.Name,
		TokenHash: hash,
	}
	if err := models.DB.Create(ut).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "msg": "Failed to save token: " + err.Error()})
		return
	}
	ut.PlainToken = raw
	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": gin.H{
		"id": ut.ID, "name": ut.Name, "token": ut.PlainToken, "createdAt": ut.CreatedAt,
	}})
}

// RefreshToken Обновление токена (новый текст, сохранение записи)
func RefreshToken(c *gin.Context) {
	userID := c.GetString("userID")
	id := c.Param("id")
	var ut models.UserToken
	if err := models.DB.Where("id = ? AND user_id = ? AND revoked = ?", id, userID, false).First(&ut).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 1, "msg": "Token not found"})
		return
	}
	raw := randomToken(32)
	hash := hashToken(raw)
	ut.TokenHash = hash
	if err := models.DB.Save(&ut).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "msg": "Failed to refresh token: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": gin.H{"id": ut.ID, "name": ut.Name, "token": raw}})
}

// RevokeToken Отзыв токена
func RevokeToken(c *gin.Context) {
	userID := c.GetString("userID")
	id := c.Param("id")
	result := models.DB.Model(&models.UserToken{}).Where("id = ? AND user_id = ? AND revoked = ?", id, userID, false).Update("revoked", true)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "msg": "Failed to revoke token: " + result.Error.Error()})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"code": 1, "msg": "Token not found or already revoked"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success"})
}

func randomToken(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func hashToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}
