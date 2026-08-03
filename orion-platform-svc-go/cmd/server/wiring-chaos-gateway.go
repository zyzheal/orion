package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	chaosgw_handler "orion/platform-svc-go/internal/chaos-gateway/handler"
	chaosgw_repo "orion/platform-svc-go/internal/chaos-gateway/repository"
	chaosgw_service "orion/platform-svc-go/internal/chaos-gateway/service"
)

func wireChaosGateway(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := chaosgw_repo.NewRepository(db.DB)
	svc := chaosgw_service.NewService(repo)
	chaosGatewayH = chaosgw_handler.NewHandler(svc)
}

var chaosGatewayH *chaosgw_handler.Handler
