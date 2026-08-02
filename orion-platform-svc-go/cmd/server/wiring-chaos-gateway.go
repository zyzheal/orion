package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	chaosgw_handler "orion/platform-svc-go/internal/chaos-gateway/handler"
	chaosgw_service "orion/platform-svc-go/internal/chaos-gateway/service"
)

func wireChaosGateway(db *database.DB, logger *zap.Logger) {
	_ = db
	svc := chaosgw_service.NewService(logger)
	chaosGatewayH = chaosgw_handler.NewHandler(svc)
}

var chaosGatewayH *chaosgw_handler.Handler
