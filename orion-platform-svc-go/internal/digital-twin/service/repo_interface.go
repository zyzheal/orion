package service

import (
	"context"

	"orion/platform-svc-go/internal/digital-twin/models"
)

// DigitalTwinRepo is the repository interface consumed by Service.
// It lists every repo.* call made inside service.go so the service can
// be unit-tested with an in-memory mock.
type DigitalTwinRepo interface {
	CreateTwin(ctx context.Context, tenantID string, req models.CreateDigitalTwinRequest) (*models.DigitalTwin, error)
	FindTwinByID(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error)
	FindAllTwins(ctx context.Context, tenantID string) ([]models.DigitalTwin, error)
	CreateSnapshot(ctx context.Context, twinID, name string) (*models.Snapshot, error)
	CreateTrafficRecord(ctx context.Context, in models.CreateTrafficRecordInput) (*models.TrafficRecord, error)
	FindTrafficRecordsByTwinID(ctx context.Context, twinID string) ([]models.TrafficRecord, error)
	CreateReplaySession(ctx context.Context, in models.CreateReplaySessionInput) (*models.ReplaySession, error)
	FindReplaySessionsByTwinID(ctx context.Context, twinID string) ([]models.ReplaySession, error)
	FindReplaySessionById(ctx context.Context, id string) (*models.ReplaySession, error)
	UpdateReplaySession(ctx context.Context, id, status string) (*models.ReplaySession, error)
}
