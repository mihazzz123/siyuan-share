package models

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB Инициализация подключения к базе данных
func InitDB() error {
	// Убедиться, что каталог данных существует
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}

	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return err
	}

	dbPath := filepath.Join(dataDir, "siyuan-share.db")
	log.Printf("Database path: %s", dbPath)

	// Настройка уровня логирования GORM (SQLITE_LOG_MODE=info|warn|silent)
	logMode := strings.ToLower(os.Getenv("SQLITE_LOG_MODE"))
	var gormLogger logger.Interface = logger.Default.LogMode(logger.Warn)
	switch logMode {
	case "info":
		gormLogger = logger.Default.LogMode(logger.Info)
	case "silent":
		gormLogger = logger.Default.LogMode(logger.Silent)
	case "warn":
		fallthrough
	default:
		gormLogger = logger.Default.LogMode(logger.Warn)
	}
	config := &gorm.Config{Logger: gormLogger}

	// Использование драйвера glebarez/sqlite для подключения
	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), config)
	if err != nil {
		return err
	}

	// Автоматическая миграция структуры базы данных
	if err := autoMigrate(); err != nil {
		return err
	}

	// Настройки PRAGMA для оптимизации производительности (SQLite)
	applySQLiteOptimizations()

	log.Println("Database initialized successfully")
	return nil
}

// autoMigrate Автоматическая миграция всех моделей
func autoMigrate() error {
	return DB.AutoMigrate(
		&Share{},
		&User{},
		&UserToken{},
		&BootstrapToken{}, // Совместимость со старыми данными, может быть удалено позже
	)
}

// applySQLiteOptimizations Настройка PRAGMA для производительности SQLite
func applySQLiteOptimizations() {
	if DB == nil {
		return
	}
	// Включение WAL и других оптимизаций только локально или в одном экземпляре
	pragmas := []string{
		"PRAGMA journal_mode=WAL;",
		"PRAGMA synchronous=NORMAL;",
		"PRAGMA temp_store=MEMORY;",
		"PRAGMA cache_size=-20000;", // около 20МБ кэша страниц
		"PRAGMA wal_autocheckpoint=2000;",
	}
	for _, p := range pragmas {
		if err := DB.Exec(p).Error; err != nil {
			log.Printf("SQLite PRAGMA failed (%s): %v", p, err)
		}
	}
}
