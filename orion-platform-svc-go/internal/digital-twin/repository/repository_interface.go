package repository

import (
	"context"
	"orion/platform-svc-go/internal/digital-twin/models"
)


// RepositoryInterface defines the data access contract for the digital-twin module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateTwin(ctx context.Context, tenantID string, req models.CreateDigitalTwinRequest) (*models.DigitalTwin, error)
	FindTwinByID(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error)
	FindAllTwins(ctx context.Context, tenantID string) ([]models.DigitalTwin, error)
	CreateSnapshot(ctx context.Context, twinID, name string) (*models.Snapshot, error)
	CreateTrafficRecord(ctx context.Context, in models.CreateTrafficRecordInput) (*models.TrafficRecord, error)
	FindTrafficRecordsByTwinID(ctx context.Context, tenantID, twinID string) ([]models.TrafficRecord, error)
	CreateReplaySession(ctx context.Context, in models.CreateReplaySessionInput) (*models.ReplaySession, error)
	FindReplaySessionsByTwinID(ctx context.Context, tenantID, twinID string) ([]models.ReplaySession, error)
	FindReplaySessionById(ctx context.Context, tenantID, id string) (*models.ReplaySession, error)
	UpdateReplaySession(ctx context.Context, tenantID, id, status string) (*models.ReplaySession, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
