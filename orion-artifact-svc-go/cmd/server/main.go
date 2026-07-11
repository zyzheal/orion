package main

import (
	"context"

	"orion/artifact-svc-go/internal/artifact/handler"
	"orion/artifact-svc-go/internal/artifact/repository"
	"orion/artifact-svc-go/internal/artifact/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/config"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	"orion/go-common/pkg/redis"

	artifactlifecycle_handler "orion/artifact-svc-go/internal/artifact-lifecycle/handler"
	artifactlifecycle_repo "orion/artifact-svc-go/internal/artifact-lifecycle/repository"
	artifactlifecycle_service "orion/artifact-svc-go/internal/artifact-lifecycle/service"
	artifactops_handler "orion/artifact-svc-go/internal/artifact-ops/handler"
	artifactops_repo "orion/artifact-svc-go/internal/artifact-ops/repository"
	artifactops_service "orion/artifact-svc-go/internal/artifact-ops/service"
	artifactversion_handler "orion/artifact-svc-go/internal/artifact-version/handler"
	artifactversion_repo "orion/artifact-svc-go/internal/artifact-version/repository"
	artifactversion_service "orion/artifact-svc-go/internal/artifact-version/service"
	coderepo_handler "orion/artifact-svc-go/internal/code-repo/handler"
	coderepo_repo "orion/artifact-svc-go/internal/code-repo/repository"
	coderepo_service "orion/artifact-svc-go/internal/code-repo/service"
	sbom_handler "orion/artifact-svc-go/internal/sbom/handler"
	sbom_repo "orion/artifact-svc-go/internal/sbom/repository"
	sbom_service "orion/artifact-svc-go/internal/sbom/service"
	supplychain_handler "orion/artifact-svc-go/internal/supply-chain/handler"
	supplychain_repo "orion/artifact-svc-go/internal/supply-chain/repository"
	supplychain_service "orion/artifact-svc-go/internal/supply-chain/service"
	apkuploadhistory_handler "orion/artifact-svc-go/internal/apk-upload-history/handler"
	apkuploadhistory_repo "orion/artifact-svc-go/internal/apk-upload-history/repository"
	apkuploadhistory_service "orion/artifact-svc-go/internal/apk-upload-history/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	// Load configuration from environment
	dbCfg := config.LoadDatabaseConfig()
	jwtCfg := config.LoadJWTConfig()
	redisCfg := config.LoadRedisConfig()
	httpAddr := config.Getenv("HTTP_ADDR", ":8080")

	// Initialize structured logger
	logger := orionlog.Must(orionlog.Config{
		Level:       config.Getenv("LOG_LEVEL", "info"),
		Development: config.Getenv("ENVIRONMENT", "development") == "development",
		ServiceName: "artifact-svc",
	})
	defer logger.Sync()

	// Initialize OpenTelemetry
	shutdown, err := otel.Init(otel.Config{
		ServiceName: "artifact-svc",
		Endpoint:    config.Getenv("OTEL_ENDPOINT", ""),
		Insecure:    true,
	})
	if err != nil {
		logger.Fatal("failed to init OTel", zap.Error(err))
	}
	defer shutdown(context.Background())

	// Connect to database
	ctx := context.Background()
	db, err := database.Connect(ctx, database.DefaultConfig(dbCfg.DSN()))
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// Run migrations
	if err := database.RunMigrations(db, "migrations"); err != nil {
		logger.Warn("failed to run migrations", zap.Error(err))
	}

	// Initialize Redis client
	rdb := redis.NewClient(redis.Config{
		Addr:     redisCfg.Addr,
		Password: redisCfg.Password,
		DB:       redisCfg.DB,
	})
	defer rdb.Close()

	// Wire up layers
	repo := repository.NewRepository(db.DB)
	svc := service.NewService(repo)
	_ = handler.NewHandler(svc) // unused

	// Setup Gin router
	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	r.GET("/healthz", middleware.HealthCheck("orion-artifact-svc"))

	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: jwtCfg.Secret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))

	// artifact-lifecycle services
	artifactlifecycleRepo := artifactlifecycle_repo.NewRepository(db.DB)
	artifactlifecycleSvc := artifactlifecycle_service.NewService(artifactlifecycleRepo)
	artifactlifecycleH := artifactlifecycle_handler.NewHandler(artifactlifecycleSvc)

	// artifact-ops services
	artifactopsRepo := artifactops_repo.NewRepository(db.DB)
	artifactopsSvc := artifactops_service.NewService(artifactopsRepo)
	artifactopsH := artifactops_handler.NewHandler(artifactopsSvc)

	// artifact-version services
	artifactversionRepo := artifactversion_repo.NewRepository(db.DB)
	artifactversionSvc := artifactversion_service.NewService(artifactversionRepo)
	artifactversionH := artifactversion_handler.NewHandler(artifactversionSvc)

	// code-repo services
	coderepoRepo := coderepo_repo.NewRepository(db.DB)
	coderepoSvc := coderepo_service.NewService(coderepoRepo)
	coderepoH := coderepo_handler.NewHandler(coderepoSvc)

	// sbom services
	sbomRepo := sbom_repo.NewRepository(db.DB)
	sbomSvc := sbom_service.NewService(sbomRepo)
	sbomH := sbom_handler.NewHandler(sbomSvc)

	// supply-chain services
	supplychainRepo := supplychain_repo.NewRepository(db.DB)
	supplychainSvc := supplychain_service.NewService(supplychainRepo)
	supplychainH := supplychain_handler.NewHandler(supplychainSvc)

	// apk-upload-history services
	apkuploadhistoryRepo := apkuploadhistory_repo.NewRepository(db.DB)
	apkuploadhistorySvc := apkuploadhistory_service.NewService(apkuploadhistoryRepo)
	apkuploadhistoryH := apkuploadhistory_handler.NewHandler(apkuploadhistorySvc)


	artifactlifecycleH.RegisterRoutes(rg)
	artifactopsH.RegisterRoutes(rg)
	artifactversionH.RegisterRoutes(rg)
	coderepoH.RegisterRoutes(rg)
	sbomH.RegisterRoutes(rg)
	supplychainH.RegisterRoutes(rg)
	apkuploadhistoryH.RegisterRoutes(rg)


	logger.Info("artifact-svc starting", zap.String("addr", httpAddr))
	if err := r.Run(httpAddr); err != nil {
		logger.Fatal("server error", zap.Error(err))
	}
}
