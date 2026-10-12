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
	if req.Enabled == false {
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

func (s *Service) UpdateShift(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return fmt.Errorf("no fields to update")
	}
	return s.repo.UpdateShift(ctx, tenantID, id, updates)
}

func (s *Service) DeleteShift(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteShift(ctx, tenantID, id)
}
