package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"

	// AI module: llm (LLM trace & cost tracking)
	ai_llm_handler "orion/platform-svc-go/internal/ai/llm/handler"
	ai_llm_repo "orion/platform-svc-go/internal/ai/llm/repository"
	ai_llm_service "orion/platform-svc-go/internal/ai/llm/service"

	// AI module: aicost (cost optimization)
	ai_aicost_handler "orion/platform-svc-go/internal/ai/aicost/handler"
	ai_aicost_repo "orion/platform-svc-go/internal/ai/aicost/repository"
	ai_aicost_service "orion/platform-svc-go/internal/ai/aicost/service"

	// AI module: aisecurity
	ai_aisecurity_handler "orion/platform-svc-go/internal/ai/aisecurity/handler"
	ai_aisecurity_repo "orion/platform-svc-go/internal/ai/aisecurity/repository"
	ai_aisecurity_service "orion/platform-svc-go/internal/ai/aisecurity/service"

	// AI module: orchestration (multi-agent orchestration)
	ai_orchestration_handler "orion/platform-svc-go/internal/ai/orchestration/handler"
	ai_orchestration_repo "orion/platform-svc-go/internal/ai/orchestration/repository"
	ai_orchestration_service "orion/platform-svc-go/internal/ai/orchestration/service"

	// AI module: auto-recovery (auto-recovery rules)
	ai_autorecovery_handler "orion/platform-svc-go/internal/ai/auto-recovery/handler"
	ai_autorecovery_repo "orion/platform-svc-go/internal/ai/auto-recovery/repository"
	ai_autorecovery_service "orion/platform-svc-go/internal/ai/auto-recovery/service"

	// AI module: skill (skill package management)
	ai_skill_handler "orion/platform-svc-go/internal/ai/skill/handler"
	ai_skill_repo "orion/platform-svc-go/internal/ai/skill/repository"
	ai_skill_service "orion/platform-svc-go/internal/ai/skill/service"

	// AI module: intelligence (intelligence tasks)
	ai_intelligence_handler "orion/platform-svc-go/internal/ai/intelligence/handler"
	ai_intelligence_repo "orion/platform-svc-go/internal/ai/intelligence/repository"
	ai_intelligence_service "orion/platform-svc-go/internal/ai/intelligence/service"
)

// wireAIModules wires all AI sub-modules (repo → service → handler).
// Called from initWiring().
func wireAIModules(db *database.DB, logger *zap.Logger) {
	// --- llm: LLM trace & cost tracking ---
	ai_llmRepo := ai_llm_repo.NewRepository(db.DB)
	ai_llmSvc := ai_llm_service.NewService(ai_llmRepo)
	ai_llmH = ai_llm_handler.NewHandler(ai_llmSvc)

	// --- aicost: cost optimization ---
	ai_aicostRepo := ai_aicost_repo.NewRepository(db.DB)
	ai_aicostSvc := ai_aicost_service.NewService(ai_aicostRepo)
	ai_aicostH = ai_aicost_handler.NewHandler(ai_aicostSvc)

	// --- aisecurity ---
	ai_aisecurityRepo := ai_aisecurity_repo.NewRepository(db.DB)
	ai_aisecuritySvc := ai_aisecurity_service.NewService(ai_aisecurityRepo)
	ai_aisecurityH = ai_aisecurity_handler.NewHandler(ai_aisecuritySvc)

	// --- orchestration: multi-agent orchestration ---
	ai_orchestrationRepo := ai_orchestration_repo.NewOrchestrationRepository(db.DB)
	ai_orchestrationSvc := ai_orchestration_service.NewOrchestrationService(ai_orchestrationRepo, logger)
	ai_orchestrationH = ai_orchestration_handler.NewOrchestrationHandler(ai_orchestrationSvc)

	// --- auto-recovery: auto-recovery rules ---
	ai_autorecoveryRepo := ai_autorecovery_repo.NewAutoRecoveryRepository(db.DB)
	ai_autorecoverySvc := ai_autorecovery_service.NewAutoRecoveryService(ai_autorecoveryRepo, logger)
	ai_autorecoveryH = ai_autorecovery_handler.NewAutoRecoveryHandler(ai_autorecoverySvc)

	// --- skill: skill package management ---
	ai_skillRepo := ai_skill_repo.NewRepository(db.DB)
	ai_skillSvc := ai_skill_service.NewService(ai_skillRepo)
	ai_skillH = ai_skill_handler.NewHandler(ai_skillSvc)

	// --- intelligence: intelligence tasks ---
	ai_intelligenceRepo := ai_intelligence_repo.NewRepository(db.DB)
	ai_intelligenceSvc := ai_intelligence_service.NewService(ai_intelligenceRepo)
	ai_intelligenceH = ai_intelligence_handler.NewHandler(ai_intelligenceSvc)
}
// Handler variables for ai_wiring (moved from central wiring.go var block)
var (
	ai_aicostH        *ai_aicost_handler.Handler
	ai_aisecurityH    *ai_aisecurity_handler.Handler
	ai_autorecoveryH  *ai_autorecovery_handler.AutoRecoveryHandler
	ai_intelligenceH  *ai_intelligence_handler.Handler
	ai_llmH           *ai_llm_handler.Handler
	ai_orchestrationH *ai_orchestration_handler.OrchestrationHandler
	ai_skillH         *ai_skill_handler.Handler
)
