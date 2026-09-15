package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	chaos_repo "orion/platform-svc-go/internal/chaos/repository"
	chaos_service "orion/platform-svc-go/internal/chaos/service"

	chaos_enhanced_repo "orion/platform-svc-go/internal/chaos-enhanced/repository"
	chaos_enhanced_service "orion/platform-svc-go/internal/chaos-enhanced/service"

	chaos_gateway_repo "orion/platform-svc-go/internal/chaos-gateway/repository"
	chaos_gateway_service "orion/platform-svc-go/internal/chaos-gateway/service"

	chaos_engine_handler "orion/platform-svc-go/internal/chaos-engine/handler"
)

// wireChaosEngine merges chaos + chaos-enhanced + chaos-gateway into one unified handler.
// All three underlying modules keep their own repos/services; the handler
// delegates to the appropriate sub-handler per route.
func wireChaosEngine(db *database.DB, logger *zap.Logger) {
	_ = logger

	chaosRepo := chaos_repo.NewRepository(db.DB)
	chaosSvc := chaos_service.NewService(chaosRepo)

	chaosEnhancedRepo := chaos_enhanced_repo.NewRepository(db.DB)
	chaosEnhancedSvc := chaos_enhanced_service.NewService(chaosEnhancedRepo)

	chaosGatewayRepo := chaos_gateway_repo.NewRepository(db.DB)
	chaosGatewaySvc := chaos_gateway_service.NewService(chaosGatewayRepo)

	chaosEngineH = chaos_engine_handler.NewHandler(chaosSvc, chaosEnhancedSvc, chaosGatewaySvc)
}

var chaosEngineH *chaos_engine_handler.Handler
