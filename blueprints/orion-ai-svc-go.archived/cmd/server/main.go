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

	llm_config "orion/ai-svc-go/internal/llm/config"
	llm_handler "orion/ai-svc-go/internal/llm/handler"
	llm_repo "orion/ai-svc-go/internal/llm/repository"
	llm_service "orion/ai-svc-go/internal/llm/service"

	intel_config "orion/ai-svc-go/internal/intelligence/config"
	intel_handler "orion/ai-svc-go/internal/intelligence/handler"
	intel_repo "orion/ai-svc-go/internal/intelligence/repository"
	intel_service "orion/ai-svc-go/internal/intelligence/service"

	skill_config "orion/ai-svc-go/internal/skill/config"
	skill_handler "orion/ai-svc-go/internal/skill/handler"
	skill_repo "orion/ai-svc-go/internal/skill/repository"
	skill_service "orion/ai-svc-go/internal/skill/service"

	aiagent_handler "orion/ai-svc-go/internal/aiagent/handler"
	aiagent_repo "orion/ai-svc-go/internal/aiagent/repository"
	aiagent_service "orion/ai-svc-go/internal/aiagent/service"

	aicost_handler "orion/ai-svc-go/internal/aicost/handler"
	aicost_repo "orion/ai-svc-go/internal/aicost/repository"
	aicost_service "orion/ai-svc-go/internal/aicost/service"
	aigateway_handler "orion/ai-svc-go/internal/aigateway/handler"
	aigateway_repo "orion/ai-svc-go/internal/aigateway/repository"
	aigateway_service "orion/ai-svc-go/internal/aigateway/service"
	aireview_handler "orion/ai-svc-go/internal/aireview/handler"
	aireview_repo "orion/ai-svc-go/internal/aireview/repository"
	aireview_service "orion/ai-svc-go/internal/aireview/service"
	aisecurity_handler "orion/ai-svc-go/internal/aisecurity/handler"
	aisecurity_repo "orion/ai-svc-go/internal/aisecurity/repository"
	aisecurity_service "orion/ai-svc-go/internal/aisecurity/service"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"

	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	knowledge_handler "orion/ai-svc-go/internal/knowledge/handler"
	knowledge_repo "orion/ai-svc-go/internal/knowledge/repository"
	knowledge_service "orion/ai-svc-go/internal/knowledge/service"

	vector_handler "orion/ai-svc-go/internal/vector/handler"
	vector_repo "orion/ai-svc-go/internal/vector/repository"
	vector_service "orion/ai-svc-go/internal/vector/service"

	semantic_handler "orion/ai-svc-go/internal/semantic-search/handler"
	semantic_repo "orion/ai-svc-go/internal/semantic-search/repository"
	semantic_service "orion/ai-svc-go/internal/semantic-search/service"

	orchestration_handler "orion/ai-svc-go/internal/orchestration/handler"
	orchestration_repo "orion/ai-svc-go/internal/orchestration/repository"
	orchestration_service "orion/ai-svc-go/internal/orchestration/service"

	llmtrace_handler "orion/ai-svc-go/internal/llm-trace/handler"
	llmtrace_repo "orion/ai-svc-go/internal/llm-trace/repository"
	llmtrace_service "orion/ai-svc-go/internal/llm-trace/service"

	autoRecovery_handler "orion/ai-svc-go/internal/auto-recovery/handler"
	autoRecovery_repo "orion/ai-svc-go/internal/auto-recovery/repository"
	autoRecovery_service "orion/ai-svc-go/internal/auto-recovery/service"

	ruleEngine_handler "orion/ai-svc-go/internal/rule-engine/handler"
	ruleEngine_service "orion/ai-svc-go/internal/rule-engine/service"

	promptSecurity_handler "orion/ai-svc-go/internal/prompt-security/handler"
	promptSecurity_service "orion/ai-svc-go/internal/prompt-security/service"

	taskExecutor_handler "orion/ai-svc-go/internal/task-executor/handler"
	taskExecutor_service "orion/ai-svc-go/internal/task-executor/service"

	codeEmbedding_handler "orion/ai-svc-go/internal/code-embedding/handler"
	codeEmbedding_service "orion/ai-svc-go/internal/code-embedding/service"

	degradation_handler "orion/ai-svc-go/internal/degradation/handler"
	degradation_service "orion/ai-svc-go/internal/degradation/service"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-ai-svc"))
	defer logger.Sync()

	llmCfg := llm_config.Load()
	intel_config.Load()
	skill_config.Load()

	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		llmCfg.DBHost, llmCfg.DBPort, llmCfg.DBUser, llmCfg.DBPassword, llmCfg.DBName, llmCfg.DBSSLMode)
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

	rdb := orionredis.NewClient(orionredis.Config{Addr: llmCfg.RedisAddr})
	defer rdb.Close()

	// LLM services
	llmRepo := llm_repo.NewRepository(db.DB)
	llmSvc := llm_service.NewService(llmRepo)
	llmH := llm_handler.NewHandler(llmSvc)

	// Intelligence services
	intelRepo := intel_repo.NewRepository(db.DB)
	intelSvc := intel_service.NewService(intelRepo)
	intelH := intel_handler.NewHandler(intelSvc)

	// Skill services
	skillRepo := skill_repo.NewRepository(db.DB)
	skillSvc := skill_service.NewService(skillRepo)
	skillH := skill_handler.NewHandler(skillSvc)

	// AI Agent services
	aiagentRepo := aiagent_repo.NewRepository(db.DB)
	aiagentSvc := aiagent_service.NewService(aiagentRepo)
	aiagentH := aiagent_handler.NewHandler(aiagentSvc)

	// AI Cost services
	aicostRepo := aicost_repo.NewRepository(db.DB)
	aicostSvc := aicost_service.NewService(aicostRepo)
	aicostH := aicost_handler.NewHandler(aicostSvc)

	// aigateway services
	aigatewayRepo := aigateway_repo.NewRepository(db.DB)
	aigatewaySvc := aigateway_service.NewService(aigatewayRepo)
	aigatewayH := aigateway_handler.NewHandler(aigatewaySvc)

	// aireview services
	aireviewRepo := aireview_repo.NewRepository(db.DB)
	aireviewSvc := aireview_service.NewService(aireviewRepo)
	aireviewH := aireview_handler.NewHandler(aireviewSvc)

	// aisecurity services
	aisecurityRepo := aisecurity_repo.NewRepository(db.DB)
	aisecuritySvc := aisecurity_service.NewService(aisecurityRepo)
	aisecurityH := aisecurity_handler.NewHandler(aisecuritySvc)

	// Phase 1 P0 services
	knowledgeRepo := knowledge_repo.NewKnowledgeRepository(db.DB)
	knowledgeSvc := knowledge_service.NewKnowledgeService(knowledgeRepo, logger)
	knowledgeH := knowledge_handler.NewKnowledgeHandler(knowledgeSvc)

	vectorRepo := vector_repo.NewVectorRepository(db.DB)
	vectorSvc := vector_service.NewVectorService(vectorRepo, logger)
	vectorH := vector_handler.NewVectorHandler(vectorSvc)

	semanticRepo := semantic_repo.NewSemanticSearchRepository(db.DB)
	semanticSvc := semantic_service.NewSemanticSearchService(semanticRepo, logger)
	semanticH := semantic_handler.NewSemanticSearchHandler(semanticSvc)

	orchestrationRepo := orchestration_repo.NewOrchestrationRepository(db.DB)
	orchestrationSvc := orchestration_service.NewOrchestrationService(orchestrationRepo, logger)
	orchestrationH := orchestration_handler.NewOrchestrationHandler(orchestrationSvc)

	llmtraceRepo := llmtrace_repo.NewLLMTraceRepository(db.DB)
	llmtraceSvc := llmtrace_service.NewLLMTraceService(llmtraceRepo, logger)
	llmtraceH := llmtrace_handler.NewLLMTraceHandler(llmtraceSvc)

	// Phase 2 P1 services
	autoRecoveryRepo := autoRecovery_repo.NewAutoRecoveryRepository(db.DB)
	autoRecoveryH := autoRecovery_handler.NewAutoRecoveryHandler(autoRecovery_service.NewAutoRecoveryService(autoRecoveryRepo, logger))

	ruleEngineH := ruleEngine_handler.NewRuleEngineHandler(ruleEngine_service.NewRuleEngineService(logger))

	promptSecurityH := promptSecurity_handler.NewPromptSecurityHandler(promptSecurity_service.NewPromptSecurityService(logger))

	taskExecutorH := taskExecutor_handler.NewTaskExecutorHandler(taskExecutor_service.NewTaskExecutorService(logger))

	codeEmbeddingH := codeEmbedding_handler.NewCodeEmbeddingHandler(codeEmbedding_service.NewCodeEmbeddingService(logger))

	degradationH := degradation_handler.NewDegradationHandler(degradation_service.NewDegradationService(logger))

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: llmCfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))

	// Register routes
	llmH.RegisterRoutes(rg)
	intelH.RegisterRoutes(rg)
	skillH.RegisterRoutes(rg)
	aiagentH.RegisterRoutes(rg)
	aicostH.RegisterRoutes(rg)
	aigatewayH.RegisterRoutes(rg)
	aireviewH.RegisterRoutes(rg)
	aisecurityH.RegisterRoutes(rg)

	// Phase 1 P0 routes
	knowledgeH.RegisterRoutes(rg)
	vectorH.RegisterRoutes(rg)
	semanticH.RegisterRoutes(rg)
	orchestrationH.RegisterRoutes(rg)
	llmtraceH.RegisterRoutes(rg)

	// Phase 2 P1 routes
	autoRecoveryH.RegisterRoutes(rg)
	ruleEngineH.RegisterRoutes(rg)
	promptSecurityH.RegisterRoutes(rg)
	taskExecutorH.RegisterRoutes(rg)
	codeEmbeddingH.RegisterRoutes(rg)
	degradationH.RegisterRoutes(rg)

	r.GET("/healthz", middleware.HealthCheck("orion-ai-svc"))

	addr := fmt.Sprintf(":%d", llmCfg.Port)
	logger.Info("ai-svc listening", zap.String("addr", addr))

	srv := &http.Server{Addr: addr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server error", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down ai-svc...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}
}