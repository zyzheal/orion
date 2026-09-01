package main

import (
	"orion/go-common/pkg/database"

	ai_agent_run_handler "orion/platform-svc-go/internal/ai-agent-run/handler"
	ai_agent_run_repo "orion/platform-svc-go/internal/ai-agent-run/repository"
	ai_agent_run_service "orion/platform-svc-go/internal/ai-agent-run/service"
	aiDecisions_handler "orion/platform-svc-go/internal/ai/decisions/handler"
	aiDecisions_repo "orion/platform-svc-go/internal/ai/decisions/repository"
	aiDecisions_service "orion/platform-svc-go/internal/ai/decisions/service"
	aiGateway_handler "orion/platform-svc-go/internal/ai/gateway/handler"
	aiGateway_repo "orion/platform-svc-go/internal/ai/gateway/repository"
	aiGateway_service "orion/platform-svc-go/internal/ai/gateway/service"
	llmprovider "orion/platform-svc-go/internal/ai/llm-provider"
	pm_handler "orion/platform-svc-go/internal/plugin-marketplace/handler"
	pm_repo "orion/platform-svc-go/internal/plugin-marketplace/repository"
	pm_service "orion/platform-svc-go/internal/plugin-marketplace/service"

	"go.uber.org/zap"
)

var (
	pluginMarketplaceH *pm_handler.Handler
	aiAgentRunH        *ai_agent_run_handler.Handler
	aiDecisionsH       *aiDecisions_handler.Handler
	aiGatewayH         *aiGateway_handler.Handler
)

// wireAIInlineServices wires ai-decisions, ai-agent-run, plugin-marketplace,
// and ai-gateway handlers. ai-decisions and ai-gateway share the LLM provider
// registry created by initWiring (which reads env vars for OpenAI/Anthropic keys).
func wireAIInlineServices(db *database.DB, logger *zap.Logger, llmRegistry *llmprovider.ProviderRegistry) {
	// ai-decisions services
	aiDecisionsRepo := aiDecisions_repo.NewRepository(db.DB)
	aiDecisionsSvc := aiDecisions_service.NewService(aiDecisionsRepo)
	aiDecisionsSvc.WithLLMProvider(llmRegistry)
	aiDecisionsH = aiDecisions_handler.NewHandler(aiDecisionsSvc)
	// ai-agent-run services
	aiAgentRunRepo := ai_agent_run_repo.NewRepository(db.DB)
	aiAgentRunSvc := ai_agent_run_service.NewService(aiAgentRunRepo)
	aiAgentRunH = ai_agent_run_handler.NewHandler(aiAgentRunSvc)
	// plugin-marketplace services
	pmRepo := pm_repo.NewRepository(db.DB)
	pmSvc := pm_service.NewService(pmRepo)
	pluginMarketplaceH = pm_handler.NewHandler(pmSvc)
	// ai-gateway services
	aiGatewayRepo := aiGateway_repo.NewRepository(db.DB)
	aiGatewaySvc := aiGateway_service.NewService(aiGatewayRepo)
	aiGatewaySvc.WithLLMProvider(llmRegistry)
	aiGatewayH = aiGateway_handler.NewHandler(aiGatewaySvc)
}
