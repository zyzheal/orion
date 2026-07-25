package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/sla-engine/events"
	"orion/platform-svc-go/internal/sla-engine/models"
)

// ServiceInterface defines the interface for the sla-engine calculator.
type ServiceInterface interface {
	CalculateDeadlines(ctx context.Context, profile *models.SLAProfile, openedAt time.Time) (responseDeadline, resolutionDeadline time.Time)
	CreateTracker(ctx context.Context, tenantID, slaProfileID, targetID, targetType string, openedAt time.Time) (*models.SLATracker, error)
	PauseTracker(ctx context.Context, tenantID, trackerID, reason string) error
	ResumeTracker(ctx context.Context, tenantID, trackerID string) error
	RecordResponse(ctx context.Context, tenantID, trackerID string) error
	RecordResolution(ctx context.Context, tenantID, trackerID string) error
	CheckBreaches(ctx context.Context, tenantID string) []models.SLATracker
	GetTracker(ctx context.Context, tenantID, trackerID string) (*models.SLATracker, error)
	ListTrackers(ctx context.Context, tenantID, targetType, status string, limit, offset int) ([]models.SLATracker, error)

	CreateProfile(ctx context.Context, tenantID string, req models.CreateProfileRequest) (*models.SLAProfile, error)
	GetProfile(ctx context.Context, tenantID, id string) (*models.SLAProfile, error)
	ListProfiles(ctx context.Context, tenantID string, q models.ProfileListQuery) ([]models.SLAProfile, error)
	UpdateProfile(ctx context.Context, tenantID, id string, req models.UpdateProfileRequest) (*models.SLAProfile, error)
	DeleteProfile(ctx context.Context, tenantID, id string) error

	ComplianceReport(ctx context.Context, tenantID string, startDate, endDate time.Time, severity models.SeverityLevel) (*models.SlaComplianceReport, error)
	ScanBreaches(ctx context.Context, tenantID string) ([]events.ViolationAlert, error)
	GetViolationsByTracker(ctx context.Context, trackerID string) ([]models.SLAViolation, error)
	GetViolationStatistics(ctx context.Context, tenantID string) (models.ViolationStatistics, error)
	MarkViolated(ctx context.Context, tenantID, trackerID string, violationType, details string) (*models.SLAViolation, error)
	CreateHoliday(ctx context.Context, tenantID, name string, date time.Time) (*models.SLAHoliday, error)
	GetTrackerStatistics(ctx context.Context, tenantID string) (models.TrackerStatistics, error)
}

// Ensure compile-time safety: *SLACalculator implements ServiceInterface.
var _ ServiceInterface = (*SLACalculator)(nil)
