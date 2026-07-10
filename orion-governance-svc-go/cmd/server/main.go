package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	audit_handler "orion/governance-svc-go/internal/audit/handler"
	audit_repository "orion/governance-svc-go/internal/audit/repository"
	audit_service "orion/governance-svc-go/internal/audit/service"

	compliance_handler "orion/governance-svc-go/internal/compliance/handler"
	compliance_repository "orion/governance-svc-go/internal/compliance/repository"
	compliance_service "orion/governance-svc-go/internal/compliance/service"

	governance_handler "orion/governance-svc-go/internal/governance/handler"
	governance_repository "orion/governance-svc-go/internal/governance/repository"
	governance_service "orion/governance-svc-go/internal/governance/service"

	risk_handler "orion/governance-svc-go/internal/risk/handler"
	risk_repository "orion/governance-svc-go/internal/risk/repository"
	risk_service "orion/governance-svc-go/internal/risk/service"

	nats_subscriber "orion/governance-svc-go/pkg/nats"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"

	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-governance-svc"))
	defer logger.Sync()

	cfg := loadConfig()

	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode)
	dbCfg := database.DefaultConfig(dsn)

	ctx := context.Background()
	db, err := database.Connect(ctx, dbCfg)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	migrationsDir := "migrations"
	if _, err := os.Stat(migrationsDir); err == nil {
		if err := database.RunMigrations(db, migrationsDir); err != nil {
			logger.Warn("warning: failed to run migrations", zap.Error(err))
		}
	}

	rdb := orionredis.NewClient(orionredis.Config{Addr: cfg.RedisAddr})
	defer rdb.Close()

	// --- Audit sub-service ---
	auditRepo := audit_repository.NewRepository(db.DB)
	auditSvc := audit_service.NewService(auditRepo)
	auditHandler := audit_handler.NewHandler(auditSvc)

	// --- Compliance sub-service ---
	complianceReportRepo := compliance_repository.NewComplianceReportRepository(db.DB)
	complianceScheduleRepo := compliance_repository.NewComplianceScheduleRepository(db.DB)
	compliancePolicyRepo := compliance_repository.NewCompliancePolicyRepository(db.DB)
	complianceSvc := compliance_service.NewComplianceService(complianceReportRepo, complianceScheduleRepo, compliancePolicyRepo)
	complianceHandler := compliance_handler.NewHandler(complianceSvc)

	// --- Governance sub-service ---
	governanceRepo := governance_repository.NewRepository(db.DB)
	governanceSvc := governance_service.NewService(governanceRepo)
	governanceHandler := governance_handler.NewHandler(governanceSvc)

	// --- Risk sub-service ---
	riskRepo := risk_repository.NewRepository(db.DB)
	riskSvc := risk_service.NewService(riskRepo)
	riskHandler := risk_handler.NewHandler(riskSvc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))
	auditHandler.RegisterRoutes(rg)
	complianceHandler.RegisterRoutes(rg)
	governanceHandler.RegisterRoutes(rg)
	riskHandler.RegisterRoutes(rg)

	r.GET("/healthz", middleware.HealthCheck("orion-governance-svc"))

	// Initialize NATS JetStream subscriber (for consuming events)
	var natsSub *nats_subscriber.NATSSubscriber
	if cfg.NATSAddr != "" {
		sub, err := nats_subscriber.NewNATSSubscriber(cfg.NATSAddr, cfg.NATSStream, logger)
		if err != nil {
			logger.Warn("failed to init NATS subscriber", zap.Error(err))
		} else {
			natsSub = sub
			if err := natsSub.Start(context.Background()); err != nil {
				logger.Warn("failed to start NATS subscriber", zap.Error(err))
				natsSub = nil
			}
		}
	}

	addr := fmt.Sprintf(":%d", cfg.Port)
	srv := &http.Server{Addr: addr, Handler: r}
	go func() {
		logger.Info("governance-svc listening", zap.String("addr", addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down governance-svc...")
	if natsSub != nil {
		if err := natsSub.Close(); err != nil {
			logger.Warn("failed to close NATS subscriber", zap.Error(err))
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}
}

// loadConfig loads the unified governance service configuration.
func loadConfig() *Config {
	port := getEnvInt("PORT", 8080)
	dbPort := getEnvInt("DB_PORT", 5432)

	return &Config{
		Port:       port,
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     dbPort,
		DBUser:     requireEnv("DB_USER"),
		DBPassword: requireEnv("DB_PASSWORD"),
		DBName:     getEnv("DB_NAME", "orion_governance"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),
		JWTSecret:  getEnv("JWT_SECRET", "change-me-in-production"),
		RedisAddr:  getEnv("REDIS_ADDR", "localhost:6379"),
		NATSAddr:   getEnv("NATS_ADDR", "nats://localhost:4222"),
		NATSStream: getEnv("NATS_STREAM", "EVENTS"),
	}
}

type Config struct {
	Port       int
	DBHost     string
	DBPort     int
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
	JWTSecret  string
	RedisAddr  string
	NATSAddr   string
	NATSStream string
}

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if v := os.Getenv(key); v != "" {
		n, _ := strconv.Atoi(v)
		return n
	}
	return defaultValue
}

func requireEnv(key string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	panic("required environment variable not set: " + key)
}
