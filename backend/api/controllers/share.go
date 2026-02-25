package controllers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/mihazzz123/siyuan-share/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// CreateShareRequest Запрос на создание публикации
type CreateShareRequest struct {
	DocID           string              `json:"docId" binding:"required"`
	DocTitle        string              `json:"docTitle" binding:"required"`
	Content         string              `json:"content" binding:"required"`
	RequirePassword bool                `json:"requirePassword"`
	Password        string              `json:"password"`
	ExpireDays      int                 `json:"expireDays" binding:"required,min=1,max=365"`
	IsPublic        bool                `json:"isPublic"`
	References      []BlockReferenceReq `json:"references"` // Данные ссылаемых блоков
}

// BlockReferenceReq Запрос данных ссылаемого блока
type BlockReferenceReq struct {
	BlockID     string `json:"blockId"`
	Content     string `json:"content"`
	DisplayText string `json:"displayText,omitempty"`
	RefCount    int    `json:"refCount,omitempty"`
}

// CreateShareResponse Ответ на создание публикации
type CreateShareResponse struct {
	ShareID         string    `json:"shareId"`
	ShareURL        string    `json:"shareUrl"`
	DocID           string    `json:"docId"`
	DocTitle        string    `json:"docTitle"`
	RequirePassword bool      `json:"requirePassword"`
	ExpireAt        time.Time `json:"expireAt"`
	IsPublic        bool      `json:"isPublic"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
	Reused          bool      `json:"reused"`
}

// BatchDeleteShareRequest Запрос на массовое удаление публикаций
type BatchDeleteShareRequest struct {
	ShareIDs []string `json:"shareIds"`
}

// BatchDeleteShareResponse Результат массового удаления публикаций
type BatchDeleteShareResponse struct {
	Deleted         []string          `json:"deleted"`
	NotFound        []string          `json:"notFound"`
	Failed          map[string]string `json:"failed,omitempty"`
	DeletedAllCount int64             `json:"deletedAllCount,omitempty"`
}

// CreateShare Создание публикации
func CreateShare(c *gin.Context) {
	var req CreateShareRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 1,
			"msg":  "Invalid request: " + err.Error(),
		})
		return
	}

	// Получение ID пользователя (из middleware аутентификации)
	userID, _ := c.Get("userID")
	userIDStr := userID.(string)

	existingShare, err := models.FindActiveShareByDoc(userIDStr, req.DocID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 1,
			"msg":  "Failed to query share: " + err.Error(),
		})
		return
	}

	// Если публикация существует, но истекла, она считается недействительной
	if existingShare != nil && existingShare.IsExpired() {
		existingShare = nil
	}

	password := strings.TrimSpace(req.Password)

	if req.RequirePassword {
		if password != "" && len(password) < 4 {
			c.JSON(http.StatusBadRequest, gin.H{
				"code": 1,
				"msg":  "Password must be at least 4 characters",
			})
			return
		}
		if password == "" {
			if existingShare == nil || existingShare.PasswordHash == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"code": 1,
					"msg":  "Password must be provided for new share",
				})
				return
			}
		}
	}

	var share *models.Share
	reused := false
	if existingShare != nil {
		share = existingShare
		reused = true
	} else {
		share = &models.Share{
			ID:     generateShareID(),
			UserID: userIDStr,
			DocID:  req.DocID,
		}
	}

	share.DocTitle = req.DocTitle
	share.Content = req.Content
	share.RequirePassword = req.RequirePassword
	share.IsPublic = req.IsPublic
	share.ExpireAt = time.Now().AddDate(0, 0, req.ExpireDays)

	// Обработка данных ссылаемых блоков
	if len(req.References) > 0 {
		refsJSON, err := json.Marshal(req.References)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code": 1,
				"msg":  "Failed to serialize references: " + err.Error(),
			})
			return
		}
		share.References = string(refsJSON)
	} else {
		share.References = ""
	}

	if req.RequirePassword {
		if password != "" {
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"code": 1,
					"msg":  "Failed to encrypt password",
				})
				return
			}
			share.PasswordHash = string(hashedPassword)
		}
		// Если пусто, используется старый пароль (проверка гарантирует возможность повторного использования)
	} else {
		share.PasswordHash = ""
	}

	if reused {
		if err := models.DB.Save(share).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code": 1,
				"msg":  "Failed to update share: " + err.Error(),
			})
			return
		}
	} else {
		if err := models.DB.Create(share).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code": 1,
				"msg":  "Failed to create share: " + err.Error(),
			})
			return
		}
	}

	// Построение URL публикации (автоматически или через X-Base-URL)
	baseURL := c.GetHeader("X-Base-URL")
	if baseURL == "" {
		// Приоритетное использование заголовков прокси
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
		// Удаление возможного слеша в конце
		baseURL = proto + "://" + strings.TrimSuffix(host, "/")
	}
	shareURL := strings.TrimSuffix(baseURL, "/") + "/s/" + share.ID

	// Создание дочерних публикаций для ссылаемых блоков
	if len(req.References) > 0 {
		for _, ref := range req.References {
			// Проверка существования публикации для этого блока (по docId = blockId)
			existingBlockShare, _ := models.FindActiveShareByDoc(userIDStr, ref.BlockID)

			// Генерация заголовка для ссылаемого блока
			blockTitle := generateBlockTitle(ref)

			var blockShare *models.Share
			if existingBlockShare != nil && !existingBlockShare.IsExpired() {
				// Обновление существующей публикации блока
				blockShare = existingBlockShare
				blockShare.DocTitle = blockTitle
				blockShare.Content = ref.Content
				blockShare.ExpireAt = share.ExpireAt
				blockShare.ParentShareID = share.ID
				models.DB.Save(blockShare)
			} else {
				// Создание новой публикации блока
				blockShare = &models.Share{
					ID:            generateShareID(),
					UserID:        userIDStr,
					DocID:         ref.BlockID, // Использование blockId в качестве docId
					DocTitle:      blockTitle,
					Content:       ref.Content,
					ParentShareID: share.ID,
					// Наследование пароля и срока действия от родительской публикации
					RequirePassword: share.RequirePassword,
					PasswordHash:    share.PasswordHash,
					ExpireAt:        share.ExpireAt,
					IsPublic:        share.IsPublic,
				}
				models.DB.Create(blockShare)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
		"data": CreateShareResponse{
			ShareID:         share.ID,
			ShareURL:        shareURL,
			DocID:           share.DocID,
			DocTitle:        share.DocTitle,
			RequirePassword: share.RequirePassword,
			ExpireAt:        share.ExpireAt,
			IsPublic:        share.IsPublic,
			CreatedAt:       share.CreatedAt,
			UpdatedAt:       share.UpdatedAt,
			Reused:          reused,
		},
	})
}

// ListShares Получение списка публикаций пользователя
func ListShares(c *gin.Context) {
	userID, _ := c.Get("userID")

	// Параметры пагинации
	page := 1
	size := 10
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if s := c.Query("size"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v > 0 {
			if v > 100 {
				v = 100
			}
			size = v
		}
	}
	offset := (page - 1) * size

	var total int64
	if err := models.DB.Model(&models.Share{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "msg": "Failed to count shares: " + err.Error()})
		return
	}

	var shares []models.Share
	if err := models.DB.Where("user_id = ?", userID).
		Order("created_at DESC").
		Offset(offset).Limit(size).
		Find(&shares).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 1,
			"msg":  "Failed to fetch shares: " + err.Error(),
		})
		return
	}

	// Возврат легкой структуры с shareUrl
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
	baseURL = strings.TrimSuffix(baseURL, "/")

	type item struct {
		ID              string    `json:"id"`
		DocID           string    `json:"docId"`
		DocTitle        string    `json:"docTitle"`
		RequirePassword bool      `json:"requirePassword"`
		ExpireAt        time.Time `json:"expireAt"`
		IsPublic        bool      `json:"isPublic"`
		ViewCount       int       `json:"viewCount"`
		CreatedAt       time.Time `json:"createdAt"`
		ShareURL        string    `json:"shareUrl"`
	}
	items := make([]item, 0, len(shares))
	for _, s := range shares {
		items = append(items, item{
			ID:              s.ID,
			DocID:           s.DocID,
			DocTitle:        s.DocTitle,
			RequirePassword: s.RequirePassword,
			ExpireAt:        s.ExpireAt,
			IsPublic:        s.IsPublic,
			ViewCount:       s.ViewCount,
			CreatedAt:       s.CreatedAt,
			ShareURL:        baseURL + "/s/" + s.ID,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
		"data": gin.H{
			"items": items,
			"page":  page,
			"size":  size,
			"total": total,
		},
	})
}

// DeleteShare Удаление публикации
func DeleteShare(c *gin.Context) {
	shareID := c.Param("id")
	userID, _ := c.Get("userID")

	result := models.DB.Where("id = ? AND user_id = ?", shareID, userID).Delete(&models.Share{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 1,
			"msg":  "Failed to delete share: " + result.Error.Error(),
		})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"code": 1,
			"msg":  "Share not found or unauthorized",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
	})
}

// DeleteSharesBatch Массовое удаление публикаций
func DeleteSharesBatch(c *gin.Context) {
	var req BatchDeleteShareRequest
	if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 1,
			"msg":  "Invalid request: " + err.Error(),
		})
		return
	}

	userID := c.GetString("userID")

	// Если ID не указаны, удаляются все публикации текущего пользователя
	if len(req.ShareIDs) == 0 {
		count, err := models.DeleteSharesByUser(userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code": 1,
				"msg":  "Failed to delete shares: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"code": 0,
			"msg":  "success",
			"data": BatchDeleteShareResponse{
				DeletedAllCount: count,
			},
		})
		return
	}

	response := BatchDeleteShareResponse{
		Deleted:  make([]string, 0, len(req.ShareIDs)),
		NotFound: []string{},
	}
	failed := map[string]string{}

	for _, shareID := range req.ShareIDs {
		shareID = strings.TrimSpace(shareID)
		if shareID == "" {
			continue
		}

		result := models.DB.Where("id = ? AND user_id = ?", shareID, userID).Delete(&models.Share{})
		if result.Error != nil {
			failed[shareID] = result.Error.Error()
			continue
		}
		if result.RowsAffected == 0 {
			response.NotFound = append(response.NotFound, shareID)
			continue
		}
		response.Deleted = append(response.Deleted, shareID)
	}

	if len(failed) > 0 {
		response.Failed = failed
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
		"data": response,
	})
}

// generateShareID Генерация случайного ID публикации
func generateShareID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// generateBlockTitle Генерация заголовка ссылаемого блока
func generateBlockTitle(ref BlockReferenceReq) string {
	// Приоритет отображаемому тексту
	if ref.DisplayText != "" {
		return ref.DisplayText
	}

	// Использование первой строки контента в качестве заголовка
	if ref.Content != "" {
		lines := strings.Split(ref.Content, "\n")
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			// Пропуск пустых строк и разметки Markdown
			if trimmed != "" && !strings.HasPrefix(trimmed, "#") {
				// Ограничение длины заголовка
				if len(trimmed) > 50 {
					return trimmed[:50] + "..."
				}
				return trimmed
			}
		}

		// Если все строки - заголовки или пустые, используется первая непустая строка
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if trimmed != "" {
				// Удаление маркеров заголовков Markdown
				trimmed = strings.TrimLeft(trimmed, "# ")
				if len(trimmed) > 50 {
					return trimmed[:50] + "..."
				}
				return trimmed
			}
		}
	}

	// Откат к использованию blockId
	return "ссылкаБлок"
}
