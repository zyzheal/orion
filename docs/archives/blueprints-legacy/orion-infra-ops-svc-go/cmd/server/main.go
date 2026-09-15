package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	backupHandler "orion/infra-ops-svc-go/internal/backup/handler"
	backupRepo "orion/infra-ops-svc-go/internal/backup/repository"
	backupSvc "orion/infra-ops-svc-go/internal/backup/service"

	capHandler "orion/infra-ops-svc-go/internal/capacity/handler"
	capRepo "orion/infra-ops-svc-go/internal/capacity/repository"
	capSvc "orion/infra-ops-svc-go/internal/capacity/service"

	chaosHandler "orion/infra-ops-svc-go/internal/chaos/handler"
	chaosRepo "orion/infra-ops-svc-go/internal/chaos/repository"
	chaosSvc "orion/infra-ops-svc-go/internal/chaos/service"

	dtHandler "orion/infra-ops-svc-go/internal/digital-twin/handler"
	dtRepo "orion/infra-ops-svc-go/internal/digital-twin/repository"
	dtSvc "orion/infra-ops-svc-go/internal/digital-twin/service"

	drHandler "orion/infra-ops-svc-go/internal/dr/handler"
	drRepo "orion/infra-ops-svc-go/internal/dr/repository"
	drSvc "orion/infra-ops-svc-go/internal/dr/service"

	mwHandler "orion/infra-ops-svc-go/internal/middleware-ops/handler"
	mwRepo "orion/infra-ops-svc-go/internal/middleware-ops/repository"
	mwSvc "orion/infra-ops-svc-go/internal/middleware-ops/service"

	iacHandler "orion/infra-ops-svc-go/internal/iac/handler"
	iacRepo "orion/infra-ops-svc-go/internal/iac/repository"
	iacSvc "orion/infra-ops-svc-go/internal/iac/service"

	slHandler "orion/infra-ops-svc-go/internal/serverless/handler"
	slRepo "orion/infra-ops-svc-go/internal/serverless/repository"
	slSvc "orion/infra-ops-svc-go/internal/serverless/service"
	dbaHandler "orion/infra-ops-svc-go/internal/dba/handler"
	dbaRepo "orion/infra-ops-svc-go/internal/dba/repository"
	dbaSvc "orion/infra-ops-svc-go/internal/dba/service"
	multicloudHandler "orion/infra-ops-svc-go/internal/multicloud/handler"
	multicloudRepo "orion/infra-ops-svc-go/internal/multicloud/repository"
	multicloudSvc "orion/infra-ops-svc-go/internal/multicloud/service"
	ociregistryHandler "orion/infra-ops-svc-go/internal/oci-registry/handler"
	ociregistryRepo "orion/infra-ops-svc-go/internal/oci-registry/repository"
	ociregistrySvc "orion/infra-ops-svc-go/internal/oci-registry/service"
	degradationHandler "orion/infra-ops-svc-go/internal/degradation/handler"
	degradationRepo "orion/infra-ops-svc-go/internal/degradation/repository"
	degradationSvc "orion/infra-ops-svc-go/internal/degradation/service"
	ephemeralenvHandler "orion/infra-ops-svc-go/internal/ephemeral-env/handler"
	ephemeralenvRepo "orion/infra-ops-svc-go/internal/ephemeral-env/repository"
	ephemeralenvSvc "orion/infra-ops-svc-go/internal/ephemeral-env/service"
	maintenancewindowHandler "orion/infra-ops-svc-go/internal/maintenance-window/handler"
	maintenancewindowRepo "orion/infra-ops-svc-go/internal/maintenance-window/repository"
	maintenancewindowSvc "orion/infra-ops-svc-go/internal/maintenance-window/service"

	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"go.uber.org/zap"
)

