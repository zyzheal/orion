package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	dt_simulation_handler "orion/platform-svc-go/internal/digital-twin-simulation/handler"
	dt_simulation_repo "orion/platform-svc-go/internal/digital-twin-simulation/repository"
	dt_simulation_service "orion/platform-svc-go/internal/digital-twin-simulation/service"
)

var digitalTwinSimulationH *dt_simulation_handler.Handler

func wireDigitalTwinSimulation(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := dt_simulation_repo.NewRepository(db.DB)
	svc := dt_simulation_service.NewService(repo)
	digitalTwinSimulationH = dt_simulation_handler.NewHandler(svc)
}
