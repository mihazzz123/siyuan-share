package routes

import (
	"embed"
	"io/fs"
	"mime"
	"net/http"
	"os"
	"path"
	"strings"
	"time"

	"com/mihazzz123/siyuan-share-api/controllers"
	"com/mihazzz123/siyuan-share-api/middleware"
	"com/mihazzz123/siyuan-share-api/models"
	gz "github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

// SetupRouter Настройка маршрутов
func SetupRouter(staticFiles *embed.FS) *gin.Engine {
	// Настройка Engine для закрытия ненужных middleware или смены библиотеки JSON
	r := gin.New()
	r.Use(gin.Recovery())
	// Включение стандартного Logger только при разработке, в продакшене можно отключить через GIN_MODE=release
	if gin.Mode() != gin.ReleaseMode {
		r.Use(gin.Logger())
	}

	// Отключение автоматического редиректа, чтобы избежать 301 на корневом пути
	r.RedirectTrailingSlash = false
	r.RedirectFixedPath = false

	// Использование CORS middleware и сжатия ответов
	r.Use(middleware.CORSMiddleware())
	r.Use(gz.Gzip(gz.BestSpeed))
	// Обслуживание статических файлов (фронтенд)
	if staticFiles != nil {
		// Получение встроенной файловой системы dist
		distFS, err := fs.Sub(*staticFiles, "dist")
		if err == nil {
			// Обработка статических файлов и маршрутов SPA
			r.NoRoute(func(c *gin.Context) {
				requestPath := c.Request.URL.Path

				// API маршруты возвращают 404
				if strings.HasPrefix(requestPath, "/api") {
					c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "not found"})
					return
				}

				// Очистка пути
				cleaned := strings.TrimPrefix(requestPath, "/")
				cleaned = path.Clean(cleaned)
				if cleaned == "." {
					cleaned = ""
				}

				// Запрет выхода за пределы директории
				if strings.Contains(cleaned, "..") {
					c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "invalid path"})
					return
				}

				serveFile := func(target string) bool {
					if target == "" {
						target = "index.html"
					}

					data, err := fs.ReadFile(distFS, target)
					if err != nil {
						return false
					}

					ext := strings.ToLower(path.Ext(target))
					contentType := mime.TypeByExtension(ext)
					if contentType == "" {
						contentType = http.DetectContentType(data)
					}
					if contentType == "" {
						contentType = "application/octet-stream"
					}

					if ext == ".html" || target == "index.html" {
						contentType = "text/html; charset=utf-8"
						c.Header("Cache-Control", "no-cache")
					} else {
						c.Header("Cache-Control", "public, max-age=31536000, immutable")
					}

					c.Data(http.StatusOK, contentType, data)
					return true
				}

				// попыткачтениястатическийресурсфайл（assets ）
				if strings.Contains(cleaned, ".") {
					if serveFile(cleaned) {
						return
					}
				}

				// все остальные путивозврат index.html（SPA маршрут）
				serveFile("index.html")
			})
		}
	}
	// API маршрутгруппа -  API все находятся /api префикспод
	api := r.Group("/api")
	{
		// Проверка здоровья (публичная)
		api.GET("/health", func(c *gin.Context) {
			var userCount int64
			models.DB.Model(&models.User{}).Count(&userCount)
			c.JSON(http.StatusOK, gin.H{
				"status":    "ok",
				"ts":        time.Now().Unix(),
				"userCount": userCount,
				"ginMode":   os.Getenv("GIN_MODE"),
				"version":   "v1", // можно будет внедрить из информации о сборке позже
			})
		})

		// Регистрация и вход (без аутентификации)
		api.POST("/auth/register", controllers.Register)
		api.POST("/auth/login", controllers.Login)

		// Проверка здоровья (требуется аутентификация, для тестирования API токена)
		api.GET("/auth/health", middleware.AuthMiddleware(), func(c *gin.Context) {
			userID, _ := c.Get("userID")
			c.JSON(http.StatusOK, gin.H{
				"code": 0,
				"msg":  "success",
				"data": gin.H{
					"status": "ok",
					"userID": userID,
					"ts":     time.Now().Unix(),
				},
			})
		})

		// Интерфейсы управления публикациями с аутентификацией
		share := api.Group("/share")
		share.Use(middleware.AuthMiddleware())
		{
			share.POST("/create", controllers.CreateShare)
			share.GET("/list", controllers.ListShares)
			share.DELETE("/batch", controllers.DeleteSharesBatch)
			share.DELETE(":id", controllers.DeleteShare)
		}

		user := api.Group("/user")
		user.Use(middleware.AuthMiddleware())
		{
			user.GET("/me", controllers.Me)
		}

		// Конечные точки управления токенами (требуется аутентификация)
		token := api.Group("/token")
		token.Use(middleware.AuthMiddleware())
		{
			token.GET("/list", controllers.ListTokens)
			token.POST("/create", controllers.CreateToken)
			token.POST("/refresh/:id", controllers.RefreshToken)
			token.POST("/revoke/:id", controllers.RevokeToken)
		}

		// Публичный интерфейс просмотра публикаций
		api.GET("/s/:id", controllers.GetShare)
	}

	return r
}