func main() {
	// Structured logger from go-common
	logger := orionlog.Must(orionlog.DefaultConfig("orion-infra-ops-svc"))
	defer logger.Sync()

	// Database DSN
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://orion:orion@localhost:5432/orion_infra_ops?sslmode=disable"
	}
	dbCfg := database.DefaultConfig(dsn)

	ctx := context.Background()

	// Establish database connection via go-common database.Connect
	gcdb, err := database.Connect(ctx, dbCfg)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer gcdb.Close()

	// Run migrations via go-common
	migrationsDir := "migrations"
	if _, err := os.Stat(migrationsDir); err == nil {
		if err := database.RunMigrations(gcdb, migrationsDir); err != nil {
			logger.Warn("failed to run migrations", zap.Error(err))
		}
	}

	// Raw sqlx connection for repository constructors (13/14 domains still use *sqlx.DB)
	// TODO(migration): migrate all domain repos to *database.DB so sqlx import can be removed
	rawDB, err := database.NewSQLxDB(dbCfg.DSN)
	if err != nil {
		logger.Fatal("failed to open raw database connection", zap.Error(err))
	}
	defer rawDB.Close()
	rawDB.SetMaxOpenConns(25)
	rawDB.SetMaxIdleConns(25)
	rawDB.SetConnMaxLifetime(5 * time.Minute)

	// Router
	gin.SetMode(gin.DebugMode)
	env := os.Getenv("ENVIRONMENT")
	if env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	// go-common middleware: recovery, request ID, structured logger, CORS
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	r.GET("/healthz", middleware.HealthCheck("orion-infra-ops-svc"))
	r.GET("/health", func(c *gin.Context) {
		if err := rawDB.Ping(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "orion-infra-ops-svc"})
	})

	// database.DB wrapper for backup domain (already uses *database.DB)
	dDB := gcdb

	// ── Capacity ──────────────────────────────────────────────────
	capPoolRepo := capRepo.NewPoolRepository(rawDB)
	capForecastRepo := capRepo.NewForecastRepository(rawDB)
	capPolicyRepo := capRepo.NewPolicyRepository(rawDB)
	capMetricRepo := capRepo.NewMetricRepository(rawDB)
	capAlertRepo := capRepo.NewAlertRepository(rawDB)
	capReportRepo := capRepo.NewReportRepository(rawDB)
	capS := capSvc.NewService(capPoolRepo, capForecastRepo, capPolicyRepo, capMetricRepo, capAlertRepo, capReportRepo)
	capH := capHandler.NewHandler(capS)

	// ── Backup ────────────────────────────────────────────────────
	backupRepository := backupRepo.NewBackupRepository(dDB)
	backupService := backupSvc.NewBackupService(backupRepository, logger)
	recoveryService := backupSvc.NewRecoveryService(backupRepository, logger)
	backupH := backupHandler.New(backupService, recoveryService, logger)

	// ── DR ────────────────────────────────────────────────────────
	drRepository := drRepo.NewRepository(rawDB)
	drService := drSvc.NewService(drRepository)
	drH := drHandler.NewHandler(drService)

	// ── Chaos ─────────────────────────────────────────────────────
	chaosRepository := chaosRepo.NewChaosRepository(rawDB)
	chaosService := chaosSvc.NewChaosService(chaosRepository)
	chaosH := chaosHandler.NewHandler(chaosService)

	// ── Digital Twin ──────────────────────────────────────────────
	dtRepository := dtRepo.NewRepository(rawDB)
	dtService := dtSvc.NewService(dtRepository)
	dtH := dtHandler.NewHandler(dtService)

	// ── Middleware Ops ────────────────────────────────────────────
	mwInstanceRepo := mwRepo.NewInstanceRepository(rawDB)
	mwBackupRepo := mwRepo.NewBackupRepository(rawDB)
	mwMetricRepo := mwRepo.NewMetricRepository(rawDB)
	mwConnPoolRepo := mwRepo.NewConnectionPoolRepository(rawDB)
	mwMqStatsRepo := mwRepo.NewMqStatsRepository(rawDB)
	mwAlertRepo := mwRepo.NewAlertRepository(rawDB)
	mwService := mwSvc.NewService(mwInstanceRepo, mwBackupRepo, mwMetricRepo, mwConnPoolRepo, mwMqStatsRepo, mwAlertRepo)
	mwH := mwHandler.NewHandler(mwService)

	// ── IaC ─────────────────────────────────────────────────────────
	iacRepository := iacRepo.NewRepository(rawDB)
	iacService := iacSvc.NewService(iacRepository)
	iacH := iacHandler.NewHandler(iacService)

	// ── Serverless ──────────────────────────────────────────────────
	slRepository := slRepo.NewRepository(rawDB)
	slService := slSvc.NewService(slRepository)
	slH := slHandler.NewHandler(slService)

	// ── dba ────────────────────────────────────────
	dbaRepository := dbaRepo.NewRepository(rawDB)
	dbaService := dbaSvc.NewService(dbaRepository)
	dbaH := dbaHandler.NewHandler(dbaService)

	// ── multicloud ────────────────────────────────────────────────
	multicloudRepository := multicloudRepo.NewRepository(rawDB)
	multicloudService := multicloudSvc.NewService(multicloudRepository)
	multicloudH := multicloudHandler.NewHandler(multicloudService)

	// ── oci-registry ────────────────────────────────────────────────
	ociregistryRepository := ociregistryRepo.NewRepository(rawDB)
	ociregistryService := ociregistrySvc.NewService(ociregistryRepository)
	ociregistryH := ociregistryHandler.NewHandler(ociregistryService)

	// ── degradation ────────────────────────────────────────────────
	degradationRepository := degradationRepo.NewRepository(rawDB)
	degradationService := degradationSvc.NewService(degradationRepository)
	degradationH := degradationHandler.NewHandler(degradationService)

	// ── ephemeral-env ────────────────────────────────────────────────
	ephemeralenvRepository := ephemeralenvRepo.NewRepository(rawDB)
	ephemeralenvService := ephemeralenvSvc.NewService(ephemeralenvRepository)
	ephemeralenvH := ephemeralenvHandler.NewHandler(ephemeralenvService)

	// ── maintenance-window ────────────────────────────────────────────────
	maintenancewindowRepository := maintenancewindowRepo.NewRepository(rawDB)
	maintenancewindowService := maintenancewindowSvc.NewService(maintenancewindowRepository)
	maintenancewindowH := maintenancewindowHandler.NewHandler(maintenancewindowService)

	// Routes
	api := r.Group("/api/v1")
	{
		capH.RegisterRoutes(api)
		backupH.RegisterRoutes(api)
		drH.RegisterRoutes(api)
		chaosH.RegisterRoutes(api)
		dtH.RegisterRoutes(api)
		mwH.RegisterRoutes(api)
		iacH.RegisterRoutes(api)
		slH.RegisterRoutes(api)
		dbaH.RegisterRoutes(api)
		multicloudH.RegisterRoutes(api)
		ociregistryH.RegisterRoutes(api)
		degradationH.RegisterRoutes(api)
		ephemeralenvH.RegisterRoutes(api)
		maintenancewindowH.RegisterRoutes(api)
	}

	addr := os.Getenv("PORT")
	if addr == "" {
		addr = ":8080"
	}
	if len(addr) > 0 && addr[0] != ':' {
		addr = ":" + addr
	}

	logger.Info("infra-ops service starting", zap.String("addr", addr))

	srv := &http.Server{Addr: addr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down infra-ops service...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}
}
