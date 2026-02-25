package controllers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

	"github.com/mihazzz123/siyuan-share/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// GetShare Получение содержимого публикации
func GetShare(c *gin.Context) {
	shareID := c.Param("id")

	var share models.Share
	if err := models.DB.Where("id = ?", shareID).First(&share).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"code": 1,
			"msg":  "Share not found",
		})
		return
	}

	// Проверка срока действия
	if share.IsExpired() {
		c.JSON(http.StatusGone, gin.H{
			"code": 1,
			"msg":  "Share has expired",
		})
		return
	}

	// Если требуется пароль, проверка пароля
	if share.RequirePassword {
		password := c.Query("password")
		if password == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": 1,
				"msg":  "Password required",
			})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(share.PasswordHash), []byte(password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": 1,
				"msg":  "Invalid password",
			})
			return
		}
	}

	// Увеличение количества просмотров
	models.DB.Model(&share).UpdateColumn("view_count", share.ViewCount+1)

	// Обработка замены ссылок на блоки
	content := share.Content
	if share.References != "" {
		var refs []models.BlockReference
		if err := json.Unmarshal([]byte(share.References), &refs); err == nil {
			// Получение baseURL для построения ссылок на блоки
			baseURL := getBaseURL(c)
			content = replaceBlockReferences(content, refs, baseURL, share.UserID)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
		"data": gin.H{
			"id":              share.ID,
			"docTitle":        share.DocTitle,
			"content":         content,
			"requirePassword": share.RequirePassword,
			"expireAt":        share.ExpireAt,
			"viewCount":       share.ViewCount + 1,
			"createdAt":       share.CreatedAt,
		},
	})
}

// getBaseURL Получение базового URL
func getBaseURL(c *gin.Context) string {
	baseURL := c.GetHeader("X-Base-URL")
	if baseURL == "" {
		proto := c.GetHeader("X-Forwarded-Proto")
		host := c.GetHeader("X-Forwarded-Host")
		if proto == "" {
			if c.Request.TLS != nil {
				proto = "https"
			} else {
				proto = "http"
			}
		}
		if host == "" {
			host = c.Request.Host
		}
		baseURL = proto + "://" + strings.TrimSuffix(host, "/")
	}
	return strings.TrimSuffix(baseURL, "/")
}

// replaceBlockReferences Замена ссылок на блоки в контенте на URL этих блоков
func replaceBlockReferences(content string, refs []models.BlockReference, baseURL string, userID string) string {
	// Построение карты ID блока к контенту
	blockMap := make(map[string]models.BlockReference)
	for _, ref := range refs {
		blockMap[ref.BlockID] = ref
	}

	// Соответствие ссылке на блок: ((blockId)) или ((blockId "text")) или ((blockId 'text'))
	blockRefPattern := regexp.MustCompile(`\(\(([0-9]{14,}-[0-9a-z]{7,})(?:\s+["']([^"']+)["'])?\)\)`)

	result := blockRefPattern.ReplaceAllStringFunc(content, func(match string) string {
		matches := blockRefPattern.FindStringSubmatch(match)
		if len(matches) < 2 {
			return match
		}

		blockID := matches[1]
		displayText := ""
		if len(matches) > 2 {
			displayText = matches[2]
		}

		// Поиск информации о ссылаемом блоке
		ref, exists := blockMap[blockID]
		if !exists {
			// Ссылаемый блок не найден, сохранение текста или использование по умолчанию
			if displayText != "" {
				return displayText
			}
			return "[ссылка]"
		}

		// Поиск записи публикации для этого блока
		var blockShare models.Share
		err := models.DB.Where("user_id = ? AND doc_id = ?", userID, blockID).
			Order("created_at DESC").
			First(&blockShare).Error

		if err != nil {
			// Публикация блока не найдена, откат к отображению текста
			if displayText != "" {
				return displayText
			}
			if ref.Content != "" {
				if len(ref.Content) > 30 {
					return ref.Content[:30] + "..."
				}
				return ref.Content
			}
			return "[ссылка]"
		}

		// Генерация URL для публикации блока
		blockShareURL := baseURL + "/s/" + blockShare.ID

		// Определить отображаемый текст
		linkText := displayText
		if linkText == "" {
			linkText = ref.DisplayText
		}
		if linkText == "" {
			// Использование первых 30 символов блока в качестве текста ссылки
			if len(ref.Content) > 30 {
				linkText = ref.Content[:30] + "..."
			} else if ref.Content != "" {
				linkText = ref.Content
			} else {
				linkText = "ссылка"
			}
		}

		return "[" + linkText + "](" + blockShareURL + ")"
	})

	return result
}
