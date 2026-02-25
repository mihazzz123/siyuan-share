package main

import (
	"embed"
	"log"
	"os"

	"github.com/mihazzz123/siyuan-share/models"
	"github.com/mihazzz123/siyuan-share/routes"
	"github.com/gin-gonic/gin"
)

//go:embed dist/*
var staticFiles embed.FS

func main() {
	// Инициализация базы данных
	if err := models.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Удаление процесса токена инициализации: пользователи управляют токенами через регистрацию

	// Настройка режима Gin
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Создание маршрутов
	r := routes.SetupRouter(&staticFiles)

	// Запуск сервера
	port := os.Getenv("PORT")
	if port == "" {
		port = "8088"
	}

	log.Printf("Server starting on port %s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
