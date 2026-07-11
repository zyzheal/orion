package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	secretcfg "orion/security-svc-go/internal/secret/config"
	sech "orion/security-svc-go/internal/secret/handler"
	secrepo "orion/security-svc-go/internal/secret/repository"
	secsvc "orion/security-svc-go/internal/secret/service"

	securitycfg "orion/security-svc-go/internal/security/config"
	securityh "orion/security-svc-go/internal/security/handler"
	securityrepo "orion/security-svc-go/internal/security/repository"
	securitysvc "orion/security-svc-go/internal/security/service"

	nats_subscriber "orion/security-svc-go/pkg/nats"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	orionredis "orion/go-common/pkg/redis"
	securitycompliance_handler "orion/security-svc-go/internal/security-compliance/handler"
	securitycompliance_repo "orion/security-svc-go/internal/security-compliance/repository"
	securitycompliance_service "orion/security-svc-go/internal/security-compliance/service"
	ueba_handler "orion/security-svc-go/internal/ueba/handler"
	ueba_repo "orion/security-svc-go/internal/ueba/repository"
	ueba_service "orion/security-svc-go/internal/ueba/service"
	privacy_handler "orion/security-svc-go/internal/privacy/handler"
	privacy_repo "orion/security-svc-go/internal/privacy/repository"
	privacy_service "orion/security-svc-go/internal/privacy/service"
	crossdomain_handler "orion/security-svc-go/internal/cross-domain/handler"
	crossdomain_repo "orion/security-svc-go/internal/cross-domain/repository"
	crossdomain_service "orion/security-svc-go/internal/cross-domain/service"
	branchpolicy_handler "orion/security-svc-go/internal/branch-policy/handler"
	branchpolicy_repo "orion/security-svc-go/internal/branch-policy/repository"
	branchpolicy_service "orion/security-svc-go/internal/branch-policy/service"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-security-svc"))
	defer logger.Sync()

	// Security config
	secCfg := securitycfg.Load()

	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		secCfg.DBHost, secCfg.DBPort, secCfg.DBUser, secCfg.DBPassword, secCfg.DBName, secCfg.DBSSLMode)
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
			log.Printf("warning: failed to run migrations: %v", err)
		}
	}

	rdb := orionredis.NewClient(orionredis.Config{Addr: secCfg.RedisAddr})
	defer rdb.Close()

	// ---- Security service ----
	secRepo := securityrepo.NewRepository(db.DB)
	secSvc := securitysvc.NewService(secRepo)
	secHandler := securityh.NewHandler(secSvc)

	// ---- Secret service ----
	_ = secretcfg.Load()
	encryptionKey := os.Getenv("ORION_SECRET_ENCRYPTION_KEY")
	secretRepo := secrepo.NewRepository(db.DB)
	secretSvc := secsvc.NewService(secretRepo, encryptionKey)
	secretHandler := sech.NewHandler(secretSvc)

	// ---- NATS JetStream subscriber ----
	var natsSub *nats_subscriber.NATSSubscriber
	if secCfg.NATSAddr != "" {
		sub, err := nats_subscriber.NewNATSSubscriber(secCfg.NATSAddr, secCfg.NATSStream, logger)
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

	// ---- Routes ----


	// security-compliance services
	securitycomplianceRepo := securitycompliance_repo.NewRepository(db.DB)
	securitycomplianceSvc := securitycompliance_service.NewService(securitycomplianceRepo)
	securitycomplianceH := securitycompliance_handler.NewHandler(securitycomplianceSvc)

	// ueba services
	uebaRepo := ueba_repo.NewRepository(db.DB)
	uebaSvc := ueba_service.NewService(uebaRepo)
	uebaH := ueba_handler.NewHandler(uebaSvc)

	// privacy services
	privacyRepo := privacy_repo.NewRepository(db.DB)
	privacySvc := privacy_service.NewService(privacyRepo)
	privacyH := privacy_handler.NewHandler(privacySvc)

	// cross-domain services
	crossdomainRepo := crossdomain_repo.NewRepository(db.DB)
	crossdomainSvc := crossdomain_service.NewService(crossdomainRepo)
	crossdomainH := crossdomain_handler.NewHandler(crossdomainSvc)

	// branch-policy services
	branchpolicyRepo := branchpolicy_repo.NewRepository(db.DB)
	branchpolicySvc := branchpolicy_service.NewService(branchpolicyRepo)
	branchpolicyH := branchpolicy_handler.NewHandler(branchpolicySvc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: secCfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))

	// Security routes (/api/v1/secur...)
	secHandler.RegisterRoutes(rg)

	// Secret routes (/api/v1/secret...)
	secretHandler.RegisterRoutes(rg)


	securitycomplianceH.RegisterRoutes(rg)
	uebaH.RegisterRoutes(rg)
	privacyH.RegisterRoutes(rg)
	crossdomainH.RegisterRoutes(rg)
	branchpolicyH.RegisterRoutes(rg)

	r.GET("/healthz", middleware.HealthCheck("orion-security-svc"))

	addr := fmt.Sprintf(":%d", secCfg.Port)
	srv := &http.Server{Addr: addr, Handler: r}

	go func() {
		logger.Info("security-svc (secret + security) listening", zap.String("addr", addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server error", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("shutting down security-svc...")

	if natsSub != nil {
		if err := natsSub.Close(); err != nil {
			logger.Warn("failed to close NATS subscriber", zap.Error(err))
		}
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	srv.Shutdown(shutdownCtx)
}
