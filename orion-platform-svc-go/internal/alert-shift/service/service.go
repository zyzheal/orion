package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/alert-shift/models"
)

// Repository defines the data access interface.
type Repository interface {
	CreateShift(ctx context.Context, s *models.Shift) error
	GetShift(ctx context.Context, tenantID, id string) (*models.Shift, error)
	ListShifts(ctx context.Context, tenantID string) ([]models.Shift, error)
	UpdateShift(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteShift(ctx context.Context, tenantID, id string) (bool, error)
	CreateAssignment(ctx context.Context, a *models.Assignment) error
	ListAssignments(ctx context.Context, tenantID, shiftID string) ([]models.Assignment, error)
}

type Service struct {
	repo   Repository
	logger *zap.Logger
}

func NewService(repo Repository, logger *zap.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}

func (s *Service) CreateShift(ctx context.Context, tenantID string, req *models.CreateShiftRequest) (*models.Shift, error) {
	if tenantID == "" {
		tenantID = "default"
	}
	if req.TenantID != nil {
		tenantID = *req.TenantID
	}
	if req.Pattern == "" {
		req.Pattern = "round_robin"
	}
	if !req.Enabled {
		req.Enabled = true
	}
	if req.Weekdays == nil {
		req.Weekdays = []int{1, 2, 3, 4, 5}
	}

	now := time.Now().UTC()
	shift := &models.Shift{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Name:      req.Name,
		Team:      req.Team,
		Pattern:   req.Pattern,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
		Weekdays:  req.Weekdays,
		Enabled:   req.Enabled,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.repo.CreateShift(ctx, shift); err != nil {
		return nil, fmt.Errorf("create shift: %w", err)
	}
	return shift, nil
}

func (s *Service) GetShift(ctx context.Context, tenantID, id string) (*models.Shift, error) {
	return s.repo.GetShift(ctx, tenantID, id)
}

func (s *Service) ListShifts(ctx context.Context, tenantID string) ([]models.Shift, error) {
	return s.repo.ListShifts(ctx, tenantID)
}

func (s *Service) UpdateShift(ctx context.Context, tenantID, id string, req *models.UpdateShiftRequest) (*models.Shift, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Team != nil {
		updates["team"] = *req.Team
	}
	if req.Pattern != nil {
		updates["pattern"] = *req.Pattern
	}
	if req.StartTime != nil {
		updates["start_time"] = *req.StartTime
	}
	if req.EndTime != nil {
		updates["end_time"] = *req.EndTime
	}
	if req.Weekdays != nil {
		updates["weekdays"] = req.Weekdays
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}
	if err := s.repo.UpdateShift(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetShift(ctx, tenantID, id)
}

func (s *Service) DeleteShift(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteShift(ctx, tenantID, id)
}

func (s *Service) ListAssignments(ctx context.Context, tenantID, shiftID string) ([]models.Assignment, error) {
	return s.repo.ListAssignments(ctx, tenantID, shiftID)
}

func (s *Service) CreateAssignment(ctx context.Context, tenantID, shiftID string, req *models.CreateAssignmentRequest) (*models.Assignment, error) {
	role := req.Role
	if role == "" {
		role = "primary"
	}
	assignment := &models.Assignment{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		ShiftID:   shiftID,
		UserID:    req.UserID,
		Role:      role,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
		Assigned:  true,
		CreatedAt: time.Now().UTC(),
	}
	if err := s.repo.CreateAssignment(ctx, assignment); err != nil {
		return nil, fmt.Errorf("create assignment: %w", err)
	}
	return assignment, nil
}
