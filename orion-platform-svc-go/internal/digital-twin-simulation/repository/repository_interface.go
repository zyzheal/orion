package repository

import (
	"context"
	"orion/platform-svc-go/internal/digital-twin-simulation/models"
)


// RepositoryInterface defines the data access contract for the digital-twin-simulation module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
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

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
