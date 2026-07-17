package service

import (
	"context"
	"orion/platform-svc-go/internal/oncall/models"
	"time"
)

// OnCallRepo defines the repository interface for testing.
type OnCallRepo interface {
	CreateSchedule(ctx context.Context, s *models.Schedule) error
	GetSchedule(ctx context.Context, id string) (*models.Schedule, error)
	ListSchedules(ctx context.Context, tenantID string, status *string) ([]models.Schedule, int, error)
	UpdateSchedule(ctx context.Context, id string, updates map[string]interface{}) (*models.Schedule, error)
	DeleteSchedule(ctx context.Context, id string) (bool, error)
	CreateAssignment(ctx context.Context, a *models.Assignment) error
	GetAssignment(ctx context.Context, id string) (*models.Assignment, error)
	ListAssignments(ctx context.Context, scheduleID *string) ([]models.Assignment, int, error)
	UpdateAssignment(ctx context.Context, id string, updates map[string]interface{}) (*models.Assignment, error)
	DeleteAssignment(ctx context.Context, id string) (bool, error)
	CreateOverride(ctx context.Context, o *models.Override) error
	GetOverride(ctx context.Context, id string) (*models.Override, error)
	ListOverrides(ctx context.Context, scheduleID *string) ([]models.Override, int, error)
	UpdateOverride(ctx context.Context, id string, updates map[string]interface{}) (*models.Override, error)
	DeleteOverride(ctx context.Context, id string) (bool, error)
	GetScheduleAssignments(ctx context.Context, scheduleID string, now time.Time) ([]models.Assignment, error)
	GetActiveOverrides(ctx context.Context, scheduleID string, now time.Time) ([]models.Override, error)
}
