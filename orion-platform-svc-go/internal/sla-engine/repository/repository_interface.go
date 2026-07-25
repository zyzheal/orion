package repository

import (
	"context"
	"orion/platform-svc-go/internal/sla-engine/models"
)

// RepositoryInterface defines the data access contract for the sla-engine module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateProfile(ctx context.Context, m *models.SLAProfile) error
	GetProfile(ctx context.Context, tenantID, id string) (*models.SLAProfile, error)
	ListProfiles(ctx context.Context, tenantID string, q models.ProfileListQuery) ([]models.SLAProfile, error)
	UpdateProfile(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteProfile(ctx context.Context, tenantID, id string) error

	CreateTracker(ctx context.Context, m *models.SLATracker) error
	GetTracker(ctx context.Context, tenantID, id string) (*models.SLATracker, error)
	ListTrackers(ctx context.Context, tenantID string, q models.TrackerListQuery) ([]models.SLATracker, error)
	UpdateTracker(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteTracker(ctx context.Context, tenantID, id string) error

	CreateHoliday(ctx context.Context, m *models.SLAHoliday) error
	ListHolidays(ctx context.Context, tenantID string, year int) ([]models.SLAHoliday, error)
	DeleteHoliday(ctx context.Context, tenantID, id string) error

	GetActiveTrackersByProfile(ctx context.Context, tenantID, profileID string) ([]models.SLATracker, error)
	GetTrackerStatistics(ctx context.Context, tenantID string) (models.TrackerStatistics, error)
	GetHolidaysForPeriod(ctx context.Context, tenantID string, start, end interface{}) ([]models.SLAHoliday, error)
	CreateViolation(ctx context.Context, v *models.SLAViolation) error
	ListViolations(ctx context.Context, tenantID string, q models.ViolationListQuery) ([]models.SLAViolation, error)
	MarkViolated(ctx context.Context, tenantID, trackerID string, violationType, details string) (*models.SLAViolation, error)
	GetViolationsByTracker(ctx context.Context, trackerID string) ([]models.SLAViolation, error)
	GetViolationStatistics(ctx context.Context, tenantID string) (models.ViolationStatistics, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
