package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	cost_handler "orion/finops-svc-go/internal/cost/handler"
	cost_repo "orion/finops-svc-go/internal/cost/repository"
	cost_svc "orion/finops-svc-go/internal/cost/service"

	eff_handler "orion/finops-svc-go/internal/efficiency/handler"
	eff_repo "orion/finops-svc-go/internal/efficiency/repository"
	eff_svc "orion/finops-svc-go/internal/efficiency/service"
	eff_nats "orion/finops-svc-go/internal/efficiency/pkg/nats"

	finops_handler "orion/finops-svc-go/internal/finops/handler"
	finops_repo "orion/finops-svc-go/internal/finops/repository"
	finops_svc "orion/finops-svc-go/internal/finops/service"

	rd_handler "orion/finops-svc-go/internal/report-designer/handler"
	rd_repo "orion/finops-svc-go/internal/report-designer/repository"
	rd_svc "orion/finops-svc-go/internal/report-designer/service"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	orionredis "orion/go-common/pkg/redis"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-finops-svc"))
	defer logger.Sync()

	port := getEnvInt("PORT", 8080)
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnvInt("DB_PORT", 5432)
	dbUser := requireEnv("DB_USER")
	dbPassword := requireEnv("DB_PASSWORD")
	dbName := getEnv("DB_NAME", "orion_finops")
	dbSSLMode := getEnv("DB_SSLMODE", "disable")
	jwtSecret := getEnv("JWT_SECRET", "change-me-in-production")
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
	natsAddr := getEnv("NATS_ADDR", "")
	natsStream := getEnv("NATS_STREAM", "EVENTS")

	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		dbHost, dbPort, dbUser, dbPassword, dbName, dbSSLMode)
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

	rdb := orionredis.NewClient(orionredis.Config{Addr: redisAddr})
	defer rdb.Close()

	// ── FINOPS (original) ──
	finopsCostRepo := finops_repo.NewCostRepository(db.DB)
	finopsSvc := finops_svc.NewFinOpsService(finopsCostRepo)
	finopsOptSvc := finops_svc.NewOptimizationService(finopsCostRepo)
	finopsBudgetSvc := finops_svc.NewBudgetService(finopsCostRepo)
	finopsCostTrendSvc := finops_svc.NewCostTrendService(finopsCostRepo)
	finopsHandler := finops_handler.NewHandler(finopsSvc)
	finopsOptHandler := finops_handler.NewOptimizationHandler(finopsOptSvc)
	finopsBudgetHandler := finops_handler.NewBudgetHandler(finopsBudgetSvc)
	finopsCostTrendHandler := finops_handler.NewCostTrendHandler(finopsCostTrendSvc)

	// ── COST ──
	costRepository := cost_repo.NewCostRepository(db.DB)
	costSvc := cost_svc.NewCostService(costRepository, logger)
	costCalculator := cost_svc.NewCostCalculator(logger)
	costBudgetSvc := cost_svc.NewBudgetService(costRepository, logger)
	costOptSvc := cost_svc.NewOptimizationService(costRepository, logger)
	costAnomalySvc := cost_svc.NewAnomalyService(costRepository)
	costHandler := cost_handler.New(costSvc, costCalculator, costBudgetSvc, costOptSvc, costAnomalySvc, logger)

	// ── EFFICIENCY ──
	effRepo := eff_repo.NewRepository(db.DB)
	effSvc := eff_svc.NewService(effRepo)
	effHandler := eff_handler.NewHandler(effSvc)

	// ── REPORT-DESIGNER ──
	rdDefRepo := rd_repo.NewReportDefinitionRepository(db.DB)
	rdDsRepo := rd_repo.NewReportDatasourceRepository(db.DB)
	rdSchedRepo := rd_repo.NewReportScheduleRepository(db.DB)
	rdExecRepo := rd_repo.NewReportExecutionRepository(db.DB)
	rdSvc := rd_svc.NewReportDesignerService(rdDefRepo, rdDsRepo, rdSchedRepo, rdExecRepo)
	rdHandler := rd_handler.NewHandler(rdSvc)

	// ── Router ──
	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: jwtSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))

	// Register all service routes
	finopsHandler.RegisterRoutes(rg)
	finopsOptHandler.RegisterRoutes(rg)
	finopsBudgetHandler.RegisterRoutes(rg)
	finopsCostTrendHandler.RegisterRoutes(rg)
	costHandler.RegisterRoutes(rg)
	effHandler.RegisterRoutes(rg)
	rdHandler.RegisterRoutes(rg)

	r.GET("/healthz", middleware.HealthCheck("orion-finops-svc"))

	// ── NATS JetStream subscriber ──
	var natsSub *eff_nats.NATSSubscriber
	if natsAddr != "" {
		sub, err := eff_nats.NewNATSSubscriber(natsAddr, natsStream, logger)
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

	addr := fmt.Sprintf(":%d", port)
	logger.Info("finops-svc listening", zap.String("addr", addr))

	srv := &http.Server{Addr: addr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down finops-svc...")
	if natsSub != nil {
		if err := natsSub.Close(); err != nil {
			logger.Warn("failed to close NATS subscriber", zap.Error(err))
		}
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}
}

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}

func requireEnv(key string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	panic("required environment variable not set: " + key)
}

func getEnvInt(key string, defaultValue int) int {
	if v := os.Getenv(key); v != "" {
		var i int
		_, err := fmt.Sscanf(v, "%d", &i)
		if err == nil {
			return i
		}
	}
	return defaultValue
}
