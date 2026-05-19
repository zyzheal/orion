package database

import (
	"fmt"
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/orion-platform/orion-ops/internal/config"
	"github.com/orion-platform/orion-ops/internal/executor"
	"github.com/orion-platform/orion-ops/internal/scheduler"
	"github.com/orion-platform/orion-ops/internal/terminal"
)

// DB Database instance
var DB *gorm.DB

// Init initializes database connection
func Init(cfg *config.DatabaseConfig) error {
	dsn := cfg.GetDSN()

	log.Printf("Connecting to database: %s:%d/%s", cfg.Host, cfg.Port, cfg.Name)

	// Configurable log level — silent in production, verbose in debug mode
	logLevel := logger.Warn
	if os.Getenv("GIN_MODE") == "debug" {
		logLevel = logger.Info
	}

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})

	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}

	// SetMaxIdleConns sets the maximum number of connections in the idle connection pool
	sqlDB.SetMaxIdleConns(10)

	// SetMaxOpenConns sets the maximum number of open connections to the database
	sqlDB.SetMaxOpenConns(100)

	// SetConnMaxLifetime sets the maximum amount of time a connection may be reused
	sqlDB.SetConnMaxLifetime(time.Hour)

	log.Println("Database connected successfully")
	return nil
}

// Close closes database connection
func Close() error {
	if DB != nil {
		sqlDB, err := DB.DB()
		if err != nil {
			return err
		}
		return sqlDB.Close()
	}
	return nil
}

// GetDB returns the database instance
func GetDB() *gorm.DB {
	return DB
}

// AutoMigrate runs database schema migration for all models
func AutoMigrate() error {
	if DB == nil {
		return fmt.Errorf("database not initialized")
	}

	log.Println("Running database auto-migration...")
	if err := DB.AutoMigrate(&scheduler.CronJob{}, &terminal.Session{}, &executor.Task{}); err != nil {
		return fmt.Errorf("failed to auto-migrate database: %w", err)
	}

	log.Println("Database migration completed successfully")
	return nil
}