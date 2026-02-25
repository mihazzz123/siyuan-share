package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/mihazzz123/siyuan-share/models"
	"github.com/gin-gonic/gin"
	jwt "github.com/golang-jwt/jwt/v5"
)

// AuthMiddleware Middleware аутентификации: поддерживает два способа
// 1) Сессионный JWT (для состояния входа в Web)
// 2) Пользовательский API токен (таблица user_tokens, долгосрочный токен, для плагинов/CLI)
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 1, "msg": "Authorization header required"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 1, "msg": "Invalid authorization header format"})
			c.Abort()
			return
		}
		raw := strings.TrimSpace(parts[1])

		// Сначала попытка парсинга как сессионный JWT токен
		if userID, ok := parseJWT(raw); ok {
			c.Set("userID", userID)
			c.Next()
			return
		}

		// Откат к API токену: поиск в таблице user_tokens
		hash := sha256.Sum256([]byte(raw))
		tokenHash := hex.EncodeToString(hash[:])

		var ut models.UserToken
		if err := models.DB.Where("token_hash = ? AND revoked = ?", tokenHash, false).First(&ut).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 1, "msg": "Invalid or revoked token"})
			c.Abort()
			return
		}

		// Проверка доступности пользователя
		var user models.User
		if err := models.DB.Where("id = ? AND is_active = ?", ut.UserID, true).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 1, "msg": "User inactive or not found"})
			c.Abort()
			return
		}

		// Обновление последнего использованиевремени（без блокировкиосновного потока）
		now := time.Now()
		models.DB.Model(&ut).Update("last_used_at", &now)

		c.Set("userID", user.ID)
		c.Set("username", user.Username)
		c.Next()
	}
}

func parseJWT(tokenString string) (string, bool) {
	if strings.Count(tokenString, ".") != 2 {
		return "", false
	}
	secret := os.Getenv("SESSION_SECRET")
	if secret == "" {
		secret = "dev-secret"
	}
	tok, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		// Использование метода HMAC по умолчанию
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{"HS256", "HS384", "HS512"}))
	if err != nil || !tok.Valid {
		return "", false
	}
	if claims, ok := tok.Claims.(jwt.MapClaims); ok {
		// Проверка срока действия
		if exp, has := claims["exp"].(float64); has {
			if time.Unix(int64(exp), 0).Before(time.Now()) {
				return "", false
			}
		}
		if sub, has := claims["sub"].(string); has && sub != "" {
			return sub, true
		}
	}
	return "", false
}
