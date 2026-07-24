package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/oncall/models"
	"orion/platform-svc-go/internal/oncall/repository"
	"go.uber.org/zap"
)

type OnCallService struct {
	repo   *repository.OnCallRepository
	logger *zap.Logger
}

func NewOnCallService(repo *repository.OnCallRepository, logger *zap.Logger) *OnCallService {
	return &OnCallService{repo: repo, logger: logger}
}

// CreateSchedule creates a new on-call schedule.
func (s *OnCallService) CreateSchedule(ctx context.Context, tenantID uuid.UUID, req *models.CreateScheduleRequest) (*models.Schedule, error) {
	schedule, err := s.repo.CreateSchedule(ctx, tenantID, req)
	if err != nil {
		s.logger.Error("failed to create schedule",
			zap.String("tenantId", tenantID.String()),
			zap.Error(err),
		)
		return nil, err
	}
	s.logger.Info("schedule created",
		zap.String("scheduleId", schedule.ID.String()),
		zap.String("name", schedule.Name),
	)
	return schedule, nil
}

// QuerySchedules returns paginated schedules.
func (s *OnCallService) QuerySchedules(ctx context.Context, tenantID uuid.UUID, limit, offset int) (models.ScheduleResponse, error) {
	return s.repo.QuerySchedules(ctx, tenantID, limit, offset)
}

// GetSchedule returns a single schedule.
func (s *OnCallService) GetSchedule(ctx context.Context, tenantID, id uuid.UUID) (*models.Schedule, error) {
	return s.repo.GetSchedule(ctx, tenantID, id)
}

// AddRotation adds a rotation to a schedule.
func (s *OnCallService) AddRotation(ctx context.Context, tenantID, scheduleID uuid.UUID, req *models.AddRotationRequest) (*models.Rotation, error) {
	if req.EndDate.Before(req.StartDate) {
		return nil, fmt.Errorf("end_date must be after start_date")
	}

	schedule, err := s.repo.GetSchedule(ctx, tenantID, scheduleID)
	if err != nil {
		return nil, fmt.Errorf("schedule not found: %s", scheduleID)
	}

	rotation, err := s.repo.AddRotation(ctx, scheduleID, req)
	if err != nil {
		s.logger.Error("failed to add rotation",
			zap.String("scheduleId", schedule.ID.String()),
			zap.Error(err),
		)
		return nil, err
	}
	s.logger.Info("rotation added",
		zap.String("scheduleId", schedule.ID.String()),
		zap.String("userId", req.UserID),
	)
	return rotation, nil
}

// GetCurrentOnCall returns who is currently on-call.
func (s *OnCallService) GetCurrentOnCall(ctx context.Context, scheduleID uuid.UUID) (*models.CurrentOnCallResponse, error) {
	return s.repo.GetCurrentOnCall(ctx, scheduleID)
}

// QueryRotations returns rotations for a schedule.
func (s *OnCallService) QueryRotations(ctx context.Context, scheduleID uuid.UUID, limit, offset int) ([]models.Rotation, int64, error) {
	return s.repo.QueryRotations(ctx, scheduleID, limit, offset)
}

// DeleteSchedule removes a schedule.
func (s *OnCallService) DeleteSchedule(ctx context.Context, tenantID, id uuid.UUID) error {
	if err := s.repo.DeleteSchedule(ctx, tenantID, id); err != nil {
		s.logger.Error("failed to delete schedule",
			zap.String("scheduleId", id.String()),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("schedule deleted", zap.String("scheduleId", id.String()))
	return nil
}
