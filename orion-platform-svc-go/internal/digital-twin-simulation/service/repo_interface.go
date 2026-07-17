package service

import (
	"context"

	"orion/platform-svc-go/internal/digital-twin-simulation/models"
)

// DigitalTwinSimRepo is the repository interface consumed by Service.
// It lists every repo.* call made inside service.go so the service can
// be unit-tested with an in-memory mock.
type DigitalTwinSimRepo interface {
	CreateTwin(ctx context.Context, tenantID string, req models.CreateTwinRequest) (*models.DigitalTwin, error)
	FindTwinByID(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error)
	ListTwins(ctx context.Context, tenantID string, q models.ListQuery) ([]models.DigitalTwin, int64, error)
	UpdateTwin(ctx context.Context, tenantID, id string, req models.UpdateTwinRequest) (*models.DigitalTwin, error)
	DeleteTwin(ctx context.Context, tenantID, id string) error
	UpdateTwinStatusAndSync(ctx context.Context, tenantID, id string, status string, lastSync *int64, updatedAt int64) (*models.DigitalTwin, error)
	CreateState(ctx context.Context, state models.TwinState) (*models.TwinState, error)
	GetLatestState(ctx context.Context, twinID string) (*models.TwinState, error)
	CreateSimulation(ctx context.Context, tenantID string, sim models.Simulation) (*models.Simulation, error)
	ListSimulations(ctx context.Context, twinID string, q models.ListQuery) ([]models.Simulation, int64, error)
	UpdateSimulation(ctx context.Context, id string, status string, endTime *int64, duration *int64, results models.JSON) (*models.Simulation, error)
}
